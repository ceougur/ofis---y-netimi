// 2.4.8 grup 5 (W2 gönderim çekirdeği, W3 PDF, W9 durum kancası) — testin dişi (ders 7; KANIT KURALI 3): çekirdeğin iddialarına bilerek hata enjekte edilir, ilgili
// test dosyaları koşulur, testlerin KIRMIZI olması beklenir. Kaynak ağaç değişmez: kod AYRI kopyada (ders 23, 25) bozulur, her mutasyondan sonra geri yazılır.
// Önce bozulmamış kopyada aynı testlerin YEŞİL olduğu görülür (M0); yoksa "yakalandı" sayılmaz.
//   node docs/kanit/2026-10-30/248-g5-betikler/mutasyon.mjs <kaynak-kök> <boş-çalışma-klasörü> [grup: w2|w3|w9|hepsi]
// Çıktının son satırı "N geçti, M kaldı" (geçti = mutasyon yakalandı; M0 için geçti = yeşil). Kaldı > 0 → çıkış 1.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [SRC, WORK, GROUP = "hepsi"] = process.argv.slice(2);
if (!SRC || !WORK) throw new Error("kullanım: mutasyon.mjs <kaynak-kök> <çalışma-klasörü> [w2|w3|w9|hepsi]");
const src = path.resolve(SRC);
const work = path.resolve(WORK);
mkdirSync(work, { recursive: true });
for (const item of ["server", "client", "test", "tools", "vendor", "bulut", "package.json"]) if (existsSync(path.join(src, item))) cpSync(path.join(src, item), path.join(work, item), { recursive: true });
if (!existsSync(path.join(work, "node_modules"))) symlinkSync(path.join(src, "node_modules"), path.join(work, "node_modules"));

const CORE = "test/whatsapp-w2-cekirdek-248.test.mjs";
const DATA = "test/whatsapp-w2-veri-248.test.mjs";
const DEATH = "test/whatsapp-w2-surec-olumu-248.test.mjs";
const W3 = "test/whatsapp-w3-ekstre-248.test.mjs";
const W9 = "test/whatsapp-w9-kanca-248.test.mjs";
const K = "bulut/kapi/kapi.mjs";
const H = "server/lib/whatsapp/hook.mjs";
const Q = "server/lib/whatsapp/queue.mjs";
const L = "server/lib/whatsapp/defter.mjs";
const MUTATIONS = [
  // ---------- W2 ----------
  { group: "w2", id: "W2-M1 çift gönderim kilidi: defter önceki kabul/belirsiz denemeyi görmez", file: L, from: "      const blocking = previous.find(item => item.outcome !== \"failed\");\n      if (blocking) return { ok: false, previous: blocking };", to: "      const blocking = null;\n      if (blocking) return { ok: false, previous: blocking };", also: { file: L, from: "        const again = q.attempts.all(String(row.jobId)).find(item => item.outcome !== \"failed\");", to: "        const again = null;" }, tests: [CORE, DATA, DEATH] },
  { group: "w2", id: "W2-M2 açılışta 'Gönderiliyor' işi belirsiz yerine Bekliyor'a döner (yeniden gönderir)", file: Q, from: "        if (!attempt.outcome) ledger.outcome({ jobId: job.id, attempt: job.attempt, outcome: \"uncertain\"", to: "        updateJob(job.id, { state: \"pending\" }); continue;\n        if (!attempt.outcome) ledger.outcome({ jobId: job.id, attempt: job.attempt, outcome: \"uncertain\"", tests: [DEATH] },
  { group: "w2", id: "W2-M3 sınır sayacı: pencere sayımı kullanılmaz (sınır hiç dolmaz)", file: Q, from: "    if (limitInfo.limit !== Infinity && !window.phones.has(phone) && window.count >= limitInfo.limit) {", to: "    if (false && limitInfo.limit !== Infinity && !window.phones.has(phone) && window.count >= limitInfo.limit) {", tests: [CORE, DATA] },
  { group: "w2", id: "W2-M4 sınır sayacı gün başında sıfırlanır (kayan 24 saat yerine takvim günü)", file: Q, from: "  const usage = wabaId => ledger.windowUsage(wabaId, iso(nowMs() - DAY_MS));", to: "  const usage = wabaId => ledger.windowUsage(wabaId, new Date(`${today()}T00:00:00`).toISOString());", tests: [CORE, DATA] },
  { group: "w2", id: "W2-M5 pencerede sayılmış alıcı da yeni hak harcar (§7a 4)", file: Q, from: "    if (limitInfo.limit !== Infinity && !window.phones.has(phone) && window.count >= limitInfo.limit) {", to: "    if (limitInfo.limit !== Infinity && window.count >= limitInfo.limit) {", tests: [CORE] },
  { group: "w2", id: "W2-M6 WhatsApp Mesajı İstemiyor atlanmaz", file: Q, from: "    if (Number(account.waOptOut) === 1) return { skip: \"WhatsApp Mesajı İstemiyor\", phone };", to: "", tests: [CORE, DATA] },
  { group: "w2", id: "W2-M7 onay kutusu sunucuda denetlenmez", file: Q, from: "    if (!ack()) fail(409, `Gönderimden önce", to: "    if (false) fail(409, `Gönderimden önce", tests: [CORE] },
  { group: "w2", id: "W2-M8 'Zaten Kuyrukta' kuralı yok (iki sekme iki ileti)", file: Q, from: "      if (!person.skip && queued(account.id, kind, period)) person.skip = \"Zaten Kuyrukta\";", to: "", tests: [CORE] },
  { group: "w2", id: "W2-M9 aynı istek kimliği yeni toplu iş açar (çift tık)", file: Q, from: "    if (existing) return { batch: batchView(existing), reused: true };", to: "", also: { file: Q, from: "    if (again) return { batch: batchView(again), reused: true };", to: "" }, tests: [CORE] },
  { group: "w2", id: "W2-M10 yanıtsız istek belirsiz değil Bekliyor (yeniden gönderilir)", file: Q, from: "      record(\"uncertain\");\n      updateJob(job.id, { state: \"uncertain\", error_code: null, error_text: error.message });", to: "      record(\"failed\");\n      updateJob(job.id, { state: \"pending\", error_code: null, error_text: error.message });", tests: [CORE] },
  { group: "w2", id: "W2-M11 belirteç hatasında toplu iş durmaz (herkese istek gider)", file: Q, from: "    if (kind === \"pause\") {", to: "    if (false) {", tests: [CORE] },
  { group: "w2", id: "W2-M12 geri yüklemede toplu işler defterde durdurulmaz", file: "server/app.mjs", from: "      whatsapp?.ledger.stopCompany(company.id, \"restored\", new Date(config.now()).toISOString());", to: "      void 0;", tests: [DATA] },
  { group: "w2", id: "W2-M19 001'in açılışta uygulanan geri yüklemesi toplu işleri defterde durdurmaz", file: "server/app.mjs", from: "  if (!hub && stagedRestore?.ok) whatsapp.ledger.stopCompany(companyId, \"restored\", new Date(config.now()).toISOString());", to: "  void 0;", tests: [DATA] },
  { group: "w2", id: "W2-M13 taşınan veride (defter yok) eski işler yürür", file: Q, from: "      if (!state.opened || row.ledger_id !== ledger.id || row.company_id !== companyId) {\n        // Bu bilgisayarın defteri", to: "      if (false) {\n        // Bu bilgisayarın defteri", also: { file: Q, from: "    if (!live.live || batch.ledger_id !== ledger.id || batch.company_id !== companyId) {", to: "    if (live.stopped) {" }, tests: [DATA] },
  { group: "w2", id: "W2-M14 salt okunur lisansta işçi durmaz", file: Q, from: "    if (!writable()) {\n      // §7a 25", to: "    if (false) {\n      // §7a 25", tests: [DATA] },
  { group: "w2", id: "W2-M15 Meta sınır hatası yalnız o işi bekletir (WABA'nın bütün işleri değil)", file: Q, from: "      ledger.holdWaba(batch.waba_id, until, `meta-${code}`, iso());", to: "", also: { file: Q, from: "      markLimited(batch.waba_id, until);\n      notify(batch.id);\n      return;", to: "      notify(batch.id);\n      return;" }, tests: [CORE] },
  { group: "w2", id: "W2-M16 'Bu Ay' teslim yerine kabul sayar", file: Q, from: "      delivered: result.waba.delivered,", to: "      delivered: result.waba.accepted,", tests: [DATA] },
  { group: "w2", id: "W2-M17 gönderim anında okunmaz: kuyruktaki eski telefon kullanılır", file: Q, from: "    const phone = check.phone.e164;", to: "    const phone = job.phone_e164;", tests: [DATA] },
  { group: "w2", id: "W2-M18 sabit hat elenir (K1: elenmemeli)", file: "server/lib/whatsapp/alici.mjs", from: "  if (result.wa && result.wa.startsWith(\"90\") && result.wa.length === 12) return { e164: `+${result.wa}`, valid: true, reason: \"\" };", to: "", tests: [CORE] },
  // ---------- W2 revizyonu R1–R3 (plan §7a; 30.10.2026 15:18 UTC kararı) ----------
  { group: "w2", id: "W2-M20 R1: Meta'ya ulaşılamıyorken iş eski kuralla denenip Başarısız / toplu iş duraklar", file: Q, from: "      return waitForConnection(row, job, error.message);", to: "      if (stage === \"check\") return checkLater(error.message);\n      retryLater(null, error.message);\n      return;", tests: [CORE] },
  { group: "w2", id: "W2-M21 R2: şablon her 100 iletide yeniden okunmaz", file: Q, from: " && cached.sent < TEMPLATE_CHECK_EVERY) return cached.result;", to: ") return cached.result;", tests: [CORE] },
  { group: "w2", id: "W2-M22 R2: şablon 10 dakika yerine saatte bir okunur", file: Q, from: "const TEMPLATE_CHECK_MS = 10 * 60_000;", to: "const TEMPLATE_CHECK_MS = 60 * 60_000;", tests: [CORE] },
  { group: "w2", id: "W2-M23 R3: daha önce gönderilen cari açık bayrak olmadan elenmez", file: Q, from: "      if (!person.skip && last && body.sendAgain !== true) person.skip = \"Daha Önce Gönderildi\";", to: "", tests: [CORE, DATA] },
  { group: "w2", id: "W2-M24 R3: hatırlatmanın dönemi gün değil (ertesi gün de 'Daha Önce Gönderildi')", file: Q, from: "(kind === \"statement\" ? `${period.from}|${period.to}` : `gun|${day}`);", to: "(kind === \"statement\" ? `${period.from}|${period.to}` : \"\");", tests: [CORE] },
  // ---------- W3: PDF (dönem, metin = PDF, Meta'da medya) ----------
  { group: "w3", id: "W3-M1 kesinleşen iletinin PDF'i Meta'dan silinmez (S3 A)", file: Q, from: "          await graph.deleteMedia(row.media_id);", to: "          void row;", tests: [W3] },
  { group: "w3", id: "W3-M2 'Meta Bekletti'deki iletinin PDF'i de silinir (§7a 14)", file: Q, from: "const FINAL = [\"delivered\", \"read\", \"failed\", \"expired\", \"canceled\", \"skipped\", \"stopped\"];", to: "const FINAL = [\"delivered\", \"read\", \"failed\", \"expired\", \"canceled\", \"skipped\", \"stopped\", \"held\", \"uncertain\"];", tests: [W3] },
  { group: "w3", id: "W3-M3 wa.me PDF'i dönemi uygulamaz (bütün hareketler)", file: "server/routes/accounts.mjs", from: "      const data = statementData(account, { from, to });", to: "      const data = statementData(account, { from: \"\", to: \"9999-12-31\" });", tests: [W3] },
  { group: "w3", id: "W3-M4 iletinin bakiyesi PDF'in dönem sonu yerine güncel bakiye (metin ≠ PDF)", file: Q, from: "periodText(range, account.ledger || []), balanceText(data.closing)];", to: "periodText(range, account.ledger || []), balanceText(account.totals.balance)];", tests: [W3] },
  { group: "w3", id: "W3-M5 medya hiç yeniden kullanılmaz (her denemede yeni yükleme)", file: Q, from: "      if (!mediaId || !job.media_at || nowMs() - Date.parse(job.media_at) > MEDIA_REUSE_MS || job.media_deleted_at) {", to: "      if (true) {", tests: [W3] },
  { group: "w3", id: "W3-M6 'Tüm Hareketler' bugünle sınırlanmaz (ileri tarihli hareket girer)", file: "server/lib/whatsapp/alici.mjs", from: "  if (preset === \"all\") return { from: \"\", to: today };", to: "  if (preset === \"all\") return { from: \"\", to: \"\" };", tests: [W3] },
  // ---------- W9: durum bildirimi (kapıcı geçişi, imza, işaret, tünel kuralı) ----------
  { group: "w9", id: "W9-M1 kapıcı Meta imzasını karşılaştırmaz (biçimi doğru her imza geçer)", file: K, from: "    return esitMi([...imza].map(b => b.toString(16).padStart(2, \"0\")).join(\"\"), verilen[1].toLowerCase());", to: "    void imza;\n    return true;", tests: [W9] },
  { group: "w9", id: "W9-M2 program kapıcı işaretini denetlemez (tüneli atlatan istek geçer)", file: H, from: "    if (!mark?.ok) return failure(res, 401, \"whatsapp-hook-mark\", \"İstek kapıcıdan gelmedi.\");", to: "", tests: [W9] },
  { group: "w9", id: "W9-M3 kanca işaretinin imzası doğrulanmaz (sahte 'wa1' geçer)", file: "server/lib/mobile-sync.mjs", from: "    if (!checked.ok || (checked.cihaz !== \"wa0\" && checked.cihaz !== \"wa1\")) return { ok: false };\n    return { ok: true, signed: checked.cihaz === \"wa1\" };", to: "    const sahte = String(header || \"\").split(\".\")[1];\n    return { ok: true, signed: checked.ok ? checked.cihaz === \"wa1\" : sahte === \"wa1\" };", tests: [W9] },
  { group: "w9", id: "W9-M4 Yol 2 bağlantısında imzasız bildirim kabul edilir", file: H, from: "    if (record?.mode === \"embedded\" && !mark.signed) return failure(res, 401, \"whatsapp-hook-signature\", \"Meta imzası doğrulanmadı.\");", to: "", tests: [W9] },
  { group: "w9", id: "W9-M5 Sonucu Belirsiz iş imzasız olayla çözülür (§7a 3)", file: Q, from: "      if (!job && signed) {", to: "      if (!job) {", tests: [W9] },
  { group: "w9", id: "W9-M6 kapıcı Meta'nın başlıklarını (çerez, imza) programa geçirir", file: K, from: "    const basliklar = new Headers({ \"x-do-kapi\": `${ms}.${cihaz}.${await hmac(meta.sir, mesaj.vekil(yontem, yolSorgu, cihaz, ms))}` });", to: "    const basliklar = new Headers(request.headers);\n    basliklar.set(\"x-do-kapi\", `${ms}.${cihaz}.${await hmac(meta.sir, mesaj.vekil(yontem, yolSorgu, cihaz, ms))}`);", tests: [W9] },
  { group: "w9", id: "W9-M7 tünel kuralı genişlemez (WhatsApp bağlıyken tünel açılmaz)", file: "server/lib/tunnel/manager.mjs", from: "      const wanted = d.devices > 0 || d.codes > 0 || extra;", to: "      const wanted = d.devices > 0 || d.codes > 0;", tests: [W9] },
  { group: "w9", id: "W9-M8 etkin kanca kaydı her bakım turunda Meta'ya yeniden gider", file: "server/lib/whatsapp/connection.mjs", from: "    if (hook && hook.base === base && hook.state === \"active\") return { skipped: \"active\" };", to: "", tests: [W9] },
  { group: "w9", id: "W9-M9 düşen kanca kaydı saat beklemeden her turda yeniden denenir", file: "server/lib/whatsapp/connection.mjs", from: "now().getTime() - last < HOOK_RETRY_MS && now().getTime() >= last) return { skipped: \"recent\" };", to: "false) return { skipped: \"recent\" };", tests: [W9] },
  { group: "w9", id: "W9-M10 GET doğrulamasında belirteç karşılaştırılmaz", file: H, from: "      const ok = url.searchParams.get(\"hub.mode\") === \"subscribe\" && wa.connection.verifyMatches(url.searchParams.get(\"hub.verify_token\") || \"\");", to: "      const ok = url.searchParams.get(\"hub.mode\") === \"subscribe\";", tests: [W9] },
  { group: "w9", id: "W9-M11 kapıcıda gövde sınırı yok (3 MB üstü programa gider)", file: K, from: "    const boy = Number(request.headers.get(\"content-length\") || 0);\n    if (boy > azami) at(\"kapi-buyuk\");\n    const tampon = new Uint8Array(await request.arrayBuffer());\n    if (tampon.byteLength > azami) at(\"kapi-buyuk\");", to: "    void azami;\n    const tampon = new Uint8Array(await request.arrayBuffer());", tests: [W9] },
];

const run = tests => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...tests], { cwd: work, encoding: "utf8", timeout: 900_000 });
const counts = text => (text.match(/^# (?:tests|pass|fail) \d+$/gm) || []).join(" · ");
const chosen = MUTATIONS.filter(item => GROUP === "hepsi" || item.group === GROUP);
let passed = 0;
let failed = 0;
const allTests = [...new Set(chosen.flatMap(item => item.tests))];
const base = run(allTests);
const green = base.status === 0;
console.log(`M0 bozulmamış kopya: ${green ? "YEŞİL" : "KIRMIZI"} (${counts(base.stdout)})`);
if (green) passed += 1;
else {
  failed += 1;
  console.log(base.stdout.slice(-3000));
}
const apply = (file, from, to) => {
  const full = path.join(work, file);
  const original = readFileSync(full, "utf8");
  if (!original.includes(from)) return null;
  writeFileSync(full, original.replace(from, to));
  return () => writeFileSync(full, original);
};
for (const mutation of chosen) {
  const restores = [];
  const first = apply(mutation.file, mutation.from, mutation.to);
  if (!first) {
    failed += 1;
    console.log(`${mutation.id}: UYGULANAMADI (kaynak metni bulunamadı) — sayılmaz`);
    continue;
  }
  restores.push(first);
  if (mutation.also) {
    const second = apply(mutation.also.file, mutation.also.from, mutation.also.to);
    if (!second) {
      for (const undo of restores.reverse()) undo();
      failed += 1;
      console.log(`${mutation.id}: UYGULANAMADI (ikinci metin bulunamadı) — sayılmaz`);
      continue;
    }
    restores.push(second);
  }
  const result = run(mutation.tests);
  for (const undo of restores.reverse()) undo();
  const caught = result.status !== 0;
  if (caught) passed += 1;
  else failed += 1;
  const failing = (result.stdout.match(/^not ok \d+ - .+$/gm) || []).slice(0, 3).join(" | ");
  console.log(`${mutation.id}: ${caught ? "YAKALANDI" : "YAKALANMADI"} (${counts(result.stdout)}) ${failing}`);
}
rmSync(path.join(work, "node_modules"), { force: true });
console.log(`${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
