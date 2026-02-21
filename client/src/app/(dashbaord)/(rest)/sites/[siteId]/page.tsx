"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { authenticatedGet, authenticatedDelete } from "@/lib/api-client";

interface SitePage {
  documentId?: string;
  id: number;
  title: string;
  slug: string;
  status: string;
  pageType: string;
  order: number;
}

interface Website {
  documentId: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  userId: string;
  customDomain?: string;
  domainVerified?: boolean;
  pages?: SitePage[];
  blogPosts?: any[];
}

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const router = useRouter();
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSite = async () => {
    setLoading(true);
    try {
      const data = await authenticatedGet<{ website: Website }>(`/websites/${siteId}`);
      setWebsite(data.website);
    } catch {
      toast.error("Site not found");
      router.push("/sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (siteId) fetchSite();
  }, [siteId]);

  const handleDeletePage = async (pageId: string) => {
    if (!confirm("Delete this page?")) return;
    try {
      await authenticatedDelete(`/websites/pages/${pageId}`);
      toast.success("Page deleted");
      fetchSite();
    } catch {
      toast.error("Failed to delete page");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!website) return null;

  const pages = website.pages || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/sites")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Sites
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{website.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{website.type}</span>
            <span className="text-xs text-muted-foreground">&middot;</span>
            <span
              className={`text-xs ${website.status === "published" ? "text-green-600" : "text-amber-600"}`}
            >
              {website.status}
            </span>
            {website.customDomain && (
              <>
                <span className="text-xs text-muted-foreground">&middot;</span>
                <span className="text-xs text-muted-foreground">
                  {website.customDomain} {website.domainVerified ? "(verified)" : "(pending)"}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/sites/${siteId}/blog`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Blog Posts
            </Button>
          </Link>
          <Link href={`/sites/${siteId}/settings`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Settings
            </Button>
          </Link>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Pages ({pages.length})
        </h2>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No pages yet. Ask your agent to add pages to this site.
          </p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border bg-card">
            {pages.map((page) => {
              const docId = page.documentId || String(page.id);
              return (
                <div key={docId} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{page.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">/{page.slug}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {page.pageType}
                      </span>
                      <span
                        className={`text-xs ${page.status === "published" ? "text-green-600" : "text-amber-600"}`}
                      >
                        {page.status}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeletePage(docId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
