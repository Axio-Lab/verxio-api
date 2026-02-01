import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingImageData = {
  variables?: string;
  prompt?: string;
  negative_prompt?: string;
  model_name?: string;
  image?: string; // optional reference image
  image_reference?: "subject" | "face";
  image_fidelity?: number;
  human_fidelity?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";
  n?: number;
  resolution?: "1k" | "2k";
};

const PATH = "/v1/images/generations";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-img-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingImageExecutor: NodeExecutor<KlingImageData> = async ({
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
      await step.run(`kling-img-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Image: prompt is required");
      await step.run(`kling-img-err-${nodeId}`, async () => {
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
    const imageInput = data?.image?.trim();
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId },
    });
    if (imageInput) {
      imageBase64 = await step.run("kling-img-resolve-image", async () => {
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

    const modelName = data?.model_name ?? "kling-v1";
    if (imageBase64 && modelName === "kling-v1-5" && !data?.image_reference) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Image: image_reference is required when using kling-v1-5 with a reference image"
      );
      await step.run(`kling-img-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const body: Record<string, unknown> = {
      model_name: modelName,
      prompt: compile(prompt),
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      n: Math.min(9, Math.max(1, Number(data?.n) || 1)),
      resolution: data?.resolution ?? "1k",
    };
    if (!imageBase64 && data?.negative_prompt) {
      body.negative_prompt = compile(data.negative_prompt);
    }
    if (imageBase64) body.image = imageBase64;
    if (imageBase64 && modelName === "kling-v1-5" && data?.image_reference) {
      body.image_reference = data.image_reference;
      if (typeof data.image_fidelity === "number") {
        body.image_fidelity = data.image_fidelity;
      }
      if (data.image_reference === "subject" && typeof data.human_fidelity === "number") {
        body.human_fidelity = data.human_fidelity;
      }
    }

    const { task_id } = await step.run("kling-img-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-img-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const images = task.task_result?.images ?? [];
    if (images.length === 0) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Image: no images in result");
      await step.run(`kling-img-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const imageUrls = images.map((img) => img.url).filter(Boolean);
    const variablesName = String(data?.variables ?? "klingImage");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls,
        images: task.task_result?.images,
        task_id,
      },
    };
    await step.run("kling-img-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Image failed";
    await step.run(`kling-img-err-${nodeId}`, async () => {
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
