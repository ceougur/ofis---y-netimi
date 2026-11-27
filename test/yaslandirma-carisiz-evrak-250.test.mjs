// 2.5.0 Ç5-A tur 1b — CARİSİZ EVRAK Alacak Yaşlandırması'na GİRMEZ (BAŞ MİMAR KARARI 11.11.2026; dayanak KULLANICI S49 = A + kural kitabı MM5 "müşteri başına"; C5-ACILIS-TASARIM §12.3).
// Beklenen karar metninden: yaşlandırma müşteri başınadır — portföydeki alınan evrak YALNIZ bir carinin evrakıysa (formdan cari seçilmiş, Excel'de keşideci adı cariyle eşleşmiş)
// o carinin satırında; cari seçilmemiş evrak (formdan carisiz, keşidecili ya da keşidecisiz "—"; Excel açılış portföyünün eşleşmeyen satırı) hiçbir satırda yok. Karşılıksızda cari
// seçilen açılış evrakı (S48) carinin borcu olur (carinin satırında). Toplam = satırlar (ekran = PDF = Excel; ders 11 — raporun süzgeci yok). Sahte saat (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-11-20T12:00:00+03:00";
const money = cell => {
  const text = String(cell ?? "").replace(/\s|TL/g, "").replace(/−/g, "-");
  return text ? Math.round(Number(text.replace(/\./g, "").replace(",", ".")) * 100) : 0;
};
const roles = { 0: "direction", 1: "instrument", 2: "serial", 3: "bank", 4: "drawer", 5: "amount", 6: "due", 7: "issue" };

describe("Alacak Yaşlandırma — carisiz evrak girmez, carili evrak carisinin satırında (S49 = A, MM5)", () => {
  let server;
  let admin;
  const steps = {};
  const step = async (name, call) => {
    const r = await call;
    steps[name] = { status: r.status, data: r.data?.data ?? r.data };
    return steps[name];
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/bank/setup/dismiss", {});
    const a = await step("cari", admin.post("/api/workspace/accounts", { name: "Ayla Müşteri", registeredOn: "2026-01-02" }));
    const id = a.data?.id;
    await step("borç yaz", admin.post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: "1.000", date: "2026-10-01", note: "Hizmet" }));
    await step("carili çek", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "CC-1", bank: "Akbank", drawer: "Ayla Müşteri", accountId: id, amount: "300", issueDate: "2026-10-05", dueDate: "2026-12-15" }));
    await step("carisiz keşidecili", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "FC-1", bank: "Akbank", drawer: "Tanımsız Keşideci", amount: "450", issueDate: "2026-10-06", dueDate: "2026-12-16" }));
    await step("carisiz keşidecisiz", admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "FC-2", bank: "Akbank", amount: "200", issueDate: "2026-10-07", dueDate: "2026-12-17" }));
    await step("Excel portföy", admin.post("/api/workspace/cheques/import", { matrix: [["Yön", "Tür", "Seri No", "Banka", "Keşideci", "Tutar", "Vade", "Tarih"], ["Alınan", "Çek", "AP-1", "Akbank", "Ayla Müşteri", "150", "20.12.2026", "01.02.2026"], ["Alınan", "Senet", "AP-2", "Akbank", "Eski Borçlu", "250", "21.12.2026", "01.02.2026"], ["Alınan", "Çek", "AP-3", "Akbank", "Karşılıksız Keşideci", "600", "22.12.2026", "01.02.2026"]], headerAt: 0, roles, fileName: "acilis.xlsx", post: false }));
    const ap3 = server.app.store.get("SELECT id FROM cheques WHERE serial_no = 'AP-3'")?.id;
    await step("S48 karşılıksız + cari", admin.post(`/api/workspace/cheques/${ap3}/actions`, { action: "bounce", date: "2026-11-01", accountId: id }));
  });
  after(async () => server?.close());

  it("hazırlık: bütün istekler kabul edildi (ders 3)", () => {
    for (const [name, r] of Object.entries(steps)) assert.equal(r.status, 200, `${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  });

  it("ekran: carisiz evrak (keşidecili, '—', Excel'in eşleşmeyen satırı) satır DEĞİL; carinin satırı = bakiye + carili portföy; TOPLAM = satırlar", async () => {
    const r = await admin.get("/api/workspace/report-center/alacak-yaslandirma");
    assert.equal(r.status, 200);
    const data = r.data?.data ?? r.data;
    const total = data.headers.indexOf("Toplam");
    const names = data.rows.map(row => row[0]).sort();
    assert.deepEqual(names, ["Ayla Müşteri"], `satırlar: ${JSON.stringify(data.rows.map(row => [row[0], row[total]]))}`);
    // Beklenen (veri tabanından, programın türetmesinden değil): carinin bakiyesi (Borç Yaz 1.000 − carili çek 300 + S48 karşılıksız 600) + portföydeki CARİLİ alınan evrak.
    const store = server.app.store;
    const balance = Math.round(Number((await admin.get("/api/workspace/accounts?status=all&limit=50")).data?.data?.accounts?.find(row => row.name === "Ayla Müşteri")?.balance ?? NaN) * 100);
    const carili = store.get("SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS n FROM cheques WHERE direction = 'in' AND status = 'portfolio' AND deleted_at IS NULL AND account_id <> ''").n;
    assert.equal(money(data.rows[0][total]), balance + carili, `carinin satırı: bakiye ${balance} + carili portföy ${carili}`);
    assert.equal(money(data.footer[total]), data.rows.reduce((sum, row) => sum + money(row[total]), 0), "TOPLAM = satırlar");
    const carisiz = store.get("SELECT COUNT(*) AS n FROM cheques WHERE direction = 'in' AND status = 'portfolio' AND deleted_at IS NULL AND account_id = ''").n;
    assert.ok(carisiz >= 3, `veride carisiz portföy evrakı var (${carisiz})`);
  });

  it("PDF ve Excel aynı: carisiz keşideci adları yok, carinin satırı ve TOPLAM ekranla aynı (ders 11)", async () => {
    const screen = (await admin.get("/api/workspace/report-center/alacak-yaslandirma")).data;
    const data = screen?.data ?? screen;
    const total = data.headers.indexOf("Toplam");
    const xlsx = await admin.raw("GET", "/api/workspace/report-center/alacak-yaslandirma/xlsx");
    assert.equal(xlsx.status, 200);
    const sheet = xlsxRows(xlsx.buffer);
    const flat = JSON.stringify(sheet);
    for (const name of ["Tanımsız Keşideci", "Eski Borçlu", "Karşılıksız Keşideci"]) assert.ok(!flat.includes(name), `Excel'de carisiz evrak satırı: ${name}`);
    const minor = cell => (typeof cell === "number" ? Math.round(cell * 100) : money(cell));
    const want = money(data.rows[0][total]);
    assert.ok(sheet.some(row => row[0] === "Ayla Müşteri" && row.some(cell => minor(cell) === want)), `Excel'de carinin satırı ekranla aynı (${want}): ${JSON.stringify(sheet.find(row => row[0] === "Ayla Müşteri"))}`);
    assert.ok(sheet.some(row => /TOPLAM/i.test(String(row[0])) && row.some(cell => minor(cell) === money(data.footer[total]))), `Excel TOPLAM = ekran: ${JSON.stringify(sheet.slice(-3))}`);
    const pdf = await admin.raw("GET", "/api/workspace/report-center/alacak-yaslandirma/pdf");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const name of ["Tanımsız Keşideci", "Eski Borçlu"]) assert.ok(!text.includes(name), `PDF'te carisiz evrak satırı: ${name}`);
    assert.ok(text.includes("Ayla Müşteri") && text.includes(data.footer[total]), "PDF'te carinin satırı ve TOPLAM");
  });

  it("carili evrak carisinin satırında KALIR (karşı mutant: carili evrak da düşerse satır bakiyeye iner)", async () => {
    const data = (await admin.get("/api/workspace/report-center/alacak-yaslandirma")).data;
    const report = data?.data ?? data;
    const total = report.headers.indexOf("Toplam");
    const balance = Math.round(Number((await admin.get("/api/workspace/accounts?status=all&limit=50")).data?.data?.accounts?.find(row => row.name === "Ayla Müşteri")?.balance ?? NaN) * 100);
    assert.ok(money(report.rows[0][total]) > balance, `carili portföy satırda: satır ${money(report.rows[0][total])} > bakiye ${balance}`);
  });
});
