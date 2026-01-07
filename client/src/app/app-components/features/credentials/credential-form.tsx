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
import { useEffect, useState } from "react";
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

// Custom type validation pattern (matches backend: uppercase, alphanumeric + underscore, 3-50 chars)
const customTypePattern = /^[A-Z][A-Z0-9_]{2,49}$/;

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z
      .string()
      .min(1, "Type is required")
      .refine(
        (val) => {
          // Allow known credential types
          if (Object.values(CredentialType).includes(val as CredentialType)) {
            return true;
          }
          // Allow custom types matching the pattern
          return customTypePattern.test(val);
        },
        {
          message:
            "Type must be a known type or a custom type (uppercase, alphanumeric + underscore, 3-50 chars, e.g., APIFY)",
        }
      ),
    value: z.string().optional(),
    // Google OAuth specific fields
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // If Google OAuth, require clientId and clientSecret
    if (data.type === CredentialType.GOOGLE_OAUTH) {
      if (!data.clientId || data.clientId.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client ID is required for Google OAuth",
          path: ["clientId"],
        });
      }
      if (!data.clientSecret || data.clientSecret.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client Secret is required for Google OAuth",
          path: ["clientSecret"],
        });
      }
    } else {
      // For other types, require value
      if (!data.value || data.value.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API Key is required",
          path: ["value"],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export const credentialTypeOptions = [
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
    label: "Google OAuth",
    value: CredentialType.GOOGLE_OAUTH,
    logo: "/logo/google.svg",
  },
];

const CUSTOM_TYPE_VALUE = "__CUSTOM__";

export function CredentialForm({ initialData }: CredentialFormProps) {
  const router = useRouter();
  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();

  const isEdit = !!initialData?.id;

  // Check if initial type is a custom type (not in known types)
  const initialType = initialData?.type || CredentialType.GEMINI;
  const isCustomType =
    initialType && !Object.values(CredentialType).includes(initialType as CredentialType);

  const [isCustomTypeSelected, setIsCustomTypeSelected] = useState(isCustomType);
  const [customTypeValue, setCustomTypeValue] = useState(isCustomType ? initialType : "");

  // Parse Google OAuth credential value if editing
  const parseGoogleOAuthValue = (value: string | undefined) => {
    if (!value) return { clientId: "", clientSecret: "" };
    try {
      const parsed = JSON.parse(value);
      return {
        clientId: parsed.clientId || "",
        clientSecret: parsed.clientSecret || "",
      };
    } catch {
      return { clientId: "", clientSecret: "" };
    }
  };

  const googleOAuthFields =
    initialData?.type === CredentialType.GOOGLE_OAUTH
      ? parseGoogleOAuthValue(initialData?.value)
      : { clientId: "", clientSecret: "" };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      // Use custom value if it's a custom type, otherwise use the known type
      type: isCustomType ? customTypeValue : (initialType as CredentialType),
      value: initialData?.type === CredentialType.GOOGLE_OAUTH ? "" : initialData?.value || "",
      clientId: googleOAuthFields.clientId,
      clientSecret: googleOAuthFields.clientSecret,
    },
  });

  // Update form when initialData loads or changes
  useEffect(() => {
    if (initialData && isEdit) {
      const type = initialData.type || CredentialType.GEMINI;
      const isCustom = !Object.values(CredentialType).includes(type as CredentialType);

      setIsCustomTypeSelected(isCustom);
      setCustomTypeValue(isCustom ? type : "");

      const googleOAuthFields =
        type === CredentialType.GOOGLE_OAUTH
          ? parseGoogleOAuthValue(initialData.value)
          : { clientId: "", clientSecret: "" };

      form.reset({
        name: initialData.name || "",
        type: type,
        value: type === CredentialType.GOOGLE_OAUTH ? "" : initialData.value || "",
        clientId: googleOAuthFields.clientId,
        clientSecret: googleOAuthFields.clientSecret,
      });
    }
  }, [initialData, isEdit, form]);

  // Handle type selection change
  const handleTypeChange = (value: string) => {
    if (value === CUSTOM_TYPE_VALUE) {
      setIsCustomTypeSelected(true);
      setCustomTypeValue("");
      form.setValue("type", "");
    } else {
      setIsCustomTypeSelected(false);
      setCustomTypeValue("");
      form.setValue("type", value);
    }
  };

  // Handle custom type input change
  const handleCustomTypeChange = (value: string) => {
    // Convert to uppercase and remove invalid characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    setCustomTypeValue(sanitized);
    form.setValue("type", sanitized);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      // For Google OAuth, combine clientId and clientSecret into JSON
      let credentialValue = data.value || "";
      if (data.type === CredentialType.GOOGLE_OAUTH) {
        if (!data.clientId || !data.clientSecret) {
          toast.error("Client ID and Client Secret are required for Google OAuth");
          return;
        }
        credentialValue = JSON.stringify({
          clientId: data.clientId,
          clientSecret: data.clientSecret,
        });
      }

      if (isEdit && initialData?.id) {
        await updateCredential.mutateAsync({
          id: initialData.id,
          data: {
            name: data.name,
            value: credentialValue,
            type: data.type as CredentialType,
          },
        });
      } else {
        await createCredential.mutateAsync({
          name: data.name,
          type: data.type as CredentialType,
          value: credentialValue,
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
                  {!isCustomTypeSelected ? (
                    <Select
                      onValueChange={(value) => {
                        handleTypeChange(value);
                        field.onChange(value);
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a credential type" />
                      </SelectTrigger>
                      <SelectContent>
                        {credentialTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Image src={option.logo} alt={option.label} width={20} height={20} />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_TYPE_VALUE}>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Custom Type</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        {...field}
                        value={customTypeValue}
                        onChange={(e) => {
                          handleCustomTypeChange(e.target.value);
                        }}
                        placeholder="APIFY, STRIPE_API, etc."
                        className="uppercase"
                        maxLength={50}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary"
                        onClick={() => {
                          setIsCustomTypeSelected(false);
                          setCustomTypeValue("");
                          form.setValue("type", CredentialType.GEMINI);
                        }}
                      >
                        Use predefined type
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                  {isCustomTypeSelected && (
                    <p className="text-xs text-muted-foreground">
                      Enter a custom type (uppercase, alphanumeric + underscore, 3-50 chars)
                    </p>
                  )}
                </FormItem>
              )}
            />
            {form.watch("type") === CredentialType.GOOGLE_OAUTH ? (
              <>
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="xxxxx.apps.googleusercontent.com" />
                      </FormControl>
                      <FormDescription>
                        Your Google OAuth 2.0 Client ID from Google Cloud Console
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="GOCSPX-..." />
                      </FormControl>
                      <FormDescription>
                        Your Google OAuth 2.0 Client Secret from Google Cloud Console
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
                  <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
                    How to Get Google OAuth Credentials
                  </h4>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>
                        Go to{" "}
                        <a
                          href="https://console.cloud.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Google Cloud Console
                        </a>
                      </li>
                      <li>Create a project or select an existing one</li>
                      <li>Enable the APIs you need (Drive, Calendar, Sheets, Docs, Meet)</li>
                      <li>Go to "APIs & Services" → "Credentials"</li>
                      <li>Click "Create Credentials" → "OAuth client ID"</li>
                      <li>Choose "Web application"</li>
                      <li>
                        <strong>Add authorized redirect URI:</strong>
                        <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
                          <code className="text-xs break-all">
                            {process.env.NEXT_PUBLIC_API_URL
                              ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback`
                              : typeof window !== "undefined"
                                ? `${window.location.origin}/api/auth/google/callback`
                                : "https://api.verxio.xyz/api/auth/google/callback"}
                          </code>
                          <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                            <strong>For local development:</strong>{" "}
                            http://localhost:8080/api/auth/google/callback
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-6 px-2 text-xs"
                            onClick={async () => {
                              const redirectUri =
                                typeof window !== "undefined"
                                  ? `${window.location.origin}/api/auth/google/callback`
                                  : process.env.NEXT_PUBLIC_API_URL
                                    ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback`
                                    : "https://api.verxio.xyz/api/auth/google/callback";
                              await navigator.clipboard.writeText(redirectUri);
                              toast.success("Redirect URI copied to clipboard!");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </li>
                      <li>Copy the Client ID and Client Secret</li>
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="AI-..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
