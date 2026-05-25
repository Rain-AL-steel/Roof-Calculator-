import { describe, expect, it } from "vitest";
import {
  actualSegments,
  computeArea,
  computeGrandAmount,
  computeLineSubtotal,
  computeMainAmount,
  computeSlopeLength,
  lengthToPreciseSegments,
  segmentCountToLength,
  sumFiniteAmounts
} from "../src/scripts/calc.js";

function expectNaN(value) {
  expect(Number.isNaN(value)).toBe(true);
}

describe("actualSegments", function () {
  it("keeps whole numbers and zero unchanged", function () {
    expect(actualSegments(0)).toBe(0);
    expect(actualSegments(1)).toBe(1);
    expect(actualSegments(12)).toBe(12);
  });

  it("uses the 0.18 down and 0.19 up cutting rule", function () {
    expect(actualSegments(1.18)).toBe(1);
    expect(actualSegments(1.189)).toBe(1);
    expect(actualSegments(1.19)).toBe(2);
    expect(actualSegments(1.191)).toBe(2);
  });

  it("handles invalid and negative values safely", function () {
    expectNaN(actualSegments(NaN));
    expectNaN(actualSegments(Infinity));
    expectNaN(actualSegments(-1));
    expectNaN(actualSegments(""));
  });
});

describe("computeSlopeLength", function () {
  it("converts percent slope to sloped length", function () {
    expect(computeSlopeLength(10, "percent", 0)).toBe(10);
    expect(computeSlopeLength(10, "percent", 25)).toBeCloseTo(10 * Math.sqrt(1 + 0.25 * 0.25), 12);
  });

  it("converts angle to sloped length", function () {
    expect(computeSlopeLength(10, "angle", 0)).toBe(10);
    expect(computeSlopeLength(10, "angle", 60)).toBeCloseTo(20, 12);
    expect(computeSlopeLength(10, "angle", 89.999)).toBeGreaterThan(100000);
  });

  it("rejects unsafe slope inputs", function () {
    expectNaN(computeSlopeLength(-1, "percent", 10));
    expectNaN(computeSlopeLength(10, "percent", -1));
    expectNaN(computeSlopeLength(10, "angle", -1));
    expectNaN(computeSlopeLength(10, "angle", 90));
    expectNaN(computeSlopeLength(10, "angle", Infinity));
    expectNaN(computeSlopeLength("10", "percent", 10));
  });
});

describe("segment and length conversions", function () {
  it("converts segment counts to length using the existing 3-decimal rule", function () {
    expect(segmentCountToLength(1, 0.219)).toBe(0.219);
    expect(segmentCountToLength(3, 0.219)).toBe(0.657);
    expect(segmentCountToLength(1.5, 0.219)).toBe(0.329);
    expect(segmentCountToLength(1000000, 0.219)).toBe(219000);
  });

  it("converts length back to precise segment counts", function () {
    expect(lengthToPreciseSegments(0.219, 0.219)).toBeCloseTo(1, 12);
    expect(lengthToPreciseSegments(0.438, 0.219)).toBeCloseTo(2, 12);
    expect(lengthToPreciseSegments(0.22, 0.219)).toBeGreaterThan(1);
  });

  it("rejects invalid segment and length inputs", function () {
    expectNaN(segmentCountToLength(-1, 0.219));
    expectNaN(segmentCountToLength(1, 0));
    expectNaN(segmentCountToLength(1, NaN));
    expectNaN(lengthToPreciseSegments(-0.1, 0.219));
    expectNaN(lengthToPreciseSegments(1, 0));
    expectNaN(lengthToPreciseSegments("", 0.219));
  });
});

describe("area and amount calculations", function () {
  it("computes area from length, quantity, and fixed width", function () {
    expect(computeArea(2.5, 3, 1.05)).toBeCloseTo(7.875, 12);
    expect(computeArea(0, 3, 1.05)).toBe(0);
    expect(computeArea(2.5, 0, 1.05)).toBe(0);
    expect(computeArea(123456.789, 10, 1.05)).toBeCloseTo(1296296.2845, 8);
  });

  it("rejects unsafe area inputs", function () {
    expectNaN(computeArea(-1, 3, 1.05));
    expectNaN(computeArea(2.5, -1, 1.05));
    expectNaN(computeArea(2.5, 3, 0));
    expectNaN(computeArea("2.5", 3, 1.05));
  });

  it("computes and rounds main tile amount", function () {
    expect(computeMainAmount(10.5, 20)).toBe(210);
    expect(computeMainAmount(12.3456, 38.8)).toBe(479);
    expect(computeMainAmount(0, 38.8)).toBe(0);
  });

  it("returns zero for unsafe main amount inputs", function () {
    expect(computeMainAmount(NaN, 20)).toBe(0);
    expect(computeMainAmount(10, NaN)).toBe(0);
    expect(computeMainAmount(-10, 20)).toBe(0);
    expect(computeMainAmount(10, -20)).toBe(0);
    expect(computeMainAmount("", 20)).toBe(0);
  });

  it("computes line subtotals for accessories, steel, and other tiles", function () {
    expect(computeLineSubtotal(3, 2.5)).toBe(7.5);
    expect(computeLineSubtotal(0, 2.5)).toBe(0);
    expect(computeLineSubtotal(0.1, 0.2)).toBeCloseTo(0.02, 12);
  });

  it("rejects unsafe line subtotal inputs", function () {
    expectNaN(computeLineSubtotal(-1, 2.5));
    expectNaN(computeLineSubtotal(3, -2.5));
    expectNaN(computeLineSubtotal(NaN, 2.5));
    expectNaN(computeLineSubtotal("", 2.5));
  });

  it("sums only safe non-negative amounts", function () {
    expect(sumFiniteAmounts([10, NaN, -5, Infinity, 2.5])).toBe(12.5);
    expect(sumFiniteAmounts([])).toBe(0);
    expect(sumFiniteAmounts(null)).toBe(0);
  });

  it("computes grand totals from safe amounts only", function () {
    expect(computeGrandAmount(100, 20.5, 3.25, 4)).toBe(127.75);
    expect(computeGrandAmount(100, NaN, -20, 4)).toBe(104);
  });
});
