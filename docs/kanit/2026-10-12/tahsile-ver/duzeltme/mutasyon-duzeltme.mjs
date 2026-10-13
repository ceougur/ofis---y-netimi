// Mutasyon koşucusu (doğrulama bulgularının düzeltmeleri; KANIT KURALI 3): ayrı kopyada (git archive) her mutasyonu uygular, testleri koşar,
// geri alır. Yakalanmayan mutasyon = eksik test.
// Kullanım: node mutasyon-duzeltme.mjs <kopya-kökü> <çıktı.json>
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.argv[2];
const out = process.argv[3];
const TESTS = ["test/banka-220-tahsile-ver-dogrulama.test.mjs", "test/banka-220-tahsile-ver.test.mjs"];

const MUTATIONS = [
  { id: "N1", what: "T2: karşılıksız maddesi 101.02 yerine 101.01'den", file: "server/lib/general-ledger.mjs",
    from: 'row.bankReturned ? { account: "101", sub: CHEQUE_SUB.bank } : "101"', to: '"101"' },
  { id: "N2", what: "T2/G1: tahsildeki evrakın tahsil maddesi 101.01'den", file: "server/lib/general-ledger.mjs",
    from: 'row.closesDeposit ? atBank : "101"', to: '"101"' },
  { id: "N3", what: "T1: süzgeç yolu tahsil kayıtlarını denetlemiyor", file: "server/lib/integrity-scope.mjs",
    from: 'for (const item of collectionProblems(store, { cheques: s.cheques })) find("cheque:collections", item.sample);', to: ";" },
  { id: "N4", what: "T1: tahsil kaydı yazımı yeniden tam kapıya", file: "server/lib/integrity-scope.mjs",
    from: 'const FULL_TABLES = new Set(["pos_terminals", "pos_sales", "pos_items"]);', to: 'const FULL_TABLES = new Set(["pos_terminals", "pos_sales", "pos_items", "cheque_collections"]);' },
  { id: "N5", what: "T8/D5: açılıştan önce tahsile verme kabul", file: "server/lib/bank/collections.mjs",
    from: "if (account.opening_date && date < account.opening_date) {", to: "if (false) {" },
  { id: "N6", what: "D3: karşılıksızın geri alınmasında hesap uygunluğu yok", file: "server/lib/bank/collections.mjs",
    from: 'if (last.kind === "bounce") {\n      const own', to: 'if (false) {\n      const own' },
  { id: "N7", what: "D4: alış tarihi veriliş gününden sonraya alınabiliyor", file: "server/routes/cheques.mjs",
    from: "if (coreChange) collections.assertIssueBeforeDeposits(previous, input.issueDate);", to: ";" },
  { id: "N8", what: "D4: kapı verilme < alış tarihini görmüyor", file: "server/lib/bank/collections.mjs",
    from: "if (row.cid && !row.deletedAt && row.issued && row.given < row.issued) fail(", to: "if (false) fail(" },
  { id: "N9", what: "D1: onarım kapanışı veriliş gününe kısmıyor", file: "server/lib/bank/repair.mjs",
    from: "const date = item.givenDate && raw < item.givenDate ? item.givenDate : raw;", to: "const date = raw;" },
  { id: "N10", what: "D2: onarım tutarı değişen tahsildeki evrakı düzeltmiyor", file: "server/lib/bank/repair.mjs",
    from: "if (Number(item.givenMinor) === cents && given === item.givenDate) continue;", to: "continue;" },
  { id: "N11", what: "T5: zil/takvim tahsildeki çeki vade gününde", file: "server/routes/cheques.mjs",
    from: "const date = deposit ? deposits.expectedOf(row, deposit) : row.dueDate;", to: "const date = row.dueDate;" },
  { id: "N12", what: "T6: Nakit Akış kaynak özeti tahsildekini ayırmıyor", file: "server/lib/finance-report.mjs",
    from: "const key = `${item.flow || item.source}:${item.direction}`;", to: "const key = `${item.source}:${item.direction}`;" },
  { id: "N13", what: "T7: 'deposited' süzgeci düşüyor", file: "server/routes/report-center.mjs",
    from: '["open", "closed", "overdue", "soon", "deposited"].includes(query.status)', to: '["open", "closed", "overdue", "soon"].includes(query.status)' },
  { id: "N14", what: "G1: İşlem Kartı tahsil kaydı başlığında satır yok", file: "server/lib/bank/movements.mjs",
    from: '} else if (event.src_table === "cheque_collections") {', to: '} else if (false) {' },
  { id: "N15", what: "T2: carisiz evrakın karşılıksız maddesi 101.01'den", file: "server/routes/ledger.mjs",
    from: "bankReturned: Number(row.bankReturned) ? 1 : 0 });", to: "bankReturned: 0 });" },
  { id: "N16", what: "T4: Alt Hesap Mizanı 101'i yalnız tahsil kaydı varken gösteriyor", file: "server/lib/bank/accounts.mjs",
    from: "    if (ids.length) {\n      for (const entry of chequeService.build({ cheques: ids })) {", to: "    if (ids.length && store.get(\"SELECT 1 AS found FROM cheque_collections LIMIT 1\")) {\n      for (const entry of chequeService.build({ cheques: ids })) {" },
  { id: "N17", what: "T3: Yevmiye alt hesabı yazmıyor", file: "server/routes/report-center.mjs",
    from: "entry.text || \"\", line.sub || line.account,", to: "entry.text || \"\", line.account," },
];

const results = [];
for (const m of MUTATIONS) {
  const file = path.join(root, m.file);
  const original = readFileSync(file, "utf8");
  if (!original.includes(m.from)) {
    results.push({ ...m, applied: false, note: "metin bulunamadı" });
    console.log(`${m.id}: UYGULANAMADI (metin yok)`);
    continue;
  }
  writeFileSync(file, original.replace(m.from, m.to));
  try {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", ...TESTS], { cwd: root, encoding: "utf8", timeout: 900_000, env: { ...process.env } });
    const text = `${run.stdout}\n${run.stderr}`;
    const num = name => Number((new RegExp(`^# ${name} (\\d+)`, "m").exec(text) || [])[1] ?? NaN);
    const failed = [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(x => x[1]).slice(0, 4);
    const row = { id: m.id, what: m.what, file: m.file, applied: true, exit: run.status, tests: num("tests"), pass: num("pass"), fail: num("fail"), cancelled: num("cancelled"), killed: run.status !== 0 && num("fail") > 0, failed };
    results.push(row);
    console.log(`${m.id}: çıkış ${run.status} · tests ${row.tests} pass ${row.pass} fail ${row.fail} → ${row.killed ? "YAKALANDI" : "KAÇTI"} ${failed.join(" | ").slice(0, 300)}`);
  } finally {
    writeFileSync(file, original);
  }
}
writeFileSync(out, JSON.stringify(results, null, 2));
const escaped = results.filter(r => r.applied && !r.killed);
console.log(`\nToplam ${results.length}, uygulanan ${results.filter(r => r.applied).length}, yakalanan ${results.filter(r => r.killed).length}, kaçan ${escaped.length}`);
process.exit(escaped.length || results.some(r => !r.applied) ? 1 : 0);
