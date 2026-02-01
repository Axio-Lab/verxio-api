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
  image_list: z.string().max(2000).optional(),
  n: z.coerce.number().min(1).max(4),
  aspect_ratio: z.string(),
});

export type KlingMultiImage2ImageFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingMultiImage2ImageFormValues) => void;
  defaultValues?: Partial<KlingMultiImage2ImageFormValues>;
}

export const KlingMultiImage2ImageDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingMultiImage2ImageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingMultiImage2Image",
      prompt: defaultValues.prompt ?? "",
      image_list: defaultValues.image_list ?? "",
      n: defaultValues.n ?? 1,
      aspect_ratio: defaultValues.aspect_ratio ?? "1:1",
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
          <DialogTitle>Kling Multi-Image to Image</DialogTitle>
          <DialogDescription>
            Generate image from multiple reference images. Prompt or image_list required (JSON array or URLs).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingMultiImage2Image" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="prompt" render={({ field }) => (
              <FormItem><FormLabel>Prompt (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="Describe the image..." rows={2} /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="image_list" render={({ field }) => (
              <FormItem><FormLabel>Image list</FormLabel>
                <FormControl><Input {...field} placeholder='["{{klingImage.imageUrls[0]}}"]' /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="n" render={({ field }) => (
                <FormItem><FormLabel>Number of images</FormLabel>
                  <FormControl><Input type="number" min={1} max={4} {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="aspect_ratio" render={({ field }) => (
                <FormItem><FormLabel>Aspect ratio</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="1:1">1:1</SelectItem><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem></SelectContent>
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
