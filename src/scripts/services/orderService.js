import { computeGrandAmount, sumFiniteAmounts } from "../calc.js";
import { deleteOrderFromApi, fetchOrdersFromApi, isApiConfigured, saveOrderToApi, updateOrderToApi } from "./apiClient.js";

export const ORDER_STORAGE_KEY = "erp_orders_v1";
export const BACKUP_META_STORAGE_KEY = "erp_backup_meta_v1";
export const EXPORT_APP_NAME = "resin-tile-order-tool";
export const EXPORT_VERSION = 2;

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

function safeParseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function getDateOnly(value) {
  var date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function createLocalDate(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  var text = compactText(value);
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  var date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function getMonthLabel(date) {
  return date.getFullYear() + "/" + String(date.getMonth() + 1).padStart(2, "0");
}

function getDayLabel(date) {
  return String(date.getMonth() + 1) + "/" + String(date.getDate()).padStart(2, "0");
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeMonthString(value) {
  var text = compactText(value).replace(/\//g, "-");
  var match = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (!match) return "";
  var month = Number(match[2]);
  if (month < 1 || month > 12) return "";
  return match[1] + "-" + String(month).padStart(2, "0");
}

function finiteNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function optionalNonnegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

function finiteCoordinate(value) {
  var number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function normalizeDeliveryLocation(location) {
  if (!location) return null;
  var source = Array.isArray(location) ? { lng: location[0], lat: location[1] } : location;
  var lng = finiteCoordinate(source.lng !== undefined ? source.lng : source.longitude);
  var lat = finiteCoordinate(source.lat !== undefined ? source.lat : source.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    lng: lng,
    lat: lat,
    address: compactText(source.address),
    formattedAddress: compactText(source.formattedAddress),
    province: compactText(source.province),
    city: compactText(source.city),
    district: compactText(source.district),
    adcode: compactText(source.adcode),
    geocodedAt: compactText(source.geocodedAt)
  };
}

function normalizeMainRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    var next = {
      lengthsText: compactText(row && row.lengthsText),
      totalQty: finiteNumber(row && row.totalQty, 0),
      actual: finiteNumber(row && row.actual, 0),
      area: finiteNumber(row && row.area, 0)
    };
    [
      "name",
      "spec",
      "model",
      "remark",
      "title",
      "segmentText",
      "segmentLengthText"
    ].forEach(function (field) {
      var value = compactText(row && row[field]);
      if (value) next[field] = value;
    });
    [
      "segment",
      "segmentLength",
      "tileSegmentLength",
      "mainTileSegmentLength",
      "defaultSegmentLength",
      "tileSegment",
      "amount",
      "subtotal"
    ].forEach(function (field) {
      var value = optionalNonnegativeNumber(row && row[field]);
      if (Number.isFinite(value)) next[field] = value;
    });
    return next;
  }).filter(function (row) {
    return row.lengthsText || row.totalQty || row.actual || row.area ||
      row.name || row.spec || row.model || row.remark || row.title ||
      row.segment || row.segmentLength || row.tileSegmentLength || row.mainTileSegmentLength ||
      row.defaultSegmentLength || row.tileSegment ||
      row.amount || row.subtotal;
  });
}

function normalizeLineItems(items, withLength) {
  return (Array.isArray(items) ? items : []).map(function (item) {
    var next = {
      name: compactText(item && item.name),
      qty: finiteNumber(item && item.qty, 0),
      unit: compactText(item && item.unit),
      price: finiteNumber(item && item.price, 0),
      subtotal: finiteNumber(item && item.subtotal, 0)
    };
    if (withLength) next.length = finiteNumber(item && item.length, 0);
    return next;
  }).filter(function (item) {
    return item.name || item.qty || item.price || item.subtotal;
  });
}

function createId() {
  var cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "order-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function generateOrderNo(date) {
  var source = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(source.getTime())) source = new Date();
  return "ORD-" +
    source.getFullYear() +
    String(source.getMonth() + 1).padStart(2, "0") +
    String(source.getDate()).padStart(2, "0") +
    "-" +
    String(source.getHours()).padStart(2, "0") +
    String(source.getMinutes()).padStart(2, "0") +
    String(source.getSeconds()).padStart(2, "0");
}

export function normalizeOrder(input) {
  var source = input || {};
  var now = nowIso();
  var orderDate = compactText(source.orderDate) || getDateOnly(source.createdAt || now);
  var items = source.items || {};
  var mainRows = normalizeMainRows(items.mainRows || source.mainRows);
  var accessories = normalizeLineItems(items.accessories || source.accessories, false);
  var steels = normalizeLineItems(items.steels || source.steels, false);
  var otherTiles = normalizeLineItems(items.otherTiles || source.otherTiles, true);
  var mainTileSegmentLength = optionalNonnegativeNumber(
    items.mainTileSegmentLength !== undefined ? items.mainTileSegmentLength : source.mainTileSegmentLength
  );
  var totalsSource = source.totals || {};
  var areaTotal = finiteNumber(totalsSource.areaTotal, sumFiniteAmounts(mainRows.map(function (row) { return row.area; })));
  var mainAmount = finiteNumber(totalsSource.mainAmount, finiteNumber(source.mainAmount, 0));
  var accessoryAmount = finiteNumber(totalsSource.accessoryAmount, sumFiniteAmounts(accessories.map(function (item) { return item.subtotal; })));
  var steelAmount = finiteNumber(totalsSource.steelAmount, sumFiniteAmounts(steels.map(function (item) { return item.subtotal; })));
  var otherTileAmount = finiteNumber(totalsSource.otherTileAmount, sumFiniteAmounts(otherTiles.map(function (item) { return item.subtotal; })));
  var grandAmount = computeGrandAmount(mainAmount, accessoryAmount, steelAmount, otherTileAmount);

  var normalizedItems = {
    mainRows: mainRows,
    accessories: accessories,
    steels: steels,
    otherTiles: otherTiles
  };
  if (Number.isFinite(mainTileSegmentLength)) normalizedItems.mainTileSegmentLength = mainTileSegmentLength;

  return {
    id: compactText(source.id) || createId(),
    orderNo: compactText(source.orderNo) || generateOrderNo(source.createdAt || now),
    clientOrderId: compactText(source.clientOrderId),
    createdAt: compactText(source.createdAt) || now,
    updatedAt: compactText(source.updatedAt) || now,
    orderDate: orderDate,
    customerName: compactText(source.customerName),
    tileColor: compactText(source.tileColor),
    remark: compactText(source.remark),
    deliveryAddress: compactText(source.deliveryAddress),
    completionMonth: normalizeMonthString(source.completionMonth),
    deliveryLocation: normalizeDeliveryLocation(source.deliveryLocation),
    totals: {
      areaTotal: areaTotal,
      mainAmount: mainAmount,
      accessoryAmount: accessoryAmount,
      steelAmount: steelAmount,
      otherTileAmount: otherTileAmount,
      grandAmount: grandAmount
    },
    items: normalizedItems
  };
}

function sortOrders(orders) {
  return orders.slice().sort(function (a, b) {
    var timeA = Date.parse(a.updatedAt || a.createdAt || a.orderDate || "");
    var timeB = Date.parse(b.updatedAt || b.createdAt || b.orderDate || "");
    return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
  });
}

function readOrdersPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.orders)) return payload.orders;
  return null;
}

function readOrderPayload(payload, fallback) {
  if (payload && payload.order) return payload.order;
  if (payload && typeof payload === "object" && (payload.id || payload.orderNo || payload.items || payload.totals)) return payload;
  return fallback;
}

function getOrderIdentifiers(order) {
  return [
    compactText(order && order.id),
    compactText(order && order.clientOrderId)
  ].filter(Boolean);
}

function createIdentifierSet(identifiers) {
  var set = {};
  (Array.isArray(identifiers) ? identifiers : [identifiers]).forEach(function (identifier) {
    var id = compactText(identifier);
    if (id) set[id] = true;
  });
  return set;
}

function orderMatchesIdentifierSet(order, identifierSet) {
  return getOrderIdentifiers(order).some(function (identifier) {
    return Boolean(identifierSet[identifier]);
  });
}

function findOrderByIdentifier(orders, identifier) {
  var identifierSet = createIdentifierSet(identifier);
  return (Array.isArray(orders) ? orders : []).find(function (order) {
    return orderMatchesIdentifierSet(order, identifierSet);
  }) || null;
}

function saveOrdersToLocal(orders, metaPatch) {
  var storage = getStorage();
  var next = sortOrders((Array.isArray(orders) ? orders : []).map(normalizeOrder));
  if (storage) storage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
  if (metaPatch) saveBackupMeta(metaPatch);
  return next;
}

function removeOrdersFromLocalByIdentifiers(identifiers, metaPatch) {
  var identifierSet = createIdentifierSet(identifiers);
  var next = loadOrders().filter(function (order) {
    return !orderMatchesIdentifierSet(order, identifierSet);
  });
  return saveOrdersToLocal(next, Object.assign({ lastSavedAt: nowIso() }, metaPatch || {}));
}

function replaceOrderToLocal(order, identifiers, options) {
  var settings = options || {};
  var normalized = normalizeOrder(settings.touchUpdatedAt === false ? order : Object.assign({}, order, { updatedAt: nowIso() }));
  var identifierSet = createIdentifierSet((Array.isArray(identifiers) ? identifiers : []).concat(getOrderIdentifiers(normalized)));
  var orders = loadOrders();
  var existing = orders.find(function (item) {
    return orderMatchesIdentifierSet(item, identifierSet);
  });
  if (existing && settings.preserveCreatedAt !== false) {
    normalized.createdAt = existing.createdAt || normalized.createdAt;
  }
  orders = orders.filter(function (item) {
    return !orderMatchesIdentifierSet(item, identifierSet);
  });
  orders.unshift(normalized);
  saveOrdersToLocal(orders, Object.assign({ lastSavedAt: nowIso() }, settings.metaPatch || {}));
  return normalized;
}

function upsertOrderToLocal(order, options) {
  var normalized = normalizeOrder(options && options.touchUpdatedAt === false ? order : Object.assign({}, order, { updatedAt: nowIso() }));
  return replaceOrderToLocal(normalized, getOrderIdentifiers(normalized), Object.assign({}, options || {}, {
    touchUpdatedAt: false
  }));
}

function syncOrdersFromApi(metaPatch) {
  return fetchOrdersFromApi().then(function (payload) {
    var apiOrders = readOrdersPayload(payload);
    if (!apiOrders) throw new Error("API orders payload is invalid.");
    return saveOrdersToLocal(apiOrders, Object.assign({ lastSyncedAt: nowIso() }, metaPatch || {}));
  });
}

function resolveApiOrderReference(orderId) {
  var requestedId = compactText(orderId);
  return syncOrdersFromApi().then(function (orders) {
    var matchedOrder = findOrderByIdentifier(orders, requestedId);
    var resolvedId = matchedOrder ? matchedOrder.id : requestedId;
    return {
      requestedId: requestedId,
      order: matchedOrder,
      orderId: resolvedId,
      identifiers: [requestedId].concat(getOrderIdentifiers(matchedOrder))
    };
  });
}

function findApiOrderForDelete(orders, requestedId, orderHint) {
  var hint = orderHint || {};
  var orderNo = compactText(hint.orderNo);
  var clientOrderId = compactText(hint.clientOrderId);
  var id = compactText(hint.id);
  return (Array.isArray(orders) ? orders : []).find(function (order) {
    return (
      compactText(order && order.orderNo) && compactText(order && order.orderNo) === orderNo
    ) || (
      clientOrderId && compactText(order && order.clientOrderId) === clientOrderId
    ) || (
      requestedId && compactText(order && order.clientOrderId) === requestedId
    ) || (
      id && compactText(order && order.clientOrderId) === id
    ) || (
      requestedId && compactText(order && order.id) === requestedId
    );
  }) || null;
}

function resolveApiOrderForDelete(orderId, orderHint) {
  var requestedId = compactText(orderId);
  var localOrder = findOrderByIdentifier(loadOrders(), requestedId);
  var hint = Object.assign({}, localOrder || {}, orderHint || {});
  var orderNo = compactText(hint.orderNo);
  var clientOrderId = compactText(hint.clientOrderId);

  return syncOrdersFromApi().then(function (orders) {
    var matchedOrder = findApiOrderForDelete(orders, requestedId, hint);
    if (!matchedOrder) {
      var error = new Error("API order id could not be resolved before delete.");
      error.attemptedId = requestedId;
      error.orderNo = orderNo;
      error.clientOrderId = clientOrderId;
      throw error;
    }

    return {
      attemptedId: requestedId,
      order: matchedOrder,
      orderId: matchedOrder.id,
      orderNo: compactText(matchedOrder.orderNo) || orderNo,
      clientOrderId: compactText(matchedOrder.clientOrderId) || clientOrderId,
      identifiers: [requestedId, hint.id, hint.clientOrderId, matchedOrder.id, matchedOrder.clientOrderId]
    };
  });
}

export function loadOrders() {
  var storage = getStorage();
  var raw = storage ? storage.getItem(ORDER_STORAGE_KEY) : "";
  var parsed = safeParseJson(raw, []);
  return sortOrders((Array.isArray(parsed) ? parsed : []).map(normalizeOrder));
}

export function loadBackupMeta() {
  var storage = getStorage();
  var raw = storage ? storage.getItem(BACKUP_META_STORAGE_KEY) : "";
  var parsed = safeParseJson(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

export function saveBackupMeta(patch) {
  var storage = getStorage();
  var next = Object.assign({}, loadBackupMeta(), patch || {});
  if (storage) storage.setItem(BACKUP_META_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function saveOrders(orders, metaPatch) {
  return saveOrdersToLocal(orders, Object.assign({ lastSavedAt: nowIso() }, metaPatch || {}));
}

export function upsertOrder(order) {
  return upsertOrderToLocal(order);
}

export function loadOrdersWithApiFallback() {
  if (!isApiConfigured()) return Promise.resolve(loadOrders());

  return syncOrdersFromApi().catch(function (error) {
    console.warn("订单 API 读取失败，已使用本地 localStorage 数据。", error);
    return loadOrders();
  });
}

export function upsertOrderWithApiFallback(order) {
  var localCandidate = normalizeOrder(Object.assign({}, order, { updatedAt: nowIso() }));
  if (!isApiConfigured()) return Promise.resolve(upsertOrderToLocal(localCandidate, { touchUpdatedAt: false }));

  return saveOrderToApi(localCandidate).then(function (payload) {
    var savedOrder = normalizeOrder(readOrderPayload(payload, localCandidate));
    replaceOrderToLocal(savedOrder, [localCandidate.id, savedOrder.id, savedOrder.clientOrderId], {
      touchUpdatedAt: false,
      metaPatch: { lastSyncedAt: nowIso() }
    });
    return savedOrder;
  }).catch(function (error) {
    console.warn("订单 API 保存失败，已回退到本地 localStorage 保存。", error);
    return upsertOrderToLocal(localCandidate, { touchUpdatedAt: false });
  });
}

export function updateOrderWithApiFallback(orderId, order) {
  var requestedId = compactText(orderId);
  var localFallbackCandidate = normalizeOrder(Object.assign({}, order, {
    id: requestedId,
    orderNo: compactText(order && order.orderNo),
    clientOrderId: compactText(order && order.clientOrderId),
    updatedAt: nowIso()
  }));
  if (!isApiConfigured()) return Promise.resolve(upsertOrderToLocal(localFallbackCandidate, { touchUpdatedAt: false }));

  return resolveApiOrderReference(requestedId).then(function (reference) {
    var apiOrder = reference.order || {};
    var clientOrderId = compactText(order && order.clientOrderId) ||
      compactText(apiOrder.clientOrderId) ||
      (reference.orderId !== requestedId ? requestedId : "");
    var localCandidate = normalizeOrder(Object.assign({}, apiOrder, order, {
      id: reference.orderId,
      orderNo: compactText(apiOrder.orderNo) || compactText(order && order.orderNo),
      clientOrderId: clientOrderId,
      updatedAt: nowIso()
    }));

    return updateOrderToApi(reference.orderId, localCandidate).then(function (payload) {
      var payloadOrder = readOrderPayload(payload, localCandidate);
      var savedOrder = normalizeOrder(Object.assign({}, localCandidate, payloadOrder, {
        id: compactText(payloadOrder && payloadOrder.id) || localCandidate.id,
        orderNo: compactText(payloadOrder && payloadOrder.orderNo) || localCandidate.orderNo,
        clientOrderId: compactText(payloadOrder && payloadOrder.clientOrderId) || localCandidate.clientOrderId
      }));
      replaceOrderToLocal(savedOrder, reference.identifiers.concat(getOrderIdentifiers(savedOrder)), {
        touchUpdatedAt: false,
        metaPatch: { lastSyncedAt: nowIso() }
      });
      return savedOrder;
    }).catch(function (error) {
      console.warn("Order API update failed; using localStorage fallback.", {
        orderId: reference.orderId,
        requestedId: requestedId,
        reason: getErrorReason(error)
      });
      return replaceOrderToLocal(localCandidate, reference.identifiers, { touchUpdatedAt: false });
    });
  }).catch(function (error) {
    console.warn("Order API id resolution failed; using localStorage fallback.", {
      orderId: requestedId,
      reason: getErrorReason(error)
    });
    return upsertOrderToLocal(localFallbackCandidate, { touchUpdatedAt: false });
  });
}

export function deleteOrder(orderId) {
  var id = compactText(orderId);
  return removeOrdersFromLocalByIdentifiers([id]);
}

export function deleteOrderWithApiFallback(orderId, orderHint) {
  var requestedId = compactText(orderId);
  if (!isApiConfigured()) return Promise.resolve(deleteOrder(requestedId));

  return resolveApiOrderForDelete(requestedId, orderHint).then(function (reference) {
    return deleteOrderFromApi(reference.orderId).then(function () {
      return removeOrdersFromLocalByIdentifiers(reference.identifiers.concat([reference.orderId]), {
        lastSyncedAt: nowIso()
      });
    }).catch(function (error) {
      error.orderApiDeleteHandled = true;
      console.warn("Order API delete failed; local cache was not removed.", {
        attemptedId: reference.orderId,
        orderNo: reference.orderNo,
        clientOrderId: reference.clientOrderId,
        reason: getErrorReason(error)
      });
      throw error;
    });
  }).catch(function (error) {
    if (!(error && error.orderApiDeleteHandled)) {
      console.warn("Order API id resolution failed; local cache was not removed.", {
        attemptedId: error && error.attemptedId ? error.attemptedId : requestedId,
        orderNo: error && error.orderNo ? error.orderNo : compactText(orderHint && orderHint.orderNo),
        clientOrderId: error && error.clientOrderId ? error.clientOrderId : compactText(orderHint && orderHint.clientOrderId),
        reason: getErrorReason(error)
      });
    }
    throw error;
  });
}

function getErrorReason(error) {
  return error && error.message ? error.message : String(error || "Unknown error");
}

function getUniqueOrderIds(orders) {
  var seen = {};
  return (Array.isArray(orders) ? orders : []).map(function (order) {
    return compactText(order && order.id);
  }).filter(function (id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

export function clearOrdersWithApiFallback() {
  if (!isApiConfigured()) return Promise.resolve(clearOrders());

  return syncOrdersFromApi().then(function (orders) {
    var apiOrders = getUniqueOrderIds(orders).map(function (id) {
      return findOrderByIdentifier(orders, id);
    }).filter(Boolean);
    var sequence = Promise.resolve();

    apiOrders.forEach(function (order) {
      sequence = sequence.then(function () {
        return deleteOrderFromApi(order.id).then(function () {
          removeOrdersFromLocalByIdentifiers(getOrderIdentifiers(order), {
            lastSyncedAt: nowIso()
          });
        }).catch(function (error) {
          console.warn("Order API bulk delete failed; local cache was not removed for this order.", {
            orderId: order.id,
            reason: getErrorReason(error)
          });
        });
      });
    });

    return sequence.then(function () {
      return loadOrders();
    });
  }).catch(function (error) {
    console.warn("Order API bulk clear read failed; local cache was not cleared.", {
      reason: getErrorReason(error)
    });
    return loadOrders();
  });
}

export function clearOrders() {
  return saveOrders([]);
}

export function getOrderStats(orders, dateStr) {
  var list = Array.isArray(orders) ? orders : [];
  var targetDate = dateStr || getDateOnly();
  var todayOrders = list.filter(function (order) { return order.orderDate === targetDate; });
  return {
    todayCount: todayOrders.length,
    todayAmount: sumFiniteAmounts(todayOrders.map(function (order) { return order.totals && order.totals.grandAmount; })),
    todayArea: sumFiniteAmounts(todayOrders.map(function (order) { return order.totals && order.totals.areaTotal; })),
    totalCount: list.length,
    totalAmount: sumFiniteAmounts(list.map(function (order) { return order.totals && order.totals.grandAmount; })),
    totalArea: sumFiniteAmounts(list.map(function (order) { return order.totals && order.totals.areaTotal; })),
    recentOrders: sortOrders(list).slice(0, 8)
  };
}

function optionalAmount(value) {
  return optionalNonnegativeNumber(value);
}

function amountWithFallback(value, fallback) {
  var number = optionalAmount(value);
  return Number.isFinite(number) ? number : fallback;
}

function sumLineSubtotals(items) {
  return sumFiniteAmounts((Array.isArray(items) ? items : []).map(function (item) {
    return item && item.subtotal;
  }));
}

function sumMainRowAmounts(rows) {
  return sumFiniteAmounts((Array.isArray(rows) ? rows : []).map(function (row) {
    if (row && row.amount !== undefined) return row.amount;
    return row && row.subtotal;
  }));
}

function amountFromMainRow(row) {
  if (row && row.amount !== undefined) return optionalAmount(row.amount);
  return optionalAmount(row && row.subtotal);
}

function getMainRowsSource(order) {
  var source = order || {};
  var items = source.items || {};
  return items.mainRows || source.mainRows;
}

function getMainTileSegmentLengthFromOrder(order) {
  var source = order || {};
  var items = source.items || {};
  var value = optionalAmount(items.mainTileSegmentLength);
  if (Number.isFinite(value)) return value;
  return optionalAmount(source.mainTileSegmentLength);
}

function hasSegmentValue(text, target) {
  var values = compactText(text).match(/[+-]?(?:\d+\.\d+|\d+|\.\d+)/g) || [];
  return values.some(function (value) {
    var number = Number(value);
    return Number.isFinite(number) && Math.abs(number - target) < 0.0005;
  });
}

function classifySegmentLengthValue(value) {
  var number = optionalAmount(value);
  if (!Number.isFinite(number)) return "";
  if (Math.abs(number - 0.218) < 0.0005) return "red-wave";
  if (Math.abs(number - 0.219) < 0.0005) return "xingda";
  return "unknown";
}

function getPrioritySegmentLengthClassification(row) {
  var fields = ["segmentLength", "tileSegmentLength", "mainTileSegmentLength"];
  for (var index = 0; index < fields.length; index += 1) {
    var value = row && row[fields[index]];
    if (value === "" || value === null || value === undefined) continue;
    return classifySegmentLengthValue(value) || "unknown";
  }
  return "";
}

function collectMainTileRowSignals(row) {
  var redWave = false;
  var xingda = false;
  var textFields = [
    "lengthsText",
    "name",
    "spec",
    "model",
    "remark",
    "title",
    "segmentText",
    "segmentLengthText"
  ];
  var numericFields = [
    "segment",
    "segmentLength",
    "defaultSegmentLength",
    "tileSegment"
  ];

  numericFields.forEach(function (field) {
    var value = optionalAmount(row && row[field]);
    if (!Number.isFinite(value)) return;
    if (Math.abs(value - 0.218) < 0.0005) redWave = true;
    if (Math.abs(value - 0.219) < 0.0005) xingda = true;
  });

  textFields.forEach(function (field) {
    var value = compactText(row && row[field]);
    if (!value) return;
    if (value.indexOf("红波") !== -1) redWave = true;
    if (value.indexOf("星大") !== -1) xingda = true;
    if (hasSegmentValue(value, 0.218)) redWave = true;
    if (hasSegmentValue(value, 0.219)) xingda = true;
  });

  return {
    redWave: redWave,
    xingda: xingda
  };
}

export function classifyMainTileRow(row) {
  return getPrioritySegmentLengthClassification(row) || "unknown";
}

var TILE_BRAND_DEFINITIONS = [
  { key: "red-wave", label: "红波" },
  { key: "xingda", label: "星大" },
  { key: "unknown-tile", label: "未区分" }
];

var TILE_COLOR_DEFINITIONS = [
  { key: "jujube-red", label: "枣红" },
  { key: "brick-red", label: "砖红" },
  { key: "gray", label: "灰色" },
  { key: "unknown-color", label: "未区分" }
];

function classifyTileColor(value) {
  var text = compactText(value);
  if (text === "枣红") return "jujube-red";
  if (text === "砖红") return "brick-red";
  if (text === "灰色") return "gray";
  return "unknown-color";
}

function getTilePieView(options) {
  var view = typeof options === "string" ? options : options && options.tileView;
  return view === "color" || view === "combo" ? view : "brand";
}

function createSliceTotals(definitions) {
  return definitions.reduce(function (totals, item) {
    totals[item.key] = 0;
    return totals;
  }, {});
}

function addSliceTotal(totals, key, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  totals[key] = (Number.isFinite(totals[key]) ? totals[key] : 0) + amount;
}

function slicesFromDefinitions(definitions, totals) {
  return definitions.map(function (item) {
    return {
      key: item.key,
      label: item.label,
      value: totals[item.key]
    };
  });
}

function getTileBreakdownBrandEntries(tileBreakdown) {
  return [
    { key: "red-wave", value: tileBreakdown.redWaveAmount },
    { key: "xingda", value: tileBreakdown.xingdaAmount },
    { key: "unknown-tile", value: tileBreakdown.unknownTileAmount }
  ];
}

function getTileComboKey(brandKey, colorKey) {
  return brandKey + "-" + colorKey;
}

function buildComboSlices(totals) {
  var slices = [];
  TILE_BRAND_DEFINITIONS.forEach(function (brand) {
    TILE_COLOR_DEFINITIONS.forEach(function (color) {
      var key = getTileComboKey(brand.key, color.key);
      slices.push({
        key: key,
        label: brand.label + "-" + color.label,
        value: totals[key]
      });
    });
  });
  return slices;
}

function addTileBreakdownAmount(result, classification, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (classification === "red-wave") result.redWaveAmount += amount;
  else if (classification === "xingda") result.xingdaAmount += amount;
  else result.unknownTileAmount += amount;
}

function buildMainTileBreakdown(order, mainTileAmount) {
  var rows = Array.isArray(getMainRowsSource(order)) ? getMainRowsSource(order) : [];
  var fallbackSegmentLength = getMainTileSegmentLengthFromOrder(order);
  var targetTotal = optionalAmount(mainTileAmount);
  var result = {
    redWaveAmount: 0,
    xingdaAmount: 0,
    unknownTileAmount: 0
  };
  if (!rows.length) {
    addTileBreakdownAmount(result, "unknown", Number.isFinite(targetTotal) ? targetTotal : 0);
    return result;
  }

  var rowInfos = rows.map(function (row) {
    var sourceRow = row || {};
    if (Number.isFinite(fallbackSegmentLength) && !getPrioritySegmentLengthClassification(sourceRow)) {
      sourceRow = Object.assign({ mainTileSegmentLength: fallbackSegmentLength }, sourceRow);
    }
    return {
      row: sourceRow,
      classification: classifyMainTileRow(sourceRow),
      amount: amountFromMainRow(sourceRow),
      area: optionalAmount(sourceRow && sourceRow.area)
    };
  });
  var knownAmountTotal = sumFiniteAmounts(rowInfos.map(function (info) { return info.amount; }));
  if (!Number.isFinite(targetTotal)) targetTotal = knownAmountTotal;
  var amountScale = knownAmountTotal > targetTotal && targetTotal > 0 ? targetTotal / knownAmountTotal : 1;
  var assignedAmount = 0;

  rowInfos.forEach(function (info) {
    if (!Number.isFinite(info.amount)) return;
    var amount = info.amount * amountScale;
    assignedAmount += amount;
    addTileBreakdownAmount(result, info.classification, amount);
  });

  var remainingAmount = Math.max(0, targetTotal - assignedAmount);
  var unpricedRows = rowInfos.filter(function (info) { return !Number.isFinite(info.amount); });
  var unpricedAreaTotal = sumFiniteAmounts(unpricedRows.map(function (info) { return info.area; }));
  unpricedRows.forEach(function (info) {
    var amount = Number.isFinite(info.area) && info.area > 0 && unpricedAreaTotal > 0 ?
      remainingAmount * info.area / unpricedAreaTotal :
      0;
    assignedAmount += amount;
    addTileBreakdownAmount(result, info.classification, amount);
  });

  addTileBreakdownAmount(result, "unknown", Math.max(0, targetTotal - assignedAmount));
  return result;
}

function getTileAmountBreakdown(order, parts) {
  var main = buildMainTileBreakdown(order, parts.mainTileAmount);
  main.unknownTileAmount += parts.otherTileAmount;
  return main;
}

export function getOrderAmountParts(order) {
  var source = order || {};
  var totals = source.totals || {};
  var items = source.items || {};
  var mainTileAmount = amountWithFallback(totals.mainAmount, sumMainRowAmounts(items.mainRows || source.mainRows));
  var otherTileAmount = amountWithFallback(totals.otherTileAmount, sumLineSubtotals(items.otherTiles || source.otherTiles));
  var accessoryAmount = amountWithFallback(totals.accessoryAmount, sumLineSubtotals(items.accessories || source.accessories));
  var steelAmount = amountWithFallback(totals.steelAmount, sumLineSubtotals(items.steels || source.steels));
  return {
    mainTileAmount: mainTileAmount,
    otherTileAmount: otherTileAmount,
    tileAmount: mainTileAmount + otherTileAmount,
    accessoryAmount: accessoryAmount,
    steelAmount: steelAmount
  };
}

export function buildOrderPieData(orders, mode, options) {
  var tileOnly = mode === "tile";
  var tileView = getTilePieView(options);
  var tileBrandTotals = createSliceTotals(TILE_BRAND_DEFINITIONS);
  var tileColorTotals = createSliceTotals(TILE_COLOR_DEFINITIONS);
  var tileComboTotals = {};
  var totals = (Array.isArray(orders) ? orders : []).reduce(function (result, order) {
    var parts = getOrderAmountParts(order);
    var colorKey = classifyTileColor(order && order.tileColor);
    result.mainTileAmount += parts.mainTileAmount;
    result.otherTileAmount += parts.otherTileAmount;
    result.tileAmount += parts.tileAmount;
    result.accessoryAmount += parts.accessoryAmount;
    result.steelAmount += parts.steelAmount;
    var tileBreakdown = getTileAmountBreakdown(order, parts);
    result.redWaveAmount += tileBreakdown.redWaveAmount;
    result.xingdaAmount += tileBreakdown.xingdaAmount;
    result.unknownTileAmount += tileBreakdown.unknownTileAmount;
    getTileBreakdownBrandEntries(tileBreakdown).forEach(function (entry) {
      addSliceTotal(tileBrandTotals, entry.key, entry.value);
      addSliceTotal(tileComboTotals, getTileComboKey(entry.key, colorKey), entry.value);
    });
    addSliceTotal(tileColorTotals, colorKey, parts.tileAmount);
    return result;
  }, {
    mainTileAmount: 0,
    otherTileAmount: 0,
    tileAmount: 0,
    accessoryAmount: 0,
    steelAmount: 0,
    redWaveAmount: 0,
    xingdaAmount: 0,
    unknownTileAmount: 0
  });

  var slices = [
    { key: "tile", label: "瓦片", value: totals.tileAmount },
    { key: "accessory", label: "配件", value: totals.accessoryAmount },
    { key: "steel", label: "钢铁材料", value: totals.steelAmount }
  ];
  if (tileOnly && tileView === "color") {
    slices = slicesFromDefinitions(TILE_COLOR_DEFINITIONS, tileColorTotals);
  } else if (tileOnly && tileView === "combo") {
    slices = buildComboSlices(tileComboTotals);
  } else if (tileOnly) {
    slices = slicesFromDefinitions(TILE_BRAND_DEFINITIONS, tileBrandTotals);
  }

  slices = slices.filter(function (slice) {
    return Number.isFinite(slice.value) && slice.value > 0;
  });

  return {
    mode: tileOnly ? "tile" : "overview",
    tileView: tileOnly ? tileView : "",
    total: sumFiniteAmounts(slices.map(function (slice) { return slice.value; })),
    slices: slices
  };
}

function getTrendAmount(order) {
  return finiteNumber(order && order.totals && order.totals.grandAmount, 0);
}

function getOrderDateParts(order) {
  var text = compactText(order && order.orderDate);
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    year: year,
    month: month,
    day: day,
    key: text
  };
}

function normalizeTrendMode(mode) {
  if (mode === "quarter" || mode === "year") return mode;
  return "month";
}

function normalizeTrendYear(year, baseDate) {
  var number = Number(year);
  if (Number.isFinite(number) && number >= 1900 && number <= 9999) return Math.trunc(number);
  var date = baseDate instanceof Date ? baseDate : new Date(baseDate || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  return date.getFullYear();
}

function normalizeTrendMonth(month) {
  if (month === "" || month === null || month === undefined) return null;
  var number = Number(month);
  if (!Number.isFinite(number)) return null;
  number = Math.trunc(number);
  return number >= 1 && number <= 12 ? number : null;
}

function createTrendPoint(key, label) {
  return {
    key: key,
    label: label,
    count: 0,
    ordersCount: 0,
    amount: 0,
    value: 0
  };
}

function addOrderToTrendPoint(point, order) {
  var amount = getTrendAmount(order);
  point.count += 1;
  point.ordersCount = point.count;
  point.amount += amount;
  point.value = point.amount;
}

function finishTrendResult(mode, year, bucketType, points) {
  return {
    mode: mode,
    year: year,
    bucketType: bucketType,
    points: points,
    totalCount: sumFiniteAmounts(points.map(function (point) { return point.count; })),
    totalAmount: sumFiniteAmounts(points.map(function (point) { return point.amount; })),
    maxCount: Math.max(0, Math.max.apply(null, points.map(function (point) { return point.count; }))),
    maxAmount: Math.max(0, Math.max.apply(null, points.map(function (point) { return point.amount; })))
  };
}

export function getOrderTrendByMode(orders, options) {
  var settings = options || {};
  var mode = normalizeTrendMode(settings.mode);
  var year = normalizeTrendYear(settings.year, settings.baseDate);
  var list = Array.isArray(orders) ? orders : [];
  var points = [];
  var byKey = {};

  if (mode === "year") {
    list.forEach(function (order) {
      var parts = getOrderDateParts(order);
      if (!parts) return;
      var yearKey = String(parts.year);
      if (!byKey[yearKey]) {
        byKey[yearKey] = createTrendPoint(yearKey, yearKey);
      }
      addOrderToTrendPoint(byKey[yearKey], order);
    });
    points = Object.keys(byKey).sort().map(function (key) { return byKey[key]; });
    return finishTrendResult(mode, null, "year", points);
  }

  if (mode === "quarter") {
    for (var quarter = 1; quarter <= 4; quarter += 1) {
      var quarterKey = year + "-Q" + quarter;
      byKey[quarterKey] = createTrendPoint(quarterKey, "Q" + quarter);
      points.push(byKey[quarterKey]);
    }
    list.forEach(function (order) {
      var parts = getOrderDateParts(order);
      if (!parts || parts.year !== year) return;
      var key = year + "-Q" + Math.ceil(parts.month / 3);
      addOrderToTrendPoint(byKey[key], order);
    });
    return finishTrendResult(mode, year, "quarter", points);
  }

  for (var month = 1; month <= 12; month += 1) {
    var monthKey = year + "-" + String(month).padStart(2, "0");
    byKey[monthKey] = createTrendPoint(monthKey, String(month) + "月");
    points.push(byKey[monthKey]);
  }
  list.forEach(function (order) {
    var parts = getOrderDateParts(order);
    if (!parts || parts.year !== year) return;
    var key = year + "-" + String(parts.month).padStart(2, "0");
    addOrderToTrendPoint(byKey[key], order);
  });
  return finishTrendResult(mode, year, "month", points);
}

export function getOrdersInTrendModeRange(orders, options) {
  var settings = options || {};
  var mode = normalizeTrendMode(settings.mode);
  var year = normalizeTrendYear(settings.year, settings.baseDate);
  var month = mode === "month" ? normalizeTrendMonth(settings.month) : null;
  return (Array.isArray(orders) ? orders : []).filter(function (order) {
    var parts = getOrderDateParts(order);
    if (!parts) return false;
    if (mode === "year") return true;
    if (parts.year !== year) return false;
    if (mode === "month" && month) return parts.month === month;
    return true;
  });
}

export function getOrderTrend(orders, rangeKey, baseDate) {
  var list = Array.isArray(orders) ? orders : [];
  var range = rangeKey === "30d" || rangeKey === "1y" ? rangeKey : "7d";
  var today = createLocalDate(baseDate || new Date());
  var points = [];
  var byKey = {};
  var bucketType = range === "1y" ? "month" : "day";

  if (bucketType === "month") {
    var startMonth = addMonths(today, -11);
    for (var monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      var monthDate = addMonths(startMonth, monthIndex);
      var monthKey = getMonthKey(monthDate);
      byKey[monthKey] = {
        key: monthKey,
        label: getMonthLabel(monthDate),
        count: 0,
        amount: 0
      };
      points.push(byKey[monthKey]);
    }
    list.forEach(function (order) {
      var orderDate = createLocalDate(order && order.orderDate);
      var key = getMonthKey(orderDate);
      if (!byKey[key]) return;
      byKey[key].count += 1;
      byKey[key].amount += finiteNumber(order && order.totals && order.totals.grandAmount, 0);
    });
  } else {
    var days = range === "30d" ? 30 : 7;
    var startDay = addDays(today, -(days - 1));
    for (var dayIndex = 0; dayIndex < days; dayIndex += 1) {
      var dayDate = addDays(startDay, dayIndex);
      var dayKey = getDateOnly(dayDate);
      byKey[dayKey] = {
        key: dayKey,
        label: getDayLabel(dayDate),
        count: 0,
        amount: 0
      };
      points.push(byKey[dayKey]);
    }
    list.forEach(function (order) {
      var key = compactText(order && order.orderDate);
      if (!byKey[key]) return;
      byKey[key].count += 1;
      byKey[key].amount += finiteNumber(order && order.totals && order.totals.grandAmount, 0);
    });
  }

  return {
    range: range,
    bucketType: bucketType,
    points: points,
    totalCount: sumFiniteAmounts(points.map(function (point) { return point.count; })),
    totalAmount: sumFiniteAmounts(points.map(function (point) { return point.amount; })),
    maxCount: Math.max(0, Math.max.apply(null, points.map(function (point) { return point.count; }))),
    maxAmount: Math.max(0, Math.max.apply(null, points.map(function (point) { return point.amount; })))
  };
}

export function getOrdersInTrendRange(orders, rangeKey, baseDate) {
  var list = Array.isArray(orders) ? orders : [];
  var trend = getOrderTrend([], rangeKey, baseDate);
  var keys = {};
  trend.points.forEach(function (point) {
    keys[point.key] = true;
  });
  return list.filter(function (order) {
    var orderDate = createLocalDate(order && order.orderDate);
    var key = trend.bucketType === "month" ? getMonthKey(orderDate) : compactText(order && order.orderDate);
    return Boolean(keys[key]);
  });
}

export function buildExportPayload(orders, settings, meta) {
  return {
    app: EXPORT_APP_NAME,
    version: EXPORT_VERSION,
    exportedAt: nowIso(),
    orders: sortOrders((Array.isArray(orders) ? orders : []).map(normalizeOrder)),
    settings: settings || null,
    meta: meta || loadBackupMeta()
  };
}

export function readImportPayload(payload) {
  var source = payload;
  if (typeof payload === "string") {
    source = JSON.parse(payload);
  }
  if (Array.isArray(source)) {
    return { orders: source.map(normalizeOrder), settings: null, meta: {} };
  }
  if (!source || typeof source !== "object") {
    throw new Error("导入文件格式不正确。");
  }
  if (source.app && source.app !== EXPORT_APP_NAME) {
    throw new Error("导入文件不是当前工具的数据备份。");
  }
  if (!Array.isArray(source.orders)) {
    throw new Error("导入文件缺少 orders 数据。");
  }
  return {
    orders: source.orders.map(normalizeOrder),
    settings: source.settings || null,
    meta: source.meta && typeof source.meta === "object" ? source.meta : {}
  };
}

export function mergeOrders(existingOrders, importedOrders) {
  var map = {};
  (Array.isArray(existingOrders) ? existingOrders : []).map(normalizeOrder).forEach(function (order) {
    map[order.id] = order;
  });
  (Array.isArray(importedOrders) ? importedOrders : []).map(normalizeOrder).forEach(function (order) {
    map[order.id] = order;
  });
  return sortOrders(Object.keys(map).map(function (id) { return map[id]; }));
}

export function importOrdersFromPayload(payload, mode) {
  var parsed = readImportPayload(payload);
  var currentOrders = loadOrders();
  var nextOrders = mode === "replace" ? parsed.orders : mergeOrders(currentOrders, parsed.orders);
  saveOrders(nextOrders, { lastImportedAt: nowIso() });
  return {
    orders: nextOrders,
    importedCount: parsed.orders.length,
    settings: parsed.settings,
    meta: parsed.meta
  };
}
