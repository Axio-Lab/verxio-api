"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SupportContainer,
  SupportLoadingView,
  SupportErrorView,
  SupportEmptyView,
} from "@/app/app-components/features/support/support";
import { EntityPagination } from "@/app/app-components/features/editor/entity-component";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Code2, Link as LinkIcon, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authenticatedGet } from "@/lib/api-client";
import {
  SupportAgent,
  useCreateSupportAgent,
  useDeleteSupportAgent,
  useSupportAgents,
  useUpdateSupportAgent,
} from "@/hooks/useSupportAgents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KnowledgeBaseSummary = {
  id: string;
  name: string;
};

const supportAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  fallbackEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  greeting: z.string().optional(),
  brandColor: z.string().optional(),
  position: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
});

type SupportAgentFormValues = z.infer<typeof supportAgentSchema>;

export function SupportContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useSupportAgents();
  const createMutation = useCreateSupportAgent();
  const updateMutation = useUpdateSupportAgent();
  const deleteMutation = useDeleteSupportAgent();

  const form = useForm<SupportAgentFormValues>({
    resolver: zodResolver(supportAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      fallbackEmail: "",
      greeting: "",
      brandColor: "#6366f1",
      position: "bottom-right",
      knowledgeBaseIds: [],
    },
  });

  const [editing, setEditing] = useState<SupportAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const selectedKnowledgeBaseIds = form.watch("knowledgeBaseIds") || [];

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const data = await authenticatedGet<{ knowledgeBases: { id: string; name: string }[] }>(
          "/api/knowledge-base"
        );
        setKnowledgeBases(
          (data.knowledgeBases || []).map((kb) => ({
            id: kb.id,
            name: kb.name,
          }))
        );
      } catch {
        // silent; support agents can still be created without KBs
      }
    };
    fetchKnowledgeBases();
  }, []);

  const agents = data?.agents ?? [];

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.fallbackEmail || "").toLowerCase().includes(q)
      );
    });
  }, [agents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / limit));
  const pagedAgents = filteredAgents.slice((page - 1) * limit, page * limit);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const openCreateDialog = () => {
    setEditing(null);
    form.reset({
      name: "",
      description: "",
      fallbackEmail: "",
      greeting: "",
      brandColor: "#6366f1",
      position: "bottom-right",
      knowledgeBaseIds: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (agent: SupportAgent) => {
    setEditing(agent);
    form.reset({
      name: agent.name,
      description: agent.description ?? "",
      fallbackEmail: agent.fallbackEmail ?? "",
      greeting: agent.greeting ?? "",
      brandColor: agent.brandColor ?? "#6366f1",
      position: agent.position ?? "bottom-right",
      knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: SupportAgentFormValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      setDialogOpen(false);
    } catch (e) {
      // hooks already toast on error/success
    }
  };

  if (isLoading) {
    return (
      <SupportContainer searchValue={searchQuery} onSearchChange={setSearchQuery} onNew={openCreateDialog}>
        <SupportLoadingView />
      </SupportContainer>
    );
  }

  if (error) {
    return (
      <SupportContainer searchValue={searchQuery} onSearchChange={setSearchQuery} onNew={openCreateDialog}>
        <SupportErrorView />
      </SupportContainer>
    );
  }

  const isEmpty = agents.length === 0;

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Support Agent" : "New Support Agent"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex-1 overflow-y-auto pr-1 -mr-1">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                {...form.register("description")}
                placeholder="Short description of what this support agent helps with and its personality."
              />
              <p className="text-xs text-muted-foreground">
                This is used to describe the agent&apos;s style and focus, giving it a more personal voice.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Knowledge bases</Label>
              {knowledgeBases.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You have no knowledge bases yet. Create one in the Knowledge Base section.
                </p>
              ) : (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 pr-1">
                  {knowledgeBases.map((kb) => {
                    const checked = selectedKnowledgeBaseIds.includes(kb.id);
                    return (
                      <label key={kb.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border"
                          checked={checked}
                          onChange={(e) => {
                            const current = form.getValues("knowledgeBaseIds") || [];
                            if (e.target.checked) {
                              form.setValue("knowledgeBaseIds", [...current, kb.id], {
                                shouldDirty: true,
                              });
                            } else {
                              form.setValue(
                                "knowledgeBaseIds",
                                current.filter((id) => id !== kb.id),
                                { shouldDirty: true }
                              );
                            }
                          }}
                        />
                        <span className="truncate">{kb.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The support agent will answer only from the selected knowledge bases.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallbackEmail">Fallback email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="fallbackEmail"
                  type="email"
                  placeholder="support@yourcompany.com"
                  {...form.register("fallbackEmail")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When the agent cannot answer from the knowledge base, it will direct users to this email address.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting</Label>
              <Input id="greeting" {...form.register("greeting")} placeholder="Hi! How can I help you?" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brandColorColor"
                    type="color"
                    className="h-9 w-10 p-1"
                    value={form.watch("brandColor") || "#6366f1"}
                    onChange={(e) => {
                      form.setValue("brandColor", e.target.value, { shouldDirty: true });
                    }}
                  />
                  <Input
                    id="brandColor"
                    type="text"
                    className="flex-1"
                    {...form.register("brandColor")}
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="position">Widget position</Label>
                <Select
                  value={form.watch("position") || "bottom-right"}
                  onValueChange={(value) => {
                    form.setValue("position", value, { shouldDirty: true });
                  }}
                >
                  <SelectTrigger id="position" className="w-full">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="end" className="max-h-64">
                    <SelectItem value="bottom-right">Bottom right (recommended)</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                    <SelectItem value="top-right">Top right</SelectItem>
                    <SelectItem value="top-left">Top left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Save changes" : (
                  <>
                    {/* <Plus className="mr-2 h-4 w-4" /> */}
                    Create
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isEmpty) {
    return (
      <>
        <SupportEmptyView
          onCreateSupportAgent={openCreateDialog}
          isCreating={createMutation.isPending}
        />
        {dialog}
      </>
    );
  }

  return (
    <SupportContainer
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      onNew={openCreateDialog}
      disabled={createMutation.isPending || updateMutation.isPending}
      isCreating={createMutation.isPending}
    >
      <div className="space-y-3">
        <div className="space-y-2 rounded-lg border bg-card p-3 sm:p-4">
          {pagedAgents.map((agent) => {
            const publicLink = baseUrl
              ? `${baseUrl.replace(/\/+$/, "")}/support/${agent.publicId}`
              : `/support/${agent.publicId}`;
            const embedCode = baseUrl
              ? `<script src="${baseUrl.replace(/\/+$/, "")}/support-widget.js" data-support-agent="${agent.publicId}"></script>`
              : `<script src="/support-widget.js" data-support-agent="${agent.publicId}"></script>`;

            return (
              <div
                key={agent.id}
                className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-md border"
                      style={{ borderColor: agent.brandColor || "#6366f1" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.description || "Support agent using your knowledge bases"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {agent.knowledgeBaseIds.length
                      ? `${agent.knowledgeBaseIds.length} knowledge base${agent.knowledgeBaseIds.length > 1 ? "s" : ""} linked`
                      : "No knowledge bases linked yet"}
                    {agent.fallbackEmail ? ` • Fallback: ${agent.fallbackEmail}` : " • No fallback email set"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(publicLink)
                          .then(() => toast.success("Public chat link copied"))
                          .catch(() => toast.error("Failed to copy link"));
                      }}
                    >
                      <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(embedCode)
                          .then(() => toast.success("Embed code copied"))
                          .catch(() => toast.error("Failed to copy embed code"));
                      }}
                    >
                      <Code2 className="mr-1.5 h-3.5 w-3.5" />
                      Embed
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(agent)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: agent.id })}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <EntityPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {dialog}
    </SupportContainer>
  );
}

