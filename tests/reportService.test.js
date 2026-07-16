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

function makeMainRows(count) {
  return Array.from({ length: count }, function (_, index) {
    return {
      lengthsText: "ROW-" + String(index + 1).padStart(2, "0"),
      totalQty: 1,
      actual: 100 - index,
      area: index + 1
    };
  });
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

describe("report service", function () {
  it("uses order date, customer color line and remark in the full report header", function () {
    var report = buildPreferredReport(makeSnapshot(), cloneConfig());
    var systemDate = todayString();
    expect(report.type).toBe("full");
    expect(report.data.dateStr).toBe("2026-04-19");
    expect(report.data.orderDate).toBe("2026-04-19");
    expect(report.html).toContain("2026-04-19");
    expect(report.html).not.toContain("订单编号");
    expect(report.html).toContain("class='meta-customer-line'");
    expect(report.html).toContain("<span>客户：测试客户</span><span>颜色：枣红色</span>");
    expect(report.html).toContain("备注：补单");
    if (systemDate !== "2026-04-19") {
      expect(report.html).not.toContain(systemDate);
    }
  });

  it("prints full report metadata in order and uses the full footer signature layout", function () {
    var report = buildPreferredReport(makeSnapshot({
      steelCategory: "友发",
      galvanizingProcess: "镀锌工艺：双镀锌",
      deliveryMethod: "自提"
    }), cloneConfig());
    var customerIndex = report.html.indexOf("客户：测试客户");
    var colorIndex = report.html.indexOf("颜色：枣红色");
    var steelIndex = report.html.indexOf("钢材类别：友发");
    var processIndex = report.html.indexOf("镀锌工艺：双镀锌");
    var deliveryIndex = report.html.indexOf("配送方式：自提");

    expect(report.data.deliveryMethod).toBe("自提");
    expect(customerIndex).toBeGreaterThan(-1);
    expect(colorIndex).toBeGreaterThan(customerIndex);
    expect(steelIndex).toBeGreaterThan(colorIndex);
    expect(processIndex).toBeGreaterThan(steelIndex);
    expect(deliveryIndex).toBeGreaterThan(processIndex);
    expect(report.html).not.toContain("工艺：镀锌工艺：双镀锌");
    expect(report.html).toContain(".meta{position:static;margin-top:7px;margin-right:170px;");
    expect(report.html).toContain("gap:4px 14px;align-items:baseline");
    expect(report.html).toContain(".meta-customer-line{display:flex;flex-wrap:wrap;");
    expect(report.html).not.toContain(".meta-customer-line{display:grid;grid-template-columns:repeat(3");
    expect(report.html).toContain("grid-template-areas:'address signature' 'phone date'");
    expect(report.html).toContain(".sign-signature{grid-area:signature;align-self:end;");
    expect(report.html).toContain("class='sign-address'");
    expect(report.html).toContain("class='sign-signature'");
    expect(report.html).toContain("class='sign-phone'");
    expect(report.html).toContain("class='sign-date'");

    var signStart = report.html.indexOf("<div class='sign-row'>");
    var signEnd = report.html.indexOf("</div></div>", signStart);
    var signHtml = report.html.slice(signStart, signEnd);
    expect(signHtml.indexOf("class='sign-signature'")).toBeGreaterThan(signHtml.indexOf("class='sign-address'"));
    expect(signHtml.indexOf("class='sign-phone'")).toBeGreaterThan(signHtml.indexOf("class='sign-signature'"));
    expect(signHtml.indexOf("class='sign-date'")).toBeGreaterThan(signHtml.indexOf("class='sign-phone'"));
  });

  it("keeps 20 main rows in the primary column without a continuation table", function () {
    var report = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(20) }), cloneConfig());

    expect(report.type).toBe("full");
    expect(report.html).toContain("data-main-page='1'");
    expect(report.html).not.toContain("data-main-page='2'");
    expect(report.html).not.toContain("data-main-table='continuation'");
    expect(countMatches(report.html, /class='main-data-row'/g)).toBe(20);
    expect(countMatches(report.html, /主瓦总金额/g)).toBe(1);
  });

  it("keeps 21 rows, totals and the compact grand total in the first column", function () {
    var report = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(21) }), cloneConfig());
    var lastRowIndex = report.html.indexOf("ROW-21");
    var grandIndex = report.html.indexOf("全单总合计");
    var accessoryIndex = report.html.indexOf("二、配件清单");
    var otherTileIndex = report.html.indexOf("四、其他瓦 / 特殊瓦");

    expect(report.html).not.toContain("data-main-page='2'");
    expect(report.html).not.toContain("data-main-table='continuation'");
    expect(grandIndex).toBeGreaterThan(lastRowIndex);
    expect(accessoryIndex).toBeGreaterThan(lastRowIndex);
    expect(otherTileIndex).toBeGreaterThan(accessoryIndex);
    expect(grandIndex).toBeGreaterThan(otherTileIndex);
    expect(countMatches(report.html, /主瓦总金额/g)).toBe(1);
    expect(countMatches(report.html, /全单总合计/g)).toBe(1);
    expect(report.html).toContain("font-size:22px");
  });

  it("fills all 24 screenshot rows down the left column before the compact totals panel", function () {
    var report = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(24) }), cloneConfig());
    var totalsIndex = report.html.indexOf("data-main-table='totals'");
    var accessoryIndex = report.html.indexOf("二、配件清单");
    var firstColumnHtml = report.html.slice(0, totalsIndex);
    var totalsColumnHtml = report.html.slice(totalsIndex, accessoryIndex);

    expect(report.html).not.toContain("data-main-page='2'");
    expect(report.html).not.toContain("data-main-table='continuation'");
    expect(totalsIndex).toBeGreaterThan(-1);
    expect(countMatches(firstColumnHtml, /class='main-data-row'/g)).toBe(24);
    expect(firstColumnHtml).toContain("ROW-24");
    expect(firstColumnHtml).not.toContain("全单总合计");
    expect(countMatches(totalsColumnHtml, /class='main-data-row'/g)).toBe(0);
    expect(totalsColumnHtml).toContain("主瓦总金额");
    expect(report.html.indexOf("全单总合计")).toBeGreaterThan(report.html.indexOf("四、其他瓦 / 特殊瓦"));
  });

  it("uses both first-page columns for 48 rows and starts page two at row 49", function () {
    var report48 = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(48) }), cloneConfig());
    var report49 = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(49) }), cloneConfig());
    var secondPageIndex = report49.html.indexOf("data-main-page='2'");
    var firstPageHtml = report49.html.slice(0, secondPageIndex);

    expect(report48.html).not.toContain("data-main-page='2'");
    expect(countMatches(report48.html, /class='main-data-row'/g)).toBe(48);
    expect(secondPageIndex).toBeGreaterThan(-1);
    expect(countMatches(firstPageHtml, /class='main-data-row'/g)).toBe(48);
    expect(report49.html.indexOf("ROW-49")).toBeGreaterThan(secondPageIndex);
  });

  it("preserves all 60 long-order rows across two pages and keeps totals and side sections last", function () {
    var report = buildPreferredReport(makeSnapshot({ mainRows: makeMainRows(60) }), cloneConfig());
    var secondPageIndex = report.html.indexOf("data-main-page='2'");
    var row60Index = report.html.indexOf("ROW-60");
    var totalIndex = report.html.indexOf("主瓦总金额");
    var grandIndex = report.html.indexOf("全单总合计");
    var accessoryIndex = report.html.indexOf("二、配件清单");
    var otherTileIndex = report.html.indexOf("四、其他瓦 / 特殊瓦");

    expect(countMatches(report.html, /class='main-data-row'/g)).toBe(60);
    expect(countMatches(report.html, /data-main-page='/g)).toBe(2);
    expect(countMatches(report.html, /主瓦总金额/g)).toBe(1);
    expect(row60Index).toBeGreaterThan(secondPageIndex);
    expect(totalIndex).toBeGreaterThan(row60Index);
    expect(accessoryIndex).toBeGreaterThan(totalIndex);
    expect(otherTileIndex).toBeGreaterThan(accessoryIndex);
    expect(grandIndex).toBeGreaterThan(otherTileIndex);
    expect(report.html).toContain(".full-report-page-continuation{break-before:page;page-break-before:always}");
  });

  it("omits blank full report optional metadata", function () {
    var report = buildPreferredReport(makeSnapshot({
      steelCategory: "",
      galvanizingProcess: "",
      deliveryMethod: ""
    }), cloneConfig());

    expect(report.html).not.toContain("钢材类别：");
    expect(report.html).not.toContain("镀锌工艺：");
    expect(report.html).not.toContain("配送方式：");
  });

  it("omits the remark row when remark is blank", function () {
    var report = buildPreferredReport(makeSnapshot({ remark: "   " }), cloneConfig());
    expect(report.html).not.toContain("备注：");
  });

  it("prints cutting advice only when a recommendation is provided", function () {
    var plainReport = buildPreferredReport(makeSnapshot(), cloneConfig());
    var report = buildPreferredReport(makeSnapshot({
      cuttingAdvice: {
        stockSegments: 60,
        selectedPlan: {
          title: "方案一（9.8分）",
          stockSegments: 60,
          boardCount: 1,
          score: 9.8,
          cutPieceCount: 3,
          estimatedCutRounds: 1,
          cuttingRounds: [
            { pieces: [20, 20, 20], wasteSegments: 0, lineText: "20 + 20 + 20，剩0" }
          ],
          cuts: [
            { lineText: "20 + 20 + 20 = 剩0", repeat: 1, wasteSegments: 0 }
          ]
        },
        evaluation: {
          summary: "推荐使用方案一，零剩料且切法清楚。",
          reasons: ["零剩料，材料利用率最高"],
          cautions: ["裁切前复核数量"]
        }
      }
    }), cloneConfig());

    expect(plainReport.html).not.toContain("裁板方案");
    expect(report.html).toContain("裁板方案");
    expect(report.html).toContain(".cutting-advice{margin-top:1cm");
    expect(report.html).toContain("grid-template-columns:repeat(auto-fit,minmax(34mm,1fr))");
    expect(report.html).toContain("grid-template-columns:repeat(auto-fit,minmax(32mm,1fr))");
    expect(report.html).not.toContain(".cutting-round-grid{display:grid;grid-template-columns:repeat(3");
    expect(report.html).toContain("方案一｜评分 9.8分｜需要原板 1支｜预计裁切 1轮");
    expect(report.html).toContain("class='cutting-round-grid'");
    expect(report.html).toContain("<strong>第1轮</strong><span>20 + 20 + 20</span><em>剩料 0节</em>");
    expect(report.html).not.toContain("cutting-round-table");
    expect((report.html.match(/9\.8分/g) || []).length).toBe(1);
    expect(report.html).not.toContain("需要裁片");
    expect(report.html).not.toContain("AI参考评分");
    expect(report.html).not.toContain("零剩料，材料利用率最高");
    expect(report.html.indexOf("class='sign'")).toBeLessThan(report.html.indexOf("class='cutting-advice'"));
  });

  it("does not print AI evaluation even when it contains encoded JSON", function () {
    var rawJson = "{\"summary\":\"推荐使用方案一。\",\"reasons\":[\"零剩料\"],\"cautions\":[\"复核数量\"]}";
    var report = buildPreferredReport(makeSnapshot({
      cuttingAdvice: {
        stockSegments: 60,
        selectedPlan: {
          title: "方案一（9.5分）",
          boardCount: 1,
          score: 9.5,
          cutPieceCount: 3,
          estimatedCutRounds: 1,
          cuttingRounds: [
            { pieces: [20, 20, 20], wasteSegments: 0, lineText: "20 + 20 + 20，剩0" }
          ],
          cuts: [
            { lineText: "20 + 20 + 20 = 剩0", repeat: 1, wasteSegments: 0 }
          ]
        },
        evaluation: {
          summary: rawJson,
          reasons: [],
          cautions: []
        }
      }
    }), cloneConfig());

    expect(report.html).toContain("裁板方案");
    expect(report.html).toContain("<strong>第1轮</strong><span>20 + 20 + 20</span><em>剩料 0节</em>");
    expect(report.html).not.toContain("需要裁片");
    expect(report.html).not.toContain("推荐使用方案一。");
    expect(report.html).not.toContain("复核数量");
    expect(report.html).not.toContain(rawJson);
  });

  it("prints only the selected cutting plan even when alternates exist", function () {
    var report = buildPreferredReport(makeSnapshot({
      cuttingAdvice: {
        stockSegments: 60,
        selectedPlan: {
          title: "方案二（8.4分）",
          boardCount: 2,
          score: 8.4,
          cutPieceCount: 5,
          estimatedCutRounds: 5,
          cuttingRounds: [
            { pieces: [35, 20], wasteSegments: 5, lineText: "35 + 20，剩5" },
            { pieces: [35, 20], wasteSegments: 5, lineText: "35 + 20，剩5" },
            { pieces: [32], wasteSegments: 28, lineText: "32，剩28" },
            { pieces: [24, 24], wasteSegments: 12, lineText: "24 + 24，剩12" },
            { pieces: [18, 18, 18], wasteSegments: 6, lineText: "18 + 18 + 18，剩6" }
          ],
          cuts: [
            { lineText: "35 + 20 = 剩5", repeat: 2, wasteSegments: 5 }
          ]
        },
        recommendedPlan: {
          title: "方案一（9.8分）",
          boardCount: 1,
          score: 9.8,
          cutPieceCount: 2,
          estimatedCutRounds: 1,
          cuttingRounds: [
            { pieces: [35, 25], wasteSegments: 0, lineText: "35 + 25，剩0" }
          ],
          cuts: [
            { lineText: "35 + 25 = 剩0", repeat: 1, wasteSegments: 0 }
          ]
        },
        plans: [
          {
            title: "方案二（8.4分）",
            cuts: [
              { lineText: "35 + 20 = 剩5", repeat: 2, wasteSegments: 5 }
            ]
          }
        ]
      }
    }), cloneConfig());

    expect(report.html).not.toContain("方案二（8.4分）");
    expect(report.html).toContain("方案二｜评分 8.4分｜需要原板 2支｜预计裁切 5轮");
    expect(report.html).toContain("<strong>第1轮</strong><span>35 + 20</span><em>剩料 5节</em>");
    expect(report.html).toContain("<strong>第2轮</strong><span>35 + 20</span><em>剩料 5节</em>");
    expect(report.html).toContain("<strong>第3轮</strong><span>32</span><em>剩料 28节</em>");
    expect(report.html).toContain("<strong>第4轮</strong><span>24 + 24</span><em>剩料 12节</em>");
    expect(report.html).toContain("<strong>第5轮</strong><span>18 + 18 + 18</span><em>剩料 6节</em>");
    expect((report.html.match(/class='cutting-round-card'/g) || []).length).toBe(5);
    expect(report.html).not.toContain("需要裁片");
    expect(report.html).not.toContain("方案一（9.8分）");
    expect(report.html).not.toContain("35 + 25，剩0");
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
      steelCategory: "友发",
      galvanizingProcess: "镀锌工艺：双镀锌",
      steels: [{ name: "镀锌方管 40×80 厚 1.8", qty: 1, unit: "支", price: 50, subtotal: 50 }]
    }), cloneConfig());
    var otherTileReport = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      otherTiles: [{ name: "透明瓦", length: 2.5, qty: 3, unit: "片", price: 18, subtotal: 135 }]
    }), cloneConfig());

    expect(steelReport.type).toBe("steel");
    expect(steelReport.html).toContain("ORD-PRINT-001");
    expect(steelReport.html).toContain("备注：补单");
    expect(steelReport.html).toContain("<span>客户：测试客户</span>");
    expect(steelReport.html).not.toContain("颜色：枣红色");
    expect(steelReport.html).toContain("钢材类别：友发");
    expect(steelReport.html).toContain("镀锌工艺：双镀锌");
    expect(steelReport.html).not.toContain("工艺：镀锌工艺：双镀锌");
    expect(otherTileReport.type).toBe("other-tile");
    expect(otherTileReport.html).toContain("ORD-PRINT-001");
    expect(otherTileReport.html).toContain("备注：补单");
    expect(otherTileReport.html).toContain("颜色：枣红色");
    expect(otherTileReport.html).toContain("<th>片数</th>");
    expect(otherTileReport.html).toContain("<th>单片长度</th>");
    expect(otherTileReport.html).toContain("<th>总长度</th>");
    expect(otherTileReport.html).toContain("<td>7.5</td>");
  });

  it("omits blank steel category and galvanizing process in steel-only reports", function () {
    var report = buildPreferredReport(makeSnapshot({
      mainRows: [],
      mainAmount: 0,
      steelCategory: "",
      galvanizingProcess: "",
      steels: [{ name: "角码", qty: 4, unit: "个", price: 2, subtotal: 8 }]
    }), cloneConfig());

    expect(report.type).toBe("steel");
    expect(report.html).not.toContain("颜色：");
    expect(report.html).not.toContain("钢材类别：");
    expect(report.html).not.toContain("镀锌工艺：");
  });
});
