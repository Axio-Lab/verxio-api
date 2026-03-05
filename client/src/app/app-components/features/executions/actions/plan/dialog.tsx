"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Trash2,
  Send,
  Paperclip,
  X,
  FileText,
  ImageIcon,
  Bot,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedDelete,
  getAuthHeaders,
} from "@/lib/api-client";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";

export type PlanFormValues = Record<string, never>;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    extractedText?: string;
  }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PlanFormValues) => void;
  defaultValues?: Partial<PlanFormValues>;
  onRefreshCanvas?: () => Promise<void>;
}

export const PlanDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
  onRefreshCanvas,
}: Props) => {
  const params = useParams();
  const workflowId = (params?.id || params?.workflow) as string;
  const queryClient = useQueryClient();
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
  const router = useRouter();

  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [thinkingDots, setThinkingDots] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [agentProgress, setAgentProgress] = useState<Array<{ status: string; toolName?: string }>>(
    []
  );
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [hasWorkflowChanges, setHasWorkflowChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map tool names to user-friendly descriptions
  const getProgressMessage = (toolName: string, input?: any): string => {
    const toolMessages: Record<string, string> = {
      createWorkflow: "Creating new workflow",
      getWorkflow: "Reading existing workflow",
      addNode: `Adding ${input?.type?.replace(/_/g, " ") || "node"} node`,
      configureNode: `Configuring ${input?.nodeType?.replace(/_/g, " ") || "node"} settings`,
      connectNodes: "Connecting workflow nodes",
      getCredentials: "Checking available credentials",
      requestCredential: "Preparing credential requirements",
      generateCode: "Generating custom code block",
    };
    return toolMessages[toolName] || `Processing: ${toolName}`;
  };

  // Tools that indicate workflow structure changed (agent added/configured/connected nodes)
  const WORKFLOW_TOOLS = [
    "createWorkflow",
    "addNode",
    "configureNode",
    "connectNodes",
    "deleteNode",
    "executeSingleNodeAndWait", // agent may add/configure a node then run it; we still need to refetch and sync canvas
  ];

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  // Load conversation history when dialog opens
  useEffect(() => {
    if (open && workflowId) {
      loadConversationHistory();
    }
  }, [open, workflowId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory]);

  // Animate thinking dots when sending message
  useEffect(() => {
    if (isSending) {
      const interval = setInterval(() => {
        setThinkingDots((prev) => {
          if (prev === "...") return "";
          if (prev === "..") return "...";
          if (prev === ".") return "..";
          return ".";
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setThinkingDots("");
    }
  }, [isSending]);

  const loadConversationHistory = async () => {
    if (!workflowId) return;

    setIsLoadingHistory(true);
    try {
      const response = await authenticatedGet<{
        plan: {
          id: string;
          status: string;
          generatedPrompt?: string;
          workflowStructure?: unknown;
          approvedAt?: string;
        } | null;
        conversationHistory: ConversationMessage[];
      }>(`/planning/workflow/${workflowId}`);

      if (response.plan && response.conversationHistory) {
        setConversationHistory(response.conversationHistory);
      } else {
        setConversationHistory([]);
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
      setConversationHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types (images, PDFs, text files, etc.)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/json",
      "text/csv",
    ];

    const validFiles = files.filter((file) => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Unsupported file type`);
        return false;
      }
      // Max 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        return false;
      }
      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove a selected file
  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && selectedFiles.length === 0) || !workflowId) return;

    const userMessage = message.trim();
    const filesToUpload = [...selectedFiles];
    setMessage("");
    setSelectedFiles([]);
    setIsSending(true);

    // Add user message to UI immediately (with file names if any)
    const attachmentNames = filesToUpload.map((f) => ({
      fileId: "",
      fileName: f.name,
      fileType: f.type,
    }));

    const newUserMessage: ConversationMessage = {
      role: "user",
      content: userMessage || "(Attached files)",
      timestamp: new Date().toISOString(),
      attachments: attachmentNames.length > 0 ? attachmentNames : undefined,
    };
    setConversationHistory((prev) => [...prev, newUserMessage]);

    try {
      // If we have files, upload them first
      let uploadedAttachments: Array<{
        fileId: string;
        fileName: string;
        fileType: string;
        content?: string;
      }> = [];

      if (filesToUpload.length > 0) {
        setIsUploading(true);
        try {
          // Convert files to base64 for upload
          const filesWithContent = await Promise.all(
            filesToUpload.map(async (file) => ({
              fileName: file.name,
              fileType: file.type,
              content: await fileToBase64(file),
            }))
          );

          const uploadResponse = await authenticatedPost<{
            files: Array<{
              fileId: string;
              fileName: string;
              fileType: string;
              extractedText?: string;
            }>;
          }>("/planning/upload", {
            workflowId,
            files: filesWithContent,
          });

          uploadedAttachments = uploadResponse.files;
        } catch (uploadError) {
          console.error("Failed to upload files:", uploadError);
          toast.error("Failed to upload files. Sending message without attachments.");
        } finally {
          setIsUploading(false);
        }
      }

      // Use streaming endpoint for real-time progress
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const authHeaders = await getAuthHeaders();

      const response = await fetch(`${baseUrl}/planning/message/stream`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          workflowId,
          message: userMessage || "Please analyze the attached files.",
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = "";
      let workflowModified = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const jsonStr = line.replace("data: ", "").trim();
              if (!jsonStr) continue;

              const event = JSON.parse(jsonStr);

              // Handle tool_use events - show progress
              if (event.type === "tool_use" && event.data?.name) {
                const toolName = event.data.name;

                // If workflow tool is used, switch to workflow creation mode
                if (WORKFLOW_TOOLS.includes(toolName)) {
                  setIsCreatingWorkflow(true);
                  workflowModified = true;
                  setHasWorkflowChanges(true);
                }

                const message = getProgressMessage(toolName, event.data.input);
                setAgentProgress((prev) => [...prev.slice(-4), { status: message, toolName }]);
              }

              // Collect message text
              if (event.type === "message" && event.data?.text && !event.data.partial) {
                assistantResponse += event.data.text;
              }

              // Final result
              if (event.type === "result" && event.data?.result) {
                assistantResponse = event.data.result;
              }

              // Conversation history update from server
              if (event.type === "history" && event.data?.conversationHistory) {
                setConversationHistory(event.data.conversationHistory);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // If we got a response but no history update, add it manually
      if (assistantResponse) {
        setConversationHistory((prev) => {
          // Check if the last message is already from assistant
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === "assistant") {
            return prev;
          }
          return [
            ...prev,
            {
              role: "assistant" as const,
              content: assistantResponse,
              timestamp: new Date().toISOString(),
            },
          ];
        });
      }

      // If workflow was modified, show success message
      if (workflowModified) {
        setAgentProgress((prev) => [
          ...prev.slice(-4),
          { status: "Workflow created successfully!" },
        ]);

        // Invalidate the query
        await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });

        toast.success("Workflow created! The canvas will update automatically.");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      // Remove the user message on error
      setConversationHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
      setIsCreatingWorkflow(false);
      setAgentProgress([]);
    }
  };

  const handleClearConversation = async () => {
    if (!workflowId) return;

    setIsClearing(true);
    try {
      await authenticatedDelete(`/planning/workflow/${workflowId}/clear`);
      setConversationHistory([]);
      setShowClearConfirm(false);
      toast.success("Conversation cleared");
    } catch (error) {
      console.error("Failed to clear conversation:", error);
      toast.error("Failed to clear conversation");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={async (nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen && hasWorkflowChanges) {
          try {
            if (onRefreshCanvas) {
              await onRefreshCanvas();
            } else {
              router.refresh();
            }
            // After refresh, there should be no local unsaved changes
            setHasUnsavedChanges(false);
            setHasWorkflowChanges(false);
          } catch {
            // ignore refresh errors
          }
        }
      }}
    >
      <DialogContent className="w-[95vw] max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground/5">
              <Bot className="h-4 w-4 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Verxio</h2>
              <p className="text-[11px] text-muted-foreground leading-none">Workflow planner</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground mr-8"
            onClick={() => setShowClearConfirm(true)}
            disabled={conversationHistory.length === 0 || isSending}
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversationHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="text-center">
                <p className="text-base font-medium">What would you like to build?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Describe your workflow or upload docs for context.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-5">
              {conversationHistory.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-foreground/60" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] ${
                      msg.role === "user"
                        ? "rounded-2xl rounded-br-md bg-muted px-4 py-2.5"
                        : "flex-1 min-w-0"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-xs [&_code]:text-xs [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1.5 mt-2 ${msg.role === "user" ? "" : "ml-0"}`}
                      >
                        {msg.attachments.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-background/60 border px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {a.fileType?.startsWith("image/") ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            <span className="truncate max-w-[100px]">{a.fileName}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.role === "assistant" && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <p className="text-[10px] text-muted-foreground/50 self-end mb-0.5 flex-shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {isSending && !isCreatingWorkflow && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-foreground/60" />
                  </div>
                  <div className="flex items-center gap-1.5 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {/* Workflow creation progress */}
              {isCreatingWorkflow && agentProgress.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center mt-0.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/60" />
                  </div>
                  <div className="space-y-1 py-1">
                    {agentProgress.map((progress, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <div
                          className={`w-1 h-1 rounded-full flex-shrink-0 ${
                            idx === agentProgress.length - 1
                              ? "bg-foreground/50 animate-pulse"
                              : "bg-green-500"
                          }`}
                        />
                        <span>{progress.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t px-4 sm:px-6 py-3">
          {/* File preview chips */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedFiles.map((file, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px]"
                >
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Compose row */}
          <div className="relative flex items-end gap-2 rounded-xl border bg-background focus-within:ring-1 focus-within:ring-ring px-3 py-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploading || !workflowId}
              className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              placeholder="Describe what you want to automate..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if ((message.trim() || selectedFiles.length > 0) && !isSending && workflowId) {
                    handleSendMessage();
                  }
                }
              }}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none max-h-[120px] py-0.5"
              disabled={isSending || !workflowId}
            />

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={(!message.trim() && selectedFiles.length === 0) || isSending || !workflowId}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-30 transition-opacity"
            >
              {isSending || isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Clear Confirmation Dialog */}
        <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Conversation</DialogTitle>
              <DialogDescription>
                This will permanently delete the conversation history.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClearConversation} disabled={isClearing}>
                {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isClearing ? "Clearing..." : "Clear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
