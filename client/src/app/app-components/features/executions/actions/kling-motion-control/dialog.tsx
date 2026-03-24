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
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";
const VIDEO_SIZE_ERROR_MSG =
  "Video exceeds 100MB. Please compress the video to under 100MB and try again.";

const formSchema = z.object({
  variables: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
    .optional(),
  prompt: z.string().max(2500).optional(),
  image: z.string().min(1, "Image is required"),
  imageFilename: z.string().optional(),
  video_url: z.string().min(1, "Video URL is required"),
  videoFilename: z.string().optional(),
  keep_original_sound: z.enum(["yes", "no"]).optional(),
  character_orientation: z.enum(["image", "video"]),
  mode: z.enum(["std", "pro"]),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).optional(),
});

export type KlingMotionControlFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingMotionControlFormValues) => void;
  defaultValues?: Partial<KlingMotionControlFormValues>;
}

export const KlingMotionControlDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [imageFile, setImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [videoFile, setVideoFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingMotionControlFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingMotionControl",
      prompt: defaultValues.prompt ?? "",
      image: defaultValues.image ?? "",
      imageFilename: defaultValues.imageFilename ?? "",
      video_url: defaultValues.video_url ?? "",
      videoFilename: defaultValues.videoFilename ?? "",
      keep_original_sound: defaultValues.keep_original_sound ?? "yes",
      character_orientation: defaultValues.character_orientation ?? "image",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingMotionControl",
        prompt: defaultValues.prompt ?? "",
        image: defaultValues.image ?? "",
        imageFilename: defaultValues.imageFilename ?? "",
        video_url: defaultValues.video_url ?? "",
        videoFilename: defaultValues.videoFilename ?? "",
        keep_original_sound: defaultValues.keep_original_sound ?? "yes",
        character_orientation: defaultValues.character_orientation ?? "image",
        mode: defaultValues.mode ?? "std",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      });

      if (defaultValues.image) {
        const filename =
          defaultValues.imageFilename ||
          (defaultValues.image.startsWith("asset:")
            ? defaultValues.image.replace("asset:", "")
            : "reference-image.png");
        setImageFile({
          file: null,
          base64: defaultValues.image,
          filename,
          mimeType: defaultValues.image.startsWith("data:")
            ? defaultValues.image.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      } else {
        setImageFile(null);
      }

      if (defaultValues.video_url) {
        const filename =
          defaultValues.videoFilename ||
          (defaultValues.video_url.startsWith("asset:")
            ? defaultValues.video_url.replace("asset:", "")
            : "reference-video.mp4");
        setVideoFile({
          file: null,
          base64: defaultValues.video_url,
          filename,
          mimeType: "video/mp4",
        });
      } else {
        setVideoFile(null);
      }
    }
  }, [open, defaultValues, form]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }
    const base64 = await fileToBase64(file);
    setImageFile({
      file,
      base64,
      filename: file.name,
      mimeType: file.type || "image/png",
    });
    form.setValue("image", base64);
    form.setValue("imageFilename", file.name);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toast.error(VIDEO_SIZE_ERROR_MSG);
      return;
    }
    const base64 = await fileToBase64(file);
    setVideoFile({
      file,
      base64,
      filename: file.name,
      mimeType: file.type || "video/mp4",
    });
    form.setValue("video_url", base64);
    form.setValue("videoFilename", file.name);
  };

  const handleSubmit = form.handleSubmit((values) => {
    if (imageFile?.base64) {
      values.image = imageFile.base64;
      values.imageFilename = imageFile.filename;
    }
    if (videoFile?.base64) {
      values.video_url = videoFile.base64;
      values.videoFilename = videoFile.filename;
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Motion Control</DialogTitle>
          <DialogDescription>
            Motion control video from image and optional video reference. Prompt or image required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output variable name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="klingMotionControl" />
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
                  <FormLabel>Prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe motion..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image (URL or variable)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{klingImage.imageUrls[0]}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
              >
                Upload image
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleImageUpload}
              />
              {imageFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">{imageFile.filename}</span>
              )}
              {imageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImageFile(null);
                    form.setValue("image", "");
                    form.setValue("imageFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {imageFile && (
              <div className="flex items-center gap-2">
                {imageFile.base64.startsWith("data:") || imageFile.base64.startsWith("http") ? (
                  <img
                    src={imageFile.base64}
                    alt={imageFile.filename}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{imageFile.filename}</span>
              </div>
            )}
            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video reference URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{klingText2Video.videoUrl}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
              >
                Upload video
              </Button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/mov"
                className="hidden"
                onChange={handleVideoUpload}
              />
              {videoFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">{videoFile.filename}</span>
              )}
              {videoFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVideoFile(null);
                    form.setValue("video_url", "");
                    form.setValue("videoFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {videoFile && (
              <div className="text-xs text-muted-foreground">
                Selected video: {videoFile.filename}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="keep_original_sound"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keep original sound</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="character_orientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Character orientation</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="image">Match image</SelectItem>
                        <SelectItem value="video">Match video</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="std">Standard</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aspect_ratio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect ratio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
