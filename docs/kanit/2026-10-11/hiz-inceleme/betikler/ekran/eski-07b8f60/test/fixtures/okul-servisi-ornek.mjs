// Okul servisi örneği (v2.0.1): öğrenciler (veli, okul, güzergâh, aylık ücret ve ay ay ödeme kolonları), araçlar
// (muayene, sigorta, kasko, güzergâh izni vizesi) ve şoförler (SRC, psikoteknik, ehliyet). Tarihler verilen güne göre.
//   node test/fixtures/okul-servisi-ornek.mjs <çıktı.xlsx>
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₺`;
const pad = value => String(value).padStart(2, "0");
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function okulServisiWorkbook(now = new Date()) {
  const at = days => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  };
  // Okul yılının bugüne kadarki ayları (Eylül'den başlayarak, en çok son 3 ay) ve gelecek ay.
  const month = offset => MONTHS[new Date(now.getFullYear(), now.getMonth() + offset, 1).getMonth()];
  const past = [month(-2), month(-1), month(0)];
  const next = month(1);
  const students = [
    ["Ada Yılmaz", "Ayşe Yılmaz", "0532 410 10 10", "Atatürk İlkokulu", "2-A", "Güzergâh 1", "34 SRV 101", 3500, ["Ödendi", "Ödendi", "Ödendi"]],
    ["Efe Kaya", "Murat Kaya", "0532 410 20 20", "Atatürk İlkokulu", "4-B", "Güzergâh 1", "34 SRV 101", 3500, ["Ödendi", "Ödendi", ""]],
    ["Zeynep Demir", "Elif Demir", "0533 410 30 30", "Cumhuriyet Ortaokulu", "6-C", "Güzergâh 2", "34 SRV 202", 3800, ["Ödendi", "", ""]],
    ["Can Öztürk", "Hakan Öztürk", "0535 410 40 40", "Cumhuriyet Ortaokulu", "7-A", "Güzergâh 2", "34 SRV 202", 3800, ["Ödendi", "Ödendi", "1.900"]],
    ["Deniz Arslan", "Selin Arslan", "0536 410 50 50", "Fatih Koleji", "3-D", "Güzergâh 3", "34 SRV 303", 4500, ["✓", "✓", "✓"]],
    ["Mert Çelik", "Burak Çelik", "0537 410 60 60", "Fatih Koleji", "5-A", "Güzergâh 3", "34 SRV 303", 4500, ["Ödendi", "Ödenmedi", ""]],
  ];
  const ogrenciler = {
    name: "Öğrenciler",
    columns: ["Öğrenci", "Veli", "Veli Telefon", "Okul", "Sınıf", "Güzergâh", "Servis Plaka", "Aylık Ücret", ...past, next, "Durum"],
    rows: students.map(([ogrenci, veli, tel, okul, sinif, guzergah, plaka, ucret, paid]) => ({
      Öğrenci: ogrenci, Veli: veli, "Veli Telefon": tel, Okul: okul, Sınıf: sinif, Güzergâh: guzergah, "Servis Plaka": plaka, "Aylık Ücret": tl(ucret),
      [past[0]]: paid[0], [past[1]]: paid[1], [past[2]]: paid[2], [next]: "", Durum: "Aktif",
    })),
  };
  const araclar = {
    name: "Araçlar",
    columns: ["Plaka", "Marka / Model", "Kapasite", "Şoför", "Muayene Bitiş", "Sigorta Bitiş", "Kasko Bitiş", "Güzergâh İzni Vize"],
    rows: [
      { Plaka: "34 SRV 101", "Marka / Model": "Ford Transit", Kapasite: "16", Şoför: "Ahmet Güneş", "Muayene Bitiş": at(4), "Sigorta Bitiş": at(140), "Kasko Bitiş": at(140), "Güzergâh İzni Vize": at(60) },
      { Plaka: "34 SRV 202", "Marka / Model": "Mercedes Sprinter", Kapasite: "19", Şoför: "Veli Tekin", "Muayene Bitiş": at(200), "Sigorta Bitiş": at(-3), "Kasko Bitiş": at(90), "Güzergâh İzni Vize": at(6) },
      { Plaka: "34 SRV 303", "Marka / Model": "Fiat Ducato", Kapasite: "16", Şoför: "Oya Kılıç", "Muayene Bitiş": at(300), "Sigorta Bitiş": at(250), "Kasko Bitiş": at(1), "Güzergâh İzni Vize": at(180) },
    ],
  };
  const soforler = {
    name: "Şoförler",
    columns: ["Şoför", "Telefon", "Araç", "SRC Geçerlilik", "Psikoteknik Bitiş", "Ehliyet Geçerlilik"],
    rows: [
      { Şoför: "Ahmet Güneş", Telefon: "0542 510 11 11", Araç: "34 SRV 101", "SRC Geçerlilik": at(400), "Psikoteknik Bitiş": at(5), "Ehliyet Geçerlilik": at(900) },
      { Şoför: "Veli Tekin", Telefon: "0542 510 22 22", Araç: "34 SRV 202", "SRC Geçerlilik": at(700), "Psikoteknik Bitiş": at(300), "Ehliyet Geçerlilik": at(-10) },
      { Şoför: "Oya Kılıç", Telefon: "0542 510 33 33", Araç: "34 SRV 303", "SRC Geçerlilik": at(3), "Psikoteknik Bitiş": at(500), "Ehliyet Geçerlilik": at(1200) },
    ],
  };
  return [ogrenciler, araclar, soforler];
}

export const okulServisiXlsx = (now = new Date()) => buildXlsx(okulServisiWorkbook(now), { title: "Okul servisi" });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(process.argv[2] || "okul-servisi-ornek.xlsx", okulServisiXlsx());
  console.log("yazıldı", process.argv[2]);
}
