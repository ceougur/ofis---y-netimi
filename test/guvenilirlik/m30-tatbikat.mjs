// 2.4.4 madde 30: göçten SONRA 2.4.4'te çalışma + YEDEK TATBİKATI (programın kendi Yedekle / Geri Yükle uçlarıyla) + eski (2.4.3) yedeğin 2.4.4'e geri
// yüklenmesi + 002 geri yüklemesinin 001'e etkisi. Veri: göç adımının klasörünün kopyası (kok/goc → kok/tatbikat). Saat sahte (ders 13): üretimin son
// günü 18:00'den akar; olgular karşılaştırılırken o günün 17:00'sinde dondurulur (göç ölçüsüyle aynı an).
//
// Denetimler (her biri { ad, ok, ayrıntı }):
//   C1  bırakılan e-Arşiv'in Müşteri Fişi numarası = 1 + eski veride VERİLMİŞ en büyük fiş numarası; ikinci bırakma bir sonraki (yeniden verilmez)
//   C2  e-SMM makbuzu "Kâğıt Makbuz Olarak Bırak" → SMM numarası = 1 + eski veride verilmiş en büyük SMM numarası
//   C3  e-Arşiv Kes ve Gönder / e-SMM Kes ve Gönder / e-Fatura sahte EDM'ye gider (ihlal yok); numaralar seride tekil
//   C4  2.4.4'te verilen hiçbir kâğıt/fiş/SMM numarası eski veride verilmiş bir numarayla aynı değil
//   C5  çalışmadan sonra Mutabakat Testi'nde yeni sapma yok, mizan dengede, cari/Kasa toplamları kendi girdiğimiz hareket kadar değişir
//   C6  yedek → çalış → geri yükle: olgular yedek anıyla aynı (cari, mizan, Kasa, banka, çek, fatura, taksit, stok, numaralar, raporlar)
//   C7  bir şirketin geri yüklenmesi öbür şirketin olgularını değiştirmez
//   C8  geri yüklemeden sonra yeniden çalış: numaralar yedek anının sırasından sürer, veri içinde tekrar yok; ara dönemde EDM'ye gitmiş numara (geri yüklemeyle
//       veriden düşen) yeniden verilirse ne olur (gözlem)
//   C9  2.4.3'ün kendi Yedekle ucuyla aldığı son yedek 2.4.4'e geri yüklenir: göç geri yüklemede koşar (şema 32, numara tabanı), olgular göç ölçüsüyle aynı
// Aday 9 (kararların metninden; 2.4.4 kodundan türetilmedi):
//   C10 30b: göçte (geri yükleme yok) Fatura'da geri yükleme uyarısı YOK; geri yüklemeden sonra yalnız geri yüklenen şirkette VAR (yedek anı); kapatılınca gider
//   C2b bırakılan kâğıt makbuz sonradan e-SMM olarak GÖNDERİLEMEZ (kalıcı engel): istek reddedilir, kart ve EDM değişmez
//   C11 E6: 2.4.3'te silinip Silinenler'de duran belge — numarası canlı başka belgedeyse geri yükleme reddedilir (409) ve Silinenler'de kalır; numarası boştaysa
//       kendi numarasıyla döner; sıradaki numara verilmiş en büyükten (silinenler dahil) sonra kalır
import { BUYER_VKN } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { companyFacts, fileFacts } from "./m30-olgular.mjs";
import { scoped, sendAll } from "./m30-uretici.mjs";
import { companyDbFile, readRegistry } from "./uretici.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PROGRAM = /^([A-Z0-9]{3})(\d{4})(\d{9})$/;
/** Karşılaştırılan (zamana bağlı olmayan) olgu bölümleri. */
export function stable(f) {
  // İşlem Geçmişi (denetim kaydı) ortak katmandadır: yedek alma / geri yükleme işlemi kendi kaydını yazar — ayrıca sayılır (auditCount), karşılaştırmaya girmez.
  const reports = Object.fromEntries(Object.entries(f.reports || {}).filter(([id]) => id !== "islem-gecmisi").map(([id, r]) => [id, { title: r.title, total: r.total, footer: r.footer, summary: r.summary, rowsDigest: r.rowsDigest }]));
  const tableReports = Object.fromEntries(Object.entries(f.tableReports || {}).map(([id, r]) => [id, r?.report?.totals ?? r]));
  return { accounts: f.accounts, trial: f.trial, trialTotals: f.trialTotals, reconciliation: f.reconciliation, integrity: f.integrity.failures, lockedUntil: f.lockedUntil, cash: f.cash, bank: f.bank, cheques: f.cheques, invoices: f.invoices, pending: f.pending, nextNumbers: f.nextNumbers, plans: f.plans, planTotals: f.planTotals, stock: f.stock, vatOffsets: f.vatOffsets, edocCards: f.edocCards, reports, tableReports };
}
export function stableDiff(x, y) {
  const a = stable(x);
  const b = stable(y);
  return Object.keys(a).filter(key => !same(a[key], b[key])).map(key => {
    if (a[key] && typeof a[key] === "object" && !Array.isArray(a[key])) {
      const keys = [...new Set([...Object.keys(a[key]), ...Object.keys(b[key] || {})])].filter(k => !same(a[key][k], b[key]?.[k]));
      return { section: key, count: keys.length, first: keys.slice(0, 3).map(k => [k, a[key][k], b[key]?.[k]]) };
    }
    return { section: key, before: a[key], after: b[key] };
  });
}

/**
 * dir: veri kökü (data/, backups/); day: üretimin son günü; maps: { kod: oldDataMap } (göçten önceki dosya); baseline: göç ölçüsü (guncel-goc);
 * oldBackups: üretimde 2.4.3'ün aldığı yedekler (manifest.backups); bootCurrent(clock): 2.4.4'ü açar; edm: sahte EDM.
 */
export async function runDrill({ dir, day, maps, baseline, oldBackups, bootCurrent, clock, edm, log = () => {} }) {
  const checks = [];
  const check = (name, ok, detail = {}) => {
    checks.push({ name, ok: Boolean(ok), detail });
    log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 600)}`}`);
    return Boolean(ok);
  };
  const at = (hour, minute = 0) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), hour, minute, 0);
  const freezeMeasure = () => clock.freeze(at(17));
  const work = () => {
    clock.resume();
    clock.set(at(18));
  };
  let server = await bootCurrent();
  let api = await server.login();
  const companies = (await api.get("/api/companies")).data.all.map(c => ({ id: c.id, code: c.code, name: c.name }));
  const must = async (what, promise) => {
    const res = await promise;
    if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
    return res.data;
  };
  const restart = async () => {
    await server.close();
    server = await bootCurrent();
    api = await server.login();
  };
  const factsOf = async company => {
    freezeMeasure();
    try {
      return await companyFacts(scoped(api, company.id));
    } finally {
      clock.resume();
      clock.set(at(18, 30));
    }
  };
  const givenNumbers = new Set(); // 2.4.4'te verilen kâğıt / fiş / SMM numaraları
  const givenBy = new Map(); // numara → şirket kodu
  const oldGiven = code => maps[code].given;
  const integrator = company => ({ env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: `urn:mail:defaultgb@${company.code === "001" ? "merkez" : "yildiz"}.com.tr` });
  const people = {};
  const noticeOf = async company => (await must("faturalar (uyarı)", scoped(api, company.id).get("/api/workspace/invoices?tab=all&limit=1"))).restoreNotice ?? null;
  const dismissNotice = async (company, notice) => must("uyarıyı kapat", scoped(api, company.id).post("/api/workspace/invoices/restore-notice/dismiss", { at: notice?.at || "" }));
  work();
  for (const company of companies) {
    const notice = await noticeOf(company);
    check(`C10 ${company.code} göçten sonra (geri yükleme yok) Fatura'da geri yükleme uyarısı yok (30b)`, notice === null, { notice });
  }

  // ---------- T1: göçten sonra 2.4.4'te çalışma ----------
  for (const company of companies) {
    const c = scoped(api, company.id);
    await must("entegratör (yeni sahte EDM adresi) + e-SMM kullanıcısı", c.put("/api/workspace/invoices/settings", { esmm: true, integrator: integrator(company) }));
    const list = await must("cariler", c.get("/api/workspace/accounts?status=all&limit=5000"));
    const persons = list.accounts.filter(a => a.partyKind === "person" && String(a.taxNo || "").length === 11);
    const buyer = list.accounts.find(a => a.taxNo === BUYER_VKN);
    people[company.code] = { person: persons[0].id, person2: persons[1].id, buyer: buyer?.id };
    // T0: 2.4.3'ten kalan Gönderilecekler (eski tarihli bekleyen e-Belge'ler) 2.4.4'ten Tümünü Gönder ile — GİB sıra kuralı: eskiden yeniye.
    const pendingBefore = await must("Gönderilecekler", c.get("/api/workspace/invoices?tab=pending&limit=1000"));
    const sendResults = pendingBefore.invoices.length ? await sendAll(c, must) : [];
    const turns = [{ ok: sendResults.filter(item => item.ok).length, failed: sendResults.filter(item => !item.ok).map(item => `${item.code || ""} ${String(item.message || "").slice(0, 120)}`).slice(0, 8) }];
    const pendingAfter = await must("Gönderilecekler", c.get("/api/workspace/invoices?tab=pending&limit=1000"));
    const sentNow = pendingBefore.invoices.map(d => d.id).filter(id => !pendingAfter.invoices.some(x => x.id === id));
    const cards = [];
    for (const id of sentNow) cards.push(await must("kart", c.get(`/api/workspace/invoices/${id}`)));
    const bySeries = new Map();
    for (const card of cards.filter(x => PROGRAM.test(x.number || ""))) {
      const key = card.number.slice(0, 7);
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key).push(card);
    }
    const orderBad = [];
    for (const list of bySeries.values()) {
      list.sort((x, y) => x.number.localeCompare(y.number));
      for (let i = 1; i < list.length; i += 1) if (list[i].issueDate < list[i - 1].issueDate) orderBad.push([list[i - 1].number, list[i - 1].issueDate, list[i].number, list[i].issueDate]);
    }
    // Gönderilmeyi beklemeyen (iptal edilmiş numarasız, e-Belge durumu "none") belge 2.4.3'te de Gönderilecekler'de görünür — gönderilmez, ayrıca sayılır.
    const notWaitingBefore = new Set(pendingBefore.invoices.filter(x => !(x.status === "issued" && x.eStatus === "waiting")).map(x => x.id));
    const cancelledPending = pendingAfter.invoices.map(x => `${x.id}:${x.status}/${x.eStatus}`);
    check(`C3 ${company.code} 2.4.3'ten kalan ${pendingBefore.invoices.length - notWaitingBefore.size} bekleyen e-Belge 2.4.4'ten Tümünü Gönder ile gitti; numara sırası = tarih sırası`, pendingAfter.invoices.every(x => notWaitingBefore.has(x.id)) && !orderBad.length && cards.every(x => ["sent", "accepted", "processing"].includes(x.eStatus)), { pendingBefore: pendingBefore.invoices.length, pendingAfter: pendingAfter.invoices.length, cancelledPending, turns, sent: cards.length, eStatus: cards.reduce((m, x) => ({ ...m, [x.eStatus]: (m[x.eStatus] || 0) + 1 }), {}), orderBad: orderBad.slice(0, 5), oldest: cards.map(x => x.issueDate).sort()[0] || null });
    const before = await factsOf(company);
    const sale = (accountId, eSend, extra = {}) => must(`satış ${eSend}`, c.post("/api/workspace/invoices", { scenario: "service_sale", accountId, issueDate: day, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend, ...extra }));
    const fis = oldGiven(company.code)[`FIS${day.slice(0, 4)}`] || 0;
    const smmMax = oldGiven(company.code)[`SMM${day.slice(0, 4)}`] || 0;
    // e-Arşiv Kes ve Gönder
    const sent = await sale(people[company.code].person, "now");
    const sentCard = await must("kart", c.get(`/api/workspace/invoices/${sent.id}`));
    // Kes, Sonra Gönder → Müşteri Fişi Olarak Bırak → gönder (fiş numarası seriden ayrılır) → yeni bırakma (bir sonraki numara)
    const a = await sale(people[company.code].person2, "later");
    const leftA = await must("bırak A", c.post(`/api/workspace/invoices/${a.id}/withdraw`, {}));
    const sentA = await must("bırakılanı gönder A", c.post(`/api/workspace/invoices/${a.id}/send`, {}));
    const b = await sale(people[company.code].person, "later");
    const leftB = await must("bırak B", c.post(`/api/workspace/invoices/${b.id}/withdraw`, {}));
    const expectA = `FIS${day.slice(0, 4)}${String(fis + 1).padStart(9, "0")}`;
    const expectB = `FIS${day.slice(0, 4)}${String(fis + 2).padStart(9, "0")}`;
    givenNumbers.add(leftA.number).add(leftB.number);
    givenBy.set(leftA.number, company.code).set(leftB.number, company.code);
    const cardA = await must("kart A", c.get(`/api/workspace/invoices/${a.id}`));
    check(`C1 ${company.code} bırakılan fiş numarası verilmiş en büyükten sonra (A ${expectA}, B ${expectB}); gönderilen A'nın fişi Kâğıt Fatura No'da`, leftA.number === expectA && leftB.number === expectB && cardA.paperNo === expectA, { leftA: leftA.number, leftB: leftB.number, givenMax: fis, aPaperNo: cardA.paperNo, aNumber: cardA.number, aEStatus: cardA.eStatus, sentA: Boolean(sentA) });
    // e-SMM: Kes ve Gönder; Kes, Sonra Gönder → Kâğıt Makbuz Olarak Bırak
    const makbuz = eSend => must(`e-SMM ${eSend}`, c.post("/api/workspace/invoices", { scenario: "smm", accountId: people[company.code].person, issueDate: day, lines: [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" }, eSend }));
    const esmmSent = await makbuz("now");
    const esmmCard = await must("e-SMM kartı", c.get(`/api/workspace/invoices/${esmmSent.id}`));
    const esmmLater = await makbuz("later");
    const paperSmm = await must("Kâğıt Makbuz Olarak Bırak", c.post(`/api/workspace/invoices/${esmmLater.id}/withdraw`, {}));
    const expectSmm = `SMM${day.slice(0, 4)}${String(smmMax + 1).padStart(9, "0")}`;
    givenNumbers.add(paperSmm.number);
    givenBy.set(paperSmm.number, company.code);
    check(`C2 ${company.code} e-SMM "Kâğıt Makbuz Olarak Bırak" SMM numarası verilmiş en büyükten sonra (${expectSmm})`, paperSmm.number === expectSmm, { got: paperSmm.number, givenMax: smmMax });
    const smmSentBefore = edm.state.smm.sent.length;
    const cardBefore = await must("bırakılan makbuz kartı", c.get(`/api/workspace/invoices/${esmmLater.id}`));
    const resend = await c.post(`/api/workspace/invoices/${esmmLater.id}/send`, {});
    const cardAfter = await must("bırakılan makbuz kartı (sonra)", c.get(`/api/workspace/invoices/${esmmLater.id}`));
    const pick = d => ({ number: d.number, paperNo: d.paperNo, profile: d.profile, eStatus: d.eStatus, status: d.status, canSend: d.canSend ?? null });
    check(`C2b ${company.code} bırakılan kâğıt makbuz e-SMM olarak gönderilemez (istek reddedilir; kart ve EDM değişmez)`, resend.status >= 400 && resend.status < 500 && same(pick(cardBefore), pick(cardAfter)) && edm.state.smm.sent.length === smmSentBefore && cardAfter.canSend !== true, { status: resend.status, message: String(resend.data?.error || resend.data?.message || "").slice(0, 200), before: pick(cardBefore), after: pick(cardAfter), smmSent: [smmSentBefore, edm.state.smm.sent.length] });
    // e-Fatura (Mükellef Sorgula ile işaretli alıcı)
    let efatura = null;
    if (people[company.code].buyer) {
      const doc = await sale(people[company.code].buyer, "now");
      efatura = await must("e-Fatura kartı", c.get(`/api/workspace/invoices/${doc.id}`));
    }
    check(`C3 ${company.code} e-Arşiv / e-SMM / e-Fatura gönderildi (sahte EDM)`, ["sent", "accepted", "processing"].includes(sentCard.eStatus) && esmmCard.profile === "ESMM" && ["sent", "accepted", "processing"].includes(esmmCard.eStatus) && (!efatura || ["sent", "accepted", "processing"].includes(efatura.eStatus)), { earsiv: [sentCard.number, sentCard.eStatus], esmm: [esmmCard.number, esmmCard.profile, esmmCard.eStatus], efatura: efatura && [efatura.number, efatura.eStatus], smmSent: edm.state.smm.sent.length, violations: [...edm.state.violations, ...(edm.state.smm.violations || [])] });
    // Para: UX18 ile yeniden açılan bir faturaya Kapatılacak Fatura'lı tahsilat; Kasa; Banka Fişi; POS.
    const reopened = Object.entries(baseline.companies[company.code].invoices).find(([id, d]) => d.open > 0 && d.kind === "sale" && !d.planId && maps[company.code].bounced.get(d.accountId));
    if (reopened) await must("Kapatılacak Fatura'lı tahsilat", c.post(`/api/workspace/accounts/${reopened[1].accountId}/entries`, { kind: "in", amount: "100", date: day, method: "cash", note: "Göç sonrası tahsilat", invoiceId: reopened[0] }));
    await must("Kasa giriş", c.post("/api/workspace/cash", { kind: "in", amount: "250", date: day, description: "Göç sonrası elden tahsilat" }));
    if (company.code === "001") await must("personel kartı", c.post("/api/workspace/staff", { fullName: "Deneme Personel", position: "Muhasebe", salary: "35.000", hireDate: day }));
    const after = await factsOf(company);
    const cashDelta = (after.cash.totals?.balance ?? 0) - (before.cash.totals?.balance ?? 0);
    const newFailures = after.integrity.failures.filter(f => !before.integrity.failures.includes(f));
    check(`C5 ${company.code} çalışmadan sonra Mutabakat Testi'nde yeni sapma yok, mizan dengede`, !newFailures.length && after.trialTotals.difference === 0, { newFailures, trialTotals: after.trialTotals, cashDelta });
    if (reopened) check(`C5 ${company.code} yeniden açılan faturaya 100 TL Kapatılacak Fatura'lı tahsilat açığı 100 TL azaltır`, before.invoices[reopened[0]].open - after.invoices[reopened[0]].open === 10000, { invoice: reopened[1].number, before: before.invoices[reopened[0]].open, after: after.invoices[reopened[0]].open });
  }
  // C4: 2.4.4'te verilen numaralar eski veride verilmiş numaralarla çakışmaz (sıra numarası eski en büyükten büyük).
  const clash = [...givenNumbers].filter(number => {
    const m = PROGRAM.exec(number || "");
    // numara hangi şirkette verildiyse onun eski en büyüğüyle karşılaştırılır (her iki şirkette de eski en büyükten büyük olmalı değil: kendi şirketi)
    return !m || !givenBy.has(number) || Number(m[3]) <= (oldGiven(givenBy.get(number))[`${m[1]}${m[2]}`] || 0);
  });
  check("C4 2.4.4'te verilen kâğıt/fiş/SMM numaraları biçimde ve eski verilmişlerle çakışmıyor", !clash.length && [...givenNumbers].every(Boolean), { given: [...givenNumbers] });

  // ---------- T2: yedek → çalış → geri yükle → sayılar → yeniden çalış ----------
  for (const company of [...companies].reverse()) {
    const c = { get: url => scoped(api, company.id).get(url), post: (url, body) => scoped(api, company.id).post(url, body), put: (url, body) => scoped(api, company.id).put(url, body) };
    const other = companies.find(x => x.id !== company.id);
    const backup = await must(`yedek ${company.code}`, api.post("/api/admin/backups", { scope: "one", companyId: company.id }));
    const moment = await factsOf(company);
    const otherBefore = await factsOf(other);
    // ara çalışma W2: e-Arşiv gönder, bırak, Kasa, tahsilat
    const w2 = await must("W2 e-Arşiv", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: people[company.code].person, issueDate: day, lines: [{ name: "Ara dönem", qty: 1, unitPrice: 777, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" }));
    const w2Card = await must("W2 kart", c.get(`/api/workspace/invoices/${w2.id}`));
    const w2b = await must("W2 bırakılacak", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: people[company.code].person2, issueDate: day, lines: [{ name: "Ara dönem", qty: 1, unitPrice: 555, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const w2left = await must("W2 bırak", c.post(`/api/workspace/invoices/${w2b.id}/withdraw`, {}));
    await must("W2 Kasa", c.post("/api/workspace/cash", { kind: "out", amount: "123,45", date: day, description: "Ara dönem gideri", cashForce: true }));
    const restoreRes = await must(`geri yükle ${company.code}`, api.post("/api/admin/backups/restore", { name: backup.name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }));
    if (restoreRes.staged) {
      await restart();
      check(`C6 ${company.code} geri yükleme (001: yeniden açılışta) uygulandı`, server.app.stagedRestore?.ok === true, { staged: server.app.stagedRestore });
    }
    const restored = await factsOf(company);
    const diff = stableDiff(moment, restored);
    check(`C6 ${company.code} yedek → çalış → geri yükle: olgular yedek anıyla aynı`, !diff.length, { diff, backup: backup.name });
    const notice = await noticeOf(company);
    const otherNotice = await noticeOf(other);
    check(`C10 ${company.code} geri yüklemeden sonra Fatura'da tek seferlik uyarı VAR (yalnız bu şirkette)`, Boolean(notice?.at) && otherNotice === null, { notice, otherNotice });
    const dismissed = await dismissNotice(company, notice);
    check(`C10 ${company.code} uyarı kapatılınca gider`, dismissed.dismissed === true && dismissed.restoreNotice === null && (await noticeOf(company)) === null, { dismissed });
    const otherAfter = await factsOf(other);
    const otherDiff = stableDiff(otherBefore, otherAfter);
    check(`C7 ${company.code} geri yüklemesi ${other.code}'i değiştirmedi`, !otherDiff.length, { diff: otherDiff });
    // W3: yeniden çalış
    const w3 = await must("W3 e-Arşiv", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: people[company.code].person, issueDate: day, lines: [{ name: "Geri yükleme sonrası", qty: 1, unitPrice: 999, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" }));
    const w3Card = await must("W3 kart", c.get(`/api/workspace/invoices/${w3.id}`));
    const w3b = await must("W3 bırakılacak", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: people[company.code].person2, issueDate: day, lines: [{ name: "Geri yükleme sonrası", qty: 1, unitPrice: 444, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const w3left = await must("W3 bırak", c.post(`/api/workspace/invoices/${w3b.id}/withdraw`, {}));
    const after = await factsOf(company);
    const nums = Object.values(after.invoices).flatMap(d => [d.number]).filter(n => PROGRAM.test(n || ""));
    const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
    check(`C8 ${company.code} geri yüklemeden sonra numaralar yedek anının sırasından sürer, veride tekrar yok`, !dup.length && w3left.number === moment.nextNumbers.paper && (w3Card.number === w2Card.number || w3Card.eStatus), { dup, w3Fis: w3left.number, momentNextPaper: moment.nextNumbers.paper, w2Fis: w2left.number });
    check(`C8 ${company.code} GÖZLEM: ara dönemde EDM'ye gitmiş e-Arşiv numarası (${w2Card.number}) geri yüklemeden sonra yeniden verildi mi`, true, { w2: [w2Card.number, w2Card.eStatus], w3: [w3Card.number, w3Card.eStatus, w3Card.eMessage || ""], reused: w2Card.number === w3Card.number, edmHasBoth: edm.state.sent.filter(s => s.id === w2Card.number).length });
  }

  // ---------- T3: 2.4.3'ün aldığı son yedek 2.4.4'e geri yüklenir ----------
  const order = [...companies].sort((x, y) => (x.code === "002" ? -1 : y.code === "002" ? 1 : 0));
  for (const company of order) {
    const other = companies.find(x => x.id !== company.id);
    const last = oldBackups.filter(b => b.companyId === company.id).at(-1);
    if (!last) {
      check(`C9 ${company.code} 2.4.3 yedeği bulunamadı`, false, {});
      continue;
    }
    const otherBefore = await factsOf(other);
    const res = await must(`2.4.3 yedeğini geri yükle ${company.code}`, api.post("/api/admin/backups/restore", { name: last.name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }));
    if (res.staged) await restart();
    const registry = readRegistry(`${dir}/data`);
    const file = fileFacts(companyDbFile(`${dir}/data`, registry.find(e => e.id === company.id) || { id: company.id, dir: "" }));
    const restored = await factsOf(company);
    const diff = stableDiff(baseline.companies[company.code], restored);
    check(`C9 ${company.code} 2.4.3 yedeği (${last.name}) 2.4.4'e geri yüklendi: şema 32, numara tabanı göçtekiyle aynı`, file.version === 32 && file.tables.includes("staff_members") && file.numberFloor === baseline.files[company.code].numberFloor, { version: file.version, numberFloor: file.numberFloor, expected: baseline.files[company.code].numberFloor });
    check(`C9 ${company.code} geri yüklenen 2.4.3 yedeğinin olguları göç ölçüsüyle (aynı veri, göç açılışta) aynı`, !diff.length, { diff });
    const notice = await noticeOf(company);
    check(`C10 ${company.code} 2.4.3 yedeği geri yüklenince de uyarı VAR; kapatılınca gider`, Boolean(notice?.at) && (await dismissNotice(company, notice)).dismissed === true && (await noticeOf(company)) === null, { notice });
    const otherAfter = await factsOf(other);
    check(`C7 ${company.code} 2.4.3 yedeğinin geri yüklenmesi ${other.code}'i değiştirmedi`, !stableDiff(otherBefore, otherAfter).length, { diff: stableDiff(otherBefore, otherAfter) });
  }
  // ---------- T4 (E6): 2.4.3'te silinip Silinenler'de duran belgeler — veri şimdi 2.4.3'ün son yedeği (C9) ----------
  for (const company of companies) {
    const c = scoped(api, company.id);
    const listed = await must("Silinenler", c.get("/api/admin/trash"));
    const items = (Array.isArray(listed) ? listed : listed.items || []).filter(item => item.kind === "invoice").map(item => ({ ...item, number: String(item.title || "").split(/\s+/).find(w => PROGRAM.test(w)) || "" }));
    const live = new Map((await must("faturalar", c.get("/api/workspace/invoices?tab=all&limit=10000"))).invoices.map(d => [d.number, d]));
    const taken = items.find(item => item.number && live.has(item.number));
    const free = items.find(item => item.number && !live.has(item.number));
    const nextBefore = (await must("ayarlar", c.get("/api/workspace/invoices/settings"))).nextNumbers;
    if (taken) {
      const res = await c.post("/api/admin/trash/restore", { id: taken.id });
      const again = await must("Silinenler", c.get("/api/admin/trash"));
      const still = (Array.isArray(again) ? again : again.items || []).filter(item => item.id === taken.id);
      check(`C11 ${company.code} E6: numarası (${taken.number}) canlı başka belgede olan silinmiş belge geri yüklenmez (409), Silinenler'de kalır`, res.status === 409 && still.length === 1, { status: res.status, message: String(res.data?.error || "").slice(0, 200), liveDoc: [live.get(taken.number)?.id, live.get(taken.number)?.status] });
    } else check(`C11 ${company.code} E6: numarası canlı belgede olan silinmiş belge YOK (veride bu durum oluşmadı)`, true, { items: items.length });
    if (free) {
      const res = await c.post("/api/admin/trash/restore", { id: free.id });
      const back = (await must("faturalar", c.get("/api/workspace/invoices?tab=all&limit=10000"))).invoices.find(d => d.id === free.ref);
      check(`C11 ${company.code} E6: numarası boşta olan silinmiş belge (${free.number}) kendi numarasıyla geri gelir`, res.status === 200 && back?.number === free.number, { status: res.status, message: String(res.data?.message || res.data?.error || "").slice(0, 200), back: back && [back.number, back.status] });
    } else check(`C11 ${company.code} E6: numarası boşta olan silinmiş belge YOK (veride bu durum oluşmadı)`, true, { items: items.length });
    const nextAfter = (await must("ayarlar", c.get("/api/workspace/invoices/settings"))).nextNumbers;
    const num = v => v?.number ?? v;
    const bad = ["paper", "smm", "internal"].filter(key => {
      const m = PROGRAM.exec(num(nextAfter?.[key]) || "");
      return m && Number(m[3]) <= (oldGiven(company.code)[`${m[1]}${m[2]}`] || 0);
    });
    check(`C11 ${company.code} E6: sıradaki kâğıt/fiş/SMM/iç numara verilmiş en büyükten (silinenler dahil) sonra; geri yükleme sıradakini değiştirmedi`, !bad.length && same(Object.fromEntries(Object.entries(nextBefore || {}).map(([k, v]) => [k, num(v)])), Object.fromEntries(Object.entries(nextAfter || {}).map(([k, v]) => [k, num(v)]))), { bad, nextBefore: Object.fromEntries(Object.entries(nextBefore || {}).map(([k, v]) => [k, num(v)])), nextAfter: Object.fromEntries(Object.entries(nextAfter || {}).map(([k, v]) => [k, num(v)])), trashInvoices: items.length });
  }
  await server.close();
  return { checks };
}
