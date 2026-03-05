"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useReactFlow } from "@xyflow/react";

const formSchema = z.object({
  variables: z.string().min(1, "Variable name is required"),
  prompt: z.string().min(1, "User instruction/prompt is required"),
});

type ManualInputFormValues = z.infer<typeof formSchema>;

interface ManualInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  defaultValues?: Record<string, unknown>;
}

export const ManualInputDialog = ({
  open,
  onOpenChange,
  nodeId,
  defaultValues,
}: ManualInputDialogProps) => {
  const { setNodes } = useReactFlow();

  const form = useForm<ManualInputFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: (defaultValues?.variables as string) || "input",
      prompt: (defaultValues?.prompt as string) || "",
    },
  });

  const onSubmit = (values: ManualInputFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          const { label: _removed, ...rest } = node.data as Record<string, unknown>;
          return {
            ...node,
            data: { ...rest, ...values },
          };
        }
        return node;
      })
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Manual Input</DialogTitle>
          <DialogDescription>
            Configure the user instruction/prompt that will be collected during workflow execution.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
            <div>
              <Label htmlFor="variables">Variable Name</Label>
              <Input id="variables" {...form.register("variables")} placeholder="input" />
              <p className="text-xs text-muted-foreground mt-1">
                The variable name to store the user instruction/prompt
              </p>
              {form.formState.errors.variables && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.variables.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="prompt">User Instruction/Prompt</Label>
              <Textarea
                id="prompt"
                {...form.register("prompt")}
                placeholder="Enter the instruction or prompt that users will see..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is the instruction or prompt that will be shown to users when the workflow
                reaches this node.
              </p>
              {form.formState.errors.prompt && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.prompt.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 mt-4">
            {/* <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button> */}
            <Button type="submit">Save Configuration</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
