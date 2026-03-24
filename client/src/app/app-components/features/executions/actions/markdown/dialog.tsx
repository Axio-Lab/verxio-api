"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v3";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const markdownSchema = z.object({
  variables: z.string().min(1, "Variable name is required"),
  textSource: z.string().min(1, "Text source is required"),
  outputFilename: z.string().optional(),
});

export type MarkdownFormValues = z.infer<typeof markdownSchema>;

interface MarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MarkdownFormValues) => void;
  defaultValues?: Partial<MarkdownFormValues>;
}

export function MarkdownDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: MarkdownDialogProps) {
  const form = useForm<MarkdownFormValues>({
    resolver: zodResolver(markdownSchema),
    defaultValues: {
      variables: defaultValues?.variables ?? "markdown",
      textSource: defaultValues?.textSource ?? "",
      outputFilename: defaultValues?.outputFilename ?? "",
    },
  });

  const handleSubmit = (values: MarkdownFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Markdown Node</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variables">Variable Name</Label>
            <Input id="variables" placeholder="markdown" {...form.register("variables")} />
            <p className="text-xs text-muted-foreground">
              Output is accessible via {"{{"}
              {form.watch("variables") || "markdown"}.content{"}}"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textSource">Text Source</Label>
            <Input id="textSource" placeholder="{{gemini.text}}" {...form.register("textSource")} />
            <p className="text-xs text-muted-foreground">
              Reference text from a previous node (e.g. {"{{gemini.text}}"}, {"{{anthropic.text}}"})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputFilename">Download Filename (optional)</Label>
            <Input id="outputFilename" placeholder="output" {...form.register("outputFilename")} />
            <p className="text-xs text-muted-foreground">
              Filename for .md download (without extension)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
