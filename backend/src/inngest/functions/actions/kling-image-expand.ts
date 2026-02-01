import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingImageExpandData = {
  prompt?: string;
  image?: string;
  aspect_ratio?: string;
  variables?: string;
};

const PATH = "/v1/images/expand";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-expand-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingImageExpandExecutor: NodeExecutor<KlingImageExpandData> = async ({
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
      await step.run(`kling-expand-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Image Expand: image is required");
      await step.run(`kling-expand-err-${nodeId}`, async () => {
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
      const err = new NonRetriableError("Kling Image Expand: could not resolve image");
      await step.run(`kling-expand-err-${nodeId}`, async () => {
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
      image: imageBase64,
      aspect_ratio: data?.aspect_ratio ?? "1:1",
    };
    if (data?.prompt?.trim()) body.prompt = compile(data.prompt);

    const { task_id } = await step.run("kling-expand-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-expand-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 3000, maxWaitMs: 120000 });
    });

    const images = task.task_result?.images ?? [];
    const imageUrls = images.map((img: { url?: string }) => img.url).filter(Boolean) as string[];

    const variablesName = String(data?.variables ?? "klingImageExpand");
    await publishStatus(publish, step, nodeId, "success");
    const output = {
      ...context,
      [variablesName]: {
        imageUrls,
        task_id,
      },
    };
    await step.run("kling-expand-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Image Expand failed";
    await step.run(`kling-expand-err-${nodeId}`, async () => {
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
