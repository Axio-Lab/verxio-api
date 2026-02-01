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
import { useEffect } from "react";

const formSchema = z.object({
  variables: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_]*$/).optional(),
  prompt: z.string().max(2500).optional(),
  image: z.string().max(2000).optional(),
  video_url: z.string().max(2000).optional(),
  mode: z.enum(["std", "pro"]),
  aspect_ratio: z.string(),
  duration: z.string(),
});

export type KlingMotionControlFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingMotionControlFormValues) => void;
  defaultValues?: Partial<KlingMotionControlFormValues>;
}

export const KlingMotionControlDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingMotionControlFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingMotionControl",
      prompt: defaultValues.prompt ?? "",
      image: defaultValues.image ?? "",
      video_url: defaultValues.video_url ?? "",
      mode: defaultValues.mode ?? "std",
      aspect_ratio: defaultValues.aspect_ratio ?? "16:9",
      duration: defaultValues.duration ?? "5",
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kling Motion Control</DialogTitle>
          <DialogDescription>
            Motion control video from image and optional video reference. Prompt or image required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingMotionControl" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="prompt" render={({ field }) => (
              <FormItem><FormLabel>Prompt (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="Describe motion..." rows={2} /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="image" render={({ field }) => (
              <FormItem><FormLabel>Image (URL or variable)</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingImage.imageUrls[0]}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="video_url" render={({ field }) => (
              <FormItem><FormLabel>Video reference URL (optional)</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingText2Video.videoUrl}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="mode" render={({ field }) => (
                <FormItem><FormLabel>Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="std">Standard</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="aspect_ratio" render={({ field }) => (
                <FormItem><FormLabel>Aspect ratio</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem><FormLabel>Duration</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="5">5s</SelectItem><SelectItem value="10">10s</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
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
