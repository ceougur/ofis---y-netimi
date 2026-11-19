// 2.5.0 Ç7a tur 2b — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla üretilmiş KİLİTLİ veride KG-6 (KULLANICI KARARI 05.11 17:16 (5) KG-6 = A; S177 = A, S178 = A;
// docs/erp/C7A-BANKA-TASARIM.md §14). Akış: güncelle → donmuş defter DEĞİŞMEDİ → Kural Değişikliği Farkı yeni kuralın farkını TAM gösterir (madde madde, elle) → Kural Farkı
// Düzeltme Fişi: 108.01 alt defter hesabı olduğu için KG-6 maddeleri fişin DIŞINDA (C5 B14 (a), S76 = A "bu fark fişle düzeltilmez" — Kilidi Aç → Yeniden Kilitle) → Kilidi Aç →
// Yeniden Kilitle → fark kalmaz, donmuş defter yeni kuralla → açık dönemde yeni satış yeni kuralla.
// SINIF LİSTESİ (beklenenler elle — kitap KG-6 + POS kartı: BSMV Dahil, Tek Çekim %2,5, 3 Taksit %3,5, valör 2 iş günü, İadede Komisyon Oransal; kilit 31.03.2026):
//   C1 ikisi kilitli   : 02.03 satış 10.000 (komisyon 250), valör 04.03        → fark pos-commission {653 +250, 108.01 −250}; gün fişi 04.03 {653 −250, 108.01 +250}
//   C4 iade (kilitli)  : 05.03 satış 5.000 (125; veri 31.03'te girildiği için valör 09.03'ün gün fişi satışla aynı anda yazılır), 06.03 iade 2.000 (Oransal: 50; satışın kalemi
//                        bankaya geçmiş → iade kendi valörüne, 10.03) → satış {653 +125, 108.01 −125}; iade {108.01 +50, 653 −50}; gün fişi 09.03 {653 −125, 108.01 +125};
//                        iadenin gün fişi 10.03 {653 +50, 108.01 −50}
//   C5 taksitli        : 16.03 satış 12.000 3 taksit (420; kalemler 16.04 / 18.05 / 16.06 — açık dönem) → satış {653 +420, 108.01 −420}; gün fişleri açık dönemde (farkta yok)
//   C2 çekim kilitli / valör açık: 30.03 satış 4.000 (100), valör 01.04 (Şimdi Aktar açık dönemde) → satış {653 +100, 108.01 −100}; gün fişi açık (farkta yok)
//   C3 ikisi açık      : 10.04 satış 2.000 (50), valör 14.04                    → farkta yok (kilitli dönem dışı)
//   Kilitli dönemin KG-6 farkı (toplam): 653 +520, 108.01 −520 (C2 + C5); C1 ve C4 kendi içinde sıfır.
// Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Eski sürüm etiketi yoksa atlanır (CI'de etiket var).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const SKIP = !tagsAvailable(["v2.4.9"]) ? "v2.4.9 etiketi yok" : false;
const LOCK = "2026-03-31";
const RULE = "/api/admin/ledger/rule-diff-correction";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
// Kaynağın farkı: alt hesap / hesap → kuruş (canlı − donmuş).
const deltaOf = item => {
  const out = {};
  for (const delta of item?.deltas || []) {
    const key = delta.sub || delta.account;
    out[key] = (out[key] || 0) + Number(delta.minor);
  }
  return Object.fromEntries(Object.entries(out).filter(([, minor]) => minor));
};
const POS_BODY = bankAccountId => ({
  name: "Ziraat Fiziki POS", bankAccountId, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly",
  provisionDays: 0, refundCommission: "proportional", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-03-01", rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }],
});

describe("Ç7a KG-6 — v2.4.9 kilitli verisinde POS komisyonu (kabul D): fark tam, donmuş defter değişmez, Kilidi Aç → Yeniden Kilitle", { skip: SKIP }, () => {
  let root = null;
  let server = null;
  let api = null;
  const ids = {};
  let frozenBefore = null;
  const sale = (store, entryId) => store.get("SELECT s.id FROM pos_sales s JOIN account_entries e ON e.event_id = s.event_id WHERE e.id = ? AND s.status = 'active'", entryId).id;
  const dayVoucher = (store, valueDate) => store.get("SELECT id FROM fin_events WHERE type = 'pos_settlement' AND status = 'active' AND value_date = ?", valueDate)?.id || "";
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7a3-v249-pos-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-03-31T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      const ziraat = await must("Ziraat", o.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-03-01", amount: "100.000", confirmed: true } }));
      ids.ziraat = ziraat.id || ziraat.account?.id;
      await must("POS Kullan", o.put(`/api/workspace/bank/accounts/${ids.ziraat}`, { usePos: true }));
      const pos = await must("POS", o.post("/api/workspace/bank/pos", POS_BODY(ids.ziraat)));
      ids.pos = pos.pos?.id || pos.id;
      const party = await must("cari", o.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-02-01" }));
      ids.party = party.id;
      const add = async (label, body) => {
        const res = await must(label, o.post(`/api/workspace/accounts/${party.id}/entries`, { method: "card", posId: ids.pos, ...body }));
        return res.entryId || old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", party.id).id;
      };
      ids.c1 = await add("C1 02.03", { kind: "in", amount: "10.000", date: "2026-03-02", posInstallments: 1 });
      ids.c4 = await add("C4 05.03", { kind: "in", amount: "5.000", date: "2026-03-05", posInstallments: 1 });
      ids.c4sale = sale(old.app.store, ids.c4);
      ids.c4refund = await add("C4 iade 06.03", { kind: "out", amount: "2.000", date: "2026-03-06", posRefundOf: ids.c4sale });
      ids.c5 = await add("C5 16.03 taksitli", { kind: "in", amount: "12.000", date: "2026-03-16", posInstallments: 3 });
      ids.c2 = await add("C2 30.03", { kind: "in", amount: "4.000", date: "2026-03-30", posInstallments: 1 });
      await must("Şimdi Aktar (31.03)", o.post("/api/workspace/bank/settle", {}));
      for (const key of ["c1", "c5", "c2"]) ids[`${key}sale`] = sale(old.app.store, ids[key]);
      ids.c4refundSale = old.app.store.get("SELECT s.id FROM pos_sales s JOIN account_entries e ON e.event_id = s.event_id WHERE e.id = ? AND s.kind = 'refund'", ids.c4refund).id;
      ids.gf1 = dayVoucher(old.app.store, "2026-03-04");
      ids.gf4 = dayVoucher(old.app.store, "2026-03-09");
      ids.gf4r = dayVoucher(old.app.store, "2026-03-10");
      assert.ok(ids.gf1 && ids.gf4 && ids.gf4r, "kilitli dönemin gün fişleri yazıldı (v2.4.9)");
    } finally {
      await old.close();
    }
    old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-04-20T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      const res = await must("C3 10.04", o.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "in", amount: "2.000", date: "2026-04-10", method: "card", posId: ids.pos, posInstallments: 1 }));
      ids.c3 = res.entryId || old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", ids.party).id;
      await must("Şimdi Aktar (20.04)", o.post("/api/workspace/bank/settle", {}));
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      ids.c3sale = sale(old.app.store, ids.c3);
      ids.gf2 = dayVoucher(old.app.store, "2026-04-01");
      assert.ok(ids.gf2, "C2'nin gün fişi açık dönemde (01.04)");
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-04-25T12:00:00+03:00", fixed: true }, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
    api = await server.login();
    frozenBefore = server.app.store.get("SELECT COUNT(*) AS n, COALESCE(SUM(debit_minor), 0) AS d, COALESCE(SUM(credit_minor), 0) AS c FROM ledger_snapshots WHERE date <= ?", LOCK);
  });
  after(async () => {
    await server?.close?.().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("[1] Kural Değişikliği Farkı: KG-6 kaynakları sınıf sınıf elle hesapla aynı; açık dönem farkta yok; donmuş defter değişmedi", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    const of = id => view.sources.find(item => item.id === id);
    assert.deepEqual(deltaOf(of(`pos-commission:${ids.c1sale}`)), { 653: 25_000, "108.01": -25_000 }, "C1 satış günü (02.03)");
    assert.deepEqual(deltaOf(of(`bank:${ids.gf1}`)), { 653: -25_000, "108.01": 25_000 }, "C1 gün fişi 04.03 net");
    assert.deepEqual(deltaOf(of(`pos-commission:${ids.c4sale}`)), { 653: 12_500, "108.01": -12_500 }, "C4 satış günü (05.03)");
    assert.deepEqual(deltaOf(of(`pos-commission:${ids.c4refundSale}`)), { 653: -5_000, "108.01": 5_000 }, "C4 iade günü (06.03; Oransal 50)");
    assert.deepEqual(deltaOf(of(`bank:${ids.gf4}`)), { 653: -12_500, "108.01": 12_500 }, "C4 satışın gün fişi 09.03 net");
    assert.deepEqual(deltaOf(of(`bank:${ids.gf4r}`)), { 653: 5_000, "108.01": -5_000 }, "C4 iadenin gün fişi 10.03 net (iade edilen kesinti iade gününde)");
    assert.deepEqual(deltaOf(of(`pos-commission:${ids.c5sale}`)), { 653: 42_000, "108.01": -42_000 }, "C5 taksitli satış günü (16.03; kalemler açık dönemde)");
    assert.deepEqual(deltaOf(of(`pos-commission:${ids.c2sale}`)), { 653: 10_000, "108.01": -10_000 }, "C2 çekim kilitli (30.03)");
    assert.equal(of(`bank:${ids.gf2}`), undefined, "C2'nin gün fişi açık dönemde — farkta yok");
    assert.equal(of(`pos-commission:${ids.c3sale}`), undefined, "C3 açık dönem — farkta yok");
    assert.ok(view.sources.every(item => item.date <= LOCK), "fark yalnız kilitli dönemde");
    // KG-6'nın kaynakları (pos-commission + gün fişleri) dışında POS farkı yok; toplam 653 +520 / 108.01 −520.
    const pos = view.sources.filter(item => item.id.startsWith("pos-commission:") || [ids.gf1, ids.gf4, ids.gf4r].includes(item.id.slice(5)));
    const total = pos.reduce((sum, item) => {
      for (const [key, minor] of Object.entries(deltaOf(item))) sum[key] = (sum[key] || 0) + minor;
      return sum;
    }, {});
    assert.deepEqual(total, { 653: 52_000, "108.01": -52_000 });
    const frozen = server.app.store.get("SELECT COUNT(*) AS n, COALESCE(SUM(debit_minor), 0) AS d, COALESCE(SUM(credit_minor), 0) AS c FROM ledger_snapshots WHERE date <= ?", LOCK);
    assert.deepEqual({ ...frozen }, { ...frozenBefore }, "donmuş defter değişmedi");
    // Canlı defter (Mutabakat) yeni kuralla temiz: 108.01 = bekleyen net (C5'in kalan 2 taksiti: 8.000 − 280).
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const failures = (result.failures || []).map(item => item.code).filter(code => /^(bank:sub|gl:108|balance)/.test(code));
    assert.deepEqual(failures, [], "108 / alt hesap / denge temiz");
  });

  it("[2] Kural Farkı Düzeltme Fişi: KG-6 maddeleri 108.01 alt defter hesabına dokunduğu için fişin DIŞINDA (S76 = A); fişte 653 ve 108 yok", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    const lines = Object.fromEntries((view.lines || []).map(line => [line.sub || line.account, line.debit - line.credit]));
    assert.equal(lines["653"] ?? 0, 0, `653 fişte yok: ${JSON.stringify(view.lines)}`);
    assert.equal(lines["108.01"] ?? 0, 0, "108.01 fişte yok");
    const excluded = JSON.stringify(view.excluded || []);
    assert.ok(/108\.01/.test(excluded), `108.01 farkı ayrı listede (Kilidi Aç → Yeniden Kilitle): ${excluded.slice(0, 600)}`);
  });

  it("[3] Kilidi Aç → Yeniden Kilitle: donmuş defter yeni kuralla, KG-6 farkı kalmaz; 653'ün kilitli dönem toplamı satış günleriyle", async () => {
    await must("kilidi aç", api.put("/api/admin/period-lock", { lockedUntil: "" }));
    await must("yeniden kilitle", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    await server.app.ledger.snapshots.runPending();
    const view = await must("Kural Farkı", api.get(RULE));
    assert.ok(!view.sources.some(item => item.id.startsWith("pos-commission:") || [ids.gf1, ids.gf4, ids.gf4r].includes(item.id.slice(5))), `KG-6 farkı kalmadı: ${JSON.stringify(view.sources.map(item => item.id))}`);
    const q1 = await must("Mizan Q1", api.get(`/api/workspace/ledger?from=2026-01-01&to=${LOCK}`));
    const row = code => Math.round((q1.trial.accounts.find(item => item.code === code)?.balance || 0) * 100);
    // 653 kilitli dönemde: 250 + 125 − 50 + 420 + 100 = 845. 108.01 (31.03 sonu): bekleyen C5 12.000 − 420 + C2 4.000 − 100 = 15.480.
    assert.equal(row("653"), 84_500, "653 = 845 (satış / iade günleri)");
    assert.equal(row("108"), 1_548_000, "108 = bekleyen NET (C5 + C2)");
  });

  it("[4] açık dönemde yeni satış yeni kuralla: 22.04 satış 1.000 → 22.04 B 653 25 / A 108.01 25", async () => {
    const res = await must("22.04 satış", api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "in", amount: "1.000", date: "2026-04-22", method: "card", posId: ids.pos, posInstallments: 1 }));
    const entryId = res.entryId || server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", ids.party).id;
    const id = sale(server.app.store, entryId);
    const entry = server.app.ledger.build().find(item => item.id === `pos-commission:${id}`);
    assert.equal(entry?.date, "2026-04-22");
    assert.deepEqual(entry.lines.map(line => `${line.sub || line.account}:${line.debit}:${line.credit}`).sort(), ["108.01:0:2500", "653:2500:0"]);
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.deepEqual((result.failures || []).map(item => item.code).filter(code => /^(bank:sub|gl:108|balance)/.test(code)), []);
  });
});
