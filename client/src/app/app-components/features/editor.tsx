"use client";

import { useWorkflow } from "@/hooks/useWorkflows";
import { ErrorView, LoadingView } from "./entity-component";

export const EditorLoader = () => {
    return <LoadingView message="Loading editor..." />;
}

export const EditorError = () => {
    return <ErrorView message="Error loading editor..." />;
}

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  
  if (isLoading) {
    return <EditorLoader />;
  }
  
  if (error) {
    return <EditorError />;
  }
  
  if (!workflow) {
    return <EditorError />;
  }
  
  return (
    <div className="p-4">
      <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
        {JSON.stringify(workflow, null, 2)}
      </pre>
    </div>
  );
};

export default Editor;