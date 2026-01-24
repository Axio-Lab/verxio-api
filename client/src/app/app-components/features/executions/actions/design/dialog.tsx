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
import { Loader2, Palette } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

// Available Gemini image models (only Flash Image for regular Design node)
export const DESIGN_MODELS = [
  { value: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (Fast)" },
] as const;

// Available templates with aspect ratios
export const DESIGN_TEMPLATES = [
  { value: "none", label: "No Template (Custom)", aspectRatio: "1:1" },
  { value: "instagram_post", label: "Instagram Post (1:1)", aspectRatio: "1:1" },
  { value: "instagram_story", label: "Instagram Story (9:16)", aspectRatio: "9:16" },
  { value: "twitter_post", label: "Twitter/X Post (16:9)", aspectRatio: "16:9" },
  { value: "presentation_slide", label: "Presentation Slide (16:9)", aspectRatio: "16:9" },
  { value: "youtube_thumbnail", label: "YouTube Thumbnail (16:9)", aspectRatio: "16:9" },
  { value: "logo", label: "Logo (1:1)", aspectRatio: "1:1" },
  { value: "banner", label: "Banner (21:9)", aspectRatio: "21:9" },
  { value: "linkedin_post", label: "LinkedIn Post (1:1)", aspectRatio: "1:1" },
  { value: "facebook_post", label: "Facebook Post (16:9)", aspectRatio: "16:9" },
] as const;

// Aspect ratios for custom selection
export const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "4:3", label: "Standard (4:3)" },
  { value: "3:4", label: "Portrait Standard (3:4)" },
  { value: "21:9", label: "Ultrawide (21:9)" },
] as const;

// Extract values for zod enums
const MODEL_VALUES = DESIGN_MODELS.map((m) => m.value) as [string, ...string[]];
const TEMPLATE_VALUES = DESIGN_TEMPLATES.map((t) => t.value) as [string, ...string[]];
const ASPECT_RATIO_VALUES = ASPECT_RATIOS.map((a) => a.value) as [string, ...string[]];

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  model: z.enum(MODEL_VALUES),
  template: z.enum(TEMPLATE_VALUES),
  aspectRatio: z.enum(ASPECT_RATIO_VALUES),
  prompt: z.string().min(1, { message: "Prompt is required" }),
});

export type DesignFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DesignFormValues) => void;
  defaultValues?: Partial<DesignFormValues>;
}

export const DesignDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<DesignFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "design",
      model: defaultValues.model || MODEL_VALUES[0],
      template: defaultValues.template || "none",
      aspectRatio: defaultValues.aspectRatio || "1:1",
      prompt: defaultValues.prompt || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "design",
        model: defaultValues.model || MODEL_VALUES[0],
        template: defaultValues.template || "none",
        aspectRatio: defaultValues.aspectRatio || "1:1",
        prompt: defaultValues.prompt || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "design";
  const watchTemplate = form.watch("template");

  // Update aspect ratio when template changes
  useEffect(() => {
    if (watchTemplate && watchTemplate !== "none") {
      const template = DESIGN_TEMPLATES.find((t) => t.value === watchTemplate);
      if (template) {
        form.setValue("aspectRatio", template.aspectRatio as any);
      }
    }
  }, [watchTemplate, form]);

  const handleSubmit = async (values: DesignFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Design node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-pink-500" />
            Design Agent
          </DialogTitle>
          <DialogDescription>
            Generate images using AI. Uses GEMINI_API_KEY from server environment.
          </DialogDescription>
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
                      <Input {...field} placeholder="design" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code className="text-xs">{`{{${watchVariables}.dataUrl}}`}</code> - Image
                      data URL
                      <br />
                      <code className="text-xs">{`{{${watchVariables}.prompt}}`}</code> - Compiled
                      prompt
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DESIGN_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>The Gemini image model to use for generation.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DESIGN_TEMPLATES.map((template) => (
                          <SelectItem key={template.value} value={template.value}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose a preset template for common use cases.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={watchTemplate !== "none"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select aspect ratio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio.value} value={ratio.value}>
                            {ratio.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchTemplate !== "none"
                        ? "Aspect ratio is set by the template."
                        : "Choose the image aspect ratio."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="A professional logo for a tech startup called {{company.name}}, modern minimalist style, blue and white colors"
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe the image you want to generate. Use {"{{variables}}"} to include
                      dynamic content from previous nodes.
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
