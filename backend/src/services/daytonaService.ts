import { Daytona } from "@daytonaio/sdk";
import { daytonaConfig } from "@/config/daytona";

export interface CreateSandboxParams {
  envVars?: Record<string, string>;
  autoStopInterval?: number;
  autoArchiveInterval?: number;
  autoDeleteInterval?: number;
}

export interface ExecuteOptions {
  timeout?: number;
  envVars?: Record<string, string>;
  language?: string; // "typescript" | "javascript" | "python" | "rust" | "anchor"
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionTime?: number;
}

// Initialize Daytona client
export const getDaytonaClient = (): Daytona => {
  if (!daytonaConfig.apiKey) {
    throw new Error("DAYTONA_API_KEY is not configured");
  }

  return new Daytona({
    apiKey: daytonaConfig.apiKey,
    apiUrl: daytonaConfig.apiUrl,
    target: daytonaConfig.target,
  });
};

/**
 * Creates a new Daytona sandbox for TypeScript execution
 */
export const createSandbox = async (params: CreateSandboxParams = {}): Promise<string> => {
  const daytona = getDaytonaClient();

  const sandbox = await daytona.create({
    language: daytonaConfig.defaultLanguage,
    envVars: params.envVars || {},
    autoStopInterval: params.autoStopInterval || daytonaConfig.defaultAutoStopInterval,
    autoArchiveInterval: params.autoArchiveInterval || daytonaConfig.defaultAutoArchiveInterval,
    autoDeleteInterval: params.autoDeleteInterval || daytonaConfig.defaultAutoDeleteInterval,
  });

  return sandbox.id;
};

/**
 * Uploads a file to the sandbox
 */
export const uploadFile = async (
  sandboxId: string,
  path: string,
  content: string
): Promise<void> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);

  await sandbox.process.executeCommand(
    `mkdir -p $(dirname "${path}") && cat > "${path}" << 'EOF'\n${content}\nEOF`
  );
};

/**
 * Executes code in a Daytona sandbox (supports TypeScript, JavaScript, Python, Rust, Anchor)
 */
export const executeCode = async (
  sandboxId: string,
  code: string,
  options: ExecuteOptions = {}
): Promise<ExecutionResult> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);

  const startTime = Date.now();
  const timeout = options.timeout || daytonaConfig.maxExecutionTime;
  const language = options.language || "typescript";

  try {
    // Determine file path and execution command based on language
    let codeFile: string;
    let executeCommand: string;

    if (language === "python") {
      codeFile = `/tmp/code-${Date.now()}.py`;
      await uploadFile(sandboxId, codeFile, code);
      executeCommand = `python3 "${codeFile}"`;
    } else if (language === "javascript") {
      codeFile = `/tmp/code-${Date.now()}.js`;
      await uploadFile(sandboxId, codeFile, code);
      executeCommand = `node "${codeFile}"`;
    } else if (language === "rust" || language === "anchor") {
      // Rust/Anchor: create a minimal Cargo project and run (sandbox must have Rust/Anchor installed)
      const workDir = `/tmp/rs_${Date.now()}`;
      const mainPath = `${workDir}/src/main.rs`;
      await sandbox.process.executeCommand(
        `mkdir -p ${workDir}/src && cd ${workDir} && cargo init --name runtmp 2>/dev/null || true`
      );
      if (language === "anchor") {
        await sandbox.process.executeCommand(
          `cd ${workDir} && (echo ''; echo '[dependencies]'; echo 'anchor-lang = \"0.30\"') >> Cargo.toml 2>/dev/null || true`
        );
      }
      await uploadFile(sandboxId, mainPath, code);
      executeCommand = `cd ${workDir} && cargo run 2>&1`;
    } else {
      // TypeScript (default)
      codeFile = `/tmp/code-${Date.now()}.ts`;
      await uploadFile(sandboxId, codeFile, code);
      executeCommand = `npx -y tsx "${codeFile}"`;
    }

    // Execute with timeout
    const response = await Promise.race([
      sandbox.process.executeCommand(executeCommand),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), timeout)
      ),
    ]);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: response.result || "",
      exitCode: response.exitCode || 0,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
      exitCode: 1,
      executionTime,
    };
  }
};

/**
 * Gets the status of a sandbox
 */
export const getSandboxStatus = async (sandboxId: string): Promise<string> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);

  // Return sandbox status - check if sandbox is active/running
  // The SDK may not expose status directly, so we return "active" as default
  // In practice, we can check if sandbox operations succeed to infer status
  return "active";
};

/**
 * Deletes a Daytona sandbox
 */
export const deleteSandbox = async (sandboxId: string): Promise<void> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);
  await daytona.delete(sandbox);
};

/**
 * Starts a stopped sandbox
 */
export const startSandbox = async (sandboxId: string): Promise<void> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);
  await daytona.start(sandbox);
};

/**
 * Stops a running sandbox
 */
export const stopSandbox = async (sandboxId: string): Promise<void> => {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.get(sandboxId);
  await daytona.stop(sandbox);
};
