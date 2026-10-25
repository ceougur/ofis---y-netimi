// 2.4.6 madde 9 (DB1) — ESKİ SÜRÜM VERİSİYLE göç (test kuralı: veri eski sürümün GERÇEK koduyla, API'sinden üretilir; ders 17, ders 23: eski kod etiketten ayrı
// kopyada — test/guvenilirlik/surumler.mjs checkoutTag):
//   v2.4.5 (gerçek kod): müşteri — fatura A 1.000 (tahsil edildi), fatura B 500, vadeli elle Borç 300, faturasız stok Satış İadesi 300 (açık hesap), iade bedeli
//   cari kartından BAĞSIZ Ödeme 300 (v2.4.5'te bağ yolu yok); ikinci müşteri — fatura iadesi + bağsız Ödeme; bir bağsız Ödeme Silinenler'e.
//   Güncel kod aynı veri klasöründe: göç v36 refund_of kolonunu BOŞ ekler (eski satırlara bağ yazılmaz); bakiye, mizan ve Kasa v2.4.5 ile AYNI. BAŞ MİMAR KARARI
//   (25.10): bağsız geri ödeme, faturayı kapatmış iadenin geri ödemesi sayılır → eski veride de fatura açıkları kendiliğinden düzelir (B 200 → 500, B2 200 → 500;
//   takvim de); kullanıcı eski Ödeme'yi Düzelt ile iadeye bağlarsa sayılar değişmez; Silinenler'den dönen eski Ödeme (yükünde bağ yok) bağsız döner.
//   Geri dönüş: aynı veri v2.4.5 ile yeniden açılır (fazla kolonu görmez), bakiye ve mizan aynı, eski kural (B 200).
// Sahte durağan saat (ders 13); ders 30 lisans adresi.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.5";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};

describe("2.4.6 madde 9 göç: v2.4.5 verisi güncel kodla (bağ yazılmaz; bağsız geri ödeme iadenin geri ödemesi sayılır, para aynı)", { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-246-iade-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("v2.4.5 verisi: göç boş bağ ekler, para aynı; fatura açıkları iade kadar döner (bağsız geri ödeme); Düzelt ile bağlamak sayıları değiştirmez; geri dönüş v2.4.5 ile açılır", async () => {
    const clock = createClock({ time: `${TODAY}T12:00:00+03:00`, fixed: true });
    const ok = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    const ids = {};
    // Aynı denetimler iki sürümde (yalnız API): bakiye, fatura açıkları, borç Kalan'ı, mizan, Kasa, takvim.
    const snapshot = async api => {
      const card1 = await ok("kart 1", api.get(`/api/workspace/accounts/${ids.c1}`));
      const card2 = await ok("kart 2", api.get(`/api/workspace/accounts/${ids.c2}`));
      const open = async id => (await ok("fatura", api.get(`/api/workspace/invoices/${id}`))).open;
      const ledger = await ok("defter", api.get("/api/workspace/ledger"));
      const cash = await ok("kasa", api.get("/api/workspace/cash"));
      // Kalemin carisi: cari kaleminde accountId, fatura kaleminde kişi adı (dues.mjs).
      const who = item => (item.accountId === ids.c1 || item.person === "Göç İade Bir" ? "c1" : item.accountId === ids.c2 || item.person === "Göç İade İki" ? "c2" : "");
      const dues = (await ok("takvim", api.get("/api/workspace/dues"))).items.filter(item => who(item)).map(item => [who(item), item.source, item.amount]).sort();
      return {
        balances: [card1.totals.balance, card2.totals.balance],
        open: { B: await open(ids.b), B2: await open(ids.b2), A2: await open(ids.a2) },
        debt: card1.entries.find(row => row.id === ids.debt)?.remaining,
        trial: ledger.trial,
        reconciled: ledger.reconciliation.ok,
        cash: cash.totals,
        dues,
      };
    };
    let before;
    const old = await bootVersion(OLD, { ...dirs, now: clock, legacyCasePayments: false, legacyTableTransfer: false });
    try {
      const api = await old.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const goods = await ok("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-G246", name: "Ürün Göç", unit: "Adet", salePrice: "100", unitPrice: "100", openingQty: "500" }));
      const c1 = await ok("müşteri 1", api.post("/api/workspace/accounts", { name: "Göç İade Bir", type: "customer", registeredOn: day(-200), phone: "0500 246 10 01" }));
      const c2 = await ok("müşteri 2", api.post("/api/workspace/accounts", { name: "Göç İade İki", type: "customer", registeredOn: day(-200), phone: "0500 246 10 02" }));
      Object.assign(ids, { c1: c1.id, c2: c2.id });
      const sale = (acc, date, qty, due) => ok("fatura", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc, issueDate: date, lines: [{ itemId: goods.id, qty, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: due } }));
      await sale(c1.id, day(-60), 10, day(-50));
      ids.a2 = (await sale(c2.id, day(-58), 10, day(-48))).id;
      await ok("tahsilat 1", api.post(`/api/workspace/accounts/${c1.id}/entries`, { kind: "in", amount: "1000", date: day(-55), method: "cash" }));
      await ok("tahsilat 2", api.post(`/api/workspace/accounts/${c2.id}/entries`, { kind: "in", amount: "1000", date: day(-55), method: "cash" }));
      ids.b = (await sale(c1.id, day(-30), 5, day(-20))).id;
      ids.b2 = (await sale(c2.id, day(-29), 5, day(-19))).id;
      const card = await ok("borç", api.post(`/api/workspace/accounts/${c1.id}/entries`, { kind: "debt", amount: "300", date: day(-25), dueDate: day(-10) }));
      ids.debt = card.entries.find(row => row.kind === "debt" && !row.source).id;
      await ok("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: c1.id, date: day(-5) }));
      ids.move = old.app.store.get("SELECT id FROM stock_moves WHERE account_id = ? AND reason = 'return'", c1.id).id;
      const full = await ok("A2 oku", api.get(`/api/workspace/invoices/${ids.a2}`));
      ids.ret = (await ok("iade faturası", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: c2.id, originalId: ids.a2, issueDate: day(-6), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }))).id;
      await ok("geri ödeme 1 (bağsız)", api.post(`/api/workspace/accounts/${c1.id}/entries`, { kind: "out", amount: "300", date: day(-4), method: "cash", cashForce: true }));
      ids.pay1 = old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'out' ORDER BY rowid DESC LIMIT 1", c1.id).id;
      await ok("geri ödeme 2 (bağsız)", api.post(`/api/workspace/accounts/${c2.id}/entries`, { kind: "out", amount: "300", date: day(-4), method: "cash", cashForce: true }));
      ids.pay2 = old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'out' ORDER BY rowid DESC LIMIT 1", c2.id).id;
      await ok("silinecek ödeme", api.post(`/api/workspace/accounts/${c2.id}/entries`, { kind: "out", amount: "50", date: day(-3), method: "cash", cashForce: true, note: "silinen eski ödeme" }));
      ids.doomed = old.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'silinen eski ödeme'", c2.id).id;
      await ok("ödemeyi sil", api.del(`/api/workspace/accounts/${c2.id}/entries/${ids.doomed}?cashForce=1`));
      assert.equal(old.app.store.all("PRAGMA table_info(account_entries)").some(column => column.name === "refund_of"), false, "ön koşul: v2.4.5'te kolon yok");
      before = await snapshot(api);
      // Ön koşul (kâhin değil): v2.4.5'in DB1 davranışı — bağsız geri ödeme iadenin kapattığını açmıyor.
      assert.deepEqual([before.open.B, before.debt], [200, 300], "v2.4.5: B 200 (DB1), borç 300");
      assert.deepEqual(before.dues.filter(row => row[0] === "c1"), [["c1", "account", 300], ["c1", "invoice", 200]], "v2.4.5 takvimi: B 200 (DB1) + borç 300");
    } finally {
      await old.close();
    }

    const current = await bootVersion(CURRENT, { ...dirs, now: clock, legacyCasePayments: false, legacyTableTransfer: false });
    try {
      const api = await current.login();
      const store = current.app.store;
      assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE refund_of <> ''").n, 0, "eski satırlar bağsız (kendiliğinden bağlanmaz)");
      const migrated = await snapshot(api);
      assert.deepEqual([migrated.balances, migrated.trial, migrated.cash, migrated.reconciled], [before.balances, before.trial, before.cash, before.reconciled], "bakiye, mizan, Kasa v2.4.5 ile aynı");
      assert.deepEqual([migrated.open.B, migrated.debt, migrated.open.B2, migrated.open.A2], [500, 300, 500, before.open.A2], "bağsız eski geri ödeme iadenin geri ödemesi: B 500, B2 500, borç 300 (v2.4.5'te 200 / 200)");
      assert.deepEqual(migrated.dues.filter(row => row[0] === "c1"), [["c1", "account", 300], ["c1", "invoice", 500]], "takvim: B 500 + borç 300");
      const card1 = await ok("kart 1", api.get(`/api/workspace/accounts/${ids.c1}`));
      // Seçenek listesi yalnız açık bağları sayar (BİLİNEN SINIR, para etkisi yok).
      assert.deepEqual(card1.refundables.map(item => [item.id, item.refundKind, item.left]), [[ids.move, "out", 300]], "seçenekte kalan 300 (açık bağ yok)");
      // Kullanıcı eski geri ödemeleri Düzelt ile bağlar: para kaydı ve kapama aynı kalır.
      await ok("eski ödemeyi bağla 1", api.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.pay1}`, { refundOf: ids.move }));
      await ok("eski ödemeyi bağla 2", api.put(`/api/workspace/accounts/${ids.c2}/entries/${ids.pay2}`, { refundOf: ids.ret }));
      assert.deepEqual(await snapshot(api), migrated, "açık bağ sayıları değiştirmez (bakiye, fatura açıkları, borç, mizan, Kasa, takvim)");
      // v2.4.5'te silinen geri ödeme (yükünde bağ yok) bağsız döner.
      const item = store.get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", ids.doomed);
      await ok("eski silineni geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
      assert.equal(store.get("SELECT refund_of AS r FROM account_entries WHERE id = ?", ids.doomed).r, "", "geri gelen eski ödeme bağsız");
    } finally {
      await current.close();
    }

    // Geri dönüş: aynı veri v2.4.5 ile (fazla kolon görmez; bağı okumaz → B yine 200, para aynı).
    const back = await bootVersion(OLD, { ...dirs, now: clock, legacyCasePayments: false, legacyTableTransfer: false });
    try {
      const api = await back.login();
      const card1 = await ok("kart 1", api.get(`/api/workspace/accounts/${ids.c1}`));
      assert.equal(card1.totals.balance, before.balances[0], "geri dönüşte bakiye aynı");
      assert.equal((await ok("B", api.get(`/api/workspace/invoices/${ids.b}`))).open, 200, "v2.4.5 bağı okumaz (eski kural)");
    } finally {
      await back.close();
    }
  });
});
