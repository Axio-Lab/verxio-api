import express from "express";
import cors from "cors";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
} from "fs";
import path from "path";
import { execSync } from "child_process";
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "50mb" }));

const PORT = 3001;
const OUTPUT_DIR = path.join(process.cwd(), "outputs");
const TEMP_DIR = path.join(process.cwd(), "temp-projects");

// Ensure directories exist
[OUTPUT_DIR, TEMP_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// Serve rendered videos with proper headers for downloads and streaming
app.use(
  "/videos",
  express.static(OUTPUT_DIR, {
    setHeaders: (res, filePath) => {
      // Set proper headers for video files to allow downloads and streaming
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
        // Allow inline viewing and downloading
        res.setHeader("Content-Disposition", 'inline; filename="' + path.basename(filePath) + '"');
        // CORS headers for cross-origin access
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Length, Content-Type, Content-Disposition"
        );
        // Enable range requests for video streaming
        res.setHeader("Accept-Ranges", "bytes");
      }
    },
  })
);

// Add explicit download endpoint for direct downloads
app.get("/videos/:filename/download", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(OUTPUT_DIR, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  // Set headers for download
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send file
  res.sendFile(path.resolve(filePath));
});

app.post("/render", async (req, res) => {
  let codeData;

  try {
    // Handle both string and object bodies
    if (typeof req.body === "string") {
      // Check if body is empty or undefined
      if (!req.body || req.body.trim() === "" || req.body === "undefined") {
        return res.status(400).json({
          error: "Invalid request body. Request body cannot be empty or undefined.",
        });
      }
      try {
        const parsed = JSON.parse(req.body);
        codeData = parsed.code || parsed;
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return res.status(400).json({
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    } else if (req.body && typeof req.body === "object") {
      codeData = req.body.code || req.body;
    } else {
      return res.status(400).json({
        error: "Invalid request body. Expected JSON object or string.",
      });
    }

    // Handle nested codeData (e.g., if codeData.generateRemotionCode exists)
    if (codeData && typeof codeData === "object" && codeData.generateRemotionCode) {
      // If codeData has a generateRemotionCode field, try to parse it
      if (typeof codeData.generateRemotionCode === "string") {
        try {
          const parsed = JSON.parse(codeData.generateRemotionCode);
          codeData = parsed;
        } catch (e) {
          // If parsing fails, use the string as-is (might be already parsed)
          codeData = codeData.generateRemotionCode;
        }
      } else if (typeof codeData.generateRemotionCode === "object") {
        codeData = codeData.generateRemotionCode;
      }
    }

    // Support both old format (entryFile, rootFile, compositionFile) and new format (files object)
    let files: Record<string, string> = {};

    if (codeData.files && typeof codeData.files === "object") {
      // New format: { files: { "index.ts": "...", "Root.tsx": "...", "VerxioProductLaunch.tsx": "..." } }
      files = codeData.files;

      // Validate that all imported files exist
      const entryFile = files["index.ts"] || files["index.tsx"];
      if (entryFile) {
        const importPatterns = [
          /import\s+.*?\s+from\s+['"](\.\/[^'"]+)['"]/g,
          /import\s+['"](\.\/[^'"]+)['"]/g,
          /require\s*\(\s*['"](\.\/[^'"]+)['"]\s*\)/g,
        ];

        const imports: string[] = [];
        for (const pattern of importPatterns) {
          let match;
          while ((match = pattern.exec(entryFile)) !== null) {
            imports.push(match[1]);
          }
        }

        const missingFiles: string[] = [];
        for (const importPath of imports) {
          // Skip CSS, SCSS, SASS, and other non-code file imports
          const cssExtensions = [".css", ".scss", ".sass", ".less", ".styl"];
          const isCssFile = cssExtensions.some((ext) => importPath.endsWith(ext));
          if (isCssFile) {
            continue; // CSS files are handled by webpack/bundler, don't need to be created
          }

          const baseName = importPath.replace(/^\.\//, "");
          const possibleNames = [
            baseName,
            `${baseName}.ts`,
            `${baseName}.tsx`,
            `${baseName}.js`,
            `${baseName}.jsx`,
          ];

          const found = possibleNames.some((name) => files[name]);
          if (!found) {
            missingFiles.push(baseName);
          }
        }

        if (missingFiles.length > 0) {
          return res.status(400).json({
            error: `Missing required files that are imported in index.ts`,
            missingFiles: missingFiles.map((f) => `${f}.tsx`),
            importsFound: [...new Set(imports)],
            suggestion: `Please include these files in your 'files' object: ${missingFiles.map((f) => `"${f}.tsx"`).join(", ")}`,
          });
        }
      }
    } else if (codeData.entryFile && codeData.rootFile && codeData.compositionFile) {
      // Old format: { entryFile: "...", rootFile: "...", compositionFile: "..." }
      files = {
        "index.ts": codeData.entryFile,
        "Root.tsx": codeData.rootFile,
      };

      // Determine the correct composition file name by checking what rootFile imports
      let compositionFileName = "Composition.tsx"; // default fallback

      // First, try to extract from rootFile imports - check ALL relative imports
      const rootContent = codeData.rootFile;
      const compositionImportRegex = /import\s+.*?\s+from\s+['"](\.\/[^'"]+)['"]/g;
      let match;
      while ((match = compositionImportRegex.exec(rootContent)) !== null) {
        const importPath = match[1];
        // If it imports something other than Root, that's the composition file
        if (!importPath.includes("Root")) {
          const baseName = importPath.replace(/^\.\//, "");
          compositionFileName = `${baseName}.tsx`;
          break; // Use the first non-Root relative import
        }
      }

      // Also try to extract component name from compositionFile export as fallback
      const compositionContent = codeData.compositionFile;
      const exportMatch = compositionContent.match(
        /export\s+(?:const|function|default\s+function)\s+(\w+)/
      );
      if (exportMatch && exportMatch[1] && compositionFileName === "Composition.tsx") {
        compositionFileName = `${exportMatch[1]}.tsx`;
      }

      files[compositionFileName] = codeData.compositionFile;

      // Extract composition ID from Root.tsx (look for id="..." or id='...' in Composition component)
      let compositionId = codeData.compositionId; // Use provided ID if available
      if (!compositionId) {
        const rootContent = codeData.rootFile;
        // Match: id="Main" or id='Main' in <Composition ... id="..." ... />
        const compositionIdMatch = rootContent.match(/<Composition[^>]*\sid=["']([^"']+)["']/);
        if (compositionIdMatch && compositionIdMatch[1]) {
          compositionId = compositionIdMatch[1];
        } else {
          compositionId = "VerxioLaunchVideo"; // default fallback
        }
      }

      // Parse entryFile to find all relative imports
      const entryContent = codeData.entryFile;
      // Match various import patterns: import ... from './X', import './X', require('./X')
      const importPatterns = [
        /import\s+.*?\s+from\s+['"](\.\/[^'"]+)['"]/g, // import ... from './X'
        /import\s+['"](\.\/[^'"]+)['"]/g, // import './X'
        /require\s*\(\s*['"](\.\/[^'"]+)['"]\s*\)/g, // require('./X')
      ];

      const imports: string[] = [];
      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(entryContent)) !== null) {
          imports.push(match[1]);
        }
      }

      // Also check Root.tsx for imports
      if (codeData.rootFile) {
        const rootContent = codeData.rootFile;
        for (const pattern of importPatterns) {
          let match;
          while ((match = pattern.exec(rootContent)) !== null) {
            imports.push(match[1]);
          }
        }
      }

      // Check for missing imports (skip CSS and other non-code files)
      const missingFiles: string[] = [];
      for (const importPath of imports) {
        // Skip CSS, SCSS, SASS, and other non-code file imports
        const cssExtensions = [".css", ".scss", ".sass", ".less", ".styl"];
        const isCssFile = cssExtensions.some((ext) => importPath.endsWith(ext));
        if (isCssFile) {
          continue; // CSS files are handled by webpack/bundler, don't need to be created
        }

        // Remove ./ prefix
        const baseName = importPath.replace(/^\.\//, "");
        // Check if file exists with any common extension
        const possibleNames = [
          baseName,
          `${baseName}.ts`,
          `${baseName}.tsx`,
          `${baseName}.js`,
          `${baseName}.jsx`,
        ];

        const found = possibleNames.some((name) => files[name]);
        if (!found) {
          missingFiles.push(baseName);
        }
      }

      if (missingFiles.length > 0) {
        return res.status(400).json({
          error: `Missing required files that are imported`,
          missingFiles: missingFiles.map((f) => `${f}.tsx`),
          importsFound: [...new Set(imports)],
          suggestion: `Please use the 'files' format and include all imported files: { files: { "index.ts": "...", "Root.tsx": "...", "${missingFiles[0]}.tsx": "...", ... } }`,
        });
      }
    } else {
      return res.status(400).json({
        error:
          "Missing required fields. Provide either: { files: {...} } or { entryFile, rootFile, compositionFile }",
      });
    }

    // Extract composition ID from Root.tsx if not provided
    let compositionId = codeData.compositionId;
    if (!compositionId) {
      // Try to find it in the files (for new format)
      const rootFile = files["Root.tsx"];
      if (rootFile) {
        const compositionIdMatch = rootFile.match(/<Composition[^>]*\sid=["']([^"']+)["']/);
        if (compositionIdMatch && compositionIdMatch[1]) {
          compositionId = compositionIdMatch[1];
        }
      }
      // Fallback to default
      if (!compositionId) {
        compositionId = "VerxioLaunchVideo";
      }
    }

    const projectId = `project-${Date.now()}`;
    const projectDir = path.join(TEMP_DIR, projectId);
    const publicDir = path.join(projectDir, "public");
    const outputPath = path.join(OUTPUT_DIR, `${projectId}.mp4`);

    // Create temp project structure
    mkdirSync(path.join(projectDir, "src"), { recursive: true });
    mkdirSync(publicDir, { recursive: true }); // Create public directory for static files

    // Scan code for npm package imports
    const allCodeFiles = Object.values(files).join("\n");
    // Match both: import ... from 'package' and import 'package'
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^./][^'"]*)['"]/g;
    const packageImports: Set<string> = new Set();
    let match;
    while ((match = importRegex.exec(allCodeFiles)) !== null) {
      const importPath = match[1];
      // Skip relative imports and remotion/react built-ins
      if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
        // Extract package name (handle scoped packages like @remotion/renderer or @remotion/google-fonts/inter)
        const packageName = importPath.startsWith("@")
          ? importPath.split("/").slice(0, 2).join("/") // @remotion/google-fonts -> @remotion/google-fonts
          : importPath.split("/")[0]; // lodash/get -> lodash
        packageImports.add(packageName);
      }
    }

    // Base dependencies
    const dependencies: Record<string, string> = {
      remotion: "^4.0.0",
      react: "^18.0.0",
      "react-dom": "^18.0.0",
    };

    // Add detected packages (use latest version)
    for (const pkg of packageImports) {
      // Include @remotion/* packages (like @remotion/google-fonts) but skip core remotion/react packages
      if (pkg.startsWith("@remotion/")) {
        // Add @remotion packages (e.g., @remotion/google-fonts, @remotion/renderer, etc.)
        dependencies[pkg] = "latest";
      } else if (!["remotion", "react", "react-dom"].includes(pkg)) {
        // Add other third-party packages
        dependencies[pkg] = "latest";
      }
    }

    // Write package.json
    writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "temp-remotion-project",
          dependencies,
        },
        null,
        2
      )
    );

    // Install dependencies if any new packages were detected
    // Include @remotion/* packages and other third-party packages (exclude base packages)
    const packagesToInstall = Object.keys(dependencies).filter(
      (p) => !["remotion", "react", "react-dom"].includes(p)
    );
    if (packagesToInstall.length > 0) {
      console.log(`Installing dependencies: ${packagesToInstall.join(", ")}`);
      try {
        execSync("npm install", {
          cwd: projectDir,
          stdio: "inherit", // Show output for debugging
          timeout: 120000, // 2 minute timeout
        });
        console.log(`Successfully installed ${packagesToInstall.length} package(s)`);
      } catch (error) {
        console.error("Failed to install dependencies:", error);
        // Continue anyway - bundler might still work, but warn user
        console.warn("Continuing with bundle despite installation failure. Some imports may fail.");
      }
    } else {
      console.log("No additional packages to install");
    }

    // Write all files from the files object
    for (const [fileName, fileContent] of Object.entries(files)) {
      const filePath = path.join(projectDir, "src", fileName);
      // Ensure directory exists for nested files
      mkdirSync(path.dirname(filePath), { recursive: true });
      // Handle escaped newlines and other escape sequences in JSON strings
      let content = fileContent;
      if (typeof fileContent === "string") {
        // First, check if the content is a JSON string that needs parsing
        // (e.g., if it's double-encoded like "{\"entryFile\": \"...\"}")
        let parsedContent = fileContent;
        try {
          // Try to parse as JSON first (in case it's double-encoded)
          const tempParsed = JSON.parse(fileContent);
          if (typeof tempParsed === "string") {
            parsedContent = tempParsed;
          } else {
            parsedContent = fileContent; // Keep original if not a string
          }
        } catch {
          // Not JSON, use as-is
          parsedContent = fileContent;
        }

        // Convert escaped sequences to actual characters
        content = parsedContent
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\r/g, "\r")
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, "\\");

        // Fix common syntax errors: newline between function params and arrow
        // Pattern: )\n  => becomes ) =>
        content = content.replace(/\)\s*\n\s*=>/g, ") =>");
      }
      writeFileSync(filePath, content);
    }

    // Scan code for staticFile() references and create placeholder files if missing
    const allCodeFilesForStatic = Object.values(files).join("\n");
    const staticFileRegex = /staticFile\(['"]([^'"]+)['"]\)/g;
    const referencedFiles: Set<string> = new Set();
    let staticMatch;
    while ((staticMatch = staticFileRegex.exec(allCodeFilesForStatic)) !== null) {
      referencedFiles.add(staticMatch[1]);
    }

    // Handle static files (audio, images, etc.) if provided
    const providedStaticFiles =
      codeData.staticFiles && typeof codeData.staticFiles === "object"
        ? Object.keys(codeData.staticFiles)
        : [];

    if (codeData.staticFiles && typeof codeData.staticFiles === "object") {
      for (const [fileName, fileData] of Object.entries(codeData.staticFiles)) {
        // Sanitize filename to handle special characters
        const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, "_").trim();
        const filePath = path.join(publicDir, sanitizedFileName);

        // Ensure directory exists for nested files
        mkdirSync(path.dirname(filePath), { recursive: true });

        try {
          let buffer: Buffer;

          // Handle both base64 encoded files and raw data
          if (typeof fileData === "string") {
            if (fileData.startsWith("data:")) {
              // Base64 data URL: data:audio/mp3;base64,...
              const base64Data = fileData.split(",")[1];
              if (!base64Data) {
                throw new Error(`Invalid data URL format for ${fileName}`);
              }
              buffer = Buffer.from(base64Data, "base64");
            } else {
              // Assume base64 without data URL prefix
              // Validate it's valid base64
              if (!fileData || fileData.trim().length === 0) {
                throw new Error(`Empty base64 data for ${fileName}`);
              }
              buffer = Buffer.from(fileData, "base64");
            }

            // Validate buffer is not empty
            if (buffer.length === 0) {
              throw new Error(`Decoded buffer is empty for ${fileName}`);
            }

            console.log(`Writing static file: ${sanitizedFileName} (${buffer.length} bytes)`);
          } else if (Buffer.isBuffer(fileData)) {
            // Raw buffer
            buffer = fileData;
          } else if (fileData instanceof Uint8Array) {
            // Uint8Array
            buffer = Buffer.from(fileData);
          } else {
            // Try to convert to string and then to buffer
            buffer = Buffer.from(String(fileData));
          }

          // Validate buffer before writing
          if (!buffer || buffer.length === 0) {
            throw new Error(`Invalid or empty buffer for ${fileName}`);
          }

          writeFileSync(filePath, buffer);

          // Verify file was written correctly
          if (!existsSync(filePath)) {
            throw new Error(`File ${sanitizedFileName} was not written successfully`);
          }

          const stats = statSync(filePath);
          if (stats.size === 0) {
            throw new Error(`File ${sanitizedFileName} was written but is empty`);
          }

          console.log(`Successfully wrote static file: ${sanitizedFileName} (${stats.size} bytes)`);
        } catch (error) {
          console.error(`Error writing static file ${fileName}:`, error);
          throw new Error(`Failed to write static file ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Create placeholder files for referenced but missing static files
    // NOTE: We no longer automatically add default audio files to prevent FFmpeg volume filter errors
    // If audio is needed, it should be explicitly provided in staticFiles
    for (const fileName of referencedFiles) {
      if (!providedStaticFiles.includes(fileName)) {
        const filePath = path.join(publicDir, fileName);
        mkdirSync(path.dirname(filePath), { recursive: true });

        // Check if it's an audio file
        const isAudioFile = /\.(mp3|wav|ogg|m4a|aac)$/i.test(fileName);
        if (isAudioFile) {
          // Don't automatically add default audio - this can cause FFmpeg volume filter errors
          // Instead, create an empty file and log a warning
          console.warn(
            `Audio file ${fileName} is referenced but not provided. Creating empty placeholder.`
          );
          console.warn(
            `If audio is needed, please provide it in the staticFiles object to avoid FFmpeg errors.`
          );
          writeFileSync(filePath, "");
          continue;
        }

        // For non-audio files, create empty file
        writeFileSync(filePath, "");
      }
    }

    // Ensure index.ts exists (required for bundling)
    if (!files["index.ts"] && !files["index.tsx"]) {
      return res.status(400).json({ error: "Missing index.ts or index.tsx file" });
    }

    // Bundle the project
    console.log("Bundling...");
    const entryPoint = files["index.ts"]
      ? path.join(projectDir, "src/index.ts")
      : path.join(projectDir, "src/index.tsx");

    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
      publicDir, // Tell Remotion bundler about the public directory for staticFile()
    });

    // Get composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
    });

    // Render video
    console.log("Rendering video...");
    try {
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        // Add timeout to prevent hanging
        timeoutInMilliseconds: 300000, // 5 minutes
      });
    } catch (renderError: any) {
      // Check if it's an FFmpeg volume filter error
      const errorMessage = renderError?.message || String(renderError);
      const errorStack = renderError?.stack || "";

      if (
        (errorMessage.includes("volume") && errorMessage.includes("between")) ||
        (errorMessage.includes("Missing") && errorMessage.includes(")")) ||
        (errorStack.includes("volume") && errorStack.includes("between"))
      ) {
        console.error("FFmpeg volume filter error detected.");
        console.error("This is likely due to too many volume keyframes in audio automation.");
        console.error("The volume filter expression is too complex for FFmpeg to parse.");
        throw new Error(
          "Audio volume automation is too complex. " +
          "The volume filter expression exceeds FFmpeg limits (too many nested if/between statements). " +
          "Please reduce the number of volume keyframes or simplify the volume automation in your Remotion composition. " +
          "Consider using fewer keyframes or a simpler volume curve."
        );
      }
      throw renderError;
    }

    // Use environment variable for base URL if available, otherwise use localhost
    // This allows the server to work in different environments (local, staging, production)
    const baseUrl = process.env.REMOTION_SERVER_URL || `http://localhost:${PORT}`;
    const videoUrl = `${baseUrl}/videos/${projectId}.mp4`;

    res.json({
      success: true,
      videoUrl,
      message: "Video rendered successfully",
    });
  } catch (error) {
    console.error("Render error:", error);
    res.status(500).json({
      error: "Rendering failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Cleanup function to delete videos and temp projects older than 30 minutes
const cleanupOldFiles = () => {
  const now = Date.now();
  const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes in milliseconds
  let deletedVideosCount = 0;
  let deletedProjectsCount = 0;

  // Clean up old videos in outputs directory
  try {
    if (existsSync(OUTPUT_DIR)) {
      const files = readdirSync(OUTPUT_DIR);

      for (const file of files) {
        // Only delete .mp4 files
        if (!file.endsWith(".mp4")) {
          continue;
        }

        const filePath = path.join(OUTPUT_DIR, file);
        try {
          const stats = statSync(filePath);
          const fileAge = now - stats.mtime.getTime();

          // Delete if file is older than 30 minutes
          if (fileAge > thirtyMinutesInMs) {
            unlinkSync(filePath);
            deletedVideosCount++;
            console.log(
              `Deleted old video: ${file} (age: ${Math.round(fileAge / 1000 / 60)} minutes)`
            );
          }
        } catch (error) {
          // Skip files that can't be accessed (might be deleted already or in use)
          console.warn(
            `Could not process video file ${file}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "Error during video cleanup:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Clean up old temp projects
  try {
    if (existsSync(TEMP_DIR)) {
      const projects = readdirSync(TEMP_DIR);

      for (const project of projects) {
        const projectPath = path.join(TEMP_DIR, project);
        try {
          const stats = statSync(projectPath);
          // Check if it's a directory (temp projects are directories)
          if (!stats.isDirectory()) {
            continue;
          }

          const projectAge = now - stats.mtime.getTime();

          // Delete if project is older than 30 minutes
          if (projectAge > thirtyMinutesInMs) {
            rmSync(projectPath, { recursive: true, force: true });
            deletedProjectsCount++;
            console.log(
              `Deleted old temp project: ${project} (age: ${Math.round(projectAge / 1000 / 60)} minutes)`
            );
          }
        } catch (error) {
          // Skip projects that can't be accessed (might be deleted already or in use)
          console.warn(
            `Could not process temp project ${project}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "Error during temp projects cleanup:",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (deletedVideosCount > 0 || deletedProjectsCount > 0) {
    console.log(
      `Cleanup completed: Deleted ${deletedVideosCount} old video file(s) and ${deletedProjectsCount} temp project(s)`
    );
  }
};

// Run cleanup immediately on startup (to clean up any old files)
cleanupOldFiles();

// Schedule cleanup to run every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
setInterval(cleanupOldFiles, CLEANUP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`🎬 Remotion render server running on http://localhost:${PORT}`);
  console.log(
    `🧹 Cleanup scheduled: Deleting videos and temp projects older than 30 minutes (runs every 5 minutes)`
  );
});
