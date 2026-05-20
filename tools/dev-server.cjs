const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  const pathname = decodeURIComponent(url.pathname);
  let filePath = path.join(root, pathname === "/" ? "index.html" : pathname);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(normalized, (statError, stat) => {
    if (statError) {
      send(res, 404, "Not found");
      return;
    }

    if (stat.isDirectory()) filePath = path.join(normalized, "index.html");
    else filePath = normalized;

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        send(res, 404, "Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, types[ext] || "application/octet-stream");
    });
  });
});

function listen() {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT) {
      port += 1;
      listen();
      return;
    }
    throw error;
  });

  server.listen(port, host, () => {
    console.log("Local server running at http://" + host + ":" + port);
  });
}

listen();
