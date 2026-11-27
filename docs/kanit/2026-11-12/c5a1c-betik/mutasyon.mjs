// Ç5-A tur 1c: hız değişikliğinin eşdeğerlik testinin DİŞİ — her mutant kod kopyasında tek metin değişikliği, test koşulur (kırmızı beklenir), dosya geri konur.
// Kullanım: node mutasyon.mjs <kod kopyası (node_modules bağlı)> <test dosyası (kopyaya göre)> [TZ]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const [root, testFile] = process.argv.slice(2);
const MUTANTS = [
  { id: "M1", file: "server/routes/ledger.mjs", from: `e.opening_review IN ('candidate', 'confirmed')" : ""].filter(Boolean)`, to: `e.opening_review IN ('candidate')" : ""].filter(Boolean)`, what: "H1: işaret sorgusu onaylıyı (confirmed) almaz" },
  { id: "M2", file: "server/routes/ledger.mjs", from: "        if (flagged.size) {", to: "        if (flagged.size && !filter) {", what: "H1: süzgeçli yolda (kapı) satırlar işaretlenmez" },
  { id: "M3", file: "server/routes/ledger.mjs", from: "const scope = filter ? [...new Set([...out.plans.map(plan => plan.id), ...out.planEntries.map(entry => entry.planId)])] : null;", to: "const scope = filter ? [...new Set([...out.plans.map(plan => plan.id)])] : null;", what: "H2: süzgeçli yolda taksit satırının kartı kapsama alınmaz" },
  { id: "M4", file: "server/routes/ledger.mjs", from: "              plan.importedAt = detail.importedAt;", to: "", what: "H2: yükleme damgası karta yazılmaz (madde kartın tarihine düşer)" },
  { id: "M5", file: "server/routes/ledger.mjs", from: "              plan.openingPaid = detail.openingPaid;", to: "", what: "H2: P karta yazılmaz (tek madde T olur)" },
  { id: "M6", file: "server/lib/general-ledger.mjs", from: "    if (a.seq !== b.seq) return a.seq < b.seq ? -1 : 1;\n    return a.id < b.id", to: "    return a.id < b.id", what: "H3: yazım sırası anahtarı düşer" },
  { id: "M7", file: "server/lib/general-ledger.mjs", from: "cls: entryClass(entry), seq:", to: "cls: 0, seq:", what: "H3: sınıf anahtarı düşer" },
];
let red = 0;
for (const mutant of MUTANTS) {
  const file = path.join(root, mutant.file);
  const original = readFileSync(file, "utf8");
  if (!original.includes(mutant.from)) {
    console.log(`${mutant.id} UYGULANAMADI (metin yok) · ${mutant.what}`);
    continue;
  }
  writeFileSync(file, original.replace(mutant.from, mutant.to));
  try {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", testFile], { cwd: root, encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, maxBuffer: 64 << 20 });
    const out = `${run.stdout}${run.stderr}`;
    const fail = /# fail (\d+)/.exec(out)?.[1] ?? "?";
    const pass = /# pass (\d+)/.exec(out)?.[1] ?? "?";
    const reasons = [...out.matchAll(/^\s+error: \|?-?\s*'?([^\n]*)/gm)].map(m => m[1]).filter(text => text && !/subtests? failed/.test(text));
    const reason = (reasons.length ? reasons.join(" ‖ ") : out.split(/\r?\n/).filter(line => /AssertionError|Error:|beklenen/.test(line)).join(" ‖ ")).slice(0, 400);
    const killed = run.status !== 0;
    if (killed) red += 1;
    console.log(`${mutant.id} ${killed ? "KIRMIZI (yakalandı)" : "YEŞİL (YAKALANMADI)"} · pass ${pass} fail ${fail} · ${mutant.what}${reason ? ` · neden: ${reason}` : ""}`);
  } finally {
    writeFileSync(file, original);
  }
}
console.log(`[mutasyon] ${red} / ${MUTANTS.length} kırmızı`);
