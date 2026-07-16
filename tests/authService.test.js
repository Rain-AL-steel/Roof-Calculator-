import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_KEY,
  getCurrentAuthUser,
  getAuthUsernameDefault,
  hasAuthSetup,
  hasCurrentUserRole,
  isApiAuthConfigured,
  isAuthenticated,
  loadAuthRecord,
  loginWithPassword,
  logout,
  setupPassword
} from "../src/scripts/services/authService.js";
import { clearApiAuth, getApiAuthToken } from "../src/scripts/services/apiClient.js";

var originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
var originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");

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

beforeEach(function () {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true
  });
  if (typeof globalThis.btoa !== "function") {
    Object.defineProperty(globalThis, "btoa", {
      value: function (text) { return Buffer.from(text, "binary").toString("base64"); },
      configurable: true
    });
  }
  if (typeof globalThis.atob !== "function") {
    Object.defineProperty(globalThis, "atob", {
      value: function (text) { return Buffer.from(text, "base64").toString("binary"); },
      configurable: true
    });
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorageMock(),
    configurable: true
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createStorageMock(),
    configurable: true
  });
});

afterEach(function () {
  if (originalFetchDescriptor) Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
  else delete globalThis.fetch;
  if (originalLocationDescriptor) Object.defineProperty(globalThis, "location", originalLocationDescriptor);
  else delete globalThis.location;
  delete globalThis.ERP_ADMIN_USERNAME;
  delete globalThis.__ERP_ADMIN_USERNAME__;
  delete globalThis.ERP_API_BASE_URL;
  delete globalThis.__ERP_API_BASE_URL__;
  clearApiAuth();
});

describe("auth service", function () {
  it("uses the entered API username when logging in and saves the token", async function () {
    var capturedBody = null;
    Object.defineProperty(globalThis, "location", {
      value: { protocol: "http:" },
      configurable: true
    });
    Object.defineProperty(globalThis, "fetch", {
      value: function (url, options) {
        capturedBody = JSON.parse(options.body);
        expect(url).toBe("/api/auth/login");
        return Promise.resolve({
          ok: true,
          status: 200,
          text: function () {
            return Promise.resolve(JSON.stringify({
              token: "api-token",
              tokenType: "Bearer",
              expiresIn: "8h",
              user: { username: capturedBody.username, displayName: "业务员", roles: ["USER"] }
            }));
          }
        });
      },
      configurable: true
    });

    await loginWithPassword("secret-password", "operator");

    expect(capturedBody).toEqual({
      username: "operator",
      password: "secret-password"
    });
    expect(getApiAuthToken()).toBe("api-token");
    expect(isAuthenticated()).toBe(true);
    expect(getCurrentAuthUser().displayName).toBe("业务员");
    expect(hasCurrentUserRole("USER")).toBe(true);
    expect(hasCurrentUserRole("ADMIN")).toBe(false);
  });

  it("falls back to the configured default API username when the username is blank", async function () {
    var capturedBody = null;
    globalThis.ERP_ADMIN_USERNAME = "configured-admin";
    Object.defineProperty(globalThis, "location", {
      value: { protocol: "http:" },
      configurable: true
    });
    Object.defineProperty(globalThis, "fetch", {
      value: function (url, options) {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: function () {
            return Promise.resolve(JSON.stringify({ token: "api-token" }));
          }
        });
      },
      configurable: true
    });

    expect(getAuthUsernameDefault()).toBe("configured-admin");
    await loginWithPassword("secret-password", " ");

    expect(capturedBody.username).toBe("configured-admin");
  });

  it("uses local password mode when the runtime API URL is explicitly blank", async function () {
    Object.defineProperty(globalThis, "location", {
      value: { protocol: "http:" },
      configurable: true
    });
    globalThis.ERP_API_BASE_URL = "";

    expect(isApiAuthConfigured()).toBe(false);
    await setupPassword("2468", "2468");
    expect(isAuthenticated()).toBe(true);
    expect(hasCurrentUserRole("ADMIN")).toBe(true);
  });

  it("shows a useful message when the configured login API cannot be reached", async function () {
    Object.defineProperty(globalThis, "location", {
      value: { protocol: "http:" },
      configurable: true
    });
    globalThis.ERP_API_BASE_URL = "http://127.0.0.1:3001";
    Object.defineProperty(globalThis, "fetch", {
      value: function () { return Promise.reject(new TypeError("Failed to fetch")); },
      configurable: true
    });

    await expect(loginWithPassword("secret-password", "admin")).rejects.toThrow("无法连接登录服务");
  });

  it("sets up a local password without storing plain text", async function () {
    await setupPassword("1234", "1234");
    var raw = globalThis.localStorage.getItem(AUTH_STORAGE_KEY);
    var record = loadAuthRecord();
    expect(hasAuthSetup()).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(raw).not.toContain("1234");
    expect(record.passwordHash).toBeTruthy();
    expect(record.salt).toBeTruthy();
    expect(getCurrentAuthUser().displayName).toBe("本机管理员");
    expect(hasCurrentUserRole("ADMIN")).toBe(true);
  });

  it("logs out and requires the correct password to unlock again", async function () {
    await setupPassword("2468", "2468");
    logout();
    expect(isAuthenticated()).toBe(false);
    await expect(loginWithPassword("1357")).rejects.toThrow("密码不正确");
    await loginWithPassword("2468");
    expect(isAuthenticated()).toBe(true);
  });

  it("rejects short or mismatched setup passwords", async function () {
    await expect(setupPassword("123", "123")).rejects.toThrow("至少需要 4 位");
    await expect(setupPassword("1234", "4321")).rejects.toThrow("不一致");
  });
});
