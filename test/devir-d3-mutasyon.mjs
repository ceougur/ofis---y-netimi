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
const READER = "server/lib/devir/plan-reader.mjs";
const ELLE = "test/devir-d3-plan.test.mjs";
const ESDEGER = "test/devir-d3-esdeger.test.mjs";
// D3 tur 2 testleri (API verisi, elle sayılar)
const BAG = "test/devir-d3-bag.test.mjs";
const EVRAK = "test/devir-d3-evrak.test.mjs";
const BANKA = "test/devir-d3-banka.test.mjs";
const OLGU = "test/devir-d3-olgu.test.mjs";
const SUPHELI = "test/devir-d3-supheli.test.mjs";
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
  [15, "açık kalemin kuyruk rolü kaybolur (ödeme rolündeki kalem yükümlülük olur)", PLAN, "      rol: item.due ? \"yukumluluk\" : \"odeme\",", "      rol: \"yukumluluk\",", [ESDEGER], /not ok \d+ - (plan elle|.*gecikmiş|ROL)/],
  // ---- D3 tur 2: bu turun her sınıfı için en az bir mutant ----
  [16, "bağ yönlendirmesi: K sonrası bağ açık faturanın devir kalemine değil arşive yönelir", PLAN, "      return openInvoices.has(link.invoiceId)", "      return false", [BAG], /not ok \d+ - bağ listesi/],
  [17, "bağ listesi: Mahsup Et'in karşı belgesi (counter_id) okunmaz", READER, "AND counter_type = 'invoice' AND counter_id IN (${before})`, K)) add(", "AND counter_type = 'invoice' AND 0 AND counter_id IN (${before})`, K)) add(", [BAG], /not ok \d+ - bağ listesi/],
  [18, "bağ listesi: iade → asıl fatura bağı okunmaz", READER, "WHERE issue_date > ?1 AND original_id <> '' AND original_id IN", "WHERE 0 AND issue_date > ?1 AND original_id <> '' AND original_id IN", [BAG], /not ok \d+ - bağ listesi/],
  [19, "evrak durumu: bankada tahsildeki evrak portföyde sayılır", READER, "    if (state === \"portfolio\" && Number(row.inBank) > 0) state = \"bank\";", "", [EVRAK], /not ok \d+ - (her evrak|ön izleme sayıları|kapanış = açılış)/],
  [20, "evrak durumu: K'deki değil BUGÜNKÜ son olay okunur", READER, "WHERE e.cheque_id = c.id AND e.date <= ?1 ORDER BY e.date DESC", "WHERE e.cheque_id = c.id ORDER BY e.date DESC", [EVRAK], /not ok \d+ - (her evrak|ön izleme sayıları|kapanış = açılış)/],
  [21, "alt hesap açılışı: kredi kartı (309) banka açılışlarına girmez", PLAN, "    if (![\"102\", \"108\", \"300\", \"309\"].includes(row.hesap)) continue;", "    if (![\"102\", \"108\", \"300\"].includes(row.hesap)) continue;", [BANKA], /not ok \d+ - (her alt hesap|kapanış = açılış)/],
  [22, "POS alt hesabının sahibi okunmaz (atanmamış sayılır)", PLAN, "    const pos = row.hesap === \"108\" && !owner ? posBySub.get(row.alt) : null;", "    const pos = null;", [BANKA], /not ok \d+ - her alt hesap/],
  [23, "şüphelinin K payı: K sonrası tahsilat / Değersiz de düşülür", READER, ".filter(credit => credit.date <= K);", ";", [SUPHELI], /not ok \d+ - \(e\) şüpheli K payı/],
  [24, "129 karşılık cari boyutunda beklenir (tur 1 hâli)", PLAN, " : row.cari ? -(own?.provisionMinor || 0) : -looseProvision;", " : -(own?.provisionMinor || 0);", [SUPHELI], /not ok \d+ - \(e\) şüpheli K payı/],
  [25, "kart durumu: K'den SONRA kapanan kart K'de kapalı sayılır", READER, " && String(row.closedAt).slice(0, 10) <= K,", ",", [SUPHELI], /not ok \d+ - \(f\) K'den SONRA Borçta Kalsın/],
  [26, "kilit: kilitli dönemde donmuş defter yerine canlı türetme okunur", READER, "  const entries = ledger.book({ to: K, live }).filter(entry => entry.date <= K);", "  const entries = live.filter(entry => entry.date <= K);", [OLGU], /not ok \d+ - elle: K kapanışında 600/],
  [27, "M12: bakiyesi 0 ve açık kalemsiz hareketli cariye iki toplam satırı yazılır", PLAN, "  if (balance === 0 && !open.length) return { rows: [], open, balance, openDebt: 0, openCredit: 0, net: 0 };", "", [EVRAK], /not ok \d+ - kapanış = açılış/],
  [28, "e-Belge: Sonucu Belirsiz gönderim sayılmaz (yalnız 'processing')", READER, "(e_status = 'processing' OR ${uncertain})", "(e_status = 'processing')", [OLGU], /not ok \d+ - ön denetim \(10\.02\.2027/],
  [29, "e-Belge: numaralı gönderilmemiş belge Gönderilecekler'de sayılmaz (yalnız 'waiting')", READER, "AND ${unsent} AND NOT ${uncertain}", "AND e_status = 'waiting' AND NOT ${uncertain}", [OLGU], /not ok \d+ - ön denetim \(10\.02\.2027/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([ELLE, ESDEGER, BAG, EVRAK, BANKA, OLGU, SUPHELI]);
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
