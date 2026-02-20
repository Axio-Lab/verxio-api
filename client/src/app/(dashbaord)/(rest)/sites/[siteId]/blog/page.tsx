"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authenticatedGet, authenticatedDelete } from "@/lib/api-client";

interface BlogPost {
  documentId?: string;
  id: number;
  title: string;
  slug: string;
  status: string;
  author?: string;
  category?: string;
  createdAt: string;
}

export default function BlogManagementPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await authenticatedGet<{ posts: BlogPost[] }>(`/blog/posts?websiteId=${siteId}`);
      setPosts(data.posts || []);
    } catch {
      toast.error("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (siteId) fetchPosts();
  }, [siteId]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this blog post?")) return;
    try {
      await authenticatedDelete(`/blog/posts/${postId}`);
      toast.success("Post deleted");
      fetchPosts();
    } catch {
      toast.error("Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/sites/${siteId}`)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Site
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-foreground">Blog Posts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage blog posts for this website. Create new posts via the agent chat.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No blog posts yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ask your agent: &ldquo;Write a blog post about...&rdquo;
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border bg-card">
          {posts.map((post) => {
            const docId = post.documentId || String(post.id);
            return (
              <div key={docId} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{post.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">/{post.slug}</span>
                    {post.category && (
                      <span className="text-xs text-muted-foreground">{post.category}</span>
                    )}
                    <span
                      className={`text-xs ${post.status === "published" ? "text-green-600" : "text-amber-600"}`}
                    >
                      {post.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(docId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
