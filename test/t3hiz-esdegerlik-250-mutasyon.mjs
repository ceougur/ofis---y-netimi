// 2.5.0 TEK ADAY HIZ (t3hiz) — eşdeğerlik testinin MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının NEDENİ okunur).
// Programın AYRI bir kopyasında (ders 23: `git archive <commit>` ile) her seferinde TEK bilerek hata açılır, kopyanın test/t3hiz-esdegerlik-250.test.mjs'i koşulur: çıkış ≠ 0 VE değer
// iletisi (AssertionError) VE çökme yok → YAKALANDI. Desen dosyada TAM BİR KEZ geçmezse mutasyon YAKALANDI SAYILMAZ (hata). Kopya dosyası her mutasyondan sonra asıl baytlarıyla geri yazılır.
// Kullanım: node test/t3hiz-esdegerlik-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,3] [--dokum <klasör>]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const opt = name => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : "";
};
const COPY = path.resolve(opt("--kopya") || ".");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const DUMP = opt("--dokum") ? path.resolve(opt("--dokum")) : null;
const TEST = ["--test", "--test-reporter=tap", "test/t3hiz-esdegerlik-250.test.mjs"];
const BD = "server/lib/bank/doubtful.mjs";
const OI = "server/lib/obligation-input.mjs";
const VALUE = /ERR_ASSERTION/;
const CRASH = /TypeError|ReferenceError|SyntaxError|Maximum call stack/;
// [no, ad, [[dosya, eski, yeni], …]]
const MUTASYONLAR = [
  [1, "H1 ön denetim bağsız evrakın carisini de aday sayar (evrakın carisi kolunda fatura bağı koşulu yok)", [[BD, "CROSS JOIN cheques c ON c.account_id = j.value WHERE EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.invoice_id <> '')", "CROSS JOIN cheques c ON c.account_id = j.value WHERE EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id)"]]],
  [2, "H1 ön denetimde ciro edilen ve olayın carisi kolları düşer", [[BD, "\n  UNION SELECT c.endorse_account_id FROM cheques c WHERE c.endorse_account_id IN (SELECT value FROM json_each(?1)) AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.invoice_id <> '')\n  UNION SELECT ev.account_id FROM cheque_events ev WHERE ev.account_id IN (SELECT value FROM json_each(?1)) AND ev.invoice_id <> '' AND EXISTS (SELECT 1 FROM cheques c WHERE c.id = ev.cheque_id)`;", "`;"]]],
  [3, "H1 ön denetimde evrakın carisi kolu düşer", [[BD, "export const LINKED_CHEQUE_PARTIES_SQL = `SELECT c.account_id AS id FROM json_each(?1) j CROSS JOIN cheques c ON c.account_id = j.value WHERE EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.invoice_id <> '')\n  UNION SELECT", "export const LINKED_CHEQUE_PARTIES_SQL = `SELECT"]]],
  [4, "H2 peşin bağlarının sırası eski planınkinden farklı (ORDER BY yok)", [[OI, " AND kind IN ('in', 'out') ORDER BY source_id, rowid\", accountId)) links.set", " AND kind IN ('in', 'out')\", accountId)) links.set"]]],
  [5, "H2 Vade / Beklenen Ödeme Tarihi haritasının sırası farklı (ORDER BY yok)", [[OI, "(due_date <> '' OR expected_date <> '') ORDER BY source_id, rowid\"", "(due_date <> '' OR expected_date <> '')\""]]],
  [6, "H2 evrak olaylarında ciro edilen ve olayın carisi kolları düşer", [[OI, "\n        UNION SELECT x.rowid FROM cheques y CROSS JOIN cheque_events x ON x.cheque_id = y.id WHERE y.endorse_account_id = ?1\n        UNION SELECT rowid FROM cheque_events WHERE account_id = ?1)", ")"]]],
  // M7: ilk denemede "source koşulu düşer" EŞDEĞER çıktı — program Vade / Beklenen Ödeme Tarihi'ni yalnız elle Borç / Alacak satırına yazar (routes/accounts.mjs, 2.4.5 madde 6); yerine değer mutantı.
  [7, "H2 tek cari Vade sorgusu yanlış satır türünü okur (elle satır yerine hiçbiri)", [[OI, "WHERE account_id = ? AND +source = '' AND kind IN ('debt', 'credit')", "WHERE account_id = ? AND +source = 'x' AND kind IN ('debt', 'credit')"]]],
  [8, "H3 bellek anahtarı sabit (veri durumu okunmaz — yazımdan sonra bayat)", [[BD, "  const stamp = `${counters.total}|${counters.version}`;\n  let memo = LINKED_MEMO.get(store);", "  const stamp = \"sabit\";\n  let memo = LINKED_MEMO.get(store);"]]],
  [9, "H3 bellek veri tabanı işleminin İÇİNDE de okunur / yazılır (geri alınan işlemin durumu kalır)", [[BD, "if (LINKED_MEMO_TEST.off || store.inTransaction || typeof store.changeCounters", "if (LINKED_MEMO_TEST.off || typeof store.changeCounters"]]],
  [10, "H3 kesit anahtarı açık kayıtların kalanını taşımaz", [[BD, "join(\"\")}|${JSON.stringify(view.open)}`;", "join(\"\")}`;"]]],
  [11, "H3 kesit anahtarı aynı gün işlenenleri (include) taşımaz", [[BD, "return value === true ? \"1\" : value === false ? \"0\" : \"-\";", "return \"-\";"]]],
  [12, "ortak: bir carinin (ilk aday) bağlı payı atlanır (bellekli = belleksiz; yalnız hakem yakalar)", [[BD, "    const invoiceId = base.links.get(lineId);\n    if (!invoiceId) return null;", "    const invoiceId = base.links.get(lineId);\n    if (!invoiceId || credit.party === [...candidates][0]) return null;"]]],
  [13, "ortak: kesitin şüpheli kalanı yarıya düşer (bellekli = belleksiz; yalnız hakem yakalar)", [[BD, "    const held = doubtfulBefore({ ...base, doubtfulRecords: view.open }, { lineId, include });", "    const held = doubtfulBefore({ ...base, doubtfulRecords: view.open.map(record => ({ ...record, remainingMinor: Math.floor(record.remainingMinor / 2) })) }, { lineId, include });"]]],
  [14, "H1 ön denetimde evrak sorgusu yalnız ZATEN aday olan carilere sorulur (birleşim yerine kesişim)", [[BD, "const rest = ids.filter(id => !candidates.has(id));", "const rest = ids.filter(id => candidates.has(id));"]]],
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
    const failed = [...r.out.matchAll(/^not ok \d+ - ([^\n]*)/gm)].map(m => m[1]).filter(name => !/^2\.5\.0 TEK ADAY HIZ/.test(name));
    const why = (r.out.match(/^\s+error: '([^'\n]{0,200})/m) || [])[1] || "";
    console.log(`M${no} ${caught ? "YAKALANDI" : "YAKALANMADI"} — ${ad} (${r.pass} geçti / ${r.fail} kaldı; değer iletisi ${VALUE.test(r.out) ? "var" : "YOK"}; çökme ${CRASH.test(r.out) ? "VAR" : "yok"}) düşen: ${failed.slice(0, 3).join(" | ").slice(0, 300)} · neden: ${why}`);
  } finally {
    for (const [full, text] of asillar) writeFileSync(full, text);
  }
}
// tools/kanit.mjs özeti: "geçti" = yakalanan mutasyon, "kaldı" = yakalanmayan.
console.log(`SONUÇ: ${yakalanan} geçti, ${toplam - yakalanan} kaldı (${toplam} mutasyonun ${yakalanan}'i yakalandı)`);
process.exitCode = yakalanan === toplam ? 0 : 1;
