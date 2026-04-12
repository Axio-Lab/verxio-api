"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useChat, type ToolActivity } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { authenticatedPost } from "@/lib/api-client";
import { ArrowUp, Bot, Loader2, Paperclip, Square, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOOL_LABELS: Record<string, string> = {
  createWorkflow: "Creating workflow",
  getWorkflow: "Reading workflow",
  listWorkflows: "Listing workflows",
  deleteWorkflow: "Deleting workflow",
  renameWorkflow: "Renaming workflow",
  addNode: "Adding node",
  configureNode: "Configuring node",
  connectNodes: "Connecting nodes",
  deleteNode: "Deleting node",
  executeWorkflow: "Running workflow",
  executeSingleNodeAndWait: "Executing node",
  getCredentials: "Checking credentials",
  createCredential: "Creating credential",
  updateCredential: "Updating credential",
  deleteCredential: "Deleting credential",
  checkCredential: "Validating credential",
  requestCredential: "Preparing credential setup",
  getConnections: "Listing connections",
  createUserConnection: "Creating connection",
  deleteUserConnection: "Deleting connection",
  testUserConnection: "Testing connection",
  searchDocumentation: "Searching docs",
  listSupportAgents: "Listing support agents",
  createSupportAgent: "Creating support agent",
  getSupportAgent: "Reading agent details",
  updateSupportAgent: "Updating support agent",
  deleteSupportAgent: "Deleting support agent",
  listSupportChannels: "Listing channels",
  createSupportChannel: "Creating channel",
  createKnowledgeBase: "Creating knowledge base",
  getKnowledgeBaseDetails: "Reading knowledge base",
  deleteKnowledgeBase: "Deleting knowledge base",
  addKnowledgeDocument: "Adding document",
  deleteKnowledgeDocument: "Deleting document",
  searchKnowledgeBase: "Searching knowledge base",
  listKnowledgeBases: "Listing knowledge bases",
  listOrganizations: "Listing organizations",
  createOrganization: "Creating organization",
  inviteOrgMember: "Inviting member",
  shareOrgResource: "Sharing resource",
  unshareOrgResource: "Removing share",
  listOrgMembers: "Listing members",
  listWorkflowTemplates: "Browsing templates",
  getWorkflowTemplate: "Reading template",
  importWorkflowTemplate: "Importing template",
  getAnalyticsDashboard: "Loading analytics",
  generateAnalyticsInsight: "Generating insight",
  listGoals: "Listing goals",
  pauseGoal: "Pausing goal",
  resumeGoal: "Resuming goal",
  deleteGoal: "Deleting goal",
  create_goal: "Creating goal",
  decompose_goal: "Decomposing goal",
  getSkills: "Listing skills",
  addSkill: "Adding skill",
  updateSkill: "Updating skill",
  removeSkill: "Removing skill",
  browseWebsite: "Browsing website",
  checkWebRun: "Checking web run",
  remember_fact: "Remembering",
  recall_facts: "Recalling",
  listAllMemories: "Listing memories",
  forgetMemoryFact: "Forgetting fact",
  listWatches: "Listing watches",
  pauseWatch: "Pausing watch",
  resumeWatch: "Resuming watch",
  deleteWatch: "Deleting watch",
  runComposioAction: "Running action",
  searchComposioApps: "Searching apps",
  generateCode: "Generating code",
};

function getToolLabel(name: string, input?: Record<string, unknown>): string {
  if (name === "addNode" && input?.type) {
    return `Adding ${String(input.type).replace(/_/g, " ")} node`;
  }
  return TOOL_LABELS[name] || name.replace(/([A-Z])/g, " $1").trim();
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AgentProgressSteps({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/5 mt-0.5">
        <Loader2 className="size-3.5 animate-spin text-foreground/60" />
      </div>
      <div className="space-y-1 py-1">
        {tools.map((tool, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className={cn(
                "size-1 rounded-full shrink-0",
                idx === tools.length - 1 && tool.status === "running"
                  ? "bg-foreground/50 animate-pulse"
                  : "bg-green-500"
              )}
            />
            <span>{getToolLabel(tool.name, tool.input)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { messages, isStreaming, sendMessage, loadHistory, clearHistory, stopStreaming } =
    useChat();

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isStreaming) return;

    let attachments: Array<{
      fileId: string;
      fileName: string;
      fileType: string;
      extractedText?: string;
    }> = [];

    if (pendingFiles.length > 0) {
      setIsUploading(true);
      try {
        const filesWithContent = await Promise.all(
          pendingFiles.map(async (file) => ({
            fileName: file.name,
            fileType: file.type,
            content: await fileToBase64(file),
          }))
        );
        const resp = await authenticatedPost<{
          files: Array<{
            fileId: string;
            fileName: string;
            fileType: string;
            extractedText?: string;
          }>;
        }>("/api/chat/upload", { files: filesWithContent });
        attachments = resp.files;
      } catch {
        // continue without attachments
      } finally {
        setIsUploading(false);
      }
    }

    const message = input.trim() || "(Attached files)";
    setPendingFiles([]);
    setInput("");
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }, 0);

    (sendMessage as (text: string, att?: typeof attachments) => Promise<void>)(
      message,
      attachments.length > 0 ? attachments : undefined
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="text-xs text-muted-foreground">
            Talk to Verxio — create workflows, manage agents, run actions, and more.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={clearHistory}
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Bot className="size-10" />
            <p className="text-sm font-medium">What can I help you with?</p>
            <p className="max-w-sm text-center text-xs">
              Create workflows, manage support agents, knowledge bases, credentials, goals, skills —
              everything on Verxio, just say it.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Bot className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Progress steps (workflow generation style) */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <AgentProgressSteps tools={msg.toolCalls} />
                      )}

                      {msg.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {typeof msg.content === "string"
                              ? msg.content
                              : JSON.stringify(msg.content, null, 2)}
                          </ReactMarkdown>
                        </div>
                      ) : isStreaming && i === messages.length - 1 ? (
                        !(msg.toolCalls && msg.toolCalls.length > 0) ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Thinking...
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-background px-4 py-3 md:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Pending file previews */}
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <Paperclip className="size-3 text-muted-foreground shrink-0" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingFile(idx)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border transition-colors",
                "text-muted-foreground hover:text-foreground hover:border-foreground/20",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Paperclip className="size-4" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Verxio anything..."
                rows={1}
                disabled={isStreaming || isUploading}
                className={cn(
                  "w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-3 pr-12 text-sm",
                  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30",
                  "disabled:opacity-50"
                )}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="absolute bottom-2.5 right-2.5 flex size-7 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  <Square className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!input.trim() && pendingFiles.length === 0}
                  className={cn(
                    "absolute bottom-2.5 right-2.5 flex size-7 items-center justify-center rounded-lg transition-colors",
                    input.trim() || pendingFiles.length > 0
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
