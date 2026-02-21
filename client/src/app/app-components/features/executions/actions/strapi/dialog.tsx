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
import { Loader2, Sparkles } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api-client";

const formSchema = z
  .object({
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
    websitePrompt: z.string().optional(),
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
  })
  .refine(
    (data) => data.action !== "create-website" || (data.websitePrompt?.trim()?.length ?? 0) > 0,
    {
      message: "Describe your website or funnel (required for Create Website/Funnel).",
      path: ["websitePrompt"],
    }
  );

export type StrapiFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StrapiFormValues) => void;
  defaultValues?: Partial<StrapiFormValues>;
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
      websitePrompt: defaultValues?.websitePrompt || "",
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
      const rawAction = defaultValues.action as string | undefined;
      const action = rawAction === "list" ? "create" : rawAction || "create";
      form.reset({
        variables: defaultValues.variables || "strapi",
        action: (action as StrapiFormValues["action"]) || "create",
        pageTitle: defaultValues.pageTitle || "",
        pageId: defaultValues.pageId || "",
        websiteId: defaultValues.websiteId || "",
        websiteType: defaultValues.websiteType || "website",
        websitePrompt: defaultValues.websitePrompt || "",
        pageType: defaultValues.pageType || "landing",
        blogContent: defaultValues.blogContent || "",
        sections: defaultValues.sections || "",
        seo: defaultValues.seo || "",
        publishStatus: defaultValues.publishStatus || "draft",
        label: defaultValues.label || "Strapi",
      });
    }
  }, [open, defaultValues]);

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
    "add-page",
    "create-blog-post",
    "update-blog-post",
  ].includes(action);
  const needsPageId = ["update", "delete", "update-blog-post", "delete-blog-post"].includes(action);
  const needsWebsiteId = ["add-page", "create-blog-post"].includes(action);
  const needsSections = ["create", "update", "add-page"].includes(action);
  const needsBlogContent = ["create-blog-post", "update-blog-post"].includes(action);
  const showPublishStatus =
    action !== "delete" && action !== "delete-blog-post" && action !== "create-website";

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

            {action === "create-website" && (
              <>
                <FormField
                  control={form.control}
                  name="websitePrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe your website or funnel (required)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. A 3-page sales funnel: landing page with hero and CTA, checkout page with offer bump, thank you page with upsell. Or: A simple 5-page business website with home, about, services, contact, and blog listing."
                          rows={4}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When the workflow runs, AI will generate the full site (title, type, and all
                        pages with sections and SEO) and create it. Required.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
                      {action.includes("blog") ? "Post Title" : "Page Title"}
                      {["create", "add-page", "create-blog-post"].includes(action) && " (required)"}
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
                    <FormLabel>
                      {action.includes("blog") ? "Post ID" : "Page ID"} (required)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Document ID" {...field} />
                    </FormControl>
                    <FormDescription>
                      Find IDs on the Sites page, or use Handlebars: {"{{strapi.pageId}}"}
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
              <Button type="submit">Save Configuration</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
