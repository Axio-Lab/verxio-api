import { Suspense } from "react";
import { ExecutionsLoadingView } from "@/app/app-components/features/executions/execution";
import { ExecutionView } from "@/app/app-components/features/executions/execution-detail";

interface PageProps {
  params: Promise<{
    executionId: string;
  }>;
}

const ExecutionDetailPage = async ({ params }: PageProps) => {
  const { executionId } = await params;

  return (
    <div className="p-4 md:px-10 md:py-6">
      <div className="mx-auto max-w-screen-md w-full">
        <Suspense fallback={<ExecutionsLoadingView />}>
          <ExecutionView executionId={executionId} />
        </Suspense>
      </div>
    </div>
  );
};

export default ExecutionDetailPage;
