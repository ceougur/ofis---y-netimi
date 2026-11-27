#!/usr/bin/env node
// 2.5.1 D3 — devir planının MUTASYON taraması (KANIT KURALI 3, ders 7, 38; tasarım §3.12 listesi + ön denetimin iki DURDURUR maddesi). Programın AYRI bir kopyasında (ders 23)
// her seferinde TEK bilerek hata açılır, D3 testleri koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d3-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const PLAN = "server/lib/devir/plan.mjs";
const PRE = "server/lib/devir/preflight.mjs";
const ELLE = "test/devir-d3-plan.test.mjs";
const ESDEGER = "test/devir-d3-esdeger.test.mjs";
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
const MUTASYONLAR = [
  [1, "açık kalemin vadesi kaybolur (K+1 olur; vadesizde belge günü yerine)", PLAN, "      vade: item.vade || item.date,", "      vade: nextDay,", [ELLE, ESDEGER], /not ok \d+ - (cari satırları|.*gecikmiş)/],
  [2, "net satır formülünde alacak kalemleri ters işaretli", PLAN, "  const net = balance - openDebt + openCredit;", "  const net = balance - openDebt - openCredit;", [ELLE, ESDEGER], /not ok \d+ - /],
  [3, "Borç / Alacak Toplamı netleşmeden kuyruğa (Borç Toplamı tek başına)", PLAN, "    if (borc) rows.push(base(\"borc-toplami\", borc > 0 ? \"debt\" : \"credit\", Math.abs(borc), \"Devir — Borç Toplamı\", { kuyrugaGirenMinor: net }));", "    if (borc) rows.push(base(\"borc-toplami\", borc > 0 ? \"debt\" : \"credit\", Math.abs(borc), \"Devir — Borç Toplamı\", { kuyrugaGirenMinor: borc }));", [ELLE, ESDEGER], /iki satır kuyruğa girmeden netleşir|gecikmiş/],
  [4, "şüpheli pay açık kalemden düşülmez (M13)", PLAN, "    const amount = minorOf(item.remaining) - minorOf(item.doubtful);", "    const amount = minorOf(item.remaining);", [ELLE], /not ok \d+ - şüpheli \(M13\)/],
  [5, "dönem sonu stok tutarı (N-01) SMM yerine DSS", PLAN, "  const smm = is.smm.estimated && !is.smm.posted ? is.smm.minor : 0;", "  const smm = is.smm.estimated && !is.smm.posted ? is.smm.dssMinor : 0;", [ELLE], /not ok \d+ - kapanış/],
  [6, "691, 692 yerine 690'a kapanır", PLAN, "  if (tax) n06.push(voucherLine(\"692\", \"\", tax), voucherLine(\"691\", \"\", -tax));", "  if (tax) n06.push(voucherLine(\"690\", \"\", tax), voucherLine(\"691\", \"\", -tax));", [ELLE], /691, 690'a DEĞİL 692'ye kapanır|not ok \d+ - kapanış fişleri/],
  [7, "kapanış sırası bozulur (önceki yıl fişleri sona)", PLAN, "  return { vouchers, problems, priorResults, result, bs, is };", "  return { vouchers: [...vouchers.filter(v => v.type !== \"prior-year-result\"), ...vouchers.filter(v => v.type === \"prior-year-result\")], problems, priorResults, result, bs, is };", [ELLE], /not ok \d+ - kapanış fişleri/],
  [8, "KDV dönem etiketi yok sayılır (belge ayı)", PLAN, "      const period = account === \"191\" ? offsetMonth || facts.vatPeriods?.get(entry.id) || month : account === \"391\" ? offsetMonth || month : \"\";", "      const period = account === \"191\" ? offsetMonth || month : account === \"391\" ? offsetMonth || month : \"\";", [ELLE], /not ok \d+ - KDV dönem boyutu/],
  [9, "kartın tükettiği kalem (açık kartın taksiti) açık kaleme girer", PLAN, "    return card && card.closedAtK && card.closeRule === \"keep\" ? \"kart-kalani\" : null;", "    return \"kart-kalani\";", [ELLE], /not ok \d+ - kartlar/],
  [10, "bakiyesi 0 / sıfır tutarlı toplam satırı yazılır", PLAN, "    if (alacak) rows.push(base(\"alacak-toplami\"", "    if (true) rows.push(base(\"alacak-toplami\"", [ELLE], /not ok \d+ - cari satırları/],
  [11, "S-2: Açılış Olabilir onay bekleyen kayıt devri DURDURMAZ (uyarır)", PRE, "    if (decisions.S2 === \"A\") block(\"acilis-olabilir\"", "    if (decisions.S2 === \"A\") notice(\"acilis-olabilir\"", [ELLE], /not ok \d+ - her DURDURUR maddesi/],
  [12, "S-3: düzeltilmemiş Kural Değişikliği Farkı devri DURDURMAZ (uyarır)", PRE, "    if (decisions.S3 === \"A\") block(\"kural-farki\"", "    if (decisions.S3 === \"A\") notice(\"kural-farki\"", [ELLE], /not ok \d+ - her DURDURUR maddesi/],
  [13, "N-13 alt defter hesabına da yazar (modül hesabı fişe girer)", PLAN, "    if (MODULE_ACCOUNTS[row.hesap] || row.hesap === OPENING_GL) continue;", "    if (row.hesap === OPENING_GL) continue;", [ELLE], /not ok \d+ - (N-13|arşiv K kapanışı)/],
  [14, "eksi stoklu ürüne değer verilir (KG-9 / M5)", PLAN, "degerMinor: product.qty > 0 ? product.valueMinor : 0, dayanak", "degerMinor: product.qty < 0 ? 1 : product.valueMinor, dayanak", [ELLE], /not ok \d+ - (stok|kapanış)/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([ELLE, ESDEGER]);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error("taban testi yeşil değil — mutasyon taraması anlamsız");
let caught = 0;
let total = 0;
for (const [no, ad, dosya, eski, yeni, testler, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  total += 1;
  const file = path.join(COPY, dosya);
  const original = readFileSync(file, "utf8");
  const at = original.split(eski).length - 1;
  if (at !== 1) {
    console.log(`M${no} ${ad}: KURULAMADI (metin ${at} kez bulundu)`);
    continue;
  }
  writeFileSync(file, original.replace(eski, yeni));
  try {
    const r = run(testler);
    const reason = neden.test(r.out);
    const ok = r.status !== 0 && reason;
    if (ok) caught += 1;
    const failing = [...r.out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1]).filter(name => !/^D3 /.test(name)).slice(0, 4);
    console.log(`M${no} ${ad}: ${ok ? "YAKALANDI" : "YAŞIYOR"} (çıkış ${r.status}, ${r.fail} kırmızı, neden ${reason ? "görüldü" : "GÖRÜLMEDİ"}) — ${failing.join(" | ")}`);
  } finally {
    writeFileSync(file, original);
  }
}
console.log(`# tests ${total}\n# pass ${caught}\n# fail ${total - caught}`);
process.exit(caught === total ? 0 : 1);
