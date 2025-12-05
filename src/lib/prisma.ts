import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient().$extends(
  fieldEncryptionExtension({
    encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY!,
  })
);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma as PrismaClient;
} else {
  globalForPrisma.prisma = prisma as PrismaClient;
}

