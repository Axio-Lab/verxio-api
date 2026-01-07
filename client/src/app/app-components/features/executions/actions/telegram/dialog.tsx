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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().min(1, { message: "Bot token credential is required" }),
  chatId: z.string().min(1, { message: "Chat ID is required" }),
  message: z.string().min(1, { message: "Message is required" }),
});

export type TelegramFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TelegramFormValues) => void;
  defaultValues?: Partial<TelegramFormValues>;
}

export const TelegramDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  // Fetch Telegram credentials
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.TELEGRAM);
  const telegramCredentials = credentialsData?.credentials || [];

  const form = useForm<TelegramFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "telegram",
      credentialId: defaultValues.credentialId || "",
      chatId: defaultValues.chatId || "",
      message: defaultValues.message || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "telegram",
        credentialId: defaultValues.credentialId || "",
        chatId: defaultValues.chatId || "",
        message: defaultValues.message || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "telegram";

  const handleSubmit = async (values: TelegramFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Telegram node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Telegram</DialogTitle>
          <DialogDescription>Configure the Telegram message to send.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="telegram" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.response}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Token Credential</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Telegram bot token credential" />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormDescription>
                      Select the Telegram bot token credential. Create credentials in Settings.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chat ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123456789 or {{telegram.chat.id}}" />
                    </FormControl>
                    <FormDescription>
                      Recipient's chat ID (user ID or group ID). Use {"{{variables}}"} for dynamic
                      values.
                    </FormDescription>
                    <div className="rounded-lg bg-muted p-4 space-y-2 mt-2">
                      <h4 className="font-medium text-sm">How to Get Chat ID</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <div>
                          <strong>Option 1: Use Static Chat ID (Standalone)</strong>
                          <p className="mt-1">
                            Enter a specific chat ID directly. This node works independently without
                            a Telegram Trigger.
                          </p>
                          <div className="mt-2">
                            <strong>Find Your User ID:</strong>
                            <ol className="list-decimal list-inside mt-1 space-y-1">
                              <li>
                                Open Telegram and search for{" "}
                                <code className="bg-background px-1 py-0.5 rounded text-xs">
                                  @userinfobot
                                </code>
                              </li>
                              <li>Start a conversation with the bot</li>
                              <li>Send any message (e.g., "/start")</li>
                              <li>
                                The bot will reply with your user ID (e.g.,{" "}
                                <code className="bg-background px-1 py-0.5 rounded text-xs">
                                  123456789
                                </code>
                                )
                              </li>
                            </ol>
                          </div>
                          <div className="mt-2">
                            <strong>Find Group ID:</strong>
                            <ol className="list-decimal list-inside mt-1 space-y-1">
                              <li>Add your bot to the group</li>
                              <li>Send a message in the group</li>
                              <li>
                                Use{" "}
                                <code className="bg-background px-1 py-0.5 rounded text-xs">
                                  @userinfobot
                                </code>{" "}
                                in the group to get the group ID
                              </li>
                              <li className="text-xs text-muted-foreground mt-1">
                                Note: Group IDs are negative numbers (e.g.,{" "}
                                <code className="bg-background px-1 py-0.5 rounded text-xs">
                                  -1001234567890
                                </code>
                                )
                              </li>
                            </ol>
                          </div>
                        </div>
                        <div>
                          <strong>Option 2: Use Dynamic Chat ID (With Telegram Trigger)</strong>
                          <p className="mt-1">
                            If you have a Telegram Trigger node in your workflow, you can use the
                            chat ID from the incoming message:
                            <br />
                            <code className="bg-background px-1 py-0.5 rounded text-xs">
                              {"{{telegram.chat.id}}"}
                            </code>
                            <br />
                            <span className="text-xs">
                              This allows you to automatically reply to the sender.
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Hello! This is a Telegram message."
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      The message to send. Supports HTML formatting. Use {"{{variables}}"} for
                      simple values or {`{"{{{json variables}.response}}"}`} to stringify objects.
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
                  "Save Configuration"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
