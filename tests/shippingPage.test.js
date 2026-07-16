import { describe, expect, it } from "vitest";
import {
  attachMainTileSegmentLength,
  buildConfiguredSelectOptions,
  computeOtherTileSubtotal,
  computeOtherTileTotalLength,
  formatInputPrice,
  hasWorkingDraftContent,
  normalizeOrderSegmentLength
} from "../src/scripts/components/shipping/shippingPage.js";

describe("shipping page price inputs", function () {
  it("builds configured optional selects and preserves an unavailable old value", function () {
    var items = [
      { value: "自提", sort: 20, enabled: true },
      { value: "包配送", sort: 10, enabled: false },
      { value: "货拉拉配送", sort: 30, enabled: true }
    ];

    expect(buildConfiguredSelectOptions(items, "")).toEqual({
      selectedValue: "",
      options: [
        { value: "", label: "请选择", legacy: false },
        { value: "自提", label: "自提", legacy: false },
        { value: "货拉拉配送", label: "货拉拉配送", legacy: false }
      ]
    });
    expect(buildConfiguredSelectOptions(items, "包配送")).toEqual({
      selectedValue: "包配送",
      options: [
        { value: "", label: "请选择", legacy: false },
        { value: "自提", label: "自提", legacy: false },
        { value: "货拉拉配送", label: "货拉拉配送", legacy: false },
        { value: "包配送", label: "包配送（原值）", legacy: true }
      ]
    });
  });

  it("renders blank accessory and steel default prices when configured as empty or zero", function () {
    var options = { blankZero: true };

    expect(formatInputPrice({ defaultPrice: 0 }, options)).toBe("");
    expect(formatInputPrice({ defaultPrice: null }, options)).toBe("");
    expect(formatInputPrice({ defaultPrice: undefined }, options)).toBe("");
    expect(formatInputPrice({ defaultPrice: "" }, options)).toBe("");
  });

  it("keeps positive default prices visible", function () {
    var options = { blankZero: true };

    expect(formatInputPrice({ defaultPrice: 12.5 }, options)).toBe("12.5");
    expect(formatInputPrice({ defaultPrice: "8" }, options)).toBe("8");
  });

  it("calculates other tile total length and subtotal from single length, pieces and unit price", function () {
    expect(computeOtherTileTotalLength(1.5, 10)).toBe(15);
    expect(computeOtherTileSubtotal(1.5, 10, 20)).toBe(300);
    expect(Number.isNaN(computeOtherTileSubtotal(NaN, 10, 20))).toBe(true);
    expect(Number.isNaN(computeOtherTileSubtotal(1.5, NaN, 20))).toBe(true);
  });

  it("attaches the current main tile segment length to saved main rows", function () {
    var rows = attachMainTileSegmentLength([
      { lengthsText: "2.5", area: 8 }
    ], "0.218");

    expect(rows).toEqual([
      { lengthsText: "2.5", area: 8, segmentLength: 0.218 }
    ]);
    expect(normalizeOrderSegmentLength("0.219")).toBe(0.219);
    expect(Number.isNaN(normalizeOrderSegmentLength(""))).toBe(true);
    expect(attachMainTileSegmentLength([{ lengthsText: "2.5" }], "")).toEqual([{ lengthsText: "2.5" }]);
  });

  it("treats incomplete input rows as meaningful working draft content", function () {
    expect(hasWorkingDraftContent({
      order: { orderDate: "2026-07-13" },
      mainTile: { segmentLength: "0.219", unitPrice: "33" },
      mainRows: [],
      accessories: [],
      steels: [],
      otherTiles: []
    })).toBe(false);
    expect(hasWorkingDraftContent({ mainRows: [{ segmentCount: "20", quantity: "" }] })).toBe(true);
    expect(hasWorkingDraftContent({ order: { customerName: "待录客户" } })).toBe(true);
  });
});
