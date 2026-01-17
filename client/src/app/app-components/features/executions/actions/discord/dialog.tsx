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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  username: z.string().optional(),
  webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
  message: z
    .string()
    .min(1, { message: "Message content is required" })
    .max(2000, { message: "Discord message content must be less than 2000 characters" }),
});

export type DiscordFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DiscordFormValues) => void;
  defaultValues?: Partial<DiscordFormValues>;
}

export const DiscordDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<DiscordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "discord",
      username: defaultValues.username || "",
      webhookUrl: defaultValues.webhookUrl || "",
      message: defaultValues.message || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "discord",
        username: defaultValues.username || "",
        webhookUrl: defaultValues.webhookUrl || "",
        message: defaultValues.message || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "discord";

  const handleSubmit = async (values: DiscordFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Discord node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Discord Configuration</DialogTitle>
          <DialogDescription>
            Configure the Discord webhook settings for this node.
          </DialogDescription>
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
                      <Input {...field} placeholder="discord" />
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
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://discord.com/api/webhooks/..." />
                    </FormControl>
                    <FormDescription>
                      Get this from Discord: Channel Settings → Integrations → Webhooks
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Username (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Workflow Bot" />
                    </FormControl>
                    <FormDescription>Overrides the webhook's default username.</FormDescription>
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
                        placeholder="Hello! This is a Discord message."
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      The message to send. Use {"{{variables}}"} for simple values or
                      {`{"{{{jsonVariables}.response}}"}`} to stringify objects.
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
