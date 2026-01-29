import type { NodeExecutor } from "../types";
import { veoChannel } from "@/inngest/channels/veo";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  generateVideo,
  generateVideoWithImage,
  generateVideoWithReferenceImages,
  generateVideoWithFrames,
  extendVideo,
  downloadVideo,
  type VideoAspectRatio,
  type VideoResolution,
  type VideoDuration,
  type ImageInput,
  type ReferenceImageInput,
  type VideoInput,
  type VeoFileRef,
} from "@/services/veoVideoService";
import { GoogleGenAI } from "@google/genai";
import { saveVideoToDisk } from "@/lib/videoStorage";
import { basePrismaClient } from "@/lib/prisma";

type VeoData = {
  variables?: string;
  prompt?: string;
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;
  durationSeconds?: VideoDuration;
  negativePrompt?: string;
  // Generation mode
  mode?: "text" | "image" | "reference" | "frames" | "extension";
  // Image-to-video
  sourceImage?: string; // base64, URL, or asset:filename
  sourceImageFilename?: string;
  // Reference images (up to 3)
  referenceImages?: Array<{ file: string; filename: string }>;
  // First/last frames
  firstFrame?: string;
  firstFrameFilename?: string;
  lastFrame?: string;
  lastFrameFilename?: string;
  // Video extension
  sourceVideo?: string; // from previous node output or asset:filename
  sourceVideoFilename?: string;
};

// Helper to publish status updates
// Use a static step ID per status to prevent duplicate executions
const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `publish-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(
      veoChannel().status({
        nodeId,
        status,
      })
    );
  });
};

// Helper to get MIME type from file extension
function getMimeTypeFromExtension(urlOrPath: string): string {
  const extension = urlOrPath.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    // Video formats
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    // Image formats
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return mimeMap[extension || ""] || "image/png";
}

// Helper to resolve image/video source (URL, base64, or Handlebars template)
async function resolveFileSource(
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
      const response = await fetch(source, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");

      // Get Content-Type from header, or detect from file extension
      let contentType = response.headers.get("content-type");
      if (!contentType || contentType === "application/octet-stream") {
        contentType = getMimeTypeFromExtension(source);
      }

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
    console.error("Error resolving file source:", error);
    return null;
  }
}

export const veoExecutor: NodeExecutor<VeoData> = async ({
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
    await checkNodeAccess(userId, "VEO");

    // Consume premium quota once per workflow run (must be inside step.run so Inngest
    // memoizes it across resumes - otherwise every function resume deducts again)
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`veo-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.VEO);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`publish-error-quota-${nodeId}`, async () => {
        await publish(
          veoChannel().output({
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

    // Extract data to primitives
    const localVariablesName = String(data?.variables || "veo");
    const localMode = String(data?.mode || "text");
    const localPromptText = String(data?.prompt || "");
    const localAspectRatio = data?.aspectRatio as VideoAspectRatio | undefined;
    const localResolution = data?.resolution as VideoResolution | undefined;
    const localDurationSeconds = data?.durationSeconds as VideoDuration | undefined;
    const localNegativePrompt = String(data?.negativePrompt || "");
    const localNodeId = nodeId;

    // Validate prompt (required for all modes except extension which needs sourceVideo)
    if (!localPromptText && localMode !== "extension") {
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError("VEO node: Prompt is required");
      const errorStepId = `publish-error-${nodeId}`;
      await step.run(errorStepId, async () => {
        await publish(
          veoChannel().output({
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
        "VEO node: GEMINI_API_KEY is not configured in environment variables"
      );
      const errorStepId = `publish-error-${nodeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await step.run(errorStepId, async () => {
        await publish(
          veoChannel().output({
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

    // Compile prompt with context using Handlebars
    const compiledPrompt = localPromptText ? Handlebars.compile(localPromptText)(context) : "";

    // Load assets from database and generate video
    const videoResult = await step.run("load-assets-and-generate-video", async () => {
      // Load assets from database
      const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
        where: { nodeId: localNodeId },
      });

      // Create a map of filename to asset data
      const assetMap = new Map<string, { fileData: string; mimeType?: string }>();
      for (const asset of nodeAssets) {
        if (asset.filename && asset.fileData) {
          assetMap.set(asset.filename, {
            fileData: asset.fileData,
            mimeType: asset.mimeType || "image/png",
          });
        }
      }

      // Resolve source image for image-to-video mode
      let sourceImage: ImageInput | undefined;
      if (localMode === "image") {
        // First check for VEO-specific source image asset
        const sourceImageAsset = nodeAssets.find((a: any) => a.fileType === "veo-source-image");
        if (sourceImageAsset && sourceImageAsset.fileData) {
          const resolved = await resolveFileSource(sourceImageAsset.fileData, context);
          if (resolved) {
            sourceImage = {
              imageBytes: resolved.base64,
              mimeType: resolved.mimeType,
            };
          }
        } else if (data?.sourceImage) {
          // Fallback to data.sourceImage (for URLs or templates)
          let imageSource = data.sourceImage;
          if (imageSource.startsWith("asset:")) {
            const filename = imageSource.replace("asset:", "");
            const asset = assetMap.get(filename);
            if (asset) {
              const resolved = await resolveFileSource(asset.fileData, context);
              if (resolved) {
                sourceImage = {
                  imageBytes: resolved.base64,
                  mimeType: resolved.mimeType,
                };
              }
            }
          } else {
            const resolved = await resolveFileSource(imageSource, context);
            if (resolved) {
              sourceImage = {
                imageBytes: resolved.base64,
                mimeType: resolved.mimeType,
              };
            }
          }
        }
      }

      // Resolve reference images from database (fileType: "veo-reference-image")
      let referenceImages: ReferenceImageInput[] | undefined;
      if (localMode === "reference") {
        // Load VEO reference images from NodeAsset table
        const refAssets = nodeAssets.filter((a: any) => a.fileType === "veo-reference-image");

        if (refAssets.length > 0) {
          referenceImages = [];
          for (const asset of refAssets.slice(0, 3)) {
            if (asset.fileData) {
              const resolved = await resolveFileSource(asset.fileData, context);
              if (resolved) {
                referenceImages.push({
                  image: {
                    imageBytes: resolved.base64,
                    mimeType: resolved.mimeType,
                  },
                  referenceType: "asset",
                });
              }
            }
          }
        } else if (data?.referenceImages && data.referenceImages.length > 0) {
          // Fallback to data.referenceImages (for URLs/templates or backward compatibility)
          referenceImages = [];
          for (const ref of data.referenceImages.slice(0, 3)) {
            if (ref.file.startsWith("asset:")) {
              const filename = ref.file.replace("asset:", "");
              const asset = assetMap.get(filename);
              if (asset) {
                const resolved = await resolveFileSource(asset.fileData, context);
                if (resolved) {
                  referenceImages.push({
                    image: {
                      imageBytes: resolved.base64,
                      mimeType: resolved.mimeType,
                    },
                    referenceType: "asset",
                  });
                }
              }
            } else {
              const resolved = await resolveFileSource(ref.file, context);
              if (resolved) {
                referenceImages.push({
                  image: {
                    imageBytes: resolved.base64,
                    mimeType: resolved.mimeType,
                  },
                  referenceType: "asset",
                });
              }
            }
          }
        }
      }

      // Resolve first and last frames from database (fileType: "veo-first-frame", "veo-last-frame")
      let firstFrame: ImageInput | undefined;
      let lastFrame: ImageInput | undefined;
      if (localMode === "frames") {
        // Load first frame from database
        const firstFrameAsset = nodeAssets.find((a: any) => a.fileType === "veo-first-frame");
        if (firstFrameAsset && firstFrameAsset.fileData) {
          const resolved = await resolveFileSource(firstFrameAsset.fileData, context);
          if (resolved) {
            firstFrame = {
              imageBytes: resolved.base64,
              mimeType: resolved.mimeType,
            };
          }
        } else if (data?.firstFrame) {
          // Fallback to data.firstFrame
          let frameSource = data.firstFrame;
          if (frameSource.startsWith("asset:")) {
            const filename = frameSource.replace("asset:", "");
            const asset = assetMap.get(filename);
            if (asset) {
              const resolved = await resolveFileSource(asset.fileData, context);
              if (resolved) {
                firstFrame = {
                  imageBytes: resolved.base64,
                  mimeType: resolved.mimeType,
                };
              }
            }
          } else {
            const resolved = await resolveFileSource(frameSource, context);
            if (resolved) {
              firstFrame = {
                imageBytes: resolved.base64,
                mimeType: resolved.mimeType,
              };
            }
          }
        }

        // Load last frame from database
        const lastFrameAsset = nodeAssets.find((a: any) => a.fileType === "veo-last-frame");
        if (lastFrameAsset && lastFrameAsset.fileData) {
          const resolved = await resolveFileSource(lastFrameAsset.fileData, context);
          if (resolved) {
            lastFrame = {
              imageBytes: resolved.base64,
              mimeType: resolved.mimeType,
            };
          }
        } else if (data?.lastFrame) {
          // Fallback to data.lastFrame
          let frameSource = data.lastFrame;
          if (frameSource.startsWith("asset:")) {
            const filename = frameSource.replace("asset:", "");
            const asset = assetMap.get(filename);
            if (asset) {
              const resolved = await resolveFileSource(asset.fileData, context);
              if (resolved) {
                lastFrame = {
                  imageBytes: resolved.base64,
                  mimeType: resolved.mimeType,
                };
              }
            }
          } else {
            const resolved = await resolveFileSource(frameSource, context);
            if (resolved) {
              lastFrame = {
                imageBytes: resolved.base64,
                mimeType: resolved.mimeType,
              };
            }
          }
        }
      }

      // Resolve source video for extension.
      // You pass e.g. {{veoInitial.videoUrl}} to identify which previous Veo node to extend.
      // We resolve that to the URL string, then find that URL in context to get that node's
      // veoFileRef (the Veo API file reference). The extend API is called with veoFileRef.uri—
      // not the URL. The URL is only used to match which previous node's veoFileRef to use.
      let sourceVideo: VideoInput | VeoFileRef | undefined;
      if (localMode === "extension") {
        // First check for source video in database (fileType: "veo-source-video")
        const sourceVideoAsset = nodeAssets.find((a: any) => a.fileType === "veo-source-video");
        if (sourceVideoAsset && sourceVideoAsset.fileData) {
          const resolved = await resolveFileSource(sourceVideoAsset.fileData, context);
          if (resolved) {
            sourceVideo = {
              videoBytes: resolved.base64,
              mimeType: resolved.mimeType,
            };
          }
        }

        // If not found in database, try data.sourceVideo (for Handlebars templates referencing previous nodes)
        if (!sourceVideo && data?.sourceVideo) {
          let videoSource = data.sourceVideo;
          if (videoSource.includes("{{")) {
            videoSource = Handlebars.compile(videoSource)(context);
          }
          // Match by videoUrl to find the previous node, then use its veoFileRef for the API
          for (const key of Object.keys(context)) {
            const nodeOut = context[key] as
              | { videoUrl?: string; veoFileRef?: { uri: string } }
              | undefined;
            if (nodeOut?.veoFileRef?.uri && nodeOut.videoUrl === videoSource) {
              sourceVideo = { uri: nodeOut.veoFileRef.uri };
              break;
            }
          }
          if (!sourceVideo && videoSource.startsWith("asset:")) {
            const filename = videoSource.replace("asset:", "");
            const asset = assetMap.get(filename);
            if (asset) {
              const resolved = await resolveFileSource(asset.fileData, context);
              if (resolved) {
                sourceVideo = {
                  videoBytes: resolved.base64,
                  mimeType: resolved.mimeType,
                };
              }
            }
          } else if (!sourceVideo) {
            const resolved = await resolveFileSource(videoSource, context);
            if (resolved) {
              sourceVideo = {
                videoBytes: resolved.base64,
                mimeType: resolved.mimeType,
              };
            }
          }
        }

        // If still no source video found, throw an error
        if (!sourceVideo) {
          throw new Error("VEO node: sourceVideo is required for extension mode");
        }
      }

      // Generate video based on mode
      const config = {
        aspectRatio: localAspectRatio || "16:9",
        resolution: localResolution || "720p",
        durationSeconds: localDurationSeconds || "8",
        ...(localNegativePrompt && { negativePrompt: localNegativePrompt }),
      };

      let operation: any;
      let success: boolean;
      let error: string | undefined;

      if (localMode === "text") {
        const result = await generateVideo(compiledPrompt, config);
        operation = result.operation;
        success = result.success;
        error = result.error;
      } else if (localMode === "image" && sourceImage) {
        const result = await generateVideoWithImage(compiledPrompt, sourceImage, config);
        operation = result.operation;
        success = result.success;
        error = result.error;
      } else if (localMode === "reference" && referenceImages && referenceImages.length > 0) {
        const result = await generateVideoWithReferenceImages(
          compiledPrompt,
          referenceImages,
          config
        );
        operation = result.operation;
        success = result.success;
        error = result.error;
      } else if (localMode === "frames" && firstFrame && lastFrame) {
        const result = await generateVideoWithFrames(compiledPrompt, firstFrame, lastFrame, config);
        operation = result.operation;
        success = result.success;
        error = result.error;
      } else if (localMode === "extension" && sourceVideo) {
        const result = await extendVideo(
          compiledPrompt || "Extend this video naturally",
          sourceVideo,
          config
        );
        operation = result.operation;
        success = result.success;
        error = result.error;
      } else {
        throw new Error(`VEO node: Invalid mode or missing required inputs for mode: ${localMode}`);
      }

      if (!success || !operation) {
        throw new Error(error || "Failed to start video generation");
      }

      // Poll operation status until complete (must be in same step to preserve operation object prototype)
      // Following the official Veo documentation pattern
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
      }
      const ai = new GoogleGenAI({ apiKey });
      const startTime = Date.now();
      const maxWaitTime = 600000; // 10 minutes

      while (!operation.done && Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });
      }

      if (!operation.done) {
        throw new Error("Video generation timed out");
      }

      // Check for operation-level error (e.g. content filtered, API error)
      const opError = (operation as { error?: { message?: string; code?: number } }).error;
      if (opError?.message) {
        throw new Error(`Video operation failed: ${opError.message}`);
      }

      // Download video: SDK maps API's generateVideoResponse.generatedSamples -> response.generatedVideos
      let generatedVideoFile = operation.response?.generatedVideos?.[0]?.video;
      if (!generatedVideoFile) {
        // Fallback: raw API may use different shape (e.g. extension)
        const rawResponse = (
          operation as {
            response?: {
              generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> };
            };
          }
        ).response as
          | { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } }
          | undefined;
        const rawVideo = rawResponse?.generateVideoResponse?.generatedSamples?.[0]?.video;
        if (rawVideo?.uri) {
          generatedVideoFile = { uri: rawVideo.uri };
        }
      }
      if (!generatedVideoFile?.uri) {
        console.error(
          "[VEO] No video in operation response. operation.response:",
          JSON.stringify(operation.response, null, 2)
        );
        throw new Error(
          "No video in operation response. The generation may have been filtered or failed; check logs for operation.response."
        );
      }
      const downloadResult = await downloadVideo(generatedVideoFile);
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || "Failed to download video");
      }

      // Save video to disk
      const saveResult = await saveVideoToDisk(downloadResult.buffer, downloadResult.mimeType);
      if (!saveResult.success) {
        throw new Error(saveResult.error || "Failed to save video");
      }

      // Build full URL
      const baseUrl = process.env.API_URL;
      const videoUrl = `${baseUrl}${saveResult.url}`;

      // Expose Veo file reference so extension mode can use it (API only accepts Veo-generated file refs)
      const veoFileRef =
        generatedVideoFile?.uri != null ? { uri: generatedVideoFile.uri } : undefined;

      return {
        success: true,
        videoUrl,
        videoFilename: saveResult.filename,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        durationSeconds: config.durationSeconds,
        veoFileRef,
      };
    });

    // videoResult now contains the final video data (url, filename, etc.)
    const videoResultFinal = videoResult;

    await publishStatus(publish, step, nodeId, "success");

    // Build result (include veoFileRef so extension mode can use it for the next Veo node)
    const fullResult = {
      ...context,
      [localVariablesName]: {
        success: true,
        prompt: compiledPrompt,
        videoUrl: videoResultFinal.videoUrl,
        videoFilename: videoResultFinal.videoFilename,
        aspectRatio: videoResultFinal.aspectRatio,
        resolution: videoResultFinal.resolution,
        durationSeconds: videoResultFinal.durationSeconds,
        veoFileRef: videoResultFinal.veoFileRef,
      },
    };

    // Publish full result
    const outputStepId = `publish-output-${nodeId}`;
    await step.run(outputStepId, async () => {
      await publish(
        veoChannel().output({
          nodeId,
          output: fullResult,
        })
      );
    });

    return fullResult;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");

    // Publish error output
    const errorStepId = `publish-error-${nodeId}`;
    await step.run(errorStepId, async () => {
      await publish(
        veoChannel().output({
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
      `VEO request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
