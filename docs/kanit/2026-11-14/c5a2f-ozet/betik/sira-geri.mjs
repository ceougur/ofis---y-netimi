// RASTGELE SIRA (ders 17): aday kararları (onay / ret / Geri Al / toplu), kilit ilerletme / geri alma, düzeltme fişi, ters kayıt, gün ilerlemesi (yıl dönümü).
// Her adımdan sonra değişmezler (kodu görmeden, girilen tutarlardan; ders 5):
//   I1 aynı kural: Yönetim satırının kalanı = ön izlemenin toplamı (kilit var, dondurma yok, satırda düzeltme bilgisi var)
//   I2 kayıttan sonra ön izleme 'nothing'
//   I3 SESSİZ YANLIŞ: program 'tamam' diyorsa (satır yok ya da ok) defter = karar: 500 = 0; 519 = −Σ(aday + onay); 602 + 671 + 681 (bütün yıllar) = −Σ ret;
//      2026'da 671 = 681 = 0 (bütün fark 2026'nın); 2027+ 602 = 0 (2027'de 602 hareketi yok)
//   I4 öneri: 2027+ tarihli fişte 602 yok; 2026 tarihli fişte 671 / 681 yok
// Kullanım: KOD=<kod> node sira.mjs <şablon klasörü> <tohum başı> <tohum sayısı> <adım sayısı>
import { cpSync, rmSync, readFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { S, ROOT, NB, must, rid, lt, integ } from "./ortak.mjs";
const { createClock } = await import(pathToFileURL(path.join(ROOT, "server/lib/clock.mjs")).href);
const [tpl, seed0 = "1", nSeeds = "10", nSteps = "14"] = process.argv.slice(2);
const ids = JSON.parse(readFileSync(path.join(tpl, "ids.json"), "utf8"));
const AMT = { r1: 700, r2: 300, r3: 50 };
const DATE = { r1: "2026-10-02", r2: "2026-11-10", r3: "2026-12-30" };
const URL = "/api/admin/ledger/rule-diff-correction";
const OR = "/api/workspace/opening-review";
const DAYS = ["2027-01-10", "2027-01-20", "2028-01-05"];
const LOCKS = ["2026-11-30", "2026-12-30", "2026-12-31", "2026-12-31", "2027-01-09", ""];
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
let violations = 0;
const seen = { later: 0, ownYear: 0, correctedLater: 0 };
const tally = {};
for (let seed = Number(seed0); seed < Number(seed0) + Number(nSeeds); seed += 1) {
  const r = rng(seed * 7919);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const root = mkdtempSync(path.join(NB, `sira-${seed}-`));
  cpSync(tpl, root, { recursive: true });
  let day = DAYS[0];
  const clock = createClock({ time: `${day}T12:00:00+03:00`, fixed: true });
  const server = await S.bootVersion(S.CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, integrityScan: false });
  const { app } = server;
  const log = [];
  const state = () => Object.fromEntries(Object.keys(AMT).map(k => [k, app.store.get("SELECT opening_review r FROM account_entries WHERE id = ?", ids[k]).r]));
  const fail = (code, msg) => {
    violations += 1;
    tally[code] = (tally[code] || 0) + 1;
    console.log(`  !! tohum ${seed} ${code}: ${msg}\n     sıra: ${log.join(" → ")}`);
  };
  const reversedLater = () => Boolean(app.store.get("SELECT 1 AS f FROM ledger_vouchers r JOIN ledger_vouchers o ON o.id = r.reversal_of WHERE o.type = 'rule-diff-correction' AND substr(r.date,1,4) > substr(o.date,1,4)"));
  try {
    await app.ledger.snapshots.runPending();
    const api = await server.login();
    for (let step = 0; step < Number(nSteps); step += 1) {
      const kind = pick(["decide", "decide", "bulk", "lock", "lock", "post", "post", "reverse", "day"]);
      let note = "";
      if (kind === "decide") {
        const k = pick(["r1", "r2", "r3"]);
        const dec = pick(["confirm", "reject", "undo"]);
        const res = await api.post(`${OR}/${ids[k]}`, { decision: dec });
        note = `${k}:${dec}=${res.status}`;
      } else if (kind === "bulk") {
        const ks = ["r1", "r2", "r3"].filter(() => r() < 0.6);
        if (!ks.length) ks.push("r2");
        const dec = pick(["confirm", "reject", "undo"]);
        const res = await api.post(OR, { ids: ks.map(k => ids[k]), decision: dec });
        note = `toplu[${ks.join(",")}]:${dec}=${res.status}`;
      } else if (kind === "lock") {
        const L = pick(LOCKS);
        const res = await api.put("/api/admin/period-lock", { lockedUntil: L });
        await app.ledger.snapshots.runPending();
        note = `kilit ${L || "yok"}=${res.status}`;
      } else if (kind === "post") {
        const v = (await api.get(URL)).data;
        if (!v.disabled) {
          const y = Number(v.date.slice(0, 4));
          for (const line of v.lines) {
            if (y >= 2027 && /^(6|7)/.test(line.account) && !["671", "681"].includes(line.account)) fail("I4", `${v.date} fişinde ${line.account} (${lt(v.lines)})`);
            if (y === 2026 && ["671", "681"].includes(line.account)) fail("I4", `${v.date} fişinde ${line.account} (${lt(v.lines)})`);
          }
          const res = await api.post(URL, { requestId: rid(), digest: v.digest, confirm: true });
          note = `fiş ${v.date} [${lt(v.lines)}]=${res.status}`;
          if (res.status === 200) {
            const v2 = (await api.get(URL)).data;
            if (v2.code !== "rule-diff-nothing") fail("I2", `kayıttan sonra ön izleme ${v2.code} ${lt(v2.lines)}`);
          }
        } else note = `fiş yok (${v.code})`;
      } else if (kind === "reverse") {
        const act = app.store.all("SELECT v.id, v.date FROM ledger_vouchers v WHERE v.type = 'rule-diff-correction' AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id)");
        if (act.length) {
          const t = pick(act);
          const res = await api.post(`/api/admin/ledger/vouchers/${t.id}/reverse`, { requestId: rid(), date: day });
          note = `ters ${t.date}→${day}=${res.status}${res.status !== 200 ? ` ${res.data?.code || ""}` : ""}`;
        } else note = "ters yok";
      } else {
        const i = DAYS.indexOf(day);
        if (i < DAYS.length - 1) {
          day = DAYS[i + 1 + Math.floor(r() * (DAYS.length - 1 - i))];
          clock.freeze(`${day}T12:00:00+03:00`);
        }
        note = `gün ${day}`;
      }
      log.push(note);
      // değişmezler
      const lock = app.period.lockedUntil();
      const cover = app.ledger.snapshots.coverage();
      const v = (await api.get(URL)).data;
      const row = (await integ(api)).item;
      const ruleYear = Number(((lock ? new Date(Date.parse(`${lock}T00:00:00Z`) + 86400000).toISOString() : day)).slice(0, 4));
      const later = app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers v WHERE v.type = 'rule-diff-correction' AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id) AND CAST(substr(v.date, 1, 4) AS INTEGER) > ?", ruleYear).n;
      if (lock && later) { seen.later += 1; if (v.code === "rule-diff-own-year") seen.ownYear += 1; if (row?.corrected) seen.correctedLater += 1; }
      if (lock && !["rule-diff-freezing", "rule-diff-no-lock"].includes(v.code) && row?.correction) {
        if ((row.correction.remainderMinor || 0) !== (v.totalMinor || 0)) fail("I1", `satır kalanı ${row.correction.remainderMinor / 100} ≠ ön izleme ${v.totalMinor / 100} (${lt(v.lines)})`);
      }
      const fine = !row || row.ok === true;
      if (fine && !app.ledger.snapshots.state().pending) {
        const st = state();
        const all = app.ledger.book({});
        const sum = (acc, from = "0000", to = "9999") => all.filter(e => e.date >= from && e.date <= to).reduce((s, e) => s + e.lines.filter(l => l.account === acc).reduce((t, l) => t + l.debit - l.credit, 0), 0) / 100;
        const rej = Object.keys(AMT).filter(k => st[k] === "rejected").reduce((s, k) => s + AMT[k], 0);
        const keep = Object.keys(AMT).filter(k => st[k] !== "rejected").reduce((s, k) => s + AMT[k], 0);
        const res = sum("602") + sum("671") + sum("681");
        const errs = [];
        if (sum("500") !== 0) errs.push(`500 ${sum("500")}`);
        if (sum("519") !== -keep) errs.push(`519 ${sum("519")} ≠ ${-keep}`);
        if (Math.round(res * 100) !== Math.round(-rej * 100)) errs.push(`602+671+681 ${res} ≠ ${-rej}`);
        const y26 = [sum("671", "2026-01-01", "2026-12-31"), sum("681", "2026-01-01", "2026-12-31")];
        if (y26[0] || y26[1]) errs.push(`2026 671/681 ${y26.join("/")}`);
        const p27 = sum("602", "2027-01-01", "2099-12-31");
        if (p27) errs.push(`2027+ 602 ${p27}`);
        if (errs.length) fail(reversedLater() ? "I3-S180" : "I3", `program tamam diyor (${row ? row.name : "satır yok"}) ama ${errs.join("; ")} | karar ${JSON.stringify(st)} kilit ${lock || "yok"} örtü ${cover || "yok"} gün ${day}`);
      }
    }
    console.log(`tohum ${seed}: ${log.join(" → ")}`);
  } catch (error) {
    console.log(`tohum ${seed} HATA ${error.stack}\n  sıra: ${log.join(" → ")}`);
    violations += 1;
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(`SONUÇ: ihlal ${violations} ${JSON.stringify(tally)} · fişin yılı > eşleme yılı olan adım ${seen.later} (own-year ${seen.ownYear}, Düzeltildi ${seen.correctedLater}) (kod ${ROOT})`);
