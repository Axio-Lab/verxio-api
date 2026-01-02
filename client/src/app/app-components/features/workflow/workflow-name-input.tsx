"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface WorkflowNameInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isPending?: boolean;
  initialName?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
}

export function WorkflowNameInput({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  initialName = "",
  title = "Create New Workflow",
  description = "Enter a name for your new workflow. You can edit this later.",
  submitLabel = "Create",
}: WorkflowNameInputProps) {
  const [workflowName, setWorkflowName] = useState(initialName);

  // Reset name when dialog opens/closes or initialName changes
  useEffect(() => {
    if (open) {
      setWorkflowName(initialName);
    }
  }, [open, initialName]);

  const handleSubmit = () => {
    if (!workflowName.trim()) {
      return;
    }
    onSubmit(workflowName.trim());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isPending) {
      setWorkflowName(initialName);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="workflow-name">Workflow Name</Label>
            <Input
              id="workflow-name"
              placeholder="e.g., Email Marketing Campaign"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && workflowName.trim()) {
                  handleSubmit();
                }
              }}
              disabled={isPending}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!workflowName.trim() || isPending}
          >
            {isPending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

