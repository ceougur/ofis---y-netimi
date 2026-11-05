#!/usr/bin/env node
// 2.5.0 Ç1 — hesap planı sınıflamasının MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, kopyanın kendi test/hesap-plani-sinif-250.test.mjs
// dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden metni varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: node test/hesap-plani-sinif-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const F = "server/lib/general-ledger.mjs";
// [no, ad, eski metin (dosyada TAM BİR KEZ), yeni metin, çıktıda beklenen neden]
const MUTASYONLAR = [
  [1, "bir hesabın sınıfı silinir (102 bilanço kalemi yok)", '102: aktif("Bankalar (Havale / EFT)", "I.A",', '102: aktif("Bankalar (Havale / EFT)", null,', "102 Bankalar (Havale / EFT): sınıfsız"],
  [2, "çift sınıf (100 hem bilanço hem gelir tablosu)", '100: aktif("Kasa (Nakit)", "I.A", KESIN_DEGIL),', '100: aktif("Kasa (Nakit)", "I.A", KESIN_DEGIL, { gelirTablosu: "A" }),', "100 Kasa (Nakit): çift sınıflı"],
  [3, "yanlış kalem (153 Stoklar yerine Ticari Alacaklar)", '153: aktif("Ticari Mallar (Stok Alımları)", "I.E",', '153: aktif("Ticari Mallar (Stok Alımları)", "I.C",', "153: beklenen aktif I.E, program aktif I.C"],
  [4, "aktif hesap pasif kaleminde (191 → III.I)", '191: aktif("İndirilecek KDV", "I.H"),', '191: aktif("İndirilecek KDV", "III.I"),', "191 İndirilecek KDV: aktif hesap pasif kaleminde"],
  [5, "ters bakiye hedefi yanlış (alacaklı 120 → 159)", 'brut("III.D", "340", "cari")', 'brut("III.D", "159", "cari")', "ters bakiye kalemi hedef hesabın kalemi değil"],
  [6, "ters bakiye kuralı düşer (borçlu 360 Kesin Değil'siz)", 'brut("I.H", "198", "hesap", { kesinDegil: true })', 'brut("I.H", "198", "hesap")', "360 ters bakiyesi"],
  [7, "eklenen hesap düşer (591 yok)", '  591: pasif("Dönem Net Zararı (−)", "V.F", null, { duzenleyici: true }),\n', "", "591: planda yok"],
  [8, "düzenleyici işareti düşer (580)", '580: pasif("Geçmiş Yıllar Zararları (−)", "V.E", null, { duzenleyici: true }),', '580: pasif("Geçmiş Yıllar Zararları (−)", "V.E"),', "düzenleyici (−) hesaplar"],
  [9, "7/A yansıtma hedefi yanlış (770 → 631)", '770: gider("Genel Yönetim Giderleri", "E", { yansitma: "771", hedef: "632" }),', '770: gider("Genel Yönetim Giderleri", "E", { yansitma: "771", hedef: "631" }),', "770 Genel Yönetim Giderleri: yansıtma hesabı tutarsız"],
  [10, "770 adı eski hâline döner", '770: gider("Genel Yönetim Giderleri", "E",', '770: gider("Genel Giderler ve Alış Faturaları", "E",', "Genel Giderler ve Alış Faturaları"],
  [11, "yansıtma hesabına mali tablo kalemi verilir (771 → E)", 'yansitma = (ad, kaynak, hedef) => planItem(ad, "yansitma", { kaynak, hedef });', 'yansitma = (ad, kaynak, hedef) => planItem(ad, "yansitma", { kaynak, hedef, gelirTablosu: "E" });', "771 Genel Yönetim Giderleri Yansıtma Hesabı: çift sınıflı"],
  [12, "alt hesap tanımı düşer (770.90)", '  "770.90": "Sınıflandırılmamış",\n', "", "not ok 7 - alt hesap tanımları"],
  [13, "önceki dönem geliri yanlış kalemde (671 I → F)", '671: gelir("Önceki Dönem Gelir ve Kârları", "I"),', '671: gelir("Önceki Dönem Gelir ve Kârları", "F"),', "671: beklenen gelir I, program gelir F"],
];

const run = () => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "test/hesap-plani-sinif-250.test.mjs"], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run();
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error("taban testi yeşil değil — mutasyon taraması anlamsız");
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, eski, yeni, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  const yol = path.join(COPY, F);
  const asil = readFileSync(yol, "utf8");
  const adet = asil.split(eski).length - 1;
  if (adet !== 1) throw new Error(`mutasyon ${no} kurulamadı: eski metin ${adet} kez geçiyor (${F})`);
  writeFileSync(yol, asil.replace(eski, yeni));
  let r;
  try {
    r = run();
  } finally {
    writeFileSync(yol, asil);
  }
  const kirmizi = r.status !== 0 && r.fail > 0;
  const nedenli = r.out.includes(neden);
  toplam += 1;
  if (kirmizi && nedenli) yakalanan += 1;
  console.log(`${kirmizi && nedenli ? "ok" : "not ok"} ${no} - ${ad} · ${kirmizi ? `KIRMIZI (${r.fail} başarısız)` : "YEŞİL — kaçırdı"} · beklenen neden "${neden}" ${nedenli ? "görüldü" : "GÖRÜLMEDİ"}`);
}
const son = run();
if (son.status !== 0) throw new Error("mutasyonlardan sonra kopya geri yazılamadı (taban kırmızı)");
console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${yakalanan}\n# fail ${toplam - yakalanan}\n# cancelled 0\n# skipped 0\n# todo 0`);
console.log(`${yakalanan}/${toplam} mutasyon beklenen nedenle yakalandı`);
process.exit(yakalanan === toplam ? 0 : 1);
