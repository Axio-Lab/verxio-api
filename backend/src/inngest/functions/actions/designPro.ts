import type { NodeExecutor } from "../types";
import { designProChannel } from "@/inngest/channels/designPro";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  generateImage,
  editImage,
  editImageWithReferences,
  type AspectRatio,
  type ImageSize,
  type TemplateType,
  type ReferenceImage,
  DESIGN_TEMPLATES,
} from "@/services/geminiImageService";
import { saveImageToDisk } from "@/lib/imageStorage";
import { basePrismaClient } from "@/lib/prisma";

type DesignProData = {
  variables?: string;
  prompt?: string; // JSON format
  mode?: "generate" | "edit" | "editWithReferences";
  model?: string; // Default: gemini-3.1-flash-image-preview (Design Agent Pro)
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize; // 1K, 2K, 4K
  template?: TemplateType;

  // For edit mode
  sourceImage?: string; // URL, base64, or {{previousNode.imageUrl}}
  sourceImageMimeType?: string;

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
// Wrap in step.run() with unique ID to prevent duplicate step warnings
const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await step.run(`publish-status-${nodeId}-${status}`, async () => {
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
  userId,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");
    // Check subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "DESIGN_PRO");

    // Consume premium quota once per workflow run (inside step.run so Inngest memoizes across resumes)
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`designPro-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.DESIGN_AGENT_PRO);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`publish-output-error-quota-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...context,
              error: { message: error.message },
            },
          })
        );
      });
      throw error;
    }

    // Extract minimal data into primitives to avoid capturing large data object in closure
    const localVariablesName = String(data?.variables || "designPro");
    const localMode = String(data?.mode || "generate");
    const localPromptText = String(data?.prompt || "");
    const localModel = String(data?.model || "gemini-3.1-flash-image-preview");
    const localAspectRatio = data?.aspectRatio as AspectRatio | undefined;
    const localImageSize = data?.imageSize as ImageSize | undefined;
    const localTemplate = data?.template as TemplateType | undefined;
    const localUseGoogleSearch = Boolean(data?.useGoogleSearch);
    const localNodeId = nodeId;

    if (!localPromptText) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError("DESIGN_PRO node: Prompt is required");
      await step.run(`publish-output-error-prompt-${nodeId}`, async () => {
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
      await step.run(`publish-output-error-api-key-${nodeId}`, async () => {
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

    // Load images from database DIRECTLY (not in step.run to avoid Inngest output size limit)
    // Inngest has a ~4MB limit on step outputs, and base64 images can easily exceed this
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId: localNodeId },
    });

    // Reconstruct sourceImage and referenceImages from database
    let imageData: {
      sourceImage?: string;
      sourceImageMimeType?: string;
      sourceImageFilename?: string;
      referenceImages: Array<{
        image: string;
        filename: string;
        mimeType?: string;
        type?: "object" | "human";
      }>;
    } = { referenceImages: [] };

    if (nodeAssets.length > 0) {
      if (localMode === "edit") {
        // For edit mode, first image is source image
        const firstAsset = nodeAssets[0];
        if (firstAsset && firstAsset.fileData) {
          imageData.sourceImage = firstAsset.fileData;
          imageData.sourceImageMimeType = firstAsset.fileData.startsWith("data:")
            ? firstAsset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png";
          imageData.sourceImageFilename = firstAsset.filename;
        }
        // Rest are reference images
        for (let i = 1; i < nodeAssets.length; i++) {
          const asset = nodeAssets[i];
          imageData.referenceImages.push({
            image: asset.fileData,
            filename: asset.filename,
            mimeType: asset.fileData.startsWith("data:")
              ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
          });
        }
      } else if (localMode === "editWithReferences") {
        // For editWithReferences mode, all assets are reference images
        for (const asset of nodeAssets) {
          imageData.referenceImages.push({
            image: asset.fileData,
            filename: asset.filename,
            mimeType: asset.fileData.startsWith("data:")
              ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
          });
        }
      } else {
        // For generate mode, all images are reference images (if any)
        for (const asset of nodeAssets) {
          imageData.referenceImages.push({
            image: asset.fileData,
            filename: asset.filename,
            mimeType: asset.fileData.startsWith("data:")
              ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
          });
        }
      }
    }

    // Parse prompt - handle JSON format or backward-compatible string format
    let promptSpec: any;
    let actualPrompt: string;

    try {
      // Try to parse as JSON
      promptSpec = JSON.parse(localPromptText);

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
      actualPrompt = localPromptText;
      // Wrap in basic JSON structure for consistency
      promptSpec = {
        generationParameters: {
          prompt: actualPrompt,
        },
      };
    }

    // Compile prompt with context using Handlebars (use minimal context)
    const minimalContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 10)) {
        minimalContext[key] = context[key];
      }
    }
    const compiledPrompt = Handlebars.compile(actualPrompt)(minimalContext);

    // Determine aspect ratio from template or data
    const computedAspectRatio =
      localAspectRatio || (localTemplate && DESIGN_TEMPLATES[localTemplate]?.aspectRatio) || "1:1";

    const finalModel = (localModel as any) || "gemini-3.1-flash-image-preview";
    const MAX_RETRIES = 3;

    // Generate image and save to disk inside step.run for memoization
    // This ensures the same image URL is used across resumes/retries
    const imageResult = await step.run(`generate-image-${nodeId}`, async () => {
      // Helper function to retry image generation with exponential backoff
      const retryImageGeneration = async (
        generateFn: () => Promise<any>,
        maxRetries: number = MAX_RETRIES
      ): Promise<any> => {
        let lastError: string | undefined;
        let lastResult: any;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          lastResult = await generateFn();

          if (lastResult.success) {
            return lastResult;
          }

          lastError = lastResult.error;
          if (
            lastResult.error?.includes("content policy") ||
            lastResult.error?.includes("safety") ||
            lastResult.error?.includes("invalid") ||
            lastResult.error?.includes("forbidden")
          ) {
            break;
          }
        }

        return { ...lastResult, error: lastError || lastResult.error };
      };

      let result: any;

      // Handle different modes
      switch (localMode) {
        case "generate": {
          result = await retryImageGeneration(() =>
            generateImage({
              prompt: compiledPrompt,
              model: finalModel,
              aspectRatio: computedAspectRatio,
              imageSize: localImageSize,
              template: localTemplate,
            })
          );
          break;
        }

        case "edit": {
          if (!imageData.sourceImage) {
            return {
              success: false,
              error:
                "DESIGN_PRO node (edit mode): sourceImage is required. No assets found in database.",
            };
          }

          const sourceResolved = await resolveImageSource(imageData.sourceImage, minimalContext);
          if (!sourceResolved) {
            return {
              success: false,
              error: "DESIGN_PRO node: Failed to resolve source image",
            };
          }

          result = await retryImageGeneration(() =>
            editImage({
              prompt: compiledPrompt,
              imageBase64: sourceResolved.base64,
              imageMimeType: sourceResolved.mimeType || imageData.sourceImageMimeType,
              model: finalModel,
              aspectRatio: computedAspectRatio,
              imageSize: localImageSize,
            })
          );
          break;
        }

        case "editWithReferences": {
          const referenceImages: ReferenceImage[] = [];

          if (imageData.referenceImages && imageData.referenceImages.length > 0) {
            for (const refImg of imageData.referenceImages) {
              const resolved = await resolveImageSource(refImg.image, minimalContext);
              if (resolved) {
                referenceImages.push({
                  base64: resolved.base64,
                  mimeType: resolved.mimeType || refImg.mimeType || "image/png",
                  type: refImg.type,
                });
              }
            }

            // Validate limits: max 6 object, max 5 human (images without type count as object)
            const objectCount = referenceImages.filter(
              (img) => img.type === "object" || !img.type
            ).length;
            const humanCount = referenceImages.filter((img) => img.type === "human").length;
            if (objectCount > 6) {
              return {
                success: false,
                error:
                  "Maximum 6 object reference images allowed. Remove some images or mark images of people as 'human' type.",
              };
            }
            if (humanCount > 5) {
              return {
                success: false,
                error: "Maximum 5 human reference images allowed.",
              };
            }
          }

          const sourceImage = imageData.sourceImage
            ? await resolveImageSource(imageData.sourceImage, minimalContext)
            : undefined;

          result = await retryImageGeneration(() =>
            editImageWithReferences({
              prompt: compiledPrompt,
              baseImage: sourceImage?.base64,
              baseImageMimeType: sourceImage?.mimeType,
              referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
              model: finalModel,
              aspectRatio: computedAspectRatio,
              imageSize: localImageSize,
              useGoogleSearch: localUseGoogleSearch,
            })
          );
          break;
        }

        default:
          return {
            success: false,
            error: `DESIGN_PRO node: Unknown mode "${localMode}"`,
          };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Image generation failed",
          attempts: MAX_RETRIES + 1,
        };
      }

      // Save image to disk and return URL (all inside step.run for memoization)
      let imageUrl: string | undefined;
      let imageFilename: string | undefined;

      if (result.imageBase64) {
        const saveResult = await saveImageToDisk(
          result.imageBase64,
          result.mimeType || "image/jpeg"
        );
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
        mode: localMode as string,
        imageUrl,
        imageFilename,
      };
    });

    if (!imageResult.success) {
      await publishStatus(publish, step, nodeId, "error");
      const errResult = imageResult as { success: false; error: string; attempts?: number };
      const error = new NonRetriableError(
        `DESIGN_PRO node: Image generation failed - ${errResult.error}`
      );
      await step.run(`publish-output-error-generation-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...context,
              error: {
                message: errResult.error || "Image generation failed",
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
      mode: string;
      imageUrl?: string;
      imageFilename?: string;
    };

    // Build result with image URL and data (use minimal context)
    const outputContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 10)) {
        outputContext[key] = context[key];
      }
    }

    // Use ONLY memoized imageResult values
    const fullResult = {
      ...outputContext,
      [localVariablesName]: {
        success: true,
        prompt: compiledPrompt,
        mimeType: successResult.mimeType,
        text: successResult.text,
        aspectRatio: computedAspectRatio,
        imageSize: localImageSize,
        template: localTemplate,
        mode: localMode,
        imageUrl: successResult.imageUrl,
        imageFilename: successResult.imageFilename,
      },
    };

    // Publish full result (with base64) to realtime channel FIRST
    // Only publish success status if output publish succeeds
    try {
      await step.run(`publish-output-success-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: fullResult,
          })
        );
      });

      // Publish success status AFTER output is successfully published
      // This ensures the status only shows success when output is actually available
      await publishStatus(publish, step, nodeId, "success");
    } catch (publishError) {
      // If output publish fails, publish error status instead
      console.error(`[DESIGN_PRO] Failed to publish output for node ${nodeId}:`, publishError);
      await publishStatus(publish, step, nodeId, "error");
      await step.run(`publish-output-error-publish-${nodeId}`, async () => {
        await publish(
          designProChannel().output({
            nodeId,
            output: {
              ...outputContext,
              error: {
                message: `Failed to publish output: ${publishError instanceof Error ? publishError.message : "Unknown error"}`,
              },
            },
          })
        );
      });
      throw publishError;
    }

    // Return full result with image data
    return fullResult;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");

    // Publish error output to realtime channel (use minimal context)
    // Don't wrap publish in step.run() - publish calls are just notifications
    const minimalContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 3)) {
        const val = context[key];
        if (typeof val === "string" || (val && typeof val === "object" && "imageUrl" in val)) {
          minimalContext[key] = val;
        }
      }
    }
    await step.run(`publish-output-error-catch-${nodeId}`, async () => {
      await publish(
        designProChannel().output({
          nodeId,
          output: {
            ...minimalContext,
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
