import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage();

export function createRequestMetrics(requestId) {
  return {
    requestId: requestId,
    dbDurationMs: 0,
    dbQueryCount: 0,
    dbMaxDurationMs: 0
  };
}

export function runWithRequestMetrics(metrics, handler) {
  return requestContext.run(metrics, handler);
}

export function runOutsideRequestMetrics(handler) {
  return requestContext.exit(handler);
}

export function getRequestMetrics() {
  return requestContext.getStore() || null;
}

export function recordPrismaQueryDuration(durationMs) {
  var metrics = getRequestMetrics();
  if (!metrics) return;
  var elapsed = Number.isFinite(durationMs) ? durationMs : 0;
  metrics.dbDurationMs += elapsed;
  metrics.dbQueryCount += 1;
  if (elapsed > metrics.dbMaxDurationMs) metrics.dbMaxDurationMs = elapsed;
}

export function roundMetric(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
