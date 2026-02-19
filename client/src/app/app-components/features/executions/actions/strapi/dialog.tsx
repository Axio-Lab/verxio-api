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
      message: "Must start with a letter/underscore, alphanumeric only",
    }),
  action: z.enum(["create", "update", "delete"]),
  pageTitle: z.string().optional(),
  pageId: z.string().optional(),
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
  const form = useForm<StrapiFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues?.variables || "strapi",
      action: defaultValues?.action || "create",
      pageTitle: defaultValues?.pageTitle || "",
      pageId: defaultValues?.pageId || "",
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
        sections: defaultValues.sections || "",
        seo: defaultValues.seo || "",
        publishStatus: defaultValues.publishStatus || "draft",
        label: defaultValues.label || "Strapi",
      });
    }
  }, [open, defaultValues]);

  const handleSubmit = (values: StrapiFormValues) => {
    onSubmit(values);
    onOpenChange(false);
    toast.success("Strapi node configured");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Strapi Landing Page</DialogTitle>
          <DialogDescription>
            Create, update, or delete landing pages via Strapi CMS.
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
                    Access results via {"{{strapi.pageId}}"}, {"{{strapi.url}}"}, {"{{strapi.slug}}"}
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
                      <SelectItem value="create">Create Page</SelectItem>
                      <SelectItem value="update">Update Page</SelectItem>
                      <SelectItem value="delete">Delete Page</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(action === "create" || action === "update") && (
              <FormField
                control={form.control}
                name="pageTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Title {action === "create" && "(required)"}</FormLabel>
                    <FormControl>
                      <Input placeholder="My Landing Page" {...field} />
                    </FormControl>
                    <FormDescription>Supports Handlebars: {"{{variableName}}"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(action === "update" || action === "delete") && (
              <FormField
                control={form.control}
                name="pageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page ID (required)</FormLabel>
                    <FormControl>
                      <Input placeholder="Page document ID" {...field} />
                    </FormControl>
                    <FormDescription>Supports Handlebars: {"{{strapi.pageId}}"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {action !== "delete" && (
              <>
                <FormField
                  control={form.control}
                  name="sections"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sections (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={SECTION_TEMPLATE}
                          rows={8}
                          className="font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON array of sections. Types: hero, features, cta, testimonials, pricing,
                        faq, video, gallery
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
                          placeholder='{"metaTitle": "...", "metaDescription": "...", "keywords": ["..."]}'
                          rows={3}
                          className="font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </>
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
