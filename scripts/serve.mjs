// Production single-origin server on :4174 (stands in for the API gateway + asset proxy)
// /V1/mf/<app>/*  -> apps/<app>/dist/* (missing file => 404, never index.html)
// any other /V1/* -> shell index.html
// --block=<app> (repeatable) makes /V1/mf/<app>/* return 404
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blocked = new Set(process.argv.filter((a) => a.startsWith("--block=")).map((a) => a.slice(8)));
const port = Number(process.env.PORT) || 4174;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

const send = (res, status, file) => {
  if (!file) {
    res.writeHead(status).end(`${status}\n`);
    return;
  }
  res.writeHead(status, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
};

const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();

export const resolveRequest = (pathname) => {
  const m = pathname.match(/^\/V1\/mf\/([^/]+)\/(.*)$/);
  if (m) {
    const [, app, rest] = m;
    if (blocked.has(app) || !["shell", "app-hub", "use-case-a"].includes(app)) return null;
    const dist = path.join(root, "apps", app, "dist");
    const file = path.normalize(path.join(dist, rest));
    return file.startsWith(dist + path.sep) && isFile(file) ? file : null;
  }
  if (pathname === "/V1" || pathname.startsWith("/V1/")) {
    if (pathname.startsWith("/V1/mf/")) return null;
    return path.join(root, "apps/shell/dist/index.html");
  }
  return null;
};

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    } catch {
      return send(res, 400);
    }
    const file = resolveRequest(pathname);
    console.log(req.method, pathname, file ? 200 : 404);
    send(res, file ? 200 : 404, file);
  })
  .listen(port, () =>
    console.log(`serving on http://localhost:${port}/V1/${blocked.size ? ` (blocked: ${[...blocked]})` : ""}`),
  );
