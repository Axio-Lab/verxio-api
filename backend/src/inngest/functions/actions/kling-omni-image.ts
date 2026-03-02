import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingOmniImageData = {
  prompt?: string;
  referenceImages?: Array<{ file: string; filename?: string }>;
  element_list?: string;
  resolution?: "1k" | "2k";
  n?: number;
  aspect_ratio?: string;
  variables?: string;
  model_name?: "kling-v3-omni";
};

const PATH = "/v1/images/omni-image";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-omni-image-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingOmniImageExecutor: NodeExecutor<KlingOmniImageData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    // Check subscription access for Kling nodes
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "KLING_OMNI_IMAGE");

    // Consume premium quota once per workflow run for this node
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`kling-omni-image-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.KLING_OMNI_IMAGE);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`kling-omni-image-quota-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    if (!process.env.KLING_ACCESS_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("KLING_ACCESS_KEY is not configured");
      await step.run(`kling-omni-image-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Omni-Image: prompt is required");
      await step.run(`kling-omni-image-err-${nodeId}`, async () => {
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
    const compiledPrompt = compile(prompt);
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });

    const imageSources: string[] = [];
    if (Array.isArray(data?.referenceImages)) {
      imageSources.push(...data.referenceImages.map((img) => img.file));
    }

    const image_list: string[] = [];
    for (const src of imageSources) {
      if (src.startsWith("asset:")) {
        const filename = src.replace("asset:", "").trim();
        const asset = nodeAssets.find((a: any) => a.filename === filename);
        if (asset?.fileData) {
          const raw = asset.fileData.startsWith("data:")
            ? asset.fileData.split(",")[1]
            : asset.fileData;
          if (raw) image_list.push(raw);
        }
        continue;
      }
      const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
      if (b64) image_list.push(b64);
    }

    if (image_list.length === 0) {
      const assetImages = nodeAssets.filter((a: any) => a.fileType === "kling-omni-image-image");
      for (const a of assetImages) {
        if (!a.fileData) continue;
        const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
        if (raw) image_list.push(raw);
      }
    }

    if (image_list.length > 9) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Omni-Image: maximum 9 reference images allowed"
      );
      await step.run(`kling-omni-image-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    let element_list: Array<{ element_id: number }> | undefined;
    const elementListRaw = data?.element_list?.trim();
    if (elementListRaw) {
      try {
        const parsed = JSON.parse(compile(elementListRaw)) as unknown;
        if (Array.isArray(parsed)) {
          element_list = parsed
            .map((item) => ({
              element_id: Number((item as any)?.element_id ?? item),
            }))
            .filter((item) => Number.isFinite(item.element_id));
        }
      } catch {
        element_list = undefined;
      }
    }

    const nRaw = typeof data?.n === "number" ? data.n : 1;
    if (nRaw < 1 || nRaw > 9) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Omni-Image: number of images must be between 1 and 9"
      );
      await step.run(`kling-omni-image-err-${nodeId}`, async () => {
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
      model_name: data?.model_name ?? "kling-v3-omni",
      prompt: compiledPrompt,
      resolution: data?.resolution ?? "1k",
      n: Math.floor(nRaw),
      aspect_ratio: data?.aspect_ratio ?? "auto",
    };
    if (image_list.length) body.image_list = image_list.map((image) => ({ image }));
    if (element_list && element_list.length > 0) body.element_list = element_list;

    const { task_id } = await step.run("kling-omni-image-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-omni-image-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const images = task.task_result?.images ?? [];
    const imageUrls = images.map((img: { url?: string }) => img.url).filter(Boolean) as string[];

    const variablesName = String(data?.variables ?? "klingOmniImage");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls,
        task_id,
      },
    };
    await step.run("kling-omni-image-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Omni-Image failed";
    await step.run(`kling-omni-image-err-${nodeId}`, async () => {
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
