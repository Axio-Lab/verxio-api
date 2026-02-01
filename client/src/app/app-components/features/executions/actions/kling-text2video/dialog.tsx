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
import { useEffect } from "react";

const formSchema = z.object({
  variables: z.string().min(1).regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Use letters, numbers, underscores" }).optional(),
  prompt: z.string().min(1, "Prompt is required").max(2500),
  negative_prompt: z.string().max(2500).optional(),
  model_name: z.enum(["kling-v1", "kling-v1-6", "kling-v2-master", "kling-v2-1-master", "kling-v2-5-turbo", "kling-v2-6"]),
  mode: z.enum(["std", "pro"]),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.enum(["5", "10"]),
  sound: z.enum(["on", "off"]),
  camera_control_type: z
    .enum(["none", "simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"])
    .optional(),
  camera_control_horizontal: z.number().min(-10).max(10).optional(),
  camera_control_vertical: z.number().min(-10).max(10).optional(),
  camera_control_pan: z.number().min(-10).max(10).optional(),
  camera_control_tilt: z.number().min(-10).max(10).optional(),
  camera_control_roll: z.number().min(-10).max(10).optional(),
  camera_control_zoom: z.number().min(-10).max(10).optional(),
});

export type KlingText2VideoFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingText2VideoFormValues) => void;
  defaultValues?: Partial<KlingText2VideoFormValues>;
}

export const KlingText2VideoDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingText2VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingText2Video",
      prompt: defaultValues.prompt ?? "",
      negative_prompt: defaultValues.negative_prompt ?? "",
      model_name: defaultValues.model_name ?? "kling-v1",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: defaultValues.duration ?? "5",
      sound: defaultValues.sound ?? "off",
      camera_control_type: defaultValues.camera_control_type ?? "none",
      camera_control_horizontal: defaultValues.camera_control_horizontal ?? 0,
      camera_control_vertical: defaultValues.camera_control_vertical ?? 0,
      camera_control_pan: defaultValues.camera_control_pan ?? 0,
      camera_control_tilt: defaultValues.camera_control_tilt ?? 0,
      camera_control_roll: defaultValues.camera_control_roll ?? 0,
      camera_control_zoom: defaultValues.camera_control_zoom ?? 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingText2Video",
        prompt: defaultValues.prompt ?? "",
        negative_prompt: defaultValues.negative_prompt ?? "",
        model_name: defaultValues.model_name ?? "kling-v1",
        mode: defaultValues.mode ?? "std",
        aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
        duration: defaultValues.duration ?? "5",
        sound: defaultValues.sound ?? "off",
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
                  <FormLabel>Output variable name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="klingText2Video" />
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
                        <SelectItem value="kling-v1-6">kling-v1-6</SelectItem>
                        <SelectItem value="kling-v2-master">kling-v2-master</SelectItem>
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
