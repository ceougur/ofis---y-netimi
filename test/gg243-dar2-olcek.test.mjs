// Dar kontrol 2 (2.4.3) B4 ORTA ölçek gerilemesi: olderPending / buyerBlockOf her satırda mükellef kayıt defterini (einvoice.taxpayers, 5.000'e dek
// numara) JSON.parse ediyordu; olderPending seriyi süzmeden yılın bütün bekleyenlerini satır başına iki sorguyla okuyordu. 1.500 bekleyen + 5.000
// kayıtta Kaydet ve Gönder p50 2.621 ms (eski 144 ms); işlem içinde, sunucu bekliyor. Karar: kayıt defteri istek başına bir kez ayrıştırılır
// (metin değişmedikçe önbellek), olderPending tek sorgu.
// Bu dosya (1) kuralın aynen korunduğunu (seri, yıl, kalıcı engelli eski belge, kayıt defterindeki alıcı sayılmaz) ve (2) maliyetin kayıt defteri
// büyüklüğünden bağımsız olduğunu (oran; mutlak süre değil — CI makinesi değişken) sınar. Ölçüm tablosu: docs/kanit/2026-10-18/duzeltme3-243/.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const ORDER_RE = /^Bu seride daha eski tarihli gönderilmemiş (\d+) belge var;/;
const tckn = seed => {
  const d = String(100000000 + ((seed * 7919) % 800000000)).slice(0, 9).split("").map(Number);
  if (d[0] === 0) d[0] = 1;
  const d10 = ((((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10) + 10) % 10;
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return [...d, d10, d11].join("");
};

async function setup() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true })).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
  const account = async body => {
    const created = await api.post("/api/workspace/accounts", body);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    return created.data.id;
  };
  const retail = await account({ name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Perakende", familyName: "Müşteri", taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const ayse = await account({ name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const firm = await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  const day = offset => new Date(Date.UTC(2026, 5, 17 + offset)).toISOString().slice(0, 10);
  const sale = async (accountId, extra = {}) => {
    const saved = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    return saved.data;
  };
  // Mükellef kayıt defteri doğrudan yazılır (5.000 sorgu ~40 sn sürerdi); biçim programın yazdığı biçim: { numara: zaman }.
  const seedRegistry = entries => server.app.store.setSetting("einvoice.taxpayers", JSON.stringify(entries));
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, server, api, retail, ayse, firm, day, sale, seedRegistry, close };
}

describe("gg243 dar kontrol 2: olderPending ve kayıt defteri maliyeti (B4)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B4 kural aynen: yalnız aynı seri + yıl, serinin son numaralısından eski (kalıcı engelli) ve alıcısı mükellef kayıtlı bekleyen sayılmaz", async () => {
    const ctx = await setup();
    open.push(ctx);
    // TEA serisi: bugün numaralı bir belge (son numara 10.06), sonra bekleyenler.
    const numbered = await ctx.sale(ctx.ayse, { issueDate: ctx.day(-7), eSend: "now" });
    assert.ok(numbered.number.startsWith("TEA"));
    // kalıcı engelli eski bekleyen: Kes, Sonra Gönder serinin son numaralısından eski tarihle artık kaydedilmez (B5); D4 düzeni: önce kaydet, sonra
    // yeni numara ver.
    const counted = [];
    for (let i = 0; i < 3; i += 1) counted.push(await ctx.sale(ctx.retail, { issueDate: ctx.day(-5), eSend: "later", buyer: { name: `Alıcı ${i}`, taxNo: tckn(i + 1) } }));
    // Kayıt defterinde mükellef görünen alıcı numaralı (kimliksiz cariye yazılmış) e-Arşiv bekleyen: kalıcı engel (buyer-is-efatura) → sayılmaz.
    const registered = vkn(400000001);
    const regDoc = await ctx.sale(ctx.retail, { issueDate: ctx.day(-4), eSend: "later", buyer: { name: "Firma", taxNo: registered } });
    // Başka seri (TEF) bekleyeni sayılmaz.
    await ctx.sale(ctx.firm, { issueDate: ctx.day(-4), eSend: "later" });
    const entries = { [registered]: "2026-06-01T00:00:00.000Z" };
    for (let i = 0; i < 50; i += 1) entries[vkn(500000000 + i)] = "2026-06-01T00:00:00.000Z";
    ctx.seedRegistry(entries);
    const held = await ctx.sale(ctx.ayse, { eSend: "now" });
    assert.equal(held.number, "", "numarasız bekletildi");
    assert.equal(held.autoSend?.code, "einvoice-order");
    assert.equal(Number(ORDER_RE.exec(held.autoSend.message)?.[1]), 3, held.autoSend.message);
    // Kayıt defterindeki alıcının kartı kalıcı engelini söyler (önbellekli kayıt defteri okunuyor).
    const regCard = (await ctx.api.get(`/api/workspace/invoices/${regDoc.id}`)).data;
    assert.equal(regCard.canSend, false);
    assert.match(regCard.sendBlock, /e-Fatura mükellefine ait/);
    // Kayıt defteri değişince (mükellef değil) önbellek yenilenir: o belge artık sayılır.
    ctx.seedRegistry({});
    const held2 = await ctx.sale(ctx.ayse, { eSend: "now" });
    assert.equal(Number(ORDER_RE.exec(held2.autoSend?.message || "")?.[1]), 4, `kayıt defteri boşalınca 3 + kayıt defterinden çıkan alıcı (aynı günün bekleyeni sayılmaz): ${held2.autoSend?.message}`);
  });

  test("B4 maliyet: Kaydet ve Gönder ve Tümünü Gönder süresi kayıt defterinin büyüklüğünden bağımsız (5.000 kayıt, 150 bekleyen)", async () => {
    const ctx = await setup();
    open.push(ctx);
    for (let i = 0; i < 150; i += 1) await ctx.sale(ctx.retail, { issueDate: ctx.day(-30 + Math.floor(i / 5)), eSend: "later", buyer: { name: `Alıcı ${i}`, taxNo: tckn(i + 1) } });
    const time = async fn => {
      const values = [];
      for (let i = 0; i < 5; i += 1) {
        const start = process.hrtime.bigint();
        const r = await fn();
        assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 200));
        values.push(Number(process.hrtime.bigint() - start) / 1e6);
      }
      return values.sort((a, b) => a - b)[2];
    };
    const save = () => ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ayse, lines: LINES, payment: { rest: "open" }, eSend: "now" });
    const list = () => ctx.api.get("/api/workspace/invoices?tab=pending");
    ctx.seedRegistry({});
    await save();
    const emptySave = await time(save);
    const emptyList = await time(list);
    const entries = {};
    for (let i = 0; i < 5000; i += 1) entries[vkn(300000000 + i)] = "2026-06-01T00:00:00.000Z";
    ctx.seedRegistry(entries);
    await save();
    const fullSave = await time(save);
    const fullList = await time(list);
    const report = `Kaydet ve Gönder p50: kayıt defteri boş ${emptySave.toFixed(1)} ms, 5.000 kayıt ${fullSave.toFixed(1)} ms; Gönderilecekler: ${emptyList.toFixed(1)} → ${fullList.toFixed(1)} ms`;
    console.log(report);
    assert.ok(fullSave < emptySave * 2 + 60, `Kaydet ve Gönder kayıt defterine bağlı kalmamalı — ${report}`);
    assert.ok(fullList < emptyList * 2 + 60, `Gönderilecekler kayıt defterine bağlı kalmamalı — ${report}`);
  });
});
