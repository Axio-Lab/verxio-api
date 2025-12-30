"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SaveIcon } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbList,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { useUpdateWorkflow, useWorkflow } from "@/hooks/useWorkflows";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

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

    return (
        <>
            <div className="ml-auto">
                <Button
                    size="sm"
                    onClick={() => {}}
                >
                    <SaveIcon className="size-4" />
                    Save
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
    const updateWorkflow = useUpdateWorkflow();

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
            updateWorkflow.mutateAsync(
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
                disabled={updateWorkflow.isPending}
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