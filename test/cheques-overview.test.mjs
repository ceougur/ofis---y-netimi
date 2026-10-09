// Çek / Senet ve ANLIK DURUM (v2.0.7): kural motoru, defter bağları (Cari, Taksit, Kasa), geri al / sil / geri yükle,
// kilitler, yetki, işlem bütünlüğü (kısmi yazmada ROLLBACK), toplu alım kapısı, mizan / ekstre / nakit akışı ve
// karttaki her rakamın ilgili ekranla birebir aynı kaldığını yüzlerce rastgele işlemle kanıtlayan tutarlılık testi.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ACTIONS, mapChequeHeaders, parseDirection, parseInstrument, parseStatus, plannedEffects, portfolioSummary, transition } from "../server/lib/cheques.mjs";
import { presetRange, projection, statement, trialBalance } from "../server/lib/finance-report.mjs";
import { isoDay } from "../server/lib/plans.mjs";
import { tl } from "../server/lib/report-pdf.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = isoDay(new Date());
const shift = days => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.006, `${message}: ${a} ≠ ${b}`);

describe("çek/senet kural motoru (saf)", () => {
  it("durum geçişleri: izinli olanlar geçer, diğerleri okunur nedenle reddedilir", () => {
    assert.deepEqual(transition({ direction: "in", status: "portfolio", instrument: "cheque" }, "collect"), { ok: true, to: "collected", cash: "in" });
    assert.equal(transition({ direction: "in", status: "portfolio" }, "endorse").to, "endorsed");
    assert.equal(transition({ direction: "in", status: "endorsed" }, "bounce").to, "bounced");
    assert.equal(transition({ direction: "out", status: "pending" }, "pay").cash, "out");
    const twice = transition({ direction: "in", status: "collected", instrument: "cheque" }, "collect");
    assert.equal(twice.ok, false);
    assert.match(twice.reason, /Tahsil Edildi/);
    assert.equal(transition({ direction: "out", status: "pending" }, "collect").ok, false, "verilen çek tahsil edilmez");
    assert.equal(transition({ direction: "in", status: "portfolio" }, "pay").ok, false, "alınan çek ödenmez");
    assert.equal(transition({ direction: "in", status: "pending" }, "pay").ok, false, "yön/durum uyuşmazlığı");
    assert.deepEqual(Object.keys(ACTIONS).sort(), ["bounce", "collect", "endorse", "pay"]);
  });
  it("defter etkileri: alınan → cariye alacak ya da taksite tahsilat; ciro → tedarikçiye borç; karşılıksız → geri çevirme", () => {
    const base = { direction: "in", amount: 1000, accountId: "A", planId: "", endorseAccountId: "" };
    assert.deepEqual(plannedEffects(base, "receive", { date: "2026-01-01" }).map(e => [e.type, e.accountId, e.kind]), [["account-entry", "A", "credit"]]);
    assert.deepEqual(plannedEffects({ ...base, planId: "P" }, "receive", { date: "2026-01-01" }).map(e => [e.type, e.planId]), [["plan-entry", "P"]]);
    assert.deepEqual(plannedEffects({ ...base, direction: "out" }, "issue", { date: "2026-01-01" }).map(e => [e.accountId, e.kind]), [["A", "debt"]]);
    assert.deepEqual(plannedEffects(base, "endorse", { date: "2026-01-01", endorseAccountId: "T" }).map(e => [e.accountId, e.kind]), [["T", "debt"]]);
    assert.deepEqual(plannedEffects(base, "collect", { date: "2026-01-01" }), [], "tahsil yalnız Kasa");
    // Karşılıksız: taksite sayılan çekte tahsilat kaldırılır; ciro edilmişse tedarikçiye alacak geri yazılır.
    const bounced = plannedEffects({ ...base, planId: "P", endorseAccountId: "T" }, "bounce", {
      date: "2026-02-01",
      receiveEffects: [{ op: "insert", table: "plan_entries", id: "E1" }],
      endorseEffects: [{ op: "insert", table: "account_entries", id: "X" }],
    });
    assert.deepEqual(bounced.map(e => [e.type, e.id || e.accountId, e.kind || ""]), [["remove-plan-entry", "E1", ""], ["account-entry", "T", "credit"]]);
    assert.deepEqual(plannedEffects(base, "bounce", { date: "2026-02-01" }).map(e => [e.accountId, e.kind]), [["A", "debt"]]);
    assert.deepEqual(plannedEffects({ ...base, accountId: "" }, "receive", { date: "2026-01-01" }), [], "carisiz çek cariye yazılmaz");
  });
  it("portföy özeti vadeye göre (geçmiş / bugün / 7 gün)", () => {
    const summary = portfolioSummary(
      [
        { direction: "in", status: "portfolio", amount: 100, dueDate: shift(-3) },
        { direction: "in", status: "portfolio", amount: 200, dueDate: TODAY },
        { direction: "in", status: "portfolio", amount: 300, dueDate: shift(5) },
        { direction: "in", status: "portfolio", amount: 400, dueDate: shift(40) },
        { direction: "in", status: "collected", amount: 50, dueDate: shift(-40) },
        { direction: "out", status: "pending", amount: 700, dueDate: shift(2) },
        { direction: "out", status: "paid", amount: 70, dueDate: shift(-2) },
        { direction: "in", status: "endorsed", amount: 80, dueDate: shift(9) },
      ],
      TODAY,
    );
    assert.deepEqual([summary.in.open.amount, summary.in.overdue.amount, summary.in.today.amount, summary.in.soon.amount], [1000, 100, 200, 300]);
    assert.deepEqual([summary.out.open.amount, summary.out.soon.count, summary.collected.amount, summary.paid.amount, summary.endorsed.amount], [700, 1, 50, 70, 80]);
  });
  it("Excel başlıkları ve hücre değerleri", () => {
    const roles = mapChequeHeaders(["Çek No", "Banka / Şube", "Keşideci", "Tutar (TL)", "Vade Tarihi", "Alış Tarihi", "Durum", "Açıklama", "Plasiyer"]);
    assert.deepEqual(Object.values(roles), ["serial", "bank", "drawer", "amount", "due", "issue", "status", "note", "extra"]);
    assert.equal(parseDirection("Verilen"), "out");
    assert.equal(parseDirection("Müşteri çeki"), "in");
    assert.equal(parseInstrument("Senet"), "note");
    assert.equal(parseInstrument("ÇEK"), "cheque");
    assert.equal(parseStatus("Portföyde"), "open");
    assert.equal(parseStatus("Tahsil edildi"), "closed");
    assert.equal(parseStatus("Karşılıksız"), "bounced");
    assert.equal(parseStatus(""), "");
  });
});

describe("rapor motoru (saf): mizan, ekstre, nakit akışı", () => {
  const lines = new Map([
    ["a", [{ date: "2026-08-10", debit: 1000, credit: 0 }, { date: "2026-09-05", debit: 0, credit: 400 }, { date: "2026-09-20", debit: 250, credit: 0 }, { date: "2026-10-02", debit: 0, credit: 100 }]],
    ["b", [{ date: "2026-09-12", debit: 0, credit: 900 }]],
    ["c", []],
  ]);
  const accounts = [{ id: "a", name: "Ahmet" }, { id: "b", name: "Tedarik A.Ş." }, { id: "c", name: "Boş" }];
  it("mizan: devir + dönem borç/alacak = bakiye; hareketsiz cari istenmezse yazılmaz", () => {
    const { rows, totals } = trialBalance(accounts, lines, { from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual(rows.map(r => [r.id, r.opening, r.debit, r.credit, r.closing, r.side]), [["a", 1000, 250, 400, 850, "debtor"], ["b", 0, 0, 900, -900, "creditor"]]);
    assert.deepEqual([totals.closingDebtor, totals.closingCreditor, totals.count], [850, 900, 2]);
    assert.equal(trialBalance(accounts, lines, { from: "2026-09-01", to: "2026-09-30", includeIdle: true }).rows.length, 3);
    // Aralıksız mizan (tüm zaman) = carinin güncel bakiyesi.
    assert.equal(trialBalance(accounts, lines, {}).rows.find(r => r.id === "a").closing, 750);
  });
  it("ekstre: devir satırı ve yürüyen bakiye", () => {
    const result = statement(lines.get("a"), { from: "2026-09-01", to: "2026-09-30" });
    assert.equal(result.opening, 1000);
    assert.deepEqual(result.lines.map(l => l.balance), [600, 850]);
    assert.deepEqual([result.debit, result.credit, result.closing, result.side], [250, 400, 850, "debtor"]);
  });
  it("nakit akışı: gecikmişler ayrı, aynı gün önce çıkış, en düşük bakiye, başlangıç bugünden sonraysa aradakiler taşınır", () => {
    const flows = [
      { date: "2026-09-25", direction: "in", amount: 500, source: "plan", label: "1. taksit" },
      { date: "2026-10-01", direction: "in", amount: 300, source: "cheque", label: "Alınan çek" },
      { date: "2026-10-01", direction: "out", amount: 1200, source: "cheque", label: "Verilen çek" },
      { date: "2026-10-05", direction: "in", amount: 1000, source: "plan", label: "2. taksit" },
      { date: "2026-12-01", direction: "in", amount: 999, source: "plan", label: "Uzak" },
    ];
    const result = projection({ today: "2026-09-28", from: "2026-09-28", to: "2026-10-31", cashToday: 1000, flows });
    assert.deepEqual(result.overdue.map(r => r.amount), [500]);
    assert.deepEqual(result.rows.map(r => [r.direction, r.balance]), [["out", -200], ["in", 100], ["in", 1100]]);
    assert.deepEqual(result.lowest, { balance: -200, date: "2026-10-01" });
    assert.equal(result.negative, true);
    assert.deepEqual([result.totals.in, result.totals.out, result.closing], [1300, 1200, 1100]);
    const withOverdue = projection({ today: "2026-09-28", to: "2026-10-31", cashToday: 1000, flows, includeOverdue: true });
    assert.equal(withOverdue.opening, 1500);
    const later = projection({ today: "2026-09-28", from: "2026-10-03", to: "2026-10-31", cashToday: 1000, flows });
    assert.deepEqual([later.carried.in, later.carried.out, later.opening, later.rows.length], [300, 1200, 100, 1]);
  });
  it("hazır aralıklar takvim günüyle (ay sonu, artık yıl, yıl dönümü)", () => {
    assert.deepEqual(presetRange("thisMonth", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
    assert.deepEqual(presetRange("lastMonth", "2027-01-15"), { from: "2026-12-01", to: "2026-12-31" });
    assert.deepEqual(presetRange("next30", "2026-12-15"), { from: "2026-12-15", to: "2027-01-14" });
    assert.equal(presetRange("x", TODAY), null);
  });
});

describe("çek/senet: Cari, Taksit ve Kasa ile işlem bütünlüğü", () => {
  let server;
  let admin;
  let customer;
  let supplier;
  // v2.0.17: Kasa penceresi yalnız nakit; çek tahsili bankaya da düşebilir → "tüm para" (nakit + banka) için method=all.
  const cashBalance = async () => (await admin.get("/api/workspace/cash?method=all")).data.data.totals.balance;
  const balanceOf = async id => (await admin.get(`/api/workspace/accounts/${id}`)).data.data.totals.balance;
  const overview = async () => (await admin.get("/api/workspace/overview")).data.data;
  const createCheque = async body => {
    const response = await admin.post("/api/workspace/cheques", { instrument: "cheque", issueDate: TODAY, dueDate: shift(30), ...body });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.data;
  };
  const act = async (cheque, action, extra = {}) => {
    const response = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: TODAY, status: cheque.status, ...extra });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.data;
  };
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    customer = (await admin.post("/api/workspace/accounts", { name: "Ahmet Müşteri", type: "customer" })).data.data;
    supplier = (await admin.post("/api/workspace/accounts", { name: "Yağ Tedarik Ltd.", type: "supplier" })).data.data;
    await admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: 10000, date: TODAY, note: "Satış" });
    await admin.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "credit", amount: 8000, date: TODAY, note: "Alım" });
  });
  after(() => server.close());

  it("alınan çek: carinin borcu düşer, Kasa değişmez; toplam alacak değişmez (cariden portföye geçer)", async () => {
    const cash0 = await cashBalance();
    const view0 = await overview();
    const cheque = await createCheque({ direction: "in", accountId: customer.id, amount: 4000, serialNo: "A-100", bank: "Ziraat Meram" });
    assert.equal(cheque.status, "portfolio");
    assert.equal(await balanceOf(customer.id), 6000);
    assert.equal(await cashBalance(), cash0, "çek alınınca Kasa değişmez");
    const view1 = await overview();
    near(view1.receivable.total, view0.receivable.total, "toplam alacak korunur");
    near(view1.receivable.cheques, view0.receivable.cheques + 4000, "portföy artar");
    near(view1.receivable.accounts, view0.receivable.accounts - 4000, "cari alacağı düşer");
    const ledger = (await admin.get(`/api/workspace/accounts/${customer.id}`)).data.data;
    const line = ledger.entries.find(entry => entry.source === "cheque");
    assert.ok(line && line.editable === false, "çekten gelen cari satırı kilitli");
    assert.equal((await admin.del(`/api/workspace/accounts/${customer.id}/entries/${line.id}`)).status, 409);
  });

  it("tahsil: Kasa artar, cari değişmez; geri al: Kasa eski haline döner", async () => {
    const cheque = await createCheque({ direction: "in", accountId: customer.id, amount: 1500, serialNo: "A-101" });
    const cash0 = await cashBalance();
    const collected = await act(cheque, "collect");
    assert.equal(collected.status, "collected");
    assert.equal(await cashBalance(), cash0 + 1500);
    const kasa = (await admin.get("/api/workspace/cash?method=all")).data.data.entries.find(entry => entry.source === "cheque" && entry.amount === 1500);
    assert.ok(kasa && kasa.editable === false && /tahsili/.test(kasa.description));
    const again = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY });
    assert.equal(again.status, 409, "iki kez tahsil edilemez");
    const stale = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: TODAY, status: "portfolio" });
    assert.equal(stale.status, 409, "bayat durumla işlem reddedilir");
    const undone = (await admin.post(`/api/workspace/cheques/${cheque.id}/undo`, {})).data.data;
    assert.equal(undone.status, "portfolio");
    assert.equal(await cashBalance(), cash0);
    assert.equal((await admin.post(`/api/workspace/cheques/${cheque.id}/undo`, {})).status, 409, "ilk olay geri alınmaz");
  });

  it("ciro → tedarikçi borcu düşer; karşılıksız → müşteri yeniden borçlanır, ciro geri alınır; geri al hepsini çevirir", async () => {
    const cheque = await createCheque({ direction: "in", accountId: customer.id, amount: 3000, serialNo: "A-102" });
    const c0 = await balanceOf(customer.id);
    const s0 = await balanceOf(supplier.id);
    const self = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "endorse", date: TODAY, accountId: customer.id });
    assert.equal(self.status, 400, "alındığı cariye ciro edilmez");
    const endorsed = await act(cheque, "endorse", { accountId: supplier.id });
    assert.equal(endorsed.status, "endorsed");
    assert.equal(await balanceOf(supplier.id), s0 + 3000, "tedarikçiye borcumuz 3.000 azaldı");
    const bounced = await act(endorsed, "bounce");
    assert.equal(bounced.status, "bounced");
    assert.equal(await balanceOf(customer.id), c0 + 3000, "müşteri yeniden borçlu");
    assert.equal(await balanceOf(supplier.id), s0, "tedarikçiye borç geri geldi");
    await admin.post(`/api/workspace/cheques/${cheque.id}/undo`, {});
    assert.equal(await balanceOf(customer.id), c0);
    assert.equal(await balanceOf(supplier.id), s0 + 3000);
    await admin.post(`/api/workspace/cheques/${cheque.id}/undo`, {});
    assert.equal(await balanceOf(supplier.id), s0);
    assert.equal((await admin.get(`/api/workspace/cheques/${cheque.id}`)).data.data.status, "portfolio");
  });

  it("verilen çek: tedarikçi borcu düşer, toplam borç korunur; ödenince Kasa'dan çıkar ve borç kapanır", async () => {
    const view0 = await overview();
    const s0 = await balanceOf(supplier.id);
    const cheque = await createCheque({ direction: "out", accountId: supplier.id, amount: 2500, serialNo: "K-1", bank: "Kendi hesabımız" });
    assert.equal(cheque.status, "pending");
    assert.equal(await balanceOf(supplier.id), s0 + 2500);
    const view1 = await overview();
    near(view1.payable.total, view0.payable.total, "toplam borç korunur (cariden ödenecek çeke geçer)");
    near(view1.payable.cheques, view0.payable.cheques + 2500, "ödenecek çek artar");
    const cash0 = await cashBalance();
    // v2.0.17: banka/POS için eksi bakiye denetimi yok (Banka modülü gelene kadar) → bankadan ödeme sormadan yazılır;
    // nakit ödemede nakit kasa yetmiyorsa sorulur, onayla ödenir.
    const nakit0 = (await overview()).cash.balance;
    const short = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", date: TODAY, status: cheque.status, method: "cash" });
    assert.equal(short.status, 409, JSON.stringify(short.data));
    assert.equal(short.data.code, "cash-negative");
    assert.equal(short.data.method, "cash");
    await act(cheque, "pay", { cashForce: true, method: "cash" });
    assert.equal(await cashBalance(), cash0 - 2500);
    const view2 = await overview();
    near(view2.payable.total, view0.payable.total - 2500, "ödenince borç azalır");
    near(view2.cash.balance, nakit0 - 2500, "kart Nakit Kasa ile aynı");
    // Bankadan ödenen verilen çek: soru yok, banka tarafı düşer.
    const cheque2 = await createCheque({ direction: "out", accountId: supplier.id, amount: 700, serialNo: "K-2", bank: "Kendi hesabımız" });
    const bank0 = (await admin.get("/api/workspace/cash?method=all")).data.data.byMethod.bank;
    await act(cheque2, "pay", { method: "bank" });
    assert.equal((await admin.get("/api/workspace/cash?method=all")).data.data.byMethod.bank, bank0 - 700, "banka tarafı sormadan düştü");
    assert.equal((await overview()).cash.balance, nakit0 - 2500, "nakit kasa değişmedi");
  });

  it("taksite sayılan çek: taksit ödenmiş olur, Kasa değişmez; karşılıksız taksiti yeniden açar; kart silinemez, tahsilat karttan düzeltilemez", async () => {
    const plan = (await admin.post("/api/workspace/plans", { registeredOn: "2026-01-01", name: "Veli Yılmaz", total: 6000, count: 3, firstDue: shift(-20), everyMonths: 1 })).data.data;
    const first = plan.items[0];
    const cash0 = await cashBalance();
    const cheque = await createCheque({ direction: "in", planId: plan.id, itemId: first.id, amount: 2000, serialNo: "T-1", dueDate: shift(45) });
    assert.equal(cheque.accountId, plan.accountId, "cari karttan gelir");
    const paid = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    assert.equal(paid.items[0].state, "paid");
    assert.equal(paid.totals.overdue, 0);
    const entry = paid.entries.find(item => item.chequeId === cheque.id);
    assert.ok(entry && entry.editable === false);
    assert.equal(await cashBalance(), cash0, "çekle tahsilat Kasa'ya girmez");
    assert.equal((await admin.put(`/api/workspace/plans/${plan.id}/entries/${entry.id}`, { amount: 1 })).status, 409);
    assert.equal((await admin.del(`/api/workspace/plans/${plan.id}/entries/${entry.id}`)).status, 409);
    assert.equal((await admin.del(`/api/workspace/plans/${plan.id}`)).status, 409, "çek bağlı kart silinmez");
    assert.equal((await admin.del(`/api/workspace/accounts/${plan.accountId}`)).status, 409, "çek bağlı cari silinmez");
    await act(cheque, "bounce");
    const reopened = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    assert.equal(reopened.items[0].state, "overdue", "karşılıksız çek taksiti yeniden açar");
    assert.ok(!reopened.entries.some(item => item.chequeId === cheque.id));
    await admin.post(`/api/workspace/cheques/${cheque.id}/undo`, {});
    const restored = (await admin.get(`/api/workspace/plans/${plan.id}`)).data.data;
    assert.equal(restored.entries.find(item => item.chequeId === cheque.id)?.id, entry.id, "geri alınca aynı tahsilat aynı kimlikle döner");
    // Tahsil: Kasa'ya o zaman girer.
    await act({ ...cheque, status: "portfolio" }, "collect");
    assert.equal(await cashBalance(), cash0 + 2000);
  });

  it("silme etkileri geri alır; Silinenler'den geri yükleme yeniden yazar; işlem görmüş evrak silinmez", async () => {
    const b0 = await balanceOf(customer.id);
    const cheque = await createCheque({ direction: "in", accountId: customer.id, amount: 700, serialNo: "D-1" });
    assert.equal(await balanceOf(customer.id), b0 - 700);
    assert.equal((await admin.del(`/api/workspace/cheques/${cheque.id}`)).status, 200);
    assert.equal(await balanceOf(customer.id), b0);
    assert.equal((await admin.get(`/api/workspace/cheques/${cheque.id}`)).status, 404);
    const item = (await admin.get("/api/admin/trash")).data.data.find(entry => entry.id === `cheque:${cheque.id}`);
    assert.ok(item);
    assert.equal((await admin.post("/api/admin/trash/restore", { id: item.id })).status, 200);
    assert.equal(await balanceOf(customer.id), b0 - 700);
    const worked = await createCheque({ direction: "in", accountId: customer.id, amount: 50, serialNo: "D-2" });
    await act(worked, "collect");
    assert.equal((await admin.del(`/api/workspace/cheques/${worked.id}`)).status, 409);
  });

  it("doğrulama: tutar, tarih, kişi, çift seri no, işlem tarihi; personel çek göremez", async () => {
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "in", drawer: "X", amount: 0, dueDate: shift(3) })).status, 400);
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "in", drawer: "X", amount: 10, dueDate: "2026-02-30" })).status, 400, "olmayan gün");
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "in", amount: 10, dueDate: shift(3) })).status, 400, "kimden alındığı yok");
    assert.equal((await admin.post("/api/workspace/cheques", { direction: "sideways", drawer: "X", amount: 10, dueDate: shift(3) })).status, 400);
    const dup = await admin.post("/api/workspace/cheques", { direction: "in", drawer: "Başka", amount: 10, dueDate: shift(3), serialNo: "A-100", bank: "Ziraat Meram" });
    assert.equal(dup.status, 409);
    assert.equal(dup.data.code, "cheque-duplicate");
    const early = await createCheque({ direction: "in", drawer: "Nakit Müşteri", amount: 90, issueDate: TODAY });
    assert.equal((await admin.post(`/api/workspace/cheques/${early.id}/actions`, { action: "collect", date: shift(-5) })).status, 400, "alıştan önce tahsil edilemez");
    const staff = await createUser(server, admin, { username: "cekpersonel", role: "personel" });
    assert.equal((await staff.get("/api/workspace/cheques")).status, 403);
    assert.equal((await staff.get("/api/workspace/overview")).status, 403);
    const dues = (await staff.get("/api/workspace/dues")).data.data;
    assert.ok(!dues.items.some(item => item.source === "cheque"), "personel çek bildirimini görmez");
    const adminDues = (await admin.get("/api/workspace/dues")).data.data;
    assert.ok(adminDues.items.every(item => item.source !== "cheque" || item.days <= 7));
  });

  it("kısmi yazma geri alınır (ROLLBACK): ikinci etki başarısız olursa ilk etki de yazılmaz", async () => {
    const other = (await admin.post("/api/workspace/accounts", { name: "Geçici Tedarikçi", type: "supplier" })).data.data;
    const cheque = await createCheque({ direction: "in", accountId: customer.id, amount: 1234, serialNo: "R-1" });
    const endorsed = await act(cheque, "endorse", { accountId: other.id });
    // Ciro edilen cari arka planda silinmiş olsun (ör. eski sürümden kalan veri): karşılıksız işleminin ikinci etkisi
    // (tedarikçiye alacak) yazılamaz; ilk etki (müşteriye borç) de geri alınmalı, durum değişmemeli.
    // Doğrudan veritabanına (mutabakat kapısının dışından) yazılır: eski sürümden kalmış bozuk veriyi taklit eder.
    server.app.store.db.prepare("UPDATE accounts SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), other.id);
    const before = await balanceOf(customer.id);
    const eventsBefore = (await admin.get(`/api/workspace/cheques/${cheque.id}`)).data.data.events.length;
    const response = await admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: TODAY, status: endorsed.status });
    assert.equal(response.status, 409);
    assert.equal(await balanceOf(customer.id), before, "müşteriye yazılan borç geri alındı");
    const after = (await admin.get(`/api/workspace/cheques/${cheque.id}`)).data.data;
    assert.equal(after.status, "endorsed");
    assert.equal(after.events.length, eventsBefore);
    server.app.store.db.prepare("UPDATE accounts SET deleted_at = NULL WHERE id = ?").run(other.id);
  });

  it("Excel/Sheets'ten portföy: kapı raporu; varsayılan carilere dokunmaz, 'carilere işle' ile yazar; kapanmış ve çift satır alınmaz", async () => {
    const matrix = [
      ["Çek Listesi", "", "", "", "", ""],
      ["Çek No", "Banka", "Keşideci", "Tutar", "Vade", "Durum"],
      ["X-1", "Halkbank", "Ahmet Müşteri", "1.250,50", "15.11.2026", "Portföyde"],
      ["X-2", "Halkbank", "Bilinmeyen Firma", "2000", "2026-12-01", ""],
      ["X-3", "Vakıf", "Ahmet Müşteri", "900", "01.10.2026", "Tahsil edildi"],
      ["X-1", "Halkbank", "Ahmet Müşteri", "1.250,50", "15.11.2026", ""],
      ["", "", "", "", "", ""],
      ["X-4", "", "", "abc", "", ""],
    ];
    const preview = (await admin.post("/api/workspace/cheques/import/preview", { matrix })).data.data;
    assert.equal(preview.headerAt, 1, "üstteki başlık satırı atlanır");
    assert.equal(preview.gate.ready, 2);
    assert.equal(preview.gate.empty, 1);
    const b0 = await balanceOf(customer.id);
    const done = (await admin.post("/api/workspace/cheques/import", { matrix, headerAt: preview.headerAt, roles: preview.roles })).data.data;
    assert.equal(done.created, 2);
    assert.equal(done.linked, 1, "adı birebir aynı tek cariye bağlanır");
    assert.equal(done.posted, 0);
    assert.equal(done.closed, 1);
    assert.equal(await balanceOf(customer.id), b0, "açılış portföyü cari bakiyesini değiştirmez");
    const matrix2 = [["Çek No", "Keşideci", "Tutar", "Vade"], ["Y-1", "Ahmet Müşteri", "500", "20.11.2026"]];
    const preview2 = (await admin.post("/api/workspace/cheques/import/preview", { matrix: matrix2 })).data.data;
    const posted = (await admin.post("/api/workspace/cheques/import", { matrix: matrix2, headerAt: 0, roles: preview2.roles, post: true })).data.data;
    assert.equal(posted.posted, 1);
    assert.equal(await balanceOf(customer.id), b0 - 500);
    const again = (await admin.post("/api/workspace/cheques/import", { matrix: matrix2, headerAt: 0, roles: preview2.roles })).data.data;
    assert.equal(again.created, 0, "ikinci yükleme çift açmaz");
  });

  it("PDF ve Excel çıktıları: portföy, mizan, ekstre, nakit akışı", async () => {
    for (const url of ["/api/workspace/cheques/liste.pdf?direction=in", "/api/workspace/overview/mizan.pdf?preset=thisYear", `/api/workspace/overview/ekstre.pdf?account=${customer.id}&preset=thisYear`, "/api/workspace/overview/nakit-akisi.pdf?preset=next90&overdue=1"]) {
      const response = await admin.raw("GET", url);
      assert.equal(response.status, 200, url);
      assert.equal(response.buffer.subarray(0, 5).toString(), "%PDF-", url);
    }
    for (const url of ["/api/workspace/cheques/export.xlsx", "/api/workspace/overview/mizan.xlsx?preset=thisYear", `/api/workspace/overview/ekstre.xlsx?account=${customer.id}&preset=thisYear`, "/api/workspace/overview/nakit-akisi.xlsx?preset=next30"]) {
      const response = await admin.raw("GET", url);
      assert.equal(response.status, 200, url);
      assert.equal(response.buffer.subarray(0, 2).toString(), "PK", url);
    }
    assert.equal((await admin.get("/api/workspace/overview/mizan?from=2026-10-01&to=2026-09-01")).status, 400);
    assert.equal((await admin.get("/api/workspace/overview/mizan?from=2026-13-01&to=2026-12-01")).status, 400);
  });
});

describe("ANLIK DURUM: karttaki rakamlar ekranlarla birebir aynı (rastgele 400 işlem)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Kasa, alacak, borç, kritik stok, mizan ve nakit akışı her adımda tutarlı", async () => {
    let seed = 20260928;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = list => list[Math.floor(random() * list.length)];
    const amount = () => Math.round((50 + random() * 5000) * 100) / 100;
    const day = () => shift(Math.floor(random() * 90) - 60);
    const accounts = [];
    for (let i = 0; i < 6; i += 1) accounts.push((await admin.post("/api/workspace/accounts", { name: `Cari ${i}`, type: i < 3 ? "customer" : "supplier" })).data.data.id);
    const items = [];
    for (let i = 0; i < 4; i += 1) items.push((await admin.post("/api/workspace/stock", { name: `Ürün ${i}`, unit: "adet", minQty: 5, unitPrice: 10, openingQty: 8 })).data.data.id);
    items.push((await admin.post("/api/workspace/stock", { name: "Servis hizmeti", unit: "saat", kind: "service", unitPrice: 300 })).data.data.id);
    const plans = [];
    const cheques = [];
    const check = async label => {
      const view = (await admin.get("/api/workspace/overview")).data.data;
      const cash = (await admin.get("/api/workspace/cash")).data.data;
      const list = (await admin.get("/api/workspace/accounts?status=all&limit=5000")).data.data;
      const stock = (await admin.get("/api/workspace/stock")).data.data;
      const portfolio = (await admin.get("/api/workspace/cheques?limit=5000")).data.data;
      const today = new Date().toISOString().slice(0, 10);
      const cashToday = cash.entries.filter(entry => entry.date <= today).reduce((sum, entry) => sum + (entry.kind === "in" ? entry.amount : -entry.amount), 0);
      near(view.cash.balance, cashToday, `${label}: Kasa (bugüne kadar)`);
      near(view.cash.allEntries, cash.totals.balance, `${label}: Kasa (tüm hareketler)`);
      near(view.receivable.accounts, list.totals.debtor, `${label}: cari alacak`);
      near(view.payable.accounts, list.totals.creditor, `${label}: cari borç`);
      near(view.receivable.cheques, portfolio.summary.in.open.amount, `${label}: portföy`);
      near(view.payable.cheques, portfolio.summary.out.open.amount, `${label}: ödenecek çek`);
      near(view.receivable.total, list.totals.debtor + portfolio.summary.in.open.amount, `${label}: toplam alacak`);
      near(view.payable.total, list.totals.creditor + portfolio.summary.out.open.amount, `${label}: toplam borç`);
      assert.equal(view.stock.critical, stock.totals.low, `${label}: kritik stok`);
      // Tüm zamanlı mizan = Cari listesi (cari cari).
      const mizan = (await admin.get("/api/workspace/overview/mizan?from=2000-01-01&to=2099-12-31&idle=1&limit=5000")).data.data;
      near(mizan.totals.closingDebtor, list.totals.debtor, `${label}: mizan alacak`);
      near(mizan.totals.closingCreditor, list.totals.creditor, `${label}: mizan borç`);
      for (const account of list.accounts) near(mizan.rows.find(row => row.id === account.id)?.closing ?? 0, account.balance, `${label}: ${account.name} mizan bakiyesi`);
      // Nakit akışı: çok uzun aralığın sonu = bugünkü kasa + ileri tarihli Kasa + açık taksitler + portföy − ödenecek (gecikmişler dahil).
      const flow = (await admin.get("/api/workspace/overview/nakit-akisi?from=" + TODAY + "&to=2099-12-31&overdue=1")).data.data;
      const openPlans = (await admin.get("/api/workspace/plans?status=active")).data.data;
      const planRemaining = (openPlans.plans || []).reduce((sum, plan) => sum + Math.max(0, plan.totals?.remaining ?? 0), 0);
      // Nakit akışı tüm parayla (nakit + banka/POS) başlar; Kasa penceresi yalnız nakit (v2.0.17).
      const allMoney = (await admin.get("/api/workspace/cash?method=all")).data.data;
      near(flow.closing, allMoney.totals.balance + planRemaining + portfolio.summary.in.open.amount - portfolio.summary.out.open.amount, `${label}: nakit akışı sonu`);
    };
    for (let step = 1; step <= 400; step += 1) {
      const op = pick(["cash", "cash", "debt", "credit", "collect", "pay", "plan", "planPay", "stock", "stockCash", "chequeIn", "chequeIn", "chequeOut", "chequeAct", "chequeAct", "undo", "delete"]);
      const account = pick(accounts);
      if (op === "cash") await admin.post("/api/workspace/cash", { kind: pick(["in", "out"]), amount: amount(), date: shift(Math.floor(random() * 20) - 10), description: `Kasa ${step}` });
      else if (["debt", "credit", "collect", "pay"].includes(op)) await admin.post(`/api/workspace/accounts/${account}/entries`, { kind: { debt: "debt", credit: "credit", collect: "in", pay: "out" }[op], amount: amount(), date: day() });
      else if (op === "plan" && plans.length < 8) {
        const plan = (await admin.post("/api/workspace/plans", { name: `Taksitli ${step}`, registeredOn: "2026-01-01", accountId: pick(accounts.slice(0, 3)), total: 3000, count: 3, firstDue: day() })).data.data;
        plans.push(plan);
      } else if (op === "planPay" && plans.length) {
        const plan = pick(plans);
        await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: Math.round(random() * 1500), date: day() });
      } else if (op === "stock") await admin.post(`/api/workspace/stock/${pick(items)}/moves`, { kind: pick(["in", "out"]), qty: 1 + Math.floor(random() * 4), force: true });
      else if (op === "stockCash") await admin.post(`/api/workspace/stock/${pick(items)}/moves`, { kind: pick(["in", "out"]), qty: 1, unitPrice: amount(), pay: "cash", force: true });
      else if (op === "chequeIn" || op === "chequeOut") {
        const direction = op === "chequeIn" ? "in" : "out";
        const usePlan = direction === "in" && plans.length && random() < 0.3;
        const body = { direction, instrument: pick(["cheque", "note"]), amount: amount(), issueDate: shift(-Math.floor(random() * 30)), dueDate: shift(Math.floor(random() * 120) - 30), serialNo: `S${step}` };
        if (usePlan) body.planId = pick(plans).id;
        else if (random() < 0.8) body.accountId = direction === "in" ? pick(accounts.slice(0, 3)) : pick(accounts.slice(3));
        else body.drawer = "Carisiz kişi";
        const created = await admin.post("/api/workspace/cheques", body);
        if (created.status === 200) cheques.push(created.data.data.id);
      } else if (op === "chequeAct" && cheques.length) {
        const current = (await admin.get(`/api/workspace/cheques/${pick(cheques)}`)).data.data;
        if (current?.actions?.length) {
          const action = pick(current.actions).key;
          await admin.post(`/api/workspace/cheques/${current.id}/actions`, { action, date: current.issueDate > TODAY ? current.issueDate : TODAY, status: current.status, accountId: action === "endorse" ? pick(accounts.slice(3)) : "" });
        }
      } else if (op === "undo" && cheques.length) await admin.post(`/api/workspace/cheques/${pick(cheques)}/undo`, {});
      else if (op === "delete" && cheques.length) await admin.del(`/api/workspace/cheques/${pick(cheques)}`);
      if (step % 50 === 0) await check(`adım ${step}`);
    }
    await check("son");
  });

  it("para ya da stok değişince herkese (işlemi yapan dahil) tek 'overview.changed' olayı gider", async () => {
    const controller = new AbortController();
    const response = await fetch(`${server.base}/api/events`, { headers: { cookie: admin.cookie, accept: "text/event-stream" }, signal: controller.signal });
    const reader = response.body.getReader();
    let text = "";
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += new TextDecoder().decode(value);
        }
      } catch {
        // akış kapatıldı
      }
    })();
    const wait = async (pattern, ms = 5000) => {
      const deadline = Date.now() + ms;
      while (!pattern.test(text) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    };
    await wait(/event: hello/);
    await admin.post("/api/workspace/cash", { kind: "in", amount: 10, date: TODAY, description: "Canlı deneme" });
    await wait(/event: overview\.changed/);
    controller.abort();
    await pump;
    // Olaylar 250 ms içinde birleştirilir: tür listesinde "cash" bulunmalı.
    assert.match(text, /event: overview\.changed\ndata: \{"kinds":\[[^\]]*"cash"/, "işlemi yapan kişinin kendi ekranı da tazelenir");
  });

  // v2.0.10: ANLIK DURUM kartı yalnız yönetici ekranındadır (müşteri kararı). Kişiye verilen "finans raporları"
  // yetkisi (overview.view; v2.0.7'de "ANLIK DURUM ve raporlar") yalnız Raporlar penceresini açar.
  it("kart yalnız yöneticide; kişiye verilen finans raporları yetkisi raporları açar, kartı açmaz; geri alınınca kapanır", async () => {
    const lawyer = await createUser(server, admin, { username: "avukat1", role: "avukat" });
    const staff = await createUser(server, admin, { username: "personel1", role: "personel" });
    assert.equal((await admin.get("/api/workspace/overview")).status, 200, "yönetici kartı görür");
    assert.equal((await lawyer.get("/api/workspace/overview")).status, 403, "rol tek başına yetmez");
    assert.equal((await staff.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 403);
    const users = (await admin.get("/api/admin/users")).data.data;
    const target = users.find(user => user.username === "personel1");
    assert.deepEqual(target.grants, { add: [], remove: [] });
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: ["users.manage"] })).status, 400, "yönetime özgü yetki verilemez");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: ["overview.card"] })).status, 400, "ANLIK DURUM kartı verilemez");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: ["overview.view"] })).status, 200, "v2.0.7 dizi biçimi hâlâ kabul edilir");
    const me = (await staff.get("/api/auth/me")).data.data;
    assert.ok(me.permissions.includes("overview.view") && !me.permissions.includes("overview.card"));
    assert.equal((await staff.get("/api/workspace/overview")).status, 403, "ek yetki kartı açmaz");
    assert.equal((await staff.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 200, "raporlar açılır");
    assert.equal((await staff.raw("GET", "/api/workspace/overview/nakit-akisi.pdf?preset=next30")).status, 200);
    assert.equal((await staff.get("/api/workspace/cash")).status, 403, "ek yetki Kasa ekranını açmaz");
    await admin.patch(`/api/admin/users/${target.id}`, { grants: [] });
    assert.equal((await staff.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 403);
  });
});

describe("rapor merkezi: programdaki her bilgi ön izleme, PDF ve Excel olarak alınır", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const header = ["S.N", "AD SOYAD", "TELEFON", "SERVİS ÜCRETİ"];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Servis.xlsx", sheets: [{ name: "ÖĞRENCİLER", matrix: [header, ["1", "Ali Veli", "0532 111 22 33", "9.000"], ["2", "Ayşe Kara", "0533 222 33 44", "12.000"]] }] });
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    const customer = (await admin.post("/api/workspace/accounts", { name: "Rapor Müşteri", type: "customer" })).data.data;
    await admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: 5000, date: TODAY });
    await admin.post("/api/workspace/plans", { registeredOn: "2026-01-01", name: "Rapor Taksit", accountId: customer.id, total: 3000, count: 3, firstDue: shift(-40) });
    await admin.post("/api/workspace/cheques", { direction: "in", accountId: customer.id, amount: 1500, issueDate: TODAY, dueDate: shift(-5), serialNo: "RP-1" });
    await admin.post("/api/workspace/cash", { kind: "out", amount: 250, date: TODAY, description: "Kırtasiye" });
    const item = (await admin.post("/api/workspace/stock", { name: "Toner", unit: "adet", minQty: 2, unitPrice: 900, openingQty: 1 })).data.data;
    await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: 2, unitPrice: 900, pay: "cash" });
    await admin.post("/api/workspace/tasks", { title: "Veliyi ara", assignee: "admin", dueDate: shift(2), priority: "normal" }).catch(() => null);
  });
  after(() => server.close());

  it("katalogdaki her rapor çalışır; PDF ve Excel üretilir; yetkisiz kişi göremez", async () => {
    const catalog = (await admin.get("/api/workspace/report-center")).data.data;
    assert.ok(catalog.reports.length >= 20, `rapor sayısı ${catalog.reports.length}`);
    const account = (await admin.get("/api/workspace/accounts?status=all")).data.data.accounts[0].id;
    for (const report of catalog.reports) {
      const query = new URLSearchParams(report.params.includes("account") ? { account } : {});
      const preview = await admin.get(`/api/workspace/report-center/${report.id}?${query}`);
      assert.equal(preview.status, 200, `${report.id}: ${JSON.stringify(preview.data).slice(0, 200)}`);
      assert.ok(Array.isArray(preview.data.data.headers) && preview.data.data.headers.length, report.id);
      const pdf = await admin.raw("GET", `/api/workspace/report-center/${report.id}/pdf?${query}`);
      assert.equal(pdf.buffer.subarray(0, 5).toString(), "%PDF-", `${report.id} pdf`);
      const xlsx = await admin.raw("GET", `/api/workspace/report-center/${report.id}/xlsx?${query}`);
      assert.equal(xlsx.buffer.subarray(0, 2).toString(), "PK", `${report.id} xlsx`);
    }
    // Rakamlar modülle aynı: Kasa raporunun güncel kasası = Kasa ekranı; yaşlandırmanın gecikmiş toplamı taksit + çek.
    const kasa = (await admin.get("/api/workspace/report-center/kasa-hareketleri?preset=thisYear")).data.data;
    const cash = (await admin.get("/api/workspace/cash")).data.data;
    assert.equal(kasa.summary.find(([label]) => label.startsWith("Güncel Kasa"))[1], tl(cash.totals.balance));
    const aging = (await admin.get("/api/workspace/report-center/alacak-yaslandirma")).data.data;
    assert.ok(aging.rows.length >= 1);
    const table = (await admin.get("/api/workspace/report-center/tablo-verisi")).data.data;
    assert.equal(table.total, 2);
    assert.ok(table.headers.includes("AD SOYAD"));
    assert.equal((await admin.get("/api/workspace/report-center/yok")).status, 404);
    const staff = await createUser(server, admin, { username: "raporsuz", role: "muhasebe" });
    // v2.1.0 Aşama 14 (bilerek güncellendi): muhasebe Banka Raporları yetkisiyle (bank.reports, plan §9.1) yalnız Banka grubunu görür; finans
    // raporları (overview.view) kapalı kalır.
    const staffCatalog = (await staff.get("/api/workspace/report-center")).data.data;
    assert.deepEqual([...new Set(staffCatalog.reports.map(report => report.group))], ["Banka"], "muhasebe yalnız Banka raporlarını görür");
    assert.equal((await staff.get("/api/workspace/report-center/kasa-hareketleri")).status, 403, "finans raporu kapalı");
    const users = (await admin.get("/api/admin/users")).data.data;
    await admin.patch(`/api/admin/users/${users.find(user => user.username === "raporsuz").id}`, { grants: { remove: ["bank.reports"] } });
    assert.equal((await staff.get("/api/workspace/report-center")).status, 403, "Banka Raporları yetkisi de kaldırılınca rapor merkezi kapalı");
  });
});
