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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Upload, X, ImageIcon, AlertTriangle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Available aspect ratios
const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
] as const;

// Available resolutions
const RESOLUTIONS = [
  { value: "720p", label: "720p (Standard - Default)" },
  { value: "1080p", label: "1080p (High Quality - 8s only)" },
  { value: "4k", label: "4K (Ultra High Quality - 8s only)" },
] as const;

// Available durations
const DURATIONS = [
  { value: "4", label: "4 seconds" },
  { value: "6", label: "6 seconds" },
  { value: "8", label: "8 seconds (Default)" },
] as const;

// Generation modes
const MODES = [
  { value: "text", label: "Text-to-Video" },
  { value: "image", label: "Image-to-Video" },
  { value: "reference", label: "Reference Images (up to 3)" },
  { value: "frames", label: "First & Last Frames" },
  { value: "extension", label: "Extend Video" },
] as const;

// Extract values for zod enums
const ASPECT_RATIO_VALUES = ASPECT_RATIOS.map((a) => a.value) as [string, ...string[]];
const RESOLUTION_VALUES = RESOLUTIONS.map((r) => r.value) as [string, ...string[]];
const DURATION_VALUES = DURATIONS.map((d) => d.value) as [string, ...string[]];
const MODE_VALUES = MODES.map((m) => m.value) as [string, ...string[]];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 5MB. Please compress the image to under 5MB and try again.";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  mode: z.enum(MODE_VALUES),
  prompt: z.string().optional(),
  aspectRatio: z.enum(ASPECT_RATIO_VALUES),
  resolution: z.enum(RESOLUTION_VALUES),
  durationSeconds: z.enum(DURATION_VALUES),
  negativePrompt: z.string().optional(),
  // Image-to-video
  sourceImage: z.string().optional(),
  sourceImageFilename: z.string().optional(),
  // Reference images
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .optional(),
  // First/last frames
  firstFrame: z.string().optional(),
  firstFrameFilename: z.string().optional(),
  lastFrame: z.string().optional(),
  lastFrameFilename: z.string().optional(),
  // Video extension
  sourceVideo: z.string().optional(),
  sourceVideoFilename: z.string().optional(),
});

export type VeoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VeoFormValues) => void;
  defaultValues?: Partial<VeoFormValues>;
}

interface FileData {
  file: File | null;
  base64: string;
  filename: string;
  mimeType: string;
}

export const VeoDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [sourceImageFile, setSourceImageFile] = useState<FileData | null>(null);
  const [referenceImageFiles, setReferenceImageFiles] = useState<FileData[]>([]);
  const [firstFrameFile, setFirstFrameFile] = useState<FileData | null>(null);
  const [lastFrameFile, setLastFrameFile] = useState<FileData | null>(null);
  const [sourceVideoFile, setSourceVideoFile] = useState<FileData | null>(null);
  const [imageSizeError, setImageSizeError] = useState<string | null>(null);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const sourceVideoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<VeoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "veo",
      mode: defaultValues.mode || "text",
      prompt: defaultValues.prompt || "",
      aspectRatio: defaultValues.aspectRatio || "16:9",
      resolution: defaultValues.resolution || "720p",
      durationSeconds: defaultValues.durationSeconds || "8",
      negativePrompt: defaultValues.negativePrompt || "",
      sourceImage: defaultValues.sourceImage || "",
      referenceImages: defaultValues.referenceImages || [],
      firstFrame: defaultValues.firstFrame || "",
      lastFrame: defaultValues.lastFrame || "",
      sourceVideo: defaultValues.sourceVideo || "",
    },
  });

  const watchMode = form.watch("mode");
  const watchResolution = form.watch("resolution");
  const watchDuration = form.watch("durationSeconds");

  // Update duration when resolution changes (1080p/4k require 8s)
  useEffect(() => {
    if (watchResolution === "1080p" || watchResolution === "4k") {
      form.setValue("durationSeconds", "8");
    }
  }, [watchResolution, form]);

  // Update duration when mode changes (extension requires 8s)
  useEffect(() => {
    if (watchMode === "extension" || watchMode === "reference") {
      form.setValue("durationSeconds", "8");
    }
  }, [watchMode, form]);

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to get MIME type from file
  const getMimeType = (file: File): string => {
    return file.type || (file.name.endsWith(".mp4") ? "video/mp4" : "image/png");
  };

  // Handle source image upload
  const handleSourceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageSizeError(IMAGE_SIZE_ERROR_MSG);
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }
    setImageSizeError(null);

    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    setSourceImageFile({ file, base64, filename: file.name, mimeType });
    form.setValue("sourceImage", base64);
    form.setValue("sourceImageFilename", file.name);
  };

  // Handle reference images upload
  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    if (referenceImageFiles.length + files.length > 3) {
      toast.error("Maximum 3 reference images allowed");
      return;
    }

    const oversized = files.filter((f) => f.size > MAX_IMAGE_SIZE_BYTES);
    if (oversized.length > 0) {
      const msg =
        oversized.length === 1
          ? `${oversized[0].name} exceeds 5MB. Please compress the image and try again.`
          : `${oversized.map((f) => f.name).join(", ")} exceed 5MB. Please compress and try again.`;
      setImageSizeError(msg);
      toast.error(msg);
    }
    const validFiles = files.filter((f) => f.size <= MAX_IMAGE_SIZE_BYTES);
    if (validFiles.length > 0) setImageSizeError(null);

    const newFiles: FileData[] = [];
    for (const file of validFiles) {
      const base64 = await fileToBase64(file);
      const mimeType = getMimeType(file);
      newFiles.push({ file, base64, filename: file.name, mimeType });
    }

    setReferenceImageFiles([...referenceImageFiles, ...newFiles]);
    const updated = [
      ...(form.getValues("referenceImages") || []),
      ...newFiles.map((f) => ({ file: f.base64, filename: f.filename })),
    ];
    form.setValue("referenceImages", updated);
  };

  // Handle first frame upload
  const handleFirstFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageSizeError(IMAGE_SIZE_ERROR_MSG);
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }
    setImageSizeError(null);

    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    setFirstFrameFile({ file, base64, filename: file.name, mimeType });
    form.setValue("firstFrame", base64);
    form.setValue("firstFrameFilename", file.name);
  };

  // Handle last frame upload
  const handleLastFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageSizeError(IMAGE_SIZE_ERROR_MSG);
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }
    setImageSizeError(null);

    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    setLastFrameFile({ file, base64, filename: file.name, mimeType });
    form.setValue("lastFrame", base64);
    form.setValue("lastFrameFilename", file.name);
  };

  // Handle source video upload
  const handleSourceVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file size must be less than 50MB");
      return;
    }

    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    setSourceVideoFile({ file, base64, filename: file.name, mimeType });
    form.setValue("sourceVideo", base64);
    form.setValue("sourceVideoFilename", file.name);
  };

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    const updated = referenceImageFiles.filter((_, i) => i !== index);
    setReferenceImageFiles(updated);
    form.setValue(
      "referenceImages",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  useEffect(() => {
    if (open) {
      setImageSizeError(null);
      form.reset({
        variables: defaultValues.variables || "veo",
        mode: defaultValues.mode || "text",
        prompt: defaultValues.prompt || "",
        aspectRatio: defaultValues.aspectRatio || "16:9",
        resolution: defaultValues.resolution || "720p",
        durationSeconds: defaultValues.durationSeconds || "8",
        negativePrompt: defaultValues.negativePrompt || "",
        sourceImage: defaultValues.sourceImage || "",
        sourceImageFilename: defaultValues.sourceImageFilename,
        referenceImages: defaultValues.referenceImages || [],
        firstFrame: defaultValues.firstFrame || "",
        firstFrameFilename: defaultValues.firstFrameFilename,
        lastFrame: defaultValues.lastFrame || "",
        lastFrameFilename: defaultValues.lastFrameFilename,
        sourceVideo: defaultValues.sourceVideo || "",
        sourceVideoFilename: defaultValues.sourceVideoFilename || "",
      });
      // Restore file preview states from saved values (so they persist when reopening)
      setSourceImageFile(
        defaultValues.sourceImage?.startsWith("data:")
          ? {
              file: null,
              base64: defaultValues.sourceImage,
              filename: defaultValues.sourceImageFilename || "image.png",
              mimeType: "image/png",
            }
          : null
      );
      setReferenceImageFiles(
        (defaultValues.referenceImages || []).map((ref) => ({
          file: null,
          base64: ref.file,
          filename: ref.filename,
          mimeType: "image/png",
        }))
      );
      setFirstFrameFile(
        defaultValues.firstFrame?.startsWith("data:")
          ? {
              file: null,
              base64: defaultValues.firstFrame,
              filename: defaultValues.firstFrameFilename || "frame.png",
              mimeType: "image/png",
            }
          : null
      );
      setLastFrameFile(
        defaultValues.lastFrame?.startsWith("data:")
          ? {
              file: null,
              base64: defaultValues.lastFrame,
              filename: defaultValues.lastFrameFilename || "frame.png",
              mimeType: "image/png",
            }
          : null
      );
      setSourceVideoFile(
        defaultValues.sourceVideo?.startsWith("data:")
          ? {
              file: null,
              base64: defaultValues.sourceVideo,
              filename: defaultValues.sourceVideoFilename || "video.mp4",
              mimeType: "video/mp4",
            }
          : null
      );
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "veo";

  const handleSubmit = async (values: VeoFormValues) => {
    // Validate mode-specific requirements
    if (values.mode !== "extension" && !values.prompt) {
      toast.error("Prompt is required for this mode");
      return;
    }

    if (values.mode === "image" && !values.sourceImage) {
      toast.error("Source image is required for image-to-video mode");
      return;
    }

    if (
      values.mode === "reference" &&
      (!values.referenceImages || values.referenceImages.length === 0)
    ) {
      toast.error("At least one reference image is required");
      return;
    }

    if (values.mode === "frames" && (!values.firstFrame || !values.lastFrame)) {
      toast.error("Both first and last frames are required");
      return;
    }

    if (values.mode === "extension" && !values.sourceVideo) {
      toast.error("Source video is required for extension mode");
      return;
    }

    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Veo node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-500" />
            Veo Video
          </DialogTitle>
          <DialogDescription>
            Generate high-fidelity videos with Veo 3.1. Supports text-to-video, image-to-video,
            reference images, and video extension.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <Alert variant="default" className="border-muted">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>File size limit:</strong> Each image must not exceed 5MB. Please compress
                  large images before uploading. For Extend Video mode, reference a previous Veo
                  node (e.g. {"{{veo.videoUrl}}"})—no upload.
                </AlertDescription>
              </Alert>
              {imageSizeError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{imageSizeError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="veo" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code className="text-xs">{`{{${watchVariables}.videoUrl}}`}</code> - Video
                      URL
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
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Generation Mode</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {MODES.map((mode) => (
                          <div key={mode.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={mode.value} id={mode.value} />
                            <Label
                              htmlFor={mode.value}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {mode.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>Choose how you want to generate the video.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchMode !== "extension" && (
                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Prompt {watchMode === "extension" ? "(Optional)" : "(Required)"}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="A cinematic shot of a majestic lion in the savannah, golden hour lighting, slow camera movement"
                          className="min-h-[120px] font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        Describe the video you want to generate. Use {"{{variables}}"} to include
                        dynamic content from previous nodes.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchMode === "extension" && (
                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extension Prompt (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Extend this video naturally, continue the motion..."
                          className="min-h-[100px] font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        Describe how to extend the video. If empty, the video will be extended
                        naturally.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchMode === "image" && (
                <FormField
                  control={form.control}
                  name="sourceImage"
                  render={() => (
                    <FormItem>
                      <FormLabel>Source Image</FormLabel>
                      <div className="space-y-2">
                        {sourceImageFile ? (
                          <div className="relative border rounded-md p-2">
                            <img
                              src={sourceImageFile.base64}
                              alt="Source"
                              className="max-h-32 w-auto mx-auto"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                setSourceImageFile(null);
                                setImageSizeError(null);
                                form.setValue("sourceImage", "");
                                form.setValue("sourceImageFilename", "");
                                if (sourceImageInputRef.current) {
                                  sourceImageInputRef.current.value = "";
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => sourceImageInputRef.current?.click()}
                            className="w-full"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Source Image
                          </Button>
                        )}
                        <input
                          ref={sourceImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleSourceImageUpload}
                          className="hidden"
                        />
                      </div>
                      <FormDescription>
                        Upload an image to animate. The video will start from this image.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              {watchMode === "reference" && (
                <FormField
                  control={form.control}
                  name="referenceImages"
                  render={() => (
                    <FormItem>
                      <FormLabel>Reference Images (up to 3)</FormLabel>
                      <div className="space-y-2">
                        {referenceImageFiles.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {referenceImageFiles.map((img, index) => (
                              <div key={index} className="relative border rounded-md p-2">
                                <img
                                  src={img.base64}
                                  alt={`Reference ${index + 1}`}
                                  className="max-h-24 w-auto mx-auto"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-1 right-1 h-6 w-6 p-0"
                                  onClick={() => removeReferenceImage(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {referenceImageFiles.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => referenceImagesInputRef.current?.click()}
                            className="w-full"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Add Reference Images ({referenceImageFiles.length}/3)
                          </Button>
                        )}
                        <input
                          ref={referenceImagesInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleReferenceImagesUpload}
                          className="hidden"
                        />
                      </div>
                      <FormDescription>
                        Upload up to 3 reference images to guide the video's content and style.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              {watchMode === "frames" && (
                <>
                  <FormField
                    control={form.control}
                    name="firstFrame"
                    render={() => (
                      <FormItem>
                        <FormLabel>First Frame</FormLabel>
                        <div className="space-y-2">
                          {firstFrameFile ? (
                            <div className="relative border rounded-md p-2">
                              <img
                                src={firstFrameFile.base64}
                                alt="First Frame"
                                className="max-h-32 w-auto mx-auto"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  setFirstFrameFile(null);
                                  form.setValue("firstFrame", "");
                                  form.setValue("firstFrameFilename", "");
                                  if (firstFrameInputRef.current) {
                                    firstFrameInputRef.current.value = "";
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => firstFrameInputRef.current?.click()}
                              className="w-full"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload First Frame
                            </Button>
                          )}
                          <input
                            ref={firstFrameInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFirstFrameUpload}
                            className="hidden"
                          />
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastFrame"
                    render={() => (
                      <FormItem>
                        <FormLabel>Last Frame</FormLabel>
                        <div className="space-y-2">
                          {lastFrameFile ? (
                            <div className="relative border rounded-md p-2">
                              <img
                                src={lastFrameFile.base64}
                                alt="Last Frame"
                                className="max-h-32 w-auto mx-auto"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  setLastFrameFile(null);
                                  form.setValue("lastFrame", "");
                                  form.setValue("lastFrameFilename", "");
                                  if (lastFrameInputRef.current) {
                                    lastFrameInputRef.current.value = "";
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => lastFrameInputRef.current?.click()}
                              className="w-full"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Last Frame
                            </Button>
                          )}
                          <input
                            ref={lastFrameInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLastFrameUpload}
                            className="hidden"
                          />
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {watchMode === "extension" && (
                <FormField
                  control={form.control}
                  name="sourceVideo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Previous Veo Node</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. {{veo.videoUrl}}"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            field.onChange(v || undefined);
                          }}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        Reference a Veo node in this workflow (e.g. {"{{veo.videoUrl}}"}). Extension
                        only works with videos from another Veo node in the same run—no file upload
                        needed.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormDescription>Choose the video aspect ratio.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resolution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RESOLUTIONS.map((res) => (
                          <SelectItem key={res.value} value={res.value}>
                            {res.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchResolution === "1080p" || watchResolution === "4k"
                        ? "1080p and 4K only support 8-second duration."
                        : "Choose the video resolution. Higher resolution takes longer to generate."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={
                        watchResolution === "1080p" ||
                        watchResolution === "4k" ||
                        watchMode === "extension" ||
                        watchMode === "reference"
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATIONS.map((dur) => (
                          <SelectItem key={dur.value} value={dur.value}>
                            {dur.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchMode === "extension" || watchMode === "reference"
                        ? "Extension and reference image modes require 8-second duration."
                        : watchResolution === "1080p" || watchResolution === "4k"
                          ? "1080p and 4K resolutions require 8-second duration."
                          : "Choose the video duration in seconds."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="negativePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Negative Prompt (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="cartoon, drawing, low quality"
                        className="min-h-[80px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>Describe what you don't want in the video.</FormDescription>
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
