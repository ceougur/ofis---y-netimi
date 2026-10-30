// 2.4.8 W7 — "WhatsApp'ı Bağla" (Embedded Signup v5 + birlikte kullanım; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.8, §4, §6 W7, §11 S4 A).
// (A) kapıcı (bulut/kapi/kapi.mjs + wa-bagla.mjs) Node'da: sahte R2, sahte saat, SAHTE Meta (kod → belirteç değişimi); (B) GERÇEK program + yerel kapıcı +
// sahte Graph (test/whatsapp-sahte-graph.mjs). Gerçek Meta'ya, Cloudflare'e, lisans servisine istek YOK (ders 30; Meta adresi bu dosyada yazılmaz —
// test/whatsapp-meta-izolasyon.test.mjs). "Nasıl bozulur" (plan §8 GÜVENLİK): App Secret programa / sayfaya / yanıta sızar; kod değişimi imzasız ya da başka
// ofisin oturumuna bağlanır; kod iki kez kullanılır; kapıcı belirteci düz saklar ya da 10 dk'dan uzun tutar; Meta onayı yokken ileti anlaşılmaz.
// Eski kodda (8ef48138) uçlar ve modül yok → beklenen nedenle kırmızı (404 / modül bulunamadı).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
// Ad alanıyla: eski kodda (W7 yardımcıları yok) dosya yine yüklenir, denetimler davranışla kırmızı olur (ders 38).
import * as protokol from "../server/lib/kapi-protokol.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";
import { sahteOnbellek, sahteR2, startKapi } from "./kapi-yerel.mjs";
import { rawRequest } from "./mobil-uzak-ortak.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

const T0 = Date.parse("2026-11-20T10:00:00+03:00");
const ALAN = "destekofis.test";
const KAPI = `kapi.${ALAN}`;
const APP_ID = "1505264761663625";
const CONFIG_ID = "990011223344556";
const SIR = "DESTEKOFIS-META-APP-SECRET-0123456789abcdef";
const META_BELIRTEC = "EAAG-isletme-belirteci-W7-0123456789";
const WABA = "102290129340398";
const PNID = "106540352242922";
const ONAY = "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.";
const WA_ENV = { WA_UYGULAMA_KIMLIGI: APP_ID, WA_KURULUM_KIMLIGI: CONFIG_ID, WA_UYGULAMA_SIRRI: SIR, WA_GRAPH_URL: "https://meta.kapi.test" };

/** Sahte Meta (yalnız kod → belirteç değişimi): istek kaydı; hata / gizli yankısı düğmeleri. */
function sahteMeta() {
  const m = { istekler: [], hata: null, yanki: false };
  m.fetch = async url => {
    const u = new URL(url);
    m.istekler.push({ host: u.host, path: u.pathname, query: Object.fromEntries(u.searchParams) });
    if (m.hata) {
      const ileti = m.yanki ? `${m.hata} client_secret=${u.searchParams.get("client_secret")} code=${u.searchParams.get("code")}` : m.hata;
      return new Response(JSON.stringify({ error: { message: ileti, type: "OAuthException", code: 100, fbtrace_id: "Abc" } }), { status: 400, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ access_token: META_BELIRTEC, token_type: "bearer" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return m;
}

async function ortam({ ekEnv = WA_ENV, lisansEk = {} } = {}) {
  let t = T0;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const meta = sahteMeta();
  const kapi = createKapi({ now: () => t, onbellek: sahteOnbellek(), lisansFetch: async () => ({ json: async () => ({ ok: false }) }), waFetch: meta.fetch, fetchOrigin: async () => new Response("{}", { status: 200 }) });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, ...ekEnv };
  const istek = (url, init) => kapi.fetch(new Request(url, init), env);
  const istemci = kapiIstemcisi({ url: `https://${KAPI}`, fetchImpl: istek, simdi: () => t, kayitSimdi: () => (t += 1) });
  const c = {
    r2,
    meta,
    env,
    now: () => t,
    ilerle: ms => {
      t += ms;
    },
    istemci,
    async ofis(makine = "ab".repeat(16)) {
      const o = await ofisAnahtari();
      const r = await istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}`, ...lisansEk }), cihazlar: [] });
      return { o, r };
    },
    async programAnahtari() {
      const cift = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
      const jwk = await globalThis.crypto.subtle.exportKey("jwk", cift.publicKey);
      return { gizli: cift.privateKey, acik: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
    },
    // İmzasız / başka anahtarla imzalı istek (ofis kanalı taklidi).
    async ham(o, yol, govde, { imzaAnahtari = o.imzaAnahtari, imzasiz = false } = {}) {
      const metin = JSON.stringify(govde);
      const basliklar = { "content-type": "application/json", "x-do-zaman": String(t) };
      if (!imzasiz) basliklar["x-do-imza"] = await protokol.ecdsaImzala(imzaAnahtari, protokol.mesaj.ofis("POST", yol, t, await protokol.sha256Hex(metin)));
      const r = await istek(`https://${KAPI}${yol}`, { method: "POST", headers: basliklar, body: metin });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    // Programın imzalı kanalı (server/lib/mobile-ozet.mjs waOturum / waAl ile aynı istek; burada doğrudan — eski kodda da koşar).
    waOturum: (o, anahtar) => c.ham(o, `/v1/ofis/${o.id}/wa/oturum`, { v: 1, ofis: o.id, anahtar }),
    waAl: (o, oturum) => c.ham(o, `/v1/ofis/${o.id}/wa/oturum/${oturum}/al`, { v: 1, ofis: o.id }),
    async sayfa() {
      const r = await istek(`https://${KAPI}/wa/bagla`, { headers: { accept: "text/html", "sec-fetch-mode": "navigate" } });
      return { status: r.status, metin: await r.text(), csp: r.headers.get("content-security-policy") || "" };
    },
    async kod(govde, { origin = `https://${KAPI}` } = {}) {
      const r = await istek(`https://${KAPI}/wa/bagla/kod`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(govde) });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    r2Metni: () => [...r2.nesneler.values()].map(k => new TextDecoder().decode(k.veri)).join("\n"),
  };
  return c;
}

describe("2.4.8 W7 (A) — kapıcı: bağlama sayfası, kod → belirteç değişimi (App Secret yalnız kapıcıda), şifreli teslim", () => {
  it("Meta onayı (kapıcı ayarı) yokken: oturum açılmaz, açık Türkçe ileti; sayfa Facebook SDK'sını yüklemez ve aynı iletiyi gösterir", async () => {
    const c = await ortam({ ekEnv: {} });
    const { o, r } = await c.ofis();
    assert.equal(r.ok, true);
    const p = await c.programAnahtari();
    const ac = await c.waOturum(o, p.acik);
    assert.deepEqual([ac.status, ac.code, ac.error], [409, "kapi-wa-ayar", ONAY], `ayarsız kapıcı: ${JSON.stringify(ac)}`);
    const s = await c.sayfa();
    assert.equal(s.status, 200);
    assert.match(s.metin, /Bu bağlantı DestekOfis&#39;in Meta onayından sonra çalışır; şimdilik Elle Bağla\./, "sayfada ileti");
    assert.doesNotMatch(s.metin, /connect\.facebook\.net/, "ayarsız sayfada SDK yok");
  });

  it("uçtan uca: oturum (imzalı) → sayfa (App ID + config_id var, App Secret YOK) → kod → Meta'ya değişim (sır yalnız bu istekte) → şifreli teslim bir kez; R2'de düz belirteç yok", async () => {
    const c = await ortam();
    const { o } = await c.ofis();
    const p = await c.programAnahtari();
    const ac = await c.waOturum(o, p.acik);
    assert.equal(ac.ok, true, JSON.stringify(ac));
    const { oturum, adres, sureSn } = ac.data;
    assert.match(adres, new RegExp(`^https://${KAPI.replace(/\./g, "\\.")}/wa/bagla#o=${oturum}$`), "bağlama adresi kapıcıda, oturum # kısmında");
    assert.equal(sureSn, 600);
    const s = await c.sayfa();
    assert.ok(s.metin.includes(APP_ID) && s.metin.includes(CONFIG_ID), "sayfada App ID ve yapılandırma kimliği");
    assert.ok(!s.metin.includes(SIR), "App Secret sayfaya GİRMEZ");
    assert.match(s.metin, /response_type:'code'/, "FB.login kod akışı");
    assert.match(s.csp, /script-src 'nonce-[A-Za-z0-9_-]+' https:\/\/connect\.facebook\.net/, "CSP: yalnız nonce + Facebook SDK");
    assert.equal((await c.waAl(o, oturum)).data?.durum, "bekliyor", "kod gelmeden bekliyor");
    const k = await c.kod({ oturum, kod: "AQD-kod-tek-kullanimlik-0001", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
    assert.deepEqual([k.status, k.data?.durum], [200, "hazir"], JSON.stringify(k));
    assert.deepEqual(c.meta.istekler.map(x => [x.host, x.path, x.query.client_id, x.query.client_secret, x.query.code]), [["meta.kapi.test", "/v26.0/oauth/access_token", APP_ID, SIR, "AQD-kod-tek-kullanimlik-0001"]], "değişim kapıcıdan, sırla, bir kez");
    assert.ok(!c.r2Metni().includes(META_BELIRTEC), "kapıcı belirteci DÜZ saklamaz");
    assert.ok(!c.r2Metni().includes(SIR), "App Secret R2'ye yazılmaz");
    const al = await c.waAl(o, oturum);
    assert.equal(al.data?.durum, "hazir", JSON.stringify(al));
    assert.ok(!JSON.stringify(al).includes(SIR) && !JSON.stringify(al).includes(META_BELIRTEC), "teslim yanıtında sır ve düz belirteç yok");
    assert.deepEqual([al.data.wabaId, al.data.phoneNumberId, al.data.olay], [WABA, PNID, "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"]);
    assert.equal(await protokol.waCoz(p.gizli, al.data.sifreli, protokol.waBaglam(o.id, oturum)), META_BELIRTEC, "program kendi geçici anahtarıyla açar");
    await assert.rejects(protokol.waCoz(p.gizli, al.data.sifreli, protokol.waBaglam(o.id, "x".repeat(43))), "başka oturumun bağlamıyla açılmaz");
    assert.equal((await c.waAl(o, oturum)).code, "kapi-wa-oturum", "teslimden sonra oturum silindi (bir kez)");
    assert.equal(c.r2.nesneler.has(`wa-oturum/${oturum}.json`), false);
  });

  it("kod değişimi İMZASIZ olamaz: imzasız / başka anahtarla oturum ve teslim 401; başka ofis bu oturumun belirtecini alamaz; kod iki kez kullanılamaz", async () => {
    const c = await ortam();
    const { o } = await c.ofis("ab".repeat(16));
    const { o: baska } = await c.ofis("cd".repeat(16));
    const p = await c.programAnahtari();
    const yol = `/v1/ofis/${o.id}/wa/oturum`;
    assert.deepEqual([(await c.ham(o, yol, { v: 1, ofis: o.id, anahtar: p.acik }, { imzasiz: true })).status, (await c.ham(o, yol, { v: 1, ofis: o.id, anahtar: p.acik }, { imzaAnahtari: baska.imzaAnahtari })).code], [401, "kapi-imza"], "oturum ofis imzası ister");
    const { oturum } = (await c.waOturum(o, p.acik)).data;
    assert.equal((await c.kod({ oturum, kod: "AQD-kod-iki-kez", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH" })).data?.durum, "hazir");
    const ikinci = await c.kod({ oturum, kod: "AQD-kod-iki-kez", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH" });
    assert.deepEqual([ikinci.status, ikinci.code], [409, "kapi-wa-kullanildi"], "kod tek kullanımlık");
    assert.equal(c.meta.istekler.length, 1, "Meta'ya tek değişim");
    const alYol = `/v1/ofis/${o.id}/wa/oturum/${oturum}/al`;
    assert.equal((await c.ham(o, alYol, { v: 1, ofis: o.id }, { imzasiz: true })).code, "kapi-imza", "teslim imzasız olamaz");
    assert.equal((await c.waAl(baska, oturum)).code, "kapi-wa-oturum", "başka ofis bu oturumu göremez");
    assert.equal((await c.waAl(o, oturum)).data?.durum, "hazir", "sahibi alır");
    assert.equal((await c.kod({ oturum, kod: "AQD-yabanci" }, { origin: "https://saldirgan.example" })).code, "kapi-wa-koken", "başka kökten gönderim reddedilir");
  });

  it("Meta değişimi reddederse açık ileti (sır ve kod iletiden ayıklanır); oturum 'hata' olarak programa bir kez verilir", async () => {
    const c = await ortam();
    const { o } = await c.ofis();
    const p = await c.programAnahtari();
    const { oturum } = (await c.waOturum(o, p.acik)).data;
    c.meta.hata = "This app is not approved for Embedded Signup";
    c.meta.yanki = true;
    const k = await c.kod({ oturum, kod: "AQD-reddedilen-kod-9", wabaId: WABA, phoneNumberId: PNID, olay: "FINISH" });
    assert.deepEqual([k.status, k.code, k.error], [502, "kapi-wa-meta", `Meta bağlantıyı tamamlamadı. ${ONAY}`], JSON.stringify(k));
    assert.ok(k.metaIleti.includes("not approved") && !k.metaIleti.includes(SIR) && !k.metaIleti.includes("AQD-reddedilen-kod-9"), `Meta iletisi ayıklandı: ${k.metaIleti}`);
    const al = await c.waAl(o, oturum);
    assert.deepEqual([al.data?.durum, al.data?.ileti], ["hata", `Meta bağlantıyı tamamlamadı. ${ONAY}`]);
    assert.ok(!c.r2Metni().includes(SIR), "sır hiçbir yere yazılmadı");
  });

  it("oturum en çok 10 dk: süresi geçince kod ve teslim 410; zamanlanmış tur artığı siler; lisansı biten ofis oturum açamaz", async () => {
    const c = await ortam();
    const { o } = await c.ofis();
    const p = await c.programAnahtari();
    const { oturum } = (await c.waOturum(o, p.acik)).data;
    c.ilerle(10 * 60_000);
    assert.equal((await c.kod({ oturum, kod: "AQD-gec", wabaId: WABA, phoneNumberId: PNID })).code, "kapi-wa-sure");
    assert.equal(c.meta.istekler.length, 0, "süresi geçen kod Meta'ya gitmez");
    const ikinci = (await c.waOturum(o, p.acik)).data.oturum;
    c.ilerle(11 * 60_000);
    assert.equal(c.r2.nesneler.has(`wa-oturum/${ikinci}.json`), true, "ön koşul: artık oturum");
    const rapor = await (createKapi({ now: () => c.now(), onbellek: sahteOnbellek(), lisansFetch: async () => ({ json: async () => ({ ok: false }) }) })).temizlik(c.env);
    assert.ok(rapor.waOturum >= 1, JSON.stringify(rapor));
    assert.equal(c.r2.nesneler.has(`wa-oturum/${ikinci}.json`), false, "zamanlanmış tur sildi");
    const bitmis = await ortam({ lisansEk: { kind: "trial", expiresAt: new Date(T0 + 60_000).toISOString() } });
    const b = await bitmis.ofis();
    bitmis.ilerle(2 * 60_000);
    assert.equal((await bitmis.waOturum(b.o, p.acik)).code, "kapi-lisans", "geçersiz lisansla bağlama yok");
  });
});

describe("2.4.8 W7 (B) — program: WhatsApp'ı Bağla düz açık; belirteç kapıcıdan şifreli gelir, 'embedded' kipinde mühürlenir; Meta adımları", () => {
  async function program({ ekEnv = WA_ENV, olay = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", kapiYok = false } = {}) {
    const clock = createClock({ time: new Date(T0).toISOString(), fixed: true });
    const lisans = lisansAnahtari();
    const MACHINE = "0123456789abcdef0123456789abcdef";
    const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-W7-TEST" });
    const meta = sahteMeta();
    const graph = await startFakeGraph({ token: META_BELIRTEC, phoneNumberId: PNID, wabaId: WABA });
    const kapi = kapiYok ? null : await startKapi({ now: () => clock.ms(), trustedKeys: lisans.trusted, lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }), ekEnv, waFetch: meta.fetch });
    const server = await startTestServer({
      now: clock,
      remoteNow: clock,
      ...(kapi ? { mobileKapiUrl: kapi.base } : {}),
      whatsappGraphUrl: graph.url,
      whatsappTimeoutMs: 1500,
      license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.w7.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
    });
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const admin = await loginAdmin(server);
    const ctx = {
      clock,
      meta,
      graph,
      kapi,
      server,
      admin,
      olay,
      async sayfayaKod(url, ek = {}) {
        const oturum = new URL(url).hash.replace(/^#o=/, "");
        const r = await rawRequest(kapi.base, "POST", "/wa/bagla/kod", { headers: { host: KAPI }, body: { oturum, kod: "AQD-program-kodu-1", wabaId: WABA, phoneNumberId: PNID, olay, ...ek } });
        return { status: r.status, data: r.data };
      },
      close: async () => {
        await server.close().catch(() => {});
        await kapi?.close();
        await graph.close();
      },
    };
    return ctx;
  }
  const veriTabaniMetni = server => {
    const satirlar = [server.app.store.all("SELECT key, value FROM settings"), server.app.store.all("SELECT * FROM audit_events")];
    assert.ok(satirlar[0].some(r => r.key === "whatsapp.meta"), "ön koşul: bağlantı satırı okunan veri tabanında (okunamayan veri boş sayılmaz — ders 4)");
    return JSON.stringify(satirlar);
  };

  it("birlikte kullanım: Bağla → kapıcı sayfası → kod → program belirteci alır, 'embedded' kipinde mühürler, eşitlemeyi başlatır ve sınar; belirteç ve App Secret yanıtta / veri tabanında / işlem geçmişinde YOK", async () => {
    const c = await program();
    try {
      const bas = await c.admin.post("/api/workspace/whatsapp/connection/embedded", {});
      assert.equal(bas.status, 200, JSON.stringify(bas.data));
      const { session, url, seconds } = bas.data.data;
      assert.match(url, new RegExp(`^https://${KAPI.replace(/\./g, "\\.")}/wa/bagla#o=${session}$`));
      assert.equal(seconds, 600);
      assert.equal((await c.admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {})).data.data.state, "waiting", "kod gelmeden bekliyor");
      const kod = await c.sayfayaKod(url);
      assert.equal(kod.status, 200, JSON.stringify(kod.data));
      const sonuc = await c.admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {});
      assert.equal(sonuc.status, 200, JSON.stringify(sonuc.data));
      const view = sonuc.data.data.connection;
      assert.deepEqual([sonuc.data.data.state, view.mode, view.wabaId, view.phoneNumberId, view.hasToken, view.tokenUsable], ["ready", "embedded", WABA, PNID, true, true], JSON.stringify(view));
      assert.equal(view.embedded?.coex, true, "birlikte kullanım");
      assert.deepEqual(view.embedded.steps.map(s => [s.name, s.ok]), [["smb_app_state_sync", true], ["history", true]], "kişi + geçmiş eşitlemesi başlatıldı");
      assert.deepEqual(c.graph.state.embeddedSteps.map(s => s.body.sync_type), ["smb_app_state_sync", "history"]);
      assert.ok(c.graph.requests.filter(r => r.path.endsWith("/smb_app_data")).every(r => r.auth === `Bearer ${META_BELIRTEC}`), "Meta adımları kapıcıdan gelen belirteçle");
      assert.equal(view.lastTest?.ok, true, "bağlantı kendiliğinden sınandı");
      const tum = JSON.stringify([bas.data, sonuc.data, view]) + veriTabaniMetni(c.server);
      assert.ok(!tum.includes(META_BELIRTEC), "belirteç yanıtlara, ayar satırına (mühürlü) ve işlem geçmişine düz girmez");
      assert.ok(!tum.includes(SIR), "App Secret programa hiç girmez");
      assert.equal((await c.admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {})).status, 404, "oturum bir kez");
    } finally {
      await c.close();
    }
  });

  it("birlikte kullanım değilse numara Cloud API'ye kaydedilir (6 haneli PIN, ekranda yok)", async () => {
    const c = await program({ olay: "FINISH" });
    try {
      const { session, url } = (await c.admin.post("/api/workspace/whatsapp/connection/embedded", {})).data.data;
      assert.equal((await c.sayfayaKod(url)).status, 200);
      const view = (await c.admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {})).data.data.connection;
      assert.deepEqual([view.embedded?.coex, view.embedded?.steps.map(s => [s.name, s.ok])], [false, [["register", true]]]);
      const pin = c.graph.state.embeddedSteps[0].body.pin;
      assert.match(pin, /^[0-9]{6}$/);
      assert.ok(!JSON.stringify(view).includes(pin) && !veriTabaniMetni(c.server).includes(`"${pin}"`), "PIN ekrana ve düz kayda girmez");
    } finally {
      await c.close();
    }
  });

  it("Tech Provider onayı yokken (kapıcı Meta ayarı yok): düğme açık, ileti 'Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.'; Meta reddederse aynı ileti + Meta'nın yanıtı", async () => {
    const yok = await program({ ekEnv: {} });
    try {
      const r = await yok.admin.post("/api/workspace/whatsapp/connection/embedded", {});
      assert.deepEqual([r.status, r.data.code, r.data.error], [409, "whatsapp-embedded-unavailable", ONAY], JSON.stringify(r.data));
    } finally {
      await yok.close();
    }
    const red = await program();
    try {
      red.meta.hata = "Application does not have permission for this action";
      const { session, url } = (await red.admin.post("/api/workspace/whatsapp/connection/embedded", {})).data.data;
      assert.equal((await red.sayfayaKod(url)).status, 502);
      const s = await red.admin.post(`/api/workspace/whatsapp/connection/embedded/${session}`, {});
      assert.deepEqual([s.data.data.state, s.data.data.message], ["error", `Meta bağlantıyı tamamlamadı. ${ONAY} Meta'nın yanıtı: Application does not have permission for this action`], JSON.stringify(s.data));
      assert.equal((await red.admin.get("/api/workspace/whatsapp/connection")).data.data.configured, false, "bağlantı kaydedilmedi");
    } finally {
      await red.close();
    }
    const kapisiz = await program({ kapiYok: true });
    try {
      const r = await kapisiz.admin.post("/api/workspace/whatsapp/connection/embedded", {});
      assert.deepEqual([r.status, r.data.code], [409, "whatsapp-embedded-kapi"], JSON.stringify(r.data));
    } finally {
      await kapisiz.close();
    }
  });
});
