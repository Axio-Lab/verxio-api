"use client";

import { useCallback, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { useSetNodeExecutionStatus } from "@/app/app-components/features/editor/execution-status-store";
import { toast } from "sonner";

interface UseExecuteNodeOptions {
  nodeId: string;
  workflowId?: string;
  nodeData?: Record<string, unknown> | null;
}

interface UseExecuteNodeReturn {
  executeNode: () => Promise<void>;
  isExecuting: boolean;
  canExecute: boolean;
}

/**
 * Hook to execute a single node in the workflow.
 * Uses the workflow trigger endpoint with a nodeId parameter
 * to execute only the specified node.
 *
 * Sets node status to "loading" after the API call completes to align
 * status changes with the end of the loading spinner.
 */
export function useExecuteNode({
  nodeId,
  workflowId: workflowIdOverride,
  nodeData,
}: UseExecuteNodeOptions): UseExecuteNodeReturn {
  const params = useParams();
  const routeWorkflowId =
    (params?.workflowId as string | undefined) ||
    (params?.workflow as string | undefined) ||
    (params?.id as string | undefined);
  const workflowId = workflowIdOverride || routeWorkflowId;
  const triggerWorkflow = useTriggerWorkflow();
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const setNodeStatus = useSetNodeExecutionStatus();

  // Track if node is executing (extends beyond API call completion)
  const [isExecuting, setIsExecuting] = useState(false);
  const lastExecuteTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 1000; // 1 second debounce
  const MAX_OVERRIDE_BYTES = 2_500_000; // Keep below Inngest 3MB limit

  const getSerializableNodeData = (data: Record<string, unknown> | null | undefined) => {
    if (!data) return undefined;
    try {
      return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };

  const executeNode = useCallback(async () => {
    if (!workflowId) {
      toast.error("No workflow ID found");
      return;
    }

    const overrideData = getSerializableNodeData(nodeData);
    const shouldSendOverrides = hasUnsavedChanges;

    // If we can't serialize the node data and there are unsaved changes, block execution
    if (hasUnsavedChanges && !overrideData) {
      toast.error("Please save your workflow before executing");
      return;
    }

    if (hasUnsavedChanges && overrideData) {
      try {
        const payloadSize = new TextEncoder().encode(JSON.stringify(overrideData)).length;
        if (payloadSize > MAX_OVERRIDE_BYTES) {
          toast.error("Payload too large. Save the workflow before executing.");
          return;
        }
      } catch {
        toast.error("Please save your workflow before executing");
        return;
      }
    }

    // Debounce: prevent multiple rapid clicks
    const now = Date.now();
    const timeSinceLastExecute = now - lastExecuteTimeRef.current;
    if (timeSinceLastExecute < DEBOUNCE_MS) {
      toast.info("Please wait a moment before executing again");
      return;
    }
    lastExecuteTimeRef.current = now;

    // Prevent execution if already executing
    if (triggerWorkflow.isPending || isExecuting) {
      return;
    }

    try {
      // Set executing state immediately
      setIsExecuting(true);

      // Trigger the single node execution (include latest node data if available)
      await triggerWorkflow.mutateAsync({
        id: workflowId,
        data:
          shouldSendOverrides && overrideData
            ? {
                nodeOverrides: {
                  [nodeId]: overrideData,
                },
              }
            : undefined,
        nodeId,
      });

      // After the API call completes, set node to loading
      // This aligns the status change with the end of the spinner
      setNodeStatus(nodeId, "loading");

      setIsExecuting(false);
    } catch (error) {
      console.error("Failed to execute node:", error);
      setIsExecuting(false);
      // Reset node status on error
      setNodeStatus(nodeId, "error");
    }
  }, [
    workflowId,
    nodeId,
    nodeData,
    hasUnsavedChanges,
    triggerWorkflow,
    isExecuting,
    setNodeStatus,
  ]);

  const canExecute = Boolean(workflowId);

  return {
    executeNode,
    isExecuting: triggerWorkflow.isPending || isExecuting,
    canExecute,
  };
}
