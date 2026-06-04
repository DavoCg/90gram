// Singleton PrismaClient for the whole app. Consumers import from "@getvinyls/db",
// never from the generated path. The model is named `Record` in Prisma; we re-export
// its row type as `RecordRow` to avoid shadowing the built-in TS `Record<K, V>` utility.
//
// Prisma 7 requires a driver adapter for the runtime connection. We use the pg adapter,
// built from DATABASE_URL. Load env before importing this module (e.g. dotenv/config).
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import type { Record as RecordRow, Prisma } from './generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Load your environment before importing @getvinyls/db.');
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type { RecordRow, Prisma };
