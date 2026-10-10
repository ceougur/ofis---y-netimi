// 2.0.11 düzeltmeleri: başlık yazımı, stok birimleri (göç 16), Taksitler'den toplu taksitlendirme (ön izleme, taksit
// durumu süzgeci, grup cari sayıları, kartın carinin grubunu alması) ve Veri Sağlığı "Yok say" (kalıcı, puana yansır).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { titleCase } from "../server/lib/text-case.mjs";
import { unitLabel } from "../server/lib/units.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
// İlk vade bugünden ileri (sabit tarih zamanla geçmişe düşüp "işlem tarihinden önce" diye reddediliyordu — 08.10.2026).
const soonDue = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const data = response => response.data.data;
const excel = (fileName, sheets) => ({ kind: "excel", fileName, sheets: Object.entries(sheets).map(([name, matrix]) => ({ name, matrix })) });
async function importExcel(admin, body, mode = "replace") {
  const staged = await admin.post("/api/workspace/dataset/stage", body);
  assert.equal(staged.status, 200, JSON.stringify(staged.data));
  const committed = await admin.post("/api/workspace/dataset/commit", { stageId: data(staged).stageId, mode });
  assert.equal(committed.status, 200, JSON.stringify(committed.data));
  return data(committed);
}

describe("başlık yazımı (madde 7)", () => {
  it("her sözcüğün ilk harfi büyük; bağlaçlar küçük, parantez içi aynen, Türkçe İ", () => {
    assert.equal(titleCase("Cari listesi ve bakiyeler"), "Cari Listesi ve Bakiyeler");
    assert.equal(titleCase("Tüm cari hareketleri"), "Tüm Cari Hareketleri");
    assert.equal(titleCase("Cari bazında tahsilat"), "Cari Bazında Tahsilat");
    assert.equal(titleCase("Taksit kartları"), "Taksit Kartları");
    assert.equal(titleCase("Personel raporu"), "Personel Raporu");
    assert.equal(titleCase("PDF indir"), "PDF İndir", "Türkçe büyük İ; kısaltma aynen");
    assert.equal(titleCase("ilk vade"), "İlk Vade");
    assert.equal(titleCase("Sheets bağlantısı ya da dosya yolu"), "Sheets Bağlantısı ya da Dosya Yolu");
    assert.equal(titleCase("Açık (portföyde / ödenecek)"), "Açık (portföyde / ödenecek)");
    assert.equal(titleCase("çek / senet no"), "Çek / Senet No");
    assert.equal(titleCase("ve ile başlayan"), "Ve ile Başlayan", "ilk sözcük bağlaç olsa da büyük");
  });
});

describe("stok birimleri (madde 5)", () => {
  it("tek yazım: ilk harf büyük, kısaltmalar dahil; eş biçimler; listede olmayan birim korunur", () => {
    assert.equal(unitLabel("adet"), "Adet");
    assert.equal(unitLabel("ADET"), "Adet");
    assert.equal(unitLabel("kg"), "Kg");
    assert.equal(unitLabel("KG"), "Kg");
    assert.equal(unitLabel("m2"), "M²");
    assert.equal(unitLabel("şişe"), "Şişe");
    assert.equal(unitLabel("ŞİŞE"), "Şişe");
    assert.equal(unitLabel("palet"), "Palet");
    assert.equal(unitLabel(""), "Adet");
  });
});

describe("2.0.11 tam yığın", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("göç 16 kayıtlı birimleri tek yazıma getirir; yeni ürün ve Excel yüklemesi aynı yazar", async () => {
    const store = server.app.store;
    const now = new Date().toISOString();
    store.run("INSERT INTO stock_items (id, code, name, unit, created_by, created_at, updated_at) VALUES ('s-old-1', '', 'Çay', 'adet', 'x', ?, ?), ('s-old-2', '', 'Su', 'ŞİŞE', 'x', ?, ?), ('s-old-3', '', 'Taş', 'palet', 'x', ?, ?)", now, now, now, now, now, now);
    MIGRATIONS.find(item => item.version === 16).up(store);
    assert.deepEqual(store.all("SELECT unit FROM stock_items WHERE id LIKE 's-old-%' ORDER BY id").map(row => row.unit), ["Adet", "Şişe", "Palet"]);
    const created = await admin.post("/api/workspace/stock", { name: "Şeker", unit: "kg", unitPrice: "40" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(data(created).unit, "Kg");
    const list = data(await admin.get("/api/workspace/stock"));
    assert.ok(list.items.every(item => item.unit === unitLabel(item.unit)), "listede tek yazım");
  });

  it("Taksitler: grupta cari sayısı, taksit durumu süzgeci, ön izleme hiçbir şey yazmaz, çift kart açılmaz", async () => {
    const make = async (name, groupName) => data(await admin.post("/api/workspace/accounts", { name, type: "customer", groupName }));
    const ali = await make("Ali Kaya", "42 C 0079");
    const ayse = await make("Ayşe Demir", "42 C 0079");
    const mehmet = await make("Mehmet Yıldız", "42 C 0079");
    await make("Zeynep Ak", "42 C 0348");
    await admin.post("/api/workspace/plans/groups", { name: "34 AB 111" });
    // Cariye tek kart: grup seçilmedi → carinin grubu alınır.
    const single = await admin.post("/api/workspace/plans", { name: "Mehmet Yıldız", accountId: mehmet.id, total: "9000", count: 3, firstDue: soonDue });
    assert.equal(single.status, 200, JSON.stringify(single.data));
    let groups = data(await admin.get("/api/workspace/plans/groups"));
    const g79 = groups.find(item => item.name === "42 C 0079");
    assert.deepEqual([g79.count, g79.accounts, g79.withoutPlan], [1, 3, 2], "1 kart, 3 cari, 2'sinin kartı yok");
    assert.deepEqual(["42 C 0348", "34 AB 111"].map(name => { const g = groups.find(item => item.name === name); return [g.count, g.accounts]; }), [[0, 1], [0, 0]]);
    const none = data(await admin.get(`/api/workspace/accounts?group=${g79.id}&plan=none`));
    assert.deepEqual(none.accounts.map(item => item.name).sort(), ["Ali Kaya", "Ayşe Demir"]);
    const has = data(await admin.get(`/api/workspace/accounts?group=${g79.id}&plan=has`));
    assert.deepEqual(has.accounts.map(item => item.name), ["Mehmet Yıldız"]);
    const count = async () => data(await admin.get("/api/workspace/plans?status=all")).plans.length;
    const before = await count();
    const body = { ids: [ali.id, ayse.id, mehmet.id], amountMode: "fixed", total: "12000", count: "4", firstDue: soonDue, everyMonths: "1", skipExisting: true };
    const preview = data(await admin.post("/api/workspace/accounts/bulk-plan", { ...body, dryRun: true }));
    assert.equal(preview.dryRun, true);
    assert.equal(preview.created, 2);
    assert.equal(preview.total, 24000);
    assert.deepEqual(preview.skipped.map(item => [item.name, item.reason]), [["Mehmet Yıldız", "Açık taksit kartı var"]]);
    assert.equal(await count(), before, "ön izleme kart açmaz");
    const done = data(await admin.post("/api/workspace/accounts/bulk-plan", body));
    assert.equal(done.created, 2);
    assert.equal(await count(), before + 2);
    groups = data(await admin.get("/api/workspace/plans/groups"));
    const after79 = groups.find(item => item.name === "42 C 0079");
    assert.deepEqual([after79.count, after79.accounts, after79.withoutPlan], [3, 3, 0]);
    // "Süzgeçteki hepsi" + yalnız kartı olmayanlar: kalan yok → ön izleme 0 kart.
    const again = await admin.post("/api/workspace/accounts/bulk-plan", { all: true, group: g79.id, plan: "none", amountMode: "fixed", total: "100", count: "1", firstDue: soonDue, dryRun: true });
    assert.equal(again.status, 400, "grupta kartsız cari kalmadı: seçim boş");
  });

  it("Veri Sağlığı: Yok say grubu ve tek kaydı puana ekler, kalıcıdır, yeni oturumda da korunur; Geri Al; yetki", async () => {
    const header = ["Öğrenci No", "Adı", "Soyadı", "Unvan", "Telefonu"];
    const matrix = [header];
    for (let i = 0; i < 20; i += 1) matrix.push([i < 15 ? String(20260100 + i) : "", `Ad${i}`, `Soyad${i}`, "Dr.", i % 7 === 3 ? "0532 12" : `0532 ${100 + i} 11 ${String(10 + i)}`]);
    await importExcel(admin, excel("rehber.xlsx", { "TÜM REHBER": matrix }));
    const quality = async (client = admin) => data(await client.get("/api/workspace/insight")).analysis.quality;
    const start = await quality();
    const ids = start.issues.map(issue => issue.id);
    assert.ok(ids.includes("empty-id") && ids.some(id => id.startsWith("invalid-phone")), JSON.stringify(ids));
    assert.ok(start.score < 100);
    assert.ok(start.issues.every(issue => !("keys" in issue)), "kayıt listeleri istemciye gitmez");
    const personel = await createUser(server, admin, { username: "personel211" });
    assert.equal((await personel.post("/api/workspace/insight/quality/ignore", { tab: "TÜM REHBER", id: "empty-id" })).status, 403, "yalnız veri yükleme yetkisi");
    // Tek kayıt: kimliği boş 5 kayıttan biri.
    const emptyId = start.issues.find(issue => issue.id === "empty-id");
    assert.equal(emptyId.count, 5);
    assert.match(emptyId.items[0].title, /^Ad\d+ Soyad\d+$/, "ad ve soyad kolonları birleşik kayıt adı");
    const one = await admin.post("/api/workspace/insight/quality/ignore", { tab: "TÜM REHBER", id: "empty-id", key: emptyId.items[0].key });
    assert.equal(one.status, 200, JSON.stringify(one.data));
    let now = await quality();
    assert.equal(now.issues.find(issue => issue.id === "empty-id").count, 4);
    assert.ok(now.score > start.score);
    // Grubun tamamı ve telefonlar.
    await admin.post("/api/workspace/insight/quality/ignore", { tab: "TÜM REHBER", id: "empty-id" });
    const phone = now.issues.find(issue => issue.id.startsWith("invalid-phone"));
    await admin.post("/api/workspace/insight/quality/ignore", { tab: "TÜM REHBER", id: phone.id });
    now = await quality();
    assert.equal(now.score, 100);
    assert.equal(now.level, "iyi");
    assert.equal(now.issues.length, 0);
    assert.equal(now.ignored.length, 2);
    assert.equal((await quality(personel)).score, 100, "tüm kullanıcılarda aynı");
    // İşlem geçmişi.
    const audit = data(await admin.get("/api/admin/audit?type=insight.quality.ignored"));
    assert.equal(audit.length, 3, "her yok sayma işlem geçmişinde");
    // Aynı dosya yeni oturuma yüklenir: yok saymalar korunur; yeni hatalı kayıt yine uyarır.
    matrix.push(["", "Yeni", "Kişi", "Dr.", "0532 99"]);
    await importExcel(admin, excel("rehber-2.xlsx", { "TÜM REHBER": matrix }), "session");
    now = await quality();
    assert.equal(now.issues.find(issue => issue.id === "empty-id")?.count, 1, "yalnız yeni kayıt uyarır");
    assert.equal(now.issues.find(issue => issue.id.startsWith("invalid-phone"))?.count, 1);
    assert.ok(now.score < 100 && now.score >= 90);
    // Geri Al.
    const signature = now.ignored.find(item => item.signature.endsWith("|empty-id")).signature;
    assert.equal((await admin.post("/api/workspace/insight/quality/restore", { signature })).status, 200);
    now = await quality();
    assert.equal(now.issues.find(issue => issue.id === "empty-id").count, 6, "geri alınınca hepsi yeniden uyarır");
  });
});
