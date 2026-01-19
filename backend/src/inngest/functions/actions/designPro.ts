import type { NodeExecutor } from "../types";
import { designProChannel } from "@/inngest/channels/designPro";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  generateImage,
  editImage,
  createImageChat,
  sendChatMessage,
  editImageWithReferences,
  type AspectRatio,
  type ImageSize,
  type TemplateType,
  type ReferenceImage,
  DESIGN_TEMPLATES,
} from "@/services/geminiImageService";
import { saveImageToDisk } from "@/lib/imageStorage";

type DesignProData = {
  variables?: string;
  prompt?: string; // JSON format
  mode?: "generate" | "edit" | "chat" | "editWithReferences";
  model?: string; // Default: gemini-3-pro-image-preview
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize; // 1K, 2K, 4K
  template?: TemplateType;

  // For edit mode
  sourceImage?: string; // URL, base64, or {{previousNode.imageUrl}}
  sourceImageMimeType?: string;

  // For chat mode
  chatId?: string; // For continuing existing chat (stored in context)
  conversationHistory?: Array<{ role: string; content: string }>;

  // For reference images
  referenceImages?: Array<{
    image: string; // URL, base64, or {{node.imageUrl}}
    mimeType?: string;
    type?: "object" | "human";
  }>;

  // Advanced features
  useGoogleSearch?: boolean; // Enable grounding
  thinkingMode?: boolean; // Enable thinking process (handled by model)
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await step.run(`publish-status-${nodeId}`, async () => {
    await publish(
      designProChannel().status({
        nodeId,
        status,
      })
    );
  });
};

// Helper to resolve image source (URL, base64, or Handlebars template)
async function resolveImageSource(
  source: string,
  context: Record<string, any>
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Check if it's a Handlebars template
    if (source.includes("{{") && source.includes("}}")) {
      const compiled = Handlebars.compile(source)(context);
      source = compiled;
    }

    // Check if it's a URL
    if (source.startsWith("http://") || source.startsWith("https://")) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const contentType = response.headers.get("content-type") || "image/png";
      return { base64, mimeType: contentType };
    }

    // Check if it's base64 (data URL or raw base64)
    if (source.startsWith("data:")) {
      const [header, base64Data] = source.split(",");
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      return { base64: base64Data, mimeType };
    }

    // Assume it's raw base64
    if (source.length > 100 && /^[A-Za-z0-9+/=]+$/.test(source)) {
      return { base64: source, mimeType: "image/png" };
    }

    return null;
  } catch (error) {
    console.error("Error resolving image source:", error);
    return null;
  }
}

export const designProExecutor: NodeExecutor<DesignProData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    const variablesName = data.variables || "designPro";
    const mode = data.mode || "generate";

    if (!data.prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError("DESIGN_PRO node: Prompt is required");
      await step.run(`publish-error-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: error.message,
              },
            },
          })
        );
      });
      throw error;
    }

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        "DESIGN_PRO node: GEMINI_API_KEY is not configured in environment variables"
      );
      await step.run(`publish-error-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: error.message,
              },
            },
          })
        );
      });
      throw error;
    }

    // Parse prompt - handle JSON format or backward-compatible string format
    let promptSpec: any;
    let actualPrompt: string;

    try {
      // Try to parse as JSON
      promptSpec = JSON.parse(data.prompt);

      // Extract the actual generation prompt from JSON structure
      if (promptSpec.generationParameters?.prompt) {
        actualPrompt = promptSpec.generationParameters.prompt;
      } else if (promptSpec.prompt) {
        actualPrompt = promptSpec.prompt;
      } else {
        // If JSON but no prompt found, use the entire JSON as a string for generation
        actualPrompt = JSON.stringify(promptSpec);
      }
    } catch (error) {
      // Not valid JSON, treat as backward-compatible string prompt
      actualPrompt = data.prompt;
      // Wrap in basic JSON structure for consistency
      promptSpec = {
        generationParameters: {
          prompt: actualPrompt,
        },
      };
    }

    // Compile prompt with context using Handlebars
    const compiledPrompt = Handlebars.compile(actualPrompt)(context);

    // Determine aspect ratio from template or data
    let aspectRatio = data.aspectRatio;
    if (data.template && DESIGN_TEMPLATES[data.template]) {
      aspectRatio = DESIGN_TEMPLATES[data.template].aspectRatio;
    }

    const model = (data.model as any) || "gemini-3-pro-image-preview";
    let result: any;
    let chatId: string | undefined;
    const MAX_RETRIES = 3;

    // Helper function to retry image generation with exponential backoff
    const retryImageGeneration = async (
      generateFn: () => Promise<any>,
      maxRetries: number = MAX_RETRIES
    ): Promise<any> => {
      let lastError: string | undefined;
      let lastResult: any;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          console.log(
            `[DESIGN_PRO] Retrying image generation (attempt ${attempt + 1}/${maxRetries + 1})...`
          );
        }

        lastResult = await generateFn();

        if (lastResult.success) {
          return lastResult; // Success, return result
        }

        lastError = lastResult.error;
        // Don't retry on certain errors (e.g., invalid prompt, content policy violations)
        if (
          lastResult.error?.includes("content policy") ||
          lastResult.error?.includes("safety") ||
          lastResult.error?.includes("invalid") ||
          lastResult.error?.includes("forbidden")
        ) {
          break; // Non-retriable error
        }
      }

      return { ...lastResult, error: lastError || lastResult.error };
    };

    // Handle different modes
    switch (mode) {
      case "generate": {
        // Text-to-image generation (same as DESIGN) with retry
        result = await retryImageGeneration(() =>
          generateImage({
            prompt: compiledPrompt,
            model,
            aspectRatio,
            imageSize: data.imageSize,
            template: data.template,
          })
        );
        break;
      }

      case "edit": {
        // Edit existing image
        if (!data.sourceImage) {
          throw new NonRetriableError("DESIGN_PRO node (edit mode): sourceImage is required");
        }

        const sourceResolved = await resolveImageSource(data.sourceImage, context);
        if (!sourceResolved) {
          throw new NonRetriableError("DESIGN_PRO node: Failed to resolve source image");
        }

        result = await retryImageGeneration(() =>
          editImage({
            prompt: compiledPrompt,
            imageBase64: sourceResolved.base64,
            imageMimeType: sourceResolved.mimeType || data.sourceImageMimeType,
            model,
            aspectRatio,
            imageSize: data.imageSize,
          })
        );
        break;
      }

      case "chat": {
        // Multi-turn conversational editing
        // Use multiTurnEdit from the service which handles conversation history
        const { multiTurnEdit } = await import("@/services/geminiImageService");

        // Get conversation history from context or data
        let conversationHistory = data.conversationHistory || [];

        // If previous node had conversation history, use it
        if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
          conversationHistory = context.conversationHistory;
        }

        const sourceImage = data.sourceImage
          ? await resolveImageSource(data.sourceImage, context)
          : undefined;

        // Convert conversation history to proper format
        const historyMessages = conversationHistory.map((msg: any) => ({
          role: (msg.role === "user" || msg.role === "model" ? msg.role : "user") as
            | "user"
            | "model",
          content: msg.content || "",
          imageBase64: msg.imageBase64,
          imageMimeType: msg.imageMimeType,
        }));

        result = await retryImageGeneration(() =>
          multiTurnEdit({
            conversationHistory: historyMessages,
            newMessage: compiledPrompt,
            newImageBase64: sourceImage?.base64,
            newImageMimeType: sourceImage?.mimeType,
            model,
            aspectRatio,
            imageSize: data.imageSize,
          }).then((chatResult) => ({
            success: chatResult.success,
            imageBase64: chatResult.imageBase64,
            mimeType: chatResult.mimeType,
            text: chatResult.text,
            error: chatResult.error,
            updatedHistory: chatResult.updatedHistory,
          }))
        );

        // Store updated conversation history in result
        if (result.updatedHistory) {
          (result as any).conversationHistory = result.updatedHistory;
        }
        break;
      }

      case "editWithReferences": {
        // Edit with reference images
        const referenceImages: ReferenceImage[] = [];

        if (data.referenceImages && data.referenceImages.length > 0) {
          for (const refImg of data.referenceImages) {
            const resolved = await resolveImageSource(refImg.image, context);
            if (resolved) {
              referenceImages.push({
                base64: resolved.base64,
                mimeType: resolved.mimeType || refImg.mimeType || "image/png",
                type: refImg.type,
              });
            }
          }
        }

        const sourceImage = data.sourceImage
          ? await resolveImageSource(data.sourceImage, context)
          : undefined;

        result = await retryImageGeneration(() =>
          editImageWithReferences({
            prompt: compiledPrompt,
            baseImage: sourceImage?.base64,
            baseImageMimeType: sourceImage?.mimeType,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            model,
            aspectRatio,
            imageSize: data.imageSize,
            useGoogleSearch: data.useGoogleSearch,
          })
        );
        break;
      }

      default:
        throw new NonRetriableError(`DESIGN_PRO node: Unknown mode "${mode}"`);
    }

    // Keep the full base64 for publishing (not stored in Inngest)
    const fullBase64 = result.imageBase64;

    if (!result.success) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        `DESIGN_PRO node: Image generation failed after ${MAX_RETRIES + 1} attempts - ${result.error}`
      );
      await step.run(`publish-error-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: result.error || "Image generation failed",
                attempts: MAX_RETRIES + 1,
              },
            },
          })
        );
      });
      throw error;
    }

    // Save image to disk and get public URL
    let imageUrl: string | undefined;
    let imageFilename: string | undefined;

    if (fullBase64) {
      const saveResult = await saveImageToDisk(fullBase64, result.mimeType || "image/jpeg");
      if (saveResult.success) {
        // Build full URL based on environment
        const baseUrl = process.env.API_URL;
        imageUrl = `${baseUrl}${saveResult.url}`;
        imageFilename = saveResult.filename;
      }
    }

    // Store metadata and image URL in step (for Inngest tracking/replay)
    const imageResult = await step.run("log-image-generation", async () => {
      return {
        success: result.success,
        // Only include errorMessage (not error) to avoid Inngest deserialization issues
        ...(result.error ? { errorMessage: result.error } : {}),
        mimeType: result.mimeType,
        text: result.text,
        mode,
        imageUrl, // Include URL - it's just a string, so it's safe
        imageFilename,
        // Do NOT include base64 here - it would exceed Inngest limits
      };
    });

    await publishStatus(publish, step, nodeId, "success");

    // Build result with image URL and data
    const fullResult = {
      ...context,
      [variablesName]: {
        success: true,
        prompt: compiledPrompt,
        mimeType: result.mimeType,
        text: result.text,
        aspectRatio: aspectRatio || "1:1",
        imageSize: data.imageSize,
        template: data.template,
        mode,
        imageUrl,
        imageFilename,
        ...(mode === "chat" && result.conversationHistory
          ? { conversationHistory: result.conversationHistory }
          : {}),
      },
    };

    // Publish full result (with base64) to realtime channel
    await step.run(`publish-output-${nodeId}`, async () => {
      await publish(
        designProChannel().output({
          nodeId,
          output: fullResult,
        })
      );
    });

    // Publish chat message if in chat mode
    if (mode === "chat" && result.text) {
      await step.run(`publish-chat-${nodeId}`, async () => {
        await publish(
          designProChannel().chat({
            nodeId,
            message: result.text,
            imageUrl,
          })
        );
      });
    }

    // Return full result with image data
    return fullResult;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");

    // Publish error output to realtime channel
    await step.run(`publish-error-${nodeId}`, async () => {
      await publish(
        designProChannel().output({
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
    });

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `DESIGN_PRO request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
