import { initAdminPage } from "./components/admin/adminPage.js";
import { initShippingPage } from "./components/shipping/shippingPage.js";
import {
  getAuthUsernameDefault,
  hasAuthSetup,
  isApiAuthConfigured,
  isAuthenticated,
  loginWithPassword,
  logout,
  setupPassword
} from "./services/authService.js";
import { loadConfig, saveConfig, subscribeConfigChange } from "./services/configService.js";
import { geocodeDeliveryAddress, getAmapSettings, hasUsableAmapSettings, loadAmap, resetAmapLoadCache } from "./services/amapService.js";
import {
  deleteOrderMapImageFromApi,
  fetchOrderMapImageBlobFromApi,
  isApiConfigured,
  ORDER_MAP_IMAGE_MAX_BYTES,
  uploadOrderMapImageToApi
} from "./services/apiClient.js";
import {
  buildExportPayload,
  clearOrdersWithApiFallback,
  deleteOrderWithApiFallback,
  generateOrderNo,
  getDateOnly,
  getOrderStats,
  getOrderTrend,
  getOrdersInTrendRange,
  importOrdersFromPayload,
  loadBackupMeta,
  loadOrders,
  loadOrdersWithApiFallback,
  normalizeOrder,
  readImportPayload,
  saveBackupMeta,
  updateOrderWithApiFallback,
  upsertOrderWithApiFallback
} from "./services/orderService.js";
import { escapeHtml, formatMoney, formatNum, parseNum } from "./utils.js";

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
var backToShipping = document.getElementById("backToShipping");
var saveOrderBtn = document.getElementById("saveOrder");
var saveOrderSideBtn = document.getElementById("saveOrderSide");

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
var trendRangeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-trend-range]"));
var trendTotalCount = document.getElementById("trendTotalCount");
var trendTotalAmount = document.getElementById("trendTotalAmount");
var orderTrendChart = document.getElementById("orderTrendChart");
var trendEmpty = document.getElementById("trendEmpty");
var orderLocationMap = document.getElementById("orderLocationMap");
var orderMapSubtitle = document.getElementById("orderMapSubtitle");
var orderMapStatus = document.getElementById("orderMapStatus");
var orderMapEmpty = document.getElementById("orderMapEmpty");
var orderMapEmptyText = document.getElementById("orderMapEmptyText");
var orderMapRetry = document.getElementById("orderMapRetry");
var orderMapOrderList = document.getElementById("orderMapOrderList");
var recentOrderList = document.getElementById("recentOrderList");
var recentOrderEmpty = document.getElementById("recentOrderEmpty");

var historyDateFilter = document.getElementById("historyDateFilter");
var historyOrderSearch = document.getElementById("historyOrderSearch");
var historyCustomerSearch = document.getElementById("historyCustomerSearch");
var resetHistoryFilters = document.getElementById("resetHistoryFilters");
var historyCountText = document.getElementById("historyCountText");
var historyTableBody = document.getElementById("historyTableBody");
var historyEmpty = document.getElementById("historyEmpty");
var clearAllOrdersBtn = document.getElementById("clearAllOrders");
var recordDetail = document.getElementById("recordDetail");
var recordDetailTitle = document.getElementById("recordDetailTitle");
var recordDetailSubtitle = document.getElementById("recordDetailSubtitle");
var recordDetailBody = document.getElementById("recordDetailBody");
var closeRecordDetail = document.getElementById("closeRecordDetail");

var exportDataBtn = document.getElementById("exportData");
var importDataFile = document.getElementById("importDataFile");
var dataOrderCount = document.getElementById("dataOrderCount");
var dataLastSaved = document.getElementById("dataLastSaved");
var dataLastExported = document.getElementById("dataLastExported");
var dataLastImported = document.getElementById("dataLastImported");
var dataStatusMessage = document.getElementById("dataStatusMessage");
var activeTrendRange = "7d";
var activeDashboardMonth = getMonthKey(new Date());
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

var shippingPage = initShippingPage({ getConfig: getConfig });
var adminPage = initAdminPage({ getConfig: getConfig });

function formatDateTime(value, emptyText) {
  if (!value) return emptyText || "暂无";
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyText || "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
  if (bucketType === "month") return index % 2 === 0 || index === length - 1;
  if (length <= 7) return true;
  return index % 5 === 0 || index === length - 1;
}

function renderTrendChart(trend) {
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
    return "<circle class='chart-dot count' cx='" + countPoint.x.toFixed(2) + "' cy='" + countPoint.y.toFixed(2) + "' r='4'><title>" + escapeHtml(point.label) + " 订单数量：" + point.count + "</title></circle>" +
      "<circle class='chart-dot amount' cx='" + amountPoint.x.toFixed(2) + "' cy='" + amountPoint.y.toFixed(2) + "' r='4'><title>" + escapeHtml(point.label) + " 订单金额：" + formatMoney(point.amount) + "</title></circle>";
  }).join("");
  orderTrendChart.innerHTML =
    grid +
    "<line class='chart-axis' x1='" + bounds.left + "' y1='" + (bounds.top + bounds.height) + "' x2='" + (bounds.left + bounds.width) + "' y2='" + (bounds.top + bounds.height) + "'></line>" +
    "<polyline class='chart-line amount' points='" + polyline(amountPoints) + "'></polyline>" +
    "<polyline class='chart-line count' points='" + polyline(countPoints) + "'></polyline>" +
    dots +
    labels;
}

function renderTrend(orders) {
  var trend = getOrderTrend(orders, activeTrendRange, new Date());
  var hasData = trend.totalCount > 0 || trend.totalAmount > 0;
  trendSubtitle.textContent = "查看" + getTrendRangeLabel(activeTrendRange) + "的订单数量和订单金额。";
  trendTotalCount.textContent = String(trend.totalCount);
  trendTotalAmount.textContent = formatMoney(trend.totalAmount);
  trendRangeButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-trend-range") === activeTrendRange);
  });
  renderTrendChart(trend);
  setEmptyNote(trendEmpty, !hasData);
  orderTrendChart.classList.toggle("is-muted", !hasData);
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

function formatCompletionMonth(value) {
  var text = String(value || "").trim();
  var match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return "未填写";
  return match[1] + "年" + Number(match[2]) + "月建成";
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

function renderOrderMapList(orders) {
  if (!orderMapOrderList) return;
  var sorted = sortOrdersByOrderDate(orders);
  if (!sorted.length) {
    orderMapOrderList.innerHTML = "<div class='map-order-empty'>当前范围内暂无订单信息。</div>";
    return;
  }
  orderMapOrderList.innerHTML = sorted.map(function (order) {
    var located = Boolean(getOrderLocation(order));
    return "<article class='map-order-item'>" +
      "<time>" + escapeHtml(order.orderDate || "未填写日期") + "</time>" +
      "<div><strong>" + escapeHtml(getOrderTitle(order)) + "</strong><span>" + escapeHtml(getOrderCustomer(order)) + " · " + escapeHtml(formatCompletionMonth(order.completionMonth)) + "</span></div>" +
      "<p>" + escapeHtml(getOrderAddress(order) || "未填写收货地址") + "</p>" +
      "<em class='" + (located ? "is-ready" : "is-pending") + "'>" + (located ? "已定位" : "待定位") + "</em>" +
      "</article>";
  }).join("");
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

function getOrderMapInfoImageHtml(imageUrl, imageState) {
  if (imageUrl) {
    return "<div class='order-map-info-image'><img src='" + escapeHtml(imageUrl) + "' alt='地图展示图片' /></div>";
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
    getOrderMapInfoImageHtml(image.url, image.state) +
    "</div>";
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
  var rangeOrders = sortOrdersByOrderDate(getOrdersInTrendRange(orders, activeTrendRange, new Date()));
  renderOrderMapList(rangeOrders);
  var points = rangeOrders.map(function (order) {
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
  var pendingCount = rangeOrders.length - points.length;

  if (orderMapSubtitle) {
    orderMapSubtitle.textContent = "查看" + getTrendRangeLabel(activeTrendRange) + "内的订单位置：" + points.length + " 个定位点，" + pendingCount + " 个待定位。";
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
  if (!rangeOrders.length) {
    clearOrderMapLayers();
    setOrderMapStatus("无订单", "idle");
    setOrderMapEmptyWithRetry("当前时间范围内暂无订单。", true, false);
    return;
  }
  if (!points.length) {
    clearOrderMapLayers();
    setOrderMapStatus("待定位", "warning");
    setOrderMapEmptyWithRetry("当前范围内的订单还没有可用坐标。请在订单中填写收货地址后重新保存。", true, false);
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

function hasDraftContent(draft) {
  var items = draft && draft.items ? draft.items : {};
  return Boolean(
    (items.mainRows && items.mainRows.length) ||
    (items.accessories && items.accessories.length) ||
    (items.steels && items.steels.length) ||
    (items.otherTiles && items.otherTiles.length)
  );
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
  authView.hidden = true;
  renderAll();
  showView("dashboardView");
  refreshOrdersFromPreferredSource();
}

window.addEventListener("erp-api-unauthorized", function () {
  logout();
  recordDetail.hidden = true;
  renderAuthGate();
});

window.addEventListener("resize", queueOrderMapResize);

function refreshOrdersFromPreferredSource() {
  loadOrdersWithApiFallback().then(function () {
    renderAll();
  });
}

function showView(viewId) {
  if (!isAuthenticated()) {
    renderAuthGate();
    return;
  }
  if (viewId === "adminView") {
    authView.hidden = true;
    workspaceHeader.hidden = true;
    businessViews.forEach(function (view) { view.hidden = true; });
    adminView.hidden = false;
    adminPage.refreshFromConfig(currentConfig);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  workspaceHeader.hidden = false;
  authView.hidden = true;
  adminView.hidden = true;
  businessViews.forEach(function (view) {
    view.hidden = view.id !== viewId;
  });
  appViewButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-app-view") === viewId);
  });
  if (viewId === "dashboardView") {
    renderDashboard();
    scheduleOrderMapLayout(orderMapState.token, orderMapState.lastPoints);
  }
  if (viewId === "shippingView") shippingPage.recalc();
  if (viewId === "historyView") renderHistory();
  if (viewId === "dataView") renderDataStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  var orders = loadOrders();
  var monthStats = getMonthlyDashboardStats(orders, activeDashboardMonth);
  activeDashboardMonth = monthStats.month;
  if (dashboardMonthInput) dashboardMonthInput.value = activeDashboardMonth;
  var stats = getOrderStats(orders, getDateOnly(new Date()));
  dashboardDateTitle.textContent = activeDashboardMonth + " 订单";
  todayOrderCount.textContent = String(monthStats.count);
  todayOrderAmount.textContent = formatMoney(monthStats.amount);
  todayOrderArea.textContent = formatArea(monthStats.area);
  totalOrderCount.textContent = String(stats.totalCount);
  totalOrderAmount.textContent = formatMoney(stats.totalAmount);
  totalOrderArea.textContent = formatArea(stats.totalArea);
  renderTrend(orders);
  renderOrderMap(orders);
  setEmptyNote(recentOrderEmpty, stats.recentOrders.length === 0);
  recentOrderList.innerHTML = stats.recentOrders.map(function (order) {
    var orderMeta = [
      order.orderDate || "未填写日期",
      formatCompletionMonth(order.completionMonth)
    ];
    if (order.orderNo) orderMeta.push("编号：" + order.orderNo);
    return "<article class='order-card'>" +
      "<div class='order-card-main'><strong class='order-card-title'>" + escapeHtml(getOrderCustomer(order)) + "</strong><span class='order-card-meta'>" + escapeHtml(orderMeta.join(" · ")) + "</span></div>" +
      "<div class='order-card-facts'>" +
      "<div class='order-card-fact'><span class='order-card-label'>面积</span><strong class='order-card-value'>" + escapeHtml(getOrderAreaDisplay(order)) + "</strong></div>" +
      "<div class='order-card-fact'><span class='order-card-label'>颜色</span><strong class='order-card-value'>" + escapeHtml(getOrderColorDisplay(order)) + "</strong></div>" +
      "</div>" +
      "</article>";
  }).join("");
}

function getFilteredOrders() {
  var dateValue = historyDateFilter.value;
  var orderQuery = historyOrderSearch.value.trim().toLowerCase();
  var customerQuery = historyCustomerSearch.value.trim().toLowerCase();
  return loadOrders().filter(function (order) {
    var matchesDate = !dateValue || order.orderDate === dateValue;
    var matchesOrder = !orderQuery || String(order.orderNo || "").toLowerCase().indexOf(orderQuery) !== -1;
    var matchesCustomer = !customerQuery || String(order.customerName || "").toLowerCase().indexOf(customerQuery) !== -1;
    return matchesDate && matchesOrder && matchesCustomer;
  });
}

function renderHistory() {
  var filtered = getFilteredOrders();
  historyCountText.textContent = "共 " + filtered.length + " 条记录";
  setEmptyNote(historyEmpty, filtered.length === 0);
  historyTableBody.innerHTML = filtered.map(function (order) {
    return "<tr>" +
      "<td>" + escapeHtml(order.orderDate) + "</td>" +
      "<td><strong>" + escapeHtml(getOrderTitle(order)) + "</strong></td>" +
      "<td>" + escapeHtml(getOrderCustomer(order)) + "</td>" +
      "<td>" + formatMoney(order.totals.grandAmount) + "</td>" +
      "<td>" + formatArea(order.totals.areaTotal) + "</td>" +
      "<td><div class='history-actions'>" +
      "<button type='button' class='btn btn-neutral compact-btn' data-record-action='view' data-order-id='" + escapeHtml(order.id) + "'>查看</button>" +
      "<button type='button' class='btn btn-soft compact-btn' data-record-action='edit' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-edit'></use></svg><span>编辑</span></button>" +
      "<button type='button' class='btn btn-danger compact-btn' data-record-action='delete' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除</span></button>" +
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
  var disabledContent = "<p class='map-image-note'>当前未连接后端 API，地图展示图片不会保存到 localStorage。</p>";
  var actions = isApiConfigured() ? (
    "<div class='record-actions map-image-actions'>" +
    "<label class='btn btn-soft compact-btn map-image-upload-trigger'><svg class='ui-icon' aria-hidden='true'><use href='#icon-upload'></use></svg><span>上传图片</span><input class='visually-hidden-file' data-map-image-input data-order-id='" + escapedOrderId + "' type='file' accept='image/jpeg,image/png,image/webp' /></label>" +
    "<button type='button' class='btn btn-danger compact-btn' data-map-image-delete data-order-id='" + escapedOrderId + "' disabled><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除图片</span></button>" +
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
    window.alert("当前未连接后端 API，地图展示图片不会保存到 localStorage。");
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
    window.alert(getOrderMapImageErrorMessage(error));
  }).finally(function () {
    setRecordMapImageBusy(id, false);
  });
}

function deleteRecordMapImage(orderId) {
  var id = getOrderMapImageOrderId(orderId);
  if (!id || !isApiConfigured()) return;
  if (!window.confirm("确定删除这张地图展示图片吗？")) return;
  bumpOrderMapImageVersion(id);
  recordMapImagePreviewTokens[id] = (recordMapImagePreviewTokens[id] || 0) + 1;
  setRecordMapImageBusy(id, true);
  setRecordMapImageStatus(id, "删除中", "loading");
  deleteOrderMapImageFromApi(id).then(function () {
    revokeOrderMapImageUrl(id);
    setRecordMapImagePreview(id, "", "暂无图片");
    setRecordMapImageStatus(id, "暂无图片", "idle");
    refreshOpenOrderInfoForOrder(id, "none");
  }).catch(function (error) {
    setRecordMapImageStatus(id, "删除失败", "error");
    window.alert(getOrderMapImageErrorMessage(error));
  }).finally(function () {
    setRecordMapImageBusy(id, false);
  });
}

function renderRecordDetail(order, mode) {
  recordDetail.hidden = false;
  recordDetailTitle.textContent = mode === "edit" ? "编辑订单" : "订单详情";
  recordDetailSubtitle.textContent = getOrderTitle(order) + " · " + order.orderDate;

  if (mode === "edit") {
    recordDetailBody.innerHTML =
      "<form class='record-edit-form' id='recordEditForm' data-order-id='" + escapeHtml(order.id) + "'>" +
      "<div class='form-grid'>" +
      "<label class='field'><span>订单日期</span><input name='orderDate' type='date' value='" + escapeHtml(order.orderDate) + "' required /></label>" +
      "<label class='field'><span>订单编号</span><input name='orderNo' type='text' value='" + escapeHtml(order.orderNo) + "' /></label>" +
      "<label class='field'><span>客户名称</span><input name='customerName' type='text' value='" + escapeHtml(order.customerName) + "' /></label>" +
      "<label class='field'><span>颜色</span><input name='tileColor' type='text' value='" + escapeHtml(order.tileColor) + "' /></label>" +
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
    "<div><span>金额</span><strong>" + formatMoney(order.totals.grandAmount) + " 元</strong></div>" +
    "<div><span>面积</span><strong>" + formatArea(order.totals.areaTotal) + " ㎡</strong></div>" +
    "<div><span>收货地址</span><strong>" + escapeHtml(order.deliveryAddress || "未填写") + "</strong></div>" +
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
    renderItemSection("其他瓦", ["名称", "长度", "数量", "单位", "单价", "小计"], items.otherTiles, function (item) {
      return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.length) + "</td><td>" + escapeHtml(item.qty) + "</td><td>" + escapeHtml(item.unit) + "</td><td>" + formatMoney(item.price) + "</td><td>" + formatMoney(item.subtotal) + "</td></tr>";
    }) +
    "<div class='record-actions'><button type='button' class='btn btn-soft' data-detail-action='edit' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-edit'></use></svg><span>编辑记录</span></button><button type='button' class='btn btn-danger' data-detail-action='delete' data-order-id='" + escapeHtml(order.id) + "'><svg class='ui-icon' aria-hidden='true'><use href='#icon-trash'></use></svg><span>删除记录</span></button></div>";
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
    window.alert("没有找到这条订单记录。");
    renderAll();
    return;
  }
  renderRecordDetail(order, mode || "view");
}

function removeOrder(orderId) {
  var order = findOrder(orderId);
  if (!order) return;
  if (!window.confirm("确定删除订单 " + getOrderTitle(order) + " 吗？")) return;
  deleteOrderWithApiFallback(order.id, order).then(function () {
    recordDetail.hidden = true;
    renderAll();
  }).catch(function () {
    renderAll();
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
  [saveOrderBtn, saveOrderSideBtn].forEach(function (button) {
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
    return updateOrderWithApiFallback(order.id, result.order).then(function (saved) {
      renderAll();
      openRecord(saved.id, "view");
      if (result.warning) window.alert(result.warning);
    });
  }).catch(function (error) {
    window.alert(error.message || "订单保存失败。");
  });
}

function renderDataStatus() {
  var orders = loadOrders();
  var meta = loadBackupMeta();
  dataOrderCount.textContent = String(orders.length);
  dataLastSaved.textContent = formatDateTime(meta.lastSavedAt, "未保存");
  dataLastExported.textContent = formatDateTime(meta.lastExportedAt, "未导出");
  dataLastImported.textContent = formatDateTime(meta.lastImportedAt, "未导入");
}

function setDataStatus(message, isError) {
  dataStatusMessage.textContent = message || "";
  dataStatusMessage.classList.toggle("is-error", Boolean(isError));
  dataStatusMessage.classList.toggle("is-success", Boolean(message && !isError));
}

function renderAll() {
  renderDashboard();
  renderHistory();
  renderDataStatus();
}

function setDashboardMonth(monthKey) {
  activeDashboardMonth = normalizeMonthKey(monthKey);
  renderDashboard();
}

function saveCurrentOrder() {
  var draft = shippingPage.createOrderDraft();
  if (!hasDraftContent(draft)) {
    window.alert("当前没有可保存的主瓦、配件、钢铁材料或其他瓦数据。");
    return;
  }
  var now = new Date();
  var order = normalizeOrder(Object.assign({}, draft, {
    orderNo: draft.orderNo || generateOrderNo(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }));
  setOrderSaveBusy(true);
  resolveOrderLocation(order, null).then(function (result) {
    return upsertOrderWithApiFallback(result.order).then(function (saved) {
      var orderNoInput = document.getElementById("orderNo");
      if (orderNoInput) orderNoInput.value = saved.orderNo;
      renderAll();
      window.alert("订单 " + saved.orderNo + " 已保存。" + (result.warning ? "\n" + result.warning : ""));
    });
  }).catch(function (error) {
    window.alert(error.message || "订单保存失败。");
  }).finally(function () {
    setOrderSaveBusy(false);
  });
}

function downloadTextFile(fileName, content, mimeType) {
  var blob = new Blob([content], { type: mimeType || "application/json" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function exportLocalData() {
  var exportedAt = new Date();
  var meta = saveBackupMeta({ lastExportedAt: exportedAt.toISOString() });
  var payload = buildExportPayload(loadOrders(), currentConfig, meta);
  var stamp = exportedAt.getFullYear() + String(exportedAt.getMonth() + 1).padStart(2, "0") + String(exportedAt.getDate()).padStart(2, "0") + "-" + String(exportedAt.getHours()).padStart(2, "0") + String(exportedAt.getMinutes()).padStart(2, "0");
  downloadTextFile("resin-tile-orders-" + stamp + ".json", JSON.stringify(payload, null, 2), "application/json");
  setDataStatus("已导出 JSON 备份。", false);
  renderDataStatus();
}

function importLocalData(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (event) {
    try {
      var text = String(event.target.result || "");
      var parsed = readImportPayload(text);
      var replace = window.confirm("导入文件包含 " + parsed.orders.length + " 条订单。\n\n选择“确定”将覆盖当前数据；选择“取消”将与当前数据合并。");
      var result = importOrdersFromPayload(parsed, replace ? "replace" : "merge");
      if (result.settings && window.confirm("导入文件包含系统配置，是否一并恢复？")) {
        saveConfig(result.settings);
        currentConfig = loadConfig();
        shippingPage.applyConfig(currentConfig);
        adminPage.refreshFromConfig(currentConfig);
      }
      setDataStatus("已导入 " + result.importedCount + " 条订单。", false);
      recordDetail.hidden = true;
      renderAll();
    } catch (error) {
      setDataStatus(error.message || "导入失败，请检查 JSON 文件。", true);
      window.alert(error.message || "导入失败，请检查 JSON 文件。");
    } finally {
      importDataFile.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

document.addEventListener("click", function (event) {
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
  logout();
  renderAuthGate();
});
backToShipping.addEventListener("click", function () { showView("shippingView"); });
saveOrderBtn.addEventListener("click", saveCurrentOrder);
saveOrderSideBtn.addEventListener("click", saveCurrentOrder);

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

trendRangeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTrendRange = button.getAttribute("data-trend-range") || "7d";
    renderDashboard();
  });
});

if (orderMapRetry) {
  orderMapRetry.addEventListener("click", retryOrderMapLoad);
}

[historyDateFilter, historyOrderSearch, historyCustomerSearch].forEach(function (input) {
  input.addEventListener("input", renderHistory);
});

resetHistoryFilters.addEventListener("click", function () {
  historyDateFilter.value = "";
  historyOrderSearch.value = "";
  historyCustomerSearch.value = "";
  renderHistory();
});

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

clearAllOrdersBtn.addEventListener("click", function () {
  if (!window.confirm("确定清空全部订单数据吗？此操作不可撤销。")) return;
  if (!window.confirm("请再次确认：清空后只能通过之前导出的 JSON 备份恢复。")) return;
  clearOrdersWithApiFallback().then(function () {
    recordDetail.hidden = true;
    renderAll();
  }).catch(function (error) {
    console.warn("Order bulk clear failed.", {
      reason: error && error.message ? error.message : String(error || "Unknown error")
    });
    renderAll();
  });
});

exportDataBtn.addEventListener("click", exportLocalData);
importDataFile.addEventListener("change", function (event) {
  var file = event.target.files && event.target.files[0];
  importLocalData(file);
});

subscribeConfigChange(function (nextConfig) {
  currentConfig = nextConfig;
  shippingPage.applyConfig(currentConfig);
  if (isAuthenticated()) renderDashboard();
});

if (isAuthenticated()) {
  enterApplication();
} else {
  renderAuthGate();
}
