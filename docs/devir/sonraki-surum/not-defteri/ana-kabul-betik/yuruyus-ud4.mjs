// ANA OTURUM — UD TURU 3 EKRAN YÜRÜYÜŞÜ (KS8.1 iade geri ödemesi + S264 aynı gün Değersiz) (öz denetim 2, 11.11.2026; anayasa "kalite çıtası"): günlük iş akışı kullanıcı gözüyle; her adımda ekran görüntüsü + ekrandaki sayılar.
// Kurulum programın API'siyle, bakış ve iki işlem (kart tahsilatı, taksit ekleme) EKRANDAN. Kullanım: ROOT=<kod kökü> node yuruyus.mjs
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { chromium } = await import(pathToFileURL(path.join(ROOT, "node_modules/playwright/index.mjs")).href);
const { createApp } = await imp("server/app.mjs");
const { createClient, installPageClock } = await imp("test/helpers.mjs");
const { escClose } = await imp("test/e2e/esc-kapat.mjs");
const OUT = process.env.OUT;
const PASS = "Prova-Admin-2026!";
const TODAY = "2026-09-30";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = o => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return unwrap(r); };
const note = (...a) => console.log(...a);
const root = mkdtempSync(path.join(tmpdir(), "yuruyus-ud3-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f51" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const browser = await chromium.launch();
let page = null; let n = 0;
const shot = async name => { n += 1; const f = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`); await page.screenshot({ path: f }).catch(() => null); return f; };
const closeAll = async () => { for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) { await escClose(page); await page.waitForTimeout(250); } };
const text = sel => page.$$eval(sel, ns => ns.map(x => x.textContent.replace(/\s+/g, " ").trim()));
const step = async (title, fn) => { note(`\n■ ${title}`); try { await fn(); } catch (e) { note(`  ✗ ADIM YARIDA: ${String(e?.message || e).split("\n")[0]}`); await shot(`hata`); await closeAll().catch(() => null); } };

await api.login("admin", PASS);
await must("banka", api.post("/api/workspace/bank/setup/dismiss", {}));
const mal = (await must("mal", api.post("/api/workspace/stock", { kind: "goods", code: "UD3-MAL", name: "UD3 Malı", unit: "Adet", openingQty: "100000", salePrice: "100" }))).id;
const cari = (name, extra = {}) => must(name, api.post("/api/workspace/accounts", { name, type: "customer", phone: "", registeredOn: "2026-03-01", ...extra }));
const entry = async (a, body) => (await must(body.kind, api.post(`/api/workspace/accounts/${a.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }))).entryId;
// KS8.1 (kalıcı testin A senaryosu; karar metninden elle: Açılış Kalan 918,61, Ödeme avansı 470,89, bakiye 1.389,50)
const a1 = await cari("Yürüyüş İade Geri Ödemesi", { openingBalance: "1483,45", openingSide: "auto" });
await must("iade", api.post(`/api/workspace/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "1914,34", pay: "account", accountId: a1.id, date: "2026-06-25" }));
await entry(a1, { kind: "in", amount: "564,84", date: "2026-06-26" });
await entry(a1, { kind: "out", amount: "2385,23", date: "2026-06-30" });
// S264 (a): fatura 2.900 (05.09) · Borç 3.400 (11.09, vade 31.12) · 17.09 BAĞLI tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 ⇒ Değersiz 3.000 kabul, bakiye 423,55
const a2 = await cari("Yürüyüş Aynı Gün Değersiz");
const g1 = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a2.id, issueDate: "2026-09-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
await entry(a2, { kind: "debt", amount: "3400", date: "2026-09-11", dueDate: "2026-12-31", note: "Borç" });
await entry(a2, { kind: "in", amount: "2876,45", date: "2026-09-17", note: "Tahsilat", invoiceId: g1.id || g1.invoice?.id });
const took = await must("şüpheliye al", api.post(`/api/workspace/accounts/${a2.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }));
note("kurulum: şüpheli kayıt", took.record?.id, "kalan", took.record?.remainingMinor);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", deviceScaleFactor: 1 });
  page = await context.newPage();
  await installPageClock(page, app.config.now);
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror ${e.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => Boolean(window.HOF?.plans?.open && window.HOF?.accounts?.open && window.HOF?.dues), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await closeAll();

const openAcc = async id => { await page.evaluate(x => window.HOF.accounts.open(x), id); await page.waitForTimeout(1800); };
const dumpAcc = async label => {
  const rows = await page.$$eval(`${TOP} tr`, rs => rs.map(r => r.textContent.replace(/\s+/g, " ").trim()).filter(t => t && t.length < 400));
  note(`  ${label}:`); for (const r of rows.slice(0, 30)) note(`     ${r}`);
};
await step("1 Cari kartı — faturasız iade geri ödemesi (beklenen: Açılış Kalan 918,61, bakiye 1.389,50)", async () => { await openAcc(a1.id); await dumpAcc("iade carisi"); await shot("cari-iade-geri-odemesi"); await closeAll(); });
await step("2 Zil — iade carisinin kalemleri (beklenen: Ödeme avansı 'Tahsil Edilecek Borç' 470,89)", async () => {
  const d = unwrap(await api.get("/api/workspace/dues"));
  for (const it of (d.items || []).filter(x => JSON.stringify(x).includes(a1.id))) note(`     ${it.label} · ${it.dueDate} · ${it.amount}`);
});
const writeOffUI = async (label, amount) => {
  await openAcc(a2.id); await page.waitForSelector(`${TOP} [data-dbt-act="writeoff"]`, { timeout: 15000 });
  await page.click(`${TOP} [data-dbt-act="writeoff"]`); await page.waitForSelector(`${TOP} input[name="amount"]`);
  const intro = await text(`${TOP} .hof-modal-intro, ${TOP} p`); const hint = intro.find(t => t.includes("En çok")) || "";
  const sug = await page.$eval(`${TOP} input[name="amount"]`, i => i.value); const dt = await page.$eval(`${TOP} input[name="date"]`, i => i.value);
  note(`  ${label} — ipucu: ${hint.slice(hint.indexOf("En çok"), hint.indexOf("En çok") + 200)} | önerilen tutar ${sug} | tarih ${dt}`);
  await shot(`${label}-form`);
  if (amount) { const f = await page.$(`${TOP} input[name="amount"]`); await f.click({ clickCount: 3 }); for (const ch of amount) await page.keyboard.type(ch, { delay: 60 }); }
  await page.keyboard.press("Enter");
  const yes = await page.waitForSelector(`${MODAL} [data-answer="yes"]`, { timeout: 5000 }).catch(() => null); if (yes) await yes.click();
  await page.waitForTimeout(2500);
  note(`  form hatası: ${JSON.stringify((await text(`${MODAL} .hof-form-error`)).filter(Boolean))} · bildirim: ${JSON.stringify(await text(".hof-toast"))}`);
  await shot(`${label}-sonra`); await closeAll();
  const d = unwrap(await api.get(`/api/workspace/accounts/${a2.id}`)); const l = unwrap(await api.get(`/api/workspace/accounts/${a2.id}/doubtful`));
  note(`  veri tabanı: bakiye ${d.totals?.balance} · ${(l.records || []).map(r => `${r.stateKey} değersiz ${r.writtenOffMinor} kalan ${r.remainingMinor} yazılabilir ${r.writeOffRoomMinor}`).join(" | ")}`);
};
await step("3 EKRANDAN (S269 P1): önce kısmi Değersiz 1.000 (insan hızı)", () => writeOffUI("p1-adim1", "1000"));
await step("4 EKRANDAN (S269 P1 + S268): kayıt 'Değersiz Yazıldı' görünse de düğme var; ipucunun önerdiği tutarla kalan yazılır (beklenen bakiye 423,55)", async () => { await writeOffUI("p1-adim2", ""); await openAcc(a2.id); await dumpAcc("değersiz carisi"); await shot("cari-son"); await closeAll(); });
note(`\nsayfa hatası: ${errors.length ? errors.join(" | ") : "yok"}`);
await browser.close(); await app.close(); fs.rmSync(root, { recursive: true, force: true });
