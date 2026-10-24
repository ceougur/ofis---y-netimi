// 2.4.4 madde 8 (UI11, kullanıcı kararı 21.10.2026): dışa aktarım düğmeleri TEK görünüm. Liste ve rapor düğmesi tek ad "PDF" / "Excel" (ne indirdiği
// erişilebilir adda + ipucunda); kart/belge çıktısı adlı kalır ("Cari Ekstre - PDF"); hepsi ortak aileden (HOF.outputButton → .hof-rep-out is-pdf |
// is-xlsx | is-print). Kaynak taraması: eski adlar ("PDF İndir", "Liste - PDF" …) ve ortak aile dışında elle yazılmış PDF/Excel bağlantısı ya da
// Yazdır/dışa aktar düğmesi kırılır. Ekran denetimi: test/e2e/uiux-ui11-244.mjs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const ROOT = new URL("../", import.meta.url);
const files = [...readdirSync(new URL("client/assets/", ROOT)).filter(name => name.endsWith(".js")).map(name => `client/assets/${name}`), ...readdirSync(new URL("client/", ROOT)).filter(name => name.endsWith(".html")).map(name => `client/${name}`)];
const sources = files.map(file => [file, readFileSync(new URL(file, ROOT), "utf8")]);

describe("dışa aktarım düğmeleri (UI11)", () => {
  it("eski düğme adları kalmadı (liste/rapor tek ad PDF / Excel)", () => {
    const found = [];
    for (const [file, src] of sources) for (const m of src.matchAll(/>\s*(?:\$\{[^}]*\})?\s*(PDF İndir|Excel İndir|Liste - PDF|Liste - Excel|Cari Listesi - PDF)\s*</g)) found.push(`${file}: ${m[1]}`);
    for (const [file, src] of sources) for (const m of src.matchAll(/"(Liste - PDF|Cari Listesi - PDF)"/g)) found.push(`${file}: "${m[1]}"`);
    assert.deepEqual(found, []);
  });
  it("PDF / Excel bağlantıları ortak ailede (makbuz satırı ve kılavuz bağlantısı hariç)", () => {
    const found = [];
    for (const [file, src] of sources)
      for (const m of src.matchAll(/href="[^"]*?(?:\.pdf|\/pdf|\.xlsx|\/xlsx)\b/g)) {
        const start = src.lastIndexOf("<a", m.index);
        const tag = src.slice(start, m.index + 400);
        // Satırdaki makbuz, kılavuz bağlantısı ve e-Belgenin resmî görüntüsü (entegratörün belgesi; "XML İndir" gibi belge işlemi) dışa aktarım değildir.
        if (/makbuz\.pdf|\/kilavuz\/|resmi\.pdf/.test(tag)) continue;
        if (!/class="hof-rep-out is-(?:pdf|xlsx)"/.test(tag.slice(0, tag.indexOf(">", m.index - start) + 1 || undefined))) found.push(`${file}: ${tag.slice(0, 120)}`);
      }
    assert.deepEqual(found, []);
  });
  it("Yazdır / dışa aktar / PDF düğmeleri elle yazılmıyor (HOF.outputButton)", () => {
    const found = [];
    // hof-auth.js: kurtarma anahtarı kâğıdının "Yazdır"ı (giriş ekranı; dışa aktarım değil).
    for (const [file, src] of sources.filter(([file]) => file !== "client/assets/hof-auth.js")) for (const m of src.matchAll(/<button\b[^<>]*\bdata-(?:print|pdf|export="(?:pdf|xlsx)")[^<>]*>/g)) found.push(`${file}: ${m[0].slice(0, 120)}`);
    assert.deepEqual(found, []);
  });
  it("ortak yardımcı: tür sınıfı, simge, erişilebilir ad ve ipucu", () => {
    const core = sources.find(([file]) => file === "client/assets/hof-core.js")[1];
    assert.match(core, /HOF\.outputButton = /);
    assert.match(core, /class="hof-rep-out is-\$\{kind\}"/);
    assert.match(core, /aria-label="\$\{HOF\.esc\(aria\)\}" title="\$\{HOF\.esc\(title\)\}"/);
    const css = readFileSync(new URL("client/assets/hof-ui.css", ROOT), "utf8");
    for (const kind of ["is-pdf", "is-xlsx", "is-print"]) assert.match(css, new RegExp(`\\.hof-rep-out\\.${kind} \\{`));
  });
});
