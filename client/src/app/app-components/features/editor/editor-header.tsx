"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SaveIcon, Loader2Icon } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbList,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { useUpdateWorkflowName, useWorkflow, useUpdateWorkflow } from "@/hooks/useWorkflows";
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useAtomValue, useSetAtom } from "jotai";
import { editorAtom, hasUnsavedChangesAtom } from "./atoms";
import { NodeType } from "./node-types";

export const EditorBreadcrumbs = ({ workflowId }: { workflowId: string }) => {
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link prefetch href="/workflows">Workflows</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <EditorNameInput workflowId={workflowId} />
            </BreadcrumbList>
        </Breadcrumb>
    );
};

export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
    const editor = useAtomValue(editorAtom);
    const { data: workflow } = useWorkflow(workflowId);
    const saveWorkflow = useUpdateWorkflow();
    const [hasChanges, setHasChanges] = useState(false);
    const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Function to check for changes - compares current editor state with saved workflow state
    const checkForChanges = useCallback(() => {
        if (!editor || !workflow) {
            setHasChanges(false);
            return;
        }

        const currentNodes = editor.getNodes();
        const currentEdges = editor.getEdges();

        // Filter out INITIAL nodes from comparison (they're handled specially and not saved)
        const currentNodesFiltered = currentNodes.filter(node => node.type !== 'INITIAL' && node.type !== NodeType.INITIAL);
        const savedNodesFiltered = (workflow.nodes || []).filter(node => node.type !== 'INITIAL');

        // Create sets for quick lookup
        const currentNodeIds = new Set(currentNodesFiltered.map(n => n.id));
        const savedNodeIds = new Set(savedNodesFiltered.map(n => n.id));

        // Check if node count changed
        if (currentNodeIds.size !== savedNodeIds.size) {
            setHasChanges(true);
            return;
        }

        // Check if any nodes were added or removed
        for (const id of currentNodeIds) {
            if (!savedNodeIds.has(id)) {
                // New node added
                setHasChanges(true);
                return;
            }
        }
        for (const id of savedNodeIds) {
            if (!currentNodeIds.has(id)) {
                // Node removed
                setHasChanges(true);
                return;
            }
        }

        // Compare existing nodes
        for (const currentNode of currentNodesFiltered) {
            const savedNode = savedNodesFiltered.find(n => n.id === currentNode.id);
            if (!savedNode) continue;

            // Extract clean data (remove temporary fields)
            const { isDeleting, onDelete, label, ...currentNodeData } = currentNode.data || {};
            const currentNodeName = typeof currentNode.data?.label === 'string' 
                ? currentNode.data.label 
                : currentNode.id;

            // Normalize data objects for comparison (sort keys for consistent comparison)
            const normalizeData = (data: any) => {
                if (!data || typeof data !== 'object') return data;
                const sorted = Object.keys(data).sort().reduce((acc, key) => {
                    acc[key] = data[key];
                    return acc;
                }, {} as any);
                return JSON.stringify(sorted);
            };

            const currentDataStr = normalizeData(currentNodeData);
            const savedDataStr = normalizeData(savedNode.data || {});

            // Compare node properties
            if (
                currentNodeName !== savedNode.name ||
                currentNode.type !== savedNode.type ||
                Math.abs(currentNode.position.x - savedNode.position.x) > 0.01 ||
                Math.abs(currentNode.position.y - savedNode.position.y) > 0.01 ||
                currentDataStr !== savedDataStr
            ) {
                setHasChanges(true);
                return;
            }
        }

        // Compare edges/connections
        const currentEdgesForCompare = currentEdges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || 'main',
            targetHandle: edge.targetHandle || 'main',
        })).sort((a, b) => {
            const aKey = `${a.source}-${a.target}-${a.sourceHandle}-${a.targetHandle}`;
            const bKey = `${b.source}-${b.target}-${b.sourceHandle}-${b.targetHandle}`;
            return aKey.localeCompare(bKey);
        });

        const savedConnectionsForCompare = (workflow.connections || []).map((conn) => ({
            source: conn.source,
            target: conn.target,
            sourceHandle: conn.sourceHandle || 'main',
            targetHandle: conn.targetHandle || 'main',
        })).sort((a, b) => {
            const aKey = `${a.source}-${a.target}-${a.sourceHandle}-${a.targetHandle}`;
            const bKey = `${b.source}-${b.target}-${b.sourceHandle}-${b.targetHandle}`;
            return aKey.localeCompare(bKey);
        });

        if (currentEdgesForCompare.length !== savedConnectionsForCompare.length) {
            setHasChanges(true);
            return;
        }

        // Compare each edge
        for (let i = 0; i < currentEdgesForCompare.length; i++) {
            const current = currentEdgesForCompare[i];
            const saved = savedConnectionsForCompare[i];
            if (
                current.source !== saved.source ||
                current.target !== saved.target ||
                current.sourceHandle !== saved.sourceHandle ||
                current.targetHandle !== saved.targetHandle
            ) {
                setHasChanges(true);
                return;
            }
        }

        // No changes detected
        setHasChanges(false);
    }, [editor, workflow]);

    // Check for changes periodically and when workflow updates
    useEffect(() => {
        if (!editor || !workflow) {
            setHasChanges(false);
            return;
        }

        // Initial check
        checkForChanges();

        // Set up interval to check for changes (check more frequently for better responsiveness)
        checkIntervalRef.current = setInterval(checkForChanges, 250);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [editor, workflow, checkForChanges]);

    // Sync hasChanges to atom for navigation guard
    useEffect(() => {
        setHasUnsavedChanges(hasChanges);
    }, [hasChanges, setHasUnsavedChanges]);

    const handleSave = async () => {
        if (!editor || !workflow) {
            return;
        }
        const nodes = editor.getNodes();
        const edges = editor.getEdges();
        
        // Filter out INITIAL nodes (they're not saved)
        const nodesToSave = nodes.filter(node => node.type !== 'INITIAL' && node.type !== NodeType.INITIAL);
        
        // Transform ReactFlow nodes to API format
        const transformedNodes = nodesToSave.map((node) => {
            // Remove temporary fields from data (isDeleting, onDelete, label)
            const { isDeleting, onDelete, label, ...nodeData } = node.data || {};
            return {
                id: node.id,
                name: typeof node.data?.label === 'string' ? node.data.label : node.id,
                type: node.type || 'INITIAL',
                position: node.position,
                data: nodeData,
            };
        });

        // Transform ReactFlow edges to API format
        const transformedConnections = edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || 'main',
            targetHandle: edge.targetHandle || 'main',
        }));
        
        try {
            await saveWorkflow.mutateAsync({
                id: workflowId,
                data: {
                    name: workflow.name,
                    nodes: transformedNodes,
                    connections: transformedConnections,
                },
            });
            // Changes are saved - the workflow will refetch automatically
            // The editor will sync the new saved state, and hasChanges will update
        } catch (error) {
            // Error is handled by the mutation's onError callback
            console.error('Failed to save workflow:', error);
        }
    };

    return (
        <>
            <div className="ml-auto">
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saveWorkflow.isPending || !hasChanges}
                >
                    {saveWorkflow.isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                        <SaveIcon className="size-4" />
                    )}
                    {saveWorkflow.isPending ? "Saving..." : "Save"}
                </Button>
            </div>
        </>
    );
};

export const EditorHeader = ({ workflowId }: { workflowId: string }) => {
    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4
        bg-background">
            <SidebarTrigger />
            <div className="flex flex-row items-center justify-between gap-x-4 w-full">
                <EditorBreadcrumbs workflowId={workflowId} />
                <EditorSaveButton workflowId={workflowId} />
            </div>
        </header>
    );
};

export const EditorNameInput = ({ workflowId }: { workflowId: string }) => {
    const { data: workflow } = useWorkflow(workflowId);
    const updateWorkflowName = useUpdateWorkflowName();

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(workflow?.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (workflow?.name) {
            setName(workflow.name);
        }
    }, [workflow?.name]);

    useEffect(() => {
        if (inputRef.current && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleUpdateWorkflow = () => {
        if (name === workflow?.name) {
            return;
        }
        try {
            updateWorkflowName.mutateAsync(
                {
                    id: workflowId,
                    name: name!,
                },
            );
        } catch (error) {
            setName(workflow?.name);
        } finally {
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleUpdateWorkflow();
        }
        if (e.key === "Escape") {
            setName(workflow?.name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <Input
                disabled={updateWorkflowName.isPending}
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleUpdateWorkflow}
                onKeyDown={handleKeyDown}
                className="h-7 w-auto min-w-[100px] px-2"
            />

        )
    }
    return (
        <BreadcrumbItem
            className="cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setIsEditing(true)}
        >
            {workflow?.name}
        </BreadcrumbItem>
    );
};