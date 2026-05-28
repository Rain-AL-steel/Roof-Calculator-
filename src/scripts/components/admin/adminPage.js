import {
  cloneConfig,
  createConfigId,
  exportConfigJson,
  importConfigJson,
  resetConfig,
  saveConfig,
  validateConfig
} from "../../services/configService.js";
import { escapeHtml } from "../../utils.js";

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

function renderOptionRows(draft, path, numericValue) {
  return sortBySort(getByPath(draft, path)).map(function (item) {
    return "<tr data-collection='" + escapeHtml(path) + "' data-id='" + escapeHtml(item.id) + "'>" +
      "<td><input class='admin-input' data-item-field='value' data-value-type='" + (numericValue ? "number" : "text") + "' type='" + (numericValue ? "number" : "text") + "' step='0.001' value='" + escapeHtml(item.value) + "' /></td>" +
      "<td><input class='admin-input compact' data-item-field='sort' data-value-type='number' type='number' step='1' value='" + escapeHtml(item.sort) + "' /></td>" +
      "<td><label class='admin-switch'><input data-item-field='enabled' type='checkbox'" + (item.enabled !== false ? " checked" : "") + " /><span>启用</span></label></td>" +
      "<td class='admin-row-actions'><button type='button' class='icon-btn admin-move' data-move='-1' title='上移' aria-label='上移'>↑</button><button type='button' class='icon-btn admin-move' data-move='1' title='下移' aria-label='下移'>↓</button><button type='button' class='icon-btn admin-delete' title='删除' aria-label='删除'>×</button></td>" +
      "</tr>";
  }).join("");
}

function renderCatalogRows(draft, path, type) {
  return sortBySort(getByPath(draft, path)).map(function (item) {
    var specCell = type === "steel" ? "<td><input class='admin-input' data-item-field='spec' type='text' value='" + escapeHtml(item.spec || "") + "' /></td>" : "";
    var commonCell = type === "accessory" ? "<td><label class='admin-switch'><input data-item-field='common' type='checkbox'" + (item.common ? " checked" : "") + " /><span>常用</span></label></td>" : "";
    return "<tr data-collection='" + escapeHtml(path) + "' data-id='" + escapeHtml(item.id) + "'>" +
      "<td><input class='admin-input' data-item-field='name' type='text' value='" + escapeHtml(item.name) + "' /></td>" +
      specCell +
      "<td><input class='admin-input compact' data-item-field='defaultUnit' type='text' list='unitOptions' value='" + escapeHtml(item.defaultUnit) + "' /></td>" +
      "<td><input class='admin-input compact' data-item-field='defaultPrice' data-value-type='number' type='number' min='0' step='0.01' value='" + escapeHtml(formatPrice(item.defaultPrice)) + "' /></td>" +
      commonCell +
      "<td><input class='admin-input compact' data-item-field='sort' data-value-type='number' type='number' step='1' value='" + escapeHtml(item.sort) + "' /></td>" +
      "<td><label class='admin-switch'><input data-item-field='enabled' type='checkbox'" + (item.enabled !== false ? " checked" : "") + " /><span>启用</span></label></td>" +
      "<td class='admin-row-actions'><button type='button' class='icon-btn admin-move' data-move='-1' title='上移' aria-label='上移'>↑</button><button type='button' class='icon-btn admin-move' data-move='1' title='下移' aria-label='下移'>↓</button><button type='button' class='icon-btn admin-delete' title='删除' aria-label='删除'>×</button></td>" +
      "</tr>";
  }).join("");
}

function renderOptionSection(draft, title, path, valueLabel, numericValue) {
  return "<section class='admin-section'><div class='admin-section-head'><h3>" + escapeHtml(title) + "</h3><button type='button' class='btn btn-soft' data-add-option='" + escapeHtml(path) + "'>新增</button></div>" +
    "<div class='admin-table-wrap'><table class='admin-table'><thead><tr><th>" + escapeHtml(valueLabel) + "</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>" + renderOptionRows(draft, path, numericValue) + "</tbody></table></div></section>";
}

function renderCatalogSection(draft, title, path, type) {
  var specHead = type === "steel" ? "<th>规格</th>" : "";
  var commonHead = type === "accessory" ? "<th>常用</th>" : "";
  return "<section class='admin-section'><div class='admin-section-head'><h3>" + escapeHtml(title) + "</h3><button type='button' class='btn btn-soft' data-add-catalog='" + escapeHtml(path) + "'>新增</button></div>" +
    "<div class='admin-table-wrap'><table class='admin-table'><thead><tr><th>名称</th>" + specHead + "<th>单位</th><th>默认单价</th>" + commonHead + "<th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>" + renderCatalogRows(draft, path, type) + "</tbody></table></div></section>";
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

function renderAdmin(draft) {
  return "<div class='admin-actions-bar'>" +
    "<button type='button' class='btn btn-primary' id='adminSave'>保存配置</button>" +
    "<button type='button' class='btn btn-neutral' id='adminExport'>导出配置 JSON</button>" +
    "<label class='btn btn-neutral admin-import-label' for='adminImportFile'>导入配置 JSON</label><input id='adminImportFile' class='visually-hidden-file' type='file' accept='application/json,.json' />" +
    "<button type='button' class='btn btn-danger' id='adminReset'>恢复默认配置</button>" +
    "</div><div class='admin-status' id='adminStatus' role='status'></div>" +
    "<section class='admin-section'><div class='admin-section-head'><h3>基础参数</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>固定宽度（米）</span><input data-field='basics.fixedWidth' data-value-type='number' type='number' min='0.001' step='0.001' value='" + escapeHtml(draft.basics.fixedWidth) + "' /></label>" +
    "<label class='field'><span>默认节长</span><select data-field='basics.defaultSegmentLength' data-value-type='number'>" + renderDefaultSegmentOptions(draft) + "</select></label>" +
    "<label class='field'><span>主瓦默认单价</span><input data-field='basics.mainTileDefaultPrice' data-value-type='number' type='number' min='0' step='0.01' value='" + escapeHtml(formatPrice(draft.basics.mainTileDefaultPrice)) + "' /></label>" +
    "<label class='field'><span>公司名称</span><input data-field='basics.companyName' type='text' value='" + escapeHtml(draft.basics.companyName) + "' /></label>" +
    "<label class='field span-3'><span>地址</span><input data-field='basics.address' type='text' value='" + escapeHtml(draft.basics.address) + "' /></label>" +
    "<label class='field span-3'><span>电话</span><input data-field='basics.phone' type='text' value='" + escapeHtml(draft.basics.phone) + "' /></label>" +
    "<div class='field span-3'><span>默认 Logo</span><div class='admin-logo-row'>" + renderLogoPreview(draft) + "<input id='adminLogoUpload' type='file' accept='image/*' /><button type='button' class='btn btn-neutral' id='adminClearLogo'>清除 Logo</button></div></div>" +
    "</div></section>" +
    "<section class='admin-section'><div class='admin-section-head'><h3>地图设置</h3></div><div class='admin-form-grid'>" +
    "<div class='field'><span>首页订单地图</span><label class='admin-switch'><input data-field='mapSettings.enabled' type='checkbox'" + (draft.mapSettings.enabled ? " checked" : "") + " /><span>启用</span></label></div>" +
    "<label class='field'><span>高德 JS API Key</span><input data-field='mapSettings.amapKey' type='text' value='" + escapeHtml(draft.mapSettings.amapKey) + "' autocomplete='off' /></label>" +
    "<label class='field'><span>安全密钥 securityJsCode</span><input data-field='mapSettings.securityJsCode' type='text' value='" + escapeHtml(draft.mapSettings.securityJsCode) + "' autocomplete='off' /></label>" +
    "<label class='field'><span>默认解析城市 / adcode</span><input data-field='mapSettings.geocodeCity' type='text' value='" + escapeHtml(draft.mapSettings.geocodeCity) + "' placeholder='留空按全国解析' /></label>" +
    "<label class='field span-2'><span>地图样式</span><input data-field='mapSettings.mapStyle' type='text' value='" + escapeHtml(draft.mapSettings.mapStyle) + "' placeholder='amap://styles/whitesmoke' /></label>" +
    "</div></section>" +
    renderOptionSection(draft, "可选节长", "basics.segmentLengths", "节长", true) +
    renderOptionSection(draft, "默认颜色选项", "basics.colorOptions", "颜色", false) +
    renderOptionSection(draft, "单位选项", "unitOptions", "单位", false) +
    renderCatalogSection(draft, "配件管理", "accessories", "accessory") +
    "<section class='admin-section'><div class='admin-section-head'><h3>钢铁快捷项</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>方管名称</span><input data-field='steel.tubeMaterialName' type='text' value='" + escapeHtml(draft.steel.tubeMaterialName) + "' /></label>" +
    "<label class='field'><span>方管默认单位</span><input data-field='steel.tubeDefaultUnit' type='text' list='unitOptions' value='" + escapeHtml(draft.steel.tubeDefaultUnit) + "' /></label>" +
    "<label class='field'><span>膨胀螺丝名称</span><input data-field='steel.boltMaterialName' type='text' value='" + escapeHtml(draft.steel.boltMaterialName) + "' /></label>" +
    "<label class='field'><span>膨胀螺丝默认单位</span><input data-field='steel.boltDefaultUnit' type='text' list='unitOptions' value='" + escapeHtml(draft.steel.boltDefaultUnit) + "' /></label>" +
    "</div></section>" +
    renderCatalogSection(draft, "钢铁材料预设", "steel.materials", "steel") +
    renderOptionSection(draft, "方管规格", "steel.tubeSpecs", "规格", false) +
    renderOptionSection(draft, "方管厚度", "steel.thicknessOptions", "厚度", true) +
    renderOptionSection(draft, "膨胀螺丝规格", "steel.boltSpecs", "规格", false) +
    renderCatalogSection(draft, "其他瓦 / 特殊瓦", "otherTiles", "other") +
    "<section class='admin-section'><div class='admin-section-head'><h3>报表模板</h3></div><div class='admin-form-grid'>" +
    "<label class='field'><span>综合报表标题</span><input data-field='reportTemplate.mainTitle' type='text' value='" + escapeHtml(draft.reportTemplate.mainTitle) + "' /></label>" +
    "<label class='field'><span>配件报表标题</span><input data-field='reportTemplate.accessoryTitle' type='text' value='" + escapeHtml(draft.reportTemplate.accessoryTitle) + "' /></label>" +
    "<label class='field'><span>钢铁报表标题</span><input data-field='reportTemplate.steelTitle' type='text' value='" + escapeHtml(draft.reportTemplate.steelTitle) + "' /></label>" +
    "<label class='field'><span>屋面材料标题</span><input data-field='reportTemplate.roofMaterialTitle' type='text' value='" + escapeHtml(draft.reportTemplate.roofMaterialTitle) + "' /></label>" +
    "<label class='field'><span>其他瓦标题</span><input data-field='reportTemplate.otherTileTitle' type='text' value='" + escapeHtml(draft.reportTemplate.otherTileTitle) + "' /></label>" +
    "<label class='field'><span>地址标签</span><input data-field='reportTemplate.addressLabel' type='text' value='" + escapeHtml(draft.reportTemplate.addressLabel) + "' /></label>" +
    "<label class='field'><span>电话标签</span><input data-field='reportTemplate.phoneLabel' type='text' value='" + escapeHtml(draft.reportTemplate.phoneLabel) + "' /></label>" +
    "<label class='field span-3'><span>温馨提示</span><textarea data-field='reportTemplate.warmTip' rows='3'>" + escapeHtml(draft.reportTemplate.warmTip) + "</textarea></label>" +
    "<label class='field span-3'><span>签字栏文字</span><input data-field='reportTemplate.signatureLabel' type='text' value='" + escapeHtml(draft.reportTemplate.signatureLabel) + "' /></label>" +
    "<label class='field span-3'><span>日期栏文字</span><input data-field='reportTemplate.receiptDateLabel' type='text' value='" + escapeHtml(draft.reportTemplate.receiptDateLabel) + "' /></label>" +
    "<label class='field span-3'><span>钢铁工艺文字</span><input data-field='reportTemplate.steelProcessText' type='text' value='" + escapeHtml(draft.reportTemplate.steelProcessText) + "' /></label>" +
    "</div></section>";
}

export function initAdminPage(options) {
  var getConfig = options.getConfig;
  var root = document.getElementById("adminRoot");
  var draft = cloneConfig(getConfig());

  function showStatus(message, isError) {
    var status = document.getElementById("adminStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
    status.classList.toggle("is-success", Boolean(message && !isError));
  }

  function render() {
    root.innerHTML = renderAdmin(draft);
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
    if (!window.confirm("确认删除“" + label + "”？")) return;
    var index = list.findIndex(function (entry) { return entry.id === id; });
    if (index >= 0) list.splice(index, 1);
    render();
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
    var result = validateConfig(draft);
    if (!result.valid) {
      showStatus(result.errors.join("；"), true);
      return;
    }
    try {
      draft = cloneConfig(saveConfig(draft));
      render();
      showStatus("配置已保存，出货单页面已更新。", false);
    } catch (error) {
      showStatus(error.message || "配置保存失败。", true);
      window.alert(error.message || "配置保存失败。");
    }
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

  function importDraft(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      try {
        draft = cloneConfig(importConfigJson(String(event.target.result || "")));
        render();
        showStatus("配置已导入并保存。", false);
      } catch (error) {
        showStatus(error.message || "配置导入失败。", true);
        window.alert(error.message || "配置导入失败。");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function resetDraft() {
    if (!window.confirm("确认恢复默认配置？当前自定义配置会被覆盖。")) return;
    try {
      draft = cloneConfig(resetConfig());
      render();
      showStatus("已恢复默认配置。", false);
    } catch (error) {
      showStatus(error.message || "恢复默认配置失败。", true);
    }
  }

  function uploadDefaultLogo(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      window.alert("仅支持上传图片文件作为默认 Logo。");
      return;
    }
    if (file.size > 1536 * 1024) {
      window.alert("默认 Logo 会保存到浏览器配置中，请控制在 1.5MB 以内。");
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
    if (target.id === "adminImportFile") {
      importDraft(target.files && target.files[0]);
      target.value = "";
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
    if (target.id === "adminSave") saveDraft();
    if (target.id === "adminExport") exportDraft();
    if (target.id === "adminReset") resetDraft();
    if (target.id === "adminClearLogo") {
      draft.basics.defaultLogo = "";
      render();
      showStatus("默认 Logo 已清除，请保存配置。", false);
    }
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
    }
  };
}
