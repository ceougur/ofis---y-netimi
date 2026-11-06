// 2.5.0 D2 — devir altyapısının yönetim uçları (docs/devir/D2-ALTYAPI-TASARIM.md §8). Ortak katmanda (server/app.mjs HUB_ONLY: admin/devir, admin/maintenance);
// hepsi system.manage ister ve kullanıcının görebildiği şirketlerle sınırlıdır. Devri yapan uçlar (ön izleme, başlat, yenile, geri al) D3–D4'ün işi; burada:
//   GET  /api/admin/devir/archives          arşiv kayıtları + dosya durumu (özet hesaplanmaz) + sahipsiz arşiv klasörleri
//   POST /api/admin/devir/archives/verify   { company, year } — arşiv dosyasının bütünlük özeti (akışla; okuma işi)
//   GET  /api/admin/devir/backups           kalıcı devir yedekleri (Yönetim → Yedekler → Devir Yedekleri)
//   POST /api/admin/devir/backups/verify    { company, name } — devir yedeğinin her dosyası bildirgesiyle aynı mı
//   GET  /api/admin/maintenance             bakım kipindeki şirketler + önceki çalışmada yarıda kalan kip
import path from "node:path";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { archiveFileOf, archiveKey, readArchiveFacts, validYear } from "../lib/devir/archives.mjs";
import { commitPendingMigration, verifyArchive } from "../lib/devir/archive-open.mjs";
import { devirBackupRoot, verifyDevirBackup } from "../lib/devir/devir-backups.mjs";

const BACKUP_DIR_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9-]+$/;

export function registerDevirRoutes(router, { auth, companies, backups, maintenance, archiveView, archiveCache }) {
  const companyFor = (admin, id) => {
    const company = companies.get(text(id));
    if (!company || !companies.canAccess(admin, company.id)) throw new HttpError(404, "Şirket bulunamadı ya da bu şirketi görme yetkiniz yok.");
    return company;
  };

  router.get("/api/admin/devir/archives", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const visible = backups.accessible(admin);
    const ids = new Set(visible.map(company => company.id));
    ok(res, {
      archives: visible.flatMap(company => archiveView(company)),
      orphans: companies.orphanArchives().filter(item => ids.has(item.companyId)),
    });
  });

  router.post("/api/admin/devir/archives/verify", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const company = companyFor(admin, body.company);
    const year = text(body.year);
    if (!validYear(year)) throw new HttpError(400, "Arşiv yılı dört haneli olmalı (ör. 2026).");
    const entry = companies.archiveOf(company.id, year);
    if (!entry) throw new HttpError(404, `${year} arşivi bulunamadı.`, { code: "archive-not-found" });
    const file = archiveFileOf(companies.dirsOf(company).dataDir, year);
    const result = await verifyArchive({ file, entry, cache: archiveCache(), key: archiveKey(company.id, year) });
    // Diskten tanınmış (özeti olmayan) arşivin özeti ilk doğrulamada kayda girer (açılıştaki kuralla aynı).
    if (result.state === "recovered") companies.updateArchive(company.id, year, { sha256: result.sha256, size: result.size, verifiedAt: new Date().toISOString() });
    // 2.5.0 D2 tur 2: taşımadan sonra kesilen göç (dosya bekleyen özeti tutuyor) — açılıştaki kuralla aynı, kayıt kesinleştirilir.
    if (result.pending) commitPendingMigration({ registry: companies, company, entry, integrity: result, schemaVersion: readArchiveFacts(file)?.schemaVersion ?? entry.schemaVersion });
    if (result.state === "ok") companies.updateArchive(company.id, year, { verifiedAt: new Date().toISOString() });
    ok(res, { company: company.id, year, state: result.state === "recovered" ? "ok" : result.state, sha256: result.sha256, size: result.size });
  });

  router.get("/api/admin/devir/backups", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    ok(res, { backups: backups.accessible(admin).flatMap(company => backups.listDevirBackupsFor(company)).map(({ dir, ...item }) => item) });
  });

  router.post("/api/admin/devir/backups/verify", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const company = companyFor(admin, body.company);
    const name = text(body.name);
    if (!BACKUP_DIR_NAME.test(name)) throw new HttpError(400, "Geçersiz devir yedeği adı.");
    const root = devirBackupRoot(backups.folderOf(company));
    const dir = path.join(root, name);
    if (path.dirname(path.resolve(dir)) !== path.resolve(root)) throw new HttpError(400, "Geçersiz devir yedeği adı.");
    ok(res, { company: company.id, name, ...(await verifyDevirBackup(dir)) });
  });

  router.get("/api/admin/maintenance", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const ids = new Set(backups.accessible(admin).map(company => company.id));
    const status = maintenance.status();
    ok(res, { active: status.active.filter(item => ids.has(item.companyId)), lastAborted: status.lastAborted });
  });
}
