#!/usr/bin/env node
// 2.5.0 MUHASEBE SÜRÜCÜSÜ — program tarafı (TEK senaryo). Kâhinin senaryosunu (test/bagimsiz/muhasebe/senaryolar/<ad>.json, dil "muhasebe-kahin/1")
// GERÇEK programın HTTP API'sine uygular ve programın KENDİ uçlarından okur; beklenen değer HESAPLAMAZ (ders 5). Karşılaştırma ayrı (karsilastir.py).
//
//   node test/bagimsiz/muhasebe-surucu/program.mjs --senaryo <senaryo.json> --cikti <program.json> --veri <boş veri klasörü> [--program <kök>] [--adim 0|1]
//
//   --program <kök>: sınanan programın kökü (varsayılan bu depo; eski sürüm için `git archive v2.4.9 | tar -x` ile AYRI kopya — ders 23).
//   --adim 1 (varsayılan): her olaydan sonra Ana Defter mizanı + Alt Hesap Mizanı + cari bakiyeleri okunur (olay başına fark; karşılaştırıcı olayı bulur).
//
// Ortam: süreç saat dilimi çağıranın TZ'si (kos.mjs iki dilimde koşar: UTC ve Europe/Istanbul). Lisans servisi yerel ölü adres (ders 30).
// Sahte saat (config.now, SABİT): her olaydan önce olayın gününe (yerel öğlen; ders 13, 22); rapor olaylarında raporun gününe.
// Eşleme kuralı: senaryonun her olayı ekrandaki işlemin ucuna gider (istemci dosyaları client/assets/hof-*.js ile aynı gövde). Uç yoksa ya da olay 2.5.0'da
// yazılacak bir özelliğe aitse istek GÖNDERİLMEZ, olay "api_yok" / "uygulanmadi" diye nedeniyle yazılır (karşılaştırıcı bunları U sınıfına koyar).
// Reddedilen istek başarı sayılmaz (ders 3): durum + kod + ileti program.json'a yazılır.
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const argv = process.argv.slice(2);
const opt = (name, def = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const SENARYO = path.resolve(opt("--senaryo"));
const CIKTI = path.resolve(opt("--cikti"));
const VERI = path.resolve(opt("--veri"));
const PROGRAM = path.resolve(opt("--program", ROOT));
const ADIM = opt("--adim", "1") !== "0";
const imp = rel => import(pathToFileURL(path.join(PROGRAM, rel)).href);
const { startTestServer, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const invoiceMath = await imp("server/lib/invoice-math.mjs").catch(() => ({}));

const s = JSON.parse(readFileSync(SENARYO, "utf8"));
mkdirSync(VERI, { recursive: true });
mkdirSync(path.dirname(CIKTI), { recursive: true });

// ---------------------------------------------------------------- biçim
const tl = kurus => {
  const n = Math.round(Number(kurus));
  const neg = n < 0;
  const a = Math.abs(n);
  return `${neg ? "-" : ""}${Math.trunc(a / 100)},${String(a % 100).padStart(2, "0")}`;
};
const kurus = v => Math.round((Number(v) || 0) * 100);
const ilkTarih = s.olaylar.map(o => o.tarih).filter(Boolean).sort()[0] || "2026-01-01";
const oncekiGun = iso => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const ertesiAy = ay => new Date(Date.UTC(Number(ay.slice(0, 4)), Number(ay.slice(5, 7)), 1)).toISOString().slice(0, 10);
const gunAdi = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

// ---------------------------------------------------------------- sunucu
const loop = monitorEventLoopDelay({ resolution: 5 });
// Ç5-K SÜRÜCÜ EŞLEMESİ (kâhin bakımı 4 "Sürücü için" S20, ders 17): `yedekten: true` olay = kayıt geri yüklenen yedekte / eski sürüm verisinde vardı. Sürücü
// senaryonun son `yedekten` olayına KADARKİ bütün olayları ESKİ SÜRÜMÜN GERÇEK koduyla (varsayılan v2.4.9; test/guvenilirlik/surumler.mjs — etiketin ayrı kopyası,
// ders 23) aynı veri klasörüne yazar, eski programı kapatır ve sınanan programı AYNI klasörle açar (eski sürüm verisinin göçü). Bu olayların kaydında
// `surum` yazılır; eski sürüm 2.5.0'ın reddedeceği bir olayı kabul ederse karşılaştırıcı farkı gösterir (sürücünün kurulum sınırı, ders 6).
const SON_YEDEK = s.olaylar.reduce((son, o, i) => (o.yedekten ? i + 1 : son), 0);
const ESKI_SURUM = opt("--eski-surum", "v2.4.9");
const sunucuAc = () => startTestServer({
  dataDir: path.join(VERI, "data"),
  backupDir: path.join(VERI, "backups"),
  now: { time: ilkTarih, fixed: true },
  env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  startLicenseTimers: false,
  esmmEnabled: true,
});
let server;
let client;
if (SON_YEDEK) {
  const { bootVersion } = await import(pathToFileURL(path.join(ROOT, "test", "guvenilirlik", "surumler.mjs")).href);
  const { createClient } = await imp("test/helpers.mjs");
  const eski = await bootVersion(ESKI_SURUM, { dataDir: path.join(VERI, "data"), backupDir: path.join(VERI, "backups"), now: { time: ilkTarih, fixed: true }, legacyCasePayments: true, legacyTableTransfer: true, esmmEnabled: true });
  server = { app: eski.app, clock: eski.app.config.now, eski: ESKI_SURUM };
  client = createClient(eski.base);
} else {
  server = await sunucuAc();
  client = server.client();
}
const gunluk = [];
const sureler = [];
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
async function api(method, url, body, etiket = "") {
  const t0 = performance.now();
  const r = method === "GET" ? await client.get(url) : method === "DELETE" ? await client.del(url) : await client[method.toLowerCase()](url, body);
  const ms = performance.now() - t0;
  const data = unwrap(r);
  sureler.push({ method, url: url.replace(/[?].*$/, "").replace(/\/(?:[a-z]+[-_])?[0-9a-f]{8}-[0-9a-f-]{20,}|\/[a-z]+_[A-Za-z0-9]{10,}/g, "/:id"), ms, etiket });
  const ok = r.status >= 200 && r.status < 300;
  gunluk.push({ method, url, status: r.status, ...(body !== undefined ? { body } : {}), ...(ok ? {} : { yanit: data }) });
  return { ok, status: r.status, data, kod: ok ? "" : data?.code || "", ileti: ok ? "" : String(data?.error || data?.message || "").slice(0, 400) };
}
const saat = gun => server.clock.set(gun);

// ---------------------------------------------------------------- kimlikler
const ids = { cari: {}, urun: {}, banka: {}, kart: {}, kredi: {}, pos: {}, olay: {}, evrak: {}, taksit: {}, supheli: {}, satirlar: {}, satir: {} };
const altHesap = {}; // program alt hesap kodu → kâhin anahtarı (102.B1, 108.POS1, 309.KK1, 300.KR1)
const CARI_TUR = { musteri: "customer", tedarikci: "supplier", diger: "other" };
const olaylar = [];
const program = { senaryo: s.ad, tz: process.env.TZ || "", program: PROGRAM === ROOT ? "bu-depo" : PROGRAM, ilk_tarih: ilkTarih, olaylar, raporlar: {}, kurulum: [], alt_hesap: altHesap, cari_kimlik: {}, cari_no: {}, adim: ADIM };

async function kur(ad, method, url, body) {
  const r = await api(method, url, body, `kurulum:${ad}`);
  program.kurulum.push({ ad, status: r.status, ...(r.ok ? {} : { kod: r.kod, ileti: r.ileti }) });
  return r;
}

// Bütün olayların ilk tarihi (yoksa senaryonun ilk günü): tanımı açılış olayıyla gelmeyen banka / kart / kredi bu günle 0 açılışlı açılır.
const acilisGunu = (tur, alan, anahtar) => s.olaylar.find(o => o.tur === tur && o[alan] === anahtar);

async function bankaAc(b, acilis = null) {
  if (ids.banka[b]) return ids.banka[b];
  const tutar = acilis ? acilis.tutar : 0;
  const tarih = acilis ? acilis.tarih : ilkTarih;
  const body = { bankName: "Ziraat Bankası", name: s.bankalar?.[b]?.ad || b, kind: "demand", currency: "TRY", ...(tutar < 0 ? { creditLimit: tl(-tutar * 3) } : {}), opening: { date: tarih, amount: tl(tutar), confirmed: true } };
  const r = await kur(`banka:${b}`, "POST", "/api/workspace/bank/accounts", body);
  const id = r.data?.id || r.data?.account?.id;
  if (!id) return null;
  ids.banka[b] = id;
  await kur(`banka-ayar:${b}`, "PUT", `/api/workspace/bank/accounts/${id}`, { usePos: true, useCheque: true, useNote: true, negativePolicy: "off" });
  return id;
}
async function kartAc(k, acilis = null) {
  if (ids.kart[k]) return ids.kart[k];
  const tarih = acilis ? acilis.tarih : ilkTarih;
  const body = { bankName: "Garanti BBVA", name: s.kartlar?.[k]?.ad || k, kind: "card", currency: "TRY", creditLimit: tl(100000000), opening: { date: tarih, amount: tl(acilis ? acilis.tutar : 0), confirmed: true } };
  const r = await kur(`kart:${k}`, "POST", "/api/workspace/bank/accounts", body);
  const id = r.data?.id || r.data?.account?.id;
  if (id) {
    ids.kart[k] = id;
    await kur(`kart-ayar:${k}`, "PUT", `/api/workspace/bank/accounts/${id}`, { negativePolicy: "off" });
  }
  return id || null;
}
async function krediAc(k, acilis = null) {
  if (ids.kredi[k]) return ids.kredi[k];
  const tarih = acilis ? acilis.tarih : ilkTarih;
  const body = { bankName: "Ziraat Bankası", name: s.krediler?.[k]?.ad || k, kind: "loan", currency: "TRY", creditLimit: tl(100000000), opening: { date: tarih, amount: tl(acilis ? acilis.tutar : 0), confirmed: true } };
  const r = await kur(`kredi:${k}`, "POST", "/api/workspace/bank/accounts", body);
  const id = r.data?.id || r.data?.account?.id;
  if (id) ids.kredi[k] = id;
  return id || null;
}
// POS: valör kuralı Takvim Günü; oran ve valör günü satış başına (oran ızgarası validFrom = satış günü) — kâhinin komisyonu ve valörü satış başına verilir.
const posDurum = {};
async function posAc(p) {
  if (ids.pos[p]) return ids.pos[p];
  const b = s.poslar?.[p]?.banka || "B1";
  const bankaId = await bankaAc(b, acilisOlayi("banka_acilis", "banka", b));
  const body = { name: s.poslar?.[p]?.ad || p, bankAccountId: bankaId, providerKind: "bank", tax: "bsmv_incl", valorRule: "calendar", valorDays: 1, installmentPayout: "monthly", refundCommission: "none", provisionDays: 0, validFrom: oncekiGun(ilkTarih), rates: [{ installments: 1, rate: "2", valorDays: 1 }] };
  const r = await kur(`pos:${p}`, "POST", "/api/workspace/bank/pos", body);
  const id = r.data?.id || r.data?.pos?.id;
  if (id) {
    ids.pos[p] = id;
    posDurum[p] = { ppm: 20000, valor: 1, gun: oncekiGun(ilkTarih) };
  }
  return id || null;
}
function acilisOlayi(tur, alan, anahtar) {
  return acilisGunu(tur, alan, anahtar) || null;
}

// Cari telefonu (sürücünün; kâhinde yok): aynı adlı iki cariyi Excel'den taksit yüklemede ayırmak için (program ad + telefonla eşler).
const telefon = c => `0532${String(1000000 + [...String(c)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9000000, 7)).slice(-7)}`;
async function cariAc(c, acilis = null) {
  if (ids.cari[c]) return ids.cari[c];
  const tanim = s.cariler?.[c] || { ad: c, tur: "musteri" };
  const body = { name: tanim.ad, type: CARI_TUR[tanim.tur] || "customer", phone: telefon(c), registeredOn: acilis ? acilis.tarih : ilkTarih, similarOk: true, force: true };
  if (acilis) Object.assign(body, { openingBalance: tl(acilis.tutar), openingSide: acilis.yon === "alacak" ? "credit" : "debt" });
  const r = await kur(`cari:${c}`, "POST", "/api/workspace/accounts", body);
  const id = r.data?.id || r.data?.account?.id;
  if (id) {
    ids.cari[c] = id;
    program.cari_kimlik[id] = c;
    const no = r.data?.refNo || r.data?.account?.refNo;
    if (no) program.cari_no[String(no)] = c;
  }
  return id || null;
}
async function urunAc(u, acilis = null) {
  if (ids.urun[u]) return ids.urun[u];
  const tanim = s.urunler?.[u] || { ad: u, birim: "Adet" };
  const body = { name: tanim.ad, unit: tanim.birim || "Adet", kind: "product", code: `K-${u}`, unitPrice: tl(acilis ? 0 : tanim.alis_fiyati || 0), vatRate: String(tanim.kdv_orani ?? 20) };
  if (acilis) Object.assign(body, { openingQty: String(acilis.miktar), openingDate: acilis.tarih, unitPrice: acilis.birimFiyat });
  const r = await kur(`urun:${u}`, "POST", "/api/workspace/stock", body);
  const id = r.data?.id || r.data?.item?.id;
  if (id) ids.urun[u] = id;
  return id || null;
}

// ---------------------------------------------------------------- yardımcılar (olay → gövde)
const KDV_ORANLARI = [0, 1, 10, 20];
function kdvOrani(M, K) {
  if (!M) return { oran: 0 };
  for (const r of KDV_ORANLARI) if (Math.round((M * r) / 100) === K) return { oran: r };
  return { oran: null, neden: `KDV ${K} / matrah ${M}: standart oran (0, 1, 10, 20) tutmuyor` };
}
// Tevkifat: oran pay/10 (kâhinin T'si K × pay / 10'un kuruşa yuvarlanmışı olmalı); kod mal / hizmete göre (GİB listesi, invoice-math WITHHOLDING).
function tevkifatKodu(K, T, mal) {
  if (!T) return { kod: "" };
  const W = invoiceMath.WITHHOLDING || {};
  for (let pay = 1; pay <= 10; pay += 1) {
    if (Math.round((K * pay) / 10) !== T) continue;
    const adaylar = Object.entries(W).filter(([, w]) => w.num === pay && w.den === 10).map(([k]) => k);
    const tercih = pay === 5 ? "616" : pay === 2 ? (mal ? "626" : "624") : adaylar[0];
    if (tercih && W[tercih]) return { kod: tercih };
    if (adaylar[0]) return { kod: adaylar[0] };
  }
  // Kâhinin T'si K × pay / 10'a kuruşta uymuyorsa (ör. üretici aşağı yuvarlamış) en yakın pay gönderilir; T'yi program hesaplar, fark karşılaştırmada görünür.
  const pay = Math.max(1, Math.min(10, Math.round((T / K) * 10)));
  const W2 = invoiceMath.WITHHOLDING || {};
  const kod = pay === 5 ? "616" : pay === 2 ? (mal ? "626" : "624") : Object.entries(W2).find(([, w]) => w.num === pay && w.den === 10)?.[0];
  return kod ? { kod, yuvarlama: `tevkifat ${T} ≠ yuvarlama(${K} × ${pay}/10) = ${Math.round((K * pay) / 10)}` } : { kod: null, neden: `tevkifat ${T} / KDV ${K}: x/10 oranı yok` };
}
// Tutarı miktara tam bölünmüyorsa iki satır: (miktar − 1) × taban + 1 × kalan (kuruş tamsayısı; programın birim fiyatı en çok 4 ondalık).
function bol(tutar, miktar) {
  const q = Number(miktar);
  if (Number.isInteger(q) && q > 0 && tutar % q === 0) return [{ qty: q, fiyat: tutar / q }];
  if (Number.isInteger(q) && q > 1) {
    const taban = Math.floor(tutar / q);
    return [{ qty: q - 1, fiyat: taban }, { qty: 1, fiyat: tutar - taban * (q - 1) }];
  }
  return [{ qty: q, fiyat: tutar / q }];
}
const fiyat = k => (Number.isInteger(k) ? tl(k) : String(Math.round(k * 100) / 10000).replace(".", ","));

// Fatura gövdesi (satış / alış / iade / SMM). Dönüş { body } ya da { eslenemez }.
function faturaGovdesi(o, kind) {
  const M = o.M ?? o.brut;
  const K = o.K || 0;
  const T = o.T || 0;
  const S = o.S || 0;
  const k = kdvOrani(M, K);
  if (k.oran === null) return { eslenemez: k.neden };
  const kalemler = o.kalemler || [];
  const mal = kalemler.some(x => x.urun);
  const tev = tevkifatKodu(K, T, mal);
  if (tev.kod === null) return { eslenemez: tev.neden };
  if (tev.yuvarlama) faturaGovdesi.uyari = tev.yuvarlama;
  const ortak = { vatRate: k.oran, discountRate: 0, ...(tev.kod ? { withholdingCode: tev.kod } : {}), ...(k.oran === 0 ? { exemptionCode: o.ihracat ? "301" : "351" } : {}) };
  const lines = [];
  if (kalemler.length && mal) {
    const toplamMiktar = kalemler.reduce((a, x) => a + Number(x.miktar), 0);
    let kalan = M;
    kalemler.forEach((x, i) => {
      const tutar = x.M ?? (i === kalemler.length - 1 ? kalan : Math.round((M * Number(x.miktar)) / toplamMiktar));
      kalan -= tutar;
      // Sürücü bakımı 2: tutar miktara tam bölünmüyorsa ÖNCE tek satır, 4 ondalıklı birim fiyat (ekranın birim fiyat alanı 4 ondalık) — miktar × fiyat
      // kuruşa yuvarlanınca tutarı veriyorsa. Önceki iki satırlı bölme (bol) KDV / tevkifatı satır başına yuvarlatıyordu (rastgele F131: tevkifat 11.741,
      // kâhin belge toplamından 11.740 — kitap G-1 "fatura satır matematiği bu kitabın konusu değildir") ve kalemsiz kısmi iadeyi 3 ondalıklı miktarla
      // kuruşu tutmaz kılıyordu (I125 1 kuruş). Tutmazsa eski bölme.
      const q = Number(x.miktar);
      const f4 = Math.round((tutar / q) * 100) / 10000;
      const tek = Number.isFinite(f4) && q > 0 && Math.round(q * f4 * 100) === tutar && !(Number.isInteger(q) && tutar % q === 0);
      if (tek) lines.push({ itemId: ids.urun[x.urun], goods: true, name: s.urunler?.[x.urun]?.ad || x.urun, qty: q, unitPrice: String(f4).replace(".", ","), ...ortak });
      else for (const parca of bol(tutar, x.miktar)) lines.push({ itemId: ids.urun[x.urun], goods: true, name: s.urunler?.[x.urun]?.ad || x.urun, qty: parca.qty, unitPrice: fiyat(parca.fiyat), ...ortak });
    });
  } else {
    const gider = { genel: "other", satis: "marketing", finansman: "", demirbas: "asset" }[o.gider_turu || "genel"];
    // Kalemsiz belge (hizmet / gider): miktar = kuruş sayısı, birim fiyat 0,01 TL — satır toplamı aynı (M), KDV aynı satırdan. Sürücü bakımı 2: kâhinin
    // kalemsiz KISMİ iadesi (ör. s57 I1 30,00 / F1 90,00) asıl satırdan miktarla seçilir (iade birim fiyatı asıl satırınki, miktar en çok 3 ondalık —
    // routes/invoices.mjs return lines); önceki 1 × M satırında 0,333 × 90,00 = 29,97 (3 kuruş eşleme farkı) çıkıyordu, şimdi tam sayı miktar.
    lines.push({ name: kind === "sale" || kind === "smm" ? "Hizmet" : "Gider", qty: M, unitPrice: "0,01", ...ortak, ...(kind === "purchase" && gider ? { expenseCode: gider } : {}) });
  }
  const stopaj = S ? Math.round((S * 10000) / M) / 100 : 0;
  if (S && Math.round((M * stopaj) / 100) !== S) return { eslenemez: `stopaj ${S} / matrah ${M}: oran tutmuyor` };
  const body = {
    kind, accountId: ids.cari[o.cari], issueDate: o.tarih, lines,
    ...(kind === "purchase" ? { number: `${o.id || "A"}-${o.tarih}` } : {}),
    ...(kind === "purchase" && !mal ? { scenario: "expense_purchase" } : {}),
    ...(stopaj ? { stoppageRate: stopaj } : {}),
    force: true,
  };
  return { body };
}

// Faturanın peşin ödemesi (F-12, kâhinde ayrı "tahsilat {fatura, fatura_odemesi: true}" olayı): fatura formunun peşin satırına alınır.
function pesinler(fatura) {
  return s.olaylar.filter(x => (x.tur === "tahsilat" || x.tur === "odeme") && x.fatura === fatura.id && x.fatura_odemesi && x.tarih === fatura.tarih);
}

const benzer = { similarOk: true, cashForce: true, force: true, exceedOk: true };
const sonuc = (o, r, ek = {}) => ({ durum: r.ok ? "yapildi" : "red", status: r.status, ...(r.ok ? {} : { kod: r.kod, ileti: r.ileti }), ...ek });
const apiYok = (neden, is = "") => ({ durum: "api_yok", neden, ...(is ? { is } : {}) });
const uygulanmadi = (is, neden) => ({ durum: "uygulanmadi", is, neden });

async function cariGiris(c, body) {
  const id = await cariAc(c);
  return api("POST", `/api/workspace/accounts/${id}/entries`, { ...body, ...benzer });
}
const YOL = { nakit: "cash", havale: "bank", pos: "card", kart: "card" };

async function posOraniAyarla(o) {
  const p = o.pos || "POS1";
  const posId = await posAc(p);
  const d = posDurum[p];
  const valorGun = Math.round((Date.parse(o.valor || o.tarih) - Date.parse(o.tarih)) / 86400000);
  const kom = o.komisyon || 0;
  // Oran seçimi (yalnız biçim eşlemesi; komisyonu program hesaplar ve önizlemeyle okunur): kâhinin komisyonunu kuruşa yuvarlanmış veren yuvarlak oran
  // (‰ adımı), yoksa tam oran. Aynı gün için oran bir kez yazılır (program aynı tarihe ikinci oran kaydını reddeder: pos-rate-exists).
  const uygun = ppm => Math.floor((o.tutar * ppm) / 1e6 + 0.5) === kom;
  let ppm = [d.ppm, 20000, 25000, 30000, 15000, 10000, 0].find(uygun);
  if (ppm === undefined) {
    for (let x = 1000; x <= 50000 && ppm === undefined; x += 500) if (uygun(x)) ppm = x;
  }
  if (ppm === undefined) ppm = o.tutar ? Math.round((kom / o.tutar) * 1e6) : 0;
  if (ppm !== d.ppm || valorGun !== d.valor) {
    if (d.gun === o.tarih) return { posId, uyari: `aynı gün (${o.tarih}) ikinci oran yazılamaz: ${d.ppm} ppm / ${d.valor} gün kaldı (kâhin ${ppm} ppm / ${valorGun} gün)` };
    const r = await api("POST", `/api/workspace/bank/pos/${posId}/rates`, { validFrom: o.tarih, rates: [{ installments: 1, rate: String(ppm / 10000).replace(".", ","), valorDays: valorGun }] }, "pos-oran");
    if (!r.ok) return { hata: r };
    Object.assign(d, { ppm, valor: valorGun, gun: o.tarih });
  }
  const pv = await api("GET", `/api/workspace/bank/pos/preview?pos=${posId}&amount=${encodeURIComponent(tl(o.tutar))}&installments=1&date=${o.tarih}`, undefined, "pos-onizleme");
  const komisyon = [pv.data?.commission, pv.data?.commissionMinor, pv.data?.fee, pv.data?.totals?.commission].find(x => x !== undefined);
  return { posId, onizleme: pv.data, ...(komisyon === undefined ? { uyari: `önizlemede komisyon alanı yok: ${JSON.stringify(pv.data).slice(0, 300)}` } : {}) };
}

async function evrakAl(o, yon) {
  const instrument = (o.yol || o.evrak_turu) === "senet" ? "note" : "cheque";
  const cariId = await cariAc(o.cari);
  const body = {
    direction: yon, instrument, amount: tl(o.tutar), accountId: cariId, issueDate: o.tarih, dueDate: o.vade || o.tarih, serialNo: o.evrak, bank: "Akbank", drawer: s.cariler?.[o.cari]?.ad || o.cari,
    ...(yon === "out" ? { bankAccountId: await bankaAc(o.banka || "B1", acilisOlayi("banka_acilis", "banka", o.banka || "B1")) } : {}),
    ...(o.fatura && ids.olay[o.fatura] ? { invoiceId: ids.olay[o.fatura] } : {}),
    ...(o.taksit_karti && ids.taksit[o.taksit_karti] ? { planId: ids.taksit[o.taksit_karti] } : {}),
    ...benzer,
  };
  const r = await api("POST", "/api/workspace/cheques", body);
  if (r.ok) ids.evrak[o.evrak] = r.data?.id || r.data?.cheque?.id;
  return r;
}
async function evrakIslem(o, action, ek = {}) {
  const cid = ids.evrak[o.evrak];
  if (!cid) return null;
  return api("POST", `/api/workspace/cheques/${cid}/actions`, { action, date: o.tarih, ...ek, ...benzer });
}
const bankaId = b => bankaAc(b, acilisOlayi("banka_acilis", "banka", b));
const kartId = k => kartAc(k, acilisOlayi("kart_acilis", "kart", k));
const krediId = k => krediAc(k, acilisOlayi("kredi_acilis", "kredi", k));
async function supheliKaydi(c) {
  const cid = ids.cari[c];
  const r = await api("GET", `/api/workspace/accounts/${cid}/doubtful`);
  const list = (r.data?.records || []).filter(x => x.status === "open");
  return list.length ? list[list.length - 1] : null;
}

// ---------------------------------------------------------------- olaylar
const tuketilen = new Set();
const evrakDurum = {}; // fatura formuna alınan peşin ödemeler (olay sıra no)
const kasaAcilis = { durum: null }; // girilmiş Kasa açılışı (duzenle → Kasa Açılış Bakiyesini Düzelt formu tutar + tarihle gider)
const faturaNo = {}; // kâhin fatura kimliği → programın belge numarası (Açık Faturalar raporu satırları)
const faturaKarti = {}; // kâhin kart kimliği → { fatura, planId }: faturanın KENDİ kartı fatura formunda (payment.rest "installments") açıldı
// Faturanın kendi taksit kartı (kâhin taksit_karti {kaynak: "fatura", fatura, tarih = fatura günü}): ekranda fatura formunun "Kalanı Taksitlendir"i
// (routes/invoices.mjs paymentInput rest 'installments' → plans.createForAccount invoiceId). Önceki sürücü kartı ayrıca "Mevcut Borcu Taksitlendir"
// (coversBalance) olarak açıyordu; kart faturaya bağlı olmadığı için EK-2B 35 (faturayla kalkan kart, tahsilatlı kartta silme) sınanamıyordu.
function faturaKartOlayi(fatura) {
  return s.olaylar.find(x => x.tur === "taksit_karti" && x.kaynak === "fatura" && x.fatura === fatura.id && x.tarih === fatura.tarih && x.cari === fatura.cari);
}
// Ç5-K SÜRÜCÜ EŞLEMESİ (kâhin bakımı 5–7 "Sürücü için": S26 / S40 / S44 / S45): Kasa Giriş / Çıkış, cari tahsilat / ödeme ve taksit tahsilatının `duzenle`si
// ekrandaki düzeltme formunun ucuna gider (Kasa satırı Düzenle; cari kartı hareketi Düzenle; taksit kartı tahsilatı Düzenle). Değişiklikler birikir (kâhin gibi:
// her düzeltme kaydın son kabul edilen hâline). Programda YOLU OLMAYAN alanlar istek gönderilmeden api_yok: cari (cari hareketinin carisi düzeltilemez — S45 /
// S54 / S57, Ç5-B'nin işi), taksit kartı bağı (cari tahsilatını karta / kartlar arası taşıyan tek kayıt düzeltmesi yok).
const guncel = {};
async function duzenleHareket(kaynak, degisiklik, fid) {
  const once = guncel[kaynak.id] || kaynak;
  const yeni = { ...once, ...degisiklik };
  // Ana oturum kararı 06.11: cari hareketinin "Cari" alanı (S40 cari düzeltmesi kabul, S45 / S57 bağlıysa red, S54 bağ + cari) Ç5-B'de yazılacak → uygulanmadı (U).
  if ("cari" in degisiklik && degisiklik.cari !== once.cari) return uygulanmadi("Ç5-B", "cari hareketinin carisi programda henüz düzeltilemez (S40 / S45 / S54 / S57 — routes/accounts.mjs PUT entries 'Cari' alanı Ç5-B'de)");
  if ("taksit_karti" in degisiklik && (degisiklik.taksit_karti || "") !== (once.taksit_karti || "")) return apiYok("taksit kartı bağı programda tek kayıt düzeltmesi olarak yok", "Ç5-B");
  let r;
  if (kaynak.tur === "kasa_giris" || kaynak.tur === "kasa_cikis") {
    r = await api("PUT", `/api/workspace/cash/${fid}`, { kind: kaynak.tur === "kasa_giris" ? "in" : "out", amount: tl(yeni.tutar), date: yeni.tarih, description: yeni.aciklama || (kaynak.tur === "kasa_giris" ? "Kasaya Giriş" : "Kasadan Çıkış"), ...benzer });
  } else if (yeni.taksit_karti) {
    r = await api("PUT", `/api/workspace/plans/${ids.taksit[yeni.taksit_karti]}/entries/${fid}`, { kind: kaynak.tur === "tahsilat" ? "in" : "out", amount: tl(yeni.tutar), date: yeni.tarih, method: YOL[yeni.yol] || "cash", note: yeni.aciklama || kaynak.id, ...benzer });
  } else {
    const giris = kaynak.tur === "tahsilat";
    const yol = { method: YOL[yeni.yol] || "cash", ...(yeni.yol === "havale" ? { bankAccountId: await bankaId(yeni.banka || "B1") } : {}) };
    const fatura = "fatura" in yeni ? { invoiceId: yeni.fatura ? ids.olay[yeni.fatura] || "" : "" } : {};
    r = await api("PUT", `/api/workspace/accounts/${ids.cari[yeni.cari]}/entries/${fid}`, { kind: giris ? "in" : "out", amount: tl(yeni.tutar), date: yeni.tarih, note: yeni.aciklama || kaynak.id, ...yol, ...fatura, ...(giris ? { doubtfulSkip: yeni.normal_cari === true } : {}), ...benzer });
  }
  if (r.ok) guncel[kaynak.id] = yeni;
  return sonuc(kaynak, r, { yol: `${kaynak.tur} Düzenle (${Object.keys(degisiklik).join(", ")})` });
}
async function uygula(o, no) {
  const v = o;
  switch (o.tur) {
    // ---- açılışlar (2.5.0'da karşı hesap 519 — Ç5; program bugün 500'e yazar)
    case "kasa_acilis": {
      // Sürücü bakımı 2 (kâhin README R2 / EK-2B 33, "sürücünün s18 eşlemesi düzeltme ucuna gitmiş"): açılış girilmişken Kasa → Açılış Bakiyesi ekranı
      // YALNIZ "Kasa Açılış Bakiyesini Düzelt" açar (client/assets/hof-workspace.js cashOpeningForm: başlık / düğme mevcut açılışa göre) — ikinci açılış
      // girecek yol yok. Kâhinin İKİNCİ kasa_acilis olayı (M-01 "bir kez") bu yüzden programa GÖNDERİLMEZ; ekran ön koşulu reddi olarak yazılır
      // (status "ekran", HTTP isteği yok — ders 3: başarı sayılmaz). Açılışın düzeltmesi kâhinde ayrı olay (duzenle {kaynak: <kasa_acilis>}).
      const mevcut = await api("GET", "/api/workspace/cash/opening", undefined, "kasa-acilis-oku");
      const ac = mevcut.data?.opening;
      if (ac) return { durum: "red", status: "ekran", kod: "cash-opening-exists", ileti: `Kasa açılışı var (${ac.date} · ${ac.amount}); ekran yalnız "Kasa Açılış Bakiyesini Düzelt" açar — ikinci açılış yolu yok (istek gönderilmedi)`, yol: "ekran ön koşulu" };
      const r = await api("POST", "/api/workspace/cash/opening", { amount: tl(v.tutar), date: v.tarih, ...benzer });
      if (r.ok) {
        if (o.id) ids.olay[o.id] = r.data?.id;
        kasaAcilis.durum = { id: o.id || "", tutar: v.tutar, tarih: v.tarih };
      }
      return sonuc(o, r);
    }
    case "banka_acilis": {
      if (ids.banka[v.banka]) return sonuc(o, await api("POST", `/api/workspace/bank/accounts/${ids.banka[v.banka]}/opening`, { date: v.tarih, amount: tl(v.tutar), confirmed: true }));
      const id = await bankaAc(v.banka, v);
      return id ? { durum: "yapildi", status: 200 } : { durum: "red", status: program.kurulum.at(-1)?.status, kod: program.kurulum.at(-1)?.kod, ileti: program.kurulum.at(-1)?.ileti };
    }
    case "kart_acilis": {
      if (ids.kart[v.kart]) return sonuc(o, await api("POST", `/api/workspace/bank/accounts/${ids.kart[v.kart]}/opening`, { date: v.tarih, amount: tl(v.tutar), confirmed: true }));
      const id = await kartAc(v.kart, v);
      return id ? { durum: "yapildi", status: 200 } : { durum: "red", status: program.kurulum.at(-1)?.status, kod: program.kurulum.at(-1)?.kod, ileti: program.kurulum.at(-1)?.ileti };
    }
    case "kredi_acilis": {
      if (ids.kredi[v.kredi]) return sonuc(o, await api("POST", `/api/workspace/bank/accounts/${ids.kredi[v.kredi]}/opening`, { date: v.tarih, amount: tl(v.tutar), confirmed: true }));
      const id = await krediAc(v.kredi, v);
      return id ? { durum: "yapildi", status: 200 } : { durum: "red", status: program.kurulum.at(-1)?.status, kod: program.kurulum.at(-1)?.kod, ileti: program.kurulum.at(-1)?.ileti };
    }
    case "cari_acilis": {
      if (!ids.cari[v.cari]) {
        const id = await cariAc(v.cari, v);
        return id ? { durum: "yapildi", status: 200, yol: "cari açılırken Açılış Bakiyesi (is_opening)" } : { durum: "red", status: program.kurulum.at(-1)?.status, kod: program.kurulum.at(-1)?.kod, ileti: program.kurulum.at(-1)?.ileti };
      }
      // Cari önceden açıksa (ör. aynı gün açılış çeki için) programda Açılış Bakiyesi işareti yalnız cari açılırken konur; kullanıcının yolu cari kartında
      // Borç / Alacak Yaz, açıklama "Açılış bakiyesi" (2.4.9 açılışı açıklamadan tanır — çekirdek planı §1). Kâhinin açıklaması (ör. "Devreden bakiye") gönderilmez.
      return sonuc(o, await cariGiris(v.cari, { kind: v.yon === "alacak" ? "credit" : "debt", amount: tl(v.tutar), date: v.tarih, note: v.aciklama || "Açılış bakiyesi" }), { yol: "cari önceden açıktı: Borç / Alacak Yaz (is_opening yok; açıklama kâhinin)", aciklama_ile: true });
    }
    case "stok_acilis": {
      const notlar = [];
      for (const x of v.kalemler) {
        const [pay, payda] = String(x.birim_maliyet).split("/").map(Number);
        const birim = (payda ? pay / payda : pay) / 100;
        const birimFiyat = String(Math.round(birim * 10000) / 10000).replace(".", ",");
        if (ids.urun[x.urun]) {
          notlar.push(`${x.urun} önceden açıktı`);
          const r = await api("POST", `/api/workspace/stock/${ids.urun[x.urun]}/moves`, { kind: "in", qty: String(x.miktar), unitPrice: birimFiyat, pay: "none", date: v.tarih, note: "Açılış stoku", ...benzer });
          if (!r.ok) return sonuc(o, r);
        } else {
          const id = await urunAc(x.urun, { miktar: x.miktar, tarih: v.tarih, birimFiyat });
          if (!id) return { durum: "red", status: program.kurulum.at(-1)?.status, kod: program.kurulum.at(-1)?.kod, ileti: program.kurulum.at(-1)?.ileti };
        }
      }
      return { durum: "yapildi", status: 200, ...(notlar.length ? { not: notlar.join("; ") } : {}) };
    }
    case "evrak_acilis": {
      // Çek / senet açılış portföyü (cariye işlenmemiş): Çek / Senet → Excel'den Yükle, "carilere dokunmadan" (post: false), keşideci adıyla cariye bağlanır.
      const yon = v.yon === "alinan" ? "in" : "out";
      const tur = v.evrak_turu === "senet" ? "Senet" : "Çek";
      const ad = s.cariler?.[v.cari]?.ad || v.cari;
      await cariAc(v.cari);
      const matrix = [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], [yon === "in" ? "Alınan" : "Verilen", tur, v.evrak, "Akbank", ad, tl(v.tutar), gunAdi(v.vade || v.tarih), gunAdi(v.tarih)]];
      const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
      const r = await api("POST", "/api/workspace/cheques/import", { matrix, headerAt: 0, roles, fileName: `acilis-${v.evrak}.xlsx`, post: false, direction: yon });
      if (!r.ok) return sonuc(o, r);
      const liste = await api("GET", `/api/workspace/cheques?status=all&limit=500`);
      const bul = (liste.data?.cheques || liste.data?.items || []).find(x => String(x.serialNo) === String(v.evrak));
      if (bul) ids.evrak[v.evrak] = bul.id;
      if (v.durum === "tahsilde" && bul) {
        evrakDurum[v.evrak] = { banka: v.banka || "B1" };
        const r2 = await api("POST", `/api/workspace/cheques/${bul.id}/actions`, { action: "bank-deposit", date: v.tarih, bankAccountId: await bankaId(v.banka || "B1"), ...benzer });
        return sonuc(o, r2, { yol: "Excel açılış (carilere dokunmadan) + aynı gün Bankaya Tahsile Ver" });
      }
      return { ...sonuc(o, r), yol: "Excel açılış (carilere dokunmadan)", ...(bul ? {} : { not: "evrak listede bulunamadı" }), rapor: r.data };
    }
    case "taksit_excel": {
      const ad = s.cariler?.[v.cari]?.ad || v.cari;
      await cariAc(v.cari);
      const ilk = v.taksitler?.[0]?.vade || v.tarih;
      const matrix = [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], [ad, telefon(v.cari), tl(v.toplam), String(v.taksitler?.length || 1), gunAdi(ilk), tl(v.odenen || 0), gunAdi(v.tarih)]];
      const r = await api("POST", "/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue", 5: "paid", 6: "registered" }, fileName: `${v.id}.xlsx`, linkRecords: false });
      if (r.ok) {
        const pl = await api("GET", `/api/workspace/plans?status=all&limit=500`);
        const bul = (pl.data?.plans || []).filter(x => x.name === ad).at(-1);
        if (bul) ids.taksit[v.id] = bul.id;
        const bagli = bul ? (await api("GET", `/api/workspace/plans/${bul.id}`)).data : null;
        const hesap = bagli?.accountId || bagli?.plan?.accountId || "";
        return sonuc(o, r, { not: !bul ? "kart bulunamadı" : hesap === ids.cari[v.cari] ? "kart kâhinin carisine bağlı" : hesap ? `kart BAŞKA cariye bağlı (${hesap})` : "kart CARİSİZ", rapor: r.data });
      }
      return sonuc(o, r);
    }
    case "acilis_eslestir":
      return uygulanmadi("Ç5-ESLESTIRME (M-11)", "Açılış Eşleştirme Fişi (M-11) 2.5.0'da yazılacak");

    // ---- fatura
    case "satis_faturasi":
    case "alis_faturasi":
    case "esmm":
    case "gelen_smm": {
      await cariAc(v.cari);
      for (const x of v.kalemler || []) if (x.urun) await urunAc(x.urun);
      const kind = { satis_faturasi: "sale", alis_faturasi: "purchase", esmm: "smm", gelen_smm: "purchase" }[o.tur];
      faturaGovdesi.uyari = "";
      const g = faturaGovdesi(v, kind);
      if (g.eslenemez) return apiYok(g.eslenemez);
      const tevUyari = faturaGovdesi.uyari;
      const pesin = pesinler(o);
      const cash = pesin.filter(x => ["nakit", "havale"].includes(x.yol)).map((x, i) => ({ amount: tl(x.tutar), method: YOL[x.yol], lineKey: `p${i + 1}`, ...(x.yol === "havale" ? { bankAccountId: ids.banka[x.banka] } : {}) }));
      for (const x of pesin) tuketilen.add(x);
      const kartOlayi = o.tur === "satis_faturasi" ? faturaKartOlayi(o) : null;
      const taksitli = kartOlayi ? { rest: "installments", installments: { count: kartOlayi.taksitler?.length || 1, firstDue: kartOlayi.taksitler?.[0]?.vade || o.tarih, everyMonths: 1 } } : null;
      const body = { ...g.body, payment: { cash, ...(taksitli || { rest: "open" }), ...(v.vade ? { dueDate: v.vade } : {}) } };
      if (o.tur === "alis_faturasi" && v.indirim_ayi) body.__kdvIndirimAyi = v.indirim_ayi;
      delete body.__kdvIndirimAyi;
      const r = await api("POST", "/api/workspace/invoices", body);
      if (r.ok) {
        ids.olay[o.id] = r.data?.id || r.data?.invoice?.id;
        ids.satirlar[o.id] = (r.data?.lines || []).map(l => l.id);
        if (r.data?.number) faturaNo[r.data.number] = o.id;
        if (kartOlayi) {
          faturaKarti[kartOlayi.id] = { fatura: o.id, planId: r.data?.planId || "" };
          tuketilen.add(kartOlayi);
        }
      }
      return sonuc(o, r, { ...(pesin.length ? { not: `peşin ödeme fatura formunda: ${pesin.map(x => x.id).join(", ")}` } : {}), ...(kartOlayi ? { kart: `faturanın kendi kartı ${kartOlayi.id} fatura formunda (Kalanı Taksitlendir; planId ${r.data?.planId || "YOK"})` } : {}), ...(v.indirim_ayi ? { eksik: "KG-7 KDV İndirim Dönemi alanı programda yok (gönderilmedi)" } : {}), ...(tevUyari ? { uyari: tevUyari } : {}) });
    }
    case "satis_iade_faturasi":
    case "alis_iade_faturasi": {
      await cariAc(v.cari);
      const kind = o.tur === "satis_iade_faturasi" ? "sale_return" : "purchase_return";
      const asil = ids.olay[v.asil_fatura];
      // Programda iade belgesi asıl faturadan seçilir (kalem + miktar). Kâhinin iadesi kalemsizse asıl faturanın tek kalemi M oranında (miktar en çok 3 ondalık).
      const kart = asil ? await api("GET", `/api/workspace/invoices/${asil}`) : null;
      const satirlar = kart?.data?.lines || [];
      let lines;
      if (v.kalemler?.length && satirlar.length) {
        lines = v.kalemler.map(x => {
          const sat = satirlar.find(l => l.itemId === ids.urun[x.urun]) || satirlar[0];
          return { originLineId: sat.id, qty: x.miktar };
        });
      } else if (satirlar.length >= 1) {
        // Kalemsiz iade: matrah M asıl satırların birim fiyatlarından açgözlü (önce tam adet, kalan son satırdan oranla; miktar en çok 3 ondalık).
        lines = [];
        let kalan = v.M;
        // Birim fiyat kuruş cinsinden KESİRLİ (program 4 ondalıklı TL fiyatı saklar; tamsayıya yuvarlamak kısmi iadede kuruş kaydırıyordu).
        const birimOf = sat => Number(String(sat.unitPrice).replace(",", ".")) * 100;
        for (const sat of satirlar) {
          if (kalan <= 0) break;
          const birim = birimOf(sat);
          if (!birim) continue;
          const q = Math.min(Number(sat.qty), Math.floor(kalan / birim + 1e-9));
          if (q > 0) {
            lines.push({ originLineId: sat.id, qty: q });
            kalan -= Math.round(q * birim);
          }
        }
        if (kalan > 0) {
          const sat = satirlar.find(x => birimOf(x) && !lines.some(l => l.originLineId === x.id && l.qty >= Number(x.qty))) || satirlar[0];
          const q = Math.round((kalan / birimOf(sat)) * 1000) / 1000;
          const var0 = lines.find(l => l.originLineId === sat.id);
          if (var0) var0.qty = Math.round((var0.qty + q) * 1000) / 1000;
          else lines.push({ originLineId: sat.id, qty: q });
        }
      } else {
        return apiYok(`asıl fatura ${v.asil_fatura} programda yok ya da çok kalemli (${satirlar.length}); kalemsiz iade eşlenemedi`);
      }
      // Kâhin bakımı 2 (README "Sürücü için"): para_iadesi ("nakit" | "havale" + banka) = iade + müşteriye para iadesi tek olay, iade kendi ödeme
      // satırına bağlı → iade faturası formunun ödeme satırı (payment.cash; tutar = iade belgesinin ödenecek toplamı, program hesaplar).
      let cash = [];
      if (v.para_iadesi) {
        const calc = await api("POST", "/api/workspace/invoices/calc", { kind, originalId: asil, issueDate: v.tarih, lines }, "iade-hesap");
        const toplam = [calc.data?.totals?.payable, calc.data?.payable, calc.data?.totals?.grand, calc.data?.grand].find(x => x !== undefined && x !== null);
        const tutar = toplam !== undefined ? kurus(String(toplam).replace(",", ".")) : (v.M || 0) + (v.K || 0);
        cash = [{ amount: tl(tutar), method: v.para_iadesi === "havale" ? "bank" : "cash", lineKey: "r1", ...(v.para_iadesi === "havale" ? { bankAccountId: await bankaId(v.banka || "B1") } : {}) }];
      }
      const r = await api("POST", "/api/workspace/invoices", { kind, originalId: asil, issueDate: v.tarih, lines, payment: { cash }, ...(kind === "purchase_return" ? { number: `${o.id}-${v.tarih}` } : {}), force: true });
      if (r.ok) {
        ids.olay[o.id] = r.data?.id;
        if (r.data?.number) faturaNo[r.data.number] = o.id;
      }
      return sonuc(o, r, v.para_iadesi ? { yol: `iade faturası formunda para iadesi (${cash[0]?.amount} ${cash[0]?.method})` } : {});
    }
    case "duzenle": {
      const kaynak = s.olaylar.find(x => x.id === v.kaynak);
      if (kaynak?.tur === "kasa_acilis") {
        // Kasa → Açılış Bakiyesi → "Kasa Açılış Bakiyesini Düzelt" (G-7; kâhin EK-2B 33: ilk Kasa hareketinden SONRAYA alınamaz — program 409 cash-opening-after-first).
        const st = kasaAcilis.durum;
        if (!st || st.id !== v.kaynak) return apiYok(`düzeltilecek kasa açılışı ${v.kaynak} programda yok`);
        const yeni = { ...st, tutar: v.degisiklik?.tutar ?? st.tutar, tarih: v.degisiklik?.tarih ?? st.tarih };
        const r = await api("POST", "/api/workspace/cash/opening", { amount: tl(yeni.tutar), date: yeni.tarih, ...benzer });
        if (r.ok) kasaAcilis.durum = yeni;
        return sonuc(o, r, { yol: "Kasa Açılış Bakiyesini Düzelt (tutar + tarih)" });
      }
      const fid = ids.olay[v.kaynak];
      if (!kaynak || !fid) return apiYok("düzenlenecek kayıt programda yok");
      if (["kasa_giris", "kasa_cikis", "tahsilat", "odeme"].includes(kaynak.tur)) return duzenleHareket(kaynak, v.degisiklik || {}, fid);
      const yeni = { ...kaynak, ...v.degisiklik };
      const kind = { satis_faturasi: "sale", alis_faturasi: "purchase", esmm: "smm", gelen_smm: "purchase" }[kaynak.tur];
      if (!kind) return apiYok(`düzenle: ${kaynak.tur} eşlenmedi`);
      let g = faturaGovdesi(yeni, kind);
      let not = "";
      if (g.eslenemez && v.degisiklik && "K" in v.degisiklik && !("M" in v.degisiklik)) {
        // Sürücü bakımı 2 (s43): yalnız KDV tutarı, matrah aynı (ör. 50.000 → KDV 12.000 = %24) — program yalnız %0 / 1 / 10 / 20 (invoice-math VAT_RATES);
        // ekranda bu düzenleme kurulamaz. Asıl oranla göndermek "değişiklik yok" düzenlemesi olurdu (kâhin değiştirir) → istek gönderilmez, olay iki yanda da yok.
        return apiYok(`düzenle: ${g.eslenemez} — KDV tutarı matrah değişmeden standart oran dışına (program yalnız %0, %1, %10, %20)`);
      }
      if (g.eslenemez) {
        // Kâhinin değişikliği oranı bozuyorsa (ör. kilitli dönem reddi denemesi) matrah yeni, oran asıl faturanınki.
        const oran = kdvOrani(kaynak.M, kaynak.K || 0).oran ?? 20;
        g = faturaGovdesi({ ...yeni, K: Math.round((yeni.M * oran) / 100) }, kind);
        not = `KDV asıl oranla (%${oran}) gönderildi`;
        if (g.eslenemez) return apiYok(g.eslenemez);
      }
      const r = await api("POST", `/api/workspace/invoices/${fid}/edit`, { ...g.body, payment: { cash: [], rest: "open" } });
      return sonuc(o, r, not ? { not } : {});
    }
    case "iptal": {
      const kaynak = s.olaylar.find(x => x.id === v.kaynak);
      const fid = ids.olay[v.kaynak];
      if (!kaynak || !fid) return apiYok("iptal edilecek kayıt programda yok");
      if (kaynak.tur === "tahsilat" && kaynak.yol === "pos") {
        const satis = await api("GET", `/api/workspace/bank/pos/sales?row=${encodeURIComponent(ids.satir[v.kaynak] || "")}`);
        const sale = (satis.data?.sales || []).find(x => x.kind === "sale") || (satis.data?.sales || [])[0];
        if (!sale) return apiYok("POS satışı bulunamadı");
        return sonuc(o, await api("POST", `/api/workspace/bank/pos/sales/${sale.id}/void`, {}));
      }
      if (!/faturasi|esmm|smm/.test(kaynak.tur)) return apiYok(`iptal: ${kaynak.tur} için ekranda İptal Et yok`);
      return sonuc(o, await api("POST", `/api/workspace/invoices/${fid}/cancel`, { reason: "Müşteri vazgeçti", payments: "drop", refund: "none" }));
    }
    case "sil": {
      const fid = ids.olay[v.kaynak];
      if (!fid) return apiYok("silinecek kayıt programda yok");
      const kaynak = s.olaylar.find(x => x.id === v.kaynak);
      // Cari kartından girilen tahsilat / ödeme (kâhin T-xx) cari kartındaki satırdan, taksit tahsilatı kartın satırından silinir; faturalar ve taslak Faturalar'dan.
      if (kaynak && (kaynak.tur === "tahsilat" || kaynak.tur === "odeme") && ids.satir[v.kaynak]) {
        const [tablo, eid] = ids.satir[v.kaynak].split(":");
        const url = tablo === "plan_entries" ? `/api/workspace/plans/${ids.taksit[kaynak.taksit_karti]}/entries/${eid}` : `/api/workspace/accounts/${ids.cari[kaynak.cari]}/entries/${eid}`;
        return sonuc(o, await api("DELETE", url), { yol: tablo === "plan_entries" ? "taksit kartı satırı Sil" : "cari kartı satırı Sil" });
      }
      // Ç5-K: Kasa Giriş / Çıkış Kasa penceresindeki satırdan silinir (Silinenler'e düşer).
      if (kaynak && (kaynak.tur === "kasa_giris" || kaynak.tur === "kasa_cikis")) return sonuc(o, await api("DELETE", `/api/workspace/cash/${fid}?cashForce=1`), { yol: "Kasa satırı Sil" });
      if (kaynak && kaynak.tur !== "taslak" && !/faturasi|esmm|smm/.test(kaynak.tur)) return apiYok(`sil: ${kaynak.tur} için silme eşlemesi yazılmadı`);
      return sonuc(o, await api("DELETE", `/api/workspace/invoices/${fid}`));
    }
    case "taslak": {
      // F-13: taslak fatura (deftere dokunmaz, numarasız). Kâhinin taslağında cari / kalem yok: sürücü ilk müşteriye tek kalemli hizmet taslağı yazar.
      const c = Object.keys(s.cariler || {}).find(x => s.cariler[x].tur === "musteri") || Object.keys(s.cariler || {})[0];
      const r = await api("POST", "/api/workspace/invoices", { kind: "sale", status: "draft", accountId: await cariAc(c), issueDate: v.tarih, lines: [{ name: "Hizmet", qty: 1, unitPrice: "100,00", vatRate: 20, discountRate: 0 }], payment: { cash: [], rest: "open" } });
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r, { yol: `taslak satış faturası (${c}, 100,00 + KDV)` });
    }
    case "geri_yukle": {
      const fid = ids.olay[v.kaynak];
      if (!fid) return apiYok("geri yüklenecek kayıt programda yok");
      const cop = await api("GET", "/api/admin/trash");
      const item = (Array.isArray(cop.data) ? cop.data : cop.data?.items || []).find(x => x.ref === fid || x.id === `trash:${fid}`);
      if (!item) return apiYok(`Silinenler'de ${v.kaynak} yok (program faturayı silmemiş olabilir)`);
      return sonuc(o, await api("POST", "/api/admin/trash/restore", { id: item.id }));
    }
    case "mahsup": {
      const a = ids.olay[v.fatura1];
      const b = ids.olay[v.fatura2];
      if (!a || !b) return apiYok("mahsup edilecek fatura programda yok");
      return sonuc(o, await api("POST", `/api/workspace/invoices/${a}/offsets`, { counterType: "invoice", counterId: b, amount: tl(v.tutar), date: v.tarih }));
    }

    // ---- tahsilat / ödeme
    case "tahsilat":
    case "odeme": {
      if (tuketilen.has(o)) return { durum: "faturada", not: `fatura ${v.fatura} formunun peşin satırı` };
      const giris = o.tur === "tahsilat";
      await cariAc(v.cari);
      const fatura = v.fatura && ids.olay[v.fatura] ? { invoiceId: ids.olay[v.fatura] } : {};
      if (v.yol === "cek" || v.yol === "senet") {
        const r = await evrakAl({ ...v, evrak_turu: v.yol }, giris ? "in" : "out");
        return sonuc(o, r);
      }
      if (v.yol === "ciro") {
        const r = await evrakIslem(v, "endorse", { accountId: ids.cari[v.cari] });
        return r ? sonuc(o, r) : apiYok(`ciro edilecek evrak ${v.evrak} programda yok`);
      }
      const yol = {
        method: YOL[v.yol],
        ...(v.yol === "havale" ? { bankAccountId: await bankaId(v.banka || "B1") } : {}),
        ...(v.yol === "kart" ? { bankAccountId: await kartId(v.kart || "KK1") } : {}),
      };
      let posNot = null;
      if (v.yol === "pos") {
        const p = await posOraniAyarla(v);
        if (p.hata) return sonuc(o, p.hata, { not: "POS oranı yazılamadı" });
        Object.assign(yol, { posId: p.posId, installments: 1 });
        posNot = p.uyari || null;
      }
      const plan = v.taksit_karti ? ids.taksit[v.taksit_karti] : null;
      if (v.taksit_karti && !plan) return apiYok(`taksit kartı ${v.taksit_karti} programda yok`);
      // Kâhin bakımı 1 (README "tahsilat … normal_cari ('Normal Cari Hesaba İşle'; `supheliden` geriye uyum için kabul edilir, artık varsayılan)"): şüpheli
      // kaydı açık caride tahsilat VARSAYILAN olarak şüpheliden düşer (2.3.0 K3); yalnız normal_cari işaretlisi formun "Normal Cari Hesaba İşle" kutusuyla
      // (doubtfulSkip). Önceki sürücü (kâhin 5e37f0ee dili) tersini yapıyordu: işaretsiz her tahsilatı doubtfulSkip ile gönderiyordu.
      const govde = { kind: giris ? "in" : "out", amount: tl(v.tutar), date: v.tarih, note: o.id || o.tur, ...yol, ...fatura, ...(giris && v.normal_cari ? { doubtfulSkip: true } : {}), ...(giris && v.yol === "kart" ? { cardRefund: true } : {}) };
      const r = plan ? await api("POST", `/api/workspace/plans/${plan}/entries`, { ...govde, ...benzer }) : await cariGiris(v.cari, govde);
      if (r.ok && o.id) {
        ids.olay[o.id] = r.data?.entryId || r.data?.id;
        ids.satir[o.id] = `${plan ? "plan_entries" : "account_entries"}:${ids.olay[o.id]}`;
      }
      return sonuc(o, r, posNot ? { uyari: posNot } : {});
    }
    case "kayit_tahsilati": {
      // T-14: tablo kaydının (eski kayıt) cariye bağlı olmayan tahsilatı. Sürücü bir kez tek satırlı tablo yükler (Excel → Tablo), kaydın anahtarıyla öder.
      if (!ids.kayit) {
        const matrix = [["Ad Soyad", "Telefon", "Toplam"], ["Kayıt Sahibi", "05329999999", "1.000"]];
        const st = await api("POST", "/api/workspace/dataset/stage", { kind: "excel", fileName: "kayit.xlsx", sheets: [{ name: "Kayıt", matrix }] });
        if (!st.ok) return sonuc(o, st, { not: "tablo yüklenemedi" });
        const cm = await api("POST", "/api/workspace/dataset/commit", { stageId: st.data?.stageId, mode: "replace" });
        if (!cm.ok) return sonuc(o, cm, { not: "tablo onaylanamadı" });
        const rows = await api("GET", `/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`);
        const list = rows.data?.result?.data?.json?.rows || rows.data?.json?.rows || [];
        ids.kayit = list.find(x => x["Ad Soyad"] === "Kayıt Sahibi")?.__hofKey;
        if (!ids.kayit) return apiYok(`tablo kaydının anahtarı okunamadı (${JSON.stringify(rows.data).slice(0, 200)})`);
      }
      return sonuc(o, await api("POST", `/api/workspace/cases/${encodeURIComponent(ids.kayit)}/payments`, { amount: tl(v.tutar), date: v.tarih, method: "cash", note: "Kayıt tahsilatı", caseTitle: "Kayıt Sahibi", ...benzer }));
    }
    case "hesapsiz_hareket": {
      const r = await cariGiris(v.cari, { kind: v.yon === "odeme" ? "out" : "in", amount: tl(v.tutar), date: v.tarih, method: "bank", bankAccountId: "none", note: "Hesapsız (Açılıştan Önce)" });
      return sonuc(o, r);
    }
    case "kart_borcuna_aktar": {
      // K-15: eski kart hareketi. Açılıştan önce: Kredi Kartı yolu "Hesapsız (Açılıştan Önce)"; açılıştan sonra kart hesabıyla ödeme (B CH / A 309).
      const kid = v.acilistan_once ? "none" : await kartId(v.kart);
      const r = await cariGiris(v.cari, { kind: "out", amount: tl(v.tutar), date: v.tarih, method: "card", bankAccountId: kid, note: "Kart Borcuna Aktar" });
      return sonuc(o, r, { yol: v.acilistan_once ? "kart ödemesi hesapsız (açılıştan önce)" : "kart hesabıyla ödeme" });
    }

    // ---- kasa ve banka
    case "kasa_giris":
    case "kasa_cikis":
    {
      // Ç5-K: kimlik saklanır (Kasa hareketinin düzeltmesi, silinmesi ve Silinenler'den geri yüklenmesi; Mutabakat Testi uyarısındaki satır).
      const r = await api("POST", "/api/workspace/cash", { kind: o.tur === "kasa_giris" ? "in" : "out", amount: tl(v.tutar), method: "cash", date: v.tarih, description: o.tur === "kasa_giris" ? "Kasaya Giriş" : "Kasadan Çıkış", ...benzer });
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r);
    }
    case "bankadan_kasaya":
    case "kasadan_bankaya":
      return sonuc(o, await api("POST", "/api/workspace/cash/transfer", { direction: o.tur === "bankadan_kasaya" ? "to-cash" : "to-bank", amount: tl(v.tutar), date: v.tarih, bankAccountId: await bankaId(v.banka), ...benzer }));
    case "banka_transfer": {
      const ucret = (v.ucret || 0) + 0;
      const bsmvVar = Boolean(v.bsmv);
      if (bsmvVar && Math.round(ucret * 0.05) !== v.bsmv) return apiYok(`transfer ücret vergisi ${v.bsmv} / ücret ${ucret}: %5 BSMV tutmuyor`);
      const body = { type: "transfer", accountId: await bankaId(v.gonderen), toAccountId: await bankaId(v.alici), amount: tl(v.tutar), date: v.tarih, channel: "", feeAmount: tl(ucret), ...(ucret ? { feeTax: bsmvVar ? "bsmv_excl" : "none" } : {}), ...(v.valor && v.valor !== v.tarih ? { valueDate: v.valor } : {}), ...benzer };
      const r = await api("POST", "/api/workspace/bank/transfers", body);
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r);
    }
    case "banka_masraf": {
      const bsmv = v.bsmv || 0;
      if (bsmv && Math.round(v.tutar * 0.05) !== bsmv) return apiYok(`masraf BSMV ${bsmv} / ${v.tutar}: %5 tutmuyor`);
      const r = await api("POST", "/api/workspace/bank/vouchers", { type: "fee", accountId: await bankaId(v.banka), amount: tl(v.tutar), date: v.tarih, feeType: "diger", tax: bsmv ? "bsmv_excl" : "none", ...(bsmv ? { taxRate: "5" } : {}), description: o.id || "Masraf", ...benzer });
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r);
    }
    case "banka_masraf_faturali": {
      const k = kdvOrani(v.M, v.K);
      if (k.oran === null) return apiYok(k.neden);
      // Program faturalı masrafta faturayı kesen cariyi ister (banka carisi): sürücü "Banka (Masraf Faturası)" tedarikçisini açar (kâhinde cari yok).
      if (!ids.cari.__banka) {
        const rc = await kur("cari:__banka", "POST", "/api/workspace/accounts", { name: "Banka (Masraf Faturası)", type: "supplier", registeredOn: ilkTarih, similarOk: true });
        ids.cari.__banka = rc.data?.id;
      }
      const r = await api("POST", "/api/workspace/bank/vouchers", { type: "fee", accountId: await bankaId(v.banka), amount: tl(v.M), date: v.tarih, feeType: "diger", tax: "vat_excl", taxRate: String(k.oran), invoiceNo: `MF-${v.tarih}`, partyId: ids.cari.__banka, description: "Faturalı masraf", ...benzer });
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r, { yol: "faturayı kesen cari: sürücünün açtığı 'Banka (Masraf Faturası)' tedarikçisi" });
    }
    case "faiz_geliri": {
      let oran = null;
      for (const r of [15, 10, 5, 20, 0, 7.5, 17.5]) if (Math.round((v.brut * r) / 100) === (v.stopaj || 0)) { oran = r; break; }
      // Yaygın oran tutmuyorsa (üretici sabit 1,00 TL stopaj yazıyor) dört ondalıklı oran: stopajı program bu orandan hesaplar.
      if (oran === null && v.brut) {
        const x = Math.round(((v.stopaj || 0) / v.brut) * 1000000) / 10000;
        if (Math.round((v.brut * x) / 100) === (v.stopaj || 0)) oran = x;
      }
      if (oran === null) return apiYok(`faiz stopajı ${v.stopaj} / brüt ${v.brut}: oranla üretilemiyor`);
      const r = await api("POST", "/api/workspace/bank/vouchers", { type: "interest_in", accountId: await bankaId(v.banka), amount: tl(v.brut), date: v.tarih, stoppageRate: String(oran).replace(".", ","), description: "Faiz", ...benzer });
      return sonuc(o, r, { not: `stopaj oranı %${oran}` });
    }
    case "faiz_gideri":
      return sonuc(o, await api("POST", "/api/workspace/bank/vouchers", { type: "interest_out", accountId: await bankaId(v.banka), amount: tl(v.tutar + (v.bsmv || 0)), taxAmount: "0", date: v.tarih, description: "Faiz gideri", ...benzer }));
    case "banka_diger_gelir":
    case "banka_diger_gider": {
      const r = await api("POST", "/api/workspace/bank/vouchers", { type: o.tur === "banka_diger_gelir" ? "other_in" : "other_out", accountId: await bankaId(v.banka), amount: tl(v.tutar), date: v.tarih, description: o.id || "Diğer", ...benzer });
      if (r.ok && o.id) ids.olay[o.id] = r.data?.id;
      return sonuc(o, r);
    }

    // ---- POS, kart, kredi
    case "pos_iade": {
      const eid = ids.olay[v.tahsilat];
      if (!eid) return apiYok(`POS tahsilatı ${v.tahsilat} programda yok`);
      const satis = await api("GET", `/api/workspace/bank/pos/sales?row=${encodeURIComponent(ids.satir[v.tahsilat] || "")}`);
      const sale = (satis.data?.sales || []).find(x => x.kind === "sale") || (satis.data?.sales || [])[0];
      if (!sale) return apiYok("POS satışı bulunamadı");
      return sonuc(o, await api("POST", `/api/workspace/bank/pos/sales/${sale.id}/refund`, { amount: tl(v.tutar), date: v.tarih }));
    }
    case "pos_aktar":
    case "pos_komisyon_faturasi":
      return apiYok("senaryolarda yok (eşleme yazılmadı)");
    case "kart_harcama": {
      const kid = await kartId(v.kart);
      if (v.cari) return sonuc(o, await cariGiris(v.cari, { kind: "out", amount: tl(v.tutar), method: "card", bankAccountId: kid, date: v.tarih, note: "Kart harcaması" }));
      const uid = await urunAc(v.urun);
      const parcalar = bol(v.tutar, v.miktar);
      let r;
      for (const p of parcalar) {
        r = await api("POST", `/api/workspace/stock/${uid}/moves`, { kind: "in", qty: String(p.qty), unitPrice: fiyat(p.fiyat), pay: "cash", method: "card", bankAccountId: kid, date: v.tarih, note: "Kartla alış", ...benzer });
        if (!r.ok) break;
      }
      return sonuc(o, r, parcalar.length > 1 ? { not: "iki stok hareketi (tutar miktara bölünmüyor)" } : {});
    }
    case "kart_borc_odeme":
      return sonuc(o, await api("POST", "/api/workspace/bank/vouchers", { type: "card_payment", accountId: await bankaId(v.banka), cardAccountId: await kartId(v.kart), amount: tl(v.tutar), date: v.tarih, ...benzer }));
    case "kart_faiz": {
      const kid = await kartId(v.kart);
      const r = await api("POST", "/api/workspace/bank/vouchers", { type: "interest_out", accountId: kid, amount: tl(v.tutar + (v.bsmv || 0)), taxAmount: "0", date: v.tarih, description: "Kart faizi", ...benzer });
      if (r.ok) return sonuc(o, r, { yol: "kart hesabında Faiz Gideri fişi" });
      const r2 = await api("POST", "/api/workspace/bank/vouchers", { type: "fee", accountId: kid, amount: tl(v.tutar + (v.bsmv || 0)), date: v.tarih, feeType: "diger", tax: "none", description: "Kart faizi", ...benzer });
      if (r2.ok) return sonuc(o, r2, { yol: "kart hesabında Masraf fişi (Faiz Gideri kart hesabında yok)" });
      return apiYok(`kart faizi (D-07): kart hesabına faiz / masraf fişi girilemiyor — faiz ${r.status} ${r.ileti}; masraf ${r2.status} ${r2.ileti}`);
    }
    case "kredi_kullan":
      return sonuc(o, await api("POST", "/api/workspace/bank/transfers", { type: "loan_draw", accountId: await bankaId(v.banka), loanAccountId: await krediId(v.kredi), amount: tl(v.tutar), date: v.tarih, ...benzer }));
    case "kredi_odeme":
      return sonuc(o, await api("POST", "/api/workspace/bank/transfers", { type: "loan_repay", accountId: await bankaId(v.banka), loanAccountId: await krediId(v.kredi), amount: tl(v.anapara || 0), interestAmount: tl(v.faiz || 0), date: v.tarih, ...benzer }));

    // ---- çek / senet
    case "evrak_tahsile_ver": {
      const r = await evrakIslem(v, "bank-deposit", { bankAccountId: await bankaId(v.banka) });
      if (r?.ok) evrakDurum[v.evrak] = { banka: v.banka };
      return r ? sonuc(o, r) : apiYok(`evrak ${v.evrak} programda yok`);
    }
    case "evrak_bankadan_geri_al": {
      const r = await evrakIslem(v, "bank-withdraw");
      if (r?.ok) evrakDurum[v.evrak] = {};
      return r ? sonuc(o, r) : apiYok(`evrak ${v.evrak} programda yok`);
    }
    case "evrak_tahsil": {
      // Ç-05: bankada tahsildeki evrak verildiği bankadan (Havale / EFT) tahsil edilir; portföydeki evrak kasaya (Ç-04, yol kasa) ya da bankaya.
      const tahsilde = evrakDurum[v.evrak]?.banka;
      const ek = tahsilde ? { method: "bank", bankAccountId: await bankaId(tahsilde) } : v.yol === "banka" || v.yol === "havale" ? { method: "bank", bankAccountId: await bankaId(v.banka || "B1") } : { method: "cash" };
      const r = await evrakIslem(v, "collect", ek);
      return r ? sonuc(o, r) : apiYok(`evrak ${v.evrak} programda yok`);
    }
    case "evrak_karsiliksiz": {
      const r = await evrakIslem(v, "bounce");
      return r ? sonuc(o, r) : apiYok(`evrak ${v.evrak} programda yok`);
    }
    case "verilen_evrak_ode": {
      const ek = v.yol === "nakit" ? { method: "cash" } : { method: "bank", bankAccountId: await bankaId(v.banka || "B1") };
      const r = await evrakIslem(v, "pay", ek);
      return r ? sonuc(o, r) : apiYok(`evrak ${v.evrak} programda yok`);
    }
    case "verilen_evrak_geri_al": {
      const cid = ids.evrak[v.evrak];
      if (!cid) return apiYok(`evrak ${v.evrak} programda yok`);
      // Ç-11: programda verilen evrakın "ödenmeden geri alınması" işlemi yok; ekranın yolu evrakı Sil (cari etkisi asıl tarihinde kalkar).
      return sonuc(o, await api("DELETE", `/api/workspace/cheques/${cid}`), { yol: "Sil (programda ayrı 'geri al' işlemi yok; etki asıl tarihte kalkar)" });
    }
    case "evrak_islem_geri_al": {
      const cid = ids.evrak[v.evrak];
      if (!cid) return apiYok(`evrak ${v.evrak} programda yok`);
      return sonuc(o, await api("POST", `/api/workspace/cheques/${cid}/undo`, {}));
    }

    // ---- taksit
    case "taksit_karti": {
      const cariId = await cariAc(v.cari);
      const ilk = v.taksitler?.[0]?.vade || v.tarih;
      let r;
      let pid;
      const fk = faturaKarti[o.id];
      if (fk) {
        // Faturanın kendi kartı fatura formunda açıldı (yukarıda); burada yalnız taksitler kâhinin vade / tutarına getirilir.
        if (!fk.planId) return apiYok(`faturanın kartı ${o.id}: fatura yanıtında planId yok`);
        pid = fk.planId;
        r = { ok: true, status: 200 };
      } else {
        const body = { accountId: cariId, name: `${s.cariler?.[v.cari]?.ad || v.cari} ${o.id}`, total: tl(v.toplam), registeredOn: v.tarih, mode: "auto", count: v.taksitler?.length || 1, firstDue: ilk, ...(v.kaynak !== "yeni_borc" ? { coversBalance: true } : {}) };
        r = await api("POST", "/api/workspace/plans", body);
        if (!r.ok) return sonuc(o, r);
        pid = r.data?.id || r.data?.plan?.id;
      }
      ids.taksit[o.id] = pid;
      // Taksitler kâhinin vade ve tutarına (taksit satırı düzeltmesi).
      const kart = await api("GET", `/api/workspace/plans/${pid}`);
      const items = kart.data?.items || [];
      const farkli = [];
      for (const [i, t] of (v.taksitler || []).entries()) {
        const it = items[i];
        if (!it) continue;
        if (it.dueDate !== t.vade || kurus(it.amount) !== t.tutar) {
          const u = await api("PUT", `/api/workspace/plans/${pid}/items/${it.id}`, { dueDate: t.vade, amount: tl(t.tutar) });
          if (!u.ok) farkli.push(`${i + 1}. taksit: ${u.status} ${u.ileti}`);
        }
      }
      const yol = fk ? "faturanın kendi kartı (fatura formu Kalanı Taksitlendir)" : v.kaynak === "yeni_borc" ? "Yeni Borç kartı" : "Mevcut Borcu Taksitlendir (coversBalance)";
      return { ...sonuc(o, r, { yol, ...(farkli.length ? { uyari: farkli.join("; ") } : {}) }), ...(fk ? { durum: "faturada", not: `fatura ${fk.fatura} formunda açıldı` } : {}) };
    }
    case "taksit_kapat": {
      // H-07 Kartı Kapat: kart düzenleme formunun Durum = Kapalı (PUT /plans/:id status closed; kapanış günü = programın bugünü = olay günü).
      // `eski: true` (kâhin bakımı 2 R6: 2.5.0'dan önce kapatılmış kart, göç verisi) programda AYNI yol — bugünkü kural (kalan 689) iki dalda da.
      const pid = ids.taksit[v.kart];
      if (!pid) return apiYok(`kapatılacak kart ${v.kart} programda yok`);
      return sonuc(o, await api("PUT", `/api/workspace/plans/${pid}`, { status: "closed" }), { yol: `Kartı Kapat${v.eski ? " (kâhin: 2.5.0'dan önce kapatılmış kart)" : ""}` });
    }

    // ---- KDV ve vergi
    case "kdv_mahsup": {
      const r = await api("POST", "/api/workspace/tax/vat-offset", { month: v.ay, note: `${v.ay} mahsup` });
      if (r.ok) ids.olay[`kdv:${v.ay}`] = r.data?.offset?.id || r.data?.id;
      return sonuc(o, r);
    }
    case "kdv_mahsup_geri_al": {
      const mid = ids.olay[`kdv:${v.ay}`];
      if (!mid) return apiYok(`${v.ay} mahsubu programda yok`);
      return sonuc(o, await api("POST", `/api/workspace/tax/vat-offset/${encodeURIComponent(mid)}/reverse`, {}));
    }
    case "vergi_odeme":
    case "gecikme_zammi": {
      if (o.tur === "gecikme_zammi") return apiYok("gecikme zammı (V-03) tek başına girilemiyor: Vergi Ödemesi'nde vergi tutarı sıfırdan büyük olmalı (gecikme zammı yalnız vergiyle birlikte)");
      const banka = v.yol === "nakit" ? {} : { accountId: await bankaId(v.banka || "B1") };
      const body = { way: v.yol === "nakit" ? "cash" : "bank", ...banka, date: v.tarih, taxType: "kdv", amount: tl(o.tur === "vergi_odeme" ? v.tutar : 0), ...(o.tur === "gecikme_zammi" ? { lateAmount: tl(v.tutar) } : {}), description: o.tur, ...benzer };
      return sonuc(o, await api("POST", "/api/workspace/tax/payments", body));
    }

    // ---- şüpheli alacak
    case "supheliye_al": {
      const cid = await cariAc(v.cari);
      const r = await api("POST", `/api/workspace/accounts/${cid}/doubtful`, { amount: tl(v.tutar), date: v.tarih, reason: "other", note: "Şüpheli", ...benzer });
      if (r.ok && o.id) ids.supheli[o.id] = r.data?.record?.id || "";
      return sonuc(o, r);
    }
    case "karsilik_ayir":
    case "degersiz_yaz":
    case "supheliden_cikar": {
      // Kâhin bakımı 2 (R14, EK-2 31): işlem KAYIT başına; olay `kayit` = supheliye_al olayının kimliği (zorunlu). Kayıt eşlenemezse açık son kayıt (eski davranış) + uyarı.
      const hedef = v.kayit ? ids.supheli[v.kayit] : "";
      let rec = null;
      if (hedef) {
        const lr = await api("GET", `/api/workspace/accounts/${ids.cari[v.cari]}/doubtful`);
        rec = (lr.data?.records || []).find(x => x.id === hedef) || null;
      }
      const kayitUyari = v.kayit && !rec ? `kayıt ${v.kayit} programda eşlenemedi — açık son kayıt kullanıldı` : "";
      if (!rec) rec = await supheliKaydi(v.cari);
      if (!rec) return apiYok(`${v.cari} için açık şüpheli kaydı programda yok`);
      const yol = { karsilik_ayir: "provision", degersiz_yaz: "write-off", supheliden_cikar: "release" }[o.tur];
      const kalan = Number(rec.remainingMinor) || 0;
      const body = { date: v.tarih, ...(o.tur === "karsilik_ayir" ? { amount: tl(v.tutar) } : o.tur === "degersiz_yaz" ? { amount: tl(kalan) } : {}), ...benzer };
      return sonuc(o, await api("POST", `/api/workspace/accounts/${ids.cari[v.cari]}/doubtful/${rec.id}/${yol}`, body), { ...(o.tur === "degersiz_yaz" ? { not: `programın kalan şüphelisi ${kalan}` } : {}), ...(kayitUyari ? { uyari: kayitUyari } : {}) });
    }

    // ---- stok modülü
    case "stok_giris":
    case "stok_cikis_satis":
    case "stok_musteri_iadesi":
    case "stok_tedarikci_iadesi": {
      const uid = await urunAc(v.urun);
      const kind = o.tur === "stok_giris" || o.tur === "stok_musteri_iadesi" ? "in" : "out";
      const reason = o.tur === "stok_musteri_iadesi" ? "return" : o.tur === "stok_tedarikci_iadesi" ? "preturn" : "";
      const karsi = v.karsi || "nakit";
      const odeme = karsi === "cari" ? { pay: "account", accountId: await cariAc(v.cari) } : { pay: "cash", method: karsi === "havale" ? "bank" : "cash", ...(karsi === "havale" ? { bankAccountId: await bankaId(v.banka || "B1") } : {}) };
      const parcalar = bol(v.tutar, v.miktar);
      let r;
      for (const p of parcalar) {
        r = await api("POST", `/api/workspace/stock/${uid}/moves`, { kind, qty: String(p.qty), unitPrice: fiyat(p.fiyat), ...odeme, ...(reason ? { reason } : {}), date: v.tarih, note: o.tur, ...benzer });
        if (!r.ok) break;
      }
      return sonuc(o, r, parcalar.length > 1 ? { not: "iki stok hareketi (tutar miktara bölünmüyor)" } : {});
    }
    case "stok_duzeltme": {
      const uid = await urunAc(v.urun);
      const m = Number(v.miktar);
      return sonuc(o, await api("POST", `/api/workspace/stock/${uid}/moves`, { kind: m >= 0 ? "in" : "out", qty: String(Math.abs(m)), pay: "none", date: v.tarih, note: "Sayım farkı", ...benzer }));
    }

    // ---- cari düzeltme
    case "borc_yaz":
    case "alacak_yaz": {
      const body = { kind: o.tur === "borc_yaz" ? "debt" : "credit", amount: tl(v.tutar), date: v.tarih, note: v.aciklama || (o.tur === "borc_yaz" ? "Borç" : "Alacak"), ...(v.vade ? { dueDate: v.vade } : {}) };
      const r = await cariGiris(v.cari, body);
      if (r.ok && o.id) ids.olay[o.id] = r.data?.entryId;
      return sonuc(o, r, v.acilis || v.onay !== undefined ? { not: `kâhin işaretleri: acilis=${v.acilis ?? "-"} onay=${v.onay ?? "-"} (KG-16 "Açılış Olabilir" programda yok)` } : {});
    }
    case "cari_tur_degistir": {
      const cid = await cariAc(v.cari);
      const kart = await api("GET", `/api/workspace/accounts/${cid}`);
      const a = kart.data?.account || kart.data || {};
      return sonuc(o, await api("PUT", `/api/workspace/accounts/${cid}`, { name: a.name, type: CARI_TUR[v.yeni_tur], ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}) }));
    }

    // ---- ters kayıt, kilit
    case "ters": {
      const hedef = s.olaylar.find(x => x.id === v.hedef);
      const eid = ids.olay[v.hedef];
      if (!eid) return apiYok(`ters kaydedilecek ${v.hedef} programda yok`);
      if (!hedef || !/^banka_|faiz_|kart_|kredi_/.test(hedef.tur)) return apiYok(`${hedef?.tur}: banka fişi değil (ekranda Ters Kaydet yalnız Banka Fişi / transferde)`);
      return sonuc(o, await api("POST", `/api/workspace/bank/events/${encodeURIComponent(eid)}/reverse`, {}));
    }
    case "donem_kilitle": {
      // Kâhinde kural "2.4.9" = göçte 2.4.9 kuralıyla DONMUŞ kilit (Ç3). Program bugün kilidi koyar, türetmeyi dondurmaz (program zaten 2.4.9 kuralıyla türetir).
      // Ç3 (2.5.0, birleşti 2ba5ac0b): kilit kancası kilitli dönemin defterini DONDURUR (göç 47); yanıtta frozenThrough + freeze. Kâhinin kural
      // "2.4.9" (göçte 2.4.9 kuralıyla donmuş kilit) programda bugünkü kural = 2.4.9 kopyası olduğundan aynı türetme (Ç5 / Ç7 kural değişiklikleri sonra).
      const r = await api("PUT", "/api/admin/period-lock", { lockedUntil: v.tarih, force: true });
      const kilit = r.ok ? { frozenThrough: r.data?.frozenThrough ?? null, freeze: r.data?.freeze ? { state: r.data.freeze.state || r.data.freeze.status || "", ...Object.fromEntries(Object.entries(r.data.freeze).filter(([k]) => /run|through|rule|done|state|error/i.test(k)).slice(0, 8)) } : null } : {};
      return sonuc(o, r, { ...(v.kural === "2.4.9" ? { not: "kâhin: 2.4.9 kuralıyla donmuş kilit (program: Ç3 dondurması, bugünkü kural 2.4.9 kopyası)" } : {}), kilit });
    }
    case "kural_farki_duzelt":
      return uygulanmadi("Ç5-KG15", "Kural Farkı Düzeltme Fişi (KG-15; Ç3 tasarım notu §13: Ç5'in işi)");
    case "devir":
      return uygulanmadi("D2–D4", "yıl sonu devri (arşiv + yeni yıl açılışı)");
    case "devri_yenile": {
      // Devri Yenile (D4) yok. DEVİRSİZ EŞDEĞER: düzeltmeler (ör. geç gelen Aralık faturası) tek dosyaya geçmiş tarihli kayıt olarak girilir (kâhin README:
      // "devir şirketin durumunu değiştirmez"; karşılaştırıcı kâhini de devirsiz koşar).
      const alt = [];
      for (const d of v.duzeltmeler || []) {
        const r = await uygula(d, no);
        alt.push({ tur: d.tur, ...(d.id ? { id: d.id } : {}), ...r });
      }
      const red = alt.find(x => x.durum !== "yapildi");
      return { durum: red ? red.durum : "yapildi", status: red?.status || 200, ...(red ? { kod: red.kod, ileti: red.ileti } : {}), alt, not: "Devri Yenile mekanizması yok (D4): düzeltmeler tek dosyaya girildi" };
    }
    case "devri_geri_al":
      return uygulanmadi("D4-GERI-AL", "Devri Geri Al");
    case "fis_ters":
      return uygulanmadi("Ç2", "saklanan fişin ters kaydı");
    default:
      return apiYok(`olay türü sürücüde yok: ${o.tur}`);
  }
}

// ---------------------------------------------------------------- okuma
const paraMetni = metin => {
  if (typeof metin === "number") return Math.round(metin * 100);
  const t = String(metin ?? "").replace(/[₺\s]|TL/g, "").replace(/\u2212/g, "-");
  if (!/^-?[\d.]+(,\d+)?$/.test(t)) return null;
  return Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100);
};
// Cari Mizanı (Rapor Merkezi "mizan") satırı → kâhin cari anahtarı (Cari No ile; aynı adlı iki cari ayrışır). Bakiye borç artı.
function cariMizani(rap) {
  const h = rap?.headers || [];
  const ix = ad => h.indexOf(ad);
  const out = {};
  for (const row of rap?.rows || []) {
    const c = program.cari_no[String(row[ix("Cari No")])];
    if (!c) continue;
    // Bakiye mutlak değerle yazılır; yönü "Durum" sütununda (Borçlu / Alacaklı / Kapalı): alacaklı eksi.
    const mutlak = paraMetni(row[ix("Bakiye")]);
    const b = mutlak === null ? null : /alacakl/i.test(String(row[ix("Durum")] || "")) ? -Math.abs(mutlak) : Math.abs(mutlak);
    out[c] = { devir: paraMetni(row[ix("Devir")]), borc: paraMetni(row[ix("Borç")]), alacak: paraMetni(row[ix("Alacak")]), bakiye: b, durum: row[ix("Durum")] };
  }
  return out;
}
// Programın durumu UFUK gününe kadar (to = ufuk): Ana Defter mizanı, Alt Hesap Mizanı, Cari Mizanı. Ufuk = şimdiye kadarki en büyük olay günü.
async function durum(etiket, ufuk = program.ufuk) {
  const q = `to=${ufuk}`;
  const led = await api("GET", `/api/workspace/ledger?${q}`, undefined, `oku:${etiket}`);
  const sub = await api("GET", `/api/workspace/bank/sub-trial?${q}`, undefined, `oku:${etiket}`);
  const cm = await rapor("mizan", { from: "2000-01-01", to: ufuk });
  const ana = {};
  for (const a of led.data?.trial?.accounts || []) if (kurus(a.balance)) ana[a.code] = kurus(a.balance);
  const alt = {};
  for (const r of sub.data?.rows || sub.data?.subs || sub.data?.trial || []) if (kurus(r.balance)) alt[r.sub] = kurus(r.balance);
  const cari = {};
  for (const [c, x] of Object.entries(cariMizani(cm))) if (x.bakiye) cari[c] = x.bakiye;
  return { ana, alt, cari, ok: led.ok && sub.ok && !cm.hata, dengeli: led.data?.trial?.balanced === true, mutabakat: led.data?.reconciliation?.ok === true };
}
async function altHesaplariOku() {
  const r = await api("GET", "/api/workspace/bank/accounts?status=all", undefined, "oku:alt");
  for (const a of r.data?.accounts || r.data || []) {
    const sub = a.glSub || a.gl_sub;
    if (!sub) continue;
    for (const [k, id] of Object.entries(ids.banka)) if (id === a.id) altHesap[sub] = `102.${k}`;
    for (const [k, id] of Object.entries(ids.kart)) if (id === a.id) altHesap[sub] = `309.${k}`;
    for (const [k, id] of Object.entries(ids.kredi)) if (id === a.id) altHesap[sub] = `300.${k}`;
  }
  const p = await api("GET", "/api/workspace/bank/pos?status=all", undefined, "oku:alt");
  for (const t of p.data?.pos || []) {
    const sub = t.glSub || t.gl_sub;
    for (const [k, id] of Object.entries(ids.pos)) if (id === t.id && sub) altHesap[sub] = `108.${k}`;
  }
}
const rapor = async (id, q) => {
  const r = await api("GET", `/api/workspace/report-center/${id}?${new URLSearchParams(q).toString()}`, undefined, `rapor:${id}`);
  return r.ok ? { headers: r.data?.headers, rows: r.data?.rows, footer: r.data?.footer, summary: r.data?.summary } : { hata: r.status, ileti: r.ileti };
};
async function raporOku(o) {
  const out = { tur: o.rapor, ad: o.ad, saat: program.saat };
  const bas = o.bas || "";
  const son = o.son || o.tarih || "";
  if (["mizan", "gelir_tablosu", "bilanco", "buyuk_defter", "yevmiye", "degerleme"].includes(o.rapor)) {
    const q = new URLSearchParams({ ...(bas ? { from: bas } : {}), ...(son ? { to: son } : {}) }).toString();
    const led = await api("GET", `/api/workspace/ledger?${q}`, undefined, `rapor:${o.rapor}`);
    out.mizan = (led.data?.trial?.accounts || []).map(a => ({ hesap: a.code, devir: kurus(a.opening), borc: kurus(a.debit), alacak: kurus(a.credit), bakiye: kurus(a.balance) }));
    out.mizan_toplam = led.data?.trial?.totals ? { borc: kurus(led.data.trial.totals.debit), alacak: kurus(led.data.trial.totals.credit) } : null;
    out.dengeli = led.data?.trial?.balanced === true;
    out.mutabakat = led.data?.reconciliation || null;
    const sub = await api("GET", `/api/workspace/bank/sub-trial?${q}`, undefined, `rapor:${o.rapor}`);
    out.alt = (sub.data?.rows || sub.data?.subs || sub.data?.trial || []).map(r => ({ alt: r.sub, hesap: r.account, devir: kurus(r.opening), borc: kurus(r.debit), alacak: kurus(r.credit), bakiye: kurus(r.balance) }));
    // Cari Mizanı (cari boyutu): Rapor Merkezi "mizan".
    out.cari_mizani = await rapor("mizan", { from: bas || "2000-01-01", ...(son ? { to: son } : {}) });
  }
  if (o.rapor === "yevmiye") out.yevmiye = await rapor("yevmiye", { ...(bas ? { from: bas } : {}), ...(son ? { to: son } : {}) });
  if (o.rapor === "buyuk_defter") out.buyuk_defter_yok = "Büyük Defter (hesap ekstresi) programda yok — Ç6";
  if (o.rapor === "degerleme") out.stok = await rapor("stok-durumu", {});
  // ---- B1 / Tek Yükümlülük Kuyruğu raporları (kâhin bakımı 1–2). Programın BUGÜNKÜ okumaları; "bugün" = raporun günü (sahte saat). Geçmiş günlü
  // raporda (o.tarih < o ana kadarki en büyük olay günü) program sonradan girilmiş kayıtları da görür — `gecmis_gunlu` işareti (karşılaştırıcı yazar).
  const cariKart = async c => {
    const cid = ids.cari[c];
    if (!cid) return null;
    const r = await api("GET", `/api/workspace/accounts/${cid}`, undefined, `rapor:${o.rapor}`);
    const a = r.data?.account || r.data || {};
    // Cari kartındaki "Geciken" = totals.overdue (açık taksit kartlarının vadesi geçmiş kalanı; WhatsApp Ödeme Hatırlatma {{4}} ve elemesi bununla — lib/whatsapp/queue.mjs overdueOf).
    return { gecikmis: kurus(a.totals?.overdue), gecikmis_sayi: Number(a.totals?.overdueCount) || 0, bakiye: kurus(a.totals?.balance), supheli: a.doubtful ? { kalan: Number(a.doubtful.remainingMinor ?? a.doubtful.openMinor ?? 0) || 0, sayi: Number(a.doubtful.count) || 0 } : null, kartlar: (a.plans || []).map(p => ({ id: p.id, durum: p.status, gecikmis: kurus(p.totals?.overdue) })) };
  };
  if (["gecikmis", "acik_faturalar", "acik_kalemler", "kartlar", "kilit_bag_notu"].includes(o.rapor)) {
    out.cari = o.cari;
    out.cari_kart = await cariKart(o.cari);
  }
  if (o.rapor === "gecikmis_tumu") {
    out.cariler = {};
    for (const c of Object.keys(s.cariler || {})) out.cariler[c] = await cariKart(c);
  }
  if (o.rapor === "hatirlatma") {
    // Ödeme Hatırlatma seçimi: WhatsApp → Toplu Gönderim'in alıcı listesi (POST /whatsapp/targets, Bağlantı gerektirmez; eleme çekirdeği Otomatik Gönder'le aynı —
    // accounts.waFacts; kuyruk "Gecikmiş Borç Yok" elemesi overdueOf: totals.overdue > 0). Şüpheli alacak etiketi programda yok (S7 Ç5'te).
    const r = await api("POST", "/api/workspace/whatsapp/targets", { kind: "message", all: true, status: "all" }, "rapor:hatirlatma");
    out.alicilar = r.ok ? Object.fromEntries((r.data?.recipients || []).map(x => [program.cari_kimlik[x.id] || x.id, { gecikmis: kurus(x.overdue?.amount), bakiye: kurus(x.balance), gecerli: x.valid, neden: x.reason || "" }])) : { hata: r.status, ileti: r.ileti };
  }
  if (o.rapor === "acik_faturalar" || o.rapor === "acik_kalemler" || o.rapor === "gecikmis") {
    const af = await rapor("acik-faturalar", {});
    const h = af.headers || [];
    const ix = ad => h.indexOf(ad);
    // Satır → kâhin faturası (belge numarasıyla; aynı adlı iki cari ayrışır). Kalan: satış tarafı +, alış tarafı − (kâhin acik_faturalar işareti).
    out.acik_faturalar = (af.rows || []).map(row => ({ fatura: faturaNo[row[ix("Fatura No")]] || `?${row[ix("Fatura No")]}`, taraf: row[ix("Taraf")], kalan: (/borç|alış/i.test(String(row[ix("Taraf")])) ? -1 : 1) * Math.abs(paraMetni(row[ix("Kalan")]) || 0), vade: gunIso(row[ix("Vade")]), tarih: gunIso(row[ix("Fatura Tarihi")]) }));
    out.acik_faturalar_ham = { headers: h, satir: (af.rows || []).length };
  }
  if (o.rapor === "kartlar") {
    out.kartlar = {};
    for (const [k, pid] of Object.entries(ids.taksit)) {
      const tanim = s.olaylar.find(x => x.id === k && (x.tur === "taksit_karti" || x.tur === "taksit_excel"));
      if (!tanim || tanim.cari !== o.cari) continue;
      const r = await api("GET", `/api/workspace/plans/${pid}`, undefined, "rapor:kartlar");
      if (!r.ok) {
        out.kartlar[k] = { yok: r.status, ileti: r.ileti };
        continue;
      }
      out.kartlar[k] = { kapali: r.data?.status === "closed", durum: r.data?.status, taksitler: (r.data?.items || []).map(it => ({ vade: it.dueDate, tutar: kurus(it.amount), kalan: kurus(it.remaining) })) };
    }
  }
  if (o.rapor === "kaynak_durumu") {
    const kaynak = s.olaylar.find(x => x.id === o.kaynak);
    const id = ids.olay[o.kaynak];
    if (!kaynak || !id) out.durum = { yok: true };
    else if (/faturasi|esmm|smm|taslak/.test(kaynak.tur)) {
      const r = await api("GET", `/api/workspace/invoices/${id}`, undefined, "rapor:kaynak");
      out.durum = r.ok ? { status: r.data?.status, statusLabel: r.data?.statusLabel } : { yok: r.status, ileti: r.ileti };
    } else if (kaynak.tur === "tahsilat" || kaynak.tur === "odeme") {
      const r = await api("GET", `/api/workspace/accounts/${ids.cari[kaynak.cari]}`, undefined, "rapor:kaynak");
      out.durum = { satir_var: (r.data?.entries || []).some(e => e.id === id) };
    } else if (kaynak.tur === "kasa_giris" || kaynak.tur === "kasa_cikis") {
      // Ç5-K (s70 S20 Silinenler'den geri yükleme): Kasa satırı Kasa penceresinde (bütün tarihler) var mı.
      const r = await api("GET", "/api/workspace/cash", undefined, "rapor:kaynak");
      out.durum = { satir_var: (r.data?.entries || []).some(e => e.id === id) };
    } else out.durum = { eslenmedi: kaynak.tur };
  }
  if (o.rapor === "mutabakat_uyarilari") {
    // Ç5-K (S20 = A): Mutabakat Testi'nin "Kasa Açılışından Önce Tarihli Hareket" uyarısı (cash:before-opening; satırlar program kimliğiyle — karşılaştırıcı kâhin
    // kimliğine olay_kimlik ile çevirir).
    const r = await api("GET", "/api/workspace/ledger/integrity", undefined, "rapor:mutabakat_uyarilari");
    const c = (r.data?.checks || []).find(x => x.code === "cash:before-opening");
    out.uyarilar = c ? { acilis: c.opening || "", sayi: c.count || 0, satirlar: c.items || [] } : null;
    out.olay_kimlik = { ...ids.olay };
  }
  if (o.rapor === "kural_farki") {
    // Ç3: "Kural Değişikliği Farkı (Kilitli Dönem)" — donmuş defter ↔ güncel türetme (Mutabakat Testi tam taraması; ledger:rule-diff).
    const r = await api("GET", "/api/workspace/ledger/integrity", undefined, "rapor:kural_farki");
    out.denetimler = (r.data?.checks || r.data?.extra || []).filter(x => /^ledger:/.test(x.code || "")).map(x => ({ code: x.code, ok: x.ok, count: x.count, breakdown: x.breakdown || [] }));
  }
  return out;
}
const gunIso = metin => {
  const m = String(metin || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(metin || "");
};

// ---------------------------------------------------------------- akış
const sonOkunan = { deger: null };
try {
  if ((await client.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş olmadı");
  saat(ilkTarih);
  program.saat = ilkTarih;
  await kur("banka-kurulum-gec", "POST", "/api/workspace/bank/setup/dismiss", {});
  await kur("eksi-politika", "PUT", "/api/admin/negative-policy", { cash: "off" });
  await kur("benzer-uyari-kapali", "PUT", "/api/workspace/bank/settings", { values: { similar: { enabled: false } } });
  // Tanımlar: açılış olayıyla gelmeyen cari ve ürün baştan açılır; açılışlı olanlar açılış olayında (Açılış Bakiyesi / açılış stoku işareti).
  const acilisliCari = new Set(s.olaylar.filter(o => o.tur === "cari_acilis").map(o => o.cari));
  for (const c of Object.keys(s.cariler || {})) if (!acilisliCari.has(c)) await cariAc(c);
  const acilisliUrun = new Set(s.olaylar.filter(o => o.tur === "stok_acilis").flatMap(o => o.kalemler.map(x => x.urun)));
  for (const u of Object.keys(s.urunler || {})) if (!acilisliUrun.has(u)) await urunAc(u);
  loop.enable();
  program.ufuk = ilkTarih;
  if (ADIM) sonOkunan.deger = await durum("baslangic");
  program.baslangic = sonOkunan.deger;
  // Saat TEK YÖNLÜ ilerler (kullanıcı geçmiş tarihli kaydı bugünden girer): saat = max(saat, olay günü). Okuma ufku = saat.
  // Gün değişince önce "gun" adımı: bankaya geçen POS kalemleri (gün sonu) + ufka giren ileri tarihli maddeler (valörlü transfer …).
  const ilerle = async (gun, no) => {
    if (!gun || gun <= program.saat) return;
    saat(gun);
    const onceki = program.saat;
    program.saat = gun;
    program.ufuk = gun;
    const st = await api("POST", "/api/workspace/bank/settle", {}, "pos-gun-sonu");
    if (ADIM) {
      const d = await durum(`gun:${no}`);
      const delta = fark(sonOkunan.deger, d);
      olaylar.push({ no: `${no}g`, tur: "gun", tarih: gun, onceki, durum: "yapildi", settled: st.data?.settled || 0, delta });
      sonOkunan.deger = d;
    }
  };
  for (const [i, o] of s.olaylar.entries()) {
    const no = i + 1;
    const kayit = { no, tur: o.tur, ...(o.id ? { id: o.id } : {}), ...(o.tarih ? { tarih: o.tarih } : {}) };
    if (o.tur === "rapor") {
      const gun = o.tarih || o.son || program.saat;
      const enBuyukGun = program.saat;
      await ilerle(gun, no);
      if (["gecikmis", "gecikmis_tumu", "hatirlatma", "acik_faturalar", "acik_kalemler", "kartlar", "kilit_bag_notu"].includes(o.rapor)) {
        // Gecikmiş / açık kalem raporları: programın "bugün"ü raporun günü (geçmiş günse saat geçici olarak geri alınır; program yine de o ana kadar
        // girilmiş BÜTÜN kayıtları görür — kâhin yalnız ≤ rapor günü olayları sayar → gecmis_gunlu).
        saat(o.tarih);
        program.raporlar[o.ad] = { no, ...(await raporOku(o)), dosya: o.dosya || "canli", ...(o.tarih < enBuyukGun ? { gecmis_gunlu: enBuyukGun } : {}) };
        saat(program.saat);
      } else program.raporlar[o.ad] = { no, ...(await raporOku(o)), dosya: o.dosya || "canli" };
      kayit.durum = "rapor";
      olaylar.push(kayit);
      continue;
    }
    // KDV Mahsup Fişi ay bitmeden yapılamaz (program 409 vat-offset-blocked): olayın günü yok → saat ayın ertesi gününe (kullanıcı ay bitince yapar).
    await ilerle(o.tur === "kdv_mahsup" ? ertesiAy(o.ay) : o.tarih, no);
    const t0 = performance.now();
    let r;
    try {
      r = await uygula(o, no);
    } catch (e) {
      r = { durum: "surucu_hatasi", ileti: String(e?.stack || e).slice(0, 600) };
    }
    Object.assign(kayit, r, { ms: Math.round(performance.now() - t0), saat: program.saat }, server.eski ? { surum: server.eski } : {});
    if (ADIM && (r.durum === "yapildi" || r.durum === "red" || r.durum === "faturada")) {
      const d = await durum(`olay:${no}`);
      kayit.delta = fark(sonOkunan.deger, d);
      kayit.dengeli = d.dengeli;
      kayit.mutabakat = d.mutabakat;
      sonOkunan.deger = d;
    }
    olaylar.push(kayit);
    if (server.eski && no === SON_YEDEK) {
      // Eski sürüm kapanır, sınanan program aynı veri klasörüyle açılır (göç); saat kaldığı yerden.
      await server.app.close();
      server = await sunucuAc();
      client = server.client();
      if ((await client.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("göçten sonra giriş olmadı");
      saat(program.saat);
      program.gecis = { no, eski: ESKI_SURUM };
      if (ADIM) sonOkunan.deger = await durum(`gecis:${no}`);
    }
  }
  await api("POST", "/api/workspace/bank/settle", {}, "pos-gun-sonu");
  await altHesaplariOku();
  program.son = await durum("son");
  program.son_tum = await durum("son-tum", "9999-12-31");
  const mt = await api("GET", "/api/workspace/ledger/integrity", undefined, "oku:integrity");
  // Ç5-K (S20 = A): düzey UYARI ("Kasa Açılışından Önce Tarihli Hareket" gibi; severity warning) Mutabakat Testi'ni geçersiz kılmaz — uyarı kâhinin beklentisidir
  // (mutabakat_uyarilari raporunda ayrıca karşılaştırılır); uyarı dışı her sapma kırmızı kalır.
  program.mutabakat_testi = mt.data ? mt.data.ok === true || (Array.isArray(mt.data.failures) && mt.data.failures.every(x => x.severity === "warning")) : null;
  program.mutabakat_testi_uyarilari = (mt.data?.failures || []).filter(x => x.severity === "warning").map(x => `${x.code}:${x.count ?? ""}`);
  // Tutmayan denetimler + Ç3 donmuş defter denetimleri (ledger:snapshot / ledger:rule-diff: donmuş = güncel türetme mi — madde madde, tam taramada).
  program.mutabakat_denetimleri = (mt.data?.checks || []).filter(x => !x.ok || /^ledger:/.test(x.code || "")).map(x => ({ code: x.code, name: x.name, ok: x.ok, ...(x.count !== undefined ? { count: x.count } : {}), ...(x.breakdown ? { breakdown: x.breakdown } : {}), ...(x.sample ? { sample: x.sample } : {}) }));
  program.mutabakat_kodlari = (mt.data?.checks || []).map(x => `${x.code}:${x.ok ? 1 : 0}`);
  const kl = await api("GET", "/api/workspace/ledger/lock", undefined, "oku:kilit");
  program.kilit_son = kl.ok ? { lockedUntil: kl.data?.lockedUntil || "", frozenThrough: kl.data?.frozenThrough ?? null } : null;
} finally {
  loop.disable();
  program.olcum = {
    olay_dongusu_en_cok_ms: Math.round(loop.max / 1e6),
    olay_dongusu_p99_ms: Math.round(loop.percentile(99) / 1e6),
    istek_sayisi: sureler.length,
    istekler: Object.values(
      sureler.reduce((acc, x) => {
        const k = `${x.method} ${x.url}`;
        const a = (acc[k] ||= { istek: k, sayi: 0, toplam_ms: 0, en_cok_ms: 0 });
        a.sayi += 1;
        a.toplam_ms += x.ms;
        a.en_cok_ms = Math.max(a.en_cok_ms, x.ms);
        return acc;
      }, {}),
    ).map(a => ({ ...a, toplam_ms: Math.round(a.toplam_ms), en_cok_ms: Math.round(a.en_cok_ms) })).sort((a, b) => b.toplam_ms - a.toplam_ms),
  };
  await server.app.close();
}

function fark(a, b) {
  if (!a || !b) return null;
  const out = {};
  for (const alan of ["ana", "alt", "cari"]) {
    const d = {};
    for (const k of new Set([...Object.keys(a[alan] || {}), ...Object.keys(b[alan] || {})])) {
      const x = (b[alan]?.[k] || 0) - (a[alan]?.[k] || 0);
      if (x) d[k] = x;
    }
    out[alan] = d;
  }
  return out;
}

writeFileSync(CIKTI, JSON.stringify(program, null, 1));
writeFileSync(CIKTI.replace(/\.json$/, ".api.json"), JSON.stringify(gunluk, null, 1));
const say = d => olaylar.filter(x => x.durum === d).length;
console.log(`${s.ad} [TZ=${process.env.TZ || "-"}]: ${olaylar.length} olay · yapıldı ${say("yapildi")} · red ${say("red")} · api_yok ${say("api_yok")} · uygulanmadı ${say("uygulanmadi")} · sürücü hatası ${say("surucu_hatasi")} · olay döngüsü en çok ${program.olcum.olay_dongusu_en_cok_ms} ms`);
process.exitCode = say("surucu_hatasi") ? 1 : 0;
