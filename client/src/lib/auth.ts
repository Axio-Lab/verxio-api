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
    requireEmailVerification: false, // Set to true in production if needed
  },
  
  // Social authentication providers
  socialProviders: {
    google: {
      clientId: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET!,
      enabled: true,
    },
    facebook: {
      clientId: process.env.BETTER_AUTH_FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.BETTER_AUTH_FACEBOOK_CLIENT_SECRET!,
      enabled: true,
    },
    apple: {
      clientId: process.env.BETTER_AUTH_APPLE_CLIENT_ID!,
      clientSecret: process.env.BETTER_AUTH_APPLE_CLIENT_SECRET!,
      enabled: true,
    },
  },
  
  // Base URL for the auth server
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  
  // API route path (default: /api/auth)
  basePath: "/api/auth",
  
  // Secret key for encryption and hashing (required, min 32 chars)
  secret: process.env.BETTER_AUTH_SECRET!,
  
  // Trusted origins for CORS
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL!,
    process.env.NEXT_PUBLIC_API_URL!,
  ],
  
  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

