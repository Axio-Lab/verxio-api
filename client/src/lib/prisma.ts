import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client for Better Auth
// This uses the Prisma schema from the root directory (../prisma/schema.prisma)
// The Prisma client is generated from the root schema which includes Better Auth models
// Note: This uses the same database as the backend but doesn't need field encryption
// since Better Auth handles its own security
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // Use DATABASE_URL from environment (should be in .env.local)
  // This should point to the same database as the backend
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} else {
  globalForPrisma.prisma = prisma;
}

