// İz 4.2 mutasyon koşucusu: ayrı kopyada (senet-mutant-iz42) her mutasyonu TEK BAŞINA uygular, testleri koşar (kanit.mjs kos), dosyayı geri yükler.
// Kullanım: node mutasyon.mjs <worktree> <mutant-kopya> [mutasyon-adı…]
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [worktree, mutant, ...only] = process.argv.slice(2);
const MUTATIONS = [
  {
    name: "M1-senet-101e",
    why: "alınan senedin satırı 101'e yazılır (evrak türü yok sayılır)",
    file: "server/lib/general-ledger.mjs",
    find: "    const gl = documentGl(instrument);\n    return { account: gl.received, sub: atBank ? gl.bank : gl.portfolio };",
    replace: "    const gl = documentGl(\"cheque\");\n    return { account: gl.received, sub: atBank ? gl.bank : gl.portfolio };",
  },
  {
    name: "M2-12102-12101e",
    why: "senedin Tahsile Ver maddesi 121.02 yerine 121.01'e yazılır",
    file: "server/lib/general-ledger.mjs",
    find: "    const atBank = received(row.instrument, true);",
    replace: "    const atBank = received(row.instrument, row.instrument !== \"note\");",
  },
  {
    name: "M3-verilen-senet-103e",
    why: "verilen senedin satırı 321 yerine 103'e yazılır",
    file: "server/lib/general-ledger.mjs",
    find: "  const given = instrument => documentGl(instrument).given;",
    replace: "  const given = instrument => documentGl(\"cheque\").given;",
  },
  {
    name: "M4-beklenen-321-103e",
    why: "alt defterin beklenen 321'i 103'e katılır (kapının kâhini bozulur)",
    file: "server/routes/ledger.mjs",
    find: "      out[103] = -roundMoney(sums.c103);",
    replace: "      out[103] = -roundMoney(sums.c103 + sums.c321);",
  },
  {
    name: "M5-alt-mizan-senet-101",
    why: "Alt Hesap Mizanı SQL'i senedi 101.0x'e yazar",
    file: "server/lib/bank/collections.mjs",
    find: "  const bank = (flag, instrument) => `CASE WHEN ${flag} THEN ${documentGlSql(instrument, \"bank\")} ELSE ${documentGlSql(instrument, \"portfolio\")} END`;",
    replace: "  const bank = (flag, instrument) => `CASE WHEN ${flag} THEN ${documentGlSql(\"''\", \"bank\")} ELSE ${documentGlSql(\"''\", \"portfolio\")} END`;",
  },
  {
    name: "M6-kapi-toplam",
    why: "kapı cheque:collections yalnız 101.02 + 121.02 TOPLAMINI karşılaştırır (alt hesap ayrımı yok) — M2 ile birlikte",
    file: "server/lib/integrity.mjs",
    find: "          if (got !== want) {",
    replace: "          if (false) {",
    also: "M2-12102-12101e",
  },
  {
    name: "M7-kilit-izi-tur-yok",
    why: "kilit izinde evrak türü girdisi yok",
    file: "server/lib/integrity.mjs",
    find: "  cheques_instrument_lock: { requires: [\"cheques\"], since: \"2.2.0\", sql: \"SELECT id, instrument FROM cheques WHERE instrument <> 'cheque' AND issue_date <= ?1 ORDER BY id\" },",
    replace: "",
  },
  {
    name: "M9-tutarli-yanlis-103",
    why: "verilen senet 103'e yazılır VE beklenen de 103'e katılır (kapı tutarlı yanlışı kabul eder; yalnız kâhin yakalar)",
    file: "server/lib/general-ledger.mjs",
    find: "  const given = instrument => documentGl(instrument).given;",
    replace: "  const given = instrument => documentGl(\"cheque\").given;",
    also: "M4-beklenen-321-103e",
  },
  {
    name: "M8-yasak-liste",
    why: "Banka Fişi yasak listesinde 121 / 321 yok",
    file: "server/lib/bank/voucher.mjs",
    find: "\"120\", \"121\", \"127\", \"191\", \"320\", \"321\", \"336\"",
    replace: "\"120\", \"127\", \"191\", \"320\", \"336\"",
  },
];
const byName = new Map(MUTATIONS.map(item => [item.name, item]));
const apply = item => {
  const target = path.join(mutant, item.file);
  const text = readFileSync(target, "utf8");
  const count = text.split(item.find).length - 1;
  if (count !== 1) throw new Error(`${item.name}: aranan metin ${count} kez bulundu (1 olmalı)`);
  writeFileSync(target, text.replace(item.find, item.replace));
};
const restore = item => copyFileSync(path.join(worktree, item.file), path.join(mutant, item.file));
for (const item of MUTATIONS.filter(entry => !only.length || only.includes(entry.name))) {
  const parts = [item, ...(item.also ? [byName.get(item.also)] : [])];
  try {
    for (const part of parts) apply(part);
    console.log(`\n=== ${item.name}: ${item.why}`);
    try {
      // MOTOR=1: mutabakat motoru (kısa, POS ekseni kapalı) — modelin evrak türü denetimi; aksi hâlde senet testi.
      const command = process.env.MOTOR ? [process.execPath, "--disable-warning=ExperimentalWarning", "test/mutabakat/kos.mjs", "--islem", "300", "--tohumlar", "1", "--pos-yok"] : [process.execPath, "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", "test/banka-220-senet-121.test.mjs"];
      const out = execFileSync(process.execPath, [path.join(worktree, "tools/kanit.mjs"), "kos", `iz42-mutasyon-${item.name}${process.env.MOTOR ? "-motor" : ""}`, "--", ...command], { cwd: mutant, env: { ...process.env, KANIT_DIR: path.join(worktree, "docs/kanit") }, encoding: "utf8", maxBuffer: 1 << 28 });
      console.log(out.split("\n").filter(line => line.startsWith("[kanit]")).join("\n"));
      console.log(`!!! ${item.name}: testler YAKALAMADI (çıkış 0)`);
    } catch (error) {
      console.log(String(error.stdout || "").split("\n").filter(line => line.startsWith("[kanit]") || line.startsWith("  ✖")).slice(0, 6).map(line => line.slice(0, 260)).join("\n"));
      console.log(`--- ${item.name}: yakalandı (çıkış ${error.status})`);
    }
  } finally {
    for (const part of parts) restore(part);
  }
}
