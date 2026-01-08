import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import * as workflowService from "../services/workflowService";
import {
  createAirtableWebhook,
  refreshAirtableWebhook,
  listAirtableWebhooks,
  listAirtableBases,
  listAirtableTables,
  deleteAirtableWebhook,
} from "../services/airtableService";

export const airtableWebhookRouter: Router = Router();

// Apply Better Auth middleware to all routes
airtableWebhookRouter.use(betterAuthMiddleware);

/**
 * @swagger
 * /workflow/airtable-webhook/bases:
 *   get:
 *     summary: List Airtable bases
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: query
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Airtable credential ID
 *     responses:
 *       200:
 *         description: List of Airtable bases
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.get("/bases", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId is required", 400);
    }

    const result = await listAirtableBases(credentialId, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/airtable-webhook/tables:
 *   get:
 *     summary: List tables in an Airtable base
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: query
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: baseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tables
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.get("/tables", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId, baseId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId is required", 400);
    }
    if (!baseId || typeof baseId !== "string") {
      throw new AppError("baseId is required", 400);
    }

    const result = await listAirtableTables(credentialId, user.id, baseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/airtable-webhook/create:
 *   post:
 *     summary: Create an Airtable webhook
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credentialId
 *               - baseId
 *               - workflowId
 *               - nodeId
 *             properties:
 *               credentialId:
 *                 type: string
 *               baseId:
 *                 type: string
 *               workflowId:
 *                 type: string
 *               nodeId:
 *                 type: string
 *               tableId:
 *                 type: string
 *                 description: Optional table ID to filter webhook events
 *     responses:
 *       200:
 *         description: Webhook created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.post("/create", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId, baseId, workflowId, nodeId, tableId } = req.body;

    if (!credentialId || !baseId || !workflowId || !nodeId) {
      throw new AppError("credentialId, baseId, workflowId, and nodeId are required", 400);
    }

    // Verify workflow belongs to user
    const workflow = await workflowService.getWorkflowById(workflowId);
    if (workflow.userId !== user.id) {
      throw new AppError("Workflow not found", 404);
    }

    // Verify node exists in workflow
    const node = workflow.nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      const availableNodeIds = workflow.nodes.map((n: any) => `${n.id} (${n.type})`).join(", ");
      throw new AppError(
        `Node with id ${nodeId} not found in workflow. ` +
          `Available nodes: ${availableNodeIds || "none"}. ` +
          `Please save your workflow first if you just added this node.`,
        404
      );
    }
    if (node.type !== "AIRTABLE_TRIGGER") {
      throw new AppError(
        `Node type mismatch. Expected AIRTABLE_TRIGGER, got ${node.type || "undefined"}. ` +
          `Please ensure you're configuring the correct node.`,
        400
      );
    }

    // Generate webhook URL
    const baseUrl = process.env.API_URL;
    const notificationUrl = `${baseUrl}/api/webhooks/airtable?workflowId=${workflowId}`;

    // Create webhook
    const webhook = await createAirtableWebhook(
      credentialId,
      user.id,
      baseId,
      notificationUrl,
      tableId
    );

    // Update node data with webhook info
    const updatedNodeData = {
      ...(node.data || {}),
      credentialId,
      webhookId: webhook.id,
      macSecretBase64: webhook.macSecretBase64,
      expirationTime: webhook.expirationTime,
      baseId,
      tableId: tableId || null,
    };

    // Update workflow with new node data
    const updatedNodes = workflow.nodes.map((n: any) =>
      n.id === nodeId ? { ...n, data: updatedNodeData } : n
    );

    await workflowService.updateWorkflowData(workflowId, user.id, {
      nodes: updatedNodes,
      connections: workflow.connections || [],
    });

    res.json({
      success: true,
      webhook: {
        id: webhook.id,
        expirationTime: webhook.expirationTime,
        macSecretBase64: webhook.macSecretBase64,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/airtable-webhook/refresh:
 *   post:
 *     summary: Refresh an Airtable webhook
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credentialId
 *               - baseId
 *               - webhookId
 *               - workflowId
 *               - nodeId
 *             properties:
 *               credentialId:
 *                 type: string
 *               baseId:
 *                 type: string
 *               webhookId:
 *                 type: string
 *               workflowId:
 *                 type: string
 *               nodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook refreshed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId, baseId, webhookId, workflowId, nodeId } = req.body;

    if (!credentialId || !baseId || !webhookId || !workflowId || !nodeId) {
      throw new AppError("All fields are required", 400);
    }

    // Verify workflow belongs to user
    const workflow = await workflowService.getWorkflowById(workflowId);
    if (workflow.userId !== user.id) {
      throw new AppError("Workflow not found", 404);
    }

    // Refresh webhook
    const webhook = await refreshAirtableWebhook(credentialId, user.id, baseId, webhookId);

    // Update node data with new expiration time
    const node = workflow.nodes.find((n: any) => n.id === nodeId);
    if (node) {
      const updatedNodeData = {
        ...(node.data || {}),
        expirationTime: webhook.expirationTime,
      };

      const updatedNodes = workflow.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: updatedNodeData } : n
      );

      await workflowService.updateWorkflowData(workflowId, user.id, {
        nodes: updatedNodes,
        connections: workflow.connections || [],
      });
    }

    res.json({
      success: true,
      webhook: {
        id: webhook.id,
        expirationTime: webhook.expirationTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/airtable-webhook/list:
 *   get:
 *     summary: List webhooks for an Airtable base
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: query
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: baseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of webhooks
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.get("/list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId, baseId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId is required", 400);
    }
    if (!baseId || typeof baseId !== "string") {
      throw new AppError("baseId is required", 400);
    }

    const result = await listAirtableWebhooks(credentialId, user.id, baseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/airtable-webhook/delete:
 *   delete:
 *     summary: Delete an Airtable webhook
 *     tags: [Airtable Webhooks]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credentialId
 *               - baseId
 *               - webhookId
 *               - workflowId
 *               - nodeId
 *             properties:
 *               credentialId:
 *                 type: string
 *               baseId:
 *                 type: string
 *               webhookId:
 *                 type: string
 *               workflowId:
 *                 type: string
 *               nodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
airtableWebhookRouter.delete("/delete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId, baseId, webhookId, workflowId, nodeId } = req.body;

    if (!credentialId || !baseId || !webhookId || !workflowId || !nodeId) {
      throw new AppError("All fields are required", 400);
    }

    // Verify workflow belongs to user
    const workflow = await workflowService.getWorkflowById(workflowId);
    if (workflow.userId !== user.id) {
      throw new AppError("Workflow not found", 404);
    }

    // Delete webhook
    await deleteAirtableWebhook(credentialId, user.id, baseId, webhookId);

    // Clear webhook data from node
    const node = workflow.nodes.find((n: any) => n.id === nodeId);
    if (node) {
      const updatedNodeData = {
        ...(node.data || {}),
        webhookId: undefined,
        macSecretBase64: undefined,
        expirationTime: undefined,
      };

      const updatedNodes = workflow.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: updatedNodeData } : n
      );

      await workflowService.updateWorkflowData(workflowId, user.id, {
        nodes: updatedNodes,
        connections: workflow.connections || [],
      });
    }

    res.json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});
