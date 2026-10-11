// 2.1.0 — Aşama 2, Dilim 1: banka kodunda kayan nokta yasağı (docs/BANKA-MODULU-PLAN.md §5.1 madde 4, K1).
// Yeni banka tablolarında tutar INTEGER kuruştur; banka kodu REAL tutar kolonunu (amount, unit_price, total, paid…) SQL'de
// SUM/TOTAL/AVG ile toplamaz — toplam ya INTEGER kolonla (`*_minor`) ya da `CAST(ROUND(x * 100) AS INTEGER)` ile kuruşa
// çevrilerek yapılır. Metinden sayı `parseFloat` / `parseAmount` ile okunmaz; banka uçlarında `parseMinor` kullanılır.
// Kapsam: server/lib/minor.mjs, server/lib/business-days.mjs, server/lib/calendars/**, server/lib/bank/**, server/lib/fx/**,
// server/routes/bank*.mjs (sonraki dilimlerde eklenen dosyalar kendiliğinden girer).
//
// NASIL BOZARIM: yeni bir banka dosyasında `SUM(amount)`, `TOTAL(x)`, `AVG(l.amount)`, `SUM(p.amount * 100)` (ROUND'suz),
// `parseFloat(...)`, `Number.parseFloat(...)`, `parseAmount(...)` → bu test kırılır. Tarayıcının kendisi de sınanır (yakalaması
// gereken ve geçirmesi gereken örnekler).
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = ["server/lib/minor.mjs", "server/lib/business-days.mjs", "server/lib/calendars/tr.mjs"];
const TREES = ["server/lib/bank", "server/lib/calendars", "server/lib/fx"];
const REAL_COLUMNS = /\b(amount|unit_price|price|total|paid|balance|rate|qty)\b/i;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.(mjs|js)$/.test(entry.name) ? [path.join(dir, entry.name)] : []));
}
export function bankFiles() {
  const routes = readdirSync(path.join(ROOT, "server/routes")).filter(name => /^bank.*\.mjs$/.test(name)).map(name => path.join(ROOT, "server/routes", name));
  return [...new Set([...REQUIRED.map(file => path.join(ROOT, file)), ...TREES.flatMap(dir => walk(path.join(ROOT, dir))), ...routes])];
}

// Toplama işlevinin parantez içi (iç içe parantezler dahil).
function argumentAt(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}
export function floatLeaks(source) {
  const out = [];
  const code = source
    .split("\n")
    .map(line => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
  const lineOf = index => code.slice(0, index).split("\n").length;
  for (const match of code.matchAll(/\b(SUM|TOTAL|AVG)\s*\(/gi)) {
    const fn = match[1].toUpperCase();
    const arg = argumentAt(code, match.index + match[0].length - 1).trim();
    if (fn === "TOTAL") out.push({ line: lineOf(match.index), rule: "TOTAL() kayan nokta döndürür", text: `TOTAL(${arg})` });
    else if (/\w+_minor\b/.test(arg) && !REAL_COLUMNS.test(arg.replace(/\w+_minor\b/g, ""))) continue;
    else if (/^CAST\s*\(\s*ROUND\s*\(/i.test(arg)) continue;
    else if (REAL_COLUMNS.test(arg)) out.push({ line: lineOf(match.index), rule: `${fn}() REAL tutar kolonunu topluyor`, text: `${fn}(${arg})` });
  }
  for (const match of code.matchAll(/\b(?:Number\.)?parseFloat\s*\(|\bparseAmount\s*\(/g)) out.push({ line: lineOf(match.index), rule: "metinden kayan noktalı sayı (parseMinor kullanın)", text: match[0] });
  return out;
}

describe("Statik tarama: banka kodunda REAL toplam ve parseFloat yasak", () => {
  it("tarayıcı kendini sınar: yakalaması gerekenler", () => {
    const bad = [
      "SELECT SUM(amount) FROM payments",
      "SELECT COALESCE(SUM(p.amount), 0) AS s FROM payments p",
      "SELECT TOTAL(amount_minor) FROM bank_lines",
      "SELECT AVG(l.unit_price) FROM invoice_lines l",
      "SELECT SUM(p.amount * 100) FROM payments p",
      "SELECT SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END) FROM cash_entries",
      "const x = parseFloat(body.amount);",
      "const x = Number.parseFloat(text);",
      "const x = parseAmount(body.amount);",
    ];
    for (const sample of bad) assert.equal(floatLeaks(sample).length, 1, sample);
  });
  it("tarayıcı kendini sınar: geçirmesi gerekenler", () => {
    const good = [
      "SELECT SUM(amount_minor) FROM bank_lines",
      "SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0) FROM bank_lines l",
      "SELECT SUM(CAST(ROUND(p.amount * 100) AS INTEGER)) FROM payments p",
      "SELECT SUM(CASE WHEN kind = 'in' THEN cents ELSE -cents END) FROM t",
      "// SUM(amount) yorumda",
      "const total = parseMinor(body.amount);",
      "SELECT COUNT(*) FROM bank_accounts",
    ];
    for (const sample of good) assert.deepEqual(floatLeaks(sample), [], sample);
  });
  it("banka kodu dosyaları var ve hiçbirinde REAL toplam ya da parseFloat yok", () => {
    for (const file of REQUIRED) assert.ok(existsSync(path.join(ROOT, file)), `${file} yok`);
    const leaks = [];
    for (const file of bankFiles()) for (const leak of floatLeaks(readFileSync(file, "utf8"))) leaks.push(`${path.relative(ROOT, file)}:${leak.line} ${leak.rule}: ${leak.text.slice(0, 120)}`);
    assert.deepEqual(leaks, [], leaks.join("\n"));
  });
});
