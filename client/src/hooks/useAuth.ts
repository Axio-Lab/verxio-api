"use client";

import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { useEnsureUser } from "./useUser";
import { useEffect } from "react";

/**
 * Custom hook that combines Better Auth session with VerxioUser management
 * Automatically creates VerxioUser when a Better Auth user signs up
 */
export function useAuth() {
  const { data: session, isPending, error } = useSession();

  return {
    session,
    user: session?.user,
    isLoading: isPending,
    error,
    isAuthenticated: !!session?.user,
    signIn,
    signUp,
    signOut,
  };
}

/**
 * Hook to ensure VerxioUser exists for the authenticated Better Auth user
 * This should be used in components that need VerxioUser data
 * Automatically creates VerxioUser when Better Auth user exists but VerxioUser doesn't
 */
export function useAuthWithVerxioUser() {
  const auth = useAuth();
  const { user: verxioUser, isLoading: isLoadingVerxio, createUser } = useEnsureUser(
    auth.user?.email
  );

  // Auto-create VerxioUser when Better Auth user exists but VerxioUser doesn't
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.email && createUser && !isLoadingVerxio) {
      createUser();
    }
  }, [auth.isAuthenticated, auth.user?.email, createUser, isLoadingVerxio]);

  return {
    ...auth,
    verxioUser,
    isLoading: auth.isLoading || isLoadingVerxio,
  };
}

