// senaryo-222 "Pencere bozulmaz" adımının CI'de ara sıra kırmızı olmasının (run 465 ac19490, run 38039979492 5a7d903) yeniden
// üretimi ve düzeltmenin denetimi (10.10.2026). Ürün kodunu DEĞİŞTİRMEZ. Tarayıcıda window.fetch sayfa betiklerinden ÖNCE
// sarılır (hof-core.js onu açılışta bağlar) ve her /api/workspace/accounts GET isteği zamanı, arama metni, sonucu ve
// JavaScript yığınıyla kaydedilir: yığında refresher "run" varsa arka plan yenilemesi (bg), yoksa kullanıcı yüklemesi (user).
//
// KÖK NEDEN (bu betik gösterir): Cari aramasında kutu yazmayı 250 ms bekleyip listeyi yükler (hof-accounts.js onInput). O
// 250 ms içinde başka bir değişikliğin arka plan yenilemesi (HOF.refresher → loadList({ keep: true })) kutudaki yeni metinle
// yükler ve 9 satırı kullanıcının aramasından ÖNCE gösterir. Test "9 satır göründü" diye ağı keser; ardından gecikmeli
// kullanıcı araması gönderilir ve kesilir. Kullanıcının kendi yüklemesi başarısız olunca ürün kuralı gereği (hof-core.js
// HOF.listGate / HOF.listPending) liste yerine "Liste alınamadı… Yeniden Dene" gösterilir. Yani başarısız olan arka plan
// yenilemesi değil, kullanıcının araması: TEST YARIŞI.
//
//   node --disable-warning=ExperimentalWarning test/e2e/senaryo-222-yaris.mjs
// Ortam değişkenleri:
//   TRIALS  deneme sayısı (varsayılan 20)
//   CPU     Chromium CPU yavaşlatması (CDP Emulation.setCPUThrottlingRate; varsayılan 1)
//   MODE    natural: senaryodaki sıra (API ile "Silinecek Cari" aç → pencereyi aç → "Müşteri 0" ara → 9 satır → ağı kes)
//           forced:  başka personelin değişikliğinin arka plan yenilemesi arama gecikmesinin içine denk getirilir (LEAD ms)
//   LEAD    forced'da olaydan kaç ms sonra yazılır (varsayılan 330; yenileme olaydan 450 ms sonra → yazmadan ~120 ms sonra)
//   WAIT    old: senaryonun 10.10.2026 öncesi beklemesi (9 satır görünür görünmez ağı kes)
//           new: düzeltilmiş bekleme (senaryo-222.mjs ile aynı: arama gecikmesinden uzun sayfa zamanlayıcısı, 9 satır,
//                uçuştaki bütün liste istekleri biter, sonra ağı kes)
// Geçme ölçütü senaryonunkiyle aynı: kesilen en az bir istek VE kutuda "Müşteri 0", 9 satır, hata yazısı yok.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const TRIALS = Number(process.env.TRIALS || 20);
const CPU = Number(process.env.CPU || 1);
const MODE = process.env.MODE || "natural";
const WAIT = process.env.WAIT || "new";
const LEAD = Number(process.env.LEAD || 330);
const LABEL = `MODE=${MODE} WAIT=${WAIT} CPU=${CPU}${MODE === "forced" ? ` LEAD=${LEAD}` : ""}`;
const PASS = "Prova-Admin-2026!";
const STAFF = "Prova-Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-222-yaris-"));
const pad = v => String(v).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f22" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
  const real = window.fetch.bind(window);
  window.__acc = [];
  let seq = 0;
  window.fetch = (...args) => {
    const url = String(args[0]?.url || args[0]);
    const method = String(args[1]?.method || "GET").toUpperCase();
    let parsed = null;
    try {
      parsed = new URL(url, location.href);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.pathname !== "/api/workspace/accounts" || method !== "GET") return real(...args);
    const stack = String(new Error().stack || "")
      .split("\n")
      .slice(2)
      .map(line => line.trim().replace(/^at /, "").replace(/ \(.*\)$/, "").replace(/ http.*$/, ""))
      .filter(Boolean)
      .slice(0, 9);
    const entry = { id: ++seq, t: Math.round(performance.now()), q: parsed.searchParams.get("q"), kind: stack.some(frame => /(^|\s)run$/.test(frame)) ? "bg" : "user", stack: stack.join(" < "), end: null, result: "pending" };
    window.__acc.push(entry);
    const pending = real(...args);
    pending.then(
      response => {
        entry.end = Math.round(performance.now());
        entry.result = `http ${response.status}`;
      },
      error => {
        entry.end = Math.round(performance.now());
        entry.result = `FAILED ${error.message}`;
      },
    );
    return pending;
  };
  window.__dom = [];
  const sample = () => {
    const modal = document.querySelector(".hof-modal-backdrop.is-visible");
    if (!modal) return;
    const rows = modal.querySelectorAll("tr[data-account]").length;
    const error = modal.querySelector(".hof-list-error") ? "HATA" : "";
    const q = modal.querySelector("input[data-filter=q]")?.value ?? null;
    const sig = `${rows} satır${error ? ` ${error}` : ""} q=${JSON.stringify(q)}`;
    if (window.__dom.at(-1)?.sig === sig) return;
    window.__dom.push({ t: Math.round(performance.now()), sig });
  };
  new MutationObserver(sample).observe(document, { subtree: true, childList: true, characterData: true });
  document.addEventListener("input", event => {
    if (event.target?.matches?.('input[data-filter="q"]')) window.__inputAt = Math.round(performance.now());
  }, true);
});
const admin = await context.newPage();
const errors = [];
admin.on("pageerror", error => errors.push(`pageerror ${error.message}`));
if (CPU > 1) await (await context.newCDPSession(admin)).send("Emulation.setCPUThrottlingRate", { rate: CPU });
const modal = ".hof-modal-backdrop.is-visible";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const closeAll = async () => {
  for (let i = 0; i < 6 && (await admin.$(modal)); i += 1) {
    await admin.keyboard.press("Escape");
    await admin.waitForTimeout(250);
  }
};
const pageNow = () => admin.evaluate(() => Math.round(performance.now()));
const isList = url => new URL(url).pathname === "/api/workspace/accounts";
const nineRows = () => admin.waitForFunction(sel => [...document.querySelectorAll(`${sel} tr[data-account]`)].length === 9, modal, { timeout: 15000 });

await api.login("admin", PASS);
const customers = [];
for (let i = 1; i <= 12; i += 1) customers.push(unwrap(await api.post("/api/workspace/accounts", { name: `Müşteri ${pad(i)}`, type: "customer", phone: `0532 100 00 ${pad(i)}` })).id);
await api.post("/api/workspace/cash", { kind: "in", amount: 10000, date: TODAY, description: "Açılış" });
await api.post("/api/admin/users", { username: "muhasebe2", name: "Muhasebe İki", role: "muhasebe", password: STAFF, mustChangePassword: false });
await admin.goto(`${BASE}/`);
await admin.fill("#hof-auth input[name=username]", "admin");
await admin.fill("#hof-auth input[name=password]", PASS);
await admin.click('#hof-auth button[type="submit"]');
await admin.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 60000 });
await admin.waitForTimeout(2500);
const colleague = createClient(BASE);
await colleague.login("muhasebe2", STAFF);

let passed = 0;
let failed = 0;
for (let trial = 1; trial <= TRIALS; trial += 1) {
  // Senaryodaki önceki adımın bıraktığı durum: "Müşteri 07" araması, kutu temizlenir, pencere kapanır.
  await admin.click("#hof-sidecard [data-action=accounts]");
  await admin.waitForSelector(`${modal} input[data-filter=q]`);
  await admin.fill(`${modal} input[data-filter=q]`, "Müşteri 07");
  await admin.waitForFunction(sel => [...document.querySelectorAll(`${sel} tr[data-account]`)].length === 1, modal, { timeout: 15000 }).catch(() => null);
  await admin.fill(`${modal} input[data-filter=q]`, "");
  await closeAll();
  await admin.waitForTimeout(1500);
  await admin.evaluate(() => {
    window.__acc = [];
    window.__dom = [];
  });
  const t0 = await pageNow();
  let eventAt = null;
  let failedCalls = 0;
  const listInFlight = new Set();
  const onListRequest = request => {
    if (request.method() === "GET" && isList(request.url())) listInFlight.add(request);
  };
  const onListDone = request => listInFlight.delete(request);
  admin.on("request", onListRequest);
  admin.on("requestfinished", onListDone);
  admin.on("requestfailed", onListDone);
  if (MODE === "natural") {
    await api.post("/api/workspace/accounts", { name: `Silinecek Cari ${trial}`, type: "customer" });
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.fill(`${modal} input[data-filter=q]`, "Müşteri 0");
  } else {
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.waitForTimeout(2500);
    await admin.evaluate(() => {
      window.__heard = new Promise(resolve => {
        const off = window.HOF.on("live:workspace.changed", () => {
          off?.();
          resolve(Math.round(performance.now()));
        });
        setTimeout(() => resolve(null), 10000);
      });
    });
    await colleague.post(`/api/workspace/accounts/${customers[3]}/entries`, { kind: "in", amount: 1, date: TODAY, method: "cash", note: `tetik ${trial}` });
    eventAt = await admin.evaluate(() => window.__heard);
    if (eventAt === null) throw new Error("canlı olay gelmedi");
    await admin.evaluate(([at, lead]) => new Promise(resolve => setTimeout(resolve, Math.max(0, at + lead - performance.now()))), [eventAt, LEAD]);
    await admin.fill(`${modal} input[data-filter=q]`, "Müşteri 0");
  }
  const fillDone = await pageNow();
  if (WAIT === "new") {
    // senaryo-222.mjs ile aynı bekleme.
    await admin.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    await nineRows();
    const settleBy = Date.now() + 15000;
    while (listInFlight.size && Date.now() < settleBy) await new Promise(resolve => setTimeout(resolve, 25));
    if (listInFlight.size) throw new Error(`kullanıcının liste yüklemeleri 15 sn'de bitmedi (${listInFlight.size} istek uçuşta)`);
  } else {
    await nineRows();
  }
  admin.off("request", onListRequest);
  admin.off("requestfinished", onListDone);
  admin.off("requestfailed", onListDone);
  const seen9 = await pageNow();
  await admin.route(isList, route => {
    if (route.request().method() !== "GET") return route.continue();
    failedCalls += 1;
    return route.abort("failed");
  });
  const routed = await pageNow();
  await colleague.post(`/api/workspace/accounts/${customers[5]}/entries`, { kind: "in", amount: 7, date: TODAY, method: "cash", note: "yenileme hatası denemesi" });
  await admin.waitForTimeout(3500);
  const state = await admin.evaluate(sel => ({
    input: document.querySelector(`${sel} input[data-filter=q]`)?.value ?? null,
    rows: document.querySelectorAll(`${sel} tr[data-account]`).length,
    error: document.querySelector(`${sel} .hof-empty`)?.textContent || "",
  }), modal);
  const listOk = state.input === "Müşteri 0" && state.rows === 9 && !state.error;
  const pass = listOk && failedCalls >= 1;
  const log = await admin.evaluate(() => ({ acc: window.__acc, dom: window.__dom, inputAt: window.__inputAt }));
  await admin.unroute(isList);
  const unrouted = await pageNow();
  // Sonraki deneme temiz başlasın: hata yazısı varsa Yeniden Dene; yoksa yenileyicinin yeniden denemesi başarıyla bitsin
  // (geri çekilme zamanlayıcısı sonraki denemenin olayını geciktirmesin).
  if (state.error) await admin.click(`${modal} [data-act="retryList"]`).catch(() => null);
  await admin.waitForFunction(after => window.__acc.some(entry => entry.t > after && /^http 200/.test(entry.result)), unrouted, { timeout: 30000 }).catch(() => null);
  await nineRows().catch(() => null);
  await admin.fill(`${modal} input[data-filter=q]`, "");
  await closeAll();
  if (pass) passed += 1;
  else failed += 1;
  const rel = t => (t === null || t === undefined ? "—" : `${t - t0}`);
  console.log(`\n=== deneme ${trial}/${TRIALS} (${LABEL}): ${pass ? "✓ GEÇTİ" : "✗ KIRMIZI"} · kutu "${state.input}", ${state.rows} satır${state.error ? `, hata yazısı: ${state.error.trim()}` : ""} · ağ kesilince ${failedCalls} istek düştü`);
  console.log(`  zaman (ms, deneme başına göre): olay ${rel(eventAt)} · yazma (input) ${rel(log.inputAt)} · fill bitti ${rel(fillDone)} · bekleme bitti ${rel(seen9)} · ağ kesildi ${rel(routed)}`);
  for (const e of log.acc) console.log(`  #${e.id} ${e.kind.padEnd(4)} başladı ${String(rel(e.t)).padStart(5)} bitti ${String(rel(e.end)).padStart(5)} q=${JSON.stringify(e.q)} → ${e.result}\n        yığın: ${e.stack}`);
  console.log(`  ekran: ${log.dom.map(d => `${rel(d.t)}: ${d.sig}`).join(" | ")}`);
}
if (errors.length) console.log(`\nSayfa hataları: ${errors.join(" | ")}`);
console.log(`\nSenaryo-222 yarış tanısı (${LABEL}): ${passed} geçti, ${failed} kaldı.`);
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
