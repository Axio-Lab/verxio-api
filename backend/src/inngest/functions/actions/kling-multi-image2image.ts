import type { NodeExecutor } from "../types";
import { klingChannel } from "@/inngest/channels/kling";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createTask, pollUntilDone, resolveImageSource } from "@/services/klingApi";
import { basePrismaClient } from "@/lib/prisma";

type KlingMultiImage2ImageData = {
  prompt?: string;
  model_name?: "kling-v2" | "kling-v2-1";
  subject_image_list?: string; // JSON array or comma-separated
  image_list?: string; // legacy support
  subjectImages?: Array<{ file: string; filename?: string }>;
  scene_image?: string;
  style_image?: string;
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
    const subjectListRaw = data?.subject_image_list?.trim() ?? data?.image_list?.trim();
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({ where: { nodeId } });

    if (!prompt && !subjectListRaw && !(data?.subjectImages && data.subjectImages.length > 0)) {
      const hasSceneAsset = nodeAssets.some(
        (a: any) => a.fileType === "kling-multi-image2image-scene"
      );
      const hasStyleAsset = nodeAssets.some(
        (a: any) => a.fileType === "kling-multi-image2image-style"
      );
      if (!hasSceneAsset && !hasStyleAsset) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError(
          "Kling Multi-Image-to-Image: prompt or subject_image_list is required"
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
    }

    const compile = (s: string) => Handlebars.compile(s)(context);
    const compiledPrompt = prompt ? compile(prompt) : undefined;

    const subjectSources: string[] = [];
    if (subjectListRaw) {
      try {
        const parsed = JSON.parse(compile(subjectListRaw)) as unknown;
        subjectSources.push(...(Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]));
      } catch {
        subjectSources.push(
          ...subjectListRaw.split(",").map((s) => compile(s.trim())).filter(Boolean)
        );
      }
    }

    if (Array.isArray(data?.subjectImages)) {
      subjectSources.push(
        ...data.subjectImages.map((img) => img.file).filter((val) => typeof val === "string")
      );
    }

    const resolveFromAssets = (filename: string) => {
      const asset = nodeAssets.find((a: any) => a.filename === filename);
      if (asset?.fileData) {
        return asset.fileData.startsWith("data:") ? asset.fileData.split(",")[1] : asset.fileData;
      }
      return null;
    };

    const subject_image_list: string[] = [];
    if (subjectSources.length > 0) {
      for (const src of subjectSources) {
        if (src.startsWith("asset:")) {
          const raw = resolveFromAssets(src.replace("asset:", "").trim());
          if (raw) subject_image_list.push(raw);
          continue;
        }
        const b64 = await resolveImageSource(src, context as Record<string, unknown>, compile);
        if (b64) subject_image_list.push(b64);
      }
    }

    if (subject_image_list.length === 0) {
      const subjectAssets = nodeAssets.filter(
        (a: any) => a.fileType === "kling-multi-image2image-subject"
      );
      for (const a of subjectAssets) {
        if (!a.fileData) continue;
        const raw = a.fileData.startsWith("data:") ? a.fileData.split(",")[1] : a.fileData;
        if (raw) subject_image_list.push(raw);
      }
    }

    if (subject_image_list.length > 4) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        "Kling Multi-Image-to-Image: subject_image_list supports up to 4 images"
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

    const resolveOptionalImage = async (
      input?: string,
      fileType?: string
    ): Promise<string | undefined> => {
      if (input) {
        if (input.startsWith("asset:") && fileType) {
          const raw = resolveFromAssets(input.replace("asset:", "").trim());
          if (raw) return raw;
        }
        const b64 = await resolveImageSource(input, context as Record<string, unknown>, compile);
        if (b64) return b64;
      }
      if (fileType) {
        const asset = nodeAssets.find((a: any) => a.fileType === fileType);
        if (asset?.fileData) {
          return asset.fileData.startsWith("data:")
            ? asset.fileData.split(",")[1]
            : asset.fileData;
        }
      }
      return undefined;
    };

    const sceneImage = await resolveOptionalImage(
      data?.scene_image,
      "kling-multi-image2image-scene"
    );
    const styleImage = await resolveOptionalImage(
      data?.style_image,
      "kling-multi-image2image-style"
    );

    const body: Record<string, unknown> = {
      model_name: data?.model_name ?? "kling-v2",
      n: typeof data?.n === "number" ? data.n : 1,
      aspect_ratio: data?.aspect_ratio ?? "16:9",
    };
    if (compiledPrompt) body.prompt = compiledPrompt;
    if (subject_image_list.length) {
      body.subject_image_list = subject_image_list.map((image) => ({ subject_image: image }));
    }
    if (sceneImage) body.scene_image = sceneImage;
    if (styleImage) body.style_image = styleImage;

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
