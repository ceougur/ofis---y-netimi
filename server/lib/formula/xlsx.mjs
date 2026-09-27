// .xlsx dosyasındaki formülleri okur (v2.0.1; Google Sheets'in "xlsx olarak indir" çıktısı için).
// Değerler Sheets'ten zaten göründüğü gibi (CSV) alınır; buradan yalnızca formüller ve karşılaştırma için hücrelerin
// son hesaplanmış sayısal değerleri çıkarılır. Paylaşılan formüller (Excel'in "aşağı kopyala" kaydı) açılır.
import { readZip } from "../zip.mjs";
import { colToIndex, shiftFormula } from "./parse.mjs";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = text => String(text).replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, name) => {
  if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()];
});
const attrs = text => {
  const out = {};
  for (const match of String(text).matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[match[1]] = unescapeXml(match[2]);
  return out;
};
const cellAddress = ref => {
  const match = /^([A-Z]{1,3})(\d+)$/.exec(ref || "");
  return match ? { r: Number(match[2]) - 1, c: colToIndex(match[1]) } : null;
};

/**
 * @param {Buffer} buffer .xlsx içeriği
 * @returns {Map<string, { formulas: Array<[number, number, string]>, values: Map<string, number> }>} sayfa adı → formüller
 */
export function readXlsxFormulas(buffer, { maxFormulas = 200_000 } = {}) {
  const files = new Map(readZip(buffer, { maxTotalBytes: 300 * 1024 * 1024 }).filter(entry => !entry.directory).map(entry => [entry.name, entry.data]));
  const text = name => files.get(name)?.toString("utf8") || "";
  const workbook = text("xl/workbook.xml");
  const rels = new Map();
  for (const match of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const item = attrs(match[1]);
    if (item.Id && item.Target) rels.set(item.Id, item.Target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const result = new Map();
  let total = 0;
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const item = attrs(match[1]);
    const target = rels.get(item["r:id"]);
    if (!item.name || !target) continue;
    const xml = text(`xl/${target}`);
    const formulas = [];
    const values = new Map();
    const shared = new Map();
    for (const cell of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = cell[2];
      if (!body || !body.includes("<f")) continue;
      const cellAttrs = attrs(cell[1]);
      const at = cellAddress(cellAttrs.r);
      if (!at) continue;
      const formula = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(body);
      if (!formula) continue;
      const formulaAttrs = attrs(formula[1]);
      let source = formula[2] !== undefined ? unescapeXml(formula[2]) : "";
      if (formulaAttrs.t === "shared" && formulaAttrs.si !== undefined) {
        if (source) shared.set(formulaAttrs.si, { text: source, r: at.r, c: at.c });
        else {
          const master = shared.get(formulaAttrs.si);
          if (!master) continue;
          try {
            source = shiftFormula(master.text, at.r - master.r, at.c - master.c);
          } catch {
            continue;
          }
        }
      }
      if (!source) continue;
      formulas.push([at.r, at.c, source]);
      const cached = /<v>([^<]*)<\/v>/.exec(body);
      if (cached && cellAttrs.t !== "s" && cellAttrs.t !== "str" && cellAttrs.t !== "b" && cellAttrs.t !== "e") {
        const number = Number(cached[1]);
        if (Number.isFinite(number)) values.set(`${at.r}:${at.c}`, number);
      }
      total += 1;
      if (total >= maxFormulas) break;
    }
    result.set(item.name, { formulas, values });
    if (total >= maxFormulas) break;
  }
  return result;
}
