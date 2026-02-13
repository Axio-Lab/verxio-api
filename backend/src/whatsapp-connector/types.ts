/**
 * Normalized WhatsApp payload shape for trigger node and chat integration.
 * Connector maps Baileys messages.upsert to this shape before sending to backend.
 */
export interface WhatsAppPayload {
  from: string; // Sender phone number (digits only, no @s.whatsapp.net)
  to: string; // Recipient phone number (digits only)
  body: string;
  messageId: string;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "unknown";
  media?: {
    url?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
  };
  timestamp: number;
  isGroup: boolean;
  /** True when the message was sent by the connected number (owner). */
  fromMe?: boolean;
  pushName?: string;
  participant?: string; // For group messages, the sender JID
  mentionedJid?: string[]; // JIDs mentioned via @ in the message
  groupJid?: string; // Raw group JID (e.g. "123456@g.us") when isGroup=true
}

export interface IncomingWhatsAppEvent {
  sessionId: string;
  integrationId?: string;
  credentialId?: string;
  payload: WhatsAppPayload;
  botJid?: string; // The connected account's own JID (for group mention detection)
}

export interface SendWhatsAppRequest {
  sessionRef: string; // sessionId | integrationId | credentialId
  toJid: string;
  text: string;
  media?: { url: string; mimetype?: string; caption?: string };
}

export interface SendWhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
