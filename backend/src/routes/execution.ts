import { Router, Request, Response, NextFunction } from "express";
import * as executionService from "../services/executionService";
import * as workflowService from "../services/workflowService";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";

export const executionRouter: Router = Router();
executionRouter.use(betterAuthMiddleware);

/**
 * @swagger
 * /execution:
 *   get:
 *     summary: Get all executions for the authenticated user
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of executions per page
 *     responses:
 *       200:
 *         description: List of executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       workflowId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [RUNNING, SUCCESS, FAILED]
 *                       error:
 *                         type: string
 *                         nullable: true
 *                       errorStack:
 *                         type: string
 *                         nullable: true
 *                       startedAt:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       ingestEventId:
 *                         type: string
 *                       output:
 *                         type: object
 *                         nullable: true
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
 *       500:
 *         description: Internal server error
 */
executionRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await executionService.getExecutionsByUserId(user.id, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /execution/workflow/{workflowId}:
 *   get:
 *     summary: Get executions for a workflow
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workflow ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of executions per page
 *     responses:
 *       200:
 *         description: List of executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       workflowId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [RUNNING, SUCCESS, FAILED]
 *                       error:
 *                         type: string
 *                         nullable: true
 *                       errorStack:
 *                         type: string
 *                         nullable: true
 *                       startedAt:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       ingestEventId:
 *                         type: string
 *                       output:
 *                         type: object
 *                         nullable: true
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
 *       404:
 *         description: Workflow not found
 *       500:
 *         description: Internal server error
 */
executionRouter.get(
  "/workflow/:workflowId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify workflow belongs to user
      try {
        await workflowService.getWorkflow(workflowId, user.id);
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) {
          return res.status(404).json({ error: "Workflow not found" });
        }
        throw error;
      }

      const result = await executionService.getExecutionsByWorkflowId(workflowId, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /execution/{id}:
 *   get:
 *     summary: Get a single execution by ID
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The execution ID
 *     responses:
 *       200:
 *         description: Execution details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 workflowId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [RUNNING, SUCCESS, FAILED]
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 errorStack:
 *                   type: string
 *                   nullable: true
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 completedAt:
 *                   type: string
 *                   format: date-time
 *                 ingestEventId:
 *                   type: string
 *                 output:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Execution not found
 *       500:
 *         description: Internal server error
 */
executionRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const execution = await executionService.getExecution(id);
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }

    // Verify execution belongs to user's workflow
    try {
      await workflowService.getWorkflow(execution.workflowId, user.id);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return res.status(404).json({ error: "Execution not found" });
      }
      throw error;
    }

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /execution/create:
 *   post:
 *     summary: Create a new execution record
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - ingestEventId
 *             properties:
 *               workflowId:
 *                 type: string
 *                 description: The workflow ID
 *               ingestEventId:
 *                 type: string
 *                 description: The Inngest event ID
 *               status:
 *                 type: string
 *                 enum: [RUNNING, SUCCESS, FAILED]
 *                 default: RUNNING
 *                 description: Execution status
 *     responses:
 *       201:
 *         description: Execution created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 workflowId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [RUNNING, SUCCESS, FAILED]
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 errorStack:
 *                   type: string
 *                   nullable: true
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 completedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 ingestEventId:
 *                   type: string
 *                 output:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
executionRouter.post("/create", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { workflowId, ingestEventId, status } = req.body;

    if (!workflowId || !ingestEventId) {
      return res.status(400).json({ error: "workflowId and ingestEventId are required" });
    }

    // Verify workflow belongs to user
    try {
      await workflowService.getWorkflow(workflowId, user.id);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      throw error;
    }

    const execution = await executionService.createExecution({
      workflowId,
      ingestEventId,
      status,
    });

    res.status(201).json(execution);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /execution/update/{id}:
 *   put:
 *     summary: Update an execution record
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The execution ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [RUNNING, SUCCESS, FAILED]
 *                 description: Execution status
 *               error:
 *                 type: string
 *                 description: Error message (if failed)
 *               errorStack:
 *                 type: string
 *                 description: Error stack trace (if failed)
 *               output:
 *                 type: object
 *                 description: Execution output (if successful)
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Completion timestamp
 *     responses:
 *       200:
 *         description: Execution updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 workflowId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [RUNNING, SUCCESS, FAILED]
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 errorStack:
 *                   type: string
 *                   nullable: true
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 completedAt:
 *                   type: string
 *                   format: date-time
 *                 ingestEventId:
 *                   type: string
 *                 output:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Execution not found
 *       500:
 *         description: Internal server error
 */
executionRouter.put("/update/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const updateData = req.body;

    const execution = await executionService.getExecution(id);
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }

    // Verify execution belongs to user's workflow
    try {
      await workflowService.getWorkflow(execution.workflowId, user.id);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return res.status(404).json({ error: "Execution not found" });
      }
      throw error;
    }

    const updatedExecution = await executionService.updateExecution(id, updateData);
    res.json(updatedExecution);
  } catch (error) {
    next(error);
  }
});
