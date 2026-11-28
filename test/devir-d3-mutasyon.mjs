#!/usr/bin/env node
// 2.5.1 D3 — devir planının MUTASYON taraması (KANIT KURALI 3, ders 7, 38; tasarım §3.12 listesi + ön denetimin iki DURDURUR maddesi). Programın AYRI bir kopyasında (ders 23)
// her seferinde TEK bilerek hata açılır, D3 testleri koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d3-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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
// D3 tur 3 testleri
const GL = "server/lib/general-ledger.mjs";
const REPORT = "server/lib/devir/report.mjs";
const ROUTES = "server/routes/devir.mjs";
const ILETI = "test/devir-d3-ileti.test.mjs";
const KURAL = "test/devir-d3-kural.test.mjs";
const KART = "test/devir-d3-kart-tarihi.test.mjs";
const WA = "test/devir-d3-wa.test.mjs";
const ACIK = "test/devir-d3-acik.test.mjs";
// D3 tur 4 testleri
const MAHSUP = "test/devir-d3-mahsup.test.mjs";
const IKINCI = "test/devir-d3-ikinci.test.mjs";
const UZMAN = "test/devir-d3-uzman.test.mjs";
const STOK = "test/devir-d3-stok.test.mjs";
const EVRAKSINIF = "test/devir-d3-evrak-sinif.test.mjs";
// D3 tur 5: tabana tur 1'den beri eksik iki dosya (tur 4 SONRAKİ SÜRÜME notu) + bu turun testleri
const UC = "test/devir-d3-uc.test.mjs";
const ZAMAN = "test/devir-d3-zaman.test.mjs";
const MAHSUPBORC = "test/devir-d3-mahsup-borc.test.mjs";
const KILITBAG = "test/devir-d3-kilit-bag.test.mjs";
const SIFIRPAY = "test/devir-d3-sifir-pay.test.mjs";
const DAMGA = "test/devir-d3-damga.test.mjs";
const DAMGAKAYNAK = "test/devir-d3-damga-kaynak.test.mjs";
const TARIH = "test/devir-d3-tarih.test.mjs";
const ILETITUM = "test/devir-d3-ileti-tum.test.mjs";
// D3 tur 6 (dar kontrol ORTA-1): v2.0.12'nin gerçek koduyla kapatılmış (closed_at boş) kart
const ESKIKART = "test/devir-d3-eski-kapali-kart.test.mjs";
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
  // D3 tur 3: ön denetim iletiler.mjs düzenine geçti — M11 / M12 aynı anlamla yeni metne (S-2 / S-3'ün A dalı UYARIR'a döner).
  [11, "S-2: Açılış Olabilir onay bekleyen kayıt devri DURDURMAZ (uyarır)", PRE, "    byDecision(decisions.S2, {", "    byDecision(decisions.S2 === \"A\" ? \"B\" : decisions.S2, {", [ELLE], /not ok \d+ - her DURDURUR maddesi/],
  [12, "S-3: düzeltilmemiş Kural Değişikliği Farkı devri DURDURMAZ (uyarır)", PRE, "      byDecision(decisions.S3, {\n        kod: \"kural-farki\", baslik:", "      byDecision(decisions.S3 === \"A\" ? \"B\" : decisions.S3, {\n        kod: \"kural-farki\", baslik:", [ELLE], /not ok \d+ - her DURDURUR maddesi/],
  [13, "N-13 alt defter hesabına da yazar (modül hesabı fişe girer)", PLAN, "    if (MODULE_ACCOUNTS[row.hesap] || row.hesap === OPENING_GL) continue;", "    if (row.hesap === OPENING_GL) continue;", [ELLE], /not ok \d+ - (N-13|arşiv K kapanışı)/],
  [14, "eksi stoklu ürüne değer verilir (KG-9 / M5)", PLAN, "degerMinor: product.qty > 0 ? product.valueMinor : 0, dayanak", "degerMinor: product.qty < 0 ? 1 : product.valueMinor, dayanak", [ELLE], /not ok \d+ - (stok|kapanış)/],
  [15, "açık kalemin kuyruk rolü kaybolur (ödeme rolündeki kalem yükümlülük olur)", PLAN, "      rol: item.due ? \"yukumluluk\" : \"odeme\",", "      rol: \"yukumluluk\",", [ESDEGER], /not ok \d+ - (plan elle|.*gecikmiş|ROL)/],
  // ---- D3 tur 2: bu turun her sınıfı için en az bir mutant ----
  [16, "bağ yönlendirmesi: K sonrası bağ açık faturanın devir kalemine değil arşive yönelir", PLAN, "      return openKeys.has(key)", "      return false", [BAG], /not ok \d+ - bağ listesi/],
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
  // ---- D3 tur 3: üç kararın ve ileti düzeninin her biri için en az bir mutant ----
  [30, "S-KD-1: alt defter farkı TOPLAMDAN aranır (cari başına değil)", READER, "      altDefter: plan.excluded.length,", "      altDefter: Math.abs(plan.excluded.reduce((sum, row) => sum + row.minor, 0)),", [KURAL], /not ok \d+ - aynı caride 120/],
  [31, "S-KD-1: alt defter farkının çaresi söylenmez (Dönem Kilidi yerine Kural Farkı Düzeltme Fişi'ne yönlendirir)", PRE, "      nereye: DEVIR_TARGETS.donemKilidi, ayrinti: rows,", "      nereye: DEVIR_TARGETS.kuralFarki, ayrinti: rows,", [KURAL], /not ok \d+ - aynı caride 120/],
  [32, "S-KD-2: kilidin K'de olduğu görülmez (fiş yeni yıla düşerken genel S-3 iletisi)", PRE, "    if (K && rule.fisTarihi && rule.fisTarihi > K && rule.kOncesiFark) {", "    if (false) {", [KURAL], /not ok \d+ - kilit = 31\.12\.2026: DURDURUR/],
  [33, "S-KD-2: yeni yıla yazılmış düzeltme fişi görülmez (devir yanlış GEÇER)", READER, "    const newYearVouchers = kOncesiFark ? posted.active.filter(voucher => voucher.date > K) : [];", "    const newYearVouchers = [];", [KURAL], /not ok \d+ - kilit = 31\.12\.2026 iken fiş YENİ YILA/],
  [34, "S-KD-2: iletide yanlış fiş tutarı", PRE, "tutarı ${tlText(old.tutarMinor)})", "tutarı ${tlText(old.tutarMinor * 2)})", [KURAL], /not ok \d+ - kilit = 31\.12\.2026: DURDURUR/],
  [35, "S-KD-3: defter maddesi Kayıt Tarihi yerine yükleme anında (tur 2 / v2.5.0 hâli)", GL, "      post(`plan:${plan.id}`, plan.date, \"Taksit kartı açılışı (Excel / tablo)\", \"Açılış alacağı (yüklenen taksit kartı)\", control, OPENING_GL, roundMoney(", "      post(`plan:${plan.id}`, localDayOf(plan.importedAt) || plan.date, \"Taksit kartı açılışı (Excel / tablo)\", \"Açılış alacağı (yüklenen taksit kartı)\", control, OPENING_GL, roundMoney(", [KART], /not ok \d+ - (defter maddesi Kayıt Tarihi|plan \(K = 31)/],
  [36, "ileti düzeni: ilk durdurmada kesilir (bütün nedenler listelenmez)", PRE, "  const block = spec => stop.push(devirIletisi({ ...spec, seviye: \"durdurur\" }));", "  const block = spec => (stop.length ? 0 : stop.push(devirIletisi({ ...spec, seviye: \"durdurur\" })));", [ILETI], /not ok \d+ - \(a\) her DURDURUR nedeni/],
  [37, "ileti düzeni: e-Belge örneğinde yanlış tutar (KDV'siz)", READER, "CAST(ROUND(try_payable * 100) AS INTEGER) AS tutarMinor", "CAST(ROUND(net_total * 100) AS INTEGER) AS tutarMinor", [ILETI], /not ok \d+ - \(a\) her DURDURUR nedeni/],
  [38, "ileti düzeni: uyarı DURDURUR sayılır (WhatsApp)", PRE, "    notice({\n      kod: \"whatsapp-gonderim\"", "    block({\n      kod: \"whatsapp-gonderim\"", [WA], /not ok \d+ - 001: UYARIR/],
  [39, "ileti düzeni: plan sorunu yardımcıyı atlar (ham iç kodlu metin)", PRE, "  for (const problem of [...readProblems, ...(plan?.sorunlar || [])]) stop.push(problemIletisi(problem, { names, K }));", "  for (const problem of [...readProblems, ...(plan?.sorunlar || [])]) stop.push({ kod: `plan-${problem.kod}`, seviye: \"durdurur\", baslik: \"Devir Hesabı Tutmuyor\", git: DEVIR_TARGETS.devirRaporu, metin: problem.kod });", [ILETI], /not ok \d+ - (\(a\) her DURDURUR nedeni|preflight\.mjs: stop)/],
  [40, "Devir Raporu: uyarılar 'Devri Durduran Nedenler' başlığına karışır", REPORT, "  reasons(\"uyarilar\", \"Uyarılar\", preflight?.uyarir || [], \"Uyarı yok.\");", "  reasons(\"uyarilar\", \"Devri Durduran Nedenler\", preflight?.uyarir || [], \"Uyarı yok.\");", [ILETI], /not ok \d+ - \(e\) Devir Raporu/],
  [41, "ön izleme ucu: beklenmeyen hatanın HAM iletisi yanıta girer", ROUTES, "        entry.error = { status: error.status || 500, code: ileti.kod, message: ileti.metin, ileti };", "        entry.error = { status: error.status || 500, code: ileti.kod, message: error.message, ileti };", [ILETI], /not ok \d+ - (beklenmeyen hata|routes\/devir\.mjs)/],
  [42, "WhatsApp uyarısı bitmiş / iptal edilmiş işleri de sayar", READER, "FROM wa_batches b WHERE b.state IN ('running', 'paused')`", "FROM wa_batches b WHERE b.state IN ('running', 'paused', 'done', 'canceled')`", [WA], /not ok \d+ - işler bitince/],
  // ---- D3 tur 4 ----
  [43, "S-T2-1: K sonrası mahsubun ≤K belgesi AYRILMAZ (tur 2 / tur 3 hâli)", READER, "  if (!later.length) return { lines: own, reserved: new Map(), docs, rows: [] };", "  if (true) return { lines: own, reserved: new Map(), docs, rows: [] };", [MAHSUP, BAG], /not ok \d+ - açık kalemler/],
  [44, "S-T2-1: ayrılan pay yeni yıla açık kalem olarak devretmez (K'de kapanmış sayılır)", READER, "    if (kind === \"yeni-yila-ayrildi\") reserved.set(old[0], (reserved.get(old[0]) || 0) + take);", "    void kind;", [MAHSUP], /not ok \d+ - (açık kalemler|DEVİRSİZ)/],
  [45, "S-T2-1: iki belgesi ≤K olan K sonrası mahsup K'de uygulanmaz", READER, "    for (const key of old) cut.set(key, (cut.get(key) || 0) + take);", "    if (old.length < 2) for (const key of old) cut.set(key, (cut.get(key) || 0) + take);", [MAHSUP], /not ok \d+ - açık kalemler/],
  [46, "ikinci devir: aynı yılın devri geçer", PRE, "  if (year && registered.has(year)) {", "  if (false) {", [IKINCI], /not ok \d+ - y-1/],
  [47, "ikinci devir: devredilmiş yıldan önceki yılın devri geçer", PRE, ".filter(item => item > year).sort() : [];", ".filter(item => item > year && false).sort() : [];", [IKINCI], /not ok \d+ - y-5/],
  [48, "ikinci devir: yarıda kalmış devir (ayar var, kayıt yok) geçer", PRE, "  if (half.length) {", "  if (false) {", [IKINCI], /not ok \d+ - y-4/],
  [49, "stok değişmezi yalnız toplamdan (ürün ürün karşılaştırma yok)", PLAN, "      if (wantMilli !== gotMilli || wantValue !== gotValue) wrong.push(", "      if (false) wrong.push(", [STOK], /not ok \d+ - bozulma/],
  [50, "veri damgası karşılaştırması hep 'aynı' der", READER, "  return { degisti: !before || before !== now, onceki: before, simdiki: now };", "  return { degisti: false, onceki: before, simdiki: now };", [UZMAN], /not ok \d+ - \(2\) veri damgası/],
  [51, "veri damgası var olan kaydın düzeltmesini görmez (yalnız satır sayısı)", READER, "    parts.push(`iz:${row.n}:${row.m}`);", "    void row;", [UZMAN], /not ok \d+ - \(2\) veri damgası/],
  [52, "veri damgası giriş izini de sayar (giriş devri yanlış durdurur)", READER, "\"case.payment.%\", \"dataset.bonds.moved\"]);", "\"case.payment.%\", \"dataset.bonds.moved\", \"auth.%\"]);", [UZMAN], /not ok \d+ - \(2\) veri damgası/],
  [53, "ön izleme e-Belge servisine istek gönderir", ROUTES, "    const target = appFor(company);\n", "    const target = appFor(company);\n    try {\n      await target.config?.fetchImpl?.(\"http://127.0.0.1:9/edm\");\n    } catch {\n      // mutant\n    }\n", [UZMAN], /not ok \d+ - sahte EDM/],
  [54, "Devir Raporu başlığı: ön izlemeyi hazırlayan yazılmaz", REPORT, "    [\"Ön İzlemeyi Hazırlayan\", preparedBy || \"Bilinmiyor\"],\n    ...(madeAt", "    [\"Ön İzlemeyi Hazırlayan\", \"Bilinmiyor\"],\n    ...(madeAt", [UZMAN], /not ok \d+ - \(6\) Devir Raporu başlığı/],
  [55, "ileti eksikleri: plan sorunlarında 'Ön İzleme'yi yeniden başlat' adımı yok (tur 3 hâli)", PRE, "  const steps = (...list) => [...list, RESTART, support];", "  const steps = (...list) => [...list, support];", [ILETITUM], /not ok \d+ - kâhin ↔ plan karşılaştırması/],
  [56, "ileti eksikleri: tutar yönsüz (eksi işaretli)", PRE, "`${accountText(row.hesap)} ${sideText(row.minor)}`", "`${accountText(row.hesap)} ${tlText(row.minor)}`", [ILETITUM, ILETI], /not ok \d+ - /],
  // ---- D3 tur 5: bu turun her yeni kuralı / sınıfı için en az bir mutant ----
  [57, "S-T2-1: Borç Yaz karşısı ayrılmaz (yalnız Alacak Yaz satırı belge sayılır)", READER, "(line.kind === \"debt\" || line.kind === \"credit\")", "line.kind === \"credit\"", [MAHSUPBORC], /not ok \d+ - açık kalemler \(elle\)/],
  [58, "S-T4-1: kilitli bağsız kapanış kayar (K sonrası bağlı tahsilat K kuyruğuna girer — programın bugünkü sınırı taklit edilir)", READER, "    const own = lines.filter(line => line.date <= K);", "    const own = lines.filter(line => line.date <= K || links.some(link => link.table === \"account_entries\" && link.rowId === line.id));", [KILITBAG], /not ok \d+ - K1 plan/],
  [59, "sıfır paylı belgeye ≤K bağ yanlış yönlenir (payın tamamı ayrılan belge K'de küçülmez; bağ belgeyi kapatır, bağsız dağılmaz)", READER, "    if (!less) return line;", "    if (!less || less >= lineMinor(line)) return line;", [SIFIRPAY], /not ok \d+ - plan \(elle\)/],
  [60, "veri damgası: iz türü listesinden bir para yazıcısı düşer (taksit kartı — plan.%)", READER, "\"invoice.%\", \"account.%\", \"plan.%\", \"cheque.%\"", "\"invoice.%\", \"account.%\", \"cheque.%\"", [DAMGA, DAMGAKAYNAK], /not ok \d+ - (v-2|her iz türü|çakışma)/],
  [61, "veri damgası: bu turun eklediği para yazıcısı (kayıt tahsilatı) düşer", READER, "\"staff.%\", \"case.payment.%\", \"dataset.bonds.moved\"", "\"staff.%\", \"dataset.bonds.moved\"", [DAMGA, DAMGAKAYNAK], /not ok \d+ - (v-2|her iz türü|çakışma)/],
  [62, "veri damgası: görüntüleme izi (fatura PDF'i) yine damgaya girer (tur 4 hâli — devir sebepsiz durur)", READER, "\"%.exported\", \"invoice.pdf\", \"invoice.pdf.bulk\"", "\"%.exported\", \"invoice.pdf.bulk\"", [DAMGA], /not ok \d+ - v-1 KULLANICI/],
  [63, "mahsup geriye dönük (K'de) uygulanmış sayılır — ayrılan pay yeni yıla taşınmaz", READER, "    const kind = old.length === 2 ? \"k-de-kapandi\" : \"yeni-yila-ayrildi\";", "    const kind = \"k-de-kapandi\";", [TARIH, MAHSUPBORC], /not ok \d+ - (o gün hazırlanan|açık kalemler)/],
  [64, "bakiyesi 0 caride açık kalem varken de satır yazılmaz (iki yönlü kalem yutulur)", PLAN, "  if (balance === 0 && !open.length) return { rows: [], open, balance, openDebt: 0, openCredit: 0, net: 0 };", "  if (balance === 0) return { rows: [], open, balance, openDebt: 0, openCredit: 0, net: 0 };", [TARIH], /not ok \d+ - plan \(elle\): K bakiyesi 0/],
  // ---- D3 tur 6: kartın kapanış günü programın tanımıyla (closed_at; boşsa son güncelleme günü; Kayıt Tarihi'nden önce değil) ----
  [65, "kart kapanış günü yalnız closed_at'tan okunur (tur 1–5 hâli — 2.0.13 öncesi kapatılmış kart K'de açık)", READER, "  const closedAt = cols.has(\"closed_at\") && cols.has(\"registered_on\") ? closeDaySql(\"p\") :", "  const closedAt = cols.has(\"closed_at\") && cols.has(\"registered_on\") ? \"COALESCE(p.closed_at, '')\" :", [ESKIKART], /not ok \d+ - devir planı \(K = 31\.12\.2026\)/],
  [66, "son güncelleme yedeği tarihsiz okunur (kapalı kart K'den SONRA kapanmış olsa da K'de kapalı)", READER, "      closedAtK: row.status === \"closed\" && Boolean(row.closedAt) && String(row.closedAt).slice(0, 10) <= K,", "      closedAtK: row.status === \"closed\" && (Boolean(row.closedAt) || true),", [ESKIKART], /not ok \d+ - devir planı \(K = 31\.12\.2026\)/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

// D3 tur 5: tabanda D3'ün BÜTÜN test dosyaları (tur 1'den beri eksik devir-d3-uc ve devir-d3-zaman dahil) — tabanda yeşil olmayan dosyanın mutasyondaki kırmızısı anlamsızdır.
const TABAN = [ELLE, ESDEGER, UC, ZAMAN, BAG, EVRAK, BANKA, OLGU, SUPHELI, ILETI, KURAL, KART, WA, ACIK, MAHSUP, IKINCI, UZMAN, STOK, EVRAKSINIF, ILETITUM, MAHSUPBORC, KILITBAG, SIFIRPAY, DAMGA, DAMGAKAYNAK, TARIH, ESKIKART];
const missing = readdirSync(path.join(COPY, "test")).filter(name => /^devir-d3-.+\.test\.mjs$/.test(name)).map(name => `test/${name}`).filter(name => !TABAN.includes(name));
if (missing.length) throw new Error(`mutasyon tabanında olmayan D3 testi: ${missing.join(", ")} — TABAN listesine ekleyin`);
const taban = run(TABAN);
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
