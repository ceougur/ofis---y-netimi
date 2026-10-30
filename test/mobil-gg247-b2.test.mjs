// 2.4.7 bağımsız gözden geçirme B2 (ORTA): ofis bilgisayarının saati bir kez ileri kayınca kapıcıya kayıt zamanı (meta.mobile.office.sonKayitMs) reddedilen
// kayıtta da kalıcı yazılıyordu; saat düzeldikten sonra da her kayıt "kapi-zaman" ile reddediliyor, yeni eşlenen telefon kapıcıdan geçemiyordu (kayma süresince).
// Düzeltme (baş mimar kararı): sonKayitMs yalnız kapıcı KABUL edince yazılır; saklı değer şimdi + 5 dk'yı aşıyorsa şimdiye kırpılır.
// Bu test kapıcı yanıtlarının Date başlığını programa ULAŞTIRMAZ (B2b telafisi devre dışı): B2 düzeltmesi tek başına sınanır. Yeniden üretme betiği:
// docs/kanit/2026-10-29/gg247/b2-saat-kaymasi-kayit.out (eski kodda kırmızı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { kurulum } from "./mobil-gg247-ortak.mjs";

const HOUR = 3_600_000;

describe("B2 ofis saati ileri kayıp geri gelince kapıcı kaydı (Date başlığı yok)", () => {
  let ctx;
  before(async () => {
    ctx = await kurulum({ dateYok: true, licenseId: "LIS-GG247-B2" });
  });
  after(() => ctx?.close());

  it("saat doğruyken kayıt geçer", async () => {
    const r = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r.ok, true, JSON.stringify(r));
  });

  it("saat 3 saat ileri (saat dilimi hatası): kayıt reddedilir, reddedilen zaman SAKLANMAZ", async () => {
    const once = ctx.sonKayitMs();
    ctx.ofisSaati.set(ctx.gercek.ms() + 3 * HOUR);
    const r = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r.ok, false);
    assert.equal(r.code, "kapi-zaman", JSON.stringify(r));
    assert.equal(ctx.sonKayitMs(), once, "reddedilen kaydın zamanı sonKayitMs'e yazılmamalı");
  });

  it("saat düzeltilince kayıt yeniden geçer; yeni eşlenen telefon kapıcıdan girer", async () => {
    ctx.gercek.advance(60_000);
    ctx.ofisSaati.set(ctx.gercek.ms());
    const r = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r.ok, true, `saat düzeldikten sonra kayıt reddedildi: ${JSON.stringify(r)}`);
    assert.ok(ctx.sonKayitMs() <= ctx.gercek.ms() + 1, `saklı sonKayitMs ileride kaldı: ${(ctx.sonKayitMs() - ctx.gercek.ms()) / 60_000} dk`);
    const { pair, login } = await ctx.yeniTelefon();
    assert.equal(pair.status, 200, pair.text);
    assert.equal(login.status, 200, `yeni telefon kapıcıdan geçemedi: ${login.text}`);
  });

  it("eski sürümün bıraktığı ileri sonKayitMs (şimdi + 3 sa) kırpılır: kayıt geçer, saklı değer kabul edilen zamana iner", async () => {
    const kayit = JSON.parse(ctx.server.app.store.setting("meta.mobile.office", "{}"));
    kayit.sonKayitMs = ctx.gercek.ms() + 3 * HOUR;
    ctx.server.app.store.setSetting("meta.mobile.office", JSON.stringify(kayit));
    ctx.gercek.advance(1_000);
    ctx.ofisSaati.set(ctx.gercek.ms());
    const r = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r.ok, true, `ileri saklı değer kayıt kilidi bıraktı: ${JSON.stringify(r)}`);
    assert.equal(ctx.sonKayitMs(), ctx.gercek.ms(), "kabul edilen zaman saklanmalı");
    // Sıra kesin artar: aynı milisaniyedeki ikinci kayıt bir sonrakine kayar ve geçer (kapıcı eşit zamanı yeniden oynatma sayar).
    const r2 = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(ctx.sonKayitMs(), ctx.gercek.ms() + 1);
  });

  it("saat 4 dk ileri (pay içinde) kabul edilen kayıttan sonra saat geri gelince sıra korunur (kapıcının son kaydının gerisine düşmez)", async () => {
    ctx.ofisSaati.set(ctx.gercek.ms() + 4 * 60_000);
    const ileri = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(ileri.ok, true, JSON.stringify(ileri));
    const kabul = ctx.sonKayitMs();
    ctx.ofisSaati.set(ctx.gercek.ms());
    const r = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(r.ok, true, `saat geri gelince kayıt kapi-sira ile düştü: ${JSON.stringify(r)}`);
    assert.equal(ctx.sonKayitMs(), kabul + 1);
  });
});
