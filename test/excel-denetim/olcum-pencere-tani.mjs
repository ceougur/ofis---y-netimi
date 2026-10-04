// Tanı (2.0.22 madde 1/2): v2.0.21'de yük altında Cari arama kutusu kayboluyor mu? 100 ms aralıkla pencere durumu.
// Sonuç (04.10.2026): 60 sn'de 39 başka kayıt, kutu her örnekte görünür; ölçüm betiğinin "kayboldu" demesi, liste
// sürekli baştan çizilirken kutunun ölçüsü alınırken değişmesinden (test yarışı). Sayfa o kadar meşguldü ki tek okuma ~2 sn.
// Kullanım: SP=<çalışma> KOD=<sunucu kodu kökü> node olcum-pencere-tani.mjs

import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createClient } from "../helpers.mjs";
const SP = process.env.SP; const KOD = process.env.KOD;
const state = JSON.parse(fs.readFileSync(path.join(SP, "canli", "durum.json"), "utf8")); const C1 = state.companies["001"];
const { createApp } = await import(pathToFileURL(path.join(KOD, "server", "app.mjs")).href);
const WORK = path.join(SP, "tani", "veri"); fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
fs.cpSync(path.join(SP, "canli", "data"), path.join(WORK, "data"), { recursive: true });
const app = createApp({ dataDir: path.join(WORK, "data"), backupDir: path.join(WORK, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Denetim-Admin-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
const failures = [];
page.on("requestfailed", r => failures.push(`${new Date().toISOString().slice(11, 23)} FAILED ${r.url().replace(BASE, "").slice(0, 80)} ${r.failure()?.errorText}`));
page.on("console", m => m.type() === "error" && failures.push(`${new Date().toISOString().slice(11, 23)} console ${m.text().slice(0, 120)}`));
await page.goto(`${BASE}/?hofCompany=${C1}`);
await page.fill("#hof-auth input[name=username]", "arayuz001"); await page.fill("#hof-auth input[name=password]", "Personel-Denetim-2026!");
await page.click('#hof-auth button[type="submit"]'); await page.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 60000 }); await page.waitForTimeout(2500);
await page.click("#hof-sidecard [data-action=accounts]"); await page.waitForSelector(".hof-modal-backdrop.is-visible tr[data-account]"); await page.waitForTimeout(1500);
const scoped = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${C1}`;
const colleague = createClient(BASE); await colleague.login("alis001", "Personel-Denetim-2026!");
const accs = (await colleague.get(scoped("/api/workspace/accounts?status=all&limit=1000"))).data.data.accounts.filter(a => /^C0/.test(a.refNo) && a.type === "customer");
let alive = true; let n = 0;
const noise = (async () => { while (alive) { const a = accs[n % accs.length]; n += 1; await colleague.put(scoped(`/api/workspace/accounts/${a.id}`), { name: a.name, type: a.type, refNo: a.refNo, note: `tanı ${n}` }); await new Promise(r => setTimeout(r, 1000)); } })();
const log = [];
let shot = 0;
const started = Date.now();
while (Date.now() - started < 60000) {
  const s = await page.evaluate(() => {
    const modals = [...document.querySelectorAll(".hof-modal-backdrop")].map(m => ({ visible: m.classList.contains("is-visible"), title: (m.querySelector("h2, .hof-modal-title")?.textContent || "").trim().slice(0, 40) }));
    const input = document.querySelector(".hof-modal-backdrop.is-visible input[data-filter=q]");
    const rect = input?.getBoundingClientRect();
    const body = document.querySelector(".hof-modal-backdrop.is-visible .hof-modal-body, .hof-modal-backdrop.is-visible [data-body]");
    return { modals, input: Boolean(input), size: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : "", display: input ? getComputedStyle(input).display : "", bodyText: (body?.innerText || document.querySelector(".hof-modal-backdrop.is-visible")?.innerText || "").replace(/\s+/g, " ").slice(0, 160) };
  }).catch(e => ({ error: e.message.slice(0, 100) }));
  const ok = s.input && s.size && !s.size.startsWith("0x");
  log.push({ t: Date.now() - started, ok, ...s });
  if (!ok && shot < 3) { shot += 1; await page.screenshot({ path: path.join(SP, "tani", `pencere-${shot}.png`) }).catch(() => null); }
  await new Promise(r => setTimeout(r, 100));
}
alive = false; await noise;
const bad = log.filter(x => !x.ok);
console.log(`örnek ${log.length}, kutu görünmeyen ${bad.length}, başkasının kaydı ${n}`);
for (const x of bad.slice(0, 8)) console.log(JSON.stringify(x).slice(0, 400));
console.log("ağ/konsol hataları:", failures.slice(0, 15).join("\n"));
fs.writeFileSync(path.join(SP, "tani", "pencere-log.json"), JSON.stringify({ log, failures }, null, 1));
await browser.close(); await app.close(); fs.rmSync(WORK, { recursive: true, force: true });
