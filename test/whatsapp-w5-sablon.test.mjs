// 2.4.8 W5 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §1, §2.4, §6 W5, §8 "HESAP / META"): bilgilendirme şablonları — program YALNIZ iki UTILITY şablonu
// (destekofis_ekstre: BELGE başlığı + KVKK alt satırı; destekofis_odeme_hatirlatma) Meta'da kendisi açar, durumlarını / kategorisini / kalitesini okur,
// Meta UTILITY'yi MARKETING'e alırsa ekranda açık uyarı verir ve o şablonu "gönderime hazır" saymaz; kampanya şablonu açılmaz.
// Meta yerine YEREL sahte Graph sunucusu (test/whatsapp-sahte-graph.mjs; ders 30); saat sahte (ders 13). Beklenen metinler PLANDAN (§6 W5, §1) —
// programın sabitinden okunmaz (ders 5). Testler yalnız HTTP uçlarından gider (eski kodda 404 = davranış yok; ders 7, 38); meta-graph'ın yeni
// işlevi dinamik içe aktarmayla denenir.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

const TOKEN = "SAHTE-W5-belirtec-Gizli_9876543210-ZYXabc-sablon";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const NOW = { time: "2026-11-03T09:00:00+03:00", fixed: true };
const URL_CONN = "/api/workspace/whatsapp/connection";
const URL_TPL = "/api/workspace/whatsapp/templates";

// ---- PLANDAN (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W5, §1 ve §7a madde 23 / K3 — ekstre gövdesi; elle yazıldı) ----
const PLAN = {
  destekofis_ekstre: {
    body: "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.",
    footer: "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.",
    header: "DOCUMENT",
    params: 4,
  },
  destekofis_odeme_hatirlatma: {
    body: "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.",
    footer: null,
    header: null,
    params: 5,
  },
};
const part = (components, type) => (components || []).find(item => String(item.type).toUpperCase() === type);
const leaks = value => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return [TOKEN, TOKEN.slice(0, 12), TOKEN.slice(-12)].filter(item => text.includes(item));
};
const capture = () => {
  const lines = [];
  const write = level => (message, meta) => lines.push(`${level} ${message} ${meta instanceof Error ? meta.stack : JSON.stringify(meta ?? "")}`);
  return { lines, log: { debug: write("debug"), info: write("info"), warn: write("warn"), error: write("error") } };
};

describe("2.4.8 W5 — WhatsApp bilgilendirme şablonları", () => {
  let fake;
  let server;
  let admin;
  const logs = capture();
  const bodies = [];
  const call = async (method, url, body) => {
    const res = await admin[method](url, body);
    bodies.push(res.data);
    return res;
  };
  const posts = () => fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/message_templates"));
  const itemOf = (view, name) => view.items.find(item => item.name === name);
  before(async () => {
    fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
    server = await startTestServer({ now: NOW, whatsappGraphUrl: fake.url, whatsappTimeoutMs: 1500, log: logs.log });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
    await fake?.close();
  });
  const settingRow = () => server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.templates'")?.value ?? null;

  it("şablon metinleri plandakiyle birebir: yalnız 2 şablon, dil tr, UTILITY; ekstrede BELGE başlığı ve KVKK alt satırı (≤ 60 karakter)", async () => {
    const res = await call("get", URL_TPL);
    assert.equal(res.status, 200, `GET ${URL_TPL} → ${res.status}`);
    const defs = res.data.data.definitions;
    assert.deepEqual(defs.map(item => item.name).sort(), Object.keys(PLAN).sort(), "yalnız iki program şablonu");
    for (const def of defs) {
      const plan = PLAN[def.name];
      assert.equal(def.body, plan.body, `${def.name} gövdesi plandaki metin`);
      assert.equal(def.footer || null, plan.footer, `${def.name} alt satırı`);
      assert.equal(def.header || null, plan.header, `${def.name} başlığı`);
      assert.equal(def.category, "UTILITY", `${def.name} kategorisi UTILITY`);
      assert.equal(def.language, "tr");
      assert.doesNotMatch(def.body, /\{\{\d+\}\}\s*[.!?]?\s*$/, `${def.name} gövdesi değişkenle bitmez (Meta 2388299; plan §7a madde 23)`);
    }
    assert.ok(PLAN.destekofis_ekstre.footer.length <= 60, "Meta alt satır sınırı 60");
    assert.equal(res.data.data.configured, false);
    assert.ok(res.data.data.items.every(item => !item.usable), "bağlantı yokken hiçbiri gönderime hazır değil");
  });

  it("bağlantı yokken denetim 409, Meta'ya istek yok; yetkisiz kullanıcı GET / POST 403", async () => {
    const res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "whatsapp-not-configured");
    assert.equal(fake.requests.length, 0);
    const user = await createUser(server, admin, { username: "w5-personel", role: "personel" });
    assert.equal((await user.get(URL_TPL)).status, 403);
    assert.equal((await user.post(`${URL_TPL}/ensure`, {})).status, 403);
    assert.equal(fake.requests.length, 0, "yetkisiz istek Meta'ya gitmedi");
  });

  it("App ID yokken: Ödeme Hatırlatma açılır (UTILITY, plandaki gövde, örnek değerler); Ekstre açılmaz, nedeni Uygulama Kimliği; yükleme yok", async () => {
    assert.equal((await call("put", URL_CONN, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
    fake.requests.length = 0;
    const res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const sent = posts();
    assert.equal(sent.length, 1, "yalnız bir şablon açma isteği");
    const body = sent[0].body;
    assert.equal(body.name, "destekofis_odeme_hatirlatma");
    assert.equal(body.category, "UTILITY");
    assert.equal(body.language, "tr");
    assert.equal(part(body.components, "BODY").text, PLAN.destekofis_odeme_hatirlatma.body);
    assert.equal(part(body.components, "BODY").example.body_text[0].length, PLAN.destekofis_odeme_hatirlatma.params, "her değişkene örnek değer");
    assert.equal(part(body.components, "HEADER"), undefined);
    assert.equal(fake.requests.filter(item => item.path.includes("uploads") || item.path.startsWith("/upload:")).length, 0, "App ID yokken yükleme yok");
    const view = res.data.data;
    assert.equal(itemOf(view, "destekofis_odeme_hatirlatma").statusLabel, "Onay Bekliyor");
    assert.equal(itemOf(view, "destekofis_odeme_hatirlatma").usable, false, "onay bekleyen gönderime hazır değil");
    assert.equal(itemOf(view, "destekofis_ekstre").exists, false);
    const why = view.actions.find(action => action.name === "destekofis_ekstre");
    assert.ok(why && !why.ok && /Uygulama Kimliği \(App ID\)/.test(why.message) && /Bilgileri Değiştir ile/.test(why.message), `neden ve çözüm yolu: ${why?.message}`);
  });

  it("App ID girilince: örnek PDF Resumable Upload ile (OAuth başlığı, file_offset 0, %PDF), Ekstre BELGE başlığı + tanıtıcı + KVKK alt satırıyla açılır; ikinci denetim yeni şablon açmaz", async () => {
    assert.equal((await call("put", URL_CONN, { phoneNumberId: PNID, wabaId: WABA, appId: APP })).status, 200);
    fake.requests.length = 0;
    const res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const session = fake.requests.find(item => item.method === "POST" && item.path === `/${APP}/uploads`);
    assert.ok(session, "yükleme oturumu açıldı");
    assert.equal(session.query.file_type, "application/pdf");
    const upload = fake.requests.find(item => item.method === "POST" && item.path.startsWith("/upload:"));
    assert.ok(upload, "dosya yüklendi");
    assert.equal(upload.auth, `OAuth ${TOKEN}`, "yükleme adımı OAuth başlığıyla, belirteç bozulmadan");
    assert.equal(upload.headers.file_offset, "0");
    assert.equal(upload.bytes.subarray(0, 5).toString("latin1"), "%PDF-", "yüklenen dosya PDF");
    assert.equal(Number(session.query.file_length), upload.bytes.length, "bildirilen uzunluk = yüklenen bayt");
    assert.ok(!session.query.access_token, "belirteç adres satırında değil");
    const sent = posts();
    assert.equal(sent.length, 1, "yalnız eksik olan (Ekstre) açıldı");
    const body = sent[0].body;
    assert.equal(body.name, "destekofis_ekstre");
    assert.equal(body.category, "UTILITY");
    assert.equal(part(body.components, "HEADER").format, "DOCUMENT");
    assert.ok(fake.state.handles.has(part(body.components, "HEADER").example.header_handle[0]), "başlık örneği yüklemenin tanıtıcısı");
    assert.equal(part(body.components, "BODY").text, PLAN.destekofis_ekstre.body);
    assert.equal(part(body.components, "BODY").example.body_text[0].length, PLAN.destekofis_ekstre.params);
    assert.equal(part(body.components, "FOOTER")?.text, PLAN.destekofis_ekstre.footer, "KVKK alt satırı");
    assert.equal(itemOf(res.data.data, "destekofis_ekstre").statusLabel, "Onay Bekliyor");
    fake.requests.length = 0;
    const again = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(again.status, 200);
    assert.equal(posts().length, 0, "ikinci denetimde şablon açılmadı");
    assert.equal(fake.requests.filter(item => item.method === "POST").length, 0, "ikinci denetimde yükleme de yok");
  });

  it("durumlar: APPROVED + UTILITY gönderime hazır; Meta MARKETING'e aldıysa açık uyarı ve gönderime hazır DEĞİL; REJECTED (neden), PAUSED, DISABLED, kalite RED, içeriği değiştirilmiş", async () => {
    const set = (name, patch) => Object.assign(fake.state.templates.find(item => item.name === name && item.language === "tr"), patch);
    set("destekofis_odeme_hatirlatma", { status: "APPROVED", category: "UTILITY", quality_score: { score: "GREEN", date: 1 } });
    set("destekofis_ekstre", { status: "APPROVED", category: "MARKETING" });
    let view = (await call("post", `${URL_TPL}/ensure`, {})).data.data;
    let reminder = itemOf(view, "destekofis_odeme_hatirlatma");
    let statement = itemOf(view, "destekofis_ekstre");
    assert.equal(reminder.statusLabel, "Onaylandı");
    assert.equal(reminder.usable, true, "onaylı bilgilendirme şablonu gönderime hazır");
    assert.equal(view.usable.reminder, true);
    assert.equal(statement.statusLabel, "Onaylandı");
    assert.equal(statement.categoryLabel, "Pazarlama (Marketing)");
    assert.equal(statement.usable, false, "Pazarlama'ya alınan şablon gönderime hazır DEĞİL");
    assert.equal(view.usable.statement, false);
    assert.ok(statement.warnings.some(text => /Pazarlama/.test(text) && /gönderim YAPMAZ/.test(text)), `uyarı: ${statement.warnings.join(" | ")}`);
    assert.equal(posts().length, 0, "kategori değişince yeniden şablon açılmaz");

    set("destekofis_ekstre", { status: "REJECTED", category: "UTILITY", rejected_reason: "INCORRECT_CATEGORY" });
    set("destekofis_odeme_hatirlatma", { status: "PAUSED" });
    view = (await call("post", `${URL_TPL}/ensure`, {})).data.data;
    statement = itemOf(view, "destekofis_ekstre");
    reminder = itemOf(view, "destekofis_odeme_hatirlatma");
    assert.equal(statement.statusLabel, "Reddedildi");
    assert.ok(statement.warnings.some(text => /reddetti \(kategori uygun bulunmadı\)/.test(text)), statement.warnings.join(" | "));
    assert.equal(reminder.statusLabel, "Duraklatıldı");
    assert.equal(reminder.usable, false);

    set("destekofis_odeme_hatirlatma", { status: "DISABLED" });
    set("destekofis_ekstre", { status: "APPROVED", category: "UTILITY", rejected_reason: "NONE", quality_score: { score: "RED", date: 2 } });
    view = (await call("post", `${URL_TPL}/ensure`, {})).data.data;
    assert.equal(itemOf(view, "destekofis_odeme_hatirlatma").statusLabel, "Kapatıldı");
    statement = itemOf(view, "destekofis_ekstre");
    assert.equal(statement.qualityLabel, "Düşük");
    assert.equal(statement.usable, true, "kalite düşük ama onaylı utility: gönderilebilir (Meta: RED gönderilebilir)");
    assert.ok(statement.warnings.some(text => /kalitesi düşük/.test(text)));

    // Müşteri WhatsApp Yöneticisi'nde metni değiştirdi → program göndermez.
    const original = fake.state.templates.find(item => item.name === "destekofis_ekstre" && item.language === "tr");
    const saved = original.components;
    original.components = saved.map(item => (String(item.type).toUpperCase() === "BODY" ? { ...item, text: `${item.text} Kampanyamızdan yararlanın!` } : item));
    view = (await call("post", `${URL_TPL}/ensure`, {})).data.data;
    statement = itemOf(view, "destekofis_ekstre");
    assert.equal(statement.contentMatches, false);
    assert.equal(statement.usable, false, "içeriği değiştirilmiş şablon gönderime hazır değil");
    original.components = saved;
    Object.assign(original, { quality_score: { score: "GREEN", date: 3 } });
  });

  it("GET görünümü Meta'ya gitmez ve son denetimi gösterir; başka WABA'ya geçince eski sonuç bayat sayılır (Denetlenmedi)", async () => {
    await call("post", `${URL_TPL}/ensure`, {});
    fake.requests.length = 0;
    const res = await call("get", URL_TPL);
    assert.equal(fake.requests.length, 0, "GET Meta'ya istek yapmaz");
    assert.ok(res.data.data.checkedAt, "son denetim zamanı");
    assert.equal(itemOf(res.data.data, "destekofis_ekstre").statusLabel, "Onaylandı");
    assert.equal((await call("put", URL_CONN, { phoneNumberId: PNID, wabaId: "102290129340399", appId: APP })).status, 200);
    const stale = (await call("get", URL_TPL)).data.data;
    assert.equal(stale.checkedAt, null);
    assert.ok(stale.items.every(item => item.statusLabel === "Denetlenmedi" && !item.usable), "başka hesabın sonucu gösterilmez");
    assert.equal((await call("put", URL_CONN, { phoneNumberId: PNID, wabaId: WABA, appId: APP })).status, 200);
  });

  it("Meta ayrıntı alanlarını tanımazsa (100) temel alanlarla bir kez yeniden okunur; listede görünmeyen şablon için 2388024 'zaten var' sayılır", async () => {
    fake.state.rejectDetailFields = true;
    fake.requests.length = 0;
    let res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const gets = fake.requests.filter(item => item.method === "GET" && item.path.endsWith("/message_templates"));
    assert.equal(gets.length, 2, "önce ayrıntılı, sonra temel alanlar");
    assert.ok(/quality_score/.test(gets[0].query.fields) && !/quality_score/.test(gets[1].query.fields));
    assert.equal(itemOf(res.data.data, "destekofis_odeme_hatirlatma").statusLabel, "Kapatıldı");
    fake.state.rejectDetailFields = false;

    fake.state.hideFromList = true;
    fake.requests.length = 0;
    res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(posts().length, 2, "listede yok → açılmaya çalışıldı");
    assert.ok(res.data.data.actions.every(action => action.ok && /zaten var/.test(action.message)), JSON.stringify(res.data.data.actions));
    assert.equal(fake.state.templates.filter(item => item.name.startsWith("destekofis_")).length, 2, "çift şablon açılmadı");
    fake.state.hideFromList = false;
  });

  it("Meta belirteci reddederse 502 + Türkçe neden, son hata kaydedilir; yanıtta / kayıtta / işlem geçmişinde / günlükte belirteç yok", async () => {
    fake.state.echoToken = true;
    fake.state.token = "BASKA-BELIRTEC";
    const res = await call("post", `${URL_TPL}/ensure`, {});
    assert.equal(res.status, 502);
    assert.equal(res.data.code, "whatsapp-meta");
    assert.match(res.data.error, /süresi dolmuş/);
    const view = (await call("get", URL_TPL)).data.data;
    assert.ok(view.lastError && /süresi dolmuş/.test(view.lastError.message), "son hata görünür");
    fake.state.token = TOKEN;
    fake.state.echoToken = false;
    const audits = server.app.store.all("SELECT payload_json AS payload FROM audit_events WHERE type LIKE 'whatsapp.templates.%'");
    assert.ok(audits.length >= 5, `işlem geçmişi kayıtları (${audits.length})`);
    assert.deepEqual(leaks(bodies), [], "API yanıtlarında belirteç yok");
    assert.deepEqual(leaks(settingRow()), [], "şablon kaydında belirteç yok");
    assert.deepEqual(leaks(audits), [], "işlem geçmişinde belirteç yok");
    assert.deepEqual(leaks(logs.lines.join("\n")), [], "günlükte belirteç yok");
  });

  it("Meta istemcisi kampanya / pazarlama şablonu açmaz: kategori UTILITY değilse istek gönderilmez", async () => {
    const graph = await import(new URL("../server/lib/whatsapp/meta-graph.mjs", import.meta.url).href);
    assert.equal(typeof graph.createMetaTemplates, "function", "meta-graph.mjs createMetaTemplates dışa açık");
    const api = graph.createMetaTemplates({ baseUrl: fake.url, openToken: () => TOKEN, timeoutMs: 1500 });
    fake.requests.length = 0;
    for (const category of ["MARKETING", "AUTHENTICATION", "utility", ""]) {
      await assert.rejects(api.createTemplate(WABA, { name: "kampanya_ekim", language: "tr", category, components: [{ type: "BODY", text: "İndirim!" }] }), /yalnız bilgilendirme/);
    }
    assert.equal(fake.requests.length, 0, "Meta'ya istek gitmedi");
    assert.ok(!fake.state.templates.some(item => item.name === "kampanya_ekim"));
  });

  it("salt okunur lisans: görünüm okunur, denetim 403 LICENSE_READ_ONLY, Meta'ya istek yok", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w5-saltokunur-"));
    const local = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
    try {
      const first = await startTestServer({ dataDir, now: NOW, whatsappGraphUrl: local.url });
      try {
        const api = await loginAdmin(first);
        assert.equal((await api.put(URL_CONN, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      } finally {
        await first.close();
      }
      const ro = await startTestServer({ dataDir, now: NOW, whatsappGraphUrl: local.url, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        const api = await loginAdmin(ro);
        local.requests.length = 0;
        const view = await api.get(URL_TPL);
        assert.equal(view.status, 200);
        assert.equal(view.data.data.writable, false);
        const res = await api.post(`${URL_TPL}/ensure`, {});
        assert.equal(res.status, 403);
        assert.equal(res.data.code, "LICENSE_READ_ONLY");
        assert.equal(local.requests.length, 0);
      } finally {
        await ro.close();
      }
    } finally {
      await local.close();
      removeTestDir(dataDir);
    }
  });
});
