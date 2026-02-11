/**
 * Single-node execution: run one workflow node and wait for its output.
 * Used by the planning agent to execute a node (e.g. calendar, VEO) and return the result
 * so it can be summarized and sent to the user.
 */

import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_WAIT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RunSingleNodeResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * Run a single workflow node and wait for its output.
 * Creates a PublicChatRun, triggers workflow/trigger with singleNodeId, polls until COMPLETED/FAILED.
 *
 * @param workflowId - Workflow that contains the node
 * @param userId - Owner of the workflow
 * @param nodeId - Node to execute
 * @param nodeOverrides - Optional runtime overrides for node data (e.g. timeMin/timeMax for calendar)
 */
export async function runSingleNodeAndWait(
  workflowId: string,
  userId: string,
  nodeId: string,
  nodeOverrides?: Record<string, unknown>
): Promise<RunSingleNodeResult> {
  const run = await (prisma as any).publicChatRun.create({
    data: {
      workflowId,
      status: "PENDING",
      input: { singleNodeId: nodeId } as object,
    },
  });

  const eventData: Record<string, unknown> = {
    workflowId,
    userId,
    publicChatRunId: run.id,
    singleNodeId: nodeId,
  };

  if (nodeOverrides && Object.keys(nodeOverrides).length > 0) {
    eventData.data = {
      nodeOverrides: { [nodeId]: nodeOverrides },
    };
  }

  await inngest.send({
    name: "workflow/trigger",
    data: eventData as any,
  });

  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const updated = await (prisma as any).publicChatRun.findUnique({
      where: { id: run.id },
    });
    if (!updated) break;
    if (updated.status === "COMPLETED") {
      return {
        success: true,
        output: (updated.output as Record<string, unknown>) || {},
      };
    }
    if (updated.status === "FAILED") {
      return {
        success: false,
        error: updated.error || "Node execution failed",
      };
    }
  }

  return {
    success: false,
    error: "Execution did not complete in time",
  };
}
