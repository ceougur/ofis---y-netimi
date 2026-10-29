// Mobil şifreli özet — program tarafının ÜRETİCİSİ, YÜKLEYİCİSİ ve kapıcı bağlantısı (2.4.7 M3; docs/mobil/M3-TASARIM.md; Eylül planı
// docs/PRO-UZAKTAN-GORUNTULEME.md "Mimari" — Pro maddeleri geçersiz, mobil herkese).
//
// ÖZET: eşli cihazı olan HER KULLANICI için ayrı hazırlanır ve programın KENDİ uçlarından, o kullanıcının yetkisiyle (iç istek; uzak oturum gibi) alınır:
// şirket erişimi (companies.canAccess), rol yetkisi ve lisans kuralı o uçlarda aynen uygulanır — burada TEKRAR EDİLMEZ (K23: yetkisiz veri o cihazın
// açabileceği özete hiç girmez). Bölümler (Eylül listesi + M1 ekranları): oturum (görebildiği şirketler), Nakit Kasa, Banka, Cari Hesaplar (liste + ilk
// carilerin ayrıntısı), Stok (liste + ayrıntı), Taksit özeti, Anlık Durum (yalnız yönetici). Raporlar (parametreli) ve PDF/Excel çevrimdışı yok.
//
// YÜKLEME TETİKLERİ (Eylül planı): veri değişince en geç 15 dakikada bir, 10 dakika hareketsizlikte bir kez daha; değişiklik yoksa hiç; günde en çok 40 veri
// yüklemesi. GÜVENLİK değişiklikleri (eşleme, cihaz silme, uzak izin, kullanıcı/rol/şirket erişimi, lisans) HEMEN yüklenir (sınır beklemez; silinen cihaz
// ve daralan yetki hemen yansır). Program kapanırken bekleyen değişiklik varsa son hâl yüklenir ("sunucu kapalıyken son hâl").
// Lisans yazılabilir değilse yüklenmez (K14); kapıcıya yalnız lisansın son hâli bildirilir.
import { Readable } from "node:stream";
import { HttpError, REMOTE_REQUEST, REMOTE_SESSION, parseCookies } from "./http.mjs";
import { DEVICE_COOKIE, REMOTE_ERRORS, publicKeyOf } from "./mobile-remote.mjs";
import { captureResponse } from "./mobile.mjs";
import { isaretDogrula, kapiIstemcisi, kayitKabul, kayitZamani, ofisKaydi, ozetPaketle, sonrakiSira } from "./mobile-ozet.mjs";
import { KAPI_KURALLARI, trGunu } from "./kapi-protokol.mjs";

export const OZET_KURALLARI = Object.freeze({
  veriAraligiMs: 15 * 60_000, // en çok 15 dakikada bir veri yüklemesi
  hareketsizMs: 10 * 60_000, // 10 dakika hareketsizlikte
  gunlukVeri: 40, // günde en çok 40 veri yüklemesi (29.10.2026 Q3, 5 dk yetkisiyle: Eylül planındaki 20 yoğun ofiste öğleden sonra doluyordu; güvenlik yüklemeleri sayılmaz; kapıcının kendi sınırı günde 200)
  carSatir: 500, // cari listesinde en çok
  cariAyrinti: 50, // ayrıntısı özete giren ilk cariler
  stokSatir: 500,
  stokAyrinti: 30,
  azamiBayt: 6 * 1024 * 1024, // aşılırsa ayrıntılar kırpılır
  turMs: 30_000, // zamanlayıcı turu
  kapanisMs: 5_000, // kapanışta son yükleme için en çok bekleme
});

// Yazma isteğinin türü: güvenlik (hemen), veri (zamanlı) ya da yok sayılır (giriş/çıkış, mobil oturum).
export function yazmaTuru(method, pathname) {
  if (method === "GET" || method === "HEAD" || !pathname.startsWith("/api/")) return null;
  // Karekod üretmek görünen veriyi ve cihaz listesini değiştirmez (eşleme ayrıca tetikler) → yüklemez.
  if (/^\/api\/(auth|public|health)(\/|$)/.test(pathname) || /^\/api\/mobil\/session(\/|$)/.test(pathname) || /^\/api\/admin\/mobile\/codes(\/|$)/.test(pathname)) return null;
  // B5 (2.4.7 bağımsız gözden geçirme): masaüstünde şirket SEÇMEK (kişinin görünümü; veri/yetki değişmez), elle lisans denetimi ve deneme iletişim bilgisi
  // özeti değiştirmez → yüklemez (her biri tam yükleme doğurup kapıcının günlük sınırını dolduruyordu). Lisans belirteci yenilendiyse zamanlayıcı turu yalnız
  // kapıcı kaydını gönderir (turAt). Şirket ERİŞİMİ, şirket oluşturma/silme/sıfırlama/ayırma ve lisans etkinleştirme güvenlik olarak kalır.
  if (pathname === "/api/companies/select" || /^\/api\/license\/(check|contact)$/.test(pathname)) return null;
  if (/^\/api\/(admin\/(users|roles|mobile)|companies|license)(\/|$)/.test(pathname) || pathname === "/api/mobil/eslesme") return "guvenlik";
  return "veri";
}

/**
 * @param {object} o
 * @param {object} o.store ortak katmanın veri tabanı
 * @param {object} o.license lisans hizmeti (status().writable, tokenEnvelope())
 * @param {object} o.mobileRemote M2 (gatekeeperSnapshot, setGatekeeper, setPublicUrl)
 * @param {Function} o.dispatch uygulamanın dağıtıcısı (iç istek)
 * @param {object} o.clock uzaktan erişim saati (config.remoteNow)
 * @param {{ url: string, officeUrl: string }} o.kapi kapıcı adresi ("" = kapalı) ve telefon adresi kalıbı ("https://{ofis}.destekofis.net")
 */
export function createMobileSync({ store, license, mobileRemote, dispatch, clock, kapi = {}, fetchImpl = (...a) => globalThis.fetch(...a), log = console, otomatik = true }) {
  const url = String(kapi.url || "");
  const enabled = Boolean(url);
  // B2b: kapıcı yanıtlarının HTTP Date başlığından ölçülen saat farkı (kapıcı − bu bilgisayar). Program kapıcıya giden imza zamanlarını ve kapıcının işaretini
  // (x-do-kapi) doğrularken bu farkla düzeltilmiş saati kullanır; Yönetim → Mobil Cihazlar farkı gösterir. Başlık 1 sn çözünürlüklüdür: |fark| < 2 sn ölçüm
  // payıdır (düzeltme yok). Başlık hiç gelmezse fark 0 kalır (düzeltme yok).
  const saat = { farkMs: 0, olcumMs: null };
  const kapiSaati = () => clock.ms() + saat.farkMs;
  const saatOlc = tarihMs => {
    const ham = clock.ms();
    saat.farkMs = Math.abs(tarihMs - ham) < 2_000 ? 0 : tarihMs + 500 - ham;
    saat.olcumMs = ham;
  };
  // B2: kayıt zamanı yalnız kapıcı kabul edince kalıcı yazılır; bellekte son verilen (eşzamanlı iki kayıt aynı zamanı almasın; ileri değer kırpılır).
  let sonVerilenKayit = 0;
  const istemci = enabled
    ? kapiIstemcisi({
        url,
        fetchImpl,
        simdi: kapiSaati,
        kayitSimdi: () => (sonVerilenKayit = kayitZamani(store, kapiSaati(), sonVerilenKayit)),
        kayitKabul: ms => kayitKabul(store, ms),
        saatOlc,
      })
    : null;
  let ofis = null;
  let hazir = null;
  const durum = { son: null, kayit: null, kirliIlk: null, kirliSon: null, veriGun: "", veriSayisi: 0, sonVeri: 0, sonKayitImzasi: "", bekleyenGuvenlik: false };
  let kuyruk = Promise.resolve();
  let tur = null;
  let kapali = false;

  async function hazirla() {
    if (!hazir) {
      hazir = (async () => {
        ofis = await ofisKaydi(store);
        if (kapi.officeUrl && !mobileRemote.publicUrl()) mobileRemote.setPublicUrl(String(kapi.officeUrl).replace("{ofis}", ofis.id));
        return ofis;
      })();
    }
    return hazir;
  }

  // ---------- İç istek: kullanıcının uzak oturumuyla (yetki programın uçlarında) ----------
  async function icIstek(userId, path) {
    const req = Readable.from([]);
    Object.assign(req, { method: "GET", url: path, headers: { host: "ozet.ic", accept: "application/json", "x-requested-with": "DestekOfisMobile" }, socket: { remoteAddress: "127.0.0.1" } });
    req[REMOTE_REQUEST] = true;
    req[REMOTE_SESSION] = { userId, deviceId: "ozet" };
    const captured = captureResponse();
    await dispatch(req, captured.res);
    let payload = null;
    try {
      payload = JSON.parse(captured.body().toString("utf8"));
    } catch {
      payload = null;
    }
    return { status: captured.res.statusCode, ok: captured.res.statusCode === 200 && payload?.ok === true, data: payload?.data };
  }

  async function kullaniciOzeti(userId, uretim) {
    const oturum = await icIstek(userId, "/api/mobil/session");
    if (!oturum.ok) return null;
    const sirketler = {};
    for (const company of oturum.data.companies || []) {
      const q = `company=${encodeURIComponent(company.id)}`;
      const hq = `hofCompany=${encodeURIComponent(company.id)}`;
      const bolum = {};
      for (const p of ["/cash", "/bank", "/bank/accounts", "/plans", "/overview"]) {
        const r = await icIstek(userId, `/api/mobil${p}?${q}`);
        if (r.ok) bolum[p] = r.data;
      }
      const cariler = await icIstek(userId, `/api/workspace/accounts?limit=${OZET_KURALLARI.carSatir}&${hq}`);
      if (cariler.ok) {
        bolum["/accounts"] = cariler.data;
        for (const item of (cariler.data.accounts || []).slice(0, OZET_KURALLARI.cariAyrinti)) {
          const r = await icIstek(userId, `/api/mobil/accounts/${encodeURIComponent(item.id)}?${q}`);
          if (r.ok) bolum[`/accounts/${item.id}`] = r.data;
        }
      }
      const stok = await icIstek(userId, `/api/workspace/stock?limit=${OZET_KURALLARI.stokSatir}&${hq}`);
      if (stok.ok) {
        bolum["/stock"] = stok.data;
        for (const item of (stok.data.items || []).slice(0, OZET_KURALLARI.stokAyrinti)) {
          const r = await icIstek(userId, `/api/mobil/stock/${encodeURIComponent(item.id)}?${q}`);
          if (r.ok) bolum[`/stock/${item.id}`] = r.data;
        }
      }
      sirketler[company.id] = bolum;
    }
    const veri = { v: 1, uretim, oturum: oturum.data, sirketler };
    // Boyut sınırı: önce ayrıntılar (cari/stok kartları) kırpılır; liste ve bakiyeler kalır.
    if (JSON.stringify(veri).length > OZET_KURALLARI.azamiBayt / 2) {
      for (const bolum of Object.values(sirketler)) for (const key of Object.keys(bolum)) if (/^\/(accounts|stock)\/./.test(key)) delete bolum[key];
      veri.kirpildi = true;
    }
    return veri;
  }

  // ---------- Kapıcıya kayıt (lisans belirteci + cihaz listesi + işaret sırrı) ----------
  // M2 cihaz listesi + şifreleme anahtarı (göç v39 mobile_devices.enc_key; M2 kodu değişmeden burada okunur).
  const cihazlar = () => {
    const anahtarlar = new Map(store.all("SELECT id, enc_key FROM mobile_devices WHERE revoked_at IS NULL AND enc_key IS NOT NULL").map(row => [row.id, row.enc_key]));
    return mobileRemote.gatekeeperSnapshot().devices.map(d => ({ ...d, encKey: anahtarlar.has(d.id) ? JSON.parse(anahtarlar.get(d.id)) : null }));
  };
  // Kapıcı lisansı en çok 1 saat eski kabul eder (P9): programın belirteci 50 dakikadan eskiyse kayıttan önce lisans servisinden yenilenir (ulaşılamazsa
  // eskisiyle sürer; kapıcı süresi dolunca kendisi kapatır).
  const belirtecYasi = zarf => {
    try {
      return clock.ms() - Date.parse(JSON.parse(Buffer.from(zarf.payload, "base64").toString("utf8")).issuedAt);
    } catch {
      return Infinity;
    }
  };
  async function kayitGonder({ ekCihazlar = [], zorla = false } = {}) {
    await hazirla();
    const ilk = license?.tokenEnvelope?.() || null;
    // 50 dk: kapıcının 1 saatlik sınırına 10 dk pay; etkin ofiste saatte en çok bir lisans sorgusu (lisans servisine yük bindirmez).
    if (ilk && belirtecYasi(ilk) >= KAPI_KURALLARI.lisansTazeMs - 10 * 60_000) await license.check?.().catch(() => null);
    const lisans = license?.tokenEnvelope?.() || null;
    if (!lisans) return { ok: false, code: "lisans-yok", error: "Lisans belirteci yok." };
    const liste = [...cihazlar().map(d => ({ id: d.id, anahtar: d.publicKey })), ...ekCihazlar];
    const imza = JSON.stringify([lisans.payload, liste.map(d => d.id)]);
    if (!zorla && imza === durum.sonKayitImzasi) return { ok: true, data: durum.kayit, onceden: true };
    const farkOnce = saat.farkMs;
    let sonuc = await istemci.kayit(ofis, { lisans, cihazlar: liste });
    // B2b: kapıcı "saat uyuşmuyor" dediyse ve yanıtının Date başlığı yeni bir fark gösterdiyse düzeltilmiş saatle bir kez yinelenir.
    if (sonuc.code === "kapi-zaman" && saat.farkMs !== farkOnce) sonuc = await istemci.kayit(ofis, { lisans, cihazlar: liste });
    if (sonuc.code === "kapi-yaris" || sonuc.code === "kapi-sira") sonuc = await istemci.kayit(ofis, { lisans, cihazlar: liste });
    if (sonuc.ok) {
      durum.sonKayitImzasi = imza;
      durum.kayit = sonuc.data;
    } else durum.sonKayitImzasi = "";
    return sonuc;
  }

  // ---------- Yükleme (sıralı; aynı anda tek) ----------
  async function yukle(neden) {
    await hazirla();
    const t = clock.ms();
    const uretim = new Date(t).toISOString();
    const sonucYaz = sonuc => {
      durum.son = { zaman: uretim, neden, ok: sonuc.ok, kod: sonuc.code || "", mesaj: sonuc.error || "" };
      if (!sonuc.ok) log.warn?.(`Mobil özet yüklenemedi (${neden}): ${sonuc.code} ${sonuc.error || ""}`);
      return sonuc;
    };
    const kayitSonucu = await kayitGonder({ zorla: neden === "guvenlik" || neden === "elle" });
    if (!kayitSonucu.ok) return sonucYaz(kayitSonucu);
    let writable = false;
    try {
      writable = Boolean(license?.status?.().writable);
    } catch {
      writable = false;
    }
    if (!writable) return sonucYaz({ ok: false, code: "lisans", error: "Lisans geçerli değil; özet yüklenmedi." });
    const liste = cihazlar().filter(d => d.encKey);
    const sira = sonrakiSira(store);
    if (!liste.length) {
      const silindi = await istemci.ozetSil(ofis, sira);
      durum.kirliIlk = durum.kirliSon = null;
      return sonucYaz(silindi.ok ? { ok: true, data: { sira, cihaz: 0 } } : silindi);
    }
    const kullanicilar = [];
    const gruplar = new Map();
    for (const d of liste) gruplar.set(d.userId, [...(gruplar.get(d.userId) || []), d]);
    let n = 0;
    for (const [userId, devs] of gruplar) {
      const veri = await kullaniciOzeti(userId, uretim);
      if (!veri) continue;
      n += 1;
      kullanicilar.push({ anahtar: `u${n}`, veri, cihazlar: devs.map(d => ({ id: d.id, sifre: d.encKey })) });
    }
    const zarf = await ozetPaketle({ ofis: ofis.id, sira, uretim, kullanicilar, imzaAnahtari: ofis.imzaAnahtari });
    const sonuc = await istemci.ozetYukle(ofis, zarf);
    if (sonuc.ok) {
      durum.kirliIlk = durum.kirliSon = null;
      return sonucYaz({ ok: true, data: { sira, cihaz: liste.length, kullanici: kullanicilar.length, bayt: zarf.length } });
    }
    return sonucYaz(sonuc);
  }
  function sirala(neden) {
    const is = kuyruk.then(() => yukle(neden)).catch(error => {
      log.error?.("Mobil özet yüklemesi beklenmedik biçimde durdu", error);
      return { ok: false, code: "hata", error: String(error?.message || error) };
    });
    kuyruk = is.then(() => {});
    return is;
  }

  // ---------- Tetikler ----------
  const etkin = () => enabled && !kapali && Boolean(license?.tokenEnvelope?.());
  function noteWrite(method, pathname) {
    if (!etkin()) return;
    const tur2 = yazmaTuru(method, pathname);
    if (!tur2) return;
    if (tur2 === "guvenlik") {
      // Arka arkaya gelen güvenlik değişiklikleri tek yüklemede birleşir (kuyrukta bekleyen varsa yeni iş açılmaz).
      if (durum.bekleyenGuvenlik) return;
      durum.bekleyenGuvenlik = true;
      kuyruk = kuyruk.then(() => {
        durum.bekleyenGuvenlik = false;
      });
      sirala("guvenlik");
      return;
    }
    const t = clock.ms();
    durum.kirliIlk ??= t;
    durum.kirliSon = t;
  }
  // Veri yüklemesinin zamanı geldi mi (saf; test edilir).
  function veriZamani(t) {
    if (durum.kirliIlk === null) return false;
    const gun = trGunu(t);
    if (gun !== durum.veriGun) {
      durum.veriGun = gun;
      durum.veriSayisi = 0;
    }
    if (durum.veriSayisi >= OZET_KURALLARI.gunlukVeri) return false;
    if (durum.sonVeri && t - durum.sonVeri < OZET_KURALLARI.veriAraligiMs) return false;
    return t - durum.kirliSon >= OZET_KURALLARI.hareketsizMs || t - durum.kirliIlk >= OZET_KURALLARI.veriAraligiMs;
  }
  async function turAt() {
    if (!etkin()) return null;
    const t = clock.ms();
    if (!cihazlar().some(d => d.encKey)) {
      durum.kirliIlk = durum.kirliSon = null;
      return null;
    }
    // Lisans belirteci yenilendiyse (programın 12 saatlik denetimi) kapıcıya bildirilir (yalnız kayıt; özet yüklenmez).
    if (veriZamani(t)) {
      durum.veriSayisi += 1;
      durum.sonVeri = t;
      return sirala("veri");
    }
    return kayitGonder();
  }
  function baslat() {
    if (!enabled || !otomatik || tur) return;
    tur = setInterval(() => {
      turAt().catch(error => log.warn?.(`Mobil özet turu: ${error?.message || error}`));
    }, OZET_KURALLARI.turMs);
    tur.unref?.();
    // Açılışta kapıcıya kayıt (ilk eşlemeden önce kapıcı ofisi tanısın; lisansın son hâli de gider).
    setTimeout(() => {
      if (etkin()) kayitGonder().catch(() => {});
    }, 2_000).unref?.();
  }

  // ---------- Kapıcı işareti (lib/mobile-remote.mjs) ----------
  // ---------- M2 kapısına bağlantı (lib/mobile-remote.mjs setGatekeeper) ----------
  mobileRemote.setGatekeeper({
    // Eşleme isteğindeki şifreleme anahtarı (ECDH P-256, açık kısmı; isteğe bağlı). Gizli bileşen taşıyan ya da bozuk anahtar eşlemeden ÖNCE reddedilir.
    encKeyOf: body => {
      const raw = body?.sifre ?? body?.encKey;
      if (raw === undefined || raw === null) return null;
      try {
        return publicKeyOf(raw);
      } catch {
        throw new HttpError(400, REMOTE_ERRORS["remote-key"], { code: "remote-key" });
      }
    },
    // Eşleme kaydedildikten sonra: şifreleme anahtarı cihaz satırına; telefona ofis kimliği ve özet imza anahtarı.
    paired: (deviceId, encKey) => {
      if (encKey) store.run("UPDATE mobile_devices SET enc_key = ? WHERE id = ?", JSON.stringify(encKey), deviceId);
      return ofis ? { ofis: { kimlik: ofis.id, anahtar: ofis.acik } } : {};
    },
    // Kapıcı açıkken her uzak istek kapıcının işaretini taşımalı (cihaz → lisans → yol kapıcıda denetlendi; tünel kapıcıyı atlatamaz). İşaretteki cihaz,
    // cihaz çerezinin kimliğiyle aynı olmalı (kapıcı çerezin kimlik bölümünü gördü; sırrı M2 doğrular). Başlık her durumda silinir.
    rejects: req => {
      const header = req.headers["x-do-kapi"];
      delete req.headers["x-do-kapi"];
      if (!enabled) return false;
      if (!ofis) return true;
      const checked = isaretDogrula(header, { yontem: req.method === "HEAD" ? "GET" : req.method, yolSorgu: String(req.url || "/"), sir: ofis.sir, simdi: kapiSaati() });
      const cookieId = (parseCookies(req.headers.cookie || "")[DEVICE_COOKIE] || "").split(".")[0] || "-";
      return !checked.ok || checked.cihaz !== cookieId;
    },
  });
  if (enabled) hazirla().catch(error => log.error?.("Mobil ofis kimliği hazırlanamadı", error));

  // Başarılı yazma isteği özetin tetiğidir (güvenlik: hemen; veri: zamanlı). Yanıt bitince bildirilir (yazma kalıcıdır). app.mjs her istekte çağırır.
  function izle(req, res) {
    const method = req.method;
    if (!enabled || method === "GET" || method === "HEAD") return;
    const pathname = String(req.url || "/").split("?")[0];
    res.once("finish", () => {
      if (res.statusCode < 400) noteWrite(method, pathname);
    });
  }

  return {
    enabled: () => enabled,
    izle,
    hazirla,
    ofis: async () => {
      await hazirla();
      return { id: ofis.id, acik: ofis.acik, publicUrl: mobileRemote.publicUrl() };
    },
    noteWrite,
    uploadNow: (neden = "elle") => (enabled ? sirala(neden) : Promise.resolve({ ok: false, code: "kapi-kapali", error: "Kapıcı adresi tanımlı değil." })),
    kayitGonder: secenek => (enabled ? kayitGonder(secenek) : Promise.resolve({ ok: false, code: "kapi-kapali" })),
    idle: () => kuyruk,
    tick: turAt,
    veriZamani,
    // Kapıcının saati (bu bilgisayarın saati + ölçülen fark); tünel başvurusu (lib/tunnel/attach.mjs) imza zamanını bununla verir (B2b).
    kapiSaati,
    // saat: kapıcıyla ölçülen saat farkı (B2b; ölçülmediyse null). Yönetim → Mobil Cihazlar ≥ 2 dk'da uyarır.
    status: () => ({
      enabled,
      ofis: ofis?.id || "",
      publicUrl: mobileRemote.publicUrl(),
      son: durum.son,
      bekleyen: durum.kirliIlk !== null,
      saat: saat.olcumMs === null ? null : { farkMs: saat.farkMs, olcum: new Date(saat.olcumMs).toISOString() },
    }),
    start: baslat,
    // Kapanışta: bekleyen veri değişikliği varsa son hâl yüklenir (en çok kapanisMs beklenir).
    async flush() {
      if (!etkin()) return;
      clearInterval(tur);
      tur = null;
      if (durum.kirliIlk !== null && cihazlar().some(d => d.encKey)) {
        await Promise.race([sirala("kapanis"), new Promise(resolve => setTimeout(resolve, OZET_KURALLARI.kapanisMs).unref?.())]);
      }
      await Promise.race([kuyruk, new Promise(resolve => setTimeout(resolve, OZET_KURALLARI.kapanisMs).unref?.())]);
      kapali = true;
    },
  };
}

// app.mjs'teki tek bağlantı: yapılandırmadan kurulum (kapıcı adresi yoksa hiçbir dış istek yok).
export const mobileSyncFromConfig = ({ config, ...rest }) =>
  createMobileSync({ ...rest, clock: config.remoteNow, kapi: { url: config.mobileKapiUrl, officeUrl: config.mobileOfficeUrl }, fetchImpl: config.mobileKapiFetch || config.fetchImpl, otomatik: config.mobileSyncAuto });
