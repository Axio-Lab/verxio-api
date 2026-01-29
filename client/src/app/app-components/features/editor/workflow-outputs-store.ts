"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";

/**
 * Global store for workflow outputs
 *
 * When nodes execute, they publish their outputs with variable names.
 * This store aggregates all outputs so any node (like OUTPUT) can read from any other node's output.
 *
 * Example: When designPro node completes, it adds { designPro: { imageUrl: "...", ... } }
 * The OUTPUT node can then read {{designPro.imageUrl}} from this store.
 */

type WorkflowOutputs = Record<string, unknown>;

export const workflowOutputsAtom = atom<WorkflowOutputs>({});

// Hook to merge new outputs into the store
export function useSetWorkflowOutputs() {
  const setOutputs = useSetAtom(workflowOutputsAtom);

  return (newOutputs: Record<string, unknown>) => {
    setOutputs((prev) => ({
      ...prev,
      ...newOutputs,
    }));
  };
}

// Hook to get all workflow outputs
export function useWorkflowOutputs() {
  return useAtomValue(workflowOutputsAtom);
}

// Hook to get a specific output by path (e.g., ["designPro", "imageUrl"])
export function useWorkflowOutputByPath(path: string[]): unknown {
  const outputs = useAtomValue(workflowOutputsAtom);

  let current: unknown = outputs;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Hook to reset workflow outputs (call when starting a new execution)
export function useResetWorkflowOutputs() {
  const setOutputs = useSetAtom(workflowOutputsAtom);
  return () => setOutputs({});
}
