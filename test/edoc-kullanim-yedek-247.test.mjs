// 2.4.7 E4 — kullanım defteri ve şirket yedeği (kullanıcı kararı 27.10.2026, kör nokta: defter dosyası yeniden kurulum / taşımada unutulur). Defterin o şirkete ait
// satırları her şirket yedeğine girer; geri yüklemede defter yalnız BİRLEŞTİRİLİR (eksik satır eklenir, var olan değişmez / silinmez).
// Nasıl bozulur: yedek → YENİ kurulum (boş defter, yedek klasörü taşındı) → geri yükle; aynı yedeği iki kez geri yükle; v2.4.6'nın GERÇEK koduyla (git etiketi)
// üretilmiş yedeği geri yükle; geri yükleme sayacı azaltır mı. Sahte EDM, sahte saat (ders 13), ağa çıkılmaz, lisans adresi yerel (ders 30).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { openDatabase } from "../server/lib/db.mjs";
import { USAGE_LEDGER_FILE } from "../server/lib/einvoice/kullanim-defteri.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";

const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" };
const NOW = "2026-06-17T10:00:00";
const ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const root = mkdtempSync(path.join(tmpdir(), "edoc-yedek-247-"));
const backupDir = path.join(root, "yedekler");
const dirOf = name => path.join(root, name);

describe("2.4.7 kullanım defteri: yedeğe girer, geri yüklemede yalnız birleşir", () => {
  let edm;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const boot = (version, dataDir) => bootVersion(version, { dataDir, backupDir, env: ENV, edocEnabled: true, fetchImpl, now: NOW, testSeriesStart: () => 1 });
  const usage = async api => (await api.get("/api/workspace/invoices-usage")).data;
  const earsivJune = rows => rows.find(row => row.month === "2026-06" && row.env === "test")?.earsiv || 0;
  async function sendTwo(api, start = 1) {
    assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, start: { TEA2026: start }, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
    const person = await api.post("/api/workspace/accounts", PERSON);
    assert.equal(person.status, 200, JSON.stringify(person.data));
    for (let i = 0; i < 2; i += 1) {
      const doc = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.data.id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500 + i, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
      assert.equal(doc.status, 200, JSON.stringify(doc.data));
      assert.ok(["sent", "processing", "accepted"].includes(doc.data.eStatus), JSON.stringify({ eStatus: doc.data.eStatus, message: doc.data.eMessage }));
    }
  }
  const backupOf = async api => {
    const made = await api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    return made.data.backups.find(item => item.companyId === "sirket-001").name;
  };
  // 001'in geri yüklemesi bir sonraki açılışta uygulanır (sunucu yeniden açılır): kapat → aynı klasörlerle aç.
  async function restoreInto(dataDir, name) {
    let server = await boot(CURRENT, dataDir);
    try {
      const api = await server.login();
      const staged = await api.post("/api/admin/backups/restore", { name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      assert.equal(staged.data.staged, true);
    } finally {
      await server.close();
    }
    server = await boot(CURRENT, dataDir);
    return server;
  }

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
  });
  after(async () => {
    await edm?.close();
    removeTestDir(root);
  });

  test("yedek → yeni kurulum (boş defter) → geri yükle → sayılar geri gelir; aynı yedek iki kez → çift yok", async () => {
    const first = await boot(CURRENT, dirOf("eski-kurulum"));
    let name;
    try {
      const api = await first.login();
      await sendTwo(api);
      assert.equal(earsivJune((await usage(api)).months), 2);
      name = await backupOf(api);
    } finally {
      await first.close();
    }
    const fresh = dirOf("yeni-kurulum");
    const empty = await boot(CURRENT, fresh);
    try {
      assert.deepEqual((await usage(await empty.login())).months, [], "yeni kurulumun defteri boş");
    } finally {
      await empty.close();
    }
    assert.ok(existsSync(path.join(fresh, USAGE_LEDGER_FILE)));
    let server = await restoreInto(fresh, name);
    try {
      const read = await usage(await server.login());
      assert.equal(earsivJune(read.months), 2, "defter yedekten geri kazanıldı");
      assert.equal(read.synced, 0, "açılış aktarması tamamladı");
    } finally {
      await server.close();
    }
    server = await restoreInto(fresh, name);
    try {
      assert.equal(earsivJune((await usage(await server.login())).months), 2, "aynı yedeği ikinci kez geri yüklemek çift saymaz");
    } finally {
      await server.close();
    }
  });

  test("geri yükleme sayacı azaltmaz: yedekten SONRA gönderilen belge, eski yedek geri yüklenince defterde kalır", async () => {
    const dataDir = dirOf("azalmaz");
    let server = await boot(CURRENT, dataDir);
    let name;
    try {
      const api = await server.login();
      await sendTwo(api, 500);
      name = await backupOf(api);
      const person = (await api.get("/api/workspace/accounts")).data;
      const id = (person.accounts || person.items || person).find(item => item.name === PERSON.name).id;
      const doc = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 777, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" });
      assert.equal(doc.status, 200, JSON.stringify(doc.data));
      assert.equal(earsivJune((await usage(api)).months), 3);
    } finally {
      await server.close();
    }
    server = await restoreInto(dataDir, name);
    try {
      const read = await usage(await server.login());
      assert.equal(earsivJune(read.months), 3, "defter 3 kalır");
      assert.equal(earsivJune(read.journal), 2, "şirket izi yedekteki gibi (2)");
    } finally {
      await server.close();
    }
  });

  test("defterde olup şirket izinde OLMAYAN satır (eski yedek geri yüklendikten sonra) yeni yedeğe girer; yeni kurulum onu da geri kazanır", async () => {
    // "azalmaz" testinin kurulumu: defter 3, şirket izi 2 (yedekten sonraki belgenin izi geri yüklemeyle gitti). Şimdi alınan yedek defterin 3 satırını taşımalı.
    const dataDir = dirOf("azalmaz");
    let name;
    let server = await boot(CURRENT, dataDir);
    try {
      const api = await server.login();
      const read = await usage(api);
      assert.equal(earsivJune(read.months), 3);
      assert.equal(earsivJune(read.journal), 2, "ön koşul: iz defterden eksik");
      name = await backupOf(api);
    } finally {
      await server.close();
    }
    const fresh = dirOf("tasinan-kurulum");
    server = await boot(CURRENT, fresh);
    await server.close();
    server = await restoreInto(fresh, name);
    try {
      const read = await usage(await server.login());
      assert.equal(earsivJune(read.months), 3, "yedek defterin 3 satırını taşıdı");
      assert.equal(earsivJune(read.journal), 2, "şirket izi yedekteki gibi; defter yedekteki defter kopyasından");
    } finally {
      await server.close();
    }
  });

  test("V15: 001'in yedeği defterin TAMAMINI taşır (002'nin satırları dahil); yeni kurulumda 001'i geri yüklemek 002'nin satırını da birleştirir", async () => {
    const source = await boot(CURRENT, dirOf("iki-sirket"));
    let name;
    let secondId;
    try {
      const api = await source.login();
      const created = await api.post("/api/companies", { name: "İkinci Büro", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      secondId = (created.data.company || created.data).id;
      const q = `?hofCompany=${encodeURIComponent(secondId)}`;
      const scoped = { get: url => api.get(`${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(secondId)}`), post: (url, body) => api.post(`${url}${q}`, body), put: (url, body) => api.put(`${url}${q}`, body) };
      await sendTwo(scoped, 700);
      assert.equal(earsivJune((await usage(scoped)).months), 2, "002'nin defter satırları");
      assert.deepEqual((await usage(api)).months, [], "001'de belge yok");
      name = await backupOf(api);
    } finally {
      await source.close();
    }
    const fresh = dirOf("v15-yeni");
    const server = await restoreInto(fresh, name);
    await server.close();
    const ledger = openDatabase(path.join(fresh, USAGE_LEDGER_FILE), { readOnly: true });
    try {
      const rows = ledger.prepare("SELECT company_id AS company, COUNT(*) AS n FROM usage GROUP BY company_id").all();
      assert.deepEqual(rows.map(row => [row.company, row.n]), [[secondId, 2]], "002'nin iki satırı yeni kurulumun defterinde");
    } finally {
      ledger.close();
    }
  });

  test("v2.4.6'nın GERÇEK koduyla üretilmiş yedek (iz tablosu yok) geri yüklenir; defter değişmez", { skip: !tagsAvailable(["v2.4.6"]) && "v2.4.6 etiketi yok (git fetch --tags)" }, async () => {
    const oldDir = dirOf("v246");
    const old = await bootVersion("v2.4.6", { dataDir: oldDir, backupDir, env: ENV, now: NOW });
    let name;
    try {
      const api = await old.login();
      const made = await api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(made.status, 200, JSON.stringify(made.data));
      name = made.data.backups.find(item => item.companyId === "sirket-001").name;
    } finally {
      await old.close();
    }
    const dataDir = dirOf("yeni-kurulum");
    let server = await boot(CURRENT, dataDir);
    let before;
    try {
      before = (await usage(await server.login())).months;
      assert.equal(earsivJune(before), 2, "önceki testin geri kazandığı defter");
    } finally {
      await server.close();
    }
    server = await restoreInto(dataDir, name);
    try {
      const read = await usage(await server.login());
      assert.deepEqual(read.months, before, "eski yedek defteri değiştirmez");
      assert.deepEqual(read.journal, [], "eski yedekte iz yok");
    } finally {
      await server.close();
    }
  });
});
