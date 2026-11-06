// WhatsApp ORTAK KATMANI — 2.4.8 W2/W9. Ortak katmanda (001'in örneği) tek kez kurulur, çocuk şirket örnekleri aynı nesneyi kullanır (app.mjs hub):
//   ledger    makine düzeyindeki gönderim defteri (lib/whatsapp/defter.mjs; ana veri klasöründe, şirket dosyalarının dışında)
//   scheduler tek işçi (lib/whatsapp/scheduler.mjs; bütün şirketler)
//   registry  şirket → bağlantı özeti (gizli değer yok): tünelin açık olma kuralı ("WhatsApp bağlı" — plan §6 W9). Açılışta bütün şirketler taranır (açık
//             olmayanın dosyası kısa süreli salt okunur); bağlantı değişince güncellenir. T2-3/4: gelen durum bildiriminin şirketi artık defterden (WABA'nın
//             kanca kaydı + wamid → şirket; lib/whatsapp/hook.mjs), kayıttan değil.
//   appWebhook 2.5.0 WE: Elle Bağla'nın uygulama düzeyi webhook bilgileri (kurulum başına; ortak katmanın deposunda mühürlü — lib/whatsapp/app-webhook.mjs).
import { createAppWebhook } from "./app-webhook.mjs";
import { summaryOf } from "./connection.mjs";
import { openWaLedger } from "./defter.mjs";
import { createWaScheduler } from "./scheduler.mjs";

export function createWhatsappHub({ dataDir, store = null, now = () => new Date(), log = console, gapMs = 1000, manual = false, fault = null } = {}) {
  const ledger = openWaLedger({ dir: dataDir, log, fault });
  const scheduler = createWaScheduler({ gapMs, manual, log });
  const appWebhook = store ? createAppWebhook({ store, dataDir, now }) : null;
  const summaries = new Map();
  // 2.5.0 WY: özetteki kip makine defterine de yazılır (şirket + WABA; lib/whatsapp/defter.mjs noteMode) — program yeniden açılıp şirketin dosyası açılamazken de durum
  // bildirimi Yol 2'nin imzasız bildirimini tanır. Kimliksiz özet (bağlantı kaldırıldı / dosya okunamadı) son kipi SİLMEZ.
  const remember = (companyId, summary) => {
    if (summary?.wabaId && summary?.mode) ledger.noteMode?.(companyId, summary.wabaId, summary.mode);
  };
  const registry = {
    set(companyId, summary) {
      summaries.set(String(companyId), summary || { configured: false });
      remember(companyId, summary);
    },
    get: companyId => summaries.get(String(companyId)) || { configured: false },
    delete: companyId => summaries.delete(String(companyId)),
    /** En az bir şirkette belirteçli WhatsApp bağlantısı var mı (tünel kuralı). */
    anyConfigured: () => [...summaries.values()].some(item => item?.configured),
    /** Şirketlerin ayar satırlarını yeniden okur: readSetting(company) → whatsapp.meta değeri (okunamazsa null; o şirket atlanır). */
    scan(companies, readSetting) {
      for (const company of companies) {
        if (!company?.id) continue;
        try {
          const value = readSetting(company);
          if (value !== undefined) {
            const summary = summaryOf(value);
            summaries.set(String(company.id), summary);
            remember(company.id, summary);
          }
        } catch (error) {
          log.warn?.(`WhatsApp: ${company.code || company.id} bağlantı özeti okunamadı (${error.message}).`);
        }
      }
    },
    snapshot: () => Object.fromEntries(summaries),
  };
  /**
   * 2.5.0 WY: şirketin bu WABA'daki bağlantı kipi ("manual" | "embedded" | null — bilinmiyor). Önce ortak kayıt (bellekte; açılışta bütün şirketlerden, değişince duyuruyla),
   * özet bu WABA'nın değilse / kimliksizse makine defterindeki son kip. Durum bildirimi (lib/whatsapp/hook.mjs) şirket dosyası açılamazken buna bakar.
   */
  function modeOf(companyId, wabaId) {
    const item = summaries.get(String(companyId));
    if (item?.mode && item.wabaId === String(wabaId)) return item.mode;
    return ledger.modeOf?.(companyId, wabaId) || null;
  }
  return {
    ledger,
    scheduler,
    registry,
    modeOf,
    appWebhook,
    async close() {
      await scheduler.stop();
      ledger.close();
    },
  };
}
