import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../../server/app.mjs";
import { buildXlsx } from "../../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "repro-m5");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "repro-m5-"));
const excel = path.join(root, "ogrenciler.xlsx");
const COLS = ["Öğrenci", "Veli Telefon", "Kayıt Tarihi", "Aylık Ücret", "Servis Plaka"];
const ROWS = [["Mert Çelik", "0537 410 60 60", "14.01.2026", "4.500,00 ₺", "34 SRV 303"], ["Ada Yılmaz", "0532 410 10 10", "02.02.2026", "3.500,00 ₺", "34 SRV 101"], ["Efe Kaya", "0532 410 20 20", "12.04.2026", "3.500,00 ₺", "34 SRV 101"]];
writeFileSync(excel, buildXlsx([{ name: "Öğrenciler", columns: COLS, rows: ROWS.map(row => Object.fromEntries(COLS.map((col, i) => [col, row[i]]))) }], { title: "Öğrenciler" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
const results = [];
let shotNo = 0;
const shot = async (page, name, options = {}) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const pad = value => String(value).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tl = value => `₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};



const admin = await newPage();
let exitCode = 0;
try {
  await login(admin, "admin", PASS);
  await admin.waitForSelector("#hof-start .hof-drop");
  await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
  await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
  await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
  await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
  await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
  await admin.waitForTimeout(1200);
  await admin.goto(`${BASE}/`, { waitUntil: "load" });
  await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  await admin.locator(".dynamic-table tbody tr", { hasText: "Mert Çelik" }).first().click();
  await admin.waitForFunction(() => window.HOF.selectedCase()?.key);
  const sel = await admin.evaluate(() => ({ key: window.HOF.selectedCase().key, source: window.HOF.currentSource?.() || window.HOF.data?.sourceKey || "" }));
  console.log("seçili kayıt:", sel);
  const created = await call(admin, "/api/workspace/accounts", { name: "Mert Çelik", type: "customer", phone: "0537 410 60 60", caseKey: sel.key, caseSource: sel.source, caseTitle: "Mert Çelik" });
  console.log("cari:", created.status, created.error || created.account?.id || Object.keys(created));
  await admin.locator(".dynamic-table tbody tr", { hasText: "Ada Yılmaz" }).first().click();
  await admin.waitForTimeout(600);
  await admin.locator(".dynamic-table tbody tr", { hasText: "Mert Çelik" }).first().click();
  await admin.waitForSelector("#hof-case-plan:not([hidden]) [data-open-account]", { timeout: 10000 });
  await shot(admin, "panel");
  const info = await admin.evaluate(() => { const b = document.querySelector("#hof-case-plan [data-open-account]"); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { rect: [r.left, r.top, r.width, r.height], topIsButton: top === b || b.contains(top), topTag: top?.tagName + "." + top?.className, accounts: typeof window.HOF.accounts?.open }; });
  console.log("düğme:", JSON.stringify(info));
  await admin.evaluate(() => { window.__btn = document.querySelector("#hof-case-plan [data-open-account]"); window.__log = []; const d = n => n ? `${n.tagName}${n.className ? "." + String(n.className).split(" ").join(".") : ""}` : "yok"; document.addEventListener("focusin", e => window.__log.push("in:" + d(e.target))); document.addEventListener("pointerdown", e => window.__log.push("pd:" + d(e.target)), true); document.addEventListener("mousedown", e => window.__log.push("md:" + d(e.target) + (e.defaultPrevented ? "!prevented" : ""))); document.addEventListener("focusout", e => window.__log.push("out:" + d(e.target) + "→" + d(e.relatedTarget))); });
  await admin.click("#hof-case-plan [data-open-account]");
  await admin.waitForTimeout(1500);
  console.log("açıldıktan sonra odak:", await admin.evaluate(() => document.activeElement?.tagName + "." + document.activeElement?.className), "| ilk tıklama odağı günlüğü:", JSON.stringify(await admin.evaluate(() => window.__log.slice(0, 6))));
  await admin.evaluate(() => { window.__log = [];
    const btn = window.__btn; const hit = n => n && (n === btn || (n.contains && n.contains(btn)) || (btn.contains && btn.contains(n)));
    const wrap = (proto, name) => { const orig = proto[name]; proto[name] = function (...args) { if (hit(this) || args.some(hit)) window.__log.push(`${name}(${this.tagName}#${this.id}) ← ${new Error().stack.split("\n").slice(2, 5).map(l => l.trim().replace(/^at /, "")).join(" < ")}`); return orig.apply(this, args); }; };
    wrap(Node.prototype, "removeChild"); wrap(Node.prototype, "insertBefore"); wrap(Node.prototype, "appendChild"); wrap(Element.prototype, "after"); wrap(Element.prototype, "remove"); wrap(Element.prototype, "replaceWith"); wrap(Element.prototype, "replaceChildren");
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML"); Object.defineProperty(Element.prototype, "innerHTML", { ...desc, set(v) { if (hit(this)) window.__log.push(`innerHTML(${this.tagName}#${this.id}) ← ${new Error().stack.split("\n").slice(2, 5).map(l => l.trim().replace(/^at /, "")).join(" < ")}`); return desc.set.call(this, v); } });
  });
  await admin.keyboard.press("Escape");
  await admin.waitForTimeout(600);
  console.log("panel çocukları:", JSON.stringify(await admin.evaluate(() => { const box = document.querySelector("#hof-case-plan"); const parent = box.parentElement; return { parent: parent.tagName + "." + parent.className, order: [...parent.children].map(n => n.tagName + (n.id ? "#" + n.id : "") + "." + String(n.className).split(" ").slice(0, 2).join(".")) }; })));
  console.log("kapandıktan sonra odak:", await admin.evaluate(() => document.activeElement?.tagName + "." + document.activeElement?.className), "| aynı düğme mi:", await admin.evaluate(() => window.__btn === document.querySelector("#hof-case-plan [data-open-account]")), "| düğme bağlı mı:", await admin.evaluate(() => window.__btn.isConnected), "| günlük:", JSON.stringify(await admin.evaluate(() => window.__log)));
} catch (error) { console.error("HATA", error); exitCode = 1; }
console.log("sayfa hataları:", errors);
await browser.close(); await app.close?.(); process.exit(exitCode);
