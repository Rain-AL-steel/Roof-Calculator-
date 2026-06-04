const ORDER_INCLUDE = {
  mainRows: { orderBy: { sort: "asc" } },
  lineItems: { orderBy: { sort: "asc" } },
  mapLocationCache: true
};

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nullableText(value) {
  var text = compactText(value);
  return text || null;
}

function createPayloadValidationError(code, message) {
  var error = new Error(message);
  error.name = "PayloadValidationError";
  error.code = code;
  error.statusCode = 400;
  return error;
}

function toNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function toNullableNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNullableFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  var date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function dateOnlyFromDate(date) {
  return date.getUTCFullYear() + "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(date.getUTCDate()).padStart(2, "0");
}

export function getDateOnly(value) {
  if (value instanceof Date) return dateOnlyFromDate(value);
  var text = compactText(value);
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return text;
  var date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) date = new Date();
  return dateOnlyFromDate(date);
}

function parseDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw createPayloadValidationError("INVALID_ORDER_DATE", "orderDate must be a valid date.");
    }
    return new Date(dateOnlyFromDate(value) + "T00:00:00.000Z");
  }

  var text = compactText(value);
  if (!text) return new Date(getDateOnly(new Date()) + "T00:00:00.000Z");

  var match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (!match) {
    throw createPayloadValidationError("INVALID_ORDER_DATE", "orderDate must use YYYY-MM-DD or YYYY/MM/DD format.");
  }

  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createPayloadValidationError("INVALID_ORDER_DATE", "orderDate must be a valid calendar date.");
  }
  return date;
}

function normalizeMonthString(value) {
  var text = compactText(value).replace(/\//g, "-");
  var match = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (!match) return null;
  var month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return match[1] + "-" + String(month).padStart(2, "0");
}

function normalizeDeliveryLocation(order) {
  var source = order && order.deliveryLocation ? order.deliveryLocation : null;
  if (!source) return null;
  var lng = toNullableNumber(source.lng !== undefined ? source.lng : source.longitude);
  var lat = toNullableNumber(source.lat !== undefined ? source.lat : source.latitude);
  if (lng === null || lat === null) return null;
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

function hasUsefulLengthText(value) {
  var text = compactText(value);
  if (!text) return false;
  var numeric = Number(text);
  return !Number.isFinite(numeric) || numeric > 0;
}

function resolveMainRowSegmentLength(row, fallbackSegmentLength) {
  var source = row || {};
  var segmentLength = toNullableFiniteNumber(source.segmentLength);
  if (segmentLength !== null) return segmentLength;
  segmentLength = toNullableFiniteNumber(source.tileSegmentLength);
  if (segmentLength !== null) return segmentLength;
  return fallbackSegmentLength;
}

function normalizeMainRows(rows, mainTileSegmentLength) {
  var fallbackSegmentLength = toNullableFiniteNumber(mainTileSegmentLength);
  return (Array.isArray(rows) ? rows : []).map(function (row, index) {
    var source = row || {};
    return {
      sort: (index + 1) * 10,
      lengthsText: nullableText(source.lengthsText),
      totalQty: toNumber(source.totalQty, 0),
      actual: toNumber(source.actual, 0),
      area: toNumber(source.area, 0),
      segmentLength: resolveMainRowSegmentLength(source, fallbackSegmentLength),
      hasUsefulLengthText: hasUsefulLengthText(source.lengthsText),
      productText: compactText(source.name || source.productName || source.product || source.spec),
      amount: toNumber(source.amount, 0)
    };
  }).filter(function (row) {
    return row.hasUsefulLengthText || row.productText || row.totalQty || row.actual || row.area || row.amount;
  }).map(function (row) {
    return {
      sort: row.sort,
      lengthsText: row.lengthsText,
      totalQty: row.totalQty,
      actual: row.actual,
      area: row.area,
      segmentLength: row.segmentLength
    };
  });
}

function normalizeLineItems(items, type, withLength) {
  return (Array.isArray(items) ? items : []).map(function (item, index) {
    var next = {
      type: type,
      sort: (index + 1) * 10,
      nameSnapshot: compactText(item && item.name),
      unitSnapshot: nullableText(item && item.unit),
      qty: toNumber(item && item.qty, 0),
      price: toNumber(item && item.price, 0),
      subtotal: toNumber(item && item.subtotal, 0)
    };
    if (withLength) next.length = toNumber(item && item.length, 0);
    return next;
  }).filter(function (item) {
    return item.nameSnapshot || item.qty || item.price || item.subtotal;
  });
}

export function createOrderNo(date) {
  var source = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(source.getTime())) source = new Date();
  return "ORD-" +
    source.getFullYear() +
    String(source.getMonth() + 1).padStart(2, "0") +
    String(source.getDate()).padStart(2, "0") +
    "-" +
    String(source.getHours()).padStart(2, "0") +
    String(source.getMinutes()).padStart(2, "0") +
    String(source.getSeconds()).padStart(2, "0") +
    String(source.getMilliseconds()).padStart(3, "0") +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase();
}

function decimalToNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function decimalToNullableNumber(value) {
  if (value === null || value === undefined) return null;
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function lineItemToFrontend(item) {
  var result = {
    name: item.nameSnapshot || "",
    qty: decimalToNumber(item.qty),
    unit: item.unitSnapshot || "",
    price: decimalToNumber(item.price),
    subtotal: decimalToNumber(item.subtotal)
  };
  if (item.type === "OTHER_TILE") result.length = decimalToNumber(item.length);
  return result;
}

export function toFrontendOrder(order) {
  var lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  var location = order.mapLocationCache;
  return {
    id: order.id,
    orderNo: order.orderNo,
    clientOrderId: order.clientOrderId || "",
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    orderDate: getDateOnly(order.orderDate),
    customerName: order.customerName || "",
    tileColor: order.tileColor || "",
    remark: order.remark || "",
    deliveryAddress: order.deliveryAddress || "",
    completionMonth: order.completionMonth || "",
    deliveryLocation: location && location.lng !== null && location.lat !== null ? {
      lng: decimalToNumber(location.lng),
      lat: decimalToNumber(location.lat),
      address: location.sourceAddress || "",
      formattedAddress: location.formattedAddress || "",
      province: location.province || "",
      city: location.city || "",
      district: location.district || "",
      adcode: location.adcode || "",
      geocodedAt: toIso(location.geocodedAt)
    } : null,
    totals: {
      areaTotal: decimalToNumber(order.areaTotal),
      mainAmount: decimalToNumber(order.mainAmount),
      accessoryAmount: decimalToNumber(order.accessoryAmount),
      steelAmount: decimalToNumber(order.steelAmount),
      otherTileAmount: decimalToNumber(order.otherTileAmount),
      grandAmount: decimalToNumber(order.grandAmount)
    },
    items: {
      mainRows: (Array.isArray(order.mainRows) ? order.mainRows : []).map(function (row) {
        return {
          lengthsText: row.lengthsText || "",
          totalQty: decimalToNumber(row.totalQty),
          actual: decimalToNumber(row.actual),
          area: decimalToNumber(row.area),
          segmentLength: decimalToNullableNumber(row.segmentLength)
        };
      }),
      accessories: lineItems.filter(function (item) { return item.type === "ACCESSORY"; }).map(lineItemToFrontend),
      steels: lineItems.filter(function (item) { return item.type === "STEEL"; }).map(lineItemToFrontend),
      otherTiles: lineItems.filter(function (item) { return item.type === "OTHER_TILE"; }).map(lineItemToFrontend)
    }
  };
}

export function buildOrderPayload(input, options) {
  var source = input || {};
  var settings = options || {};
  var items = source.items || {};
  var totals = source.totals || {};
  var orderDate = source.orderDate || settings.orderDate || new Date();
  var mainRows = normalizeMainRows(items.mainRows || source.mainRows, items.mainTileSegmentLength);
  var accessories = normalizeLineItems(items.accessories || source.accessories, "ACCESSORY", false);
  var steels = normalizeLineItems(items.steels || source.steels, "STEEL", false);
  var otherTiles = normalizeLineItems(items.otherTiles || source.otherTiles, "OTHER_TILE", true);

  return {
    orderData: {
      orderDate: parseDateOnly(orderDate),
      customerName: nullableText(source.customerName),
      tileColor: nullableText(source.tileColor),
      remark: nullableText(source.remark),
      deliveryAddress: nullableText(source.deliveryAddress),
      completionMonth: normalizeMonthString(source.completionMonth),
      areaTotal: toNumber(totals.areaTotal, 0),
      mainAmount: toNumber(totals.mainAmount, 0),
      accessoryAmount: toNumber(totals.accessoryAmount, 0),
      steelAmount: toNumber(totals.steelAmount, 0),
      otherTileAmount: toNumber(totals.otherTileAmount, 0),
      grandAmount: toNumber(totals.grandAmount, (
        toNumber(totals.mainAmount, 0) +
        toNumber(totals.accessoryAmount, 0) +
        toNumber(totals.steelAmount, 0) +
        toNumber(totals.otherTileAmount, 0)
      ))
    },
    mainRows: mainRows,
    lineItems: accessories.concat(steels, otherTiles),
    deliveryLocation: normalizeDeliveryLocation(source),
    nextOrderNo: settings.orderNo || createOrderNo(new Date())
  };
}

export function getOrderInclude() {
  return ORDER_INCLUDE;
}
