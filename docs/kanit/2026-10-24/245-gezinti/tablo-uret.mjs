// Gezinti tablosu (uydurma kişiler; müşteri verisi DEĞİL): Borçlu Telefon, Borçlu TC Kimlik No, Alacak Tutarı, Söz Tarihi, Duruşma Tarihi.
// Tarihler gezinti gününe göre (ders 13): Söz Tarihi bugün+2, Duruşma Tarihi bugün+4 / +5. Kullanım: node tablo-uret.mjs <depo> <gün YYYY-AA-GG> <çıktı.xlsx>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [repo, gun, out] = process.argv.slice(2);
const { buildXlsx } = await import(pathToFileURL(path.join(path.resolve(repo), "server/lib/xlsx-write.mjs")).href);
const d = off => { const t = new Date(`${gun}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + off); return t.toISOString().slice(0, 10).split("-").reverse().join("."); };
const columns = ["Dosya No", "Borçlu", "Borçlu Telefon", "Borçlu TC Kimlik No", "Alacak Tutarı", "Söz Tarihi", "Duruşma Tarihi"];
const rows = [
  { "Dosya No": "2026/101", "Borçlu": "Ayşe Demir", "Borçlu Telefon": "5367715055", "Borçlu TC Kimlik No": "10000000146", "Alacak Tutarı": "25.000,00", "Söz Tarihi": d(2), "Duruşma Tarihi": d(4) },
  { "Dosya No": "2026/102", "Borçlu": "Mehmet Kaya", "Borçlu Telefon": "5321234567", "Borçlu TC Kimlik No": "12345678950", "Alacak Tutarı": "8.400,00", "Söz Tarihi": d(3), "Duruşma Tarihi": d(5) },
  { "Dosya No": "2026/103", "Borçlu": "Zeynep Arslan", "Borçlu Telefon": "5059876543", "Borçlu TC Kimlik No": "", "Alacak Tutarı": "3.150,50", "Söz Tarihi": "", "Duruşma Tarihi": d(12) },
];
writeFileSync(out, buildXlsx([{ name: "Dosyalar", columns, rows }]));
console.log(out, rows.length, "satır");
