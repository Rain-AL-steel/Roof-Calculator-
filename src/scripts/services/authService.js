import { clearApiAuth, getApiAuthToken, getApiAuthUser, getDefaultApiUsername, hasApiRole, isApiConfigured, loginToApi } from "./apiClient.js";

export const AUTH_STORAGE_KEY = "erp_auth_v1";
export const AUTH_SESSION_KEY = "erp_auth_session_v1";
export const AUTH_VERSION = 1;
export const AUTH_ITERATIONS = 150000;

function getLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch (error) {
    return null;
  }
}

function getCrypto() {
  var cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.subtle || !cryptoApi.getRandomValues) {
    throw new Error("当前浏览器不支持安全密码存储，请升级浏览器后再试。");
  }
  return cryptoApi;
}

function bytesToBase64(bytes) {
  var binary = "";
  Array.prototype.forEach.call(bytes, function (byte) {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  var binary = atob(String(value || ""));
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

function assertPassword(password) {
  if (String(password || "").length < 4) {
    throw new Error("密码至少需要 4 位。");
  }
}

function timingSafeEqual(a, b) {
  var textA = String(a || "");
  var textB = String(b || "");
  if (textA.length !== textB.length) return false;
  var diff = 0;
  for (var i = 0; i < textA.length; i += 1) {
    diff |= textA.charCodeAt(i) ^ textB.charCodeAt(i);
  }
  return diff === 0;
}

export function createSalt() {
  var bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export async function hashPassword(password, salt, iterations) {
  var cryptoApi = getCrypto();
  var encoder = new TextEncoder();
  var key = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  var bits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBytes(salt),
      iterations: iterations || AUTH_ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function loadAuthRecord() {
  var storage = getLocalStorage();
  var raw = storage ? storage.getItem(AUTH_STORAGE_KEY) : "";
  var record = safeParseJson(raw, null);
  if (!record || typeof record !== "object") return null;
  if (!record.salt || !record.passwordHash) return null;
  return record;
}

export function hasAuthSetup() {
  if (isApiConfigured()) return true;
  return Boolean(loadAuthRecord());
}

export function getAuthUsernameDefault() {
  return getDefaultApiUsername();
}

export function isApiAuthConfigured() {
  return isApiConfigured();
}

export function isAuthenticated() {
  if (isApiConfigured()) return Boolean(getApiAuthToken());
  var record = loadAuthRecord();
  if (!record) return false;
  var session = safeParseJson(getSessionStorage() ? getSessionStorage().getItem(AUTH_SESSION_KEY) : "", null);
  return Boolean(session && session.passwordHash === record.passwordHash);
}

export function getCurrentAuthUser() {
  if (isApiConfigured()) return getApiAuthUser();
  return isAuthenticated() ? { username: "local", displayName: "本机管理员", roles: ["ADMIN"] } : null;
}

export function hasCurrentUserRole(role) {
  if (!isApiConfigured()) return isAuthenticated() && String(role || "").trim().toUpperCase() === "ADMIN";
  return hasApiRole(role);
}

export function logout() {
  clearApiAuth();
  var storage = getSessionStorage();
  if (storage) storage.removeItem(AUTH_SESSION_KEY);
}

export async function setupPassword(password, confirmPassword) {
  if (isApiConfigured()) {
    throw new Error("API 模式下请使用后端管理员账号登录。");
  }
  if (password !== confirmPassword) {
    throw new Error("两次输入的密码不一致。");
  }
  assertPassword(password);
  var salt = createSalt();
  var passwordHash = await hashPassword(password, salt, AUTH_ITERATIONS);
  var record = {
    version: AUTH_VERSION,
    iterations: AUTH_ITERATIONS,
    salt: salt,
    passwordHash: passwordHash,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  var storage = getLocalStorage();
  if (storage) storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record));
  await unlockWithRecord(record);
  return record;
}

async function unlockWithRecord(record) {
  var storage = getSessionStorage();
  if (storage) {
    storage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      passwordHash: record.passwordHash,
      unlockedAt: nowIso()
    }));
  }
}

export async function loginWithPassword(password, username) {
  if (isApiConfigured()) {
    try {
      return await loginToApi(String(username || "").trim() || getDefaultApiUsername(), password);
    } catch (error) {
      if (error && (error.message === "Failed to fetch" || error.name === "TypeError")) {
        throw new Error("无法连接登录服务。请启动本地后端，或在 runtime-config.js 中启用本机验证模式。");
      }
      throw error;
    }
  }
  var record = loadAuthRecord();
  if (!record) throw new Error("还没有设置登录密码。");
  var passwordHash = await hashPassword(password, record.salt, record.iterations || AUTH_ITERATIONS);
  if (!timingSafeEqual(passwordHash, record.passwordHash)) {
    throw new Error("密码不正确。");
  }
  await unlockWithRecord(record);
  return true;
}

export async function changePassword(currentPassword, nextPassword, confirmPassword) {
  if (isApiConfigured()) {
    throw new Error("API 模式下请在后端更新管理员密码。");
  }
  await loginWithPassword(currentPassword);
  return setupPassword(nextPassword, confirmPassword);
}

export function clearAuth() {
  var local = getLocalStorage();
  var session = getSessionStorage();
  clearApiAuth();
  if (local) local.removeItem(AUTH_STORAGE_KEY);
  if (session) session.removeItem(AUTH_SESSION_KEY);
}
