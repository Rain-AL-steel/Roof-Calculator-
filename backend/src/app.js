import express from "express";
import cors from "cors";
import { prisma as defaultPrisma } from "./prisma.js";
import { buildOrderPayload, createOrderNo, getOrderInclude, toFrontendOrder } from "./orderMapper.js";

const DEFAULT_CORS_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173"
];

function parseCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function createCorsOptions() {
  var origins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (!origins.length) origins = DEFAULT_CORS_ORIGINS;
  var allowAll = origins.indexOf("*") !== -1;

  return {
    origin: function (origin, callback) {
      if (!origin || allowAll || origins.indexOf(origin) !== -1) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin is not allowed."));
    }
  };
}

function asyncHandler(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'`<>]+/gi, "[redacted-postgres-url]")
    .replace(/\bDATABASE_URL\s*=\s*[^\s]+/gi, "DATABASE_URL=[redacted]")
    .replace(/(password=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(\/\/[^:\s/]+:)[^@\s/]+(@)/g, "$1[redacted]$2")
    .slice(0, 600);
}

function getSafeErrorLog(error, req) {
  return {
    name: error && error.name ? error.name : "Error",
    code: error && error.code ? error.code : undefined,
    method: req && req.method,
    path: req && (req.originalUrl || req.url),
    payload: req && req.safePayloadSummary ? req.safePayloadSummary : undefined,
    message: redactSensitiveText(error && error.message ? error.message : "Unexpected error")
  };
}

function compactLogText(value) {
  return redactSensitiveText(String(value || "").replace(/\s+/g, " ").trim()).slice(0, 120);
}

function getArrayCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function getOrderPayloadSummary(input) {
  var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  var items = source.items && typeof source.items === "object" && !Array.isArray(source.items) ? source.items : {};
  var totals = source.totals && typeof source.totals === "object" && !Array.isArray(source.totals) ? source.totals : {};
  var completionMonth = compactLogText(source.completionMonth);
  return {
    customerName: compactLogText(source.customerName),
    orderDate: compactLogText(source.orderDate),
    completionMonthEmpty: !completionMonth,
    itemCounts: {
      mainRows: getArrayCount(items.mainRows || source.mainRows),
      accessories: getArrayCount(items.accessories || source.accessories),
      steels: getArrayCount(items.steels || source.steels),
      otherTiles: getArrayCount(items.otherTiles || source.otherTiles)
    },
    totalsKeys: Object.keys(totals).slice(0, 20)
  };
}

function getClientOrderId(input) {
  var clientOrderId = input && input.clientOrderId !== undefined && input.clientOrderId !== null ? String(input.clientOrderId).trim() : "";
  var id = input && input.id !== undefined && input.id !== null ? String(input.id).trim() : "";
  return clientOrderId || id || null;
}

function createHttpError(statusCode, code, message) {
  var error = new Error(message);
  error.name = "HttpError";
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function isTransactionTimeoutError(error) {
  return Boolean(error && error.code === "P2028");
}

function isRetryableDatabaseError(error) {
  if (isTransactionTimeoutError(error)) return false;
  var retryableCodes = {
    P1001: true,
    P2024: true
  };
  if (error && error.code && retryableCodes[error.code]) return true;
  if (error && error.name === "PrismaClientInitializationError") return true;

  var message = redactSensitiveText(error && error.message ? error.message : "");
  return /timeout|timed out|can't reach|cannot reach|connection|connect|connection terminated|econnreset|econnrefused|etimedout|socket|closed|terminat|pool/i.test(message);
}

function getRetryLog(error, operation, attempt, delayMs) {
  return {
    operation: operation,
    attempt: attempt,
    nextDelayMs: delayMs,
    name: error && error.name ? error.name : "Error",
    code: error && error.code ? error.code : undefined,
    message: redactSensitiveText(error && error.message ? error.message : "Unexpected database error")
  };
}

async function withDatabaseRetry(operation, handler) {
  var maxAttempts = 3;
  var delays = [1000, 2000];
  var attempt = 1;

  while (attempt <= maxAttempts) {
    try {
      return await handler();
    } catch (error) {
      var isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt || !isRetryableDatabaseError(error)) {
        throw error;
      }

      var delayMs = delays[attempt - 1] || 2000;
      console.warn("[db-retry]", getRetryLog(error, operation, attempt, delayMs));
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function createRequestOrderId() {
  var cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "order-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function isUniqueConstraintError(error) {
  return Boolean(error && error.code === "P2002");
}

function attachDetailCreates(data, payload) {
  var next = Object.assign({}, data);
  if (payload.mainRows.length) next.mainRows = { create: payload.mainRows };
  if (payload.lineItems.length) next.lineItems = { create: payload.lineItems };
  return next;
}

function attachOrderIdToRows(rows, orderId) {
  return rows.map(function (row) {
    return Object.assign({ orderId: orderId }, row);
  });
}

function getErrorResponse(error) {
  if (error && error.statusCode >= 400 && error.statusCode < 500) {
    return {
      statusCode: error.statusCode,
      body: {
        code: error.code || "INVALID_REQUEST",
        message: redactSensitiveText(error.message || "Request payload is invalid.")
      }
    };
  }

  if (error && error.name === "PrismaClientValidationError") {
    return {
      statusCode: 400,
      body: {
        code: "PRISMA_VALIDATION_ERROR",
        message: "Order payload does not match the database schema."
      }
    };
  }

  if (isTransactionTimeoutError(error)) {
    return {
      statusCode: 503,
      body: {
        code: "DATABASE_TRANSACTION_TIMEOUT",
        message: "Database transaction timed out."
      }
    };
  }

  if (isRetryableDatabaseError(error)) {
    return {
      statusCode: 503,
      body: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database is temporarily unavailable. Please retry shortly."
      }
    };
  }

  if (isUniqueConstraintError(error)) {
    return {
      statusCode: 409,
      body: {
        code: "PRISMA_UNIQUE_CONSTRAINT",
        message: "A unique database constraint was violated."
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error while processing the request."
    }
  };
}

async function findOrderByClientOrderId(prisma, clientOrderId) {
  if (!clientOrderId) return null;
  return prisma.order.findUnique({
    where: { clientOrderId: clientOrderId },
    include: getOrderInclude()
  });
}

async function upsertMapLocation(prisma, orderInput, location) {
  if (!location) return null;
  var normalizedAddress = location.formattedAddress || location.address || orderInput.deliveryAddress || "";
  normalizedAddress = String(normalizedAddress || "").trim();
  if (!normalizedAddress) return null;

  var cityHint = String(location.city || location.adcode || "").trim();
  var geocodedAt = location.geocodedAt ? new Date(location.geocodedAt) : new Date();

  return prisma.mapLocationCache.upsert({
    where: {
      provider_cityHint_normalizedAddress: {
        provider: "AMAP",
        cityHint: cityHint,
        normalizedAddress: normalizedAddress
      }
    },
    update: {
      sourceAddress: String(orderInput.deliveryAddress || normalizedAddress || "").trim(),
      formattedAddress: location.formattedAddress || null,
      province: location.province || null,
      city: location.city || null,
      district: location.district || null,
      adcode: location.adcode || null,
      lng: location.lng,
      lat: location.lat,
      status: "RESOLVED",
      errorMessage: null,
      geocodedAt: Number.isNaN(geocodedAt.getTime()) ? new Date() : geocodedAt
    },
    create: {
      provider: "AMAP",
      cityHint: cityHint,
      sourceAddress: String(orderInput.deliveryAddress || normalizedAddress || "").trim(),
      normalizedAddress: normalizedAddress,
      formattedAddress: location.formattedAddress || null,
      province: location.province || null,
      city: location.city || null,
      district: location.district || null,
      adcode: location.adcode || null,
      lng: location.lng,
      lat: location.lat,
      status: "RESOLVED",
      geocodedAt: Number.isNaN(geocodedAt.getTime()) ? new Date() : geocodedAt
    }
  });
}

async function attachMapLocationAfterSave(prisma, operation, input, payload, savedOrder) {
  if (!payload.deliveryLocation) return savedOrder;
  try {
    var mapLocation = await upsertMapLocation(prisma, input, payload.deliveryLocation);
    if (!mapLocation) return savedOrder;
    return await prisma.order.update({
      where: { id: savedOrder.id },
      data: { mapLocationCacheId: mapLocation.id },
      include: getOrderInclude()
    });
  } catch (error) {
    console.warn("[map-location-skip]", {
      operation: operation,
      orderId: savedOrder && savedOrder.id,
      name: error && error.name ? error.name : "Error",
      code: error && error.code ? error.code : undefined,
      message: redactSensitiveText(error && error.message ? error.message : "Map location save failed.")
    });
    return savedOrder;
  }
}

export function createApp(options) {
  var prisma = options && options.prisma ? options.prisma : defaultPrisma;
  var app = express();

  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", function (req, res) {
    res.json({ ok: true, service: "roof-calculator-api" });
  });

  app.get("/api/orders", asyncHandler(async function (req, res) {
    var orders = await withDatabaseRetry("GET /api/orders", function () {
      return prisma.order.findMany({
        orderBy: [{ updatedAt: "desc" }],
        include: getOrderInclude()
      });
    });
    res.json({ orders: orders.map(toFrontendOrder) });
  }));

  app.get("/api/orders/:id", asyncHandler(async function (req, res) {
    var orderId = String(req.params.id || "").trim();
    var order = await withDatabaseRetry("GET /api/orders/:id", function () {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: getOrderInclude()
      });
    });

    if (!order) {
      throw createHttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    }

    res.json({ order: toFrontendOrder(order) });
  }));

  app.post("/api/orders", asyncHandler(async function (req, res) {
    var input = req.body && req.body.order ? req.body.order : req.body;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      res.status(400).json({
        code: "INVALID_ORDER_PAYLOAD",
        message: "Order payload must be a JSON object."
      });
      return;
    }

    req.safePayloadSummary = getOrderPayloadSummary(input);
    console.info("[api-request]", {
      operation: "POST /api/orders",
      payload: req.safePayloadSummary
    });

    var serverOrderId = createRequestOrderId();
    var serverOrderNo = createOrderNo(new Date());
    var clientOrderId = getClientOrderId(input);
    var payload = buildOrderPayload(input, { orderNo: serverOrderNo });

    var saved;
    try {
      saved = await withDatabaseRetry("POST /api/orders", function () {
        return prisma.$transaction(async function (tx) {
          var existing = clientOrderId ? await tx.order.findUnique({
            where: { clientOrderId: clientOrderId },
            include: getOrderInclude()
          }) : null;
          if (existing) return existing;

          var createData = Object.assign({}, payload.orderData, {
            id: serverOrderId,
            orderNo: payload.nextOrderNo,
            mapLocationCacheId: null
          });
          if (clientOrderId) createData.clientOrderId = clientOrderId;

          return tx.order.create({
            data: attachDetailCreates(createData, payload),
            include: getOrderInclude()
          });
        }, {
          timeout: 10000
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && clientOrderId) {
        var existing = await withDatabaseRetry("POST /api/orders idempotency lookup", function () {
          return findOrderByClientOrderId(prisma, clientOrderId);
        });
        if (existing) {
          saved = existing;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    saved = await attachMapLocationAfterSave(prisma, "POST /api/orders", input, payload, saved);

    res.json({ order: toFrontendOrder(saved) });
  }));

  app.put("/api/orders/:id", asyncHandler(async function (req, res) {
    var orderId = String(req.params.id || "").trim();
    var input = req.body && req.body.order ? req.body.order : req.body;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      res.status(400).json({
        code: "INVALID_ORDER_PAYLOAD",
        message: "Order payload must be a JSON object."
      });
      return;
    }

    req.safePayloadSummary = getOrderPayloadSummary(input);
    console.info("[api-request]", {
      operation: "PUT /api/orders/:id",
      orderId: orderId,
      payload: req.safePayloadSummary
    });

    var payload = buildOrderPayload(input);
    var updateResult = await withDatabaseRetry("PUT /api/orders/:id", function () {
      return prisma.$transaction(async function (tx) {
        var existing = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNo: true,
            clientOrderId: true,
            orderDate: true
          }
        });
        if (!existing) {
          throw createHttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
        }

        var orderData = Object.assign({}, payload.orderData, {
          mapLocationCacheId: null
        });

        await tx.order.update({
          where: { id: existing.id },
          data: orderData
        });

        await tx.orderMainRow.deleteMany({ where: { orderId: existing.id } });
        await tx.orderLineItem.deleteMany({ where: { orderId: existing.id } });

        if (payload.mainRows.length) {
          await tx.orderMainRow.createMany({
            data: attachOrderIdToRows(payload.mainRows, existing.id)
          });
        }

        if (payload.lineItems.length) {
          await tx.orderLineItem.createMany({
            data: attachOrderIdToRows(payload.lineItems, existing.id)
          });
        }

        return { orderId: existing.id, payload: payload };
      }, {
        timeout: 10000
      });
    });

    var saved = await withDatabaseRetry("PUT /api/orders/:id reload", function () {
      return prisma.order.findUnique({
        where: { id: updateResult.orderId },
        include: getOrderInclude()
      });
    });
    if (!saved) {
      throw createHttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    }

    saved = await attachMapLocationAfterSave(prisma, "PUT /api/orders/:id", input, updateResult.payload, saved);
    res.json({ order: toFrontendOrder(saved) });
  }));

  app.delete("/api/orders/:id", asyncHandler(async function (req, res) {
    var orderId = String(req.params.id || "").trim();
    var deleted = await withDatabaseRetry("DELETE /api/orders/:id", function () {
      return prisma.$transaction(async function (tx) {
        var existing = await tx.order.findUnique({
          where: { id: orderId },
          include: getOrderInclude()
        });
        if (!existing) {
          throw createHttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
        }

        return tx.order.delete({
          where: { id: existing.id },
          include: getOrderInclude()
        });
      }, {
        timeout: 10000
      });
    });

    res.json({ ok: true, order: toFrontendOrder(deleted) });
  }));

  app.use(function (error, req, res, next) {
    if (error && error.message === "CORS origin is not allowed.") {
      res.status(403).json({
        code: "CORS_ORIGIN_NOT_ALLOWED",
        message: "CORS origin is not allowed."
      });
      return;
    }
    var response = getErrorResponse(error);
    console.error("[api-error]", Object.assign({}, getSafeErrorLog(error, req), {
      statusCode: response.statusCode,
      responseCode: response.body.code
    }));
    res.status(response.statusCode).json(response.body);
  });

  return app;
}
