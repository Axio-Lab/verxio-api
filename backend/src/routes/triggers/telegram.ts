import { Router, Request, Response, NextFunction } from "express";
import { inngest } from "../../inngest";

export const telegramRouter: Router = Router();

/**
 * @swagger
 * /api/webhooks/telegram:
 *   post:
 *     summary: Trigger workflow execution via Telegram webhook (public endpoint)
 *     tags: [Triggers]
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Telegram webhook update payload
 *             properties:
 *               update_id:
 *                 type: integer
 *               message:
 *                 type: object
 *                 properties:
 *                   message_id:
 *                     type: integer
 *                   from:
 *                     type: object
 *                   chat:
 *                     type: object
 *                   date:
 *                     type: integer
 *                   text:
 *                     type: string
 *     responses:
 *       200:
 *         description: Telegram webhook received and workflow triggered
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
 *       400:
 *         description: Bad request (missing workflowId)
 *       500:
 *         description: Internal server error
 */
telegramRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.query;

    if (!workflowId || typeof workflowId !== "string") {
      return res.status(400).json({
        success: false,
        message: "workflowId query parameter is required",
      });
    }

    // Extract Telegram update payload
    const telegramUpdate = req.body;

    // Validate that this is a Telegram update
    if (!telegramUpdate || typeof telegramUpdate !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid Telegram webhook payload",
      });
    }

    // Find the Telegram trigger node in the workflow
    // We'll need to fetch the workflow to find the node
    const { basePrismaClient } = await import("../../lib/prisma");
    const prisma = basePrismaClient as any;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId as string },
      include: {
        nodes: {
          where: {
            type: "TELEGRAM_TRIGGER",
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

    const telegramTriggerNode = workflow.nodes.find(
      (node: any) => node.type === "TELEGRAM_TRIGGER"
    );

    if (!telegramTriggerNode) {
      return res.status(400).json({
        success: false,
        message: "Workflow does not contain a Telegram trigger node",
      });
    }

    // Get user ID from workflow
    const userId = workflow.userId;

    // Trigger the workflow with Telegram payload
    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId: workflowId as string,
        userId,
        telegramNodeId: telegramTriggerNode.id,
        initialData: {
          telegramPayload: telegramUpdate,
        },
      },
    });

    // Return 200 OK to Telegram (Telegram expects 200 OK response)
    return res.status(200).json({
      success: true,
      message: "Telegram webhook received and workflow triggered",
      workflowId: workflowId as string,
    });
  } catch (error) {
    console.error("Error processing Telegram webhook:", error);
    next(error);
  }
});
