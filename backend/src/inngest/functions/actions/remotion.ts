import type { NodeExecutor } from "../types";
import { remotionChannel } from "@/inngest/channels/remotion";
import { NonRetriableError } from "inngest";
import { generateCodeWithAgent } from "@/services/claude-agent/claudeAgentService";
import { loadRemotionSkills } from "@/services/claude-agent/remotion-skills";
import { basePrismaClient } from "@/lib/prisma";

type RemotionAsset = {
  file: string;
  filename: string;
  type: "image" | "video" | "audio";
  sceneDescription?: string;
  startTime?: number;
  position?: { x?: number; y?: number };
  size?: { width?: number; height?: number };
};

type RemotionData = {
  variables?: string;
  prompt?: string;
  videoFormat?: "16:9" | "9:16" | "1:1" | "4:3" | "21:9";
  backgroundAudio?: string;
  backgroundAudioFilename?: string;
  backgroundAudioVolume?: number;
  assets?: RemotionAsset[];
};

const VIDEO_FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
};

const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "rendering" | "error" | "success"
) => {
  await publish(
    remotionChannel().status({
      nodeId,
      status,
    })
  );
};

const extractBase64FromDataUrl = (fileInput: string): string | null => {
  if (!fileInput || fileInput.trim() === "") {
    return null;
  }
  if (fileInput.startsWith("data:")) {
    const base64Match = fileInput.match(/base64,(.+)/);
    return base64Match ? base64Match[1] : null;
  }
  if (fileInput.length > 100 && !fileInput.startsWith("http")) {
    return fileInput;
  }
  return null;
};

const fetchFileAsBase64 = async (fileInput: string): Promise<string | null> => {
  if (!fileInput || fileInput.startsWith("http://") || fileInput.startsWith("https://")) {
    try {
      const response = await fetch(fileInput, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        console.error(`Failed to fetch file from ${fileInput}: ${response.statusText}`);
        return null;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) {
        return null;
      }
      return Buffer.from(buffer).toString("base64");
    } catch (error) {
      console.error(`Error fetching file from ${fileInput}:`, error);
      return null;
    }
  }
  return null;
};

export const remotionExecutor: NodeExecutor<RemotionData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");
    // Check subscription access
    const { checkNodeAccess } = await import("@/services/subscriptionCheck");
    await checkNodeAccess(userId, "REMOTION");

    // Consume premium quota once per workflow run (inside step.run so Inngest memoizes across resumes)
    const { consumePremiumQuota } = await import("@/services/subscriptionService");
    const { QUOTA_COST } = await import("@/config/rate-limits");
    try {
      await step.run(`remotion-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, QUOTA_COST.REMOTION);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...context,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }

    // CRITICAL: Extract ALL data into primitives IMMEDIATELY
    // data should NOT contain assets (getWorkflowForExecution doesn't merge them)
    // But we still extract to primitives to avoid any closure capture
    const variablesName = String(data?.variables || "remotion");
    const promptText = String(data?.prompt || "");
    const videoFormat = String(data?.videoFormat || "16:9");
    const renderServerUrl = String(process.env.REMOTION_SERVER_URL || "");

    if (!promptText) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("REMOTION node: Prompt is required");
      const minimalContext: Record<string, any> = {};
      if (context) {
        for (const key of Object.keys(context).slice(0, 3)) {
          const val = context[key];
          if (typeof val === "string" || (val && typeof val === "object" && "videoUrl" in val)) {
            minimalContext[key] = val;
          }
        }
      }
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...minimalContext,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }

    if (!renderServerUrl) {
      throw new NonRetriableError("REMOTION server URL is not set");
    }

    // Extract minimal context metadata (not values) - limit to prevent large context
    const contextKeys = Object.keys(context || {}).slice(0, 5);
    const contextMetadata: Array<{ key: string; hasVideoUrl: boolean; isString: boolean }> = [];
    for (const key of contextKeys) {
      const val = context?.[key];
      contextMetadata.push({
        key,
        hasVideoUrl: Boolean(val && typeof val === "object" && val !== null && "videoUrl" in val),
        isString: typeof val === "string",
      });
    }

    // Store all as local primitives (will be captured in closure, but they're small)
    const localPromptText = promptText;
    const localVideoFormat = videoFormat;
    const localRenderServerUrl = renderServerUrl;
    const localNodeId = nodeId;
    const localUserId = userId;
    const localContextMetadata = contextMetadata;
    const localVariablesName = variablesName;

    // CRITICAL: Everything happens in ONE step
    // data and context are NOT referenced inside step - only local primitives are used
    // All large data (assets, code, skills) is loaded/generated INSIDE the step
    const renderResult = await step.run("generate-and-render-video", async () => {
      // Load assets from database (inside step - not in closure)
      const nodeAssets = await (basePrismaClient as any).nodeAsset.findMany({
        where: { nodeId: localNodeId },
      });

      // Build asset info for prompt
      let assetInfo = "";
      const bgAudio = nodeAssets.find((a: any) => a.isBackgroundAudio);
      if (bgAudio) {
        const filename = bgAudio.filename.replace(/[<>:"/\\|?*]/g, "_").trim();
        const volume = bgAudio.volume ?? 0.7;
        assetInfo += `Background audio:\n- ${filename}: Volume ${volume}, plays from start (frame 0) to end of composition. Use <Audio> component from @remotion/media with staticFile('${filename}') and volume={${volume}}.\n\n`;
      }

      const regularAssets = nodeAssets.filter((a: any) => !a.isBackgroundAudio);
      if (regularAssets.length > 0) {
        assetInfo += "Available assets:\n";
        for (const asset of regularAssets) {
          const filename = asset.filename.replace(/[<>:"/\\|?*]/g, "_").trim();
          const timing = asset.startTime
            ? `Appears at ${asset.startTime} seconds`
            : "Appears at 0 seconds";
          const pos = asset.position
            ? `, positioned at (${asset.position.x ?? 0}, ${asset.position.y ?? 0})`
            : "";
          const size = asset.size
            ? `, size ${asset.size.width ?? "auto"}x${asset.size.height ?? "auto"}`
            : "";
          const desc = asset.sceneDescription ? `\n  Description: "${asset.sceneDescription}"` : "";
          assetInfo += `- ${filename} (${asset.fileType}): ${timing}${pos}${size}.${desc}\n`;
        }
        assetInfo +=
          "\nUse staticFile('filename.ext') to reference each asset. Follow the scene descriptions to position and animate them correctly.\n";
      }

      // Build context string from metadata
      const contextString =
        localContextMetadata.length > 0
          ? localContextMetadata
              .map((item) => {
                if (item.hasVideoUrl) {
                  return `- inputs.${item.key}.videoUrl: The rendered video URL (string)\n- inputs.${item.key}.success: Whether rendering succeeded (boolean)`;
                }
                if (item.key === "videoUrl" && item.isString) {
                  return `- inputs.videoUrl: The rendered video URL from Remotion node (string)`;
                }
                return `- inputs.${item.key}: Available from previous node`;
              })
              .join("\n")
          : "No specific inputs from previous nodes";

      // Load skills (inside step)
      const skillsContent = await loadRemotionSkills();

      // Build prompt (inside step)
      const defaultDims = VIDEO_FORMAT_DIMENSIONS[localVideoFormat];
      const remotionPrompt = `Generate Remotion composition code for: ${localPromptText}

⚠️ CRITICAL: You MUST follow all Remotion best practices and rules provided below. These are REQUIRED, not optional.

Video format: ${localVideoFormat} (default dimensions: ${defaultDims.width}x${defaultDims.height} if not specified in prompt)

${assetInfo ? `${assetInfo}\n` : ""}

AVAILABLE INPUTS FROM PREVIOUS NODES:
${contextString}

NOTE: If a Remotion node output is available, you can access the video URL using:
- inputs.[variableName].videoUrl (e.g., inputs.remotion.videoUrl)
- inputs.videoUrl (direct access, also available)

${skillsContent}

## CRITICAL: FOLLOW REMOTION BEST PRACTICES

You MUST strictly follow all Remotion best practices and rules documented above. Key requirements:

1. **ALWAYS use Remotion components**: Use <Img> from 'remotion' for images, <Video> and <Audio> from '@remotion/media' for media
2. **NEVER use CSS animations**: All animations MUST be driven by useCurrentFrame() hook
3. **Use staticFile() for assets**: Always use staticFile('filename.ext') to reference files from the public folder
4. **Proper project structure**: Must include index.ts (with registerRoot), Root.tsx (with Composition), and composition component files
5. **Animation patterns**: Use interpolate() for linear animations, spring() for natural motion, Sequence for timing
6. **No third-party animations**: Disable all animations from third-party libraries, drive everything from useCurrentFrame()
7. **Type safety**: Include proper TypeScript types for all components and props

Refer to the detailed rules above for specific patterns (animations, assets, audio, sequencing, etc.).

## PROJECT STRUCTURE REQUIREMENTS:

1. Generate a complete Remotion project with:
   - index.ts: Entry point that registers the root using registerRoot()
   - Root.tsx: Composition definitions using <Composition> component
   - At least one composition component file with the actual video content

2. Extract from the prompt:
   - compositionId: Extract or auto-generate a unique ID
   - fps: Detect from prompt (default 30 if not specified)
   - durationInFrames: Calculate from duration mentioned in prompt (durationInFrames = duration_in_seconds * fps)
   - If duration is not mentioned, default to 10 seconds (300 frames at 30fps)
   - width/height: From video format or specified in prompt

3. Include all necessary imports and proper TypeScript types

4. The composition should match the user's prompt description exactly

## OUTPUT FORMAT:

CRITICAL: You MUST return ONLY a valid JSON object. Do NOT wrap it in a function, do NOT add any JavaScript code around it. Return ONLY the JSON:

{
  "files": {
    "index.ts": "import { registerRoot } from 'remotion';\\nimport { Root } from './Root';\\n\\nregisterRoot(Root);",
    "Root.tsx": "import { Composition } from 'remotion';\\nimport { MyComposition } from './MyComposition';\\n\\nexport const Root: React.FC = () => {\\n  return (\\n    <Composition\\n      id=\\"MyComposition\\"\\n      component={MyComposition}\\n      durationInFrames={300}\\n      fps={30}\\n      width={1920}\\n      height={1080}\\n    />\\n  );\\n};",
    "MyComposition.tsx": "import React from 'react';\\nimport { AbsoluteFill } from 'remotion';\\n\\nexport const MyComposition: React.FC = () => {\\n  return (\\n    <AbsoluteFill>\\n      <div>Hello World</div>\\n    </AbsoluteFill>\\n  );\\n};"
  }
}

IMPORTANT RULES:
1. Return ONLY the JSON object, nothing else
2. Escape newlines as \\n in the JSON strings
3. Escape quotes as \\" in the JSON strings
4. Do NOT wrap in a function
5. Do NOT add any code before or after the JSON
6. The "files" object should contain all necessary Remotion files

## FINAL REMINDER:
⚠️ CRITICAL: You MUST follow all Remotion best practices and rules provided below. These are REQUIRED, not optional.

- Follow ALL Remotion best practices from the skills documentation above
- Use Remotion components (<Img>, <Video>, <Audio>) - NEVER use native HTML elements
- All animations MUST use useCurrentFrame() - NO CSS transitions/animations
- Use staticFile() for all asset references
- Ensure proper TypeScript types throughout
- Use proper Remotion patterns (Sequence, spring, interpolate) as documented

Generate complete, production-ready Remotion code that strictly adheres to all best practices. Include all files needed for the composition.`;

      // Generate code (inside step - not stored in step output)
      const codeResult = await generateCodeWithAgent({
        userId: localUserId,
        requirement: remotionPrompt,
        context: {}, // Empty - all info in prompt string
        language: "typescript",
      });

      if (!codeResult.success || !codeResult.code) {
        throw new Error(`Failed to generate Remotion code: ${codeResult.error || "Unknown error"}`);
      }

      // Parse code (inside step)
      let code = codeResult.code.trim();
      if (code.startsWith("json\n")) code = code.substring(5);
      else if (code.startsWith("```json\n")) {
        code = code.substring(8);
        if (code.endsWith("```")) code = code.substring(0, code.length - 3);
      } else if (code.startsWith("```\n")) {
        code = code.substring(4);
        if (code.endsWith("```")) code = code.substring(0, code.length - 3);
      }
      code = code.trim();

      let files: Record<string, string> = {};

      // Extract files from function-wrapped code
      const filesMatch = code.match(/const\s+files\s*=\s*\{/);
      if (filesMatch) {
        try {
          const start = filesMatch.index! + filesMatch[0].length - 1;
          let depth = 0;
          let inString = false;
          let strChar = "";
          let i = start;

          while (i < code.length) {
            const char = code[i];
            const prev = i > 0 ? code[i - 1] : "";

            if (!inString && (char === '"' || char === "'" || char === "`")) {
              inString = true;
              strChar = char;
            } else if (inString && char === strChar && prev !== "\\") {
              inString = false;
              strChar = "";
            } else if (!inString) {
              if (char === "{") depth++;
              else if (char === "}") {
                depth--;
                if (depth === 0) {
                  const filesStr = code.substring(start, i + 1);
                  try {
                    const parsed = new Function("return " + filesStr)();
                    if (parsed && typeof parsed === "object") {
                      files = parsed;
                      for (const [name, content] of Object.entries(files)) {
                        if (typeof content === "string") {
                          files[name] = (content as string)
                            .replace(/\\n/g, "\n")
                            .replace(/\\t/g, "\t")
                            .replace(/\\r/g, "\r")
                            .replace(/\\"/g, '"')
                            .replace(/\\'/g, "'");
                        }
                      }
                    }
                  } catch (e) {
                    console.error("[Remotion] Failed to parse files:", e);
                  }
                  break;
                }
              }
            }
            i++;
          }
        } catch (e) {
          console.error("[Remotion] Failed to extract files:", e);
        }
      }

      // Try JSON parse
      if (Object.keys(files).length === 0) {
        try {
          const parsed = JSON.parse(code);
          if (parsed.files && typeof parsed.files === "object") {
            files = parsed.files;
            for (const [name, content] of Object.entries(files)) {
              if (typeof content === "string") {
                files[name] = (content as string)
                  .replace(/\\n/g, "\n")
                  .replace(/\\t/g, "\t")
                  .replace(/\\r/g, "\r")
                  .replace(/\\"/g, '"')
                  .replace(/\\'/g, "'");
              }
            }
          }
        } catch (e) {
          // Try file separators
          const sepRegex = /=== FILE: (.+?) ===\n([\s\S]*?)(?=== END FILE ===|=== FILE:|$)/g;
          let match;
          while ((match = sepRegex.exec(code)) !== null) {
            files[match[1]!.trim()] = match[2]!.trim();
          }

          // Try markdown blocks
          if (Object.keys(files).length === 0) {
            const blockRegex = /```(?:typescript|tsx|ts)?\s*(?:file=)?([^\n]+)?\n([\s\S]*?)```/g;
            let blockMatch;
            while ((blockMatch = blockRegex.exec(code)) !== null) {
              files[blockMatch[1]?.trim() || "index.ts"] = blockMatch[2]!.trim();
            }
          }

          if (Object.keys(files).length === 0) {
            files["index.ts"] = code;
          }
        }
      }

      // Ensure index.ts exists
      if (!files["index.ts"] && !files["index.tsx"]) {
        const tsFile = Object.keys(files).find((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
        if (tsFile) {
          files["index.ts"] = files[tsFile]!;
        } else {
          files["index.ts"] = Object.values(files)[0] || code;
        }
      }

      // Build staticFiles from assets (inside step)
      const staticFiles: Record<string, string> = {};
      for (const asset of nodeAssets) {
        const filename = asset.filename.replace(/[<>:"/\\|?*]/g, "_").trim();
        let base64: string | null = null;

        if (asset.fileData.startsWith("data:")) {
          const match = asset.fileData.match(/base64,(.+)/);
          base64 = match ? match[1] : null;
        } else if (asset.fileData.startsWith("http://") || asset.fileData.startsWith("https://")) {
          base64 = await fetchFileAsBase64(asset.fileData);
        } else if (asset.fileData.length > 100) {
          base64 = asset.fileData;
        }

        if (base64) {
          staticFiles[filename] = base64;
        }
      }

      // Render video (inside step)
      const response = await fetch(`${localRenderServerUrl}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          ...(Object.keys(staticFiles).length > 0 ? { staticFiles } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Render server error: ${response.statusText}`);
      }

      const result = await response.json();
      return result; // Only small { success, videoUrl } object
    });

    if (!renderResult.success || !renderResult.videoUrl) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        `Video rendering failed: ${renderResult.error || "Unknown error"}`
      );
      const minimalContext: Record<string, any> = {};
      if (context) {
        for (const key of Object.keys(context).slice(0, 3)) {
          const val = context[key];
          if (typeof val === "string" || (val && typeof val === "object" && "videoUrl" in val)) {
            minimalContext[key] = val;
          }
        }
      }
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...minimalContext,
            error: { message: error.message },
          },
        })
      );
      throw error;
    }

    // Build output with minimal context
    const outputContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 10)) {
        outputContext[key] = context[key];
      }
    }

    const mergedOutput = {
      ...outputContext,
      [localVariablesName]: {
        videoUrl: renderResult.videoUrl,
        success: true,
      },
      videoUrl: renderResult.videoUrl,
    };

    await publishStatus(publish, nodeId, "success");

    await publish(
      remotionChannel().output({
        nodeId,
        output: mergedOutput,
      })
    );

    return mergedOutput;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    const errorMessage = error instanceof Error ? error.message : String(error);
    const minimalContext: Record<string, any> = {};
    if (context) {
      for (const key of Object.keys(context).slice(0, 3)) {
        const val = context[key];
        if (typeof val === "string" || (val && typeof val === "object" && "videoUrl" in val)) {
          minimalContext[key] = val;
        }
      }
    }
    await publish(
      remotionChannel().output({
        nodeId,
        output: {
          ...minimalContext,
          error: { message: errorMessage },
        },
      })
    );
    throw error;
  }
};
