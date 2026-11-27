// 2.5.1 D4-ÖN İş 2 — belge temizliği şirketin kayıtlı arşivlerinin belge kayıtlarını görür (DEVIR-PLANI G8; docs/devir/D2-ALTYAPI-TASARIM.md §12;
// docs/devir/2.5.1-DEVAM/d4on-rapor.md §0, maddeler 9–16). Arşiv ile çalışma yılı AYNI belgeler/ klasörünü paylaşır: arşivin gösterdiği dosya, çalışma yılında
// silinip 30 günü geçse de diskten gitmemeli.
// Düzenek D2'nin arşiv benzetimi (test/devir-d2-yardimci.mjs makeArchive: şirket dosyasının tutarlı kopyası + arşiv kaydı). Belgeler programın API'siyle yüklenir ve
// silinir; yalnız silinme zamanı ve dosya zamanı GÖRELİ geçmişe çekilir (ders 13: temizlik gerçek saate bakar — Date.now()). Temizlik programın KENDİ yolundan
// (açılıştan 5 sn sonra, routes/documents.mjs) koşar: sunucu kapatılıp yeniden açılır; sayılar DİSKTEN ve veri tabanından okunur (ders 3, 12).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { renameWithRetry } from "../server/lib/app-layout.mjs";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { createDocumentStore } from "../server/lib/documents.mjs";
import { companyOf, makeArchive } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const DAY = 86_400_000;
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4on-belge-"));
  roots.push(dir);
  return dir;
};
const start = dir => startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups") });
const pdf = label => Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const shaOf = buffer => createHash("sha256").update(buffer).digest("hex");
const ago = days => new Date(Date.now() - days * DAY).toISOString();
const KEY = "2026/901";

async function upload(client, q, name, body) {
  const response = await client.raw("POST", `/api/workspace/cases/${encodeURIComponent(KEY)}/documents?name=${encodeURIComponent(name)}${q ? `&${q.slice(1)}` : ""}`, { body, headers: { "content-type": "application/octet-stream", "x-hof-upload": "1" } });
  assert.equal(response.status, 200, `${name}: ${response.status} ${response.buffer.toString("utf8").slice(0, 200)}`);
  return response.data.data.id;
}
/** Belgeyi programın silme ucuyla siler; kimliği döndürür. */
async function remove(client, q, id) {
  const response = await client.del(`/api/workspace/documents/${id}${q}`);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return id;
}
const storeOf = (app, id) => (id === ROOT_COMPANY_ID ? app.store : app.openCompany(id).store);
const docsDir = (app, id) => path.join(app.companies.dirsOf(companyOf(app, id)).dataDir, "belgeler");
const fileOf = (dir, sha) => path.join(dir, sha.slice(0, 2), sha);
function ageAll(dir, days = 40) {
  const old = new Date(Date.now() - days * DAY);
  for (const bucket of readdirSync(dir)) for (const name of readdirSync(path.join(dir, bucket))) utimesSync(path.join(dir, bucket, name), old, old);
}
async function waitFor(label, fn, ms = 30_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (fn()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`beklenen olmadı (${ms} ms): ${label}`);
}
/** Bu sürecin açık dosya tutamaklarından verilen dosyaları gösterenler (yalnız Linux; başka platformda null). */
function openHandlesTo(files) {
  if (process.platform !== "linux") return null;
  const wanted = new Set(files.map(file => path.resolve(file)));
  const found = [];
  for (const fd of readdirSync("/proc/self/fd")) {
    try {
      const target = readlinkSync(`/proc/self/fd/${fd}`);
      if (wanted.has(target) || [...wanted].some(file => target.startsWith(`${file}-`))) found.push(target);
    } catch {
      // kapanmış tutamak
    }
  }
  return found;
}

describe("D4-ÖN: belge temizliği arşivin belge kayıtlarını görür", () => {
  test("iki arşiv yılı (002) + arşivsiz 001: arşivin gösterdiği dosya kalır (ilk ve son arşiv, arşivin 30 günü geçmemiş silinmiş kaydı), hiçbir kaydın göstermediği silinir; 001 bugünkü gibi; arşiv bağlantısı kapanır, arşiv dosyası değişmez", async () => {
    const dir = workDir();
    let server = await start(dir);
    let second;
    const sha = {};
    let archives;
    let dir002;
    let dir001;
    try {
      const admin = await loginAdmin(server);
      const created = await admin.post("/api/companies", { name: "Belge İkinci" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      second = created.data.data.company.id;
      const q = `?hofCompany=${second}`;
      const live = () => storeOf(server.app, second);
      const setDeleted = (id, at) => live().run("UPDATE case_documents SET deleted_at = ? WHERE id = ?", at, id);
      // 2024 arşivi: yalnız P2024'ü gösterir.
      const p2024 = await upload(admin, q, "Sözleşme 2024.pdf", pdf("2024"));
      sha.p2024 = shaOf(pdf("2024"));
      const a2024 = await makeArchive(server.app, second, { year: "2024", runId: "d4on-2024" });
      setDeleted(await remove(admin, q, p2024), ago(40)); // çalışma yılında çoktan silindi → 2025 arşivinde de "silineli 40 gün" (göstermez)
      // 2025 arşivi: P2025 (silinmemiş), PREC (arşivde silineli 5 gün → gösterir), PNONE (arşivde silineli 40 gün → göstermez).
      const p2025 = await upload(admin, q, "Dilekçe 2025.pdf", pdf("2025"));
      const prec = await upload(admin, q, "Yeni Silinen.pdf", pdf("rec"));
      const pnone = await upload(admin, q, "Kimsenin Değil.pdf", pdf("none"));
      Object.assign(sha, { p2025: shaOf(pdf("2025")), prec: shaOf(pdf("rec")), pnone: shaOf(pdf("none")) });
      setDeleted(await remove(admin, q, prec), ago(5));
      setDeleted(await remove(admin, q, pnone), ago(40));
      const a2025 = await makeArchive(server.app, second, { year: "2025", runId: "d4on-2025" });
      // Çalışma yılında hepsi silineli 30 günü geçti; PLIVE çalışma yılında duruyor (denetim).
      setDeleted(await remove(admin, q, p2025), ago(40));
      setDeleted(prec, ago(40));
      await upload(admin, q, "Duran Belge.pdf", pdf("live"));
      sha.plive = shaOf(pdf("live"));
      // 001 (arşivsiz): aynı içerik (P2024 ile aynı özet) silineli 40 gün → bugünkü gibi silinir; 002'nin arşivi 001'i korumaz.
      const d001 = await remove(admin, "", await upload(admin, "", "Ortak İçerik.pdf", pdf("2024")));
      storeOf(server.app, ROOT_COMPANY_ID).run("UPDATE case_documents SET deleted_at = ? WHERE id = ?", ago(40), d001);
      archives = [a2024, a2025];
      dir002 = docsDir(server.app, second);
      dir001 = docsDir(server.app, ROOT_COMPANY_ID);
      assert.deepEqual(server.app.companies.archivesOf(second).map(entry => entry.year), ["2024", "2025"]);
      assert.deepEqual(server.app.companies.archivesOf(ROOT_COMPANY_ID), []);
    } finally {
      await server.close();
    }
    ageAll(dir002);
    ageAll(dir001);
    const archiveBytes = archives.map(item => readFileSync(item.file));
    server = await start(dir);
    try {
      assert.equal(docsDir(server.app, second), dir002);
      const admin = await loginAdmin(server);
      assert.equal((await admin.get(`/api/workspace/cash?hofCompany=${second}`)).status, 200, "002 açıldı (temizliği 5 sn sonra)");
      // Temizlik bitti: hiçbir kaydın göstermediği dosyalar diskten gitti (002'de PNONE, 001'de D001). Temizlik tek eşzamanlı geçiştir.
      await waitFor("002 PNONE ve 001 D001 silinir", () => !existsSync(fileOf(dir002, sha.pnone)) && !existsSync(fileOf(dir001, sha.p2024)));
      const kept = Object.fromEntries(["p2024", "p2025", "prec", "plive"].map(name => [name, existsSync(fileOf(dir002, sha[name]))]));
      assert.deepEqual(kept, { p2024: true, p2025: true, prec: true, plive: true }, "arşivin (2024 / 2025 / arşivde 30 günü geçmemiş silinmiş kayıt) ve çalışma yılının gösterdiği dosyalar kalır");
      const remaining = readdirSync(dir002).flatMap(bucket => readdirSync(path.join(dir002, bucket))).sort();
      assert.deepEqual(remaining, [sha.p2024, sha.p2025, sha.prec, sha.plive].sort(), "002'de 4 dosya kaldı, 1 silindi");
      assert.deepEqual(readdirSync(dir001).flatMap(bucket => readdirSync(path.join(dir001, bucket))), [], "001'de (arşivsiz) dosya kalmadı");
      assert.equal(storeOf(server.app, second).get("SELECT COUNT(*) AS n FROM case_documents WHERE deleted_at IS NOT NULL").n, 0, "çalışma yılının silineli 30 günü geçen kayıtları kalktı (bugünkü gibi)");
      // D (ders 48): arşiv bağlantısı kapandı — Linux'ta süreç tutamakları, her platformda arşiv dosyası taşınabiliyor (Windows'ta açık tutamak taşımayı düşürür).
      const handles = openHandlesTo(archives.map(item => item.file));
      if (handles) assert.deepEqual(handles, [], "temizlikten sonra arşive açık tutamak yok (/proc/self/fd)");
      for (const item of archives) {
        renameWithRetry(item.file, `${item.file}.tasima-denemesi`);
        renameWithRetry(`${item.file}.tasima-denemesi`, item.file);
      }
      // Temizlik arşive yazmaz: bayt bayt aynı, yan dosya oluşmadı.
      archives.forEach((item, index) => assert.ok(readFileSync(item.file).equals(archiveBytes[index]), `${item.year} arşivi değişmedi`));
      for (const item of archives) assert.deepEqual(readdirSync(path.dirname(item.file)).filter(name => /-(wal|shm|journal)$/.test(name)), [], `${item.year} arşivinin yanında günlük dosyası yok`);
    } finally {
      await server.close();
    }
  });

  test("açılamayan (bozuk) arşiv kaydı: o şirkette hiçbir belge dosyası silinmez (yalnız eski .tmp artığı ve silineli kayıt); arşiv dosyası olduğu gibi kalır", async () => {
    const dir = workDir();
    let server = await start(dir);
    let second;
    let target;
    let broken;
    let dir002;
    try {
      const admin = await loginAdmin(server);
      second = (await admin.post("/api/companies", { name: "Bozuk Arşivli" })).data.data.company.id;
      const q = `?hofCompany=${second}`;
      const archive = await makeArchive(server.app, second, { year: "2025", runId: "d4on-bozuk" }); // arşiv belgeden ÖNCE: belgeyi göstermez
      const id = await upload(admin, q, "Silinen.pdf", pdf("bozuk"));
      target = shaOf(pdf("bozuk"));
      await remove(admin, q, id);
      storeOf(server.app, second).run("UPDATE case_documents SET deleted_at = ? WHERE id = ?", ago(40), id);
      broken = archive.file;
      dir002 = docsDir(server.app, second);
    } finally {
      await server.close();
    }
    writeFileSync(broken, Buffer.alloc(8192, 0x5a)); // bozuk (SQLite dosyası değil)
    const tmp = path.join(dir002, target.slice(0, 2), `${target}.1.2.tmp`);
    writeFileSync(tmp, "yarım yükleme artığı");
    ageAll(dir002);
    const brokenBytes = readFileSync(broken);
    server = await start(dir);
    try {
      const admin = await loginAdmin(server);
      assert.equal((await admin.get(`/api/workspace/cash?hofCompany=${second}`)).status, 200);
      await waitFor("002 temizliği koştu (eski .tmp silindi, silineli kayıt kalktı)", () => !existsSync(tmp) && storeOf(server.app, second).get("SELECT COUNT(*) AS n FROM case_documents").n === 0);
      assert.ok(existsSync(fileOf(dir002, target)), "arşiv okunamadı → belge dosyası silinmedi (güvenli taraf)");
      assert.ok(readFileSync(broken).equals(brokenBytes), "bozuk arşiv dosyasına dokunulmadı");
    } finally {
      await server.close();
    }
  });

  test("eksik ve kilitli arşiv dosyası: temizlik beklemeden 'gösteriyor' sayar, dosya kalır; kilit kalkınca ve arşiv göstermiyorsa silinir; arşivsiz (boş liste) bugünkü gibi", async () => {
    const dir = workDir();
    const server = await start(dir);
    try {
      const admin = await loginAdmin(server);
      const second = (await admin.post("/api/companies", { name: "Kilitli Arşivli" })).data.data.company.id;
      const q = `?hofCompany=${second}`;
      const archive = await makeArchive(server.app, second, { year: "2025", runId: "d4on-kilit" });
      const id = await upload(admin, q, "Silinen.pdf", pdf("kilit"));
      const target = shaOf(pdf("kilit"));
      await remove(admin, q, id);
      const store = storeOf(server.app, second);
      store.run("UPDATE case_documents SET deleted_at = ? WHERE id = ?", ago(40), id);
      const dir002 = docsDir(server.app, second);
      ageAll(dir002);
      const file = fileOf(dir002, target);
      const missing = path.join(path.dirname(path.dirname(archive.file)), "2024", "destekofis.sqlite");
      assert.ok(!existsSync(missing));
      const purgeWith = list => createDocumentStore({ dir: dir002, archives: () => list }).purge(store);
      // Eksik arşiv dosyası (kayıt var, dosya yok).
      purgeWith([{ year: "2024", file: missing }]);
      assert.ok(existsSync(file), "eksik arşiv → dosya kalır");
      assert.ok(!existsSync(missing), "eksik arşiv dosyası oluşturulmadı");
      // Kilitli arşiv (başka bağlantı yazma kilidi tutuyor): bekleme yok.
      const locker = new DatabaseSync(archive.file);
      let elapsed;
      try {
        locker.exec("BEGIN EXCLUSIVE");
        const before = Date.now();
        purgeWith([{ year: "2025", file: archive.file }]);
        elapsed = Date.now() - before;
      } finally {
        locker.exec("ROLLBACK");
        locker.close();
      }
      assert.ok(existsSync(file), "kilitli arşiv → dosya kalır");
      assert.ok(elapsed < 1500, `kilitli arşivde beklenmedi: ${elapsed} ms`);
      // Kilit kalktı: arşiv okunur, belgeyi göstermiyor → silinir.
      purgeWith([{ year: "2025", file: archive.file }]);
      assert.ok(!existsSync(file), "arşiv okunup göstermediği görülünce silinir");
      // Arşivsiz (boş liste): bugünkü davranış.
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, pdf("kilit"));
      ageAll(dir002);
      assert.deepEqual(purgeWith([]), { rows: 0, files: 1 });
      assert.ok(!existsSync(file));
    } finally {
      await server.close();
    }
  });
});
