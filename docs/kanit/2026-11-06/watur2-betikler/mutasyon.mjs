// WhatsApp tur 2 mutasyon koşucusu: watur2-mut kopyasında (git archive HEAD — yeni kod) her mutasyonu uygular, ilgili test hücrelerini koşar (TZ verilen), sonucu yazar,
// dosyayı geri koyar. Çıpa tam bir kez eşleşmeli (yoksa UYGULANAMADI). Kullanım: TZ=… node mutasyon.mjs [süzgeç]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const COPY = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/watur2-mut";
const Q = "server/lib/whatsapp/queue.mjs";
const C = "server/lib/whatsapp/connection.mjs";
const D = "server/lib/whatsapp/defter.mjs";
const H = "server/lib/whatsapp/hook.mjs";
const L = "server/lib/license.mjs";
const S = "server/lib/whatsapp/saklama.mjs";
const T1 = "test/whatsapp-tur2-bildirim-yolu-250.test.mjs";
const T2 = "test/whatsapp-tur2-kvkk-250.test.mjs";
const MUTANTS = [
  ["M1 İş 1 karşı: v2.4.9 WABA düzeyi hook_seen yine okunur", Q, `    const seen = Date.parse(store.setting(HOOK_SEEN_KEY, "") || "");`,
    `    const seen = Math.max(Date.parse(ledger.hookSeenAt?.(connection.read()?.wabaId || "") || "") || -Infinity, Date.parse(store.setting(HOOK_SEEN_KEY, "") || "") || -Infinity);`, T1, "T2-1"],
  ["M2a S58 yok: kip değişince işaret silinmez", C, "const reset = Boolean(seen) && markMode !== record.mode;", "const reset = false;", T1, "T2-2"],
  ["M2b S58 karşı: her kayıtta işaret silinir (aynı kip dahil)", C, "const reset = Boolean(seen) && markMode !== record.mode;", "const reset = Boolean(seen);", T1, "T2-2"],
  ["M2c işaretin kipi yazılmaz", Q, `if (mode && store.setting(HOOK_SEEN_MODE_KEY, "") !== mode) store.setSetting(HOOK_SEEN_MODE_KEY, mode);`, "void mode;", T1, "T2-2"],
  ["M3a adres denetimi uygulamasız kayıtla (WABA başına)", C, "    const hook = hooks.hookOf(record.wabaId, hookAppOf(record.mode));\n    if (!hook || hook.base !== base)", "    const hook = hooks.hookOf(record.wabaId);\n    if (!hook || hook.base !== base)", T1, "T2-3"],
  ["M3a2 kayıt yazımı uygulamasız (tek kayıt: eski davranış)", D, "      const app = hookAppOf(row.app);\n      q.hookEvent.run(", "      const app = \"manual\";\n      q.hookEvent.run(", T1, "T2-3"],
  ["M3b S41 denetimi WhatsApp'ı Bağla şirketiyle de", H, `if (!record || record.wabaId !== wabaId || record.mode === "embedded") continue;`, "if (!record || record.wabaId !== wabaId) continue;", T1, "T2-3b"],
  ["M3c eski kaydın sahibi hep Elle Bağla (mixed yok)", D, `const owner = modes.has("embedded") && modes.has("manual") ? "mixed" : modes.has("embedded") ? "embedded" : "manual";`, `const owner = "manual";`, T1, "T2-3d"],
  ["M3d eski tek kaydın yolu kabul edilmez", D, "        const legacy = q.hookLastApp.get(row.wabaId, \"\");\n        if (legacy?.path_hash !== hash) continue;", "        const legacy = q.hookLastApp.get(row.wabaId, \"\");\n        if (legacy || true) continue;", T1, "T2-3c"],
  ["M4a S62 yok: talep salt okunurda 403", L, "  /^\\/api\\/workspace\\/whatsapp\\/kvkk-erase$/,\n", "", T2, "T2-4"],
  ["M4b S62 geniş: bütün WhatsApp yazmaları açık", L, "  /^\\/api\\/workspace\\/whatsapp\\/kvkk-erase$/,\n", "  /^\\/api\\/workspace\\/whatsapp\\//,\n", T2, "T2-4"],
  ["M5a bakım turu defteri yeniden uygulamaz", Q, "    if (ledgerRetry) await retryLedgerErasures();\n", "", T2, "T2-5"],
  ["M5e talep anında düşen anonimleştirme bayrak koymaz", Q, "    } catch (error) {\n      ledgerRetry = true;\n      log.warn?.(`WhatsApp gönderim defterinde", "    } catch (error) {\n      log.warn?.(`WhatsApp gönderim defterinde", T2, "T2-5"],
  ["M5b açılışta defter tarafı yeniden denemesi kurulmaz", Q, "    if (list.length) ledgerRetry = true;\n", "", T2, "T2-5"],
  ["M5c S42 yalnız defterden", Q, "        erasedInFlight = Boolean(erasedOf(jobRow(job.id)?.params_json));", "        erasedInFlight = false;", T2, "T2-5"],
  ["M5d süpürme açık wamid'i özetlemez", Q, "      const plain = rows.filter(row => row.erased);", "      const plain = [];", T2, "T2-5c"],
  ["MX3 scrubDigits etkisiz", S, `export const scrubDigits = text => String(text || "").replace(`, `export const scrubDigits = text => String(text || "") || String(text || "").replace(`, T2, "T2-6"],
  ["M6b sonradan yazılan hata metni arındırılmaz", Q, `"error_text = CASE WHEN params_json LIKE '{%' THEN ? ELSE ? END"`, `"error_text = CASE WHEN 0 THEN ? ELSE ? END"`, T2, "T2-6"],
  ["M7 şirket dosyası denetim noktası yeniden denenmez", Q, "    if (flushPending) flushStore();\n", "", T2, "T2-7"],
  ["M7b defter denetim noktası yeniden denenmez", Q, "    if (flushPending) flushStore();\n    if (ledger.flushPending?.()) ledger.flush?.();\n", "    if (flushPending) flushStore();\n", T2, "T2-7"],
  ["M8 silinmiş cari aranmaz", Q, "    return rows.filter(matches).slice(0, limit)", "    return rows.filter(() => false).slice(0, limit)", T2, "T2-8"],
  ["M8b arama yetkisi accounts.view", "server/routes/whatsapp.mjs", `  router.get("/api/workspace/whatsapp/kvkk-deleted", async ({ req, res, url }) => {\n    auth.requirePermission(req, "system.manage");`, `  router.get("/api/workspace/whatsapp/kvkk-deleted", async ({ req, res, url }) => {\n    auth.requirePermission(req, "accounts.view");`, T2, "T2-8"],
  ["M12 kaydı olan WABA denetimi kalkar", H, "      if (!registeredWaba(wabaId)) continue;", "      if (false && !registeredWaba(wabaId)) continue;", T1, "T2-9a"],
  ["MX2 talepte PDF satırı silinmez", Q, "          store.run(`DELETE FROM wa_job_pdfs WHERE job_id IN (${marks})`, ...part);", "          void marks;", T2, "T2-9b"],
];
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
let caught = 0;
let ran = 0;
for (const [name, rel, from, to, testFile, pattern] of MUTANTS) {
  if (only && !only.test(name)) continue;
  const file = path.join(COPY, rel);
  const original = readFileSync(file, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(JSON.stringify({ name, verdict: `UYGULANAMADI (${count} eşleşme)` }));
    continue;
  }
  writeFileSync(file, original.replace(from, to));
  try {
    const res = spawnSync(process.execPath, ["--test", "--test-name-pattern", pattern, testFile], { cwd: COPY, env: { ...process.env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
    const text = `${res.stdout}\n${res.stderr}`;
    const num = key => Number((new RegExp(`^# ${key} (\\d+)`, "m").exec(text) || [])[1] ?? NaN);
    const failed = [...text.matchAll(/^\s+not ok \d+ - (T2-[^ ]+ .{0,60})/gm)].map(m => m[1]);
    const verdict = res.status !== 0 && num("fail") > 0 ? "YAKALANDI" : "KAÇTI";
    ran += 1;
    if (verdict === "YAKALANDI") caught += 1;
    console.log(JSON.stringify({ name, verdict, exit: res.status, tests: num("tests"), pass: num("pass"), fail: num("fail"), failed }));
  } finally {
    writeFileSync(file, original);
  }
}
console.log(`# mutasyon ${caught}/${ran} yakalandı (TZ=${process.env.TZ || "yerel"})`);
