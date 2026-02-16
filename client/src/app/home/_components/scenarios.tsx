interface SimulationScenario {
  prompt: string;
  steps: { label: string; detail: string }[];
  completion: { name: string; summary: string };
}

export const SCENARIOS: SimulationScenario[] = [
  {
    prompt:
      '"Build me a marketing bot that handles social scheduling, email sequences, and analytics"',
    steps: [
      { label: "Creating agent", detail: "Marketing Bot" },
      { label: "Adding skill", detail: "Social Media Scheduling" },
      { label: "Adding skill", detail: "Email Sequence Builder" },
      { label: "Adding skill", detail: "Analytics & Reporting" },
      { label: "Connecting", detail: "Discord" },
      { label: "Building workflow", detail: "12 nodes connected" },
    ],
    completion: { name: "Marketing Bot is live", summary: "3 skills, Discord, 12 nodes" },
  },
  {
    prompt: '"Set up a customer support agent that handles tickets, FAQs, and escalations"',
    steps: [
      { label: "Creating agent", detail: "Support Agent" },
      { label: "Adding skill", detail: "Ticket Triage & Routing" },
      { label: "Adding skill", detail: "FAQ Knowledge Base" },
      { label: "Adding skill", detail: "Escalation Workflow" },
      { label: "Connecting", detail: "Slack" },
      { label: "Building workflow", detail: "9 nodes connected" },
    ],
    completion: { name: "Support Agent is live", summary: "3 skills, Slack, 9 nodes" },
  },
  {
    prompt: '"Create a DevOps bot that monitors deploys, runs health checks, and alerts the team"',
    steps: [
      { label: "Creating agent", detail: "DevOps Bot" },
      { label: "Adding skill", detail: "Deploy Monitor" },
      { label: "Adding skill", detail: "Health Check Runner" },
      { label: "Adding skill", detail: "Incident Alerting" },
      { label: "Connecting", detail: "Telegram" },
      { label: "Building workflow", detail: "15 nodes connected" },
    ],
    completion: { name: "DevOps Bot is live", summary: "3 skills, Telegram, 15 nodes" },
  },
  {
    prompt: '"Build a sales assistant that qualifies leads, schedules demos, and updates the CRM"',
    steps: [
      { label: "Creating agent", detail: "Sales Assistant" },
      { label: "Adding skill", detail: "Lead Qualification" },
      { label: "Adding skill", detail: "Demo Scheduler" },
      { label: "Adding skill", detail: "CRM Sync" },
      { label: "Connecting", detail: "WhatsApp" },
      { label: "Building workflow", detail: "11 nodes connected" },
    ],
    completion: { name: "Sales Assistant is live", summary: "3 skills, WhatsApp, 11 nodes" },
  },
  {
    prompt: '"Spin up a content bot that generates blog drafts, social posts, and newsletters"',
    steps: [
      { label: "Creating agent", detail: "Content Bot" },
      { label: "Adding skill", detail: "Blog Draft Generator" },
      { label: "Adding skill", detail: "Social Post Writer" },
      { label: "Adding skill", detail: "Newsletter Builder" },
      { label: "Connecting", detail: "Slack" },
      { label: "Building workflow", detail: "8 nodes connected" },
    ],
    completion: { name: "Content Bot is live", summary: "3 skills, Slack, 8 nodes" },
  },
];
