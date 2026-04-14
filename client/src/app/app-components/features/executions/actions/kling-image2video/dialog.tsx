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
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { FormDescription } from "@/components/ui/form";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DURATION = 15;
const MIN_DURATION = 1;
const MAX_STORYBOARDS = 6;
const MIN_STORYBOARDS = 1;
const MAX_STORYBOARD_PROMPT_CHARS = 512;
const IMAGE_SIZE_ERROR_MSG =
  "Image exceeds 10MB. Please compress the image to under 10MB and try again.";

const multiPromptItemSchema = z.object({
  index: z.number(),
  prompt: z.string().max(MAX_STORYBOARD_PROMPT_CHARS),
  duration: z.string(),
});

const formSchema = z
  .object({
    variables: z
      .string()
      .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
      .optional(),
    prompt: z.string().max(2500).optional(),
    image: z.string().optional(),
    imageFilename: z.string().optional(),
    model_name: z.enum(["kling-v3"]),
    mode: z.enum(["std", "pro"]),
    duration: z.coerce.number().min(MIN_DURATION).max(MAX_DURATION),
    sound: z.enum(["on", "off"]),
    negative_prompt: z.string().max(2500).optional(),
    multi_shot: z.boolean(),
    multi_prompt: z.array(multiPromptItemSchema).max(MAX_STORYBOARDS),
  })
  .superRefine((data, ctx) => {
    if (data.multi_shot) {
      const list = data.multi_prompt;
      if (list.length < MIN_STORYBOARDS || list.length > MAX_STORYBOARDS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Storyboard must have ${MIN_STORYBOARDS} to ${MAX_STORYBOARDS} shots`,
          path: ["multi_prompt"],
        });
        return;
      }
      const total = Number(data.duration) || 0;
      const sum = list.reduce((s, item) => s + (parseInt(item.duration, 10) || 0), 0);
      if (sum !== total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Sum of storyboard durations (${sum}) must equal total duration (${total})`,
          path: ["multi_prompt"],
        });
      }
    } else if (!data.multi_shot) {
      const hasImage = (data.image ?? "").trim().length > 0;
      const hasPrompt = (data.prompt ?? "").trim().length > 0;
      if (!hasImage && !hasPrompt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "When not using storyboard, at least one of image or prompt is required",
          path: ["prompt"],
        });
      }
    }
  });

export type KlingImage2VideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingImage2VideoFormValues) => void;
  defaultValues?: Partial<KlingImage2VideoFormValues>;
}

export const KlingImage2VideoDialog = ({
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingImage2VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingImage2Video",
      prompt: defaultValues.prompt ?? "",
      image: defaultValues.image ?? "",
      imageFilename: defaultValues.imageFilename ?? "",
      model_name: "kling-v3",
      mode: defaultValues.mode ?? "std",
      duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)),
      sound: (defaultValues as any).sound ?? "off",
      negative_prompt: defaultValues.negative_prompt ?? "",
      multi_shot: defaultValues.multi_shot ?? false,
      multi_prompt:
        Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
          ? defaultValues.multi_prompt
          : [{ index: 0, prompt: "", duration: "5" }],
    },
  });

  const multiShot = form.watch("multi_shot");
  const totalDuration = parseInt(String(form.watch("duration") ?? 5), 10) || 5;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "multi_prompt",
  });

  const handleMultiShotChange = (checked: boolean) => {
    form.setValue("multi_shot", checked);
    if (checked) {
      const current = form.getValues("multi_prompt");
      if (!Array.isArray(current) || current.length === 0) {
        append({
          index: 0,
          prompt: "",
          duration: String(form.getValues("duration") ?? 5),
        });
      }
    }
  };

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
      const durationNum = Math.min(
        MAX_DURATION,
        Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)
      );
      form.reset({
        variables: defaultValues.variables ?? "klingImage2Video",
        prompt: defaultValues.prompt ?? "",
        image: defaultValues.image ?? "",
        imageFilename: defaultValues.imageFilename ?? "",
        model_name: "kling-v3",
        mode: defaultValues.mode ?? "std",
        duration: durationNum,
        sound: (defaultValues as any).sound ?? "off",
        negative_prompt: defaultValues.negative_prompt ?? "",
        multi_shot: defaultValues.multi_shot ?? false,
        multi_prompt:
          Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
            ? defaultValues.multi_prompt
            : [{ index: 0, prompt: "", duration: String(durationNum) }],
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
          <DialogDescription>Animate an image into video.</DialogDescription>
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
                    <Input {...field} placeholder="klingImage2Video" />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:
                    <br />
                    <code className="text-xs">{`{{${field.value || "klingImage2Video"}.videoUrl}}`}</code>
                  </FormDescription>
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
              name="multi_shot"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Storyboard (multi-shot)</FormLabel>
                    <FormDescription>
                      Create a sequence of 1–6 shots with separate prompts and durations.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={handleMultiShotChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {!multiShot && (
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
            )}
            {multiShot && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <span className="text-sm font-medium">Storyboard setup</span>
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total duration (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={MIN_DURATION}
                          max={MAX_DURATION}
                          placeholder="e.g. 10 or 15"
                          value={
                            field.value === undefined || field.value === null ? "" : field.value
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              field.onChange(MIN_DURATION);
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isNaN(n)) {
                              field.onChange(Math.min(MAX_DURATION, Math.max(MIN_DURATION, n)));
                              form.trigger("multi_prompt");
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter {MIN_DURATION}–{MAX_DURATION}. Sum of shot durations must equal this.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium leading-none">
                      Storyboards (1–{MAX_STORYBOARDS} shots)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={(form.getValues("multi_prompt")?.length ?? 0) >= MAX_STORYBOARDS}
                      onClick={() =>
                        append({
                          index: fields.length,
                          prompt: "",
                          duration: "1",
                        })
                      }
                    >
                      Add shot
                    </Button>
                  </div>
                  {fields.map((item, i) => (
                    <div key={item.id} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Shot {i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={fields.length <= MIN_STORYBOARDS}
                          onClick={() => remove(i)}
                        >
                          Remove
                        </Button>
                      </div>
                      <FormField
                        control={form.control}
                        name={`multi_prompt.${i}.index`}
                        render={({ field: f }) => (
                          <FormItem className="hidden">
                            <FormControl>
                              <Input type="hidden" {...f} value={i} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`multi_prompt.${i}.prompt`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Prompt (max {MAX_STORYBOARD_PROMPT_CHARS} chars)</FormLabel>
                            <FormControl>
                              <Textarea {...f} placeholder="Describe this shot..." rows={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`multi_prompt.${i}.duration`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Duration (seconds)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={totalDuration}
                                value={f.value}
                                onChange={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (!Number.isNaN(n)) {
                                    f.onChange(String(Math.min(totalDuration, Math.max(1, n))));
                                    form.trigger("multi_prompt");
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {!multiShot && (
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={MIN_DURATION}
                          max={MAX_DURATION}
                          placeholder="e.g. 5, 10 or 15"
                          value={
                            field.value === undefined || field.value === null ? "" : field.value
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              field.onChange(MIN_DURATION);
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isNaN(n)) {
                              field.onChange(Math.min(MAX_DURATION, Math.max(MIN_DURATION, n)));
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {MIN_DURATION}–{MAX_DURATION} seconds.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                name="sound"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sound</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="off">Off</SelectItem>
                        <SelectItem value="on">On</SelectItem>
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
