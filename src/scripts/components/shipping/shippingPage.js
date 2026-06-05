import {
  actualSegments,
  computeArea,
  computeGrandAmount,
  computeLineSubtotal,
  computeMainAmount,
  computeSlopeLength,
  lengthToPreciseSegments,
  segmentCountToLength
} from "../../calc.js";
import { evaluateCuttingAdviceFromApi, isApiConfigured } from "../../services/apiClient.js";
import { buildCuttingPlans, formatCuttingPlan } from "../../services/cuttingPlanner.js";
import { buildPreferredReport } from "../../services/reportService.js";
import { escapeHtml, formatMoney, formatNum, formatTrimFixed, parseNum } from "../../utils.js";

function sortBySort(items) {
  return (Array.isArray(items) ? items : []).slice().sort(function (a, b) {
    return Number(a.sort || 0) - Number(b.sort || 0);
  });
}

function getEnabledItems(items) {
  return sortBySort(items).filter(function (item) { return item.enabled !== false; });
}

function getOptionValue(item) {
  return item && item.value !== undefined && item.value !== null ? String(item.value) : "";
}

function getCatalogPrice(item) {
  if (!item || item.defaultPrice === "" || item.defaultPrice === null || item.defaultPrice === undefined) return NaN;
  return Number.isFinite(Number(item.defaultPrice)) ? Number(item.defaultPrice) : NaN;
}

export function formatInputPrice(item, options) {
  var price = getCatalogPrice(item);
  if (options && options.blankZero && price === 0) return "";
  return Number.isFinite(price) ? String(price) : "";
}

export function normalizeOrderSegmentLength(value) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : NaN;
}

export function attachMainTileSegmentLength(rows, segmentLength) {
  var normalizedSegment = normalizeOrderSegmentLength(segmentLength);
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    var next = Object.assign({}, row || {});
    if (Number.isFinite(normalizedSegment)) next.segmentLength = normalizedSegment;
    return next;
  });
}

function getDisplayName(item) {
  if (!item) return "";
  return [item.name, item.spec].filter(Boolean).join(" ").trim();
}

export function initShippingPage(options) {
  var getConfig = options.getConfig;
  var currentConfig = getConfig();
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
  var orderDateInput = document.getElementById("orderDate");
  var customerNameInput = document.getElementById("customerName");
  var tileColorInput = document.getElementById("tileColor");
  var deliveryAddressInput = document.getElementById("deliveryAddress");
  var completionMonthInput = document.getElementById("completionMonth");
  var orderRemarkInput = document.getElementById("orderRemark");
  var tileColorOptions = document.getElementById("tileColorOptions");
  var unitOptions = document.getElementById("unitOptions");
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
  var fixedWidthFact = document.getElementById("fixedWidthFact");
  var defaultSegmentFact = document.getElementById("defaultSegmentFact");
  var fixedWidthDisplay = document.getElementById("fixedWidthDisplay");
  var reportLogoDataUrl = "";
  var cuttingAdviceBtn = null;
  var cuttingAdvicePanel = null;
  var hasGeneratedCuttingAdvice = false;
  var latestCuttingAdviceResult = null;
  var selectedPlan = null;
  var selectedPlanSignature = "";
  var cuttingEvaluation = null;
  var cuttingEvaluationStatus = "idle";
  var cuttingEvaluationMessage = "";
  var cuttingEvaluationRequestId = 0;
  var totals = {
    area: 0,
    main: 0,
    accessories: 0,
    steel: 0,
    otherTiles: 0,
    grand: 0
  };

  function iconSvg(name) {
    return '<svg class="ui-icon" aria-hidden="true"><use href="#icon-' + name + '"></use></svg>';
  }

  function getConfiguredUnit(preferredUnit) {
    var units = getEnabledItems(currentConfig.unitOptions).map(getOptionValue);
    if (preferredUnit && units.indexOf(preferredUnit) !== -1) return preferredUnit;
    return units[0] || preferredUnit || "";
  }

  function getFixedWidth() {
    var width = Number(currentConfig.basics.fixedWidth);
    return Number.isFinite(width) && width > 0 ? width : 1.05;
  }

  function getGlobalSegment() {
    var value = parseNum(globalSegmentInput.value);
    return Number.isFinite(value) && value > 0 ? value : NaN;
  }

  function getCurrentMainTileSegmentLength() {
    return normalizeOrderSegmentLength(globalSegmentInput && globalSegmentInput.value);
  }

  function getMainAmount(area) {
    var unitPrice = parseNum(unitPriceInput.value);
    return computeMainAmount(area, unitPrice);
  }

  function getDateOnly(date) {
    var value = date instanceof Date ? date : new Date();
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  }

  function ensureOrderDate() {
    if (orderDateInput && !orderDateInput.value) orderDateInput.value = getDateOnly(new Date());
  }

  function renderDataList(listEl, optionsList) {
    if (!listEl) return;
    listEl.innerHTML = getEnabledItems(optionsList).map(function (item) {
      return '<option value="' + escapeHtml(getOptionValue(item)) + '"></option>';
    }).join("");
  }

  function renderSelect(selectEl, optionsList, preferredValue) {
    if (!selectEl) return;
    var previous = selectEl.value;
    var enabled = getEnabledItems(optionsList);
    selectEl.innerHTML = enabled.map(function (item) {
      var value = getOptionValue(item);
      return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>';
    }).join("");
    var preferred = preferredValue !== undefined && preferredValue !== null ? String(preferredValue) : previous;
    var hasPreferred = enabled.some(function (item) { return getOptionValue(item) === preferred; });
    selectEl.value = hasPreferred ? preferred : (enabled.length ? getOptionValue(enabled[0]) : "");
  }

  function renderQuickFacts() {
    if (fixedWidthFact) fixedWidthFact.textContent = "宽度 " + getFixedWidth() + " m";
    if (defaultSegmentFact) defaultSegmentFact.textContent = "默认节长 " + currentConfig.basics.defaultSegmentLength + " m";
    if (fixedWidthDisplay) fixedWidthDisplay.textContent = String(getFixedWidth());
  }

  function renderPresetButtons() {
    accPresetGrid.innerHTML = "";
    accPresetGridUncommon.innerHTML = "";
    steelPresetGrid.innerHTML = "";
    otherTilePresetGrid.innerHTML = "";

    getEnabledItems(currentConfig.accessories).forEach(function (item) {
      addPresetButton(getDisplayName(item), item.common ? accPresetGrid : accPresetGridUncommon, function () {
        accessoryRowsEl.appendChild(createAccessoryRow(item, true));
        recalcAccessoryTotals();
      });
    });

    getEnabledItems(currentConfig.steel.materials).forEach(function (item) {
      addPresetButton(getDisplayName(item), steelPresetGrid, function () {
        steelRowsEl.appendChild(createSteelRow(item));
        recalcSteelTotals();
      });
    });

    getEnabledItems(currentConfig.otherTiles).forEach(function (item) {
      addPresetButton(getDisplayName(item), otherTilePresetGrid, function () {
        otherTileRowsEl.appendChild(createOtherTileRow(item));
        recalcOtherTileTotals();
      });
    });
  }

  function applyConfig(nextConfig, meta) {
    currentConfig = nextConfig || getConfig();
    var selectedSegment = globalSegmentInput.value || currentConfig.basics.defaultSegmentLength;
    renderSelect(globalSegmentInput, currentConfig.basics.segmentLengths, selectedSegment || currentConfig.basics.defaultSegmentLength);
    if (!globalSegmentInput.value) renderSelect(globalSegmentInput, currentConfig.basics.segmentLengths, currentConfig.basics.defaultSegmentLength);
    renderSelect(steelTubeSpecSelect, currentConfig.steel.tubeSpecs);
    renderSelect(steelTubeThicknessSelect, currentConfig.steel.thicknessOptions);
    renderSelect(steelBoltSpecSelect, currentConfig.steel.boltSpecs);
    renderDataList(tileColorOptions, currentConfig.basics.colorOptions);
    renderDataList(unitOptions, currentConfig.unitOptions);
    renderQuickFacts();
    renderPresetButtons();
    if ((meta && meta.initial) && Number.isFinite(Number(currentConfig.basics.mainTileDefaultPrice))) {
      unitPriceInput.value = String(currentConfig.basics.mainTileDefaultPrice);
    } else if (!unitPriceInput.value && Number.isFinite(Number(currentConfig.basics.mainTileDefaultPrice))) {
      unitPriceInput.value = String(currentConfig.basics.mainTileDefaultPrice);
    }
    recalcAll();
    recalcAccessoryTotals();
    recalcSteelTotals();
    recalcOtherTileTotals();
  }

  function updateSlopePlaceholder(row) {
    var modeInput = row.querySelector(".inp-slope-mode");
    var slopeInput = row.querySelector(".inp-slope-value");
    if (!modeInput || !slopeInput) return;
    slopeInput.placeholder = "";
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
      length = segmentCountToLength(segCount, segment);
      lengthSource = "segment";
    } else if (!Number.isFinite(segCount) && Number.isFinite(slopeLength)) {
      length = Number(slopeLength.toFixed(3));
      lengthSource = "slope";
    }
    var precise = lengthToPreciseSegments(length, segment);
    var actual = actualSegments(precise);
    var area = computeArea(length, qty, getFixedWidth());
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
      '<label class="line-field"><span class="field-label">水平投影 A（米）</span><input class="inp-proj" type="text" inputmode="decimal" /></label>' +
      '<label class="line-field"><span class="field-label">换算方式</span><select class="inp-slope-mode"><option value="percent">坡度 %</option><option value="angle">角度 °</option></select></label>' +
      '<label class="line-field"><span class="field-label">坡度/角度</span><input class="inp-slope-value" type="text" inputmode="decimal" /></label>' +
      '<label class="line-field"><span class="field-label">长度 L（米）</span><input class="inp-l" type="text" inputmode="decimal" /></label>' +
      '<label class="line-field"><span class="field-label">节数</span><input class="inp-seg" type="number" inputmode="decimal" step="1" /></label>' +
      '<label class="line-field"><span class="field-label">数量 Q</span><input class="inp-q" type="number" inputmode="decimal" step="1" /></label>' +
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
    totals.main = getMainAmount(sumArea);
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
    var mergedRows = Object.keys(grouped).map(function (key) {
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
    return attachMainTileSegmentLength(mergedRows, getCurrentMainTileSegmentLength());
  }

  function getDefaultUnitByName(name) {
    return getConfiguredUnit("件");
  }

  function createAccessoryRow(itemOrName, highlight) {
    var row = document.createElement("div");
    var item = typeof itemOrName === "object" ? itemOrName : null;
    var name = item ? getDisplayName(item) : String(itemOrName || "");
    var defaultUnit = item && item.defaultUnit ? item.defaultUnit : getDefaultUnitByName(name);
    row.className = "line-row acc-row";
    if (highlight) row.classList.add("is-new");
    row.innerHTML =
      '<label class="line-field"><span class="field-label">名称</span><input class="acc-name" type="text" value="' + escapeHtml(name) + '" /></label>' +
      '<label class="line-field"><span class="field-label">数量</span><input class="acc-qty" type="number" inputmode="decimal" step="1" /></label>' +
      '<label class="line-field"><span class="field-label">单位</span><input class="acc-unit" type="text" list="unitOptions" value="' + escapeHtml(defaultUnit) + '" /></label>' +
      '<label class="line-field"><span class="field-label">单价</span><input class="acc-price" type="number" inputmode="decimal" step="0.01" value="' + escapeHtml(formatInputPrice(item, { blankZero: true })) + '" /></label>' +
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
      var subtotal = computeLineSubtotal(qty, price);
      return { name: name, qty: qty, unit: unit, price: price, subtotal: subtotal };
    }).filter(function (item) {
      return item.name && Number.isFinite(item.subtotal);
    });
  }

  function recalcAccessoryTotals() {
    var total = 0;
    Array.prototype.slice.call(accessoryRowsEl.querySelectorAll(".acc-row")).forEach(function (row) {
      var qty = parseNum(row.querySelector(".acc-qty").value);
      var price = parseNum(row.querySelector(".acc-price").value);
      var subtotal = computeLineSubtotal(qty, price);
      row.querySelector(".acc-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
      if (Number.isFinite(subtotal)) total += subtotal;
    });
    totals.accessories = total;
    accAmountEl.textContent = formatMoney(total);
    accAmountInlineEl.textContent = formatMoney(total);
    recalcGrandTotal();
  }

  function getSteelDefaultUnit(name) {
    return getConfiguredUnit("件");
  }

  function createSteelRow(itemOrName, unit) {
    var row = document.createElement("div");
    var item = typeof itemOrName === "object" ? itemOrName : null;
    var name = item ? getDisplayName(item) : String(itemOrName || "");
    var finalUnit = item && item.defaultUnit ? item.defaultUnit : (unit || getSteelDefaultUnit(name));
    row.className = "line-row steel-row";
    row.innerHTML =
      '<label class="line-field"><span class="field-label">名称</span><input class="steel-name" type="text" value="' + escapeHtml(name) + '" /></label>' +
      '<label class="line-field"><span class="field-label">数量</span><input class="steel-qty" type="number" inputmode="decimal" step="1" /></label>' +
      '<label class="line-field"><span class="field-label">单位</span><input class="steel-unit" type="text" list="unitOptions" value="' + escapeHtml(finalUnit) + '" /></label>' +
      '<label class="line-field"><span class="field-label">单价</span><input class="steel-price" type="number" inputmode="decimal" step="0.01" value="' + escapeHtml(formatInputPrice(item, { blankZero: true })) + '" /></label>' +
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
      var subtotal = computeLineSubtotal(qty, price);
      return { name: name, qty: qty, unit: unit, price: price, subtotal: subtotal };
    }).filter(function (item) {
      return item.name && Number.isFinite(item.subtotal);
    });
  }

  function recalcSteelTotals() {
    var total = 0;
    Array.prototype.slice.call(steelRowsEl.querySelectorAll(".steel-row")).forEach(function (row) {
      var qty = parseNum(row.querySelector(".steel-qty").value);
      var price = parseNum(row.querySelector(".steel-price").value);
      var subtotal = computeLineSubtotal(qty, price);
      row.querySelector(".steel-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
      if (Number.isFinite(subtotal)) total += subtotal;
    });
    totals.steel = total;
    steelAmountEl.textContent = formatMoney(total);
    steelAmountFooterEl.textContent = formatMoney(total);
    recalcGrandTotal();
  }

  function createOtherTileRow(itemOrName) {
    var row = document.createElement("div");
    var item = typeof itemOrName === "object" ? itemOrName : null;
    var name = item ? getDisplayName(item) : String(itemOrName || "");
    var defaultUnit = item && item.defaultUnit ? item.defaultUnit : getConfiguredUnit("片");
    row.className = "line-row other-row";
    row.innerHTML =
      '<label class="line-field"><span class="field-label">名称</span><input class="other-tile-name" type="text" value="' + escapeHtml(name) + '" /></label>' +
      '<label class="line-field"><span class="field-label">长度</span><input class="other-tile-length" type="number" inputmode="decimal" step="0.001" /></label>' +
      '<label class="line-field"><span class="field-label">数量</span><input class="other-tile-qty" type="number" inputmode="decimal" step="1" /></label>' +
      '<label class="line-field"><span class="field-label">单位</span><input class="other-tile-unit" type="text" list="unitOptions" value="' + escapeHtml(defaultUnit) + '" /></label>' +
      '<label class="line-field"><span class="field-label">单价</span><input class="other-tile-price" type="number" inputmode="decimal" step="0.01" value="' + escapeHtml(formatInputPrice(item)) + '" /></label>' +
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
      var subtotal = computeLineSubtotal(qty, price);
      return { name: name, length: length, qty: qty, unit: unit, price: price, subtotal: subtotal };
    }).filter(function (item) {
      return item.name && Number.isFinite(item.subtotal);
    });
  }

  function recalcOtherTileTotals() {
    var total = 0;
    Array.prototype.slice.call(otherTileRowsEl.querySelectorAll(".other-row")).forEach(function (row) {
      var qty = parseNum(row.querySelector(".other-tile-qty").value);
      var price = parseNum(row.querySelector(".other-tile-price").value);
      var subtotal = computeLineSubtotal(qty, price);
      row.querySelector(".other-tile-subtotal").textContent = Number.isFinite(subtotal) ? formatMoney(subtotal) : "—";
      if (Number.isFinite(subtotal)) total += subtotal;
    });
    totals.otherTiles = total;
    otherTileAmountEl.textContent = formatMoney(total);
    otherTileAmountFooterEl.textContent = formatMoney(total);
    recalcGrandTotal();
  }

  function recalcGrandTotal() {
    totals.grand = computeGrandAmount(totals.main, totals.accessories, totals.steel, totals.otherTiles);
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

  function getCurrentCuttingAdvice() {
    return buildCuttingPlans({
      stockSegments: 60,
      pieces: getMergedMainRows()
    });
  }

  function renderCuttingWarnings(warnings) {
    if (!warnings || !warnings.length) return "";
    return "<ul class='cutting-warning-list'>" + warnings.map(function (warning) {
      return "<li>" + escapeHtml(warning) + "</li>";
    }).join("") + "</ul>";
  }

  function displayCuttingValue(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function getCuttingPlanSignature(plan) {
    return JSON.stringify(compactCuttingPlan(plan));
  }

  function setSelectedCuttingPlan(plan) {
    selectedPlan = plan || null;
    selectedPlanSignature = plan ? getCuttingPlanSignature(plan) : "";
  }

  function getSelectedCuttingPlan(plans) {
    var list = Array.isArray(plans) ? plans : [];
    if (!list.length) return null;
    if (selectedPlanSignature) {
      var match = list.find(function (plan) {
        return getCuttingPlanSignature(plan) === selectedPlanSignature;
      });
      if (match) return match;
    }
    return list[0];
  }

  function getCuttingScoreText(plan) {
    var score = Number(plan && plan.score);
    return Number.isFinite(score) ? formatTrimFixed(score, 1) : "";
  }

  function getCuttingLineText(cut) {
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
    return (parts.length ? parts.join(" + ") : String(cut && cut.description || "")) + " = 剩" + displayCuttingValue(cut && cut.wasteSegments);
  }

  function getCuttingRoundRows(plan, maxRows) {
    var rounds = Array.isArray(plan && plan.cuttingRounds) ? plan.cuttingRounds : [];
    var limit = maxRows || 12;
    if (rounds.length) {
      var visibleRounds = rounds.slice(0, limit).map(function (round, index) {
        return "第" + (index + 1) + "轮：" + (round.lineText || "");
      });
      if (rounds.length > limit) {
        visibleRounds.push("还有 " + (rounds.length - limit) + " 轮未展开");
      }
      return visibleRounds;
    }
    var rows = [];
    var source = Array.isArray(plan && plan.cuts) ? plan.cuts : [];
    source.forEach(function (cut) {
      var repeat = Math.max(1, Math.trunc(Number(cut.repeat) || 1));
      var text = getCuttingLineText(cut);
      if (repeat <= 3 && rows.length + repeat <= limit) {
        for (var index = 0; index < repeat; index += 1) rows.push("第" + (rows.length + 1) + "轮：" + text);
        return;
      }
      rows.push("第" + (rows.length + 1) + "轮：" + text + (repeat > 1 ? " × " + repeat + "支" : ""));
    });
    if (rows.length > limit) {
      return rows.slice(0, limit).concat(["还有 " + (rows.length - limit) + " 轮未展开"]);
    }
    return rows;
  }

  function renderCuttingRoundList(plan) {
    var rows = getCuttingRoundRows(plan, 12);
    if (!rows.length) return "";
    rows = rows.map(function (line) {
      return "<li>" + escapeHtml(line) + "</li>";
    }).join("");
    return "<div class='cutting-rounds'><strong>裁切安排</strong><ol class='cutting-cut-list'>" + rows + "</ol></div>";
  }

  function renderCuttingWorkInfo(plan) {
    return "<div class='cutting-work-info'>" +
      "<span>需要原板：" + escapeHtml(displayCuttingValue(plan.boardCount)) + "支</span>" +
      "<span>预计裁切轮数：" + escapeHtml(displayCuttingValue(plan.estimatedCutRounds)) + "轮</span>" +
      "</div>";
  }

  function renderCuttingPlanCard(plan, index) {
    var signature = getCuttingPlanSignature(plan);
    var isSelected = selectedPlanSignature ? signature === selectedPlanSignature : index === 0;
    var activeClass = isSelected ? " is-selected" : "";
    var scoreText = getCuttingScoreText(plan);
    return "<article class='cutting-plan-card" + activeClass + "'>" +
      "<div class='cutting-plan-title'><div><h3>" + escapeHtml(plan.title || ("方案 " + (index + 1))) + "</h3>" +
      (plan.strategyLabel ? "<small>" + escapeHtml(plan.strategyLabel) + "</small>" : "") + "</div>" +
      (isSelected ? "<span>当前选中</span>" : "") + "</div>" +
      (scoreText ? "<p class='cutting-score'>评分：" + escapeHtml(scoreText) + "分</p>" : "") +
      renderCuttingWorkInfo(plan) +
      renderCuttingRoundList(plan) +
      "<button type='button' class='btn btn-soft cutting-use-plan' data-cutting-plan-index='" + index + "'" + (isSelected ? " disabled" : "") + ">" + (isSelected ? "已使用此方案" : "使用此方案") + "</button>" +
      "</article>";
  }

  function compactCuttingEvaluationText(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 500);
  }

  function looksLikeRawCuttingEvaluationJson(value) {
    var text = String(value || "").trim();
    return /^```/.test(text) ||
      /^[\[{"]/.test(text) ||
      /["']score["']\s*:/.test(text) ||
      /["']label["']\s*:/.test(text) ||
      /["']summary["']\s*:/.test(text) ||
      /["']reasons["']\s*:/.test(text) ||
      /["']cautions["']\s*:/.test(text) ||
      /\\"score\\"\s*:/.test(text) ||
      /\\"label\\"\s*:/.test(text) ||
      /\\"summary\\"\s*:/.test(text) ||
      /\\"reasons\\"\s*:/.test(text) ||
      /\\"cautions\\"\s*:/.test(text);
  }

  function parseCuttingEvaluationJson(value, depth) {
    if (depth > 4) return null;
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string") return null;
    var text = String(value || "").trim();
    if (!text) return null;
    try {
      var parsed = JSON.parse(text);
      var nested = parseCuttingEvaluationJson(parsed, depth + 1);
      if (nested) return nested;
    } catch (error) {
      // Fall through to fenced/raw object extraction.
    }
    var fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced) {
      var fencedParsed = parseCuttingEvaluationJson(fenced[1], depth + 1);
      if (fencedParsed) return fencedParsed;
    }
    var objectMatch = /\{[\s\S]*\}/.exec(text);
    if (objectMatch) {
      var objectParsed = parseCuttingEvaluationJson(objectMatch[0], depth + 1);
      if (objectParsed) return objectParsed;
    }
    return null;
  }

  function normalizeCuttingAiScore(value) {
    var raw = value;
    if (typeof raw === "string") {
      var match = /-?\d+(?:\.\d+)?/.exec(raw);
      raw = match ? match[0] : raw;
    }
    var score = Number(raw);
    if (!Number.isFinite(score)) return null;
    return Math.round(Math.min(10, Math.max(1, score)) * 10) / 10;
  }

  function deriveCuttingAiLabel(score) {
    if (!Number.isFinite(score)) return "";
    if (score >= 9) return "推荐";
    if (score >= 7) return "可用";
    if (score >= 5) return "一般";
    return "不建议";
  }

  function normalizeCuttingAiLabel(value, score) {
    var text = compactCuttingEvaluationText(value, 20);
    var labels = ["推荐", "可用", "一般", "不建议"];
    var match = labels.find(function (label) {
      return text.indexOf(label) !== -1;
    });
    return match || deriveCuttingAiLabel(score);
  }

  function normalizeCuttingEvaluation(evaluation) {
    var source = parseCuttingEvaluationJson(evaluation, 0);
    if (!source && typeof evaluation === "string" && !looksLikeRawCuttingEvaluationJson(evaluation)) {
      var textScore = normalizeCuttingAiScore(evaluation);
      return textScore === null ? null : {
        score: textScore,
        label: normalizeCuttingAiLabel(evaluation, textScore)
      };
    }
    if (!source) return null;
    var nestedScore = parseCuttingEvaluationJson(source.score, 0);
    if (nestedScore) return normalizeCuttingEvaluation(nestedScore);
    var score = normalizeCuttingAiScore(source.score);
    if (score === null) score = normalizeCuttingAiScore(source.aiScore);
    if (score === null && /评分|score/i.test(String(source.text || ""))) {
      score = normalizeCuttingAiScore(source.text);
    }
    if (score === null) return null;
    return {
      score: score,
      label: normalizeCuttingAiLabel(source.label || source.tag || source.summary || source.text, score)
    };
  }

  function renderCuttingEvaluation() {
    if (cuttingEvaluationStatus === "loading") {
      return "<details class='cutting-ai-panel is-loading'><summary>AI参考评分</summary><p>正在生成 AI 评分...</p></details>";
    }
    if (cuttingEvaluationStatus === "error") {
      return "<details class='cutting-ai-panel is-muted'><summary>AI参考评分</summary><p>" + escapeHtml(cuttingEvaluationMessage || "AI评分暂不可用，已显示本地裁板方案。") + "</p></details>";
    }
    if (cuttingEvaluationStatus !== "success" || !cuttingEvaluation) return "";
    return "<details class='cutting-ai-panel'><summary>AI参考评分</summary>" +
      "<p class='cutting-ai-score'><span>AI参考评分：" + escapeHtml(formatTrimFixed(cuttingEvaluation.score, 1)) + "分</span><span>标签：" + escapeHtml(cuttingEvaluation.label) + "</span></p>" +
      "</details>";
  }

  function renderCuttingAdvice(result) {
    if (!cuttingAdvicePanel) return;
    var plans = result && Array.isArray(result.plans) ? result.plans : [];
    var warnings = result && Array.isArray(result.warnings) ? result.warnings : [];
    cuttingAdvicePanel.hidden = false;
    if (!plans.length) {
      cuttingAdvicePanel.innerHTML =
        "<div class='cutting-advice-head'><div><h3>裁板建议（60节原板）</h3><p>请先填写主瓦长度和数量后再生成裁板建议</p></div></div>" +
        renderCuttingWarnings(warnings);
      return;
    }
    var activePlan = getSelectedCuttingPlan(plans);
    setSelectedCuttingPlan(activePlan);
    cuttingAdvicePanel.innerHTML =
      "<div class='cutting-advice-head'><div><h3>裁板建议（60节原板）</h3><p>方案按评分排序，可选择打印使用的方案。</p></div></div>" +
      renderCuttingWarnings(warnings) +
      "<div class='cutting-plan-grid'>" + plans.map(renderCuttingPlanCard).join("") + "</div>" +
      renderCuttingEvaluation();
  }

  function compactCuttingCut(cut) {
    return {
      description: String(cut && cut.description || "").trim(),
      repeat: Number(cut && cut.repeat) || 1,
      wasteSegments: Number(cut && cut.wasteSegments) || 0,
      usedSegments: Number(cut && cut.usedSegments) || 0
    };
  }

  function compactCuttingPlan(plan) {
    return {
      title: String(plan && plan.title || "").trim(),
      boardCount: Number(plan && plan.boardCount) || 0,
      totalWasteSegments: Number(plan && plan.totalWasteSegments) || 0,
      fullBoardCount: Number(plan && plan.fullBoardCount) || 0,
      summaryText: String(plan && plan.summaryText || "").trim(),
      cuts: (Array.isArray(plan && plan.cuts) ? plan.cuts : []).slice(0, 8).map(compactCuttingCut)
    };
  }

  function buildCuttingEvaluationPayload(result) {
    var plans = result && Array.isArray(result.plans) ? result.plans : [];
    var recommendedPlan = plans[0] ? compactCuttingPlan(plans[0]) : null;
    return {
      stockSegments: result && result.stockSegments ? result.stockSegments : 60,
      plans: recommendedPlan ? [recommendedPlan] : [],
      recommendedPlan: recommendedPlan
    };
  }

  function applyCuttingEvaluationFallback(message) {
    cuttingEvaluationStatus = "error";
    cuttingEvaluation = null;
    cuttingEvaluationMessage = message || "AI评分暂不可用，已显示本地裁板方案。";
    renderCuttingAdvice(latestCuttingAdviceResult);
  }

  function requestCuttingEvaluation(result) {
    var plans = result && Array.isArray(result.plans) ? result.plans : [];
    if (!plans.length) return;
    cuttingEvaluationRequestId += 1;
    var requestId = cuttingEvaluationRequestId;
    cuttingEvaluationStatus = "loading";
    cuttingEvaluation = null;
    cuttingEvaluationMessage = "";
    renderCuttingAdvice(result);

    if (!isApiConfigured()) {
      applyCuttingEvaluationFallback("AI评分暂不可用，已显示本地裁板方案。");
      return;
    }

    evaluateCuttingAdviceFromApi(buildCuttingEvaluationPayload(result)).then(function (payload) {
      if (requestId !== cuttingEvaluationRequestId) return;
      var normalizedEvaluation = payload && payload.ok ? normalizeCuttingEvaluation(payload.evaluation) : null;
      if (normalizedEvaluation) {
        cuttingEvaluationStatus = "success";
        cuttingEvaluation = normalizedEvaluation;
        cuttingEvaluationMessage = "";
      } else {
        cuttingEvaluationStatus = "error";
        cuttingEvaluation = null;
        cuttingEvaluationMessage = payload && payload.message ? payload.message : "AI评分暂不可用，已显示本地裁板方案。";
      }
      renderCuttingAdvice(latestCuttingAdviceResult);
    }).catch(function () {
      if (requestId !== cuttingEvaluationRequestId) return;
      applyCuttingEvaluationFallback("AI评分暂不可用，已显示本地裁板方案。");
    });
  }

  function handleGenerateCuttingAdvice() {
    recalcAll();
    var result = getCurrentCuttingAdvice();
    latestCuttingAdviceResult = result;
    hasGeneratedCuttingAdvice = true;
    setSelectedCuttingPlan(result && result.plans && result.plans[0] ? result.plans[0] : null);
    cuttingEvaluation = null;
    cuttingEvaluationStatus = "idle";
    cuttingEvaluationMessage = "";
    renderCuttingAdvice(result);
    requestCuttingEvaluation(result);
  }

  function setupCuttingAdviceUi() {
    if (cuttingAdviceBtn || !addMainRowBtn || !rowsEl) return;
    cuttingAdviceBtn = document.createElement("button");
    cuttingAdviceBtn.type = "button";
    cuttingAdviceBtn.className = "btn btn-soft cutting-advice-btn";
    cuttingAdviceBtn.innerHTML = iconSvg("layers") + "<span>生成裁板建议</span>";
    addMainRowBtn.insertAdjacentElement("beforebegin", cuttingAdviceBtn);

    cuttingAdvicePanel = document.createElement("section");
    cuttingAdvicePanel.className = "cutting-advice-panel";
    cuttingAdvicePanel.hidden = true;
    var emptyNote = document.querySelector("#mainPanel .empty-note");
    if (emptyNote) {
      emptyNote.insertAdjacentElement("afterend", cuttingAdvicePanel);
    } else {
      rowsEl.insertAdjacentElement("afterend", cuttingAdvicePanel);
    }
    cuttingAdviceBtn.addEventListener("click", handleGenerateCuttingAdvice);
    cuttingAdvicePanel.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("[data-cutting-plan-index]") : null;
      if (!target || !latestCuttingAdviceResult || !Array.isArray(latestCuttingAdviceResult.plans)) return;
      var index = Number(target.getAttribute("data-cutting-plan-index"));
      var nextPlan = latestCuttingAdviceResult.plans[index];
      if (!nextPlan) return;
      setSelectedCuttingPlan(nextPlan);
      renderCuttingAdvice(latestCuttingAdviceResult);
    });
  }

  function getPrintableCuttingAdvice() {
    if (!hasGeneratedCuttingAdvice) return null;
    var result = getCurrentCuttingAdvice();
    var plan = result && Array.isArray(result.plans) ? getSelectedCuttingPlan(result.plans) : null;
    if (!plan) return null;
    return {
      stockSegments: result.stockSegments,
      selectedPlan: plan,
      recommendedPlan: plan,
      summaryText: formatCuttingPlan(plan),
      warnings: result.warnings || []
    };
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

  function buildReportSnapshot() {
    var areaTotal = totals.area;
    var unitPrice = parseNum(unitPriceInput.value);
    var mainTileSegmentLength = getCurrentMainTileSegmentLength();
    ensureOrderDate();
    var snapshot = {
      orderDate: orderDateInput ? orderDateInput.value : getDateOnly(new Date()),
      mainRows: getMergedMainRows(),
      unitPrice: unitPrice,
      mainAmount: getMainAmount(areaTotal),
      accessories: getAccessoryRowsData(),
      steels: getSteelRowsData(),
      otherTiles: getOtherTileRowsData(),
      customerName: customerNameInput.value.trim(),
      tileColor: tileColorInput.value.trim(),
      deliveryAddress: deliveryAddressInput ? deliveryAddressInput.value.trim() : "",
      completionMonth: completionMonthInput ? completionMonthInput.value.trim() : "",
      remark: orderRemarkInput ? orderRemarkInput.value.trim() : "",
      logoDataUrl: reportLogoDataUrl
    };
    if (Number.isFinite(mainTileSegmentLength)) snapshot.mainTileSegmentLength = mainTileSegmentLength;
    var cuttingAdvice = getPrintableCuttingAdvice();
    if (cuttingAdvice) snapshot.cuttingAdvice = cuttingAdvice;
    return snapshot;
  }

  function buildOrderDraft() {
    recalcAll();
    recalcAccessoryTotals();
    recalcSteelTotals();
    recalcOtherTileTotals();
    var snapshot = buildReportSnapshot();
    return {
      orderDate: snapshot.orderDate,
      customerName: snapshot.customerName,
      tileColor: snapshot.tileColor,
      deliveryAddress: snapshot.deliveryAddress,
      completionMonth: snapshot.completionMonth,
      remark: snapshot.remark,
      totals: {
        areaTotal: totals.area,
        mainAmount: totals.main,
        accessoryAmount: totals.accessories,
        steelAmount: totals.steel,
        otherTileAmount: totals.otherTiles,
        grandAmount: totals.grand
      },
      items: Object.assign({
        mainRows: snapshot.mainRows,
        accessories: snapshot.accessories,
        steels: snapshot.steels,
        otherTiles: snapshot.otherTiles
      }, Number.isFinite(snapshot.mainTileSegmentLength) ? {
        mainTileSegmentLength: snapshot.mainTileSegmentLength
      } : {})
    };
  }

  function exportPdfReport() {
    recalcAll();
    recalcAccessoryTotals();
    recalcSteelTotals();
    recalcOtherTileTotals();
    var report = buildPreferredReport(buildReportSnapshot(), currentConfig);
    if (report) {
      openPrintWindow(report.html);
      return;
    }
    window.alert("没有有效主瓦、配件、钢铁材料或其他瓦数据可导出。");
  }

  function addSteelTube() {
    var spec = steelTubeSpecSelect.value;
    var thickness = steelTubeThicknessSelect.value;
    var name = String(currentConfig.steel.tubeMaterialName || "方管") + " " + spec + " 厚 " + thickness;
    steelRowsEl.appendChild(createSteelRow(name, currentConfig.steel.tubeDefaultUnit || "支"));
    recalcSteelTotals();
  }

  function addExpansionBolt() {
    var name = String(currentConfig.steel.boltMaterialName || "螺丝") + " " + steelBoltSpecSelect.value;
    steelRowsEl.appendChild(createSteelRow(name, currentConfig.steel.boltDefaultUnit || "盒"));
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

  setupCuttingAdviceUi();

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

  applyConfig(currentConfig, { initial: true });
  ensureOrderDate();
  appendRows(12);
  setupNumberWheelGuard();
  ensureTrailingBlankRow();
  recalcAccessoryTotals();
  recalcSteelTotals();
  recalcOtherTileTotals();

  return {
    applyConfig: applyConfig,
    createOrderDraft: buildOrderDraft,
    recalc: function () {
      ensureOrderDate();
      recalcAll();
      recalcAccessoryTotals();
      recalcSteelTotals();
      recalcOtherTileTotals();
    }
  };
}
