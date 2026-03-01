"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useEffect, useState, useCallback } from "react";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedDelete,
  authenticatedPut,
} from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PlusIcon, TrashIcon, CopyIcon, MessageSquare, Loader2 } from "lucide-react";
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

interface WidgetAgent {
  id: string;
  name: string;
  greeting: string;
  personality: string | null;
  brandColor: string;
  position: string;
  allowedDomains: string[];
  status: string;
  conversations: number;
  createdAt: string;
  knowledgeBaseId?: string | null;
}

interface KnowledgeBaseOption {
  id: string;
  name: string;
}

function WidgetsContent() {
  const [agents, setAgents] = useState<WidgetAgent[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    greeting: "Hi! How can I help you?",
    personality: "",
    brandColor: "#6366f1",
    position: "bottom-right",
    allowedDomains: "",
    knowledgeBaseId: "",
  });

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const data = await authenticatedGet<{ knowledgeBases: { id: string; name: string }[] }>(
        "/api/knowledge-base"
      );
      setKnowledgeBases(data.knowledgeBases || []);
    } catch {
      // Non-blocking; widget form works without KB list
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await authenticatedGet<{ agents: WidgetAgent[] }>("/api/widget");
      setAgents(data.agents);
    } catch (err) {
      toast.error("Failed to load widget agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      await authenticatedPost("/api/widget", {
        name: form.name,
        greeting: form.greeting,
        personality: form.personality || undefined,
        brandColor: form.brandColor,
        position: form.position,
        allowedDomains: form.allowedDomains
          ? form.allowedDomains.split(",").map((d) => d.trim())
          : [],
        knowledgeBaseId: form.knowledgeBaseId || undefined,
      });
      toast.success("Widget agent created");
      setDialogOpen(false);
      setForm({
        name: "",
        greeting: "Hi! How can I help you?",
        personality: "",
        brandColor: "#6366f1",
        position: "bottom-right",
        allowedDomains: "",
        knowledgeBaseId: "",
      });
      fetchAgents();
    } catch (err) {
      toast.error("Failed to create widget agent");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await authenticatedDelete(`/api/widget/${id}`);
      toast.success("Widget agent deleted");
      fetchAgents();
    } catch {
      toast.error("Failed to delete widget agent");
    }
  };

  const copyEmbedCode = (id: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const code = `<script src="${backendUrl}/api/widget/${id}/embed.js" async></script>`;
    navigator.clipboard.writeText(code);
    toast.success("Embed code copied to clipboard");
  };

  const toggleStatus = async (agent: WidgetAgent) => {
    try {
      await authenticatedPut(`/api/widget/${agent.id}`, {
        status: agent.status === "active" ? "inactive" : "active",
      });
      toast.success(`Widget ${agent.status === "active" ? "deactivated" : "activated"}`);
      fetchAgents();
    } catch {
      toast.error("Failed to update widget status");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-[60vh]">
        <LoadingView entity="widgets" message="Loading widgets..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Chat Widgets</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Embed AI chat agents on any website with a single script tag.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" /> New Widget
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Create Widget Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-2 -mr-2 min-h-0">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Support Bot"
                />
              </div>
              <div>
                <Label>Greeting Message</Label>
                <Input
                  value={form.greeting}
                  onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                />
              </div>
              <div>
                <Label>Personality (optional)</Label>
                <Textarea
                  value={form.personality}
                  onChange={(e) => setForm({ ...form, personality: e.target.value })}
                  placeholder="You are a friendly customer support agent..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Knowledge Base (optional)</Label>
                <Select
                  value={form.knowledgeBaseId || "none"}
                  onValueChange={(value) =>
                    setForm({ ...form, knowledgeBaseId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="No knowledge base" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">No knowledge base</SelectItem>
                    {knowledgeBases.map((kb) => (
                      <SelectItem key={kb.id} value={kb.id}>
                        {kb.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Link a knowledge base so the widget can answer from your documents.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Brand Color</Label>
                  <Input
                    type="color"
                    value={form.brandColor}
                    onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                    className="h-10 w-full"
                  />
                </div>
                <div>
                  <Label>Position</Label>
                  <Select
                    value={form.position}
                    onValueChange={(value) => setForm({ ...form, position: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Allowed Domains (comma separated, empty = all)</Label>
                <Input
                  value={form.allowedDomains}
                  onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })}
                  placeholder="example.com, mysite.org"
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full shrink-0">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Widget
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No widgets yet</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              Create your first AI chat widget and embed it on any website.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: agent.brandColor }}
                    />
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg break-words">
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {agent.greeting}
                      </CardDescription>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full cursor-pointer shrink-0 w-fit ${agent.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                    onClick={() => toggleStatus(agent)}
                  >
                    {agent.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{agent.conversations}</span> conversations
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyEmbedCode(agent.id)}>
                    <CopyIcon className="mr-1 h-3 w-3" /> Embed Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(agent.id)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WidgetsPage() {
  return (
    <ErrorBoundary FallbackComponent={() => <ErrorView message="Error loading widgets" />}>
      <Suspense
        fallback={
          <div className="flex flex-1 flex-col min-h-[60vh]">
            <LoadingView entity="widgets" message="Loading widgets..." />
          </div>
        }
      >
        <WidgetsContent />
      </Suspense>
    </ErrorBoundary>
  );
}
