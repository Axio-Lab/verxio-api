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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
import { Checkbox } from "@/components/ui/checkbox";

// Dynamically import Monaco editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full flex items-center justify-center">Loading editor...</div>
  ),
});

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  label: z.string().min(1, { message: "Label is required" }),
  code: z.string().min(1, { message: "Code is required" }),
  language: z.enum(["typescript", "javascript"]).default("typescript"),
  dependencies: z.array(z.string()).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  credentialIds: z.array(z.string()).optional(),
});

export type CodeBlockFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CodeBlockFormValues) => void;
  defaultValues?: Partial<CodeBlockFormValues>;
}

export const CodeBlockDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  // Fetch custom credentials for selection
  const { data: credentialsData } = useCredentials(1, 100);
  const customCredentials =
    credentialsData?.credentials.filter(
      (cred) => cred.type === CredentialType.CUSTOM || cred.type.toLowerCase() === "custom"
    ) || [];

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "result",
      label: defaultValues.label ?? "Custom Code",
      code: defaultValues.code ?? "",
      language: defaultValues.language ?? "typescript",
      dependencies: defaultValues.dependencies ?? [],
      inputSchema: defaultValues.inputSchema,
      outputSchema: defaultValues.outputSchema,
      credentialIds: (defaultValues.credentialIds as string[]) || [],
    } as CodeBlockFormValues,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "result",
        label: defaultValues.label ?? "Custom Code",
        code: defaultValues.code ?? "",
        language: defaultValues.language ?? "typescript",
        dependencies: defaultValues.dependencies ?? [],
        inputSchema: defaultValues.inputSchema,
        outputSchema: defaultValues.outputSchema,
        credentialIds: (defaultValues.credentialIds as string[]) || [],
      } as CodeBlockFormValues);
    }
  }, [open, defaultValues, form]);

  const watchLanguage = form.watch("language") || "typescript";
  const watchCode = form.watch("code") || "";

  const handleSubmit = async (values: CodeBlockFormValues) => {
    try {
      const processedValues: CodeBlockFormValues = { ...values };

      // Parse dependencies if it's a string (runtime check)
      const dependenciesValue = values.dependencies as unknown;
      if (dependenciesValue && typeof dependenciesValue === "string") {
        try {
          processedValues.dependencies = JSON.parse(dependenciesValue) as string[];
        } catch {
          processedValues.dependencies = [];
        }
      }

      // Parse schemas if they're strings (runtime check)
      const inputSchemaValue = values.inputSchema as unknown;
      if (inputSchemaValue && typeof inputSchemaValue === "string") {
        const inputSchemaStr = inputSchemaValue.trim();
        if (inputSchemaStr) {
          try {
            processedValues.inputSchema = JSON.parse(inputSchemaStr) as Record<string, unknown>;
          } catch {
            // Invalid JSON, leave as is
          }
        }
      }

      const outputSchemaValue = values.outputSchema as unknown;
      if (outputSchemaValue && typeof outputSchemaValue === "string") {
        const outputSchemaStr = outputSchemaValue.trim();
        if (outputSchemaStr) {
          try {
            processedValues.outputSchema = JSON.parse(outputSchemaStr) as Record<string, unknown>;
          } catch {
            // Invalid JSON, leave as is
          }
        }
      }

      await Promise.resolve(onSubmit(processedValues));
      onOpenChange(false);
      toast.success("Code block configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configure Custom Code Block</DialogTitle>
          <DialogDescription>
            Write custom TypeScript/JavaScript code to execute in your workflow. The code will be
            executed in an isolated Daytona sandbox.
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
                      <Input
                        placeholder="result"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.trigger("variables");
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      The variable name to store the result in the workflow context.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Custom Code"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.trigger("label");
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for this code block in the workflow.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="credentialIds"
                render={({ field }) => {
                  const selectedIds = (field.value as string[]) || [];
                  return (
                    <FormItem>
                      <FormLabel>Credentials (Optional)</FormLabel>
                      <FormDescription>
                        Select custom credentials containing API keys needed by this code. Access
                        them via <code className="text-xs">inputs.credentials.CREDENTIAL_NAME</code>
                      </FormDescription>
                      <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                        {customCredentials.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No custom credentials found. Create custom credentials in the
                            Credentials page to use API keys in your code.
                          </p>
                        ) : (
                          customCredentials.map((credential) => (
                            <div key={credential.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`credential-${credential.id}`}
                                checked={selectedIds.includes(credential.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...selectedIds, credential.id]);
                                  } else {
                                    field.onChange(
                                      selectedIds.filter((id) => id !== credential.id)
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={`credential-${credential.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                              >
                                {credential.name}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <div className="border rounded-md overflow-hidden">
                        <MonacoEditor
                          height="400px"
                          language={watchLanguage}
                          value={watchCode}
                          onChange={(value) => {
                            field.onChange(value || "");
                            form.trigger("code");
                          }}
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            roundedSelection: false,
                            scrollBeyondLastLine: false,
                            readOnly: false,
                            automaticLayout: true,
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Write your TypeScript/JavaScript code here. The code should follow the
                      NodeExecutor interface pattern.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="typescript">TypeScript</option>
                        <option value="javascript">JavaScript</option>
                      </select>
                    </FormControl>
                    <FormDescription>The programming language for this code block.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dependencies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dependencies (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='["axios", "lodash"]'
                        value={
                          Array.isArray(field.value)
                            ? JSON.stringify(field.value)
                            : field.value || ""
                        }
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            if (Array.isArray(parsed)) {
                              field.onChange(parsed);
                            } else {
                              field.onChange([]);
                            }
                          } catch {
                            // Invalid JSON, ignore
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON array of npm package names to install (e.g., ["axios", "lodash"]).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex-shrink-0 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
