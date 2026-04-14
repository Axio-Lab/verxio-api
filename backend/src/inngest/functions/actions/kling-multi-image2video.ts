import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMultiImage2VideoData = {
  prompt?: string;
  image_list?: string; // JSON array or comma-separated URLs/templates
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  variables?: string;
  referenceImages?: Array<{ file: string; filename?: string }>;
};

const PATH = "/v1/videos/multi-image2video";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-multi-i2v-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingMultiImage2VideoExecutor: NodeExecutor<KlingMultiImage2VideoData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    // Check subscription access for Kling nodes
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "KLING_MULTI_IMAGE2VIDEO");

    if (!process.env.KLING_ACCESS_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("KLING_ACCESS_KEY is not configured");
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
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
    const imageListRaw = data?.image_list?.trim();
    let prefetchedAssets: any[] | undefined = undefined;
    if (!prompt && !imageListRaw && !(data?.referenceImages && data.referenceImages.length > 0)) {
      prefetchedAssets = await (basePrismaClient as any).nodeAsset.findMany({
        where: { nodeId },
      });
      if (!prefetchedAssets || prefetchedAssets.length === 0) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Kling Multi-Image-to-Video: prompt or image_list is required"
        );
        await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
          await publish(
            klingChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }
    }

    const compile = (s: string) => Handlebars.compile(s)(context);
    const compiledPrompt = prompt ? compile(prompt) : undefined;

    let image_list: string[] = [];
    const imageSources: string[] = [];

    if (imageListRaw) {
      try {
        const parsed = JSON.parse(compile(imageListRaw)) as unknown;
        imageSources.push(...(Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]));
      } catch {
        imageSources.push(
          ...imageListRaw
            .split(",")
            .map((s) => compile(s.trim()))
            .filter(Boolean)
        );
      }
    }

    if (Array.isArray(data?.referenceImages) && data.referenceImages.length > 0) {
      imageSources.push(...data.referenceImages.map((r) => String(r.file)));
    }

    const nodeAssets =
      prefetchedAssets ??
      (imageSources.some((src) => src.startsWith("asset:")) || imageSources.length === 0
        ? await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } })
        : []);

    if (imageSources.length === 0 && nodeAssets.length > 0) {
      for (const a of nodeAssets) {
        if (!a.fileData) continue;
        const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
        if (raw) image_list.push(raw);
      }
    } else if (imageSources.length > 0) {
      for (const src of imageSources) {
        if (src.startsWith("asset:")) {
          const filename = src.replace("asset:", "");
          const asset = nodeAssets.find((a: any) => a.filename === filename);
          if (asset?.fileData) {
            const raw = asset.fileData.startsWith("data:")
              ? asset.fileData.split(",")[1]
              : asset.fileData;
            if (raw) image_list.push(raw);
          }
          continue;
        }
        const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
        if (b64) image_list.push(b64);
      }
    }

    if (image_list.length === 0) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Multi-Image-to-Video: image_list is required");
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    if (image_list.length > 4) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Multi-Image-to-Video: image_list supports up to 4 images"
      );
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST, videoCreditsForDuration, billableVideoSeconds } =
      await import("@/config/rate-limits");
    const durationSeconds = billableVideoSeconds(data?.duration ?? "5", 5);
    try {
      await step.run(`kling-multi-image2video-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(
          userId,
          videoCreditsForDuration(QUOTA_COST.KLING_MULTI_IMAGE2VIDEO, durationSeconds)
        );
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`kling-multi-image2video-quota-err-${nodeId}`, async () => {
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
      model_name: "kling-v1-6",
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: String(durationSeconds),
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    body.image_list = image_list.map((image) => ({ image }));

    const { task_id } = await step.run("kling-multi-i2v-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-multi-i2v-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Multi-Image-to-Video: no video in result");
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingMultiImage2Video");
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
    await step.run("kling-multi-i2v-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Multi-Image-to-Video failed";
    await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
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
