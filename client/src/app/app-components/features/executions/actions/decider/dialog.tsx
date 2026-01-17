"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export type DeciderFormValues = {
  condition: string;
  variablesName: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DeciderFormValues) => void;
  defaultValues?: Partial<DeciderFormValues>;
}

export const DeciderDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [condition, setCondition] = useState<string>(defaultValues.condition || "");
  const [variablesName, setVariablesName] = useState<string>(
    defaultValues.variablesName || "decider"
  );

  useEffect(() => {
    if (open) {
      setCondition(defaultValues.condition || "");
      setVariablesName(defaultValues.variablesName || "decider");
    }
  }, [open, defaultValues]);

  const handleSave = async () => {
    try {
      await Promise.resolve(onSubmit({ condition, variablesName }));
      onOpenChange(false);
      toast.success("Decider configured");
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Decider Node</DialogTitle>
          <DialogDescription>
            Evaluate a condition and route workflow execution. If true, the "True" output executes.
            If false, the "False" output executes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
            <div className="space-y-2">
              <Label htmlFor="variables-name">Output Variable Name</Label>
              <Input
                id="variables-name"
                value={variablesName}
                onChange={(e) => setVariablesName(e.target.value)}
                placeholder="decider"
              />
              <p className="text-xs text-muted-foreground">
                The name of the variable that will store the decider result in the workflow context.
                <br />
                Access it in subsequent nodes as:{" "}
                <code className="bg-muted px-1 rounded">{`{{${variablesName}.result}}`}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condition (Handlebars)</Label>
              <Textarea
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="(gt httpResponse.status 200)"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Use Handlebars helpers to evaluate conditions. The condition must evaluate to true
                or false.
                <br />
                <br />
                <strong>Available Helpers:</strong>
                <br />• <code className="bg-muted px-1 rounded">(gt a b)</code> - greater than
                <br />• <code className="bg-muted px-1 rounded">(gte a b)</code> - greater than or
                equal
                <br />• <code className="bg-muted px-1 rounded">(lt a b)</code> - less than
                <br />• <code className="bg-muted px-1 rounded">(lte a b)</code> - less than or
                equal
                <br />• <code className="bg-muted px-1 rounded">(eq a b)</code> - equals
                <br />• <code className="bg-muted px-1 rounded">(ne a b)</code> - not equals
                <br />• <code className="bg-muted px-1 rounded">(and a b)</code> - logical AND
                <br />• <code className="bg-muted px-1 rounded">(or a b)</code> - logical OR
                <br />• <code className="bg-muted px-1 rounded">(not a)</code> - logical NOT
                <br />
                <br />
                <strong>Examples:</strong>
                <br />• <code className="bg-muted px-1 rounded">(gt httpResponse.status 200)</code>
                <br />• <code className="bg-muted px-1 rounded">(eq status "success")</code>
                <br />•{" "}
                <code className="bg-muted px-1 rounded">(and (gt count 10) (lt count 100))</code>
                <br />•{" "}
                <code className="bg-muted px-1 rounded">
                  (or (eq type "error") (eq type "failed"))
                </code>
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
            <Button onClick={handleSave}>Save Configuration</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
