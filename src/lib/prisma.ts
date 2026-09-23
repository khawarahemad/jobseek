import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Executes a Prisma query with automatic retry on transient connection drops
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 300
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = (err as Error)?.message || "";
      const isConnError =
        msg.includes("Can't reach database server") ||
        msg.includes("connection pool") ||
        msg.includes("P1001") ||
        msg.includes("P2024") ||
        msg.includes("ECONNRESET") ||
        msg.includes("closed early");

      if (isConnError && attempt < retries) {
        console.warn(`[Prisma] Reconnecting to DB (attempt ${attempt + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

