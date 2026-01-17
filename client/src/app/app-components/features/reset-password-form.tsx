"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Spinner } from "@/components/ui/spinner";
import { useEffect } from "react";
import { resetPassword } from "@/lib/auth-client";

const formSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormSchema = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = React.useState(false);
  const [isRequestingNewLink, setIsRequestingNewLink] = React.useState(false);

  // Get token from URL query params (Better Auth includes token in the reset link)
  const token = searchParams.get("token");

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Validate token from query params on mount only
  useEffect(() => {
    if (!token) {
      toast.error("Please request a new reset link.");
      router.push("/forgot-password");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleRequestNewLink = async () => {
    try {
      setIsRequestingNewLink(true);
      router.push("/forgot-password");
    } catch (error) {
      console.error("Request new link error:", error);
    } finally {
      setIsRequestingNewLink(false);
    }
  };

  const onSubmit = async (values: FormSchema) => {
    if (!token) {
      router.push("/forgot-password");
      return;
    }
    try {
      setIsPending(true);
      const result = await resetPassword({
        newPassword: values.newPassword,
        token: token,
      });

      if (result.error) {
        // Better Auth returns specific error messages for invalid/expired tokens
        const errorMessage = result.error.message || "Failed to reset password. Please try again.";
        toast.error(errorMessage);
        return;
      }

      toast.success("Password reset. Login with your new password.");
      // Redirect to login page after successful reset
      router.push("/login");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error?.message || "Failed to reset password. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Enter your new password
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">New Password</FormLabel>
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
              <div className="relative pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold relative z-10 flex items-center justify-center gap-2"
                  disabled={isPending || isRequestingNewLink || !token}
                >
                  {isPending && <Spinner className="w-4 h-4" />}
                  {isPending ? "Resetting Password..." : "Reset Password"}
                </Button>
              </div>
              <div className="text-center text-xs pt-1">
                Didn't receive the reset link or it expired?{" "}
                <button
                  type="button"
                  onClick={handleRequestNewLink}
                  disabled={isRequestingNewLink}
                  className="underline underline-offset-4 text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingNewLink ? "Redirecting..." : "Request a new one"}
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
