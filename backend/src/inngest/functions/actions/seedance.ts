import type { NodeExecutor } from "../types";
import { seedanceChannel } from "@/inngest/channels/seedance";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  createSeedanceTask,
  pollSeedanceTask,
  uploadImageForSeedance,
  uploadVideoForSeedance,
  uploadAudioForSeedance,
  SEEDANCE_DEFAULT_MODEL,
  type SeedanceRatio,
  type SeedanceResolution,
  type SeedanceContentItem,
} from "@/services/seedanceApi";
import { basePrismaClient } from "@/lib/prisma";

/** Seedance 2.0 duration rules: 4–15 seconds, or -1 (model picks length). */
function normalizeSeedance20Duration(d: number | undefined): number {
  if (d === -1) return -1;
  const n = d ?? 5;
  if (!Number.isFinite(n)) return 5;
  return Math.min(15, Math.max(4, Math.round(n)));
}

/** Credits to reserve when duration is -1 (actual length unknown until task completes). */
const SEEDANCE20_BILLING_SECONDS_WHEN_AUTO = 15;

type SeedanceData = {
  variables?: string;
  prompt?: string;
  // Generation mode
  mode?: "text" | "image" | "reference" | "frames";
  // Image-to-video (first frame)
  firstFrameImage?: string; // base64, URL, or asset:filename
  firstFrameImageFilename?: string;
  // First and last frames
  firstFrame?: string;
  firstFrameFilename?: string;
  lastFrame?: string;
  lastFrameFilename?: string;
  // Reference images (Seedance 2.0: 0–9; multimodal needs ≥1 image or video total)
  referenceImages?: Array<{ file: string; filename: string }>;
  /** Reference videos (0–3): public URL, base64/data URL, or asset: — API requires URL in request */
  referenceVideos?: Array<{ file: string; filename?: string }>;
  /** Reference audio (0–3): cannot be used alone; needs ≥1 image or video */
  referenceAudios?: Array<{ file: string; filename?: string }>;
  // Video parameters (dreamina-seedance-2-0: duration 4–15 or -1 for model-picked length)
  generateAudio?: boolean;
  ratio?: SeedanceRatio;
  duration?: number;
  resolution?: SeedanceResolution;
  seed?: number;
  /** Ignored for Seedance 2.0 (not supported by API). */
  cameraFixed?: boolean;
  watermark?: boolean;
  /** Ignored for Seedance 2.0 (1.5 Pro only). */
  draft?: boolean;
  /** `flex` is ignored for Seedance 2.0 (offline tier not supported). */
  serviceTier?: "default" | "flex";
  executionExpiresAfter?: number;
  returnLastFrame?: boolean;
};

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `seedance-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(seedanceChannel().status({ nodeId, status }));
  });
};

// Helper to normalize base64 data
function normalizeBase64(data: string): string {
  if (data.startsWith("data:")) {
    return data.split(",")[1] || data;
  }
  return data;
}

// Helper to resolve image source (URL, base64, asset:filename, or Handlebars template)
async function resolveImageSource(
  source: string,
  context: Record<string, unknown>,
  compile: (s: string) => string,
  nodeAssets?: any[]
): Promise<string | null> {
  try {
    // Check if it's a Handlebars template
    if (source.includes("{{") && source.includes("}}")) {
      source = compile(source);
    }

    // Check if it's an asset reference (asset:filename)
    if (source.startsWith("asset:") && nodeAssets) {
      const filename = source.replace("asset:", "").trim();
      const asset = nodeAssets.find((a: any) => a.filename === filename);
      if (asset?.fileData) {
        return normalizeBase64(asset.fileData);
      }
      return null;
    }

    // Check if it's a URL
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return source; // Return URL as-is
    }

    // Check if it's base64 (data URL or raw base64)
    if (source.startsWith("data:") || (source.length > 100 && /^[A-Za-z0-9+/=]+$/.test(source))) {
      return normalizeBase64(source);
    }

    return null;
  } catch (error) {
    console.error("Error resolving image source:", error);
    return null;
  }
}

export const seedanceExecutor: NodeExecutor<SeedanceData> = async ({
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
    await checkNodeAccess(userId, "SEEDANCE");

    if (!process.env.ARK_API_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("ARK_API_KEY is not configured");
      await step.run(`seedance-err-${nodeId}`, async () => {
        await publish(
          seedanceChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const compile = (s: string) => Handlebars.compile(s)(context);
    const prompt = String(data?.prompt ?? "").trim();
    const mode = data?.mode || "text";
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId },
    });

    // Build content array based on mode
    const content: SeedanceContentItem[] = [];

    // Add text prompt if provided
    if (prompt) {
      const compiledPrompt = compile(prompt);
      content.push({
        type: "text",
        text: compiledPrompt,
      });
    }

    // Handle different modes
    if (mode === "text") {
      // Text-to-video: only text prompt needed
      if (content.length === 0) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError("Seedance: prompt is required for text-to-video mode");
        await step.run(`seedance-err-${nodeId}`, async () => {
          await publish(
            seedanceChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }
    } else if (mode === "image") {
      // Image-to-video (first frame)
      let firstFrameImage: string | null = null;
      let firstFrameFilename: string | undefined;

      // Try to get from data.firstFrameImage
      if (data?.firstFrameImage) {
        const resolved = await resolveImageSource(
          data.firstFrameImage,
          context as Record<string, unknown>,
          compile,
          nodeAssets
        );
        if (resolved) {
          if (resolved.startsWith("http")) {
            firstFrameImage = resolved;
          } else {
            firstFrameImage = resolved;
            firstFrameFilename = data.firstFrameImageFilename;
          }
        }
      }

      // Try to get from assets
      if (!firstFrameImage && nodeAssets.length > 0) {
        const asset = nodeAssets[0];
        if (asset?.fileData) {
          const raw = normalizeBase64(asset.fileData);
          firstFrameImage = raw;
          firstFrameFilename = asset.filename;
        }
      }

      if (!firstFrameImage) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Seedance: first frame image is required for image-to-video mode"
        );
        await step.run(`seedance-err-${nodeId}`, async () => {
          await publish(
            seedanceChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }

      // Upload image if it's base64 to get URL
      const imageUrl = await step.run("seedance-upload-first-frame", async () => {
        if (firstFrameImage.startsWith("http")) {
          return firstFrameImage;
        }
        return uploadImageForSeedance(firstFrameImage, firstFrameFilename);
      });

      content.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } else if (mode === "frames") {
      // Image-to-video (first and last frames)
      let firstFrame: string | null = null;
      let firstFrameFilename: string | undefined;
      let lastFrame: string | null = null;
      let lastFrameFilename: string | undefined;

      // Resolve first frame
      if (data?.firstFrame) {
        const resolved = await resolveImageSource(
          data.firstFrame,
          context as Record<string, unknown>,
          compile,
          nodeAssets
        );
        if (resolved) {
          if (resolved.startsWith("http")) {
            firstFrame = resolved;
          } else {
            firstFrame = resolved;
            firstFrameFilename = data.firstFrameFilename;
          }
        }
      }

      // Resolve last frame
      if (data?.lastFrame) {
        const resolved = await resolveImageSource(
          data.lastFrame,
          context as Record<string, unknown>,
          compile,
          nodeAssets
        );
        if (resolved) {
          if (resolved.startsWith("http")) {
            lastFrame = resolved;
          } else {
            lastFrame = resolved;
            lastFrameFilename = data.lastFrameFilename;
          }
        }
      }

      // Try to get from assets (first two assets)
      if (!firstFrame && nodeAssets.length > 0) {
        const asset = nodeAssets[0];
        if (asset?.fileData) {
          const raw = normalizeBase64(asset.fileData);
          firstFrame = raw;
          firstFrameFilename = asset.filename;
        }
      }
      if (!lastFrame && nodeAssets.length > 1) {
        const asset = nodeAssets[1];
        if (asset?.fileData) {
          const raw = normalizeBase64(asset.fileData);
          lastFrame = raw;
          lastFrameFilename = asset.filename;
        }
      }

      if (!firstFrame || !lastFrame) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Seedance: both first and last frame images are required for frames mode"
        );
        await step.run(`seedance-err-${nodeId}`, async () => {
          await publish(
            seedanceChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }

      // Upload images to get URLs
      const [firstFrameUrl, lastFrameUrl] = await step.run("seedance-upload-frames", async () => {
        const firstUrl = firstFrame.startsWith("http")
          ? firstFrame
          : await uploadImageForSeedance(firstFrame, firstFrameFilename);
        const lastUrl = lastFrame.startsWith("http")
          ? lastFrame
          : await uploadImageForSeedance(lastFrame, lastFrameFilename);
        return [firstUrl, lastUrl];
      });

      content.push({
        type: "image_url",
        image_url: { url: firstFrameUrl },
        role: "first_frame",
      });
      content.push({
        type: "image_url",
        image_url: { url: lastFrameUrl },
        role: "last_frame",
      });
    } else if (mode === "reference") {
      // Multimodal reference (Seedance 2.0): up to 9 images, 3 videos, 3 audio; need ≥1 image or video
      const referenceImages: Array<{ file: string; filename: string }> = [];
      const referenceVideos: Array<{ file: string; filename?: string }> = [];
      const referenceAudios: Array<{ file: string; filename?: string }> = [];

      if (Array.isArray(data?.referenceImages)) {
        for (const ref of data.referenceImages.slice(0, 9)) {
          const resolved = await resolveImageSource(
            ref.file,
            context as Record<string, unknown>,
            compile,
            nodeAssets
          );
          if (resolved) {
            referenceImages.push({ file: resolved, filename: ref.filename });
          }
        }
      }

      const refImgAssets = nodeAssets.filter((a: any) => a.fileType === "seedance-reference-image");
      if (!data?.referenceImages?.length) {
        for (const asset of refImgAssets) {
          if (referenceImages.length >= 9) break;
          if (!asset?.fileData) continue;
          referenceImages.push({
            file: normalizeBase64(asset.fileData),
            filename: asset.filename || "reference.png",
          });
        }
      }

      if (Array.isArray(data?.referenceVideos)) {
        for (const ref of data.referenceVideos.slice(0, 3)) {
          const resolved = await resolveImageSource(
            ref.file,
            context as Record<string, unknown>,
            compile,
            nodeAssets
          );
          if (resolved) {
            referenceVideos.push({ file: resolved, filename: ref.filename });
          }
        }
      }

      const refVidAssets = nodeAssets.filter((a: any) => a.fileType === "seedance-reference-video");
      if (!data?.referenceVideos?.length) {
        for (const asset of refVidAssets) {
          if (referenceVideos.length >= 3) break;
          if (!asset?.fileData) continue;
          referenceVideos.push({
            file: normalizeBase64(asset.fileData),
            filename: asset.filename || "reference.mp4",
          });
        }
      }

      if (Array.isArray(data?.referenceAudios)) {
        for (const ref of data.referenceAudios.slice(0, 3)) {
          const resolved = await resolveImageSource(
            ref.file,
            context as Record<string, unknown>,
            compile,
            nodeAssets
          );
          if (resolved) {
            referenceAudios.push({ file: resolved, filename: ref.filename });
          }
        }
      }

      const refAudAssets = nodeAssets.filter((a: any) => a.fileType === "seedance-reference-audio");
      if (!data?.referenceAudios?.length) {
        for (const asset of refAudAssets) {
          if (referenceAudios.length >= 3) break;
          if (!asset?.fileData) continue;
          referenceAudios.push({
            file: normalizeBase64(asset.fileData),
            filename: asset.filename || "reference.mp3",
          });
        }
      }

      if (referenceImages.length + referenceVideos.length < 1) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Seedance: multimodal reference mode requires at least one reference image or video (audio alone is not supported)"
        );
        await step.run(`seedance-err-${nodeId}`, async () => {
          await publish(
            seedanceChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }

      const imageUrls = await step.run("seedance-upload-ref-images", async () => {
        const urls: string[] = [];
        for (const ref of referenceImages.slice(0, 9)) {
          const url =
            ref.file.startsWith("http") || ref.file.startsWith("https")
              ? ref.file
              : await uploadImageForSeedance(ref.file, ref.filename);
          urls.push(url);
        }
        return urls;
      });

      const videoUrls = await step.run("seedance-upload-ref-videos", async () => {
        const urls: string[] = [];
        for (const ref of referenceVideos.slice(0, 3)) {
          const r = ref.file;
          const url =
            r.startsWith("http") || r.startsWith("https")
              ? r
              : await uploadVideoForSeedance(r, ref.filename);
          urls.push(url);
        }
        return urls;
      });

      const audioUrls = await step.run("seedance-upload-ref-audios", async () => {
        const urls: string[] = [];
        for (const ref of referenceAudios.slice(0, 3)) {
          const r = ref.file;
          const url =
            r.startsWith("http") || r.startsWith("https")
              ? r
              : await uploadAudioForSeedance(r, ref.filename);
          urls.push(url);
        }
        return urls;
      });

      for (const url of imageUrls) {
        content.push({
          type: "image_url",
          image_url: { url },
          role: "reference_image",
        });
      }
      for (const url of videoUrls) {
        content.push({
          type: "video_url",
          video_url: { url },
          role: "reference_video",
        });
      }
      for (const url of audioUrls) {
        content.push({
          type: "audio_url",
          audio_url: { url },
          role: "reference_audio",
        });
      }
    }

    const apiDuration = normalizeSeedance20Duration(data?.duration);
    const billingSeconds =
      apiDuration === -1 ? SEEDANCE20_BILLING_SECONDS_WHEN_AUTO : apiDuration;

    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST, videoCreditsForDuration } = await import("@/config/rate-limits");
    try {
      await step.run(`seedance-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(
          userId,
          videoCreditsForDuration(QUOTA_COST.SEEDANCE, billingSeconds)
        );
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`seedance-quota-err-${nodeId}`, async () => {
        await publish(
          seedanceChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const model = SEEDANCE_DEFAULT_MODEL;

    // Create task request (Seedance 2.0: no draft, no camera_fixed, no flex tier per API)
    const resolutionRaw = data?.resolution as string | undefined;
    const resolution =
      resolutionRaw === "1080p"
        ? "720p"
        : resolutionRaw === "480p" || resolutionRaw === "720p"
          ? resolutionRaw
          : undefined;
    const taskRequest: any = {
      model,
      content,
      generate_audio: data?.generateAudio ?? true,
      ratio: data?.ratio || "adaptive",
      duration: apiDuration,
      watermark: data?.watermark ?? false,
    };

    if (resolution) taskRequest.resolution = resolution;
    if (data?.seed !== undefined) taskRequest.seed = data.seed;
    if (data?.serviceTier && data.serviceTier !== "flex") {
      taskRequest.service_tier = data.serviceTier;
    }
    if (data?.executionExpiresAfter) {
      taskRequest.execution_expires_after = data.executionExpiresAfter;
    }
    if (data?.returnLastFrame) taskRequest.return_last_frame = data.returnLastFrame;

    // Create task
    const { id: taskId } = await step.run("seedance-create-task", async () => {
      return createSeedanceTask(taskRequest);
    });

    // Poll for completion
    const task = await step.run("seedance-poll-task", async () => {
      return pollSeedanceTask(taskId, { intervalMs: 10000, maxWaitMs: 600000 });
    });

    if (task.status !== "succeeded") {
      await publishStatus(publish, step, nodeId, "error");
      const errorMessage = task.error?.message || `Task failed with status: ${task.status}`;
      const err = new NonRetriableError(errorMessage);
      await step.run(`seedance-err-${nodeId}`, async () => {
        await publish(
          seedanceChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const videoUrl = task.content?.video_url;
    if (!videoUrl) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Seedance: no video URL in result");
      await step.run(`seedance-err-${nodeId}`, async () => {
        await publish(
          seedanceChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "seedance");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        videoUrl,
        lastFrameUrl: task.content?.last_frame_url,
        taskId,
        model: task.model ?? model,
        duration: task.duration,
        resolution: task.resolution,
        ratio: task.ratio,
        seed: task.seed,
      },
    };
    await step.run("seedance-output", async () => {
      await publish(seedanceChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Seedance video generation failed";
    await step.run(`seedance-err-${nodeId}`, async () => {
      await publish(
        seedanceChannel().output({
          nodeId,
          output: { ...context, error: { message } },
        })
      );
    });
    throw e instanceof Error ? e : new Error(message);
  }
};
