import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Database access is optional: without DATABASE_URL the app runs fully
 * (browser-local save, lead logging) and every caller must handle null.
 */
declare global {
  var prismaClient: PrismaClient | null | undefined;
}

export function getDb(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (globalThis.prismaClient === undefined) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    globalThis.prismaClient = new PrismaClient({ adapter });
  }
  return globalThis.prismaClient ?? null;
}
