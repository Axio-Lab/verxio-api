"use client";

import { useParams } from "next/navigation";
import { ConnectionForm } from "@/app/app-components/features/connections/connection-form";
import { useConnection } from "@/hooks/useConnections";
import { ConnectionsLoadingView } from "@/app/app-components/features/connections/connection";

const EditConnectionPage = () => {
  const params = useParams();
  const connectionId = params.connectionId as string;

  const { data: connection, isLoading } = useConnection(connectionId);

  if (isLoading) {
    return (
      <div className="p-4 md:px-10 md:py-6 h-full">
        <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
          <ConnectionsLoadingView />
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="p-4 md:px-10 md:py-6 h-full">
        <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground">Connection not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <ConnectionForm connection={connection} isEditing />
      </div>
    </div>
  );
};

export default EditConnectionPage;
