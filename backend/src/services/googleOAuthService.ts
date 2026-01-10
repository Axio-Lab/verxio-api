import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { OAuth2Client } from "google-auth-library";

const prismaClient = basePrismaClient as any;

export interface GoogleOAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

/**
 * Store or update Google OAuth tokens for a user
 */
export const storeGoogleOAuthToken = async (
  userId: string,
  tokenData: GoogleOAuthTokenData
): Promise<void> => {
  const expiresAt = tokenData.expiresAt || null;

  // Use findFirst to check if token exists, then create or update
  const existingToken = await prismaClient.googleOAuthToken.findFirst({
    where: { userId },
  });

  if (existingToken) {
    await prismaClient.googleOAuthToken.update({
      where: { id: existingToken.id },
      data: {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        expiresAt,
        scope: tokenData.scope || null,
        updatedAt: new Date(),
      },
    });
  } else {
    await prismaClient.googleOAuthToken.create({
      data: {
        userId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        expiresAt,
        scope: tokenData.scope || null,
      },
    });
  }
};

/**
 * Get Google OAuth tokens for a user
 */
export const getGoogleOAuthToken = async (userId: string): Promise<GoogleOAuthTokenData | null> => {
  // Use findFirst instead of findUnique since unique constraint is on userId
  const token = await prismaClient.googleOAuthToken.findFirst({
    where: {
      userId: userId,
    },
  });

  if (!token) {
    return null;
  }

  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken || undefined,
    expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined,
    scope: token.scope || undefined,
  };
};

/**
 * Check if token exists and is valid (not expired)
 */
export const hasValidGoogleOAuthToken = async (userId: string): Promise<boolean> => {
  // Use findFirst instead of findUnique since unique constraint is on userId
  const token = await prismaClient.googleOAuthToken.findFirst({
    where: {
      userId: userId,
    },
  });

  if (!token) {
    return false;
  }

  // If no expiry date, assume it's valid (some tokens don't expire)
  if (!token.expiresAt) {
    return true;
  }

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(token.expiresAt);
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds

  return expiresAt.getTime() > now.getTime() + buffer;
};

/**
 * Refresh Google OAuth token using refresh token
 * Uses env-based GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 */
export const refreshGoogleOAuthToken = async (userId: string): Promise<GoogleOAuthTokenData> => {
  // Get client ID and secret from environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new AppError(
      "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
      500
    );
  }

  // Get current token
  const currentToken = await getGoogleOAuthToken(userId);

  if (!currentToken || !currentToken.refreshToken) {
    throw new AppError("No refresh token available. Please reconnect.", 400);
  }

  // Create OAuth2 client
  const oauth2Client = new OAuth2Client(clientId, clientSecret);

  // Refresh the token
  oauth2Client.setCredentials({
    refresh_token: currentToken.refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token");
    }

    // Calculate expiry date
    const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : undefined;

    // Store the new token
    const newTokenData: GoogleOAuthTokenData = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || currentToken.refreshToken,
      expiresAt,
      scope: credentials.scope || currentToken.scope,
    };

    await storeGoogleOAuthToken(userId, newTokenData);

    return newTokenData;
  } catch (error) {
    throw new AppError(
      `Failed to refresh token: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
};

/**
 * Get a valid access token, refreshing if necessary
 * Uses env-based GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 */
export const getValidAccessToken = async (userId: string): Promise<string> => {
  const isValid = await hasValidGoogleOAuthToken(userId);

  if (isValid) {
    const token = await getGoogleOAuthToken(userId);
    if (!token) {
      throw new AppError("Token not found", 404);
    }
    return token.accessToken;
  }

  // Token is expired or doesn't exist, try to refresh
  try {
    const refreshedToken = await refreshGoogleOAuthToken(userId);
    return refreshedToken.accessToken;
  } catch (error) {
    // If refresh fails, throw error asking user to reconnect
    throw new AppError(
      "Token expired and refresh failed. Please reconnect your Google account.",
      401
    );
  }
};

/**
 * Delete Google OAuth token
 */
export const deleteGoogleOAuthToken = async (userId: string): Promise<void> => {
  await prismaClient.googleOAuthToken.deleteMany({
    where: {
      userId,
    },
  });
};
