import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

// Node 24's native WebSocket handshake fails against Neon in this
// environment ("ErrorEvent"/1006). The `ws` package works reliably and must
// be registered before the adapter creates its pool.
neonConfig.webSocketConstructor = ws;

// Long-running Express server -> direct (non-pooler) endpoint is the most
// stable. Set PRISMA_USE_POOLED=true to use the pooler instead (serverless).
const connectionString =
  process.env.PRISMA_USE_POOLED === "true"
    ? process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter });

/**
 * Neon suspends idle computes, so the first connection after a pause can
 * fail with ETIMEDOUT/ErrorEvent. Retry with backoff before giving up.
 */
export async function connectWithRetry(attempts = 6, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Neon connection attempt ${attempt}/${attempts} failed: ${message || "ErrorEvent"}`
      );
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
