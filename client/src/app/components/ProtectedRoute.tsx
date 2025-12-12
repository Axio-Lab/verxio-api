"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ReactNode } from "react";
import { VerxioLoader } from "./VerxioLoader";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/");
    }
  }, [authenticated, ready, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <VerxioLoader size="md" />
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
