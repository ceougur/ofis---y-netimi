#!/usr/bin/env node
// 2.5.0 Ç5-A tur 3c — şüpheli ↔ kuyruk defter kuralı MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının NEDENİ okunur).
// Programın AYRI bir kopyasında (ders 23: `git archive <commit>` ile) her seferinde TEK bilerek hata açılır, kopyanın test/supheli-kuyruk-defter-250.test.mjs'i koşulur: çıkış ≠ 0 VE
// çıktıda DEĞER karşılaştırmasının iletisi (AssertionError) varsa, çökme (TypeError / ReferenceError / SyntaxError / yığın taşması) YOKSA YAKALANDI.
// Kopya dosyası her mutasyondan sonra asıl baytlarıyla geri yazılır. Kullanım: node test/supheli-kuyruk-defter-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,3] [--dokum <klasör>]
// Yük koşusudur: `flock -s scratchpad/olcum.lock` ile başlatılır (ders 52).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const DUMP = opt("--dokum") ? path.resolve(opt("--dokum")) : null;
const TEST = ["--test", "--test-reporter=tap", "test/supheli-kuyruk-defter-250.test.mjs"];
const GL = "server/lib/doubtful-gl.mjs";
const BD = "server/lib/bank/doubtful.mjs";
const OQ = "server/lib/obligation-queue.mjs";
const AL = "server/lib/account-lines.mjs";
const RA = "server/routes/accounts.mjs";
const VALUE = /ERR_ASSERTION/;
const CRASH = /TypeError|ReferenceError|SyntaxError|Maximum call stack/;
// [no, ad, [[dosya, eski, yeni], …]]
const MUTASYONLAR = [
  [1, "128 ↔ 120 dağılımı eski sabite: bağlı tahsilat her zaman 120 (iki yükleyicide)", [
    [GL, "export const doubtfulKeepOf = ({ kind, source = \"\", doubtfulSkip = 0 } = {}) =>\n  kind === \"in\" && (doubtfulSkip === true || Number(doubtfulSkip) === 1 || source === \"invoice\");", "export const doubtfulKeepOf = ({ kind, source = \"\", invoiceId = \"\", doubtfulSkip = 0 } = {}) =>\n  kind === \"in\" && (doubtfulSkip === true || Number(doubtfulSkip) === 1 || source === \"invoice\" || Boolean(invoiceId));"],
    [BD, "WHERE (e.kind = 'in' AND e.doubtful_skip = 0 AND e.source <> 'invoice') OR", "WHERE (e.kind = 'in' AND e.doubtful_skip = 0 AND e.source <> 'invoice' AND e.invoice_id = '') OR"],
  ]],
  [2, "128 ↔ 120 dağılımı eski sabite: bağlı evrak en eski kayıttan (kuyruk payı okunmaz — geri çağrı yok)", [[GL, "        const shares = linked && !credit.openedOn", "        const shares = false && linked && !credit.openedOn"]]],
  [3, "ikinci yükleyici (doubtfulState) eski kuralda kalır", [[BD, "  const { state, allocations } = allocateDoubtful({ records, provisions, credits, linked: rows.linked || null });", "  const { state, allocations } = allocateDoubtful({ records, provisions, credits, linked: null });"]]],
  [4, "yevmiye yükleyicisi (doubtfulRows) eski kuralda kalır", [[GL, "credits, linked: typeof doubtful?.linked === \"function\" ? doubtful.linked : null });", "credits, linked: null });"]]],
  // M5: önce "if (line.id === lineId) return false;" satırı silinerek denendi — EŞDEĞER mutant (satırın kendisi anahtar eşitliğiyle zaten dışarıda: "< 0"); yerine eşitliği içeren karşılaştırma.
  [5, "kesit satırın KENDİSİNİ ve aynı anahtarı da içerir (< yerine <=)", [[OQ, "    if (line.id === lineId) return false;\n", ""], [OQ, "    return eventOrder(keyOf(line), edge) < 0;", "    return eventOrder(keyOf(line), edge) <= 0;"]]],
  [6, "kesit yok — kuyruğun son durumu okunur (sonraki satırlar dahil)", [[OQ, "    if (line.date !== cut.date) return line.date < cut.date;\n", "    if (line.date !== cut.date) return true;\n"]]],
  [7, "pay kayıt kimliği yerine en eski açık kayda yazılır", [[GL, "            const record = live.get(share.recordId);", "            const record = open[0];"]]],
  [8, "kalem başına kayıt kimliği boş (K-1 (b) yok)", [[OQ, "        else list.push({ recordId: record.id ?? \"\", minor: take });", "        else list.push({ recordId: \"\", minor: take });"]]],
  [9, "sınır tutarın TAMAMINA uygulanır (128 payı düşülmez)", [[RA, "      const shareMinor = Math.min(amountMinor, doubtful().allocatedMinor?.(account.id, entryId) ?? 0);", "      const shareMinor = 0;"]]],
  [10, "yeni tahsilatta yazım sonrası sınır denetimi atlanır", [[RA, "        normalAfter?.(entry.id); // Ç5-A tur 3c", "        void normalAfter; // Ç5-A tur 3c"]]],
  [11, "düzeltmede yazım sonrası sınır denetimi atlanır", [[RA, "        normalAfter?.(previous.id); // Ç5-A tur 3c", "        void normalAfter; // Ç5-A tur 3c"]]],
  [12, "kesitin aynı gün kuralı kalkar (ayırıcının işlediği alacak yerine kuyruğun anahtarı)", [[BD, "      return view.known?.has(key) ? view.done.has(key) : undefined;", "      return undefined;"]]],
  [13, "kart haritası (cari kümesi) silinmiş kartı da alır", [[AL, "CROSS JOIN plans p ON p.account_id = j.value WHERE p.deleted_at IS NULL AND p.account_id <> ''", "CROSS JOIN plans p ON p.account_id = j.value WHERE p.account_id <> ''"]]],
  [14, "kart haritası (cari kümesi) kart tahsilatlarını okumaz", [[AL, "FROM json_each(?) j CROSS JOIN plan_entries e ON e.plan_id = j.value ORDER BY", "FROM json_each(?) j CROSS JOIN plan_entries e ON e.plan_id = j.value AND 0 ORDER BY"]]],
  [15, "S25 (b) yerine fazlası da şüpheliden (pay sınırı kalkar)", [[GL, "            if (record) collect(record, Math.max(0, Math.round(Number(share.minor) || 0)));", "            if (record) collect(record, Infinity);"]]],
];

const run = args => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", ...args], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run(TEST);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error(`taban testi yeşil değil — mutasyon taraması anlamsız\n${taban.out.slice(-3000)}`);
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, degisiklikler] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  toplam += 1;
  const asillar = new Map();
  try {
    for (const [file, eski, yeni] of degisiklikler) {
      const full = path.join(COPY, file);
      if (!asillar.has(full)) asillar.set(full, readFileSync(full, "utf8"));
      const current = readFileSync(full, "utf8");
      const hits = current.split(eski).length - 1;
      if (hits !== 1) throw new Error(`M${no}: "${eski.slice(0, 80)}" ${file} içinde ${hits} kez (tam 1 olmalı) — desen yerini bulamadı, YAKALANDI SAYILMAZ`);
      writeFileSync(full, current.replace(eski, yeni));
    }
    const r = run(TEST);
    if (DUMP) writeFileSync(path.join(DUMP, `M${no}.txt`), r.out);
    const caught = r.status !== 0 && VALUE.test(r.out) && !CRASH.test(r.out);
    if (caught) yakalanan += 1;
    const failed = [...r.out.matchAll(/^not ok \d+ - ([^\n]*)/gm)].map(m => m[1]).filter(name => !/^Ç5-A tur 3c/.test(name));
    console.log(`M${no} ${caught ? "YAKALANDI" : "YAKALANMADI"} — ${ad} (${r.pass} geçti / ${r.fail} kaldı; değer iletisi ${VALUE.test(r.out) ? "var" : "YOK"}; çökme ${CRASH.test(r.out) ? "VAR" : "yok"}) düşen: ${failed.slice(0, 4).join(" | ").slice(0, 400)}`);
  } finally {
    for (const [full, text] of asillar) writeFileSync(full, text);
  }
}
// tools/kanit.mjs özeti: "geçti" = yakalanan mutasyon, "kaldı" = yakalanmayan.
console.log(`SONUÇ: ${yakalanan} geçti, ${toplam - yakalanan} kaldı (${toplam} mutasyonun ${yakalanan}'i yakalandı)`);
process.exitCode = yakalanan === toplam ? 0 : 1;
