#!/usr/bin/env node
// 2.5.0 Ç3 tur 2 — dönem kilidi ucunun (PUT /api/admin/period-lock) YANIT süresi ve dondurmanın bitişi, istemcinin 30 sn sınırıyla (client/assets/hof-core.js sendApi
// timeoutMs = 30000; aşılınca ekranda "Sunucu zamanında yanıt vermedi."). Plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §8: "Dönem kilidi + dondurma: 100.000 ≤ 10 sn; 1.000.000 hedef
// ≤ 2 dk, İLERLEME; olay döngüsü ≤ 50 ms". Veri programın KENDİ ürettiği veridir (tools/kapi-olcum.mjs --yalniz-kur); her koşu taze kopyada (ders 15; flock ile tek başına).
// İki kip:
//   --sunucu gercek   startTestServer (createApp: kapı, POS, yetki gerçek). 1.000.000 verisinde açılış (repairOwnCards) 22 dakikada bitmiyor (Ç3 dışı bulgu AH,
//                     docs/kanit/2026-11-06/c3-bulgu-acilis-repairOwnCards.txt) → bu kip 100.000 içindir.
//   --sunucu cekirdek gerçek routes/ledger.mjs uçları + gerçek yönlendirici + gerçek HTTP (createApp YOK; kapı ve POS kurulmaz, yetki sahte yönetici) → 1.000.000.
// İstemci isteği AbortController ile 30 sn'de keser (sendApi ile aynı). Ölçülen: istemcinin gördüğü yanıt (ms, durum ya da "client-timeout"), uç işleyicisinin bitişi (sunucu,
// ms), dondurmanın bitişi (kapsam = kilit, bekleyen koşu yok; ms), olay döngüsünün en büyük gecikmesi (5 ms'lik yoklayıcı) PUT boyunca ve dondurma boyunca.
//   flock <kilit> node test/donmus-defter-kilit-ucu-olcum-250.mjs --kod <kök> --veri <n-… klasörü> --cikti <dosya.json> --sunucu gercek|cekirdek [--kilit 2025-12-31] [--parca 500]
import { copyFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const root = path.resolve(opt("kod"));
const veri = path.resolve(opt("veri"));
const output = path.resolve(opt("cikti"));
const mode = opt("sunucu", "gercek");
const lockDay = opt("kilit", "2025-12-31");
const batchLines = Number(opt("parca", 500));
const CLIENT_LIMIT_MS = 30000; // client/assets/hof-core.js sendApi timeoutMs
const NOW = "2026-10-08T12:00:00+03:00"; // tools/kapi-olcum.mjs ile aynı
const PASS = "Kapi-Olcum-2026!";
const imp = file => import(pathToFileURL(path.join(root, file)).href);
const work = mkdtempSync(path.join(path.dirname(output), "kilit-ucu-olcum-"));
const result = { kod: root, veri, sunucu: mode, kilit: lockDay, parca: batchLines, istemciSiniriMs: CLIENT_LIMIT_MS, node: process.version, cpu: os.cpus().length, yuk: os.loadavg(), olcumler: {} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Olay döngüsü yoklayıcısı: pencere pencere en büyük gecikme (bir pencere açıkken her 5 ms'lik turun gecikmesi o pencereye yazılır).
const windows = new Map();
const gaps = []; // 50 ms'yi aşan her boşluk: kilit isteğinden bu yana (ms) ve boyu — nerede takıldığı
let gapOrigin = 0;
let last = performance.now();
// Pencereye yalnız pencere AÇILDIKTAN SONRA başlayan boşluk yazılır (kurulumdaki eşzamanlı kopya / sayım sorgusunun boşluğu ilk turda pencereye taşmasın).
const probe = setInterval(() => {
  const at = performance.now();
  const gap = Math.max(0, at - last - 5);
  for (const item of windows.values()) if (item.open && last >= item.openedAt) item.max = Math.max(item.max, gap);
  if (gapOrigin && gap > 50 && last >= gapOrigin) gaps.push({ basladi: Math.round(last - gapOrigin), ms: Math.round(gap) });
  last = at;
}, 5);
const openWindow = name => windows.set(name, { open: true, max: 0, openedAt: performance.now() });
const closeWindow = name => {
  const item = windows.get(name);
  item.open = false;
  return Math.round(item.max);
};

let server = null;
let base = "";
let cookie = "";
let snapshots = null;
let store = null;
let db = null;
let failure = null;
const handlerEnd = { at: 0 };
try {
  if (mode === "gercek") {
    const { startTestServer } = await imp("test/helpers.mjs");
    cpSync(path.join(veri, "data"), path.join(work, "data"), { recursive: true });
    const opened = performance.now();
    server = await startTestServer({ dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), now: { time: NOW, fixed: true }, adminPassword: PASS, gateVerify: false, moneyStrict: false, freezeBatchLines: batchLines, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    result.acilisMs = Math.round(performance.now() - opened);
    base = server.base;
    const client = server.client();
    const login = await client.login("admin", PASS);
    if (login.status !== 200) throw new Error(`giriş ${login.status}`);
    cookie = client.cookie;
    snapshots = server.app.ledger.snapshots;
    store = server.app.store;
  } else {
    const { createClock } = await imp("server/lib/clock.mjs");
    const { createStore, openDatabase } = await imp("server/lib/db.mjs");
    const { createPeriod } = await imp("server/lib/period.mjs");
    const { createRouter } = await imp("server/lib/router.mjs");
    const { HttpError, send } = await imp("server/lib/http.mjs");
    const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
    const file = path.join(work, "destekofis.sqlite");
    copyFileSync(path.join(veri, "data", "destekofis.sqlite"), file);
    db = openDatabase(file);
    store = createStore(db);
    const now = createClock({ time: NOW, fixed: true });
    const period = createPeriod({ store, now });
    if (period.lockedUntil()) throw new Error("veride kilit var; kilitsiz veri gerekli");
    const router = createRouter();
    const admin = { id: "olcum", display_name: "Ölçüm", role: "admin", permissions: ["system.manage", "overview.view"] };
    const auth = { requirePermission: () => admin };
    // Kapının kilit durumu (lib/integrity.mjs adoptLock / lockPending ile aynı kural; tam kapı kurulmaz): uç izi ayrı iş parçacığında ölçüp benimser — iz süresi yanıt süresine girer.
    let lockState = { lock: "", digest: "" };
    const gate = { adoptLock: ({ lock = "", digest = null } = {}) => (lockState = { lock, digest: lock ? digest : "" }), lockPending: lock => lockState.lock === lock && lockState.digest === null };
    result.kapiIzi = { adoptLock: [] };
    const adopt = gate.adoptLock;
    gate.adoptLock = value => {
      result.kapiIzi.adoptLock.push({ t: gapOrigin ? Math.round(performance.now() - gapOrigin) : null, lock: value.lock, digest: value.digest === null ? null : String(value.digest).slice(0, 12) });
      return adopt(value);
    };
    const ledger = registerLedgerRoutes(router, { store, now, auth, audit: () => {}, events: null, period, integrity: () => gate, money: null, config: { dbPath: file }, freezeBatchLines: batchLines });
    snapshots = ledger.snapshots;
    server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      res.on("finish", () => {
        if (req.method === "PUT") handlerEnd.at = performance.now();
      });
      try {
        const matched = router.match(req.method, url.pathname);
        if (!matched || matched.methodNotAllowed) throw new HttpError(404, "yok");
        await matched.handler({ req, res, url, params: matched.params });
      } catch (error) {
        if (res.headersSent) return res.end();
        if (error instanceof HttpError) return send(res, error.status, { ok: false, error: error.message, ...error.extra });
        send(res, 500, { ok: false, error: String(error?.message || error) });
      }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    server.close = (orig => () => new Promise(resolve => orig.call(server, resolve)))(server.close);
  }
  result.paraSatiri = Number(store.get("SELECT (SELECT COUNT(*) FROM cash_entries) + (SELECT COUNT(*) FROM account_entries) + (SELECT COUNT(*) FROM payments) + (SELECT COUNT(*) FROM plan_entries) + (SELECT COUNT(*) FROM stock_moves) + (SELECT COUNT(*) FROM cheque_events) AS n").n);
  const call = async (method, url, body, { limit = 0 } = {}) => {
    const controller = new AbortController();
    const timer = limit ? setTimeout(() => controller.abort(), limit) : null;
    const started = performance.now();
    try {
      const response = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const data = await response.json();
      return { ms: Math.round(performance.now() - started), status: response.status, data };
    } catch (error) {
      if (error?.name === "AbortError") return { ms: Math.round(performance.now() - started), status: 0, timeout: true, error: "Sunucu zamanında yanıt vermedi. (client-timeout)" };
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  const frozen = () => snapshots.state().coverage === lockDay && !snapshots.state().pending && !snapshots.status().running;
  // Kilit: istemci 30 sn'de keser (sendApi gibi); sunucunun işleyicisi sürer. Önce yoklayıcı birkaç tur döner (kurulumun boşluğu geride kalsın).
  await sleep(200);
  openWindow("kilit");
  openWindow("toplam");
  const started = performance.now();
  gapOrigin = started;
  // Uç işleyicisinin bitişi (sunucu tarafı, yanıt yazıldığı an) yalnız çekirdek kipte ölçülür; gerçek sunucuda istemcinin gördüğü süre (30 sn'yi aşmadıkça aynı).
  const put =await call("PUT", "/api/admin/period-lock", { lockedUntil: lockDay, force: true }, { limit: CLIENT_LIMIT_MS });
  const putLoop = closeWindow("kilit");
  result.olcumler.kilitYaniti = { ms: put.ms, status: put.status, istemciZamanAsimi: Boolean(put.timeout), ileti: put.error || put.data?.error || "", yanit: put.data?.data || null, olayDongusuEnCokMs: putLoop };
  // Dondurmanın bitişi: kapsam = kilit, bekleyen koşu yok, iş durdu. İlerleme: GET /api/workspace/ledger/lock (arka plan yoklaması, saniyede bir).
  const polls = [];
  for (let i = 0; i < 1800 && !frozen(); i += 1) {
    const view = await call("GET", "/api/workspace/ledger/lock");
    if (polls.length < 400) polls.push({ t: Math.round(performance.now() - started), ms: view.ms, freeze: view.data?.data?.freeze ? { running: view.data.data.freeze.running, phase: view.data.data.freeze.phase, done: view.data.data.freeze.done, pending: Boolean(view.data.data.freeze.pending), active: view.data.data.freeze.active } : null });
    await sleep(1000);
  }
  const total = Math.round(performance.now() - started);
  const totalLoop = closeWindow("toplam");
  result.olcumler.dondurmaBitti = {
    ms: total, olayDongusuEnCokMs: totalLoop, kapsam: snapshots.state().coverage, bekleyen: snapshots.state().pending, durum: snapshots.status(), donmusSatir: Number(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n),
    ucIsleyicisiBittiMs: handlerEnd.at ? Math.round(handlerEnd.at - started) : null,
  };
  result.olcumler.yoklama = { sayi: polls.length, enUzunMs: polls.reduce((max, item) => Math.max(max, item.ms), 0), ornek: polls.filter((_, index) => index < 5 || index % 10 === 0).slice(0, 40) };
  result.olcumler.bosluklar = { sayi50: gaps.length, enBuyukler: gaps.slice().sort((a, b) => b.ms - a.ms).slice(0, 10) };
  if (!frozen()) throw new Error(`dondurma bitmedi: ${JSON.stringify(snapshots.status())}`);
} catch (error) {
  failure = error;
} finally {
  clearInterval(probe);
  try {
    await server?.close?.();
  } catch {
    // kapalı
  }
  try {
    await snapshots?.close?.();
  } catch {
    // kapalı
  }
  try {
    db?.close();
  } catch {
    // kapalı
  }
  rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
result.yukSonra = os.loadavg();
if (failure) result.hata = String(failure?.stack || failure);
writeFileSync(output, JSON.stringify(result, null, 1));
const k = result.olcumler.kilitYaniti;
const d = result.olcumler.dondurmaBitti;
if (k) console.log(`kilit yanıtı: ${k.status || "YOK"} ${k.ms} ms${k.istemciZamanAsimi ? " — İSTEMCİ ZAMAN AŞIMI (30 sn): " + k.ileti : ""} · olay döngüsü en çok ${k.olayDongusuEnCokMs} ms`);
if (d) console.log(`dondurma bitti: ${d.ms} ms (uç işleyicisi bitti ${d.ucIsleyicisiBittiMs ?? "-"} ms) · ${d.donmusSatir} donmuş satır · kapsam ${d.kapsam} · olay döngüsü en çok ${d.olayDongusuEnCokMs} ms · yoklama ${result.olcumler.yoklama?.sayi} (en uzun ${result.olcumler.yoklama?.enUzunMs} ms)`);
const b = result.olcumler.bosluklar;
if (b) console.log(`50 ms'yi aşan boşluk: ${b.sayi50}${b.enBuyukler.length ? ` (en büyükler: ${b.enBuyukler.slice(0, 5).map(item => `${item.ms} ms @${item.basladi} ms`).join("; ")})` : ""}`);
console.log(`para satırı ${result.paraSatiri} · ${mode} · açılış ${result.acilisMs ?? "-"} ms · yük ${result.yuk.map(n => n.toFixed(2)).join(" ")} → ${result.yukSonra.map(n => n.toFixed(2)).join(" ")}`);
if (failure) {
  console.log(`HATA: ${failure.message}`);
  console.log(`\n# tests 1\n# pass 0\n# fail 1`);
  process.exitCode = 1;
} else console.log(`\n# tests 1\n# pass 1\n# fail 0`);
