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

  action: z.enum([
    "readRange",
    "writeRange",
    "appendRow",
    "updateCells",
    "clearRange",
    "createSheet",
    "createSpreadsheet",
  ]),
  spreadsheetId: z.string().optional(),
  sheetName: z.string().optional(),
  range: z.string().optional(),
  values: z.string().optional(),
  title: z.string().optional(),
  sheetTitle: z.string().optional(),
});

export type GoogleSheetsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleSheetsFormValues) => void;
  defaultValues?: Partial<GoogleSheetsFormValues>;
}

export const GoogleSheetsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<GoogleSheetsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleSheets",
      action: defaultValues.action || "readRange",
      spreadsheetId: defaultValues.spreadsheetId || "",
      sheetName: defaultValues.sheetName || "",
      range: defaultValues.range || "",
      values: defaultValues.values || "",
      title: defaultValues.title || "",
      sheetTitle: defaultValues.sheetTitle || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleSheets",
        action: defaultValues.action || "readRange",
        spreadsheetId: defaultValues.spreadsheetId || "",
        sheetName: defaultValues.sheetName || "",
        range: defaultValues.range || "",
        values: defaultValues.values || "",
        title: defaultValues.title || "",
        sheetTitle: defaultValues.sheetTitle || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleSheets";

  const handleSubmit = async (values: GoogleSheetsFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Sheets node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Sheets</DialogTitle>
          <DialogDescription>Configure the Google Sheets action.</DialogDescription>
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
                      <Input {...field} placeholder="googleSheets" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.values}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Google Account Connection</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Connect your Google account to use Google Sheets. Uses env-based OAuth
                  credentials.
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
                        <SelectItem value="createSpreadsheet">Create New Spreadsheet</SelectItem>
                        <SelectItem value="readRange">Read Range</SelectItem>
                        <SelectItem value="writeRange">Write Range</SelectItem>
                        <SelectItem value="appendRow">Append Row</SelectItem>
                        <SelectItem value="updateCells">Update Cells</SelectItem>
                        <SelectItem value="clearRange">Clear Range</SelectItem>
                        <SelectItem value="createSheet">Create Sheet Tab</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the action to perform on Google Sheets.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Create Spreadsheet */}
              {watchAction === "createSpreadsheet" && (
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spreadsheet Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Spreadsheet or {{variables.title}}" />
                      </FormControl>
                      <FormDescription>
                        Title of the new spreadsheet. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Read/Write/Update/Clear Range */}
              {(watchAction === "readRange" ||
                watchAction === "writeRange" ||
                watchAction === "updateCells" ||
                watchAction === "clearRange") && (
                <>
                  <FormField
                    control={form.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spreadsheet ID *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Spreadsheet ID or {{variables.spreadsheetId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ID of the spreadsheet. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="range"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Range *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Sheet1!A1:B10 or {{variables.range}}" />
                        </FormControl>
                        <FormDescription>
                          Range in A1 notation (e.g., Sheet1!A1:B10). Use {"{{variables}}"} for
                          dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(watchAction === "writeRange" || watchAction === "updateCells") && (
                    <FormField
                      control={form.control}
                      name="values"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Values *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder='[["Name", "Age"], ["John", "30"]]'
                              className="min-h-[120px] font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>
                            JSON array of arrays (rows and columns). Use {"{{variables}}"} for
                            dynamic values.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* Append Row */}
              {watchAction === "appendRow" && (
                <>
                  <FormField
                    control={form.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spreadsheet ID *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Spreadsheet ID or {{variables.spreadsheetId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ID of the spreadsheet. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="range"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Range *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Sheet1!A1" />
                        </FormControl>
                        <FormDescription>
                          Range where to append (e.g., Sheet1!A1). Use {"{{variables}}"} for dynamic
                          values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="values"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Row Values *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder='[["John", "30", "Engineer"]]'
                            className="min-h-[80px] font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          JSON array of arrays (one row). Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Create Sheet */}
              {watchAction === "createSheet" && (
                <>
                  <FormField
                    control={form.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spreadsheet ID *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Spreadsheet ID or {{variables.spreadsheetId}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ID of the spreadsheet. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sheetTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sheet Title *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="New Sheet or {{variables.sheetTitle}}" />
                        </FormControl>
                        <FormDescription>
                          Title of the new sheet tab. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
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
