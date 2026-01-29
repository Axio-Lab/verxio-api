/**
 * Veo Video Service
 *
 * Provides video generation capabilities using Google's Veo 3.1 model:
 * - veo-3.1-generate-preview: High-fidelity video generation with audio
 *
 * Features:
 * - Text-to-video generation
 * - Image-to-video generation
 * - Video extension (extend existing Veo videos)
 * - Reference images (up to 3)
 * - First/last frame interpolation
 * - Various aspect ratios and resolutions
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Initialize the Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

// Supported video models
export const VIDEO_MODELS = ["veo-3.1-generate-preview"] as const;
export type VideoModel = (typeof VIDEO_MODELS)[number];

// Supported aspect ratios
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

// Supported resolutions
export const VIDEO_RESOLUTIONS = ["720p", "1080p", "4k"] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

// Supported durations (in seconds)
export const VIDEO_DURATIONS = ["4", "6", "8"] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

// Video generation config
export interface VideoGenerationConfig {
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;
  durationSeconds?: VideoDuration;
  negativePrompt?: string;
  numberOfVideos?: number;
}

// Image input for image-to-video
export interface ImageInput {
  imageBytes: string; // base64
  mimeType: string;
}

// Reference image input
export interface ReferenceImageInput {
  image: ImageInput;
  referenceType: "asset";
}

// Video input for extension (bytes from URL/upload)
export interface VideoInput {
  videoBytes: string; // base64
  mimeType: string;
}

// File reference from a previous Veo generation - extension only accepts this, not re-uploaded files
export interface VeoFileRef {
  uri: string;
}

/**
 * Generate video from text prompt
 */
export async function generateVideo(
  prompt: string,
  config: VideoGenerationConfig = {}
): Promise<{ operation: any; success: boolean; error?: string }> {
  try {
    const ai = getGeminiClient();

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      config: {
        aspectRatio: config.aspectRatio || "16:9",
        resolution: config.resolution || "720p",
        durationSeconds: Number(config.durationSeconds || "8"),
        ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
        ...(config.numberOfVideos && { numberOfVideos: config.numberOfVideos }),
      },
    });

    return { operation, success: true };
  } catch (error) {
    console.error("[VeoVideoService] Error generating video:", error);
    return {
      operation: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate video from image (image-to-video)
 */
export async function generateVideoWithImage(
  prompt: string,
  image: ImageInput,
  config: VideoGenerationConfig = {}
): Promise<{ operation: any; success: boolean; error?: string }> {
  try {
    const ai = getGeminiClient();

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      image: {
        imageBytes: image.imageBytes,
        mimeType: image.mimeType,
      },
      config: {
        aspectRatio: config.aspectRatio || "16:9",
        resolution: config.resolution || "720p",
        durationSeconds: Number(config.durationSeconds || "8"),
        ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
        ...(config.numberOfVideos && { numberOfVideos: config.numberOfVideos }),
      },
    });

    return { operation, success: true };
  } catch (error) {
    console.error("[VeoVideoService] Error generating video with image:", error);
    return {
      operation: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate video with reference images (up to 3)
 */
export async function generateVideoWithReferenceImages(
  prompt: string,
  referenceImages: ReferenceImageInput[],
  config: VideoGenerationConfig = {}
): Promise<{ operation: any; success: boolean; error?: string }> {
  try {
    if (referenceImages.length > 3) {
      return {
        operation: null,
        success: false,
        error: "Maximum 3 reference images allowed",
      };
    }

    const ai = getGeminiClient();

    // Transform reference images to match API format
    const transformedReferenceImages = referenceImages.map((ref) => ({
      image: ref.image,
      referenceType: (ref.referenceType === "asset" ? "ASSET" : undefined) as any,
    }));

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      config: {
        aspectRatio: config.aspectRatio || "16:9",
        resolution: config.resolution || "720p",
        durationSeconds: Number(config.durationSeconds || "8"),
        ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
        ...(config.numberOfVideos && { numberOfVideos: config.numberOfVideos }),
        referenceImages: transformedReferenceImages as any,
      },
    });

    return { operation, success: true };
  } catch (error) {
    console.error("[VeoVideoService] Error generating video with reference images:", error);
    return {
      operation: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate video with first and last frames (interpolation)
 */
export async function generateVideoWithFrames(
  prompt: string,
  firstFrame: ImageInput,
  lastFrame: ImageInput,
  config: VideoGenerationConfig = {}
): Promise<{ operation: any; success: boolean; error?: string }> {
  try {
    const ai = getGeminiClient();

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      image: {
        imageBytes: firstFrame.imageBytes,
        mimeType: firstFrame.mimeType,
      },
      config: {
        aspectRatio: config.aspectRatio || "16:9",
        resolution: config.resolution || "720p",
        durationSeconds: Number(config.durationSeconds || "8"),
        ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
        ...(config.numberOfVideos && { numberOfVideos: config.numberOfVideos }),
        lastFrame: {
          imageBytes: lastFrame.imageBytes,
          mimeType: lastFrame.mimeType,
        },
      },
    });

    return { operation, success: true };
  } catch (error) {
    console.error("[VeoVideoService] Error generating video with frames:", error);
    return {
      operation: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extend an existing Veo-generated video.
 * The API only accepts a video that was generated by Veo and "processed" (the file reference
 * from a previous generation). Use VeoFileRef when the source is a previous Veo node output;
 * otherwise extension will fail with "Input video must be a video that was generated by VEO".
 */
export async function extendVideo(
  prompt: string,
  video: VideoInput | VeoFileRef,
  config: VideoGenerationConfig = {}
): Promise<{ operation: any; success: boolean; error?: string }> {
  const ai = getGeminiClient();

  // If we have a Veo file reference (from a previous Veo generation), use it directly
  const isFileRef = "uri" in video && !("videoBytes" in video);
  if (isFileRef && video.uri) {
    try {
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        video: { uri: video.uri },
        prompt: prompt,
        config: {
          aspectRatio: config.aspectRatio || "16:9",
          resolution: "720p",
          durationSeconds: 8,
          numberOfVideos: 1,
          ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
        },
      });
      return { operation, success: true };
    } catch (error) {
      console.error("[VeoVideoService] Error extending video (file ref):", error);
      return {
        operation: null,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Fallback: bytes from URL/upload - API will reject with "must be generated by VEO" for non-Veo sources
  const videoInput = video as VideoInput;
  const mimeType = videoInput.mimeType || "video/mp4";
  const tempFilePath = path.join(
    os.tmpdir(),
    `veo-extend-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
  );

  try {
    const buffer = Buffer.from(videoInput.videoBytes, "base64");
    fs.writeFileSync(tempFilePath, buffer);

    const uploadedFile = await ai.files.upload({
      file: tempFilePath,
      config: { mimeType },
    });

    if (!uploadedFile.uri) {
      throw new Error("Files API did not return a URI for the uploaded video");
    }

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      video: { uri: uploadedFile.uri },
      prompt: prompt,
      config: {
        aspectRatio: config.aspectRatio || "16:9",
        resolution: "720p",
        durationSeconds: 8,
        numberOfVideos: 1,
        ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
      },
    });

    return { operation, success: true };
  } catch (error) {
    console.error("[VeoVideoService] Error extending video:", error);
    return {
      operation: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (unlinkError) {
      console.warn("[VeoVideoService] Failed to delete temp file:", unlinkError);
    }
  }
}

/**
 * Download video file from operation response
 */
export async function downloadVideo(
  file: any
): Promise<{ buffer: Buffer; mimeType: string; success: boolean; error?: string }> {
  const tempFilePath = path.join(
    os.tmpdir(),
    `veo-video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
  );

  try {
    const ai = getGeminiClient();

    // Download the video file to temporary location
    await ai.files.download({
      file: file,
      downloadPath: tempFilePath,
    });

    // Read the file into a buffer
    const buffer = fs.readFileSync(tempFilePath);

    // Clean up temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (unlinkError) {
      // Ignore cleanup errors
      console.warn("[VeoVideoService] Failed to delete temp file:", unlinkError);
    }

    return {
      buffer,
      mimeType: "video/mp4", // Veo videos are MP4
      success: true,
    };
  } catch (error) {
    // Clean up temporary file on error
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (unlinkError) {
      // Ignore cleanup errors
    }

    console.error("[VeoVideoService] Error downloading video:", error);
    return {
      buffer: Buffer.alloc(0),
      mimeType: "video/mp4",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
