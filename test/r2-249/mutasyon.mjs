// 2.4.9 R2 (ders 7, 38): test/iade-kesinti-tarama-249.test.mjs'in dişi. Yeni kodun AYRI kopyasında (git archive — ders 23) her mutasyon tek başına
// routes/plans.mjs'e uygulanır, test koşulur, dosya özgün hâline döner. Beklenen: her mutasyonda test KIRMIZI ve kırmızı hücre(ler) beklenen nedenle (ileti yazılır).
// Kullanım: node test/r2-249/mutasyon.mjs <yeni kod kopyası>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [KOPYA] = process.argv.slice(2);
if (!KOPYA) throw new Error("kullanım: mutasyon.mjs <kopya>");
const PL = path.join(KOPYA, "server/routes/plans.mjs");
const ASIL = readFileSync(PL, "utf8");
const MUTASYONLAR = [
  ["M1 önbellek okunmaz (her çağrıda tam tarama — eski davranış)", "    if (cutsCache.cuts && cutsCache.stamp === stamp) return cutsCache.cuts;\n", "", ["YAPI"]],
  ["M2 işlem içinde de saklanır / okunur", "    if (store.inTransaction || typeof store.changeCounters !== \"function\") return scanReturnCuts();", "    if (typeof store.changeCounters !== \"function\") return scanReturnCuts();", ["BAYATLIK — doğrudan yazım"]],
  ["M3 damgada data_version yok (başka bağlantının yazması görülmez)", "    const stamp = `${counters.total}|${counters.version}`;", "    const stamp = `${counters.total}`;", ["BAYATLIK — doğrudan yazım"]],
  ["M4 damgada total_changes yok (bu bağlantının yazması görülmez)", "    const stamp = `${counters.total}|${counters.version}`;", "    const stamp = `${counters.version}`;", ["BAYATLIK — API", "BAYATLIK — doğrudan yazım"]],
  ["M5 kesinti yanlış karta (belgenin ilk kartına)", "      for (const [planId, cut] of Object.entries(cuts)) out.set(planId, roundMoney((out.get(planId) || 0) + (Number(cut) || 0)));", "      for (const [planId, cut] of Object.entries(cuts)) { const ilk = Object.keys(cuts)[0] || planId; out.set(ilk, roundMoney((out.get(ilk) || 0) + (Number(cut) || 0))); }", ["EŞDEĞERLİK"]],
  ["M6 kapsam dışı iade sayılır (iptal / taslak — status süzgeci yok)", "WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'", "WHERE kind = 'sale_return' AND payment_json LIKE '%coverCuts%'", ["EŞDEĞERLİK"]],
  ["M7 damga hiç değişmez (bayat değer)", "    const stamp = `${counters.total}|${counters.version}`;", "    const stamp = \"sabit\";", ["BAYATLIK — API", "BAYATLIK — doğrudan yazım"]],
];
let n = 0;
let fail = 0;
try {
  for (const [ad, eski, yeni, beklenen] of MUTASYONLAR) {
    writeFileSync(PL, ASIL);
    n += 1;
    if (ASIL.split(eski).length !== 2) {
      fail += 1;
      console.log(`not ok ${n} - ${ad}: değiştirilecek metin bulunamadı (tek değil)`);
      continue;
    }
    writeFileSync(PL, ASIL.replace(eski, yeni));
    const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "test/iade-kesinti-tarama-249.test.mjs"], { cwd: KOPYA, encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, maxBuffer: 64 * 1024 * 1024 });
    const cikti = `${r.stdout}${r.stderr}`;
    const kirmizi = [...cikti.matchAll(/^ {4}not ok \d+ - (.*)$/gm)].map(m => m[1]);
    const iletiler = [...cikti.matchAll(/^ {6}error: (?:\|-\n {8})?'?(.*?)'?$/gm)].map(m => m[1].slice(0, 220));
    const tutan = beklenen.every(b => kirmizi.some(k => k.startsWith(b)));
    const kirmiziMi = r.status !== 0 && kirmizi.length > 0;
    if (!(kirmiziMi && tutan)) fail += 1;
    console.log(`${kirmiziMi && tutan ? "ok" : "not ok"} ${n} - ${ad}: çıkış ${r.status}; kırmızı ${kirmizi.length} hücre [${kirmizi.map(k => k.slice(0, 40)).join(" | ")}]; beklenen [${beklenen.join(" | ")}] ${tutan ? "tuttu" : "TUTMADI"}`);
    for (const ileti of iletiler) console.log(`#   ileti: ${ileti}`);
  }
} finally {
  writeFileSync(PL, ASIL);
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
