"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatedPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  WorkflowsContainer,
  WorkflowsLoadingView,
  WorkflowsErrorView,
  WorkflowsEmptyView,
  WorkflowsList,
} from "@/app/app-components/features/workflow/workflows";
import { useWorkflows, useCreateWorkflow } from "@/hooks/useWorkflows";
import { WorkflowNameInput } from "@/app/app-components/features/workflow/workflow-name-input";
import { useWorkflowSearch } from "@/hooks/useSearchParams";

type CheckoutSyncStatus = "idle" | "syncing" | "done";

// Client component that fetches and displays workflows
export function WorkflowsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    search: searchQuery,
    setSearch: setSearchQuery,
    page: currentPage,
    setPage: setCurrentPage,
    limit,
  } = useWorkflowSearch();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [checkoutSyncStatus, setCheckoutSyncStatus] = useState<CheckoutSyncStatus>("idle");
  const doneTimeoutRef = useRef<number | null>(null);

  // After Polar checkout redirect: sync subscription then refetch so sidebar shows beta-tester without manual refresh.
  useEffect(() => {
    const token = searchParams.get("customer_session_token");
    const checkoutId = searchParams.get("checkout_id");
    if (!token && !checkoutId) return;

    setCheckoutSyncStatus("syncing");

    const refetchSubscription = () =>
      queryClient.refetchQueries({ queryKey: ["subscription-status"] });

    const clearUrlParams = () => {
      const u = new URL(window.location.href);
      u.searchParams.delete("customer_session_token");
      u.searchParams.delete("checkout_id");
      router.replace(u.pathname + u.search, { scroll: false });
    };

    (async () => {
      try {
        const r = await fetch("/api/billing/sync-from-checkout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkout_id: checkoutId || undefined,
            customer_session_token: token || undefined,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (data?.synced) {
          await refetchSubscription();
        }
      } catch (_) {}
      await refetchSubscription();

      setCheckoutSyncStatus("done");
      doneTimeoutRef.current = window.setTimeout(() => {
        clearUrlParams();
        setCheckoutSyncStatus("idle");
        doneTimeoutRef.current = null;
      }, 2000);
    })();

    const t2 = window.setTimeout(refetchSubscription, 2000);
    const t5 = window.setTimeout(refetchSubscription, 5000);

    return () => {
      clearTimeout(t2);
      clearTimeout(t5);
      if (doneTimeoutRef.current) {
        clearTimeout(doneTimeoutRef.current);
        doneTimeoutRef.current = null;
      }
    };
  }, [searchParams, queryClient, router]);

  // Local state for search input to prevent focus loss on URL updates
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local search with URL search on mount or when URL changes externally
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounced search update to URL
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Update URL after 300ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      // Reset to page 1 when search changes
      if (value !== searchQuery) {
        setCurrentPage(1);
      }
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const {
    data: apiData,
    isLoading,
    error,
  } = useWorkflows(currentPage, limit, searchQuery || undefined);
  const createWorkflow = useCreateWorkflow();

  const handleCreateWorkflow = (name: string) => {
    createWorkflow.mutate(
      { name },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
        },
      }
    );
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  // Import workflow from Zapier/Make
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportLoading(true);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const result = await authenticatedPost<{
          workflowId: string;
          stepsImported: number;
          setupInstructions: string[];
        }>("/api/migration/import", json);
        toast.success(`Imported ${result.stepsImported} steps into a new workflow`);
        if (result.setupInstructions.length > 0) {
          toast.info(result.setupInstructions.join("\n"), { duration: 10000 });
        }
        setImportDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["workflows"] });
        router.push(`/workflows/${result.workflowId}`);
      } catch (err: any) {
        toast.error(err.message || "Failed to import workflow");
      } finally {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [queryClient, router]
  );

  const data = apiData;
  const hasWorkflows = Boolean(data?.workflows && data.workflows.length > 0);
  const isEmpty = !data || !data.workflows || data.workflows.length === 0;

  const checkoutSyncOverlay =
    checkoutSyncStatus !== "idle" ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="rounded-lg border bg-card px-6 py-4 shadow-lg flex items-center gap-3">
          {checkoutSyncStatus === "syncing" && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Updating plan...</span>
            </>
          )}
          {checkoutSyncStatus === "done" && (
            <>
              <Check className="h-5 w-5 text-green-600" />
              <span>Plan updated</span>
            </>
          )}
        </div>
      </div>
    ) : null;

  // Show loading state
  if (isLoading) {
    return (
      <>
        {checkoutSyncOverlay}
        <WorkflowsContainer
          searchValue={localSearch}
          onSearchChange={handleSearchChange}
          currentPage={currentPage}
          totalPages={0}
          onPageChange={setCurrentPage}
          isCreating={createWorkflow.isPending}
          onCreateWorkflow={handleOpenCreateDialog}
        >
          <WorkflowsLoadingView />
        </WorkflowsContainer>
      </>
    );
  }

  // Show error state
  if (error) {
    return (
      <>
        {checkoutSyncOverlay}
        <WorkflowsContainer
          searchValue={localSearch}
          onSearchChange={handleSearchChange}
          currentPage={currentPage}
          totalPages={0}
          onPageChange={setCurrentPage}
          isCreating={createWorkflow.isPending}
          onCreateWorkflow={handleOpenCreateDialog}
        >
          <WorkflowsErrorView />
        </WorkflowsContainer>
      </>
    );
  }

  // Always show the container with header and search, even when empty
  // Only show empty view outside container when there's no data at all (initial load with no workflows)
  // If there's no data at all (not just empty search results), show empty view outside container
  if (isEmpty && !searchQuery && currentPage === 1) {
    return (
      <>
        {checkoutSyncOverlay}
        <WorkflowNameInput
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateWorkflow}
          isPending={createWorkflow.isPending}
        />
        <WorkflowsEmptyView
          isCreating={createWorkflow.isPending}
          onCreateWorkflow={handleOpenCreateDialog}
        />
      </>
    );
  }

  // Render workflows container with header and search always visible
  return (
    <>
      {checkoutSyncOverlay}
      <WorkflowNameInput
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateWorkflow}
        isPending={createWorkflow.isPending}
      />

      <WorkflowsContainer
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        totalPages={data?.totalPages || 0}
        onPageChange={setCurrentPage}
        isCreating={createWorkflow.isPending}
        onCreateWorkflow={handleOpenCreateDialog}
      >
        {hasWorkflows ? (
          <WorkflowsList workflows={data?.workflows ?? []} />
        ) : (
          // Show empty view inside container when search returns no results
          <WorkflowsEmptyView
            isCreating={createWorkflow.isPending}
            onCreateWorkflow={handleOpenCreateDialog}
          />
        )}
      </WorkflowsContainer>

      {/* Import from Zapier/Make */}
      <div className="flex justify-end px-4 pb-4">
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Import from Zapier/Make
        </Button>
      </div>
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a Zapier Zap or Make.com Scenario JSON export to create a Verxio workflow.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {importLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Importing and mapping nodes...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
