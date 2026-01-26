import type { NodeExecutor } from "../types";
import { designChannel } from "@/inngest/channels/design";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  generateImage,
  type AspectRatio,
  type TemplateType,
  DESIGN_TEMPLATES,
} from "@/services/geminiImageService";
import { saveImageToDisk } from "@/lib/imageStorage";

type DesignData = {
  variables?: string;
  prompt?: string;
  model?: string;
  aspectRatio?: AspectRatio;
  template?: TemplateType;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `publish-status-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  await step.run(stepId, async () => {
    await publish(
      designChannel().status({
        nodeId,
        status,
      })
    );
  });
};

export const designExecutor: NodeExecutor<DesignData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    const variablesName = data.variables || "design";

    if (!data.prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError("DESIGN node: Prompt is required");
      const errorStepId = `publish-error-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await step.run(errorStepId, async () => {
        await publish(
          designChannel().output({
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
        "DESIGN node: GEMINI_API_KEY is not configured in environment variables"
      );
      const errorStepId = `publish-error-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await step.run(errorStepId, async () => {
        await publish(
          designChannel().output({
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

    // Generate image with retry logic
    // Retry up to 3 times with exponential backoff for transient failures
    const MAX_RETRIES = 3;
    let result: any;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        console.log(
          `[DESIGN] Retrying image generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`
        );
      }

      // Generate image OUTSIDE of step.run to avoid storing base64 in Inngest step output
      result = await generateImage({
        prompt: compiledPrompt,
        model: "gemini-2.5-flash-image", // Only Flash Image model supported
        aspectRatio,
        template: data.template,
      });

      if (result.success) {
        break; // Success, exit retry loop
      }

      lastError = result.error;
      // Don't retry on certain errors (e.g., invalid prompt, content policy violations)
      if (
        result.error?.includes("content policy") ||
        result.error?.includes("safety") ||
        result.error?.includes("invalid")
      ) {
        break; // Non-retriable error
      }
    }

    // Keep the full base64 for publishing (not stored in Inngest)
    const fullBase64 = result.imageBase64;

    if (!result.success) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        `DESIGN node: Image generation failed after ${MAX_RETRIES + 1} attempts - ${lastError || result.error}`
      );
      const errorStepId = `publish-error-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await step.run(errorStepId, async () => {
        await publish(
          designChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: lastError || result.error || "Image generation failed",
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
        mimeType: imageResult.mimeType,
        text: imageResult.text,
        aspectRatio: aspectRatio || "1:1",
        template: data.template,
        imageUrl,
        imageFilename,
      },
    };

    // Publish full result (with base64) to realtime channel
    const outputStepId = `publish-output-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await step.run(outputStepId, async () => {
      await publish(
        designChannel().output({
          nodeId,
          output: fullResult,
        })
      );
    });

    // Return full result with image data
    return fullResult;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");

    // Publish error output to realtime channel
    await step.run(`publish-error-${nodeId}`, async () => {
      await publish(
        designChannel().output({
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
      `DESIGN request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
