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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

const formSchema = z.object({
  variables: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_]*$/).optional(),
  video_url: z.string().min(1, "Video URL is required").max(2000),
});

export type KlingVideo2AudioFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingVideo2AudioFormValues) => void;
  defaultValues?: Partial<KlingVideo2AudioFormValues>;
}

export const KlingVideo2AudioDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingVideo2AudioFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingVideo2Audio",
      video_url: defaultValues.video_url ?? "{{klingText2Video.videoUrl}}",
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
          <DialogTitle>Kling Video to Audio</DialogTitle>
          <DialogDescription>
            Extract audio from a video URL (e.g. from Kling Text-to-Video or Image-to-Video).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingVideo2Audio" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="video_url" render={({ field }) => (
              <FormItem><FormLabel>Video URL</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingText2Video.videoUrl}}" /></FormControl>
                <FormMessage /></FormItem>
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
