import { PrismaClient as BackendPrismaClient } from "../../node_modules/.prisma/client/index";
import { fieldEncryptionExtension } from "prisma-field-encryption";

const globalForPrisma = globalThis as unknown as {
  prisma: BackendPrismaClient | undefined;
};

// Create base Prisma client - use backendClient which has all models including workflow
const basePrisma: BackendPrismaClient = globalForPrisma.prisma ?? new BackendPrismaClient();

// Apply encryption extension to base client if encryption key is available
export const basePrismaClient: BackendPrismaClient = process.env.PRISMA_FIELD_ENCRYPTION_KEY
  ? (basePrisma.$extends(
      fieldEncryptionExtension({
        encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
      })
    ) as BackendPrismaClient)
  : basePrisma;

export const prisma: BackendPrismaClient = basePrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  globalForPrisma.prisma = prisma;
}
