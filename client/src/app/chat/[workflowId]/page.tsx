"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, Bot, FileText, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ChatMedia {
  image?: string;
  video?: string;
  audio?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string | Record<string, unknown>;
  media?: ChatMedia;
  timestamp: string;
}

interface PublicChatInfo {
  success: boolean;
  hasWebhookTrigger: boolean;
  workflowName?: string;
}

function formatOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }
  return String(output ?? "");
}

const ACCEPT_MEDIA = "image/*,video/*,audio/*";
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const AUDIO_MIMES = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"];

function mediaType(mime: string): "image" | "video" | "audio" | null {
  if (IMAGE_MIMES.includes(mime)) return "image";
  if (VIDEO_MIMES.includes(mime)) return "video";
  if (AUDIO_MIMES.includes(mime)) return "audio";
  return null;
}

export default function PublicChatPage() {
  const params = useParams();
  const workflowId = params?.workflowId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<PublicChatInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<ChatMedia>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    setInfoLoading(true);
    fetch(`${API_BASE}/api/public/chat/${workflowId}/info`)
      .then((res) => res.json())
      .then((data: PublicChatInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo({ success: false, hasWebhookTrigger: false });
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const hasPendingMedia = !!(pendingMedia.image || pendingMedia.video || pendingMedia.audio);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !API_BASE) return;
    const type = mediaType(file.type);
    if (!type) {
      setUploadError("Please choose an image, video, or audio file.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/public/chat/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setPendingMedia((prev) => ({ ...prev, [type]: data.url }));
      } else {
        setUploadError(data.message || "Upload failed.");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removePendingMedia = (key: keyof ChatMedia) => {
    setPendingMedia((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !hasPendingMedia) || !workflowId || !API_BASE || sending) return;

    const media = { ...pendingMedia };
    setInput("");
    setPendingMedia({});
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text || "(attachment)",
        media: hasPendingMedia ? media : undefined,
        timestamp: new Date().toISOString(),
      },
    ]);
    setSending(true);

    try {
      const body: { message: string; image?: string; video?: string; audio?: string } = {
        message: text || "(attachment)",
      };
      if (media.image) body.image = media.image;
      if (media.video) body.video = media.video;
      if (media.audio) body.audio = media.audio;

      const res = await fetch(`${API_BASE}/api/public/chat/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success && data.output !== undefined) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.output as Record<string, unknown>,
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

  if (infoLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!info?.hasWebhookTrigger) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Chat not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workflow doesn&apos;t support chat. It needs a Webhook trigger. Add a Webhook
            trigger in the workflow editor to enable this shareable chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
            <Bot className="h-4 w-4 text-foreground/70" />
          </div>
          <div>
            <h1 className="text-sm font-medium">Verxio</h1>
            <p className="text-[11px] leading-none text-muted-foreground">
              {info.workflowName ? `${info.workflowName} · Public chat` : "Public chat"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto max-w-2xl py-4 space-y-5">
          {messages.length === 0 && (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-base font-medium">What would you like to run?</p>
              <p className="text-sm text-muted-foreground">
                Send a message (or media) to trigger this workflow.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}
            >
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
                    : "flex-1 min-w-0"
                )}
              >
                {msg.media && (
                  <div className="mb-2 flex flex-col gap-2">
                    {msg.media.image && (
                      <img
                        src={msg.media.image}
                        alt="Attachment"
                        className="max-h-60 rounded-lg border object-cover"
                      />
                    )}
                    {msg.media.video && (
                      <video
                        src={msg.media.video}
                        controls
                        className="max-h-60 rounded-lg border"
                        preload="metadata"
                      />
                    )}
                    {msg.media.audio && (
                      <audio src={msg.media.audio} controls className="w-full" preload="metadata" />
                    )}
                  </div>
                )}

                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-xs [&_code]:text-xs [&_p]:text-sm [&_li]:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {formatOutput(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {typeof msg.content === "string"
                      ? msg.content === "(attachment)" && msg.media
                        ? ""
                        : msg.content
                      : formatOutput(msg.content)}
                  </p>
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
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="border-t bg-card px-4 py-3 sm:px-6">
        {(pendingMedia.image || pendingMedia.video || pendingMedia.audio) && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-1.5">
            {pendingMedia.image && (
              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px]">
                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                Image
                <button
                  type="button"
                  onClick={() => removePendingMedia("image")}
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {pendingMedia.video && (
              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px]">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Video
                <button
                  type="button"
                  onClick={() => removePendingMedia("video")}
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove video"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {pendingMedia.audio && (
              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px]">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Audio
                <button
                  type="button"
                  onClick={() => removePendingMedia("audio")}
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove audio"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
        {uploadError && (
          <p className="mx-auto mb-2 max-w-2xl text-center text-xs text-destructive">
            {uploadError}
          </p>
        )}
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
            accept={ACCEPT_MEDIA}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading || sending}
          />
          <div className="relative flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              title="Attach image, video, or audio"
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
              placeholder="Type a message or attach image, video, audio..."
              disabled={sending}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || (!input.trim() && !hasPendingMedia)}
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
          Powered by Verxio
        </p>
      </footer>
    </div>
  );
}
