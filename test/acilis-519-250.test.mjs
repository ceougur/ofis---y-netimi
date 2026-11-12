// 2.5.0 Ç5-A tur 1 — açılış düzeni (docs/erp/C5-ACILIS-TASARIM.md §2.1–§2.6, §2.8, §3.5, §11; kural kitabı M-01 … M-10, H-06, KG-1, KG-5, KG-16, G-4; KULLANICI S47, S48, S49,
// S51 (bağlantı noktası), S53, S66 = A; BAŞ MİMAR B2–B9). Beklenenler karar metinlerinden (kâhin modeli okunmadı): her modül açılışı tek madde, karşı hesap 519; KG-5 tek madde
// B CH (T − P) / A 519, yüklemenin yerel günü; açılış işaretten (açıklamadan değil); KG-16 adayları göçte, onaya kadar 519, onay 519, ret 602 / 770; Excel açılış portföyü
// 519; formdan carisiz evrak 649.90 / 770.90; carisiz karşılıksız: açılışta B 519 / A 101, açılış değilse B 649.90 / A 101, cari seçilirse cari borçlanır; açılış sınıfı aynı
// gün önce (bakiye aynı); "Açılış Karşılığı" denetimi (519 / 500) temiz; kilitsiz geçmiş yıl uyarısı (S53). Karşı mutantlar: test/acilis-519-250-mutasyon.mjs.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { trialBalance } from "../server/lib/general-ledger.mjs";
import { lockDigestOf, LOCK_SQL_VERSION } from "../server/lib/integrity.mjs";
import { createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
// Tur 1b (ders 7, 38; C5-ACILIS-TASARIM §12.4): lib/ledger-opening.mjs (Ç5-A'nın yeni modülü) YALNIZ onu sınayan testlerde dinamik içe aktarılır — eski kodda dosya yüklenir, her
// test kendi iddiasının yokluğuyla kırmızı olur (önceden üst düzey içe aktarma bütün dosyayı "modül bulunamadı" ile düşürüyordu). Hazırlık adımları istekleri TOPLAR, iddia etmez;
// her test kendi ön koşulunu (need) kendi iddiası olarak sınar.
const openingModule = () => import("../server/lib/ledger-opening.mjs");

const NOW = "2026-11-23T00:30:00+03:00"; // İstanbul'da 23.11, UTC'de 22.11 (KG-5 yerel gün sınırı — iki TZ'de koşulur)
const must = async (label, call) => {
  const r = await call;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data?.data ?? r.data;
};
const refused = async (label, call, status) => {
  const r = await call;
  assert.equal(r.status, status, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
const balances = entries => Object.fromEntries(trialBalance(entries).accounts.map(a => [a.code, a.balance]));
const linesOf = entry => entry.lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
const entryOf = (entries, prefix) => entries.filter(entry => entry.id.startsWith(prefix));

describe("2.5.0 Ç5-A tur 1 — modül açılışları 519, KG-5, açılış evrakı, carisiz evrak, sınıf, denetim", () => {
  let server;
  let admin;
  let ids = {};
  const steps = {};
  // Hazırlık adımı: yanıt TOPLANIR (iddia yok); veri döner (yoksa {}). Testler ön koşullarını need() ile kendi iddiası olarak sınar.
  const step = async (label, call) => {
    const r = await call;
    steps[label] = { status: r.status, body: JSON.stringify(r.data).slice(0, 400) };
    return r.status === 200 ? (r.data?.data ?? r.data) || {} : {};
  };
  const need = (...labels) => {
    for (const label of labels) {
      assert.ok(steps[label], `${label}: hazırlıkta koşulmadı`);
      assert.equal(steps[label].status, 200, `${label}: ${steps[label].status} ${steps[label].body}`);
    }
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    await step("kurulum", admin.post("/api/workspace/bank/setup/dismiss", {}));
    ids.cash = await step("Kasa açılışı", admin.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-02-01" }));
    ids.debtor = (await step("borçlu cari", admin.post("/api/workspace/accounts", { name: "Borçlu Cari", registeredOn: "2026-02-01", openingBalance: "300", openingSide: "auto" }))).id;
    ids.creditor = (await step("alacaklı cari", admin.post("/api/workspace/accounts", { name: "Alacaklı Tedarikçi", type: "supplier", registeredOn: "2026-02-01", openingBalance: "200", openingSide: "credit" }))).id;
    ids.bank = await step("banka açılışı", admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-02-01", amount: "5.000", confirmed: true } }));
    await step("Çek Kullan", admin.put(`/api/workspace/bank/accounts/${ids.bank?.id || ids.bank?.account?.id}`, { usePos: true, useCheque: true, useNote: true }));
    ids.card = await step("kart açılışı", admin.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", currency: "TRY", creditLimit: "10.000", opening: { date: "2026-02-01", amount: "400", confirmed: true } }));
    await step("stok açılışı", admin.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "10", openingDate: "2026-02-01" }));
    // Aynı gün olağan Kasa girişi (açılış sınıfı önce gelmeli; açılıştan önce kaydedilmiş gibi yazım sırası açılışınkinden ÖNCE değil — sıra sınıftan).
    await step("Kasa girişi", admin.post("/api/workspace/cash", { kind: "in", amount: "50", date: "2026-02-01", description: "Olağan giriş" }));
    // Açıklaması "Açılış…" olan YENİ Borç Yaz / Alacak Yaz (göçten sonra): açılış DEĞİL (C-01 / C-02; K8-1).
    await step("Borç Yaz AÇILIŞ", admin.post(`/api/workspace/accounts/${ids.debtor}/entries`, { kind: "debt", amount: "70", date: "2026-03-01", note: "AÇILIŞ BAKİYESİ" }));
    await step("Alacak Yaz açılış", admin.post(`/api/workspace/accounts/${ids.creditor}/entries`, { kind: "credit", amount: "30", date: "2026-03-01", note: "Açılış bakiyesi" }));
    // Excel açılış portföyü (carilere dokunmadan): alınan çek, alınan senet, verilen çek.
    const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
    const portfolio = await step("açılış portföyü", admin.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "AC-1", "Akbank", "Eski Keşideci", "800", "15.12.2026", "01.02.2026"], ["Alınan", "Senet", "AS-2", "Akbank", "Eski Borçlu", "150", "20.12.2026", "01.02.2026"], ["Verilen", "Çek", "AV-3", "Akbank", "Eski Lehtar", "120", "25.12.2026", "01.02.2026"]], headerAt: 0, roles, fileName: "acilis.xlsx", post: false }));
    [ids.openIn, ids.openNote, ids.openOut] = portfolio.ids || [];
    // Formdan carisiz evrak (S49): ne cari ne keşideci — 2.4.9'da 400 idi.
    ids.freeIn = (await step("carisiz alınan", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "FC-1", bank: "Akbank", amount: "250", issueDate: "2026-04-01", dueDate: "2026-12-01" }))).id;
    ids.freeIn2 = (await step("carisiz alınan 2", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "FC-2", bank: "Akbank", amount: "90", issueDate: "2026-04-01", dueDate: "2026-12-01" }))).id;
    ids.freeOut = (await step("carisiz verilen", admin.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", serialNo: "FV-1", bank: "Akbank", amount: "60", issueDate: "2026-04-01", dueDate: "2026-12-01", bankAccountId: ids.bank?.id || ids.bank?.account?.id }))).id;
    // Karşılıksız: açılış evrakı cari seçilmeden (S48) · açılış senedi cari seçilerek (S48) · formdan carisiz cari seçilmeden (S66) · formdan carisiz cari seçilerek (S66).
    await step("AC-1 karşılıksız", admin.post(`/api/workspace/cheques/${ids.openIn}/actions`, { action: "bounce", date: "2026-05-01" }));
    await step("AS-2 karşılıksız + cari", admin.post(`/api/workspace/cheques/${ids.openNote}/actions`, { action: "bounce", date: "2026-05-01", accountId: ids.debtor }));
    await step("FC-1 karşılıksız", admin.post(`/api/workspace/cheques/${ids.freeIn}/actions`, { action: "bounce", date: "2026-05-01" }));
    await step("FC-2 karşılıksız + cari", admin.post(`/api/workspace/cheques/${ids.freeIn2}/actions`, { action: "bounce", date: "2026-05-01", accountId: ids.debtor }));
    // KG-5: Excel'den yüklenen kartlar — P > 0 (6.000 / 1.500), P = 0 (2.000), P = T (900 / 900).
    const plan = (name, total, paid) => [name, total, "6", "15.12.2026", paid, "01.03.2026"];
    const imported = await step("Excel kartı", admin.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], plan("Kart Bir", "6000", "1500"), plan("Kart İki", "2000", "0"), plan("Kart Üç", "900", "900")], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "kart.xlsx", linkRecords: false }));
    steps["Excel kartı sayısı"] = { status: imported.created === 3 ? 200 : 0, body: JSON.stringify(imported).slice(0, 400) };
  });
  after(async () => server?.close());

  it("modül açılışları tek madde, karşı hesap 519, açılış sınıfı (M-01, M-02 / M-03, M-04, M-05, M-07; KG-1); 500 Sermaye'ye hiçbir olay yazmaz", () => {
    need("Kasa açılışı", "borçlu cari", "alacaklı cari", "banka açılışı", "kart açılışı", "stok açılışı");
    const entries = server.app.ledger.build();
    const cash = entries.find(entry => entry.source === "Kasa açılışı");
    assert.deepEqual(linesOf(cash), ["A 519 1000", "B 100 1000"]);
    const opening = entries.filter(entry => entry.source.startsWith("Cari") && entry.lines.some(line => line.account === "519"));
    assert.deepEqual(opening.map(linesOf).sort(), [["A 120 300", "B 519 300"].sort(), ["A 320 200", "B 519 200"]].map(x => x.sort()).sort().map(x => x).sort().reverse().length ? opening.map(linesOf).sort() : []);
    assert.deepEqual(opening.map(linesOf).map(x => x.join("|")).sort(), ["A 519 300|B 120 300", "A 320 200|B 519 200"].sort());
    const stock = entryOf(entries, "stock-open:");
    assert.deepEqual(stock.map(linesOf), [["A 519 200", "B 153 200"]]);
    const bank = entryOf(entries, "bank:").filter(entry => entry.lines.some(line => line.account === "519"));
    assert.deepEqual(bank.map(linesOf).map(x => x.join("|")).sort(), ["A 309.01 400|B 519 400", "A 519 5000|B 102.01 5000"].map(x => x.split("|").sort().join("|")).sort());
    for (const entry of [cash, ...opening, ...stock, ...bank]) assert.equal(entry.cls, 2, `${entry.id}: açılış sınıfı`);
    assert.equal(balances(entries)["500"] ?? 0, 0, "500 Sermaye — yalnız Açılış Eşleştirme Fişi yazar");
  });

  it("açılış İŞARETTEN tanınır: göçten sonra yazılmış 'AÇILIŞ BAKİYESİ' Borç Yaz 602, 'Açılış bakiyesi' Alacak Yaz 770 (C-01 / C-02; P1, K8-1)", () => {
    need("Borç Yaz AÇILIŞ", "Alacak Yaz açılış");
    const entries = server.app.ledger.build();
    const debt = entries.find(entry => entry.text === "AÇILIŞ BAKİYESİ");
    const credit = entries.find(entry => entry.text === "Açılış bakiyesi" && entry.source === "Cari (alacak yaz)" && entry.lines[0].credit + entry.lines[0].debit === 3000);
    assert.deepEqual(linesOf(debt), ["A 602 70", "B 120 70"]);
    assert.deepEqual(linesOf(credit), ["A 320 30", "B 770 30"]);
    assert.equal(debt.cls, undefined);
  });

  it("açılış evrakı 519 (M-08 / M-09: 602 / 770'e yazılmaz); formdan carisiz evrak 649.90 / 770.90 (S49); karşılıksız: açılışta B 519 / A 101, carisizde B 649.90 / A 101, cari seçilince cari borçlanır (S48, S66)", async () => {
    need("açılış portföyü", "carisiz alınan", "carisiz alınan 2", "carisiz verilen", "AC-1 karşılıksız", "AS-2 karşılıksız + cari", "FC-1 karşılıksız", "FC-2 karşılıksız + cari");
    const entries = server.app.ledger.build();
    const of = id => entries.filter(entry => entry.id.endsWith(`:${id}`) && entry.id.startsWith("account:free-")).map(entry => `${entry.id.split(":")[1]}|${linesOf(entry).join("|")}`).sort();
    assert.deepEqual(of(ids.openIn), ["free-bounce|A 101.01 800|B 519 800", "free-in|A 519 800|B 101.01 800"]);
    assert.deepEqual(of(ids.openNote), ["free-in|A 519 150|B 121.01 150"], "cari seçilen karşılıksızda free-bounce yok (cari borç satırı)");
    assert.deepEqual(of(ids.openOut), ["free-out|A 103 120|B 519 120"]);
    assert.deepEqual(of(ids.freeIn), ["free-bounce|A 101.01 250|B 649.90 250", "free-in|A 649.90 250|B 101.01 250"]);
    assert.deepEqual(of(ids.freeIn2), ["free-in|A 649.90 90|B 101.01 90"]);
    assert.deepEqual(of(ids.freeOut), ["free-out|A 103 60|B 770.90 60"]);
    const cheque = entries.filter(entry => entry.source === "Çek / Senet" && !entry.id.startsWith("account:free-")).map(entry => linesOf(entry).join("|")).sort();
    assert.deepEqual(cheque, ["A 101.01 90|B 120 90", "A 121.01 150|B 120 150"], "cari seçilen karşılıksız: B CH / A 101 | 121");
    assert.equal(entries.find(entry => entry.id === `account:free-in:${ids.openIn}`).cls, 2);
    assert.equal(entries.find(entry => entry.id === `account:free-bounce:${ids.openIn}`).cls, undefined, "karşılıksız olağan sınıfta");
    // Cari seçilen evrak o cariye bağlandı; cari bakiyesi: açılış 300 + Borç Yaz 70 + 150 + 90 = 610.
    const list = await must("cari listesi", admin.get("/api/workspace/accounts?status=all&limit=50"));
    assert.equal(Number(list.accounts.find(account => account.id === ids.debtor).balance), 610);
    // Carili evrakta başka cari seçilemez (yanlış cariye borç yazılmasın).
    const carili = (await must("carili evrak", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "CC-1", bank: "Akbank", accountId: ids.debtor, amount: "10", issueDate: "2026-06-01", dueDate: "2026-12-01" }))).id;
    await refused("carili evrakta başka cari", admin.post(`/api/workspace/cheques/${carili}/actions`, { action: "bounce", date: "2026-06-02", accountId: ids.creditor }), 400);
  });

  it("KG-5: yüklenen kart TEK madde B CH (T − P) / A 519, P maddesiz, tarih yüklemenin YEREL günü; P = 0 → T; P = T → madde yok (H-06, B5)", async () => {
    need("Excel kartı", "Excel kartı sayısı");
    const entries = server.app.ledger.build();
    const today = (await must("bugün", admin.get("/api/workspace/ledger/lock"))).today;
    const cards = entries.filter(entry => entry.source === "Taksit kartı açılışı (Excel / tablo)");
    assert.deepEqual(cards.map(entry => linesOf(entry).join("|")).sort(), ["A 519 2000|B 120 2000", "A 519 4500|B 120 4500"]);
    for (const entry of cards) {
      assert.equal(entry.date, today, "yüklemenin yerel günü (kartın Kayıt Tarihi 01.03.2026 değil)");
      assert.equal(entry.cls, 2);
    }
    assert.equal(entries.filter(entry => entry.source === "Taksit açılışı (devir)").length, 0, "P maddesiz");
    assert.equal(entries.filter(entry => entry.source === "Taksit kartı").length, 0, "602'ye yeni satış yok");
  });

  it("açılış sınıfı yalnız SIRAYI değiştirir: aynı gün Kasa açılışı olağan Kasa girişinden önce; borç = alacak her maddede", () => {
    need("Kasa açılışı", "Kasa girişi", "banka açılışı", "stok açılışı", "açılış portföyü");
    const entries = server.app.ledger.build();
    const day = entries.filter(entry => entry.date === "2026-02-01");
    // Tur 1b (ders 7): açılış maddeleri KAYNAĞINDAN tanınır (cls'e bakılmadan) — Kasa açılışı, banka / kart açılış fişi (karşı hesabı 500 / 519), stok açılışı, Excel açılış portföyü.
    // Olağan Kasa girişi (aynı gün) hepsinden SONRA gelmeli: açılış sınıfı (G-4 / M-01, B9) olmasa banka fişi (sınıf 39) ve evrak (yazım sırası FREE_SEQ) Kasa girişinden (sınıf 32)
    // sonra gelir. (Önceki biçim cls'i olmayan kodda boş koşulla geçiyordu.)
    const isOpening = entry => entry.source === "Kasa açılışı" || entry.id.startsWith("stock-open:") || (entry.id.startsWith("bank:") && entry.lines.some(line => line.account === "500" || line.account === "519")) || (entry.id.startsWith("account:free-in:") && ["AC-1", "AS-2"].includes(server.app.store.get("SELECT serial_no AS no FROM cheques WHERE id = ?", entry.id.slice("account:free-in:".length))?.no));
    const plain = day.findIndex(entry => entry.text === "Olağan giriş");
    const openings = day.map((entry, index) => (isOpening(entry) ? index : -1)).filter(index => index >= 0);
    assert.ok(plain >= 0 && openings.length >= 5, `aynı gün açılışlar ve olağan giriş: ${day.map(entry => entry.id).join(", ")}`);
    assert.ok(openings.every(index => index < plain), `açılış maddeleri olağan Kasa girişinden önce: ${day.map(entry => `${entry.id}:${entry.cls ?? "-"}`).join(", ")}`);
    for (const entry of entries) assert.equal(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0, `${entry.id} dengesiz`);
  });

  it("Mutabakat Testi: 'Açılış Karşılığı' (519 / 500) denetimi temiz ve ikinci yükleyici = defter (B2); stock:opening 519'a göre; expected() 519'u içermez (K6)", async () => {
    const result = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    const of = code => result.checks.find(check => check.code === code);
    assert.ok(of("opening:519"), "Açılış Karşılığı denetimi yok");
    assert.equal(of("opening:519").ok, true, JSON.stringify(of("opening:519")));
    assert.equal(of("opening:500").ok, true);
    const want = -(1000 + 300 + 5000 + 200 + 800 + 150 + 4500 + 2000) + (200 + 400 + 120 + 800);
    assert.equal(of("opening:519").subledger, want);
    assert.equal(of("stock:opening").ok, true);
    assert.equal(result.ok, true, JSON.stringify(result.checks.filter(check => !check.ok && !check.notice)));
    assert.equal(Object.hasOwn(server.app.ledger.expected([], [], { every: true }), "519"), false, "519 alt defter hesabı değil (Açılış Eşleştirme Fişi yazabilir)");
  });

  it("Banka İşlem Kartı ve Banka Ayarları 519 okur; saklı satır kodu 500 kalır (B3)", async () => {
    need("banka açılışı");
    const event = server.app.store.get("SELECT e.id FROM fin_events e WHERE e.type = 'opening' LIMIT 1");
    const card = await must("İşlem Kartı", admin.get(`/api/workspace/bank/events/${event.id}`));
    const lines = card.lines || card.event?.lines || [];
    assert.ok(lines.some(line => line.gl === "519" && line.glName === "Eşleştirilecek Açılış Bakiyeleri"), JSON.stringify(lines));
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE role IN ('opening', 'closing') AND gl = '500'").n > 0, true, "saklı kod 500");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE gl = '519'").n, 0);
  });

  it("S53: kilitsiz geçmiş yılda Ç5-A maddesi varsa Defter Mutabakatı / Mutabakat Testi uyarısı; yıl kilitlenince kalkar", async () => {
    await must("geçen yıl Kasa", admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2026-06-01", description: "x" }));
    // Geçen yıl tarihli açılış evrakı (bugün 2026 → geçmiş yıl 2025).
    const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
    await must("2025 portföyü", admin.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "OLD-1", "Akbank", "Eski", "40", "15.12.2026", "15.12.2025"]], headerAt: 0, roles, fileName: "eski.xlsx", post: false }));
    const before = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    const info = before.checks.find(check => check.code === "ledger:unlocked-years");
    assert.ok(info && info.ok === true && info.info === true && !info.notice && info.years.includes("2025"), JSON.stringify(info));
    assert.equal(before.ok, true, "bilgi satırı Mutabakat Testi'nin sonucunu bozmaz (K8-4)");
    const report = await must("Defter Mutabakatı", admin.get("/api/workspace/report-center/defter-mutabakati"));
    assert.ok(report.rows.some(row => row[1] === "Kilitlenmemiş Geçmiş Yıl (2025) Yeni Kuralla Hesaplandı — Beyan Edildiyse Yılı Kilitleyin" && row[5] === "Tutarlı"), JSON.stringify(report.rows.slice(-5)));
    assert.ok(report.summary.some(([label, value]) => label === "Sonuç" && value === "Tutarlı"), "bilgi satırı Sonuç'u bozmaz");
    await must("2025 kilidi", admin.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" }));
    const later = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(later.checks.some(check => check.code === "ledger:unlocked-years"), false);
  });
});

describe("2.5.0 Ç5-A tur 1 — KG-16 'Açılış Olabilir' (göç 48): aday kuralı, onay / ret, yetki, kilit izi, göç 49", () => {
  let first;
  let server;
  let admin;
  let acc;
  let file;
  const NOTES = ["Açılış bakiyesi", "AÇILIŞ", "Açilış farkı", "Acilis", "  açılış devri", "Devir bakiyesi", "Devreden", "2025 açılış farkı", "ACILIS BAKİYESİ"];
  const WANT = ["Açılış bakiyesi", "AÇILIŞ", "Açilış farkı", "Acilis", "  açılış devri", "ACILIS BAKİYESİ"];
  // Eski sürüm verisi benzetimi (GERÇEK v2.4.9 verisi: kanıt docs/kanit/2026-11-11/c5a1-v249-*): aday durumları ve evrak işareti boşaltılır, şema 47'ye indirilir → göç 48 / 49
  // yeniden koşar (göç öncesi yedeğin geri yüklenmesi de böyle göçü yeniden koşturur — B8).
  const downgrade = async () => {
    await server.app.close();
    const db = new DatabaseSync(file);
    // Eski kodda (göç 48 / 49 yok) sütunlar yoktur: yalnız var olanı boşalt (hazırlık eski şemada da yürür; ders 38).
    const has = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
    if (has("account_entries", "opening_review")) db.exec("UPDATE account_entries SET opening_review = ''");
    if (has("cheques", "is_opening")) db.exec("UPDATE cheques SET is_opening = 0");
    db.exec("PRAGMA user_version = 47;");
    db.close();
    server = await startTestServer({ dataDir: first.dataDir, backupDir: path.join(first.root, "backups"), now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
  };
  before(async () => {
    first = server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    acc = (await must("cari", admin.post("/api/workspace/accounts", { name: "Eski Cari", registeredOn: "2025-01-01", openingBalance: "100", openingSide: "auto" }))).id;
    for (const [index, note] of NOTES.entries()) await must(note, admin.post(`/api/workspace/accounts/${acc}/entries`, { kind: index % 2 ? "credit" : "debt", amount: String(10 + index), date: "2025-06-01", note }));
    const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
    await must("portföy", admin.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "EP-1", "Akbank", "Eski", "70", "15.12.2026", "01.02.2026"]], headerAt: 0, roles, fileName: "e.xlsx", post: false }));
    file = server.app.store.get("PRAGMA database_list").file;
    await downgrade();
  });
  after(async () => {
    await server?.app?.close?.();
    removeTestDir(first.root);
  });

  it("göç 48: aday kuralı (B6, S65) — Türkçe küçük harf + ç/ı/ş katlaması, baştaki boşluk; 'Devir' / 'Devreden' / ortada geçen girmez; Açılış Bakiyesi satırı (is_opening) aday değil; onaya kadar 519 (S47)", async () => {
    const { isOpeningCandidateNote } = await openingModule();
    for (const note of NOTES) assert.equal(isOpeningCandidateNote(note), WANT.includes(note), note);
    const list = await must("liste", admin.get("/api/workspace/opening-review"));
    // Program açıklamayı kaydederken baştaki boşluğu atar (form / API); katlama işlevi baştaki boşluğu da tanır (yukarıda).
    assert.deepEqual(list.items.map(item => item.note).sort(), WANT.map(note => note.trim()).sort());
    assert.equal(list.counts.candidate, WANT.length);
    const entries = server.app.ledger.build();
    for (const item of list.items) {
      const entry = entries.find(e => e.id === `account:${item.id}`);
      assert.ok(entry.lines.some(line => line.account === "519"), `${item.note}: onaya kadar 519`);
      assert.equal(entry.cls, 2);
    }
    const plain = entries.filter(e => ["Devir bakiyesi", "Devreden", "2025 açılış farkı"].includes(e.text));
    assert.equal(plain.length, 3);
    for (const entry of plain) assert.ok(entry.lines.some(line => line.account === "602" || line.account === "770"), entry.text);
    // göç 49: ilk olay notu "Açılış portföyü (Excel/Sheets)" → işaret.
    assert.equal(server.app.store.get("SELECT is_opening AS v FROM cheques WHERE serial_no = 'EP-1'").v, 1);
  });

  it("onay → 519 (M-02 / M-03), ret → 602 / 770 (C-01 / C-02); tutar / tarih / yön / is_opening DEĞİŞMEZ; kilit izi değişmez (B4); aynı karar tekrarı yazmaz; yetkisiz 403; listede olmayan 404", async () => {
    const list = (await must("liste", admin.get("/api/workspace/opening-review"))).items;
    const debt = list.find(item => item.note === "Açılış bakiyesi");
    const credit = list.find(item => item.note === "AÇILIŞ");
    const before = server.app.store.get("SELECT amount, date, kind, is_opening AS o FROM account_entries WHERE id = ?", credit.id);
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" }));
    const digest = lockDigestOf(server.app.store, "2025-12-31", { version: LOCK_SQL_VERSION });
    await must("onay (kilitli dönemde de — K8-2)", admin.post(`/api/workspace/opening-review/${debt.id}`, { decision: "confirm" }));
    const reject = await must("ret", admin.post(`/api/workspace/opening-review/${credit.id}`, { decision: "reject" }));
    assert.equal(reject.changed, true);
    assert.equal((await must("ret tekrar", admin.post(`/api/workspace/opening-review/${credit.id}`, { decision: "reject" }))).changed, false);
    assert.equal(lockDigestOf(server.app.store, "2025-12-31", { version: LOCK_SQL_VERSION }), digest, "işaret kilit izine girmez (kaynak izi sürümü değişmez)");
    assert.deepEqual(server.app.store.get("SELECT amount, date, kind, is_opening AS o FROM account_entries WHERE id = ?", credit.id), before);
    assert.equal(server.app.store.get("SELECT is_opening AS o FROM account_entries WHERE id = ?", debt.id).o, 0, "onay is_opening'e yazılmaz (B7: Açılış Bakiyesi satırı cari başına bir)");
    const entries = server.app.ledger.build();
    assert.ok(entries.find(e => e.id === `account:${debt.id}`).lines.some(line => line.account === "519"));
    assert.ok(entries.find(e => e.id === `account:${credit.id}`).lines.some(line => line.account === "770"));
    const rest = await must("liste", admin.get("/api/workspace/opening-review?all=1"));
    assert.deepEqual([rest.counts.candidate, rest.counts.confirmed, rest.counts.rejected], [WANT.length - 2, 1, 1]);
    await refused("geçersiz karar", admin.post(`/api/workspace/opening-review/${debt.id}`, { decision: "x" }), 400);
    const plainId = server.app.store.get("SELECT id FROM account_entries WHERE note = 'Devreden'").id;
    await refused("listede değil", admin.post(`/api/workspace/opening-review/${plainId}`, { decision: "confirm" }), 404);
    const staff = await createUser(server, admin, { username: "personel1", role: "personel" });
    await refused("yetkisiz liste", staff.get("/api/workspace/opening-review"), 403);
    await refused("yetkisiz karar", staff.post(`/api/workspace/opening-review/${debt.id}`, { decision: "reject" }), 403);
    // Mutabakat Testi temiz (Açılış Karşılığı dahil); kilitli dönemde Kural Değişikliği Farkı görünür (donmuş: 2.5.0-defter adayla, onay / ret sonrası fark — fiş tur 2).
    const result = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(result.checks.find(check => check.code === "opening:519").ok, true);
  });

  it("göç eşgüçlü: yeniden koşan göç 48 kararları bozmaz (onay / ret aynen), adayları çoğaltmaz", async () => {
    const counts = (await must("liste", admin.get("/api/workspace/opening-review?all=1"))).counts;
    await server.app.close();
    const db = new DatabaseSync(file);
    db.exec("PRAGMA user_version = 47;");
    db.close();
    server = await startTestServer({ dataDir: first.dataDir, backupDir: path.join(first.root, "backups"), now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    assert.deepEqual((await must("liste", admin.get("/api/workspace/opening-review?all=1"))).counts, counts);
  });

  it("göçten sonra yazılan 'Açılış…' Borç Yaz aday OLMAZ (K8-1)", async () => {
    const entry = await must("yeni", admin.post(`/api/workspace/accounts/${acc}/entries`, { kind: "debt", amount: "5", date: "2026-06-01", note: "Açılış bakiyesi" }));
    const id = entry.id || entry.entry?.id;
    assert.equal(server.app.store.get("SELECT opening_review AS v FROM account_entries WHERE note = 'Açılış bakiyesi' AND date = '2026-06-01'").v, "", JSON.stringify(id));
  });
});

describe("2.5.0 Ç5-A tur 1 — Silinenler bağlantı noktası (B8 / S51; routes/accounts.mjs tur 2b-2 sonrası bağlanır)", () => {
  it("restoredOpeningReview: işaretli silinmiş + başka açılış → candidate; 2.4.x yükü 'Açılış…' → candidate; 2.5.0 yükü durumunu korur; işaretle dönen ''", async () => {
    const { restoredOpeningReview } = await openingModule();
    assert.equal(restoredOpeningReview({ kind: "debt", source: "", isOpening: 1, note: "x" }, 0), "candidate");
    assert.equal(restoredOpeningReview({ kind: "debt", source: "", isOpening: 1, note: "x" }, 1), "");
    assert.equal(restoredOpeningReview({ kind: "credit", source: "", note: "AÇILIŞ" }, 0), "candidate");
    assert.equal(restoredOpeningReview({ kind: "credit", source: "", note: "Devir" }, 0), "");
    assert.equal(restoredOpeningReview({ kind: "debt", source: "", openingReview: "rejected", note: "Açılış" }, 0), "rejected");
    assert.equal(restoredOpeningReview({ kind: "in", source: "", note: "Açılış" }, 0), "");
  });
});
