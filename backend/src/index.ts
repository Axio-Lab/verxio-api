import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { serve } from "inngest/express";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { rateLimiter } from "./middleware/rateLimiter";
import { userRouter } from "./routes/user";
import { loyaltyRouter } from "./routes/loyalty";
import { voucherRouter } from "./routes/voucher";
import { dealRouter } from "./routes/deal";
import { workflowRouter } from "./routes/workflow";
import { credentialRouter } from "./routes/credential";
import { skillRouter } from "./routes/skill";
import { connectionRouter } from "./routes/connections";
import { googleFormRouter } from "./routes/triggers/google-form";
import { airtableRouter } from "./routes/triggers/airtable";
import { stripeRouter } from "./routes/triggers/stripe";
import { telegramRouter } from "./routes/triggers/telegram";
import { webhookTriggerRouter } from "./routes/triggers/webhook";
import { publicChatRouter } from "./routes/public-chat";
import { airtableWebhookRouter } from "./routes/airtable-webhook";
import { googleAuthRouter } from "./routes/auth/google";
import { elevenlabsRouter } from "./routes/elevenlabs";
import { workflowGenerationRouter } from "./routes/workflow-generation";
import { workflowTemplateRouter } from "./routes/workflow-template";
import { planningRouter } from "./routes/planning";
import { billingStatusRouter } from "./routes/billing/status";
// TODO: Re-enable when billing portal is properly designed
// import { billingPortalRouter } from "./routes/billing/portal";
import { billingCheckoutRouter } from "./routes/billing/checkout";
import { manualPaymentRouter } from "./routes/manual-payment";
import { adminManualPaymentsRouter } from "./routes/admin/manual-payments";
import { chatIntegrationRouter } from "./routes/chat-integrations";
import { internalWhatsAppRouter } from "./routes/internal/whatsapp";
import { internalDiscordRouter } from "./routes/internal/discord";
// import { apiKeyRouter } from './routes/apiKey';
import { swaggerSpec } from "./config/swagger";
import { inngest } from "./inngest";
import { functions } from "./inngest/functions";
import { initializeCronScheduler } from "./services/cron-scheduler";
import path from "path";

const app: express.Application = express();

// Trust proxy - required when behind reverse proxy (ngrok, load balancer, etc.)
// This allows Express to correctly identify client IPs from X-Forwarded-For headers
// Set to 1 to trust only the first proxy (safer than true which trusts all proxies)
// If behind multiple proxies, set to the number of proxies (e.g., 2 for load balancer + ngrok)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS configuration: default origins are always included; ALLOWED_ORIGINS adds extra
const defaultOrigins = [
  "http://localhost:3000",
  "https://deals.verxio.xyz",
  "https://playground.verxio.xyz",
  "https://api.verxio.xyz",
  "https://www.verxio.xyz",
  "https://verxio.xyz",
];
const envOrigins =
  process.env.ALLOWED_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) || [];
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
const serverPort = "8080";
const serverOrigin = `http://localhost:${serverPort}`;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
      if (!origin || origin === "null") {
        return callback(null, true);
      }

      // Allow requests from the server itself (for Swagger UI in development)
      if (origin === serverOrigin || origin.startsWith(`http://localhost:${serverPort}`)) {
        return callback(null, true);
      }

      // Always allow localhost dev origins (frontend at 3000, etc.)
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }

      // Allow requests from production API domain (for Swagger UI)
      if (origin === "https://api.verxio.xyz") {
        return callback(null, true);
      }

      // Allow requests from production playground domain
      if (origin === "https://playground.verxio.xyz") {
        return callback(null, true);
      }

      // Allow requests from allowed origins (defaults + ALLOWED_ORIGINS)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development mode, allow any origin containing localhost
      if (process.env.NODE_ENV === "development" && origin.includes("localhost")) {
        return callback(null, true);
      }

      // Log rejected origin for debugging (only in non-production)
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `CORS: Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(", ")}`
        );
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-API-Key",
      "X-User-Email",
      "Accept",
      "X-ChatIntegration-Secret",
      "X-ChatIntegration-User-Id",
      "X-ChatIntegration-Integration-Id",
      "X-ChatIntegration-Platform",
      "X-ChatIntegration-External-Id",
    ],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve generated images as static files
app.use(
  "/generated-images",
  express.static(path.join(process.cwd(), "public", "generated-images"))
);

// Serve generated videos as static files
app.use(
  "/generated-videos",
  express.static(path.join(process.cwd(), "public", "generated-videos"))
);

// Serve public chat uploads (images, video, audio) as URLs
app.use("/chat-uploads", express.static(path.join(process.cwd(), "public", "chat-uploads")));

// Logging middleware
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting (exclude Inngest endpoints and subscription token endpoint as they have their own rate limiting)
app.use((req, res, next) => {
  // Skip rate limiting for Inngest endpoints
  if (req.path.startsWith("/api/inngest")) {
    return next();
  }
  // Skip rate limiting for subscription token endpoint (needed for real-time updates, lightweight read operation)
  if (req.path === "/workflow/subscription-token") {
    return next();
  }
  return rateLimiter(req, res, next);
});

// Inngest endpoint (must be before other routes that might catch it)
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/webhooks", googleFormRouter);
app.use("/api/webhooks", airtableRouter);
app.use("/api/webhooks", stripeRouter);
app.use("/api/webhooks/telegram", telegramRouter);
app.use("/api/webhooks/webhook", webhookTriggerRouter);
app.use("/api/public/chat", publicChatRouter);

// API routes
// app.use('/health', healthRouter);
app.use("/user", userRouter);
app.use("/loyalty", loyaltyRouter);
app.use("/voucher", voucherRouter);
app.use("/deal", dealRouter);
app.use("/workflow", workflowRouter);
app.use("/workflow/airtable-webhook", airtableWebhookRouter);
app.use("/workflow-generation", workflowGenerationRouter);
app.use("/workflow-template", workflowTemplateRouter);
app.use("/planning", planningRouter);
app.use("/credential", credentialRouter);
app.use("/skill", skillRouter);
app.use("/connections", connectionRouter);
app.use("/api/auth/google", googleAuthRouter);
app.use("/api/elevenlabs", elevenlabsRouter);
app.use("/api/billing", billingStatusRouter);
// TODO: Re-enable when billing portal is properly designed
// app.use("/api/billing", billingPortalRouter);
app.use("/api/billing", billingCheckoutRouter);
app.use("/api/manual-payment", manualPaymentRouter);
app.use("/api/admin/manual-payments", adminManualPaymentsRouter);
app.use("/api/chat-integrations", chatIntegrationRouter);
app.use("/api/internal/whatsapp", internalWhatsAppRouter);
app.use("/api/internal/discord", internalDiscordRouter);

// Polar webhook handler – receives webhooks from Polar.
// Billing/status reads from THIS backend’s DB. For the UI to show premium after payment,
// Polar Dashboard webhook URL must point HERE, e.g. https://<BACKEND_HOST>/api/auth/polar/webhooks
// (not the Next.js app URL). If Polar sends to the Next app, the client DB is updated but
// billing/status reads backend DB → user still sees Free unless both use the same DB.

// POST handler for actual webhook events
// Polar sends: { type: "event.name", timestamp: "ISO", data: { ... } }
app.post("/api/auth/polar/webhooks", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const eventType = payload.type ?? payload.event_type;
    console.log(
      "[Polar Webhook] Backend received:",
      eventType,
      payload?.data?.id ?? payload?.id ?? "(no id)"
    );

    const {
      handleOrderPaid,
      handleOrderRefunded,
      handleSubscriptionCreated,
      handleSubscriptionActive,
      handleSubscriptionUpdated,
      handleSubscriptionCanceled,
      handleSubscriptionUncanceled,
      handleSubscriptionRevoked,
      handleSubscriptionPastDue,
      handleSubscriptionExpired,
      handleCustomerCreated,
      handleCustomerUpdated,
      handleCustomerDeleted,
      handleCustomerStateChanged,
    } = await import("./routes/polar-webhooks");

    switch (eventType) {
      case "order.paid":
        await handleOrderPaid(payload);
        break;
      case "order.refunded":
        await handleOrderRefunded(payload);
        break;
      case "subscription.created":
        await handleSubscriptionCreated(payload);
        break;
      case "subscription.active":
      case "subscription.activated":
        await handleSubscriptionActive(payload);
        break;
      case "subscription.updated":
        await handleSubscriptionUpdated(payload);
        break;
      case "subscription.canceled":
      case "subscription.cancelled":
        await handleSubscriptionCanceled(payload);
        break;
      case "subscription.uncanceled":
        await handleSubscriptionUncanceled(payload);
        break;
      case "subscription.revoked":
        await handleSubscriptionRevoked(payload);
        break;
      case "subscription.past_due":
        await handleSubscriptionPastDue(payload);
        break;
      case "subscription.expired":
        await handleSubscriptionExpired(payload);
        break;
      case "customer.created":
        await handleCustomerCreated(payload);
        break;
      case "customer.updated":
        await handleCustomerUpdated(payload);
        break;
      case "customer.deleted":
        await handleCustomerDeleted(payload);
        break;
      case "customer.state_changed":
        await handleCustomerStateChanged(payload);
        break;
      default:
        // checkout.*, order.created/updated, product.*, benefit.*, refund.*, organization.* – no plan change
        console.log(`[PolarWebhook] Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("[Backend] Error processing Polar webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process webhook",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// app.use('/api-key', apiKeyRouter);

// API Documentation - only for exact root path (must be after other routes)
app.use("/", swaggerUi.serve);
app.get(
  "/",
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Verxio API Documentation",
  })
);

// 404 handler for non-existent routes (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server

app.listen(serverPort, async () => {
  console.log(`🚀 Verxio API Server running on port ${serverPort}`);

  // Initialize cron scheduler for timed triggers
  await initializeCronScheduler();
});

export default app;
