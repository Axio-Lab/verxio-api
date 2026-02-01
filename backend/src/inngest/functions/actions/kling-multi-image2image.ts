import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMultiImage2ImageData = {
  prompt?: string;
  image_list?: string; // JSON array or comma-separated
  n?: number;
  aspect_ratio?: string;
  variables?: string;
};

const PATH = "/v1/images/multi-image2image";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-multi-i2i-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingMultiImage2ImageExecutor: NodeExecutor<KlingMultiImage2ImageData> = async ({
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
      await step.run(`kling-multi-i2i-err-${nodeId}`, async () => {
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
        "Kling Multi-Image-to-Image: prompt or image_list is required"
      );
      await step.run(`kling-multi-i2i-err-${nodeId}`, async () => {
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
      if (resolved.length > 0) image_list = resolved;
      else {
        const assets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });
        for (const a of assets) {
          if (a.fileData) {
            const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
            if (raw) image_list.push(raw);
          }
        }
      }
    }

    const body: Record<string, unknown> = {
      n: typeof data?.n === "number" ? data.n : 1,
      aspect_ratio: data?.aspect_ratio ?? "1:1",
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    if (image_list.length) body.image_list = image_list;

    const { task_id } = await step.run("kling-multi-i2i-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-multi-i2i-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const images = task.task_result?.images ?? [];
    const imageUrls = images.map((img: { url?: string }) => img.url).filter(Boolean) as string[];

    const variablesName = String(data?.variables ?? "klingMultiImage2Image");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls,
        task_id,
      },
    };
    await step.run("kling-multi-i2i-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Multi-Image-to-Image failed";
    await step.run(`kling-multi-i2i-err-${nodeId}`, async () => {
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
