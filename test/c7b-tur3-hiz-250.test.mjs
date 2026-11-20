// 2.5.0 Ç7b tur 3 devam 3 — kabul E'nin hız düzeltmesi (ders 47, 53 (a); docs/erp/C7B-FATURA-TASARIM.md §16.10). Sahte saat 08.10.2026 (ilerleyen).
// Bulgu (temiz 100 bin satır, kilitsiz): carinin açık Mevcut Borç kartı varken fatura kartı (GET — İptal Et notu) ve satış yazımının yanıtı her seferinde kapsam okumasını
// (coverState: carinin bütün defteri + kapama) yapıyordu; iptal / silme ayrıca kapsam okuması + trimCovers'ta Tek Yükümlülük Kuyruğu'nu kuruyordu (91 → 144, 101 → 321 ms).
// Düzeltme: (1) Mevcut Borç kartı yalnız açıldığı ANA kadar doğmuş borcu kapsar (lib/invoice-settle.mjs: born <= plan.at) → faturadan sonra açılmış etkin kart yoksa kapsam okunmaz;
// (2) trimCovers defteri withRemaining: false ile okur (kuyruk kurulmaz; bakiye ve kartın kendi toplamları aynı).
// Beklenenler (ELLE): kartTan ÖNCE kesilmiş fatura kartın kapsamındadır (payı > 0), kartTAN SONRA kesilen hiçbir etkin kartın kapsamında değildir (payı yok) — karar metni
// 'karttan sonra doğan borç kapsanmaz'; eşdeğerlik: her cari için trimCovers'ın okuduğu alanlar (bakiye, kart özeti toplam / ödenen / durum, defter satırları) iki yolda AYNI.
// Dişi: fatura kartı + iptal yolunda carinin defteri (accounts.detail) en çok BİR kez ve kuyruksuz (withRemaining: false) okunur — eski kodda iki kez (biri kuyruklu).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const W = "/api/workspace";
const ADMIN = { id: "test-hiz", role: "admin", display_name: "Hız Denetimi" };
describe("Ç7b tur 3 devam 3 — iptal / fatura kartının kapsam okuması ve trimCovers (hız düzeltmesinin eşdeğerliği)", () => {
  let ctx;
  let api;
  let n = 0;
  const acc = async () => (await must("cari", api.post(`${W}/accounts`, { name: `Hız Müşteri ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id;
  const service = async (accountId, gross, payment = { rest: "open" }) => (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: "2026-10-07", lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment }))).id;
  const cover = async (accountId, total) => (await must("kart", api.post(`${W}/plans`, { accountId, name: `Mevcut ${n}`, total: String(total), registeredOn: "2026-10-07", mode: "auto", count: 2, firstDue: "2026-10-10", coversBalance: true }))).id;
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));
  const shares = id => {
    const row = ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson FROM invoices WHERE id = ?", id);
    return Object.entries(ctx.app.context.invoices.cardLedgerState(row)?.coveredBy || {}).filter(([, value]) => Number(value) > 0.005).map(([planId]) => planId);
  };
  // accounts.detail çağrılarını sayar (modüller accounts().detail'i çağrı anında okur).
  const counting = async call => {
    const module = ctx.app.context.accounts;
    const real = module.detail;
    const calls = [];
    module.detail = (id, user, options = {}) => {
      calls.push({ withRemaining: options.withRemaining !== false });
      return real(id, user, options);
    };
    try {
      await call();
    } finally {
      module.detail = real;
    }
    return calls;
  };
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
  });
  after(() => ctx?.server.close());

  it("kapsam kuralı: karttan ÖNCE kesilen fatura kartın kapsamında, SONRA kesilen hiçbir etkin kartın kapsamında değil (her durumda)", async () => {
    const A = await acc();
    const before1 = await service(A, 600);
    await tick();
    const p = await cover(A, 600);
    await tick();
    const after1 = await service(A, 300);
    const after2 = await service(A, 900, { rest: "installments", installments: { count: 3, firstDue: "2026-10-10" } });
    assert.deepEqual(shares(before1), [p], "karttan önce kesilen fatura kartın kapsamında (dişi boş değil)");
    assert.deepEqual(shares(after1), [], "karttan sonra kesilen açık fatura kapsamda değil");
    assert.deepEqual(shares(after2), [], "karttan sonra kesilen taksitli fatura kapsamda değil");
    // İkinci kart: önceki fatura ikisinin kapsamında olabilir; sonraki fatura yine hiçbirinde değil.
    await tick();
    const q = await cover(A, 300);
    await tick();
    const after3 = await service(A, 120);
    assert.ok(shares(after1).every(id => id === q), "ikinci karttan önce kesilen fatura yalnız ikinci kartın kapsamında olabilir");
    assert.deepEqual(shares(after3), [], "son karttan sonra kesilen fatura kapsamda değil");
    // Ekran: kapsamda olmayan faturanın İptal Et notu kartı anmaz, kapsamdakinin notu anar (S206 / S210 — davranış aynen).
    const noteOf = async id => (await must("fatura", api.get(`${W}/invoices/${id}`))).cancelNotice || "";
    assert.match(await noteOf(before1), /taksit kartı iptalde kapanır/u, "kapsamdaki faturanın notu kartı anar");
    assert.doesNotMatch(await noteOf(after3), /taksit kartı iptalde kapanır/u, "kapsamda olmayan faturanın notu kartı anmaz");
  });

  it("dişi: fatura kartı ve iptal — carinin defteri en çok bir kez ve kuyruksuz okunur (kapsamda olmayan fatura, açık Mevcut Borç kartlı cari)", async () => {
    const A = await acc();
    await service(A, 600);
    await tick();
    await cover(A, 600);
    await tick();
    const f = await service(A, 300);
    const viewCalls = await counting(() => must("fatura kartı", api.get(`${W}/invoices/${f}`)));
    const cancelCalls = await counting(() => must("iptal", api.post(`${W}/invoices/${f}/cancel`, { reason: "hız" })));
    // İkisi birlikte: eski kodda ikisinin de nedeni iletide görünsün.
    assert.deepEqual(
      { faturaKarti: viewCalls, iptal: cancelCalls },
      { faturaKarti: [{ withRemaining: false }], iptal: [{ withRemaining: false }] },
      "fatura kartı: defter yalnız durum için bir kez (kapsam okuması yok); iptal: kapsam okuması yok, trimCovers kuyruksuz (bir kez)",
    );
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", f).status, "cancelled", "iptal yazıldı");
  });

  it("eşdeğerlik: trimCovers'ın okuduğu alanlar withRemaining: false ile AYNI (her cari; kartlı, kartsız, tahsilatlı, iadeli, iptalli)", async () => {
    const A = await acc();
    const f1 = await service(A, 600);
    await tick();
    const p = await cover(A, 600);
    await must("kart tahsilatı", api.post(`${W}/plans/${p}/entries`, { kind: "in", amount: "200", date: "2026-10-08", method: "cash" }));
    await tick();
    const f2 = await service(A, 900, { rest: "installments", installments: { count: 3, firstDue: "2026-10-10" } });
    await must("Borç Yaz", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "150", date: "2026-10-08", note: "Elle borç" }));
    await must("bağsız tahsilat", api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "100", date: "2026-10-08", method: "cash", note: "nakit", cashForce: true, similarOk: true, force: true }));
    await must("iptal", api.post(`${W}/invoices/${f2}/cancel`, { reason: "eşdeğerlik" }));
    const B = await acc();
    await service(B, 240);
    const pick = account => ({
      balance: account.totals?.balance,
      plans: (account.plans || []).map(plan => ({ id: plan.id, status: plan.status, total: plan.totals?.total, paid: plan.totals?.paid })),
      ledger: JSON.stringify(account.ledger),
    });
    const ids = ctx.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid").map(row => row.id);
    assert.ok(ids.includes(A) && ids.includes(B) && f1);
    for (const id of ids) {
      const full = ctx.app.context.accounts.detail(id, ADMIN);
      const lean = ctx.app.context.accounts.detail(id, ADMIN, { withRemaining: false });
      assert.deepEqual(pick(lean), pick(full), `cari ${id}: trimCovers girdisi iki yolda aynı`);
    }
  });
});
