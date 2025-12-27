interface PageProps {
  params: Promise<{
    workflowId: string;
  }>;
}

const WorkflowDetailPage = async ({ params }: PageProps) => {
  const { workflowId } = await params;

  return <div>Workflow id: {workflowId}</div>;
};

export default WorkflowDetailPage;