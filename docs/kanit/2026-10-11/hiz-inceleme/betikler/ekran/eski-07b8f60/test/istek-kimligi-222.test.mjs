// 2.0.22 madde 5 (Excel denetimi bulgusu, 04.10.2026): aynı fatura isteği iki kez gelince iki fatura açılıyordu (ekrandaki
// çift tıklama korumalıydı; yük altında yanıt gecikince yeniden "Kaydet" ya da ağ tekrarı korumasızdı). Kural: aynı
// kullanıcının aynı istek kimliğiyle ikinci gönderimi yeni belge açmaz, ilk belgeyi döndürür; aynı kimlik farklı içerikle
// 409; kimliği farklı iki aynı içerikli fatura (gerçekten iki satış) serbest; yalnız başarılı sonuç saklanır.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { bodyHash, createIdempotency } from "../server/lib/idempotency.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const TODAY = new Date().toISOString().slice(0, 10);
const ID = suffix => `test-istek-${suffix}-0123456789abcdef`;

test("kütüphane: anahtar kullanıcıya ve işleme bağlı; içerik özeti alan sırasından ve onay bayraklarından bağımsız", () => {
  const store = createIdempotency();
  const a = { id: "u1" };
  const b = { id: "u2" };
  assert.equal(store.key(a, "invoice.create", ""), "", "kimliksiz istek korunmaz (eski davranış)");
  assert.throws(() => store.key(a, "invoice.create", "kısa"), /İstek kimliği geçerli değil/);
  assert.throws(() => store.key(a, "invoice.create", "<script>alert(1)</script>-xxxxxxxxxx"), /İstek kimliği geçerli değil/);
  const ka = store.key(a, "invoice.create", ID("k"));
  const kb = store.key(b, "invoice.create", ID("k"));
  assert.notEqual(ka, kb, "başka kullanıcının aynı kimliği ayrı anahtardır (sonuç sızmaz)");
  assert.equal(bodyHash({ x: 1, y: [1, 2], force: true }), bodyHash({ y: [1, 2], x: 1, cashForce: true }), "alan sırası ve onay bayrakları içerik sayılmaz");
  assert.notEqual(bodyHash({ x: 1 }), bodyHash({ x: 2 }));
  const hash = bodyHash({ x: 1 });
  assert.equal(store.lookup(ka, hash), null);
  store.remember(ka, hash, "inv-1");
  assert.deepEqual(store.lookup(ka, hash), { refId: "inv-1" });
  assert.equal(store.lookup(kb, hash), null);
  assert.throws(() => store.lookup(ka, bodyHash({ x: 2 })), error => error.status === 409 && error.extra?.code === "request-id-reused");
});

test("kütüphane: süre dolan ve sınırı aşan kimlik unutulur", () => {
  let clock = 0;
  const store = createIdempotency({ ttlMs: 1000, max: 3, now: () => clock });
  const user = { id: "u" };
  for (let i = 0; i < 5; i += 1) store.remember(store.key(user, "s", ID(`m${i}`)), "h", `r${i}`);
  assert.equal(store.size(), 3, "en çok 3");
  assert.equal(store.lookup(store.key(user, "s", ID("m0")), "h"), null, "en eskisi düştü");
  assert.deepEqual(store.lookup(store.key(user, "s", ID("m4")), "h"), { refId: "r4" });
  clock = 5000;
  assert.equal(store.lookup(store.key(user, "s", ID("m4")), "h"), null, "24 saat (burada 1 sn) sonra unutulur");
});

describe("fatura: aynı istek kimliğiyle ikinci gönderim ikinci fatura açmaz", () => {
  let server;
  let admin;
  let customer;
  let item;
  const sale = (extra = {}) => ({ scenario: "goods_sale", accountId: customer, issueDate: TODAY, lines: [{ itemId: item, qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, force: true, ...extra });
  const post = (body, requestId, client = admin) => client.post("/api/workspace/invoices", body, requestId ? { "x-hof-request": requestId } : undefined);
  const count = async () => unwrap(await admin.get("/api/workspace/invoices?tab=sale&limit=5000")).invoices.filter(doc => doc.status === "issued").length;
  const balance = async () => unwrap(await admin.get(`/api/workspace/accounts/${customer}`)).totals.balance;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    customer = unwrap(await admin.post("/api/workspace/accounts", { name: "Kimlik Müşterisi", type: "customer" })).id;
    item = unwrap(await admin.post("/api/workspace/stock", { name: "Kimlik Ürünü", code: "KML-1", unit: "Adet", unitPrice: 100, salePrice: 500 })).id;
  });
  after(async () => server.close());

  test("aynı kimlik iki kez → tek fatura, ikinci yanıt ilk faturayı döndürür (replayed); cari ve stok bir kez", async () => {
    const first = await post(sale(), ID("a1"));
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 200));
    const second = await post(sale(), ID("a1"));
    assert.equal(second.status, 200);
    assert.equal(unwrap(second).id, unwrap(first).id, "aynı fatura");
    assert.equal(unwrap(second).number, unwrap(first).number);
    assert.equal(unwrap(second).replayed, true, "yanıt bunun yineleme olduğunu söyler");
    assert.equal(await count(), 1);
    assert.equal(await balance(), 600, "cari borcu bir kez (500 + %20 KDV)");
    const stock = unwrap(await admin.get(`/api/workspace/stock/${item}`));
    assert.equal(stock.qty, -1, "stoktan bir kez düştü");
  });

  test("aynı anda iki istek (aynı kimlik) → tek fatura", async () => {
    const before = await count();
    const [x, y] = await Promise.all([post(sale(), ID("a2")), post(sale(), ID("a2"))]);
    assert.equal(x.status, 200);
    assert.equal(y.status, 200);
    assert.equal(unwrap(x).id, unwrap(y).id);
    assert.equal(await count(), before + 1);
  });

  test("kimliği farklı aynı içerikli iki fatura serbest (gerçekten iki satış); kimliksiz istek eskisi gibi", async () => {
    const before = await count();
    assert.equal((await post(sale(), ID("b1"))).status, 200);
    assert.equal((await post(sale(), ID("b2"))).status, 200);
    assert.equal((await post(sale())).status, 200);
    assert.equal((await post(sale())).status, 200);
    assert.equal(await count(), before + 4);
  });

  test("aynı kimlik farklı içerikle → 409, yeni fatura yok", async () => {
    const before = await count();
    assert.equal((await post(sale(), ID("c1"))).status, 200);
    const changed = await post(sale({ lines: [{ itemId: item, qty: 2, unitPrice: 500, vatRate: 20 }] }), ID("c1"));
    assert.equal(changed.status, 409);
    assert.equal(changed.data.code, "request-id-reused");
    assert.match(changed.data.error, /zaten kaydedildi/);
    assert.equal(await count(), before + 1);
  });

  test("reddedilen istek saklanmaz: aynı kimlikle düzeltilip yeniden gönderilince kaydedilir", async () => {
    const before = await count();
    const rejected = await post(sale({ issueDate: "2099-01-01" }), ID("d1"));
    assert.ok(rejected.status >= 400, `ileri tarih reddedildi (${rejected.status})`);
    const fixed = await post(sale(), ID("d1"));
    assert.equal(fixed.status, 200, JSON.stringify(fixed.data).slice(0, 200));
    assert.notEqual(unwrap(fixed).replayed, true);
    assert.equal(await count(), before + 1);
  });

  test("başka kullanıcı aynı kimliği gönderirse ilk kullanıcının faturası dönmez (kendi faturası açılır)", async () => {
    const other = await createUser(server, admin, { username: "muhasebe2", role: "muhasebe" });
    const mine = unwrap(await post(sale(), ID("e1")));
    const theirs = await post(sale(), ID("e1"), other);
    if (theirs.status === 200) assert.notEqual(unwrap(theirs).id, mine.id, "sonuç kullanıcılar arasında paylaşılmaz");
    else assert.equal(theirs.status, 403, "yetkisi yoksa 403 (sızma yok)");
  });

  test("biçimsiz kimlik 400; mutabakat sağlam", async () => {
    const bad = await post(sale(), "kötü kimlik; DROP TABLE");
    assert.equal(bad.status, 400);
    const integrity = unwrap(await admin.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 300));
  });
});
