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
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { FormDescription } from "@/components/ui/form";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REFERENCE_IMAGES = 15;
const MAX_DURATION = 15;
const MIN_DURATION = 1;
const MAX_STORYBOARDS = 6;
const MIN_STORYBOARDS = 1;
const MAX_PROMPT_CHARS = 2500;
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
    prompt: z.string().max(MAX_PROMPT_CHARS).optional(),
    model_name: z.enum(["kling-v3-omni"]),
    multi_shot: z.boolean(),
    multi_prompt: z.array(multiPromptItemSchema).max(MAX_STORYBOARDS),
    referenceImages: z
      .array(
        z.object({
          file: z.string(),
          filename: z.string(),
          type: z.enum(["reference", "first_frame", "end_frame"]).optional(),
        })
      )
      .max(MAX_REFERENCE_IMAGES)
      .optional(),
    element_list: z.string().max(2000).optional(),
    mode: z.enum(["std", "pro"]),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1"]),
    duration: z.coerce.number().min(MIN_DURATION).max(MAX_DURATION),
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
      if (!(data.prompt ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Prompt is required when not using storyboard",
          path: ["prompt"],
        });
      }
    }
  });

export type KlingOmniVideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingOmniVideoFormValues) => void;
  defaultValues?: Partial<KlingOmniVideoFormValues>;
}

export const KlingOmniVideoDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [referenceImageFiles, setReferenceImageFiles] = useState<
    Array<{ file: File | null; base64: string; filename: string; mimeType: string; type?: string }>
  >([]);
  const referenceImagesInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<KlingOmniVideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingOmniVideo",
      prompt: defaultValues.prompt ?? "",
      model_name: "kling-v3-omni",
      multi_shot: defaultValues.multi_shot ?? false,
      multi_prompt:
        Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
          ? defaultValues.multi_prompt
          : [{ index: 0, prompt: "", duration: "5" }],
      referenceImages: defaultValues.referenceImages ?? [],
      element_list: defaultValues.element_list ?? "",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)),
    },
  });

  const multiShot = form.watch("multi_shot");
  const totalDuration = parseInt(form.watch("duration") ?? "5", 10) || 5;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "multi_prompt",
  });

  // When toggling storyboard on, ensure we have at least one shot (use append so useFieldArray stays in sync)
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
      const durationNum = Math.min(
        MAX_DURATION,
        Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)
      );
      form.reset({
        variables: defaultValues.variables ?? "klingOmniVideo",
        prompt: defaultValues.prompt ?? "",
        model_name: "kling-v3-omni",
        multi_shot: defaultValues.multi_shot ?? false,
        multi_prompt:
          Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
            ? defaultValues.multi_prompt
            : [{ index: 0, prompt: "", duration: String(durationNum) }],
        referenceImages: defaultValues.referenceImages ?? [],
        element_list: defaultValues.element_list ?? "",
        mode: defaultValues.mode ?? "std",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
        duration: durationNum,
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

    if (referenceImageFiles.length + files.length > MAX_REFERENCE_IMAGES) {
      toast.error(`You can upload up to ${MAX_REFERENCE_IMAGES} images.`);
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
    setReferenceImageFiles((prev) => prev.map((img, i) => (i === index ? { ...img, type } : img)));
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = form.handleSubmit((values) => {
    if (referenceImageFiles.length > 0) {
      values.referenceImages = referenceImageFiles.map((img) => ({
        file: img.base64,
        filename: img.filename,
        type:
          img.type && img.type !== "reference"
            ? (img.type as "first_frame" | "end_frame")
            : undefined,
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
            Kling v3 Omni video (max {MAX_DURATION}s). Use a single prompt or enable storyboard for
            multi-shot (1–{MAX_STORYBOARDS} shots, each prompt max {MAX_STORYBOARD_PROMPT_CHARS} chars).
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
            <FormField
              control={form.control}
              name="multi_shot"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Storyboard (multi-shot)</FormLabel>
                    <FormDescription>
                      When on, use multiple shots with per-shot prompt and duration instead of a
                      single prompt.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={handleMultiShotChange}
                    />
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
                    <FormLabel>Prompt (required)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the video... Use <<<element_1>>>, <<<image_1>>>, <<<video_1>>> for references."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>Max {MAX_PROMPT_CHARS} characters.</FormDescription>
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
                          value={field.value === undefined || field.value === null ? "" : field.value}
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
                        Enter a value from {MIN_DURATION} to {MAX_DURATION}. Sum of all storyboard
                        shot durations must equal this total.
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
                        <div
                          key={item.id}
                          className="rounded-lg border p-3 space-y-2 bg-muted/30"
                        >
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
                                    {...f}
                                    onChange={(e) => {
                                      f.onChange(e.target.value);
                                      form.trigger("multi_prompt");
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}
                  {form.formState.errors.multi_prompt?.message && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.multi_prompt.message}
                    </p>
                  )}
                </div>
              </div>
            )}
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
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter a value from {MIN_DURATION} to {MAX_DURATION} seconds.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => referenceImagesInputRef.current?.click()}
                  disabled={referenceImageFiles.length >= MAX_REFERENCE_IMAGES}
                >
                  Upload Reference Images ({referenceImageFiles.length}/{MAX_REFERENCE_IMAGES})
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
