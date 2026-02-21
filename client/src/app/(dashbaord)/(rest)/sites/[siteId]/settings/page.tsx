"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { authenticatedGet, authenticatedPost } from "@/lib/api-client";

interface Website {
  documentId: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  customDomain?: string;
  domainVerified?: boolean;
  globalStyles?: {
    brandColor?: string;
    fontFamily?: string;
    logoUrl?: string;
  };
}

export default function SiteSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const router = useRouter();
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await authenticatedGet<{ website: Website }>(`/websites/${siteId}`);
        setWebsite(data.website);
        setCustomDomain(data.website.customDomain || "");
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    if (siteId) load();
  }, [siteId]);

  const handleSetDomain = async () => {
    if (!customDomain.trim()) return;
    setSaving(true);
    try {
      const data = await authenticatedPost<{ website: Website; message: string }>(
        `/websites/${siteId}/domain`,
        { domain: customDomain.trim() }
      );
      setWebsite(data.website);
      toast.success(data.message || "Domain set. Add a CNAME record, then verify.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set domain. Business plan required.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setVerifying(true);
    try {
      const data = await authenticatedPost<{ website: Website; verified: boolean; message?: string }>(
        `/websites/${siteId}/domain/verify`
      );
      setWebsite(data.website);
      if (data.verified) toast.success(data.message || "Domain verified.");
      else toast.error("Verification failed. Check that your CNAME points to pages.verxio.xyz");
    } catch (err: any) {
      const msg = err?.message || "Verification failed.";
      toast.error(msg);
    } finally {
      setVerifying(false);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      <h1 className="text-xl font-semibold text-foreground">Site Settings</h1>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">General</h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <p className="text-sm text-foreground">{website.title}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Slug</label>
              <p className="text-sm text-foreground font-mono">/{website.slug}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <p className="text-sm text-foreground capitalize">{website.type}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">Custom Domain</h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Business plan only. Add a custom domain to serve your site from your own URL.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="www.yourdomain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="text-sm"
              />
              <Button onClick={handleSetDomain} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set Domain"}
              </Button>
            </div>
            {website.customDomain && (
              <div className="text-xs space-y-2">
                <p className="text-muted-foreground">
                  Current: <span className="font-mono text-foreground">{website.customDomain}</span>
                </p>
                <p
                  className={
                    website.domainVerified ? "text-green-600" : "text-amber-600"
                  }
                >
                  {website.domainVerified
                    ? "Domain verified and active"
                    : "Pending verification. Add a CNAME record pointing to pages.verxio.xyz"}
                </p>
                {!website.domainVerified && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyDomain}
                    disabled={verifying}
                  >
                    {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify domain"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
