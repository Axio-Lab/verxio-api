/**
 * Gemini Image Service
 *
 * Provides image generation capabilities using Gemini's Nano Banana models:
 * - gemini-2.5-flash-image: Fast, efficient image generation
 * - gemini-3-pro-image-preview: Advanced features, up to 4K resolution, thinking mode
 *
 * Features:
 * - Text-to-image generation
 * - Image editing (text + image to image)
 * - Image editing with reference images
 * - Various aspect ratios and resolutions
 */

import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

// Supported aspect ratios
export const ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// Supported image sizes (Pro model only)
export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

// Supported models
export const IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

// Preset templates with dimensions
export const DESIGN_TEMPLATES = {
  instagram_post: {
    name: "Instagram Post",
    aspectRatio: "1:1" as AspectRatio,
    width: 1080,
    height: 1080,
  },
  instagram_story: {
    name: "Instagram Story",
    aspectRatio: "9:16" as AspectRatio,
    width: 1080,
    height: 1920,
  },
  twitter_post: {
    name: "Twitter/X Post",
    aspectRatio: "16:9" as AspectRatio,
    width: 1200,
    height: 675,
  },
  twitter_header: {
    name: "Twitter/X Header",
    aspectRatio: "3:1" as AspectRatio,
    width: 1500,
    height: 500,
  },
  facebook_post: {
    name: "Facebook Post",
    aspectRatio: "16:9" as AspectRatio,
    width: 1200,
    height: 630,
  },
  linkedin_post: {
    name: "LinkedIn Post",
    aspectRatio: "1:1" as AspectRatio,
    width: 1200,
    height: 1200,
  },
  presentation_slide: {
    name: "Presentation Slide",
    aspectRatio: "16:9" as AspectRatio,
    width: 1920,
    height: 1080,
  },
  youtube_thumbnail: {
    name: "YouTube Thumbnail",
    aspectRatio: "16:9" as AspectRatio,
    width: 1280,
    height: 720,
  },
  logo: { name: "Logo", aspectRatio: "1:1" as AspectRatio, width: 500, height: 500 },
  banner: { name: "Banner", aspectRatio: "21:9" as AspectRatio, width: 2560, height: 1080 },
} as const;

export type TemplateType = keyof typeof DESIGN_TEMPLATES;

export interface GenerateImageOptions {
  prompt: string;
  model?: ImageModel;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize; // Only for Pro model
  template?: TemplateType;
}

export interface GenerateImageResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  text?: string; // Any accompanying text from the model
  error?: string;
}

export interface EditImageOptions {
  prompt: string;
  imageBase64: string;
  imageMimeType?: string;
  model?: ImageModel;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}

export interface ReferenceImage {
  base64: string;
  mimeType: string;
  type?: "object" | "human";
}

export interface EditWithReferencesOptions {
  prompt: string;
  baseImage?: string; // Base image to edit (optional)
  baseImageMimeType?: string;
  referenceImages?: ReferenceImage[]; // Up to 14 total
  model?: ImageModel;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  useGoogleSearch?: boolean;
}

/**
 * Generate an image from a text prompt
 */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  try {
    const ai = getGeminiClient();
    const model = options.model || "gemini-2.5-flash-image";

    // Determine aspect ratio from template or options
    let aspectRatio = options.aspectRatio;
    if (options.template && DESIGN_TEMPLATES[options.template]) {
      aspectRatio = DESIGN_TEMPLATES[options.template].aspectRatio;
    }

    // Build config
    const config: any = {
      responseModalities: ["TEXT", "IMAGE"],
    };

    if (aspectRatio || options.imageSize) {
      config.imageConfig = {};
      if (aspectRatio) {
        config.imageConfig.aspectRatio = aspectRatio;
      }
      // Image size only works with Pro model
      if (options.imageSize && model === "gemini-3-pro-image-preview") {
        config.imageConfig.imageSize = options.imageSize;
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: options.prompt,
      config,
    });

    // Extract image and text from response
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).text) {
          text = (text || "") + (part as any).text;
        } else if ((part as any).inlineData) {
          imageBase64 = (part as any).inlineData.data;
          mimeType = (part as any).inlineData.mimeType;
        }
      }
    }

    if (!imageBase64) {
      return {
        success: false,
        text,
        error: "No image was generated. The model may have declined the request.",
      };
    }

    return {
      success: true,
      imageBase64,
      mimeType: mimeType || "image/png",
      text,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edit an existing image with a text prompt
 */
export async function editImage(options: EditImageOptions): Promise<GenerateImageResult> {
  try {
    const ai = getGeminiClient();
    const model = options.model || "gemini-2.5-flash-image";

    // Build config
    const config: any = {
      responseModalities: ["TEXT", "IMAGE"],
    };

    if (options.aspectRatio || options.imageSize) {
      config.imageConfig = {};
      if (options.aspectRatio) {
        config.imageConfig.aspectRatio = options.aspectRatio;
      }
      if (options.imageSize && model === "gemini-3-pro-image-preview") {
        config.imageConfig.imageSize = options.imageSize;
      }
    }

    // Create content with image and text
    const contents = [
      {
        inlineData: {
          mimeType: options.imageMimeType || "image/png",
          data: options.imageBase64,
        },
      },
      { text: options.prompt },
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // Extract image and text from response
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).text) {
          text = (text || "") + (part as any).text;
        } else if ((part as any).inlineData) {
          imageBase64 = (part as any).inlineData.data;
          mimeType = (part as any).inlineData.mimeType;
        }
      }
    }

    if (!imageBase64) {
      return {
        success: false,
        text,
        error: "No image was generated. The model may have declined the request.",
      };
    }

    return {
      success: true,
      imageBase64,
      mimeType: mimeType || "image/png",
      text,
    };
  } catch (error) {
    console.error("Error editing image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate multiple images (e.g., for a presentation)
 * Returns an async generator for streaming progress
 */
export async function* generateMultipleImages(options: {
  prompts: Array<{ prompt: string; index: number }>;
  model?: ImageModel;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  template?: TemplateType;
}): AsyncGenerator<{
  type: "progress" | "image" | "complete" | "error";
  index?: number;
  total?: number;
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  error?: string;
}> {
  const total = options.prompts.length;

  for (const { prompt, index } of options.prompts) {
    yield {
      type: "progress",
      index,
      total,
    };

    const result = await generateImage({
      prompt,
      model: options.model,
      aspectRatio: options.aspectRatio,
      imageSize: options.imageSize,
      template: options.template,
    });

    if (result.success) {
      yield {
        type: "image",
        index,
        total,
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        text: result.text,
      };
    } else {
      yield {
        type: "error",
        index,
        total,
        error: result.error,
      };
    }
  }

  yield { type: "complete" };
}

/**
 * Edit image with reference images (up to 14: 6 objects + 5 humans)
 */
export async function editImageWithReferences(
  options: EditWithReferencesOptions
): Promise<GenerateImageResult> {
  try {
    const ai = getGeminiClient();
    const model = options.model || "gemini-3-pro-image-preview";

    // Validate reference image count
    if (options.referenceImages && options.referenceImages.length > 14) {
      return {
        success: false,
        error: "Maximum 14 reference images allowed (6 objects + 5 humans)",
      };
    }

    // Count by type
    if (options.referenceImages) {
      const objectCount = options.referenceImages.filter(
        (img) => img.type === "object" || !img.type
      ).length;
      const humanCount = options.referenceImages.filter((img) => img.type === "human").length;

      if (objectCount > 6) {
        return {
          success: false,
          error: "Maximum 6 object reference images allowed",
        };
      }
      if (humanCount > 5) {
        return {
          success: false,
          error: "Maximum 5 human reference images allowed",
        };
      }
    }

    // Build config
    const config: any = {
      responseModalities: ["TEXT", "IMAGE"],
    };

    if (options.aspectRatio || options.imageSize) {
      config.imageConfig = {};
      if (options.aspectRatio) {
        config.imageConfig.aspectRatio = options.aspectRatio;
      }
      if (options.imageSize) {
        config.imageConfig.imageSize = options.imageSize;
      }
    }

    if (options.useGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    // Build contents array
    const contents: any[] = [];

    // Add text prompt first
    contents.push({ text: options.prompt });

    // Add base image if provided
    if (options.baseImage) {
      contents.push({
        inlineData: {
          mimeType: options.baseImageMimeType || "image/png",
          data: options.baseImage,
        },
      });
    }

    // Add reference images
    if (options.referenceImages) {
      for (const refImage of options.referenceImages) {
        contents.push({
          inlineData: {
            mimeType: refImage.mimeType || "image/png",
            data: refImage.base64,
          },
        });
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // Extract image and text from response
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).text) {
          text = (text || "") + (part as any).text;
        } else if ((part as any).inlineData) {
          imageBase64 = (part as any).inlineData.data;
          mimeType = (part as any).inlineData.mimeType;
        }
      }
    }

    if (!imageBase64) {
      return {
        success: false,
        text,
        error: "No image was generated. The model may have declined the request.",
      };
    }

    return {
      success: true,
      imageBase64,
      mimeType: mimeType || "image/png",
      text,
    };
  } catch (error) {
    console.error("Error editing image with references:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if Gemini image service is available
 */
export function isGeminiImageEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
