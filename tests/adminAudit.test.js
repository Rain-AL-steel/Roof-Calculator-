import { describe, expect, it } from "vitest";
import { getAuditActionLabel, summarizeAuditLog } from "../src/scripts/components/admin/adminPage.js";

describe("admin audit records", function () {
  it("uses clear Chinese labels for order audit actions", function () {
    expect(getAuditActionLabel("ORDER_CREATE")).toBe("新建订单");
    expect(getAuditActionLabel("ORDER_UPDATE")).toBe("修改订单");
    expect(getAuditActionLabel("ORDER_DELETE")).toBe("删除订单");
  });

  it("summarizes changed order fields without exposing the full payload", function () {
    var summary = summarizeAuditLog({
      action: "ORDER_UPDATE",
      before: {
        customerName: "旧客户",
        orderDate: "2026-08-01",
        deliveryAddress: "旧地址",
        areaTotal: 10,
        grandAmount: 100
      },
      after: {
        customerName: "新客户",
        orderDate: "2026-08-01",
        deliveryAddress: "新地址",
        areaTotal: 12.5,
        grandAmount: 128
      }
    });

    expect(summary).toContain("客户：旧客户 → 新客户");
    expect(summary).toContain("地址：旧地址 → 新地址");
    expect(summary).toContain("面积：10㎡ → 12.5㎡");
    expect(summary).toContain("金额：¥100.00 → ¥128.00");
  });
});
