"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { requestPasswordReset } from "@/lib/auth-client";
import { toast } from "sonner";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormSchema = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormSchema) => {
    try {
      setIsPending(true);
      const result = await requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send reset link. Please try again");
        return;
      }

      // Success - show message
      toast.success("Password reset link has been sent to your email");
    } catch (error: any) {
      console.error("Forgot password error:", error);
      toast.error(error?.message || "Failed to send reset link. Please try again");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="relative pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold relative z-10 flex items-center justify-center gap-2"
                  disabled={isPending}
                >
                  {isPending && <Spinner className="w-4 h-4" />}
                  {isPending ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
              <div className="text-center text-sm pt-2">
                Remember your password?{" "}
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
