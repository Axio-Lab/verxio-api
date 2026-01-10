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

const actionSchema = z.object({
  type: z.enum(["click", "scroll", "write", "press", "wait", "screenshot"]),
  selector: z.string().optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  milliseconds: z.number().optional(),
});

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  action: z.enum(["scrape", "crawl", "map", "search", "agent"]),
  // Common fields
  url: z.string().optional(),
  // Agent options
  prompt: z.string().optional(),
  urls: z.string().optional(), // Comma-separated URLs
  schema: z.string().optional(), // JSON schema as string
  maxCredits: z.number().optional(),
  // Scrape options
  formats: z.array(z.enum(["markdown", "html", "rawHtml", "links"])).optional(),
  onlyMainContent: z.boolean().optional(),
  screenshot: z.boolean().optional(),
  waitFor: z.number().optional(),
  // Crawl options
  limit: z.number().optional(),
  maxDepth: z.number().optional(),
  excludePaths: z.string().optional(), // Comma-separated
  includePaths: z.string().optional(), // Comma-separated
  // Map options
  includeVisual: z.boolean().optional(),
  // Search options
  query: z.string().optional(),
  searchLimit: z.number().optional(),
});

export type FirecrawlFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FirecrawlFormValues) => void;
  defaultValues?: Partial<FirecrawlFormValues>;
}

export const FirecrawlDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "firecrawl",
      action: defaultValues.action ?? "scrape",
      url: defaultValues.url ?? "",
      formats: defaultValues.formats ?? ["markdown"],
      onlyMainContent: defaultValues.onlyMainContent ?? false,
      screenshot: defaultValues.screenshot ?? false,
      waitFor: defaultValues.waitFor,
      limit: defaultValues.limit,
      maxDepth: defaultValues.maxDepth,
      excludePaths: defaultValues.excludePaths ?? "",
      includePaths: defaultValues.includePaths ?? "",
      includeVisual: defaultValues.includeVisual ?? false,
      query: defaultValues.query ?? "",
      searchLimit: defaultValues.searchLimit,
      prompt: defaultValues.prompt ?? "",
      urls: defaultValues.urls ?? "",
      schema: defaultValues.schema ?? "",
      maxCredits: defaultValues.maxCredits,
    } as FirecrawlFormValues,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "firecrawl",
        action: defaultValues.action ?? "scrape",
        url: defaultValues.url ?? "",
        formats: defaultValues.formats ?? ["markdown"],
        onlyMainContent: defaultValues.onlyMainContent ?? false,
        screenshot: defaultValues.screenshot ?? false,
        waitFor: defaultValues.waitFor,
        limit: defaultValues.limit,
        maxDepth: defaultValues.maxDepth,
        excludePaths: defaultValues.excludePaths ?? "",
        includePaths: defaultValues.includePaths ?? "",
        includeVisual: defaultValues.includeVisual ?? false,
        query: defaultValues.query ?? "",
        searchLimit: defaultValues.searchLimit,
        prompt: defaultValues.prompt ?? "",
        urls: defaultValues.urls ?? "",
        schema: defaultValues.schema ?? "",
        maxCredits: defaultValues.maxCredits,
      } as FirecrawlFormValues);
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "firecrawl";

  const handleSubmit = async (values: FirecrawlFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Firecrawl node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configure Firecrawl Node</DialogTitle>
          <DialogDescription>
            Scrape, crawl, map, search, or use agent for deep research on web content using
            Firecrawl AI.
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
                      <Input placeholder="firecrawl" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.markdown}}"}`}</code> or{" "}
                      <code>{`{"{{${watchVariables}.html}}"}`}</code>
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
                        <SelectItem value="scrape">Scrape (Single Page)</SelectItem>
                        <SelectItem value="crawl">Crawl (Multiple Pages)</SelectItem>
                        <SelectItem value="map">Map (Get Sitemap)</SelectItem>
                        <SelectItem value="search">Search & Scrape</SelectItem>
                        <SelectItem value="agent">Agent (Deep Research)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* URL Field - Required for scrape, crawl, map */}
              {(watchAction === "scrape" || watchAction === "crawl" || watchAction === "map") && (
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL {watchAction !== "map" && "*"}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com or {{previousNode.url}}"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The URL to scrape, crawl, or map. Supports Handlebars templating:
                        <br />
                        <code className="bg-background px-1 py-0.5 rounded text-xs">
                          {"{{airtable.fields.Website}}"}
                        </code>{" "}
                        - Access previous node output
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Query Field - Required for search */}
              {watchAction === "search" && (
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Query *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Firecrawl API documentation or {{gpt.searchQuery}}"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The search query. Supports Handlebars templating.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Scrape-specific options */}
              {watchAction === "scrape" && (
                <>
                  <FormField
                    control={form.control}
                    name="formats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Output Formats</FormLabel>
                        <Select
                          value={field.value?.join(",") || "markdown"}
                          onValueChange={(value) => {
                            field.onChange(value.split(",") as any);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="markdown">Markdown</SelectItem>
                            <SelectItem value="html">HTML</SelectItem>
                            <SelectItem value="rawHtml">Raw HTML</SelectItem>
                            <SelectItem value="links">Links</SelectItem>
                            <SelectItem value="markdown,html">Markdown + HTML</SelectItem>
                            <SelectItem value="markdown,links">Markdown + Links</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the output format(s) for the scraped content.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="onlyMainContent"
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
                            <FormLabel>Main Content Only</FormLabel>
                            <FormDescription>Extract only the main content.</FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="screenshot"
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
                            <FormLabel>Screenshot</FormLabel>
                            <FormDescription>Capture a screenshot of the page.</FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="waitFor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wait For (milliseconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2000"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Wait time in milliseconds before scraping (for dynamic content).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Crawl-specific options */}
              {watchAction === "crawl" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Page Limit</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="100"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Maximum number of pages to crawl.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxDepth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Depth</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="3"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value ? Number(e.target.value) : undefined)
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Maximum crawl depth.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="excludePaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exclude Paths (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="/admin, /api, /private" {...field} />
                        </FormControl>
                        <FormDescription>
                          Paths to exclude from crawling (comma-separated).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includePaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Include Paths (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="/blog, /docs" {...field} />
                        </FormControl>
                        <FormDescription>
                          Paths to include (only crawl these). Leave empty to crawl all.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Map-specific options */}
              {watchAction === "map" && (
                <FormField
                  control={form.control}
                  name="includeVisual"
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
                        <FormLabel>Include Visual Sitemap</FormLabel>
                        <FormDescription>
                          Include visual representation of the sitemap structure.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* Search-specific options */}
              {watchAction === "search" && (
                <FormField
                  control={form.control}
                  name="searchLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Result Limit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="10"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum number of search results to return and scrape.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Agent-specific options */}
              {watchAction === "agent" && (
                <>
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prompt *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Find the founders of Firecrawl and their backgrounds"
                            className="min-h-[100px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Natural language description of the data you want to extract (max 10,000
                          characters). Supports Handlebars templating:
                          <br />
                          <code className="bg-background px-1 py-0.5 rounded text-xs">
                            {"{{openai.researchQuery}}"}
                          </code>{" "}
                          - Access previous node output
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="urls"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URLs (Optional, comma-separated)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com, https://another.com or {{previousNode.urls}}"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional URLs to focus the agent on specific pages. Leave empty for
                          autonomous search. Supports Handlebars templating.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="schema"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>JSON Schema (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"type": "object", "properties": {"founders": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}}}}}}'
                            className="min-h-[120px] font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional JSON schema for structured output. Must be valid JSON.
                          <br />
                          Example:{" "}
                          <code className="bg-background px-1 py-0.5 rounded text-xs">
                            {`{"type": "object", "properties": {"data": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}}}}}}`}
                          </code>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxCredits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Credits (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum credits to spend on this agent job. Helps control costs for
                          complex research tasks.
                        </FormDescription>
                        <FormMessage />
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
