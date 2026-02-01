import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMultiImage2VideoData = {
  prompt?: string;
  image_list?: string; // JSON array or comma-separated URLs/templates
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  variables?: string;
};

const PATH = "/v1/videos/multi-image2video";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-multi-i2v-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingMultiImage2VideoExecutor: NodeExecutor<KlingMultiImage2VideoData> = async ({
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
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
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
    const imageListRaw = data?.image_list?.trim();
    if (!prompt && !imageListRaw) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Multi-Image-to-Video: prompt or image_list is required"
      );
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
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
    const compiledPrompt = prompt ? compile(prompt) : undefined;

    let image_list: string[] = [];
    if (imageListRaw) {
      try {
        const parsed = JSON.parse(compile(imageListRaw)) as unknown;
        image_list = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        image_list = imageListRaw.split(",").map((s) => compile(s.trim())).filter(Boolean);
      }
      const resolved: string[] = [];
      for (const src of image_list) {
        const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
        if (b64) resolved.push(b64);
      }
      if (resolved.length === 0) {
        const assets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });
        for (const a of assets) {
          if (a.fileData) {
            const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
            if (raw) resolved.push(raw);
          }
        }
      }
      if (resolved.length > 0) image_list = resolved;
    }

    const body: Record<string, unknown> = {
      mode: data?.mode ?? "std",
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: data?.duration ?? "5",
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    if (image_list.length) body.image_list = image_list;

    const { task_id } = await step.run("kling-multi-i2v-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-multi-i2v-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Multi-Image-to-Video: no video in result");
      await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingMultiImage2Video");
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
    await step.run("kling-multi-i2v-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Multi-Image-to-Video failed";
    await step.run(`kling-multi-i2v-err-${nodeId}`, async () => {
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
