"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import type { NodeStatus } from "@/components/node-status-indicator";

// Global store for node execution statuses
// This allows edges to check if connected nodes are loading

type NodeStatusMap = Record<string, NodeStatus>;

export const nodeStatusMapAtom = atom<NodeStatusMap>({});

// Per-node latest output (for display in node components)
export const nodeOutputMapAtom = atom<Record<string, Record<string, unknown> | null>>({});

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

// Hook to set a single node's output (used by centralized subscription)
export function useSetNodeOutput() {
  const setOutputMap = useSetAtom(nodeOutputMapAtom);
  return (nodeId: string, output: Record<string, unknown> | null) => {
    setOutputMap((prev) => ({ ...prev, [nodeId]: output }));
  };
}

// Hook to get a specific node's latest output
export function useNodeOutput(nodeId: string): Record<string, unknown> | null {
  const outputMap = useAtomValue(nodeOutputMapAtom);
  return outputMap[nodeId] ?? null;
}

// Hook to reset all node statuses to initial (before a new execution)
export function useResetAllNodeStatuses() {
  const setStatusMap = useSetAtom(nodeStatusMapAtom);
  const setOutputMap = useSetAtom(nodeOutputMapAtom);

  return () => {
    setStatusMap({});
    setOutputMap({});
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
