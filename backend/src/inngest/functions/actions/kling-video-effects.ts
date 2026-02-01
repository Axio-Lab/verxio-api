import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingVideoEffectsData = {
  prompt?: string;
  effect_scene?: string;
  image?: string; // input image URL or template
  mode?: "std" | "pro";
  variables?: string;
};

const PATH = "/v1/videos/video-effects";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-vfx-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingVideoEffectsExecutor: NodeExecutor<KlingVideoEffectsData> = async ({
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
      await step.run(`kling-vfx-err-${nodeId}`, async () => {
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
    const effectScene = data?.effect_scene?.trim();
    if (!imageInput && !effectScene) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Video Effects: image or effect_scene is required"
      );
      await step.run(`kling-vfx-err-${nodeId}`, async () => {
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
    if (imageInput) {
      imageBase64 = await resolveImageSource(
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
    }

    const body: Record<string, unknown> = {
      mode: data?.mode ?? "std",
    };
    if (data?.prompt?.trim()) body.prompt = compile(data.prompt);
    if (effectScene) body.effect_scene = compile(effectScene);
    if (imageBase64) body.image = imageBase64;

    const { task_id } = await step.run("kling-vfx-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-vfx-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Video Effects: no video in result");
      await step.run(`kling-vfx-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingVideoEffects");
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
    await step.run("kling-vfx-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Video Effects failed";
    await step.run(`kling-vfx-err-${nodeId}`, async () => {
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
