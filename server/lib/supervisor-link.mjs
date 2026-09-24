// Uygulama → servis yöneticisi istek/yanıt kanalı (IPC). Yönetici panelindeki güncelleme işlemleri bunu kullanır.
import { HttpError } from "./http.mjs";

export function createSupervisorLink(proc = process) {
  const pending = new Map();
  let sequence = 0;
  const available = () => typeof proc.send === "function" && proc.connected !== false;

  if (typeof proc.on === "function" && typeof proc.send === "function") {
    proc.on("message", message => {
      if (!message || message.type !== "rpc:result" || !pending.has(message.id)) return;
      const { resolve, reject, timer } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timer);
      if (message.ok) resolve(message.result);
      else reject(Object.assign(new HttpError(409, message.error || "Servis yöneticisi işlemi tamamlayamadı."), { code: message.code || null }));
    });
    proc.on("disconnect", () => {
      for (const { reject, timer } of pending.values()) {
        clearTimeout(timer);
        reject(new HttpError(503, "Servis yöneticisiyle bağlantı koptu."));
      }
      pending.clear();
    });
  }

  return {
    get supervised() {
      return available();
    },
    request(action, payload = {}, { timeoutMs = 60_000 } = {}) {
      if (!available()) return Promise.reject(new HttpError(503, "Sunucu servis yöneticisi olmadan çalışıyor."));
      sequence += 1;
      const id = sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new HttpError(504, "Servis yöneticisi zamanında yanıt vermedi."));
        }, timeoutMs);
        timer.unref?.();
        pending.set(id, { resolve, reject, timer });
        try {
          proc.send({ type: "rpc", id, action, payload });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new HttpError(503, `Servis yöneticisine ulaşılamadı: ${error.message}`));
        }
      });
    },
  };
}
