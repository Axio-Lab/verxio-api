import { Suspense, cache } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { WorkflowsLoadingView } from "@/app/app-components/features/workflow/workflows";
import { WorkflowsErrorBoundaryFallback } from "@/app/app-components/features/workflow/workflows-error-boundary";
import { WorkflowsContent } from "./workflows-content-client";

// Get or create a QueryClient instance for server-side prefetching
const getQueryClient = cache(() => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
});

// Server component to prefetch workflows
async function WorkflowsPageContent() {
  const queryClient = getQueryClient();
  
  // Prefetch workflows data on the server
  await queryClient.prefetchQuery({
    queryKey: ["workflows", 1, 10, undefined],
    queryFn: async () => {
      // This will be called on the server
      // You'll need to implement server-side fetching here
      // For now, returning empty data structure
      return {
        workflows: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
    },
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ErrorBoundary
        FallbackComponent={WorkflowsErrorBoundaryFallback}
      >
        <Suspense fallback={<WorkflowsLoadingView />}>
          <WorkflowsContent />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}

const WorkflowsPage = () => {
  return <WorkflowsPageContent />;
};

export default WorkflowsPage;
