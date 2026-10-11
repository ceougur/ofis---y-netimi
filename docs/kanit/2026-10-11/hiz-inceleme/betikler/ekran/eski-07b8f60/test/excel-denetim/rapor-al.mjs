// Programın KENDİ ürettiği mali raporlar (Rapor Merkezi, Tüm Zamanlar), her şirket için PDF + Excel; birleşik şirket raporu.
// Kullanım: SP=<çalışma> node rapor-al.mjs
import fs from "node:fs";
import path from "node:path";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const DIR = path.join(HERE, "cikti", "raporlar");
fs.rmSync(DIR, { recursive: true, force: true });
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false });
const { port } = await app.listen(0, "127.0.0.1");
const admin = staff(`http://127.0.0.1:${port}`);
await admin.login("admin", PASS);
const REPORTS = [
  ["hesap-mizani", "01 Hesap Mizani"],
  ["mizan", "02 Cari Mizani"],
  ["cari-listesi", "03 Cari Listesi ve Bakiyeler"],
  ["kdv-ozeti", "04 KDV Ozeti"],
  ["fatura-satis", "05 Satis Faturalari"],
  ["fatura-alis", "06 Alis Faturalari"],
  ["gider-raporu", "07 Gider Raporu"],
  ["kasa-hareketleri", "08 Kasa Hareketleri (Nakit)"],
  ["banka-pos-hareketleri", "09 Banka ve POS Hareketleri"],
  ["cek-portfoy", "10 Cek Senet Portfoyu"],
  ["taksit-kartlari", "11 Taksit Kartlari"],
  ["taksit-tahsilatlari", "12 Taksit Tahsilatlari"],
  ["cari-tahsilat", "13 Cari Bazinda Tahsilat"],
  ["acik-faturalar", "14 Acik Faturalar"],
  ["alacak-yaslandirma", "15 Alacak Yaslandirma"],
  ["stok-durumu", "16 Stok Durumu"],
  ["urun-satis-karlilik", "17 Urun Satis Karlilik"],
  ["defter-mutabakati", "18 Defter Mutabakati"],
];
const list = [];
for (const [code, id] of Object.entries(state.companies)) {
  const c = admin.withCompany(id);
  const dir = path.join(DIR, code);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rep, name] of REPORTS) {
    for (const ext of ["pdf", "xlsx"]) {
      const r = await c.raw("GET", `/api/workspace/report-center/${rep}/${ext}?preset=all`);
      const file = path.join(dir, `${code} ${name}.${ext}`);
      if (r.status === 200) fs.writeFileSync(file, r.buffer);
      list.push(`${code} ${name}.${ext}: HTTP ${r.status}, ${r.buffer.length} bayt`);
    }
  }
}
for (const ext of ["pdf", "xlsx"]) {
  const r = await admin.raw("GET", `/api/companies/report.${ext}?companies=${Object.values(state.companies).join(",")}`);
  if (r.status === 200) fs.writeFileSync(path.join(DIR, `Birlesik Sirket Raporu.${ext}`), r.buffer);
  list.push(`Birleşik şirket raporu.${ext}: HTTP ${r.status}, ${r.buffer.length} bayt`);
}
fs.writeFileSync(path.join(DIR, "liste.txt"), list.join("\n"));
console.log(list.join("\n"));
await app.close();
