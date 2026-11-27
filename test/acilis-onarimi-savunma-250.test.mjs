// 2.5.0 BİRLEŞİK TUR 5 madde 2 (AH dar kontrol DÜŞÜK-1; yalnız test — prensip §4): açılış onarımının (routes/invoices.mjs repairOwnCards) üç SAVUNMA kuralı testsizdi; dar
// kontrolün mutantları (dk-ah/betik/mutant.py M5, M6, M6b, M9) programın kendi verisinde (v2.0.26 fikstürleri, 100.000 satır) ön koşul oluşmadığı için yaşıyordu:
//   (a) ÜST SINIR — kartın kalanı eski kuralın (2.0.24–2.0.26) hedefini aşıyorsa (left > before) fark bu hatadan değildir, kart değişmez (M6: iki yerde de kalkar);
//   (b) YAZMADAN ÖNCE CARİ BAŞINA YENİDEN OKUMA — toplu durum (repairScreen) yalnız elemek içindir; karar cari başına yoldan (coverState) yeniden verilir, yazılan tutar o
//       okumayla (M9: yeniden okuma kalkar, karar ve tutar toplu durumdan);
//   (c) KİRLİ İŞARETİ — bu açılışta onarım yazılan kartın carisinin sonraki adayları toplu durumdan değil cari başına yoldan okunur (toplu sonuç o cari için bayat; M5).
// Ürün kodu DEĞİŞMEZ. Veri GÜNCEL kodun API'siyle girilir (satış + iade + geri ödeme; güncel kod kartı doğru kalana indirir), sonra kart elle "eski kuralın" bıraktığı tutara
// büyütülür (v2.0.24–2.0.26 hatasının benzetimi; asıl v2.0.26 verisi test/iade-210-onarim ve acilis-onarimi-hiz-250'de). Bayat toplu durum elle kurulur: onarımın toplu okuması
// (accounts.allLedgers) bir carinin defter satırlarını eksik ya da fazla döndürür (ön koşul her hücrede repairScreen ↔ paymentStates farkıyla gösterilir).
// M6b (yalnız yeniden okumadan SONRAKİ üst sınır kalkar) EŞDEĞER mutanttır: ilk denetimden geçmek target < left ≤ before = max(geri ödenen, imzalı açık) ister, yani
// left ≤ geri ödenen; ikinci denetimdeki before da ≥ geri ödenen (aynı tutar, aynı açılış) → "left > before" hiç doğru olamaz (docs/erp/BIRLESIK-TUR5-NOT.md).
// M6'nın deseni ilk denetimi değiştirir; toplu elemede ikinci denetim (yeniden okumadan sonra) aynı kuralı yine uygular → M6 yalnız cari başına yolda (toplu okuma düştü ya da
// cari kirli) ölür; (a) iki yolu da koşar. Kirli işaretinin iki satırı var (kartın carisi, kartı taşıyan faturaların carisi); bugünkü programda ikisi aynı cari (kartın carisi
// faturadan gelir, PUT 409) → M5 (ilk satır) yalnız kart başka cariye taşınmışken (eski veri; elle kurulur) ölür; (c) üç değişkeni de koşar.
// Saat sahte ve DURAĞAN (ders 13, 22). Ders 30: lisans servisi ölü adres. Platform (ders 48): dosya silmez / kilitlemez.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";

const T = "2026-10-08";
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";

describe("2.5.0 BİRLEŞİK TUR 5 — açılış onarımının savunma kuralları (üst sınır, yeniden okuma, kirli işareti)", () => {
  let ctx;
  let seq = 0;
  before(async () => {
    process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
    ctx = await boot({ now: { time: `${T}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  const customer = () => must("cari", ctx.api.post(ACC, { name: `Onarım Savunma ${(seq += 1)}`, type: "customer", registeredOn: "2026-07-01" }));
  // 1.000 TL satış, 500 nakit peşin, kalan 500 tek taksitte (kart).
  const sale = async acc => {
    const doc = await must("satış", ctx.api.post(INV, { kind: "sale", accountId: acc.id, issueDate: "2026-08-09", currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [{ amount: 500, method: "cash" }], cheques: [], endorse: [], rest: "installments", installments: { count: 1, firstDue: "2026-11-01", everyMonths: 1 } }, force: true }));
    return { id: doc.id, accountId: acc.id, planId: doc.plan?.id || doc.planId, lineId: doc.lines[0].id };
  };
  const giveBack = async (inv, qty, refund) => (await must("iade", ctx.api.post(INV, { kind: "sale_return", accountId: inv.accountId, originalId: inv.id, issueDate: T, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund ? [{ amount: refund, method: "cash" }] : [], cheques: [], endorse: [], rest: "open" }, force: true }))).id;
  const leftOf = planId => ctx.app.context.plans.leftOf(planId);
  // Eski kuralın (2.0.24–2.0.26) bıraktığı kart: tek taksit ve kart toplamı elle büyütülür (kapı ve K6 dışında; eski sürümün yazdığı gibi).
  const grow = (planId, amount) => {
    rawRun(ctx.db, "UPDATE plan_items SET amount = ? WHERE plan_id = ?", amount, planId);
    rawRun(ctx.db, "UPDATE plans SET total = ? WHERE id = ?", amount, planId);
  };
  // 2.5.0 Ç5-B: cari başına yol = onarımın kendi okuması (coverState → cardLedgerState; kart / bağ defteri, lib/invoice-settle.mjs) — ekrandaki fatura durumu artık
  // Tek Yükümlülük Kuyruğu görünümü (paymentStates) ve onarımın kararını vermez. Eski kodda (cardLedgerState yok) paymentStates aynı kuraldır.
  const exactOpen = inv => {
    const invoices = ctx.app.context.invoices;
    const row = { id: inv.id, accountId: inv.accountId };
    return Number((invoices.cardLedgerState ? invoices.cardLedgerState(row) : invoices.paymentStates([row]).get(inv.id))?.open);
  };
  // Onarımın toplu okumasını bayatlatır: accountId'nin defter satırları change(satırlar) ile döner (yalnız bu açılış onarımı koşusunda).
  async function withStaleLedger(accountId, change, fn) {
    const accounts = ctx.app.context.accounts;
    const original = accounts.allLedgers;
    accounts.allLedgers = options => {
      const out = original(options);
      if (out.lines.has(accountId)) out.lines.set(accountId, change(out.lines.get(accountId)));
      return out;
    };
    try {
      return await fn();
    } finally {
      accounts.allLedgers = original;
    }
  }
  const run = () => ctx.app.context.invoices.repairOwnCards({});
  const fixedPlans = result => result.fixed.map(item => item.planId);

  // İki yol: toplu eleme (ilk denetim toplu durumla, karar cari başına yeniden okumayla) ve TOPLU OKUMA DÜŞTÜĞÜNDE her aday cari başına yoldan (ilk denetim tek denetimdir;
  // routes/invoices.mjs "toplu okuma düşerse her aday eski yoldan").
  for (const [path, failBatch] of [["toplu eleme", false], ["toplu okuma düştü (her aday cari başına yoldan)", true]]) {
    test(`(a) üst sınır · ${path}: kart eski kuralın hedefini aşıyorsa (600 > 500) onarılmaz; aynı durumda hedefi aşmayan kart (500) onarılır`, async () => {
      const overA = await customer();
      const over = await sale(overA);
      await giveBack(over, 10, 500);
      const okA = await customer();
      const ok = await sale(okA);
      await giveBack(ok, 10, 500);
      assert.deepEqual([leftOf(over.planId), leftOf(ok.planId), exactOpen(over), exactOpen(ok)], [0, 0, 0, 0], "ön koşul: güncel kod kartları doğru kalana (0) indirdi, faturaların açığı 0");
      grow(over.planId, 600); // eski kuralın hedefi: max(0, 0 − 500) + 500 = 500 → 600 bu hatadan değil
      grow(ok.planId, 500);
      const accounts = ctx.app.context.accounts;
      const original = accounts.allLedgers;
      let thrown = 0;
      if (failBatch)
        accounts.allLedgers = () => {
          thrown += 1;
          throw new Error("toplu okuma düştü (test)");
        };
      let result;
      try {
        result = run();
      } finally {
        accounts.allLedgers = original;
      }
      if (failBatch) assert.ok(thrown > 0, "ön koşul: onarımın toplu okuması düştü");
      assert.equal(fixedPlans(result).includes(over.planId), false, `üst sınırı aşan kart onarıldı (sonuç ${JSON.stringify(result.fixed)})`);
      assert.equal(leftOf(over.planId), 600, "üst sınırı aşan kart değişmedi");
      assert.ok(fixedPlans(result).includes(ok.planId), "hedefi aşmayan kart onarıldı (hücre boşa koşmuyor)");
      assert.equal(leftOf(ok.planId), 0);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'plan.repaired' AND entity_id = ?", over.planId).n, 0, "üst sınırı aşan kart için onarım izi yok");
    });
  }

  test("(b) yeniden okuma: toplu durum ONARIR derken cari başına yol onarma diyor → yazılmaz; toplu durum yanlış hedef veriyor → yazılan tutar cari başına yolunki", async () => {
    // b1 — toplu: onar (açık 0 sanılır), cari başına: onarma (açık 500 = kalan). Fatura: 1.000, 500 peşin, 5 adet iade + 500 geri ödeme → açık 500 (mahsup 0), kart 500.
    const noA = await customer();
    const no = await sale(noA);
    const noReturn = await giveBack(no, 5, 500);
    assert.deepEqual([leftOf(no.planId), exactOpen(no)], [500, 500], "ön koşul b1: kart 500, faturanın açığı 500 (onarılacak bir şey yok)");
    // b2 — toplu: hedef 200 (ikinci iade görünmez), cari başına: hedef 0. Fatura: 8 adet iade + 500 geri, sonra 2 adet geri ödemesiz iade → açık 0; kart eski kuralla 500.
    const cutA = await customer();
    const cut = await sale(cutA);
    await giveBack(cut, 8, 500);
    const second = await giveBack(cut, 2, 0);
    grow(cut.planId, 500);
    assert.deepEqual([leftOf(cut.planId), exactOpen(cut)], [500, 0], "ön koşul b2: kart 500, faturanın açığı 0");
    // b1 bayatlığı: iadenin geri ödeme satırı (500 nakit çıkış) toplu okumada görünmez → iadenin alacağının tamamı faturadan düşülür, açık 0 sanılır.
    await withStaleLedger(noA.id, lines => lines.filter(line => !(line.sourceId === noReturn && line.kind === "out")), () =>
      withStaleLedger(cutA.id, lines => lines.filter(line => line.sourceId !== second), () => {
        const batch = ctx.app.context.invoices.repairScreen([no.id, cut.id]);
        assert.deepEqual([Number(batch.get(no.id)?.open), Number(batch.get(cut.id)?.open)], [0, 200], "ön koşul: toplu durum bayat (b1 açık 0 ↔ cari başına 500; b2 açık 200 ↔ cari başına 0)");
        const result = run();
        assert.equal(fixedPlans(result).includes(no.planId), false, `b1: toplu durumla karar verilip kart küçültüldü (sonuç ${JSON.stringify(result.fixed)})`);
        assert.equal(leftOf(no.planId), 500, "b1: kart değişmedi");
        const done = result.fixed.find(item => item.planId === cut.planId);
        assert.deepEqual([done?.from, done?.to], [500, 0], `b2: yazılan hedef cari başına yolunki (0) olmalı; toplu durumun hedefi 200 (sonuç ${JSON.stringify(done)})`);
        assert.equal(leftOf(cut.planId), 0, "b2: kart doğru kalana (0) indi");
      }),
    );
  });

  // Onarımın aday sırası (ürünün kendi sırası; aday sorgusunda ORDER BY yok): kuru koşu — kart küçültme yazmaz (iz ve kirli işareti yok), yalnız leftOf çağrı sırası okunur.
  function repairOrder(planIds) {
    const plans = ctx.app.context.plans;
    const order = [];
    const { leftOf: realLeft, shrinkPlan: realShrink } = plans;
    plans.leftOf = planId => {
      order.push(planId);
      return realLeft(planId);
    };
    plans.shrinkPlan = () => 0;
    try {
      run();
    } finally {
      plans.leftOf = realLeft;
      plans.shrinkPlan = realShrink;
    }
    const seen = order.filter(planId => planIds.includes(planId));
    assert.deepEqual([...seen].sort(), [...planIds].sort(), `ön koşul: iki aday da onarım sırasında (${JSON.stringify(seen)})`);
    return seen;
  }
  const returnOf = inv => ctx.store.get("SELECT id FROM invoices WHERE original_id = ? AND kind = 'sale_return' AND status = 'issued'", inv.id).id;
  // Kirli işaretinin iki satırı: (1) onarılan KARTIN carisi, (2) kartı TAŞIYAN faturaların carisi. Bugünkü programda kart faturanın carisinde açılır ve carisi faturadan gelir
  // (PUT 409) → iki satır aynı cariyi işaretler. Kartın carisi faturanınkinden farklıysa (eski sürümden kalma ya da elle düzeltilmiş veri) yalnız (1) o cariyi işaretler.
  const variants = [
    ["aynı cari (iki satır aynı cariyi işaretler)", { split: false, move: "" }],
    ["önceki adayın kartı sonrakinin carisine taşınmış (eski veri; yalnız KARTIN carisi satırı işaretler)", { split: true, move: "later" }],
    ["iki fatura aynı caride, önceki adayın kartı üçüncü cariye taşınmış (eski veri; yalnız kartı TAŞIYAN faturanın carisi satırı işaretler)", { split: false, move: "third" }],
  ];
  for (const [variant, { split, move }] of variants) {
    test(`(c) kirli işareti · ${variant}: ilk aday onarılınca o carinin toplu durumu bayat sayılır; sonraki aday cari başına yoldan okunup onarılır`, async () => {
      const ownerA = await customer();
      const ownerB = split ? await customer() : ownerA;
      const one = await sale(ownerA);
      await giveBack(one, 10, 500);
      const two = await sale(ownerB);
      await giveBack(two, 10, 500);
      grow(one.planId, 500);
      grow(two.planId, 500);
      const [firstPlan] = repairOrder([one.planId, two.planId]);
      const [earlier, later] = firstPlan === one.planId ? [one, two] : [two, one];
      // Taşıma (elle): önceki adayın KARTI başka cariye geçer; faturası kendi carisinde kalır.
      if (move === "later") rawRun(ctx.db, "UPDATE plans SET account_id = ? WHERE id = ?", later.accountId, earlier.planId);
      if (move === "third") rawRun(ctx.db, "UPDATE plans SET account_id = ? WHERE id = ?", (await customer()).id, earlier.planId);
      // Sonraki adayın toplu durumu bayat: onun iadesinin satırları toplu okumada görünmez (açık 500 → hedef 500, kart 500 → toplu durum "onarma" der).
      const laterReturn = returnOf(later);
      await withStaleLedger(later.accountId, lines => lines.filter(line => line.sourceId !== laterReturn), async () => {
        const batch = ctx.app.context.invoices.repairScreen([earlier.id, later.id]);
        assert.deepEqual([Number(batch.get(earlier.id)?.open), Number(batch.get(later.id)?.open), exactOpen(earlier), exactOpen(later)], [0, 500, 0, 0], "ön koşul: önceki aday toplu durumda doğru (0), sonraki bayat (toplu 500 ↔ cari başına 0)");
        const result = run();
        const mine = fixedPlans(result).filter(planId => planId === one.planId || planId === two.planId);
        assert.deepEqual(mine.sort(), [one.planId, two.planId].sort(), `iki kart da onarılmalı; sonraki aday kirli carinin bayat toplu durumuyla elendi (sonuç ${JSON.stringify(result.fixed)})`);
        assert.deepEqual([leftOf(one.planId), leftOf(two.planId)], [0, 0]);
      });
    });
  }
});
