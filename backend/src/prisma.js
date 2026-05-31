import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { recordPrismaQueryDuration } from "./requestContext.js";

var globalForPrisma = globalThis;

function createInstrumentedPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ query, args }) {
        var startedAt = performance.now();
        try {
          return await query(args);
        } finally {
          recordPrismaQueryDuration(performance.now() - startedAt);
        }
      }
    }
  });
}

export const prisma = globalForPrisma.__roofCalculatorPrisma || createInstrumentedPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__roofCalculatorPrisma = prisma;
}
