import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import * as chatIntegrationService from "@/services/chatIntegrationService";
import { inngest } from "@/inngest";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { getSupportChannelByWhatsAppSession } from "@/services/supportChannelService";
import { respondToChannelMessage } from "@/services/supportChannelChatService";
import { upsertSupportContact } from "@/services/supportContactService";
import { checkFeatureAccess } from "@/services/subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "@/config/subscription-features";
import { consumePremiumQuota } from "@/services/subscriptionService";
import { QUOTA_COST } from "@/config/rate-limits";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { downloadAndSaveImage } from "@/services/taskImageService";
import { getWorkerByExternalId } from "@/services/humanWorkerService";

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
    botJid?: string;
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
      mentionedJid?: string[];
      groupJid?: string;
      /** Raw Baileys remoteJid — use for replies so JID matches exactly. */
      remoteJid?: string;
      attachments?: Array<{
        type: "image" | "file" | "document";
        url?: string;
        base64?: string;
        mimeType?: string;
        fileName?: string;
      }>;
    };
  };

  if (!body?.payload?.from) {
    return res.status(400).json({ error: "payload.from is required" });
  }

  const payload = body.payload;
  const fromJid = payload.from;
  const isGroup = payload.isGroup === true;
  const groupJid = payload.groupJid;
  const botJid = body.botJid;
  // Use raw Baileys remoteJid for replies — preserves exact JID format (@s.whatsapp.net, @lid, etc.)
  const rawRemoteJid = payload.remoteJid;

  // For group messages: only process if the bot was mentioned
  if (isGroup) {
    if (!botJid || !payload.mentionedJid?.length) {
      // No bot JID or no mentions — skip silently
      return res.json({ ok: true, skipped: "not_mentioned" });
    }
    // Normalize comparison: Baileys JIDs can have :0 suffix (e.g. "1234567890:0@s.whatsapp.net")
    const normalizedBotJid = botJid.replace(/:.*@/, "@");
    const isMentioned = payload.mentionedJid.some(
      (jid) => jid === botJid || jid.replace(/:.*@/, "@") === normalizedBotJid
    );
    if (!isMentioned) {
      return res.json({ ok: true, skipped: "not_mentioned" });
    }
    // Strip the bot's phone number from the message text (users see @phone_number)
    const botPhone = botJid.split("@")[0].replace(/\D/g, "");
    if (botPhone) {
      payload.body = payload.body.replace(new RegExp(`@${botPhone}`, "g"), "").trim();
    }
  }

  // For replies: use raw remoteJid (preserves exact Baileys JID format).
  // For groups: remoteJid IS the group JID. For 1:1: remoteJid IS the sender JID.
  // Fallback to groupJid/fromJid for backwards compat with older connector payloads.
  const replyToJid = rawRemoteJid || (isGroup && groupJid ? groupJid : fromJid);

  const integrationId = body.integrationId;
  if (integrationId) {
    const integration = await (prisma as any).chatIntegration.findFirst({
      where: { id: integrationId, platform: "WHATSAPP", isActive: true },
    });
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // WhatsApp Chat Integration (agent that replies when users message from WhatsApp) is a premium feature
    try {
      await checkFeatureAccess(integration.userId, SUBSCRIPTION_FEATURES.WHATSAPP_CHAT_INTEGRATION);
    } catch {
      try {
        await sendWhatsAppMessage({
          sessionRef: integration.whatsappSessionId || integrationId,
          toJid: replyToJid,
          text: "WhatsApp chat with Verxio is a premium feature. Please upgrade your plan to use it.",
        });
      } catch (_) {}
      return res.json({ ok: true, premiumRequired: true });
    }

    // Consume credits for this chat message (beta-tester plan only)
    try {
      await consumePremiumQuota(integration.userId, QUOTA_COST.WHATSAPP_CHAT_INTEGRATION);
    } catch (quotaError) {
      const msg = quotaError instanceof Error ? quotaError.message : "Rate limit exceeded.";
      try {
        await sendWhatsAppMessage({
          sessionRef: integration.whatsappSessionId || integrationId,
          toJid: replyToJid,
          text: msg.includes("credits")
            ? "You've used your daily chat credits. Limit resets at midnight."
            : msg,
        });
      } catch (_) {}
      return res.json({ ok: true, quotaExceeded: true });
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
      attachments: payload.attachments,
      metadata: { chatId: replyToJid, whatsappPayload: payload, isGroup, groupJid },
    };

    // Build quoted key for reply-to (Baileys quoted)
    const quotedKey =
      payload.messageId && replyToJid
        ? {
            remoteJid: replyToJid,
            id: payload.messageId,
            fromMe: false as const,
            participant: isGroup && payload.participant ? payload.participant : undefined,
          }
        : undefined;

    // Prefix for group replies so it's clear who the reply is for
    const groupPrefix = isGroup && payload.pushName ? `**${payload.pushName}:** ` : "";

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
          const withPrefix = groupPrefix + replyText;
          const formatted = chatIntegrationService.formatWhatsAppMessage(withPrefix);
          const sendResult = await sendWhatsAppMessage({
            sessionRef: integrationId,
            toJid: replyToJid,
            text: formatted,
            quotedKey,
          });
        }
      } catch (err) {
        try {
          await sendWhatsAppMessage({
            sessionRef: integrationId,
            toJid: replyToJid,
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
    } catch (triggerErr) {}

    return res.json({ ok: true });
  }

  // Support channel branch: sessionId without integrationId can map to a SupportChannel
  if (body.sessionId && !body.integrationId) {
    const supportChannel = await getSupportChannelByWhatsAppSession(body.sessionId);
    if (supportChannel) {
      const agentStatus = (supportChannel as { supportAgent?: { status: string } }).supportAgent
        ?.status;
      if (agentStatus === "disabled") {
        return res.json({ ok: true, skipped: "agent_disabled" });
      }

      // Save contact when someone messages the support agent (normalize JID to prevent duplicates)
      try {
        // For WhatsApp we must preserve the real remote JID (often @lid). Digits-only IDs can collide.
        const normalizedRemoteJid =
          typeof rawRemoteJid === "string" && rawRemoteJid
            ? rawRemoteJid.replace(/:.*@/, "@")
            : "";
        const externalIdForContact =
          normalizedRemoteJid || (typeof fromJid === "string" && fromJid ? `${fromJid}@s.whatsapp.net` : "");
        const phoneMatch = fromJid.match(/^(\d{7,})$/);
        await upsertSupportContact({
          supportAgentId: supportChannel.supportAgentId,
          supportChannelId: supportChannel.id,
          platform: "WHATSAPP",
          externalId: externalIdForContact,
          externalName: payload.pushName ?? null,
          phone: phoneMatch ? `+${phoneMatch[1]}` : null,
          metadata: normalizedRemoteJid ? { whatsappRemoteJid: normalizedRemoteJid } : undefined,
        });
      } catch (contactErr) {}

      // Check if sender is a task worker before routing to support agent
      const normalizedJidForWorker =
        typeof rawRemoteJid === "string" && rawRemoteJid
          ? rawRemoteJid.replace(/:.*@/, "@")
          : "";
      if (normalizedJidForWorker) {
        try {
          const worker = await getWorkerByExternalId("WHATSAPP", normalizedJidForWorker);
          if (worker) {
            let imageUrl: string | undefined;
            const attachments = payload.attachments as any[] | undefined;
            if (attachments && attachments.length > 0) {
              const imgAttachment = attachments.find(
                (a: any) => a.mimetype?.startsWith("image/") && a.url
              );
              if (imgAttachment?.url) {
                imageUrl = await downloadAndSaveImage(imgAttachment.url);
              }
            }
            const result = await handleIncomingSubmission(
              "WHATSAPP",
              normalizedJidForWorker,
              payload.body,
              imageUrl
            );
            if (result.handled && result.feedback) {
              const formatted = chatIntegrationService.formatWhatsAppMessage(result.feedback);
              await sendWhatsAppMessage({
                sessionRef: body.sessionId!,
                toJid: replyToJid,
                text: formatted,
              });
            }
            if (result.handled) {
              return res.json({ ok: true, taskSubmission: true });
            }
          }
        } catch (workerErr) {
          console.warn("[WhatsApp] Worker routing check failed:", workerErr);
        }
      }

      // For now, always route messages to the bound support agent
      const groupPrefix = isGroup && payload.pushName ? `**${payload.pushName}:** ` : "";

      void (async () => {
        try {
          const replyText = await respondToChannelMessage({
            supportAgentId: supportChannel.supportAgentId,
            // Session should be keyed by the real JID for correct 1:1 + future group support
            externalId:
              (typeof rawRemoteJid === "string" && rawRemoteJid ? rawRemoteJid.replace(/:.*@/, "@") : "") ||
              fromJid,
            message: payload.body,
          });

          if (!replyText || !replyText.trim()) return;

          const withPrefix = groupPrefix + replyText;
          const formatted = chatIntegrationService.formatWhatsAppMessage(withPrefix);
          await sendWhatsAppMessage({
            sessionRef: body.sessionId!,
            toJid: replyToJid,
            text: formatted,
          });
        } catch (err) {
          try {
            await sendWhatsAppMessage({
              sessionRef: body.sessionId!,
              toJid: replyToJid,
              text: "Something went wrong. Please try again.",
            });
          } catch (_) {}
        }
      })();

      return res.json({ ok: true, supportChannelId: supportChannel.id });
    }
  }

  if (body.credentialId) {
    // Prefer Node.credentialId column (set when workflow is saved)
    let triggerNode = await (prisma as any).node.findFirst({
      where: {
        type: "WHATSAPP_TRIGGER",
        credentialId: body.credentialId,
      },
      include: { workflow: { select: { id: true, userId: true } } },
    });
    // Fallback: match by node.data.credentialId (in case column wasn't persisted)
    if (!triggerNode?.workflow) {
      const allTriggerNodes = await (prisma as any).node.findMany({
        where: { type: "WHATSAPP_TRIGGER" },
        include: { workflow: { select: { id: true, userId: true } } },
      });
      triggerNode = allTriggerNodes.find(
        (n: any) => (n.data && (n.data as any).credentialId) === body.credentialId
      );
    }
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
    console.warn(
      "[WhatsApp incoming] No WHATSAPP_TRIGGER node found for credentialId:",
      body.credentialId
    );
  }

  return res.json({ ok: true });
});

export const internalWhatsAppRouter = router;
