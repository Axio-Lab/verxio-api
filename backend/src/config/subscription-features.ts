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
  ELEVENLABS_NODE: "elevenlabs",
  FIRECRAWL_NODE: "firecrawl",
  APIFY_NODE: "apify",

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
  ELEVENLABS: SUBSCRIPTION_FEATURES.ELEVENLABS_NODE,
  FIRECRAWL: SUBSCRIPTION_FEATURES.FIRECRAWL_NODE,
  APIFY: SUBSCRIPTION_FEATURES.APIFY_NODE,
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
      // Pro plan gets all premium nodes but not experimental
      return [
        SUBSCRIPTION_FEATURES.GENERATE_WORKFLOW_WITH_AI,
        SUBSCRIPTION_FEATURES.PLAN_NODE,
        SUBSCRIPTION_FEATURES.CODE_BLOCK_NODE,
        SUBSCRIPTION_FEATURES.REMOTION_NODE,
        SUBSCRIPTION_FEATURES.DESIGN_AGENT_PRO,
        SUBSCRIPTION_FEATURES.VEO_NODE,
        SUBSCRIPTION_FEATURES.ELEVENLABS_NODE,
        SUBSCRIPTION_FEATURES.FIRECRAWL_NODE,
        SUBSCRIPTION_FEATURES.APIFY_NODE,
        SUBSCRIPTION_FEATURES.EXPORT_WORKFLOW_AS_TEMPLATE,
      ];
    default:
      return [];
  }
}
