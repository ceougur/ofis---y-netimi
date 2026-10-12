// İz 1.3 (2.2.0 iş listesi; K6, hakem 10.10.2026 "KASA-ACILIS-649"): Kasa'ya devreden (açılış) nakit 649'a (Diğer Olağan Gelir) yazılıyordu;
// açılış gelir değildir. Plan susuyor → yaygın muhasebe (Tekdüzen açılış fişi): B 100 Kasa / A 500 "Açılış ve Devir Bakiyeleri" — banka
// hesabının açılışı (lib/bank/voucher.mjs openingLines: B 102.k / A 500), cari açılışı ve taksit açılışı (general-ledger.mjs) ile AYNI karşı
// hesap. Kasa'da "Açılış Bakiyesi" yolu: yalnız yönetici, bir kez, tarihli (ilk Kasa hareketinden sonra olamaz — banka açılışı kuralı),
// sonradan düzeltilir, dönem kilidine uyar. Açıklaması "Açılış" ile başlayan Kasa girişi açılış sayılır (cari açılışıyla aynı kural; bağımsız
// kâhinin koşucusu Kasa açılışını böyle girer — SENARYO-DILI §4.8).
//
// NASIL BOZARIM:
//   1. Açılış yine 649'a (gelir) yazılır; 500 boş kalır; mizan dengesi bozulur.
//   2. Elle "Açılış Bakiyesi" açıklamasıyla girilen Kasa girişi (eski yol, kâhinin yolu) 649'da kalır.
//   3. Sıradan Kasa girişi ("Ortaktan Nakit") yanlışlıkla 500'e kayar.
//   4. Açılış iki kez girilir (Açılış Bakiyesi düğmesi + elle "Açılış …" girişi ya da iki elle giriş).
//   5. Yönetici olmayan (Kasa yetkili muhasebe) açılış girer, düzeltir, siler ya da sıradan girişi "Açılış …" yapıp açılışa çevirir.
//   6. Açılış, Kasa'nın ilk hareketinden SONRAKİ bir tarihe girilir/düzeltilir (açılış o günün başındaki nakittir).
//   7. İleri tarihli ya da kilitli dönemdeki açılış girilir; kilitli dönemdeki açılış düzeltilir.
//   8. Düzeltme yeni satır açar (iki açılış) ya da Kasa'yı uyarısız eksiye düşürür.
//   9. Silinen açılış, yerine yenisi girildikten sonra Silinenler'den geri yüklenir (iki açılış) ya da yönetici olmayan geri yükler.
//  10. Mutabakat Testi / Ana Defter mutabakatı açılıştan sonra bozulur; Kasa bakiyesi açılışı saymaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const pad = value => String(value).padStart(2, "0");
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const refused = async (label, promise, status, code) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  if (code) assert.equal(res.code, code, `${label}: kod ${res.code}`);
  return res;
};
// Mizan: hesap kodu → bakiye (TL, borç +). Denge ve Mutabakat Testi her çağrıda denetlenir.
const trialOf = async api => {
  const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
  const rows = ledger.trial.accounts;
  const debit = rows.reduce((sum, row) => sum + Math.round((row.debit || 0) * 100), 0);
  const credit = rows.reduce((sum, row) => sum + Math.round((row.credit || 0) * 100), 0);
  assert.equal(debit, credit, "mizan dengeli (borç = alacak)");
  assert.ok(ledger.reconciliation.ok !== false, `Defter Mutabakatı: ${JSON.stringify(ledger.reconciliation).slice(0, 400)}`);
  const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  assert.equal(integrity.ok, true, `Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
  return Object.fromEntries(rows.map(row => [String(row.code), Math.round(row.balance * 100) / 100]));
};
const cashBalance = async api => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;
const openingRows = async api => (await must("Kasa", api.get("/api/workspace/cash?method=all"))).entries.filter(entry => entry.source === "manual" && /^açılış/i.test(entry.description || ""));

describe("İz 1.3 — elle 'Açılış Bakiyesi' Kasa girişi (kâhinin yolu) ve sıradan giriş", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
  });
  after(() => server?.close());

  it("2, 3: elle 'Açılış Bakiyesi' B 100 / A 500 (649 değil); sıradan giriş 649'da kalır; Mutabakat Testi tamam", async () => {
    await must("açılış (elle)", api.post("/api/workspace/cash", { kind: "in", amount: "49.505", date: day(-5), description: "Açılış Bakiyesi", method: "cash" }));
    let trial = await trialOf(api);
    assert.equal(trial["100"], 49505, "100 Kasa");
    assert.equal(trial["500"], -49505, "500 Açılış ve Devir Bakiyeleri (alacak)");
    assert.equal(trial["649"] || 0, 0, "649'a gelir yazılmaz");
    await must("sıradan giriş", api.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: day(-2), description: "Ortaktan Nakit" }));
    trial = await trialOf(api);
    assert.equal(trial["649"], -1000, "sıradan Kasa girişi 649'da");
    assert.equal(trial["500"], -49505, "500 değişmez");
    assert.equal(await cashBalance(api), 50505, "Kasa bakiyesi açılışı sayar");
    const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
    assert.ok(ledger.trial.accounts.some(row => String(row.code) === "500" && row.name === "Açılış ve Devir Bakiyeleri"), "500'ün adı");
  });

  it("4: ikinci açılış girilemez (elle de, düğmeyle de yenisi açılmaz; düğme var olanı düzeltir)", async () => {
    await refused("ikinci elle açılış", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: day(-6), description: "açılış nakdi" }), 409, "cash-opening-exists");
    const state = await must("açılış durumu", api.get("/api/workspace/cash/opening"));
    assert.equal(state.opening?.amount, 49505, "var olan açılış görünür");
    assert.equal(state.canManage, true);
    await must("düğmeyle düzelt", api.post("/api/workspace/cash/opening", { amount: "48.000", date: day(-5) }));
    assert.equal((await openingRows(api)).length, 1, "tek açılış satırı");
    assert.equal((await trialOf(api))["500"], -48000, "500 düzeltildi");
  });
});

describe("İz 1.3 — Kasa → Açılış Bakiyesi (yalnız yönetici, bir kez, tarih, kilit, eksi bakiye, silme/geri yükleme)", () => {
  let server;
  let admin;
  let staff;
  let lawyer;
  before(async () => {
    server = await startTestServer();
    const client = await loginAdmin(server);
    admin = apiOf(client);
    staff = apiOf(await createUser(server, client, { username: "muhasebe1", role: "muhasebe", password: "Muhasebe-2026!" }));
    // Avukat: Kasa yetkili ve Silinenler'den geri yükleyebilir (records.delete), yönetici değil.
    lawyer = apiOf(await createUser(server, client, { username: "avukat1", role: "avukat", password: "Avukat-2026!" }));
  });
  after(() => server?.close());

  it("1, 5, 10: yönetici girer → B 100 / A 500; Kasa'da açılış satırı; muhasebe göremez değil ama giremez/düzeltemez/silemez", async () => {
    const empty = await must("açılış durumu (boş)", admin.get("/api/workspace/cash/opening"));
    assert.equal(empty.opening, null);
    assert.equal(empty.firstMovement, "", "henüz Kasa hareketi yok");
    const created = await must("açılış", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-10) }));
    assert.equal(created.created, true);
    const trial = await trialOf(admin);
    assert.equal(trial["100"], 20000);
    assert.equal(trial["500"], -20000);
    assert.equal(trial["649"] || 0, 0);
    const rows = await openingRows(admin);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].description, "Açılış Bakiyesi");
    assert.equal(rows[0].opening, true, "satırda açılış işareti (Kasa penceresi)");
    const seen = (await must("muhasebe Kasa", staff.get("/api/workspace/cash"))).entries.find(entry => entry.id === rows[0].id);
    assert.ok(seen && seen.editable === false, "muhasebe için açılış satırı düzenlenemez");
    assert.equal((await must("muhasebe durum", staff.get("/api/workspace/cash/opening"))).canManage, false);
    await refused("muhasebe açılış", staff.post("/api/workspace/cash/opening", { amount: "5", date: day(-10) }), 403);
    await refused("muhasebe elle açılış", staff.post("/api/workspace/cash", { kind: "in", amount: "5", date: day(-10), description: "Açılış devri" }), 403, "cash-opening-admin");
    await refused("muhasebe açılışı düzeltir", staff.put(`/api/workspace/cash/${rows[0].id}`, { kind: "in", amount: "1", date: day(-10), description: "Açılış Bakiyesi" }), 403, "cash-opening-admin");
    await refused("muhasebe açılışı açılış olmaktan çıkarır", staff.put(`/api/workspace/cash/${rows[0].id}`, { kind: "in", amount: "20.000", date: day(-10), description: "Ortaktan" }), 403, "cash-opening-admin");
    await refused("muhasebe açılışı siler", staff.del(`/api/workspace/cash/${rows[0].id}`), 403, "cash-opening-admin");
    const normal = await must("muhasebe sıradan giriş", staff.post("/api/workspace/cash", { kind: "in", amount: "300", date: day(-8), description: "Danışmanlık" }));
    await refused("muhasebe sıradan girişi açılışa çevirir", staff.put(`/api/workspace/cash/${normal.id}`, { kind: "in", amount: "300", date: day(-8), description: "Açılış ek" }), 403, "cash-opening-admin");
    assert.equal(await cashBalance(admin), 20300);
    assert.equal((await trialOf(admin))["500"], -20000, "reddedilen istekler hiçbir şey yazmadı");
  });

  it("6, 7: ilk hareketten (−8) sonraki tarihe açılış/düzeltme 409; ileri tarih 400; kilitli dönemde 409", async () => {
    const state = await must("durum", admin.get("/api/workspace/cash/opening"));
    assert.equal(state.firstMovement, day(-8), "ilk Kasa hareketi (açılış hariç)");
    await refused("ilk hareketten sonra düzeltme", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-7) }), 409, "cash-opening-after-first");
    await refused("ileri tarih", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(3) }), 400, "date-future");
    await must("aynı gün (ilk hareketle) olur", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-8) }));
    // Açılış o günün başındaki nakittir: aynı günün öbür hareketlerinden önce listelenir, yürüyen bakiye açılışla başlar.
    const sameDay = (await must("Kasa", admin.get("/api/workspace/cash?method=all"))).entries.filter(entry => entry.date === day(-8));
    assert.deepEqual(sameDay.map(entry => [entry.description, entry.balance]), [["Açılış Bakiyesi", 20000], ["Danışmanlık", 20300]], "aynı günde önce açılış");
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: day(-9) }));
    await refused("kilitli güne açılış", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-9) }), 409, "period-locked");
    await must("kilit kalkar", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await must("eski güne geri", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-10) }));
    await must("kilit (açılış kilitte)", admin.put("/api/admin/period-lock", { lockedUntil: day(-9) }));
    await refused("kilitli açılış düzeltilemez", admin.post("/api/workspace/cash/opening", { amount: "21.000", date: day(-8) }), 409, "period-locked");
    await must("kilit kalkar", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    assert.equal((await openingRows(admin)).length, 1, "hep tek açılış satırı");
  });

  it("8: açılışı düşürmek Kasa'yı eksiye düşürecekse sorulur (cash-negative), onayla yazılır", async () => {
    await must("ödeme", admin.post("/api/workspace/cash", { kind: "out", amount: "15.000", date: day(-1), description: "Kira" }));
    await refused("açılış 1.000'e", admin.post("/api/workspace/cash/opening", { amount: "1.000", date: day(-10) }), 409, "cash-negative");
    await must("onayla", admin.post("/api/workspace/cash/opening", { amount: "1.000", date: day(-10), cashForce: true }));
    assert.equal(await cashBalance(admin), 1000 + 300 - 15000);
    assert.equal((await trialOf(admin))["500"], -1000);
    await must("geri 20.000", admin.post("/api/workspace/cash/opening", { amount: "20.000", date: day(-10) }));
  });

  it("9: yönetici siler → Silinenler; yönetici olmayan geri yükleyemez; yeni açılış girilince eskisi geri yüklenemez (409)", async () => {
    const [row] = await openingRows(admin);
    // Açılış silinince Kasa eksiye düşer (5.300 − 20.000): yönetici "Yine de Sil" der (cashForce).
    await refused("sil (soru)", admin.del(`/api/workspace/cash/${row.id}`), 409, "cash-negative");
    await must("sil", admin.del(`/api/workspace/cash/${row.id}?cashForce=1`));
    assert.equal((await trialOf(admin))["500"] || 0, 0, "500 boşaldı");
    const trash = await must("Silinenler", admin.get("/api/admin/trash"));
    const item = trash.find(entry => entry.kind === "cash" && entry.ref === row.id);
    assert.ok(item, "Silinenler'de");
    await refused("avukat açılışı geri yükleyemez", lawyer.post("/api/admin/trash/restore", { id: item.id }), 403, "cash-opening-admin");
    await must("yeni açılış", admin.post("/api/workspace/cash/opening", { amount: "7.000", date: day(-10) }));
    await refused("eski açılış geri yüklenmez (iki açılış olurdu)", admin.post("/api/admin/trash/restore", { id: item.id }), 409, "cash-opening-exists");
    assert.equal((await openingRows(admin)).length, 1);
    assert.equal((await trialOf(admin))["500"], -7000);
  });
});
