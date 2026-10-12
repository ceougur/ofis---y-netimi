// Bağımsız doğrulayıcı tur 2 — Senaryo L: Tahsildeki Çek ve Senetler raporu ekran / Excel / PDF TOPLAM = 101.02 (ders 11). Sahte saat 27.10.2026.
// Elle beklenen: L1 1.234,56 (Ziraat) + L2 765,44 (Garanti) tahsilde = 2.000,00; L3 500 portföyde (raporda yok).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";
import { pdfText, xlsxSheets } from "../../../../../test/banka-210-ortak.mjs";

const CH = "/api/workspace/cheques";
let ctx, api, acc, m;
describe("L — Tahsildeki raporu ekran / Excel / PDF", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    m = await must("cari", api.post("/api/workspace/accounts", { name: "Zeta Ltd", type: "customer", registeredOn: "2026-09-01" }));
    const mk = async (no, amount, bank) => {
      const c = await must("al", api.post(CH, { direction: "in", instrument: "cheque", serialNo: no, accountId: m.id, amount, issueDate: "2026-10-05", dueDate: "2026-11-16" }));
      if (bank) await must("ver", api.post(`${CH}/${c.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc[bank].id }));
    };
    await mk("L1", "1.234,56", "ziraat");
    await mk("L2", "765,44", "garanti");
    await mk("L3", "500", "");
  });
  after(() => ctx?.server.close());
  it("ekran satırları + özet; Excel TOPLAM; PDF'te 2.000,00", async () => {
    const r = await must("rapor", api.get("/api/workspace/report-center/tahsildeki-cekler"));
    const x = await api.raw("GET", "/api/workspace/report-center/tahsildeki-cekler/xlsx");
    const p = await api.raw("GET", "/api/workspace/report-center/tahsildeki-cekler/pdf");
    const cells = Object.values(xlsxSheets(x.buffer)).flat(2).map(String);
    const text = pdfText(p.buffer);
    console.log(JSON.stringify({ rows: r.rows, summary: r.summary, footer: r.footer, xs: x.status, ps: p.status, xlsxHas: cells.filter(c => /2000|2\.000/.test(c)), pdfHas: /2\.000,00/.test(text) }));
    assert.equal(r.rows.length, 2);
    assert.equal(x.status, 200);
    assert.equal(p.status, 200);
    assert.ok(cells.some(c => c === "2000" || /2\.000,00/.test(c)), "Excel TOPLAM 2.000");
    assert.ok(/2\.000,00/.test(text), "PDF TOPLAM 2.000,00");
  });
});
