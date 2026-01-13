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
  language?: string; // "typescript" | "javascript" | "python"
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
 * Only applies fixes for TypeScript/JavaScript (not Python)
 */
function validateAndFixCode(
  code: string,
  availableVariables: string[],
  language: string = "typescript"
): { fixedCode: string; fixesApplied: string[] } {
  // Skip validation/fixing for Python - it has different syntax
  if (language === "python") {
    return { fixedCode: code, fixesApplied: [] };
  }
  let fixedCode = code;
  const fixesApplied: string[] = [];

  // Fix 1: Replace context with inputs (more aggressive)
  if (fixedCode.includes("context.") || /\bcontext\b/.test(fixedCode)) {
    const beforeFix = fixedCode;
    // Replace context. with inputs.
    fixedCode = fixedCode.replace(/\bcontext\./g, "inputs.");
    // Replace standalone context (not in declarations, strings, or comments)
    fixedCode = fixedCode.replace(/\bcontext\b(?!\s*[:=])/g, (match, offset, string) => {
      const before = string.substring(0, offset);
      const after = string.substring(offset + match.length);

      // Skip if in string literal
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      const backticks = (before.match(/`/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
        return match;
      }

      // Skip if in comment
      if (before.includes("//") || before.includes("/*")) {
        const lastComment = Math.max(before.lastIndexOf("//"), before.lastIndexOf("/*"));
        const lastNewline = before.lastIndexOf("\n");
        if (lastComment > lastNewline) {
          return match;
        }
      }

      // Skip if it's a declaration (const context =, function context, etc.)
      const declarationPattern = /\b(const|let|var|function|class|interface|type|enum)\s+context\b/;
      if (
        declarationPattern.test(string.substring(Math.max(0, offset - 20), offset + match.length))
      ) {
        return match;
      }

      // Replace with inputs
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

  // Fix 4: Detect and warn about undefined variable access
  // Find patterns like inputs.variableName where variableName is not in availableVariables
  const undefinedVarPattern = /inputs\.(\w+)/g;
  const undefinedVars = new Set<string>();
  let match;
  while ((match = undefinedVarPattern.exec(fixedCode)) !== null) {
    const varName = match[1];
    // Skip if it's a known property access (like httpResponse, data, text, etc.)
    const knownProperties = [
      "httpResponse",
      "data",
      "status",
      "statusText",
      "text",
      "credentials",
      "result",
      "error",
      "success",
    ];
    if (!knownProperties.includes(varName) && !availableVariables.includes(varName)) {
      undefinedVars.add(varName);
    }
  }

  if (undefinedVars.size > 0) {
    const undefinedVarList = Array.from(undefinedVars).join(", ");
    const availableVarList = availableVariables.join(", ");
    fixesApplied.push(
      `⚠️ Warning: Code accesses undefined variables: ${undefinedVarList}. Available variables: ${availableVarList}`
    );
    console.warn(
      `[CodeExecution] Code accesses undefined variables: ${undefinedVarList}. Available variables: ${availableVarList}`
    );
  }

  return { fixedCode, fixesApplied };
}

/**
 * Executes code in a Daytona sandbox (supports TypeScript, JavaScript, Python)
 * This service handles the full lifecycle: create sandbox, install deps, execute, cleanup
 */
export const executeCodeInSandbox = async (
  params: CodeExecutionParams
): Promise<CodeExecutionResult> => {
  let sandboxId: string | undefined;
  const startTime = Date.now();
  const language = params.language || "typescript";

  try {
    // Create sandbox
    sandboxId = await createSandbox({
      autoStopInterval: 15, // 15 minutes for execution
      autoDeleteInterval: 30, // Auto-delete after 30 minutes if stopped
    });

    // Start sandbox
    await startSandbox(sandboxId);

    // Install dependencies if provided (only for TypeScript/JavaScript)
    if (
      (language === "typescript" || language === "javascript") &&
      params.dependencies &&
      params.dependencies.length > 0
    ) {
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

    // Install Python dependencies if provided (for Python)
    if (language === "python" && params.dependencies && params.dependencies.length > 0) {
      try {
        const daytona = getDaytonaClient();
        const sandbox = await daytona.get(sandboxId);

        // Install Python packages using pip
        const pipInstallCmd = `pip install ${params.dependencies.join(" ")}`;
        await sandbox.process.executeCommand(pipInstallCmd);
        console.log(`Installed Python dependencies: ${params.dependencies.join(", ")}`);
      } catch (installError) {
        console.warn("Python dependency installation warning:", installError);
        // Continue anyway - code might work without all dependencies
      }
    }

    // Validate and fix code before execution (final safety net - only for TS/JS)
    const availableVariables = Object.keys(params.inputs).filter((key) => key !== "credentials");
    const { fixedCode, fixesApplied } = validateAndFixCode(
      params.code,
      availableVariables,
      language
    );

    if (fixesApplied.length > 0) {
      console.log(`[CodeExecution] Applied ${fixesApplied.length} fix(es) to code:`, fixesApplied);
    }

    // Prepare language-specific code wrapper
    let codeWithExecution: string;
    let fileExtension: string;

    if (language === "python") {
      // Python code wrapper
      codeWithExecution = `import json
import sys

# ============================================================================
# INPUTS STRUCTURE (for reference - inputs is defined below)
# ============================================================================
# Available variables from previous nodes:
${availableVariables.map((v) => `#   - ${v}: inputs['${v}']`).join("\n")}
# Credentials: inputs['credentials']['CREDENTIAL_NAME']
# 
# Example HTTP node access: inputs.get('variableName', {}).get('httpResponse', {}).get('data', [])
# Example AI node access: inputs.get('variableName', {}).get('text') or inputs.get('variableName', {})
# ============================================================================

# Inputs are provided as JSON string and parsed
inputs_str = '''${JSON.stringify(params.inputs, null, 2).replace(/'/g, "\\'")}'''
inputs = json.loads(inputs_str)

# User code here
${fixedCode}

# Execute the function if it exists
if 'execute' in globals() and callable(execute):
    try:
        result = execute(inputs)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2), file=sys.stderr)
        sys.exit(1)
else:
    print(json.dumps({"error": "execute function is not defined. Code must define: def execute(inputs: dict) -> dict:"}, indent=2), file=sys.stderr)
    sys.exit(1)
`;
      fileExtension = "py";
    } else {
      // TypeScript/JavaScript code wrapper
      // Check if code already has the execute function wrapper
      let codeToExecute = fixedCode;
      const hasExecuteFunction =
        /(export\s+default\s+)?(async\s+)?function\s+execute|const\s+execute\s*=|execute\s*=\s*async/.test(
          fixedCode
        );

      if (!hasExecuteFunction) {
        // Code doesn't have execute function - wrap it
        // Check if it has a return statement (suggesting it's the function body)
        const hasReturn = /\breturn\s+/.test(fixedCode);

        if (hasReturn) {
          // Wrap the code in an execute function
          codeToExecute = `export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>> {
${fixedCode}
}`;
        } else {
          // Code might be incomplete, but wrap it anyway
          codeToExecute = `export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>> {
${fixedCode}
return {};
}`;
        }
      }

      // Strip export default BEFORE inserting into wrapper
      // This prevents "Unexpected token 'export'" errors
      codeToExecute = codeToExecute
        .replace(/export\s+default\s+async\s+function\s+execute/g, "async function execute")
        .replace(/export\s+default\s+function\s+execute/g, "function execute")
        .replace(/export\s+default\s+const\s+execute\s*=/g, "const execute =")
        .replace(/export\s+default\s+/g, "");

      codeWithExecution = `
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

// User code (export default has been stripped, function is defined normally)
${codeToExecute}

// Execute the function directly - no eval needed since export default was stripped
(async () => {
  try {
    if (typeof execute === 'undefined' || typeof execute !== 'function') {
      console.error("Error: execute function is not defined.");
      console.error("Code must define: async function execute(inputs: Record<string, any>): Promise<Record<string, any>>");
      process.exit(1);
    }
    
    // Execute and log result
    const result = await execute(inputs);
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Execution error:", error?.message || error);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
})();
`;
      fileExtension = language === "typescript" ? "ts" : "js";
    }

    // Upload code file
    const codeFile =
      language === "python"
        ? `/tmp/execute-${Date.now()}.${fileExtension}`
        : `/tmp/wrapper-${Date.now()}.${fileExtension}`;
    await uploadFile(sandboxId, codeFile, codeWithExecution);

    // Execute code with language parameter
    const executionResult = await executeCode(sandboxId, codeWithExecution, {
      timeout: params.timeout || 300000, // 5 minutes default
      language: language,
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
