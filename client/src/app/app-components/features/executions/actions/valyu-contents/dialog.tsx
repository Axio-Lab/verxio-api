"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";
import { z } from "zod/v3";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message: "Must start with a letter/underscore, alphanumeric only",
    }),
  credentialId: z.string().min(1, { message: "VALYU credential ID is required" }),
  urls: z.string().min(1, { message: "URLs are required" }),
  summary: z.boolean().optional(),
  extractEffort: z.enum(["normal", "high", "auto"]),
});

export type ValyuContentsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ValyuContentsFormValues) => void;
  defaultValues?: Partial<ValyuContentsFormValues>;
}

export const ValyuContentsDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.VALYU);
  const valyuCredentials = credentialsData?.credentials || [];
  const form = useForm<ValyuContentsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "valyuContents",
      credentialId: defaultValues.credentialId || "",
      urls: defaultValues.urls || "",
      summary: defaultValues.summary ?? false,
      extractEffort: defaultValues.extractEffort || "normal",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "valyuContents",
        credentialId: defaultValues.credentialId || "",
        urls: defaultValues.urls || "",
        summary: defaultValues.summary ?? false,
        extractEffort: defaultValues.extractEffort || "normal",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "valyuContents";

  const handleSubmit = async (values: ValyuContentsFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Valyu Contents node configured");
      form.reset();
    } catch {
      // handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Valyu Contents</DialogTitle>
          <DialogDescription>Extract and process content from URLs with AI.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output Variable</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="valyuContents" />
                    </FormControl>
                    <FormDescription>
                      Reference results in other nodes:
                      <br />
                      <code>{`{{${watchVariables}.result}}`}</code>
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
                    <FormLabel>Valyu Credential</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value || "")}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a credential" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {valyuCredentials.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No Valyu credentials found. Create one in Credentials.
                          </div>
                        ) : (
                          <>
                            {valyuCredentials.map((credential) => (
                              <SelectItem key={credential.id} value={credential.id}>
                                {credential.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>Required credential for Valyu API access.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="urls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URLs</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="One URL per line or JSON array of URLs"
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter URLs to extract content from. One per line or as a JSON array.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Summary</FormLabel>
                      <FormDescription>Generate a summary of extracted content.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="extractEffort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Extract Effort</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "normal"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select effort level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Effort level for content extraction.</FormDescription>
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
