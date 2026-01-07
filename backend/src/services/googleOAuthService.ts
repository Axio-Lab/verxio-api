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
 * Store or update Google OAuth tokens for a user and credential
 */
export const storeGoogleOAuthToken = async (
  userId: string,
  credentialId: string,
  tokenData: GoogleOAuthTokenData
): Promise<void> => {
  const expiresAt = tokenData.expiresAt || null;

  await prismaClient.googleOAuthToken.upsert({
    where: {
      userId_credentialId: {
        userId,
        credentialId,
      },
    },
    update: {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || null,
      expiresAt,
      scope: tokenData.scope || null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      credentialId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || null,
      expiresAt,
      scope: tokenData.scope || null,
    },
  });
};

/**
 * Get Google OAuth tokens for a user and credential
 */
export const getGoogleOAuthToken = async (
  userId: string,
  credentialId: string
): Promise<GoogleOAuthTokenData | null> => {
  const token = await prismaClient.googleOAuthToken.findUnique({
    where: {
      userId_credentialId: {
        userId,
        credentialId,
      },
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
export const hasValidGoogleOAuthToken = async (
  userId: string,
  credentialId: string
): Promise<boolean> => {
  const token = await prismaClient.googleOAuthToken.findUnique({
    where: {
      userId_credentialId: {
        userId,
        credentialId,
      },
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
 */
export const refreshGoogleOAuthToken = async (
  userId: string,
  credentialId: string
): Promise<GoogleOAuthTokenData> => {
  // Get credential to access client ID and secret
  const credential = await prismaClient.credential.findUnique({
    where: { id: credentialId },
  });

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

  // Get current token
  const currentToken = await getGoogleOAuthToken(userId, credentialId);

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

    await storeGoogleOAuthToken(userId, credentialId, newTokenData);

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
 */
export const getValidAccessToken = async (
  userId: string,
  credentialId: string
): Promise<string> => {
  const isValid = await hasValidGoogleOAuthToken(userId, credentialId);

  if (isValid) {
    const token = await getGoogleOAuthToken(userId, credentialId);
    if (!token) {
      throw new AppError("Token not found", 404);
    }
    return token.accessToken;
  }

  // Token is expired or doesn't exist, try to refresh
  try {
    const refreshedToken = await refreshGoogleOAuthToken(userId, credentialId);
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
export const deleteGoogleOAuthToken = async (
  userId: string,
  credentialId: string
): Promise<void> => {
  await prismaClient.googleOAuthToken.deleteMany({
    where: {
      userId,
      credentialId,
    },
  });
};
