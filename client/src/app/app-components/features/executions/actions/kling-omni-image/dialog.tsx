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
  prompt: z.string().min(1, "Prompt is required").max(2500),
  model_name: z.enum(["kling-v3-omni"]),
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .max(MAX_IMAGES, `Maximum ${MAX_IMAGES} reference images`)
    .optional(),
  resolution: z.enum(["1k", "2k"]),
  n: z.coerce.number().min(1).max(MAX_IMAGES),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9", "auto"]),
});

export type KlingOmniImageFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingOmniImageFormValues) => void;
  defaultValues?: Partial<KlingOmniImageFormValues>;
}

export const KlingOmniImageDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [referenceImageFiles, setReferenceImageFiles] = useState<
    Array<{ file: File | null; base64: string; filename: string; mimeType: string }>
  >([]);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingOmniImageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingOmniImage",
      prompt: defaultValues.prompt ?? "",
      model_name: "kling-v3-omni",
      referenceImages: defaultValues.referenceImages ?? [],
      resolution: defaultValues.resolution ?? "1k",
      n: defaultValues.n ?? 1,
      aspect_ratio: defaultValues.aspect_ratio ?? "auto",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingOmniImage",
        prompt: defaultValues.prompt ?? "",
        model_name: "kling-v3-omni",
        referenceImages: defaultValues.referenceImages ?? [],
        resolution: defaultValues.resolution ?? "1k",
        n: defaultValues.n ?? 1,
        aspect_ratio: defaultValues.aspect_ratio ?? "auto",
      });

      if (defaultValues.referenceImages && defaultValues.referenceImages.length > 0) {
        const refImages = defaultValues.referenceImages.map((ref, idx) => {
          const filename = ref.filename || `reference-${idx + 1}.png`;
          return {
            file: null,
            base64: ref.file,
            filename,
            mimeType: ref.file.startsWith("data:")
              ? ref.file.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
          };
        });
        setReferenceImageFiles(refImages);
      } else {
        setReferenceImageFiles([]);
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

  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";

    if (referenceImageFiles.length + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} reference images. Error if exceeded.`);
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
    setReferenceImageFiles((prev) => [...prev, ...newImages]);
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = form.handleSubmit((values) => {
    if (referenceImageFiles.length > 0) {
      values.referenceImages = referenceImageFiles.map((img) => ({
        file: img.base64,
        filename: img.filename,
      }));
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Omni Image</DialogTitle>
          <DialogDescription>
            Kling v3 Omni image. Prompt required. Upload reference images (max {MAX_IMAGES}).
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
                    <Input {...field} placeholder="klingOmniImage" />
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
                    <Textarea {...field} placeholder="Describe the image..." rows={3} />
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
                  <FormControl>
                    <Input {...field} value="kling-v3-omni" readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => referenceImagesInputRef.current?.click()}
                  disabled={referenceImageFiles.length >= MAX_IMAGES}
                >
                  Upload Reference Images ({referenceImageFiles.length}/{MAX_IMAGES})
                </Button>
                <input
                  ref={referenceImagesInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  multiple
                  onChange={handleReferenceImagesUpload}
                />
              </div>
              {referenceImageFiles.length > 0 && (
                <div className="space-y-2">
                  {referenceImageFiles.map((img, index) => {
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
                          onClick={() => removeReferenceImage(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* <FormField
              control={form.control}
              name="element_list"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Element list (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='[{"element_id":123}]' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
            <div className="grid grid-cols-3 gap-4">
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
                        <SelectItem value="1k">1k</SelectItem>
                        <SelectItem value="2k">2k</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="auto">Auto</SelectItem>
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
