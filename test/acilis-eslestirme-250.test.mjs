// 2.5.0 Ç5-A tur 2c İş 1 — Açılış Eşleştirme Fişi (docs/erp/C5-ACILIS-TASARIM.md §2.7, §17.10; kural kitabı M-11; BAŞ MİMAR B2, B10; C2 §5 / §11; kâhin red kodları ESLESTIRME_HESAP,
// ESLESTIRME_TERS).
// KURAL (karar metinlerinden): fiş bir yanda 519, öbür yanda hedefler (500–503, 520–549, 570, 580, 590, 591 ve gerekirse öteki bilanço hesapları; alt defter hesapları HARİÇ); tutar = 519'un
// fiş tarihi GÜN SONU bakiyesi ya da bir kısmı, 519'u ters bakiyeye geçiremez (aynı gün açılışları dahil); birden çok kez; kilitli tarihe 409; ters kaydı Ç2 ucuyla; fişten sonra açık
// dönemde açılış silinirse 519 ters bakiyeye düşebilir → ENGELLENMEZ, Defter Mutabakatı'nda bilgi satırı; yetki system.manage (Muhasebe 403); Açılış Karşılığı denetimi fiş satırlarını
// görür (519 = −Σ modül açılışları + fiş satırları; 500 = fiş satırları); fiş cari / Kasa / banka / stok / KDV bakiyesini DEĞİŞTİRMEZ.
// BEKLENEN SAYILAR girdilerden (açılış tutarları) elle — programın kodundan değil (ders 5): 519 = −(Kasa 1.000 + cari 300 − tedarikçi 200 + banka 5.000 + stok 10 × 20) = −6.300 (02.03'e
// kadar), 10.03'teki cari açılışı 1.000 ile −7.300.
// Veri: güncel kodun API'sinden; sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const NOW = "2026-11-23T00:30:00+03:00"; // İstanbul'da 23.11, UTC'de 22.11 (iki TZ'de koşulur; fiş tarihleri yerel takvim günü)
const URL = "/api/admin/ledger/opening-match";
let seq = 0;
const rid = () => `acilis-eslestirme-${process.pid}-${String(++seq).padStart(6, "0")}`;
const must = async (label, call) => {
  const r = await call;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data?.data ?? r.data;
};
const refused = async (label, call, status, code) => {
  const r = await call;
  assert.equal(r.status, status, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  if (code) assert.equal(r.data?.code ?? r.data?.error?.code, code, `${label}: ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
const credit = (account, amount) => ({ account, side: "credit", amount });
const debit = (account, amount) => ({ account, side: "debit", amount });

describe("Ç5-A tur 2c İş 1 — Açılış Eşleştirme Fişi", () => {
  let server;
  let admin;
  const ids = {};
  const balanceOf = (code, to = "") => {
    let out = 0;
    for (const entry of server.app.ledger.book({})) if (!to || entry.date <= to) for (const line of entry.lines) if (line.account === code) out += line.debit - line.credit;
    return out;
  };
  const vouchers = () => server.app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE type = 'opening-match'").n;
  const check = async code => (await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"))).checks.find(item => item.code === code) || null;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    await must("kurulum", admin.post("/api/workspace/bank/setup/dismiss", {}));
    await must("Kasa açılışı", admin.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-02-01" }));
    ids.debtor = (await must("borçlu cari", admin.post("/api/workspace/accounts", { name: "Borçlu Cari", registeredOn: "2026-02-01", openingBalance: "300", openingSide: "auto" }))).id;
    ids.creditor = (await must("alacaklı tedarikçi", admin.post("/api/workspace/accounts", { name: "Alacaklı Tedarikçi", type: "supplier", registeredOn: "2026-02-01", openingBalance: "200", openingSide: "credit" }))).id;
    await must("banka açılışı", admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-02-01", amount: "5.000", confirmed: true } }));
    await must("stok açılışı", admin.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "10", openingDate: "2026-02-01" }));
    ids.late = (await must("10.03 cari açılışı", admin.post("/api/workspace/accounts", { name: "Geç Açılan Cari", registeredOn: "2026-03-10", openingBalance: "1.000", openingSide: "auto" }))).id;
    ids.lateEntry = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND is_opening = 1", ids.late)?.id;
  });
  after(async () => {
    await server?.app?.close?.();
    removeTestDir(server?.root);
  });

  it("ön izleme verisi: 519'un gün sonu bakiyesi ve açılış türlerine göre dökümü (toplam = bakiye); izinli hedefler alt defter hesabı ve 519 içermez", async () => {
    const view = await must("GET", admin.get(`${URL}?date=2026-03-02`));
    assert.equal(view.balanceMinor, -630_000);
    assert.deepEqual(Object.fromEntries(view.parts.map(part => [part.kind, part.minor])), { cash: -100_000, accounts: -10_000, bank: -500_000, stock: -20_000 });
    assert.equal(view.parts.reduce((sum, part) => sum + part.minor, 0), view.balanceMinor, "döküm toplamı = bakiye");
    const codes = view.targets.map(item => item.code);
    for (const code of ["500", "501", "502", "503", "520", "529", "540", "549", "570", "580", "590", "591"]) assert.ok(codes.includes(code), `izinli: ${code}`);
    for (const code of ["100", "102", "120", "153", "320", "340", "136", "519", "600"]) assert.ok(!codes.includes(code), `izinsiz: ${code}`);
    assert.ok(codes.includes("255"), "öteki bilanço hesabı (255 Demirbaşlar) izinli");
    assert.equal((await must("GET 10.03", admin.get(`${URL}?date=2026-03-10`))).balanceMinor, -730_000, "aynı günün açılışı (10.03) gün sonu bakiyesinde");
    assert.equal(view.disabled, false);
  });

  it("ret: izinsiz hedef (102, 120, 600, 519) 400 ESLESTIRME_HESAP; 519'u büyüten 409; ters bakiye 409 ESLESTIRME_TERS (aynı gün açılışı dahil, ertesi gün açılışı hariç); fiş yazılmaz", async () => {
    for (const account of ["102", "120", "153", "600", "519"]) await refused(`hedef ${account}`, admin.post(`${URL}/preview`, { date: "2026-03-02", lines: [credit(account, "100")] }), 400, "opening-match-account");
    await refused("519'u büyütür", admin.post(`${URL}/preview`, { date: "2026-03-02", lines: [debit("500", "100")] }), 409, "opening-match-direction");
    await refused("ters bakiye (09.03: 6.300)", admin.post(`${URL}/preview`, { date: "2026-03-09", lines: [credit("500", "7.300")] }), 409, "opening-match-inverse");
    const same = await must("aynı gün (10.03: 7.300)", admin.post(`${URL}/preview`, { date: "2026-03-10", lines: [credit("500", "7.300")] }));
    assert.equal(same.afterMinor, 0);
    assert.deepEqual(same.lines.map(line => [line.account, line.debit, line.credit]), [["500", 0, 730_000], ["519", 730_000, 0]], "519 karşı satırı kendiliğinden");
    await refused("tutarsız", admin.post(`${URL}/preview`, { date: "2026-03-02", lines: [credit("500", "abc")] }), 400, "opening-match-line");
    await refused("dengeli hedefler", admin.post(`${URL}/preview`, { date: "2026-03-02", lines: [credit("500", "10"), debit("501", "10")] }), 400, "opening-match-zero");
    await refused("onaysız yazım", admin.post(URL, { requestId: rid(), date: "2026-03-02", lines: [credit("500", "100")] }), 400, "opening-match-confirm");
    assert.equal(vouchers(), 0);
  });

  it("kısmi + ikinci fiş (iki hedef) + fazlası ret; Açılış Karşılığı fiş satırlarını görür; cari / Kasa / banka / stok bakiyesi değişmez; aynı istek iki kez tek fiş", async () => {
    const untouched = ["100", "102", "120", "153", "320", "191", "391"].map(code => [code, balanceOf(code)]);
    const id = rid();
    const first = await must("kısmi 4.000", admin.post(URL, { requestId: id, date: "2026-03-10", lines: [credit("500", "4.000")], confirm: true }));
    assert.equal(first.afterMinor, -330_000);
    assert.equal((await must("yinelenen istek", admin.post(URL, { requestId: id, date: "2026-03-10", lines: [credit("500", "4.000")], confirm: true }))).replayed, true);
    assert.equal(vouchers(), 1, "aynı istek iki kez: tek fiş");
    assert.deepEqual([first.voucher.type, first.voucher.cls], ["opening-match", "opening"]);
    const second = await must("ikinci: 500 2.000 + 570 1.300", admin.post(URL, { requestId: rid(), date: "2026-03-10", lines: [credit("500", "2.000"), credit("570", "1.300")], confirm: true }));
    assert.equal(second.afterMinor, 0);
    await refused("519 sıfırken", admin.post(`${URL}/preview`, { date: "2026-03-10", lines: [credit("500", "0,01")] }), 409, "opening-match-nothing");
    assert.equal(balanceOf("519"), 0);
    assert.equal(balanceOf("500"), -600_000);
    assert.equal(balanceOf("570"), -130_000);
    assert.deepEqual(["100", "102", "120", "153", "320", "191", "391"].map(code => [code, balanceOf(code)]), untouched, "alt defter hesapları (cari, Kasa, banka, stok, KDV) değişmez");
    const c519 = await check("opening:519");
    const c500 = await check("opening:500");
    assert.deepEqual([c519.ok, c519.ledger, c519.subledger], [true, 0, 0], `519: defter = −Σ açılış + fiş satırları: ${JSON.stringify(c519)}`);
    assert.equal(c519.parts.vouchers519, 730_000, "Açılış Karşılığı fiş satırlarının 519'unu görür");
    assert.deepEqual([c500.ok, c500.ledger, c500.subledger], [true, -6000, -6000], `500 = fiş satırları: ${JSON.stringify(c500)}`);
    assert.equal(await check("opening:519-inverse"), null, "ters bakiye yok: bilgi satırı yok");
  });

  it("fişten sonra açık dönemde açılış silinir → 519 ters bakiye: ENGELLENMEZ; Mutabakat'ta bilgi satırı (zil / günlük değişmez); ters kayıtla geri döner", async () => {
    const logBefore = server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
    await must("10.03 açılışını sil", admin.del(`/api/workspace/accounts/${ids.late}/entries/${ids.lateEntry}`));
    assert.equal(balanceOf("519"), 100_000, "519 eşleştirmenin tersine geçti (borç 1.000)");
    const info = await check("opening:519-inverse");
    assert.ok(info && info.ok === true && info.info === true && info.ledger === 1000 && info.matched === 7300, `bilgi satırı: ${JSON.stringify(info)}`);
    const result = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(result.failures.some(item => item.code === "opening:519-inverse"), false, "bilgi satırı sapma / uyarı değil");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n, logBefore, "Mutabakat Günlüğü'ne satır yazılmaz");
    const last = server.app.store.get("SELECT id FROM ledger_vouchers WHERE type = 'opening-match' ORDER BY rowid DESC LIMIT 1").id;
    await must("ikinci fişi ters kaydet", admin.post(`/api/admin/ledger/vouchers/${last}/reverse`, { requestId: rid() }));
    assert.equal(balanceOf("519"), -230_000, "ters kayıtla 519 geri gelir (−6.300 + 4.000)");
    assert.equal(await check("opening:519-inverse"), null);
    assert.equal((await must("GET", admin.get(URL))).vouchers.length, 1, "etkin eşleştirme fişi: ters kaydedilen düşer");
  });

  it("iki kişi aynı anda kalanın tamamını eşleştirir: biri yazılır, öbürü güncel bakiyeyle (0) 409; Muhasebe 403; ileri tarih 400; kilitli tarih 409", async () => {
    const other = await loginAdmin(server);
    const [a, b] = await Promise.all([
      admin.post(URL, { requestId: rid(), date: "2026-03-10", lines: [credit("500", "2.300")], confirm: true }),
      other.post(URL, { requestId: rid(), date: "2026-03-10", lines: [credit("500", "2.300")], confirm: true }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], `${a.status} ${b.status}`);
    assert.equal((a.status === 409 ? a : b).data.code, "opening-match-nothing", "ikinci istek güncel bakiyeyi (0) görür");
    assert.equal(balanceOf("519"), 0);
    const acc = await createUser(server, admin, { username: "muhasebe-esl", role: "muhasebe" });
    await refused("Muhasebe GET", acc.get(URL), 403);
    await refused("Muhasebe ön izleme", acc.post(`${URL}/preview`, { date: "2026-03-10", lines: [credit("500", "1")] }), 403);
    await refused("Muhasebe yazım", acc.post(URL, { requestId: rid(), date: "2026-03-10", lines: [credit("500", "1")], confirm: true }), 403);
    const future = server.app.config.now.today() === "2026-11-23" ? "2026-11-24" : "2026-11-23";
    await refused("ileri tarih", admin.post(`${URL}/preview`, { date: future, lines: [credit("500", "1")] }), 400, "date-future");
    await must("kilit 28.02", admin.put("/api/admin/period-lock", { lockedUntil: "2026-02-28" }));
    await server.app.ledger.snapshots.runPending();
    const locked = await must("GET kilitli tarih", admin.get(`${URL}?date=2026-02-15`));
    assert.deepEqual([locked.disabled, locked.code], [true, "period-locked"]);
    await refused("kilitli tarih ön izleme", admin.post(`${URL}/preview`, { date: "2026-02-15", lines: [credit("500", "1")] }), 409, "period-locked");
    await refused("kilitli tarih yazım", admin.post(URL, { requestId: rid(), date: "2026-02-15", lines: [credit("500", "1")], confirm: true }), 409, "period-locked");
  });
});
