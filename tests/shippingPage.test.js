import { describe, expect, it } from "vitest";
import {
  attachMainTileSegmentLength,
  formatInputPrice,
  normalizeOrderSegmentLength
} from "../src/scripts/components/shipping/shippingPage.js";

describe("shipping page price inputs", function () {
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
});
