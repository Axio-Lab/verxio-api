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

    // Generate image and save to disk inside step.run for memoization
    // This ensures the same image URL is used across resumes/retries
    const imageResult = await step.run(`generate-image-${nodeId}`, async () => {
      const MAX_RETRIES = 3;
      let result: any;
      let lastError: string | undefined;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          console.log(
            `[DESIGN] Retrying image generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`
          );
        }

        result = await generateImage({
          prompt: compiledPrompt,
          model: "gemini-2.5-flash-image",
          aspectRatio,
          template: data.template,
        });

        if (result.success) break;

        lastError = result.error;
        if (
          result.error?.includes("content policy") ||
          result.error?.includes("safety") ||
          result.error?.includes("invalid")
        ) {
          break;
        }
      }

      if (!result.success) {
        return {
          success: false,
          error: lastError || result.error || "Image generation failed",
          attempts: MAX_RETRIES + 1,
        };
      }

      // Save image to disk and return URL (all inside step.run for memoization)
      let imageUrl: string | undefined;
      let imageFilename: string | undefined;

      if (result.imageBase64) {
        const saveResult = await saveImageToDisk(result.imageBase64, result.mimeType || "image/jpeg");
        if (saveResult.success) {
          const baseUrl = process.env.API_URL;
          imageUrl = `${baseUrl}${saveResult.url}`;
          imageFilename = saveResult.filename;
        }
      }

      return {
        success: true,
        mimeType: result.mimeType,
        text: result.text,
        imageUrl,
        imageFilename,
      };
    });

    if (!imageResult.success) {
      await publishStatus(publish, step, nodeId, "error");
      const errResult = imageResult as { success: false; error: string; attempts?: number };
      const error = new NonRetriableError(
        `DESIGN node: Image generation failed - ${errResult.error}`
      );
      await step.run(`publish-error-${nodeId}`, async () => {
        await publish(
          designChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: errResult.error,
                attempts: errResult.attempts,
              },
            },
          })
        );
      });
      throw error;
    }

    // TypeScript narrowing: imageResult.success === true at this point
    const successResult = imageResult as {
      success: true;
      mimeType: string;
      text?: string;
      imageUrl?: string;
      imageFilename?: string;
    };

    await publishStatus(publish, step, nodeId, "success");

    // Build result using ONLY the memoized imageResult values
    const fullResult = {
      ...context,
      [variablesName]: {
        success: true,
        prompt: compiledPrompt,
        mimeType: successResult.mimeType,
        text: successResult.text,
        aspectRatio: aspectRatio || "1:1",
        template: data.template,
        imageUrl: successResult.imageUrl,
        imageFilename: successResult.imageFilename,
      },
    };

    // Publish output (stable step ID for memoization)
    await step.run(`publish-output-${nodeId}`, async () => {
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
