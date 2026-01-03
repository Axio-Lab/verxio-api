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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

const formSchema = z.object({
    variables: z.string().min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores" }),
    endpoint: z.string()
        .min(1, { message: "Endpoint URL is required" })
        .refine((val) => {
            // Allow Handlebars templates - check if it contains {{ or }}
            if (val.includes("{{") || val.includes("}}")) {
                // If the entire value is a template (starts with {{), allow it
                if (val.trim().startsWith("{{")) {
                    return true;
                }
                // If it has templates, validate the base URL part (before first {)
                const baseUrl = val.split("{{")[0].trim();
                if (!baseUrl) return false; // Must have at least some base URL
                try {
                    new URL(baseUrl);
                    return true;
                } catch {
                    // If base URL is not complete, check if it starts with http:// or https://
                    return baseUrl.startsWith("http://") || baseUrl.startsWith("https://");
                }
            }
            // If no templates, validate as normal URL
            try {
                new URL(val);
                return true;
            } catch {
                return false;
            }
        }, { message: "Please enter a valid URL (templates like {{variable}} are allowed)" }),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]),
    body: z.string().optional()
    // .refine(),
});

export type HttpRequestFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    defaultValues?: Partial<HttpRequestFormValues>;
}

export const HttpRequestDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variables: defaultValues.variables || "",
            endpoint: defaultValues.endpoint || "",
            method: defaultValues.method || "GET",
            body: defaultValues.body || "",
        },

    })
    useEffect(() => {
        if (open) {
            form.reset({
                variables: defaultValues.variables || "",
                endpoint: defaultValues.endpoint || "",
                method: defaultValues.method || "GET",
                body: defaultValues.body || "",
            });
        }
    }, [open, defaultValues, form]);

    const watchMethod = form.watch("method");
    const watchVariables = form.watch("variables") || "myApiCall";
    const showBodyField = ["POST", "PUT", "PATCH"].includes(watchMethod);

    const handleSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await Promise.resolve(onSubmit(values));
            onOpenChange(false);
            toast.success("HTTP request configured");
            form.reset();
        } catch (error) {
            // Error handling is done in the parent component
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>HTTP Request</DialogTitle>
                    <DialogDescription>
                        Configure settings for the HTTP request node.
                    </DialogDescription>
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
                                        <Input
                                            {...field}
                                            placeholder="myApiCall"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Use this name to reference the result in other nodes: {" "}
                                       { `{"{{${watchVariables}.httpResponse.data}}"}`}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="method"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Method</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a method" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="GET">GET</SelectItem>
                                            <SelectItem value="POST">POST</SelectItem>
                                            <SelectItem value="PUT">PUT</SelectItem>
                                            <SelectItem value="PATCH">PATCH</SelectItem>
                                            <SelectItem value="DELETE">DELETE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        The HTTP method to use for the request.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="endpoint"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Endpoint URL</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="https://api.example.com/users/{{httpResponse.data.id}}"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Static URL or use{"{{variables}}"} for simple values or
                                        {"{{json variables}}"} to stringify objects.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {showBodyField && (
                            <FormField
                                control={form.control}
                                name="body"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Request Body</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder={`{\n  "userId": "{{httpResponse.data.id}}",\n  "name": "{{httpResponse.data.name}}",\n  "items": ["{{httpResponse.data.items}}"]\n}`}
                                                className="min-h-[120px] font-mono text-sm"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            JSON with template variables. Use {"{{variables}}"} for simple values or
                                            {"{{json variables}}"} to stringify objects.
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