// 2.0.22 madde 3 (Excel denetimi bulgusu, 04.10.2026): Excel'den cari yüklemede Tür hücresinde "Müşteri/Tedarikçi"
// yazan satırlar sessizce Tedarikçi açılıyordu (ilk eşleşen kalıp). Kullanıcı kararı: yeni tür YOK; uyarı + eşleme seçimi.
// Kural: iki türü birden yazan ya da tanınmayan değer bir türe kendiliğinden atanmaz — ön izlemede değer listesi ve satır
// uyarısı; kullanıcı değer başına türü seçer (typeMap); seçmezse varsayılan tür yazılır ve satır numarasıyla raporlanır.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { classifyAccountType, parseAccountType } from "../server/lib/accounts.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

test("tür hücresi: tek tür tanınır; iki tür birden ve tanınmayan değer türe atanmaz", () => {
  assert.deepEqual(classifyAccountType("Müşteri"), { type: "customer", state: "ok" });
  assert.deepEqual(classifyAccountType("TEDARİKÇİ"), { type: "supplier", state: "ok" });
  assert.deepEqual(classifyAccountType("satıcı firma"), { type: "supplier", state: "ok" });
  assert.deepEqual(classifyAccountType("Personel"), { type: "other", state: "ok" });
  assert.equal(classifyAccountType("Müşteri/Tedarikçi").state, "ambiguous");
  assert.deepEqual(classifyAccountType("Alıcı - Satıcı").candidates.sort(), ["customer", "supplier"]);
  assert.equal(classifyAccountType("xyz").state, "unknown");
  assert.equal(classifyAccountType("  ").state, "empty");
  assert.equal(parseAccountType("Müşteri/Tedarikçi"), "", "eskiden 'supplier' dönüyordu (sessiz atama)");
  assert.equal(parseAccountType("Tedarikçi"), "supplier");
});

describe("Excel'den cari yükleme: Tür Değerleri", () => {
  let server;
  let admin;
  const header = ["Ad Soyad", "Telefon", "Tür", "Açılış Bakiyesi"];
  const file = suffix => [
    header,
    [`Ali Müşteri ${suffix}`, `0532000${suffix}01`, "Müşteri", "100"],
    [`Veli Tedarik ${suffix}`, `0532000${suffix}02`, "Tedarikçi", "100"],
    [`Hem Biri ${suffix}`, `0532000${suffix}03`, "Müşteri/Tedarikçi", "100"],
    [`Garip Tür ${suffix}`, `0532000${suffix}04`, "xyz", "100"],
    [`Boş Tür ${suffix}`, `0532000${suffix}05`, "", "100"],
  ];
  const roles = { 0: "name", 1: "phone", 2: "type", 3: "balance" };
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => server.close());
  const accountsNamed = async suffix => {
    const list = unwrap(await admin.get(`/api/workspace/accounts?status=all&limit=500&q=${encodeURIComponent(suffix)}`)).accounts;
    return Object.fromEntries(list.filter(item => item.name.endsWith(` ${suffix}`)).map(item => [item.name.replace(` ${suffix}`, ""), item]));
  };

  test("ön izleme: Tür kolonundaki değerler, programın okuması ve belirsiz satırlar için uyarı", async () => {
    const preview = unwrap(await admin.post("/api/workspace/accounts/import/preview", { matrix: file("11"), roles }));
    const byValue = Object.fromEntries(preview.types.map(item => [item.value, item]));
    assert.deepEqual(Object.keys(byValue).sort(), ["Müşteri", "Müşteri/Tedarikçi", "Tedarikçi", "xyz"]);
    assert.deepEqual([byValue["Müşteri"].state, byValue["Müşteri"].type], ["ok", "customer"]);
    assert.deepEqual([byValue["Tedarikçi"].state, byValue["Tedarikçi"].type], ["ok", "supplier"]);
    assert.equal(byValue["Müşteri/Tedarikçi"].state, "ambiguous");
    assert.equal(byValue.xyz.state, "unknown");
    const typeIssues = preview.gate.issues.filter(issue => issue.column === "Tür");
    assert.deepEqual(typeIssues.map(issue => [issue.row, issue.level, issue.value]), [[4, "warning", "Müşteri/Tedarikçi"], [5, "warning", "xyz"]]);
    // Değer başına seçim yapılınca o değerin uyarısı kalkar.
    const chosen = unwrap(await admin.post("/api/workspace/accounts/import/preview", { matrix: file("11"), roles, typeMap: { "Müşteri/Tedarikçi": "supplier" } }));
    assert.deepEqual(chosen.gate.issues.filter(issue => issue.column === "Tür").map(issue => issue.row), [5]);
    // Tür kolonu eşlenmemişse değer listesi boş.
    const none = unwrap(await admin.post("/api/workspace/accounts/import/preview", { matrix: file("11"), roles: { 0: "name", 1: "phone" } }));
    assert.deepEqual(none.types, []);
  });

  test("seçim yapılmadan yükleme: belirsiz satırlar varsayılan türle açılır ve satır numarasıyla raporlanır (sessiz Tedarikçi yok)", async () => {
    const result = unwrap(await admin.post("/api/workspace/accounts/import", { matrix: file("22"), headerAt: 0, roles, type: "customer", mode: "skip", openingSide: "auto" }));
    assert.equal(result.created, 5);
    assert.equal(result.typeDefaultedTotal, 2);
    assert.deepEqual(result.typeDefaulted.map(item => [item.row, item.value, item.reason, item.type]), [[4, "Müşteri/Tedarikçi", "İki tür birden", "customer"], [5, "xyz", "Tanınmadı", "customer"]]);
    const accounts = await accountsNamed("22");
    assert.equal(accounts["Ali Müşteri"].type, "customer");
    assert.equal(accounts["Veli Tedarik"].type, "supplier");
    assert.equal(accounts["Hem Biri"].type, "customer", "eskiden sessizce Tedarikçi açılıyordu");
    assert.equal(accounts["Garip Tür"].type, "customer");
    assert.equal(accounts["Boş Tür"].type, "customer", "boş hücre varsayılan tür (uyarısız)");
    // Açılış bakiyesinin yönü türe göre: müşteride artı tutar Borçlu, tedarikçide Alacaklı.
    assert.equal(accounts["Hem Biri"].balance, 100);
    assert.equal(accounts["Veli Tedarik"].balance, -100);
    // Aynı dosya "Atla" ile yeniden yüklenince açılan cari yok → tür uyarısı da yok.
    const again = unwrap(await admin.post("/api/workspace/accounts/import", { matrix: file("22"), headerAt: 0, roles, type: "customer", mode: "skip" }));
    assert.equal(again.created, 0);
    assert.equal(again.typeDefaultedTotal, 0);
  });

  test("değer başına seçim (typeMap): seçilen türle açılır, açılış bakiyesi o türe göre", async () => {
    const result = unwrap(await admin.post("/api/workspace/accounts/import", { matrix: file("33"), headerAt: 0, roles, type: "customer", typeMap: { "Müşteri/Tedarikçi": "supplier", xyz: "other", Müşteri: "bilinmeyen-tür" }, mode: "skip", openingSide: "auto" }));
    assert.equal(result.created, 5);
    assert.equal(result.typeDefaultedTotal, 0);
    const accounts = await accountsNamed("33");
    assert.equal(accounts["Hem Biri"].type, "supplier");
    assert.equal(accounts["Hem Biri"].balance, -100, "tedarikçide artı açılış Alacaklı");
    assert.equal(accounts["Garip Tür"].type, "other");
    assert.equal(accounts["Ali Müşteri"].type, "customer", "geçersiz tür seçimi yok sayılır, hücre okunur");
    // Mutabakat bozulmadı.
    const integrity = unwrap(await admin.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 300));
  });
});
