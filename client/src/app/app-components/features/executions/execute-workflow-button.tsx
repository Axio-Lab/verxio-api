import { Button } from "@/components/ui/button";
import { FlaskConicalIcon, Loader2 } from "lucide-react";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { toast } from "sonner";

export const ExecuteWorkflowButton = ({ workflowId }: {
    workflowId: string
}) => {
    const triggerWorkflow = useTriggerWorkflow();
    const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

    const handleExecuteWorkflow = async () => {
        // Check for unsaved changes before executing
        if (hasUnsavedChanges) {
            toast.error("Please save your workflow before executing");
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
    };

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

