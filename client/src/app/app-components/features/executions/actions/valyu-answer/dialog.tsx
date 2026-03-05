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
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";
import { z } from "zod";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message: "Must start with a letter/underscore, alphanumeric only",
    }),
  credentialId: z.string().min(1, { message: "VALYU credential ID is required" }),
  query: z.string().min(1, { message: "Query is required" }),
  searchType: z.enum(["all", "web", "proprietary"]),
  maxNumResults: z.coerce.number().min(1).max(100).optional(),
});

export type ValyuAnswerFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ValyuAnswerFormValues) => void;
  defaultValues?: Partial<ValyuAnswerFormValues>;
}

export const ValyuAnswerDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.VALYU);
  const valyuCredentials = credentialsData?.credentials || [];
  const form = useForm<ValyuAnswerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "valyuAnswer",
      credentialId: defaultValues.credentialId || "",
      query: defaultValues.query || "",
      searchType: defaultValues.searchType || "all",
      maxNumResults: defaultValues.maxNumResults ?? 10,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "valyuAnswer",
        credentialId: defaultValues.credentialId || "",
        query: defaultValues.query || "",
        searchType: defaultValues.searchType || "all",
        maxNumResults: defaultValues.maxNumResults ?? 10,
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "valyuAnswer";

  const handleSubmit = async (values: ValyuAnswerFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Valyu Answer node configured");
      form.reset();
    } catch {
      // handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Valyu Answer</DialogTitle>
          <DialogDescription>Generate AI-powered answers with integrated search.</DialogDescription>
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
                      <Input {...field} placeholder="valyuAnswer" />
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
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Query</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter your question"
                        className="min-h-[100px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>The question to answer with AI and search.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="searchType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "all"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select search type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                        <SelectItem value="proprietary">Proprietary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Type of sources to search.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxNumResults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Results</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={field.value ?? 10}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? 10 : Number(v));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of results to return (optional, default 10).
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
