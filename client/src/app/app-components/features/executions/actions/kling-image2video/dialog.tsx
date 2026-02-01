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

const formSchema = z.object({
  variables: z
    .string()
    .min(1)
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Use letters, numbers, underscores" })
    .optional(),
  prompt: z.string().max(2500).optional(),
  image: z.string().optional(),
  imageFilename: z.string().optional(),
  model_name: z.enum(["kling-v1", "kling-v1-5", "kling-v1-6", "kling-v2-master", "kling-v2-1", "kling-v2-1-master", "kling-v2-5-turbo", "kling-v2-6"]),
  mode: z.enum(["std", "pro"]),
  duration: z.enum(["5", "10"]),
  negative_prompt: z.string().max(2500).optional(),
});

export type KlingImage2VideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingImage2VideoFormValues) => void;
  defaultValues?: Partial<KlingImage2VideoFormValues>;
}

export const KlingImage2VideoDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [imageFile, setImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingImage2VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingImage2Video",
      prompt: defaultValues.prompt ?? "",
      image: defaultValues.image ?? "",
      imageFilename: defaultValues.imageFilename ?? "",
      model_name: defaultValues.model_name ?? "kling-v1",
      mode: defaultValues.mode ?? "std",
      duration: defaultValues.duration ?? "5",
      negative_prompt: defaultValues.negative_prompt ?? "",
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
        variables: defaultValues.variables ?? "klingImage2Video",
        prompt: defaultValues.prompt ?? "",
        image: defaultValues.image ?? "",
        imageFilename: defaultValues.imageFilename ?? "",
        model_name: defaultValues.model_name ?? "kling-v1",
        mode: defaultValues.mode ?? "std",
        duration: defaultValues.duration ?? "5",
        negative_prompt: defaultValues.negative_prompt ?? "",
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
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Image-to-Video</DialogTitle>
          <DialogDescription>
            Animate an image into video.
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
                    <Input {...field} placeholder="klingImage2Video" />
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
                    <Input {...field} placeholder="https://... or {{node.output}}" />
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
                        <SelectItem value="kling-v1-6">kling-v1-6</SelectItem>
                        <SelectItem value="kling-v2-master">kling-v2-master</SelectItem>
                        <SelectItem value="kling-v2-1">kling-v2-1</SelectItem>
                        <SelectItem value="kling-v2-1-master">kling-v2-1-master</SelectItem>
                        <SelectItem value="kling-v2-5-turbo">kling-v2-5-turbo</SelectItem>
                        <SelectItem value="kling-v2-6">kling-v2-6</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="pro">Professional</SelectItem>
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
            <FormField
              control={form.control}
              name="negative_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Negative prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={1} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
