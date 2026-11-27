#!/usr/bin/env node
// 2.5.0 Ç1 — yevmiye EŞDEĞERLİK kanıtı (docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §2, §4, §11: hesap planı / sınıflama değişikliği HİÇBİR olayın hangi hesaba
// yazıldığını değiştirmez). Aynı veri kopyası iki kodla (taban: `git archive <taban>` kopyası, ders 23; yeni: çalışma ağacı) açılır; Ana Defter'in kendi
// kuralıyla kurulan yevmiye maddeleri (kimlik, tarih, kaynak, sıra, hesap, alt hesap, cari, borç, alacak) ve mizanlar (bütün zaman + yıl yıl) dökülür ve
// birebir karşılaştırılır. Fark yalnız hesap ADINDA ve yalnız --ad-farki ile verilen hesaplarda kabul edilir (Ç1: 770).
// Veri programın KENDİ ürettiği veridir: (a) mutabakat motoru (test/mutabakat/motor.mjs) programın API'sinden tohumlu rastgele işlemlerle (Kasa, Stok, Cari,
// Taksit, Fatura, Çek / Senet, Banka, POS, Tahsile Ver, şüpheli alacak, dönem kilidi) üretir; (b) eski sürüm fikstürleri (test/fixtures/surum-*; eski
// sürümlerin GERÇEK koduyla üretilmiş, çok şirketli). Saat sabittir (iki kod aynı "bugün"ü görür; ders 13, 22).
//
//   node test/defter-esdegerlik-250.mjs uret --kod <kök> --veri <klasör> [--tohum 7] [--islem 3000] [--gun 400] [--her 250]
//   node test/defter-esdegerlik-250.mjs fikstur --veri <klasör> --ad surum-2.0.26-zincir
//   node test/defter-esdegerlik-250.mjs dok --kod <kök> --veri <klasör> --cikti <dosya.json>
//   node test/defter-esdegerlik-250.mjs karsilastir <eski.json> <yeni.json> [--ad-farki 770]
// Programı aynı süreçte açar (startTestServer; lisans zamanlayıcısı kapalı). Yine de HUKUK_LICENSE_URL=http://127.0.0.1:9 ile koşulur (ders 30).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";

const argv = process.argv.slice(2);
const command = argv[0];
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const fromRoot = (root, file) => import(pathToFileURL(path.join(path.resolve(root), file)).href);
const NOW_FILE = "esdegerlik-saat.json";
// Sabit "bugün": verinin üretildiği gün (uret) ya da fikstür için sabit gün; iki kod aynı saati görür.
const FIXED_NOW = "2026-11-05T09:00:00+03:00";

async function generate() {
  const root = opt("kod");
  const veri = path.resolve(opt("veri"));
  if (existsSync(veri)) throw new Error(`${veri} zaten var (veri bir kez üretilir)`);
  const { startTestServer, loginAdmin } = await fromRoot(root, "test/helpers.mjs");
  const { motorNow, runReconciliation } = await fromRoot(root, "test/mutabakat/motor.mjs");
  const now = motorNow();
  const server = await startTestServer({ dataDir: path.join(veri, "data"), backupDir: path.join(veri, "backups"), bankPickLegacy: true, now });
  try {
    const admin = await loginAdmin(server);
    const report = await runReconciliation({ client: admin, seed: Number(opt("tohum", 7)), operations: Number(opt("islem", 3000)), verifyEvery: Number(opt("her", 250)), span: Number(opt("gun", 400)), burst: 60, pos: true });
    writeFileSync(path.join(veri, NOW_FILE), JSON.stringify({ now: server.clock(), seed: report.seed, operations: report.operations, timeline: report.timeline, locks: report.locks, byKind: report.byKind, mismatches: report.mismatches.length }, null, 1));
    console.log(`veri üretildi: ${veri} · tohum ${report.seed} · ${report.operations} işlem · ${report.checks} doğrulama · zaman ${report.timeline.from} → ${report.timeline.to} · kilit ${JSON.stringify(report.locks)} · uyuşmazlık ${report.mismatches.length}`);
    console.log(`işlem türleri: ${Object.entries(report.byKind).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (report.mismatches.length) throw new Error(`motor uyuşmazlık buldu (${report.mismatches.length}) — veri kanıt için kullanılmaz`);
  } finally {
    await server.close();
  }
}

async function fixture() {
  const veri = path.resolve(opt("veri"));
  if (existsSync(veri)) throw new Error(`${veri} zaten var`);
  mkdirSync(veri, { recursive: true });
  const unpacked = unpackFixture(opt("ad"), { root: veri });
  writeFileSync(path.join(veri, NOW_FILE), JSON.stringify({ now: FIXED_NOW, fixture: opt("ad"), version: unpacked.fixture.version || unpacked.fixture.cut || "" }, null, 1));
  console.log(`fikstür açıldı: ${opt("ad")} → ${unpacked.dataDir}`);
}

// Şirket veri klasörleri: kök (001) + sirketler/<kod>/ (her biri kendi destekofis.sqlite'ı; ayrı açılır). Silinen şirketler alınmaz.
function companyDirs(dataDir) {
  const out = [{ code: "001", dir: dataDir }];
  const extra = path.join(dataDir, "sirketler");
  if (existsSync(extra)) for (const name of readdirSync(extra).sort()) if (existsSync(path.join(extra, name, "destekofis.sqlite"))) out.push({ code: name, dir: path.join(extra, name) });
  return out;
}

async function dump() {
  const root = opt("kod");
  const veri = path.resolve(opt("veri"));
  const output = path.resolve(opt("cikti"));
  const saved = JSON.parse(readFileSync(path.join(veri, NOW_FILE), "utf8"));
  const { startTestServer, loginAdmin } = await fromRoot(root, "test/helpers.mjs");
  const lib = await fromRoot(root, "server/lib/general-ledger.mjs");
  const work = mkdtempSync(path.join(path.dirname(output), "dok-"));
  const result = { kod: path.resolve(root), veri, now: saved.now, sirketler: [] };
  try {
    for (const company of companyDirs(path.join(veri, "data"))) {
      // Kopya üzerinde açılır (göç / açılış onarımı asıl veriyi değiştirmesin; iki kod aynı baytlardan başlar). Alt şirketler kökte açılmaz (tembel).
      const copy = path.join(work, company.code, "data");
      cpSync(company.dir, copy, { recursive: true });
      const server = await startTestServer({ dataDir: copy, backupDir: path.join(work, company.code, "backups"), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
      try {
        const entries = server.app.ledger.build();
        const years = [...new Set(entries.map(entry => entry.date.slice(0, 4)))].sort();
        const trials = { tum: lib.trialBalance(entries) };
        for (const year of years) trials[year] = lib.trialBalance(entries, { from: `${year}-01-01`, to: `${year}-12-31` });
        const check = server.app.ledger.check();
        // Rapor yolu (ekran = PDF = Excel aynı modelden): Hesap Planı Mizanı'nın satırları (ad dahil). Giriş olmazsa "okunamadı" (ders 4).
        let report = "okunamadı";
        try {
          const admin = await loginAdmin(server);
          const response = await admin.get("/api/workspace/report-center/hesap-mizani?preset=all");
          report = response.status === 200 ? (response.data?.data ?? response.data)?.rows ?? "okunamadı" : `okunamadı (${response.status})`;
        } catch (error) {
          report = `okunamadı (${error.message})`;
        }
        const used = [...new Set(entries.flatMap(entry => entry.lines.map(line => line.account)))].sort();
        result.sirketler.push({
          kod: company.code,
          maddeSayisi: entries.length,
          satirSayisi: entries.reduce((sum, entry) => sum + entry.lines.length, 0),
          yillar: years,
          maddeler: entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source, text: entry.text, seq: entry.seq ?? null, doubtful: entry.doubtful ?? null, lines: entry.lines })),
          mizan: trials,
          mutabakat: { ok: check.reconciliation.ok, balanced: check.reconciliation.balanced, checks: check.reconciliation.checks },
          rapor: report,
          kullanilanHesaplar: used,
          // Yeni kodda: deftere yazılan her hesap sınıflanabilir mi (accountOf). Eski kodda yardımcı yok → "yok".
          siniflanmayan: typeof lib.accountOf === "function" ? used.filter(code => !lib.accountOf(code)) : "yok",
        });
        console.log(`${company.code}: ${entries.length} madde, ${result.sirketler.at(-1).satirSayisi} satır, yıllar ${years.join(" ")}, mutabakat ${check.reconciliation.ok ? "tutarlı" : "FARKLI"}, hesap ${used.length}`);
      } finally {
        await server.close();
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  writeFileSync(output, JSON.stringify(result));
  console.log(`döküm: ${output}`);
}

function compare() {
  const [a, b] = [argv[1], argv[2]].map(file => JSON.parse(readFileSync(file, "utf8")));
  const allowed = new Set(String(opt("ad-farki", "")).split(",").filter(Boolean));
  const failures = [];
  const notes = [];
  let tests = 0;
  const check = (ok, text) => {
    tests += 1;
    console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
    if (!ok) failures.push(text);
  };
  check(a.sirketler.length === b.sirketler.length && a.sirketler.length > 0, `şirket sayısı aynı (${a.sirketler.length} / ${b.sirketler.length})`);
  for (const [index, old] of a.sirketler.entries()) {
    const now = b.sirketler[index];
    if (!now) continue;
    const tag = `şirket ${old.kod}`;
    check(old.kod === now.kod, `${tag}: aynı şirket`);
    check(old.maddeSayisi === now.maddeSayisi && old.maddeSayisi > 0, `${tag}: madde sayısı aynı ve > 0 (${old.maddeSayisi} / ${now.maddeSayisi}; satır ${old.satirSayisi} / ${now.satirSayisi})`);
    let firstDiff = -1;
    for (let i = 0; i < Math.max(old.maddeler.length, now.maddeler.length); i++) {
      if (JSON.stringify(old.maddeler[i]) !== JSON.stringify(now.maddeler[i])) {
        firstDiff = i;
        break;
      }
    }
    check(firstDiff === -1, `${tag}: yevmiye maddeleri BİREBİR (kimlik, tarih, kaynak, sıra, hesap, alt hesap, cari, borç, alacak)${firstDiff >= 0 ? ` — ilk fark ${firstDiff}: ${JSON.stringify(old.maddeler[firstDiff])} ≠ ${JSON.stringify(now.maddeler[firstDiff])}` : ""}`);
    for (const key of Object.keys(old.mizan)) {
      const x = old.mizan[key];
      const y = now.mizan[key];
      const strip = trial => ({ ...trial, accounts: trial.accounts.map(({ name, ...rest }) => rest) });
      check(Boolean(y) && JSON.stringify(strip(x)) === JSON.stringify(strip(y)), `${tag}: mizan ${key} tutarları ve toplamları aynı (borç ${x.totals.debit}, alacak ${x.totals.credit}, hesap ${x.accounts.length}, dengeli ${x.balanced})`);
      const renamed = y ? x.accounts.filter((row, i) => row.name !== y.accounts[i]?.name).map((row, i) => `${row.code}: ${row.name} → ${y.accounts.find(item => item.code === row.code)?.name}`) : [];
      const unexpected = renamed.filter(text => !allowed.has(text.split(":")[0]));
      check(unexpected.length === 0, `${tag}: mizan ${key} adları — yalnız izinli fark (${[...allowed].join(", ") || "yok"}): ${renamed.length ? renamed.join("; ") : "fark yok"}`);
    }
    check(old.mutabakat.ok === true && now.mutabakat.ok === true && JSON.stringify(old.mutabakat.checks.map(({ name, ...r }) => r)) === JSON.stringify(now.mutabakat.checks.map(({ name, ...r }) => r)), `${tag}: Defter Mutabakatı iki kodda tutarlı ve aynı (${old.mutabakat.checks.length} denetim)`);
    if (Array.isArray(old.rapor) && Array.isArray(now.rapor)) {
      const cells = rows => rows.map(row => [row[0], ...row.slice(2)]);
      check(JSON.stringify(cells(old.rapor)) === JSON.stringify(cells(now.rapor)), `${tag}: Hesap Planı Mizanı raporu (Tüm Zamanlar) satırları aynı (ad kolonu hariç; ${old.rapor.length} satır)`);
      const names = old.rapor.map((row, i) => [row[0], row[1], now.rapor[i]?.[1]]).filter(([, x, y]) => x !== y);
      check(names.every(([code]) => allowed.has(String(code))), `${tag}: rapordaki ad farkları yalnız izinli hesaplarda (${names.map(([code, x, y]) => `${code}: ${x} → ${y}`).join("; ") || "fark yok"})`);
    } else notes.push(`${tag}: rapor okunamadı (eski: ${typeof old.rapor === "string" ? old.rapor : "var"}, yeni: ${typeof now.rapor === "string" ? now.rapor : "var"})`);
    check(Array.isArray(now.siniflanmayan) && now.siniflanmayan.length === 0, `${tag}: yeni kodda deftere yazılan her hesap sınıflanabilir (${now.kullanilanHesaplar.length} hesap: ${now.kullanilanHesaplar.join(" ")}; sınıflanmayan ${JSON.stringify(now.siniflanmayan)})`);
  }
  for (const note of notes) console.log(`# NOT: ${note}`);
  console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failures.length}\n# fail ${failures.length}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exit(failures.length ? 1 : 0);
}

if (command === "uret") await generate();
else if (command === "fikstur") await fixture();
else if (command === "dok") await dump();
else if (command === "karsilastir") compare();
else throw new Error("komut: uret | fikstur | dok | karsilastir");
