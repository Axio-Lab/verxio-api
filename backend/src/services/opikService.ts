/**
 * Opik Service
 *
 * Integration with Opik for LLM observability, tracing, and evaluation.
 * Provides tracing for all Claude Agent interactions and analytics aggregation.
 *
 * NOTE: Opik integration is optional. If OPIK_API_KEY is not set,
 * tracing functions will be no-ops and analytics will return empty data.
 */

import { Opik } from "opik";

// ============================================
// Opik Client Initialization
// ============================================

const OPIK_ENABLED = !!process.env.OPIK_API_KEY;

// Only initialize Opik if API key is provided
let opik: InstanceType<typeof Opik> | null = null;

if (OPIK_ENABLED) {
  try {
    opik = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      projectName: process.env.OPIK_PROJECT || "verxio-agent",
    });
    console.log("[OpikService] Opik tracing enabled");
  } catch (error) {
    console.warn("[OpikService] Failed to initialize Opik:", error);
  }
} else {
  console.log("[OpikService] Opik tracing disabled (no OPIK_API_KEY)");
}

// ============================================
// Types
// ============================================

export interface TraceMetadata {
  userId: string;
  workflowId?: string;
  traceType:
    | "agent_query"
    | "chat"
    | "code_generation"
    | "workflow_generation"
    | "smart_prompt"
    | "template_metadata";
  model?: string;
  [key: string]: any;
}

export interface SpanOptions {
  name: string;
  input: any;
  output?: any;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  cost?: number;
  metadata?: Record<string, any>;
}

export interface TraceContext {
  trace: any;
  startTime: number;
  metadata: TraceMetadata;
}

// ============================================
// Tracing Functions
// ============================================

/**
 * Create a new trace for an agent interaction
 * Returns a no-op context if Opik is not enabled
 * @param input - Optional trace input (e.g. prompt, model) so Opik captures what was sent to the agent
 */
export function createTrace(
  name: string,
  metadata: TraceMetadata,
  input?: Record<string, unknown>
): TraceContext {
  if (!opik) {
    // Return a no-op trace context
    return {
      trace: null,
      startTime: Date.now(),
      metadata,
    };
  }

  try {
    const trace = opik.trace({
      name,
      input: input ?? undefined,
      metadata: {
        ...metadata,
        startedAt: new Date().toISOString(),
      },
    });

    return {
      trace,
      startTime: Date.now(),
      metadata,
    };
  } catch (error) {
    console.error("[OpikService] Error creating trace:", error);
    return {
      trace: null,
      startTime: Date.now(),
      metadata,
    };
  }
}

/**
 * Log a span within a trace
 */
export async function logSpan(context: TraceContext, options: SpanOptions): Promise<void> {
  // Skip if trace is null (Opik disabled)
  if (!context.trace) return;

  try {
    const span = context.trace.span({
      name: options.name,
      input: options.input,
      output: options.output,
      metadata: {
        model: options.model,
        usage: options.usage,
        cost: options.cost,
        duration: Date.now() - context.startTime,
        ...options.metadata,
      },
    });

    // End the span
    await span.end();
  } catch (error) {
    console.error("[OpikService] Error logging span:", error);
  }
}

/**
 * Build a serializable output object for Opik (so input/output are always captured).
 * Uses the canonical shape from Opik docs: { response: "..." } so the trace dashboard displays output.
 * Handles Claude Agent SDK result message shape: { result, usage, total_cost_usd, subtype }.
 */
function buildTraceOutput(result: {
  success: boolean;
  output?: any;
  error?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  cost?: number;
}): Record<string, unknown> {
  let responseText: string | undefined;
  const rest: Record<string, unknown> = {
    success: result.success,
    ...(result.error && { error: result.error }),
    ...(result.usage && { usage: result.usage }),
    ...(result.cost != null && { cost: result.cost }),
  };
  if (result.output != null && typeof result.output === "object") {
    const o = result.output as Record<string, unknown>;
    if (typeof o.result === "string" && o.result.length > 0) responseText = o.result;
    if (!responseText && Array.isArray(o.content)) {
      const textParts = (o.content as any[])
        .filter((c: any) => c?.type === "text" && c.text != null)
        .map((c: any) => c.text);
      if (textParts.length) responseText = textParts.join("\n");
    }
    if (o.usage) rest.usage = o.usage;
    if (o.total_cost_usd != null) rest.cost = o.total_cost_usd;
    if (o.num_turns != null) rest.numTurns = o.num_turns;
  } else if (result.output != null) {
    rest.output = result.output;
  }
  // Opik README uses output: { response: "..." } — include it so the dashboard shows output
  return {
    response: responseText ?? (result.error ? `Error: ${result.error}` : ""),
    ...rest,
  };
}

/**
 * End a trace and record final metrics.
 * When agentInput is provided, logs a single span with both agent input and output in one go
 * (so Opik captures input + output on the span; the dashboard shows spans with I/O).
 */
export async function endTrace(
  context: TraceContext,
  result: {
    success: boolean;
    output?: any;
    error?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
    cost?: number;
  },
  /** Agent input (prompt, model, etc.) — when provided, we log a span with input + output in one go */
  agentInput?: Record<string, unknown>
): Promise<void> {
  // Skip if trace is null (Opik disabled)
  if (!context.trace) return;

  try {
    const duration = Date.now() - context.startTime;
    const output = buildTraceOutput(result);

    // Log one span after execution with both input and output so Opik captures them in one go
    if (agentInput != null) {
      await logSpan(context, {
        name: context.metadata.traceType ?? "agent_execution",
        input: agentInput,
        output,
        model: context.metadata.model,
        usage: result.usage,
        cost: result.cost,
        metadata: {
          success: result.success,
          error: result.error,
          duration,
        },
      });
    }

    // Update trace with final output and metrics
    const endTime = new Date();
    context.trace.update({
      output,
      endTime,
      metadata: {
        ...context.metadata,
        success: result.success,
        error: result.error,
        duration,
        usage: result.usage,
        cost: result.cost,
        endedAt: endTime.toISOString(),
      },
    });

    // End the trace (marks trace ended locally; batch queue will send create + update)
    context.trace.end();

    // Flush so the update (including output) is sent to Opik immediately
    if (opik) await opik.flush();
  } catch (error) {
    console.error("[OpikService] Error ending trace:", error);
  }
}

// ============================================
// Evaluation Functions
// ============================================

/**
 * Log feedback/evaluation score for a trace
 */
export async function logFeedback(
  traceId: string,
  scores: Record<string, number>,
  comment?: string
): Promise<void> {
  // Skip if Opik is not enabled
  if (!opik) return;

  try {
    // Add feedback scores to the trace
    for (const [name, value] of Object.entries(scores)) {
      await opik.api.traces.addTraceFeedbackScore(traceId, {
        name,
        value,
        reason: comment,
        source: "sdk",
      });
    }
  } catch (error) {
    console.error("[OpikService] Error logging feedback:", error);
  }
}

// ============================================
// Analytics & Metrics Functions
// ============================================

/**
 * Get traces for a specific user
 */
export async function getUserTraces(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    traceType?: string;
  }
): Promise<any[]> {
  // Return empty if Opik is not enabled
  if (!opik) return [];

  try {
    const projectName = process.env.OPIK_PROJECT || "verxio-agent";
    const response = await opik.api.traces.getTracesByProject({
      projectName,
      filters: `metadata.userId = "${userId}"`,
      size: options?.limit || 100,
      page: options?.offset ? Math.floor(options.offset / (options.limit || 100)) + 1 : 1,
    });

    // Extract traces from response
    return response?.content || [];
  } catch (error) {
    console.error("[OpikService] Error fetching user traces:", error);
    return [];
  }
}

/**
 * Get aggregated metrics for a user
 */
export async function getUserMetrics(userId: string): Promise<{
  totalTraces: number;
  totalCost: number;
  avgDuration: number;
  tracesByType: Record<string, number>;
  successRate: number;
}> {
  try {
    const traces = await getUserTraces(userId, { limit: 1000 });

    if (!traces.length) {
      return {
        totalTraces: 0,
        totalCost: 0,
        avgDuration: 0,
        tracesByType: {},
        successRate: 0,
      };
    }

    let totalCost = 0;
    let totalDuration = 0;
    let successCount = 0;
    const tracesByType: Record<string, number> = {};

    for (const trace of traces) {
      const metadata = trace.metadata || {};

      // Sum costs
      if (metadata.cost) {
        totalCost += metadata.cost;
      }

      // Sum durations
      if (metadata.duration) {
        totalDuration += metadata.duration;
      }

      // Count successes
      if (metadata.success) {
        successCount++;
      }

      // Group by type
      const traceType = metadata.traceType || "unknown";
      tracesByType[traceType] = (tracesByType[traceType] || 0) + 1;
    }

    return {
      totalTraces: traces.length,
      totalCost,
      avgDuration: totalDuration / traces.length,
      tracesByType,
      successRate: (successCount / traces.length) * 100,
    };
  } catch (error) {
    console.error("[OpikService] Error calculating user metrics:", error);
    return {
      totalTraces: 0,
      totalCost: 0,
      avgDuration: 0,
      tracesByType: {},
      successRate: 0,
    };
  }
}

/**
 * Get cost breakdown by period
 */
export async function getCostByPeriod(
  userId: string,
  period: "daily" | "weekly" | "monthly" = "daily"
): Promise<Array<{ date: string; cost: number; calls: number }>> {
  try {
    const traces = await getUserTraces(userId, { limit: 1000 });

    const costByDate: Record<string, { cost: number; calls: number }> = {};

    for (const trace of traces) {
      const metadata = trace.metadata || {};
      const startedAt = metadata.startedAt ? new Date(metadata.startedAt) : new Date();

      let dateKey: string;
      if (period === "daily") {
        dateKey = startedAt.toISOString().split("T")[0];
      } else if (period === "weekly") {
        const weekStart = new Date(startedAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        dateKey = weekStart.toISOString().split("T")[0];
      } else {
        dateKey = `${startedAt.getFullYear()}-${String(startedAt.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!costByDate[dateKey]) {
        costByDate[dateKey] = { cost: 0, calls: 0 };
      }

      costByDate[dateKey].cost += metadata.cost || 0;
      costByDate[dateKey].calls += 1;
    }

    return Object.entries(costByDate)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("[OpikService] Error calculating cost by period:", error);
    return [];
  }
}

// ============================================
// Helper to wrap agent functions with tracing
// ============================================

/**
 * Wrapper to automatically trace agent function calls
 */
export function withTracing<T extends (...args: any[]) => AsyncGenerator<any, any, any>>(
  fn: T,
  traceType: TraceMetadata["traceType"]
): T {
  return async function* (...args: Parameters<T>) {
    const options = args[0] as { userId: string; workflowId?: string; model?: string; [key: string]: unknown };

    const context = createTrace(
      `${traceType}_call`,
      {
        userId: options.userId,
        workflowId: options.workflowId,
        traceType,
        model: options.model,
      },
      { ...options }
    );

    let lastResult: any = null;
    let hasError = false;
    let errorMessage: string | undefined;

    try {
      for await (const event of fn(...args)) {
        if (event.type === "result") {
          lastResult = event.data;
        }
        if (event.type === "error") {
          hasError = true;
          errorMessage = event.data?.message;
        }
        yield event;
      }
    } catch (error: any) {
      hasError = true;
      errorMessage = error.message;
      throw error;
    } finally {
      await endTrace(context, {
        success: !hasError,
        output: lastResult,
        error: errorMessage,
        usage: lastResult?.usage,
        cost: lastResult?.cost,
      });
    }
  } as T;
}

// Export the opik client and enabled flag for direct access if needed
export { opik, OPIK_ENABLED };
