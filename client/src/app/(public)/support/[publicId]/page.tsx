"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, Bot, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type SupportAgentInfo = {
  success: boolean;
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
        if (!cancelled) {
          setAgentInfo(data);
          // Seed greeting as first assistant message
          if (data.success && data.greeting && !messages.length) {
            const now = new Date().toISOString();
            setMessages([
              {
                role: "assistant",
                content: data.greeting,
                timestamp: now,
              },
            ]);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAgentInfo({ success: false });
        }
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !publicId || !API_BASE || sending || !sessionId) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/support-chat/${publicId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();

      if (data.success && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply as string,
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

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
            <Bot className="h-4 w-4 text-foreground/70" />
          </div>
          <div>
            <h1 className="text-sm font-medium">
              {agentInfo?.success && agentInfo.name ? agentInfo.name : "Verxio Support"}
            </h1>
            <p className="text-[11px] leading-none text-muted-foreground">24/7 Customer Support</p>
          </div>
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
                    : "flex-1 min-w-0"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-xs [&_code]:text-xs [&_p]:text-sm [&_li]:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
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
        <form
          className="mx-auto max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="relative flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
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
              placeholder="Type a message..."
              disabled={sending}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
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
