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
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

const formSchema = z
  .object({
    variables: z.string().min(1).regex(/^[A-Za-z_$][A-Za-z0-9_]*$/).optional(),
    prompt: z.string().min(1, "Prompt is required").max(2500),
    negative_prompt: z.string().max(2500).optional(),
    image: z.string().optional(),
    imageFilename: z.string().optional(),
    image_reference: z.enum(["subject", "face"]).optional(),
    image_fidelity: z.coerce.number().min(0).max(1).optional(),
    human_fidelity: z.coerce.number().min(0).max(1).optional(),
    model_name: z.enum(["kling-v1", "kling-v1-5", "kling-v2", "kling-v2-new", "kling-v2-1"]),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"]),
    n: z.coerce.number().min(1).max(9),
    resolution: z.enum(["1k", "2k"]),
  })
  .superRefine((values, ctx) => {
    if (values.image && values.model_name === "kling-v1-5" && !values.image_reference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "image_reference is required when using kling-v1-5 with a reference image",
        path: ["image_reference"],
      });
    }
    if (values.image_reference && !values.image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "image is required when image_reference is set",
        path: ["image"],
      });
    }
  });

export type KlingImageFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingImageFormValues) => void;
  defaultValues?: Partial<KlingImageFormValues>;
}

export const KlingImageDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [imageFile, setImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingImageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingImage",
      prompt: defaultValues.prompt ?? "",
      negative_prompt: defaultValues.negative_prompt ?? "",
      image: defaultValues.image ?? "",
      imageFilename: defaultValues.imageFilename ?? "",
      image_reference: defaultValues.image_reference ?? undefined,
      image_fidelity: defaultValues.image_fidelity ?? undefined,
      human_fidelity: defaultValues.human_fidelity ?? undefined,
      model_name: defaultValues.model_name ?? "kling-v1",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      n: defaultValues.n ?? 1,
      resolution: defaultValues.resolution ?? "1k",
    },
  });

  useEffect(() => {
    if (open) {
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
      form.reset({
        variables: defaultValues.variables ?? "klingImage",
        prompt: defaultValues.prompt ?? "",
        negative_prompt: defaultValues.negative_prompt ?? "",
        image: defaultValues.image ?? "",
        imageFilename: defaultValues.imageFilename ?? "",
        image_reference: defaultValues.image_reference ?? undefined,
        image_fidelity: defaultValues.image_fidelity ?? undefined,
        human_fidelity: defaultValues.human_fidelity ?? undefined,
        model_name: defaultValues.model_name ?? "kling-v1",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
        n: defaultValues.n ?? 1,
        resolution: defaultValues.resolution ?? "1k",
      });
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

  const handleSubmit = form.handleSubmit((values) => {
    if (imageFile?.base64) {
      values.image = imageFile.base64;
      values.imageFilename = imageFile.filename;
    }
    if (values.image) {
      values.negative_prompt = undefined;
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Image</DialogTitle>
          <DialogDescription>
            Generate images from text. Optional reference image URL or variable.
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
                    <Input {...field} placeholder="klingImage" />
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
              name="negative_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Negative prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={1}
                      disabled={Boolean(form.watch("image"))}
                      placeholder={
                        form.watch("image")
                          ? "Not supported when a reference image is provided"
                          : undefined
                      }
                    />
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
                  <FormLabel>Reference image (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="URL or {{node.output}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
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
                    className="h-20 w-20 rounded object-cover border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{imageFile.filename}</span>
              </div>
            )}
            <FormField
              control={form.control}
              name="image_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image reference type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reference type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="subject">Subject</SelectItem>
                      <SelectItem value="face">Face</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="image_fidelity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image fidelity (0–1)</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.01} min={0} max={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="human_fidelity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Human fidelity (0–1)</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.01} min={0} max={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="kling-v1">kling-v1</SelectItem>
                        <SelectItem value="kling-v1-5">kling-v1-5</SelectItem>
                        <SelectItem value="kling-v2">kling-v2</SelectItem>
                        <SelectItem value="kling-v2-new">kling-v2-new</SelectItem>
                        <SelectItem value="kling-v2-1">kling-v2-1</SelectItem>
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
              <FormField
                control={form.control}
                name="n"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of images (1–9)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={9} {...field} />
                    </FormControl>
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
                        <SelectItem value="1k">1K</SelectItem>
                        <SelectItem value="2k">2K</SelectItem>
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
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
