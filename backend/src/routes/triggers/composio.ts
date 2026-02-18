import { Router, Request, Response, NextFunction } from "express";
import { inngest } from "../../inngest";
import { basePrismaClient } from "../../lib/prisma";
import { verifyComposioWebhook } from "@/services/composio/composioTriggerService";

export const composioTriggerRouter: Router = Router();
const prisma = basePrismaClient as any;

composioTriggerRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as any).rawBody;
    if (!rawBody || typeof rawBody !== "string") {
      return res.status(400).json({
        success: false,
        message: "Missing raw webhook payload",
      });
    }

    const headerValue = (name: string): string =>
      typeof req.headers[name] === "string" ? (req.headers[name] as string) : "";

    const verified = await verifyComposioWebhook(rawBody, {
      "webhook-id": headerValue("webhook-id"),
      "webhook-signature": headerValue("webhook-signature"),
      "webhook-timestamp": headerValue("webhook-timestamp"),
    });

    const payload = verified?.payload || verified?.rawPayload || req.body;
    if (payload?.type !== "composio.trigger.message") {
      return res.status(200).json({
        success: true,
        message: "Ignored non-trigger event",
      });
    }

    const triggerId = payload?.metadata?.trigger_id;
    if (!triggerId || typeof triggerId !== "string") {
      return res.status(200).json({
        success: true,
        message: "Missing trigger_id in composio payload",
      });
    }

    const composioNodes = await prisma.node.findMany({
      where: { type: "COMPOSIO_TRIGGER" },
      select: {
        id: true,
        workflowId: true,
        data: true,
        workflow: {
          select: {
            userId: true,
          },
        },
      },
    });

    const matchedNode = composioNodes.find(
      (node: any) => (node.data as any)?.composioTriggerId === triggerId
    );

    if (!matchedNode) {
      return res.status(200).json({
        success: true,
        message: "No workflow mapped for this composio trigger",
      });
    }

    const userId = matchedNode.workflow?.userId;
    if (!userId) {
      return res.status(200).json({
        success: true,
        message: "Mapped workflow user missing",
      });
    }

    const eventResult = await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId: matchedNode.workflowId,
        userId,
        composioTriggerNodeId: matchedNode.id,
        initialData: {
          composioEvent: payload?.data || {},
          composioMetadata: payload?.metadata || {},
          composioType: payload?.type || "composio.trigger.message",
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Composio event received and workflow triggered",
      workflowId: matchedNode.workflowId,
      nodeId: matchedNode.id,
      executionId: eventResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("Error processing Composio webhook:", error);
    next(error);
  }
});
