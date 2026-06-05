const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
const DEEPSEEK_TIMEOUT_MS = 12000;
const DEEPSEEK_FALLBACK_MESSAGE = "AI评分暂不可用，本地裁板方案仍可使用";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  var prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compactText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 500);
}

function toNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getDeepSeekModel() {
  return String(process.env.DEEPSEEK_MODEL || "").trim() || DEEPSEEK_DEFAULT_MODEL;
}

function sanitizeCut(cut) {
  var source = isPlainObject(cut) ? cut : {};
  return {
    description: compactText(source.description, 180),
    repeat: Math.max(1, Math.trunc(toNumber(source.repeat, 1))),
    wasteSegments: Math.max(0, Math.trunc(toNumber(source.wasteSegments, 0))),
    usedSegments: Math.max(0, Math.trunc(toNumber(source.usedSegments, 0)))
  };
}

function sanitizePlan(plan) {
  var source = isPlainObject(plan) ? plan : {};
  return {
    title: compactText(source.title, 80),
    boardCount: Math.max(0, Math.trunc(toNumber(source.boardCount, 0))),
    totalWasteSegments: Math.max(0, Math.trunc(toNumber(source.totalWasteSegments, 0))),
    fullBoardCount: Math.max(0, Math.trunc(toNumber(source.fullBoardCount, 0))),
    summaryText: compactText(source.summaryText, 220),
    cuts: (Array.isArray(source.cuts) ? source.cuts : []).slice(0, 8).map(sanitizeCut)
  };
}

export function buildDeepSeekCuttingPrompt(input) {
  var source = isPlainObject(input) ? input : {};
  var payload = {
    stockSegments: Math.max(1, Math.trunc(toNumber(source.stockSegments, 60))),
    recommendedPlan: sanitizePlan(source.recommendedPlan),
    plans: (Array.isArray(source.plans) ? source.plans : []).slice(0, 3).map(sanitizePlan)
  };
  return [
    "你是树脂瓦裁板方案评分助手。系统已经用本地算法算好了裁板方案。",
    "你不能重新计算裁板方案，不能新增、修改、编造任何节数、数量、米数或切法。",
    "你只给本地推荐方案一个参考分数和极短标签，不写推荐理由，不写裁切提醒，不写长段建议。",
    "分数范围 1-10，保留 1 位小数。标签只能从：推荐、可用、一般、不建议 中选择。",
    "请输出严格 JSON，不要 Markdown。格式：{\"score\":8.7,\"label\":\"可用\"}。",
    JSON.stringify(payload)
  ].join("\n");
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function looksLikeRawJson(text) {
  var content = String(text || "").trim();
  return /^```/.test(content) ||
    /^[\[{"]/.test(content) ||
    /["']score["']\s*:/.test(content) ||
    /["']label["']\s*:/.test(content) ||
    /["']summary["']\s*:/.test(content) ||
    /["']reasons["']\s*:/.test(content) ||
    /["']cautions["']\s*:/.test(content) ||
    /\\"score\\"\s*:/.test(content) ||
    /\\"label\\"\s*:/.test(content) ||
    /\\"summary\\"\s*:/.test(content) ||
    /\\"reasons\\"\s*:/.test(content) ||
    /\\"cautions\\"\s*:/.test(content);
}

function parseEvaluationJson(value, depth) {
  if (depth > 4) return null;
  if (isPlainObject(value)) return value;
  if (typeof value !== "string") return null;

  var content = String(value || "").trim();
  if (!content) return null;

  var parsed = safeParseJson(content);
  if (parsed !== null) {
    var nestedParsed = parseEvaluationJson(parsed, depth + 1);
    if (nestedParsed) return nestedParsed;
  }

  var fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  if (fenceMatch) {
    var fencedParsed = parseEvaluationJson(fenceMatch[1], depth + 1);
    if (fencedParsed) return fencedParsed;
  }

  var objectMatch = /\{[\s\S]*\}/.exec(content);
  if (objectMatch) {
    var objectParsed = parseEvaluationJson(objectMatch[0], depth + 1);
    if (objectParsed) return objectParsed;
  }

  return null;
}

function normalizeAiScore(value) {
  var raw = value;
  if (typeof raw === "string") {
    var match = /-?\d+(?:\.\d+)?/.exec(raw);
    raw = match ? match[0] : raw;
  }
  var score = Number(raw);
  if (!Number.isFinite(score)) return null;
  var clamped = Math.min(10, Math.max(1, score));
  return Math.round(clamped * 10) / 10;
}

function deriveAiLabel(score) {
  if (!Number.isFinite(score)) return "";
  if (score >= 9) return "推荐";
  if (score >= 7) return "可用";
  if (score >= 5) return "一般";
  return "不建议";
}

function normalizeAiLabel(value, score) {
  var text = compactText(value, 20);
  var labels = ["推荐", "可用", "一般", "不建议"];
  var match = labels.find(function (label) {
    return text.indexOf(label) !== -1;
  });
  return match || deriveAiLabel(score);
}

function normalizeEvaluationObject(value) {
  if (!isPlainObject(value)) return null;
  var nestedScore = parseEvaluationJson(value.score, 0);
  if (nestedScore) return normalizeEvaluationObject(nestedScore);
  var score = normalizeAiScore(value.score);
  if (score === null) score = normalizeAiScore(value.aiScore);
  if (score === null && /评分|score/i.test(String(value.text || ""))) {
    score = normalizeAiScore(value.text);
  }
  if (score === null) return null;
  return {
    score: score,
    label: normalizeAiLabel(value.label || value.tag || value.summary || value.text, score)
  };
}

export function parseDeepSeekEvaluation(text) {
  var content = compactText(text, 2000);
  var parsed = parseEvaluationJson(content, 0);
  var normalized = normalizeEvaluationObject(parsed);
  if (normalized) return normalized;
  if (content && !looksLikeRawJson(content)) {
    var score = normalizeAiScore(content);
    if (score !== null) {
      return {
        score: score,
        label: normalizeAiLabel(content, score)
      };
    }
  }
  return {
    score: null,
    label: ""
  };
}

function hasUsableEvaluation(evaluation) {
  return Boolean(evaluation && Number.isFinite(Number(evaluation.score)) && evaluation.label);
}

export async function evaluateCuttingAdviceWithDeepSeek(input, options) {
  var apiKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      message: DEEPSEEK_FALLBACK_MESSAGE
    };
  }
  var fetchApi = options && options.fetch ? options.fetch : globalThis.fetch;
  if (typeof fetchApi !== "function") {
    return {
      ok: false,
      message: DEEPSEEK_FALLBACK_MESSAGE
    };
  }

  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () {
    controller.abort();
  }, DEEPSEEK_TIMEOUT_MS) : null;

  try {
    var response = await fetchApi(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        temperature: 0.2,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content: "你只给系统提供的本地裁板方案打参考分，不重新计算，不改方案，不输出长建议。"
          },
          {
            role: "user",
            content: buildDeepSeekCuttingPrompt(input)
          }
        ]
      }),
      signal: controller ? controller.signal : undefined
    });
    if (timer) clearTimeout(timer);
    if (!response || !response.ok) {
      return {
        ok: false,
        message: DEEPSEEK_FALLBACK_MESSAGE
      };
    }
    var payload = await response.json();
    var content = payload && payload.choices && payload.choices[0] && payload.choices[0].message ?
      payload.choices[0].message.content :
      "";
    var evaluation = parseDeepSeekEvaluation(content);
    if (!hasUsableEvaluation(evaluation)) {
      return {
        ok: false,
        message: DEEPSEEK_FALLBACK_MESSAGE
      };
    }
    return {
      ok: true,
      evaluation: evaluation
    };
  } catch (error) {
    if (timer) clearTimeout(timer);
    return {
      ok: false,
      message: DEEPSEEK_FALLBACK_MESSAGE
    };
  }
}
