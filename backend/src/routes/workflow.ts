import { Router, Request, Response, NextFunction } from 'express';
import * as workflowService from '../services/workflowService';
import { betterAuthMiddleware } from '../middleware/betterAuth';
import { AppError } from '../middleware/errorHandler';
import { inngest } from '../inngest';
import { workflowTriggerRateLimiter } from '../middleware/rateLimiter';
import { getNodeStatusSubscriptionTokens } from '../inngest/utils/realtime';
import { channelNameMap } from '../inngest/channels';

export const workflowRouter: Router = Router();

// Apply Better Auth middleware to all workflow routes
workflowRouter.use(betterAuthMiddleware);

/**
 * @swagger
 * /workflow:
 *   get:
 *     summary: Get workflows with pagination and search
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for workflow name
 *     responses:
 *       200:
 *         description: List of workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflows:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
workflowRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const result = await workflowService.getWorkflows(user.id, page, limit, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/create:
 *   post:
 *     summary: Create a new workflow
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Email Marketing Campaign"
 *     responses:
 *       201:
 *         description: Workflow created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
workflowRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { name } = req.body;

    const result = await workflowService.createWorkflow({
      name,
      userId: user.id,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/subscription-token:
 *   get:
 *     summary: Get Inngest realtime subscription token for node status updates
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     responses:
 *       200:
 *         description: Subscription token generated successfully
 *       401:
 *         description: Unauthorized
 */
// Note: Generic webhook endpoint has been moved to /api/webhooks/webhook/:workflowId/:webhookNodeId
// This provides a cleaner, more descriptive structure for all trigger endpoints

// IMPORTANT: This route must come BEFORE /:id route to avoid route conflicts
workflowRouter.get('/subscription-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await getNodeStatusSubscriptionTokens();
    // Return tokens with channel name mapping for client-side filtering
    res.status(200).json({ 
      success: true, 
      tokens,
      channelNames: channelNameMap
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/{id}:
 *   get:
 *     summary: Get a single workflow by ID
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     responses:
 *       200:
 *         description: Workflow details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = await workflowService.getWorkflow(id, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/update/name/{id}:
 *   put:
 *     summary: Update workflow name only
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Workflow Name"
 *     responses:
 *       200:
 *         description: Workflow name updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.put('/update/name/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      throw new AppError('Workflow name is required', 400);
    }

    const result = await workflowService.updateWorkflowName(id, user.id, { name });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/update/{id}:
 *   put:
 *     summary: Update workflow with nodes and connections
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *                 example: "Updated Workflow Name"
 *                 description: Workflow name (optional)
 *               nodes:
 *                 type: array
 *                 description: Array of nodes (will replace all existing nodes)
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [INITIAL, MANUAL_TRIGGER, HTTP_REQUEST, WEBHOOK]
 *                     position:
 *                       type: object
 *                       properties:
 *                         x:
 *                           type: number
 *                         y:
 *                           type: number
 *                     data:
 *                       type: object
 *                 example:
 *                   - name: "Initial Node"
 *                     type: "INITIAL"
 *                     position: { x: 0, y: 0 }
 *                   - name: "HTTP Request"
 *                     type: "HTTP_REQUEST"
 *                     position: { x: 200, y: 0 }
 *               connections:
 *                 type: array
 *                 description: Array of connections (will replace all existing connections)
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     source:
 *                       type: string
 *                       description: Source node ID
 *                     target:
 *                       type: string
 *                       description: Target node ID
 *                     sourceHandle:
 *                       type: string
 *                       default: "main"
 *                       description: Output port name on source node
 *                     targetHandle:
 *                       type: string
 *                       default: "main"
 *                       description: Input port name on target node
 *                 example:
 *                   - source: "node-1"
 *                     target: "node-2"
 *                     sourceHandle: "main"
 *                     targetHandle: "main"
 *     responses:
 *       200:
 *         description: Workflow updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.put('/update/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, nodes, connections } = req.body;

    const result = await workflowService.updateWorkflowData(id, user.id, {
      name,
      nodes: nodes || [],
      connections: connections || [],
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/delete/{id}:
 *   delete:
 *     summary: Delete a workflow
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     responses:
 *       200:
 *         description: Workflow deleted successfully
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.delete('/delete/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    await workflowService.deleteWorkflow(id, user.id);
    res.status(200).json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflow/trigger/{id}:
 *   post:
 *     summary: Trigger a workflow execution via Inngest
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Optional data to pass to the workflow execution
 *                 example:
 *                   payload: "example data"
 *     responses:
 *       200:
 *         description: Workflow trigger event sent successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /workflow/trigger/{id}:
 *   post:
 *     summary: Trigger workflow execution
 *     tags: [Workflows]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Optional initial data to pass to workflow
 *     responses:
 *       200:
 *         description: Workflow trigger event sent successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.post('/trigger/:id', workflowTriggerRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { data } = req.body;

    // Verify workflow exists and belongs to user, and get workflow name
    const workflow = await workflowService.getWorkflow(id, user.id);

    // Send event to Inngest to trigger workflow execution
    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId: id,
        userId: user.id,
        data: data || {},
      },
    });

    res.status(200).json({ 
      success: true, 
      message: 'Workflow trigger event sent successfully',
      workflowId: id,
      workflowName: workflow.name,
    });
  } catch (error) {
    next(error);
  }
});

