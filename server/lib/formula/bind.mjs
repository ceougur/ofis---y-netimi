// Formülleri içeri alınan kayıtlara bağlama (v2.0.1).
// Excel/Sheets'te formül hücre adresleriyle yazılır ("=B2-SUM(C2:G2)"). Program ise kayıtları kolon adlarıyla
// saklar ("Tutar", "Taksit 1"…). İçeri alma anında her başvuru çözülür:
//   - aynı satırdaki hücre      → {t:"f", f:"Tutar"}                 (bu kaydın alanı)
//   - başka bir kayıttaki hücre → {t:"x", k:"<kaynak>|Sayfa!7", f:…} (o kaydın alanı; kayda __hofAt yazılır)
//   - kayıt olmayan hücre       → {t:"l", v:"…"}                     (başlık, parametre hücresi: o anki değeri)
// Sonuç kayda iç alan olarak yazılır: __hofF = JSON {alan: {b: bağlı ağaç, d: gösterim}} ve gerekiyorsa __hofAt.
// Böylece kullanıcı programda bir değeri değiştirdiğinde formül yeniden hesaplanabilir (compute.mjs).
import { createHash } from "node:crypto";
import { FormulaError, displayFormula, parse } from "./parse.mjs";

export const MAX_RANGE_CELLS = 5_000;
export const MAX_FORMULA_CHARS = 19_000;
const MAX_FORMULAS = 200_000;

export const sourceTagOf = value => createHash("sha1").update(String(value || "")).digest("hex").slice(0, 8);

class BindError extends Error {}

/**
 * @param {Array<{name:string, matrix:string[][], start?:{r:number,c:number}, formulas?:Array<[number,number,string]>, layout:Array<{record:object,line:number,names:string[]}>}>} sheets
 * @param {{ sourceTag: string }} options
 * @returns {{ formulas: number, bound: number, unsupported: number }}
 */
export function attachFormulas(sheets, { sourceTag = "" } = {}) {
  const stats = { formulas: 0, bound: 0, unsupported: 0 };
  const total = sheets.reduce((sum, sheet) => sum + (sheet.formulas?.length || 0), 0);
  if (!total) return stats;
  const bySheet = new Map();
  for (const sheet of sheets) {
    const rows = new Map();
    for (const item of sheet.layout || []) rows.set(item.line, item);
    bySheet.set(String(sheet.name).toLocaleLowerCase("tr-TR"), { sheet, rows, start: sheet.start || { r: 0, c: 0 } });
  }
  const keyOf = (sheet, absoluteRow) => `${sourceTag}|${sheet.name}!${absoluteRow + 1}`;
  const needsKey = new Map(); // record → key
  const pending = new Map(); // record → {field: {b, d} | {u, d}}

  for (const sheet of sheets) {
    if (!sheet.formulas?.length) continue;
    const own = bySheet.get(String(sheet.name).toLocaleLowerCase("tr-TR"));
    const start = own.start;
    for (const [absoluteRow, absoluteCol, text] of sheet.formulas.slice(0, MAX_FORMULAS)) {
      const info = own.rows.get(absoluteRow - start.r);
      const field = info?.names[absoluteCol - start.c];
      if (!info || !field) continue; // kayıt dışı hücredeki formül (başlık, toplam satırı değilse) bağlanmaz
      stats.formulas += 1;
      const nameOf = (sheetName, r, c) => ((sheetName === null || sheetName === sheet.name) && r === absoluteRow ? info.names[c - start.c] || null : null);
      const display = displayFormula(text, nameOf);
      let entry;
      try {
        const tree = parse(text);
        const bound = bindNode(tree, { sheet, absoluteRow, bySheet, keyOf, needsKey });
        entry = { b: bound, d: display };
        stats.bound += 1;
      } catch (error) {
        if (!(error instanceof FormulaError || error instanceof BindError)) throw error;
        entry = { u: 1, d: display };
        stats.unsupported += 1;
      }
      if (!pending.has(info.record)) pending.set(info.record, {});
      pending.get(info.record)[field] = entry;
    }
  }

  for (const [record, map] of pending) {
    let json = JSON.stringify(map);
    if (json.length > MAX_FORMULA_CHARS) {
      // Çok büyük aralıklı formüller (ör. binlerce satırı toplayan hücre) sığmıyorsa hesaplanmaz, gösterimi kalır.
      for (const field of Object.keys(map).sort((a, b) => JSON.stringify(map[b]).length - JSON.stringify(map[a]).length)) {
        map[field] = { u: 1, d: String(map[field].d).slice(0, 500) };
        json = JSON.stringify(map);
        if (json.length <= MAX_FORMULA_CHARS) break;
      }
    }
    record.__hofF = json;
  }
  for (const [record, key] of needsKey) record.__hofAt = key;
  return stats;
}

function bindNode(node, context) {
  switch (node.t) {
    case "ref":
      return resolveCell(node.s, node.r, node.c, context);
    case "rng":
      return resolveRange(node, context);
    case "fn":
      return { t: "fn", n: node.n, a: node.a.map(arg => bindNode(arg, context)) };
    case "bin":
      return { t: "bin", o: node.o, l: bindNode(node.l, context), r: bindNode(node.r, context) };
    case "neg":
    case "pct":
      return { t: node.t, e: bindNode(node.e, context) };
    case "arr":
      return { t: "arr", rows: node.rows.map(row => row.map(item => bindNode(item, context))) };
    default:
      return node;
  }
}

function targetSheet(name, context) {
  if (name === null || name === undefined) return context.bySheet.get(String(context.sheet.name).toLocaleLowerCase("tr-TR"));
  const found = context.bySheet.get(String(name).toLocaleLowerCase("tr-TR"));
  if (!found) throw new BindError(`Sayfa bulunamadı: ${name}`);
  return found;
}

function resolveCell(sheetName, absoluteRow, absoluteCol, context) {
  const target = targetSheet(sheetName, context);
  const line = absoluteRow - target.start.r;
  const column = absoluteCol - target.start.c;
  const info = target.rows.get(line);
  const field = info?.names[column];
  if (info && field) {
    if (target.sheet === context.sheet && absoluteRow === context.absoluteRow) return { t: "f", f: field };
    const key = context.keyOf(target.sheet, absoluteRow);
    context.needsKey.set(info.record, key);
    return { t: "x", k: key, f: field };
  }
  const text = line >= 0 && column >= 0 ? target.sheet.matrix[line]?.[column] ?? "" : "";
  return { t: "l", v: String(text) };
}

function resolveRange(node, context) {
  const target = targetSheet(node.s, context);
  const lastRow = target.start.r + target.sheet.matrix.length - 1;
  let width = 0;
  for (const line of target.sheet.matrix) width = Math.max(width, line.length);
  const lastCol = target.start.c + Math.max(0, width - 1);
  const r1 = node.r1 === null ? target.start.r : node.r1;
  const r2 = node.r2 === null ? lastRow : Math.min(node.r2, Math.max(lastRow, node.r1 ?? 0));
  const c1 = node.c1 === null ? target.start.c : node.c1;
  const c2 = node.c2 === null ? lastCol : node.c2;
  const rows = Math.max(0, r2 - r1 + 1);
  const cols = Math.max(0, c2 - c1 + 1);
  if (rows * cols > MAX_RANGE_CELLS) throw new BindError("Aralık çok büyük");
  const out = [];
  for (let r = r1; r <= r2; r += 1) {
    const row = [];
    for (let c = c1; c <= c2; c += 1) row.push(resolveCell(node.s, r, c, context));
    out.push(row);
  }
  return { t: "a", rows: out.length ? out : [[{ t: "l", v: "" }]] };
}
