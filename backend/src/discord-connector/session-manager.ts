/**
 * Discord Connector session manager.
 * Manages discord.js Client instances per integration.
 */
import { Client, GatewayIntentBits, Events, Message, TextChannel, ThreadChannel } from "discord.js";
import type { IncomingDiscordEvent, SendDiscordResponse } from "./types";

export type OnIncomingCallback = (event: IncomingDiscordEvent) => Promise<void>;

interface SessionInfo {
  integrationId: string;
  client: Client;
  botUserId?: string;
}

const sessions = new Map<string, SessionInfo>();

/**
 * Start a Discord bot session for an integration.
 */
export async function startSession(
  integrationId: string,
  botToken: string,
  onIncoming: OnIncomingCallback
): Promise<{ status: string }> {
  // Stop existing session if any
  if (sessions.has(integrationId)) {
    await stopSession(integrationId);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Discord login timeout")), 30000);

    client.once(Events.ClientReady, () => {
      clearTimeout(timeout);
      const info = sessions.get(integrationId);
      if (info) {
        info.botUserId = client.user?.id;
      }
      console.log(`[Discord Connector] Bot ready: ${client.user?.tag} for integration ${integrationId}`);
      resolve();
    });

    client.once(Events.Error, (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  sessions.set(integrationId, { integrationId, client });

  // Listen for messages
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bot's own messages
    if (message.author.bot) return;
    if (message.author.id === client.user?.id) return;

    const isMentioned = message.mentions.has(client.user!);
    const isThread = message.channel.isThread();

    // Process if: bot is mentioned, OR message is inside a thread (conversation continuity)
    if (!isMentioned && !isThread) return;

    // Strip bot mention from message content
    let content = message.content;
    if (client.user) {
      content = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    }

    if (!content) return; // Empty after stripping mention

    const event: IncomingDiscordEvent = {
      integrationId,
      message: content,
      authorId: message.author.id,
      authorName: message.author.username,
      channelId: message.channel.isThread() ? (message.channel as ThreadChannel).parentId || message.channelId : message.channelId,
      guildId: message.guildId || "",
      threadId: isThread ? message.channelId : undefined,
      messageId: message.id,
    };

    try {
      await onIncoming(event);
    } catch (err) {
      console.error("[Discord Connector] onIncoming error:", err);
    }
  });

  // Login
  await client.login(botToken);
  await readyPromise;

  return { status: "connected" };
}

/**
 * Stop a Discord bot session.
 */
export async function stopSession(integrationId: string): Promise<void> {
  const info = sessions.get(integrationId);
  if (!info) return;
  try {
    info.client.destroy();
  } catch (_) {}
  sessions.delete(integrationId);
  console.log(`[Discord Connector] Session stopped for integration ${integrationId}`);
}

/**
 * Send a message to a Discord channel.
 */
export async function sendMessage(
  integrationId: string,
  channelId: string,
  text: string
): Promise<SendDiscordResponse> {
  const info = sessions.get(integrationId);
  if (!info) {
    return { success: false, error: `No active session for integration ${integrationId}` };
  }

  try {
    const channel = await info.client.channels.fetch(channelId);
    if (!channel) {
      return { success: false, error: `Channel ${channelId} not found` };
    }
    if (!("send" in channel)) {
      return { success: false, error: `Channel ${channelId} is not a text channel` };
    }
    const sent = await (channel as TextChannel | ThreadChannel).send(text);
    return { success: true, messageId: sent.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Get session status for an integration.
 */
export function getSessionStatus(integrationId: string): {
  status: string;
  guildCount?: number;
  botUserId?: string;
} | null {
  const info = sessions.get(integrationId);
  if (!info) return null;

  const isReady = info.client.isReady();
  return {
    status: isReady ? "connected" : "connecting",
    guildCount: info.client.guilds?.cache?.size,
    botUserId: info.botUserId,
  };
}

/**
 * List all active sessions.
 */
export function listSessions(): string[] {
  return Array.from(sessions.keys());
}
