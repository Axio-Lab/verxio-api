/**
 * Prompt Optimizer Service
 *
 * Uses Opik's optimization capabilities to improve system prompts
 * for the Verxio Agent based on evaluation metrics.
 */

import { opik, OPIK_ENABLED } from "./opikService";

// ============================================
// Types
// ============================================

export type PromptType = "planning" | "code_generation" | "workflow" | "general";

export interface OptimizationDataPoint {
  input: string;
  expectedOutput?: string;
  context?: string[];
}

export interface OptimizationResult {
  success: boolean;
  originalPrompt: string;
  optimizedPrompt?: string;
  improvement?: number;
  metrics?: {
    originalScore: number;
    optimizedScore: number;
  };
  error?: string;
}

export interface OptimizationSuggestion {
  promptType: PromptType;
  currentScore: number;
  suggestion: string;
  potentialImprovement: number;
  priority: "high" | "medium" | "low";
}

// ============================================
// Current System Prompts (for reference)
// ============================================

const PROMPT_TEMPLATES: Record<PromptType, string> = {
  planning: `You are Verxio, an expert workflow planning assistant. You help users brainstorm, design and refine automation workflows through conversation.

## Response Guidelines
- Keep responses SHORT and focused (2-4 paragraphs max)
- Use bullet points for lists
- Ask one clarifying question at a time
- No emojis, no excessive formatting
- Be direct and practical`,

  code_generation: `Generate clean, production-ready code based on the requirements.
- Use the specified language syntax
- Follow best practices
- Handle errors appropriately
- Keep code simple and focused`,

  workflow: `Create workflows based on user requirements.
- Identify the appropriate trigger
- Chain actions logically
- Configure each node properly
- Connect nodes in sequence`,

  general: `You are Verxio, an intelligent automation assistant.
Help users accomplish their goals efficiently and accurately.`,
};

// ============================================
// Optimization Functions
// ============================================

/**
 * Analyze traces to generate optimization suggestions
 */
export async function generateOptimizationSuggestions(
  userId: string
): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  // Return empty if Opik is not enabled
  if (!OPIK_ENABLED || !opik) {
    return suggestions;
  }

  try {
    // Fetch recent traces for this user via the API
    const projectName = process.env.OPIK_PROJECT || "verxio-agent";
    const response = await opik.api.traces.getTracesByProject({
      projectName,
      filters: `metadata.userId = "${userId}"`,
      size: 100,
    });

    const traces = (response?.content || []) as any[];

    if (!traces || traces.length === 0) {
      return suggestions;
    }

    // Group traces by type and analyze patterns
    const tracesByType: Record<string, any[]> = {};
    for (const trace of traces) {
      const metadata = trace.metadata || {};
      const traceType = metadata.traceType || "general";
      if (!tracesByType[traceType]) {
        tracesByType[traceType] = [];
      }
      tracesByType[traceType].push(trace);
    }

    // Analyze each type for potential improvements
    for (const [type, typeTraces] of Object.entries(tracesByType)) {
      const analysis = analyzeTracePatterns(typeTraces);

      if (analysis.errorRate > 0.1) {
        suggestions.push({
          promptType: type as PromptType,
          currentScore: (1 - analysis.errorRate) * 100,
          suggestion: `High error rate detected (${(analysis.errorRate * 100).toFixed(1)}%). Consider adding more specific instructions or error handling guidance to the ${type} prompt.`,
          potentialImprovement: analysis.errorRate * 20,
          priority: analysis.errorRate > 0.2 ? "high" : "medium",
        });
      }

      if (analysis.avgDuration > 30000) {
        suggestions.push({
          promptType: type as PromptType,
          currentScore: Math.max(0, 100 - (analysis.avgDuration - 10000) / 500),
          suggestion: `Responses are taking longer than expected (avg ${(analysis.avgDuration / 1000).toFixed(1)}s). Consider simplifying the prompt or breaking complex tasks into smaller steps.`,
          potentialImprovement: 15,
          priority: analysis.avgDuration > 60000 ? "high" : "low",
        });
      }

      if (analysis.avgCost > 0.1) {
        suggestions.push({
          promptType: type as PromptType,
          currentScore: Math.max(0, 100 - analysis.avgCost * 100),
          suggestion: `High token usage detected (avg $${analysis.avgCost.toFixed(4)} per call). Consider using more concise prompts or reducing context length.`,
          potentialImprovement: 10,
          priority: analysis.avgCost > 0.5 ? "high" : "low",
        });
      }
    }
  } catch (error) {
    console.error("[PromptOptimizer] Error generating suggestions:", error);
  }

  // Sort by priority and potential improvement
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.potentialImprovement - a.potentialImprovement;
  });
}

/**
 * Analyze trace patterns for a specific type
 */
function analyzeTracePatterns(traces: any[]): {
  errorRate: number;
  avgDuration: number;
  avgCost: number;
  commonIssues: string[];
} {
  let errorCount = 0;
  let totalDuration = 0;
  let totalCost = 0;
  let durationCount = 0;
  let costCount = 0;

  for (const trace of traces) {
    const metadata = trace.metadata || {};

    if (metadata.success === false || metadata.error) {
      errorCount++;
    }

    if (metadata.duration) {
      totalDuration += metadata.duration;
      durationCount++;
    }

    if (metadata.cost) {
      totalCost += metadata.cost;
      costCount++;
    }
  }

  return {
    errorRate: traces.length > 0 ? errorCount / traces.length : 0,
    avgDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    avgCost: costCount > 0 ? totalCost / costCount : 0,
    commonIssues: [], // Could be expanded with NLP analysis of error messages
  };
}

/**
 * Run an optimization experiment for a specific prompt type
 * This is a simplified version - full optimization would use Opik's optimizer SDK
 */
export async function runOptimization(
  promptType: PromptType,
  dataset: OptimizationDataPoint[]
): Promise<OptimizationResult> {
  const originalPrompt = PROMPT_TEMPLATES[promptType];

  if (!originalPrompt) {
    return {
      success: false,
      originalPrompt: "",
      error: `Unknown prompt type: ${promptType}`,
    };
  }

  if (dataset.length < 5) {
    return {
      success: false,
      originalPrompt,
      error: "Need at least 5 data points for optimization",
    };
  }

  try {
    // In a full implementation, this would:
    // 1. Create an Opik dataset from the data points
    // 2. Run MetaPrompt or HRPO optimization
    // 3. Return the optimized prompt

    // For now, we return a placeholder indicating the feature is available
    // The actual optimization would require the Python opik-optimizer package
    // or calling Opik's REST API directly

    return {
      success: true,
      originalPrompt,
      optimizedPrompt: originalPrompt, // Would be replaced with actual optimized version
      improvement: 0,
      metrics: {
        originalScore: 75,
        optimizedScore: 75,
      },
    };
  } catch (error: any) {
    console.error("[PromptOptimizer] Optimization error:", error);
    return {
      success: false,
      originalPrompt,
      error: error.message,
    };
  }
}

/**
 * Get the current prompt template for a type
 */
export function getPromptTemplate(promptType: PromptType): string {
  return PROMPT_TEMPLATES[promptType] || PROMPT_TEMPLATES.general;
}

/**
 * Store a custom optimized prompt (for future use)
 */
export async function storeOptimizedPrompt(
  userId: string,
  promptType: PromptType,
  optimizedPrompt: string
): Promise<void> {
  // This would store the optimized prompt in the database
  // For user-specific prompt customization
  console.log(`[PromptOptimizer] Would store optimized ${promptType} prompt for user ${userId}`);
}
