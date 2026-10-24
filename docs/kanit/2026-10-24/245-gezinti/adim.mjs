// 2.4.5 gezinti adımı (244-gezinti/adim.mjs ile aynı; depo varsayılanı bu worktree): sunucu.mjs'in açık tutduğu Chromium'a CDP ile bağlanır, stdin'deki adım kodunu (async; `page`, `base`, `durum`, `bekle`, `yaz`
// erişilebilir) çalıştırır, ekran görüntüsünü <kök>/ekran/<ad>.png'ye alır, görünen pencere başlıklarını, bildirimleri ve konsol hatalarını yazar.
// Kullanım: node adim.mjs <veri-klasörü> <ekran-adı> [--tam] < adim-kodu.js
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, ad, ...rest] = process.argv.slice(2);
const durum = JSON.parse(readFileSync(path.join(root, "durum.json"), "utf8"));
const repo = process.env.DEPO || "/home/user/wt/gezinti-245";
const { chromium } = await import(pathToFileURL(path.join(repo, "node_modules", "playwright", "index.mjs")).href);
const code = readFileSync(0, "utf8");
const browser = await chromium.connectOverCDP(durum.cdp);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().startsWith(durum.base)) || context.pages()[0];
const errors = [];
page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text().slice(0, 300)); });
page.on("pageerror", err => errors.push(`pageerror: ${String(err.message || err).slice(0, 300)}`));
const notes = [];
const yaz = (...a) => notes.push(a.join(" "));
const bekle = ms => page.waitForTimeout(ms);
// Doğrulama yardımcıları (yalnız OKUMA): api = sayfanın kendi oturumuyla GET; sql = veri tabanını salt okunur açar.
const api = (url, method = "GET", body) => page.evaluate(async ({ url, method, body }) => {
  const r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = text; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data };
}, { url, method, body });
const { DatabaseSync } = await import("node:sqlite");
const sql = (q, ...args) => { const db = new DatabaseSync(durum.dbPath, { readOnly: true }); try { return db.prepare(q).all(...args); } finally { db.close(); } };
let failure = null;
try {
  const AsyncFunction = (async () => {}).constructor;
  await new AsyncFunction("page", "base", "durum", "bekle", "yaz", "context", "api", "sql", "browser", code)(page, durum.base, durum, bekle, yaz, context, api, sql, browser);
} catch (error) {
  failure = String(error?.message || error).split("\n").slice(0, 3).join(" | ");
}
await page.waitForTimeout(350);
const seen = await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const texts = sel => { const all = [...document.querySelectorAll(sel)].filter(vis); return all.filter(el => !all.some(o => o !== el && o.contains(el))).map(el => el.textContent.replace(/\s+/g, " ").trim()).filter(Boolean); };
  return {
    baslik: document.title,
    pencere: texts(".hof-modal h2, .hof-modal-title, [role=dialog] h2, dialog[open] h2").slice(-4),
    bildirim: texts(".hof-toast, .hof-notice, [role=alert], [role=status]").map(t => t.slice(0, 220)).slice(-5),
  };
}).catch(error => ({ okunamadi: String(error.message || error).slice(0, 200) }));
const dir = path.join(root, "ekran");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${ad}.png`);
await page.screenshot({ path: file, fullPage: rest.includes("--tam") }).catch(error => notes.push(`ekran alınamadı: ${error.message}`));
console.log(JSON.stringify({ adim: ad, hata: failure, url: page.url().replace(durum.base, ""), ...seen, not: notes, konsolHatasi: errors.slice(0, 8), ekran: file }, null, 1));
// CDP bağlantısı kesilir; tarayıcı sunucu.mjs'te açık kalır.
await browser.close().catch(() => null);
process.exit(failure ? 1 : 0);
