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
import { authenticatedGet } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  action: z.enum(["textToSpeech", "speechToText", "cloneVoice", "listVoices", "getVoice"]),
  // For textToSpeech:
  text: z.string().optional(),
  voiceSelection: z.string().optional(), // "custom" or a voiceId
  voiceId: z.string().optional(),
  model: z
    .enum(["eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5", "eleven_v3"])
    .optional(),
  language: z.string().optional(),
  stability: z.string().optional(),
  similarityBoost: z.string().optional(),
  style: z.string().optional(),
  speakerBoost: z.boolean().optional(),
  // For speechToText:
  audioUrl: z.string().optional(),
  speakerDiarization: z.boolean().optional(),
  entityDetection: z.boolean().optional(),
  // For cloneVoice:
  voiceName: z.string().optional(),
  description: z.string().optional(),
});

export type ElevenLabsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ElevenLabsFormValues) => void;
  defaultValues?: Partial<ElevenLabsFormValues>;
}

export const ElevenLabsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<ElevenLabsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "elevenlabs",
      action: defaultValues.action || "textToSpeech",
      text: defaultValues.text || "",
      voiceSelection: defaultValues.voiceId || "custom",
      voiceId: defaultValues.voiceId || "",
      model: defaultValues.model || "eleven_multilingual_v2",
      language: defaultValues.language || "",
      stability: defaultValues.stability || "0.5",
      similarityBoost: defaultValues.similarityBoost || "0.75",
      style: defaultValues.style || "0.0",
      speakerBoost: defaultValues.speakerBoost ?? true,
      audioUrl: defaultValues.audioUrl || "",
      speakerDiarization: defaultValues.speakerDiarization ?? false,
      entityDetection: defaultValues.entityDetection ?? false,
      voiceName: defaultValues.voiceName || "",
      description: defaultValues.description || "",
    },
  });

  const watchAction = form.watch("action");

  useEffect(() => {
    if (open) {
      const action = defaultValues.action || "textToSpeech";
      form.reset({
        variables: defaultValues.variables || "elevenlabs",
        action: action,
        text: defaultValues.text || "",
        // Only set voiceSelection for textToSpeech action
        voiceSelection: action === "textToSpeech" ? defaultValues.voiceId || "custom" : "custom",
        // Set voiceId - only use saved voiceId if the action matches, otherwise clear it
        voiceId: defaultValues.action === action ? defaultValues.voiceId || "" : "",
        model: defaultValues.model || "eleven_multilingual_v2",
        language: defaultValues.language || "",
        stability: defaultValues.stability || "0.5",
        similarityBoost: defaultValues.similarityBoost || "0.75",
        style: defaultValues.style || "0.0",
        speakerBoost: defaultValues.speakerBoost ?? true,
        audioUrl: defaultValues.audioUrl || "",
        speakerDiarization: defaultValues.speakerDiarization ?? false,
        entityDetection: defaultValues.entityDetection ?? false,
        voiceName: defaultValues.voiceName || "",
        description: defaultValues.description || "",
      });
    }
  }, [open, defaultValues, form]);

  // Clear voiceId when user switches action to getVoice (if it wasn't getVoice before)
  useEffect(() => {
    if (watchAction === "getVoice" && open) {
      const currentVoiceId = form.getValues("voiceId");
      // If voiceId exists but defaultValues.action wasn't getVoice, clear it
      if (currentVoiceId && defaultValues.action !== "getVoice") {
        form.setValue("voiceId", "");
      }
    }
  }, [watchAction, open, form, defaultValues.action]);
  const watchVariables = form.watch("variables") || "elevenlabs";
  const watchVoiceSelection = form.watch("voiceSelection");
  const isCustomVoice = watchVoiceSelection === "custom";

  // Fetch voices when action is textToSpeech
  const { data: voicesData, isLoading: isLoadingVoices } = useQuery({
    queryKey: ["elevenlabs-voices"],
    queryFn: async () => {
      if (watchAction !== "textToSpeech") {
        return null;
      }
      try {
        return await authenticatedGet<{
          voices: Array<{ voiceId: string; name: string; category: string; description: string }>;
          count: number;
        }>(`/api/elevenlabs/voices`);
      } catch (error) {
        console.error("Failed to fetch voices:", error);
        return null;
      }
    },
    enabled: watchAction === "textToSpeech" && open,
    retry: 1,
  });

  // Update voiceId when voiceSelection changes
  useEffect(() => {
    if (watchVoiceSelection && watchVoiceSelection !== "custom") {
      form.setValue("voiceId", watchVoiceSelection);
    }
  }, [watchVoiceSelection, form]);

  const handleSubmit = async (values: ElevenLabsFormValues) => {
    try {
      // If voiceSelection is set and not "custom", use it as voiceId (only for textToSpeech)
      if (
        values.action === "textToSpeech" &&
        values.voiceSelection &&
        values.voiceSelection !== "custom"
      ) {
        values.voiceId = values.voiceSelection;
      }
      // Remove voiceSelection from the submitted data as backend doesn't need it
      const { voiceSelection, ...submitValues } = values;

      // For getVoice action, ensure voiceId is explicitly included
      if (values.action === "getVoice") {
        submitValues.voiceId = values.voiceId || "";
      }

      await Promise.resolve(onSubmit(submitValues));
      onOpenChange(false);
      toast.success("ElevenLabs node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configure ElevenLabs Node</DialogTitle>
          <DialogDescription>
            Generate speech, transcribe audio, or clone voices using ElevenLabs AI.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input placeholder="elevenlabs" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.audio}}"}`}</code> or{" "}
                      <code>{`{"{{${watchVariables}.text}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
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
                        <SelectItem value="textToSpeech">Text to Speech</SelectItem>
                        <SelectItem value="speechToText">Speech to Text</SelectItem>
                        <SelectItem value="cloneVoice">Clone Voice</SelectItem>
                        <SelectItem value="listVoices">List Voices</SelectItem>
                        <SelectItem value="getVoice">Get Voice Details</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the action to perform.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Text to Speech Fields */}
              {watchAction === "textToSpeech" && (
                <>
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Hello! This text will be converted to speech."
                            className="min-h-[100px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The text to convert to speech. Supports Handlebars templating:
                          <br />
                          <code className="bg-background px-1 py-0.5 rounded text-xs">
                            {"{{airtable.fields.Summary}}"}
                          </code>{" "}
                          - Access previous node output
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceSelection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value === "loading") return; // Prevent selecting loading state
                            field.onChange(value);
                            if (value !== "custom") {
                              form.setValue("voiceId", value);
                            } else {
                              form.setValue("voiceId", "");
                            }
                          }}
                          value={field.value || "custom"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              {isLoadingVoices ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Loading voices...</span>
                                </div>
                              ) : (
                                <SelectValue placeholder="Select a voice" />
                              )}
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent
                            className="max-h-[300px] overflow-y-auto"
                            side="bottom"
                            align="start"
                            position="popper"
                          >
                            {isLoadingVoices ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">
                                  Loading voices...
                                </span>
                              </div>
                            ) : voicesData?.voices && voicesData.voices.length > 0 ? (
                              <>
                                {voicesData.voices.map((voice) => (
                                  <SelectItem key={voice.voiceId} value={voice.voiceId}>
                                    {voice.name} {voice.category && `(${voice.category})`}
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom">Custom Voice ID</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="custom">Custom Voice ID</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select a voice from your ElevenLabs account or choose "Custom" to enter a
                          voice ID manually.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isCustomVoice && (
                    <FormField
                      control={form.control}
                      name="voiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="pNInz6obpgDQGcFmaJgB or {{workflow.ceoVoiceId}}"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter a voice ID. Can be a pre-built voice ID or a cloned voice ID from
                            a previous node. Supports templating.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="eleven_multilingual_v2">
                              Eleven Multilingual v2 (29 languages, 10K chars)
                            </SelectItem>
                            <SelectItem value="eleven_turbo_v2_5">
                              Eleven Turbo v2.5 (32 languages, 40K chars, fast)
                            </SelectItem>
                            <SelectItem value="eleven_flash_v2_5">
                              Eleven Flash v2.5 (32 languages, 40K chars, ultra-fast)
                            </SelectItem>
                            <SelectItem value="eleven_v3">
                              Eleven v3 (70+ languages, 5K chars, most expressive)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Select the speech synthesis model to use.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="stability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stability (0-1)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" max="1" {...field} />
                          </FormControl>
                          <FormDescription>Voice stability setting.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="similarityBoost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Similarity Boost (0-1)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" max="1" {...field} />
                          </FormControl>
                          <FormDescription>How similar to the original voice.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="en" {...field} />
                        </FormControl>
                        <FormDescription>
                          Language code (e.g., "en", "es", "fr"). Auto-detected if not specified.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Speech to Text Fields */}
              {watchAction === "speechToText" && (
                <>
                  <FormField
                    control={form.control}
                    name="audioUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audio URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/audio.mp3 or {{telegram.audioUrl}}"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Direct URL to an audio file to transcribe (e.g., .mp3, .wav, .m4a, .ogg).
                          <br />
                          <strong>Note:</strong> YouTube or video platform URLs are not supported.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="en" {...field} />
                        </FormControl>
                        <FormDescription>
                          Language code for transcription. Auto-detected if not specified (90+
                          languages supported).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="speakerDiarization"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Speaker Diarization</FormLabel>
                          <FormDescription>
                            Identify different speakers in the audio (up to 48 speakers).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entityDetection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Entity Detection</FormLabel>
                          <FormDescription>
                            Detect and extract entities from the transcription (up to 56 entities).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Clone Voice Fields */}
              {watchAction === "cloneVoice" && (
                <>
                  <FormField
                    control={form.control}
                    name="audioUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audio Sample URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/voice-sample.mp3" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL of the audio file containing the voice to clone. Should be 2-5 minutes
                          of clear speech.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice Name</FormLabel>
                        <FormControl>
                          <Input placeholder="CEO Voice" {...field} />
                        </FormControl>
                        <FormDescription>
                          Name for the cloned voice. This will be used to identify it later.
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Voice cloned from CEO's speech sample"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description for the cloned voice.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Get Voice Fields */}
              {watchAction === "getVoice" && (
                <FormField
                  control={form.control}
                  name="voiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice ID</FormLabel>
                      <FormControl>
                        <Input placeholder="pNInz6obpgDQGcFmaJgB" {...field} />
                      </FormControl>
                      <FormDescription>
                        Voice ID to get details for. Can be a pre-built or cloned voice ID.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
