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
import { Loader2, Upload, X, ImageIcon, Video, FileAudio } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

/** Seedance 2.0 (dreamina-seedance-2-0): up to 9 reference images. */
const MAX_REFERENCE_IMAGES = 9;
const MAX_REFERENCE_VIDEOS = 3;
const MAX_REFERENCE_AUDIOS = 3;
const MAX_REFERENCE_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_REFERENCE_AUDIO_BYTES = 15 * 1024 * 1024;
const REF_VIDEO_SIZE_MSG = "Each reference video must be under 50 MB.";
const REF_AUDIO_SIZE_MSG = "Each reference audio file must be under 15 MB.";

function coerceSeedance20Duration(d: number | undefined): number {
  if (d === undefined || !Number.isFinite(d)) return 5;
  return Math.min(15, Math.max(4, Math.round(d)));
}

function coerceSeedance20Resolution(r: string | undefined): "480p" | "720p" {
  if (r === "480p" || r === "720p") return r;
  return "720p";
}

const formSchema = z.object({
  variables: z
    .string()
    .min(1)
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Use letters, numbers, underscores" })
    .optional(),
  prompt: z.string().max(2500).optional(),
  mode: z.enum(["text", "image", "reference", "frames"]),
  // Image-to-video (first frame)
  firstFrameImage: z.string().optional(),
  firstFrameImageFilename: z.string().optional(),
  // First and last frames
  firstFrame: z.string().optional(),
  firstFrameFilename: z.string().optional(),
  lastFrame: z.string().optional(),
  lastFrameFilename: z.string().optional(),
  // Reference images (Seedance 2.0: 1–9)
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .max(MAX_REFERENCE_IMAGES)
    .optional(),
  referenceVideos: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string().optional(),
      })
    )
    .max(MAX_REFERENCE_VIDEOS)
    .optional(),
  referenceAudios: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string().optional(),
      })
    )
    .max(MAX_REFERENCE_AUDIOS)
    .optional(),
  // Video parameters
  generateAudio: z.boolean().optional(),
  ratio: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]).optional(),
  duration: z.number().int().min(4).max(15).optional(),
  resolution: z.enum(["480p", "720p"]).optional(),
  returnLastFrame: z.boolean().optional(),
});

export type SeedanceFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SeedanceFormValues) => void;
  defaultValues?: Partial<SeedanceFormValues>;
}

interface FileData {
  file: File | null;
  base64: string;
  filename: string;
  mimeType: string;
}

export const SeedanceDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [firstFrameImageFile, setFirstFrameImageFile] = useState<FileData | null>(null);
  const [firstFrameFile, setFirstFrameFile] = useState<FileData | null>(null);
  const [lastFrameFile, setLastFrameFile] = useState<FileData | null>(null);
  const [referenceImageFiles, setReferenceImageFiles] = useState<FileData[]>([]);
  const [referenceVideoFiles, setReferenceVideoFiles] = useState<FileData[]>([]);
  const [referenceAudioFiles, setReferenceAudioFiles] = useState<FileData[]>([]);
  const firstFrameImageInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const referenceVideosInputRef = useRef<HTMLInputElement>(null);
  const referenceAudiosInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SeedanceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "seedance",
      prompt: defaultValues.prompt ?? "",
      mode: defaultValues.mode ?? "text",
      firstFrameImage: defaultValues.firstFrameImage ?? "",
      firstFrameImageFilename: defaultValues.firstFrameImageFilename ?? "",
      firstFrame: defaultValues.firstFrame ?? "",
      firstFrameFilename: defaultValues.firstFrameFilename ?? "",
      lastFrame: defaultValues.lastFrame ?? "",
      lastFrameFilename: defaultValues.lastFrameFilename ?? "",
      referenceImages: defaultValues.referenceImages ?? [],
      referenceVideos: defaultValues.referenceVideos ?? [],
      referenceAudios: defaultValues.referenceAudios ?? [],
      generateAudio: defaultValues.generateAudio ?? true,
      ratio: defaultValues.ratio ?? "adaptive",
      duration: coerceSeedance20Duration(defaultValues.duration as number | undefined),
      resolution: coerceSeedance20Resolution(defaultValues.resolution as string | undefined),
      returnLastFrame: defaultValues.returnLastFrame ?? false,
    },
  });

  const watchMode = form.watch("mode");

  useEffect(() => {
    if (open) {
      // Reset file states
      setFirstFrameImageFile(null);
      setFirstFrameFile(null);
      setLastFrameFile(null);
      setReferenceImageFiles([]);
      setReferenceVideoFiles([]);
      setReferenceAudioFiles([]);

      // Load default values
      if (defaultValues.firstFrameImage) {
        const filename =
          defaultValues.firstFrameImageFilename ||
          (defaultValues.firstFrameImage.startsWith("asset:")
            ? defaultValues.firstFrameImage.replace("asset:", "")
            : "first-frame.png");
        setFirstFrameImageFile({
          file: null,
          base64: defaultValues.firstFrameImage,
          filename,
          mimeType: defaultValues.firstFrameImage.startsWith("data:")
            ? defaultValues.firstFrameImage.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      }

      if (defaultValues.firstFrame) {
        const filename =
          defaultValues.firstFrameFilename ||
          (defaultValues.firstFrame.startsWith("asset:")
            ? defaultValues.firstFrame.replace("asset:", "")
            : "first-frame.png");
        setFirstFrameFile({
          file: null,
          base64: defaultValues.firstFrame,
          filename,
          mimeType: defaultValues.firstFrame.startsWith("data:")
            ? defaultValues.firstFrame.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      }

      if (defaultValues.lastFrame) {
        const filename =
          defaultValues.lastFrameFilename ||
          (defaultValues.lastFrame.startsWith("asset:")
            ? defaultValues.lastFrame.replace("asset:", "")
            : "last-frame.png");
        setLastFrameFile({
          file: null,
          base64: defaultValues.lastFrame,
          filename,
          mimeType: defaultValues.lastFrame.startsWith("data:")
            ? defaultValues.lastFrame.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      }

      if (defaultValues.referenceImages && defaultValues.referenceImages.length > 0) {
        const files = defaultValues.referenceImages.slice(0, MAX_REFERENCE_IMAGES).map((ref) => ({
          file: null,
          base64: ref.file,
          filename: ref.filename,
          mimeType: ref.file.startsWith("data:")
            ? ref.file.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        }));
        setReferenceImageFiles(files);
      }

      if (defaultValues.referenceVideos && defaultValues.referenceVideos.length > 0) {
        const files = defaultValues.referenceVideos.slice(0, MAX_REFERENCE_VIDEOS).map((ref) => ({
          file: null,
          base64: ref.file,
          filename: ref.filename || "reference.mp4",
          mimeType: ref.file.startsWith("data:")
            ? ref.file.match(/data:([^;]+)/)?.[1] || "video/mp4"
            : "video/mp4",
        }));
        setReferenceVideoFiles(files);
      }

      if (defaultValues.referenceAudios && defaultValues.referenceAudios.length > 0) {
        const files = defaultValues.referenceAudios.slice(0, MAX_REFERENCE_AUDIOS).map((ref) => ({
          file: null,
          base64: ref.file,
          filename: ref.filename || "reference.mp3",
          mimeType: ref.file.startsWith("data:")
            ? ref.file.match(/data:([^;]+)/)?.[1] || "audio/mpeg"
            : "audio/mpeg",
        }));
        setReferenceAudioFiles(files);
      }

      form.reset({
        variables: defaultValues.variables ?? "seedance",
        prompt: defaultValues.prompt ?? "",
        mode: defaultValues.mode ?? "text",
        firstFrameImage: defaultValues.firstFrameImage ?? "",
        firstFrameImageFilename: defaultValues.firstFrameImageFilename ?? "",
        firstFrame: defaultValues.firstFrame ?? "",
        firstFrameFilename: defaultValues.firstFrameFilename ?? "",
        lastFrame: defaultValues.lastFrame ?? "",
        lastFrameFilename: defaultValues.lastFrameFilename ?? "",
        referenceImages: defaultValues.referenceImages ?? [],
        referenceVideos: defaultValues.referenceVideos ?? [],
        referenceAudios: defaultValues.referenceAudios ?? [],
        generateAudio: defaultValues.generateAudio ?? true,
        ratio: defaultValues.ratio ?? "adaptive",
        duration: coerceSeedance20Duration(defaultValues.duration as number | undefined),
        resolution: coerceSeedance20Resolution(defaultValues.resolution as string | undefined),
        returnLastFrame: defaultValues.returnLastFrame ?? false,
      });
    }
  }, [open, defaultValues, form]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: FileData | null) => void,
    formField: string,
    filenameField: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }

    const base64 = await fileToBase64(file);
    const fileData: FileData = {
      file,
      base64,
      filename: file.name,
      mimeType: file.type || "image/png",
    };
    setter(fileData);
    form.setValue(formField as any, base64);
    form.setValue(filenameField as any, file.name);
  };

  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    const newFiles: FileData[] = [];
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error(`${file.name}: ${IMAGE_SIZE_ERROR_MSG}`);
        continue;
      }
      if (referenceImageFiles.length + newFiles.length >= MAX_REFERENCE_IMAGES) {
        toast.error(`Maximum ${MAX_REFERENCE_IMAGES} reference images allowed`);
        break;
      }
      const base64 = await fileToBase64(file);
      newFiles.push({
        file,
        base64,
        filename: file.name,
        mimeType: file.type || "image/png",
      });
    }

    const updatedFiles = [...referenceImageFiles, ...newFiles].slice(0, MAX_REFERENCE_IMAGES);
    setReferenceImageFiles(updatedFiles);
    form.setValue(
      "referenceImages",
      updatedFiles.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const removeReferenceImage = (index: number) => {
    const updated = referenceImageFiles.filter((_, i) => i !== index);
    setReferenceImageFiles(updated);
    form.setValue(
      "referenceImages",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const handleReferenceVideosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";
    const newFiles: FileData[] = [];
    for (const file of files) {
      if (file.size > MAX_REFERENCE_VIDEO_BYTES) {
        toast.error(`${file.name}: ${REF_VIDEO_SIZE_MSG}`);
        continue;
      }
      if (referenceVideoFiles.length + newFiles.length >= MAX_REFERENCE_VIDEOS) {
        toast.error(`Maximum ${MAX_REFERENCE_VIDEOS} reference videos allowed`);
        break;
      }
      const base64 = await fileToBase64(file);
      newFiles.push({
        file,
        base64,
        filename: file.name,
        mimeType: file.type || "video/mp4",
      });
    }
    const updated = [...referenceVideoFiles, ...newFiles].slice(0, MAX_REFERENCE_VIDEOS);
    setReferenceVideoFiles(updated);
    form.setValue(
      "referenceVideos",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const removeReferenceVideo = (index: number) => {
    const updated = referenceVideoFiles.filter((_, i) => i !== index);
    setReferenceVideoFiles(updated);
    form.setValue(
      "referenceVideos",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const handleReferenceAudiosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";
    const newFiles: FileData[] = [];
    for (const file of files) {
      if (file.size > MAX_REFERENCE_AUDIO_BYTES) {
        toast.error(`${file.name}: ${REF_AUDIO_SIZE_MSG}`);
        continue;
      }
      if (referenceAudioFiles.length + newFiles.length >= MAX_REFERENCE_AUDIOS) {
        toast.error(`Maximum ${MAX_REFERENCE_AUDIOS} reference audio files allowed`);
        break;
      }
      const base64 = await fileToBase64(file);
      newFiles.push({
        file,
        base64,
        filename: file.name,
        mimeType: file.type || "audio/mpeg",
      });
    }
    const updated = [...referenceAudioFiles, ...newFiles].slice(0, MAX_REFERENCE_AUDIOS);
    setReferenceAudioFiles(updated);
    form.setValue(
      "referenceAudios",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const removeReferenceAudio = (index: number) => {
    const updated = referenceAudioFiles.filter((_, i) => i !== index);
    setReferenceAudioFiles(updated);
    form.setValue(
      "referenceAudios",
      updated.map((f) => ({ file: f.base64, filename: f.filename }))
    );
  };

  const handleSubmit = async (values: SeedanceFormValues) => {
    // Validate mode-specific requirements
    if (values.mode === "text" && !values.prompt?.trim()) {
      toast.error("Prompt is required for text-to-video mode");
      return;
    }
    if (values.mode === "image" && !firstFrameImageFile && !values.firstFrameImage) {
      toast.error("First frame image is required for image-to-video mode");
      return;
    }
    if (values.mode === "frames" && (!firstFrameFile || !lastFrameFile)) {
      toast.error("Both first and last frame images are required");
      return;
    }
    if (values.mode === "reference") {
      const imgCount = values.referenceImages?.length ?? 0;
      const vidCount = values.referenceVideos?.length ?? 0;
      if (imgCount + vidCount < 1) {
        toast.error("Add at least one reference image or video (audio cannot be used alone)");
        return;
      }
    }

    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Seedance node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seedance Video Generation</DialogTitle>
          <DialogDescription>
            Generate videos using BytePlus Seedance 2.0. Supports text-to-video, image-to-video,
            first/last frames, and multimodal reference (images, videos, audio).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Variable Name</FormLabel>
                  <FormControl>
                    <Input placeholder="seedance" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:
                    <br />
                    <code className="text-xs">{`{{${field.value || "seedance"}.videoUrl}}`}</code>
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
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="text" id="mode-text" />
                        <Label htmlFor="mode-text">Text-to-Video</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="image" id="mode-image" />
                        <Label htmlFor="mode-image">Image-to-Video (First Frame)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="frames" id="mode-frames" />
                        <Label htmlFor="mode-frames">First & Last Frames</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="reference" id="mode-reference" />
                        <Label htmlFor="mode-reference">
                          Multimodal reference (images / videos / audio)
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
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
                      placeholder="A girl holding a fox, the girl opens her eyes..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the video you want to generate. Required for text-to-video mode.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchMode === "image" && (
              <FormField
                control={form.control}
                name="firstFrameImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Frame Image</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          ref={firstFrameImageInputRef}
                          onChange={(e) =>
                            handleFileUpload(
                              e,
                              setFirstFrameImageFile,
                              "firstFrameImage",
                              "firstFrameImageFilename"
                            )
                          }
                          className="hidden"
                        />
                        {firstFrameImageFile ? (
                          <div className="flex items-center gap-2 p-2 border rounded">
                            <ImageIcon className="h-4 w-4" />
                            <span className="flex-1 text-sm truncate">
                              {firstFrameImageFile.filename}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFirstFrameImageFile(null);
                                form.setValue("firstFrameImage", "");
                                form.setValue("firstFrameImageFilename", "");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => firstFrameImageInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload First Frame
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchMode === "frames" && (
              <>
                <FormField
                  control={form.control}
                  name="firstFrame"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Frame</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            ref={firstFrameInputRef}
                            onChange={(e) =>
                              handleFileUpload(
                                e,
                                setFirstFrameFile,
                                "firstFrame",
                                "firstFrameFilename"
                              )
                            }
                            className="hidden"
                          />
                          {firstFrameFile ? (
                            <div className="flex items-center gap-2 p-2 border rounded">
                              <ImageIcon className="h-4 w-4" />
                              <span className="flex-1 text-sm truncate">
                                {firstFrameFile.filename}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFirstFrameFile(null);
                                  form.setValue("firstFrame", "");
                                  form.setValue("firstFrameFilename", "");
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
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload First Frame
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastFrame"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Frame</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            ref={lastFrameInputRef}
                            onChange={(e) =>
                              handleFileUpload(
                                e,
                                setLastFrameFile,
                                "lastFrame",
                                "lastFrameFilename"
                              )
                            }
                            className="hidden"
                          />
                          {lastFrameFile ? (
                            <div className="flex items-center gap-2 p-2 border rounded">
                              <ImageIcon className="h-4 w-4" />
                              <span className="flex-1 text-sm truncate">
                                {lastFrameFile.filename}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLastFrameFile(null);
                                  form.setValue("lastFrame", "");
                                  form.setValue("lastFrameFilename", "");
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
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Last Frame
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {watchMode === "reference" && (
              <>
                <FormField
                  control={form.control}
                  name="referenceImages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference images (optional, up to 9)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            ref={referenceImagesInputRef}
                            onChange={handleReferenceImagesUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => referenceImagesInputRef.current?.click()}
                            disabled={referenceImageFiles.length >= MAX_REFERENCE_IMAGES}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {`Upload Reference Images (${referenceImageFiles.length}/${MAX_REFERENCE_IMAGES})`}
                          </Button>
                          {referenceImageFiles.length > 0 && (
                            <div className="space-y-2">
                              {referenceImageFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  <span className="flex-1 text-sm truncate">{file.filename}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeReferenceImage(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Optional reference images (up to 9). Combine with videos/audio for
                        multimodal generation, or use images alone.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="referenceVideos"
                  render={() => (
                    <FormItem>
                      <FormLabel>Reference videos (optional, up to 3)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="video/mp4,video/quicktime,.mp4,.mov"
                            multiple
                            ref={referenceVideosInputRef}
                            onChange={handleReferenceVideosUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => referenceVideosInputRef.current?.click()}
                            disabled={referenceVideoFiles.length >= MAX_REFERENCE_VIDEOS}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            {`Upload reference videos (${referenceVideoFiles.length}/${MAX_REFERENCE_VIDEOS})`}
                          </Button>
                          {referenceVideoFiles.length > 0 && (
                            <div className="space-y-2">
                              {referenceVideoFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded"
                                >
                                  <Video className="h-4 w-4 shrink-0" />
                                  <span className="flex-1 text-sm truncate">{file.filename}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeReferenceVideo(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        MP4/MOV, under 50 MB each. API requires a public URL — uploads are sent via
                        your app server first. You can also use a public video URL in workflow JSON
                        (`referenceVideos`).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="referenceAudios"
                  render={() => (
                    <FormItem>
                      <FormLabel>Reference audio (optional, up to 3)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="audio/wav,audio/mpeg,.wav,.mp3"
                            multiple
                            ref={referenceAudiosInputRef}
                            onChange={handleReferenceAudiosUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => referenceAudiosInputRef.current?.click()}
                            disabled={referenceAudioFiles.length >= MAX_REFERENCE_AUDIOS}
                          >
                            <FileAudio className="h-4 w-4 mr-2" />
                            {`Upload reference audio (${referenceAudioFiles.length}/${MAX_REFERENCE_AUDIOS})`}
                          </Button>
                          {referenceAudioFiles.length > 0 && (
                            <div className="space-y-2">
                              {referenceAudioFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded"
                                >
                                  <FileAudio className="h-4 w-4 shrink-0" />
                                  <span className="flex-1 text-sm truncate">{file.filename}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeReferenceAudio(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        WAV/MP3, under 15 MB each. Requires at least one image or video. Optional
                        for lip-sync / sound design style guidance.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ratio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="adaptive">Adaptive</SelectItem>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="4:3">4:3</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="3:4">3:4</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="21:9">21:9</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="480p">480p</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={4}
                      max={15}
                      {...field}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        field.onChange(Number.isFinite(v) ? coerceSeedance20Duration(v) : 5);
                      }}
                    />
                  </FormControl>
                  <FormDescription>4–15 seconds (Seedance 2.0 API).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="generateAudio"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Generate Audio</FormLabel>
                      <FormDescription>
                        Generate synchronized audio (when supported by the model)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="returnLastFrame"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Return Last Frame</FormLabel>
                      <FormDescription>
                        Return the last frame of the video as a separate image URL. Useful for
                        chaining videos together or previewing the end state.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
              <Button type="submit">Save configuration</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
