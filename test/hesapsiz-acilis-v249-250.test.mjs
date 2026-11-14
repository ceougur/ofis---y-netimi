// 2.5.0 Ç7a tur 2 — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla üretilmiş KİLİTLİ veride K-14 / K-15 (KULLANICI KARARI S179 = A; docs/erp/C7A-BANKA-TASARIM.md §13.2).
// Akış: güncelle → donmuş defter DEĞİŞMEDİ → Kural Değişikliği Farkı yeni kuralın farkını TAM gösterir (madde madde, elle) → Kural Farkı Düzeltme Fişi → açık dönemde yeni kayıt yeni kuralla.
// SINIF LİSTESİ (beklenenler elle — kitap K-14 / K-15 + karar metni; programın kodundan değil):
//   v2.4.9, 15.03.2026 — hesap yokken: 20.02 havale tahsilatı 5.000 (H1), 25.02 kartla ödeme 1.000 (K1), 05.03 havale tahsilatı 700 (H2); sonra Ziraat açılış 01.03 100.000, Şirket
//     Kartı açılış 01.03 0; Kurulum Sihirbazı Ziraat (Devir Kapanışı D = 01.03, satır bağlama YOK) → Devir Kapanışı X: 102.00 5.000, 108.00 −1.000 (DK).
//   v2.4.9, 15.09.2026 — 10.05 havale tahsilatı 300 'Hesapsız (Açılıştan Önce)' girilemez (Ziraat 01.03'te açık; hesap seçilir) → yerine hesap yokken girilmiş satır yok; Garanti
//     açılış 01.06.2026 50.000 (açık dönem); kilit 31.03.2026.
//   2.5.0 (bu tur):
//     H1 (kilitli, açılıştan önce): 102.00 → 519 (B 519 5.000 / A 120)               — fark: 102.00 −5.000, 519 +5.000
//     K1 (kilitli, kartın açılışından önce): 108.00 → 519 (B 120 / A 519 1.000)         — fark: 108.00 +1.000, 519 −1.000
//     H2 (kilitli, Ziraat'ten sonra, Garanti'den (en geç açılış 01.06) önce): 102.00 → 519 — fark: 102.00 −700, 519 +700  (S179 = A "en geç açılış")
//     DK (kilitli Devir Kapanışı): madde yazılmaz (B 519 / A 519 netlenir)           — fark: 102.00 +5.000, 108.00 −1.000, (2.4.9'da 500) −4.000
//   Kilitli dönemin toplam farkı (yalnız bu kural): 102.00 −700, 108.00 0, 519 +4.700 (Ç5-A'nın 500 → 519 farkları ayrıca).
//   Açık dönem: 10.06 'Hesapsız (Açılıştan Önce)' havale 250 (Garanti'den sonra → 400 kabul edilmez) — yerine 20.05 'Hesapsız' havale 250 (Garanti 01.06'dan önce, Ziraat'ten sonra:
//     pickRef kabul eder) → B 519 250 / A 120 (yeni kural; açık dönem, farkta yok).
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
let seq = 0;
const rid = () => `c7a2-v249-${process.pid}-${String(++seq).padStart(6, "0")}`;
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
// Kaynağın farkı: hesap / alt hesap → kuruş (canlı − donmuş).
const deltaOf = item => {
  const out = {};
  for (const delta of item?.deltas || []) {
    const key = delta.sub || delta.account;
    out[key] = (out[key] || 0) + Number(delta.minor);
  }
  return Object.fromEntries(Object.entries(out).filter(([, minor]) => minor));
};

describe("Ç7a K-14 / K-15 — v2.4.9 kilitli verisinde hesapsız açılış öncesi hareketler (kabul D): fark tam, donmuş defter değişmez, Kural Farkı fişi", { skip: SKIP }, () => {
  let root = null;
  let server = null;
  let api = null;
  const ids = {};
  let frozenBefore = null;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7a2-v249-hesapsiz-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-03-15T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await o.post("/api/workspace/bank/setup/dismiss", {});
      const party = await must("cari", o.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-02-01" }));
      const add = async (label, body) => {
        await must(label, o.post(`/api/workspace/accounts/${party.id}/entries`, body));
        return old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", party.id).id;
      };
      ids.party = party.id;
      ids.h1 = await add("H1 havale", { kind: "in", amount: "5.000", method: "bank", date: "2026-02-20" });
      ids.k1 = await add("K1 kartla ödeme", { kind: "out", amount: "1.000", method: "card", date: "2026-02-25" });
      ids.h2 = await add("H2 havale", { kind: "in", amount: "700", method: "bank", date: "2026-03-05" });
      const ziraat = await must("Ziraat", o.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-03-01", amount: "100.000", confirmed: true } }));
      await must("kart", o.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", currency: "TRY", creditLimit: "10.000", opening: { date: "2026-03-01", amount: "0", confirmed: true } }));
      await must("sihirbaz (Devir Kapanışı)", o.post("/api/workspace/bank/setup", { accountId: ziraat.id, carryClose: true, assign: "none" }));
      ids.carry = old.app.store.get("SELECT id FROM fin_events WHERE type = 'carry_close' AND status = 'active'").id;
    } finally {
      await old.close();
    }
    old = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-09-15T12:00:00+03:00", fixed: true } });
    try {
      const o = await old.login();
      await must("Garanti", o.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ticari", kind: "commercial", currency: "TRY", opening: { date: "2026-06-01", amount: "50.000", confirmed: true } }));
      await must("kilit (v2.4.9)", o.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-09-20T12:00:00+03:00", fixed: true }, integrityScan: false });
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
    api = await server.login();
    frozenBefore = server.app.store.get("SELECT COUNT(*) AS n, COALESCE(SUM(debit_minor), 0) AS d, COALESCE(SUM(credit_minor), 0) AS c FROM ledger_snapshots WHERE date <= ?", LOCK);
  });
  after(async () => {
    await server?.close?.().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("[1] Kural Değişikliği Farkı: dört kaynak (H1, K1, H2, Devir Kapanışı) elle hesapla aynı; donmuş defter değişmedi", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    const of = id => view.sources.find(item => item.id === id);
    assert.deepEqual(deltaOf(of(`account:${ids.h1}`)), { "102.00": -500_000, 519: 500_000 }, "H1: 102.00 → 519");
    assert.deepEqual(deltaOf(of(`account:${ids.k1}`)), { "108.00": 100_000, 519: -100_000 }, "K1: 108.00 → 519");
    assert.deepEqual(deltaOf(of(`account:${ids.h2}`)), { "102.00": -70_000, 519: 70_000 }, "H2: en geç açılıştan (Garanti 01.06) önce → 519");
    assert.deepEqual(deltaOf(of(`bank:${ids.carry}`)), { "102.00": 500_000, "108.00": -100_000, 500: -400_000 }, "Devir Kapanışı maddesi kalktı (2.4.9'da B 500 / A 102.00 · B 108.00 / A 500)");
    assert.ok(view.sources.every(item => item.date <= LOCK), "fark yalnız kilitli dönemde");
    const frozen = server.app.store.get("SELECT COUNT(*) AS n, COALESCE(SUM(debit_minor), 0) AS d, COALESCE(SUM(credit_minor), 0) AS c FROM ledger_snapshots WHERE date <= ?", LOCK);
    assert.deepEqual({ ...frozen }, { ...frozenBefore }, "donmuş defter değişmedi");
  });

  it("[2] Kural Farkı Düzeltme Fişi: yalnız bu kuralın kalemleri ve Ç5-A'nın 500 → 519'u; 102.00 / 108.00 alt defter hesabı farkı ayrı (fişe yazılmaz)", async () => {
    const view = await must("Kural Farkı", api.get(RULE));
    assert.equal(view.date, "2026-04-01");
    const lines = Object.fromEntries((view.lines || []).map(line => [line.sub || line.account, line.debit - line.credit]));
    const excluded = Object.fromEntries((view.excluded || []).map(item => [item.sub || item.account, Number(item.minor ?? item.differenceMinor ?? 0)]));
    // Bu kuralın 519 farkı +4.700 (5.000 − 1.000 + 700); Ç5-A'nın 500 → 519 farkları (Ziraat açılışı 100.000, Devir Kapanışı'nın 500'ü) ayrıca. Fiş 519'u kapatan tarafta.
    assert.ok(Object.keys(lines).length > 0, `fiş satırı var: ${JSON.stringify(view).slice(0, 600)}`);
    assert.equal(lines["102.00"] ?? 0, 0, `102.00 alt defter hesabıdır — fişe yazılmaz: ${JSON.stringify(view.lines)}`);
    assert.deepEqual(Object.keys(excluded).sort().filter(key => key.startsWith("102") || key.startsWith("108")), ["102.00"], `alt defter farkı (102.00 −700) ayrı listede: ${JSON.stringify(view.excluded)}`);
    await must("fiş", api.post(RULE, { requestId: rid(), digest: view.digest, confirm: true }));
    const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const failures = (result.failures || []).map(item => item.code);
    assert.ok(!failures.some(code => /^(opening:519|bank:sub|gl:10[28])/.test(code)), `Açılış Karşılığı / alt hesap temiz: ${failures.join(", ")}`);
  });

  it("[3] açık dönemde yeni hesapsız satır (Garanti'den önce) yeni kuralla: B 519 / A 120; farkta yok", async () => {
    await must("hesapsız 20.05", api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "in", amount: "250", method: "bank", date: "2026-05-20", bankAccountId: "none" }));
    const id = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", ids.party).id;
    const entry = server.app.ledger.build().find(item => item.id === `account:${id}`);
    assert.deepEqual(entry.lines.map(line => `${line.sub || line.account}:${line.debit}:${line.credit}`).sort(), ["120:0:25000", "519:25000:0"]);
    const view = await must("Kural Farkı", api.get(RULE));
    assert.ok(!view.sources.some(item => item.id === `account:${id}`), "açık dönem farkta yok");
  });
});
