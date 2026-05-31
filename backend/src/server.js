import "dotenv/config";
import { createApp } from "./app.js";
import { warmDatabase } from "./dbWarmup.js";

const port = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(port, function () {
  console.log("roof-calculator-api listening on http://127.0.0.1:" + port);
  warmDatabase().catch(function () {
    console.warn(JSON.stringify({
      type: "db_warmup",
      ok: false,
      attempt: 0,
      dbMs: 0,
      timestamp: new Date().toISOString(),
      code: "DATABASE_UNAVAILABLE",
      message: "Database unavailable"
    }));
  });
});
