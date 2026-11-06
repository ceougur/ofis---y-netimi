// WhatsApp tur 1 mutasyon aracı — YALNIZ mutasyon kopyasında (watur1-mut-af9c74c0) çalışır (ders 23). node mut.mjs apply <ad> | restore <ad> | list
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur1-mut-af9c74c0";
const HOOK = "server/lib/whatsapp/hook.mjs";
const BUSY = '    if (ledgerWritable === false || ledgerWritable === PROBE_CLOSED) return failure(res, 503, "whatsapp-hook-busy", "Şirket şu anda açılamıyor; bildirim yeniden denenecek.");\n';
const LOOP = "    for (const items of groups.values()) {\n      const { companyId, wabaId } = items[0].owner;";
const OWNER = '            const owner = hooks.companyOfWamid(wamid) || (signed ? hooks.companyOfJob(String(status?.biz_opaque_callback_data || "").slice(0, 120)) : null) || movedOwnerOf(wamid, lookup);';
const DELIVER_APP = "    return deliver(res, batches, mark.signed === true);";
const M = {
  // S33 B + S43 B: işaret her POST'ta WABA düzeyinde (3fe5a92d'nin davranışı)
  "M1-her-post-waba-isareti": [HOOK, BUSY, `${BUSY}    for (const w of batches.keys()) hooks.hookSeen?.(w, now().toISOString());\n`],
  // S33 B: imzasız ve tanınan bildirim WABA düzeyinde işaret koyar
  "M2-imzasiz-waba-isareti": [HOOK, LOOP, `    if (!signed) for (const items of groups.values()) hooks.hookSeen?.(items[0].owner.wabaId, now().toISOString());\n${LOOP}`],
  // İşaretin WABA düzeyine dönmesi (yalnız imzalı tanınan — tasarım §2'nin reddettiği P seçeneği)
  "M3-imzali-waba-isareti": [HOOK, LOOP, `    if (signed) for (const items of groups.values()) hooks.hookSeen?.(items[0].owner.wabaId, now().toISOString());\n${LOOP}`],
  // S43 B: tanınmayan wamid işaret koyar
  "M4-taninmayan-isaret": [HOOK, "              if (!owner) unowned.set(wabaId, (unowned.get(wabaId) || 0) + 1);", "              if (!owner) unowned.set(wabaId, (unowned.get(wabaId) || 0) + 1);\n              if (!owner) hooks.hookSeen?.(wabaId, now().toISOString());"],
  // Y18-13 karşı seçeneği (kâhin M259): tanıma yalnız wamid kaydıyla (iş kimliği yok)
  "M5-yalniz-wamid-tanima": [HOOK, OWNER, "            const owner = hooks.companyOfWamid(wamid) || movedOwnerOf(wamid, lookup);"],
  // S41 B: uygulama düzeyi POST işlenmez (eski karar 5)
  "M6-uygulama-duzeyi-islenmez": [HOOK, DELIVER_APP, "    return reply(res, 200, { ok: true });"],
  // S41: uygulama düzeyinde imza aranmaz (Yol 2 imzasız kabul)
  "M7-uygulama-duzeyi-imza-yok": [HOOK, DELIVER_APP, "    return deliver(res, batches, true);"],
  // S41: Meta'daki adres yeniden denetlenmez
  "M8-adres-denetimi-yok": [HOOK, "      appWebhook.rechecks?.request(wabaId, () =>", "      false && appWebhook.rechecks?.request(wabaId, () =>"],
  // Sıklık sınırı yok (her POST'ta Meta'ya okuma)
  "M9-siklik-siniri-yok": ["server/lib/whatsapp/app-webhook.mjs", "      if (Number.isFinite(previous) && at >= previous && at - previous < APP_LEVEL_RECHECK_MS) return false;", "      void previous;"],
  // Salt okunur lisansta da denetim
  "M10-lisans-denetimi-yok": [HOOK, "      if (context.license?.writable?.() === false) continue;\n", ""],
  // Arka planda yazılamayan (kilit / şema kapısı) şirkette de denetim
  "M11-yazilabilirlik-denetimi-yok": [HOOK, "      if (context.canWriteInBackground?.() === false) continue;\n", ""],
  // Kayıt denetimi yok (kaydı olmayan WABA'nın bildirimi de işlenmeye alınır)
  "M12-kayit-denetimi-yok": [HOOK, "      if (!registeredWaba(wabaId)) continue;\n", ""],
  // DÜŞÜK-2 (dar kontrol m5): kip WABA'ya bağlı değil
  "M13-kip-waba-yok": ["server/lib/whatsapp/hub.mjs", "    if (item?.mode && item.wabaId === String(wabaId)) return item.mode;", "    if (item?.mode) return item.mode;"],
  // "hemen" değil: bakım turunun saatlik kuralı (force yok)
  "M15-force-yok": [HOOK, '{ force: true }', '{ force: false }'],
  // Webhook Bilgileri: boş belirteç satırı ve Kopyala yine görünür
  "M14-bos-belirtec-gorunur": ["client/assets/hof-whatsapp-ayar.js", "    const hasVerify = Boolean(info.verifyToken);", "    const hasVerify = true;"],
};
const [cmd, name] = process.argv.slice(2);
if (cmd === "list") {
  console.log(Object.keys(M).join("\n"));
  process.exit(0);
}
const spec = M[name];
if (!spec) throw new Error(`bilinmeyen mutasyon ${name}`);
const file = path.join(ROOT, spec[0]);
const keep = `${file}.mut-orijinal`;
if (cmd === "apply") {
  const text = readFileSync(file, "utf8");
  const count = text.split(spec[1]).length - 1;
  if (count !== 1) throw new Error(`${name}: kalıp ${count} kez bulundu (1 olmalı)`);
  if (!existsSync(keep)) copyFileSync(file, keep);
  writeFileSync(file, text.replace(spec[1], spec[2]));
  console.log(`uygulandı ${name} → ${spec[0]}`);
} else if (cmd === "restore") {
  copyFileSync(keep, file);
  unlinkSync(keep);
  console.log(`geri alındı ${name}`);
} else throw new Error("apply | restore | list");
