// Bağımsız doğrulayıcı — Senaryo G: Alt Hesap Mizanı ekran = PDF = Excel (101.01 / 101.02 satırları ve TOPLAM). Elle beklenen: 2.000 + 500 alınan,
// 2.000 tahsile verildi → 101.01 = 500, 101.02 = 2.000.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";
import { pdfText, xlsxSheets } from "../../../../../test/banka-210-ortak.mjs";

const CH = "/api/workspace/cheques";
let ctx, api;
describe("G — Alt Hesap Mizanı ekran / PDF / Excel", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-15T12:00:00+03:00" });
    api = ctx.api;
    const acc = await openAcceptanceAccounts(api);
    const abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC", type: "customer", registeredOn: "2026-09-01" }));
    const a = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "2.000", issueDate: "2026-10-02", dueDate: "2026-11-02", accountId: abc.id, serialNo: "G-1" }));
    await must("çek", api.post(CH, { direction: "in", instrument: "note", amount: "500", issueDate: "2026-10-02", dueDate: "2026-11-02", accountId: abc.id, serialNo: "G-2" }));
    await must("ver", api.post(`${CH}/${a.id}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
  });
  after(() => ctx.server.close());
  it("üç çıktıda 101.01 = 500, 101.02 = 2.000", async () => {
    const q = "from=2026-10-01&to=2026-10-31";
    const scr = await must("ekran", api.get(`/api/workspace/report-center/alt-hesap-mizani?${q}`));
    const pdf = await api.client.raw("GET", `/api/workspace/report-center/alt-hesap-mizani/pdf?${q}`);
    const xls = await api.client.raw("GET", `/api/workspace/report-center/alt-hesap-mizani/xlsx?${q}`);
    const pdfBuf = pdf.buffer;
    const xlsBuf = xls.buffer;
    const text = pdfText(pdfBuf);
    const sheets = xlsxSheets(xlsBuf);
    const rows = Object.values(sheets)[0] || [];
    const pick = (list, sub) => list.find(r => r[0] === sub);
    const got = { ekran: [pick(scr.rows, "101.01")?.[6], pick(scr.rows, "101.02")?.[6]], excel: [pick(rows, "101.01")?.[6], pick(rows, "101.02")?.[6]], pdf: [/101\.01/.test(text) && /500,00/.test(text), /101\.02/.test(text) && /2\.000,00/.test(text)] };
    console.log("G", JSON.stringify(got));
    assert.deepEqual(got.ekran, ["500,00 TL", "2.000,00 TL"]);
    assert.deepEqual(got.pdf, [true, true]);
    assert.ok(String(got.excel[0]).includes("500") && String(got.excel[1]).includes("2"), JSON.stringify(got.excel));
  });
});
