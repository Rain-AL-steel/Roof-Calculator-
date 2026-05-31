import { describe, expect, it } from "vitest";
import { warmDatabase } from "../backend/src/dbWarmup.js";

function createLogger() {
  var entries = [];
  return {
    entries: entries,
    logger: {
      info: function (message) {
        entries.push({ level: "info", payload: JSON.parse(message) });
      },
      warn: function (message) {
        entries.push({ level: "warn", payload: JSON.parse(message) });
      }
    }
  };
}

describe("database warmup", function () {
  it("runs SELECT 1 once and logs success", async function () {
    var queryCount = 0;
    var captured = createLogger();
    var result = await warmDatabase({
      prisma: {
        $queryRaw: async function () {
          queryCount += 1;
          return [{ value: 1 }];
        }
      },
      logger: captured.logger,
      retryDelayMs: 0
    });

    expect(result).toEqual({ ok: true, attempt: 1 });
    expect(queryCount).toBe(1);
    expect(captured.entries).toHaveLength(1);
    expect(captured.entries[0].level).toBe("info");
    expect(captured.entries[0].payload).toMatchObject({
      type: "db_warmup",
      ok: true,
      attempt: 1
    });
    expect(typeof captured.entries[0].payload.dbMs).toBe("number");
    expect(new Date(captured.entries[0].payload.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("retries failed warmup at most three times and does not throw", async function () {
    var queryCount = 0;
    var captured = createLogger();
    var result = await warmDatabase({
      prisma: {
        $queryRaw: async function () {
          queryCount += 1;
          throw Object.assign(new Error("connection failed"), { code: "P1001" });
        }
      },
      logger: captured.logger,
      retryDelayMs: 0
    });

    expect(result).toEqual({ ok: false, attempt: 3 });
    expect(queryCount).toBe(3);
    expect(captured.entries).toHaveLength(3);
    captured.entries.forEach(function (entry, index) {
      expect(entry.level).toBe("warn");
      expect(entry.payload).toMatchObject({
        type: "db_warmup",
        ok: false,
        attempt: index + 1,
        code: "P1001",
        message: "Database unavailable"
      });
      expect(typeof entry.payload.dbMs).toBe("number");
      expect(new Date(entry.payload.timestamp).toString()).not.toBe("Invalid Date");
    });
  });
});
