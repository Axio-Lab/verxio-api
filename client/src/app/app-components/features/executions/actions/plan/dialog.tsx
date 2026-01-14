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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Trash2, Send, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedDelete,
  getAuthHeaders,
} from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  label: z.string().min(1, { message: "Label is required" }),
});

export type PlanFormValues = z.infer<typeof formSchema>;

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
}

export const PlanDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const params = useParams();
  const workflowId = (params?.id || params?.workflow) as string;
  const queryClient = useQueryClient();

  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [thinkingDots, setThinkingDots] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [agentProgress, setAgentProgress] = useState<Array<{ status: string; toolName?: string }>>(
    []
  );
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
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

  // Tools that indicate workflow creation is happening
  const WORKFLOW_TOOLS = [
    "createWorkflow",
    "addNode",
    "configureNode",
    "connectNodes",
    "deleteNode",
  ];

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "plan",
      label: defaultValues.label || "Plan Workflow",
    },
  });

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

        toast.success("Workflow created! Click 'Save Plan' to update the canvas.");
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

    try {
      await authenticatedDelete(`/planning/workflow/${workflowId}/clear`);
      setConversationHistory([]);
      setShowClearConfirm(false);
      toast.success("Conversation cleared");
    } catch (error) {
      console.error("Failed to clear conversation:", error);
      toast.error("Failed to clear conversation");
    }
  };

  const handleSubmit = async (values: PlanFormValues) => {
    setIsSaving(true);
    try {
      await Promise.resolve(onSubmit(values));

      // Always refresh the page to ensure canvas is updated
      toast.success("Workflow updated! Refreshing...");
      setTimeout(() => {
        // Navigate to the workflow page to refresh
        window.location.href = `/workflows/${workflowId}`;
      }, 300);
    } catch (error) {
      setIsSaving(false);
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Plan Workflow with AI</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Brainstorm and ideate your workflow with Verxio. Upload API docs, images, or documents
            to provide context. When ready, approve to generate the workflow.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-3 sm:space-y-4 mt-2 sm:mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              {/* Form fields in a responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="variables"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Variable Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="plan" className="text-sm h-8 sm:h-10" />
                      </FormControl>
                      <FormDescription className="text-[10px] sm:text-xs hidden sm:block">
                        The variable name to store the result.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Label</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Plan Workflow"
                          className="text-sm h-8 sm:h-10"
                        />
                      </FormControl>
                      <FormDescription className="text-[10px] sm:text-xs hidden sm:block">
                        Display name for this plan node.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Chat Interface */}
              <div className="border rounded-lg p-2 sm:p-4 bg-muted/30 min-h-[200px] sm:min-h-[300px] max-h-[40vh] sm:max-h-[400px] overflow-y-auto flex flex-col">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full min-h-[150px]">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : conversationHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[150px] text-muted-foreground">
                    <div className="text-center px-4">
                      <Sparkles className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">
                        Start a conversation to plan your workflow
                      </p>
                      <p className="text-xs sm:text-sm mt-1 sm:mt-2">
                        Upload files, ask questions, and iterate until ready
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 flex-1">
                    {conversationHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[90%] sm:max-w-[80%] rounded-lg p-2 sm:p-3 overflow-hidden ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border shadow-sm"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none overflow-x-auto break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-all [&_p]:break-words [&_p]:text-xs [&_p]:sm:text-sm [&_li]:text-xs [&_li]:sm:text-sm [&_h1]:text-sm [&_h1]:sm:text-base [&_h2]:text-xs [&_h2]:sm:text-sm [&_h3]:text-xs [&_h3]:sm:text-sm [&_code]:text-[10px] [&_code]:sm:text-xs">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-current/20">
                              <div className="flex flex-wrap gap-1">
                                {msg.attachments.map((a, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1 bg-background/20 rounded px-1.5 py-0.5 text-[10px]"
                                  >
                                    {a.fileType?.startsWith("image/") ? (
                                      <ImageIcon className="h-2.5 w-2.5" />
                                    ) : (
                                      <FileText className="h-2.5 w-2.5" />
                                    )}
                                    <span className="truncate max-w-[80px]">{a.fileName}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isSending && !isCreatingWorkflow && (
                      <div className="flex justify-start">
                        <div className="bg-card border border-border shadow-sm rounded-lg p-2 sm:p-3">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Verxio is planning
                            <span className="inline-block w-8">{thinkingDots}</span>
                          </p>
                        </div>
                      </div>
                    )}
                    {isCreatingWorkflow && agentProgress.length > 0 && (
                      <div className="flex justify-start">
                        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4 min-w-[250px]">
                          <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                            <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300">
                              Creating Workflow...
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {agentProgress.map((progress, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-xs text-muted-foreground"
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    idx === agentProgress.length - 1
                                      ? "bg-purple-500 animate-pulse"
                                      : "bg-green-500"
                                  }`}
                                />
                                <span>{progress.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg border">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-background rounded px-2 py-1 text-xs border"
                    >
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="truncate max-w-[100px] sm:max-w-[150px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Input */}
              <div className="flex gap-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.md,.json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* File upload button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isUploading || !workflowId}
                  className="h-[60px] sm:h-[80px] w-10 sm:w-12 flex-shrink-0"
                  title="Attach files (images, PDFs, docs)"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Textarea
                  placeholder="Describe what you want to automate..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  className="text-sm min-h-[60px] sm:min-h-[80px] resize-none"
                  disabled={isSending || !workflowId}
                />

                <Button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={
                    (!message.trim() && selectedFiles.length === 0) || isSending || !workflowId
                  }
                  size="icon"
                  className="h-[60px] sm:h-[80px] w-10 sm:w-12 flex-shrink-0"
                >
                  {isSending || isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Actions */}
              <div className="flex justify-start pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={conversationHistory.length === 0 || isSending}
                  className="text-xs sm:text-sm"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Clear Conversation</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 mt-2 sm:mt-4 pt-2 sm:pt-4 border-t">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {isSaving && (
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                )}
                {isSaving ? "Saving..." : "Save Plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {/* Clear Confirmation Dialog */}
        <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Conversation</DialogTitle>
              <DialogDescription>
                Are you sure you want to clear the conversation history? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClearConversation}>
                Clear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
