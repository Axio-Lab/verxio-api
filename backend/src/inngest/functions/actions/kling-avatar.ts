import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingAvatarData = {
  prompt?: string;
  image?: string; // portrait image
  audio_url?: string; // or template e.g. {{klingTts.audioUrl}}
  mode?: "std" | "pro";
  variables?: string;
};

const PATH = "/v1/videos/avatar";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-avatar-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingAvatarExecutor: NodeExecutor<KlingAvatarData> = async ({
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
      await step.run(`kling-avatar-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const imageInput = data?.image?.trim();
    const audioInput = data?.audio_url?.trim();
    if (!imageInput || !audioInput) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Avatar: image and audio_url are required"
      );
      await step.run(`kling-avatar-err-${nodeId}`, async () => {
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
    let imageBase64 = await resolveImageSource(
      imageInput,
      context as Record<string, unknown>,
      compile
    );
    if (!imageBase64) {
      const assets = await (basePrismaClient as any).nodeAsset.findMany({
        where: { nodeId },
      });
      for (const a of assets) {
        if (a.fileData) {
          const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
          if (raw) {
            imageBase64 = raw;
            break;
          }
        }
      }
    }
    if (!imageBase64) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Avatar: could not resolve image");
      await step.run(`kling-avatar-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const audio_url = compile(audioInput);
    const body: Record<string, unknown> = {
      image: imageBase64,
      audio_url,
      mode: data?.mode ?? "std",
    };
    if (data?.prompt?.trim()) body.prompt = compile(data.prompt);

    const { task_id } = await step.run("kling-avatar-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-avatar-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Avatar: no video in result");
      await step.run(`kling-avatar-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingAvatar");
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
    await step.run("kling-avatar-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Avatar failed";
    await step.run(`kling-avatar-err-${nodeId}`, async () => {
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
