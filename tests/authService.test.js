import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_KEY,
  hasAuthSetup,
  isAuthenticated,
  loadAuthRecord,
  loginWithPassword,
  logout,
  setupPassword
} from "../src/scripts/services/authService.js";

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

describe("auth service", function () {
  it("sets up a local password without storing plain text", async function () {
    await setupPassword("1234", "1234");
    var raw = globalThis.localStorage.getItem(AUTH_STORAGE_KEY);
    var record = loadAuthRecord();
    expect(hasAuthSetup()).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(raw).not.toContain("1234");
    expect(record.passwordHash).toBeTruthy();
    expect(record.salt).toBeTruthy();
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
