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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useEffect } from "react";
import { GoogleOAuthConnection } from "../../components/google-oauth-connection";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),

  action: z.enum([
    "createPresentation",
    "listPresentations",
    "createSlide",
    "insertText",
    "insertImage",
    "insertShape",
    "insertTable",
    "replaceText",
    "replaceImage",
    "exportPresentation",
    "getPresentation",
  ]),
  // Create Presentation
  title: z.string().optional(),
  // Create Slide / Insert Content
  presentationId: z.string().optional(),
  // Insert Text
  text: z.string().optional(),
  slideIndex: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  // Insert Image
  imageUrl: z.string().optional(),
  imageDriveFileId: z.string().optional(),
  // Insert Shape
  shapeType: z.enum(["RECTANGLE", "ROUND_RECTANGLE", "ELLIPSE", "LINE", "ARROW"]).optional(),
  // Insert Table
  rows: z.string().optional(),
  columns: z.string().optional(),
  // Replace Text
  oldText: z.string().optional(),
  newText: z.string().optional(),
  // Replace Image
  objectId: z.string().optional(),
  // Export
  mimeType: z.string().optional(),
});

export type GoogleSlidesFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleSlidesFormValues) => void;
  defaultValues?: Partial<GoogleSlidesFormValues>;
}

export const GoogleSlidesDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<GoogleSlidesFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleSlides",
      action: defaultValues.action || "createPresentation",
      title: defaultValues.title || "",
      presentationId: defaultValues.presentationId || "",
      text: defaultValues.text || "",
      slideIndex: defaultValues.slideIndex || "0",
      x: defaultValues.x || "100",
      y: defaultValues.y || "100",
      width: defaultValues.width || "400",
      height: defaultValues.height || "50",
      imageUrl: defaultValues.imageUrl || "",
      imageDriveFileId: defaultValues.imageDriveFileId || "",
      shapeType: defaultValues.shapeType || "RECTANGLE",
      rows: defaultValues.rows || "3",
      columns: defaultValues.columns || "3",
      oldText: defaultValues.oldText || "",
      newText: defaultValues.newText || "",
      objectId: defaultValues.objectId || "",
      mimeType: defaultValues.mimeType || "application/pdf",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleSlides",
        action: defaultValues.action || "createPresentation",
        title: defaultValues.title || "",
        presentationId: defaultValues.presentationId || "",
        text: defaultValues.text || "",
        slideIndex: defaultValues.slideIndex || "0",
        x: defaultValues.x || "100",
        y: defaultValues.y || "100",
        width: defaultValues.width || "400",
        height: defaultValues.height || "50",
        imageUrl: defaultValues.imageUrl || "",
        imageDriveFileId: defaultValues.imageDriveFileId || "",
        shapeType: defaultValues.shapeType || "RECTANGLE",
        rows: defaultValues.rows || "3",
        columns: defaultValues.columns || "3",
        oldText: defaultValues.oldText || "",
        newText: defaultValues.newText || "",
        objectId: defaultValues.objectId || "",
        mimeType: defaultValues.mimeType || "application/pdf",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleSlides";

  const handleSubmit = async (values: GoogleSlidesFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Slides node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Slides</DialogTitle>
          <DialogDescription>Configure the Google Slides action.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="googleSlides" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.presentationId}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Google Account Connection</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Connect your Google account to use Google Slides. Uses env-based OAuth
                  credentials.
                </p>
                <div className="mt-2">
                  <GoogleOAuthConnection />
                </div>
              </div>

              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="createPresentation">Create Presentation</SelectItem>
                        <SelectItem value="listPresentations">List Presentations</SelectItem>
                        <SelectItem value="createSlide">Create Slide</SelectItem>
                        <SelectItem value="insertText">Insert Text</SelectItem>
                        <SelectItem value="insertImage">Insert Image</SelectItem>
                        <SelectItem value="insertShape">Insert Shape</SelectItem>
                        <SelectItem value="insertTable">Insert Table</SelectItem>
                        <SelectItem value="replaceText">Replace Text</SelectItem>
                        <SelectItem value="replaceImage">Replace Image</SelectItem>
                        <SelectItem value="exportPresentation">Export Presentation</SelectItem>
                        <SelectItem value="getPresentation">Get Presentation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the action to perform on Google Slides.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Create Presentation */}
              {watchAction === "createPresentation" && (
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presentation Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Presentation or {{variables.title}}" />
                      </FormControl>
                      <FormDescription>
                        Title of the presentation. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Create Slide / Insert Content - Presentation ID */}
              {(watchAction === "createSlide" ||
                watchAction === "insertText" ||
                watchAction === "insertImage" ||
                watchAction === "insertShape" ||
                watchAction === "insertTable" ||
                watchAction === "replaceText" ||
                watchAction === "replaceImage" ||
                watchAction === "exportPresentation" ||
                watchAction === "getPresentation") && (
                <FormField
                  control={form.control}
                  name="presentationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presentation ID *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Presentation ID or {{variables.presentationId}}"
                        />
                      </FormControl>
                      <FormDescription>
                        ID of the presentation. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Insert Text */}
              {watchAction === "insertText" && (
                <>
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Text to insert or {{variables.text}}"
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Text to insert into the slide. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slideIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slide Index</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0" type="number" />
                        </FormControl>
                        <FormDescription>Index of the slide (0-based).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="x"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>X Position</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="100" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="y"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Y Position</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="100" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="width"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Width</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="400" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="50" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {/* Insert Image */}
              {watchAction === "insertImage" && (
                <>
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://example.com/image.png or {{variables.imageUrl}}"
                          />
                        </FormControl>
                        <FormDescription>
                          URL of the image to insert. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm text-muted-foreground text-center">OR</div>
                  <FormField
                    control={form.control}
                    name="imageDriveFileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drive File ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Drive file ID or {{variables.fileId}}" />
                        </FormControl>
                        <FormDescription>
                          Google Drive file ID of the image. Use {"{{variables}}"} for dynamic
                          values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slideIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slide Index</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0" type="number" />
                        </FormControl>
                        <FormDescription>Index of the slide (0-based).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="x"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>X Position</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="100" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="y"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Y Position</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="100" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="width"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Width</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="400" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="300" type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {/* Replace Text */}
              {watchAction === "replaceText" && (
                <>
                  <FormField
                    control={form.control}
                    name="oldText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placeholder Text *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="{{Name}} or {{variables.placeholder}}" />
                        </FormControl>
                        <FormDescription>
                          Text to replace (placeholder). Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Text *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Replacement text or {{variables.newText}}"
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Text to replace with. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Export Presentation */}
              {watchAction === "exportPresentation" && (
                <FormField
                  control={form.control}
                  name="mimeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Export Format</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select export format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="application/pdf">PDF</SelectItem>
                          <SelectItem value="application/vnd.openxmlformats-officedocument.presentationml.presentation">
                            PowerPoint (PPTX)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Format to export the presentation.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
