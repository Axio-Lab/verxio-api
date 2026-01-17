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

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  action: z.enum(["listActors", "getActorDetail", "runActor", "getRunStatus", "getDatasetItems"]),
  // listActors options
  my: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  searchQuery: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  // getActorDetail / runActor options
  actorId: z.string().optional(),
  // runActor options
  input: z.string().optional(), // JSON string
  waitForFinish: z.number().optional(),
  // getRunStatus options
  runId: z.string().optional(),
  // getDatasetItems options
  datasetId: z.string().optional(),
  itemsLimit: z.number().optional(),
  itemsOffset: z.number().optional(),
  clean: z.boolean().optional(),
});

export type ApifyFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ApifyFormValues) => void;
  defaultValues?: Partial<ApifyFormValues>;
}

export const ApifyDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "apify",
      action: defaultValues.action ?? "listActors",
      my: defaultValues.my ?? false,
      isPublic: defaultValues.isPublic ?? true,
      searchQuery: defaultValues.searchQuery ?? "",
      limit: defaultValues.limit,
      offset: defaultValues.offset,
      actorId: defaultValues.actorId ?? "",
      input: defaultValues.input ?? "",
      waitForFinish: defaultValues.waitForFinish,
      runId: defaultValues.runId ?? "",
      datasetId: defaultValues.datasetId ?? "",
      itemsLimit: defaultValues.itemsLimit,
      itemsOffset: defaultValues.itemsOffset,
      clean: defaultValues.clean ?? false,
    } as ApifyFormValues,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "apify",
        action: defaultValues.action ?? "listActors",
        my: defaultValues.my ?? false,
        isPublic: defaultValues.isPublic ?? true,
        searchQuery: defaultValues.searchQuery ?? "",
        limit: defaultValues.limit,
        offset: defaultValues.offset,
        actorId: defaultValues.actorId ?? "",
        input: defaultValues.input ?? "",
        waitForFinish: defaultValues.waitForFinish,
        runId: defaultValues.runId ?? "",
        datasetId: defaultValues.datasetId ?? "",
        itemsLimit: defaultValues.itemsLimit,
        itemsOffset: defaultValues.itemsOffset,
        clean: defaultValues.clean ?? false,
      } as ApifyFormValues);
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "apify";

  const handleSubmit = async (values: ApifyFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Apify node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configure Apify Node</DialogTitle>
          <DialogDescription>
            Browse actors, run scrapers, or retrieve results from the Apify platform.
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
                      <Input placeholder="apify" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.actors}}"}`}</code> or{" "}
                      <code>{`{"{{${watchVariables}.items}}"}`}</code> or{" "}
                      <code>{`{"{{${watchVariables}.runId}}"}`}</code>
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
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="listActors">List Actors (Browse/Search)</SelectItem>
                        <SelectItem value="getActorDetail">Get Actor Detail</SelectItem>
                        <SelectItem value="runActor">Run Actor</SelectItem>
                        <SelectItem value="getRunStatus">Get Run Status</SelectItem>
                        <SelectItem value="getDatasetItems">Get Dataset Items (Results)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* listActors specific fields */}
              {watchAction === "listActors" && (
                <>
                  <FormField
                    control={form.control}
                    name="searchQuery"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Search Query (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="tiktok, linkedin, facebook or {{previousNode.searchTerm}}"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Search actors by keyword (e.g., "tiktok", "linkedin"). Supports Handlebars
                          templating.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="my"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.checked);
                                // If "My Actors" is checked, uncheck "Public Store"
                                if (e.target.checked) {
                                  form.setValue("isPublic", false);
                                }
                              }}
                              className="mt-1"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>My Actors Only</FormLabel>
                            <FormDescription>
                              List only actors you created (uses /acts endpoint).
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.checked);
                                // If "Public Store" is checked, uncheck "My Actors"
                                if (e.target.checked) {
                                  form.setValue("my", false);
                                }
                              }}
                              className="mt-1"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Public Store</FormLabel>
                            <FormDescription>
                              Browse public actors from Apify Store (uses /store endpoint, default).
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limit (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="50"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum number of actors to return (default: 50, max recommended: 100).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Offset (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Pagination offset.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {/* getActorDetail specific fields */}
              {watchAction === "getActorDetail" && (
                <FormField
                  control={form.control}
                  name="actorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actor ID *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="clockworks/tiktok-scraper or {{previousNode.actorId}}"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The actor ID. Use format "username~actor-name" (e.g.,
                        "clockworks~tiktok-scraper") or the unique actor ID from listActors. You can
                        also use the fullActorId from a previous listActors node:{" "}
                        {"{{apify.fullActorId}}"}
                        Supports Handlebars templating.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* runActor specific fields */}
              {watchAction === "runActor" && (
                <>
                  <FormField
                    control={form.control}
                    name="actorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actor ID *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="clockworks/tiktok-scraper or {{previousNode.selectedActor}}"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The actor ID to run. Use format "username~actor-name" (e.g.,
                          "clockworks~tiktok-scraper") or the unique actor ID from listActors. You
                          can also use the fullActorId from a previous listActors node:{" "}
                          {"{{apify.fullActorId}}"}
                          Supports Handlebars templating.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="input"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Input Parameters (JSON) *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"hashtags": ["#fitness"], "sortBy": "views", "resultsCount": 100} or {{previousNode.actorInput}}'
                            className="min-h-[150px] font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          JSON object with input parameters matching the actor's input schema. Must
                          be valid JSON. Supports Handlebars templating.
                          <br />
                          Example:{" "}
                          <code className="bg-background px-1 py-0.5 rounded text-xs">
                            {`{"hashtags": ["#tech", "#ai"], "sortBy": "views", "resultsCount": 50}`}
                          </code>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="waitForFinish"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wait For Finish (seconds, Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="300"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum seconds to wait for actor to finish (optional). Leave empty for
                          async execution.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* getRunStatus specific fields */}
              {watchAction === "getRunStatus" && (
                <FormField
                  control={form.control}
                  name="runId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Run ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="abc123xyz or {{apify.runId}}" {...field} />
                      </FormControl>
                      <FormDescription>
                        The run ID from a previous runActor action. Supports Handlebars templating.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* getDatasetItems specific fields */}
              {watchAction === "getDatasetItems" && (
                <>
                  <FormField
                    control={form.control}
                    name="datasetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dataset ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="abc123xyz or {{apify.defaultDatasetId}}" {...field} />
                        </FormControl>
                        <FormDescription>
                          The dataset ID from a completed runActor action. Supports Handlebars
                          templating.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="itemsLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limit (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="250"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum items to retrieve (default: 250).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="itemsOffset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Offset (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Pagination offset.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="clean"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Clean Data</FormLabel>
                          <FormDescription>
                            Return cleaned dataset items (removes web scraping metadata).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
