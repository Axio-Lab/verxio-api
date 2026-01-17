import { executeCodeInSandbox, type CodeExecutionParams } from "./codeExecutionService";
import type { WorkflowContext } from "@/inngest/functions/types";

export interface TestCase {
  inputs: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  description?: string;
}

export interface TestResult {
  passed: boolean;
  testCase: TestCase;
  actualOutput?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
}

/**
 * Tests a CODE_BLOCK node with various test cases
 */
export const testCodeBlock = async (
  code: string,
  testCases: TestCase[],
  dependencies?: string[]
): Promise<TestResult[]> => {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    try {
      const executionResult = await executeCodeInSandbox({
        code,
        inputs: testCase.inputs,
        dependencies,
        timeout: 60000, // 1 minute per test
      });

      if (!executionResult.success) {
        results.push({
          passed: false,
          testCase,
          error: executionResult.error,
          executionTime: executionResult.executionTime,
        });
        continue;
      }

      // Basic validation - check if expected output matches
      let passed = true;
      if (testCase.expectedOutput) {
        passed = compareOutputs(executionResult.output || {}, testCase.expectedOutput);
      }

      results.push({
        passed,
        testCase,
        actualOutput: executionResult.output,
        executionTime: executionResult.executionTime,
      });
    } catch (error) {
      results.push({
        passed: false,
        testCase,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
};

/**
 * Tests code with mock workflow context
 */
export const testWorkflowSegment = async (
  code: string,
  mockContext: WorkflowContext,
  dependencies?: string[]
): Promise<TestResult> => {
  const executionResult = await executeCodeInSandbox({
    code,
    inputs: mockContext,
    dependencies,
    timeout: 120000, // 2 minutes for workflow segments
  });

  if (!executionResult.success) {
    return {
      passed: false,
      testCase: { inputs: mockContext },
      error: executionResult.error,
      executionTime: executionResult.executionTime,
    };
  }

  return {
    passed: true,
    testCase: { inputs: mockContext },
    actualOutput: executionResult.output,
    executionTime: executionResult.executionTime,
  };
};

/**
 * Compares actual output with expected output (basic deep equality check)
 */
function compareOutputs(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (
      typeof expectedValue === "object" &&
      expectedValue !== null &&
      !Array.isArray(expectedValue)
    ) {
      if (typeof actualValue !== "object" || actualValue === null || Array.isArray(actualValue)) {
        return false;
      }
      if (
        !compareOutputs(
          actualValue as Record<string, unknown>,
          expectedValue as Record<string, unknown>
        )
      ) {
        return false;
      }
    } else if (Array.isArray(expectedValue)) {
      if (!Array.isArray(actualValue) || actualValue.length !== expectedValue.length) {
        return false;
      }
      // Simple array comparison (can be improved)
      for (let i = 0; i < expectedValue.length; i++) {
        if (expectedValue[i] !== actualValue[i]) {
          return false;
        }
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }
  return true;
}
