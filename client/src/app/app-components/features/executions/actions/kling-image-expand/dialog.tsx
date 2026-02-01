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
  prompt: z.string().max(1000).optional(),
  aspect_ratio: z.string(),
});

export type KlingImageExpandFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingImageExpandFormValues) => void;
  defaultValues?: Partial<KlingImageExpandFormValues>;
}

export const KlingImageExpandDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingImageExpandFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingImageExpand",
      image: defaultValues.image ?? "{{klingImage.imageUrls[0]}}",
      prompt: defaultValues.prompt ?? "",
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
          <DialogTitle>Kling Image Expand</DialogTitle>
          <DialogDescription>
            Expand image boundaries (outpainting). Image required (URL or variable).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingImageExpand" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="image" render={({ field }) => (
              <FormItem><FormLabel>Input image</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingImage.imageUrls[0]}}" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="prompt" render={({ field }) => (
              <FormItem><FormLabel>Prompt (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="What to add in expanded area..." rows={2} /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="aspect_ratio" render={({ field }) => (
              <FormItem><FormLabel>Aspect ratio</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="1:1">1:1</SelectItem><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem></SelectContent>
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
