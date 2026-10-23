// 2.4.4 — sonucu BELİRSİZ e-Faturada "Yalnız Programda İptal" (bağımsız kâhin İNCELE 1; kullanıcı kararı 23.10.2026, 5 dk yetkisiyle — 22.10.2026 madde 23
// ekinin e-Faturaya uygulanması). Son gönderim girişiminden (yoksa kesim gününden) 8 gün geçtiyse yalnız programda iptalden önce EDM'ye sorulur:
// "bulunamadı" → iptal serbest; belge EDM'de VAR → durum belgeye yazılır, yalnız programda iptal reddedilir (ileti e-Faturanın programdaki iptal yolunu
// söyler: alıcının reddi / GİB'in iptal yolu / iade faturasından sonra İptal Et + onay kutusu); ulaşılamadı → 502. 8 gün içinde K4 çıkış yolu aynen.
// e-Faturanın NORMAL iptali (iptal süresi yok, entegratörden iptal yok) değişmez; e-Arşiv / e-SMM kuralı değişmez (test/ebelge-244-iptal-suresi.test.mjs).
// Kök neden (aday 9, 75a5706): uncertainLocalCheck → attemptWindow e-Faturada null → sorgu hiç yapılmıyordu; GİB'de geçerli e-Fatura programda "İptal Edildi".
//
// "Nasıl bozulur?" (not defteri efatura-iptal/NASIL-BOZULUR.md):
//   F1 Temel, 8 gün geçti, EDM'de var → 200 (kök)    F2 Ticari aynı       F3 bulunamadı → 200      F4 ulaşılamadı → 502
//   F5 8 gün içinde K4 200, ileti e-Fatura dilinde    F6 sınır 8. gün / 9. gün (8 → 7 mutasyonu)     F7 iz yoksa kesim günü
//   F8 yetkisiz 403, EDM'ye sorulmaz                  F9 e-Arşiv / e-SMM ve e-Faturanın normal iptali değişmez      F10 iletinin yolu çalışır
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
// Ad alanıyla: eski kodda (uncertainWindow yok) yalnız saf test düşer, program uçlarının testleri yine koşar (kırmızının nedeni okunur — ders 38).
import * as suresi from "../server/lib/einvoice/iptal-suresi.mjs";
import { isoDay } from "../server/lib/plans.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const at = (base, days, hour = 10, minute = 0, second = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, minute, second).getTime();
const PATH_TEXT = "Programda iptal, e-Fatura GİB'de iptal edildikten (alıcının reddi ya da GİB'in e-Fatura iptal yolu) ya da alıcı iade faturası kestikten sonra yapılır: İptal Et → “Bu e-Fatura alıcı tarafından reddedildi ya da GİB'den iptal edildi” kutusu.";

// Sahte EDM'nin önünde arıza vekili (ebelge-244-iptal-suresi ile aynı düzen): SendInvoice'a tek atımlık arıza — kopma_sonra: EDM işler, yanıt kopar;
// kopma_once: EDM'ye gitmez, bağlantı kopar. kapali: hiçbir istek geçmez.
async function startProxy(target) {
  const hedef = new URL(target);
  const st = { ariza: null, kapali: false, sockets: new Set() };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = Buffer.concat(chunks);
        if (st.kapali) return req.socket.destroy();
        const send = /<(?:\w+:)?SendInvoiceRequest[\s>]/.test(body.toString("utf8"));
        const ariza = send ? st.ariza : null;
        if (send) st.ariza = null;
        if (ariza === "kopma_once") return req.socket.destroy();
        const headers = {};
        for (const key of ["content-type", "soapaction"]) if (req.headers[key]) headers[key] = req.headers[key];
        const r = await fetch(hedef.origin + req.url, { method: req.method, headers, body: req.method === "GET" ? undefined : body });
        const payload = Buffer.from(await r.arrayBuffer());
        if (ariza === "kopma_sonra") return req.socket.destroy();
        res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "text/xml" }).end(payload);
      } catch {
        req.socket.destroy();
      }
    });
  });
  server.on("connection", socket => {
    st.sockets.add(socket);
    socket.on("close", () => st.sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  st.url = `http://127.0.0.1:${server.address().port}${hedef.pathname}`;
  st.close = () => {
    for (const socket of st.sockets) socket.destroy();
    return new Promise(resolve => server.close(resolve));
  };
  return st;
}

describe("belirsiz e-Fatura: yalnız programda iptal kapısının sınırı (saf)", () => {
  test("uncertainWindow e-Faturayı kapsar; e-Arşiv / e-SMM'de attemptWindow ile aynı; cancelWindow e-Faturada yine yok (normal iptal değişmez)", () => {
    const { attemptWindow, cancelWindow, uncertainWindow } = suresi;
    assert.equal(typeof uncertainWindow, "function", "belirsiz gönderimde yerel iptal sınırı (uncertainWindow) yok");
    const base = { issueDate: "2026-10-14", transmittedAt: new Date(2026, 9, 14, 9).toISOString(), today: "2026-10-22" };
    for (const profile of ["TEMELFATURA", "TICARIFATURA"]) {
      assert.deepEqual(uncertainWindow({ ...base, profile }), { days: 8, start: "2026-10-14", source: "iletim", lastDay: "2026-10-22", late: false, label: "e-Fatura" }, profile);
      assert.equal(uncertainWindow({ ...base, profile, today: "2026-10-23" }).late, true, `${profile}: 9. gün`);
      assert.equal(attemptWindow({ ...base, profile }), null, `${profile}: attemptWindow değişmedi`);
      assert.equal(cancelWindow({ ...base, profile, eStatus: "sent" }), null, `${profile}: iptal süresi yok`);
    }
    for (const profile of ["EARSIVFATURA", "ESMM"]) assert.deepEqual(uncertainWindow({ ...base, profile, today: "2026-10-23" }), attemptWindow({ ...base, profile, today: "2026-10-23" }), profile);
    assert.equal(uncertainWindow({ ...base, profile: "KAGIT" }), null);
    assert.equal(uncertainWindow({ profile: "TEMELFATURA", issueDate: "2026-10-14", today: "2026-10-23" }).source, "kesim", "iz yoksa kesim günü");
  });
});

describe("belirsiz e-Fatura + Yalnız Programda İptal (sahte EDM, sahte saat)", () => {
  let edm;
  let vekil;
  let server;
  let client;
  let api;
  let companyId;
  const D = new Date(2026, 5, 17);
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    vekil = await startProxy(edm.url);
    server = await startTestServer({ edocEnabled: true, edocStatusPollMs: [10, 10], now: { time: at(D, 0), fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: vekil.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const company = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara" });
    assert.equal(company.status, 200, JSON.stringify(company.data));
    companyId = company.data.id || company.data.account?.id;
    const checked = await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN, accountId: companyId });
    assert.equal(checked.data.registered, true, JSON.stringify(checked.data));
  });
  after(async () => {
    await server?.close();
    await vekil?.close();
    await edm?.close();
  });
  const setDay = (days, hour, minute, second) => server.clock.set(at(D, days, hour, minute, second));
  const statusCalls = () => edm.state.calls.filter(call => call.op === "GetInvoiceStatus").length;
  const detail = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const localCancel = (id, a = api) => a.post(`/api/workspace/invoices/${id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });
  // Kesim 0. gün; gönderim sendDay'de, yanıt kopar (ariza) → sonucu belirsiz e-Fatura (kart "Yalnız Programda İptal Et" gösterir).
  const uncertain = async (ariza, sendDay, profile = "TEMELFATURA") => {
    setDay(0);
    const made = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: companyId, profile, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.equal(made.data.profile, profile);
    setDay(sendDay);
    vekil.ariza = ariza;
    const sent = await api.post(`/api/workspace/invoices/${made.data.id}/send`, {});
    assert.notEqual(sent.status, 200, "yanıt koptu");
    const card = await detail(made.data.id);
    assert.equal(card.eStatus || "none", "none");
    assert.ok(card.eAdapter, "sonucu belirsiz");
    assert.equal(card.canLocalCancel, true);
    return card;
  };

  test("F5 girişimden 8 gün dolmadıysa EDM'ye sorulmaz (K4 çıkış yolu); belgeye yazılan ileti e-Faturanın iptal yolunu söyler", async () => {
    const doc = await uncertain("kopma_sonra", 2);
    setDay(10, 23, 59, 0);
    const before = statusCalls();
    const done = await localCancel(doc.id);
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.status, "cancelled");
    assert.equal(statusCalls(), before, "durum sorulmadı");
    assert.equal(done.data.eMessage, "Yalnız programda iptal edildi (EDM'ye sorulmadı). Belge EDM'ye ulaşıp alıcıya iletildiyse GİB'de geçerlidir: alıcıdan ret ya da GİB'in e-Fatura iptal yolunu isteyin, gerekirse alıcı iade faturası keser.");
    assert.doesNotMatch(done.data.eMessage, /Entegratörde belge varsa orada ayrıca iptal edin/);
  });

  test("F6 sınır: girişimden sonraki 8. gün 23:59'da sorulmaz; 9. gün sorulur", async () => {
    const edge = await uncertain("kopma_once", 1);
    setDay(9, 23, 59, 30);
    const before = statusCalls();
    assert.equal((await localCancel(edge.id)).status, 200);
    assert.equal(statusCalls(), before, "8. gün: sorulmadı");
    const next = await uncertain("kopma_once", 1);
    setDay(10, 0, 0, 30);
    const before2 = statusCalls();
    const done = await localCancel(next.id);
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(statusCalls(), before2 + 1, "9. gün: önce EDM'ye soruldu");
  });

  test("F3 8 gün geçti, EDM \"bulunamadı\" → belge iletilmemiş, iptal serbest", async () => {
    const doc = await uncertain("kopma_once", 1);
    setDay(10);
    const before = statusCalls();
    const done = await localCancel(doc.id);
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.status, "cancelled");
    assert.equal(statusCalls(), before + 1, "önce EDM'ye soruldu");
    assert.match(done.data.eMessage, /EDM'de bulunamadı \(belge iletilmemiş\); yalnız programda iptal edildi/);
    const trail = server.app.store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'invoice.e.local-cancel' AND entity_id = ?", doc.id);
    assert.equal(JSON.parse(trail.p).reason, "integrator-missing");
  });

  for (const profile of ["TEMELFATURA", "TICARIFATURA"]) {
    test(`F1/F2/F10 ${profile}: 8 gün geçti, belge EDM'de VAR → yalnız programda iptal reddedilir, durum belgeye yazılır; ileti iptal yolunu söyler ve o yol çalışır`, async () => {
      const doc = await uncertain("kopma_sonra", 1, profile);
      setDay(10);
      const before = statusCalls();
      const refused = await localCancel(doc.id);
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "einvoice-found");
      assert.equal(statusCalls(), before + 1, "EDM'ye soruldu");
      const card = await detail(doc.id);
      assert.equal(card.status, "issued", "belge iptal edilmedi (veri tabanı)");
      assert.ok(["processing", "sent"].includes(card.eStatus), `durum belgeye yazıldı: ${card.eStatus}`);
      const shown = card.eStatus === "processing" ? "İşleniyor" : "Gönderildi";
      const how = card.eStatus === "processing" ? "EDM'de işleniyor, alıcıya iletilebilir" : "alıcıya iletilmiş, GİB'de geçerli";
      assert.equal(refused.data.error, `Belge EDM'de bulundu (durum: ${shown}): e-Fatura ${how}; durum belgeye yazıldı, yalnız programda iptal edilmedi. ${PATH_TEXT}`);
      assert.ok(!server.app.store.get("SELECT 1 AS found FROM audit_events WHERE type = 'invoice.e.local-cancel' AND entity_id = ?", doc.id), "yerel iptal işlem kaydı yok");
      // İletinin söylediği yol: alıcı reddetti / GİB'den iptal edildi → İptal Et + onay kutusu.
      for (let i = 0; i < 3 && (await detail(doc.id)).eStatus !== "sent"; i += 1) await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
      const withoutBox = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "alıcı reddetti" });
      assert.equal(withoutBox.status, 409, JSON.stringify(withoutBox.data));
      const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "alıcı reddetti", confirmExternal: true });
      assert.equal(done.status, 200, JSON.stringify(done.data));
      assert.equal(done.data.status, "cancelled");
    });
  }

  test("F4 8 gün geçti, EDM'ye ulaşılamıyor → iptal yapılmaz (502), belge belirsiz kalır", async () => {
    const doc = await uncertain("kopma_once", 1);
    setDay(10);
    vekil.kapali = true;
    try {
      const refused = await localCancel(doc.id);
      assert.equal(refused.status, 502, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "einvoice-cancel-unreachable");
      assert.match(refused.data.error, /üzerinden 8 günden fazla geçti; belgenin EDM'de olup olmadığı sorulmadan yalnız programda iptal edilmez\. EDM'ye ulaşılamadı .*İptal yapılmadı; bağlantı kurulunca yeniden deneyin\./);
    } finally {
      vekil.kapali = false;
    }
    const card = await detail(doc.id);
    assert.equal(card.status, "issued");
    assert.equal(card.eStatus || "none", "none");
    assert.ok(card.eAdapter, "hâlâ belirsiz");
  });

  test("F7 gönderim izi yoksa kesim gününden: kesimden 9. gün EDM'ye sorulur", async () => {
    setDay(0);
    const made = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: companyId, lines: [{ name: "Bakım", qty: 1, unitPrice: 200, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.ok(["TEMELFATURA", "TICARIFATURA"].includes(made.data.profile), made.data.profile);
    // Eski veri benzetimi: belirsiz durum, işlem geçmişinde gönderim girişimi yok.
    server.app.store.run("UPDATE invoices SET e_status = 'none', e_adapter = 'edm' WHERE id = ?", made.data.id);
    server.app.store.run("DELETE FROM audit_events WHERE entity_id = ? AND type LIKE 'invoice.e.%'", made.data.id);
    setDay(9);
    const before = statusCalls();
    const res = await localCancel(made.data.id);
    assert.equal(statusCalls(), before + 1, `kesim gününden 9. gün: soruldu (${res.status} ${JSON.stringify(res.data).slice(0, 200)})`);
  });

  test("F8 Fatura Ayarları yetkisi olmayan: 403, EDM'ye sorulmaz, belge değişmez", async () => {
    const doc = await uncertain("kopma_once", 1);
    setDay(10);
    const lawyer = await createUser(server, { post: async (url, body) => client.post(url, body) }, { username: "avukat-efatura", role: "avukat" });
    const before = statusCalls();
    const forbidden = unwrap(await lawyer.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true }));
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.data));
    assert.equal(statusCalls(), before);
    assert.equal((await detail(doc.id)).status, "issued");
  });

  test("F9 e-Faturanın normal iptali değişmez: gönderilmiş e-Faturada süre bilgisi yok; onaysız İptal Et 409 einvoice-sent", async () => {
    setDay(20);
    const made = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: companyId, lines: [{ name: "Destek", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.equal((await api.post(`/api/workspace/invoices/${made.data.id}/send`, {})).status, 200);
    for (let i = 0; i < 3 && (await detail(made.data.id)).eStatus !== "sent"; i += 1) await api.post(`/api/workspace/invoices/${made.data.id}/e-refresh`, {});
    setDay(40);
    const card = await detail(made.data.id);
    assert.equal(card.cancelWindow, null);
    assert.equal(card.canLocalCancel, false);
    const refused = await api.post(`/api/workspace/invoices/${made.data.id}/cancel`, { reason: "deneme" });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "einvoice-sent");
    assert.equal(isoDay(new Date(server.clock.ms())) > "2026-07-20", true);
  });
});
