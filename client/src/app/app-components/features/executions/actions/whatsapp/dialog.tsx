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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  phoneNumber: z.string().min(1, { message: "Phone number is required" }),
  message: z.string().min(1, { message: "Message is required" }),
});

export type WhatsAppFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WhatsAppFormValues) => void;
  defaultValues?: Partial<WhatsAppFormValues>;
}

export const WhatsAppDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<WhatsAppFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "whatsapp",
      phoneNumber: defaultValues.phoneNumber || "",
      message: defaultValues.message || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "whatsapp",
        phoneNumber: defaultValues.phoneNumber || "",
        message: defaultValues.message || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "whatsapp";

  const handleSubmit = async (values: WhatsAppFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("WhatsApp node configured");
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>WhatsApp</DialogTitle>
          <DialogDescription>Configure the WhatsApp message to send.</DialogDescription>
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
                      <Input {...field} placeholder="whatsapp" />
                    </FormControl>
                    <FormDescription>
                      Use this name to reference the result in other nodes:
                      <br />
                      <code>{`{"{{${watchVariables}.response}}"}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1234567890" />
                    </FormControl>
                    <FormDescription>
                      Recipient's phone number. Use {"{{variables}}"} for dynamic values.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Hello! This is a WhatsApp message."
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      The message to send. Use {"{{variables}}"} for simple values or
                      {`{"{{{jsonVariables}.response}}"}`} to stringify objects.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
