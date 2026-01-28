"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, Paperclip, Send, X } from "lucide-react";

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
      { role: "user", content: text || "(attachment)", media: hasPendingMedia ? media : undefined },
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
          { role: "assistant", content: data.output as Record<string, unknown> },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || data.message || "Something went wrong.",
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Failed to send message.",
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
        <h1 className="text-sm font-medium text-muted-foreground">
          {info.workflowName ? `${info.workflowName} · Chat` : "Chat"}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Send a message to run the workflow. No sign-in required.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-4 py-3 space-y-2",
                msg.role === "user"
                  ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                  : "mr-auto max-w-[85%] bg-card border text-foreground"
              )}
            >
              {msg.role === "user" && msg.media && (
                <div className="flex flex-col gap-2">
                  {msg.media.image && (
                    <img
                      src={msg.media.image}
                      alt="Attachment"
                      className="max-h-48 rounded object-cover"
                    />
                  )}
                  {msg.media.video && (
                    <video
                      src={msg.media.video}
                      controls
                      className="max-h-48 rounded"
                      preload="metadata"
                    />
                  )}
                  {msg.media.audio && (
                    <audio src={msg.media.audio} controls className="w-full" preload="metadata" />
                  )}
                </div>
              )}
              <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                {typeof msg.content === "string"
                  ? msg.content === "(attachment)" && msg.media
                    ? ""
                    : msg.content
                  : formatOutput(msg.content)}
              </pre>
            </div>
          ))}
          {sending && (
            <div className="mr-auto max-w-[85%] rounded-lg border bg-card px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <footer className="border-t bg-card p-4">
        {(pendingMedia.image || pendingMedia.video || pendingMedia.audio) && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
            {pendingMedia.image && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                Image
                <button
                  type="button"
                  onClick={() => removePendingMedia("image")}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {pendingMedia.video && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                Video
                <button
                  type="button"
                  onClick={() => removePendingMedia("video")}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label="Remove video"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {pendingMedia.audio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                Audio
                <button
                  type="button"
                  onClick={() => removePendingMedia("audio")}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
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
          className="mx-auto flex max-w-2xl gap-2"
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading || sending}
            onClick={() => fileInputRef.current?.click()}
            title="Attach image, video, or audio"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or attach image, video, audio..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || (!input.trim() && !hasPendingMedia)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">
          Powered by Verxio
        </p>
      </footer>
    </div>
  );
}
