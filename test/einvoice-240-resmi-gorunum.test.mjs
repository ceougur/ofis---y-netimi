// Gönderilen e-Belgenin RESMÎ görüntüsü ve gönderilen belgedeki görünüm şablonu (kullanıcı kararı 16.10.2026: "önerini yap"). Sahte EDM
// (test/einvoice-mock.mjs) gerçek test ortamında görülen davranışı taşır: GetInvoice DIRECTION=OUT + INVOICE_CONTENT_TYPE=PDF → base64 PDF
// (docs/kanit/2026-10-16/edm-resmi-gorunum-*). Gerçek ağa çıkılmaz.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { embeddedXslt } from "../tools/ebelge/dogrula.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("Resmî e-Belge görüntüsü (sahte EDM)", () => {
  let edm;
  let server;
  let api;
  let client;
  let buyerId;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr", logo: LOGO },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const account = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    buyerId = account.data.id || account.data.account?.id;
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("gönderilmemiş belgede düğme yok ve uç 409; gönderilen belgede görünüm şablonu (logo dahil) EDM'ye gider", async () => {
    const issued = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(issued.status, 200, JSON.stringify(issued.data));
    assert.equal(issued.data.canOfficial, false);
    const early = await client.get(`/api/workspace/invoices/${issued.data.id}/resmi.pdf`);
    assert.equal(early.status, 409);
    assert.equal(early.data.code, "einvoice-not-sent");
    const sent = await api.post(`/api/workspace/invoices/${issued.data.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const xslt = embeddedXslt(edm.state.sent.at(-1).xml);
    assert.match(xslt, /<xsl:stylesheet version="1\.0"/, "gönderilen belgede şablon var");
    assert.ok(xslt.includes(LOGO), "şablonda logo var");
  });

  test("Resmî Görüntü: EDM'den PDF alınır; son hâldeki belgede veri klasörüne saklanır, ikinci açılış EDM'ye gitmez", async () => {
    const id = server.app.store.get("SELECT id FROM invoices WHERE number = ?", edm.state.sent.at(-1).id)?.id;
    assert.ok(id, "gönderilen fatura bulundu");
    let detail = (await api.get(`/api/workspace/invoices/${id}`)).data;
    for (let i = 0; i < 3 && detail.eStatus === "processing"; i += 1) detail = (await api.post(`/api/workspace/invoices/${id}/e-refresh`, {})).data;
    assert.equal(detail.eStatus, "sent");
    assert.equal(detail.canOfficial, true);
    const before = edm.state.pdfRequests || 0;
    const first = await client.raw("GET", `/api/workspace/invoices/${id}/resmi.pdf?inline=1`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("content-type"), "application/pdf");
    assert.equal(first.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(first.buffer.toString("latin1").includes(detail.number), "doğru belgenin görüntüsü");
    assert.equal(edm.state.pdfRequests, before + 1);
    const cacheDir = path.join(server.dataDir, "e-belge-gorunum");
    assert.ok(existsSync(path.join(cacheDir, `${detail.ettn}.pdf`)), "saklandı");
    assert.deepEqual(readdirSync(cacheDir).filter(name => name.endsWith(".tmp")), [], "yarım dosya kalmadı");
    const second = await client.raw("GET", `/api/workspace/invoices/${id}/resmi.pdf`);
    assert.equal(second.status, 200);
    assert.deepEqual(second.buffer, first.buffer);
    assert.equal(edm.state.pdfRequests, before + 1, "ikinci açılış saklanan dosyadan");
    const audits = server.app.store.all("SELECT entity_id AS id FROM audit_events WHERE type = 'invoice.e.official'");
    assert.ok(audits.length >= 2);
    assert.deepEqual(edm.state.violations, []);
  });

  test("fatura görme yetkisi olmayan kullanıcı resmî görüntüyü açamaz", async () => {
    const admin = server.client();
    assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
    const staff = await createUser(server, admin, { username: "resmigorunum", role: "personel" });
    const id = server.app.store.get("SELECT id FROM invoices WHERE e_status = 'sent' LIMIT 1").id;
    assert.equal((await staff.get(`/api/workspace/invoices/${id}/resmi.pdf`)).status, 403);
  });
});
