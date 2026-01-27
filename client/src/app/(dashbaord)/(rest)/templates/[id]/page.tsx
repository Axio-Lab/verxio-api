"use client";

import { useParams, useRouter } from "next/navigation";
import { useWorkflowTemplate, useImportWorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: template, isLoading, error } = useWorkflowTemplate(id);
  const importMutation = useImportWorkflowTemplate();

  const handleImport = async () => {
    if (!id) return;
    try {
      const result = await importMutation.mutateAsync(id);
      router.push(`/workflows/${result.workflowId}`);
    } catch {
      // Toast handled in hook (including "Upgrade to premium" for premium-node templates)
    }
  };

  if (isLoading || !template) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to templates
        </Link>
        <p className="text-destructive">Template not found or failed to load.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to templates
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{template.pricing ?? "Free"}</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Download className="size-4" />
            {template.downloadCount ?? 0} downloads
          </span>
          {template.category && <Badge variant="outline">{template.category}</Badge>}
          <span className="text-sm text-muted-foreground">by {template.creatorUsername}</span>
        </div>
      </div>

      {template.shortDescription && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1">Description</h2>
          <p className="text-foreground">{template.shortDescription}</p>
        </div>
      )}

      {template.howItWorks && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1">How it works</h2>
          <p className="text-foreground whitespace-pre-wrap">{template.howItWorks}</p>
        </div>
      )}

      {(template.requirements ?? "").trim() && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1">Requirements</h2>
          <p className="text-foreground whitespace-pre-wrap">{template.requirements}</p>
        </div>
      )}

      <div className="pt-4">
        <Button onClick={handleImport} disabled={importMutation.isPending}>
          {importMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Importing...
            </>
          ) : (
            <>
              <Download className="size-4 mr-2" />
              Import workflow
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
