import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { dash } from "@better-auth/infra";
import { prisma } from "./prisma";

function createDashPlugin() {
  const apiKey = process.env.BETTER_AUTH_API_KEY?.trim();
  if (!apiKey) return null;
  return dash({ apiKey });
}

// Polar plugin per @polar-sh/better-auth docs
function createPolarPlugin() {
  if (!process.env.POLAR_ACCESS_TOKEN?.trim()) return null;

  try {
    const { polar, checkout, webhooks } = require("@polar-sh/better-auth");
    const { Polar } = require("@polar-sh/sdk");
    const {
      handleOrderPaid,
      handleSubscriptionActive,
      handleSubscriptionCanceled,
      handleSubscriptionExpired,
      handleCustomerStateChanged,
    } = require("./polar-webhooks");

    const polarClient = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: (process.env.POLAR_SERVER as "sandbox" | "production") || "sandbox",
    });

    const productId = process.env.POLAR_BETA_TESTER_PRODUCT_ID;
    return polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: productId ? [{ productId, slug: "Verxio-Beta-Tester" }] : [],
          successUrl: process.env.NEXT_PUBLIC_APP_URL + "/workflows?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: true,
        }),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET || "",
          onOrderPaid: handleOrderPaid,
          onSubscriptionActive: handleSubscriptionActive,
          onSubscriptionCanceled: handleSubscriptionCanceled,
          onSubscriptionRevoked: handleSubscriptionExpired,
          onCustomerStateChanged: handleCustomerStateChanged,
        }),
      ],
    });
  } catch (error) {
    console.warn("[BetterAuth] Polar plugin failed:", error);
    return null;
  }
}

const polarPlugin = createPolarPlugin();
const dashPlugin = createDashPlugin();

export const auth = betterAuth({
  // Database configuration using Prisma adapter
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Require email verification before login
    sendResetPassword: async ({ user, url }) => {
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "support@verxio.xyz",
            to: user.email,
            subject: "Reset your password",
            html: `
              <p>Click the link below to reset your password:</p>
              <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
              <p>Or copy and paste this URL into your browser:</p>
              <p>${url}</p>
              <p>This link will expire in 1 hour.</p>
            `,
          });
        } catch (error) {
          console.error("Failed to send password reset email:", error);
          throw error; // Re-throw for password reset to show error to user
        }
      }
    },
  },

  // Email verification configuration
  emailVerification: {
    sendOnSignUp: true, // Automatically send verification email on signup
    sendOnSignIn: true, // Send verification email when unverified user tries to sign in
    autoSignInAfterVerification: false, // Don't auto-sign in after verification (user should log in)
    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "support@verxio.xyz",
            to: user.email,
            subject: "Verify your email address",
            html: `
              <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
              <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
              <p>Or copy and paste this URL into your browser:</p>
              <p>${url}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            `,
          });
        } catch (error) {
          // Log error but don't throw to prevent timing attacks
          console.error("Failed to send verification email:", error);
        }
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

  plugins: [...(dashPlugin ? [dashPlugin] : []), ...(polarPlugin ? [polarPlugin] : [])],
});
