// 2.4.7 E4 (S4) KESİNTİ + YENİDEN AÇILIŞ: kullanım defterine yazım düşer (gönderim ve şirket izi yazıldı), program kapanır, aynı veri klasörüyle yeniden
// açılır → açılış aktarması eksik satırı tamamlar (okuma ucu artık bir şey eklemez); defter dosyası şirket veri dosyasının dışında. Sahte EDM, sahte saat.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { USAGE_LEDGER_FILE } from "../server/lib/einvoice/kullanim-defteri.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, removeTestDir, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" };
const dir = mkdtempSync(path.join(tmpdir(), "edoc-kesinti-247-"));
const dataDir = path.join(dir, "data");
let edm;
after(async () => {
  await edm?.close();
  removeTestDir(dir);
});

test("S4: deftere yazım düşer → yeniden açılışta izden tamamlanır; defter ana veri klasöründe ayrı dosya", async () => {
  resetEdmCaches();
  edm = await startMockEdm();
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const boot = async fault => {
    const server = await startTestServer({ dataDir, edocEnabled: true, fetchImpl, now: "2026-06-17T10:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...(fault ? { edocUsageFault: () => true } : {}) });
    const client = server.client();
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    return { server, api: { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) } };
  };
  const first = await boot(true);
  try {
    assert.equal((await first.api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
    const person = await first.api.post("/api/workspace/accounts", PERSON);
    const doc = (await first.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.data.id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" })).data;
    assert.ok(["sent", "processing", "accepted"].includes(doc.eStatus), JSON.stringify({ eStatus: doc.eStatus, message: doc.eMessage }));
  } finally {
    await first.server.close();
  }
  assert.ok(existsSync(path.join(dataDir, USAGE_LEDGER_FILE)), "defter ana veri klasöründe");
  const second = await boot(false);
  try {
    const read = (await second.api.get("/api/workspace/invoices-usage")).data;
    assert.equal(read.synced, 0, "açılış aktarması zaten tamamladı");
    assert.deepEqual(read.months, [{ month: "2026-06", env: "test", efatura: 0, earsiv: 1, esmm: 0 }]);
  } finally {
    await second.server.close();
  }
});
