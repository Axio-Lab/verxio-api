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
  model?: string; // Default: gemini-3-pro-image-preview
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

    await publishStatus(publish, step, nodeId, "loading");

    // Extract minimal data into primitives to avoid capturing large data object in closure
    const localVariablesName = String(data?.variables || "designPro");
    const localMode = String(data?.mode || "generate");
    const localPromptText = String(data?.prompt || "");
    const localModel = String(data?.model || "gemini-3-pro-image-preview");
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

    // CRITICAL: Load images from database inside step to avoid closure capture
    // Store local values for use inside step
    const stepLocalMode = localMode;
    const stepLocalNodeId = localNodeId;

    // Load images from database (same approach as remotion)
    const imageData = await step.run("load-design-pro-images", async () => {
      // Load assets from database (inside step - not in closure)
      const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
        where: { nodeId: stepLocalNodeId },
      });

      // Reconstruct sourceImage and referenceImages from database
      // For edit/editWithReferences modes, first image is sourceImage, rest are referenceImages
      let sourceImage: string | undefined;
      let sourceImageMimeType: string | undefined;
      let sourceImageFilename: string | undefined;
      const referenceImages: Array<{
        image: string;
        filename: string;
        mimeType?: string;
        type?: "object" | "human";
      }> = [];

      if (nodeAssets.length > 0) {
        if (stepLocalMode === "edit") {
          // For edit mode, first image is source image
          const firstAsset = nodeAssets[0];
          if (firstAsset && firstAsset.fileData) {
            sourceImage = firstAsset.fileData;
            sourceImageMimeType = firstAsset.fileData.startsWith("data:")
              ? firstAsset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png";
            sourceImageFilename = firstAsset.filename;
          }
          // Rest are reference images
          for (let i = 1; i < nodeAssets.length; i++) {
            const asset = nodeAssets[i];
            referenceImages.push({
              image: asset.fileData,
              filename: asset.filename,
              mimeType: asset.fileData.startsWith("data:")
                ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
                : "image/png",
            });
          }
        } else if (stepLocalMode === "editWithReferences") {
          // For editWithReferences mode, source image is optional
          // If sourceImage exists in node.data, it will be loaded separately
          // All assets from the database are treated as reference images
          // (The sourceImage, if provided, comes from node.data.sourceImage, not from assets)
          for (const asset of nodeAssets) {
            referenceImages.push({
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
            referenceImages.push({
              image: asset.fileData,
              filename: asset.filename,
              mimeType: asset.fileData.startsWith("data:")
                ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
                : "image/png",
            });
          }
        }
      }

      return {
        sourceImage,
        sourceImageMimeType,
        sourceImageFilename,
        referenceImages,
      };
    });

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

    const finalModel = (localModel as any) || "gemini-3-pro-image-preview";
    let result: any;
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
    switch (localMode) {
      case "generate": {
        // Text-to-image generation (same as DESIGN) with retry
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
        // Edit existing image
        if (!imageData.sourceImage) {
          throw new NonRetriableError(
            "DESIGN_PRO node (edit mode): sourceImage is required. No assets found in database."
          );
        }

        const sourceResolved = await resolveImageSource(imageData.sourceImage, minimalContext);
        if (!sourceResolved) {
          throw new NonRetriableError("DESIGN_PRO node: Failed to resolve source image");
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
        // Edit with reference images
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
        throw new NonRetriableError(`DESIGN_PRO node: Unknown mode "${localMode}"`);
    }
    const fullBase64 = result.imageBase64;

    if (!result.success) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        `DESIGN_PRO node: Image generation failed after ${MAX_RETRIES + 1} attempts - ${result.error}`
      );
      await step.run(`publish-output-error-generation-${nodeId}`, async () => {
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
        mode: localMode as string,
        imageUrl, // Include URL - it's just a string, so it's safe
        imageFilename,
        // Do NOT include base64 here - it would exceed Inngest limits
      };
    });

    // Build result with image URL and data (use minimal context)
    const outputContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 10)) {
        outputContext[key] = context[key];
      }
    }

    // Determine final aspect ratio (reuse computed value)
    const finalAspectRatio = computedAspectRatio;

    const fullResult = {
      ...outputContext,
      [localVariablesName]: {
        success: true,
        prompt: compiledPrompt,
        mimeType: result.mimeType,
        text: result.text,
        aspectRatio: finalAspectRatio,
        imageSize: localImageSize,
        template: localTemplate,
        mode: localMode,
        imageUrl,
        imageFilename,
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
