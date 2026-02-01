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
  image: z.string().min(1, "Image is required").max(2000),
  audio_url: z.string().min(1, "Audio URL is required").max(2000),
  prompt: z.string().max(1000).optional(),
  mode: z.enum(["std", "pro"]),
});

export type KlingAvatarFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingAvatarFormValues) => void;
  defaultValues?: Partial<KlingAvatarFormValues>;
}

export const KlingAvatarDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingAvatarFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingAvatar",
      image: defaultValues.image ?? "",
      audio_url: defaultValues.audio_url ?? "{{klingTts.audioUrl}}",
      prompt: defaultValues.prompt ?? "",
      mode: defaultValues.mode ?? "std",
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
          <DialogTitle>Kling Avatar</DialogTitle>
          <DialogDescription>
            Lip-sync avatar video from a portrait image and audio URL (e.g. from Kling TTS).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingAvatar" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="image" render={({ field }) => (
              <FormItem><FormLabel>Portrait image (URL or variable)</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingImage.imageUrls[0]}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="audio_url" render={({ field }) => (
              <FormItem><FormLabel>Audio URL</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingTts.audioUrl}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="prompt" render={({ field }) => (
              <FormItem><FormLabel>Prompt (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="Optional prompt..." rows={2} /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="mode" render={({ field }) => (
              <FormItem><FormLabel>Mode</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="std">Standard</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
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
