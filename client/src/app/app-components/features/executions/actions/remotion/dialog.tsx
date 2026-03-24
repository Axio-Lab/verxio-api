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
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Upload,
  X,
  Music,
  Image as ImageIcon,
  Video,
  FileAudio,
  AlertTriangle,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VIDEO_FORMATS = [
  { value: "16:9", label: "16:9 (Landscape - 1920x1080)", description: "YouTube, presentations" },
  {
    value: "9:16",
    label: "9:16 (Portrait - 1080x1920)",
    description: "Instagram Stories, TikTok, Reels",
  },
  { value: "1:1", label: "1:1 (Square - 1080x1080)", description: "Instagram posts" },
  { value: "4:3", label: "4:3 (Classic - 1440x1080)", description: "Traditional video" },
  { value: "21:9", label: "21:9 (Ultrawide - 2560x1080)", description: "Cinematic" },
] as const;

const VIDEO_FORMAT_VALUES = VIDEO_FORMATS.map((f) => f.value) as [string, ...string[]];

const assetSchema = z.object({
  file: z.string(),
  filename: z.string(),
  type: z.enum(["image", "video", "audio"]),
  sceneDescription: z.string().optional(),
  startTime: z.number().optional(),
  position: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .optional(),
  size: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
});

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  prompt: z.string().min(10, { message: "Prompt must be at least 10 characters" }),
  videoFormat: z.enum(VIDEO_FORMAT_VALUES),
  backgroundAudio: z.string().optional(),
  backgroundAudioFilename: z.string().optional(),
  backgroundAudioVolume: z.number().min(0).max(1),
  assets: z.array(assetSchema).optional(),
});

export type RemotionFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RemotionFormValues) => void;
  defaultValues?: Partial<RemotionFormValues>;
}

interface AssetFile {
  file: File;
  base64: string; // base64 for preview OR URL if already uploaded
  filename: string;
  type: "image" | "video" | "audio";
  sceneDescription?: string;
  startTime?: number;
  position?: { x?: number; y?: number };
  size?: { width?: number; height?: number };
  originalUrl?: string; // Store original URL if it was loaded from URL
}

export const RemotionDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [backgroundAudioFile, setBackgroundAudioFile] = useState<File | null>(null);
  const [backgroundAudioBase64, setBackgroundAudioBase64] = useState<string>("");
  const [backgroundAudioOriginalUrl, setBackgroundAudioOriginalUrl] = useState<string | null>(null);
  const [backgroundAudioVolume, setBackgroundAudioVolume] = useState<number>(0.7);
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const backgroundAudioInputRef = useRef<HTMLInputElement>(null);
  const assetsInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<RemotionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "remotion",
      prompt: defaultValues.prompt || "",
      videoFormat: defaultValues.videoFormat || "16:9",
      backgroundAudio: defaultValues.backgroundAudio || "",
      backgroundAudioFilename: defaultValues.backgroundAudioFilename || "",
      backgroundAudioVolume: defaultValues.backgroundAudioVolume ?? 0.7,
      assets: defaultValues.assets || [],
    },
  });

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Convert file to base64 data URL (no Pinata upload)
  const convertFileToDataUrl = async (file: File): Promise<string> => {
    const base64 = await fileToBase64(file);
    return `data:${file.type};base64,${base64}`;
  };

  // Get file type from file
  const getFileType = (file: File): "image" | "video" | "audio" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "image"; // default
  };

  // Sanitize filename to remove special characters that cause file system issues
  const sanitizeFilename = (filename: string): string => {
    // Remove or replace problematic characters: < > : " / \ | ? *
    // Also replace spaces with underscores for consistency
    return filename.replace(/[<>:"/\\|?*\s]/g, "_").trim();
  };

  // Handle background audio selection (preview only, upload on save)
  const handleBackgroundAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file (MP3, WAV, OGG, M4A, AAC)");
      return;
    }

    try {
      // Convert to base64 for preview (not uploaded yet)
      const base64 = await fileToBase64(file);
      const sanitizedFilename = sanitizeFilename(file.name);
      setBackgroundAudioFile(file);
      setBackgroundAudioBase64(base64); // Store base64 for preview
      form.setValue("backgroundAudio", base64); // Temporary base64 until save
      form.setValue("backgroundAudioFilename", sanitizedFilename); // Use sanitized filename
      toast.success("Background audio selected");
    } catch (error) {
      toast.error("Failed to process audio file");
    }
  };

  // Remove background audio
  const removeBackgroundAudio = () => {
    setBackgroundAudioFile(null);
    setBackgroundAudioBase64("");
    setBackgroundAudioOriginalUrl(null);
    form.setValue("backgroundAudio", "");
    form.setValue("backgroundAudioFilename", "");
    if (backgroundAudioInputRef.current) {
      backgroundAudioInputRef.current.value = "";
    }
  };

  // Handle asset upload
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => {
      const isValid =
        f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/");
      if (!isValid) {
        toast.error(`${f.name}: Unsupported file type`);
      }
      return isValid;
    });

    try {
      const selectedAssets = await Promise.all(
        validFiles.map(async (file) => {
          // Convert to base64 for preview (not uploaded yet)
          const base64 = await fileToBase64(file);
          const type = getFileType(file);
          const sanitizedFilename = sanitizeFilename(file.name);
          return {
            file,
            base64, // Store base64 for preview until save
            filename: sanitizedFilename, // Use sanitized filename
            type,
          } as AssetFile;
        })
      );

      setAssets([...assets, ...selectedAssets]);
      toast.success(`Selected ${selectedAssets.length} asset(s)`);
    } catch (error) {
      toast.error("Failed to process assets");
    }
  };

  // Remove asset
  const removeAsset = (index: number) => {
    const newAssets = assets.filter((_, i) => i !== index);
    setAssets(newAssets);
  };

  // Update asset scene description
  const updateAssetSceneDescription = (index: number, description: string) => {
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], sceneDescription: description };
    setAssets(newAssets);
  };

  // Helper to fetch file from URL and convert to base64 for preview
  const fetchFileFromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch");
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching file from URL:", error);
      return url; // Return URL as fallback
    }
  };

  useEffect(() => {
    if (open) {
      // Load background audio if exists
      const loadBackgroundAudio = async () => {
        if (defaultValues.backgroundAudio && defaultValues.backgroundAudioFilename) {
          const isUrl = defaultValues.backgroundAudio.startsWith("http");
          // Sanitize filename if it has special characters (for backward compatibility)
          const sanitizedFilename = sanitizeFilename(defaultValues.backgroundAudioFilename);

          if (isUrl) {
            // It's a URL - store it directly, no need to fetch for preview
            setBackgroundAudioOriginalUrl(defaultValues.backgroundAudio);
            setBackgroundAudioBase64(defaultValues.backgroundAudio); // Store URL for display check
          } else {
            // It's base64 - use directly
            setBackgroundAudioOriginalUrl(null);
            setBackgroundAudioBase64(defaultValues.backgroundAudio);
          }

          form.setValue("backgroundAudio", defaultValues.backgroundAudio); // Store original (URL or base64)
          form.setValue("backgroundAudioFilename", sanitizedFilename); // Use sanitized filename
          setBackgroundAudioVolume(defaultValues.backgroundAudioVolume ?? 0.7);
        }
      };

      // Load assets if exist
      const loadAssets = async () => {
        if (defaultValues.assets && defaultValues.assets.length > 0) {
          const loadedAssets: AssetFile[] = defaultValues.assets.map((asset) => {
            // If it's a URL, use URL directly; otherwise use base64 directly
            let fileData = asset.file;

            // Sanitize filename if it has special characters (for backward compatibility)
            const sanitizedFilename = sanitizeFilename(asset.filename);

            // Determine file type from filename if not set
            const assetType =
              asset.type ||
              (sanitizedFilename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                ? "image"
                : sanitizedFilename.match(/\.(mp4|webm|mov|avi)$/i)
                  ? "video"
                  : sanitizedFilename.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
                    ? "audio"
                    : "image");

            if (asset.file.startsWith("http")) {
              // It's a URL - keep original URL
              fileData = asset.file;
            }

            return {
              file: new File([], sanitizedFilename), // Placeholder with sanitized name
              base64: fileData, // Store URL or base64
              filename: sanitizedFilename, // Use sanitized filename
              type: assetType as "image" | "video" | "audio",
              sceneDescription: asset.sceneDescription,
              startTime: asset.startTime,
              position: asset.position,
              size: asset.size,
              originalUrl: asset.file.startsWith("http") ? asset.file : undefined, // Store original URL if it was one
            } as AssetFile;
          });
          setAssets(loadedAssets);
        }
      };

      // Load data
      loadBackgroundAudio();
      loadAssets();

      form.reset({
        variables: defaultValues.variables || "remotion",
        prompt: defaultValues.prompt || "",
        videoFormat: defaultValues.videoFormat || "16:9",
        backgroundAudio: defaultValues.backgroundAudio || "",
        backgroundAudioFilename: defaultValues.backgroundAudioFilename || "",
        backgroundAudioVolume: defaultValues.backgroundAudioVolume ?? 0.7,
        assets: defaultValues.assets || [],
      });
    } else {
      // Reset when dialog closes
      setBackgroundAudioFile(null);
      setBackgroundAudioBase64("");
      setBackgroundAudioOriginalUrl(null);
      setAssets([]);
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "remotion";

  const handleSubmit = async (values: RemotionFormValues) => {
    try {
      // Upload files to storage when saving
      let backgroundAudioUrl = values.backgroundAudio;

      // Upload background audio if it's a new file (base64) and not already a URL
      if (backgroundAudioFile && backgroundAudioBase64) {
        // Check if it was originally a URL (already uploaded)
        if (backgroundAudioOriginalUrl) {
          // Already a URL, use it
          backgroundAudioUrl = backgroundAudioOriginalUrl;
        } else if (values.backgroundAudio?.startsWith("http")) {
          // Form value is a URL, use it
          backgroundAudioUrl = values.backgroundAudio;
        } else {
          // New file - convert to base64 data URL
          const audioToast = toast.loading("Processing background audio...");
          try {
            backgroundAudioUrl = await convertFileToDataUrl(backgroundAudioFile);
            toast.dismiss(audioToast);
            toast.success("Background audio processed");
          } catch (error) {
            toast.dismiss(audioToast);
            toast.error("Failed to process background audio.");
            backgroundAudioUrl = backgroundAudioBase64; // Keep base64 as fallback
          }
        }
      }

      // Process assets - convert to base64 data URLs if needed
      let processedAssets: z.infer<typeof formSchema>["assets"] = [];
      if (assets.length > 0) {
        // Check if any assets need processing (not already data URLs)
        const needsProcessing = assets.some(
          (asset) => !asset.base64.startsWith("data:") && !asset.base64.startsWith("http")
        );

        const loadingToast = needsProcessing
          ? toast.loading(`Processing ${assets.length} asset(s)...`)
          : null;
        try {
          processedAssets = await Promise.all(
            assets.map(async (asset) => {
              // If it's already a base64 data URL, use it directly
              if (asset.base64.startsWith("data:")) {
                return {
                  file: asset.base64, // Already a data URL
                  filename: asset.filename,
                  type: asset.type,
                  sceneDescription: asset.sceneDescription || "",
                  startTime: asset.startTime,
                  position: asset.position,
                  size: asset.size,
                };
              }

              // If it's a URL (from old saved data), we'll need to fetch it in the backend
              // For now, pass it through and let backend handle it
              if (asset.base64.startsWith("http")) {
                return {
                  file: asset.base64, // Pass URL to backend
                  filename: asset.filename,
                  type: asset.type,
                  sceneDescription: asset.sceneDescription || "",
                  startTime: asset.startTime,
                  position: asset.position,
                  size: asset.size,
                };
              }

              // New file - convert to base64 data URL
              try {
                const dataUrl = await convertFileToDataUrl(asset.file);
                return {
                  file: dataUrl, // Store as data URL
                  filename: asset.filename,
                  type: asset.type,
                  sceneDescription: asset.sceneDescription || "",
                  startTime: asset.startTime,
                  position: asset.position,
                  size: asset.size,
                };
              } catch (error) {
                console.error(`Failed to process asset ${asset.filename}:`, error);
                // Fallback to existing base64
                return {
                  file: asset.base64,
                  filename: asset.filename,
                  type: asset.type,
                  sceneDescription: asset.sceneDescription || "",
                  startTime: asset.startTime,
                  position: asset.position,
                  size: asset.size,
                };
              }
            })
          );
        } finally {
          if (loadingToast) {
            toast.dismiss(loadingToast);
          }
        }
      } else {
        processedAssets = [];
      }

      const submitValues: RemotionFormValues = {
        ...values,
        backgroundAudio: backgroundAudioUrl,
        backgroundAudioFilename: backgroundAudioFile?.name || values.backgroundAudioFilename,
        backgroundAudioVolume: backgroundAudioVolume,
        assets: processedAssets,
      };

      await Promise.resolve(onSubmit(submitValues));
      onOpenChange(false);
      toast.success("Remotion node configured");
      form.reset();
    } catch (error) {
      // Dismiss any remaining toasts
      toast.dismiss();
      toast.error("Failed to save configuration");
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Remotion Video</DialogTitle>
          <DialogDescription>
            Generate motion videos using AI-powered Remotion code generation. Describe your video
            and add assets.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="remotion" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.videoUrl}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select video format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VIDEO_FORMATS.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            <div>
                              <div className="font-medium">{format.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {format.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the aspect ratio. Dimensions, fps, and duration are auto-detected from
                      your prompt.
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
                    <FormLabel>Video Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Create a 15-second product showcase video with smooth animations..."
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe your video including duration (e.g., "15-second video"), style, and
                      requirements. Use {"{{variables}}"} to reference data from previous nodes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Background Audio Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Background Audio (Optional)
                </label>
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>File Size Limit:</strong> Audio files must not exceed 5MB. If your file
                    is too large, please compress it before uploading.
                  </AlertDescription>
                </Alert>
                {!backgroundAudioFile && !backgroundAudioBase64 ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={backgroundAudioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleBackgroundAudioUpload}
                      className="hidden"
                      id="background-audio-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => backgroundAudioInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Music className="h-4 w-4" />
                      Upload Audio
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {backgroundAudioFile?.name ||
                            defaultValues.backgroundAudioFilename ||
                            "Background Audio"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeBackgroundAudio}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Volume</span>
                        <span>{Math.round(backgroundAudioVolume * 100)}%</span>
                      </div>
                      <Slider
                        value={[backgroundAudioVolume]}
                        onValueChange={([value]) => {
                          setBackgroundAudioVolume(value);
                          form.setValue("backgroundAudioVolume", value);
                        }}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Optional: Background music/sound that plays throughout the video.
                </p>
              </div>

              {/* Assets Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Assets (Optional - can add multiple)
                </label>
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>File Size Limit:</strong> All assets (images, videos, audio) combined
                    must not exceed 5MB total. If files are too large, please compress or resize
                    them before uploading.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <input
                    ref={assetsInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    onChange={handleAssetUpload}
                    className="hidden"
                    id="assets-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => assetsInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Add Assets
                  </Button>
                </div>

                {assets.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {assets.map((asset, index) => (
                      <div key={index} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              {asset.type === "image" && <ImageIcon className="h-6 w-6" />}
                              {asset.type === "video" && <Video className="h-6 w-6" />}
                              {asset.type === "audio" && <FileAudio className="h-6 w-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{asset.filename}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {asset.type}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAsset(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Describe where/how this asset should appear (e.g., 'Logo fades in from top-left at 2 seconds')"
                          className="min-h-[60px] text-sm"
                          value={asset.sceneDescription || ""}
                          onChange={(e) => updateAssetSceneDescription(index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Add multiple images, videos, or audio files. Describe how each should be used in
                  your video.
                </p>
              </div>
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
