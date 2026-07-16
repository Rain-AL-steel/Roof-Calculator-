export const WORKING_DRAFT_APP = "redwave-roof-calculator-draft";
export const WORKING_DRAFT_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function normalizeOwner(owner) {
  return String(owner || "local").trim().toLowerCase() || "local";
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneDraft(draft) {
  if (!isObject(draft)) throw new Error("当前订单草稿格式不正确。");
  return JSON.parse(JSON.stringify(draft));
}

function createEnvelope(owner, draft, savedAt) {
  return {
    app: WORKING_DRAFT_APP,
    version: WORKING_DRAFT_VERSION,
    savedAt: savedAt || nowIso(),
    owner: normalizeOwner(owner),
    draft: cloneDraft(draft)
  };
}

function readEnvelope(payload, options) {
  var source = payload;
  if (typeof payload === "string") {
    try {
      source = JSON.parse(payload);
    } catch (_error) {
      throw new Error("草稿文件不是有效的 JSON 文件。");
    }
  }
  if (!isObject(source) || source.app !== WORKING_DRAFT_APP) {
    throw new Error("该文件不是红波计算机订单草稿。");
  }
  if (Number(source.version) !== WORKING_DRAFT_VERSION) {
    throw new Error("草稿文件版本不受支持。");
  }
  if (!isObject(source.draft)) {
    throw new Error("草稿文件缺少订单录入数据。");
  }
  var settings = options || {};
  if (settings.owner && normalizeOwner(source.owner) !== normalizeOwner(settings.owner)) {
    throw new Error("草稿不属于当前账号。");
  }
  return {
    app: WORKING_DRAFT_APP,
    version: WORKING_DRAFT_VERSION,
    savedAt: String(source.savedAt || ""),
    owner: normalizeOwner(source.owner),
    draft: cloneDraft(source.draft)
  };
}

function safeFilePart(value, fallback) {
  var text = String(value || "").trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
  return text || fallback;
}

export function exportWorkingDraft(owner, draft) {
  var envelope = createEnvelope(owner, draft);
  var order = isObject(draft.order) ? draft.order : {};
  var customer = safeFilePart(order.customerName, "未填写客户");
  var date = safeFilePart(order.orderDate, new Date().toISOString().slice(0, 10));
  return {
    fileName: "红波订单草稿_" + customer + "_" + date + ".json",
    json: JSON.stringify(envelope, null, 2),
    data: envelope
  };
}

export function parseWorkingDraftFile(payload) {
  return readEnvelope(payload);
}
