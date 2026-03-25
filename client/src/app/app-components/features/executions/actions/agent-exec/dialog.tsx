"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAvailableSubagents } from "@/hooks/useCustomSubagents";
import { Paperclip, X, Bot, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type AgentExecFormValues = {
  variables: string;
  objective: string;
  strategy: "auto" | "parallel" | "sequential";
  maxTurns: number;
  selectedSubagents: string[];
  attachments?: Array<{ fileName: string; fileType: string }>;
};

interface AgentExecDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AgentExecFormValues) => void;
  defaultValues?: any;
  onRefreshCanvas?: () => Promise<void>;
}

const ALLOWED_MIME = [
  "image/",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function AgentExecDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  onRefreshCanvas,
}: AgentExecDialogProps) {
  const router = useRouter();
  const { data: availableData } = useAvailableSubagents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builtins = availableData?.builtinSubagents || [];
  const customs = availableData?.customSubagents || [];
  const allAgents = [
    ...builtins.map((b) => ({ slug: b.slug, name: b.name, isBuiltin: true })),
    ...customs.map((c) => ({ slug: c.slug, name: c.name, isBuiltin: false })),
  ];

  const [variables, setVariables] = useState(defaultValues?.variables || "agentExec");
  const [objective, setObjective] = useState(defaultValues?.objective || "");
  const [strategy, setStrategy] = useState(defaultValues?.strategy || "auto");
  const [maxTurns, setMaxTurns] = useState(defaultValues?.maxTurns || 10);
  const [selectedSubagents, setSelectedSubagents] = useState<string[]>(
    defaultValues?.selectedSubagents || []
  );
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (open && defaultValues) {
      setVariables(defaultValues.variables || "agentExec");
      setObjective(defaultValues.objective || "");
      setStrategy(defaultValues.strategy || "auto");
      setMaxTurns(defaultValues.maxTurns || 10);
      setSelectedSubagents(defaultValues.selectedSubagents || []);
    }
  }, [open, defaultValues]);

  const toggleAgent = (slug: string) => {
    setSelectedSubagents((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10MB limit`);
        return false;
      }
      return ALLOWED_MIME.some((m) => f.type.startsWith(m));
    });
    setFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!objective.trim()) {
      toast.error("Objective is required");
      return;
    }

    const attachments = files.map((f) => ({
      fileName: f.name,
      fileType: f.type,
    }));

    onSubmit({
      variables,
      objective: objective.trim(),
      strategy,
      maxTurns,
      selectedSubagents,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={async (nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          try {
            if (onRefreshCanvas) {
              await onRefreshCanvas();
            } else {
              router.refresh();
            }
          } catch {
            // ignore refresh errors
          }
        }
      }}
    >
      <DialogContent className="max-w-[560px] w-[calc(100%-2rem)] sm:w-full sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Agent Execute</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1">
          <div className="space-y-1.5">
            <Label>Variable Name</Label>
            <Input
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="agentExec"
            />
            <p className="text-xs text-muted-foreground">
            Use this name to reference the result in other nodes: <code>{`{{${variables || "agentExec"}.result}}`}</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Objective *</Label>
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe what the agents should accomplish..."
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Strategy</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                  <SelectItem value="sequential">Sequential</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Turns</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxTurns}
                onChange={(e) => setMaxTurns(Math.max(1, parseInt(e.target.value) || 10))}
              />
            </div>
          </div>

          {allAgents.length > 0 && (
            <div className="space-y-2">
              <Label>
                Agents{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (none selected = use all)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {allAgents.map((agent) => {
                  const isSelected = selectedSubagents.includes(agent.slug);
                  return (
                    <button
                      key={agent.slug}
                      type="button"
                      onClick={() => toggleAgent(agent.slug)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {agent.isBuiltin ? (
                        <Cpu className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                      {agent.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Attachments</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach Files
            </Button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    <span className="max-w-[120px] truncate text-xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!objective.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
