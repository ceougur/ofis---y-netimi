// 2.4.4 madde 31a F1/F5/F4 (bağımsız kâhin bulguları, 22.10.2026): Tablodaki Kişiler (reports/cari-ekstre) ve Nakit Akışı (nakit-akis) kaydın
// tahsilatını takvimle AYNI kümeden okur: kayıt tahsilatı + kayda bağlı carinin tahsilatı + kayda (ya da kayda bağlı cariye) bağlı taksit kartının tahsilatı.
// "Nasıl bozulur?" (önce yazıldı):
//   N1 (F1) Tablodan Aktar carinin taksit dışı tahsilatını karta taşıyınca rapor o tahsilatı kaybeder; geri alınca iki kez sayar.
//   N2 (F5) karta doğrudan girilen taksit tahsilatı rapora girmez.
//   N3 Nakit Akışı "Gerçekleşen" taşıma öncesi/sonrası/geri al'da değişir (aynı para).
//   N4 (F4) çok sekmeli tabloda sekmelerin kişi kolonu farklıysa (Borçlu / Müşteri / Kiracı) Cari sütununda ad yerine dosya no ya da iç anahtar ("satir:…").
//   N5 ad görününce aynı adlı İKİ KİŞİ (telefonları farklı) tek satırda birleşir; tersine aynı kişi (biri telefonsuz) iki sekmede ayrı satıra bölünür.
//   N6 her süzgeçte toplam = satırlar (ders 11).
// Beklenen sayılar programdan bağımsız: örnek tablodaki Elif Aydın kartı (3 × 3.000) ve burada girilen tutarların elle toplamı.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { cariEkstre, normalizeFilters, normalizeRecords } from "../server/lib/reports.mjs";

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
const sumOf = (rows, field) => round(rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0));

describe("2.4.4 31a F1/F5/F4: Tablodaki Kişiler ve Nakit Akışı karta taşınan ve karta girilen tahsilatı sayar; kişi adıyla görünür", () => {
  const root = mkdtempSync(path.join(tmpdir(), "rapor-kisiler-f1-"));
  let server;
  let api;
  let db;
  const ids = {};
  const keys = {};
  const window = () => `from=${day(-40)}&to=${day(1)}`;
  const kisiler = async (query = window()) => (await must(`cari-ekstre ${query}`, api.get(`/api/workspace/reports/cari-ekstre?${query}`))).report;
  const nakit = async () => (await must("nakit-akis", api.get(`/api/workspace/reports/nakit-akis?${window()}`))).report;
  const groupOf = (rep, key) => rep.groups.find(group => group.lines.some(line => line.key === key));
  const creditOf = (rep, key) => round(groupOf(rep, key)?.credit || 0);

  before(async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    api = await server.login();
    db = server.app.store;
    await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const book = tahsilatWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const first = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    keys.elif = first.records.find(record => record.name === "Elif Aydın")?.key;
    assert.ok(keys.elif, JSON.stringify(first.records.map(record => record.name)));
    // Elif (kayda bağlı cari, borcu yok): 1.000 (−20 gün) + 2.500 (−10 gün) nakit tahsilat → ikisi de 9.000'lik karta sığar (5a), taşınır.
    ids.elif = (await must("Elif cari", api.post("/api/workspace/accounts", { name: "Elif Aydın", phone: "0532 600 10 10", type: "customer", caseKey: keys.elif, caseTitle: "Elif Aydın" }))).id;
    for (const [amount, offset] of [["1.000", -20], ["2.500", -10]]) await must(`Elif ${amount}`, api.post(`/api/workspace/accounts/${ids.elif}/entries`, { kind: "in", amount, date: day(offset), method: "cash" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  let collectedBefore = 0;
  test("N4 (F4): çok sekmeli tabloda her kişi adıyla görünür (Borçlu, Müşteri, Kiracı); iç anahtar ya da dosya no görünmez", async () => {
    const rep = await kisiler("");
    const names = rep.groups.map(group => group.cari);
    for (const name of ["Ali Veli", "Zeynep Şahin", "Elif Aydın"]) assert.ok(names.includes(name), `${name} yok: ${JSON.stringify(names)}`);
    // 31f U2 (bilerek güncellendi, kullanıcı adına karar 22.10.2026): söz / taksit / kira tutarı borç değildir → borcu da tahsilatı da olmayan Burak Koç
    // (Taksitler) ve Deniz Öztürk (Kiracılar) Tablodaki Kişiler'de satır almaz (2.4.3'te de görünmüyorlardı).
    for (const name of ["Burak Koç", "Deniz Öztürk"]) assert.ok(!names.includes(name), `${name} borçsuz ve tahsilatsız, satır almaz: ${JSON.stringify(names)}`);
    assert.deepEqual(names.filter(name => /^satir:|^\d{4}\/\d+$|^M-\d+$/.test(name)), [], "ad yerine anahtar / dosya no / müşteri no");
    assert.equal(groupOf(rep, keys.elif)?.cari, "Elif Aydın");
    // İcra Takip + Ödeme Sözleri'ndeki aynı dosya no tek kişi (Zeynep Şahin, 2026/1104): iki sekmenin satırları aynı satır grubunda.
    const zeynep = rep.groups.filter(group => group.cari === "Zeynep Şahin");
    assert.equal(zeynep.length, 1, "Zeynep Şahin tek satır grubu");
    // 31f U2 / 31b MM5 (bilerek güncellendi): borç dosya no başına bir kez, İcra Takip'in Kalan'ından; Ödeme Sözleri'nin söz tutarı borç satırı açmaz.
    assert.deepEqual(zeynep[0].lines.filter(line => line.kind === "borc").map(line => [line.tab, line.borc]), [["İcra Takip", 27500]]);
  });

  test("N1 öncesi: Elif'in alacağı 3.500 (cari tahsilatları); Nakit Akışı gerçekleşen tahsilat ölçülür", async () => {
    assert.equal(creditOf(await kisiler(), keys.elif), 3500);
    collectedBefore = round((await nakit()).totals.collected);
    assert.ok(collectedBefore >= 3500, `gerçekleşen ${collectedBefore}`);
  });

  let importId = "";
  test("N1/N3 (F1): Tablodan Aktar iki tahsilatı karta taşır → alacak 3.500 KALIR, Nakit Akışı gerçekleşen aynı", async () => {
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    assert.equal(preview.records.find(record => record.key === keys.elif)?.accountMoved, 3500, "5a: 3.500 karta yazılacak");
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [keys.elif], fingerprint: preview.fingerprint }));
    assert.equal(result.accountEntriesAmount, 3500);
    importId = result.importId || db.get("SELECT id FROM plan_imports ORDER BY created_at DESC, rowid DESC LIMIT 1").id;
    assert.equal(db.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'in'", ids.elif).n, 0, "cari satırları karta geçti");
    assert.equal(creditOf(await kisiler(), keys.elif), 3500, "taşınan tahsilat rapordan düşmez");
    assert.equal(round((await nakit()).totals.collected), collectedBefore, "Nakit Akışı gerçekleşen değişmez");
  });

  test("N2 (F5): karta doğrudan girilen 700 tahsilat alacağa ve Nakit Akışı'na girer (3.500 + 700 = 4.200)", async () => {
    const plan = db.get("SELECT id FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys.elif);
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "700", date: day(0), method: "cash" }));
    assert.equal(creditOf(await kisiler(), keys.elif), 4200);
    assert.equal(round((await nakit()).totals.collected), round(collectedBefore + 700));
  });

  test("N6: her süzgeçte toplam = satırlar; Elif'in tahsilatları bir kez", async () => {
    const queries = ["", window(), `from=${day(0)}&to=${day(0)}`, `from=${day(5)}&to=${day(30)}`, "tabs=Taksitler", `tabs=${encodeURIComponent("İcra Takip")}`, "cari=elif", "minAmount=5000"];
    for (const query of queries) {
      const rep = await kisiler(query);
      assert.equal(round(rep.totals.debit), sumOf(rep.table.rows, "borc"), `${query || "(süzgeçsiz)"}: borç toplamı = satırlar`);
      assert.equal(round(rep.totals.credit), sumOf(rep.table.rows, "alacak"), `${query || "(süzgeçsiz)"}: alacak toplamı = satırlar`);
      assert.equal(round(rep.totals.credit), round(rep.groups.reduce((sum, group) => sum + group.credit, 0)), `${query || "(süzgeçsiz)"}: alacak toplamı = gruplar`);
    }
    const today = await kisiler(`from=${day(0)}&to=${day(0)}`);
    assert.equal(creditOf(today, keys.elif), 700, "bugün: yalnız karta girilen 700");
    assert.equal(creditOf(await kisiler("tabs=Taksitler"), keys.elif), 4200, "Taksitler sekmesi süzgeci");
  });

  test("N1 geri al: kart kalkar, 3.500 cariye döner → alacak 3.500 (iki kez değil), Nakit Akışı gerçekleşen geri döner", async () => {
    const plan = db.get("SELECT id FROM plans WHERE case_key = ? AND deleted_at IS NULL", keys.elif);
    const extra = db.get("SELECT id FROM plan_entries WHERE plan_id = ? AND amount = 700", plan.id);
    await must("kart tahsilatını sil", api.del(`/api/workspace/plans/${plan.id}/entries/${extra.id}`));
    await must("geri al", api.post(`/api/workspace/plans/imports/${importId}/undo`, {}));
    assert.equal(db.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'in'", ids.elif).n, 2, "iki tahsilat cariye döndü");
    assert.equal(creditOf(await kisiler(), keys.elif), 3500);
    assert.equal(round((await nakit()).totals.collected), collectedBefore);
  });
});

describe("2.4.4 31a N5: aynı adlı iki kişi (telefonları farklı) ayrı satır; aynı kişi (biri telefonsuz) iki sekmede tek satır", () => {
  const NOW = new Date(2026, 5, 15);
  const rows = [
    { __hofKey: "K-1", __sheet: "Taksitler", "Müşteri No": "K-1", Müşteri: "Elif Kaya", Telefon: "0532 800 01 01", Toplam: "3.000,00" },
    { __hofKey: "K-2", __sheet: "Taksitler", "Müşteri No": "K-2", Müşteri: "Elif Kaya", Telefon: "0532 800 01 02", Toplam: "3.000,00" },
    { __hofKey: "K-3", __sheet: "Taksitler", "Müşteri No": "K-3", Müşteri: "Tuna Sarı", Telefon: "0532 800 01 03", Toplam: "4.000,00" },
    { __hofKey: "2026/77", __sheet: "İcra Takip", "Dosya No": "2026/77", Borçlu: "Tuna Sarı", "Alacak Tutarı": "10.000,00", Kalan: "8.000,00" },
  ];
  const columnsOf = scope => [...new Set(scope.flatMap(row => Object.keys(row).filter(key => !key.startsWith("__"))))];
  const analyze = scope => analyzeColumns(scope, columnsOf(scope), { now: NOW });
  const { records } = normalizeRecords({ rows, analyses: analyze(rows), session: "s1", sessionName: "Tablo", tabs: ["Taksitler", "İcra Takip"], analyzeTab: analyze });
  const payments = [
    { caseKey: "K-1", amount: 500, date: "2026-06-02", note: "" },
    { caseKey: "K-2", amount: 700, date: "2026-06-03", note: "" },
    { caseKey: "2026/77", amount: 250, date: "2026-06-04", note: "" },
  ];

  test("iki Elif Kaya ayrı satır (500 / 700); Tuna Sarı iki sekmede tek satır (borç 4.000 + 8.000, alacak 250)", () => {
    const rep = cariEkstre({ records, payments, filters: normalizeFilters({}), now: NOW });
    const elif = rep.groups.filter(group => group.cari === "Elif Kaya").map(group => group.credit).sort((a, b) => a - b);
    assert.deepEqual(elif, [500, 700], JSON.stringify(rep.groups.map(group => [group.cari, group.credit])));
    const tuna = rep.groups.filter(group => group.cari === "Tuna Sarı");
    assert.equal(tuna.length, 1, "Tuna Sarı tek satır grubu (İcra Takip'te telefonsuz)");
    assert.deepEqual([tuna[0].debit, tuna[0].credit], [12000, 250]);
    assert.equal(rep.totals.credit, 1450);
    assert.equal(rep.totals.caris, 3);
  });

  test("ad süzgeci ikisini de getirir; toplam = satırlar", () => {
    const rep = cariEkstre({ records, payments, filters: normalizeFilters({ cari: "elif" }), now: NOW });
    assert.equal(rep.groups.length, 2);
    assert.equal(rep.totals.credit, 1200);
    assert.equal(round(rep.totals.credit), sumOf(rep.table.rows, "alacak"));
  });
});
