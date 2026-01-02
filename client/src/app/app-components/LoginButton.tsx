"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn.social({ provider: "google" });
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await signIn.email({ email, password });
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-textPrimary shadow-md shadow-gray-900/10 transition-all hover:shadow-lg hover:shadow-gray-900/15 disabled:opacity-50"
      >
        {isLoading ? "Loading..." : "Continue with Google"}
      </button>
      
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gray-900/10 transition-all hover:shadow-lg hover:shadow-gray-900/15 disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

