
interface PageProps {
  params: Promise<{
    credentialId: string;
  }>;
}

const CredentialDetailPage = async ({ params }: PageProps) => {
  const { credentialId } = await params;

  return <div>Credential id: {credentialId}</div>;
};

export default CredentialDetailPage;