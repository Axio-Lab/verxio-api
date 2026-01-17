import { Suspense } from "react";
import { CredentialsLoadingView } from "@/app/app-components/features/credentials/credential";
import { CredentialDetail } from "@/app/app-components/features/credentials/credential-form";
interface PageProps {
  params: Promise<{
    credentialId: string;
  }>;
}

const CredentialDetailPage = async ({ params }: PageProps) => {
  const { credentialId } = await params;

  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <Suspense fallback={<CredentialsLoadingView />}>
          <CredentialDetail credentialId={credentialId} />
        </Suspense>
      </div>
    </div>
  );
};

export default CredentialDetailPage;
