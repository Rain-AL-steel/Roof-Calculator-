import { describe, expect, it } from "vitest";
import {
  exportWorkingDraft,
  parseWorkingDraftFile,
  WORKING_DRAFT_APP,
  WORKING_DRAFT_VERSION
} from "../src/scripts/services/workingDraftService.js";

describe("working draft service", function () {
  it("exports a small versioned JSON file and imports it without enforcing its original owner", function () {
    var exported = exportWorkingDraft("admin", {
      order: { customerName: "测试/客户", orderDate: "2026-07-13" },
      mainRows: [{ projectionLength: "3.2", segmentCount: "16", quantity: "2" }]
    });
    var parsed = parseWorkingDraftFile(exported.json);

    expect(exported.fileName).toBe("红波订单草稿_测试-客户_2026-07-13.json");
    expect(parsed.app).toBe(WORKING_DRAFT_APP);
    expect(parsed.version).toBe(WORKING_DRAFT_VERSION);
    expect(parsed.draft.mainRows[0].segmentCount).toBe("16");
  });

  it("rejects invalid JSON, foreign files and unsupported versions", function () {
    expect(function () { parseWorkingDraftFile("not-json"); }).toThrow("有效的 JSON");
    expect(function () { parseWorkingDraftFile({ app: "other", version: 1, draft: {} }); }).toThrow("不是红波计算机订单草稿");
    expect(function () { parseWorkingDraftFile({ app: WORKING_DRAFT_APP, version: 2, draft: {} }); }).toThrow("版本不受支持");
  });

  it("creates files without mutating the current draft object", function () {
    var draft = { order: { customerName: "本地文件" }, mainRows: [{ length: "2.5" }] };
    var exported = exportWorkingDraft("admin", draft);

    expect(exported.data.owner).toBe("admin");
    expect(exported.data.draft.mainRows[0].length).toBe("2.5");
    expect(draft.mainRows[0].length).toBe("2.5");
  });

  it("creates and parses draft files without accessing localStorage", function () {
    var originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: function () { throw new Error("localStorage must not be accessed"); }
    });

    try {
      var exported = exportWorkingDraft("admin", { order: { customerName: "纯文件草稿" } });
      expect(parseWorkingDraftFile(exported.json).draft.order.customerName).toBe("纯文件草稿");
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      else delete globalThis.localStorage;
    }
  });
});
