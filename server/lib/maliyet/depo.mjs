// Maliyet Hesap Kartı — VERİ (2.4.6 madde 1). Şirketin kendi veri dosyasındaki maliyet_* tabloları (göç v34). Para / stok / cari / kasa / fatura / defter
// tablolarına YAZMAZ ve onlardan OKUMAZ (madde 5; denetim test/maliyet-bagsizlik.test.mjs): kart hiçbir yere bağlı değildir (kullanıcı kararı 24.10.2026).
//
// Şablon kod içindedir (lib/maliyet/sablon.mjs); sektör "Duşakabin Üretimi" iken ilk açılışta bir kez kurulur: eksik sekme / kart eklenir, var olana
// dokunulmaz (sonraki sürümün şablona eklediği kart da böyle gelir). Sektör değişince veri SİLİNMEZ. "Tümünü Sıfırla" kart verisi gibi siler (app.mjs
// CARD_TABLES); sonraki açılışta boş şablon yeniden kurulur. "Tüm Hareketleri Sil" dokunmaz. Yedekle gider, geri yüklemeyle döner (veri dosyasının parçası).
//
// Eşzamanlılık (iki kişi aynı anda): her kartın ve sekmenin sürümü (rev) vardır; Kaydet açıldığı andaki sürümü gönderir. Arada başka biri o kartı
// kaydettiyse 409 (değişiklik yazılmaz; ilk kaydedenin değişikliği sessizce ezilmez). Değişmeyen kart sürüm denetimine girmez, yazılmaz.
import { HttpError } from "../http.mjs";
import { GRAMAJ_SUTUNLAR, MALIYET_KARTLAR, MALIYET_SEKMELER, sablonKart } from "./sablon.mjs";
import { kartHesap } from "./hesap.mjs";
import { adGirdi, kartUygula } from "./girdi.mjs";

export const MALIYET_TABLOLARI = Object.freeze(["maliyet_sekmeler", "maliyet_kartlar", "maliyet_satirlar", "maliyet_adimlar", "maliyet_hucreler", "maliyet_basliklar"]);

const GRAMAJ_ADLARI = Object.fromEntries(GRAMAJ_SUTUNLAR);

// ---------- Şablondan ilk durum ----------
function ilkDurum(sablon) {
  if (sablon.tur === "zincir") {
    return {
      ad: sablon.ad,
      satirlar: sablon.satirlar.map(satir => ({ id: satir.id, ad: satir.ad, birim: satir.birim, miktar: null, fiyat: null })),
      adimlar: Object.fromEntries(sablon.adimlar.map(adim => [adim.kod, { etiket: adim.etiket, ...(adim.kod === "yuzde" || adim.kod === "yuzde_ekle" ? { deger: adim.oran } : adim.kod === "bolme" ? { deger: adim.bolen } : adim.kod === "cm_elle" ? { deger: null } : {}) }])),
    };
  }
  if (sablon.tur === "gramaj") {
    return {
      ad: sablon.ad,
      sutunlar: { ...GRAMAJ_ADLARI },
      satirlar: sablon.satirlar.map(satir => ({ id: satir.id, parca: satir.parca, cins: satir.cins, giden_mt: null, boy: null, br_gramaj: null, giden_kg: null, alis_ft: null, elle: satir.elleKg })),
    };
  }
  if (sablon.tur === "matris") {
    return {
      ad: sablon.ad,
      olcuBasligi: sablon.olcuBasligi,
      sutunlar: Object.fromEntries(sablon.sutunlar.map(sutun => [sutun.kod, sutun.ad])),
      olculer: Object.fromEntries(sablon.olculer.map(olcu => [olcu.kod, olcu.ad])),
      hucreler: {},
    };
  }
  return {
    ad: sablon.ad,
    sutunlar: Object.fromEntries(sablon.sutunlar.map(sutun => [sutun.kod, sutun.ad])),
    satirlar: sablon.satirlar.map(satir => ({ id: satir.id, ad: satir.ad, degerler: sablon.sutunlar.map(() => null) })),
  };
}

const parseList = text => {
  try {
    const value = JSON.parse(text || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export function createMaliyetDepo({ store, now = () => new Date() }) {
  const iso = () => (typeof now === "function" ? now() : new Date()).toISOString();
  const tableExists = () => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'maliyet_kartlar'"));

  /** Eksik sekme / kartı şablondan kurar (bir kez; var olana dokunmaz). Dönüş: kurulan kart sayısı. */
  function kur() {
    if (!tableExists()) throw new HttpError(503, "Maliyet tabloları hazır değil; programı yeniden başlatın.");
    const at = iso();
    let added = 0;
    store.tx(() => {
      MALIYET_SEKMELER.forEach((sekme, index) => {
        store.run("INSERT OR IGNORE INTO maliyet_sekmeler (kod, ad, sira, rev, updated_at) VALUES (?, ?, ?, 1, ?)", sekme.kod, sekme.ad, index + 1, at);
      });
      MALIYET_KARTLAR.forEach((sablon, index) => {
        if (store.get("SELECT 1 AS found FROM maliyet_kartlar WHERE kod = ?", sablon.kod)) return;
        store.run("INSERT INTO maliyet_kartlar (kod, sekme, tur, ad, sira, rev, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)", sablon.kod, sablon.sekme, sablon.tur, sablon.ad, index + 1, at);
        yaz(sablon, ilkDurum(sablon));
        added += 1;
      });
      sablonYukselt();
    });
    return added;
  }

  /**
   * 2.4.7: şablonun ilk hâli değişti (oranlar boş, etiketlerde sayı yok, toplama "Toplam"). 2.4.6'da kurulmuş ama HİÇ KAYDEDİLMEMİŞ kart
   * (rev 1, updated_at boş — Kaydet yalnız değişen kartı yazar ve rev'i artırır) yeni ilk hâle çevrilir; adım yalnız değeri 2.4.6 şablonundakiyle
   * AYNEN aynıysa değişir. Kullanıcının bir kez kaydettiği kart (rev > 1) değişmez: 18 / 20 ve etiketleri kalır. rev artmaz; ikinci çağrı bir şey yapmaz.
   */
  function sablonYukselt() {
    for (const row of store.all("SELECT kod FROM maliyet_kartlar WHERE tur = 'zincir' AND rev = 1 AND updated_at IS NULL")) {
      const sablon = sablonKart(row.kod);
      if (!sablon) continue;
      for (const adim of sablon.adimlar) {
        if (!adim.onceki) continue;
        if (adim.kod === "yuzde" || adim.kod === "yuzde_ekle") {
          store.run("UPDATE maliyet_adimlar SET etiket = ?, deger = ? WHERE kart = ? AND kod = ? AND etiket = ? AND deger = ?", adim.etiket, adim.oran ?? null, row.kod, adim.kod, adim.onceki.etiket, adim.onceki.oran);
        } else if (adim.etiket !== adim.onceki.etiket) {
          store.run("UPDATE maliyet_adimlar SET etiket = ? WHERE kart = ? AND kod = ? AND etiket = ?", adim.etiket, row.kod, adim.kod, adim.onceki.etiket);
        }
      }
    }
  }

  // ---------- Okuma ----------
  function durumOku(sablon, kart) {
    const satirlar = store.all("SELECT * FROM maliyet_satirlar WHERE kart = ? ORDER BY sira, id", sablon.kod);
    const basliklar = Object.fromEntries(store.all("SELECT kod, ad FROM maliyet_basliklar WHERE kart = ?", sablon.kod).map(row => [row.kod, row.ad]));
    if (sablon.tur === "zincir") {
      return {
        ad: kart.ad,
        satirlar: satirlar.map(row => ({ id: row.id, ad: row.ad, birim: row.birim, miktar: row.miktar, fiyat: row.fiyat })),
        adimlar: Object.fromEntries(store.all("SELECT kod, etiket, deger FROM maliyet_adimlar WHERE kart = ?", sablon.kod).map(row => [row.kod, row.kod === "ara" || row.kod === "toplama" ? { etiket: row.etiket } : { etiket: row.etiket, deger: row.deger }])),
      };
    }
    if (sablon.tur === "gramaj") {
      return {
        ad: kart.ad,
        sutunlar: { ...GRAMAJ_ADLARI, ...basliklar },
        satirlar: satirlar.map(row => ({ id: row.id, parca: row.ad, cins: row.birim, giden_mt: row.giden_mt, boy: row.boy, br_gramaj: row.br_gramaj, giden_kg: row.giden_kg, alis_ft: row.alis_ft, elle: Boolean(row.elle) })),
      };
    }
    if (sablon.tur === "matris") {
      const ilk = ilkDurum(sablon);
      const olculer = { ...ilk.olculer };
      const sutunlar = { ...ilk.sutunlar };
      for (const [kod, ad] of Object.entries(basliklar)) {
        if (Object.hasOwn(olculer, kod)) olculer[kod] = ad;
        else if (Object.hasOwn(sutunlar, kod)) sutunlar[kod] = ad;
      }
      return {
        ad: kart.ad,
        olcuBasligi: basliklar.olcu ?? sablon.olcuBasligi,
        sutunlar,
        olculer,
        hucreler: Object.fromEntries(store.all("SELECT hucre, deger FROM maliyet_hucreler WHERE kart = ?", sablon.kod).map(row => [row.hucre, row.deger])),
      };
    }
    return {
      ad: kart.ad,
      sutunlar: { ...ilkDurum(sablon).sutunlar, ...basliklar },
      satirlar: satirlar.map(row => ({ id: row.id, ad: row.ad, degerler: sablon.sutunlar.map((_, index) => parseList(row.degerler_json)[index] ?? null) })),
    };
  }

  const kartRow = kod => store.get("SELECT * FROM maliyet_kartlar WHERE kod = ?", kod);

  function gorunum(sablon, kart, durum = durumOku(sablon, kart)) {
    return { kod: sablon.kod, sekme: sablon.sekme, rev: kart.rev, ...kartHesap(sablon, durum) };
  }

  /** Bütün pencere: sekmeler (sıra, ad, sürüm, kart kodları) + kartların görünümü. */
  function hepsi() {
    const sekmeler = store.all("SELECT kod, ad, rev FROM maliyet_sekmeler ORDER BY sira, kod");
    const kartlar = store.all("SELECT * FROM maliyet_kartlar ORDER BY sira, kod");
    const known = kartlar.filter(kart => sablonKart(kart.kod));
    return {
      sekmeler: sekmeler.map(sekme => ({ kod: sekme.kod, ad: sekme.ad, rev: sekme.rev, kartlar: known.filter(kart => kart.sekme === sekme.kod).map(kart => kart.kod) })),
      kartlar: Object.fromEntries(known.map(kart => [kart.kod, gorunum(sablonKart(kart.kod), kart)])),
    };
  }

  // ---------- Yazma ----------
  function yaz(sablon, durum) {
    const kod = sablon.kod;
    store.run("DELETE FROM maliyet_satirlar WHERE kart = ?", kod);
    store.run("DELETE FROM maliyet_adimlar WHERE kart = ?", kod);
    store.run("DELETE FROM maliyet_hucreler WHERE kart = ?", kod);
    store.run("DELETE FROM maliyet_basliklar WHERE kart = ?", kod);
    const baslik = (k, ad) => store.run("INSERT INTO maliyet_basliklar (kart, kod, ad) VALUES (?, ?, ?)", kod, k, ad);
    if (sablon.tur === "zincir") {
      durum.satirlar.forEach((satir, index) => {
        store.run("INSERT INTO maliyet_satirlar (kart, id, sira, ad, birim, miktar, fiyat) VALUES (?, ?, ?, ?, ?, ?, ?)", kod, satir.id, index + 1, satir.ad, satir.birim, satir.miktar, satir.fiyat);
      });
      for (const adim of sablon.adimlar) {
        const kayit = durum.adimlar[adim.kod] || {};
        store.run("INSERT INTO maliyet_adimlar (kart, kod, etiket, deger) VALUES (?, ?, ?, ?)", kod, adim.kod, kayit.etiket ?? adim.etiket, kayit.deger ?? null);
      }
    } else if (sablon.tur === "gramaj") {
      durum.satirlar.forEach((satir, index) => {
        store.run(
          "INSERT INTO maliyet_satirlar (kart, id, sira, ad, birim, giden_mt, boy, br_gramaj, giden_kg, alis_ft, elle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          kod, satir.id, index + 1, satir.parca, satir.cins, satir.giden_mt, satir.boy, satir.br_gramaj, satir.elle ? satir.giden_kg : null, satir.alis_ft, satir.elle ? 1 : 0,
        );
      });
      for (const [k, ad] of Object.entries(durum.sutunlar)) baslik(k, ad);
    } else if (sablon.tur === "matris") {
      for (const [hucre, deger] of Object.entries(durum.hucreler)) if (deger !== null && deger !== undefined) store.run("INSERT INTO maliyet_hucreler (kart, hucre, deger) VALUES (?, ?, ?)", kod, hucre, deger);
      baslik("olcu", durum.olcuBasligi);
      for (const [k, ad] of Object.entries(durum.sutunlar)) baslik(k, ad);
      for (const [k, ad] of Object.entries(durum.olculer)) baslik(k, ad);
    } else {
      durum.satirlar.forEach((satir, index) => {
        store.run("INSERT INTO maliyet_satirlar (kart, id, sira, ad, degerler_json) VALUES (?, ?, ?, ?, ?)", kod, satir.id, index + 1, satir.ad, JSON.stringify(satir.degerler));
      });
      for (const [k, ad] of Object.entries(durum.sutunlar)) baslik(k, ad);
    }
  }

  const parseBody = body => {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Kaydedilecek kartlar okunamadı.", { code: "maliyet-invalid" });
    const kartlar = body.kartlar === undefined ? [] : Array.isArray(body.kartlar) ? body.kartlar : Object.entries(body.kartlar || {}).map(([kod, kart]) => ({ ...kart, kod }));
    const sekmeler = body.sekmeler === undefined ? [] : Array.isArray(body.sekmeler) ? body.sekmeler : Object.entries(body.sekmeler || {}).map(([kod, sekme]) => ({ ...sekme, kod }));
    if (!Array.isArray(kartlar) || !Array.isArray(sekmeler)) throw new HttpError(400, "Kaydedilecek kartlar okunamadı.", { code: "maliyet-invalid" });
    if (kartlar.length > MALIYET_KARTLAR.length || sekmeler.length > MALIYET_SEKMELER.length) throw new HttpError(400, "Aynı kart birden çok kez gönderildi.", { code: "maliyet-invalid" });
    return { kartlar, sekmeler };
  };

  // Gövdedeki her kart için: şablon, kayıt, şimdiki ve yeni durum (doğrulanmış). Doğrulama hatası kartın adıyla döner.
  function hazirla(body) {
    const { kartlar, sekmeler } = parseBody(body);
    const seen = new Set();
    const kartIsleri = kartlar.map(item => {
      const kod = String(item?.kod || "");
      const sablon = sablonKart(kod);
      const kart = sablon ? kartRow(kod) : null;
      if (!sablon || !kart) throw new HttpError(404, "Maliyet kartı bulunamadı.", { code: "maliyet-missing", kart: kod.slice(0, 80) });
      if (seen.has(kod)) throw new HttpError(400, "Aynı kart birden çok kez gönderildi.", { code: "maliyet-invalid" });
      seen.add(kod);
      const once = durumOku(sablon, kart);
      let sonra;
      try {
        sonra = kartUygula(sablon, once, item);
      } catch (error) {
        if (error instanceof HttpError) error.message = `“${kart.ad}”: ${error.message}`;
        if (error instanceof HttpError) error.extra = { ...(error.extra || {}), kart: kod };
        throw error;
      }
      return { kod, sablon, kart, once, sonra, rev: item.rev, degisti: JSON.stringify(once) !== JSON.stringify(sonra) };
    });
    const seenTabs = new Set();
    const sekmeIsleri = sekmeler.map(item => {
      const kod = String(item?.kod || "");
      const row = store.get("SELECT * FROM maliyet_sekmeler WHERE kod = ?", kod);
      if (!row) throw new HttpError(404, "Maliyet sekmesi bulunamadı.", { code: "maliyet-missing", sekme: kod.slice(0, 40) });
      if (seenTabs.has(kod)) throw new HttpError(400, "Aynı sekme birden çok kez gönderildi.", { code: "maliyet-invalid" });
      seenTabs.add(kod);
      const ad = Object.hasOwn(item, "ad") ? adGirdi(item.ad, "Sekme adı", { bos: false, max: 60 }) : row.ad;
      return { kod, row, ad, rev: item.rev, degisti: ad !== row.ad };
    });
    return { kartIsleri, sekmeIsleri };
  }

  /** Ön izleme (Kaydet'ten önce canlı hesap; hiçbir şey yazılmaz). Dönüş: gönderilen kartların görünümü. */
  function onizle(body) {
    const { kartIsleri } = hazirla(body);
    // degisti: taslak kayıtlı hâlden farklı mı (Çık'ta "kaydedilsin mi?" sorusu buna göre sorulur).
    return { kartlar: Object.fromEntries(kartIsleri.map(is => [is.kod, { ...gorunum(is.sablon, is.kart, is.sonra), degisti: is.degisti }])), degisti: kartIsleri.some(is => is.degisti) };
  }

  /**
   * PDF (2.4.7): bir sekmenin kartları EKRANDAKİ hâliyle — gövdede gelen taslak kartlar taslaktan, öbürleri kayıtlı hâlden; sekme adı da taslaktaki.
   * Hiçbir şey yazılmaz. Dönüş: { ad, kartlar: [görünüm] } (sekmenin kart sırasıyla).
   */
  function pdfVerisi(body, sekmeKod) {
    const kod = String(sekmeKod || "");
    const row = store.get("SELECT kod, ad FROM maliyet_sekmeler WHERE kod = ?", kod);
    if (!row) throw new HttpError(404, "Maliyet sekmesi bulunamadı.", { code: "maliyet-missing", sekme: kod.slice(0, 40) });
    const { kartIsleri, sekmeIsleri } = hazirla(body);
    const taslak = new Map(kartIsleri.map(is => [is.kod, is]));
    const ad = sekmeIsleri.find(is => is.kod === kod)?.ad || row.ad;
    const kartlar = store.all("SELECT * FROM maliyet_kartlar WHERE sekme = ? ORDER BY sira, kod", kod)
      .filter(kart => sablonKart(kart.kod))
      .map(kart => (taslak.has(kart.kod) ? gorunum(taslak.get(kart.kod).sablon, kart, taslak.get(kart.kod).sonra) : gorunum(sablonKart(kart.kod), kart)));
    return { ad, kartlar };
  }

  /**
   * Kaydet: değişen kartlar ve sekme adları tek işlemde yazılır; biri bayatsa (rev) HİÇBİRİ yazılmaz (409). Dönüş: { degisen: {kartlar, sekmeler}, ...hepsi() }.
   */
  function kaydet(body, user) {
    const at = iso();
    const result = store.tx(() => {
      const { kartIsleri, sekmeIsleri } = hazirla(body);
      const bayat = [];
      for (const is of kartIsleri) if (is.degisti && Number(is.rev) !== is.kart.rev) bayat.push({ kod: is.kod, ad: is.kart.ad });
      for (const is of sekmeIsleri) if (is.degisti && Number(is.rev) !== is.row.rev) bayat.push({ kod: is.kod, ad: is.row.ad });
      if (bayat.length) {
        throw new HttpError(409, `${bayat.map(item => `“${item.ad}”`).join(", ")}: siz açtıktan sonra başka biri kaydetti; değişiklikleriniz kaydedilmedi. Pencereyi yeniden açıp değişikliği yeniden yapın.`, { code: "maliyet-stale", bayat });
      }
      const kartlar = kartIsleri.filter(is => is.degisti);
      const sekmeler = sekmeIsleri.filter(is => is.degisti);
      for (const is of kartlar) {
        yaz(is.sablon, is.sonra);
        store.run("UPDATE maliyet_kartlar SET ad = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE kod = ?", is.sonra.ad, user?.id || null, at, is.kod);
      }
      for (const is of sekmeler) store.run("UPDATE maliyet_sekmeler SET ad = ?, rev = rev + 1, updated_by = ?, updated_at = ? WHERE kod = ?", is.ad, user?.id || null, at, is.kod);
      return { kartlar: kartlar.map(is => is.kod), sekmeler: sekmeler.map(is => is.kod) };
    });
    return { degisen: result, ...hepsi() };
  }

  return { kur, hepsi, onizle, pdfVerisi, kaydet, tableExists };
}
