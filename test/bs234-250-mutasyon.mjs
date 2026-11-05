#!/usr/bin/env node
// 2.5.0 BS-2 / BS-3 / BS-4 — MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, kopyanın kendi testi koşulur: çıkış ≠ 0 VE çıktıda
// beklenen neden metni varsa YAKALANDI. Kopya dosyası her mutasyondan sonra asıl baytlarıyla geri yazılır.
// Kullanım: node test/bs234-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
// M2 bir arayüz senaryosu koşar (Playwright; PLAYWRIGHT_BROWSERS_PATH ortamdan geçer).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const T_BS2 = ["--test", "test/bs2-kart-iade-ekstre-250.test.mjs"];
const E2E_BS2 = ["test/e2e/senaryo-kart-iade-gecmis-250.mjs"];
const T_BS3 = ["--test", "test/bs3-silinmis-kayit-250.test.mjs"];
const T_BS4 = ["--test", "test/bs4-birlesik-rapor-250.test.mjs"];
const RC = "server/routes/report-center.mjs";
const WS = "client/assets/hof-workspace.js";
const ST = "server/routes/stock.mjs";
const PL = "server/routes/plans.mjs";
const CO = "server/routes/companies.mjs";
// [no, ad, komut, [[dosya, eski metin (dosyada TAM BİR KEZ), yeni metin], …], çıktıda beklenen neden]
const MUTASYONLAR = [
  [1, "BS-2 (a) UM4c: Ayrıntılı Cari Ekstre fatura kökenli dal cardRefund'u yok sayar", T_BS2, [[RC, 'if (line.origin === "invoice") extras.set(line.id, { docNo: invoices.get(line.sourceId)?.number || "", way: cash ? wayOf(line) : "" });', 'if (line.origin === "invoice") extras.set(line.id, { docNo: invoices.get(line.sourceId)?.number || "", way: cash ? methodLabel(line.method, line.kind) : "" });']], '"08.10.2026","POS"'],
  [2, "BS-2 (b): kayıt geçmişi ekran metni cardRefund'u yok sayar", E2E_BS2, [[WS, "HOF.methodLabel(item.method, item.kind, { cardRefund: item.cardRefund === true })", "HOF.methodLabel(item.method, item.kind)"]], "cari tahsilatı (POS)"],
  [3, "BS-3 (d): stok düzeltmesi işlem içinde hareketi yeniden denetlemez", T_BS3, [[ST, "        itemRow(item.id);\n        moveOf(item.id, previous.id);\n", "        itemRow(item.id);\n"]], "stok hareketi düzeltmesi: yazım reddedilmeli (404) — yanıt 409"],
  [4, "BS-3 (f): tahsilat düzeltmesi işlem içinde tahsilatı yeniden denetlemez", T_BS3, [[PL, "        entryOf(plan.id, previous.id);\n", ""]], "tahsilat düzeltmesi: yazım reddedilmeli (404) — yanıt 200"],
  [5, "BS-3 (g): taksit düzeltmesi işlem içinde taksiti yeniden denetlemez", T_BS3, [[PL, "      itemOf(plan.id, previous.id);\n", ""]], "taksit düzeltmesi: yazım reddedilmeli (404) — yanıt 200"],
  [6, "BS-3 (g) ileti: taksit iletisi eski kısa hâline döner", T_BS3, [[PL, 'throw new HttpError(404, "Taksit bulunamadı. Başka biri silmiş olabilir.")', 'throw new HttpError(404, "Taksit bulunamadı.")']], "ileti “Taksit bulunamadı.”"],
  [7, "BS-4: açılamayan şirketin hatası yakalanmaz (500)", T_BS4, [[CO, "        if (error instanceof HttpError) throw error;\n        log?.warn", "        throw error;\n        log?.warn"]], "dosya silinmiş: ekran: rapor üretilmez (409) — yanıt 500"],
  [8, "BS-4: kısmi toplam — açılamayan şirket atlanır, rapor kalanlarla üretilir", T_BS4, [[CO, "    if (failures.length) {", "    if (failures.length && false) {"], [CO, "    const rows = chosen.map(item => {\n      const app = apps.get(item.id);", "    const rows = chosen.filter(item => apps.has(item.id)).map(item => {\n      const app = apps.get(item.id);"]], "dosya silinmiş: ekran: rapor üretilmez (409) — yanıt 200"],
  [9, "BS-4: ileti şirketin kodunu ve adını söylemez", T_BS4, [[CO, "`“${item.code} · ${item.name}” şirketinin ${missing", "`Bir şirketin ${missing"]], "ileti “Bir şirketin veri dosyası bulunamadı"],
  [10, "BS-4: kayıp dosyada kod ayrımı düşer (her zaman company-unavailable)", T_BS4, [[CO, 'code: failures.every(failure => failure.missing) ? "company-data-missing" : "company-unavailable"', 'code: "company-unavailable"']], "code “company-unavailable” (beklenen “company-data-missing”)"],
];

const run = args => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", ...args], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  const e2e = /SONUÇ: (\d+) geçti, (\d+) kaldı/.exec(out);
  return { status: r.status, out, pass: e2e ? Number(e2e[1]) : count("pass"), fail: e2e ? Number(e2e[2]) : count("fail") };
};

const tabanlar = new Map();
for (const args of [T_BS2, E2E_BS2, T_BS3, T_BS4]) {
  if (ONLY && !MUTASYONLAR.some(([no, , cmd]) => ONLY.has(no) && cmd === args)) continue;
  const taban = run(args);
  console.log(`taban ${args.at(-1)}: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
  if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error(`taban testi yeşil değil (${args.at(-1)}) — mutasyon taraması anlamsız\n${taban.out.slice(-3000)}`);
  tabanlar.set(args, taban);
}
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, cmd, degisiklikler, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  const asillar = new Map();
  try {
    for (const [dosya, eski, yeni] of degisiklikler) {
      const yol = path.join(COPY, dosya);
      if (!asillar.has(yol)) asillar.set(yol, readFileSync(yol, "utf8"));
      // Windows'ta git dosyayı CRLF ile çıkarır (ders 27): aramadan önce satır sonu normalleştirilir; geri yazma asıl baytlarla.
      const lf = readFileSync(yol, "utf8").replace(/\r\n/g, "\n");
      const adet = lf.split(eski).length - 1;
      if (adet !== 1) throw new Error(`mutasyon ${no} kurulamadı: eski metin ${adet} kez geçiyor (${dosya})`);
      writeFileSync(yol, lf.replace(eski, yeni));
    }
    const r = run(cmd);
    const kirmizi = r.status !== 0 && r.fail > 0;
    const nedenli = r.out.includes(neden);
    toplam += 1;
    if (kirmizi && nedenli) yakalanan += 1;
    console.log(`${kirmizi && nedenli ? "ok" : "not ok"} ${no} - ${ad} · ${kirmizi ? `KIRMIZI (${r.fail} başarısız)` : "YEŞİL — kaçırdı"} · beklenen neden "${neden}" ${nedenli ? "görüldü" : "GÖRÜLMEDİ"}`);
  } finally {
    for (const [yol, asil] of asillar) writeFileSync(yol, asil);
  }
}
for (const args of tabanlar.keys()) {
  const son = run(args);
  if (son.status !== 0) throw new Error(`mutasyonlardan sonra kopya geri yazılamadı (taban kırmızı: ${args.at(-1)})`);
}
console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${yakalanan}\n# fail ${toplam - yakalanan}\n# cancelled 0\n# skipped 0\n# todo 0`);
console.log(`${yakalanan}/${toplam} mutasyon beklenen nedenle yakalandı`);
process.exit(yakalanan === toplam ? 0 : 1);
