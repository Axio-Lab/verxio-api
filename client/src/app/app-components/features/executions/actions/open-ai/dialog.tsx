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
    SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

// Available OpenAI models
const OPENAI_MODELS = [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16k" },
] as const;

export const OPENAI_MODEL_VALUES = OPENAI_MODELS.map((m) => m.value) as [string, ...string[]];

const formSchema = z.object({
    variables: z.string().min(1, { message: "Variable name is required" })
        .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, { message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores" }),
    model: z.enum(OPENAI_MODEL_VALUES),
    systemPrompt: z.string().optional(),
    userPrompt: z.string().min(1, { message: "User prompt is required" }),
    temperature: z.number().min(0).max(2).optional(),
});

export type OpenAIFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: OpenAIFormValues) => void;
    defaultValues?: Partial<OpenAIFormValues>;
}

export const OpenAIDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<OpenAIFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variables: defaultValues.variables || "openai",
            model: defaultValues.model || "gpt-3.5-turbo",
            userPrompt: defaultValues.userPrompt || "",
            systemPrompt: defaultValues.systemPrompt || "",
            temperature: defaultValues.temperature ?? 0.7,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variables: defaultValues.variables || "openai",
                model: defaultValues.model || "gpt-3.5-turbo",
                userPrompt: defaultValues.userPrompt || "",
                systemPrompt: defaultValues.systemPrompt || "",
            });
        }
    }, [open, defaultValues, form]);

    const watchVariables = form.watch("variables") || "openai";

    const handleSubmit = async (values: OpenAIFormValues) => {
        try {
            await Promise.resolve(onSubmit(values));
            onOpenChange(false);
            toast.success("OpenAI node configured");
            form.reset();
        } catch (error) {
            // Error handling is done in the parent component
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>OpenAI</DialogTitle>
                    <DialogDescription>
                    Configure the AI model and prompts for this node..
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
                                                placeholder="openai"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Use this name to reference the result: {" "}
                                            {`{"{{${watchVariables}.response}}"}`}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="model"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Model</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select a model" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {OPENAI_MODELS.map((model) => (
                                                    <SelectItem key={model.value} value={model.value}>
                                                        {model.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            The OpenAI model to use for text generation.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="systemPrompt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>System Prompt (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder="You are a helpful assistant."
                                                className="min-h-[80px] font-mono text-sm"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Sets the behavior of the assistant. Use {"{{variables}}"} for simple values or 
                                            {`{"{{{jsonVariables}.response}}"}`} to stringify objects.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="userPrompt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User Prompt</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder="Summarize this response: {{json httpResponse.data}}"
                                                className="min-h-[120px] font-mono text-sm"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The prompt to send to the AI. Use {"{{variables}}"} for simple values or 
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
