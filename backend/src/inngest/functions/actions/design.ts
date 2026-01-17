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
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    designChannel().status({
      nodeId,
      status,
    })
  );
};

export const designExecutor: NodeExecutor<DesignData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "design";

    if (!data.prompt) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("DESIGN node: Prompt is required");
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
      throw error;
    }

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "DESIGN node: GEMINI_API_KEY is not configured in environment variables"
      );
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
      throw error;
    }

    // Compile prompt with context using Handlebars
    const compiledPrompt = Handlebars.compile(data.prompt)(context);

    // Determine aspect ratio from template or data
    let aspectRatio = data.aspectRatio;
    if (data.template && DESIGN_TEMPLATES[data.template]) {
      aspectRatio = DESIGN_TEMPLATES[data.template].aspectRatio;
    }

    // Generate image OUTSIDE of step.run to avoid storing base64 in Inngest step output
    // This is critical - Inngest has a step output size limit and base64 images exceed it
    const result = await generateImage({
      prompt: compiledPrompt,
      model: (data.model as any) || "gemini-2.5-flash-image",
      aspectRatio,
      template: data.template,
    });

    // Store only metadata in step (for Inngest tracking/replay)
    const imageResult = await step.run("log-image-generation", async () => {
      return {
        success: result.success,
        error: result.error,
        mimeType: result.mimeType,
        text: result.text,
        // Do NOT include base64 here - it would exceed Inngest limits
      };
    });

    // Keep the full base64 for publishing (not stored in Inngest)
    const fullBase64 = result.imageBase64;

    if (!imageResult.success) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        `DESIGN node: Image generation failed - ${imageResult.error}`
      );
      await publish(
        designChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: imageResult.error || "Image generation failed",
            },
          },
        })
      );
      throw error;
    }

    await publishStatus(publish, nodeId, "success");

    // Save image to disk and get public URL
    let imageUrl: string | undefined;
    let imageFilename: string | undefined;

    if (fullBase64) {
      const saveResult = await saveImageToDisk(fullBase64, imageResult.mimeType || "image/jpeg");
      if (saveResult.success) {
        // Build full URL based on environment
        const baseUrl = process.env.API_URL;
        imageUrl = `${baseUrl}${saveResult.url}`;
        imageFilename = saveResult.filename;
      }
    }

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
    await publish(
      designChannel().output({
        nodeId,
        output: fullResult,
      })
    );

    // Return full result with image data
    return fullResult;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
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

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `DESIGN request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
