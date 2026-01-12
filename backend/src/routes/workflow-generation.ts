import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import { generateAutonomousWorkflow } from "../services/workflowGenerationService";
import { testCodeBlock, testWorkflowSegment } from "../services/codeTestingService";
import { prisma as prismaClient } from "../lib/prisma";
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/lib/node-types";

export const workflowGenerationRouter: Router = Router();

// Apply Better Auth middleware to all routes
workflowGenerationRouter.use(betterAuthMiddleware);

/**
 * POST /workflow-generation/generate
 * Generate an autonomous workflow from a prompt
 */
workflowGenerationRouter.post(
  "/generate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { prompt, workflowId, model } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new AppError("Prompt is required", 400);
      }

      const { editMode, existingNodes: providedNodes } = req.body as {
        editMode?: boolean;
        existingNodes?: Array<{ type: string; data: Record<string, unknown> }>;
      };

      // Get existing workflow nodes if workflowId is provided or editMode is true
      let existingNodes: Array<{ type: string; data: Record<string, unknown> }> = [];

      // Use provided nodes from request if in edit mode, otherwise fetch from workflow
      if (editMode && providedNodes) {
        existingNodes = providedNodes;
      } else if (workflowId) {
        const workflow = await prismaClient.workflow.findFirst({
          where: { id: workflowId, userId: user.id },
          include: { nodes: true },
        });

        if (!workflow) {
          throw new AppError("Workflow not found", 404);
        }

        existingNodes = workflow.nodes.map((node: { type: string; data: unknown }) => ({
          type: node.type,
          data: node.data as Record<string, unknown>,
        }));
      }

      // Create workflow generation record
      const generation = await prismaClient.workflowGeneration.create({
        data: {
          userId: user.id,
          workflowId: workflowId || null,
          prompt: prompt.trim(),
          status: "generating",
          generatedWorkflow: {},
        },
      });

      // Generate workflow (this might take time)
      try {
        const result = await generateAutonomousWorkflow({
          prompt: prompt.trim(),
          userId: user.id,
          workflowId: workflowId || undefined,
          existingNodes,
          model: (model as string) || "claude-sonnet-4-5-20250929",
        });

        // Update generation record with results
        await prismaClient.workflowGeneration.update({
          where: { id: generation.id },
          data: {
            status: "completed",
            generatedWorkflow: {
              nodes: result.nodes,
              connections: result.connections,
            } as any,
            customCodeBlocks: (result.customCodeBlocks || null) as any,
          },
        });

        res.json({
          id: generation.id,
          nodes: result.nodes,
          connections: result.connections,
          status: "completed",
          setupInstructions: result.setupInstructions,
        });
      } catch (error) {
        // Update generation record with error
        await prismaClient.workflowGeneration.update({
          where: { id: generation.id },
          data: {
            status: "failed",
            generatedWorkflow: {
              error: error instanceof Error ? error.message : String(error),
            } as any,
          },
        });

        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /workflow-generation/:id/test
 * Test CODE_BLOCK nodes in the generated workflow
 */
workflowGenerationRouter.post(
  "/:id/test",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const generation = await prismaClient.workflowGeneration.findFirst({
        where: { id, userId: user.id },
      });

      if (!generation) {
        throw new AppError("Workflow generation not found", 404);
      }

      const generatedWorkflow = generation.generatedWorkflow as {
        nodes: Array<{ type: string; data: Record<string, unknown> }>;
        connections: unknown[];
      };

      if (!generatedWorkflow || !generatedWorkflow.nodes) {
        throw new AppError("No generated workflow found", 400);
      }

      // Find CODE_BLOCK nodes
      const codeBlockNodes = generatedWorkflow.nodes.filter(
        (node) => node.type === NodeType.CODE_BLOCK
      );

      if (codeBlockNodes.length === 0) {
        return res.json({
          status: "completed",
          message: "No CODE_BLOCK nodes to test",
          testResults: [],
        });
      }

      // Update status to testing
      await prismaClient.workflowGeneration.update({
        where: { id },
        data: { status: "testing" },
      });

      const testResults: Array<{
        nodeId: string;
        passed: boolean;
        error?: string;
      }> = [];

      // Test each CODE_BLOCK node
      for (const node of codeBlockNodes) {
        const code = node.data.code as string;
        const dependencies = node.data.dependencies as string[] | undefined;

        if (!code) {
          testResults.push({
            nodeId: (node.data.id as string) || "unknown",
            passed: false,
            error: "No code found in node",
          });
          continue;
        }

        try {
          // Create simple test case with empty context
          const testResult = await testWorkflowSegment(code, {}, dependencies);

          testResults.push({
            nodeId: (node.data.id as string) || "unknown",
            passed: testResult.passed,
            error: testResult.error,
          });
        } catch (error) {
          testResults.push({
            nodeId: (node.data.id as string) || "unknown",
            passed: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Update generation with test results
      await prismaClient.workflowGeneration.update({
        where: { id },
        data: {
          status: "completed",
          testResults: { results: testResults },
        },
      });

      res.json({
        status: "completed",
        testResults,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /workflow-generation/:id
 * Get workflow generation status and results
 */
workflowGenerationRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const generation = await prismaClient.workflowGeneration.findFirst({
      where: { id, userId: user.id },
    });

    if (!generation) {
      throw new AppError("Workflow generation not found", 404);
    }

    const generatedWorkflow = generation.generatedWorkflow as {
      nodes?: Array<{
        id?: string;
        type: string;
        data: Record<string, unknown>;
        position: { x: number; y: number };
      }>;
      connections?: Array<{
        id?: string;
        source: string;
        target: string;
        fromOutput?: string;
        toInput?: string;
      }>;
    } | null;

    // Regenerate setup instructions if workflow is completed (they're not stored in DB)
    let setupInstructions = undefined;
    if (generation.status === "completed" && generatedWorkflow?.nodes) {
      const { generateSetupInstructions } = await import("../services/setupInstructionsService");
      setupInstructions = await generateSetupInstructions(
        (generatedWorkflow.nodes || []).map((n) => ({
          id: n.id || "",
          type: n.type,
          data: n.data || {},
        })),
        user.id
      );
    }

    res.json({
      id: generation.id,
      status: generation.status,
      nodes: generatedWorkflow?.nodes || [],
      connections: generatedWorkflow?.connections || [],
      setupInstructions:
        setupInstructions && setupInstructions.length > 0 ? setupInstructions : undefined,
      generatedWorkflow: generation.generatedWorkflow,
      customCodeBlocks: generation.customCodeBlocks,
      testResults: generation.testResults,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflow-generation/:id/approve
 * Approve workflow and return nodes/connections ready to add to workflow
 */
workflowGenerationRouter.post(
  "/:id/approve",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const generation = await prismaClient.workflowGeneration.findFirst({
        where: { id, userId: user.id },
      });

      if (!generation) {
        throw new AppError("Workflow generation not found", 404);
      }

      if (generation.status !== "completed") {
        throw new AppError(
          `Workflow generation is not completed. Current status: ${generation.status}`,
          400
        );
      }

      const generatedWorkflow = generation.generatedWorkflow as {
        nodes: Array<{
          id?: string;
          type: string;
          data: Record<string, unknown>;
          position: { x: number; y: number };
        }>;
        connections: Array<{
          id?: string;
          source: string;
          target: string;
          fromOutput?: string;
          toInput?: string;
        }>;
      };

      if (!generatedWorkflow || !generatedWorkflow.nodes) {
        throw new AppError("No generated workflow found", 400);
      }

      // Return nodes and connections ready to be added to workflow
      res.json({
        nodes: generatedWorkflow.nodes.map((node) => ({
          id: node.id || createId(),
          type: node.type,
          data: node.data,
          position: node.position,
        })),
        connections: generatedWorkflow.connections.map((conn, index) => ({
          id: conn.id || `conn-${index}`,
          source: conn.source,
          target: conn.target,
          fromOutput: conn.fromOutput || "main",
          toInput: conn.toInput || "main",
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);
