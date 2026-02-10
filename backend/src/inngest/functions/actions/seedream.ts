import type { NodeExecutor } from "../types";
import { seedreamChannel } from "@/inngest/channels/seedream";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import {
  generateSeedreamImages,
  uploadImageForSeedream,
  type SeedreamImageData,
} from "@/services/seedreamApi";
import { basePrismaClient } from "@/lib/prisma";

type SeedreamMode = "text" | "image" | "multi";

type SeedreamData = {
  variables?: string;
  prompt?: string;
  mode?: SeedreamMode;
  // Single image (image-to-image, or base image for batch later)
  sourceImage?: string; // base64, URL, or asset:filename
  sourceImageFilename?: string;
  // Multiple reference images
  referenceImages?: Array<{ file: string; filename: string }>;
  // Image parameters
  size?: string; // e.g. "2K" or "2048x2048"
  // Sequential generation (batch) - optional future use
  sequentialImageGeneration?: "disabled" | "auto";
  maxImages?: number;
};

const publishStatus = async (
  publish: any,
  step: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  const stepId = `seedream-status-${nodeId}-${status}`;
  await step.run(stepId, async () => {
    await publish(seedreamChannel().status({ nodeId, status }));
  });
};

function normalizeBase64(data: string): string {
  if (data.startsWith("data:")) {
    return data.split(",")[1] || data;
  }
  return data;
}

async function resolveImageSource(
  source: string,
  context: Record<string, unknown>,
  compile: (s: string) => string,
  nodeAssets?: any[]
): Promise<string | null> {
  try {
    if (source.includes("{{") && source.includes("}}")) {
      source = compile(source);
    }

    if (source.startsWith("asset:") && nodeAssets) {
      const filename = source.replace("asset:", "").trim();
      const asset = nodeAssets.find((a: any) => a.filename === filename);
      if (asset?.fileData) {
        return normalizeBase64(asset.fileData);
      }
      return null;
    }

    if (source.startsWith("http://") || source.startsWith("https://")) {
      return source;
    }

    if (source.startsWith("data:") || (source.length > 100 && /^[A-Za-z0-9+/=]+$/.test(source))) {
      return normalizeBase64(source);
    }

    return null;
  } catch (error) {
    console.error("Error resolving Seedream image source:", error);
    return null;
  }
}

export const seedreamExecutor: NodeExecutor<SeedreamData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, step, nodeId, "loading");

    // Subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "SEEDREAM");

    // Consume premium quota
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`seedream-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.SEEDREAM || 1);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await step.run(`seedream-quota-err-${nodeId}`, async () => {
        await publish(
          seedreamChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    if (!process.env.ARK_API_KEY) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("ARK_API_KEY is not configured");
      await step.run(`seedream-err-${nodeId}`, async () => {
        await publish(
          seedreamChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const compile = (s: string) => Handlebars.compile(s)(context);
    const prompt = String(data?.prompt ?? "").trim();
    const mode: SeedreamMode = data?.mode || "text";
    const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
      where: { nodeId },
    });

    if (!prompt) {
      await publishStatus(publish, step, nodeId, "error");
      const err = new NonRetriableError("Seedream: prompt is required");
      await step.run(`seedream-err-${nodeId}-prompt`, async () => {
        await publish(
          seedreamChannel().output({
            nodeId,
            output: { ...context, error: { message: err.message } },
          })
        );
      });
      throw err;
    }

    const compiledPrompt = compile(prompt);

    // Resolve images based on mode
    let imageParam: string | string[] | undefined;

    if (mode === "image") {
      let sourceImage: string | null = null;
      let sourceFilename: string | undefined;

      if (data?.sourceImage) {
        const resolved = await resolveImageSource(
          data.sourceImage,
          context as Record<string, unknown>,
          compile,
          nodeAssets
        );
        if (resolved) {
          if (resolved.startsWith("http")) {
            sourceImage = resolved;
          } else {
            sourceImage = resolved;
            sourceFilename = data.sourceImageFilename;
          }
        }
      }

      if (!sourceImage && nodeAssets.length > 0) {
        const asset = nodeAssets[0];
        if (asset?.fileData) {
          sourceImage = normalizeBase64(asset.fileData);
          sourceFilename = asset.filename;
        }
      }

      if (!sourceImage) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError("Seedream: source image is required for image mode");
        await step.run(`seedream-err-${nodeId}-image`, async () => {
          await publish(
            seedreamChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }

      if (sourceImage.startsWith("http")) {
        imageParam = sourceImage;
      } else {
        const uploadedUrl = await uploadImageForSeedream(sourceImage, sourceFilename);
        imageParam = uploadedUrl;
      }
    } else if (mode === "multi") {
      const urls: string[] = [];

      if (data?.referenceImages?.length) {
        for (const ref of data.referenceImages) {
          if (!ref?.file) continue;
          const resolved = await resolveImageSource(
            ref.file,
            context as Record<string, unknown>,
            compile,
            nodeAssets
          );
          if (!resolved) continue;

          if (resolved.startsWith("http")) {
            urls.push(resolved);
          } else {
            const uploadedUrl = await uploadImageForSeedream(resolved, ref.filename);
            urls.push(uploadedUrl);
          }
        }
      }

      if (urls.length === 0 && nodeAssets.length > 0) {
        for (const asset of nodeAssets) {
          if (!asset?.fileData) continue;
          const uploadedUrl = await uploadImageForSeedream(
            normalizeBase64(asset.fileData),
            asset.filename
          );
          urls.push(uploadedUrl);
        }
      }

      if (urls.length === 0) {
        await publishStatus(publish, step, nodeId, "error");
        const err = new NonRetriableError("Seedream: at least one reference image is required");
        await step.run(`seedream-err-${nodeId}-multi`, async () => {
          await publish(
            seedreamChannel().output({
              nodeId,
              output: { ...context, error: { message: err.message } },
            })
          );
        });
        throw err;
      }

      imageParam = urls;
    }

    // Build request
    const size = data?.size || "2K";
    const sequentialImageGeneration = data?.sequentialImageGeneration || "disabled";
    const maxImages = data?.maxImages ?? undefined;

    const request: Parameters<typeof generateSeedreamImages>[0] = {
      model: "seedream-4-5-251128",
      prompt: compiledPrompt,
      size,
      response_format: "url",
      watermark: false,
    };

    if (imageParam !== undefined) {
      request.image = imageParam;
    }

    if (sequentialImageGeneration === "auto") {
      request.sequential_image_generation = "auto";
      if (maxImages && maxImages > 0) {
        request.sequential_image_generation_options = { max_images: maxImages };
      }
    }

    const result = await step.run(`seedream-generate-${nodeId}`, async () => {
      return generateSeedreamImages(request);
    });

    const images: SeedreamImageData[] = result.data || [];

    const variablesName = data?.variables?.trim() || "seedream";
    const outputPayload = {
      ...context,
      [variablesName]: {
        images,
        size,
        model: "seedream-4-5-251128",
      },
    };

    await step.run(`seedream-publish-output-${nodeId}`, async () => {
      await publish(
        seedreamChannel().output({
          nodeId,
          output: outputPayload,
        })
      );
    });

    await publishStatus(publish, step, nodeId, "success");
    return outputPayload;
  } catch (error) {
    console.error("Seedream executor error:", error);
    await publishStatus(publish, step, nodeId, "error");

    const message = error instanceof Error ? error.message : "Unknown Seedream error";
    await publish(
      seedreamChannel().output({
        nodeId,
        output: { ...context, error: { message } },
      })
    );

    throw new NonRetriableError(message);
  }
};
