import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone } from "@/services/klingApi";

type KlingVideoExtendData = {
  video_id?: string; // from previous Kling video node, e.g. {{klingText2Video.videoId}}
  prompt?: string;
  negative_prompt?: string;
  cfg_scale?: number;
  variables?: string;
};

const PATH = "/v1/videos/video-extend";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-video-extend-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingVideoExtendExecutor: NodeExecutor<KlingVideoExtendData> = async ({
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
      await step.run(`kling-video-extend-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const videoIdRaw = String(data?.video_id ?? "").trim();
    const video_id = Handlebars.compile(videoIdRaw)(context);
    if (!video_id) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Video Extend: video_id is required (e.g. {{klingText2Video.videoId}})"
      );
      await step.run(`kling-video-extend-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const prompt = data?.prompt?.trim()
      ? Handlebars.compile(data.prompt)(context)
      : undefined;
    const negative_prompt = data?.negative_prompt?.trim()
      ? Handlebars.compile(data.negative_prompt)(context)
      : undefined;

    const body: Record<string, unknown> = {
      video_id,
      cfg_scale: typeof data?.cfg_scale === "number" ? data.cfg_scale : 0.5,
    };
    if (prompt) body.prompt = prompt;
    if (negative_prompt) body.negative_prompt = negative_prompt;

    const { task_id } = await step.run("kling-video-extend-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-video-extend-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Video Extend: no video in result");
      await step.run(`kling-video-extend-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingVideoExtend");
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
    await step.run("kling-video-extend-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Video Extend failed";
    await step.run(`kling-video-extend-err-${nodeId}`, async () => {
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
