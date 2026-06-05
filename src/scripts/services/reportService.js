import { escapeHtml, formatMoney, formatTrimFixed } from "../utils.js";
import { computeGrandAmount, sumFiniteAmounts } from "../calc.js";

function createDateString() {
  var today = new Date();
  return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
}

function normalizeDateString(value) {
  var text = String(value || "").trim().replace(/\//g, "-");
  var match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!match) return "";
  return match[1] + "-" + String(match[2]).padStart(2, "0") + "-" + String(match[3]).padStart(2, "0");
}

function getReportFileTitle(data) {
  var customerName = String(data.customerName || "").trim() || "未填写客户";
  var safeCustomerName = customerName.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  var safeOrderNo = String(data.orderNo || "").trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return (safeCustomerName || "未填写客户") + (safeOrderNo ? "_" + safeOrderNo : "") + "_" + data.dateStr;
}

function sumSubtotal(items) {
  return sumFiniteAmounts((Array.isArray(items) ? items : []).map(function (item) {
    return item.subtotal;
  }));
}

function getCompanyDateLine(config, dateStr) {
  var companyName = String(config.basics.companyName || "").trim();
  return escapeHtml(companyName ? companyName + " · " + dateStr : dateStr);
}

function getLogoHtml(snapshot, config) {
  var logo = String(snapshot.logoDataUrl || config.basics.defaultLogo || "");
  return logo ? "<img src='" + logo + "' alt='企业 Logo' />" : "";
}

function buildMetaItem(label, value, fallback) {
  var text = String(value || "").trim();
  return "<div><span>" + escapeHtml(label) + "：</span>" + escapeHtml(text || fallback || "未填写") + "</div>";
}

function buildReportMeta(data, extraHtml) {
  return buildMetaItem("订单编号", data.orderNo, "未填写") +
    buildMetaItem("客户", data.customerName, "未填写") +
    buildMetaItem("颜色", data.tileColor, "未填写") +
    (extraHtml || "");
}

function buildRemarkHtml(data) {
  var remark = String(data.remark || "").trim();
  return remark ? "<div class='remark'>备注：" + escapeHtml(remark) + "</div>" : "";
}

function getReportFooter(config) {
  var basics = config.basics;
  var template = config.reportTemplate;
  var addressLine = escapeHtml(template.addressLabel || "地址") + "：" + escapeHtml(basics.address || "");
  var phoneLine = escapeHtml(template.phoneLabel || "电话") + "：" + escapeHtml(basics.phone || "");
  return "<div class='sign'><p class='note'>温馨提示：" + escapeHtml(template.warmTip || "") + "</p><div class='sign-row'><div><p>" + addressLine + "</p><p>" + phoneLine + "</p></div><div><p>" + escapeHtml(template.signatureLabel || "") + "</p><p>" + escapeHtml(template.receiptDateLabel || "") + "</p></div></div></div>";
}

function buildReportTableRows(items, emptyText, renderRow, colspan) {
  if (!items.length) return "<tr><td colspan='" + colspan + "'>" + escapeHtml(emptyText) + "</td></tr>";
  return items.map(renderRow).join("");
}

function getSharedReportCss(kind) {
  if (kind === "full") {
    return "@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}h1{margin:0;text-align:center;font-size:30px;line-height:1.15;font-weight:900;}h2{margin:0 0 6px;font-size:15px;font-weight:900;}table{width:100%;border-collapse:collapse;font-size:12px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:5px 4px;text-align:center;line-height:1.28;font-weight:800;}th{background:#eef3ef;font-weight:900;}.actual-cell{font-weight:900}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:106px;border-bottom:2px solid #1f261f;padding:6px 0 9px;margin-bottom:9px}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.customer,.color{position:absolute;left:0;font-size:14px;font-weight:900}.customer{bottom:30px}.color{bottom:9px}.logo{position:absolute;right:0;top:0;width:210px;height:86px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:86px;object-fit:contain}.meta{position:absolute;left:0;right:220px;bottom:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 10px;font-size:13px;font-weight:900;text-align:left}.meta div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.remark{margin:0 0 8px;border:1px solid #9ca69d;background:#f8faf8;padding:6px 8px;font-size:13px;font-weight:900;line-height:1.35}.content{display:grid;grid-template-columns:44% 56%;gap:12px;align-items:start}.section{margin-bottom:7px;break-inside:avoid}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.grand{margin-top:7px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:8px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:8px;border-top:1px solid #c8cec9;padding-top:7px}.note{margin:0 0 8px;text-align:center;font-size:13px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:13px;font-weight:800;line-height:1.58}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}";
  }
  return "@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:108px;border-bottom:2px solid #1f261f;padding:6px 0 10px;margin-bottom:10px;}h1{margin:0;text-align:center;font-size:30px;line-height:1.16;letter-spacing:0;font-weight:900}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.meta{position:absolute;left:0;bottom:8px;display:grid;gap:5px;font-size:15px;font-weight:900}.logo{position:absolute;right:0;top:0;width:210px;height:88px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:88px;object-fit:contain}.meta{position:absolute;left:0;right:220px;bottom:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 10px;font-size:14px;font-weight:900;text-align:left}.meta div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.remark{margin:0 0 10px;border:1px solid #9ca69d;background:#f8faf8;padding:7px 9px;font-size:14px;font-weight:900;line-height:1.4}.table-wrap{margin-top:9px}.section{margin-top:9px;break-inside:avoid}h2{margin:0 0 7px;font-size:16px;font-weight:900}table{width:100%;border-collapse:collapse;font-size:14px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:8px 6px;text-align:center;line-height:1.32;font-weight:800;}th{background:#eef3ef;font-weight:900}.idx{width:44px}.name{text-align:left;font-weight:900}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.summary{margin-top:11px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:9px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:12px;border-top:1px solid #c8cec9;padding-top:8px}.note{margin:0 0 8px;text-align:center;font-size:14px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;font-weight:800;line-height:1.65}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}";
}

function getCuttingReportCss() {
  return ".cutting-advice{margin-top:1cm;border:1px solid #8f9892;background:#fff;padding:8px 10px;break-inside:avoid;page-break-inside:avoid}.cutting-advice h2{margin:0 0 5px;font-size:15px;font-weight:900}.cutting-plan-meta{margin:0 0 7px;font-size:12px;font-weight:900;line-height:1.35;color:#1f261f}.cutting-round-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(34mm,1fr));gap:4px}.cutting-round-card{min-height:48px;border:1px solid #b9c1bb;background:#fff;padding:4px 5px;break-inside:avoid;page-break-inside:avoid}.cutting-round-card strong{display:block;margin:0 0 2px;font-size:10.5px;font-weight:900;line-height:1.2;color:#1f261f}.cutting-round-card span{display:block;min-height:15px;font-size:11.5px;font-weight:900;line-height:1.22;color:#1f261f;overflow-wrap:anywhere}.cutting-round-card em{display:block;margin-top:2px;font-style:normal;font-size:10.5px;font-weight:800;line-height:1.2;color:#4f5a52}.cutting-round-more{grid-column:1/-1;min-height:auto;text-align:center;color:#4f5a52}@media print{.cutting-advice{margin-top:1cm;page-break-inside:avoid}.cutting-round-grid{grid-template-columns:repeat(auto-fit,minmax(32mm,1fr));gap:3px}.cutting-round-card{padding:4px 5px}}";
}

function wrapReport(title, bodyHtml, data, config, kind, afterFooterHtml) {
  return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title><style>" + getSharedReportCss(kind) + getCuttingReportCss() + "</style></head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" + bodyHtml + getReportFooter(config) + (afterFooterHtml || "") + "</body></html>";
}

function normalizeCuttingAdvice(snapshot) {
  var advice = snapshot && snapshot.cuttingAdvice;
  if (!advice || typeof advice !== "object" || Array.isArray(advice)) return null;
  var plan = advice.selectedPlan && typeof advice.selectedPlan === "object" ? advice.selectedPlan :
    (advice.recommendedPlan && typeof advice.recommendedPlan === "object" ? advice.recommendedPlan : advice);
  if (!plan || !Array.isArray(plan.cuts) || !plan.cuts.length) return null;
  return {
    stockSegments: Number(advice.stockSegments || plan.stockSegments || 60) || 60,
    selectedPlan: plan,
    recommendedPlan: plan,
    summaryText: String(advice.summaryText || plan.summaryText || "").trim()
  };
}

function displayCuttingValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getReportCutLineText(cut) {
  if (cut && cut.lineText) return String(cut.lineText);
  var items = Array.isArray(cut && cut.items) ? cut.items : [];
  var parts = [];
  items.forEach(function (item) {
    var qty = Math.max(1, Math.trunc(Number(item.qty) || 1));
    if (qty <= 4) {
      for (var index = 0; index < qty; index += 1) parts.push(String(item.segments));
    } else {
      parts.push(String(item.segments) + "×" + qty);
    }
  });
  return (parts.length ? parts.join(" + ") : String(cut && cut.description || "").replace(/节/g, "")) + " = 剩" + displayCuttingValue(cut && cut.wasteSegments);
}

function formatReportWaste(value) {
  var number = Number(value);
  if (Number.isFinite(number)) return formatTrimFixed(number, 0) + "节";
  var text = String(value || "").trim();
  if (!text) return "";
  return /节$/.test(text) ? text : text + "节";
}

function splitReportRoundText(text, index, wasteSegments) {
  var source = String(text || "").trim();
  var combo = source;
  var waste = formatReportWaste(wasteSegments);
  var match = /^(.*?)(?:\s*=\s*剩|，剩)([^，=]*)$/.exec(source);
  if (match) {
    combo = match[1].trim();
    if (!waste) waste = formatReportWaste(match[2]);
  }
  return {
    round: "第" + (index + 1) + "轮",
    combo: combo || source,
    waste: waste
  };
}

function getReportCutRows(cuts, maxRows) {
  var rows = [];
  var limit = maxRows || 6;
  (Array.isArray(cuts) ? cuts : []).some(function (cut) {
    var repeat = Math.max(1, Math.trunc(Number(cut.repeat) || 1));
    for (var index = 0; index < repeat && rows.length < limit; index += 1) {
      rows.push(splitReportRoundText(getReportCutLineText(cut), rows.length, cut && cut.wasteSegments));
    }
    return rows.length >= limit;
  });
  return rows;
}

function getReportRoundRows(plan, maxRows) {
  var rounds = Array.isArray(plan && plan.cuttingRounds) ? plan.cuttingRounds : [];
  var limit = maxRows || 6;
  if (rounds.length) {
    var rows = rounds.slice(0, limit).map(function (round, index) {
      var pieces = Array.isArray(round.pieces) ? round.pieces.map(function (piece) {
        return String(piece);
      }).join(" + ") : String(round.lineText || "");
      return {
        round: "第" + (index + 1) + "轮",
        combo: pieces,
        waste: formatReportWaste(round.wasteSegments)
      };
    });
    if (rounds.length > limit) rows.push({ round: "", combo: "还有 " + (rounds.length - limit) + " 轮未展开", waste: "" });
    return rows;
  }
  return getReportCutRows(plan && plan.cuts, limit);
}

function getReportScoreText(plan) {
  var score = Number(plan && plan.score);
  return Number.isFinite(score) ? formatTrimFixed(score, 1) + "分" : "未评分";
}

function getReportPlanTitle(plan) {
  var title = String(plan && plan.title || "选中方案").trim();
  title = title.replace(/[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]/g, "").trim();
  return title || "选中方案";
}

function buildCuttingAdviceHtml(data) {
  var advice = data.cuttingAdvice;
  if (!advice || !advice.recommendedPlan) return "";
  var plan = advice.recommendedPlan;
  var roundRows = getReportRoundRows(plan, 9999);
  var cutsHtml = roundRows.map(function (row) {
    var className = row.round ? "cutting-round-card" : "cutting-round-card cutting-round-more";
    return "<article class='" + className + "'>" +
      (row.round ? "<strong>" + escapeHtml(row.round) + "</strong>" : "") +
      "<span>" + escapeHtml(row.combo) + "</span>" +
      (row.waste ? "<em>剩料 " + escapeHtml(row.waste) + "</em>" : "") +
      "</article>";
  }).join("");
  var rounds = Number(plan.estimatedCutRounds) || getReportRoundRows(plan, 9999).length;
  var meta = [
    getReportPlanTitle(plan),
    "评分 " + getReportScoreText(plan),
    "需要原板 " + displayCuttingValue(plan.boardCount) + "支",
    "预计裁切 " + displayCuttingValue(rounds) + "轮"
  ].join("｜");
  return "<div class='cutting-advice'><h2>裁板方案</h2>" +
    "<p class='cutting-plan-meta'>" + escapeHtml(meta) + "</p>" +
    (cutsHtml ? "<div class='cutting-round-grid'>" + cutsHtml + "</div>" : "") +
    "</div>";
}

function createBaseData(snapshot, config) {
  snapshot = snapshot || {};
  var mainRows = Array.isArray(snapshot.mainRows) ? snapshot.mainRows : [];
  var accessories = Array.isArray(snapshot.accessories) ? snapshot.accessories : [];
  var steels = Array.isArray(snapshot.steels) ? snapshot.steels : [];
  var otherTiles = Array.isArray(snapshot.otherTiles) ? snapshot.otherTiles : [];
  var orderDate = normalizeDateString(snapshot.orderDate) || createDateString();
  var qtyTotal = sumFiniteAmounts(mainRows.map(function (row) { return row.totalQty; }));
  var areaTotal = sumFiniteAmounts(mainRows.map(function (row) { return row.area; }));
  var mainAmount = sumFiniteAmounts([snapshot.mainAmount]);
  var accessoryAmount = sumSubtotal(accessories);
  var steelAmount = sumSubtotal(steels);
  var otherTileAmount = sumSubtotal(otherTiles);
  return {
    mainRows: mainRows,
    qtyTotal: qtyTotal,
    areaTotal: areaTotal,
    unitPrice: snapshot.unitPrice,
    mainAmount: mainAmount,
    accessories: accessories,
    accessoryAmount: accessoryAmount,
    steels: steels,
    steelAmount: steelAmount,
    otherTiles: otherTiles,
    otherTileAmount: otherTileAmount,
    grandAmount: computeGrandAmount(mainAmount, accessoryAmount, steelAmount, otherTileAmount),
    dateStr: orderDate,
    orderDate: orderDate,
    orderNo: String(snapshot.orderNo || "").trim(),
    customerName: String(snapshot.customerName || "").trim(),
    tileColor: String(snapshot.tileColor || "").trim(),
    remark: String(snapshot.remark || "").trim(),
    logoHtml: getLogoHtml(snapshot, config),
    cuttingAdvice: normalizeCuttingAdvice(snapshot)
  };
}

function buildFullReport(data, config) {
  var template = config.reportTemplate;
  var mainRowsHtml = data.mainRows.map(function (row) {
    return "<tr><td>" + escapeHtml(row.lengthsText) + "</td><td class='actual-cell'>" + row.actual + "</td><td>" + formatTrimFixed(row.totalQty, 0) + "</td><td>" + formatTrimFixed(row.area, 4) + "</td></tr>";
  }).join("");
  var accessoryRowsHtml = buildReportTableRows(data.accessories, "无配件数据", function (item) {
    return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 0) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }, 5);
  var steelRowsHtml = buildReportTableRows(data.steels, "无钢铁材料数据", function (item) {
    return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 0) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }, 5);
  var otherTileRowsHtml = buildReportTableRows(data.otherTiles, "无其他瓦数据", function (item) {
    var lengthText = Number.isFinite(item.length) ? formatTrimFixed(item.length, 3) : "";
    return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + lengthText + "</td><td>" + formatTrimFixed(item.qty, 0) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }, 6);
  var widthValue = Number(config.basics.fixedWidth);
  var profileText = Number.isFinite(widthValue) ? Math.round(widthValue * 1000) + " 型" : "主瓦";
  var body = "<div class='header'><h1>" + escapeHtml(template.mainTitle) + "</h1><p class='date'>" + getCompanyDateLine(config, data.dateStr) + "</p><div class='meta'>" + buildReportMeta(data) + "</div><div class='logo'>" + data.logoHtml + "</div></div>" +
    buildRemarkHtml(data) +
    "<div class='content'><div><div class='section'><h2>一、主瓦汇总（" + escapeHtml(profileText) + "）</h2><table><thead><tr><th>长度</th><th>实裁节数</th><th>数量</th><th>单项面积</th></tr></thead><tbody>" + mainRowsHtml +
    "<tr class='sum'><td colspan='3'>数量合计</td><td>" + formatTrimFixed(data.qtyTotal, 0) + "</td></tr><tr class='sum'><td colspan='3'>总面积合计</td><td>" + formatTrimFixed(data.areaTotal, 4) + "</td></tr><tr class='sum'><td colspan='3'>主瓦单价</td><td>" + (Number.isFinite(data.unitPrice) ? formatMoney(data.unitPrice) : "未填写") + "</td></tr><tr class='sum'><td colspan='3'>主瓦总金额</td><td>" + formatMoney(data.mainAmount) + "</td></tr></tbody></table></div></div>" +
    "<div><div class='section'><h2>二、配件清单</h2><table><thead><tr><th>名称</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + accessoryRowsHtml + "<tr class='sum'><td colspan='4'>配件总金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
    "<div class='section'><h2>三、钢铁材料</h2><table><thead><tr><th>名称</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + steelRowsHtml + "<tr class='sum'><td colspan='4'>钢铁材料总金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
    "<div class='section'><h2>四、其他瓦 / 特殊瓦</h2><table><thead><tr><th>名称</th><th>长度</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + otherTileRowsHtml + "<tr class='sum'><td colspan='5'>其他瓦总金额</td><td>" + formatMoney(data.otherTileAmount) + "</td></tr></tbody></table></div></div></div>" +
    "<div class='grand'>全单总合计 ≈ " + Math.round(data.grandAmount) + " 元</div>";
  return wrapReport(template.mainTitle, body, data, config, "full", buildCuttingAdviceHtml(data));
}

function buildSingleHeader(title, metaHtml, data, config) {
  return "<div class='header'><h1>" + escapeHtml(title) + "</h1><p class='date'>" + getCompanyDateLine(config, data.dateStr) + "</p><div class='meta'>" + buildReportMeta(data, metaHtml) + "</div><div class='logo'>" + data.logoHtml + "</div></div>";
}

function buildAccessoryOnlyReport(data, config) {
  var rowsHtml = data.accessories.map(function (item, index) {
    return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }).join("");
  var body = buildSingleHeader(config.reportTemplate.accessoryTitle, "", data, config) +
    buildRemarkHtml(data) +
    "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>配件名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + rowsHtml +
    "<tr class='sum'><td colspan='5'>配件合计金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
    "<div class='summary'>配件总合计 ≈ " + Math.round(data.accessoryAmount) + " 元</div>";
  return wrapReport(config.reportTemplate.accessoryTitle, body, data, config, "single");
}

function buildSteelOnlyReport(data, config) {
  var rowsHtml = data.steels.map(function (item, index) {
    return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }).join("");
  var tubeName = String(config.steel.tubeMaterialName || "").trim();
  var processText = tubeName && data.steels.some(function (item) {
    return String(item.name || "").indexOf(tubeName) !== -1;
  }) ? String(config.reportTemplate.steelProcessText || "").trim() : "";
  var body = buildSingleHeader(config.reportTemplate.steelTitle, processText ? buildMetaItem("工艺", processText, "") : "", data, config) +
    buildRemarkHtml(data) +
    "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>材料名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + rowsHtml +
    "<tr class='sum'><td colspan='5'>钢铁材料合计金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
    "<div class='summary'>钢铁材料总合计 ≈ " + Math.round(data.steelAmount) + " 元</div>";
  return wrapReport(config.reportTemplate.steelTitle, body, data, config, "single");
}

function buildRoofMaterialReport(data, config) {
  var accessoryRowsHtml = data.accessories.map(function (item, index) {
    return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }).join("");
  var steelRowsHtml = data.steels.map(function (item, index) {
    return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }).join("");
  var otherTileSectionHtml = "";
  if (data.otherTiles.length) {
    var otherTileRowsHtml = data.otherTiles.map(function (item, index) {
      var lengthText = Number.isFinite(item.length) ? formatTrimFixed(item.length, 3) : "";
      return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + lengthText + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
    }).join("");
    otherTileSectionHtml = "<div class='section'><h2>三、其他瓦 / 特殊瓦</h2><table><thead><tr><th class='idx'>序号</th><th>名称</th><th>长度</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + otherTileRowsHtml + "<tr class='sum'><td colspan='6'>其他瓦合计金额</td><td>" + formatMoney(data.otherTileAmount) + "</td></tr></tbody></table></div>";
  }
  var body = buildSingleHeader(config.reportTemplate.roofMaterialTitle, "", data, config) +
    buildRemarkHtml(data) +
    "<div class='section'><h2>一、配件清单</h2><table><thead><tr><th class='idx'>序号</th><th>配件名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + accessoryRowsHtml + "<tr class='sum'><td colspan='5'>配件合计金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
    "<div class='section'><h2>二、钢铁材料</h2><table><thead><tr><th class='idx'>序号</th><th>材料名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + steelRowsHtml + "<tr class='sum'><td colspan='5'>钢铁材料合计金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
    otherTileSectionHtml +
    "<div class='summary'>屋面材料总合计 ≈ " + Math.round(data.accessoryAmount + data.steelAmount + data.otherTileAmount) + " 元</div>";
  return wrapReport(config.reportTemplate.roofMaterialTitle, body, data, config, "single");
}

function buildOtherTileOnlyReport(data, config) {
  var rowsHtml = data.otherTiles.map(function (item, index) {
    var lengthText = Number.isFinite(item.length) ? formatTrimFixed(item.length, 3) : "";
    return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + lengthText + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
  }).join("");
  var body = buildSingleHeader(config.reportTemplate.otherTileTitle, "", data, config) +
    buildRemarkHtml(data) +
    "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>名称 / 规格</th><th>长度</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + rowsHtml +
    "<tr class='sum'><td colspan='6'>其他瓦合计金额</td><td>" + formatMoney(data.otherTileAmount) + "</td></tr></tbody></table></div>" +
    "<div class='summary'>其他瓦总合计 ≈ " + Math.round(data.otherTileAmount) + " 元</div>";
  return wrapReport(config.reportTemplate.otherTileTitle, body, data, config, "single");
}

export function buildPreferredReport(snapshot, config) {
  var data = createBaseData(snapshot, config);
  if (data.mainRows.length) {
    return { html: buildFullReport(data, config), data: data, type: "full" };
  }
  if (data.accessories.length && data.steels.length) {
    return { html: buildRoofMaterialReport(data, config), data: data, type: "roof-material" };
  }
  if (data.accessories.length) {
    return { html: buildAccessoryOnlyReport(data, config), data: data, type: "accessory" };
  }
  if (data.steels.length) {
    return { html: buildSteelOnlyReport(data, config), data: data, type: "steel" };
  }
  if (data.otherTiles.length) {
    return { html: buildOtherTileOnlyReport(data, config), data: data, type: "other-tile" };
  }
  return null;
}
