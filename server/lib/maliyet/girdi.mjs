// Maliyet Hesap Kartı — GİRDİ DOĞRULAMA (2.4.6 madde 1–2). Ekrandan / API'den gelen kart değişikliğini kartın şimdiki hâline uygular ve yeni hâli döndürür
// (saf işlev; veri tabanına dokunmaz). Şablonun yapısı değişmez: kart türü, adım sırası, matris hücresinin TABAN / fark türü ve kaynağı, bilgi satırları ve
// sütunları sabittir. Kullanıcı yalnız şunları değiştirir: adlar (✎: sekme, kart, malzeme / parça, birim / cins, adım etiketi, sütun, ölçü), miktar, fiyat,
// oran, bölen, elle CM maliyeti, profil değerleri, matris taban / farkı, bilgi değerleri; zincir ve gramaj kartında satır ekler / siler (K3: fiyat listesinde
// ölçü satırı ekle / sil YOK).
//
// K1 (kullanıcı kararı, öneri): bölen 0 ya da boş → değişiklik REDDEDİLİR ("Bölen 0 olamaz.").
import { randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { GRAMAJ_SUTUNLAR } from "./sablon.mjs";

export const MAX_SATIR = 100;
export const MAX_AD = 120;
const MAX_METIN = 200;
const MAX_SAYI = 1e12;
const SATIR_ID = /^[A-Za-z0-9_-]{1,40}$/;

const bad = (message, extra = {}) => new HttpError(400, message, { code: "maliyet-invalid", ...extra });
const has = (object, key) => Boolean(object) && typeof object === "object" && Object.hasOwn(object, key);
const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Ad / etiket: kontrol karakterleri boşluk, boşluklar teke, baş / son kırpılır. */
export function adGirdi(value, label, { bos = true, max = MAX_AD } = {}) {
  if (value === null || value === undefined) value = "";
  if (typeof value !== "string" && typeof value !== "number") throw bad(`${label} metin olmalı.`);
  const text = String(value).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!bos && !text) throw bad(`${label} boş olamaz.`);
  if (text.length > max) throw bad(`${label} en çok ${max} karakter olabilir.`);
  return text;
}

/**
 * Sayı girdisi: JSON sayısı ya da "12,5" / "12.5" biçiminde metin; boş (null, "") → null. Binlik ayırıcı kabul edilmez (tahmin yok: "1.250" kuruş mu bin mi
 * belli değildir). Ham değer saklanır; yuvarlanmaz.
 */
export function sayiGirdi(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw bad(`${label} geçerli bir sayı değil.`);
    if (Math.abs(value) > MAX_SAYI) throw bad(`${label} çok büyük.`);
    return value;
  }
  if (typeof value !== "string") throw bad(`${label} sayı olmalı.`);
  const text = value.trim();
  if (!text) return null;
  if (!/^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/.test(text)) throw bad(`${label} sayı olmalı (ör. 12,5).`);
  return sayiGirdi(Number(text.replace(",", ".")), label);
}

/** Bölen (K1): 0 ya da boş olamaz. */
export function bolenGirdi(value, label) {
  const bolen = sayiGirdi(value, label);
  if (bolen === null || bolen === 0) throw new HttpError(400, "Bölen 0 olamaz.", { code: "maliyet-bolen" });
  return bolen;
}

// Ad haritası: { kod: ad } ya da [{ kod, ad }] → yalnız tanımlı kodlar.
function adHaritasi(input, izinli, label, mevcut) {
  if (input === undefined) return mevcut;
  const entries = Array.isArray(input) ? input.map(item => [item?.kod, item?.ad]) : isObject(input) ? Object.entries(input) : null;
  if (!entries) throw bad(`${label} okunamadı.`);
  const next = { ...mevcut };
  for (const [kod, ad] of entries) {
    if (!izinli.has(String(kod))) throw bad(`${label}: “${String(kod).slice(0, 40)}” bu kartta yok.`);
    next[kod] = adGirdi(ad, label);
  }
  return next;
}

function satirKimligi(raw, kullanilan, mevcutlar) {
  let id = raw === undefined || raw === null || raw === "" ? "" : String(raw);
  if (id && !SATIR_ID.test(id)) throw bad("Satır kimliği geçersiz.");
  if (!id) {
    do id = `y-${randomUUID().slice(0, 8)}`;
    while (kullanilan.has(id) || mevcutlar.has(id));
  }
  if (kullanilan.has(id)) throw bad("Aynı satır iki kez gönderildi.");
  kullanilan.add(id);
  return id;
}

// Adım değişikliği: [{ kod, etiket?, oran?, bolen?, deger? }] ya da { kod: {…} }.
function adimGirdisi(input) {
  if (input === undefined) return [];
  if (Array.isArray(input)) return input.map(item => [item?.kod, item]);
  if (isObject(input)) return Object.entries(input);
  throw bad("Adımlar okunamadı.");
}

function zincirUygula(sablon, durum, body) {
  const next = { ...durum, adimlar: { ...durum.adimlar } };
  if (has(body, "ad")) next.ad = adGirdi(body.ad, "Kart adı", { bos: false });
  if (has(body, "satirlar")) {
    if (!Array.isArray(body.satirlar)) throw bad("Satırlar liste olmalı.");
    if (body.satirlar.length > MAX_SATIR) throw bad(`Bir kartta en çok ${MAX_SATIR} satır olabilir.`);
    const mevcut = new Map(durum.satirlar.map(satir => [satir.id, satir]));
    const kullanilan = new Set();
    next.satirlar = body.satirlar.map((item, index) => {
      if (!isObject(item)) throw bad("Satır okunamadı.");
      const id = satirKimligi(item.id, kullanilan, new Set());
      const onceki = mevcut.get(id) || { id, ad: "", birim: "", miktar: null, fiyat: null };
      const where = `${index + 1}. satır`;
      return {
        id,
        ad: has(item, "ad") ? adGirdi(item.ad, `${where} malzeme adı`) : onceki.ad,
        birim: has(item, "birim") ? adGirdi(item.birim, `${where} birimi`, { max: 40 }) : onceki.birim,
        miktar: has(item, "miktar") ? sayiGirdi(item.miktar, `${where} miktarı`) : onceki.miktar,
        fiyat: has(item, "fiyat") ? sayiGirdi(item.fiyat, `${where} birim fiyatı`) : onceki.fiyat,
      };
    });
  }
  const tanimli = new Map(sablon.adimlar.map(adim => [adim.kod, adim]));
  for (const [kod, item] of adimGirdisi(body.adimlar)) {
    const tanim = tanimli.get(String(kod));
    if (!tanim) throw bad(`Bu kartta “${String(kod).slice(0, 40)}” adımı yok.`);
    if (!isObject(item)) throw bad("Adım okunamadı.");
    const kayit = { ...(next.adimlar[kod] || {}) };
    if (has(item, "etiket")) kayit.etiket = adGirdi(item.etiket, "Adım etiketi");
    if (kod === "yuzde" || kod === "yuzde_ekle") {
      if (has(item, "oran")) kayit.deger = sayiGirdi(item.oran, `${kayit.etiket ?? tanim.etiket ?? "Oran"} oranı`);
    } else if (kod === "bolme") {
      if (has(item, "bolen")) kayit.deger = bolenGirdi(item.bolen, "Bölen");
    } else if (kod === "cm_elle") {
      if (has(item, "deger")) kayit.deger = sayiGirdi(item.deger, kayit.etiket || tanim.etiket || "CM maliyeti");
    }
    next.adimlar[kod] = kayit;
  }
  return next;
}

const GRAMAJ_KOD = new Set(GRAMAJ_SUTUNLAR.map(([kod]) => kod));
function gramajUygula(sablon, durum, body) {
  const next = { ...durum };
  if (has(body, "ad")) next.ad = adGirdi(body.ad, "Kart adı", { bos: false });
  next.sutunlar = adHaritasi(body.sutunlar, GRAMAJ_KOD, "Sütun adı", durum.sutunlar);
  if (has(body, "satirlar")) {
    if (!Array.isArray(body.satirlar)) throw bad("Satırlar liste olmalı.");
    if (body.satirlar.length > MAX_SATIR) throw bad(`Bir kartta en çok ${MAX_SATIR} satır olabilir.`);
    const mevcut = new Map(durum.satirlar.map(satir => [satir.id, satir]));
    const kullanilan = new Set();
    next.satirlar = body.satirlar.map((item, index) => {
      if (!isObject(item)) throw bad("Satır okunamadı.");
      const id = satirKimligi(item.id, kullanilan, new Set());
      const onceki = mevcut.get(id) || { id, parca: "", cins: "", giden_mt: null, boy: null, br_gramaj: null, giden_kg: null, alis_ft: null, elle: false };
      const where = `${index + 1}. satır`;
      const value = (key, label) => (has(item, key) ? sayiGirdi(item[key], `${where} ${label}`) : onceki[key]);
      return {
        id,
        parca: has(item, "parca") ? adGirdi(item.parca, `${where} parça adı`) : onceki.parca,
        cins: has(item, "cins") ? adGirdi(item.cins, `${where} cinsi`, { max: 40 }) : onceki.cins,
        giden_mt: value("giden_mt", "giden metre"),
        boy: value("boy", "boyu"),
        br_gramaj: value("br_gramaj", "birim gramajı"),
        alis_ft: value("alis_ft", "alış fiyatı"),
        // Giden Kğ yalnız şablonun elle satırında girdidir (Excel'de formülsüz); öbür satırlarda hesaplanır, gelen değer yok sayılır.
        giden_kg: onceki.elle ? value("giden_kg", "giden kğ") : null,
        elle: Boolean(onceki.elle),
      };
    });
  }
  return next;
}

function matrisUygula(sablon, durum, body) {
  const next = { ...durum, hucreler: { ...durum.hucreler } };
  if (has(body, "ad")) next.ad = adGirdi(body.ad, "Kart adı", { bos: false });
  if (has(body, "olcuBasligi")) next.olcuBasligi = adGirdi(body.olcuBasligi, "Ölçü başlığı");
  next.sutunlar = adHaritasi(body.sutunlar, new Set(sablon.sutunlar.map(sutun => sutun.kod)), "Sütun adı", durum.sutunlar);
  next.olculer = adHaritasi(body.olculer, new Set(sablon.olculer.map(olcu => olcu.kod)), "Ölçü", durum.olculer);
  if (has(body, "hucreler")) {
    if (!isObject(body.hucreler)) throw bad("Hücreler okunamadı.");
    for (const [hucre, item] of Object.entries(body.hucreler)) {
      const kaynak = sablon.hucreler[hucre];
      if (!kaynak) throw bad(`Bu tabloda “${hucre.slice(0, 20)}” hücresi yok.`);
      const taban = kaynak === "taban";
      let raw = item;
      if (isObject(item)) {
        if (has(item, taban ? "fark" : "taban")) throw bad(taban ? "Bu hücre taban fiyattır; fark yazılmaz." : "Bu hücre bir önceki fiyata farkla bağlıdır; taban yazılmaz.");
        if (!has(item, taban ? "taban" : "fark")) continue;
        raw = item[taban ? "taban" : "fark"];
      }
      next.hucreler[hucre] = sayiGirdi(raw, taban ? "Taban fiyat" : "Fark");
    }
  }
  return next;
}

function bilgiDegeri(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return sayiGirdi(value, label);
  if (typeof value !== "string") throw bad(`${label} sayı ya da metin olmalı.`);
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (text.length > MAX_METIN) throw bad(`${label} en çok ${MAX_METIN} karakter olabilir.`);
  return text || null;
}

function bilgiUygula(sablon, durum, body) {
  const next = { ...durum };
  if (has(body, "ad")) next.ad = adGirdi(body.ad, "Kart adı", { bos: false });
  next.sutunlar = adHaritasi(body.sutunlar, new Set(sablon.sutunlar.map(sutun => sutun.kod)), "Sütun adı", durum.sutunlar);
  if (has(body, "satirlar")) {
    if (!Array.isArray(body.satirlar)) throw bad("Satırlar liste olmalı.");
    const byId = new Map(durum.satirlar.map(satir => [satir.id, satir]));
    const changed = new Map();
    for (const item of body.satirlar) {
      const onceki = byId.get(String(item?.id || ""));
      if (!onceki) throw bad("Bu kartta satır eklenip silinemez; yalnız değerler yazılır.");
      const satir = { ...(changed.get(onceki.id) || onceki) };
      if (has(item, "ad")) satir.ad = adGirdi(item.ad, "Satır adı");
      if (has(item, "degerler")) {
        if (!Array.isArray(item.degerler) || item.degerler.length > sablon.sutunlar.length) throw bad(`Bir satırda en çok ${sablon.sutunlar.length} değer olur.`);
        satir.degerler = sablon.sutunlar.map((_, index) => (index < item.degerler.length ? bilgiDegeri(item.degerler[index], satir.ad || "Değer") : satir.degerler?.[index] ?? null));
      }
      changed.set(onceki.id, satir);
    }
    next.satirlar = durum.satirlar.map(satir => changed.get(satir.id) || satir);
  }
  return next;
}

const BY_TUR = { zincir: zincirUygula, gramaj: gramajUygula, matris: matrisUygula, bilgi: bilgiUygula };

/** Kartın şimdiki hâline (durum) gövdedeki değişikliği uygular; gövdede olmayan alan değişmez. */
export function kartUygula(sablon, durum, body) {
  if (!isObject(body)) throw bad("Kart okunamadı.");
  return BY_TUR[sablon.tur](sablon, durum, body);
}
