import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Editor, EditorLoader } from "@/app/app-components/features/editor/editor";
import { EditorHeader } from "@/app/app-components/features/editor/editor-header";
import { EditorErrorBoundaryFallback } from "./editor-error-boundary";

// Server component wrapper
function WorkflowEditorPageContent({ workflowId }: { workflowId: string }) {
  return (
    <ErrorBoundary
      FallbackComponent={EditorErrorBoundaryFallback}
    >
        <Suspense fallback={<EditorLoader />}>
          <EditorHeader workflowId={workflowId} />
          <main className="flex-1 p-6">
            <Editor workflowId={workflowId} />
          </main>
        </Suspense>
    </ErrorBoundary>
  );
}

export default async function WorkflowEditorPage({ 
  params 
}: { 
  params: Promise<{ workflow: string }> 
}) {
  const { workflow } = await params;
  return <WorkflowEditorPageContent workflowId={workflow} />;
}


