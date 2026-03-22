import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export interface TaskChannel {
  id: string;
  userId: string;
  label: string;
  platform: string;
  status: string;
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  slackBotToken?: string | null;
  slackSigningSecret?: string | null;
  slackTeamId?: string | null;
  discordBotToken?: string | null;
  discordGuildId?: string | null;
  discordChannelId?: string | null;
  whatsappSessionId?: string | null;
  webhookUrl?: string | null;
  createdAt: string;
}

export function useTaskChannels() {
  return useProtectedQuery<{ channels: TaskChannel[] }>({
    queryKey: ["task-channels"],
    queryFn: () => authenticatedGet<{ channels: TaskChannel[] }>("/api/task-channels"),
  });
}

export function useCreateTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { success: boolean; channel: TaskChannel },
    Error,
    { platform: string; label: string }
  >({
    mutationFn: ({ platform, label }) =>
      authenticatedPost<{ success: boolean; channel: TaskChannel }>("/api/task-channels", {
        platform,
        label,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Task channel created");
    },
    onError: (err) => toast.error(err.message || "Failed to create task channel"),
  });
}

export function useDeleteTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => authenticatedDelete<{ success: boolean }>(`/api/task-channels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Task channel deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete task channel"),
  });
}

export function useUpdateTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { success: boolean; channel: TaskChannel },
    Error,
    { channelId: string; label?: string; status?: string }
  >({
    mutationFn: ({ channelId, label, status }) =>
      authenticatedPatch<{ success: boolean; channel: TaskChannel }>(
        `/api/task-channels/${channelId}`,
        {
          label,
          status,
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Task channel updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update task channel"),
  });
}

export function useDisconnectTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<{ success: boolean; channel: TaskChannel }, Error, string>({
    mutationFn: (channelId) =>
      authenticatedPost<{ success: boolean; channel: TaskChannel }>(
        `/api/task-channels/${channelId}/disconnect`,
        {}
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Disconnected — you can connect again.");
    },
    onError: (err) => toast.error(err.message || "Failed to disconnect"),
  });
}

export function useConnectTelegramTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { success: boolean; channel: TaskChannel },
    Error,
    { channelId: string; botToken: string }
  >({
    mutationFn: ({ channelId, botToken }) =>
      authenticatedPost<{ success: boolean; channel: TaskChannel }>(
        `/api/task-channels/${channelId}/telegram/connect`,
        { botToken }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Telegram bot connected to task channel");
    },
    onError: (err) => toast.error(err.message || "Failed to connect Telegram bot"),
  });
}

export function useConnectWhatsAppTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { sessionId: string; status: string; qr?: string },
    Error,
    { channelId: string }
  >({
    mutationFn: ({ channelId }) =>
      authenticatedPost<{ sessionId: string; status: string; qr?: string }>(
        `/api/task-channels/${channelId}/whatsapp/connect`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
    },
    onError: (err) => toast.error(err.message || "Failed to start WhatsApp connection"),
  });
}

export function useWhatsAppTaskChannelStatus(channelId: string | null) {
  return useProtectedQuery<{ status: string; qr?: string }>({
    queryKey: ["task-channels", channelId, "whatsapp-status"],
    queryFn: () =>
      authenticatedGet<{ status: string; qr?: string }>(
        `/api/task-channels/${channelId}/whatsapp/status`
      ),
    enabled: !!channelId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "qr_ready" ? 3000 : false;
    },
  });
}

export function useConnectSlackTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { success: boolean; channel: TaskChannel },
    Error,
    { channelId: string; slackBotToken: string; slackSigningSecret: string }
  >({
    mutationFn: ({ channelId, slackBotToken, slackSigningSecret }) =>
      authenticatedPost<{ success: boolean; channel: TaskChannel }>(
        `/api/task-channels/${channelId}/slack/connect`,
        { slackBotToken, slackSigningSecret }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Slack bot connected to task channel");
    },
    onError: (err) => toast.error(err.message || "Failed to connect Slack bot"),
  });
}

export function useConnectDiscordTaskChannel() {
  const qc = useQueryClient();
  return useProtectedMutation<
    { success: boolean; channel: TaskChannel },
    Error,
    {
      channelId: string;
      discordBotToken: string;
      discordGuildId?: string;
      discordChannelId?: string;
    }
  >({
    mutationFn: ({ channelId, discordBotToken, discordGuildId, discordChannelId }) =>
      authenticatedPost<{ success: boolean; channel: TaskChannel }>(
        `/api/task-channels/${channelId}/discord/connect`,
        { discordBotToken, discordGuildId, discordChannelId }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Discord bot connected to task channel");
    },
    onError: (err) => toast.error(err.message || "Failed to connect Discord bot"),
  });
}
