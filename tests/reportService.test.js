import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/scripts/config/defaultConfig.js";
import { buildPreferredReport } from "../src/scripts/services/reportService.js";

function cloneConfig() {
  return JSON.parse(JSON.stringify(defaultConfig));
}

function makeSnapshot(patch) {
  return Object.assign({
    orderDate: "2026-04-19",
    orderNo: "ORD-PRINT-001",
    customerName: "测试客户",
    tileColor: "枣红色",
    remark: "补单",
    unitPrice: 32,
    mainAmount: 384,
    mainRows: [
      { lengthsText: "2.628", totalQty: 4, actual: 12, area: 12.6 }
    ],
    accessories: [],
    steels: [],
    otherTiles: []
  }, patch || {});
}

function todayString() {
  var today = new Date();
  return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
}

describe("report service", function () {
  it("uses order date, order number and remark in the full report header", function () {
    var report = buildPreferredReport(makeSnapshot(), cloneConfig());
    var systemDate = todayString();
    expect(report.type).toBe("full");
    expect(report.data.dateStr).toBe("2026-04-19");
    expect(report.data.orderDate).toBe("2026-04-19");
    expect(report.html).toContain("2026-04-19");
    expect(report.html).toContain("订单编号");
    expect(report.html).toContain("ORD-PRINT-001");
    expect(report.html).toContain("备注：补单");
    if (systemDate !== "2026-04-19") {
      expect(report.html).not.toContain(systemDate);
    }
  });

  it("omits the remark row when remark is blank", function () {
    var report = buildPreferredReport(makeSnapshot({ remark: "   " }), cloneConfig());
    expect(report.html).not.toContain("备注：");
  });

  it("keeps shared order fields in accessory-only reports", function () {
    var report = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      accessories: [{ name: "正脊瓦", qty: 2, unit: "件", price: 20, subtotal: 40 }]
    }), cloneConfig());
    expect(report.type).toBe("accessory");
    expect(report.html).toContain("2026-04-19");
    expect(report.html).toContain("ORD-PRINT-001");
    expect(report.html).toContain("测试客户");
    expect(report.html).toContain("备注：补单");
  });

  it("keeps shared order fields in roof material reports", function () {
    var report = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      accessories: [{ name: "正脊瓦", qty: 2, unit: "件", price: 20, subtotal: 40 }],
      steels: [{ name: "角码", qty: 4, unit: "个", price: 2, subtotal: 8 }]
    }), cloneConfig());
    expect(report.type).toBe("roof-material");
    expect(report.html).toContain("2026-04-19");
    expect(report.html).toContain("ORD-PRINT-001");
    expect(report.html).toContain("测试客户");
    expect(report.html).toContain("备注：补单");
  });

  it("keeps shared order fields in steel and other tile reports", function () {
    var steelReport = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      steels: [{ name: "镀锌方管 40×80 厚 1.8", qty: 1, unit: "支", price: 50, subtotal: 50 }]
    }), cloneConfig());
    var otherTileReport = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      otherTiles: [{ name: "透明瓦", length: 2.5, qty: 3, unit: "片", price: 18, subtotal: 54 }]
    }), cloneConfig());

    expect(steelReport.type).toBe("steel");
    expect(steelReport.html).toContain("ORD-PRINT-001");
    expect(steelReport.html).toContain("备注：补单");
    expect(steelReport.html).toContain("镀锌工艺：双镀锌");
    expect(otherTileReport.type).toBe("other-tile");
    expect(otherTileReport.html).toContain("ORD-PRINT-001");
    expect(otherTileReport.html).toContain("备注：补单");
  });
});
