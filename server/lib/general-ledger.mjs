// Ana Defter (v2.0.13) — çift yönlü kayıt ve alt defter ↔ ana defter mutabakatı.
//
// Mimari karar: programın asıl kayıtları alt defterlerdir (Kasa ve Banka, cari, taksit, stok, çek/senet). Ana Defter bu
// kayıtlardan HER SEFERİNDE AYNI KURALLA türetilir; ikinci bir kopya olarak saklanmaz. Böylece alt defter ile ana defter
// arasında "biri yazıldı öbürü yazılmadı" sapması yapısal olarak imkânsızdır (SAP/Oracle'daki alt defter → ana defter
// entegrasyonunun yerel-öncelikli karşılığı). Her kaynak satırı bir yevmiye maddesi olur: borç toplamı = alacak toplamı.
// Mutabakat kapısı (reconcile) ana defter hesaplarının bakiyelerini alt defterlerin kendi hesabıyla kuruşu kuruşuna
// karşılaştırır; fark varsa hangi hesapta ve ne kadar olduğunu söyler.
//
// Hesap planı: Tekdüzen Hesap Planı'nın ilgili hesapları.
import { roundMoney } from "./money.mjs";

export const CHART = Object.freeze({
  100: "Kasa (Nakit)",
  101: "Alınan Çekler ve Senetler (Portföy)",
  102: "Bankalar (Havale / EFT)",
  103: "Verilen Çekler ve Senetler",
  108: "Kredi Kartı Tahsilatları (POS)",
  120: "Alıcılar (Müşteri Carileri)",
  127: "Carisiz Taksit Kartları",
  153: "Ticari Mallar (Stok Alımları)",
  191: "İndirilecek KDV",
  193: "Peşin Ödenen Vergiler (Stopaj)",
  255: "Demirbaşlar",
  // v2.1.0 (§3.11): banka kredisi ve kurumsal kredi kartı borcu.
  300: "Banka Kredileri",
  309: "Diğer Mali Borçlar (Kurumsal Kredi Kartları)",
  320: "Satıcılar (Tedarikçi Carileri)",
  336: "Diğer Cariler (Personel vb.)",
  360: "Ödenecek Vergi ve Fonlar (Tevkifat, Stopaj)",
  391: "Hesaplanan KDV",
  500: "Açılış ve Devir Bakiyeleri",
  600: "Yurt İçi Satışlar (Stok)",
  602: "Diğer Gelirler (Hizmet, Taksitli Satış, Kayıt Tahsilatları)",
  610: "Satıştan İadeler",
  // v2.1.0 (§3.11): faiz geliri ve kambiyo kârı (banka fişi, döviz değerlemesi).
  642: "Faiz Gelirleri",
  646: "Kambiyo Kârları",
  // Gözden geçirme D3 (Aşama 2): plan §3.11 bu hesaba Tekdüzen Hesap Planı'ndaki adını ("Diğer Olağan Gelir ve Kârlar") verir; ad, Banka Fişi
  // 649'a yazmaya başladığında (Aşama 4) değişecek. Aşama 2'de kullanıcının gördüğü hiçbir metin değişmez (Ana Defter, Hesap Planı Mizanı,
  // PDF/Excel 2.0.26 ile aynı).
  649: "Diğer Olağan Gelirler (Kasaya Elle)",
  // v2.1.0 (§3.11): POS komisyonu, kambiyo zararı, diğer olağan giderler, finansman giderleri.
  653: "Komisyon Giderleri",
  656: "Kambiyo Zararları",
  659: "Diğer Olağan Gider ve Zararlar",
  689: "Kapatılan Kartlardan Vazgeçilen Alacaklar",
  760: "Pazarlama, Satış ve Dağıtım Giderleri",
  770: "Genel Giderler ve Alış Faturaları",
  780: "Finansman Giderleri",
});
const PARTY_ACCOUNTS = new Set(["120", "127", "320", "336"]);
const CONTROL = { customer: "120", supplier: "320", other: "336" };
const cents = value => Math.round((Number(value) || 0) * 100);
const opening = note => /^açılış/i.test(String(note || "").trim());
/** Hesabı atanmamış (fin_ref '') eski ve yeni banka/POS hareketlerinin alt hesapları (§3.11). */
export const UNASSIGNED_SUBS = Object.freeze({ "102.00": "Hesabı Atanmamış Eski Hareketler", "108.00": "Hesabı Atanmamış Eski Hareketler" });

/**
 * Para hareketinin ana ve alt hesabı (v2.1.0, §3.11; 2.0.26'daki cashAccount'un yerine): yol + bağ (fin_ref).
 *   nakit → 100 · havale → 102 (banka hesabının alt hesabı; bağsız 102.00) · POS → 108 (POS'un alt hesabı; bağsız 108.00) ·
 *   kurumsal kartla ödeme (kart hesabına bağlı) → 309 (kartın alt hesabı). Tanınmayan yol 2.0.26'daki gibi 100'e yazılır (eski
 *   verinin mizanı değişmez; money:method bu satırı ayrıca yakalar).
 * refs: { accounts: { [id]: { kind, gl, glSub } }, pos: { [id]: { glSub } } } — banka hesabı ve POS kartları.
 */
export function moneyAccount(method, ref = "", refs = {}) {
  const account = ref ? refs?.accounts?.[ref] : null;
  if (method === "bank") return { account: "102", sub: account && !["card", "loan"].includes(account.kind) ? account.glSub : "102.00" };
  if (method === "card") {
    if (account?.kind === "card") return { account: "309", sub: account.glSub };
    const pos = ref ? refs?.pos?.[ref] : null;
    return { account: "108", sub: pos ? pos.glSub : "108.00" };
  }
  // Kredi (v2.1.0 Aşama 3): yalnız Banka Fişi satırında (rol "loan", kredi hesabına bağlı); modül satırında kredi yolu yoktur.
  if (method === "loan") return { account: "300", sub: account?.kind === "loan" ? account.glSub : "300.00" };
  return { account: "100", sub: "" };
}

/**
 * Yevmiye maddeleri.
 * @param {object} rows  { payments, cashEntries, accountEntries, plans, planEntries, stockMoves, chequeEvents }
 *   accountEntries: { id, kind, amount, date, note, source, method, accountType, chequeDirection?, moveReason? }
 *   plans: { id, total, status, coversBalance, date, accountType (''/null: carisiz), paid }
 *   planEntries: { id, planId, kind, amount, date, method, chequeId, opening, accountType }
 *   stockMoves: { id, kind, amount, date, pay, method, reason }   (yalnız Kasa'ya/Banka'ya yazanlar; cariye yazanlar
 *               cari hareketinden gelir — iki kez sayılmaz)
 *   chequeEvents: { id, kind: 'collect'|'pay', amount, date, method }
 *   invoices: { id, kind, date, number, glJson ([{ account, net }] TL kuruş), tryVat, tryWithheld, tryStoppage, tryPayable,
 *               accountType, party }  (yalnız kesilmiş; taslak ve iptal deftere girmez)
 *
 * Fatura (v2.0.15) çok satırlı tek yevmiye maddesidir; cariye yazılan borç/alacak satırı (account_entries, source =
 * 'invoice') faturanın kendisinden gelir, ikinci kez sayılmaz. Faturanın peşin tahsilat/ödemesi ayrı cari satırıdır
 * (Kasa ↔ cari), normal tahsilat gibi işlenir.
 *   satış / SMM      : B 120 ödenecek, B 193 stopaj  ·  A 600 matrah, A 391 (KDV − tevkifat)
 *   satıştan iade    : B 610 matrah, B 391 (KDV − tevkifat)  ·  A 120 ödenecek
 *   alış             : B 153/770/760/255 matrah, B 191 KDV  ·  A 360 (tevkifat + stopaj), A 320 ödenecek
 *   alıştan iade     : B 320 ödenecek, B 360 (tevkifat + stopaj)  ·  A 153/770/… matrah, A 191 KDV
 */
export function journal(rows) {
  const out = [];
  // party: cari kimliği. Kontrol hesaplarına (120/127/320/336) düşen satır hangi cariye/karta aitse onu taşır; cari
  // bazında mutabakat (her carinin ana defter bakiyesi = cari kartındaki bakiye) bununla yapılır.
  let party = "";
  // debit/credit: hesap kodu ya da { account, sub } (para hesapları alt hesabı taşır: 102.01, 108.00 …).
  const post = (id, date, source, text, debit, credit, amount) => {
    const value = cents(amount);
    if (!value) return;
    const line = (target, dr, cr) => {
      const { account, sub } = typeof target === "string" ? { account: target, sub: "" } : target;
      const out = { account, debit: dr, credit: cr };
      if (sub) out.sub = sub;
      if (PARTY_ACCOUNTS.has(account) && party) out.party = party;
      return out;
    };
    out.push({ id, date, source, text, lines: [line(debit, value, 0), line(credit, 0, value)] });
  };
  const refs = rows.refs || {};
  const moneyOf = row => moneyAccount(row.method, row.ref || "", refs);
  for (const row of rows.payments || []) post(`payment:${row.id}`, row.date, "Kayıt tahsilatı", row.note || "Tahsilat", moneyOf(row), "602", row.amount);
  for (const row of rows.cashEntries || []) {
    // v2.0.17: Kasa ↔ Banka transferi gelir/gider değildir — tek fiş, 100 ↔ 102 (nakit tarafı yazılır, banka tarafı atlanır). v2.1.0: banka
    // tarafının hesabı ikiz satırdan (bankRef; routes/ledger.mjs rows).
    if (row.transferId) {
      if (row.method !== "cash") continue;
      const bank = moneyAccount("bank", row.bankRef || "", refs);
      const cash = moneyAccount("cash");
      if (row.kind === "in") post(`transfer:${row.transferId}`, row.date, "Kasa ↔ Banka", row.description || "Bankadan Kasaya Aktarım", cash, bank, row.amount);
      else post(`transfer:${row.transferId}`, row.date, "Kasa ↔ Banka", row.description || "Kasadan Bankaya Yatırma", bank, cash, row.amount);
      continue;
    }
    if (row.kind === "in") post(`cash:${row.id}`, row.date, "Kasa", row.description || "Kasaya giriş", moneyOf(row), "649", row.amount);
    else post(`cash:${row.id}`, row.date, "Kasa", row.description || "Kasadan ödeme", "770", moneyOf(row), row.amount);
  }
  for (const row of rows.accountEntries || []) {
    party = row.party || "";
    const control = CONTROL[row.accountType] || CONTROL.customer;
    const id = `account:${row.id}`;
    if (row.source === "cheque") {
      // Alınan evrak portföyde (101), verilen evrak ödenecekte (103) izlenir; cariye yazılan etki karşı taraftır.
      const counter = row.chequeDirection === "out" ? "103" : "101";
      if (row.kind === "debt") post(id, row.date, "Çek / Senet", row.note, control, counter, row.amount);
      else post(id, row.date, "Çek / Senet", row.note, counter, control, row.amount);
      continue;
    }
    // Faturanın borç/alacak satırı faturanın maddesinden gelir (yukarıda değil, aşağıda invoices döngüsünde).
    if (row.source === "invoice" && (row.kind === "debt" || row.kind === "credit")) continue;
    if (row.source === "stock") {
      if (row.kind === "debt") post(id, row.date, "Stok (veresiye satış)", row.note, control, "600", row.amount);
      else post(id, row.date, row.moveReason === "return" ? "Stok (satış iadesi)" : "Stok (açık hesap alım)", row.note, row.moveReason === "return" ? "610" : "153", control, row.amount);
      continue;
    }
    if (row.kind === "debt") post(id, row.date, "Cari (borç yaz)", row.note, control, opening(row.note) ? "500" : "602", row.amount);
    else if (row.kind === "credit") post(id, row.date, "Cari (alacak yaz)", row.note, opening(row.note) ? "500" : "770", control, row.amount);
    else if (row.kind === "in") post(id, row.date, "Cari tahsilat", row.note, moneyOf(row), control, row.amount);
    else if (row.kind === "out") post(id, row.date, "Cari ödeme", row.note, control, moneyOf(row), row.amount);
  }
  for (const plan of rows.plans || []) {
    party = plan.party || (plan.accountType ? "" : `plan:${plan.id}`);
    const control = plan.accountType ? CONTROL[plan.accountType] || CONTROL.customer : "127";
    // Mevcut borcu taksitlendiren kart ana deftere yeni alacak getirmez (borç caride zaten yazılı).
    if (!plan.coversBalance) post(`plan:${plan.id}`, plan.date, "Taksit kartı", "Taksitli satış / hizmet", control, "602", plan.total);
    if (plan.status === "closed") post(`plan-close:${plan.id}`, plan.closedOn && plan.closedOn > plan.date ? plan.closedOn : plan.date, "Taksit kartı kapatıldı", "Kalan alacaktan vazgeçildi", "689", control, Math.max(0, roundMoney((Number(plan.total) || 0) - (Number(plan.paid) || 0))));
  }
  for (const row of rows.planEntries || []) {
    party = row.party || (row.accountType ? "" : `plan:${row.planId}`);
    const control = row.accountType ? CONTROL[row.accountType] || CONTROL.customer : "127";
    const id = `plan-entry:${row.id}`;
    if (row.kind === "in") {
      const debit = row.opening ? "500" : row.chequeId ? "101" : moneyOf(row);
      post(id, row.date, row.opening ? "Taksit açılışı (devir)" : row.chequeId ? "Taksit (çek/senetle)" : "Taksit tahsilatı", row.note, debit, control, row.amount);
    } else post(id, row.date, "Taksit iadesi", row.note, control, moneyOf(row), row.amount);
  }
  party = "";
  for (const row of rows.stockMoves || []) {
    const id = `stock:${row.id}`;
    if (row.kind === "out") post(id, row.date, "Stok (peşin satış)", row.note, moneyOf(row), "600", row.amount);
    else if (row.reason === "return") post(id, row.date, "Stok (peşin satış iadesi)", row.note, "610", moneyOf(row), row.amount);
    else post(id, row.date, "Stok (peşin alım)", row.note, "153", moneyOf(row), row.amount);
  }
  // Çok satırlı madde (kuruş). Borç ve alacak toplamı eşit değilse madde yine yazılır; mizan "dengesiz" der (kapı yakalar).
  const postLines = (id, date, source, text, lines) => {
    const kept = lines.filter(line => line.amount > 0).map(line => {
      const out = { account: line.account, debit: line.side === "debit" ? line.amount : 0, credit: line.side === "credit" ? line.amount : 0 };
      return PARTY_ACCOUNTS.has(line.account) && party ? { ...out, party } : out;
    });
    if (kept.length) out.push({ id, date, source, text, lines: kept });
  };
  for (const row of rows.invoices || []) {
    party = row.party || "";
    const control = CONTROL[row.accountType] || CONTROL.customer;
    let groups = [];
    try {
      groups = JSON.parse(row.glJson || "[]");
    } catch {
      groups = [];
    }
    const nets = (Array.isArray(groups) ? groups : []).map(group => ({ account: String(group.account || "600"), amount: Math.round(Number(group.net) || 0) }));
    const vat = cents(row.tryVat);
    const withheld = cents(row.tryWithheld);
    const stoppage = cents(row.tryStoppage);
    const payable = cents(row.tryPayable);
    const label = `${row.number || "Taslak"}`;
    if (row.kind === "sale" || row.kind === "smm") {
      postLines(`invoice:${row.id}`, row.date, row.kind === "smm" ? "Serbest meslek makbuzu" : "Satış faturası", label, [
        { account: control, side: "debit", amount: payable },
        { account: "193", side: "debit", amount: stoppage },
        ...nets.map(net => ({ ...net, side: "credit" })),
        { account: "391", side: "credit", amount: vat - withheld },
      ]);
    } else if (row.kind === "sale_return") {
      postLines(`invoice:${row.id}`, row.date, "Satıştan iade faturası", label, [
        ...nets.map(net => ({ ...net, side: "debit" })),
        { account: "391", side: "debit", amount: vat - withheld },
        { account: control, side: "credit", amount: payable },
      ]);
    } else if (row.kind === "purchase") {
      postLines(`invoice:${row.id}`, row.date, "Alış faturası", label, [
        ...nets.map(net => ({ ...net, side: "debit" })),
        { account: "191", side: "debit", amount: vat },
        { account: "360", side: "credit", amount: withheld + stoppage },
        { account: control, side: "credit", amount: payable },
      ]);
    } else if (row.kind === "purchase_return") {
      postLines(`invoice:${row.id}`, row.date, "Alıştan iade faturası", label, [
        { account: control, side: "debit", amount: payable },
        { account: "360", side: "debit", amount: withheld + stoppage },
        ...nets.map(net => ({ ...net, side: "credit" })),
        { account: "191", side: "credit", amount: vat },
      ]);
    }
  }
  party = "";
  for (const row of rows.chequeEvents || []) {
    const id = `cheque:${row.id}`;
    if (row.kind === "collect") post(id, row.date, "Çek / senet tahsili", row.note, moneyOf(row), "101", row.amount);
    else post(id, row.date, "Çek / senet ödemesi", row.note, "103", moneyOf(row), row.amount);
  }
  // Banka Fişi (v2.1.0, §3.11/3): her işlem başlığının satırları tek madde; THP kodu ve alt hesap yazım anında saklanmıştır, kuruş doğrudan.
  const fis = new Map();
  for (const row of rows.bankLines || []) {
    if (!fis.has(row.eventId)) fis.set(row.eventId, { date: row.date, text: row.description || row.no || "Banka fişi", lines: [] });
    fis.get(row.eventId).lines.push(row);
  }
  for (const [eventId, item] of fis) {
    const lines = item.lines
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .filter(line => Number(line.tryMinor) > 0)
      .map(line => ({ account: String(line.gl), debit: line.side === "D" ? Number(line.tryMinor) : 0, credit: line.side === "C" ? Number(line.tryMinor) : 0, ...(line.sub ? { sub: String(line.sub) } : {}) }));
    if (lines.length) out.push({ id: `bank:${eventId}`, date: item.date, source: "Banka fişi", text: item.text, lines });
  }
  out.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  return out;
}

/** Alt hesap bakiyeleri (v2.1.0, §3.11): alt hesap kodu (102.01, 108.00 …) → kuruş (borç artı). Σ alt hesap = ana hesap. */
export function subBalances(entries) {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (line.sub) out.set(line.sub, (out.get(line.sub) || 0) + line.debit - line.credit);
  return out;
}

/** Alt Hesap Mizanı (v2.1.0; rapor ekranı Aşama 3): alt hesap başına devir, dönem borç/alacak ve bakiye (TL). names: alt hesap → ad. */
export function subTrial(entries, { from = "", to = "", names = {} } = {}) {
  const subs = new Map();
  for (const entry of entries) {
    if (to && entry.date > to) continue;
    const before = from && entry.date < from;
    for (const line of entry.lines) {
      if (!line.sub) continue;
      const row = subs.get(line.sub) || { sub: line.sub, account: line.account, opening: 0, debit: 0, credit: 0 };
      if (before) row.opening += line.debit - line.credit;
      else {
        row.debit += line.debit;
        row.credit += line.credit;
      }
      subs.set(line.sub, row);
    }
  }
  const tl = value => roundMoney(value / 100);
  return [...subs.values()]
    .sort((a, b) => a.sub.localeCompare(b.sub))
    .map(row => ({ sub: row.sub, account: row.account, name: names[row.sub] || UNASSIGNED_SUBS[row.sub] || "", opening: tl(row.opening), debit: tl(row.debit), credit: tl(row.credit), balance: tl(row.opening + row.debit - row.credit) }));
}

/** Cari (ve carisiz kart) bazında kontrol hesabı bakiyeleri: party → kuruş (borç artı). */
export function partyBalances(entries) {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (line.party) out.set(line.party, (out.get(line.party) || 0) + line.debit - line.credit);
  return out;
}

/** Hesap bazında mizan (kuruş tamsayısıyla toplanır; yuvarlama birikmez). */
export function trialBalance(entries, { from = "", to = "" } = {}) {
  const accounts = new Map();
  let debit = 0;
  let credit = 0;
  let unbalanced = 0;
  for (const entry of entries) {
    if (to && entry.date > to) continue;
    const before = from && entry.date < from;
    let own = 0;
    for (const line of entry.lines) {
      own += line.debit - line.credit;
      const row = accounts.get(line.account) || { code: line.account, name: CHART[line.account] || line.account, opening: 0, debit: 0, credit: 0 };
      if (before) row.opening += line.debit - line.credit;
      else {
        row.debit += line.debit;
        row.credit += line.credit;
        debit += line.debit;
        credit += line.credit;
      }
      accounts.set(line.account, row);
    }
    if (own !== 0) unbalanced += 1;
  }
  const rows = [...accounts.values()].sort((a, b) => a.code.localeCompare(b.code)).map(row => ({ ...row, balance: row.opening + row.debit - row.credit }));
  const tl = value => roundMoney(value / 100);
  return {
    accounts: rows.map(row => ({ code: row.code, name: row.name, opening: tl(row.opening), debit: tl(row.debit), credit: tl(row.credit), balance: tl(row.balance) })),
    totals: { debit: tl(debit), credit: tl(credit), difference: tl(debit - credit) },
    balanced: debit === credit && unbalanced === 0,
    unbalanced,
  };
}

/**
 * Mutabakat kapısı: ana defter bakiyesi = alt defterin kendi hesabı. expected: { code: tutar } (borç bakiyesi artı).
 * Kuruş farkı bile raporlanır.
 */
export function reconcile(trial, expected) {
  const balanceOf = code => trial.accounts.find(row => row.code === code)?.balance || 0;
  const checks = Object.entries(expected).map(([code, want]) => {
    const got = balanceOf(code);
    const difference = roundMoney(got - (Number(want) || 0));
    return { code, name: CHART[code] || code, ledger: got, subledger: roundMoney(Number(want) || 0), difference, ok: Math.abs(difference) < 0.005 };
  });
  return { ok: trial.balanced && checks.every(check => check.ok), balanced: trial.balanced, checks };
}
