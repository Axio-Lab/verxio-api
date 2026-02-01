import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMotionControlData = {
  prompt?: string;
  image?: string;
  video_url?: string; // reference video URL or template
  mode?: "std" | "pro";
  aspect_ratio?: string;
  duration?: string;
  variables?: string;
};

const PATH = "/v1/videos/motion-control";

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `kling-motion-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(klingChannel().status({ nodeId, status }));
  });
};

export const klingMotionControlExecutor: NodeExecutor<KlingMotionControlData> = async ({
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
      await step.run(`kling-motion-err-${nodeId}`, async () => {
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
    if (!prompt && !imageInput) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Motion Control: prompt or image is required"
      );
      await step.run(`kling-motion-err-${nodeId}`, async () => {
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
      aspect_ratio: data?.aspect_ratio ?? "16:9",
      duration: data?.duration ?? "5",
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    if (imageBase64) body.image = imageBase64;
    if (data?.video_url?.trim()) body.video_url = compile(data.video_url);

    const { task_id } = await step.run("kling-motion-create", async () => {
      return createTask(PATH, body);
    });

    const task = await step.run("kling-motion-poll", async () => {
      return pollUntilDone(PATH, task_id, { intervalMs: 4000, maxWaitMs: 600000 });
    });

    const video = task.task_result?.videos?.[0];
    if (!video) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Kling Motion Control: no video in result");
      await step.run(`kling-motion-err-${nodeId}`, async () => {
        await publish(
          klingChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const variablesName = String(data?.variables ?? "klingMotionControl");
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
    await step.run("kling-motion-output", async () => {
      await publish(klingChannel().output({ nodeId, output }));
    });
    return output;
  } catch (e) {
    await publishStatus(publish, step, nodeId, "error");
    const message = e instanceof Error ? e.message : "Kling Motion Control failed";
    await step.run(`kling-motion-err-${nodeId}`, async () => {
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
