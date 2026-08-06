import {
  cloneConfig,
  createConfigId,
  exportConfigJson,
  resetConfig,
  saveConfigWithApiFallback,
  validateConfig
} from "../../services/configService.js";
import { fetchAuditLogsFromApi, isApiConfigured } from "../../services/apiClient.js";
import { escapeHtml } from "../../utils.js";
import { confirmAction, showToast } from "../common/feedback.js";
import { enterElement } from "../common/motion.js";

function sortBySort(items) {
  return (Array.isArray(items) ? items : []).slice().sort(function (a, b) {
    return Number(a.sort || 0) - Number(b.sort || 0);
  });
}

function pathParts(path) {
  return String(path || "").split(".").filter(Boolean);
}

function getByPath(source, path) {
  return pathParts(path).reduce(function (value, part) {
    return value && value[part];
  }, source);
}

function setByPath(source, path, value) {
  var parts = pathParts(path);
  var target = source;
  parts.slice(0, -1).forEach(function (part) {
    if (!target[part]) target[part] = {};
    target = target[part];
  });
  target[parts[parts.length - 1]] = value;
}

function getInputValue(input) {
  if (input.type === "checkbox") return input.checked;
  if (input.dataset.valueType === "number") {
    if (input.value === "") return null;
    return Number(input.value);
  }
  return input.value;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getMaxSort(items) {
  return (Array.isArray(items) ? items : []).reduce(function (max, item) {
    return Math.max(max, Number(item.sort || 0));
  }, 0);
}

function getCollectionPrefix(path) {
  return String(path || "").replace(/\./g, "-") || "item";
}

function createCatalogItem(path, draft) {
  var base = {
    id: createConfigId(getCollectionPrefix(path)),
    name: "",
    defaultUnit: path === "otherTiles" ? "片" : "件",
    defaultPrice: null,
    sort: getMaxSort(getByPath(draft, path)) + 10,
    enabled: true
  };
  if (path === "accessories") base.common = true;
  if (path === "steel.materials") base.spec = "";
  return base;
}

function formatPrice(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? "" : String(value);
}

var AUDIT_ACTION_LABELS = {
  ORDER_CREATE: "新建订单",
  ORDER_UPDATE: "修改订单",
  ORDER_DELETE: "删除订单"
};

export function getAuditActionLabel(action) {
  return AUDIT_ACTION_LABELS[String(action || "")] || String(action || "未知操作");
}

function formatAuditValue(field, value) {
  if (field === "grandAmount") return "¥" + (Number(value) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (field === "areaTotal") return (Number(value) || 0).toLocaleString("zh-CN", { maximumFractionDigits: 4 }) + "㎡";
  return String(value === null || value === undefined || value === "" ? "未填写" : value);
}

export function summarizeAuditLog(log) {
  var source = log || {};
  var before = source.before || {};
  var after = source.after || {};
  if (source.action === "ORDER_CREATE") {
    return "客户：" + formatAuditValue("customerName", after.customerName) + "；金额：" + formatAuditValue("grandAmount", after.grandAmount);
  }
  if (source.action === "ORDER_DELETE") {
    return "删除客户“" + formatAuditValue("customerName", before.customerName) + "”的订单，金额 " + formatAuditValue("grandAmount", before.grandAmount);
  }
  if (source.action === "ORDER_UPDATE") {
    var fields = [
      ["customerName", "客户"], ["orderDate", "日期"], ["deliveryAddress", "地址"],
      ["areaTotal", "面积"], ["grandAmount", "金额"]
    ];
    var changes = fields.filter(function (item) {
      return String(before[item[0]] === undefined ? "" : before[item[0]]) !== String(after[item[0]] === undefined ? "" : after[item[0]]);
    }).map(function (item) {
      return item[1] + "：" + formatAuditValue(item[0], before[item[0]]) + " → " + formatAuditValue(item[0], after[item[0]]);
    });
    return changes.length ? changes.join("；") : "更新了订单明细或关联信息";
  }
  return "记录了该操作";
}

function formatAuditTime(value) {
  var date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function getAuditActorName(log) {
  var actor = log && log.actor ? log.actor : {};
  return actor.displayName || actor.username || "未知操作人";
}

function renderAuditPanel(state) {
  var source = state || {};
  var actionOptions = [
    ["", "全部操作"], ["ORDER_CREATE", "新建订单"], ["ORDER_UPDATE", "修改订单"], ["ORDER_DELETE", "删除订单"]
  ].map(function (item) {
    return "<option value='" + item[0] + "'" + (source.action === item[0] ? " selected" : "") + ">" + item[1] + "</option>";
  }).join("");
  var body;
  if (source.localOnly) {
    body = "<div class='empty-note'>本机模式没有服务器审计日志。连接后端 API 后可查询操作记录。</div>";
  } else if (source.loading) {
    body = "<div class='empty-note'>正在读取审计记录...</div>";
  } else if (source.error) {
    body = "<div class='empty-note audit-error'>" + escapeHtml(source.error) + "</div>";
  } else if (!source.logs.length) {
    body = "<div class='empty-note'>暂无符合条件的审计记录</div>";
  } else {
    body = "<div class='admin-table-wrap'><table class='admin-table audit-table'><caption class='sr-only'>订单操作审计记录</caption><thead><tr><th scope='col'>时间</th><th scope='col'>操作人</th><th scope='col'>动作</th><th scope='col'>对象</th><th scope='col'>变更摘要</th><th scope='col'>来源 IP</th></tr></thead><tbody>" + source.logs.map(function (log) {
      var metadata = log.metadata || {};
      var target = metadata.orderNo || log.entityId || "—";
      return "<tr><td class='audit-time'>" + escapeHtml(formatAuditTime(log.createdAt)) + "</td>" +
        "<td><strong>" + escapeHtml(getAuditActorName(log)) + "</strong><small>" + escapeHtml(log.actor && log.actor.username || "") + "</small></td>" +
        "<td><span class='audit-action' data-action='" + escapeHtml(log.action) + "'>" + escapeHtml(getAuditActionLabel(log.action)) + "</span></td>" +
        "<td class='audit-target'>" + escapeHtml(target) + "</td>" +
        "<td class='audit-summary'>" + escapeHtml(summarizeAuditLog(log)) + "</td>" +
        "<td class='audit-ip'>" + escapeHtml(log.ipAddress || "—") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  var pagination = source.pagination || { page: 1, totalPages: 1, total: 0 };
  return "<section class='admin-section audit-section'><div class='admin-section-head'><div><h3>操作审计</h3><p>记录订单的新建、修改和删除，审计内容只读且仅管理员可见。</p></div><button type='button' class='btn btn-neutral' id='auditRefresh'>刷新</button></div>" +
    "<div class='audit-toolbar'><label class='field'><span>操作类型</span><select id='auditActionFilter'>" + actionOptions + "</select></label><span>共 " + Number(pagination.total || 0) + " 条记录</span></div>" + body +
    "<div class='history-pagination audit-pagination'" + (source.localOnly || pagination.totalPages <= 1 ? " hidden" : "") + "><button type='button' class='btn btn-neutral compact-btn' id='auditPrevPage'" + (pagination.page <= 1 ? " disabled" : "") + ">上一页</button><span>第 " + pagination.page + " / " + pagination.totalPages + " 页</span><button type='button' class='btn btn-neutral compact-btn' id='auditNextPage'" + (pagination.page >= pagination.totalPages ? " disabled" : "") + ">下一页</button></div></section>";
}

function renderOptionRows(draft, path, numericValue) {
  return sortBySort(getByPath(draft, path)).map(function (item) {
    return "<tr data-collection='" + escapeHtml(path) + "' data-id='" + escapeHtml(item.id) + "'>" +
      "<td><input class='admin-input' aria-label='选项值' data-item-field='value' data-value-type='" + (numericValue ? "number" : "text") + "' type='" + (numericValue ? "number" : "text") + "' step='0.001' value='" + escapeHtml(item.value) + "' /></td>" +
      "<td><input class='admin-input compact' aria-label='排序' data-item-field='sort' data-value-type='number' type='number' step='1' value='" + escapeHtml(item.sort) + "' /></td>" +
      "<td><label class='admin-switch'><input data-item-field='enabled' type='checkbox'" + (item.enabled !== false ? " checked" : "") + " /><span>启用</span></label></td>" +
      "<td class='admin-row-actions'><button type='button' class='icon-btn admin-move' data-move='-1' title='上移' aria-label='上移'>↑</button><button type='button' class='icon-btn admin-move' data-move='1' title='下移' aria-label='下移'>↓</button><button type='button' class='icon-btn admin-delete' title='删除' aria-label='删除'>×</button></td>" +
      "</tr>";
  }).join("");
}

function renderCatalogRows(draft, path, type) {
  return sortBySort(getByPath(draft, path)).map(function (item) {
    var specCell = type === "steel" ? "<td><input class='admin-input' aria-label='规格' data-item-field='spec' type='text' value='" + escapeHtml(item.spec || "") + "' /></td>" : "";
    var commonCell = type === "accessory" ? "<td><label class='admin-switch'><input data-item-field='common' type='checkbox'" + (item.common ? " checked" : "") + " /><span>常用</span></label></td>" : "";
    return "<tr data-collection='" + escapeHtml(path) + "' data-id='" + escapeHtml(item.id) + "'>" +
      "<td><input class='admin-input' aria-label='名称' data-item-field='name' type='text' value='" + escapeHtml(item.name) + "' /></td>" +
      specCell +
      "<td><input class='admin-input compact' aria-label='默认单位' data-item-field='defaultUnit' type='text' list='unitOptions' value='" + escapeHtml(item.defaultUnit) + "' /></td>" +
      "<td><input class='admin-input compact' aria-label='默认单价' data-item-field='defaultPrice' data-value-type='number' type='number' min='0' step='0.01' value='" + escapeHtml(formatPrice(item.defaultPrice)) + "' /></td>" +
      commonCell +
      "<td><input class='admin-input compact' aria-label='排序' data-item-field='sort' data-value-type='number' type='number' step='1' value='" + escapeHtml(item.sort) + "' /></td>" +
      "<td><label class='admin-switch'><input data-item-field='enabled' type='checkbox'" + (item.enabled !== false ? " checked" : "") + " /><span>启用</span></label></td>" +
      "<td class='admin-row-actions'><button type='button' class='icon-btn admin-move' data-move='-1' title='上移' aria-label='上移'>↑</button><button type='button' class='icon-btn admin-move' data-move='1' title='下移' aria-label='下移'>↓</button><button type='button' class='icon-btn admin-delete' title='删除' aria-label='删除'>×</button></td>" +
      "</tr>";
  }).join("");
}

function renderOptionSection(draft, title, path, valueLabel, numericValue) {
  return "<section class='admin-section'><div class='admin-section-head'><h3>" + escapeHtml(title) + "</h3><button type='button' class='btn btn-soft' data-add-option='" + escapeHtml(path) + "'>新增</button></div>" +
    "<div class='admin-table-wrap'><table class='admin-table'><caption class='sr-only'>" + escapeHtml(title) + "</caption><thead><tr><th scope='col'>" + escapeHtml(valueLabel) + "</th><th scope='col'>排序</th><th scope='col'>状态</th><th scope='col'>操作</th></tr></thead><tbody>" + renderOptionRows(draft, path, numericValue) + "</tbody></table></div></section>";
}

function renderCatalogSection(draft, title, path, type) {
  var specHead = type === "steel" ? "<th scope='col'>规格</th>" : "";
  var commonHead = type === "accessory" ? "<th scope='col'>常用</th>" : "";
  return "<section class='admin-section'><div class='admin-section-head'><h3>" + escapeHtml(title) + "</h3><button type='button' class='btn btn-soft' data-add-catalog='" + escapeHtml(path) + "'>新增</button></div>" +
    "<div class='admin-table-wrap'><table class='admin-table'><caption class='sr-only'>" + escapeHtml(title) + "</caption><thead><tr><th scope='col'>名称</th>" + specHead + "<th scope='col'>单位</th><th scope='col'>默认单价</th>" + commonHead + "<th scope='col'>排序</th><th scope='col'>状态</th><th scope='col'>操作</th></tr></thead><tbody>" + renderCatalogRows(draft, path, type) + "</tbody></table></div></section>";
}

function renderDefaultSegmentOptions(draft) {
  return sortBySort(draft.basics.segmentLengths).map(function (item) {
    var value = String(item.value);
    var selected = Number(value) === Number(draft.basics.defaultSegmentLength) ? " selected" : "";
    return "<option value='" + escapeHtml(value) + "'" + selected + ">" + escapeHtml(value) + "</option>";
  }).join("");
}

function renderLogoPreview(draft) {
  if (!draft.basics.defaultLogo) return "<div class='logo-preview is-empty'>未设置</div>";
  return "<div class='logo-preview'><img src='" + draft.basics.defaultLogo + "' alt='默认 Logo' /></div>";
}

var ADMIN_CATEGORIES = [
  ["basics", "基础资料"], ["map", "地图设置"], ["products", "产品选项"],
  ["steel", "钢材配置"], ["reports", "报表模板"], ["audit", "审计记录"], ["data", "数据管理"]
];

function renderAdminNav(activeCategory) {
  return "<nav class='admin-category-nav' aria-label='管理分类'>" + ADMIN_CATEGORIES.map(function (item) {
    return "<button type='button' class='admin-category-btn" + (activeCategory === item[0] ? " active" : "") + "' data-admin-category='" + item[0] + "'" + (activeCategory === item[0] ? " aria-current='page'" : "") + ">" + item[1] + "</button>";
  }).join("") + "</nav>";
}

function renderCategoryPanel(id, activeCategory, content) {
  return "<div class='admin-category-panel' data-admin-category-panel='" + id + "'" + (id === activeCategory ? "" : " hidden") + ">" + content + "</div>";
}

function renderAdmin(draft, activeCategory, isAdmin, auditState) {
  var basics = "<section class='admin-section'><div class='admin-section-head'><h3>基础参数</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>固定宽度（米）</span><input data-field='basics.fixedWidth' data-value-type='number' type='number' min='0.001' step='0.001' value='" + escapeHtml(draft.basics.fixedWidth) + "' /></label>" +
    "<label class='field'><span>默认节长</span><select data-field='basics.defaultSegmentLength' data-value-type='number'>" + renderDefaultSegmentOptions(draft) + "</select></label>" +
    "<label class='field'><span>主瓦默认单价</span><input data-field='basics.mainTileDefaultPrice' data-value-type='number' type='number' min='0' step='0.01' value='" + escapeHtml(formatPrice(draft.basics.mainTileDefaultPrice)) + "' /></label>" +
    "<label class='field'><span>公司名称</span><input data-field='basics.companyName' type='text' value='" + escapeHtml(draft.basics.companyName) + "' /></label>" +
    "<label class='field span-3'><span>地址</span><input data-field='basics.address' type='text' value='" + escapeHtml(draft.basics.address) + "' /></label>" +
    "<label class='field span-3'><span>电话</span><input data-field='basics.phone' type='text' value='" + escapeHtml(draft.basics.phone) + "' /></label>" +
    "<div class='field span-3'><span>默认 Logo</span><div class='admin-logo-row'>" + renderLogoPreview(draft) + "<input id='adminLogoUpload' type='file' accept='image/*' /><button type='button' class='btn btn-neutral' id='adminClearLogo'>清除 Logo</button></div></div>" +
    "</div></section>";
  var map = "<section class='admin-section'><div class='admin-section-head'><h3>地图设置</h3></div><div class='admin-form-grid'>" +
    "<div class='field'><span>首页订单地图</span><label class='admin-switch'><input data-field='mapSettings.enabled' type='checkbox'" + (draft.mapSettings.enabled ? " checked" : "") + " /><span>启用</span></label></div>" +
    "<label class='field'><span>高德 JS API Key</span><input data-field='mapSettings.amapKey' type='text' value='" + escapeHtml(draft.mapSettings.amapKey) + "' autocomplete='off' /></label>" +
    "<label class='field'><span>安全密钥 securityJsCode</span><input data-field='mapSettings.securityJsCode' type='text' value='" + escapeHtml(draft.mapSettings.securityJsCode) + "' autocomplete='off' /></label>" +
    "<label class='field'><span>默认解析城市 / adcode</span><input data-field='mapSettings.geocodeCity' type='text' value='" + escapeHtml(draft.mapSettings.geocodeCity) + "' placeholder='留空按全国解析' /></label>" +
    "<label class='field span-2'><span>地图样式</span><input data-field='mapSettings.mapStyle' type='text' value='" + escapeHtml(draft.mapSettings.mapStyle) + "' placeholder='amap://styles/whitesmoke' /></label></div></section>";
  var products = renderOptionSection(draft, "可选节长", "basics.segmentLengths", "节长", true) + renderOptionSection(draft, "配送方式", "basics.deliveryMethods", "方式", false) + renderOptionSection(draft, "镀锌工艺", "basics.galvanizingProcesses", "工艺", false) + renderOptionSection(draft, "默认颜色选项", "basics.colorOptions", "颜色", false) + renderOptionSection(draft, "单位选项", "unitOptions", "单位", false) + renderCatalogSection(draft, "配件管理", "accessories", "accessory") + renderCatalogSection(draft, "其他瓦 / 特殊瓦", "otherTiles", "other");
  var steel = "<section class='admin-section'><div class='admin-section-head'><h3>钢铁快捷项</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>方管名称</span><input data-field='steel.tubeMaterialName' type='text' value='" + escapeHtml(draft.steel.tubeMaterialName) + "' /></label><label class='field'><span>方管默认单位</span><input data-field='steel.tubeDefaultUnit' type='text' list='unitOptions' value='" + escapeHtml(draft.steel.tubeDefaultUnit) + "' /></label>" +
    "<label class='field'><span>膨胀螺丝名称</span><input data-field='steel.boltMaterialName' type='text' value='" + escapeHtml(draft.steel.boltMaterialName) + "' /></label><label class='field'><span>膨胀螺丝默认单位</span><input data-field='steel.boltDefaultUnit' type='text' list='unitOptions' value='" + escapeHtml(draft.steel.boltDefaultUnit) + "' /></label></div></section>" + renderCatalogSection(draft, "钢铁材料预设", "steel.materials", "steel") + renderOptionSection(draft, "方管规格", "steel.tubeSpecs", "规格", false) + renderOptionSection(draft, "方管厚度", "steel.thicknessOptions", "厚度", true) + renderOptionSection(draft, "膨胀螺丝规格", "steel.boltSpecs", "规格", false);
  var reports = "<section class='admin-section'><div class='admin-section-head'><h3>报表模板</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>综合报表标题</span><input data-field='reportTemplate.mainTitle' type='text' value='" + escapeHtml(draft.reportTemplate.mainTitle) + "' /></label><label class='field'><span>配件报表标题</span><input data-field='reportTemplate.accessoryTitle' type='text' value='" + escapeHtml(draft.reportTemplate.accessoryTitle) + "' /></label><label class='field'><span>钢铁报表标题</span><input data-field='reportTemplate.steelTitle' type='text' value='" + escapeHtml(draft.reportTemplate.steelTitle) + "' /></label>" +
    "<label class='field'><span>屋面材料标题</span><input data-field='reportTemplate.roofMaterialTitle' type='text' value='" + escapeHtml(draft.reportTemplate.roofMaterialTitle) + "' /></label><label class='field'><span>其他瓦标题</span><input data-field='reportTemplate.otherTileTitle' type='text' value='" + escapeHtml(draft.reportTemplate.otherTileTitle) + "' /></label><label class='field'><span>地址标签</span><input data-field='reportTemplate.addressLabel' type='text' value='" + escapeHtml(draft.reportTemplate.addressLabel) + "' /></label><label class='field'><span>电话标签</span><input data-field='reportTemplate.phoneLabel' type='text' value='" + escapeHtml(draft.reportTemplate.phoneLabel) + "' /></label>" +
    "<label class='field span-3'><span>温馨提示</span><textarea data-field='reportTemplate.warmTip' rows='3'>" + escapeHtml(draft.reportTemplate.warmTip) + "</textarea></label><label class='field span-3'><span>签字栏文字</span><input data-field='reportTemplate.signatureLabel' type='text' value='" + escapeHtml(draft.reportTemplate.signatureLabel) + "' /></label><label class='field span-3'><span>日期栏文字</span><input data-field='reportTemplate.receiptDateLabel' type='text' value='" + escapeHtml(draft.reportTemplate.receiptDateLabel) + "' /></label><label class='field span-3'><span>钢铁工艺文字</span><input data-field='reportTemplate.steelProcessText' type='text' value='" + escapeHtml(draft.reportTemplate.steelProcessText) + "' /></label></div></section>";
  var data = "<section class='admin-section danger-zone'><div class='admin-section-head'><h3>危险操作</h3></div><p>清空订单会同时尝试删除服务器与本机记录，失败的服务器记录将保留。</p>" + (isAdmin ? "<button type='button' class='btn btn-danger' id='adminClearOrders'>清空全部订单</button>" : "<p>当前账号没有数据清理权限。</p>") + "</section>";
  var configActions = activeCategory === "audit" ? "" : "<div class='admin-actions-bar'><button type='button' class='btn btn-primary' id='adminSave'>保存配置</button><button type='button' class='btn btn-neutral' id='adminExport'>导出配置 JSON</button><button type='button' class='btn btn-danger' id='adminReset'>恢复默认配置</button></div>";
  return configActions + "<div class='admin-status' id='adminStatus' role='status'></div><div class='admin-workspace'>" + renderAdminNav(activeCategory) + "<div class='admin-category-content'>" + renderCategoryPanel("basics", activeCategory, basics) + renderCategoryPanel("map", activeCategory, map) + renderCategoryPanel("products", activeCategory, products) + renderCategoryPanel("steel", activeCategory, steel) + renderCategoryPanel("reports", activeCategory, reports) + renderCategoryPanel("audit", activeCategory, renderAuditPanel(auditState)) + renderCategoryPanel("data", activeCategory, data) + "</div></div>";
}

export function initAdminPage(options) {
  var getConfig = options.getConfig;
  var isAdmin = typeof options.isAdmin === "function" ? options.isAdmin : function () { return true; };
  var onClearOrders = typeof options.onClearOrders === "function" ? options.onClearOrders : function () { return Promise.resolve(false); };
  var root = document.getElementById("adminRoot");
  var draft = cloneConfig(getConfig());
  var isSavingConfig = false;
  var activeCategory = "basics";
  var auditState = {
    logs: [],
    action: "",
    loading: false,
    error: "",
    localOnly: !isApiConfigured(),
    loaded: false,
    pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 }
  };

  function showStatus(message, isError) {
    var status = document.getElementById("adminStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
    status.classList.toggle("is-success", Boolean(message && !isError));
  }

  function render() {
    root.innerHTML = renderAdmin(draft, activeCategory, isAdmin(), auditState);
    enterElement(root.querySelector("[data-admin-category-panel]:not([hidden])"));
  }

  function loadAuditRecords(force) {
    auditState.localOnly = !isApiConfigured();
    if (auditState.localOnly) {
      auditState.loading = false;
      auditState.loaded = true;
      auditState.logs = [];
      render();
      return Promise.resolve(auditState);
    }
    if (auditState.loading || (auditState.loaded && !force)) return Promise.resolve(auditState);
    auditState.loading = true;
    auditState.error = "";
    render();
    return fetchAuditLogsFromApi({
      page: auditState.pagination.page,
      pageSize: auditState.pagination.pageSize,
      action: auditState.action,
      entityType: "ORDER"
    }).then(function (payload) {
      auditState.logs = payload && Array.isArray(payload.logs) ? payload.logs : [];
      auditState.pagination = payload && payload.pagination ? payload.pagination : auditState.pagination;
      auditState.loaded = true;
    }).catch(function (error) {
      auditState.error = error && error.message ? error.message : "审计记录读取失败。";
      auditState.logs = [];
    }).finally(function () {
      auditState.loading = false;
      render();
    });
  }

  function setSaveBusy(isBusy) {
    var saveButton = document.getElementById("adminSave");
    if (!saveButton) return;
    saveButton.disabled = Boolean(isBusy);
    saveButton.textContent = isBusy ? "保存中..." : "保存配置";
  }

  function updateSimpleField(target) {
    var value = getInputValue(target);
    if (target.dataset.field === "basics.mainTileDefaultPrice") value = nullableNumber(target.value);
    setByPath(draft, target.dataset.field, value);
  }

  function findItem(path, id) {
    var list = getByPath(draft, path) || [];
    return list.find(function (item) { return item.id === id; });
  }

  function updateItemField(target) {
    var row = target.closest("[data-collection]");
    if (!row) return;
    var item = findItem(row.dataset.collection, row.dataset.id);
    if (!item) return;
    var field = target.dataset.itemField;
    var value = getInputValue(target);
    if (field === "defaultPrice") value = nullableNumber(target.value);
    item[field] = value;
  }

  function addOption(path) {
    var list = getByPath(draft, path);
    list.push({
      id: createConfigId(getCollectionPrefix(path)),
      value: "",
      sort: getMaxSort(list) + 10,
      enabled: true
    });
    render();
  }

  function addCatalog(path) {
    getByPath(draft, path).push(createCatalogItem(path, draft));
    render();
  }

  function deleteItem(path, id) {
    var list = getByPath(draft, path);
    var item = list.find(function (entry) { return entry.id === id; });
    var label = item && (item.name || item.value) ? item.name || item.value : "该项";
    confirmAction({ title: "删除配置项", message: "确认删除“" + label + "”？", confirmLabel: "删除" }).then(function (confirmed) {
      if (!confirmed) return;
      var index = list.findIndex(function (entry) { return entry.id === id; });
      if (index >= 0) list.splice(index, 1);
      render();
    });
  }

  function moveItem(path, id, direction) {
    var sorted = sortBySort(getByPath(draft, path));
    var index = sorted.findIndex(function (item) { return item.id === id; });
    var targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    var tempSort = sorted[index].sort;
    sorted[index].sort = sorted[targetIndex].sort;
    sorted[targetIndex].sort = tempSort;
    sortBySort(getByPath(draft, path)).forEach(function (item, itemIndex) {
      item.sort = (itemIndex + 1) * 10;
    });
    render();
  }

  function saveDraft() {
    if (isSavingConfig) return;
    var result = validateConfig(draft);
    if (!result.valid) {
      showStatus(result.errors.join("；"), true);
      return;
    }
    isSavingConfig = true;
    setSaveBusy(true);
    showStatus("正在保存配置...", false);
    var savedLocallyOnly = false;
    saveConfigWithApiFallback(draft, {
      onFallback: function () {
        savedLocallyOnly = true;
      }
    }).then(function (savedConfig) {
      draft = cloneConfig(savedConfig);
      render();
      showStatus(savedLocallyOnly ? "配置已保存到本机，但服务器同步失败。" : "配置已保存并同步到服务器，出货单页面已更新。", savedLocallyOnly);
      showToast(savedLocallyOnly ? "配置已保存到本机，但尚未同步到服务器。" : "系统配置已保存。", savedLocallyOnly ? "warning" : "success");
    }).catch(function (error) {
      showStatus(error.message || "配置保存失败。", true);
      showToast(error.message || "配置保存失败。", "error");
    }).finally(function () {
      isSavingConfig = false;
      setSaveBusy(false);
    });
  }

  function exportDraft() {
    var blob = new Blob([exportConfigJson(draft)], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "树脂瓦出货单配置.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatus("配置 JSON 已导出。", false);
  }

  function resetDraft() {
    confirmAction({ title: "恢复默认配置", message: "当前自定义配置会被覆盖，确定继续吗？", confirmLabel: "恢复默认" }).then(function (confirmed) {
      if (!confirmed) return;
      try {
        draft = cloneConfig(resetConfig());
        render();
        showStatus("已恢复默认配置。", false);
        showToast("已恢复默认配置，请检查后保存。", "success");
      } catch (error) {
        showStatus(error.message || "恢复默认配置失败。", true);
        showToast(error.message || "恢复默认配置失败。", "error");
      }
    });
  }

  function uploadDefaultLogo(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast("仅支持上传图片文件作为默认 Logo。", "warning");
      return;
    }
    if (file.size > 1536 * 1024) {
      showToast("默认 Logo 会保存到浏览器配置中，请控制在 1.5MB 以内。", "warning");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (event) {
      draft.basics.defaultLogo = String(event.target.result || "");
      render();
      showStatus("默认 Logo 已载入，请保存配置。", false);
    };
    reader.readAsDataURL(file);
  }

  root.addEventListener("input", function (event) {
    var target = event.target;
    if (target.dataset.field) updateSimpleField(target);
    if (target.dataset.itemField) updateItemField(target);
  });

  root.addEventListener("change", function (event) {
    var target = event.target;
    if (target.id === "auditActionFilter") {
      auditState.action = target.value;
      auditState.pagination.page = 1;
      auditState.loaded = false;
      loadAuditRecords(true);
      return;
    }
    if (target.id === "adminLogoUpload") {
      uploadDefaultLogo(target.files && target.files[0]);
      target.value = "";
      return;
    }
    if (target.dataset.field) updateSimpleField(target);
    if (target.dataset.itemField) updateItemField(target);
  });

  root.addEventListener("click", function (event) {
    var target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.adminCategory) {
      activeCategory = target.dataset.adminCategory;
      render();
      if (activeCategory === "audit") loadAuditRecords(false);
      return;
    }
    if (target.id === "auditRefresh") loadAuditRecords(true);
    if (target.id === "auditPrevPage") {
      auditState.pagination.page = Math.max(1, auditState.pagination.page - 1);
      auditState.loaded = false;
      loadAuditRecords(true);
    }
    if (target.id === "auditNextPage") {
      auditState.pagination.page = Math.min(auditState.pagination.totalPages, auditState.pagination.page + 1);
      auditState.loaded = false;
      loadAuditRecords(true);
    }
    if (target.id === "adminSave") saveDraft();
    if (target.id === "adminExport") exportDraft();
    if (target.id === "adminReset") resetDraft();
    if (target.id === "adminClearLogo") {
      draft.basics.defaultLogo = "";
      render();
      showStatus("默认 Logo 已清除，请保存配置。", false);
    }
    if (target.id === "adminClearOrders") onClearOrders();
    if (target.dataset.addOption) addOption(target.dataset.addOption);
    if (target.dataset.addCatalog) addCatalog(target.dataset.addCatalog);
    if (target.classList.contains("admin-delete")) {
      var row = target.closest("[data-collection]");
      if (row) deleteItem(row.dataset.collection, row.dataset.id);
    }
    if (target.classList.contains("admin-move")) {
      var moveRow = target.closest("[data-collection]");
      if (moveRow) moveItem(moveRow.dataset.collection, moveRow.dataset.id, Number(target.dataset.move));
    }
  });

  render();

  return {
    refreshFromConfig: function (config) {
      draft = cloneConfig(config || getConfig());
      render();
      if (activeCategory === "audit") loadAuditRecords(true);
    }
  };
}
