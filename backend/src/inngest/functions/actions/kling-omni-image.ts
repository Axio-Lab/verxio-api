import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingOmniImageData = {
  prompt?: string;
  image_list?: string;
  resolution?: string;
  n?: number;
  aspect_ratio?: string;
  variables?: string;
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
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

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

    let image_list: string[] | undefined;
    const imageListRaw = data?.image_list?.trim();
    if (imageListRaw) {
      try {
        const parsed = JSON.parse(compile(imageListRaw)) as unknown;
        image_list = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        image_list = [compile(imageListRaw)];
      }
      const resolved: string[] = [];
      for (const src of image_list) {
        const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
        if (b64) resolved.push(b64);
        else {
          const assets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });
          for (const a of assets) {
            if (a.fileData) {
              const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
              if (raw) {
                resolved.push(raw);
                break;
              }
            }
          }
        }
      }
      if (resolved.length > 0) image_list = resolved;
    }

    const body: Record<string, unknown> = {
      prompt: compiledPrompt,
      resolution: data?.resolution ?? "1080p",
      n: typeof data?.n === "number" ? data.n : 1,
      aspect_ratio: data?.aspect_ratio ?? "1:1",
    };
    if (image_list?.length) body.image_list = image_list;

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
