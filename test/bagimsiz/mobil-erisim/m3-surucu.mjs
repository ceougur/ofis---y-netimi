// Mobil uzaktan erişim kâhininin PROGRAM SÜRÜCÜSÜ — M3 eki (2.4.7; kâhin bu dosyayı okumaz). program-surucu.mjs'e yalnız bağlantı satırlarıyla takılır.
//
// M3'te uzak istek ÜRETİMDEKİ GİBİ önce kapıcıdan (bulut/kapi/kapi.mjs — yerel, sahte R2, aynı sahte saat; test/kapi-yerel.mjs) geçer: telefon kapıcıya ofisin
// adresiyle (<ofis>.destekofis.test, Host başlığı) bağlanır; kapıcı cihaz → lisans (P9) → yol denetiminden sonra "tünelden" (ofisin uzak dinleyicisi) iletir ve
// program kapıcının işaretini (x-do-kapi) doğrular. Kapıcının lisans servisi = sürücünün sahte lisans servisi (ofisin kaydı, servis erişimi; ders 30).
//
// Eşleme tablosu (M3 olayları; karşılaştırmadan ÖNCE yazıldı — ders 5, 40):
//   ozet_yukle            → programın yükleyicisi (mobileSync.uploadNow); kapıcının yanıtı → kabul / ret sınıfı
//   ozet_oku              → cihazın imzalı isteği (kapıcı /kapi/ozet) + ofis imzası doğrulanıp cihazın anahtarıyla çözülür; gorunur = şirket kodu → bölümler
//                           (/cash kasa, /accounts cari, /stock stok, /plans taksit, /overview anlik_durum); ozet_zamani = özetin üretim anı
//   ozet_yaz              → cihazın imzalı PUT /kapi/ozet (kapıcı yazma_yasak bekler)
//   kapici_dogrudan_kayit → programı atlayıp kapıcının kayıt ucuna OFİSİN kimlik bilgileriyle (programın kapıcı istemcisi) cihaz eklemek: programın
//                           cihazları + bu ofiste daha önce böyle eklenenler + yenisi. esli = kapıcının sayısı (kapıcı olayı).
//   basliklar.Host (kâhinin "yerel" taklidi) → yok sayılır, istek ofisin adresiyle gider: Cloudflare kenarı yönlendirmeyi Host'a göre yapar; başka Host'lu istek
//                           ofisin kapıcısına (ve tünele) hiç ulaşmaz. Taklit X-Forwarded-For / X-Real-IP olduğu gibi iletilir (program siler — K19).
import { generateKeyPairSync } from "node:crypto";
import { startKapi } from "../../kapi-yerel.mjs";

export const M3_SINIFLAR = Object.freeze({
  "kapi-cihaz": "cihaz_yok",
  "kapi-imza": "cihaz_yok",
  "kapi-zaman": "cihaz_yok",
  "kapi-ofis-yok": "cihaz_yok",
  "kapi-lisans": "lisans_gecersiz",
  "kapi-lisans-dogrulanamadi": "lisans_dogrulanamadi",
  "kapi-ozet-yok": "ozet_yok",
  "kapi-yazma": "yazma_yasak",
  "kapi-yol": "yol_yasak",
  "kapi-ofis-kapali": "sunucu_kapali",
  "kapi-sinir": "sinir_dolu",
  "remote-kapi": "kapi_isareti_yok",
  lisans: "lisans_gecersiz",
  "lisans-yok": "lisans_gecersiz",
});
const BOLUM = { "/cash": "kasa", "/accounts": "cari", "/stock": "stok", "/plans": "taksit", "/overview": "anlik_durum" };
const ALAN = "destekofis.test";

/** Senaryo başına bir kapıcı. offices: sürücünün ofisleri (machine, record, server, companyIds). fetchFor: sürücünün sahte lisans servisi. */
export async function m3Kur({ clock, offices, fetchFor, trustedKeys }) {
  const kapi = await startKapi({
    now: () => clock.ms(),
    alan: ALAN,
    trustedKeys,
    lisansFetch: async (url, init) => {
      const { machine } = JSON.parse(init.body);
      const office = Object.values(offices).find(o => o.machine === machine);
      if (!office) throw new TypeError("bilinmeyen makine");
      const yanit = await fetchFor(office)(url, init);
      return { json: () => yanit.json() };
    },
  });
  const atlatan = new Map(); // ofis → [{ id, anahtar }] (kapıcıya doğrudan eklenen cihazlar)
  const ofisId = office => office.m3Ofis;
  const host = name => (offices[name]?.m3Ofis ? { host: kapi.ofisHost(offices[name].m3Ofis) } : {});
  const classify = (status, code) => (status >= 200 && status < 300 ? "kabul" : `ret:${M3_SINIFLAR[code] || `tanınmadı_${status}_${code || "kodsuz"}`}`);

  const codeOf = (office, companyId) => Object.entries(office.companyIds || {}).find(([, id]) => id === companyId)?.[0] || companyId;
  async function ozetOku(e, { office, phones, phoneOf, record }) {
    const entry = phones.get(e.cihaz) || phoneOf(e.cihaz, e.ofis);
    const phone = entry.phone;
    const r = await phone.readSummary({ method: e.olay === "ozet_yaz" ? "PUT" : "GET", now: clock.ms(), deviceId: phone.deviceId, headers: host(e.ofis) });
    if (e.olay === "ozet_yaz" || r.status !== 200) return record(classify(r.status, r.code));
    const gorunur = {};
    for (const [companyId, bolumler] of Object.entries(r.veri?.sirketler || {})) {
      gorunur[codeOf(office, companyId)] = Object.keys(bolumler).map(k => BOLUM[k]).filter(Boolean).sort();
    }
    return record("kabul", { gorunur, ozet_zamani: r.veri?.uretim ?? null });
  }

  return {
    kapi,
    olaylar: new Set(["ozet_yukle", "ozet_oku", "ozet_yaz", "kapici_dogrudan_kayit"]),
    // Kapıcıdan geçen canlı olaylar: ofis kapalıyken de kapıcıya gider (kapıcı önce cihaz/lisans/yol denetler, sonra "ofis kapalı").
    kapidan: e => e.olay === "giris" || e.olay === "istek",
    host,
    // startTestServer'a: kapıcı açık, telefon adresi kalıbı, zamanlayıcı yok (yükleme olaylarla; güvenlik yüklemesi hemen).
    sunucu: () => ({ mobileKapiUrl: kapi.base, mobileOfficeUrl: `http://{ofis}.${ALAN}`, mobileSyncAuto: false }),
    async acildi(office) {
      office.m3Ofis = (await office.server.app.mobileSync.ofis()).id;
      office.programBase = office.remoteBase;
      kapi.tunel(office.m3Ofis, office.remoteBase);
      office.remoteBase = kapi.base;
      await office.server.app.mobileSync.kayitGonder();
    },
    kayit: office => office.server.app.mobileSync.kayitGonder({ zorla: true }),
    kapandi: office => kapi.tunel(ofisId(office), null),
    async bekle() {
      for (const office of Object.values(offices)) if (office.up) await office.server.app.mobileSync.idle();
    },
    async olay(e, ctx) {
      const { office, record } = ctx;
      if (e.olay === "ozet_oku" || e.olay === "ozet_yaz") return ozetOku(e, ctx);
      if (!office.up) return record("ret:sunucu_kapali");
      if (e.olay === "ozet_yukle") {
        const r = await office.server.app.mobileSync.uploadNow("elle");
        return record(r.ok ? "kabul" : `ret:${M3_SINIFLAR[r.code] || `tanınmadı_${r.status || 0}_${r.code}`}`);
      }
      // kapici_dogrudan_kayit
      const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
      const jwk = publicKey.export({ format: "jwk" });
      const liste = atlatan.get(e.ofis) || [];
      const yeni = { id: `dev-${globalThis.crypto.randomUUID()}`, anahtar: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
      const r = await office.server.app.mobileSync.kayitGonder({ ekCihazlar: [...liste, yeni], zorla: true });
      if (r.ok) atlatan.set(e.ofis, [...liste, yeni]);
      const sayi = r.ok ? r.data?.cihaz : (kapi.meta(ofisId(office))?.cihazlar || []).length;
      return record(r.ok ? "kabul" : `ret:${M3_SINIFLAR[r.code] || `tanınmadı_${r.status || 0}_${r.code}`}`, { esli: { [office.name]: sayi } });
    },
    kapat: () => kapi.close(),
  };
}
