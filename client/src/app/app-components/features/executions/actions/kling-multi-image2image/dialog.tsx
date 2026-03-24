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
const MAX_IMAGES = 9;
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

const formSchema = z.object({
  variables: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
    .optional(),
  prompt: z.string().max(2500).optional(),
  model_name: z.enum(["kling-v2", "kling-v2-1"]),
  subjectImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .max(MAX_IMAGES, `Maximum ${MAX_IMAGES} subject images`)
    .optional(),
  scene_image: z.string().optional(),
  sceneImageFilename: z.string().optional(),
  style_image: z.string().optional(),
  styleImageFilename: z.string().optional(),
  n: z.coerce.number().min(1, "At least 1 image").max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images`),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"]),
});

export type KlingMultiImage2ImageFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingMultiImage2ImageFormValues) => void;
  defaultValues?: Partial<KlingMultiImage2ImageFormValues>;
}

export const KlingMultiImage2ImageDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [subjectImageFiles, setSubjectImageFiles] = useState<
    Array<{ file: File | null; base64: string; filename: string; mimeType: string }>
  >([]);
  const [sceneImageFile, setSceneImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [styleImageFile, setStyleImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const subjectImagesInputRef = useRef<HTMLInputElement>(null);
  const sceneImageInputRef = useRef<HTMLInputElement>(null);
  const styleImageInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingMultiImage2ImageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingMultiImage2Image",
      prompt: defaultValues.prompt ?? "",
      model_name: defaultValues.model_name ?? "kling-v2",
      subjectImages: defaultValues.subjectImages ?? [],
      scene_image: defaultValues.scene_image ?? "",
      sceneImageFilename: defaultValues.sceneImageFilename ?? "",
      style_image: defaultValues.style_image ?? "",
      styleImageFilename: defaultValues.styleImageFilename ?? "",
      n: defaultValues.n ?? 1,
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingMultiImage2Image",
        prompt: defaultValues.prompt ?? "",
        model_name: defaultValues.model_name ?? "kling-v2",
        subjectImages: defaultValues.subjectImages ?? [],
        scene_image: defaultValues.scene_image ?? "",
        sceneImageFilename: defaultValues.sceneImageFilename ?? "",
        style_image: defaultValues.style_image ?? "",
        styleImageFilename: defaultValues.styleImageFilename ?? "",
        n: defaultValues.n ?? 1,
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      });

      if (defaultValues.subjectImages && defaultValues.subjectImages.length > 0) {
        const images = defaultValues.subjectImages.map((ref, idx) => {
          const filename = ref.filename || `subject-${idx + 1}.png`;
          return {
            file: null,
            base64: ref.file,
            filename,
            mimeType: ref.file.startsWith("data:")
              ? ref.file.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
          };
        });
        setSubjectImageFiles(images);
      } else {
        setSubjectImageFiles([]);
      }

      if (defaultValues.scene_image) {
        const filename =
          defaultValues.sceneImageFilename ||
          (defaultValues.scene_image.startsWith("asset:")
            ? defaultValues.scene_image.replace("asset:", "")
            : "scene-image.png");
        setSceneImageFile({
          file: null,
          base64: defaultValues.scene_image,
          filename,
          mimeType: defaultValues.scene_image.startsWith("data:")
            ? defaultValues.scene_image.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      } else {
        setSceneImageFile(null);
      }

      if (defaultValues.style_image) {
        const filename =
          defaultValues.styleImageFilename ||
          (defaultValues.style_image.startsWith("asset:")
            ? defaultValues.style_image.replace("asset:", "")
            : "style-image.png");
        setStyleImageFile({
          file: null,
          base64: defaultValues.style_image,
          filename,
          mimeType: defaultValues.style_image.startsWith("data:")
            ? defaultValues.style_image.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      } else {
        setStyleImageFile(null);
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

  const handleSubjectImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";

    if (subjectImageFiles.length + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} subject images. Error if exceeded.`);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error(IMAGE_SIZE_ERROR_MSG);
        return;
      }
    }

    const newImages = await Promise.all(
      files.map(async (file) => ({
        file,
        base64: await fileToBase64(file),
        filename: file.name,
        mimeType: file.type || "image/png",
      }))
    );
    setSubjectImageFiles((prev) => [...prev, ...newImages]);
  };

  const removeSubjectImage = (index: number) => {
    setSubjectImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSingleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<
      React.SetStateAction<{
        file: File | null;
        base64: string;
        filename: string;
        mimeType: string;
      } | null>
    >,
    setValueKey: "scene_image" | "style_image",
    setFilenameKey: "sceneImageFilename" | "styleImageFilename"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(IMAGE_SIZE_ERROR_MSG);
      return;
    }
    const base64 = await fileToBase64(file);
    setImage({
      file,
      base64,
      filename: file.name,
      mimeType: file.type || "image/png",
    });
    form.setValue(setValueKey, base64);
    form.setValue(setFilenameKey, file.name);
  };

  const handleSubmit = form.handleSubmit((values) => {
    if (subjectImageFiles.length > 0) {
      values.subjectImages = subjectImageFiles.map((img) => ({
        file: img.base64,
        filename: img.filename,
      }));
    }
    if (sceneImageFile?.base64) {
      values.scene_image = sceneImageFile.base64;
      values.sceneImageFilename = sceneImageFile.filename;
    }
    if (styleImageFile?.base64) {
      values.style_image = styleImageFile.base64;
      values.styleImageFilename = styleImageFile.filename;
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Multi-Image to Image</DialogTitle>
          <DialogDescription>
            Generate image from uploaded subject images (max {MAX_IMAGES}). Optional prompt, scene
            and style images.
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
                    <Input {...field} placeholder="klingMultiImage2Image" />
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
                    <Textarea {...field} placeholder="Describe the image..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="kling-v2">kling-v2</SelectItem>
                      <SelectItem value="kling-v2-1">kling-v2-1</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => subjectImagesInputRef.current?.click()}
                  disabled={subjectImageFiles.length >= MAX_IMAGES}
                >
                  Upload subject images ({subjectImageFiles.length}/{MAX_IMAGES})
                </Button>
                <input
                  ref={subjectImagesInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  multiple
                  onChange={handleSubjectImagesUpload}
                />
              </div>
              {subjectImageFiles.length > 0 && (
                <div className="space-y-2">
                  {subjectImageFiles.map((img, index) => {
                    const showPreview =
                      img.base64.startsWith("data:") || img.base64.startsWith("http");
                    return (
                      <div key={`${img.filename}-${index}`} className="flex items-center gap-2">
                        {showPreview ? (
                          <img
                            src={img.base64}
                            alt={img.filename}
                            className="h-10 w-10 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded border flex items-center justify-center text-[10px] text-muted-foreground">
                            Asset
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {img.filename}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSubjectImage(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <FormField
              control={form.control}
              name="scene_image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scene image (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="URL or {{node.output}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => sceneImageInputRef.current?.click()}
              >
                Upload scene image
              </Button>
              <input
                ref={sceneImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) =>
                  handleSingleImageUpload(e, setSceneImageFile, "scene_image", "sceneImageFilename")
                }
              />
              {sceneImageFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">
                  {sceneImageFile.filename}
                </span>
              )}
              {sceneImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSceneImageFile(null);
                    form.setValue("scene_image", "");
                    form.setValue("sceneImageFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {sceneImageFile && (
              <div className="flex items-center gap-2">
                {sceneImageFile.base64.startsWith("data:") ||
                sceneImageFile.base64.startsWith("http") ? (
                  <img
                    src={sceneImageFile.base64}
                    alt={sceneImageFile.filename}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{sceneImageFile.filename}</span>
              </div>
            )}
            <FormField
              control={form.control}
              name="style_image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Style image (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="URL or {{node.output}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => styleImageInputRef.current?.click()}
              >
                Upload style image
              </Button>
              <input
                ref={styleImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) =>
                  handleSingleImageUpload(e, setStyleImageFile, "style_image", "styleImageFilename")
                }
              />
              {styleImageFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">
                  {styleImageFile.filename}
                </span>
              )}
              {styleImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStyleImageFile(null);
                    form.setValue("style_image", "");
                    form.setValue("styleImageFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {styleImageFile && (
              <div className="flex items-center gap-2">
                {styleImageFile.base64.startsWith("data:") ||
                styleImageFile.base64.startsWith("http") ? (
                  <img
                    src={styleImageFile.base64}
                    alt={styleImageFile.filename}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{styleImageFile.filename}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="n"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of images (max {MAX_IMAGES})</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={MAX_IMAGES} {...field} />
                    </FormControl>
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
                        <SelectItem value="4:3">4:3</SelectItem>
                        <SelectItem value="3:4">3:4</SelectItem>
                        <SelectItem value="3:2">3:2</SelectItem>
                        <SelectItem value="2:3">2:3</SelectItem>
                        <SelectItem value="21:9">21:9</SelectItem>
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
