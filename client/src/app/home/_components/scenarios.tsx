interface SimulationScenario {
  prompt: string;
  steps: { label: string; detail: string }[];
  completion: { name: string; summary: string };
}

export const SCENARIOS: SimulationScenario[] = [
  {
    prompt:
      '"Set up a facility compliance system: toilet cleaning every 60 minutes with photo verification"',
    steps: [
      { label: "Creating task", detail: "Restroom Cleaning (every 60 min)" },
      { label: "Setting rule", detail: "Photo evidence required per cycle" },
      { label: "Adding worker", detail: "Janitorial Team via WhatsApp" },
      { label: "Configuring AI", detail: "Vision scoring against reference image" },
      { label: "Scheduling", detail: "Daily compliance report to Slack" },
    ],
    completion: {
      name: "Compliance system live",
      summary: "Recurring task, AI vetting, auto-reports",
    },
  },
  {
    prompt:
      '"Create a Q3 product launch goal with sub-agent research, design review, and GTM execution"',
    steps: [
      { label: "Creating goal", detail: "Q3 Product Launch" },
      { label: "Decomposing", detail: "3 sub-tasks identified" },
      { label: "Assigning agent", detail: "Market Research Sub-Agent" },
      { label: "Assigning agent", detail: "Design Review Sub-Agent" },
      { label: "Assigning agent", detail: "GTM Execution Sub-Agent" },
      { label: "Setting watch", detail: "Progress alerts every 24h" },
    ],
    completion: {
      name: "Goal orchestration active",
      summary: "3 sub-agents, daily progress alerts",
    },
  },
  {
    prompt:
      '"Deploy a support agent on Telegram and WhatsApp with knowledge base for our SaaS product"',
    steps: [
      { label: "Creating agent", detail: "Product Support Agent" },
      { label: "Loading KB", detail: "12 docs indexed" },
      { label: "Connecting", detail: "Telegram channel" },
      { label: "Connecting", detail: "WhatsApp channel" },
      { label: "Setting persona", detail: "Friendly, technical tone" },
    ],
    completion: { name: "Support agent live", summary: "2 channels, 12 docs, AI responses" },
  },
  {
    prompt:
      '"Set up daily sign-in/sign-out tracking for the warehouse team with late arrival alerts"',
    steps: [
      { label: "Creating task", detail: "Daily Attendance Check-in" },
      { label: "Setting rule", detail: "Sign-in by 8:00 AM, sign-out by 5:00 PM" },
      { label: "Adding workers", detail: "15 team members via Telegram" },
      { label: "Configuring AI", detail: "Timestamp + location verification" },
      { label: "Scheduling", detail: "End-of-day attendance report" },
    ],
    completion: { name: "Attendance tracker live", summary: "15 workers, alerts, daily reports" },
  },
  {
    prompt:
      '"Build a workflow that monitors GitHub PRs, runs code review, and posts results to Slack"',
    steps: [
      { label: "Creating workflow", detail: "PR Review Pipeline" },
      { label: "Adding trigger", detail: "GitHub Pull Request Event" },
      { label: "Adding node", detail: "AI Code Review (Claude)" },
      { label: "Adding node", detail: "Post Summary to Slack" },
      { label: "Connecting", detail: "GitHub + Slack via Composio" },
    ],
    completion: {
      name: "Review pipeline active",
      summary: "GitHub trigger, AI review, Slack output",
    },
  },
  {
    prompt:
      '"Set up a content operations goal: weekly blog posts with SEO, social distribution, and analytics"',
    steps: [
      { label: "Creating goal", detail: "Content Operations Pipeline" },
      { label: "Decomposing", detail: "Research, Draft, SEO, Distribute" },
      { label: "Assigning agent", detail: "Content Writer Sub-Agent" },
      { label: "Assigning agent", detail: "SEO Optimizer Sub-Agent" },
      { label: "Connecting", detail: "Google Docs + Notion via Composio" },
      { label: "Scheduling", detail: "Weekly progress report to Gmail" },
    ],
    completion: { name: "Content ops running", summary: "4 phases, 2 agents, weekly reports" },
  },
  {
    prompt:
      '"Create a safety inspection system: equipment checks every shift with document uploads"',
    steps: [
      { label: "Creating task", detail: "Equipment Safety Inspection" },
      { label: "Setting rule", detail: "Checklist + photo per equipment unit" },
      { label: "Evidence type", detail: "Document (inspection form PDF)" },
      { label: "Adding reference", detail: "Sample inspection report uploaded" },
      { label: "Adding workers", detail: "Safety team via Discord" },
      { label: "Configuring AI", detail: "Compare submissions to reference" },
    ],
    completion: {
      name: "Safety system active",
      summary: "Document vetting, reference comparison, Discord alerts",
    },
  },
  {
    prompt: '"Launch a loyalty program for my e-commerce store with Bronze, Silver, Gold tiers"',
    steps: [
      { label: "Creating program", detail: "Store Rewards — 3 tiers" },
      { label: "Setting tier", detail: "Bronze: 0–999 pts" },
      { label: "Setting tier", detail: "Silver: 1,000–2,999 pts" },
      { label: "Setting tier", detail: "Gold: 3,000+ pts" },
      { label: "Generating", detail: "500 bulk invite links" },
      { label: "Configuring AI", detail: "Auto-gift 50 pts per purchase" },
    ],
    completion: {
      name: "Loyalty program live",
      summary: "3 tiers, digital passes, AI-automated gifting",
    },
  },
];
