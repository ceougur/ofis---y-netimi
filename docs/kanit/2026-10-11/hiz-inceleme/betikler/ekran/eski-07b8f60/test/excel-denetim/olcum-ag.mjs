// Ölçüm (2.0.22 madde 1/2): başka personel 10 kayıt girerken bir pencerenin gönderdiği istekler (ilk ölçüm; ayrıntılısı yuk-olcum.mjs).
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-ag.mjs
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { STAFF_PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const C1 = state.companies["001"];
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/`); await p.fill("#hof-auth input[name=username]", "arayuz001"); await p.fill("#hof-auth input[name=password]", STAFF_PASS);
await p.click('#hof-auth button[type="submit"]'); await p.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 60000 }); await p.waitForTimeout(3000);
const mode = process.argv[2] || "ana";
if (mode === "cari") { await p.click("#hof-sidecard [data-action=accounts]"); await p.waitForSelector(".hof-modal-backdrop.is-visible tr[data-account]"); await p.waitForTimeout(2000); }
const log = []; const t = new Map();
p.on("request", r => { if (r.url().includes("/api/")) t.set(r, Date.now()); });
p.on("requestfinished", async r => { if (!t.has(r)) return; const resp = await r.response(); const body = await resp?.body().catch(() => Buffer.alloc(0)); log.push({ url: r.url().replace(BASE, "").replace(/hofCompany=[^&]+&?/, "").slice(0, 90), ms: Date.now() - t.get(r), kb: Math.round((body?.length || 0) / 1024) }); });
const w = staff(BASE, C1); await w.login("alis001", STAFF_PASS);
const accs = (await w.get("/api/workspace/accounts?limit=20")).data.accounts;
const wl = [];
for (let i = 0; i < 10; i += 1) { const a = accs[i]; const s = Date.now(); await w.put(`/api/workspace/accounts/${a.id}`, { name: a.name, type: a.type, refNo: a.refNo, note: `ağ ${i}` }); wl.push(Date.now() - s); await new Promise(r => setTimeout(r, 1000)); }
await p.waitForTimeout(4000);
const agg = {};
for (const x of log) { const k = x.url.split("?")[0] + (x.url.includes("?") ? "?" + x.url.split("?")[1].replace(/=[^&]*/g, "=…") : ""); (agg[k] ||= { n: 0, ms: 0, kb: 0, max: 0 }); agg[k].n++; agg[k].ms += x.ms; agg[k].kb += x.kb; agg[k].max = Math.max(agg[k].max, x.ms); }
console.log(`[${mode}] 10 başka kayıt sırasında bu pencerenin istekleri:`);
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].ms - a[1].ms)) console.log(`  ${v.n}× ${k}  toplam ${v.ms} ms, en uzun ${v.max} ms, ${v.kb} KB`);
console.log("başka personelin kayıt süreleri (ms):", wl.join(" "));
await b.close(); await app.close();
