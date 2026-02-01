import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone } from "@/services/klingApi";

type KlingVideo2AudioData = {
  video_url?: string; // or template e.g. {{klingText2Video.videoUrl}}
  variables?: string;
};

const PATH = "/v1/audio/video2audio";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-v2a-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingVideo2AudioExecutor: NodeExecutor<KlingVideo2AudioData> = async ({
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
      await step.run(`kling-v2a-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const videoUrlRaw = String(data?.video_url ?? "").trim();
    const video_url = Handlebars.compile(videoUrlRaw)(context);
    if (!video_url) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Video-to-Audio: video_url is required (e.g. {{klingText2Video.videoUrl}})"
      );
      await step.run(`kling-v2a-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const body = { video_url };

    const { task_id } = await step.run("kling-v2a-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-v2a-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const audios = task.task_result?.audios ?? [];
    const audio = audios[0];
    const audioUrl = audio?.url ?? (audio as { url_mp3?: string })?.url_mp3;

    if (!audioUrl) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Video-to-Audio: no audio in result");
      await step.run(`kling-v2a-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingVideo2Audio");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        audioUrl,
        audioId: (audio as { id?: string })?.id,
        duration: (audio as { duration?: string })?.duration,
        task_id,
      },
    };
    await step.run("kling-v2a-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Video-to-Audio failed";
    await step.run(`kling-v2a-err-${nodeId}`, async () => {
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
