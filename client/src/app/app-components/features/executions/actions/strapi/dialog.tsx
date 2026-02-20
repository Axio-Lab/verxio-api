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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet, authenticatedFetch } from "@/lib/api-client";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message: "Must start with a letter/underscore, alphanumeric only",
    }),
  action: z.enum([
    "create",
    "update",
    "delete",
    "list",
    "create-website",
    "add-page",
    "create-blog-post",
    "update-blog-post",
    "delete-blog-post",
  ]),
  pageTitle: z.string().optional(),
  pageId: z.string().optional(),
  websiteId: z.string().optional(),
  websiteType: z.enum(["website", "funnel", "blog"]).optional(),
  pageType: z
    .enum([
      "landing",
      "about",
      "contact",
      "checkout",
      "thankyou",
      "upsell",
      "downsell",
      "form",
      "blog-listing",
      "custom",
    ])
    .optional(),
  blogContent: z.string().optional(),
  sections: z.string().optional(),
  seo: z.string().optional(),
  publishStatus: z.enum(["draft", "published"]).optional(),
  label: z.string().optional(),
});

export type StrapiFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StrapiFormValues) => void;
  defaultValues?: Partial<StrapiFormValues>;
}

interface PageItem {
  documentId?: string;
  id?: number;
  title: string;
  slug: string;
  status: string;
  createdAt?: string;
}

const SECTION_TEMPLATE = `[
  {
    "type": "hero",
    "heading": "Your Headline",
    "subheading": "Supporting text",
    "buttons": [{ "label": "Get Started", "url": "/signup", "variant": "primary" }]
  },
  {
    "type": "features",
    "heading": "Features",
    "items": [
      { "title": "Feature 1", "description": "Description" },
      { "title": "Feature 2", "description": "Description" }
    ]
  },
  {
    "type": "cta",
    "heading": "Ready to start?",
    "body": "Sign up today.",
    "buttons": [{ "label": "Sign Up", "url": "/signup", "variant": "primary" }]
  }
]`;

export const StrapiDialog = ({ open, onOpenChange, onSubmit, defaultValues }: Props) => {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const form = useForm<StrapiFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues?.variables || "strapi",
      action: defaultValues?.action || "create",
      pageTitle: defaultValues?.pageTitle || "",
      pageId: defaultValues?.pageId || "",
      websiteId: defaultValues?.websiteId || "",
      websiteType: defaultValues?.websiteType || "website",
      pageType: defaultValues?.pageType || "landing",
      blogContent: defaultValues?.blogContent || "",
      sections: defaultValues?.sections || "",
      seo: defaultValues?.seo || "",
      publishStatus: defaultValues?.publishStatus || "draft",
      label: defaultValues?.label || "Strapi",
    },
  });

  const action = form.watch("action");

  useEffect(() => {
    if (open && defaultValues) {
      form.reset({
        variables: defaultValues.variables || "strapi",
        action: defaultValues.action || "create",
        pageTitle: defaultValues.pageTitle || "",
        pageId: defaultValues.pageId || "",
        websiteId: defaultValues.websiteId || "",
        websiteType: defaultValues.websiteType || "website",
        pageType: defaultValues.pageType || "landing",
        blogContent: defaultValues.blogContent || "",
        sections: defaultValues.sections || "",
        seo: defaultValues.seo || "",
        publishStatus: defaultValues.publishStatus || "draft",
        label: defaultValues.label || "Strapi",
      });
    }
  }, [open, defaultValues]);

  const fetchPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const data = await authenticatedGet<{ pages: PageItem[] }>("/strapi/pages");
      setPages(data.pages || []);
    } catch {
      toast.error("Failed to load pages");
    } finally {
      setLoadingPages(false);
    }
  }, []);

  useEffect(() => {
    if (open && action === "list") {
      fetchPages();
    }
  }, [open, action, fetchPages]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Document ID copied");
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingAi(true);
    try {
      const res = await authenticatedFetch("/strapi/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: aiPrompt,
          currentSections: form.getValues("sections") || undefined,
          currentSeo: form.getValues("seo") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      if (data.sections) form.setValue("sections", data.sections);
      if (data.seo) form.setValue("seo", data.seo);
      toast.success("Content generated");
      setShowAiPanel(false);
    } catch {
      toast.error("Failed to generate content");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmit = (values: StrapiFormValues) => {
    onSubmit(values);
    onOpenChange(false);
    toast.success("Strapi node configured");
  };

  const needsTitle = [
    "create",
    "update",
    "create-website",
    "add-page",
    "create-blog-post",
    "update-blog-post",
  ].includes(action);
  const needsPageId = ["update", "delete", "update-blog-post", "delete-blog-post"].includes(action);
  const needsWebsiteId = ["add-page", "create-blog-post"].includes(action);
  const needsSections = ["create", "update", "add-page"].includes(action);
  const needsBlogContent = ["create-blog-post", "update-blog-post"].includes(action);
  const showPublishStatus = action !== "delete" && action !== "delete-blog-post" && action !== "list";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Strapi CMS</DialogTitle>
          <DialogDescription>
            Create websites, landing pages, funnels, and blog posts via Strapi.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Variable</FormLabel>
                  <FormControl>
                    <Input placeholder="strapi" {...field} />
                  </FormControl>
                  <FormDescription>
                    Access results via {"{{strapi.pageId}}"}, {"{{strapi.url}}"}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="create">Create Landing Page</SelectItem>
                      <SelectItem value="update">Update Page</SelectItem>
                      <SelectItem value="delete">Delete Page</SelectItem>
                      <SelectItem value="list">List My Pages</SelectItem>
                      <SelectItem value="create-website">Create Website/Funnel</SelectItem>
                      <SelectItem value="add-page">Add Page to Website</SelectItem>
                      <SelectItem value="create-blog-post">Create Blog Post</SelectItem>
                      <SelectItem value="update-blog-post">Update Blog Post</SelectItem>
                      <SelectItem value="delete-blog-post">Delete Blog Post</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {action === "list" && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Pages
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fetchPages}
                    disabled={loadingPages}
                  >
                    {loadingPages ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                  </Button>
                </div>
                {loadingPages ? (
                  <div className="p-6 text-center text-sm text-gray-500">Loading pages...</div>
                ) : pages.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">No pages found.</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
                    {pages.map((page) => {
                      const docId = page.documentId || String(page.id);
                      return (
                        <div
                          key={docId}
                          className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {page.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              /{page.slug} &middot;{" "}
                              <span
                                className={
                                  page.status === "published"
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {page.status}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Copy document ID"
                              onClick={() => handleCopyId(docId)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {action === "create-website" && (
              <FormField
                control={form.control}
                name="websiteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="funnel">Sales Funnel</SelectItem>
                        <SelectItem value="blog">Blog</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsWebsiteId && (
              <FormField
                control={form.control}
                name="websiteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website ID (required)</FormLabel>
                    <FormControl>
                      <Input placeholder="Website document ID" {...field} />
                    </FormControl>
                    <FormDescription>Supports Handlebars: {"{{strapi.websiteId}}"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {action === "add-page" && (
              <FormField
                control={form.control}
                name="pageType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select page type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="landing">Landing</SelectItem>
                        <SelectItem value="about">About</SelectItem>
                        <SelectItem value="contact">Contact</SelectItem>
                        <SelectItem value="checkout">Checkout</SelectItem>
                        <SelectItem value="thankyou">Thank You</SelectItem>
                        <SelectItem value="upsell">Upsell</SelectItem>
                        <SelectItem value="downsell">Downsell</SelectItem>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="blog-listing">Blog Listing</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsTitle && (
              <FormField
                control={form.control}
                name="pageTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {action.includes("blog") ? "Post Title" : action === "create-website" ? "Website Title" : "Page Title"}
                      {["create", "create-website", "add-page", "create-blog-post"].includes(action) && " (required)"}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="My Landing Page" {...field} />
                    </FormControl>
                    <FormDescription>Supports Handlebars: {"{{variableName}}"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsPageId && (
              <FormField
                control={form.control}
                name="pageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{action.includes("blog") ? "Post ID" : "Page ID"} (required)</FormLabel>
                    <FormControl>
                      <Input placeholder="Document ID" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use List Pages to find IDs, or Handlebars: {"{{strapi.pageId}}"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsBlogContent && (
              <FormField
                control={form.control}
                name="blogContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blog Content (markdown)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your blog post content in markdown..."
                        rows={8}
                        className="font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsSections && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sections (JSON)</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate with AI
                  </Button>
                </div>

                {showAiPanel && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                    <Textarea
                      placeholder="Describe your page: e.g., A SaaS landing page for a project management tool with hero, features, pricing, and FAQ..."
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAiPanel(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGenerateAi}
                        disabled={generatingAi || !aiPrompt.trim()}
                        className="gap-1.5"
                      >
                        {generatingAi ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </Button>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="sections"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder={SECTION_TEMPLATE}
                          rows={8}
                          className="font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON array. Types: hero, features, cta, testimonials, pricing, faq, video,
                        gallery, form, checkout, blog-listing
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO (JSON, optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"metaTitle": "...", "metaDescription": "...", "keywords": ["..."], "ogTitle": "...", "ogDescription": "..."}'
                          rows={3}
                          className="font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {showPublishStatus && (
              <FormField
                control={form.control}
                name="publishStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publish Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="submit">
                {action === "list" ? "Save Configuration" : "Save Configuration"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
