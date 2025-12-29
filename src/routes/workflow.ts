import { Router, Request, Response, NextFunction } from 'express';
import * as workflowService from '../services/workflowService';
import { betterAuthMiddleware } from '../middleware/betterAuth';

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
 * /workflow/update/{id}:
 *   put:
 *     summary: Update a workflow
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
 *         description: Workflow updated successfully
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
workflowRouter.put('/update/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name } = req.body;

    const result = await workflowService.updateWorkflow(id, user.id, { name });
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

