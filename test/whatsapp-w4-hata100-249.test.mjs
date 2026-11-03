// 2.4.9 W-4 — ANA OTURUM ONAYI (03.11.2026; docs/2.4.9-tasarim/W-whatsapp-sablon.md §6, §15): Meta hata 100'ün Türkçe başlığı İŞLEME göre seçilir. Önce her 100
// "Meta isteği tanımadı: Telefon Numarası Kimliği (Phone Number ID) ya da WhatsApp Business Hesap Kimliği (WABA ID) yanlış olabilir." diyordu — kimlikler doğruyken de
// (aboneliksiz bildirim adresi — ELLE KABUL BULGUSU 3, ileti isteğinde geçersiz değer, şablon açma isteğinde geçersiz değer). Sıra: alt kod 33 → kimlik metni; sonra işlem.
// Hata SINIFI (kind / retry) DEĞİŞMEZ — şablon denetiminin durma kuralı ve kuyruğun duraklatma / Başarısız kararı aynı kalır (değişmez koruması).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; gerçek Meta'ya istek YOK — ders 30); birim kısmında sahte fetch.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const IDS = /Phone Number ID|WABA ID|kimliği.*yanlış olabilir/i;
const meta100 = (message, extra = {}) => ({ error: { message, type: "OAuthException", code: 100, fbtrace_id: "AbCdEfGh", ...extra } });

describe("2.4.9 W-4 — hata 100 iletisi işleme göre (gerçek program, sahte Meta)", () => {
  it("şablon açma isteği 100 (2388024 değil): işlem iletisi 'şablon açma isteğindeki bir değeri kabul etmedi', kimlik suçlanmaz; şablon tek istekte denenir", async () => {
    const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
    const ctx = await startWa({ fake, connect: false });
    try {
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
      fake.set({ failNext: { match: /^POST \/\d+\/message_templates$/, sticky: true, status: 400, body: meta100("Invalid parameter", { error_data: { details: "Invalid parameter: components" } }) } });
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const actions = res.data.data.actions;
      assert.equal(actions.length, 2, JSON.stringify(actions));
      for (const action of actions) {
        assert.equal(action.ok, false);
        assert.match(action.message, /Meta şablon açma isteğindeki bir değeri kabul etmedi; şablon açılmadı\./, `${action.name}: ${action.message}`);
        assert.doesNotMatch(action.message, IDS, `${action.name}: kimlik doğruyken kimlik suçlanmamalı`);
        assert.match(action.message, /\(Meta hata kodu 100: Invalid parameter: components\)$/, "Meta'nın ayrıntısı korunur");
      }
      const creates = fake.requests.filter(item => item.method === "POST" && /\/message_templates$/.test(item.path));
      assert.equal(creates.length, 2, `her şablon TEK açma isteği (teslim süresiz yeniden deneme yok; geldi ${creates.length})`);
    } finally {
      await ctx.close();
      await fake.close();
    }
  });

  it("bildirim adresi kaydı 100 'must be subscribed' (ELLE KABUL BULGUSU 3): 'Meta bildirim adresini kaydetmedi … abonelik … Elle Bağla ön koşulları'; kartta Kaydedilemedi nedeni aynı", async () => {
    const ctx = await startWa();
    try {
      ctx.server.app.mobileRemote.setPublicUrl("http://ofisw4.destekofis.test");
      ctx.fake.set({ failNext: { match: /^POST \/\d+\/subscribed_apps$/, sticky: true, status: 400, body: meta100("(#100) Before override the current callback uri, your app must be subscribed to receive messages for WhatsApp Business Account") } });
      const res = await ctx.api.post(`${URLS.conn}/hook`, {});
      assert.equal(res.status, 502, JSON.stringify(res.data));
      assert.match(res.data.error, /^Meta bildirim adresini kaydetmedi: uygulamanızın bu WhatsApp Business hesabına aboneliği ve uygulama düzeyi webhook ayarı tamamlanmamış\./, res.data.error);
      assert.match(res.data.error, /Elle Bağla ön koşullarını/);
      assert.doesNotMatch(res.data.error, IDS, "kimlik doğruyken kimlik suçlanmamalı");
      const view = (await ctx.api.get(URLS.conn)).data.data;
      assert.equal(view.hook?.state, "failed");
      assert.match(view.hook.error, /^Meta bildirim adresini kaydetmedi/, "kartta (Kaydedilemedi · …) aynı neden");
    } finally {
      await ctx.close();
    }
  });

  it("bildirim adresi kaydı başka 100: 'Meta bildirim adresi kaydını kabul etmedi (geçersiz değer)'", async () => {
    const ctx = await startWa();
    try {
      ctx.server.app.mobileRemote.setPublicUrl("http://ofisw4.destekofis.test");
      ctx.fake.set({ failNext: { match: /^POST \/\d+\/subscribed_apps$/, sticky: true, status: 400, body: meta100("(#100) Invalid parameter", { error_data: { details: "override_callback_uri must be https" } }) } });
      const res = await ctx.api.post(`${URLS.conn}/hook`, {});
      assert.equal(res.status, 502);
      assert.match(res.data.error, /^Meta bildirim adresi kaydını kabul etmedi \(geçersiz değer\)\./, res.data.error);
      assert.doesNotMatch(res.data.error, IDS);
    } finally {
      await ctx.close();
    }
  });

  it("ileti isteği 100 (alt kodsuz): iş Başarısız, neden 'ileti isteğindeki bir değeri kabul etmedi'; toplu iş sürer (sınıf değişmedi)", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      ctx.fake.state.recipientErrors["+905321112233"] = { status: 400, body: meta100("(#100) Invalid parameter", { error_data: { details: "Parameter value is not valid" } }) };
      const res = await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      await ctx.drain();
      const detail = await ctx.detail(res.data.data.batch.id);
      const failed = detail.jobs.find(job => job.accountName === "Ayşe Yılmaz");
      const other = detail.jobs.find(job => job !== failed);
      assert.equal(failed?.state, "failed", JSON.stringify(detail.jobs.map(job => [job.state, job.reason])));
      assert.equal(failed.errorCode, 100);
      const text = failed.reason || "";
      assert.match(text, /^Meta ileti isteğindeki bir değeri kabul etmedi \(ör\. alıcı numarası ya da şablon değişkeni\)\./, text);
      assert.doesNotMatch(text, IDS);
      assert.equal(other?.state, "accepted", "öbür kişiye ileti gitti: toplu iş durmadı (100 = bu iletiye özgü)");
      assert.equal(detail.state, "done");
    } finally {
      await ctx.close();
    }
  });

  it("Bağlantıyı Sına: numara listesi okuması 100 (alt kodsuz) → 'Meta okuma isteğini kabul etmedi; … yanlış olabilir'", async () => {
    const ctx = await startWa();
    try {
      ctx.fake.set({ failNext: { match: /^GET \/\d+\/phone_numbers$/, status: 400, body: meta100("(#100) Invalid parameter") } });
      const res = await ctx.api.post(`${URLS.conn}/test`, {});
      assert.equal(res.status, 502, JSON.stringify(res.data));
      assert.match(res.data.error, /^Meta okuma isteğini kabul etmedi; Telefon Numarası Kimliği \(Phone Number ID\) ya da WhatsApp Business Hesap Kimliği \(WABA ID\) yanlış olabilir\./, res.data.error);
    } finally {
      await ctx.close();
    }
  });

  it("gerileme koruması — yanlış WABA (100 + alt kod 33): ileti kimlikleri söyler, /yanlış olabilir/ (test/whatsapp-w1-baglanti.test.mjs ile aynı beklenti)", async () => {
    const ctx = await startWa();
    try {
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: "999999999999" })).status, 200);
      const res = await ctx.api.post(`${URLS.conn}/test`, {});
      assert.equal(res.status, 502);
      assert.equal(res.data.meta.code, 100);
      assert.match(res.data.error, /Phone Number ID/);
      assert.match(res.data.error, /WABA ID/);
      assert.match(res.data.error, /yanlış olabilir/);
    } finally {
      await ctx.close();
    }
  });
});

// Birim: her istek türünde (op) 100 — alt kodsuz, 33, 2388024 — hata SINIFI aynı (request / never); 100 dışı kodların başlığı classifyMetaCode'unki (değişmedi).
describe("2.4.9 W-4 değişmez — hata sınıfı (kind / retry) işlemden bağımsız", () => {
  const graphWith = async body => {
    const { createMetaGraph, createMetaTemplates } = await import("../server/lib/whatsapp/meta-graph.mjs");
    const fetchImpl = async () => new Response(JSON.stringify(body), { status: 400, headers: { "content-type": "application/json" } });
    const options = { baseUrl: "http://127.0.0.1:9", fetchImpl, openToken: () => TOKEN, timeoutMs: 2000 };
    return { graph: createMetaGraph(options), templates: createMetaTemplates(options) };
  };
  const calls = ({ graph, templates }) => ({
    phoneNumbers: () => graph.phoneNumbers(WABA),
    phoneLimit: () => graph.phoneLimit(PNID),
    templates: () => graph.templates(WABA),
    sendTemplate: () => graph.sendTemplate(PNID, { to: "+905321112233", name: "destekofis_ekstre", language: "tr" }),
    uploadMedia: () => graph.uploadMedia(PNID, { data: Buffer.from("%PDF-1.4"), filename: "a.pdf" }),
    subscribeApp: () => graph.subscribeApp(WABA, { callbackUri: "https://x.test/wa/kanca/a", verifyToken: "v" }),
    subscribedApps: () => graph.subscribedApps(WABA),
    registerPhone: () => graph.registerPhone(PNID, "123456"),
    startSync: () => graph.startSync(PNID, "history"),
    details: () => templates.details(WABA),
    createTemplate: () => templates.createTemplate(WABA, { name: "destekofis_ekstre", language: "tr", category: "UTILITY", components: [{ type: "BODY", text: "x" }] }),
    resumableUpload: () => templates.resumableUpload(APP, { fileName: "a.pdf", fileType: "application/pdf", bytes: Buffer.from("%PDF-1.4") }),
  });
  const failure = async run => {
    try {
      await run();
    } catch (error) {
      return error;
    }
    return null;
  };

  it("100 (alt kodsuz / 33 / 2388024) her işlemde: kind request, retry never, kod ve alt kod korunur; ileti 'Meta hata kodu 100' ile biter", async () => {
    const { MetaGraphError } = await import("../server/lib/whatsapp/meta-graph.mjs");
    for (const subcode of [null, 33, 2388024]) {
      const client = await graphWith(meta100("(#100) Invalid parameter", subcode ? { error_subcode: subcode } : {}));
      for (const [op, run] of Object.entries(calls(client))) {
        const error = await failure(run);
        assert.ok(error instanceof MetaGraphError, `${op}/${subcode}: MetaGraphError (geldi ${error?.name})`);
        assert.equal(error.code, 100, `${op}/${subcode}`);
        assert.equal(error.subcode, subcode, `${op}/${subcode}`);
        assert.equal(error.kind, "request", `${op}/${subcode}: kind değişmemeli`);
        assert.equal(error.retry, "never", `${op}/${subcode}: retry değişmemeli`);
        assert.match(error.message, /\(Meta hata kodu 100: \(#100\) Invalid parameter\)$/, `${op}/${subcode}: ${error.message}`);
        assert.ok(error.title && !/undefined/.test(error.title), `${op}/${subcode}: başlık var`);
      }
    }
  });

  it("100 + alt kod 33 HER işlemde (abonelik iletili olsa da) kimlik başlığı: Phone Number ID, WABA ID ya da App ID; işleme özgü başlık 33'ün önüne geçmez", async () => {
    const client = await graphWith(meta100("(#100) Before override the current callback uri, your app must be subscribed to receive messages", { error_subcode: 33 }));
    for (const [op, run] of Object.entries(calls(client))) {
      const error = await failure(run);
      assert.match(error?.title || "", /^Meta bu kimlikle bir kayıt bulamadı ya da belirtecin bu kayda erişimi yok: .*Uygulama Kimliği \(App ID\) yanlış olabilir\.$/, `${op}: ${error?.title}`);
    }
  });

  it("100 dışı kodlarda başlık ve sınıf classifyMetaCode'la aynı (190, 131026, 131000, 132001, 1, bilinmeyen 987654)", async () => {
    const { classifyMetaCode } = await import("../server/lib/whatsapp/meta-graph.mjs");
    for (const code of [190, 131026, 131000, 132001, 1, 987654]) {
      const client = await graphWith({ error: { message: `(#${code}) x`, type: "OAuthException", code, fbtrace_id: "AbC" } });
      const known = classifyMetaCode(code);
      for (const [op, run] of Object.entries(calls(client))) {
        const error = await failure(run);
        assert.equal(error?.code, code, `${op}/${code}`);
        assert.equal(error.kind, known.kind, `${op}/${code}`);
        assert.equal(error.retry, known.retry, `${op}/${code}`);
        assert.equal(error.title, known.title || "Meta işlemi reddetti.", `${op}/${code}: başlık değişmedi`);
      }
    }
  });
});
