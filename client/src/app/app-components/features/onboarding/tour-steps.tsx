export type TourStepDef = {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: "welcome",
    title: "Welcome to Verxio",
    description:
      "This tour will give you a quick introduction to the platform in 8 simple steps.",
    targetSelector: null,
  },
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
    description:
      "Import pre-built workflows from our template library to get started quickly.",
    targetSelector: "[data-tour-target='menu-templates']",
  },
  {
    id: "workflows",
    title: "Create Workflows",
    description:
      "Create and manage your workflows here. Use New Workflow to start from scratch.",
    targetSelector: "[data-tour-target='menu-workflows']",
  },
  {
    id: "add-nodes",
    title: "Add Nodes",
    description:
      "Add nodes to your workflow using the Add Node button. Connect them to build your automation.",
    targetSelector: "[data-tour-target='add-node-button']",
  },
  {
    id: "save-execute",
    title: "Save and Execute",
    description:
      "Save your workflow to persist changes, then run it with the Execute button.",
    targetSelector: "[data-tour-target='save-button']",
  },
  {
    id: "ai-generation",
    title: "AI Generation",
    description:
      "Generate or edit workflows with AI. Use Plan mode and Generate with AI to build workflows from prompts.",
    targetSelector: "[data-tour-target='ai-generate-button']",
  },
  {
    id: "credentials",
    title: "Credentials",
    description:
      "Store API keys and secrets securely. Add credentials here so nodes can access external services.",
    targetSelector: "[data-tour-target='menu-credentials']",
  },
];
