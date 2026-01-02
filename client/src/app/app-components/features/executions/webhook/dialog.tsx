"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const formSchema = z.object({
    variables: z.string().min(1, { message: "Variable name is required" })
        .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores" }),
    secret: z.string().optional(),
});

export type WebhookFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: WebhookFormValues) => void;
    defaultValues?: Partial<WebhookFormValues & { nodeId?: string }>;
    nodeId?: string;
}

export const WebhookDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
    nodeId,
}: Props) => {
    const params = useParams();
    const workflowId = params?.workflow as string;
    const [copied, setCopied] = useState(false);

    // Generate webhook URL
    const baseUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://localhost:8080';
    const webhookUrl = workflowId && nodeId
        ? `${baseUrl}/workflow/webhook/${workflowId}/${nodeId}`
        : '';

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variables: defaultValues.variables || "webhook",
            secret: defaultValues.secret || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variables: defaultValues.variables || "webhook",
                secret: defaultValues.secret || "",
            });
        }
    }, [open, defaultValues, form]);

    const watchVariables = form.watch("variables") || "webhook";

    const handleCopyUrl = async () => {
        if (!webhookUrl) return;
        
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            toast.success("Webhook URL copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast.error("Failed to copy webhook URL");
        }
    };

    const handleSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await Promise.resolve(onSubmit(values));
            onOpenChange(false);
            toast.success("Webhook configured");
            form.reset();
        } catch (error) {
            // Error handling is done in the parent component
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Webhook Trigger</DialogTitle>
                    <DialogDescription>
                        Configure your webhook endpoint. External services can POST to this URL to trigger your workflow.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
                        <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Webhook URL</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={webhookUrl}
                                        readOnly
                                        className="font-mono text-xs"
                                        placeholder="Webhook URL will appear here after saving"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopyUrl}
                                        disabled={!webhookUrl}
                                        title="Copy webhook URL"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Copy this URL and use it as your webhook endpoint. POST requests to this URL will trigger your workflow.
                                </p>
                            </div>

                            <FormField
                                control={form.control}
                                name="variables"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Variable Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="webhook"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Use this name to reference the webhook data in other nodes: {" "}
                                            {`{{${watchVariables}.payload}}`} or {" "}
                                            {`{{${watchVariables}.headers}}`}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="secret"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Webhook Secret (Optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="password"
                                                placeholder="Enter secret for webhook authentication"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Optional secret for webhook authentication. If set, include it in the <code className="text-xs">X-Webhook-Secret</code> header or as a Bearer token.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
