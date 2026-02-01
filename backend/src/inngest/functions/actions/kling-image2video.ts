import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingImage2VideoData = {
  variables?: string;
  prompt?: string;
  image?: string; // URL, base64, or Handlebars template
  model_name?: string;
  mode?: "std" | "pro";
  duration?: "5" | "10";
  negative_prompt?: string;
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
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

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

    const prompt = String(data?.prompt ?? "").trim();
    const imageInput = data?.image?.trim();
    if (!imageInput && !prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Image-to-Video: at least one of image or prompt is required"
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
    const compiledNegative = data?.negative_prompt
      ? compile(data.negative_prompt)
      : undefined;

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-v1",
      mode: data?.mode ?? "std",
      duration: data?.duration ?? "5",
    };
    if (imageBase64) body.image = imageBase64;
    if (compiledPrompt) body.prompt = compiledPrompt;
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
