import { Button } from "@/components/ui/button";
import { FlaskConicalIcon, Loader2 } from "lucide-react";
import { useTriggerWorkflow } from "@/hooks/useWorkflows";

export const ExecuteWorkflowButton = ({ workflowId }: {
    workflowId: string
}) => {
    const triggerWorkflow = useTriggerWorkflow();

    const handleExecuteWorkflow = async () => {
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
            disabled={triggerWorkflow.isPending}
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

