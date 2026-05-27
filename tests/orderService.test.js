import { beforeEach, describe, expect, it } from "vitest";
import {
  buildExportPayload,
  getOrderTrend,
  getOrderStats,
  importOrdersFromPayload,
  loadOrders,
  mergeOrders,
  normalizeOrder,
  readImportPayload,
  upsertOrder
} from "../src/scripts/services/orderService.js";

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

beforeEach(function () {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorageMock(),
    configurable: true
  });
});

describe("order service", function () {
  it("normalizes records and recomputes grand amount from saved totals", function () {
    var order = makeOrder("a", "2026-05-26", 100);
    expect(order.id).toBe("a");
    expect(order.orderNo).toBe("ORD-a");
    expect(order.totals.areaTotal).toBe(12.5);
    expect(order.totals.grandAmount).toBe(110);
    expect(order.items.mainRows).toHaveLength(1);
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
});
