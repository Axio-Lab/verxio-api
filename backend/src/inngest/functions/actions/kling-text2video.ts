import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone } from "@/services/klingApi";

type KlingText2VideoData = {
  variables?: string;
  prompt?: string;
  negative_prompt?: string;
  model_name?: string;
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  duration?: "5" | "10";
  sound?: "on" | "off";
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
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

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

    const prompt = String(data?.prompt ?? "").trim();
    if (!prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Text-to-Video: prompt is required");
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

    const compiledPrompt = Handlebars.compile(prompt)(context);
    const compiledNegative = data?.negative_prompt
      ? Handlebars.compile(data.negative_prompt)(context)
      : undefined;

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-v1",
      prompt: compiledPrompt,
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: data?.duration ?? "5",
      sound: data?.sound ?? "off",
    };
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
