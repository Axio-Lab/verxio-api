import { Router, Request, Response, NextFunction } from 'express';
import { inngest } from '../../inngest';
import { validateStripeTrigger, validateStripeSignature } from '../../services/stripeService';

export const stripeRouter: Router = Router();

/**
 * @swagger
 * /api/webhooks/stripe:
 *   post:
 *     summary: Trigger workflow execution via Stripe webhook (public endpoint)
 *     tags: [Triggers]
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: header
 *         name: stripe-signature
 *         required: false
 *         schema:
 *           type: string
 *         description: Stripe webhook signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook event payload
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Stripe webhook received and workflow triggered
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
 *         description: Bad request (missing workflowId or invalid signature)
 *       401:
 *         description: Invalid webhook signature
 *       404:
 *         description: Workflow or Stripe trigger node not found
 */
stripeRouter.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { workflowId } = req.query;
        const stripePayload = req.body;
        const stripeSignature = req.headers['stripe-signature'] as string;

        if (!workflowId || typeof workflowId !== 'string') {
            return res.status(400).json({ error: 'workflowId query parameter is required' });
        }

        // Validate workflow and find Stripe trigger node
        const { workflow, stripeNode } = await validateStripeTrigger(workflowId);

        // Optional: Verify webhook secret if configured
        const nodeData = stripeNode.data || {};
        if (nodeData.secret) {
            // Validate Stripe signature if secret is configured
            if (!stripeSignature) {
                return res.status(401).json({ error: 'Stripe signature header is required when secret is configured' });
            }

            const isValid = validateStripeSignature(
                JSON.stringify(stripePayload),
                stripeSignature,
                nodeData.secret as string
            );

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid Stripe webhook signature' });
            }
        }

        // Send event to Inngest to trigger workflow execution with Stripe data
        await inngest.send({
            name: "workflow/trigger",
            data: {
                workflowId,
                userId: workflow.userId,
                data: {
                    stripePayload,
                    stripeNodeId: stripeNode.id,
                },
            },
        });

        res.status(200).json({
            success: true,
            message: 'Stripe webhook received and workflow triggered',
            workflowId,
        });
    } catch (error: any) {
        if (error.statusCode === 404 || error.message?.includes('not found')) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        next(error);
    }
});

