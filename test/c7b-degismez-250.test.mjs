// 2.5.0 Ç7b tur 2f — kabul F: DEĞİŞMEZLER rastgele (tohumlu) sırada (docs/devir/2.5.0-DEVAM/c7b2-istem.txt 'Kabul koşulları' F; docs/erp/C7B-FATURA-TASARIM.md §1, §2, §11).
// Her işlemden sonra: (1) her maddede Σ borç = Σ alacak; (2) 336.90 = kayıt tahsilatları Σ (KG-3; kilitsiz dosya → geçiş yok); (3) 600.90 = belgesiz satış Σ (stok satışı veresiye + peşin, taksit
// Yeni Borç; KG-2 = A, KDV ayrılmaz) ve 610.90 = belgesiz iade Σ; Mevcut Borç kartı maddesiz; (4) Defter Mutabakatı temiz; (5) Mutabakat Testi temiz. Sonda her ay sonu (Eylül → Kasım): mahsuptan
// önce 191 ≥ 0 ve 391 ≤ 0 (KG-8 / F-08: satıştan iade KDV'si 191 borcu, alıştan iade KDV'si 391 alacağı — eksi YOK), mahsuptan sonra 191 = 391 = 0 ve ödenecek / devreden H − İ.
// Beklenenler testin KENDİ toplamı (dizinin tutarları), programın çıktısından değil (ders 5). Dizi test/fixtures/c7b-degismez-dizi.mjs (tohum 11 ve 23; iki TZ'de koşulur — ders 13 sahte saat).
// NASIL BOZARIM: belgesizde KDV ayırmak (600.90 ≠ Σ); Mevcut Borç kartını 600.90'a yazmak; kayıt tahsilatını 602 / 649'a yazmak (336.90 ≠ Σ); iade KDV'sini eski hesaba yazmak (191 eksi / 391 artı
// ay sonu); expected()'te 336'yı unutmak (Defter Mutabakatı).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { BANK, bootBank } from "./banka-210-hesap-ortak.mjs";
import { apply, prepare, sequence } from "./fixtures/c7b-degismez-dizi.mjs";

const NOW = { time: "2026-12-10T12:00:00+03:00", fixed: true };
const TAX = "/api/workspace/tax";

function sums(entries, to = "9999") {
  const acc = {};
  const sub = {};
  for (const entry of entries) {
    if (entry.date > to) continue;
    for (const line of entry.lines) {
      acc[line.account] = (acc[line.account] || 0) + line.debit - line.credit;
      if (line.sub) sub[line.sub] = (sub[line.sub] || 0) + line.debit - line.credit;
    }
  }
  return { acc: k => (acc[k] || 0) / 100, sub: k => (sub[k] || 0) / 100 };
}

for (const seed of [11, 23]) {
  describe(`Ç7b tur 2f — kabul F: değişmezler (tohum ${seed})`, () => {
    it(`her işlemde Σ B = Σ A, 336.90 / 600.90 / 610.90 = dizinin toplamları, Defter Mutabakatı + Mutabakat Testi temiz; ay sonları 191 / 391`, { timeout: 600_000 }, async () => {
      const ctx = await bootBank({ now: NOW });
      try {
        const { api, server } = ctx;
        const app = server.app;
        await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
        const ids = await prepare({ api, must });
        const ops = sequence(seed);
        assert.ok(ops.length >= 48, `dizi ${ops.length} işlem`);
        let step = 0;
        await apply({ api, store: app.store, ids, must }, ops, async ({ item, model }) => {
          step += 1;
          const label = `tohum ${seed} adım ${step} (${item.op} ${item.date})`;
          const entries = app.ledger.build();
          const bad = entries.filter(entry => entry.lines.reduce((s, line) => s + line.debit - line.credit, 0) !== 0).map(entry => entry.id);
          assert.deepEqual(bad, [], `${label}: dengesiz madde`);
          const s = sums(entries);
          assert.equal(s.sub("336.90"), 0 - model.case, `${label}: 336.90 = kayıt tahsilatları`);
          assert.equal(s.sub("600.90"), 0 - model.sale, `${label}: 600.90 = belgesiz satış`);
          assert.equal(s.sub("610.90"), model.ret, `${label}: 610.90 = belgesiz iade`);
          const ledger = await must("Defter Mutabakatı", api.get("/api/workspace/ledger"));
          assert.deepEqual(ledger.reconciliation.checks.filter(c => !c.ok).map(c => `${c.code} ${c.subledger} ↔ ${c.ledger}`), [], `${label}: Defter Mutabakatı`);
          const scan = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
          assert.equal(scan.ok, true, `${label}: Mutabakat Testi ${JSON.stringify(scan.failures).slice(0, 600)}`);
        });
        for (const [month, end] of [["2026-09", "2026-09-30"], ["2026-10", "2026-10-31"], ["2026-11", "2026-11-30"]]) {
          const before = sums(app.ledger.build(), end);
          assert.ok(before.acc("191") >= 0, `${month} sonu mahsuptan önce 191 ≥ 0 (${before.acc("191")})`);
          assert.ok(before.acc("391") <= 0, `${month} sonu mahsuptan önce 391 ≤ 0 (${before.acc("391")})`);
          const view = (await must(`${month} ön izleme`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
          await must(`${month} mahsup`, api.post(`${TAX}/vat-offset`, { month }));
          const after = sums(app.ledger.build(), end);
          assert.deepEqual([after.acc("191"), after.acc("391")], [0, 0], `${month} sonu mahsuptan sonra 191 = 391 = 0`);
          assert.equal(view.payableMinor - view.carryOutMinor, view.outMinor - view.inMinor - view.carryInMinor, `${month}: ödenecek − sonraki aya devreden = H − İ − önceki aydan devreden`);
        }
        const ledger = await must("Defter Mutabakatı", api.get("/api/workspace/ledger"));
        assert.deepEqual(ledger.reconciliation.checks.filter(c => !c.ok).map(c => c.code), [], "mahsuplardan sonra Defter Mutabakatı");
        assert.equal((await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).ok, true, "mahsuplardan sonra Mutabakat Testi");
      } finally {
        await ctx.server.close();
      }
    });
  });
}
