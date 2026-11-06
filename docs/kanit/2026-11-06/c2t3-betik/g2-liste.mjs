// Ç2 tur 3 — G2 komşu listesi: değişen sunucu dosyalarını (ledger-vouchers, bank/repair, integrity, log-detail) adıyla ya da API yoluyla anan BÜTÜN test dosyaları
// (test/ taranır; e2e ve kâhinler ayrı) + fis-defteri-*, donmus-defter-*, *onarim* test dosyaları. Kullanım: node g2-liste.mjs <depo kökü> > liste.txt
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.argv[2];
const PATTERN = /ledger-vouchers|bank\/repair|repair\.mjs|repairBank|markLegacyRows|integrity\.mjs|lib\/integrity"|createIntegrity|ledger\/integrity|integrity_log|log-detail|voucherRepair|repairLegacyReset|clearVouchers|mutabakat-gunlugu|Mutabakat Günlüğü|Mutabakat Testi/;
const NAME = /^(fis-defteri-|donmus-defter-).*\.test\.mjs$|onarim.*\.test\.mjs$/;
const out = new Set();
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (statSync(full).isDirectory()) {
      if (rel === "test/e2e" || rel === "test/bagimsiz" || rel === "test/fixtures") continue;
      walk(full);
    } else if (name.endsWith(".test.mjs") && (NAME.test(name) || PATTERN.test(readFileSync(full, "utf8")))) out.add(rel);
  }
};
walk(path.join(root, "test"));
// Kaynak tarayan genel testler (Grep "readdirSync(... server|test|lib" ile bulundu: 25 dosya) + platform taşınabilirliği + kanıt aracı (yeni sunucu ve test dosyası eklendi).
for (const name of ["whatsapp-b3-pdf-249", "sema-kapisi-bs7", "yazim-duzeni", "whatsapp-meta-izolasyon", "whatsapp-t-durum-karar-tablosu-248", "tablo-hucre-bicim", "takvim-pil-kaynak", "tunel-durum-248", "sirket-ayir-221", "sirket-listesi-221", "lisans-servisi-izolasyonu", "maliyet-bagsizlik", "migrations", "kalan-metin-246", "guncelleme-hazir-geri-cekilen", "guncelleme-hazir", "chat-archive", "createapp-acilis-geri-alma-249", "dataset", "disa-aktarim-dugmeleri", "banka-210-yetki-matrisi", "banka-210-goc", "banka-210-saat", "banka-210-statik", "banka-210-fis-kapi", "platform-tasinabilirlik", "kanit-araci"]) {
  const rel = `test/${name}.test.mjs`;
  statSync(path.join(root, rel));
  out.add(rel);
}
console.log([...out].sort().join("\n"));
