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

  action: z.enum([
    "sendEmail",
    "sendEmailWithAttachment",
    "listEmails",
    "getEmail",
    "createDraft",
    "sendDraft",
    "replyToEmail",
    "forwardEmail",
    "deleteEmail",
    "addLabel",
  ]),
  // Send Email
  to: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  isHtml: z.boolean().optional(),
  // Send Email With Attachment
  attachmentUrl: z.string().optional(),
  attachmentDriveFileId: z.string().optional(),
  attachmentName: z.string().optional(),
  // List Emails
  query: z.string().optional(),
  maxResults: z.string().optional(),
  // Get Email / Reply / Forward / Delete
  emailId: z.string().optional(),
  // Create Draft
  draftId: z.string().optional(), // For sendDraft
  // Reply To Email
  replyAll: z.boolean().optional(),
  // Forward Email
  forwardTo: z.string().optional(),
  // Add Label
  labelId: z.string().optional(),
  labelName: z.string().optional(),
});

export type GmailFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GmailFormValues) => void;
  defaultValues?: Partial<GmailFormValues>;
}

export const GmailDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<GmailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "gmail",
      action: defaultValues.action || "sendEmail",
      to: defaultValues.to || "",
      cc: defaultValues.cc || "",
      bcc: defaultValues.bcc || "",
      subject: defaultValues.subject || "",
      body: defaultValues.body || "",
      isHtml: defaultValues.isHtml || false,
      attachmentUrl: defaultValues.attachmentUrl || "",
      attachmentDriveFileId: defaultValues.attachmentDriveFileId || "",
      attachmentName: defaultValues.attachmentName || "",
      query: defaultValues.query || "",
      maxResults: defaultValues.maxResults || "10",
      emailId: defaultValues.emailId || "",
      draftId: defaultValues.draftId || "",
      replyAll: defaultValues.replyAll || false,
      forwardTo: defaultValues.forwardTo || "",
      labelId: defaultValues.labelId || "",
      labelName: defaultValues.labelName || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "gmail",
        action: defaultValues.action || "sendEmail",
        to: defaultValues.to || "",
        cc: defaultValues.cc || "",
        bcc: defaultValues.bcc || "",
        subject: defaultValues.subject || "",
        body: defaultValues.body || "",
        isHtml: defaultValues.isHtml || false,
        attachmentUrl: defaultValues.attachmentUrl || "",
        attachmentDriveFileId: defaultValues.attachmentDriveFileId || "",
        attachmentName: defaultValues.attachmentName || "",
        query: defaultValues.query || "",
        maxResults: defaultValues.maxResults || "10",
        emailId: defaultValues.emailId || "",
        draftId: defaultValues.draftId || "",
        replyAll: defaultValues.replyAll || false,
        forwardTo: defaultValues.forwardTo || "",
        labelId: defaultValues.labelId || "",
        labelName: defaultValues.labelName || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "gmail";

  const handleSubmit = async (values: GmailFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Gmail node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Gmail</DialogTitle>
          <DialogDescription>Configure the Gmail action.</DialogDescription>
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
                      <Input {...field} placeholder="gmail" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.id}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Google Account Connection</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Connect your Google account to use Gmail. Uses env-based OAuth credentials.
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
                        <SelectItem value="sendEmail">Send Email</SelectItem>
                        <SelectItem value="sendEmailWithAttachment">
                          Send Email with Attachment
                        </SelectItem>
                        <SelectItem value="listEmails">List Emails</SelectItem>
                        <SelectItem value="getEmail">Get Email</SelectItem>
                        <SelectItem value="createDraft">Create Draft</SelectItem>
                        <SelectItem value="sendDraft">Send Draft</SelectItem>
                        <SelectItem value="replyToEmail">Reply to Email</SelectItem>
                        <SelectItem value="forwardEmail">Forward Email</SelectItem>
                        <SelectItem value="deleteEmail">Delete Email</SelectItem>
                        <SelectItem value="addLabel">Add Label</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform with Gmail.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Send Email / Send Email With Attachment / Create Draft */}
              {(watchAction === "sendEmail" ||
                watchAction === "sendEmailWithAttachment" ||
                watchAction === "createDraft") && (
                <>
                  <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="recipient@example.com or {{variables.email}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Recipient email address(es), comma-separated. Use {"{{variables}}"} for
                          dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CC</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="cc@example.com or {{variables.cc}}" />
                        </FormControl>
                        <FormDescription>
                          CC email address(es), comma-separated. Use {"{{variables}}"} for dynamic
                          values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bcc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BCC</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="bcc@example.com or {{variables.bcc}}" />
                        </FormControl>
                        <FormDescription>
                          BCC email address(es), comma-separated. Use {"{{variables}}"} for dynamic
                          values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Email subject or {{variables.subject}}" />
                        </FormControl>
                        <FormDescription>
                          Email subject. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Email body or {{variables.body}}"
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Email body. Use {"{{variables}}"} for dynamic values. HTML is supported if
                          "Is HTML" is enabled.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isHtml"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Is HTML</FormLabel>
                          <FormDescription>
                            Enable if the email body contains HTML formatting.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Send Email With Attachment */}
              {watchAction === "sendEmailWithAttachment" && (
                <>
                  <FormField
                    control={form.control}
                    name="attachmentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attachment URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://example.com/file.pdf or {{variables.fileUrl}}"
                          />
                        </FormControl>
                        <FormDescription>
                          URL of the file to attach. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm text-muted-foreground text-center">OR</div>
                  <FormField
                    control={form.control}
                    name="attachmentDriveFileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drive File ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Drive file ID or {{variables.fileId}}" />
                        </FormControl>
                        <FormDescription>
                          Google Drive file ID. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="attachmentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attachment Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="document.pdf or {{variables.fileName}}" />
                        </FormControl>
                        <FormDescription>
                          Name of the attachment file. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* List Emails */}
              {watchAction === "listEmails" && (
                <>
                  <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Search Query</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="from:example@email.com or {{variables.query}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Gmail search query (e.g., "from:example@email.com", "subject:test"). Use{" "}
                          {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxResults"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Results</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="10" type="number" />
                        </FormControl>
                        <FormDescription>Maximum number of emails to return.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Get Email / Reply / Forward / Delete */}
              {(watchAction === "getEmail" ||
                watchAction === "replyToEmail" ||
                watchAction === "forwardEmail" ||
                watchAction === "deleteEmail") && (
                <FormField
                  control={form.control}
                  name="emailId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Email ID or {{variables.emailId}}" />
                      </FormControl>
                      <FormDescription>
                        ID of the email. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Send Draft */}
              {watchAction === "sendDraft" && (
                <FormField
                  control={form.control}
                  name="draftId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Draft ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Draft ID or {{variables.draftId}}" />
                      </FormControl>
                      <FormDescription>
                        ID of the draft to send. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Reply To Email */}
              {watchAction === "replyToEmail" && (
                <>
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply Body *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Reply text or {{variables.replyBody}}"
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Reply text. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="replyAll"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Reply All</FormLabel>
                          <FormDescription>Enable to reply to all recipients.</FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Forward Email */}
              {watchAction === "forwardEmail" && (
                <FormField
                  control={form.control}
                  name="forwardTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forward To *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="recipient@example.com or {{variables.email}}"
                        />
                      </FormControl>
                      <FormDescription>
                        Recipient email address(es), comma-separated. Use {"{{variables}}"} for
                        dynamic values.
                      </FormDescription>
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
