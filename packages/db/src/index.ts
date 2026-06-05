// Singleton PrismaClient for the whole app. Consumers import from "@getvinyls/db",
// never from the generated path. Row types are re-exported with a `Row` suffix.
//
// Prisma 7 requires a driver adapter for the runtime connection. We use the pg adapter,
// built from DATABASE_URL. Load env before importing this module (e.g. dotenv/config).
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import type {
  Vinyl as VinylRow,
  Track as TrackRow,
  Shop as ShopRow,
  ShopVinyl as ShopVinylRow,
  Offer as OfferRow,
  Price as PriceRow,
  Genre as GenreRow,
  VinylGenre as VinylGenreRow,
  Favorite as FavoriteRow,
  Prisma,
} from './generated/prisma/client.js';
import { StockStatus } from './generated/prisma/enums.js';

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

export { PrismaClient, StockStatus };
export type {
  VinylRow,
  TrackRow,
  ShopRow,
  ShopVinylRow,
  OfferRow,
  PriceRow,
  GenreRow,
  VinylGenreRow,
  FavoriteRow,
  Prisma,
};
