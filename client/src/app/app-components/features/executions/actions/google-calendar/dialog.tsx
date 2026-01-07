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
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
import { GoogleOAuthConnection } from "../../components/google-oauth-connection";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().min(1, { message: "Google OAuth credential is required" }),
  action: z.enum([
    "createEvent",
    "listEvents",
    "updateEvent",
    "deleteEvent",
    "getEvent",
    "findFreeBusy",
  ]),
  calendarId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  timeZone: z.string().optional(),
  attendees: z.string().optional(),
  location: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().optional(),
  eventId: z.string().optional(),
  items: z.string().optional(),
});

export type GoogleCalendarFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoogleCalendarFormValues) => void;
  defaultValues?: Partial<GoogleCalendarFormValues>;
}

export const GoogleCalendarDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.GOOGLE_OAUTH);
  const googleCredentials = credentialsData?.credentials || [];

  const form = useForm<GoogleCalendarFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "googleCalendar",
      credentialId: defaultValues.credentialId || "",
      action: defaultValues.action || "createEvent",
      calendarId: defaultValues.calendarId || "primary",
      summary: defaultValues.summary || "",
      description: defaultValues.description || "",
      startDateTime: defaultValues.startDateTime || "",
      endDateTime: defaultValues.endDateTime || "",
      timeZone: defaultValues.timeZone || "UTC",
      attendees: defaultValues.attendees || "",
      location: defaultValues.location || "",
      timeMin: defaultValues.timeMin || "",
      timeMax: defaultValues.timeMax || "",
      maxResults: defaultValues.maxResults || 10,
      eventId: defaultValues.eventId || "",
      items: defaultValues.items || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "googleCalendar",
        credentialId: defaultValues.credentialId || "",
        action: defaultValues.action || "createEvent",
        calendarId: defaultValues.calendarId || "primary",
        summary: defaultValues.summary || "",
        description: defaultValues.description || "",
        startDateTime: defaultValues.startDateTime || "",
        endDateTime: defaultValues.endDateTime || "",
        timeZone: defaultValues.timeZone || "UTC",
        attendees: defaultValues.attendees || "",
        location: defaultValues.location || "",
        timeMin: defaultValues.timeMin || "",
        timeMax: defaultValues.timeMax || "",
        maxResults: defaultValues.maxResults || 10,
        eventId: defaultValues.eventId || "",
        items: defaultValues.items || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchAction = form.watch("action");
  const watchVariables = form.watch("variables") || "googleCalendar";

  const handleSubmit = async (values: GoogleCalendarFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Google Calendar node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Google Calendar</DialogTitle>
          <DialogDescription>Configure the Google Calendar action.</DialogDescription>
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
                      <Input {...field} placeholder="googleCalendar" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.eventId}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google OAuth Credential</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Google OAuth credential" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {googleCredentials.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No Google OAuth credentials found. Please add one in the Credentials
                            page.
                          </div>
                        ) : (
                          googleCredentials.map((credential) => (
                            <SelectItem key={credential.id} value={credential.id}>
                              {credential.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the Google OAuth credential with Calendar API access.
                    </FormDescription>
                    <FormMessage />
                    <div className="mt-2">
                      <GoogleOAuthConnection credentialId={field.value} />
                    </div>
                  </FormItem>
                )}
              />

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
                        <SelectItem value="createEvent">Create Event</SelectItem>
                        <SelectItem value="listEvents">List Events</SelectItem>
                        <SelectItem value="updateEvent">Update Event</SelectItem>
                        <SelectItem value="deleteEvent">Delete Event</SelectItem>
                        <SelectItem value="getEvent">Get Event</SelectItem>
                        <SelectItem value="findFreeBusy">Find Free/Busy Times</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the action to perform on Google Calendar.
                    </FormDescription>
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

              {/* Create/Update Event Fields */}
              {(watchAction === "createEvent" || watchAction === "updateEvent") && (
                <>
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title {watchAction === "createEvent" && "*"}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Meeting with team or {{variables.title}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Title of the event. Use {"{{variables}}"} for dynamic values.
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
                            placeholder="Event description or {{variables.description}}"
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
                        <FormLabel>
                          Start Date/Time {watchAction === "createEvent" && "*"}
                        </FormLabel>
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
                        <FormLabel>End Date/Time {watchAction === "createEvent" && "*"}</FormLabel>
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Conference Room A or {{variables.location}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional location. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
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

              {/* List Events Fields */}
              {watchAction === "listEvents" && (
                <>
                  <FormField
                    control={form.control}
                    name="timeMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="2024-01-15T00:00:00 or {{variables.startTime}}"
                          />
                        </FormControl>
                        <FormDescription>
                          ISO 8601 format. Leave empty for current time. Use {"{{variables}}"} for
                          dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="2024-01-20T23:59:59 or {{variables.endTime}}"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: ISO 8601 format. Use {"{{variables}}"} for dynamic values.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxResults"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Results</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                            value={field.value || 10}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of events to return (default: 10).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Update/Delete/Get Event Fields */}
              {(watchAction === "updateEvent" ||
                watchAction === "deleteEvent" ||
                watchAction === "getEvent") && (
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
                        ID of the event. Use {"{{variables}}"} for dynamic values.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Find Free/Busy Fields */}
              {watchAction === "findFreeBusy" && (
                <>
                  <FormField
                    control={form.control}
                    name="items"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calendar IDs *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`[{"id": "primary"}] or {"{{variables.calendarIds}}"}`}
                          />
                        </FormControl>
                        <FormDescription>
                          JSON array of calendar objects (e.g., {`[{"id": "primary"}]`}) or
                          comma-separated calendar IDs.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="2024-01-15T00:00:00" />
                        </FormControl>
                        <FormDescription>
                          ISO 8601 format. Leave empty for current time.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="2024-01-20T23:59:59" />
                        </FormControl>
                        <FormDescription>Optional: ISO 8601 format.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
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
