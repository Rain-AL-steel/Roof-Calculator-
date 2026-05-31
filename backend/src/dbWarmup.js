import { performance } from "node:perf_hooks";
import { prisma as defaultPrisma } from "./prisma.js";
import { roundMetric } from "./requestContext.js";

export const DB_WARMUP_MAX_ATTEMPTS = 3;
export const DB_WARMUP_RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function getErrorCode(error) {
  return error && error.code ? String(error.code).slice(0, 80) : "DATABASE_UNAVAILABLE";
}

function getWarmupLog(base) {
  return JSON.stringify(Object.assign({
    type: "db_warmup",
    timestamp: new Date().toISOString()
  }, base));
}

export async function warmDatabase(options) {
  var settings = options || {};
  var prisma = settings.prisma || defaultPrisma;
  var logger = settings.logger || console;
  var maxAttempts = settings.maxAttempts || DB_WARMUP_MAX_ATTEMPTS;
  var retryDelayMs = settings.retryDelayMs === undefined ? DB_WARMUP_RETRY_DELAY_MS : settings.retryDelayMs;

  for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
    var startedAt = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info(getWarmupLog({
        ok: true,
        attempt: attempt,
        dbMs: roundMetric(performance.now() - startedAt)
      }));
      return { ok: true, attempt: attempt };
    } catch (error) {
      logger.warn(getWarmupLog({
        ok: false,
        attempt: attempt,
        dbMs: roundMetric(performance.now() - startedAt),
        code: getErrorCode(error),
        message: "Database unavailable"
      }));
      if (attempt < maxAttempts) await sleep(retryDelayMs);
    }
  }

  return { ok: false, attempt: maxAttempts };
}
