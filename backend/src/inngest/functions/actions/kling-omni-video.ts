import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingOmniVideoData = {
  prompt?: string;
  model_name?: "kling-video-o1";
  image_list?: string; // JSON array of image URLs/templates or single image
  referenceImages?: Array<{ file: string; filename?: string; type?: "first_frame" | "end_frame" }>;
  element_list?: string;
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  variables?: string;
};

const PATH = "/v1/videos/omni-video";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-omni-video-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingOmniVideoExecutor: NodeExecutor<KlingOmniVideoData> = async ({
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
    await checkNodeAccess(userId, "KLING_OMNI_VIDEO");

    // Consume premium quota once per workflow run for this node
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`kling-omni-video-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.KLING_OMNI_VIDEO);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`kling-omni-video-quota-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    if (!process.env.KLING_ACCESS_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("KLING_ACCESS_KEY is not configured");
      await step.run(`kling-omni-video-err-${nodeId}`, async () => {
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
    if (!prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Omni-Video: prompt is required");
      await step.run(`kling-omni-video-err-${nodeId}`, async () => {
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
    const compiledPrompt = compile(prompt);
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });

    const imageSources: Array<{ src: string; type?: "first_frame" | "end_frame" }> = [];
    const imageListRaw = data?.image_list?.trim();
    if (imageListRaw) {
      try {
        const parsed = JSON.parse(compile(imageListRaw)) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === "string") {
              imageSources.push({ src: item });
            } else if (item && typeof item === "object") {
              const src = String((item as any).image_url ?? (item as any).image ?? "");
              const type = (item as any).type as "first_frame" | "end_frame" | undefined;
              if (src) imageSources.push({ src, type });
            }
          });
        } else if (parsed) {
          imageSources.push({ src: String(parsed) });
        }
      } catch {
        imageSources.push({ src: compile(imageListRaw) });
      }
    }
    if (Array.isArray(data?.referenceImages)) {
      imageSources.push(...data.referenceImages.map((img) => ({ src: img.file, type: img.type })));
    }

    const image_list: Array<{ image_url: string; type?: string }> = [];
    for (const { src, type } of imageSources) {
      if (!src) continue;
      if (src.startsWith("asset:")) {
        const filename = src.replace("asset:", "").trim();
        const asset = nodeAssets.find((a: any) => a.filename === filename);
        if (asset?.fileData) {
          const raw = asset.fileData.startsWith("data:")
            ? asset.fileData.split(",")[1]
            : asset.fileData;
          if (raw) image_list.push({ image_url: raw, ...(type ? { type } : {}) });
        }
        continue;
      }
      const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
      if (b64) image_list.push({ image_url: b64, ...(type ? { type } : {}) });
    }

    if (image_list.length === 0) {
      const assetImages = nodeAssets.filter((a: any) =>
        [
          "kling-omni-video-image",
          "kling-omni-video-image-first_frame",
          "kling-omni-video-image-end_frame",
        ].includes(a.fileType)
      );
      for (const a of assetImages) {
        if (!a.fileData) continue;
        const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
        if (raw) {
          const type =
            a.fileType === "kling-omni-video-image-first_frame"
              ? "first_frame"
              : a.fileType === "kling-omni-video-image-end_frame"
                ? "end_frame"
                : undefined;
          image_list.push({ image_url: raw, ...(type ? { type } : {}) });
        }
      }
    }

    let element_list: Array<{ element_id: number }> | undefined;
    const elementListRaw = data?.element_list?.trim();
    if (elementListRaw) {
      try {
        const parsed = JSON.parse(compile(elementListRaw)) as unknown;
        if (Array.isArray(parsed)) {
          element_list = parsed
            .map((item) => ({
              element_id: Number((item as any)?.element_id ?? item),
            }))
            .filter((item) => Number.isFinite(item.element_id));
        }
      } catch {
        element_list = undefined;
      }
    }

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-video-o1",
      prompt: compiledPrompt,
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: data?.duration ?? "5",
    };
    if (image_list.length) body.image_list = image_list;
    if (element_list && element_list.length > 0) body.element_list = element_list;

    const { task_id } = await step.run("kling-omni-video-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-omni-video-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Omni-Video: no video in result");
      await step.run(`kling-omni-video-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingOmniVideo");
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
    await step.run("kling-omni-video-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Omni-Video failed";
    await step.run(`kling-omni-video-err-${nodeId}`, async () => {
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
