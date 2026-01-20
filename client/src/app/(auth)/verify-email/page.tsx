"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyEmail, getSession } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    const verify = async () => {
      // If token is present, verify using the token
      if (token) {
        try {
          const result = await verifyEmail({
            query: {
              token,
            },
          });

          if (result?.error) {
            setStatus("error");
            setErrorMessage(
              result.error.message || "Verification failed. The link may have expired."
            );
            toast.error("Verification failed");
          } else {
            setStatus("success");
            toast.success("Email verified successfully!");
            // Redirect to login after a short delay
            setTimeout(() => {
              router.push("/login");
            }, 2000);
          }
        } catch (error: any) {
          console.error("Verification error:", error);
          setStatus("error");
          setErrorMessage(error?.message || "An unexpected error occurred. Please try again.");
          toast.error("Verification failed");
        }
      } else {
        // No token in URL - check if user is already verified (redirected from API)
        // This happens when Better Auth verifies via /api/auth/verify-email and redirects here
        try {
          const session = await getSession();
          if (session && "data" in session && session.data?.user?.emailVerified) {
            // Email is already verified
            setStatus("success");
            toast.success("Email verified successfully!");
            setTimeout(() => {
              router.push("/login");
            }, 2000);
          } else {
            // Token missing and email not verified - wait a bit and check again
            // Better Auth might still be processing the verification
            setTimeout(async () => {
              const retrySession = await getSession();
              if (
                retrySession &&
                "data" in retrySession &&
                retrySession.data?.user?.emailVerified
              ) {
                setStatus("success");
                toast.success("Email verified successfully!");
                setTimeout(() => {
                  router.push("/login");
                }, 2000);
              } else {
                setStatus("error");
                setErrorMessage("Verification token is missing. Please check your email link.");
              }
            }, 1000);
          }
        } catch (error) {
          console.error("Failed to check session:", error);
          setStatus("error");
          setErrorMessage("Verification token is missing. Please check your email link.");
        }
      }
    };

    verify();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          {status === "loading" && (
            <div className="flex justify-center mb-4">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
          )}
          {status === "success" && (
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          )}
          <CardTitle className="text-2xl font-bold">
            {status === "loading" && "Verifying Email"}
            {status === "success" && "Email Verified"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {status === "loading" && "Please wait while we verify your email address..."}
            {status === "success" && "Your email has been successfully verified!"}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-4 text-center">
            {status === "success" && (
              <p className="text-sm text-gray-600">
                You can now log in to your account. Redirecting to login page...
              </p>
            )}
            {status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  The verification link may have expired or is invalid. Please request a new
                  verification email.
                </p>
                <div className="pt-2 space-y-2">
                  <hr className="my-4" />
                  <div className="text-center text-sm">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="underline underline-offset-4 text-primary hover:text-primary/80 font-medium"
                    >
                      Login
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
