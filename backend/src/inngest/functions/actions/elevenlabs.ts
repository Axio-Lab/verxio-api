import type { NodeExecutor } from "../types";
import { elevenlabsChannel } from "@/inngest/channels/elevenlabs";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import FormData from "form-data";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createId } from "@paralleldrive/cuid2";
import { audioStore } from "@/routes/elevenlabs";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type ElevenLabsData = {
  variables?: string;
  action?: "textToSpeech" | "speechToText" | "cloneVoice" | "listVoices" | "getVoice";

  // For textToSpeech:
  text?: string;
  voiceId?: string;
  model?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5" | "eleven_v3";
  language?: string; // Used for both textToSpeech and speechToText
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  // For speechToText:
  audioUrl?: string; // Used for both speechToText and cloneVoice
  speakerDiarization?: boolean;
  entityDetection?: boolean;
  // For cloneVoice:
  voiceName?: string;
  description?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    elevenlabsChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to compile template strings
const compileTemplate = (template: string, context: Record<string, unknown> = {}): string => {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(context);
  } catch (error) {
    throw new NonRetriableError(
      `Template compilation error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// Helper to check if value is FormData (browser or Node.js)
const isFormData = (value: any): boolean => {
  return (
    value instanceof FormData ||
    (typeof value === "object" &&
      value !== null &&
      "append" in value &&
      typeof value.append === "function")
  );
};

// Helper to make ElevenLabs API request
const elevenlabsRequest = async (
  url: string,
  apiKey: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown> | any
): Promise<any> => {
  const headers: Record<string, string> = {
    "xi-api-key": apiKey,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (isFormData(body)) {
      // For FormData, don't set Content-Type - let fetch set it with boundary
      // form-data package will set the proper headers
      options.body = body as any;
    } else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  } else {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
    let parsedError: any = null;

    try {
      parsedError = JSON.parse(errorText);
      if (parsedError.detail?.message) {
        errorMessage = parsedError.detail.message;
      } else if (parsedError.message) {
        errorMessage = parsedError.message;
      }
    } catch {
      if (errorText && errorText.trim()) {
        errorMessage = errorText.trim();
      }
    }

    // Log the actual error for debugging
    console.error(`[ElevenLabs API Error] Status: ${response.status}, URL: ${url}`);
    console.error(`[ElevenLabs API Error] Response:`, parsedError || errorText);

    // Only use generic messages if we don't have a detailed error from the API
    if (response.status === 401) {
      // Check for specific error types from ElevenLabs
      if (parsedError?.detail?.status === "detected_unusual_activity") {
        errorMessage = `ElevenLabs detected unusual activity: ${parsedError.detail.message || errorMessage}. Please use a paid subscription API key.`;
      } else if (parsedError?.detail?.message?.includes("missing the permission")) {
        // Keep the permission error message
        errorMessage = parsedError.detail.message;
      } else if (!parsedError || !parsedError.detail?.message) {
        // Only use generic message if we don't have details
        errorMessage = `ElevenLabs authentication failed. Please check your API key is valid. Original error: ${errorMessage}`;
      }
      // Otherwise, keep the detailed error message from the API
    } else if (response.status === 429) {
      if (!parsedError || !parsedError.detail?.message) {
        errorMessage = "ElevenLabs rate limit exceeded. Please try again later.";
      }
    } else if (response.status === 422) {
      if (!parsedError || !parsedError.detail?.message) {
        errorMessage =
          "ElevenLabs API validation error. The audio URL may be invalid or the file format is not supported. Please ensure you provide a direct audio file URL (e.g., .mp3, .wav, .m4a). YouTube or video URLs are not supported directly.";
      }
    }

    throw new NonRetriableError(errorMessage);
  }

  // Handle different response types
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  } else if (contentType?.includes("audio")) {
    // Return audio as base64 or URL
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      audio: base64,
      contentType: contentType,
      size: arrayBuffer.byteLength,
    };
  } else {
    return await response.text();
  }
};

export const elevenlabsExecutor: NodeExecutor<ElevenLabsData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    // Check subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "ELEVENLABS");

    // Consume premium quota once per workflow run (inside step.run so Inngest memoizes across resumes)
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`elevenlabs-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.DEFAULT_PREMIUM_NODE);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await publish(
        elevenlabsChannel().output({
          nodeId,
          output: {
            ...context,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }

    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "elevenlabs";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("ElevenLabs node: Action is required");
      await publish(
        elevenlabsChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

    if (!apiKey || apiKey.length === 0) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "ElevenLabs node: ELEVENLABS_API_KEY environment variable is not set. Please configure it in your environment."
      );
      await publish(
        elevenlabsChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }
    let result: any;

    // Execute action
    switch (data.action) {
      case "textToSpeech": {
        if (!data.text) {
          throw new NonRetriableError("ElevenLabs node: Text is required for textToSpeech");
        }

        if (!data.voiceId) {
          throw new NonRetriableError("ElevenLabs node: Voice ID is required for textToSpeech");
        }

        const text = compileTemplate(data.text, context);
        const model = data.model || "eleven_multilingual_v2";
        const voiceId = compileTemplate(data.voiceId, context);

        result = await step.run("text-to-speech", async () => {
          const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
          const requestBody: Record<string, unknown> = {
            text,
            model_id: model,
            voice_settings: {
              stability: data.stability ?? 0.5,
              similarity_boost: data.similarityBoost ?? 0.75,
              style: data.style ?? 0.0,
              use_speaker_boost: data.speakerBoost ?? true,
            },
          };

          if (data.language) {
            requestBody.language_code = compileTemplate(data.language, context);
          }

          const audioResponse = await elevenlabsRequest(url, apiKey, "POST", requestBody);

          // Store audio in temporary store and generate download URL
          const audioId = createId();
          const baseUrl = process.env.API_URL;
          const expiresIn = 24 * 60 * 60 * 1000; // 24 hours
          const contentType = audioResponse.contentType || "audio/mpeg";

          audioStore.set(audioId, {
            base64: audioResponse.audio,
            contentType: contentType,
            expiresAt: Date.now() + expiresIn,
          });

          const audioUrl = `${baseUrl}/api/elevenlabs/audio/${audioId}`;
          const downloadUrl = `${audioUrl}?download=true`;
          const dataUrl = `data:${contentType};base64,${audioResponse.audio}`;

          return {
            audio: audioResponse.audio, // Keep base64 for backward compatibility
            audioUrl: audioUrl, // Stream URL (for playback in browser)
            downloadUrl: downloadUrl, // Download URL (forces download)
            dataUrl: dataUrl, // Data URL (for direct use in <audio> tag or download)
            contentType: contentType,
            size: audioResponse.size,
            voiceId,
            model,
            textLength: text.length,
            warning:
              "File download URLs expire in 10 minutes. Please download or save the audio file promptly.",
          };
        });
        break;
      }

      case "speechToText": {
        if (!data.audioUrl) {
          throw new NonRetriableError("ElevenLabs node: Audio URL is required for speechToText");
        }

        const audioUrl = compileTemplate(data.audioUrl, context);

        // Validate that the URL is not a video platform URL
        const videoPlatformPatterns = [
          /youtube\.com|youtu\.be/i,
          /vimeo\.com/i,
          /dailymotion\.com/i,
          /tiktok\.com/i,
          /instagram\.com/i,
        ];

        const isVideoUrl = videoPlatformPatterns.some((pattern) => pattern.test(audioUrl));
        if (isVideoUrl) {
          throw new NonRetriableError(
            "ElevenLabs speech-to-text requires a direct audio file URL (e.g., .mp3, .wav, .m4a). " +
              "Video platform URLs (YouTube, Vimeo, etc.) are not supported. " +
              "Please convert the video to an audio file first and provide a direct download URL."
          );
        }

        result = await step.run("speech-to-text", async () => {
          // Initialize ElevenLabs client with API key
          const elevenlabs = new ElevenLabsClient({
            apiKey: apiKey,
          });

          // Fetch the audio file from URL
          let audioResponse: Response;
          try {
            audioResponse = await fetch(audioUrl);
          } catch (error) {
            throw new NonRetriableError(
              `Failed to download audio from URL: ${error instanceof Error ? error.message : String(error)}. ` +
                "Please ensure the URL is accessible and points to a valid audio file."
            );
          }

          if (!audioResponse.ok) {
            throw new NonRetriableError(
              `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}. ` +
                "Please ensure the URL is accessible and points to a valid audio file."
            );
          }

          // Check if the response is actually an audio file
          const contentType = audioResponse.headers.get("content-type") || "";
          const isAudioFile =
            contentType.includes("audio") ||
            audioUrl.match(/\.(mp3|wav|m4a|ogg|flac|aac|webm)(\?|$)/i);

          if (!isAudioFile && !contentType.includes("application/octet-stream")) {
            throw new NonRetriableError(
              `The URL does not appear to be an audio file. Content-Type: ${contentType || "unknown"}. ` +
                "Please provide a direct URL to an audio file (e.g., .mp3, .wav, .m4a)."
            );
          }

          // Create a Blob from the audio response (matching the example)
          const arrayBuffer = await audioResponse.arrayBuffer();
          const audioBlob = new Blob([arrayBuffer], {
            type: contentType || "audio/mp3",
          });

          // Prepare language code - convert to format expected by SDK (e.g., "eng" for "en")
          let languageCode: string | null = null;
          if (data.language) {
            const lang = compileTemplate(data.language, context).trim();
            // Map common language codes to ElevenLabs format
            const langMap: Record<string, string> = {
              en: "eng",
              es: "spa",
              fr: "fra",
              de: "deu",
              it: "ita",
              pt: "por",
              ja: "jpn",
              ko: "kor",
              zh: "zho",
            };
            languageCode = langMap[lang.toLowerCase()] || lang;
          }

          // Use SDK exactly as shown in the example
          const transcription = await elevenlabs.speechToText.convert({
            file: audioBlob,
            modelId: "scribe_v2",
            tagAudioEvents: data.entityDetection ?? true, // Tag audio events like laughter, applause, etc.
            languageCode: languageCode as any, // Language of the audio file. If set to null, the model will detect the language automatically.
            diarize: data.speakerDiarization ?? true, // Whether to annotate who is speaking
          });

          return {
            text: transcription,
          };
        });
        break;
      }

      case "cloneVoice": {
        if (!data.audioUrl) {
          throw new NonRetriableError("ElevenLabs node: Audio URL is required for cloneVoice");
        }

        if (!data.voiceName) {
          throw new NonRetriableError("ElevenLabs node: Voice name is required for cloneVoice");
        }

        const audioUrl = compileTemplate(data.audioUrl, context);
        const voiceName = compileTemplate(data.voiceName, context);
        const description = data.description
          ? compileTemplate(data.description, context)
          : undefined;

        result = await step.run("clone-voice", async () => {
          // Initialize ElevenLabs client with API key
          const elevenlabs = new ElevenLabsClient({
            apiKey: apiKey,
          });

          // Fetch the audio file from URL
          let audioResponse: Response;
          try {
            audioResponse = await fetch(audioUrl);
          } catch (error) {
            throw new NonRetriableError(
              `Failed to download audio from URL: ${error instanceof Error ? error.message : String(error)}. ` +
                "Please ensure the URL is accessible and points to a valid audio file."
            );
          }

          if (!audioResponse.ok) {
            throw new NonRetriableError(
              `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}. ` +
                "Please ensure the URL is accessible and points to a valid audio file."
            );
          }

          // Check if the response is actually an audio file
          const contentType = audioResponse.headers.get("content-type") || "";
          const isAudioFile =
            contentType.includes("audio") ||
            audioUrl.match(/\.(mp3|wav|m4a|ogg|flac|aac|webm)(\?|$)/i);

          if (!isAudioFile && !contentType.includes("application/octet-stream")) {
            throw new NonRetriableError(
              `The URL does not appear to be an audio file. Content-Type: ${contentType || "unknown"}. ` +
                "Please provide a direct URL to an audio file (e.g., .mp3, .wav, .m4a)."
            );
          }

          // Create a Blob from the audio response (matching the SDK pattern)
          const arrayBuffer = await audioResponse.arrayBuffer();
          const audioBlob = new Blob([arrayBuffer], {
            type: contentType || "audio/mpeg",
          });

          // The SDK accepts Blob or File objects for the files array
          try {
            const voice = await elevenlabs.voices.ivc.create({
              name: voiceName,
              // The more files you add, the better the clone will be
              files: [audioBlob],
              ...(description && { description }),
            });

            // The SDK returns AddVoiceIvcResponseModel with voiceId property
            return {
              voiceId: voice.voiceId,
              voiceName: voiceName, // Use the provided name since response may not include it
              description: description || undefined,
              status: "ready",
            };
          } catch (error: any) {
            // Handle ElevenLabs SDK errors
            if (error instanceof Error) {
              throw new NonRetriableError(
                `Failed to create voice clone: ${error.message}. ` +
                  "Please ensure your API key has the necessary permissions and the audio file is valid."
              );
            }
            throw error;
          }
        });
        break;
      }

      case "listVoices": {
        result = await step.run("list-voices", async () => {
          const url = "https://api.elevenlabs.io/v1/voices";
          const voicesResponse = await elevenlabsRequest(url, apiKey, "GET");

          return {
            voices: voicesResponse.voices || [],
            count: voicesResponse.voices?.length || 0,
          };
        });
        break;
      }

      case "getVoice": {
        if (!data.voiceId) {
          throw new NonRetriableError("ElevenLabs node: Voice ID is required for getVoice");
        }

        const voiceId = compileTemplate(data.voiceId, context);

        result = await step.run("get-voice", async () => {
          const url = `https://api.elevenlabs.io/v1/voices/${voiceId}`;
          const voiceResponse = await elevenlabsRequest(url, apiKey, "GET");

          return {
            voiceId: voiceResponse.voice_id,
            name: voiceResponse.name,
            description: voiceResponse.description,
            category: voiceResponse.category,
            settings: voiceResponse.settings,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`ElevenLabs node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      elevenlabsChannel().output({
        nodeId,
        output: {
          ...context,
          [variablesName]: result,
        },
      })
    );

    return {
      ...context,
      [variablesName]: result,
    };
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    const errorMessage = error instanceof Error ? error.message : String(error);
    await publish(
      elevenlabsChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: errorMessage,
          },
        },
      })
    );
    throw error;
  }
};
