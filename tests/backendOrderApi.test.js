import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../backend/src/app.js";
import { hashPassword, signAuthToken, verifyAuthToken } from "../backend/src/auth.js";
import { recordPrismaQueryDuration } from "../backend/src/requestContext.js";

var activeServers = [];
var TEST_JWT_SECRET = "test-jwt-secret-for-order-api";

function authHeadersForRoles(roleCodes, extra) {
  return Object.assign({
    Authorization: "Bearer " + signAuthToken({
      id: "test-user-id",
      username: "admin",
      roles: (Array.isArray(roleCodes) ? roleCodes : []).map(function (code) {
        return { role: { code: code } };
      })
    }, TEST_JWT_SECRET, "1h")
  }, extra || {});
}

function authHeaders(extra) {
  return authHeadersForRoles(["ADMIN"], extra);
}

function nonAdminAuthHeaders(extra) {
  return authHeadersForRoles(["OPERATOR"], extra);
}

function createTestApp(mock, extraOptions) {
  return createApp(Object.assign({
    prisma: mock.prisma,
    jwtSecret: TEST_JWT_SECRET
  }, extraOptions || {}));
}

function listen(app) {
  return new Promise(function (resolve) {
    var server = app.listen(0, function () {
      activeServers.push(server);
      resolve({
        server: server,
        url: "http://127.0.0.1:" + server.address().port
      });
    });
  });
}

function closeServer(server) {
  return new Promise(function (resolve, reject) {
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

afterEach(async function () {
  var servers = activeServers;
  activeServers = [];
  await Promise.all(servers.map(closeServer));
});

function readNestedCreates(value, fallback) {
  if (value && Array.isArray(value.create)) return value.create;
  if (Array.isArray(value)) return value;
  return Array.isArray(fallback) ? fallback : [];
}

function createDbOrder(data, previous) {
  var prior = previous || {};
  return {
    id: data.id || prior.id,
    orderNo: data.orderNo || prior.orderNo,
    clientOrderId: Object.prototype.hasOwnProperty.call(data, "clientOrderId") ? data.clientOrderId : (prior.clientOrderId || null),
    createdAt: prior.createdAt || new Date("2026-05-30T00:00:00.000Z"),
    updatedAt: new Date("2026-05-30T00:00:01.000Z"),
    orderDate: data.orderDate || prior.orderDate,
    customerName: data.customerName !== undefined ? data.customerName : prior.customerName,
    tileColor: data.tileColor !== undefined ? data.tileColor : prior.tileColor,
    steelCategory: data.steelCategory !== undefined ? data.steelCategory : prior.steelCategory,
    galvanizingProcess: data.galvanizingProcess !== undefined ? data.galvanizingProcess : prior.galvanizingProcess,
    remark: data.remark !== undefined ? data.remark : prior.remark,
    deliveryAddress: data.deliveryAddress !== undefined ? data.deliveryAddress : prior.deliveryAddress,
    completionMonth: data.completionMonth !== undefined ? data.completionMonth : prior.completionMonth,
    areaTotal: data.areaTotal !== undefined ? data.areaTotal : prior.areaTotal,
    mainAmount: data.mainAmount !== undefined ? data.mainAmount : prior.mainAmount,
    accessoryAmount: data.accessoryAmount !== undefined ? data.accessoryAmount : prior.accessoryAmount,
    steelAmount: data.steelAmount !== undefined ? data.steelAmount : prior.steelAmount,
    otherTileAmount: data.otherTileAmount !== undefined ? data.otherTileAmount : prior.otherTileAmount,
    grandAmount: data.grandAmount !== undefined ? data.grandAmount : prior.grandAmount,
    mapLocationCache: null,
    mainRows: readNestedCreates(data.mainRows, prior.mainRows),
    lineItems: readNestedCreates(data.lineItems, prior.lineItems)
  };
}

function createMockPrisma() {
  var captured = {
    createData: null,
    findUniqueArgs: [],
    mapLocationUpsertCalls: 0
  };
  var ordersById = {};
  var ordersByClientOrderId = {};
  var mapImagesByOrderId = {};
  var systemConfigsByKey = {};
  var usersByUsername = {};

  function storeOrder(order) {
    ordersById[order.id] = order;
    if (order.clientOrderId) ordersByClientOrderId[order.clientOrderId] = order;
    return order;
  }

  function storeUser(user) {
    usersByUsername[user.username] = user;
    return user;
  }

  function storeMapImage(image) {
    mapImagesByOrderId[image.orderId] = image;
    return image;
  }

  function recordMockPrismaQuery() {
    recordPrismaQueryDuration(1);
  }

  function findOrder(args) {
    if (args.where.id) return ordersById[args.where.id] || null;
    if (args.where.clientOrderId) return ordersByClientOrderId[args.where.clientOrderId] || null;
    return null;
  }

  var tx = {
    order: {
      findUnique: async function (args) {
        recordMockPrismaQuery();
        captured.findUniqueArgs.push(args);
        return findOrder(args);
      },
      create: async function (args) {
        recordMockPrismaQuery();
        captured.createData = args.data;
        var order = createDbOrder(args.data);
        return storeOrder(order);
      },
      update: async function (args) {
        recordMockPrismaQuery();
        captured.updateData = args.data;
        var existing = ordersById[args.where.id];
        var order = createDbOrder(Object.assign({ id: args.where.id }, args.data), existing);
        return storeOrder(order);
      },
      delete: async function (args) {
        recordMockPrismaQuery();
        captured.deleteArgs = args;
        var existing = ordersById[args.where.id];
        if (existing) {
          delete ordersById[args.where.id];
          if (existing.clientOrderId) delete ordersByClientOrderId[existing.clientOrderId];
          delete mapImagesByOrderId[existing.id];
        }
        return existing;
      }
    },
    orderMainRow: {
      deleteMany: async function (args) {
        recordMockPrismaQuery();
        captured.deleteMainRowsArgs = args;
        var existing = ordersById[args.where.orderId];
        if (existing) existing.mainRows = [];
        return { count: 0 };
      },
      createMany: async function (args) {
        recordMockPrismaQuery();
        captured.createMainRowsArgs = args;
        var orderId = args.data && args.data[0] && args.data[0].orderId;
        var existing = ordersById[orderId];
        if (existing) {
          existing.mainRows = args.data.map(function (row) {
            var next = Object.assign({}, row);
            delete next.orderId;
            return next;
          });
        }
        return { count: args.data.length };
      }
    },
    orderLineItem: {
      deleteMany: async function (args) {
        recordMockPrismaQuery();
        captured.deleteLineItemsArgs = args;
        var existing = ordersById[args.where.orderId];
        if (existing) existing.lineItems = [];
        return { count: 0 };
      },
      createMany: async function (args) {
        recordMockPrismaQuery();
        captured.createLineItemsArgs = args;
        var orderId = args.data && args.data[0] && args.data[0].orderId;
        var existing = ordersById[orderId];
        if (existing) {
          existing.lineItems = args.data.map(function (row) {
            var next = Object.assign({}, row);
            delete next.orderId;
            return next;
          });
        }
        return { count: args.data.length };
      }
    },
    mapLocationCache: {
      upsert: async function () {
        recordMockPrismaQuery();
        captured.mapLocationUpsertCalls += 1;
        return { id: "map-location-1" };
      }
    }
  };

  return {
    captured: captured,
    ordersById: ordersById,
    ordersByClientOrderId: ordersByClientOrderId,
    mapImagesByOrderId: mapImagesByOrderId,
    systemConfigsByKey: systemConfigsByKey,
    usersByUsername: usersByUsername,
    storeOrder: storeOrder,
    storeUser: storeUser,
    storeMapImage: storeMapImage,
    prisma: {
      user: {
        findUnique: async function (args) {
          recordMockPrismaQuery();
          captured.userFindUniqueArgs = captured.userFindUniqueArgs || [];
          captured.userFindUniqueArgs.push(args);
          return usersByUsername[args.where.username] || null;
        },
        update: async function (args) {
          recordMockPrismaQuery();
          captured.userUpdateArgs = args;
          if (captured.userUpdateError) throw captured.userUpdateError;
          var user = Object.values(usersByUsername).find(function (item) {
            return item.id === args.where.id;
          });
          if (user) user.lastLoginAt = args.data.lastLoginAt;
          return user;
        }
      },
      order: {
        findUnique: async function (args) {
          recordMockPrismaQuery();
          captured.rootFindUniqueArgs = captured.rootFindUniqueArgs || [];
          captured.rootFindUniqueArgs.push(args);
          return findOrder(args);
        },
        findMany: async function () {
          recordMockPrismaQuery();
          return Object.values(ordersById);
        },
        update: async function (args) {
          recordMockPrismaQuery();
          captured.rootUpdateData = args.data;
          var existing = ordersById[args.where.id];
          var order = createDbOrder(Object.assign({ id: args.where.id }, args.data), existing);
          return storeOrder(order);
        },
        delete: async function (args) {
          recordMockPrismaQuery();
          var existing = ordersById[args.where.id];
          if (existing) {
            delete ordersById[args.where.id];
            delete mapImagesByOrderId[existing.id];
          }
          return existing;
        }
      },
      orderImage: {
        findUnique: async function (args) {
          recordMockPrismaQuery();
          captured.orderImageFindUniqueArgs = captured.orderImageFindUniqueArgs || [];
          captured.orderImageFindUniqueArgs.push(args);
          if (args.where.orderId) return mapImagesByOrderId[args.where.orderId] || null;
          return null;
        },
        upsert: async function (args) {
          recordMockPrismaQuery();
          captured.orderImageUpsertArgs = args;
          var existing = mapImagesByOrderId[args.where.orderId];
          var data = existing ? Object.assign({}, existing, args.update) : Object.assign({
            id: "map-image-" + args.where.orderId,
            createdAt: new Date("2026-05-30T00:00:00.000Z")
          }, args.create);
          data.updatedAt = new Date("2026-05-30T00:00:02.000Z");
          data.sizeBytes = Number(data.sizeBytes);
          return storeMapImage(data);
        },
        deleteMany: async function (args) {
          recordMockPrismaQuery();
          captured.orderImageDeleteManyArgs = args;
          var existing = mapImagesByOrderId[args.where.orderId];
          if (existing) {
            delete mapImagesByOrderId[args.where.orderId];
            return { count: 1 };
          }
          return { count: 0 };
        }
      },
      systemConfig: {
        findUnique: async function (args) {
          recordMockPrismaQuery();
          captured.systemConfigFindUniqueArgs = captured.systemConfigFindUniqueArgs || [];
          captured.systemConfigFindUniqueArgs.push(args);
          return systemConfigsByKey[args.where.key] || null;
        },
        upsert: async function (args) {
          recordMockPrismaQuery();
          captured.systemConfigUpsertArgs = args;
          var existing = systemConfigsByKey[args.where.key];
          var data = existing ? Object.assign({}, existing, args.update) : Object.assign({
            id: "system-config-" + args.where.key,
            key: args.create.key,
            createdAt: new Date("2026-05-30T00:00:00.000Z")
          }, args.create);
          data.updatedAt = new Date("2026-05-30T00:00:02.000Z");
          systemConfigsByKey[data.key] = data;
          return { value: data.value };
        }
      },
      $queryRaw: async function () {
        recordMockPrismaQuery();
        captured.queryRawCalls = (captured.queryRawCalls || 0) + 1;
        if (captured.queryRawError) throw captured.queryRawError;
        return [{ value: 1 }];
      },
      $transaction: async function (handler) {
        return handler(tx);
      }
    }
  };
}

function createFrontendPayload() {
  return {
    id: "356a4657-6b30-46cc-a016-726a4f6c9982",
    orderNo: "ORD-20260530-184550",
    completionMonth: "",
    createdAt: "2026-05-30T10:57:01.417Z",
    customerName: "21\u989d\u6211\u70ed",
    deliveryAddress: "",
    deliveryLocation: null,
    steelCategory: "",
    galvanizingProcess: "",
    items: {
      mainRows: [
        {
          lengthsText: "0",
          totalQty: 0,
          actual: 0,
          area: 0
        }
      ],
      accessories: [],
      steels: [],
      otherTiles: []
    },
    orderDate: "2026-05-30",
    remark: "",
    tileColor: "",
    totals: {
      areaTotal: 0,
      mainAmount: 0,
      accessoryAmount: 0,
      steelAmount: 0,
      otherTileAmount: 0,
      grandAmount: 0
    },
    updatedAt: "2026-05-30T10:57:01.419Z"
  };
}

function createImageForm(mimeType, bytes, fileName) {
  var form = new FormData();
  var content = typeof bytes === "number" ? new Uint8Array(bytes).fill(65) : bytes;
  form.append("image", new Blob([content], { type: mimeType }), fileName || "map-image");
  return form;
}

describe("backend order API", function () {
  it("allows health checks without authentication", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var infoCalls = [];
    var originalInfo = console.info;
    console.info = function () {
      infoCalls.push(Array.prototype.slice.call(arguments));
    };

    try {
      var response = await fetch(serverInfo.url + "/api/health");
      var body = await response.json();
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
      var requestId = response.headers.get("x-request-id");
      var perfLog = infoCalls.map(function (call) {
        try {
          return JSON.parse(call[0]);
        } catch (error) {
          return null;
        }
      }).find(function (entry) {
        return entry && entry.type === "api_perf";
      });

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(requestId).toBeTruthy();
      expect(perfLog).toMatchObject({
        type: "api_perf",
        requestId: requestId,
        method: "GET",
        path: "/api/health",
        status: 200,
        dbDurationMs: 0,
        dbQueryCount: 0,
        dbMaxDurationMs: 0
      });
      expect(typeof perfLog.durationMs).toBe("number");
      expect(new Date(perfLog.timestamp).toString()).not.toBe("Invalid Date");
    } finally {
      console.info = originalInfo;
    }
  });

  it("checks database health without authentication and logs DB timing", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var infoCalls = [];
    var originalInfo = console.info;
    console.info = function () {
      infoCalls.push(Array.prototype.slice.call(arguments));
    };

    try {
      var response = await fetch(serverInfo.url + "/api/health/db");
      var body = await response.json();
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
      var requestId = response.headers.get("x-request-id");
      var perfLog = infoCalls.map(function (call) {
        try {
          return JSON.parse(call[0]);
        } catch (error) {
          return null;
        }
      }).find(function (entry) {
        return entry && entry.type === "api_perf";
      });

      expect(response.status).toBe(200);
      expect(requestId).toBeTruthy();
      expect(body.ok).toBe(true);
      expect(typeof body.dbMs).toBe("number");
      expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
      expect(mock.captured.queryRawCalls).toBe(1);
      expect(perfLog).toMatchObject({
        type: "api_perf",
        requestId: requestId,
        method: "GET",
        path: "/api/health/db",
        status: 200
      });
      expect(perfLog.dbQueryCount).toBeGreaterThanOrEqual(1);
      expect(perfLog.dbDurationMs).toBeGreaterThanOrEqual(1);
      expect(perfLog.dbMaxDurationMs).toBeGreaterThanOrEqual(1);
    } finally {
      console.info = originalInfo;
    }
  });

  it("returns 503 when database health check fails", async function () {
    var mock = createMockPrisma();
    mock.captured.queryRawError = Object.assign(new Error("connection failed"), { code: "P1001" });
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/health/db");
    var body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("P1001");
    expect(body.message).toBe("Database unavailable");
    expect(typeof body.dbMs).toBe("number");
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("rate limits repeated failed login attempts without affecting other APIs", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var originalError = console.error;
    console.error = function () {};

    try {
      var loginResponse;
      var loginBody;
      for (var index = 0; index < 11; index += 1) {
        loginResponse = await fetch(serverInfo.url + "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "unknown", password: "wrong-password" })
        });
        loginBody = await loginResponse.json();
      }

      var healthResponse = await fetch(serverInfo.url + "/api/health");
      var healthBody = await healthResponse.json();
      var configResponse = await fetch(serverInfo.url + "/api/config");
      var configBody = await configResponse.json();

      expect(loginResponse.status).toBe(429);
      expect(loginBody.error).toBe("TOO_MANY_LOGIN_ATTEMPTS");
      expect(healthResponse.status).toBe(200);
      expect(healthBody.ok).toBe(true);
      expect(configResponse.status).toBe(401);
      expect(configBody.code).toBe("AUTH_REQUIRED");
    } finally {
      console.error = originalError;
    }
  });

  it("logs in with an active bcrypt admin account and returns a JWT", async function () {
    var mock = createMockPrisma();
    mock.storeUser({
      id: "admin-user-id",
      username: "admin",
      displayName: "Admin",
      passwordHash: await hashPassword("correct-password"),
      isActive: true,
      roles: [{ role: { code: "ADMIN" } }]
    });
    var serverInfo = await listen(createTestApp(mock));
    var infoCalls = [];
    var originalInfo = console.info;
    console.info = function () {
      infoCalls.push(Array.prototype.slice.call(arguments));
    };

    try {
      var response = await fetch(serverInfo.url + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "correct-password" })
      });
      var body = await response.json();
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
      var perfLog = infoCalls.map(function (call) {
        try {
          return JSON.parse(call[0]);
        } catch (error) {
          return null;
        }
      }).find(function (entry) {
        return entry && entry.type === "api_perf";
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(body.token).toBeTruthy();
      expect(body.tokenType).toBe("Bearer");
      expect(body.user.username).toBe("admin");
      expect(body.user.roles).toEqual(["ADMIN"]);
      expect(verifyAuthToken(body.token, TEST_JWT_SECRET).sub).toBe("admin-user-id");
      expect(perfLog.dbQueryCount).toBe(1);
      expect(perfLog.dbDurationMs).toBeGreaterThanOrEqual(1);
      expect(perfLog.dbMaxDurationMs).toBeGreaterThanOrEqual(1);
      await new Promise(function (resolve) { setTimeout(resolve, 10); });
      expect(mock.captured.userUpdateArgs.where.id).toBe("admin-user-id");
    } finally {
      console.info = originalInfo;
    }
  });

  it("returns a token when lastLoginAt update fails and logs a safe warning", async function () {
    var mock = createMockPrisma();
    mock.storeUser({
      id: "admin-user-id",
      username: "admin",
      displayName: "Admin",
      passwordHash: await hashPassword("correct-password"),
      isActive: true,
      roles: [{ role: { code: "ADMIN" } }]
    });
    mock.captured.userUpdateError = Object.assign(new Error("connection failed"), { code: "P1001" });
    var serverInfo = await listen(createTestApp(mock));
    var warnCalls = [];
    var originalWarn = console.warn;
    console.warn = function () {
      warnCalls.push(Array.prototype.slice.call(arguments));
    };

    try {
      var response = await fetch(serverInfo.url + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "correct-password" })
      });
      var body = await response.json();
      await new Promise(function (resolve) { setTimeout(resolve, 10); });
      var requestId = response.headers.get("x-request-id");
      var warning = warnCalls.map(function (call) {
        try {
          return JSON.parse(call[0]);
        } catch (error) {
          return null;
        }
      }).find(function (entry) {
        return entry && entry.type === "last_login_update_failed";
      });

      expect(response.status).toBe(200);
      expect(requestId).toBeTruthy();
      expect(body.token).toBeTruthy();
      expect(warning).toMatchObject({
        type: "last_login_update_failed",
        requestId: requestId,
        userId: "admin-user-id",
        code: "P1001"
      });
      expect(new Date(warning.timestamp).toString()).not.toBe("Invalid Date");
    } finally {
      console.warn = originalWarn;
    }
  });

  it("rejects order API requests without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders");
    var body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("allows non-admin users to read order lists", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "operator-readable-order",
      orderNo: "ORD-OPERATOR-READ",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders", {
      headers: nonAdminAuthHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].id).toBe("operator-readable-order");
  });

  it("rejects config reads without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/config");
    var body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("rejects config writes without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { version: 1 } })
    });
    var body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("rejects config writes without an admin role", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/config", {
      method: "PUT",
      headers: nonAdminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config: { version: 1 } })
    });
    var body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "ADMIN role is required."
    });
    expect(mock.captured.systemConfigUpsertArgs).toBeUndefined();
  });

  it("returns the default config source when no app config exists", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/config", {
      headers: authHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ config: null, source: "default" });
    expect(mock.captured.systemConfigFindUniqueArgs[0]).toMatchObject({
      where: { key: "app_config" },
      select: { value: true }
    });
  });

  it("writes frontend app config to system config storage", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var config = {
      version: 3,
      mapSettings: {
        enabled: true,
        amapKey: "test-map-key",
        securityJsCode: "test-security-code",
        geocodeCity: "泉州市",
        mapStyle: "amap://styles/whitesmoke"
      }
    };

    var response = await fetch(serverInfo.url + "/api/config", {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config: config })
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ config: config, source: "database" });
    expect(mock.captured.systemConfigUpsertArgs).toMatchObject({
      where: { key: "app_config" },
      update: {
        group: "frontend",
        value: config,
        version: 3,
        isSecret: false,
        description: "Frontend application configuration"
      },
      create: {
        key: "app_config",
        group: "frontend",
        value: config,
        version: 3,
        isSecret: false,
        description: "Frontend application configuration"
      },
      select: { value: true }
    });
  });

  it("returns the saved frontend app config from database storage", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var config = {
      version: 4,
      basics: {
        fixedWidth: 1.05,
        companyName: "红波树脂瓦"
      }
    };

    var putResponse = await fetch(serverInfo.url + "/api/config", {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config: config })
    });
    var getResponse = await fetch(serverInfo.url + "/api/config", {
      headers: authHeaders()
    });
    var getBody = await getResponse.json();

    expect(putResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(getBody).toEqual({ config: config, source: "database" });
  });

  it("rejects non-object frontend config payloads", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/config", {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config: [] })
    });
    var body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_CONFIG_PAYLOAD");
  });

  it("falls back when DeepSeek cutting advice evaluation is not configured", async function () {
    var previousKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    try {
      var response = await fetch(serverInfo.url + "/api/cutting-advice/evaluate", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          stockSegments: 60,
          plans: [],
          recommendedPlan: null
        })
      });
      var body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(false);
      expect(body.message).toBe("AI评分暂不可用，本地裁板方案仍可使用");
    } finally {
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
    }
  });

  it("evaluates local cutting plans through DeepSeek without changing the plan", async function () {
    var previousKey = process.env.DEEPSEEK_API_KEY;
    var previousModel = process.env.DEEPSEEK_MODEL;
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    delete process.env.DEEPSEEK_MODEL;
    var mock = createMockPrisma();
    var fetchCalls = [];
    var fakeDeepSeekFetch = async function (url, options) {
      fetchCalls.push({ url: url, options: options });
      return {
        ok: true,
        json: async function () {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    score: 8.8,
                    label: "推荐",
                    reasons: ["旧字段不应外显"],
                    cautions: ["旧字段不应外显"]
                  })
                }
              }
            ]
          };
        }
      };
    };
    var serverInfo = await listen(createTestApp(mock, { deepseekFetch: fakeDeepSeekFetch }));

    try {
      var recommendedPlan = {
        title: "方案一：优先零剩料",
        boardCount: 1,
        totalWasteSegments: 0,
        fullBoardCount: 1,
        summaryText: "用原板 1 支，总剩料 0 节，满板 1 支。",
        cuts: [
          { description: "23节×2 + 14节×1", repeat: 1, wasteSegments: 0, usedSegments: 60 }
        ]
      };
      var response = await fetch(serverInfo.url + "/api/cutting-advice/evaluate", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          stockSegments: 60,
          plans: [recommendedPlan],
          recommendedPlan: recommendedPlan
        })
      });
      var body = await response.json();
      var deepSeekBody = JSON.parse(fetchCalls[0].options.body);
      var prompt = deepSeekBody.messages[1].content;

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.evaluation).toEqual({ score: 8.8, label: "推荐" });
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe("https://api.deepseek.com/chat/completions");
      expect(fetchCalls[0].options.headers.Authorization).toBe("Bearer test-deepseek-key");
      expect(deepSeekBody.model).toBe("deepseek-v4-flash");
      expect(prompt).toContain("不能重新计算裁板方案");
      expect(prompt).toContain("23节×2 + 14节×1");
    } finally {
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.DEEPSEEK_MODEL;
      else process.env.DEEPSEEK_MODEL = previousModel;
    }
  });

  it("uses the configured DeepSeek model when provided", async function () {
    var previousKey = process.env.DEEPSEEK_API_KEY;
    var previousModel = process.env.DEEPSEEK_MODEL;
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    process.env.DEEPSEEK_MODEL = "deepseek-custom-model";
    var mock = createMockPrisma();
    var requestedBody = null;
    var fakeDeepSeekFetch = async function (url, options) {
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async function () {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    score: 7.2,
                    label: "可用"
                  })
                }
              }
            ]
          };
        }
      };
    };
    var serverInfo = await listen(createTestApp(mock, { deepseekFetch: fakeDeepSeekFetch }));

    try {
      var recommendedPlan = {
        title: "方案一",
        boardCount: 1,
        totalWasteSegments: 0,
        fullBoardCount: 1,
        summaryText: "用原板 1 支。",
        cuts: [
          { description: "20节×3", repeat: 1, wasteSegments: 0, usedSegments: 60 }
        ]
      };
      var response = await fetch(serverInfo.url + "/api/cutting-advice/evaluate", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          stockSegments: 60,
          plans: [recommendedPlan],
          recommendedPlan: recommendedPlan
        })
      });
      var body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(requestedBody.model).toBe("deepseek-custom-model");
    } finally {
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.DEEPSEEK_MODEL;
      else process.env.DEEPSEEK_MODEL = previousModel;
    }
  });

  it("rejects order map image API requests without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var getResponse = await fetch(serverInfo.url + "/api/orders/order-1/map-image");
    var postResponse = await fetch(serverInfo.url + "/api/orders/order-1/map-image", {
      method: "POST",
      body: createImageForm("image/png", new Uint8Array([1]), "map.png")
    });
    var deleteResponse = await fetch(serverInfo.url + "/api/orders/order-1/map-image", {
      method: "DELETE"
    });

    expect(getResponse.status).toBe(401);
    expect((await getResponse.json()).code).toBe("AUTH_REQUIRED");
    expect(postResponse.status).toBe(401);
    expect((await postResponse.json()).code).toBe("AUTH_REQUIRED");
    expect(deleteResponse.status).toBe(401);
    expect((await deleteResponse.json()).code).toBe("AUTH_REQUIRED");
  });

  it("rejects order map image deletes without an admin role", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "operator-image-delete-order",
      orderNo: "ORD-IMAGE-OPERATOR-DELETE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    mock.storeMapImage({
      id: "operator-image-delete",
      orderId: "operator-image-delete-order",
      mimeType: "image/png",
      sizeBytes: 1,
      data: Buffer.from([1]),
      updatedAt: new Date("2026-05-30T00:00:02.000Z")
    });
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/operator-image-delete-order/map-image", {
      method: "DELETE",
      headers: nonAdminAuthHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "ADMIN role is required."
    });
    expect(mock.mapImagesByOrderId["operator-image-delete-order"]).toBeTruthy();
    expect(mock.captured.orderImageDeleteManyArgs).toBeUndefined();
  });

  it("returns 404 when uploading a map image for a missing order", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/missing-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/png", new Uint8Array([1, 2, 3]), "map.png")
    });
    var body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("ORDER_NOT_FOUND");
  });

  it("rejects unsupported map image MIME types", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "image-type-order",
      orderNo: "ORD-IMAGE-TYPE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/image-type-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("text/plain", new Uint8Array([1, 2, 3]), "map.txt")
    });
    var body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_IMAGE_TYPE");
  });

  it("rejects map images larger than 500KB", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "large-image-order",
      orderNo: "ORD-LARGE-IMAGE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/large-image-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/png", 512001, "large-map.png")
    });
    var body = await response.json();

    expect([400, 413]).toContain(response.status);
    expect(body.code).toBe("IMAGE_TOO_LARGE");
  });

  it("uploads and reads an order map image with the correct content type and binary body", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "image-order",
      orderNo: "ORD-IMAGE-001",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));
    var bytes = new Uint8Array([137, 80, 78, 71]);

    var uploadResponse = await fetch(serverInfo.url + "/api/orders/image-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/png", bytes, "map.png")
    });
    var uploadBody = await uploadResponse.json();
    var getResponse = await fetch(serverInfo.url + "/api/orders/image-order/map-image", {
      headers: authHeaders()
    });
    var downloaded = Buffer.from(await getResponse.arrayBuffer());

    expect(uploadResponse.status).toBe(200);
    expect(uploadBody.ok).toBe(true);
    expect(uploadBody.image).not.toHaveProperty("data");
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("content-type")).toBe("image/png");
    expect(getResponse.headers.get("content-length")).toBe(String(bytes.length));
    expect(downloaded).toEqual(Buffer.from(bytes));
  });

  it("replaces the previous map image when uploading again", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "replace-image-order",
      orderNo: "ORD-IMAGE-REPLACE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    await fetch(serverInfo.url + "/api/orders/replace-image-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/png", new Uint8Array([1, 2, 3]), "first.png")
    });
    var replaceResponse = await fetch(serverInfo.url + "/api/orders/replace-image-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/webp", new Uint8Array([4, 5]), "second.webp")
    });
    var getResponse = await fetch(serverInfo.url + "/api/orders/replace-image-order/map-image", {
      headers: authHeaders()
    });
    var downloaded = Buffer.from(await getResponse.arrayBuffer());

    expect(replaceResponse.status).toBe(200);
    expect(Object.keys(mock.mapImagesByOrderId)).toHaveLength(1);
    expect(mock.mapImagesByOrderId["replace-image-order"].mimeType).toBe("image/webp");
    expect(getResponse.headers.get("content-type")).toBe("image/webp");
    expect(downloaded).toEqual(Buffer.from([4, 5]));
  });

  it("deletes an order map image and returns 404 on later reads", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "delete-image-order",
      orderNo: "ORD-IMAGE-DELETE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    await fetch(serverInfo.url + "/api/orders/delete-image-order/map-image", {
      method: "POST",
      headers: authHeaders(),
      body: createImageForm("image/jpeg", new Uint8Array([10, 11]), "map.jpg")
    });
    var deleteResponse = await fetch(serverInfo.url + "/api/orders/delete-image-order/map-image", {
      method: "DELETE",
      headers: authHeaders()
    });
    var deleteBody = await deleteResponse.json();
    var getResponse = await fetch(serverInfo.url + "/api/orders/delete-image-order/map-image", {
      headers: authHeaders()
    });
    var getBody = await getResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody).toEqual({ ok: true, deleted: true });
    expect(getResponse.status).toBe(404);
    expect(getBody.code).toBe("ORDER_IMAGE_NOT_FOUND");
  });

  it("does not include map image binary data in the order list response", async function () {
    var mock = createMockPrisma();
    mock.storeOrder(createDbOrder({
      id: "list-image-order",
      orderNo: "ORD-IMAGE-LIST",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    mock.storeMapImage({
      id: "list-image",
      orderId: "list-image-order",
      mimeType: "image/png",
      sizeBytes: 3,
      data: Buffer.from([1, 2, 3]),
      width: null,
      height: null,
      updatedAt: new Date("2026-05-30T00:00:02.000Z")
    });
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders", {
      headers: authHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).not.toHaveProperty("mapImage");
    expect(body.orders[0]).not.toHaveProperty("data");
    expect(JSON.stringify(body.orders[0])).not.toContain("AQID");
  });

  it("returns a single order by id", async function () {
    var mock = createMockPrisma();
    var existing = mock.storeOrder(createDbOrder({
      id: "server-order-1",
      orderNo: "ORD-GET-001",
      clientOrderId: "client-order-1",
      orderDate: new Date("2026-05-30T00:00:00.000Z"),
      customerName: "GET Customer",
      tileColor: null,
      steelCategory: null,
      galvanizingProcess: null,
      remark: null,
      deliveryAddress: null,
      completionMonth: null,
      areaTotal: 1,
      mainAmount: 2,
      accessoryAmount: 0,
      steelAmount: 0,
      otherTileAmount: 0,
      grandAmount: 2
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/" + existing.id, {
      headers: authHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order.id).toBe(existing.id);
    expect(body.order.orderNo).toBe("ORD-GET-001");
    expect(body.order.clientOrderId).toBe("client-order-1");
    expect(body.order.steelCategory).toBe("");
    expect(body.order.galvanizingProcess).toBe("");
    expect(mock.captured.rootFindUniqueArgs[0].where.id).toBe(existing.id);
  });

  it("creates a new order from the frontend payload without using client ids or blank rows", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      steelCategory: "友发",
      galvanizingProcess: "双镀锌"
    });

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order).toBeTruthy();
    expect(body.order.clientOrderId).toBe(payload.id);
    expect(mock.captured.createData.id).not.toBe(payload.id);
    expect(mock.captured.createData.orderNo).not.toBe(payload.orderNo);
    expect(mock.captured.createData.clientOrderId).toBe(payload.id);
    expect(mock.captured.createData.steelCategory).toBe("友发");
    expect(mock.captured.createData.galvanizingProcess).toBe("双镀锌");
    expect(mock.captured.createData).not.toHaveProperty("createdAt");
    expect(mock.captured.createData).not.toHaveProperty("updatedAt");
    expect(mock.captured.createData.completionMonth).toBeNull();
    expect(mock.captured.createData.mapLocationCacheId).toBeNull();
    expect(mock.captured.createData.mainRows).toBeUndefined();
    expect(mock.captured.createData.lineItems).toBeUndefined();
    expect(mock.captured.mapLocationUpsertCalls).toBe(0);
    expect(body.order.steelCategory).toBe("友发");
    expect(body.order.galvanizingProcess).toBe("双镀锌");
    expect(body.order.items.mainRows).toEqual([]);
  });

  it("persists main row segment lengths and returns them in create, get, and list responses", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      id: "segment-create-client",
      items: {
        mainTileSegmentLength: 0.218,
        mainRows: [
          { lengthsText: "2.5", totalQty: 2, actual: 12, area: 5, segmentLength: 0.219 },
          { lengthsText: "3.0", totalQty: 1, actual: 14, area: 3, tileSegmentLength: 0.218 },
          { lengthsText: "1.8", totalQty: 4, actual: 8, area: 4 }
        ],
        accessories: [],
        steels: [],
        otherTiles: []
      },
      totals: {
        areaTotal: 12,
        mainAmount: 120,
        accessoryAmount: 0,
        steelAmount: 0,
        otherTileAmount: 0,
        grandAmount: 120
      }
    });

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();
    var createdId = body.order.id;
    var getResponse = await fetch(serverInfo.url + "/api/orders/" + createdId, {
      headers: authHeaders()
    });
    var getBody = await getResponse.json();
    var listResponse = await fetch(serverInfo.url + "/api/orders", {
      headers: authHeaders()
    });
    var listBody = await listResponse.json();

    expect(response.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(mock.captured.createData.mainRows.create.map(function (row) { return row.segmentLength; })).toEqual([0.219, 0.218, 0.218]);
    expect(body.order.items.mainRows.map(function (row) { return row.segmentLength; })).toEqual([0.219, 0.218, 0.218]);
    expect(getBody.order.items.mainRows.map(function (row) { return row.segmentLength; })).toEqual([0.219, 0.218, 0.218]);
    expect(listBody.orders[0].items.mainRows.map(function (row) { return row.segmentLength; })).toEqual([0.219, 0.218, 0.218]);
  });

  it("keeps missing or invalid main row segment lengths nullable", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      id: "segment-null-client",
      items: {
        mainRows: [
          { lengthsText: "2.5", totalQty: 2, actual: 12, area: 5 },
          { lengthsText: "3.0", totalQty: 1, actual: 14, area: 3, segmentLength: "not-a-number" }
        ],
        accessories: [],
        steels: [],
        otherTiles: []
      },
      totals: {
        areaTotal: 8,
        mainAmount: 80,
        accessoryAmount: 0,
        steelAmount: 0,
        otherTileAmount: 0,
        grandAmount: 80
      }
    });

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();
    var returnedValues = body.order.items.mainRows.map(function (row) { return row.segmentLength; });

    expect(response.status).toBe(200);
    expect(mock.captured.createData.mainRows.create.map(function (row) { return row.segmentLength; })).toEqual([null, null]);
    expect(returnedValues).toEqual([null, null]);
    expect(returnedValues.some(Number.isNaN)).toBe(false);
  });

  it("prefers an explicit clientOrderId over the frontend id for create idempotency", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      id: "frontend-runtime-id",
      clientOrderId: "explicit-client-order-id"
    });

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(mock.captured.createData.id).not.toBe(payload.id);
    expect(mock.captured.createData.clientOrderId).toBe("explicit-client-order-id");
    expect(mock.captured.createData.steelCategory).toBeNull();
    expect(mock.captured.createData.galvanizingProcess).toBeNull();
    expect(body.order.clientOrderId).toBe("explicit-client-order-id");
  });

  it("returns a safe 400 response for invalid order dates", async function () {
    var mock = createMockPrisma();
    mock.prisma.$transaction = async function () {
      throw new Error("Database should not be called for invalid orderDate.");
    };
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), { orderDate: "2026/13/40" });

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_ORDER_DATE");
    expect(body.message).toContain("orderDate");
  });

  it("returns 503 for P2028 transaction timeouts without retrying the closed transaction", async function () {
    var mock = createMockPrisma();
    var transactionCalls = 0;
    mock.prisma.$transaction = async function () {
      transactionCalls += 1;
      var error = new Error("Transaction already closed: A commit cannot be executed on an expired transaction.");
      error.name = "PrismaClientKnownRequestError";
      error.code = "P2028";
      throw error;
    };
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(createFrontendPayload())
    });
    var body = await response.json();

    expect(transactionCalls).toBe(1);
    expect(response.status).toBe(503);
    expect(body.code).toBe("DATABASE_TRANSACTION_TIMEOUT");
    expect(body.message).toBe("Database transaction timed out.");
  });

  it("returns an existing order when concurrent creates hit the clientOrderId unique key", async function () {
    var mock = createMockPrisma();
    var payload = createFrontendPayload();
    var existing = createDbOrder({
      id: "server-existing-id",
      orderNo: "ORD-SERVER-EXISTING",
      clientOrderId: payload.id,
      orderDate: new Date("2026-05-30T00:00:00.000Z"),
      customerName: payload.customerName,
      tileColor: null,
      remark: null,
      deliveryAddress: null,
      completionMonth: null,
      areaTotal: 0,
      mainAmount: 0,
      accessoryAmount: 0,
      steelAmount: 0,
      otherTileAmount: 0,
      grandAmount: 0
    });
    mock.ordersByClientOrderId[payload.id] = existing;
    mock.prisma.$transaction = async function () {
      var error = new Error("Unique constraint failed on the fields: (`clientOrderId`)");
      error.name = "PrismaClientKnownRequestError";
      error.code = "P2002";
      error.meta = { target: ["clientOrderId"] };
      throw error;
    };
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order.id).toBe("server-existing-id");
    expect(body.order.orderNo).toBe("ORD-SERVER-EXISTING");
    expect(mock.captured.rootFindUniqueArgs[0].where.clientOrderId).toBe(payload.id);
  });

  it("updates an existing order while preserving orderNo and clientOrderId", async function () {
    var mock = createMockPrisma();
    var existing = mock.storeOrder(createDbOrder({
      id: "server-order-update",
      orderNo: "ORD-KEEP-001",
      clientOrderId: "client-keep-001",
      orderDate: new Date("2026-05-29T00:00:00.000Z"),
      customerName: "Old Customer",
      tileColor: "Old Color",
      steelCategory: "正大",
      galvanizingProcess: "单镀锌",
      remark: "Old Remark",
      deliveryAddress: "Old Address",
      completionMonth: "2026-05",
      areaTotal: 1,
      mainAmount: 2,
      accessoryAmount: 3,
      steelAmount: 4,
      otherTileAmount: 5,
      grandAmount: 14,
      mainRows: [{ lengthsText: "1", totalQty: 1, actual: 1, area: 1, segmentLength: 0.218 }]
    }));
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      id: "client-should-not-replace-server-id",
      orderNo: "ORD-SHOULD-NOT-REPLACE",
      orderDate: "2026/05/30",
      customerName: "Updated Customer",
      steelCategory: "友发",
      galvanizingProcess: "双镀锌",
      completionMonth: "2026-06",
      items: {
        mainRows: [{ lengthsText: "2.5", totalQty: 2, actual: 5, area: 5, segmentLength: 0.219 }],
        accessories: [{ name: "Accessory", qty: 1, unit: "pcs", price: 3, subtotal: 3 }],
        steels: [],
        otherTiles: []
      },
      totals: {
        areaTotal: 5,
        mainAmount: 10,
        accessoryAmount: 3,
        steelAmount: 0,
        otherTileAmount: 0,
        grandAmount: 13
      }
    });

    var response = await fetch(serverInfo.url + "/api/orders/" + existing.id, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order.id).toBe(existing.id);
    expect(body.order.orderNo).toBe("ORD-KEEP-001");
    expect(mock.ordersById[existing.id].clientOrderId).toBe("client-keep-001");
    expect(mock.captured.updateData.steelCategory).toBe("友发");
    expect(mock.captured.updateData.galvanizingProcess).toBe("双镀锌");
    expect(body.order.steelCategory).toBe("友发");
    expect(body.order.galvanizingProcess).toBe("双镀锌");
    expect(mock.captured.updateData).not.toHaveProperty("orderNo");
    expect(mock.captured.updateData).not.toHaveProperty("clientOrderId");
    expect(mock.captured.updateData).not.toHaveProperty("mainRows");
    expect(mock.captured.updateData).not.toHaveProperty("lineItems");
    expect(mock.captured.findUniqueArgs[0].select).toEqual({
      id: true,
      orderNo: true,
      clientOrderId: true,
      orderDate: true
    });
    expect(mock.captured.deleteMainRowsArgs.where.orderId).toBe(existing.id);
    expect(mock.captured.deleteLineItemsArgs.where.orderId).toBe(existing.id);
    expect(mock.captured.createMainRowsArgs.data).toHaveLength(1);
    expect(mock.captured.createLineItemsArgs.data).toHaveLength(1);
    expect(mock.captured.createMainRowsArgs.data[0].orderId).toBe(existing.id);
    expect(mock.captured.createMainRowsArgs.data[0].segmentLength).toBe(0.219);
    expect(mock.captured.createLineItemsArgs.data[0].orderId).toBe(existing.id);
    expect(body.order.items.mainRows[0].segmentLength).toBe(0.219);
  });

  it("returns 503 for PUT P2028 transaction timeouts without retrying the closed transaction", async function () {
    var mock = createMockPrisma();
    var transactionCalls = 0;
    mock.prisma.$transaction = async function () {
      transactionCalls += 1;
      var error = new Error("Transaction already closed: A commit cannot be executed on an expired transaction.");
      error.name = "PrismaClientKnownRequestError";
      error.code = "P2028";
      throw error;
    };
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/server-order-update", {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(createFrontendPayload())
    });
    var body = await response.json();

    expect(transactionCalls).toBe(1);
    expect(response.status).toBe(503);
    expect(body.code).toBe("DATABASE_TRANSACTION_TIMEOUT");
    expect(body.message).toBe("Database transaction timed out.");
  });

  it("rejects order deletes without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/server-order-delete", {
      method: "DELETE"
    });
    var body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("rejects order deletes without an admin role", async function () {
    var mock = createMockPrisma();
    var existing = mock.storeOrder(createDbOrder({
      id: "operator-order-delete",
      orderNo: "ORD-OPERATOR-DELETE",
      orderDate: new Date("2026-05-30T00:00:00.000Z")
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/" + existing.id, {
      method: "DELETE",
      headers: nonAdminAuthHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "ADMIN role is required."
    });
    expect(mock.ordersById[existing.id]).toBe(existing);
  });

  it("hard deletes an order by id", async function () {
    var mock = createMockPrisma();
    var existing = mock.storeOrder(createDbOrder({
      id: "server-order-delete",
      orderNo: "ORD-DELETE-001",
      clientOrderId: "client-delete-001",
      orderDate: new Date("2026-05-30T00:00:00.000Z"),
      customerName: "Delete Customer",
      tileColor: null,
      remark: null,
      deliveryAddress: null,
      completionMonth: null,
      areaTotal: 0,
      mainAmount: 0,
      accessoryAmount: 0,
      steelAmount: 0,
      otherTileAmount: 0,
      grandAmount: 0
    }));
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders/" + existing.id, {
      method: "DELETE",
      headers: authHeaders()
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.order.id).toBe(existing.id);
    expect(mock.ordersById[existing.id]).toBeUndefined();
  });
});
