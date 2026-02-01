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
  model_name: z.enum(["kolors-virtual-try-on-v1", "kolors-virtual-try-on-v1-5"]),
  human_image: z.string().min(1, "Human image is required"),
  humanImageFilename: z.string().optional(),
  cloth_image: z.string().min(1, "Cloth image is required"),
  clothImageFilename: z.string().optional(),
});

export type KlingVirtualTryonFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingVirtualTryonFormValues) => void;
  defaultValues?: Partial<KlingVirtualTryonFormValues>;
}

export const KlingVirtualTryonDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [humanImageFile, setHumanImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [clothImageFile, setClothImageFile] = useState<{
    file: File | null;
    base64: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const humanImageInputRef = useRef<HTMLInputElement>(null);
  const clothImageInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingVirtualTryonFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingVirtualTryon",
      model_name: defaultValues.model_name ?? "kolors-virtual-try-on-v1",
      human_image: defaultValues.human_image ?? "",
      humanImageFilename: defaultValues.humanImageFilename ?? "",
      cloth_image: defaultValues.cloth_image ?? "",
      clothImageFilename: defaultValues.clothImageFilename ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingVirtualTryon",
        model_name: defaultValues.model_name ?? "kolors-virtual-try-on-v1",
        human_image: defaultValues.human_image ?? "",
        humanImageFilename: defaultValues.humanImageFilename ?? "",
        cloth_image: defaultValues.cloth_image ?? "",
        clothImageFilename: defaultValues.clothImageFilename ?? "",
      });

      if (defaultValues.human_image) {
        const filename =
          defaultValues.humanImageFilename ||
          (defaultValues.human_image.startsWith("asset:")
            ? defaultValues.human_image.replace("asset:", "")
            : "human-image.png");
        setHumanImageFile({
          file: null,
          base64: defaultValues.human_image,
          filename,
          mimeType: defaultValues.human_image.startsWith("data:")
            ? defaultValues.human_image.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      } else {
        setHumanImageFile(null);
      }

      if (defaultValues.cloth_image) {
        const filename =
          defaultValues.clothImageFilename ||
          (defaultValues.cloth_image.startsWith("asset:")
            ? defaultValues.cloth_image.replace("asset:", "")
            : "cloth-image.png");
        setClothImageFile({
          file: null,
          base64: defaultValues.cloth_image,
          filename,
          mimeType: defaultValues.cloth_image.startsWith("data:")
            ? defaultValues.cloth_image.match(/data:([^;]+)/)?.[1] || "image/png"
            : "image/png",
        });
      } else {
        setClothImageFile(null);
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

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<
      React.SetStateAction<{
        file: File | null;
        base64: string;
        filename: string;
        mimeType: string;
      } | null>
    >,
    setValueKey: "human_image" | "cloth_image",
    setFilenameKey: "humanImageFilename" | "clothImageFilename"
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
    if (humanImageFile?.base64) {
      values.human_image = humanImageFile.base64;
      values.humanImageFilename = humanImageFile.filename;
    }
    if (clothImageFile?.base64) {
      values.cloth_image = clothImageFile.base64;
      values.clothImageFilename = clothImageFile.filename;
    }
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Virtual Try-On</DialogTitle>
          <DialogDescription>
            Virtual try-on: person image + garment image. Use URLs or variables (e.g. from Kling Image).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingVirtualTryon" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="model_name" render={({ field }) => (
              <FormItem><FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="kolors-virtual-try-on-v1">kolors-virtual-try-on-v1</SelectItem>
                    <SelectItem value="kolors-virtual-try-on-v1-5">kolors-virtual-try-on-v1-5</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage /></FormItem>
            )} />
            <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Garment image guidelines</p>
              <p>Single garment (upper, lower, or dress) generates a try-on of that item.</p>
              <p>Upper + lower in one image (white background) is supported.</p>
              <p>Upper+upper, lower+lower, dress+dress, upper+dress, lower+dress will fail.</p>
            </div>
            <FormField control={form.control} name="human_image" render={({ field }) => (
              <FormItem><FormLabel>Human / person image (URL or variable)</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingImage.imageUrls[0]}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => humanImageInputRef.current?.click()}>
                Upload human image
              </Button>
              <input
                ref={humanImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) =>
                  handleImageUpload(e, setHumanImageFile, "human_image", "humanImageFilename")
                }
              />
              {humanImageFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">
                  {humanImageFile.filename}
                </span>
              )}
              {humanImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHumanImageFile(null);
                    form.setValue("human_image", "");
                    form.setValue("humanImageFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {humanImageFile && (
              <div className="flex items-center gap-2">
                {humanImageFile.base64.startsWith("data:") || humanImageFile.base64.startsWith("http") ? (
                  <img
                    src={humanImageFile.base64}
                    alt={humanImageFile.filename}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{humanImageFile.filename}</span>
              </div>
            )}
            <FormField control={form.control} name="cloth_image" render={({ field }) => (
              <FormItem><FormLabel>Cloth / garment image (URL or variable)</FormLabel>
                <FormControl><Input {...field} placeholder="URL or {{...}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => clothImageInputRef.current?.click()}>
                Upload garment image
              </Button>
              <input
                ref={clothImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) =>
                  handleImageUpload(e, setClothImageFile, "cloth_image", "clothImageFilename")
                }
              />
              {clothImageFile?.filename && (
                <span className="text-xs text-muted-foreground truncate">
                  {clothImageFile.filename}
                </span>
              )}
              {clothImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClothImageFile(null);
                    form.setValue("cloth_image", "");
                    form.setValue("clothImageFilename", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {clothImageFile && (
              <div className="flex items-center gap-2">
                {clothImageFile.base64.startsWith("data:") || clothImageFile.base64.startsWith("http") ? (
                  <img
                    src={clothImageFile.base64}
                    alt={clothImageFile.filename}
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Stored asset
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{clothImageFile.filename}</span>
              </div>
            )}
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
