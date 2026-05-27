import { initAdminPage } from "./components/admin/adminPage.js";
import { initShippingPage } from "./components/shipping/shippingPage.js";
import {
  hasAuthSetup,
  isAuthenticated,
  loginWithPassword,
  logout,
  setupPassword
} from "./services/authService.js";
import { loadConfig, saveConfig, subscribeConfigChange } from "./services/configService.js";
import {
  buildExportPayload,
  clearOrders,
  deleteOrder,
  generateOrderNo,
  getDateOnly,
  getOrderStats,
  getOrderTrend,
  importOrdersFromPayload,
  loadBackupMeta,
  loadOrders,
  normalizeOrder,
  readImportPayload,
  saveBackupMeta,
  upsertOrder
} from "./services/orderService.js";
import { escapeHtml, formatMoney, formatNum, parseNum } from "./utils.js";

var currentConfig = loadConfig();
var authView = document.getElementById("authView");
var authForm = document.getElementById("authForm");
var authTitle = document.getElementById("authTitle");
var authSubtitle = document.getElementById("authSubtitle");
var authPassword = document.getElementById("authPassword");
var authConfirmField = document.getElementById("authConfirmField");
var authConfirmPassword = document.getElementById("authConfirmPassword");
var authSubmit = document.getElementById("authSubmit");
var authStatus = document.getElementById("authStatus");
var workspaceHeader = document.getElementById("workspaceHeader");
var appViewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-app-view]"));
var businessViews = Array.prototype.slice.call(document.querySelectorAll(".business-view"));
var shippingView = document.getElementById("shippingView");
var adminView = document.getElementById("adminView");
var adminToggle = document.getElementById("adminToggle");
var adminTopToggle = document.getElementById("adminTopToggle");
var logoutButton = document.getElementById("logoutButton");
var backToShipping = document.getElementById("backToShipping");
var saveOrderBtn = document.getElementById("saveOrder");
var saveOrderSideBtn = document.getElementById("saveOrderSide");

var dashboardDateTitle = document.getElementById("dashboardDateTitle");
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
  var bounds = { left: 52, right: 48, top: 28, bottom: 56 };
  bounds.width = 920 - bounds.left - bounds.right;
  bounds.height = 320 - bounds.top - bounds.bottom;
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
    return "<text class='chart-label' x='" + chartPoint.x.toFixed(2) + "' y='298' text-anchor='middle'>" + escapeHtml(point.label) + "</text>";
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

function setEmptyNote(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("is-visible", Boolean(visible));
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

function renderAuthGate() {
  var setupMode = !hasAuthSetup();
  authView.hidden = false;
  workspaceHeader.hidden = true;
  adminView.hidden = true;
  businessViews.forEach(function (view) { view.hidden = true; });
  authTitle.textContent = setupMode ? "设置登录密码" : "登录系统";
  authSubtitle.textContent = setupMode ? "第一次使用需要先设置本机密码。密码只保存在当前浏览器。" : "请输入本机密码后继续使用。";
  authConfirmField.hidden = !setupMode;
  authPassword.setAttribute("autocomplete", setupMode ? "new-password" : "current-password");
  authSubmit.querySelector("span").textContent = setupMode ? "设置并进入" : "进入系统";
  authStatus.textContent = "";
  authStatus.classList.remove("is-error", "is-success");
  authPassword.value = "";
  authConfirmPassword.value = "";
  setTimeout(function () { authPassword.focus(); }, 0);
}

function enterApplication() {
  authView.hidden = true;
  renderAll();
  showView("dashboardView");
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
  if (viewId === "shippingView") shippingPage.recalc();
  if (viewId === "historyView") renderHistory();
  if (viewId === "dataView") renderDataStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  var orders = loadOrders();
  var today = getDateOnly(new Date());
  var stats = getOrderStats(orders, today);
  dashboardDateTitle.textContent = today + " 订单";
  todayOrderCount.textContent = String(stats.todayCount);
  todayOrderAmount.textContent = formatMoney(stats.todayAmount);
  todayOrderArea.textContent = formatArea(stats.todayArea);
  totalOrderCount.textContent = String(stats.totalCount);
  totalOrderAmount.textContent = formatMoney(stats.totalAmount);
  totalOrderArea.textContent = formatArea(stats.totalArea);
  renderTrend(orders);
  setEmptyNote(recentOrderEmpty, stats.recentOrders.length === 0);
  recentOrderList.innerHTML = stats.recentOrders.map(function (order) {
    return "<article class='order-card'>" +
      "<div><strong>" + escapeHtml(getOrderTitle(order)) + "</strong><span>" + escapeHtml(getOrderCustomer(order)) + " · " + escapeHtml(order.orderDate) + "</span></div>" +
      "<div class='order-card-metrics'><span>" + formatMoney(order.totals.grandAmount) + " 元</span><span>" + formatArea(order.totals.areaTotal) + " ㎡</span></div>" +
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
      "<label class='field span-2'><span>备注</span><input name='remark' type='text' value='" + escapeHtml(order.remark) + "' /></label>" +
      "<label class='field'><span>总面积</span><input name='areaTotal' type='number' step='0.0001' value='" + escapeHtml(order.totals.areaTotal) + "' /></label>" +
      "<label class='field'><span>主瓦金额</span><input name='mainAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.mainAmount) + "' /></label>" +
      "<label class='field'><span>配件金额</span><input name='accessoryAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.accessoryAmount) + "' /></label>" +
      "<label class='field'><span>钢铁材料</span><input name='steelAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.steelAmount) + "' /></label>" +
      "<label class='field'><span>其他瓦金额</span><input name='otherTileAmount' type='number' step='0.01' value='" + escapeHtml(order.totals.otherTileAmount) + "' /></label>" +
      "</div>" +
      "<div class='record-actions'><button type='submit' class='btn btn-primary'><svg class='ui-icon' aria-hidden='true'><use href='#icon-save'></use></svg><span>保存编辑</span></button><button type='button' class='btn btn-neutral' data-detail-action='view' data-order-id='" + escapeHtml(order.id) + "'>取消</button></div>" +
      "</form>";
    return;
  }

  var items = order.items;
  recordDetailBody.innerHTML =
    "<div class='detail-summary'>" +
    "<div><span>客户</span><strong>" + escapeHtml(getOrderCustomer(order)) + "</strong></div>" +
    "<div><span>颜色</span><strong>" + escapeHtml(order.tileColor || "未填写") + "</strong></div>" +
    "<div><span>金额</span><strong>" + formatMoney(order.totals.grandAmount) + " 元</strong></div>" +
    "<div><span>面积</span><strong>" + formatArea(order.totals.areaTotal) + " ㎡</strong></div>" +
    "</div>" +
    (order.remark ? "<p class='detail-remark'>" + escapeHtml(order.remark) + "</p>" : "") +
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
}

function findOrder(orderId) {
  return loadOrders().find(function (order) { return order.id === orderId; });
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
  deleteOrder(orderId);
  recordDetail.hidden = true;
  renderAll();
}

function saveRecordEdit(form) {
  var order = findOrder(form.getAttribute("data-order-id"));
  if (!order) return;
  var updated = normalizeOrder(Object.assign({}, order, {
    orderDate: form.elements.orderDate.value,
    orderNo: form.elements.orderNo.value,
    customerName: form.elements.customerName.value,
    tileColor: form.elements.tileColor.value,
    remark: form.elements.remark.value,
    totals: {
      areaTotal: parseNum(form.elements.areaTotal.value),
      mainAmount: parseNum(form.elements.mainAmount.value),
      accessoryAmount: parseNum(form.elements.accessoryAmount.value),
      steelAmount: parseNum(form.elements.steelAmount.value),
      otherTileAmount: parseNum(form.elements.otherTileAmount.value)
    }
  }));
  upsertOrder(updated);
  renderAll();
  openRecord(updated.id, "view");
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
  var saved = upsertOrder(order);
  var orderNoInput = document.getElementById("orderNo");
  if (orderNoInput) orderNoInput.value = saved.orderNo;
  renderAll();
  window.alert("订单 " + saved.orderNo + " 已保存。");
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

authForm.addEventListener("submit", function (event) {
  event.preventDefault();
  var setupMode = !hasAuthSetup();
  authSubmit.disabled = true;
  authStatus.textContent = setupMode ? "正在设置密码..." : "正在登录...";
  authStatus.classList.remove("is-error");
  authStatus.classList.add("is-success");
  (setupMode ? setupPassword(authPassword.value, authConfirmPassword.value) : loginWithPassword(authPassword.value))
    .then(function () {
      enterApplication();
    })
    .catch(function (error) {
      authStatus.textContent = error.message || "登录失败，请重试。";
      authStatus.classList.add("is-error");
      authStatus.classList.remove("is-success");
    })
    .finally(function () {
      authSubmit.disabled = false;
    });
});

if (adminToggle) adminToggle.addEventListener("click", function () { showView("adminView"); });
if (adminTopToggle) adminTopToggle.addEventListener("click", function () { showView("adminView"); });
logoutButton.addEventListener("click", function () {
  logout();
  renderAuthGate();
});
backToShipping.addEventListener("click", function () { showView("shippingView"); });
saveOrderBtn.addEventListener("click", saveCurrentOrder);
saveOrderSideBtn.addEventListener("click", saveCurrentOrder);

trendRangeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTrendRange = button.getAttribute("data-trend-range") || "7d";
    renderDashboard();
  });
});

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
  var button = event.target.closest("[data-detail-action]");
  if (!button) return;
  var action = button.getAttribute("data-detail-action");
  var orderId = button.getAttribute("data-order-id");
  if (action === "delete") removeOrder(orderId);
  if (action === "view") openRecord(orderId, "view");
  if (action === "edit") openRecord(orderId, "edit");
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
  clearOrders();
  recordDetail.hidden = true;
  renderAll();
});

exportDataBtn.addEventListener("click", exportLocalData);
importDataFile.addEventListener("change", function (event) {
  var file = event.target.files && event.target.files[0];
  importLocalData(file);
});

subscribeConfigChange(function (nextConfig) {
  currentConfig = nextConfig;
  shippingPage.applyConfig(currentConfig);
});

if (isAuthenticated()) {
  enterApplication();
} else {
  renderAuthGate();
}
