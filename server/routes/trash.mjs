// Silinenler (v2.0.2): yönetim panelinde silinen verinin listesi ve geri yükleme.
//  - Tablo satırı (Excel/Sheets kaydı ya da programda eklenen kayıt): satır verisi yerinde durur; silinenler listesinden
//    çıkarılınca eski yerinde yeniden görünür. Excel o arada yeniden yüklenip satır kalktıysa geri yüklenemez.
//  - Belge: 30 gün içinde, dosyası duruyorsa.
//  - Serbest sayfa: adı o arada başka bir sekmeye verildiyse "(geri yüklendi)" ekiyle.
//  - Serbest sayfa satırı/kolonu: eski sırasına ARAYA eklenir; o arada eklenenler kayar, üzerine yazılmaz.
//  - Tahsilat ve kasa hareketi: aynı kimlikle geri eklenir (Kasa ve tahsilat takvimi yeniden hesaplanır).
import { HttpError, ok, readJson, text } from "../lib/http.mjs";

const KIND_LABELS = {
  row: "Tablo kaydı",
  tab: "Sekme",
  column: "Tablo sütunu",
  document: "Belge",
  "free-sheet": "Serbest sayfa",
  "free-row": "Serbest sayfa satırı",
  "free-column": "Serbest sayfa kolonu",
  payment: "Tahsilat",
  cash: "Kasa hareketi",
  plan: "Taksit kartı",
  "plan-entry": "Taksit hareketi",
  account: "Cari",
  "account-entry": "Cari hareketi",
  stock: "Stok ürünü",
  "stock-move": "Stok hareketi",
  cheque: "Çek / senet",
};
const SEQUENCE = /^(sıra|sira|sıra no|no|#|sn|s\.?\s?no|nr)$/i;

export function registerTrashRoutes(router, { store, auth, audit, events, dataset, profile, free, trash, documents, accounts = null, stock = null, cheques = null }) {
  const now = () => new Date().toISOString();
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const sessionNames = () => {
    const names = new Map();
    try {
      for (const item of dataset.sessions()) names.set(item.key, item.name || item.label || "");
    } catch {
      // oturum listesi okunamazsa ad yazılmaz
    }
    return names;
  };
  // Satırın okunur adı: sıra numarası dışındaki ilk iki dolu değer (ör. "Ali Veli · 2026/101").
  const rowTitle = values => {
    const parts = [];
    for (const [column, value] of Object.entries(values || {})) {
      if (column.startsWith("__") || SEQUENCE.test(column.trim())) continue;
      const textValue = String(value ?? "").trim();
      if (!textValue || /^[-–—]+$/.test(textValue)) continue;
      parts.push(textValue.length > 40 ? `${textValue.slice(0, 38)}…` : textValue);
      if (parts.length === 2) break;
    }
    return parts.join(" · ");
  };
  const rowOf = (datasetKey, caseKey) => {
    const row = store.get("SELECT tab, values_json FROM dataset_rows WHERE dataset_key = ? AND case_key = ? LIMIT 1", datasetKey, caseKey);
    if (row) return { tab: row.tab, values: JSON.parse(row.values_json || "{}") };
    const created = store.get("SELECT values_json FROM records WHERE source_name = ? AND case_key = ?", datasetKey, caseKey);
    if (created) {
      const values = JSON.parse(created.values_json || "{}");
      return { tab: values.__sheet || "", values };
    }
    return null;
  };

  function list() {
    const names = sessionNames();
    const multi = names.size > 1;
    const where = key => (multi && names.get(key) ? `Oturum: ${names.get(key)}` : "");
    const items = [];
    for (const item of store.all("SELECT d.id, d.source_name AS datasetKey, d.case_key AS caseKey, d.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM deleted_records d LEFT JOIN users u ON u.id = d.deleted_by")) {
      const row = rowOf(item.datasetKey, item.caseKey);
      items.push({
        id: `row:${item.id}`,
        kind: "row",
        title: (row && rowTitle(row.values)) || item.caseKey,
        detail: [row?.tab ? `Sekme: ${row.tab}` : "", where(item.datasetKey)].filter(Boolean).join(" · "),
        deletedAt: item.deletedAt,
        actorName: item.actorName,
        restorable: Boolean(row),
        note: row ? "Eski yerinde yeniden görünür." : "Bu kayıt artık yüklenen tabloda yok (Excel yeniden yüklenmiş olabilir).",
      });
    }
    for (const item of store.all("SELECT d.id, d.case_key AS caseKey, d.case_title AS caseTitle, d.name, d.sha256, d.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM case_documents d LEFT JOIN users u ON u.id = d.deleted_by WHERE d.deleted_at IS NOT NULL")) {
      const present = documents?.hasFile ? documents.hasFile(item) : true;
      items.push({
        id: `document:${item.id}`,
        kind: "document",
        title: item.name,
        detail: `Kayıt: ${item.caseTitle || item.caseKey}`,
        deletedAt: item.deletedAt,
        actorName: item.actorName,
        restorable: present,
        note: present ? "Kaydın belgelerine geri döner. Silinen belgeler 30 gün saklanır." : "Dosya artık yok.",
      });
    }
    for (const item of dataset.hiddenTabs ? dataset.hiddenTabs() : []) {
      const actor = store.get("SELECT display_name AS name FROM users WHERE id = ?", item.by);
      items.push({
        id: `tab:${item.datasetKey}\u0000${item.original}`,
        kind: "tab",
        title: item.name || item.original,
        detail: [item.reason === "list" ? "Excel/Sheets'te gizli liste sayfası (açılır listeler buradan okunur)" : "", `${item.rows || 0} kayıt`, item.name && item.name !== item.original ? `Excel'deki adı: ${item.original}` : "", where(item.datasetKey)].filter(Boolean).join(" · "),
        deletedAt: item.at,
        actorName: actor?.name || "",
        restorable: true,
        note: "Sekme ve kayıtları eski yerinde yeniden görünür. Veriler silinmemişti.",
      });
    }
    // Silinen tablo sütunları (v2.0.6): verisi durur; geri yüklenince eski yerinde görünür.
    for (const item of dataset.hiddenColumns ? dataset.hiddenColumns() : []) {
      const actor = store.get("SELECT display_name AS name FROM users WHERE id = ?", item.by);
      items.push({
        id: `column:${item.datasetKey}\u0000${item.tab}\u0000${item.column}`,
        kind: "column",
        title: item.column,
        detail: [item.tabName ? `Sekme: ${item.tabName}` : "", item.added ? "Programda eklenmiş sütun" : "", `${item.filled || 0} kayıtta bilgi vardı`, where(item.datasetKey)].filter(Boolean).join(" · "),
        deletedAt: item.at,
        actorName: actor?.name || "",
        restorable: true,
        note: "Sütun ve hücreleri eski yerinde yeniden görünür. Veriler silinmemişti.",
      });
    }
    for (const item of free?.deletedSheets ? free.deletedSheets() : []) {
      items.push({
        id: `free-sheet:${item.id}`,
        kind: "free-sheet",
        title: item.name,
        detail: where(item.datasetKey),
        deletedAt: item.deletedAt,
        actorName: item.actorName,
        restorable: true,
        note: "Sekmelerin sonuna geri gelir; adı başka bir sekmede kullanılıyorsa “(geri yüklendi)” eklenir.",
      });
    }
    // Silinen taksit kartları (v2.0.4): taksitleri ve hareketleri yerinde durur; geri yüklenince Kasa'ya döner.
    for (const item of store.all("SELECT p.id, p.name, p.total, p.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName, COALESCE(g.name, '') AS groupName FROM plans p LEFT JOIN users u ON u.id = p.deleted_by LEFT JOIN plan_groups g ON g.id = p.group_id WHERE p.deleted_at IS NOT NULL")) {
      items.push({
        id: `plan:${item.id}`,
        kind: "plan",
        title: item.name,
        detail: [item.groupName ? `Grup: ${item.groupName}` : "", `Toplam ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.total || 0)}`].filter(Boolean).join(" · "),
        deletedAt: item.deletedAt,
        actorName: item.actorName,
        restorable: true,
        note: "Taksitleri ve hareketleriyle Taksitler listesine geri döner; Kasa yeniden hesaplanır.",
      });
    }
    // Silinen cariler ve stok ürünleri (v2.0.6): hareketleri yerinde durur.
    items.push(...(accounts?.deletedList ? accounts.deletedList() : []), ...(stock?.deletedList ? stock.deletedList() : []));
    // Silinen çek/senet (v2.0.7): geri gelince cari/taksit hareketi yeniden yazılır.
    items.push(...(cheques?.deletedList ? cheques.deletedList() : []));
    for (const item of trash.open()) {
      const payload = JSON.parse(item.payload_json || "{}");
      const money = item.kind === "payment" || item.kind === "cash" || item.kind === "plan-entry" || item.kind === "account-entry";
      items.push({
        id: `trash:${item.id}`,
        kind: item.kind,
        title: item.title,
        detail: [
          money ? `${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(payload.amount || 0)} · ${String(payload.date || "").split("-").reverse().join(".")}` : "",
          item.kind === "cash" || item.kind === "plan-entry" ? (payload.kind === "in" ? "Tahsilat" : "Ödeme") : item.kind === "account-entry" ? { debt: "Borç", credit: "Alacak", in: "Tahsilat", out: "Ödeme" }[payload.kind] || "" : "",
          item.detail,
          where(item.dataset_key),
        ]
          .filter(Boolean)
          .join(" · "),
        deletedAt: item.deleted_at,
        actorName: item.actor_name,
        restorable: true,
        note: item.kind === "free-row" || item.kind === "free-column" ? "Eski sırasına araya eklenir; o arada eklenenler kayar, üzerine yazılmaz." : item.kind === "stock-move" ? "Aynı miktar ve tarihle geri eklenir; mevcut stok yeniden hesaplanır." : "Aynı tutar ve tarihle geri eklenir; Kasa yeniden hesaplanır.",
      });
    }
    items.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
    return items.map(item => ({ ...item, kindLabel: KIND_LABELS[item.kind] || item.kind }));
  }

  router.get("/api/admin/trash", async ({ req, res }) => {
    auth.requirePermission(req, "records.delete");
    ok(res, list());
  });

  router.post("/api/admin/trash/restore", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.delete");
    const body = await readJson(req);
    const [source, ...rest] = text(body.id).split(":");
    const ref = rest.join(":");
    if (!source || !ref) throw new HttpError(400, "Geri yüklenecek öğe seçilmedi.");

    if (source === "row") {
      const item = store.get("SELECT * FROM deleted_records WHERE id = ?", ref);
      if (!item) throw new HttpError(404, "Bu kayıt zaten geri yüklenmiş.");
      if (!rowOf(item.source_name, item.case_key)) throw new HttpError(409, "Bu kayıt artık yüklenen tabloda yok; geri yüklenemez.");
      store.tx(() => {
        store.run("DELETE FROM deleted_records WHERE id = ?", item.id);
        audit(user, "source.row.restored", item.case_key, { sourceName: item.source_name, caseKey: item.case_key, from: "trash" });
      });
      profile?.invalidate();
      publish(user, { kind: "records", datasetKey: item.source_name, caseKey: item.case_key });
      return ok(res, { restored: "row", message: "Kayıt eski yerinde yeniden görünüyor." });
    }

    if (source === "column") {
      const [datasetKey, tab, column] = ref.split("\u0000");
      if (!datasetKey || tab === undefined || !column) throw new HttpError(400, "Sütun tanınmadı.");
      const result = dataset.withKey(datasetKey, () => dataset.unhideColumn(user, { tab, column }));
      profile?.invalidate();
      publish(user, { kind: "source", datasetKey });
      return ok(res, { restored: "column", message: `“${result.column}” sütunu geri geldi.` });
    }

    if (source === "tab") {
      const [datasetKey, original] = ref.split("\u0000");
      if (!datasetKey || !original) throw new HttpError(400, "Sekme tanınmadı.");
      const result = dataset.withKey(datasetKey, () => dataset.unhideTab(user, original));
      profile?.invalidate();
      publish(user, { kind: "source", datasetKey });
      return ok(res, { restored: "tab", message: `“${result.name}” sekmesi geri geldi.` });
    }

    if (source === "document") {
      const item = store.get("SELECT * FROM case_documents WHERE id = ? AND deleted_at IS NOT NULL", ref);
      if (!item) throw new HttpError(404, "Bu belge zaten geri yüklenmiş ya da kalıcı olarak silinmiş.");
      if (documents?.hasFile && !documents.hasFile(item)) throw new HttpError(409, "Belgenin dosyası artık yok; geri yüklenemez.");
      store.tx(() => {
        store.run("UPDATE case_documents SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", item.id);
        audit(user, "case.document.restored", item.id, { caseKey: item.case_key, name: item.name });
      });
      publish(user, { kind: "documents", caseKey: item.case_key });
      return ok(res, { restored: "document", message: `“${item.name}” kaydın belgelerine geri döndü.` });
    }

    if (source === "free-sheet") {
      const sheet = store.get("SELECT id, dataset_key FROM free_sheets WHERE id = ? AND deleted_at IS NOT NULL", ref);
      if (!sheet) throw new HttpError(404, "Bu sayfa zaten geri yüklenmiş.");
      const result = dataset.withKey(sheet.dataset_key, () => free.restoreSheet(user, sheet.id));
      profile?.invalidate();
      publish(user, { kind: "records", datasetKey: sheet.dataset_key, free: sheet.id });
      return ok(res, { restored: "free-sheet", message: result.renamed ? `Sayfa “${result.name}” adıyla geri geldi (eski adı başka bir sekmede kullanılıyor).` : `“${result.name}” sayfası geri geldi.` });
    }

    if (source === "plan") {
      const plan = store.get("SELECT id, name FROM plans WHERE id = ? AND deleted_at IS NOT NULL", ref);
      if (!plan) throw new HttpError(404, "Bu taksit kartı zaten geri yüklenmiş.");
      store.tx(() => {
        store.run("UPDATE plans SET deleted_at = NULL, deleted_by = NULL, updated_by = ?, updated_at = ? WHERE id = ?", user.id, now(), plan.id);
        // Kartın carisi (v2.0.6) sonradan silindiyse o da geri gelir; kart sahipsiz kalmaz.
        store.run("UPDATE accounts SET deleted_at = NULL, deleted_by = NULL, updated_by = ?, updated_at = ? WHERE deleted_at IS NOT NULL AND id = (SELECT account_id FROM plans WHERE id = ?)", user.id, now(), plan.id);
        audit(user, "plan.restored", plan.id, { name: plan.name });
      });
      publish(user, { kind: "plans", planId: plan.id });
      publish(user, { kind: "cash" });
      return ok(res, { restored: "plan", message: `“${plan.name}” taksit kartı geri geldi.` });
    }

    if (source === "account") {
      if (!accounts?.restoreDeleted) throw new HttpError(400, "Bilinmeyen öğe.");
      return ok(res, { restored: "account", message: accounts.restoreDeleted(user, ref) });
    }
    if (source === "stock") {
      if (!stock?.restoreDeleted) throw new HttpError(400, "Bilinmeyen öğe.");
      return ok(res, { restored: "stock", message: stock.restoreDeleted(user, ref) });
    }
    if (source === "cheque") {
      if (!cheques?.restoreDeleted) throw new HttpError(400, "Bilinmeyen öğe.");
      return ok(res, { restored: "cheque", message: cheques.restoreDeleted(user, ref) });
    }

    if (source !== "trash") throw new HttpError(400, "Bilinmeyen öğe.");
    const item = trash.get(ref);
    if (!item) throw new HttpError(404, "Bu öğe zaten geri yüklenmiş.");
    const payload = JSON.parse(item.payload_json || "{}");
    let message = "";

    if (item.kind === "payment") {
      store.tx(() => {
        if (!store.get("SELECT 1 AS found FROM payments WHERE id = ?", item.ref)) {
          store.run(
            "INSERT INTO payments (id, case_key, case_title, amount, date, note, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            item.ref,
            payload.caseKey || "",
            payload.caseTitle || "",
            Number(payload.amount) || 0,
            payload.date,
            payload.note || "",
            payload.createdBy || user.id,
            payload.createdAt || now(),
            user.id,
            now(),
          );
        }
        trash.markRestored(item.id, user);
        audit(user, "case.payment.restored", item.ref, { caseKey: payload.caseKey, amount: payload.amount, date: payload.date });
      });
      publish(user, { kind: "activity", caseKey: payload.caseKey });
      publish(user, { kind: "cash" });
      message = "Tahsilat geri eklendi; Kasa ve tahsilat takvimi güncellendi.";
    } else if (item.kind === "cash") {
      if (!["in", "out"].includes(payload.kind)) throw new HttpError(409, "Kasa hareketinin bilgisi eksik; geri yüklenemez.");
      store.tx(() => {
        if (!store.get("SELECT 1 AS found FROM cash_entries WHERE id = ?", item.ref)) {
          store.run(
            "INSERT INTO cash_entries (id, kind, amount, date, description, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            item.ref,
            payload.kind,
            Number(payload.amount) || 0,
            payload.date,
            payload.description || "",
            payload.createdBy || user.id,
            payload.createdAt || now(),
            user.id,
            now(),
          );
        }
        trash.markRestored(item.id, user);
        audit(user, "cash.entry.restored", item.ref, { kind: payload.kind, amount: payload.amount, date: payload.date, description: payload.description });
      });
      publish(user, { kind: "cash" });
      message = "Kasa hareketi geri eklendi.";
    } else if (item.kind === "plan-entry") {
      if (!["in", "out"].includes(payload.kind)) throw new HttpError(409, "Hareketin bilgisi eksik; geri yüklenemez.");
      const plan = store.get("SELECT id, deleted_at AS deletedAt FROM plans WHERE id = ?", payload.planId);
      if (!plan) throw new HttpError(409, "Hareketin taksit kartı artık yok; geri yüklenemez.");
      if (plan.deletedAt) throw new HttpError(409, `“${payload.planName}” kartı silinmiş. Önce kartı geri yükleyin.`);
      store.tx(() => {
        if (!store.get("SELECT 1 AS found FROM plan_entries WHERE id = ?", item.ref)) {
          const itemId = payload.itemId && store.get("SELECT 1 AS found FROM plan_items WHERE id = ?", payload.itemId) ? payload.itemId : null;
          store.run(
            // Açılış (devir) kaydı geri gelince yine açılıştır (v2.0.8): Kasa'ya girmez.
            "INSERT INTO plan_entries (id, plan_id, item_id, kind, amount, date, note, receipt_no, opening, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            item.ref, plan.id, itemId, payload.kind, Number(payload.amount) || 0, payload.date, payload.note || "", payload.receiptNo || null, payload.opening ? 1 : 0, payload.createdBy || user.id, payload.createdAt || now(), user.id, now(),
          );
        }
        trash.markRestored(item.id, user);
        audit(user, "plan.entry.restored", item.ref, { planId: plan.id, kind: payload.kind, amount: payload.amount, date: payload.date });
      });
      publish(user, { kind: "plans", planId: plan.id });
      publish(user, { kind: "cash" });
      message = "Taksit hareketi geri eklendi; kart ve Kasa yeniden hesaplandı.";
    } else if (item.kind === "account-entry" && accounts?.restoreEntry) {
      message = accounts.restoreEntry(user, item, payload);
    } else if (item.kind === "stock-move" && stock?.restoreMove) {
      message = stock.restoreMove(user, item, payload);
    } else if (item.kind === "free-row" || item.kind === "free-column") {
      const sheet = store.get("SELECT deleted_at FROM free_sheets WHERE id = ?", payload.sheetId);
      if (!sheet) throw new HttpError(409, "Satırın sayfası artık yok; geri yüklenemez.");
      if (sheet.deleted_at) throw new HttpError(409, `“${payload.sheetName}” sayfası silinmiş. Önce sayfayı geri yükleyin.`);
      const result = dataset.withKey(item.dataset_key || dataset.currentKey(), () => {
        const restored = item.kind === "free-row" ? free.restoreRow(user, payload) : free.restoreColumn(user, payload);
        trash.markRestored(item.id, user);
        return restored;
      });
      profile?.invalidate();
      publish(user, { kind: "records", datasetKey: item.dataset_key, free: payload.sheetId });
      message =
        item.kind === "free-row"
          ? `Satır “${result.sheet}” sayfasına ${result.position}. satır olarak eklendi${result.lost.length ? ` (${result.lost.join(", ")} kolonu artık yok)` : ""}.`
          : `“${result.column}” kolonu “${result.sheet}” sayfasına ${result.position}. kolon olarak eklendi${result.lost ? ` (${result.lost} hücrenin satırı artık yok)` : ""}.`;
    } else throw new HttpError(400, "Bu öğe geri yüklenemez.");
    return ok(res, { restored: item.kind, message });
  });
}
