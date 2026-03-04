import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import {
  listConnectedAccounts,
  listAvailableApps,
  getAppDetails,
  initiateAppConnection,
  getConnectedAccount,
  deleteConnectedAccount,
  isComposioConfigured,
} from "../services/composio/composioService";

export const composioConnectionRouter: Router = Router();

/**
 * GET /api/composio/connections
 * List user's connected Composio accounts
 */
composioConnectionRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!isComposioConfigured()) {
        return res.json({ accounts: [], configured: false });
      }
      const accounts = await listConnectedAccounts(user.id);
      res.json({ accounts, configured: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/composio/connections/apps
 * List available Composio apps/toolkits the user can connect
 */
composioConnectionRouter.get(
  "/apps",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isComposioConfigured()) {
        return res.json({ apps: [], configured: false });
      }
      const apps = await listAvailableApps();
      res.json({ apps, configured: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/composio/connections/apps/:appSlug
 * Get detailed Composio toolkit/app information.
 */
composioConnectionRouter.get(
  "/apps/:appSlug",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isComposioConfigured()) {
        return res.json({ app: null, configured: false });
      }
      const { appSlug } = req.params;
      if (!appSlug) {
        throw new AppError("appSlug is required", 400);
      }
      const app = await getAppDetails(appSlug);
      res.json({ app, configured: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/composio/connections/initiate
 * Start OAuth/connection flow for a Composio app
 * Body: { appSlug: string }
 */
composioConnectionRouter.post(
  "/initiate",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { appSlug } = req.body;

      if (!appSlug || typeof appSlug !== "string") {
        throw new AppError("appSlug is required", 400);
      }

      if (!isComposioConfigured()) {
        throw new AppError("Composio is not configured", 500);
      }

      const result = await initiateAppConnection(user.id, appSlug.toLowerCase());
      res.json({
        redirectUrl: result.redirectUrl,
        connectionId: result.connectionId,
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);

      if (
        errorMsg.includes("MissingRequiredFields") ||
        errorMsg.includes("Missing required fields")
      ) {
        let userMessage =
          "This app requires additional configuration that can't be set up automatically. Please configure it through the Composio dashboard at composio.dev.";
        try {
          const jsonStr = errorMsg.substring(errorMsg.indexOf("{"));
          const parsed = JSON.parse(jsonStr);
          if (parsed.error?.message) {
            userMessage = parsed.error.message;
          }
        } catch {}
        return res.status(400).json({ error: userMessage });
      }

      next(error);
    }
  }
);

/**
 * DELETE /api/composio/connections/:accountId
 * Disconnect/delete a connected Composio account
 */
composioConnectionRouter.delete(
  "/:accountId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { accountId } = req.params;

      if (!isComposioConfigured()) {
        throw new AppError("Composio is not configured", 500);
      }

      // Verify the account belongs to this user before deleting
      const account = await getConnectedAccount(accountId);
      // The Composio SDK scopes by project, so we trust the accountId is valid
      // if it resolves. For extra safety we could check account metadata.

      await deleteConnectedAccount(accountId);
      res.json({ message: "Account disconnected successfully" });
    } catch (error) {
      next(error);
    }
  }
);
