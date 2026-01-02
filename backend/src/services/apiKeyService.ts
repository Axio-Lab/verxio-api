import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';

// Type assertion for extended Prisma client to access apiKey model
// The extended client type doesn't properly expose new models, so we use a type assertion
const prismaClient = prisma as any;

export interface GenerateApiKeyData {
  email: string;
  name?: string;
}

export interface RevokeApiKeyData {
  email: string;
  apiKeyId: string;
}

/**
 * Generate a secure API key
 */
const generateSecureApiKey = (): string => {
  // Generate a 64-character hex string (32 bytes)
  const randomBytes = crypto.randomBytes(32);
  return `vx_${randomBytes.toString('hex')}`;
};

/**
 * Generate a new API key for a user
 */
export const generateApiKey = async (data: GenerateApiKeyData) => {
  const { email, name } = data;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400);
  }

  // Check if user exists
  const user = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Generate API key
  const apiKey = generateSecureApiKey();

  // Store API key in database
  const createdApiKey = await prismaClient.apiKey.create({
    data: {
      key: apiKey,
      userId: user.id,
      name: name || `API Key for ${email}`,
      isActive: true,
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    apiKey: createdApiKey,
    message: 'API key generated successfully. Store this key securely - it will not be shown again.',
  };
};

/**
 * List all API keys for a user
 */
export const listApiKeys = async (email: string) => {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Check if user exists
  const user = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Get all API keys for the user (without showing the full key)
  const apiKeys = await prismaClient.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      key: true, // Show masked version in list
      name: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Mask the API keys for security (show only first 8 and last 4 characters)
  const maskedApiKeys = apiKeys.map((key: { key: string; id: string; name: string | null; isActive: boolean; lastUsedAt: Date | null; createdAt: Date }) => ({
    ...key,
    key: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`,
  }));

  return {
    success: true,
    apiKeys: maskedApiKeys,
  };
};

/**
 * Revoke (deactivate) an API key
 */
export const revokeApiKey = async (data: RevokeApiKeyData) => {
  const { email, apiKeyId } = data;

  if (!email || !apiKeyId) {
    throw new AppError('Email and API key ID are required', 400);
  }

  // Check if user exists
  const user = await prisma.verxioUser.findFirst({
    where: { email },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if API key exists and belongs to the user
  const apiKey = await prismaClient.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId: user.id,
    },
  });

  if (!apiKey) {
    throw new AppError('API key not found', 404);
  }

  // Deactivate the API key
  await prismaClient.apiKey.update({
    where: { id: apiKeyId },
    data: { isActive: false },
  });

  return {
    success: true,
    message: 'API key revoked successfully',
  };
};

/**
 * Validate API key and return user info
 */
export const validateApiKey = async (apiKey: string) => {
  const key = await prismaClient.apiKey.findFirst({
    where: {
      key: apiKey,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!key) {
    return null;
  }

  // Update last used timestamp
  await prismaClient.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return key.user;
};

