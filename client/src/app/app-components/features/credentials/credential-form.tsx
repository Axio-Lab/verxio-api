"use client";

import { CredentialType, useCreateCredential, useCredential, useUpdateCredential } from "@/hooks/useCredentials";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardDescription, 
    CardContent 
} from "@/components/ui/card";
import {
    Form,
    FormControl,
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
    SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";

import { z } from "zod";
interface CredentialFormProps {
    initialData?: {
        id?: string;
        name?: string;
        type?: string;
        value?: string;
    }
}

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(Object.values(CredentialType) as [string, ...string[]]),
    value: z.string().min(1, "API Key is required"),
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
];

export function CredentialForm({ initialData }: CredentialFormProps) {
    const router = useRouter();
    const createCredential = useCreateCredential();
    const updateCredential = useUpdateCredential();

    const isEdit = !!initialData?.id;
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialData?.name || "",
            // Only default to GEMINI if creating new credential (not editing)
            type: isEdit && initialData?.type 
                ? (initialData.type as CredentialType) 
                : CredentialType.GEMINI,
            value: initialData?.value || "",
        },
    });

    // Update form when initialData loads or changes
    useEffect(() => {
        if (initialData && isEdit) {
            form.reset({
                name: initialData.name || "",
                type: (initialData.type as CredentialType) || CredentialType.GEMINI,
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
                        value: data.value,
                        type: data.type as CredentialType,
                    },
                });
            } else {
                await createCredential.mutateAsync({
                    name: data.name,
                    type: data.type as CredentialType,
                    value: data.value,
                });
            }
            router.push("/credentials");
        } catch (error) {
            // Error is handled by the mutation's onError callback
        }
    }

    const isLoading = createCredential.isPending || updateCredential.isPending;

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>
                    {isEdit ? "Edit Credential" : "Create Credential"}
                </CardTitle>
                <CardDescription>
                    {isEdit 
                    ? "Update your API key or credential details" 
                    : "Add a new API key or credential to your account"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input 
                                        {...field} 
                                        placeholder="Enter your API key name" />
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
                                    <Select
                                        onValueChange={field.onChange}
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
                                    <FormLabel>API Key</FormLabel>
                                    <FormControl>
                                        <Input 
                                        type="password"
                                        {...field} 
                                        placeholder="AI-..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-4">
                        <Button type="submit"  disabled={isLoading}>
                            {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                            {isEdit ? "Update" : "Create"}
                        </Button>
                        <Button 
                        type="button" variant="outline" asChild disabled={isLoading} 
                        >
                            <Link href="/credentials" prefetch>
                            Cancel
                            </Link></Button>
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
    return <CredentialForm initialData={credential} />
}