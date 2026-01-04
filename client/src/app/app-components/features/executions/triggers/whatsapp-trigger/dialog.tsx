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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WhatsAppTriggerDialog = ({ open, onOpenChange }: Props) => {
  const params = useParams();
  const workflowId = params.workflow as string;

  // Generate the webhook URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const webhookUrl = `${baseUrl}/api/webhooks/whatsapp?workflowId=${workflowId}`;

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
          <DialogTitle>WhatsApp Trigger Configuration</DialogTitle>
          <DialogDescription>
            Use this webhook URL to receive WhatsApp messages and trigger the workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 overflow-y-auto flex-1 pr-2 -mr-2">
          <div>
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input id="webhook-url" value={webhookUrl} readOnly />
              <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                <CopyIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available Variables</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{whatsapp.payload.from}}"}
                </code>
                - Sender's phone number
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{whatsapp.payload.message}}"}
                </code>
                - Message content
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{json whatsapp.payload}}"}
                </code>
                - All payload data as JSON
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
