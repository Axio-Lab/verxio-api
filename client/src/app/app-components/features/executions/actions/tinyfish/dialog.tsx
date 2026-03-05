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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCredentials, CredentialType } from "@/hooks/useCredentials";
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
      message: "Must start with a letter/underscore, alphanumeric only",
    }),
  url: z.string().url({ message: "Must be a valid URL" }),
  goal: z.string().min(1, { message: "Goal description is required" }),
  browserProfile: z.enum(["lite", "stealth"]).optional(),
  proxyCountry: z.string().optional(),
  label: z.string().optional(),
  credentialId: z.string().min(1, { message: "TinyFish credential is required" }),
});

export type TinyfishFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TinyfishFormValues) => void;
  defaultValues?: Partial<TinyfishFormValues>;
}

const PROXY_COUNTRIES = [
  { value: "", label: "None (no proxy)" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "AU", label: "Australia" },
];

export const TinyfishDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const { data: credentialsData } = useCredentials(1, 100, CredentialType.TINYFISH);
  const credentials = credentialsData?.credentials || [];

  const form = useForm<TinyfishFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "tinyfish",
      url: defaultValues.url || "",
      goal: defaultValues.goal || "",
      browserProfile: defaultValues.browserProfile || "lite",
      proxyCountry: defaultValues.proxyCountry || "",
      label: defaultValues.label || "TinyFish",
      credentialId: (defaultValues as any)?.credentialId || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "tinyfish",
        url: defaultValues.url || "",
        goal: defaultValues.goal || "",
        browserProfile: defaultValues.browserProfile || "lite",
        proxyCountry: defaultValues.proxyCountry || "",
        label: defaultValues.label || "TinyFish",
        credentialId: (defaultValues as any)?.credentialId || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "tinyfish";

  const handleSubmit = async (values: TinyfishFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("TinyFish node configured");
      form.reset();
    } catch {
      // handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>TinyFish Web Automation</DialogTitle>
          <DialogDescription>
            Configure AI-powered web automation. Describe what you want to accomplish on the target
            website using natural language.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TinyFish Credential</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={credentials.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              credentials.length === 0
                                ? "No TinyFish credentials found"
                                : "Select a TinyFish credential"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {credentials.map((cred) => (
                          <SelectItem key={cred.id} value={cred.id}>
                            {cred.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      TinyFish uses this API key for web automation. Create it in Credentials under
                      type &quot;TinyFish&quot;.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output Variable</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="tinyfish" />
                    </FormControl>
                    <FormDescription>
                      Reference results in other nodes:
                      <br />
                      <code>{`{{${watchVariables}.result}}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://example.com" />
                    </FormControl>
                    <FormDescription>
                      The website to automate. Supports {"{{variables}}"} from previous nodes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Extract all product names and prices. Return as JSON with fields: name, price, in_stock."
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific: include output format, stopping conditions, and edge cases.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="browserProfile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Browser Profile</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "lite"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select profile" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lite">Lite (standard browser)</SelectItem>
                        <SelectItem value="stealth">Stealth (anti-detection)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Use Stealth for sites with bot protection (Cloudflare, DataDome, etc.).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="proxyCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proxy Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No proxy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROXY_COUNTRIES.map((c) => (
                          <SelectItem key={c.value || "none"} value={c.value || "none"}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Route through a geographic proxy for location-specific content.
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
