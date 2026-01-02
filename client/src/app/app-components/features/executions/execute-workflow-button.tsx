import { Button } from "@/components/ui/button";
import { FlaskConicalIcon, Loader2 } from "lucide-react";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { toast } from "sonner";
import { useRef, useCallback, useState, useEffect } from "react";

export const ExecuteWorkflowButton = ({ workflowId }: {
    workflowId: string
}) => {
    const triggerWorkflow = useTriggerWorkflow();
    const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
    const lastClickTimeRef = useRef<number>(0);
    const DEBOUNCE_MS = 1000; // 2 seconds debounce
    
    // Track if workflow is executing (extends beyond API call completion)
    const [isExecuting, setIsExecuting] = useState(false);
    const executionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            
            // Clear any existing timeout
            if (executionTimeoutRef.current) {
                clearTimeout(executionTimeoutRef.current);
            }

            // Trigger the workflow
            await triggerWorkflow.mutateAsync({
                id: workflowId,
            });

            // Keep button in "executing" state for at least 3 seconds
            // This gives time for Inngest to start processing and node status to update
            // The actual execution may take longer, but node status indicators will show progress
            executionTimeoutRef.current = setTimeout(() => {
                setIsExecuting(false);
            }, 1000);
        } catch (error) {
            // Error is handled by the hook's onError callback
            console.error("Failed to trigger workflow:", error);
            setIsExecuting(false);
        }
    }, [workflowId, hasUnsavedChanges, triggerWorkflow, isExecuting]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (executionTimeoutRef.current) {
                clearTimeout(executionTimeoutRef.current);
            }
        };
    }, []);

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

