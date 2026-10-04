// Yük ölçümü (2.0.22 madde 1/2, kullanıcı: "UI'deki donmalar, gecikmeler, çoklu kullanımda arayüzün yetişememesi, cari
// arama pilindeki sorunlar"). AYNI veri (Excel denetiminin canlı verisinin kopyası), AYNI yük, iki kod: önce (v2.0.21,
// kullanıcının kurulu sürümü) ve sonra (bu dal). Her koşu verinin taze kopyasıyla başlar; canlı veri değişmez.
//   1) Sunucu hızı: 4 eşzamanlı yazma × 20 sn; açık (boşta) pencere 0 / 2 / 5; yazma türü "not" (cari notu düzeltme —
//      Excel denetimindeki ölçümün aynısı) ve "para" (cari tahsilatı — mutabakat kapısından geçen gerçek parasal kayıt).
//   2) Açık bir pencerenin isteği: başka personel 10 kayıt girerken (saniyede bir) ana ekran ve Cari penceresi kaç istek
//      gönderiyor, kaç KB indiriyor.
//   3) İnsanın hissettiği: Cari penceresinde klavyeyle "C0123" yazılırken tuş → harf süresi, son tuş → arama sonucunun
//      listede görünmesi, 10 sn'de sayfanın donduğu toplam süre; başka personel saniyede 0 / 1 / 5 kayıt girerken.
// Kullanım: SP=<çalışma> KOD=<sunucu kodunun kökü> ETIKET=<ad> node yuk-olcum.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createClient } from "../helpers.mjs";
import { HERE, PASS, STAFF_PASS } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const KOD = path.resolve(process.env.KOD || path.join(HERE, "..", ".."));
const ETIKET = process.env.ETIKET || path.basename(KOD);
// BOLUM: "hiz,istek,ekran" (varsayılan hepsi). Yalnız bir bölüm koşulursa önceki sonuç dosyası korunur, o bölüm güncellenir.
const BOLUM = new Set((process.env.BOLUM || "hiz,istek,ekran").split(",").map(item => item.trim()).filter(Boolean));
const state = JSON.parse(fs.readFileSync(path.join(SP, "canli", "durum.json"), "utf8"));
const C1 = state.companies["001"];
const { createApp } = await import(pathToFileURL(path.join(KOD, "server", "app.mjs")).href);
const version = JSON.parse(fs.readFileSync(path.join(KOD, "package.json"), "utf8")).version;

const WORK = path.join(SP, `olcum-${ETIKET}`);
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
fs.cpSync(path.join(SP, "canli", "data"), path.join(WORK, "data"), { recursive: true });
const app = createApp({
  dataDir: path.join(WORK, "data"),
  backupDir: path.join(WORK, "backups"),
  logLevel: "error",
  scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" },
  license: { enforce: false, machineId: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6" },
  startLicenseTimers: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const MODAL = ".hof-modal-backdrop.is-visible";
const pad = v => String(v).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const scoped = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${C1}`;
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
async function person(username, password = STAFF_PASS) {
  const client = createClient(BASE);
  const login = await client.login(username, password);
  if (login.status !== 200) throw new Error(`${username} girişi HTTP ${login.status}`);
  return {
    get: async url => unwrap(await client.get(scoped(url))),
    post: async (url, body) => unwrap(await client.post(scoped(url), body)),
    put: async (url, body) => unwrap(await client.put(scoped(url), body)),
  };
}
const admin = await person("admin", PASS);
const accounts = (await admin.get("/api/workspace/accounts?status=all&limit=1000")).data.accounts.filter(a => /^C0/.test(a.refNo) && a.type === "customer");
if (accounts.length < 50) throw new Error(`ölçüm için müşteri carisi az (${accounts.length})`);
// Bir kayıt: "not" = cari notu düzeltme; "para" = cari tahsilatı (nakit, 1–9 TL; mutabakat kapısından geçer).
const write = (who, kind, i) => {
  const a = accounts[i % accounts.length];
  if (kind === "not") return who.put(`/api/workspace/accounts/${a.id}`, { name: a.name, type: a.type, refNo: a.refNo, note: `yük ölçümü ${i}` });
  return who.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: 1 + (i % 9), date: TODAY, method: "cash", note: `yük ölçümü ${i}` });
};

async function openPage(username) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
  page.on("dialog", d => d.accept());
  await page.goto(`${BASE}/?hofCompany=${C1}`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", STAFF_PASS);
  await page.click('#hof-auth button[type="submit"]');
  await page.waitForSelector("#hof-sidecard [data-action=accounts]", { timeout: 60000 });
  const company = await page.evaluate(() => window.HOF?.companyId || "");
  if (company !== C1) throw new Error(`${username} penceresi 001'de değil (${company})`);
  await page.waitForTimeout(2500);
  return page;
}
const pct = (list, p) => (list.length ? Math.round([...list].sort((x, y) => x - y)[Math.min(list.length - 1, Math.floor(list.length * p))]) : 0);

// 1) Sunucu hızı
async function throughput(kind, seconds = 20) {
  const writer = await person("alis001");
  const end = Date.now() + seconds * 1000;
  let n = 0;
  let failed = 0;
  const lat = [];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (Date.now() < end) {
      const i = n;
      n += 1;
      const t = performance.now();
      const r = await write(writer, kind, i);
      lat.push(performance.now() - t);
      if (r.status !== 200) failed += 1;
    }
  }));
  return { perSecond: +((n - failed) / seconds).toFixed(1), p50: pct(lat, 0.5), p95: pct(lat, 0.95), failed };
}
const RESULT_FILE = path.join(HERE, "cikti", `yuk-olcum-${ETIKET}.json`);
let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(RESULT_FILE, "utf8"));
} catch {
  previous = {};
}
const result = { hiz: {}, istek: {}, ekran: {}, ...previous, etiket: ETIKET, surum: version, kod: KOD, tarih: new Date().toISOString(), bolumler: [...BOLUM] };
const save = () => fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 1));
const windows = [];
if (BOLUM.has("hiz")) result.hiz = {};
for (const count of BOLUM.has("hiz") ? [0, 2, 5] : []) {
  const users = ["arayuz001", "mudur", "satis001", "tahsilat001", "stajyer001"];
  while (windows.length < count) windows.push(await openPage(users[windows.length]));
  await new Promise(r => setTimeout(r, 2000));
  for (const kind of ["not", "para"]) {
    const t = await throughput(kind);
    result.hiz[`${kind} · ${count} pencere`] = t;
    console.log(`[${ETIKET}] hız ${kind} · ${count} açık pencere: saniyede ${t.perSecond} kayıt, p50 ${t.p50} ms, p95 ${t.p95} ms${t.failed ? `, ${t.failed} başarısız` : ""}`);
    await new Promise(r => setTimeout(r, 3000));
  }
}
for (const page of windows) await page.context().close();
save();

// 2) Açık bir pencerenin isteği (başka personel 10 kayıt, saniyede bir)
async function requestsOf(screen, kind) {
  const page = await openPage("arayuz001");
  if (screen === "cari") {
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${MODAL} tr[data-account]`);
    await page.waitForTimeout(2000);
  }
  const log = [];
  const started = new Map();
  page.on("request", r => r.url().includes("/api/") && started.set(r, performance.now()));
  page.on("requestfinished", async r => {
    if (!started.has(r)) return;
    const body = await (await r.response())?.body().catch(() => Buffer.alloc(0));
    log.push({ url: r.url().replace(BASE, "").split("?")[0], ms: performance.now() - started.get(r), kb: (body?.length || 0) / 1024 });
  });
  const colleague = await person("alis001");
  for (let i = 0; i < 10; i += 1) {
    await write(colleague, kind, 5000 + i);
    await new Promise(r => setTimeout(r, 1000));
  }
  await page.waitForTimeout(5000);
  await page.context().close();
  const by = {};
  for (const item of log) (by[item.url] ||= { n: 0, kb: 0 }), (by[item.url].n += 1), (by[item.url].kb += item.kb);
  return { istek: log.length, kb: Math.round(log.reduce((s, x) => s + x.kb, 0)), enUzunMs: Math.round(Math.max(0, ...log.map(x => x.ms))), uclar: Object.fromEntries(Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, `${v.n}× ${Math.round(v.kb)} KB`])) };
}
if (BOLUM.has("istek")) result.istek = {};
for (const screen of BOLUM.has("istek") ? ["ana", "cari"] : []) {
  for (const kind of ["not", "para"]) {
    const r = await requestsOf(screen, kind);
    result.istek[`${screen} ekran · ${kind}`] = r;
    console.log(`[${ETIKET}] ${screen} ekran, başkasının 10 "${kind}" kaydı sırasında: ${r.istek} istek, ${r.kb} KB, en uzun ${r.enUzunMs} ms · ${JSON.stringify(r.uclar)}`);
  }
}
save();

// 3) İnsanın hissettiği: Cari aramasında tuş → harf ve son tuş → sonuç
if (BOLUM.has("ekran")) {
result.ekran = {};
const page = await openPage("arayuz001");
const input = `${MODAL} input[data-filter=q]`;
const openAccounts = async () => {
  await page.click("#hof-sidecard [data-action=accounts]");
  await page.waitForSelector(`${MODAL} tr[data-account]`, { timeout: 60000 });
  await page.waitForTimeout(1500);
};
await openAccounts();
// Cari penceresi ölçüm sırasında kaybolursa (kapandı / başka görünüme geçti) kanıt alınır, pencere yeniden açılır.
const lost = [];
const ensureWindow = async label => {
  if (await page.locator(input).isVisible().catch(() => false)) return false;
  const shot = path.join(HERE, "cikti", "ekran", `yuk-${ETIKET}-pencere-${label}.png`);
  await page.screenshot({ path: shot }).catch(() => null);
  const modals = await page.evaluate(() => [...document.querySelectorAll(".hof-modal-backdrop")].map(node => `${node.classList.contains("is-visible") ? "görünür" : "gizli"}: ${(node.querySelector("h2, .hof-modal-title")?.textContent || "").trim().slice(0, 60)}`));
  lost.push({ label, modals, shot: path.basename(shot) });
  console.log(`[${ETIKET}] UYARI: Cari arama kutusu görünmüyor (${label}); pencereler: ${JSON.stringify(modals)} → yeniden açılıyor`);
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await openAccounts();
  return true;
};
for (const kind of ["not", "para"]) {
  for (const rate of [0, 1, 5]) {
    let alive = true;
    let written = 0;
    const colleague = await person("alis001");
    const noise = (async () => {
      while (alive && rate) {
        await write(colleague, kind, 7000 + written);
        written += 1;
        await new Promise(r => setTimeout(r, 1000 / rate));
      }
    })();
    await page.waitForTimeout(2500);
    const reopened = await ensureWindow(`${kind}-${rate}`);
    const freeze = await page.evaluate(async () => {
      let total = 0;
      const observer = new PerformanceObserver(list => list.getEntries().forEach(entry => (total += entry.duration)));
      observer.observe({ type: "longtask", buffered: false });
      await new Promise(r => setTimeout(r, 10000));
      observer.disconnect();
      return Math.round(total);
    });
    // Donma ölçümünün (10 sn) sırasında da pencere kaybolabilir: kutu kullanılmadan hemen önce yeniden denetlenir.
    const reopenedAfter = await ensureWindow(`${kind}-${rate}-olcum-sonrasi`);
    const box = await page.locator(input).boundingBox();
    if (!box) throw new Error(`Cari arama kutusu yeniden açıldıktan sonra da görünmüyor (${kind}, ${rate}/sn)`);
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    const lags = [];
    for (const ch of "C0123") {
      await page.evaluate(sel => {
        window.__k = performance.now();
        window.__len = (document.querySelector(sel)?.value || "").length;
      }, input);
      await page.keyboard.type(ch);
      lags.push(await page.evaluate(async sel => {
        const t = window.__k;
        while (performance.now() - t < 30000) {
          if ((document.querySelector(sel)?.value || "").length > window.__len) return Math.round(performance.now() - t);
          await new Promise(r => setTimeout(r, 5));
        }
        return -1;
      }, input));
    }
    // Son tuştan arama sonucuna: listede yalnız C0123'ü içeren satırlar (en az bir) kalana dek.
    const searchMs = await page.evaluate(async ({ modal, start }) => {
      const t = start;
      while (performance.now() - t < 30000) {
        const rows = [...document.querySelectorAll(`${modal} tr[data-account]`)];
        if (rows.length && rows.every(row => row.textContent.includes("C0123"))) return Math.round(performance.now() - t);
        await new Promise(r => setTimeout(r, 10));
      }
      return -1;
    }, { modal: MODAL, start: await page.evaluate(() => window.__k) });
    const value = await page.locator(input).inputValue();
    alive = false;
    await noise;
    const row = { kayitSn: rate, tur: kind, yazilan: written, donmaMs: freeze, tusHarfMs: lags, aramaSonucuMs: searchMs, kutuda: value, pencereYenidenAcildi: reopened || reopenedAfter };
    result.ekran[`${kind} · ${rate}/sn`] = row;
    console.log(`[${ETIKET}] ekran ${kind} · başkası saniyede ${rate}: tuş→harf ${lags.join("/")} ms · son tuş→sonuç ${searchMs} ms · 10 sn'de donma ${freeze} ms · kutuda "${value}"${reopened || reopenedAfter ? " · pencere yeniden açıldı" : ""}`);
    save();
    if (await page.locator(input).isVisible().catch(() => false)) await page.fill(input, "");
    await page.waitForTimeout(3000);
  }
}
result.pencereKayiplari = lost;
await page.context().close();
}
save();
await browser.close();
await app.close();
fs.rmSync(WORK, { recursive: true, force: true });
console.log(`[${ETIKET}] bitti → cikti/yuk-olcum-${ETIKET}.json`);
