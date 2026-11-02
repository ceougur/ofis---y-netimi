// Sahte Meta sunucusunun testlerinin DİŞİ (ders 7): sunucuya bilerek hata enjekte edilir, testler AYRI bir kopyada (ders 23, 25: benzersiz
// geçici klasör) koşulur; her mutasyonda en az bir test kırmızı olmalı. Koşu (depo kökünden):
//   node tools/kanit.mjs kos 248-k0-sahte-meta-mutasyon -- node test/bagimsiz/whatsapp-248/sahte-meta/mutasyon.mjs
// Çıktının sonu "N/M denetim geçti" (yakalanan / toplam); yakalanmayan varsa çıkış 1.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const DOSYALAR = ["sunucu.mjs", "hatalar.mjs", "kanca.mjs", "sunucu.test.mjs"];

const MUTASYONLAR = [
  { ad: "'+' yoksa ülke kodu EKLENMEZ", dosya: "sunucu.mjs", eski: "return String(isletmeUlkeKodu) + rakamlar(ham);", yeni: "return rakamlar(ham);" },
  { ad: "PAUSED şablon 132015 yerine 132001", dosya: "sunucu.mjs", eski: 'if (sablon.status === "PAUSED") return this.hata(132015);', yeni: 'if (sablon.status === "PAUSED") return this.hata(132001);' },
  { ad: "koptu:'sonra' iletiyi kaydetmez", dosya: "sunucu.mjs", eski: 'if (y.koptu === "sonra") return kopar("koptu-sonra");', yeni: 'if (y.koptu === "sonra") { this.mesajlar.pop(); return kopar("koptu-sonra"); }' },
  { ad: "pricing her durumda", dosya: "sunucu.mjs", eski: "if (fiyatAl && s.durum !== \"failed\")", yeni: "if (s.durum !== \"failed\")" },
  { ad: "sınır FARKLI alıcı yerine kabul sayar", dosya: "sunucu.mjs", eski: "if (!kume.has(hedef) && kume.size >= L)", yeni: "if (this.mesajlar.length + (this.ayar.sinir.disKullanim || []).length >= L)" },
  { ad: "kanca kuyruğu 7 günde düşmez", dosya: "kanca.mjs", eski: "if (simdi - k.ilkDenemeT > YEDI_GUN_MS)", yeni: "if (false)" },
  { ad: "medya 30 gün ömrü yok", dosya: "sunucu.mjs", eski: "if (!m || m.silindi || this.simdi() - m.yuklenmeT > this.ayar.medyaOmruMs) return { hata:", yeni: "if (!m || m.silindi) return { hata:" },
  { ad: "aynı ad + dil şablonu ikinci kez açılır", dosya: "sunucu.mjs", eski: "if (this.sablonlar.some(s => s.waba === waba.id && s.name === name && s.language === language && !s.silindi))", yeni: "if (false)" },
  { ad: "imza yanlış anahtarla", dosya: "kanca.mjs", eski: 'return "sha256=" + crypto.createHmac("sha256", sir)', yeni: 'return "sha256=" + crypto.createHmac("sha256", sir + "x")' },
  { ad: "kayıt 72 saatte 11 deneme", dosya: "sunucu.mjs", eski: "if (n.kayitDenemeleri.length >= 10) return this.hata(133016); // belge: 72 saatte 10", yeni: "if (n.kayitDenemeleri.length >= 11) return this.hata(133016);" },
  { ad: "değişken sayısı denetimi yok", dosya: "sunucu.mjs", eski: "if (govdeParam.length !== beklenenGovde) return this.hata(132000);", yeni: "" },
  { ad: "silinmiş medyayla gönderim kabul", dosya: "sunucu.mjs", eski: "if (!m || m.silindi || this.simdi() - m.yuklenmeT > this.ayar.medyaOmruMs) {", yeni: "if (!m) {" },
  { ad: "varlık erişimi denetimi yok (code 200)", dosya: "sunucu.mjs", eski: "if (waba && !b.wabalar.includes(\"*\") && !b.wabalar.includes(waba)) return this.hata(200);", yeni: "" },
  { ad: "ES kodu ikinci kez kullanılabilir", dosya: "sunucu.mjs", eski: "if (kod.kullanildi) return this.hata(100, { details: \"SAHTE-META D0: kod daha önce kullanıldı\" });", yeni: "" },
  { ad: "messaging_limit_tier kabul edilir", dosya: "sunucu.mjs", degisiklikler: [['if (alanlar.includes("messaging_limit_tier")) return', 'if (false) return'],
    ["whatsapp_business_manager_messaging_limit: n.basamak, // belge", "whatsapp_business_manager_messaging_limit: n.basamak, messaging_limit_tier: n.basamak,"]] },
  { ad: "belirteç sızıntısı denetimi yok", dosya: "sunucu.mjs", eski: "if (b.length >= 8 && metin.includes(b))", yeni: "if (false)" },
  { ad: "alt satır 60 sınırı yok", dosya: "sunucu.mjs", eski: 'if ([...String(c.text || "")].length > 60) return this.hata(2388040, { details: "Footer text > 60" });', yeni: "" },
  { ad: "UTILITY → MARKETING kararı uygulanmaz", dosya: "sunucu.mjs", eski: "const karar = this.ayar.kategoriKarari?.[name] ?? category;", yeni: "const karar = category;" },
];

let yakalanan = 0;
const satirlar = [];
for (const m of MUTASYONLAR) {
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "k0-248-sahte-mut-"));
  try {
    for (const d of DOSYALAR) fs.copyFileSync(path.join(BURASI, d), path.join(gecici, d));
    const hedef = path.join(gecici, m.dosya);
    let metin = fs.readFileSync(hedef, "utf8");
    let uygulanamadi = null;
    for (const [eski, yeni] of m.degisiklikler || [[m.eski, m.yeni]]) {
      const adet = metin.split(eski).length - 1;
      if (adet !== 1) { uygulanamadi = `eski metin ${adet} kez: ${eski.slice(0, 60)}`; break; }
      metin = metin.replace(eski, yeni);
    }
    if (uygulanamadi) { satirlar.push(`UYGULANAMADI ${m.ad}: ${uygulanamadi}`); continue; }
    fs.writeFileSync(hedef, metin);
    const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "sunucu.test.mjs"], { cwd: gecici, encoding: "utf8", timeout: 180000 });
    const kirmizi = [...String(r.stdout).matchAll(/^not ok \d+ - (.*)$/gm)].map(x => x[1]);
    if (r.status !== 0 && kirmizi.length) {
      yakalanan += 1;
      satirlar.push(`YAKALANDI ${m.ad} ← ${kirmizi.length} kırmızı: ${kirmizi.slice(0, 2).join(" | ").slice(0, 160)}`);
    } else {
      satirlar.push(`YAKALANMADI ${m.ad} (çıkış ${r.status})`);
    }
  } finally {
    fs.rmSync(gecici, { recursive: true, force: true }); // yalnız kendi oluşturduğu tam yol (ders 36)
  }
}
for (const s of satirlar) console.log(s);
console.log(`${yakalanan}/${MUTASYONLAR.length} denetim geçti`);
process.exit(yakalanan === MUTASYONLAR.length ? 0 : 1);
