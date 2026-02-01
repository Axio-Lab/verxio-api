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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  variables: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_]*$/).optional(),
  prompt: z.string().min(1, "Prompt is required").max(2500),
  model_name: z.enum(["kling-video-o1"]),
  image_list: z.string().max(2000).optional(),
  referenceImages: z
    .array(
      z.object({
        file: z.string(),
        filename: z.string(),
        type: z.enum(["reference", "first_frame", "end_frame"]).optional(),
      })
    )
    .optional(),
  element_list: z.string().max(2000).optional(),
  mode: z.enum(["std", "pro"]),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.enum(["3", "4", "5", "6", "7", "8", "9", "10"]),
});

export type KlingOmniVideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingOmniVideoFormValues) => void;
  defaultValues?: Partial<KlingOmniVideoFormValues>;
}

export const KlingOmniVideoDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [referenceImageFiles, setReferenceImageFiles] = useState<
    Array<{ file: File | null; base64: string; filename: string; mimeType: string; type?: string }>
  >([]);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingOmniVideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingOmniVideo",
      prompt: defaultValues.prompt ?? "",
      model_name: "kling-video-o1",
      image_list: defaultValues.image_list ?? "",
      referenceImages: defaultValues.referenceImages ?? [],
      element_list: defaultValues.element_list ?? "",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: defaultValues.duration ?? "5",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingOmniVideo",
        prompt: defaultValues.prompt ?? "",
        model_name: "kling-video-o1",
        image_list: defaultValues.image_list ?? "",
        referenceImages: defaultValues.referenceImages ?? [],
        element_list: defaultValues.element_list ?? "",
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
            type: ref.type,
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

    if (referenceImageFiles.length + files.length > 7) {
      toast.error("You can upload up to 7 images.");
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
        type: "reference",
      }))
    );
    setReferenceImageFiles((prev) => [...prev, ...newImages]);
  };

  const updateImageType = (index: number, type: string) => {
    setReferenceImageFiles((prev) =>
      prev.map((img, i) => (i === index ? { ...img, type } : img))
    );
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = form.handleSubmit((values) => {
    if (referenceImageFiles.length > 0) {
      values.referenceImages = referenceImageFiles.map((img) => ({
        file: img.base64,
        filename: img.filename,
        type: img.type && img.type !== "reference" ? (img.type as "first_frame" | "end_frame") : undefined,
      }));
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Omni Video</DialogTitle>
          <DialogDescription>
            Kling O1 unified multimodal video. Prompt required. Optional image_list (JSON array or URL).
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
                    <Input {...field} placeholder="klingOmniVideo" />
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
                    <Textarea {...field} placeholder="Describe the video..." rows={3} />
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
                    <Input {...field} value="kling-video-o1" readOnly />
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
                  <FormLabel>Reference Image List (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='["{{klingImage.imageUrls[0]}}"] or URL' />
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
                  disabled={referenceImageFiles.length >= 7}
                >
                  Upload Reference Images ({referenceImageFiles.length}/7)
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
                        <Select
                          onValueChange={(value) => updateImageType(index, value)}
                          value={img.type || "reference"}
                        >
                          <SelectTrigger className="h-7 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reference">Reference</SelectItem>
                            <SelectItem value="first_frame">First frame</SelectItem>
                            <SelectItem value="end_frame">End frame</SelectItem>
                          </SelectContent>
                        </Select>
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
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="3">3s</SelectItem>
                        <SelectItem value="4">4s</SelectItem>
                        <SelectItem value="5">5s</SelectItem>
                        <SelectItem value="6">6s</SelectItem>
                        <SelectItem value="7">7s</SelectItem>
                        <SelectItem value="8">8s</SelectItem>
                        <SelectItem value="9">9s</SelectItem>
                        <SelectItem value="10">10s</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
