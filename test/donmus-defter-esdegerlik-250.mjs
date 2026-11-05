#!/usr/bin/env node
// 2.5.0 Ç3 — donmuş defterin EŞDEĞERLİK ve GÖÇ kanıtı (docs/erp/C3-DONDURMA-TASARIM.md §5, §6, §14 F1, F11; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §4 "GÖÇ", §9 madde 1).
// Veri programın KENDİ ürettiği veridir: test/defter-esdegerlik-250.mjs "uret" (mutabakat motoru, programın API'si) ya da "fikstur" (eski sürümlerin gerçek koduyla üretilmiş
// fikstür). "kilitle" kilidi o kodun KENDİ ucuyla koyar (ör. v2.4.9 gerçek kodu: kullanıcı 2.4.9'da kilitlemiş). "dok" her şirketi bir KOPYADA verilen kodla açar (ders 23):
// eski kodda yevmiye + kilitli dönemin raporları; yeni kodda (--yeni) göç 47 → bekleyen 2.4.9 koşusu dondurulur → donmuş maddeler, karma yevmiye, 2.4.9 kopyasının türetmesi,
// güncel türetme ve aynı raporlar. "karsilastir": donmuş = v2.4.9 türetmesi (kilit gününe kadar, madde madde); 2.4.9 kopyası = v2.4.9 GERÇEK kodu (bütün geçmiş); güncel türetme
// = v2.4.9 (tutarda); kilitli dönemin Yevmiye Defteri ve Hesap Planı Mizanı göçten önce / sonra birebir (yalnız 770'in ADI — Ç1). Saat sabit (ders 13, 22).
//   node test/donmus-defter-esdegerlik-250.mjs kilitle --kod <kök> --veri <klasör> [--gun 2026-08-31]
//   node test/donmus-defter-esdegerlik-250.mjs dok --kod <kök> --veri <klasör> --cikti <dosya.json> [--yeni]
//   node test/donmus-defter-esdegerlik-250.mjs karsilastir <eski.json> <yeni.json> [--ad-farki 770] [--ayni-kod]
// HUKUK_LICENSE_URL=http://127.0.0.1:9 ile koşulur (ders 30).
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const command = argv[0];
const opt = (name, fallback = null) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const fromRoot = (root, file) => import(pathToFileURL(path.join(path.resolve(root), file)).href);
const NOW_FILE = "esdegerlik-saat.json";
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
function companyDirs(dataDir) {
  const out = [{ code: "001", dir: dataDir }];
  const extra = path.join(dataDir, "sirketler");
  if (existsSync(extra)) for (const name of readdirSync(extra).sort()) if (existsSync(path.join(extra, name, "destekofis.sqlite"))) out.push({ code: name, dir: path.join(extra, name) });
  return out;
}
const dayOf = iso => new Date(iso).toISOString().slice(0, 10);
const shiftDay = (day, days) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const monthEndBefore = day => shiftDay(`${day.slice(0, 7)}-01`, -1);

async function lockData() {
  const root = opt("kod");
  const veri = path.resolve(opt("veri"));
  const saved = JSON.parse(readFileSync(path.join(veri, NOW_FILE), "utf8"));
  const day = opt("gun") || monthEndBefore(shiftDay(dayOf(saved.now), -60));
  const { startTestServer, loginAdmin } = await fromRoot(root, "test/helpers.mjs");
  for (const company of companyDirs(path.join(veri, "data"))) {
    const server = await startTestServer({ dataDir: company.dir, backupDir: path.join(veri, "backups", company.code), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
    try {
      const admin = await loginAdmin(server);
      const response = await admin.put("/api/admin/period-lock", { lockedUntil: day, force: true });
      if (response.status !== 200) throw new Error(`${company.code}: kilit ${response.status} ${JSON.stringify(response.data)}`);
      console.log(`${company.code}: kilit ${response.data.data.lockedUntil} (${root})`);
    } finally {
      await server.close();
    }
  }
  saved.lock = day;
  writeFileSync(path.join(veri, NOW_FILE), JSON.stringify(saved, null, 1));
}

async function dump() {
  const root = opt("kod");
  const veri = path.resolve(opt("veri"));
  const output = path.resolve(opt("cikti"));
  const fresh = argv.includes("--yeni");
  const saved = JSON.parse(readFileSync(path.join(veri, NOW_FILE), "utf8"));
  const { startTestServer, loginAdmin } = await fromRoot(root, "test/helpers.mjs");
  const rule249 = fresh ? await fromRoot(root, "server/lib/ledger-rule-249/index.mjs") : null;
  const work = mkdtempSync(path.join(path.dirname(output), "donma-dok-"));
  const result = { kod: path.resolve(root), veri, now: saved.now, yeni: fresh, sirketler: [] };
  try {
    for (const company of companyDirs(path.join(veri, "data"))) {
      const copy = path.join(work, company.code, "data");
      cpSync(company.dir, copy, { recursive: true });
      const server = await startTestServer({ dataDir: copy, backupDir: path.join(work, company.code, "backups"), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
      try {
        const admin = await loginAdmin(server);
        const lock = server.app.context.period.lockedUntil();
        const item = { kod: company.code, kilit: lock };
        if (fresh) {
          const S = server.app.ledger.snapshots;
          item.kosuOnce = server.app.store.all("SELECT kind, state, rule_version AS rule, reason, from_date AS fromDate, through FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
          item.karmaOnce = canon(server.app.ledger.book());
          const status = await S.runPending();
          item.durum = { ...S.state(), freeze: status };
          item.kosuSonra = server.app.store.all("SELECT kind, state, rule_version AS rule, reason, from_date AS fromDate, through, line_count AS lines FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
          item.donmus = canon(S.entries());
          item.karma = canon(server.app.ledger.book());
          item.kural249 = canon(rule249.buildRule249(server.app.store));
          item.surum = server.app.store.get("PRAGMA user_version").user_version;
        }
        item.yevmiye = canon(server.app.ledger.build());
        if (lock) {
          // Raporun TAM satırları (ekran önizlemesi 200 satırda kesilir; PDF / Excel ile aynı model): rapor merkezinin kendi run'ı, sınırsız. Önizleme ucu da (HTTP) denenir.
          const user = { ...server.app.store.get("SELECT * FROM users WHERE username = 'admin'"), role: "admin", permissions: [] };
          const full = async (id, from, to) => {
            const data = await server.app.context.reportCenter.run(user, id, new URLSearchParams({ from, to }), { limit: 0 });
            return { rows: data.rows, summary: data.summary || null, total: data.total ?? data.rows.length };
          };
          const preview = await admin.get(`/api/workspace/report-center/yevmiye?from=${lock.slice(0, 4)}-01-01&to=${lock}`);
          item.onizlemeDurum = preview.status;
          item.raporYevmiye = await full("yevmiye", `${lock.slice(0, 4)}-01-01`, lock);
          item.raporYevmiyeTum = await full("yevmiye", "2000-01-01", lock);
          item.raporMizan = await full("hesap-mizani", `${lock.slice(0, 4)}-01-01`, lock);
          item.raporTum = await full("hesap-mizani", "2000-01-01", lock);
        }
        const scan = await admin.get("/api/workspace/ledger/integrity");
        item.tarama = scan.status === 200 ? { ok: scan.data.data.ok, basarisiz: scan.data.data.checks.filter(check => !check.ok).map(check => check.code) } : `okunamadı (${scan.status})`;
        result.sirketler.push(item);
        console.log(`${company.code}: kilit ${lock || "yok"} · ${item.yevmiye.length} madde${fresh ? ` · donmuş ${item.donmus.length} madde · kapsam ${item.durum.coverage}` : ""} · tarama ${JSON.stringify(item.tarama)}`);
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
  let tests = 0;
  let failed = 0;
  const check = (ok, text, detail = "") => {
    tests += 1;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}${!ok && detail ? `\n  # ${detail}` : ""}`);
  };
  const firstDiff = (x, y) => {
    for (let i = 0; i < Math.max(x.length, y.length); i++) if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) return `${i}: ${JSON.stringify(x[i])?.slice(0, 300)} ↔ ${JSON.stringify(y[i])?.slice(0, 300)}`;
    return "";
  };
  // Hesap Planı Mizanı satırı: [hesap, ad, devir, borç, alacak, bakiye, yön] — adı yalnız izin verilen hesapta farklı olabilir.
  const rowsSame = (x, y) => Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((row, i) => row.every((cell, j) => cell === y[i][j] || (j === 1 && allowed.has(row[0]))));
  check(b.yeni === true && a.yeni === false, "eski döküm eski koddan, yeni döküm yeni koddan");
  check(a.sirketler.length === b.sirketler.length && a.sirketler.length > 0, `şirket sayısı (${a.sirketler.length} / ${b.sirketler.length})`);
  for (const [index, old] of a.sirketler.entries()) {
    const now = b.sirketler[index];
    if (!now) continue;
    const tag = `şirket ${old.kod}`;
    const lock = old.kilit;
    check(Boolean(lock) && now.kilit === lock, `${tag}: kilitli (${lock}) ve kilit göçte aynı`);
    const upTo = list => list.filter(entry => entry.date <= lock);
    check(now.kosuOnce.length === 1 && now.kosuOnce[0].rule === "2.4.9" && now.kosuOnce[0].reason === "migration" && now.kosuOnce[0].through === lock && now.kosuOnce[0].fromDate === "", `${tag}: göç 47 bekleyen 2.4.9 koşusu (${JSON.stringify(now.kosuOnce)})`);
    check(now.surum === 47, `${tag}: şema 47`);
    check(now.durum.coverage === lock && now.durum.pending === null, `${tag}: donunca kapsam = kilit, bekleyen yok (${JSON.stringify(now.durum)})`);
    check(now.kosuSonra.length === 1 && now.kosuSonra[0].state === "done" && now.kosuSonra[0].rule === "2.4.9" && now.kosuSonra[0].lines > 0, `${tag}: tek koşu, 2.4.9 kuralıyla, ${now.kosuSonra[0]?.lines} satır`);
    check(now.donmus.length > 0 && JSON.stringify(now.donmus) === JSON.stringify(upTo(old.yevmiye)), `${tag}: donmuş defter = v2.4.9 GERÇEK kodunun türetmesi (kilit gününe kadar; ${now.donmus.length} / ${upTo(old.yevmiye).length} madde)`, firstDiff(now.donmus, upTo(old.yevmiye)));
    check(JSON.stringify(now.kural249) === JSON.stringify(old.yevmiye), `${tag}: 2.4.9 kopyası = v2.4.9 GERÇEK kodu (bütün geçmiş, ${now.kural249.length} / ${old.yevmiye.length} madde)`, firstDiff(now.kural249, old.yevmiye));
    check(JSON.stringify(now.yevmiye) === JSON.stringify(old.yevmiye), `${tag}: güncel türetme = v2.4.9 (bütün geçmiş; kural sürümü 2.5.0, Ç1 yalnız ad)`, firstDiff(now.yevmiye, old.yevmiye));
    check(JSON.stringify(now.karmaOnce) === JSON.stringify(old.yevmiye) && JSON.stringify(now.karma) === JSON.stringify(old.yevmiye), `${tag}: karma yevmiye (donmadan önce 2.4.9 koşusunun kuralıyla, donduktan sonra tablodan) = v2.4.9`);
    check(now.onizlemeDurum === 200 && old.onizlemeDurum === 200, `${tag}: Yevmiye Defteri önizleme ucu 200`);
    for (const [key, label] of [["raporYevmiye", "kilitli yılın Yevmiye Defteri"], ["raporYevmiyeTum", "kilit gününe kadar bütün Yevmiye Defteri"]]) {
      const x = old[key];
      const y = now[key];
      check(Boolean(x?.rows?.length) && JSON.stringify(x.rows) === JSON.stringify(y?.rows) && JSON.stringify(x.summary) === JSON.stringify(y?.summary) && x.total === y?.total, `${tag}: ${label} raporu göçten önce / sonra birebir (${x?.rows?.length} satır, tam; özet ${JSON.stringify(x?.summary)})`, firstDiff(y?.rows || [], x?.rows || []));
    }
    for (const [key, label] of [["raporMizan", "kilitli yılın Hesap Planı Mizanı"], ["raporTum", "kilit gününe kadar bütün zamanların Hesap Planı Mizanı"]]) {
      const x = old[key];
      const y = now[key];
      check(Boolean(x?.rows?.length) && rowsSame(x.rows, y?.rows) && JSON.stringify(x.summary) === JSON.stringify(y?.summary), `${tag}: ${label} birebir (${x?.rows?.length} hesap; ad farkı yalnız ${[...allowed].join(", ") || "—"})`, firstDiff(y?.rows || [], x?.rows || []));
    }
    check(now.tarama?.ok === true, `${tag}: Mutabakat Testi tutarlı (yeni kod; ${JSON.stringify(now.tarama)})`);
  }
  console.log(`\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
  process.exit(failed ? 1 : 0);
}

// "esit": BU kodla, her şirket kopyada açılır; kilit varsa (göç 47'nin bekleyen 2.4.9 koşusu) donması beklenir, yoksa --gun'e kilitlenir (uç). Sonra donmuş = canlı türetme
// (kilit gününe kadar, madde madde), karma = canlı (bütün geçmiş), mizan yıl yıl aynı, Mutabakat Testi tutarlı; ardından kilit bir yıl geri çekilip yeniden konur (ikinci koşu)
// ve aynı denetimler yinelenir.
async function equal() {
  const veri = path.resolve(opt("veri"));
  const saved = JSON.parse(readFileSync(path.join(veri, NOW_FILE), "utf8"));
  const self = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const { startTestServer, loginAdmin } = await fromRoot(self, "test/helpers.mjs");
  const lib = await fromRoot(self, "server/lib/general-ledger.mjs");
  const work = mkdtempSync(path.join(veri, "..", "donma-esit-"));
  let tests = 0;
  let failed = 0;
  const check = (ok, text, detail = "") => {
    tests += 1;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}${!ok && detail ? `\n  # ${String(detail).slice(0, 400)}` : ""}`);
  };
  try {
    for (const company of companyDirs(path.join(veri, "data"))) {
      const copy = path.join(work, company.code, "data");
      cpSync(company.dir, copy, { recursive: true });
      const server = await startTestServer({ dataDir: copy, backupDir: path.join(work, company.code, "backups"), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
      try {
        const admin = await loginAdmin(server);
        const S = server.app.ledger.snapshots;
        await S.runPending();
        let lock = server.app.context.period.lockedUntil();
        const migrated = server.app.store.get("SELECT rule_version AS rule FROM ledger_snapshot_runs WHERE reason = 'migration'")?.rule || "";
        if (!lock) {
          const day = opt("gun") || monthEndBefore(shiftDay(dayOf(saved.now), -30));
          const response = await admin.put("/api/admin/period-lock", { lockedUntil: day, force: true });
          if (response.status !== 200) throw new Error(`${company.code}: kilit ${response.status} ${JSON.stringify(response.data).slice(0, 200)}`);
          lock = day;
        }
        const tag = `şirket ${company.code} (kilit ${lock}${migrated ? `, göç koşusu ${migrated}` : ""})`;
        const verify = label => {
          const live = server.app.ledger.build();
          const frozen = canon(S.entries());
          const want = canon(live.filter(entry => entry.date <= lock));
          check(S.state().coverage === lock && S.state().pending === null, `${tag} ${label}: kapsam = kilit`);
          check(JSON.stringify(frozen) === JSON.stringify(want), `${tag} ${label}: donmuş = canlı (${frozen.length} / ${want.length} madde)`, frozen.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(want[i])));
          check(JSON.stringify(canon(server.app.ledger.book())) === JSON.stringify(canon(live)), `${tag} ${label}: karma = canlı (${live.length} madde)`);
          const years = [...new Set(live.map(entry => entry.date.slice(0, 4)))].sort();
          const book = server.app.ledger.book();
          const same = years.every(year => JSON.stringify(lib.trialBalance(book, { from: `${year}-01-01`, to: `${year}-12-31` })) === JSON.stringify(lib.trialBalance(live, { from: `${year}-01-01`, to: `${year}-12-31` })));
          check(same && JSON.stringify(lib.trialBalance(book)) === JSON.stringify(lib.trialBalance(live)), `${tag} ${label}: mizan yıl yıl (${years.join(" ")}) ve bütün zaman aynı`);
          const sqlSame = [...years.map(year => [`${year}-01-01`, `${year}-12-31`]), ["", ""], ["", lock], [lock, ""]].every(([from, to]) => JSON.stringify(S.trial({ from, to })) === JSON.stringify(lib.trialBalance(live, { from, to })));
          check(sqlSame, `${tag} ${label}: karma mizanın SQL yolu (snapshots.trial) = canlı mizan (yıl yıl, kilit günü, bütün zaman)`);
        };
        verify("ilk");
        const scan = await admin.get("/api/workspace/ledger/integrity");
        check(scan.status === 200 && !scan.data.data.checks.some(item => item.code.startsWith("ledger:") && !item.ok), `${tag}: Mutabakat Testi'nde donmuş defter bulgusu yok (${JSON.stringify(scan.data.data?.checks?.filter(item => !item.ok).map(item => item.code))})`);
        const back = `${String(Number(lock.slice(0, 4)) - 1)}-12-31`;
        const r1 = await admin.put("/api/admin/period-lock", { lockedUntil: back, force: true });
        const r2 = await admin.put("/api/admin/period-lock", { lockedUntil: lock, force: true });
        check(r1.status === 200 && r2.status === 200, `${tag}: geri çek (${back}) ve yeniden kilitle`);
        verify("yeniden");
      } finally {
        await server.close();
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
  process.exit(failed ? 1 : 0);
}

if (command === "esit") await equal();
else if (command === "kilitle") await lockData();
else if (command === "dok") await dump();
else if (command === "karsilastir") compare();
else throw new Error("komut: kilitle | dok | karsilastir");
