import type { NodeExecutor } from "../types";
import { REMOTION_CHANNEL, remotionChannel } from "@/inngest/channels/remotion";
import { NonRetriableError } from "inngest";
import { generateCodeWithAgent } from "@/services/claude-agent/claudeAgentService";
import { loadRemotionSkills } from "@/services/claude-agent/remotion-skills";
import { basePrismaClient } from "@/lib/prisma";
import Handlebars from "handlebars";

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
  step: any,
  nodeId: string,
  status: "loading" | "rendering" | "error" | "success"
) => {
  await step.run(`publish:${REMOTION_CHANNEL}:${nodeId}:${status}`, async () => {
    await publish(
      remotionChannel().status({
        nodeId,
        status,
      })
    );
  });
};

const publishOutput = async (
  publish: any,
  step: any,
  nodeId: string,
  output: Record<string, unknown>,
  label: string
) => {
  await step.run(`publish:${REMOTION_CHANNEL}:${nodeId}:output:${label}`, async () => {
    await publish(
      remotionChannel().output({
        nodeId,
        output,
      })
    );
  });
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
    await publishStatus(publish, step, nodeId, "loading");
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
      await publishStatus(publish, step, nodeId, "error");
      const error = new NonRetriableError(
        quotaError instanceof Error ? quotaError.message : "Rate limit exceeded"
      );
      await publishOutput(
        publish,
        step,
        nodeId,
        {
          ...context,
          error: { message: error.message },
        },
        "quota-error"
      );
      throw error;
    }

    // CRITICAL: Extract ALL data into primitives IMMEDIATELY
    const variablesName = String(data?.variables || "remotion");
    const promptText = String(data?.prompt || "");
    const videoFormat = String(data?.videoFormat || "16:9");
    const renderServerUrl = String(process.env.REMOTION_SERVER_URL);

    if (!promptText) {
      await publishStatus(publish, step, nodeId, "error");
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
      await publishOutput(
        publish,
        step,
        nodeId,
        {
          ...minimalContext,
          error: { message: error.message },
        },
        "prompt-missing"
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

    // Resolve Handlebars templates in prompt (e.g., {{videoDescription}})
    let resolvedPromptText = promptText;
    try {
      const minimalContext: Record<string, unknown> = {};
      if (context) {
        for (const key of Object.keys(context).slice(0, 10)) {
          minimalContext[key] = context[key];
        }
      }
      resolvedPromptText = Handlebars.compile(promptText)(minimalContext);
    } catch (error) {
      console.warn("[Remotion] Prompt template resolution failed, using raw prompt:", error);
    }

    // Store all as local primitives (will be captured in closure, but they're small)
    const localPromptText = resolvedPromptText;
    const localVideoFormat = videoFormat;
    const localRenderServerUrl = renderServerUrl;
    const localNodeId = nodeId;
    const localUserId = userId;
    const localContextMetadata = contextMetadata;
    const localVariablesName = variablesName;

    // CRITICAL: Everything happens in ONE step
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

## ⛔ FORBIDDEN – NEVER DO THIS:
- NEVER use placeholder syntax like {{videoDescription}}, {{compositionId}}, or any {{variable}} in your code
- NEVER create a composition that only displays the prompt text or a variable – the video must show the actual VISUAL content described in the prompt
- The composition component must implement the FULL video: shapes, animations, morphing, transitions, etc. as described – NOT a simple div showing text

## ✅ REQUIRED – IMPLEMENT EVERY SCENE:
You MUST implement the EXACT visual content described in the prompt. Parse the prompt and build each scene:

- **Scene structure**: Use <Sequence> from 'remotion' to separate scenes (Scene 1, Scene 2, etc.)
- **Geometric shapes**: Pentagon, Triangle, Square, Circle, Hexagon, Diamond → create with SVG or styled divs, each with distinct vibrant colors
- **Morphing**: If the prompt asks for shapes morphing into letters (e.g. "V-E-R-X-I-O"), use flubber or SVG path morphing – add it to dependencies
- **Specific elements**: Grid background, letters, icons → build them in code, do NOT substitute with generic text like "Generated Video Content"
- **Animations**: Breathing = subtle scale oscillation; jumps = spring with damping; wipe = interpolate opacity/scale based on position

⛔ ANTI-EXAMPLE (NEVER DO THIS): A gradient background with <div>Generated Video Content</div> or similar generic text – that is a placeholder, not the requested video.

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

CRITICAL: You MUST return ONLY a valid JSON object. Do NOT wrap it in a function, do NOT add any JavaScript code around it. Return ONLY the JSON.

The MyComposition MUST implement the FULL prompt – all scenes, shapes, morphing, animations. Do NOT use "Hello World", "Generated Video Content", or any generic placeholder. Match the prompt exactly (e.g. 8 shapes → morph → letters → wipe).

{
  "files": {
    "index.ts": "import { registerRoot } from 'remotion';\\nimport { Root } from './Root';\\n\\nregisterRoot(Root);",
    "Root.tsx": "import { Composition } from 'remotion';\\nimport { MyComposition } from './MyComposition';\\n\\nexport const Root: React.FC = () => (\\n  <Composition id=\\"MyComposition\\" component={MyComposition} durationInFrames={300} fps={30} width={1920} height={1080} />\\n);",
    "MyComposition.tsx": "import React from 'react';\\nimport { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';\\n\\nexport const MyComposition: React.FC = () => (\\n  <AbsoluteFill>\\n    <Sequence from={0} durationInFrames={75}>\\n      {/* Scene 1: implement what the prompt describes */}\\n    </Sequence>\\n    <Sequence from={75} durationInFrames={75}>\\n      {/* Scene 2: implement what the prompt describes */}\\n    </Sequence>\\n    {/* ... more Sequence blocks for each scene in the prompt */}\\n  </AbsoluteFill>\\n);"
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

      const shouldRejectGenericOutput = (prompt: string, code: string): string[] => {
        const reasons: string[] = [];
        const lowerPrompt = prompt.toLowerCase();
        const lowerCode = code.toLowerCase();

        if (lowerCode.includes("generated video content") || lowerCode.includes("hello world")) {
          reasons.push("Generic placeholder content detected");
        }

        const sceneCount = (prompt.match(/scene\s+\d+/gi) || []).length;
        if (sceneCount >= 2) {
          const sequenceCount = (code.match(/<Sequence\b/g) || []).length;
          if (sequenceCount < Math.max(2, Math.floor(sceneCount / 2))) {
            reasons.push("Missing scene sequencing (expected multiple <Sequence> blocks)");
          }
        }

        if (lowerPrompt.includes("verxio") && !lowerCode.includes("verxio")) {
          reasons.push('Prompt mentions "VERXIO" but code does not render it');
        }
        if (lowerPrompt.includes("flubber") && !lowerCode.includes("flubber")) {
          reasons.push("Prompt requires flubber morphing but code does not include it");
        }
        if (lowerPrompt.includes("grid") && !lowerCode.includes("grid")) {
          reasons.push("Prompt includes a grid background but code does not implement it");
        }

        return reasons;
      };

      // Generate code (inside step - not stored in step output)
      let codeResult = await generateCodeWithAgent({
        userId: localUserId,
        requirement: remotionPrompt,
        context: {}, // Empty - all info in prompt string
        language: "typescript",
      });

      if (!codeResult.success || !codeResult.code) {
        throw new Error(`Failed to generate Remotion code: ${codeResult.error || "Unknown error"}`);
      }

      // One retry if the model returns generic placeholder output
      const rejectionReasons = shouldRejectGenericOutput(localPromptText, codeResult.code);
      if (rejectionReasons.length > 0) {
        const retryPrompt = `${remotionPrompt}

## REJECTION FEEDBACK (FIX REQUIRED)
Your previous output was rejected for these reasons:
- ${rejectionReasons.join("\n- ")}

You MUST correct these issues and output full Remotion code that implements every scene.`;

        const retryResult = await generateCodeWithAgent({
          userId: localUserId,
          requirement: retryPrompt,
          context: {},
          language: "typescript",
        });

        if (retryResult.success && retryResult.code) {
          codeResult = retryResult;
        }
      }

      // Parse code (inside step)
      const rawCode = codeResult.code;
      if (!rawCode) throw new Error("Failed to generate Remotion code: No code returned");
      let code = rawCode.trim();
      if (code.startsWith("json\n")) code = code.substring(5);
      else if (code.startsWith("```json\n")) {
        code = code.substring(8);
        if (code.endsWith("```")) code = code.substring(0, code.length - 3);
      } else if (code.startsWith("```\n")) {
        code = code.substring(4);
        if (code.endsWith("```")) code = code.substring(0, code.length - 3);
      } else if (code.startsWith("```typescript\n") || code.startsWith("```ts\n")) {
        const idx = code.indexOf("\n");
        code = code.substring(idx + 1);
        if (code.endsWith("```")) code = code.substring(0, code.length - 3);
      }
      code = code.trim();

      let files: Record<string, string> = {};
      let compositionId = "";

      // ── PRIMARY PATH: Execute the generated function directly ──
      // Handles template literals, string methods, regex etc. correctly
      // because the code actually runs instead of being statically parsed.
      if (code.includes("function execute")) {
        try {
          let jsCode = code
            .replace(/export\s+default\s+/g, "")
            // Replace the entire function signature up to (but not including) the opening {
            // This handles nested generics like Promise<Record<string, any>>
            .replace(
              /async\s+function\s+execute\s*\([^)]*\)[^{]*/,
              "async function execute(inputs) "
            );

          const AsyncFunction = Object.getPrototypeOf(async function () {
            /* */
          }).constructor;
          const fn = new AsyncFunction("inputs", jsCode + "\nreturn await execute(inputs);") as (
            inputs: Record<string, any>
          ) => Promise<Record<string, any>>;

          const result = await fn({
            videoDescription: localPromptText,
            prompt: localPromptText,
            videoFormat: localVideoFormat,
          });

          if (
            result?.files &&
            typeof result.files === "object" &&
            Object.keys(result.files).length > 0
          ) {
            files = result.files as Record<string, string>;
            if (result.metadata?.compositionId) {
              compositionId = String(result.metadata.compositionId);
            }
            console.log(
              `[Remotion] Function execution succeeded – ${Object.keys(files).length} files`
            );
          }
        } catch (execErr) {
          console.warn("[Remotion] Function execution failed:", execErr);
        }
      }

      // ── SECONDARY PATH: Extract string variables from function code ──
      // Proper template-literal-aware parser that handles escaped backticks
      if (Object.keys(files).length === 0 && code.includes("function execute")) {
        try {
          const vars: Record<string, string> = {};
          const declRegex = /(const|let|var)\s+(\w+)\s*(?::\s*[^=]+?)?\s*=\s*/g;
          let declMatch;
          while ((declMatch = declRegex.exec(code)) !== null) {
            const varName = declMatch[2]!;
            let pos = declMatch.index + declMatch[0].length;
            while (pos < code.length && /\s/.test(code[pos]!)) pos++;
            const ch = code[pos];

            if (ch === "`") {
              // Parse template literal – handles:
              //   - escaped backticks (\`)
              //   - ${...} expressions (which may contain nested backticks)
              pos++;
              let out = "";
              let exprDepth = 0; // track nesting inside ${...}
              while (pos < code.length) {
                if (code[pos] === "\\" && pos + 1 < code.length) {
                  const nx = code[pos + 1]!;
                  if (nx === "`") {
                    out += "`";
                    pos += 2;
                  } else if (nx === "$") {
                    out += "$";
                    pos += 2;
                  } else if (nx === "n") {
                    out += "\n";
                    pos += 2;
                  } else if (nx === "t") {
                    out += "\t";
                    pos += 2;
                  } else if (nx === "r") {
                    out += "\r";
                    pos += 2;
                  } else if (nx === "\\") {
                    out += "\\";
                    pos += 2;
                  } else {
                    out += nx;
                    pos += 2;
                  }
                } else if (exprDepth === 0 && code[pos] === "$" && code[pos + 1] === "{") {
                  // Entering a ${...} template expression
                  out += "${";
                  pos += 2;
                  exprDepth = 1;
                } else if (exprDepth > 0) {
                  // Inside a template expression – track brace nesting
                  if (code[pos] === "{") {
                    exprDepth++;
                    out += "{";
                    pos++;
                  } else if (code[pos] === "}") {
                    exprDepth--;
                    out += "}";
                    pos++;
                  } else if (code[pos] === "`") {
                    // Nested template literal inside ${...} – skip it entirely
                    out += "`";
                    pos++;
                    let nestedExpr = 0;
                    while (pos < code.length) {
                      if (code[pos] === "\\" && code[pos + 1] === "`") {
                        out += "\\`";
                        pos += 2;
                      } else if (code[pos] === "$" && code[pos + 1] === "{") {
                        out += "${";
                        pos += 2;
                        nestedExpr++;
                      } else if (nestedExpr > 0 && code[pos] === "}") {
                        out += "}";
                        pos++;
                        nestedExpr--;
                      } else if (nestedExpr === 0 && code[pos] === "`") {
                        out += "`";
                        pos++;
                        break;
                      } else {
                        out += code[pos];
                        pos++;
                      }
                    }
                  } else {
                    out += code[pos];
                    pos++;
                  }
                } else if (code[pos] === "`") {
                  // End of outer template literal
                  break;
                } else {
                  out += code[pos];
                  pos++;
                }
              }
              vars[varName] = out;
            } else if (ch === '"' || ch === "'") {
              pos++;
              let out = "";
              while (pos < code.length) {
                if (code[pos] === "\\" && pos + 1 < code.length) {
                  const nx = code[pos + 1]!;
                  if (nx === "n") {
                    out += "\n";
                    pos += 2;
                  } else if (nx === "t") {
                    out += "\t";
                    pos += 2;
                  } else if (nx === "r") {
                    out += "\r";
                    pos += 2;
                  } else if (nx === ch) {
                    out += ch;
                    pos += 2;
                  } else if (nx === "\\") {
                    out += "\\";
                    pos += 2;
                  } else {
                    out += nx;
                    pos += 2;
                  }
                } else if (code[pos] === ch) {
                  break;
                } else {
                  out += code[pos];
                  pos++;
                }
              }
              vars[varName] = out;
            }
          }

          // Add computed defaults for template variables the AI code would compute at runtime
          if (!vars.compositionId) {
            vars.compositionId =
              localPromptText
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .substring(0, 50) || "video-composition";
          }
          if (!vars.fps) vars.fps = "30";
          if (!vars.durationInFrames) vars.durationInFrames = "300";
          if (!vars.width) vars.width = "1920";
          if (!vars.height) vars.height = "1080";
          if (!vars.videoDescription) vars.videoDescription = localPromptText.substring(0, 200);

          // Map files from the return { files: { "name": varRef, ... } } object
          const filesBlockMatch = code.match(/\bfiles\s*:\s*\{([\s\S]*?)\}/);
          if (filesBlockMatch) {
            const block = filesBlockMatch[1]!;
            const pairRegex = /["']([^"']+\.\w+)["']\s*:\s*(\w+)/g;
            let pairMatch;
            while ((pairMatch = pairRegex.exec(block)) !== null) {
              const filename = pairMatch[1]!;
              const ref = pairMatch[2]!;
              if (vars[ref] !== undefined) {
                // Resolve ${...} template expressions left over from the AI code
                let content = vars[ref]!;
                // ${JSON.stringify(varName)}
                content = content.replace(/\$\{JSON\.stringify\((\w+)\)\}/g, (m, k) =>
                  vars[k] !== undefined ? JSON.stringify(vars[k]!) : m
                );
                // ${varName.substring(start, end)}
                content = content.replace(
                  /\$\{(\w+)\.substring\((\d+),\s*(\d+)\)\}/g,
                  (m, vn, s, e) =>
                    vars[vn] !== undefined ? vars[vn]!.substring(parseInt(s), parseInt(e)) : m
                );
                // ${varName}
                content = content.replace(/\$\{(\w+)\}/g, (m, k) =>
                  vars[k] !== undefined ? vars[k]! : m
                );
                files[filename] = content;
              }
            }
          }

          if (Object.keys(files).length > 0) {
            if (!compositionId) compositionId = vars.compositionId || "";
            console.log(
              `[Remotion] Variable extraction succeeded – ${Object.keys(files).length} files`
            );
          }
        } catch (parseErr) {
          console.warn("[Remotion] Variable extraction failed:", parseErr);
        }
      }

      // ── TERTIARY PATH: JSON, file separators, markdown blocks ──
      if (Object.keys(files).length === 0) {
        try {
          const parsed = JSON.parse(code);
          if (parsed.files && typeof parsed.files === "object") {
            files = parsed.files;
          }
        } catch {
          const sepRegex = /=== FILE: (.+?) ===\n([\s\S]*?)(?=== END FILE ===|=== FILE:|$)/g;
          let sepMatch;
          while ((sepMatch = sepRegex.exec(code)) !== null) {
            files[sepMatch[1]!.trim()] = sepMatch[2]!.trim();
          }

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

        // Unescape JSON-encoded strings
        for (const [name, content] of Object.entries(files)) {
          if (typeof content === "string") {
            files[name] = content
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\r/g, "\r")
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'");
          }
        }
      }

      // ── Ensure required files ──
      if (!files["index.ts"] && !files["index.tsx"]) {
        const tsFile = Object.keys(files).find((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
        if (tsFile) {
          files["index.ts"] = files[tsFile]!;
        } else {
          files["index.ts"] = Object.values(files)[0] || code;
        }
      }

      // ── Ensure Root.tsx exists when index imports from './Root' ──
      const indexContent = files["index.ts"] || files["index.tsx"] || "";
      const indexImportsRoot =
        indexContent.includes("from './Root'") ||
        indexContent.includes('from "./Root"') ||
        indexContent.includes("from './root'") ||
        indexContent.includes('from "./root"');
      if (indexImportsRoot && !files["Root.tsx"] && !files["root.tsx"]) {
        // Find a file that looks like Root (has <Composition, exports Root or default)
        const rootLikeKey = Object.keys(files).find((k) => {
          if (!k.endsWith(".tsx") && !k.endsWith(".jsx")) return false;
          const c = files[k] || "";
          return (
            (c.includes("<Composition") || c.includes("<composition")) &&
            c.includes("component=") &&
            (c.includes("export const Root") ||
              c.includes("export default") ||
              c.includes("export { Root }"))
          );
        });
        if (rootLikeKey) {
          files["Root.tsx"] = files[rootLikeKey]!;
          console.log(`[Remotion] Using ${rootLikeKey} as Root.tsx`);
        } else {
          // Generate minimal Root.tsx from the first composition component we find
          let compositionKey = Object.keys(files).find((k) => {
            if (k === "index.ts" || k === "index.tsx" || k === "Root.tsx") return false;
            if (!k.endsWith(".tsx") && !k.endsWith(".jsx")) return false;
            const c = files[k] || "";
            return (
              (c.includes("export const") || c.includes("export default")) &&
              !c.includes("<Composition")
            );
          });
          if (!compositionKey) {
            compositionKey = Object.keys(files).find(
              (k) => (k.endsWith(".tsx") || k.endsWith(".jsx")) && k !== "index.tsx"
            );
          }
          const baseName = compositionKey?.replace(/\.(tsx?|jsx?)$/, "") || "Composition";
          const compContent = compositionKey ? files[compositionKey] || "" : "";
          const useDefaultImport = compContent.includes("export default");
          const compName = baseName.replace(/^./, (s) => s.toUpperCase());
          const importLine = useDefaultImport
            ? `import ${compName} from './${baseName}';`
            : `import { ${compName} } from './${baseName}';`;
          files["Root.tsx"] = `import React from 'react';
import { Composition } from 'remotion';
${importLine}

export const Root: React.FC = () => (
  <Composition
    id="video-composition"
    component={${compName}}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
  />
);
`;
          console.log(`[Remotion] Generated Root.tsx importing from ./${baseName}`);
        }
      } else if (files["root.tsx"] && !files["Root.tsx"]) {
        files["Root.tsx"] = files["root.tsx"]!;
      }

      // ── Derive compositionId if not set by function execution ──
      if (!compositionId) {
        const rootContent = files["Root.tsx"] || "";
        const idMatch = rootContent.match(/<Composition[^>]*\sid=["']([^"']+)["']/);
        if (idMatch?.[1]) {
          compositionId = idMatch[1];
        } else {
          compositionId =
            localPromptText
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .substring(0, 50) || "video-composition";
        }
      }

      // ── Post-process: fix common AI code-generation issues in all files ──

      const templateValues: Record<string, string> = {
        videoDescription: localPromptText.substring(0, 200),
        compositionId: compositionId,
        fps: "30",
        durationInFrames: "300",
        width: "1920",
        height: "1080",
      };

      // PHASE A: Resolve unresolved ${...} template expressions left in file contents.
      // These occur when function execution or the secondary parser didn't fully resolve them.
      for (const [filename, content] of Object.entries(files)) {
        let patched = content;
        // ${JSON.stringify(varName)}
        patched = patched.replace(/\$\{JSON\.stringify\((\w+)\)\}/g, (m, k) =>
          templateValues[k] !== undefined ? JSON.stringify(templateValues[k]) : m
        );
        // ${varName.substring(start, end)}
        patched = patched.replace(/\$\{(\w+)\.substring\((\d+),\s*(\d+)\)\}/g, (m, vn, s, e) =>
          templateValues[vn] !== undefined
            ? templateValues[vn]!.substring(parseInt(s), parseInt(e))
            : m
        );
        // ${details.prop} or ${config.prop} – AI often uses inputs.details / inputs.config
        patched = patched.replace(
          /\$\{(\w+)\.(fps|durationInFrames|width|height)\}/g,
          (m, _obj, prop) => (templateValues[prop] !== undefined ? templateValues[prop]! : m)
        );
        // ${varName}
        patched = patched.replace(/\$\{(\w+)\}/g, (m, k) =>
          templateValues[k] !== undefined ? templateValues[k]! : m
        );
        files[filename] = patched;
      }

      // PHASE B: Replace AI placeholder patterns in string values.
      // The AI sometimes writes literal "{{videoDescription}}" or "{{compositionId}}"
      // as placeholder text inside string literals. Replace with actual values.
      for (const [filename, content] of Object.entries(files)) {
        let patched = content;
        for (const [varName, val] of Object.entries(templateValues)) {
          // Replace "{{varName}}" or '{{varName}}' string-literal placeholders
          patched = patched.replace(
            new RegExp(`"\\{\\{${varName}\\}\\}"`, "g"),
            JSON.stringify(val)
          );
          patched = patched.replace(
            new RegExp(`'\\{\\{${varName}\\}\\}'`, "g"),
            JSON.stringify(val)
          );
        }
        files[filename] = patched;
      }

      // PHASE C: Fix double-brace JSX patterns: {{identifier}} -> {identifier}
      // In JSX, {{foo}} creates an object literal {foo: value} which React can't render
      // as a child. Single-brace {foo} renders the variable's string value.
      // Only fix bare identifiers (not CSS-in-JS like {{ color: 'red' }}).
      for (const [filename, content] of Object.entries(files)) {
        if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) continue;
        let patched = content;
        patched = patched.replace(/\{\{(\s*[a-zA-Z_$][\w$]*\s*)\}\}/g, (match, inner) => {
          const trimmed = inner.trim();
          // Only fix known variable names or simple identifiers that aren't CSS properties
          // CSS-in-JS like {{ display: 'flex' }} has a colon after the identifier
          return `{${trimmed}}`;
        });
        files[filename] = patched;
      }

      // PHASE D: Inject missing variable declarations in composition files.
      // After phases A-C, some files may reference videoDescription or compositionId
      // as JSX expressions {videoDescription} without having them declared.
      const runtimeVars: Record<string, string> = {
        videoDescription: JSON.stringify(localPromptText.substring(0, 200)),
        compositionId: JSON.stringify(compositionId),
      };
      for (const [filename, content] of Object.entries(files)) {
        if (filename === "index.ts" || filename === "index.tsx") continue;
        let patched = content;
        for (const [varName, jsonValue] of Object.entries(runtimeVars)) {
          // Skip if the file doesn't reference this variable or already defines it
          if (!patched.includes(varName)) continue;
          if (new RegExp(`(?:const|let|var)\\s+${varName}\\b`).test(patched)) continue;
          // Skip if it only appears in import statements
          if (!new RegExp(`[^.]\\b${varName}\\b`).test(patched.replace(/import\s.*?;/g, "")))
            continue;

          // Inject const after the last import line
          const lines = patched.split("\n");
          let lastImportIdx = -1;
          for (let li = 0; li < lines.length; li++) {
            if (lines[li]!.trimStart().startsWith("import ")) lastImportIdx = li;
          }
          lines.splice(lastImportIdx + 1, 0, `const ${varName} = ${jsonValue};`);
          patched = lines.join("\n");
        }
        files[filename] = patched;
      }

      console.log("[Remotion] Files to render:", Object.keys(files).join(", "));
      console.log("[Remotion] Composition ID:", compositionId);

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
          compositionId,
          ...(Object.keys(staticFiles).length > 0 ? { staticFiles } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const missingFiles = Array.isArray(errorData.missingFiles) ? errorData.missingFiles : [];
        const missingSuffix = missingFiles.length
          ? ` Missing files: ${missingFiles.join(", ")}.`
          : "";
        const suggestion = errorData.suggestion ? ` ${errorData.suggestion}` : "";
        throw new Error(
          `${errorData.error || `Render server error: ${response.statusText}`}${missingSuffix}${suggestion}`
        );
      }

      const result = await response.json();
      return result; // Only small { success, videoUrl } object
    });

    if (!renderResult.success || !renderResult.videoUrl) {
      await publishStatus(publish, step, nodeId, "error");
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
      await publishOutput(
        publish,
        step,
        nodeId,
        {
          ...minimalContext,
          error: { message: error.message },
        },
        "render-failed"
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

    await publishStatus(publish, step, nodeId, "success");

    await publishOutput(publish, step, nodeId, mergedOutput, "success");

    return mergedOutput;
  } catch (error) {
    await publishStatus(publish, step, nodeId, "error");
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
    await publishOutput(
      publish,
      step,
      nodeId,
      {
        ...minimalContext,
        error: { message: errorMessage },
      },
      "unhandled-error"
    );
    throw error;
  }
};
