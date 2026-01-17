"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ResetPasswordForm } from "@/app/app-components/features/reset-password-form";
import { VerxioLoader } from "@/app/app-components/VerxioLoader";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Redirect authenticated users to workflows page
    if (!isLoading && isAuthenticated) {
      router.replace("/workflows");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <VerxioLoader size="md" />
      </div>
    );
  }

  // Don't render form if user is authenticated (redirect will happen)
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <VerxioLoader size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative">
      <ResetPasswordForm />
    </div>
  );
}
