"use client";

import { Skill, useCreateSkill, useSkill, useUpdateSkill } from "@/hooks/useSkills";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2Icon, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authenticatedPost } from "@/lib/api-client";

interface SkillFormProps {
  initialData?: {
    id?: string;
    name?: string;
    description?: string;
    url?: string;
    content?: string;
  };
}

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().max(50, "Description must be 50 characters or less").optional(),
    url: z.string().url("Invalid URL").optional().or(z.literal("")),
    content: z.string().min(1, "Content is required"),
  })
  .refine(
    (data) => {
      // Either URL or content must be provided
      return data.url || data.content;
    },
    {
      message: "Either URL or content must be provided",
      path: ["url"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

export function SkillForm({ initialData }: SkillFormProps) {
  const router = useRouter();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill(initialData?.id || "");

  const isEdit = !!initialData?.id;
  const [inputMethod, setInputMethod] = useState<"url" | "manual" | "upload">(
    initialData?.url ? "url" : "manual"
  );
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      url: initialData?.url || "",
      content: initialData?.content || "",
    },
  });

  // Update form when initialData loads or changes
  useEffect(() => {
    if (initialData && isEdit) {
      form.reset({
        name: initialData.name || "",
        description: initialData.description || "",
        url: initialData.url || "",
        content: initialData.content || "",
      });
      setInputMethod(initialData.url ? "url" : "manual");
    }
  }, [initialData, isEdit, form]);

  const handleFetchFromUrl = async () => {
    const url = form.getValues("url");
    if (!url || !url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsFetching(true);
    try {
      // Use backend proxy to avoid CORS when fetching from external domains
      const { content } = await authenticatedPost<{ content: string }>("/skill/fetch-from-url", {
        url: url.trim(),
      });

      if (!content || content.trim().length === 0) {
        toast.error("Fetched content is empty");
        return;
      }

      const { parsedName, parsedDescription } = parseMetadataFromContent(content);

      if (parsedName && !form.getValues("name")) {
        form.setValue("name", parsedName);
      }
      if (parsedDescription && !form.getValues("description")) {
        // Truncate description to 50 characters
        const truncatedDescription = parsedDescription.slice(0, 50);
        form.setValue("description", truncatedDescription);
      }

      form.setValue("content", content);
      setPreviewContent(content);
      toast.success("Content fetched successfully");
    } catch (error: any) {
      console.error("Fetch error:", error);
      const message = error?.message || "Unknown error";
      if (message.includes("timed out") || message.includes("Timeout")) {
        toast.error("Request timed out. Please check the URL and try again.");
      } else {
        toast.error(message.includes("Failed to fetch") ? message : `Failed to fetch: ${message}`);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const parseMetadataFromContent = (content: string) => {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    let parsedName = "";
    let parsedDescription = "";

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (nameMatch) parsedName = nameMatch[1].trim();
      if (descMatch) parsedDescription = descMatch[1].trim();
    }
    if (!parsedName && headingMatch) parsedName = headingMatch[1].trim();
    return { parsedName, parsedDescription };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isMd = file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown");
    if (!isMd) {
      toast.error("Please upload a .md or .markdown file");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "").trim();
      if (!content) {
        toast.error("File is empty");
        setIsUploading(false);
        return;
      }

      const { parsedName, parsedDescription } = parseMetadataFromContent(content);
      if (parsedName && !form.getValues("name")) {
        form.setValue("name", parsedName);
      }
      if (parsedDescription && !form.getValues("description")) {
        form.setValue("description", parsedDescription.slice(0, 50));
      }

      form.setValue("content", content);
      setPreviewContent(content);
      setInputMethod("manual");
      toast.success(`Loaded "${file.name}". Switch to Manual to edit, or Create to add the skill.`);
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const submitData: any = {
        name: data.name,
        description: data.description || undefined,
        content: data.content,
      };

      if (inputMethod === "url" && data.url) {
        submitData.url = data.url;
      }

      if (isEdit && initialData?.id) {
        await updateSkill.mutateAsync(submitData);
      } else {
        await createSkill.mutateAsync(submitData);
      }

      // Wait a bit for the success toast to show, then navigate
      setTimeout(() => {
        router.push("/skills");
      }, 500);
    } catch (error) {
      console.error("Error submitting skill form:", error);
      // Error is handled by the mutation's onError callback
    }
  };

  const isLoading = createSkill.isPending || updateSkill.isPending;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Skill" : "Create Skill"}</CardTitle>
        <CardDescription>
          {isEdit ? "Update your skill details" : "Add a new skill file to extend AI capabilities"}
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
                    <Input {...field} placeholder="e.g. Solana Development" />
                  </FormControl>
                  <FormDescription>
                    Skill name (auto-filled from URL or content if not provided)
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
                  <FormLabel>Description (Optional, max 50 characters)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description of the skill"
                      maxLength={50}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 50);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>{field.value?.length || 0}/50 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <Tabs
                value={inputMethod}
                onValueChange={(v) => setInputMethod(v as "url" | "manual" | "upload")}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="url">Fetch from URL</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="manual">Manual Input</TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              {...field}
                              placeholder="https://example.com/skill.md"
                              type="url"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleFetchFromUrl}
                              disabled={isFetching || !field.value}
                            >
                              {isFetching ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                "Fetch"
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Enter a URL to a markdown skill file (e.g., https://solana.com/SKILL.md)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value="upload" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="skill-file-upload">Skill file (.md)</Label>
                    <input
                      id="skill-file-upload"
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file && (file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown"))) {
                          const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                          handleFileUpload(fakeEvent);
                        } else if (file) {
                          toast.error("Please upload a .md or .markdown file");
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-10 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {isUploading ? (
                        <Loader2Icon className="h-10 w-10 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-10 w-10 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium">
                        {isUploading ? "Loading..." : "Click or drag to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        .md or .markdown files only. Name and description are auto-filled from the file.
                      </p>
                    </div>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Upload a SKILL.md file. Content, name, and description will be extracted automatically.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="manual" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Paste or type skill content here..."
                            className="min-h-[300px] font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Paste the markdown content of your skill file
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            )}

            {isEdit && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Skill content..."
                        className="min-h-[300px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {previewContent && (
              <div className="rounded-md border p-4 bg-muted/50">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <pre className="text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                  {previewContent.slice(0, 500)}
                  {previewContent.length > 500 && "..."}
                </pre>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" asChild disabled={isLoading}>
                <Link href="/skills" prefetch>
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

export const SkillDetail = ({ skillId }: { skillId: string }) => {
  const { data: skill, isLoading } = useSkill(skillId);

  // Show loading only if we don't have cached data
  if (isLoading && !skill) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Use cached data immediately if available, form will update when fresh data arrives
  return <SkillForm initialData={skill} />;
};
