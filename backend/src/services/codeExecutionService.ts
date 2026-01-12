import {
  createSandbox,
  executeCode,
  deleteSandbox,
  startSandbox,
  stopSandbox,
  uploadFile,
  type ExecuteOptions,
  getDaytonaClient,
} from "./daytonaService";

export interface CodeExecutionParams {
  code: string;
  inputs: Record<string, unknown>;
  timeout?: number;
  dependencies?: string[];
}

export interface CodeExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
  sandboxId?: string;
}

/**
 * Validates and fixes common code issues before execution
 * Acts as a final safety net to catch errors the AI might have missed
 */
function validateAndFixCode(
  code: string,
  availableVariables: string[]
): { fixedCode: string; fixesApplied: string[] } {
  let fixedCode = code;
  const fixesApplied: string[] = [];

  // Fix 1: Replace context with inputs
  if (fixedCode.includes("context.") || /\bcontext\b/.test(fixedCode)) {
    const beforeFix = fixedCode;
    fixedCode = fixedCode.replace(/\bcontext\./g, "inputs.");
    fixedCode = fixedCode.replace(/\bcontext\b(?!\s*[:=])/g, (match, offset, string) => {
      const before = string.substring(0, offset);
      // Skip if in string or comment
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) return match;
      if (before.includes("//") || before.includes("/*")) return match;
      return "inputs";
    });
    if (fixedCode !== beforeFix) {
      fixesApplied.push("Replaced 'context' with 'inputs'");
    }
  }

  // Fix 2: Fix bare variable access
  for (const varName of availableVariables) {
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match bare variable access (not already prefixed with inputs.)
    const pattern = new RegExp(`(?<!inputs\\.)\\b${escapedVarName}\\b(?=\\.|\\[)`, "g");
    const beforeFix = fixedCode;
    fixedCode = fixedCode.replace(pattern, (match, offset, string) => {
      const before = string.substring(0, offset);
      // Skip if in declaration or string/comment
      if (before.match(/\b(const|let|var|function|class|interface|type|enum)\s+$/)) return match;
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) return match;
      if (before.includes("//") || before.includes("/*")) return match;
      return `inputs.${match}`;
    });
    if (fixedCode !== beforeFix) {
      fixesApplied.push(`Fixed bare variable access: ${varName} → inputs.${varName}`);
    }
  }

  // Fix 3: Fix httpRequest → httpResponse
  if (fixedCode.includes("httpRequest")) {
    const beforeFix = fixedCode;
    fixedCode = fixedCode.replace(/inputs\.(\w+)\.httpRequest/g, "inputs.$1.httpResponse");
    fixedCode = fixedCode.replace(/\.httpRequest\./g, ".httpResponse.");
    if (fixedCode !== beforeFix) {
      fixesApplied.push("Fixed httpRequest → httpResponse");
    }
  }

  return { fixedCode, fixesApplied };
}

/**
 * Executes TypeScript code in a Daytona sandbox
 * This service handles the full lifecycle: create sandbox, install deps, execute, cleanup
 */
export const executeCodeInSandbox = async (
  params: CodeExecutionParams
): Promise<CodeExecutionResult> => {
  let sandboxId: string | undefined;
  const startTime = Date.now();

  try {
    // Create sandbox
    sandboxId = await createSandbox({
      autoStopInterval: 15, // 15 minutes for execution
      autoDeleteInterval: 30, // Auto-delete after 30 minutes if stopped
    });

    // Start sandbox
    await startSandbox(sandboxId);

    // Install dependencies if provided
    if (params.dependencies && params.dependencies.length > 0) {
      const packageJson = {
        name: "code-execution",
        version: "1.0.0",
        type: "module",
        dependencies: params.dependencies.reduce(
          (acc, dep) => {
            acc[dep] = "latest";
            return acc;
          },
          {} as Record<string, string>
        ),
      };

      // Upload package.json to sandbox root (not /tmp)
      await uploadFile(sandboxId, "package.json", JSON.stringify(packageJson, null, 2));

      // Install dependencies using npm install
      try {
        const daytona = getDaytonaClient();
        const sandbox = await daytona.get(sandboxId);

        // Run npm install (this may take time)
        await sandbox.process.executeCommand("npm install");
        console.log(`Installed dependencies: ${params.dependencies.join(", ")}`);
      } catch (installError) {
        console.warn("Dependency installation warning:", installError);
        // Continue anyway - code might work without all dependencies
      }
    }

    // Validate and fix code before execution (final safety net)
    const availableVariables = Object.keys(params.inputs).filter((key) => key !== "credentials");
    const { fixedCode, fixesApplied } = validateAndFixCode(params.code, availableVariables);

    if (fixesApplied.length > 0) {
      console.log(`[CodeExecution] Applied ${fixesApplied.length} fix(es) to code:`, fixesApplied);
    }

    // Prepare code wrapper that calls the execute function with inputs
    // CODE_BLOCK code should export: export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>
    // Credentials are available in inputs.credentials object
    // IMPORTANT: Define inputs BEFORE the user's code to avoid "Cannot access before initialization" errors
    const codeWithExecution = `
// ============================================================================
// INPUTS STRUCTURE (for reference - inputs is defined below)
// ============================================================================
// Available variables from previous nodes:
${availableVariables.map((v) => `//   - ${v}: inputs.${v}`).join("\n")}
// Credentials: inputs.credentials.CREDENTIAL_NAME
// 
// Example HTTP node access: inputs.variableName?.httpResponse?.data
// Example AI node access: inputs.variableName?.text || inputs.variableName
// ============================================================================

// Inputs are provided here before user code to ensure they're available
const inputs: Record<string, any> = ${JSON.stringify(params.inputs, null, 2)};

// Credentials are available as inputs.credentials object
// Access them like: inputs.credentials.CREDENTIAL_NAME

${fixedCode}

// Execute the default export function with inputs
// Note: The execute function should be defined in the user's code above
if (typeof execute === 'undefined') {
  console.error("Error: execute function is not defined. Code must export: export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>");
  process.exit(1);
}

// Execute and log result
execute(inputs).then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error("Execution error:", error);
  process.exit(1);
});
`;

    // Upload code file
    const codeFile = `/tmp/execute-${Date.now()}.ts`;
    await uploadFile(sandboxId, codeFile, codeWithExecution);

    // Execute code
    const executionResult = await executeCode(sandboxId, codeWithExecution, {
      timeout: params.timeout || 300000, // 5 minutes default
    });

    if (!executionResult.success) {
      return {
        success: false,
        error: executionResult.error || "Execution failed",
        executionTime: executionResult.executionTime,
        sandboxId,
      };
    }

    // Parse output if it's JSON
    let output: Record<string, unknown> | undefined;
    try {
      // Try to extract JSON from output
      const jsonMatch = executionResult.output?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        output = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON, wrap output in a result object
        output = { result: executionResult.output };
      }
    } catch {
      // If parsing fails, use raw output
      output = { result: executionResult.output };
    }

    return {
      success: true,
      output,
      executionTime: executionResult.executionTime,
      sandboxId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
      sandboxId,
    };
  } finally {
    // Cleanup: Stop and delete sandbox (or let auto-delete handle it)
    if (sandboxId) {
      try {
        await stopSandbox(sandboxId);
        // Note: We might want to keep the sandbox for debugging
        // For now, let auto-delete handle cleanup after 30 minutes
        // await deleteSandbox(sandboxId);
      } catch (cleanupError) {
        console.error("Error cleaning up sandbox:", cleanupError);
      }
    }
  }
};
