import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildOrderPieData,
  buildExportPayload,
  classifyMainTileRow,
  clearOrdersWithApiFallback,
  getOrderAmountParts,
  getOrdersInTrendRange,
  getOrderTrend,
  getOrderStats,
  importOrdersFromPayload,
  deleteOrderWithApiFallback,
  loadOrders,
  loadOrdersWithApiFallback,
  mergeOrders,
  normalizeOrder,
  readImportPayload,
  updateOrderWithApiFallback,
  upsertOrder,
  upsertOrderWithApiFallback
} from "../src/scripts/services/orderService.js";
import {
  clearApiAuth,
  deleteOrderMapImageFromApi,
  fetchConfigFromApi,
  fetchOrderMapImageBlobFromApi,
  getApiAuthToken,
  loginToApi,
  saveConfigToApi,
  uploadOrderMapImageToApi
} from "../src/scripts/services/apiClient.js";

var originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
var originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");

function createStorageMock() {
  var data = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    },
    removeItem: function (key) {
      delete data[key];
    },
    clear: function () {
      data = {};
    }
  };
}

function makeOrder(id, orderDate, amount) {
  return normalizeOrder({
    id: id,
    orderNo: "ORD-" + id,
    createdAt: orderDate + "T08:00:00.000Z",
    orderDate: orderDate,
    customerName: "测试客户",
    deliveryAddress: "福建省泉州市惠安县洛阳大道509号",
    deliveryLocation: { lng: 118.682, lat: 24.93, formattedAddress: "洛阳大道509号" },
    completionMonth: "2026-06",
    totals: {
      areaTotal: 12.5,
      mainAmount: amount,
      accessoryAmount: 8,
      steelAmount: 2,
      otherTileAmount: 0
    },
    items: {
      mainRows: [{ lengthsText: "2.5", totalQty: 4, actual: 12, area: 12.5 }],
      accessories: [{ name: "配件", qty: 2, unit: "件", price: 4, subtotal: 8 }],
      steels: [{ name: "钢材", qty: 1, unit: "件", price: 2, subtotal: 2 }],
      otherTiles: []
    }
  });
}

function restoreGlobalProperty(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

function useHttpApiRuntime(fetchImpl) {
  Object.defineProperty(globalThis, "location", {
    value: { protocol: "http:" },
    configurable: true
  });
  Object.defineProperty(globalThis, "fetch", {
    value: fetchImpl,
    configurable: true
  });
}

function jsonResponse(payload) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: function () {
      return Promise.resolve(JSON.stringify(payload));
    }
  });
}

beforeEach(function () {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorageMock(),
    configurable: true
  });
});

afterEach(function () {
  restoreGlobalProperty("fetch", originalFetchDescriptor);
  restoreGlobalProperty("location", originalLocationDescriptor);
  delete globalThis.ERP_API_BASE_URL;
  delete globalThis.__ERP_API_BASE_URL__;
  clearApiAuth();
});

describe("order service", function () {
  it("normalizes records and recomputes grand amount from saved totals", function () {
    var order = makeOrder("a", "2026-05-26", 100);
    expect(order.id).toBe("a");
    expect(order.orderNo).toBe("ORD-a");
    expect(order.totals.areaTotal).toBe(12.5);
    expect(order.totals.grandAmount).toBe(110);
    expect(order.deliveryAddress).toBe("福建省泉州市惠安县洛阳大道509号");
    expect(order.deliveryLocation.lng).toBe(118.682);
    expect(order.completionMonth).toBe("2026-06");
    expect(order.items.mainRows).toHaveLength(1);
  });

  it("preserves saved main tile segment fields for future tile classification", function () {
    var order = normalizeOrder({
      orderDate: "2026-05-26",
      totals: { mainAmount: 88 },
      items: {
        mainTileSegmentLength: "0.218",
        mainRows: [
          { lengthsText: "2.5", totalQty: 2, actual: 12, area: 8, segmentLength: "0.218" }
        ]
      }
    });

    expect(order.items.mainTileSegmentLength).toBe(0.218);
    expect(order.items.mainRows[0].segmentLength).toBe(0.218);
  });

  it("normalizes completion month values", function () {
    expect(normalizeOrder({ completionMonth: "2026/7" }).completionMonth).toBe("2026-07");
    expect(normalizeOrder({ completionMonth: "2026-13" }).completionMonth).toBe("");
  });

  it("drops invalid delivery locations while preserving addresses", function () {
    var order = normalizeOrder({
      orderDate: "2026-05-26",
      deliveryAddress: "只填写地址",
      deliveryLocation: { lng: "abc", lat: 24.93 }
    });
    expect(order.deliveryAddress).toBe("只填写地址");
    expect(order.deliveryLocation).toBeNull();
  });

  it("persists orders and returns dashboard stats", function () {
    upsertOrder(makeOrder("a", "2026-05-26", 100));
    upsertOrder(makeOrder("b", "2026-05-25", 40));
    var orders = loadOrders();
    var stats = getOrderStats(orders, "2026-05-26");
    expect(orders).toHaveLength(2);
    expect(stats.todayCount).toBe(1);
    expect(stats.todayAmount).toBe(110);
    expect(stats.totalAmount).toBe(160);
  });

  it("builds daily trend buckets for 7 and 30 day ranges", function () {
    var orders = [
      makeOrder("a", "2026-05-26", 100),
      makeOrder("b", "2026-05-20", 40),
      makeOrder("c", "2026-04-30", 20)
    ];
    var trend7 = getOrderTrend(orders, "7d", new Date(2026, 4, 26));
    var trend30 = getOrderTrend(orders, "30d", new Date(2026, 4, 26));
    expect(trend7.points).toHaveLength(7);
    expect(trend7.points[0].key).toBe("2026-05-20");
    expect(trend7.totalCount).toBe(2);
    expect(trend7.totalAmount).toBe(160);
    expect(trend30.points).toHaveLength(30);
    expect(trend30.totalCount).toBe(3);
  });

  it("filters orders with the same date windows used by dashboard trend ranges", function () {
    var orders = [
      makeOrder("a", "2026-05-26", 100),
      makeOrder("b", "2026-05-20", 40),
      makeOrder("c", "2026-04-30", 20)
    ];
    var range7 = getOrdersInTrendRange(orders, "7d", new Date(2026, 4, 26));
    var range30 = getOrdersInTrendRange(orders, "30d", new Date(2026, 4, 26));
    expect(range7.map(function (order) { return order.id; })).toEqual(["a", "b"]);
    expect(range30.map(function (order) { return order.id; })).toEqual(["a", "b", "c"]);
  });

  it("builds monthly trend buckets for one year", function () {
    var orders = [
      makeOrder("a", "2026-05-26", 100),
      makeOrder("b", "2026-01-15", 40),
      makeOrder("c", "2025-06-01", 20),
      makeOrder("d", "2025-05-31", 10)
    ];
    var trend = getOrderTrend(orders, "1y", new Date(2026, 4, 26));
    expect(trend.bucketType).toBe("month");
    expect(trend.points).toHaveLength(12);
    expect(trend.points[0].key).toBe("2025-06");
    expect(trend.points[11].key).toBe("2026-05");
    expect(trend.totalCount).toBe(3);
    expect(trend.totalAmount).toBe(190);
  });

  it("builds order pie data from safe amount parts", function () {
    var orders = [
      makeOrder("a", "2026-05-26", 100),
      Object.assign({}, makeOrder("b", "2026-05-25", 0), {
        totals: {
          mainAmount: undefined,
          otherTileAmount: undefined,
          accessoryAmount: undefined,
          steelAmount: undefined
        },
        items: {
          mainRows: [{ amount: 30 }],
          accessories: [{ subtotal: 5 }, { subtotal: NaN }],
          steels: [{ subtotal: 9 }],
          otherTiles: [{ subtotal: 12 }]
        }
      })
    ];

    expect(getOrderAmountParts(orders[1])).toEqual({
      mainTileAmount: 30,
      otherTileAmount: 12,
      tileAmount: 42,
      accessoryAmount: 5,
      steelAmount: 9
    });

    var overview = buildOrderPieData(orders, "overview");
    expect(overview.total).toBe(166);
    expect(overview.slices).toEqual([
      { key: "tile", label: "瓦片", value: 142 },
      { key: "accessory", label: "配件", value: 13 },
      { key: "steel", label: "钢铁材料", value: 11 }
    ]);
  });

  it("classifies main tile rows only when saved fields clearly identify the segment", function () {
    expect(classifyMainTileRow({ lengthsText: "0.218" })).toBe("red-wave");
    expect(classifyMainTileRow({ segmentLength: 0.219 })).toBe("xingda");
    expect(classifyMainTileRow({ tileSegmentLength: 0.218 })).toBe("red-wave");
    expect(classifyMainTileRow({ mainTileSegmentLength: 0.219 })).toBe("xingda");
    expect(classifyMainTileRow({ segmentLength: 0.217, spec: "红波 0.218" })).toBe("unknown");
    expect(classifyMainTileRow({ spec: "红波 0.218" })).toBe("red-wave");
    expect(classifyMainTileRow({ model: "星大 0.219" })).toBe("xingda");
    expect(classifyMainTileRow({ lengthsText: "2.500" })).toBe("unknown");
    expect(classifyMainTileRow({ remark: "0.218 / 0.219 混合" })).toBe("unknown");
  });

  it("builds tile-only pie data split by red wave, xingda, and unknown tiles", function () {
    var splitByArea = buildOrderPieData([
      Object.assign({}, makeOrder("a", "2026-05-26", 0), {
        totals: {
          mainAmount: 120,
          otherTileAmount: 10,
          accessoryAmount: 10,
          steelAmount: 5
        },
        items: {
          mainRows: [
            { lengthsText: "0.218", area: 6 },
            { segmentLength: 0.219, area: 4 },
            { lengthsText: "2.500", area: 2 }
          ],
          otherTiles: [{ subtotal: 10 }]
        }
      })
    ], "tile");

    var splitByRowAmount = buildOrderPieData([
      Object.assign({}, makeOrder("b", "2026-05-26", 0), {
        totals: {
          mainAmount: undefined,
          otherTileAmount: 0,
          accessoryAmount: 10,
          steelAmount: 5
        },
        items: {
          mainRows: [
            { lengthsText: "0.218", amount: 70 },
            { lengthsText: "0.219", subtotal: 30 }
          ],
          otherTiles: []
        }
      })
    ], "tile");
    var splitByOrderSegment = buildOrderPieData([
      Object.assign({}, makeOrder("c", "2026-05-26", 0), {
        totals: {
          mainAmount: 90,
          otherTileAmount: 0,
          accessoryAmount: 0,
          steelAmount: 0
        },
        items: {
          mainTileSegmentLength: 0.219,
          mainRows: [
            { lengthsText: "2.500", area: 9 }
          ],
          otherTiles: []
        }
      })
    ], "tile");

    expect(splitByArea.slices).toEqual([
      { key: "red-wave", label: "红波", value: 60 },
      { key: "xingda", label: "星大", value: 40 },
      { key: "unknown-tile", label: "未区分", value: 30 }
    ]);
    expect(splitByRowAmount.slices).toEqual([
      { key: "red-wave", label: "红波", value: 70 },
      { key: "xingda", label: "星大", value: 30 }
    ]);
    expect(splitByOrderSegment.slices).toEqual([
      { key: "xingda", label: "星大", value: 90 }
    ]);
    expect(buildOrderPieData([], "overview").slices).toEqual([]);
  });

  it("merges imported orders by id", function () {
    var existing = [makeOrder("a", "2026-05-26", 100), makeOrder("b", "2026-05-25", 40)];
    var incoming = [makeOrder("b", "2026-05-25", 70), makeOrder("c", "2026-05-24", 20)];
    var merged = mergeOrders(existing, incoming);
    var updated = merged.find(function (order) { return order.id === "b"; });
    expect(merged).toHaveLength(3);
    expect(updated.totals.grandAmount).toBe(80);
  });

  it("imports replace and merge payloads", function () {
    upsertOrder(makeOrder("a", "2026-05-26", 100));
    var payload = buildExportPayload([makeOrder("b", "2026-05-25", 40)], { version: 1 }, {});
    var parsed = readImportPayload(JSON.stringify(payload));
    expect(parsed.orders).toHaveLength(1);

    importOrdersFromPayload(parsed, "merge");
    expect(loadOrders()).toHaveLength(2);

    importOrdersFromPayload(parsed, "replace");
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].id).toBe("b");
  });

  it("loads orders from the API when available and mirrors them locally", async function () {
    var apiOrder = makeOrder("api-a", "2026-05-26", 100);
    var requestedUrl = "";
    useHttpApiRuntime(function (url) {
      requestedUrl = url;
      return jsonResponse({ orders: [apiOrder] });
    });

    var orders = await loadOrdersWithApiFallback();

    expect(requestedUrl).toBe("/api/orders");
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("api-a");
    expect(loadOrders()[0].id).toBe("api-a");
  });

  it("keeps the API database id when an API order maps to an old local id", async function () {
    upsertOrder(makeOrder("old-local-id", "2026-05-26", 100));
    var apiOrder = Object.assign({}, makeOrder("db-order-id", "2026-05-26", 100), {
      clientOrderId: "old-local-id"
    });
    useHttpApiRuntime(function () {
      return jsonResponse({ orders: [apiOrder] });
    });

    var orders = await loadOrdersWithApiFallback();

    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("db-order-id");
    expect(orders[0].clientOrderId).toBe("old-local-id");
    expect(loadOrders()[0].id).toBe("db-order-id");
    expect(loadOrders()[0].clientOrderId).toBe("old-local-id");
  });

  it("supports runtime API origin configuration without an explicit /api suffix", async function () {
    var apiOrder = makeOrder("api-origin", "2026-05-26", 100);
    var requestedUrl = "";
    globalThis.ERP_API_BASE_URL = "http://127.0.0.1:3001";
    useHttpApiRuntime(function (url) {
      requestedUrl = url;
      return jsonResponse({ orders: [apiOrder] });
    });

    var orders = await loadOrdersWithApiFallback();

    expect(requestedUrl).toBe("http://127.0.0.1:3001/api/orders");
    expect(orders[0].id).toBe("api-origin");
  });

  it("saves API login tokens and sends bearer authorization on later requests", async function () {
    var requestedAuthHeader = "";
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/auth/login") {
        var body = JSON.parse(options.body);
        expect(body.username).toBe("admin");
        expect(body.password).toBe("secret");
        return jsonResponse({
          token: "jwt-token",
          tokenType: "Bearer",
          user: { username: "admin", roles: ["ADMIN"] }
        });
      }
      requestedAuthHeader = options.headers.Authorization;
      return jsonResponse({ orders: [] });
    });

    await loginToApi("admin", "secret");
    await loadOrdersWithApiFallback();

    expect(getApiAuthToken()).toBe("jwt-token");
    expect(requestedAuthHeader).toBe("Bearer jwt-token");
  });

  it("clears API login tokens when the API returns 401", async function () {
    useHttpApiRuntime(function (url) {
      if (url === "/api/auth/login") {
        return jsonResponse({ token: "expired-token", tokenType: "Bearer" });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        text: function () {
          return Promise.resolve(JSON.stringify({ code: "AUTH_INVALID", message: "expired" }));
        }
      });
    });

    await loginToApi("admin", "secret");
    var orders = await loadOrdersWithApiFallback();

    expect(orders).toHaveLength(0);
    expect(getApiAuthToken()).toBe("");
  });

  it("fetches frontend config through the API with bearer auth", async function () {
    var requestedUrl = "";
    var requestedOptions = null;
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/auth/login") {
        return jsonResponse({ token: "config-read-token", tokenType: "Bearer" });
      }
      requestedUrl = url;
      requestedOptions = options;
      return jsonResponse({
        config: { version: 1, mapSettings: { enabled: true } },
        source: "database"
      });
    });

    await loginToApi("admin", "secret");
    var payload = await fetchConfigFromApi();

    expect(requestedUrl).toBe("/api/config");
    expect(requestedOptions.method).toBeUndefined();
    expect(requestedOptions.headers.Authorization).toBe("Bearer config-read-token");
    expect(payload.source).toBe("database");
    expect(payload.config.mapSettings.enabled).toBe(true);
  });

  it("saves frontend config through the API with JSON body and bearer auth", async function () {
    var requestedUrl = "";
    var requestedOptions = null;
    var config = { version: 2, basics: { fixedWidth: 1.05 } };
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/auth/login") {
        return jsonResponse({ token: "config-write-token", tokenType: "Bearer" });
      }
      requestedUrl = url;
      requestedOptions = options;
      return jsonResponse({ config: config, source: "database" });
    });

    await loginToApi("admin", "secret");
    var payload = await saveConfigToApi(config);

    expect(requestedUrl).toBe("/api/config");
    expect(requestedOptions.method).toBe("PUT");
    expect(requestedOptions.headers.Authorization).toBe("Bearer config-write-token");
    expect(requestedOptions.headers["Content-Type"]).toBe("application/json");
    expect(requestedOptions.body).toBe(JSON.stringify({ config: config }));
    expect(payload).toEqual({ config: config, source: "database" });
  });

  it("throws the existing API error shape when config API requests fail", async function () {
    useHttpApiRuntime(function () {
      return Promise.resolve({
        ok: false,
        status: 400,
        text: function () {
          return Promise.resolve(JSON.stringify({ code: "INVALID_CONFIG_PAYLOAD", message: "Config payload is invalid." }));
        }
      });
    });

    var error = null;
    try {
      await saveConfigToApi([]);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeTruthy();
    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_CONFIG_PAYLOAD");
    expect(error.message).toBe("Config payload is invalid.");
  });

  it("uploads order map images through multipart API requests", async function () {
    var requestedUrl = "";
    var requestedOptions = null;
    useHttpApiRuntime(function (url, options) {
      requestedUrl = url;
      requestedOptions = options;
      return jsonResponse({ ok: true, image: { id: "image-1", orderId: "order 1" } });
    });

    var payload = await uploadOrderMapImageToApi("order 1", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), {
      fileName: "map.png",
      width: 640,
      height: 320
    });

    expect(requestedUrl).toBe("/api/orders/order%201/map-image");
    expect(requestedOptions.method).toBe("POST");
    expect(requestedOptions.headers.Accept).toBe("application/json");
    expect(requestedOptions.headers["Content-Type"]).toBeUndefined();
    expect(requestedOptions.body).toBeInstanceOf(FormData);
    expect(requestedOptions.body.get("image").type).toBe("image/png");
    expect(requestedOptions.body.get("width")).toBe("640");
    expect(requestedOptions.body.get("height")).toBe("320");
    expect(payload.image.id).toBe("image-1");
  });

  it("reads order map images as blobs with bearer auth support", async function () {
    var requestedHeaders = null;
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/auth/login") {
        return jsonResponse({ token: "image-token", tokenType: "Bearer" });
      }
      requestedHeaders = options.headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: function () {
          return Promise.resolve(new Blob([new Uint8Array([4, 5, 6])], { type: "image/webp" }));
        },
        text: function () {
          throw new Error("blob responses should not be parsed as text");
        }
      });
    });

    await loginToApi("admin", "secret");
    var blob = await fetchOrderMapImageBlobFromApi("image-order");

    expect(requestedHeaders.Accept).toBe("image/*");
    expect(requestedHeaders.Authorization).toBe("Bearer image-token");
    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBe(3);
  });

  it("deletes order map images through the API", async function () {
    var requestedUrl = "";
    var requestedMethod = "";
    useHttpApiRuntime(function (url, options) {
      requestedUrl = url;
      requestedMethod = options.method;
      return jsonResponse({ ok: true, deleted: true });
    });

    var payload = await deleteOrderMapImageFromApi("image-order");

    expect(requestedUrl).toBe("/api/orders/image-order/map-image");
    expect(requestedMethod).toBe("DELETE");
    expect(payload.deleted).toBe(true);
  });

  it("saves orders through the API when available and caches the response locally", async function () {
    useHttpApiRuntime(function (url, options) {
      var body = JSON.parse(options.body);
      expect(url).toBe("/api/orders");
      expect(options.method).toBe("POST");
      return jsonResponse({ order: Object.assign({}, body, {
        orderNo: "API-001",
        clientOrderId: body.id
      }) });
    });

    var saved = await upsertOrderWithApiFallback(makeOrder("api-save", "2026-05-26", 100));

    expect(saved.orderNo).toBe("API-001");
    expect(saved.clientOrderId).toBe("api-save");
    expect(loadOrders()[0].orderNo).toBe("API-001");
    expect(loadOrders()[0].clientOrderId).toBe("api-save");
  });

  it("updates existing orders through the API with PUT and caches the response locally", async function () {
    var original = Object.assign({}, makeOrder("db-update-id", "2026-05-26", 100), {
      clientOrderId: "client-edit-id"
    });
    upsertOrder(original);
    var requestedUrl = "";
    var requestedMethod = "";
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: [original] });
      var body = JSON.parse(options.body);
      requestedUrl = url;
      requestedMethod = options.method;
      expect(body.id).toBe("db-update-id");
      expect(body.orderNo).toBe("ORD-db-update-id");
      expect(body.clientOrderId).toBe("client-edit-id");
      var apiOrder = Object.assign({}, body, { customerName: "Updated API Customer" });
      delete apiOrder.clientOrderId;
      return jsonResponse({ order: apiOrder });
    });

    var saved = await updateOrderWithApiFallback("db-update-id", Object.assign({}, original, {
      customerName: "Edited Customer",
      orderNo: original.orderNo,
      clientOrderId: original.clientOrderId
    }));

    expect(requestedUrl).toBe("/api/orders/db-update-id");
    expect(requestedMethod).toBe("PUT");
    expect(saved.customerName).toBe("Updated API Customer");
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].customerName).toBe("Updated API Customer");
    expect(loadOrders()[0].orderNo).toBe("ORD-db-update-id");
    expect(loadOrders()[0].clientOrderId).toBe("client-edit-id");
  });

  it("maps an old local id to the API database id before updating", async function () {
    var oldLocal = Object.assign({}, makeOrder("old-update-id", "2026-05-26", 100), {
      clientOrderId: ""
    });
    var apiOrder = Object.assign({}, makeOrder("db-update-id", "2026-05-26", 100), {
      clientOrderId: "old-update-id"
    });
    upsertOrder(oldLocal);
    var requestedUrl = "";
    var requestedBody = null;
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: [apiOrder] });
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return jsonResponse({ order: Object.assign({}, requestedBody, {
        customerName: "Updated Through DB ID"
      }) });
    });

    var saved = await updateOrderWithApiFallback("old-update-id", Object.assign({}, oldLocal, {
      customerName: "Edited Customer"
    }));

    expect(requestedUrl).toBe("/api/orders/db-update-id");
    expect(requestedBody.id).toBe("db-update-id");
    expect(requestedBody.clientOrderId).toBe("old-update-id");
    expect(saved.id).toBe("db-update-id");
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].id).toBe("db-update-id");
    expect(loadOrders()[0].clientOrderId).toBe("old-update-id");
  });

  it("falls back to localStorage when the update API is unavailable", async function () {
    var original = makeOrder("local-update-id", "2026-05-26", 100);
    upsertOrder(original);
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("offline"));
    });

    var saved = await updateOrderWithApiFallback("local-update-id", Object.assign({}, original, {
      customerName: "Local Edited Customer"
    }));

    expect(saved.id).toBe("local-update-id");
    expect(saved.customerName).toBe("Local Edited Customer");
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].customerName).toBe("Local Edited Customer");
  });

  it("falls back to localStorage when the save API is unavailable", async function () {
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("offline"));
    });

    var saved = await upsertOrderWithApiFallback(makeOrder("local-save", "2026-05-26", 100));

    expect(saved.id).toBe("local-save");
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].id).toBe("local-save");
  });

  it("deletes orders through the API before removing the local cache", async function () {
    upsertOrder(makeOrder("db-delete-id", "2026-05-26", 100));
    var requestedUrl = "";
    var requestedMethod = "";
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: loadOrders() });
      requestedUrl = url;
      requestedMethod = options.method;
      expect(loadOrders()).toHaveLength(1);
      return jsonResponse({ ok: true });
    });

    var orders = await deleteOrderWithApiFallback("db-delete-id");

    expect(requestedUrl).toBe("/api/orders/db-delete-id");
    expect(requestedMethod).toBe("DELETE");
    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("maps an old local id to the API database id before deleting", async function () {
    upsertOrder(makeOrder("old-delete-id", "2026-05-26", 100));
    var apiOrder = Object.assign({}, makeOrder("db-delete-id", "2026-05-26", 100), {
      clientOrderId: "old-delete-id"
    });
    var requestedUrl = "";
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: [apiOrder] });
      requestedUrl = url;
      expect(options.method).toBe("DELETE");
      return jsonResponse({ ok: true });
    });

    var orders = await deleteOrderWithApiFallback("old-delete-id");

    expect(requestedUrl).toBe("/api/orders/db-delete-id");
    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("maps an old local id to the API database id by orderNo before deleting", async function () {
    var oldLocal = makeOrder("old-delete-by-order-no", "2026-05-26", 100);
    var apiOrder = Object.assign({}, makeOrder("db-delete-by-order-no", "2026-05-26", 100), {
      orderNo: oldLocal.orderNo,
      clientOrderId: ""
    });
    upsertOrder(oldLocal);
    var requestedUrl = "";
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: [apiOrder] });
      requestedUrl = url;
      expect(options.method).toBe("DELETE");
      return jsonResponse({ ok: true });
    });

    var orders = await deleteOrderWithApiFallback(oldLocal.id, oldLocal);

    expect(requestedUrl).toBe("/api/orders/db-delete-by-order-no");
    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("warns with delete context when the resolved API delete fails", async function () {
    var oldLocal = makeOrder("old-delete-fail", "2026-05-26", 100);
    var apiOrder = Object.assign({}, makeOrder("db-delete-fail", "2026-05-26", 100), {
      orderNo: oldLocal.orderNo,
      clientOrderId: "old-delete-fail"
    });
    upsertOrder(oldLocal);
    var warnCalls = [];
    var originalWarn = console.warn;
    console.warn = function () {
      warnCalls.push(Array.prototype.slice.call(arguments));
    };
    useHttpApiRuntime(function (url) {
      if (url === "/api/orders") return jsonResponse({ orders: [apiOrder] });
      return Promise.reject(new Error("delete failed"));
    });

    try {
      var error = null;
      try {
        await deleteOrderWithApiFallback(oldLocal.id, oldLocal);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeTruthy();
      expect(loadOrders()).toHaveLength(1);
      expect(warnCalls.some(function (call) {
        return call[0] === "Order API delete failed; local cache was not removed." &&
          call[1] &&
          call[1].attemptedId === "db-delete-fail" &&
          call[1].orderNo === oldLocal.orderNo &&
          call[1].clientOrderId === "old-delete-fail" &&
          call[1].reason === "delete failed";
      })).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("keeps localStorage when the configured delete API is unavailable", async function () {
    upsertOrder(makeOrder("local-delete-id", "2026-05-26", 100));
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("offline"));
    });

    var error = null;
    try {
      await deleteOrderWithApiFallback("local-delete-id");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeTruthy();
    expect(loadOrders()).toHaveLength(1);
    expect(loadOrders()[0].id).toBe("local-delete-id");
  });

  it("deletes from localStorage when no API is configured", async function () {
    upsertOrder(makeOrder("offline-delete-id", "2026-05-26", 100));

    var orders = await deleteOrderWithApiFallback("offline-delete-id");

    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("clears all orders through the API and removes each local cache entry after delete success", async function () {
    upsertOrder(makeOrder("bulk-delete-a", "2026-05-26", 100));
    upsertOrder(makeOrder("bulk-delete-b", "2026-05-26", 40));
    var deleteUrls = [];
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: loadOrders() });
      deleteUrls.push(url);
      expect(options.method).toBe("DELETE");
      expect(loadOrders().some(function (order) {
        return url.indexOf(encodeURIComponent(order.id)) !== -1;
      })).toBe(true);
      return jsonResponse({ ok: true });
    });

    var orders = await clearOrdersWithApiFallback();

    expect(deleteUrls).toHaveLength(2);
    expect(deleteUrls).toEqual(expect.arrayContaining([
      "/api/orders/bulk-delete-a",
      "/api/orders/bulk-delete-b"
    ]));
    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("clears all orders using API database ids instead of old local ids", async function () {
    upsertOrder(makeOrder("old-bulk-a", "2026-05-26", 100));
    upsertOrder(makeOrder("old-bulk-b", "2026-05-26", 40));
    var apiOrders = [
      Object.assign({}, makeOrder("db-bulk-a", "2026-05-26", 100), { clientOrderId: "old-bulk-a" }),
      Object.assign({}, makeOrder("db-bulk-b", "2026-05-26", 40), { clientOrderId: "old-bulk-b" })
    ];
    var deleteUrls = [];
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: apiOrders });
      deleteUrls.push(url);
      expect(options.method).toBe("DELETE");
      return jsonResponse({ ok: true });
    });

    var orders = await clearOrdersWithApiFallback();

    expect(deleteUrls).toHaveLength(2);
    expect(deleteUrls).toEqual(expect.arrayContaining([
      "/api/orders/db-bulk-a",
      "/api/orders/db-bulk-b"
    ]));
    expect(deleteUrls).not.toContain("/api/orders/old-bulk-a");
    expect(deleteUrls).not.toContain("/api/orders/old-bulk-b");
    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("keeps failed bulk API deletes in localStorage and warns with the order id", async function () {
    upsertOrder(makeOrder("bulk-delete-ok", "2026-05-26", 100));
    upsertOrder(makeOrder("bulk-delete-fail", "2026-05-26", 40));
    var warnCalls = [];
    var originalWarn = console.warn;
    console.warn = function () {
      warnCalls.push(Array.prototype.slice.call(arguments));
    };
    useHttpApiRuntime(function (url, options) {
      if (url === "/api/orders") return jsonResponse({ orders: loadOrders() });
      expect(options.method).toBe("DELETE");
      if (url === "/api/orders/bulk-delete-fail") return Promise.reject(new Error("delete failed"));
      return jsonResponse({ ok: true });
    });

    try {
      var orders = await clearOrdersWithApiFallback();

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe("bulk-delete-fail");
      expect(loadOrders()).toHaveLength(1);
      expect(loadOrders()[0].id).toBe("bulk-delete-fail");
      expect(warnCalls.some(function (call) {
        return call[1] && call[1].orderId === "bulk-delete-fail" && call[1].reason === "delete failed";
      })).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("clears localStorage directly when no API is configured", async function () {
    upsertOrder(makeOrder("bulk-offline-a", "2026-05-26", 100));
    upsertOrder(makeOrder("bulk-offline-b", "2026-05-26", 40));

    var orders = await clearOrdersWithApiFallback();

    expect(orders).toHaveLength(0);
    expect(loadOrders()).toHaveLength(0);
  });

  it("keeps localStorage when bulk clear cannot read the configured API", async function () {
    upsertOrder(makeOrder("bulk-read-fail-a", "2026-05-26", 100));
    var warnCalls = [];
    var originalWarn = console.warn;
    console.warn = function () {
      warnCalls.push(Array.prototype.slice.call(arguments));
    };
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("read failed"));
    });

    try {
      var orders = await clearOrdersWithApiFallback();

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe("bulk-read-fail-a");
      expect(loadOrders()).toHaveLength(1);
      expect(warnCalls.some(function (call) {
        return call[0] === "Order API bulk clear read failed; local cache was not cleared." &&
          call[1] && call[1].reason === "read failed";
      })).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});
