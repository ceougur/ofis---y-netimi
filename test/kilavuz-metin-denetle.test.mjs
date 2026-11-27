// Kılavuz ad denetimi (docs/kilavuz/metin-denetle.mjs; 2.5.0 BS-5: bütün bölümler). Ekran metni ve program kaynağı burada elle verilir; gerçek ekranla
// koşu CI e2e "kilavuz-metin" (docs/kilavuz/ekran-banka.mjs --denetim).
//
// NASIL BOZARIM: (1) düğmenin adı programda değişir, kılavuz eski adı yazmaya devam eder (2.4.3'te "Toplam Borç / Ödemeler" → "Toplam Borç");
// (2) eski ad yalnız bir yorumda kalır ve "kaynakta var" sayılır; (3) dizgedeki accept="image/*" yorum başlangıcı sanılıp arkasındaki kod silinir;
// (4) 7. / 8. bölümde ekranda olmayan ad kaynakta bulunup geçer (Kasa / Banka ekranları gezintide baştan sona açılır, ekran zorunlu);
// (5) yer tutuculu ad ("Yok Say (N)") ve büyük harfli pencere başlığı ("PERSONEL ÖZETİ") yanlışlıkla eksik sayılır; (6) Windows'ta CRLF.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { bolumler, denetle, kaynakMetni } from "../docs/kilavuz/metin-denetle.mjs";

const root = mkdtempSync(path.join(tmpdir(), "kilavuz-metin-denetle-"));
after(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(path.join(root, "client", "assets"), { recursive: true });
mkdirSync(path.join(root, "server"), { recursive: true });
mkdirSync(path.join(root, "packaging", "windows"), { recursive: true });
writeFileSync(path.join(root, "client", "assets", "ornek.js"), [
  "// eski ad yalnız yorumda: Toplam Borç / Ödemeler",
  "/* blok yorum: Eski Düğme */",
  "const a = `<input type=\"file\" accept=\"image/*\"><button>Kaşe / İmza Seç</button>`;",
  "const b = `<button>Yok Say${n > 1 ? ` (${n})` : \"\"}</button>`; // satır sonu yorumu: Yorumdaki Ad",
  "const c = { eyebrow: \"PERSONEL ÖZETİ\", url: \"https://ornek.local/a\", label: \"Toplam Borç\" };",
  "const d = '<span aria-hidden=\"true\">+</span> Sayfa';",
  "*/ const e = \"Sonraki Kod\";",
].join("\r\n"));
writeFileSync(path.join(root, "server", "rapor.mjs"), "export const title = \"Banka ve POS Hareketleri\";\n");
writeFileSync(path.join(root, "packaging", "windows", "setup.iss"), "; yorum: Yorumdaki Kurulum\r\nName: \"sunucu\"; Description: \"Sunucu Bilgisayar (veriler burada)\"\r\n");
const kaynak = kaynakMetni(root);
const html = [
  "<h2>7. Kasa</h2><p><b>Ekrandaki Düğme</b>, <b>Toplam Borç</b>, <b>Kasa Özel</b>.</p>",
  "<h2>9. Cari</h2><p><b>Toplam Borç / Ödemeler</b> · <b>Kaşe / İmza Seç</b> · <b>Yok Say (N)</b> · <b>Personel Özeti</b> · <b>+ Sayfa</b>",
  "<b>Eski Düğme</b> · <b>Yorumdaki Ad</b> · <b>Sunucu Bilgisayar</b> · <b>Yorumdaki Kurulum</b> · <i>Banka ve POS Hareketleri</i> · <b>Hiç Yok</b>",
  "<b>Kasa Özel → Ekrandaki Düğme</b> · <b>Hızlı Arama (Ctrl+K)</b> · <b>Generate token</b></p>",
].join("\n");
const texts = { kasa: "Ekrandaki Düğme\nKasa Özel" };
const sonuc = denetle(texts, null, html, { kaynak });
const has = (list, item) => list.includes(item);

describe("kılavuz ad denetimi (bütün bölümler)", () => {
  it("bütün bölümleri tarar (bölüm verilmezse)", () => {
    assert.deepEqual(bolumler(html), [7, 9]);
    assert.ok(sonuc.checked.some(item => item.startsWith("9: ")), "9. bölüm ekranla da karşılaştırılmalı");
  });
  it("ekrandaki ad 'ekranda'; ekranda olmayan ama kaynakta birebir geçen ad 7./8. dışında 'kaynakta'", () => {
    assert.ok(has(sonuc.checked, "7: Ekrandaki Düğme") && has(sonuc.checked, "9: Kasa Özel") && has(sonuc.checked, "9: Ekrandaki Düğme"));
    for (const item of ["9: Kaşe / İmza Seç", "9: Sunucu Bilgisayar", "9: Banka ve POS Hareketleri"]) assert.ok(has(sonuc.source, item), item);
  });
  it("7. ve 8. bölümde ekran zorunlu: kaynakta olsa da ekranda yoksa EKSİK", () => {
    assert.ok(has(sonuc.missing, "7: Toplam Borç"), JSON.stringify(sonuc));
  });
  it("eski / yorumdaki / hiç olmayan ad EKSİK (yorumlar ayıklanır, Inno Setup ';' yorumu dahil)", () => {
    for (const item of ["9: Toplam Borç / Ödemeler", "9: Eski Düğme", "9: Yorumdaki Ad", "9: Yorumdaki Kurulum", "9: Hiç Yok"]) assert.ok(has(sonuc.missing, item), item);
  });
  it("accept=\"image/*\" yorum başlangıcı sayılmaz (arkasındaki kod silinmez); adresteki :// yorum değildir", () => {
    assert.ok(kaynak.includes("PERSONEL ÖZETİ") && kaynak.includes("Toplam Borç") && kaynak.includes("Sonraki Kod"));
    assert.ok(!kaynak.includes("Eski Düğme") && !kaynak.includes("Yorumdaki Ad"));
  });
  it("yer tutuculu ad, büyük harfli başlık ve etiketle bölünmüş ad bulunur", () => {
    for (const item of ["9: Yok Say (N)", "9: Personel Özeti", "9: + Sayfa"]) assert.ok(has(sonuc.source, item), item);
  });
  it("madde başı vurgusu ve program dışı ekran adı denetim dışında (ayrı listede)", () => {
    assert.ok(has(sonuc.skipped, "9: Hızlı Arama (Ctrl+K)") && has(sonuc.skipped, "9: Generate token"));
  });
});
