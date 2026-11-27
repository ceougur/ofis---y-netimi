// Silinenler (v2.0.2): tamamen silinen verinin (tahsilat, kasa hareketi, serbest sayfa satırı ve kolonu) içeriği silinirken
// burada saklanır; yönetim panelindeki "Silinenler" listesinden geri yüklenir. Tablo satırı, belge ve serbest sayfa
// zaten yumuşak silinir (verisi durur); onlar kendi tablolarından listelenir (server/routes/trash.mjs).
import { randomUUID } from "node:crypto";
import { systemClock } from "./clock.mjs";
import { hiddenKeyOf, saveHidden } from "./cash-opening.mjs";

// Birleşik tur 8 (DK-B7 ORTA-1): tek satırlık para öğesinin Silinenler özeti (kimlik → tarih|kuruş) — geri yükleme yalnız silinirkenki hâliyle dönen satırı açıklar
// (lib/cash-opening.mjs restoringCash). Satırın tablosu Kasa uyarısının kimliğiyle aynı (cash-opening TABLE_OF_SOURCE).
const ROW_TABLES = { payment: "payments", cash: "cash_entries", "plan-entry": "plan_entries", "account-entry": "account_entries" };
const sigOf = row => `${row?.date || ""}|${Math.round((Number(row?.amount) || 0) * 100)}`;

export function createTrash(store, { now: clock = systemClock } = {}) {
  const now = () => clock().toISOString();
  function add({ kind, ref, datasetKey = "", title = "", detail = "", payload = {}, user }) {
    const id = `trash-${randomUUID()}`;
    store.run(
      "INSERT INTO trash (id, kind, ref, dataset_key, title, detail, payload_json, deleted_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      kind,
      String(ref || ""),
      datasetKey,
      String(title || "").slice(0, 200),
      String(detail || "").slice(0, 300),
      JSON.stringify(payload),
      user?.id || "",
      now(),
    );
    const table = ROW_TABLES[kind];
    if (table && ref) {
      const rows = { [`${table}:${ref}`]: sigOf(payload) };
      if (payload?.twin?.id) rows[`${table}:${payload.twin.id}`] = sigOf(payload.twin);
      saveHidden(store, hiddenKeyOf("trash", id), rows);
    }
    return id;
  }
  const open = () => store.all("SELECT t.*, COALESCE(u.display_name, '') AS actor_name FROM trash t LEFT JOIN users u ON u.id = t.deleted_by WHERE t.restored_at IS NULL ORDER BY t.deleted_at DESC LIMIT 1000");
  const get = id => store.get("SELECT * FROM trash WHERE id = ? AND restored_at IS NULL", String(id || ""));
  const markRestored = (id, user) => store.run("UPDATE trash SET restored_at = ?, restored_by = ? WHERE id = ?", now(), user?.id || "", id);
  return { add, open, get, markRestored };
}
