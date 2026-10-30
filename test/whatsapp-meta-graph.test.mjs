// 2.4.8 W1: Meta istemcisi birim testleri (server/lib/whatsapp/meta-graph.mjs) — ağsız, sahte fetch ile. Belirteç yalnız Authorization başlığında; hata
// iletisinde (Meta yankılasa bile) yok; yönlendirme izlenmez; sayfalama yalnız yapılandırılmış adrese `after` imleciyle; hata kodu → yeniden deneme sınıfı
// (plan §2.7, §6 W2); sınır basamağı ve kalite metinleri.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const TOKEN = "SAHTE-W1-birim-Belirteci-1234567890";
const BASE = "http://127.0.0.1:4555";
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const load = () => import("../server/lib/whatsapp/meta-graph.mjs");

describe("2.4.8 W1 — Meta istemcisi", () => {
  it("istek: sürüm sabiti + belirteç yalnız başlıkta; adres sorgusunda ve gövdede yok; yönlendirme izlenmez (manual)", async () => {
    const { createMetaGraph, GRAPH_VERSION } = await load();
    assert.equal(GRAPH_VERSION, "v26.0", "plan §2.1");
    const calls = [];
    const graph = createMetaGraph({ baseUrl: BASE, openToken: () => TOKEN, fetchImpl: async (url, init) => (calls.push({ url, init }), json(200, { whatsapp_business_manager_messaging_limit: "TIER_2K", id: "1" })) });
    assert.equal(await graph.phoneLimit("106540352242922"), "TIER_2K");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${BASE}/v26.0/106540352242922?fields=whatsapp_business_manager_messaging_limit`);
    assert.equal(calls[0].init.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(calls[0].init.redirect, "manual");
    assert.ok(!calls[0].url.includes(TOKEN));
  });

  it("belirteç açılamazsa (boş) ve kimlik adres karakteri taşırsa istek yapılmaz", async () => {
    const { createMetaGraph } = await load();
    let count = 0;
    const fetchImpl = async () => (count++, json(200, {}));
    await assert.rejects(createMetaGraph({ baseUrl: BASE, openToken: () => "", fetchImpl }).phoneLimit("1065403522"), error => error.reason === "token");
    await assert.rejects(createMetaGraph({ baseUrl: BASE, openToken: () => TOKEN, fetchImpl }).phoneLimit("../me"), error => error.reason === "request");
    await assert.rejects(createMetaGraph({ baseUrl: BASE, openToken: () => TOKEN, fetchImpl }).templates("1?x=1"), error => error.reason === "request");
    assert.equal(count, 0);
  });

  it("Meta hata gövdesi: Türkçe başlık + kod + yeniden deneme sınıfı; Meta metni belirteci yankılasa da iletide yok", async () => {
    const { createMetaGraph, MetaGraphError } = await load();
    const graph = createMetaGraph({ baseUrl: BASE, openToken: () => TOKEN, fetchImpl: async () => json(401, { error: { message: `Invalid OAuth access token: ${TOKEN}`, type: "OAuthException", code: 190, error_data: { details: `Bearer ${TOKEN} geçersiz` }, fbtrace_id: "Ab" } }) });
    const error = await graph.phoneLimit("1065403522").catch(failure => failure);
    assert.ok(error instanceof MetaGraphError);
    assert.equal(error.code, 190);
    assert.equal(error.retry, "never");
    assert.equal(error.httpStatus, 401);
    assert.match(error.message, /süresi dolmuş/);
    assert.ok(!error.message.includes(TOKEN) && !JSON.stringify(error.toJSON()).includes(TOKEN), "yankılanan belirteç silindi");
    assert.ok(!error.message.includes(TOKEN.slice(0, 12)));
  });

  it("ağ hatası, zaman aşımı, gövdesiz 5xx, 3xx yönlendirme → sonuç bilinmiyor (retry unknown)", async () => {
    const { createMetaGraph } = await load();
    const make = fetchImpl => createMetaGraph({ baseUrl: BASE, openToken: () => TOKEN, fetchImpl, timeoutMs: 80 });
    let error = await make(async () => { throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }); }).phoneLimit("1065403522").catch(failure => failure);
    assert.equal(error.reason, "network");
    assert.equal(error.retry, "unknown");
    assert.match(error.details, /ECONNREFUSED/);
    error = await make(() => new Promise(() => {})).phoneLimit("1065403522").catch(failure => failure);
    assert.equal(error.reason, "timeout");
    error = await make(async () => new Response("<html>502</html>", { status: 502, headers: { "content-type": "text/html" } })).phoneLimit("1065403522").catch(failure => failure);
    assert.equal(error.reason, "http");
    assert.equal(error.httpStatus, 502);
    assert.equal(error.retry, "unknown");
    let calls = 0;
    error = await make(async () => (calls++, new Response(null, { status: 302, headers: { location: "https://baska.example/yol" } }))).phoneLimit("1065403522").catch(failure => failure);
    assert.equal(error.reason, "redirect");
    assert.equal(calls, 1, "yönlendirme izlenmedi");
    error = await make(async () => json(200, { messages: [] })).sendTemplate("1065403522", { to: "+905321112233", name: "hello_world", language: "en_US" }).catch(failure => failure);
    assert.equal(error.reason, "body", "ileti kimliksiz kabul yanıtı belirsiz");
  });

  it("sayfalama: `after` imleciyle yapılandırılmış adrese; yanıttaki mutlak paging.next adresine gidilmez; en çok 3 sayfa", async () => {
    const { createMetaGraph, META_D0 } = await load();
    const urls = [];
    const graph = createMetaGraph({
      baseUrl: BASE,
      openToken: () => TOKEN,
      fetchImpl: async url => {
        urls.push(url);
        const page = urls.length;
        return json(200, { data: [{ name: `sablon_${page}`, status: "APPROVED" }], paging: { cursors: { after: `IMLEC${page}` }, next: `https://baska.example/v26.0/x?after=IMLEC${page}` } });
      },
    });
    const result = await graph.templates("102290129340398");
    assert.equal(urls.length, META_D0.maxPages);
    assert.equal(result.items.length, 3);
    assert.equal(result.complete, false);
    assert.ok(urls.every(url => url.startsWith(`${BASE}/v26.0/102290129340398/message_templates?`)), "yalnız yapılandırılmış adres");
    assert.equal(new URL(urls[1]).searchParams.get("after"), "IMLEC1");
    assert.equal(new URL(urls[0]).searchParams.get("fields"), "name,language,status,category");
  });

  it("hata sınıfları (plan §6 W2) ve sınır basamağı / kalite metinleri", async () => {
    const { classifyMetaCode, tierInfo, qualityLabel, redact } = await load();
    for (const code of [0, 190, 10, 131005, 368, 131031, 131042, 133010, 131045, 132001, 132000, 132012, 132018, 132007, 132015, 132016, 131026, 131021, 131009]) assert.equal(classifyMetaCode(code).retry, "never", `kod ${code}`);
    for (const code of [131000, 131016, 130429, 80007, 4, 131057, 131056, 131049]) assert.equal(classifyMetaCode(code).retry, "later", `kod ${code}`);
    assert.equal(classifyMetaCode(250).kind, "permission", "200–299 izin");
    assert.equal(classifyMetaCode(987654).retry, "unknown");
    assert.deepEqual(tierInfo("TIER_250"), { tier: "TIER_250", limit: 250, label: "24 saatte 250 farklı kişi" });
    assert.equal(tierInfo("TIER_2K").limit, 2000);
    assert.equal(tierInfo("TIER_100K").label, "24 saatte 100.000 farklı kişi");
    assert.equal(tierInfo("TIER_UNLIMITED").label, "Sınırsız");
    assert.deepEqual(tierInfo("YENI_BICIM"), { tier: "YENI_BICIM", limit: null, label: "YENI_BICIM" }, "tanınmayan değer olduğu gibi");
    assert.equal(qualityLabel("GREEN"), "Yüksek");
    assert.equal(qualityLabel("RED"), "Düşük");
    assert.equal(qualityLabel("PURPLE"), "PURPLE");
    assert.equal(redact(`a ${TOKEN} b Bearer XYZ123`, TOKEN), "a *** b Bearer ***");
  });
});
