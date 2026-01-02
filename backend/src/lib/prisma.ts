import { PrismaClient as BackendPrismaClient } from '../../node_modules/.prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

const globalForPrisma = globalThis as unknown as {
  prisma: BackendPrismaClient | undefined;
};

// Create base Prisma client - use backendClient which has all models including workflow
const basePrisma: BackendPrismaClient = globalForPrisma.prisma ?? new BackendPrismaClient();

// Export base client for models not exposed by extension
export const basePrismaClient: BackendPrismaClient = basePrisma;

export const prisma: BackendPrismaClient = process.env.PRISMA_FIELD_ENCRYPTION_KEY
  ? basePrisma.$extends(
      fieldEncryptionExtension({
        encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
      })
    ) as BackendPrismaClient
  : basePrisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} else {
  globalForPrisma.prisma = prisma;
}

