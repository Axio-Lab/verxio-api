import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

const MAX_DURATION_SECONDS = 15;
const MIN_DURATION_SECONDS = 1;

type KlingOmniVideoMultiPromptItem = {
  index: number;
  prompt: string;
  duration: string; // per-shot duration in seconds, e.g. "5"
};

type KlingOmniVideoData = {
  prompt?: string;
  model_name?: "kling-v3-omni";
  multi_shot?: boolean;
  multi_prompt?: KlingOmniVideoMultiPromptItem[];
  referenceImages?: Array<{ file: string; filename?: string; type?: "first_frame" | "end_frame" }>;
  element_list?: string;
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  sound?: "on" | "off";
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

    const multiShot = data?.multi_shot === true;
    const totalDurationRaw = Math.floor(Number(data?.duration) || 5);
    const totalDuration = Math.min(
      MAX_DURATION_SECONDS,
      Math.max(MIN_DURATION_SECONDS, totalDurationRaw)
    );
    if (totalDuration < MIN_DURATION_SECONDS || totalDuration > MAX_DURATION_SECONDS) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        `Kling Omni-Video: duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds`
      );
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

    if (multiShot) {
      const multiPrompt = data?.multi_prompt ?? [];
      if (multiPrompt.length < 1 || multiPrompt.length > 6) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Kling Omni-Video: multi_prompt must have 1 to 6 storyboards when storyboard is enabled"
        );
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
      const sumDurations = multiPrompt.reduce((sum, s) => sum + (parseInt(s.duration, 10) || 0), 0);
      if (sumDurations !== totalDuration) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          `Kling Omni-Video: sum of storyboard durations (${sumDurations}) must equal total duration (${totalDuration})`
        );
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
      for (const shot of multiPrompt) {
        if ((shot.prompt?.length ?? 0) > 512) {
          await publishStatus(publish, step, nodeId, "error");
          const err = new NonRetriableError(
            `Kling Omni-Video: each storyboard prompt must not exceed 512 characters (shot index ${shot.index})`
          );
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
      }
    } else {
      const prompt = String(data?.prompt ?? "").trim();
      if (!prompt) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Kling Omni-Video: prompt is required when not using storyboard"
        );
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
      if (prompt.length > 2500) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError("Kling Omni-Video: prompt cannot exceed 2500 characters");
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
    }
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });

    const imageSources: Array<{ src: string; type?: "first_frame" | "end_frame" }> = [];
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
      model_name: data?.model_name ?? "kling-v3-omni",
      mode: data?.mode ?? "std",
      sound: data?.sound ?? "off",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: String(totalDuration),
    };
    if (multiShot) {
      body.multi_shot = true;
      body.shot_type = "customize";
      if (Array.isArray(data?.multi_prompt) && data.multi_prompt.length > 0) {
        body.multi_prompt = data.multi_prompt.map((shot, i) => ({
          index: i,
          prompt: compile(shot.prompt ?? ""),
          duration: String(shot.duration),
        }));
      }
    } else {
      const prompt = String(data?.prompt ?? "").trim();
      body.prompt = compile(prompt);
    }
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
