"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import NextLink from "next/link";
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
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { hasUnsavedChangesAtom } from "@/app/app-components/features/editor/atoms";
import { useSkills } from "@/hooks/useSkills";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProtectedMutation } from "@/hooks/useProtectedApi";
import { cn } from "@/lib/utils";

export type PlanFormValues = {
  soulMd?: string;
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
};

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
  const { data: skillsData } = useSkills(1, 100);
  const isMobile = useIsMobile();

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
  const [personaSheetOpen, setPersonaSheetOpen] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [soulMd, setSoulMd] = useState(
    () => (defaultValues?.soulMd as string | undefined) || ""
  );
  const [skillScope, setSkillScope] = useState<
    "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS"
  >(
    () =>
      (defaultValues?.skillScope as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS") || "ALL_SKILLS"
  );
  const [allowedSkillIds, setAllowedSkillIds] = useState<string[]>(
    () => (defaultValues?.allowedSkillIds as string[] | undefined) || []
  );
  const [soulUpdateExpanded, setSoulUpdateExpanded] = useState(false);
  const [soulTab, setSoulTab] = useState<string>("paste");
  const [soulGenName, setSoulGenName] = useState("");
  const [soulGenDescription, setSoulGenDescription] = useState("");
  const [soulGenTone, setSoulGenTone] = useState("friendly");
  const [soulGenCoreTruths, setSoulGenCoreTruths] = useState("");
  const [soulGenBoundaries, setSoulGenBoundaries] = useState("");

  const generatePlanSoul = useProtectedMutation<
    { success: boolean; soulMd: string },
    Error,
    { name: string; description: string; tone: string; coreTruths?: string; boundaries?: string }
  >({
    mutationFn: (data) =>
      authenticatedPost<{ success: boolean; soulMd: string }>("/planning/generate-soul", data),
    onSuccess: (result) => {
      setSoulMd(result.soulMd);
      toast.success("Personality generated successfully");
      setSoulGenName("");
      setSoulGenDescription("");
      setSoulGenTone("friendly");
      setSoulGenCoreTruths("");
      setSoulGenBoundaries("");
      setSoulTab("paste");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to generate personality");
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soulUploadInputRef = useRef<HTMLInputElement>(null);

  // Sync persona from defaultValues when dialog opens
  useEffect(() => {
    if (open) {
      setSoulMd((defaultValues?.soulMd as string | undefined) || "");
      setSkillScope(
        (defaultValues?.skillScope as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS") || "ALL_SKILLS"
      );
      setAllowedSkillIds((defaultValues?.allowedSkillIds as string[] | undefined) || []);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only sync when dialog opens

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

      const hasPersona = soulMd.trim() || skillScope !== "ALL_SKILLS";
      const response = await fetch(`${baseUrl}/planning/message/stream`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          workflowId,
          message: userMessage || "Please analyze the attached files.",
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          agentPersonality: hasPersona
            ? {
                name: "Verxio",
                soulMd: soulMd.trim(),
                skillScope,
                allowedSkillIds:
                  skillScope === "SELECTED_SKILLS" ? allowedSkillIds : [],
              }
            : undefined,
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
        if (!nextOpen) {
          try {
            if (onRefreshCanvas) {
              await onRefreshCanvas();
            } else {
              router.refresh();
            }
            setHasUnsavedChanges(false);
            setHasWorkflowChanges(false);
          } catch {
            // ignore refresh errors
          }
        }
      }}
    >
      <DialogContent className="w-[95vw] max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Workflow planner</DialogTitle>
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
          <div className="flex items-center gap-1 mr-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setPersonaSheetOpen(true)}
              disabled={isSending}
              title="Persona settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setShowClearConfirm(true)}
              disabled={conversationHistory.length === 0 || isSending}
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
            <div className="py-6 space-y-6">
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
                        : "flex-1 min-w-0 rounded-2xl rounded-bl-md bg-muted/40 dark:bg-muted/20 px-4 py-3.5"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="plan-message prose prose-sm dark:prose-invert max-w-none break-words
                        [&_p]:mb-3 [&_p:last-child]:mb-0 [&_p]:text-[15px] [&_p]:leading-[1.65]
                        [&_ul]:my-3 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:pl-5 [&_li]:my-1 [&_li]:text-[15px] [&_li]:leading-relaxed
                        [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:first:mt-0
                        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5
                        [&_pre]:my-3 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:bg-background/80 [&_pre]:border [&_pre]:overflow-x-auto [&_pre]:text-[13px]
                        [&_code]:text-[13px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-background/80 [&_code]:font-mono
                        [&_pre_code]:p-0 [&_pre_code]:bg-transparent
                        [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                        [&_hr]:my-4 [&_hr]:border-border
                        [&_table]:my-3 [&_table]:w-full [&_th]:text-left [&_th]:font-medium [&_th]:py-2 [&_th]:pr-3 [&_td]:py-2 [&_td]:pr-3
                        [&_strong]:font-semibold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Verxio is AI and can make mistakes. Please double-check responses.
          </p>
        </div>

        {/* Persona Settings Sheet */}
        <Sheet open={personaSheetOpen} onOpenChange={setPersonaSheetOpen}>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={cn(
              "flex flex-col overflow-hidden p-4 sm:p-6",
              isMobile
                ? "inset-x-0 bottom-0 top-auto max-h-[90vh] rounded-t-2xl border-t"
                : "w-full sm:max-w-md"
            )}
          >
            <div className="flex flex-1 flex-col overflow-y-auto min-h-0 pr-6">
              <SheetHeader className="flex-shrink-0">
                <SheetTitle>Configure your Planning Agent</SheetTitle>
                <SheetDescription>
                  Set a soul and skill scope so the agent uses your custom skills and personality.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5">
                {/* Personality: display + Paste/Upload/Generate (like chat integration) */}
                <div className="space-y-2">
                  <Label>Personality (soul.md)</Label>
                  <p className="text-xs text-muted-foreground">
                    Give your planning agent a unique personality. Display below, or update by pasting,
                    uploading, or generating.
                  </p>
                  {soulMd && (
                    <div className="border rounded-lg p-3 bg-muted/30 max-h-32 overflow-y-auto">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                        Current personality
                      </h4>
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {soulMd.length > 200 ? `${soulMd.slice(0, 200)}...` : soulMd}
                      </pre>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSoulUpdateExpanded(!soulUpdateExpanded)}
                    className="gap-2"
                  >
                    {soulUpdateExpanded ? (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Hide options
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" />
                        {soulMd ? "Update personality" : "Set personality"}
                      </>
                    )}
                  </Button>
                  {soulUpdateExpanded && (
                    <Tabs value={soulTab} onValueChange={setSoulTab}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="paste" className="flex items-center gap-1.5 text-xs">
                          <FileText className="h-3 w-3" />
                          Paste
                        </TabsTrigger>
                        <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
                          <Upload className="h-3 w-3" />
                          Upload
                        </TabsTrigger>
                        <TabsTrigger value="generate" className="flex items-center gap-1.5 text-xs">
                          <Wand2 className="h-3 w-3" />
                          Generate
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="paste" className="space-y-2 mt-3">
                        <Textarea
                          placeholder="Paste your soul.md content..."
                          value={soulMd}
                          onChange={(e) => setSoulMd(e.target.value)}
                          rows={6}
                          className="font-mono text-xs resize-none"
                        />
                      </TabsContent>
                      <TabsContent value="upload" className="space-y-2 mt-3">
                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground mb-2">
                            Upload a <code className="text-[10px]">.md</code> file
                          </p>
                          <input
                            ref={soulUploadInputRef}
                            type="file"
                            accept=".md,.txt,.markdown"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const text = await file.text();
                              setSoulMd(text);
                              toast.success("Personality file uploaded");
                              e.target.value = "";
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => soulUploadInputRef.current?.click()}
                          >
                            Choose file
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="generate" className="space-y-2 mt-3">
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Agent name</Label>
                            <Input
                              placeholder="e.g., Planner"
                              value={soulGenName}
                              onChange={(e) => setSoulGenName(e.target.value)}
                              className="mt-0.5 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              placeholder="What does this planner do?"
                              value={soulGenDescription}
                              onChange={(e) => setSoulGenDescription(e.target.value)}
                              rows={2}
                              className="mt-0.5 text-sm resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tone</Label>
                            <Select value={soulGenTone} onValueChange={setSoulGenTone}>
                              <SelectTrigger className="mt-0.5 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="witty">Witty</SelectItem>
                                <SelectItem value="sarcastic">Sarcastic</SelectItem>
                                <SelectItem value="formal">Formal</SelectItem>
                                <SelectItem value="creative">Creative</SelectItem>
                                <SelectItem value="empathetic">Empathetic</SelectItem>
                                <SelectItem value="concise">Concise</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Core truths (optional)</Label>
                            <Textarea
                              placeholder="Values and principles..."
                              value={soulGenCoreTruths}
                              onChange={(e) => setSoulGenCoreTruths(e.target.value)}
                              rows={2}
                              className="mt-0.5 text-sm resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Boundaries (optional)</Label>
                            <Textarea
                              placeholder="Hard limits — things to never do..."
                              value={soulGenBoundaries}
                              onChange={(e) => setSoulGenBoundaries(e.target.value)}
                              rows={2}
                              className="mt-0.5 text-sm resize-none"
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={
                              !soulGenName.trim() ||
                              !soulGenDescription.trim() ||
                              generatePlanSoul.isPending
                            }
                            onClick={() =>
                              generatePlanSoul.mutate({
                                name: soulGenName,
                                description: soulGenDescription,
                                tone: soulGenTone,
                                coreTruths: soulGenCoreTruths || undefined,
                                boundaries: soulGenBoundaries || undefined,
                              })
                            }
                          >
                            {generatePlanSoul.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            Generate (20 credits)
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Skill scope</Label>
                  <Select
                    value={skillScope}
                    onValueChange={(v) =>
                      setSkillScope(v as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_SKILLS">All skills</SelectItem>
                      <SelectItem value="SELECTED_SKILLS">Selected skills only</SelectItem>
                      <SelectItem value="NO_SKILLS">No custom skills</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {skillScope === "ALL_SKILLS" && "Planner has access to all your custom skills."}
                    {skillScope === "SELECTED_SKILLS" &&
                      "Planner uses only the skills you select below."}
                    {skillScope === "NO_SKILLS" &&
                      "Planner uses built-in capabilities only, no custom skills."}
                  </p>
                </div>

                {skillScope === "SELECTED_SKILLS" && (
                  <div className="space-y-2">
                    <Label>Choose skills</Label>
                    <div className="max-h-[40vh] sm:max-h-[200px] overflow-y-auto rounded-md border p-2">
                      {(skillsData?.skills ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center px-2">
                          No skills yet.{" "}
                          <NextLink href="/skills" className="text-primary underline">
                            Add skills
                          </NextLink>{" "}
                          in Settings to use them here.
                        </p>
                      ) : (
                        <div className="grid gap-1.5 sm:gap-2">
                          {(skillsData?.skills ?? []).map((skill) => (
                            <label
                              key={skill.id}
                              className="flex items-center gap-3 rounded-md border px-3 py-2.5 sm:py-2 text-sm cursor-pointer hover:bg-muted/50 active:bg-muted/70 min-h-[44px] sm:min-h-0 touch-manipulation"
                            >
                              <input
                                type="checkbox"
                                checked={allowedSkillIds.includes(skill.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAllowedSkillIds((prev) => [...prev, skill.id]);
                                  } else {
                                    setAllowedSkillIds((prev) =>
                                      prev.filter((id) => id !== skill.id)
                                    );
                                  }
                                }}
                                className="rounded h-4 w-4 flex-shrink-0"
                              />
                              <span className="font-medium truncate flex-1 min-w-0">
                                {skill.name}
                              </span>
                              {skill.description && (
                                <span className="text-muted-foreground text-xs truncate hidden sm:inline">
                                  — {skill.description}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex-shrink-0 pb-4 sm:pb-0">
              <Button
                className="w-full sm:w-auto"
                disabled={isSavingPersona}
                onClick={() => {
                  setIsSavingPersona(true);
                  try {
                    onSubmit({ soulMd, skillScope, allowedSkillIds });
                    toast.success("Configuration saved");
                    setPersonaSheetOpen(false);
                  } finally {
                    setIsSavingPersona(false);
                  }
                }}
              >
                {isSavingPersona ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save configuration"
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

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
