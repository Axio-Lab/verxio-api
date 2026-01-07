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
import { GoogleOAuthConnection } from "../../components/google-oauth-connection";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().min(1, { message: "Google OAuth credential is required" }),
  action: z.enum([
    "upload",
    "download",
    "list",
    "createFolder",
    "move",
    "copy",
    "delete",
    "share",
    "getMetadata",
  ]),
  // Upload
  fileName: z.string().optional(),
  fileContent: z.string().optional(),
  mimeType: z.string().optional(),
  parentFolderId: z.string().optional(),
  // Download/List/Move/Copy/Delete/Share/GetMetadata
  fileId: z.string().optional(),
  // List
  folderId: z.string().optional(),
  query: z.string().optional(),
  // Move/Copy
  destinationFolderId: z.string().optional(),
  // Share
  email: z.string().optional(),
  role: z.enum(["reader", "writer", "commenter", "owner"]).optional(),
  // Get Metadata
  fields: z.string().optional(),
});

export type GoogleDriveFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleDriveFormValues) => void;
  defaultValues?: Partial<GoogleDriveFormValues>;
}

export const GoogleDriveDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.GOOGLE_OAUTH);
  const googleCredentials = credentialsData?.credentials || [];

  const form = useForm<GoogleDriveFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleDrive",
      credentialId: defaultValues.credentialId || "",
      action: defaultValues.action || "upload",
      fileName: defaultValues.fileName || "",
      fileContent: defaultValues.fileContent || "",
      mimeType: defaultValues.mimeType || "text/plain",
      parentFolderId: defaultValues.parentFolderId || "",
      fileId: defaultValues.fileId || "",
      folderId: defaultValues.folderId || "",
      query: defaultValues.query || "",
      destinationFolderId: defaultValues.destinationFolderId || "",
      email: defaultValues.email || "",
      role: defaultValues.role || "reader",
      fields: defaultValues.fields || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleDrive",
        credentialId: defaultValues.credentialId || "",
        action: defaultValues.action || "upload",
        fileName: defaultValues.fileName || "",
        fileContent: defaultValues.fileContent || "",
        mimeType: defaultValues.mimeType || "text/plain",
        parentFolderId: defaultValues.parentFolderId || "",
        fileId: defaultValues.fileId || "",
        folderId: defaultValues.folderId || "",
        query: defaultValues.query || "",
        destinationFolderId: defaultValues.destinationFolderId || "",
        email: defaultValues.email || "",
        role: defaultValues.role || "reader",
        fields: defaultValues.fields || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleDrive";

  const handleSubmit = async (values: GoogleDriveFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Drive node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Drive</DialogTitle>
          <DialogDescription>Configure the Google Drive action.</DialogDescription>
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
                      <Input {...field} placeholder="googleDrive" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.fileId}}"}`}</code>
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
                    <FormLabel>Google OAuth Credential</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Google OAuth credential" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {googleCredentials.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No Google OAuth credentials found. Please add one in the Credentials
                            page.
                          </div>
                        ) : (
                          googleCredentials.map((credential) => (
                            <SelectItem key={credential.id} value={credential.id}>
                              {credential.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the Google OAuth credential with Drive API access.
                    </FormDescription>
                    <FormMessage />
                    <div className="mt-2">
                      <GoogleOAuthConnection credentialId={field.value} />
                    </div>
                  </FormItem>
                )}
              />

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
                        <SelectItem value="upload">Upload File</SelectItem>
                        <SelectItem value="download">Download File</SelectItem>
                        <SelectItem value="list">List Files</SelectItem>
                        <SelectItem value="createFolder">Create Folder</SelectItem>
                        <SelectItem value="move">Move File</SelectItem>
                        <SelectItem value="copy">Copy File</SelectItem>
                        <SelectItem value="delete">Delete File</SelectItem>
                        <SelectItem value="share">Share File</SelectItem>
                        <SelectItem value="getMetadata">Get File Metadata</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform on Google Drive.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Upload Fields */}
              {watchAction === "upload" && (
                <>
                  <FormField
                    control={form.control}
                    name="fileName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>File Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="document.txt or {{variables.name}}" />
                        </FormControl>
                        <FormDescription>
                          Name of the file to upload. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fileContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>File Content *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="File content or {{variables.content}}"
                            className="min-h-[120px] font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Content of the file. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mimeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MIME Type</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="text/plain" />
                        </FormControl>
                        <FormDescription>
                          MIME type of the file (e.g., text/plain, application/json, image/png).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parentFolderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Folder ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Optional: folder ID or {{variables.folderId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: ID of the parent folder. Leave empty for root.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Download/Delete/GetMetadata Fields */}
              {(watchAction === "download" ||
                watchAction === "delete" ||
                watchAction === "getMetadata") && (
                <FormField
                  control={form.control}
                  name="fileId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="File ID or {{variables.fileId}}" />
                      </FormControl>
                      <FormDescription>
                        ID of the file. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* List Fields */}
              {watchAction === "list" && (
                <>
                  <FormField
                    control={form.control}
                    name="folderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folder ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Optional: folder ID or {{variables.folderId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: List files in a specific folder. Leave empty for root.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Query</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional: name contains 'report'" />
                        </FormControl>
                        <FormDescription>
                          Optional: Search query (e.g., "name contains 'report'",
                          "mimeType='application/pdf'").
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Create Folder Fields */}
              {watchAction === "createFolder" && (
                <>
                  <FormField
                    control={form.control}
                    name="fileName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folder Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="My Folder or {{variables.folderName}}" />
                        </FormControl>
                        <FormDescription>
                          Name of the folder to create. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parentFolderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Folder ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Optional: folder ID or {{variables.folderId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: ID of the parent folder. Leave empty for root.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Move/Copy Fields */}
              {(watchAction === "move" || watchAction === "copy") && (
                <>
                  <FormField
                    control={form.control}
                    name="fileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>File ID *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="File ID or {{variables.fileId}}" />
                        </FormControl>
                        <FormDescription>
                          ID of the file to move/copy. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="destinationFolderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination Folder ID *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Folder ID or {{variables.destinationFolderId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ID of the destination folder. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchAction === "copy" && (
                    <FormField
                      control={form.control}
                      name="fileName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New File Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Optional: new name or {{variables.newName}}"
                            />
                          </FormControl>
                          <FormDescription>
                            Optional: New name for the copied file. Leave empty to keep original
                            name.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* Share Fields */}
              {watchAction === "share" && (
                <>
                  <FormField
                    control={form.control}
                    name="fileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>File ID *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="File ID or {{variables.fileId}}" />
                        </FormControl>
                        <FormDescription>
                          ID of the file to share. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="user@example.com or {{variables.email}}" />
                        </FormControl>
                        <FormDescription>
                          Email address of the user to share with. Use {"{{variables}}"} for dynamic
                          values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permission Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="reader">Reader (View only)</SelectItem>
                            <SelectItem value="commenter">Commenter (View and comment)</SelectItem>
                            <SelectItem value="writer">Writer (View, comment, and edit)</SelectItem>
                            <SelectItem value="owner">Owner (Full access)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Permission level for the shared file.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Get Metadata Fields */}
              {watchAction === "getMetadata" && (
                <FormField
                  control={form.control}
                  name="fields"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fields</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="id,name,mimeType,size,webViewLink" />
                      </FormControl>
                      <FormDescription>
                        Optional: Comma-separated list of fields to return. Leave empty for default
                        fields.
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
