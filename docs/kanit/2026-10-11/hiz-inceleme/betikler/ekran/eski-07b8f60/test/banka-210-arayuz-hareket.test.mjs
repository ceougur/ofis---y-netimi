// 2.1.0 — Aşama 4 (Banka Hareketleri), dilim 4: arayüzün kaynak kuralları ve arayüzün ihtiyaç duyduğu sunucu ekleri (docs/BANKA-MODULU-PLAN.md
// §7 "/bank/movements", §8.5, §8.6, §8.11 "Faiz → Mevduat Stopajı: son kullanılan oran önerilir", §3.7 #17, #23; kanıt docs/2.1.0-KANIT.md
// "Aşama 4 (Dilim 4)"). Ekranın kendisi test/e2e/senaryo-banka-210.mjs bölüm 2'de (arayüzden, sayılarla).
//
// ÇALIŞIYOR MU:
//   - Banka penceresinde Hareketler sekmesi Hesaplar'dan HEMEN sonra (Genel Bakış · Hesaplar · Hareketler · Ayarlar); POS ve Ekstre yok.
//   - Hareketler imleçli ("Daha Fazla Göster"), liste kapısıyla (HOF.listGate: eski yanıt yeni süzgeci ezmez); satır → İşlem Kartı.
//   - Fiş formu Benzer İşlem'de (409 bank-similar) "Yine de Kaydet" ile AYNI istek kimliği ve similarOk:true gönderir; Ters Kaydet, Düzelt,
//     Açıklamayı Düzelt, Planlı İşlem (Gerçekleştir / Atla / Sil) uçlarını kullanır; pasif düğmenin nedeni görünür listede (hof-inv-blocks).
//   - Tutar süzgeci (min / max): yalnız aralıktaki olaylar; yürüyen bakiye süzgeçli listede verilmez; İşlem No hızlı yolu da süzgece uyar.
//   - Fiş formunun seçenekleri (voucher-meta): süzgeç türlerinin adları, gelir/gider hesaplarının adları, son kullanılan stopaj oranı
//     (Banka Ayarları: "Son Kullanılan Oran Önerilir"; koda sabit oran yazılmaz; ters kaydedilen faizin oranı önerilmez).
//   - Planlı kredi geri ödemesi: planda girilen faiz ve referans saklanır; Gerçekleştir aynı faizle (780) fiş yazar.
// NASIL BOZARIM:
//   - Tutar süzgecine eksi, metin, üç ondalık, en büyükten büyük en küçük → 400 (ekranda hata); sınır tutarı dahil.
//   - Süzgeçli imleç başka süzgeçle gönderilir → 400 bank-cursor (liste baştan açılır).
//   - Planlı kredi geri ödemesini faizle planla → eskiden Gerçekleştir faizsiz fiş yazıyordu (faiz kayboluyordu).
//   - Fatura Yönetimi yetkisi kaldırılan kişi BSMV'li masrafı Düzelt'te "KDV Dahil" yapar → eskiden faturayı yetkisiz kesiyordu; artık 403.
//   - Aşama 4'ün işlem geçmişi türleri (fiş, ters kayıt, düzelt, açıklama, planlı) Yönetim → İşlem Geçmişi'nde ham kodla görünüyordu.
//   - Aynı güne 8 fiş: olay kimliği rastgele (UUID) olduğu için gün içi sıra gelişigüzeldi; yürüyen bakiye gün içinde anlamsız (eksi bile)
//     ara değerler gösteriyordu. Artık kimlik oluşturma sırasıyla artar (en yeni üstte, bakiye kayıt sırasını izler).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { BANK, accountView, apiOf, assert, bootBank, eventCard, expectStatus, integrityOk, lineKeys, movements, must, openBankSet, voucher } from "./banka-210-fis-ortak.mjs";

const ROOT = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, ROOT), "utf8");

describe("Aşama 4 (dilim 4) — Banka arayüzünün kaynak kuralları", () => {
  it("Hareketler sekmesi Hesaplar'dan hemen sonra; POS ve Ekstre sekmesi yok", () => {
    const src = read("client/assets/hof-bank.js");
    const block = src.slice(src.indexOf("const TABS = ["), src.indexOf("];", src.indexOf("const TABS = [")));
    const tabs = [...block.matchAll(/\["([a-z]+)",\s*"([^"]+)"\]/g)].map(match => [match[1], match[2]]);
    assert.deepEqual(tabs, [["overview", "Genel Bakış"], ["accounts", "Hesaplar"], ["movements", "Hareketler"], ["settings", "Ayarlar"]], `sekmeler: ${JSON.stringify(tabs)}`);
  });

  it("Hareketler imleçli ve liste kapılı; satır İşlem Kartı'nı açar", () => {
    const src = read("client/assets/hof-bank.js");
    assert.ok(/\/movements\?/.test(src), "Hareketler ucu kullanılmıyor");
    assert.ok(/nextCursor/.test(src), "imleç (Daha Fazla Göster) yok");
    assert.ok(/cursor=|set\("cursor"/.test(src), "imleç sorguya eklenmiyor");
    assert.ok(/HOF\.listGate\(\)/.test(src), "Hareketler liste kapısı (HOF.listGate) kullanmıyor");
    assert.ok(/Daha Fazla Göster/.test(src), "kaynakta yok: /Daha Fazla Göster/");
    assert.ok(/\/events\/\$\{encodeURIComponent\(/.test(src), "İşlem Kartı ucu kullanılmıyor");
    assert.ok(/data-event=/.test(src), "satırdan İşlem Kartı'na bağ yok");
  });

  it("fiş formu: Benzer İşlem → aynı istek kimliğiyle similarOk; Ters Kaydet, Düzelt, Açıklama, Planlı uçları; pasif neden görünür", () => {
    const src = read("client/assets/hof-bank.js");
    assert.ok(/"bank-similar"/.test(src), "409 bank-similar ele alınmıyor");
    assert.ok(/similarOk:\s*true/.test(src), "Yine de Kaydet similarOk:true göndermiyor");
    assert.ok(/Yine de Kaydet/.test(src), "kaynakta yok: /Yine de Kaydet/");
    assert.ok(/\/vouchers"/.test(src), "kaynakta yok: /\\/vouchers\"/");
    for (const path of ["/reverse", "/correct", "/info", "/execute", "/skip"]) assert.ok(src.includes(path), `${path} ucu kullanılmıyor`);
    assert.ok(/data-bank-event-blocks/.test(src), "İşlem Kartı'nda pasif düğme nedeni listesi yok");
    assert.ok(/zaten kaydedildi/.test(src), "aynı istek kimliğiyle ikinci gönderim (replayed) kullanıcıya söylenmiyor");
  });

  it("Yönetim → İşlem Geçmişi ve İşlem Kartı: Aşama 4'ün işlem geçmişi türlerinin (fiş, ters kayıt, düzelt, açıklama, planlı) adı var", () => {
    const types = new Set();
    const src = read("server/lib/bank/vouchers.mjs");
    for (const match of src.matchAll(/type:\s*"(bank\.[\w.]+)"/g)) types.add(match[1]);
    for (const match of src.matchAll(/audit\(user,\s*"(bank\.[\w.]+)"/g)) types.add(match[1]);
    assert.ok(types.size >= 8, `Aşama 4 türleri bulunamadı (${[...types].join(", ")})`);
    const admin = read("client/assets/admin.js");
    const labels = admin.slice(admin.indexOf("const EVENT_LABELS = {"), admin.indexOf("};", admin.indexOf("const EVENT_LABELS = {")));
    const missing = [...types].filter(type => !labels.includes(`"${type}":`));
    assert.deepEqual(missing, [], `İşlem Geçmişi'nde adı olmayan türler: ${missing.join(", ")}`);
    const bank = read("client/assets/hof-bank.js");
    const missingCard = [...types].filter(type => !bank.includes(`"${type}":`));
    assert.deepEqual(missingCard, [], `İşlem Kartı'nın geçmişinde adı olmayan türler: ${missingCard.join(", ")}`);
  });
});

describe("Aşama 4 (dilim 4) — arayüzün sunucu ekleri", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());

  it("tutar süzgeci (min / max): yalnız aralıktaki olaylar; sınır dahil; yürüyen bakiye verilmez; İşlem No yolu da uyar", async () => {
    const small = await voucher(ctx.api, { type: "fee", accountId: set.garanti.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-05" });
    const mid = await voucher(ctx.api, { type: "other_out", accountId: set.garanti.id, amount: "250", date: "2026-10-06" });
    const big = await voucher(ctx.api, { type: "other_in", accountId: set.garanti.id, amount: "1.000", date: "2026-10-07" });
    const all = await movements(ctx.api, `account=${set.garanti.id}`);
    assert.equal(all.balance, true);
    const range = await movements(ctx.api, `account=${set.garanti.id}&min=10,50&max=250`);
    assert.deepEqual(range.rows.map(row => row.no).sort(), [small.no, mid.no].sort(), "10,50 ve 250 sınırda dahil; 1.000 ve açılış (50.000) dışarıda");
    assert.equal(range.balance, false, "süzgeçli listede yürüyen bakiye yok");
    assert.ok(range.rows.every(row => row.balanceAfterMinor === null));
    const over = await movements(ctx.api, `account=${set.garanti.id}&min=1000`);
    assert.deepEqual(over.rows.map(row => row.type).sort(), ["opening", "other_in"], "1.000 ve açılış (50.000)");
    const everyAccount = await movements(ctx.api, "max=20");
    assert.ok(everyAccount.rows.length >= 1 && everyAccount.rows.every(row => Math.abs(row.signedMinor) <= 2_000), "tüm hesaplarda da süzer");
    const exact = await movements(ctx.api, `q=${encodeURIComponent(big.no)}&max=500`);
    assert.equal(exact.rows.length, 0, "İşlem No hızlı yolu da tutar süzgecine uyar");
    const exactHit = await movements(ctx.api, `q=${encodeURIComponent(big.no)}&min=500`);
    assert.deepEqual(exactHit.rows.map(row => row.no), [big.no]);
  });

  it("aynı günün hareketleri giriş sırasıyla (en yeni üstte); yürüyen bakiye gün içinde de kayıt sırasını izler", async () => {
    // Bulundu (Aşama 4 dilim 4, ekranda): olay kimliği rastgeleydi; aynı günün hareketleri gelişigüzel sıralanıyor, yürüyen bakiye gün içinde
    // anlamsız ara değerler (eksi bile) gösteriyordu. Kimlik artık oluşturma sırasıyla artar.
    const amounts = [1000, -100, -200, 300, -400, -50, 75, -25];
    for (const amount of amounts) await voucher(ctx.api, { type: amount > 0 ? "other_in" : "other_out", accountId: set.garanti.id, amount: String(Math.abs(amount)), date: "2026-10-03", similarOk: true });
    const day = await movements(ctx.api, `account=${set.garanti.id}&from=2026-10-03&to=2026-10-03`);
    assert.deepEqual(day.rows.map(row => row.signedMinor), [...amounts].reverse().map(amount => amount * 100), "en yeni üstte, giriş sırasıyla");
    assert.equal(day.balance, true);
    const opening = day.rows.at(-1).balanceAfterMinor - day.rows.at(-1).signedMinor;
    let running = opening;
    for (const row of [...day.rows].reverse()) {
      running += row.signedMinor;
      assert.equal(row.balanceAfterMinor, running, `${row.no}: yürüyen bakiye kayıt sırasıyla`);
    }
  });

  it("nasıl bozarım: tutar süzgecine eksi, metin, üç ondalık, ters aralık → 400; süzgeci değişmiş imleç → 400", async () => {
    for (const [query, field] of [["min=-5", "min"], ["max=abc", "max"], ["min=1,005", "min"], ["min=500&max=100", "max"]]) {
      const res = await ctx.api.get(`${BANK}/movements?account=${set.garanti.id}&${query}`);
      assert.equal(res.status, 400, `${query}: ${res.status} ${res.error}`);
      assert.equal(res.data?.field, field, `${query}: alan ${field} (${JSON.stringify(res.data).slice(0, 200)})`);
    }
    for (let i = 0; i < 3; i++) await voucher(ctx.api, { type: "other_out", accountId: set.garanti.id, amount: String(300 + i), date: "2026-10-04", similarOk: true });
    const first = await movements(ctx.api, `account=${set.garanti.id}&min=300&limit=2`);
    assert.equal(first.hasMore, true);
    expectStatus(await ctx.api.get(`${BANK}/movements?account=${set.garanti.id}&min=301&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`), 400, "bank-cursor", "başka süzgeçle imleç");
    const second = await movements(ctx.api, `account=${set.garanti.id}&min=300&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`);
    assert.ok(second.rows.every(row => !first.rows.some(item => item.no === row.no)), "ikinci sayfa tekrarsız");
  });

  it("fiş formunun seçenekleri: süzgeç türlerinin ve hesapların adları; son kullanılan stopaj oranı (ters kaydedilen sayılmaz)", async () => {
    let meta = await must("meta", ctx.api.get(`${BANK}/voucher-meta`));
    assert.equal(meta.defaults.stoppageRate, "", "hiç faiz geliri yokken öneri boş (koda sabit oran yazılmaz)");
    const groups = Object.fromEntries((meta.groups || []).map(item => [item.key, item.label]));
    for (const [key, label] of [["fee", "Banka Masrafı"], ["interest", "Faiz"], ["other", "Diğer Gelir ve Gider"], ["card", "Kart Borcu Ödemesi"], ["loan", "Kredi"], ["opening", "Açılış Bakiyesi"], ["reversal", "Ters Kayıt"], ["party", "Cari Tahsilat ve Ödeme"]]) assert.equal(groups[key], label, `süzgeç türü ${key}`);
    for (const code of ["770", "653", "642", "649", "659", "780"]) assert.ok(meta.glNames?.[code], `hesap adı ${code}`);
    const first = await voucher(ctx.api, { type: "interest_in", accountId: set.ziraat.id, amount: "1.000", stoppageRate: "15", date: "2026-10-06" });
    meta = await must("meta", ctx.api.get(`${BANK}/voucher-meta`));
    assert.equal(meta.defaults.stoppageRate, "15");
    const second = await voucher(ctx.api, { type: "interest_in", accountId: set.ziraat.id, amount: "2.000", stoppageRate: "17,5", date: "2026-10-07" });
    meta = await must("meta", ctx.api.get(`${BANK}/voucher-meta`));
    assert.equal(meta.defaults.stoppageRate, "17,5", "en son kaydedilen faizin oranı");
    await must("ters kaydet", ctx.api.post(`${BANK}/events/${second.id}/reverse`, {}));
    meta = await must("meta", ctx.api.get(`${BANK}/voucher-meta`));
    assert.equal(meta.defaults.stoppageRate, "15", "ters kaydedilen faizin oranı önerilmez");
    assert.ok(first.no);
  });

  it("nasıl bozarım: Fatura Yönetimi yetkisi olmayan kişi BSMV'li masrafı Düzelt'te KDV'li (faturalı) masrafa çeviremez → 403, hiçbir şey yazılmaz", async () => {
    const fee = await voucher(ctx.api, { type: "fee", accountId: set.ziraat.id, amount: "7,35", feeType: "fast", tax: "bsmv_incl", date: "2026-10-05" });
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Düzelt Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
    const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe-duzelt", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe-duzelt");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["invoices.manage"] } })).status, 200);
    const before = ctx.store.get("SELECT (SELECT COUNT(*) FROM fin_events) AS events, (SELECT COUNT(*) FROM invoices) AS invoices");
    expectStatus(await accountant.post(`${BANK}/events/${fee.id}/correct`, { tax: "vat_incl", taxRate: "20", partyId: party.id, invoiceNo: "DZ-1", amount: "12" }), 403, null, "Düzelt ile faturalı masraf");
    assert.deepEqual(ctx.store.get("SELECT (SELECT COUNT(*) FROM fin_events) AS events, (SELECT COUNT(*) FROM invoices) AS invoices"), before, "hiçbir şey yazılmadı");
    assert.equal((await eventCard(ctx.api, fee.id)).status, "active", "asıl masraf etkin kaldı");
    const fine = await must("BSMV'li düzelt", accountant.post(`${BANK}/events/${fee.id}/correct`, { amount: "8,40" }));
    assert.ok(fine.next.no, "vergi kipini değiştirmeyen Düzelt yapılabilir");
  });

  it("planlı kredi geri ödemesi: faiz ve referans planda saklanır; Gerçekleştir 780 faizle fiş yazar", async () => {
    const draw = await voucher(ctx.api, { type: "loan_draw", accountId: set.ziraat.id, loanAccountId: set.loan.id, amount: "10.000", date: "2026-10-02" });
    assert.ok(draw.no);
    const plan = await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "loan_repay", accountId: set.ziraat.id, loanAccountId: set.loan.id, amount: "1.000", interestAmount: "100", reference: "KR-7", plannedDate: "2026-10-08", repeat: "monthly", description: "Kredi taksiti" }));
    assert.equal(plan.spec.interestAmount, "100", "planda faiz saklı");
    const before = await accountView(ctx.api, set.ziraat.id);
    const done = await must("gerçekleştir", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { requestId: `req-${randomUUID()}` }));
    const card = await eventCard(ctx.api, done.event.id);
    assert.deepEqual(lineKeys(card), [`bank|102|${set.ziraat.glSub}|C|110000`, "expense|780||D|10000", `loan|300|${set.loan.glSub}|D|100000`].sort());
    assert.equal(card.reference, "KR-7", "referans planla gelir");
    const afterView = await accountView(ctx.api, set.ziraat.id);
    assert.equal(before.balanceMinor - afterView.balanceMinor, 110_000, "Ziraat −1.100 (anapara + faiz)");
    assert.equal(done.plan.plannedDate, "2026-11-08", "aylık plan bir ay ileri");
    await integrityOk(ctx.api, "planlı kredi");
  });
});
