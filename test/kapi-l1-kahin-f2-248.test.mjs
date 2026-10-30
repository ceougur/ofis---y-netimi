// 2.4.8 L1 kâhin farkı F2 (L01/L02/L06, R1–R3): KARAR L1 "ücretli: 30. gün sonunda mobil KAPANIR ve kayıt HEMEN silinir … Sonradan lisans alınır/yenilenirse
// telefon karekodla yeniden eşlenir". Program kaydı sonraki saatlik temizliğe dek bırakıyordu; arada lisans yenilenirse eski cihaz geri geliyor, 3 cihaz sınırında
// yer tutuyordu. KÖK NEDEN: silme yalnız zamanlanmış temizlikteydi; kapıcının istek yolları (kayıt, özet yükleme, telefonun özeti / canlı isteği) süresi geçmiş
// kaydı yalnız reddediyordu. Düzeltme (bulut/kapi/kapi.mjs vadesiGecenSil): silme anı kapıcının bildiği son lisansa göre geçtiyse kayıt GELEN İLK istekte silinir;
// karar servisin şimdi verdiği belirteçle (GG D1); taze bilgi yoksa istek reddedilir, kayıt durur ama eski cihaz geçmez.
// Gerçek createKapi + sahte R2 + sahte saat + sahte lisans servisi (ders 30). Eski kodda (fd33d747) "ilk istekte silinmedi" ile kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const GUN = 86_400_000;
const SAAT = 3_600_000;
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const SILME = BITIS + 30 * GUN; // ücretli: 30 günlük hoşgörünün sonu
const makine = i => `${String(i).padStart(4, "0")}${"f2".repeat(14)}`;
const LISANS = (ek = {}) => ({ kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });
const YENI = LISANS({ expiresAt: new Date(BITIS + 400 * GUN).toISOString() });

function ortam() {
  let t = BITIS - 20 * GUN;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const servis = new Map();
  const ctx = { erisim: true };
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async (_url, init) => {
      if (!ctx.erisim) throw new TypeError("fetch failed (test: lisans servisi yok)");
      const b = JSON.parse(init.body);
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: b.machine, licenseId: b.licenseId, ...servis.get(b.machine) }) }) };
    },
    fetchOrigin: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: "destekofis.test", LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "x" };
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: async (u, i = {}) => kapi.fetch(new Request(u, i), env), simdi: () => t, kayitSimdi: () => t });
  Object.assign(ctx, {
    servis,
    saat: ms => {
      t = ms;
    },
    async kayit(o, m, k, tels) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...k }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    async ofisKur(i, k) {
      servis.set(makine(i), k);
      const o = await ofisAnahtari();
      const tels = [await cihaz()];
      const r = await ctx.kayit(o, makine(i), k, tels);
      assert.equal(r.ok, true, `ön koşul: kayıt kabul: ${JSON.stringify(r)}`);
      return { o, m: makine(i), tels };
    },
    async ozet(o, tel) {
      const r = await kapi.fetch(new Request(`https://${o.id}.destekofis.test/kapi/ozet`, { headers: await tel.basliklar("GET", t) }), env);
      const veri = await r.json().catch(() => ({}));
      // Özet yüklenmedi: cihaz ve lisans denetimini geçen istek "kapi-ozet-yok" (404) alır = erişim açık.
      return { status: r.status, code: veri.code || "", error: veri.error || "", acik: r.status === 200 || veri.code === "kapi-ozet-yok" };
    },
    meta: o => r2.nesneler.has(`ofis/${o.id}/meta.json`),
    mezar: o => {
      const k = r2.nesneler.get(`silinen/${o.id}.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
  });
  return ctx;
}

describe("2.4.8 L1 kâhin F2 — silme anı geçince kayıt kapıcıya gelen ilk istekte silinir", () => {
  it("telefonun 30. gün sonundaki ilk özet isteği kaydı HEMEN siler (temizlik beklenmez); 30. günün son anında durur", async () => {
    const c = ortam();
    const a = await c.ofisKur(1, LISANS());
    c.saat(SILME - 1);
    assert.equal((await c.ozet(a.o, a.tels[0])).acik, true, "30. günün son anı: son özet açık (hoşgörü)");
    assert.equal(c.meta(a.o), true);
    c.saat(SILME);
    const r = await c.ozet(a.o, a.tels[0]);
    assert.equal(c.meta(a.o), false, `30. günün sonundaki ilk istekte kayıt silinmedi (sonraki temizliği bekliyor): ${JSON.stringify(r)}`);
    assert.deepEqual([r.status, r.code], [401, "kapi-cihaz"], "telefon artık eşli değil");
    assert.equal(c.mezar(a.o)?.neden, "bitti", "iz (silme yolu temizlikle aynı)");
  });

  it("programın 30. gün sonundaki ilk kaydı (lisans yenilenmemiş) kaydı siler; program 'silindi' alır, eski cihaz listesi kayda geçmez", async () => {
    const c = ortam();
    const a = await c.ofisKur(2, LISANS());
    c.saat(SILME + SAAT);
    const r = await c.kayit(a.o, a.m, LISANS(), a.tels);
    assert.ok(r.silindi || r.data?.silindi, `ilk kayıtta silinmeli ve program 'silindi' almalı: ${JSON.stringify(r)}`);
    assert.equal(c.meta(a.o), false, "lisans geçersizken silinmiş kayıt yeniden açılmaz");
    // Lisans sonradan yenilendi: kayıt cihazsız açılır (telefon karekodla yeniden eşlenir).
    c.servis.set(a.m, YENI);
    c.saat(SILME + 2 * SAAT);
    const y = await c.kayit(a.o, a.m, YENI, a.tels);
    assert.deepEqual([y.ok, y.data?.cihaz, Boolean(y.data?.silindi)], [true, 0, true], `yenilenen lisansla kayıt cihazsız açılır: ${JSON.stringify(y)}`);
    assert.equal((await c.ozet(a.o, a.tels[0])).code, "kapi-cihaz", "eski cihaz geçmez");
  });

  it("silme anından sonra servise ulaşılamazsa kayıt SİLİNMEZ ama istek reddedilir (eski cihaz geçmez); servis dönünce ilk istekte silinir", async () => {
    const c = ortam();
    const a = await c.ofisKur(3, LISANS());
    c.saat(SILME + SAAT);
    c.erisim = false;
    const r = await c.ozet(a.o, a.tels[0]);
    assert.equal(r.acik, false, `taze lisans yokken telefon geçmez: ${JSON.stringify(r)}`);
    assert.equal(c.meta(a.o), true, "taze bilgi yokken silinmez");
    c.erisim = true;
    c.saat(SILME + 2 * SAAT);
    await c.ozet(a.o, a.tels[0]);
    assert.equal(c.meta(a.o), false, "servis dönünce ilk istekte silinir");
  });

  it("BAŞ MİMAR KARARI (D1): lisans hoşgörü içinde yenilendi ama kapıcı silme anından sonra öğrendiyse (son bilgisi silme anından önce) kayıt SİLİNMEZ", async () => {
    const c = ortam();
    const a = await c.ofisKur(4, LISANS());
    c.saat(SILME - 20 * 60_000);
    assert.equal((await c.ozet(a.o, a.tels[0])).acik, true, "hoşgörünün son yarım saati: kapıcının son bilgisi (bitmiş)");
    c.servis.set(a.m, YENI); // müşteri silme anından ÖNCE yeniledi; kapıcı bilmiyor
    c.saat(SILME + SAAT);
    const r = await c.ozet(a.o, a.tels[0]);
    assert.deepEqual([r.acik, c.meta(a.o)], [true, true], `yenilenmiş lisansta kayıt kalır, telefon geçer: ${JSON.stringify(r)}`);
  });
});
