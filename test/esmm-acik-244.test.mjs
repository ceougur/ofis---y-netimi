// 2.4.4 iş listesi 24 (AÇMA) — e-SMM üretimde açılır (server/server.mjs esmmEnabled; test/edoc-uretim.test.mjs). Bu dosya açmanın e-SMM KULLANICISI OLMAYAN
// firmada hiçbir şeyi değiştirmediğini gösterir: aynı senaryo iki sunucuda — bayrak KAPALI (2.4.1–2.4.3 üretimi) ve AÇIK (2.4.4 üretimi), firma "e-SMM
// kullanıcısıyım" işaretsiz — koşulur; belgeler, numaralar, Gönderilecekler, kart düğmeleri, EDM'ye giden istekler ve muhasebe kayıtları karşılaştırılır.
// Beklenen farklar AÇIKÇA listelenir (başka fark = hata): Entegratör Ayarları'nda e-SMM işareti görünür (esmmAvailable), Otomatik Seriler'de e-SMM satırı
// (nextNumbers.esmm, testNumbers.esmm), /meta'da serbest meslek makbuzu türü "gönderilebilir" (send; istemci kâğıt profilde gönderim düğmesi çizmez —
// hof-invoices.js sendable; ekrandan test/e2e/gg244-esmm-gonder.mjs adım 0).
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   A1 bayrak açılınca işaretsiz firmanın makbuzu ESMM profili / TES numarası alır (seri karışır)
//   A2 kâğıt makbuz Gönderilecekler'e düşer, kartında Gönder / Durum Sorgula / Resmî Görüntü çıkar, toplu XML'e girer
//   A3 e-Arşiv / e-Fatura e-SMM servisine gider ya da numarası / profili değişir
//   A4 "Kes, Sonra Gönder" ile kâğıt makbuz numarasız bekler (kâğıt belge her zaman kayıtta numara alır)
//   A5 açık kurulumda işaretlenip kaldırılan firmada makbuz kâğıda dönmez
//   A6 kâğıt makbuzun yevmiye / cari kaydı değişir (para çekirdeği türe bağlı; profil yalnız seri ve gönderimi belirler)
// Kâhin: bayrağı kapalı sunucunun AYNI senaryodaki çıktısı (fark testi; 2.4.3 üretim davranışı) — beklenen sayı elle yazılmaz.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Danışmanlık Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const NOW = "2026-06-17T10:00:00";

async function boot(esmmEnabled) {
  resetEdmCaches();
  const edm = await startMockEdm();
  const server = await startTestServer({ edocEnabled: true, ...(esmmEnabled ? { esmmEnabled: true } : {}), now: { time: NOW, fixed: true }, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), raw: client.raw };
  return { edm, server, api, close: async () => { await server.close(); await edm.close(); } };
}

// Aynı senaryo: firma ayarları (e-SMM işaretsiz) → cariler → kâğıt makbuz (Kaydet / "Kes, Sonra Gönder" isteği) → e-Arşiv ve e-Fatura (Kaydet ve Gönder) →
// bekleyen e-Arşiv → Tümünü Gönder → durum → makbuz iptali. Her adımın yanıtı ve veri tabanı satırları toplanır.
async function scenario(ctx) {
  const { api, server, edm } = ctx;
  const out = {};
  const settings = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  assert.equal(settings.status, 200, JSON.stringify(settings.data));
  out.settings = settings.data;
  const account = async body => {
    const created = await api.post("/api/workspace/accounts", body);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    return created.data.id || created.data.account?.id;
  };
  const client = await account({ name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" });
  const person = await account({ name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const buyer = await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  const smmLines = [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }, { name: "Yol Gideri", qty: 2, unitPrice: 100.03, vatRate: 20 }];
  out.calc = (await api.post("/api/workspace/invoices/calc", { scenario: "smm", accountId: client, lines: smmLines, payment: { rest: "open" } })).data;
  const smmNow = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: client, lines: smmLines, payment: { cash: [{ amount: 500, method: "cash" }], rest: "open" } });
  assert.equal(smmNow.status, 200, JSON.stringify(smmNow.data));
  const smmLater = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: client, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 750, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
  assert.equal(smmLater.status, 200, JSON.stringify(smmLater.data));
  const archive = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
  assert.equal(archive.status, 200, JSON.stringify(archive.data));
  const efatura = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 800, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
  assert.equal(efatura.status, 200, JSON.stringify(efatura.data));
  const waiting = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
  assert.equal(waiting.status, 200, JSON.stringify(waiting.data));
  out.pendingBefore = (await api.get("/api/workspace/invoices?tab=pending")).data.invoices.map(item => item.number || item.displayNo);
  const turn = await api.post("/api/workspace/invoices/send-pending", { all: true });
  assert.equal(turn.status, 200, JSON.stringify(turn.data));
  out.turn = { sent: turn.data.sent, failed: turn.data.failed, remaining: turn.data.remaining, results: turn.data.results.map(item => ({ ok: item.ok, code: item.code || "", number: item.number || "" })) };
  out.pendingAfter = (await api.get("/api/workspace/invoices?tab=pending")).data.invoices.map(item => item.number || item.displayNo);
  for (const doc of [archive.data, efatura.data, waiting.data]) {
    const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
  }
  // Kâğıt makbuzun e-Belge uçları: Durum Sorgula / Gönder / Resmî Görüntü reddedilir (kâğıt belge).
  out.paperEnds = {
    refresh: (await api.post(`/api/workspace/invoices/${smmNow.data.id}/e-refresh`, {})).data?.code || "",
    send: (await api.post(`/api/workspace/invoices/${smmNow.data.id}/send`, {})).status,
    official: (await api.raw("GET", `/api/workspace/invoices/${smmNow.data.id}/resmi.pdf`)).status,
  };
  const cancelled = await api.post(`/api/workspace/invoices/${smmLater.data.id}/cancel`, { reason: "Müvekkil vazgeçti" });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  const ids = [smmNow.data.id, smmLater.data.id, archive.data.id, efatura.data.id, waiting.data.id];
  const pick = doc => ({ kind: doc.kind, status: doc.status, number: doc.number, profile: doc.profile, typeCode: doc.typeCode, eStatus: doc.eStatus, eTest: doc.eTest, eUnsent: doc.eUnsent, netTotal: doc.netTotal, stoppageTotal: doc.stoppageTotal, vatTotal: doc.vatTotal, payableTotal: doc.payableTotal, canSend: doc.canSend, canDraft: doc.canDraft, canRefresh: doc.canRefresh, canOfficial: doc.canOfficial, canWithdraw: doc.canWithdraw, open: doc.open, paid: doc.paid });
  out.cards = [];
  for (const id of ids) out.cards.push(pick((await api.get(`/api/workspace/invoices/${id}`)).data));
  // Para çekirdeği: belgelerin yevmiye satırları ve cari hareketleri (kimlik ve zaman damgası atılır).
  const store = server.app.store;
  out.ledger = store.all(`SELECT i.number, i.gl_json AS gl FROM invoices i WHERE i.id IN (${ids.map(() => "?").join(", ")}) ORDER BY i.rowid`, ...ids).map(row => ({ number: row.number, gl: JSON.parse(row.gl || "null") }));
  out.accountRows = store.all("SELECT a.name, e.kind, e.amount, e.date, e.source FROM account_entries e JOIN accounts a ON a.id = e.account_id ORDER BY e.rowid").map(row => ({ ...row }));
  out.cash = store.all("SELECT kind, amount, date, method, description FROM cash_entries ORDER BY rowid").map(row => ({ ...row }));
  out.xml = (await api.raw("GET", `/api/workspace/invoices/${smmNow.data.id}/ubl.xml`)).status;
  out.edm = { fatura: edm.state.calls.map(call => call.op), smm: edm.state.smm.calls.map(call => call.op), sentIds: edm.state.sent.map(item => item.id), smmSent: edm.state.smm.sent.map(item => item.id), violations: [...edm.state.violations, ...edm.state.smm.violations] };
  out.meta = (await api.get("/api/workspace/invoices/meta")).data;
  // Karşılaştırılabilir biçim: iki kurulumda doğal olarak farklı olan kimlikler (cari / belge / satır kimliği, ETTN) ve sahte EDM'nin portu atılır.
  const text = JSON.stringify(out)
    .split(new URL(edm.url).origin)
    .join("<edm>")
    .replace(/\b[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<kimlik>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>");
  return JSON.parse(text);
}

describe("e-SMM açılınca e-SMM kullanıcısı olmayan firmada her şey eskisi gibi (fark testi: bayrak kapalı ↔ açık)", () => {
  let off;
  let on;
  let a;
  let b;
  before(async () => {
    off = await boot(false);
    a = await scenario(off);
    on = await boot(true);
    b = await scenario(on);
  });
  after(async () => {
    await off?.close();
    await on?.close();
  });

  test("A1/A4: kâğıt makbuz iki kurulumda da KAGIT, SMM serisi, kayıtta numaralı; hesap (brüt / stopaj / KDV / ödenecek) aynı", () => {
    for (const out of [a, b]) {
      const [now, later] = out.cards;
      assert.equal(now.profile, "KAGIT");
      assert.match(now.number, /^SMM2026\d{9}$/, now.number);
      assert.equal(later.profile, "KAGIT", "Kes, Sonra Gönder isteğinde de kâğıt");
      assert.match(later.number, /^SMM2026\d{9}$/, "kâğıt makbuz numarasız beklemez");
      assert.equal(now.eStatus, "none");
    }
    assert.deepEqual(b.calc, a.calc, "hesaplama (calc) aynı");
    assert.deepEqual(b.cards, a.cards, "kartlar (numara, profil, tutarlar, düğmeler, ödeme durumu) aynı");
  });

  test("A2: kâğıt makbuz Gönderilecekler'e düşmez, e-Belge uçları reddeder, kartında gönderim düğmesi yok — iki kurulumda aynı", () => {
    for (const out of [a, b]) {
      const [now] = out.cards;
      assert.equal(now.canSend, false);
      assert.equal(now.canRefresh, false);
      assert.equal(now.canOfficial, false);
      assert.ok(!out.pendingBefore.some(no => /^SMM/.test(no)), `Gönderilecekler: ${out.pendingBefore.join(", ")}`);
      assert.equal(out.paperEnds.refresh, "einvoice-not-sent");
    }
    assert.deepEqual(b.pendingBefore, a.pendingBefore);
    assert.deepEqual(b.pendingAfter, a.pendingAfter);
    assert.deepEqual(b.paperEnds, a.paperEnds);
    assert.deepEqual(b.turn, a.turn, "Tümünü Gönder sonucu aynı");
  });

  test("A3: e-Arşiv / e-Fatura aynı numara ve profille, yalnız e-Fatura servisine gider; e-SMM servisine HİÇ istek yok", () => {
    assert.deepEqual(b.edm.fatura, a.edm.fatura, "e-Fatura servisine giden istek sırası aynı");
    assert.deepEqual(b.edm.sentIds, a.edm.sentIds);
    assert.deepEqual(a.edm.smm, []);
    assert.deepEqual(b.edm.smm, [], "e-SMM servisine istek yok");
    assert.deepEqual(b.edm.smmSent, []);
    assert.deepEqual(b.edm.violations, []);
    assert.equal(b.xml, a.xml, "kâğıt makbuzun XML ucu aynı yanıt");
  });

  test("A6: yevmiye, cari ve Kasa kayıtları aynı (para çekirdeği bayraktan bağımsız)", () => {
    assert.ok(a.ledger.every(row => row.gl), "her belgenin yevmiye kaydı var");
    assert.deepEqual(b.ledger, a.ledger);
    assert.deepEqual(b.accountRows, a.accountRows);
    assert.deepEqual(b.cash, a.cash);
  });

  test("beklenen farklar yalnız bunlar: e-SMM işareti görünür, e-SMM serisi satırı, /meta'da makbuz türü gönderilebilir (kâğıt profilde düğme yok)", () => {
    assert.equal(a.settings.esmmAvailable, false);
    assert.equal(b.settings.esmmAvailable, true, "Entegratör Ayarları'nda e-SMM kullanıcısıyım görünür");
    assert.equal(b.settings.esmm, false, "firma işaretsiz");
    assert.ok(!("esmm" in a.settings.nextNumbers) && "esmm" in b.settings.nextNumbers, "Otomatik Seriler'de e-SMM satırı yalnız açıkken");
    assert.match(b.settings.testNumbers.esmm.number, /^TES\d{13}$/);
    const strip = settings => {
      const { esmmAvailable: _, nextNumbers, testNumbers, ...rest } = settings;
      const { esmm: __, ...next } = nextNumbers;
      const { esmm: ___, ...tests } = testNumbers || {};
      return { ...rest, nextNumbers: next, testNumbers: tests };
    };
    assert.deepEqual(strip(b.settings), strip(a.settings), "ayarların geri kalanı aynı");
    assert.equal(a.meta.kinds.smm.send, false);
    assert.equal(b.meta.kinds.smm.send, true);
    assert.equal(b.meta.settings.esmm, false);
    const metaRest = meta => ({ ...meta, kinds: { ...meta.kinds, smm: { ...meta.kinds.smm, send: null } } });
    assert.deepEqual(metaRest(b.meta), metaRest(a.meta), "meta'nın geri kalanı aynı");
  });
});

describe("A5: açık kurulumda e-SMM işaretlenip kaldırılınca yeni makbuz kâğıda döner (TES numaralı eski makbuz e-SMM kalır)", () => {
  let ctx;
  before(async () => {
    ctx = await boot(true);
  });
  after(async () => {
    await ctx?.close();
  });
  test("işaretli: ESMM + TES; işaret kaldırılınca: KAGIT + SMM; e-SMM makbuzunun numarası ve türü değişmez", async () => {
    const { api } = ctx;
    assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: ctx.edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
    const created = await api.post("/api/workspace/accounts", { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" });
    const accountId = created.data.id || created.data.account?.id;
    const body = { scenario: "smm", accountId, lines: [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } };
    const first = (await api.post("/api/workspace/invoices", { ...body, eSend: "later" })).data;
    assert.equal(first.profile, "ESMM");
    const sent = await api.post(`/api/workspace/invoices/${first.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.match(sent.data.number, /^TES2026\d{9}$/);
    assert.equal((await api.put("/api/workspace/invoices/settings", { esmm: false })).status, 200);
    const paper = (await api.post("/api/workspace/invoices", body)).data;
    assert.equal(paper.profile, "KAGIT");
    assert.match(paper.number, /^SMM2026\d{9}$/);
    assert.equal(paper.canSend, false);
    const again = (await api.get(`/api/workspace/invoices/${first.id}`)).data;
    assert.equal(again.profile, "ESMM");
    assert.equal(again.number, sent.data.number);
    assert.equal(again.canRefresh, true, "gönderilmiş e-SMM'nin durumu sorulabilir");
  });
});
