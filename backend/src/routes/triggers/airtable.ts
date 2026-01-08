import { Router, Request, Response, NextFunction } from "express";
import { inngest } from "../../inngest";
import { validateAirtableTrigger, prepareAirtablePayload } from "../../services/airtableService";

export const airtableRouter: Router = Router();

/**
 * @swagger
 * /api/webhooks/airtable:
 *   post:
 *     summary: Trigger workflow execution via Airtable form submission webhook (public endpoint)
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
 *             properties:
 *               base:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *               webhook:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *               eventTimestamp:
 *                 type: string
 *                 format: date-time
 *               eventType:
 *                 type: string
 *                 enum: [create, update, delete]
 *               payload:
 *                 type: object
 *                 properties:
 *                   createdRecordsById:
 *                     type: object
 *                   changedRecordsById:
 *                     type: object
 *                   destroyedRecordIds:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Airtable webhook received and workflow triggered
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
 *       404:
 *         description: Workflow or Airtable trigger node not found
 */
airtableRouter.post("/airtable", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.query;
    const airtablePayload = req.body;

    if (!workflowId || typeof workflowId !== "string") {
      return res.status(400).json({ error: "workflowId query parameter is required" });
    }

    // Validate workflow and find Airtable trigger node
    const { workflow, airtableNode } = await validateAirtableTrigger(workflowId);

    // Prepare payload for workflow execution
    const preparedPayload = prepareAirtablePayload(airtablePayload);

    // Send event to Inngest to trigger workflow execution with Airtable data
    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId,
        userId: workflow.userId,
        data: {
          airtablePayload: preparedPayload,
          airtableNodeId: airtableNode.id,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Airtable webhook received and workflow triggered",
      workflowId,
    });
  } catch (error: any) {
    if (error.statusCode === 404 || error.message?.includes("not found")) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    next(error);
  }
});
