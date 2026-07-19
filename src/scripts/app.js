import { initAdminPage } from "./components/admin/adminPage.js";
import { buildConfiguredSelectOptions, computeOtherTileTotalLength, hasWorkingDraftContent, initShippingPage } from "./components/shipping/shippingPage.js";
import { confirmAction, initFeedback, showToast } from "./components/common/feedback.js";
import { animateNumberText, enterElement, restartMotionClass, shouldReduceMotion } from "./components/common/motion.js";
import { getOverviewPieColor, getTileColorPieColor } from "./components/dashboard/pieColors.js";
import {
  getCurrentAuthUser,
  getAuthUsernameDefault,
  hasAuthSetup,
  hasCurrentUserRole,
  isApiAuthConfigured,
  isAuthenticated,
  loginWithPassword,
  logout,
  setupPassword
} from "./services/authService.js";
import { loadConfig, loadConfigWithApiFallback, subscribeConfigChange } from "./services/configService.js";
import { geocodeDeliveryAddress, getAmapSettings, hasUsableAmapSettings, loadAmap, resetAmapLoadCache } from "./services/amapService.js";
import {
  deleteOrderMapImageFromApi,
  fetchOrderMapImageBlobFromApi,
  isApiConfigured,
  ORDER_MAP_IMAGE_MAX_BYTES,
  uploadOrderMapImageToApi
} from "./services/apiClient.js";
import {
  buildOrderPieData,
  clearOrdersWithApiFallback,
  deleteOrderWithApiFallback,
  filterHistoryOrders,
  getDateOnly,
  getHistoryMonthOptions,
  getOrderStats,
  getOrderTrend,
  getOrderTrendByMode,
  getOrdersInTrendModeRange,
  getOrdersInTrendRange,
  loadOrders,
  loadOrdersWithApiFallback,
  getOrderSyncState,
  normalizeOrder,
  paginateHistoryOrders,
  retryPendingOrderSync,
  updateOrderWithApiFallback,
  upsertOrderWithApiFallback
} from "./services/orderService.js";
import {
  exportWorkingDraft,
  parseWorkingDraftFile
} from "./services/workingDraftService.js";
import { escapeHtml, formatMoney, formatNum, formatTrimFixed, parseNum } from "./utils.js";

var currentConfig = loadConfig();
var authView = document.getElementById("authView");
var authForm = document.getElementById("authForm");
var authTitle = document.getElementById("authTitle");
var authSubtitle = document.getElementById("authSubtitle");
var authUsernameField = document.getElementById("authUsernameField");
var authUsername = document.getElementById("authUsername");
var authPassword = document.getElementById("authPassword");
var authPasswordToggle = document.getElementById("authPasswordToggle");
var authPasswordToggleIcon = document.getElementById("authPasswordToggleIcon");
var authConfirmField = document.getElementById("authConfirmField");
var authConfirmPassword = document.getElementById("authConfirmPassword");
var authSubmit = document.getElementById("authSubmit");
var authStatus = document.getElementById("authStatus");
var workspaceHeader = document.getElementById("workspaceHeader");
var appViewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-app-view]"));
var businessViews = Array.prototype.slice.call(document.querySelectorAll(".business-view"));
var shippingView = document.getElementById("shippingView");
var adminView = document.getElementById("adminView");
var adminTopToggle = document.getElementById("adminTopToggle");
var logoutButton = document.getElementById("logoutButton");
var syncStatusButton = document.getElementById("syncStatusButton");
var syncStatusText = document.getElementById("syncStatusText");
var syncStatusMeta = document.getElementById("syncStatusMeta");
var currentUserName = document.getElementById("currentUserName");
var backToShipping = document.getElementById("backToShipping");
var saveOrderBtn = document.getElementById("saveOrder");
var workingDraftStatus = document.getElementById("workingDraftStatus");
var exportWorkingDraftButton = document.getElementById("exportWorkingDraft");
var importWorkingDraftButton = document.getElementById("importWorkingDraft");
var clearWorkingDraftButton = document.getElementById("clearWorkingDraft");
var workingDraftFileInput = document.getElementById("workingDraftFileInput");

var dashboardDateTitle = document.getElementById("dashboardDateTitle");
var dashboardMonthInput = document.getElementById("dashboardMonthInput");
var dashboardPrevMonth = document.getElementById("dashboardPrevMonth");
var dashboardCurrentMonth = document.getElementById("dashboardCurrentMonth");
var dashboardNextMonth = document.getElementById("dashboardNextMonth");
var todayOrderCount = document.getElementById("todayOrderCount");
var todayOrderAmount = document.getElementById("todayOrderAmount");
var todayOrderArea = document.getElementById("todayOrderArea");
var totalOrderCount = document.getElementById("totalOrderCount");
var totalOrderAmount = document.getElementById("totalOrderAmount");
var totalOrderArea = document.getElementById("totalOrderArea");
var trendSubtitle = document.getElementById("trendSubtitle");
var trendModeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-trend-mode]"));
var trendYearControl = document.getElementById("trendYearControl");
var trendYearValue = document.getElementById("trendYearValue");
var trendPrevYear = document.getElementById("trendPrevYear");
var trendNextYear = document.getElementById("trendNextYear");
var trendMonthControl = document.getElementById("trendMonthControl");
var trendMonthButtons = Array.prototype.slice.call(document.querySelectorAll("[data-trend-month]"));
var trendOrderList = document.getElementById("trendOrderList");
var trendOrderEmpty = document.getElementById("trendOrderEmpty");
var orderTrendChart = document.getElementById("orderTrendChart");
var trendPointDetail = document.getElementById("trendPointDetail");
var trendEmpty = document.getElementById("trendEmpty");
var orderPieChart = document.getElementById("orderPieChart");
var orderPieLegend = document.getElementById("orderPieLegend");
var orderPieEmpty = document.getElementById("orderPieEmpty");
var trendPieSubtitle = document.getElementById("trendPieSubtitle");
var trendPieTileToggle = document.getElementById("trendPieTileToggle");
var trendTilePieViewControls = document.getElementById("trendTilePieViewControls");
var trendTilePieViewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-trend-tile-pie-view]"));
var dashboardSecondaryButtons = Array.prototype.slice.call(document.querySelectorAll("[data-dashboard-secondary]"));
var dashboardAnalysisPanel = document.getElementById("dashboardAnalysisPanel");
var dashboardMapPanel = document.getElementById("dashboardMapPanel");
var orderLocationMap = document.getElementById("orderLocationMap");
var orderMapSubtitle = document.getElementById("orderMapSubtitle");
var orderMapStatus = document.getElementById("orderMapStatus");
var orderMapEmpty = document.getElementById("orderMapEmpty");
var orderMapEmptyText = document.getElementById("orderMapEmptyText");
var orderMapRetry = document.getElementById("orderMapRetry");
var mapImageLightbox = document.getElementById("mapImageLightbox");
var mapImageLightboxImg = document.getElementById("mapImageLightboxImg");
var mapImageLightboxCaption = document.getElementById("mapImageLightboxCaption");
var mapImageLightboxClose = document.getElementById("mapImageLightboxClose");

var historyMonthFilter = document.getElementById("historyMonthFilter");
var historyTypeFilter = document.getElementById("historyTypeFilter");
var historyDateFilter = document.getElementById("historyDateFilter");
var historyCustomerSearch = document.getElementById("historyCustomerSearch");
var historyAddressSearch = document.getElementById("historyAddressSearch");
var historySortSelect = document.getElementById("historySortSelect");
var resetHistoryFilters = document.getElementById("resetHistoryFilters");
var historyCountText = document.getElementById("historyCountText");
var historyTableBody = document.getElementById("historyTableBody");
var historyEmpty = document.getElementById("historyEmpty");
var historyPagination = document.getElementById("historyPagination");
var historyPrevPage = document.getElementById("historyPrevPage");
var historyNextPage = document.getElementById("historyNextPage");
var historyPageInfo = document.getElementById("historyPageInfo");
var recordDetail = document.getElementById("recordDetail");
var recordDetailTitle = document.getElementById("recordDetailTitle");
var recordDetailSubtitle = document.getElementById("recordDetailSubtitle");
var recordDetailBody = document.getElementById("recordDetailBody");
var closeRecordDetail = document.getElementById("closeRecordDetail");

var activeTrendMode = "month";
var activeTrendYear = new Date().getFullYear();
var activeTrendMonth = new Date().getMonth() + 1;
var activeTrendPieMode = "overview";
var activeTrendTilePieView = "brand";
var activeDashboardSecondary = "analysis";
var activeDashboardMonth = getMonthKey(new Date());
var activeHistoryPage = 1;
var HISTORY_PAGE_SIZE = 30;
var activeTrendPointKey = "";
var trendPointDetailsByKey = {};
var trendYearMobilePicker = null;
var trendMonthMobilePicker = null;
var trendYearPickerScrollTimer = 0;
var trendMonthPickerScrollTimer = 0;
var trendPickerResizeTimer = 0;
var trendPickerSyncing = false;
var trendYearPickerValues = [];
var orderMapState = {
  token: 0,
  AMap: null,
  map: null,
  cluster: null,
  infoWindow: null,
  infoOrderId: "",
  infoToken: 0,
  markers: [],
  lastPoints: [],
  hasCompletedOnce: false
};
var orderMapImageUrlCache = {};
var orderMapImageLoadPromises = {};
var orderMapImageVersions = {};
var recordMapImagePreviewTokens = {};
var orderMapResizeTimer = null;
function getConfig() {
  return currentConfig;
}

initFeedback();

function isAdminUser() {
  return hasCurrentUserRole("ADMIN");
}

var shippingPage = initShippingPage({ getConfig: getConfig });
var adminPage = initAdminPage({
  getConfig: getConfig,
  isAdmin: isAdminUser,
  onClearOrders: requestClearAllOrders
});

function formatSyncTime(value) {
  var date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "尚未同步";
  return String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + " " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}

function renderSyncState(state) {
  var current = state || getOrderSyncState();
  if (!syncStatusButton || !syncStatusText || !syncStatusMeta) return;
  syncStatusButton.dataset.state = current.state;
  if (current.state === "local-only") {
    syncStatusText.textContent = "本机模式";
    syncStatusMeta.textContent = "数据保存在此浏览器";
  } else if (current.state === "local-pending") {
    syncStatusText.textContent = "待同步 " + current.pendingCount + " 条";
    syncStatusMeta.textContent = "点击重新同步";
  } else if (current.state === "connection-error") {
    syncStatusText.textContent = "连接失败";
    syncStatusMeta.textContent = "点击重试";
  } else {
    syncStatusText.textContent = "服务器已同步";
    syncStatusMeta.textContent = formatSyncTime(current.lastSyncedAt);
  }
}

function applyCurrentUserUi() {
  var user = getCurrentAuthUser();
  if (currentUserName) currentUserName.textContent = user && (user.displayName || user.username) ? (user.displayName || user.username) : "当前用户";
  if (adminTopToggle) adminTopToggle.hidden = !isAdminUser();
}

function setDashboardSecondary(view) {
  activeDashboardSecondary = view === "map" ? "map" : "analysis";
  if (dashboardAnalysisPanel) dashboardAnalysisPanel.hidden = activeDashboardSecondary !== "analysis";
  if (dashboardMapPanel) dashboardMapPanel.hidden = activeDashboardSecondary !== "map";
  dashboardSecondaryButtons.forEach(function (button) {
    var active = button.getAttribute("data-dashboard-secondary") === activeDashboardSecondary;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (activeDashboardSecondary === "map") scheduleOrderMapLayout(orderMapState.token, orderMapState.lastPoints);
}

function formatArea(value) {
  return formatNum(Number(value), 4);
}

function getMonthKey(value) {
  var date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function normalizeMonthKey(value) {
  var text = String(value || "").trim();
  var match = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (!match) return getMonthKey(new Date());
  var month = Number(match[2]);
  if (month < 1 || month > 12) return getMonthKey(new Date());
  return match[1] + "-" + String(month).padStart(2, "0");
}

function addMonthsToKey(monthKey, offset) {
  var normalized = normalizeMonthKey(monthKey);
  var parts = normalized.split("-");
  return getMonthKey(new Date(Number(parts[0]), Number(parts[1]) - 1 + Number(offset || 0), 1));
}

function getMonthlyDashboardStats(orders, monthKey) {
  var targetMonth = normalizeMonthKey(monthKey);
  var monthOrders = (Array.isArray(orders) ? orders : []).filter(function (order) {
    return String(order && order.orderDate || "").slice(0, 7) === targetMonth;
  });
  return {
    month: targetMonth,
    count: monthOrders.length,
    amount: monthOrders.reduce(function (total, order) {
      return total + (Number(order && order.totals && order.totals.grandAmount) || 0);
    }, 0),
    area: monthOrders.reduce(function (total, order) {
      return total + (Number(order && order.totals && order.totals.areaTotal) || 0);
    }, 0)
  };
}

function getTrendRangeLabel(range) {
  if (range === "30d") return "最近 30 天";
  if (range === "1y") return "最近一年";
  return "最近 7 天";
}

function getTrendModeLabel(mode) {
  if (mode === "quarter") return "季度";
  if (mode === "year") return "年度";
  return "月度";
}

function getTrendScopeLabel(mode, year) {
  if (mode === "year") return "全部年份";
  return String(year) + " 年" + getTrendModeLabel(mode);
}

function normalizeTrendMonthValue(value, fallback) {
  var number = Number(value);
  if (Number.isFinite(number)) {
    number = Math.trunc(number);
    if (number >= 1 && number <= 12) return number;
  }
  var fallbackNumber = Number(fallback);
  if (Number.isFinite(fallbackNumber)) {
    fallbackNumber = Math.trunc(fallbackNumber);
    if (fallbackNumber >= 1 && fallbackNumber <= 12) return fallbackNumber;
  }
  return new Date().getMonth() + 1;
}

function getTrendYearPickerValues(orders) {
  var currentYear = new Date().getFullYear();
  var yearSet = {};
  var list = Array.isArray(orders) ? orders : [];
  yearSet[currentYear] = true;
  yearSet[activeTrendYear] = true;
  list.forEach(function (order) {
    var year = Number(String(order && order.orderDate || "").slice(0, 4));
    if (!Number.isFinite(year) || year < 1900 || year > 9999) return;
    yearSet[Math.trunc(year)] = true;
  });
  var years = Object.keys(yearSet).map(function (year) {
    return Number(year);
  }).filter(function (year) {
    return Number.isFinite(year);
  }).sort(function (a, b) {
    return a - b;
  });
  var start = years.length ? years[0] - 6 : currentYear - 6;
  var end = years.length ? years[years.length - 1] + 6 : currentYear + 6;
  var values = [];
  var yearValue = start;
  for (; yearValue <= end; yearValue += 1) values.push(yearValue);
  return values;
}

function createTrendPickerItem(value, label, dataName) {
  var item = document.createElement("button");
  item.type = "button";
  item.className = "trend-picker-item";
  item.textContent = label;
  item.setAttribute(dataName, String(value));
  item.setAttribute("aria-selected", "false");
  return item;
}

function ensureTrendMobilePickers() {
  if (trendYearControl && !trendYearMobilePicker) {
    trendYearMobilePicker = document.createElement("div");
    trendYearMobilePicker.className = "trend-mobile-picker trend-year-picker";
    trendYearMobilePicker.setAttribute("role", "listbox");
    trendYearMobilePicker.setAttribute("aria-label", "\u6eda\u52a8\u9009\u62e9\u5e74\u4efd");
    trendYearControl.appendChild(trendYearMobilePicker);
    trendYearMobilePicker.addEventListener("click", function (event) {
      var item = event.target.closest("[data-trend-picker-year]");
      if (!item) return;
      setTrendYearFromPicker(Number(item.getAttribute("data-trend-picker-year")));
    });
    trendYearMobilePicker.addEventListener("scroll", function () {
      scheduleTrendPickerSelection("year");
    }, { passive: true });
  }
  if (trendMonthControl && !trendMonthMobilePicker) {
    trendMonthMobilePicker = document.createElement("div");
    trendMonthMobilePicker.className = "trend-mobile-picker trend-month-picker";
    trendMonthMobilePicker.setAttribute("role", "listbox");
    trendMonthMobilePicker.setAttribute("aria-label", "\u6eda\u52a8\u9009\u62e9\u6708\u4efd");
    trendMonthControl.appendChild(trendMonthMobilePicker);
    trendMonthMobilePicker.addEventListener("click", function (event) {
      var item = event.target.closest("[data-trend-picker-month]");
      if (!item) return;
      setTrendMonthFromPicker(Number(item.getAttribute("data-trend-picker-month")));
    });
    trendMonthMobilePicker.addEventListener("scroll", function () {
      scheduleTrendPickerSelection("month");
    }, { passive: true });
  }
}

function vibrateTrendPicker() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(8);
  } catch (error) {
    // Best effort only.
  }
}

function getCenteredTrendPickerItem(picker, selector) {
  if (!picker) return null;
  var items = Array.prototype.slice.call(picker.querySelectorAll(selector));
  if (!items.length) return null;
  var pickerRect = picker.getBoundingClientRect();
  var center = pickerRect.left + pickerRect.width / 2;
  var closest = items[0];
  var closestDistance = Infinity;
  items.forEach(function (item) {
    var itemRect = item.getBoundingClientRect();
    var itemCenter = itemRect.left + itemRect.width / 2;
    var distance = Math.abs(itemCenter - center);
    if (distance < closestDistance) {
      closest = item;
      closestDistance = distance;
    }
  });
  return closest;
}

function scheduleTrendPickerSelection(type) {
  if (trendPickerSyncing) return;
  var isYear = type === "year";
  var picker = isYear ? trendYearMobilePicker : trendMonthMobilePicker;
  var selector = isYear ? "[data-trend-picker-year]" : "[data-trend-picker-month]";
  var callback = function () {
    if (trendPickerSyncing) return;
    var item = getCenteredTrendPickerItem(picker, selector);
    if (!item) return;
    if (isYear) {
      setTrendYearFromPicker(Number(item.getAttribute("data-trend-picker-year")));
    } else {
      setTrendMonthFromPicker(Number(item.getAttribute("data-trend-picker-month")));
    }
  };
  if (isYear) {
    window.clearTimeout(trendYearPickerScrollTimer);
    trendYearPickerScrollTimer = window.setTimeout(callback, 140);
  } else {
    window.clearTimeout(trendMonthPickerScrollTimer);
    trendMonthPickerScrollTimer = window.setTimeout(callback, 140);
  }
}

function centerTrendPickerItem(picker, item) {
  if (!picker || !item || picker.clientWidth <= 0) return;
  var nextLeft = item.offsetLeft - (picker.clientWidth - item.offsetWidth) / 2;
  picker.scrollLeft = Math.max(0, nextLeft);
}

function syncTrendPickerActiveItem(picker, selector, activeValue, valueAttribute) {
  if (!picker) return;
  var activeItem = null;
  Array.prototype.slice.call(picker.querySelectorAll(selector)).forEach(function (item) {
    var isActive = Number(item.getAttribute(valueAttribute)) === activeValue;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeItem = item;
  });
  trendPickerSyncing = true;
  centerTrendPickerItem(picker, activeItem);
  window.setTimeout(function () {
    trendPickerSyncing = false;
  }, 80);
}

function syncTrendYearMobilePicker() {
  if (!trendYearMobilePicker) return;
  if (!trendYearPickerValues.length) {
    trendYearPickerValues = getTrendYearPickerValues();
  }
  var rangeKey = trendYearPickerValues.join(":");
  if (trendYearMobilePicker.getAttribute("data-range") !== rangeKey) {
    var fragment = document.createDocumentFragment();
    trendYearPickerValues.forEach(function (year) {
      fragment.appendChild(createTrendPickerItem(year, String(year), "data-trend-picker-year"));
    });
    trendYearMobilePicker.replaceChildren(fragment);
    trendYearMobilePicker.setAttribute("data-range", rangeKey);
  }
  syncTrendPickerActiveItem(trendYearMobilePicker, "[data-trend-picker-year]", activeTrendYear, "data-trend-picker-year");
}

function syncTrendMonthMobilePicker() {
  if (!trendMonthMobilePicker) return;
  if (trendMonthMobilePicker.children.length !== 12) {
    var fragment = document.createDocumentFragment();
    var month = 1;
    for (; month <= 12; month += 1) {
      fragment.appendChild(createTrendPickerItem(month, String(month) + "\u6708", "data-trend-picker-month"));
    }
    trendMonthMobilePicker.replaceChildren(fragment);
  }
  syncTrendPickerActiveItem(trendMonthMobilePicker, "[data-trend-picker-month]", activeTrendMonth, "data-trend-picker-month");
}

function syncTrendMobilePickers(orders) {
  ensureTrendMobilePickers();
  if (Array.isArray(orders)) trendYearPickerValues = getTrendYearPickerValues(orders);
  syncTrendYearMobilePicker();
  syncTrendMonthMobilePicker();
}

function setTrendYearFromPicker(year) {
  if (!Number.isFinite(year)) return;
  year = Math.trunc(year);
  if (year === activeTrendYear) {
    syncTrendMobilePickers();
    return;
  }
  activeTrendYear = year;
  hideTrendPointDetail();
  vibrateTrendPicker();
  renderDashboard();
}

function setTrendMonthFromPicker(month) {
  var nextMonth = normalizeTrendMonthValue(month, activeTrendMonth);
  if (nextMonth === activeTrendMonth) {
    syncTrendMobilePickers();
    return;
  }
  activeTrendMonth = nextMonth;
  hideTrendPointDetail();
  vibrateTrendPicker();
  renderDashboard();
}

function getTrendMonthFromKey(key) {
  var match = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!match) return null;
  var month = Number(match[2]);
  return month >= 1 && month <= 12 ? month : null;
}

function getTrendRangeSubtitle(mode, year, month) {
  if (mode === "month") {
    return "查看" + getTrendScopeLabel(mode, year) + "的订单数量和订单金额，当前范围：" + normalizeTrendMonthValue(month) + "月。";
  }
  return "查看" + getTrendScopeLabel(mode, year) + "的订单数量和订单金额。";
}

function getChartPoint(points, index, metric, bounds, maxValue) {
  var safeMax = maxValue > 0 ? maxValue : 1;
  var x = points.length <= 1 ? bounds.left + bounds.width / 2 : bounds.left + (bounds.width * index / (points.length - 1));
  var y = bounds.top + bounds.height - (Number(points[index][metric] || 0) / safeMax * bounds.height);
  return { x: x, y: y };
}

function polyline(points) {
  return points.map(function (point) {
    return point.x.toFixed(2) + "," + point.y.toFixed(2);
  }).join(" ");
}

function shouldShowTick(index, length, bucketType) {
  if (bucketType === "month" || bucketType === "quarter" || bucketType === "year") return true;
  if (length <= 7) return true;
  return index % 5 === 0 || index === length - 1;
}

function getTrendBucketKey(order, bucketType) {
  var orderDate = String(order && order.orderDate || "").trim();
  if (bucketType === "year") return orderDate.slice(0, 4);
  if (bucketType === "quarter") {
    var month = Number(orderDate.slice(5, 7));
    if (!Number.isFinite(month) || month < 1 || month > 12) return "";
    return orderDate.slice(0, 4) + "-Q" + Math.ceil(month / 3);
  }
  return bucketType === "month" ? orderDate.slice(0, 7) : orderDate;
}

function getTrendOrdersByKey(orders, trend) {
  var grouped = {};
  trend.points.forEach(function (point) {
    grouped[point.key] = [];
  });
  sortOrdersByOrderDate(orders).forEach(function (order) {
    var key = getTrendBucketKey(order, trend.bucketType);
    if (!grouped[key]) return;
    grouped[key].push(order);
  });
  return grouped;
}

function renderTrendOrderList(orders) {
  if (!trendOrderList) return;
  var sorted = sortOrdersByOrderDate(orders);
  setEmptyNote(trendOrderEmpty, !sorted.length);
  trendOrderList.innerHTML = sorted.map(function (order) {
    return "<article class='trend-order-item'>" +
      "<strong>" + escapeHtml(getOrderCustomer(order)) + "</strong>" +
      "<span>面积：" + escapeHtml(getOrderAreaDisplay(order)) + "</span>" +
      "<span>颜色：" + escapeHtml(getOrderColorDisplay(order)) + "</span>" +
      "</article>";
  }).join("");
}

function getTrendPointAria(point, orders) {
  return point.key + "，订单数量 " + point.count + "，订单金额 " + formatMoney(point.amount) + "，相关订单 " + orders.length + " 条";
}

function setActiveTrendChartPoint(key) {
  if (!orderTrendChart) return;
  Array.prototype.slice.call(orderTrendChart.querySelectorAll("[data-trend-key]")).forEach(function (item) {
    item.classList.toggle("is-active", item.getAttribute("data-trend-key") === key);
  });
}

function hideTrendPointDetail() {
  activeTrendPointKey = "";
  setActiveTrendChartPoint("");
  if (trendPointDetail) {
    trendPointDetail.hidden = true;
    trendPointDetail.innerHTML = "";
  }
}

function renderTrendPointDetail(key) {
  if (!trendPointDetail) return;
  var detail = key ? trendPointDetailsByKey[key] : null;
  if (!detail) {
    hideTrendPointDetail();
    return;
  }
  var orders = detail.orders || [];
  var listHtml = orders.length ? orders.map(function (order) {
    return "<article class='trend-detail-order'>" +
      "<time>" + escapeHtml(order.orderDate || "未填写日期") + "</time>" +
      "<strong>" + escapeHtml(getOrderCustomer(order)) + "</strong>" +
      "<span>¥" + escapeHtml(formatMoney(Number(order && order.totals && order.totals.grandAmount) || 0)) + "</span>" +
      "</article>";
  }).join("") : "<p class='trend-detail-empty'>该日期暂无订单。</p>";
  trendPointDetail.innerHTML =
    "<div class='trend-detail-head'>" +
    "<span>" + escapeHtml(detail.point.key) + "</span>" +
    "<button type='button' class='icon-btn trend-detail-close' data-trend-detail-close aria-label='关闭趋势详情'><svg class='ui-icon' aria-hidden='true'><use href='#icon-clear'></use></svg></button>" +
    "</div>" +
    "<div class='trend-detail-list'>" + listHtml + "</div>";
  trendPointDetail.hidden = false;
  setActiveTrendChartPoint(key);
}

function renderTrendChart(trend, ordersByKey) {
  var bounds = { left: 46, right: 34, top: 18, bottom: 38 };
  bounds.width = 920 - bounds.left - bounds.right;
  bounds.height = 220 - bounds.top - bounds.bottom;
  var countPoints = trend.points.map(function (point, index, points) {
    return getChartPoint(points, index, "count", bounds, trend.maxCount);
  });
  var amountPoints = trend.points.map(function (point, index, points) {
    return getChartPoint(points, index, "amount", bounds, trend.maxAmount);
  });
  var grid = [0, 1, 2, 3, 4].map(function (step) {
    var y = bounds.top + (bounds.height * step / 4);
    return "<line class='chart-grid' x1='" + bounds.left + "' y1='" + y.toFixed(2) + "' x2='" + (bounds.left + bounds.width) + "' y2='" + y.toFixed(2) + "'></line>";
  }).join("");
  var labels = trend.points.map(function (point, index) {
    if (!shouldShowTick(index, trend.points.length, trend.bucketType)) return "";
    var chartPoint = getChartPoint(trend.points, index, "count", bounds, trend.maxCount);
    return "<text class='chart-label' x='" + chartPoint.x.toFixed(2) + "' y='208' text-anchor='middle'>" + escapeHtml(point.label) + "</text>";
  }).join("");
  var dots = trend.points.map(function (point, index) {
    var countPoint = countPoints[index];
    var amountPoint = amountPoints[index];
    var pointOrders = ordersByKey[point.key] || [];
    var activeClass = point.key === activeTrendPointKey ? " is-active" : "";
    var escapedKey = escapeHtml(point.key);
    return "<g class='chart-point-group" + activeClass + "' tabindex='0' role='button' data-trend-key='" + escapedKey + "' aria-label='" + escapeHtml(getTrendPointAria(point, pointOrders)) + "'>" +
      "<circle class='chart-hit-area' cx='" + countPoint.x.toFixed(2) + "' cy='" + countPoint.y.toFixed(2) + "' r='12'></circle>" +
      "<circle class='chart-hit-area' cx='" + amountPoint.x.toFixed(2) + "' cy='" + amountPoint.y.toFixed(2) + "' r='12'></circle>" +
      "<circle class='chart-dot count' cx='" + countPoint.x.toFixed(2) + "' cy='" + countPoint.y.toFixed(2) + "' r='4'><title>" + escapeHtml(point.label) + " 订单数量：" + point.count + "</title></circle>" +
      "<circle class='chart-dot amount' cx='" + amountPoint.x.toFixed(2) + "' cy='" + amountPoint.y.toFixed(2) + "' r='4'><title>" + escapeHtml(point.label) + " 订单金额：" + formatMoney(point.amount) + "</title></circle>" +
      "</g>";
  }).join("");
  orderTrendChart.innerHTML =
    grid +
    "<line class='chart-axis' x1='" + bounds.left + "' y1='" + (bounds.top + bounds.height) + "' x2='" + (bounds.left + bounds.width) + "' y2='" + (bounds.top + bounds.height) + "'></line>" +
    "<polyline class='chart-line amount' pathLength='1' points='" + polyline(amountPoints) + "'></polyline>" +
    "<polyline class='chart-line count' pathLength='1' points='" + polyline(countPoints) + "'></polyline>" +
    dots +
    labels;
}

var PIE_FALLBACK_COLORS = ["#191714", "#c5a45d", "#e3d2a6", "#8c6a2f", "#716d64"];
var TILE_BRAND_PIE_COLORS = {
  "\u7ea2\u6ce2": "#c5a45d",
  "\u661f\u5927": "#191714",
  "\u672a\u533a\u5206": "#9a927f"
};

function normalizePieColorLabel(label) {
  return String(label || "").trim();
}

function getPieSliceColor(slice, index) {
  if (activeTrendPieMode === "tile") {
    if (activeTrendTilePieView === "color") {
      return getTileColorPieColor(slice && slice.key);
    }
    return TILE_BRAND_PIE_COLORS[normalizePieColorLabel(slice && slice.label)] || PIE_FALLBACK_COLORS[index % PIE_FALLBACK_COLORS.length];
  }
  return getOverviewPieColor(slice && slice.key, index);
}

function renderPieSvg(data) {
  var radius = 54;
  var circumference = 2 * Math.PI * radius;
  var offset = 0;
  var slices = data.slices.map(function (slice, index) {
    var length = data.total > 0 ? slice.value / data.total * circumference : 0;
    var dashOffset = -offset;
    offset += length;
    return "<circle class='pie-slice' cx='80' cy='80' r='" + radius + "' fill='none' stroke='" + getPieSliceColor(slice, index) + "' stroke-width='26' stroke-dasharray='" + length.toFixed(2) + " " + circumference.toFixed(2) + "' stroke-dashoffset='" + dashOffset.toFixed(2) + "' transform='rotate(-90 80 80)'><title>" + escapeHtml(slice.label) + "：" + formatMoney(slice.value) + " 元</title></circle>";
  }).join("");
  return "<circle class='pie-track' cx='80' cy='80' r='" + radius + "' fill='none'></circle>" +
    slices +
    "<circle class='pie-hole' cx='80' cy='80' r='36'></circle>" +
    "<text class='pie-total-label' x='80' y='75' text-anchor='middle'>合计</text>" +
    "<text class='pie-total-value' x='80' y='94' text-anchor='middle'>" + escapeHtml(formatMoney(data.total)) + "</text>";
}

function renderPieLegend(data) {
  return data.slices.map(function (slice, index) {
    var percent = data.total > 0 ? slice.value / data.total * 100 : 0;
    return "<div class='trend-pie-legend-item'>" +
      "<i style='background:" + getPieSliceColor(slice, index) + "'></i>" +
      "<span>" + escapeHtml(slice.label) + "</span>" +
      "<strong>" + escapeHtml(formatMoney(slice.value)) + " 元</strong>" +
      "<em>" + escapeHtml(percent.toFixed(1)) + "%</em>" +
      "</div>";
  }).join("");
}

function getTilePieSubtitle(view) {
  if (view === "color") return "按订单瓦片颜色统计金额占比";
  return "按主瓦节长区分红波、星大与未区分";
}

function renderTrendPie(orders) {
  if (!orderPieChart || !orderPieLegend) return;
  var data = buildOrderPieData(orders, activeTrendPieMode, { tileView: activeTrendTilePieView });
  var hasData = data.total > 0 && data.slices.length > 0;
  if (trendPieTileToggle) {
    var tileOnly = activeTrendPieMode === "tile";
    trendPieTileToggle.classList.toggle("active", tileOnly);
    trendPieTileToggle.setAttribute("aria-pressed", tileOnly ? "true" : "false");
    trendPieTileToggle.setAttribute("title", tileOnly ? "显示瓦片、配件、钢铁材料总览" : "只显示瓦片数据");
  }
  if (trendTilePieViewControls) trendTilePieViewControls.hidden = activeTrendPieMode !== "tile";
  trendTilePieViewButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-trend-tile-pie-view") === activeTrendTilePieView);
  });
  if (trendPieSubtitle) {
    trendPieSubtitle.textContent = activeTrendPieMode === "tile" ?
      getTilePieSubtitle(activeTrendTilePieView) :
      "瓦片、配件、钢铁材料金额占比";
  }
  setEmptyNote(orderPieEmpty, !hasData);
  orderPieChart.classList.toggle("is-muted", !hasData);
  if (!hasData) {
    orderPieChart.innerHTML = "";
    orderPieLegend.innerHTML = "";
    return;
  }
  orderPieChart.setAttribute("aria-label", "订单分类金额饼图，合计 " + formatMoney(data.total) + " 元");
  orderPieChart.innerHTML = renderPieSvg(data);
  orderPieLegend.innerHTML = renderPieLegend(data);
}

function renderTrend(orders) {
  activeTrendMonth = normalizeTrendMonthValue(activeTrendMonth);
  var trendOptions = { mode: activeTrendMode, year: activeTrendYear };
  var rangeOptions = activeTrendMode === "month" ?
    { mode: activeTrendMode, year: activeTrendYear, month: activeTrendMonth } :
    trendOptions;
  var trend = getOrderTrendByMode(orders, trendOptions);
  var chartOrders = getOrdersInTrendModeRange(orders, trendOptions);
  var trendOrders = getOrdersInTrendModeRange(orders, rangeOptions);
  var ordersByKey = getTrendOrdersByKey(chartOrders, trend);
  var hasData = trend.totalCount > 0 || trend.totalAmount > 0;
  if (trendSubtitle) {
    trendSubtitle.textContent = getTrendRangeSubtitle(activeTrendMode, activeTrendYear, activeTrendMonth);
  }
  trendModeButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-trend-mode") === activeTrendMode);
  });
  if (trendYearValue) trendYearValue.textContent = String(activeTrendYear);
  if (trendYearControl) trendYearControl.classList.toggle("is-disabled", activeTrendMode === "year");
  [trendPrevYear, trendNextYear].forEach(function (button) {
    if (!button) return;
    button.disabled = activeTrendMode === "year";
  });
  if (trendMonthControl) trendMonthControl.hidden = activeTrendMode !== "month";
  trendMonthButtons.forEach(function (button) {
    var month = normalizeTrendMonthValue(button.getAttribute("data-trend-month"));
    var active = activeTrendMode === "month" && month === activeTrendMonth;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  syncTrendMobilePickers(orders);
  trendPointDetailsByKey = {};
  trend.points.forEach(function (point) {
    trendPointDetailsByKey[point.key] = {
      point: point,
      orders: ordersByKey[point.key] || []
    };
  });
  if (activeTrendPointKey && !trendPointDetailsByKey[activeTrendPointKey]) activeTrendPointKey = "";
  renderTrendOrderList(trendOrders);
  renderTrendChart(trend, ordersByKey);
  renderTrendPie(trendOrders);
  renderTrendPointDetail(activeTrendPointKey);
  setEmptyNote(trendEmpty, !hasData);
  orderTrendChart.classList.toggle("is-muted", !hasData);
  if (hasData) {
    restartMotionClass(orderTrendChart, "motion-chart", 380);
    restartMotionClass(orderPieChart, "motion-chart", 380);
  }
}

function activateTrendChartPoint(key) {
  activeTrendPointKey = key || "";
  if (activeTrendMode === "month") {
    var month = getTrendMonthFromKey(activeTrendPointKey);
    if (month) {
      activeTrendMonth = month;
      renderTrend(loadOrders());
      return;
    }
  }
  renderTrendPointDetail(activeTrendPointKey);
}

function getOrderTitle(order) {
  return order.orderNo || "未编号订单";
}

function getOrderCustomer(order) {
  return order.customerName || "未填写客户";
}

function getOrderAreaDisplay(order) {
  var area = Number(order && order.totals && order.totals.areaTotal);
  if (!Number.isFinite(area) || area <= 0) return "面积未填写";
  return formatArea(area) + " ㎡";
}

function collectColorValues(value, result) {
  if (Array.isArray(value)) {
    value.forEach(function (item) {
      collectColorValues(item, result);
    });
    return;
  }
  String(value || "").split(/[、,，;；/|]+/).forEach(function (item) {
    var text = item.trim();
    if (text) result.push(text);
  });
}

function getOrderColorDisplay(order) {
  var values = [];
  var seen = {};
  var colors = [];
  collectColorValues(order && order.tileColor, values);
  values.forEach(function (color) {
    var key = color.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    colors.push(color);
  });
  if (!colors.length) return "颜色未填写";
  return colors.join("、");
}

function getOrderMapImageOrderId(orderId) {
  return String(orderId || "").trim();
}

function isMissingOrderMapImageError(error) {
  return Boolean(error && error.status === 404 && (!error.code || error.code === "ORDER_IMAGE_NOT_FOUND"));
}

function getOrderMapImageErrorMessage(error) {
  if (error && error.code === "IMAGE_TOO_LARGE") return "图片必须小于 500KB。";
  if (error && error.code === "INVALID_IMAGE_TYPE") return "只支持 JPG、PNG 或 WebP 图片。";
  return error && error.message ? error.message : "地图展示图片操作失败。";
}

function revokeOrderMapImageUrl(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  var url = id ? orderMapImageUrlCache[id] : "";
  if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
  if (id) delete orderMapImageUrlCache[id];
}

function rememberOrderMapImageUrl(orderId, blob) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !blob || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return "";
  revokeOrderMapImageUrl(id);
  orderMapImageUrlCache[id] = URL.createObjectURL(blob);
  return orderMapImageUrlCache[id];
}

function getCachedOrderMapImageUrl(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  return id ? orderMapImageUrlCache[id] || "" : "";
}

function bumpOrderMapImageVersion(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id) return 0;
  orderMapImageVersions[id] = (orderMapImageVersions[id] || 0) + 1;
  delete orderMapImageLoadPromises[id];
  return orderMapImageVersions[id];
}

function loadOrderMapImageUrl(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !isApiConfigured()) return Promise.resolve("");
  if (orderMapImageUrlCache[id]) return Promise.resolve(orderMapImageUrlCache[id]);
  if (orderMapImageLoadPromises[id]) return orderMapImageLoadPromises[id];
  var version = orderMapImageVersions[id] || 0;
  orderMapImageLoadPromises[id] = fetchOrderMapImageBlobFromApi(id).then(function (blob) {
    if ((orderMapImageVersions[id] || 0) !== version) return getCachedOrderMapImageUrl(id);
    if (!blob || !blob.size) return "";
    return rememberOrderMapImageUrl(id, blob);
  }).catch(function (error) {
    if (isMissingOrderMapImageError(error)) return "";
    throw error;
  }).finally(function () {
    delete orderMapImageLoadPromises[id];
  });
  return orderMapImageLoadPromises[id];
}

function isAllowedOrderMapImageFile(file) {
  var type = String(file && file.type || "").toLowerCase();
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

function getOrderMapImageExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function getOrderMapImageUploadName(originalName, mimeType) {
  var baseName = String(originalName || "map-image").replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").trim();
  return (baseName || "map-image") + "." + getOrderMapImageExtension(mimeType);
}

function loadImageFromFile(file) {
  return new Promise(function (resolve, reject) {
    if (typeof Image !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      reject(new Error("当前浏览器不支持图片预处理。"));
      return;
    }
    var url = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () {
      URL.revokeObjectURL(url);
      resolve({
        image: image,
        width: image.naturalWidth || image.width || 0,
        height: image.naturalHeight || image.height || 0
      });
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，请换一张图片。"));
    };
    image.src = url;
  });
}

function getFittedImageSize(width, height, maxDimension) {
  var safeWidth = Math.max(1, Number(width) || 1);
  var safeHeight = Math.max(1, Number(height) || 1);
  var scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale))
  };
}

function drawImageToCanvas(image, size) {
  var canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  var context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, size.width, size.height);
  return canvas;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob);
      else reject(new Error("图片压缩失败，请换一张图片。"));
    }, mimeType, quality);
  });
}

async function compressOrderMapImage(file) {
  if (!file) throw new Error("请选择一张图片。");
  if (!isAllowedOrderMapImageFile(file)) throw new Error("只支持 JPG、PNG 或 WebP 图片。");

  var loaded = await loadImageFromFile(file);
  var sourceWidth = loaded.width;
  var sourceHeight = loaded.height;
  var sourceType = String(file.type || "").toLowerCase();
  if (file.size <= ORDER_MAP_IMAGE_MAX_BYTES) {
    return {
      blob: file,
      fileName: getOrderMapImageUploadName(file.name, sourceType),
      width: sourceWidth,
      height: sourceHeight
    };
  }

  var maxDimension = Math.min(Math.max(sourceWidth, sourceHeight), 1600);
  var qualities = [0.86, 0.76, 0.66, 0.56, 0.48];
  var bestBlob = null;
  var bestSize = null;
  while (maxDimension >= 480) {
    var size = getFittedImageSize(sourceWidth, sourceHeight, maxDimension);
    var canvas = drawImageToCanvas(loaded.image, size);
    for (var index = 0; index < qualities.length; index += 1) {
      var blob = await canvasToBlob(canvas, "image/jpeg", qualities[index]);
      bestBlob = blob;
      bestSize = size;
      if (blob.size <= ORDER_MAP_IMAGE_MAX_BYTES) {
        return {
          blob: blob,
          fileName: getOrderMapImageUploadName(file.name, "image/jpeg"),
          width: size.width,
          height: size.height
        };
      }
    }
    maxDimension = Math.floor(maxDimension * 0.82);
  }

  if (bestBlob && bestBlob.size <= ORDER_MAP_IMAGE_MAX_BYTES) {
    return {
      blob: bestBlob,
      fileName: getOrderMapImageUploadName(file.name, "image/jpeg"),
      width: bestSize.width,
      height: bestSize.height
    };
  }
  throw new Error("图片压缩后仍超过 500KB，请换一张更小的图片。");
}

function setEmptyNote(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("is-visible", Boolean(visible));
}

function setOrderMapStatus(text, mode) {
  if (!orderMapStatus) return;
  orderMapStatus.textContent = text || "";
  orderMapStatus.className = "map-status-pill" + (mode ? " is-" + mode : "");
}

function setOrderMapEmpty(message, visible) {
  if (!orderMapEmpty) return;
  var messageTarget = orderMapEmptyText || orderMapEmpty;
  messageTarget.textContent = message || "";
  orderMapEmpty.hidden = !visible;
  orderMapEmpty.classList.toggle("is-visible", Boolean(visible));
  if (orderMapRetry) orderMapRetry.hidden = true;
}

function setOrderMapEmptyWithRetry(message, visible, retryVisible) {
  setOrderMapEmpty(message, visible);
  if (orderMapRetry) orderMapRetry.hidden = !retryVisible;
}

function getOrderLocation(order) {
  var location = order && order.deliveryLocation;
  var lng = Number(location && location.lng);
  var lat = Number(location && location.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng: lng, lat: lat };
}

function getOrderAddress(order) {
  return order && order.deliveryAddress ? order.deliveryAddress : "";
}

function getOrderLocationText(order) {
  var location = order && order.deliveryLocation ? order.deliveryLocation : null;
  return String(
    (order && order.deliveryAddress) ||
    (order && order.address) ||
    (location && location.formattedAddress) ||
    (location && location.address) ||
    ""
  ).trim() || "未填写位置";
}

function formatCompletionMonth(value) {
  var text = String(value || "").trim();
  var match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return "未填写";
  return match[1] + "年" + Number(match[2]) + "月建成";
}

function renderConfiguredOrderOptions(items, selectedValue) {
  var model = buildConfiguredSelectOptions(items, selectedValue);
  return model.options.map(function (item) {
    var selectedAttr = item.value === model.selectedValue ? " selected" : "";
    var disabledAttr = item.legacy ? " disabled" : "";
    return "<option value='" + escapeHtml(item.value) + "'" + selectedAttr + disabledAttr + ">" + escapeHtml(item.label) + "</option>";
  }).join("");
}

function renderDeliveryMethodOptions(selectedValue) {
  return renderConfiguredOrderOptions(currentConfig.basics.deliveryMethods, selectedValue);
}

function renderGalvanizingProcessOptions(selectedValue) {
  var selected = String(selectedValue || "").trim().replace(/^镀锌工艺\s*[：:]\s*/, "");
  return renderConfiguredOrderOptions(currentConfig.basics.galvanizingProcesses, selected);
}

function getOrderDateTime(order) {
  var time = Date.parse(order && order.orderDate || "");
  return Number.isFinite(time) ? time : 0;
}

function sortOrdersByOrderDate(orders) {
  return (Array.isArray(orders) ? orders : []).slice().sort(function (a, b) {
    var dateDiff = getOrderDateTime(b) - getOrderDateTime(a);
    if (dateDiff) return dateDiff;
    return String(getOrderTitle(a)).localeCompare(String(getOrderTitle(b)), "zh-CN");
  });
}

function clearOrderMapLayers() {
  if (orderMapState.cluster) {
    try {
      if (typeof orderMapState.cluster.setMap === "function") orderMapState.cluster.setMap(null);
      if (typeof orderMapState.cluster.clearMarkers === "function") orderMapState.cluster.clearMarkers();
    } catch (error) {
      console.warn("订单地图聚合层清理失败。", error);
    }
    orderMapState.cluster = null;
  }
  if (orderMapState.map && orderMapState.markers.length) {
    try {
      orderMapState.map.remove(orderMapState.markers);
    } catch (error) {
      console.warn("订单地图标记清理失败。", error);
    }
    orderMapState.markers = [];
  }
}

function closeOrderMapInfoWindow() {
  if (!orderMapState.infoWindow) return;
  try {
    if (typeof orderMapState.infoWindow.close === "function") orderMapState.infoWindow.close();
  } catch (error) {
    console.warn("订单地图弹窗关闭失败。", error);
  }
}

function destroyOrderMapInstance() {
  closeOrderMapInfoWindow();
  clearOrderMapLayers();
  if (orderMapState.map) {
    try {
      if (typeof orderMapState.map.destroy === "function") orderMapState.map.destroy();
    } catch (error) {
      console.warn("订单地图实例销毁失败。", error);
    }
  }
  orderMapState.map = null;
  orderMapState.cluster = null;
  orderMapState.infoWindow = null;
  orderMapState.infoOrderId = "";
  orderMapState.markers = [];
  orderMapState.hasCompletedOnce = false;
}

function resizeOrderMap() {
  if (!orderMapState.map || typeof orderMapState.map.resize !== "function") return;
  try {
    orderMapState.map.resize();
  } catch (error) {
    console.warn("订单地图尺寸刷新失败。", error);
  }
}

function fitOrderMapPoints(points) {
  if (!orderMapState.map || !Array.isArray(points) || !points.length) return;
  try {
    if (points.length === 1) {
      orderMapState.map.setZoomAndCenter(11, points[0].lnglat);
    } else if (typeof orderMapState.map.setFitView === "function") {
      orderMapState.map.setFitView();
    }
  } catch (error) {
    console.warn("订单地图视野适配失败。", error);
  }
}

function scheduleOrderMapLayout(token, points) {
  [0, 80, 280].forEach(function (delay) {
    setTimeout(function () {
      if (token !== orderMapState.token) return;
      resizeOrderMap();
      fitOrderMapPoints(points);
    }, delay);
  });
}

function markOrderMapReady(token, points) {
  if (token !== orderMapState.token) return;
  orderMapState.hasCompletedOnce = true;
  setOrderMapStatus("已显示", "ready");
  setOrderMapEmptyWithRetry("", false, false);
  scheduleOrderMapLayout(token, points);
}

function watchOrderMapTiles(token, points) {
  var map = orderMapState.map;
  if (!map) return;
  if (orderMapState.hasCompletedOnce) {
    setTimeout(function () {
      markOrderMapReady(token, points);
    }, 80);
    return;
  }

  var completed = false;
  function handleReady() {
    if (completed) return;
    completed = true;
    markOrderMapReady(token, points);
  }

  try {
    if (typeof map.on === "function") {
      map.on("complete", handleReady);
      map.on("tilesloaded", handleReady);
    }
  } catch (error) {
    console.warn("订单地图加载事件监听失败。", error);
  }

  setTimeout(function () {
    if (token !== orderMapState.token || completed) return;
    resizeOrderMap();
    fitOrderMapPoints(points);
    setOrderMapStatus("底图较慢", "warning");
    setOrderMapEmptyWithRetry("地图底图加载较慢，请检查高德 Key 或网络。", true, true);
  }, 4200);
}

function ensureOrderMap(AMap, settings) {
  if (!orderLocationMap) return null;
  if (!orderMapState.map) {
    orderMapState.map = new AMap.Map(orderLocationMap, {
      zoom: 10,
      center: [118.67587, 24.874132],
      viewMode: "2D",
      mapStyle: settings.mapStyle
    });
  } else if (typeof orderMapState.map.setMapStyle === "function") {
    orderMapState.map.setMapStyle(settings.mapStyle);
  }
  if (typeof orderMapState.map.setCity === "function") {
    orderMapState.map.setCity(settings.geocodeCity || "泉州市");
  }
  return orderMapState.map;
}

function getOrderMapLocationStatus(order) {
  return getOrderLocation(order) ? "已定位" : "待定位";
}

function getOrderMapInfoImageHtml(imageUrl, imageState, title) {
  if (imageUrl) {
    return "<button type='button' class='order-map-info-image is-clickable' data-map-lightbox-src='" + escapeHtml(imageUrl) + "' data-map-lightbox-caption='" + escapeHtml(title || "地图展示图片") + "'>" +
      "<img src='" + escapeHtml(imageUrl) + "' alt='地图展示图片' />" +
      "</button>";
  }
  var text = imageState === "loading" ? "图片读取中..." : "暂无地图展示图片";
  return "<div class='order-map-info-image is-empty'><span>" + escapeHtml(text) + "</span></div>";
}

function getOrderInfoHtml(order, imageOptions) {
  var image = imageOptions || {};
  return "<div class='order-map-info'>" +
    "<strong>" + escapeHtml(getOrderCustomer(order)) + "</strong>" +
    "<dl>" +
    "<div><dt>面积</dt><dd>" + escapeHtml(getOrderAreaDisplay(order)) + "</dd></div>" +
    "<div><dt>颜色</dt><dd>" + escapeHtml(getOrderColorDisplay(order)) + "</dd></div>" +
    "<div><dt>建成</dt><dd>" + escapeHtml(formatCompletionMonth(order.completionMonth)) + "</dd></div>" +
    "<div><dt>状态</dt><dd>" + escapeHtml(getOrderMapLocationStatus(order)) + "</dd></div>" +
    "</dl>" +
    "<p class='address'>" + escapeHtml(getOrderAddress(order) || "未填写收货地址") + "</p>" +
    getOrderMapInfoImageHtml(image.url, image.state, getOrderCustomer(order)) +
    "</div>";
}

function openMapImageLightbox(src, caption) {
  if (!mapImageLightbox || !mapImageLightboxImg) return;
  mapImageLightboxImg.src = src;
  mapImageLightboxImg.alt = caption || "地图展示图片预览";
  if (mapImageLightboxCaption) mapImageLightboxCaption.textContent = caption || "地图展示图片";
  mapImageLightbox.hidden = false;
  document.body.classList.add("image-lightbox-open");
}

function closeMapImageLightbox() {
  if (!mapImageLightbox) return;
  mapImageLightbox.hidden = true;
  document.body.classList.remove("image-lightbox-open");
  if (mapImageLightboxImg) {
    mapImageLightboxImg.removeAttribute("src");
  }
  if (mapImageLightboxCaption) mapImageLightboxCaption.textContent = "";
}

function refreshOpenOrderInfoForOrder(orderId, imageState) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || orderMapState.infoOrderId !== id || !orderMapState.infoWindow) return;
  var order = findOrder(id);
  if (!order) return;
  orderMapState.infoWindow.setContent(getOrderInfoHtml(order, {
    url: getCachedOrderMapImageUrl(id),
    state: imageState || (getCachedOrderMapImageUrl(id) ? "ready" : "none")
  }));
}

function openOrderInfo(order, lnglat) {
  if (!orderMapState.AMap || !orderMapState.map) return;
  if (!orderMapState.infoWindow) {
    orderMapState.infoWindow = new orderMapState.AMap.InfoWindow({
      autoMove: true,
      avoid: [24, 24, 24, 24],
      closeWhenClickMap: true,
      offset: new orderMapState.AMap.Pixel(0, -30)
    });
  }
  var orderId = getOrderMapImageOrderId(order && order.id);
  var cachedImageUrl = getCachedOrderMapImageUrl(orderId);
  var infoToken = orderMapState.infoToken + 1;
  orderMapState.infoToken = infoToken;
  orderMapState.infoOrderId = orderId;
  orderMapState.infoWindow.setContent(getOrderInfoHtml(order, {
    url: cachedImageUrl,
    state: cachedImageUrl ? "ready" : (isApiConfigured() ? "loading" : "none")
  }));
  orderMapState.infoWindow.open(orderMapState.map, lnglat);
  setTimeout(resizeOrderMap, 0);
  if (!orderId || cachedImageUrl || !isApiConfigured()) return;
  loadOrderMapImageUrl(orderId).then(function (url) {
    if (orderMapState.infoToken !== infoToken || orderMapState.infoOrderId !== orderId) return;
    orderMapState.infoWindow.setContent(getOrderInfoHtml(order, {
      url: url,
      state: url ? "ready" : "none"
    }));
  }).catch(function () {
    if (orderMapState.infoToken !== infoToken || orderMapState.infoOrderId !== orderId) return;
    orderMapState.infoWindow.setContent(getOrderInfoHtml(order, {
      url: "",
      state: "error"
    }));
  });
}

function createManualOrderMarkers(AMap, points) {
  orderMapState.markers = points.map(function (point) {
    var marker = new AMap.Marker({
      position: point.lnglat,
      content: "<button type='button' class='order-map-marker' aria-label='订单位置'>1</button>",
      offset: new AMap.Pixel(-13, -13)
    });
    marker.on("click", function () {
      openOrderInfo(point.order, point.lnglat);
    });
    return marker;
  });
  orderMapState.map.add(orderMapState.markers);
}

function renderOrderMapPoints(AMap, points) {
  clearOrderMapLayers();
  if (typeof AMap.MarkerCluster === "function") {
    orderMapState.cluster = new AMap.MarkerCluster(orderMapState.map, points, {
      gridSize: 72,
      renderClusterMarker: function (context) {
        context.marker.setContent("<button type='button' class='order-map-cluster' aria-label='订单聚合'>" + context.count + "</button>");
      },
      renderMarker: function (context) {
        var data = Array.isArray(context.data) ? context.data[0] : context.data;
        var order = data && data.order;
        context.marker.setContent("<button type='button' class='order-map-marker' aria-label='订单位置'>1</button>");
        if (order) {
          context.marker.on("click", function () {
            openOrderInfo(order, data.lnglat);
          });
        }
      }
    });
  } else {
    createManualOrderMarkers(AMap, points);
  }

  resizeOrderMap();
  fitOrderMapPoints(points);
}

function renderOrderMap(orders) {
  if (!orderLocationMap) return;
  var token = orderMapState.token + 1;
  orderMapState.token = token;
  var settings = getAmapSettings(currentConfig);
  var mapOrders = sortOrdersByOrderDate(orders);
  var points = mapOrders.map(function (order) {
    var location = getOrderLocation(order);
    if (!location) return null;
    return {
      lnglat: [location.lng, location.lat],
      weight: Math.max(1, Math.round(Number(order.totals && order.totals.grandAmount) || 1)),
      order: order,
      orderId: order.id
    };
  }).filter(Boolean);
  orderMapState.lastPoints = points;
  var pendingCount = mapOrders.length - points.length;

  if (orderMapSubtitle) {
    orderMapSubtitle.textContent = "查看全部已定位订单：" + points.length + " 个已定位，" + pendingCount + " 个待定位。";
  }

  if (!settings.enabled) {
    clearOrderMapLayers();
    setOrderMapStatus("未启用", "idle");
    setOrderMapEmptyWithRetry("请在系统管理中启用首页订单地图。", true, false);
    return;
  }
  if (!settings.amapKey || !settings.securityJsCode) {
    clearOrderMapLayers();
    setOrderMapStatus("待配置", "warning");
    setOrderMapEmptyWithRetry("请在系统管理中填写高德 JS API Key 和 securityJsCode。", true, false);
    return;
  }
  if (!mapOrders.length) {
    clearOrderMapLayers();
    setOrderMapStatus("无订单", "idle");
    setOrderMapEmptyWithRetry("暂无订单可显示。", true, false);
    return;
  }
  if (!points.length) {
    clearOrderMapLayers();
    setOrderMapStatus("待定位", "warning");
    setOrderMapEmptyWithRetry("全部订单暂未生成可用坐标。请在订单中填写收货地址后重新保存。", true, false);
    return;
  }

  setOrderMapStatus("加载中", "loading");
  setOrderMapEmptyWithRetry("地图加载中...", true, false);
  loadAmap(currentConfig, ["AMap.MarkerCluster"]).then(function (AMap) {
    if (token !== orderMapState.token) return;
    orderMapState.AMap = AMap;
    ensureOrderMap(AMap, settings);
    setOrderMapStatus("渲染中", "loading");
    renderOrderMapPoints(AMap, points);
    scheduleOrderMapLayout(token, points);
    watchOrderMapTiles(token, points);
  }).catch(function (error) {
    if (token !== orderMapState.token) return;
    clearOrderMapLayers();
    setOrderMapStatus("加载失败", "error");
    setOrderMapEmptyWithRetry(error.message || "地图加载失败，请检查高德 Key 或网络。", true, true);
  });
}

function retryOrderMapLoad() {
  resetAmapLoadCache();
  destroyOrderMapInstance();
  setOrderMapStatus("重新加载", "loading");
  setOrderMapEmptyWithRetry("地图重新加载中...", true, false);
  renderOrderMap(loadOrders());
}

function queueOrderMapResize() {
  if (orderMapResizeTimer) clearTimeout(orderMapResizeTimer);
  orderMapResizeTimer = setTimeout(function () {
    orderMapResizeTimer = null;
    scheduleOrderMapLayout(orderMapState.token, orderMapState.lastPoints);
  }, 120);
}

function getMapSettingsSignature(config) {
  var settings = getAmapSettings(config);
  return [
    settings.enabled ? "1" : "0",
    settings.amapKey,
    settings.securityJsCode,
    settings.geocodeCity,
    settings.mapStyle
  ].join("|");
}

function applyConfigToRuntime(nextConfig) {
  var previousMapSettings = getMapSettingsSignature(currentConfig);
  var nextMapSettings = getMapSettingsSignature(nextConfig);
  currentConfig = nextConfig;
  shippingPage.applyConfig(currentConfig);
  adminPage.refreshFromConfig(currentConfig);
  if (previousMapSettings !== nextMapSettings) {
    resetAmapLoadCache();
    destroyOrderMapInstance();
  }
  if (isAuthenticated()) renderDashboard();
}

function refreshConfigFromPreferredSource() {
  return loadConfigWithApiFallback().then(function (config) {
    applyConfigToRuntime(config);
  });
}

function hasDraftContent(draft) {
  var items = draft && draft.items ? draft.items : {};
  return Boolean(
    (items.mainRows && items.mainRows.length) ||
    (items.accessories && items.accessories.length) ||
    (items.steels && items.steels.length) ||
    (items.otherTiles && items.otherTiles.length)
  );
}

function getCurrentWorkingDraftOwner() {
  var user = getCurrentAuthUser();
  return String(user && user.username || "local").trim() || "local";
}

function setWorkingDraftStatus(message, isError) {
  if (!workingDraftStatus) return;
  workingDraftStatus.textContent = String(message || "");
  workingDraftStatus.classList.toggle("is-error", Boolean(isError));
}

function downloadCurrentWorkingDraft() {
  var draft = shippingPage.captureWorkingDraft();
  if (!hasWorkingDraftContent(draft)) {
    showToast("当前没有需要保存的订单草稿。", "warning");
    return;
  }
  var exported = exportWorkingDraft(getCurrentWorkingDraftOwner(), draft);
  var blob = new Blob([exported.json], { type: "application/json;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = exported.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  setWorkingDraftStatus("草稿已保存为本地文件", false);
  showToast("订单草稿已保存到本地文件。", "success");
}

function readWorkingDraftFile(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (event) { resolve(String(event.target && event.target.result || "")); };
    reader.onerror = function () { reject(new Error("无法读取草稿文件。")); };
    reader.readAsText(file, "utf-8");
  });
}

function importWorkingDraftFromFile(file) {
  if (!file) return Promise.resolve();
  return readWorkingDraftFile(file).then(function (text) {
    var envelope = parseWorkingDraftFile(text);
    var confirmPromise = shippingPage.hasWorkingDraftContent() ? confirmAction({
      title: "覆盖当前录入？",
      message: "导入草稿会替换当前尚未保存的订单内容。",
      confirmLabel: "确认导入",
      danger: false
    }) : Promise.resolve(true);
    return confirmPromise.then(function (confirmed) {
      if (!confirmed) return;
      shippingPage.restoreWorkingDraft(envelope.draft);
      setWorkingDraftStatus("已从本地文件导入草稿", false);
      showToast("订单草稿已从本地文件导入。", "success");
    });
  }).catch(function (error) {
    showToast(error && error.message ? error.message : "草稿导入失败。", "error");
  }).finally(function () {
    if (workingDraftFileInput) workingDraftFileInput.value = "";
  });
}

function requestClearWorkingForm() {
  return confirmAction({
    title: "清空当前录入？",
    message: "当前页面中尚未保存的订单内容会被清除。",
    confirmLabel: "确认清空"
  }).then(function (confirmed) {
    if (!confirmed) return;
    shippingPage.resetWorkingForm();
    setWorkingDraftStatus("当前录入已清空", false);
    showToast("当前录入已清空。", "success");
  });
}

function setAuthPasswordVisible(isVisible) {
  if (!authPassword) return;
  var label = isVisible ? "隐藏密码" : "显示密码";
  authPassword.type = isVisible ? "text" : "password";
  if (authPasswordToggle) {
    authPasswordToggle.setAttribute("aria-label", label);
    authPasswordToggle.setAttribute("aria-pressed", isVisible ? "true" : "false");
    authPasswordToggle.setAttribute("title", label);
  }
  if (authPasswordToggleIcon) {
    authPasswordToggleIcon.setAttribute("href", isVisible ? "#icon-eye-off" : "#icon-eye");
  }
}

function renderAuthGate() {
  var setupMode = !hasAuthSetup();
  var showUsername = !setupMode && isApiAuthConfigured();
  authView.hidden = false;
  enterElement(authView);
  workspaceHeader.hidden = true;
  adminView.hidden = true;
  businessViews.forEach(function (view) { view.hidden = true; });
  authTitle.textContent = setupMode ? "设置登录密码" : "登录系统";
  authSubtitle.textContent = setupMode ? "第一次使用需要先设置本机密码。密码只保存在当前浏览器。" : (showUsername ? "请输入账号和密码后继续使用。" : "请输入本机密码后继续使用。");
  if (authUsernameField) authUsernameField.hidden = !showUsername;
  if (authUsername) authUsername.value = showUsername ? getAuthUsernameDefault() : "";
  authConfirmField.hidden = !setupMode;
  authPassword.setAttribute("autocomplete", setupMode ? "new-password" : "current-password");
  authSubmit.querySelector("span").textContent = setupMode ? "设置并进入" : "进入系统";
  authStatus.textContent = "";
  authStatus.classList.remove("is-error", "is-success");
  authPassword.value = "";
  authConfirmPassword.value = "";
  setAuthPasswordVisible(false);
  setTimeout(function () {
    if (showUsername && authUsername) authUsername.focus();
    else authPassword.focus();
  }, 0);
}

function enterApplication() {
  shippingPage.resetWorkingForm();
  setWorkingDraftStatus("草稿不会自动保存，请手动保存到本地文件", false);
  authView.hidden = true;
  applyCurrentUserUi();
  renderSyncState();
  setDashboardSecondary(activeDashboardSecondary);
  renderAll();
  showView("dashboardView");
  refreshConfigFromPreferredSource();
  refreshOrdersFromPreferredSource();
}

window.addEventListener("erp-api-unauthorized", function () {
  shippingPage.resetWorkingForm();
  setWorkingDraftStatus("草稿不会自动保存，请手动保存到本地文件", false);
  logout();
  recordDetail.hidden = true;
  renderAuthGate();
});

window.addEventListener("resize", queueOrderMapResize);

function refreshOrdersFromPreferredSource() {
  retryPendingOrderSync().then(function () {
    return loadOrdersWithApiFallback();
  }).then(function () {
    renderAll();
    renderSyncState();
  });
}

function showView(viewId) {
  if (!isAuthenticated()) {
    renderAuthGate();
    return;
  }
  if (viewId === "adminView") {
    if (!isAdminUser()) {
      showToast("当前账号没有系统管理权限。", "warning");
      return;
    }
    authView.hidden = true;
    workspaceHeader.hidden = true;
    businessViews.forEach(function (view) { view.hidden = true; });
    adminView.hidden = false;
    enterElement(adminView);
    adminPage.refreshFromConfig(currentConfig);
    window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    return;
  }

  workspaceHeader.hidden = false;
  authView.hidden = true;
  adminView.hidden = true;
  businessViews.forEach(function (view) {
    view.hidden = view.id !== viewId;
    if (view.id === viewId) enterElement(view);
  });
  appViewButtons.forEach(function (button) {
    var active = button.getAttribute("data-app-view") === viewId;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (viewId === "dashboardView") {
    renderDashboard();
    setDashboardSecondary(activeDashboardSecondary);
  }
  if (viewId === "shippingView") shippingPage.recalc();
  if (viewId === "historyView") renderHistory();
  window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
}

function renderDashboard() {
  var orders = loadOrders();
  var monthStats = getMonthlyDashboardStats(orders, activeDashboardMonth);
  activeDashboardMonth = monthStats.month;
  if (dashboardMonthInput) dashboardMonthInput.value = activeDashboardMonth;
  var stats = getOrderStats(orders, getDateOnly(new Date()));
  dashboardDateTitle.textContent = activeDashboardMonth + " 订单";
  animateNumberText(todayOrderCount, monthStats.count, function (value) { return String(Math.round(value)); }, { duration: 340, startFrom: 0 });
  animateNumberText(todayOrderAmount, monthStats.amount, formatMoney, { duration: 360, startFrom: 0 });
  animateNumberText(todayOrderArea, monthStats.area, formatArea, { duration: 360, startFrom: 0 });
  animateNumberText(totalOrderCount, stats.totalCount, function (value) { return String(Math.round(value)); }, { duration: 340, startFrom: 0 });
  animateNumberText(totalOrderAmount, stats.totalAmount, formatMoney, { duration: 360, startFrom: 0 });
  animateNumberText(totalOrderArea, stats.totalArea, formatArea, { duration: 360, startFrom: 0 });
  renderTrend(orders);
  renderOrderMap(orders);
}

function renderHistoryMonthOptions(orders) {
  if (!historyMonthFilter) return;
  var selected = historyMonthFilter.value;
  var months = getHistoryMonthOptions(orders);
  historyMonthFilter.innerHTML = "<option value=''>全部月份</option>" + months.map(function (month) {
    return "<option value='" + escapeHtml(month) + "'>" + escapeHtml(month) + "</option>";
  }).join("");
  historyMonthFilter.value = months.indexOf(selected) !== -1 ? selected : "";
}

function getFilteredOrders() {
  var orders = loadOrders();
  renderHistoryMonthOptions(orders);
  var monthValue = historyMonthFilter ? historyMonthFilter.value : "";
  var typeValue = historyTypeFilter ? historyTypeFilter.value : "";
  var dateValue = historyDateFilter.value;
  var customerQuery = historyCustomerSearch.value.trim().toLowerCase();
  var addressQuery = historyAddressSearch.value.trim().toLowerCase();
  return filterHistoryOrders(orders, { month: monthValue, type: typeValue }).filter(function (order) {
    var matchesDate = !dateValue || order.orderDate === dateValue;
    var matchesCustomer = !customerQuery || String(order.customerName || "").toLowerCase().indexOf(customerQuery) !== -1;
    var matchesAddress = !addressQuery || getOrderLocationText(order).toLowerCase().indexOf(addressQuery) !== -1;
    return matchesDate && matchesCustomer && matchesAddress;
  });
}

function getOrderAreaValue(order) {
  var area = Number(order && order.totals && order.totals.areaTotal);
  return Number.isFinite(area) ? area : 0;
}

function sortHistoryOrders(orders) {
  var mode = historySortSelect ? historySortSelect.value : "time-desc";
  return (Array.isArray(orders) ? orders : []).slice().sort(function (a, b) {
    if (mode === "area-desc" || mode === "area-asc") {
      var areaDiff = getOrderAreaValue(b) - getOrderAreaValue(a);
      if (mode === "area-asc") areaDiff = -areaDiff;
      if (areaDiff) return areaDiff;
    } else {
      var timeDiff = getOrderDateTime(b) - getOrderDateTime(a);
      if (mode === "time-asc") timeDiff = -timeDiff;
      if (timeDiff) return timeDiff;
    }
    return String(getOrderCustomer(a)).localeCompare(String(getOrderCustomer(b)), "zh-CN");
  });
}

function renderHistory() {
  var filtered = sortHistoryOrders(getFilteredOrders());
  var page = paginateHistoryOrders(filtered, activeHistoryPage, HISTORY_PAGE_SIZE);
  activeHistoryPage = page.page;
  historyCountText.textContent = "共 " + filtered.length + " 条记录";
  setEmptyNote(historyEmpty, filtered.length === 0);
  if (historyPagination) historyPagination.hidden = filtered.length <= HISTORY_PAGE_SIZE;
  if (historyPageInfo) historyPageInfo.textContent = "第 " + page.page + " / " + page.totalPages + " 页，共 " + page.totalCount + " 条";
  if (historyPrevPage) historyPrevPage.disabled = page.page <= 1;
  if (historyNextPage) historyNextPage.disabled = page.page >= page.totalPages;
  historyTableBody.innerHTML = page.items.map(function (order) {
    return "<tr>" +
      "<td>" + escapeHtml(order.orderDate) + "</td>" +
      "<td>" + escapeHtml(getOrderCustomer(order)) + "</td>" +
      "<td class='history-location'>" + escapeHtml(getOrderLocationText(order)) + "</td>" +
      "<td>" + formatMoney(order.totals.grandAmount) + "</td>" +
      "<td>" + formatArea(order.totals.areaTotal) + "</td>" +
      "<td><div class='history-actions'>" +
      "<button type='button' class='btn btn-neutral compact-btn' data-record-action='view' data-order-id='" + escapeHtml(order.id) + "'>查看</button>" +
      "<button type='button' class='btn btn-soft compact-btn' data-record-action='edit' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-edit'></use></svg><span>编辑</span></button>" +
      (isAdminUser() ? "<button type='button' class='btn btn-danger compact-btn' data-record-action='delete' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除</span></button>" : "") +
      "</div></td>" +
      "</tr>";
  }).join("");
}

function renderItemSection(title, headers, rows, renderRow) {
  if (!rows.length) return "";
  return "<section class='detail-section'><h3>" + escapeHtml(title) + "</h3><div class='detail-table-wrap'><table class='detail-table'><thead><tr>" +
    headers.map(function (header) { return "<th>" + escapeHtml(header) + "</th>"; }).join("") +
    "</tr></thead><tbody>" + rows.map(renderRow).join("") + "</tbody></table></div></section>";
}

function renderOrderMapImageSection(order) {
  var orderId = getOrderMapImageOrderId(order && order.id);
  var escapedOrderId = escapeHtml(orderId);
  var disabledContent = "<p class='map-image-note'>当前未连接后端 API，地图展示图片暂不可保存。</p>";
  var actions = isApiConfigured() ? (
    "<div class='record-actions map-image-actions'>" +
    "<label class='btn btn-soft compact-btn map-image-upload-trigger'><svg class='ui-icon' aria-hidden='true'><use href='#icon-upload'></use></svg><span>上传图片</span><input class='visually-hidden-file' data-map-image-input data-order-id='" + escapedOrderId + "' type='file' accept='image/jpeg,image/png,image/webp' /></label>" +
    (isAdminUser() ? "<button type='button' class='btn btn-danger compact-btn' data-map-image-delete data-order-id='" + escapedOrderId + "' disabled><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除图片</span></button>" : "") +
    "</div>"
  ) : disabledContent;
  return "<section class='detail-section order-map-image-section' data-map-image-section data-order-id='" + escapedOrderId + "'>" +
    "<div class='map-image-head'><h3>地图展示图片</h3><span class='map-image-status' data-map-image-status>" + (isApiConfigured() ? "读取中" : "不可用") + "</span></div>" +
    "<div class='map-image-preview' data-map-image-preview><div class='map-image-placeholder'>" + (isApiConfigured() ? "图片读取中..." : "暂无图片") + "</div></div>" +
    actions +
    "</section>";
}

function findRecordMapImageSection(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  var sections = Array.prototype.slice.call(recordDetailBody.querySelectorAll("[data-map-image-section]"));
  return sections.find(function (section) {
    return section.getAttribute("data-order-id") === id;
  }) || null;
}

function setRecordMapImageStatus(orderId, text, mode) {
  var section = findRecordMapImageSection(orderId);
  var status = section ? section.querySelector("[data-map-image-status]") : null;
  if (!status) return;
  status.textContent = text || "";
  status.className = "map-image-status" + (mode ? " is-" + mode : "");
}

function setRecordMapImageBusy(orderId, busy) {
  var section = findRecordMapImageSection(orderId);
  if (!section) return;
  Array.prototype.slice.call(section.querySelectorAll("button, input")).forEach(function (control) {
    control.disabled = Boolean(busy) || (control.hasAttribute("data-map-image-delete") && control.getAttribute("data-has-image") !== "true");
  });
  section.classList.toggle("is-busy", Boolean(busy));
}

function setRecordMapImagePreview(orderId, imageUrl, message) {
  var section = findRecordMapImageSection(orderId);
  var preview = section ? section.querySelector("[data-map-image-preview]") : null;
  var deleteButton = section ? section.querySelector("[data-map-image-delete]") : null;
  if (!preview) return;
  if (imageUrl) {
    preview.innerHTML = "<img src='" + escapeHtml(imageUrl) + "' alt='地图展示图片预览' />";
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.setAttribute("data-has-image", "true");
    }
    return;
  }
  preview.innerHTML = "<div class='map-image-placeholder'>" + escapeHtml(message || "暂无图片") + "</div>";
  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.setAttribute("data-has-image", "false");
  }
}

function refreshRecordMapImagePreview(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !isApiConfigured()) return;
  var token = (recordMapImagePreviewTokens[id] || 0) + 1;
  recordMapImagePreviewTokens[id] = token;
  setRecordMapImageStatus(id, "读取中", "loading");
  setRecordMapImagePreview(id, "", "图片读取中...");
  loadOrderMapImageUrl(id).then(function (url) {
    if (recordMapImagePreviewTokens[id] !== token) return;
    if (url) {
      setRecordMapImagePreview(id, url);
      setRecordMapImageStatus(id, "已上传", "ready");
    } else {
      setRecordMapImagePreview(id, "", "暂无图片");
      setRecordMapImageStatus(id, "暂无图片", "idle");
    }
  }).catch(function (error) {
    if (recordMapImagePreviewTokens[id] !== token) return;
    setRecordMapImagePreview(id, "", "图片读取失败");
    setRecordMapImageStatus(id, "读取失败", "error");
    console.warn("Order map image preview failed.", {
      orderId: id,
      reason: getOrderMapImageErrorMessage(error)
    });
  });
}

function uploadRecordMapImage(orderId, file) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !file) return;
  if (!isApiConfigured()) {
    showToast("当前未连接后端 API，地图展示图片暂不可保存。", "warning");
    return;
  }
  bumpOrderMapImageVersion(id);
  recordMapImagePreviewTokens[id] = (recordMapImagePreviewTokens[id] || 0) + 1;
  setRecordMapImageBusy(id, true);
  setRecordMapImageStatus(id, "压缩中", "loading");
  setRecordMapImagePreview(id, "", "图片压缩中...");
  compressOrderMapImage(file).then(function (prepared) {
    if (!prepared.blob || prepared.blob.size > ORDER_MAP_IMAGE_MAX_BYTES) {
      throw new Error("图片必须小于 500KB。");
    }
    setRecordMapImageStatus(id, "上传中", "loading");
    setRecordMapImagePreview(id, "", "图片上传中...");
    return uploadOrderMapImageToApi(id, prepared.blob, {
      fileName: prepared.fileName,
      width: prepared.width,
      height: prepared.height
    }).then(function () {
      var url = rememberOrderMapImageUrl(id, prepared.blob);
      setRecordMapImagePreview(id, url);
      setRecordMapImageStatus(id, "已上传", "ready");
      refreshOpenOrderInfoForOrder(id, "ready");
    });
  }).catch(function (error) {
    setRecordMapImagePreview(id, getCachedOrderMapImageUrl(id), getCachedOrderMapImageUrl(id) ? "" : "上传失败");
    setRecordMapImageStatus(id, "上传失败", "error");
    showToast(getOrderMapImageErrorMessage(error), "error");
  }).finally(function () {
    setRecordMapImageBusy(id, false);
  });
}

function deleteRecordMapImage(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !isApiConfigured() || !isAdminUser()) return;
  confirmAction({ title: "删除地图图片", message: "删除后无法恢复，确定继续吗？", confirmLabel: "删除图片" }).then(function (confirmed) {
    if (!confirmed) return;
    bumpOrderMapImageVersion(id);
    recordMapImagePreviewTokens[id] = (recordMapImagePreviewTokens[id] || 0) + 1;
    setRecordMapImageBusy(id, true);
    setRecordMapImageStatus(id, "删除中", "loading");
    deleteOrderMapImageFromApi(id).then(function () {
      revokeOrderMapImageUrl(id);
      setRecordMapImagePreview(id, "", "暂无图片");
      setRecordMapImageStatus(id, "暂无图片", "idle");
      refreshOpenOrderInfoForOrder(id, "none");
      showToast("地图图片已删除。", "success");
    }).catch(function (error) {
      setRecordMapImageStatus(id, "删除失败", "error");
      showToast(getOrderMapImageErrorMessage(error), "error");
    }).finally(function () {
      setRecordMapImageBusy(id, false);
    });
  });
}

function renderRecordDetail(order, mode) {
  recordDetail.hidden = false;
  enterElement(recordDetail);
  recordDetailTitle.textContent = mode === "edit" ? "编辑订单" : "订单详情";
  recordDetailSubtitle.textContent = getOrderCustomer(order) + " · " + order.orderDate;

  if (mode === "edit") {
    recordDetailBody.innerHTML =
      "<form class='record-edit-form' id='recordEditForm' data-order-id='" + escapeHtml(order.id) + "'>" +
      "<div class='form-grid'>" +
      "<label class='field'><span>订单日期</span><input name='orderDate' type='date' value='" + escapeHtml(order.orderDate) + "' required /></label>" +
      "<label class='field'><span>客户名称</span><input name='customerName' type='text' value='" + escapeHtml(order.customerName) + "' /></label>" +
      "<label class='field'><span>颜色</span><input name='tileColor' type='text' value='" + escapeHtml(order.tileColor) + "' /></label>" +
      "<label class='field'><span>钢材类别</span><input name='steelCategory' type='text' value='" + escapeHtml(order.steelCategory || "") + "' /></label>" +
      "<label class='field'><span>镀锌工艺</span><select name='galvanizingProcess'>" + renderGalvanizingProcessOptions(order.galvanizingProcess) + "</select></label>" +
      "<label class='field'><span>配送方式</span><select name='deliveryMethod'>" + renderDeliveryMethodOptions(order.deliveryMethod) + "</select></label>" +
      "<label class='field span-2'><span>收货地址</span><input name='deliveryAddress' type='text' value='" + escapeHtml(order.deliveryAddress) + "' /></label>" +
      "<label class='field'><span>建成年月</span><input name='completionMonth' type='month' value='" + escapeHtml(order.completionMonth) + "' /></label>" +
      "<label class='field span-2'><span>备注</span><input name='remark' type='text' value='" + escapeHtml(order.remark) + "' /></label>" +
      "<label class='field'><span>总面积</span><input name='areaTotal' type='number' step='0.0001' value='" + escapeHtml(order.totals.areaTotal) + "' /></label>" +
      "<label class='field'><span>主瓦金额</span><input name='mainAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.mainAmount) + "' /></label>" +
      "<label class='field'><span>配件金额</span><input name='accessoryAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.accessoryAmount) + "' /></label>" +
      "<label class='field'><span>钢铁材料</span><input name='steelAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.steelAmount) + "' /></label>" +
      "<label class='field'><span>其他瓦金额</span><input name='otherTileAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.otherTileAmount) + "' /></label>" +
      "</div>" +
      renderOrderMapImageSection(order) +
      "<div class='record-actions'><button type='submit' class='btn btn-primary'><svg class='ui-icon' aria-hidden='true'><use href='#icon-save'></use></svg><span>保存编辑</span></button><button type='button' class='btn btn-neutral' data-detail-action='view' data-order-id='" + escapeHtml(order.id) + "'>取消</button></div>" +
      "</form>";
    refreshRecordMapImagePreview(order.id);
    return;
  }

  var items = order.items;
  recordDetailBody.innerHTML =
    "<div class='detail-summary'>" +
    "<div><span>客户</span><strong>" + escapeHtml(getOrderCustomer(order)) + "</strong></div>" +
    "<div><span>颜色</span><strong>" + escapeHtml(order.tileColor || "未填写") + "</strong></div>" +
    "<div><span>钢材类别</span><strong>" + escapeHtml(order.steelCategory || "未填写") + "</strong></div>" +
    "<div><span>镀锌工艺</span><strong>" + escapeHtml(order.galvanizingProcess || "未填写") + "</strong></div>" +
    "<div><span>配送方式</span><strong>" + escapeHtml(order.deliveryMethod || "未填写") + "</strong></div>" +
    "<div><span>金额</span><strong>" + formatMoney(order.totals.grandAmount) + " 元</strong></div>" +
    "<div><span>面积</span><strong>" + formatArea(order.totals.areaTotal) + " ㎡</strong></div>" +
    "<div><span>位置</span><strong>" + escapeHtml(getOrderLocationText(order)) + "</strong></div>" +
    "<div><span>建成年月</span><strong>" + escapeHtml(formatCompletionMonth(order.completionMonth)) + "</strong></div>" +
    "<div><span>地图定位</span><strong>" + (getOrderLocation(order) ? "已定位" : "待定位") + "</strong></div>" +
    "</div>" +
    (order.remark ? "<p class='detail-remark'>" + escapeHtml(order.remark) + "</p>" : "") +
    renderOrderMapImageSection(order) +
    renderItemSection("主瓦", ["长度", "实装节数", "数量", "面积"], items.mainRows, function (row) {
      return "<tr><td>" + escapeHtml(row.lengthsText) + "</td><td>" + escapeHtml(row.actual) + "</td><td>" + escapeHtml(row.totalQty) + "</td><td>" + formatArea(row.area) + "</td></tr>";
    }) +
    renderItemSection("配件", ["名称", "数量", "单位", "单价", "小计"], items.accessories, function (item) {
      return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.qty) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
    }) +
    renderItemSection("钢铁材料", ["名称", "数量", "单位", "单价", "小计"], items.steels, function (item) {
      return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.qty) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
    }) +
    renderItemSection("其他瓦", ["名称", "单片长度", "片数", "总长度", "单位", "单价", "小计"], items.otherTiles, function (item) {
      return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.length) + "</td><td>" + escapeHtml(item.qty) + "</td><td>" + formatTrimFixed(computeOtherTileTotalLength(item.length, item.qty), 3) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
    }) +
    "<div class='record-actions'><button type='button' class='btn btn-soft' data-detail-action='edit' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-edit'></use></svg><span>编辑记录</span></button>" +
    (isAdminUser() ? "<button type='button' class='btn btn-danger' data-detail-action='delete' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除记录</span></button>" : "") +
    "</div>";
  refreshRecordMapImagePreview(order.id);
}

function findOrder(orderId) {
  return loadOrders().find(function (order) {
    return order.id === orderId || order.clientOrderId === orderId;
  });
}

function openRecord(orderId, mode) {
  var order = findOrder(orderId);
  if (!order) {
    showToast("没有找到这条订单记录。", "error");
    renderAll();
    return;
  }
  renderRecordDetail(order, mode || "view");
}

function removeOrder(orderId) {
  var order = findOrder(orderId);
  if (!order || !isAdminUser()) return;
  confirmAction({ title: "删除订单", message: "确定删除 “" + getOrderCustomer(order) + "” 在 " + order.orderDate + " 的订单记录吗？", confirmLabel: "删除订单" }).then(function (confirmed) {
    if (!confirmed) return;
    deleteOrderWithApiFallback(order.id, order).then(function () {
      recordDetail.hidden = true;
      renderAll();
      showToast("订单已删除。", "success");
    }).catch(function (error) {
      showToast(error && error.message ? error.message : "服务器删除失败，本地订单已保留。", "error");
      renderAll();
    });
  });
}

function isSameDeliveryAddress(order, previousOrder) {
  return String(order && order.deliveryAddress || "").trim() === String(previousOrder && previousOrder.deliveryAddress || "").trim();
}

function withTimeout(promise, milliseconds, message) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error(message || "操作超时。"));
    }, milliseconds);
    promise.then(function (value) {
      clearTimeout(timer);
      resolve(value);
    }).catch(function (error) {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function resolveOrderLocation(order, previousOrder) {
  var address = String(order && order.deliveryAddress || "").trim();
  if (!address) {
    return Promise.resolve({
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: null })),
      warning: ""
    });
  }
  if (previousOrder && previousOrder.deliveryLocation && isSameDeliveryAddress(order, previousOrder)) {
    return Promise.resolve({
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: previousOrder.deliveryLocation })),
      warning: ""
    });
  }
  var settings = getAmapSettings(currentConfig);
  if (!settings.enabled) {
    return Promise.resolve({
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: null })),
      warning: ""
    });
  }
  if (!hasUsableAmapSettings(currentConfig)) {
    return Promise.resolve({
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: null })),
      warning: "地图配置不完整，订单已保存但地图暂无定位。"
    });
  }
  return withTimeout(geocodeDeliveryAddress(address, currentConfig), 8000, "收货地址解析超时。").then(function (location) {
    return {
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: location })),
      warning: ""
    };
  }).catch(function (error) {
    return {
      order: normalizeOrder(Object.assign({}, order, { deliveryLocation: null })),
      warning: (error.message || "收货地址解析失败。") + "订单已保存但地图暂无定位。"
    };
  });
}

function setOrderSaveBusy(busy) {
  [saveOrderBtn].forEach(function (button) {
    if (!button) return;
    button.disabled = Boolean(busy);
    button.classList.toggle("is-loading", Boolean(busy));
  });
}

function saveRecordEdit(form) {
  var order = findOrder(form.getAttribute("data-order-id"));
  if (!order) return;
  var updated = normalizeOrder(Object.assign({}, order, {
    orderDate: form.elements.orderDate.value,
    orderNo: order.orderNo,
    clientOrderId: order.clientOrderId,
    customerName: form.elements.customerName.value,
    tileColor: form.elements.tileColor.value,
    steelCategory: form.elements.steelCategory.value,
    galvanizingProcess: form.elements.galvanizingProcess.value,
    deliveryMethod: form.elements.deliveryMethod.value,
    deliveryAddress: form.elements.deliveryAddress.value,
    completionMonth: form.elements.completionMonth.value,
    remark: form.elements.remark.value,
    totals: {
      areaTotal: parseNum(form.elements.areaTotal.value),
      mainAmount: parseNum(form.elements.mainAmount.value),
      accessoryAmount: parseNum(form.elements.accessoryAmount.value),
      steelAmount: parseNum(form.elements.steelAmount.value),
      otherTileAmount: parseNum(form.elements.otherTileAmount.value)
    }
  }));
  resolveOrderLocation(updated, order).then(function (result) {
    return updateOrderWithApiFallback(order.id, result.order).then(function (savedResult) {
      renderAll();
      openRecord(savedResult.order.id, "view");
      var warning = [savedResult.warning, result.warning].filter(Boolean).join(" ");
      showToast(warning || "订单修改已保存。", warning ? "warning" : "success");
    });
  }).catch(function (error) {
    showToast(error.message || "订单保存失败。", "error");
  });
}

function renderAll() {
  renderDashboard();
  renderHistory();
}

function setDashboardMonth(monthKey) {
  activeDashboardMonth = normalizeMonthKey(monthKey);
  renderDashboard();
}

function saveCurrentOrder() {
  var draft = shippingPage.createOrderDraft();
  if (!hasDraftContent(draft)) {
    showToast("当前没有可保存的主瓦、配件、钢铁材料或其他瓦数据。", "warning");
    return;
  }
  var now = new Date();
  var order = normalizeOrder(Object.assign({}, draft, {
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }));
  setOrderSaveBusy(true);
  resolveOrderLocation(order, null).then(function (result) {
    return upsertOrderWithApiFallback(result.order).then(function (savedResult) {
      renderAll();
      var warning = [savedResult.warning, result.warning].filter(Boolean).join(" ");
      showToast(warning || (savedResult.persistence === "local-only" ? "订单已保存到本机。" : "订单已保存到服务器。"), warning ? "warning" : "success");
    });
  }).catch(function (error) {
    showToast(error.message || "订单保存失败。", "error");
  }).finally(function () {
    setOrderSaveBusy(false);
  });
}

document.addEventListener("click", function (event) {
  var lightboxButton = event.target.closest("[data-map-lightbox-src]");
  if (lightboxButton) {
    event.preventDefault();
    openMapImageLightbox(lightboxButton.getAttribute("data-map-lightbox-src"), lightboxButton.getAttribute("data-map-lightbox-caption"));
    return;
  }

  var viewButton = event.target.closest("[data-app-view]");
  if (viewButton) {
    showView(viewButton.getAttribute("data-app-view"));
  }
});

if (authPasswordToggle) {
  authPasswordToggle.addEventListener("click", function () {
    var nextVisible = authPassword && authPassword.type === "password";
    setAuthPasswordVisible(nextVisible);
    if (authPassword) authPassword.focus();
  });
}

authForm.addEventListener("submit", function (event) {
  event.preventDefault();
  var setupMode = !hasAuthSetup();
  var loginUsername = authUsername ? authUsername.value.trim() : "";
  authSubmit.disabled = true;
  authStatus.textContent = setupMode ? "正在设置密码..." : "正在登录...";
  authStatus.classList.remove("is-error");
  authStatus.classList.add("is-success");
  (setupMode ? setupPassword(authPassword.value, authConfirmPassword.value) : loginWithPassword(authPassword.value, loginUsername))
    .then(function () {
      enterApplication();
    })
    .catch(function (error) {
      var reason = error && error.message ? error.message : "Login failed.";
      if (!setupMode) {
        console.warn("[auth-login-failed]", {
          username: loginUsername || getAuthUsernameDefault(),
          reason: reason
        });
      }
      authStatus.textContent = error.message || "登录失败，请重试。";
      authStatus.classList.add("is-error");
      authStatus.classList.remove("is-success");
    })
    .finally(function () {
      authSubmit.disabled = false;
    });
});

if (adminTopToggle) adminTopToggle.addEventListener("click", function () { showView("adminView"); });
logoutButton.addEventListener("click", function () {
  shippingPage.resetWorkingForm();
  setWorkingDraftStatus("草稿不会自动保存，请手动保存到本地文件", false);
  logout();
  renderAuthGate();
});
backToShipping.addEventListener("click", function () { showView("shippingView"); });
saveOrderBtn.addEventListener("click", saveCurrentOrder);

if (exportWorkingDraftButton) exportWorkingDraftButton.addEventListener("click", downloadCurrentWorkingDraft);
if (importWorkingDraftButton) importWorkingDraftButton.addEventListener("click", function () {
  if (workingDraftFileInput) workingDraftFileInput.click();
});
if (workingDraftFileInput) workingDraftFileInput.addEventListener("change", function () {
  importWorkingDraftFromFile(workingDraftFileInput.files && workingDraftFileInput.files[0]);
});
if (clearWorkingDraftButton) clearWorkingDraftButton.addEventListener("click", requestClearWorkingForm);

if (syncStatusButton) syncStatusButton.addEventListener("click", function () {
  syncStatusButton.disabled = true;
  retryPendingOrderSync().then(function (state) {
    renderSyncState(state);
    renderAll();
    if (state.state === "local-only") showToast("当前为本机模式，数据不会上传到服务器。", "info");
    else if (state.state === "connection-error") showToast("仍无法连接服务器，请稍后重试。", "error");
    else if (state.pendingCount) showToast("仍有 " + state.pendingCount + " 条订单等待同步。", "warning");
    else showToast("订单数据已同步。", "success");
  }).finally(function () {
    syncStatusButton.disabled = false;
  });
});

if (dashboardMonthInput) {
  dashboardMonthInput.addEventListener("change", function () {
    setDashboardMonth(dashboardMonthInput.value);
  });
}

if (dashboardPrevMonth) {
  dashboardPrevMonth.addEventListener("click", function () {
    setDashboardMonth(addMonthsToKey(activeDashboardMonth, -1));
  });
}

if (dashboardCurrentMonth) {
  dashboardCurrentMonth.addEventListener("click", function () {
    setDashboardMonth(getMonthKey(new Date()));
  });
}

if (dashboardNextMonth) {
  dashboardNextMonth.addEventListener("click", function () {
    setDashboardMonth(addMonthsToKey(activeDashboardMonth, 1));
  });
}

trendModeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTrendMode = button.getAttribute("data-trend-mode") || "month";
    hideTrendPointDetail();
    renderDashboard();
  });
});

trendMonthButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTrendMonth = normalizeTrendMonthValue(button.getAttribute("data-trend-month"), activeTrendMonth);
    hideTrendPointDetail();
    renderDashboard();
  });
});

if (trendPrevYear) {
  trendPrevYear.addEventListener("click", function () {
    activeTrendYear -= 1;
    hideTrendPointDetail();
    renderDashboard();
  });
}

if (trendNextYear) {
  trendNextYear.addEventListener("click", function () {
    activeTrendYear += 1;
    hideTrendPointDetail();
    renderDashboard();
  });
}

window.addEventListener("resize", function () {
  window.clearTimeout(trendPickerResizeTimer);
  trendPickerResizeTimer = window.setTimeout(syncTrendMobilePickers, 120);
}, { passive: true });

if (trendPieTileToggle) {
  trendPieTileToggle.addEventListener("click", function () {
    if (activeTrendPieMode === "tile") {
      activeTrendPieMode = "overview";
    } else {
      activeTrendPieMode = "tile";
      activeTrendTilePieView = "brand";
    }
    renderTrend(loadOrders());
  });
}

trendTilePieViewButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTrendTilePieView = button.getAttribute("data-trend-tile-pie-view") || "brand";
    activeTrendPieMode = "tile";
    renderTrend(loadOrders());
  });
});

dashboardSecondaryButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    setDashboardSecondary(button.getAttribute("data-dashboard-secondary"));
  });
});

if (orderTrendChart) {
  orderTrendChart.addEventListener("click", function (event) {
    var point = event.target.closest("[data-trend-key]");
    if (!point) return;
    activateTrendChartPoint(point.getAttribute("data-trend-key") || "");
  });

  orderTrendChart.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var point = event.target.closest("[data-trend-key]");
    if (!point) return;
    event.preventDefault();
    activateTrendChartPoint(point.getAttribute("data-trend-key") || "");
  });
}

if (trendPointDetail) {
  trendPointDetail.addEventListener("click", function (event) {
    if (!event.target.closest("[data-trend-detail-close]")) return;
    hideTrendPointDetail();
  });
}

if (orderMapRetry) {
  orderMapRetry.addEventListener("click", retryOrderMapLoad);
}

if (mapImageLightboxClose) mapImageLightboxClose.addEventListener("click", closeMapImageLightbox);
if (mapImageLightbox) {
  mapImageLightbox.addEventListener("click", function (event) {
    if (event.target === mapImageLightbox) closeMapImageLightbox();
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && mapImageLightbox && !mapImageLightbox.hidden) {
    closeMapImageLightbox();
  }
});

[historyMonthFilter, historyTypeFilter, historyDateFilter, historyCustomerSearch, historyAddressSearch, historySortSelect].forEach(function (input) {
  if (!input) return;
  var resetAndRender = function () {
    activeHistoryPage = 1;
    renderHistory();
  };
  input.addEventListener("input", resetAndRender);
  input.addEventListener("change", resetAndRender);
});

resetHistoryFilters.addEventListener("click", function () {
  if (historyMonthFilter) historyMonthFilter.value = "";
  if (historyTypeFilter) historyTypeFilter.value = "";
  historyDateFilter.value = "";
  historyCustomerSearch.value = "";
  historyAddressSearch.value = "";
  historySortSelect.value = "time-desc";
  activeHistoryPage = 1;
  renderHistory();
});

if (historyPrevPage) {
  historyPrevPage.addEventListener("click", function () {
    activeHistoryPage = Math.max(1, activeHistoryPage - 1);
    renderHistory();
  });
}

if (historyNextPage) {
  historyNextPage.addEventListener("click", function () {
    activeHistoryPage += 1;
    renderHistory();
  });
}

historyTableBody.addEventListener("click", function (event) {
  var button = event.target.closest("[data-record-action]");
  if (!button) return;
  var action = button.getAttribute("data-record-action");
  var orderId = button.getAttribute("data-order-id");
  if (action === "delete") removeOrder(orderId);
  if (action === "view") openRecord(orderId, "view");
  if (action === "edit") openRecord(orderId, "edit");
});

recordDetailBody.addEventListener("click", function (event) {
  var mapImageDeleteButton = event.target.closest("[data-map-image-delete]");
  if (mapImageDeleteButton) {
    deleteRecordMapImage(mapImageDeleteButton.getAttribute("data-order-id"));
    return;
  }
  var button = event.target.closest("[data-detail-action]");
  if (!button) return;
  var action = button.getAttribute("data-detail-action");
  var orderId = button.getAttribute("data-order-id");
  if (action === "delete") removeOrder(orderId);
  if (action === "view") openRecord(orderId, "view");
  if (action === "edit") openRecord(orderId, "edit");
});

recordDetailBody.addEventListener("change", function (event) {
  var input = event.target && event.target.closest ? event.target.closest("[data-map-image-input]") : null;
  if (!input) return;
  var file = input.files && input.files[0];
  if (file) uploadRecordMapImage(input.getAttribute("data-order-id"), file);
  input.value = "";
});

recordDetailBody.addEventListener("submit", function (event) {
  if (event.target && event.target.id === "recordEditForm") {
    event.preventDefault();
    saveRecordEdit(event.target);
  }
});

closeRecordDetail.addEventListener("click", function () {
  recordDetail.hidden = true;
});

function requestClearAllOrders() {
  if (!isAdminUser()) return Promise.resolve(false);
  return confirmAction({ title: "清空全部订单", message: "此操作会删除服务器和本机中的全部订单，且无法恢复。", confirmLabel: "继续" }).then(function (confirmed) {
    if (!confirmed) return false;
    return confirmAction({ title: "最后确认", message: "请再次确认：清空后只能通过备份恢复订单。", confirmLabel: "确认清空" });
  }).then(function (confirmed) {
    if (!confirmed) return false;
    return clearOrdersWithApiFallback().then(function () {
      recordDetail.hidden = true;
      renderAll();
      showToast("订单清理操作已完成。", "success");
      return true;
    }).catch(function (error) {
      console.warn("Order bulk clear failed.", {
        reason: error && error.message ? error.message : String(error || "Unknown error")
      });
      showToast(error && error.message ? error.message : "订单清理失败，未完成的记录已保留。", "error");
      renderAll();
      return false;
    });
  });
}

window.addEventListener("online", function () {
  retryPendingOrderSync().then(function (state) {
    renderSyncState(state);
    renderAll();
  });
});

window.addEventListener("erp-sync-state-change", function (event) {
  renderSyncState(event && event.detail);
});

subscribeConfigChange(function (nextConfig) {
  applyConfigToRuntime(nextConfig);
});

if (isAuthenticated()) {
  enterApplication();
} else {
  renderAuthGate();
}
