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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Palette, Upload, X, ImageIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { DESIGN_MODELS, DESIGN_TEMPLATES, ASPECT_RATIOS } from "../design/dialog";
import Image from "next/image";

// Extract values for zod enums
const MODEL_VALUES = DESIGN_MODELS.map((m) => m.value) as [string, ...string[]];
const TEMPLATE_VALUES = DESIGN_TEMPLATES.map((t) => t.value) as [string, ...string[]];
const ASPECT_RATIO_VALUES = ASPECT_RATIOS.map((a) => a.value) as [string, ...string[]];

const MODES = [
  { value: "generate", label: "Generate (Text-to-Image)" },
  { value: "edit", label: "Edit (Image + Text)" },
  { value: "chat", label: "Chat (Multi-turn Editing)" },
  { value: "editWithReferences", label: "Edit with References (Up to 14 images)" },
] as const;

const IMAGE_SIZES = [
  { value: "1K", label: "1K (Standard)" },
  { value: "2K", label: "2K (High Quality)" },
  { value: "4K", label: "4K (Ultra High Quality)" },
] as const;

const MODE_VALUES = MODES.map((m) => m.value) as [string, ...string[]];
const IMAGE_SIZE_VALUES = IMAGE_SIZES.map((s) => s.value) as [string, ...string[]];

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  mode: z.enum(MODE_VALUES),
  model: z.enum(MODEL_VALUES),
  template: z.enum(TEMPLATE_VALUES),
  aspectRatio: z.enum(ASPECT_RATIO_VALUES),
  imageSize: z.enum(IMAGE_SIZE_VALUES).optional(),
  prompt: z.string().min(1, { message: "Prompt is required" }),
  sourceImage: z.string().optional(),
  sourceImageMimeType: z.string().optional(),
  referenceImages: z
    .array(
      z.object({
        image: z.string(),
        mimeType: z.string().optional(),
        type: z.enum(["object", "human"]).optional(),
      })
    )
    .optional(),
  useGoogleSearch: z.boolean().optional(),
});

export type DesignProFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DesignProFormValues) => void;
  defaultValues?: Partial<DesignProFormValues>;
}

interface UploadedImage {
  base64: string;
  mimeType: string;
  preview?: string;
}

export const DesignProDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [uploadedSourceImage, setUploadedSourceImage] = useState<UploadedImage | null>(null);
  const [uploadedReferenceImages, setUploadedReferenceImages] = useState<UploadedImage[]>([]);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<DesignProFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "designPro",
      mode: defaultValues.mode || "generate",
      model: defaultValues.model || "gemini-3-pro-image-preview",
      template: defaultValues.template || "none",
      aspectRatio: defaultValues.aspectRatio || "1:1",
      imageSize: defaultValues.imageSize,
      prompt: defaultValues.prompt || "",
      sourceImage: defaultValues.sourceImage || "",
      sourceImageMimeType: defaultValues.sourceImageMimeType || "",
      referenceImages: defaultValues.referenceImages || [],
      useGoogleSearch: defaultValues.useGoogleSearch || false,
    },
  });

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve({
          base64,
          mimeType: file.type || "image/png",
          preview: result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle source image upload
  const handleSourceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    try {
      const uploaded = await fileToBase64(file);
      setUploadedSourceImage(uploaded);
      form.setValue("sourceImage", uploaded.base64);
      form.setValue("sourceImageMimeType", uploaded.mimeType);
      toast.success("Source image uploaded");
    } catch (error) {
      toast.error("Failed to upload image");
    }
  };

  // Handle reference images upload
  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      toast.error("Some files are not images and were skipped");
    }

    const currentCount = uploadedReferenceImages.length;
    const newCount = currentCount + imageFiles.length;

    if (newCount > 14) {
      toast.error("Maximum 14 reference images allowed");
      return;
    }

    try {
      const uploaded = await Promise.all(imageFiles.map(fileToBase64));
      const newImages = [...uploadedReferenceImages, ...uploaded];
      setUploadedReferenceImages(newImages);

      // Update form with reference images
      form.setValue(
        "referenceImages",
        newImages.map((img) => ({
          image: img.base64,
          mimeType: img.mimeType,
        }))
      );
      toast.success(`Uploaded ${imageFiles.length} image(s)`);
    } catch (error) {
      toast.error("Failed to upload images");
    }
  };

  // Remove source image
  const removeSourceImage = () => {
    setUploadedSourceImage(null);
    form.setValue("sourceImage", "");
    form.setValue("sourceImageMimeType", "");
    if (sourceImageInputRef.current) {
      sourceImageInputRef.current.value = "";
    }
  };

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    const newImages = uploadedReferenceImages.filter((_, i) => i !== index);
    setUploadedReferenceImages(newImages);
    form.setValue(
      "referenceImages",
      newImages.map((img) => ({
        image: img.base64,
        mimeType: img.mimeType,
      }))
    );
  };

  useEffect(() => {
    if (open) {
      // Check if sourceImage is base64 (starts with data: or is long base64 string)
      const sourceImage = defaultValues.sourceImage || "";
      const isBase64 =
        sourceImage.startsWith("data:") ||
        (sourceImage.length > 100 && /^[A-Za-z0-9+/=]+$/.test(sourceImage));

      if (isBase64 && !sourceImage.startsWith("http")) {
        setUploadedSourceImage({
          base64: sourceImage.includes(",") ? sourceImage.split(",")[1] : sourceImage,
          mimeType: defaultValues.sourceImageMimeType || "image/png",
          preview: sourceImage.startsWith("data:")
            ? sourceImage
            : `data:${defaultValues.sourceImageMimeType || "image/png"};base64,${sourceImage}`,
        });
      } else {
        setUploadedSourceImage(null);
      }

      // Load reference images if they exist
      if (defaultValues.referenceImages && defaultValues.referenceImages.length > 0) {
        const refImages = defaultValues.referenceImages.map((ref) => {
          const isBase64 =
            ref.image.startsWith("data:") ||
            (ref.image.length > 100 && /^[A-Za-z0-9+/=]+$/.test(ref.image));
          return {
            base64: isBase64
              ? ref.image.includes(",")
                ? ref.image.split(",")[1]
                : ref.image
              : ref.image,
            mimeType: ref.mimeType || "image/png",
            preview: isBase64
              ? ref.image.startsWith("data:")
                ? ref.image
                : `data:${ref.mimeType || "image/png"};base64,${ref.image}`
              : ref.image,
          };
        });
        setUploadedReferenceImages(refImages);
      } else {
        setUploadedReferenceImages([]);
      }

      form.reset({
        variables: defaultValues.variables || "designPro",
        mode: defaultValues.mode || "generate",
        model: defaultValues.model || "gemini-3-pro-image-preview",
        template: defaultValues.template || "none",
        aspectRatio: defaultValues.aspectRatio || "1:1",
        imageSize: defaultValues.imageSize,
        prompt: defaultValues.prompt || "",
        sourceImage: defaultValues.sourceImage || "",
        sourceImageMimeType: defaultValues.sourceImageMimeType || "",
        referenceImages: defaultValues.referenceImages || [],
        useGoogleSearch: defaultValues.useGoogleSearch || false,
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "designPro";
  const watchTemplate = form.watch("template");
  const watchMode = form.watch("mode");

  // Update aspect ratio when template changes
  useEffect(() => {
    if (watchTemplate && watchTemplate !== "none") {
      const template = DESIGN_TEMPLATES.find((t) => t.value === watchTemplate);
      if (template) {
        form.setValue("aspectRatio", template.aspectRatio as any);
      }
    }
  }, [watchTemplate, form]);

  const handleSubmit = async (values: DesignProFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Design Pro node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const requiresSourceImage =
    watchMode === "edit" || watchMode === "chat" || watchMode === "editWithReferences";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-pink-500" />
            Design Agent Pro
          </DialogTitle>
          <DialogDescription>
            Advanced image editing with multi-turn conversations, reference images, and
            high-resolution output.
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
                      <Input {...field} placeholder="designPro" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code className="text-xs">{`{{${watchVariables}.imageUrl}}`}</code> - Image
                      URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchMode === "generate" && "Generate a new image from text prompt."}
                      {watchMode === "edit" && "Edit an existing image with text instructions."}
                      {watchMode === "chat" &&
                        "Multi-turn conversational editing (maintains conversation state)."}
                      {watchMode === "editWithReferences" &&
                        "Edit with up to 14 reference images (6 objects + 5 humans)."}
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
                    <FormDescription>
                      Gemini 3 Pro Image is recommended for advanced features.
                    </FormDescription>
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
                name="imageSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Size (Pro Only)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "default" ? undefined : value)
                      }
                      value={field.value || "default"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Default (Auto)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="default">Default (Auto)</SelectItem>
                        {IMAGE_SIZES.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      High-resolution output (1K/2K/4K) for Pro model only.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {requiresSourceImage && (
                <FormField
                  control={form.control}
                  name="sourceImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Image</FormLabel>
                      <div className="space-y-3">
                        {/* Upload button */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => sourceImageInputRef.current?.click()}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Upload Image
                          </Button>
                          <input
                            ref={sourceImageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleSourceImageUpload}
                            className="hidden"
                          />
                          <span className="text-sm text-muted-foreground">or</span>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="URL or {{previousNode.imageUrl}}"
                              onChange={(e) => {
                                field.onChange(e);
                                // Clear uploaded image if user types URL
                                if (e.target.value && !e.target.value.startsWith("data:")) {
                                  setUploadedSourceImage(null);
                                }
                              }}
                            />
                          </FormControl>
                        </div>

                        {/* Image preview */}
                        {uploadedSourceImage?.preview && (
                          <div className="relative inline-block">
                            <div className="relative w-32 h-32 border rounded-md overflow-hidden">
                              <Image
                                src={uploadedSourceImage.preview}
                                alt="Source image preview"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                              onClick={removeSourceImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* URL input preview */}
                        {field.value && !uploadedSourceImage && field.value.startsWith("http") && (
                          <div className="relative w-32 h-32 border rounded-md overflow-hidden">
                            <Image
                              src={field.value}
                              alt="Source image"
                              fill
                              className="object-cover"
                              onError={() => {
                                // If image fails to load, it might be a template variable
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <FormDescription>
                        Upload an image file, or enter a URL/base64 string, or reference a previous
                        node output.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchMode === "editWithReferences" && (
                <FormField
                  control={form.control}
                  name="referenceImages"
                  render={() => (
                    <FormItem>
                      <FormLabel>Reference Images (Up to 14)</FormLabel>
                      <div className="space-y-3">
                        {/* Upload button */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => referenceImagesInputRef.current?.click()}
                            className="flex items-center gap-2"
                            disabled={uploadedReferenceImages.length >= 14}
                          >
                            <Upload className="h-4 w-4" />
                            Upload Images ({uploadedReferenceImages.length}/14)
                          </Button>
                          <input
                            ref={referenceImagesInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleReferenceImagesUpload}
                            className="hidden"
                          />
                        </div>

                        {/* Image previews grid */}
                        {uploadedReferenceImages.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {uploadedReferenceImages.map((img, index) => (
                              <div key={index} className="relative group">
                                <div className="relative w-full aspect-square border rounded-md overflow-hidden">
                                  <Image
                                    src={img.preview || `data:${img.mimeType};base64,${img.base64}`}
                                    alt={`Reference ${index + 1}`}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeReferenceImage(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                                  {index + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <FormDescription>
                        Upload up to 14 reference images (6 objects + 5 humans). Images are
                        converted to base64 automatically.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="JSON format prompt or text description"
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Image generation prompt. Use JSON format for detailed specifications, or plain
                      text for simple prompts. Use {"{{variables}}"} to include dynamic content from
                      previous nodes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="useGoogleSearch"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Enable Google Search</FormLabel>
                      <FormDescription>
                        Enable Google Search grounding for fact verification and real-time data.
                      </FormDescription>
                    </div>
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
