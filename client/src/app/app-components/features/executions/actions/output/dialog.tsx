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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const outputSchema = z.object({
  variables: z.string().min(1, "Variable name is required"),
  contentType: z.enum(["image", "video", "audio"]),
  imageSource: z.string().optional(),
  videoSource: z.string().optional(),
  audioSource: z.string().optional(),
  outputFilename: z.string().optional(),
});

export type OutputFormValues = z.infer<typeof outputSchema>;

interface OutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OutputFormValues) => void;
  defaultValues?: Partial<OutputFormValues>;
}

export function OutputDialog({ open, onOpenChange, onSubmit, defaultValues }: OutputDialogProps) {
  const form = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      variables: defaultValues?.variables || "output",
      contentType: defaultValues?.contentType || "image",
      imageSource: defaultValues?.imageSource || "",
      videoSource: defaultValues?.videoSource || "",
      audioSource: defaultValues?.audioSource || "",
      outputFilename: defaultValues?.outputFilename || "",
    },
  });

  const contentType = form.watch("contentType");

  const handleSubmit = (values: OutputFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Output Node</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variables">Variable Name</Label>
            <Input id="variables" placeholder="output" {...form.register("variables")} />
            <p className="text-xs text-muted-foreground">
              The output will be accessible via {"{{"}
              {form.watch("variables") || "output"}.content{"}}"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select
              value={contentType}
              onValueChange={(value) =>
                form.setValue("contentType", value as OutputFormValues["contentType"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the type of content from the previous node
            </p>
          </div>

          {contentType === "image" && (
            <div className="space-y-2">
              <Label htmlFor="imageSource">Image Source</Label>
              <Input
                id="imageSource"
                placeholder="{{designPro.imageUrl}}"
                {...form.register("imageSource")}
              />
              <p className="text-xs text-muted-foreground">
                Reference an image URL from a previous node (e.g., DESIGN, DESIGN_PRO)
              </p>
            </div>
          )}

          {contentType === "video" && (
            <div className="space-y-2">
              <Label htmlFor="videoSource">Video Source</Label>
              <Input
                id="videoSource"
                placeholder="{{veo.videoUrl}}"
                {...form.register("videoSource")}
              />
              <p className="text-xs text-muted-foreground">
                Reference a video URL from a previous node (e.g., VEO, REMOTION)
              </p>
            </div>
          )}

          {contentType === "audio" && (
            <div className="space-y-2">
              <Label htmlFor="audioSource">Audio Source</Label>
              <Input
                id="audioSource"
                placeholder="{{klingTts.audioUrl}}"
                {...form.register("audioSource")}
              />
              <p className="text-xs text-muted-foreground">
                Reference an audio URL from a previous node (e.g., KLING_TTS)
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="outputFilename">Output Filename (optional)</Label>
            <Input
              id="outputFilename"
              placeholder="generated-content"
              {...form.register("outputFilename")}
            />
            <p className="text-xs text-muted-foreground">
              Custom filename for downloads (without extension)
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
