import { Button } from "@/components/ui/button";
import { FlaskConicalIcon, Loader2 } from "lucide-react";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { toast } from "sonner";
import { useRef, useCallback } from "react";

export const ExecuteWorkflowButton = ({ workflowId }: {
    workflowId: string
}) => {
    const triggerWorkflow = useTriggerWorkflow();
    const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
    const lastClickTimeRef = useRef<number>(0);
    const DEBOUNCE_MS = 2000; // 2 seconds debounce

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

        // Prevent execution if already pending
        if (triggerWorkflow.isPending) {
            return;
        }

        try {
            await triggerWorkflow.mutateAsync({
                id: workflowId,
            });
        } catch (error) {
            // Error is handled by the hook's onError callback
            console.error("Failed to trigger workflow:", error);
        }
    }, [workflowId, hasUnsavedChanges, triggerWorkflow]);

    return (
        <Button 
            onClick={handleExecuteWorkflow} 
            size="lg" 
            disabled={triggerWorkflow.isPending || hasUnsavedChanges}
            title={hasUnsavedChanges ? "Please save your workflow before executing" : "Execute workflow"}
        >
            {triggerWorkflow.isPending ? (
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

