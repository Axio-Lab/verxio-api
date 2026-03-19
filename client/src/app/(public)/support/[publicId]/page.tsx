"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Bot,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Star,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachmentUrls?: Array<{ type: string; url: string }>;
};

type SupportAgentInfo = {
  success: boolean;
  active?: boolean;
  name?: string;
  description?: string | null;
  greeting?: string;
  brandColor?: string;
  position?: string;
};

export default function PublicSupportChatPage() {
  const params = useParams();
  const publicId = params?.publicId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<SupportAgentInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ type: string; url: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasRated, setHasRated] = useState(false);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingValue, setRatingValue] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [agentSuggestsRating, setAgentSuggestsRating] = useState(false);

  const ACCEPT_FILES = "image/jpeg,image/png,image/gif,image/webp,application/pdf";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `vx_support_sid_${publicId}`;
    let sid = window.localStorage.getItem(key);
    if (!sid) {
      sid = `vx_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(key, sid);
    }
    setSessionId(sid);
  }, [publicId]);

  useEffect(() => {
    if (!publicId || !API_BASE) return;
    let cancelled = false;
    setInfoLoading(true);
    fetch(`${API_BASE}/api/public/support-chat/${publicId}/info`)
      .then((res) => res.json())
      .then((data: SupportAgentInfo) => {
        if (!cancelled) setAgentInfo(data);
      })
      .catch(() => {
        if (!cancelled) setAgentInfo({ success: false });
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  // Restore conversation from server when we have sessionId (persists across refresh)
  useEffect(() => {
    if (!publicId || !API_BASE || !sessionId) return;
    let cancelled = false;
    fetch(
      `${API_BASE}/api/public/support-chat/${publicId}/session?sessionId=${encodeURIComponent(sessionId)}`
    )
      .then((res) => res.json())
      .then(
        (data: {
          success?: boolean;
          messages?: SupportChatMessage[];
          rating?: number;
          feedback?: string;
          suggestShowRating?: boolean;
        }) => {
          if (cancelled || !data.success || !Array.isArray(data.messages)) return;
          if (data.rating != null) setHasRated(true);
          if (data.suggestShowRating === true) setAgentSuggestsRating(true);
          if (data.messages.length > 0) {
            setMessages(
              data.messages.map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
                ...(m.attachmentUrls && { attachmentUrls: m.attachmentUrls }),
              }))
            );
          } else if (agentInfo?.success && agentInfo.greeting) {
            setMessages([
              {
                role: "assistant",
                content: agentInfo.greeting,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicId, sessionId, agentInfo?.success, agentInfo?.greeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !API_BASE) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      setUploadError("Please choose an image (JPEG, PNG, GIF, WebP) or PDF.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/public/support-chat/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.success && data.url) {
        const type = data.type === "pdf" ? "pdf" : "image";
        setPendingAttachments((prev) => [...prev, { type, url: data.url }]);
      } else {
        setUploadError(data.message || "Upload failed.");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const text = input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!text && !hasAttachments) || !publicId || !API_BASE || sending || !sessionId) return;

    setInput("");
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text || "(attachment)",
        timestamp: new Date().toISOString(),
        ...(attachmentsToSend.length > 0 && { attachmentUrls: attachmentsToSend }),
      },
    ]);
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/support-chat/${publicId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "(attachment)",
          sessionId,
          ...(attachmentsToSend.length > 0 && { attachments: attachmentsToSend }),
        }),
      });
      const data = await res.json();

      if (data.success && data.reply != null) {
        if (data.suggestShowRating === true) setAgentSuggestsRating(true);
        else if (data.suggestShowRating === false) setAgentSuggestsRating(false);
        // Empty reply means the agent is intentionally silent (e.g. safety cap, closing).
        // Refresh the message list if available but don't append a blank bubble.
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: SupportChatMessage) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              ...(m.attachmentUrls && { attachmentUrls: m.attachmentUrls }),
            }))
          );
        } else if (data.reply) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.reply as string,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } else if (data.code === "agentDisabled") {
        const disabledMessage =
          data.message ||
          `${data.agentName || "This support agent"} is disabled. Enable in your Verxio dashboard support agent section.`;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: disabledMessage,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || data.message || "Something went wrong.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Failed to send message.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clearConversation = useCallback(() => {
    if (typeof window === "undefined" || !publicId) return;
    const key = `vx_support_sid_${publicId}`;
    const newSid = `vx_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(key, newSid);
    setSessionId(newSid);
    setMessages(
      agentInfo?.success && agentInfo.greeting
        ? [
            {
              role: "assistant",
              content: agentInfo.greeting,
              timestamp: new Date().toISOString(),
            },
          ]
        : []
    );
    setHasRated(false);
    setAgentSuggestsRating(false);
    setRatingValue(0);
    setFeedbackText("");
  }, [publicId, agentInfo?.success, agentInfo?.greeting]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/5">
              <Bot className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-medium truncate">
                {agentInfo?.name || "Verxio Support"}
              </h1>
              <p className="text-[11px] leading-none text-muted-foreground">
                24/7 Customer Support
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearConversation}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto max-w-2xl py-4 space-y-5">
          {messages.length === 0 && !infoLoading && (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-base font-medium">
                {agentInfo?.success && agentInfo.greeting
                  ? agentInfo.greeting
                  : "How can we help today?"}
              </p>
              {agentInfo?.description && (
                <p className="text-sm text-muted-foreground">{agentInfo.description}</p>
              )}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground/5">
                  <Bot className="h-3.5 w-3.5 text-foreground/60" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%]",
                  msg.role === "user"
                    ? "rounded-2xl rounded-br-md bg-muted px-4 py-2.5"
                    : "flex-1 min-w-0 rounded-2xl rounded-bl-md bg-muted/40 dark:bg-muted/20 px-4 py-3.5"
                )}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none break-words
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
                    [&_strong]:font-semibold"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                    {msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachmentUrls.map((att, idx) => {
                          const src = att.url.startsWith("http")
                            ? att.url
                            : `${API_BASE}${att.url.startsWith("/") ? "" : "/"}${att.url}`;
                          return att.type === "image" ? (
                            <a
                              key={idx}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded border overflow-hidden max-w-[120px] max-h-[120px]"
                            >
                              <img
                                src={src}
                                alt="Attachment"
                                className="h-auto w-full object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              key={idx}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-xs text-primary underline"
                            >
                              <FileText className="h-3.5 w-3.5" /> PDF
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground/5">
                <Bot className="h-3.5 w-3.5 text-foreground/60" />
              </div>
              <div className="flex items-center gap-1.5 py-2">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          {!hasRated && agentSuggestsRating ? (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium">Rate your experience</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    onClick={() => setRatingValue(star)}
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        (ratingHover || ratingValue) >= star
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">How could we improve?</p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
                placeholder="Optional — your feedback helps us serve you better"
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                disabled={ratingValue === 0 || feedbackSubmitting}
                onClick={async () => {
                  if (!publicId || !sessionId || !API_BASE || ratingValue === 0) return;
                  setFeedbackSubmitting(true);
                  try {
                    const res = await fetch(
                      `${API_BASE}/api/public/support-chat/${publicId}/feedback`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sessionId,
                          rating: ratingValue,
                          feedback: feedbackText.trim() || undefined,
                        }),
                      }
                    );
                    const data = await res.json();
                    if (data.success) setHasRated(true);
                  } finally {
                    setFeedbackSubmitting(false);
                  }
                }}
                className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background transition-opacity disabled:opacity-40"
              >
                {feedbackSubmitting ? "Sending…" : "Submit"}
              </button>
            </div>
          ) : hasRated && agentSuggestsRating ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Thanks for your feedback.
            </p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="border-t bg-card px-4 py-3 sm:px-6">
        <form
          className="mx-auto max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_FILES}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading || sending}
          />
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-lg border bg-muted/50 px-2 py-1 text-xs"
                >
                  {att.type === "image" ? (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="max-w-[120px] truncate">{att.type}</span>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(idx)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploadError && <p className="mb-2 text-xs text-destructive">{uploadError}</p>}
          <div className="relative flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              title="Attach image or PDF"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Type a message or attach image/PDF..."
              disabled={sending}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity disabled:opacity-30"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">
          <a
            href="https://www.verxio.xyz"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:text-primary/80"
          >
            Powered by Verxio
          </a>
        </p>
      </footer>
    </div>
  );
}
