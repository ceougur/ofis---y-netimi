// 2.5.0 Ç5-A tur 2c — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla üretilmiş kilitli veride açılış düzeninin bütün akışı ve SINIF LİSTESİ (her açılış türü × kilitli / kilitsiz;
// 'şüpheli kaydı olan cari' sınıfı İş 4'e bağlı — bu turda yok). docs/erp/C5-ACILIS-TASARIM.md §2.4, §2.7, §3.3, §17.10; KULLANICI S47 = A; BAŞ MİMAR B14, B16; KG-15 A; EK-1 M7 / §4 (9); M-11.
// Akış: güncelle → Açılış Olabilir listesi (kilitli dönemde aday varken Kural Farkı fişi pasif — B16) → karar → Kural Farkı Düzeltme Fişi → Düzeltildi → değişmez (1–5 sınıfı karma =
// yeni kuralla baştan türetilmiş defter) → Açılış Eşleştirme Fişi (519 → 500 / 570) → Açılış Karşılığı tutarlı → Kural Farkı fişi ters kaydedilir → uyarı geri gelir → açık dönemde açılış
// silinir → 519 eşleştirmenin tersine geçer (ENGELLENMEZ, bilgi satırı).
// BEKLENEN SAYILAR girdilerden elle (ders 5; programın kodundan değil): v2.4.9 kuralında açılışların karşısı 500 (Kasa, cari, banka, stok) ve 602 (alınan açılış çeki, Excel kartı,
// "Açılış…" Borç Yaz — 2.4.9 açılışı AÇIKLAMADAN tanıyordu, §2.3: 500); 2.5.0'da 519. Kilitli dönem (≤ 30.06.2026): Kasa 1.000 + cari 300 − tedarikçi 200 + banka 5.000 + stok
// 10 × 20 + onaylanan aday 70 = 500 farkı 6.370; çek 800 + kart 2.000 = 602 farkı 2.800 (fişin yılı = farkın yılı → aynı hesap, §3.3); 519 9.170. Açık dönem: cari 400 + senet 150 + kart 900 + banka 1.000 + stok 5 × 10 = 2.500 → 519;
// reddedilen aday 50 → 602.
// Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Eski sürüm etiketi yoksa atlanır (CI'de etiket var).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
const LOCK = "2026-06-30";
const RULE = "/api/admin/ledger/rule-diff-correction";
const MATCH = "/api/admin/ledger/opening-match";
let seq = 0;
const rid = () => `v249-sinif-${process.pid}-${String(++seq).padStart(6, "0")}`;
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const lineText = lines => lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
const class15 = entries => {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (/^[1-5]/.test(line.account)) out.set(line.account, (out.get(line.account) || 0) + line.debit - line.credit);
  return out;
};

describe("Ç5-A tur 2c — v2.4.9 kilitli verisinde açılış düzeni (kabul D): sınıf listesi, aday → Kural Farkı → Düzeltildi → eşleştirme → ters kayıt", { skip: SKIP }, () => {
  let root = null;
  let server = null;
  let api = null;
  const ids = {};
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c5a2c-v249-sinif-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };
    const planRoles = { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" };
    const head = ["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"];
    const chequeHead = ["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"];
    // Kilitli dönem (v2.4.9, bugün 15.03.2026).
    let old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-03-15T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      await must("Kasa açılışı", o.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-03-01" }));
      ids.lockedDebtor = (await must("kilitli borçlu", o.post("/api/workspace/accounts", { name: "Kilitli Borçlu", registeredOn: "2026-03-01", openingBalance: "300", openingSide: "auto" }))).id;
      await must("kilitli tedarikçi", o.post("/api/workspace/accounts", { name: "Kilitli Tedarikçi", type: "supplier", registeredOn: "2026-03-01", openingBalance: "200", openingSide: "credit" }));
      await must("banka açılışı", o.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-03-01", amount: "5.000", confirmed: true } }));
      await must("stok açılışı", o.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "10", openingDate: "2026-03-01" }));
      await must("açılış çeki", o.post("/api/workspace/cheques/import", { matrix: [chequeHead, ["Alınan", "Çek", "KC-1", "Akbank", "Eski Keşideci", "800", "15.12.2026", "01.03.2026"]], headerAt: 0, roles, fileName: "acilis.xlsx", post: false }));
      await must("Excel kartı", o.post("/api/workspace/plans/import", { matrix: [head, ["Kart Kilitli", "2000", "4", "15.12.2026", "0", "01.03.2026"]], headerAt: 0, roles: planRoles, fileName: "kart.xlsx", linkRecords: false }));
      await must("'Açılış…' Borç Yaz (kilitli)", o.post(`/api/workspace/accounts/${ids.lockedDebtor}/entries`, { kind: "debt", amount: "70", date: "2026-03-02", note: "Açılış farkı" }));
      ids.lockedCandidate = old.app.store.get("SELECT id FROM account_entries WHERE note = 'Açılış farkı'").id;
    } finally {
      await old.close();
    }
    // Açık dönem (v2.4.9, bugün 15.09.2026) + kilit 30.06.2026.
    old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-09-15T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      ids.openDebtor = (await must("açık borçlu", o.post("/api/workspace/accounts", { name: "Açık Borçlu", registeredOn: "2026-09-01", openingBalance: "400", openingSide: "auto" }))).id;
      await must("ek banka açılışı", o.post("/api/workspace/bank/accounts", { bankName: "İş Bankası", name: "Ek Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-09-01", amount: "1.000", confirmed: true } }));
      await must("ek stok açılışı", o.post("/api/workspace/stock", { name: "Şeker", unit: "Kg", unitPrice: "10", salePrice: "15", openingQty: "5", openingDate: "2026-09-01" }));
      await must("açılış senedi", o.post("/api/workspace/cheques/import", { matrix: [chequeHead, ["Alınan", "Senet", "KS-2", "Akbank", "Eski Borçlu", "150", "20.12.2026", "01.09.2026"]], headerAt: 0, roles, fileName: "acilis2.xlsx", post: false }));
      await must("Excel kartı (açık)", o.post("/api/workspace/plans/import", { matrix: [head, ["Kart Açık", "900", "3", "15.12.2026", "0", "01.09.2026"]], headerAt: 0, roles: planRoles, fileName: "kart2.xlsx", linkRecords: false }));
      await must("'Açılış…' Borç Yaz (açık)", o.post(`/api/workspace/accounts/${ids.openDebtor}/entries`, { kind: "debt", amount: "50", date: "2026-09-02", note: "AÇILIŞ" }));
      ids.openCandidate = old.app.store.get("SELECT id FROM account_entries WHERE note = 'AÇILIŞ'").id;
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-11-20T12:00:00+03:00", fixed: true }, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
    api = await server.login();
  });
  after(async () => {
    await server?.close?.().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("[1] güncelleme: iki aday (kilitli 1); Kural Farkı fişi aday varken pasif (B16); karar → pasiflik kalkar", async () => {
    const page = await must("aday listesi", api.get("/api/workspace/opening-review?limit=50"));
    assert.deepEqual(page.items.map(item => [item.id, item.locked]), [[ids.lockedCandidate, true], [ids.openCandidate, false]]);
    assert.equal(page.counts.lockedCandidate, 1);
    const blocked = await must("Kural Farkı (adaylı)", api.get(RULE));
    assert.equal(blocked.code, "rule-diff-candidates");
    await must("kilitli aday onay", api.post(`/api/workspace/opening-review/${ids.lockedCandidate}`, { decision: "confirm" }));
    await must("açık aday ret", api.post(`/api/workspace/opening-review/${ids.openCandidate}`, { decision: "reject" }));
    const open = await must("Kural Farkı (kararlı)", api.get(RULE));
    assert.equal(open.disabled, false, open.reason);
  });

  it("[2] sınıf listesi: kilitli dönemdeki her açılış türü kural farkında (eski 500 / 602 → 519); açık dönemdekiler farkta YOK, defterde 519 (reddedilen aday 602)", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    const entries = server.app.ledger.build();
    const bySource = prefix => view.sources.filter(item => item.id.startsWith(prefix));
    const has519 = item => item.deltas.some(delta => delta.account === "519");
    // Cariye işlenmemiş evrakın maddesi "account:free-in:<evrak>" (cari satırı biçiminde).
    const locked = { Kasa: bySource("cash:"), Cari: view.sources.filter(item => item.id.startsWith("account:") && !item.id.startsWith("account:free-")), Banka: bySource("bank:"), Stok: bySource("stock"), Evrak: bySource("account:free-"), Kart: bySource("plan") };
    for (const [kind, items] of Object.entries(locked)) assert.ok(items.length && items.every(has519), `kilitli ${kind}: kural farkında, 519'a geçiyor (${items.length}; kaynaklar ${[...new Set(view.sources.map(item => item.id.split(":")[0]))].join(",")})`);
    assert.equal(locked.Cari.length, 3, "kilitli cari: borçlu + tedarikçi açılışı + onaylanan aday");
    assert.ok(locked.Cari.some(item => item.id === `account:${ids.lockedCandidate}` && item.deltas.some(delta => delta.account === "500" && delta.minor === 7000)), "onaylanan kilitli aday: 2.4.9 açıklamadan açılış saymıştı (500) → 519");
    assert.ok(view.sources.every(item => item.date <= LOCK), "kural farkı yalnız kilitli dönemde");
    const openEntries = entries.filter(entry => entry.date > LOCK);
    for (const [kind, prefix] of [["Cari", "account:a"], ["Banka", "bank:"], ["Stok", "stock"], ["Evrak", "account:free-"], ["Kart", "plan"]]) {
      const items = openEntries.filter(entry => entry.id.startsWith(prefix) && entry.lines.some(line => line.account === "519"));
      assert.ok(items.length >= 1, `açık dönem ${kind}: defterde 519 (${items.length})`);
    }
    const rejected = entries.find(entry => entry.id === `account:${ids.openCandidate}`);
    assert.ok(rejected.lines.some(line => line.account === "602") && !rejected.lines.some(line => line.account === "519"), "reddedilen açık aday 602");
  });

  it("[3] Kural Farkı Düzeltme Fişi 01.07.2026: B 500 6.370 / B 602 2.800 / A 519 9.170; Düzeltildi; değişmez (1–5 karma = baştan)", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    assert.equal(view.date, "2026-07-01");
    assert.deepEqual(lineText(view.lines), lineText([{ account: "500", debit: 637_000, credit: 0 }, { account: "602", debit: 280_000, credit: 0 }, { account: "519", debit: 0, credit: 917_000 }]));
    assert.deepEqual(view.excluded, [], "alt defter hesabı farkı yok");
    await must("fiş", api.post(RULE, { requestId: rid(), digest: view.digest, confirm: true }));
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const item = result.checks.find(check => check.code === "ledger:rule-diff");
    assert.ok(item?.ok && item.corrected, `Düzeltildi: ${JSON.stringify(item).slice(0, 300)}`);
    assert.equal(result.failures.some(check => check.code === "ledger:rule-diff"), false);
    const karma = class15(server.app.ledger.book({}));
    const fresh = class15(server.app.ledger.build().filter(entry => !String(entry.id).startsWith("voucher")));
    const bad = [...new Set([...karma.keys(), ...fresh.keys()])].filter(key => (karma.get(key) || 0) !== (fresh.get(key) || 0));
    assert.deepEqual(bad, [], "fişten sonra 1–5 sınıfı karma = yeni kuralla baştan türetilmiş defter");
  });

  it("[4] Açılış Eşleştirme 20.11.2026: 519 = 11.670 alacak (fiş 9.170 + açık dönem 2.500); A 500 10.000 + A 570 1.670 → 519 sıfır; Açılış Karşılığı tutarlı", async () => {
    const view = await must("eşleştirme", api.get(MATCH));
    assert.equal(view.balanceMinor, -1_167_000);
    assert.deepEqual(Object.fromEntries(view.parts.map(part => [part.kind, part.minor])), { vouchers: -917_000, accounts: -40_000, cheques: -15_000, plans: -90_000, bank: -100_000, stock: -5_000 }, "döküm: senet 'account:free-in' maddesi Açılış Evrakı'nda");
    const fresh = class15(server.app.ledger.build().filter(entry => !String(entry.id).startsWith("voucher")));
    await must("eşleştirme fişi", api.post(MATCH, { requestId: rid(), date: "2026-11-20", lines: [{ account: "500", side: "credit", amount: "10.000" }, { account: "570", side: "credit", amount: "1.670" }], confirm: true }));
    const karma = class15(server.app.ledger.book({}));
    const diff = Object.fromEntries([...new Set([...karma.keys(), ...fresh.keys()])].map(key => [key, (karma.get(key) || 0) - (fresh.get(key) || 0)]).filter(([, minor]) => minor));
    assert.deepEqual(diff, { 500: -1_000_000, 570: -167_000, 519: 1_167_000 }, "karma − baştan = yalnız eşleştirme fişinin satırları (kural farkı fişi değişmezi korur)");
    assert.equal(karma.get("519") || 0, 0);
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    for (const code of ["opening:519", "opening:500"]) assert.equal(result.checks.find(check => check.code === code)?.ok, true, code);
  });

  it("[5] Kural Farkı fişi ters kaydedilir → uyarı geri gelir (Mizan'da 519 9.170 borç — kural farkı düzeltilmemiş; canlı türetmede 519 = 0, bilgi satırı YOK); açık dönemde açılış silinir → 519 eşleştirmenin tersine geçer: ENGELLENMEZ, bilgi satırı", async () => {
    const voucher = server.app.store.get("SELECT id FROM ledger_vouchers WHERE type = 'rule-diff-correction'").id;
    await must("ters kayıt", api.post(`/api/admin/ledger/vouchers/${voucher}/reverse`, { requestId: rid() }));
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const item = result.checks.find(check => check.code === "ledger:rule-diff");
    assert.ok(item && item.ok === false && !item.corrected, `uyarı geri geldi: ${JSON.stringify(item).slice(0, 200)}`);
    const karma519 = class15(server.app.ledger.book({})).get("519") || 0;
    assert.equal(karma519, 917_000, "Mizan (karma): kilitli dönemin farkı düzeltilmemiş → 519 9.170 borç (uyarı bunu söyler)");
    assert.equal(result.checks.find(check => check.code === "opening:519-inverse"), undefined, "canlı türetmede (Mutabakat) 519 = 0: ters bakiye bilgi satırı yok — fark kural farkı uyarısında");
    const entry = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND is_opening = 1", ids.openDebtor).id;
    await must("açık dönem cari açılışını sil", api.del(`/api/workspace/accounts/${ids.openDebtor}/entries/${entry}`));
    const after = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const inverse = after.checks.find(check => check.code === "opening:519-inverse");
    assert.ok(inverse?.info && inverse.ok && inverse.ledger === 400 && inverse.matched === 11670, `bilgi satırı: ${JSON.stringify(inverse)}`);
    assert.equal(after.failures.some(check => check.code === "opening:519-inverse"), false, "bilgi satırı sapma değil");
  });
});
