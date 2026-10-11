// 2.1.0 — Aşama 2, Dilim 2: kalıcı istek kimliği (docs/BANKA-MODULU-PLAN.md §3.10/1, §5.2 request_keys, §9.2/12).
// 2.0.22'de istek kimliği süreç belleğindeydi (24 saat, 5.000 kimlik): sunucu yeniden başlayınca unutuluyordu (bilinen sınır).
// Şimdi şirketin veri tabanında (request_keys), yazımla AYNI işlemde: belge yazıldıysa kimlik de yazılmıştır, biri geri alınırsa
// ikisi birden. 30 günden eskiler unutulur ve budanır.
//
// ÇALIŞIYOR MU
//  - Aynı kimlik + aynı gövde → ilk yanıt (replayed), ikinci belge yok; sunucu yeniden başlasa da.
//  - Taslak da aynı kural; kimliği farklı aynı içerikli iki fatura serbest; başka kullanıcının aynı kimliği ayrı anahtar.
//
// NASIL BOZARIM
//  - Aynı kimlik + farklı gövde (yeniden başlatmadan sonra da) → 409 request-id-reused, yeni belge yok.
//  - Kimlik kaydı yazılamazsa (veri tabanı reddeder) → belge de yazılmaz (aynı işlem; yarım kayıt yok).
//  - Reddedilen istek (ileri tarih) kimlik kaydı bırakmaz; düzeltilip aynı kimlikle gönderilince kaydedilir.
//  - 31 gün sonra aynı kimlik → unutulmuş (yeni belge) ve eski kayıt budanmış; 29 gün sonra → hâlâ hatırlanır.
//  - Biçimsiz kimlik → 400. Aynı anda iki istek (aynı kimlik) → tek belge.
//  - Şirket ayrımı: 001'de kullanılan kimlik 002'de ayrı (her şirketin kendi veri tabanı).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const ID = suffix => `banka-210-istek-${suffix}-0123456789`;
const NOW = "2026-10-08T12:00:00+03:00";

describe("kalıcı istek kimliği (fatura)", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "banka-210-istek-"));
  let server;
  let admin;
  let customer;
  const sale = (extra = {}) => ({ scenario: "service_sale", accountId: customer, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, ...extra });
  const post = (body, requestId, client = admin) => client.post("/api/workspace/invoices", body, requestId ? { "x-hof-request": requestId } : undefined);
  const issued = async () => unwrap(await admin.get("/api/workspace/invoices?tab=all&limit=5000")).invoices.filter(doc => doc.status !== "draft").length;
  const keys = () => server.app.store.get("SELECT COUNT(*) AS n FROM request_keys").n;
  const boot = async () => {
    server = await startTestServer({ dataDir, now: { time: NOW } });
    admin = await loginAdmin(server);
  };
  before(async () => {
    await boot();
    customer = unwrap(await admin.post("/api/workspace/accounts", { name: "İstek Carisi", type: "customer", registeredOn: "2026-10-01" })).id;
  });
  after(async () => {
    await server?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("kimlik veri tabanında, yazımla aynı işlemde: kullanıcı | işlem | kimlik, içerik özeti ve belge", async () => {
    const first = await post(sale(), ID("a"));
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 200));
    const row = server.app.store.get("SELECT key, scope, user_id AS userId, body_hash AS hash, ref_id AS refId, created_at AS createdAt FROM request_keys WHERE ref_id = ?", unwrap(first).id);
    assert.ok(row, "istek kimliği kaydı yok");
    assert.equal(row.scope, "invoice.create");
    assert.match(row.key, new RegExp(`\\|invoice\\.create\\|${ID("a")}$`));
    assert.match(row.hash, /^[0-9a-f]{64}$/);
    assert.equal(row.createdAt.slice(0, 10), "2026-10-08", "zaman damgası iş saatinden");
  });

  it("sunucu yeniden başlasa da aynı kimlik + aynı gövde → ilk belge (replayed); farklı gövde → 409", async () => {
    const before = await issued();
    const original = unwrap(await post(sale(), ID("b")));
    await server.close();
    await boot();
    const again = await post(sale(), ID("b"));
    assert.equal(again.status, 200);
    assert.equal(unwrap(again).id, original.id, "yeniden başlatmadan sonra aynı belge");
    assert.equal(unwrap(again).replayed, true);
    const changed = await post(sale({ lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }] }), ID("b"));
    assert.equal(changed.status, 409);
    assert.equal(changed.data.code, "request-id-reused");
    assert.equal(await issued(), before + 1, "tek belge");
  });

  it("taslak da kalıcı: taslağın yanıtı kaybolup yeniden gönderilince ikinci taslak açılmaz", async () => {
    const draft = unwrap(await post(sale({ status: "draft" }), ID("c")));
    await server.close();
    await boot();
    const again = await post(sale({ status: "draft" }), ID("c"));
    assert.equal(again.status, 200);
    assert.equal(unwrap(again).id, draft.id);
  });

  it("kimlik kaydı yazılamazsa belge de yazılmaz (aynı işlem)", async () => {
    const before = await issued();
    const db = server.app.db;
    db.exec("CREATE TEMP TRIGGER banka210_istek_reddet BEFORE INSERT ON request_keys BEGIN SELECT RAISE(ABORT, 'istek kimligi yazilamadi (test)'); END;");
    try {
      const failed = await post(sale(), ID("d"));
      assert.ok(failed.status >= 500, `kimlik yazılamayınca istek başarısız olmalı (${failed.status})`);
    } finally {
      db.exec("DROP TRIGGER IF EXISTS temp.banka210_istek_reddet");
    }
    assert.equal(await issued(), before, "belge yazılmamalı (kimlikle aynı işlemde geri alındı)");
    const retry = await post(sale(), ID("d"));
    assert.equal(retry.status, 200);
    assert.notEqual(unwrap(retry).replayed, true);
    assert.equal(await issued(), before + 1);
  });

  it("reddedilen istek kimlik kaydı bırakmaz; düzeltilip aynı kimlikle gönderilince kaydedilir", async () => {
    const before = keys();
    const rejected = await post(sale({ issueDate: "2026-12-31" }), ID("e"));
    assert.ok(rejected.status >= 400 && rejected.status < 500, `ileri tarih reddedilmeli (${rejected.status})`);
    assert.equal(keys(), before, "reddedilen isteğin kimliği yazılmadı");
    const fixed = await post(sale(), ID("e"));
    assert.equal(fixed.status, 200);
    assert.notEqual(unwrap(fixed).replayed, true);
  });

  it("aynı anda iki istek (aynı kimlik) → tek belge; biçimsiz kimlik 400", async () => {
    const before = await issued();
    const [x, y] = await Promise.all([post(sale(), ID("f")), post(sale(), ID("f"))]);
    assert.equal(x.status, 200);
    assert.equal(y.status, 200);
    assert.equal(unwrap(x).id, unwrap(y).id);
    assert.equal(await issued(), before + 1);
    assert.equal((await post(sale(), "kisa")).status, 400, "16 karakterden kısa");
    assert.equal((await post(sale({ requestId: "kötü kimlik; DROP TABLE request_keys" }))).status, 400, "izinsiz karakter (gövdede)");
  });

  it("başka kullanıcının aynı kimliği ayrı anahtardır (sonuç sızmaz)", async () => {
    const other = await createUser(server, admin, { username: "muhasebe210", role: "muhasebe" });
    const mine = unwrap(await post(sale(), ID("g")));
    const theirs = await post(sale(), ID("g"), other);
    assert.equal(theirs.status, 200);
    assert.notEqual(unwrap(theirs).id, mine.id);
    assert.notEqual(unwrap(theirs).replayed, true);
  });

  it("30 gün: 29 gün sonra hâlâ hatırlanır; 31 gün sonra unutulur (yeni belge) ve eski kayıt budanır", async () => {
    const first = unwrap(await post(sale(), ID("h")));
    server.clock.advance({ days: 29 });
    const still = await post(sale(), ID("h"));
    assert.equal(unwrap(still).id, first.id, "29. gün hatırlanır");
    assert.equal(unwrap(still).replayed, true);
    server.clock.advance({ days: 2 });
    const forgotten = await post(sale(), ID("h"));
    assert.equal(forgotten.status, 200);
    assert.notEqual(unwrap(forgotten).id, first.id, "31. gün unutulmuş: yeni belge");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM request_keys WHERE created_at < ?", new Date(server.clock.ms() - 30 * 86_400_000).toISOString()).n, 0, "30 günden eski kayıtlar budandı");
  });
});

describe("kalıcı istek kimliği: şirketler ayrı", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
  });
  after(async () => server?.close());

  it("001'de kullanılan kimlik 002'de ayrıdır (her şirketin kendi veri tabanı)", async () => {
    const created = unwrap(await admin.post("/api/companies", { code: "002", name: "İkinci Şirket" }));
    const companyB = created.company.id;
    const invoiceIn = async () => {
      const account = unwrap(await admin.post("/api/workspace/accounts", { name: "Ortak Ad", type: "customer", registeredOn: "2026-10-01" })).id;
      return admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }, { "x-hof-request": ID("sirket") });
    };
    const a = await invoiceIn();
    assert.equal(a.status, 200);
    assert.equal((await admin.post("/api/companies/select", { id: companyB })).status, 200);
    const b = await invoiceIn();
    assert.equal(b.status, 200, JSON.stringify(b.data).slice(0, 200));
    assert.notEqual(unwrap(b).replayed, true, "002'de yeni belge");
    assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
    void ADMIN_PASSWORD;
  });
});
