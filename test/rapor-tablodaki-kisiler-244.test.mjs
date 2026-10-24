// 2.4.4 madde 5c: Tablodaki Kişiler (reports/cari-ekstre) — aynı dosya no iki sekmede (İcra Takip + Ödeme Sözleri) olan kişinin tahsilatı İKİ KEZ
// alacak yazılmaz (2.4.3'ten kalan: tahsilat kayıt anahtarıyla eşleşiyor, anahtar iki sekmede aynı, her satıra ayrı yazılıyordu). Ders 11: her süzgeç
// (dönem, sekme, durum, sayfa, ad) ve toplam = satırlar. Beklenen sayılar girilen tutarlardan (elle): kayıt tahsilatı 100 + kayda bağlı cari tahsilatı 250.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const round = value => Math.round(value * 100) / 100;

describe("2.4.4 5c: Tablodaki Kişiler — aynı dosya no iki sekmede, tahsilat bir kez; toplam = satırlar (her süzgeç)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "rapor-kisiler-244-"));
  let server;
  let api;
  let session = "";
  const report = async query => (await must(`cari-ekstre ${query}`, api.get(`/api/workspace/reports/cari-ekstre?${query}`))).report;
  const linesOf = (rep, key) => rep.table.rows.filter(row => row.cari === key);
  const sumOf = (rows, field) => round(rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0));

  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const book = tahsilatWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    // 2026/1104 Zeynep Şahin hem İcra Takip hem Ödeme Sözleri sekmesinde (aynı kayıt anahtarı).
    await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent("2026/1104")}/payments`, { amount: "100", date: day(-1), method: "cash" }));
    const cari = await must("cari", api.post("/api/workspace/accounts", { name: "Zeynep Şahin", type: "customer", caseKey: "2026/1104", caseTitle: "Zeynep Şahin" }));
    await must("cari tahsilatı", api.post(`/api/workspace/accounts/${cari.id}/entries`, { kind: "in", amount: "250", date: day(0), method: "cash" }));
    session = server.app.store.get("SELECT case_source AS s FROM accounts WHERE id = ?", cari.id).s;
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("varsayılan dönem: 2026/1104 (Zeynep Şahin) tahsilatları bir kez (100 + 250), iki sekmenin borç satırları ayrı", async () => {
    const rep = await report(`from=${day(-30)}&to=${day(1)}`);
    const lines = linesOf(rep, "Zeynep Şahin");
    const credits = lines.filter(row => row.alacak > 0);
    assert.deepEqual(credits.map(row => row.alacak).sort((a, b) => a - b), [100, 250], `alacak satırları: ${JSON.stringify(credits)}`);
    assert.ok(lines.filter(row => row.borc > 0).length >= 1, "borç satırı var");
    // 31a F4 (bilerek güncellendi): satır grubu kişinin adıyla görünür (önceden çok sekmeli tabloda dosya no görünüyordu).
    const group = rep.groups.find(item => item.cari === "Zeynep Şahin");
    assert.equal(group.credit, 350, "grubun alacağı 350");
    assert.equal(round(group.debit - group.credit), group.balance, "grup bakiyesi = borç − alacak");
  });

  test("her süzgeçte toplam = satırlar; tahsilat yalnız süzgeçte kalan kayda bir kez yazılır", async () => {
    const tabs = ["İcra Takip", "Ödeme Sözleri"];
    const queries = [
      "",
      `from=${day(-30)}&to=${day(1)}`,
      `from=${day(0)}&to=${day(0)}`,
      `from=${day(5)}&to=${day(30)}`,
      ...tabs.map(tab => `tabs=${encodeURIComponent(tab)}`),
      `tabs=${encodeURIComponent(tabs.join(","))}`,
      `sessions=${encodeURIComponent(session)}`,
      "cari=zeynep",
      `status=${encodeURIComponent("Haciz aşamasında")}`,
      "minAmount=30000",
    ];
    for (const query of queries) {
      const rep = await report(query);
      assert.equal(round(rep.totals.debit), sumOf(rep.table.rows, "borc"), `${query || "(süzgeçsiz)"}: borç toplamı = satırlar`);
      assert.equal(round(rep.totals.credit), sumOf(rep.table.rows, "alacak"), `${query || "(süzgeçsiz)"}: alacak toplamı = satırlar`);
      const credits = linesOf(rep, "Zeynep Şahin").filter(row => row.alacak > 0).map(row => row.alacak);
      const ids = credits.slice().sort((a, b) => a - b);
      assert.equal(new Set(ids).size, ids.length, `${query || "(süzgeçsiz)"}: aynı tahsilat iki kez yok: ${JSON.stringify(ids)}`);
    }
    const oneDay = await report(`from=${day(0)}&to=${day(0)}`);
    assert.deepEqual(linesOf(oneDay, "Zeynep Şahin").filter(row => row.alacak > 0).map(row => row.alacak), [250], "bugün: yalnız cari tahsilatı");
    const future = await report(`from=${day(5)}&to=${day(30)}`);
    assert.equal(linesOf(future, "Zeynep Şahin").filter(row => row.alacak > 0).length, 0, "ileri dönem: tahsilat yok");
  });
});
