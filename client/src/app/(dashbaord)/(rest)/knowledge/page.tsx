"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  PlusIcon,
  TrashIcon,
  FileTextIcon,
  Brain,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { LoadingView, ErrorView } from "@/app/app-components/features/editor/entity-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KnowledgeDocument {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  sourceType: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  documents: KnowledgeDocument[];
  createdAt: string;
}

function KnowledgeContent() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [kbDialogOpen, setKbDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [kbForm, setKbForm] = useState({ name: "", description: "" });
  const [docForm, setDocForm] = useState({ title: "", content: "", sourceType: "text" });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await authenticatedGet<{ knowledgeBases: KnowledgeBase[] }>(
        "/api/knowledge-base"
      );
      setKnowledgeBases(data.knowledgeBases);
    } catch {
      toast.error("Failed to load knowledge bases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createKB = async () => {
    if (!kbForm.name.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      await authenticatedPost("/api/knowledge-base", kbForm);
      toast.success("Knowledge base created");
      setKbDialogOpen(false);
      setKbForm({ name: "", description: "" });
      fetchData();
    } catch {
      toast.error("Failed to create knowledge base");
    } finally {
      setCreating(false);
    }
  };

  const deleteKB = async (id: string) => {
    try {
      await authenticatedDelete(`/api/knowledge-base/${id}`);
      toast.success("Knowledge base deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete knowledge base");
    }
  };

  const addDocument = async () => {
    if (!docForm.title.trim() || !docForm.content.trim())
      return toast.error("Title and content are required");
    if (!selectedKbId) return;
    setCreating(true);
    try {
      await authenticatedPost(`/api/knowledge-base/${selectedKbId}/documents`, docForm);
      toast.success("Document added - processing will begin shortly");
      setDocDialogOpen(false);
      setDocForm({ title: "", content: "", sourceType: "text" });
      fetchData();
    } catch {
      toast.error("Failed to add document");
    } finally {
      setCreating(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      await authenticatedDelete(`/api/knowledge-base/documents/${docId}`);
      toast.success("Document deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-[60vh]">
        <LoadingView entity="knowledge bases" message="Loading knowledge bases..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Upload documents for AI-powered search and retrieval.
          </p>
        </div>
        <Dialog open={kbDialogOpen} onOpenChange={setKbDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" /> New Knowledge Base
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-1 -mr-1">
              <div>
                <Label>Name</Label>
                <Input
                  value={kbForm.name}
                  onChange={(e) => setKbForm({ ...kbForm, name: e.target.value })}
                  placeholder="Product Docs"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={kbForm.description}
                  onChange={(e) => setKbForm({ ...kbForm, description: e.target.value })}
                />
              </div>
              <Button onClick={createKB} disabled={creating} className="w-full">
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {knowledgeBases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No knowledge bases yet</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              Create a knowledge base and add documents so your AI agents can answer domain-specific
              questions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {knowledgeBases.map((kb) => (
            <Card key={kb.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg break-words">{kb.name}</CardTitle>
                    {kb.description && (
                      <CardDescription className="mt-1 break-words">
                        {kb.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedKbId(kb.id);
                        setDocDialogOpen(true);
                      }}
                    >
                      <PlusIcon className="mr-1 h-3 w-3" /> Add Document
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteKB(kb.id)}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {kb.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No documents yet. Add text, URLs, or files to build your knowledge base.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {kb.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <FileTextIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium break-words">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.chunkCount} chunks &middot; {doc.sourceType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusIcon(doc.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            <TrashIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-2 -mr-2 min-h-0">
            <div>
              <Label>Title</Label>
              <Input
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                placeholder="Getting Started Guide"
              />
            </div>
            <div>
              <Label>Source Type</Label>
              <Select
                value={docForm.sourceType}
                onValueChange={(value) => setDocForm({ ...docForm, sourceType: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="file">File Content</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={docForm.content}
                onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                placeholder="Paste your document content here..."
                rows={6}
                className="min-h-[120px]"
              />
            </div>
            <Button onClick={addDocument} disabled={creating} className="w-full shrink-0">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <ErrorBoundary FallbackComponent={() => <ErrorView message="Error loading knowledge bases" />}>
      <Suspense
        fallback={
          <div className="flex flex-1 flex-col min-h-[60vh]">
            <LoadingView entity="knowledge bases" message="Loading knowledge bases..." />
          </div>
        }
      >
        <KnowledgeContent />
      </Suspense>
    </ErrorBoundary>
  );
}
