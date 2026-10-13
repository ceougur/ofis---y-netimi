// Mutasyon koşucusu (Bankaya Tahsile Ver para çekirdeği): ayrı kopyada her mutasyonu uygular, testi koşar, geri alır.
// Kullanım: node mutasyon.mjs <kopya-kökü> <çıktı.json>
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.argv[2];
const out = process.argv[3];
const TESTS = ["test/banka-220-tahsile-ver.test.mjs"];

const MUTATIONS = [
  { id: "M1", what: "yevmiye: verilişte taraflar ters (B 101.01 / A 101.02)", file: "server/lib/general-ledger.mjs",
    from: 'post(`cheque-deposit:${row.id}`, row.givenDate, "Bankaya Tahsile Ver", label, atBank, portfolio, amount);',
    to: 'post(`cheque-deposit:${row.id}`, row.givenDate, "Bankaya Tahsile Ver", label, portfolio, atBank, amount);' },
  { id: "M2", what: "yevmiye: tahsildeki evrakın tahsil satırı 101.01'den (101.02 değil)", file: "server/lib/general-ledger.mjs",
    from: 'row.eventId && collectedBy.has(row.eventId) ? atBank : "101"', to: '"101"' },
  { id: "M3", what: "yevmiye: Bankadan Geri Al / karşılıksız kapanış maddesi yazılmıyor", file: "server/lib/general-ledger.mjs",
    from: 'else if (row.status !== "pending" && row.closedDate) post(', to: 'else if (false) post(' },
  { id: "M4", what: "rota: tahsilde kayıt kapanmıyor (closeCollected çağrılmıyor)", file: "server/routes/cheques.mjs",
    from: 'if (deposit.pending && action === "collect") collections.closeCollected(', to: 'if (false) collections.closeCollected(' },
  { id: "M5", what: "tahsile veriş tarihi alış tarihinden önce olabiliyor", file: "server/lib/bank/collections.mjs",
    from: "if (date < cheque.issueDate) throw new HttpError(400, `Tahsile veriliş", to: "if (false) throw new HttpError(400, `Tahsile veriliş" },
  { id: "M6", what: "faturayla ciro tahsildeki evrakı kabul ediyor", file: "server/routes/cheques.mjs",
    from: '      collections.assertNotDeposited(cheque, "ciro edilemez");\n', to: "\n" },
  { id: "M7", what: "tahsil başka hesaba yazılabiliyor", file: "server/lib/bank/collections.mjs",
    from: "if (given && given !== pending.bankAccountId) {", to: "if (false) {" },
  { id: "M8", what: "tahsildeki evrak nakit tahsil edilebiliyor", file: "server/lib/bank/collections.mjs",
    from: 'text(body.method) !== "" && text(body.method) !== "bank") {', to: 'false) {' },
  { id: "M9", what: "kapı: beklenen 101.02 bekleyen olmayan kayıtları da sayıyor", file: "server/lib/bank/collections.mjs",
    from: "WHERE k.status = 'pending' AND c.deleted_at IS NULL AND c.direction = 'in' AND c.status = 'portfolio'", to: "WHERE c.deleted_at IS NULL AND c.direction = 'in'" },
  { id: "M10", what: "uygunluk: vadeli hesaba da tahsile verilebiliyor", file: "server/lib/bank/collections.mjs",
    from: 'const DEPOSIT_KINDS = new Set(["demand", "commercial", "other"]);', to: 'const DEPOSIT_KINDS = new Set(["demand", "commercial", "other", "time"]);' },
  { id: "M11", what: "düzenle: tahsildeki evrakın tutarı değişebiliyor", file: "server/routes/cheques.mjs",
    from: 'if (coreChange || (body.dueDate !== undefined && text(body.dueDate) !== previous.dueDate)) collections.assertNotDeposited(', to: 'if (false) collections.assertNotDeposited(' },
  { id: "M12", what: "kapı: 101.02 denetimi yok (her zaman tamam)", file: "server/lib/integrity.mjs",
    from: "const okay = !problems.length && atBank === deposited && inPortfolio === portfolio - deposited;", to: "const okay = true;" },
  { id: "M13", what: "geri al (tahsil): kayıt yeniden bekleyen olmuyor", file: "server/routes/cheques.mjs",
    from: "collections.reopenFor(ctx, cheque.id, last);", to: ";" },
  { id: "M14", what: "Bankadan Geri Al tarih denetimi yok (verilmeden önceki güne)", file: "server/lib/bank/collections.mjs",
    from: "if (date < pending.givenDate) throw new HttpError(400, `Geri alış tarihi", to: "if (false) throw new HttpError(400, `Geri alış tarihi" },
  { id: "M15", what: "tahsilde işlem (tahsil/karşılıksız) verilmeden önceki güne yazılabiliyor", file: "server/lib/bank/collections.mjs",
    from: "if (date < pending.givenDate) throw new HttpError(400, `İşlem tarihi", to: "if (false) throw new HttpError(400, `İşlem tarihi" },
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
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", ...TESTS], { cwd: root, encoding: "utf8", timeout: 900_000 });
    const text = `${run.stdout}\n${run.stderr}`;
    const num = name => Number((new RegExp(`^# ${name} (\\d+)`, "m").exec(text) || [])[1] ?? NaN);
    const failed = [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(x => x[1]).filter(name => !/^(Bankaya Tahsile Ver|yetki|eski)/.test(name)).slice(0, 4);
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
