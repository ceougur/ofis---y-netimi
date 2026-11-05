// 2.4.7 bağımsız gözden geçirme B5 (ORTA): masaüstünde şirket SEÇİMİ (POST /api/companies/select) ve license/check, license/contact "güvenlik" sayılıp her
// seferinde tam özet yüklemesi doğuruyordu → kapıcının günlük 200 yükleme sınırı dolar, akşam kapanış özeti bayat kalır. Düzeltme (baş mimar kararı): bu üçü
// yükleme tetiklemez; şirket ERİŞİM değişikliği ve öbür gerçek güvenlik olayları hemen yükler (komşu yollar — ders 10). Yeniden üretme betiği:
// docs/kanit/2026-10-29/gg247/b5-sirket-secimi-guvenlik-yuklemesi.out.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { yazmaTuru } from "../server/lib/mobile-sync.mjs";
import { ADMIN_PASSWORD, kurulum } from "./mobil-gg247-ortak.mjs";

describe("B5 şirket seçimi / lisans denetimi → özet yüklemesi", () => {
  let ctx;
  const sayac = () => Number(ctx.kapi.r2.nesneler.get(`ofis/${ctx.ofis.id}/ozet.json`)?.customMetadata?.sayac || 0);
  before(async () => {
    ctx = await kurulum({ licenseId: "LIS-GG247-B5" });
    const { pair, login } = await ctx.yeniTelefon("admin", ADMIN_PASSWORD);
    assert.equal(pair.status, 200, pair.text);
    assert.equal(login.status, 200, login.text);
    await ctx.sync.idle();
  });
  after(() => ctx?.close());

  it("sınıflama: select / license check / license contact yüklemez; erişim, şirket yaşam döngüsü ve lisans etkinleştirme güvenlik", () => {
    for (const p of ["/api/companies/select", "/api/license/check", "/api/license/contact"]) assert.equal(yazmaTuru("POST", p), null, p);
    assert.equal(yazmaTuru("PUT", "/api/companies/access/u1"), "guvenlik");
    for (const [m, p] of [["POST", "/api/companies"], ["PUT", "/api/companies/c1"], ["DELETE", "/api/companies/c1"], ["POST", "/api/companies/c1/reset"], ["POST", "/api/companies/c1/separate"], ["POST", "/api/license/activate"], ["POST", "/api/license/trial"], ["POST", "/api/license/code"]])
      assert.equal(yazmaTuru(m, p), "guvenlik", `${m} ${p}`);
    // Yalnız tam yol: select'e benzeyen başka uç güvenlik kalır.
    assert.equal(yazmaTuru("POST", "/api/companies/select-x"), "guvenlik");
    assert.equal(yazmaTuru("POST", "/api/license/check/extra"), "guvenlik");
  });

  it("10 şirket geçişi ve 3 elle lisans denetimi özet yüklemesi doğurmaz (istekler 200)", async () => {
    const created = await ctx.admin.post("/api/companies", { code: "002", name: "İkinci Şirket" });
    assert.equal(created.status, 200, created.text);
    await ctx.sync.idle();
    const list = (await ctx.admin.get("/api/companies")).data.data.companies;
    assert.equal(list.length, 2);
    const once = sayac();
    assert.ok(once > 0, "kurulumda özet yüklenmiş olmalı");
    for (let i = 0; i < 10; i += 1) {
      const r = await ctx.admin.post("/api/companies/select", { id: list[i % 2].id });
      assert.equal(r.status, 200, r.text);
      await ctx.sync.idle();
    }
    for (let i = 0; i < 3; i += 1) {
      const r = await ctx.admin.post("/api/license/check", {});
      assert.equal(r.status, 200, r.text);
      await ctx.sync.idle();
    }
    assert.equal(sayac() - once, 0, `şirket seçimi / lisans denetimi ${sayac() - once} özet yüklemesi doğurdu`);
  });

  it("komşu: şirket ERİŞİMİ değişikliği hemen bir özet yüklemesi doğurur (güvenlik olarak kalır)", async () => {
    const created = await ctx.admin.post("/api/admin/users", { username: "gg247-personel", name: "Personel Bir", role: "personel", password: "Ilk-Parola-2026", mustChangePassword: false });
    assert.equal(created.status, 200, created.text);
    await ctx.sync.idle();
    const id = (await ctx.ids())["gg247-personel"];
    const list = (await ctx.admin.get("/api/companies")).data.data.companies;
    const once = sayac();
    const r = await ctx.admin.put(`/api/companies/access/${id}`, { companies: [list[0].id] });
    assert.equal(r.status, 200, r.text);
    await ctx.sync.idle();
    assert.equal(sayac() - once, 1, "erişim değişikliği tek güvenlik yüklemesi doğurmalı");
  });
});

// 2.5.0 W-1(a) dar kontrol ORTA-1 (aynı aile): ana ekran her açılışta WhatsApp bağlantı süresi bildirimini SORAR (POST …/whatsapp/connection/expiry-notice; bağlantı
// yoksa da). İstek 200 döndüğü için "veri" sayılıp her açılışta tam özet yüklemesi doğuruyordu (dar kontrol betiği I: 10 saatte 30 açılış → 30 yükleme; günlük
// sınır 40). Beklenen (B5 kararı ile aynı ilke): bildirim sorusu telefonun gördüğü veriyi değiştirmez → 0 yükleme; aynı zaman çizelgesinde gerçek veri yazımı yine
// yükler (testin dişi: yükleme sayacı bu düzenekte gerçekten artabiliyor). Zaman çizelgesi dar kontrol betiğinden (16 dk × 4 oturma, sonra 20 dk arayla 30 açılış).
describe("2.5.0 W-1(a) ORTA-1 — WhatsApp süre bildirimi sorusu → özet yüklemesi", () => {
  let ctx;
  const sayac = () => Number(ctx.kapi.r2.nesneler.get(`ofis/${ctx.ofis.id}/ozet.json`)?.customMetadata?.sayac || 0);
  const ilerle = async ms => {
    ctx.gercek.set(ctx.gercek.ms() + ms);
    ctx.ofisSaati.set(ctx.ofisSaati.ms() + ms);
    await ctx.sync.tick();
    await ctx.sync.idle();
  };
  before(async () => {
    ctx = await kurulum({ licenseId: "LIS-W1A-ORTA1" });
    const { pair, login } = await ctx.yeniTelefon("admin", ADMIN_PASSWORD);
    assert.equal(pair.status, 200, pair.text);
    assert.equal(login.status, 200, login.text);
    await ctx.sync.idle();
    for (let i = 0; i < 4; i += 1) await ilerle(16 * 60_000); // kurulumun kendi yüklemesi biter
  });
  after(() => ctx?.close());

  it("sınıflama: süre bildirimi sorusu yüklemez; WhatsApp bağlantısının gerçek değişiklikleri (kaydet / kaldır) ve benzer adlı uç veri kalır", () => {
    assert.equal(yazmaTuru("POST", "/api/workspace/whatsapp/connection/expiry-notice"), null);
    for (const [m, p] of [["PUT", "/api/workspace/whatsapp/connection"], ["DELETE", "/api/workspace/whatsapp/connection"], ["POST", "/api/workspace/whatsapp/connection/expiry-notice-x"], ["POST", "/api/workspace/whatsapp/batches"]])
      assert.equal(yazmaTuru(m, p), "veri", `${m} ${p}`);
  });

  it("10 saatte 30 ana ekran açılışı (bildirim sorusu, yanıt 200) 0 özet yüklemesi; aynı çizelgede bir cari kaydı yükler", async () => {
    const once = sayac();
    assert.ok(once > 0, "kurulumda özet yüklenmiş olmalı");
    const durumlar = {};
    for (let i = 0; i < 30; i += 1) {
      const r = await ctx.admin.post("/api/workspace/whatsapp/connection/expiry-notice", {});
      durumlar[r.status] = (durumlar[r.status] || 0) + 1;
      await ilerle(20 * 60_000);
    }
    assert.deepEqual(durumlar, { 200: 30 }, "ön koşul: istekler 200 (reddedilen istek başarı değildir — ders 3)");
    assert.equal(sayac() - once, 0, `30 bildirim sorusu ${sayac() - once} özet yüklemesi doğurdu`);
    const cari = await ctx.admin.post("/api/workspace/accounts", { name: "Yükleme Denetimi", phone: "0532 777 00 01" });
    assert.equal(cari.status, 200, cari.text);
    await ilerle(20 * 60_000);
    assert.equal(sayac() - once, 1, "gerçek veri yazımı tek özet yüklemesi doğurmalı (düzenek yüklemeyi görebiliyor)");
  });
});
