"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn, sendVerificationEmail } from "@/lib/auth-client";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password is required"),
});

type FormSchema = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthWithVerxioUser();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Prefetch workflows page on mount for instant navigation
  useEffect(() => {
    router.prefetch("/workflows");
  }, [router]);

  // Check for verified parameter and show success message
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified successfully! You can now log in.");
      // Clean up URL
      router.replace("/login");
    }
  }, [searchParams, router]);

  // Redirect if already authenticated - use replace for instant navigation
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/workflows");
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (values: FormSchema) => {
    try {
      const result = await signIn.email(
        {
          email: values.email,
          password: values.password,
        },
        {
          onError: async (ctx) => {
            // Handle email verification error
            if (ctx.error.status === 403) {
              // Automatically send verification email and redirect to check-email page
              try {
                await sendVerificationEmail({
                  email: values.email,
                  callbackURL: `${window.location.origin}/login?verified=true`,
                });
                toast.success("Verification email sent! Please check your inbox.");
                // Redirect to check-email page
                router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
              } catch (error: any) {
                console.error("Failed to send verification email:", error);
                // If sending fails, show error but still redirect
                toast.error("Email verification required. Redirecting to verification page...");
                router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
              }
            } else {
              toast.error(ctx.error.message || "Login failed. Please check your credentials.");
            }
          },
        }
      );

      // Better Auth returns { data, error } structure
      if (result?.error) {
        // Error already handled in onError callback
        return;
      }

      toast.success("Login successful! ");
      // Instant redirect using window.location for faster navigation
      window.location.href = "/workflows";
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        "An unexpected error occurred. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleSocialLogin = async (provider: "google") => {
    setSocialLoading(provider);
    try {
      // Prefetch workflows page for instant navigation after OAuth
      router.prefetch("/workflows");
      await signIn.social({
        provider,
        callbackURL: "/workflows",
      });
      // The OAuth flow will handle the redirect automatically
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`Failed to sign in with ${provider}. Please try again.`);
      setSocialLoading(null);
    }
  };

  const isPending = form.formState.isSubmitting;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-sm text-gray-500">Login to continue</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-sm flex items-center justify-center gap-2"
                  disabled={isPending || socialLoading !== null}
                  onClick={() => handleSocialLogin("google")}
                >
                  {socialLoading === "google" ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Image
                      src="/logo/google.svg"
                      alt="Google"
                      width={18}
                      height={18}
                      className="w-4 h-4"
                    />
                  )}
                  Continue with Google
                </Button>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="user@example.com"
                          className="h-10 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          className="h-10 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:text-primary/80 underline underline-offset-4"
                    onClick={(e) => {
                      // Prevent any form interaction
                      e.preventDefault();
                      e.stopPropagation();
                      router.push("/forgot-password");
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative pt-2">
                  <Button
                    type="submit"
                    className="w-full h-10 text-sm font-semibold relative z-10 flex items-center justify-center gap-2"
                    disabled={isPending || socialLoading !== null}
                  >
                    {isPending && <Spinner className="w-4 h-4" />}
                    {isPending ? "Logging in..." : "Login"}
                  </Button>
                  {/* Logo icons behind the button */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-10 pointer-events-none z-0">
                    <Image
                      src="/logo/verxioIcon.svg"
                      alt="Verxio"
                      width={20}
                      height={20}
                      className="w-5 h-5"
                    />
                    <Image
                      src="/logo/verxioLogo.svg"
                      alt="Verxio"
                      width={60}
                      height={20}
                      className="h-5 w-auto"
                    />
                  </div>
                </div>
              </div>

              <div className="text-center text-sm pt-2">
                Don't have an account?{" "}
                <Link
                  href="/signup"
                  className="underline underline-offset-4 text-primary hover:text-primary/80 font-medium"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
