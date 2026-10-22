// 2.4.4 madde 23 — e-Arşiv / e-SMM İPTAL SÜRESİ (kullanıcı kararı 21.10.2026, CLAUDE.md "KARARLAR" (5)).
// Beklenenler GİB kılavuzundan (docs/kanit/2026-10-22/244-iptal/kaynak/KAYNAK.md §3 + TBK 92): süre ALICIYA İLETİM gününden başlar, başlangıç günü
// sayılmaz, 8. gün dahil (iletim 3. gün → son iptal günü 11. gün; 12. gün reddedilir); süre dolunca "yalnız programda iptal" de yok; e-Fatura kuralın dışında.
// Sahte saat (config.now; ders 13): günler yerel saatle kurulur (program "bugün"ü yerel gündür); gün sınırı, ay sonu ve yıl dönümü ayrıca.
// Eski kodda (b54ed6b = 163dd5d'nin iptal kodu) kırmızı: süre kesim gününden sayılıyordu, localOnly süreyi atlıyordu, kartta süre bilgisi yoktu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { CANCEL_WINDOW_DAYS, cancelLateText, cancelWindow, transmissionOf } from "../server/lib/einvoice/iptal-suresi.mjs";
import { isoDay } from "../server/lib/plans.mjs";
import { BUYER_VKN, NS, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";
import { SEMA } from "../tools/ebelge/dogrula.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  login: (...args) => client.login(...args),
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
});
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
// Yerel gün + saat (sunucunun "bugün"ü yerel gündür; Türkiye kurulumunda UTC+3).
const at = (base, days, hour = 10, minute = 0, second = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, minute, second).getTime();
const day = (base, days) => isoDay(new Date(at(base, days)));
const tr = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

// Sahte EDM'nin önündeki arıza vekili: SendInvoice'a tek atımlık arıza (kopma_sonra: EDM işler, yanıt kopar; kopma_once: EDM'ye gitmez, bağlantı kopar;
// gecici_hata: EDM reddeder 500).
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
        if (ariza === "gecici_hata") {
          res.writeHead(500, { "content-type": "text/xml" }).end(`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Server</faultcode><faultstring>Geçici sistem hatası</faultstring><detail><RequestFault xmlns="${NS}"><ERROR_CODE>11999</ERROR_CODE><ERROR_SHORT_DES>Geçici sistem hatası</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`);
          return;
        }
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

describe("iptal süresi kuralı (lib/einvoice/iptal-suresi.mjs, saf)", () => {
  const base = { profile: "EARSIVFATURA", eStatus: "sent", issueDate: "2026-10-11" };
  const sentAt = new Date(2026, 9, 14, 15, 0).toISOString();
  test("8 gün iletimden; başlangıç günü sayılmaz, 8. gün dahil", () => {
    assert.equal(CANCEL_WINDOW_DAYS, 8);
    const on8 = cancelWindow({ ...base, transmittedAt: sentAt, today: "2026-10-22" });
    assert.deepEqual({ start: on8.start, source: on8.source, lastDay: on8.lastDay, late: on8.late }, { start: "2026-10-14", source: "iletim", lastDay: "2026-10-22", late: false });
    assert.equal(cancelWindow({ ...base, transmittedAt: sentAt, today: "2026-10-23" }).late, true);
    assert.equal(cancelWindow({ ...base, transmittedAt: sentAt, today: "2026-10-14" }).late, false, "iletim günü");
  });
  test("iletim izi yoksa kesim günü (süre uzamaz); ileti kesim gününü ve nedenini söyler", () => {
    const w = cancelWindow({ ...base, today: "2026-10-20" });
    assert.deepEqual({ start: w.start, source: w.source, lastDay: w.lastDay, late: w.late }, { start: "2026-10-11", source: "kesim", lastDay: "2026-10-19", late: true });
    assert.match(cancelLateText(w), /kesildiği 11\.10\.2026 gününden sonraki 8 gün içinde \(en geç 19\.10\.2026\)/);
    assert.match(cancelLateText(w), /İletim günü programda kayıtlı olmadığı için kesim günü esas alındı/);
  });
  test("e-SMM aynı kural; e-Fatura, kâğıt, taslak, Hata, belirsiz ve gönderilmemiş belge kural dışı", () => {
    const smm = cancelWindow({ ...base, profile: "ESMM", eStatus: "processing", transmittedAt: sentAt, today: "2026-10-23" });
    assert.equal(smm.late, true);
    assert.match(cancelLateText(smm), /^e-SMM'nin iptal süresi doldu: alıcıya iletildiği 14\.10\.2026 gününden sonraki 8 gün içinde \(en geç 22\.10\.2026\)/);
    assert.match(cancelLateText(cancelWindow({ ...base, transmittedAt: sentAt, today: "2026-10-23" })), /^e-Arşiv faturanın iptal süresi doldu: .*İade faturası kesin/);
    for (const profile of ["TEMELFATURA", "TICARIFATURA", "KAGIT"]) assert.equal(cancelWindow({ ...base, profile, today: "2027-01-01" }), null, profile);
    for (const eStatus of ["draft", "error", "none", "waiting", "withdrawn", "cancelled", ""]) assert.equal(cancelWindow({ ...base, eStatus, today: "2027-01-01" }), null, eStatus);
  });
  test("ay sonu ve yıl dönümü takvim günüyle", () => {
    assert.equal(cancelWindow({ ...base, issueDate: "2026-01-31", transmittedAt: new Date(2026, 0, 31, 9).toISOString(), today: "2026-02-08" }).lastDay, "2026-02-08");
    assert.equal(cancelWindow({ ...base, issueDate: "2026-12-28", transmittedAt: new Date(2026, 11, 28, 9).toISOString(), today: "2027-01-05" }).late, false);
    assert.equal(cancelWindow({ ...base, issueDate: "2026-12-28", transmittedAt: new Date(2026, 11, 28, 9).toISOString(), today: "2027-01-06" }).late, true);
  });
  test("iletim anı: belgeyi EDM'ye ulaştırmış olabilecek SON girişim (durum sorgusu, hiç gitmemiş istek ve red girişim değildir)", () => {
    const ev = (type, payload, atIso) => ({ type, payload, at: atIso });
    assert.equal(transmissionOf([]), "");
    assert.equal(transmissionOf([ev("invoice.e.send-failed", { status: "error", adapter: "edm", code: "integrator-rejected" }, "2026-10-01T08:00:00.000Z"), ev("invoice.e.sent", { status: "processing", adapter: "edm" }, "2026-10-04T08:00:00.000Z")]), "2026-10-04T08:00:00.000Z");
    assert.equal(transmissionOf([ev("invoice.e.send-failed", { status: "none", adapter: "edm", code: "integrator-uncertain" }, "2026-10-02T08:00:00.000Z"), ev("invoice.e.status", { status: "sent" }, "2026-10-05T08:00:00.000Z")]), "2026-10-02T08:00:00.000Z", "belirsiz girişim; durum sorgusu girişim değil");
    assert.equal(transmissionOf([ev("invoice.e.send-failed", { status: "none", adapter: "edm", code: "integrator-login" }, "2026-10-02T08:00:00.000Z")]), "", "isteği hiç gitmemiş hata");
    assert.equal(transmissionOf([ev("invoice.e.send-failed", { status: "none", code: "integrator-unreachable", stage: "before-send" }, "2026-10-02T08:00:00.000Z")]), "", "gönderim öncesi not");
    assert.equal(transmissionOf([ev("invoice.e.draft", { status: "draft", adapter: "edm" }, "2026-10-03T08:00:00.000Z"), ev("invoice.e.status", { status: "sent" }, "2026-10-06T08:00:00.000Z")]), "2026-10-03T08:00:00.000Z", "portal taslağı");
  });
});

describe("iptal süresi: program uçları (sahte EDM, sahte saat)", () => {
  let edm;
  let vekil;
  let server;
  let api;
  let personId;
  const D = new Date(2026, 5, 17); // kesim günü (yerel); her belge kendi günlerini bundan sayar
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    vekil = await startProxy(edm.url);
    server = await startTestServer({ edocEnabled: true, edocStatusPollMs: [10, 10], now: { time: at(D, 0), fixed: true } });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: vekil.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const person = await api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", email: "ayse@example.com" });
    assert.equal(person.status, 200, JSON.stringify(person.data));
    personId = person.data.id || person.data.account?.id;
  });
  after(async () => {
    await server?.close();
    await vekil?.close();
    await edm?.close();
  });
  const setDay = (days, hour, minute, second) => server.clock.set(at(D, days, hour, minute, second));
  const issue = async (eSend = "later") => {
    const made = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: personId, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" }, eSend });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.equal(made.data.profile, "EARSIVFATURA");
    return made.data;
  };
  const send = async id => {
    const sent = await api.post(`/api/workspace/invoices/${id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    return sent.data;
  };
  const cancels = () => edm.state.calls.filter(call => call.op === "CancelInvoice").length;
  const detail = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;

  // İlk sırada: kesimi bir gün önce olan belge seride en eski tarihli olmalı (numara ve tarih sırası).
  test("gün sınırı programın yerel günüdür: 23:59'da gönderilen belgenin son günü 8 gün sonra, 00:00 geçince 9. gün; 00:30'da gönderilen o gün sayılır", async () => {
    // Türkiye (UTC+3) kurulumunda yerel 00:30 = önceki günün 21:30 UTC'si: iletim günü yerel gündür (TZ=Europe/Istanbul koşusu bunu sınar). Kesim bir
    // gün önce: UTC gününe bakan hata iletimi kesim gününe kaydırırdı.
    setDay(-1, 15);
    const c = await issue();
    setDay(0, 0, 30);
    await send(c.id);
    assert.equal((await detail(c.id)).cancelWindow.start, day(D, 0));
    assert.equal((await detail(c.id)).cancelWindow.lastDay, day(D, 8));
    setDay(0, 9);
    const a = await issue();
    const b = await issue();
    setDay(0, 23, 59, 30);
    await send(a.id);
    await send(b.id);
    assert.equal((await detail(a.id)).cancelWindow.start, day(D, 0));
    setDay(8, 23, 59, 50);
    assert.equal((await api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "son gün" })).status, 200);
    setDay(9, 0, 0, 10);
    const refused = await api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "ertesi gün" });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "einvoice-cancel-late");
  });

  test("iletimden 8. gün iptal edilir (kesimden 11. gün): EDM'de ve programda", async () => {
    setDay(0);
    const doc = await issue();
    setDay(3);
    await send(doc.id);
    setDay(5);
    const card = await detail(doc.id);
    assert.deepEqual(card.cancelWindow, { start: day(D, 3), source: "iletim", lastDay: day(D, 11), late: false });
    assert.equal(card.cancelDeadline, `${tr(day(D, 11))} (alıcıya iletildiği ${tr(day(D, 3))} gününden sonraki 8 gün)`);
    assert.equal(card.canCancel, true);
    setDay(11, 23, 59, 0);
    const before = cancels();
    const cancelled = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Müşteri vazgeçti" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.status, "cancelled");
    assert.equal(cancelled.data.eStatus, "cancelled");
    assert.equal(cancels(), before + 1, "EDM'de iptal edildi");
  });

  test("iletimden 9. gün reddedilir: ileti son günü yazar, belge ve EDM değişmez, kartta neden görünür", async () => {
    setDay(0);
    const doc = await issue();
    setDay(3);
    const sent = await send(doc.id);
    setDay(12, 0, 0, 30);
    const card = await detail(doc.id);
    assert.equal(card.canCancel, false);
    assert.deepEqual(card.cancelWindow, { start: day(D, 3), source: "iletim", lastDay: day(D, 11), late: true });
    assert.equal(card.cancelDeadline, "");
    const text = `e-Arşiv faturanın iptal süresi doldu: alıcıya iletildiği ${tr(day(D, 3))} gününden sonraki 8 gün içinde (en geç ${tr(day(D, 11))}) iptal edilebilirdi. İade faturası kesin; gerekirse doğrusunu yeniden kesin.`;
    assert.equal(card.cancelBlock, text);
    const before = cancels();
    const refused = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Geç" });
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-late");
    assert.equal(refused.data.error, text);
    assert.equal(cancels(), before, "EDM'ye iptal gitmedi");
    const after = await detail(doc.id);
    assert.equal(after.status, "issued");
    assert.equal(after.number, sent.number || after.number);
    assert.equal(after.eStatus === "sent" || after.eStatus === "processing", true, after.eStatus);
  });

  test("yalnız programda iptal (localOnly) süresi dolmuş gönderilmiş belgede de reddedilir; süre içinde çıkış yolu sürer", async () => {
    setDay(0);
    const late = await issue("now");
    const inside = await issue("now");
    setDay(9);
    const refused = await api.post(`/api/workspace/invoices/${late.id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-late");
    assert.equal((await detail(late.id)).status, "issued");
    // onay kutusu sorulmadan önce de süre söylenir (onaylatıp sonra reddetmez)
    const unconfirmed = await api.post(`/api/workspace/invoices/${late.id}/cancel`, { reason: "x", localOnly: true });
    assert.equal(unconfirmed.data.code, "einvoice-cancel-late");
    setDay(8, 23, 59, 30);
    const before = cancels();
    const local = await api.post(`/api/workspace/invoices/${inside.id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });
    assert.equal(local.status, 200, JSON.stringify(local.data));
    assert.equal(local.data.status, "cancelled");
    assert.equal(cancels(), before, "yalnız programda");
  });

  test("sonucu belirsiz gönderim (EDM işledi, yanıt koptu): süre girişim gününden, Durum Sorgula gününden değil", async () => {
    setDay(0);
    const doc = await issue();
    setDay(2);
    vekil.ariza = "kopma_sonra";
    const uncertain = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(uncertain.status, 200, "yanıt koptu");
    assert.equal((await detail(doc.id)).eStatus || "none", "none");
    setDay(4);
    const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
    const card = await detail(doc.id);
    assert.ok(["processing", "sent"].includes(card.eStatus), card.eStatus);
    assert.deepEqual(card.cancelWindow, { start: day(D, 2), source: "iletim", lastDay: day(D, 10), late: false });
    setDay(11);
    const refused = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "geç" });
    assert.equal(refused.data.code, "einvoice-cancel-late", JSON.stringify(refused.data));
  });

  test("EDM reddetti (Hata) → yeniden gönderim: süre yeniden gönderim gününden", async () => {
    setDay(0);
    const doc = await issue();
    vekil.ariza = "gecici_hata";
    const failed = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(failed.status, 200);
    assert.equal((await detail(doc.id)).eStatus, "error");
    assert.equal((await detail(doc.id)).cancelWindow, null, "Hata iletilmiş sayılmaz");
    setDay(3);
    await send(doc.id);
    assert.equal((await detail(doc.id)).cancelWindow.start, day(D, 3));
    setDay(11);
    const cancelled = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "son gün" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  });

  test("Hata görünen belge iptalde EDM'de oluşturulmuş çıkarsa süre ona da uygulanır (EDM'ye iptal gitmez)", async () => {
    setDay(0);
    const doc = await issue("now");
    const ettn = (await detail(doc.id)).ettn;
    edm.state.statuses.set(ettn, ["SEND - FAILED"]);
    setDay(1);
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {})).status, 200);
    assert.equal((await detail(doc.id)).eStatus, "error");
    edm.state.statuses.set(ettn, ["SEND - SUCCEED"]);
    setDay(9);
    const before = cancels();
    const refused = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "geç" });
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-late");
    assert.equal(cancels(), before, "EDM'ye iptal gitmedi");
    const card = await detail(doc.id);
    assert.equal(card.status, "issued");
    assert.equal(card.eStatus, "sent", "durum EDM'den güncellendi");
  });

  test("EDM'ye ulaşmamış girişim (bulunamadı) → yeniden gönderim: süre yeniden gönderim gününden", async () => {
    setDay(0);
    const doc = await issue();
    vekil.ariza = "kopma_once";
    const lost = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(lost.status, 200);
    setDay(1);
    const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
    assert.equal((await detail(doc.id)).eStatus || "none", "none");
    setDay(3);
    await send(doc.id);
    assert.equal((await detail(doc.id)).cancelWindow.start, day(D, 3));
    setDay(11);
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "son gün" })).status, 200);
  });

  test("portal taslağı portaldan gönderildi: süre taslak yükleme gününden (gönderim ondan önce olamaz)", async () => {
    assert.equal((await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } })).status, 200);
    try {
      setDay(0);
      const doc = await issue();
      setDay(1);
      const loaded = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
      assert.equal(loaded.status, 200, JSON.stringify(loaded.data));
      assert.equal((await detail(doc.id)).cancelWindow, null, "taslak iletilmiş sayılmaz");
      edm.sendFromPortal((await detail(doc.id)).ettn);
      setDay(4);
      const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
      assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
      assert.deepEqual((await detail(doc.id)).cancelWindow, { start: day(D, 1), source: "iletim", lastDay: day(D, 9), late: false });
      setDay(10);
      assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "geç" })).data.code, "einvoice-cancel-late");
    } finally {
      await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } });
    }
  });

  test("e-Fatura kuralın dışında: süre bilgisi yok, bugünkü iptal yanıtı değişmez", async () => {
    setDay(0);
    const company = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara" });
    assert.equal(company.status, 200, JSON.stringify(company.data));
    const companyId = company.data.id || company.data.account?.id;
    const checked = await api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN, accountId: companyId });
    assert.equal(checked.data.registered, true, JSON.stringify(checked.data));
    const made = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: companyId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.notEqual(made.data.profile, "EARSIVFATURA", "alıcı e-Fatura mükellefi");
    await send(made.data.id);
    setDay(20);
    const card = await detail(made.data.id);
    assert.equal(card.cancelWindow, null);
    const refused = await api.post(`/api/workspace/invoices/${made.data.id}/cancel`, { reason: "deneme" });
    assert.equal(refused.status, 409);
    assert.notEqual(refused.data.code, "einvoice-cancel-late");
  });
  // Kullanıcı kararı 22.10.2026 (madde 23 ek): sonucu BELİRSİZ gönderimde "Yalnız Programda İptal", son gönderim girişiminden 8 gün geçtiyse önce EDM'ye
  // sorar: "bulunamadı" → iptal serbest; "var" → reddedilir (iletilmişse süre doldu); ulaşılamaz → iptal yok. 8 gün dolmadıysa sorulmaz.
  const statusCalls = () => edm.state.calls.filter(call => call.op === "GetInvoiceStatus").length;
  const uncertainDoc = async (ariza, sendDay) => {
    setDay(0);
    const doc = await issue();
    setDay(sendDay);
    vekil.ariza = ariza;
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.notEqual(sent.status, 200, "yanıt koptu");
    const card = await detail(doc.id);
    assert.equal(card.eStatus || "none", "none");
    assert.ok(card.eAdapter, "sonucu belirsiz");
    assert.equal(card.canLocalCancel, true);
    return { ...doc, ettn: card.ettn };
  };
  const localCancel = id => api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });

  test("belirsiz + yalnız programda iptal: girişimden 8 gün dolmadıysa EDM'ye sorulmaz (bugünkü yol)", async () => {
    const doc = await uncertainDoc("kopma_once", 2);
    setDay(10, 23, 59, 0);
    const before = statusCalls();
    const done = await localCancel(doc.id);
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.status, "cancelled");
    assert.equal(statusCalls(), before, "durum sorulmadı");
  });

  test("belirsiz + yalnız programda iptal, 8 gün geçti: EDM \"bulunamadı\" → belge iletilmemiş, iptal serbest", async () => {
    const doc = await uncertainDoc("kopma_once", 1);
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

  test("belirsiz + yalnız programda iptal, 8 gün geçti: belge EDM'de VAR → süre doldu, reddedilir; durum belgeye yazılır, EDM'ye iptal gitmez", async () => {
    const doc = await uncertainDoc("kopma_sonra", 1);
    setDay(10);
    const before = cancels();
    const refused = await localCancel(doc.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-late");
    assert.equal(refused.data.error, `Belge EDM'de bulundu: alıcıya iletilmiş, GİB'de geçerli. e-Arşiv faturanın iptal süresi doldu: alıcıya iletildiği ${tr(day(D, 1))} gününden sonraki 8 gün içinde (en geç ${tr(day(D, 9))}) iptal edilebilirdi. İade faturası kesin; gerekirse doğrusunu yeniden kesin.`);
    assert.equal(cancels(), before);
    const card = await detail(doc.id);
    assert.equal(card.status, "issued");
    assert.ok(["processing", "sent"].includes(card.eStatus), card.eStatus);
    assert.equal(card.canCancel, false);
  });

  test("belirsiz + yalnız programda iptal, 8 gün geçti: EDM'de var ama Hata → durum yazılır, bu istekte iptal yok", async () => {
    const doc = await uncertainDoc("kopma_sonra", 1);
    edm.state.statuses.set(doc.ettn, ["SEND - FAILED"]);
    setDay(10);
    const refused = await localCancel(doc.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-found");
    const card = await detail(doc.id);
    assert.equal(card.status, "issued");
    assert.equal(card.eStatus, "error");
  });

  test("belirsiz + yalnız programda iptal, 8 gün geçti: EDM'ye ulaşılamıyor → iptal yapılmaz, belge belirsiz kalır", async () => {
    const doc = await uncertainDoc("kopma_once", 1);
    setDay(10);
    vekil.kapali = true;
    try {
      const refused = await localCancel(doc.id);
      assert.equal(refused.status, 502, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "einvoice-cancel-unreachable");
      assert.match(refused.data.error, /EDM'ye ulaşılamadı .*İptal yapılmadı; bağlantı kurulunca yeniden deneyin\./);
    } finally {
      vekil.kapali = false;
    }
    const card = await detail(doc.id);
    assert.equal(card.status, "issued");
    assert.equal(card.eStatus || "none", "none");
    assert.ok(card.eAdapter, "hâlâ belirsiz");
  });

  // Saat ileri alınır (geri alınmaz: ileri tarihli hareket kapısı); bu yüzden en sonda.
  test("ay sonu ve yıl dönümü: 28.12 iletim → 05.01 iptal edilir, 06.01 reddedilir", async () => {
    const Y = new Date(2026, 11, 28);
    server.clock.set(at(Y, 0));
    const a = await issue("now");
    const b = await issue("now");
    assert.equal((await detail(a.id)).cancelWindow.lastDay, "2027-01-05");
    server.clock.set(at(Y, 8));
    assert.equal(isoDay(new Date(server.clock.ms())), "2027-01-05");
    assert.equal((await api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "son gün" })).status, 200);
    server.clock.set(at(Y, 9));
    assert.equal((await api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "geç" })).data.code, "einvoice-cancel-late");
  });
});

describe("iptal süresi: e-SMM (gönderim kapısı madde 22'de açılır; kural şimdiden e-SMM'yi kapsar)", () => {
  let server;
  let api;
  let personId;
  const D = new Date(2026, 5, 17);
  before(async () => {
    server = await startTestServer({ edocEnabled: true, esmmEnabled: true, now: { time: at(D, 0), fixed: true } });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
    assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true })).status, 200);
    const person = await api.post("/api/workspace/accounts", { name: "Mehmet Kaya", type: "customer", taxNo: "10000000146", city: "İzmir" });
    personId = person.data.id || person.data.account?.id;
  });
  after(async () => {
    await server?.close();
  });
  const smm = async () => {
    const made = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: personId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.equal(made.data.profile, "ESMM");
    return made.data;
  };
  test("iletilmiş e-SMM 9. gün reddedilir (e-SMM iletisiyle); süre içinde kartta son gün; iletim izi gönderim girişiminden", async () => {
    server.clock.set(at(D, 0));
    const a = await smm();
    const b = await smm();
    // Elle işlenen durum (Dosya adaptörü yolu) iletim izi bırakmaz → kesim günü.
    assert.equal((await api.post(`/api/workspace/invoices/${a.id}/e-status`, { status: "sent" })).status, 200);
    // b: gönderim girişimi izi (madde 22'nin gönderim yolu bu kaydı setE ile yazar; burada aynı kayıt elle — kâhin değil, yol denetimi)
    server.app.store.run("UPDATE invoices SET e_status = 'sent', e_adapter = 'edm' WHERE id = ?", b.id);
    server.app.store.run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'invoice.e.sent', ?, 'system', 'Sistem', ?, ?)", `event-iptal-${b.id}`, b.id, JSON.stringify({ status: "sent", adapter: "edm" }), new Date(at(D, 2)).toISOString());
    server.clock.set(at(D, 9));
    const late = await api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "geç" });
    assert.equal(late.status, 409, JSON.stringify(late.data));
    assert.equal(late.data.code, "einvoice-cancel-late");
    assert.match(late.data.error, /^e-SMM'nin iptal süresi doldu: kesildiği .* Makbuz geçerli kalır/);
    const card = (await api.get(`/api/workspace/invoices/${b.id}`)).data;
    assert.deepEqual(card.cancelWindow, { start: day(D, 2), source: "iletim", lastDay: day(D, 10), late: false });
    assert.equal(card.canCancel, true);
    server.clock.set(at(D, 11));
    assert.equal((await api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "geç" })).data.code, "einvoice-cancel-late");
  });
});

describe("belirsiz e-SMM + yalnız programda iptal (kullanıcı kararı 22.10.2026): e-SMM'de \"bulunamadı\" kodu doğrulanmadı → her hata bilinmiyor", () => {
  const WSDL = { smm: readFileSync(join(SEMA, "edm", "ESmmEDM-test-singleWsdl.xml"), "utf8"), efatura: readFileSync(join(SEMA, "edm", "EFaturaEDM-test-singleWsdl.xml"), "utf8") };
  const TEMPURI = "http://tempuri.org/";
  let server;
  let api;
  let personId;
  let reply = () => "";
  const calls = [];
  // ESmmEDM.svc sahte yanıtı: GET → EDM'nin gerçek WSDL'i; POST → Login oturumu, GetSMMStatus → reply().
  const fetchImpl = async (url, { method = "GET", headers = {}, body } = {}) => {
    const service = /ESmmEDM\.svc/i.test(url) ? "smm" : "efatura";
    if (method === "GET") return new Response(WSDL[service], { status: 200, headers: { "content-type": "text/xml" } });
    const op = String(headers.SOAPAction ?? headers.soapaction ?? "").replace(/"/g, "").split("/").pop().replace(/Request$/, "");
    calls.push(op);
    const inner = op === "Login" ? `<SESSION_ID xmlns="">S-${service}</SESSION_ID>` : reply(String(body));
    return new Response(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response xmlns="${TEMPURI}">${inner}</${op}Response></s:Body></s:Envelope>`, { status: 200, headers: { "content-type": "text/xml" } });
  };
  const D = new Date(2026, 5, 17);
  before(async () => {
    resetEdmCaches();
    server = await startTestServer({ edocEnabled: true, esmmEnabled: true, fetchImpl, now: { time: at(D, 0), fixed: true } });
    api = apiOf(server.client());
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const person = await api.post("/api/workspace/accounts", { name: "Mehmet Kaya", type: "customer", taxNo: "10000000146", city: "İzmir" });
    personId = person.data.id || person.data.account?.id;
  });
  after(async () => {
    await server?.close();
  });
  // Belirsiz e-SMM gönderimi (madde 22'nin gönderim yolu bu kaydı setE ile yazar; burada aynı durum ve iz elle — yol denetimi, kâhin değil).
  const uncertainSmm = async attemptDay => {
    server.clock.set(at(D, 0));
    const made = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: personId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assert.equal(made.data.profile, "ESMM");
    server.app.store.run("UPDATE invoices SET e_status = 'none', e_adapter = 'edm' WHERE id = ?", made.data.id);
    server.app.store.run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'invoice.e.send-failed', ?, 'system', 'Sistem', ?, ?)", `event-belirsiz-${made.data.id}`, made.data.id, JSON.stringify({ status: "none", adapter: "edm", code: "integrator-uncertain" }), new Date(at(D, attemptDay)).toISOString());
    const card = (await api.get(`/api/workspace/invoices/${made.data.id}`)).data;
    assert.equal(card.canLocalCancel, true, "belirsiz");
    return card;
  };
  const localCancel = id => api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });
  const fault = code => `<s:Fault xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>s:Client</faultcode><faultstring>Hata</faultstring><detail><RequestFault xmlns="${TEMPURI}"><INTL_TXN_ID xmlns="">0</INTL_TXN_ID><ERROR_CODE xmlns="">${code}</ERROR_CODE><ERROR_SHORT_DES xmlns="">Fatura bulunamadı</ERROR_SHORT_DES></RequestFault></detail></s:Fault>`;
  const statusOf = (card, status) => `<SMM_STATUS TRXID="0" xmlns=""><ID>${card.number}</ID><UUID>${card.ettn}</UUID><HEADER><SMM_DATE>2026-06-17</SMM_DATE><STATUS>${status}</STATUS><EARCHIVE_REPORT_SENDDATE>0001-01-01</EARCHIVE_REPORT_SENDDATE><CANCEL_EARCHIVE_REPORT_SENDDATE>0001-01-01</CANCEL_EARCHIVE_REPORT_SENDDATE></HEADER><STATUS>${status}</STATUS><STATUS_DESCRIPTION>${status}</STATUS_DESCRIPTION></SMM_STATUS>`;

  test("8 gün geçti, EDM 11017 (e-Arşiv'de \"bulunamadı\") döndü: e-SMM'de bilinmiyor sayılır, iptal YOK", async () => {
    const card = await uncertainSmm(1);
    reply = () => fault(11017);
    server.clock.set(at(D, 10));
    const refused = await localCancel(card.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-unknown");
    assert.match(refused.data.error, /EDM belgenin durumunu bildirmedi .*İptal yapılmadı/);
    assert.ok(calls.includes("GetSMMStatus"), "e-SMM servisine soruldu");
    assert.equal((await api.get(`/api/workspace/invoices/${card.id}`)).data.status, "issued");
  });
  test("8 gün geçti, e-SMM EDM'de oluşturulmuş: süre doldu, reddedilir", async () => {
    const card = await uncertainSmm(1);
    reply = () => statusOf(card, "SEND - SUCCEED");
    server.clock.set(at(D, 10));
    const refused = await localCancel(card.id);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-cancel-late");
    assert.match(refused.data.error, /^Belge EDM'de bulundu: alıcıya iletilmiş, GİB'de geçerli\. e-SMM'nin iptal süresi doldu/);
  });
  test("8 gün dolmadıysa e-SMM'de de sorulmaz (bugünkü yol)", async () => {
    const card = await uncertainSmm(2);
    const before = calls.length;
    server.clock.set(at(D, 10));
    const done = await localCancel(card.id);
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.status, "cancelled");
    assert.equal(calls.length, before, "EDM'ye istek yok");
  });
});
