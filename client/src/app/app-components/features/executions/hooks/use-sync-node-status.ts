"use client";

import { useEffect } from "react";
import { useSetNodeExecutionStatus } from "@/app/app-components/features/editor/execution-status-store";
import type { NodeStatus } from "@/components/node-status-indicator";

/**
 * Hook to sync a node's execution status to the shared store
 * This allows edges to know when connected nodes are loading
 */
export function useSyncNodeStatus(nodeId: string, status: NodeStatus) {
  const setNodeStatus = useSetNodeExecutionStatus();

  useEffect(() => {
    setNodeStatus(nodeId, status);
  }, [nodeId, status, setNodeStatus]);
}
