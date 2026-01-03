"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams } from "next/navigation";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const stripeTriggerSchema = z.object({
    secret: z.string().optional(),
});

type StripeTriggerFormValues = z.infer<typeof stripeTriggerSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit?: (values: StripeTriggerFormValues) => void;
    defaultValues?: Partial<StripeTriggerFormValues>;
    nodeId?: string;
}

export const StripeTriggerDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues,
    nodeId,
}: Props) => {
    const params = useParams();
    const workflowId = params.workflow as string;
    const { setNodes } = useReactFlow();

    const form = useForm<StripeTriggerFormValues>({
        resolver: zodResolver(stripeTriggerSchema),
        defaultValues: {
            secret: defaultValues?.secret || "",
        },
    });

    // Generate the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const webhookUrl = `${baseUrl}/api/webhooks/stripe?workflowId=${workflowId}`;

    // Copy the webhook URL to the clipboard
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            toast.success("Webhook URL copied to clipboard");
        } catch (error) {
            console.error(error);
            toast.error("Failed to copy webhook URL");
        }
    };

    const handleSubmit = (values: StripeTriggerFormValues) => {
        if (nodeId && setNodes) {
            setNodes((nodes) =>
                nodes.map((node) => {
                    if (node.id === nodeId) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                ...values,
                                variables: "stripe",
                            },
                        };
                    }
                    return node;
                })
            );
        }
        onSubmit?.(values);
        toast.success("Stripe trigger configuration saved");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Stripe Trigger Configuration</DialogTitle>
                    <DialogDescription>
                        Configure this webhook URL in your Stripe Dashboard to
                        trigger this workflow on stripe events.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4 overflow-y-auto flex-1 pr-2 -mr-2"
                    >
                        <div>
                            <Label htmlFor="webhook-url">Webhook URL</Label>
                            <div className="flex gap-2 mt-1">
                                <Input
                                    id="webhook-url"
                                    value={webhookUrl}
                                    readOnly
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={copyToClipboard}
                                >
                                    <CopyIcon className="size-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Use this URL in your Stripe Dashboard → Webhooks → Add endpoint
                            </p>
                        </div>

                        <FormField
                            control={form.control}
                            name="secret"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Webhook Signing Secret (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="password"
                                            placeholder="whsec_..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="rounded-lg bg-muted p-4 space-y-2">
                            <h4 className="font-medium text-sm">Setup Guide</h4>
                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Open your Stripe Dashboard</li>
                                <li>Go to → Developers → Webhooks</li>
                                <li>Click "Add endpoint"</li>
                                <li>Paste the webhook URL above</li>
                                <li>Select events to listen for (e.g., payment_intent.succeeded)</li>
                                <li>Save and copy the "Signing secret" and paste it in the field above</li>
                            </ol>
                        </div>

                        <div className="rounded-lg bg-muted p-4 space-y-2">
                            <h4 className="font-medium text-sm">Available Variables</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>
                                    <code className="bg-background px-1 py-0.5 rounded">
                                        {"{{stripe.eventType}}"}
                                    </code>
                                    - Stripe event type (e.g., payment_intent.succeeded)
                                </li>
                                <li>
                                    <code className="bg-background px-1 py-0.5 rounded">
                                        {"{{stripe.data}}"}
                                    </code>
                                    - Event data object
                                </li>
                                <li>
                                    <code className="bg-background px-1 py-0.5 rounded">
                                        {"{{json stripe.payload}}"}
                                    </code>
                                    - Full webhook payload as JSON
                                </li>
                            </ul>
                        </div>

                        <div className="flex-shrink-0 pt-4 border-t">
                            <Button type="submit" className="w-full">
                                Save Configuration
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
