
interface PageProps {
    params: Promise<{
      executionId: string;
    }>;
  }
  
  const ExecutionDetailPage = async ({ params }: PageProps) => {
    const { executionId } = await params;
  
    return <div>Execution id: {executionId}</div>;
  };
  
  export default ExecutionDetailPage;