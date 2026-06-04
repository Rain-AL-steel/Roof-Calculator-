const AMAP_LOADER_URL = "https://webapi.amap.com/loader.js";
const DEFAULT_MAP_STYLE = "amap://styles/whitesmoke";
const QUANZHOU_CITY = "\u6cc9\u5dde";
const PUTIAN_CITY = "\u8386\u7530";

var loaderScriptPromise = null;
var amapLoadCache = {};

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function readLngLat(location) {
  if (!location) return null;
  var lng = location.lng !== undefined ? location.lng : (typeof location.getLng === "function" ? location.getLng() : null);
  var lat = location.lat !== undefined ? location.lat : (typeof location.getLat === "function" ? location.getLat() : null);
  lng = Number(lng);
  lat = Number(lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng: lng, lat: lat };
}

function detectSupportedGeocodeCity(value) {
  var text = compactText(value);
  if (!text) return "";
  if (text.indexOf(PUTIAN_CITY) !== -1 || /^3503/.test(text)) return PUTIAN_CITY;
  if (text.indexOf(QUANZHOU_CITY) !== -1 || /^3505/.test(text)) return QUANZHOU_CITY;
  return "";
}

export function resolvePreferredGeocodeCities(address, configuredCity) {
  var first = detectSupportedGeocodeCity(address) || detectSupportedGeocodeCity(configuredCity) || QUANZHOU_CITY;
  var fallback = first === PUTIAN_CITY ? QUANZHOU_CITY : PUTIAN_CITY;
  return [first, fallback];
}

function ensureAmapLoaderScript() {
  if (globalThis.AMapLoader) return Promise.resolve(globalThis.AMapLoader);
  if (loaderScriptPromise) return loaderScriptPromise;

  loaderScriptPromise = new Promise(function (resolve, reject) {
    var existingScript = document.querySelector("script[data-amap-loader='true']");
    if (existingScript) {
      existingScript.addEventListener("load", function () {
        if (globalThis.AMapLoader) resolve(globalThis.AMapLoader);
        else reject(new Error("\u9ad8\u5fb7\u5730\u56fe\u52a0\u8f7d\u5668\u4e0d\u53ef\u7528\u3002"));
      }, { once: true });
      existingScript.addEventListener("error", function () {
        reject(new Error("\u9ad8\u5fb7\u5730\u56fe\u52a0\u8f7d\u5668\u52a0\u8f7d\u5931\u8d25\u3002"));
      }, { once: true });
      return;
    }

    var script = document.createElement("script");
    script.src = AMAP_LOADER_URL;
    script.async = true;
    script.setAttribute("data-amap-loader", "true");
    script.onload = function () {
      if (globalThis.AMapLoader) resolve(globalThis.AMapLoader);
      else reject(new Error("\u9ad8\u5fb7\u5730\u56fe\u52a0\u8f7d\u5668\u4e0d\u53ef\u7528\u3002"));
    };
    script.onerror = function () {
      loaderScriptPromise = null;
      reject(new Error("\u9ad8\u5fb7\u5730\u56fe\u52a0\u8f7d\u5668\u52a0\u8f7d\u5931\u8d25\u3002"));
    };
    document.head.appendChild(script);
  });

  return loaderScriptPromise;
}

export function getAmapSettings(config) {
  var settings = config && config.mapSettings ? config.mapSettings : {};
  return {
    enabled: Boolean(settings.enabled),
    amapKey: compactText(settings.amapKey),
    securityJsCode: compactText(settings.securityJsCode),
    geocodeCity: compactText(settings.geocodeCity),
    mapStyle: compactText(settings.mapStyle) || DEFAULT_MAP_STYLE
  };
}

export function hasUsableAmapSettings(config) {
  var settings = getAmapSettings(config);
  return Boolean(settings.enabled && settings.amapKey && settings.securityJsCode);
}

export function loadAmap(config, plugins) {
  var settings = getAmapSettings(config);
  var pluginList = Array.isArray(plugins) ? plugins.slice() : [];
  if (!settings.enabled) return Promise.reject(new Error("\u9996\u9875\u5730\u56fe\u672a\u542f\u7528\u3002"));
  if (!settings.amapKey || !settings.securityJsCode) return Promise.reject(new Error("\u8bf7\u5728\u7cfb\u7edf\u7ba1\u7406\u4e2d\u586b\u5199\u9ad8\u5fb7 Key \u548c\u5b89\u5168\u5bc6\u94a5\u3002"));

  globalThis._AMapSecurityConfig = {
    securityJsCode: settings.securityJsCode
  };

  return ensureAmapLoaderScript().then(function (AMapLoader) {
    var cacheKey = settings.amapKey + "|" + settings.securityJsCode + "|" + pluginList.slice().sort().join(",");
    if (!amapLoadCache[cacheKey]) {
      amapLoadCache[cacheKey] = AMapLoader.load({
        key: settings.amapKey,
        version: "2.0",
        plugins: pluginList
      });
    }
    return amapLoadCache[cacheKey];
  });
}

export function resetAmapLoadCache() {
  amapLoadCache = {};
  if (!globalThis.AMapLoader) loaderScriptPromise = null;
}

function geocodeAddressWithCity(AMap, text, city) {
  return new Promise(function (resolve, reject) {
    var geocoder = new AMap.Geocoder({
      city: city
    });

    geocoder.getLocation(text, function (status, result) {
      var geocodes = result && Array.isArray(result.geocodes) ? result.geocodes : [];
      var first = geocodes[0];
      var lnglat = first ? readLngLat(first.location) : null;
      if (status === "complete" && result && result.info === "OK" && lnglat) {
        resolve({
          lng: lnglat.lng,
          lat: lnglat.lat,
          address: text,
          formattedAddress: compactText(first.formattedAddress) || text,
          province: compactText(first.province),
          city: compactText(first.city),
          district: compactText(first.district),
          adcode: compactText(first.adcode),
          geocodedAt: new Date().toISOString()
        });
        return;
      }
      reject(new Error("\u6536\u8d27\u5730\u5740\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5730\u5740\u662f\u5426\u5b8c\u6574\u3002"));
    });
  });
}

export function geocodeDeliveryAddress(address, config) {
  var text = compactText(address);
  if (!text || !hasUsableAmapSettings(config)) return Promise.resolve(null);

  return loadAmap(config, ["AMap.Geocoder"]).then(function (AMap) {
    var settings = getAmapSettings(config);
    var cities = resolvePreferredGeocodeCities(text, settings.geocodeCity);

    return cities.reduce(function (chain, city) {
      return chain.catch(function () {
        return geocodeAddressWithCity(AMap, text, city);
      });
    }, Promise.reject(null));
  });
}
