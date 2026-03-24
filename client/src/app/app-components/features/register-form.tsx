"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
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
import { Checkbox } from "@/components/ui/checkbox";
import { signUp, signIn, signOut } from "@/lib/auth-client";
import { useAuthWithVerxioUser } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((data) => data.acceptTerms === true, {
    path: ["acceptTerms"],
    message: "You must accept the Terms of Service to create an account",
  });

type FormSchema = z.infer<typeof formSchema>;

export function RegisterForm() {
  const router = useRouter();
  const { isAuthenticated, verxioUser } = useAuthWithVerxioUser();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  // Track referral click on mount
  useEffect(() => {
    if (refCode) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/referral/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: refCode }),
      }).catch(() => {});
    }
  }, [refCode]);

  // Prefetch workflows page on mount for instant navigation
  useEffect(() => {
    router.prefetch("/workflows");
  }, [router]);

  // Redirect if already authenticated (with verified email) and VerxioUser is created
  useEffect(() => {
    if (isAuthenticated && verxioUser) {
      router.replace("/workflows");
    }
  }, [isAuthenticated, verxioUser, router]);

  const onSubmit = async (values: FormSchema) => {
    try {
      const result = await signUp.email({
        email: values.email,
        password: values.password,
        name: values.email.split("@")[0], // Use email prefix as name
      });

      // Better Auth returns { data, error } structure
      if (result?.error) {
        toast.error(result.error.message || "Registration failed. Please try again.");
        return;
      }

      // Sign out immediately to prevent auto-login (email verification required)
      try {
        await signOut();
      } catch (signOutError) {
        console.warn("Failed to sign out after registration:", signOutError);
        // Continue anyway - we'll check email verification status in auth hooks
      }

      // Redirect to check-email page with email parameter
      toast.success("Account created! Please check your email to verify your account.");
      router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
    } catch (error: any) {
      console.error("Registration error:", error);
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        "An unexpected error occurred. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleSocialSignup = async (provider: "google") => {
    setSocialLoading(provider);
    try {
      await signIn.social({
        provider,
        callbackURL: "/workflows",
      });
    } catch (error) {
      console.error(`${provider} signup error:`, error);
      toast.error(`Failed to sign up with ${provider}. Please try again.`);
      setSocialLoading(null);
    }
  };

  const isPending = form.formState.isSubmitting;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          <CardTitle className="text-2xl font-bold">Get Started</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Create your account to get started
          </CardDescription>
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
                  onClick={() => handleSocialSignup("google")}
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
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm">Confirm Password</FormLabel>
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
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          I accept the{" "}
                          <Link
                            href="/terms-of-service"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4 hover:text-primary/80"
                          >
                            Terms of Service
                          </Link>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <div className="relative pt-2">
                  <Button
                    type="submit"
                    className="w-full h-10 text-sm font-semibold relative z-10 flex items-center justify-center gap-2"
                    disabled={isPending || socialLoading !== null}
                  >
                    {isPending && <Spinner className="w-4 h-4" />}
                    {isPending ? "Creating account..." : "Create Account"}
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
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="underline underline-offset-4 text-primary hover:text-primary/80 font-medium"
                >
                  Login
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
