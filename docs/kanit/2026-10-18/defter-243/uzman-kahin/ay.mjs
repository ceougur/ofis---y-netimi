// Bir küçük ticari işletmenin Eylül 2026'sı — API ile (programın kendi uçları), sahte saat 30.09.2026 17:00, sahte EDM.
// Çıktı: ay-sonuc.json (her adımın kimliği/yanıtı), veri: ../uzman-mm-243-veri/ay
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { S, boot, mock } from "./ortak.mjs";

const OUT = path.join(S, "defter-243-uzman-kahin");
const dataDir = path.join(S, "defter-243-uzman-kahin", "veri");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
const edm = await mock.startMockEdm();
const { server, call, must, log } = await boot({ dataDir, now: "2026-09-30T17:00:00+03:00" });
const R = {};
const step = async (key, label, method, url, body) => {
  const r = await call(label, method, url, body);
  R[key] = { status: r.status, data: r.data };
  return r;
};
try {
  await must("kurulum", "POST", "/api/workspace/bank/setup/dismiss", {});
  await must("ayar", "PUT", "/api/workspace/invoices/settings", {
    seller: { name: "Örnek Ticaret Ltd. Şti.", taxNo: mock.OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@ornek.com.tr" },
    efatura: true, earsiv: true,
    integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@ornek.com.tr" },
  });
  // ---- Cariler
  const acc = async (key, body) => (R[key] = await must(key, "POST", "/api/workspace/accounts", { registeredOn: "2026-09-01", ...body })).id;
  const M1 = await acc("M1", { name: "Alfa Ticaret A.Ş.", type: "customer", taxNo: mock.BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  const M2 = await acc("M2", { name: "Ahmet Yılmaz", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", address: "Kızılay Sk. 3", district: "Çankaya", city: "Ankara" });
  const M3 = await acc("M3", { name: "Beta Yapı Ltd. Şti.", type: "customer", taxNo: mock.vkn(111222333), taxOffice: "Ulus", address: "Ulus Cd. 5", district: "Altındağ", city: "Ankara" });
  const T1 = await acc("T1", { name: "Tedarik Toptan A.Ş.", type: "supplier", taxNo: mock.SUPPLIER_VKN, taxOffice: "Ostim", address: "Ostim OSB", district: "Yenimahalle", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@tedarik.com.tr" });
  const T2 = await acc("T2", { name: "Kırtasiye Ali Veli", type: "supplier", partyKind: "person", firstName: "Ali", familyName: "Veli", taxNo: "10000000078", taxOffice: "Kızılbey", address: "Sakarya Cd. 1", district: "Çankaya", city: "Ankara" });
  const T3 = await acc("T3", { name: "Pırıl Temizlik Ltd. Şti.", type: "supplier", taxNo: mock.vkn(444555666), taxOffice: "Maltepe", address: "Maltepe Cd. 2", district: "Çankaya", city: "Ankara" });
  const T4 = await acc("T4", { name: "Mehmet Kiraya Veren", type: "supplier", partyKind: "person", firstName: "Mehmet", familyName: "Kiraya Veren", taxNo: "10000000214", address: "Bahçeli 7. Cd.", district: "Çankaya", city: "Ankara" });
  // ---- Stok
  const item = async (key, body) => (R[key] = await must(key, "POST", "/api/workspace/stock", body)).id;
  const P1 = await item("P1", { name: "Defter A4", unit: "Adet", code: "P1", unitPrice: "50", salePrice: "100", vatRate: "20", openingQty: "100", openingDate: "2026-09-01" });
  const P2 = await item("P2", { name: "Un", unit: "Kg", code: "P2", unitPrice: "8", salePrice: "10", vatRate: "1" });
  const P3 = await item("P3", { name: "Gıda Kolisi", unit: "Adet", code: "P3", unitPrice: "20", salePrice: "30", vatRate: "10" });
  // ---- Açılışlar (01.09)
  await step("kasaAcilis", "kasa açılış", "POST", "/api/workspace/cash/opening", { amount: "10000", date: "2026-09-01" });
  R.bank = await must("banka", "POST", "/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: "TR330006100519786457841326", opening: { date: "2026-09-01", amount: "50000", confirmed: true } });
  const B = R.bank.id || R.bank.account?.id;
  R.card = await must("kart", "POST", "/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", currency: "TRY", creditLimit: "50000", opening: { date: "2026-09-01", amount: "0", confirmed: true } });
  const K = R.card.id || R.card.account?.id;
  await must("pos bayrak", "PUT", `/api/workspace/bank/accounts/${B}`, { usePos: true, useCheque: true, useNote: true });
  R.pos = await must("pos", "POST", "/api/workspace/bank/pos", { name: "Ziraat POS", bankAccountId: B, providerKind: "bank", tax: "bsmv_incl", valorRule: "same_day", valorDays: 0, installmentPayout: "monthly", refundCommission: "none", provisionDays: 0, validFrom: "2026-09-01", rates: [{ installments: 1, rate: "2,5" }] });
  const POS = R.pos.id || R.pos.pos?.id;
  await step("M1acilis", "M1 açılış borç", "POST", `/api/workspace/accounts/${M1}/entries`, { kind: "debt", amount: "5000", note: "Açılış bakiyesi", date: "2026-09-01" });
  await step("T1acilis", "T1 açılış alacak", "POST", `/api/workspace/accounts/${T1}/entries`, { kind: "credit", amount: "8000", note: "Açılış bakiyesi", date: "2026-09-01" });
  // ---- Faturalar
  const inv = (key, body) => step(key, key, "POST", "/api/workspace/invoices", body);
  // 1 Alış (e-Fatura, 16 haneli no), 3 KDV oranı, açık
  await inv("F1_alis", { kind: "purchase", accountId: T1, issueDate: "2026-09-02", number: "TDK2026000000101", profile: "TEMELFATURA", lines: [
    { itemId: P1, name: "Defter A4", qty: 200, unitPrice: 50, vatRate: 20, goods: true },
    { itemId: P2, name: "Un", qty: 500, unitPrice: 8, vatRate: 1, goods: true },
    { itemId: P3, name: "Gıda Kolisi", qty: 100, unitPrice: 20, vatRate: 10, goods: true },
  ], payment: { rest: "open" } });
  // 2 Gider alışı — kâğıt fatura (seri-sıra "A 004512"), peşin nakit
  await inv("F2_gider_kagit", { kind: "purchase", scenario: "expense_purchase", accountId: T2, issueDate: "2026-09-03", number: "A 004512", profile: "KAGIT", lines: [{ name: "Kırtasiye Malzemesi", qty: 1, unitPrice: 1000, vatRate: 20, expenseCode: "office" }], payment: { cash: [{ amount: 1200, method: "cash" }] } });
  // 3 Tevkifatlı hizmet alışı (612 temizlik 9/10), açık
  await inv("F3_tevkifat_alis", { kind: "purchase", scenario: "expense_purchase", accountId: T3, issueDate: "2026-09-04", number: "PRL2026000000033", profile: "TEMELFATURA", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } });
  // 4 Satış e-Fatura M1: kalem iskontolu %20 + %10, açık
  await inv("F4_satis_efatura", { kind: "sale", accountId: M1, issueDate: "2026-09-05", lines: [
    { itemId: P1, name: "Defter A4", qty: 30, unitPrice: 100, discountRate: 10, vatRate: 20, goods: true },
    { itemId: P3, name: "Gıda Kolisi", qty: 20, unitPrice: 30, vatRate: 10, goods: true },
  ], payment: { rest: "open" } });
  // 5 Satış e-Arşiv M2: KDV dahil, %1 + %20, peşin nakit
  await inv("F5_satis_earsiv", { kind: "sale", accountId: M2, issueDate: "2026-09-06", pricesIncludeVat: true, lines: [
    { itemId: P2, name: "Un", qty: 100, unitPrice: 10.1, vatRate: 1, goods: true },
    { itemId: P1, name: "Defter A4", qty: 5, unitPrice: 120, vatRate: 20, goods: true },
  ], payment: { cash: [{ amount: 1610, method: "cash" }] } });
  // 6 Tevkifatlı satış M1 (624 yük taşıma 2/10), açık
  await inv("F6_satis_tevkifat", { kind: "sale", scenario: "service_sale", accountId: M1, issueDate: "2026-09-07", lines: [{ name: "Nakliye Hizmeti", qty: 1, unitPrice: 5000, vatRate: 20, withholdingCode: "624" }], payment: { rest: "open" } });
  // 7 Satış e-Arşiv M3 (mükellef değil, VKN), hizmet, açık
  await inv("F7_satis_m3", { kind: "sale", scenario: "service_sale", accountId: M3, issueDate: "2026-09-07", lines: [{ name: "Montaj Hizmeti", qty: 1, unitPrice: 2500, vatRate: 20 }], payment: { rest: "open" } });

  const L = key => R[key].data.lines.map(l => l.id);
  // 8 Satıştan iade (M1'in iade faturası; çok kalemli kısmi): F4'ten P1 10 adet + P3 5 adet
  await inv("F8_satis_iade", { kind: "sale_return", originalId: R.F4_satis_efatura.data.id, accountId: M1, issueDate: "2026-09-08", number: "ALF2026000000007", profile: "TEMELFATURA", lines: [{ originLineId: L("F4_satis_efatura")[0], qty: 10 }, { originLineId: L("F4_satis_efatura")[1], qty: 5 }], payment: {} });
  // 9 Alıştan iade (e-Fatura, asıl 16 haneli): F1'den P2 50 Kg + P3 10 adet
  await inv("F9_alis_iade", { kind: "purchase_return", originalId: R.F1_alis.data.id, accountId: T1, issueDate: "2026-09-09", lines: [{ originLineId: L("F1_alis")[1], qty: 50 }, { originLineId: L("F1_alis")[2], qty: 10 }], payment: {} });
  // 10 Alıştan iade — asıl kâğıt fatura "A 004512" (e-Arşiv iade): ÖZEL SORU
  await inv("F10_kagit_asil_iade", { kind: "purchase_return", originalId: R.F2_gider_kagit.data.id, accountId: T2, issueDate: "2026-09-10", lines: [{ originLineId: L("F2_gider_kagit")[0], qty: 0.1 }], payment: {} });
  // 11 Fatura iptali: e-Arşiv satış M2 kesilip iptal
  await inv("F11_iptal_edilecek", { kind: "sale", accountId: M2, issueDate: "2026-09-11", pricesIncludeVat: true, lines: [{ itemId: P1, name: "Defter A4", qty: 2, unitPrice: 120, vatRate: 20, goods: true }], payment: { rest: "open" } });
  if (R.F11_iptal_edilecek.status === 200) await step("F11_iptal", "iptal", "POST", `/api/workspace/invoices/${R.F11_iptal_edilecek.data.id}/cancel`, { reason: "Müşteri vazgeçti" });
  // 12 Kira (şahıs, KDV yok, %20 stopaj), açık
  await inv("F12_kira", { kind: "purchase", scenario: "expense_purchase", accountId: T4, issueDate: "2026-09-01", number: "KIRA-09", profile: "KAGIT", stoppageRate: 20, lines: [{ name: "Eylül Kirası", qty: 1, unitPrice: 10000, vatRate: 0, exemptionCode: "351", expenseCode: "rent" }], payment: { rest: "open" } });
  // ---- Tahsilat / ödeme
  const ent = (key, id, body) => step(key, key, "POST", `/api/workspace/accounts/${id}/entries`, body);
  await ent("tah_nakit", M1, { kind: "in", amount: "2000", method: "cash", note: "Tahsilat nakit", date: "2026-09-12" });
  await ent("tah_havale", M1, { kind: "in", amount: "3000", method: "bank", bankAccountId: B, note: "Tahsilat havale", date: "2026-09-13", similarOk: true });
  await ent("tah_pos", M1, { kind: "in", amount: "1000", method: "card", posId: POS, installments: 1, note: "Tahsilat POS", date: "2026-09-14", similarOk: true });
  await ent("od_kart", T1, { kind: "out", amount: "1500", method: "card", bankAccountId: K, note: "Ödeme kredi kartı", date: "2026-09-15", similarOk: true });
  await ent("od_havale", T1, { kind: "out", amount: "5000", method: "bank", bankAccountId: B, note: "Ödeme havale", date: "2026-09-15", similarOk: true });
  await ent("od_kira", T4, { kind: "out", amount: "8000", method: "bank", bankAccountId: B, note: "Kira ödemesi", date: "2026-09-15", similarOk: true });
  // ---- Çek / senet
  const chq = (key, body) => step(key, key, "POST", "/api/workspace/cheques", body);
  await chq("cek_m1", { direction: "in", instrument: "cheque", serialNo: "C-1001", bank: "Akbank", drawer: "Alfa Ticaret A.Ş.", accountId: M1, amount: "4000", issueDate: "2026-09-16", dueDate: "2026-10-15" });
  await chq("senet_m1", { direction: "in", instrument: "note", serialNo: "S-1", bank: "", drawer: "Alfa Ticaret A.Ş.", accountId: M1, amount: "2000", issueDate: "2026-09-16", dueDate: "2026-11-30" });
  const act = (key, id, body) => step(key, key, "POST", `/api/workspace/cheques/${id}/actions`, body);
  await act("ciro", R.cek_m1.data.id, { action: "endorse", accountId: T1, date: "2026-09-17" });
  await chq("cek_m3", { direction: "in", instrument: "cheque", serialNo: "C-2002", bank: "Halkbank", drawer: "Beta Yapı", accountId: M3, amount: "3000", issueDate: "2026-09-18", dueDate: "2026-09-24" });
  await act("tahsile_ver", R.cek_m3.data.id, { action: "bank-deposit", bankAccountId: B, date: "2026-09-19" });
  await act("karsiliksiz", R.cek_m3.data.id, { action: "bounce", date: "2026-09-25" });
  await chq("cek_verilen", { direction: "out", instrument: "cheque", serialNo: "K-501", bank: "Ziraat Bankası", drawer: "Örnek Ticaret", accountId: T1, amount: "2000", issueDate: "2026-09-18", dueDate: "2026-10-20", bankAccountId: B });
  // ---- Şüpheli alacak (M3 karşılıksız çek 3.000) + karşılık
  await step("supheli", "şüpheli al", "POST", `/api/workspace/accounts/${M3}/doubtful`, { amount: "3000", date: "2026-09-26", reason: "cheque", chequeId: R.cek_m3.data.id, note: "Karşılıksız çek" });
  const DID = R.supheli.data?.record?.id || R.supheli.data?.id;
  if (DID) await step("karsilik", "karşılık", "POST", `/api/workspace/accounts/${M3}/doubtful/${DID}/provision`, { amount: "3000", date: "2026-09-29", note: "Karşılık" });
  // ---- Banka fişleri
  const vou = (key, body) => step(key, key, "POST", "/api/workspace/bank/vouchers", { accountId: B, similarOk: true, ...body });
  await vou("masraf", { type: "fee", date: "2026-09-20", amount: "52,50", tax: "bsmv_incl", taxRate: "5", description: "Hesap işletim ücreti" });
  await vou("faiz_gelir", { type: "interest_in", date: "2026-09-30", amount: "1000", stoppageRate: "15", description: "Vadeli faiz" });
  await vou("faiz_gider", { type: "interest_out", date: "2026-09-30", amount: "200", taxAmount: "10", description: "KMH faizi" });
  // ---- Kasa → Banka virman, Kasa gideri
  await step("virman", "virman", "POST", "/api/workspace/cash/transfer", { direction: "to-bank", amount: "5000", date: "2026-09-21", bankAccountId: B, description: "Kasadan bankaya" });
  await step("kasa_gider", "kasa gider", "POST", "/api/workspace/cash", { kind: "out", amount: "300", method: "cash", description: "Çay ocağı", date: "2026-09-22" });
  // ---- Taksitli satış (e-Arşiv M2, 3 taksit) + ilk taksit tahsili
  await inv("F13_taksitli", { kind: "sale", accountId: M2, issueDate: "2026-09-23", pricesIncludeVat: true, lines: [{ itemId: P1, name: "Defter A4", qty: 10, unitPrice: 120, vatRate: 20, goods: true }], payment: { rest: "installments", installments: { count: 3, firstDue: "2026-09-30", everyMonths: 1 } } });
  const PLAN = R.F13_taksitli.data?.plan?.id || R.F13_taksitli.data?.planId;
  if (PLAN) await step("taksit1", "taksit 1", "POST", `/api/workspace/plans/${PLAN}/entries`, { kind: "in", amount: "400", method: "cash", date: "2026-09-30" });
  // ---- Eksi stok: P2 elde 350 Kg, 400 Kg satış (izin ver), havale
  await inv("F14_eksi_stok", { kind: "sale", accountId: M2, issueDate: "2026-09-24", lines: [{ itemId: P2, name: "Un", qty: 400, unitPrice: 10, vatRate: 1, goods: true }], payment: { cash: [{ amount: 4040, method: "bank", bankAccountId: B }] }, force: true });
  writeFileSync(path.join(OUT, "ay-sonuc-1.json"), JSON.stringify({ R, ids: { M1, M2, M3, T1, T2, T3, T4, P1, P2, P3, B, K, POS, PLAN } }, null, 1));
  // Faturaların dönüş biçimini görmek için
  for (const key of Object.keys(R).filter(k => /^F\d/.test(k))) {
    const d = R[key].data || {};
    console.log(key, R[key].status, d.number, d.profile, d.typeCode, "net", d.tryNet, "kdv", d.tryVat, "tevk", d.tryWithheld, "öd", d.tryPayable, d.error || "");
  }
} finally {
  writeFileSync(path.join(OUT, "ay-log-1.json"), JSON.stringify(log, null, 1));
  await server.app.close();
  await edm.close();
}
