/**
 * Rate Limits Configuration
 *
 * Defines rate limits for different subscription plans.
 * Used for promotional plans and usage-based billing.
 */

export interface RateLimitConfig {
  requestsPerPeriod: number;
  period: "hour" | "day" | "month";
  resetStrategy: "fixed" | "rolling";
}

/**
 * Daily credit quota for beta-testers
 * Resets daily at 12am (midnight)
 */
export const BETA_TESTER_DAILY_CREDITS = 200;

/**
 * Quota cost per premium action/feature
 * These values represent credits consumed per use
 */
export const QUOTA_COST = {
  VEO: 15,
  PLAN_NODE: 10,
  GENERATE_WORKFLOW_WITH_AI: 10,
  REMOTION: 15,
  DESIGN_AGENT_PRO: 10,
  // TIMED_TRIGGER: 5,
  DEFAULT_PREMIUM_NODE: 5, // Code Block, ElevenLabs, Firecrawl, Apify
} as const;

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "beta-tester": {
    requestsPerPeriod: BETA_TESTER_DAILY_CREDITS, // Credits per day
    period: "day",
    resetStrategy: "fixed", // Resets at midnight (12am)
  },
  pro: {
    requestsPerPeriod: 1000, // 1000 requests per day
    period: "day",
    resetStrategy: "fixed",
  },
  // Free tier (no subscription)
  free: {
    requestsPerPeriod: 10, // 10 requests per day
    period: "day",
    resetStrategy: "fixed",
  },
};

/**
 * Get rate limit configuration for a plan type
 */
export function getRateLimitConfig(planType: string | null | undefined): RateLimitConfig {
  if (!planType) {
    return RATE_LIMITS.free;
  }
  return RATE_LIMITS[planType] || RATE_LIMITS.free;
}

/**
 * Calculate when the rate limit should reset
 */
export function calculateResetTime(config: RateLimitConfig, lastResetAt: Date | null): Date {
  const now = new Date();

  if (config.resetStrategy === "fixed") {
    // Reset at start of period (midnight for day, start of hour for hour)
    const reset = new Date(now);

    if (config.period === "day") {
      reset.setHours(0, 0, 0, 0);
      reset.setDate(reset.getDate() + 1); // Next midnight
    } else if (config.period === "hour") {
      reset.setMinutes(0, 0, 0);
      reset.setHours(reset.getHours() + 1); // Next hour
    } else if (config.period === "month") {
      reset.setDate(1);
      reset.setMonth(reset.getMonth() + 1); // First day of next month
    }

    return reset;
  } else {
    // Rolling window: reset based on last reset time
    if (!lastResetAt) {
      return calculateResetTime({ ...config, resetStrategy: "fixed" }, null);
    }

    const reset = new Date(lastResetAt);

    if (config.period === "day") {
      reset.setDate(reset.getDate() + 1);
    } else if (config.period === "hour") {
      reset.setHours(reset.getHours() + 1);
    } else if (config.period === "month") {
      reset.setMonth(reset.getMonth() + 1);
    }

    return reset;
  }
}
