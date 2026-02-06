import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SkillsLoadingView } from "@/app/app-components/features/skills/skill";
import { SkillsContent } from "../../../app-components/features/skills/skills-content-client";
import { SkillsErrorBoundaryFallback } from "@/app/app-components/features/skills/skills-error-boundary";

const SkillsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={SkillsErrorBoundaryFallback}>
      <Suspense fallback={<SkillsLoadingView />}>
        <SkillsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default SkillsPage;
