import { Router, Request, Response, NextFunction } from "express";
import { inngest } from "../../inngest";
import { basePrismaClient } from "../../lib/prisma";

export const webhookTriggerRouter: Router = Router();

const prisma = basePrismaClient as any;

/**
 * @swagger
 * /api/webhooks/webhook/{workflowId}/{nodeId}:
 *   post:
 *     summary: Trigger workflow execution via webhook (public endpoint)
 *     tags: [Triggers]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook node ID
 *       - in: header
 *         name: X-Webhook-Secret
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional webhook secret for authentication
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any JSON payload to pass to the workflow
 *     responses:
 *       200:
 *         description: Webhook received and workflow triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 workflowId:
 *                   type: string
 *                 executionId:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized (invalid secret)
 *       404:
 *         description: Workflow or webhook node not found
 *       500:
 *         description: Internal server error
 */
webhookTriggerRouter.post(
  "/:workflowId/:nodeId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, nodeId } = req.params;

      if (!workflowId) {
        return res.status(400).json({
          success: false,
          message: "workflowId is required",
        });
      }

      if (!nodeId) {
        return res.status(400).json({
          success: false,
          message: "nodeId is required",
        });
      }

      // Find the workflow and webhook node
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          nodes: {
            where: {
              id: nodeId,
              type: "WEBHOOK",
            },
          },
        },
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: "Workflow not found",
        });
      }

      const webhookNode = workflow.nodes.find((node: any) => node.id === nodeId);

      if (!webhookNode) {
        return res.status(404).json({
          success: false,
          message: "Webhook node not found in workflow",
        });
      }

      // Validate webhook secret if configured
      const nodeData = (webhookNode.data as any) || {};
      const configuredSecret = nodeData.secret;

      if (configuredSecret) {
        // Check for secret in X-Webhook-Secret header or Authorization Bearer token
        const providedSecret =
          req.headers["x-webhook-secret"] ||
          (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null);

        if (!providedSecret || providedSecret !== configuredSecret) {
          return res.status(401).json({
            success: false,
            message: "Invalid or missing webhook secret",
          });
        }
      }

      // Extract payload and headers
      const webhookPayload = req.body || {};
      const webhookHeaders: Record<string, string> = {};

      // Copy relevant headers (exclude internal headers)
      const excludeHeaders = [
        "host",
        "connection",
        "content-length",
        "x-webhook-secret",
        "authorization",
      ];
      for (const [key, value] of Object.entries(req.headers)) {
        if (!excludeHeaders.includes(key.toLowerCase()) && typeof value === "string") {
          webhookHeaders[key] = value;
        }
      }

      // Get user ID from workflow
      const userId = workflow.userId;

      // Trigger the workflow with webhook payload
      const eventResult = await inngest.send({
        name: "workflow/trigger",
        data: {
          workflowId,
          userId,
          webhookNodeId: nodeId,
          initialData: {
            webhookPayload,
            webhookHeaders,
          },
        },
      });

      // Return success response
      return res.status(200).json({
        success: true,
        message: "Webhook received and workflow triggered",
        workflowId,
        nodeId,
        executionId: eventResult.ids?.[0] || null,
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/webhooks/webhook/{workflowId}/{nodeId}:
 *   get:
 *     summary: Test webhook endpoint (returns webhook info)
 *     tags: [Triggers]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook node ID
 *     responses:
 *       200:
 *         description: Webhook endpoint info
 *       404:
 *         description: Workflow or webhook node not found
 */
webhookTriggerRouter.get(
  "/:workflowId/:nodeId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, nodeId } = req.params;

      // Find the workflow and webhook node
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          nodes: {
            where: {
              id: nodeId,
              type: "WEBHOOK",
            },
          },
        },
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: "Workflow not found",
        });
      }

      const webhookNode = workflow.nodes.find((node: any) => node.id === nodeId);

      if (!webhookNode) {
        return res.status(404).json({
          success: false,
          message: "Webhook node not found in workflow",
        });
      }

      const nodeData = (webhookNode.data as any) || {};
      const hasSecret = !!nodeData.secret;

      return res.status(200).json({
        success: true,
        message: "Webhook endpoint is active",
        workflowId,
        nodeId,
        workflowName: workflow.name,
        requiresSecret: hasSecret,
        usage: {
          method: "POST",
          contentType: "application/json",
          headers: hasSecret
            ? {
                "X-Webhook-Secret": "your-configured-secret",
              }
            : {},
          body: "Any JSON payload",
        },
      });
    } catch (error) {
      console.error("Error checking webhook:", error);
      next(error);
    }
  }
);
