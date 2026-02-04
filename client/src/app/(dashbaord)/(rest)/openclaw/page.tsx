import { OpenClawSetup } from "@/app/app-components/features/connections/openclaw-setup";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function OpenClawPage() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OpenClaw Integration</h1>
        <p className="text-muted-foreground">
          Set up and manage your OpenClaw integration for chat-based automation
        </p>
      </div>

      <Suspense fallback={<OpenClawLoadingSkeleton />}>
        <OpenClawSetup />
      </Suspense>
    </div>
  );
}

function OpenClawLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
