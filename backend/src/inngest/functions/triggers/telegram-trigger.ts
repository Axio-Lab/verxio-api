import type { NodeExecutor } from "../types";
import { telegramTriggerChannel } from "@/inngest/channels/telegram-trigger";
import { NonRetriableError } from "inngest";

type TelegramTriggerData = Record<string, unknown>;

// Helper to detect message type
const detectMessageType = (message: any): string => {
  if (!message) return "unknown";
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.audio) return "audio";
  if (message.voice) return "voice";
  if (message.video_note) return "video_note";
  if (message.document) return "document";
  if (message.sticker) return "sticker";
  if (message.animation) return "animation";
  if (message.location) return "location";
  if (message.contact) return "contact";
  if (message.poll) return "poll";
  if (message.text) return "text";
  return "unknown";
};

// Helper to extract media info
const extractMediaInfo = (message: any): any => {
  if (!message) return null;

  const messageType = detectMessageType(message);

  switch (messageType) {
    case "photo":
      // Photo is an array of sizes, get the largest
      const largestPhoto = message.photo[message.photo.length - 1];
      return {
        type: "photo",
        fileId: largestPhoto.file_id,
        fileUniqueId: largestPhoto.file_unique_id,
        width: largestPhoto.width,
        height: largestPhoto.height,
        fileSize: largestPhoto.file_size,
        caption: message.caption || null,
        allSizes: message.photo,
      };
    case "video":
      return {
        type: "video",
        fileId: message.video.file_id,
        fileUniqueId: message.video.file_unique_id,
        width: message.video.width,
        height: message.video.height,
        duration: message.video.duration,
        fileName: message.video.file_name,
        mimeType: message.video.mime_type,
        fileSize: message.video.file_size,
        caption: message.caption || null,
        thumbnail: message.video.thumbnail,
      };
    case "audio":
      return {
        type: "audio",
        fileId: message.audio.file_id,
        fileUniqueId: message.audio.file_unique_id,
        duration: message.audio.duration,
        performer: message.audio.performer,
        title: message.audio.title,
        fileName: message.audio.file_name,
        mimeType: message.audio.mime_type,
        fileSize: message.audio.file_size,
        caption: message.caption || null,
      };
    case "voice":
      return {
        type: "voice",
        fileId: message.voice.file_id,
        fileUniqueId: message.voice.file_unique_id,
        duration: message.voice.duration,
        mimeType: message.voice.mime_type,
        fileSize: message.voice.file_size,
      };
    case "video_note":
      return {
        type: "video_note",
        fileId: message.video_note.file_id,
        fileUniqueId: message.video_note.file_unique_id,
        length: message.video_note.length,
        duration: message.video_note.duration,
        fileSize: message.video_note.file_size,
        thumbnail: message.video_note.thumbnail,
      };
    case "document":
      return {
        type: "document",
        fileId: message.document.file_id,
        fileUniqueId: message.document.file_unique_id,
        fileName: message.document.file_name,
        mimeType: message.document.mime_type,
        fileSize: message.document.file_size,
        caption: message.caption || null,
        thumbnail: message.document.thumbnail,
      };
    case "sticker":
      return {
        type: "sticker",
        fileId: message.sticker.file_id,
        fileUniqueId: message.sticker.file_unique_id,
        width: message.sticker.width,
        height: message.sticker.height,
        isAnimated: message.sticker.is_animated,
        isVideo: message.sticker.is_video,
        emoji: message.sticker.emoji,
        setName: message.sticker.set_name,
      };
    case "animation":
      return {
        type: "animation",
        fileId: message.animation.file_id,
        fileUniqueId: message.animation.file_unique_id,
        width: message.animation.width,
        height: message.animation.height,
        duration: message.animation.duration,
        fileName: message.animation.file_name,
        mimeType: message.animation.mime_type,
        fileSize: message.animation.file_size,
        caption: message.caption || null,
      };
    case "location":
      return {
        type: "location",
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        horizontalAccuracy: message.location.horizontal_accuracy,
      };
    case "contact":
      return {
        type: "contact",
        phoneNumber: message.contact.phone_number,
        firstName: message.contact.first_name,
        lastName: message.contact.last_name,
        userId: message.contact.user_id,
        vcard: message.contact.vcard,
      };
    default:
      return null;
  }
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    telegramTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const telegramTriggerExecutor: NodeExecutor<TelegramTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // Telegram trigger receives data from Telegram webhook
    // The context should contain telegramPayload from the webhook/route
    // Extract message data and make it available to subsequent nodes
    const result = await step.run("telegram-trigger", async () => {
      // Extract Telegram payload from context (set by webhook/route)
      const telegramPayload = (context as any).telegramPayload || {};
      const message = telegramPayload.message || {};

      // Detect message type and extract media info
      const messageType = detectMessageType(message);
      const media = extractMediaInfo(message);

      // Make message data available in context for subsequent nodes
      // Variable name is always "telegram" for consistency
      const variableName = "telegram";

      return {
        ...context,
        [variableName]: {
          // Full payload for advanced use
          payload: telegramPayload,
          // Message object
          message: {
            id: message.message_id,
            text: message.text || message.caption || null,
            date: message.date,
            // Message type detection
            type: messageType,
            // For text messages
            entities: message.entities || [],
          },
          // Chat info
          chat: {
            id: message.chat?.id,
            type: message.chat?.type,
            title: message.chat?.title,
            username: message.chat?.username,
            firstName: message.chat?.first_name,
            lastName: message.chat?.last_name,
          },
          // Sender info
          from: {
            id: message.from?.id,
            isBot: message.from?.is_bot,
            firstName: message.from?.first_name,
            lastName: message.from?.last_name,
            username: message.from?.username,
            languageCode: message.from?.language_code,
          },
          // Media information (if any)
          media: media,
          // Helper flags
          hasMedia: media !== null,
          isPhoto: messageType === "photo",
          isVideo: messageType === "video",
          isAudio: messageType === "audio",
          isVoice: messageType === "voice",
          isDocument: messageType === "document",
          isSticker: messageType === "sticker",
          isLocation: messageType === "location",
        },
      };
    });

    // Publish success status before returning
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      telegramTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      telegramTriggerChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      })
    );

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `Telegram trigger failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
