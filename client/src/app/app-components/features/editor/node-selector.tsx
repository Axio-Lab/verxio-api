"use client";

import {
    GlobeIcon,
    MousePointerIcon,
    WebhookIcon,
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
import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
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
    
];

export const NodeSelector = ({ open, onOpenChange, children }: NodeSelectorProps) => {

    const {setNodes, getNodes, screenToFlowPosition } = useReactFlow()

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
        }
    }, [setNodes, getNodes, screenToFlowPosition, onOpenChange])
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>What triggers this workflow?</SheetTitle>
                    <SheetDescription>
                        A trigger is a step that starts your workflow.
                    </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                    {triggerNodes.map((node) => {
                        const Icon = node.icon;
                        return (
                            <div
                                key={node.type}
                                className="w-full justify-start h-auto py-4 px-4 rounded-lg cursor-pointer border border-border bg-card hover:bg-accent hover:border-primary transition-colors duration-200 group"
                                onClick={() => handleNodeSelect(node)}
                            >
                                <div className="flex items-center gap-4 w-full overflow-hidden">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                                        {typeof Icon === 'string' ? (
                                            <img
                                                src={Icon}
                                                alt={node.label}
                                                className="size-5"
                                            />
                                        ) : (
                                            <Icon className="size-5 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                    <div className="flex flex-col text-left items-start flex-1 min-w-0">
                                        <span className="font-semibold text-sm text-foreground">
                                            {node.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground line-clamp-2">
                                            {node.description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Separator className="my-4" />
                <div className="mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Actions</h3>
                    <div className="space-y-2">
                        {executionNodes.map((node) => {
                            const Icon = node.icon;
                            const isWebhook = node.type === NodeType.WEBHOOK;
                            return (
                                <div
                                    key={node.type}
                                    className="w-full justify-start h-auto py-4 px-4 rounded-lg cursor-pointer border border-border bg-card hover:bg-accent hover:border-primary transition-colors duration-200 group"
                                    onClick={() => handleNodeSelect(node)}
                                >
                                    <div className="flex items-center gap-4 w-full overflow-hidden">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                            isWebhook 
                                                ? 'bg-purple-100 dark:bg-purple-900/20 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30' 
                                                : 'bg-green-100 dark:bg-green-900/20 group-hover:bg-green-200 dark:group-hover:bg-green-900/30'
                                        }`}>
                                            {typeof Icon === 'string' ? (
                                                <img
                                                    src={Icon}
                                                    alt={node.label}
                                                    className="size-5"
                                                />
                                            ) : (
                                                <Icon className={`size-5 ${
                                                    isWebhook 
                                                        ? 'text-purple-600 dark:text-purple-400' 
                                                        : 'text-green-600 dark:text-green-400'
                                                }`} />
                                            )}
                                        </div>
                                        <div className="flex flex-col text-left items-start flex-1 min-w-0">
                                            <span className="font-semibold text-sm text-foreground">
                                                {node.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground line-clamp-2">
                                                {node.description}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};

