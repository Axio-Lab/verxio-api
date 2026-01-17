"use client";

import {
  CredentialType,
  useCreateCredential,
  useCredential,
  useUpdateCredential,
} from "@/hooks/useCredentials";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { z } from "zod";
interface CredentialFormProps {
  initialData?: {
    id?: string;
    name?: string;
    type?: string;
    value?: string;
  };
}

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z
      .string()
      .min(1, "Type is required")
      .refine(
        (val) => {
          // Only allow known credential types
          return Object.values(CredentialType).includes(val as CredentialType);
        },
        {
          message: "Type must be a known credential type",
        }
      ),
    value: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Require value for all credential types
    if (!data.value || data.value.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API Key is required",
        path: ["value"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export const credentialTypeOptions: Array<{
  label: string;
  value: CredentialType;
  logo?: string;
}> = [
  {
    label: "OpenAI",
    value: CredentialType.OPENAI,
    logo: "/logo/openai.svg",
  },
  {
    label: "Anthropic",
    value: CredentialType.ANTHROPIC,
    logo: "/logo/anthropic.svg",
  },
  {
    label: "Gemini",
    value: CredentialType.GEMINI,
    logo: "/logo/gemini.svg",
  },
  {
    label: "Telegram",
    value: CredentialType.TELEGRAM,
    logo: "/logo/telegram.svg",
  },
  {
    label: "Airtable",
    value: CredentialType.AIRTABLE,
    logo: "/logo/airtable.svg",
  },
  {
    label: "Custom",
    value: CredentialType.CUSTOM,
  },
  // Note: Google OAuth removed - Google OAuth credentials are now managed via env variables
];

export function CredentialForm({ initialData }: CredentialFormProps) {
  const router = useRouter();
  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();

  const isEdit = !!initialData?.id;

  // Use initial type or default to GEMINI
  const initialType = (initialData?.type as CredentialType) || CredentialType.GEMINI;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      type: initialType,
      value: initialData?.value || "",
    },
  });

  // Update form when initialData loads or changes
  useEffect(() => {
    if (initialData && isEdit) {
      const type = (initialData.type as CredentialType) || CredentialType.GEMINI;

      form.reset({
        name: initialData.name || "",
        type: type,
        value: initialData.value || "",
      });
    }
  }, [initialData, isEdit, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEdit && initialData?.id) {
        await updateCredential.mutateAsync({
          id: initialData.id,
          data: {
            name: data.name,
            value: data.value || "",
            type: data.type as CredentialType,
          },
        });
      } else {
        await createCredential.mutateAsync({
          name: data.name,
          type: data.type as CredentialType,
          value: data.value || "",
        });
      }

      // Wait a bit for the success toast to show, then navigate
      setTimeout(() => {
        router.push("/credentials");
      }, 500);
    } catch (error) {
      console.error("Error submitting credential form:", error);
      // Error is handled by the mutation's onError callback
    }
  };

  const isLoading = createCredential.isPending || updateCredential.isPending;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Credential" : "Create Credential"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update your API key or credential details"
            : "Add a new API key or credential to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              toast.error("Please fix the form errors before submitting");
            })}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter your API key name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a credential type" />
                    </SelectTrigger>
                    <SelectContent>
                      {credentialTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {option.logo && (
                              <Image src={option.logo} alt={option.label} width={20} height={20} />
                            )}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch("type") === CredentialType.AIRTABLE
                      ? "Personal Access Token"
                      : form.watch("type") === CredentialType.CUSTOM
                        ? "Credential Value"
                        : "API Key"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      placeholder={
                        form.watch("type") === CredentialType.AIRTABLE
                          ? "patXXXXXXXXXXXXXX"
                          : form.watch("type") === CredentialType.CUSTOM
                            ? "Enter your API key or credential value"
                            : "AI-..."
                      }
                    />
                  </FormControl>
                  {form.watch("type") === CredentialType.AIRTABLE && (
                    <FormDescription>
                      Enter your Airtable Personal Access Token (starts with "pat"). Get it from{" "}
                      <a
                        href="https://airtable.com/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Airtable API documentation
                      </a>
                      .
                    </FormDescription>
                  )}
                  {form.watch("type") === CredentialType.CUSTOM && (
                    <FormDescription>
                      Use custom credentials for API keys in CODE_BLOCK nodes. The credential name
                      will be used to access the value in your code.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" asChild disabled={isLoading}>
                <Link href="/credentials" prefetch>
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export const CredentialDetail = ({ credentialId }: { credentialId: string }) => {
  const { data: credential, isLoading } = useCredential(credentialId);

  // Show loading only if we don't have cached data
  if (isLoading && !credential) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Use cached data immediately if available, form will update when fresh data arrives
  return <CredentialForm initialData={credential} />;
};
