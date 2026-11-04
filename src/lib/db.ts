import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  // Neon sospende il compute quando è inattivo: il risveglio può superare il maxWait di default (2s)
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 15_000, timeout: 20_000 } });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
