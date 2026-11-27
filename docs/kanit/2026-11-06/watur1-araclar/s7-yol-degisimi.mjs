// "Nasıl bozulur" 7 — YOL DEĞİŞİMİ (ölçüm; tasarım docs/erp/WA-TUR1-TASARIM.md §7 7): 002 Elle Bağla (Yol 1) iken kendi iletisinin imzasız bildirimi şirket işaretini koyar;
// sonra 002 WhatsApp'ı Bağla'ya (Yol 2) geçer; Yol 2'deki iletisine HİÇ imzalı bildirim gelmez (ör. kapıcıda uygulama sırrı eksik). Şablonun teslim süresi 12 sa (kısa — Meta'nın
// varsayılanı 30 gün). Soru: Yol 1 döneminin işareti Yol 2 işini TTL + 1 sa'te Süresi Doldu yapıyor mu (kişi aynı dönemde yeniden gönderilecek)?
// Kullanım: node s7-yol-degisimi.mjs <depo kökü>
import path from "node:path";

const REPO = process.argv[2];
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { kurulum, st } = await import(path.join(REPO, "test", "whatsapp-wy-ortak.mjs"));
const { PNID, TOKEN, WABA } = await import(path.join(REPO, "test", "whatsapp-248-ortak.mjs"));
const HOUR = 3_600_000;
const s = await kurulum({ root: "manual", second: "manual" });
try {
  for (const tpl of s.fake.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200;
  const first = await s.sent("Efe Tan", "0533 444 55 71");
  const yol1 = await s.post([st(s, first.job.wamid, "sent")]);
  const markYol1 = s.child().context.store.setting("whatsapp.hookSeen", "");
  const admin = s.server.app.store.get("SELECT id, username, display_name FROM users WHERE username = 'admin'");
  s.child().context.whatsapp.connection.saveEmbedded(admin, { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
  const mode = s.child().context.whatsapp.connection.read().mode;
  const second = await s.sent("Gül Er", "0533 444 55 72");
  const unsigned = await s.post([st(s, second.job.wamid, "delivered")]);
  s.clock.advance(13.5 * HOUR);
  await s.server.app.whatsapp.scheduler.drain();
  const state = (await s.job(second.batchId)).state;
  const skip = (await s.skip(second.accountId)).join(",");
  console.log(`Yol 1 imzasız sent=${yol1.status}, şirket işareti=${markYol1 ? "VAR" : "YOK"}; kip şimdi=${mode}; Yol 2 iletisine imzasız delivered=${unsigned.status} (yazılmaz); 13,5 sa sonra Yol 2 işi: ${state}; kişi önizlemede: ${skip}`);
} finally {
  await s.close();
}
