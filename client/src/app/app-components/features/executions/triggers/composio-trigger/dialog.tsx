"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ComposioConnectionStatus } from "../../components/composio-connection-status";
import { useComposioConnectedAccounts } from "@/hooks/useComposioConnections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  composioTriggerSlug: z.string().min(1, { message: "Trigger slug is required" }),
  triggerConfigText: z
    .string()
    .min(1, { message: "Trigger config JSON is required" })
    .refine((value) => {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "Must be a valid JSON object"),
  connectedAccountId: z.string().optional(),
  enabled: z.boolean(),
});

export type ComposioTriggerFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    variables: string;
    composioTriggerSlug: string;
    triggerConfig: Record<string, unknown>;
    connectedAccountId?: string;
    enabled: boolean;
    label: string;
  }) => void;
  defaultValues?: {
    variables?: string;
    composioTriggerSlug?: string;
    triggerConfig?: Record<string, unknown>;
    connectedAccountId?: string;
    enabled?: boolean;
    composioTriggerStatus?: string;
    composioTriggerError?: string;
    composioLastSyncedAt?: string;
  };
}

export const ComposioTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<ComposioTriggerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "composioTrigger",
      composioTriggerSlug: defaultValues.composioTriggerSlug || "",
      triggerConfigText: JSON.stringify(defaultValues.triggerConfig || {}, null, 2),
      connectedAccountId: defaultValues.connectedAccountId || "",
      enabled: defaultValues.enabled !== false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "composioTrigger",
        composioTriggerSlug: defaultValues.composioTriggerSlug || "",
        triggerConfigText: JSON.stringify(defaultValues.triggerConfig || {}, null, 2),
        connectedAccountId: defaultValues.connectedAccountId || "",
        enabled: defaultValues.enabled !== false,
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "composioTrigger";
  const watchSlug = form.watch("composioTriggerSlug") || "";
  const appPrefix = useMemo(() => {
    const slug = watchSlug.trim().toUpperCase();
    return slug.includes("_") ? slug.split("_")[0] : undefined;
  }, [watchSlug]);
  const { data: accountsData } = useComposioConnectedAccounts();
  const connectedAccounts = accountsData?.accounts || [];
  const status = defaultValues.composioTriggerStatus || "provisioning";

  const handleSubmit = async (values: ComposioTriggerFormValues) => {
    const parsedConfig = JSON.parse(values.triggerConfigText) as Record<string, unknown>;

    await Promise.resolve(
      onSubmit({
        variables: values.variables,
        composioTriggerSlug: values.composioTriggerSlug.trim(),
        triggerConfig: parsedConfig,
        connectedAccountId: values.connectedAccountId?.trim() || undefined,
        enabled: values.enabled,
        label: "Composio Trigger",
      })
    );

    onOpenChange(false);
    toast.success("Composio Trigger configured");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Composio Trigger</DialogTitle>
          <DialogDescription>
            Configure an app event trigger such as <code>SLACK_CHANNEL_CREATED</code> or{" "}
            <code>GITHUB_COMMIT_EVENT</code>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <ComposioConnectionStatus appPrefix={appPrefix} />

              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="font-medium">Provisioning status: {status}</div>
                {defaultValues.composioLastSyncedAt ? (
                  <div className="text-muted-foreground mt-1">
                    Last synced: {new Date(defaultValues.composioLastSyncedAt).toLocaleString()}
                  </div>
                ) : null}
                {defaultValues.composioTriggerError ? (
                  <div className="text-red-600 mt-2">{defaultValues.composioTriggerError}</div>
                ) : null}
              </div>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable Trigger</FormLabel>
                      <FormDescription>
                        Disabled triggers will not fire events into this workflow.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="composioTrigger" />
                    </FormControl>
                    <FormDescription>
                      Use in downstream nodes as <code>{`{{${watchVariables}.event}}`}</code>.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="composioTriggerSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="SLACK_CHANNEL_CREATED" />
                    </FormControl>
                    <FormDescription>Exact Composio trigger slug to subscribe to.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="triggerConfigText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Config (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[160px] font-mono text-sm"
                        placeholder={`{\n  "channel_id": "C123456",\n  "workspace_id": "T123456"\n}`}
                      />
                    </FormControl>
                    <FormDescription>
                      Trigger-specific config. Use valid JSON object.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="connectedAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connected Account (Optional)</FormLabel>
                    <FormControl>
                      {connectedAccounts.length > 0 ? (
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) =>
                            field.onChange(value === "__none__" ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Auto (most recent account)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Auto (most recent account)</SelectItem>
                            {connectedAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <span className="capitalize">{account.appSlug}</span>{" "}
                                <span className="text-muted-foreground">
                                  ({account.id.slice(0, 12)}...)
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input {...field} placeholder="ca_..." />
                      )}
                    </FormControl>
                    <FormDescription>
                      Optional. If omitted, Composio uses the most recent account for the app.
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
