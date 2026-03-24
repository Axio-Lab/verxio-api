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
  action: z.enum(["createMeeting", "getMeetingLink"]),
  calendarId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  timeZone: z.string().optional(),
  attendees: z.string().optional(),
  location: z.string().optional(),
  eventId: z.string().optional(),
});

export type GoogleMeetFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleMeetFormValues) => void;
  defaultValues?: Partial<GoogleMeetFormValues>;
}

export const GoogleMeetDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<GoogleMeetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleMeet",
      action: defaultValues.action || "createMeeting",
      calendarId: defaultValues.calendarId || "primary",
      summary: defaultValues.summary || "",
      description: defaultValues.description || "",
      startDateTime: defaultValues.startDateTime || "",
      endDateTime: defaultValues.endDateTime || "",
      timeZone: defaultValues.timeZone || "UTC",
      attendees: defaultValues.attendees || "",
      location: defaultValues.location || "",
      eventId: defaultValues.eventId || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleMeet",
        action: defaultValues.action || "createMeeting",
        calendarId: defaultValues.calendarId || "primary",
        summary: defaultValues.summary || "",
        description: defaultValues.description || "",
        startDateTime: defaultValues.startDateTime || "",
        endDateTime: defaultValues.endDateTime || "",
        timeZone: defaultValues.timeZone || "UTC",
        attendees: defaultValues.attendees || "",
        location: defaultValues.location || "",
        eventId: defaultValues.eventId || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleMeet";

  const handleSubmit = async (values: GoogleMeetFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Meet node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Meet</DialogTitle>
          <DialogDescription>Configure the Google Meet action.</DialogDescription>
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
                      <Input {...field} placeholder="googleMeet" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.meetLink}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Google Account Connection</Label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Connect your Google account to use Google Meet. Uses env-based OAuth credentials.
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
                        <SelectItem value="createMeeting">Create Meeting</SelectItem>
                        <SelectItem value="getMeetingLink">Get Meeting Link</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform on Google Meet.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="calendarId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calendar ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="primary" />
                    </FormControl>
                    <FormDescription>
                      Calendar ID (use "primary" for default calendar). Use {"{{variables}}"} for
                      dynamic values.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Create Meeting Fields */}
              {watchAction === "createMeeting" && (
                <>
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Title *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Team Meeting or {{variables.title}}" />
                        </FormControl>
                        <FormDescription>
                          Title of the meeting. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Meeting description or {{variables.description}}"
                            className="min-h-[80px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="startDateTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date/Time *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="2024-01-15T10:00:00 or {{variables.startTime}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ISO 8601 format (e.g., 2024-01-15T10:00:00). Use {"{{variables}}"} for
                          dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDateTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date/Time *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="2024-01-15T11:00:00 or {{variables.endTime}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ISO 8601 format (e.g., 2024-01-15T11:00:00). Use {"{{variables}}"} for
                          dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeZone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Zone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="UTC" />
                        </FormControl>
                        <FormDescription>Time zone (e.g., UTC, America/New_York).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="attendees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attendees</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='["email1@example.com", "email2@example.com"]'
                          />
                        </FormControl>
                        <FormDescription>
                          JSON array of email addresses or comma-separated emails. Use{" "}
                          {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Get Meeting Link Fields */}
              {watchAction === "getMeetingLink" && (
                <FormField
                  control={form.control}
                  name="eventId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Event ID or {{variables.eventId}}" />
                      </FormControl>
                      <FormDescription>
                        ID of the calendar event. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
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
