"use client";

import {
    GlobeIcon,
    MousePointerIcon,
    WebhookIcon,
    SearchIcon,
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from "@/components/ui/sheet"
import { NodeType } from "@/app/app-components/features/editor/node-types";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useReactFlow } from "@xyflow/react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { createId } from "@paralleldrive/cuid2";



export type NodeTypeOption = {
    type: keyof typeof NodeType;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }> | string;
}

interface NodeSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

const triggerNodes: NodeTypeOption[] = [
    {
        type: NodeType.MANUAL_TRIGGER,
        label: "Manual Trigger",
        description: "Runs the workflow on clicking a button. Good for getting started quickly.",
        icon: MousePointerIcon,
    },
    {
        type: NodeType.GOOGLE_FORM_TRIGGER,
        label: "Google Form Trigger",
        description: "Triggers the workflow when a Google Form is submitted.",
        icon: "/logo/googleform.svg",
    },
    {
        type: NodeType.STRIPE_TRIGGER,
        label: "Stripe Trigger",
        description: "Triggers the workflow when a Stripe webhook event occurs (e.g., payment_intent.succeeded).",
        icon: "/logo/stripe.svg",
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
        type: NodeType.WEBHOOK,
        label: "Webhook",
        description: "Receive HTTP requests from external services",
        icon: WebhookIcon,
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
];

export const NodeSelector = ({ open, onOpenChange, children }: NodeSelectorProps) => {
    const {setNodes, getNodes, screenToFlowPosition } = useReactFlow();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6; // Show 5 items per page

    // Combine all nodes for unified search
    const allNodes = useMemo(() => [
        ...triggerNodes.map(node => ({ ...node, category: "trigger" as const })),
        ...executionNodes.map(node => ({ ...node, category: "action" as const })),
    ], []);

    // Filter nodes based on search query
    const filteredNodes = useMemo(() => {
        if (!searchQuery.trim()) {
            return allNodes;
        }
        const query = searchQuery.toLowerCase();
        return allNodes.filter(node => 
            node.label.toLowerCase().includes(query) ||
            node.description.toLowerCase().includes(query)
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

    const handleNodeSelect = useCallback((selection: NodeTypeOption) => {
        const nodes = getNodes();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const flowPosition = screenToFlowPosition({
            x: centerX + (Math.random() - 0.5) * 200,
            y: centerY + (Math.random() - 0.5) * 200,
        });

        if (selection.type === NodeType.MANUAL_TRIGGER) {
            const hasManualTrigger = nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER)
            if (hasManualTrigger) {
                toast.error("Only one manual trigger is allowed per workflow")
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
            const hasGoogleFormTrigger = nodes.some((node) => node.type === NodeType.GOOGLE_FORM_TRIGGER)
            if (hasGoogleFormTrigger) {
                toast.error("Only one Google Form trigger is allowed per workflow")
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
        } else if (selection.type === NodeType.STRIPE_TRIGGER) {
            const hasStripeTrigger = nodes.some((node) => node.type === NodeType.STRIPE_TRIGGER)
            if (hasStripeTrigger) {
                toast.error("Only one Stripe trigger is allowed per workflow")
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
                    label: "Webhook",
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
        }
    }, [setNodes, getNodes, screenToFlowPosition, onOpenChange])
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
                <SheetHeader className="flex-shrink-0">
                    <SheetTitle>Add Node</SheetTitle>
                    <SheetDescription>
                        Search and select a trigger or action to add to your workflow.
                    </SheetDescription>
                </SheetHeader>
                
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
                            const isWebhook = node.type === NodeType.WEBHOOK;
                            const isTrigger = node.category === "trigger";
                            const bgColor = isTrigger 
                                ? "bg-blue-100 dark:bg-blue-900/20 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30"
                                : isWebhook
                                ? "bg-purple-100 dark:bg-purple-900/20 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30"
                                : "bg-green-100 dark:bg-green-900/20 group-hover:bg-green-200 dark:group-hover:bg-green-900/30";
                            const iconColor = isTrigger
                                ? "text-blue-600 dark:text-blue-400"
                                : isWebhook
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-green-600 dark:text-green-400";
                            
                            return (
                                <div
                                    key={node.type}
                                    className="w-full justify-start h-auto py-4 px-4 rounded-lg cursor-pointer border border-border bg-card hover:bg-accent hover:border-primary transition-colors duration-200 group"
                                    onClick={() => handleNodeSelect(node)}
                                >
                                    <div className="flex items-center gap-4 w-full overflow-hidden">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgColor}`}>
                                            {typeof Icon === 'string' ? (
                                                <img
                                                    src={Icon}
                                                    alt={node.label}
                                                    className="size-5"
                                                />
                                            ) : (
                                                <Icon className={`size-5 ${iconColor}`} />
                                            )}
                                        </div>
                                        <div className="flex flex-col text-left items-start flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-foreground">
                                                    {node.label}
                                                </span>
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
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

