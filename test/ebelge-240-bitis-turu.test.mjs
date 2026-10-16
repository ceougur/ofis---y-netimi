// 2.4.0 bitiş turu (16.10.2026): bağımsız yargıç + eleştirmen bulguları (yeniden üretildi, docs/2.4.0-IS-LISTESI.md "Bitiş turu").
// "Nasıl bozulur?" — her test bir bulgunun yolu:
//   Y1/E1  env "test" kalırken Servis Adresi'ne canlı adres yazılır → bütün istekler canlıya gider (kullanıcı kararı: canlı kilitli).
//   E2     taslak EDM portalından gönderilir, sonra programda düzenlenir → defter ile yasal belge ayrışır.
//   Y2     gönderilemeyecek belge (bağlantı kurulmamış) Gönder'e basılınca test serisinden kalıcı numara alır.
//   Y3/S1  gönderimin yanıtı kaybolur (belge EDM'de) → belge silinir, numarası yeni belgeye verilir / yeniden gönderilir.
//   E3     2.3.0'dan kalan kâğıt serisi "TEA" → eski kâğıt fiş "Test" görünür, test e-Arşiviyle aynı numara sırası.
//   E4/Y7  Gönderilecekler'deki (numarasız) belgenin PDF'inde / görünümünde boş numaralı karekod. Y6 e-SMM'ye e-Fatura alanlarıyla karekod.
//   Y4     istisnalı kalem + KDV'li kalem → tip SATIS, GİB şematronundan düşer; 351 + 301'de 301 kaybolur.
//   E5     U+FFFE / U+FFFF kalem adında → XML şemadan düşer.   E6 vekil adresinde boşluk sessizce kesilir.
//   E9     resmî görüntü önbelleği iptalden sonra eski kalır.  E10 ayar yetkisi olmayan entegratör kullanıcı adını / adresini görür.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { after, before, describe, test } from "node:test";
import { validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { EDM_URLS, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { karekodData } from "../server/lib/einvoice/karekod.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const BUYER = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
// PDF'teki dolu dikdörtgen sayısı (karekod modülleri " re f" ile çizilir; 74 pt'lik karekod yüzlerce dikdörtgendir).
const rects = buffer => {
  let count = 0;
  for (const match of buffer.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content = match[1];
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      // sıkıştırılmamış akış
    }
    count += (content.match(/ re\s+f/g) || []).length;
  }
  return count;
};

describe("Bitiş turu bulguları (sahte EDM; canlıya giden istek yakalanır, ağa çıkmaz)", () => {
  let edm;
  let server;
  let client;
  let api;
  let buyerId;
  const live = [];
  let loseSendResponse = false;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) {
      live.push(url);
      throw new Error(`ağa çıkılmaz (test): ${url}`);
    }
    const response = await globalThis.fetch(input, init);
    if (loseSendResponse && /SendInvoiceRequest/.test(String(init?.body || ""))) {
      loseSendResponse = false;
      await response.text();
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
    }
    return response;
  };
  const integ = () => ({ env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" });
  const sale = (extra = {}, lines = [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }]) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines, payment: { rest: "open" }, ...extra });
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl });
    client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.raw("DELETE", url)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: integ() });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const account = await api.post("/api/workspace/accounts", BUYER);
    assert.equal(account.status, 200, JSON.stringify(account.data));
    buyerId = account.data.id || account.data.account?.id;
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("Y1/E1: canlı kilidi Servis Adresi'yle delinmez (ayar 400; veri tabanında kalmış adres 409, ağa çıkılmaz)", async () => {
    for (const url of [EDM_URLS.live, "https://PORTAL2.edmbilisim.com.tr:443/EFaturaEDM/EFaturaEDM.svc", "https://baska.ornek.com/EFaturaEDM.svc"]) {
      const response = await api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: url } });
      assert.equal(response.status, 400, `${url} → ${response.status}`);
      assert.equal(response.data.code, "integrator-live-locked");
    }
    const testUrl = await api.put("/api/workspace/invoices/settings", { integrator: { baseUrl: EDM_URLS.test } });
    assert.equal(testUrl.status, 200, "entegratörün test adresi kabul edilir");
    await api.put("/api/workspace/invoices/settings", { integrator: { baseUrl: edm.url } });
    // Eski kayıt / yedekten geri yükleme: ayar doğrudan veri tabanına yazılır.
    const raw = JSON.parse(server.app.store.setting("invoice.settings", "{}"));
    raw.integrator.baseUrl = EDM_URLS.live;
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw));
    const doc = (await sale()).data;
    live.length = 0;
    const tested = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 409);
    assert.equal(tested.data.code, "integrator-live-locked");
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.status, 409);
    assert.equal(sent.data.code, "integrator-live-locked");
    assert.deepEqual(live, [], "canlı adrese hiç istek gitmedi");
    raw.integrator.baseUrl = edm.url;
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw));
  });

  test("Y2: bağlantısı kurulmamış entegratörle Gönder, Gönderilecekler'deki belgeye numara vermez", async () => {
    await api.put("/api/workspace/invoices/settings", { integrator: { clearPassword: true } });
    const waiting = (await sale({ eSend: "later" })).data;
    assert.equal(waiting.eStatus, "waiting");
    const sent = await api.post(`/api/workspace/invoices/${waiting.id}/send`, {});
    assert.equal(sent.status, 409);
    assert.equal(sent.data.code, "integrator-not-configured");
    const after = (await api.get(`/api/workspace/invoices/${waiting.id}`)).data;
    assert.equal(after.number, "", "numara verilmedi");
    assert.equal(after.eStatus, "waiting", "Gönderilecekler'de kaldı");
    await api.put("/api/workspace/invoices/settings", { integrator: integ() });
    const ok = await api.post(`/api/workspace/invoices/${waiting.id}/send`, {});
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
  });

  test("E2: portaldan gönderilmiş taslak programda düzenlenmez, e-Fatura taslağı onayla da iptal edilmez; durum güncellenir", async () => {
    await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } });
    const doc = (await sale()).data;
    const draft = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(draft.data.eStatus, "draft");
    edm.sendFromPortal(doc.ettn);
    const edit = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(edit.status, 409, JSON.stringify(edit.data));
    assert.equal(edit.data.code, "einvoice-draft-gone");
    const after = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(after.eStatus, "sent", "durum EDM'den güncellendi");
    assert.equal(after.tryPayable, 1200, "defter yasal belgeyle aynı kaldı");
    // İkinci belge: e-Fatura taslağı portaldan gönderilmiş, kullanıcı "portaldan sildim" onayıyla iptal etmek istiyor.
    const second = (await sale()).data;
    await api.post(`/api/workspace/invoices/${second.id}/e-draft`, {});
    edm.sendFromPortal(second.ettn);
    const cancel = await api.post(`/api/workspace/invoices/${second.id}/cancel`, { reason: "deneme", confirmExternal: true });
    assert.equal(cancel.status, 409, JSON.stringify(cancel.data));
    assert.equal(cancel.data.code, "einvoice-draft-gone");
    assert.equal((await api.get(`/api/workspace/invoices/${second.id}`)).data.status, "issued");
    await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } });
  });

  test("Y3/S1: yanıtı kaybolan gönderim belirsizdir — silinmez, düzenlenmez; yeniden Gönder ikinci kez göndermez, durumu alır", async () => {
    const doc = (await sale()).data;
    loseSendResponse = true;
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.status, 502);
    const before = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "EDM belgeyi aldı");
    assert.equal(before.canDelete, false);
    assert.equal(before.canModify, false);
    assert.equal(before.canRefresh, true, "Durum Sorgula açık");
    const removed = await api.del(`/api/workspace/invoices/${doc.id}`);
    assert.equal(removed.status, 409, JSON.stringify(removed.data));
    const cancelled = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" });
    assert.equal(cancelled.status, 409);
    assert.equal(cancelled.data.code, "einvoice-uncertain");
    const again = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "ikinci kez gönderilmedi");
    assert.notEqual((await api.get(`/api/workspace/invoices/${doc.id}`)).data.eStatus, "none");
  });

  test("Y3: belirsiz gönderimde belge EDM'ye ulaşmadıysa Durum Sorgula belirsizliği kaldırır (EDM 11017 'Fatura bulunamadı')", async () => {
    const doc = (await sale()).data;
    // İstek EDM'ye hiç ulaşmadan koptu: belge EDM'de yok.
    const realFetch = globalThis.fetch;
    let dropped = false;
    globalThis.fetch = async (input, init) => {
      if (!dropped && /SendInvoiceRequest/.test(String(init?.body || ""))) {
        dropped = true;
        throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }) });
      }
      return realFetch(input, init);
    };
    try {
      assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 502);
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.equal(edm.state.sent.some(item => item.uuid === doc.ettn), false);
    const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
    assert.equal(refreshed.data.eStatus, "none");
    assert.equal(refreshed.data.canSend, true);
    assert.equal(refreshed.data.canModify, true);
  });

  test("Kontrol K1: Gönderilecekler'den silinmiş (withdrawn) belge bağlantısız Gönder'de de numara almaz", async () => {
    const waiting = (await sale({ eSend: "later" })).data;
    assert.equal((await api.post(`/api/workspace/invoices/${waiting.id}/withdraw`, {})).status, 200);
    const withdrawn = (await api.get(`/api/workspace/invoices/${waiting.id}`)).data;
    assert.equal(withdrawn.eStatus, "withdrawn");
    await api.put("/api/workspace/invoices/settings", { integrator: { clearPassword: true } });
    try {
      const sent = await api.post(`/api/workspace/invoices/${waiting.id}/send`, {});
      assert.equal(sent.status, 409);
      assert.equal(sent.data.code, "integrator-not-configured");
      const after = (await api.get(`/api/workspace/invoices/${waiting.id}`)).data;
      assert.equal(after.number, withdrawn.number, "fiş numarası yerinde, e-Belge numarası verilmedi");
      assert.equal(after.eStatus, "withdrawn");
    } finally {
      await api.put("/api/workspace/invoices/settings", { integrator: integ() });
    }
  });

  test("Kontrol K2: 'Hata'daki belgenin yeniden gönderiminde yanıt kaybolursa da belirsiz — ikinci kez gönderilmez", async () => {
    const doc = (await sale()).data;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    // İlk gönderimi reddedilmiş belgeye çevir (EDM'de yok, programda "Hata").
    edm.state.sent.splice(edm.state.sent.findIndex(item => item.uuid === doc.ettn), 1);
    edm.state.statuses.delete(doc.ettn);
    server.app.store.run("UPDATE invoices SET e_status = 'error' WHERE id = ?", doc.id);
    loseSendResponse = true;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 502);
    const after = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "EDM belgeyi aldı");
    assert.equal(after.canModify, false);
    assert.equal(after.canDelete, false);
    assert.equal(after.canCancel, false, "iptal düğmesi de kapalı (K4)");
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "ikinci kez gönderilmedi");
  });

  test("Kontrol K3: tevkifatlı + istisnalı kalem aynı e-Belgede kaydedilmez (geçerli GİB tipi yok)", async () => {
    const mixed = await sale({}, [{ name: "Etüt", qty: 1, unitPrice: 1000, vatRate: 20, withholdingCode: "601" }, { name: "İhracat", qty: 1, unitPrice: 100, vatRate: 0, exemptionCode: "301" }]);
    assert.equal(mixed.status, 400, JSON.stringify(mixed.data));
    assert.match(mixed.data.error, /ayrı faturalarda/);
    const withheld = await sale({}, [{ name: "Etüt", qty: 1, unitPrice: 1000, vatRate: 20, withholdingCode: "601" }, { name: "Diğer", qty: 1, unitPrice: 100, vatRate: 0, exemptionCode: "351" }]);
    assert.equal(withheld.status, 200, "351 (istisna değil) tevkifatla birlikte olabilir");
  });

  test("Çıkış yolu (kullanıcı kararı): entegratöre ulaşılamıyorsa belirsiz / taslak belge yalnız programda iptal edilir — yetki + onay + işlem kaydı", async () => {
    // Belirsiz belge: gönderimin yanıtı kayboldu, sonra test hesabı kapandı (parola silindi).
    const doc = (await sale()).data;
    loseSendResponse = true;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 502);
    await api.put("/api/workspace/invoices/settings", { integrator: { clearPassword: true } });
    try {
      const card = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
      assert.equal(card.canCancel, false);
      assert.equal(card.canLocalCancel, true, "yetkiliye çıkış yolu görünür");
      assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {})).status, 409, "durum sorulamıyor (bağlantı yok)");
      const lawyer = await createUser(server, { post: async (url, body) => client.post(url, body) }, { username: "avukat-cikis", role: "avukat" });
      const lawyerCard = unwrap(await lawyer.get(`/api/workspace/invoices/${doc.id}`)).data;
      assert.equal(lawyerCard.canLocalCancel, false, "ayar yetkisi olmayana düğme yok");
      const forbidden = unwrap(await lawyer.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true }));
      assert.equal(forbidden.status, 403);
      const unconfirmed = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "x", localOnly: true });
      assert.equal(unconfirmed.status, 409);
      assert.equal(unconfirmed.data.code, "einvoice-local-confirm");
      const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "EDM test hesabı kapandı", localOnly: true, confirmLocal: true });
      assert.equal(done.status, 200, JSON.stringify(done.data));
      assert.equal(done.data.status, "cancelled");
      const logged = server.app.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'invoice.e.local-cancel' AND entity_id = ?", doc.id);
      assert.equal(logged.n, 1, "işlem kaydında");
      // Portal taslağı + EDM'ye ulaşılamıyor: normal iptal bağlantı hatası verir, yalnız programda iptal çalışır.
      await api.put("/api/workspace/invoices/settings", { integrator: integ(), eOptions: { draftUpload: true } });
      const draftDoc = (await sale()).data;
      assert.equal((await api.post(`/api/workspace/invoices/${draftDoc.id}/e-draft`, {})).data.eStatus, "draft");
      await api.put("/api/workspace/invoices/settings", { integrator: { clearPassword: true } });
      assert.notEqual((await api.post(`/api/workspace/invoices/${draftDoc.id}/cancel`, { reason: "x", confirmExternal: true })).status, 200);
      const local = await api.post(`/api/workspace/invoices/${draftDoc.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true });
      assert.equal(local.status, 200, JSON.stringify(local.data));
    } finally {
      await api.put("/api/workspace/invoices/settings", { integrator: integ(), eOptions: { draftUpload: false } });
    }
  });

  test("E3: test serisi adları firmanın serisinde kalamaz (her kayıtta); kâğıt belge seri adı yüzünden 'Test' sayılmaz", async () => {
    const raw = JSON.parse(server.app.store.setting("invoice.settings", "{}"));
    raw.series = { ...(raw.series || {}), paper: "TEA" };
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw));
    const other = await api.put("/api/workspace/invoices/settings", { defaults: { dueDays: 3 } });
    assert.equal(other.status, 400);
    assert.equal(other.data.code, "series-reserved");
    assert.match(other.data.error, /Belge Serisi/);
    const sendBlocked = await api.post(`/api/workspace/invoices/${(await sale()).data.id}/send`, {});
    assert.equal(sendBlocked.status, 409);
    assert.equal(sendBlocked.data.code, "series-reserved");
    // 2.3.0'dan kalmış "TEA" serili kâğıt belge (veri tabanında): test işareti taşımaz.
    const paper = (await sale()).data;
    server.app.store.run("UPDATE invoices SET profile = 'KAGIT', series = 'TEA' WHERE id = ?", paper.id);
    assert.equal((await api.get(`/api/workspace/invoices/${paper.id}`)).data.eTest, false);
    raw.series.paper = "FIS";
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw));
  });

  test("E4/Y7/Y6: karekod yalnız numaralı, entegratöre ulaşmış e-Fatura / e-Arşivde (PDF ve görünüm); e-SMM'ye basılmaz", async () => {
    const waiting = (await sale({ eSend: "later" })).data;
    const waitingPdf = await client.raw("GET", `/api/workspace/invoices/${waiting.id}/fatura.pdf`);
    assert.equal(waitingPdf.status, 200);
    assert.ok(rects(waitingPdf.buffer) < 100, `Gönderilecek belgenin PDF'inde karekod yok (${rects(waitingPdf.buffer)} dikdörtgen)`);
    const xml = (await client.get(`/api/workspace/invoices/${waiting.id}/ubl.xml`)).data;
    assert.doesNotMatch(String(xml), /alt="Karekod"/, "numarasız belgenin görünümünde karekod yok");
    const unsent = (await sale()).data;
    assert.ok(rects((await client.raw("GET", `/api/workspace/invoices/${unsent.id}/fatura.pdf`)).buffer) < 100, "hiç gönderilmemiş belgenin PDF'inde karekod yok");
    assert.equal((await api.post(`/api/workspace/invoices/${unsent.id}/send`, {})).status, 200);
    assert.ok(rects((await client.raw("GET", `/api/workspace/invoices/${unsent.id}/fatura.pdf`)).buffer) > 200, "gönderilen belgenin PDF'inde karekod var");
    const sentXml = String((await client.get(`/api/workspace/invoices/${unsent.id}/ubl.xml`)).data);
    assert.equal(karekodData(sentXml)?.no, (await api.get(`/api/workspace/invoices/${unsent.id}`)).data.number);
    assert.equal(karekodData(sentXml.replace(/<cbc:ProfileID>[^<]*<\/cbc:ProfileID>/, "<cbc:ProfileID>ESMM</cbc:ProfileID>")), null, "e-SMM'ye e-Fatura alanlarıyla karekod üretilmez");
  });

  test("Y4: istisnalı kalem + KDV'li kalem → ISTISNA ve GİB şematronundan temiz; 351 + 301'de iki istisna kodu da belgede", async () => {
    const cases = [
      [{ name: "İhracat", qty: 1, unitPrice: 100, vatRate: 0, exemptionCode: "301" }, { name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }],
      [{ name: "Diğer", qty: 1, unitPrice: 100, vatRate: 0, exemptionCode: "351" }, { name: "İhracat", qty: 1, unitPrice: 50, vatRate: 0, exemptionCode: "301" }],
    ];
    for (const lines of cases) {
      const doc = await sale({}, lines);
      assert.equal(doc.status, 200, JSON.stringify(doc.data));
      const xml = String((await client.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
      const result = await validateInvoice(xml);
      assert.deepEqual([...result.xsd, ...result.schematron], [], `${lines.map(line => line.exemptionCode || line.vatRate).join(" + ")}: GİB / XSD temiz`);
      const codes = [...xml.matchAll(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g)][0][0].match(/<cbc:TaxExemptionReasonCode>(\d+)</g) || [];
      for (const line of lines.filter(item => item.exemptionCode)) assert.ok(codes.some(code => code.includes(line.exemptionCode)), `belge düzeyinde ${line.exemptionCode} var`);
      if (lines.some(line => line.exemptionCode && line.exemptionCode !== "351")) assert.match(xml, /<cbc:InvoiceTypeCode>ISTISNA</);
    }
  });

  test("E5: U+FFFE / U+FFFF kalem adından ayıklanır; belge şemadan geçer", async () => {
    const doc = await sale({}, [{ name: "Ürün ￾￿", qty: 1, unitPrice: 10, vatRate: 20 }]);
    const xml = String((await client.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
    assert.doesNotMatch(xml, /[￾￿]/);
    const result = await validateInvoice(xml);
    assert.deepEqual(result.xsd, []);
  });

  test("E9: resmî görüntü önbelleği belgenin durumuna bağlı — e-Arşiv iptalinden sonra EDM'den yeniden alınır", async () => {
    const person = (await api.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" })).data;
    const doc = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.id || person.account?.id, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } })).data;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    // Sahte EDM önce "işleniyor", sonra "başarılı" der (işlenirken iptal reddedilir): durum iki kez sorulur.
    await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {})).data.eStatus, "sent");
    assert.equal((await client.raw("GET", `/api/workspace/invoices/${doc.id}/resmi.pdf`)).status, 200);
    const before = edm.state.pdfRequests || 0;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" })).status, 200);
    assert.equal((await client.raw("GET", `/api/workspace/invoices/${doc.id}/resmi.pdf`)).status, 200);
    assert.equal((edm.state.pdfRequests || 0) - before, 1, "iptalden sonra görüntü yeniden alındı");
  });

  test("E10: Fatura Ayarları yetkisi olmayan kullanıcı entegratör kullanıcı adını, adresini ve son test iletisini görmez", async () => {
    const lawyer = await createUser(server, { post: async (url, body) => client.post(url, body) }, { username: "avukat-bitis", role: "avukat" });
    const seen = unwrap(await lawyer.get("/api/workspace/invoices/settings"));
    assert.equal(seen.status, 200);
    for (const key of ["username", "baseUrl", "url", "lastTest", "network", "senderAlias"]) assert.equal(seen.data.integrator[key], undefined, `${key} gizli`);
    assert.equal(seen.data.integrator.configured, true);
    const admin = (await api.get("/api/workspace/invoices/settings")).data;
    assert.equal(admin.integrator.username, "edmkullanici", "ayar yetkilisi görür");
  });
});

describe("E6: vekil sunucu adresindeki boşluk sessizce kesilmez", () => {
  test("'vekil.firma.local 8080' → 400", async () => {
    const server = await startTestServer({ env: { HTTPS_PROXY: "", HTTP_PROXY: "", https_proxy: "", http_proxy: "" } });
    try {
      const client = server.client();
      await client.login("admin", ADMIN_PASSWORD);
      for (const address of ["vekil.firma.local 8080", "http://a b:99999"]) {
        const response = await client.put("/api/admin/network", { mode: "manual", address, username: "", password: "" });
        assert.equal(response.status, 400, `${address} → ${response.status}`);
      }
      assert.equal((await client.put("/api/admin/network", { mode: "manual", address: "vekil.firma.local:8080", username: "", password: "" })).status, 200);
    } finally {
      await server.close();
    }
  });
});

describe("Y5: görünüm kapatılınca karekodun da kalkacağı ekranda yazar", () => {
  test("onay kutusu metni karekodu anar", () => {
    const source = readFileSync(new URL("../client/assets/hof-invoices.js", import.meta.url), "utf8");
    assert.match(source, /Kendi görünüm tasarımımızı kullan \([^)]*karekod[^)]*\)/);
  });
});
