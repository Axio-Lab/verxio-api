import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone } from "@/services/klingApi";

const MAX_DURATION = 15;
const MIN_DURATION = 1;

type KlingText2VideoMultiPromptItem = {
  index: number;
  prompt: string;
  duration: string;
};

type KlingText2VideoData = {
  variables?: string;
  prompt?: string;
  negative_prompt?: string;
  model_name?: "kling-v3";
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  duration?: number | string;
  sound?: "on" | "off";
  multi_shot?: boolean;
  multi_prompt?: KlingText2VideoMultiPromptItem[];
  camera_control?: {
    type?: "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward";
    config?: {
      horizontal?: number;
      vertical?: number;
      pan?: number;
      tilt?: number;
      roll?: number;
      zoom?: number;
    };
  };
};

const PATH = "/v1/videos/text2video";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-t2v-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingText2VideoExecutor: NodeExecutor<KlingText2VideoData> = async ({
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
    await checkNodeAccess(userId, "KLING_TEXT2VIDEO");

    // Consume premium quota once per workflow run for this node
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`kling-text2video-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.KLING_TEXT2VIDEO);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`kling-text2video-quota-err-${nodeId}`, async () => {
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
      await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
        `Kling Text-to-Video: duration must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`
      );
      await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
          "Kling Text-to-Video: multi_prompt must have 1 to 6 storyboards when storyboard is enabled"
        );
        await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
          `Kling Text-to-Video: sum of storyboard durations (${sumDurations}) must equal total duration (${totalDuration})`
        );
        await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
            `Kling Text-to-Video: each storyboard prompt must not exceed 512 characters (shot index ${shot.index})`
          );
          await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
          "Kling Text-to-Video: prompt is required when not using storyboard"
        );
        await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
        const err = new NonRetriableError(
          "Kling Text-to-Video: prompt cannot exceed 2500 characters"
        );
        await step.run(`kling-t2v-err-${nodeId}`, async () => {
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

    const compiledNegative = data?.negative_prompt ? compile(data.negative_prompt) : undefined;

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-v3",
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: String(totalDuration),
      sound: data?.sound ?? "off",
    };
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
      body.prompt = compile(String(data?.prompt ?? "").trim());
    }
    if (compiledNegative) body.negative_prompt = compiledNegative;
    if (data?.camera_control?.type) {
      body.camera_control =
        data.camera_control.type === "simple"
          ? {
              type: data.camera_control.type,
              config: {
                horizontal: data.camera_control.config?.horizontal ?? 0,
                vertical: data.camera_control.config?.vertical ?? 0,
                pan: data.camera_control.config?.pan ?? 0,
                tilt: data.camera_control.config?.tilt ?? 0,
                roll: data.camera_control.config?.roll ?? 0,
                zoom: data.camera_control.config?.zoom ?? 0,
              },
            }
          : {
              type: data.camera_control.type,
            };
    }

    const { task_id } = await step.run("kling-t2v-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-t2v-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Text-to-Video: no video in result");
      await step.run(`kling-t2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingText2Video");
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
    await step.run("kling-t2v-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Text-to-Video failed";
    await step.run(`kling-t2v-err-${nodeId}`, async () => {
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
