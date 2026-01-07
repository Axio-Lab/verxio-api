import { Router, Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { betterAuthMiddleware } from "../../middleware/betterAuth";
import { AppError } from "../../middleware/errorHandler";
import {
  storeGoogleOAuthToken,
  deleteGoogleOAuthToken,
  getGoogleOAuthToken,
} from "../../services/googleOAuthService";
import { getCredential } from "../../services/credentialService";

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

    // Parse state to get credentialId, userId, and optional returnUrl
    let stateData: { credentialId: string; userId: string; returnUrl?: string };
    try {
      stateData = JSON.parse(state);
    } catch (error) {
      throw new AppError("Invalid state parameter", 400);
    }

    const { credentialId, userId, returnUrl } = stateData;

    // Get credential to access client ID and secret
    const credential = await getCredential(credentialId, userId);

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    if (credential.type !== "GOOGLE_OAUTH") {
      throw new AppError("Credential is not a Google OAuth credential", 400);
    }

    // Parse credential value
    let clientId: string;
    let clientSecret: string;
    try {
      const credentialData = JSON.parse(credential.value);
      clientId = credentialData.clientId;
      clientSecret = credentialData.clientSecret;

      if (!clientId || !clientSecret) {
        throw new Error("Missing clientId or clientSecret");
      }
    } catch (error) {
      throw new AppError(
        "Invalid credential format. Expected JSON with clientId and clientSecret.",
        400
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

    // Store tokens
    await storeGoogleOAuthToken(userId, credentialId, {
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
 * GET /api/auth/google/connect?credentialId=xxx
 */
googleAuthRouter.get("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId query parameter is required", 400);
    }

    // Get credential to access client ID and secret
    const credential = await getCredential(credentialId, user.id);

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    if (credential.type !== "GOOGLE_OAUTH") {
      throw new AppError("Credential is not a Google OAuth credential", 400);
    }

    // Parse credential value (should contain clientId and clientSecret)
    let clientId: string;
    let clientSecret: string;
    try {
      const credentialData = JSON.parse(credential.value);
      clientId = credentialData.clientId;
      clientSecret = credentialData.clientSecret;

      if (!clientId || !clientSecret) {
        throw new Error("Missing clientId or clientSecret");
      }
    } catch (error) {
      throw new AppError(
        "Invalid credential format. Expected JSON with clientId and clientSecret.",
        400
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
    ];

    // Get returnUrl from query parameter (current page URL)
    const returnUrl = req.query.returnUrl as string | undefined;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Request refresh token
      scope: scopes,
      prompt: "consent", // Force consent screen to get refresh token
      state: JSON.stringify({
        credentialId,
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
 * Handle Google OAuth callback
 * GET /api/auth/google/callback?code=xxx&state=xxx
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

    // Parse state to get credentialId and userId
    let stateData: { credentialId: string; userId: string };
    try {
      stateData = JSON.parse(state);
    } catch (error) {
      throw new AppError("Invalid state parameter", 400);
    }

    const { credentialId, userId } = stateData;

    // Get credential to access client ID and secret
    const credential = await getCredential(credentialId, userId);

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    if (credential.type !== "GOOGLE_OAUTH") {
      throw new AppError("Credential is not a Google OAuth credential", 400);
    }

    // Parse credential value
    let clientId: string;
    let clientSecret: string;
    try {
      const credentialData = JSON.parse(credential.value);
      clientId = credentialData.clientId;
      clientSecret = credentialData.clientSecret;

      if (!clientId || !clientSecret) {
        throw new Error("Missing clientId or clientSecret");
      }
    } catch (error) {
      throw new AppError(
        "Invalid credential format. Expected JSON with clientId and clientSecret.",
        400
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

    // Store tokens
    await storeGoogleOAuthToken(userId, credentialId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
      scope: tokens.scope || undefined,
    });

    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/credentials?google_connected=true`);
  } catch (error) {
    next(error);
  }
});

/**
 * Check connection status
 * GET /api/auth/google/status?credentialId=xxx
 */
googleAuthRouter.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId query parameter is required", 400);
    }

    const token = await getGoogleOAuthToken(user.id, credentialId);

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
 * DELETE /api/auth/google/disconnect?credentialId=xxx
 */
googleAuthRouter.delete("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { credentialId } = req.query;

    if (!credentialId || typeof credentialId !== "string") {
      throw new AppError("credentialId query parameter is required", 400);
    }

    await deleteGoogleOAuthToken(user.id, credentialId);

    res.json({
      success: true,
      message: "Google account disconnected successfully",
    });
  } catch (error) {
    next(error);
  }
});
