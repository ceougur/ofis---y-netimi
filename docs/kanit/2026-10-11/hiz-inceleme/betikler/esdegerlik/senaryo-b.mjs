// Senaryo B: eski sürümden göçle gelen gerçek veri (test/fixtures/surum-2.0.26-*): her şirket dosyası ayrı sunucuyla (kök olarak) açılır,
// v20 göçü çalışır; önce olduğu gibi, sonra iki hesap (aynı gün) + Kurulum Sihirbazı (Devir Kapanışı, hepsini ata) + ücretli transfer ile
// eski ↔ yeni rapor ve okuma uçları karşılaştırılır. Kullanım: node senaryo-b.mjs <fikstür adı> [çıktı.json]
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { addDays, compareMoney, compareReports } from "./ortak.mjs";
const R = "/home/user/ofis---y-netimi";
const { unpackFixture } = await import(`${R}/test/guvenilirlik/fikstur.mjs`);
const { startTestServer, loginAdmin } = await import(`${R}/test/helpers.mjs`);
const { apiOf, rawAll } = await import(`${R}/test/banka-210-ortak.mjs`);

const name = process.argv[2];
const out = process.argv[3] || `senaryo-b-${name}.json`;
const NOW = "2026-10-08T12:00:00+03:00";
const fixture = unpackFixture(name);
const results = [];
try {
  const dirs = [fixture.dataDir];
  const sub = path.join(fixture.dataDir, "sirketler");
  if (existsSync(sub)) for (const d of readdirSync(sub)) dirs.push(path.join(sub, d));
  for (const dataDir of dirs) {
    const server = await startTestServer({ dataDir, now: { time: NOW, fixed: true }, reportWorker: true, bankPickLegacy: true, maxCompanies: 10, gateVerify: false });
    const r = { dataDir: path.relative(fixture.root, dataDir), steps: [] };
    try {
      const app = server.app;
      const today = "2026-10-08";
      const dates = rawAll(app.db, "SELECT DISTINCT date FROM (SELECT date FROM account_entries UNION SELECT date FROM cash_entries UNION SELECT date FROM payments UNION SELECT date FROM plan_entries) WHERE date <> '' ORDER BY date").map(x => x.date);
      const firstDay = dates[0] || today;
      const mid = dates[Math.floor(dates.length / 2)] || today;
      r.lines = rawAll(app.db, "SELECT COUNT(*) AS n FROM account_entries")[0].n;
      r.firstDay = firstDay;
      r.mid = mid;
      const periods = [["varsayılan", {}], ["all", { preset: "all" }], ["thisMonth", { preset: "thisMonth" }], ["lastMonth", { preset: "lastMonth" }], ["ilk gün", { from: firstDay, to: firstDay }], ["orta başı", { from: mid, to: today }], ["orta tek", { from: mid, to: mid }], ["orta bitişi", { to: mid }], ["gelecek", { from: addDays(today, 1), to: addDays(today, 400) }]];
      const froms = ["", firstDay, addDays(firstDay, 1), mid, addDays(mid, 1), today, addDays(today, 1)];
      const untils = ["", today, mid, addDays(today, 400)];
      const step = async label => {
        app.context.money.reset?.();
        const banks = rawAll(app.db, "SELECT id, kind, status FROM bank_accounts");
        const rep = await compareReports(app, `${r.dataDir} ${label}`, periods, banks);
        const mon = compareMoney(app, `${r.dataDir} ${label}`, { today, froms, untils, banks });
        r.steps.push({ label, banks: banks.length, compared: rep.compared, rows: rep.rows, diffs: rep.diffs.length, first: rep.diffs.slice(0, 8), checks: mon.checks, mdiffs: mon.diffs.length, mfirst: mon.diffs.slice(0, 8) });
      };
      await step("göç sonrası");
      let api;
      try {
        api = apiOf(await loginAdmin(server));
      } catch (error) {
        r.login = `giriş yok: ${error.message}`;
      }
      if (api) {
        const BANK = "/api/workspace/bank";
        const open = async body => api.post(`${BANK}/accounts`, body);
        const a = await open({ bankName: "Fikstür A", name: "A", kind: "demand", opening: { date: mid, amount: "10.000", confirmed: true } });
        const b = await open({ bankName: "Fikstür B", name: "B", kind: "demand", opening: { date: mid, amount: "5.000", confirmed: true } });
        r.open = [a.status, b.status];
        if (a.status === 200) {
          const setup = await api.post(`${BANK}/setup`, { accountId: a.data.id, carryClose: true, assign: "all", negativeOk: true });
          r.setup = [setup.status, JSON.stringify(setup.data).slice(0, 200)];
          if (b.status === 200) {
            const tr = await api.post(`${BANK}/transfers`, { accountId: a.data.id, toAccountId: b.data.id, amount: "1.000", date: today, feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", similarOk: true, negativeOk: true });
            r.transfer = tr.status;
          }
        }
        await step("hesap + sihirbaz + transfer");
      }
    } catch (error) {
      r.error = String(error?.stack || error).slice(0, 800);
    } finally {
      await server.close().catch(() => {});
    }
    results.push(r);
  }
} finally {
  fixture.cleanup();
}
writeFileSync(out, JSON.stringify(results, null, 2));
for (const r of results) console.log(r.dataDir, "satır", r.lines, r.login || "", r.open || "", r.setup?.[0] || "", r.transfer || "", r.error ? `HATA ${r.error.slice(0, 300)}` : "", JSON.stringify(r.steps.map(s => ({ l: s.label, b: s.banks, c: s.compared, rows: s.rows, d: s.diffs, m: s.checks, md: s.mdiffs }))));
