"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod/v3";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

const formSchema = z.object({
  variables: z
    .string()
    .min(1)
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Use letters, numbers, underscores" })
    .optional(),
  prompt: z.string().max(2500).optional(),
  mode: z.enum(["text", "image", "multi"]),
  // Single source image
  sourceImage: z.string().optional(),
  sourceImageFilename: z.string().optional(),
  // Reference images for multi-image mode
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .optional(),
  size: z.string().optional(),
  sequentialImageGeneration: z.enum(["disabled", "auto"]).optional(),
  maxImages: z.number().min(1).max(14).optional(),
});

export type SeedreamFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SeedreamFormValues) => void;
  defaultValues?: Partial<SeedreamFormValues>;
}

interface FileData {
  file: File | null;
  base64: string;
  filename: string;
  mimeType: string;
}

export const SeedreamDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [sourceImageFile, setSourceImageFile] = useState<FileData | null>(null);
  const [referenceImageFiles, setReferenceImageFiles] = useState<FileData[]>([]);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SeedreamFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "seedream",
      prompt: defaultValues.prompt ?? "",
      mode: defaultValues.mode ?? "text",
      sourceImage: defaultValues.sourceImage ?? "",
      sourceImageFilename: defaultValues.sourceImageFilename ?? "",
      referenceImages: defaultValues.referenceImages ?? [],
      size: defaultValues.size ?? "2K",
      sequentialImageGeneration: defaultValues.sequentialImageGeneration ?? "disabled",
      maxImages: defaultValues.maxImages ?? 1,
    },
  });

  const watchMode = form.watch("mode");
  const watchSequential = form.watch("sequentialImageGeneration");

  useEffect(() => {
    if (open) {
      setSourceImageFile(null);
      setReferenceImageFiles([]);

      if (defaultValues.sourceImage) {
        const filename =
          defaultValues.sourceImageFilename ||
          (defaultValues.sourceImage.startsWith("asset:")
            ? defaultValues.sourceImage.replace("asset:", "")
            : "source-image.png");
        setSourceImageFile({
          file: null,
          base64: defaultValues.sourceImage,
          filename,
          mimeType: defaultValues.sourceImage.startsWith("data:")
            ? defaultValues.sourceImage.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      }

      if (defaultValues.referenceImages && defaultValues.referenceImages.length > 0) {
        const files = defaultValues.referenceImages.map((ref) => ({
          file: null,
          base64: ref.file,
          filename: ref.filename,
          mimeType: ref.file.startsWith("data:")
            ? ref.file.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        }));
        setReferenceImageFiles(files);
      }

      form.reset({
        variables: defaultValues.variables ?? "seedream",
        prompt: defaultValues.prompt ?? "",
        mode: defaultValues.mode ?? "text",
        sourceImage: defaultValues.sourceImage ?? "",
        sourceImageFilename: defaultValues.sourceImageFilename ?? "",
        referenceImages: defaultValues.referenceImages ?? [],
        size: defaultValues.size ?? "2K",
        sequentialImageGeneration: defaultValues.sequentialImageGeneration ?? "disabled",
        maxImages: defaultValues.maxImages ?? 1,
      });
    }
  }, [open, defaultValues, form]);

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "source" | "reference"
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;

      if (type === "source") {
        setSourceImageFile({
          file,
          base64,
          filename: file.name,
          mimeType: file.type || "image/png",
        });
        form.setValue("sourceImage", base64);
        form.setValue("sourceImageFilename", file.name);
      } else {
        const newFileData: FileData = {
          file,
          base64,
          filename: file.name,
          mimeType: file.type || "image/png",
        };
        const updated = [...referenceImageFiles, newFileData];
        setReferenceImageFiles(updated);
        form.setValue(
          "referenceImages",
          updated.map((f) => ({
            file: f.base64,
            filename: f.filename,
          }))
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReferenceImage = (index: number) => {
    const updated = referenceImageFiles.filter((_, i) => i !== index);
    setReferenceImageFiles(updated);
    form.setValue(
      "referenceImages",
      updated.map((f) => ({
        file: f.base64,
        filename: f.filename,
      }))
    );
  };

  const handleSubmit = (values: SeedreamFormValues) => {
    const mode = values.mode;

    if (mode === "text" && !values.prompt?.trim()) {
      toast.error("Prompt is required for text-to-image mode.");
      return;
    }

    if (mode === "image" && !values.sourceImage) {
      toast.error("Source image is required for image-to-image mode.");
      return;
    }

    if (mode === "multi" && (!values.referenceImages || values.referenceImages.length === 0)) {
      toast.error("At least one reference image is required for multi-image mode.");
      return;
    }

    onSubmit(values);
    onOpenChange(false);
    toast.success("Seedream node configuration saved.");
    form.reset(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Seedream</DialogTitle>
          <DialogDescription>
            Configure BytePlus Seedream 4.5 image generation. Supports text-to-image, image editing,
            and multi-image blending.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 flex-1 overflow-y-auto pr-1"
          >
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Variable Name</FormLabel>
                  <FormControl>
                    <Input placeholder="seedream" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:
                    <br />
                    <code className="text-xs">{`{{${field.value || "seedream"}.imageUrl}}`}</code>
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
                      placeholder="Describe the image you want Seedream to generate..."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Natural language description of the desired image. Keep under ~600 English words
                    for best results.
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
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                    >
                      <FormItem className="flex items-start space-x-2 space-y-0 border rounded-md p-3">
                        <FormControl>
                          <RadioGroupItem value="text" />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium">Text to Image</FormLabel>
                          <FormDescription className="text-xs">
                            Generate an image from a text prompt only.
                          </FormDescription>
                        </div>
                      </FormItem>
                      <FormItem className="flex items-start space-x-2 space-y-0 border rounded-md p-3">
                        <FormControl>
                          <RadioGroupItem value="image" />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium">Image to Image</FormLabel>
                          <FormDescription className="text-xs">
                            Edit or restyle a single image using the prompt.
                          </FormDescription>
                        </div>
                      </FormItem>
                      <FormItem className="flex items-start space-x-2 space-y-0 border rounded-md p-3">
                        <FormControl>
                          <RadioGroupItem value="multi" />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium">Multi-Image Blend</FormLabel>
                          <FormDescription className="text-xs">
                            Blend multiple reference images guided by the prompt.
                          </FormDescription>
                        </div>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(watchMode === "image" || watchMode === "multi") && (
              <div className="space-y-4">
                {watchMode === "image" && (
                  <FormField
                    control={form.control}
                    name="sourceImage"
                    render={() => (
                      <FormItem>
                        <FormLabel>Source image</FormLabel>
                        <FormDescription>
                          Upload or reference an image to edit. Seedream will follow your prompt
                          while preserving core structure.
                        </FormDescription>
                        <div className="mt-2 flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => sourceImageInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload image
                          </Button>
                          {sourceImageFile && (
                            <div className="flex items-center gap-2 text-xs">
                              <ImageIcon className="w-3 h-3" />
                              <span className="truncate max-w-[160px]">
                                {sourceImageFile.filename}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setSourceImageFile(null);
                                  form.setValue("sourceImage", "");
                                  form.setValue("sourceImageFilename", "");
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <input
                          ref={sourceImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileChange(e, "source")}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchMode === "multi" && (
                  <FormField
                    control={form.control}
                    name="referenceImages"
                    render={() => (
                      <FormItem>
                        <FormLabel>Reference images</FormLabel>
                        <FormDescription>
                          Upload 1–4 images to blend (e.g. outfit pieces, subjects, backgrounds).
                        </FormDescription>
                        <div className="mt-2 space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => referenceImagesInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload reference image
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            {referenceImageFiles.map((file, index) => (
                              <div
                                key={`${file.filename}-${index}`}
                                className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{file.filename}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => handleRemoveReferenceImage(index)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <input
                          ref={referenceImagesInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileChange(e, "reference")}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image size</FormLabel>
                    <FormControl>
                      <Input placeholder="2K or 2048x2048" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use `2K` / `4K` or explicit `widthxheight` (e.g. 2048x2048).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sequentialImageGeneration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch generation</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <Label className="flex items-center space-x-2">
                          <RadioGroupItem value="disabled" />
                          <span className="text-sm">Single image</span>
                        </Label>
                        <Label className="flex items-center space-x-2">
                          <RadioGroupItem value="auto" />
                          <span className="text-sm">Sequential batch (auto)</span>
                        </Label>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Enable sequential generation to let Seedream create a small set of related
                      images in one run.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchSequential === "auto" && (
              <FormField
                control={form.control}
                name="maxImages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max images</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={field.value ?? 4}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of images Seedream should generate in this batch (up to 14
                      allowed by the API).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
              <Button type="submit" className="ml-auto">
                Save configuration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
