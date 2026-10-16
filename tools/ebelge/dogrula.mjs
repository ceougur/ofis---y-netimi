// e-Belge uygunluk denetimi (programdan BAĞIMSIZ kâhin): bir UBL-TR faturasını
//   1) OASIS UBL 2.1 XSD'sine (tools/ebelge/sema/ubl-2.1, xmllint-wasm = libxml2) ve
//   2) GİB'in resmî UBL-TR şematronuna (tools/ebelge/sema/gib, e-FaturaPaketi; SchXslt 1.9.5 + SaxonJS)
// karşı denetler. Kural dosyalarına dokunulmaz; yalnız iki mekanik uyarlama yapılır (KAYNAK.md → "Uyarlamalar"):
//   - kök öğeye queryBinding="xslt2" (dosya sorgu dilini yazmıyor, kurallar XPath 2.0 matches() kullanıyor),
//   - UBL-TR_Codelist.xml#codes deseninin <sch:let> değişkenleri şema düzeyine taşınır (GİB'in doğrulayıcısında bunlar
//     bütün desenlerde görünür; SchXslt desen değişkenini desene kapatır).
// Derlenen şematron (≈18 sn/tür) işletim sisteminin geçici klasöründe girdilerin sha256'sıyla önbelleğe alınır.
// Yalnız test ve geliştirme aracıdır; programla dağıtılmaz (tools/lib/app-files.mjs APP_ITEMS'ta yok).
//
// Kullanım: node tools/ebelge/dogrula.mjs [--earsiv] fatura.xml [...]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
export const SEMA = join(HERE, "sema");
const GIB = join(SEMA, "gib");
const UBL = join(SEMA, "ubl-2.1");
const SCHXSLT = join(SEMA, "schxslt-1.9.5", "2.0", "pipeline-for-svrl.xsl");
const TYPES = { efatura: "efatura", earsiv: "earchive" };

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
const sha = (...parts) => {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
};

/** GİB ana şematronuna iki mekanik uyarlamayı uygular (kurallar aynen kalır). */
export function adaptMainSchematron(main, codelist, type) {
  const lets = codelist.match(/<sch:let\b[^>]*\/>/g) || [];
  if (lets.length < 10) throw new Error(`Kod listesinde <sch:let> bulunamadı (${lets.length}); GİB dosya düzeni değişmiş olabilir.`);
  const include = /<sch:include\s+href="UBL-TR_Codelist\.xml#codes"\s*\/>/;
  if (!include.test(main)) throw new Error("Ana şematronda kod listesi içerimi bulunamadı; GİB dosya düzeni değişmiş olabilir.");
  const typeLet = /<let\s+name="type"\s+value="[^"]*"\s*\/>/;
  if (!typeLet.test(main)) throw new Error("Ana şematronda 'type' parametresi bulunamadı.");
  if (!/<sch:schema\s/.test(main)) throw new Error("Ana şematronun kök öğesi bulunamadı.");
  return main
    .replace(/<sch:schema\s/, '<sch:schema queryBinding="xslt2" ')
    .replace(include, lets.join("\n"))
    // GİB'in özgün değeri value="efatura" bir XPath yoludur (boş döner → e-Fatura kipi); e-Arşiv kipi için metin değişmezi gerekir.
    .replace(typeLet, `<let name="type" value="'${type}'"/>`);
}

function xslt3(args) {
  execFileSync(process.execPath, [require.resolve("xslt3/xslt3.js"), ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** Derlenmiş şematronun (SaxonJS SEF) yolunu verir; yoksa derler. type: "efatura" | "earsiv". */
export function compiledSchematron(type = "efatura") {
  const gibType = TYPES[type];
  if (!gibType) throw new Error(`Bilinmeyen tür: ${type}`);
  const main = readFileSync(join(GIB, "UBL-TR_Main_Schematron.xml"), "utf8");
  const common = readFileSync(join(GIB, "UBL-TR_Common_Schematron.xml"), "utf8");
  const codelist = readFileSync(join(GIB, "UBL-TR_Codelist.xml"), "utf8");
  const pipeline = walk(dirname(SCHXSLT)).sort().map(file => readFileSync(file));
  const saxon = require("saxon-js/package.json").version;
  const key = sha(main, common, codelist, ...pipeline, saxon, gibType, "v2").slice(0, 20);
  const dir = join(tmpdir(), `destekofis-ebelge-${key}`);
  const sef = join(dir, `gib-${gibType}.sef.json`);
  if (existsSync(sef)) return sef;
  const work = `${dir}.${process.pid}.${Date.now()}`;
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "UBL-TR_Common_Schematron.xml"), common);
  writeFileSync(join(work, "main.sch.xml"), adaptMainSchematron(main, codelist, gibType));
  xslt3([`-xsl:${SCHXSLT}`, `-s:${join(work, "main.sch.xml")}`, `-o:${join(work, "gib.xsl")}`]);
  xslt3([`-xsl:${join(work, "gib.xsl")}`, `-export:${join(work, `gib-${gibType}.sef.json`)}`, "-nogo"]);
  mkdirSync(dir, { recursive: true });
  // Aynı anda derleyen başka süreç varsa son yazan kazanır; içerik aynıdır.
  renameSync(join(work, `gib-${gibType}.sef.json`), sef);
  return sef;
}

const sefCache = new Map();
/** GİB şematronu: [{ text, location, test }] — boş dizi = kurallara uygun. */
export function schematronErrors(xml, { type = "efatura" } = {}) {
  const SaxonJS = require("saxon-js");
  if (!sefCache.has(type)) sefCache.set(type, JSON.parse(readFileSync(compiledSchematron(type), "utf8")));
  const result = SaxonJS.transform({ stylesheetInternal: sefCache.get(type), sourceText: xml, destination: "serialized" }, "sync");
  const svrl = result.principalResult;
  const fired = (svrl.match(/<svrl:fired-rule\b/g) || []).length;
  if (fired === 0) throw new Error("Şematron hiçbir kuralı çalıştırmadı (belge kökü tanınmadı); sonuç kanıt sayılmaz.");
  const unescape = text => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return [...svrl.matchAll(/<svrl:failed-assert\b([^>]*)>([\s\S]*?)<\/svrl:failed-assert>/g)].map(match => ({
    text: unescape((match[2].match(/<svrl:text>([\s\S]*?)<\/svrl:text>/) || [, ""])[1].replace(/\s+/g, " ").trim()),
    location: unescape((match[1].match(/location="([^"]*)"/) || [, ""])[1]),
    test: unescape((match[1].match(/test="([^"]*)"/) || [, ""])[1]),
  }));
}

let xsdFiles;
/** OASIS UBL 2.1 XSD: [hata iletisi] — boş dizi = şemaya uygun. */
export async function xsdErrors(xml) {
  const { validateXML } = await import("xmllint-wasm");
  if (!xsdFiles) {
    const all = walk(UBL).filter(file => file.endsWith(".xsd"));
    const main = join(UBL, "maindoc", "UBL-Invoice-2.1.xsd");
    xsdFiles = {
      schema: [{ fileName: "UBL-Invoice-2.1.xsd", contents: readFileSync(main, "utf8") }],
      preload: all.filter(file => file !== main).map(file => ({ fileName: relative(join(UBL, "maindoc"), file).replaceAll("\\", "/"), contents: readFileSync(file, "utf8") })),
    };
  }
  const result = await validateXML({ xml: [{ fileName: "fatura.xml", contents: xml }], ...xsdFiles });
  return result.valid ? [] : result.errors.map(error => (error.rawMessage || error.message || String(error)).trim());
}

/** İkisi birden. */
export async function validateInvoice(xml, { type = "efatura" } = {}) {
  return { xsd: await xsdErrors(xml), schematron: schematronErrors(xml, { type }) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const type = args.includes("--earsiv") ? "earsiv" : "efatura";
  const files = args.filter(arg => !arg.startsWith("--"));
  if (!files.length) {
    console.error("Kullanım: node tools/ebelge/dogrula.mjs [--earsiv] fatura.xml [...]");
    process.exit(2);
  }
  let bad = 0;
  for (const file of files) {
    const { xsd, schematron } = await validateInvoice(readFileSync(file, "utf8"), { type });
    const ok = !xsd.length && !schematron.length;
    if (!ok) bad += 1;
    console.log(`${ok ? "UYGUN" : "UYGUN DEĞİL"}  ${file}  (XSD ${xsd.length} hata, GİB şematronu ${schematron.length} hata)`);
    for (const error of xsd) console.log(`   XSD: ${error}`);
    for (const error of schematron) console.log(`   GİB: ${error.text}  [${error.location}]`);
  }
  process.exit(bad ? 1 : 0);
}
