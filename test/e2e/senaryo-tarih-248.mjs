// 2.4.8 SON ADAY T7 — TARİH (ders 13, 22): WhatsApp toplu gönderiminin takvime bağlı kuralları SAHTE SAATLE (server.clock; sahte Meta'nın saati aynı anda).
// GERÇEK program (startTestServer) + BAĞIMSIZ K0 sahte Meta (test/bagimsiz/whatsapp-248/sahte-meta; ders 5) + gerçek lisans servisi ölü adres (ders 30).
// Gönderim işçisi elle sürülür (ders 20). Beklenen değerler PLANDAN ve girilen veriden ELLE (plan §7a 16, 19, 21; R3; S2 A; T2-5 BAŞ MİMAR KARARI "Meta'nın kabul
// ettiği TTL, gelmezse 30 gün") — programın kodundan okunmaz.
//   T7a 24 saatlik sınır penceresi gece yarısından geçerken: elle sınır 2; 03.11 23:30'da 3 kişi → 2 gider, 1 "Sınır Nedeniyle Bekliyor"; 04.11 00:30 (takvim günü
//       değişti) hâlâ bekler; 04.11 23:29 hâlâ bekler; 04.11 23:31 (kabulden 24 saat + 1 dk) gider (kayan 24 saat, takvim günü değil).
//   T7b ay sonu → ayın 1'i: 30.11 23:50 "Bu Ay" = 01.11–30.11; teslim 30.11 23:59:30 (kanca 01.12 00:01'de gelir) Kasım'a sayılır; 01.12 00:10 "Bu Ay" sayacı 0
//       (Aralık), Kasım sayacı korunur; "Bu Ay" = 01.12.2026 – 01.12.2026, "Geçen Ay" = 01.11.2026 – 30.11.2026; Geçen Ay PDF'i Aralık hareketini içermez.
//       Aynı takvim ayının "Bu Ay"(30.11) ve "Geçen Ay"(01.12) gönderimi için R3 davranışı GÖZLENİR (T2-1 kullanıcı kararı bekliyor — denetlenmez).
//   T7c 31 Aralık → 1 Ocak: 31.12 23:50 "Bu Ay" = 01.12–31.12; 01.01.2027 00:10 "Bu Ay" = 01.01.2027 – 01.01.2027, "Geçen Ay" = 01.12.2026 – 31.12.2026 (yıl geçişi);
//       iletinin {{3}} ve PDF dönemi Aralık 2026, Ocak hareketi yok, bakiye 31.12 sonu; "Bu Ay" sayacı 0, 2026-12 sayacı korunur. Ekranda (tarayıcı saati = sunucu)
//       iki yolun dönem metni.
//   T7d TTL — 2.4.9 W-T, BEKLENTİ BİLEREK GÜNCELLENDİ (KULLANICI KARARI 03.11.2026 ~18:45 UTC; docs/2.4.9-tasarim/W-whatsapp-sablon.md §15, §10): program şablona
//       teslim süresi YAZMAZ; "Süresi Doldu" = Meta listesinin bildirdiği değer, yoksa 30 gün (+1 sa). (1) Meta TTL'yi listede bildiriyor (şablonun Meta'daki kendi
//       değeri 43200 sn = 12 saat, ör. WhatsApp Yöneticisi'nde): kabulden 13 sa − 1 dk "Meta Kabul Etti", 13 sa + 1 dk "Süresi Doldu" + PDF Meta'dan silinir;
//       (2) Meta TTL'yi bildirmiyor (K0 sahte Meta'nın kendi davranışı) ve (3) Meta TTL alanını reddeden hesap (100; program alanı göndermediği için şablon yine açılır,
//       kartta uyarı YOK): 13 sa ve 73 sa'te süresi DOLMAZ, PDF silinmez; 30 gün + 1 sa sonra (kanca yolu son 7 günde çalışıyorken) "Süresi Doldu";
//       (4) kanca yolu 7 günden eski: süresi hiç dolmaz ("Meta Kabul Etti"de kalır, §7a 16).
//   T7e ders 22: koşu başında ve sonunda gerçek gün (Türkiye) okunur; değiştiyse sonuç GEÇERSİZ (çıkış 2).
// Çıkış: "N geçti, M kaldı" (kaldıysa 1).
// Gerçek kurulum Türkiye saatinde çalışır (ders 14): sunucunun "bugün"ü yerel gündür; bu koşucu UTC olsa da TZ Europe/Istanbul.
import "../fixtures/saat-dilimi-istanbul.mjs";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { pdfText } from "../banka-210-ortak.mjs";
import { ADMIN_PASSWORD, createClient, installPageClock, removeTestDir, startTestServer } from "../helpers.mjs";
import { sahteMetaBaslat } from "../bagimsiz/whatsapp-248/sahte-meta/sunucu.mjs";

const trDay = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const DAY_AT_START = trDay();
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-tarih-248");
mkdirSync(shots, { recursive: true });
const TOKEN = "SAHTE-T7-tarih.248-Belirtec-QaZwSx0123456789";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const OFFICE = "Takvim Ticaret";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = iso => Date.parse(iso);
const iso2tr = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const periodOf = p => (p?.period?.from ? `${iso2tr(p.period.from)} – ${iso2tr(p.period.to)}` : JSON.stringify(p?.period));

let passed = 0;
let failed = 0;
const notes = [];
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const observe = line => {
  notes.push(line);
  console.log(`  ⚑ GÖZLEM: ${line}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.stack || error).split("\n").slice(0, 2).join(" | ")}`);
  }
};

// 2.4.9 W-T: Meta'nın şablona kayıtlı teslim süresi (programın yazdığı değil — program yazmaz): 12 saat.
const LISTED_TTL = 43_200;
/** Program + sahte Meta; ttl: "listed" (Meta listede LISTED_TTL bildirir) | "silent" (bildirmez) | "rejected" (açmada TTL alanını 100 ile reddeder). */
async function kur({ start, ttl = "silent" }) {
  const root = mkdtempSync(path.join(tmpdir(), "senaryo-tarih-248-"));
  const meta = await sahteMetaBaslat({
    senaryo: {
      uygulama: { id: APP, sir: "SAHTE-T7-SIR", ad: "Takvim Mesaj", kancaAdresi: null, imzala: false },
      belirtecler: { [TOKEN]: { durum: "gecerli", izinler: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"], wabalar: ["*"] } },
      wabalar: { [WABA]: { ad: "Takvim", odemeYontemi: true, kisitli: null, pazarlamaKapali: false } },
      numaralar: { [PNID]: { waba: WABA, gorunen: "+90 212 555 01 02", ulkeKodu: "90", verified_name: "Takvim Ticaret", kayitli: true, bakim: false, basamak: "TIER_250", kalite: "GREEN", throughput: "STANDARD" } },
      sablonlar: [],
      hiz: { mps: 1e9 },
    },
  });
  meta.saat(at(start));
  if (ttl === "listed") {
    // Gerçek Meta'nın TTL'yi listede bildirdiği varsayımı (D0-W5-9): şablonun Meta'daki teslim süresi (LISTED_TTL; açma isteğinde alan YOK — 2.4.9 W-T) istenirse
    // listede döner.
    const create = meta.meta.sablonOlustur.bind(meta.meta);
    meta.meta.sablonOlustur = async (req, sorgu, waba, govde) => {
      const r = await create(req, sorgu, waba, govde);
      const made = meta.meta.sablonlar.find(s => s.id === r.govde?.id);
      if (made) made.ttl = LISTED_TTL;
      return r;
    };
    const shape = meta.meta.sablonNesnesi.bind(meta.meta);
    meta.meta.sablonNesnesi = (s, alanlar) => {
      const o = shape(s, alanlar);
      if (s.ttl && (!alanlar || alanlar.includes("message_send_ttl_seconds"))) o.message_send_ttl_seconds = s.ttl;
      return o;
    };
  }
  if (ttl === "rejected") {
    const create = meta.meta.sablonOlustur.bind(meta.meta);
    meta.meta.sablonOlustur = async (req, sorgu, waba, govde) => (govde && "message_send_ttl_seconds" in govde ? meta.meta.hata(100, { details: "Invalid parameter message_send_ttl_seconds (SAHTE T7)" }) : create(req, sorgu, waba, govde));
  }
  const server = await startTestServer({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: start, fixed: true }, whatsappGraphUrl: meta.url, whatsappTimeoutMs: 3000, whatsappGapMs: 0, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  server.app.mobileRemote.setPublicUrl(`http://ofis-t7.localhost:${remote.port}`);
  const api = createClient(server.base);
  await api.login("admin", ADMIN_PASSWORD);
  const must = async (label, p) => {
    const r = await p;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 240)}`);
    return r.data.data;
  };
  server.app.store.setSetting("office.name", OFFICE);
  await must("bağlantı", api.put("/api/workspace/whatsapp/connection", { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN }));
  await must("sınama", api.post("/api/workspace/whatsapp/connection/test", {}));
  await must("şablonlar", api.post("/api/workspace/whatsapp/templates/ensure", {}));
  for (const s of meta.meta.sablonlar) s.status = "APPROVED";
  const tpl = await must("şablon denetimi", api.post("/api/workspace/whatsapp/templates/ensure", {}));
  await must("onay", api.put("/api/workspace/whatsapp/ack", { ack: true }));
  const ctx = {
    root, meta, server, api, must, tpl,
    clock: ms => {
      server.clock.set(ms);
      meta.saat(ms);
    },
    drain: () => server.app.whatsapp.scheduler.drain(),
    account: (name, phone, opening) => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, phone, openingBalance: String(opening), registeredOn: "2026-09-01" })),
    entry: (id, body) => must(`hareket ${body.note}`, api.post(`/api/workspace/accounts/${id}/entries`, body)),
    preview: (ids, preset, kind = "statement") => must("önizleme", api.post("/api/workspace/whatsapp/batches/preview", { kind, ids, preset })),
    async send(ids, preset, requestId, kind = "statement") {
      const n0 = meta.meta.mesajlar.length;
      const b = await must(`toplu iş ${requestId}`, api.post("/api/workspace/whatsapp/batches", { kind, ids, preset, requestId }));
      await ctx.drain();
      return { batch: b.batch?.id, sent: meta.meta.mesajlar.slice(n0) };
    },
    job: async (batchId, accountId) => (await must("toplu iş ayrıntısı", api.get(`/api/workspace/whatsapp/batches/${batchId}`))).jobs.find(j => j.accountId === accountId) || null,
    stats: async month => must("Bu Ay", api.get(`/api/workspace/whatsapp/stats${month ? `?month=${month}` : ""}`)),
    async hook(wamid, durum, tsMs) {
      const registered = meta.meta.kancaAdresi(PNID);
      const u = new URL(registered);
      const r = await meta.durumGonder({ wamid, durum, timestamp: Math.floor(tsMs / 1000), url: `http://127.0.0.1:${remote.port}${u.pathname}` });
      return r[0].http;
    },
    media: id => meta.meta.medyalar.get(String(id)),
    async close() {
      await server.close().catch(() => {});
      await meta.kapat().catch(() => {});
      removeTestDir(root);
    },
  };
  return ctx;
}

// =====================================================================================================================================
let A = null;
const acc = {};
await step("Kurulum: 03.11.2026 09:00; cariler (açılış 01.09.2026)", async () => {
  A = await kur({ start: "2026-11-03T09:00:00+03:00" });
  for (const [k, name, phone, opening] of [
    ["x1", "Gece Bir", "0532 700 00 01", 10], ["x2", "Gece İki", "0532 700 00 02", 10], ["x3", "Gece Üç", "0532 700 00 03", 10],
    ["y1", "Ay Sonu Bir", "0533 700 00 01", 100], ["y2", "Ay Sonu İki", "0533 700 00 02", 100], ["y3", "Ay Sonu Üç", "0533 700 00 03", 1000],
    ["z1", "Yıl Bir", "0534 700 00 01", 100], ["z2", "Yıl İki", "0534 700 00 02", 500],
  ]) acc[k] = (await A.account(name, phone, opening)).id;
  ok(Object.keys(acc).length === 8, "8 cari");
  ok(A.tpl.items?.every?.(i => i.usable !== false) ?? true, "şablonlar hazır");
});

await step("T7a 24 saatlik sınır gece yarısından geçerken (elle sınır 2)", async () => {
  await A.must("elle sınır", A.api.put("/api/workspace/whatsapp/sending-settings", { dailyCap: 2 }));
  A.clock(at("2026-11-03T23:30:00+03:00"));
  const { batch, sent } = await A.send([acc.x1, acc.x2, acc.x3], "thisMonth", "t7a-01");
  ok(sent.length === 2, `03.11 23:30: Meta'ya 2 ileti (${sent.length})`);
  const third = await A.job(batch, acc.x3);
  ok(third?.state === "limited", `üçüncü kişi Sınır Nedeniyle Bekliyor (${third?.state})`);
  for (const [iso, expect, label] of [
    ["2026-11-04T00:30:00+03:00", 2, "04.11 00:30 (takvim günü değişti, 24 saat dolmadı)"],
    ["2026-11-04T23:29:00+03:00", 2, "04.11 23:29 (kabulden 23 sa 59 dk)"],
    ["2026-11-04T23:31:00+03:00", 3, "04.11 23:31 (kabulden 24 sa 1 dk)"],
  ]) {
    A.clock(at(iso));
    await A.drain();
    const n = A.meta.meta.mesajlar.filter(m => m.degiskenler[0]?.startsWith("Gece")).length;
    ok(n === expect, `${label}: toplam ${expect} ileti (${n})`);
  }
  ok((await A.job(batch, acc.x3))?.state === "accepted", "üçüncü kişi Meta Kabul Etti");
  await A.must("sınır kaldır", A.api.put("/api/workspace/whatsapp/sending-settings", { dailyCap: null }));
});

let novBefore = 0;
await step("T7b ay sonu → ayın 1'i: Bu Ay / Geçen Ay dönemleri, Bu Ay sayacı, gece yarısını geçen kanca", async () => {
  A.clock(at("2026-11-10T10:00:00+03:00"));
  await A.entry(acc.y3, { kind: "debt", amount: 200, date: "2026-11-10", note: "Kasım satışı" });
  A.clock(at("2026-11-30T23:50:00+03:00"));
  const pNov = await A.preview([acc.y1], "thisMonth");
  ok(periodOf(pNov) === "01.11.2026 – 30.11.2026", `30.11 23:50 Bu Ay dönemi ${periodOf(pNov)}`);
  const s1 = await A.send([acc.y1], "thisMonth", "t7b-01");
  ok(s1.sent.length === 1 && s1.sent[0].degiskenler[2] === "01.11.2026 – 30.11.2026", `Y1 {{3}} ${s1.sent[0]?.degiskenler[2]}`);
  ok((await A.hook(s1.sent[0].wamid, "delivered", at("2026-11-30T23:55:00+03:00"))) === 200, "Y1 teslim 30.11 23:55");
  A.clock(at("2026-11-30T23:58:00+03:00"));
  const s2 = await A.send([acc.y2], "thisMonth", "t7b-02");
  novBefore = (await A.stats()).delivered;
  const nov = await A.stats();
  ok(nov.month === "2026-11" && nov.delivered === novBefore, `30.11: Bu Ay ayı 2026-11, teslim ${nov.delivered}`);
  A.clock(at("2026-12-01T00:01:00+03:00"));
  ok((await A.hook(s2.sent[0].wamid, "delivered", at("2026-11-30T23:59:30+03:00"))) === 200, "Y2 kancası 01.12 00:01'de geldi (teslim zamanı 30.11 23:59:30)");
  A.clock(at("2026-12-01T00:10:00+03:00"));
  const dec = await A.stats();
  const novAfter = await A.stats("2026-11");
  ok(dec.month === "2026-12" && dec.delivered === 0, `01.12 00:10: Bu Ay (Aralık) sayacı 0 (${dec.month} ${dec.delivered})`);
  ok(novAfter.delivered === novBefore + 1, `Kasım sayacı korunur ve gece yarısını geçen teslim Kasım'a sayılır: ${novBefore} + 1 = ${novAfter.delivered}`);
  await A.entry(acc.y3, { kind: "debt", amount: 50, date: "2026-12-01", note: "Aralık satışı" });
  const pThis = await A.preview([acc.y3], "thisMonth");
  const pLast = await A.preview([acc.y3], "lastMonth");
  ok(periodOf(pThis) === "01.12.2026 – 01.12.2026", `01.12 Bu Ay dönemi ${periodOf(pThis)}`);
  ok(periodOf(pLast) === "01.11.2026 – 30.11.2026", `01.12 Geçen Ay dönemi ${periodOf(pLast)}`);
  const s3 = await A.send([acc.y3], "lastMonth", "t7b-03");
  const v = s3.sent[0]?.degiskenler || [];
  ok(v[2] === "01.11.2026 – 30.11.2026" && /^1\.200,00 TL/.test(v[3] || ""), `Y3 Geçen Ay {{3}} ${v[2]}, {{4}} ${v[3]} (beklenen 1.000 + 200 = 1.200,00; Aralık'taki 50 YOK)`);
  const pdf = pdfText(A.media(s3.sent[0]?.medyaId)?.icerik || Buffer.from(""));
  ok(/Kasım satışı/.test(pdf) && !/Aralık satışı/.test(pdf) && /1\.200,00 TL/.test(pdf), "Y3 PDF: Kasım hareketi var, Aralık hareketi YOK, dönem sonu 1.200,00");
  // R3 gözlemi: Y1'e 30.11'de "Bu Ay" (01.11–30.11) gitti; 01.12'de "Geçen Ay" (aynı Kasım) — T2-1 kararı bekliyor, denetlenmez.
  const r3 = await A.preview([acc.y1], "lastMonth");
  const again = (r3.people || []).find(p => p.id === acc.y1);
  observe(`R3/T2-1: Y1'e 30.11 23:50'de "Bu Ay" (01.11–30.11) gönderildi; 01.12'de "Geçen Ay" (01.11–30.11) önizlemesi: ${again?.skip || "Gönderilecek"}${again?.sentBefore ? ` (daha önce ${again.sentBefore})` : ""} — öneri A'ya göre "Daha Önce Gönderildi" beklenir`);
});

await step("T7c 31 Aralık → 1 Ocak (yıl dönümü): dönemler, {{3}}, PDF, Bu Ay sayacı", async () => {
  A.clock(at("2026-12-10T10:00:00+03:00"));
  await A.entry(acc.z2, { kind: "debt", amount: 300, date: "2026-12-10", note: "Aralık 2026 satışı" });
  A.clock(at("2026-12-31T23:50:00+03:00"));
  const pDec = await A.preview([acc.z1], "thisMonth");
  ok(periodOf(pDec) === "01.12.2026 – 31.12.2026", `31.12 23:50 Bu Ay dönemi ${periodOf(pDec)}`);
  const s1 = await A.send([acc.z1], "thisMonth", "t7c-01");
  ok(s1.sent[0]?.degiskenler[2] === "01.12.2026 – 31.12.2026", `Z1 {{3}} ${s1.sent[0]?.degiskenler[2]}`);
  await A.hook(s1.sent[0].wamid, "delivered", at("2026-12-31T23:55:00+03:00"));
  const decCount = (await A.stats()).delivered;
  A.clock(at("2027-01-01T00:10:00+03:00"));
  await A.entry(acc.z2, { kind: "debt", amount: 70, date: "2027-01-01", note: "Ocak 2027 satışı" });
  const jan = await A.stats();
  ok(jan.month === "2027-01" && jan.delivered === 0, `01.01.2027 Bu Ay (2027-01) sayacı 0 (${jan.month} ${jan.delivered})`);
  ok((await A.stats("2026-12")).delivered === decCount && decCount >= 1, `2026-12 sayacı korunur (${decCount})`);
  const pJan = await A.preview([acc.z2], "thisMonth");
  const pJanLast = await A.preview([acc.z2], "lastMonth");
  ok(periodOf(pJan) === "01.01.2027 – 01.01.2027", `01.01.2027 Bu Ay dönemi ${periodOf(pJan)}`);
  ok(periodOf(pJanLast) === "01.12.2026 – 31.12.2026", `01.01.2027 Geçen Ay dönemi ${periodOf(pJanLast)} (yıl geçişi)`);
  const s2 = await A.send([acc.z2], "lastMonth", "t7c-02");
  const v = s2.sent[0]?.degiskenler || [];
  ok(v[2] === "01.12.2026 – 31.12.2026" && /^800,00 TL/.test(v[3] || ""), `Z2 {{3}} ${v[2]}, {{4}} ${v[3]} (beklenen 500 + 300 = 800,00; Ocak'taki 70 YOK)`);
  const pdf = pdfText(A.media(s2.sent[0]?.medyaId)?.icerik || Buffer.from(""));
  ok(/Aralık 2026 satışı/.test(pdf) && !/Ocak 2027 satışı/.test(pdf) && /800,00 TL/.test(pdf) && /31\.12\.2026/.test(pdf), "Z2 PDF: Aralık 2026 var, Ocak 2027 YOK, 31.12.2026 sonu 800,00");
  ok(!/2027/.test(s2.sent[0]?.dosyaAdi || "") || /2026/.test(s2.sent[0]?.dosyaAdi || ""), `PDF dosya adı dönemi (${s2.sent[0]?.dosyaAdi})`);
  // Ekran: tarayıcı saati sunucuyla aynı (installPageClock); iki yolun dönem metni.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const page = await context.newPage();
    await installPageClock(page, A.server.clock);
    await page.goto(`${A.server.base}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    const TOP = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`${TOP} tr[data-account="${acc.z2}"]`);
    await page.click(`${TOP} tr[data-account="${acc.z2}"] input[type="checkbox"], ${TOP} tr[data-account="${acc.z2}"] [data-select]`).catch(() => null);
    await page.click(`${TOP} input[data-select-all]`);
    await page.click(`${TOP} [data-act="waStatement"]`);
    await page.waitForSelector(`${TOP} [data-wa-api-preset]`);
    await page.selectOption(`${TOP} [data-wa-api-preset]`, "lastMonth");
    await page.waitForFunction(sel => /31\.12\.2026/.test(document.querySelector(`${sel} [data-wa-api-period]`)?.textContent || ""), TOP, { timeout: 15000 });
    ok(/01\.12\.2026 – 31\.12\.2026/.test(await page.textContent(`${TOP} [data-wa-api-period]`)), "ekran (Otomatik Gönder) Geçen Ay 01.12.2026 – 31.12.2026");
    await page.screenshot({ path: path.join(shots, "t7-01-ocak-otomatik.png"), fullPage: true });
    await page.click(`${TOP} [data-wa-path="manual"]`);
    await page.waitForSelector(`${TOP} [data-preset]`);
    await page.selectOption(`${TOP} [data-preset]`, "lastMonth");
    await page.waitForTimeout(600);
    const bubble = await page.textContent(`${TOP} .hof-wa-bubble`);
    ok(/01\.12\.2026 – 31\.12\.2026/.test(bubble || ""), `ekran (WhatsApp Web) Geçen Ay baloncuğu Aralık 2026 (${(bubble || "").match(/\(\d\d\.\d\d\.\d{4} – \d\d\.\d\d\.\d{4}\)/)?.[0] || "—"})`);
    await page.screenshot({ path: path.join(shots, "t7-02-ocak-whatsapp-web.png"), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
});
await A?.close();

const ttlCase = async (label, ttl, { hookAlive = true } = {}) => {
  const T = await kur({ start: "2026-11-03T09:00:00+03:00", ttl });
  try {
    const items = T.tpl.items || [];
    const ekstre = items.find(i => i.name === "destekofis_ekstre");
    if (ttl === "rejected") {
      // 2.4.9 W-T: program teslim süresi göndermez → TTL alanını reddeden hesapta şablon yine tek istekte açılır, kartta TTL uyarısı ve kırmızı işlem YOK.
      const posts = T.meta.meta.istekler.filter(i => i.islem === "templates_post" && i.yol.includes(WABA));
      ok(posts.length === 2 && posts.every(p => !("message_send_ttl_seconds" in (p.govde || {}))), `${label}: iki şablon TTL alanı olmadan tek istekte açıldı (${posts.length} açma)`);
      ok(!(ekstre?.warnings || []).some(w => /teslim süresi/i.test(w)) && !(T.tpl.actions || []).some(a => !a.ok), `${label}: şablon kartında TTL uyarısı / kırmızı işlem yok (${(ekstre?.warnings || []).join(" | ").slice(0, 90)})`);
    }
    const a = (await T.account("Süre Kişi", "0535 800 00 01", 100)).id;
    const b = (await T.account("Canlı Kanca", "0535 800 00 02", 100)).id;
    const t0 = at("2026-11-03T10:00:00+03:00");
    T.clock(t0);
    const { batch, sent } = await T.send([a, b], "thisMonth", `t7d-${ttl}-01`);
    const mine = sent.find(m => m.degiskenler[0] === "Süre Kişi");
    const other = sent.find(m => m.degiskenler[0] === "Canlı Kanca");
    // Kanca yolu çalışıyor: başka iletinin durumu gelir (son 7 gün kuralı).
    if (hookAlive) await T.hook(other.wamid, "delivered", t0 + MIN);
    const check = async (ms, why) => {
      T.clock(ms);
      if (hookAlive && ms - t0 > 6 * DAY) await T.hook(other.wamid, "read", ms - MIN); // yol hâlâ canlı (son 7 günde bildirim)
      await T.drain();
      const job = await T.job(batch, a);
      const m = T.media(mine.medyaId);
      return { state: job?.state, deleted: Boolean(m?.silindi), why };
    };
    // Meta'nın bildirdiği 12 saat + 1 saat (2.4.9 W-T; önceden programın yazdığı 72 saat + 1 saat).
    const r12 = await check(t0 + 13 * HOUR - MIN, "13 sa − 1 dk");
    const r13 = await check(t0 + 13 * HOUR + MIN, "13 sa + 1 dk");
    if (ttl === "listed" && !hookAlive) {
      ok(r13.state === "accepted" && !r13.deleted, `${label}: kanca yolu hiç çalışmadı → ${r13.why} Meta Kabul Etti'de kalır, PDF silinmez (§7a 16) (${r13.state}, silindi ${r13.deleted})`);
      return;
    }
    if (ttl === "listed") {
      ok(r12.state === "accepted" && !r12.deleted, `${label}: ${r12.why} Meta Kabul Etti, PDF Meta'da (${r12.state}, silindi ${r12.deleted})`);
      ok(r13.state === "expired" && r13.deleted, `${label}: ${r13.why} Süresi Doldu + PDF Meta'dan silindi (${r13.state}, silindi ${r13.deleted})`);
      return;
    }
    ok(r13.state === "accepted" && !r13.deleted, `${label}: ${r13.why} süresi DOLMAZ, PDF silinmez — Meta 30 gün dener (${r13.state}, silindi ${r13.deleted})`);
    const r73 = await check(t0 + 73 * HOUR + MIN, "73 sa + 1 dk");
    ok(r73.state === "accepted" && !r73.deleted, `${label}: ${r73.why} süresi DOLMAZ (eski 72 saatlik kural yok), PDF silinmez (${r73.state}, silindi ${r73.deleted})`);
    const r30a = await check(t0 + 30 * DAY + HOUR - MIN, "30 gün + 1 sa − 1 dk");
    const r30b = await check(t0 + 30 * DAY + HOUR + MIN, "30 gün + 1 sa + 1 dk");
    if (hookAlive) {
      ok(r30a.state === "accepted", `${label}: ${r30a.why} Meta Kabul Etti (${r30a.state})`);
      ok(r30b.state === "expired", `${label}: ${r30b.why} Süresi Doldu (${r30b.state}, PDF silindi ${r30b.deleted})`);
      if (!r30b.deleted) {
        const del = T.meta.meta.istekler.filter(i => i.islem === "media_delete" && i.yol.endsWith(String(mine.medyaId)));
        observe(`${label}: 30 gün + 1 sa'te PDF silinmedi — program ${del.length} kez sildi, Meta yanıtı ${del.map(d => d.http).join(",") || "yok"} (medya ömrü 30 gün: Meta medyayı kendisi düşürmüş; beklenen)`);
      }
    } else {
      ok(r30b.state === "accepted", `${label}: kanca yolu 7 günden eski → ${r30b.why} hâlâ Meta Kabul Etti (§7a 16) (${r30b.state})`);
    }
  } finally {
    await T.close();
  }
};
await step("T7d-1 TTL Meta'da 12 saat (listede 43200; program yazmaz): 13 saatte Süresi Doldu + PDF silinir", () => ttlCase("TTL bildirildi", "listed"));
await step("T7d-2 TTL Meta'dan okunamıyor (K0 sahte Meta varsayılanı): 30 gün kuralı", () => ttlCase("TTL bildirilmedi", "silent"));
await step("T7d-3 TTL alanını reddeden hesap (100): program göndermez, şablon açılır, kartta uyarı yok, 30 gün kuralı", () => ttlCase("TTL reddeden hesap", "rejected"));
await step("T7d-4 kanca yolu ölü (hiç bildirim yok): süre dolmaz", () => ttlCase("Kanca yok", "listed", { hookAlive: false }));

const DAY_AT_END = trDay();
if (notes.length) console.log(`\nGÖZLEMLER (${notes.length}):\n${notes.map(f => `  - ${f}`).join("\n")}`);
if (DAY_AT_END !== DAY_AT_START) {
  console.log(`\nGEÇERSİZ: koşu gün sınırını geçti (${DAY_AT_START} → ${DAY_AT_END}; ders 22) — ${passed} geçti, ${failed} kaldı`);
  process.exit(2);
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
