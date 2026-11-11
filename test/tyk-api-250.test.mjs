// 2.5.0 Ç5-B — Tek Yükümlülük Kuyruğu, GERÇEK program (API) üzerinden: "bütün ekranlar aynı sayı" (çekirdek §9.11, C5 §2.10 madde 9), S50, S52 / S72 / S73,
// düzeltme reddi (S54 / S57 / S79 / S80 / S81 / S83 / S84 / S85; sıra K10-1), mutabakat kapısının list()'i TYK hesaplamaz. Beklenenler ELLE (karar metninden; yorumda hesap).
// Sahte DURAĞAN saat (ders 13); tarihler bugüne göreli. Eski kodda (ba661d1b) kırmızı: cari kartında overdueDebt yok, gecikmiş taksitten; S50 taksiti kapatmıyor; cari değişimi yok sayılıyor.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
});
const codeOf = res => res.data?.code ?? res.data?.data?.code ?? res.data?.error?.code;

describe("2.5.0 Ç5-B — Tek Yükümlülük Kuyruğu (API)", () => {
  let server;
  let api;
  let item;
  let n = 0;
  let k10 = null;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    item = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM-TYK", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
    // VUK sıra-tarih: en eski tarihli fatura önce (K10-1 senaryosunun kilitli dönemdeki peşinli faturası).
    k10 = { a: await account("K10 A"), b: await account("K10 B") };
    k10.invoice = (await must("peşinli fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: k10.a.id, issueDate: day(-60), lines: [{ itemId: item.id, qty: 1, unitPrice: "500", vatRate: 0 }], payment: { cash: [{ amount: "200", method: "cash" }], rest: "open", dueDate: day(-60) }, cashForce: true }))).id;
  });
  after(async () => server?.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const account = (label, type = "customer") => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `TYK ${label}`, type, registeredOn: day(-400), phone: `0500 250 01 ${String((n += 1)).padStart(2, "0")}` }));
  const sale = async (acc, date, amount, dueDate = date) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate } }))).id;
  const entry = async (acc, body) => {
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const result = await must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", ...body }));
    return result.entries.find(row => !before_.has(row.id));
  };
  const card = acc => must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const invoice = id => must("fatura oku", api.get(`/api/workspace/invoices/${id}`));

  describe("B1: bütün ekranlar aynı sayı (cari kartı = liste = Anlık Durum = mobil cari listesi = Vade Takip = zil; fatura durumu)", () => {
    let acc;
    let f1;
    let planId;
    before(async () => {
      // ELLE: F1 1.000 (vade −20) · Borç Yaz 300 vadesiz (−10; S1 → vade −10) · Yeni Borç kartı 600 (2 × 300; −5, +25) · bağsız tahsilat 500 (−3).
      // S2 + karar (1): tahsilat −3'te açık kalemler vade sırasıyla: F1 (−20) 500 kapanır → F1 500 açık, Borç Yaz 300, 1. taksit 300 (−5), 2. taksit 300 (+25).
      // gecikmiş(bugün) = 500 + 300 + 300 = 1.100 (3 kalem); bakiye = 1.000 + 300 + 600 − 500 = 1.400.
      acc = await account("Aynı Sayı");
      f1 = await sale(acc, day(-30), 1000, day(-20));
      await entry(acc, { kind: "debt", amount: "300", date: day(-10), note: "vadesiz borç" });
      planId = (await must("Yeni Borç kartı", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-8), total: "600", accountId: acc.id, mode: "auto", count: "2", firstDue: day(-5), everyMonths: "1" }))).id;
      await entry(acc, { kind: "in", amount: "500", date: day(-3) });
    });
    it("cari kartı: Gecikmiş Borç 1.100 (3 kalem), bakiye 1.400; eski alan (taksit) ayrı", async () => {
      const t = (await card(acc)).totals;
      assert.deepEqual([t.overdueDebt, t.overdueDebtCount, t.balance, t.overdueSince], [1100, 3, 1400, day(-20)]);
      assert.equal(t.overdue, 300, "totals.overdue ESKİ anlam (açık kartın gecikmiş taksiti; WhatsApp Ç5-C'ye kadar)");
    });
    it("cari listesi satırı ve 'Gecikmiş Borcu Olan' süzgeci aynı sayı; sıralama TYK'ya göre", async () => {
      const list = await must("liste", api.get("/api/workspace/accounts?status=all&balance=overdue&limit=500"));
      const row = list.accounts.find(item => item.id === acc.id);
      assert.deepEqual([row.overdue, row.overdueCount], [1100, 3]);
    });
    it("Anlık Durum alacak gecikmişi = cari listesinin toplamı (bu sunucuda tek gecikmiş cari bu)", async () => {
      const overview = await must("anlık durum", api.get("/api/workspace/overview"));
      const list = await must("liste", api.get("/api/workspace/accounts?status=all&limit=500"));
      assert.equal(overview.receivable.overdue, list.totals.overdue);
      assert.ok(overview.receivable.overdue >= 1100);
    });
    // Rapor Merkezi (report-center.mjs + hof-report-center.js; Ç3 dosyaları, C5-ACILIS §0 "report-center satırı sonra"): "Geciken" kolonu ve "Geciken Taksiti Olan"
    // süzgeci adlarıyla birlikte TYK'ya geçene kadar eski anlamı (taksit kartlarının gecikmişi) gösterir — ad / anlam uyuşmazlığı olmasın diye bilerek.
    it("Rapor Merkezi Cari Listesi: report-center TYK'ya geçene kadar eski anlam (geciken taksit 300; cari kartı Gecikmiş Borç 1.100)", async () => {
      const report = await must("cari listesi raporu", api.get("/api/workspace/report-center/cari-listesi?side=overdue"));
      const row = report.rows.find(r => r[1] === acc.name);
      assert.ok(row, "cari raporda (geciken taksiti var)");
      assert.match(String(row.at(-1)), /^300,00/);
    });
    it("Vade Takip: carinin vadesi geçmiş kalemleri toplamı = gecikmiş; aynı borç bir kez (fatura 500, borç 300, taksit 300)", async () => {
      const vade = await must("vade takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-400)}&to=${day(60)}`));
      const rows = vade.rows.filter(row => row.party === acc.name);
      const late = rows.filter(row => row.date < TODAY);
      assert.equal(Math.round(late.reduce((s, r) => s + (r.amount || 0), 0) * 100), 110000);
      assert.deepEqual(rows.map(r => [r.source, r.amount]).sort(), [["account", 300], ["invoice", 500], ["plan", 300], ["plan", 300]]);
    });
    it("zil / takvim: aynı kalemler (ufuk +7 gün); fatura durumu Vadesi Geçti, Kalan 500", async () => {
      const dues = await must("takvim", api.get("/api/workspace/dues"));
      const mine = dues.items.filter(row => row.accountId === acc.id || row.person === acc.name).map(row => [row.source, row.amount, row.state]).sort();
      assert.deepEqual(mine, [["account", 300, "overdue"], ["invoice", 500, "overdue"], ["plan", 300, "overdue"]]);
      const doc = await invoice(f1);
      assert.deepEqual([doc.payState, doc.open], ["overdue", 500]);
      assert.equal(doc.closers[0].modeLabel, "Otomatik (vadesi en önce gelen)");
    });
    it("S50: taksit kartı ekranı taksit kalanını kuyruktan gösterir; kartın kendi hesabı (Kalan 600) değişmez", async () => {
      const plan = await must("kart", api.get(`/api/workspace/plans/${planId}`));
      assert.deepEqual(plan.items.map(i => i.remaining), [300, 300]);
      assert.deepEqual([plan.totals.remaining, plan.totals.queueRemaining, plan.totals.accountPaid], [600, 600, 0]);
    });
  });

  it("S50 = A: kart seçilmeden alınan tahsilat ayrı kartın vadesi gelmiş taksitini kapatır; Taksitler ve zil bunu gösterir", async () => {
    // ELLE: Yeni Borç kartı 600 (−5 / +25); bağsız tahsilat 400 (−2) → 1. taksit 300 kapanır (S2: tek açık kalem önce), 100 2. taksite (K8-3).
    const acc = await account("S50");
    const planId = (await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-8), total: "600", accountId: acc.id, mode: "auto", count: "2", firstDue: day(-5), everyMonths: "1" }))).id;
    await entry(acc, { kind: "in", amount: "400", date: day(-2) });
    const plan = await must("kart", api.get(`/api/workspace/plans/${planId}`));
    assert.deepEqual(plan.items.map(i => [i.remaining, i.accountPaid]), [[0, 300], [200, 100]]);
    assert.deepEqual([plan.totals.remaining, plan.totals.queueRemaining, plan.totals.accountPaid, plan.state], [600, 200, 400, "active"]);
    assert.equal((await card(acc)).totals.overdueDebt, 0, "gecikmiş yok");
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    assert.equal(dues.items.filter(row => row.accountId === acc.id).length, 0, "zilde kart kalemi yok (2. taksit +25, ufuk dışında)");
  });

  it("S52 / S72 / S73: Ödeme Sözü gecikmişi değiştirmez; söz günü DAHİL 'Ödeme Sözü Var'; söz geçince düşer", async () => {
    const acc = await account("Söz");
    await entry(acc, { kind: "debt", amount: "400", date: day(-20), dueDate: day(-10), expectedDate: TODAY });
    const t = (await card(acc)).totals;
    assert.deepEqual([t.overdueDebt, t.promiseActive, t.promiseUntil], [400, true, TODAY], "söz günü (S72): gecikmiş sayılır, söz etkin");
    const other = await account("Söz Geçti");
    await entry(other, { kind: "debt", amount: "250", date: day(-20), dueDate: day(-10), expectedDate: day(-1) });
    const u = (await card(other)).totals;
    assert.deepEqual([u.overdueDebt, u.promiseActive], [250, false], "söz geçince (ertesi takvim günü, K9-1) etkin değil");
    const list = await must("liste", api.get("/api/workspace/accounts?status=all&limit=500"));
    assert.equal(list.accounts.find(row => row.id === acc.id).promiseUntil, TODAY);
    assert.equal(list.accounts.find(row => row.id === other.id).promiseUntil, "");
  });

  describe("düzeltmede cari değişimi (S54 / S57 / S79 / S80 / S81 / S83 / S84 / S85; sıra K10-1)", () => {
    it("S57: bağlı (Kapatılacak Fatura) kaydın carisi bağ değişmeden düzeltilmez → 409 entry-link-first; kayıt değişmez", async () => {
      const a = await account("S57 A");
      const b = await account("S57 B");
      const fa = await sale(a, day(-15), 800);
      const pay = await entry(a, { kind: "in", amount: "800", date: day(-5), invoiceId: fa });
      const res = await api.put(`/api/workspace/accounts/${a.id}/entries/${pay.id}`, { accountId: b.id });
      assert.equal(res.status, 409);
      assert.equal(codeOf(res), "entry-link-first");
      const row = { ...server.app.store.get("SELECT account_id AS accountId, invoice_id AS invoiceId FROM account_entries WHERE id = ?", pay.id) };
      assert.deepEqual(row, { accountId: a.id, invoiceId: fa });
    });
    it("S79 = A (S54 gibi): aynı düzeltmede cari + bağ değişirse kabul — bağ yeni carinin belgesine; eski fatura yeniden açılır", async () => {
      const a = await account("S79 A");
      const b = await account("S79 B");
      const fa = await sale(a, day(-15), 800);
      const fb = await sale(b, day(-14), 800);
      const pay = await entry(a, { kind: "in", amount: "800", date: day(-5), invoiceId: fa });
      await must("cari + bağ", api.put(`/api/workspace/accounts/${a.id}/entries/${pay.id}`, { accountId: b.id, invoiceId: fb }));
      assert.deepEqual([(await invoice(fa)).open, (await invoice(fb)).open], [800, 0]);
      assert.deepEqual([(await card(a)).totals.balance, (await card(b)).totals.balance], [800, 0]);
      const fc = await sale(b, day(-13), 300);
      const pay2 = await entry(b, { kind: "in", amount: "300", date: day(-4), invoiceId: fc });
      await must("bağ kaldırılarak", api.put(`/api/workspace/accounts/${b.id}/entries/${pay2.id}`, { accountId: a.id, invoiceId: "" }));
      assert.equal(server.app.store.get("SELECT account_id AS a, invoice_id AS i FROM account_entries WHERE id = ?", pay2.id).a, a.id);
      const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      assert.equal(integrity.ok, true, JSON.stringify((integrity.checks || []).filter(c => !c.ok)).slice(0, 400));
    });
    it("bağsız kaydın carisi düzeltilir (S57 uygulanmaz); iki carinin bakiyesi ve kuyruğu yeniden kurulur", async () => {
      const a = await account("Bağsız A");
      const b = await account("Bağsız B");
      await sale(a, day(-10), 500);
      await sale(b, day(-10), 500);
      const pay = await entry(a, { kind: "in", amount: "500", date: day(-5) });
      await must("cari", api.put(`/api/workspace/accounts/${a.id}/entries/${pay.id}`, { accountId: b.id }));
      assert.deepEqual([(await card(a)).totals.overdueDebt, (await card(b)).totals.overdueDebt], [500, 0]);
    });
    it("S80 / S83 / S84 = A: fatura formunda alınan / yapılan peşinin carisi ya da bağı → 409 invoice-payment-edit ('faturayı düzenleyin')", async () => {
      const a = await account("S80 A");
      const b = await account("S80 B");
      const fa = (await must("peşinli fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: day(-6), lines: [{ itemId: item.id, qty: 1, unitPrice: "500", vatRate: 0 }], payment: { cash: [{ amount: "200", method: "cash" }], rest: "open", dueDate: day(-6) }, cashForce: true }))).id;
      const pesin = server.app.store.get("SELECT id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", fa);
      assert.ok(pesin, "peşin satırı");
      const r1 = await api.put(`/api/workspace/accounts/${a.id}/entries/${pesin.id}`, { accountId: b.id });
      assert.deepEqual([r1.status, codeOf(r1)], [409, "invoice-payment-edit"], "S80 carisi");
      const fb = await sale(a, day(-5), 100);
      const r2 = await api.put(`/api/workspace/accounts/${a.id}/entries/${pesin.id}`, { invoiceId: fb });
      assert.deepEqual([r2.status, codeOf(r2)], [409, "invoice-payment-edit"], "S84 bağı");
      const s = await account("S83 Tedarikçi", "supplier");
      const t = await account("S83 Tedarikçi 2", "supplier");
      const pur = (await must("peşinli alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", kind: "purchase", accountId: s.id, number: `ALS${Date.now()}`, issueDate: day(-6), lines: [{ name: "Gider", qty: 1, unitPrice: "300", vatRate: 0, expenseCode: "other" }], payment: { cash: [{ amount: "100", method: "cash" }], rest: "open", dueDate: day(-6) }, cashForce: true }))).id;
      const odeme = server.app.store.get("SELECT id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", pur);
      const r3 = await api.put(`/api/workspace/accounts/${s.id}/entries/${odeme.id}`, { accountId: t.id });
      assert.deepEqual([r3.status, codeOf(r3)], [409, "invoice-payment-edit"], "S83 alış peşini");
    });
    it("K10-1: kilitli dönemdeki peşinin carisi → önce KILITLI_DONEM (409 period-locked)", async () => {
      const { a, b, invoice: fa } = k10;
      const pesin = server.app.store.get("SELECT id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", fa);
      await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-50) }));
      try {
        const r = await api.put(`/api/workspace/accounts/${a.id}/entries/${pesin.id}`, { accountId: b.id });
        assert.deepEqual([r.status, codeOf(r)], [409, "period-locked"]);
      } finally {
        await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
      }
    });
    it("S81 = A: Normal Cari tahsilat aynı düzeltmede şüpheli kaydı açık bir cariye alınıp 120 bakiyesini aşarsa red (doubtful-normal-exceeds)", async () => {
      // ELLE: C borcu 1.000 (vade −40), 900 şüpheliye (−30) → 120 = 100. A'nın 400'lük Normal Cari tahsilatı C'ye → 400 > 100 → red; 100 → kabul (eşitlik).
      const a = await account("S81 A");
      const c = await account("S81 C");
      await entry(c, { kind: "debt", amount: "1000", date: day(-45), dueDate: day(-40) });
      await must("şüpheliye al", api.post(`/api/workspace/accounts/${c.id}/doubtful`, { amount: "900", date: day(-30), reason: "lawsuit", note: "dava" }));
      await entry(a, { kind: "debt", amount: "1000", date: day(-20) });
      const big = await entry(a, { kind: "in", amount: "400", date: day(-5), doubtfulSkip: true });
      const r = await api.put(`/api/workspace/accounts/${a.id}/entries/${big.id}`, { accountId: c.id });
      assert.deepEqual([r.status, codeOf(r)], [409, "doubtful-normal-exceeds"]);
      assert.equal(server.app.store.get("SELECT account_id AS a FROM account_entries WHERE id = ?", big.id).a, a.id, "düzeltmenin tamamı reddedildi");
      const small = await entry(a, { kind: "in", amount: "100", date: day(-5), doubtfulSkip: true });
      await must("eşitlik kabul", api.put(`/api/workspace/accounts/${a.id}/entries/${small.id}`, { accountId: c.id }));
      assert.equal((await card(c)).totals.overdueDebt, 0, "şüpheli kısım gecikmişe girmez (M13); 120'deki 100 Normal Cari tahsilatla kapandı");
    });
    it("S85 = A (K10-3): Normal Cari kaydın yalnız TARİHİ 120'nin küçük olduğu güne alınırsa sınır yeni günde ölçülür → red", async () => {
      // ELLE: C2 F1 1.000 (−50), F2 1.000 (−10); şüpheliye 900 (−30) → bugün 120 = 2.000 − 900 = 1.100; −20 gününde (F2 yok) 1.000 − 900 = 100.
      // Normal Cari tahsilat 500 (−5) kabul; tarihi −20'ye → 500 > 100 → red.
      const c = await account("S85 C");
      await entry(c, { kind: "debt", amount: "1000", date: day(-55), dueDate: day(-50) });
      await must("şüpheliye al", api.post(`/api/workspace/accounts/${c.id}/doubtful`, { amount: "900", date: day(-30), reason: "lawsuit", note: "dava" }));
      await entry(c, { kind: "debt", amount: "1000", date: day(-10) });
      const pay = await entry(c, { kind: "in", amount: "500", date: day(-5), doubtfulSkip: true });
      const r = await api.put(`/api/workspace/accounts/${c.id}/entries/${pay.id}`, { date: day(-20) });
      assert.deepEqual([r.status, codeOf(r)], [409, "doubtful-normal-exceeds"]);
      assert.equal(server.app.store.get("SELECT date FROM account_entries WHERE id = ?", pay.id).date, day(-5));
    });
  });

  it("artımlı önbellek (tasarım §5): yazımdan sonra yalnız dokunulan cari yeniden kurulur; her carinin sonucu cari başına baştan kurulumla aynı", async () => {
    const inv = server.app.context.invoices;
    const AUDIT = { id: "test", role: "admin", permissions: [] };
    const snapshot = () => {
      const all = inv.allObligations();
      return new Map([...all].map(([id, r]) => [id, JSON.stringify([r.overdue(TODAY).amount, r.items.map(i => [i.key, i.remaining]), [...r.invoices].map(([k, v]) => [k, v.open, v.state])])]));
    };
    const before_ = snapshot();
    const acc = await account("Artımlı");
    const accounts = server.app.context.accounts;
    const original = accounts.allLedgers;
    let full = 0;
    accounts.allLedgers = (...args) => {
      full += 1;
      return original(...args);
    };
    let after_;
    try {
      await entry(acc, { kind: "debt", amount: "123", date: day(-2) });
      full = 0;
      after_ = snapshot();
      assert.equal(full, 0, "cari yazımından sonra bütün carilerin defteri kurulmaz (yalnız yazılan cari)");
      // Ç5-B tur 2a (Y-3, bilerek güncellendi — dar kontrol DK-C5B Y-3: "İzi değişmeyen yazımda önbellek korunur; iz TYK'nin BÜTÜN girdilerini kapsar"): kuyruğa dokunmayan
      // yazımdan (aynı değerle güncelleme) sonra bütün cariler yeniden KURULMAZ (önceden "güvenli yön" diye bir kez kuruluyordu — 100 bin satırda ~7 sn). İzin eksiksizliği
      // test/tyk-onbellek-250.test.mjs'te (her yazım türünden sonra önbellekli = baştan kurulan, rastgele sıra, durağan ve akan saat).
      server.app.store.run("UPDATE accounts SET updated_at = updated_at WHERE id = ?", acc.id);
      inv.allObligations();
      inv.allObligations();
      assert.equal(full, 0, "izi değişmeyen yazımda bütün cariler yeniden kurulmaz");
    } finally {
      accounts.allLedgers = original;
    }
    const changed = [...after_.keys()].filter(id => before_.get(id) !== after_.get(id));
    assert.deepEqual(changed, [acc.id], "yalnız yazılan carinin sonucu değişti");
    for (const [id, value] of after_) {
      const ledger = server.app.context.accounts.detail(id, AUDIT, { withRemaining: false }).ledger;
      const fresh = inv.obligationsFor(id, ledger);
      assert.equal(JSON.stringify([fresh.overdue(TODAY).amount, fresh.items.map(i => [i.key, i.remaining]), [...fresh.invoices].map(([k, v]) => [k, v.open, v.state])]), value, `cari ${id}: önbellek = baştan`);
    }
  });

  it("mutabakat kapısının list()'i (iç kimlik 'ledger' / 'integrity', ids) TYK hesaplamaz", async () => {
    const inv = server.app.context.invoices;
    const original = inv.allObligations;
    let calls = 0;
    inv.allObligations = (...args) => {
      calls += 1;
      return original(...args);
    };
    try {
      server.app.context.accounts.list({ id: "ledger", role: "admin", permissions: [] }, { status: "all" });
      server.app.context.accounts.list({ id: "integrity", role: "admin", permissions: [] }, { status: "all" });
      const any = server.app.store.get("SELECT id FROM accounts LIMIT 1").id;
      server.app.context.accounts.list({ id: "x", role: "admin", permissions: [] }, { status: "all", ids: [any] });
      assert.equal(calls, 0);
      server.app.context.accounts.list({ id: "x", role: "admin", permissions: [] }, { status: "all" });
      assert.equal(calls, 1, "kullanıcı listesi TYK'yı okur");
    } finally {
      inv.allObligations = original;
    }
  });
});
