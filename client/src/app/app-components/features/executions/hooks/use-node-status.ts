"use client";

import {
  useNodeExecutionStatus,
  useNodeOutput,
} from "@/app/app-components/features/editor/execution-status-store";

interface useNodeStatusOptions {
  nodeId: string;
}

/**
 * Returns execution status and output for a single node.
 * Status and output are updated by the centralized subscription (useCentralizedNodeStatusSubscriptions)
 * which runs once at the editor level. This hook only reads from the shared store.
 */
export function useNodeStatus({ nodeId }: useNodeStatusOptions) {
  const status = useNodeExecutionStatus(nodeId);
  const output = useNodeOutput(nodeId);

  return { status, output };
}
