/**
 * Subscription Features Configuration
 *
 * Defines all premium features that require subscription access.
 * Used for access control and feature gating.
 */

export const SUBSCRIPTION_FEATURES = {
  // AI-Powered Features
  GENERATE_WORKFLOW_WITH_AI: "generate-workflow-with-ai",
  PLAN_NODE: "plan-node",

  // Premium Nodes
  CODE_BLOCK_NODE: "code-block-node",
  REMOTION_NODE: "remotion",
  DESIGN_AGENT_PRO: "design-agent-pro",
  VEO_NODE: "veo",
  SEEDANCE_NODE: "seedance",
  SEEDREAM_NODE: "seedream",
  TIMED_TRIGGER_NODE: "timed-trigger-node",
  KLING_NODES: "kling-nodes",

  // External integrations (premium nodes)
  COMPOSIO_ACTION_NODE: "composio-action-node",
  TINYFISH_NODE: "tinyfish-node",
  STRAPI_NODE: "strapi-node",
  CUSTOM_DOMAIN: "custom-domain",

  // Chat integrations (agent replies when users message the connected number)
  TELEGRAM_CHAT_INTEGRATION: "telegram-chat-integration",
  WHATSAPP_CHAT_INTEGRATION: "whatsapp-chat-integration",
  SLACK_CHAT_INTEGRATION: "slack-chat-integration",
  DISCORD_CHAT_INTEGRATION: "discord-chat-integration",

  // Template feature (premium)
  EXPORT_WORKFLOW_AS_TEMPLATE: "export-workflow-as-template",

  // Experimental Features (for beta testers)
  EXPERIMENTAL_FEATURES: "experimental-features",
  EARLY_ACCESS_UPDATES: "early-access-updates",
} as const;

export type SubscriptionFeature =
  (typeof SUBSCRIPTION_FEATURES)[keyof typeof SUBSCRIPTION_FEATURES];

/**
 * Map node types to their required subscription features
 */
export const NODE_TYPE_TO_FEATURE: Record<string, SubscriptionFeature> = {
  CODE_BLOCK: SUBSCRIPTION_FEATURES.CODE_BLOCK_NODE,
  REMOTION: SUBSCRIPTION_FEATURES.REMOTION_NODE,
  DESIGN_PRO: SUBSCRIPTION_FEATURES.DESIGN_AGENT_PRO,
  VEO: SUBSCRIPTION_FEATURES.VEO_NODE,
  SEEDANCE: SUBSCRIPTION_FEATURES.SEEDANCE_NODE,
  SEEDREAM: SUBSCRIPTION_FEATURES.SEEDREAM_NODE,
  TIMED_TRIGGER: SUBSCRIPTION_FEATURES.TIMED_TRIGGER_NODE,
  // All Kling nodes share one premium feature flag
  KLING_TEXT2VIDEO: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_IMAGE2VIDEO: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_IMAGE: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_TTS: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_OMNI_VIDEO: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_OMNI_IMAGE: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_VIDEO_EXTEND: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_MULTI_IMAGE2VIDEO: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_MOTION_CONTROL: SUBSCRIPTION_FEATURES.KLING_NODES,
  KLING_MULTI_IMAGE2IMAGE: SUBSCRIPTION_FEATURES.KLING_NODES,
  COMPOSIO_ACTION: SUBSCRIPTION_FEATURES.COMPOSIO_ACTION_NODE,
  TINYFISH: SUBSCRIPTION_FEATURES.TINYFISH_NODE,
  STRAPI: SUBSCRIPTION_FEATURES.STRAPI_NODE,
  CUSTOM_DOMAIN: SUBSCRIPTION_FEATURES.CUSTOM_DOMAIN,
};

/**
 * Check if a user has access to a specific feature
 */
export function hasFeatureAccess(
  userFeatures: string[] | null | undefined,
  requiredFeature: SubscriptionFeature
): boolean {
  if (!userFeatures || !Array.isArray(userFeatures)) {
    return false;
  }
  return userFeatures.includes(requiredFeature);
}

/**
 * Get all features for a subscription plan
 */
export function getPlanFeatures(planType: string | null | undefined): SubscriptionFeature[] {
  if (!planType) {
    return [];
  }

  switch (planType) {
    case "beta-tester":
      // Beta testers get all features including experimental
      return Object.values(SUBSCRIPTION_FEATURES);
    case "pro":
      return [
        SUBSCRIPTION_FEATURES.GENERATE_WORKFLOW_WITH_AI,
        SUBSCRIPTION_FEATURES.PLAN_NODE,
        SUBSCRIPTION_FEATURES.CODE_BLOCK_NODE,
        SUBSCRIPTION_FEATURES.REMOTION_NODE,
        SUBSCRIPTION_FEATURES.DESIGN_AGENT_PRO,
        SUBSCRIPTION_FEATURES.VEO_NODE,
        SUBSCRIPTION_FEATURES.SEEDANCE_NODE,
        SUBSCRIPTION_FEATURES.SEEDREAM_NODE,
        SUBSCRIPTION_FEATURES.TIMED_TRIGGER_NODE,
        SUBSCRIPTION_FEATURES.KLING_NODES,
        SUBSCRIPTION_FEATURES.COMPOSIO_ACTION_NODE,
        SUBSCRIPTION_FEATURES.TINYFISH_NODE,
        SUBSCRIPTION_FEATURES.STRAPI_NODE,
        SUBSCRIPTION_FEATURES.TELEGRAM_CHAT_INTEGRATION,
        SUBSCRIPTION_FEATURES.WHATSAPP_CHAT_INTEGRATION,
        SUBSCRIPTION_FEATURES.SLACK_CHAT_INTEGRATION,
        SUBSCRIPTION_FEATURES.DISCORD_CHAT_INTEGRATION,
        SUBSCRIPTION_FEATURES.EXPORT_WORKFLOW_AS_TEMPLATE,
      ];
    case "business":
      return [
        ...getPlanFeatures("pro"),
        SUBSCRIPTION_FEATURES.CUSTOM_DOMAIN,
      ];
    default:
      return [];
  }
}

/**
 * Map Polar product ID to plan name (for webhooks)
 * Set POLAR_BETA_TESTER_PRODUCT_ID, POLAR_PRO_PRODUCT_ID in env.
 */
export function getPlanFromProductId(productId: string | null | undefined): string {
  if (!productId) return "beta-tester";
  if (productId === process.env.POLAR_BETA_TESTER_PRODUCT_ID) return "beta-tester";
  if (productId === process.env.POLAR_PRO_PRODUCT_ID) return "pro";
  return "beta-tester";
}
