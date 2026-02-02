"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import type { NodeStatus } from "@/components/node-status-indicator";

// Global store for node execution statuses
// This allows edges to check if connected nodes are loading

type NodeStatusMap = Record<string, NodeStatus>;

export const nodeStatusMapAtom = atom<NodeStatusMap>({});

// Hook to update a single node's status
export function useSetNodeExecutionStatus() {
  const setStatusMap = useSetAtom(nodeStatusMapAtom);

  return (nodeId: string, status: NodeStatus) => {
    setStatusMap((prev) => {
      if (prev[nodeId] === status) {
        return prev;
      }
      return {
        ...prev,
        [nodeId]: status,
      };
    });
  };
}

// Hook to set multiple nodes to a specific status (for optimistic UI)
export function useSetMultipleNodeStatuses() {
  const setStatusMap = useSetAtom(nodeStatusMapAtom);

  return (nodeIds: string[], status: NodeStatus) => {
    setStatusMap((prev) => {
      const updated = { ...prev };
      for (const nodeId of nodeIds) {
        updated[nodeId] = status;
      }
      return updated;
    });
  };
}

// Hook to reset all node statuses to initial (before a new execution)
export function useResetAllNodeStatuses() {
  const setStatusMap = useSetAtom(nodeStatusMapAtom);

  return () => {
    setStatusMap({});
  };
}

// Hook to get all node statuses (for edges)
export function useNodeExecutionStatuses() {
  return useAtomValue(nodeStatusMapAtom);
}

// Hook to get a specific node's status
export function useNodeExecutionStatus(nodeId: string): NodeStatus {
  const statusMap = useAtomValue(nodeStatusMapAtom);
  return statusMap[nodeId] || "initial";
}

// Hook to check if any of the given nodes are loading
export function useAnyNodeLoading(nodeIds: string[]): boolean {
  const statusMap = useAtomValue(nodeStatusMapAtom);
  return nodeIds.some((id) => statusMap[id] === "loading");
}
