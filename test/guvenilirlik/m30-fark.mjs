// 2.4.4 madde 30: eski sürümün (v2.4.3, GERÇEK kod) gösterdiği olgular ile 2.4.4 adayının AYNI veride (göçten sonra, aynı sabit sahte günde) gösterdiği
// olguların farkı ve sınıflaması. Beklenen = eski sürümün kendi sayısı (fark testi). Her fark üç sınıftan birine girer:
//   - EŞİT;
//   - BELGELİ: 2.4.4'ün yazılı kararı (docs/2.4.4-IS-LISTESI.md, CLAUDE.md Açık iş) — karar adıyla; kararın KURALI eski verinin kendi kayıtlarından
//     (2.4.3'ün yazdığı tablolar; 2.4.4 kodu okunmaz) denetlenir: kural tutmazsa fark BULGU olur;
//   - BULGU: belgesiz her fark (ders 6: yeniden üretilir, eski kodla karşılaştırılır, kök neden yazılır).
// Kurallar kararların METNİNDEN (kâhin değil, sınıflayıcı; ders 5: 2.4.4 kodundan türetilmez):
//   K-UX18/F2/F3 (madde 15, 31a; kullanıcı kararları 22.10.2026): karşılıksız dönen evrak (faturanın kendi evrakı, faturayla ciro, Kapatılacak Fatura'lı ya da
//     bağsız) kapamadan çıkar → o carinin faturaları yeniden açılır; cari bakiye ve yevmiye DEĞİŞMEZ; taksitli fatura değişmez. Denetim: değişen fatura
//     taksitsiz; carisinde eski veride karşılıksız evrak var; ödenen + açık = ödenecek; carinin Σ açık artışı ≤ carinin karşılıksız evrak toplamı; Σ açık ≤
//     cari bakiye (müşteri) / ≤ −bakiye (tedarikçi); raporların Ödenen/Kalan farkı = faturaların farkı; ANLIK DURUM açık fatura farkı = faturaların farkı.
//   K-23 (madde 23; kullanıcı kararı 21.10.2026, GİB kılavuzu §3): e-Arşiv iptali iletimden sonraki 8 gün (8. gün dahil). Denetim: iletim günü eski verinin
//     işlem geçmişinden (2.4.3'ün yazdığı invoice.e.sent); son gün = iletim + 8; bugün > son gün ⇔ 2.4.4'te İptal Et kapalı.
//   K-v32 / numara tekil (karar 22.10.2026): verilmiş kâğıt / fiş / SMM numarası bir daha verilmez. Denetim: sıradaki = 1 + o seride eski veride VERİLMİŞ en
//     büyük numara (seride duran + Kâğıt Fatura No'ya taşınan + bırakma geçmişindeki).
//   K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a; kullanıcı kararları 21–22.10.2026): Tablodaki Kişiler / Vade Takip / Nakit Akışı / Tahsilat Takvimi kayda bağlı
//     carinin ve kayda bağlı ya da carisinin taksit kartının tahsilatını sayar; çok sekmeli tabloda her sekme kendi analiziyle; aynı dosya no iki sekmede ise
//     tahsilat bir kez. Denetim: değişen her kaydın (anahtarın) eski veride bu durumlardan biri var.
//   K-5 metin: rapor adı "Kayıt Tahsilatları". K-19: Personel Özlük (yeni tablo boş; yeni yetkiler yalnız yöneticide). K-16: Başlarken taban işareti.
//   K-24: e-SMM açık (sıradaki ESM numarası, test serisi TES başlangıcı).
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const minorOf = cell => {
  const m = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return m ? Math.round(Number(`${m[2].replace(/\./g, "")}.${m[3]}`) * 100) * (m[1] ? -1 : 1) : null;
};
const addDays = (day, n) => {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localDay = iso => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Eski verinin (göçten önceki dosya, 2.4.3'ün yazdığı) sınıflama haritası — kopyadan okunur. */
export function oldDataMap(file) {
  const dir = mkdtempSync(path.join(tmpdir(), "m30-fark-"));
  const copy = path.join(dir, "kopya.sqlite");
  copyFileSync(file, copy);
  if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
  const db = new DatabaseSync(copy);
  try {
    const all = sql => db.prepare(sql).all();
    const bounced = new Map(); // cari → karşılıksız evrak toplamı (kuruş)
    for (const row of all("SELECT account_id AS a, amount FROM cheques WHERE status = 'bounced' AND deleted_at IS NULL AND direction = 'in'")) bounced.set(row.a, (bounced.get(row.a) || 0) + Math.round(row.amount * 100));
    // Ciro edilen evrak sonra karşılıksız dönerse ciro edilen tedarikçinin alış faturası etkilenir (faturayla ciro / ciro ile ödeme).
    const bouncedEndorse = new Map();
    for (const row of all("SELECT c.endorse_account_id AS a, c.amount FROM cheques c WHERE c.status = 'bounced' AND c.deleted_at IS NULL AND c.endorse_account_id <> ''")) bouncedEndorse.set(row.a, (bouncedEndorse.get(row.a) || 0) + Math.round(row.amount * 100));
    const linkedCari = new Map(all("SELECT case_key AS k, id FROM accounts WHERE case_key <> '' AND deleted_at IS NULL").map(r => [r.k, r.id]));
    const planKeys = new Set(all("SELECT case_key AS k FROM plans WHERE case_key <> '' AND deleted_at IS NULL").map(r => r.k));
    const planAccounts = new Set(all("SELECT account_id AS a FROM plans WHERE account_id <> '' AND deleted_at IS NULL").map(r => r.a));
    const paidKeys = new Map();
    for (const r of all("SELECT case_key AS k, COUNT(*) AS n FROM payments GROUP BY case_key")) paidKeys.set(r.k, r.n);
    const tabsOfKey = new Map();
    for (const r of all("SELECT case_key AS k, tab FROM dataset_rows")) {
      if (!tabsOfKey.has(r.k)) tabsOfKey.set(r.k, new Set());
      tabsOfKey.get(r.k).add(r.tab);
    }
    const firstTab = all("SELECT tab FROM dataset_rows ORDER BY position LIMIT 1")[0]?.tab || "";
    const valuesOfKey = new Map();
    for (const r of all("SELECT case_key AS k, tab, values_json AS v FROM dataset_rows")) {
      if (!valuesOfKey.has(r.k)) valuesOfKey.set(r.k, []);
      try {
        valuesOfKey.get(r.k).push({ tab: r.tab, values: JSON.parse(r.v) });
      } catch {
        // okunamayan satır
      }
    }
    const linkedEntries = new Set(all("SELECT DISTINCT e.account_id AS a FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE a.case_key <> ''").map(r => r.a));
    // e-Belge iletim günü: 2.4.3'ün işlem geçmişine yazdığı son gönderim (iş saati).
    const sentDay = new Map();
    for (const r of all("SELECT entity_id AS id, MAX(created_at) AS at FROM audit_events WHERE type IN ('invoice.e.sent', 'invoice.e.draft', 'invoice.e.send-failed') GROUP BY entity_id")) sentDay.set(r.id, localDay(r.at));
    // Verilmiş kâğıt / fiş / SMM numaraları (seride duran, Kâğıt Fatura No'ya taşınan, bırakma geçmişindeki).
    const given = new Map(); // "FIS2026" → en büyük sıra
    const giveNo = number => {
      const m = /^([A-Z0-9]{3})(\d{4})(\d{9})$/.exec(String(number || ""));
      if (!m) return;
      const key = `${m[1]}${m[2]}`;
      given.set(key, Math.max(given.get(key) || 0, Number(m[3])));
    };
    for (const r of all("SELECT number, paper_no FROM invoices")) {
      giveNo(r.number);
      giveNo(r.paper_no);
    }
    for (const r of all("SELECT payload_json AS p FROM audit_events WHERE type = 'invoice.withdrawn'")) {
      try {
        giveNo(JSON.parse(r.p).number);
      } catch {
        // okunamayan iz
      }
    }
    const invoicePlan = new Map(all("SELECT id, plan_id AS p, account_id AS a, kind, profile FROM invoices").map(r => [r.id, r]));
    return { bounced, bouncedEndorse, linkedCari, planKeys, planAccounts, paidKeys, tabsOfKey, firstTab, valuesOfKey, linkedEntries, sentDay, given: Object.fromEntries(given), invoicePlan };
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * before/after: tools/m30-goc.mjs measure() çıktıları. maps: { [şirket kodu]: oldDataMap(...) } (göçten önceki dosyadan).
 * Dönüş: { rows: [{ şirket, alan, sınıf, karar, ayrıntı }], bulgu: [...], summaryLines }.
 */
export function diffFacts(before, after, { maps = {}, expectEqual = false } = {}) {
  const rows = [];
  const add = (company, area, klass, decision, detail) => rows.push({ company, area, klass, decision, detail });
  const day = after.day;
  // ---------- kurulum ----------
  if (!same(before.install.companies, after.install.companies)) add("*", "şirket listesi", "BULGU", "", { before: before.install.companies, after: after.install.companies });
  else add("*", "şirket listesi", "EŞİT", "", { count: before.install.companies.length });
  for (const [user, b] of Object.entries(before.install.users)) {
    const a = after.install.users[user];
    if (!a) {
      add("*", `kullanıcı ${user}`, "BULGU", "", "kayboldu");
      continue;
    }
    const gained = a.permissions.filter(p => !b.permissions.includes(p));
    const lost = b.permissions.filter(p => !a.permissions.includes(p));
    if (!gained.length && !lost.length && a.role === b.role) add("*", `kullanıcı ${user}`, "EŞİT", "", { permissions: b.permissions.length });
    else if (!lost.length && gained.every(p => p.startsWith("staff.")) && b.role === "admin") add("*", `kullanıcı ${user}`, "BELGELİ", "K-19 Personel Özlük (yeni yetkiler yalnız yöneticide)", { gained });
    else add("*", `kullanıcı ${user}`, "BULGU", "", { role: [b.role, a.role], gained, lost });
  }
  if (!same(before.install.roles, after.install.roles)) add("*", "roller", "BULGU", "", { before: before.install.roles, after: after.install.roles });
  else add("*", "roller", "EŞİT", "", {});

  for (const code of Object.keys(before.companies)) {
    const B = before.companies[code];
    const A = after.companies[code];
    const M = maps[code] || null;
    if (!A) {
      add(code, "şirket", "BULGU", "", "göçten sonra yok");
      continue;
    }
    // ---------- tek tek eşit olması gerekenler ----------
    const mustEqual = (area, x, y, extra = {}) => {
      if (same(x, y)) add(code, area, "EŞİT", "", extra);
      else add(code, area, "BULGU", "", { ...extra, ...firstDiff(x, y) });
    };
    mustEqual("cari bakiyeleri (tek tek)", B.accounts, A.accounts, { count: Object.keys(B.accounts).length, sum: Object.values(B.accounts).reduce((s, a) => s + a.balance, 0) });
    mustEqual("mizan (her hesap)", B.trial, A.trial, { accounts: Object.keys(B.trial).length });
    mustEqual("mizan toplamı", B.trialTotals, A.trialTotals, B.trialTotals);
    mustEqual("defter mutabakatı", B.reconciliation, A.reconciliation, { checks: Object.keys(B.reconciliation).length });
    mustEqual("Mutabakat Testi sapmaları", B.integrity.failures, A.integrity.failures, { failures: B.integrity.failures.length });
    const newBad = A.integrity.checksBad.filter(c => !B.integrity.checksBad.includes(c));
    const newOk = A.integrity.checksOk.filter(c => !B.integrity.checksOk.includes(c));
    if (newBad.length) add(code, "Mutabakat Testi denetimleri", "BULGU", "", { newBad });
    else add(code, "Mutabakat Testi denetimleri", newOk.length ? "BELGELİ" : "EŞİT", newOk.length ? "2.4.4'ün yeni denetimleri (tamam)" : "", { ok: A.integrity.checksOk.length, newOk });
    mustEqual("dönem kilidi", B.lockedUntil, A.lockedUntil, { lockedUntil: B.lockedUntil });
    mustEqual("Kasa (toplam, yol başına, satırlar)", B.cash, A.cash, { totals: B.cash.totals, rows: B.cash.allCount });
    mustEqual("banka hesapları (tek tek)", B.bank, A.bank, { accounts: Object.keys(B.bank.accounts || {}).length });
    mustEqual("Banka özeti", B.bankSummary, A.bankSummary);
    mustEqual("çek/senet (tek tek: durum, tutar, cari, fatura)", B.cheques, A.cheques, { count: Object.keys(B.cheques).length, byStatus: countBy(Object.values(B.cheques), c => c.status) });
    mustEqual("taksit kartları (tek tek)", B.plans, A.plans, { count: Object.keys(B.plans).length });
    mustEqual("taksit toplamları", B.planTotals, A.planTotals, B.planTotals);
    mustEqual("stok (tek tek)", B.stock, A.stock, { count: Object.keys(B.stock).length });
    mustEqual("KDV mahsup fişleri", B.vatOffsets, A.vatOffsets, { count: Array.isArray(B.vatOffsets) ? B.vatOffsets.length : null });
    mustEqual("tablo (veri oturumu)", B.dataset, A.dataset, B.dataset);
    mustEqual("şüpheli alacaklar", B.doubtful, A.doubtful);
    mustEqual("Gönderilecekler", B.pending, A.pending, { count: B.pending.length });
    mustEqual("seri adları", B.series, A.series, B.series);

    // ---------- faturalar ----------
    const changed = [];
    const stable = ["kind", "status", "number", "displayNo", "ettn", "issueDate", "accountId", "profile", "eStatus", "eUnsent", "payable", "planId", "originalId"];
    const invoiceBug = [];
    for (const [id, b] of Object.entries(B.invoices)) {
      const a = A.invoices[id];
      if (!a) {
        invoiceBug.push({ id, why: "göçten sonra yok" });
        continue;
      }
      const moved = stable.filter(key => !same(b[key], a[key]));
      if (moved.length) invoiceBug.push({ id, number: b.number, fields: moved.map(key => [key, b[key], a[key]]) });
      if (b.paid !== a.paid || b.open !== a.open || b.payState !== a.payState) changed.push({ id, ...b, after: { paid: a.paid, open: a.open, payState: a.payState } });
    }
    const extra = Object.keys(A.invoices).filter(id => !B.invoices[id]);
    if (invoiceBug.length || extra.length) add(code, "faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar)", "BULGU", "", { invoiceBug: invoiceBug.slice(0, 20), extra });
    else add(code, "faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar)", "EŞİT", "", { count: Object.keys(B.invoices).length, byProfile: countBy(Object.values(B.invoices), d => d.profile), byEStatus: countBy(Object.values(B.invoices), d => d.eStatus || "-") });
    // Ödeme durumu: K-UX18 kuralı.
    const byAccount = new Map();
    for (const doc of changed) {
      if (!byAccount.has(doc.accountId)) byAccount.set(doc.accountId, []);
      byAccount.get(doc.accountId).push(doc);
    }
    const ux18Bad = [];
    let reopened = 0;
    for (const [accountId, docs] of byAccount) {
      const acc = B.accounts[accountId];
      const bouncedHere = (M?.bounced.get(accountId) || 0) + (M?.bouncedEndorse.get(accountId) || 0);
      const delta = docs.reduce((s, d) => s + d.after.open - d.open, 0);
      reopened += delta;
      const allOpenAfter = Object.values(A.invoices).filter(d => d.accountId === accountId && d.status === "issued").reduce((s, d) => s + (d.kind.includes("return") ? 0 : d.open), 0);
      const reasons = [];
      if (!M) reasons.push("eski veri haritası yok");
      if (docs.some(d => d.planId)) reasons.push("taksitli fatura değişti");
      if (!bouncedHere) reasons.push("carisinde karşılıksız evrak yok");
      if (delta < 0) reasons.push(`cari Σ açık azaldı (${delta})`);
      if (delta > bouncedHere) reasons.push(`Σ açık artışı ${delta} > karşılıksız ${bouncedHere}`);
      if (docs.some(d => d.after.paid + d.after.open !== d.payable)) reasons.push("ödenen + açık ≠ ödenecek");
      const limit = acc ? Math.abs(acc.balance) : 0;
      if (allOpenAfter > limit && acc?.balance !== 0) reasons.push(`Σ açık ${allOpenAfter} > |bakiye| ${limit}`);
      if (reasons.length) ux18Bad.push({ accountId, name: acc?.name, docs: docs.map(d => [d.number, d.open, d.after.open, d.payState, d.after.payState]), bouncedHere, reasons });
    }
    if (!changed.length) add(code, "faturaların ödeme durumu", "EŞİT", "", {});
    else if (!ux18Bad.length) add(code, "faturaların ödeme durumu", "BELGELİ", "K-UX18/F2/F3 karşılıksız evrak kapamadan çıkar (madde 15, 31a; kararlar 22.10.2026)", { invoices: changed.length, caris: byAccount.size, reopenedMinor: reopened, payState: countBy(changed, d => `${d.payState}→${d.after.payState}`), byKind: countBy(changed, d => d.kind) });
    else add(code, "faturaların ödeme durumu", "BULGU", "K-UX18 kuralı tutmuyor", { bad: ux18Bad.slice(0, 15), total: changed.length });
    const deltaOf = kinds => changed.filter(d => kinds.includes(d.kind)).reduce((s, d) => s + d.after.open - d.open, 0);
    const saleDelta = deltaOf(["sale", "smm"]);
    const purchaseDelta = deltaOf(["purchase"]);
    // ANLIK DURUM
    const ovB = B.overview;
    const ovA = A.overview;
    const ovDiff = Object.keys({ ...ovB, ...ovA }).filter(key => !same(ovB[key], ovA[key]));
    for (const key of ovDiff) {
      if (key === "invoices") {
        const x = ovB.invoices;
        const y = ovA.invoices;
        const ds = Math.round((y.openSale - x.openSale) * 100);
        const dp = Math.round((y.openPurchase - x.openPurchase) * 100);
        const restSame = same({ ...x, openSale: 0, overdueSale: 0, openPurchase: 0, overduePurchase: 0 }, { ...y, openSale: 0, overdueSale: 0, openPurchase: 0, overduePurchase: 0 });
        if (restSame && ds === saleDelta && dp === purchaseDelta) add(code, "ANLIK DURUM · faturalar", "BELGELİ", "K-UX18 (açık fatura farkı = faturaların farkı)", { openSale: [x.openSale, y.openSale], openPurchase: [x.openPurchase, y.openPurchase] });
        else add(code, "ANLIK DURUM · faturalar", "BULGU", "", { x, y, saleDelta, purchaseDelta });
      } else add(code, `ANLIK DURUM · ${key}`, "BULGU", "", { before: ovB[key], after: ovA[key] });
    }
    if (!ovDiff.length) add(code, "ANLIK DURUM", "EŞİT", "", {});
    // ---------- e-Belge kartları (K-23) ----------
    const cardBad = [];
    let k23 = 0;
    let k23Kept = 0;
    for (const [id, b] of Object.entries(B.edocCards)) {
      const a = A.edocCards[id];
      if (!a) {
        cardBad.push({ id, why: "kart yok" });
        continue;
      }
      const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => !same(b[k], a[k]));
      if (!keys.length) {
        if (B.invoices[id]?.profile === "EARSIVFATURA" && b.canCancel) k23Kept += 1;
        continue;
      }
      const doc = B.invoices[id];
      const sent = M?.sentDay.get(id);
      const late = sent ? addDays(sent, 8) < day : null;
      const onlyCancel = keys.every(k => ["canCancel", "cancelBlock", "cancelWindow"].includes(k));
      const okK23 = onlyCancel && doc?.profile === "EARSIVFATURA" && sent && (late ? a.canCancel === false && b.canCancel === true : a.canCancel === b.canCancel) && (!a.cancelWindow || a.cancelWindow.late === late);
      if (okK23) {
        if (late) k23 += 1;
      } else cardBad.push({ id, number: doc?.number, profile: doc?.profile, eStatus: doc?.eStatus, sent, late, keys: keys.map(k => [k, b[k], a[k]]) });
    }
    if (cardBad.length) add(code, "e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri)", "BULGU", "", { bad: cardBad.slice(0, 15), count: cardBad.length });
    else add(code, "e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri)", k23 ? "BELGELİ" : "EŞİT", k23 ? "K-23 iptal süresi iletimden 8 gün (madde 23)" : "", { cards: Object.keys(B.edocCards).length, iptalKapandi: k23, sureIcindeAcikKalan: k23Kept });
    // ---------- sıradaki numaralar (K-v32, K-24) ----------
    for (const key of [...new Set([...Object.keys(B.nextNumbers), ...Object.keys(A.nextNumbers)])]) {
      const b = B.nextNumbers[key];
      const a = A.nextNumbers[key];
      if (same(a, b)) {
        add(code, `sıradaki numara · ${key}`, "EŞİT", "", { next: a, givenMax: givenFor(M, a) });
        continue;
      }
      if (b === undefined && key === "esmm") {
        add(code, `sıradaki numara · ${key}`, "BELGELİ", "K-24 e-SMM açık (server.mjs esmmEnabled)", { next: a });
        continue;
      }
      const m = /^([A-Z0-9]{3})(\d{4})(\d{9})$/.exec(String(a || ""));
      const expected = m ? (M?.given[`${m[1]}${m[2]}`] || 0) + 1 : null;
      if (m && ["paper", "smm"].includes(key) && Number(m[3]) === expected) add(code, `sıradaki numara · ${key}`, "BELGELİ", "K-v32 / numara tekil: verilmiş fiş numarası bir daha verilmez (karar 22.10.2026)", { before: b, after: a, givenMax: expected - 1, eskiSurumYenidenVerirdi: Number(/(\d{9})$/.exec(b)?.[1]) <= expected - 1 });
      else add(code, `sıradaki numara · ${key}`, "BULGU", "", { before: b, after: a, expected });
    }
    // ---------- rapor merkezi ----------
    const UX18_REPORTS = new Set(["acik-faturalar", "alacak-yaslandirma", "fatura-satis", "fatura-alis"]);
    const openCount = { before: Object.values(B.invoices).filter(d => d.status === "issued" && d.open > 0 && !d.planId).length, after: Object.values(A.invoices).filter(d => d.status === "issued" && d.open > 0 && !d.planId).length };
    const changedNumbers = new Set(changed.map(d => d.number));
    const changedAccounts = new Set(changed.map(d => B.accounts[d.accountId]?.name).filter(Boolean));
    let reportsEqual = 0;
    for (const id of [...new Set([...Object.keys(B.reports), ...Object.keys(A.reports)])]) {
      const x = B.reports[id];
      const y = A.reports[id];
      if (!x) {
        add(code, `rapor ${id}`, "BELGELİ", "2.4.4'te yeni rapor", { title: y.title });
        continue;
      }
      if (!y) {
        add(code, `rapor ${id}`, "BULGU", "", "2.4.4'te yok");
        continue;
      }
      const diffKeys = ["title", "headers", "total", "footer", "summary", "rowsDigest"].filter(k => !same(x[k], y[k]));
      if (!diffKeys.length) {
        reportsEqual += 1;
        continue;
      }
      if (diffKeys.length === 1 && diffKeys[0] === "title" && id === "kayit-tahsilatlari" && y.title === "Kayıt Tahsilatları") {
        add(code, `rapor ${id}`, "BELGELİ", "K-5 metin: rapor adı \"Kayıt Tahsilatları\" (madde 5)", { before: x.title, after: y.title });
        continue;
      }
      if (UX18_REPORTS.has(id) && !diffKeys.includes("headers") && !diffKeys.includes("title")) {
        const verdict = ux18Report(x, y, { changedNumbers, changedAccounts, saleDelta, purchaseDelta, id, openCount });
        add(code, `rapor ${id}`, verdict.ok ? "BELGELİ" : "BULGU", verdict.ok ? "K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri)" : "K-UX18 kuralı tutmuyor", verdict.detail);
        continue;
      }
      add(code, `rapor ${id}`, "BULGU", "", { diffKeys, before: pickSummary(x), after: pickSummary(y) });
    }
    add(code, "rapor merkezi (öbür raporlar)", "EŞİT", "", { equalReports: reportsEqual });
    // ---------- tablo raporları ve tahsilat takvimi (K-5, K-31a, K-5c) ----------
    const changedIds = new Set(changed.map(d => d.id));
    const why = key => {
      const reasons = [];
      if (key.startsWith("invoice|")) return changedIds.has(key.slice(8)) ? ["vadeli fatura kalemi, fatura yeniden açıldı (K-UX18)"] : [];
      if (key.startsWith("plan|") || key.startsWith("cheque|")) return [];
      if (!M) return ["eski veri haritası yok"];
      const tabs = M.tabsOfKey.get(key);
      if (M.linkedCari.has(key)) reasons.push("kayda bağlı cari (K-5)");
      if (M.planKeys.has(key) || (M.linkedCari.has(key) && M.planAccounts.has(M.linkedCari.get(key)))) reasons.push("kayda bağlı / carisinin taksit kartı (K-31a F1/F5)");
      if (tabs && tabs.size > 1) reasons.push("aynı anahtar iki sekmede (K-5c)");
      if (tabs && ![...tabs].includes(M.firstTab)) reasons.push("ilk sekme dışı (K-31a F4 sekme başına analiz)");
      return reasons;
    };
    // B1 (belgesiz yan etki adayı, 7d51d60 madde 5b): kalemin tutarı tablonun "Toplam Borç" kolonundan "Kalan Borç" kolonuna geçti (aynı kalem, aynı tarih).
    const tlCell = v => {
      const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? Math.round(n * 100) : null;
    };
    const isB1 = (key, x, y, amountAt) => {
      const rows = M?.valuesOfKey.get(key) || [];
      const pairs = rows.map(r => [tlCell(r.values["Toplam Borç"]), tlCell(r.values["Kalan Borç"])]).filter(([t, k]) => t !== null && k !== null && t !== k);
      if (!pairs.length || !x || !y || x.length !== y.length) return false;
      let moved = 0;
      for (let i = 0; i < x.length; i += 1) {
        const a = x[i];
        const b = y[i];
        if (same(a, b)) continue;
        const restSame = same(a.filter((_, j) => j !== amountAt), b.filter((_, j) => j !== amountAt));
        // Programda girilen tahsilat (P) kalemden düşülür: önce = max(0, T − P), sonra = max(0, K − P) — aynı kolon değişimi, tahsilatlı kalemde.
        const shifted = ([t, k]) => (a[amountAt] === t && b[amountAt] === k) || (a[amountAt] > 0 && b[amountAt] === Math.max(0, k - (t - a[amountAt]))) || (a[amountAt] === 0 && b[amountAt] === 0);
        if (!restSame || !pairs.some(shifted)) return false;
        moved += 1;
      }
      return moved > 0;
    };
    const keyTable = (area, x, y, amountAt = null) => {
      const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => !same(x[k], y[k]));
      if (!keys.length) return add(code, area, "EŞİT", "", { keys: Object.keys(x).length });
      const unexplained = [];
      const b1 = [];
      const byReason = {};
      for (const key of keys) {
        if (amountAt !== null && isB1(key, x[key], y[key], amountAt)) {
          b1.push({ key, before: x[key], after: y[key] });
          continue;
        }
        const reasons = why(key);
        if (!reasons.length) unexplained.push({ key, before: x[key], after: y[key] });
        for (const r of reasons) byReason[r] = (byReason[r] || 0) + 1;
      }
      if (b1.length) add(code, `${area} — Toplam Borç → Kalan Borç`, "BULGU", "B1: belgesiz yan etki (7d51d60 madde 5b borç kolonu seçimi)", { keys: b1.length, minorBefore: b1.reduce((s, r) => s + r.before.reduce((t, it) => t + it[amountAt], 0), 0), minorAfter: b1.reduce((s, r) => s + r.after.reduce((t, it) => t + it[amountAt], 0), 0), sample: b1.slice(0, 3) });
      if (unexplained.length) add(code, area, "BULGU", "değişen kayıt belgeli durumların hiçbirinde değil", { changed: keys.length - b1.length, unexplained: unexplained.slice(0, 10), unexplainedCount: unexplained.length, byReason });
      else if (keys.length > b1.length) add(code, area, "BELGELİ", "K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a)", { changed: keys.length - b1.length, byReason });
    };
    const ce = r => {
      const out = {};
      for (const g of r?.report?.groups || []) for (const line of g.lines || []) {
        const key = line.key || "";
        const was = out[key] || { borc: 0, alacak: 0, lines: 0 };
        was.borc += Math.round((line.borc || 0) * 100);
        was.alacak += Math.round((line.alacak || 0) * 100);
        was.lines += 1;
        out[key] = was;
      }
      return out;
    };
    keyTable("Tablodaki Kişiler (kayıt başına borç / alacak)", ce(B.tableReports["cari-ekstre"]), ce(A.tableReports["cari-ekstre"]));
    const vt = r => {
      const out = {};
      for (const row of r?.report?.rows || []) {
        const key = row.caseKey || "";
        (out[key] ||= []).push([row.label, row.date, Math.round((row.amount || 0) * 100), row.state]);
      }
      for (const k of Object.keys(out)) out[k].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return out;
    };
    keyTable("Vade Takip (kayıt başına kalemler)", vt(B.tableReports["vade-takip"]), vt(A.tableReports["vade-takip"]), 2);
    const du = d => {
      const out = {};
      for (const item of d?.items || []) (out[item.caseKey || item.id || ""] ||= []).push([item.column ?? item.label ?? null, item.due ?? item.dueDate ?? null, Math.round((item.amount || 0) * 100), item.state, item.partial]);
      for (const k of Object.keys(out)) out[k].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return out;
    };
    keyTable("Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler)", du(B.dues), du(A.dues), 2);
    const na = r => r?.report?.totals || null;
    const nb = na(B.tableReports["nakit-akis"]);
    const nc = na(A.tableReports["nakit-akis"]);
    if (same(nb, nc)) add(code, "Nakit Akışı", "EŞİT", "", nb);
    else if (nb && nc && nb.cashIn === nc.cashIn && nb.cashOut === nc.cashOut && nb.net === nc.net) add(code, "Nakit Akışı", "BELGELİ", "K-5 / K-31a F5 (Beklenen / Gerçekleşen; Kasa giriş-çıkışı aynı)", { before: nb, after: nc });
    else add(code, "Nakit Akışı", "BULGU", "", { before: nb, after: nc });
  }
  // ---------- dosya ----------
  for (const code of Object.keys(before.files)) {
    const b = before.files[code];
    const a = after.files[code];
    if (!a) continue;
    const newTables = a.tables.filter(t => !b.tables.includes(t));
    const lostTables = b.tables.filter(t => !a.tables.includes(t));
    const counts = Object.keys(b.counts).filter(t => b.counts[t] !== a.counts[t]).map(t => [t, b.counts[t], a.counts[t]]);
    add(code, "veri dosyası: şema sürümü", a.version === 32 ? "BELGELİ" : "BULGU", "göç v31 + v32", { before: b.version, after: a.version, integrity: a.integrity });
    const okCounts = counts.every(([t, x, y]) => (t === "settings" && y - x <= 3 && y >= x) || (expectEqual ? false : ["audit_events", "sessions", "auth_sessions", "integrity_log", "login_attempts"].includes(t) && y >= x));
    add(code, "veri dosyası: tablolar ve satır sayıları", !lostTables.length && newTables.every(t => t === "staff_members") && (a.counts.staff_members || 0) === 0 && okCounts ? "BELGELİ" : "BULGU", "K-19 staff_members (boş) + ayar satırları (K-v32 numberFloor, K-16 Başlarken)", { newTables, lostTables, counts, numberFloor: a.numberFloor });
  }
  const bulgu = rows.filter(r => r.klass === "BULGU");
  const summaryLines = [`fark: ${rows.length} olgu · EŞİT ${rows.filter(r => r.klass === "EŞİT").length} · BELGELİ ${rows.filter(r => r.klass === "BELGELİ").length} · BULGU ${bulgu.length}`, ...bulgu.map(r => `  BULGU ${r.company} ${r.area}: ${JSON.stringify(r.detail).slice(0, 400)}`)];
  return { day, before: { version: before.version, commit: before.commit }, after: { version: after.version, commit: after.commit }, rows, bulgu, summaryLines };
}

function ux18Report(x, y, { changedNumbers, changedAccounts, saleDelta, purchaseDelta, id, openCount }) {
  // Ön izleme satırları ilk 200 ile sınırlı (PREVIEW_ROWS); TOPLAM ve özet bütün satırlardandır → denetim TOPLAM/özet farkı = faturaların farkı, satır sayısı
  // = açık fatura sayısı, görünen satırlarda yalnız değişen fatura / carinin satırı farklı.
  const bad = [];
  const col = name => (x.headers || []).indexOf(name);
  const cellOf = (rows, i) => minorOf(rows?.[i]);
  const sumKey = (s, k) => minorOf(s?.find?.(([key]) => key === k)?.[1]);
  const footerDelta = name => (col(name) >= 0 ? cellOf(y.footer, col(name)) - cellOf(x.footer, col(name)) : null);
  const expect = (label, got, want) => {
    if (got !== want) bad.push({ label, got, want });
  };
  if (id === "fatura-satis" || id === "fatura-alis") {
    const delta = id === "fatura-satis" ? saleDelta : purchaseDelta;
    expect("TOPLAM Kalan farkı", footerDelta("Kalan"), delta);
    expect("TOPLAM Ödenen farkı", footerDelta("Ödenen"), -delta);
    for (const name of ["Matrah", "KDV", "Tevkifat", "Stopaj", "Ödenecek"]) expect(`TOPLAM ${name}`, footerDelta(name), col(name) >= 0 ? 0 : null);
    expect("satır sayısı", y.total, x.total);
  } else if (id === "acik-faturalar") {
    expect("Açık Alacak farkı", sumKey(y.summary, "Açık Alacak") - sumKey(x.summary, "Açık Alacak"), saleDelta);
    expect("Açık Borç farkı", sumKey(y.summary, "Açık Borç") - sumKey(x.summary, "Açık Borç"), purchaseDelta);
    expect("satır sayısı = açık fatura sayısı (önce)", x.total, openCount.before);
    expect("satır sayısı = açık fatura sayısı (sonra)", y.total, openCount.after);
  } else if (id === "alacak-yaslandirma") {
    expect("TOPLAM Toplam", footerDelta("Toplam"), 0);
    expect("Faturasız Alacak farkı", footerDelta("Faturasız Alacak (dilimlere dahil)"), -saleDelta);
    expect("satır sayısı", y.total, x.total);
  } else bad.push({ label: "kuralı tanımlanmamış rapor" });
  // Görünen satırlar: yalnız değişen faturanın (No) ya da carinin (ad) satırı farklı olabilir; yaşlandırmada carinin Toplam'ı aynı.
  const noCol = ["Fatura No"].map(col).find(i => i >= 0);
  const cariCol = ["Cari / Kişi", "Cari"].map(col).find(i => i >= 0);
  if (x.rows && y.rows && id !== "acik-faturalar") {
    // Aynı adlı iki cari (test kuralı) aynı anahtara düşebilir: anahtar başına satırlar küme olarak karşılaştırılır.
    const keyOf = row => (noCol !== undefined ? row[noCol] : row[cariCol]);
    const group = rows => rows.reduce((map, row) => map.set(keyOf(row), [...(map.get(keyOf(row)) || []), row]), new Map());
    const gx = group(x.rows);
    const gy = group(y.rows);
    for (const [key, rows] of gx) {
      const others = gy.get(key);
      if (!others || same(rows, others)) continue;
      const name = noCol !== undefined ? rows[0][noCol] : rows[0][cariCol];
      const explained = noCol !== undefined ? changedNumbers.has(name) : changedAccounts.has(name);
      if (!explained) bad.push({ rows, others });
      if (id === "alacak-yaslandirma" && !same(rows.map(r => r.at(-1)).sort(), others.map(r => r.at(-1)).sort())) bad.push({ label: "carinin Toplam'ı değişti", rows, others });
    }
  }
  return { ok: !bad.length, detail: { saleDelta, purchaseDelta, total: [x.total, y.total], bad: bad.slice(0, 10), badCount: bad.length } };
}

function givenFor(M, number) {
  const m = /^([A-Z0-9]{3})(\d{4})(\d{9})$/.exec(String(number || ""));
  return m && M ? M.given[`${m[1]}${m[2]}`] ?? 0 : null;
}
function countBy(list, fn) {
  const out = {};
  for (const item of list) out[fn(item)] = (out[fn(item)] || 0) + 1;
  return out;
}
function pickSummary(r) {
  return { total: r.total, footer: r.footer, summary: r.summary, title: r.title };
}
function firstDiff(x, y, p = "") {
  if (same(x, y)) return {};
  if (x && y && typeof x === "object" && typeof y === "object") {
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    const diffs = keys.filter(k => !same(x[k], y[k]));
    const first = diffs[0];
    const deeper = firstDiff(x[first], y[first], `${p}/${first}`);
    return { diffCount: diffs.length, firstKeys: diffs.slice(0, 5), ...deeper, at: deeper.at || `${p}/${first}`, before: deeper.before ?? x[first], after: deeper.after ?? y[first] };
  }
  return { at: p, before: x, after: y };
}
