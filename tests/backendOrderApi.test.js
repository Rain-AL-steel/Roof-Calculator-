import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../backend/src/app.js";
import { hashPassword, signAuthToken, verifyAuthToken } from "../backend/src/auth.js";

var activeServers = [];
var TEST_JWT_SECRET = "test-jwt-secret-for-order-api";

function authHeaders(extra) {
  return Object.assign({
    Authorization: "Bearer " + signAuthToken({
      id: "test-user-id",
      username: "admin",
      roles: [{ role: { code: "ADMIN" } }]
    }, TEST_JWT_SECRET, "1h")
  }, extra || {});
}

function createTestApp(mock) {
  return createApp({
    prisma: mock.prisma,
    jwtSecret: TEST_JWT_SECRET
  });
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

  function findOrder(args) {
    if (args.where.id) return ordersById[args.where.id] || null;
    if (args.where.clientOrderId) return ordersByClientOrderId[args.where.clientOrderId] || null;
    return null;
  }

  var tx = {
    order: {
      findUnique: async function (args) {
        captured.findUniqueArgs.push(args);
        return findOrder(args);
      },
      create: async function (args) {
        captured.createData = args.data;
        var order = createDbOrder(args.data);
        return storeOrder(order);
      },
      update: async function (args) {
        captured.updateData = args.data;
        var existing = ordersById[args.where.id];
        var order = createDbOrder(Object.assign({ id: args.where.id }, args.data), existing);
        return storeOrder(order);
      },
      delete: async function (args) {
        captured.deleteArgs = args;
        var existing = ordersById[args.where.id];
        if (existing) {
          delete ordersById[args.where.id];
          if (existing.clientOrderId) delete ordersByClientOrderId[existing.clientOrderId];
        }
        return existing;
      }
    },
    orderMainRow: {
      deleteMany: async function (args) {
        captured.deleteMainRowsArgs = args;
        var existing = ordersById[args.where.orderId];
        if (existing) existing.mainRows = [];
        return { count: 0 };
      },
      createMany: async function (args) {
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
        captured.deleteLineItemsArgs = args;
        var existing = ordersById[args.where.orderId];
        if (existing) existing.lineItems = [];
        return { count: 0 };
      },
      createMany: async function (args) {
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
        captured.mapLocationUpsertCalls += 1;
        return { id: "map-location-1" };
      }
    }
  };

  return {
    captured: captured,
    ordersById: ordersById,
    ordersByClientOrderId: ordersByClientOrderId,
    usersByUsername: usersByUsername,
    storeOrder: storeOrder,
    storeUser: storeUser,
    prisma: {
      user: {
        findUnique: async function (args) {
          captured.userFindUniqueArgs = captured.userFindUniqueArgs || [];
          captured.userFindUniqueArgs.push(args);
          return usersByUsername[args.where.username] || null;
        },
        update: async function (args) {
          captured.userUpdateArgs = args;
          var user = Object.values(usersByUsername).find(function (item) {
            return item.id === args.where.id;
          });
          if (user) user.lastLoginAt = args.data.lastLoginAt;
          return user;
        }
      },
      order: {
        findUnique: async function (args) {
          captured.rootFindUniqueArgs = captured.rootFindUniqueArgs || [];
          captured.rootFindUniqueArgs.push(args);
          return findOrder(args);
        },
        findMany: async function () {
          return Object.values(ordersById);
        },
        update: async function (args) {
          captured.rootUpdateData = args.data;
          var existing = ordersById[args.where.id];
          var order = createDbOrder(Object.assign({ id: args.where.id }, args.data), existing);
          return storeOrder(order);
        },
        delete: async function (args) {
          var existing = ordersById[args.where.id];
          if (existing) delete ordersById[args.where.id];
          return existing;
        }
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

describe("backend order API", function () {
  it("allows health checks without authentication", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/health");
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
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

    var response = await fetch(serverInfo.url + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "correct-password" })
    });
    var body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.tokenType).toBe("Bearer");
    expect(body.user.username).toBe("admin");
    expect(body.user.roles).toEqual(["ADMIN"]);
    expect(verifyAuthToken(body.token, TEST_JWT_SECRET).sub).toBe("admin-user-id");
  });

  it("rejects order API requests without a bearer token", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));

    var response = await fetch(serverInfo.url + "/api/orders");
    var body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
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
    expect(mock.captured.rootFindUniqueArgs[0].where.id).toBe(existing.id);
  });

  it("creates a new order from the frontend payload without using client ids or blank rows", async function () {
    var mock = createMockPrisma();
    var serverInfo = await listen(createTestApp(mock));
    var payload = createFrontendPayload();

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
    expect(mock.captured.createData).not.toHaveProperty("createdAt");
    expect(mock.captured.createData).not.toHaveProperty("updatedAt");
    expect(mock.captured.createData.completionMonth).toBeNull();
    expect(mock.captured.createData.mapLocationCacheId).toBeNull();
    expect(mock.captured.createData.mainRows).toBeUndefined();
    expect(mock.captured.createData.lineItems).toBeUndefined();
    expect(mock.captured.mapLocationUpsertCalls).toBe(0);
    expect(body.order.items.mainRows).toEqual([]);
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
      remark: "Old Remark",
      deliveryAddress: "Old Address",
      completionMonth: "2026-05",
      areaTotal: 1,
      mainAmount: 2,
      accessoryAmount: 3,
      steelAmount: 4,
      otherTileAmount: 5,
      grandAmount: 14,
      mainRows: [{ lengthsText: "1", totalQty: 1, actual: 1, area: 1 }]
    }));
    var serverInfo = await listen(createTestApp(mock));
    var payload = Object.assign(createFrontendPayload(), {
      id: "client-should-not-replace-server-id",
      orderNo: "ORD-SHOULD-NOT-REPLACE",
      orderDate: "2026/05/30",
      customerName: "Updated Customer",
      completionMonth: "2026-06",
      items: {
        mainRows: [{ lengthsText: "2.5", totalQty: 2, actual: 5, area: 5 }],
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
    expect(mock.captured.createLineItemsArgs.data[0].orderId).toBe(existing.id);
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
