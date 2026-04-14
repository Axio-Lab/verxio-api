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
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

const formSchema = z.object({
  variables: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
    .optional(),
  prompt: z.string().max(2500).optional(),
  image_list: z.string().max(2000).optional(),
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
      })
    )
    .optional(),
  mode: z.enum(["std", "pro"]),
  aspect_ratio: z.string(),
  duration: z.string(),
});

export type KlingMultiImage2VideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingMultiImage2VideoFormValues) => void;
  defaultValues?: Partial<KlingMultiImage2VideoFormValues>;
}

export const KlingMultiImage2VideoDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [referenceImageFiles, setReferenceImageFiles] = useState<
    Array<{ file: File | null; base64: string; filename: string; mimeType: string }>
  >([]);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingMultiImage2VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingMultiImage2Video",
      prompt: defaultValues.prompt ?? "",
      image_list: defaultValues.image_list ?? "",
      referenceImages: defaultValues.referenceImages ?? [],
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: defaultValues.duration ?? "5",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingMultiImage2Video",
        prompt: defaultValues.prompt ?? "",
        image_list: defaultValues.image_list ?? "",
        referenceImages: defaultValues.referenceImages ?? [],
        mode: defaultValues.mode ?? "std",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
        duration: defaultValues.duration ?? "5",
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleReferenceImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";

    if (referenceImageFiles.length + files.length > 4) {
      toast.error("You can upload up to 4 images.");
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
          <DialogTitle>Kling Multi-Image to Video</DialogTitle>
          <DialogDescription>Generate video from multiple reference images.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Variable Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="klingMultiImage2Video" />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:
                    <br />
                    <code className="text-xs">{`{{${field.value || "klingMultiImage2Video"}.videoUrl}}`}</code>
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
                  <FormLabel>Prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the video..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image_list"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image list</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder='["{{klingImage.imageUrls[0]}}","https://.../2.png"]'
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground max-w-full break-words">
                    Pass multiple URLs as a JSON array, e.g.
                    <span className="ml-1 block font-mono break-all">
                      [&quot;https://example.com/1.png&quot;,&quot;https://example.com/2.png&quot;]
                    </span>
                  </p>
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => referenceImagesInputRef.current?.click()}
                  disabled={referenceImageFiles.length >= 4}
                >
                  Upload images ({referenceImageFiles.length}/4)
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
            <div className="grid grid-cols-3 gap-4">
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
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5">5s</SelectItem>
                        <SelectItem value="10">10s</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="ml-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save configuration"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
