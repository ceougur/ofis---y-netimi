// W-1(a) + W-2 mutasyon koşucusu (ders 7: bilerek boz → test kırmızı). Her mutasyon AYRI kopyada (çalışma ağacına dokunulmaz — ders 23):
// <kopya>/server (değiştirilmiş) + test + client + package.json; hedef test dosyası kopyada koşulur, "not ok" ve beklenen alt test adı aranır.
// Kullanım: node mutasyon.mjs <worktree> <çıktı klasörü>   (çıkış 1: yakalanmayan mutasyon var)
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , WT, OUT] = process.argv;
const W1 = "test/whatsapp-w1a-belirtec-suresi-250.test.mjs";
const W2 = "test/whatsapp-w2-kaldir-250.test.mjs";
const C = "server/lib/whatsapp/connection.mjs";
const Q = "server/lib/whatsapp/queue.mjs";
const D = "server/lib/whatsapp/defter.mjs";
const R = "server/routes/whatsapp.mjs";
const M = [
  { ad: "M1-calismamis-belirtec-190", dosya: C, eski: "if (!tokenWorked(current) && Number(error.subcode) !== TOKEN_EXPIRED_SUBCODE) return;", yeni: "", test: W1, beklenen: "Meta 190 ama belirteç hiç çalışmamış" },
  { ad: "M2-defter-stop-removed", dosya: D, eski: "'stop:reset', 'stop:removed')))", yeni: "'stop:reset')))", test: W2, beklenen: "bekleyen gönderimler 'Durduruldu'" },
  { ad: "M3-baslatma-engeli-yok", dosya: Q, eski: "const link = connection.sendBlock?.();\n    if (link) return link;", yeni: "", test: W1, beklenen: "süren toplu iş" },
  { ad: "M4-gunde-bir-yok", dosya: C, eski: "if (store.setting(key, \"\") === day) return { show: false, state: status.state, day };", yeni: "", test: W1, beklenen: "bildirim: bitişe 7 gün kala" },
  { ad: "M5-meta-duserse-yerel-kalir", dosya: C, eski: "if (same) store.run(\"DELETE FROM settings WHERE key = ?\", SETTING_KEY);", yeni: "if (same && meta.state !== \"failed\") store.run(\"DELETE FROM settings WHERE key = ?\", SETTING_KEY);", test: W2, beklenen: "Meta düşerse yerel kaldırma YİNE yapılır" },
  { ad: "M6-ikinci-kaldir-yeniden-ister", dosya: C, eski: "    if (removing) return removing;\n    const previous = read();", yeni: "    const previous = read();", test: W2, beklenen: "aynı anda iki Kaldır" },
  { ad: "M7-ortak-waba-silinir", dosya: C, eski: "shared = Boolean(sharedWaba(record.wabaId));", yeni: "shared = false;", test: W2, beklenen: "iki şirket aynı WhatsApp hesabı" },
  { ad: "M8-uyari-esigi-kesin-kucuk", dosya: C, eski: "left <= TOKEN_WARN_DAYS * DAY_MS ? \"expiring\"", yeni: "left < TOKEN_WARN_DAYS * DAY_MS ? \"expiring\"", test: W1, beklenen: "Yol 2 (WhatsApp'ı Bağla)" },
  { ad: "M9-bitis-ani-kesin-buyuk", dosya: C, eski: "const byClock = hasEnd && nowMs >= endMs;", yeni: "const byClock = hasEnd && nowMs > endMs;", test: W1, beklenen: "Yol 2 (WhatsApp'ı Bağla)" },
  { ad: "M10-kaldirmada-durdurma-yok", dosya: R, eski: "{ stopSending: () => queue?.stopForRemoval?.() || 0 }", yeni: "{ stopSending: () => 0 }", test: W2, beklenen: "bekleyen gönderimler 'Durduruldu'" },
  { ad: "M11-yeni-baglanti-silinir", dosya: C, eski: "const same = current && current.tokenSealed === previous.tokenSealed && current.wabaId === previous.wabaId && current.phoneNumberId === previous.phoneNumberId;", yeni: "const same = Boolean(current);", test: W2, beklenen: "Meta beklenirken bağlantı yeniden kurulursa" },
  { ad: "M12-veri-erisimi-uzatir", dosya: C, eski: "const endMs = Math.min(meta.fromIn ?? issuedMs + EMBEDDED_TOKEN_DAYS * DAY_MS, meta.fromData ?? Infinity);", yeni: "const endMs = meta.fromData ?? meta.fromIn ?? issuedMs + EMBEDDED_TOKEN_DAYS * DAY_MS;", test: W1, beklenen: "Yol 2 süresi Meta yanıtında varsa" },
  { ad: "M13-meta-abonelik-silinmez", dosya: C, eski: ".unsubscribeApp(record.wabaId);", yeni: ";", test: W2, beklenen: "Yol 2: Kaldır → Meta'da abonelik silinir" },
  { ad: "M14-190-sure-dolmaz", dosya: C, eski: "if (!(error instanceof MetaGraphError) || error.reason !== \"meta\" || Number(error.code) !== TOKEN_EXPIRED_CODE) return;", yeni: "return;", test: W1, beklenen: "Meta 190, Meta'nın daha önce kabul ettiği belirteçte" },
  { ad: "M15-eski-yol2-suresiz", dosya: C, eski: "const legacyEmbedded = !known && raw.mode === \"embedded\";", yeni: "const legacyEmbedded = false;", test: W1, beklenen: "ek denetim — 2.5.0 öncesi Yol 2 kaydı" },
  { ad: "M17-pdf-adiminda-190-sure-dolumu-ezer", dosya: Q, eski: "if (lateBlock && !(ownMetaError && lateBlock.code === \"whatsapp-token-expired\")) {", yeni: "if (lateBlock) {", test: "test/whatsapp-w2-veri-248.test.mjs", beklenen: "toplu gönderim, hata ve durum uçlarının" },
  { ad: "M16-onizleme-meta-okur", dosya: Q, eski: "    const link = connection.sendBlock?.();\n    if (link) fail(409, link.message, link.code);\n", yeni: "", test: W1, beklenen: "Yol 2 (WhatsApp'ı Bağla)" },
];

mkdirSync(OUT, { recursive: true });
let yakalanmayan = 0;
const satirlar = [];
for (const m of M) {
  const kopya = path.join(OUT, "kopya");
  rmSync(kopya, { recursive: true, force: true });
  mkdirSync(kopya, { recursive: true });
  for (const parca of ["server", "client", "test", "package.json"]) cpSync(path.join(WT, parca), path.join(kopya, parca), { recursive: true });
  const hedef = path.join(kopya, m.dosya);
  const kaynak = readFileSync(hedef, "utf8");
  const adet = kaynak.split(m.eski).length - 1;
  if (adet !== 1) {
    satirlar.push(`${m.ad}: UYGULANAMADI (eşleşme ${adet})`);
    yakalanmayan += 1;
    continue;
  }
  writeFileSync(hedef, kaynak.replace(m.eski, m.yeni));
  const r = spawnSync(process.execPath, ["--test", "--test-timeout=60000", m.test], { cwd: kopya, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9", TZ: "UTC" }, encoding: "utf8", timeout: 600_000 });
  const cikti = `${r.stdout || ""}${r.stderr || ""}`;
  writeFileSync(path.join(OUT, `${m.ad}.txt`), cikti);
  const kirmizi = cikti.split(/\r?\n/).filter(line => /^    not ok \d+ - /.test(line)).map(line => line.replace(/^    not ok \d+ - /, ""));
  const tuttu = r.status !== 0 && kirmizi.some(ad => ad.startsWith(m.beklenen));
  if (!tuttu) yakalanmayan += 1;
  const sayi = (cikti.match(/^# (tests|pass|fail) \d+/gm) || []).join(", ");
  satirlar.push(`${tuttu ? "YAKALANDI" : "YAKALANMADI"} ${m.ad} (çıkış ${r.status}; ${sayi}) kırmızı: ${kirmizi.map(ad => ad.slice(0, 60)).join(" | ")}`);
  console.log(satirlar.at(-1));
}
rmSync(path.join(OUT, "kopya"), { recursive: true, force: true });
writeFileSync(path.join(OUT, "OZET.txt"), `${satirlar.join("\n")}\n`);
console.log(`\n# tests ${M.length}\n# pass ${M.length - yakalanmayan}\n# fail ${yakalanmayan}`);
process.exitCode = yakalanmayan ? 1 : 0;
