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
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { FormDescription } from "@/components/ui/form";

const MAX_DURATION = 15;
const MIN_DURATION = 1;
const MAX_STORYBOARDS = 6;
const MIN_STORYBOARDS = 1;
const MAX_PROMPT_CHARS = 2500;
const MAX_STORYBOARD_PROMPT_CHARS = 512;

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
    negative_prompt: z.string().max(2500).optional(),
    model_name: z.enum(["kling-v3"]),
    mode: z.enum(["std", "pro"]),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1"]),
    duration: z.coerce.number().min(MIN_DURATION).max(MAX_DURATION),
    sound: z.enum(["on", "off"]),
    multi_shot: z.boolean(),
    multi_prompt: z.array(multiPromptItemSchema).max(MAX_STORYBOARDS),
    camera_control_type: z
      .enum([
        "none",
        "simple",
        "down_back",
        "forward_up",
        "right_turn_forward",
        "left_turn_forward",
      ])
      .optional(),
    camera_control_horizontal: z.number().min(-10).max(10).optional(),
    camera_control_vertical: z.number().min(-10).max(10).optional(),
    camera_control_pan: z.number().min(-10).max(10).optional(),
    camera_control_tilt: z.number().min(-10).max(10).optional(),
    camera_control_roll: z.number().min(-10).max(10).optional(),
    camera_control_zoom: z.number().min(-10).max(10).optional(),
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

export type KlingText2VideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingText2VideoFormValues) => void;
  defaultValues?: Partial<KlingText2VideoFormValues>;
}

export const KlingText2VideoDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<KlingText2VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingText2Video",
      prompt: defaultValues.prompt ?? "",
      negative_prompt: defaultValues.negative_prompt ?? "",
      model_name: "kling-v3",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)),
      sound: defaultValues.sound ?? "off",
      multi_shot: defaultValues.multi_shot ?? false,
      multi_prompt:
        Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
          ? defaultValues.multi_prompt
          : [{ index: 0, prompt: "", duration: "5" }],
      camera_control_type: defaultValues.camera_control_type ?? "none",
      camera_control_horizontal: defaultValues.camera_control_horizontal ?? 0,
      camera_control_vertical: defaultValues.camera_control_vertical ?? 0,
      camera_control_pan: defaultValues.camera_control_pan ?? 0,
      camera_control_tilt: defaultValues.camera_control_tilt ?? 0,
      camera_control_roll: defaultValues.camera_control_roll ?? 0,
      camera_control_zoom: defaultValues.camera_control_zoom ?? 0,
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
      const durationNum = Math.min(
        MAX_DURATION,
        Math.max(MIN_DURATION, Number(defaultValues.duration) || 5)
      );
      form.reset({
        variables: defaultValues.variables ?? "klingText2Video",
        prompt: defaultValues.prompt ?? "",
        negative_prompt: defaultValues.negative_prompt ?? "",
        model_name: "kling-v3",
        mode: defaultValues.mode ?? "std",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
        duration: durationNum,
        sound: defaultValues.sound ?? "off",
        multi_shot: defaultValues.multi_shot ?? false,
        multi_prompt:
          Array.isArray(defaultValues.multi_prompt) && defaultValues.multi_prompt.length > 0
            ? defaultValues.multi_prompt
            : [{ index: 0, prompt: "", duration: String(durationNum) }],
        camera_control_type: defaultValues.camera_control_type ?? "none",
        camera_control_horizontal: defaultValues.camera_control_horizontal ?? 0,
        camera_control_vertical: defaultValues.camera_control_vertical ?? 0,
        camera_control_pan: defaultValues.camera_control_pan ?? 0,
        camera_control_tilt: defaultValues.camera_control_tilt ?? 0,
        camera_control_roll: defaultValues.camera_control_roll ?? 0,
        camera_control_zoom: defaultValues.camera_control_zoom ?? 0,
      });
    }
  }, [open, defaultValues, form]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Text-to-Video</DialogTitle>
          <DialogDescription>
            Generate video from text using Kling AI. Use variables like {"{{previousNode.output}}"}.
          </DialogDescription>
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
                    <Input {...field} placeholder="klingText2Video" />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:
                    <br />
                    <code className="text-xs">{`{{${field.value || "klingText2Video"}.videoUrl}}`}</code>
                  </FormDescription>
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
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe the video..." rows={3} />
                    </FormControl>
                    <FormDescription>Max {MAX_PROMPT_CHARS} characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="negative_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Negative prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="What to avoid..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              <FormField
                control={form.control}
                name="camera_control_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camera movement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="down_back">Down + Back</SelectItem>
                        <SelectItem value="forward_up">Forward + Up</SelectItem>
                        <SelectItem value="right_turn_forward">Right turn + Forward</SelectItem>
                        <SelectItem value="left_turn_forward">Left turn + Forward</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("camera_control_type") === "simple" && (
                <>
                  <FormField
                    control={form.control}
                    name="camera_control_horizontal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horizontal (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camera_control_vertical"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vertical (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camera_control_pan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pan (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camera_control_tilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tilt (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camera_control_roll"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roll (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camera_control_zoom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zoom (-10 to 10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min={-10}
                            max={10}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
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
