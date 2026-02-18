export type TourStepDef = {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
};

export type TourId =
  | "sidebar"
  | "workflow"
  | "templates"
  | "credentials"
  | "integrations"
  | "skills";

const SIDEBAR_STEP_WELCOME: TourStepDef = {
  id: "welcome",
  title: "Welcome to Verxio",
  description:
    "Let's take a quick tour of the app. We'll show you workflows, templates, credentials, integrations, skills, and upgrade.",
  targetSelector: null,
};

const SIDEBAR_STEPS_BASE: TourStepDef[] = [
  {
    id: "upgrade",
    title: "Upgrade to Premium",
    description:
      "Upgrading to premium gives you access to more nodes, higher limits, and priority support.",
    targetSelector: "[data-tour-target='upgrade-button']",
  },
  {
    id: "templates",
    title: "Browse Templates",
    description: "Import pre-built workflows from our template library to get started quickly.",
    targetSelector: "[data-tour-target='menu-templates']",
  },
  {
    id: "credentials",
    title: "Credentials",
    description:
      "Store API keys and secrets securely. Go to Credentials to add and manage them for your nodes.",
    targetSelector: "[data-tour-target='menu-credentials']",
  },
  {
    id: "integrations",
    title: "Integrations",
    description:
      "Connect chat channels like Slack and Discord so Verxio can send and receive messages.",
    targetSelector: "[data-tour-target='menu-integrations']",
  },
  {
    id: "skills",
    title: "Skills",
    description: "Add reusable skills to extend what your agent can do in workflows and chat.",
    targetSelector: "[data-tour-target='menu-skills']",
  },
  {
    id: "workflows",
    title: "Create Workflows",
    description: "Create and manage your workflows here. Use New Workflow to start from scratch.",
    targetSelector: "[data-tour-target='menu-workflows']",
  },
];

const SIDEBAR_STEP_MENU: TourStepDef = {
  id: "menu",
  title: "Open the menu",
  description:
    "Tap the menu icon to open the sidebar and see Workflows, Templates, Credentials, and Upgrade.",
  targetSelector: "[data-tour-target='sidebar-trigger']",
};

export const WORKFLOW_TOUR_STEPS: TourStepDef[] = [
  {
    id: "add-nodes",
    title: "Add Nodes",
    description:
      "Add nodes to your workflow using the plus icon beside the Generate with AI button or at the center of the canvas. Connect them to build your automation.",
    targetSelector: "[data-tour-target='add-node-button']",
  },
  {
    id: "save",
    title: "Save your workflow",
    description: "Save your workflow to persist changes.",
    targetSelector: "[data-tour-target='save-button']",
  },
  {
    id: "execute",
    title: "Execute",
    description: "Run your workflow with the Execute button.",
    targetSelector: "[data-tour-target='execute-button']",
  },
  {
    id: "ai-generation",
    title: "AI Generation",
    description: "Generate or edit workflows with AI using Generate with AI or Edit with AI.",
    targetSelector: "[data-tour-target='ai-generate-button']",
  },
];

export const TEMPLATES_TOUR_STEPS: TourStepDef[] = [
  {
    id: "import-template",
    title: "Import a template",
    description:
      "Browse templates below. Click a template to open it, then click Import workflow to add it to your workflows.",
    targetSelector: "[data-tour-target='templates-list']",
  },
];

export const CREDENTIALS_TOUR_STEPS: TourStepDef[] = [
  {
    id: "new-credential",
    title: "Add a credential",
    description:
      "Store API keys and secrets securely. Click New Credential to add one so nodes can access external services.",
    targetSelector: "[data-tour-target='new-credential-button']",
  },
];

export const INTEGRATIONS_TOUR_STEPS: TourStepDef[] = [
  {
    id: "integrations-overview",
    title: "Integrations overview",
    description: "This page is where you manage Slack and Discord chat integrations.",
    targetSelector: "[data-tour-target='integrations-page']",
  },
  {
    id: "new-integration",
    title: "Create integration",
    description: "Click New Integration to connect a new platform.",
    targetSelector: "[data-tour-target='new-integration-button']",
  },
  {
    id: "integrations-search",
    title: "Search integrations",
    description: "Use search to quickly find an integration by name, platform, or scope.",
    targetSelector: "[data-tour-target='integrations-search']",
  },
  {
    id: "integrations-list",
    title: "Manage integrations",
    description: "Open an integration card to configure settings, tokens, and behavior.",
    targetSelector: "[data-tour-target='integrations-list']",
  },
];

export const SKILLS_TOUR_STEPS: TourStepDef[] = [
  {
    id: "skills-overview",
    title: "Skills overview",
    description: "This page lets you add and maintain reusable AI skills.",
    targetSelector: "[data-tour-target='skills-page']",
  },
  {
    id: "new-skill",
    title: "Create skill",
    description: "Click New Skill to add a custom skill for your assistant.",
    targetSelector: "[data-tour-target='new-skill-button']",
  },
  {
    id: "skills-search",
    title: "Search skills",
    description: "Filter your skills by name, description, or URL.",
    targetSelector: "[data-tour-target='skills-search']",
  },
  {
    id: "skills-list",
    title: "Manage skills",
    description: "Open any skill card to edit, review, or remove it.",
    targetSelector: "[data-tour-target='skills-list']",
  },
];

const STORAGE_KEYS: Record<TourId, string> = {
  sidebar: "verxio-tour-sidebar-completed",
  workflow: "verxio-tour-workflow-completed",
  templates: "verxio-tour-templates-completed",
  credentials: "verxio-tour-credentials-completed",
  integrations: "verxio-tour-integrations-completed",
  skills: "verxio-tour-skills-completed",
};

export function getStorageKey(tourId: TourId): string {
  return STORAGE_KEYS[tourId];
}

export function getStepsForTour(
  tourId: TourId,
  options?: { isSidebarCollapsed: boolean }
): TourStepDef[] {
  switch (tourId) {
    case "sidebar": {
      const prependMenu = options?.isSidebarCollapsed ?? false;
      const base = prependMenu ? [SIDEBAR_STEP_MENU, ...SIDEBAR_STEPS_BASE] : SIDEBAR_STEPS_BASE;
      return [SIDEBAR_STEP_WELCOME, ...base];
    }
    case "workflow":
      return WORKFLOW_TOUR_STEPS;
    case "templates":
      return TEMPLATES_TOUR_STEPS;
    case "credentials":
      return CREDENTIALS_TOUR_STEPS;
    case "integrations":
      return INTEGRATIONS_TOUR_STEPS;
    case "skills":
      return SKILLS_TOUR_STEPS;
    default:
      return [];
  }
}
