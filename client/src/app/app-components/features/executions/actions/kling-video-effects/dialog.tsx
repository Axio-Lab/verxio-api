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
  prompt: z.string().max(1000).optional(),
  effect_scene: z.string().max(500).optional(),
  image: z.string().max(2000).optional(),
  mode: z.enum(["std", "pro"]),
});

export type KlingVideoEffectsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingVideoEffectsFormValues) => void;
  defaultValues?: Partial<KlingVideoEffectsFormValues>;
}

export const KlingVideoEffectsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingVideoEffectsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables ?? "klingVideoEffects",
      prompt: defaultValues.prompt ?? "",
      effect_scene: defaultValues.effect_scene ?? "",
      image: defaultValues.image ?? "{{klingImage.imageUrls[0]}}",
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
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling Video Effects</DialogTitle>
          <DialogDescription>
            Apply video effects to an input image. Image or effect_scene required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField control={form.control} name="variables" render={({ field }) => (
              <FormItem><FormLabel>Output variable name</FormLabel>
                <FormControl><Input {...field} placeholder="klingVideoEffects" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="prompt" render={({ field }) => (
              <FormItem><FormLabel>Prompt (optional)</FormLabel>
                <FormControl><Textarea {...field} placeholder="Effect description..." rows={2} /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="effect_scene" render={({ field }) => (
              <FormItem><FormLabel>Effect scene (optional)</FormLabel>
                <FormControl><Input {...field} placeholder="Effect type or scene" /></FormControl>
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="image" render={({ field }) => (
              <FormItem><FormLabel>Input image (URL or variable)</FormLabel>
                <FormControl><Input {...field} placeholder="{{klingImage.imageUrls[0]}}" /></FormControl>
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
