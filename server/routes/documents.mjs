// Kayda eklenen belgeler (v2.0.1): listeleme, yükleme, görüntüleme/indirme, silme.
// Herkes belge ekler ve görür; kendi eklediğini siler, başkasınınkini silmek documents.manage (yönetici, ikinci rol).
// Belgeler kayıt kimliğine bağlıdır (notlar ve tahsilatlar gibi); veri yeniden yüklense de kayıtla kalır.
import { randomUUID } from "node:crypto";
import path from "node:path";
import { HttpError, SECURITY_HEADERS, limited, ok, readBuffer, sendBuffer, text } from "../lib/http.mjs";
import { MAX_DOCUMENT_BYTES, cleanDocumentName, createDocumentStore, detectDocumentType } from "../lib/documents.mjs";
import { createZip } from "../lib/zip.mjs";
import { can } from "../lib/permissions.mjs";

const KINDS_VIEWABLE = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);

export function registerDocumentRoutes(router, { store, auth, audit, events, config, log }) {
  const files = createDocumentStore({ dir: path.join(config.dataDir, "belgeler"), log });
  // Açılışta eski silinmiş belgeleri ve sahipsiz dosyaları temizler (arka planda, açılışı bekletmez).
  const purgeTimer = setTimeout(() => files.purge(store), 5_000);
  purgeTimer.unref?.();
  const now = () => new Date().toISOString();
  const changed = (user, caseKey) => events?.publish("workspace.changed", { kind: "documents", caseKey, actorId: user.id, actorName: user.display_name }, { except: user.id });
  const caseKeyOf = value => {
    const key = limited(value, 300, "Dosya kimliği");
    if (!key) throw new HttpError(400, "Dosya kimliği gerekli.");
    return key;
  };
  const canDelete = (user, row) => row.created_by === user.id ? can(user.role, "documents.upload") : can(user.role, "documents.manage");
  const shape = (user, row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    mime: row.mime,
    size: row.size,
    viewable: KINDS_VIEWABLE.has(row.mime),
    createdAt: row.created_at,
    actorId: row.created_by,
    actorName: row.actorName || "",
    canDelete: canDelete(user, row),
  });
  const SELECT = "SELECT d.*, u.display_name AS actorName FROM case_documents d LEFT JOIN users u ON u.id = d.created_by";

  router.get("/api/workspace/cases/:key/documents", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const key = caseKeyOf(params.key);
    // Eskiden yeniye: yeni eklenen belge listenin sonunda.
    const rows = store.all(`${SELECT} WHERE d.case_key = ? AND d.deleted_at IS NULL ORDER BY d.created_at, d.rowid`, key);
    ok(res, { documents: rows.map(row => shape(user, row)), maxBytes: MAX_DOCUMENT_BYTES });
  });

  router.post("/api/workspace/cases/:key/documents", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "documents.upload");
    const key = caseKeyOf(params.key);
    const body = await readBuffer(req, { limit: MAX_DOCUMENT_BYTES });
    const name = cleanDocumentName(url.searchParams.get("name"));
    const type = detectDocumentType(name, body);
    if (type.error) throw new HttpError(415, type.error);
    const sha = files.save(body);
    const id = `doc-${randomUUID()}`;
    store.run(
      "INSERT INTO case_documents (id, case_key, case_title, name, kind, mime, size, sha256, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, key, limited(url.searchParams.get("title"), 200, "Kayıt adı"), name, type.kind, type.mime, body.length, sha, user.id, now(),
    );
    audit(user, "case.document.created", id, { caseKey: key, name, size: body.length, mime: type.mime });
    changed(user, key);
    ok(res, shape(user, store.get(`${SELECT} WHERE d.id = ?`, id)));
  });

  // Toplu dışa aktarma (v2.0.2): seçilen belgeler özgün biçimleriyle tek .zip içinde. Adlar çakışırsa "(2)" eklenir.
  // Toplam boyut sınırı belleği korur; adet sınırı yoktur.
  const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
  router.get("/api/workspace/cases/:key/documents/archive", async ({ req, res, params, url }) => {
    const user = auth.requireUser(req);
    const key = caseKeyOf(params.key);
    const wanted = new Set(String(url.searchParams.get("ids") || "").split(",").map(item => item.trim()).filter(Boolean));
    const rows = store.all(`${SELECT} WHERE d.case_key = ? AND d.deleted_at IS NULL ORDER BY d.created_at, d.rowid`, key).filter(row => !wanted.size || wanted.has(row.id));
    if (!rows.length) throw new HttpError(404, "Dışa aktarılacak belge bulunamadı.");
    const used = new Set();
    const entries = [];
    let total = 0;
    for (const row of rows) {
      const body = files.read(row.sha256);
      if (!body) continue;
      total += body.length;
      if (total > MAX_ARCHIVE_BYTES) throw new HttpError(413, "Seçilen belgeler tek seferde indirilemeyecek kadar büyük (en fazla 1 GB). Daha az belge seçin.");
      const dot = row.name.lastIndexOf(".");
      const stem = dot > 0 ? row.name.slice(0, dot) : row.name;
      const ext = dot > 0 ? row.name.slice(dot) : "";
      let name = row.name;
      for (let copy = 2; used.has(name.toLocaleLowerCase("tr-TR")); copy += 1) name = `${stem} (${copy})${ext}`;
      used.add(name.toLocaleLowerCase("tr-TR"));
      entries.push({ name, data: body, date: new Date(row.created_at) });
    }
    if (!entries.length) throw new HttpError(410, "Belgelerin dosyaları sunucuda bulunamadı.");
    // PDF ve resimler zaten sıkıştırılmış: hızlı sıkıştırma yeterli.
    const zip = createZip(entries, { level: 1 });
    const title = cleanDocumentName(rows[0].case_title || key, "Belgeler").replace(/\.[a-z0-9]{1,5}$/i, "");
    audit(user, "case.document.exported", key, { caseKey: key, count: entries.length, size: total });
    sendBuffer(res, zip, { type: "application/zip", name: `Belgeler - ${title}.zip` });
  });

  // Görüntüleme: PDF tarayıcının kendi görüntüleyicisinde, resimler doğrudan; diğer türler ve ?download=1 indirilir.
  router.get("/api/workspace/documents/:id/file", async ({ req, res, params, url }) => {
    auth.requireUser(req);
    const row = store.get("SELECT * FROM case_documents WHERE id = ? AND deleted_at IS NULL", text(params.id));
    if (!row) throw new HttpError(404, "Belge bulunamadı; silinmiş olabilir.");
    const body = files.read(row.sha256);
    if (!body) throw new HttpError(410, "Belgenin dosyası sunucuda bulunamadı (veri klasöründeki belgeler/ taşınmış ya da silinmiş olabilir).");
    const inline = url.searchParams.get("download") !== "1" && KINDS_VIEWABLE.has(row.mime);
    const headers = { "cross-origin-resource-policy": "same-origin" };
    // Resimler betiksiz, izole bir belge olarak açılır. (PDF görüntüleyicisi bu kısıtla çalışmadığı için PDF'e uygulanmaz.)
    if (inline && row.mime.startsWith("image/")) headers["content-security-policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
    // PDF programın kendi önizleme penceresinde (aynı sitedeki çerçevede) açılabilsin; başka siteler çerçeveleyemez.
    if (inline && row.mime === "application/pdf") {
      headers["x-frame-options"] = "SAMEORIGIN";
      headers["content-security-policy"] = "frame-ancestors 'self'";
    }
    sendBuffer(res, body, { type: row.mime === "text/plain" || row.mime === "text/csv" ? `${row.mime}; charset=utf-8` : row.mime, name: row.name, inline, headers: { ...SECURITY_HEADERS, ...headers } });
  });

  router.delete("/api/workspace/documents/:id", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const row = store.get("SELECT * FROM case_documents WHERE id = ? AND deleted_at IS NULL", text(params.id));
    if (!row) throw new HttpError(404, "Belge bulunamadı; silinmiş olabilir.");
    if (!canDelete(user, row)) throw new HttpError(403, "Başkasının eklediği belgeyi yalnızca yönetici silebilir.");
    store.run("UPDATE case_documents SET deleted_at = ?, deleted_by = ? WHERE id = ?", now(), user.id, row.id);
    audit(user, "case.document.deleted", row.id, { caseKey: row.case_key, name: row.name });
    changed(user, row.case_key);
    ok(res, { id: row.id });
  });

  // Silmeyi geri al (v2.0.2): silen kişi ya da silme yetkisi olan, dosyası duruyorsa.
  router.post("/api/workspace/documents/:id/restore", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const row = store.get("SELECT * FROM case_documents WHERE id = ? AND deleted_at IS NOT NULL", text(params.id));
    if (!row) throw new HttpError(404, "Geri alınacak belge bulunamadı.");
    if (!canDelete(user, row)) throw new HttpError(403, "Bu belgeyi geri alma yetkiniz yok.");
    if (!files.read(row.sha256)) throw new HttpError(409, "Belgenin dosyası artık yok.");
    store.run("UPDATE case_documents SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", row.id);
    audit(user, "case.document.restored", row.id, { caseKey: row.case_key, name: row.name });
    changed(user, row.case_key);
    ok(res, { id: row.id });
  });

  // Silinenler (v2.0.2): 30 gün içinde silinen belge, dosyası duruyorsa geri yüklenir.
  const hasFile = row => Boolean(files.read(row.sha256));
  return { stop: () => clearTimeout(purgeTimer), hasFile, notify: changed };
}
