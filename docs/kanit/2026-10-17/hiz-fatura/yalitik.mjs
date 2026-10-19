// Yüksüz (tek istemci, sıralı) uç süreleri: yükte yavaşlayan uçların kendi maliyeti (ms) ve veri hacmi.
// Kullanım: KLASOR=<kok> node yalitik.mjs > yalitik.json  (taze veri kopyasında, ayrı süreç sunucu; yük yokken).
import { cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = "/home/user/ofis---y-netimi";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KOK = process.env.KLASOR;
const work = path.join(KOK, "calisma-yalitik");
rmSync(work, { recursive: true, force: true });
cpSync(path.join(KOK, "veri"), work, { recursive: true });
const child = fork(path.join(HERE, "hiz.mjs"), [], { env: { ...process.env, HIZ_SUNUCU: JSON.stringify({ dataDir: path.join(work, "data") }), HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
const port = await new Promise(r => child.on("message", m => m.cmd === "ready" && r(m.port)));
const { createClient } = await import(`${R}/test/helpers.mjs`);
const api = createClient(`http://127.0.0.1:${port}`);
await api.login("ekran01", "Hiz-Fatura-Personel-1!");
const u = r => (r.data && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const info = JSON.parse(readFileSync(path.join(KOK, "veri", "hazir.json"), "utf8"));
const list = u(await api.get("/api/workspace/invoices?tab=sale&limit=1"));
const anyId = list.invoices[0].id;
const today = new Date().toISOString().slice(0, 10);
const it = info.items[0];
const acc = info.accounts.efatura[0];
const calcBody = { kind: "sale", scenario: "goods_sale", accountId: acc.id, issueDate: today, lines: [1, 2, 3, 4].map(i => ({ itemId: info.items[i].id, name: info.items[i].name, qty: "2", unitPrice: String(info.items[i].salePrice).replace(".", ","), vatRate: String(info.items[i].vat) })) };
const probes = [
  ["GET /api/workspace/invoices?tab=sale&limit=200 (liste açılışı)", () => api.get("/api/workspace/invoices?tab=sale&limit=200")],
  ["GET /api/workspace/invoices?tab=all&limit=200", () => api.get("/api/workspace/invoices?tab=all&limit=200")],
  ["GET /api/workspace/invoices?tab=sale&offset=200&limit=200 (Daha Fazla)", () => api.get("/api/workspace/invoices?tab=sale&offset=200&limit=200")],
  ["GET /api/workspace/invoices?tab=all&q=<numara> (liste arama)", () => api.get(`/api/workspace/invoices?tab=all&q=${encodeURIComponent(list.invoices[0].number)}&limit=200`)],
  ["GET /api/workspace/invoices?tab=pending", () => api.get("/api/workspace/invoices?tab=pending&limit=200")],
  ["GET /api/workspace/dues (arka plan)", () => api.get("/api/workspace/dues")],
  ["GET /api/workspace/bank/badge (arka plan)", () => api.get("/api/workspace/bank/badge")],
  ["GET /api/workspace/stock/alerts (arka plan)", () => api.get("/api/workspace/stock/alerts")],
  ["GET /api/workspace/cheques (arka plan)", () => api.get("/api/workspace/cheques")],
  ["GET /api/workspace/tasks (arka plan)", () => api.get("/api/workspace/tasks")],
  ["GET /api/workspace/invoices/:id (kart)", () => api.get(`/api/workspace/invoices/${anyId}`)],
  ["GET /api/workspace/invoices/:id/fatura.pdf", () => api.raw("GET", `/api/workspace/invoices/${anyId}/fatura.pdf`)],
  ["GET /api/workspace/invoices/meta", () => api.get("/api/workspace/invoices/meta")],
  ["POST /api/workspace/invoices/calc (4 kalem)", () => api.post("/api/workspace/invoices/calc", calcBody)],
  ["GET /api/workspace/accounts/search?q=", () => api.get(`/api/workspace/accounts/search?q=${encodeURIComponent(acc.query)}`)],
  ["GET /api/workspace/invoices/items?q=", () => api.get(`/api/workspace/invoices/items?q=${it.code}`)],
  ["GET /api/workspace/invoices/last-prices", () => api.get(`/api/workspace/invoices/last-prices?itemId=${it.id}&accountId=${acc.id}`)],
  ["GET /api/workspace/report-center/fatura-satis (Bu Yıl)", () => api.get(`/api/workspace/report-center/fatura-satis?from=${today.slice(0, 4)}-01-01&to=${today}`)],
];
const out = {};
for (const [name, fn] of probes) {
  const ms = [];
  let status = 0;
  let size = 0;
  for (let i = 0; i < 12; i += 1) {
    const t = performance.now();
    const r = await fn();
    ms.push(performance.now() - t);
    status = r.status;
    size = r.buffer ? r.buffer.length : JSON.stringify(r.data).length;
  }
  ms.splice(0, 2); // ısınma
  ms.sort((a, b) => a - b);
  out[name] = { status, p50: Math.round(ms[Math.floor(ms.length / 2)]), max: Math.round(ms.at(-1)), yanitBayt: size };
}
const { DatabaseSync } = await import("node:sqlite");
const reg = JSON.parse(readFileSync(path.join(work, "data", "sirketler.json"), "utf8"));
const c = reg.companies.find(x => !x.deletedAt);
const db = new DatabaseSync(path.join(c.dir ? path.join(work, "data", c.dir) : path.join(work, "data"), "destekofis.sqlite"), { readOnly: true });
const hacim = Object.fromEntries(["invoices", "invoice_lines", "account_entries", "stock_moves", "cheques", "accounts", "stock_items", "gl_entries", "gl_lines"].map(t => { try { return [t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]; } catch { return [t, "yok"]; } }));
db.close();
child.send({ cmd: "close" });
await new Promise(r => child.on("exit", r));
rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify({ uclar: out, hacim }, null, 1));
