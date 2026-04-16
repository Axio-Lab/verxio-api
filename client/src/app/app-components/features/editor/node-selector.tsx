"use client";

import {
  GlobeIcon,
  MousePointerIcon,
  WebhookIcon,
  SearchIcon,
  ClockIcon,
  GitBranchIcon,
  Code2,
  Palette,
  Video,
  Download,
  FileText,
  Users,
  Bot,
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
import { useSubscription } from "@/hooks/useSubscription";

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
  {
    type: NodeType.COMPOSIO_TRIGGER,
    label: "Composio Trigger",
    description:
      "Triggers workflow from Composio app events (e.g., SLACK_CHANNEL_CREATED, GITHUB_COMMIT_EVENT).",
    icon: "/logo/composio.svg",
  },
];

const executionNodes: NodeTypeOption[] = [
  {
    type: NodeType.MANUAL_INPUT,
    label: "Manual Input",
    description:
      "Collect user-provided input when the workflow runs (e.g. prompt or variable). User enters a value at run time.",
    icon: MousePointerIcon,
  },
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
    type: NodeType.COMPOSIO_ACTION,
    label: "Composio Action",
    description:
      "Execute any of 10,000+ actions from 800+ apps (GitHub, Notion, Jira, HubSpot, etc.)",
    icon: "/logo/composio.svg",
  },
  {
    type: NodeType.TINYFISH,
    label: "TinyFish",
    description:
      "AI-powered web automation. Browse websites, extract data, fill forms, handle bot-protected sites.",
    icon: "/logo/tinyfish.svg",
  },
  {
    type: NodeType.VALYU_SEARCH,
    label: "Valyu Search",
    description: "Search across web and proprietary data sources using Valyu AI.",
    icon: "/logo/valyu.svg",
  },
  {
    type: NodeType.VALYU_CONTENTS,
    label: "Valyu Contents",
    description: "Extract and process content from URLs with AI.",
    icon: "/logo/valyu.svg",
  },
  {
    type: NodeType.VALYU_ANSWER,
    label: "Valyu Answer",
    description: "Generate AI-powered answers with integrated search.",
    icon: "/logo/valyu.svg",
  },
  {
    type: NodeType.VALYU_DEEP_RESEARCH,
    label: "Valyu Deep Research",
    description: "Run comprehensive multi-source research with detailed reports.",
    icon: "/logo/valyu.svg",
  },
  {
    type: NodeType.AGENT_TEAM,
    label: "Agent Team",
    description:
      "Orchestrate multiple AI agents working together on complex tasks with sequential, parallel, or supervisor strategies.",
    icon: Users,
  },
  {
    type: NodeType.AGENT_EXEC,
    label: "Agent Execute",
    description:
      "Run an objective using your available subagents (built-in + custom). Supports file attachments and configurable execution strategy.",
    icon: Bot,
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
    type: NodeType.DESIGN_PRO,
    label: "Design Agent Pro",
    description:
      "Advanced image editing with multi-turn conversations, reference images (up to 14), high-resolution output (1K/2K/4K), and Google Search grounding. Edit existing images, maintain character consistency, and iterate through conversational editing.",
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
  {
    type: NodeType.REMOTION,
    label: "Remotion",
    description:
      "Generate motion videos using AI-powered Remotion code generation. Add assets, background audio, and create professional videos.",
    icon: "/logo/remotion.svg",
  },
  {
    type: NodeType.VEO,
    label: "Veo Video",
    description:
      "Generate high-fidelity videos with Veo 3.1. Supports text-to-video, image-to-video, reference images, and video extension.",
    icon: Video,
  },
  {
    type: NodeType.KLING_TEXT2VIDEO,
    label: "Kling Text-to-Video",
    description:
      "Generate videos from text using Kling AI. Supports multiple models, aspect ratios, and durations.",
    icon: Video,
  },
  {
    type: NodeType.KLING_IMAGE2VIDEO,
    label: "Kling Image-to-Video",
    description: "Animate an image into video using Kling AI.",
    icon: Video,
  },
  {
    type: NodeType.KLING_IMAGE,
    label: "Kling Image",
    description: "Generate images from text using Kling AI. Optional reference image.",
    icon: Palette,
  },
  {
    type: NodeType.KLING_TTS,
    label: "Kling TTS",
    description: "Convert text to speech using Kling AI voices.",
    icon: "/logo/klingAI.svg",
  },
  {
    type: NodeType.KLING_OMNI_VIDEO,
    label: "Kling Omni Video",
    description: "Kling O1 unified multimodal video from prompt and optional image list.",
    icon: Video,
  },
  {
    type: NodeType.KLING_OMNI_IMAGE,
    label: "Kling Omni Image",
    description: "Kling O1 omni-image generation from prompt and optional image list.",
    icon: Palette,
  },
  {
    type: NodeType.KLING_VIDEO_EXTEND,
    label: "Kling Video Extend",
    description: "Extend a Kling video using video_id (e.g. from Text-to-Video).",
    icon: Video,
  },
  {
    type: NodeType.KLING_MULTI_IMAGE2VIDEO,
    label: "Kling Multi-Image to Video",
    description: "Generate video from multiple reference images.",
    icon: Video,
  },
  {
    type: NodeType.KLING_MOTION_CONTROL,
    label: "Kling Motion Control",
    description: "Motion control video with image and optional video reference.",
    icon: Video,
  },
  {
    type: NodeType.KLING_MULTI_IMAGE2IMAGE,
    label: "Kling Multi-Image to Image",
    description: "Generate image from multiple reference images.",
    icon: Palette,
  },
  {
    type: NodeType.OUTPUT,
    label: "Output",
    description:
      "Display and download workflow outputs. Supports images, videos, and audio with preview and download features.",
    icon: Download,
  },
  {
    type: NodeType.MARKDOWN,
    label: "Markdown",
    description:
      "Display a node's text output as markdown. Connect from Gemini, Claude, or any text node; download as .md, PDF, or .docx.",
    icon: FileText,
  },
  {
    type: NodeType.SEEDANCE,
    label: "Seedance",
    description:
      "Generate videos using BytePlus Seedance models. Supports text-to-video, image-to-video, and multi-reference image generation.",
    icon: Video,
  },
  {
    type: NodeType.SEEDREAM,
    label: "Seedream",
    description:
      "Generate images using BytePlus Seedream 4.5. Supports text-to-image, image editing, and multi-image blending.",
    icon: Palette,
  },
];

// Map node types to subscription features
const NODE_TYPE_TO_FEATURE: Record<string, string> = {
  CODE_BLOCK: "code-block-node",
  REMOTION: "remotion",
  DESIGN_PRO: "design-agent-pro",
  VEO: "veo",
  SEEDANCE: "seedance",
  SEEDREAM: "seedream",
  PLAN: "plan-node",
  KLING_TEXT2VIDEO: "kling-nodes",
  KLING_IMAGE2VIDEO: "kling-nodes",
  KLING_IMAGE: "kling-nodes",
  KLING_TTS: "kling-nodes",
  KLING_OMNI_VIDEO: "kling-nodes",
  KLING_OMNI_IMAGE: "kling-nodes",
  KLING_VIDEO_EXTEND: "kling-nodes",
  KLING_MULTI_IMAGE2VIDEO: "kling-nodes",
  KLING_MOTION_CONTROL: "kling-nodes",
  KLING_MULTI_IMAGE2IMAGE: "kling-nodes",
};

export const NodeSelector = ({ open, onOpenChange, children, workflowId }: NodeSelectorProps) => {
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [workflowGenOpen, setWorkflowGenOpen] = useState(false);
  const itemsPerPage = 6; // Show 5 items per page
  const { subscription } = useSubscription();
  const userFeatures = subscription?.features || [];
  const isBetaTester = subscription?.subscriptionPlan === "beta-tester";

  // Check if user has access to a feature (beta-testers get all premium features)
  const hasFeatureAccess = (feature: string) => {
    return isBetaTester || userFeatures.includes(feature);
  };

  // Check if a node requires subscription
  const isPremiumNode = (nodeType: string) => {
    return NODE_TYPE_TO_FEATURE[nodeType] !== undefined;
  };

  // Combine all nodes for unified search (show all nodes, including premium)
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

  const getPaginationItems = useCallback(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: Array<number | "ellipsis"> = [];
    const showLeftEllipsis = currentPage > 3;
    const showRightEllipsis = currentPage < totalPages - 2;

    pages.push(1);

    if (showLeftEllipsis) {
      pages.push("ellipsis");
    }

    const startPage = showLeftEllipsis ? Math.max(2, currentPage - 1) : 2;
    const endPage = showRightEllipsis ? Math.min(totalPages - 1, currentPage + 1) : totalPages - 1;

    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    if (showRightEllipsis) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

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
      // Check if this is a premium node and user doesn't have access
      const requiredFeature = NODE_TYPE_TO_FEATURE[selection.type];
      if (requiredFeature && !hasFeatureAccess(requiredFeature)) {
        toast.error("This is a premium feature. Please upgrade your plan to use it.");
        return;
      }

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
      } else if (selection.type === NodeType.COMPOSIO_TRIGGER) {
        const hasComposioTrigger = nodes.some((node) => node.type === NodeType.COMPOSIO_TRIGGER);
        if (hasComposioTrigger) {
          toast.error("Only one Composio trigger is allowed per workflow");
          return;
        }
        const hasInitialTrigger = nodes.some((node) => node.type === NodeType.INITIAL);
        const newNode = {
          id: createId(),
          data: {
            label: "Composio Trigger",
            variables: "composioTrigger",
            composioTriggerSlug: "",
            triggerConfig: {},
            enabled: true,
            composioTriggerStatus: "provisioning",
          },
          type: NodeType.COMPOSIO_TRIGGER,
          position: flowPosition,
        };
        if (hasInitialTrigger) {
          setNodes([newNode]);
        } else {
          setNodes((nodes) => [...nodes, newNode]);
        }
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
            model: "gemini-3.1-pro-preview",
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
      } else if (selection.type === NodeType.COMPOSIO_ACTION) {
        const newNode = {
          id: createId(),
          data: {
            label: "Composio Action",
            variables: "composioAction",
            composioActionName: "",
            composioParams: {},
          },
          type: NodeType.COMPOSIO_ACTION,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.TINYFISH) {
        const newNode = {
          id: createId(),
          data: {
            label: "TinyFish",
            variables: "tinyfish",
            url: "",
            goal: "",
            browserProfile: "lite",
            proxyCountry: "",
          },
          type: NodeType.TINYFISH,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.VALYU_SEARCH) {
        const newNode = {
          id: createId(),
          data: {
            label: "Valyu Search",
            variables: "valyuSearch",
            credentialId: "",
            query: "",
            searchType: "all",
            maxNumResults: 10,
            fastMode: false,
          },
          type: NodeType.VALYU_SEARCH,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.VALYU_CONTENTS) {
        const newNode = {
          id: createId(),
          data: {
            label: "Valyu Contents",
            variables: "valyuContents",
            credentialId: "",
            urls: "",
            summary: false,
            extractEffort: "normal",
          },
          type: NodeType.VALYU_CONTENTS,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.VALYU_ANSWER) {
        const newNode = {
          id: createId(),
          data: {
            label: "Valyu Answer",
            variables: "valyuAnswer",
            credentialId: "",
            query: "",
            searchType: "all",
            maxNumResults: 10,
          },
          type: NodeType.VALYU_ANSWER,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.VALYU_DEEP_RESEARCH) {
        const newNode = {
          id: createId(),
          data: {
            label: "Valyu Deep Research",
            variables: "valyuDeepResearch",
            credentialId: "",
            query: "",
            mode: "standard",
            strategy: "",
          },
          type: NodeType.VALYU_DEEP_RESEARCH,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.AGENT_TEAM) {
        const newNode = {
          id: createId(),
          data: {
            label: "Agent Team",
            variables: "agentTeam",
            objective: "",
            strategy: "sequential",
            agents: [{ name: "Researcher", role: "researcher", personality: "" }],
            maxRounds: 5,
          },
          type: NodeType.AGENT_TEAM,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.AGENT_EXEC) {
        const newNode = {
          id: createId(),
          data: {
            label: "Agent Execute",
            variables: "agentExec",
            objective: "",
            strategy: "auto",
            selectedSubagents: [],
            maxTurns: 10,
          },
          type: NodeType.AGENT_EXEC,
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
            // PLAN nodes don't need variables or label - they're just for planning
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
      } else if (selection.type === NodeType.DESIGN_PRO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Design Agent Pro",
            variables: "designPro",
            mode: "generate",
            model: "gemini-3.1-flash-image-preview",
          },
          type: NodeType.DESIGN_PRO,
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
      } else if (selection.type === NodeType.REMOTION) {
        const newNode = {
          id: createId(),
          data: {
            label: "Remotion",
            variables: "remotion",
            prompt: "",
            videoFormat: "16:9",
          },
          type: NodeType.REMOTION,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.VEO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Veo Video",
            variables: "veo",
            mode: "text",
            prompt: "",
            aspectRatio: "16:9",
            resolution: "720p",
            durationSeconds: "8",
          },
          type: NodeType.VEO,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_TEXT2VIDEO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Text-to-Video",
            variables: "klingText2Video",
          },
          type: NodeType.KLING_TEXT2VIDEO,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_IMAGE2VIDEO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Image-to-Video",
            variables: "klingImage2Video",
          },
          type: NodeType.KLING_IMAGE2VIDEO,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_IMAGE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Image",
            variables: "klingImage",
          },
          type: NodeType.KLING_IMAGE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_TTS) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling TTS",
            variables: "klingTts",
          },
          type: NodeType.KLING_TTS,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_OMNI_VIDEO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Omni Video",
            variables: "klingOmniVideo",
          },
          type: NodeType.KLING_OMNI_VIDEO,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_OMNI_IMAGE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Omni Image",
            variables: "klingOmniImage",
          },
          type: NodeType.KLING_OMNI_IMAGE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_VIDEO_EXTEND) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Video Extend",
            variables: "klingVideoExtend",
          },
          type: NodeType.KLING_VIDEO_EXTEND,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_MULTI_IMAGE2VIDEO) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Multi-Image to Video",
            variables: "klingMultiImage2Video",
          },
          type: NodeType.KLING_MULTI_IMAGE2VIDEO,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_MOTION_CONTROL) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Motion Control",
            variables: "klingMotionControl",
          },
          type: NodeType.KLING_MOTION_CONTROL,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.KLING_MULTI_IMAGE2IMAGE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Kling Multi-Image to Image",
            variables: "klingMultiImage2Image",
          },
          type: NodeType.KLING_MULTI_IMAGE2IMAGE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.OUTPUT) {
        const newNode = {
          id: createId(),
          data: {
            label: "Output",
            variables: "output",
            contentType: "image",
          },
          type: NodeType.OUTPUT,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.MARKDOWN) {
        const newNode = {
          id: createId(),
          data: {
            label: "Markdown",
            variables: "markdown",
            textSource: "",
          },
          type: NodeType.MARKDOWN,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.SEEDANCE) {
        const newNode = {
          id: createId(),
          data: {
            label: "Seedance",
            variables: "seedance",
            mode: "text",
            model: "dreamina-seedance-2-0-260128",
            prompt: "",
            ratio: "adaptive",
            duration: 5,
            resolution: "720p",
            generateAudio: true,
            watermark: false,
            referenceImages: [],
            referenceVideos: [],
            referenceAudios: [],
          },
          type: NodeType.SEEDANCE,
          position: flowPosition,
        };
        setNodes((nodes) => [...nodes, newNode]);
        onOpenChange(false);
      } else if (selection.type === NodeType.SEEDREAM) {
        const newNode = {
          id: createId(),
          data: {
            label: "Seedream",
            variables: "seedream",
            mode: "text",
            prompt: "",
            size: "2K",
            sequentialImageGeneration: "disabled",
            maxImages: 1,
          },
          type: NodeType.SEEDREAM,
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
              if (!hasFeatureAccess("generate-workflow-with-ai")) {
                toast.error("This is a premium feature. Please upgrade your plan to use it.");
                return;
              }
              setWorkflowGenOpen(true);
              onOpenChange(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors duration-200 group ${
              !hasFeatureAccess("generate-workflow-with-ai") ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div className="flex flex-col text-left items-start flex-1">
              <span className="font-semibold text-sm text-foreground">Generate with AI</span>
              <span className="text-xs text-muted-foreground">
                {hasFeatureAccess("generate-workflow-with-ai")
                  ? "Describe your workflow and let Verxio agent create it for you"
                  : "Premium feature - Upgrade to use"}
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
              const isPremium = isPremiumNode(node.type);
              const hasAccess = isPremium
                ? hasFeatureAccess(NODE_TYPE_TO_FEATURE[node.type])
                : true;
              const bgColor = isTrigger
                ? "bg-blue-100 dark:bg-blue-900/20 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30"
                : "bg-green-100 dark:bg-green-900/20 group-hover:bg-green-200 dark:group-hover:bg-green-900/30";
              const iconColor = isTrigger
                ? "text-blue-600 dark:text-blue-400"
                : "text-green-600 dark:text-green-400";

              return (
                <div
                  key={node.type}
                  className={`w-full justify-start h-auto py-4 px-4 rounded-lg cursor-pointer border border-border bg-card hover:bg-accent hover:border-primary transition-colors duration-200 group ${
                    isPremium && !hasAccess ? "opacity-60" : ""
                  }`}
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
                        {isPremium && !hasAccess && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                            Premium
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {node.description}
                        {isPremium && !hasAccess && " - Upgrade to use"}
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
                {getPaginationItems().map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                        currentPage === item
                          ? "bg-primary text-white"
                          : "border border-gray-200 bg-white text-textPrimary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
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
