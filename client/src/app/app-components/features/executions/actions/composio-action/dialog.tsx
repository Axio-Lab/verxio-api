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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  composioActionName: z.string().min(1, { message: "Composio action name is required" }),
  composioParamsText: z
    .string()
    .min(1, { message: "Action params JSON is required" })
    .refine((value) => {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "Must be a valid JSON object"),
});

export type ComposioActionFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    variables: string;
    composioActionName: string;
    composioParams: Record<string, unknown>;
    label: string;
  }) => void;
  defaultValues?: {
    variables?: string;
    composioActionName?: string;
    composioParams?: Record<string, unknown>;
    label?: string;
  };
}

export const ComposioActionDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<ComposioActionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "composioAction",
      composioActionName: defaultValues.composioActionName || "",
      composioParamsText: JSON.stringify(defaultValues.composioParams || {}, null, 2),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "composioAction",
        composioActionName: defaultValues.composioActionName || "",
        composioParamsText: JSON.stringify(defaultValues.composioParams || {}, null, 2),
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "composioAction";

  const handleSubmit = async (values: ComposioActionFormValues) => {
    const params = JSON.parse(values.composioParamsText) as Record<string, unknown>;

    await Promise.resolve(
      onSubmit({
        variables: values.variables,
        composioActionName: values.composioActionName.trim(),
        composioParams: params,
        label: "Composio Action",
      })
    );

    onOpenChange(false);
    toast.success("Composio Action node configured");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Composio Action</DialogTitle>
          <DialogDescription>
            Configure any Composio action (GitHub, Notion, Linear, Jira, HubSpot, and more).
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
                      <Input {...field} placeholder="composioAction" />
                    </FormControl>
                    <FormDescription>
                      Output variable for templates in later nodes:
                      <br />
                      <code className="text-xs">{`{{${watchVariables}.result}}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="composioActionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Composio Action Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="GITHUB_CREATE_ISSUE" />
                    </FormControl>
                    <FormDescription>
                      Use the exact Composio action ID, e.g.{" "}
                      <code className="text-xs">NOTION_CREATE_PAGE</code>,{" "}
                      <code className="text-xs">GITHUB_CREATE_ISSUE</code>.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="composioParamsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action Params (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[180px] font-mono text-sm"
                        placeholder={`{\n  "title": "Bug report",\n  "body": "Created from Verxio",\n  "repo": "owner/repo"\n}`}
                      />
                    </FormControl>
                    <FormDescription>
                      Valid JSON object. Supports templates like{" "}
                      <code className="text-xs">{`{{previousNode.field}}`}</code> in string values.
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
