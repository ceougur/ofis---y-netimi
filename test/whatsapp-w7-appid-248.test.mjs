// 2.4.8 W7 — "WhatsApp'ı Bağla" ile bağlanan şirkette Uygulama Kimliği (App ID) (bulgu ORTA, c4e8aa2d gözden geçirmesi): connection.saveEmbedded App ID'yi
// boş yazıyordu → Ekstre şablonunun örnek PDF'i Meta'ya yüklenemiyor (Resumable Upload /<App ID>/uploads), Ekstre şablonu hiç açılmıyor ve Şablonlar kartı bu
// kipte olmayan "Bilgileri Değiştir"e yönlendiriyordu. DÜZELTME: kapıcı belirteci verdiği yanıtta (POST /v1/ofis/<ofis>/wa/oturum/<id>/al) belirtecin ait
// olduğu uygulamanın kimliğini (WA_UYGULAMA_KIMLIGI — gizli değil) verir, program "embedded" kaydına yazar; gelmezse neden bu kipe uygun yazılır.
// "Nasıl bozulur": App ID kaydedilmez / başka uygulamanınki yazılır; yükleme App ID'siz denenir; eski kapıcı App ID vermezse ileti olmayan düğmeye gönderir.
// Elle Bağla'daki ileti (komşu, ders 10): test/whatsapp-w5-sablon.test.mjs. Gerçek Meta / Cloudflare / lisans servisine istek YOK (ders 30).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { startKapi } from "./kapi-yerel.mjs";
import { rawRequest } from "./mobil-uzak-ortak.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

const T0 = Date.parse("2026-11-20T10:00:00+03:00");
const KAPI = "kapi.destekofis.test";
const APP_ID = "1505264761663625";
const META_BELIRTEC = "EAAG-isletme-belirteci-W7-appid-0123456789";
const WABA = "102290129340398";
const PNID = "106540352242922";
const WA_ENV = { WA_UYGULAMA_KIMLIGI: APP_ID, WA_KURULUM_KIMLIGI: "990011223344556", WA_UYGULAMA_SIRRI: "DESTEKOFIS-META-APP-SECRET-appid-0123", WA_GRAPH_URL: "https://meta.kapi.test" };

/** Program + yerel kapıcı + sahte Graph. eskiKapici: kapıcının /al yanıtından appId çıkarılır (App ID vermeyen kapıcı / eksik ayar). */
async function ortam({ eskiKapici = false } = {}) {
  const clock = createClock({ time: new Date(T0).toISOString(), fixed: true });
  const lisans = lisansAnahtari();
  const MACHINE = "0123456789abcdef0123456789abcdef";
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-W7-APPID" });
  const graph = await startFakeGraph({ token: META_BELIRTEC, phoneNumberId: PNID, wabaId: WABA, appId: APP_ID });
  const metaFetch = async () => new Response(JSON.stringify({ access_token: META_BELIRTEC, token_type: "bearer" }), { status: 200, headers: { "content-type": "application/json" } });
  const kapi = await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }), ekEnv: WA_ENV, waFetch: metaFetch });
  const alYanitlari = [];
  const kapiFetch = async (url, init) => {
    const yanit = await globalThis.fetch(url, init);
    if (!/\/wa\/oturum\/[A-Za-z0-9_-]{43}\/al$/.test(new URL(url).pathname)) return yanit;
    const govde = await yanit.json();
    alYanitlari.push(structuredClone(govde));
    if (eskiKapici && govde?.data) delete govde.data.appId;
    return new Response(JSON.stringify(govde), { status: yanit.status, headers: { "content-type": "application/json", ...(yanit.headers.get("date") ? { date: yanit.headers.get("date") } : {}) } });
  };
  const server = await startTestServer({
    now: clock,
    remoteNow: clock,
    mobileKapiUrl: kapi.base,
    mobileKapiFetch: kapiFetch,
    whatsappGraphUrl: graph.url,
    whatsappTimeoutMs: 1500,
    license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.w7.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
  });
  await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
  const admin = await loginAdmin(server);
  return {
    graph,
    admin,
    alYanitlari,
    // Program ekranının akışı: oturum (sır yanıtta) → bağlama sayfasının kod gönderimi (sırla) → sonuç.
    async bagla() {
      const bas = await admin.post("/api/workspace/whatsapp/connection/embedded", {});
      assert.equal(bas.status, 200, `ön koşul: oturum ${JSON.stringify(bas.data)}`);
      const { session, url, secret } = bas.data.data;
      const oturum = new URL(url).hash.replace(/^#o=/, "");
      const kod = await rawRequest(kapi.base, "POST", "/wa/bagla/kod", { headers: { host: KAPI }, body: { oturum, sir: secret, kod: "AQD-appid-kodu-1", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" } });
      assert.equal(kod.status, 200, `ön koşul: kod değişimi ${kod.text.slice(0, 200)}`);
      const sonuc = await admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {});
      assert.equal(sonuc.data?.data?.state, "ready", `ön koşul: bağlandı ${JSON.stringify(sonuc.data).slice(0, 300)}`);
      return sonuc.data.data.connection;
    },
    ensure: () => admin.post("/api/workspace/whatsapp/templates/ensure", {}),
    close: async () => {
      await server.close().catch(() => {});
      await kapi.close();
      await graph.close();
    },
  };
}
const yuklemeler = graph => graph.requests.filter(item => item.path.endsWith("/uploads") || item.path.startsWith("/upload:"));

describe("2.4.8 W7 — WhatsApp'ı Bağla: App ID kapıcıdan gelir, Ekstre şablonu açılır", () => {
  it("bağlanınca App ID kaydedilir; Şablonları Denetle ve Oluştur: örnek PDF /<App ID>/uploads ile yüklenir, Ekstre ve Ödeme Hatırlatma Meta'ya gönderilir", async () => {
    const c = await ortam();
    try {
      const view = await c.bagla();
      assert.equal(c.alYanitlari.at(-1)?.data?.appId, APP_ID, `kapıcı belirteçle birlikte App ID vermedi: ${JSON.stringify(Object.keys(c.alYanitlari.at(-1)?.data || {}))}`);
      assert.deepEqual([view.mode, view.appId], ["embedded", APP_ID], `embedded kayıtta App ID boş: ${JSON.stringify({ mode: view.mode, appId: view.appId })}`);
      const r = await c.ensure();
      assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 300));
      const actions = r.data.data.actions;
      const ekstre = actions.find(item => item.name === "destekofis_ekstre");
      assert.ok(ekstre?.ok && ekstre.created, `Ekstre şablonu açılmadı: ${JSON.stringify(ekstre)}`);
      assert.ok(actions.find(item => item.name === "destekofis_odeme_hatirlatma")?.ok, "Ödeme Hatırlatma açıldı");
      const yukleme = yuklemeler(c.graph);
      assert.equal(yukleme[0]?.path, `/${APP_ID}/uploads`, `örnek PDF yükleme oturumu App ID ile açılmadı: ${JSON.stringify(yukleme.map(item => item.path))}`);
      assert.equal(yukleme.length, 2, "oturum + dosya (iki istek)");
      assert.equal(c.graph.state.uploads.length, 1, "sahte Meta'da bir yükleme");
      assert.equal(r.data.data.hasAppId, true);
    } finally {
      await c.close();
    }
  });

  it("kapıcı App ID vermezse (eski kapıcı / eksik ayar): Ekstre açılmaz, yükleme denenmez; neden bu kipe uygun — 'Bilgileri Değiştir'e (bu kipte yok) göndermez", async () => {
    const c = await ortam({ eskiKapici: true });
    try {
      const view = await c.bagla();
      assert.equal(view.appId, "", "ön koşul: App ID gelmedi");
      const r = await c.ensure();
      assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 300));
      const ekstre = r.data.data.actions.find(item => item.name === "destekofis_ekstre");
      assert.equal(ekstre?.code, "app-id", JSON.stringify(ekstre));
      assert.doesNotMatch(ekstre.message, /Bilgileri Değiştir/, `WhatsApp'ı Bağla kipinde olmayan düğmeye yönlendiriyor: ${ekstre.message}`);
      assert.match(ekstre.message, /Uygulama Kimliği \(App ID\) gerekir; WhatsApp'ı Bağla bu kimliği vermedi; WhatsApp'ı Yeniden Bağla ile yeniden bağlayın/, ekstre.message);
      assert.equal(yuklemeler(c.graph).length, 0, "App ID yokken yükleme denenmedi");
      assert.ok(r.data.data.actions.find(item => item.name === "destekofis_odeme_hatirlatma")?.ok, "Ödeme Hatırlatma yine açıldı");
    } finally {
      await c.close();
    }
  });
});
