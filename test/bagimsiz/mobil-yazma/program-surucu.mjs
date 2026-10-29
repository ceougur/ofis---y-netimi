#!/usr/bin/env node
// M5 mobil yazma kâhininin PROGRAM SÜRÜCÜSÜ (2.4.7; kâhin bu dosyayı okumaz — README "Programa eşleme"). Kâhinin beklentisine DOKUNMAZ (ders 40): eşleme
// aşağıda, karşılaştırmadan ÖNCE yazıldı; beklenen değer burada HESAPLANMAZ, her değer programın kendi ucundan okunur (ders 5).
//
// kabul.json'daki her senaryoyu GERÇEK programda koşar (her senaryo ayrı kurulum: kendi veri klasörü, kendi lisansı, kendi uzak dinleyicisi — ders 17):
//   - Mobil adım TELEFONUN yolundan gider: uzaktan erişim dinleyicisi (app.listenRemote; M4'te tünel yalnız buraya bağlanır) → karekodla eşlenmiş cihaz
//     (test/mobil-uzak-ortak.mjs createPhone: dışa aktarılamaz anahtar + imzalı giriş) → /api/mobil/… yazma ucu (lib/mobile-write.mjs).
//   - Masaüstü adım masaüstü oturumunun yazma ucundan (cari kartı + Tahsilat / Ödeme, taksit kartı, Çek/Senet, Stok hareketi).
//   - Telefon davranışları (S4 onay soruları, S7 24 saat kuralı) telefonun gönderdiği isteğin aynısıdır: S7 telefonun KENDİ modülünden (client/mobil/yazma-bekleyen.js).
// Saat: tek sahte, SABİT saat (iş saati config.now, uzak güvenlik saati config.remoteNow, lisans saati); her adımda senaryonun anına (ders 13, 22). Süreç saat dilimi
// Türkiye (kâhin V1: sabit UTC+3; kurulum Türkiye saatinde çalışır). Lisans servisi sahte ve yereldir (fetchImpl; ders 30 — gerçek servise istek gitmez).
//
// Kullanım:
//   node test/bagimsiz/mobil-yazma/program-surucu.mjs [--senaryo E01-es-nakit-fifo-mobil,E14-lisans] [--cikti <klasör>] [--birlesim "k=v;…"]
//   KANIT_DIR=… node tools/kanit.mjs kos m5-kahin -- node test/bagimsiz/mobil-yazma/program-surucu.mjs --cikti <klasör>
// Çıktı: <klasör>/program.json (senaryo → anahtar → değer), <klasör>/notlar.json (okunamayan / üretilemeyen değerlerin nedeni), ekrana kâhinin karşılaştırması (TAP,
// "# tests/pass/fail") + göreli çiftler. Çıkış 0 yalnız bütün senaryolar ve göreli çiftler eşleşince.
process.env.TZ = "Europe/Istanbul";

import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
// Sınanan program: varsayılan bu depo; KAHIN_PROGRAM_KOKU=<klasör> ile başka bir kopya (eski kod — ders 23: ayrı kopyada).
const PROGRAM = process.env.KAHIN_PROGRAM_KOKU ? path.resolve(process.env.KAHIN_PROGRAM_KOKU) : ROOT;
// E27 (kaynakSurum): eski sürümün GERÇEK kodu (git archive v2.4.6) — KAHIN_ESKI_SURUM_KOKU; verilmezse senaryo DENENMEYEN.
const ESKI = process.env.KAHIN_ESKI_SURUM_KOKU ? path.resolve(process.env.KAHIN_ESKI_SURUM_KOKU) : "";
const imp = (root, rel) => import(pathToFileURL(path.join(root, rel)).href);
const { ADMIN_PASSWORD, createClient, startTestServer } = await imp(PROGRAM, "test/helpers.mjs");
const { createClock } = await imp(PROGRAM, "server/lib/clock.mjs");
const { signToken } = await imp(PROGRAM, "server/lib/license-token.mjs");
const { createPhone } = await imp(ROOT, "test/mobil-uzak-ortak.mjs");
// S7 (telefon kuralı): telefonun kendi modülü; eski kodda yoksa kural yok sayılır (telefon her zaman gönderir — eski kod mobil yazmayı zaten tanımaz).
const bekleyen = await imp(PROGRAM, "client/mobil/yazma-bekleyen.js").catch(() => null);
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const OUT = opt("--cikti") ? path.resolve(opt("--cikti")) : mkdtempSync(path.join(tmpdir(), "kahin-mobil-yazma-"));
mkdirSync(OUT, { recursive: true });
const KABUL_YOLU = path.join(HERE, "kabul.json");
const kabul = JSON.parse(readFileSync(KABUL_YOLU, "utf8"));
const BIRLESIM = opt("--birlesim") || kabul.secilen_birlesim || Object.entries(kabul.oneri).map(([k, v]) => `${k}=${v}`).join(";");
const SECIM = Object.fromEntries(BIRLESIM.split(";").filter(Boolean).map(x => x.split("=")));
const FILTRE = opt("--senaryo") ? new Set(opt("--senaryo").split(",")) : null;

// ---------- Eşleme tablosu (karşılaştırmadan ÖNCE) ----------
const ROLE = { yonetici: "admin", muhasebe: "muhasebe", personel: "personel" };
const POLICY = { uyar: "warn", engelle: "block", kontrol_yok: "off" };
const TAHSILAT_YOL = { nakit: "cash", havale: "bank", pos: "card" };
const ODEME_YOL = { nakit: "cash", havale: "bank", kart: "card" };
const PASSWORD = "Mobil-Yazma-2026!";
// Telefonun sorduğu sorular (client/mobil/yazma.js QUESTIONS ile aynı; masaüstü formlarının soruları): program kodu → adımın onayı → gövde bayrağı.
const QUESTION = { "cash-negative": { step: "yineDeKaydet", body: "cashForce" }, "bank-similar": { step: "benzerOnay", body: "similarOk" }, "plan-overpay": { step: "fazlaAvans", body: "overpay" }, "plan-paid": { step: "fazlaAvans", body: "overpay" }, "stock-negative": { step: "eksiOnay", body: "force" } };
const MINUTE = 60_000;
const ms = text => Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}+03:00`);
const trDay = value => new Date(value + 3 * 3_600_000).toISOString().slice(0, 10);
const kurusOf = s => {
  const [t, o = ""] = String(s).split(",");
  return Number(t) * 100 + Number((o + "00").slice(0, 2));
};
const kurus = x => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100));
// Program istek kimliği 16–100 karakter (A–Z a–z 0–9 _ -); kâhinin kısa kimliği ön ekle eşlenir (aynı kimlik → aynı program kimliği; kanal ve şirket ayırmaz).
const programRequestId = kimlik => `kahin-m5-${String(kimlik).replace(/[^A-Za-z0-9_-]/g, "_")}`.padEnd(16, "0");

const KEY = (() => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { pem: privateKey.export({ format: "pem", type: "pkcs8" }), spki: publicKey.export({ format: "der", type: "spki" }).toString("base64") };
})();
const TRUSTED = { "kahin-m5-1": KEY.spki };

async function runScenario(sen, root) {
  const start = sen.baslangic;
  const clock = createClock({ time: ms(start.simdi), fixed: true });
  const P = {};
  const notes = [];
  const dir = mkdtempSync(path.join(root, `${sen.ad}-`));
  const office = { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), machine: `aa${"cd".repeat(15)}`, licenseValid: start.lisans !== "bitti", server: null, up: false, legacy: Boolean(start.kaynakSurum) };
  const fetchImpl = async () => {
    const at = new Date(clock.ms()).toISOString();
    const expires = office.licenseValid ? null : new Date(clock.ms() - 86_400_000).toISOString();
    const token = signToken({
      schema: 1, product: "DestekOfis", type: "license-token", kind: "license", status: office.licenseValid ? "active" : "blocked", licenseId: "LIS-KAHIN-M5", customer: "Ofis M5", machine: office.machine,
      issuedAt: at, startsAt: at, expiresAt: expires, offline: false, message: "",
    }, KEY.pem, "kahin-m5-1");
    return { status: 200, json: async () => ({ ok: true, token }) };
  };
  const licenseOptions = { enforce: true, trustedKeys: TRUSTED, services: ["https://lisans.kahin.test/api/lisans"], fetchImpl, machineId: office.machine, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false };
  async function boot(root = office.legacy ? ESKI : PROGRAM) {
    const helpers = root === PROGRAM ? { startTestServer } : await imp(root, "test/helpers.mjs");
    office.server = await helpers.startTestServer({ dataDir: office.dataDir, backupDir: office.backupDir, now: clock, remoteNow: clock, license: licenseOptions, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    office.up = true;
    // Tanı (karşılaştırmaya girmez): hangi kod açıldı — eski sürüm kopyasında uzak dinleyici (2.4.7 M2) yoktur.
    office.boots = (office.boots || 0) + 1;
    P[`tani:acilis${office.boots}`] = `${root === PROGRAM ? "program" : "eski-surum"}:${typeof office.server.app.listenRemote === "function" ? "uzak-dinleyici-var" : "uzak-dinleyici-yok"}`;
    office.remoteBase = typeof office.server.app.listenRemote === "function" && !office.legacy ? `http://127.0.0.1:${(await office.server.app.listenRemote(0, "127.0.0.1")).port}` : "";
    for (const phone of phones.values()) phone.base = office.remoteBase || "http://127.0.0.1:9";
    clients.clear();
  }
  async function shutdown() {
    if (!office.up) return;
    await office.server.app.close();
    office.up = false;
  }
  const checkLicense = async () => {
    if (office.up) await office.server.app.license.check().catch(() => {});
  };

  // ---------- kullanıcılar, şirketler, istemciler ----------
  const users = { Y: { rol: "yonetici", uzak: true, sirketler: [], username: "admin", password: ADMIN_PASSWORD } };
  for (const [alias, u] of Object.entries(start.kullanicilar || {})) users[alias] = { rol: u.rol, uzak: Boolean(u.uzak), sirketler: [...(u.sirketler || [])], username: `m5-${alias.toLowerCase()}`, password: PASSWORD };
  const clients = new Map(); // kullanıcı → masaüstü istemcisi (oturum)
  const phones = new Map(); // cihaz etiketi → telefon
  const deviceUser = new Map(); // cihaz etiketi → kullanıcı
  const companyIds = {}; // şirket kodu → kimlik
  const ids = { cari: {}, cariSirket: {}, fatura: {}, faturaSirket: {}, faturaCari: {}, kart: {}, kartSirket: {}, kartCari: {}, hesap: {}, hesapTur: {}, hesapSirket: {}, urun: {}, urunSirket: {}, acilis: {}, yedek: {} };
  const deleted = new Set();
  const companies = new Set(Object.keys(start.sirketler || { "001": {} }));
  const settings = {};
  for (const code of companies) settings[code] = { ...(start.sirketler?.[code] || {}) };
  const sent = new Map(); // adım kimliği → { step, ctx } (yeniden gönderim)

  async function clientOf(alias) {
    if (clients.has(alias)) return clients.get(alias);
    const u = users[alias];
    const client = createClient(office.server.base);
    const r = await client.login(u.username, u.password);
    if (r.status !== 200) throw new Error(`${sen.ad}: ${alias} girişi olmadı (${r.status} ${JSON.stringify(r.data).slice(0, 200)})`);
    clients.set(alias, client);
    return client;
  }
  const adminC = () => clientOf("Y");
  const withCompany = (url, code) => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(companyIds[code])}`;
  const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data, code: r.data?.code || "", error: r.data?.error || "" });
  const call = async (client, method, url, body, headers) => unwrap(method === "GET" ? await client.get(url, headers) : method === "DELETE" ? await client.del(url, headers) : method === "PUT" ? await client.put(url, body, headers) : await client.post(url, body, headers));
  const must = async (what, promise) => {
    const r = await promise;
    if (r.status !== 200) throw new Error(`${sen.ad}: ${what} → ${r.status} ${r.code} ${String(r.error).slice(0, 200)}`);
    return r.data;
  };
  const userIds = async () => Object.fromEntries((await must("kullanıcılar", call(await adminC(), "GET", "/api/admin/users"))).map(u => [u.username, u.id]));
  async function applyCompanyAccess(alias) {
    const u = users[alias];
    if (u.rol === "yonetici") return;
    const list = u.sirketler.filter(code => companyIds[code]).map(code => companyIds[code]);
    await must(`${alias} şirket yetkisi`, call(await adminC(), "PUT", `/api/companies/access/${u.id}`, { companies: list }));
  }
  async function applySettings(code) {
    const s = settings[code];
    await must(`${code} Kasa eksi bakiye`, call(await adminC(), "PUT", withCompany("/api/admin/negative-policy", code), { cash: POLICY[s.kasaEksi || "kontrol_yok"] }));
    if (s.benzer !== undefined) await must(`${code} Benzer İşlem`, call(await adminC(), "PUT", withCompany("/api/workspace/bank/settings", code), { values: { similar: { enabled: Boolean(s.benzer) } } }));
  }
  async function openCompany(code) {
    const r = await must(`şirket ${code}`, call(await adminC(), "POST", "/api/companies", { code, name: `Şirket ${code}` }));
    companyIds[code] = r.company.id;
    companies.add(code);
    await applySettings(code);
    for (const alias of Object.keys(users)) await applyCompanyAccess(alias);
  }
  const remoteAccess = async (alias, value) => must(`${alias} uzak izin`, call(await adminC(), "PUT", `/api/admin/mobile/access/${users[alias].id}`, { remote: Boolean(value) }));
  // Lisans geçersizken program yönetim yazmasını yapmaz (salt okunur: karekod üretilmez — M2 BAŞ MİMAR KARARI 7; şirket yetkisi yazılmaz); sunucu kapalıyken
  // hiçbir yönetim işlemi yapılamaz. Kâhin bu ortam adımlarını (eşle, sil, uzak izin, şirket yetkisi) lisanstan ve sunucudan bağımsız uygular; o arada her
  // mobil yazma iki dünyada da reddedilir (K2 ulaşılamadı, K15 lisans). Sürücü bu yönetim adımlarını SIRASIYLA, sunucu açık ve lisans geçerli olunca uygular
  // (aynı son durum). Kâhinin senaryolarında bu pencerelerde masaüstü adımı ve kontrol yok (sürücü öyle görürse hata verir).
  const deferred = [];
  const available = () => office.up && office.licenseValid;
  const whenLicensed = async act => (available() ? act() : void deferred.push(act));
  const flushDeferred = async () => {
    if (available()) for (const act of deferred.splice(0)) await act();
  };
  async function pairDevice(label, alias) {
    const code = await must(`${label} karekod`, call(await adminC(), "POST", "/api/admin/mobile/codes", { userId: users[alias].id }));
    const phone = createPhone(office.remoteBase, { name: `Cihaz ${label}` });
    const paired = await phone.pair(code.code);
    if (paired.status !== 200) throw new Error(`${sen.ad}: ${label} eşlenemedi ${paired.status} ${paired.code}`);
    phones.set(label, phone);
    deviceUser.set(label, alias);
    await phoneLogin(label);
  }
  async function phoneLogin(label) {
    const phone = phones.get(label);
    const u = users[deviceUser.get(label)];
    const r = await phone.login(u.username, u.password);
    phone.loginAt = clock.ms();
    phone.seenAt = clock.ms();
    phone.loggedIn = r.status === 200;
    return r;
  }
  // Uzak oturum boşta 15 dk / en çok 12 saat (P7/P8; M2 kâhininin konusu): senaryonun saati ilerleyince telefonun kullanıcısı yeniden giriş yapar — bu
  // katmanda oturum süresi sınanmaz (kâhin V14). Silinmiş cihazda giriş olmaz; istek yine gönderilir ve kapıda reddedilir.
  async function ensureSession(label) {
    const phone = phones.get(label);
    if (!phone || !office.up) return;
    const t = clock.ms();
    if (!phone.loggedIn || t - phone.seenAt >= 14 * MINUTE || t - phone.loginAt >= 11 * 60 * MINUTE) await phoneLogin(label);
  }

  // ---------- kurulum ----------
  await boot();
  {
    const activated = await office.server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX").catch(error => error);
    if (activated instanceof Error || !office.server.app.license.status().writable) throw new Error(`${sen.ad}: kurulum lisansı etkinleşmedi (${activated?.message || "salt okunur"})`);
  }
  companyIds["001"] = (await must("şirketler", call(await adminC(), "GET", "/api/companies"))).companies.find(c => c.code === "001").id;
  for (const code of [...companies].filter(c => c !== "001").sort()) {
    const r = await must(`şirket ${code}`, call(await adminC(), "POST", "/api/companies", { code, name: `Şirket ${code}` }));
    companyIds[code] = r.company.id;
  }
  for (const [alias, u] of Object.entries(users)) {
    if (alias === "Y") continue;
    await must(`kullanıcı ${alias}`, call(await adminC(), "POST", "/api/admin/users", { username: u.username, name: `Kâhin ${alias}`, role: ROLE[u.rol], password: u.password, mustChangePassword: false }));
  }
  {
    const byName = await userIds();
    for (const u of Object.values(users)) u.id = byName[u.username];
  }
  for (const alias of Object.keys(users)) await applyCompanyAccess(alias);
  for (const code of companies) await applySettings(code);
  const pendingDevices = Object.entries(start.cihazlar || {});
  async function pairStartDevices() {
    for (const [alias, u] of Object.entries(users)) if (u.uzak && !u.remoteSet) {
      await remoteAccess(alias, true);
      u.remoteSet = true;
    }
    for (const [label, alias] of pendingDevices.splice(0)) await pairDevice(label, alias);
  }
  if (!office.legacy) await pairStartDevices();
  office.licenseValid = start.lisans !== "bitti";
  await checkLicense();

  // ---------- istek (para / stok) ----------
  const accountOf = alias => ids.cari[alias] || `account-yok-${alias}`;
  function buildRequest(step, ctx) {
    const company = step.sirket || "001";
    const mobile = step.kanal === "mobil";
    const rid = programRequestId(step.istekKimligi);
    const hesap = step.hesap ? ids.hesap[step.hesap] || `hesap-yok-${step.hesap}` : undefined;
    const hesapTur = step.hesap ? ids.hesapTur[step.hesap] : null;
    const flags = { ...(step.yineDeKaydet ? { cashForce: true } : {}), ...(step.benzerOnay ? { similarOk: true } : {}), ...(step.fazlaAvans ? { overpay: true } : {}) };
    const desktopDate = step.tarih || trDay(ctx.formMs);
    if (step.islem === "stok") {
      const item = ids.urun[step.urun] || `stok-yok-${step.urun}`;
      if (mobile) {
        const body = { qty: String(step.miktar), ...(step.yon === "cikis" ? { kind: "out" } : {}) };
        return { mobile, rid, company, url: `/api/mobil/stock/${item}/giris?company=${encodeURIComponent(companyIds[company] || company)}`, body };
      }
      return { mobile, rid, company, url: withCompany(`/api/workspace/stock/${item}/moves`, company), body: { kind: step.yon === "cikis" ? "out" : "in", qty: String(step.miktar), pay: "none", date: desktopDate, ...(step.eksiOnay ? { force: true } : {}) } };
    }
    const tahsilat = step.islem === "tahsilat";
    const way = (tahsilat ? TAHSILAT_YOL : ODEME_YOL)[step.yol || "nakit"] || step.yol;
    const evrak = step.yol === "cek" || step.yol === "senet";
    const amount = step.tutar;
    // Hesap: banka / kart hesabı → bankAccountId; POS → POS yolunda posId, başka yolda (yanlış tür) bankAccountId olarak (program türünü denetler).
    const account = hesap === undefined ? {} : hesapTur === "pos" && way === "card" && tahsilat ? { posId: hesap } : { bankAccountId: hesap };
    if (mobile) {
      const companyParam = `company=${encodeURIComponent(companyIds[company] || company)}`;
      // Telefon onay bayrağını ilk istekte GÖNDERMEZ: soruyu (409) görünce kullanıcı onaylarsa aynı kimlikle bayrakla yeniden gönderir (send → QUESTION).
      const body = { amount, method: evrak ? step.yol : way, ...account, ...(step.fatura ? { invoiceId: ids.fatura[step.fatura] || `fatura-yok-${step.fatura}` } : {}) };
      if (step.kart) return { mobile, rid, company, url: `/api/mobil/plans/${ids.kart[step.kart] || `kart-yok-${step.kart}`}/tahsilat?${companyParam}`, body };
      return { mobile, rid, company, url: `/api/mobil/accounts/${accountOf(step.cari)}/${tahsilat ? "tahsilat" : "odeme"}?${companyParam}`, body };
    }
    if (evrak) {
      const body = { direction: tahsilat ? "in" : "out", instrument: step.yol === "senet" ? "note" : "cheque", accountId: accountOf(step.cari), amount, issueDate: desktopDate, dueDate: desktopDate, serialNo: `M5-${step.id}`, bank: "Ziraat", ...(step.fatura ? { invoiceId: ids.fatura[step.fatura] || `fatura-yok-${step.fatura}` } : {}), ...flags };
      return { mobile, rid, company, url: withCompany("/api/workspace/cheques", company), body };
    }
    if (step.kart) return { mobile, rid, company, url: withCompany(`/api/workspace/plans/${ids.kart[step.kart] || `kart-yok-${step.kart}`}/entries`, company), body: { kind: "in", amount, date: desktopDate, method: way, ...account, ...flags } };
    return { mobile, rid, company, url: withCompany(`/api/workspace/accounts/${accountOf(step.cari)}/entries`, company), body: { kind: tahsilat ? "in" : "out", amount, date: desktopDate, method: way, ...account, ...flags, ...(step.fatura ? { invoiceId: ids.fatura[step.fatura] || `fatura-yok-${step.fatura}` } : {}) } };
  }
  // Tek istek. Dönüş: { durum, http, kod } (programın yanıtı kâhinin dilinde: 200 + replayed → yineleme; 2xx → ok; 4xx/5xx → ret; bağlantı yok → ulasilamadi).
  async function send(step, ctx, req) {
    if (req.mobile) {
      // Henüz eşlenmemiş (lisans beklerken) cihaz: istek eşlemesiz telefondan gider — ret programın kendi kapısından (sürücü ret uydurmaz).
      const phone = phones.get(step.cihaz) || createPhone(office.remoteBase, { name: `Eşlenmemiş ${step.cihaz}` });
      try {
        let body = req.body;
        for (;;) {
          const r = await phone.post(req.url, body, { headers: { "x-hof-request": req.rid } });
          phone.seenAt = clock.ms();
          if (r.status === 200 && r.data?.ok) return { durum: r.data.data?.replayed ? "yineleme" : "ok", http: 200 };
          // S4 / S5 (telefon davranışı, masaüstüyle aynı soru): soru gelir, adımın kullanıcısı onaylamışsa aynı kimlikle bayrakla yeniden gönderilir.
          const flag = r.status === 409 ? QUESTION[r.code] : null;
          if (flag && step[flag.step] && !body[flag.body]) {
            body = { ...body, [flag.body]: true };
            continue;
          }
          return { durum: "ret", http: r.status, kod: r.code || r.data?.code || "", ileti: String(r.data?.error || "").slice(0, 160) };
        }
      } catch (error) {
        if (["ECONNREFUSED", "ECONNRESET"].includes(error?.code)) return { durum: "ulasilamadi" };
        throw error;
      }
    }
    const client = await clientOf(step.kullanici || "Y");
    const r = await call(client, "POST", req.url, req.body, { "x-hof-request": req.rid });
    if (r.status === 200) return { durum: r.data?.replayed ? "yineleme" : "ok", http: 200 };
    return { durum: "ret", http: r.status, kod: r.code || "", ileti: String(r.error || "").slice(0, 160) };
  }
  const record = (id, result, kesinti) => {
    if (result.durum === "ulasilamadi") return (P[`adim:${id}:durum`] = "ulasilamadi");
    if (kesinti === "sonra") {
      P[`adim:${id}:durum`] = "belirsiz";
      P[`adim:${id}:sunucu`] = result.durum;
      // Tanı (kâhin bu anahtarı beklemez; karşılaştırmaya girmez): gizli yanıtın HTTP kodu ve programın ret kodu.
      if (result.durum === "ret") P[`tani:${id}:sunucu`] = `${result.http} ${result.kod || "kodsuz"} ${result.ileti || ""}`;
      return;
    }
    P[`adim:${id}:durum`] = result.durum;
    if (result.durum === "ret") {
      P[`adim:${id}:http`] = result.http;
      P[`adim:${id}:kod`] = result.kod || "kodsuz";
      P[`tani:${id}:ileti`] = result.ileti || "";
    }
  };
  async function moneyStep(step, { resendOf = null, kesinti = step.kesinti } = {}) {
    const first = resendOf ? sent.get(resendOf) : null;
    const original = first ? first.step : step;
    const ctx = first ? first.ctx : { formMs: step.formAcilis ? ms(step.formAcilis) : clock.ms() };
    if (!first) sent.set(step.id, { step, ctx });
    else sent.set(step.id, first);
    // S7: telefon 24 saatten eski sonucu belirsiz isteği yeniden GÖNDERMEZ (telefonun modülü karar verir).
    if (resendOf && original.kanal === "mobil" && bekleyen && !bekleyen.yenidenGonderilebilir({ formAt: ctx.formMs }, clock.ms())) return void (P[`adim:${step.id}:durum`] = "atildi");
    if (original.kanal === "mobil" && !office.up) return void (P[`adim:${step.id}:durum`] = "ulasilamadi");
    if (kesinti === "once") {
      P[`adim:${step.id}:durum`] = "belirsiz";
      P[`adim:${step.id}:sunucu`] = "yok";
      return;
    }
    if (original.kanal === "mobil") await ensureSession(original.cihaz);
    const req = buildRequest(original, ctx);
    record(step.id, await send(original, ctx, req), kesinti);
  }

  // ---------- okuma (kontrol) ----------
  async function kontrol(k) {
    const admin = await adminC();
    for (const code of [...companies].sort()) {
      const p = `${k}:${code}:`;
      const get = (url, what) => must(what, call(admin, "GET", withCompany(url, code)));
      const kartli = new Set(Object.entries(ids.kartCari).filter(([kad]) => ids.kartSirket[kad] === code).map(([, cad]) => cad));
      for (const [cad, id] of Object.entries(ids.cari)) {
        if (ids.cariSirket[cad] !== code || deleted.has(cad)) continue;
        const d = await get(`/api/workspace/accounts/${id}`, `cari ${cad}`);
        P[`${p}cari:${cad}:bakiye`] = kurus(d.totals?.balance);
        P[`${p}cari:${cad}:hareketSayisi`] = (d.entries || []).filter(e => (e.kind === "in" || e.kind === "out") && !e.source).length;
        if (!kartli.has(cad)) {
          if (ids.acilis[cad]) {
            const e = (d.entries || []).find(x => x.id === ids.acilis[cad]);
            P[`${p}acilis:${cad}:kalan`] = e && "remaining" in e ? kurus(e.remaining) : "okunamadı";
          }
          for (const [fad, fid] of Object.entries(ids.fatura)) {
            if (ids.faturaCari[fad] !== cad || ids.faturaSirket[fad] !== code) continue;
            const f = await get(`/api/workspace/invoices/${fid}`, `fatura ${fad}`);
            P[`${p}fatura:${fad}:acik`] = kurus(f.open);
          }
        }
      }
      for (const [kad, kid] of Object.entries(ids.kart)) {
        if (ids.kartSirket[kad] !== code) continue;
        const d = await get(`/api/workspace/plans/${kid}`, `kart ${kad}`);
        P[`${p}kart:${kad}:odenen`] = kurus(d.totals?.paid);
        P[`${p}kart:${kad}:fazla`] = kurus(d.totals?.extra);
        // Tanı (karşılaştırmaya girmez): programın "Ödenen"i karta yapılan bütün tahsilattır (Fazlasını Avans Yaz dahil); kâhinin "odenen"i kart tutarına
        // sayılan kısımdır (V10). Fark yalnız tanımdansa bu değer kâhinin odenen'ine eşittir.
        P[`tani:${p}kart:${kad}:odenenAvansHaric`] = kurus(d.totals?.paid) - kurus(d.totals?.extra);
        P[`${p}kart:${kad}:kalan`] = kurus(d.totals?.remaining);
        P[`${p}kart:${kad}:tahsilatSayisi`] = (d.entries || []).filter(e => e.kind === "in").length;
        (d.items || []).forEach((it, i) => (P[`${p}kart:${kad}:taksit${i + 1}:odenen`] = kurus(it.paid)));
      }
      const cash = await get("/api/workspace/cash?from=2000-01-01&to=2099-12-31&method=cash", "Kasa");
      P[`${p}kasa`] = kurus(cash.totals?.balance);
      const days = {};
      for (const e of cash.entries || []) days[e.date] = (days[e.date] || 0) + (e.kind === "out" ? -1 : 1) * kurus(e.amount);
      if (cash.opening && Number(cash.opening.amount)) days[cash.opening.date] = (days[cash.opening.date] || 0) + kurus(cash.opening.amount);
      for (const [day, v] of Object.entries(days).sort()) if (v) P[`${p}kasaGun:${day}`] = v;
      const sub = await get("/api/workspace/bank/sub-trial?from=2000-01-01&to=2099-12-31", "Alt Hesap Mizanı");
      const subBalance = new Map((sub.rows || []).map(row => [row.sub, kurus(row.balance)]));
      for (const [had, hid] of Object.entries(ids.hesap)) {
        if (ids.hesapSirket[had] !== code) continue;
        const kind = { banka: "banka", pos: "pos", kart: "kartHesap" }[ids.hesapTur[had]];
        const gl = ids.hesapGl?.[had];
        P[`${p}${kind}:${had}`] = gl && subBalance.has(gl) ? subBalance.get(gl) : gl ? 0 : "okunamadı";
        void hid;
      }
      for (const gl of ["102.00", "108.00"]) if (subBalance.get(gl)) P[`${p}hesapsiz:${gl}`] = subBalance.get(gl);
      const cheques = (await get("/api/workspace/cheques?status=all", "Çek/Senet")).cheques || [];
      P[`${p}evrakSayisi`] = cheques.length;
      P[`${p}portfoy`] = cheques.filter(c => c.status === "portfolio").reduce((s, c) => s + kurus(c.amount), 0);
      for (const [uad, uid] of Object.entries(ids.urun)) {
        if (ids.urunSirket[uad] !== code) continue;
        const d = await get(`/api/workspace/stock/${uid}`, `stok ${uad}`);
        P[`${p}stok:${uad}:miktar`] = Number(d.qty);
        P[`${p}stok:${uad}:hareketSayisi`] = (d.moves || []).length;
      }
    }
  }

  // ---------- adımlar ----------
  async function setup(a) {
    const code = a.sirket || "001";
    const admin = await adminC();
    const day = a.tarih || trDay(clock.ms());
    switch (a.islem) {
      case "sirket_ac":
        settings[a.sirket] = { ...(a.kasaEksi ? { kasaEksi: a.kasaEksi } : {}), ...(a.benzer !== undefined ? { benzer: a.benzer } : {}) };
        return openCompany(a.sirket);
      case "ayar":
        Object.assign(settings[code], { ...(a.kasaEksi ? { kasaEksi: a.kasaEksi } : {}), ...(a.benzer !== undefined ? { benzer: a.benzer } : {}) });
        return applySettings(code);
      case "cari_ac": {
        const body = { name: a.isim, type: a.tur === "tedarikci" ? "supplier" : "customer", registeredOn: day, ...(a.acilis ? { openingBalance: a.acilis, openingSide: "auto" } : {}), similarOk: true };
        const d = await must(`${a.id} cari`, call(admin, "POST", withCompany("/api/workspace/accounts", code), body));
        ids.cari[a.ad] = d.id;
        ids.cariSirket[a.ad] = code;
        if (a.acilis) ids.acilis[a.ad] = d.openingEntryId || (d.entries || []).find(x => /açılış/i.test(String(x.note || "")))?.id;
        return;
      }
      case "fatura": {
        if (!ids.hizmet?.[code]) (ids.hizmet ||= {})[code] = (await must("hizmet kartı", call(admin, "POST", withCompany("/api/workspace/stock", code), { kind: "service", code: "M5-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" }))).id;
        const base = a.tur === "alis"
          ? { kind: "purchase", scenario: "expense_purchase", lines: [{ name: "Kâhin Gideri", qty: 1, unitPrice: a.tutar, vatRate: 0, expenseCode: "general" }], number: `M5-A-${a.id}` }
          : { kind: "sale", scenario: "service_sale", lines: [{ itemId: ids.hizmet[code], qty: 1, unitPrice: a.tutar, vatRate: 0 }] };
        const d = await must(`${a.id} fatura`, call(admin, "POST", withCompany("/api/workspace/invoices", code), { ...base, accountId: ids.cari[a.cari], issueDate: day, payment: { rest: "open" } }));
        Object.assign(ids.fatura, { [a.ad]: d.id });
        ids.faturaSirket[a.ad] = code;
        ids.faturaCari[a.ad] = a.cari;
        return;
      }
      case "iade": {
        const fcode = ids.faturaSirket[a.fatura];
        const asil = await must(`${a.id} asıl fatura`, call(admin, "GET", withCompany(`/api/workspace/invoices/${ids.fatura[a.fatura]}`, fcode)));
        const d = await must(`${a.id} iade`, call(admin, "POST", withCompany("/api/workspace/invoices", fcode), { kind: "sale_return", originalId: asil.id, issueDate: day, lines: [{ originLineId: asil.lines[0].id, qty: asil.lines[0].qty }], payment: {} }));
        ids.fatura[a.ad] = d.id;
        ids.faturaSirket[a.ad] = fcode;
        ids.faturaCari[a.ad] = ids.faturaCari[a.fatura];
        return;
      }
      case "kart_ac": {
        const isim = sen.adimlar.find(x => x.islem === "cari_ac" && x.ad === a.cari)?.isim || a.cari;
        const d = await must(`${a.id} kart`, call(admin, "POST", withCompany("/api/workspace/plans", code), { name: isim, registeredOn: day, total: a.tutar, accountId: ids.cari[a.cari], mode: "auto", count: String(a.taksit || 1), firstDue: a.ilkVade || day, coversBalance: true }));
        ids.kart[a.ad] = d.id;
        ids.kartSirket[a.ad] = code;
        ids.kartCari[a.ad] = a.cari;
        return;
      }
      case "hesap_ac": {
        ids.hesapTur[a.ad] = a.tur;
        ids.hesapSirket[a.ad] = code;
        ids.hesapGl ||= {};
        const opening = { date: "2020-01-01", amount: "0", confirmed: false };
        if (a.tur === "pos") {
          const bank = Object.keys(ids.hesap).find(h => ids.hesapTur[h] === "banka" && ids.hesapSirket[h] === code);
          if (!bank) throw new Error(`${sen.ad} ${a.id}: POS'un bağlanacağı banka hesabı yok (sürücü eşlemesi)`);
          const d = await must(`${a.id} POS`, call(admin, "POST", withCompany("/api/workspace/bank/pos", code), { name: `POS ${a.ad}`, bankAccountId: ids.hesap[bank], providerKind: "bank", tax: "none", valorRule: "same_day", valorDays: 0, settleMode: "manual", installmentPayout: "monthly", refundCommission: "none", provisionDays: 0, validFrom: "2020-01-01", rates: [{ installments: 1, rate: "0" }] }));
          const pos = d.pos || d;
          ids.hesap[a.ad] = pos.id;
          ids.hesapGl[a.ad] = pos.glSub || pos.gl_sub;
          return;
        }
        const body = a.tur === "kart"
          ? { bankName: "Kâhin Bankası", name: `Kart ${a.ad}`, kind: "card", currency: "TRY", creditLimit: "1000000000", opening }
          : { bankName: "Kâhin Bankası", name: `Hesap ${a.ad}`, kind: "demand", currency: "TRY", usePos: true, opening };
        const d = await must(`${a.id} hesap`, call(admin, "POST", withCompany("/api/workspace/bank/accounts", code), body));
        const acc = d.account || d;
        ids.hesap[a.ad] = acc.id;
        ids.hesapGl[a.ad] = acc.glSub || acc.gl_sub;
        if (!ids.hesapGl[a.ad]) {
          const list = (await must("hesaplar", call(admin, "GET", withCompany("/api/workspace/bank/accounts?status=all", code)))).accounts || [];
          ids.hesapGl[a.ad] = list.find(x => x.id === acc.id)?.glSub;
        }
        return;
      }
      case "urun_ac": {
        const d = await must(`${a.id} ürün`, call(admin, "POST", withCompany("/api/workspace/stock", code), { kind: "product", code: `M5-${a.ad}`, name: a.isim || a.ad, unit: "Adet", ...(a.miktar ? { openingQty: String(a.miktar) } : {}) }));
        ids.urun[a.ad] = d.id;
        ids.urunSirket[a.ad] = code;
        return;
      }
      case "kasa_acilis":
        return must(`${a.id} Kasa açılışı`, call(admin, "POST", withCompany("/api/workspace/cash/opening", code), { amount: a.tutar, date: day }));
      case "cari_sil":
        await must(`${a.id} cari sil`, call(admin, "DELETE", withCompany(`/api/workspace/accounts/${ids.cari[a.cari]}`, ids.cariSirket[a.cari])));
        deleted.add(a.cari);
        return;
      case "donem_kilitle":
        return must(`${a.id} dönem kilidi`, call(admin, "PUT", withCompany("/api/admin/period-lock", code), { lockedUntil: a.tarih || "", force: true }));
      case "yedek_al": {
        const d = await must(`${a.id} yedek`, call(admin, "POST", "/api/admin/backups", { scope: "one", companyId: companyIds[code] }));
        ids.yedek[a.ad] = { name: d.name, company: companyIds[code], code };
        return;
      }
      case "yedek_geri_yukle": {
        const y = ids.yedek[a.yedek];
        const d = await must(`${a.id} geri yükle`, call(admin, "POST", "/api/admin/backups/restore", { name: y.name, company: y.company, confirm: y.code, password: ADMIN_PASSWORD }));
        if (d.staged || d.restartRequired) {
          await shutdown();
          await boot();
          await checkLicense();
        }
        clients.clear();
        return;
      }
      default:
        throw new Error(`kurulum adımı tanınmadı: ${a.islem}`);
    }
  }
  async function environment(a) {
    switch (a.islem) {
      case "saat":
        clock.set(ms(a.simdi));
        // Program lisansını saatte bir denetler (üretim zamanlayıcısı); sahte saat ilerleyince denetim burada (lisans servisi sahte — ders 30).
        return checkLicense();
      case "sunucu":
        if (a.durum === "kapali") return shutdown();
        if (a.durum === "acik") {
          if (!office.up) {
            await boot();
            await checkLicense();
          }
          return flushDeferred();
        }
        await shutdown();
        await boot();
        await checkLicense();
        return flushDeferred();
      case "cihaz_esle":
        return whenLicensed(() => pairDevice(a.cihaz, a.kullanici));
      case "cihaz_sil":
        return whenLicensed(async () => {
          const phone = phones.get(a.cihaz);
          await must(`${a.id} cihaz sil`, call(await adminC(), "DELETE", `/api/admin/mobile/devices/${phone?.deviceId || "dev-00000000-0000-0000-0000-000000000000"}`));
        });
      case "uzak_izin":
        return whenLicensed(async () => {
          users[a.kullanici].uzak = Boolean(a.deger);
          await remoteAccess(a.kullanici, a.deger);
        });
      case "sirket_yetki":
        return whenLicensed(async () => {
          users[a.kullanici].sirketler = [...(a.sirketler || [])];
          await applyCompanyAccess(a.kullanici);
        });
      case "lisans":
        office.licenseValid = a.durum === "gecerli";
        await checkLicense();
        return flushDeferred();
      case "surum_yukselt":
        if (!office.legacy) throw new Error("surum_yukselt kaynakSurum olmadan");
        await shutdown();
        office.legacy = false;
        await boot();
        await checkLicense();
        await pairStartDevices();
        return;
      default:
        throw new Error(`ortam adımı tanınmadı: ${a.islem}`);
    }
  }
  const SETUP = new Set(["cari_ac", "fatura", "iade", "kart_ac", "hesap_ac", "urun_ac", "kasa_acilis", "cari_sil", "donem_kilitle", "yedek_al", "yedek_geri_yukle", "sirket_ac", "ayar"]);
  const ENV = new Set(["saat", "sunucu", "cihaz_esle", "cihaz_sil", "uzak_izin", "sirket_yetki", "lisans", "surum_yukselt"]);
  const steps = sen.adimlar;
  for (let i = 0; i < steps.length; i += 1) {
    const a = steps[i];
    if (a.ayniAnda) {
      let j = i;
      while (j < steps.length && steps[j].ayniAnda === a.ayniAnda) j += 1;
      const group = steps.slice(i, j);
      for (const s of group) if (s.kanal === "mobil") await ensureSession(s.cihaz);
      // Aynı an: istekler sırayı beklemeden birlikte gönderilir (program sıralar; kâhin sıralamalardan birini kabul eder — K19).
      await Promise.all(group.map(s => moneyStep(s)));
      i = j - 1;
      continue;
    }
    if ((SETUP.has(a.islem) || a.islem === "kontrol" || (a.kanal === "masaustu" && a.islem !== "yeniden_gonder")) && !office.up) throw new Error(`${sen.ad} ${a.id}: sunucu kapalıyken masaüstü / kurulum / kontrol adımı (kâhin bunu kurmaz)`);
    if (SETUP.has(a.islem)) await setup(a);
    else if (ENV.has(a.islem)) await environment(a);
    else if (a.islem === "kontrol") await kontrol(a.id);
    else if (a.islem === "yeniden_gonder") await moneyStep(a, { resendOf: a.adim, kesinti: a.kesinti });
    else await moneyStep(a);
  }
  await shutdown();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return { P, notes };
}

// ---------- koşu ----------
const root = mkdtempSync(path.join(tmpdir(), "kahin-m5-veri-"));
const program = {};
const notlar = {};
const hatalar = [];
const senaryolar = kabul.senaryolar.filter(s => !FILTRE || FILTRE.has(s.ad));
for (const kayit of senaryolar) {
  const sen = kayit.senaryo;
  if (sen.baslangic.kaynakSurum && !ESKI) {
    notlar[sen.ad] = `DENENMEYEN: eski sürüm (${sen.baslangic.kaynakSurum}) kodu verilmedi — KAHIN_ESKI_SURUM_KOKU=<git archive v${sen.baslangic.kaynakSurum} kopyası>`;
    continue;
  }
  try {
    const { P, notes } = await runScenario(sen, root);
    program[sen.ad] = P;
    if (notes.length) notlar[sen.ad] = notes;
  } catch (error) {
    hatalar.push(`${sen.ad}: ${error.stack || error.message}`);
  }
}
// Göreli çiftler (kâhin K10: planın yazmadığı rol × işlem hücreleri): iki yan ayrı boş kurulumda; bütün anahtarlar iki kanalda AYNI olmalı.
const goreli = [];
for (const cift of kabul.goreli_ciftler || []) {
  if (FILTRE && !FILTRE.has(cift.ad)) continue;
  const uygun = Object.entries(cift.kosul || {}).every(([k, v]) => SECIM[k] === v);
  try {
    const m = (await runScenario(cift.mobil, root)).P;
    const d = (await runScenario(cift.masaustu, root)).P;
    const keys = [...new Set([...Object.keys(m), ...Object.keys(d)])].sort();
    const farklar = keys.filter(key => JSON.stringify(m[key]) !== JSON.stringify(d[key])).map(key => `${key}: mobil ${JSON.stringify(m[key])} · masaüstü ${JSON.stringify(d[key])}`);
    // Koşulu seçilen birleşimde tutmayan çift de koşulur (bilgi; sonucu sayılmaz): kâhinin koşulu o birleşimde mobil isteğin kabul edildiğini varsayar.
    goreli.push({ ad: cift.ad, sonuc: uygun ? (farklar.length ? "FARK" : "aynı") : `uygulanmaz (koşul ${JSON.stringify(cift.kosul)}; bilgi: ${farklar.length ? "fark" : "aynı"})`, farklar, mobil: m, masaustu: d });
  } catch (error) {
    hatalar.push(`${cift.ad}: ${error.stack || error.message}`);
  }
}
rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
writeFileSync(path.join(OUT, "program.json"), `${JSON.stringify(program, null, 1)}\n`);
writeFileSync(path.join(OUT, "notlar.json"), `${JSON.stringify({ birlesim: BIRLESIM, notlar, hatalar, goreli }, null, 1)}\n`);
// Kâhinin kendi karşılaştırması (yalnız koşulan senaryolar).
const altKabul = { ...kabul, senaryolar: kabul.senaryolar.filter(s => program[s.ad] || (FILTRE ? FILTRE.has(s.ad) : true)) };
const altYol = path.join(OUT, "kabul-kosulan.json");
writeFileSync(altYol, JSON.stringify(altKabul));
let tap = "";
let cikis = 0;
try {
  tap = execFileSync(PYTHON, ["-I", path.join(HERE, "kahin.py"), "karsilastir", altYol, path.join(OUT, "program.json"), "--birlesim", BIRLESIM], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  tap = String(error.stdout || "");
  cikis = 1;
}
rmSync(altYol, { force: true });
writeFileSync(path.join(OUT, "karsilastirma.tap"), tap);
process.stdout.write(tap);
for (const g of goreli) process.stdout.write(`# göreli ${g.ad}: ${g.sonuc}${g.farklar?.length ? `\n#   ${g.farklar.slice(0, 10).join("\n#   ")}` : ""}${g.neden ? ` (${g.neden})` : ""}\n`);
for (const [ad, n] of Object.entries(notlar)) process.stdout.write(`# not ${ad}: ${Array.isArray(n) ? n.join(" · ") : n}\n`);
for (const h of hatalar) process.stdout.write(`# SÜRÜCÜ HATASI ${h.split("\n").slice(0, 3).join(" | ")}\n`);
const goreliFark = goreli.filter(g => g.sonuc === "FARK").length;
process.stdout.write(`# göreli çift: ${goreli.filter(g => g.sonuc === "aynı").length} aynı, ${goreliFark} fark, ${goreli.filter(g => g.sonuc.startsWith("uygulanmaz")).length} uygulanmaz\n# birleşim: ${BIRLESIM}\n`);
process.exit(cikis || goreliFark || hatalar.length ? 1 : 0);
