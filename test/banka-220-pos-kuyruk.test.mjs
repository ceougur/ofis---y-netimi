// 2.2.0 — Aşama 11 Nasıl Bozarım: "50 POS × 30 gün kesinti sonrası ilk tur süresi" ve "Açılmamış 002'de valör → hub denetimi" (plan §4.4/2–3,
// §4.4/9). Süreler ölçülür ve yazılır (kanıt); tur sınırı 200 grup ya da 1 saniye.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { BANK, bootBank, flagPos, kurus, must, openAcceptanceAccounts, posCheck, ziraatPos } from "./banka-220-pos-ortak.mjs";

describe("Valör kuyruğu ölçeği: 50 POS × 30 gün (1.500 satış; iş günü valörüyle ~1.000 gün grubu) — kesinti sonrası ilk tur", () => {
  it("ilk tur ≤ 200 grup; bütün turlar biter; her grup tek gün fişi; mutabakat temiz", async () => {
    const ctx = await bootBank({ gateVerify: false });
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Ölçek Müşterisi", type: "customer", registeredOn: "2026-10-01" }));
      const terminals = [];
      await flagPos(ctx.api, acc.ziraat.id); // İz 3.1: POS yalnız POS Kullan işaretli hesaba
      for (let n = 0; n < 50; n += 1) terminals.push((await must(`POS ${n}`, ctx.api.post(`${BANK}/pos`, ziraatPos(acc.ziraat.id, { name: `Ölçek POS ${n + 1}`, valorDays: 1, valorRule: "calendar" })))).pos);
      // Hacim kurulumu: her gün (kendi saatinde) 50 POS'a birer cari POS tahsilatı, gün başına tek bank.post işleminde (kart yolu + fin_ref = POS;
      // POS kancası satışı ve takvimi kurar; valör ertesi gün, satış anında bekler). Sonra sunucu 30.11'e kadar "kapalı": 1.500 grup birikir.
      const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 2).padStart(2, "0")}`);
      const admin = ctx.store.get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
      const started = performance.now();
      for (const day of days) {
        ctx.server.clock.set(`${day}T10:00:00+03:00`);
        ctx.bank.post({ user: admin, module: "account", op: "create", similarOk: true, write: () => {
          for (const pos of terminals) {
            const id = `aentry-${randomUUID()}`;
            const eventId = ctx.bank.eventFor("account_entries", { kind: "in", source: "", date: day, method: "card", fin_ref: pos.id });
            ctx.store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, method, fin_ref, event_id, created_by, created_at) VALUES (?, ?, 'in', 1000, ?, 'ölçek', '', 'card', ?, ?, ?, ?)", id, party.id, day, pos.id, eventId, admin.id, new Date().toISOString());
          }
          return { id: `olcek-${day}` };
        } });
      }
      const setupMs = performance.now() - started;
      ctx.server.clock.set("2026-11-30T10:00:00+03:00");
      const pos = ctx.app.context.bankAccounts.pos;
      // 30.10 + 0 gün takvim → her gün kendi grubu; bugün 30.11: hepsi vadesi gelmiş, 1.500 grup (kesinti sonrası açılış gibi).
      // Valör (ertesi takvim günü, tatilde sonraki iş günü) iş günlerinde toplanır: grup = 50 POS × ayrı valör günü.
      const valorDays = ctx.store.get("SELECT COUNT(DISTINCT value_date) AS n FROM pos_items").n;
      const groups = 50 * valorDays;
      assert.equal(pos.dueGroups().length, groups);
      assert.ok(groups >= 1000, `${groups} grup`);
      const round = performance.now();
      const first = pos.runQueue();
      const firstMs = performance.now() - round;
      assert.ok(first.settled > 0 && first.settled <= 200, `ilk tur ${first.settled} grup`);
      const all = performance.now();
      const rest = pos.drain();
      const drainMs = performance.now() - all;
      assert.equal(first.settled + rest.settled, groups, "her grup bir kez");
      assert.equal(rest.remaining, 0);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'").n, groups);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM pos_items WHERE status = 'pending'").n, 0);
      const ziraat = (await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor;
      assert.equal(ziraat, kurus(100000) + 1500 * (kurus(1000) - kurus(25)), "her satış 1.000 − %2,5");
      console.log(`# ölçüm: kurulum (1.500 satış, 30 işlem) ${Math.round(setupMs)} ms; ${groups} grup; ilk tur ${first.settled} grup ${Math.round(firstMs)} ms; kalan ${rest.settled} grup ${Math.round(drainMs)} ms`);
      await posCheck(ctx.api, "ölçek");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Açılmamış şirket (002): valörü gelmiş kalem → ortak katmanın günlük denetimi şirketi açar, kuyruk yazar", () => {
  it("002'de POS satışı; sunucu kapanır; 15.10'da açılışta 002'ye istek gelmeden gün fişi yazılır", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pos-hub-"));
    const dataDir = path.join(root, "data");
    let second;
    try {
      const first = await bootBank({ dataDir, maxCompanies: 2 });
      try {
        const created = await must("002", first.api.post("/api/companies", { name: "POS Şirketi", select: false }));
        second = created.company || created;
        const q = `?hofCompany=${encodeURIComponent(second.id)}`;
        const ziraat = await must("002 Ziraat", first.api.post(`${BANK}/accounts${q}`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
        await must("002 POS Kullan", first.api.put(`${BANK}/accounts/${ziraat.id}${q}`, { usePos: true })); // İz 3.1
        const pos = (await must("002 POS", first.api.post(`${BANK}/pos${q}`, ziraatPos(ziraat.id)))).pos;
        const party = await must("002 cari", first.api.post(`/api/workspace/accounts${q}`, { name: "002 Müşterisi", type: "customer", registeredOn: "2026-10-01" }));
        await must("002 POS satışı", first.api.post(`/api/workspace/accounts/${party.id}/entries${q}`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08", posId: pos.id }));
      } finally {
        // Hata olsa da sunucu kapanır (açık kalan sunucu test sürecini asılı bırakır).
        await first.server.close();
      }
      const ctx = await bootBank({ dataDir, maxCompanies: 2, now: "2026-10-15T09:00:00+03:00" });
      try {
        for (let i = 0; i < 100 && !ctx.app.openCompanyIds().includes(second.id); i += 1) await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(ctx.app.openCompanyIds().includes(second.id), "hub denetimi 002'yi açtı (istek gelmeden)");
        let summary;
        for (let i = 0; i < 100; i += 1) {
          summary = await must("002 özeti", ctx.api.get(`${BANK}/summary?hofCompany=${encodeURIComponent(second.id)}`));
          if (summary.posPending.grossMinor === 0) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(summary.posPending.grossMinor, 0, "002'nin kalemi bankaya geçti");
        assert.equal(summary.realBank.minor, kurus(109750), "002 Ziraat 109.750");
        const root001 = await must("001 özeti", ctx.api.get(`${BANK}/summary`));
        assert.equal(root001.realBank.defined, false, "001 etkilenmedi");
      } finally {
        await ctx.server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// posCheck yalnız ölçek testinde (001); 002'nin Mutabakat Testi hofCompany ile ayrıca:
export { posCheck };
