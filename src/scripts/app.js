import {
  FIXED_WIDTH,
  OTHER_TILE_PRESETS,
  PRESET_ACCESSORIES,
  STEEL_PRESETS,
  UNCOMMON_ACCESSORIES
} from "./config.js";
import { actualSegments, computeSlopeLength } from "./calc.js";
import { formatMoney, formatNum, formatTrimFixed, parseNum } from "./utils.js";

var rowsEl = document.getElementById("rows");
      var exportPdfBtn = document.getElementById("exportPdf");
      var exportPdfSideBtn = document.getElementById("exportPdfSide");
      var totalAreaEl = document.getElementById("totalArea");
      var mainAmountEl = document.getElementById("mainAmount");
      var accAmountEl = document.getElementById("accAmount");
      var accAmountInlineEl = document.getElementById("accAmountInline");
      var grandAmountEl = document.getElementById("grandAmount");
      var globalSegmentInput = document.getElementById("globalSegmentInput");
      var unitPriceInput = document.getElementById("unitPrice");
      var customerNameInput = document.getElementById("customerName");
      var tileColorInput = document.getElementById("tileColor");
      var logoUploadInput = document.getElementById("logoUpload");
      var clearLogoBtn = document.getElementById("clearLogo");
      var navTabs = document.querySelectorAll("[data-target]");
      var panels = document.querySelectorAll(".panel");
      var addMainRowBtn = document.getElementById("addMainRow");
      var accPresetGrid = document.getElementById("accPresetGrid");
      var accPresetGridUncommon = document.getElementById("accPresetGridUncommon");
      var accessoryRowsEl = document.getElementById("accessoryRows");
      var clearAccessoriesBtn = document.getElementById("clearAccessories");
      var addAccessoryRowBottomBtn = document.getElementById("addAccessoryRowBottom");
      var steelTubeSpecSelect = document.getElementById("steelTubeSpec");
      var steelTubeThicknessSelect = document.getElementById("steelTubeThickness");
      var steelBoltSpecSelect = document.getElementById("steelBoltSpec");
      var steelAddTubeBtn = document.getElementById("steelAddTube");
      var steelAddBoltBtn = document.getElementById("steelAddBolt");
      var steelPresetGrid = document.getElementById("steelPresetGrid");
      var steelRowsEl = document.getElementById("steelRows");
      var steelAmountEl = document.getElementById("steelAmount");
      var steelAmountFooterEl = document.getElementById("steelAmountFooter");
      var otherTilePresetGrid = document.getElementById("otherTilePresetGrid");
      var otherTileRowsEl = document.getElementById("otherTileRows");
      var addOtherTileRowBtn = document.getElementById("addOtherTileRow");
      var otherTileAmountEl = document.getElementById("otherTileAmount");
      var otherTileAmountFooterEl = document.getElementById("otherTileAmountFooter");
      var reportLogoDataUrl = "";
      var totals = {
        area: 0,
        main: 0,
        accessories: 0,
        steel: 0,
        otherTiles: 0,
        grand: 0
      };

      
      
      
      
      function escapeHtml(text) {
        return String(text || "").replace(/[&<>"']/g, function (ch) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
        });
      }

      function iconSvg(name) {
        return '<svg class="ui-icon" aria-hidden="true"><use href="#icon-' + name + '"></use></svg>';
      }

      function getReportFileTitle(data) {
        var customerName = String(data.customerName || "").trim() || "未填写客户";
        var safeCustomerName = customerName.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
        return (safeCustomerName || "未填写客户") + "_" + data.dateStr;
      }

      function getGlobalSegment() {
        var value = parseNum(globalSegmentInput.value);
        return Number.isFinite(value) && value > 0 ? value : NaN;
      }

      
      
      function computeMainAmount(area) {
        var unitPrice = parseNum(unitPriceInput.value);
        return Number.isFinite(unitPrice) ? Math.round(area * unitPrice) : 0;
      }

      
      function updateSlopePlaceholder(row) {
        var modeInput = row.querySelector(".inp-slope-mode");
        var slopeInput = row.querySelector(".inp-slope-value");
        if (!modeInput || !slopeInput) return;
        slopeInput.placeholder = modeInput.value === "percent" ? "坡度%" : "角度°";
      }

      function getRowData(row) {
        var segCount = parseNum(row.querySelector(".inp-seg").value);
        var length = parseNum(row.querySelector(".inp-l").value);
        var qty = parseNum(row.querySelector(".inp-q").value);
        var projectionLength = parseNum(row.querySelector(".inp-proj").value);
        var slopeMode = row.querySelector(".inp-slope-mode").value || "percent";
        var slopeValue = parseNum(row.querySelector(".inp-slope-value").value);
        var slopeLength = computeSlopeLength(projectionLength, slopeMode, slopeValue);
        var segment = getGlobalSegment();
        var lengthSource = "manual";
        if (Number.isFinite(segCount) && Number.isFinite(segment)) {
          length = Number((segCount * segment).toFixed(3));
          lengthSource = "segment";
        } else if (!Number.isFinite(segCount) && Number.isFinite(slopeLength)) {
          length = Number(slopeLength.toFixed(3));
          lengthSource = "slope";
        }
        var precise = Number.isFinite(length) && Number.isFinite(segment) ? length / segment : NaN;
        var actual = actualSegments(precise);
        var area = Number.isFinite(length) && Number.isFinite(qty) ? length * qty * FIXED_WIDTH : NaN;
        return {
          length: length,
          qty: qty,
          segment: segment,
          segCount: segCount,
          precise: precise,
          actual: actual,
          area: area,
          projectionLength: projectionLength,
          slopeMode: slopeMode,
          slopeValue: slopeValue,
          slopeLength: slopeLength,
          lengthSource: lengthSource
        };
      }

      function isMainRowBlank(row) {
        return !row.querySelector(".inp-l").value.trim() &&
          !row.querySelector(".inp-seg").value.trim() &&
          !row.querySelector(".inp-q").value.trim() &&
          !row.querySelector(".inp-proj").value.trim() &&
          !row.querySelector(".inp-slope-value").value.trim();
      }

      function createMainRow() {
        var row = document.createElement("div");
        row.className = "calc-row";
        row.innerHTML =
          '<div class="row-index">#<span class="row-no">1</span></div>' +
          '<label class="line-field"><span class="field-label">水平投影 A（米）</span><input class="inp-proj" type="text" inputmode="decimal" placeholder="水平投影" /></label>' +
          '<label class="line-field"><span class="field-label">换算方式</span><select class="inp-slope-mode"><option value="percent">坡度 %</option><option value="angle">角度 °</option></select></label>' +
          '<label class="line-field"><span class="field-label">坡度/角度</span><input class="inp-slope-value" type="text" inputmode="decimal" placeholder="坡度%" /></label>' +
          '<label class="line-field"><span class="field-label">长度 L（米）</span><input class="inp-l" type="text" inputmode="decimal" placeholder="例如 6.000" /></label>' +
          '<label class="line-field"><span class="field-label">节数</span><input class="inp-seg" type="number" inputmode="decimal" step="1" placeholder="自动换算长度" /></label>' +
          '<label class="line-field"><span class="field-label">数量 Q</span><input class="inp-q" type="number" inputmode="decimal" step="1" placeholder="片数" /></label>' +
          '<div class="metric"><span>斜边长度</span><strong class="out-slope-length">—</strong></div>' +
          '<div class="metric"><span>精准节数</span><strong class="out-precise">—</strong></div>' +
          '<div class="metric"><span>实裁节数</span><strong class="out-actual">—</strong></div>' +
          '<div class="metric"><span>面积（㎡）</span><strong class="out-area">—</strong></div>' +
          '<button type="button" class="icon-btn btn-del" title="删除主瓦行" aria-label="删除主瓦行">' + iconSvg("trash") + '</button>';

        function handleMainRowEdit() {
          updateSlopePlaceholder(row);
          recalcAll();
          if (row === rowsEl.lastElementChild && !isMainRowBlank(row)) {
            ensureTrailingBlankRow();
          }
        }
        row.addEventListener("input", handleMainRowEdit);
        row.addEventListener("change", handleMainRowEdit);
        row.querySelector(".btn-del").addEventListener("click", function () {
          row.remove();
          ensureTrailingBlankRow();
          renumberRows();
          recalcAll();
        });
        updateSlopePlaceholder(row);
        return row;
      }

      function appendRows(count) {
        for (var i = 0; i < count; i += 1) {
          rowsEl.appendChild(createMainRow());
        }
        renumberRows();
        recalcAll();
      }

      function ensureTrailingBlankRow() {
        var rows = Array.prototype.slice.call(rowsEl.querySelectorAll(".calc-row"));
        if (!rows.length || !isMainRowBlank(rows[rows.length - 1])) {
          rowsEl.appendChild(createMainRow());
          renumberRows();
        }
      }

      function renumberRows() {
        Array.prototype.slice.call(rowsEl.querySelectorAll(".calc-row")).forEach(function (row, index) {
          row.querySelector(".row-no").textContent = String(index + 1);
        });
      }

      function recalcRow(row) {
        var data = getRowData(row);
        var lengthInput = row.querySelector(".inp-l");
        if ((data.lengthSource === "segment" || data.lengthSource === "slope") && Number.isFinite(data.length)) {
          lengthInput.value = data.length.toFixed(3);
        }
        row.querySelector(".out-slope-length").textContent = formatNum(data.slopeLength, 3);
        row.querySelector(".out-precise").textContent = formatNum(data.precise, 4);
        row.querySelector(".out-actual").textContent = Number.isFinite(data.actual) ? String(data.actual) : "—";
        row.querySelector(".out-area").textContent = formatNum(data.area, 4);
      }

      function recalcAll() {
        var sumArea = 0;
        Array.prototype.slice.call(rowsEl.querySelectorAll(".calc-row")).forEach(function (row) {
          recalcRow(row);
          var area = getRowData(row).area;
          if (Number.isFinite(area)) sumArea += area;
        });
        totals.area = sumArea;
        totals.main = computeMainAmount(sumArea);
        totalAreaEl.textContent = formatNum(totals.area, 4);
        mainAmountEl.textContent = formatMoney(totals.main);
        recalcGrandTotal();
      }

      function getMergedMainRows() {
        var grouped = {};
        Array.prototype.slice.call(rowsEl.querySelectorAll(".calc-row")).forEach(function (row) {
          var data = getRowData(row);
          if (!Number.isFinite(data.length) || !Number.isFinite(data.qty) || !Number.isFinite(data.actual) || !Number.isFinite(data.area)) return;
          var key = String(data.actual);
          if (!grouped[key]) grouped[key] = { actual: data.actual, totalQty: 0, lengths: {}, area: 0 };
          grouped[key].totalQty += data.qty;
          grouped[key].lengths[data.length.toFixed(4)] = data.length;
          grouped[key].area += data.area;
        });
        return Object.keys(grouped).map(function (key) {
          var group = grouped[key];
          var sortedLengths = Object.keys(group.lengths).map(function (lengthKey) {
            return group.lengths[lengthKey];
          }).sort(function (a, b) {
            return b - a;
          });
          return {
            lengthsText: sortedLengths.map(function (value) { return formatTrimFixed(value, 4); }).join(", "),
            totalQty: group.totalQty,
            actual: group.actual,
            area: group.area
          };
        }).sort(function (a, b) {
          return b.actual - a.actual;
        });
      }

      function getDefaultUnitByName(name) {
        var text = String(name || "");
        if (text.indexOf("防水配件") !== -1) return "套";
        if (text.indexOf("方管") !== -1) return "支";
        if (text.indexOf("底板") !== -1) return "块";
        if (text.indexOf("角码") !== -1) return "个";
        if (text.indexOf("膨胀螺丝") !== -1) return "盒";
        return "件";
      }

      function createAccessoryRow(name, highlight) {
        var row = document.createElement("div");
        var defaultUnit = getDefaultUnitByName(name);
        row.className = "line-row acc-row";
        if (highlight) row.classList.add("is-new");
        row.innerHTML =
          '<label class="line-field"><span class="field-label">名称</span><input class="acc-name" type="text" value="' + escapeHtml(name || "") + '" /></label>' +
          '<label class="line-field"><span class="field-label">数量</span><input class="acc-qty" type="number" inputmode="decimal" step="1" /></label>' +
          '<label class="line-field"><span class="field-label">单位</span><input class="acc-unit" type="text" list="unitOptions" value="' + escapeHtml(defaultUnit) + '" /></label>' +
          '<label class="line-field"><span class="field-label">单价</span><input class="acc-price" type="number" inputmode="decimal" step="0.01" /></label>' +
          '<div class="subtotal-box"><span>小计</span><output class="acc-subtotal">—</output></div>' +
          '<button type="button" class="icon-btn acc-del" title="删除配件" aria-label="删除配件">' + iconSvg("trash") + '</button>';
        row.addEventListener("input", recalcAccessoryTotals);
        row.querySelector(".acc-del").addEventListener("click", function () {
          row.remove();
          recalcAccessoryTotals();
        });
        return row;
      }

      function getAccessoryRowsData() {
        return Array.prototype.slice.call(accessoryRowsEl.querySelectorAll(".acc-row")).map(function (row) {
          var name = row.querySelector(".acc-name").value.trim();
          var qty = parseNum(row.querySelector(".acc-qty").value);
          var unit = row.querySelector(".acc-unit").value.trim();
          var price = parseNum(row.querySelector(".acc-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          return { name: name, qty: qty, unit: unit, price: price, subtotal: subtotal };
        }).filter(function (item) {
          return item.name && Number.isFinite(item.qty) && Number.isFinite(item.price);
        });
      }

      function recalcAccessoryTotals() {
        var total = 0;
        Array.prototype.slice.call(accessoryRowsEl.querySelectorAll(".acc-row")).forEach(function (row) {
          var qty = parseNum(row.querySelector(".acc-qty").value);
          var price = parseNum(row.querySelector(".acc-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          row.querySelector(".acc-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
          if (Number.isFinite(subtotal)) total += subtotal;
        });
        totals.accessories = total;
        accAmountEl.textContent = formatMoney(total);
        accAmountInlineEl.textContent = formatMoney(total);
        recalcGrandTotal();
      }

      function getSteelDefaultUnit(name) {
        var text = String(name || "");
        if (text.indexOf("焊条") !== -1) return "包";
        if (text.indexOf("镀锌钢管") !== -1) return "支";
        if (text.indexOf("方管") !== -1) return "支";
        if (text.indexOf("底板") !== -1) return "块";
        if (text.indexOf("角码") !== -1) return "个";
        if (text.indexOf("膨胀螺丝") !== -1) return "盒";
        if (text.indexOf("镀锌檩条") !== -1) return "条";
        return "件";
      }

      function createSteelRow(name, unit) {
        var row = document.createElement("div");
        var finalUnit = unit || getSteelDefaultUnit(name);
        row.className = "line-row steel-row";
        row.innerHTML =
          '<label class="line-field"><span class="field-label">名称</span><input class="steel-name" type="text" value="' + escapeHtml(name || "") + '" /></label>' +
          '<label class="line-field"><span class="field-label">数量</span><input class="steel-qty" type="number" inputmode="decimal" step="1" /></label>' +
          '<label class="line-field"><span class="field-label">单位</span><input class="steel-unit" type="text" list="unitOptions" value="' + escapeHtml(finalUnit) + '" /></label>' +
          '<label class="line-field"><span class="field-label">单价</span><input class="steel-price" type="number" inputmode="decimal" step="0.01" /></label>' +
          '<div class="subtotal-box"><span>小计</span><output class="steel-subtotal">—</output></div>' +
          '<button type="button" class="icon-btn steel-del" title="删除材料" aria-label="删除材料">' + iconSvg("trash") + '</button>';
        row.addEventListener("input", recalcSteelTotals);
        row.querySelector(".steel-del").addEventListener("click", function () {
          row.remove();
          recalcSteelTotals();
        });
        return row;
      }

      function getSteelRowsData() {
        return Array.prototype.slice.call(steelRowsEl.querySelectorAll(".steel-row")).map(function (row) {
          var name = row.querySelector(".steel-name").value.trim();
          var qty = parseNum(row.querySelector(".steel-qty").value);
          var unit = row.querySelector(".steel-unit").value.trim();
          var price = parseNum(row.querySelector(".steel-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          return { name: name, qty: qty, unit: unit, price: price, subtotal: subtotal };
        }).filter(function (item) {
          return item.name && Number.isFinite(item.qty) && Number.isFinite(item.price);
        });
      }

      function recalcSteelTotals() {
        var total = 0;
        Array.prototype.slice.call(steelRowsEl.querySelectorAll(".steel-row")).forEach(function (row) {
          var qty = parseNum(row.querySelector(".steel-qty").value);
          var price = parseNum(row.querySelector(".steel-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          row.querySelector(".steel-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
          if (Number.isFinite(subtotal)) total += subtotal;
        });
        totals.steel = total;
        steelAmountEl.textContent = formatMoney(total);
        steelAmountFooterEl.textContent = formatMoney(total);
        recalcGrandTotal();
      }

      function createOtherTileRow(name) {
        var row = document.createElement("div");
        row.className = "line-row other-row";
        row.innerHTML =
          '<label class="line-field"><span class="field-label">名称</span><input class="other-tile-name" type="text" value="' + escapeHtml(name || "") + '" /></label>' +
          '<label class="line-field"><span class="field-label">长度</span><input class="other-tile-length" type="number" inputmode="decimal" step="0.001" /></label>' +
          '<label class="line-field"><span class="field-label">数量</span><input class="other-tile-qty" type="number" inputmode="decimal" step="1" /></label>' +
          '<label class="line-field"><span class="field-label">单位</span><input class="other-tile-unit" type="text" list="unitOptions" value="片" /></label>' +
          '<label class="line-field"><span class="field-label">单价</span><input class="other-tile-price" type="number" inputmode="decimal" step="0.01" /></label>' +
          '<div class="subtotal-box"><span>小计</span><output class="other-tile-subtotal">—</output></div>' +
          '<button type="button" class="icon-btn other-tile-del" title="删除其他瓦" aria-label="删除其他瓦">' + iconSvg("trash") + '</button>';
        row.addEventListener("input", recalcOtherTileTotals);
        row.querySelector(".other-tile-del").addEventListener("click", function () {
          row.remove();
          recalcOtherTileTotals();
        });
        return row;
      }

      function getOtherTileRowsData() {
        return Array.prototype.slice.call(otherTileRowsEl.querySelectorAll(".other-row")).map(function (row) {
          var name = row.querySelector(".other-tile-name").value.trim();
          var length = parseNum(row.querySelector(".other-tile-length").value);
          var qty = parseNum(row.querySelector(".other-tile-qty").value);
          var unit = row.querySelector(".other-tile-unit").value.trim();
          var price = parseNum(row.querySelector(".other-tile-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          return { name: name, length: length, qty: qty, unit: unit, price: price, subtotal: subtotal };
        }).filter(function (item) {
          return item.name && Number.isFinite(item.qty) && Number.isFinite(item.price);
        });
      }

      function recalcOtherTileTotals() {
        var total = 0;
        Array.prototype.slice.call(otherTileRowsEl.querySelectorAll(".other-row")).forEach(function (row) {
          var qty = parseNum(row.querySelector(".other-tile-qty").value);
          var price = parseNum(row.querySelector(".other-tile-price").value);
          var subtotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : NaN;
          row.querySelector(".other-tile-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
          if (Number.isFinite(subtotal)) total += subtotal;
        });
        totals.otherTiles = total;
        otherTileAmountEl.textContent = formatMoney(total);
        otherTileAmountFooterEl.textContent = formatMoney(total);
        recalcGrandTotal();
      }

      function recalcGrandTotal() {
        totals.grand = totals.main + totals.accessories + totals.steel + totals.otherTiles;
        grandAmountEl.textContent = formatMoney(totals.grand);
      }

      function switchPanel(targetId) {
        navTabs.forEach(function (button) {
          button.classList.toggle("active", button.getAttribute("data-target") === targetId);
        });
        panels.forEach(function (panel) {
          panel.classList.toggle("active", panel.id === targetId);
        });
      }

      function addPresetButton(name, targetEl, onSelect) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "preset-btn";
        button.innerHTML = "<span>" + escapeHtml(name) + "</span><small>已加</small>";
        button.addEventListener("click", function () {
          button.classList.add("selected");
          onSelect(name);
        });
        targetEl.appendChild(button);
      }

      function clearPresetSelection(container) {
        if (!container) return;
        Array.prototype.slice.call(container.querySelectorAll(".preset-btn")).forEach(function (button) {
          button.classList.remove("selected");
        });
      }

      function buildReportData() {
        var merged = getMergedMainRows();
        if (!merged.length) return null;
        var qtyTotal = 0;
        var areaTotal = 0;
        merged.forEach(function (row) {
          qtyTotal += row.totalQty;
          areaTotal += row.area;
        });
        var unitPrice = parseNum(unitPriceInput.value);
        var mainAmount = computeMainAmount(areaTotal);
        var accessories = getAccessoryRowsData();
        var steels = getSteelRowsData();
        var otherTiles = getOtherTileRowsData();
        var accessoryAmount = accessories.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var steelAmount = steels.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var otherTileAmount = otherTiles.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var today = new Date();
        var dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        return {
          merged: merged,
          qtyTotal: qtyTotal,
          areaTotal: areaTotal,
          unitPrice: unitPrice,
          mainAmount: mainAmount,
          accessories: accessories,
          accessoryAmount: accessoryAmount,
          steels: steels,
          steelAmount: steelAmount,
          otherTiles: otherTiles,
          otherTileAmount: otherTileAmount,
          grandAmount: mainAmount + accessoryAmount + steelAmount + otherTileAmount,
          dateStr: dateStr,
          customerName: customerNameInput.value.trim(),
          tileColor: tileColorInput.value.trim(),
          logoHtml: reportLogoDataUrl ? "<img src='" + reportLogoDataUrl + "' alt='企业 Logo' />" : ""
        };
      }

      function buildReportTableRows(items, emptyText, renderRow, colspan) {
        if (!items.length) return "<tr><td colspan='" + colspan + "'>" + emptyText + "</td></tr>";
        return items.map(renderRow).join("");
      }

      function buildReportHtml(data) {
        var mainRowsHtml = data.merged.map(function (row) {
          return "<tr><td>" + row.lengthsText + "</td><td class='actual-cell'>" + row.actual + "</td><td>" + formatTrimFixed(row.totalQty, 0) + "</td><td>" + formatTrimFixed(row.area, 4) + "</td></tr>";
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
        return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title>" +
          "<style>@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}h1{margin:0;text-align:center;font-size:30px;line-height:1.15;font-weight:900;}h2{margin:0 0 6px;font-size:15px;font-weight:900;}table{width:100%;border-collapse:collapse;font-size:12px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:5px 4px;text-align:center;line-height:1.28;font-weight:800;}th{background:#eef3ef;font-weight:900;}.actual-cell{font-weight:900}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:100px;border-bottom:2px solid #1f261f;padding:6px 0 9px;margin-bottom:9px}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.customer,.color{position:absolute;left:0;font-size:14px;font-weight:900}.customer{bottom:30px}.color{bottom:9px}.logo{position:absolute;right:0;top:0;width:210px;height:86px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:86px;object-fit:contain}.content{display:grid;grid-template-columns:44% 56%;gap:12px;align-items:start}.section{margin-bottom:7px;break-inside:avoid}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.grand{margin-top:7px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:8px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:8px;border-top:1px solid #c8cec9;padding-top:7px}.note{margin:0 0 8px;text-align:center;font-size:13px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:13px;font-weight:800;line-height:1.58}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}</style>" +
          "</head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" +
          "<div class='header'><h1>树脂瓦结算明细单</h1><p class='date'>" + data.dateStr + "</p><div class='customer'>客户：" + escapeHtml(data.customerName || "未填写") + "</div><div class='color'>颜色：" + escapeHtml(data.tileColor || "未填写") + "</div><div class='logo'>" + data.logoHtml + "</div></div>" +
          "<div class='content'><div><div class='section'><h2>一、主瓦汇总（1050 型）</h2><table><thead><tr><th>长度</th><th>实裁节数</th><th>数量</th><th>单项面积</th></tr></thead><tbody>" + mainRowsHtml +
          "<tr class='sum'><td colspan='3'>数量合计</td><td>" + formatTrimFixed(data.qtyTotal, 0) + "</td></tr><tr class='sum'><td colspan='3'>总面积合计</td><td>" + formatTrimFixed(data.areaTotal, 4) + "</td></tr><tr class='sum'><td colspan='3'>主瓦单价</td><td>" + (Number.isFinite(data.unitPrice) ? formatMoney(data.unitPrice) : "未填写") + "</td></tr><tr class='sum'><td colspan='3'>主瓦总金额</td><td>" + formatMoney(data.mainAmount) + "</td></tr></tbody></table></div></div>" +
          "<div><div class='section'><h2>二、配件清单</h2><table><thead><tr><th>名称</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + accessoryRowsHtml + "<tr class='sum'><td colspan='4'>配件总金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
          "<div class='section'><h2>三、钢铁材料</h2><table><thead><tr><th>名称</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + steelRowsHtml + "<tr class='sum'><td colspan='4'>钢铁材料总金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
          "<div class='section'><h2>四、其他瓦 / 特殊瓦</h2><table><thead><tr><th>名称</th><th>长度</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + otherTileRowsHtml + "<tr class='sum'><td colspan='5'>其他瓦总金额</td><td>" + formatMoney(data.otherTileAmount) + "</td></tr></tbody></table></div></div></div>" +
          "<div class='grand'>全单总合计 ≈ " + Math.round(data.grandAmount) + " 元</div>" +
          "<div class='sign'><p class='note'>温馨提示：请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。</p><div class='sign-row'><div><p>地址：惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）</p><p>电话：0595-27555859 / 15060629003</p></div><div><p>客户/代理人签字：________________________</p><p>收货日期：202_____年____月____日</p></div></div></div>" +
          "</body></html>";
      }

      function buildAccessoryOnlyReportData() {
        var accessories = getAccessoryRowsData();
        if (!accessories.length) return null;
        var accessoryAmount = accessories.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var today = new Date();
        var dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        return {
          accessories: accessories,
          accessoryAmount: accessoryAmount,
          dateStr: dateStr,
          customerName: customerNameInput.value.trim(),
          tileColor: tileColorInput.value.trim(),
          logoHtml: reportLogoDataUrl ? "<img src='" + reportLogoDataUrl + "' alt='企业 Logo' />" : ""
        };
      }

      function buildAccessoryOnlyReportHtml(data) {
        var accessoryRowsHtml = data.accessories.map(function (item, index) {
          return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
        }).join("");
        return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title>" +
          "<style>@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:108px;border-bottom:2px solid #1f261f;padding:6px 0 10px;margin-bottom:10px;}h1{margin:0;text-align:center;font-size:30px;line-height:1.16;letter-spacing:0;font-weight:900}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.meta{position:absolute;left:0;bottom:8px;display:grid;gap:5px;font-size:15px;font-weight:900}.logo{position:absolute;right:0;top:0;width:210px;height:88px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:88px;object-fit:contain}.table-wrap{margin-top:9px}table{width:100%;border-collapse:collapse;font-size:14px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:8px 6px;text-align:center;line-height:1.32;font-weight:800;}th{background:#eef3ef;font-weight:900}.idx{width:44px}.name{text-align:left;font-weight:900}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.summary{margin-top:11px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:9px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:12px;border-top:1px solid #c8cec9;padding-top:8px}.note{margin:0 0 8px;text-align:center;font-size:14px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;font-weight:800;line-height:1.65}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}</style>" +
          "</head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" +
          "<div class='header'><h1>配件出货清单</h1><p class='date'>" + data.dateStr + "</p><div class='meta'><div>客户：" + escapeHtml(data.customerName || "未填写") + "</div><div>颜色/备注：" + escapeHtml(data.tileColor || "未填写") + "</div></div><div class='logo'>" + data.logoHtml + "</div></div>" +
          "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>配件名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + accessoryRowsHtml +
          "<tr class='sum'><td colspan='5'>配件合计金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
          "<div class='summary'>配件总合计 ≈ " + Math.round(data.accessoryAmount) + " 元</div>" +
          "<div class='sign'><p class='note'>温馨提示：请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。</p><div class='sign-row'><div><p>地址：惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）</p><p>电话：0595-27555859 / 15060629003</p></div><div><p>客户/代理人签字：________________________</p><p>收货日期：202_____年____月____日</p></div></div></div>" +
          "</body></html>";
      }

      function buildSteelOnlyReportData() {
        var steels = getSteelRowsData();
        if (!steels.length) return null;
        var steelAmount = steels.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var today = new Date();
        var dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        return {
          steels: steels,
          steelAmount: steelAmount,
          dateStr: dateStr,
          customerName: customerNameInput.value.trim(),
          tileColor: tileColorInput.value.trim(),
          logoHtml: reportLogoDataUrl ? "<img src='" + reportLogoDataUrl + "' alt='企业 Logo' />" : ""
        };
      }

      function buildSteelOnlyReportHtml(data) {
        var steelRowsHtml = data.steels.map(function (item, index) {
          return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
        }).join("");
        var processText = data.steels.some(function (item) {
          return String(item.name || "").indexOf("镀锌方管") !== -1;
        }) ? "镀锌工艺：双镀锌" : "&nbsp;";
        return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title>" +
          "<style>@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:108px;border-bottom:2px solid #1f261f;padding:6px 0 10px;margin-bottom:10px;}h1{margin:0;text-align:center;font-size:30px;line-height:1.16;letter-spacing:0;font-weight:900}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.meta{position:absolute;left:0;bottom:8px;display:grid;gap:5px;font-size:15px;font-weight:900}.logo{position:absolute;right:0;top:0;width:210px;height:88px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:88px;object-fit:contain}.table-wrap{margin-top:9px}table{width:100%;border-collapse:collapse;font-size:14px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:8px 6px;text-align:center;line-height:1.32;font-weight:800;}th{background:#eef3ef;font-weight:900}.idx{width:44px}.name{text-align:left;font-weight:900}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.summary{margin-top:11px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:9px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:12px;border-top:1px solid #c8cec9;padding-top:8px}.note{margin:0 0 8px;text-align:center;font-size:14px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;font-weight:800;line-height:1.65}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}</style>" +
          "</head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" +
          "<div class='header'><h1>钢铁材料出货清单</h1><p class='date'>" + data.dateStr + "</p><div class='meta'><div>客户：" + escapeHtml(data.customerName || "未填写") + "</div><div>" + processText + "</div></div><div class='logo'>" + data.logoHtml + "</div></div>" +
          "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>材料名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + steelRowsHtml +
          "<tr class='sum'><td colspan='5'>钢铁材料合计金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
          "<div class='summary'>钢铁材料总合计 ≈ " + Math.round(data.steelAmount) + " 元</div>" +
          "<div class='sign'><p class='note'>温馨提示：请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。</p><div class='sign-row'><div><p>地址：惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）</p><p>电话：0595-27555859 / 15060629003</p></div><div><p>客户/代理人签字：________________________</p><p>收货日期：202_____年____月____日</p></div></div></div>" +
          "</body></html>";
      }

      function buildRoofMaterialReportData() {
        var accessories = getAccessoryRowsData();
        var steels = getSteelRowsData();
        if (!accessories.length || !steels.length) return null;
        var otherTiles = getOtherTileRowsData();
        var accessoryAmount = accessories.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var steelAmount = steels.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var otherTileAmount = otherTiles.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var today = new Date();
        var dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        return {
          accessories: accessories,
          accessoryAmount: accessoryAmount,
          steels: steels,
          steelAmount: steelAmount,
          otherTiles: otherTiles,
          otherTileAmount: otherTileAmount,
          grandAmount: accessoryAmount + steelAmount + otherTileAmount,
          dateStr: dateStr,
          customerName: customerNameInput.value.trim(),
          tileColor: tileColorInput.value.trim(),
          logoHtml: reportLogoDataUrl ? "<img src='" + reportLogoDataUrl + "' alt='企业 Logo' />" : ""
        };
      }

      function buildRoofMaterialReportHtml(data) {
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
        return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title>" +
          "<style>@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:108px;border-bottom:2px solid #1f261f;padding:6px 0 10px;margin-bottom:10px;}h1{margin:0;text-align:center;font-size:30px;line-height:1.16;letter-spacing:0;font-weight:900}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.meta{position:absolute;left:0;bottom:8px;display:grid;gap:5px;font-size:15px;font-weight:900}.logo{position:absolute;right:0;top:0;width:210px;height:88px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:88px;object-fit:contain}.section{margin-top:9px;break-inside:avoid}h2{margin:0 0 7px;font-size:16px;font-weight:900}table{width:100%;border-collapse:collapse;font-size:13px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:7px 5px;text-align:center;line-height:1.32;font-weight:800;}th{background:#eef3ef;font-weight:900}.idx{width:44px}.name{text-align:left;font-weight:900}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.summary{margin-top:11px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:9px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:12px;border-top:1px solid #c8cec9;padding-top:8px}.note{margin:0 0 8px;text-align:center;font-size:14px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;font-weight:800;line-height:1.65}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}</style>" +
          "</head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" +
          "<div class='header'><h1>屋面材料出货清单</h1><p class='date'>" + data.dateStr + "</p><div class='meta'><div>客户：" + escapeHtml(data.customerName || "未填写") + "</div><div>颜色/备注：" + escapeHtml(data.tileColor || "未填写") + "</div></div><div class='logo'>" + data.logoHtml + "</div></div>" +
          "<div class='section'><h2>一、配件清单</h2><table><thead><tr><th class='idx'>序号</th><th>配件名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + accessoryRowsHtml + "<tr class='sum'><td colspan='5'>配件合计金额</td><td>" + formatMoney(data.accessoryAmount) + "</td></tr></tbody></table></div>" +
          "<div class='section'><h2>二、钢铁材料</h2><table><thead><tr><th class='idx'>序号</th><th>材料名称 / 规格</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + steelRowsHtml + "<tr class='sum'><td colspan='5'>钢铁材料合计金额</td><td>" + formatMoney(data.steelAmount) + "</td></tr></tbody></table></div>" +
          otherTileSectionHtml +
          "<div class='summary'>屋面材料总合计 ≈ " + Math.round(data.grandAmount) + " 元</div>" +
          "<div class='sign'><p class='note'>温馨提示：请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。</p><div class='sign-row'><div><p>地址：惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）</p><p>电话：0595-27555859 / 15060629003</p></div><div><p>客户/代理人签字：________________________</p><p>收货日期：202_____年____月____日</p></div></div></div>" +
          "</body></html>";
      }

      function buildOtherTileOnlyReportData() {
        var otherTiles = getOtherTileRowsData();
        if (!otherTiles.length) return null;
        var otherTileAmount = otherTiles.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var today = new Date();
        var dateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        return {
          otherTiles: otherTiles,
          otherTileAmount: otherTileAmount,
          dateStr: dateStr,
          customerName: customerNameInput.value.trim(),
          tileColor: tileColorInput.value.trim(),
          logoHtml: reportLogoDataUrl ? "<img src='" + reportLogoDataUrl + "' alt='企业 Logo' />" : ""
        };
      }

      function buildOtherTileOnlyReportHtml(data) {
        var otherTileRowsHtml = data.otherTiles.map(function (item, index) {
          var lengthText = Number.isFinite(item.length) ? formatTrimFixed(item.length, 3) : "";
          return "<tr><td>" + (index + 1) + "</td><td class='name'>" + escapeHtml(item.name) + "</td><td>" + lengthText + "</td><td>" + formatTrimFixed(item.qty, 2) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
        }).join("");
        return "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'><title>" + escapeHtml(getReportFileTitle(data)) + "</title>" +
          "<style>@page{size:A4;margin:10mm;}*{box-sizing:border-box}body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:0;color:#1f261f;background:#fff;font-weight:800;}.actions{position:fixed;top:10px;left:10px;right:10px;z-index:10;display:flex;justify-content:space-between;pointer-events:none}.actions button{pointer-events:auto;height:42px;border-radius:8px;border:1px solid #ccd6ce;background:#fff;padding:0 16px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer}.actions .print{border-color:#13725d;background:#13725d;color:#fff}.spacer{height:52px}.header{position:relative;min-height:108px;border-bottom:2px solid #1f261f;padding:6px 0 10px;margin-bottom:10px;}h1{margin:0;text-align:center;font-size:30px;line-height:1.16;letter-spacing:0;font-weight:900}.date{text-align:center;color:#555;margin:5px 0 0;font-size:13px;font-weight:800}.meta{position:absolute;left:0;bottom:8px;display:grid;gap:5px;font-size:15px;font-weight:900}.logo{position:absolute;right:0;top:0;width:210px;height:88px;display:flex;align-items:center;justify-content:flex-end}.logo img{max-width:210px;max-height:88px;object-fit:contain}.table-wrap{margin-top:9px}table{width:100%;border-collapse:collapse;font-size:14px;font-weight:800;}th,td{border:1px solid #9ca69d;padding:8px 6px;text-align:center;line-height:1.32;font-weight:800;}th{background:#eef3ef;font-weight:900}.idx{width:44px}.name{text-align:left;font-weight:900}.sum td{font-weight:900;text-align:right}.sum td:last-child{text-align:center}.summary{margin-top:11px;border-top:2px solid #1f261f;border-bottom:2px solid #1f261f;padding:9px 0;text-align:right;font-size:22px;font-weight:900}.sign{margin-top:12px;border-top:1px solid #c8cec9;padding-top:8px}.note{margin:0 0 8px;text-align:center;font-size:14px;font-weight:900}.sign-row{display:flex;justify-content:space-between;gap:14px;font-size:14px;font-weight:800;line-height:1.65}.sign-row p{margin:0}@media print{.actions,.spacer{display:none!important}.header{margin-top:0}}</style>" +
          "</head><body><div class='actions'><button type='button' onclick='window.close()'>返回修改</button><button type='button' class='print' onclick='window.print()'>打印报表</button></div><div class='spacer'></div>" +
          "<div class='header'><h1>其他瓦出货清单</h1><p class='date'>" + data.dateStr + "</p><div class='meta'><div>客户：" + escapeHtml(data.customerName || "未填写") + "</div><div>颜色/备注：" + escapeHtml(data.tileColor || "未填写") + "</div></div><div class='logo'>" + data.logoHtml + "</div></div>" +
          "<div class='table-wrap'><table><thead><tr><th class='idx'>序号</th><th>名称 / 规格</th><th>长度</th><th>数量</th><th>单位</th><th>单价</th><th>小计金额</th></tr></thead><tbody>" + otherTileRowsHtml +
          "<tr class='sum'><td colspan='6'>其他瓦合计金额</td><td>" + formatMoney(data.otherTileAmount) + "</td></tr></tbody></table></div>" +
          "<div class='summary'>其他瓦总合计 ≈ " + Math.round(data.otherTileAmount) + " 元</div>" +
          "<div class='sign'><p class='note'>温馨提示：请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。</p><div class='sign-row'><div><p>地址：惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）</p><p>电话：0595-27555859 / 15060629003</p></div><div><p>客户/代理人签字：________________________</p><p>收货日期：202_____年____月____日</p></div></div></div>" +
          "</body></html>";
      }

      function openPrintWindow(html) {
        var reportWindow = window.open("", "_blank");
        if (!reportWindow) {
          window.alert("浏览器拦截了报表窗口，请允许弹窗后重试。");
          return false;
        }
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
        reportWindow.focus();
        return true;
      }

      function exportPdfReport() {
        recalcAll();
        recalcAccessoryTotals();
        recalcSteelTotals();
        recalcOtherTileTotals();
        var reportData = buildReportData();
        if (reportData) {
          openPrintWindow(buildReportHtml(reportData));
          return;
        }
        var roofMaterialReportData = buildRoofMaterialReportData();
        if (roofMaterialReportData) {
          openPrintWindow(buildRoofMaterialReportHtml(roofMaterialReportData));
          return;
        }
        var accessoryOnlyReportData = buildAccessoryOnlyReportData();
        if (accessoryOnlyReportData) {
          openPrintWindow(buildAccessoryOnlyReportHtml(accessoryOnlyReportData));
          return;
        }
        var steelOnlyReportData = buildSteelOnlyReportData();
        if (steelOnlyReportData) {
          openPrintWindow(buildSteelOnlyReportHtml(steelOnlyReportData));
          return;
        }
        var otherTileOnlyReportData = buildOtherTileOnlyReportData();
        if (otherTileOnlyReportData) {
          openPrintWindow(buildOtherTileOnlyReportHtml(otherTileOnlyReportData));
          return;
        }
        window.alert("没有有效主瓦、配件、钢铁材料或其他瓦数据可导出。");
      }

      function addSteelTube() {
        var spec = steelTubeSpecSelect.value;
        var thickness = steelTubeThicknessSelect.value;
        steelRowsEl.appendChild(createSteelRow("镀锌方管 " + spec + " 厚 " + thickness, "支"));
        recalcSteelTotals();
      }

      function addExpansionBolt() {
        steelRowsEl.appendChild(createSteelRow("膨胀螺丝 " + steelBoltSpecSelect.value, "盒"));
        recalcSteelTotals();
      }

      function setupNumberWheelGuard() {
        document.addEventListener("focusin", function (event) {
          var target = event.target;
          if (target && target.matches && target.matches('input[type="number"]')) {
            target.addEventListener("wheel", preventNumberWheel, { passive: false });
          }
        });
        document.addEventListener("focusout", function (event) {
          var target = event.target;
          if (target && target.matches && target.matches('input[type="number"]')) {
            target.removeEventListener("wheel", preventNumberWheel);
          }
        });
      }

      function preventNumberWheel(event) {
        if (event.target === document.activeElement) event.preventDefault();
      }

      navTabs.forEach(function (button) {
        button.addEventListener("click", function () {
          switchPanel(button.getAttribute("data-target"));
        });
      });

      addMainRowBtn.addEventListener("click", function () {
        rowsEl.appendChild(createMainRow());
        renumberRows();
        rowsEl.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      addAccessoryRowBottomBtn.addEventListener("click", function () {
        accessoryRowsEl.appendChild(createAccessoryRow("", false));
        recalcAccessoryTotals();
      });

      clearAccessoriesBtn.addEventListener("click", function () {
        accessoryRowsEl.innerHTML = "";
        clearPresetSelection(accPresetGrid);
        clearPresetSelection(accPresetGridUncommon);
        recalcAccessoryTotals();
      });

      steelAddTubeBtn.addEventListener("click", addSteelTube);
      steelAddBoltBtn.addEventListener("click", addExpansionBolt);

      addOtherTileRowBtn.addEventListener("click", function () {
        otherTileRowsEl.appendChild(createOtherTileRow(""));
        recalcOtherTileTotals();
      });

      unitPriceInput.addEventListener("input", recalcAll);
      globalSegmentInput.addEventListener("input", recalcAll);
      exportPdfBtn.addEventListener("click", exportPdfReport);
      exportPdfSideBtn.addEventListener("click", exportPdfReport);

      logoUploadInput.addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) {
          reportLogoDataUrl = "";
          clearLogoBtn.disabled = true;
          return;
        }
        if (!/^image\//.test(file.type)) {
          window.alert("仅支持上传图片文件作为 Logo。");
          logoUploadInput.value = "";
          reportLogoDataUrl = "";
          clearLogoBtn.disabled = true;
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          window.alert("Logo 文件过大，请控制在 5MB 以内。");
          logoUploadInput.value = "";
          reportLogoDataUrl = "";
          clearLogoBtn.disabled = true;
          return;
        }
        var reader = new FileReader();
        reader.onload = function (readerEvent) {
          reportLogoDataUrl = String(readerEvent.target.result || "");
          clearLogoBtn.disabled = !reportLogoDataUrl;
        };
        reader.readAsDataURL(file);
      });

      clearLogoBtn.addEventListener("click", function () {
        logoUploadInput.value = "";
        reportLogoDataUrl = "";
        clearLogoBtn.disabled = true;
      });

      PRESET_ACCESSORIES.forEach(function (name) {
        addPresetButton(name, accPresetGrid, function (selectedName) {
          accessoryRowsEl.appendChild(createAccessoryRow(selectedName, true));
          recalcAccessoryTotals();
        });
      });

      UNCOMMON_ACCESSORIES.forEach(function (name) {
        addPresetButton(name, accPresetGridUncommon, function (selectedName) {
          accessoryRowsEl.appendChild(createAccessoryRow(selectedName, true));
          recalcAccessoryTotals();
        });
      });

      STEEL_PRESETS.forEach(function (name) {
        addPresetButton(name, steelPresetGrid, function (selectedName) {
          steelRowsEl.appendChild(createSteelRow(selectedName, getSteelDefaultUnit(selectedName)));
          recalcSteelTotals();
        });
      });

      OTHER_TILE_PRESETS.forEach(function (name) {
        addPresetButton(name, otherTilePresetGrid, function (selectedName) {
          otherTileRowsEl.appendChild(createOtherTileRow(selectedName));
          recalcOtherTileTotals();
        });
      });

      appendRows(12);
      setupNumberWheelGuard();
      ensureTrailingBlankRow();
      recalcAccessoryTotals();
      recalcSteelTotals();
      recalcOtherTileTotals();
