#!/usr/bin/env node
// 2.5.0 Ç3 — 2.4.9 türetme kuralının dondurulmuş kopyası (docs/erp/C3-DONDURMA-TASARIM.md §5; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §4 "GÖÇ"). v2.4.9 etiketinin
// (ccf0b0ca) yevmiye türetme kapanışını server/lib/ledger-rule-249/ altına yazar ya da (--denetle) oradaki kopyanın etiketle birebir aynı olduğunu doğrular:
//   - general-ledger.mjs, cheque-gl.mjs, doubtful-gl.mjs, money.mjs: AYNEN (bayt bayt; içe aktarmaları zaten "./…" — kopyanın kendi klasörü);
//   - ledger-rows.mjs: routes/ledger.mjs'in FREE_SEQ'i ve kayıt işlevinin içindeki has / refOf / refs / rows / build satırları AYNEN (16–201), createRows249(store) sarmalında;
//   - doubtful-rows.mjs: bank/doubtful.mjs'in hasTable / hasDoubtful, RECORD_SQL / PROVISION_SQL / withControl ve doubtfulRows satırları AYNEN.
// Kaynak: --kaynak <v2.4.9 kod kökü> (ör. `git archive v2.4.9 | tar -x -C <klasör>`; ders 23) ya da yoksa `git show v2.4.9:<yol>`.
//   node tools/kural-kopyasi-249.mjs --kaynak <kök>            → yazar
//   node tools/kural-kopyasi-249.mjs --kaynak <kök> --denetle  → yazmaz; fark varsa çıkış 1
// Kopya ürün kodudur ve DEĞİŞTİRİLMEZ (test/donmus-defter-250.test.mjs sha256'larını sabitler); yalnız göçte ve eski sürümün ilerlettiği kilitte kullanılır.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "server/lib/ledger-rule-249");
const argv = process.argv.slice(2);
const opt = name => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : null);
const source = opt("kaynak");
const checkOnly = argv.includes("--denetle");
const read = file => (source ? readFileSync(path.join(source, file), "utf8") : execFileSync("git", ["show", `v2.4.9:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }));
const lines = (text, from, to) => text.split("\n").slice(from - 1, to).join("\n");

const ledgerRoute = read("server/routes/ledger.mjs");
const doubtful = read("server/lib/bank/doubtful.mjs");
// Satır numaraları v2.4.9'a göre; çıkarılan parçanın ilk / son satırı denetlenir (yanlış etiket ya da kaynak → dur).
const expect = (text, at, starts) => {
  const line = text.split("\n")[at - 1] || "";
  if (!line.startsWith(starts)) throw new Error(`beklenen satır yok (${at}: "${starts}"); kaynak v2.4.9 değil`);
};
expect(ledgerRoute, 13, "const FREE_SEQ = 1e15;");
expect(ledgerRoute, 16, "  const has = table =>");
expect(ledgerRoute, 192, "  function build(filter = null) {");
expect(ledgerRoute, 201, "  }");
expect(doubtful, 25, "const hasTable =");
expect(doubtful, 30, "const RECORD_SQL =");
expect(doubtful, 39, "const withControl =");
expect(doubtful, 45, "export function doubtfulRows(");
expect(doubtful, 68, "}");

const HEADER = "// DONDURULMUŞ KOPYA — v2.4.9 (ccf0b0ca) türetme kuralı; tools/kural-kopyasi-249.mjs üretir. DEĞİŞTİRMEYİN (docs/erp/C3-DONDURMA-TASARIM.md §5).\n";
const files = {
  "general-ledger.mjs": read("server/lib/general-ledger.mjs"),
  "cheque-gl.mjs": read("server/lib/cheque-gl.mjs"),
  "doubtful-gl.mjs": read("server/lib/doubtful-gl.mjs"),
  "money.mjs": read("server/lib/money.mjs"),
  "ledger-rows.mjs": [
    HEADER.trimEnd(),
    "// Kaynak: v2.4.9 server/routes/ledger.mjs satır 12–13 (FREE_SEQ) ve 16–201 (registerLedgerRoutes içindeki has / refOf / refs / rows / build) — AYNEN.",
    'import { journal } from "./general-ledger.mjs";',
    'import { doubtfulRows } from "./doubtful-rows.mjs";',
    "",
    lines(ledgerRoute, 12, 13),
    "",
    "export function createRows249(store) {",
    lines(ledgerRoute, 16, 201),
    "  return { refs, rows, build };",
    "}",
    "",
  ].join("\n"),
  "doubtful-rows.mjs": [
    HEADER.trimEnd(),
    "// Kaynak: v2.4.9 server/lib/bank/doubtful.mjs satır 25–26, 30–39, 41–68 (hasTable / hasDoubtful, kayıt ve karşılık sorguları, doubtfulRows) — AYNEN.",
    'import { DOUBTFUL_REASONS, doubtfulControl } from "./doubtful-gl.mjs";',
    "",
    lines(doubtful, 25, 26),
    lines(doubtful, 30, 39),
    "",
    lines(doubtful, 41, 68),
    "",
  ].join("\n"),
};

let differs = 0;
if (!checkOnly) mkdirSync(OUT, { recursive: true });
for (const [name, text] of Object.entries(files)) {
  const target = path.join(OUT, name);
  if (checkOnly) {
    const same = existsSync(target) && readFileSync(target, "utf8") === text;
    if (!same) differs += 1;
    console.log(`${same ? "aynı" : "FARKLI"} ${name}`);
  } else {
    writeFileSync(target, text);
    console.log(`yazıldı ${name} (${text.length} karakter)`);
  }
}
if (checkOnly && differs) {
  console.error(`${differs} dosya v2.4.9'dan farklı`);
  process.exit(1);
}
