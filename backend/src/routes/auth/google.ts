import { Router, Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { betterAuthMiddleware } from "../../middleware/betterAuth";
import { AppError } from "../../middleware/errorHandler";
import {
  storeGoogleOAuthToken,
  deleteGoogleOAuthToken,
  getGoogleOAuthToken,
} from "../../services/googleOAuthService";

export const googleAuthRouter: Router = Router();

/**
 * Handle Google OAuth callback (PUBLIC - no auth required, validated via state parameter)
 * GET /api/auth/google/callback?code=xxx&state=xxx
 * This route must be public because Google redirects here without auth headers
 */
googleAuthRouter.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      throw new AppError("Authorization code is required", 400);
    }

    if (!state || typeof state !== "string") {
      throw new AppError("State parameter is required", 400);
    }

    // Parse state to get userId and optional returnUrl
    // credentialId removed - using env-based OAuth credentials
    let stateData: { userId: string; returnUrl?: string };
    try {
      stateData = JSON.parse(state);
    } catch (error) {
      throw new AppError("Invalid state parameter", 400);
    }

    const { userId, returnUrl } = stateData;

    // Get client ID and secret from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new AppError(
        "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
        500
      );
    }

    // Get redirect URI - should be the backend API URL (must match connect route)
    const baseUrl = process.env.API_URL;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new AppError("Failed to get access token from Google", 500);
    }

    // Calculate expiry date
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    // Store tokens (no credentialId needed - using env-based OAuth)
    await storeGoogleOAuthToken(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
      scope: tokens.scope || undefined,
    });

    // Redirect back to the original page or default to credentials page
    const frontendUrl = process.env.FRONTEND_URL;
    let redirectUrl: string;
    if (returnUrl) {
      // returnUrl is a relative path (e.g., /workflows/cmjzno4u80001zqe9qprto8kq)
      // Construct full URL with frontendUrl
      const url = new URL(returnUrl, frontendUrl);

      // Set or update google_connected parameter (removes duplicates)
      url.searchParams.set("google_connected", "true");
      redirectUrl = url.toString();
    } else {
      redirectUrl = `${frontendUrl}/credentials?google_connected=true`;
    }

    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
});

// Apply Better Auth middleware to protected routes (connect, status, disconnect)
googleAuthRouter.use(betterAuthMiddleware);

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google/connect
 * Uses env-based GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 */
googleAuthRouter.get("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    // Get client ID and secret from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new AppError(
        "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
        500
      );
    }

    // Get redirect URI from environment - should be the backend API URL
    const baseUrl = process.env.API_URL;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    // Generate auth URL
    const scopes = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/meetings.space.created",
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
    ];

    // Get returnUrl from query parameter (current page URL)
    const returnUrl = req.query.returnUrl as string | undefined;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Request refresh token
      scope: scopes,
      prompt: "consent", // Force consent screen to get refresh token
      state: JSON.stringify({
        userId: user.id,
        returnUrl: returnUrl || undefined,
      }),
    });

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check connection status
 * GET /api/auth/google/status
 * Uses env-based OAuth credentials
 */
googleAuthRouter.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const token = await getGoogleOAuthToken(user.id);

    res.json({
      success: true,
      connected: !!token,
      hasRefreshToken: !!token?.refreshToken,
      expiresAt: token?.expiresAt || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect Google account
 * DELETE /api/auth/google/disconnect
 * Uses env-based OAuth credentials
 */
googleAuthRouter.delete("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    await deleteGoogleOAuthToken(user.id);

    res.json({
      success: true,
      message: "Google account disconnected successfully",
    });
  } catch (error) {
    next(error);
  }
});
