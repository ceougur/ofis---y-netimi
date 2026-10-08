// 2.0.26 — A13: mutabakat kapısında "ileri tarihli hareket" denetimi gün geçtikçe kendiliğinden kırılmasın.
// Hata (2.0.25): dates:future:<tablo> imzası ileri tarihli satır SAYISINI içeriyordu. Eski veride (2.0.24 öncesi ya da 2.0.25'te
// ileri tarihli çek) ileri tarihli satır varsa gün geçtikçe sayı küçülür, imza tabanda olmaz ve bir sonraki yeniden başlatmaya
// kadar BÜTÜN para işlemleri 409 alır. Düzeltme: açılışta bulunan ileri tarihli satırlar kimlikleriyle taban kümesidir; sayılan
// yalnız bu kümede olmayan (yeni) ileri tarihli satırlardır. Yeni ileri tarihli satır yine engellenir.
// Saat: node:test'in Date taklidi (yalnız Date; zamanlayıcılar gerçek). Uygulama koduna saat enjeksiyonu gerekmedi.
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const T0 = new Date(2026, 9, 8, 12, 0, 0); // 08.10.2026 12:00 yerel
const DAY = 86_400_000;
const dayOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const at = days => new Date(T0.getTime() + days * DAY);
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error, failures: r.data?.failures });

describe("A13 — eski ileri tarihli satırlar yaşlanınca para işlemleri kilitlenmez", () => {
  let server;
  let api;
  before(async () => {
    mock.timers.enable({ apis: ["Date"], now: T0.getTime() });
    server = await startTestServer();
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
    };
    // Eski sürümün bıraktığı ileri tarihli satırlar (2.0.24 öncesi kayıt tahsilatı ve 2.0.25'te ileri alış tarihli çek):
    // veri tabanına doğrudan yazılır (bugünkü kod bunları girmeye izin vermez), sonra uygulama yeniden başlıyormuş gibi
    // kapı tabanı yeniden ölçülür.
    const stamp = T0.toISOString();
    const insert = server.app.db.prepare("INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES (?, 'ESKI', ?, ?, 'Eski sürüm', 'cash', 'eski', ?)");
    insert.run("pay-ileri-1", 100, dayOf(at(1)), stamp);
    insert.run("pay-ileri-2", 200, dayOf(at(2)), stamp);
    insert.run("pay-ileri-3", 300, dayOf(at(3)), stamp);
    server.app.db.prepare("INSERT INTO cheques (id, direction, instrument, serial_no, bank, drawer, account_id, plan_id, amount, issue_date, due_date, status, status_date, note, created_by, created_at, updated_at) VALUES ('cek-ileri', 'in', 'cheque', 'IL-1', '', 'Eski Keşideci', '', '', 750, ?, ?, 'portfolio', ?, '', 'eski', ?, ?)").run(dayOf(at(2)), dayOf(at(40)), dayOf(at(2)), stamp, stamp);
    server.app.db.prepare("INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, method, created_by, created_at) VALUES ('cev-ileri', 'cek-ileri', 'receive', ?, 750, '', '', 'portfolio', 'Açılış portföyü', '[]', 'cash', 'eski', ?)").run(dayOf(at(2)), stamp);
    server.app.integrity.start();
  });
  after(async () => {
    await server?.close();
    mock.timers.reset();
  });

  it("açılış günü: tahsilat 200 (eski ileri tarihli satırlar taban)", async () => {
    const res = await api.post("/api/workspace/cases/YENI-1/payments", { amount: "50", caseTitle: "Yeni" });
    assert.equal(res.status, 200, `${res.status} ${res.error}`);
  });

  it("çalışıyor mu: 2 gün sonra (eski satırların ikisi geçmişe düştü) tahsilat, Kasa girişi ve çek 200; Mutabakat Testi kalan eski satırı gösterir", async () => {
    mock.timers.setTime(at(2).getTime());
    const payment = await api.post("/api/workspace/cases/YENI-2/payments", { amount: "60", caseTitle: "Yeni" });
    assert.equal(payment.status, 200, `tahsilat: ${payment.status} ${payment.code} ${payment.error} ${JSON.stringify(payment.failures || "").slice(0, 300)}`);
    assert.equal(server.app.store.get("SELECT date FROM payments WHERE id = ?", payment.data.id).date, dayOf(at(2)), "tarih yazılmayınca sahte saatin günü");
    const cash = await api.post("/api/workspace/cash", { kind: "in", amount: "70", description: "Danışmanlık" });
    assert.equal(cash.status, 200, `Kasa: ${cash.status} ${cash.error}`);
    const cheque = await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "80", dueDate: dayOf(at(30)), drawer: "Yeni Keşideci", serialNo: "YN-1" });
    assert.equal(cheque.status, 200, `çek: ${cheque.status} ${cheque.error}`);
    // Gözden geçirme G4: 3. günün eski satırı hâlâ ileri tarihli; Mutabakat Testi onu gizlemez (eski sürümden kalan: legacy),
    // yalnız yeni işlemleri engellemez. Kapının yeni satır sayısı (gateCount) 0.
    const integrity = await api.get("/api/workspace/ledger/integrity");
    const failures = integrity.data.failures.map(item => ({ code: item.code, count: item.count, legacy: item.legacy, gateCount: item.gateCount }));
    assert.deepEqual(failures, [{ code: "dates:future:payments", count: 1, legacy: 1, gateCount: 0 }]);
  });

  it("nasıl bozarım: aynı anda yeni ileri tarihli satır API'den 400, doğrudan işlemle kapıda 409 (dates:future)", async () => {
    const res = await api.post("/api/workspace/cases/YENI-3/payments", { amount: "10", date: dayOf(at(5)), caseTitle: "Yeni" });
    assert.equal(res.status, 400);
    assert.equal(res.code, "date-future");
    const { store } = server.app;
    const future = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "dates:future:cash_entries");
    assert.throws(() => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-ileri', 'in', 10, ?, 'x', 'cash', 'x', ?)", dayOf(at(6)), new Date().toISOString())), future);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'cash-ileri'").n, 0);
  });

  it("çalışıyor mu: bütün eski satırlar geçmişe düşünce de (5 gün) işlemler 200, Mutabakat Testi ok", async () => {
    mock.timers.setTime(at(5).getTime());
    const res = await api.post("/api/workspace/cases/YENI-4/payments", { amount: "90", caseTitle: "Yeni" });
    assert.equal(res.status, 200, `${res.status} ${res.error}`);
    const integrity = await api.get("/api/workspace/ledger/integrity");
    assert.equal(integrity.data.ok, true, JSON.stringify(integrity.data.failures).slice(0, 500));
  });

  it("çalışıyor mu: yeniden başlatma (taban yeniden ölçülür) sonrası da aynı", async () => {
    server.app.integrity.start();
    const res = await api.post("/api/workspace/cash", { kind: "in", amount: "15", description: "Yeniden başlatma sonrası" });
    assert.equal(res.status, 200, `${res.status} ${res.error}`);
  });
});
