// 2.4.4 madde 5a (kullanıcı kararı 22.10.2026, "3 önerinde uygun"): Taksitler → Tablodan Aktar, kayda bağlı carinin TAKSİT DIŞI tahsilatlarını ön izlemede
// gösterir ve en eskiden başlayarak karta yazar (kartın en eski açık taksitine sayılır). Tutarlar değişmez: carinin bakiyesi, Kasa ve banka hesabı aynı
// kalır (veri tabanından ve programın uçlarından okunur). "Nasıl bozulur?" listesinden:
//   A1 sıra: cari tahsilatı önce → aktar (taşınır); A2 kısmi tutar (taksitten küçük); A3 kartı aşan tutar bölünmez (o ve sonrakiler taksit dışı kalır);
//   A4 iade (− Ödeme) düşülür; A5 havale (banka hesabına bağlı) taşınır, hesap bakiyesi aynı; A6 faturalı cari taşınmaz; A7 başka kartın tahsilatına
//   dokunulmaz; A8 seçenek kapalı = 2.4.3 davranışı; A9 ön izlemeden sonra cariye tahsilat girilirse aktarım durur (409); A10 geri al: satırlar cariye
//   aynen döner (kimlik, tutar, makbuz no, işlem başlığı); A11 kapatılmış dönemdeki tahsilat taşınmaz.
// Beklenen sayılar programdan bağımsız: örnek tablodaki taksitler (test/fixtures/tahsilat-ornek.mjs: Elif 3 × 3.000, Selin 3 × 1.500) ve burada girilen
// tutarların elle toplamı.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { okulServisiWorkbook } from "./fixtures/okul-servisi-ornek.mjs";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

describe("2.4.4 5a: Tablodan Aktar kayda bağlı carinin taksit dışı tahsilatlarını karta yazar; bakiye, Kasa ve banka aynı", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tablodan-aktar-244-"));
  let server;
  let api;
  let db;
  const one = (sql, ...args) => db.get(sql, ...args);
  const keys = {};
  const ids = {};
  let preview;
  let result;
  let before0;
  const cash = async () => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;
  const balanceOf = async id => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance;
  const bankBalance = async id => (await must("banka", api.get("/api/workspace/bank/accounts"))).accounts.find(item => item.id === id)?.balance;
  const entriesIn = id => db.all("SELECT id, amount, receipt_no AS receiptNo, event_id AS eventId FROM account_entries WHERE account_id = ? AND kind = 'in' ORDER BY date, rowid", id);
  const snapshot = async () => ({ cash: await cash(), elif: await balanceOf(ids.elif), selin: await balanceOf(ids.selin), bank: await bankBalance(ids.bank), events: one("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'").n });

  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    db = server.app.store;
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    ids.bank = (await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-60), amount: "10.000", confirmed: true } }))).id;
    const book = tahsilatWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const first = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    for (const name of ["Elif Aydın", "Selin Arslan", "Burak Koç"]) keys[name] = first.records.find(record => record.name === name)?.key;
    assert.ok(keys["Elif Aydın"] && keys["Selin Arslan"] && keys["Burak Koç"], `tablodaki planlar: ${JSON.stringify(first.records.map(record => record.name))}`);
    // Elif (kayda bağlı cari): 1.000 nakit (−20 gün), 2.500 havale (−10 gün, banka hesabına), 500 iade (−5 gün), 7.000 nakit (−2 gün).
    ids.elif = (await must("Elif cari", api.post("/api/workspace/accounts", { name: "Elif Aydın", phone: "0532 600 10 10", type: "customer", caseKey: keys["Elif Aydın"], caseTitle: "Elif Aydın" }))).id;
    const entry = body => must(`hareket ${body.kind} ${body.amount}`, api.post(`/api/workspace/accounts/${ids.elif}/entries`, body));
    await entry({ kind: "in", amount: "1.000", date: day(-20), method: "cash", note: "İlk ödeme" });
    await entry({ kind: "in", amount: "2.500", date: day(-10), method: "bank", bankAccountId: ids.bank });
    await entry({ kind: "out", amount: "500", date: day(-5), method: "cash", note: "İade" });
    await entry({ kind: "in", amount: "7.000", date: day(-2), method: "cash" });
    // Selin (kayda bağlı, faturalı cari): faturası varken taksit dışı tahsilatı karta yazılmaz.
    ids.selin = (await must("Selin cari", api.post("/api/workspace/accounts", { name: "Selin Arslan", phone: "0532 600 30 30", type: "customer", caseKey: keys["Selin Arslan"], caseTitle: "Selin Arslan" }))).id;
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-244", name: "Servis Hizmeti", unit: "Adet", salePrice: "400" }));
    await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.selin, issueDate: day(-15), lines: [{ itemId: svc.id, qty: 1, unitPrice: 400, vatRate: 0 }], payment: { rest: "open" } }));
    await must("Selin tahsilat", api.post(`/api/workspace/accounts/${ids.selin}/entries`, { kind: "in", amount: "600", date: day(-3), method: "cash" }));
    // Burak (kayda bağlı cari): 300 (−25), 100 iade (−22), 1.000 (−20), 500 (−3) → net 1.700; en eskiden: 300 + 1.000 = 1.300 sığar, 500 aşar.
    ids.burak = (await must("Burak cari", api.post("/api/workspace/accounts", { name: "Burak Koç", phone: "0532 600 20 20", type: "customer", caseKey: keys["Burak Koç"], caseTitle: "Burak Koç" }))).id;
    for (const [kind, amount, offset] of [["in", "300", -25], ["out", "100", -22], ["in", "1.000", -20], ["in", "500", -3]]) await must(`Burak ${kind} ${amount}`, api.post(`/api/workspace/accounts/${ids.burak}/entries`, { kind, amount, date: day(offset), method: "cash" }));
    before0 = await snapshot();
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("A1–A6, A8 ön izleme: Elif 3.500 karta (1.000 + 2.500), 7.000 taksit dışı (kalanı aşar; iade düşüldü); Selin faturalı → taşınmaz; kapalıyken yazılmaz", async () => {
    preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const elif = preview.records.find(record => record.key === keys["Elif Aydın"]);
    assert.equal(elif.account, "bound");
    assert.equal(elif.accountMoved, 3500, `karta yazılacak: ${elif.accountMoved}`);
    assert.equal(elif.accountMoveCount, 2);
    assert.equal(elif.accountKept, 7000, "taksit dışı kalan 7.000");
    assert.equal(elif.remaining, 5500, "kalan 9.000 − 3.500 = 5.500");
    assert.ok(elif.issues.some(issue => issue.code === "account-in-move") && elif.issues.some(issue => issue.code === "account-in-kept" && /bölünmez/.test(issue.text) && /iade/.test(issue.text)), JSON.stringify(elif.issues));
    const selin = preview.records.find(record => record.key === keys["Selin Arslan"]);
    assert.equal(selin.accountMoved, 0, "faturalı cari: taşınmaz");
    assert.ok(selin.issues.some(issue => issue.code === "account-in-kept" && /faturası var/.test(issue.text)), JSON.stringify(selin.issues));
    const burak = preview.records.find(record => record.key === keys["Burak Koç"]);
    assert.equal(burak.accountMoved, 1300, `Burak: iade düşülünce net 1.700; 300 + 1.000 sığar, 500 aşar → 1.300 (${JSON.stringify(burak.issues)})`);
    assert.equal(burak.accountKept, 500);
    const off = await must("ön izleme kapalı", api.get("/api/workspace/plans/from-table?accountIn=0"));
    const elifOff = off.records.find(record => record.key === keys["Elif Aydın"]);
    assert.equal(elifOff.accountMoved, 0);
    assert.equal(elifOff.remaining, 9000, "kapalıyken kalan 9.000 (2.4.3 davranışı)");
    assert.ok(elifOff.issues.some(issue => issue.code === "account-in" && /seçiminize göre karta yazılmaz/.test(issue.text)));
  });

  test("A9 ön izlemeden sonra cariye tahsilat girilirse aktarım durur (409, hiçbir şey yazılmaz)", async () => {
    const extra = await must("araya giren tahsilat", api.post(`/api/workspace/accounts/${ids.elif}/entries`, { kind: "in", amount: "50", date: day(0), method: "cash" }));
    const plansBefore = one("SELECT COUNT(*) AS n FROM plans").n;
    const res = await api.post("/api/workspace/plans/from-table", { keys: [keys["Elif Aydın"]], fingerprint: preview.fingerprint });
    assert.equal(res.status, 409, JSON.stringify(res.data).slice(0, 200));
    assert.equal(one("SELECT COUNT(*) AS n FROM plans").n, plansBefore, "kart açılmadı");
    await must("araya gireni sil", api.del(`/api/workspace/accounts/${ids.elif}/entries/${extra.entryId}`));
    preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
  });

  test("A1–A7 aktar: kart 9.000 / ödenen 3.500 (1. taksit kapandı, 2.'nin 500'ü); cari bakiyesi, Kasa, banka hesabı ve işlem sayısı aynı", async () => {
    const elifIns = entriesIn(ids.elif);
    result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [keys["Elif Aydın"], keys["Selin Arslan"]], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 2);
    assert.equal(result.accountEntriesMoved, 2);
    assert.equal(result.accountEntriesAmount, 3500);
    const after1 = await snapshot();
    // Kartlar yeni borçtur (carilerin bu aktarımdan önce borcu yok): Elif +9.000, Selin +4.500. Taşıma bakiyeye bir şey katmaz.
    assert.deepEqual({ ...after1, elif: after1.elif - 9000, selin: after1.selin - 4500 }, before0, "Kasa, banka hesabı, etkin işlem başlığı sayısı aynı; carilerin bakiyesi yalnız kart kadar arttı");
    const plan = one("SELECT id FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys["Elif Aydın"]);
    const detail = await must("kart", api.get(`/api/workspace/plans/${plan.id}`));
    assert.deepEqual([detail.totals.total, detail.totals.paid, detail.totals.remaining], [9000, 3500, 5500]);
    const items = detail.items.map(item => [item.seq, item.paid]);
    assert.deepEqual(items, [[1, 3000], [2, 500], [3, 0]], `taksitler: ${JSON.stringify(items)}`);
    const moved = db.all("SELECT amount, method, fin_ref AS finRef, event_id AS eventId FROM plan_entries WHERE plan_id = ? AND opening = 0 ORDER BY date", plan.id);
    assert.deepEqual(moved.map(item => [item.amount, item.method]), [[1000, "cash"], [2500, "bank"]]);
    assert.equal(moved[1].finRef, ids.bank, "havale banka hesabı bağını taşıdı");
    assert.deepEqual(moved.map(item => item.eventId), elifIns.slice(0, 2).map(item => item.eventId), "işlem başlıkları (İşlem No) aynı");
    assert.deepEqual(entriesIn(ids.elif).map(item => item.amount), [7000], "carinin hesabında 7.000 taksit dışı kaldı");
    assert.equal(one("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'out'", ids.elif).n, 1, "iade yerinde");
    assert.deepEqual(entriesIn(ids.selin).map(item => item.amount), [600], "faturalı carinin tahsilatı yerinde");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
  });

  test("A7 başka kartın tahsilatına dokunulmaz; A10 geri al: cari tahsilatları aynen döner, sayılar aynı", async () => {
    // Elif'in ikinci (elle açılmış) kartı ve tahsilatı: aktarım ve geri alma ona dokunmaz.
    const other = await must("ikinci kart", api.post("/api/workspace/plans", { accountId: ids.elif, name: "Elif Aydın · Ek", total: "1.000", registeredOn: day(-1), mode: "auto", count: 1, firstDue: day(10) }));
    await must("ikinci kart tahsilatı", api.post(`/api/workspace/plans/${other.id}/entries`, { kind: "in", amount: "400", date: day(0), method: "cash" }));
    const otherEntries = db.all("SELECT id, amount FROM plan_entries WHERE plan_id = ?", other.id);
    const mid = await snapshot();
    const undone = await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(undone.accountEntries, 2, JSON.stringify(undone));
    const ins = entriesIn(ids.elif);
    assert.deepEqual(ins.map(item => item.amount), [1000, 2500, 7000], "üç tahsilat yine carinin hesabında");
    const back = db.all("SELECT id, amount, receipt_no AS receiptNo, fin_ref AS finRef FROM account_entries WHERE account_id = ? AND kind = 'in' ORDER BY date, rowid", ids.elif);
    assert.equal(back[1].finRef, ids.bank, "havalenin banka bağı döndü");
    assert.ok(back.every(item => item.receiptNo), "makbuz numaraları döndü");
    assert.deepEqual(db.all("SELECT id, amount FROM plan_entries WHERE plan_id = ?", other.id), otherEntries, "ikinci karta dokunulmadı");
    const end = await snapshot();
    assert.equal(end.cash, mid.cash, "Kasa aynı");
    assert.equal(end.bank, mid.bank, "banka hesabı aynı");
    assert.equal(end.elif, mid.elif - 9000, "geri alma: kartın borcu (9.000) kalktı, taşınan 3.500 yine carinin alacağında");
    assert.equal(end.elif, before0.elif + 600, "aktarımdan önceki bakiye + ikinci kart (1.000 − 400)");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `geri almadan sonra Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
  });

  test("A11 kapatılmış dönemdeki cari tahsilatı taşınmaz", async () => {
    // Burak (aktarılmadı): kilit −15 gün → 300 (−25) ve 1.000 (−20) kilitli dönemde; yalnız 500 (−3) karta.
    await must("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil: day(-15) }));
    const locked = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const record = locked.records.find(item => item.key === keys["Burak Koç"]);
    assert.equal(record.accountMoved, 500, `kilitli dönemdeki 300 ve 1.000 taşınmaz, yalnız 500: ${JSON.stringify(record.issues)}`);
    assert.ok(record.issues.some(issue => issue.code === "account-in-kept" && /kilitli/.test(issue.text)), JSON.stringify(record.issues));
    await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  });
});

// 2.4.4 madde 5b: "önce cari açın" formunda Açılış Bakiyesi kayıttaki Kalan Borç ile dolu gelir; ardından Tablodan Aktar aynı borcu İKİNCİ KEZ yazmaz.
// Kural (tek kart formundaki "Borcun Kaynağı: Carinin Mevcut Borcu" varsayılanı gibi): kayda bağlı carinin kart kapsamı dışındaki borcu (karta yazılacak
// taksit dışı tahsilatlar geri eklenerek) tablodaki kalanı karşılıyorsa kart "Carinin Mevcut Borcu" olarak açılır (cariye borç yazmaz; Excel'de ödenmiş
// kısım zaten carinin bakiyesindedir, açılış satırı yazılmaz). Borç kalandan küçükse aynı borç mu belli değil: kişi aktarılmaz (seçenek kapatılırsa yeni
// borç). Faturalı caride kapsanmaz (uyarı). "Nasıl bozulur?": B1 açılış = kalan → çift borç yok; B2 açılıştan sonra taksit dışı tahsilat → yine yok, tahsilat
// karta; B3 açılış kalandan küçük → aktarılmaz; B4 seçenek kapalı → yeni borç + uyarı; B5 faturalı cari → kapsanmaz + uyarı; B6 geri al → bakiye aynı.
describe("2.4.4 5b: Tablodan Aktar carinin mevcut borcunu ikinci kez yazmaz (açılış bakiyesi + kart = çift borç olmaz)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tablodan-aktar-244-5b-"));
  let server;
  let api;
  let db;
  const keys = {};
  const ids = {};
  const balanceOf = async id => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance;
  const cash = async () => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;
  let preview;
  let result;
  let before5b;

  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    db = server.app.store;
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const book = tahsilatWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const first = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    for (const name of ["Elif Aydın", "Selin Arslan", "Burak Koç"]) keys[name] = first.records.find(record => record.name === name)?.key;
    const open = (name, phone, key, openingBalance) => must(`${name} cari`, api.post("/api/workspace/accounts", { name, phone, type: "customer", caseKey: key, caseTitle: name, openingBalance, openingSide: "auto", registeredOn: day(-40) }));
    // Elif: açılış 9.000 (= tablodaki kalan 3 × 3.000), sonra 2.000 taksit dışı tahsilat.
    ids.elif = (await open("Elif Aydın", "0532 600 10 10", keys["Elif Aydın"], "9.000")).id;
    await must("Elif tahsilat", api.post(`/api/workspace/accounts/${ids.elif}/entries`, { kind: "in", amount: "2.000", date: day(-1), method: "cash" }));
    // Selin: açılış 1.000 (< kalan 4.500).
    ids.selin = (await open("Selin Arslan", "0532 600 30 30", keys["Selin Arslan"], "1.000")).id;
    // Burak: açılış 6.000 (= kalan) ama faturası var.
    ids.burak = (await open("Burak Koç", "0532 600 20 20", keys["Burak Koç"], "6.000")).id;
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-5B", name: "Servis Hizmeti", unit: "Adet", salePrice: "100" }));
    await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.burak, issueDate: day(-10), lines: [{ itemId: svc.id, qty: 1, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" } }));
    before5b = { elif: await balanceOf(ids.elif), selin: await balanceOf(ids.selin), burak: await balanceOf(ids.burak), cash: await cash() };
    assert.deepEqual([before5b.elif, before5b.selin, before5b.burak], [7000, 1000, 6100], "açılış bakiyeleri (elle): 9.000 − 2.000, 1.000, 6.000 + 100");
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("B1–B5 ön izleme: Elif mevcut borçla (2.000 karta), Selin aktarılmaz, Burak faturalı (yeni borç uyarısı); seçenek kapalıyken yeni borç uyarısı", async () => {
    preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const elif = preview.records.find(record => record.key === keys["Elif Aydın"]);
    assert.equal(elif.cover, true, JSON.stringify(elif.issues));
    assert.equal(elif.accountMoved, 2000);
    assert.equal(elif.remaining, 7000, "kalan 9.000 − 2.000");
    assert.ok(elif.issues.some(issue => issue.code === "cover-debt" && /ikinci kez/.test(issue.text)), JSON.stringify(elif.issues));
    const selin = preview.records.find(record => record.key === keys["Selin Arslan"]);
    assert.equal(selin.status, "error", JSON.stringify(selin.issues));
    assert.ok(selin.issues.some(issue => issue.code === "cover-ambiguous"), JSON.stringify(selin.issues));
    const burak = preview.records.find(record => record.key === keys["Burak Koç"]);
    assert.equal(burak.cover, false);
    assert.ok(burak.issues.some(issue => issue.code === "cover-new-debt" && /faturası/.test(issue.text)), JSON.stringify(burak.issues));
    const off = await must("ön izleme kapalı", api.get("/api/workspace/plans/from-table?coverDebt=0"));
    const elifOff = off.records.find(record => record.key === keys["Elif Aydın"]);
    assert.equal(elifOff.cover, false);
    assert.ok(elifOff.issues.some(issue => issue.code === "cover-new-debt"), JSON.stringify(elifOff.issues));
    const selinOff = off.records.find(record => record.key === keys["Selin Arslan"]);
    assert.notEqual(selinOff.status, "error", "seçenek kapalıyken Selin aktarılabilir (yeni borç)");
  });

  test("B1–B2 aktar: Elif kartı 'Carinin Mevcut Borcu' (9.000, açılış satırı yok, 2.000 ödendi); carinin bakiyesi ve Kasa AYNI; Selin aktarılmadı", async () => {
    result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [keys["Elif Aydın"], keys["Selin Arslan"]], fingerprint: preview.fingerprint }));
    // Önce para: Elif'in bakiyesi 7.000 kalmalı (açılış 9.000 − 2.000); kart yeni borç yazsaydı 16.000 olurdu (çift borç).
    assert.equal(await balanceOf(ids.elif), before5b.elif, "Elif'in bakiyesi 7.000 (çift borç yok)");
    assert.equal(await balanceOf(ids.selin), before5b.selin, "Selin aktarılmadı, bakiyesi aynı (kalanı karşılamayan borç: aktarılmaz)");
    assert.equal(result.created, 1);
    assert.equal(result.skipped.length, 1, JSON.stringify(result.skipped));
    const plan = db.get("SELECT id, total, covers_balance AS covers FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys["Elif Aydın"]);
    assert.deepEqual([plan.total, plan.covers], [9000, 1]);
    assert.equal(db.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ? AND opening = 1", plan.id).n, 0, "açılış (devir) satırı yazılmadı");
    const detail = await must("kart", api.get(`/api/workspace/plans/${plan.id}`));
    assert.deepEqual([detail.totals.total, detail.totals.paid, detail.totals.remaining], [9000, 2000, 7000]);
    assert.equal(await cash(), before5b.cash, "Kasa aynı");
    assert.equal(db.get("SELECT COUNT(*) AS n FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys["Selin Arslan"]).n, 0);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
  });

  test("B6 geri al: kart kalkar, 2.000 carinin hesabına döner; bakiye ve Kasa aynı", async () => {
    await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(db.get("SELECT COUNT(*) AS n FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys["Elif Aydın"]).n, 0);
    assert.equal(await balanceOf(ids.elif), before5b.elif);
    assert.equal(await cash(), before5b.cash);
    assert.deepEqual(db.all("SELECT kind, amount FROM account_entries WHERE account_id = ? ORDER BY date, rowid", ids.elif).map(row => [row.kind, row.amount]), [["debt", 9000], ["in", 2000]]);
  });
});

// 5b B7: Excel'de kısmen ödenmiş plan (okul servisi: Can Öztürk 4 × 3.800 = 15.200, Excel'e göre ödenen 9.500, kalan 5.700). Cari açılış bakiyesi 5.700
// (kayıttaki kalan): kart "Carinin Mevcut Borcu" 5.700 ile açılır, ödenmemiş taksit kısımlarıyla; Excel'de ödenmiş 9.500 için açılış (devir) satırı
// YAZILMAZ (yazılsaydı carinin bakiyesi 5.700 − 9.500 = −3.800 olurdu). Bakiye 5.700 kalır.
describe("2.4.4 5b B7: Excel'de kısmen ödenmiş plan + açılış bakiyesi = kalan → kart ödenmemiş kısımla, açılış satırı yok, bakiye aynı", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tablodan-aktar-244-5b7-"));
  let server;
  let api;
  let db;
  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    db = server.app.store;
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const book = okulServisiWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("B7 Can Öztürk: kart 5.700 (Mevcut Borç), açılış satırı yok, bakiye 5.700", async () => {
    const first = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const can = first.records.find(record => record.name === "Can Öztürk");
    assert.deepEqual([can.total, can.paid], [15200, 9500], "tablodaki plan (elle: 4 × 3.800; 2 ay + 1.900 ödendi)");
    const account = await must("cari", api.post("/api/workspace/accounts", { name: "Can Öztürk", type: "customer", caseKey: can.key, caseTitle: "Can Öztürk", openingBalance: "5.700", openingSide: "auto", registeredOn: day(-120) }));
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(item => item.key === can.key);
    assert.equal(record.cover, true, JSON.stringify(record.issues));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [can.key], fingerprint: preview.fingerprint }));
    assert.equal(result.covered, 1);
    const balance = (await must("cari", api.get(`/api/workspace/accounts/${account.id}`))).totals.balance;
    assert.equal(balance, 5700, `carinin bakiyesi 5.700 kalır (çift borç ya da açılış düşümü yok): ${balance}`);
    const plan = db.get("SELECT id, total, covers_balance AS covers FROM plans WHERE case_key = ? AND deleted_at IS NULL", can.key);
    assert.deepEqual([plan.total, plan.covers], [5700, 1]);
    assert.equal(db.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", plan.id).n, 0, "açılış (devir) satırı yok");
    assert.equal(db.get("SELECT ROUND(SUM(amount), 2) AS s FROM plan_items WHERE plan_id = ?", plan.id).s, 5700, "taksitler ödenmemiş kısımlarla");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 400)}`);
  });
});
