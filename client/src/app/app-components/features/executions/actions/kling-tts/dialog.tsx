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
import { useEffect } from "react";

const formSchema = z.object({
  variables: z
    .string()
    .min(1)
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/)
    .optional(),
  text: z.string().min(1, "Text is required").max(1000),
  voice_id: z.string().min(1, "Voice ID is required"),
  voice_language: z.literal("en"),
  voice_speed: z.coerce.number().min(0.8).max(2),
});

export type KlingTtsFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: KlingTtsFormValues) => void;
  defaultValues?: Partial<KlingTtsFormValues>;
}

export const KlingTtsDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<KlingTtsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: defaultValues.text ?? "",
      voice_id: defaultValues.voice_id ?? "",
      voice_language: "en",
      voice_speed: defaultValues.voice_speed ?? 1,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables ?? "klingTts",
        text: defaultValues.text ?? "",
        voice_id: defaultValues.voice_id ?? "",
        voice_language: "en",
        voice_speed: defaultValues.voice_speed ?? 1,
      });
    }
  }, [open, defaultValues, form]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kling TTS</DialogTitle>
          <DialogDescription>
            Convert text to speech. Get voice_id from Kling AI voice list (e.g. preset or custom
            voice ID).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="variables"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output variable name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="klingTts" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Text</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Text to speak..." rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="voice_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="genshin_vindi2">Sunny (genshin_vindi2)</SelectItem>
                      <SelectItem value="zhinen_xuesheng">Sage (zhinen_xuesheng)</SelectItem>
                      <SelectItem value="AOT">Ace (AOT)</SelectItem>
                      <SelectItem value="ai_shatang">Blossom (ai_shatang)</SelectItem>
                      <SelectItem value="genshin_klee2">Peppy (genshin_klee2)</SelectItem>
                      <SelectItem value="genshin_kirara">Dove (genshin_kirara)</SelectItem>
                      <SelectItem value="ai_kaiya">Shine (ai_kaiya)</SelectItem>
                      <SelectItem value="oversea_male1">Anchor (oversea_male1)</SelectItem>
                      <SelectItem value="ai_chenjiahao_712">Lyric (ai_chenjiahao_712)</SelectItem>
                      <SelectItem value="girlfriend_4_speech02">
                        Melody (girlfriend_4_speech02)
                      </SelectItem>
                      <SelectItem value="chat1_female_new-3">
                        Tender (chat1_female_new-3)
                      </SelectItem>
                      <SelectItem value="chat_0407_5-1">Siren (chat_0407_5-1)</SelectItem>
                      <SelectItem value="cartoon-boy-07">Zippy (cartoon-boy-07)</SelectItem>
                      <SelectItem value="uk_boy1">Bud (uk_boy1)</SelectItem>
                      <SelectItem value="cartoon-girl-01">Sprite (cartoon-girl-01)</SelectItem>
                      <SelectItem value="PeppaPig_platform">Candy (PeppaPig_platform)</SelectItem>
                      <SelectItem value="ai_huangzhong_712">Beacon (ai_huangzhong_712)</SelectItem>
                      <SelectItem value="ai_huangyaoshi_712">Rock (ai_huangyaoshi_712)</SelectItem>
                      <SelectItem value="ai_laoguowang_712">Titan (ai_laoguowang_712)</SelectItem>
                      <SelectItem value="chengshu_jiejie">Grace (chengshu_jiejie)</SelectItem>
                      <SelectItem value="you_pingjing">Helen (you_pingjing)</SelectItem>
                      <SelectItem value="calm_story1">Lore (calm_story1)</SelectItem>
                      <SelectItem value="uk_man2">Crag (uk_man2)</SelectItem>
                      <SelectItem value="laopopo_speech02">Prattle (laopopo_speech02)</SelectItem>
                      <SelectItem value="heainainai_speech02">
                        Hearth (heainainai_speech02)
                      </SelectItem>
                      <SelectItem value="reader_en_m-v1">The Reader (reader_en_m-v1)</SelectItem>
                      <SelectItem value="commercial_lady_en_f-v1">
                        Commercial Lady (commercial_lady_en_f-v1)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Preview voices:{" "}
                    <a
                      href="https://docs.qingque.cn/s/home/eZQDvafJ4vXQkP8T9ZPvmye8S?identityId=2E1MlYrrPk4"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="underline"
                    >
                      Kling voice list
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Voice preview file naming: Voice Name#Voice ID#Voice Language
                  </p>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="voice_speed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Speed (0.8–2)</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.1} min={0.8} max={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
