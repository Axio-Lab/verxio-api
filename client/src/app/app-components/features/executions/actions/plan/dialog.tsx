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
import {
  Loader2,
  Sparkles,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Paperclip,
  X,
  FileText,
  ImageIcon,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useReactFlow } from "@xyflow/react";
import type { Edge } from "@xyflow/react";

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
  const { setNodes, setEdges, fitView } = useReactFlow();

  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [thinkingDots, setThinkingDots] = useState("");
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (response.plan.generatedPrompt) {
          setGeneratedPrompt(response.plan.generatedPrompt);
        }
      } else {
        setConversationHistory([]);
        setGeneratedPrompt(null);
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

      const response = await authenticatedPost<{
        response: string;
        conversationHistory: ConversationMessage[];
      }>("/planning/message", {
        workflowId,
        message: userMessage || "Please analyze the attached files.",
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      });

      setConversationHistory(response.conversationHistory);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      // Remove the user message on error
      setConversationHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!workflowId) return;

    setIsGeneratingPrompt(true);
    try {
      const response = await authenticatedPost<{
        prompt: string;
        workflowStructure: {
          description: string;
          nodes: Array<{ type: string; purpose: string }>;
          credentials: Array<{ type: string; name: string; description: string }>;
        };
        credentials: Array<{ type: string; name: string; description: string }>;
      }>("/planning/generate-prompt", {
        workflowId,
      });

      setGeneratedPrompt(response.prompt);
      setIsPromptExpanded(false); // Start collapsed for new prompts
      toast.success("Prompt generated successfully!");
    } catch (error) {
      console.error("Failed to generate prompt:", error);
      toast.error("Failed to generate prompt. Please try again.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const pollGenerationStatus = async (generationId: string) => {
    const maxAttempts = 60; // Poll for up to 60 seconds
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setIsGeneratingWorkflow(false);
        toast.error("Workflow generation timed out. Please try again.");
        return;
      }

      try {
        const response = await authenticatedGet<{
          id: string;
          status: string;
          nodes?: Array<{
            id: string;
            type: string;
            data: Record<string, unknown>;
            position: { x: number; y: number };
          }>;
          connections?: Array<{
            id: string;
            source: string;
            target: string;
            fromOutput?: string;
            toInput?: string;
          }>;
        }>(`/workflow-generation/${generationId}`);

        if (response.status === "completed" && response.nodes && response.connections) {
          // Add nodes to canvas
          const approvedNodes = response.nodes;
          const approvedConnections = response.connections;

          // Transform nodes to React Flow format with proper structure
          // Ensure all required fields are present for proper saving
          const newNodes = approvedNodes.map((node: any) => {
            const nodeLabel = node.data?.label || node.data?.name || node.id;
            return {
              id: node.id,
              type: node.type,
              data: {
                ...node.data,
                // Ensure label is set for proper display and saving
                label: nodeLabel,
                // Ensure name is also set (used during save)
                name: nodeLabel,
              },
              position: node.position || { x: 0, y: 0 },
            };
          });

          const nodeIds = new Set(newNodes.map((n) => n.id));
          const validConnections = approvedConnections.filter((conn: any) => {
            return nodeIds.has(conn.source) && nodeIds.has(conn.target);
          });

          const newEdges: Edge[] = validConnections.map((conn: any, index: number) => {
            const normalizeHandle = (handle: any): string | undefined => {
              if (
                !handle ||
                handle === "null" ||
                handle === "main" ||
                handle === "" ||
                handle === null
              ) {
                return undefined;
              }
              return handle;
            };

            return {
              id: conn.id || `edge-${conn.source}-${conn.target}-${Date.now()}-${index}`,
              source: conn.source,
              target: conn.target,
              sourceHandle: normalizeHandle(conn.fromOutput || conn.sourceHandle),
              targetHandle: normalizeHandle(conn.toInput || conn.targetHandle),
              deletable: true,
              selectable: true,
            };
          });

          setNodes((nodes) => [...nodes, ...newNodes]);
          setEdges((edges) => [...edges, ...newEdges]);

          // Center view on new nodes
          setTimeout(() => {
            fitView({ padding: 0.2, duration: 400 });
          }, 100);

          setIsGeneratingWorkflow(false);
          toast.success("Workflow generated and added to canvas!");
          onOpenChange(false);
        } else if (response.status === "failed") {
          setIsGeneratingWorkflow(false);
          toast.error("Workflow generation failed. Please try again.");
        } else {
          // Still generating, poll again
          attempts++;
          setTimeout(poll, 1000);
        }
      } catch (error) {
        console.error("Failed to poll generation status:", error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setIsGeneratingWorkflow(false);
          toast.error("Failed to check generation status. Please try again.");
        }
      }
    };

    poll();
  };

  const handleApproveAndGenerate = async () => {
    if (!generatedPrompt || !workflowId) {
      toast.error("Please generate a prompt first");
      return;
    }

    setIsGeneratingWorkflow(true);
    try {
      // Call workflow generation API with the generated prompt
      const response = await authenticatedPost<{
        id: string;
        status: string;
      }>("/workflow-generation/generate", {
        prompt: generatedPrompt,
        workflowId,
        mode: "generate",
      });

      if (response.status === "completed") {
        // If already completed, fetch and add to canvas
        await pollGenerationStatus(response.id);
      } else {
        // Poll for completion
        toast.info("Workflow generation started. Please wait...");
        await pollGenerationStatus(response.id);
      }
    } catch (error) {
      console.error("Failed to generate workflow:", error);
      toast.error("Failed to start workflow generation. Please try again.");
      setIsGeneratingWorkflow(false);
    }
  };

  const handleClearConversation = async () => {
    if (!workflowId) return;

    try {
      await authenticatedDelete(`/planning/workflow/${workflowId}/clear`);
      setConversationHistory([]);
      setGeneratedPrompt(null);
      setShowClearConfirm(false);
      toast.success("Conversation cleared");
    } catch (error) {
      console.error("Failed to clear conversation:", error);
      toast.error("Failed to clear conversation");
    }
  };

  const handleSubmit = async (values: PlanFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Plan node configured");
      form.reset();
    } catch (error) {
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
                    {isSending && (
                      <div className="flex justify-start">
                        <div className="bg-card border border-border shadow-sm rounded-lg p-2 sm:p-3">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Verxio is thinking
                            <span className="inline-block w-8">{thinkingDots}</span>
                          </p>
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

              {/* Generated Prompt Preview - Collapsible */}
              {generatedPrompt && (
                <div className="border rounded-lg bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
                  <div
                    className="flex items-center justify-between p-2 sm:p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors gap-2"
                    onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                  >
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                      {isPromptExpanded ? (
                        <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="text-xs sm:text-sm font-medium truncate">Generated Prompt</p>
                      {!isPromptExpanded && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                          (click to expand)
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(generatedPrompt);
                        setIsCopied(true);
                        toast.success("Prompt copied to clipboard");
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                    </Button>
                  </div>
                  {isPromptExpanded && (
                    <div className="px-2 sm:px-4 pb-2 sm:pb-4 border-t border-blue-100 dark:border-blue-900/50">
                      <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words pt-2 sm:pt-3 max-h-[150px] sm:max-h-[250px] overflow-y-auto">
                        {generatedPrompt}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={conversationHistory.length === 0}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Clear Conversation</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePrompt}
                    disabled={conversationHistory.length === 0 || isGeneratingPrompt}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    {isGeneratingPrompt ? (
                      <>
                        <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        <span className="hidden sm:inline">Generating...</span>
                        <span className="sm:hidden">Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Generate Prompt</span>
                        <span className="sm:hidden">Generate Prompt</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApproveAndGenerate}
                    disabled={!generatedPrompt || isGeneratingWorkflow}
                    className="bg-primary w-full sm:w-auto text-xs sm:text-sm"
                  >
                    {isGeneratingWorkflow ? (
                      <>
                        <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        <span className="hidden sm:inline">Generating Workflow...</span>
                        <span className="sm:hidden">Generating...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Approve & Generate Workflow</span>
                        <span className="sm:hidden">Approve & Generate</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 mt-2 sm:mt-4 pt-2 sm:pt-4 border-t">
              <Button
                type="submit"
                size="sm"
                disabled={form.formState.isSubmitting}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                )}
                Save Configuration
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
