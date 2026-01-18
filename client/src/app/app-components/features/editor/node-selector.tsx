"use client";

import {
  GlobeIcon,
  MousePointerIcon,
  WebhookIcon,
  SearchIcon,
  ClockIcon,
  GitBranchIcon,
  Keyboard,
  Code2,
  Palette,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NodeType } from "@/app/app-components/features/editor/node-types";
import { Input } from "@/components/ui/input";
import { useReactFlow } from "@xyflow/react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { createId } from "@paralleldrive/cuid2";
import { WorkflowGenerationPanel } from "./workflow-generation-panel";
import { Sparkles } from "lucide-react";

export type NodeTypeOption = {
  type: keyof typeof NodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};

interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  workflowId?: string;
}

const triggerNodes: NodeTypeOption[] = [
  {
    type: NodeType.MANUAL_TRIGGER,
    label: "Manual Trigger",
    description: "Runs the workflow on clicking a button. Good for getting started quickly.",
    icon: MousePointerIcon,
  },
  {
    type: NodeType.TIMED_TRIGGER,
    label: "Timed Trigger",
    description:
      "Runs the workflow on a schedule (every X hours, daily, weekly, monthly, or custom cron).",
    icon: ClockIcon,
  },
  {
    type: NodeType.GOOGLE_FORM_TRIGGER,
    label: "Google Form Trigger",
    description: "Triggers the workflow when a Google Form is submitted.",
    icon: "/logo/googleform.svg",
  },
  {
    type: NodeType.AIRTABLE_TRIGGER,
    label: "Airtable Trigger",
    description: "Triggers the workflow when a record is created, updated, or deleted in Airtable.",
    icon: "/logo/airtable.svg",
  },
  {
    type: NodeType.STRIPE_TRIGGER,
    label: "Stripe Trigger",
    description:
      "Triggers the workflow when a Stripe webhook event occurs (e.g., payment_intent.succeeded).",
    icon: "/logo/stripe.svg",
  },
  {
    type: NodeType.WHATSAPP_TRIGGER,
    label: "Whatsapp Trigger",
    description: "Triggers the workflow when a Whatsapp message is sent.",
    icon: "/logo/whatsapp.svg",
  },
  {
    type: NodeType.TELEGRAM_TRIGGER,
    label: "Telegram Trigger",
    description: "Triggers the workflow when a Telegram message is received.",
    icon: "/logo/telegram.svg",
  },
  {
    type: NodeType.WEBHOOK,
    label: "Webhook Trigger",
    description: "Triggers the workflow when an HTTP request is received.",
    icon: WebhookIcon,
  },
];

const executionNodes: NodeTypeOption[] = [
  {
    type: NodeType.HTTP_REQUEST,
    label: "HTTP Request",
    description: "Make an HTTP request to a URL",
    icon: GlobeIcon,
  },
  {
    type: NodeType.OPENAI,
    label: "OpenAI",
    description: "Generate text using OpenAI's GPT models",
    icon: "/logo/openai.svg",
  },
  {
    type: NodeType.ANTHROPIC,
    label: "Anthropic Claude",
    description: "Generate text using Anthropic's Claude models",
    icon: "/logo/anthropic.svg",
  },
  {
    type: NodeType.GEMINI,
    label: "Google Gemini",
    description: "Generate text using Google's Gemini models",
    icon: "/logo/gemini.svg",
  },
  {
    type: NodeType.WHATSAPP,
    label: "Whatsapp",
    description: "Send messages to Whatsapp",
    icon: "/logo/whatsapp.svg",
  },
  {
    type: NodeType.TELEGRAM,
    label: "Telegram",
    description: "Send messages to Telegram",
    icon: "/logo/telegram.svg",
  },
  {
    type: NodeType.DISCORD,
    label: "Discord",
    description: "Send messages to Discord",
    icon: "/logo/discord.svg",
  },
  {
    type: NodeType.SLACK,
    label: "Slack",
    description: "Send messages to Slack",
    icon: "/logo/slack.svg",
  },
  {
    type: NodeType.DECIDER,
    label: "Decider",
    description: "Evaluate a condition and route to different nodes based on true/false result.",
    icon: GitBranchIcon,
  },
  {
    type: NodeType.GOOGLE_DRIVE,
    label: "Google Drive",
    description: "Upload, download, delete, and manage files in Google Drive",
    icon: "/logo/googledrive.svg",
  },
  {
    type: NodeType.GOOGLE_CALENDAR,
    label: "Google Calendar",
    description: "Create, list, update, and manage calendar events",
    icon: "/logo/googlecalendar.svg",
  },
  {
    type: NodeType.GOOGLE_SHEETS,
    label: "Google Sheets",
    description: "Read, write, and manage data in Google Sheets",
    icon: "/logo/googlesheets.svg",
  },
  {
    type: NodeType.GOOGLE_DOCS,
    label: "Google Docs",
    description: "Create, read, update, and export Google Docs",
    icon: "/logo/googledocs.svg",
  },
  {
    type: NodeType.GOOGLE_MEET,
    label: "Google Meet",
    description: "Create meetings and get meeting links",
    icon: "/logo/googlemeet.svg",
  },
  {
    type: NodeType.GOOGLE_SLIDES,
    label: "Google Slides",
    description: "Create, modify, and manage Google Slides presentations",
    icon: "/logo/googleslides.svg",
  },
  {
    type: NodeType.GMAIL,
    label: "Gmail",
    description: "Send, read, and manage emails via Gmail",
    icon: "/logo/gmail.svg",
  },
  {
    type: NodeType.AIRTABLE,
    label: "Airtable",
    description: "Read, create, update, and delete records in Airtable bases",
    icon: "/logo/airtable.svg",
  },
  {
    type: NodeType.ELEVENLABS,
    label: "ElevenLabs",
    description: "Generate speech, transcribe audio, or clone voices using AI",
    icon: "/logo/elevenlabs.svg",
  },
  {
    type: NodeType.FIRECRAWL,
    label: "Firecrawl",
    description: "Scrape, crawl, map, search, or use agent for deep research on web content",
    icon: "/logo/firecrawl.svg",
  },
  {
    type: NodeType.APIFY,
    label: "Apify",
    description:
      "Browse actors, run scrapers (TikTok, LinkedIn, Facebook, etc.), or retrieve results",
    icon: "/logo/apify.svg",
  },
  {
    type: NodeType.CODE_BLOCK,
    label: "Code Block",
    description:
      "Execute custom TypeScript, JavaScript, or Python code in an isolated sandbox. Use AI to generate code or write it manually.",
    icon: Code2,
  },
  {
    type: NodeType.PLAN,
    label: "Plan Workflow",
    description:
      "Brainstorm and ideate workflows with AI. Have conversations, upload API docs/images, and generate workflows based on your planning.",
    icon: Sparkles,
  },
  {
    type: NodeType.DESIGN,
    label: "Design Agent",
    description:
      "AI-powered design tool. Generate images, create presentations, social media posts, logos, and more with Gemini's image generation.",
    icon: Palette,
  },
  {
    type: NodeType.LOYALTY_DEAL,
    label: "Loyalty Deal",
    description:
      "Manage loyalty deals and vouchers. Get stats, create deals, lookup vouchers, add quantity, extend expiry dates.",
    icon: "/logo/verxioIcon.svg",
  },
  {
    type: NodeType.LOYALTY_PROGRAM,
    label: "Loyalty Program",
    description:
      "Manage loyalty programs. Create programs, issue passes, gift/revoke points, get member stats.",
    icon: "/logo/verxioIcon.svg",
  },
];

export const NodeSelector = ({ open, onOpenChange, children, workflowId }: NodeSelectorProps) => {
  const { setNodes, getNodes, screenToFlowPosition, setEdges } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [workflowGenOpen, setWorkflowGenOpen] = useState(false);
  const itemsPerPage = 6; // Show 5 items per page

  // Combine all nodes for unified search
  const allNodes = useMemo(
    () => [
      ...triggerNodes.map((node) => ({ ...node, category: "trigger" as const })),
      ...executionNodes.map((node) => ({ ...node, category: "action" as const })),
    ],
    []
  );

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return allNodes;
    }
    const query = searchQuery.toLowerCase();
    return allNodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) || node.description.toLowerCase().includes(query)
    );
  }, [allNodes, searchQuery]);

  // Paginate filtered nodes
  const paginatedNodes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNodes.slice(startIndex, endIndex);
  }, [filteredNodes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredNodes.length / itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset search and pagination when sheet closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setCurrentPage(1);
    }
  }, [open]);

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      const nodes = getNodes();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const flowPosition = screenToFlowPosition({
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
      });

      if (selection.type === NodeType.MANUAL_TRIGGER) {
        const hasManualTrigger = nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
        if (hasManualTrigger) {
          toast.error("Only one manual trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {},
          type: NodeType.MANUAL_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_FORM_TRIGGER) {
        const hasGoogleFormTrigger = nodes.some(
          (node) => node.type === NodeType.GOOGLE_FORM_TRIGGER
        );
        if (hasGoogleFormTrigger) {
          toast.error("Only one Google Form trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Google Form Trigger",
          },
          type: NodeType.GOOGLE_FORM_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.AIRTABLE_TRIGGER) {
        const hasAirtableTrigger = nodes.some((node) => node.type === NodeType.AIRTABLE_TRIGGER);
        if (hasAirtableTrigger) {
          toast.error("Only one Airtable trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Airtable Trigger",
          },
          type: NodeType.AIRTABLE_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.STRIPE_TRIGGER) {
        const hasStripeTrigger = nodes.some((node) => node.type === NodeType.STRIPE_TRIGGER);
        if (hasStripeTrigger) {
          toast.error("Only one Stripe trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Stripe Trigger",
          },
          type: NodeType.STRIPE_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.WHATSAPP_TRIGGER) {
        const hasWhatsAppTrigger = nodes.some((node) => node.type === NodeType.WHATSAPP_TRIGGER);
        if (hasWhatsAppTrigger) {
          toast.error("Only one WhatsApp trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "WhatsApp Trigger",
          },
          type: NodeType.WHATSAPP_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.TELEGRAM_TRIGGER) {
        const hasTelegramTrigger = nodes.some((node) => node.type === NodeType.TELEGRAM_TRIGGER);
        if (hasTelegramTrigger) {
          toast.error("Only one Telegram trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Telegram Trigger",
          },
          type: NodeType.TELEGRAM_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.MANUAL_INPUT) {
        const newNode = {
          id: createId(),
          data: {
            label: "Manual Input",
            variables: "input",
            prompt: "",
          },
          type: NodeType.MANUAL_INPUT,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.HTTP_REQUEST) {
        const newNode = {
          id: createId(),
          data: {
            label: "HTTP Request",
          },
          type: NodeType.HTTP_REQUEST,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.WEBHOOK) {
        const newNode = {
          id: createId(),
          data: {
            label: "Webhook Trigger",
            variables: "webhook",
          },
          type: NodeType.WEBHOOK,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.OPENAI) {
        const newNode = {
          id: createId(),
          data: {
            label: "OpenAI",
            variables: "openai",
          },
          type: NodeType.OPENAI,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.ANTHROPIC) {
        const newNode = {
          id: createId(),
          data: {
            label: "Anthropic",
            variables: "anthropic",
          },
          type: NodeType.ANTHROPIC,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GEMINI) {
        const newNode = {
          id: createId(),
          data: {
            label: "Gemini",
            variables: "gemini",
          },
          type: NodeType.GEMINI,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.WHATSAPP) {
        const newNode = {
          id: createId(),
          data: {
            label: "WhatsApp",
            variables: "whatsapp",
          },
          type: NodeType.WHATSAPP,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.TELEGRAM) {
        const newNode = {
          id: createId(),
          data: {
            label: "Telegram",
            variables: "telegram",
          },
          type: NodeType.TELEGRAM,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.SLACK) {
        const newNode = {
          id: createId(),
          data: {
            label: "Slack",
            variables: "slack",
          },
          type: NodeType.SLACK,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.DISCORD) {
        const newNode = {
          id: createId(),
          data: {
            label: "Discord",
            variables: "discord",
          },
          type: NodeType.DISCORD,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.TIMED_TRIGGER) {
        const hasTimedTrigger = nodes.some((node) => node.type === NodeType.TIMED_TRIGGER);
        if (hasTimedTrigger) {
          toast.error("Only one timed trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Timed Trigger",
            scheduleType: "interval",
            intervalHours: 1,
            intervalMinutes: 0,
          },
          type: NodeType.TIMED_TRIGGER,
          position: flowPosition,
        };

        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
        onOpenChange(false);
      } else if (selection.type === NodeType.DECIDER) {
        const newNode = {
          id: createId(),
          data: {
            label: "Decider",
            condition: "",
          },
          type: NodeType.DECIDER,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_DRIVE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Drive",
            variables: "googleDrive",
            action: "upload",
          },
          type: NodeType.GOOGLE_DRIVE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_CALENDAR) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Calendar",
            variables: "googleCalendar",
            action: "createEvent",
            calendarId: "primary",
          },
          type: NodeType.GOOGLE_CALENDAR,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_SHEETS) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Sheets",
            variables: "googleSheets",
            action: "readRange",
          },
          type: NodeType.GOOGLE_SHEETS,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_DOCS) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Docs",
            variables: "googleDocs",
            action: "createDocument",
          },
          type: NodeType.GOOGLE_DOCS,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_MEET) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Meet",
            variables: "googleMeet",
            action: "createMeeting",
            calendarId: "primary",
          },
          type: NodeType.GOOGLE_MEET,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GOOGLE_SLIDES) {
        const newNode = {
          id: createId(),
          data: {
            label: "Google Slides",
            variables: "googleSlides",
            action: "createPresentation",
          },
          type: NodeType.GOOGLE_SLIDES,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.GMAIL) {
        const newNode = {
          id: createId(),
          data: {
            label: "Gmail",
            variables: "gmail",
            action: "sendEmail",
          },
          type: NodeType.GMAIL,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.AIRTABLE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Airtable",
            variables: "airtable",
            action: "listBases",
          },
          type: NodeType.AIRTABLE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.ELEVENLABS) {
        const newNode = {
          id: createId(),
          data: {
            label: "ElevenLabs",
            variables: "elevenlabs",
            action: "textToSpeech",
          },
          type: NodeType.ELEVENLABS,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.FIRECRAWL) {
        const newNode = {
          id: createId(),
          data: {
            label: "Firecrawl",
            variables: "firecrawl",
            action: "scrape",
          },
          type: NodeType.FIRECRAWL,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.APIFY) {
        const newNode = {
          id: createId(),
          data: {
            label: "Apify",
            variables: "apify",
            action: "listActors",
          },
          type: NodeType.APIFY,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.CODE_BLOCK) {
        const newNode = {
          id: createId(),
          data: {
            label: "Custom Code",
            variables: "result",
            code: "",
            language: "typescript",
          },
          type: NodeType.CODE_BLOCK,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.PLAN) {
        const newNode = {
          id: createId(),
          data: {
            label: "Plan Workflow",
            variables: "plan",
          },
          type: NodeType.PLAN,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.DESIGN) {
        const newNode = {
          id: createId(),
          data: {
            label: "Design Agent",
            variables: "design",
          },
          type: NodeType.DESIGN,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.LOYALTY_DEAL) {
        const newNode = {
          id: createId(),
          data: {
            label: "Loyalty Deal",
            variables: "loyaltyDeal",
            action: "get_stats",
          },
          type: NodeType.LOYALTY_DEAL,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.LOYALTY_PROGRAM) {
        const newNode = {
          id: createId(),
          data: {
            label: "Loyalty Program",
            variables: "loyaltyProgram",
            action: "get_programs",
          },
          type: NodeType.LOYALTY_PROGRAM,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      }
    },
    [setNodes, getNodes, screenToFlowPosition, onOpenChange]
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Add Node</SheetTitle>
          <SheetDescription>
            Search and select a trigger or action to add to your workflow.
          </SheetDescription>
        </SheetHeader>

        {/* Generate with AI Button */}
        <div className="mt-4 flex-shrink-0">
          <button
            onClick={() => {
              setWorkflowGenOpen(true);
              onOpenChange(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors duration-200 group"
          >
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div className="flex flex-col text-left items-start flex-1">
              <span className="font-semibold text-sm text-foreground">Generate with AI</span>
              <span className="text-xs text-muted-foreground">
                Describe your workflow and let Verxio agent create it for you
              </span>
            </div>
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-4 flex-shrink-0">
          <div className="relative">
            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              className="pl-8 w-full bg-background shadow-none border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
            />
          </div>
        </div>

        {/* Node List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2">
          {paginatedNodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No nodes found matching "{searchQuery}"
            </div>
          ) : (
            paginatedNodes.map((node) => {
              const Icon = node.icon;
              const isTrigger = node.category === "trigger";
              const bgColor = isTrigger
                ? "bg-blue-100 dark:bg-blue-900/20 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30"
                : "bg-green-100 dark:bg-green-900/20 group-hover:bg-green-200 dark:group-hover:bg-green-900/30";
              const iconColor = isTrigger
                ? "text-blue-600 dark:text-blue-400"
                : "text-green-600 dark:text-green-400";

              return (
                <div
                  key={node.type}
                  className="w-full justify-start h-auto py-4 px-4 rounded-lg cursor-pointer border border-border bg-card hover:bg-accent hover:border-primary transition-colors duration-200 group"
                  onClick={() => handleNodeSelect(node)}
                >
                  <div className="flex items-center gap-4 w-full overflow-hidden">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgColor}`}
                    >
                      {typeof Icon === "string" ? (
                        <img src={Icon} alt={node.label} className="size-5" />
                      ) : (
                        <Icon className={`size-5 ${iconColor}`} />
                      )}
                    </div>
                    <div className="flex flex-col text-left items-start flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{node.label}</span>
                        {isTrigger && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Trigger
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {node.description}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 mt-4 pt-4 border-t">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                      currentPage === page
                        ? "bg-primary text-white"
                        : "border border-gray-200 bg-white text-textPrimary hover:border-primary hover:text-primary"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Workflow Generation Panel */}
      <WorkflowGenerationPanel
        open={workflowGenOpen}
        onOpenChange={(open) => {
          setWorkflowGenOpen(open);
          if (open) {
            onOpenChange(false);
          }
        }}
        workflowId={workflowId}
      />
    </Sheet>
  );
};
