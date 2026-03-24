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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

const formSchema = z.object({
  variables: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
    .optional(),
  video_id: z.string().min(1, "Video ID is required"),
  prompt: z.string().max(2500).optional(),
  negative_prompt: z.string().max(2500).optional(),
  cfg_scale: z.coerce.number().min(0).max(2).optional(),
});

export type KlingVideoExtendFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingVideoExtendFormValues) => void;
  defaultValues?: Partial<KlingVideoExtendFormValues>;
}

export const KlingVideoExtendDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<KlingVideoExtendFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingVideoExtend",
      video_id: defaultValues.video_id ?? "{{klingText2Video.videoId}}",
      prompt: defaultValues.prompt ?? "",
      negative_prompt: defaultValues.negative_prompt ?? "",
      cfg_scale: defaultValues.cfg_scale ?? 0.5,
    },
  });

  useEffect(() => {
    if (open) form.reset({ ...form.getValues(), ...defaultValues });
  }, [open, defaultValues]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Video Extend</DialogTitle>
          <DialogDescription>
            Extend a Kling video. Set video_id from a previous Kling video node (e.g.{" "}
            {"{{klingText2Video.videoId}}"}).
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
                    <Input {...field} placeholder="klingVideoExtend" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="video_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{klingText2Video.videoId}}" />
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
                  <FormLabel>Prompt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Extension prompt..." rows={2} />
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
            <FormField
              control={form.control}
              name="cfg_scale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CFG scale</FormLabel>
                  <FormControl>
                    <Input type="number" step={0.1} min={0} max={2} {...field} />
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
