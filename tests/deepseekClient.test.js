import { describe, expect, it } from "vitest";
import { parseDeepSeekEvaluation } from "../backend/src/deepseekClient.js";

describe("DeepSeek cutting advice client", function () {
  it("parses score JSON that was returned as a string value", function () {
    var raw = JSON.stringify(JSON.stringify({
      score: 8.7,
      label: "可用"
    }));
    var evaluation = parseDeepSeekEvaluation(raw);

    expect(evaluation).toEqual({ score: 8.7, label: "可用" });
  });

  it("extracts score JSON from a fenced response", function () {
    var raw = "```json\n{\"score\":9.2,\"label\":\"推荐\",\"reasons\":[\"旧字段不应外显\"]}\n```";
    var evaluation = parseDeepSeekEvaluation(raw);

    expect(evaluation).toEqual({ score: 9.2, label: "推荐" });
    expect(evaluation.reasons).toBeUndefined();
  });

  it("does not expose old long evaluation JSON without a score", function () {
    var evaluation = parseDeepSeekEvaluation(JSON.stringify({
      summary: "推荐使用方案一，零剩料。",
      reasons: ["材料利用率最高"],
      cautions: ["裁切前复核数量"]
    }));

    expect(evaluation).toEqual({ score: null, label: "" });
  });

  it("parses a compact plain text score when DeepSeek does not return JSON", function () {
    var evaluation = parseDeepSeekEvaluation("AI参考评分：6.4分，标签：一般");

    expect(evaluation).toEqual({ score: 6.4, label: "一般" });
  });

  it("falls back to a derived label when the label is missing", function () {
    var evaluation = parseDeepSeekEvaluation("{\"score\":7.6}");

    expect(evaluation).toEqual({ score: 7.6, label: "可用" });
  });
});
