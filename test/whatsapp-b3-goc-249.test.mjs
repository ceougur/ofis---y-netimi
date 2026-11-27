// 2.4.9 B3 (docs/2.4.9-tasarim/B3-B4.md §B3-3 A, §B3-5 T3 / T4; ANA OTURUM ONAYI 03.11.2026): dondurulmuş WhatsApp PDF'i işin satırından (wa_jobs.pdf_blob, v41) ayrı
// tabloya (wa_job_pdfs, göç v45) taşınır. ESKİ SÜRÜM VERİSİ v2.4.8'in GERÇEK koduyla, programın KENDİ API'si ve işçisiyle üretildi (test/fixtures/whatsapp-pdf-v248/uret.mjs.txt;
// CLAUDE.md TEST VERİSİ kuralı; eski kod ayrı kopyada — ders 23): iki şirket, 002'de C kabul + bakım (PDF yok), A 131056 → Duraklatıldı (PDF dosyada), B kabul (bakım
// koşmamış → PDF dosyada); aynı anda 002'nin programla alınmış yedeği (v44). Gizli anahtar dosyaları (secret.key) fikstüre ALINMADI: 002'nin bağlantısı yeniden girilir.
// Denenen yollar: güncelleme sonrası açılış (göç v45 + Devam Et: AYNI PDF baytları gider; ikinci açılışta göç yok), yarıda kalmış göç, Geri Yükle (v44 yedeği yeni programa),
// Ayır (paylaşılan dosyanın kopyası). Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13). Beklenen baytlar (sha256) ve
// değişkenler fikstürün bilgi.json'undan (v2.4.8'in ürettiği), programın yeni kodundan okunmaz.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "whatsapp-pdf-v248");
const INFO = JSON.parse(readFileSync(path.join(FIXTURE, "bilgi.json"), "utf8"));
const sha = data => createHash("sha256").update(Buffer.from(data)).digest("hex");
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 11), fixed: true };
const DAY = 24 * 60 * 60_000;
const jobOf = name => INFO.live002.jobs.find(job => job.name === name);
const A = jobOf("Ayşe Yılmaz");
const B = jobOf("Burak Kaya");
const C = jobOf("Cem Demir");
const Q = `hofCompany=${encodeURIComponent(INFO.company.id)}`;

/** Fikstürü (v2.4.8 kurulumunun veri + yedek klasörü) yeni geçici köke açar. Dönüş: { root, dataDir, backupDir, file002, backupFile }. */
function unpack({ registry = null } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-b3-goc-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
  const put = (name, target) => writeFileSync(target, gunzipSync(readFileSync(path.join(FIXTURE, name))));
  put("001.sqlite.gz", path.join(dataDir, "destekofis.sqlite"));
  put("002.sqlite.gz", path.join(dataDir, "sirketler", "002", "destekofis.sqlite"));
  put("whatsapp-gonderim.sqlite.gz", path.join(dataDir, "whatsapp-gonderim.sqlite"));
  for (const name of ["sirketler.json", "sirketler.yedek.json"]) copyFileSync(path.join(FIXTURE, name), path.join(dataDir, name));
  if (registry) for (const name of ["sirketler.json", "sirketler.yedek.json"]) writeFileSync(path.join(dataDir, name), JSON.stringify(registry(JSON.parse(readFileSync(path.join(FIXTURE, name), "utf8"))), null, 2));
  const folder = path.join(backupDir, ...INFO.backup.folder.split("/").slice(1));
  mkdirSync(folder, { recursive: true });
  const backupFile = path.join(folder, INFO.backup.name);
  put("002-yedek.sqlite.gz", backupFile);
  return { root, dataDir, backupDir, file002: path.join(dataDir, "sirketler", "002", "destekofis.sqlite"), backupFile };
}
/** Salt okunur bakış (program açıkken de; WAL). */
function look(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
    return {
      version: db.prepare("PRAGMA user_version").get().user_version,
      hasPdfTable: tables.has("wa_job_pdfs"),
      pdfs: tables.has("wa_job_pdfs") ? Object.fromEntries(db.prepare("SELECT job_id, pdf FROM wa_job_pdfs").all().map(row => [row.job_id, sha(row.pdf)])) : null,
      blobs: db.prepare("SELECT COUNT(*) AS n FROM wa_jobs WHERE pdf_blob IS NOT NULL").get().n,
      states: Object.fromEntries(db.prepare("SELECT id, state FROM wa_jobs").all().map(row => [row.id, row.state])),
    };
  } finally {
    db.close();
  }
}
const ok = async (promise, label) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data.data;
};
/** Yeni programla açar; 002'nin bağlantısı yeniden girilir (gizli anahtar fikstürde yok — veri başka bilgisayardan gelmiş gibi; belirteç yeniden yazılır). */
async function open(dirs, options = {}) {
  const ctx = await startWa({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, maxCompanies: 3, connect: false, ack: false, office: null, now: NOW, ...options });
  // Sahte Meta yeniden başladı: kimlik sayaçları v2.4.8 koşusunun verdiklerinin (wamid.SAHTE0001…, 77…001…) ötesinden sürer (gerçek Meta'da wamid tekildir; düzenek).
  ctx.fake.state.sent = 1000;
  ctx.fake.state.mediaSeq = 1000;
  try {
    await ok(ctx.api.put(`${URLS.conn}?${Q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantısı");
  } catch (error) {
    await ctx.close();
    throw error;
  }
  return ctx;
}
const preMigration = dir => {
  const out = [];
  const walk = d => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(d, entry.name));
      // 2.5.0 Ç2: göç öncesi yedeğin adı zincirin SON göçünü taşır (v45 de koşar; 2.5.0'da son göç v46).
      else if (new RegExp(`pre-migration-v${LATEST_VERSION}`).test(entry.name)) out.push(entry.name);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
};
const uploads = ctx => ctx.fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path) && item.media).map(item => ({ name: item.media.filename, sha: sha(ctx.fake.state.media.get(item.media.id).data) }));

describe("2.4.9 B3 — v2.4.8 verisinde dondurulmuş PDF'in ayrı tabloya göçü (v45)", () => {
  it("fikstür v2.4.8'in ürettiği gibi: 002 v44, A Duraklatıldı + B kabul (bakımsız) PDF'leri satırda, C'nin PDF'i silinmiş; yedekte aynısı", () => {
    const dirs = unpack();
    try {
      const live = look(dirs.file002);
      const backup = look(dirs.backupFile);
      for (const [label, view] of [["canlı", live], ["yedek", backup]]) {
        assert.equal(view.version, 44, `${label}: v2.4.8 şeması`);
        assert.equal(view.hasPdfTable, false, `${label}: wa_job_pdfs henüz yok`);
        assert.equal(view.blobs, 2, `${label}: A ve B'nin PDF'i satırda`);
        assert.deepEqual([view.states[A.id], view.states[B.id], view.states[C.id]], ["paused", "accepted", "accepted"], label);
      }
      assert.ok(A.pdfSha && B.pdfSha && !C.pdfSha && A.pdfLength > 30_000, "bilgi.json: A/B PDF ~33 KB, C yok");
    } finally {
      removeTestDir(dirs.root);
    }
  });

  it("T3 güncelleme: yeni programla açılınca PDF'ler wa_job_pdfs'e AYNI baytlarla taşınır, satır boşalır; bakım kesinleşeni siler; 31 gün sonra Devam Et AYNI PDF'i gönderir; ikinci açılışta göç yok", async () => {
    const dirs = unpack();
    let ctx = null;
    try {
      ctx = await open(dirs);
      let view = look(dirs.file002);
      assert.equal(view.hasPdfTable, true, `göç v45: wa_job_pdfs tablosu yok (şema sürümü ${view.version})`);
      assert.equal(view.version, LATEST_VERSION, "şema son sürümde (v45 dahil; 2.5.0 Ç2: v46)");
      assert.deepEqual(view.pdfs, { [A.id]: A.pdfSha, [B.id]: B.pdfSha }, "A ve B'nin PDF'i bayt bayt aynı taşındı (durum süzgeci yok: kesinleşeni bakım siler)");
      assert.equal(view.blobs, 0, "wa_jobs.pdf_blob boşaltıldı");
      assert.equal(preMigration(dirs.backupDir).length, 2, `göçten önce iki şirketin tam yedeği (${preMigration(dirs.backupDir).join(", ")})`);
      // Açılış toparlaması işleri değiştirmedi: A hâlâ Duraklatıldı (PDF'i durur), B Meta Kabul Etti.
      assert.deepEqual([view.states[A.id], view.states[B.id]], ["paused", "accepted"]);
      await ctx.wa.scheduler.maintain();
      view = look(dirs.file002);
      assert.deepEqual(view.pdfs, { [A.id]: A.pdfSha }, "bakım: kesinleşen B'nin PDF'i silindi, açık A'nınki kaldı (eski kodun bakımıyla aynı yaşam döngüsü)");
      // Meta'daki kopyanın süresi dolmuş: Devam Et dondurulmuş baytları yeniden yükler (yeni hazırlık YOK — değişkenler ve PDF v2.4.8'deki ilk hazırlıktan).
      ctx.clock.advance(31 * DAY);
      await ok(ctx.api.post(`${URLS.batches}/${INFO.batches.AB}/resume?${Q}`, {}), "Devam Et");
      await ctx.drain();
      const jobs = await ok(ctx.api.get(`${URLS.batches}/${INFO.batches.AB}?${Q}`), "ayrıntı");
      assert.deepEqual(jobs.jobs.map(job => [job.accountName, job.state]), [["Ayşe Yılmaz", "accepted"], ["Burak Kaya", "accepted"]]);
      assert.deepEqual(uploads(ctx), [{ name: A.pdf_name, sha: A.pdfSha }], "Meta'ya bir kez A'nın v2.4.8'de dondurulmuş PDF'i (sha aynı)");
      assert.equal(ctx.fake.state.messages.length, 1, "yalnız A'ya bir ileti (B'ye yeniden gitmedi)");
      assert.deepEqual(ctx.fake.state.messages[0].params, JSON.parse(A.params_json), "ileti v2.4.8'deki ilk hazırlığın değişkenleriyle");
      assert.deepEqual(look(dirs.file002).pdfs, {}, "kabulden sonra bakım A'nın PDF'ini de sildi");
      await ctx.close();
      ctx = null;
      // İkinci açılış: göç yok (yeni göç öncesi yedeği alınmaz), şema v45.
      ctx = await open(dirs);
      assert.equal(look(dirs.file002).version, LATEST_VERSION);
      assert.equal(preMigration(dirs.backupDir).length, 2, "ikinci açılışta göç yok (yeni göç öncesi yedeği yok)");
    } finally {
      await ctx?.close();
      removeTestDir(dirs.root);
    }
  });

  it("T3 yarıda kalmış göç: tablo var + bir PDF taşınmış ama şema 44 (kesinti) → yeniden açılış göçü tamamlar; taşınmış satır korunur, eksik eklenir", async () => {
    const dirs = unpack();
    let ctx = null;
    try {
      const db = new DatabaseSync(dirs.file002);
      db.exec("CREATE TABLE wa_job_pdfs (job_id TEXT PRIMARY KEY, pdf BLOB NOT NULL, created_at TEXT NOT NULL) STRICT");
      db.prepare("INSERT INTO wa_job_pdfs (job_id, pdf, created_at) SELECT id, pdf_blob, prepared_at FROM wa_jobs WHERE id = ?").run(A.id);
      db.close();
      assert.equal(look(dirs.file002).version, 44, "ön koşul: şema 44");
      ctx = await open(dirs);
      const view = look(dirs.file002);
      assert.equal(view.version, LATEST_VERSION, "yarıda kalmış göç tamamlandı");
      assert.deepEqual(view.pdfs, { [A.id]: A.pdfSha, [B.id]: B.pdfSha });
      assert.equal(view.blobs, 0);
    } finally {
      await ctx?.close();
      removeTestDir(dirs.root);
    }
  });

  it("T4 geri yükleme: v2.4.8'de alınmış yedek (v44, A'nın PDF'i satırda) yeni programa geri yüklenince göç v45 yedek dosyasında koşar; eski toplu iş durur (§7a 26), bakım PDF'leri siler, ileti gitmez", async () => {
    const dirs = unpack();
    let ctx = null;
    try {
      ctx = await open(dirs);
      // Canlı dosyada A gönderilir (canlının wa_job_pdfs'i boşalır): geri yüklemeden sonra görülen PDF'ler YEDEKTEN gelmiş olmalı.
      ctx.clock.advance(31 * DAY);
      await ok(ctx.api.post(`${URLS.batches}/${INFO.batches.AB}/resume?${Q}`, {}), "Devam Et");
      await ctx.drain();
      const pre = look(dirs.file002);
      // Ön koşul PDF'in durduğu yerden bağımsız (eski kodda tablo yoktur): canlıda dondurulmuş PDF kalmadı.
      assert.ok(pre.blobs === 0 && (pre.pdfs === null || Object.keys(pre.pdfs).length === 0), `ön koşul: canlıda PDF kalmadı (${JSON.stringify(pre.pdfs)}, satırda ${pre.blobs})`);
      const sentBefore = ctx.fake.state.messages.length;
      ctx.clock.advance(60_000);
      const restored = await ok(ctx.api.post("/api/admin/backups/restore", { name: INFO.backup.name, company: INFO.company.id, confirm: INFO.company.code, password: ADMIN_PASSWORD }), "geri yükleme");
      assert.equal(restored.restored, true, JSON.stringify(restored));
      let view = look(dirs.file002);
      assert.equal(view.hasPdfTable, true, `geri yüklenen dosyada wa_job_pdfs yok (şema ${view.version})`);
      assert.equal(view.version, LATEST_VERSION);
      assert.deepEqual(view.pdfs, { [A.id]: A.pdfSha, [B.id]: B.pdfSha }, "yedekteki PDF'ler bayt bayt taşındı");
      assert.equal(view.blobs, 0);
      const detail = await ok(ctx.api.get(`${URLS.batches}/${INFO.batches.AB}?${Q}`), "ayrıntı");
      assert.equal(detail.state, "stopped", "geri yüklenen eski toplu iş yeniden başlamaz");
      assert.equal(detail.jobs.find(job => job.id === A.id).state, "stopped");
      await ctx.drain();
      view = look(dirs.file002);
      assert.deepEqual(view.pdfs, {}, "bakım: durdurulan / kesinleşen işlerin PDF'i silindi");
      assert.equal(ctx.fake.state.messages.length, sentBefore, "geri yüklemeden sonra ileti gitmedi");
    } finally {
      await ctx?.close();
      removeTestDir(dirs.root);
    }
  });

  it("T4 Ayır: paylaşılan 002 dosyası ayrılınca kopya (VACUUM INTO) wa_job_pdfs'i aynı baytlarla taşır", async () => {
    // 2.0.17–2.0.19'un bıraktığı kayıt (test/sirket-ayir-221.test.mjs kalıbı): 002'den SONRA açılmış 005 aynı klasörü gösteriyor → 005 ayrılır.
    const dirs = unpack({ registry: reg => ({ companies: [...reg.companies, { id: "sirket-b3-paylasan", code: "005", name: "Paylaşan Şirket", dir: "sirketler/002", createdAt: "2026-11-03T18:40:00.000Z", createdBy: "" }] }) });
    let ctx = null;
    try {
      ctx = await open(dirs);
      const separated = await ctx.api.post("/api/companies/sirket-b3-paylasan/separate", { confirm: "005", password: ADMIN_PASSWORD });
      assert.equal(separated.status, 200, JSON.stringify(separated.data).slice(0, 400));
      const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
      const moved = registry.find(item => item.id === "sirket-b3-paylasan");
      assert.ok(moved.dir && moved.dir !== "sirketler/002", `005 yeni klasörde (${moved.dir})`);
      const copy = look(path.join(dirs.dataDir, ...moved.dir.split("/"), "destekofis.sqlite"));
      assert.equal(copy.hasPdfTable, true, "ayrılan kopyada wa_job_pdfs yok");
      assert.deepEqual(copy.pdfs, { [A.id]: A.pdfSha, [B.id]: B.pdfSha }, "ayrılan kopyada PDF'ler aynı");
      assert.deepEqual(look(dirs.file002).pdfs, { [A.id]: A.pdfSha, [B.id]: B.pdfSha }, "dosyayı koruyan 002'de de aynı");
    } finally {
      await ctx?.close();
      removeTestDir(dirs.root);
    }
  });
});
