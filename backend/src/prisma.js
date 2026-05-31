import { PrismaClient } from "@prisma/client";

var globalForPrisma = globalThis;

export const prisma = globalForPrisma.__roofCalculatorPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__roofCalculatorPrisma = prisma;
}
