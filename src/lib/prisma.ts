import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function initPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Proxy wrapper ensures that if new models (e.g. aiChatMessage, aiChatSession) are accessed,
// it auto-reconnects to a fresh PrismaClient if the cached client is stale.
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (
      !globalForPrisma.prisma ||
      (typeof prop === 'string' && !prop.startsWith('$') && !prop.startsWith('_') && !(globalForPrisma.prisma as any)[prop])
    ) {
      globalForPrisma.prisma = initPrismaClient();
    }
    const instance = globalForPrisma.prisma as any;
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

if (process.env.NODE_ENV !== 'production' && !globalForPrisma.prisma) {
  globalForPrisma.prisma = initPrismaClient();
}

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
