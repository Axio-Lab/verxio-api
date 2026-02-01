import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingVirtualTryonData = {
  human_image?: string; // person image URL or template
  cloth_image?: string; // garment image URL or template
  model_name?: "kolors-virtual-try-on-v1" | "kolors-virtual-try-on-v1-5";
  variables?: string;
};

const PATH = "/v1/images/virtual-tryon";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-tryon-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

async function resolveImage(
  source: string,
  context: Record<string, unknown>,
  compile: (s: string) => string,
  nodeId: string,
  fileType: "kling-tryon-human" | "kling-tryon-cloth"
): Promise<string | null> {
  if (source.startsWith("asset:")) {
    const filename = source.replace("asset:", "").trim();
    const asset = await (basePrismaClient as any).nodeAsset.findFirst({
      where: { nodeId, filename, fileType },
    });
    if (asset?.fileData) {
      return asset.fileData.startsWith("data:")
        ? asset.fileData.split(",")[1]
        : asset.fileData;
    }
  }
  const resolved = await resolveImageSource(source, context, compile);
  if (resolved) return resolved;
  const assets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });
  const match = assets.find((a: any) => a.fileType === fileType);
  if (match?.fileData) {
    return match.fileData.startsWith("data:") ? match.fileData.split(",")[1] : match.fileData;
  }
  return null;
}

export const klingVirtualTryonExecutor: NodeExecutor<KlingVirtualTryonData> = async ({
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
      await step.run(`kling-tryon-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    let humanInput = data?.human_image?.trim();
    let clothInput = data?.cloth_image?.trim();
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });
    if (!humanInput) {
      const humanAsset = nodeAssets.find((a: any) => a.fileType === "kling-tryon-human");
      if (humanAsset?.filename) {
        humanInput = `asset:${humanAsset.filename}`;
      }
    }
    if (!clothInput) {
      const clothAsset = nodeAssets.find((a: any) => a.fileType === "kling-tryon-cloth");
      if (clothAsset?.filename) {
        clothInput = `asset:${clothAsset.filename}`;
      }
    }
    if (!humanInput || !clothInput) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Virtual Try-On: human_image and cloth_image are required"
      );
      await step.run(`kling-tryon-err-${nodeId}`, async () => {
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
    const normalizeBase64 = (value: string | null) => {
      if (!value) return value;
      return value.startsWith("data:") ? value.split(",")[1] || null : value;
    };
    const human_image = normalizeBase64(
      await step.run("kling-tryon-resolve-human", async () =>
        resolveImage(humanInput!, context, compile, nodeId, "kling-tryon-human")
      )
    );
    const cloth_image = normalizeBase64(
      await step.run("kling-tryon-resolve-cloth", async () =>
        resolveImage(clothInput!, context, compile, nodeId, "kling-tryon-cloth")
      )
    );

    if (!human_image || !cloth_image) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Virtual Try-On: could not resolve human_image or cloth_image"
      );
      await step.run(`kling-tryon-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const body = {
      model_name: data?.model_name ?? "kolors-virtual-try-on-v1",
      human_image,
      cloth_image,
    };

    const { task_id } = await step.run("kling-tryon-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-tryon-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const images = task.task_result?.images ?? [];
    const imageUrls = images.map((img: { url?: string }) => img.url).filter(Boolean) as string[];

    const variablesName = String(data?.variables ?? "klingVirtualTryon");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls,
        task_id,
      },
    };
    await step.run("kling-tryon-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Virtual Try-On failed";
    await step.run(`kling-tryon-err-${nodeId}`, async () => {
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
