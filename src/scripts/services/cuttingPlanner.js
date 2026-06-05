const DEFAULT_STOCK_SEGMENTS = 60;
const DEFAULT_MAX_PLANS = 3;
const MAX_PATTERN_CANDIDATES = 80;
const MAX_PATTERN_NODES = 6000;
const MAX_PIECES_PER_CUTTING_ROUND = 3;

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function toPositiveInteger(value) {
  var number = Number(value);
  if (!isFinitePositive(number)) return null;
  var rounded = Math.round(number);
  return rounded > 0 ? rounded : null;
}

function formatTrimmedNumber(value, digits) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(digits || 3)).toString();
}

function getStockSegments(options) {
  var stock = Number(options && options.stockSegments);
  if (!isFinitePositive(stock)) return DEFAULT_STOCK_SEGMENTS;
  return Math.max(1, Math.round(stock));
}

function getRowSegments(row) {
  if (row && row.segments !== undefined) return row.segments;
  if (row && row.actual !== undefined) return row.actual;
  return undefined;
}

function getRowQty(row) {
  if (row && row.totalQty !== undefined) return row.totalQty;
  if (row && row.qty !== undefined) return row.qty;
  return undefined;
}

function getRowLengthText(row) {
  var text = String(row && row.lengthsText !== undefined ? row.lengthsText : "").trim();
  if (text) return text;
  if (row && Number.isFinite(Number(row.length))) return formatTrimmedNumber(Number(row.length), 4);
  return "";
}

function getRowSegmentLength(row) {
  var value = Number(row && row.segmentLength);
  return isFinitePositive(value) ? value : null;
}

function makePieceKey(segments) {
  return "s" + segments;
}

function addUniqueText(list, text) {
  if (text && list.indexOf(text) === -1) list.push(text);
}

function buildPieceLabel(piece) {
  return piece.segments + "节";
}

export function normalizeCuttingPieces(mainRows, options) {
  var stockSegments = getStockSegments(options || {});
  var rows = Array.isArray(mainRows) ? mainRows : [];
  var warnings = [];
  var grouped = {};

  rows.forEach(function (row, index) {
    var rowNumber = index + 1;
    var rawSegments = getRowSegments(row);
    var rawQty = getRowQty(row);
    var segments = toPositiveInteger(rawSegments);
    var qty = toPositiveInteger(rawQty);

    if (!segments) {
      warnings.push("第 " + rowNumber + " 行实裁节数无效，已忽略。");
      return;
    }
    if (Math.abs(Number(rawSegments) - segments) > 0.000001) {
      warnings.push("第 " + rowNumber + " 行实裁节数已按 " + segments + " 节处理。");
    }
    if (segments > stockSegments) {
      warnings.push("第 " + rowNumber + " 行 " + segments + " 节超过 " + stockSegments + " 节原板，无法裁切，已忽略。");
      return;
    }
    if (!qty) {
      warnings.push("第 " + rowNumber + " 行数量无效，已忽略。");
      return;
    }
    if (Math.abs(Number(rawQty) - qty) > 0.000001) {
      warnings.push("第 " + rowNumber + " 行数量已按 " + qty + " 片处理。");
    }

    var key = makePieceKey(segments);
    if (!grouped[key]) {
      grouped[key] = {
        key: key,
        segments: segments,
        qty: 0,
        lengthTexts: [],
        segmentLengths: []
      };
    }
    grouped[key].qty += qty;
    addUniqueText(grouped[key].lengthTexts, getRowLengthText(row));
    var segmentLength = getRowSegmentLength(row);
    if (segmentLength !== null && grouped[key].segmentLengths.indexOf(segmentLength) === -1) {
      grouped[key].segmentLengths.push(segmentLength);
    }
  });

  var pieces = Object.keys(grouped).map(function (key) {
    var piece = grouped[key];
    var lengthText = piece.lengthTexts.join(", ");
    var segmentLength = piece.segmentLengths.length === 1 ? piece.segmentLengths[0] : null;
    return {
      key: piece.key,
      segments: piece.segments,
      qty: piece.qty,
      lengthText: lengthText,
      segmentLength: segmentLength,
      label: buildPieceLabel({
        segments: piece.segments,
        lengthText: lengthText
      })
    };
  }).sort(function (a, b) {
    return b.segments - a.segments;
  });

  return {
    stockSegments: stockSegments,
    pieces: pieces,
    warnings: warnings
  };
}

function getNormalizedInput(input, options) {
  var settings = Object.assign({}, options || {});
  if (input && !Array.isArray(input) && input.stockSegments !== undefined) {
    settings.stockSegments = input.stockSegments;
  }
  var rows = input && !Array.isArray(input) && Array.isArray(input.pieces) ? input.pieces : input;
  return normalizeCuttingPieces(rows, settings);
}

function createCounts(pieces) {
  return pieces.reduce(function (counts, piece) {
    counts[piece.key] = piece.qty;
    return counts;
  }, {});
}

function cloneCounts(counts) {
  return Object.assign({}, counts || {});
}

function hasRemainingPieces(counts) {
  return Object.keys(counts || {}).some(function (key) {
    return counts[key] > 0;
  });
}

function getPatternSignature(items) {
  return items.map(function (item) {
    return item.key + "x" + item.qty;
  }).sort().join("+");
}

function createPattern(items, stockSegments) {
  var usedSegments = items.reduce(function (sum, item) {
    return sum + item.segments * item.qty;
  }, 0);
  var distinctCount = items.length;
  var pieceCount = items.reduce(function (sum, item) {
    return sum + item.qty;
  }, 0);
  var patternItems = items.map(function (item) {
    return {
      key: item.key,
      segments: item.segments,
      qty: item.qty,
      lengthText: item.lengthText || "",
      segmentLength: item.segmentLength || null,
      label: item.label || (item.segments + "节")
    };
  }).sort(function (a, b) {
    return b.segments - a.segments;
  });
  return {
    items: patternItems,
    usedSegments: usedSegments,
    wasteSegments: stockSegments - usedSegments,
    pieceCount: pieceCount,
    distinctCount: distinctCount,
    signature: getPatternSignature(patternItems)
  };
}

function comparePatternsBalanced(a, b) {
  if (a.wasteSegments !== b.wasteSegments) return a.wasteSegments - b.wasteSegments;
  if (a.usedSegments !== b.usedSegments) return b.usedSegments - a.usedSegments;
  if (a.distinctCount !== b.distinctCount) return a.distinctCount - b.distinctCount;
  return a.pieceCount - b.pieceCount;
}

function generateCandidatePatterns(pieces, counts, stockSegments, options) {
  var settings = options || {};
  var maxCandidates = settings.maxPatternCandidates || MAX_PATTERN_CANDIDATES;
  var maxNodes = settings.maxPatternNodes || MAX_PATTERN_NODES;
  var candidates = [];
  var seen = {};
  var nodes = 0;
  var types = pieces.filter(function (piece) {
    return counts[piece.key] > 0;
  }).sort(function (a, b) {
    return b.segments - a.segments;
  });

  function addCandidate(items) {
    if (!items.length) return;
    var pattern = createPattern(items, stockSegments);
    if (pattern.usedSegments <= 0 || pattern.usedSegments > stockSegments || seen[pattern.signature]) return;
    seen[pattern.signature] = true;
    candidates.push(pattern);
  }

  function visit(index, remaining, current) {
    nodes += 1;
    if (nodes > maxNodes) return;
    if (index >= types.length || remaining <= 0) {
      addCandidate(current);
      return;
    }

    var type = types[index];
    var maxQty = Math.min(counts[type.key], Math.floor(remaining / type.segments));
    for (var qty = maxQty; qty >= 0; qty -= 1) {
      if (qty > 0) {
        current.push(Object.assign({}, type, { qty: qty }));
      }
      visit(index + 1, remaining - qty * type.segments, current);
      if (qty > 0) current.pop();
    }
  }

  visit(0, stockSegments, []);
  return candidates.sort(comparePatternsBalanced).slice(0, maxCandidates);
}

function comparePatternsSimple(a, b) {
  if (a.pieceCount !== b.pieceCount) return a.pieceCount - b.pieceCount;
  if (a.distinctCount !== b.distinctCount) return a.distinctCount - b.distinctCount;
  if (a.wasteSegments !== b.wasteSegments) return a.wasteSegments - b.wasteSegments;
  return b.usedSegments - a.usedSegments;
}

function comparePatternsConcentrated(a, b) {
  if (a.distinctCount !== b.distinctCount) return a.distinctCount - b.distinctCount;
  if (a.usedSegments !== b.usedSegments) return b.usedSegments - a.usedSegments;
  if (a.wasteSegments !== b.wasteSegments) return a.wasteSegments - b.wasteSegments;
  return a.pieceCount - b.pieceCount;
}

function selectPattern(candidates, strategy) {
  if (!candidates.length) return null;
  var sorted = candidates.slice();
  if (strategy === "simple") {
    var minWaste = sorted.reduce(function (min, pattern) {
      return Math.min(min, pattern.wasteSegments);
    }, Infinity);
    var stockSegments = sorted[0].usedSegments + sorted[0].wasteSegments;
    var wasteAllowance = Math.max(8, Math.round(stockSegments * 0.2));
    sorted = sorted.filter(function (pattern) {
      return pattern.wasteSegments <= minWaste + wasteAllowance;
    });
    sorted.sort(comparePatternsSimple);
  } else if (strategy === "concentrated") {
    sorted.sort(comparePatternsConcentrated);
  } else {
    sorted.sort(comparePatternsBalanced);
  }
  return sorted[0] || null;
}

function getPatternRepeat(counts, pattern) {
  var repeat = Infinity;
  pattern.items.forEach(function (item) {
    repeat = Math.min(repeat, Math.floor(counts[item.key] / item.qty));
  });
  return Number.isFinite(repeat) && repeat > 0 ? repeat : 1;
}

function applyPattern(counts, pattern, repeat) {
  pattern.items.forEach(function (item) {
    counts[item.key] = Math.max(0, counts[item.key] - item.qty * repeat);
  });
}

function clonePatternAsCut(pattern, repeat) {
  return Object.assign({}, pattern, {
    repeat: repeat || 1,
    description: describePattern(pattern),
    lineText: describeCutLine(pattern)
  });
}

function getPlanSegmentLength(pieces) {
  var values = pieces.map(function (piece) {
    return piece.segmentLength;
  }).filter(function (value) {
    return isFinitePositive(Number(value));
  });
  if (!values.length) return null;
  var first = values[0];
  return values.every(function (value) {
    return Math.abs(value - first) < 0.000001;
  }) ? first : null;
}

function describePattern(pattern) {
  return pattern.items.map(function (item) {
    return item.label + "×" + item.qty;
  }).join(" + ");
}

function describeCutItem(item) {
  if (item.qty <= 1) return String(item.segments);
  if (item.qty <= 4) {
    return new Array(item.qty).fill(String(item.segments)).join(" + ");
  }
  return item.segments + "×" + item.qty;
}

function describeCutLine(pattern) {
  return pattern.items.map(describeCutItem).join(" + ") + " = 剩" + pattern.wasteSegments;
}

function compressCuts(cuts) {
  var bySignature = {};
  var order = [];
  cuts.forEach(function (cut) {
    if (!bySignature[cut.signature]) {
      bySignature[cut.signature] = Object.assign({}, cut, {
        items: cut.items.map(function (item) { return Object.assign({}, item); }),
        repeat: 0,
        description: cut.description || describePattern(cut),
        lineText: cut.lineText || describeCutLine(cut)
      });
      order.push(cut.signature);
    }
    bySignature[cut.signature].repeat += cut.repeat || 1;
  });
  return order.map(function (signature) {
    return bySignature[signature];
  }).sort(function (a, b) {
    if (a.wasteSegments !== b.wasteSegments) return a.wasteSegments - b.wasteSegments;
    if (a.repeat !== b.repeat) return b.repeat - a.repeat;
    return b.usedSegments - a.usedSegments;
  });
}

function createPlan(strategy, pieces, stockSegments, warnings, options) {
  var settings = options || {};
  var counts = createCounts(pieces);
  var cuts = [];
  var guard = 0;
  var maxBoards = settings.maxBoards || 2000;
  var planWarnings = warnings.slice();

  while (hasRemainingPieces(counts) && guard < maxBoards) {
    guard += 1;
    var candidates = generateCandidatePatterns(pieces, counts, stockSegments, settings);
    var pattern = selectPattern(candidates, strategy);
    if (!pattern) break;
    var repeat = getPatternRepeat(counts, pattern);
    applyPattern(counts, pattern, repeat);
    cuts.push(clonePatternAsCut(pattern, repeat));
  }

  if (hasRemainingPieces(counts)) {
    planWarnings.push("订单数量较大或组合过多，裁板建议已截断，请人工复核。");
  }

  var compressedCuts = compressCuts(cuts);
  var boardCount = compressedCuts.reduce(function (sum, cut) {
    return sum + cut.repeat;
  }, 0);
  var totalWasteSegments = compressedCuts.reduce(function (sum, cut) {
    return sum + cut.wasteSegments * cut.repeat;
  }, 0);
  var fullBoardCount = compressedCuts.reduce(function (sum, cut) {
    return sum + (cut.wasteSegments === 0 ? cut.repeat : 0);
  }, 0);
  var cutPieceCount = getPlanCutPieceCount(compressedCuts);
  var cuttingRounds = buildCuttingRounds(compressedCuts);
  var estimatedCutRounds = cuttingRounds.length;
  var plan = {
    title: "",
    name: "",
    strategyLabel: "",
    strategy: strategy,
    stockSegments: stockSegments,
    boardCount: boardCount,
    totalWasteSegments: totalWasteSegments,
    fullBoardCount: fullBoardCount,
    cutPieceCount: cutPieceCount,
    maxPiecesPerRound: MAX_PIECES_PER_CUTTING_ROUND,
    estimatedCutRounds: estimatedCutRounds,
    cuttingRounds: cuttingRounds,
    score: 0,
    cuts: compressedCuts,
    segmentLength: getPlanSegmentLength(pieces),
    warning: planWarnings.join("；")
  };
  plan.summaryText = buildSummaryText(plan);
  return plan;
}

function comparePlans(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.totalWasteSegments !== b.totalWasteSegments) return a.totalWasteSegments - b.totalWasteSegments;
  if (a.boardCount !== b.boardCount) return a.boardCount - b.boardCount;
  if (a.fullBoardCount !== b.fullBoardCount) return b.fullBoardCount - a.fullBoardCount;
  if (a.cuts.length !== b.cuts.length) return a.cuts.length - b.cuts.length;
  return String(a.strategy).localeCompare(String(b.strategy));
}

function getPlanSignature(plan) {
  return plan.cuts.map(function (cut) {
    return cut.signature + "x" + cut.repeat;
  }).sort().join("|");
}

function appendPlanWarning(plan, text) {
  if (!plan || !text) return;
  plan.warning = plan.warning ? plan.warning + "；" + text : text;
  plan.summaryText = buildSummaryText(plan) + " " + text;
}

function getPlanCutPieceCount(cuts) {
  return (Array.isArray(cuts) ? cuts : []).reduce(function (sum, cut) {
    var pieceCount = (Array.isArray(cut.items) ? cut.items : []).reduce(function (itemSum, item) {
      return itemSum + (Number(item.qty) || 0);
    }, 0);
    return sum + pieceCount * (Number(cut.repeat) || 1);
  }, 0);
}

function expandCutPieces(cut) {
  var pieces = [];
  (Array.isArray(cut && cut.items) ? cut.items : []).forEach(function (item) {
    var qty = Math.max(0, Math.trunc(Number(item.qty) || 0));
    for (var index = 0; index < qty; index += 1) {
      pieces.push(Number(item.segments) || 0);
    }
  });
  return pieces.filter(function (segments) {
    return segments > 0;
  });
}

function buildRoundLineText(pieces, wasteSegments) {
  var line = pieces.join(" + ");
  if (wasteSegments !== null && wasteSegments !== undefined) {
    line += "，剩" + wasteSegments;
  }
  return line;
}

function buildCuttingRounds(cuts) {
  var rounds = [];
  var boardIndex = 0;
  (Array.isArray(cuts) ? cuts : []).forEach(function (cut) {
    var repeat = Math.max(1, Math.trunc(Number(cut.repeat) || 1));
    var boardPieces = expandCutPieces(cut);
    for (var repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
      boardIndex += 1;
      for (var offset = 0; offset < boardPieces.length; offset += MAX_PIECES_PER_CUTTING_ROUND) {
        var chunk = boardPieces.slice(offset, offset + MAX_PIECES_PER_CUTTING_ROUND);
        var isLastChunk = offset + MAX_PIECES_PER_CUTTING_ROUND >= boardPieces.length;
        var wasteSegments = isLastChunk ? Number(cut.wasteSegments) || 0 : null;
        rounds.push({
          roundNumber: rounds.length + 1,
          boardIndex: boardIndex,
          pieces: chunk,
          wasteSegments: wasteSegments,
          lineText: buildRoundLineText(chunk, wasteSegments)
        });
      }
    }
  });
  return rounds;
}

function getPlanShortWastePenalty(plan) {
  return (Array.isArray(plan.cuts) ? plan.cuts : []).reduce(function (sum, cut) {
    var waste = Number(cut.wasteSegments) || 0;
    var repeat = Number(cut.repeat) || 1;
    if (waste <= 0) return sum;
    if (waste <= 5) return sum + 0.35 * repeat;
    if (waste <= 10) return sum + 0.22 * repeat;
    if (waste <= 15) return sum + 0.12 * repeat;
    return sum;
  }, 0);
}

function getRepeatedShortWastePenalty(plan) {
  var wasteGroups = {};
  (Array.isArray(plan.cuts) ? plan.cuts : []).forEach(function (cut) {
    var waste = Number(cut.wasteSegments) || 0;
    if (waste <= 0 || waste > 10) return;
    wasteGroups[waste] = (wasteGroups[waste] || 0) + (Number(cut.repeat) || 1);
  });
  return Object.keys(wasteGroups).reduce(function (sum, waste) {
    return sum + Math.max(0, wasteGroups[waste] - 1) * 0.12;
  }, 0);
}

function getAverageDistinctCount(plan) {
  var boardCount = Number(plan.boardCount) || 0;
  if (!boardCount) return 0;
  var total = (Array.isArray(plan.cuts) ? plan.cuts : []).reduce(function (sum, cut) {
    return sum + (Number(cut.distinctCount) || 0) * (Number(cut.repeat) || 1);
  }, 0);
  return total / boardCount;
}

function getPlanScore(plan, context) {
  var boardCount = Math.max(1, Number(plan.boardCount) || 1);
  var stockSegments = Math.max(1, Number(plan.stockSegments) || DEFAULT_STOCK_SEGMENTS);
  var totalWaste = Number(plan.totalWasteSegments) || 0;
  var wasteRate = totalWaste / Math.max(1, boardCount * stockSegments);
  var score = 10;

  score -= wasteRate * 4.2;
  score -= getPlanShortWastePenalty(plan);
  score -= getRepeatedShortWastePenalty(plan);
  score -= Math.max(0, boardCount - context.minBoardCount) * 0.35;
  score -= Math.max(0, plan.cuts.length - context.minCutTypeCount) * 0.18;

  var averageDistinctCount = getAverageDistinctCount(plan);
  if (averageDistinctCount <= 1.15) score += 0.55;
  else if (averageDistinctCount <= 1.8) score += 0.25;

  if (plan.totalWasteSegments === 0) score += 0.35;
  if (plan.fullBoardCount === plan.boardCount) score += 0.15;

  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function assignPlanScores(plans) {
  var context = {
    minBoardCount: plans.reduce(function (min, plan) {
      return Math.min(min, Number(plan.boardCount) || Infinity);
    }, Infinity),
    minCutTypeCount: plans.reduce(function (min, plan) {
      return Math.min(min, Array.isArray(plan.cuts) ? plan.cuts.length : Infinity);
    }, Infinity)
  };
  plans.forEach(function (plan) {
    plan.score = getPlanScore(plan, context);
  });
}

function orderPlans(plans, maxPlans) {
  return plans.slice().sort(comparePlans).slice(0, maxPlans);
}

function assignPlanTitles(plans) {
  var names = ["方案一", "方案二", "方案三"];
  plans.forEach(function (plan, index) {
    var suffix = "备选方案";
    if (index === 0) {
      suffix = plan.totalWasteSegments === 0 ? "优先零剩料 / 推荐方案" : "优先少剩料 / 推荐方案";
    } else if (plan.strategy === "simple") {
      suffix = "优先少刀数 / 简单裁切";
    } else if (plan.strategy === "concentrated") {
      suffix = "优先同规格集中 / 现场好执行";
    }
    plan.name = names[index];
    plan.strategyLabel = suffix;
    plan.title = names[index] + "（" + formatTrimmedNumber(plan.score, 1) + "分）";
    plan.summaryText = buildSummaryText(plan);
  });
}

export function buildCuttingPlans(input, options) {
  var normalized = getNormalizedInput(input, options);
  var stockSegments = normalized.stockSegments;
  var pieces = normalized.pieces;
  var warnings = normalized.warnings.slice();
  var maxPlans = options && Number.isFinite(Number(options.maxPlans)) ? Math.max(1, Math.trunc(Number(options.maxPlans))) : DEFAULT_MAX_PLANS;

  if (!pieces.length) {
    return {
      stockSegments: stockSegments,
      pieces: pieces,
      plans: [],
      warnings: warnings
    };
  }

  var strategies = ["balanced", "simple", "concentrated"];
  var seen = {};
  var plans = [];
  strategies.forEach(function (strategy) {
    var plan = createPlan(strategy, pieces, stockSegments, warnings, options || {});
    if (!plan.boardCount) return;
    var signature = getPlanSignature(plan);
    if (seen[signature]) return;
    seen[signature] = true;
    plans.push(plan);
  });
  assignPlanScores(plans);
  plans = orderPlans(plans, maxPlans);
  assignPlanTitles(plans);
  if (plans.length === 1) {
    var singlePlanNotice = "当前规格组合较少，只有一个有效裁板方案。";
    warnings.push(singlePlanNotice);
    appendPlanWarning(plans[0], singlePlanNotice);
  }

  return {
    stockSegments: stockSegments,
    pieces: pieces,
    plans: plans,
    warnings: warnings
  };
}

function formatWaste(wasteSegments, segmentLength) {
  return wasteSegments + "节";
}

function buildSummaryText(plan) {
  if (!plan) return "";
  return "评分 " + formatTrimmedNumber(plan.score, 1) + " 分，需要原板 " + plan.boardCount + " 支，预计裁切 " + plan.estimatedCutRounds + " 轮。";
}

export function formatCuttingPlan(plan) {
  if (!plan) return "";
  var mainCuts = (Array.isArray(plan.cuts) ? plan.cuts : []).slice(0, 6).map(function (cut) {
    var repeatText = cut.repeat > 1 ? " × " + cut.repeat + " 支" : "";
    return (cut.description || describePattern(cut)) + repeatText + "，剩 " + formatWaste(cut.wasteSegments, plan.segmentLength);
  }).join("；");
  var prefix = (plan.title ? plan.title + "：" : "") + buildSummaryText(plan);
  return mainCuts ? prefix + " 主要切法：" + mainCuts : prefix;
}
