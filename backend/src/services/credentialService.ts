import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getSharedResourceIds, canAccessResource } from "./organizationService";

/**
 * Known credential types for validation and type safety
 * New types can be added here, but custom types are also supported
 */
export enum CredentialType {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  GEMINI = "GEMINI",
  TELEGRAM = "TELEGRAM",
  WHATSAPP = "WHATSAPP",
  AIRTABLE = "AIRTABLE",
  VALYU = "VALYU",
  TINYFISH = "TINYFISH",
}

/**
 * List of known credential types for validation
 * Custom types (not in this list) are also allowed
 */
export const KNOWN_CREDENTIAL_TYPES = Object.values(CredentialType);

/**
 * Validate credential type
 * Allows known types and custom string types (for future extensibility)
 */
export function isValidCredentialType(type: string): boolean {
  // Allow known types
  if (KNOWN_CREDENTIAL_TYPES.includes(type as CredentialType)) {
    return true;
  }

  // Explicitly allow "custom" or "CUSTOM" for custom credentials
  if (type.toLowerCase() === "custom") {
    return true;
  }

  // Allow custom types (must be uppercase, alphanumeric + underscore, 3-50 chars)
  const customTypePattern = /^[A-Z][A-Z0-9_]{2,49}$/;
  return customTypePattern.test(type);
}

// Use basePrismaClient for credential model
const prismaClient = basePrismaClient as any;

export interface CreateCredentialData {
  name: string;
  value: string;
  type: string; // Changed to string to support custom types
  userId: string;
}

export interface UpdateCredentialData {
  name?: string;
  value?: string;
  type?: string; // Changed to string to support custom types
}

export interface CredentialResponse {
  id: string;
  name: string;
  type: string; // Changed to string to support custom types
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialWithValueResponse extends CredentialResponse {
  // Alias for consistency - value is now included in CredentialResponse
}

export interface CredentialsListResponse {
  credentials: CredentialResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a new credential
 */
export const createCredential = async (data: CreateCredentialData): Promise<CredentialResponse> => {
  if (!data.name || data.name.trim() === "") {
    throw new AppError("Credential name is required", 400);
  }

  // WHATSAPP credentials get their "value" from linking a device via QR; placeholder is ok
  if (data.type !== CredentialType.WHATSAPP && (!data.value || data.value.trim() === "")) {
    throw new AppError("Credential value is required", 400);
  }

  if (!data.type) {
    throw new AppError("Credential type is required", 400);
  }

  if (!data.userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify user exists
  const user = await prismaClient.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Validate credential type (allows known types and custom types)
  if (!isValidCredentialType(data.type)) {
    throw new AppError(
      `Invalid credential type. Must be a known type (${KNOWN_CREDENTIAL_TYPES.join(", ")}) or a custom type (uppercase, alphanumeric + underscore, 3-50 chars)`,
      400
    );
  }

  const credential = await prismaClient.credential.create({
    data: {
      name: data.name.trim(),
      value:
        data.type === CredentialType.WHATSAPP ? data.value?.trim() || "linked" : data.value.trim(),
      type: data.type,
      userId: data.userId,
    },
  });

  // Return credential with value
  return {
    id: credential.id,
    name: credential.name,
    type: credential.type,
    value: credential.value,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
};

/**
 * Get credentials for a user with pagination and optional type filter
 * @param userId - The user ID
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 10)
 * @param type - Optional credential type filter
 */
export const getCredentials = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  type?: CredentialType
): Promise<CredentialsListResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const skip = (page - 1) * limit;
  const take = limit;

  // Include credentials shared with the user's organization
  const sharedIds = await getSharedResourceIds(userId, "CREDENTIAL");
  const ownershipFilter: any =
    sharedIds.length > 0 ? { OR: [{ userId }, { id: { in: sharedIds } }] } : { userId };

  const where: any = { ...ownershipFilter };
  if (type) {
    // Validate type if provided (allows known types and custom types)
    if (!isValidCredentialType(type)) {
      throw new AppError(
        `Invalid credential type. Must be a known type (${KNOWN_CREDENTIAL_TYPES.join(", ")}) or a custom type (uppercase, alphanumeric + underscore, 3-50 chars)`,
        400
      );
    }
    where.type = type;
  }

  // Get total count
  const total = await prismaClient.credential.count({ where });

  // Get credentials
  const credentials = await prismaClient.credential.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      value: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    credentials,
    total,
    page,
    limit,
    totalPages: totalPages || 1,
  };
};

/**
 * Get a single credential by ID (only if it belongs to the user)
 * Returns the value for editing purposes
 */
export const getCredential = async (
  id: string,
  userId: string
): Promise<CredentialWithValueResponse> => {
  if (!id) {
    throw new AppError("Credential ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  let credential = await prismaClient.credential.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      value: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!credential) {
    const access = await canAccessResource(userId, "CREDENTIAL", id);
    if (access.hasAccess) {
      credential = await prismaClient.credential.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          name: true,
          type: true,
          value: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
  }

  if (!credential) {
    throw new AppError("Credential not found", 404);
  }

  return credential;
};

/**
 * Update a credential
 */
export const updateCredential = async (
  id: string,
  userId: string,
  data: UpdateCredentialData
): Promise<CredentialResponse> => {
  if (!id) {
    throw new AppError("Credential ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  let existingCredential = await prismaClient.credential.findFirst({
    where: { id, userId },
  });

  if (!existingCredential) {
    const access = await canAccessResource(userId, "CREDENTIAL", id);
    if (access.hasAccess) {
      existingCredential = await prismaClient.credential.findUnique({ where: { id } });
    }
  }

  if (!existingCredential) {
    throw new AppError("Credential not found", 404);
  }

  // Validate credential type if provided (allows known types and custom types)
  if (data.type) {
    if (!isValidCredentialType(data.type)) {
      throw new AppError(
        `Invalid credential type. Must be a known type (${KNOWN_CREDENTIAL_TYPES.join(", ")}) or a custom type (uppercase, alphanumeric + underscore, 3-50 chars)`,
        400
      );
    }
  }

  // Build update data
  const updateData: any = {};
  if (data.name !== undefined) {
    if (data.name.trim() === "") {
      throw new AppError("Credential name cannot be empty", 400);
    }
    updateData.name = data.name.trim();
  }
  if (data.value !== undefined) {
    if (data.value.trim() === "") {
      throw new AppError("Credential value cannot be empty", 400);
    }
    updateData.value = data.value.trim();
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }

  const credential = await prismaClient.credential.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      type: true,
      value: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return credential;
};

/**
 * Delete a credential
 */
export const deleteCredential = async (id: string, userId: string): Promise<void> => {
  if (!id) {
    throw new AppError("Credential ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Check if credential exists and belongs to user
  const existingCredential = await prismaClient.credential.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingCredential) {
    throw new AppError("Credential not found", 404);
  }

  // Check if credential is being used by any nodes
  const nodesUsingCredential = await prismaClient.node.findMany({
    where: {
      credentialId: id,
    },
    take: 1,
  });

  if (nodesUsingCredential.length > 0) {
    throw new AppError(
      "Cannot delete credential. It is currently being used by one or more workflow nodes.",
      400
    );
  }

  await prismaClient.credential.delete({
    where: { id },
  });
};
