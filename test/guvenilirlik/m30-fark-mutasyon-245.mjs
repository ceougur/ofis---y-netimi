// 2.4.5 G4 — göç farkı sınıflayıcısının DİŞİ (ders 7): gerçek göç ölçüsüne (sonra) bilerek tek bir hata enjekte edilir; m30-fark.mjs (profil 244-245) her
// birinde BULGU vermeli. Hatasız ölçüde BULGU 0 olmalı (yanlış alarm yok).
//   node --disable-warning=ExperimentalWarning test/guvenilirlik/m30-fark-mutasyon-245.mjs --kok <klasör> [--once v2.4.4-taban] [--sonra guncel-goc]
import { readFileSync } from "node:fs";
import path from "node:path";
import { diffFacts, oldDataMap } from "./m30-fark.mjs";
import { companyDbFile, readRegistry } from "./uretici.mjs";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const root = path.resolve(value("kok", "."));
const read = name => JSON.parse(readFileSync(path.join(root, "cikti", `${name}.json`), "utf8"));
const before = read(value("once", "v2.4.4-taban"));
const afterText = JSON.stringify(read(value("sonra", "guncel-goc")));
const oldDir = path.join(root, "taban", "data");
const registry = readRegistry(oldDir) || [{ id: "sirket-001", dir: "" }];
const maps = Object.fromEntries(before.install.companies.map(c => [c.code, oldDataMap(companyDbFile(oldDir, registry.find(e => e.id === c.id) || { id: c.id, dir: "" }))]));
const firstKey = obj => Object.keys(obj)[0];

const MUTATIONS = {
  "hatasız (yanlış alarm yok)": () => {},
  "bir carinin bakiyesi 1 kuruş": a => (a.companies["001"].accounts[firstKey(a.companies["001"].accounts)].balance += 1),
  "cari kartında bir hareket değişti": a => (a.companies["001"].accountCards[firstKey(a.companies["001"].accountCards)].entries = "bozuk"),
  "eski satıra Vade Tarihi yazıldı (K6.4)": a => (a.companies["001"].entryNewFields.dueDate = 1),
  "Kalan tutardan büyük (K6.2)": a => a.companies["002"].entryNewFields.remainingOutOfRange.push(["x", "y", 10, 11]),
  "veri dosyasında due_date dolu (K6.4)": a => (a.files["001"].entryDatesFilled.due_date = 1),
  "takvimde tablo kalemi kaldı (K4.1)": (a, b) => a.companies["001"].dues.items.push(b.companies["001"].dues.items.find(item => !item.source)),
  "takvimden fatura kalemi düştü (K4.1)": a => (a.companies["001"].dues.items = a.companies["001"].dues.items.filter((item, i, all) => i !== all.findIndex(x => x.source === "invoice"))),
  "takvimde taksit tutarı değişti": a => (a.companies["002"].dues.items.find(item => item.source === "plan").amount += 1),
  "projeksiyonda taksit satırı değişti (K4.1)": a => (a.companies["001"].projection.rows.find(row => row[1] === "plan")[5] += 100),
  "projeksiyonda tablo kalemi kaldı (K4.1)": a => (a.companies["001"].projection.totals.in += 1000),
  "Vade Takip fatura kaynağı değişti (K4.1)": a => (a.companies["001"].dueTrackBySource.invoice.totals.count += 1),
  "Vade Takip toplamı tablo farkından başka (K4.1)": a => (a.companies["002"].dueTrack.totals.count += 1),
  "Tablodaki Kişiler borcu değişti (K5)": a => (a.companies["001"].tableReports["cari-ekstre"].report.groups[0].lines[0].borc += 1),
  "Tablo raporunda belgesiz kolon adı (K5)": a => (a.companies["002"].tableReports["vade-takip"].report.table.columns.find(c => c.key === "amount").label = "Tutar (Değişti)"),
  "Tablodaki Nakit Akışı Beklenen değişti (K5)": a => (a.companies["001"].tableReports["nakit-akis"].report.totals.expected += 1),
  "Tablodaki Nakit Akışı beklenenli dönem satırı düştü (K5)": a => {
    const report = a.companies["001"].tableReports["nakit-akis"].report;
    const at = report.rows.findIndex(row => row.expected > 0);
    report.rows.splice(at, 1);
  },
  "mizan bir hesap": a => (a.companies["002"].trial[firstKey(a.companies["002"].trial)].debit += 1),
  "Kasa satırları": a => (a.companies["001"].cash.allDigest = "bozuk"),
  "fatura ödeme durumu": a => (a.companies["001"].invoices[firstKey(a.companies["001"].invoices)].open += 1),
};
let fail = 0;
for (const [name, mutate] of Object.entries(MUTATIONS)) {
  const after = JSON.parse(afterText);
  mutate(after, before);
  const report = diffFacts(before, after, { maps, profile: "244-245" });
  const clean = name.startsWith("hatasız");
  const ok = clean ? report.bulgu.length === 0 : report.bulgu.length > 0;
  if (!ok) fail += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}: BULGU ${report.bulgu.length}${report.bulgu.length ? ` (${report.bulgu.map(r => `${r.company} ${r.area}`).join("; ").slice(0, 200)})` : ""}`);
}
const n = Object.keys(MUTATIONS).length;
console.log(`# mutasyon: ${n - 1} hata + 1 hatasız; yakalanmayan ${fail}`);
console.log(`# tests ${n}\n# pass ${n - fail}\n# fail ${fail}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exitCode = fail ? 1 : 0;
