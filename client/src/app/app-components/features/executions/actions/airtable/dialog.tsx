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
  credentialId: z.string().min(1, { message: "Airtable credential is required" }),
  action: z.enum([
    "listBases",
    "listTables",
    "listFields",
    "getRecords",
    "getRecord",
    "createRecord",
    "updateRecord",
    "deleteRecord",
  ]),
  // Base and Table
  baseId: z.string().optional(),
  tableId: z.string().optional(),
  // Get Records
  maxRecords: z.string().optional(),
  view: z.string().optional(),
  filterByFormula: z.string().optional(),
  sort: z.string().optional(),
  fields: z.string().optional(),
  // Get Record / Update / Delete
  recordId: z.string().optional(),
  // Create / Update Record
  fieldsData: z.string().optional(),
});

export type AirtableFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AirtableFormValues) => void;
  defaultValues?: Partial<AirtableFormValues>;
}

export const AirtableDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  // Fetch all credentials and filter for AIRTABLE type
  const { data: credentialsData } = useCredentials(1, 100);
  const airtableCredentials =
    credentialsData?.credentials?.filter((cred) => cred.type === CredentialType.AIRTABLE) || [];

  const form = useForm<AirtableFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "airtable",
      credentialId: defaultValues.credentialId || "",
      action: defaultValues.action || "listBases",
      baseId: defaultValues.baseId || "",
      tableId: defaultValues.tableId || "",
      maxRecords: defaultValues.maxRecords || "100",
      view: defaultValues.view || "",
      filterByFormula: defaultValues.filterByFormula || "",
      sort: defaultValues.sort || "",
      fields: defaultValues.fields || "",
      recordId: defaultValues.recordId || "",
      fieldsData: defaultValues.fieldsData || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "airtable",
        credentialId: defaultValues.credentialId || "",
        action: defaultValues.action || "listBases",
        baseId: defaultValues.baseId || "",
        tableId: defaultValues.tableId || "",
        maxRecords: defaultValues.maxRecords || "100",
        view: defaultValues.view || "",
        filterByFormula: defaultValues.filterByFormula || "",
        sort: defaultValues.sort || "",
        fields: defaultValues.fields || "",
        recordId: defaultValues.recordId || "",
        fieldsData: defaultValues.fieldsData || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");

  const handleSubmit = (values: AirtableFormValues) => {
    onSubmit(values);
    onOpenChange(false);
    toast.success("Airtable node configured");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configure Airtable Node</DialogTitle>
          <DialogDescription>
            Connect to Airtable and perform operations on your bases, tables, and records.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input placeholder="airtable" {...field} />
                    </FormControl>
                    <FormDescription>
                      The variable name to store the result in. Use this in other nodes to reference
                      the output.
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
                    <FormLabel>Airtable Credential</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an Airtable credential" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {airtableCredentials.length === 0 ? (
                          <SelectItem value="" disabled>
                            No Airtable credentials found. Create one in Credentials.
                          </SelectItem>
                        ) : (
                          airtableCredentials.map((cred) => (
                            <SelectItem key={cred.id} value={cred.id}>
                              {cred.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select an Airtable credential to use or create a new one in Credentials.
                    </FormDescription>
                    <FormMessage />
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="listBases">List Bases</SelectItem>
                        <SelectItem value="listTables">List Tables</SelectItem>
                        <SelectItem value="listFields">List Fields</SelectItem>
                        <SelectItem value="getRecords">Get Records</SelectItem>
                        <SelectItem value="getRecord">Get Record</SelectItem>
                        <SelectItem value="createRecord">Create Record</SelectItem>
                        <SelectItem value="updateRecord">Update Record</SelectItem>
                        <SelectItem value="deleteRecord">Delete Record</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Base ID - Required for most actions */}
              {(watchAction === "listTables" ||
                watchAction === "listFields" ||
                watchAction === "getRecords" ||
                watchAction === "getRecord" ||
                watchAction === "createRecord" ||
                watchAction === "updateRecord" ||
                watchAction === "deleteRecord") && (
                <FormField
                  control={form.control}
                  name="baseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base ID</FormLabel>
                      <FormControl>
                        <Input placeholder="appXXXXXXXXXXXXXX" {...field} />
                      </FormControl>
                      <FormDescription>
                        The Airtable Base ID. You can find this in your base URL or by listing
                        bases.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Table ID - Required for table operations */}
              {(watchAction === "listFields" ||
                watchAction === "getRecords" ||
                watchAction === "getRecord" ||
                watchAction === "createRecord" ||
                watchAction === "updateRecord" ||
                watchAction === "deleteRecord") && (
                <FormField
                  control={form.control}
                  name="tableId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table ID or Name</FormLabel>
                      <FormControl>
                        <Input placeholder="tblXXXXXXXXXXXXXX or Table Name" {...field} />
                      </FormControl>
                      <FormDescription>
                        The Airtable Table ID or name. You can find this by listing tables in a
                        base.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Get Records Options */}
              {watchAction === "getRecords" && (
                <>
                  <FormField
                    control={form.control}
                    name="maxRecords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Records</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="100" {...field} />
                        </FormControl>
                        <FormDescription>
                          Maximum number of records to return (default: 100, max: 100).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="view"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>View</FormLabel>
                        <FormControl>
                          <Input placeholder="Grid view" {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional: The name or ID of a view to filter records.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filterByFormula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filter By Formula</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., {Status} = "Active"' {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional: A formula used to filter records. See Airtable formula
                          reference.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"field": "Name", "direction": "asc"}]'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: JSON array of sort objects. Example: {"{"}"field": "Name",
                          "direction": "asc"{"}"}.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fields"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fields (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="Name, Email, Status" {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional: Comma-separated list of field names to return. If omitted, all
                          fields are returned.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Record ID - Required for get/update/delete */}
              {(watchAction === "getRecord" ||
                watchAction === "updateRecord" ||
                watchAction === "deleteRecord") && (
                <FormField
                  control={form.control}
                  name="recordId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Record ID</FormLabel>
                      <FormControl>
                        <Input placeholder="recXXXXXXXXXXXXXX" {...field} />
                      </FormControl>
                      <FormDescription>
                        The Airtable Record ID. You can find this by getting records from a table.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Fields Data - Required for create/update */}
              {(watchAction === "createRecord" || watchAction === "updateRecord") && (
                <FormField
                  control={form.control}
                  name="fieldsData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fields Data (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"Name": "John Doe", "Email": "john@example.com"}'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON object with field names as keys and values. Example: {"{"}"Name": "John
                        Doe", "Email": "john@example.com"{"}"}. You can use Handlebars templates
                        like {"{"}
                        {"{"}previousNode.output.name{"}"}
                        {"}"}.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
