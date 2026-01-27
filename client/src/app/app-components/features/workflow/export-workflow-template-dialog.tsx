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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import {
  useExportWorkflowAsTemplate,
  useGenerateTemplateMetadata,
  type ExportTemplateInput,
} from "@/hooks/useWorkflowTemplates";

const PRICING_FREE = "Free";

/** Available template categories – must match backend agent (generateTemplateMetadataForWorkflow) */
export const TEMPLATE_CATEGORIES = [
  "Automation",
  "Marketing",
  "DevOps",
  "Data & Analytics",
  "Integrations",
  "Notifications",
  "Developer Tools",
  "Other",
] as const;

interface ExportWorkflowTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflowName: string;
  creatorUsername: string;
  onSuccess?: () => void;
}

export function ExportWorkflowTemplateDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  creatorUsername,
  onSuccess,
}: ExportWorkflowTemplateDialogProps) {
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [howItWorks, setHowItWorks] = useState("");
  const [requirements, setRequirements] = useState("");
  const [category, setCategory] = useState("");

  const exportMutation = useExportWorkflowAsTemplate();
  const generateMetadata = useGenerateTemplateMetadata();

  useEffect(() => {
    if (open) {
      setName("");
      setShortDescription("");
      setHowItWorks("");
      setRequirements("");
      setCategory("");
    }
  }, [open]);

  const handleGenerateWithAI = async () => {
    try {
      const data = await generateMetadata.mutateAsync(workflowId);
      if (data.name) setName(data.name);
      if (data.shortDescription) setShortDescription(data.shortDescription);
      if (data.howItWorks) setHowItWorks(data.howItWorks);
      if (data.requirements) setRequirements(data.requirements);
      if (
        data.category &&
        TEMPLATE_CATEGORIES.includes(data.category as (typeof TEMPLATE_CATEGORIES)[number])
      ) {
        setCategory(data.category);
      }
    } catch {
      // Error toast handled in hook
    }
  };

  const handleExport = async () => {
    if (!name.trim() || !shortDescription.trim() || !howItWorks.trim() || !category.trim()) {
      return;
    }
    const payload: ExportTemplateInput = {
      workflowId,
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      howItWorks: howItWorks.trim(),
      requirements: requirements.trim() || undefined,
      pricing: PRICING_FREE,
      category: category.trim(),
      creatorUsername,
    };
    try {
      await exportMutation.mutateAsync(payload);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error toast handled in hook
    }
  };

  const canSubmit =
    name.trim() &&
    shortDescription.trim() &&
    howItWorks.trim() &&
    category.trim() &&
    creatorUsername.trim();
  const isPending = exportMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Export workflow as template</DialogTitle>
          <DialogDescription>
            Share this workflow as a reusable template. Be descriptive and use keywords so others
            can find it in the public templates library.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 space-y-4 py-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateWithAI}
              disabled={generateMetadata.isPending}
            >
              {generateMetadata.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span className="ml-2">Generate with AI</span>
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              placeholder="Be descriptive and use keywords in the title (e.g. Send Slack alert when Stripe payment succeeds)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-short-description">Short description</Label>
            <Textarea
              id="template-short-description"
              placeholder="One or two sentences summarizing what the workflow does"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-how-it-works">How it works (with specificity)</Label>
            <Textarea
              id="template-how-it-works"
              placeholder="Step-by-step explanation. Include required API keys or credentials if any."
              value={howItWorks}
              onChange={(e) => setHowItWorks(e.target.value)}
              rows={4}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-requirements">Requirements (if any)</Label>
            <Textarea
              id="template-requirements"
              placeholder={
                'List any required API keys, credentials, or external setup (e.g. Stripe webhook secret, Slack bot token). Use "None" if nothing is required.'
              }
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-pricing">Pricing</Label>
            <Input
              id="template-pricing"
              value={PRICING_FREE}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isPending}>
              <SelectTrigger id="template-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-creator">Creator username</Label>
            <Input
              id="template-creator"
              value={creatorUsername}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canSubmit || isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
