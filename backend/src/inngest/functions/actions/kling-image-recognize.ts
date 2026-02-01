import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingImageRecognizeData = {
  image?: string; // URL or template
  variables?: string;
};

const PATH = "/v1/images/recognize";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-recognize-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingImageRecognizeExecutor: NodeExecutor<KlingImageRecognizeData> = async ({
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
      await step.run(`kling-recognize-err-${nodeId}`, async () => {
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
    if (!imageInput) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Image Recognize: image is required");
      await step.run(`kling-recognize-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Image Recognize: could not resolve image");
      await step.run(`kling-recognize-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const body = { image: imageBase64 };

    const { task_id } = await step.run("kling-recognize-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-recognize-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 60000 });
    });

    // API may return segmentation URLs in task_result.images or a dedicated field
    const images = task.task_result?.images ?? [];
    const segmentationUrls = images.map((img: { url?: string }) => img.url).filter(Boolean) as string[];
    const result = (task.task_result as Record<string, unknown>) ?? {};
    const extraUrls = (result.segmentation_urls as string[]) ?? [];

    const variablesName = String(data?.variables ?? "klingImageRecognize");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls: segmentationUrls.length ? segmentationUrls : extraUrls,
        task_result: result,
        task_id,
      },
    };
    await step.run("kling-recognize-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Image Recognize failed";
    await step.run(`kling-recognize-err-${nodeId}`, async () => {
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
