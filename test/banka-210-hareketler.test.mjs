// 2.1.0 — Aşama 4, dilim 3: Hareketler (dizin fin_events + tek kaynak moneyLines), İşlem Kartı ve Banka Masraf Raporu verisi
// (docs/BANKA-MODULU-PLAN.md §8.6, §7 "/bank/movements", "/bank/events/:no", §8.10 "Banka Masraf Raporu", §9.2/9).
//
// ÇALIŞIYOR MU:
//   - Sayfalama: limit 3 ile imleç zinciri bütün hareketleri BİR KEZ ve (tarih, kimlik) azalan sırayla verir; satır sayısı bağımsız sayımla aynı.
//   - Yürüyen bakiye (hesap süzgeçli, başka süzgeç yokken) her satırda bağımsız hesapla (ham tablolardan: banka fişi satırları + hesaba bağlı
//     modül satırları, (tarih, kimlik) ≤ satır) aynı; ilk satırdaki bakiye = hesap kartındaki bakiye.
//   - Süzgeçler: tür (Masraf, KDV'li masrafın ödeme satırı dahil), yön, tarih aralığı, durum (İptal Edildi yalnız istenince; bakiyeye girmez),
//     arama: İşlem No, cari adı, açıklama, referans. Süzgeç varken yürüyen bakiye verilmez (anlamsız).
//   - Kart hesabında kart ödemesinin karşı tarafı (+), kredide kullanım (−) görünür. Hesaba bağlı modül satırı (Bu Hesaba Ata) da listede ve
//     İşlem Kartı'nda kaynağıyla.
//   - Banka Masraf Raporu: BSMV'li ve KDV'li masraf AYNI tabloda 770 ile; BSMV ve KDV ayrı kolonlarda; ters kaydedilen masraf kendi tarihinde
//     artı, ters kaydı kendi tarihinde eksi; toplamlar hesap bazında; dönem süzgeci; Excel'de açıklama METİN (formül değil).
//   - Arama Türkçe harflerde büyük/küçük harf duyarsız ("şükrü çağlar" = "ŞÜKRÜ ÇAĞLAR"; SQLite LIKE yalnız ASCII katlar).
//   - Hesap kartının hareket sayısı ve ilk/son tarihi (Açılışı Düzelt / Sil / tür değişikliğinin dayanağı) dizinli okumayla düz tanımla aynı.
// NASIL BOZARIM:
//   - Arama önce son 92 günün dizininde, sayfa dolmazsa bir kez tablo taramasıyla: pencere dışındaki eski eşleşme kaybolmaz, iki yolun
//     sınırında sıra (tarih, kimlik) ve imleç bozulmaz, hesaplar arası tek sıra, tekrar yok.
//   - Kurcalanmış ya da bozuk imleç → 400 bank-cursor; limit 0 / 10.000 → sınıra çekilir; tanınmayan tür / yön / durum / tarih → 400.
//   - Hesabı atanmamış (eski) satır Hareketler'de görünmez (Hesabı Atanmamış Eski Hareketler'de); iptal edilmiş olay bakiyeye girmez.
//   - HTML ve formüllü açıklama: JSON'da aynen (kaçış istemcide), Excel'de satır içi metin, formül hücresi yok.
//   - Yetki: personel hareketler/kart/rapor 403; bank.reports kaldırılan kişi rapor 403 (hareketleri görür).
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { BANK, accountView, apiOf, assert, bootBank, eventCard, expectStatus, integrityOk, movements, must, openBankSet, supplier, voucher } from "./banka-210-fis-ortak.mjs";

/** Hesabın bağımsız hareket listesi: ham tablolardan (banka fişi satırları + hesaba bağlı modül satırları), olay başına imzalı kuruş. */
function rawMovements(store, accountId) {
  const map = new Map();
  const add = (eventId, date, signed) => {
    const row = map.get(eventId) || { eventId, date, signed: 0 };
    row.signed += signed;
    map.set(eventId, row);
  };
  for (const row of store.all("SELECT l.event_id AS e, e.date, CASE l.side WHEN 'D' THEN l.try_minor ELSE -l.try_minor END AS s FROM bank_lines l JOIN fin_events e ON e.id = l.event_id WHERE l.ref = ? AND l.role IN ('bank', 'card', 'loan', 'pos')", accountId)) add(row.e, row.date, row.s);
  for (const table of ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]) {
    for (const row of store.all(`SELECT event_id AS e, date, amount, ${table === "payments" ? "'in'" : table === "stock_moves" ? "CASE kind WHEN 'in' THEN 'out' ELSE 'in' END" : table === "cheque_events" ? "CASE kind WHEN 'pay' THEN 'out' ELSE 'in' END" : "kind"} AS k FROM ${table} WHERE fin_ref = ? AND event_id <> ''`, accountId)) add(row.e, row.date, (row.k === "out" ? -1 : 1) * Math.round(row.amount * 100));
  }
  return [...map.values()].sort((a, b) => (a.date === b.date ? (a.eventId < b.eventId ? 1 : -1) : a.date < b.date ? 1 : -1));
}

async function allPages(api, query, limit = 3) {
  const rows = [];
  let cursor = "";
  for (let guard = 0; guard < 500; guard += 1) {
    const page = await movements(api, `${query}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    rows.push(...page.rows);
    if (!page.hasMore) return { rows, last: page };
    assert.ok(page.nextCursor, "hasMore varken imleç");
    cursor = page.nextCursor;
  }
  throw new Error("sayfalama bitmedi");
}

describe("Aşama 4 — Hareketler, İşlem Kartı ve Banka Masraf Raporu", () => {
  let ctx;
  let set;
  let party;
  let kdvFee;
  let reversedFee;
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
    const z = set.ziraat.id;
    party = await supplier(ctx.api, "Ziraat Bankası A.Ş.");
    await voucher(ctx.api, { type: "fee", accountId: z, date: "2026-10-02", amount: "10,50", feeType: "eft", tax: "bsmv_incl", description: "<b>EFT</b> =SUM(A1:A3)", reference: "DEK-1" });
    reversedFee = await voucher(ctx.api, { type: "fee", accountId: z, date: "2026-10-03", amount: "21", feeType: "pos-komisyonu", tax: "bsmv_incl" });
    await must("ters", ctx.api.post(`${BANK}/events/${reversedFee.id}/reverse`, {}));
    kdvFee = await voucher(ctx.api, { type: "fee", accountId: z, date: "2026-10-05", amount: "120", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "ZB-2026-0009" });
    await voucher(ctx.api, { type: "other_in", accountId: z, date: "2026-10-05", amount: "500", description: "Promosyon" });
    await voucher(ctx.api, { type: "card_payment", accountId: z, cardAccountId: set.card.id, date: "2026-10-06", amount: "2.000" });
    await voucher(ctx.api, { type: "interest_out", accountId: z, date: "2026-10-07", amount: "200", taxAmount: "30" });
    await voucher(ctx.api, { type: "loan_draw", accountId: set.garanti.id, loanAccountId: set.loan.id, date: "2026-10-07", amount: "10.000" });
    // Hesaba bağlı modül satırı: 06.10 havale tahsilatı → Bu Hesaba Ata (İşlem No'lu). Bir başkası bağlanıp silinir (İptal Edildi).
    const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("havale", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "20.000", method: "bank", date: "2026-10-06" }));
    await must("havale 2", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "333", method: "bank", date: "2026-10-06" }));
    await must("eski havale (atanmamış)", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "777", method: "bank", date: "2026-10-07" }));
    const rows = ctx.store.all("SELECT id, amount FROM account_entries WHERE account_id = ? AND kind = 'in' AND date = '2026-10-06'", customer.id);
    await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: z, rows: rows.map(row => ({ table: "account_entries", id: row.id })) }));
    const doomed = rows.find(row => row.amount === 333);
    await must("bağlı satırı sil", ctx.api.del(`/api/workspace/accounts/${customer.id}/entries/${doomed.id}`));
  });
  after(() => ctx.server.close());

  it("sayfalama (limit 3, imleç): her hareket bir kez, (tarih, kimlik) azalan; yürüyen bakiye bağımsız hesapla aynı", async () => {
    const z = set.ziraat.id;
    const { rows } = await allPages(ctx.api, `account=${z}`);
    const raw = rawMovements(ctx.store, z);
    assert.deepEqual(rows.map(row => row.eventId), raw.map(row => row.eventId), "sıra ve küme bağımsız listeyle aynı");
    assert.equal(new Set(rows.map(row => row.eventId)).size, rows.length, "tekrar yok");
    let balance = raw.reduce((sum, row) => sum + row.signed, 0);
    assert.equal(rows[0].balanceAfterMinor, (await accountView(ctx.api, z)).balanceMinor, "ilk satırın bakiyesi = hesap kartı");
    for (const [index, row] of rows.entries()) {
      assert.equal(row.signedMinor, raw[index].signed, `${row.no}: tutar`);
      assert.equal(row.balanceAfterMinor, balance, `${row.no}: yürüyen bakiye`);
      balance -= row.signedMinor;
    }
    const opening = rows.find(row => row.type === "opening");
    assert.equal(opening.balanceAfterMinor, 10_000_000, "açılış satırında 100.000");
    assert.ok(!rows.some(row => row.signedMinor === 77_700), "hesabı atanmamış eski satır Hareketler'de yok");
    assert.ok(!rows.some(row => row.status === "cancelled"), "iptal edilmiş olay varsayılan listede yok");
    const reversal = rows.filter(row => row.reversalOf === reversedFee.id || row.eventId === reversedFee.id);
    assert.equal(reversal.length, 2, "ters kayıt çifti iki satır");
    assert.equal(reversal.reduce((sum, row) => sum + row.signedMinor, 0), 0, "net 0");
  });

  // Hesap kartının hareket sayısı ve ilk/son hareket tarihi (Açılışı Düzelt, Sil ve tür değişikliğinin dayanağı) 1.000.000 hareket ölçümünden
  // sonra dizinlerle okunur: düz (dizinsiz) tanımla her hesapta AYNI sonuç — açılış düzeltmesi (ters kayıt + yeni açılış), kart/kredi karşı
  // hesabı, ters kayıt, KDV'li masraf (satırsız başlık + cari ödeme satırı), Bu Hesaba Ata, hareketsiz hesap.
  it("hesap kartı: hareket sayısı ve ilk/son tarih (dizinli) düz tanımla aynı", async () => {
    await must("açılış düzelt", ctx.api.post(`${BANK}/accounts/${set.garanti.id}/opening`, { date: "2026-10-01", amount: "55.000", confirmed: true }));
    const empty = await must("hareketsiz", ctx.api.post(`${BANK}/accounts`, { bankName: "Halkbank", name: "Boş Hesap", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
    const service = ctx.app.context.bankAccounts;
    for (const account of [set.ziraat, set.garanti, set.card, set.loan, empty]) {
      const fast = service.movementInfo(account.id);
      assert.deepEqual(fast, service.movementInfoPlain(account.id), `${account.label || account.name}: dizinli = düz`);
      assert.equal((await accountView(ctx.api, account.id)).movementCount, fast.count, "hesap kartı");
    }
    assert.equal(service.movementInfo(empty.id).count, 0, "yalnız açılışı olan hesap hareketsiz");
    assert.ok(service.movementInfo(set.ziraat.id).count > 0 && service.movementInfo(set.card.id).first === "2026-10-06", "kartın ilk hareketi kart borcu ödemesi");
  });

  it("kurcalanmış ya da bozuk imleç 400; limit sınırları; tanınmayan süzgeç 400", async () => {
    const z = set.ziraat.id;
    const page = await movements(ctx.api, `account=${z}&limit=2`);
    const [body, mac] = page.nextCursor.split(".");
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const forged = Buffer.from(JSON.stringify({ ...decoded, b: 999_999_999 })).toString("base64url");
    expectStatus(await ctx.api.get(`${BANK}/movements?account=${z}&cursor=${forged}.${mac}`), 400, "bank-cursor", "kurcalanmış imleç");
    expectStatus(await ctx.api.get(`${BANK}/movements?account=${z}&cursor=bozuk`), 400, "bank-cursor", "bozuk imleç");
    assert.equal((await movements(ctx.api, `account=${z}&limit=0`)).rows.length, 1, "limit en az 1");
    assert.ok((await movements(ctx.api, `account=${z}&limit=10000`)).rows.length <= 200, "limit en çok 200");
    expectStatus(await ctx.api.get(`${BANK}/movements?type=kahve`), 400, "bank-filter", "tür");
    expectStatus(await ctx.api.get(`${BANK}/movements?dir=yan`), 400, "bank-filter", "yön");
    expectStatus(await ctx.api.get(`${BANK}/movements?status=belki`), 400, "bank-filter", "durum");
    expectStatus(await ctx.api.get(`${BANK}/movements?from=2026-13-01`), 400, "date-invalid", "tarih");
    expectStatus(await ctx.api.get(`${BANK}/movements?account=bacc-yok`), 404, "bank-account-missing", "hesap");
  });

  it("süzgeçler: Masraf (KDV'li ödeme dahil), yön, tarih, İptal Edildi; arama: İşlem No, cari adı, açıklama, referans", async () => {
    const z = set.ziraat.id;
    const fees = await movements(ctx.api, `account=${z}&type=fee`);
    assert.equal(fees.balance, false, "süzgeçte yürüyen bakiye yok");
    assert.ok(fees.rows.every(row => row.balanceAfterMinor === null));
    assert.ok(fees.rows.some(row => row.feeNo === kdvFee.no && row.signedMinor === -12_000), "KDV'li masrafın ödeme satırı Masraf süzgecinde");
    assert.ok(fees.rows.every(row => row.type === "fee" || row.feeNo), "yalnız masraflar");
    const out = await movements(ctx.api, `account=${z}&dir=out`);
    assert.ok(out.rows.length && out.rows.every(row => row.signedMinor < 0));
    const range = await movements(ctx.api, `account=${z}&from=2026-10-05&to=2026-10-06`);
    assert.ok(range.rows.length && range.rows.every(row => row.date >= "2026-10-05" && row.date <= "2026-10-06"));
    const cancelled = await movements(ctx.api, `account=${z}&status=cancelled`);
    assert.equal(cancelled.rows.length, 1);
    assert.equal(cancelled.rows[0].status, "cancelled");
    assert.equal(cancelled.rows[0].statusLabel, "İptal Edildi");
    assert.equal(cancelled.rows[0].signedMinor, 33_300, "iptal edilen olayın tutarı kopyadan");
    const byNo = await movements(ctx.api, `q=${encodeURIComponent(kdvFee.no)}`);
    assert.ok(byNo.rows.length >= 1 && byNo.rows.every(row => row.no === kdvFee.no || row.feeNo === kdvFee.no), "İşlem No araması");
    const byParty = await movements(ctx.api, `account=${z}&q=${encodeURIComponent("abc")}`);
    assert.ok(byParty.rows.some(row => row.partyName === "ABC Ltd." && row.signedMinor === 2_000_000), "cari adı araması (büyük/küçük harf duyarsız)");
    const byText = await movements(ctx.api, `account=${z}&q=promosyon`);
    assert.deepEqual(byText.rows.map(row => row.signedMinor), [50_000], "açıklama araması");
    const byRef = await movements(ctx.api, `account=${z}&q=DEK-1`);
    assert.deepEqual(byRef.rows.map(row => row.signedMinor), [-1050], "referans araması");
  });

  it("kart ve kredi hesabında karşı taraf; hesap süzgeçsiz listede hareket hesap başına bir satır", async () => {
    const card = await movements(ctx.api, `account=${set.card.id}`);
    assert.ok(card.rows.some(row => row.type === "card_payment" && row.signedMinor === 200_000), "kart borcu ödemesi kartta +2.000");
    assert.equal(card.rows[0].balanceAfterMinor, (await accountView(ctx.api, set.card.id)).balanceMinor);
    const loan = await movements(ctx.api, `account=${set.loan.id}`);
    assert.ok(loan.rows.some(row => row.type === "loan_draw" && row.signedMinor === -1_000_000));
    const all = await allPages(ctx.api, "x=1", 4);
    const pay = all.rows.filter(row => row.type === "card_payment");
    assert.equal(pay.length, 2, "kart ödemesi iki hesapta iki satır");
    assert.deepEqual(pay.map(row => row.signedMinor).sort((a, b) => a - b), [-200_000, 200_000]);
    assert.equal(all.last.balance, false, "hesap seçilmeden bakiye yok");
  });

  it("İşlem Kartı: hesaba bağlı modül satırının kaynağı, carisi, yevmiye satırları; KDV'li masrafın faturası ve ödemesi", async () => {
    const z = set.ziraat.id;
    const row = (await movements(ctx.api, `account=${z}&q=abc`)).rows.find(item => item.signedMinor === 2_000_000);
    const card = await eventCard(ctx.api, row.eventId);
    assert.equal(card.type, "party_in");
    assert.equal(card.typeLabel, "Cari Tahsilatı");
    assert.equal(card.source.table, "account_entries");
    assert.equal(card.party.name, "ABC Ltd.");
    assert.ok(card.lines.some(line => line.gl === "102" && line.sub === set.ziraat.glSub && line.side === "D" && line.tryMinor === 2_000_000), "yevmiye: 102.01 borç");
    assert.ok(card.lines.some(line => line.gl === "120" && line.side === "C"), "yevmiye: 120 alacak");
    assert.equal(card.actions.reverse.allowed, false);
    assert.match(card.actions.reverse.reason, /Cari/, "modül hareketi kendi penceresinden");
    const fee = await eventCard(ctx.api, kdvFee.no);
    assert.equal(fee.invoice.number, "ZB-2026-0009");
    assert.ok(fee.payment?.no, "ödeme satırının İşlem No'su");
    const payment = await eventCard(ctx.api, fee.payment.no);
    assert.equal(payment.linkedFee.no, kdvFee.no, "ödemeden masrafa bağ");
  });

  it("HTML ve formüllü açıklama: JSON'da aynen; Banka Masraf Raporu Excel'inde satır içi metin, formül yok", async () => {
    const z = set.ziraat.id;
    const list = await movements(ctx.api, `account=${z}&q=DEK-1`);
    assert.equal(list.rows[0].description, "<b>EFT</b> =SUM(A1:A3)");
    const res = await ctx.api.raw("GET", `${BANK}/reports/fees?format=xlsx`);
    assert.equal(res.status, 200);
    const files = readZip(res.buffer);
    const sheet = files.find(entry => /worksheets\/sheet1\.xml$/.test(entry.name))?.data.toString("utf8") || "";
    assert.ok(sheet.includes("&lt;b&gt;EFT&lt;/b&gt; =SUM(A1:A3)"), "açıklama metin hücresinde, kaçışlı");
    assert.ok(!/<f>/.test(sheet), "formül hücresi yok");
  });

  it("Banka Masraf Raporu: BSMV ve KDV aynı tabloda 770; ters kayıt eksi satır; dönem süzgeci; toplamlar", async () => {
    const report = await must("rapor", ctx.api.get(`${BANK}/reports/fees`));
    const bsmv = report.rows.find(row => row.date === "2026-10-02");
    assert.equal(bsmv.gl, "770");
    assert.equal(bsmv.feeTypeName, "EFT");
    assert.equal(bsmv.baseMinor, 1000);
    assert.equal(bsmv.bsmvMinor, 50);
    assert.equal(bsmv.vatMinor, 0);
    assert.equal(bsmv.totalMinor, 1050);
    const kdv = report.rows.find(row => row.no === kdvFee.no);
    assert.equal(kdv.gl, "770");
    assert.equal(kdv.baseMinor, 10_000);
    assert.equal(kdv.vatMinor, 2_000);
    assert.equal(kdv.bsmvMinor, 0);
    assert.equal(kdv.invoiceNo, "ZB-2026-0009");
    const pos = report.rows.filter(row => row.gl === "653");
    assert.deepEqual(pos.map(row => row.totalMinor).sort((a, b) => a - b), [-2100, 2100], "ters kaydedilen POS komisyonu artı + eksi");
    assert.equal(report.totals.byGl["770"].totalMinor, 1050 + 12_000);
    assert.equal(report.totals.byGl["653"].totalMinor, 0);
    assert.equal(report.totals.vatMinor, 2_000);
    assert.equal(report.totals.bsmvMinor, 50);
    const october5 = await must("dönem", ctx.api.get(`${BANK}/reports/fees?from=2026-10-04&to=2026-10-05`));
    assert.deepEqual(october5.rows.map(row => row.no), [kdvFee.no]);
    await integrityOk(ctx.api, "hareketler");
  });

  it("Türkçe arama: küçük, büyük ve sözcük başı büyük yazımla cari adı bulunur (SQLite LIKE yalnız ASCII'de büyük/küçük ayırmaz)", async () => {
    const z = set.ziraat.id;
    const person = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Şükrü Çağlar İnşaat", type: "customer", registeredOn: "2026-09-01" }));
    await must("havale", ctx.api.post(`/api/workspace/accounts/${person.id}/entries`, { kind: "in", amount: "4.444", method: "bank", date: "2026-10-07" }));
    const row = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", person.id);
    await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: z, rows: [{ table: "account_entries", id: row.id }] }));
    for (const q of ["şükrü çağlar", "ŞÜKRÜ ÇAĞLAR", "Şükrü çağlar", "çağlar inşaat"]) {
      const found = await movements(ctx.api, `account=${z}&q=${encodeURIComponent(q)}`);
      assert.deepEqual(found.rows.map(item => item.signedMinor), [444_400], `arama "${q}"`);
    }
    await integrityOk(ctx.api, "Türkçe arama");
  });

  it("yetki: personel 403; bank.reports kaldırılan kişi raporu göremez, hareketleri görür", async () => {
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel6", role: "personel" }));
    for (const url of [`${BANK}/movements`, `${BANK}/events/${kdvFee.no}`, `${BANK}/reports/fees`, `${BANK}/plans`]) expectStatus(await staff.get(url), 403, null, `personel ${url}`);
    const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe6", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe6");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.reports"] } })).status, 200);
    expectStatus(await accountant.get(`${BANK}/reports/fees`), 403, null, "bank.reports yok");
    await must("hareketler görülür", accountant.get(`${BANK}/movements?account=${set.ziraat.id}`));
  });
});

// Arama yolu (ölçüm sonrası, tools/banka-hareket-olcum.mjs): önce son 92 günün dizini, sayfa dolmazsa tablo bir kez taranır. Bu iki yolun
// sınırında sıra ve imleç bozulmamalı: eski (pencere dışı) ile yeni (pencere içi) eşleşmeler tek sırada, sayfa sayfa, tekrarsız gelir.
describe("Aşama 4 — Hareketler araması: yakın pencere ve tablo taraması sınırı", () => {
  let ctx;
  let accounts;
  before(async () => {
    ctx = await bootBank();
    const open = (bankName, name) => must(`hesap ${name}`, ctx.api.post(`${BANK}/accounts`, { bankName, name, kind: "demand", opening: { date: "2026-01-02", amount: "10.000", confirmed: true } }));
    accounts = { a: await open("Ziraat Bankası", "Eski Hesap"), b: await open("Garanti BBVA", "Eski Hesap") };
    accounts.card = await must("kart", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Eski Kart", kind: "card", creditLimit: "50.000", opening: { date: "2026-01-02", amount: "0", confirmed: true } }));
    const add = (account, date, amount, description) => voucher(ctx.api, { type: "other_out", accountId: account.id, date, amount, description, similarOk: true }, description);
    await add(accounts.a, "2026-02-03", "11", "Kira ARAMA-SINIR şubat");
    // Pencere dışında, iki hesabın (banka ve kart) kolunda birden görünen olay: tarama tek geçişte iki satır vermeli.
    await voucher(ctx.api, { type: "card_payment", accountId: accounts.a.id, cardAccountId: accounts.card.id, date: "2026-02-10", amount: "16", description: "Kart ödemesi arama-sınır", similarOk: true });
    await add(accounts.b, "2026-03-04", "12", "Kira arama-sınır mart");
    await add(accounts.a, "2026-05-05", "13", "Başka işlem");
    await add(accounts.a, "2026-09-20", "14", "Kira Arama-Sınır eylül");
    await add(accounts.b, "2026-10-06", "15", "Kira arama-sınır ekim");
  });
  after(() => ctx.server.close());

  it("tek hesap: pencere dışındaki eski eşleşme taramayla bulunur; sayfalama tekrarsız ve tarih sırasıyla", async () => {
    const { rows } = await allPages(ctx.api, `account=${accounts.a.id}&q=${encodeURIComponent("arama-sınır")}`, 1);
    assert.deepEqual(rows.map(row => row.signedMinor), [-1400, -1600, -1100], "eylül (pencere içi) sonra şubat (tarama)");
    const card = await allPages(ctx.api, `account=${accounts.card.id}&q=${encodeURIComponent("arama-sınır")}`, 1);
    assert.deepEqual(card.rows.map(row => row.signedMinor), [1600], "kartın kolunda (karşı hesap) kart ödemesi +");
  });

  it("tüm hesaplar: eşleşmeler hesaplar arasında tek sırada; aynı olayın iki hesaptaki satırı ayrı; 1'erli sayfa, imleçle", async () => {
    const { rows } = await allPages(ctx.api, `q=${encodeURIComponent("ARAMA-SINIR")}`, 1);
    const signed = rows.map(row => row.signedMinor);
    assert.deepEqual(signed.slice(0, 3), [-1500, -1400, -1200]);
    assert.deepEqual(signed.slice(3, 5).sort((x, y) => x - y), [-1600, 1600], "kart ödemesi: bankada −, kartta +");
    assert.deepEqual(signed.slice(5), [-1100]);
    assert.equal(new Set(rows.map(row => `${row.eventId}|${row.accountId}`)).size, 6, "tekrar yok");
    assert.equal(new Set(rows.map(row => row.eventId)).size, 5);
  });

  it("tarama yolunda yön süzgeci her kolda kendi yönüyle: Giriş yalnız kartın satırı, Çıkış kartta yok", async () => {
    assert.deepEqual((await movements(ctx.api, `q=${encodeURIComponent("arama-sınır")}&dir=in`)).rows.map(row => row.signedMinor), [1600]);
    assert.deepEqual((await movements(ctx.api, `account=${accounts.card.id}&q=${encodeURIComponent("arama-sınır")}&dir=out`)).rows, []);
    assert.deepEqual((await movements(ctx.api, `account=${accounts.a.id}&q=${encodeURIComponent("arama-sınır")}&dir=out`)).rows.map(row => row.signedMinor), [-1400, -1600, -1100]);
  });

  it("nadir eski eşleşme tek başına; eşleşme yoksa boş", async () => {
    assert.deepEqual((await movements(ctx.api, `q=${encodeURIComponent("şubat")}`)).rows.map(row => row.signedMinor), [-1100]);
    assert.deepEqual((await movements(ctx.api, "q=hic-yok-boyle-bir-sey")).rows, []);
  });
});
