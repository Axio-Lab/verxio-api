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
import { Loader2, Upload, X, ImageIcon, Video } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";

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
  mode: z.enum(["text", "image", "reference", "frames"]),
  // Image-to-video (first frame)
  firstFrameImage: z.string().optional(),
  firstFrameImageFilename: z.string().optional(),
  // First and last frames
  firstFrame: z.string().optional(),
  firstFrameFilename: z.string().optional(),
  lastFrame: z.string().optional(),
  lastFrameFilename: z.string().optional(),
  // Reference images (1-4)
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .optional(),
  // Video parameters
  generateAudio: z.boolean().optional(),
  ratio: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]).optional(),
  duration: z.number().min(2).max(12).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  cameraFixed: z.boolean().optional(),
  draft: z.boolean().optional(),
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
  const firstFrameImageInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);

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
      generateAudio: defaultValues.generateAudio ?? false,
      ratio: defaultValues.ratio ?? "adaptive",
      duration: defaultValues.duration ?? 5,
      resolution: defaultValues.resolution ?? "720p",
      cameraFixed: defaultValues.cameraFixed ?? false,
      draft: defaultValues.draft ?? false,
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
        generateAudio: defaultValues.generateAudio ?? false,
        ratio: defaultValues.ratio ?? "adaptive",
        duration: defaultValues.duration ?? 5,
        resolution: defaultValues.resolution ?? "720p",
        cameraFixed: defaultValues.cameraFixed ?? false,
        draft: defaultValues.draft ?? false,
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
      if (referenceImageFiles.length + newFiles.length >= 4) {
        toast.error("Maximum 4 reference images allowed");
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

    const updatedFiles = [...referenceImageFiles, ...newFiles].slice(0, 4);
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
    if (values.mode === "reference" && referenceImageFiles.length === 0) {
      toast.error("At least one reference image is required");
      return;
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
            Generate videos using BytePlus Seedance 1.5 Pro. Supports text-to-video, image-to-video,
            and multi-reference image generation.
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
                    Variable name to store the result (e.g., seedance.videoUrl)
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
                        <Label htmlFor="mode-reference">Reference Images (1-4)</Label>
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
              <FormField
                control={form.control}
                name="referenceImages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Images (1-4)</FormLabel>
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
                          disabled={referenceImageFiles.length >= 4}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Reference Images ({referenceImageFiles.length}/4)
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
                      Upload 1-4 reference images. The model will generate video matching their
                      style and features.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="1080p">1080p</SelectItem>
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
                      max={12}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                    />
                  </FormControl>
                  <FormDescription>4-12 seconds (Seedance 1.5 Pro)</FormDescription>
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
                        Generate synchronized audio (Seedance 1.5 Pro only)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="draft"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Draft Mode</FormLabel>
                      <FormDescription>
                        Generate a preview video at lower cost (480p only, Seedance 1.5 Pro only)
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
              <Button type="submit">Save Configuration</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
