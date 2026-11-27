// 2.5.0 BS-1 — hookFailure gerilemesi (2.4.9 birleşik son dar kontrol DÜŞÜK-3: client/assets/hof-whatsapp-ayar.js hookFailure — Meta YALNIZ hata kodu döndürüp ileti
// göndermezse "(Meta hata kodu N)" ekrandan düşüyor; 2.4.9 UI tur B'den önce Bildirim Yolu hücresinde görünüyordu). Hedef: kod neden satırında "(Meta hata kodu N)" olarak
// görünür; neden satırı Türkçe; Meta iletisi varsa ayrı satırda (UI tur B düzeni aynen).
// Düzenek: GERÇEK program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; ders 30) → kartın görünümü (GET bağlantı) → ekranın KENDİ hookFailure işlevi (kaynaktan alınır;
// HOOK_FAILED_TAIL ile HOOK_WARNING arası — taban kodda da aynı sınırlar, kırmızının nedeni davranış olsun, eksik işaret değil: ders 38). TZ=UTC ve TZ=Europe/Istanbul.
// Ekranda (tarayıcıda) aynı hücre: test/e2e/senaryo-whatsapp-ayar-248.mjs A4d.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const SUBSCRIBE = /^POST \/\d+\/subscribed_apps$/;
const TAIL = "Kaydedilene dek teslim ve okundu bilgisi bu bilgisayara gelmez; program saatte bir kendiliğinden yeniden dener.";
const source = readFileSync(new URL("../client/assets/hof-whatsapp-ayar.js", import.meta.url), "utf8");
const block = /(const HOOK_FAILED_TAIL[\s\S]*?)\r?\n\s*const HOOK_WARNING/.exec(source); // ders 27: CRLF
const escHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const hookFailure = block ? new Function("esc", `${block[1]}; return hookFailure;`)(escHtml) : null;
const unhtml = value => value.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Ekranın çıktısı: { why, meta } — neden satırı (data-wa-hook-why) ve Meta iletisi satırı (data-wa-hook-meta; yoksa null). */
function screen(hook) {
  assert.ok(hookFailure, "ekranda hookFailure işlevi var (HOOK_FAILED_TAIL … HOOK_WARNING)");
  const html = hookFailure(hook);
  const why = /<p [^>]*data-wa-hook-why[^>]*>([\s\S]*?)<\/p>/.exec(html);
  const meta = /<p [^>]*data-wa-hook-meta[^>]*>([\s\S]*?)<\/p>/.exec(html);
  return { why: why ? unhtml(why[1]) : null, meta: meta ? unhtml(meta[1]) : null };
}
async function failedHook(body) {
  const ctx = await startWa({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    ctx.server.app.mobileRemote.setPublicUrl("http://ofisbs1.destekofis.test");
    ctx.fake.set({ failNext: { match: SUBSCRIBE, sticky: true, status: 400, body } });
    const res = await ctx.api.post(`${URLS.conn}/test`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const hook = (await ctx.api.get(URLS.conn)).data.data.hook;
    assert.equal(hook?.state, "failed", `ön koşul: Bildirim Yolu kaydedilemedi (${JSON.stringify(hook)})`);
    return hook;
  } finally {
    await ctx.close();
  }
}

describe("2.5.0 BS-1 — Bildirim Yolu kaydedilemedi: Meta yalnız kod dönünce kod neden satırında", () => {
  it("BS1-1 Meta yalnız hata kodu (100, ileti YOK) → görünüm metaCode 100, metaMessage boş; ekranda neden satırı Türkçe + '(Meta hata kodu 100)', Meta iletisi satırı yok", { timeout: 60_000 }, async () => {
    const hook = await failedHook({ error: { code: 100, type: "OAuthException", fbtrace_id: "AbCd" } });
    assert.deepEqual([hook.metaCode, hook.metaMessage], [100, ""], `ön koşul: kod var, ileti yok (${JSON.stringify(hook)})`);
    const out = screen(hook);
    assert.equal(out.meta, null, "Meta iletisi satırı yok (ileti gelmedi)");
    assert.ok(out.why?.includes("(Meta hata kodu 100)"), `neden satırında kod: ${out.why}`);
    assert.ok(out.why.startsWith(`Bildirim Yolu kaydedilemedi — ${hook.cause.replace(/\.$/, "")} (Meta hata kodu 100).`), `neden + kod tek cümlede: ${out.why}`);
    assert.ok(out.why.endsWith(TAIL), "açıklama cümlesi aynen");
  });
  it("BS1-2 değişmez — Meta iletisi VARSA: neden satırı yalnız Türkçe (kod yok), kod Meta iletisi satırında (ileti '#100' taşımıyorsa)", { timeout: 60_000 }, async () => {
    const hook = await failedHook({ error: { code: 100, message: "Invalid parameter", type: "OAuthException", fbtrace_id: "AbCd" } });
    const out = screen(hook);
    assert.ok(out.why && !/hata kodu/.test(out.why), `neden satırında kod yok: ${out.why}`);
    assert.equal(out.meta, "Meta iletisi: Invalid parameter (hata kodu 100)");
    const tagged = screen({ ...hook, metaMessage: "(#100) Invalid parameter" });
    assert.equal(tagged.meta, "Meta iletisi: (#100) Invalid parameter", "ileti kodu taşıyorsa ikinci kez yazılmaz");
  });
  it("BS1-3 değişmez — kodsuz hata (ağ / düz Türkçe kayıt): neden satırı aynen, kod eki yok", () => {
    const out = screen({ state: "failed", cause: "Meta'ya ulaşılamadı.", metaCode: null, metaMessage: "" });
    assert.equal(out.why, `Bildirim Yolu kaydedilemedi — Meta'ya ulaşılamadı. ${TAIL}`);
    assert.equal(out.meta, null);
  });
});
