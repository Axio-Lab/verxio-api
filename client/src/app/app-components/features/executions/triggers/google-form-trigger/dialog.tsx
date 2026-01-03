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
import { generateGoogleFormScript } from "./utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const GoogleFormTriggerDialog = ({
    open,
    onOpenChange,
}: Props) => {

    const params = useParams();
    const workflowId = params.workflow as string;

    // Generate the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const webhookUrl = `${baseUrl}/api/webhooks/google-form?workflowId=${workflowId}`;

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Google Form Trigger Configuration</DialogTitle>
                    <DialogDescription>
                        Use this webhook URL in your Google Form's Apps Script to
                        trigger the workflow when a form is submitted.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 overflow-y-auto flex-1 pr-2 -mr-2">
                    <div>
                        <Label
                            htmlFor="webhook-url">
                            Webhook URL</Label>
                        <div className="flex gap-2">
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
                    </div>
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <h4 className="font-medium text-sm">Setup Guide</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Open your Google Form</li>
                            <li>Click on the three dots menu → Apps Scripts</li>
                            <li>Copy and paste the script below</li>
                            <li>Save and click "Triggers" → Add Trigger</li>
                            <li>Choose: From form → On form submit → Save</li>
                        </ol>
                    </div>
                    <div className="rounded-lg bg-muted p-4 space-y-3">
                        <h4>
                            Script:
                        </h4>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={async() => {
                                const script = generateGoogleFormScript(webhookUrl);
                                try {
                                    await navigator.clipboard.writeText(script);
                                    toast.success("Google Apps Script copied to clipboard");
                                } catch (error) {
                                    console.error(error);
                                    toast.error("Failed to copy Google Apps Script to clipboard");
                                }
                             }}
                        >
                            <CopyIcon className="size-4 mr-2" />
                            Copy Google Apps Script
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            This script includes your webhook URL and handles form submissions
                        </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{googleForm.respondentEmail}}"}
                                </code>
                                - Respondent's email address
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{googleForm.responses['Question Name']}}"}
                                </code>
                                - Specific response for a question
                            </li>
                            <li>
                                <code className="bg-background px-1 py-0.5 rounded">
                                    {"{{json googleForm.responses}}"}
                                </code>
                                - All responses as an JSON
                            </li>
                        </ul>
                        
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};