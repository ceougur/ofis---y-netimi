// WhatsApp ORTAK KATMANI — 2.4.8 W2/W9. Ortak katmanda (001'in örneği) tek kez kurulur, çocuk şirket örnekleri aynı nesneyi kullanır (app.mjs hub):
//   ledger    makine düzeyindeki gönderim defteri (lib/whatsapp/defter.mjs; ana veri klasöründe, şirket dosyalarının dışında)
//   scheduler tek işçi (lib/whatsapp/scheduler.mjs; bütün şirketler)
//   registry  şirket → bağlantı özeti (gizli değer yok): tünelin açık olma kuralı ("WhatsApp bağlı" — plan §6 W9) ve gelen durum bildiriminin şirketi
//             (kanca yolunun karması). Açılışta bütün şirketler taranır (açık olmayanın dosyası kısa süreli salt okunur); bağlantı değişince güncellenir.
import { summaryOf } from "./connection.mjs";
import { openWaLedger } from "./defter.mjs";
import { createWaScheduler } from "./scheduler.mjs";

export function createWhatsappHub({ dataDir, log = console, gapMs = 1000, manual = false, fault = null } = {}) {
  const ledger = openWaLedger({ dir: dataDir, log, fault });
  const scheduler = createWaScheduler({ gapMs, manual, log });
  const summaries = new Map();
  const registry = {
    set(companyId, summary) {
      summaries.set(String(companyId), summary || { configured: false });
    },
    get: companyId => summaries.get(String(companyId)) || { configured: false },
    delete: companyId => summaries.delete(String(companyId)),
    /** En az bir şirkette belirteçli WhatsApp bağlantısı var mı (tünel kuralı). */
    anyConfigured: () => [...summaries.values()].some(item => item?.configured),
    /** Kanca yolunun karması → şirket kimliği (yoksa null). */
    companyOfHook: pathHash => {
      for (const [companyId, item] of summaries) if (item?.configured && item.hook?.pathHash && item.hook.pathHash === pathHash) return companyId;
      return null;
    },
    /** Şirketlerin ayar satırlarını yeniden okur: readSetting(company) → whatsapp.meta değeri (okunamazsa null; o şirket atlanır). */
    scan(companies, readSetting) {
      for (const company of companies) {
        if (!company?.id) continue;
        try {
          const value = readSetting(company);
          if (value !== undefined) summaries.set(String(company.id), summaryOf(value));
        } catch (error) {
          log.warn?.(`WhatsApp: ${company.code || company.id} bağlantı özeti okunamadı (${error.message}).`);
        }
      }
    },
    snapshot: () => Object.fromEntries(summaries),
  };
  return {
    ledger,
    scheduler,
    registry,
    async close() {
      await scheduler.stop();
      ledger.close();
    },
  };
}
