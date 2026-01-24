import type { NodeExecutor } from "../types";
import { remotionChannel } from "@/inngest/channels/remotion";
import { NonRetriableError } from "inngest";
import { generateCodeWithAgent } from "@/services/claude-agent/claudeAgentService";
import { loadRemotionSkills } from "@/services/claude-agent/remotion-skills";

type RemotionAsset = {
  file: string; // base64 encoded file OR URL to file
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
  backgroundAudio?: string; // base64 encoded OR URL to file
  backgroundAudioFilename?: string;
  backgroundAudioVolume?: number;
  assets?: RemotionAsset[];
};

// Video format to dimensions mapping
const VIDEO_FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
};

// Helper to publish status updates
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

    const variablesName = data.variables || "remotion";

    if (!data.prompt) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("REMOTION node: Prompt is required");
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    const videoFormat = data.videoFormat || "16:9";
    const defaultDimensions = VIDEO_FORMAT_DIMENSIONS[videoFormat];

    // Build asset information for Claude prompt
    let assetInfo = "";
    const staticFiles: Record<string, string> = {};

    // Helper function to fetch file from URL or use base64 directly
    const fetchFileAsBase64 = async (fileInput: string): Promise<string | null> => {
      if (!fileInput || fileInput.trim() === "") {
        return null;
      }

      // Handle data URLs (data:image/png;base64,... or data:audio/mp3;base64,...)
      if (fileInput.startsWith("data:")) {
        const base64Match = fileInput.match(/base64,(.+)/);
        return base64Match ? base64Match[1] : null;
      }

      // If it's a URL (http/https), fetch it and convert to base64
      if (fileInput.startsWith("http://") || fileInput.startsWith("https://")) {
        try {
          const response = await fetch(fileInput, {
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(30000), // 30 second timeout
          });
          if (!response.ok) {
            console.error(
              `Failed to fetch file from ${fileInput}: ${response.statusText} (${response.status})`
            );
            return null;
          }

          // Check content length to ensure we're getting the full file
          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            console.log(`Fetching file of size: ${contentLength} bytes`);
          }

          const buffer = await response.arrayBuffer();

          // Validate buffer is not empty
          if (buffer.byteLength === 0) {
            console.error(`Fetched file from ${fileInput} is empty`);
            return null;
          }

          console.log(`Successfully fetched ${buffer.byteLength} bytes from ${fileInput}`);
          const base64 = Buffer.from(buffer).toString("base64");

          // Validate base64 is not empty
          if (!base64 || base64.length === 0) {
            console.error(`Base64 conversion resulted in empty string for ${fileInput}`);
            return null;
          }

          return base64;
        } catch (error) {
          console.error(`Error fetching file from ${fileInput}:`, error);
          if (error instanceof Error) {
            console.error(`Error details: ${error.message}`);
          }
          return null;
        }
      }

      // If it's a long string without http, assume it's already base64
      // (for backward compatibility with existing nodes that have base64 stored)
      if (fileInput.length > 100) {
        return fileInput;
      }

      return null;
    };

    // Handle background audio - fetch if URL, use base64 if provided
    if (data.backgroundAudio && data.backgroundAudioFilename) {
      const audioVolume = data.backgroundAudioVolume ?? 0.7;
      // Sanitize filename to avoid issues with special characters
      const sanitizedFilename = data.backgroundAudioFilename.replace(/[<>:"/\\|?*]/g, "_").trim();
      assetInfo += `Background audio:\n- ${sanitizedFilename}: Volume ${audioVolume}, plays from start (frame 0) to end of composition. Use <Audio> component from @remotion/media with staticFile('${sanitizedFilename}') and volume={${audioVolume}}.\n\n`;

      // Extract base64 from data URL or fetch from URL
      // If it's already a data URL, extract base64 directly (no step needed to avoid size limits)
      let audioBase64: string | null = null;

      if (data.backgroundAudio.startsWith("data:")) {
        // Already a data URL - extract base64 directly (no step output)
        const base64Match = data.backgroundAudio.match(/base64,(.+)/);
        audioBase64 = base64Match ? base64Match[1] : null;
      } else if (
        data.backgroundAudio.startsWith("http://") ||
        data.backgroundAudio.startsWith("https://")
      ) {
        // It's a URL - fetch it in a step (for backward compatibility with old Pinata URLs)
        audioBase64 = await step.run("fetch-background-audio", async () => {
          const result = await fetchFileAsBase64(data.backgroundAudio!);
          if (!result) {
            throw new Error(`Failed to fetch background audio from ${data.backgroundAudio}`);
          }
          return result;
        });
      } else {
        // Assume it's already base64 (backward compatibility)
        audioBase64 = data.backgroundAudio;
      }

      if (audioBase64) {
        staticFiles[sanitizedFilename] = audioBase64;
      } else {
        throw new Error(`Failed to process background audio file: ${data.backgroundAudioFilename}`);
      }
    }

    // Handle other assets - fetch if URL, use base64 if provided
    if (data.assets && data.assets.length > 0) {
      assetInfo += "Available assets:\n";
      for (const asset of data.assets) {
        const timing =
          asset.startTime !== undefined
            ? `Appears at ${asset.startTime} seconds`
            : "Appears at 0 seconds";
        const position = asset.position
          ? `, positioned at (${asset.position.x ?? 0}, ${asset.position.y ?? 0})`
          : "";
        const size = asset.size
          ? `, size ${asset.size.width ?? "auto"}x${asset.size.height ?? "auto"}`
          : "";
        const description = asset.sceneDescription
          ? `\n  Description: "${asset.sceneDescription}"`
          : "";

        // Sanitize filename to avoid issues with special characters
        const sanitizedAssetFilename = asset.filename.replace(/[<>:"/\\|?*]/g, "_").trim();
        assetInfo += `- ${sanitizedAssetFilename} (${asset.type}): ${timing}${position}${size}.${description}\n`;

        // Extract base64 from data URL or fetch from URL
        // If it's already a data URL, extract base64 directly (no step needed to avoid size limits)
        let assetBase64: string | null = null;

        if (asset.file.startsWith("data:")) {
          // Already a data URL - extract base64 directly (no step output)
          const base64Match = asset.file.match(/base64,(.+)/);
          assetBase64 = base64Match ? base64Match[1] : null;
        } else if (asset.file.startsWith("http://") || asset.file.startsWith("https://")) {
          // It's a URL - fetch it in a step (for backward compatibility with old Pinata URLs)
          assetBase64 = await step.run(`fetch-asset-${sanitizedAssetFilename}`, async () => {
            const result = await fetchFileAsBase64(asset.file);
            if (!result) {
              throw new Error(`Failed to fetch asset from ${asset.file}`);
            }
            return result;
          });
        } else {
          // Assume it's already base64 (backward compatibility)
          assetBase64 = asset.file;
        }

        if (assetBase64) {
          staticFiles[sanitizedAssetFilename] = assetBase64;
        } else {
          console.warn(`Failed to process asset file: ${asset.filename}`);
        }
      }
      assetInfo +=
        "\nUse staticFile('filename.ext') to reference each asset. Follow the scene descriptions to position and animate them correctly.\n";
    }

    // Build context string from previous node outputs
    // Format it clearly so Claude knows how to access Remotion outputs
    const contextString =
      Object.keys(context).length > 0
        ? Object.keys(context)
          .map((key) => {
            const value = context[key];
            // If it's a Remotion output (has videoUrl and success), document it clearly
            if (value && typeof value === "object" && "videoUrl" in value && "success" in value) {
              return `- inputs.${key}.videoUrl: The rendered video URL (string) - Use this to access the video\n- inputs.${key}.success: Whether rendering succeeded (boolean)\n- inputs.${key}: Complete object with videoUrl and success properties`;
            }
            // For direct videoUrl (backward compatibility)
            if (key === "videoUrl" && typeof value === "string") {
              return `- inputs.videoUrl: The rendered video URL from Remotion node (string) - Use this to access the video directly`;
            }
            // For other outputs, show sample
            const sample = JSON.stringify(value, null, 2).substring(0, 200);
            return `- inputs.${key}: ${sample}${sample.length >= 200 ? "..." : ""}`;
          })
          .join("\n")
        : "No specific inputs from previous nodes";

    // Load Remotion skills and best practices
    const skillsContent = await step.run("load-remotion-skills", async () => {
      return await loadRemotionSkills();
    });

    // Build Remotion-specific prompt for Claude
    const remotionPrompt = `Generate Remotion composition code for: ${data.prompt}

Video format: ${videoFormat} (default dimensions: ${defaultDimensions.width}x${defaultDimensions.height} if not specified in prompt)

${assetInfo ? `${assetInfo}\n` : ""}

AVAILABLE INPUTS FROM PREVIOUS NODES:
${contextString}

NOTE: If a Remotion node output is available, you can access the video URL using:
- inputs.[variableName].videoUrl (e.g., inputs.remotion.videoUrl)
- inputs.videoUrl (direct access, also available)

${skillsContent}

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

Generate complete, production-ready Remotion code. Include all files needed for the composition.`;

    // Generate Remotion code using Claude Agent
    const codeResult = await step.run("generate-remotion-code", async () => {
      return await generateCodeWithAgent({
        userId,
        requirement: remotionPrompt,
        context: context,
        language: "typescript",
      });
    });

    if (!codeResult.success || !codeResult.code) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        `Failed to generate Remotion code: ${codeResult.error || "Unknown error"}`
      );
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Parse the generated code to extract files
    await publishStatus(publish, nodeId, "rendering");

    const renderServerUrl = process.env.REMOTION_SERVER_URL;
    if (!renderServerUrl) {
      throw new NonRetriableError("REMOTION server URL is not set");
    }
    const renderResult = await step.run("render-video", async () => {
      // codeResult.code is guaranteed to exist due to check above, but TypeScript needs explicit handling
      let code = codeResult.code!;

      // Remove common prefixes that Claude might add (e.g., "json\n", "```json\n", etc.)
      code = code.trim();
      if (code.startsWith("json\n")) {
        code = code.substring(5);
      } else if (code.startsWith("```json\n")) {
        code = code.substring(8);
        // Remove closing ```
        if (code.endsWith("```")) {
          code = code.substring(0, code.length - 3);
        }
      } else if (code.startsWith("```\n")) {
        code = code.substring(4);
        // Remove closing ```
        if (code.endsWith("```")) {
          code = code.substring(0, code.length - 3);
        }
      }
      code = code.trim();

      let files: Record<string, string> = {};

      // Try to extract files from function-wrapped code (Claude sometimes wraps in a function)
      // Look for: const files = { ... } pattern
      const filesVarMatch = code.match(/const\s+files\s*=\s*\{/);
      if (filesVarMatch) {
        try {
          // Extract the files object by finding const files = { ... }
          const startPos = filesVarMatch.index! + filesVarMatch[0].length - 1;
          let depth = 0;
          let inString = false;
          let stringChar = "";
          let i = startPos;

          while (i < code.length) {
            const char = code[i];
            const prevChar = i > 0 ? code[i - 1] : "";

            if (!inString && (char === '"' || char === "'" || char === "`")) {
              inString = true;
              stringChar = char;
            } else if (inString && char === stringChar && prevChar !== "\\") {
              inString = false;
              stringChar = "";
            } else if (!inString) {
              if (char === "{") depth++;
              else if (char === "}") {
                depth--;
                if (depth === 0) {
                  const filesStr = code.substring(startPos, i + 1);
                  try {
                    const parsed = new Function("return " + filesStr)();
                    if (parsed && typeof parsed === "object") {
                      files = parsed;
                      // Unescape file contents
                      for (const [fileName, fileContent] of Object.entries(files)) {
                        if (typeof fileContent === "string") {
                          files[fileName] = fileContent
                            .replace(/\\n/g, "\n")
                            .replace(/\\t/g, "\t")
                            .replace(/\\r/g, "\r")
                            .replace(/\\"/g, '"')
                            .replace(/\\'/g, "'");
                        }
                      }
                    }
                  } catch (e) {
                    console.error("[Remotion] Failed to parse files from function:", e);
                  }
                  break;
                }
              }
            }
            i++;
          }
        } catch (extractError) {
          console.error("[Remotion] Failed to extract files from function:", extractError);
        }
      }

      // If we didn't extract files from function, try to parse as JSON
      if (Object.keys(files).length === 0) {
        try {
          const parsed = JSON.parse(code);
          if (parsed.files && typeof parsed.files === "object") {
            files = parsed.files;
            // Unescape any escaped newlines in file contents
            for (const [fileName, fileContent] of Object.entries(files)) {
              if (typeof fileContent === "string") {
                files[fileName] = fileContent
                  .replace(/\\n/g, "\n")
                  .replace(/\\t/g, "\t")
                  .replace(/\\r/g, "\r")
                  .replace(/\\"/g, '"')
                  .replace(/\\'/g, "'");
              }
            }
          }
        } catch (parseError) {
          console.error("[Remotion] JSON parse error:", parseError);
          console.error("[Remotion] Code preview:", code.substring(0, 200));
          // Not JSON, try to parse file separators
          const fileSeparatorRegex =
            /=== FILE: (.+?) ===\n([\s\S]*?)(?=== END FILE ===|=== FILE:|$)/g;
          let match;
          while ((match = fileSeparatorRegex.exec(code)) !== null) {
            const fileName = match[1]!.trim();
            const fileContent = match[2]!.trim();
            files[fileName] = fileContent;
          }

          // If no files found with separators, try markdown code blocks
          if (Object.keys(files).length === 0) {
            const codeBlockRegex =
              /```(?:typescript|tsx|ts)?\s*(?:file=)?([^\n]+)?\n([\s\S]*?)```/g;
            let codeMatch;
            while ((codeMatch = codeBlockRegex.exec(code)) !== null) {
              const fileName = codeMatch[1]?.trim() || "index.ts";
              const fileContent = codeMatch[2]!.trim();
              files[fileName] = fileContent;
            }
          }

          // Fallback: if still no files, treat entire code as index.ts
          if (Object.keys(files).length === 0) {
            files["index.ts"] = code;
          }
        }
      }

      // Ensure we have at least index.ts
      if (!files["index.ts"] && !files["index.tsx"]) {
        // Try to find any .ts or .tsx file
        const tsFile = Object.keys(files).find((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
        if (tsFile) {
          files["index.ts"] = files[tsFile]!;
        } else {
          // Last resort: use first file or entire code
          const firstFile = Object.values(files)[0] || code;
          files["index.ts"] = firstFile;
        }
      }

      const response = await fetch(`${renderServerUrl}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files,
          staticFiles: Object.keys(staticFiles).length > 0 ? staticFiles : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Render server error: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    });

    if (!renderResult.success || !renderResult.videoUrl) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        `Video rendering failed: ${renderResult.error || "Unknown error"}`
      );
      await publish(
        remotionChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Merge video URL into context
    const mergedOutput = {
      ...context,
      [variablesName]: {
        videoUrl: renderResult.videoUrl,
        success: true,
      },
      videoUrl: renderResult.videoUrl, // Also available directly
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
    await publish(
      remotionChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: errorMessage,
          },
        },
      })
    );
    throw error;
  }
};
