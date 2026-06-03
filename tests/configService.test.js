import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_STORAGE_KEY, defaultConfig } from "../src/scripts/config/defaultConfig.js";
import {
  loadConfig,
  loadConfigWithApiFallback,
  normalizeConfig,
  saveConfig,
  saveConfigWithApiFallback
} from "../src/scripts/services/configService.js";
import { clearApiAuth } from "../src/scripts/services/apiClient.js";

var originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
var originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
var originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
var originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
var originalCustomEventDescriptor = Object.getOwnPropertyDescriptor(globalThis, "CustomEvent");

function createStorageMock() {
  var data = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    },
    removeItem: function (key) {
      delete data[key];
    },
    clear: function () {
      data = {};
    }
  };
}

function createWindowMock(storage) {
  var listeners = {};
  return {
    localStorage: storage,
    addEventListener: function (type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    removeEventListener: function (type, listener) {
      listeners[type] = (listeners[type] || []).filter(function (entry) {
        return entry !== listener;
      });
    },
    dispatchEvent: function (event) {
      (listeners[event.type] || []).forEach(function (listener) {
        listener(event);
      });
      return true;
    }
  };
}

function restoreGlobalProperty(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

function useHttpApiRuntime(fetchImpl) {
  Object.defineProperty(globalThis, "location", {
    value: { protocol: "http:" },
    configurable: true
  });
  Object.defineProperty(globalThis, "fetch", {
    value: fetchImpl,
    configurable: true
  });
}

function jsonResponse(payload) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: function () {
      return Promise.resolve(JSON.stringify(payload));
    }
  });
}

function makeConfig(patch) {
  return normalizeConfig(Object.assign({}, defaultConfig, patch || {}));
}

function readStoredConfig() {
  return JSON.parse(globalThis.localStorage.getItem(CONFIG_STORAGE_KEY));
}

beforeEach(function () {
  var storage = createStorageMock();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true
  });
  Object.defineProperty(globalThis, "window", {
    value: createWindowMock(storage),
    configurable: true
  });
  Object.defineProperty(globalThis, "CustomEvent", {
    value: function CustomEvent(type, options) {
      this.type = type;
      this.detail = options && options.detail;
    },
    configurable: true
  });
});

afterEach(function () {
  restoreGlobalProperty("fetch", originalFetchDescriptor);
  restoreGlobalProperty("location", originalLocationDescriptor);
  restoreGlobalProperty("localStorage", originalLocalStorageDescriptor);
  restoreGlobalProperty("window", originalWindowDescriptor);
  restoreGlobalProperty("CustomEvent", originalCustomEventDescriptor);
  delete globalThis.ERP_API_BASE_URL;
  delete globalThis.__ERP_API_BASE_URL__;
  clearApiAuth();
});

describe("config service API fallback", function () {
  it("uses database config from the API before local config", async function () {
    saveConfig(makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Local Company" }) }));
    useHttpApiRuntime(function () {
      return jsonResponse({
        source: "database",
        config: {
          version: 1,
          basics: {
            companyName: "Remote Company"
          }
        }
      });
    });

    var config = await loadConfigWithApiFallback();

    expect(config.basics.companyName).toBe("Remote Company");
    expect(config.basics.fixedWidth).toBe(defaultConfig.basics.fixedWidth);
  });

  it("mirrors successful database config reads into localStorage", async function () {
    useHttpApiRuntime(function () {
      return jsonResponse({
        source: "database",
        config: {
          version: 1,
          mapSettings: {
            enabled: true,
            geocodeCity: "厦门市"
          }
        }
      });
    });

    await loadConfigWithApiFallback();
    var stored = readStoredConfig();

    expect(stored.mapSettings.enabled).toBe(true);
    expect(stored.mapSettings.geocodeCity).toBe("厦门市");
  });

  it("falls back to local config when the API source is default", async function () {
    saveConfig(makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Local Fallback" }) }));
    useHttpApiRuntime(function () {
      return jsonResponse({ source: "default", config: null });
    });

    var config = await loadConfigWithApiFallback();

    expect(config.basics.companyName).toBe("Local Fallback");
  });

  it("falls back to defaultConfig when the API source is default and localStorage is empty", async function () {
    useHttpApiRuntime(function () {
      return jsonResponse({ source: "default", config: null });
    });

    var config = await loadConfigWithApiFallback();

    expect(config.basics.companyName).toBe(defaultConfig.basics.companyName);
    expect(config.mapSettings.mapStyle).toBe(defaultConfig.mapSettings.mapStyle);
  });

  it("falls back to local config when the API request fails", async function () {
    saveConfig(makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Offline Local" }) }));
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("network unavailable"));
    });

    var config = await loadConfigWithApiFallback();

    expect(config.basics.companyName).toBe("Offline Local");
  });

  it("falls back to defaultConfig when the API request fails and localStorage is empty", async function () {
    useHttpApiRuntime(function () {
      return Promise.reject(new Error("network unavailable"));
    });

    var config = await loadConfigWithApiFallback();

    expect(config.basics.companyName).toBe(defaultConfig.basics.companyName);
  });

  it("saves config to the API first and mirrors the saved config locally", async function () {
    var requestedUrl = "";
    var requestedOptions = null;
    var config = makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Saved Remote" }) });
    useHttpApiRuntime(function (url, options) {
      requestedUrl = url;
      requestedOptions = options;
      return jsonResponse({ source: "database", config: config });
    });

    var saved = await saveConfigWithApiFallback(config);
    var stored = readStoredConfig();

    expect(requestedUrl).toBe("/api/config");
    expect(requestedOptions.method).toBe("PUT");
    expect(requestedOptions.body).toBe(JSON.stringify({ config: config }));
    expect(saved.basics.companyName).toBe("Saved Remote");
    expect(stored.basics.companyName).toBe("Saved Remote");
  });

  it("keeps user changes by saving locally when API save fails", async function () {
    var config = makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Saved Local" }) });
    useHttpApiRuntime(function () {
      return Promise.resolve({
        ok: false,
        status: 503,
        text: function () {
          return Promise.resolve(JSON.stringify({ code: "DATABASE_UNAVAILABLE", message: "Database unavailable" }));
        }
      });
    });

    var saved = await saveConfigWithApiFallback(config);
    var stored = readStoredConfig();

    expect(saved.basics.companyName).toBe("Saved Local");
    expect(stored.basics.companyName).toBe("Saved Local");
  });

  it("keeps existing synchronous loadConfig and saveConfig behavior", function () {
    var config = makeConfig({ basics: Object.assign({}, defaultConfig.basics, { companyName: "Sync Company" }) });

    var saved = saveConfig(config);
    var loaded = loadConfig();

    expect(saved.basics.companyName).toBe("Sync Company");
    expect(loaded.basics.companyName).toBe("Sync Company");
    expect(readStoredConfig().basics.companyName).toBe("Sync Company");
  });
});
