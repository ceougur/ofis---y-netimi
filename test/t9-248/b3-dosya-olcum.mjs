// 2.4.9 B3 ölçümü (docs/2.4.9-tasarim/B3-B4.md §B3-6; ders 15, 24, 47): bir veri klasörünün (içinde data/) TAZE KOPYASINDA şirket dosyasının (001) yeri ve açılışı.
// Ürün kodu DEĞİŞMEZ; yalnız ölçer. npm test'e girmez. Kod kökü bu betiğin deposu (ayrı kopyada eski kod da ölçülür — ders 23; .git yoksa "git yok").
//   1) statik (program kapalı; kopyada): dosya boyu, sayfa, boş liste, dbstat (wa_jobs, wa_job_pdfs, bütün dosya: toplam / boş / yük), PDF'i duran iş sayısı,
//      VACUUM INTO (yedeğin yaptığı) süresi ve boyu
//   2) --goc: aynı kopyada runMigrations doğrudan (göç öncesi tam yedek + bekleyen göçler): yedek süresi, her göçün süresi; göçten sonra 1)'in sayımları yeniden
//   3) açılış (ikinci taze kopya; gerçek program, test/t9-248/ortak.mjs kurulum): açılış süresi (göç dahil), olay döngüsü en çok; bakım turu ×5 (süre + olay döngüsü en çok)
// Kullanım: node test/t9-248/b3-dosya-olcum.mjs --veri <klasör> --is <çalışma klasörü> --json <dosya> [--goc]
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { KOK, boyutlar, kurulum, log, mb } from "./ortak.mjs";

const argv = process.argv.slice(2);
const opt = (ad, v) => {
  const i = argv.indexOf(`--${ad}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : v;
};
const VERI = opt("veri");
const IS = opt("is");
const CIKTI = opt("json");
const GOC = argv.includes("--goc");
const commitOf = () => {
  try {
    return execSync("git rev-parse HEAD", { cwd: KOK, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return `git yok (${KOK})`;
  }
};
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const msOf = ns => Math.round((ns / 1e6) * 10) / 10;
const sonuc = { commit: commitOf(), kok: KOK, node: process.version, veri: VERI, goc: GOC, basladi: new Date().toISOString() };

function statik(file) {
  const db = new DatabaseSync(file);
  try {
    const g = sql => db.prepare(sql).get();
    const tablo = name => {
      const r = g(`SELECT COUNT(*) AS sayfa, SUM(pgsize) AS bayt, SUM(unused) AS bos, SUM(payload) AS yuk FROM dbstat WHERE name = '${name}'`);
      return r.sayfa ? { sayfa: r.sayfa, mb: mb(r.bayt), bosMb: mb(r.bos), yukMb: mb(r.yuk) } : null;
    };
    const tum = g("SELECT SUM(pgsize) AS bayt, SUM(unused) AS bos, SUM(payload) AS yuk FROM dbstat");
    let pdfSatir = null;
    try {
      pdfSatir = g("SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(pdf)), 0) AS b FROM wa_job_pdfs");
    } catch {
      pdfSatir = null;
    }
    return {
      dosyaMb: mb(statSync(file).size),
      surum: g("PRAGMA user_version").user_version,
      sayfaBoyu: g("PRAGMA page_size").page_size,
      sayfa: g("PRAGMA page_count").page_count,
      bosListe: g("PRAGMA freelist_count").freelist_count,
      bosListeMb: mb(g("PRAGMA freelist_count").freelist_count * g("PRAGMA page_size").page_size),
      wa_jobs: tablo("wa_jobs"),
      wa_job_pdfs: tablo("wa_job_pdfs"),
      tumDosya: { mb: mb(tum.bayt), bosMb: mb(tum.bos), yukMb: mb(tum.yuk) },
      isSatiri: g("SELECT COUNT(*) AS n FROM wa_jobs").n,
      satirdaPdf: g("SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(pdf_blob)), 0) AS b FROM wa_jobs WHERE pdf_blob IS NOT NULL"),
      pdfTablosu: pdfSatir,
    };
  } finally {
    db.close();
  }
}

let hata = null;
try {
  rmSync(IS, { recursive: true, force: true });
  mkdirSync(IS, { recursive: true });
  // 1) statik — kaynak klasöre DOKUNULMAZ (başka ajan da okuyor): önce kopya.
  const kopya = path.join(IS, "statik");
  cpSync(path.join(VERI, "data"), path.join(kopya, "data"), { recursive: true });
  const file = path.join(kopya, "data", "destekofis.sqlite");
  let t = performance.now();
  sonuc.statik = statik(file);
  sonuc.statik.sayimMs = Math.round(performance.now() - t);
  const vac = path.join(kopya, "vacuum-into.sqlite");
  t = performance.now();
  {
    const db = new DatabaseSync(file);
    db.exec(`VACUUM INTO '${vac.replace(/'/g, "''")}'`);
    db.close();
  }
  sonuc.statik.vacuumInto = { ms: Math.round(performance.now() - t), mb: mb(statSync(vac).size) };
  rmSync(vac, { force: true });
  log("statik", JSON.stringify(sonuc.statik));
  // 2) göç — programın kendi runMigrations'ı (göç öncesi tam yedek dahil), aynı kopyada.
  if (GOC) {
    const { openDatabase, createStore } = await import(pathToFileURL(path.join(KOK, "server/lib/db.mjs")).href);
    const { runMigrations } = await import(pathToFileURL(path.join(KOK, "server/lib/migrations.mjs")).href);
    const marks = [];
    const db = openDatabase(file);
    const store = createStore(db);
    const t0 = performance.now();
    const out = runMigrations(store, { backupDir: path.join(kopya, "backups"), log: { info: message => marks.push({ ms: Math.round(performance.now() - t0), message }), warn: () => {}, error: () => {} } });
    const toplamMs = Math.round(performance.now() - t0);
    db.close();
    sonuc.goc = { from: out.from, to: out.to, applied: out.applied, toplamMs, adimlar: marks, yedek: out.backup ? { ad: out.backup.name, mb: mb(out.backup.size || 0) } : null };
    sonuc.gocSonrasi = statik(file);
    log("göç", JSON.stringify(sonuc.goc), JSON.stringify(sonuc.gocSonrasi));
  }
  rmSync(kopya, { recursive: true, force: true });
  // 3) açılış + bakım — gerçek program, ikinci taze kopya (kurulum kopyalar).
  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();
  const ctx = await kurulum({ veri: VERI, is: path.join(IS, "acilis"), saat: { time: "2026-11-02T10:00:00+03:00", fixed: true }, isci: "manual", aralik: 0, tier: "TIER_2K", onEk: `b3${Date.now().toString(36)}` });
  try {
    sonuc.acilis = { ms: ctx.acilisMs, olayDongusuEnCokMs: msOf(eld.max), surum: ctx.app.store.get("PRAGMA user_version").user_version };
    sonuc.bakim = [];
    for (let k = 0; k < 5; k += 1) {
      eld.reset();
      const b = performance.now();
      await ctx.wa.scheduler.maintain();
      sonuc.bakim.push({ ms: Math.round(performance.now() - b), olayDongusuEnCokMs: msOf(eld.max) });
    }
    log("açılış", JSON.stringify(sonuc.acilis), "bakım", JSON.stringify(sonuc.bakim));
  } finally {
    await ctx.kapat();
  }
  sonuc.acilisSonrasiDosyalar = Object.fromEntries(Object.entries(boyutlar(path.join(IS, "acilis", "data"))).filter(([k]) => /sqlite/.test(k)).map(([k, v]) => [k, mb(v)]));
  rmSync(path.join(IS, "acilis"), { recursive: true, force: true });
  denetle("statik sayım", Boolean(sonuc.statik?.wa_jobs));
  denetle("açılış ve 5 bakım turu", sonuc.bakim?.length === 5);
  if (GOC) denetle("göç koştu", Array.isArray(sonuc.goc?.applied));
} catch (error) {
  hata = error;
  log("HATA", error?.stack || error);
  denetle("ölçüm hatasız bitti", false, String(error?.message || error));
} finally {
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, JSON.stringify(sonuc, null, 2));
  if (existsSync(IS)) rmSync(IS, { recursive: true, force: true });
  const gecen = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${gecen}\n# fail ${denetimler.length - gecen}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = !hata && gecen === denetimler.length ? 0 : 1;
}
