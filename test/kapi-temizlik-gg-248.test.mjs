// 2.4.8 bağımsız gözden geçirme (GG) bulguları — kapıcının zamanlanmış temizliği (bulut/kapi/temizlik.mjs, kapi.mjs lisans görünümü):
//   ORTA-1  doğrulanamayan ofisler her turun bütçesini tüketip imleci durduruyordu (45 doğrulanamayan varken süresi geçmiş ofis HİÇ silinmiyordu; deneme betiği
//           gg-aclik.mjs b5deb221 üzerinde) → doğrulanamadı / istisna: deneme anı yazılır, ofis 24 saat aday değil; imleç ertelenen varken de ilerler.
//   D4      tur başına R2 + Cache + lisans servisi + Cloudflare işlemlerinin TOPLAMI ≤ 45 (Workers ücretsiz plan alt istek sınırı 50; R2'nin sayılıp sayılmadığı
//           doğrulanamadı → güvenli taraf). Bu dosya işlemleri programdan BAĞIMSIZ sayar (sahte R2 sayacı, sahte önbellek, sahte servis, sahte Cloudflare).
//   D1      silme kararından hemen önce lisans servisinden zorunlu yenileme (hoşgörünün son yarım saatinde yenilenen lisans silinmez).
//   D5      lisans servisi isteğine zaman aşımı (yanıt vermeyen servis turu asmaz).
// Gerçek createKapi + sahte saat; gerçek lisans servisine / Cloudflare'e istek YOK (ders 30). Eski kodda (b5deb221) beklenen nedenlerle kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as kapiModulu from "../bulut/kapi/kapi.mjs";
import { TEMIZLIK } from "../bulut/kapi/temizlik.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const SAAT = 3_600_000;
const GUN = 24 * SAAT;
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const DENEME = { kind: "trial", status: "active", expiresAt: new Date(BITIS).toISOString() };
const LISANS = (ek = {}) => ({ kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });
const SURESIZ = { kind: "license", status: "active", expiresAt: null };
const makine = i => `${String(i).padStart(4, "0")}${"ef".repeat(14)}`;

/** Sahte Cloudflare: her yöntem gerçek istemcinin yaptığı API isteği kadar sayılır (bulut/kapi/tunel.mjs: findTunnel 1, deleteTunnel 2, deleteCname 1 + kayıt başına 1). */
function sahteCloudflare(sayac) {
  const s = { tunnels: [], dns: [] };
  s.istemci = {
    async findTunnel(name) {
      sayac.n += 1;
      return s.tunnels.find(t => t.name === name) || null;
    },
    async deleteTunnel(id, { devam = async () => true } = {}) {
      if (!(await devam())) return false;
      sayac.n += 1;
      if (!(await devam())) return false;
      sayac.n += 1;
      s.tunnels = s.tunnels.filter(t => t.id !== id);
      return true;
    },
    async deleteCname(hostname, { devam = async () => true } = {}) {
      sayac.n += 1;
      for (const r of s.dns.filter(x => x.name === hostname)) {
        if (!(await devam())) return false;
        sayac.n += 1;
        s.dns = s.dns.filter(x => x !== r);
      }
      return true;
    },
  };
  return s;
}

function ortam({ servisZamanAsimiMs } = {}) {
  let t = BITIS - 20 * GUN;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const dis = { n: 0 }; // önbellek + lisans servisi + Cloudflare
  const onbellekAsil = sahteOnbellek();
  const onbellek = {
    match: async (...a) => ((dis.n += 1), onbellekAsil.match(...a)),
    put: async (...a) => ((dis.n += 1), onbellekAsil.put(...a)),
  };
  const cf = sahteCloudflare(dis);
  const servis = new Map(); // makine → iddialar (yoksa servis "bilinmiyor" der → doğrulanamaz)
  const sorulan = new Map(); // makine → [zaman]
  const kapi = kapiModulu.createKapi({
    now: () => t,
    onbellek,
    cloudflare: cf.istemci,
    ...(servisZamanAsimiMs ? { servisZamanAsimiMs } : {}),
    lisansFetch: async (_url, init) => {
      dis.n += 1;
      const b = JSON.parse(init.body);
      sorulan.set(b.machine, [...(sorulan.get(b.machine) || []), t]);
      if (ctx.asili) return new Promise(() => {}); // yanıt vermeyen servis (sinyali de dinlemez)
      const k = servis.get(b.machine);
      if (!k) return { json: async () => ({ ok: false, code: "bilinmiyor" }) };
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: b.machine, licenseId: b.licenseId, ...k }) }) };
    },
    fetchOrigin: async () => new Response("{}", { status: 200 }),
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: "destekofis.test", LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "x" };
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: async (u, i = {}) => kapi.fetch(new Request(u, i), env), simdi: () => t, kayitSimdi: () => t });
  const ctx = {
    asili: false,
    servis,
    sorulan,
    cf,
    r2,
    now: () => t,
    saat: ms => {
      t = ms;
    },
    ilerle: ms => {
      t += ms;
    },
    async kayit(o, m, k, tels) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...k }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    /** Ofis kur (kimlik verilebilir: sözlük sırası R2 listesinin sırası); tünel + DNS kaydı sahte Cloudflare'de. */
    async ofisKur(i, k, id) {
      servis.set(makine(i), k);
      const o = await ofisAnahtari(id);
      const tels = [await cihaz()];
      const r = await ctx.kayit(o, makine(i), k, tels);
      assert.equal(r.ok, true, `ön koşul: kayıt kabul: ${JSON.stringify(r)}`);
      cf.tunnels.push({ id: `t-${o.id}`, name: `destekofis-${o.id}` });
      cf.dns.push({ name: `${o.id}.destekofis.test` });
      return { o, m: makine(i), tels };
    },
    var: o => r2.nesneler.has(`ofis/${o.id}/meta.json`),
    /** Bir tur; işlem sayısı programdan bağımsız: sahte R2'nin A + B sayacı + önbellek + servis + Cloudflare. */
    async tur() {
      const once = r2.sayac.A + r2.sayac.B + dis.n;
      const rapor = await kapi.temizlik(env);
      return { rapor, islem: r2.sayac.A + r2.sayac.B + dis.n - once };
    },
    kapi,
    env,
  };
  return ctx;
}
const sirali = (on, i) => `${on}${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}${"a".repeat(13)}`;

describe("2.4.8 GG — kapıcı temizliği: doğrulanamayanlar turu tıkamaz, tur bütçesi, zorunlu yenileme, servis zaman aşımı", () => {
  it("ORTA-1: 45 doğrulanamayan ofis + 1 süresi geçmiş ofis → süresi geçen ilk turlarda silinir; doğrulanamayanlar 24 saatte bir sorulur", async () => {
    const c = ortam();
    const dogrulanamayan = [];
    for (let i = 0; i < 45; i += 1) dogrulanamayan.push(await c.ofisKur(i, DENEME, sirali("oa", i)));
    const biten = await c.ofisKur(99, DENEME, `oz${"a".repeat(15)}`); // sözlük sırasında en sonda
    for (const d of dogrulanamayan) c.servis.delete(d.m); // servis bu kurulumları tanımıyor (taşındı / silindi) → doğrulanamaz
    const bas = BITIS + 31 * GUN;
    c.saat(bas);
    let silindigiTur = null;
    for (let tur = 1; tur <= 10 && silindigiTur === null; tur += 1) {
      const { rapor } = await c.tur();
      if (rapor.silinen.includes(biten.o.id)) silindigiTur = tur;
      c.ilerle(SAAT);
    }
    assert.ok(silindigiTur !== null, `45 doğrulanamayan ofis varken süresi geçmiş ofis 10 turda SİLİNMEDİ (tur tıkandı; doğrulanamayanlar her turun bütçesini tüketiyor)`);
    assert.equal(c.var(biten.o), false);
    // 24 saatte bir: ilk 24 saatte her doğrulanamayan tam bir kez sorulur; 24 saat sonra yeniden.
    c.saat(bas + 23 * SAAT);
    for (let t = c.now(); t < bas + 23 * SAAT + 10 * SAAT; t += SAAT) {
      c.saat(t);
      await c.tur();
    }
    for (const d of dogrulanamayan) {
      const zaman = (c.sorulan.get(d.m) || []).filter(z => z >= bas);
      assert.ok(zaman.length >= 1, `doğrulanamayan ofis hiç sorulmadı (${d.o.id})`);
      for (let i = 1; i < zaman.length; i += 1) assert.ok(zaman[i] - zaman[i - 1] >= TEMIZLIK.dogrulanamayanMs, `doğrulanamayan ofis 24 saat dolmadan yeniden soruldu: ${JSON.stringify(zaman.map(z => (z - bas) / SAAT))}`);
      assert.ok(zaman.length >= 2, `24 saat sonra yeniden sorulur: ${JSON.stringify(zaman.map(z => (z - bas) / SAAT))}`);
      assert.equal(c.var(d.o), true, "doğrulanamayan ofis silinmez");
    }
    assert.equal(TEMIZLIK.dogrulanamayanMs, 24 * SAAT, "TEMIZLIK.dogrulanamayanMs (adlı sabit)");
  });

  it("D4: tur başına R2 + önbellek + lisans servisi + Cloudflare işlemi ≤ 45 (bağımsız sayaç); birkaç turda bütün süresi geçenler silinir, öbürleri kalır", async () => {
    const c = ortam();
    const biten = [];
    const dogrulanamayan = [];
    const gecerli = [];
    for (let i = 0; i < 10; i += 1) biten.push(await c.ofisKur(100 + i, DENEME));
    for (let i = 0; i < 20; i += 1) dogrulanamayan.push(await c.ofisKur(200 + i, DENEME));
    for (let i = 0; i < 30; i += 1) gecerli.push(await c.ofisKur(300 + i, SURESIZ));
    for (const d of dogrulanamayan) c.servis.delete(d.m);
    c.saat(BITIS + 31 * GUN);
    const islemler = [];
    for (let tur = 0; tur < 24; tur += 1) {
      const { islem } = await c.tur();
      islemler.push(islem);
      c.ilerle(SAAT);
    }
    const asan = islemler.filter(n => n > 45); // sabit sayı (kâhin): programın sabitinden türetilmez
    assert.deepEqual(asan, [], `tur işlemi 45'i aştı (R2 + önbellek + servis + Cloudflare): ${JSON.stringify(islemler)}`);
    assert.deepEqual(biten.map(b => c.var(b.o)), Array(10).fill(false), `24 turda süresi geçen 10 ofis silinir: ${JSON.stringify(islemler)}`);
    assert.deepEqual([...dogrulanamayan, ...gecerli].map(b => c.var(b.o)), Array(50).fill(true), "doğrulanamayan ve geçerli ofisler kalır");
    assert.equal(TEMIZLIK.butce, 45, "TEMIZLIK.butce (adlı sabit)");
  });

  it("D1: hoşgörünün son yarım saatinde lisans yenilendiyse (programın belirteci taze ama eski) silme kararından önce servise sorulur → SİLİNMEZ", async () => {
    const c = ortam();
    const l = await c.ofisKur(400, LISANS());
    // Hoşgörü bitişine 10 dk kala program kaydoldu (belirteci taze: bitiş hâlâ BITIS) ...
    c.saat(BITIS + 30 * GUN - 10 * 60_000);
    const r = await c.kayit(l.o, l.m, LISANS(), l.tels);
    assert.equal(r.ok, true, `ön koşul: hoşgörüde kayıt: ${JSON.stringify(r)}`);
    // ... ve müşteri lisansını hemen ardından yeniledi (servis yeni bitişi biliyor; programın belirteci henüz yenilenmedi).
    c.servis.set(l.m, LISANS({ expiresAt: new Date(BITIS + 400 * GUN).toISOString() }));
    c.saat(BITIS + 30 * GUN);
    const { rapor } = await c.tur();
    assert.equal(c.var(l.o), true, `son yarım saatte yenilenen lisanslı ofis silindi (karar programın taze ama eski belirteciyle verildi): ${JSON.stringify(rapor)}`);
    assert.deepEqual(rapor.silinen, []);
    // Yenilenmemiş olsaydı: servis eski bitişi söyler → silinir (zorunlu yenileme silmeyi engellemez).
    c.servis.set(l.m, LISANS());
    c.ilerle(TEMIZLIK.kontrolMs);
    const { rapor: r2 } = await c.tur();
    assert.deepEqual(r2.silinen, [l.o.id], `yenilenmeyen lisansta silinir: ${JSON.stringify(r2)}`);
  });

  it("D5: yanıt vermeyen lisans servisi turu asmaz (zaman aşımı); ofis silinmez, doğrulanamadı olarak beklenir", async () => {
    const c = ortam({ servisZamanAsimiMs: 100 });
    const d = await c.ofisKur(500, DENEME);
    c.asili = true;
    c.saat(BITIS + 31 * GUN);
    let zamanlayici;
    const sonuc = await Promise.race([c.tur(), new Promise(r => (zamanlayici = setTimeout(() => r("ASILI"), 3_000)))]);
    clearTimeout(zamanlayici);
    assert.notEqual(sonuc, "ASILI", "temizlik turu yanıt vermeyen lisans servisinde 3 sn içinde bitmedi (servis isteğinde zaman aşımı yok)");
    assert.deepEqual(sonuc.rapor.silinen, [], "taze lisans bilgisi yokken silinmez");
    assert.equal(c.var(d.o), true);
    const meta = JSON.parse(new TextDecoder().decode(c.r2.nesneler.get(`ofis/${d.o.id}/meta.json`).veri));
    assert.equal(meta.dogrulanamadi?.ms, c.now(), "deneme anı yazıldı (24 saat beklenir)");
    assert.equal(kapiModulu.LISANS_SERVIS_ZAMAN_ASIMI_MS, 5_000, "LISANS_SERVIS_ZAMAN_ASIMI_MS (adlı sabit, 5 sn)");
  });
});
