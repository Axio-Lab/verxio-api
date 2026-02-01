import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone } from "@/services/klingApi";

type KlingText2AudioData = {
  prompt?: string;
  duration?: number;
  variables?: string;
};

const PATH = "/v1/audio/text-to-audio";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-text2audio-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingText2AudioExecutor: NodeExecutor<KlingText2AudioData> = async ({
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
      await step.run(`kling-text2audio-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Text-to-Audio: prompt is required");
      await step.run(`kling-text2audio-err-${nodeId}`, async () => {
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
    const body: Record<string, unknown> = {
      prompt: compiledPrompt,
      duration: typeof data?.duration === "number" ? data.duration : 10,
    };

    const { task_id } = await step.run("kling-text2audio-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-text2audio-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const audios = task.task_result?.audios ?? [];
    const audio = audios[0];
    const audioUrl = audio?.url ?? (audio as { url_mp3?: string })?.url_mp3;

    if (!audioUrl) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Text-to-Audio: no audio in result");
      await step.run(`kling-text2audio-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingText2Audio");
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
    await step.run("kling-text2audio-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Text-to-Audio failed";
    await step.run(`kling-text2audio-err-${nodeId}`, async () => {
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
