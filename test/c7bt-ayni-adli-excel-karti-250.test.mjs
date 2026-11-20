// 2.5.0 Ç7b TAKSİT KÜÇÜK TURU — P7 (muhasebe sürücüsü bakımı 3; S219 = A, kullanıcı 20.11 11:29 son karar). Excel'den taksit kartı yüklemesinin yinelenen kart
// denetimi yalnız ada (ve gruba) bakıyordu: aynı adlı İKİNCİ kişinin kartı 'Aynı adla açık kart var' ile atlanıyor, o kişinin kartı ve borcu hiç açılmıyordu
// (v2.4.9'da da). S219 = A: satır yalnız AYNI KİŞİNİN açık kartı varsa atlanır; aynı kişi, programın Excel'den cariyi bulduğu kuralla (aynı ad + aynı telefon;
// telefonsuzsa aynı ad + aynı grup, tek eşleşme; tablodaki kayıt bağı) belirlenir; telefonu farklı aynı adlı kişinin kartı kendi carisiyle açılır; kişi kesin
// seçilemiyorsa satır atlanır, neden 'Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin'.
// ÖRNEK (sahte saat 08.10.2026): cariler Ahmet Yılmaz 0532 100 00 01 (C1) ve Ahmet Yılmaz 0532 100 00 02 (C2); Excel C1 3.000 + C2 2.000 → iki kart, C1 3.000 /
// C2 2.000 borç, defter 120 = 5.000 (eski kod: C2'nin satırı atlanır, 120 = 3.000). Aynı Excel ikinci kez → yeni kart 0, 120 değişmez.
// NASIL BOZARIM: denetimi yalnız ada geri döndürmek; telefonsuz belirsiz satırda kartı açmak (çift borç); telefonsuz eşleşmede grup koşulunu kaldırmak;
// kişiyi telefonsuz eşleştirmede gruba bakmadan seçmek; kilitli dönemde yinelenen kart nedenini kilit nedeninin önüne koymak.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const AMBIGUOUS = "Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin";
const HEAD = ["Ad Soyad", "Telefon", "Grup", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Kayıt Tarihi"];
const ROLES = { 0: "name", 1: "phone", 2: "group", 3: "total", 4: "count", 5: "firstDue", 6: "registered" };
const row = (name, phone, total, { group = "", registered = "" } = {}) => [name, phone, group, total, "2", "01.11.2026", registered];

describe("Ç7b P7 (S219 = A) — Excel taksit yüklemesinde aynı adlı iki kişi", () => {
  let ctx;
  let api;
  const load = async (rows, fileName = "taksit.xlsx") => must(`yükle ${fileName}`, api.post("/api/workspace/plans/import", { matrix: [HEAD, ...rows], headerAt: 0, roles: ROLES, linkRecords: false, fileName }));
  const account = async (name, phone = "") => (await must(`cari ${name}`, api.post("/api/workspace/accounts", { name, phone, type: "customer", registeredOn: "2026-10-01" }))).id;
  const cards = accountId => ctx.store.all("SELECT id, total FROM plans WHERE deleted_at IS NULL AND account_id = ? ORDER BY rowid", accountId);
  const balance = async accountId => Number((await must("cari kartı", api.get(`/api/workspace/accounts/${accountId}`))).totals.balance);
  const gl120 = async () => {
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    return Number(ledger.trial.accounts.find(item => item.code === "120")?.balance || 0);
  };
  const count = (sql, ...args) => ctx.store.get(sql, ...args).n;
  const reasons = report => report.skipped.map(item => item.reason);
  const integrity = async label => {
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(result.ok, true, `${label}: Mutabakat Testi bulgulu ${JSON.stringify(result.failures).slice(0, 600)}`);
  };
  before(async () => {
    ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = ctx.api;
  });
  after(() => ctx?.server.close());

  it("(1) iki ayrı cari aynı ad + farklı telefon: satır sırası iki yönde, her kişiye kendi kartı ve borcu", async () => {
    const c1 = await account("Ahmet Yılmaz", "0532 100 00 01");
    const c2 = await account("Ahmet Yılmaz", "0532 100 00 02");
    const before120 = await gl120();
    const report = await load([row("Ahmet Yılmaz", "0532 100 00 01", "3.000"), row("Ahmet Yılmaz", "0532 100 00 02", "2.000")], "c1-c2.xlsx");
    assert.deepEqual(reasons(report), [], `atlanan satır olmamalı: ${JSON.stringify(report.skipped)}`);
    assert.equal(report.created, 2);
    assert.equal(report.linked, 2, "iki kart da var olan carisine bağlandı");
    assert.deepEqual(cards(c1).map(item => item.total), [3000]);
    assert.deepEqual(cards(c2).map(item => item.total), [2000]);
    assert.equal(await balance(c1), 3000);
    assert.equal(await balance(c2), 2000);
    assert.equal(await gl120(), before120 + 5000, "defter 120: iki borç");
    // Ters sıra (ikinci çift): önce telefonu 02 olan.
    const d1 = await account("Mehmet Kaya", "0533 200 00 01");
    const d2 = await account("Mehmet Kaya", "0533 200 00 02");
    const reverse = await load([row("Mehmet Kaya", "0533 200 00 02", "1.500"), row("Mehmet Kaya", "0533 200 00 01", "2.500")], "d2-d1.xlsx");
    assert.deepEqual(reasons(reverse), []);
    assert.equal(reverse.created, 2);
    assert.deepEqual(cards(d1).map(item => item.total), [2500]);
    assert.deepEqual(cards(d2).map(item => item.total), [1500]);
    assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name IN ('Ahmet Yılmaz', 'Mehmet Kaya')"), 4, "yeni cari açılmadı");
    await integrity("(1)");
  });

  it("(2) aynı Excel ikinci kez: yeni kart 0, yeni cari 0, defter 120 değişmez; küçük harfle yazılmış ad da aynı kişi (yalnız ASCII harfler katlanır; I/ı ayrımı BİLİNEN SINIR)", async () => {
    const before120 = await gl120();
    const plansBefore = count("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL");
    const accountsBefore = count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
    const report = await load([row("Ahmet Yılmaz", "0532 100 00 01", "3.000"), row("ahmet yılmaz", "0532 100 00 02", "2.000")], "c1-c2-yine.xlsx");
    assert.equal(report.created, 0);
    assert.deepEqual(reasons(report), ["Aynı adla açık kart var", "Aynı adla açık kart var"]);
    assert.equal(count("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL"), plansBefore);
    assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL"), accountsBefore);
    assert.equal(await gl120(), before120);
  });

  it("(3) telefonsuz satır + aynı adlı iki (telefonlu) kişi: kişi kesin değil → atlanır, yeni neden; kart / cari / borç açılmaz", async () => {
    const before120 = await gl120();
    const accountsBefore = count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
    const report = await load([row("Ahmet Yılmaz", "", "4.000")], "telefonsuz.xlsx");
    assert.equal(report.created, 0);
    assert.deepEqual(reasons(report), [AMBIGUOUS]);
    assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL"), accountsBefore, "yeni cari açılmadı");
    assert.equal(await gl120(), before120, "borç yazılmadı");
  });

  it("(4) telefonlu satır + aynı adlı TELEFONSUZ carinin kartı: kişi kesin değil → atlanır (çift borç yok)", async () => {
    const lone = await account("Zehra Ak", "");
    await load([row("Zehra Ak", "", "1.000")], "zehra-telefonsuz.xlsx");
    assert.deepEqual(cards(lone).map(item => item.total), [1000], "telefonsuz satır tek telefonsuz cariye bağlandı");
    const before120 = await gl120();
    const report = await load([row("Zehra Ak", "0535 300 00 01", "1.000")], "zehra-telefonlu.xlsx");
    assert.equal(report.created, 0);
    assert.deepEqual(reasons(report), [AMBIGUOUS]);
    assert.equal(await gl120(), before120);
  });

  it("(5) aynı dosyada aynı kişi iki satır: ikinci satır atlanır; telefonu farklı üçüncü kişi yeni carisiyle açılır", async () => {
    const before120 = await gl120();
    const report = await load([row("Can Er", "0536 400 00 01", "600"), row("Can Er", "0536 400 00 01", "600"), row("Can Er", "0536 400 00 02", "900")], "can.xlsx");
    assert.equal(report.created, 2);
    assert.deepEqual(reasons(report), ["Aynı adla açık kart var"]);
    const accounts = ctx.store.all("SELECT id, phone FROM accounts WHERE deleted_at IS NULL AND name = 'Can Er' ORDER BY rowid");
    assert.equal(accounts.length, 2, "iki kişi, iki cari");
    assert.deepEqual(accounts.map(item => cards(item.id).map(card => card.total)), [[600], [900]]);
    assert.equal(await gl120(), before120 + 1500);
    await integrity("(5)");
  });

  it("(6) grup: telefonsuz satır yalnız aynı gruptaki telefonsuz cariyi bulur; başka gruptaki aynı adlı kart denetime girmez", async () => {
    const first = await load([row("Elif Su", "", "700", { group: "A Grubu" })], "elif-a.xlsx");
    assert.equal(first.created, 1);
    const elifA = ctx.store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = 'Elif Su'").id;
    // Aynı grupta yeniden → aynı kişi (telefonsuz + aynı grup, tek eşleşme).
    const again = await load([row("Elif Su", "", "700", { group: "A Grubu" })], "elif-a-yine.xlsx");
    assert.deepEqual(reasons(again), ["Aynı adla açık kart var"]);
    // Başka grupta: o gruptaki aynı adlı kart yok → bugünkü gibi açılır (grubu farklı telefonsuz cari eşleşmez → yeni cari).
    const other = await load([row("Elif Su", "", "800", { group: "B Grubu" })], "elif-b.xlsx");
    assert.equal(other.created, 1);
    assert.deepEqual(cards(elifA).map(item => item.total), [700]);
    // B grubunda telefonlu kişi + o gruptaki telefonsuz kart → kişi kesin değil.
    const phoned = await load([row("Elif Su", "0537 500 00 01", "900", { group: "B Grubu" })], "elif-b-telefon.xlsx");
    assert.deepEqual(reasons(phoned), [AMBIGUOUS]);
  });

  it("(7) telefonsuz satır + aynı adlı tek telefonsuz cari (aynı grup, kartsız) ve telefonlu başka kişinin kartı: kişi kesin → kendi carisiyle açılır", async () => {
    const phoned = await account("Ayşe Demir", "0538 600 00 01");
    await load([row("Ayşe Demir", "0538 600 00 01", "1.200")], "ayse-telefonlu.xlsx");
    const lone = await account("Ayşe Demir", "");
    const before120 = await gl120();
    const report = await load([row("Ayşe Demir", "", "800")], "ayse-telefonsuz.xlsx");
    assert.deepEqual(reasons(report), []);
    assert.equal(report.created, 1);
    assert.deepEqual(cards(lone).map(item => item.total), [800]);
    assert.deepEqual(cards(phoned).map(item => item.total), [1200]);
    assert.equal(await gl120(), before120 + 800);
  });

  it("(9) Geri Al: yalnız bu yüklemenin açtığı kart ve cari kalkar; önceden var olan aynı adlı carinin kartı ve borcu kalır", async () => {
    const g1 = await account("Burak Tan", "0541 800 00 01");
    const g2 = await account("Burak Tan", "0541 800 00 02");
    await load([row("Burak Tan", "0541 800 00 01", "1.000")], "burak-1.xlsx");
    const before120 = await gl120();
    const report = await load([row("Burak Tan", "0541 800 00 02", "2.000"), row("Burak Tan", "0541 800 00 03", "3.000")], "burak-2-3.xlsx");
    assert.deepEqual(reasons(report), []);
    assert.equal(report.created, 2);
    assert.equal(await gl120(), before120 + 5000);
    const fresh = ctx.store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND name = 'Burak Tan' AND phone = '0541 800 00 03'")?.id;
    assert.ok(fresh, "üçüncü kişiye yeni cari açıldı");
    await must("geri al", api.post(`/api/workspace/plans/imports/${report.importId}/undo`, {}));
    assert.deepEqual(cards(g1).map(item => item.total), [1000], "önceki kart kaldı");
    assert.deepEqual(cards(g2), [], "bu yüklemenin kartı kalktı");
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM accounts WHERE id = ?", g2).d, null, "önceden var olan cari silinmedi");
    assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND id = ?", fresh), 0, "yüklemenin açtığı cari kalktı");
    assert.equal(await balance(g1), 1000);
    assert.equal(await balance(g2), 0);
    assert.equal(await gl120(), before120);
    await integrity("(9)");
  });

  it("(10) kilitli dönem: aynı adlı ikinci kişinin satırı KİLİT nedeniyle atlanır, cari açılmaz; yükleme durmaz", async () => {
    const k1 = await account("Selim Kurt", "0542 900 00 01");
    await load([row("Selim Kurt", "0542 900 00 01", "1.000")], "selim-1.xlsx");
    assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })).status, 200);
    try {
      const accountsBefore = count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL");
      const report = await load([row("Selim Kurt", "0542 900 00 02", "2.000", { registered: "15.09.2026" }), row("Deniz Ay", "0543 000 00 01", "500")], "kilit.xlsx");
      assert.equal(report.created, 1, "kilitsiz satır açıldı");
      assert.equal(report.skipped.length, 1);
      assert.equal(report.skipped[0].row, 2);
      assert.match(report.skipped[0].reason, /kapatılmış \(kilitli\) dönemde/);
      assert.equal(count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL"), accountsBefore + 1, "yalnız Deniz Ay'ın carisi açıldı (kilitli satırın carisi geri alındı)");
      assert.deepEqual(cards(k1).map(item => item.total), [1000]);
    } finally {
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
  });
  it("(8) carisiz eski kart: kartın kendi telefonu aynıysa aynı kişi (atlanır), 7+ hane ve farklıysa başka kişi (açılır)", async () => {
    const owner = await account("Hakan Arı", "0539 700 00 01");
    await load([row("Hakan Arı", "0539 700 00 01", "500")], "hakan.xlsx");
    const [card] = cards(owner);
    // Eski sürümden kalma carisiz kart (göç öncesi): bağ ve carinin kendisi kaldırılmış gibi.
    ctx.db.prepare("UPDATE plans SET account_id = '', phone = '0539 700 00 01' WHERE id = ?").run(card.id);
    ctx.db.prepare("UPDATE accounts SET deleted_at = '2026-10-08T00:00:00.000Z' WHERE id = ?").run(owner);
    const same = await load([row("Hakan Arı", "0539 700 00 01", "500")], "hakan-yine.xlsx");
    assert.deepEqual(reasons(same), ["Aynı adla açık kart var"]);
    const other = await load([row("Hakan Arı", "0539 700 00 02", "650")], "hakan-baska.xlsx");
    assert.deepEqual(reasons(other), []);
    assert.equal(other.created, 1);
  });
});
