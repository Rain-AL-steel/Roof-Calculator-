import { describe, expect, it } from "vitest";
import { getOverviewPieColor, getTileColorPieColor } from "../src/scripts/components/dashboard/pieColors.js";

describe("tile color pie palette", function () {
  it("uses the material color for each supported tile color", function () {
    expect(getTileColorPieColor("jujube-red")).toBe("#8f1d3a");
    expect(getTileColorPieColor("gray")).toBe("#73777d");
    expect(getTileColorPieColor("brick-red")).toBe("#c65a3a");
  });

  it("uses a neutral fallback for an unknown tile color", function () {
    expect(getTileColorPieColor("custom-color")).toBe("#9a927f");
  });
});

describe("overview pie palette", function () {
  it("uses red for tiles, gold for accessories, and silver white for steel", function () {
    expect(getOverviewPieColor("tile", 0)).toBe("#a33a32");
    expect(getOverviewPieColor("accessory", 1)).toBe("#c5a45d");
    expect(getOverviewPieColor("steel", 2)).toBe("#cbd0d4");
  });

  it("uses a light neutral fallback for additional categories", function () {
    expect(getOverviewPieColor("custom", 0)).toBe("#9a927f");
    expect(getOverviewPieColor("custom", 5)).toBe("#d6c59b");
  });
});
