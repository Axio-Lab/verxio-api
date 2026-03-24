"use client";

import { createAuthClient } from "better-auth/react";
import { dashClient } from "@better-auth/infra/client";
import { polarClient } from "@polar-sh/better-auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [dashClient(), polarClient()],
});

// Export all auth methods for convenience
export const {
  signIn,
  verifyEmail,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
