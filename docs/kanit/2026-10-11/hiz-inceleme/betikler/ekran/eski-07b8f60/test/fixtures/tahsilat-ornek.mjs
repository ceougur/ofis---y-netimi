// Tahsilat takvimi örneği (v2.0.1): icra takibi + ödeme sözleri, taksit planı ve kira listesi. Tarihler verilen güne
// göre üretilir (testler takvim ilerledikçe bozulmasın; kullanıcıya verilen örnek dosya da güncel görünsün).
//   node test/fixtures/tahsilat-ornek.mjs <çıktı.xlsx>
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₺`;
const pad = value => String(value).padStart(2, "0");
const dayText = date => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function tahsilatWorkbook(now = new Date()) {
  const at = days => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    return dayText(date);
  };
  const monthText = offset => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };
  const icra = {
    name: "İcra Takip",
    columns: ["Dosya No", "Borçlu", "Alacaklı", "İcra Dairesi", "Telefon", "Alacak Tutarı", "Kalan", "Durum"],
    rows: [
      { "Dosya No": "2026/1101", Borçlu: "Ali Veli", Alacaklı: "Örnek Banka A.Ş.", "İcra Dairesi": "İstanbul 2. İcra Dairesi", Telefon: "0532 111 11 11", "Alacak Tutarı": tl(48000), Kalan: tl(36000), Durum: "Derdest" },
      { "Dosya No": "2026/1102", Borçlu: "Ayşe Kaya", Alacaklı: "Örnek Banka A.Ş.", "İcra Dairesi": "İstanbul 5. İcra Dairesi", Telefon: "0532 222 22 22", "Alacak Tutarı": tl(22000), Kalan: tl(22000), Durum: "Derdest" },
      { "Dosya No": "2026/1103", Borçlu: "Mehmet Demir", Alacaklı: "Örnek Finans", "İcra Dairesi": "Ankara 1. İcra Dairesi", Telefon: "0533 333 33 33", "Alacak Tutarı": tl(15000), Kalan: tl(0), Durum: "Kapandı" },
      { "Dosya No": "2026/1104", Borçlu: "Zeynep Şahin", Alacaklı: "Örnek Finans", "İcra Dairesi": "İzmir 3. İcra Dairesi", Telefon: "0535 444 44 44", "Alacak Tutarı": tl(31000), Kalan: tl(27500), Durum: "Haciz aşamasında" },
      { "Dosya No": "2026/1105", Borçlu: "Can Yıldız", Alacaklı: "Örnek Banka A.Ş.", "İcra Dairesi": "Bursa 4. İcra Dairesi", Telefon: "0536 555 55 55", "Alacak Tutarı": tl(12500), Kalan: tl(12500), Durum: "Derdest" },
    ],
  };
  const sozler = {
    name: "Ödeme Sözleri",
    columns: ["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı", "Görüşen", "Durum", "Açıklama"],
    rows: [
      { "Dosya No": "2026/1101", Borçlu: "Ali Veli", "Söz Tarihi": at(-6), "Söz Tutarı": tl(5000), Görüşen: "Selin", Durum: "Bekliyor", Açıklama: "Maaş gününde ödeyeceğini söyledi" },
      { "Dosya No": "2026/1102", Borçlu: "Ayşe Kaya", "Söz Tarihi": at(0), "Söz Tutarı": tl(3000), Görüşen: "Emre", Durum: "Bekliyor", Açıklama: "Havale ile" },
      { "Dosya No": "2026/1104", Borçlu: "Zeynep Şahin", "Söz Tarihi": at(3), "Söz Tutarı": tl(7500), Görüşen: "Selin", Durum: "Bekliyor", Açıklama: "Kısmi ödeme sözü" },
      { "Dosya No": "2026/1105", Borçlu: "Can Yıldız", "Söz Tarihi": at(-40), "Söz Tutarı": tl(2500), Görüşen: "Emre", Durum: "Ödendi", Açıklama: "Dekont geldi" },
      { "Dosya No": "2026/1103", Borçlu: "Mehmet Demir", "Söz Tarihi": at(-20), "Söz Tutarı": tl(15000), Görüşen: "Selin", Durum: "Ödendi", Açıklama: "Dosya kapandı" },
    ],
  };
  const taksit = {
    name: "Taksitler",
    columns: ["Müşteri No", "Müşteri", "Telefon", "Toplam", "1. Taksit Tarihi", "1. Taksit Tutarı", "2. Taksit Tarihi", "2. Taksit Tutarı", "3. Taksit Tarihi", "3. Taksit Tutarı", "Durum"],
    rows: [
      { "Müşteri No": "M-201", Müşteri: "Elif Aydın", Telefon: "0532 600 10 10", Toplam: tl(9000), "1. Taksit Tarihi": at(-35), "1. Taksit Tutarı": tl(3000), "2. Taksit Tarihi": at(-5), "2. Taksit Tutarı": tl(3000), "3. Taksit Tarihi": at(25), "3. Taksit Tutarı": tl(3000), Durum: "Devam" },
      { "Müşteri No": "M-202", Müşteri: "Burak Koç", Telefon: "0532 600 20 20", Toplam: tl(6000), "1. Taksit Tarihi": monthText(-1), "1. Taksit Tutarı": tl(2000), "2. Taksit Tarihi": monthText(0), "2. Taksit Tutarı": tl(2000), "3. Taksit Tarihi": monthText(1), "3. Taksit Tutarı": tl(2000), Durum: "Devam" },
      { "Müşteri No": "M-203", Müşteri: "Selin Arslan", Telefon: "0532 600 30 30", Toplam: tl(4500), "1. Taksit Tarihi": at(-30), "1. Taksit Tutarı": tl(1500), "2. Taksit Tarihi": at(2), "2. Taksit Tutarı": tl(1500), "3. Taksit Tarihi": at(32), "3. Taksit Tutarı": tl(1500), Durum: "Devam" },
      { "Müşteri No": "M-204", Müşteri: "Emre Çelik", Telefon: "0532 600 40 40", Toplam: tl(3000), "1. Taksit Tarihi": at(-60), "1. Taksit Tutarı": tl(1500), "2. Taksit Tarihi": at(-30), "2. Taksit Tutarı": tl(1500), "3. Taksit Tarihi": "", "3. Taksit Tutarı": "", Durum: "Ödendi" },
    ],
  };
  const kira = {
    name: "Kiracılar",
    columns: ["Daire", "Kiracı", "Telefon", "Kira bedeli", "Ödeme günü", "Sözleşme bitiş", "Sigorta yenileme"],
    rows: [
      { Daire: "A-1", Kiracı: "Deniz Öztürk", Telefon: "0542 700 11 11", "Kira bedeli": tl(15000), "Ödeme günü": String(Math.max(1, now.getDate() - 3)), "Sözleşme bitiş": at(5), "Sigorta yenileme": at(120) },
      { Daire: "A-2", Kiracı: "Hakan Kurt", Telefon: "0542 700 22 22", "Kira bedeli": tl(12000), "Ödeme günü": "1", "Sözleşme bitiş": at(300), "Sigorta yenileme": at(2) },
      { Daire: "B-1", Kiracı: "Gizem Polat", Telefon: "0542 700 33 33", "Kira bedeli": tl(18000), "Ödeme günü": "28", "Sözleşme bitiş": at(200), "Sigorta yenileme": at(90) },
    ],
  };
  return [icra, sozler, taksit, kira];
}

export const tahsilatXlsx = (now = new Date()) => buildXlsx(tahsilatWorkbook(now), { title: "Tahsilat takibi" });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(process.argv[2] || "tahsilat-ornek.xlsx", tahsilatXlsx());
  console.log("yazıldı", process.argv[2]);
}
