import { Router, Request, Response, NextFunction } from 'express';
import { inngest } from '../../inngest';
import { validateGoogleFormTrigger } from '../../services/googleFormService';

export const googleFormRouter: Router = Router();

/**
 * @swagger
 * /api/webhooks/google-form:
 *   post:
 *     summary: Trigger workflow execution via Google Form submission (public endpoint)
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
 *               formId:
 *                 type: string
 *                 description: Google Form ID
 *               formTitle:
 *                 type: string
 *                 description: Google Form title
 *               responseId:
 *                 type: string
 *                 description: Form response ID
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Response timestamp
 *               respondentEmail:
 *                 type: string
 *                 format: email
 *                 description: Respondent's email address
 *               responses:
 *                 type: object
 *                 description: Form responses keyed by question title
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Google Form submission received and workflow triggered
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
 *         description: Workflow or Google Form trigger node not found
 */
googleFormRouter.post('/google-form', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { workflowId } = req.query;
        const googleFormPayload = req.body;

        if (!workflowId || typeof workflowId !== 'string') {
            return res.status(400).json({ error: 'workflowId query parameter is required' });
        }

        // Validate workflow and find Google Form trigger node
        const { workflow, googleFormNode } = await validateGoogleFormTrigger(workflowId);

        // Send event to Inngest to trigger workflow execution with Google Form data
        await inngest.send({
            name: "workflow/trigger",
            data: {
                workflowId,
                userId: workflow.userId,
                data: {
                    googleFormPayload,
                    googleFormNodeId: googleFormNode.id,
                },
            },
        });

        res.status(200).json({
            success: true,
            message: 'Google Form submission received and workflow triggered',
            workflowId,
        });
    } catch (error: any) {
        if (error.statusCode === 404 || error.message?.includes('not found')) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        next(error);
    }
});

