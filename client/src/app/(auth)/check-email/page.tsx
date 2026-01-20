"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 px-6 pt-6 pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            We've sent a verification link to
          </CardDescription>
          {email && (
            <CardDescription className="text-sm font-medium text-gray-900">{email}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Please click the verification link in the email to activate your account. Link will
              expire in 24 hours.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
