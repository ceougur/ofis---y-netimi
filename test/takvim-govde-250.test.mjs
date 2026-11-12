// 2.5.0 Ç5-B KAPANIŞ DÜZELTME TURU — HIZ (iş listesi D "5 DK YETKİSİYLE UYGULANDI … S132": zilin / takvimin ILIK çağrısı ve Borç Yaz, Ç5-B öncesi kodun %10'u içinde).
// EŞDEĞERLİK (ders 47): hız düzeltmesi YANITI DEĞİŞTİRMEZ — burada bayt bayt.
//   (1) Takvim yanıtının gövdesi (GET /api/workspace/dues), hesabın sonucu değişmediği sürece kişinin görebildiği kalem türleri başına BİR KEZ JSON'a çevrilir
//       (routes/dues.mjs bodyOf; önceden her ılık çağrıda yeniden — 100 bin satırlık veride ~21 MB, çağrı başına ~130 ms + çöp toplama). Baytlar aynı nesnenin
//       JSON.stringify çıktısı; her veri değişikliğinde gövde yenilenir (bayat yanıt yok); yetkisi dar kişi başkasının gövdesini almaz.
//   (2) Tek carinin kuyruğunda çek / senet bağlarının anı carinin KENDİ evrak satırlarından sürülen sorguyla okunur (routes/invoices.mjs chequeLinkMoments; önceden bütün
//       ilk olaylar taranıyordu — Borç Yaz başına ~16 ms). Hakem önceki sorgu: carinin her defter satırı için aynı an. Kilit davranışı test/tyk-tur2b1-250.test.mjs'te.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as http from "../server/lib/http.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("http.sendBody ≡ http.send (başlıklar ve baytlar)", () => {
  const fake = () => {
    const out = { head: null, body: null, headersSent: false };
    out.writeHead = (status, headers) => { out.head = { status, headers }; out.headersSent = true; };
    out.end = body => { out.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8"); };
    return out;
  };
  const payload = { ok: true, data: { items: [{ id: "a|1", person: "Çağrı Öztürk İşık", amount: 1234.56, note: "₺ \"tırnak\" \n satır" }], version: "v.1111", today: TODAY } };
  it("aynı nesnenin JSON metni Buffer olarak verilince durum, başlıklar ve gövde baytları send ile aynı", () => {
    const a = fake();
    const b = fake();
    assert.equal(typeof http.sendBody, "function", "hazır gövde gönderen yardımcı var");
    http.send(a, 200, payload, { "x-deneme": "1" });
    http.sendBody(b, 200, Buffer.from(JSON.stringify(payload), "utf8"), { "x-deneme": "1" });
    assert.deepEqual(b.head, a.head);
    assert.ok(a.body.equals(b.body));
    assert.equal(a.head.headers["content-type"], "application/json; charset=utf-8");
    assert.equal(a.head.headers["cache-control"], "no-store");
  });
  it("başlıklar gönderilmişse ikisi de dokunmaz", () => {
    const a = fake();
    a.headersSent = true;
    http.sendBody(a, 200, "{}");
    http.send(a, 200, {});
    assert.equal(a.head, null);
    assert.equal(a.body, null);
  });
});

describe("Takvim / zil yanıtının gövdesi: ılık çağrıda yeniden üretilmez, baytlar aynı, bayatlamaz, yetkiyi aşmaz (gerçek program)", () => {
  let server;
  let admin;
  let api;
  let acc;
  // Sunucu bu süreçte çalışır: takvim yanıtının JSON'a çevrilişi sayılır (gövdesi { ok: true, data: { items: [...], deadlines: [...] } } olan çağrılar).
  const realStringify = JSON.stringify;
  let built = 0;
  const must = async (label, promise) => {
    const res = unwrap(await promise);
    assert.equal(res.status, 200, `${label}: ${res.status} ${realStringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const dues = async (client = admin, query = "") => {
    const res = await client.raw("GET", `/api/workspace/dues${query}`);
    assert.equal(res.status, 200);
    return res;
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    api = { get: url => admin.get(url), post: (url, body) => admin.post(url, body), patch: (url, body) => admin.patch(url, body) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    acc = await must("cari", api.post("/api/workspace/accounts", { name: "Gövde Müşterisi Çağrı", type: "customer", registeredOn: day(-400), phone: "0500 257 10 01" }));
    await must("vadeli borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "400", date: day(-30), dueDate: day(-5), note: "vadeli", similarOk: true }));
    const item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-GOVDE", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-20), lines: [{ itemId: item.id, qty: 1, unitPrice: "600", vatRate: 0 }], payment: { rest: "open", dueDate: day(-3) }, cashForce: true }));
    JSON.stringify = function counted(value, ...rest) {
      if (value && value.ok === true && Array.isArray(value.data?.items) && Array.isArray(value.data?.deadlines)) built += 1;
      return realStringify.call(JSON, value, ...rest);
    };
  });
  after(async () => {
    JSON.stringify = realStringify;
    await server?.close();
  });

  it("ilk çağrı gövdeyi üretir; ILIK çağrılar yeniden ÜRETMEZ ve baytlar birebir aynıdır; gövde düz JSON'dur (ok + data; kalemler, sürüm)", async () => {
    built = 0;
    const first = await dues();
    assert.equal(built, 1, "ilk çağrıda gövde bir kez üretildi");
    const second = await dues();
    const third = await dues();
    assert.equal(built, 1, "ılık çağrılarda gövde yeniden üretilmedi (hız düzeltmesinin dişi — önceki kodda her çağrıda üretilir)");
    assert.ok(first.buffer.equals(second.buffer) && second.buffer.equals(third.buffer), "ılık yanıtın baytları ilk yanıtla aynı");
    assert.equal(first.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(first.headers.get("cache-control"), "no-store");
    const text = first.buffer.toString("utf8");
    assert.equal(realStringify(JSON.parse(text)), text, "gövde, nesnesinin JSON.stringify çıktısıdır (önceki yolun ürettiğiyle aynı metin)");
    const data = first.data.data;
    assert.equal(first.data.ok, true);
    assert.deepEqual(Object.keys(data), ["items", "deadlines", "sources", "dormant", "notes", "today", "generatedAt", "version"], "alanlar ve sırası önceki yanıtla aynı");
    assert.deepEqual(data.items.map(item => `${item.source}:${item.amount}`).sort(), ["account:400", "invoice:600"]);
    assert.match(data.version, /\.1111$/, "yönetici dört kalem türünü de görür");
  });

  it("ekranın gerçek çağrısı (since = elindeki sürüm): içerik aynıysa büyük gövde gönderilmez — davranış aynen", async () => {
    const version = (await dues()).data.data.version;
    built = 0;
    const res = await dues(admin, `?since=${encodeURIComponent(version)}`);
    assert.deepEqual(res.data, { ok: true, data: { unchanged: true, version, today: TODAY } });
    assert.equal(built, 0);
    const stale = await dues(admin, "?since=baska-surum");
    assert.equal(stale.data.data.version, version, "sürümü tutmayan ekran tam yanıtı alır");
    assert.equal(stale.data.data.items.length, 2);
  });

  it("veri değişince gövde YENİLENİR (bayat yanıt yok): yeni vadeli borç hemen yanıtta, sürüm değişir; tahsilatla kalem tutarı düşer", async () => {
    const before = await dues();
    await must("yeni borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "150", date: day(-10), dueDate: day(-2), note: "yeni", similarOk: true }));
    built = 0;
    const afterDebt = await dues();
    assert.equal(built, 1, "değişen içerik için gövde bir kez yeniden üretildi");
    assert.notEqual(afterDebt.data.data.version, before.data.data.version);
    assert.deepEqual(afterDebt.data.data.items.map(item => `${item.source}:${item.amount}`).sort(), ["account:150", "account:400", "invoice:600"]);
    assert.ok((await dues()).buffer.equals(afterDebt.buffer));
    assert.equal(built, 1);
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "100", date: day(-1), method: "cash", cashForce: true, similarOk: true }));
    const afterPay = await dues();
    const sum = afterPay.data.data.items.reduce((total, item) => total + item.amount, 0);
    assert.equal(sum, 1050, "kalemlerin toplamı = bakiye (1.150 − 100)");
    assert.equal((await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance, 1050);
  });

  it("yetkisi dar kişi başkasının gövdesini ALMAZ: Fatura görme yetkisi kaldırılan kişinin yanıtında fatura kalemi yok; yöneticinin yanıtı aynı kalır", async () => {
    const created = await must("muhasebe", api.post("/api/admin/users", { username: "govde-personel", name: "Gövde Muhasebe", role: "muhasebe", password: "Govde-Personel-2026!", mustChangePassword: false }));
    const staff = server.client();
    assert.equal((await staff.login("govde-personel", "Govde-Personel-2026!")).status, 200);
    const adminBefore = await dues();
    const full = await dues(staff);
    const flags = full.data.data.version.split(".").at(-1);
    assert.equal(flags[1], "1", "ön koşul: muhasebe rolü faturaları görebiliyor");
    assert.ok(full.data.data.items.some(item => item.source === "invoice"));
    await must("yetki kaldır", api.patch(`/api/admin/users/${created.id}`, { grants: { add: [], remove: ["invoices.view"] } }));
    built = 0;
    const narrow = await dues(staff);
    assert.equal(narrow.data.data.version.split(".").at(-1)[1], "0", "sürüm, kişinin görebildiği kalem türlerini taşır");
    assert.ok(!narrow.data.data.items.some(item => item.source === "invoice"), "fatura kalemi dar yetkili kişiye gitmez (yöneticinin gövdesi bellekte olsa da)");
    assert.ok(narrow.data.data.items.some(item => item.source === "account"), "cari kalemleri durur");
    assert.equal(built, 1, "dar görünürlük için ayrı gövde bir kez üretildi");
    assert.ok((await dues(staff)).buffer.equals(narrow.buffer));
    assert.equal(built, 1);
    const adminAfter = await dues();
    assert.ok(adminAfter.buffer.equals(adminBefore.buffer), "yöneticinin yanıtı değişmedi (fatura kalemi duruyor)");
    assert.ok(adminAfter.data.data.items.some(item => item.source === "invoice"));
  });

  it("saklanandan (3) çok görünürlük çeşidi istenirse de her biri KENDİ gövdesini alır (bellek sınırı yanlış gövde verdirmez)", async () => {
    const reference = new Map();
    const staffs = [];
    const removals = [["invoices.view"], ["invoices.view", "accounts.view"], ["accounts.view"], []];
    for (const [index, remove] of removals.entries()) {
      const created = await must("personel", api.post("/api/admin/users", { username: `govde-p${index}`, name: `Gövde P${index}`, role: "muhasebe", password: "Govde-Personel-2026!", mustChangePassword: false }));
      if (remove.length) await must("yetki kaldır", api.patch(`/api/admin/users/${created.id}`, { grants: { add: [], remove } }));
      const client = server.client();
      assert.equal((await client.login(`govde-p${index}`, "Govde-Personel-2026!")).status, 200);
      staffs.push({ client, remove });
    }
    for (let round = 0; round < 3; round += 1) {
      for (const [index, staff] of staffs.entries()) {
        const res = await dues(staff.client);
        const sources = new Set(res.data.data.items.map(item => item.source));
        assert.equal(sources.has("invoice"), !staff.remove.includes("invoices.view"), `tur ${round} kişi ${index}: fatura kalemi yetkiye göre`);
        assert.equal(sources.has("account"), !staff.remove.includes("accounts.view"), `tur ${round} kişi ${index}: cari kalemi yetkiye göre`);
        if (reference.has(index)) assert.ok(res.buffer.equals(reference.get(index)), `tur ${round} kişi ${index}: aynı kişi aynı baytları alır`);
        reference.set(index, res.buffer);
      }
    }
  });
});

describe("Tek carinin kuyruğunda çek / senet bağlarının anı: carinin KENDİ evrak satırlarından sürülen sorgu ≡ önceki sorgu (kilit açık; gerçek program)", () => {
  let server;
  let admin;
  const sqlSeen = [];
  let restore = null;
  let store;
  const must = async (label, promise) => {
    const res = unwrap(await promise);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  // HAKEM: düzeltmeden önceki tek cari sorgusu (routes/invoices.mjs chequeLinkMoments, 8d6ea9c9) — bütün ilk olaylar taranıp cariye süzülür.
  const OLD_SQL = `SELECT ev.effects_json AS effects, ev.created_at AS created,
           (SELECT MAX(a.created_at) FROM audit_events a WHERE a.entity_id = ev.cheque_id AND a.type = 'cheque.updated' AND json_extract(a.payload_json, '$.invoiceId') IS NOT NULL) AS changed
         FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id
         WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ? OR c.endorse_account_id = ? OR ev.account_id = ?)`;
  const mapOf = rows => {
    const out = new Map();
    for (const row of rows) {
      const at = String(row.changed || "") > String(row.created || "") ? String(row.changed) : String(row.created || "");
      if (!at) continue;
      const effects = JSON.parse(row.effects || "[]");
      for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) out.set(effect.id, at);
    }
    return out;
  };
  const isMoments = sql => /cheque\.updated/.test(sql) && /cheque_events ev/.test(sql);
  before(async () => {
    // Akan saat: bağı değiştiren düzeltmenin anı kaydın anından SONRA olsun (gerçek kurulum).
    let at = Date.parse(NOW);
    server = await startTestServer({ now: () => (at += 1000), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
    store = server.app.store;
    const original = store.all.bind(store);
    store.all = (sql, ...args) => {
      const rows = original(sql, ...args);
      if (isMoments(String(sql))) sqlSeen.push({ sql: String(sql), args, rows });
      return rows;
    };
    restore = () => { store.all = original; };
  });
  after(async () => {
    restore?.();
    await server?.close();
  });

  it("evrakı faturaya bağlı (düzeltmeyle bağı değişmiş, ciro edilmiş, bağsız) cariler: programın tek cari sorgusu, carinin HER defter satırı için önceki sorguyla aynı anı verir", async () => {
    const item = await must("hizmet", admin.post("/api/workspace/stock", { kind: "service", code: "HZM-AN", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    const account = (name, type = "customer", n = 1) => must("cari", admin.post("/api/workspace/accounts", { name, type, registeredOn: day(-400), phone: `0500 257 30 ${String(n).padStart(2, "0")}` }));
    const sale = (acc, date, amount) => must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: date }, cashForce: true })).then(doc => doc.id);
    const cheque = body => must("çek", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", issueDate: day(-30), dueDate: day(40), ...body }));
    const a = await account("An Bağlı", "customer", 1); // iki fatura; çek F2'ye bağlı, sonra düzeltmeyle F1'e
    const b = await account("An Ciro Alan", "supplier", 2); // a'nın bağlı çeki buna ciro edilir
    const c = await account("An Bağsız Çekli", "customer", 3); // bağsız çek
    const d = await account("An Çeksiz", "customer", 4); // hiç evrak yok
    const e = await account("An İki Çekli", "customer", 5); // iki bağlı çek; birinin tutarı düzeltilir (satırlar yeniden yazılır)
    const f1 = await sale(a, day(-50), 300);
    const f2 = await sale(a, day(-45), 300);
    const ch1 = await cheque({ amount: "300", serialNo: "AN-1", accountId: a.id, invoiceId: f2 });
    await must("çek bağı F1'e", admin.put(`/api/workspace/cheques/${ch1.id}`, { invoiceId: f1 }));
    const ch2 = await cheque({ amount: "200", serialNo: "AN-2", accountId: a.id, invoiceId: f2 });
    await must("ciro", admin.post(`/api/workspace/cheques/${ch2.id}/actions`, { action: "endorse", date: day(-6), accountId: b.id }));
    await cheque({ amount: "150", serialNo: "AN-3", accountId: c.id });
    await must("borç", admin.post(`/api/workspace/accounts/${d.id}/entries`, { kind: "debt", amount: "100", date: day(-20), note: "d", similarOk: true }));
    const e1 = await sale(e, day(-40), 500);
    const e2 = await sale(e, day(-35), 400);
    await cheque({ amount: "500", serialNo: "AN-4", accountId: e.id, invoiceId: e1 });
    const ch5 = await cheque({ amount: "400", serialNo: "AN-5", accountId: e.id, invoiceId: e2 });
    await must("çek tutarı düzelt (satırlar yeniden yazılır; bağ aynı)", admin.put(`/api/workspace/cheques/${ch5.id}`, { amount: "350" }));
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: day(-90) }));
    let asked = 0;
    let known = 0;
    for (const acc of [a, b, c, d, e]) {
      sqlSeen.length = 0;
      // Tek carinin kuyruğunu kurduran yazım: Borç Yaz (yanıt cari kartını döndürür).
      await must("Borç Yaz", admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "10", date: day(-1), note: "an", similarOk: true }));
      const mine = sqlSeen.filter(row => row.args.includes(acc.id));
      assert.ok(mine.length >= 1, `${acc.name}: kilit açıkken tek carinin kuyruğu evrak bağı anlarını okudu`);
      const got = mapOf(mine.at(-1).rows);
      const want = mapOf(store.all(OLD_SQL, acc.id, acc.id, acc.id));
      for (const line of store.all("SELECT id FROM account_entries WHERE account_id = ?", acc.id)) {
        asked += 1;
        if (want.has(line.id)) known += 1;
        assert.equal(got.get(line.id), want.get(line.id), `${acc.name}: defter satırı ${line.id} için bağın anı önceki sorguyla aynı`);
      }
    }
    assert.ok(asked >= 12 && known >= 4, `ön koşul: sorulan defter satırı ${asked}, haritada olan ${known} (bağlı evrak satırları gerçekten sınandı)`);
    // Düzeltmeyle değişen bağın anı kaydın anından sonradır (iz okunuyor) — yeni sorgu bunu da taşır.
    const rowA = store.get("SELECT id, created_at AS at FROM account_entries WHERE account_id = ? AND source = 'cheque' AND source_id = ?", a.id, ch1.id);
    sqlSeen.length = 0;
    await must("Borç Yaz", admin.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "5", date: day(-1), note: "an2", similarOk: true }));
    const moment = mapOf(sqlSeen.filter(row => row.args.includes(a.id)).at(-1).rows).get(rowA.id);
    assert.ok(moment > rowA.at, `bağı düzeltmeyle değişen çekin anı (${moment}) satırın kayıt anından (${rowA.at}) sonra`);
    // Tek cari sorgusu artık bütün ilk olayları taramaz: carinin evrak satırı yoksa (d) hiç olay satırı dönmez; sorgu carinin kendi evraklarından sürülür.
    assert.match(sqlSeen.at(-1).sql, /FROM \(SELECT DISTINCT source_id AS id FROM account_entries WHERE account_id = \?1 AND \+source = 'cheque'\) own/, "tek cari sorgusu carinin kendi evrak satırlarından sürülüyor (hız düzeltmesinin dişi)");
  });
});
