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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParams } from "next/navigation";
import { CopyIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (credentialId: string) => void;
  defaultValues?: {
    credentialId?: string;
  };
}

export const TelegramTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const params = useParams();
  const workflowId = params.workflow as string;
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
    defaultValues.credentialId || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Telegram credentials
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.TELEGRAM);
  const telegramCredentials = credentialsData?.credentials || [];

  // Generate the webhook URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const webhookUrl = `${baseUrl}/api/webhooks/telegram?workflowId=${workflowId}`;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCredentialId(defaultValues.credentialId || "");
    }
  }, [open, defaultValues]);

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

  // Handle save - set webhook automatically
  const handleSave = async () => {
    if (!selectedCredentialId) {
      toast.error("Please select a Telegram credential");
      return;
    }

    setIsSaving(true);
    try {
      // Get the credential value
      const { authenticatedGet } = await import("@/lib/api-client");
      const credential = await authenticatedGet<{ value: string }>(
        `/credential/${selectedCredentialId}`
      );

      if (!credential.value) {
        throw new Error("Credential value not found");
      }

      const botToken = credential.value;

      // Set webhook via Telegram Bot API
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          url: webhookUrl,
        }),
      });

      const result = await telegramResponse.json();

      if (result.ok) {
        toast.success("Telegram webhook configured");
        if (onSubmit) {
          onSubmit(selectedCredentialId);
        }
        onOpenChange(false);
      } else {
        // Provide helpful error message for HTTPS requirement
        if (result.description?.includes("HTTPS") || result.description?.includes("bad webhook")) {
          throw new Error(
            "Telegram requires HTTPS URLs for webhooks. Make sure your API URL uses HTTPS (e.g., ngrok for local development)."
          );
        }
        throw new Error(result.description || "Failed to set webhook");
      }
    } catch (error) {
      console.error("Error setting webhook:", error);
      toast.error(
        error instanceof Error
          ? `Failed to configure webhook: ${error.message}`
          : "Failed to configure webhook"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Telegram Trigger Configuration</DialogTitle>
          <DialogDescription>
            Use this webhook URL to receive Telegram messages and trigger the workflow. Set this URL
            in your Telegram bot's webhook settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <div className="flex gap-2 mt-2">
                <Input id="webhook-url" value={webhookUrl} readOnly />
                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="credential">Telegram Bot Token Credential</Label>
              <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                <SelectTrigger id="credential" className="w-full mt-2">
                  <SelectValue placeholder="Select a Telegram credential" />
                </SelectTrigger>
                <SelectContent>
                  {telegramCredentials.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No Telegram credentials found. Create one in Settings.
                    </SelectItem>
                  ) : (
                    telegramCredentials.map((credential) => (
                      <SelectItem key={credential.id} value={credential.id}>
                        {credential.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the Telegram bot token credential. The webhook will be configured
                automatically when you save.
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">Setup Instructions</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Create a bot via @BotFather on Telegram</li>
                <li>Get your bot token and save it as a Telegram credential</li>
                <li>Select the credential above and click "Save Configuration"</li>
              </ol>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
                How to Trigger the Bot
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                <li>
                  Open Telegram and search for your bot (use the username from @BotFather, e.g.,
                  @YourBotName)
                </li>
                <li>Start a conversation with your bot by clicking "Start"</li>
                <li>Send any message to your bot (e.g., "Hello" or "Test")</li>
                <li>The message will trigger the workflow automatically via the webhook</li>
              </ol>
            </div>
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">Available Variables</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <code className="bg-background px-1 py-0.5 rounded">
                    {"{{telegram.message.text}}"}
                  </code>
                  - Message text
                </li>
                <li>
                  <code className="bg-background px-1 py-0.5 rounded">
                    {"{{telegram.chat.id}}"}
                  </code>
                  - Chat ID
                </li>
                <li>
                  <code className="bg-background px-1 py-0.5 rounded">
                    {"{{telegram.from.id}}"}
                  </code>
                  - User ID
                </li>
                <li>
                  <code className="bg-background px-1 py-0.5 rounded">
                    {"{{json telegram.payload}}"}
                  </code>
                  - All payload data as JSON
                </li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
            <Button onClick={handleSave} disabled={!selectedCredentialId || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configuring...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
