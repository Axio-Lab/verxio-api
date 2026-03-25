import { Suspense } from "react";
import { IntegrationsLoadingView } from "@/app/app-components/features/integrations/integration";
import { ChatIntegrationsSetup } from "@/app/app-components/features/connections/chat-integrations-setup";

const NewCoworkerPage = () => {
  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <Suspense fallback={<IntegrationsLoadingView />}>
          <ChatIntegrationsSetup hideIntegrationSelector createOnly />
        </Suspense>
      </div>
    </div>
  );
};

export default NewCoworkerPage;
