import { revalidateTag, unstable_cache } from "next/cache";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Read-only client for public pages. Every read goes through Next's data
// cache (shared across serverless instances), so repeat views of the same
// page don't touch Neon — the DB bills per compute-hour and only scales to
// zero after ~5 idle minutes, so uncached traffic kept it awake around the
// clock (the Free plan's 100 CU-hours ran out on 2026-09-26 and took the
// site down). Admin pages, Server Actions and crons keep the uncached
// `prisma`; every write path calls invalidateDbCache() so publishes show up
// immediately rather than after the TTL.
export const DB_CACHE_TAG = "db";
const DB_CACHE_SECONDS = 15 * 60;
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

// The data cache stores JSON, which would turn Date fields into strings.
// Tag them on the way in and revive them on the way out.
function encodeDates(value: unknown): unknown {
  if (value instanceof Date) return { __date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeDates(v)]));
  }
  return value;
}

function decodeDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeDates);
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0][0] === "__date") return new Date(entries[0][1] as string);
    return Object.fromEntries(entries.map(([k, v]) => [k, decodeDates(v)]));
  }
  return value;
}

export const prismaCached = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!READ_OPERATIONS.has(operation)) return query(args);
        const load = unstable_cache(
          async () => encodeDates(await query(args)),
          ["prisma", model, operation, JSON.stringify(args ?? null)],
          { revalidate: DB_CACHE_SECONDS, tags: [DB_CACHE_TAG] }
        );
        return decodeDates(await load());
      },
    },
  },
});

export function invalidateDbCache() {
  revalidateTag(DB_CACHE_TAG, { expire: 0 });
}
