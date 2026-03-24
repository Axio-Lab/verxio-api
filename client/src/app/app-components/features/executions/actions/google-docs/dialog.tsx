"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod/v3";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
import { GoogleOAuthConnection } from "../../components/google-oauth-connection";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),

  action: z.enum(["createDocument", "readDocument", "insertText", "updateText", "exportDocument"]),
  title: z.string().optional(),
  documentId: z.string().optional(),
  text: z.string().optional(),
  index: z.number().optional(),
  mimeType: z.string().optional(),
});

export type GoogleDocsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleDocsFormValues) => void;
  defaultValues?: Partial<GoogleDocsFormValues>;
}

export const GoogleDocsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<GoogleDocsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleDocs",
      action: defaultValues.action || "createDocument",
      title: defaultValues.title || "",
      documentId: defaultValues.documentId || "",
      text: defaultValues.text || "",
      index: defaultValues.index || 1,
      mimeType: defaultValues.mimeType || "application/pdf",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleDocs",
        action: defaultValues.action || "createDocument",
        title: defaultValues.title || "",
        documentId: defaultValues.documentId || "",
        text: defaultValues.text || "",
        index: defaultValues.index || 1,
        mimeType: defaultValues.mimeType || "application/pdf",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleDocs";

  const handleSubmit = async (values: GoogleDocsFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Docs node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Docs</DialogTitle>
          <DialogDescription>Configure the Google Docs action.</DialogDescription>
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
                      <Input {...field} placeholder="googleDocs" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.documentId}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Google Account Connection</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Connect your Google account to use Google Docs. Uses env-based OAuth credentials.
                </p>
                <div className="mt-2">
                  <GoogleOAuthConnection />
                </div>
              </div>

              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="createDocument">Create Document</SelectItem>
                        <SelectItem value="readDocument">Read Document</SelectItem>
                        <SelectItem value="insertText">Insert Text</SelectItem>
                        <SelectItem value="updateText">Update Text</SelectItem>
                        <SelectItem value="exportDocument">Export Document</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform on Google Docs.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Create Document */}
              {watchAction === "createDocument" && (
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Document or {{variables.title}}" />
                      </FormControl>
                      <FormDescription>
                        Title of the new document. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Read/Insert/Update/Export Document */}
              {(watchAction === "readDocument" ||
                watchAction === "insertText" ||
                watchAction === "updateText" ||
                watchAction === "exportDocument") && (
                <FormField
                  control={form.control}
                  name="documentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Document ID or {{variables.documentId}}" />
                      </FormControl>
                      <FormDescription>
                        ID of the document. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Insert/Update Text */}
              {(watchAction === "insertText" || watchAction === "updateText") && (
                <>
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Text to insert/update or {{variables.text}}"
                            className="min-h-[120px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Text to insert or update. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="index"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Index</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            value={field.value || 1}
                          />
                        </FormControl>
                        <FormDescription>
                          Character index where to insert/update (default: 1).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Export Document */}
              {watchAction === "exportDocument" && (
                <FormField
                  control={form.control}
                  name="mimeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Export Format</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select export format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="application/pdf">PDF</SelectItem>
                          <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                            Word (DOCX)
                          </SelectItem>
                          <SelectItem value="text/plain">Plain Text</SelectItem>
                          <SelectItem value="text/html">HTML</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Format to export the document.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
