// Ofis geneli istemci ayarları. v1.0.0'da her tarayıcı kendi ayarını saklıyordu;
// artık veri kaynağı ve senkron ayarı sunucuda tutulur ve tüm bilgisayarlarda aynıdır.
import { randomUUID } from "node:crypto";
import { HttpError } from "./http.mjs";
import { EXCEL_PREFIX } from "./sources.mjs";

const KEYS = {
  sheetUrl: { setting: "client.sheetUrl", max: 2000 },
  syncMinutes: { setting: "client.syncMinutes", max: 5 },
  aiMapping: { setting: "client.aiMapping", max: 20_000 },
  activeSourceLabel: { setting: "client.activeSourceLabel", max: 200 },
};

export function createClientState({ store, audit }) {
  if (!store.setting("meta.instanceId")) store.setSetting("meta.instanceId", randomUUID());

  const bump = userId => {
    const next = Number(store.setting("meta.clientStateVersion", "0")) + 1;
    store.setSetting("meta.clientStateVersion", next, userId);
    return next;
  };

  const read = () => {
    const sheetUrl = store.setting(KEYS.sheetUrl.setting);
    return {
      instanceId: store.setting("meta.instanceId"),
      version: Number(store.setting("meta.clientStateVersion", "0")),
      sheetUrlSet: sheetUrl !== null,
      settings: {
        sheetUrl: sheetUrl ?? "",
        syncMinutes: store.setting(KEYS.syncMinutes.setting, "5"),
        aiMapping: store.setting(KEYS.aiMapping.setting, ""),
        activeSourceLabel: store.setting(KEYS.activeSourceLabel.setting, ""),
      },
    };
  };

  const update = (user, key, rawValue) => {
    const spec = KEYS[key];
    if (!spec) throw new HttpError(400, "Bilinmeyen ayar.");
    let value = typeof rawValue === "string" ? rawValue.trim() : rawValue == null ? "" : String(rawValue);
    if (value.length > spec.max) throw new HttpError(400, "Ayar değeri çok uzun.");
    if (key === "syncMinutes") {
      const minutes = Number(value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new HttpError(400, "Senkron sıklığı 1-1440 dakika arasında olmalı.");
      value = String(minutes);
    }
    if (key === "aiMapping" && value) {
      try {
        JSON.parse(value);
      } catch {
        throw new HttpError(400, "Kolon eşlemesi geçersiz.");
      }
    }
    store.tx(() => {
      const previous = store.setting(spec.setting, "");
      store.setSetting(spec.setting, value, user.id);
      if (key === "sheetUrl") {
        // Kaynak değişince etiket de kaynağa göre güncellenir.
        const label = !value ? "" : value.startsWith(EXCEL_PREFIX) ? value.slice(EXCEL_PREFIX.length) : "Google Sheets";
        store.setSetting(KEYS.activeSourceLabel.setting, label, user.id);
      }
      bump(user.id);
      audit(user, "settings.client.updated", key, { key, previous: key === "aiMapping" ? undefined : previous, value: key === "aiMapping" ? undefined : value });
    });
    return read();
  };

  return { read, update, bump };
}
