// Eşleme penceresi kolon ipucu ekran denetimi: node ipucu.mjs <worktree> <çıktı klasörü>
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const WT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); mkdirSync(OUT, { recursive: true });
process.env.TZ = "Europe/Istanbul"; process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const mod = rel => import(pathToFileURL(path.join(WT, rel)).href);
const { chromium } = createRequire(path.join(WT, "package.json"))("playwright");
const { createApp } = await mod("server/app.mjs");
const { buildXlsx } = await mod("server/lib/xlsx-write.mjs");
const root = mkdtempSync(path.join(tmpdir(), "ipucu-ekran-"));
const PASS = "Prova-Admin-2026!";
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false,
  fetchImpl: async () => { throw new Error("ağa çıkılmaz"); },
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1"); const BASE = `http://127.0.0.1:${port}`;
const courts = ["KONYA 6.İCRA DAİRESİ", "KONYA 2.İCRA DAİRESİ", "ANKARA 1.İCRA DAİRESİ", "İZMİR 3.İCRA DAİRESİ", "BURSA 4.İCRA DAİRESİ", "KAYSERİ 1.İCRA DAİRESİ"];
const cols = ["Esas", "Müvekkil", "Yerel Mahkeme", "Tutar"];
const rows = Array.from({ length: 30 }, (_, i) => ({ Esas: `2026/${9000 + i}`, Müvekkil: `Kişi ${i + 1}`, "Yerel Mahkeme": courts[i % courts.length], Tutar: String(1000 + i) }));
const file = path.join(root, "ipucu.xlsx"); writeFileSync(file, buildXlsx([{ name: "Dosyalar", columns: cols, rows }], { title: "İpucu" }));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" })).newPage();
await page.goto(`${BASE}/`); await page.fill("#hof-auth input[name=username]", "admin"); await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-start .hof-drop input[type=file]", { state: "attached" });
await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(file);
await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
await page.waitForTimeout(400);
const text = await page.$eval(".hof-modal-backdrop.is-visible .hof-mapping", node => node.innerText);
await page.$eval(".hof-modal-backdrop.is-visible .hof-mapping", node => node.scrollIntoView({ block: "start" }));
await page.screenshot({ path: path.join(OUT, "esleme-ipucu-1366x768.png") });
const hint = (text.match(/\d+ farklı değer:[^\n]*/) || [""])[0];
const ok = hint && !/object Object/.test(text) && /İCRA DAİRESİ/.test(hint);
writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ worktree: WT, hint, objectObject: /object Object/.test(text), ok }, null, 2));
console.log(JSON.stringify({ hint, objectObject: /object Object/.test(text), ok }));
await browser.close(); await app.close?.(); rmSync(root, { recursive: true, force: true }); process.exit(ok ? 0 : 1);
