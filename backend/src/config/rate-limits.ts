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
export const BETA_TESTER_DAILY_CREDITS = 500;

/**
 * Quota cost per premium action/feature.
 * Video generation entries (VEO, SEEDANCE, KLING_* video nodes) are **credits per second**
 * of video (requested duration, or output duration when only the API provides it).
 * Multiply by billable seconds at runtime — e.g. KLING_OMNI_VIDEO: 20 and 15s ⇒ 300 credits.
 * REMOTION stays a flat credit cost per render (composition length is not fixed upfront).
 */
export const QUOTA_COST = {
  VEO: 15,
  SEEDANCE: 15,
  SEEDREAM: 10,
  PLAN_NODE: 10,
  GENERATE_WORKFLOW_WITH_AI: 10,
  REMOTION: 15,
  DESIGN_AGENT_PRO: 10,
  // TIMED_TRIGGER: 5,
  DEFAULT_PREMIUM_NODE: 10, // Code Block
  COMPOSIO_ACTION: 10,
  COMPOSIO_CHAT: 10,
  AI_GENERATE: 5,
  // Kling node costs
  KLING_IMAGE: 10,
  KLING_TEXT2VIDEO: 20,
  KLING_IMAGE2VIDEO: 20,
  KLING_MULTI_IMAGE2VIDEO: 25,
  KLING_OMNI_IMAGE: 15,
  KLING_OMNI_VIDEO: 35,
  KLING_TTS: 10,
  KLING_VIDEO_EXTEND: 200,
  KLING_MULTI_IMAGE2IMAGE: 10,
  KLING_MOTION_CONTROL: 10,
  // Valyu AI nodes
  VALYU_SEARCH: 10,
  VALYU_CONTENTS: 10,
  VALYU_ANSWER: 10,
  VALYU_DEEP_RESEARCH: 20,
  // Chat integrations (per message when user chats with Verxio from Telegram/WhatsApp/Slack/Discord)
  TELEGRAM_CHAT_INTEGRATION: 10,
  WHATSAPP_CHAT_INTEGRATION: 10,
  SLACK_CHAT_INTEGRATION: 10,
  // Soul.md generation
  GENERATE_SOUL_MD: 20,
  DISCORD_CHAT_INTEGRATION: 10,
} as const;

/** Minimum 1 billable second; fractional seconds round up. */
export function billableVideoSeconds(durationSeconds: unknown, fallback = 1): number {
  const n =
    typeof durationSeconds === "number"
      ? durationSeconds
      : parseFloat(String(durationSeconds ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) {
    return Math.max(1, Math.round(fallback));
  }
  return Math.max(1, Math.ceil(n));
}

export function videoCreditsForDuration(
  creditsPerSecond: number,
  durationSeconds: unknown
): number {
  return billableVideoSeconds(durationSeconds) * creditsPerSecond;
}

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
