"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState, useMemo, useCallback } from "react";
import { BaseExecutionNode } from "../anthropic/base-execution-node";
import { MarkdownDialog, MarkdownFormValues } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { useWorkflowOutputs } from "@/app/app-components/features/editor/workflow-outputs-store";
import { Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type MarkdownNodeData = {
  variables?: string;
  textSource?: string;
  outputFilename?: string;
  [key: string]: unknown;
};

function parseTemplatePath(template: string): string[] | null {
  if (!template) return null;
  const match = template.match(/\{\{([^}]+)\}\}/);
  if (!match) return null;
  return match[1].trim().split(".");
}

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export const MarkdownNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus } = useNodeStatus({ nodeId: props.id });
  const workflowOutputs = useWorkflowOutputs();
  const nodeData = (data || {}) as MarkdownNodeData;

  const textSource = nodeData.textSource?.trim() ?? "";

  const resolvedText = useMemo(() => {
    if (!textSource || !workflowOutputs) return null;
    const path = parseTemplatePath(textSource);
    if (!path) return null;
    const value = getNestedValue(workflowOutputs, path);
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : String(value);
  }, [workflowOutputs, textSource]);

  const hasContent = resolvedText !== null && resolvedText.length > 0;
  const displayStatus = hasContent ? "success" : nodeStatus;

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: MarkdownFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return { ...node, data: { ...node.data, ...values } };
        }
        return node;
      })
    );
  };

  const baseFilename = nodeData.outputFilename || `markdown-${Date.now()}`;

  const handleDownloadMd = useCallback(() => {
    if (!resolvedText) return;
    const blob = new Blob([resolvedText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseFilename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  }, [resolvedText, baseFilename]);

  const handleDownloadPdf = useCallback(async () => {
    if (!resolvedText) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { marked } = await import("marked");
      const div = document.createElement("div");
      div.style.cssText =
        "position:absolute;left:-9999px;top:0;width:800px;padding:24px;font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#333;";
      div.innerHTML = marked.parse(resolvedText) as string;
      document.body.appendChild(div);
      const pdf = new jsPDF({ format: "a4", unit: "mm" });
      await pdf.html(div, {
        margin: [15, 15, 15, 15],
        windowWidth: 800,
        callback: () => {
          document.body.removeChild(div);
          pdf.save(`${baseFilename}.pdf`);
          toast.success("Downloaded as PDF");
        },
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to export PDF");
    }
  }, [resolvedText, baseFilename]);

  const handleDownloadDocx = useCallback(async () => {
    if (!resolvedText) return;
    try {
      const { convertMarkdownToDocx, downloadDocx } = await import("@mohtasham/md-to-docx");
      const blob = await convertMarkdownToDocx(resolvedText);
      downloadDocx(blob, `${baseFilename}.docx`);
      toast.success("Downloaded as DOCX");
    } catch (err) {
      console.error("DOCX export failed:", err);
      toast.error("Failed to export DOCX");
    }
  }, [resolvedText, baseFilename]);

  const handleCopy = useCallback(async () => {
    if (!resolvedText) return;
    try {
      await navigator.clipboard.writeText(resolvedText);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, [resolvedText]);

  return (
    <>
      <MarkdownDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/output.svg"
        name="Markdown"
        description="Display text as markdown"
        status={displayStatus}
        output={workflowOutputs ?? undefined}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-sky-600 dark:!text-sky-400"
        handleColor="!border-sky-500 !bg-sky-500"
      >
        {hasContent && (
          <div className="mt-2 w-full min-w-[420px] max-w-[680px] rounded-md overflow-hidden bg-neutral-800 border border-neutral-600 min-h-[420px] max-h-[580px] flex flex-col">
            <div
              className="nodrag nopan nowheel p-3 overflow-auto flex-1 min-h-0 prose prose-sm max-w-none cursor-default text-neutral-100 prose-headings:text-neutral-50 prose-p:text-neutral-200 prose-li:text-neutral-200 prose-strong:text-neutral-50 prose-code:text-neutral-200 prose-code:bg-neutral-700 prose-pre:bg-neutral-900 prose-pre:text-neutral-200 prose-blockquote:border-neutral-500 prose-blockquote:text-neutral-300 prose-a:text-sky-300"
              style={{ overflowX: "auto", overflowY: "auto" }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolvedText}</ReactMarkdown>
            </div>
            <div className="nodrag flex items-center justify-end gap-2 p-2 border-t border-neutral-700 flex-shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition-colors"
                title="Copy content"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 rounded px-2 py-1 text-xs font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-0"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  <DropdownMenuItem onClick={handleDownloadMd}>Markdown (.md)</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPdf}>PDF (.pdf)</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadDocx}>Word (.docx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        {!hasContent && (
          <div className="mt-2 p-3 rounded-md border border-dashed border-neutral-600 text-center">
            <span className="text-[10px] text-neutral-500">
              {nodeStatus === "loading" ? "Processing..." : "Waiting for text output"}
            </span>
          </div>
        )}
      </BaseExecutionNode>
    </>
  );
});

MarkdownNode.displayName = "MarkdownNode";
