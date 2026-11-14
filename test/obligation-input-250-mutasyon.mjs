#!/usr/bin/env node
// 2.5.0 Ç5-A tur 3a — kuyruğun girdi kurucusu (lib/obligation-input.mjs) MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının NEDENİ okunur).
// Programın AYRI bir kopyasında (ders 23: `git archive <commit>` ile) her seferinde TEK bilerek hata açılır, kopyanın test/obligation-input-250.test.mjs'i koşulur: çıkış ≠ 0 VE
// çıktıda DEĞER karşılaştırmasının iletisi varsa YAKALANDI: hakem ("hakemden farklı çıktı") ya da yalnız toplu yola konan hatada tek cari yoluyla karşılaştırma ("allObligations =
// obligationsFor" — iki ayrı yol). "modül = servis" iletisi SAYILMAZ: mutant modülü servis de kullandığı için o karşılaştırma bozulmaz (bozulursa başka bir şey bozulmuştur).
// Kopya dosyası her mutasyondan sonra asıl baytlarıyla geri yazılır. Kullanım: node test/obligation-input-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,3] [--dokum <klasör>]
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
const TEST = ["--test", "test/obligation-input-250.test.mjs"];
const OI = "server/lib/obligation-input.mjs";
const HAKEM = /hakemden farklı çıktı|allObligations = obligationsFor/;
// [no, ad, [[dosya, eski, yeni], …]]
const MUTASYONLAR = [
  [1, "çek / senet bağı atlanır (Kapatılacak Fatura evrakı bağsız gibi en eski faturayı kapatır)", [[OI, "          if (link) links.set(effect.id, link);\n", ""]]],
  [2, "karşılıksız evrak alış satırını ters çevirmez (reversals boş)", [[OI, "            if (from) reversals.set(effect.id, from);\n", ""]]],
  [3, "şüpheli kayıtlarının kalanı boş verilir (M13 kuyruğu yok)", [[OI, "        if (s && s.remaining > 0) groupInto(out, record.party, { date: record.date, remainingMinor: s.remaining });", "        if (false) groupInto(out, record.party, { date: record.date, remainingMinor: s.remaining });"]]],
  [4, "bağ zamanı kayar — Kapatılacak Fatura düzeltmesinin anı okunmaz (oluşturulma anı)", [[OI, "        )) if (row.id && row.at) out.set(`${prefix}${row.id}`, row.at);", "        )) if (false) out.set(`${prefix}${row.id}`, row.at);"]]],
  [5, "çek bağının anı kayar — evrak düzeltmesinin anı yerine ilk olayın kaydı", [[OI, "const at = String(row.changed || \"\") > String(row.created || \"\") ? String(row.changed) : String(row.created || \"\");", "const at = String(row.created || \"\");"]]],
  [6, "kilit çözücü hep 'açık' döner (kilit izi okunmaz)", [[OI, "    const at = lockAtOf(lockHistory(rows));", "    const at = lockAtOf(lockHistory([]));"]]],
  [7, "kilit belleği anahtarsız (kilit kalkınca / değişince bayat kilit)", [[OI, "    if (!store.inTransaction && lockCache.key === key && lockCache.at) return lockCache.at;", "    if (!store.inTransaction && lockCache.at) return lockCache.at;"]], /hakemden farklı çıktı|modül \(yalnız store, tek cari\) = servis obligationsFor/],
  // M7 bir ÖNBELLEK mutantıdır: bayat değer yalnız servisin uzun ömürlü örneğinde birikir; testin ayrı bağlantıda YENİ kurduğu örnek o durumda bağımsız hakemdir
  // (aynı mutant kodu taşır ama belleği boştur) → "modül = servis" iletisi bu mutantta değer karşılaştırmasıdır. Mantık mutantlarında (öbürleri) o ileti sayılmaz.
  [8, "mahsup fişinin karşı belge adı yanlış (cari satırı her zaman 'Borç Yaz')", [[OI, "    return entry ? `Mahsup · ${entry.kind === \"credit\" ? \"Alacak Yaz\" : \"Borç Yaz\"}", "    return entry ? `Mahsup · ${\"Borç Yaz\"}"]]],
  [9, "Vade Tarihi okunmaz (elle borç belge gününde vadeli)", [[OI, "      if (row.dueDate) dueDates.set(row.id, row.dueDate);\n", ""]]],
  [10, "Beklenen Ödeme Tarihi okunmaz", [[OI, "      if (row.expectedDate) promises.set(row.id, row.expectedDate);\n", ""]]],
  [11, "kart takvimi okunmaz (taksit kalemleri yok)", [[OI, "ORDER BY i.due_date, i.seq`, ...args)) groupInto(schedules, row.planId,", "ORDER BY i.due_date, i.seq`, ...args)) if (false) groupInto(schedules, row.planId,"]]],
  [12, "toplu yolda çek bağı atlanır (yalnız bütün cariler yolu)", [[OI, "    chequeLinks(tables.eventsOf.get(accountId) || [], tables.planned, links, chequeEvents, reversals);", "    chequeLinks([], tables.planned, links, chequeEvents, reversals);"]]],
  [13, "tek cari yolunda Kapatılacak Fatura bağı okunmaz", [[OI, "accountId)) if (!planned.has(entry.invoiceId)) links.set(entry.id, entry.invoiceId);", "accountId)) if (false) links.set(entry.id, entry.invoiceId);"]]],
  [14, "toplu yolda mahsuplar okunmaz", [[OI, "    const offsets = (tables.offsetsOf.get(accountId) || [])", "    const offsets = ([])"]]],
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
for (const [no, ad, degisiklikler, neden = HAKEM] of MUTASYONLAR) {
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
    const caught = r.status !== 0 && neden.test(r.out);
    if (caught) yakalanan += 1;
    const ilk = (r.out.match(/(hakemden farklı çıktı|allObligations = obligationsFor)[^\n]*/) || r.out.match(/AssertionError[^\n]*\n[^\n]*/) || [""])[0].replace(/\s+/g, " ").slice(0, 300);
    console.log(`M${no} ${caught ? "YAKALANDI" : "YAKALANMADI"} — ${ad} (${r.pass} geçti / ${r.fail} kaldı; beklenen değer iletisi ${neden.test(r.out) ? "var" : "YOK"}) ilk hata: ${ilk}`);
  } finally {
    for (const [full, text] of asillar) writeFileSync(full, text);
  }
}
// tools/kanit.mjs özeti: "geçti" = yakalanan mutasyon, "kaldı" = yakalanmayan.
console.log(`SONUÇ: ${yakalanan} geçti, ${toplam - yakalanan} kaldı (${toplam} mutasyonun ${yakalanan}'i yakalandı)`);
process.exitCode = yakalanan === toplam ? 0 : 1;
