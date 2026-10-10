#!/usr/bin/env node
// Bağımsız senaryo koşucusu — program tarafı (test/bagimsiz/SENARYO-DILI.md, dil "destekofis-senaryo/1").
//
//   node test/bagimsiz/surucu.mjs <senaryo.json> [--cikti <dosya>]
//
// Ne yapar:
//   1. Senaryoyu §13'e göre denetler (geçersizse koşmaz, çıkış 2).
//   2. Programı geçici veriyle başlatır (test/helpers.mjs startTestServer; sahte saat config.now = senaryonun "bugun"ü, "saat"
//      adımlarıyla ileri alınır).
//   3. Her adımı programın GERÇEK HTTP API'siyle (ekranın kullandığı uçlar; istemci dosyaları client/assets/hof-*.js) uygular.
//      Takma kullanıcılar o rolde açılır, adım o kullanıcının oturumuyla gönderilir. benzerOnay → similarOk, yineDeKaydet → cashForce +
//      negativeOk ("Yine de Kaydet"), istekKimligi → x-hof-request başlığı (alan yoksa gönderilmez).
//   4. "kontrol" adımlarında ve sonda durumu programın KENDİ ekran/rapor uçlarından OKUR (kendi muhasebe hesabını yapmaz):
//      mizan ← Ana Defter mizanı (GET /api/workspace/ledger) + Alt Hesap Mizanı (GET /api/workspace/bank/sub-trial);
//      banka hesapları ← Banka → Hesaplar; Kasa ← Kasa penceresi; cari ← Cari listesi; stok ← Stok listesi; fatura ← fatura kartı;
//      taksit ← Taksitler penceresi; özet ← Banka Genel Bakış + ANLIK DURUM. Okunan her alanın kaynağı okumaKaynaklari'nda.
//   5. Çıktıyı SENARYO-DILI §8 biçiminde (anahtarlar sıralı, iki boşluk) yazar. Reddedilen istekler retler (durum + programın kodu) ve
//      retAyrinti (iletisi) listelerinde; uygulanamayan işlemler eslenemeyenler'de, nedeniyle.
//
// KURAL (temiz oda): bu dosya test/bagimsiz/model_a ve model_b'yi OKUMAZ; beklenen değer hesaplamaz. Yalnız iki küçük biçim dönüşümü
// yapar ve çıktıda adıyla yazar (hesaplananAlanlar): (a) program TL sayısı → kuruş tamsayı, mizan bakiyesi → borç/alacak bakiye sütunu;
// (b) ozet.kasaVeGercekBanka = ANLIK DURUM'daki Nakit Kasa + Gerçek Banka (program bu toplamı tek sayı olarak göstermiyor). "tamami"
// peşin ve iade geri ödemesi tutarı, ekrandaki "Tamamı" gibi programın kendi hesap ucundan (POST /api/workspace/invoices/calc) okunur.
//
// Çıkış kodu: 0 koşu tamam (okuma hatası yok) · 1 koşucu/okuma hatası (koşu kanıt sayılmaz) · 2 senaryo geçersiz ya da çalışmadı.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_PASSWORD, startTestServer } from "../helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DIL = "destekofis-senaryo/1";

// ---------- Senaryo değerleri → program değerleri ----------
const ROLE = { yonetici: "admin", muhasebe: "muhasebe", personel: "personel" };
const ACCOUNT_KIND = { vadesiz: "demand", ticari: "commercial", vadeli: "time", diger: "other", kurumsal_kart: "card", kredi: "loan" };
const PARTY_TYPE = { musteri: "customer", tedarikci: "supplier" };
const METHOD = { nakit: "cash", havale: "bank", kart: "card" };
const POLICY_IN = { uyar: "warn", engelle: "block", kontrol_yok: "off" };
const POLICY_OUT = { warn: "uyar", block: "engelle", off: "kontrol_yok" };
const FEE_TAX = { bsmv_dahil: "bsmv_incl", bsmv_haric: "bsmv_excl", yok: "none", kdv_dahil: "vat_incl", kdv_haric: "vat_excl" };
const FEE_TYPE = { EFT: "eft", FAST: "fast", Havale: "havale", SWIFT: "swift", "Hesap İşletim": "hesap-isletim", "Döviz İşlem": "doviz-islem", "Diğer": "diger" };
const EXPENSE = { "Banka Masrafları": "bank" };
const CASH_DIRECTION = { bankadan_kasaya: "to-cash", kasadan_bankaya: "to-bank" };
const SUBBED_MAINS = new Set(["102", "108", "300", "309"]);
// Kurumsal kartla ödemede kart hesabı: programın modül uçları (cari ödeme, fatura peşini) 2.1.0'da hesabı yalnız havale/EFT yolunda bağlar
// (lib/bank/module-ref.mjs pickRef: "Yol havale değilse ''"); gönderilen bankAccountId kart yolunda yok sayılır. Koşucu yine gönderir.
const CARD_NOTE = "Kart yolunda hesap seçimi: koşucu bankAccountId'yi gönderdi; programın modül ucu kurumsal kart hesabını bağlamıyor (yalnız havale/EFT bağlanır), satır hesapsız kart yolu olarak yazılır.";

// ---------- Senaryo denetimi (§13) ----------
const COMMON = ["id", "islem", "tarih", "kullanici", "ad", "istekKimligi", "benzerOnay", "yineDeKaydet", "ayniAnda", "not"];
const AMOUNT_FIELDS = new Set(["acilisBakiyesi", "tutar", "ucret", "brut", "anapara", "faiz", "birimFiyat"]);
const FIELDS = {
  saat: ["bugun"],
  ayar: ["kasaEksiBakiye", "benzerIslemUyarisi"],
  donem_kilidi: ["kilitTarihi"],
  hesap_ac: ["banka", "hesapAdi", "tur", "paraBirimi", "kod", "iban", "acilisTarihi", "acilisBakiyesi", "bakiyeDogrulandi", "kmhLimiti", "kartLimiti"],
  hesap_durum: ["hesap", "durum"],
  hesap_eksi_politika: ["hesap", "politika"],
  acilis_duzelt: ["hesap", "acilisTarihi", "acilisBakiyesi", "bakiyeDogrulandi"],
  kasa_acilis: ["tutar"],
  kasa_hareket: ["yon", "tutar", "aciklama"],
  cari_ac: ["unvan", "tur", "iban"],
  urun_ac: ["urunAdi", "birim"],
  stok_giris: ["urun", "miktar"],
  fatura: ["tur", "cari", "kalemler", "odeme"],
  iade: ["asilFatura", "kalemler", "geri"],
  cari_tahsilat: ["cari", "tutar", "yol", "hesap", "kapatilacakFatura"],
  cari_odeme: ["cari", "tutar", "yol", "hesap", "kapatilacakFatura"],
  taksit_tahsilat: ["kart", "tutar", "yol", "hesap", "taksitNo"],
  kasa_banka: ["yon", "hesap", "tutar"],
  transfer: ["kaynak", "hedef", "tutar", "ucret", "ucretVergi"],
  banka_masraf: ["hesap", "tutar", "masrafTuru", "vergi", "saglayici", "fatura", "kdvOrani"],
  faiz_geliri: ["hesap", "brut", "stopajOrani"],
  faiz_gideri: ["hesap", "tutar"],
  diger_gelir: ["hesap", "tutar"],
  diger_gider: ["hesap", "tutar"],
  kart_borcu_odeme: ["kaynak", "kart", "tutar"],
  kredi_kullanim: ["kredi", "hedef", "tutar"],
  kredi_odeme: ["kredi", "kaynak", "anapara", "faiz"],
  ters_kayit: ["hedef"],
  sil: ["hedef"],
  kontrol: ["planMetni", "planBeklenen"],
};
/** İşlem → hangi alanlar hangi türde takma ad anar (denetim ve atlama için). */
const REFS = {
  hesap_durum: { hesap: "hesap" },
  hesap_eksi_politika: { hesap: "hesap" },
  acilis_duzelt: { hesap: "hesap" },
  stok_giris: { urun: "urun" },
  fatura: { cari: "cari" },
  iade: { asilFatura: "fatura" },
  cari_tahsilat: { cari: "cari", hesap: "hesap", kapatilacakFatura: "fatura" },
  cari_odeme: { cari: "cari", hesap: "hesap", kapatilacakFatura: "fatura" },
  taksit_tahsilat: { kart: "taksit", hesap: "hesap" },
  kasa_banka: { hesap: "hesap" },
  transfer: { kaynak: "hesap", hedef: "hesap" },
  banka_masraf: { hesap: "hesap", saglayici: "cari" },
  faiz_geliri: { hesap: "hesap" },
  faiz_gideri: { hesap: "hesap" },
  diger_gelir: { hesap: "hesap" },
  diger_gider: { hesap: "hesap" },
  kart_borcu_odeme: { kaynak: "hesap", kart: "hesap" },
  kredi_kullanim: { kredi: "hesap", hedef: "hesap" },
  kredi_odeme: { kredi: "hesap", kaynak: "hesap" },
  ters_kayit: { hedef: "hareket" },
  sil: { hedef: "hareket" },
};
/** `ad` alanı hangi tür varlık tanımlar. */
const DEFINES = {
  hesap_ac: "hesap", cari_ac: "cari", urun_ac: "urun", fatura: "fatura", iade: "fatura",
  cari_tahsilat: "hareket", cari_odeme: "hareket", taksit_tahsilat: "hareket", kasa_hareket: "hareket", kasa_banka: "hareket",
  transfer: "hareket", banka_masraf: "hareket", faiz_geliri: "hareket", faiz_gideri: "hareket", diger_gelir: "hareket", diger_gider: "hareket",
  kart_borcu_odeme: "hareket", kredi_kullanim: "hareket", kredi_odeme: "hareket", ters_kayit: "hareket",
};
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ALIAS_RE = /^[A-Z][A-Z0-9_]{0,15}$/;
const AMOUNT_RE = /^[0-9]{1,13}(,[0-9]{1,2})?$/;
const SIGNED_AMOUNT_RE = /^-?[0-9]{1,13}(,[0-9]{1,2})?$/;
const RATE_RE = /^[0-9]{1,3}(,[0-9]{1,2})?$/;
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function isoOf(value) {
  const match = DATE_RE.exec(String(value ?? ""));
  if (!match) return "";
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return "";
  return `${y}-${m}-${d}`;
}

function validate(scenario, fileName) {
  const errors = [];
  const err = message => errors.push(message);
  if (!scenario || typeof scenario !== "object") return ["Senaryo JSON nesnesi değil."];
  if (scenario.dil !== DIL) err(`dil "${DIL}" olmalı (${scenario.dil}).`);
  const base = path.basename(fileName).replace(/\.json$/, "");
  if (scenario.ad !== base) err(`ad dosya adıyla aynı olmalı (ad "${scenario.ad}", dosya "${base}").`);
  const start = scenario.baslangic || {};
  if (!isoOf(start.bugun)) err("baslangic.bugun geçerli bir gg.aa.yyyy tarihi değil.");
  if (start.sirket !== "bos") err('baslangic.sirket yalnız "bos" olabilir.');
  const users = start.kullanicilar || {};
  for (const [alias, role] of Object.entries(users)) {
    if (!ALIAS_RE.test(alias)) err(`kullanıcı takma adı biçimsiz: ${alias}`);
    if (!ROLE[role]) err(`kullanıcı rolü tanınmadı: ${alias} → ${role}`);
  }
  if (users.Y && users.Y !== "yonetici") err("Y'nin rolü yonetici olmalı.");
  const settings = start.ayarlar || {};
  for (const key of Object.keys(settings)) if (!["kasaEksiBakiye", "benzerIslemUyarisi"].includes(key)) err(`baslangic.ayarlar bilinmeyen alan: ${key}`);
  if (settings.kasaEksiBakiye !== undefined && !POLICY_IN[settings.kasaEksiBakiye]) err("baslangic.ayarlar.kasaEksiBakiye uyar/engelle/kontrol_yok olmalı.");
  if (settings.benzerIslemUyarisi !== undefined && !["acik", "kapali"].includes(settings.benzerIslemUyarisi)) err("baslangic.ayarlar.benzerIslemUyarisi acik/kapali olmalı.");
  if (!Array.isArray(scenario.adimlar)) return [...errors, "adimlar dizi olmalı."];
  const ids = new Set();
  const aliases = new Map(); // ad → tür
  let today = isoOf(start.bugun);
  let group = null;
  let groupSize = 0;
  const amountOk = (step, field, { signed = false, required = true } = {}) => {
    const raw = step[`${field}Ham`];
    const value = step[field];
    if (raw !== undefined) {
      if (typeof raw !== "string") err(`${step.id}: ${field}Ham metin olmalı.`);
      if (value !== undefined) err(`${step.id}: ${field} ile ${field}Ham birlikte yazılmaz.`);
      return;
    }
    if (value === undefined) {
      if (required) err(`${step.id}: ${field} gerekli.`);
      return;
    }
    if (typeof value !== "string" || !(signed ? SIGNED_AMOUNT_RE : AMOUNT_RE).test(value)) err(`${step.id}: ${field} tutar biçiminde değil (${value}).`);
  };
  const refOk = (step, field, kind) => {
    const alias = step[field];
    if (alias === undefined) return;
    if (!ALIAS_RE.test(String(alias)) || !aliases.has(alias)) return err(`${step.id}: ${field} "${alias}" önceki bir adımda tanımlı değil.`);
    if (aliases.get(alias) !== kind) err(`${step.id}: ${field} "${alias}" ${kind} değil (${aliases.get(alias)}).`);
  };
  const define = (step, alias, kind) => {
    if (!ALIAS_RE.test(String(alias))) return err(`${step.id}: takma ad biçimsiz: ${alias}`);
    if (aliases.has(alias)) return err(`${step.id}: takma ad iki kez tanımlandı: ${alias}`);
    aliases.set(alias, kind);
  };
  for (const step of scenario.adimlar) {
    if (!step || typeof step !== "object") {
      err("adım nesne değil.");
      continue;
    }
    if (!ID_RE.test(String(step.id ?? ""))) err(`adım id biçimsiz: ${step.id}`);
    if (ids.has(step.id)) err(`adım id tekil değil: ${step.id}`);
    ids.add(step.id);
    const allowed = FIELDS[step.islem];
    if (!allowed) {
      err(`${step.id}: bilinmeyen işlem ${step.islem}`);
      continue;
    }
    for (const key of Object.keys(step)) {
      const plain = key.endsWith("Ham") ? key.slice(0, -3) : key;
      const known = COMMON.includes(key) || allowed.includes(key) || (key.endsWith("Ham") && AMOUNT_FIELDS.has(plain) && allowed.includes(plain));
      if (!known) err(`${step.id}: bilinmeyen alan ${key}`);
    }
    if (step.tarih !== undefined && !isoOf(step.tarih)) err(`${step.id}: tarih geçersiz (${step.tarih}).`);
    if (step.kullanici !== undefined && step.kullanici !== "Y" && !users[step.kullanici]) err(`${step.id}: kullanıcı tanımsız: ${step.kullanici}`);
    if (step.ayniAnda !== undefined) {
      if (step.islem === "kontrol" || step.islem === "saat") err(`${step.id}: ${step.islem} eşzamanlı grupta olmaz.`);
      if (group === step.ayniAnda) groupSize += 1;
      else {
        group = step.ayniAnda;
        groupSize = 1;
      }
      if (groupSize > 4) err(`${step.id}: ayniAnda grubu 4 adımı aşıyor.`);
    } else {
      group = null;
      groupSize = 0;
    }
    for (const [field, kind] of Object.entries(REFS[step.islem] || {})) refOk(step, field, kind);
    switch (step.islem) {
      case "saat": {
        const next = isoOf(step.bugun);
        if (!next) err(`${step.id}: bugun geçersiz.`);
        else if (next < today) err(`${step.id}: saat geri gidemez (${step.bugun}).`);
        else today = next;
        break;
      }
      case "hesap_ac":
        if (!ACCOUNT_KIND[step.tur]) err(`${step.id}: tur tanınmadı (${step.tur}).`);
        if (step.paraBirimi !== "TRY") err(`${step.id}: paraBirimi yalnız TRY.`);
        if (!isoOf(step.acilisTarihi)) err(`${step.id}: acilisTarihi geçersiz.`);
        amountOk(step, "acilisBakiyesi", { signed: ["vadesiz", "ticari", "diger"].includes(step.tur) });
        break;
      case "acilis_duzelt":
        if (!isoOf(step.acilisTarihi)) err(`${step.id}: acilisTarihi geçersiz.`);
        amountOk(step, "acilisBakiyesi", { signed: true });
        break;
      case "hesap_durum":
        if (!["pasif", "aktif"].includes(step.durum)) err(`${step.id}: durum pasif/aktif olmalı.`);
        break;
      case "hesap_eksi_politika":
      case "ayar":
        if (step.islem === "hesap_eksi_politika" && !POLICY_IN[step.politika]) err(`${step.id}: politika tanınmadı.`);
        if (step.islem === "ayar" && step.kasaEksiBakiye !== undefined && !POLICY_IN[step.kasaEksiBakiye]) err(`${step.id}: kasaEksiBakiye tanınmadı.`);
        if (step.islem === "ayar" && step.benzerIslemUyarisi !== undefined && !["acik", "kapali"].includes(step.benzerIslemUyarisi)) err(`${step.id}: benzerIslemUyarisi tanınmadı.`);
        break;
      case "donem_kilidi":
        if (!isoOf(step.kilitTarihi)) err(`${step.id}: kilitTarihi geçersiz.`);
        break;
      case "kasa_acilis":
        amountOk(step, "tutar");
        break;
      case "kasa_hareket":
        if (!["giris", "cikis"].includes(step.yon)) err(`${step.id}: yon giris/cikis olmalı.`);
        amountOk(step, "tutar");
        break;
      case "cari_ac":
        if (!PARTY_TYPE[step.tur]) err(`${step.id}: tur musteri/tedarikci olmalı.`);
        break;
      case "urun_ac":
        if (step.birim !== "Adet") err(`${step.id}: birim yalnız Adet.`);
        break;
      case "stok_giris":
        if (!Number.isInteger(step.miktar) || step.miktar < 1) err(`${step.id}: miktar tamsayı ≥ 1 olmalı.`);
        break;
      case "fatura": {
        if (!["satis", "alis"].includes(step.tur)) err(`${step.id}: tur satis/alis olmalı.`);
        if (!Array.isArray(step.kalemler) || !step.kalemler.length) err(`${step.id}: en az bir kalem.`);
        for (const [index, line] of (step.kalemler || []).entries()) {
          const keys = ["urun", "hizmet", "miktar", "birimFiyat", "birimFiyatHam", "kdvOrani", "kdvDahil", "iskontoOrani", "giderTuru"];
          for (const key of Object.keys(line || {})) if (!keys.includes(key)) err(`${step.id}: ${index + 1}. kalemde bilinmeyen alan ${key}`);
          if (line?.urun !== undefined) refOk({ id: step.id, urun: line.urun }, "urun", "urun");
          else if (typeof line?.hizmet !== "string" || !line.hizmet) err(`${step.id}: ${index + 1}. kalemde urun ya da hizmet gerekli.`);
          if (!Number.isInteger(line?.miktar) || line.miktar < 1) err(`${step.id}: ${index + 1}. kalem miktarı tamsayı ≥ 1.`);
          if (![1, 10, 20].includes(line?.kdvOrani)) err(`${step.id}: ${index + 1}. kalem kdvOrani 1/10/20.`);
          if (typeof line?.kdvDahil !== "boolean") err(`${step.id}: ${index + 1}. kalem kdvDahil true/false.`);
          if (line?.iskontoOrani !== undefined && !RATE_RE.test(String(line.iskontoOrani))) err(`${step.id}: ${index + 1}. kalem iskontoOrani biçimsiz.`);
          amountOk({ id: `${step.id}/${index + 1}`, ...line }, "birimFiyat");
          if (line?.giderTuru !== undefined && !EXPENSE[line.giderTuru]) err(`${step.id}: giderTuru yalnız "Banka Masrafları".`);
        }
        const pay = step.odeme || {};
        for (const key of Object.keys(pay)) if (!["pesin", "taksit"].includes(key)) err(`${step.id}: odeme bilinmeyen alan ${key}`);
        const cash = Array.isArray(pay.pesin) ? pay.pesin : pay.pesin === undefined ? [] : null;
        if (!cash) err(`${step.id}: odeme.pesin dizi olmalı.`);
        if ((cash || []).length > 3) err(`${step.id}: en çok 3 peşin satır.`);
        for (const row of cash || []) {
          if (!METHOD[row?.yol]) err(`${step.id}: peşin yol tanınmadı.`);
          if (row?.yol === "kart" && step.tur !== "alis") err(`${step.id}: kart yolu yalnız alışta.`);
          if (row?.yol === "nakit" && row?.hesap !== undefined) err(`${step.id}: nakit satırda hesap verilmez.`);
          if (row?.tutar !== "tamami" && !AMOUNT_RE.test(String(row?.tutar ?? ""))) err(`${step.id}: peşin tutar biçimsiz.`);
          if (row?.tutar === "tamami" && pay.taksit) err(`${step.id}: "tamami" taksitle birlikte kullanılamaz.`);
          if (row?.hesap !== undefined) refOk({ id: step.id, hesap: row.hesap }, "hesap", "hesap");
        }
        if (pay.taksit) {
          if (step.tur !== "satis") err(`${step.id}: taksit yalnız satışta.`);
          if (!Number.isInteger(pay.taksit.sayi) || pay.taksit.sayi < 1) err(`${step.id}: taksit sayisi ≥ 1.`);
          if (pay.taksit.ilkVade !== undefined && !isoOf(pay.taksit.ilkVade)) err(`${step.id}: ilkVade geçersiz.`);
          define(step, pay.taksit.ad, "taksit");
        }
        break;
      }
      case "iade":
        if (!Array.isArray(step.kalemler) || !step.kalemler.length) err(`${step.id}: en az bir iade kalemi.`);
        if (!["acik", "nakit", "havale"].includes(step.geri?.yol)) err(`${step.id}: geri.yol acik/nakit/havale.`);
        if (step.geri?.hesap !== undefined) refOk({ id: step.id, hesap: step.geri.hesap }, "hesap", "hesap");
        break;
      case "cari_tahsilat":
      case "cari_odeme":
      case "taksit_tahsilat":
        amountOk(step, "tutar");
        if (!METHOD[step.yol]) err(`${step.id}: yol tanınmadı.`);
        if (step.islem !== "cari_odeme" && step.yol === "kart") err(`${step.id}: kart yolu yalnız ödemede.`);
        if (step.yol === "nakit" && step.hesap !== undefined) err(`${step.id}: nakit yolda hesap verilmez.`);
        break;
      case "kasa_banka":
        if (!CASH_DIRECTION[step.yon]) err(`${step.id}: yon tanınmadı.`);
        amountOk(step, "tutar");
        break;
      case "transfer":
        amountOk(step, "tutar");
        amountOk(step, "ucret", { required: false });
        if ((step.ucret !== undefined || step.ucretHam !== undefined) && !["bsmv_haric", "bsmv_dahil", "yok"].includes(step.ucretVergi)) err(`${step.id}: ucret varsa ucretVergi gerekli.`);
        break;
      case "banka_masraf":
        amountOk(step, "tutar");
        if (!FEE_TYPE[step.masrafTuru]) err(`${step.id}: masrafTuru tanınmadı.`);
        if (!FEE_TAX[step.vergi]) err(`${step.id}: vergi tanınmadı.`);
        if (["kdv_dahil", "kdv_haric"].includes(step.vergi)) {
          if (step.fatura === undefined) err(`${step.id}: KDV kipinde fatura (takma ad) gerekli.`);
          else define(step, step.fatura, "fatura");
        }
        break;
      case "faiz_geliri":
        amountOk(step, "brut");
        if (!RATE_RE.test(String(step.stopajOrani ?? ""))) err(`${step.id}: stopajOrani biçimsiz.`);
        break;
      case "faiz_gideri":
      case "diger_gelir":
      case "diger_gider":
      case "kart_borcu_odeme":
      case "kredi_kullanim":
        amountOk(step, "tutar");
        break;
      case "kredi_odeme":
        amountOk(step, "anapara");
        amountOk(step, "faiz", { required: false });
        break;
      default:
        break;
    }
    if (step.ad !== undefined && DEFINES[step.islem]) define(step, step.ad, DEFINES[step.islem]);
    else if (step.ad !== undefined && !DEFINES[step.islem]) err(`${step.id}: ${step.islem} takma ad tanımlamaz.`);
  }
  return errors;
}

// ---------- Yardımcılar ----------
/** Programın TL sayısı → kuruş tamsayı (biçim dönüşümü; 15 anlamlı basamakla kayan nokta artığı silinir). */
function kurus(value) {
  const number = Number(value) || 0;
  const cents = Math.round(Number((number * 100).toPrecision(15)));
  return cents === 0 ? 0 : cents;
}
/** Senaryo tutar metni → kuruş ("20000,5" → 2000050). Yalnız "tamami" hesabındaki öbür peşin satırlar için. */
function textKurus(value) {
  const [whole, frac = ""] = String(value).split(",");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
const kurusText = cents => `${Math.trunc(cents / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const bakiyeSutunu = cents => ({ borc: Math.max(0, cents), alacak: Math.max(0, -cents) });
/**
 * JSON, anahtarlar sıralı ve iki boşluk girintili (§2: Python json.dumps(sort_keys=True, indent=2) düzeni). JSON.stringify tamsayı
 * görünümlü anahtarları ("100", "120") nesnenin başına aldığı için sıralama burada yazılır ("100" < "102.01" < "120").
 */
function sortedJson(value, indent = "") {
  const inner = `${indent}  `;
  if (Array.isArray(value)) return value.length ? `[\n${value.map(item => inner + sortedJson(item, inner)).join(",\n")}\n${indent}]` : "[]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    return keys.length ? `{\n${keys.map(key => `${inner}${JSON.stringify(key)}: ${sortedJson(value[key], inner)}`).join(",\n")}\n${indent}}` : "{}";
  }
  return JSON.stringify(value ?? null);
}
const amountOf = (step, field) => (step[`${field}Ham`] !== undefined ? step[`${field}Ham`] : step[field]);
const rateText = value => (value === undefined ? undefined : String(value));

function gitInfo() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
    return { commit, degisikDosyaSayisi: dirty.length };
  } catch {
    return { commit: "bilinmiyor", degisikDosyaSayisi: null };
  }
}

// ---------- Koşu ----------
async function run(scenarioPath, outPath) {
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  const errors = validate(scenario, scenarioPath);
  if (errors.length) {
    process.stderr.write(`Senaryo geçersiz (${errors.length}):\n${errors.map(line => `  - ${line}`).join("\n")}\n`);
    return 2;
  }
  const start = scenario.baslangic;
  let today = isoOf(start.bugun);
  const server = await startTestServer({ now: { time: today } });
  const uses = new Map(); // "YÖNTEM şablon" → { adimlar: Set(işlem) }
  const out = {
    retler: [],
    retAyrinti: [],
    yinelenenler: [],
    atlananlar: [],
    atlamaAyrinti: [],
    eslenemeyenler: [],
    araDurumlar: {},
    okumaHatalari: [],
    kaynakFarklari: [],
  };
  const registry = new Map(); // takma ad → { tur, id, ... }
  const failedAliases = new Map(); // tanımlanamamış takma ad → adım id
  const clients = new Map();
  try {
    // ---------- HTTP ----------
    async function http(client, method, tpl, params, body, { headers = {}, islem = "okuma" } = {}) {
      let url = tpl;
      for (const value of params || []) url = url.replace(/:[a-zA-Z]+/, encodeURIComponent(value));
      const key = `${method} ${tpl.split("?")[0]}`;
      if (!uses.has(key)) uses.set(key, new Set());
      uses.get(key).add(islem);
      const response = method === "GET" ? await client.get(url, headers) : method === "DELETE" ? await client.del(url, headers) : method === "PUT" ? await client.put(url, body, headers) : await client.post(url, body, headers);
      const payload = response.data;
      const okBody = payload && typeof payload === "object" && payload.ok === true;
      return {
        status: response.status,
        ok: response.status === 200 && okBody,
        data: okBody ? payload.data : payload,
        code: payload && typeof payload === "object" ? payload.code ?? null : null,
        error: payload && typeof payload === "object" ? payload.error ?? "" : String(payload || "").slice(0, 300),
      };
    }
    // ---------- Kullanıcılar ----------
    const admin = server.client();
    const login = await admin.login("admin", ADMIN_PASSWORD);
    if (login.status !== 200) throw new Error(`Yönetici girişi başarısız: ${login.status}`);
    clients.set("Y", admin);
    for (const [alias, role] of Object.entries(start.kullanicilar || {})) {
      if (alias === "Y") continue;
      const username = `kosucu-${alias.toLowerCase()}`;
      const password = "Kosucu-Parola-2026!";
      const made = await http(admin, "POST", "/api/admin/users", [], { username, name: `Koşucu ${alias}`, role: ROLE[role], password, mustChangePassword: false }, { islem: "kullanici" });
      if (!made.ok) throw new Error(`Kullanıcı açılamadı (${alias}, ${role}): ${made.status} ${made.error}`);
      const client = server.client();
      const loggedIn = await client.login(username, password);
      if (loggedIn.status !== 200) throw new Error(`Kullanıcı girişi başarısız (${alias}).`);
      clients.set(alias, client);
    }
    const Y = () => clients.get("Y");

    // ---------- Başlangıç ayarları ----------
    const settingSteps = [];
    if (start.ayarlar?.kasaEksiBakiye) settingSteps.push(["PUT", "/api/admin/negative-policy", { cash: POLICY_IN[start.ayarlar.kasaEksiBakiye] }]);
    if (start.ayarlar?.benzerIslemUyarisi) settingSteps.push(["PUT", "/api/workspace/bank/settings", { values: { similar: { enabled: start.ayarlar.benzerIslemUyarisi === "acik" } } }]);
    for (const [method, tpl, body] of settingSteps) {
      const result = await http(Y(), method, tpl, [], body, { islem: "baslangic" });
      if (!result.ok) throw new Error(`Başlangıç ayarı uygulanamadı (${tpl}): ${result.status} ${result.error}`);
    }

    // ---------- Okuma (programın ekran/rapor uçları) ----------
    const aliasOf = (kind, id) => [...registry.entries()].find(([, rec]) => rec.tur === kind && rec.id === id)?.[0];
    const aliasesOf = kind => [...registry.entries()].filter(([, rec]) => rec.tur === kind);
    async function read(label) {
      const errs = [];
      const diffs = [];
      const must = async (tpl, params = []) => {
        const result = await http(Y(), "GET", tpl, params, undefined, { islem: "okuma" });
        if (!result.ok) {
          errs.push(`${label}: ${tpl} → ${result.status} ${result.error}`);
          return null;
        }
        return result.data;
      };
      const state = { mizan: {}, bankaHesaplari: {}, kasa: null, cariler: {}, stok: {}, faturalar: {}, taksitKartlari: {}, hesapKodlari: {}, eksiBakiyeDenetimi: {}, ozet: {} };
      // Mizan: Ana Defter mizanı (ana hesaplar) + Alt Hesap Mizanı (102/108/300/309 yaprakları).
      const ledger = await must("/api/workspace/ledger");
      const sub = await must("/api/workspace/bank/sub-trial");
      if (ledger && sub) {
        const subMain = new Map();
        for (const row of sub.rows || []) {
          const cents = kurus(row.balance);
          state.mizan[row.sub] = bakiyeSutunu(cents);
          subMain.set(row.account, (subMain.get(row.account) || 0) + cents);
        }
        for (const row of ledger.trial?.accounts || []) {
          const cents = kurus(row.balance);
          if (SUBBED_MAINS.has(row.code)) {
            const subTotal = subMain.get(row.code);
            if (subTotal === undefined && cents !== 0) errs.push(`${label}: Ana Defter ${row.code} = ${cents} kuruş ama Alt Hesap Mizanı'nda alt hesabı yok.`);
            else if (subTotal !== undefined && subTotal !== cents) diffs.push({ alan: `mizan.${row.code}`, kaynakA: "Ana Defter mizanı", degerA: cents, kaynakB: "Alt Hesap Mizanı (alt hesapların toplamı)", degerB: subTotal });
            continue;
          }
          state.mizan[row.code] = bakiyeSutunu(cents);
        }
        for (const main of sub.mains || []) if (main.ok === false) diffs.push({ alan: `mizan.${main.account}`, kaynakA: "Alt Hesap Mizanı ana hesap", degerA: kurus(main.balance), kaynakB: "Alt Hesap Mizanı alt hesap toplamı", degerB: kurus(main.subTotal) });
        if (ledger.trial && ledger.trial.balanced === false) errs.push(`${label}: Ana Defter mizanı dengesiz (unbalanced ${ledger.trial.unbalanced}).`);
      }
      // Banka hesapları: Banka → Hesaplar (bakiye, alt hesap kodu, etkin eksi bakiye politikası).
      const accounts = await must("/api/workspace/bank/accounts?status=all");
      if (accounts) {
        const subRows = new Map((sub?.rows || []).map(row => [row.sub, kurus(row.balance)]));
        for (const [alias, rec] of aliasesOf("hesap")) {
          const view = (accounts.accounts || []).find(item => item.id === rec.id);
          if (!view) {
            errs.push(`${label}: ${alias} hesabı Banka → Hesaplar listesinde yok.`);
            continue;
          }
          state.bankaHesaplari[alias] = Number(view.balanceMinor) || 0;
          state.hesapKodlari[alias] = view.glSub;
          state.eksiBakiyeDenetimi[alias] = POLICY_OUT[view.policy] || `tanınmadı:${view.policy}`;
          if (subRows.has(view.glSub) && subRows.get(view.glSub) !== state.bankaHesaplari[alias]) diffs.push({ alan: `bankaHesaplari.${alias}`, kaynakA: "Banka → Hesaplar (balanceMinor)", degerA: state.bankaHesaplari[alias], kaynakB: `Alt Hesap Mizanı ${view.glSub}`, degerB: subRows.get(view.glSub) });
        }
      }
      // Kasa: Kasa penceresi (yalnız nakit); ANLIK DURUM ile karşılaştırılır.
      const cash = await must("/api/workspace/cash");
      const overview = await must("/api/workspace/overview");
      if (cash) state.kasa = kurus(cash.totals?.balance);
      if (cash && overview) {
        const all = kurus(overview.cash?.allEntries);
        if (all !== state.kasa) diffs.push({ alan: "kasa", kaynakA: "Kasa penceresi (totals.balance)", degerA: state.kasa, kaynakB: "ANLIK DURUM Nakit Kasa (tüm hareketler)", degerB: all });
      }
      // Cariler: Cari penceresi listesi (tüm cariler; bakiye borçlu +).
      const parties = await must("/api/workspace/accounts?status=all&limit=5000");
      if (parties) {
        for (const [alias, rec] of aliasesOf("cari")) {
          const row = (parties.accounts || []).find(item => item.id === rec.id);
          if (!row) errs.push(`${label}: ${alias} carisi Cari listesinde yok.`);
          else state.cariler[alias] = kurus(row.balance);
        }
      }
      // Stok: Stok penceresi listesi.
      const stock = await must("/api/workspace/stock?limit=5000");
      if (stock) {
        for (const [alias, rec] of aliasesOf("urun")) {
          const row = (stock.items || []).find(item => item.id === rec.id);
          if (!row) errs.push(`${label}: ${alias} ürünü Stok listesinde yok.`);
          else state.stok[alias] = Number(row.qty);
        }
      }
      // Faturalar: fatura kartı (Ödenecek Tutar, Matrah, KDV, Açık).
      for (const [alias, rec] of aliasesOf("fatura")) {
        const card = await must("/api/workspace/invoices/:id", [rec.id]);
        if (!card) continue;
        state.faturalar[alias] = { toplam: kurus(card.payableTotal), matrah: kurus(card.netTotal), kdv: kurus(card.vatTotal), acik: kurus(card.open) };
        if (kurus(card.grossTotal) !== kurus(card.payableTotal)) diffs.push({ alan: `faturalar.${alias}.toplam`, kaynakA: "fatura kartı Ödenecek Tutar (payableTotal)", degerA: kurus(card.payableTotal), kaynakB: "fatura kartı Genel Toplam (grossTotal)", degerB: kurus(card.grossTotal) });
      }
      // Taksit kartları: Taksitler penceresi (tüm durumlar) — Toplam, Ödenen, Kalan.
      if (aliasesOf("taksit").length) {
        const plans = await must("/api/workspace/plans?status=all");
        for (const [alias, rec] of aliasesOf("taksit")) {
          const row = (plans?.plans || []).find(item => item.id === rec.id);
          if (!row) {
            errs.push(`${label}: ${alias} taksit kartı Taksitler listesinde yok.`);
            continue;
          }
          state.taksitKartlari[alias] = { toplam: kurus(row.totals.total), odenen: kurus(row.totals.paid), kalan: kurus(row.totals.remaining) };
        }
      }
      // Özet: Banka Genel Bakış (K10) + ANLIK DURUM.
      const summary = await must("/api/workspace/bank/summary");
      if (summary) {
        state.ozet.gercekBanka = Number(summary.realBank?.minor) || 0;
        state.ozet.hesabiAtanmamis = Number(summary.unassigned?.totalMinor) || 0;
        state.ozet.kartVeKrediBorcu = Number(summary.debt?.totalMinor) || 0;
      }
      if (overview) {
        const bank = overview.cash?.bank || {};
        const cashToday = kurus(overview.cash?.balance);
        const realBank = kurus(bank.balance);
        state.ozet.kasaVeGercekBanka = cashToday + realBank;
        if (summary) {
          if (realBank !== state.ozet.gercekBanka) diffs.push({ alan: "ozet.gercekBanka", kaynakA: "Banka Genel Bakış", degerA: state.ozet.gercekBanka, kaynakB: "ANLIK DURUM Gerçek Banka", degerB: realBank });
          if (kurus(bank.unassigned?.total) !== state.ozet.hesabiAtanmamis) diffs.push({ alan: "ozet.hesabiAtanmamis", kaynakA: "Banka Genel Bakış", degerA: state.ozet.hesabiAtanmamis, kaynakB: "ANLIK DURUM Hesabı Atanmamış", degerB: kurus(bank.unassigned?.total) });
          if (kurus(bank.debt?.total) !== state.ozet.kartVeKrediBorcu) diffs.push({ alan: "ozet.kartVeKrediBorcu", kaynakA: "Banka Genel Bakış", degerA: state.ozet.kartVeKrediBorcu, kaynakB: "ANLIK DURUM Kart ve Kredi Borcu", degerB: kurus(bank.debt?.total) });
        }
        if (state.kasa !== null && cashToday !== state.kasa) diffs.push({ alan: "ozet.kasaVeGercekBanka (Kasa terimi)", kaynakA: "Kasa penceresi", degerA: state.kasa, kaynakB: "ANLIK DURUM Nakit Kasa (bugün)", degerB: cashToday });
      }
      if (state.kasa === null) delete state.kasa;
      out.okumaHatalari.push(...errs);
      out.kaynakFarklari.push(...diffs.map(item => ({ okuma: label, ...item })));
      return state;
    }

    // ---------- Bank movement olayları (Ters Kaydet hedefi modül hareketiyse olayını bulmak için) ----------
    const reverseTargets = new Set(scenario.adimlar.filter(step => step.islem === "ters_kayit").map(step => step.hedef));
    async function eventIds() {
      const ids = new Set();
      let cursor = "";
      for (let page = 0; page < 100; page += 1) {
        const result = await http(Y(), "GET", `/api/workspace/bank/movements?status=all&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, [], undefined, { islem: "okuma" });
        if (!result.ok) break;
        for (const row of result.data.rows || []) ids.add(row.eventId);
        if (!result.data.nextCursor) break;
        cursor = result.data.nextCursor;
      }
      return ids;
    }

    // ---------- Adımlar ----------
    const clientOf = step => clients.get(step.kullanici || "Y");
    const dateOf = step => (step.tarih ? isoOf(step.tarih) : today);
    // İstek kimliği: senaryodaki etiket → programın kabul ettiği biçimde (ekran gibi 32 onaltılık hane; FORMAT /^[A-Za-z0-9_-]{16,100}$/)
    // belirlenimli kimlik. Aynı etiket aynı kimliği, farklı etiket farklı kimliği verir (formun yeniden gönderilmesi gibi).
    const requestIdOf = label => createHash("sha256").update(`${scenario.ad}|${label}`).digest("hex").slice(0, 32);
    const headersOf = step => (step.istekKimligi !== undefined ? { "x-hof-request": requestIdOf(String(step.istekKimligi)) } : {});
    const flagsOf = step => ({ ...(step.benzerOnay ? { similarOk: true } : {}), ...(step.yineDeKaydet ? { cashForce: true, negativeOk: true } : {}) });
    const deleteFlags = step => (step.yineDeKaydet ? "?cashForce=1&negativeOk=1" : "");
    const idOf = alias => registry.get(alias)?.id;
    const missing = (step, alias) => ({ skip: `${alias} oluşmadı (${failedAliases.get(alias) || "?"} adımı reddedildi ya da eşlenemedi)` });
    /** Adımın andığı takma adlar oluşmuş mu? */
    function referencedMissing(step) {
      const names = [];
      for (const field of Object.keys(REFS[step.islem] || {})) if (step[field] !== undefined) names.push(step[field]);
      if (step.islem === "fatura") {
        for (const line of step.kalemler || []) if (line.urun !== undefined) names.push(line.urun);
        for (const row of step.odeme?.pesin || []) if (row.hesap !== undefined) names.push(row.hesap);
      }
      if (step.islem === "iade" && step.geri?.hesap !== undefined) names.push(step.geri.hesap);
      return names.find(name => !registry.has(name)) || null;
    }
    /** Fatura gövdesi (kalemler + belge düzeyi KDV dahil seçimi). */
    function invoiceLines(step) {
      const flags = [...new Set(step.kalemler.map(line => line.kdvDahil))];
      if (flags.length > 1) return { error: "Programda KDV dahil/hariç seçimi belge düzeyinde (pricesIncludeVat); kalem bazında karışık kdvDahil tek faturada gönderilemez." };
      const lines = step.kalemler.map(line => ({
        ...(line.urun !== undefined ? { itemId: idOf(line.urun) } : { name: line.hizmet }),
        qty: line.miktar,
        unitPrice: amountOf(line, "birimFiyat"),
        vatRate: line.kdvOrani,
        ...(line.iskontoOrani !== undefined ? { discountRate: rateText(line.iskontoOrani) } : {}),
        ...(line.urun === undefined && step.tur === "alis" ? { expenseCode: EXPENSE[line.giderTuru] || "" } : {}),
      }));
      return { lines, pricesIncludeVat: flags[0] === true };
    }
    async function calcPayable(client, body, step) {
      const calc = await http(client, "POST", "/api/workspace/invoices/calc", [], body, { islem: step.islem });
      if (!calc.ok) return { error: calc };
      return { cents: kurus(calc.data.try?.payable ?? calc.data.totals?.payable) };
    }
    const refused = result => ({ ret: { durum: result.status, kod: result.code ?? null, mesaj: result.error || "" } });

    async function execute(step) {
      const client = clientOf(step);
      const headers = headersOf(step);
      const flags = flagsOf(step);
      const date = dateOf(step);
      const opt = { headers, islem: step.islem };
      const lost = referencedMissing(step);
      if (lost) return missing(step, lost);
      switch (step.islem) {
        case "saat": {
          today = isoOf(step.bugun);
          server.clock.set(today);
          return { done: true };
        }
        case "ayar": {
          if (step.kasaEksiBakiye !== undefined) {
            const result = await http(client, "PUT", "/api/admin/negative-policy", [], { cash: POLICY_IN[step.kasaEksiBakiye] }, opt);
            if (!result.ok) return refused(result);
          }
          if (step.benzerIslemUyarisi !== undefined) {
            const result = await http(client, "PUT", "/api/workspace/bank/settings", [], { values: { similar: { enabled: step.benzerIslemUyarisi === "acik" } } }, opt);
            if (!result.ok) return refused(result);
          }
          return { done: true };
        }
        case "donem_kilidi": {
          const result = await http(client, "PUT", "/api/admin/period-lock", [], { lockedUntil: isoOf(step.kilitTarihi) }, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "hesap_ac": {
          const limit = step.kmhLimiti ?? step.kartLimiti;
          const body = {
            bankName: step.banka,
            name: step.hesapAdi,
            kind: ACCOUNT_KIND[step.tur],
            currency: step.paraBirimi,
            ...(step.kod !== undefined ? { code: step.kod } : {}),
            ...(step.iban !== undefined ? { iban: step.iban } : {}),
            ...(limit !== undefined ? { creditLimit: limit } : {}),
            opening: { date: isoOf(step.acilisTarihi), amount: amountOf(step, "acilisBakiyesi"), confirmed: step.bakiyeDogrulandi === true },
          };
          const result = await http(client, "POST", "/api/workspace/bank/accounts", [], body, opt);
          if (!result.ok) return refused(result);
          const id = result.data.replayed ? result.data.refId : result.data.id;
          return { created: { tur: "hesap", id }, replayed: Boolean(result.data.replayed) };
        }
        case "hesap_durum": {
          const result = await http(client, "POST", "/api/workspace/bank/accounts/:id/status", [idOf(step.hesap)], { status: step.durum === "pasif" ? "passive" : "active" }, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "hesap_eksi_politika": {
          const result = await http(client, "PUT", "/api/workspace/bank/accounts/:id", [idOf(step.hesap)], { negativePolicy: POLICY_IN[step.politika] }, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "acilis_duzelt": {
          const body = { date: isoOf(step.acilisTarihi), amount: amountOf(step, "acilisBakiyesi"), ...(step.bakiyeDogrulandi !== undefined ? { confirmed: step.bakiyeDogrulandi === true } : {}) };
          const result = await http(client, "POST", "/api/workspace/bank/accounts/:id/opening", [idOf(step.hesap)], body, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "kasa_acilis": {
          const result = await http(client, "POST", "/api/workspace/cash", [], { kind: "in", amount: amountOf(step, "tutar"), date, description: "Açılış Bakiyesi", method: "cash", ...flags }, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "kasa_hareket": {
          const result = await http(client, "POST", "/api/workspace/cash", [], { kind: step.yon === "giris" ? "in" : "out", amount: amountOf(step, "tutar"), date, description: step.aciklama || (step.yon === "giris" ? "Kasaya Giriş" : "Kasadan Çıkış"), method: "cash", ...flags }, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "kasa", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "cari_ac": {
          const result = await http(client, "POST", "/api/workspace/accounts", [], { name: step.unvan, type: PARTY_TYPE[step.tur], ...(step.iban !== undefined ? { iban: step.iban } : {}) }, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "cari", id: result.data.id } };
        }
        case "urun_ac": {
          const result = await http(client, "POST", "/api/workspace/stock", [], { name: step.urunAdi, unit: step.birim, kind: "product" }, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "urun", id: result.data.id } };
        }
        case "stok_giris": {
          const result = await http(client, "POST", "/api/workspace/stock/:id/moves", [idOf(step.urun)], { kind: "in", qty: step.miktar, pay: "none", date: today, note: "Parasız stok girişi" }, opt);
          return result.ok ? { done: true } : refused(result);
        }
        case "fatura": {
          const built = invoiceLines(step);
          if (built.error) return { unmapped: built.error };
          const kind = step.tur === "satis" ? "sale" : "purchase";
          const doc = { kind, accountId: idOf(step.cari), issueDate: date, pricesIncludeVat: built.pricesIncludeVat, lines: built.lines, ...(kind === "purchase" ? { number: step.ad } : {}) };
          const rows = step.odeme?.pesin || [];
          const cash = [];
          let whole = null;
          if (rows.some(row => row.tutar === "tamami")) {
            const calc = await calcPayable(client, doc, step);
            if (calc.error) return refused(calc.error);
            whole = calc.cents - rows.filter(row => row.tutar !== "tamami").reduce((sum, row) => sum + textKurus(row.tutar), 0);
          }
          rows.forEach((row, index) => cash.push({ amount: row.tutar === "tamami" ? kurusText(whole) : row.tutar, method: METHOD[row.yol], lineKey: `p${index + 1}`, ...(row.hesap !== undefined ? { bankAccountId: idOf(row.hesap) } : {}) }));
          const taksit = step.odeme?.taksit;
          const first = taksit?.ilkVade ? isoOf(taksit.ilkVade) : (() => {
            // Ekranın varsayılanı (hof-invoices.js "Taksit" seçilince): fatura gününün bir ay sonrası (ayın en çok 28'i).
            const [y, m, d] = date.split("-").map(Number);
            return new Date(Date.UTC(y, m, Math.min(d, 28))).toISOString().slice(0, 10);
          })();
          const payment = { cash, ...(taksit ? { rest: "installments", installments: { count: taksit.sayi, firstDue: first, everyMonths: 1 } } : { rest: "open" }) };
          const result = await http(client, "POST", "/api/workspace/invoices", [], { ...doc, payment, ...flags }, opt);
          if (!result.ok) return refused(result);
          const extra = taksit ? [{ alias: taksit.ad, rec: { tur: "taksit", id: result.data.planId } }] : [];
          if (taksit && !result.data.planId) return { created: { tur: "fatura", id: result.data.id }, extra: [], note: `${taksit.ad}: program faturayı kaydetti ama taksit kartı kimliği (planId) dönmedi.` };
          return { created: { tur: "fatura", id: result.data.id }, extra, replayed: Boolean(result.data.replayed), note: rows.some(row => row.yol === "kart" && row.hesap !== undefined) ? CARD_NOTE : "" };
        }
        case "iade": {
          const original = await http(Y(), "GET", "/api/workspace/invoices/:id", [idOf(step.asilFatura)], undefined, { islem: step.islem });
          if (!original.ok) return refused(original);
          const lines = [];
          for (const item of step.kalemler) {
            const line = original.data.lines?.[Number(item.kalem) - 1];
            if (!line) return { unmapped: `asıl faturada ${item.kalem}. kalem yok (fatura kartında ${original.data.lines?.length || 0} kalem).` };
            lines.push({ originLineId: line.id, qty: item.miktar });
          }
          const kind = original.data.kind === "sale" ? "sale_return" : original.data.kind === "purchase" ? "purchase_return" : "";
          if (!kind) return { unmapped: `asıl fatura satış ya da alış değil (${original.data.kind}).` };
          const doc = { kind, originalId: original.data.id, issueDate: date, lines };
          const cash = [];
          if (step.geri.yol !== "acik") {
            const calc = await calcPayable(client, doc, step);
            if (calc.error) return refused(calc.error);
            cash.push({ amount: kurusText(calc.cents), method: METHOD[step.geri.yol], lineKey: "g1", ...(step.geri.hesap !== undefined ? { bankAccountId: idOf(step.geri.hesap) } : {}) });
          }
          const result = await http(client, "POST", "/api/workspace/invoices", [], { ...doc, payment: { cash }, ...flags }, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "fatura", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "cari_tahsilat":
        case "cari_odeme": {
          const body = {
            kind: step.islem === "cari_tahsilat" ? "in" : "out",
            amount: amountOf(step, "tutar"),
            date,
            method: METHOD[step.yol],
            ...(step.hesap !== undefined ? { bankAccountId: idOf(step.hesap) } : {}),
            ...(step.kapatilacakFatura !== undefined ? { invoiceId: idOf(step.kapatilacakFatura) } : {}),
            ...flags,
          };
          const result = await http(client, "POST", "/api/workspace/accounts/:id/entries", [idOf(step.cari)], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "cari", id: result.data.entryId, cariId: idOf(step.cari) }, replayed: Boolean(result.data.replayed), note: step.yol === "kart" && step.hesap !== undefined ? CARD_NOTE : "" };
        }
        case "taksit_tahsilat": {
          const planId = idOf(step.kart);
          let itemId;
          if (step.taksitNo !== undefined) {
            const plan = await http(Y(), "GET", "/api/workspace/plans/:id", [planId], undefined, { islem: step.islem });
            if (!plan.ok) return refused(plan);
            itemId = (plan.data.items || []).find(item => Number(item.seq) === Number(step.taksitNo))?.id;
            if (!itemId) return { unmapped: `taksit kartında ${step.taksitNo}. taksit yok.` };
          }
          const body = { kind: "in", amount: amountOf(step, "tutar"), date, method: METHOD[step.yol], ...(step.hesap !== undefined ? { bankAccountId: idOf(step.hesap) } : {}), ...(itemId ? { itemId } : {}), ...flags };
          const result = await http(client, "POST", "/api/workspace/plans/:id/entries", [planId], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "taksit", id: result.data.entryId, planId }, replayed: Boolean(result.data.replayed) };
        }
        case "kasa_banka": {
          const body = { direction: CASH_DIRECTION[step.yon], amount: amountOf(step, "tutar"), date, ...(step.hesap !== undefined ? { bankAccountId: idOf(step.hesap) } : {}), ...flags };
          const result = await http(client, "POST", "/api/workspace/cash/transfer", [], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "kasa", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "transfer": {
          const fee = amountOf(step, "ucret");
          const body = {
            type: "transfer",
            accountId: idOf(step.kaynak),
            toAccountId: idOf(step.hedef),
            amount: amountOf(step, "tutar"),
            date,
            channel: "",
            feeAmount: fee === undefined ? "0" : fee,
            ...(fee !== undefined ? { feeTax: FEE_TAX[step.ucretVergi] } : {}),
            ...flags,
          };
          const result = await http(client, "POST", "/api/workspace/bank/transfers", [], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "fis", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "banka_masraf": {
          const vat = ["kdv_dahil", "kdv_haric"].includes(step.vergi);
          const body = {
            type: "fee",
            accountId: idOf(step.hesap),
            amount: amountOf(step, "tutar"),
            date,
            feeType: FEE_TYPE[step.masrafTuru],
            tax: FEE_TAX[step.vergi],
            ...(vat ? { partyId: step.saglayici !== undefined ? idOf(step.saglayici) : "", invoiceNo: step.fatura, ...(step.kdvOrani !== undefined ? { taxRate: String(step.kdvOrani) } : {}) } : {}),
            ...flags,
          };
          const result = await http(client, "POST", "/api/workspace/bank/vouchers", [], body, opt);
          if (!result.ok) return refused(result);
          const extra = [];
          if (vat) {
            if (result.data.invoice?.id) extra.push({ alias: step.fatura, rec: { tur: "fatura", id: result.data.invoice.id } });
            else return { created: { tur: "hareket", hareket: "fis", id: result.data.id }, extra, note: `${step.fatura}: KDV'li masrafın İşlem Kartı'nda fatura bağı (invoice.id) yok.` };
          }
          return { created: { tur: "hareket", hareket: "fis", id: result.data.id }, extra, replayed: Boolean(result.data.replayed) };
        }
        case "faiz_geliri":
        case "faiz_gideri":
        case "diger_gelir":
        case "diger_gider":
        case "kart_borcu_odeme": {
          const type = { faiz_geliri: "interest_in", faiz_gideri: "interest_out", diger_gelir: "other_in", diger_gider: "other_out", kart_borcu_odeme: "card_payment" }[step.islem];
          const body = {
            type,
            accountId: idOf(step.islem === "kart_borcu_odeme" ? step.kaynak : step.hesap),
            amount: amountOf(step, step.islem === "faiz_geliri" ? "brut" : "tutar"),
            date,
            ...(step.islem === "faiz_geliri" ? { stoppageRate: rateText(step.stopajOrani) } : {}),
            ...(step.islem === "faiz_gideri" ? { taxAmount: "0" } : {}),
            ...(step.islem === "kart_borcu_odeme" ? { cardAccountId: idOf(step.kart) } : {}),
            ...flags,
          };
          const result = await http(client, "POST", "/api/workspace/bank/vouchers", [], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "fis", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "kredi_kullanim":
        case "kredi_odeme": {
          const body = step.islem === "kredi_kullanim"
            ? { type: "loan_draw", accountId: idOf(step.hedef), loanAccountId: idOf(step.kredi), amount: amountOf(step, "tutar"), date, ...flags }
            : { type: "loan_repay", accountId: idOf(step.kaynak), loanAccountId: idOf(step.kredi), amount: amountOf(step, "anapara"), interestAmount: amountOf(step, "faiz") ?? "0", date, ...flags };
          const result = await http(client, "POST", "/api/workspace/bank/transfers", [], body, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "fis", id: result.data.id }, replayed: Boolean(result.data.replayed) };
        }
        case "ters_kayit": {
          const target = registry.get(step.hedef);
          const eventId = target.hareket === "fis" ? target.id : target.events?.length === 1 ? target.events[0] : "";
          if (!eventId) return { unmapped: `${step.hedef} (${target.hareket}) için İşlem Kartı bulunamadı: programın Hareketler listesinde bu adımla açılan tek bir banka olayı yok (nakit/modül hareketi). Ekranda bu harekete Ters Kaydet sunulmuyor.` };
          const result = await http(client, "POST", "/api/workspace/bank/events/:id/reverse", [eventId], { ...flags }, opt);
          if (!result.ok) return refused(result);
          return { created: { tur: "hareket", hareket: "fis", id: result.data.reversal?.id || "" }, replayed: Boolean(result.data.replayed) };
        }
        case "sil": {
          const target = registry.get(step.hedef);
          const query = deleteFlags(step);
          let result;
          if (target.hareket === "cari") result = await http(client, "DELETE", `/api/workspace/accounts/:id/entries/:entryId${query}`, [target.cariId, target.id], undefined, opt);
          else if (target.hareket === "taksit") result = await http(client, "DELETE", `/api/workspace/plans/:id/entries/:entryId${query}`, [target.planId, target.id], undefined, opt);
          else if (target.hareket === "kasa") result = await http(client, "DELETE", `/api/workspace/cash/:id${query}`, [target.id], undefined, opt);
          else {
            // Banka Fişi ve transferin silme ucu yok (ekranda yalnız Ters Kaydet); ucun yokluğu programın yanıtıyla kayda geçer.
            result = await http(client, "DELETE", `/api/workspace/bank/events/:id${query}`, [target.id], undefined, opt);
            if (!result.ok) return { ...refused(result), note: "Banka Fişi/transfer için programda silme ucu yok (yalnız Ters Kaydet); yanıt yöntemin desteklenmediğini söylüyor." };
          }
          return result.ok ? { done: true } : refused(result);
        }
        default:
          return { unmapped: `işlem tanınmadı: ${step.islem}` };
      }
    }

    // ---------- Akış ----------
    const steps = scenario.adimlar;
    for (let index = 0; index < steps.length; ) {
      const step = steps[index];
      if (step.islem === "kontrol") {
        out.araDurumlar[step.id] = await read(`kontrol ${step.id}`);
        index += 1;
        continue;
      }
      const group = [step];
      if (step.ayniAnda !== undefined) while (index + group.length < steps.length && steps[index + group.length].ayniAnda === step.ayniAnda) group.push(steps[index + group.length]);
      const watch = group.length === 1 && step.ad !== undefined && reverseTargets.has(step.ad) && !["transfer", "banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider", "kart_borcu_odeme", "kredi_kullanim", "kredi_odeme", "ters_kayit"].includes(step.islem);
      const before = watch ? await eventIds() : null;
      const results = await Promise.all(group.map(item => execute(item).catch(error => ({ crash: String(error?.stack || error) }))));
      const after = watch ? await eventIds() : null;
      group.forEach((item, at) => {
        const result = results[at];
        const defines = [item.ad, item.islem === "fatura" ? item.odeme?.taksit?.ad : undefined, item.islem === "banka_masraf" ? item.fatura : undefined].filter(Boolean);
        const markFailed = () => defines.forEach(alias => failedAliases.set(alias, item.id));
        if (result.crash) {
          out.okumaHatalari.push(`${item.id}: koşucu hatası — ${result.crash.split("\n")[0]}`);
          markFailed();
          return;
        }
        if (result.skip) {
          out.atlananlar.push(item.id);
          out.atlamaAyrinti.push({ adim: item.id, islem: item.islem, neden: result.skip });
          markFailed();
          return;
        }
        if (result.unmapped) {
          out.eslenemeyenler.push({ adim: item.id, islem: item.islem, neden: result.unmapped });
          markFailed();
          return;
        }
        if (result.ret) {
          out.retler.push({ adim: item.id, durum: result.ret.durum, kod: result.ret.kod });
          out.retAyrinti.push({ adim: item.id, islem: item.islem, durum: result.ret.durum, kod: result.ret.kod, mesaj: result.ret.mesaj, ...(result.note ? { not: result.note } : {}) });
          markFailed();
          return;
        }
        if (result.replayed) out.yinelenenler.push(item.id);
        if (result.note) out.eslenemeyenler.push({ adim: item.id, islem: item.islem, neden: result.note });
        if (result.created && item.ad !== undefined) {
          const rec = { ...result.created };
          if (watch && before && after) rec.events = [...after].filter(id => !before.has(id));
          registry.set(item.ad, rec);
        }
        for (const extra of result.extra || []) registry.set(extra.alias, extra.rec);
      });
      index += group.length;
    }

    // ---------- Son durum ----------
    const final = await read("son durum");
    const integrity = await http(Y(), "GET", "/api/workspace/ledger/integrity", [], undefined, { islem: "okuma" });
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const git = gitInfo();
    const output = {
      dil: DIL,
      senaryo: scenario.ad,
      kaynak: "program",
      ...final,
      retler: out.retler,
      yinelenenler: out.yinelenenler,
      atlananlar: out.atlananlar,
      araDurumlar: out.araDurumlar,
      belirsizler: [],
      // Karşılaştırılmayan ek alanlar (SENARYO-DILI §8.1: okumaKaynaklari, programSurumu, commit; §10: okumaHatalari).
      okumaKaynaklari: {
        mizan: "GET /api/workspace/ledger (Ana Defter → Hesap Planı Mizanı, trial.accounts[].balance; ana hesaplar) + GET /api/workspace/bank/sub-trial (Banka → Alt Hesap Mizanı, rows[].balance; 102/108/300/309 yaprakları). Bakiye TL → kuruş; borc = max(0, bakiye), alacak = max(0, −bakiye).",
        bankaHesaplari: "GET /api/workspace/bank/accounts?status=all (Banka → Hesaplar, accounts[].balanceMinor); Alt Hesap Mizanı satırıyla karşılaştırılır.",
        hesapKodlari: "GET /api/workspace/bank/accounts?status=all (accounts[].glSub).",
        eksiBakiyeDenetimi: "GET /api/workspace/bank/accounts?status=all (accounts[].policy: warn → uyar, block → engelle, off → kontrol_yok; doğrulanmamış hesapta program off döner).",
        kasa: "GET /api/workspace/cash (Kasa penceresi, yalnız nakit, totals.balance); ANLIK DURUM (GET /api/workspace/overview cash.allEntries) ile karşılaştırılır.",
        cariler: "GET /api/workspace/accounts?status=all&limit=5000 (Cari penceresi listesi, accounts[].balance; borçlu +).",
        stok: "GET /api/workspace/stock?limit=5000 (Stok penceresi listesi, items[].qty).",
        faturalar: "GET /api/workspace/invoices/:id (fatura kartı: payableTotal → toplam, netTotal → matrah, vatTotal → kdv, open → acik).",
        taksitKartlari: "GET /api/workspace/plans?status=all (Taksitler penceresi listesi, plans[].totals: total → toplam, paid → odenen, remaining → kalan).",
        ozet: "GET /api/workspace/bank/summary (Banka Genel Bakış K10: realBank.minor → gercekBanka, unassigned.totalMinor → hesabiAtanmamis, debt.totalMinor → kartVeKrediBorcu); kasaVeGercekBanka = GET /api/workspace/overview (ANLIK DURUM) cash.balance + cash.bank.balance.",
        retler: "Yanıtın HTTP durumu + gövdedeki code (ret iletisi retAyrinti'de).",
      },
      hesaplananAlanlar: [
        "Program TL sayıları (mizan, Kasa, cari, fatura, taksit) kuruşa çevrildi: round(TL × 100).",
        "mizan değerleri bakiyeden bakiye sütunlarına ayrıldı (borc/alacak).",
        "ozet.kasaVeGercekBanka = ANLIK DURUM Nakit Kasa + Gerçek Banka (program bu toplamı tek sayı olarak göstermiyor; iki ekran sayısının toplamı).",
      ],
      okumaHatalari: out.okumaHatalari,
      kaynakFarklari: out.kaynakFarklari,
      retAyrinti: out.retAyrinti,
      atlamaAyrinti: out.atlamaAyrinti,
      eslenemeyenler: out.eslenemeyenler,
      kullanilanUclar: [...uses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([uc, islemler]) => ({ uc, islemler: [...islemler].sort() })),
      ekBilgi: {
        programMutabakatTesti: integrity.ok ? { ok: integrity.data.ok === true, basarisizDenetim: (integrity.data.failures || []).length } : { okunamadi: `${integrity.status} ${integrity.error}` },
        sunucu: "test/helpers.mjs startTestServer: sahte saat (yerel öğlen, akar), lisans denetimi kapalı, moneyStrict ve gateVerify açık (test kipi).",
      },
      programSurumu: pkg.version,
      commit: git.commit,
      calismaAgaciDegisikDosya: git.degisikDosyaSayisi,
    };
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${sortedJson(output)}\n`);
    process.stdout.write(`Yazıldı: ${outPath}\nretler ${out.retler.length} · yinelenen ${out.yinelenenler.length} · atlanan ${out.atlananlar.length} · eşlenemeyen ${out.eslenemeyenler.length} · okuma hatası ${out.okumaHatalari.length} · kaynak farkı ${out.kaynakFarklari.length}\n`);
    if (out.okumaHatalari.length) process.stderr.write(`Okuma/koşucu hataları:\n${out.okumaHatalari.map(line => `  - ${line}`).join("\n")}\n`);
    return out.okumaHatalari.length ? 1 : 0;
  } finally {
    await server.close();
  }
}

const args = process.argv.slice(2);
const scenarioArg = args.find(arg => !arg.startsWith("--"));
const outIndex = args.indexOf("--cikti");
if (!scenarioArg) {
  process.stderr.write("Kullanım: node test/bagimsiz/surucu.mjs <senaryo.json> [--cikti <dosya>]\n");
  process.exit(2);
}
const scenarioPath = path.resolve(scenarioArg);
const defaultOut = path.join(HERE, "cikti", `${path.basename(scenarioPath).replace(/\.json$/, "")}.program.json`);
const outPath = outIndex >= 0 && args[outIndex + 1] ? path.resolve(args[outIndex + 1]) : defaultOut;
run(scenarioPath, outPath).then(
  code => process.exit(code),
  error => {
    process.stderr.write(`Koşu yarıda kaldı: ${error?.stack || error}\n`);
    process.exit(2);
  },
);
