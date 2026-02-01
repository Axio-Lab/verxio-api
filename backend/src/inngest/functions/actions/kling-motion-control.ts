import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMotionControlData = {
  prompt?: string;
  image?: string;
  imageFilename?: string;
  video_url?: string; // reference video URL or template
  videoFilename?: string;
  keep_original_sound?: "yes" | "no";
  character_orientation?: "image" | "video";
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  variables?: string;
};

const PATH = "/v1/videos/motion-control";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-motion-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingMotionControlExecutor: NodeExecutor<KlingMotionControlData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    if (!process.env.KLING_ACCESS_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("KLING_ACCESS_KEY is not configured");
      await step.run(`kling-motion-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const prompt = String(data?.prompt ?? "").trim();
    let imageInput = data?.image?.trim();
    let videoInput = data?.video_url?.trim();
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId },
    });
    if (!imageInput) {
      const imageAsset = nodeAssets.find((a: any) => a.fileType === "kling-motion-image");
      if (imageAsset?.filename) {
        imageInput = `asset:${imageAsset.filename}`;
      }
    }
    if (!videoInput) {
      const videoAsset = nodeAssets.find((a: any) => a.fileType === "kling-motion-video");
      if (videoAsset?.filename) {
        videoInput = `asset:${videoAsset.filename}`;
      }
    }
    if (!imageInput || !videoInput) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Motion Control: image and video_url are required");
      await step.run(`kling-motion-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const compile = (s: string) => Handlebars.compile(s)(context);
    const compiledPrompt = prompt ? compile(prompt) : undefined;
    const normalizeBase64 = (value: string | null) => {
      if (!value) return value;
      return value.startsWith("data:") ? value.split(",")[1] || null : value;
    };

    let imageBase64: string | null = null;
    if (imageInput) {
      if (imageInput.startsWith("asset:")) {
        const filename = imageInput.replace("asset:", "").trim();
        const asset = nodeAssets.find(
          (a: any) => a.fileType === "kling-motion-image" && a.filename === filename
        );
        if (asset?.fileData) {
          imageBase64 = normalizeBase64(asset.fileData);
        }
      }
      if (!imageBase64) {
        imageBase64 = await resolveImageSource(
          imageInput,
          context as Record<string, unknown>,
          compile
        );
      }
      if (!imageBase64) {
        const asset = nodeAssets.find((a: any) => a.fileType === "kling-motion-image");
        if (asset?.fileData) {
          imageBase64 = normalizeBase64(asset.fileData);
        }
      }
    }

    const getBaseUrl = () => {
      const baseUrl = process.env.API_URL?.trim();
      if (!baseUrl) {
        throw new Error("API_URL is required to upload motion control videos");
      }
      return baseUrl.replace(/\/$/, "");
    };
    const guessVideoMimeType = (filename?: string) => {
      if (!filename) return "video/mp4";
      const lower = filename.toLowerCase();
      if (lower.endsWith(".mov")) return "video/quicktime";
      if (lower.endsWith(".mp4")) return "video/mp4";
      return "video/mp4";
    };
    const uploadVideoFromBase64 = async (base64: string, filename?: string) => {
      const buffer = Buffer.from(base64, "base64");
      const formData = new FormData();
      const mimeType = guessVideoMimeType(filename);
      formData.append("file", new Blob([buffer], { type: mimeType }), filename || "motion.mp4");
      const res = await fetch(`${getBaseUrl()}/api/public/chat/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Video upload failed");
      }
      const json = (await res.json()) as { url?: string };
      if (!json?.url) {
        throw new Error("Video upload did not return a URL");
      }
      return json.url;
    };

    let videoBase64: string | null = null;
    let videoUrl: string | null = null;
    if (videoInput) {
      if (videoInput.startsWith("asset:")) {
        const filename = videoInput.replace("asset:", "").trim();
        const asset = nodeAssets.find(
          (a: any) => a.fileType === "kling-motion-video" && a.filename === filename
        );
        if (asset?.fileData) {
          videoBase64 = normalizeBase64(asset.fileData);
        }
      }
      if (!videoBase64) {
        const compiledVideo = compile(videoInput);
        if (compiledVideo.startsWith("http://") || compiledVideo.startsWith("https://")) {
          videoUrl = compiledVideo;
        } else {
          videoBase64 = normalizeBase64(compiledVideo);
        }
      }
      if (!videoBase64) {
        const asset = nodeAssets.find((a: any) => a.fileType === "kling-motion-video");
        if (asset?.fileData) {
          videoBase64 = normalizeBase64(asset.fileData);
        }
      }
    }

    if (!imageBase64 || (!videoBase64 && !videoUrl)) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Motion Control: could not resolve image or video_url"
      );
      await step.run(`kling-motion-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const body: Record<string, unknown> = {
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: data?.duration ?? "5",
      keep_original_sound: data?.keep_original_sound ?? "yes",
      character_orientation: data?.character_orientation ?? "image",
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    if (imageBase64) body.image_url = imageBase64;
    if (videoBase64) {
      videoUrl = await step.run("kling-motion-upload-video", async () =>
        uploadVideoFromBase64(videoBase64!, data?.videoFilename)
      );
    }
    if (videoUrl) {
      console.log("[Kling Motion Control] Uploaded video URL:", videoUrl);
      body.video_url = videoUrl;
    }

    const { task_id } = await step.run("kling-motion-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-motion-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Motion Control: no video in result");
      await step.run(`kling-motion-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingMotionControl");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        videoUrl: video.url,
        videoId: video.id,
        duration: video.duration,
        task_id,
      },
    };
    await step.run("kling-motion-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Motion Control failed";
    await step.run(`kling-motion-err-${nodeId}`, async () => {
      await publish(
        klingChannel().output({
          nodeId,
          output: { ...context, error: { message } },
        })
      );
    });
    throw e instanceof Error ? e : new Error(message);
  }
};
