// 2.1.0 — Aşama 2, Dilim 4: ALTIN TEST — tek kaynağa (moneyLines, K5) geçişten sonra kullanıcının gördüğü her para sayısı 2.0.26 ile
// SATIR SATIR AYNI (docs/BANKA-MODULU-PLAN.md §3.4, §12.3 Aşama 2 "Çalışıyor Mu", K11).
//
// Yöntem: aynı veri iki kopyaya açılır; birinde GERÇEK v2.0.26 kodu (git etiketi; tests/guvenilirlik/surumler.mjs), öbüründe bu dal
// (v20 göçünü kendisi uygular) aynı anda çalışır; ikisine aynı istekler gönderilir ve yanıtlar karşılaştırılır:
//   - Kasa penceresi JSON'u (yönetici ve Kasa'yı gören muhasebe kullanıcısı; nakit / tüm yollar / banka tarafı / havale / POS; tarih
//     aralıklı), Kasa Dökümü PDF'inin metni;
//   - Raporlar → Banka ve POS Hareketleri (yol süzgeçleriyle) ve Kasa raporları (Hareketler, Günlük, Kaynağa Göre, Aylık), Hesap Planı
//     Mizanı, Defter Mutabakatı: ekran JSON'u, PDF metni ve Excel sayfaları;
//   - ANLIK DURUM (Kasa bugün / bu ay, Banka / POS kutusu dahil), Nakit Akış Projeksiyonu, Vade Takip;
//   - Ana Defter (mizan + mutabakat) ve Mutabakat Testi'nin denetim listesi ("N denetim tamam" aynı kalır).
// Tek fark izni: oluşturma saati (PDF/Excel damgası) ve 649'un adı — Aşama 4'te (Banka Fişi 649'a yazmaya başlayınca; bilerek güncellendi)
// Tekdüzen adı "Diğer Olağan Gelir ve Kârlar" (plan §3.11; tutarı aynı). Hesap Planı Mizanı PDF'inde adın uzunluğu kolon genişliğini,
// dolayısıyla satır kırılımını değiştirir (o PDF'te kırılım boşluk sayılır). Aşama 2'de (gözden geçirme D3) ad 2.0.26'daki gibi kalmıştı.
// Veri: (1) zincir fikstürü surum-2.0.26-zincir (2.0.16 → 2.0.26 gerçek sürüm koduyla, 4 şirket); (2) v2.0.26'nın KENDİ koduyla
// mutabakat motoruyla (test/mutabakat/motor.mjs) bu test sırasında üretilen veri: 120 güne yayılmış rastgele işlemler (Kasa, cari,
// stok, taksit, çek/senet, fatura, iade, iptal, transfer, dönem kilidi).
// NASIL BOZARIM: tek kaynak bir kaynağı (silinmiş carinin satırı, faturası olmayan peşin, stokta yön), sırayı (aynı damgalı satırlar),
// bir alanı (açıklama, işlemi yapan, düzenlenebilirlik), bir süzgeci (yol, tarih) ya da bir toplamı (bugün/bu ay, banka kutusu) farklı
// okursa bu test kırılır.
// K1 (iade kapanışı, 2.1.0; bilerek değişen görünüm): K1 iadesi olan carilerde faturaların ödeme durumunu (ANLIK DURUM'un fatura kutusu,
// Nakit Akış ve Vade Takip'in fatura kalemleri) bilerek değiştirdi. Birebir karşılaştırma K1 öncesi kapamayla yapılır (createApp legacyClosing:
// test/guvenilirlik/kapama-k1-oncesi.mjs, dondurulmuş kopya). Üçüncü kopya güncel kuralla açılır: fatura kapamasına bağlı üç görünüm dışındaki
// her yanıt yine 2.0.26 ile aynı; ödeme durumu değişen her fatura iadesi olan bir carinin, taksitliyse açığı kartın kalanı (kapama-k1-fark.mjs).
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { localDay, pdfText, unwrap, xlsxSheets } from "./banka-210-ortak.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";
import { foldDocumentRows, foldIntegrityChecks, foldReconciliation, foldTrialAccounts, hasDocumentSplit, legacyBankBox, legacyBankPos, legacyCashFlow, normDocumentNames } from "./guvenilirlik/defter-olgulari.mjs";
import { invoiceStates, k1Check } from "./guvenilirlik/kapama-k1-fark.mjs";
import { settleInvoices as settleK1Oncesi } from "./guvenilirlik/kapama-k1-oncesi.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { projection } from "../server/lib/finance-report.mjs";

const OLD = "v2.0.26";
const skip = tagsAvailable([OLD]) ? false : `${OLD} etiketi bu depoda yok (git fetch --tags)`;
const TODAY = localDay(0);
const MONTH = `${TODAY.slice(0, 7)}-01`;
const PAST = { from: localDay(-75), to: localDay(-8) };
const OLD_649 = "Diğer Olağan Gelirler (Kasaya Elle)";
const NEW_649 = "Diğer Olağan Gelir ve Kârlar";
const STAMP = /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}(:\d{2})?/g;

// 2.2.0 İz 4.2 (plan §3.11a, bilerek): 101 / 103'ün adı Tekdüzen adı ("Alınan Çekler", "Verilen Çekler ve Ödeme Emirleri (−)"); iki taraf da aynı belirtece
// (defter-olgulari normDocumentNames). Senet hesapları (121 / 321) yeni tarafta eski düzene katlanır (legacyDocuments; aşağıda).
// 2.3.0 İz 5.2 (bilerek, kullanıcı kararı 15.10.2026): dönem metni "Tüm hareketler" → "Tüm Zamanlar" (rapor alt başlığı, PDF/Excel kapsamı);
// sayılar ve satırlar değişmez — iki taraf aynı belirtece.
const OLD_ALL = "Tüm hareketler";
const NEW_ALL = "Tüm Zamanlar";
// 2.4.3 (keşif A15, bilerek): hareket türü adları başlık yazımıyla ("Cari tahsilat" → "Cari Tahsilat", "Taksit tahsilatı" → "Taksit Tahsilatı" …;
// Kasa Dökümü PDF'i, cari defteri). Sayılar ve satırlar değişmez — iki taraf aynı belirtece.
const MOVE_NAMES = [
  ["Cari tahsilat", "Cari Tahsilat", "CARI-TAHSILAT-AD"],
  ["Cariye ödeme", "Cariye Ödeme", "CARIYE-ODEME-AD"],
  ["Taksit ödemesi/iadesi", "Taksit Ödemesi / İadesi", "TAKSIT-ODEME-IADE-AD"],
  ["Taksit tahsilatı", "Taksit Tahsilatı", "TAKSIT-TAHSILAT-AD"],
  ["Taksit iadesi", "Taksit İadesi", "TAKSIT-IADE-AD"],
  ["Karşılıksız çek / senet (taksit)", "Karşılıksız Çek / Senet (taksit)", "KARSILIKSIZ-TAKSIT-AD"],
];
const normMoves = value => MOVE_NAMES.reduce((text, [before, after, token]) => text.split(before).join(token).split(after).join(token), value);
const normAll = value => normMoves(value.split(OLD_ALL).join("ALL-AD").split("Tüm zamanlar").join("ALL-AD").split(NEW_ALL).join("ALL-AD"));
// 2.4.3 (C14, bilerek): "Banka ve POS Hareketleri" raporu Kasa grubundan Banka grubuna taşındı; satırlar ve sayılar değişmez — iki taraf aynı belirtece.
const normGroup = value => {
  if (Array.isArray(value)) return value.map(normGroup);
  if (!value || typeof value !== "object") return value;
  const out = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normGroup(item)]));
  if (out.id === "banka-pos-hareketleri" && (out.group === "Kasa" || out.group === "Banka")) out.group = "GRUP-BANKA-POS";
  return out;
};
const norm649 = value => normGroup(JSON.parse(normAll(normDocumentNames(JSON.stringify(value).split(OLD_649).join("649-AD").split(NEW_649).join("649-AD")))));
const textNorm = value => normAll(normDocumentNames(value.replace(STAMP, "TARİH SAAT").split(OLD_649).join("649-AD").split(NEW_649).join("649-AD")));
/** Yeni tarafın Ana Defter / Mutabakat Testi / Hesap Planı Mizanı / Defter Mutabakatı JSON'u eski düzende (121 → 101, 321 → 103; eski adlar). */
// Kaç yanıtta senet hesabı katlandı / kaç dosya ekranla karşılaştırıldı (günlüğe yazılır: katlamanın gerçekten çalıştığının kanıtı).
const documentTally = { folded: 0, selfChecked: 0 };
function legacyDocuments(url, data) {
  const base = url.split("?")[0];
  const codes = base === "/api/workspace/ledger" ? data.trial.accounts.map(row => row.code) : base === "/api/workspace/ledger/integrity" ? data.checks.map(item => item.code.replace(/^gl:/, "")) : /\/report-center\/(hesap-mizani|defter-mutabakati)$/.test(base) ? data.rows.map(row => row[0]) : [];
  if (hasDocumentSplit(codes)) documentTally.folded += 1;
  if (base === "/api/workspace/ledger") return { ...data, trial: { ...data.trial, accounts: foldTrialAccounts(data.trial.accounts) }, reconciliation: { ...data.reconciliation, checks: foldReconciliation(data.reconciliation.checks) } };
  if (base === "/api/workspace/ledger/integrity") return { ...data, checks: foldIntegrityChecks(data.checks), failures: foldIntegrityChecks(data.failures) };
  const id = /\/report-center\/(hesap-mizani|defter-mutabakati)$/.exec(base)?.[1];
  if (!id) return data;
  const rows = foldDocumentRows(id, data.rows);
  return { ...data, rows, total: data.total - (data.rows.length - rows.length) };
}
const strip = (value, keys) => {
  if (Array.isArray(value)) return value.map(item => strip(item, keys));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)).map(([key, item]) => [key, strip(item, keys)]));
  return value;
};

// Karşılaştırılan istekler. kind: json | pdf | xlsx; who: admin (hepsi) ya da staff (Kasa'yı gören personel).
function requests() {
  const out = [];
  const json = (url, opts = {}) => out.push({ kind: "json", url, ...opts });
  for (const who of ["admin", "staff"]) {
    for (const q of ["", "?method=all", "?method=noncash", "?method=bank", "?method=card", `?from=${PAST.from}&to=${PAST.to}`, `?method=all&from=${MONTH}&to=${TODAY}`, `?method=noncash&from=${PAST.from}`]) json(`/api/workspace/cash${q}`, { who });
    for (const q of ["", `?from=${PAST.from}&to=${PAST.to}`, "?method=noncash"]) out.push({ kind: "pdf", url: `/api/workspace/cash.pdf${q}`, who });
  }
  // 2.3.0 İz 1.6 (bilerek): ANLIK DURUM alacak toplamındaki şüpheli alacak alanları (receivable.doubtful, doubtfulCount) ve Vade Takip'in
  // doubtful kutusu 2.0.26'da yok; eski veride 0'dır, karşılaştırmadan düşülür.
  json("/api/workspace/overview", { drop: ["at", "doubtful", "doubtfulCount"] });
  json("/api/workspace/overview/nakit-akisi");
  json(`/api/workspace/overview/nakit-akisi?preset=next90&overdue=1`);
  json(`/api/workspace/overview/vade-takip?sources=cash,plan,cheque,note,invoice`, { drop: ["doubtful"] });
  json("/api/workspace/ledger");
  json("/api/workspace/ledger/integrity", { drop: ["durationMs", "log"] });
  const reports = {
    "banka-pos-hareketleri": ["", "?from=2000-01-01&to=2099-12-31", "?from=2000-01-01&to=2099-12-31&payMethod=bank", "?from=2000-01-01&to=2099-12-31&payMethod=card", `?from=${PAST.from}&to=${PAST.to}&payMethod=bank`, `?preset=thisMonth`],
    "kasa-hareketleri": ["", "?from=2000-01-01&to=2099-12-31", `?from=${PAST.from}&to=${PAST.to}`],
    "kasa-gunluk": ["", `?from=${PAST.from}&to=${PAST.to}`],
    "kasa-kaynak": ["", "?from=2000-01-01&to=2099-12-31"],
    "kasa-aylik": ["", "?from=2000-01-01&to=2099-12-31"],
    "hesap-mizani": ["?from=2000-01-01&to=2099-12-31"],
    "defter-mutabakati": [""],
  };
  for (const [id, variants] of Object.entries(reports)) {
    for (const q of variants) {
      json(`/api/workspace/report-center/${id}${q}`);
      out.push({ kind: "pdf", url: `/api/workspace/report-center/${id}/pdf${q}` });
      out.push({ kind: "xlsx", url: `/api/workspace/report-center/${id}/xlsx${q}` });
    }
  }
  return out;
}

// 2.1.0 Aşama 14 + temel sürüm (bilerek değişen üç görünüm; plan §11.4, §10.5, §8.9 Nakit Akış başlangıcı): yeni tarafta ANLIK DURUM'un Banka kutusu (K10: Gerçek Banka) ve Banka ve POS
// Hareketleri'nin iç hareket ayrımı (§3.4) 2.0.26 karşılığına aynı satırlardan çevrilir (test/guvenilirlik/defter-olgulari.mjs); K10 kabulü
// (Gerçek Banka + Hesabı Atanmamış = eski Banka / POS) ayrıca denetlenir. İç hareketi olan Banka ve POS Hareketleri dönemlerinin PDF/Excel'i
// eski dosyayla değil, aynı dönemin ekranıyla karşılaştırılır (özet ve açıklama biçimi bilerek değişti).
const k10Problems = [];
const unbilledTally = { count: 0 }; // 2.4.3 MM5: normalleştirmede çıkarılan faturasız cari alacağı kalemi sayısı (günlüğe yazılır)
const roundCents = value => Math.round((Number(value) || 0) * 100) / 100;
// company: yeni taraf PDF'inin şirket satırındaki unvan (2.2.0 İz 1.1); eski taraf aynı satırı (varsa) atar.
async function fetchOne(api, request, side = "eski", company = null) {
  if (request.kind === "json") {
    const response = unwrap(await api.client.get(request.url));
    let data = response.data;
    if (side === "yeni" && response.status === 200 && request.url.split("?")[0] === "/api/workspace/overview") {
      const { box, k10 } = await legacyBankBox(apiLike(api), data);
      if (k10 && k10.realBank + k10.unassigned + k10.unassignedFuture !== k10.legacyAll) k10Problems.push(`K10: Gerçek Banka ${k10.realBank} + Hesabı Atanmamış ${k10.unassigned} + ileri tarihli ${k10.unassignedFuture} ≠ eski Banka / POS ${k10.legacyAll}`);
      data = { ...data, cash: { ...data.cash, bank: box } };
    }
    if (side === "yeni" && response.status === 200 && request.url.includes("/report-center/banka-pos-hareketleri")) data = legacyBankPos(data);
    if (side === "yeni" && response.status === 200) data = legacyDocuments(request.url, data);
    // 2.3.0 İz 3.3 (plan §8.9, eşleme 301; bilerek): Vade Takip'e "bank" kaynağı (planlı banka işlemleri) geldi; eski veride planlı işlem yok, satırlar aynı.
    if (side === "yeni" && response.status === 200 && request.url.split("?")[0] === "/api/workspace/overview/vade-takip" && Array.isArray(data.allowed)) {
      data = { ...data, allowed: data.allowed.filter(item => item !== "bank"), sources: Array.isArray(data.sources) ? data.sources.filter(item => item !== "bank") : data.sources };
    }
    // 2.4.3 UX24 (bilerek): Rapor Merkezi yanıtında "footers" (yönü karışık raporda birden çok TOPLAM satırı). Tek TOPLAM'lı raporda footers = [footer]
    // (burada denetlenir); alan atılır, footer 2.0.26 ile birebir karşılaştırılır. Çok satırlı TOPLAM test/defter-243-ux24-toplam.test.mjs'te.
    if (side === "yeni" && response.status === 200 && request.url.includes("/report-center/") && data && typeof data === "object" && "footers" in data) {
      const { footers, ...rest } = data;
      if (response.data.footer && JSON.stringify(response.data.footers) !== JSON.stringify([response.data.footer])) k10Problems.push(`UX24: ${request.url} footers ≠ [footer]`);
      data = rest;
    }
    // 2.4.3 MM5 (bilerek): Nakit Akışı faturasız cari alacağını (kaynak "unbilled") hareket tarihinde beklenen giriş sayar; 2.0.26'da yoktu. Satırlar
    // ve gecikmişlerden bu kalemler çıkarılıp akış aynı işlevle (finance-report projection) yeniden kurulur; kalan her şey birebir karşılaştırılır.
    if (side === "yeni" && response.status === 200 && request.url.split("?")[0] === "/api/workspace/overview/nakit-akisi" && Array.isArray(data.rows)) {
      const unbilled = [...data.rows, ...(data.overdue || [])].filter(item => item.source === "unbilled");
      if (unbilled.length) {
        unbilledTally.count += unbilled.length;
        const flows = [...data.rows.map(({ balance, ...item }) => item), ...(data.overdue || [])].filter(item => item.source !== "unbilled");
        const carried = roundCents((data.carried?.in || 0) - (data.carried?.out || 0));
        const again = projection({ today: data.today, from: data.from, to: data.to, cashToday: roundCents(data.cashToday + carried), flows, includeOverdue: data.includeOverdue });
        if (data.periods) k10Problems.push(`MM5: ${request.url} gruplu akış normalleştirilemedi`);
        // Ekran yanıtı en çok 5.000 satır taşır (rowTotal: bütün satırlar); kesilmiş yanıt yeniden kurulamaz.
        if (data.rowTotal !== data.rows.length) k10Problems.push(`MM5: ${request.url} kesilmiş satırlar (${data.rows.length}/${data.rowTotal}) normalleştirilemedi`);
        data = { ...data, ...again, from: data.from, cashToday: data.cashToday, carried: data.carried, rowTotal: again.rows.length };
      }
    }
    // 2.1.0 temel sürüm (K10, plan §8.9, bilerek): Nakit Akış başlangıcı Nakit + Gerçek Banka; 2.0.26 karşılığına aynı satırlardan çevrilir.
    if (side === "yeni" && response.status === 200 && request.url.split("?")[0] === "/api/workspace/overview/nakit-akisi") {
      const { flow, problem } = await legacyCashFlow(apiLike(api), data);
      if (problem) k10Problems.push(problem);
      data = flow;
    }
    return { status: response.status, body: norm649(strip(data, request.drop || [])) };
  }
  const response = await api.client.raw("GET", request.url);
  if (response.status !== 200) return { status: response.status, body: response.data };
  // Hesap Planı Mizanı PDF'inde "Hesap Adı" kolonunun genişliği en uzun hesap adına göre (649'un yeni adı kısaldı): aynı metin
  // başka yerden satır kırar. Bu raporda satır kırılımı boşluğa indirgenir; sözcükler ve sıraları birebir karşılaştırılır.
  if (request.kind === "pdf") {
    // 2.2.0 İz 1.1 (bilerek): Rapor Merkezi PDF'inin ilk satırı şirket "001 · Unvan" (önceden yalnız unvan; unvan boşsa satır hiç yoktu — ör.
    // motor verisi). İki taraf da kendi şirket satırını atar: yeni taraf "kod · unvan" satırını, eski taraf aynı unvanın satırını (varsa).
    let text = pdfText(response.buffer);
    let label = null;
    if (request.url.includes("/report-center/")) {
      const head = /^(\d{3}) · ([^\n]*)\n/.exec(text);
      if (side === "yeni" && head) {
        label = head[2];
        text = text.slice(head[0].length);
      } else if (side !== "yeni" && company && text.startsWith(`${company}\n`)) text = text.slice(company.length + 1);
    }
    // 2.1.0 Aşama 14: altıdan çok özet kutusu iki sıraya dizilir (Banka ve POS Hareketleri'nde 7–8 kutu; tek sırada tutar kesiliyordu) →
    // tablo sayfalara başka yerden bölünür ve uzun özet başlığı satır kırmaz. Bu raporda sayfa başlıkları (şirket · rapor, "Sayfa n / m", alt
    // başlık, kolon başlıkları) atılır ve satır kırılımı boşluğa indirgenir; sözcükler ve sıraları birebir karşılaştırılır.
    if (request.url.includes("/banka-pos-hareketleri/")) return { status: 200, body: textNorm(withoutPageHeads(text).replace(/\s+/g, " ")), company: label };
    return { status: 200, body: textNorm(request.url.includes("/hesap-mizani/") ? text.replace(/\s+/g, " ") : text), company: label };
  }
  const sheets = xlsxSheets(response.buffer);
  for (const rows of Object.values(sheets)) for (let k = rows.length - 1; k >= 0; k -= 1) if (rows[k][0] === "Hazırlanma") rows.splice(k, 1);
  // 2.2.0 İz 1.1 (bilerek): Rapor Merkezi Excel'inin ilk sayfasında tablonun üstünde başlık bloğu (tek hücreli satırlar: şirket, rapor adı, kapsam,
  // oluşturma) ve Özet'te "Şirket" satırı. Blok ve satır atılır; tablo ve Özet'in kalanı 2.0.26 ile birebir karşılaştırılır.
  const [firstName] = Object.keys(sheets);
  if (firstName && request.url.includes("/report-center/")) {
    const at = sheets[firstName].findIndex(row => row.length > 1);
    if (at > 0) sheets[firstName].splice(0, at);
  }
  if (sheets["Özet"]) sheets["Özet"] = sheets["Özet"].filter(row => row[0] !== "Şirket");
  return { status: 200, body: norm649(sheets) };
}

const COLUMN_HEADS = ["Tarih", "Yol", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Giren"];
function withoutPageHeads(text) {
  const lines = text.split("\n");
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^Sayfa \d+ \/ \d+$/.test(lines[index])) {
      if (out.length && / · Banka ve POS Hareketleri$/.test(out.at(-1))) out.pop();
      if (/^Banka ve POS Hareketleri · /.test(lines[index + 1] || "")) index += 1;
      if (COLUMN_HEADS.every((head, k) => lines[index + 1 + k] === head)) index += COLUMN_HEADS.length;
      continue;
    }
    out.push(lines[index]);
  }
  return out.join("\n");
}
const apiLike = api => ({ get: async url => unwrap(await api.client.get(url)) });
/**
 * 2.1.0 ikinci küçük düzeltmeler m6 (bilerek): PDF alt başlığı artık kesilmez (en çok üç satır) ve özet kutusu değeri önce küçülür, sonra kesilir.
 * v2.0.26 aynı metni "…" ile kesiyordu ("2.825.083,6…", "… bu satırları büyütem…"); alt başlık uzayınca tablo sayfalara başka yerden bölünür.
 * Katı karşılaştırma tutmazsa: iki tarafta da sayfa yapısı (alt bilgi + "Sayfa n / m" + devam başlığı + tekrarlanan kolon başlıkları) atılır,
 * boşluk tek boşluğa indirgenir; eski metinde "…" ile kesilen her yerde yeni metin yalnız o kesik parçanın DEVAMINI içerebilir (kesiğin
 * öncesi ve sonrası birebir aynı olmalı). Başka her fark yine fark sayılır.
 */
function pdfFlow(text) {
  const lines = text.split("\n");
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Sayfa \d+ \/ \d+$/.test(lines[index])) {
      out.push(lines[index]);
      continue;
    }
    out.pop(); // alt bilgi: "Ofis · Rapor"
    if (index + 1 >= lines.length) continue;
    index += 1; // devam sayfasının başlığı: "Rapor · alt başlık"
    // Tekrarlanan kolon başlıkları: ilk sayfadaki bloğun aynısı (en uzun eşleşen ardışık blok).
    let best = 0;
    for (let at = 0; at < out.length; at += 1) {
      let k = 0;
      while (at + k < out.length && index + 1 + k < lines.length && out[at + k] === lines[index + 1 + k] && !/^Sayfa \d+ \/ \d+$/.test(lines[index + 1 + k])) k += 1;
      best = Math.max(best, k);
    }
    index += best;
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
function pdfUntruncatedEqual(oldText, newText) {
  const left = pdfFlow(oldText);
  const right = pdfFlow(newText);
  if (left === right) return true;
  if (!left.includes("…")) return false;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = left.split("…");
  return new RegExp(`^${parts.map(escape).join("[^]*?")}$`).test(right);
}
const MONEY_CELL = /^−?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2} TL$/;
/** Banka ve POS Hareketleri'nin bu dönemi iç hareket içeriyor mu (yeni ekran)? İçeriyorsa PDF/Excel aynı dönemin ekranıyla karşılaştırılır. */
async function bankPosSelfCheck(api, request) {
  const json = unwrap(await api.client.get(request.url.replace(/\/(pdf|xlsx)(\?|$)/, "$2")));
  if (json.status !== 200 || !json.data.summary.some(([key]) => key === "Transfer Giriş")) return null;
  const cells = [...json.data.rows.flat(), ...(json.data.footer || [])].filter(cell => MONEY_CELL.test(String(cell)));
  const response = await api.client.raw("GET", request.url);
  if (request.kind === "pdf") {
    const text = pdfText(response.buffer).replace(/\s+/g, " ");
    return cells.filter(cell => !text.includes(cell)).map(cell => `PDF'te yok: ${cell}`);
  }
  const values = new Set(Object.values(xlsxSheets(response.buffer)).flat(2).map(value => (typeof value === "number" ? Math.round(value * 100) : value)));
  const minor = cell => Math.round(Number(String(cell).replace(/[^\d,−-]/g, "").replace(/\./g, "").replace(",", ".").replace("−", "-")) * 100);
  return cells.filter(cell => !values.has(minor(cell))).map(cell => `Excel'de yok: ${cell}`);
}

/**
 * 2.2.0 İz 4.2 (bilerek): veride senet varsa Hesap Planı Mizanı ve Defter Mutabakatı'nda 121 / 321 satırları vardır (2.0.26'da 101 / 103'ün içinde);
 * PDF/Excel satır satır katlanamaz → bu dosyalar aynı raporun YENİ EKRANIYLA karşılaştırılır (bütün para hücreleri ve hesap kodları dosyada). JSON
 * eski düzene katlanarak 2.0.26 ile birebir karşılaştırılır (legacyDocuments). Senet yoksa dosyalar 2.0.26 ile birebir (ad belirteciyle).
 */
async function documentSelfCheck(api, request) {
  if (!/\/report-center\/(hesap-mizani|defter-mutabakati)\//.test(request.url)) return null;
  const json = unwrap(await api.client.get(request.url.replace(/\/(pdf|xlsx)(\?|$)/, "$2")));
  if (json.status !== 200 || !hasDocumentSplit(json.data.rows.map(row => row[0]))) return null;
  documentTally.selfChecked += 1;
  const cells = [...json.data.rows.flat(), ...(json.data.footer || [])].filter(cell => MONEY_CELL.test(String(cell)));
  const codes = json.data.rows.map(row => String(row[0])).filter(code => /^\d{3}$/.test(code));
  const response = await api.client.raw("GET", request.url);
  if (request.kind === "pdf") {
    const text = pdfText(response.buffer).replace(/\s+/g, " ");
    return [...cells.filter(cell => !text.includes(cell)).map(cell => `PDF'te yok: ${cell}`), ...codes.filter(code => !text.includes(code)).map(code => `PDF'te hesap yok: ${code}`)];
  }
  const flat = Object.values(xlsxSheets(response.buffer)).flat(2);
  const values = new Set(flat.map(value => (typeof value === "number" ? Math.round(value * 100) : value)));
  const minor = cell => Math.round(Number(String(cell).replace(/[^\d,−-]/g, "").replace(/\./g, "").replace(",", ".").replace("−", "-")) * 100);
  const texts = new Set(flat.map(value => String(value)));
  return [...cells.filter(cell => !values.has(minor(cell))).map(cell => `Excel'de yok: ${cell}`), ...codes.filter(code => !texts.has(code)).map(code => `Excel'de hesap yok: ${code}`)];
}

async function login(server, who) {
  return who === "staff" ? server.login("altin-muhasebe", "Altin-Muhasebe-2026!") : server.login();
}

/** İki sunucuya aynı istekleri gönderip yanıtları karşılaştırır; farkları döndürür. */
// K1'in bilerek değiştirdiği görünümler (fatura kapamasına bağlı): ANLIK DURUM (fatura kutusu), Nakit Akış ve Vade Takip (fatura kalemleri).
const K1_VIEWS = ["/api/workspace/overview", "/api/workspace/overview/nakit-akisi", "/api/workspace/overview/vade-takip"];
const k1View = url => K1_VIEWS.includes(url.split("?")[0]);
async function compare(oldServer, newServer, { companies, label, skip = () => false }) {
  const problems = [];
  let compared = 0;
  for (const company of companies) {
    for (const who of ["admin", "staff"]) {
      if (who === "staff" && company.id !== "sirket-001") continue; // personelin şirket yetkisi yalnız 001
      const a = await login(oldServer, who);
      const b = await login(newServer, who);
      // Şirket seçimi kullanıcı başına sunucuda saklanır: 001 de açıkça seçilir (K1 karşılaştırması aynı sunucuya ikinci kez girer).
      for (const api of [a, b]) assert.equal((await api.post("/api/companies/select", { id: company.id })).status, 200, `${company.code} seçilemedi`);
      for (const request of requests().filter(item => (item.who || "admin") === who && !skip(item.url))) {
        const where = `${label} · ${company.code} · ${who} · ${request.kind} ${request.url}`;
        if (request.kind !== "json" && request.url.includes("/banka-pos-hareketleri/")) {
          const self = await bankPosSelfCheck(b, request);
          if (self) {
            compared += 1;
            if (self.length) problems.push(`${where}: yeni dosya ekranla aynı değil: ${self.slice(0, 5).join("; ")}`);
            continue;
          }
        }
        if (request.kind !== "json") {
          const self = await documentSelfCheck(b, request);
          if (self) {
            compared += 1;
            if (self.length) problems.push(`${where}: yeni dosya (senet hesapları) ekranla aynı değil: ${self.slice(0, 5).join("; ")}`);
            continue;
          }
        }
        // Yeni taraf önce: PDF'inin şirket satırındaki unvan eski tarafa verilir (2.2.0 İz 1.1 normalizasyonu); gövde dışındaki alan atılır.
        const fresh = await fetchOne(b, request, "yeni");
        const old = await fetchOne(a, request, "eski", fresh.company);
        const [left, right] = [{ status: old.status, body: old.body }, { status: fresh.status, body: fresh.body }];
        compared += 1;
        if (left.status !== right.status) problems.push(`${where}: durum ${left.status} ≠ ${right.status}`);
        else {
          try {
            assert.deepStrictEqual(right.body, left.body);
          } catch (error) {
            if (!(request.kind === "pdf" && typeof left.body === "string" && typeof right.body === "string" && pdfUntruncatedEqual(left.body, right.body))) problems.push(`${where}: ${String(error.message).slice(0, 1500)}`);
          }
        }
      }
    }
  }
  problems.push(...k10Problems.splice(0));
  return { problems, compared };
}

async function prepareStaff(server) {
  const admin = await server.login();
  const created = await admin.post("/api/admin/users", { username: "altin-muhasebe", name: "Altın Muhasebe", role: "muhasebe", password: "Altin-Muhasebe-2026!", mustChangePassword: false });
  assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 300));
}

async function sideBySide(sourceData, sourceBackups, label, companies) {
  const root = mkdtempSync(path.join(tmpdir(), "altin-210-"));
  const dirs = side => ({ dataDir: path.join(root, side, "data"), backupDir: path.join(root, side, "backups") });
  for (const side of ["eski", "yeni", "guncel"]) {
    cpSync(sourceData, dirs(side).dataDir, { recursive: true });
    cpSync(sourceBackups, dirs(side).backupDir, { recursive: true });
  }
  const oldServer = await bootVersion(OLD, { ...dirs("eski"), maxCompanies: 10 });
  const newServer = await bootVersion(CURRENT, { ...dirs("yeni"), maxCompanies: 10, legacyClosing: settleK1Oncesi });
  const currentServer = await bootVersion(CURRENT, { ...dirs("guncel"), maxCompanies: 10 });
  try {
    assert.equal(newServer.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION, "bu dal v20 ve sonrasında (2.2.0: v21)");
    assert.equal(oldServer.app.store.get("PRAGMA user_version").user_version, 19, "v2.0.26 v19'da");
    // Canlı Hata 2'nin açılış onarımı (iade + geri ödemeyle yanlış büyümüş kartı küçültür) bu dalın BİLEREK farklı gösterdiği tek veri durumudur:
    // onarılan kart Nakit Akış, Vade Takip ve taksit görünümlerinde 2.0.26'dan farklı olur. Karşılaştırma onarımsız veriyle anlamlıdır; motorun
    // rastgele sırası değişip veri böyle bir kart içerirse bu denetim farkın nedenini söyler (10.10.2026: yeni motor işlemleri sırayı değiştirince
    // FIS2026000000002'nin kartı 2.658,37 → 0 onarıldı ve Nakit Akış "plan:in" farkı olarak görünmüştü).
    for (const server of [newServer, currentServer]) {
      const repaired = server.app.store.all("SELECT entity_id, payload_json FROM audit_events WHERE type = 'plan.repaired'");
      assert.deepEqual(repaired, [], `${label}: açılış onarımı (Canlı Hata 2) kart değiştirdi — veri bu karşılaştırma için uygun değil (bilerek fark)`);
    }
    const result = await compare(oldServer, newServer, { companies, label });
    // K1 (güncel kural): fatura kapamasına bağlı üç görünüm dışındaki her yanıt 2.0.26 ile aynı; ödeme durumu farkı yalnız iadesi olan carilerde.
    const k1 = await compare(oldServer, currentServer, { companies, label: `${label} · K1 güncel kural`, skip: k1View });
    result.problems.push(...k1.problems);
    result.compared += k1.compared;
    result.k1Changed = 0;
    for (const company of companies) {
      const [legacyApi, currentApi] = [await newServer.login(), await currentServer.login()];
      for (const api of [legacyApi, currentApi]) assert.equal((await api.post("/api/companies/select", { id: company.id })).status, 200, `${company.code} seçilemedi`);
      const check = await k1Check(await invoiceStates(legacyApi), currentApi);
      result.k1Changed += check.changed.length;
      result.problems.push(...check.problems.map(text => `${label} · ${company.code} · K1: ${text}`));
    }
    return result;
  } finally {
    await oldServer.close();
    await newServer.close();
    await currentServer.close();
    rmSync(root, { recursive: true, force: true });
  }
}

describe("altın test: v2.0.26 ile bu dal aynı veride aynı Kasa, Banka ve POS, ANLIK DURUM, Ana Defter ve raporları gösterir", { skip }, () => {
  it("zincir fikstürü surum-2.0.26-zincir (2.0.16 → 2.0.26 gerçek sürüm koduyla, 4 şirket)", { timeout: 600_000 }, async () => {
    assert.ok(fixtureExists("surum-2.0.26-zincir"), "fikstür yok");
    const fixture = unpackFixture("surum-2.0.26-zincir");
    try {
      // Kasa'yı gören personel (muhasebe) v2.0.26'nın kendi API'siyle eklenir; iki kopya da aynı veriyle başlar.
      const prep = await bootVersion(OLD, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10 });
      let companies;
      try {
        await prepareStaff(prep);
        companies = (await (await prep.login()).get("/api/companies")).data.companies.map(({ id, code }) => ({ id, code }));
      } finally {
        await prep.close();
      }
      assert.ok(companies.length >= 4, `şirketler: ${JSON.stringify(companies)}`);
      const { problems, compared, k1Changed } = await sideBySide(fixture.dataDir, fixture.backupDir, "zincir", companies);
      console.log(`K1 zincir: durumu değişen belge ${k1Changed}; karşılaştırılan yanıt ${compared}; senet katlaması (2.2.0 İz 4.2) ${documentTally.folded} yanıt, ekranla karşılaştırılan dosya ${documentTally.selfChecked}; Nakit Akışı faturasız kalem (2.4.3 MM5) ${unbilledTally.count}`);
      assert.ok(compared >= 280, `karşılaştırılan yanıt sayısı ${compared}`);
      assert.deepEqual(problems, [], `${problems.length} fark:\n${problems.slice(0, 8).join("\n\n")}`);
    } finally {
      fixture.cleanup();
    }
  });

  it("v2.0.26'nın kendi koduyla üretilen veri (mutabakat motoru: 120 güne yayılmış 260 rastgele işlem, dönem kilidi, iade/iptal)", { timeout: 900_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "altin-210-motor-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    try {
      const old = await bootVersion(OLD, { dataDir, backupDir });
      try {
        await prepareStaff(old);
        const admin = await old.login();
        // v2.0.26'da banka modülü yok: motorun banka ekseni kapalı (rastgele sıra eski motorla birebir aynı kalır). K8 taksit kuralı (2.3.0) da yok:
        // k8:false (kalan 0 olan karta tahsilat 2.0.26'da 200 döner; motor 409 beklememeli).
        const report = await runReconciliation({ client: admin.client, seed: 210, operations: 260, verifyEvery: 100_000, reportEvery: 100_000, burst: 8, span: 120, bank: false, k8: false });
        assert.ok(report.operations >= 260, JSON.stringify(report.byKind));
        // Görünürlük kuralları için v2.0.26'nın kendi API'siyle: tahsilatı olan cari ve taksit kartı silinir, peşinli fatura iptal edilir,
        // stokta havaleyle peşin satış (tek kaynak bunları 2.0.26'daki modül tanımları gibi düşürmeli / tutmalı).
        const ok = async (label, promise) => {
          const res = await promise;
          assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
          return res.data;
        };
        const day = TODAY; // motorun dönem kilidi ve fatura serisinin tarih sırası: bugün
        const gone = await ok("cari", admin.post("/api/workspace/accounts", { name: "Altın Silinen Cari", type: "customer", registeredOn: localDay(-10) }));
        await ok("tahsilat", admin.post(`/api/workspace/accounts/${gone.id}/entries`, { kind: "in", amount: "321", date: day, method: "cash" }));
        await ok("havale", admin.post(`/api/workspace/accounts/${gone.id}/entries`, { kind: "in", amount: "654", date: day, method: "bank" }));
        const plan = await ok("kart", admin.post("/api/workspace/plans", { name: "Altın Silinen Kart", total: "900", mode: "auto", count: 3, firstDue: day, registeredOn: localDay(-10), accountId: gone.id }));
        await ok("taksit tahsilatı", admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: day, method: "card" }));
        const service = await ok("hizmet", admin.post("/api/workspace/stock", { kind: "service", code: "ALT-HZM", name: "Altın Hizmet", unit: "Adet", salePrice: "500" }));
        const buyer = await ok("alıcı", admin.post("/api/workspace/accounts", { name: "Altın Fatura Carisi", type: "customer", registeredOn: localDay(-10) }));
        const doc = await ok("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id, issueDate: day, lines: [{ itemId: service.id, qty: 1, unitPrice: 500, vatRate: 0 }], payment: { cash: [{ amount: 200, method: "cash" }, { amount: 100, method: "bank" }], rest: "open", dueDate: day } }));
        await ok("fatura iptal", admin.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Altın test", cashForce: true }));
        const goods = await ok("ürün", admin.post("/api/workspace/stock", { name: "Altın Ürün", code: "ALT-URN", unit: "Adet", unitPrice: 10, salePrice: 30 }));
        await ok("stok girişi", admin.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "10", pay: "none", date: day }));
        await ok("peşin satış", admin.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "2", unitPrice: "30", pay: "cash", method: "bank", date: day }));
        await ok("kart sil", admin.del(`/api/workspace/plans/${plan.id}?cashForce=1`));
        await ok("cari sil", admin.del(`/api/workspace/accounts/${gone.id}?cashForce=1`));
        const count = table => old.app.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
        const money = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"].reduce((sum, table) => sum + count(table), 0);
        assert.ok(money >= 150 && count("invoices") >= 10, `gerçekçi hacim: para tablosu satırı ${money}, fatura ${count("invoices")} (${JSON.stringify(report.byKind)})`);
      } finally {
        await old.close();
      }
      const { problems, compared, k1Changed } = await sideBySide(dataDir, backupDir, "motor", [{ id: "sirket-001", code: "001" }]);
      console.log(`K1 motor: durumu değişen belge ${k1Changed}; karşılaştırılan yanıt ${compared}; senet katlaması (2.2.0 İz 4.2, toplam) ${documentTally.folded} yanıt, ekranla karşılaştırılan dosya ${documentTally.selfChecked}; Nakit Akışı faturasız kalem (2.4.3 MM5) ${unbilledTally.count}`);
      assert.ok(compared >= 75, `karşılaştırılan yanıt sayısı ${compared}`);
      assert.deepEqual(problems, [], `${problems.length} fark:\n${problems.slice(0, 8).join("\n\n")}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
