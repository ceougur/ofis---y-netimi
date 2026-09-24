// İstemci dosyalarını güvenli, önbellek doğrulamalı (ETag) ve sıkıştırılmış olarak sunar.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync, constants as zlib } from "node:zlib";
import { HTML_CSP, SECURITY_HEADERS } from "./http.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".webmanifest", ".txt"]);
const HIDDEN = /(^|\/)(\.|__manus__)/;

export function createStaticHandler(publicDir) {
  const root = path.resolve(publicDir);
  const cache = new Map();

  const resolve = pathname => {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.includes("\0") || HIDDEN.test(decoded)) return null;
    const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    try {
      const stats = statSync(full);
      return stats.isFile() ? { full, stats } : null;
    } catch {
      return null;
    }
  };

  const load = (full, stats, encoding) => {
    const key = `${full}|${stats.mtimeMs}|${stats.size}|${encoding}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const raw = readFileSync(full);
    let body = raw;
    if (encoding === "br") body = brotliCompressSync(raw, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } });
    else if (encoding === "gzip") body = gzipSync(raw, { level: 9 });
    if (cache.size > 200) cache.clear();
    cache.set(key, body);
    return body;
  };

  return function serveStatic(req, res, pathname) {
    const found = resolve(pathname);
    if (!found) return false;
    const { full, stats } = found;
    const ext = path.extname(full).toLowerCase();
    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const headers = {
      ...SECURITY_HEADERS,
      "content-type": TYPES[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "no-cache",
      etag,
      vary: "Accept-Encoding",
    };
    if (ext === ".html") headers["content-security-policy"] = HTML_CSP;
    if (ext !== ".html" && req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers);
      res.end();
      return true;
    }
    const accepts = String(req.headers["accept-encoding"] || "");
    let encoding = "";
    if (COMPRESSIBLE.has(ext) && stats.size > 1024) {
      if (/\bbr\b/.test(accepts)) encoding = "br";
      else if (/\bgzip\b/.test(accepts)) encoding = "gzip";
    }
    const body = load(full, stats, encoding);
    if (encoding) headers["content-encoding"] = encoding;
    headers["content-length"] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
    return true;
  };
}

export function notFoundPage(res) {
  res.writeHead(404, { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": HTML_CSP });
  res.end(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sayfa bulunamadı · DestekOfis</title><link rel="stylesheet" href="/assets/hof-ui.css"><body class="hof-plain-page"><main class="hof-plain-card"><img src="/assets/brand/destekofis-mark.svg" alt="" width="44" height="44"><h1>Sayfa bulunamadı</h1><p>Aradığınız adres bu sunucuda yok.</p><a class="hof-button" href="/">Ana ekrana dön</a></main></body></html>`);
}
