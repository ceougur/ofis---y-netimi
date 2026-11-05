// 2.4.9 UI tur B (ORTA-3; UI/UX gezintisi 04.11.2026, docs/2.4.9-IS-LISTESI.md "UI/UX GEZİNTİSİ"): Meta durum bildirimi adresinin (Bildirim Yolu) kaydını reddedince
// (100 "must be subscribed" — ELLE KABUL BULGUSU 3) Bağlantıyı Sına bağlantıyı "çalışıyor" sayar (doğru: ileti gönderimi çalışır), ama ekran hatayı yalnız dar Bildirim Yolu
// hücresinde, Türkçe neden + İngilizce Meta iletisi + iç içe parantezle gösteriyordu. Sunucu artık kartın görünümünde (GET / POST test) kaydedilemeyen Bildirim Yolu için
// Türkçe nedeni (cause), Meta'nın ham iletisini (metaMessage) ve hata kodunu (metaCode) AYRI verir; deftere yazılan kayıt (error) değişmez (eski kurulumun kaydı da aynı
// biçimde ayrılır). İstemci: uyarı bildirimi + düğmelerin altında neden satırı (test/e2e/senaryo-whatsapp-ayar-248.mjs A4c).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; gerçek Meta'ya istek YOK — ders 30). Beklenen metinler W-4 başlığından ve Meta'nın
// testte verilen iletisinden yazılır.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as metaGraph from "../server/lib/whatsapp/meta-graph.mjs";
import { URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const UNSUBSCRIBED_TR = "Meta bildirim adresini kaydetmedi: uygulamanızın bu WhatsApp Business hesabına aboneliği ve uygulama düzeyi webhook ayarı tamamlanmamış. Kullanım Kılavuzu'ndaki Elle Bağla ön koşullarını tamamlayıp Bağlantıyı Sına'ya basın.";
const META_EN = "(#100) Before override the current callback uri, your app must be subscribed to receive messages for WhatsApp Business Account";
const SUBSCRIBE = /^POST \/\d+\/subscribed_apps$/;
const meta100 = message => ({ error: { message, type: "OAuthException", code: 100, fbtrace_id: "AbCdEfGh" } });

describe("2.4.9 UI tur B — Bildirim Yolu kaydedilemedi: neden Türkçe, Meta iletisi ayrı (gerçek program, sahte Meta)", () => {
  it("Bağlantıyı Sına + abonelik 100: sınama başarılı (200, lastTest.ok), hook failed; cause yalnız Türkçe, metaMessage Meta'nın iletisi, metaCode 100, at tarih; error (defter) aynen", async () => {
    const ctx = await startWa();
    try {
      ctx.server.app.mobileRemote.setPublicUrl("http://ofisuib.destekofis.test");
      ctx.fake.set({ failNext: { match: SUBSCRIBE, sticky: true, status: 400, body: meta100(META_EN) } });
      const res = await ctx.api.post(`${URLS.conn}/test`, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const view = res.data.data;
      assert.equal(view.lastTest?.ok, true, "ileti bağlantısı çalışıyor (sınama başarılı)");
      assert.equal(view.hook?.state, "failed", JSON.stringify(view.hook));
      assert.equal(view.hook.cause, UNSUBSCRIBED_TR, `neden yalnız Türkçe: ${view.hook.cause}`);
      assert.doesNotMatch(view.hook.cause, /must be subscribed|Meta hata kodu|\(#100\)/, "nedende İngilizce / kod yok");
      assert.equal(view.hook.metaMessage, META_EN, "Meta'nın ham iletisi ayrı alanda, kırpılmadan");
      assert.equal(view.hook.metaCode, 100);
      assert.ok(Number.isFinite(Date.parse(view.hook.at)), `kaydedilemediği an: ${view.hook.at}`);
      assert.equal(view.hook.error, `${UNSUBSCRIBED_TR} (Meta hata kodu 100: ${META_EN})`, "defterdeki kayıt biçimi değişmedi");
      // Sayfa yeniden açılınca (GET) aynı ayrım.
      const again = (await ctx.api.get(URLS.conn)).data.data;
      assert.deepEqual({ cause: again.hook.cause, metaMessage: again.hook.metaMessage, metaCode: again.hook.metaCode }, { cause: UNSUBSCRIBED_TR, metaMessage: META_EN, metaCode: 100 });
    } finally {
      await ctx.close();
    }
  });

  it("değişmez koruması — Bildirim Yolu kaydedilince (active) ayrım alanları yok; sınama sonucu aynen", async () => {
    const ctx = await startWa();
    try {
      ctx.server.app.mobileRemote.setPublicUrl("http://ofisuib.destekofis.test");
      const res = await ctx.api.post(`${URLS.conn}/test`, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const hook = res.data.data.hook;
      assert.equal(hook?.state, "active", JSON.stringify(hook));
      assert.equal(hook.error, "");
      for (const key of ["cause", "metaMessage", "metaCode"]) assert.ok(!(key in hook), `${key} yalnız kaydedilemeyende: ${JSON.stringify(hook)}`);
      assert.equal(res.data.data.lastTest?.ok, true);
    } finally {
      await ctx.close();
    }
  });

  it("2.4.8'den kalan defter kaydı (aynı biçimde düşmüş kayıt): görünüm aynı biçimde ayrılır; çakışma kaydında ayrım yok", async () => {
    const ctx = await startWa();
    try {
      const ledger = ctx.server.app.whatsapp.ledger;
      const base = { wabaId: WABA, pathHash: "a".repeat(64), verifyHash: "b".repeat(64), base: "https://eski.destekofis.net", reason: "auto" };
      const old = "Meta isteği geçersiz buldu. (Meta hata kodu 100: (#100) Invalid parameter)";
      ledger.hookEvent({ ...base, state: "failed", error: old, at: "2026-11-01T08:00:00.000Z" });
      let hook = (await ctx.api.get(URLS.conn)).data.data.hook;
      assert.deepEqual({ cause: hook.cause, metaMessage: hook.metaMessage, metaCode: hook.metaCode, at: hook.at }, { cause: "Meta isteği geçersiz buldu.", metaMessage: "(#100) Invalid parameter", metaCode: 100, at: "2026-11-01T08:00:00.000Z" });
      ledger.hookEvent({ ...base, state: "conflict", error: "Meta'daki durum bildirimi adresi bu bilgisayarınkinden farklı.", at: "2026-11-01T09:00:00.000Z" });
      hook = (await ctx.api.get(URLS.conn)).data.data.hook;
      assert.equal(hook.state, "conflict");
      assert.ok(!("cause" in hook) && !("metaMessage" in hook), JSON.stringify(hook));
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.9 UI tur B — splitMetaErrorMessage: MetaGraphError iletisinin tersi (birim)", () => {
  const split = text => {
    assert.equal(typeof metaGraph.splitMetaErrorMessage, "function", "meta-graph.mjs splitMetaErrorMessage dışa açılmalı");
    return metaGraph.splitMetaErrorMessage(text);
  };

  it("MetaGraphError'ın ürettiği her biçim geri ayrılır: kod + ayrıntı (parantezli), yalnız kod, kodsuz ağ hatası", () => {
    const cases = [
      [{ code: 100, title: UNSUBSCRIBED_TR, details: META_EN }, { cause: UNSUBSCRIBED_TR, code: 100, details: META_EN }],
      [{ code: 190, title: "Erişim belirtecinin süresi dolmuş.", details: "" }, { cause: "Erişim belirtecinin süresi dolmuş.", code: 190, details: "" }],
      [{ code: 131000, title: "", details: "Something (nested (deep)) went wrong" }, { cause: "Meta işlemi reddetti.", code: 131000, details: "Something (nested (deep)) went wrong" }],
    ];
    for (const [input, expected] of cases) {
      const error = new metaGraph.MetaGraphError(input);
      assert.deepEqual(split(error.message), expected, error.message);
    }
    // Kodsuz (ağ) hata: kalıba uymaz → metnin tamamı neden, Meta iletisi yok.
    const network = new metaGraph.MetaGraphError({ title: "Meta'ya ulaşılamadı (internet bağlantısını ve vekil sunucu ayarını denetleyin); sonuç bilinmiyor.", details: "ECONNREFUSED", reason: "network" });
    assert.deepEqual(split(network.message), { cause: network.message, code: null, details: "" });
  });

  it("defterin 500 karakter sınırında kesilmiş kayıt, düz Türkçe metin, boş değer", () => {
    const long = new metaGraph.MetaGraphError({ code: 100, title: UNSUBSCRIBED_TR, details: "x".repeat(400) }).message.slice(0, 500);
    const cut = split(long);
    assert.equal(cut.cause, UNSUBSCRIBED_TR);
    assert.equal(cut.code, 100);
    assert.ok(/^x+$/.test(cut.details), "kesilmiş ayrıntı yine ayrı");
    assert.deepEqual(split("Meta'daki adres farklı (başka bilgisayar)."), { cause: "Meta'daki adres farklı (başka bilgisayar).", code: null, details: "" });
    assert.deepEqual(split(""), { cause: "", code: null, details: "" });
    assert.deepEqual(split(undefined), { cause: "", code: null, details: "" });
  });
});
