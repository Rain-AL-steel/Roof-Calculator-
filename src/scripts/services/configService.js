import { CONFIG_STORAGE_KEY, CONFIG_VERSION, defaultConfig } from "../config/defaultConfig.js";
import { fetchConfigFromApi, saveConfigToApi } from "./apiClient.js";

const CONFIG_CHANGE_EVENT = "resin-config-change";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function makeId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeOption(item, fallback, prefix, index) {
  var source = isPlainObject(item) ? item : { value: item };
  var fallbackSource = isPlainObject(fallback) ? fallback : {};
  return {
    id: String(source.id || fallbackSource.id || makeId(prefix)),
    value: source.value !== undefined && source.value !== null ? source.value : fallbackSource.value,
    sort: Number.isFinite(Number(source.sort)) ? Number(source.sort) : (Number.isFinite(Number(fallbackSource.sort)) ? Number(fallbackSource.sort) : (index + 1) * 10),
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : (fallbackSource.enabled !== undefined ? Boolean(fallbackSource.enabled) : true)
  };
}

function normalizeCatalogItem(item, fallback, prefix, index, extraDefaults) {
  var source = isPlainObject(item) ? item : { name: item };
  var fallbackSource = isPlainObject(fallback) ? fallback : {};
  var extra = extraDefaults || {};
  return Object.assign({
    id: String(source.id || fallbackSource.id || makeId(prefix)),
    name: String(source.name !== undefined ? source.name : (fallbackSource.name || "")).trim(),
    defaultUnit: String(source.defaultUnit !== undefined ? source.defaultUnit : (fallbackSource.defaultUnit || "件")).trim(),
    defaultPrice: toNullableNumber(source.defaultPrice !== undefined ? source.defaultPrice : fallbackSource.defaultPrice),
    sort: Number.isFinite(Number(source.sort)) ? Number(source.sort) : (Number.isFinite(Number(fallbackSource.sort)) ? Number(fallbackSource.sort) : (index + 1) * 10),
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : (fallbackSource.enabled !== undefined ? Boolean(fallbackSource.enabled) : true)
  }, extra, source.common !== undefined ? { common: Boolean(source.common) } : {}, source.spec !== undefined ? { spec: String(source.spec || "").trim() } : {});
}

function normalizeOptions(items, fallbackItems, prefix) {
  var list = Array.isArray(items) ? items : fallbackItems;
  var fallback = Array.isArray(fallbackItems) ? fallbackItems : [];
  return list.map(function (item, index) {
    return normalizeOption(item, fallback[index], prefix, index);
  });
}

function normalizeCatalog(items, fallbackItems, prefix, itemDefaults) {
  var list = Array.isArray(items) ? items : fallbackItems;
  var fallback = Array.isArray(fallbackItems) ? fallbackItems : [];
  return list.map(function (item, index) {
    return normalizeCatalogItem(item, fallback[index], prefix, index, itemDefaults);
  });
}

function mergeString(source, fallback) {
  return source !== undefined && source !== null ? String(source) : String(fallback || "");
}

function mergeNonEmptyString(source, fallback) {
  var text = source !== undefined && source !== null ? String(source) : "";
  return text.trim() ? text : String(fallback || "");
}

export function normalizeConfig(rawConfig) {
  var source = isPlainObject(rawConfig) ? rawConfig : {};
  var fallback = defaultConfig;
  var basics = isPlainObject(source.basics) ? source.basics : {};
  var mapSettings = isPlainObject(source.mapSettings) ? source.mapSettings : {};
  var steel = isPlainObject(source.steel) ? source.steel : {};
  var reportTemplate = isPlainObject(source.reportTemplate) ? source.reportTemplate : {};

  return {
    version: CONFIG_VERSION,
    basics: {
      fixedWidth: Number.isFinite(Number(basics.fixedWidth)) ? Number(basics.fixedWidth) : fallback.basics.fixedWidth,
      segmentLengths: normalizeOptions(basics.segmentLengths, fallback.basics.segmentLengths, "segment"),
      defaultSegmentLength: Number.isFinite(Number(basics.defaultSegmentLength)) ? Number(basics.defaultSegmentLength) : fallback.basics.defaultSegmentLength,
      mainTileDefaultPrice: toNullableNumber(basics.mainTileDefaultPrice),
      colorOptions: normalizeOptions(basics.colorOptions, fallback.basics.colorOptions, "color"),
      companyName: mergeString(basics.companyName, fallback.basics.companyName),
      address: mergeString(basics.address, fallback.basics.address),
      phone: mergeString(basics.phone, fallback.basics.phone),
      defaultLogo: mergeString(basics.defaultLogo, fallback.basics.defaultLogo)
    },
    mapSettings: {
      enabled: mapSettings.enabled !== undefined ? Boolean(mapSettings.enabled) : Boolean(fallback.mapSettings.enabled),
      amapKey: mergeNonEmptyString(mapSettings.amapKey, fallback.mapSettings.amapKey),
      securityJsCode: mergeNonEmptyString(mapSettings.securityJsCode, fallback.mapSettings.securityJsCode),
      geocodeCity: mergeNonEmptyString(mapSettings.geocodeCity, fallback.mapSettings.geocodeCity),
      mapStyle: mergeNonEmptyString(mapSettings.mapStyle, fallback.mapSettings.mapStyle)
    },
    unitOptions: normalizeOptions(source.unitOptions, fallback.unitOptions, "unit"),
    accessories: normalizeCatalog(source.accessories, fallback.accessories, "acc", { common: true }).map(function (item) {
      return Object.assign({ common: true }, item, { common: Boolean(item.common) });
    }),
    steel: {
      tubeMaterialName: mergeString(steel.tubeMaterialName, fallback.steel.tubeMaterialName),
      tubeDefaultUnit: mergeString(steel.tubeDefaultUnit, fallback.steel.tubeDefaultUnit),
      boltMaterialName: mergeString(steel.boltMaterialName, fallback.steel.boltMaterialName),
      boltDefaultUnit: mergeString(steel.boltDefaultUnit, fallback.steel.boltDefaultUnit),
      materials: normalizeCatalog(steel.materials, fallback.steel.materials, "steel", { spec: "" }).map(function (item) {
        return Object.assign({ spec: "" }, item, { spec: String(item.spec || "").trim() });
      }),
      tubeSpecs: normalizeOptions(steel.tubeSpecs, fallback.steel.tubeSpecs, "tube"),
      thicknessOptions: normalizeOptions(steel.thicknessOptions, fallback.steel.thicknessOptions, "thickness"),
      boltSpecs: normalizeOptions(steel.boltSpecs, fallback.steel.boltSpecs, "bolt")
    },
    otherTiles: normalizeCatalog(source.otherTiles, fallback.otherTiles, "other", {}),
    reportTemplate: {
      mainTitle: mergeString(reportTemplate.mainTitle, fallback.reportTemplate.mainTitle),
      accessoryTitle: mergeString(reportTemplate.accessoryTitle, fallback.reportTemplate.accessoryTitle),
      steelTitle: mergeString(reportTemplate.steelTitle, fallback.reportTemplate.steelTitle),
      roofMaterialTitle: mergeString(reportTemplate.roofMaterialTitle, fallback.reportTemplate.roofMaterialTitle),
      otherTileTitle: mergeString(reportTemplate.otherTileTitle, fallback.reportTemplate.otherTileTitle),
      warmTip: mergeString(reportTemplate.warmTip, fallback.reportTemplate.warmTip),
      addressLabel: mergeString(reportTemplate.addressLabel, fallback.reportTemplate.addressLabel),
      phoneLabel: mergeString(reportTemplate.phoneLabel, fallback.reportTemplate.phoneLabel),
      signatureLabel: mergeString(reportTemplate.signatureLabel, fallback.reportTemplate.signatureLabel),
      receiptDateLabel: mergeString(reportTemplate.receiptDateLabel, fallback.reportTemplate.receiptDateLabel),
      steelProcessText: mergeString(reportTemplate.steelProcessText, fallback.reportTemplate.steelProcessText)
    }
  };
}

function optionValueText(item) {
  return String(item && item.value !== undefined ? item.value : "").trim();
}

function validatePositiveOptionList(errors, list, label, numeric) {
  if (!list.length) {
    errors.push(label + "至少需要保留一项。");
    return;
  }
  list.forEach(function (item, index) {
    var value = optionValueText(item);
    if (!value) errors.push(label + "第 " + (index + 1) + " 项不能为空。");
    if (numeric && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
      errors.push(label + "第 " + (index + 1) + " 项必须是正数。");
    }
  });
}

function validateCatalog(errors, list, label) {
  list.forEach(function (item, index) {
    if (!String(item.name || "").trim()) errors.push(label + "第 " + (index + 1) + " 行名称不能为空。");
    if (!String(item.defaultUnit || "").trim()) errors.push(label + "第 " + (index + 1) + " 行单位不能为空。");
    if (item.defaultPrice !== null && (!Number.isFinite(Number(item.defaultPrice)) || Number(item.defaultPrice) < 0)) {
      errors.push(label + "第 " + (index + 1) + " 行默认单价不能为负数。");
    }
  });
}

export function validateConfig(config) {
  var normalized = normalizeConfig(config);
  var errors = [];
  if (!Number.isFinite(Number(normalized.basics.fixedWidth)) || Number(normalized.basics.fixedWidth) <= 0) {
    errors.push("固定宽度必须是正数。");
  }
  validatePositiveOptionList(errors, normalized.basics.segmentLengths, "节长列表", true);
  if (!Number.isFinite(Number(normalized.basics.defaultSegmentLength)) || Number(normalized.basics.defaultSegmentLength) <= 0) {
    errors.push("默认节长必须是正数。");
  }
  if (normalized.basics.mainTileDefaultPrice !== null && (!Number.isFinite(Number(normalized.basics.mainTileDefaultPrice)) || Number(normalized.basics.mainTileDefaultPrice) < 0)) {
    errors.push("主瓦默认单价不能为负数。");
  }
  validatePositiveOptionList(errors, normalized.basics.colorOptions, "默认颜色", false);
  validatePositiveOptionList(errors, normalized.unitOptions, "单位选项", false);
  validateCatalog(errors, normalized.accessories, "配件");
  if (!String(normalized.steel.tubeMaterialName || "").trim()) errors.push("方管名称不能为空。");
  if (!String(normalized.steel.tubeDefaultUnit || "").trim()) errors.push("方管默认单位不能为空。");
  if (!String(normalized.steel.boltMaterialName || "").trim()) errors.push("膨胀螺丝名称不能为空。");
  if (!String(normalized.steel.boltDefaultUnit || "").trim()) errors.push("膨胀螺丝默认单位不能为空。");
  validateCatalog(errors, normalized.steel.materials, "钢铁材料");
  validatePositiveOptionList(errors, normalized.steel.tubeSpecs, "方管规格", false);
  validatePositiveOptionList(errors, normalized.steel.thicknessOptions, "厚度选项", true);
  validatePositiveOptionList(errors, normalized.steel.boltSpecs, "膨胀螺丝规格", false);
  validateCatalog(errors, normalized.otherTiles, "其他瓦");
  if (!String(normalized.basics.companyName || "").trim()) errors.push("公司名称不能为空。");
  return { valid: errors.length === 0, errors: errors, config: normalized };
}

export function getDefaultConfig() {
  return clone(defaultConfig);
}

function getValidConfig(config) {
  var result = validateConfig(config);
  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
  return result.config;
}

function dispatchConfigChange(config) {
  window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: config }));
}

function writeConfigToLocalStorage(config, failureMessage) {
  var normalized = getValidConfig(config);
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    if (failureMessage) throw new Error(failureMessage);
    return clone(normalized);
  }
  dispatchConfigChange(normalized);
  return clone(normalized);
}

function mirrorConfigToLocalStorage(config) {
  return writeConfigToLocalStorage(config, "");
}

export function loadConfig() {
  try {
    var raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return normalizeConfig(defaultConfig);
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    console.warn("配置读取失败，已使用默认配置。", error);
    return normalizeConfig(defaultConfig);
  }
}

export function saveConfig(config) {
  return writeConfigToLocalStorage(config, "配置保存失败，可能是浏览器存储空间不足。请尝试删除默认 Logo 或导出备份后恢复默认配置。");
}

export function loadConfigWithApiFallback() {
  return fetchConfigFromApi().then(function (payload) {
    if (payload && payload.source === "database" && isPlainObject(payload.config)) {
      return mirrorConfigToLocalStorage(payload.config);
    }
    return loadConfig();
  }).catch(function () {
    return loadConfig();
  });
}

export function saveConfigWithApiFallback(config, options) {
  var details = options || {};
  var normalized = getValidConfig(config);
  return saveConfigToApi(normalized).then(function (payload) {
    var savedConfig = payload && isPlainObject(payload.config) ? payload.config : normalized;
    try {
      return mirrorConfigToLocalStorage(savedConfig);
    } catch (error) {
      return mirrorConfigToLocalStorage(normalized);
    }
  }).catch(function (error) {
    var saved = saveConfig(normalized);
    if (typeof details.onFallback === "function") details.onFallback(error);
    return saved;
  });
}

export function resetConfig() {
  return saveConfig(defaultConfig);
}

export function exportConfigJson(config) {
  return JSON.stringify(normalizeConfig(config || loadConfig()), null, 2);
}

export function importConfigJson(jsonText) {
  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error("导入失败：JSON 格式不正确。");
  }
  return saveConfig(parsed);
}

export function subscribeConfigChange(listener) {
  function handleChange(event) {
    listener(clone(event.detail || loadConfig()));
  }
  function handleStorage(event) {
    if (event.key === CONFIG_STORAGE_KEY) listener(loadConfig());
  }
  window.addEventListener(CONFIG_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return function unsubscribe() {
    window.removeEventListener(CONFIG_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function createConfigId(prefix) {
  return makeId(prefix || "item");
}

export function cloneConfig(config) {
  return clone(config);
}
