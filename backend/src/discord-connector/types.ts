/**
 * Discord Connector types.
 */

export interface IncomingDiscordEvent {
  integrationId: string;
  message: string;
  authorId: string;
  authorName: string;
  channelId: string;
  guildId: string;
  threadId?: string;
  messageId?: string;
}

export interface SendDiscordRequest {
  integrationId: string;
  channelId: string;
  text: string;
  threadId?: string;
}

export interface SendDiscordResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ConnectRequest {
  integrationId: string;
  botToken: string;
}

export interface DisconnectRequest {
  integrationId: string;
}
