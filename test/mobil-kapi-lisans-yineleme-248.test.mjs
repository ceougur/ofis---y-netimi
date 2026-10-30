// 2.4.8 (ORTA bulgu, Cloudflare kotası): lisansı süresi dolmuş deneme ya da engelli olan ve eşli cihazı olan program, kapıcı her kayıtta "kapi-lisans" döndürdüğü
// için zamanlayıcı turunda (OZET_KURALLARI.turMs, 30 sn) kapıcıya yeniden kayıt gönderiyordu: ofis başına günde ~2.880 Worker isteği. Beklenen: aynı imza
// (lisans belirteci + cihaz listesi) için OZET_KURALLARI.lisansRetMs (1 saat) boyunca kapıcıya kayıt gitmez, son ret yanıtı döner; 1 saat sonra bir kez daha;
// belirteç değişince ya da zorla (güvenlik/elle) hemen. GERÇEK program (createApp, sahte saat) + yerel kapıcı (bulut/kapi/kapi.mjs, sahte R2) + sahte lisans
// servisi (işlev; ders 30: gerçek lisans servisine ve Cloudflare'e istek YOK). Eski kodda (009674a1) her tur bir kayıt isteği → beklenen nedenle kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { OZET_KURALLARI } from "../server/lib/mobile-sync.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { createPhone } from "./mobil-uzak-ortak.mjs";

const DK = 60_000;
const MACHINE = "0123456789abcdef0123456789abcdef";
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const TUR = 30_000;

async function kur() {
  // Kapıcıya giden istekler bu sarmalayıcıdan geçer: ag.kesik iken kayıt isteği ağ hatasıyla düşer (kapıcı kapalı / ulaşılamıyor); her deneme saatiyle yazılır.
  const ag = { kesik: false, denemeler: [] };
  let saatOku = () => 0;
  const mobileKapiFetch = async (adres, secenek) => {
    if (String(adres).endsWith("/kayit")) {
      ag.denemeler.push(saatOku());
      if (ag.kesik) throw new TypeError("fetch failed (test: kapıcı kapalı)");
    }
    return globalThis.fetch(adres, secenek);
  };
  const clock = createClock({ time: new Date(BITIS - 10 * 86_400_000).toISOString(), fixed: true });
  const lisans = lisansAnahtari();
  const durum = { kind: "trial", status: "active", expiresAt: new Date(BITIS).toISOString(), licenseId: "DEN-YINELEME-TEST" };
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, ...durum });
  const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }) });
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    mobileKapiFetch,
    license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.yineleme.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
  });
  await server.app.license.startTrial({});
  saatOku = () => clock.ms();
  const sync = server.app.mobileSync;
  const ofis = await sync.ofis();
  const close = async () => {
    await server.close().catch(() => {});
    await kapi.close();
  };
  try {
    assert.equal((await sync.kayitGonder()).ok, true, "ön koşul: kapıcı kaydı");
    const remote = await server.app.listenRemote(0, "127.0.0.1");
    kapi.tunel(ofis.id, `http://127.0.0.1:${remote.port}`);
    await esle(server, sync, kapi, ofis);
  } catch (error) {
    await close();
    throw error;
  }
  const kayitYolu = `/v1/ofis/${ofis.id}/kayit`;
  return {
    clock,
    server,
    sync,
    ag,
    kayitSayisi: () => kapi.gunluk.filter(g => g.yontem === "POST" && g.adres.endsWith(kayitYolu)).length,
    close,
  };
}

async function esle(server, sync, kapi, ofis) {
  const admin = await loginAdmin(server);
  const id = Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(u => [u.username, u.id])).admin;
  assert.equal((await admin.put(`/api/admin/mobile/access/${id}`, { remote: true })).status, 200);
  await sync.idle();
  const kod = await admin.post("/api/admin/mobile/codes", { userId: id });
  assert.equal(kod.status, 200, JSON.stringify(kod.data));
  assert.equal((await createPhone(kapi.base, { host: kapi.ofisHost(ofis.id) }).pair(kod.data.data.code)).status, 200, "ön koşul: kapıcı üzerinden eşleme");
  await sync.idle();
}

describe("2.4.8 — kapıcı 'kapi-lisans' dönerken program kaydı her turda yinelemez (Cloudflare günlük istek kotası)", () => {
  it("1 saatlik pencerede tek kayıt isteği; pencere bitince bir kez daha; belirteç değişince ve zorla hemen", async () => {
    const c = await kur();
    try {
      // Deneme bitti: masaüstünde lisans sorgusu belirteci yeniler (durum süresi dolmuş deneme).
      const t0 = BITIS + 1000;
      c.clock.set(t0);
      await c.server.app.license.check();
      const once = c.kayitSayisi();
      const ilk = await c.sync.tick();
      assert.equal(ilk?.code, "kapi-lisans", `ön koşul: kapıcı kaydı lisans nedeniyle reddeder: ${JSON.stringify(ilk)}`);
      assert.equal(c.kayitSayisi() - once, 1, "ilk tur kapıcıya bir kayıt gönderir");

      // 1 saatlik pencere: 30 sn'lik turlar (119 tur) kapıcıya gitmez, son ret yanıtı döner.
      const kodlar = new Set();
      for (let t = t0 + TUR; t < t0 + 60 * DK; t += TUR) {
        c.clock.set(t);
        kodlar.add((await c.sync.tick())?.code);
      }
      const pencere = c.kayitSayisi() - once;
      assert.equal(pencere, 1, `1 saatte kapıcıya giden kayıt isteği: ${pencere} (beklenen 1; her tur yineleniyorsa ~120 → günde ~2.880 Worker isteği)`);
      assert.deepEqual([...kodlar], ["kapi-lisans"], "pencerede her tur son ret yanıtını döndürür");

      // Pencere bitti: bir kez daha (kapıcının L1 "kayıt silindi" bildirimi saatte bir kayıtta görülür), sonra yine bekler.
      c.clock.set(t0 + 60 * DK);
      assert.equal((await c.sync.tick())?.code, "kapi-lisans");
      for (let t = t0 + 60 * DK + TUR; t < t0 + 90 * DK; t += TUR) {
        c.clock.set(t);
        await c.sync.tick();
      }
      assert.equal(c.kayitSayisi() - once, 2, `1 saat sonra tam bir kayıt daha (toplam ${c.kayitSayisi() - once})`);

      // Belirteç değişti (lisans sorgusu yeni belirteç verdi): hemen kayıt.
      await c.server.app.license.check();
      await c.sync.tick();
      assert.equal(c.kayitSayisi() - once, 3, "belirteç değişince pencere beklenmez");
      c.clock.set(t0 + 91 * DK);
      await c.sync.tick();
      assert.equal(c.kayitSayisi() - once, 3, "yeni belirteçle ret: yeni pencere başlar");

      // zorla (güvenlik / elle): hemen kayıt.
      const zorla = await c.sync.kayitGonder({ zorla: true });
      assert.equal(zorla.code, "kapi-lisans");
      assert.equal(c.kayitSayisi() - once, 4, "zorla: true pencereyi beklemez");
      // Davranış denetimlerinden SONRA (kırmızının nedeni kayıt sayısı olsun — ders 38): pencere adlı sabitte.
      assert.equal(OZET_KURALLARI.lisansRetMs, 60 * DK, "OZET_KURALLARI.lisansRetMs (adlı sabit, 1 saat)");
    } finally {
      await c.close();
    }
  });

  it("kapıcıya ulaşılamazken (ağ hatası) artan bekleme 1, 2, 4, 8, en çok 15 dk; kapıcı dönünce bir sonraki denemede başarı ve sıfırlanma; zorla beklemez", async () => {
    const c = await kur();
    try {
      // Deneme lisansı geçerli (bitişe 5 gün). Kapıcı kesildi; lisans sorgusu belirteci yeniler → imza değişir → kayıt gerekir.
      const t0 = BITIS - 5 * 86_400_000;
      c.clock.set(t0);
      c.ag.kesik = true;
      await c.server.app.license.check();
      const bas = c.ag.denemeler.length;
      for (let t = t0; t < t0 + 60 * DK; t += TUR) {
        c.clock.set(t);
        await c.sync.tick();
      }
      // Beklenen (kendi hesap): deneme 0. dk → hata 1 → 1 dk bekle → 1. dk → hata 2 → 2 dk → 3. dk → 4 dk → 7. dk → 8 dk → 15. dk → 16 dk yerine tavan 15 →
      // 30. dk → 15 → 45. dk → 15 → 60. dk (pencere dışı). 1 saatte 7 istek: 0, 1, 3, 7, 15, 30, 45.
      const denemeler = c.ag.denemeler.slice(bas).map(ms => (ms - t0) / DK);
      assert.equal(denemeler.length, 7, `kapıcı kapalıyken 1 saatte giden kayıt isteği: ${denemeler.length} (beklenen 7; her tur yineleniyorsa ~120): ${JSON.stringify(denemeler.slice(0, 12))}`);
      assert.deepEqual(denemeler, [0, 1, 3, 7, 15, 30, 45], "deneme dakikaları artan beklemeye uyar (tavan 15 dk)");
      const bekleyen = await c.sync.tick();
      assert.deepEqual([bekleyen?.ok, bekleyen?.code, bekleyen?.onceden], [false, "kapi-ag", true], `bekleme içinde son hata döner: ${JSON.stringify(bekleyen)}`);

      // Kapıcı döndü (50. dk): bekleme bitene dek (60. dk) istek yok; 60. dk'da bir deneme → başarı.
      c.ag.kesik = false;
      c.clock.set(t0 + 50 * DK);
      await c.sync.tick();
      assert.equal(c.ag.denemeler.length - bas, 7, "bekleme sürerken istek yok");
      c.clock.set(t0 + 60 * DK);
      const donus = await c.sync.tick();
      assert.equal(donus?.ok, true, `kapıcı dönünce bir sonraki denemede başarı: ${JSON.stringify(donus)}`);
      assert.equal(c.ag.denemeler.length - bas, 8);

      // Sıfırlandı: yeni kesintide bekleme yine 1 dk'dan başlar (önceki sayaç taşınmaz).
      c.ag.kesik = true;
      c.clock.set(t0 + 61 * DK);
      await c.server.app.license.check(); // yeni belirteç (yeni saat) → kayıt gerekir
      await c.sync.tick();
      c.clock.set(t0 + 61 * DK + 30_000);
      await c.sync.tick();
      c.clock.set(t0 + 62 * DK);
      await c.sync.tick();
      const sonra = c.ag.denemeler.slice(bas + 8).map(ms => (ms - t0) / DK);
      assert.deepEqual(sonra, [61, 62], `başarıdan sonra bekleme 1 dk'dan başlar: ${JSON.stringify(sonra)}`);

      // zorla (güvenlik / elle) beklemez.
      c.clock.set(t0 + 62 * DK + 30_000);
      await c.sync.kayitGonder({ zorla: true });
      assert.equal(c.ag.denemeler.length - bas, 11, "zorla: true beklemeye takılmaz");
      // Davranış denetimlerinden SONRA (ders 38): bekleme adlı sabitlerde.
      assert.deepEqual([OZET_KURALLARI.hataBeklemeIlkMs, OZET_KURALLARI.hataBeklemeAzamiMs], [DK, 15 * DK], "OZET_KURALLARI.hataBeklemeIlkMs / hataBeklemeAzamiMs");
    } finally {
      c.ag.kesik = false;
      await c.close();
    }
  });
});
