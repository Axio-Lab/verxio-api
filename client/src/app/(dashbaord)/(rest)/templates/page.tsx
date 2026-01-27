import { Suspense } from "react";
import { TemplatesContent } from "./templates-content-client";

const TemplatesPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      }
    >
      <TemplatesContent />
    </Suspense>
  );
};

export default TemplatesPage;
