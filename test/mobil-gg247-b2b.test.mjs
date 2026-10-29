// 2.4.7 bağımsız gözden geçirme B2b (ORTA): ofis saati ±3 dk farklıyken canlı mobil bağlantı tümden 401 remote-kapi'ydi (x-do-kapi payı ±2 dk); Yönetim'de
// uyarı yoktu. Düzeltme (baş mimar kararı): pay 5 dk (KAPI_KURALLARI.vekilPayiMs — kapıcıyla ortak sabit) + program kapıcı yanıtının HTTP Date başlığından saat
// farkını ölçüp kendi imza zamanlarına ve işaret doğrulamasına uygular + Yönetim → Mobil Cihazlar'da ≥ 2 dk farkta "Bu bilgisayarın saati X dakika farklı; Windows
// saat ayarını eşitleyin." Date başlığı yoksa telafi yok (yalnız pay). Yeniden üretme betiği: docs/kanit/2026-10-29/gg247/b2b-saat-farki-canli.out.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { after, before, describe, it } from "node:test";
import { KAPI_KURALLARI } from "../server/lib/kapi-protokol.mjs";
import { kurulum } from "./mobil-gg247-ortak.mjs";

const DK = 60_000;

// Yönetim → Mobil Cihazlar durum alanı (client/assets/hof-mobile-devices.js) sunucunun döndürdüğü görünümle tarayıcısız çizilir.
async function durumAlani(view) {
  const alanlar = new Map();
  const document = { querySelector: sel => (alanlar.has(sel) ? alanlar.get(sel) : (alanlar.set(sel, { innerHTML: "" }), alanlar.get(sel))), addEventListener() {} };
  const HOF = { esc: v => String(v ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`), formatDateTime: v => String(v), api: async () => view };
  const kod = readFileSync(new URL("../client/assets/hof-mobile-devices.js", import.meta.url), "utf8");
  vm.runInNewContext(kod, { window: { HOF }, document, navigator: {} });
  await HOF.mobileDevices.load();
  return alanlar.get("#adm-mobile-status").innerHTML;
}

describe("B2b pay: Date başlığı programa ulaşmasa da ±3 dk farkta kayıt + eşleme + canlı giriş geçer", () => {
  for (const fark of [3 * DK, -3 * DK]) {
    describe(`ofis saati ${fark / DK} dk`, () => {
      let ctx;
      before(async () => {
        ctx = await kurulum({ farkMs: fark, dateYok: true, licenseId: "LIS-GG247-B2B" });
      });
      after(() => ctx?.close());
      it("kayıt, eşleme ve giriş 200; saat farkı ölçülmedi (telafi yok)", async () => {
        const k = await ctx.sync.kayitGonder({ zorla: true });
        assert.equal(k.ok, true, JSON.stringify(k));
        const { pair, login } = await ctx.yeniTelefon();
        assert.equal(pair.status, 200, `eşleme: ${pair.text}`);
        assert.equal(login.status, 200, `canlı giriş: ${login.text}`);
        assert.equal(ctx.sync.status().saat, null, "Date başlığı yokken fark ölçülmez");
      });
    });
  }
  it("pay sabiti 5 dk (kapıcının işareti ve programın doğrulaması aynı sabiti kullanır)", () => {
    assert.equal(KAPI_KURALLARI.vekilPayiMs, 5 * DK);
  });
});

describe("B2b telafi: ofis saati payın dışında (±10 dk), kapıcı yanıtının Date başlığıyla düzeltilir ve Yönetim uyarır", () => {
  for (const fark of [10 * DK, -10 * DK]) {
    describe(`ofis saati ${fark / DK} dk`, () => {
      let ctx;
      before(async () => {
        ctx = await kurulum({ farkMs: fark, licenseId: "LIS-GG247-B2B-T" });
      });
      after(() => ctx?.close());
      it("kayıt (ilk ret + ölçülen farkla bir kez yineleme) geçer; eşleme ve canlı giriş 200", async () => {
        const k = await ctx.sync.kayitGonder({ zorla: true });
        assert.equal(k.ok, true, JSON.stringify(k));
        const saat = ctx.sync.status().saat;
        assert.ok(saat, "fark ölçülmeli");
        // Kapıcı − ofis = −fark; Date başlığı 1 sn çözünürlüklü → ±1 sn.
        assert.ok(Math.abs(saat.farkMs + fark) <= 1_000, `ölçülen fark ${saat.farkMs} ms, beklenen ${-fark}`);
        // Kayıt zamanı kapıcının saatinde saklanır (ofisin kaymış saatinde değil).
        assert.ok(Math.abs(ctx.sonKayitMs() - ctx.gercek.ms()) <= 1_000, `sonKayitMs − gerçek = ${ctx.sonKayitMs() - ctx.gercek.ms()} ms`);
        const { pair, login } = await ctx.yeniTelefon();
        assert.equal(pair.status, 200, `eşleme: ${pair.text}`);
        assert.equal(login.status, 200, `canlı giriş: ${login.text}`);
        const yukle = await ctx.sync.uploadNow();
        assert.equal(yukle.ok, true, `özet yükleme: ${JSON.stringify(yukle)}`);
      });
      it("Yönetim → Mobil Cihazlar: sunucu farkı döndürür, ekranda uyarı cümlesi görünür", async () => {
        const r = await ctx.admin.get("/api/admin/mobile/devices");
        assert.equal(r.status, 200, r.text);
        const view = r.data.data;
        assert.ok(Math.abs(view.ozet.saat.farkMs + fark) <= 1_000, JSON.stringify(view.ozet.saat));
        const html = await durumAlani(view);
        assert.match(html, /data-mobile-saat>Bu bilgisayarın saati 10 dakika farklı; Windows saat ayarını eşitleyin\.</, html);
      });
    });
  }
});

describe("B2b uyarı eşiği: saat doğruyken (fark < 2 sn ölçüm payı) düzeltme yok, uyarı yok", () => {
  let ctx;
  before(async () => {
    ctx = await kurulum({ farkMs: 0, licenseId: "LIS-GG247-B2B-0" });
  });
  after(() => ctx?.close());
  it("fark 0 ölçülür; Yönetim'de saat uyarısı yok", async () => {
    const k = await ctx.sync.kayitGonder({ zorla: true });
    assert.equal(k.ok, true, JSON.stringify(k));
    assert.equal(ctx.sync.status().saat.farkMs, 0);
    assert.equal(ctx.sonKayitMs(), ctx.gercek.ms(), "fark yokken kayıt zamanı ofis saatinin kendisi");
    const r = await ctx.admin.get("/api/admin/mobile/devices");
    const html = await durumAlani(r.data.data);
    assert.doesNotMatch(html, /data-mobile-saat/, html);
  });
  it("uyarı eşiği 2 dk: 1 dk 59 sn uyarmaz, 2 dk uyarır (ekran)", async () => {
    const r = await ctx.admin.get("/api/admin/mobile/devices");
    const view = r.data.data;
    assert.doesNotMatch(await durumAlani({ ...view, ozet: { ...view.ozet, saat: { farkMs: -(2 * DK - 1_000) } } }), /data-mobile-saat/);
    assert.match(await durumAlani({ ...view, ozet: { ...view.ozet, saat: { farkMs: 2 * DK } } }), /saati 2 dakika farklı/);
  });
});
