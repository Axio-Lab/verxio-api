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
import { Loader2, Palette, Upload, X, ImageIcon, AlertTriangle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { DESIGN_MODELS, DESIGN_TEMPLATES, ASPECT_RATIOS } from "../design/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Extract values for zod enums
const MODEL_VALUES = DESIGN_MODELS.map((m) => m.value) as [string, ...string[]];
const TEMPLATE_VALUES = DESIGN_TEMPLATES.map((t) => t.value) as [string, ...string[]];
const ASPECT_RATIO_VALUES = ASPECT_RATIOS.map((a) => a.value) as [string, ...string[]];

const MODES = [
  { value: "generate", label: "Generate (Text-to-Image)" },
  { value: "edit", label: "Edit (Image + Text)" },
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
  sourceImageFilename: z.string().optional(),
  referenceImages: z
    .array(
      z.object({
        image: z.string(),
        filename: z.string().optional(),
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

interface ImageFile {
  file: File | null; // Store file object for processing on save
  base64: string; // base64 for preview OR URL if already uploaded
  filename: string;
  mimeType: string;
}

export const DesignProDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [sourceImageFile, setSourceImageFile] = useState<ImageFile | null>(null);
  const [sourceImageOriginalUrl, setSourceImageOriginalUrl] = useState<string | null>(null);
  const [referenceImageFiles, setReferenceImageFiles] = useState<ImageFile[]>([]);
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

  // Helper to convert file to base64 (for preview)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to convert file to data URL (for storage)
  const convertFileToDataUrl = async (file: File): Promise<string> => {
    const base64 = await fileToBase64(file);
    return base64; // Already a data URL
  };

  // Sanitize filename
  const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[<>:"/\\|?*\s]/g, "_").trim();
  };

  // Handle source image upload (preview only, convert on save)
  const handleSourceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    try {
      // Convert to base64 for preview (not stored in form yet)
      const base64 = await fileToBase64(file);
      const sanitizedFilename = sanitizeFilename(file.name);
      setSourceImageFile({
        file,
        base64, // For preview
        filename: sanitizedFilename,
        mimeType: file.type || "image/png",
      });
      // Don't set form values yet - will be set on save
      toast.success("Source image selected");
    } catch (error) {
      toast.error("Failed to process image file");
    }
  };

  // Handle reference images upload (preview only, convert on save)
  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      toast.error("Some files are not images and were skipped");
    }

    const currentCount = referenceImageFiles.length;
    const newCount = currentCount + imageFiles.length;

    if (newCount > 14) {
      toast.error("Maximum 14 reference images allowed");
      return;
    }

    try {
      // Convert to base64 for preview (not stored in form yet)
      const newImages: ImageFile[] = await Promise.all(
        imageFiles.map(async (file) => ({
          file,
          base64: await fileToBase64(file), // For preview
          filename: sanitizeFilename(file.name),
          mimeType: file.type || "image/png",
        }))
      );

      setReferenceImageFiles([...referenceImageFiles, ...newImages]);
      // Don't set form values yet - will be set on save
      toast.success(`Selected ${imageFiles.length} image(s)`);
    } catch (error) {
      toast.error("Failed to process images");
    }
  };

  // Remove source image
  const removeSourceImage = () => {
    setSourceImageFile(null);
    setSourceImageOriginalUrl(null);
    form.setValue("sourceImage", "");
    form.setValue("sourceImageMimeType", "");
    if (sourceImageInputRef.current) {
      sourceImageInputRef.current.value = "";
    }
  };

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    const newImages = referenceImageFiles.filter((_, i) => i !== index);
    setReferenceImageFiles(newImages);
    // Don't update form - will be set on save
  };

  useEffect(() => {
    if (open) {
      // Load source image if exists (for preview)
      const sourceImage = defaultValues.sourceImage || "";
      const isUrl = sourceImage.startsWith("http");
      const isBase64 =
        sourceImage.startsWith("data:") ||
        (sourceImage.length > 100 && /^[A-Za-z0-9+/=]+$/.test(sourceImage));
      const isAssetPlaceholder = sourceImage.startsWith("asset:");

      if (isUrl) {
        setSourceImageOriginalUrl(sourceImage);
        setSourceImageFile(null);
      } else if (isBase64) {
        const sanitizedFilename = sanitizeFilename(
          defaultValues.sourceImageFilename || "source-image.png"
        );
        setSourceImageFile({
          file: null, // Already stored, no file object
          base64: sourceImage.startsWith("data:")
            ? sourceImage
            : `data:${defaultValues.sourceImageMimeType || "image/png"};base64,${sourceImage}`,
          filename: sanitizedFilename,
          mimeType: defaultValues.sourceImageMimeType || "image/png",
        });
        setSourceImageOriginalUrl(null);
      } else if (isAssetPlaceholder || (defaultValues.sourceImageFilename && !sourceImage)) {
        // Handle asset placeholder (e.g., "asset:filename.png") - show filename but no preview
        // Also handle case where we have filename but no sourceImage (from metadata-only load)
        const filename = isAssetPlaceholder
          ? sourceImage.replace("asset:", "")
          : defaultValues.sourceImageFilename || "source-image.png";
        const sanitizedFilename = sanitizeFilename(filename);
        // Store the placeholder in base64 so it's preserved (similar to Remotion)
        const placeholderValue = isAssetPlaceholder
          ? sourceImage
          : `asset:${defaultValues.sourceImageFilename}`;
        setSourceImageFile({
          file: null,
          base64: placeholderValue, // Store placeholder so it's preserved on submit
          filename: sanitizedFilename,
          mimeType: defaultValues.sourceImageMimeType || "image/png",
        });
        setSourceImageOriginalUrl(null);
      } else {
        setSourceImageFile(null);
        setSourceImageOriginalUrl(null);
      }

      // Load reference images if they exist (for preview)
      if (defaultValues.referenceImages && defaultValues.referenceImages.length > 0) {
        const refImages: ImageFile[] = defaultValues.referenceImages.map((ref, idx) => {
          const isBase64 =
            ref.image.startsWith("data:") ||
            (ref.image.length > 100 && /^[A-Za-z0-9+/=]+$/.test(ref.image));
          const isAssetPlaceholder = ref.image.startsWith("asset:");
          const sanitizedFilename = sanitizeFilename(ref.filename || `ref-image-${idx + 1}.png`);

          if (isAssetPlaceholder) {
            // Handle asset placeholder - show filename but no preview
            // Store placeholder in base64 so it's preserved (similar to Remotion)
            const filename =
              ref.image.replace("asset:", "") || ref.filename || `ref-image-${idx + 1}.png`;
            return {
              file: null,
              base64: ref.image, // Store placeholder so it's preserved on submit
              filename: sanitizeFilename(filename),
              mimeType: ref.mimeType || "image/png",
            };
          }

          return {
            file: null, // Already stored
            base64: isBase64
              ? ref.image.startsWith("data:")
                ? ref.image
                : `data:${ref.mimeType || "image/png"};base64,${ref.image}`
              : ref.image,
            filename: sanitizedFilename,
            mimeType: ref.mimeType || "image/png",
          };
        });
        setReferenceImageFiles(refImages);
      } else {
        setReferenceImageFiles([]);
      }

      // Determine sourceImage value - use placeholder if we have filename but no image data
      let sourceImageValue = defaultValues.sourceImage || "";
      if (!sourceImageValue && defaultValues.sourceImageFilename) {
        sourceImageValue = `asset:${defaultValues.sourceImageFilename}`;
      }

      form.reset({
        variables: defaultValues.variables || "designPro",
        mode: defaultValues.mode || "generate",
        model: defaultValues.model || "gemini-3-pro-image-preview",
        template: defaultValues.template || "none",
        aspectRatio: defaultValues.aspectRatio || "1:1",
        imageSize: defaultValues.imageSize,
        prompt: defaultValues.prompt || "",
        sourceImage: sourceImageValue, // Store original (URL, base64, or asset:filename placeholder)
        sourceImageMimeType: defaultValues.sourceImageMimeType || "",
        sourceImageFilename: defaultValues.sourceImageFilename || "",
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
      // Process source image - convert to base64 data URL if new file selected
      let sourceImageUrl: string | undefined = undefined;

      if (sourceImageFile?.file) {
        // New file selected - convert to data URL
        if (sourceImageOriginalUrl) {
          sourceImageUrl = sourceImageOriginalUrl; // Keep URL if it was a URL
        } else {
          sourceImageUrl = await convertFileToDataUrl(sourceImageFile.file);
        }
      } else if (sourceImageFile?.base64) {
        // Check if it's a placeholder or actual data
        if (sourceImageFile.base64.startsWith("asset:")) {
          // It's a placeholder - send it so backend knows to keep existing asset
          sourceImageUrl = sourceImageFile.base64;
        } else if (
          sourceImageFile.base64.startsWith("data:") ||
          sourceImageFile.base64.startsWith("http")
        ) {
          // It's actual image data (data URL or URL) - use it
          sourceImageUrl = sourceImageFile.base64;
        }
      } else if (
        values.sourceImage?.startsWith("http") ||
        values.sourceImage?.startsWith("data:")
      ) {
        // URL or data URL from form value
        sourceImageUrl = values.sourceImage;
      } else if (values.sourceImage?.startsWith("asset:")) {
        // Placeholder from form value - send it so backend knows to keep existing asset
        sourceImageUrl = values.sourceImage;
      }

      // Process reference images - convert to base64 data URLs if new files selected
      let processedReferenceImages: Array<{
        image: string;
        filename: string;
        mimeType: string;
        type?: "object" | "human";
      }> = [];

      if (referenceImageFiles.length > 0) {
        const needsProcessing = referenceImageFiles.some((img) => img.file !== null);
        const toastId = needsProcessing
          ? toast.loading(`Processing ${referenceImageFiles.length} image(s)...`)
          : null;

        try {
          processedReferenceImages = (
            await Promise.all(
              referenceImageFiles.map(async (imgFile) => {
                if (imgFile.file) {
                  // New file - convert to data URL
                  const dataUrl = await convertFileToDataUrl(imgFile.file);
                  return {
                    image: dataUrl,
                    filename: imgFile.filename,
                    mimeType: imgFile.mimeType,
                  };
                } else if (imgFile.base64) {
                  // Check if it's a placeholder or actual data
                  if (imgFile.base64.startsWith("asset:")) {
                    // It's a placeholder - don't send it (backend already has the asset)
                    // Return null to skip this image
                    return null;
                  } else {
                    // It's actual image data - use it
                    return {
                      image: imgFile.base64,
                      filename: imgFile.filename,
                      mimeType: imgFile.mimeType,
                    };
                  }
                } else {
                  // No base64 - check form value
                  const formRefImage = values.referenceImages?.find((ref) => {
                    return ref.filename === imgFile.filename;
                  });
                  if (formRefImage?.image && !formRefImage.image.startsWith("asset:")) {
                    // Form has actual image data
                    return {
                      image: formRefImage.image,
                      filename: imgFile.filename,
                      mimeType: imgFile.mimeType,
                    };
                  }
                  // Otherwise skip (it's a placeholder or doesn't exist)
                  return null;
                }
              })
            )
          ).filter((img): img is NonNullable<typeof img> => img !== null);
        } finally {
          if (toastId) toast.dismiss(toastId);
        }
      } else if (values.referenceImages && values.referenceImages.length > 0) {
        // Use existing reference images (from defaultValues) - include placeholders (backend will handle them)
        processedReferenceImages = values.referenceImages.map((ref) => ({
          image: ref.image,
          filename: ref.filename || "reference-image.png",
          mimeType: ref.mimeType || "image/png",
          type: ref.type,
        }));
      }

      // Prepare submit values - only include sourceImage if it's not a placeholder
      const submitValues: DesignProFormValues = {
        ...values,
        sourceImage: sourceImageUrl, // undefined if placeholder, which is fine
        sourceImageFilename: sourceImageFile?.filename || values.sourceImageFilename,
        referenceImages: processedReferenceImages,
      };

      await Promise.resolve(onSubmit(submitValues));
      onOpenChange(false);
      toast.success("Design Pro node configured");
      form.reset();
    } catch (error) {
      toast.dismiss(); // Dismiss any loading toasts
      // Error handling is done in the parent component
    }
  };

  // Source image is required for edit mode, but optional for editWithReferences
  // (editWithReferences can work with just reference images)
  const requiresSourceImage = watchMode === "edit";

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
                      <Alert variant="destructive" className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>File Size Limit:</strong> Uploaded images must not exceed 5MB. If
                          your image is too large, please compress or resize it before uploading.
                        </AlertDescription>
                      </Alert>
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
                                  setSourceImageFile(null);
                                  setSourceImageOriginalUrl(e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                        </div>

                        {/* Image preview - show filename and icon, not image */}
                        {sourceImageFile && (
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm flex-1 truncate">
                              {sourceImageFile.filename}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={removeSourceImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* URL input preview */}
                        {field.value && !sourceImageFile && field.value.startsWith("http") && (
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm flex-1 truncate">{field.value}</span>
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
                      <Alert variant="destructive" className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>File Size Limit:</strong> All reference images combined must not
                          exceed 5MB total. If images are too large, please compress or resize them
                          before uploading.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-3">
                        {/* Upload button */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => referenceImagesInputRef.current?.click()}
                            className="flex items-center gap-2"
                            disabled={referenceImageFiles.length >= 14}
                          >
                            <Upload className="h-4 w-4" />
                            Upload Images ({referenceImageFiles.length}/14)
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

                        {/* Image list - show filenames and icons, not images */}
                        {referenceImageFiles.length > 0 && (
                          <div className="space-y-2">
                            {referenceImageFiles.map((img, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 border rounded-md bg-muted/50"
                              >
                                <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm flex-1 truncate">{img.filename}</span>
                                <span className="text-xs text-muted-foreground">#{index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => removeReferenceImage(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
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
