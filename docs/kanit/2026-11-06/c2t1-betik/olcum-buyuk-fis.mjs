// Ç2 tur 1 — DÜŞÜK-2 ölçümü (ders 15, 47): çok satırlı fişin yazım süresi ve olay döngüsü en çok gecikmesi, önce (2ba5ac0b) / sonra (2d81e8fd) AYNI girdiyle.
// (1) programın kendi yolu: boş sunucu (üretim kipi, gateVerify kapalı) + vouchers.post (denetim + tam kapı + yazım; eşzamanlı yol → olay döngüsü yazım boyunca kilitli);
// (2) yalnız tetikleyiciler: bellek içi veri tabanında göç 46 şeması + tetikleyicileri, n satır.
// Kullanım: flock <olcum.lock> node olcum-buyuk-fis.mjs <depo kökü> <etiket> <n1,n2,…> [<bellek n1,n2,…>]
import path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [rootArg, tag, sizesArg, memArg] = process.argv.slice(2);
const ROOT = path.resolve(rootArg);
const sizes = sizesArg.split(",").map(Number);
const memSizes = (memArg || sizesArg).split(",").map(Number);
const { startTestServer } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const { LEDGER_VOUCHERS_SCHEMA_V46, LEDGER_VOUCHER_TRIGGERS_V46 } = await import(pathToFileURL(path.join(ROOT, "server/lib/migrations.mjs")).href);
const USER = { id: "olcum", display_name: "Ölçüm" };
const big = n => Array.from({ length: n }, (_, i) => ({ account: i % 2 ? "519" : "590", debit: i % 2 ? 0 : 100, credit: i % 2 ? 100 : 0 }));
const out = { etiket: tag, kok: ROOT, program: [], bellek: [] };
const server = await startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true }, gateVerify: false });
try {
  const V = server.app.ledger.vouchers;
  // ısınma (ilk fiş: alt defter hesapları / kapı önbellekleri)
  V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: "olcum-isinma-0001", lines: big(2) });
  for (const n of sizes) {
    const lines = big(n);
    const loop = monitorEventLoopDelay({ resolution: 5 });
    loop.enable();
    await new Promise(resolve => setTimeout(resolve, 30));
    let ms = 0;
    await new Promise(resolve =>
      setImmediate(() => {
        const t = performance.now();
        V.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: `olcum-${tag}-${n}`, lines });
        ms = performance.now() - t;
        resolve();
      }),
    );
    await new Promise(resolve => setTimeout(resolve, 30));
    loop.disable();
    const row = { satir: n, ms: Math.round(ms), olayDongusuEnCokMs: Math.round(loop.max / 1e6), kapiMs: Math.round(server.app.store.lastTx?.guardMs ?? 0) };
    out.program.push(row);
    console.log(`[${tag}] program ${n} satır: ${row.ms} ms (kapı ${row.kapiMs} ms) · olay döngüsü en çok ${row.olayDongusuEnCokMs} ms`);
  }
} finally {
  await server.close();
}
for (const n of memSizes) {
  const db = new DatabaseSync(":memory:");
  db.exec(LEDGER_VOUCHERS_SCHEMA_V46);
  db.exec(LEDGER_VOUCHER_TRIGGERS_V46);
  db.exec("BEGIN");
  db.prepare("INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, request_key, line_count, total_minor, created_by, created_at) VALUES ('v', 2027, 1, '2027-01-05', 'opening-match', 'opening', 'k-00000001', ?, ?, 'x', 'x')").run(n, (n / 2) * 100);
  const ins = db.prepare("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, debit_minor, credit_minor) VALUES ('v', ?, ?, ?, ?)");
  const t = performance.now();
  for (let i = 0; i < n; i += 1) ins.run(i + 1, i % 2 ? "519" : "590", i % 2 ? 0 : 100, i % 2 ? 100 : 0);
  const ms = performance.now() - t;
  db.exec("COMMIT");
  db.close();
  out.bellek.push({ satir: n, ms: Math.round(ms) });
  console.log(`[${tag}] yalnız tetikleyiciler ${n} satır: ${Math.round(ms)} ms`);
}
console.log(`SONUC ${JSON.stringify(out)}`);
