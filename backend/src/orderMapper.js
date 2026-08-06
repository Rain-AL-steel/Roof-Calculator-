const ORDER_INCLUDE = {
  mainRows: { orderBy: { sort: "asc" } },
  lineItems: { orderBy: { sort: "asc" } },
  mapLocationCache: true,
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } }
};

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createPayloadValidationError(code, message) {
  var error = new Error(message);
  error.name = "PayloadValidationError";
  error.code = code;
  error.statusCode = 400;
  return error;
}

function roundDecimal(value, digits) {
  var factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function requirePositiveNumber(value, code, fieldName, maxValue) {
  var number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || (maxValue && number > maxValue)) {
    throw createPayloadValidationError(code, fieldName + " must be a positive number.");
  }
  return number;
}

function requireDecimalRange(value, maxValue, code, fieldName) {
  if (!Number.isFinite(value) || value < 0 || value > maxValue) {
    throw createPayloadValidationError(code, fieldName + " exceeds the supported amount range.");
  }
  return value;
}

function validateTextLength(value, maxLength, code, fieldName) {
  var text = compactText(value);
  if (text.length > maxLength) {
    throw createPayloadValidationError(code, fieldName + " is too long.");
  }
  return text;
}

function requireText(value, maxLength, code, fieldName) {
  var text = validateTextLength(value, maxLength, code, fieldName);
  if (!text) {
    throw createPayloadValidationError(code, fieldName + " is required.");
  }
  return text;
}

function optionalText(value, maxLength, code, fieldName) {
  return validateTextLength(value, maxLength, code, fieldName) || null;
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
  if (!text) return null;
  var match = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (!match) {
    throw createPayloadValidationError("INVALID_COMPLETION_MONTH", "completionMonth must use YYYY-MM format.");
  }
  var month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw createPayloadValidationError("INVALID_COMPLETION_MONTH", "completionMonth must be a valid calendar month.");
  }
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

function validateResolvedSegmentLength(value, fieldName) {
  if (value === null || value <= 0) return null;
  return roundDecimal(requirePositiveNumber(value, "INVALID_MAIN_ROW_SEGMENT_LENGTH", fieldName, 9999.9999), 4);
}

function resolveMainRowSegmentLength(row, fallbackSegmentLength, rowNumber) {
  var source = row || {};
  var segmentLength = toNullableFiniteNumber(source.segmentLength);
  if (segmentLength !== null && segmentLength > 0) {
    return validateResolvedSegmentLength(segmentLength, "mainRows[" + rowNumber + "].segmentLength");
  }
  segmentLength = toNullableFiniteNumber(source.tileSegmentLength);
  if (segmentLength !== null && segmentLength > 0) {
    return validateResolvedSegmentLength(segmentLength, "mainRows[" + rowNumber + "].tileSegmentLength");
  }
  return validateResolvedSegmentLength(fallbackSegmentLength, "items.mainTileSegmentLength");
}

function hasAttemptedNumericValue(value) {
  if (value === "" || value === null || value === undefined) return false;
  var number = Number(value);
  return !Number.isFinite(number) || number !== 0;
}

function isAttemptedMainRow(row) {
  var source = row || {};
  var lengthText = compactText(source.lengthsText);
  var numericLength = Number(lengthText);
  return Boolean(lengthText && (!Number.isFinite(numericLength) || numericLength !== 0)) ||
    Boolean(compactText(source.name || source.productName || source.product || source.spec)) ||
    [source.totalQty, source.actual, source.area, source.amount].some(hasAttemptedNumericValue);
}

function validateLengthsText(value, rowNumber) {
  var text = compactText(value);
  var lengths = text.split(/[,，]/).map(function (part) { return Number(part.trim()); });
  if (!text || !lengths.length || lengths.some(function (length) { return !Number.isFinite(length) || length <= 0; })) {
    throw createPayloadValidationError("INVALID_MAIN_ROW_LENGTH", "mainRows[" + rowNumber + "].lengthsText must contain positive lengths.");
  }
  return text;
}

function normalizeMainRows(rows, mainTileSegmentLength) {
  var fallbackSegmentLength = toNullableFiniteNumber(mainTileSegmentLength);
  return (Array.isArray(rows) ? rows : []).filter(isAttemptedMainRow).map(function (row, index) {
    var source = row || {};
    return {
      sort: (index + 1) * 10,
      lengthsText: validateLengthsText(source.lengthsText, index),
      totalQty: roundDecimal(requirePositiveNumber(source.totalQty, "INVALID_MAIN_ROW_QUANTITY", "mainRows[" + index + "].totalQty", 9999999999), 4),
      actual: roundDecimal(requirePositiveNumber(source.actual, "INVALID_MAIN_ROW_ACTUAL", "mainRows[" + index + "].actual", 9999999999), 4),
      area: roundDecimal(requirePositiveNumber(source.area, "INVALID_MAIN_ROW_AREA", "mainRows[" + index + "].area", 9999999999), 4),
      segmentLength: resolveMainRowSegmentLength(source, fallbackSegmentLength, index)
    };
  });
}

function isAttemptedLineItem(item, withLength) {
  var source = item || {};
  return Boolean(compactText(source.name)) ||
    hasAttemptedNumericValue(source.qty) ||
    hasAttemptedNumericValue(source.price) ||
    (withLength && hasAttemptedNumericValue(source.length));
}

function normalizeLineItems(items, type, withLength) {
  return (Array.isArray(items) ? items : []).filter(function (item) {
    return isAttemptedLineItem(item, withLength);
  }).map(function (item, index) {
    var source = item || {};
    var fieldPrefix = type.toLowerCase() + "Items[" + index + "]";
    var qty = roundDecimal(requirePositiveNumber(source.qty, "INVALID_LINE_ITEM_QUANTITY", fieldPrefix + ".qty", 9999999999), 4);
    var price = roundDecimal(requirePositiveNumber(source.price, "INVALID_LINE_ITEM_PRICE", fieldPrefix + ".price", 999999999999), 2);
    var next = {
      type: type,
      sort: (index + 1) * 10,
      nameSnapshot: requireText(source.name, 160, "INVALID_LINE_ITEM_NAME", fieldPrefix + ".name"),
      unitSnapshot: requireText(source.unit, 40, "INVALID_LINE_ITEM_UNIT", fieldPrefix + ".unit"),
      qty: qty,
      price: price
    };
    if (withLength) {
      next.length = roundDecimal(requirePositiveNumber(source.length, "INVALID_LINE_ITEM_LENGTH", fieldPrefix + ".length", 9999999999), 4);
      next.subtotal = requireDecimalRange(roundDecimal(next.length * qty * price, 2), 999999999999.99, "INVALID_LINE_ITEM_SUBTOTAL", fieldPrefix + ".subtotal");
    } else {
      next.subtotal = requireDecimalRange(roundDecimal(qty * price, 2), 999999999999.99, "INVALID_LINE_ITEM_SUBTOTAL", fieldPrefix + ".subtotal");
    }
    return next;
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

function userToFrontend(user, fallbackId) {
  if (!user && !fallbackId) return null;
  return {
    id: user && user.id ? user.id : fallbackId,
    username: user && user.username ? user.username : "",
    displayName: user && user.displayName ? user.displayName : ""
  };
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
    createdBy: userToFrontend(order.createdBy, order.createdById),
    updatedBy: userToFrontend(order.updatedBy, order.updatedById),
    orderDate: getDateOnly(order.orderDate),
    customerName: order.customerName || "",
    tileColor: order.tileColor || "",
    steelCategory: order.steelCategory || "",
    galvanizingProcess: order.galvanizingProcess || "",
    deliveryMethod: order.deliveryMethod || "",
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
  var orderDate = source.orderDate || settings.orderDate;
  var mainRows = normalizeMainRows(items.mainRows || source.mainRows, items.mainTileSegmentLength);
  var accessories = normalizeLineItems(items.accessories || source.accessories, "ACCESSORY", false);
  var steels = normalizeLineItems(items.steels || source.steels, "STEEL", false);
  var otherTiles = normalizeLineItems(items.otherTiles || source.otherTiles, "OTHER_TILE", true);
  var customerName = requireText(source.customerName, 120, "CUSTOMER_NAME_REQUIRED", "customerName");
  if (!orderDate || !compactText(orderDate)) {
    throw createPayloadValidationError("ORDER_DATE_REQUIRED", "orderDate is required.");
  }
  if (!mainRows.length && !accessories.length && !steels.length && !otherTiles.length) {
    throw createPayloadValidationError("ORDER_ITEMS_REQUIRED", "At least one valid order item is required.");
  }

  var areaTotal = requireDecimalRange(roundDecimal(mainRows.reduce(function (sum, row) { return sum + row.area; }, 0), 4), 9999999999.9999, "INVALID_AREA_TOTAL", "totals.areaTotal");
  var mainAmount = mainRows.length
    ? roundDecimal(requirePositiveNumber(totals.mainAmount, "INVALID_MAIN_AMOUNT", "totals.mainAmount", 999999999999), 2)
    : 0;
  var accessoryAmount = requireDecimalRange(roundDecimal(accessories.reduce(function (sum, item) { return sum + item.subtotal; }, 0), 2), 999999999999.99, "INVALID_ACCESSORY_AMOUNT", "totals.accessoryAmount");
  var steelAmount = requireDecimalRange(roundDecimal(steels.reduce(function (sum, item) { return sum + item.subtotal; }, 0), 2), 999999999999.99, "INVALID_STEEL_AMOUNT", "totals.steelAmount");
  var otherTileAmount = requireDecimalRange(roundDecimal(otherTiles.reduce(function (sum, item) { return sum + item.subtotal; }, 0), 2), 999999999999.99, "INVALID_OTHER_TILE_AMOUNT", "totals.otherTileAmount");
  var grandAmount = requireDecimalRange(roundDecimal(mainAmount + accessoryAmount + steelAmount + otherTileAmount, 2), 999999999999.99, "INVALID_GRAND_AMOUNT", "totals.grandAmount");

  return {
    orderData: {
      orderDate: parseDateOnly(orderDate),
      customerName: customerName,
      tileColor: optionalText(source.tileColor, 100, "INVALID_TILE_COLOR", "tileColor"),
      steelCategory: optionalText(source.steelCategory, 100, "INVALID_STEEL_CATEGORY", "steelCategory"),
      galvanizingProcess: optionalText(source.galvanizingProcess, 100, "INVALID_GALVANIZING_PROCESS", "galvanizingProcess"),
      deliveryMethod: optionalText(source.deliveryMethod, 100, "INVALID_DELIVERY_METHOD", "deliveryMethod"),
      remark: optionalText(source.remark, 1000, "INVALID_REMARK", "remark"),
      deliveryAddress: optionalText(source.deliveryAddress, 500, "INVALID_DELIVERY_ADDRESS", "deliveryAddress"),
      completionMonth: normalizeMonthString(source.completionMonth),
      areaTotal: areaTotal,
      mainAmount: mainAmount,
      accessoryAmount: accessoryAmount,
      steelAmount: steelAmount,
      otherTileAmount: otherTileAmount,
      grandAmount: grandAmount
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
