"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyIcon, Gift, MousePointerClick, UserPlus, DollarSign } from "lucide-react";
import { LoadingView, ErrorView } from "@/app/app-components/features/editor/entity-component";

interface ReferralStats {
  totalClicks: number;
  signups: number;
  conversions: number;
  totalEarned: number;
  referrals: Array<{
    id: string;
    code: string;
    clicks: number;
    status: string;
    totalEarned: number;
    createdAt: string;
  }>;
}

function ReferralsContent() {
  const [code, setCode] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [codeRes, statsRes] = await Promise.all([
        authenticatedGet<{ code: string; link: string }>("/api/referral/code"),
        authenticatedGet<ReferralStats>("/api/referral/stats"),
      ]);
      setCode(codeRes.code);
      setLink(codeRes.link);
      setStats(statsRes);
    } catch {
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-[60vh]">
        <LoadingView entity="referrals" message="Loading referrals..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground mt-1">
          Invite friends and earn 500 credits for each one who subscribes.
        </p>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-lg px-4 py-2.5 text-sm font-mono truncate">
              {link}
            </div>
            <Button onClick={copyLink} variant="outline" size="sm">
              <CopyIcon className="mr-1 h-4 w-4" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share this link. When someone signs up and subscribes, you both earn rewards.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MousePointerClick className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalClicks || 0}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <UserPlus className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.signups || 0}</p>
                <p className="text-xs text-muted-foreground">Sign Ups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.conversions || 0}</p>
                <p className="text-xs text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalEarned || 0}</p>
                <p className="text-xs text-muted-foreground">Credits Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral History */}
      {stats && stats.referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">Code: {ref.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {ref.clicks} clicks &middot; {new Date(ref.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ref.status === "converted"
                          ? "bg-green-100 text-green-700"
                          : ref.status === "signed_up"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ref.status}
                    </span>
                    {ref.totalEarned > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                        +{ref.totalEarned} credits
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <ErrorBoundary FallbackComponent={() => <ErrorView message="Error loading referrals" />}>
      <Suspense
        fallback={
          <div className="flex flex-1 flex-col min-h-[60vh]">
            <LoadingView entity="referrals" message="Loading referrals..." />
          </div>
        }
      >
        <ReferralsContent />
      </Suspense>
    </ErrorBoundary>
  );
}
