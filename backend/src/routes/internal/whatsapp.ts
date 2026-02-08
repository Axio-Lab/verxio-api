import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import * as chatIntegrationService from "@/services/chatIntegrationService";
import { inngest } from "@/inngest";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";

const ACK_MESSAGE = "Result will be shared shortly when done.";

const router = Router();

const INCOMING_SECRET = process.env.WHATSAPP_INCOMING_SECRET || "";

function validateSecret(req: Request): boolean {
  if (!INCOMING_SECRET) return true;
  const header = req.headers["x-whatsapp-secret"];
  return header === INCOMING_SECRET;
}

/**
 * POST /api/internal/whatsapp/incoming
 * Called by the WhatsApp Connector when a message is received.
 * Body: { sessionId, integrationId?, credentialId?, payload: WhatsAppPayload }
 */
router.post("/incoming", async (req: Request, res: Response) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as {
    sessionId?: string;
    integrationId?: string;
    credentialId?: string;
    payload?: {
      from: string;
      to: string;
      body: string;
      messageId: string;
      type: string;
      timestamp?: number;
      isGroup?: boolean;
      pushName?: string;
      participant?: string;
    };
  };

  if (!body?.payload?.from) {
    return res.status(400).json({ error: "payload.from is required" });
  }

  const payload = body.payload;
  const fromJid = payload.from;

  const integrationId = body.integrationId;
  if (integrationId) {
    const integration = await (prisma as any).chatIntegration.findFirst({
      where: { id: integrationId, platform: "WHATSAPP", isActive: true },
    });
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Link sender so they appear in Linked Accounts (no separate "link" step needed for WhatsApp)
    try {
      await chatIntegrationService.linkExternalIdentity(
        integration.userId,
        "whatsapp",
        fromJid,
        integration.id,
        payload.pushName
      );
    } catch (_) {
      // ignore link errors
    }

    const message: chatIntegrationService.ChatIntegrationMessage = {
      platform: "WHATSAPP",
      externalId: fromJid,
      externalName: payload.pushName,
      message: payload.body,
      metadata: { chatId: fromJid, whatsappPayload: payload },
    };

    // Send immediate ack (same idea as Telegram: user sees a response right away)
    try {
      await sendWhatsAppMessage({
        sessionRef: integrationId,
        toJid: fromJid,
        text: ACK_MESSAGE,
      });
    } catch (ackErr) {
      console.error("[WhatsApp incoming] ack send failed:", ackErr);
    }

    // Process in background and send formatted result when done
    void (async () => {
      try {
        const result = await chatIntegrationService.processMessage(
          integration.userId,
          integration,
          message
        );
        const replyText = result.message || "";
        if (replyText) {
          const formatted = chatIntegrationService.formatWhatsAppMessage(replyText);
          const sendResult = await sendWhatsAppMessage({
            sessionRef: integrationId,
            toJid: fromJid,
            text: formatted,
          });
          if (!sendResult.success) {
            console.error("[WhatsApp incoming] send reply failed:", sendResult.error);
          }
        }
      } catch (err) {
        console.error("[WhatsApp incoming] processMessage error:", err);
        try {
          await sendWhatsAppMessage({
            sessionRef: integrationId,
            toJid: fromJid,
            text: "Something went wrong. Please try again.",
          });
        } catch (_) {}
      }
    })();

    // Also trigger workflows that have WHATSAPP_TRIGGER linked to this integration (node.data.integrationId)
    try {
      const triggerNodes = await (prisma as any).node.findMany({
        where: { type: "WHATSAPP_TRIGGER" },
        include: { workflow: { select: { id: true, userId: true } } },
      });
      const matching = triggerNodes.filter(
        (n: any) => (n.data && (n.data as any).integrationId) === integrationId
      );
      for (const node of matching) {
        if (node.workflow) {
          await inngest.send({
            name: "workflow/trigger",
            data: {
              workflowId: node.workflow.id,
              userId: node.workflow.userId,
              whatsappNodeId: node.id,
              initialData: {
                whatsappPayload: payload,
                whatsappSessionRef: integrationId,
              },
            },
          });
        }
      }
    } catch (triggerErr) {
      console.error("[WhatsApp incoming] workflow trigger by integrationId failed:", triggerErr);
    }

    return res.json({ ok: true });
  }

  if (body.credentialId) {
    const triggerNode = await (prisma as any).node.findFirst({
      where: {
        type: "WHATSAPP_TRIGGER",
        credentialId: body.credentialId,
      },
      include: { workflow: { select: { id: true, userId: true } } },
    });
    if (triggerNode?.workflow) {
      await inngest.send({
        name: "workflow/trigger",
        data: {
          workflowId: triggerNode.workflow.id,
          userId: triggerNode.workflow.userId,
          whatsappNodeId: triggerNode.id,
          initialData: {
            whatsappPayload: payload,
            whatsappSessionRef: body.credentialId,
          },
        },
      });
      return res.json({ ok: true, triggered: true });
    }
  }

  return res.json({ ok: true });
});

export const internalWhatsAppRouter = router;
