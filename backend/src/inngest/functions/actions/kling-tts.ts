import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { klingFetch } from "@/services/klingApi";

type KlingTtsData = {
  text?: string;
  voice_id?: string;
  voice_language?: "zh" | "en";
  voice_speed?: number;
};

const PATH = "/v1/audio/tts";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-tts-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

type TtsResponseData = {
  task_id?: string;
  task_status?: string;
  task_result?: {
    audios?: Array<{
      id: string;
      url: string;
      duration?: string;
    }>;
  };
};

export const klingTtsExecutor: NodeExecutor<KlingTtsData> = async ({
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
      await step.run(`kling-tts-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const text = String(data?.text ?? "").trim();
    if (!text) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling TTS: text is required");
      await step.run(`kling-tts-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const voice_id = String(data?.voice_id ?? "").trim();
    if (!voice_id) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling TTS: voice_id is required");
      await step.run(`kling-tts-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const compiledText = Handlebars.compile(text)(context);

    const body = {
      text: compiledText,
      voice_id,
      voice_language: data?.voice_language ?? "en",
      voice_speed: typeof data?.voice_speed === "number" ? data.voice_speed : 1.0,
    };

    const res = await step.run("kling-tts-create", async () => {
      return klingFetch<TtsResponseData>(PATH, {
        method: "POST",
        body: body as Record<string, unknown>,
      });
    });

    const d = res.data as TtsResponseData;
    const audios = d.task_result?.audios ?? [];
    const audio = audios[0];
    if (!audio?.url) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling TTS: no audio in result");
      await step.run(`kling-tts-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingTts");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        audioUrl: audio.url,
        audioId: audio.id,
        duration: audio.duration,
        task_id: d.task_id,
      },
    };
    await step.run("kling-tts-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling TTS failed";
    await step.run(`kling-tts-err-${nodeId}`, async () => {
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
