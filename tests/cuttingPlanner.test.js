import { describe, expect, it } from "vitest";
import {
  buildCuttingPlans,
  formatCuttingPlan,
  normalizeCuttingPieces
} from "../src/scripts/services/cuttingPlanner.js";

describe("cutting planner", function () {
  function getPlanSignature(plan) {
    return plan.cuts.map(function (cut) {
      return cut.signature + "x" + cut.repeat;
    }).sort().join("|");
  }

  it("finds a 60-segment zero-waste board", function () {
    var result = buildCuttingPlans({
      stockSegments: 60,
      pieces: [
        { segments: 20, qty: 3, lengthText: "4.36", segmentLength: 0.218 }
      ]
    });

    expect(result.plans[0].boardCount).toBe(1);
    expect(result.plans[0].totalWasteSegments).toBe(0);
    expect(result.plans[0].fullBoardCount).toBe(1);
    expect(result.plans[0].score).toBeGreaterThanOrEqual(9);
    expect(result.plans[0].cutPieceCount).toBe(3);
    expect(result.plans[0].estimatedCutRounds).toBe(1);
    expect(result.plans[0].cuttingRounds).toEqual([
      expect.objectContaining({ pieces: [20, 20, 20], wasteSegments: 0, lineText: "20 + 20 + 20，剩0" })
    ]);
    expect(result.plans[0].cuts[0].lineText).toBe("20 + 20 + 20 = 剩0");
    expect(result.plans[0].cuts[0].usedSegments).toBe(60);
  });

  it("builds cutting rounds with at most three pieces per round", function () {
    var result = buildCuttingPlans([
      { actual: 15, totalQty: 4 }
    ]);
    var plan = result.plans[0];

    expect(plan.boardCount).toBe(1);
    expect(plan.cuttingRounds).toHaveLength(2);
    expect(plan.estimatedCutRounds).toBe(2);
    expect(plan.cuttingRounds.every(function (round) {
      return round.pieces.length <= 3;
    })).toBe(true);
    expect(plan.cuttingRounds[0].lineText).toBe("15 + 15 + 15");
    expect(plan.cuttingRounds[1].lineText).toBe("15，剩0");
  });

  it("generates multiple distinct plans when alternate cuts are useful", function () {
    var result = buildCuttingPlans([
      { actual: 35, totalQty: 2 },
      { actual: 25, totalQty: 2 },
      { actual: 20, totalQty: 3 },
      { actual: 15, totalQty: 4 }
    ]);
    var signatures = result.plans.map(getPlanSignature);

    expect(result.plans).toHaveLength(3);
    expect(new Set(signatures).size).toBe(result.plans.length);
    expect(result.plans[0].strategyLabel).toContain("推荐方案");
    expect(result.plans.map(function (plan) { return plan.strategyLabel; }).join(" ")).toContain("少刀数");
    expect(result.plans.map(function (plan) { return plan.strategyLabel; }).join(" ")).toContain("同规格集中");
    expect(result.plans[0].score).toBeGreaterThanOrEqual(result.plans[1].score);
    expect(result.plans[1].score).toBeGreaterThanOrEqual(result.plans[2].score);
  });

  it("deduplicates repeated strategies instead of showing the same cuts twice", function () {
    var result = buildCuttingPlans([
      { actual: 20, totalQty: 3 }
    ]);
    var signatures = result.plans.map(getPlanSignature);

    expect(result.plans).toHaveLength(1);
    expect(new Set(signatures).size).toBe(1);
    expect(result.warnings.join(" ")).toContain("只有一个有效裁板方案");
    expect(result.plans[0].summaryText).toContain("只有一个有效裁板方案");
  });

  it("uses the least local waste when no exact board is possible", function () {
    var result = buildCuttingPlans([
      { actual: 22, totalQty: 2, lengthsText: "4.796", segmentLength: 0.218 }
    ]);

    expect(result.plans[0].boardCount).toBe(1);
    expect(result.plans[0].totalWasteSegments).toBe(16);
    expect(result.plans[0].cuts[0].usedSegments).toBe(44);
  });

  it("handles multiple quantities and repeated zero-waste cuts", function () {
    var result = buildCuttingPlans([
      { actual: 23, totalQty: 4, lengthsText: "5.014" },
      { actual: 14, totalQty: 2, lengthsText: "3.052" }
    ]);

    expect(result.plans[0].boardCount).toBe(2);
    expect(result.plans[0].totalWasteSegments).toBe(0);
    expect(result.plans[0].fullBoardCount).toBe(2);
    expect(result.plans[0].cuts[0].repeat).toBe(2);
  });

  it("warns and ignores invalid actual or quantity values", function () {
    var result = buildCuttingPlans([
      { actual: "", totalQty: 2 },
      { actual: 12, totalQty: 0 },
      { actual: 30, totalQty: 2 }
    ]);

    expect(result.pieces).toEqual([
      expect.objectContaining({ segments: 30, qty: 2 })
    ]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    expect(result.plans[0].totalWasteSegments).toBe(0);
  });

  it("warns when a piece is longer than one 60-segment stock board", function () {
    var result = buildCuttingPlans([
      { actual: 61, totalQty: 1 }
    ]);

    expect(result.pieces).toEqual([]);
    expect(result.plans).toEqual([]);
    expect(result.warnings.join(" ")).toContain("超过 60 节");
  });

  it("handles large quantities without expanding every piece", function () {
    var startedAt = Date.now();
    var result = buildCuttingPlans([
      { actual: 20, totalQty: 300 }
    ]);

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(result.plans[0].boardCount).toBe(100);
    expect(result.plans[0].totalWasteSegments).toBe(0);
    expect(result.plans[0].cuts[0].repeat).toBe(100);
  });

  it("normalizes decimal input and formats key plan fields", function () {
    var normalized = normalizeCuttingPieces([
      { actual: 19.8, qty: 3.2, length: 4.3164, segmentLength: 0.218 }
    ]);
    var result = buildCuttingPlans({ pieces: normalized.pieces });
    var text = formatCuttingPlan(result.plans[0]);

    expect(normalized.pieces[0]).toMatchObject({ segments: 20, qty: 3 });
    expect(normalized.warnings.length).toBe(2);
    expect(text).toContain("需要原板");
    expect(text).toContain("评分");
    expect(text).not.toContain("需要裁片");
    expect(text).toContain("主要切法");
  });
});
