// Değişiklik geçmişi (audit). Her önemli işlem kim, ne zaman, ne yaptı olarak saklanır.
import { randomUUID } from "node:crypto";
import { systemClock } from "./clock.mjs";

// now: iş saati (config.now); işlem geçmişinin zamanı hareketlerle aynı saatten (sahte saatli testlerde de).
// canWrite (2.5.0 BS-7): false iken (yeni şemalı, yalnız görüntülenen şirket) iz yazılmaz.
export function createAudit(store, { now = systemClock, canWrite = () => true } = {}) {
  return function audit(user, type, entityId, payload = {}) {
    if (!canWrite()) return;
    store.run(
      "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      `event-${randomUUID()}`,
      type,
      String(entityId ?? ""),
      user?.id || "system",
      user?.display_name || user?.name || "Sistem",
      JSON.stringify(payload ?? {}),
      now().toISOString(),
    );
  };
}
