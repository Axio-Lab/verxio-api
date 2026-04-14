import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

const MAX_DURATION = 15;
const MIN_DURATION = 1;

type KlingImage2VideoMultiPromptItem = {
  index: number;
  prompt: string;
  duration: string;
};

type KlingImage2VideoData = {
  variables?: string;
  prompt?: string;
  image?: string;
  model_name?: "kling-v3";
  mode?: "std" | "pro";
  duration?: number | string;
  sound?: "on" | "off";
  negative_prompt?: string;
  multi_shot?: boolean;
  multi_prompt?: KlingImage2VideoMultiPromptItem[];
};

const PATH = "/v1/videos/image2video";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-i2v-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingImage2VideoExecutor: NodeExecutor<KlingImage2VideoData> = async ({
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
    await checkNodeAccess(userId, "KLING_IMAGE2VIDEO");

    // Consume premium quota once per workflow run for this node
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`kling-image2video-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.KLING_IMAGE2VIDEO);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`kling-image2video-quota-err-${nodeId}`, async () => {
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
      await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
    const totalDurationRaw = Math.floor(Number(data?.duration) ?? 5);
    const totalDuration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, totalDurationRaw));
    if (totalDuration < MIN_DURATION || totalDuration > MAX_DURATION) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        `Kling Image-to-Video: duration must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`
      );
      await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
    const imageInput = data?.image?.trim();
    if (multiShot) {
      const multiPrompt = data?.multi_prompt ?? [];
      if (multiPrompt.length < 1 || multiPrompt.length > 6) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Kling Image-to-Video: multi_prompt must have 1 to 6 storyboards when storyboard is enabled"
        );
        await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
          `Kling Image-to-Video: sum of storyboard durations (${sumDurations}) must equal total duration (${totalDuration})`
        );
        await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
            `Kling Image-to-Video: each storyboard prompt must not exceed 512 characters (shot index ${shot.index})`
          );
          await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
    }
    if (!multiShot && !imageInput && !prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Image-to-Video: when not using storyboard, at least one of image or prompt is required"
      );
      await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
    let imageBase64: string | null = null;
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId },
    });
    if (imageInput) {
      imageBase64 = await step.run("kling-i2v-resolve-image", async () => {
        const resolved = await resolveImageSource(
          imageInput,
          context as Record<string, unknown>,
          compile
        );
        if (resolved) return resolved;
        for (const a of nodeAssets) {
          if (!a.fileData) continue;
          const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
          if (raw) return raw;
        }
        return null;
      });
    } else if (nodeAssets.length > 0) {
      for (const a of nodeAssets) {
        if (!a.fileData) continue;
        const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
        if (raw) {
          imageBase64 = raw;
          break;
        }
      }
    }

    const compiledPrompt = prompt ? compile(prompt) : undefined;
    const compiledNegative = data?.negative_prompt ? compile(data.negative_prompt) : undefined;

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-v3",
      mode: data?.mode ?? "std",
      duration: String(totalDuration),
      sound: data?.sound ?? "off",
    };
    if (imageBase64) body.image = imageBase64;
    if (multiShot) {
      body.multi_shot = true;
      body.shot_type = "customize";
      const multiPrompt = data?.multi_prompt ?? [];
      if (multiPrompt.length > 0) {
        body.multi_prompt = multiPrompt.map((shot, i) => ({
          index: i,
          prompt: compile(shot.prompt ?? ""),
          duration: String(shot.duration),
        }));
      }
    } else {
      if (compiledPrompt) body.prompt = compiledPrompt;
    }
    if (compiledNegative) body.negative_prompt = compiledNegative;

    const { task_id } = await step.run("kling-i2v-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-i2v-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Image-to-Video: no video in result");
      await step.run(`kling-i2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingImage2Video");
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
    await step.run("kling-i2v-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Image-to-Video failed";
    await step.run(`kling-i2v-err-${nodeId}`, async () => {
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
