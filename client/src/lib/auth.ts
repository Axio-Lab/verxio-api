import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  // Database configuration using Prisma adapter
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: user.email,
          subject: "Reset your password",
          html: `
            <h2>Reset Your Password</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>Or copy and paste this URL into your browser:</p>
            <p>${url}</p>
            <p>This link will expire in 1 hour.</p>
          `,
        });
      }
    },
  },

  // Social authentication providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      enabled: true,
    },
  },

  // Base URL for the auth server
  baseURL: process.env.BETTER_AUTH_URL,

  // API route path (default: /api/auth)
  basePath: "/api/auth",

  // Secret key for encryption and hashing (required, min 32 chars)
  secret: process.env.BETTER_AUTH_SECRET!,

  // Trusted origins for CORS
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!, process.env.NEXT_PUBLIC_API_URL!],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
