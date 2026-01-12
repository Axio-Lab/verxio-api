import Anthropic from "@anthropic-ai/sdk";
import type { NodeExecutor } from "@/inngest/functions/types";
import type { WorkflowContext } from "@/inngest/functions/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

interface GenerateCodeOptions {
  requirement: string;
  context: WorkflowContext;
  existingNodes: Array<{ type: string; data: Record<string, unknown> }>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  model?: string;
}

/**
 * Generates TypeScript code for a CODE_BLOCK node that follows the NodeExecutor interface
 */
export const generateCustomCode = async (
  options: GenerateCodeOptions
): Promise<{ code: string; dependencies?: string[] }> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Standalone code pattern for CODE_BLOCK nodes
  // CODE_BLOCK nodes run in isolated sandboxes and should NOT use inngest or any workflow infrastructure
  const exampleCode = `
// Example: Accessing HTTP node output
export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>> {
  // CRITICAL: ALWAYS use inputs. prefix to access variables from previous nodes
  // ✅ CORRECT: Access HTTP node output
  const jokes = inputs.jokesResponse?.httpResponse?.data || [];
  
  // ❌ WRONG: const jokes = jokesResponse.httpRequest.data; (jokesResponse is not defined)
  // ❌ WRONG: const jokes = context.jokesResponse; (context doesn't exist)
  
  // Your logic here
  const formattedJokes = jokes.map(joke => \`\${joke.setup} - \${joke.punchline}\`).join('\\n');
  
  return {
    result: formattedJokes
  };
}
`;

  const systemPrompt = `You are an expert TypeScript developer specializing in workflow automation. 
Generate standalone TypeScript code for Verxio CODE_BLOCK nodes that execute in isolated sandboxes.

🚨 CRITICAL MANDATORY RULE - READ THIS FIRST 🚨
**NEVER USE THE WORD "context" IN YOUR CODE**
- The function parameter is named "inputs", NOT "context"
- If you use "context" anywhere in your code, it will cause a ReferenceError
- ALWAYS use "inputs" to access data from previous nodes
- Example: const data = inputs.variableName; ✅
- NEVER: const data = context.variableName; ❌ (THIS WILL FAIL)

CRITICAL: Inspect and ensure the best result at every step:
1. **Code Quality**: Write production-ready, well-structured, and maintainable code
2. **Error Handling**: Include proper error handling and validation
3. **Type Safety**: Use TypeScript types appropriately
4. **Best Practices**: Follow TypeScript and Node.js best practices
5. **Input Validation**: Validate and handle inputs properly
6. **Output Format**: Return data in the correct format for next nodes
7. **Documentation**: Include clear comments for complex logic
8. **Performance**: Write efficient code that handles edge cases

IMPORTANT REQUIREMENTS:
1. The code MUST export a default async function named "execute"
2. The function signature: export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>
3. **CRITICAL**: The parameter is named "inputs" - use "inputs" throughout your code, NEVER "context"
4. DO NOT import or use 'inngest', 'step', 'publish', or any workflow infrastructure - this code runs in isolation
5. Access data from previous workflow nodes via the inputs parameter (NOT context)
6. Return a plain object with your results (will be merged into workflow context)
7. Handle errors by throwing them (will be caught by the execution framework)
8. Only use standard Node.js APIs and npm packages you explicitly need
9. Keep code simple and focused - no unnecessary dependencies

CREDENTIALS AND API KEYS:
- If the code needs API keys, inform the user they must add them as custom credentials
- Include a comment in the generated code: // Note: Add API key as custom credential named 'CREDENTIAL_NAME'
- Access credentials via inputs.credentials.CREDENTIAL_NAME (where CREDENTIAL_NAME is the credential name)
- Example: const apiKey = inputs.credentials.MY_API_KEY;
- Always inform users about required credentials in code comments

Available input variables from previous nodes: ${Object.keys(options.context).join(", ")}

INPUT VARIABLE STRUCTURE (CRITICAL - USE THIS EXACT STRUCTURE):
${Object.entries(options.context)
  .map(([key, value]) => {
    // Show the full structure for HTTP nodes
    if (value && typeof value === "object" && "httpResponse" in value) {
      return `- ${key}: {
    httpResponse: {
      data: <actual response data>,
      status: <HTTP status code>,
      statusText: <HTTP status text>
    }
  }
  ✅ CORRECT ACCESS: inputs.${key}?.httpResponse?.data
  ❌ WRONG: inputs.${key}.httpRequest.body (httpRequest doesn't exist)`;
    }
    const valueStr =
      typeof value === "object" ? JSON.stringify(value, null, 2).substring(0, 200) : String(value);
    return `- ${key}: ${valueStr}${valueStr.length >= 200 ? "..." : ""}`;
  })
  .join("\n")}

REAL EXAMPLE FROM WORKFLOW EXECUTION:
{
  "testflow": {
    "httpResponse": {
      "data": { "id": 1, "title": "example" },
      "status": 200,
      "statusText": "OK"
    }
  },
  "testflow2": {
    "httpResponse": {
      "data": [{ "id": 1 }, { "id": 2 }],
      "status": 200,
      "statusText": "OK"
    }
  }
}

✅ CORRECT CODE:
const data1 = inputs.testflow?.httpResponse?.data;
const data2 = inputs.testflow2?.httpResponse?.data || [];

❌ WRONG CODE:
const data1 = context.testflow.httpRequest.body; // context doesn't exist, httpRequest doesn't exist
const data2 = inputs.testflow2.httpRequest.body; // httpRequest doesn't exist, use httpResponse.data

${options.inputSchema ? `Input schema: ${JSON.stringify(options.inputSchema, null, 2)}` : ""}
${options.outputSchema ? `Output schema: ${JSON.stringify(options.outputSchema, null, 2)}` : ""}

CRITICAL CONTEXT STRUCTURE UNDERSTANDING:
The workflow context accumulates data from each node in the execution chain. Each node's output is merged into the context and becomes available to subsequent nodes.

CONTEXT ACCUMULATION PATTERN:
1. **Node 1 (Manual Trigger)**: Starts with empty context or initial data
2. **Node 2 (e.g., HTTP Request - "testflow")**: Output structure:
   {
     "testflow": {
       "httpResponse": {
         "data": { ... },
         "status": 200,
         "statusText": "OK"
       }
     }
   }
   Context after Node 2: { testflow: { httpResponse: { data: {...}, status: 200, statusText: "OK" } } }

3. **Node 3 (e.g., HTTP Request - "testflow2")**: Output structure:
   {
     "result": {
       "testflow": { ... },  // Previous node's output is preserved
       "testflow2": {
         "httpResponse": {
           "data": [ ... ],
           "status": 200,
           "statusText": "OK"
         }
       }
     }
   }
   Context after Node 3: Contains BOTH testflow and testflow2 data

KEY PRINCIPLES:
- **Context accumulates**: Each node sees ALL previous node outputs
- **Variable names matter**: Output is stored under the node's variable name (e.g., "testflow", "result")
- **Nested structure**: HTTP nodes wrap data in { variableName: { httpResponse: { data, status, statusText } } }
- **Preservation**: Previous outputs are preserved and merged into new context

CRITICAL VARIABLE ACCESS REQUIREMENTS (MANDATORY):
1. **NEVER use "context" variable - it does NOT exist in CODE_BLOCK sandbox**: 
   - In workflow execution, data is called "context"
   - But in CODE_BLOCK sandbox, it's passed as "inputs" parameter
   - The execute function receives: execute(inputs: Record<string, any>)
   - ✅ ALWAYS use: inputs.variableName
   - ❌ NEVER use: context.variableName (will cause ReferenceError)

2. **ALWAYS use inputs parameter**: All previous node outputs are accumulated in the inputs object
   - Each node's output is merged into inputs
   - Example: Manual Trigger → HTTP (testflow) → HTTP (testflow2)
   - After execution: inputs = { testflow: {...}, testflow2: {...} }

3. **HTTP Node structure (CRITICAL - FOLLOW EXACTLY)**:
   - HTTP nodes output: { variableName: { httpResponse: { data, status, statusText } } }
   - ✅ CORRECT: inputs.jokesResponse?.httpResponse?.data
   - ✅ CORRECT: inputs.testflow?.httpResponse?.data
   - ❌ WRONG: context.jokesResponse.httpRequest.body (context doesn't exist, httpRequest doesn't exist)
   - ❌ WRONG: inputs.jokesResponse.httpRequest.body (wrong property - use httpResponse, not httpRequest)
   - ❌ WRONG: inputs.jokesResponse.body (missing httpResponse wrapper)

4. **Real example from workflow**:
   Input structure:
   {
     "jokesResponse": {
       "httpResponse": {
         "data": [{ "id": 122, "punchline": "...", "setup": "..." }],
         "status": 200,
         "statusText": "OK"
       }
     }
   }
   
   CORRECT code:
   const jokes = inputs.jokesResponse?.httpResponse?.data || [];
   
   WRONG code:
   const jokes = context.jokesResponse.httpRequest.body; // Multiple errors!

5. **Nested property access**: Use optional chaining (?.) to safely access nested properties
6. **Example for HTTP nodes**: 
   - const jokes = inputs.jokesResponse?.httpResponse?.data || [];
   - const responseData = inputs.testflow?.httpResponse?.data;
7. **Example for AI nodes**: inputs.socialContent?.gemini || inputs.socialContent
8. **Handle missing data**: Always check if properties exist before accessing them
9. **Type safety**: Use TypeScript optional chaining and nullish coalescing (??) for safety
10. **Context awareness**: Remember that inputs contains ALL previous node outputs, not just the last one

AUTONOMOUS ERROR DEBUGGING:
- If you see "context is not defined": Use inputs instead of context - the parameter is named inputs
- If you see errors like "Cannot access 'X' before initialization", ensure variables are accessed inside the execute function, not at module level
- If you see "undefined" errors, add proper null checks and optional chaining
- If you see type errors, ensure proper TypeScript typing
- If accessing HTTP node data fails, verify you're using: inputs.variableName.httpResponse.data (not httpRequest.body)

Generate clean, production-ready TypeScript code only. Do not include markdown code blocks or explanations.`;

  // Build the actual inputs structure for this workflow
  const inputsStructure = JSON.stringify(options.context, null, 2);
  const availableVariables = Object.keys(options.context).join(", ");

  const userPrompt = `🚨 MANDATORY CODE TEMPLATE - YOU MUST FOLLOW THIS EXACT STRUCTURE 🚨

export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>> {
  // CRITICAL: ALWAYS use inputs. prefix for ALL variables from previous nodes
  // Example for HTTP node output:
  const jokes = inputs.jokesResponse?.httpResponse?.data || [];
  
  // Example for AI node output:
  const content = inputs.socialContent?.gemini || inputs.socialContent;
  
  // Your logic here...
  const result = {
    // Your processed data
  };
  
  return result;
}

ACTUAL INPUTS STRUCTURE FOR THIS WORKFLOW:
${inputsStructure}

AVAILABLE VARIABLES: ${availableVariables}

VALIDATION CHECKLIST (MUST PASS ALL):
- [ ] All variable access uses inputs. prefix (e.g., inputs.variableName, NOT variableName)
- [ ] HTTP nodes use httpResponse.data (NOT httpRequest.body)
- [ ] No bare variable names from context (e.g., jokesResponse → inputs.jokesResponse)
- [ ] No 'context' variable used (use 'inputs' instead)
- [ ] All code is inside the execute function
- [ ] Optional chaining (?.) is used for safe property access

Generate standalone TypeScript code for the following requirement:

${options.requirement}

${
  options.existingNodes.length > 0
    ? `Existing nodes in workflow: ${JSON.stringify(
        options.existingNodes.map((n) => ({ type: n.type })),
        null,
        2
      )}`
    : ""
}

🚨 MANDATORY: NEVER USE "context" - USE "inputs" INSTEAD 🚨

AUTONOMOUS ERROR DEBUGGING & FIXING (CRITICAL):
1. **"context is not defined" ERROR**: 
   - 🚨 DO NOT use "context" variable - it does NOT exist in CODE_BLOCK sandbox
   - In workflow execution, data is called "context", but in CODE_BLOCK it's passed as "inputs"
   - ✅ ALWAYS use inputs parameter instead
   - The function signature is: execute(inputs: Record<string, any>)
   - ✅ CORRECT Example: const jokes = inputs.jokesResponse?.httpResponse?.data || [];
   - ❌ WRONG Example: const jokes = context.jokesResponse.httpRequest.body; (MULTIPLE ERRORS: context doesn't exist, httpRequest doesn't exist)
   - ❌ WRONG Example: const data = context.someVariable; (THIS WILL FAIL - context doesn't exist)
   - ✅ CORRECT: const data = inputs.someVariable;

2. **"httpRequest is not defined" or "Cannot read property 'body' of undefined"**:
   - HTTP nodes output data in httpResponse, NOT httpRequest
   - ✅ CORRECT: inputs.variableName?.httpResponse?.data
   - ❌ WRONG: inputs.variableName.httpRequest.body (httpRequest doesn't exist)
   - The structure is: { variableName: { httpResponse: { data, status, statusText } } }

2. **"Cannot access 'X' before initialization"**: 
   - ALL variable access MUST be INSIDE the execute function
   - DO NOT access inputs at module level
   - Example: const data = inputs.variableName; (inside execute function)

3. **HTTP Node data access**:
   - HTTP nodes output: { variableName: { httpResponse: { data, status, statusText } } }
   - CORRECT: inputs.jokesResponse?.httpResponse?.data
   - CORRECT: inputs.testflow?.httpResponse?.data
   - WRONG: inputs.jokesResponse.httpRequest.body (use httpResponse, not httpRequest)
   - WRONG: context.jokesResponse.httpResponse.data (use inputs, not context)

4. **"undefined" errors**: 
   - Add proper null checks: if (!inputs.variableName) return { error: "Missing variable" };
   - Use optional chaining: inputs.socialContent?.gemini?.text
   - Provide fallbacks: inputs.socialContent?.gemini || inputs.socialContent || ""

5. **Type errors**: 
   - Use proper TypeScript typing
   - Add type guards: if (typeof inputs.data === 'string') { ... }
   - Validate types before use

6. **Input validation**: 
   - Always validate inputs exist before using them
   - Check nested properties exist: inputs.parsedContent?.result?.contentPieces
   - Handle arrays safely: (inputs.array || []).map(...)

7. **Error handling**: 
   - Wrap risky operations in try-catch
   - Return meaningful error messages
   - Log errors for debugging

8. **Variable access patterns**:
   - Safe: const data = inputs.variableName || {};
   - Safe: const items = inputs.array || [];
   - Safe: const nested = inputs.obj?.nested?.property || "";
   - Safe HTTP: const jokes = inputs.jokesResponse?.httpResponse?.data || [];

CRITICAL CODE STRUCTURE:
1. Export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>
2. ALL code must be INSIDE the execute function
3. **MANDATORY**: ALWAYS use inputs. prefix when accessing variables from previous nodes
   - ✅ CORRECT: const jokes = inputs.jokesResponse?.httpResponse?.data;
   - ❌ WRONG: const jokes = jokesResponse.httpRequest.data; (jokesResponse is not defined - must use inputs.jokesResponse)
   - ❌ WRONG: const data = variableName; (must use inputs.variableName)
4. Access variables from inputs parameter: const data = inputs.variableName;
5. Use optional chaining for nested access: inputs.socialContent?.gemini?.text
6. For HTTP nodes: inputs.variableName.httpResponse.data (NOT httpRequest.body)
7. Return a plain object with results

🚨 CRITICAL REMINDER: Variables from previous nodes are NOT in global scope
- They are ONLY available via the inputs parameter
- You MUST use inputs.variableName, NOT just variableName
- Example: If previous node output is stored as "jokesResponse", access it as inputs.jokesResponse

Generate the complete TypeScript code as a standalone function. Do NOT use inngest, step, publish, or any workflow infrastructure. Only use standard libraries.`;

  try {
    const selectedModel = options.model || "claude-sonnet-4-5-20250929";

    const message = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${exampleCode}\n\n${userPrompt}`,
        },
      ],
    });

    let code = "";
    if (message.content[0].type === "text") {
      code = message.content[0].text;
    }

    // Extract code from markdown if present
    code = code
      .replace(/```typescript\n?/g, "")
      .replace(/```ts\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // CRITICAL: Replace any instances of "context" with "inputs" as a safety measure
    // This ensures the generated code uses the correct parameter name
    // Use regex to replace context.variableName with inputs.variableName, but be careful not to replace
    // "context" when it's part of a string literal or comment
    code = code.replace(/\bcontext\./g, "inputs.");
    // Also replace standalone context references (but be careful with string literals)
    // This is a safety net - the prompts should prevent this, but we fix it anyway
    code = code.replace(/\bcontext\b(?!\s*[:=])/g, (match, offset, string) => {
      // Check if it's inside a string literal (basic check)
      const before = string.substring(0, offset);
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      // If odd number of quotes before, we're inside a string - don't replace
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return match;
      }
      // Check if it's in a comment
      if (before.includes("//") || before.includes("/*")) {
        const lastComment = Math.max(before.lastIndexOf("//"), before.lastIndexOf("/*"));
        const lastNewline = before.lastIndexOf("\n");
        if (lastComment > lastNewline) {
          return match; // Inside a comment
        }
      }
      return "inputs";
    });

    // CRITICAL: Fix bare variable access that should use inputs. prefix
    // Get list of available input variable names from context
    const inputVariableNames = Object.keys(options.context);
    // For each input variable name, check if it's accessed without inputs. prefix
    // Pattern: variableName.property or variableName[ or variableName) or variableName,
    // But NOT: inputs.variableName or const variableName = or function variableName
    for (const varName of inputVariableNames) {
      // Replace bare variable access: jokesResponse.property -> inputs.jokesResponse.property
      // Match: jokesResponse followed by . or [ or whitespace then ,;)]
      const bareVarPattern = new RegExp(
        `\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?=\\.|\\[|\\s*[,;)\\]])`,
        "g"
      );
      code = code.replace(bareVarPattern, (match, offset, string) => {
        const before = string.substring(0, offset);
        const after = string.substring(offset + match.length);

        // Skip if already prefixed with inputs.
        if (before.endsWith("inputs.")) {
          return match;
        }

        // Skip if it's a declaration (const, let, var, function, class, interface, type, enum)
        const declarationPattern =
          /\b(const|let|var|function|class|interface|type|enum|export\s+(default\s+)?(const|let|var|function|class|interface|type|enum))\s+$/;
        if (declarationPattern.test(before)) {
          return match;
        }

        // Skip if it's being assigned to (variableName = or variableName:)
        if (after.match(/^\s*[:=]/)) {
          return match;
        }

        // Skip if it's inside a string literal
        const singleQuotes = (before.match(/'/g) || []).length;
        const doubleQuotes = (before.match(/"/g) || []).length;
        const backticks = (before.match(/`/g) || []).length;
        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
          return match;
        }

        // Skip if it's in a comment
        const lastComment = Math.max(before.lastIndexOf("//"), before.lastIndexOf("/*"));
        const lastNewline = before.lastIndexOf("\n");
        if (lastComment > lastNewline) {
          return match; // Inside a comment
        }

        // Replace with inputs.variableName
        return `inputs.${match}`;
      });
    }

    // CRITICAL: Fix httpRequest -> httpResponse (HTTP nodes use httpResponse, not httpRequest)
    // Replace inputs.variableName.httpRequest with inputs.variableName.httpResponse
    code = code.replace(/inputs\.(\w+)\.httpRequest/g, "inputs.$1.httpResponse");
    // Also fix bare httpRequest references after inputs. (shouldn't happen, but safety net)
    code = code.replace(/inputs\.(\w+)\.httpRequest\./g, "inputs.$1.httpResponse.");

    // Extract dependencies from code (simple regex, can be improved)
    const dependencyMatches = code.match(/import\s+.*?\s+from\s+["']([^"']+)["']/g) || [];
    const dependencies: string[] = [];
    const excludedPackages = ["inngest", "inngest/step", "inngest/channels"]; // Exclude workflow infrastructure

    dependencyMatches.forEach((match) => {
      const dep = match.match(/["']([^"']+)["']/)?.[1];
      if (dep && !dep.startsWith(".") && !dep.startsWith("@/")) {
        // Extract package name (handle scoped packages)
        const packageName =
          dep.split("/")[0] + (dep.startsWith("@") ? "/" + dep.split("/")[1] : "");
        // Exclude workflow infrastructure and only include actual npm packages
        if (
          packageName &&
          !dependencies.includes(packageName) &&
          !excludedPackages.includes(packageName) &&
          !excludedPackages.some((excluded) => packageName.startsWith(excluded))
        ) {
          dependencies.push(packageName);
        }
      }
    });

    return { code, dependencies: dependencies.length > 0 ? dependencies : undefined };
  } catch (error) {
    throw new Error(
      `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Validates TypeScript code structure and security
 */
export const validateCodeStructure = (
  code: string
): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Basic validation
  if (!code || code.trim().length === 0) {
    errors.push("Code is empty");
  }

  // Check for execute function pattern (CODE_BLOCK nodes should export a default execute function)
  if (!code.includes("export default") || !code.includes("function execute")) {
    errors.push("Code must export a default async function named 'execute'");
  }

  // Security checks - disallow dangerous patterns
  const dangerousPatterns = [
    /eval\(/,
    /Function\(/,
    /require\(["']child_process["']\)/,
    /require\(["']fs["']\)/,
    /process\.exit/,
    /require\(["']os["']\)/,
  ];

  dangerousPatterns.forEach((pattern) => {
    if (pattern.test(code)) {
      errors.push(`Potentially dangerous pattern detected: ${pattern}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};
