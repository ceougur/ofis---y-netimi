// Ortak çalışma alanı: dosya işlemleri, görevler, mesajlar, raporlar, merkezi notlar ve veri kaynağı.
import { EXCEL_PREFIX, columnOrder } from "../lib/sources.mjs";
import { HttpError, limited, ok, parseJson, readJson, text } from "../lib/http.mjs";
import { can } from "../lib/permissions.mjs";

const CASE_KEY_MAX = 300;

export function registerWorkspaceRoutes(router, { store, auth, audit, sources, clientState }) {
  const now = () => new Date().toISOString();
  const newId = prefix => auth.newId(prefix);
  const caseKeyOf = (value, label = "Dosya kimliği") => {
    const key = limited(value, CASE_KEY_MAX, label);
    if (!key) throw new HttpError(400, `${label} gerekli.`);
    return key;
  };
  const sourceNameOf = body => limited(body.sourceName, 2000, "Kaynak adı") || "Çalışma tablosu";

  const parseAmount = value => {
    if (typeof value === "number") return value;
    let raw = String(value ?? "").trim().replace(/[₺\s]/g, "");
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    return Number(raw);
  };

  // ---- Geriye dönük uyumlu toplu durum ----
  router.get("/api/workspace/state", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const rows = sql => store.all(sql);
    const records = rows("SELECT id, case_key AS caseKey, source_name AS sourceName, values_json AS valuesJson, version, created_at AS createdAt, updated_at AS updatedAt FROM records ORDER BY created_at DESC")
      .map(({ valuesJson, ...row }) => ({ ...row, values: parseJson(valuesJson) }));
    ok(res, {
      activeUser: { id: user.id, name: user.display_name, role: user.role, active: true },
      users: rows("SELECT id, username, display_name AS name, role, active FROM users ORDER BY display_name"),
      cases: records.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
      records,
      overrides: rows(`SELECT o.id, o.case_key AS caseKey, o.source_name AS sourceName, o.field, o.value, o.version, o.updated_by AS updatedBy, COALESCE(u.display_name, '') AS actorName, o.updated_at AS updatedAt FROM overrides o LEFT JOIN users u ON u.id = o.updated_by ORDER BY o.updated_at DESC`),
      deletedRecords: rows(`SELECT d.id, d.case_key AS caseKey, d.source_name AS sourceName, d.deleted_by AS deletedBy, COALESCE(u.display_name, '') AS actorName, d.deleted_at AS deletedAt FROM deleted_records d LEFT JOIN users u ON u.id = d.deleted_by ORDER BY d.deleted_at DESC`),
      messages: rows(`SELECT m.id, m.recipient AS "to", m.message, m.case_key AS caseKey, m.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, m.created_at AS createdAt FROM messages m LEFT JOIN users u ON u.id = m.created_by ORDER BY m.created_at DESC LIMIT 100`),
      tasks: rows(`SELECT t.id, t.title, t.case_key AS caseKey, t.assignee, t.due_date AS dueDate, t.priority, t.status, t.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, t.created_at AS createdAt, t.completed_at AS completedAt, t.completed_by AS completedBy, COALESCE(c.display_name, t.completed_by) AS completedByName FROM tasks t LEFT JOIN users u ON u.id = t.created_by LEFT JOIN users c ON c.id = t.completed_by ORDER BY t.created_at DESC`),
      notes: rows(`SELECT n.id, n.case_key AS caseKey, n.note, n.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, n.created_at AS createdAt FROM notes n LEFT JOIN users u ON u.id = n.created_by ORDER BY n.created_at DESC`),
      phones: rows(`SELECT p.id, p.case_key AS caseKey, p.phone, p.label, p.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt FROM phones p LEFT JOIN users u ON u.id = p.created_by ORDER BY p.created_at DESC`),
      payments: rows(`SELECT p.id, p.case_key AS caseKey, p.amount, p.date, p.note, p.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt FROM payments p LEFT JOIN users u ON u.id = p.created_by ORDER BY p.created_at DESC`),
      liens: rows(`SELECT l.id, l.case_key AS caseKey, l.title, l.placed_at AS placedAt, l.expires_at AS expiresAt, l.status, l.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, l.created_at AS createdAt FROM liens l LEFT JOIN users u ON u.id = l.created_by ORDER BY l.created_at DESC`),
      events: can(user.role, "audit.view")
        ? rows("SELECT id, type, entity_id AS entityId, actor_id AS actorId, actor_name AS actorName, payload_json AS payloadJson, created_at AS createdAt FROM audit_events ORDER BY created_at DESC LIMIT 500").map(({ payloadJson, ...row }) => ({ ...row, payload: parseJson(payloadJson) }))
        : [],
    });
  });

  router.post("/api/workspace/profile", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const body = await readJson(req);
    const name = limited(body.name, 120, "Ad soyad");
    if (!name) throw new HttpError(400, "Personel adı gerekli.");
    store.run("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", name, now(), user.id);
    audit({ ...user, display_name: name }, "profile.updated", user.id, { name });
    ok(res, { id: user.id, name, role: user.role });
  });

  router.get("/api/workspace/users", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, store.all("SELECT id, display_name AS name, role FROM users WHERE active = 1 ORDER BY display_name COLLATE NOCASE"));
  });

  // ---- Kaynak satırları: yeni kayıt, silme, hücre düzeltme ----
  const createRecord = (user, source, values, requestedKey) => {
    const clean = {};
    for (const [key, value] of Object.entries(values || {}).slice(0, 500)) {
      const name = String(key).trim().slice(0, 200);
      const content = String(value ?? "").trim().slice(0, 20_000);
      if (name && !name.startsWith("__") && content) clean[name] = content;
    }
    if (!Object.keys(clean).length) throw new HttpError(400, "En az bir bilgi girilmelidir.");
    const fallbackKey = clean.ESAS || clean["DOSYA NO"] || clean["Dosya No"] || clean["Dosya no"];
    const key = limited(requestedKey || fallbackKey || newId("case"), CASE_KEY_MAX, "Dosya kimliği");
    if (store.get("SELECT id FROM records WHERE source_name = ? AND case_key = ?", source, key)) throw new HttpError(409, `"${key}" kimlikli bir kayıt bu tabloda zaten var.`);
    const recordId = newId("record");
    const timestamp = now();
    store.run("INSERT INTO records (id, source_name, case_key, values_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", recordId, source, key, JSON.stringify(clean), user.id, timestamp, timestamp);
    audit(user, "source.row.created", recordId, { sourceName: source, caseKey: key });
    return { id: recordId, sourceName: source, caseKey: key, values: clean, createdAt: timestamp };
  };

  router.get("/api/workspace/records", async ({ req, res, url }) => {
    auth.requireUser(req);
    const source = text(url.searchParams.get("sourceName"));
    const rows = store.all("SELECT id, source_name AS sourceName, case_key AS caseKey, values_json AS valuesJson, version, created_at AS createdAt, updated_at AS updatedAt FROM records WHERE (? = '' OR source_name = ?) ORDER BY created_at DESC", source, source);
    ok(res, rows.map(({ valuesJson, ...row }) => ({ ...row, values: parseJson(valuesJson) })));
  });

  router.post("/api/workspace/records", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    ok(res, createRecord(user, sourceNameOf(body), body.values, text(body.caseKey || body.case_key)));
  });

  // v1.0.0 "Yeni kayıt" penceresinin sabit alanları için uyumluluk ucu.
  router.post("/api/workspace/cases", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    const values = { "DOSYA NO": body.caseKey, "BORÇLU": body.client, "ALACAKLI": body.creditor, "İCRA DAİRESİ": body.court, "TELEFON": body.phone };
    ok(res, createRecord(user, sourceNameOf(body), values, text(body.caseKey)));
  });

  router.get("/api/workspace/deleted", async ({ req, res, url }) => {
    auth.requireUser(req);
    const source = text(url.searchParams.get("sourceName"));
    ok(res, store.all(`SELECT d.id, d.case_key AS caseKey, d.source_name AS sourceName, d.deleted_by AS deletedBy, COALESCE(u.display_name, '') AS actorName, d.deleted_at AS deletedAt FROM deleted_records d LEFT JOIN users u ON u.id = d.deleted_by WHERE (? = '' OR d.source_name = ?) ORDER BY d.deleted_at DESC`, source, source));
  });

  router.post("/api/workspace/deleted", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.delete");
    const body = await readJson(req);
    const source = sourceNameOf(body);
    const key = caseKeyOf(body.caseKey || body.case_key, "Silinecek kayıt kimliği");
    const existing = store.get("SELECT id FROM deleted_records WHERE source_name = ? AND case_key = ?", source, key);
    const recordId = existing?.id || newId("deleted");
    store.run("INSERT INTO deleted_records (id, source_name, case_key, deleted_by, deleted_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_name, case_key) DO UPDATE SET deleted_by = excluded.deleted_by, deleted_at = excluded.deleted_at", recordId, source, key, user.id, now());
    audit(user, "source.row.deleted", recordId, { sourceName: source, caseKey: key });
    ok(res, { id: recordId, sourceName: source, caseKey: key });
  });

  router.post("/api/workspace/deleted/restore", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.delete");
    const body = await readJson(req);
    const source = sourceNameOf(body);
    const key = caseKeyOf(body.caseKey, "Geri alınacak kayıt kimliği");
    const removed = store.run("DELETE FROM deleted_records WHERE source_name = ? AND case_key = ?", source, key).changes;
    if (!removed) throw new HttpError(404, "Silinmiş kayıt bulunamadı.");
    audit(user, "source.row.restored", key, { sourceName: source, caseKey: key });
    ok(res, true);
  });

  router.get("/api/workspace/overrides", async ({ req, res, url }) => {
    auth.requireUser(req);
    const source = text(url.searchParams.get("sourceName"));
    const key = text(url.searchParams.get("caseKey"));
    ok(res, store.all(`SELECT o.id, o.case_key AS caseKey, o.source_name AS sourceName, o.field, o.value, o.version, o.updated_by AS updatedBy, COALESCE(u.display_name, '') AS actorName, o.updated_at AS updatedAt FROM overrides o LEFT JOIN users u ON u.id = o.updated_by WHERE (? = '' OR o.source_name = ?) AND (? = '' OR o.case_key = ?) ORDER BY o.updated_at DESC`, source, source, key, key));
  });

  router.post("/api/workspace/overrides", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    const source = sourceNameOf(body);
    const key = caseKeyOf(body.caseKey || body.case_key, "Dosya kimliği");
    const field = limited(body.field, 200, "Alan adı");
    if (!field) throw new HttpError(400, "Dosya ve alan bilgisi gerekli.");
    const value = limited(body.value ?? "", 20_000, "Değer");
    const old = store.get("SELECT id, value, version FROM overrides WHERE source_name = ? AND case_key = ? AND field = ?", source, key, field);
    const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
    if (old && expectedVersion !== null && old.version !== expectedVersion) throw new HttpError(409, "Bu alan başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.", { code: "CONFLICT", currentValue: old.value, currentVersion: old.version });
    const itemId = old?.id || newId("override");
    const version = (old?.version || 0) + 1;
    store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_name, case_key, field) DO UPDATE SET value = excluded.value, version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at", itemId, source, key, field, value, version, user.id, now());
    audit(user, "source.cell.updated", itemId, { sourceName: source, caseKey: key, field, previousValue: old?.value || "", value, version, action: text(body.action) || undefined });
    ok(res, { id: itemId, version });
  });

  // ---- Dosya işlemleri ----
  router.get("/api/workspace/cases/:key/activity", async ({ req, res, params }) => {
    auth.requireUser(req);
    const key = caseKeyOf(params.key);
    const list = (sql, type) => store.all(sql, key).map(row => ({ ...row, type }));
    const items = [
      ...list(`SELECT n.id, n.note AS text, n.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.case_key = ?`, "note"),
      ...list(`SELECT p.id, p.phone, p.label, p.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM phones p LEFT JOIN users u ON u.id = p.created_by WHERE p.case_key = ?`, "phone"),
      ...list(`SELECT p.id, p.amount, p.date, p.note, p.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.case_key = ?`, "payment"),
      ...list(`SELECT l.id, l.title, l.placed_at AS placedAt, l.expires_at AS expiresAt, l.status, l.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM liens l LEFT JOIN users u ON u.id = l.created_by WHERE l.case_key = ?`, "lien"),
      ...list(`SELECT t.id, t.title, t.assignee, t.due_date AS dueDate, t.priority, t.status, t.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM tasks t LEFT JOIN users u ON u.id = t.created_by WHERE t.case_key = ?`, "task"),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const totals = store.get("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE case_key = ?", key);
    ok(res, { caseKey: key, items, paidTotal: totals.paid });
  });

  router.post("/api/workspace/cases/:key/notes", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "notes.write");
    const body = await readJson(req);
    const key = caseKeyOf(params.key);
    const note = limited(body.note, 5000, "Not");
    if (!note) throw new HttpError(400, "Not metni gerekli.");
    const itemId = newId("note");
    store.run("INSERT INTO notes (id, case_key, note, created_by, created_at) VALUES (?, ?, ?, ?, ?)", itemId, key, note, user.id, now());
    audit(user, "case.note.created", itemId, { caseKey: key });
    ok(res, { id: itemId });
  });

  router.post("/api/workspace/cases/:key/phones", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "phones.create");
    const body = await readJson(req);
    const key = caseKeyOf(params.key);
    const phone = text(body.phone).replace(/[^\d+]/g, "");
    if (phone.length < 7 || phone.length > 20) throw new HttpError(400, "Geçerli bir telefon numarası gerekli.");
    const itemId = newId("phone");
    store.run("INSERT INTO phones (id, case_key, phone, label, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", itemId, key, phone, limited(body.label, 60, "Etiket") || "Telefon", user.id, now());
    audit(user, "case.phone.created", itemId, { caseKey: key });
    ok(res, { id: itemId });
  });

  router.post("/api/workspace/cases/:key/payments", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "payments.create");
    const body = await readJson(req);
    const key = caseKeyOf(params.key);
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Geçerli bir tahsilat tutarı gerekli.");
    const date = text(body.date) || new Date().toISOString().slice(0, 10);
    if (Number.isNaN(new Date(date).getTime())) throw new HttpError(400, "Geçerli bir tahsilat tarihi gerekli.");
    const itemId = newId("payment");
    store.run("INSERT INTO payments (id, case_key, amount, date, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", itemId, key, Math.round(amount * 100) / 100, date, limited(body.note, 500, "Açıklama"), user.id, now());
    audit(user, "case.payment.created", itemId, { caseKey: key, amount });
    ok(res, { id: itemId });
  });

  router.post("/api/workspace/cases/:key/liens", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "liens.create");
    const body = await readJson(req);
    const key = caseKeyOf(params.key);
    const placed = new Date(text(body.placedAt));
    if (Number.isNaN(placed.getTime())) throw new HttpError(400, "Geçerli bir haciz tarihi gerekli.");
    const expires = new Date(placed);
    expires.setFullYear(expires.getFullYear() + 1);
    const itemId = newId("lien");
    store.run("INSERT INTO liens (id, case_key, title, placed_at, expires_at, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)", itemId, key, limited(body.title, 200, "Haciz başlığı") || "Haciz", placed.toISOString(), expires.toISOString(), user.id, now());
    audit(user, "case.lien.created", itemId, { caseKey: key, expiresAt: expires.toISOString() });
    ok(res, { id: itemId, expiresAt: expires.toISOString() });
  });

  router.get("/api/workspace/liens", async ({ req, res, url }) => {
    auth.requireUser(req);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 7)));
    const current = Date.now();
    const threshold = current + days * 86_400_000;
    const items = store.all(`SELECT l.id, l.case_key AS caseKey, l.title, l.placed_at AS placedAt, l.expires_at AS expiresAt, l.status, l.created_by AS actorId, COALESCE(u.display_name, '') AS actorName FROM liens l LEFT JOIN users u ON u.id = l.created_by WHERE l.status = 'active' ORDER BY l.expires_at`)
      .filter(item => {
        const time = new Date(item.expiresAt).getTime();
        return time <= threshold && time >= current;
      });
    ok(res, { days, upcoming: items, total: items.length });
  });

  // ---- Görevler ve mesajlar ----
  router.get("/api/workspace/tasks", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    const status = text(url.searchParams.get("status")) || "open";
    const mine = url.searchParams.get("mine") === "1";
    const rows = store.all(`SELECT t.id, t.title, t.case_key AS caseKey, t.assignee, t.due_date AS dueDate, t.priority, t.status, COALESCE(u.display_name, '') AS actorName, t.created_at AS createdAt, t.completed_at AS completedAt, COALESCE(c.display_name, t.completed_by) AS completedByName FROM tasks t LEFT JOIN users u ON u.id = t.created_by LEFT JOIN users c ON c.id = t.completed_by WHERE (? = 'all' OR t.status = ?) ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, CASE WHEN t.due_date = '' THEN 1 ELSE 0 END, t.due_date, t.created_at DESC LIMIT 500`, status, status);
    const name = user.display_name.toLocaleLowerCase("tr-TR");
    ok(res, mine ? rows.filter(row => row.assignee.toLocaleLowerCase("tr-TR") === name) : rows);
  });

  router.post("/api/workspace/tasks", async ({ req, res }) => {
    const user = auth.requirePermission(req, "tasks.create");
    const body = await readJson(req);
    const title = limited(body.title, 300, "Görev");
    if (!title) throw new HttpError(400, "Görev başlığı gerekli.");
    const priority = ["normal", "high", "urgent"].includes(text(body.priority)) ? text(body.priority) : "normal";
    const itemId = newId("task");
    const key = limited(body.caseKey || body.case_key, CASE_KEY_MAX, "Dosya kimliği");
    store.run("INSERT INTO tasks (id, title, case_key, assignee, due_date, priority, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)", itemId, title, key, limited(body.assignee, 120, "Atanan kişi") || user.display_name, text(body.dueDate).slice(0, 10), priority, user.id, now());
    audit(user, "task.created", itemId, { title, caseKey: key });
    ok(res, { id: itemId });
  });

  router.post("/api/workspace/tasks/:id/complete", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "tasks.complete");
    const item = store.get("SELECT id, status FROM tasks WHERE id = ?", params.id);
    if (!item) throw new HttpError(404, "Görev bulunamadı.");
    store.run("UPDATE tasks SET status = 'completed', completed_at = ?, completed_by = ? WHERE id = ?", now(), user.id, params.id);
    audit(user, "task.completed", params.id);
    ok(res, true);
  });

  router.get("/api/workspace/messages", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
    const name = user.display_name.toLocaleLowerCase("tr-TR");
    const rows = store.all(`SELECT m.id, m.recipient AS "to", m.message, m.case_key AS caseKey, m.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, m.created_at AS createdAt FROM messages m LEFT JOIN users u ON u.id = m.created_by ORDER BY m.created_at DESC LIMIT ?`, limit);
    ok(res, rows.map(row => ({ ...row, toMe: row.to.toLocaleLowerCase("tr-TR") === name, mine: row.actorId === user.id })));
  });

  router.post("/api/workspace/messages", async ({ req, res }) => {
    const user = auth.requirePermission(req, "messages.create");
    const body = await readJson(req);
    const recipient = limited(body.to, 120, "Alıcı");
    const message = limited(body.message, 2000, "Mesaj");
    if (!recipient || !message) throw new HttpError(400, "Alıcı ve mesaj gerekli.");
    const itemId = newId("message");
    store.run("INSERT INTO messages (id, recipient, message, case_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", itemId, recipient, message, limited(body.caseKey || body.case_key, CASE_KEY_MAX, "Dosya kimliği"), user.id, now());
    audit(user, "message.created", itemId, { recipient });
    ok(res, { id: itemId });
  });

  router.get("/api/workspace/reports", async ({ req, res }) => {
    auth.requirePermission(req, "reports.view");
    const count = (sql, ...args) => store.get(sql, ...args);
    const users = store.all("SELECT id, display_name AS name, role FROM users WHERE active = 1 ORDER BY display_name");
    const report = users.map(item => ({
      userId: item.id,
      userName: item.name,
      role: item.role,
      tasksCreated: count("SELECT COUNT(*) AS count FROM tasks WHERE created_by = ?", item.id).count,
      tasksCompleted: count("SELECT COUNT(*) AS count FROM tasks WHERE completed_by = ? OR completed_by = ?", item.id, item.name).count,
      notes: count("SELECT COUNT(*) AS count FROM notes WHERE created_by = ?", item.id).count,
      calls: count("SELECT COUNT(*) AS count FROM phones WHERE created_by = ?", item.id).count,
      collections: count("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE created_by = ?", item.id).total,
      dataEntries: count("SELECT COUNT(*) AS count FROM audit_events WHERE actor_id = ?", item.id).count,
    }));
    ok(res, {
      generatedAt: now(),
      report,
      totals: {
        tasks: count("SELECT COUNT(*) AS count FROM tasks").count,
        completedTasks: count("SELECT COUNT(*) AS count FROM tasks WHERE status = 'completed'").count,
        notes: count("SELECT COUNT(*) AS count FROM notes").count,
        payments: count("SELECT COALESCE(SUM(amount), 0) AS total FROM payments").total,
        events: count("SELECT COUNT(*) AS count FROM audit_events").count,
      },
    });
  });

  // ---- Ofis geneli istemci ayarları (veri kaynağı, senkron sıklığı, kolon eşlemesi) ----
  router.get("/api/workspace/client-state", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, clientState.read());
  });

  router.put("/api/workspace/client-state", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req, { limit: 200_000 });
    ok(res, clientState.update(user, text(body.key), body.value));
  });

  router.delete("/api/workspace/sources/active", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    ok(res, clientState.update(user, "sheetUrl", ""));
  });

  router.post("/api/workspace/sources/excel", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req, { limit: 80_000_000 });
    const result = sources.saveExcel(user, body);
    ok(res, { ...result, state: clientState.read() });
  });

  router.get("/api/workspace/sources/columns", async ({ req, res, url }) => {
    auth.requireUser(req);
    const sheetUrl = text(url.searchParams.get("sheetUrl")) || store.setting("client.sheetUrl", "");
    const view = await sources.view(sheetUrl);
    ok(res, { sheetUrl, connected: view.connected, columns: columnOrder(view.rows || []), excel: sheetUrl.startsWith(EXCEL_PREFIX) });
  });

  // ---- Merkezi dosya notları (arayüzdeki "Notu kaydet") ----
  router.get("/api/workspace/case-notes", async ({ req, res, url }) => {
    auth.requireUser(req);
    const since = text(url.searchParams.get("since"));
    const rows = store.all("SELECT case_key AS caseKey, note, version, updated_at AS updatedAt FROM case_notes WHERE (? = '' OR updated_at > ?) ORDER BY updated_at", since, since);
    ok(res, { notes: rows, serverTime: now() });
  });

  router.put("/api/workspace/case-notes/:key", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "notes.write");
    const body = await readJson(req);
    const key = caseKeyOf(params.key);
    const note = limited(body.note ?? "", 10_000, "Not");
    const old = store.get("SELECT note, version FROM case_notes WHERE case_key = ?", key);
    const version = (old?.version || 0) + 1;
    store.run("INSERT INTO case_notes (case_key, note, version, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(case_key) DO UPDATE SET note = excluded.note, version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at", key, note, version, user.id, now());
    audit(user, "case.status_note.updated", key, { caseKey: key, previous: old?.note ?? null, length: note.length });
    ok(res, { caseKey: key, version });
  });

  router.post("/api/workspace/case-notes/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "notes.write");
    const body = await readJson(req, { limit: 5_000_000 });
    const entries = Object.entries(body.notes && typeof body.notes === "object" ? body.notes : {}).slice(0, 20_000);
    let imported = 0;
    store.tx(() => {
      for (const [rawKey, rawNote] of entries) {
        const key = String(rawKey).trim().slice(0, CASE_KEY_MAX);
        const note = String(rawNote ?? "").slice(0, 10_000);
        if (!key || !note.trim()) continue;
        imported += store.run("INSERT INTO case_notes (case_key, note, version, updated_by, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(case_key) DO NOTHING", key, note, user.id, now()).changes;
      }
    });
    if (imported) audit(user, "case.status_note.imported", "bulk", { imported });
    ok(res, { imported });
  });
}
