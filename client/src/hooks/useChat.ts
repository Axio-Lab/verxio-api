"use client";

import { useState, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  toolCalls?: ToolActivity[];
}

export interface ToolActivity {
  name: string;
  status: "running" | "done" | "error";
  input?: Record<string, unknown>;
  result?: unknown;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolActivity[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/chat/history`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: m.timestamp,
          }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/api/chat/history`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      setMessages([]);
    } catch {
      // silent
    }
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      attachments?: Array<{
        fileId: string;
        fileName: string;
        fileType: string;
        extractedText?: string;
      }>
    ) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setActiveTools([]);

      const controller = new AbortController();
      abortRef.current = controller;

      let assistantText = "";
      const toolActivities: ToolActivity[] = [];

      setMessages((prev) => [...prev, { role: "assistant", content: "", toolCalls: [] }]);

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/chat/message/stream`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            message: text.trim(),
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const event = JSON.parse(jsonStr);

                if (event.type === "message" && event.data?.text && !event.data.partial) {
                  assistantText += event.data.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: assistantText,
                        toolCalls: [...toolActivities],
                      };
                    }
                    return updated;
                  });
                }

                if (event.type === "tool_use" && event.data?.name) {
                  const activity: ToolActivity = {
                    name: event.data.name,
                    status: "running",
                    input: event.data.input,
                  };
                  toolActivities.push(activity);
                  setActiveTools([...toolActivities]);
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        toolCalls: [...toolActivities],
                      };
                    }
                    return updated;
                  });
                }

                if (event.type === "tool_result") {
                  const lastTool = toolActivities[toolActivities.length - 1];
                  if (lastTool) {
                    lastTool.status = "done";
                    lastTool.result = event.data;
                  }
                  setActiveTools([...toolActivities]);
                }

                if (event.type === "result" && event.data?.result) {
                  assistantText = event.data.result;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: assistantText,
                        toolCalls: [...toolActivities],
                      };
                    }
                    return updated;
                  });
                }

                if (event.type === "error") {
                  assistantText =
                    assistantText || `Error: ${event.data || event.error || "Unknown error"}`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: assistantText,
                      };
                    }
                    return updated;
                  });
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: `Error: ${err.message || "Something went wrong"}`,
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        setActiveTools([]);
        abortRef.current = null;
      }
    },
    [isStreaming]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    activeTools,
    sendMessage,
    loadHistory,
    clearHistory,
    stopStreaming,
  };
}
