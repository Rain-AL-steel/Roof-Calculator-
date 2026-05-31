export const DEFAULT_API_BASE_PATH = "/api";
export const API_TIMEOUT_MS = 20000;
export const ORDER_READ_TIMEOUT_MS = 15000;
export const ORDER_WRITE_TIMEOUT_MS = 20000;
export const ORDER_DELETE_TIMEOUT_MS = 20000;

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeConfiguredApiBaseUrl(value) {
  var baseUrl = trimTrailingSlash(value);
  if (!baseUrl) return "";
  try {
    var parsed = new URL(baseUrl);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname === "/") {
      return baseUrl + DEFAULT_API_BASE_PATH;
    }
  } catch (error) {
    if (/^https?:\/\/[^/]+$/i.test(baseUrl)) return baseUrl + DEFAULT_API_BASE_PATH;
  }
  return baseUrl;
}

function getRuntimeLocation() {
  try {
    return globalThis.location || null;
  } catch (error) {
    return null;
  }
}

function getRuntimeFetch() {
  try {
    return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
  } catch (error) {
    return null;
  }
}

export function getApiBaseUrl() {
  var configured = globalThis.ERP_API_BASE_URL || globalThis.__ERP_API_BASE_URL__;
  if (configured) return normalizeConfiguredApiBaseUrl(configured);

  var location = getRuntimeLocation();
  if (!location || location.protocol === "file:") return "";
  return DEFAULT_API_BASE_PATH;
}

export function isApiConfigured() {
  return Boolean(getRuntimeFetch() && getApiBaseUrl());
}

function buildApiUrl(path) {
  var baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("API is not configured.");
  var cleanPath = String(path || "").replace(/^\/+/, "");
  return trimTrailingSlash(baseUrl) + "/" + cleanPath;
}

function isFormDataBody(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

export function apiRequest(path, options) {
  var fetchApi = getRuntimeFetch();
  if (!fetchApi) return Promise.reject(new Error("Fetch API is not available."));

  var requestOptions = options || {};
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer = null;
  var didTimeout = false;
  var timeoutMs = requestOptions.timeoutMs || API_TIMEOUT_MS;
  if (controller) {
    requestOptions = Object.assign({}, requestOptions, { signal: controller.signal });
    timer = setTimeout(function () {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  var headers = Object.assign({ Accept: "application/json" }, requestOptions.headers || {});
  var body = requestOptions.body;
  if (body !== undefined && typeof body !== "string" && !isFormDataBody(body)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  var fetchOptions = Object.assign({}, requestOptions, {
    headers: headers,
    body: body
  });
  delete fetchOptions.timeoutMs;

  return fetchApi(buildApiUrl(path), fetchOptions).then(function (response) {
    if (timer) clearTimeout(timer);
    return response.text().then(function (text) {
      var data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(data && data.message ? data.message : "API request failed with status " + response.status + ".");
      }
      return data;
    });
  }).catch(function (error) {
    if (timer) clearTimeout(timer);
    if (didTimeout || (error && error.name === "AbortError")) {
      console.warn("[api-timeout]", {
        path: path,
        timeoutMs: timeoutMs,
        errorType: error && error.name ? error.name : "AbortError"
      });
    }
    throw error;
  });
}

export function fetchOrdersFromApi() {
  return apiRequest("/orders", {
    timeoutMs: ORDER_READ_TIMEOUT_MS
  });
}

export function saveOrderToApi(order) {
  return apiRequest("/orders", {
    method: "POST",
    timeoutMs: ORDER_WRITE_TIMEOUT_MS,
    body: order
  });
}

export function updateOrderToApi(orderId, order) {
  var id = encodeURIComponent(String(orderId || "").trim());
  return apiRequest("/orders/" + id, {
    method: "PUT",
    timeoutMs: ORDER_WRITE_TIMEOUT_MS,
    body: order
  });
}

export function deleteOrderFromApi(orderId) {
  var id = encodeURIComponent(String(orderId || "").trim());
  return apiRequest("/orders/" + id, {
    method: "DELETE",
    timeoutMs: ORDER_DELETE_TIMEOUT_MS
  });
}
