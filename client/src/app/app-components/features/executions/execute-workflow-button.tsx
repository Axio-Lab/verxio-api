import { Button } from "@/components/ui/button";
import { FlaskConicalIcon, Loader2 } from "lucide-react";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { useResetWorkflowOutputs } from "@/app/app-components/features/editor/workflow-outputs-store";
import {
  useSetMultipleNodeStatuses,
  useResetAllNodeStatuses,
} from "@/app/app-components/features/editor/execution-status-store";
import type { NodeStatus } from "@/components/node-status-indicator";
import { toast } from "sonner";
import { useRef, useCallback, useState } from "react";
import { useNodes } from "@xyflow/react";

export const ExecuteWorkflowButton = ({ workflowId }: { workflowId: string }) => {
  const triggerWorkflow = useTriggerWorkflow();
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const resetWorkflowOutputs = useResetWorkflowOutputs();
  const setMultipleNodeStatuses: (nodeIds: string[], status: NodeStatus) => void =
    useSetMultipleNodeStatuses();
  const resetAllNodeStatuses: () => void = useResetAllNodeStatuses();
  const nodes = useNodes();
  const lastClickTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 1000; // 1 second debounce

  // Track if workflow is executing (extends beyond API call completion)
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecuteWorkflow = useCallback(async () => {
    // Check for unsaved changes before executing
    if (hasUnsavedChanges) {
      toast.error("Please save your workflow before executing");
      return;
    }

    // Debounce: prevent multiple rapid clicks
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    if (timeSinceLastClick < DEBOUNCE_MS) {
      toast.info("Please wait a moment before executing again");
      return;
    }
    lastClickTimeRef.current = now;

    // Prevent execution if already pending or executing
    if (triggerWorkflow.isPending || isExecuting) {
      return;
    }

    try {
      // Set executing state immediately
      setIsExecuting(true);

      // Reset workflow outputs from previous execution
      resetWorkflowOutputs();

      // Trigger the workflow
      await triggerWorkflow.mutateAsync({
        id: workflowId,
      });

      // After the API call completes, set all nodes to loading
      // This aligns the status change with the end of the spinner
      resetAllNodeStatuses();
      const allNodeIds = nodes.map((node) => node.id);
      if (allNodeIds.length > 0) {
        setMultipleNodeStatuses(allNodeIds, "loading");
      }

      setIsExecuting(false);
    } catch (error) {
      // Error is handled by the hook's onError callback
      console.error("Failed to trigger workflow:", error);
      setIsExecuting(false);
      // Reset node statuses on error
      resetAllNodeStatuses();
    }
  }, [
    workflowId,
    hasUnsavedChanges,
    triggerWorkflow,
    isExecuting,
    resetWorkflowOutputs,
    nodes,
    setMultipleNodeStatuses,
    resetAllNodeStatuses,
  ]);

  // No extra timeout cleanup needed (spinner ends on API completion)

  const isButtonLoading = triggerWorkflow.isPending || isExecuting;

  return (
    <Button
      onClick={handleExecuteWorkflow}
      size="lg"
      disabled={isButtonLoading || hasUnsavedChanges}
      title={hasUnsavedChanges ? "Please save your workflow before executing" : "Execute workflow"}
    >
      {isButtonLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Executing...
        </>
      ) : (
        <>
          <FlaskConicalIcon className="size-4" />
          Execute Workflow
        </>
      )}
    </Button>
  );
};
