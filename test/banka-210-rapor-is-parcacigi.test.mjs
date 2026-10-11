// 2.1.0 — büyük banka raporlarının ayrı iş parçacığı (11.10.2026 hız düzeltmesi; lib/report-runner.mjs, lib/report-worker.mjs; §3.11 madde 5).
// Banka Bakiye ve Banka Hareket Raporu üretimde ana iş parçacığının dışında, salt okunur anlık görüntüden hazırlanır. Ekranın gördüğü (ön
// izleme JSON'u), PDF ve Excel yerinde hazırlanan raporla AYNI olmalı; süzgeç ve hesap hataları aynı durum koduyla ve metinle dönmeli.
// NASIL BOZARIM: (1) ön izleme sınırı TOPLAM'ı ya da toplam sayıyı ilk 200 satırdan hesaplatır; (2) PDF'in "ilk 20.000 satır" alt başlığı
// sınırla kaybolur; (3) iş parçacığındaki hata 500'e döner (404 hesap / 400 süzgeç kaybolur); (4) yetkisiz kullanıcı iş parçacığına ulaşır;
// (5) sahte saatte iş parçacığının "bugün"ü sunucununkinden farklı olur (dönem, ileri tarihli satır); (6) yazımdan hemen sonra açılan rapor
// eski anlık görüntüyü gösterir; (7) sunucu kapanırken bekleyen rapor asılı kalır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const plain = value => JSON.parse(JSON.stringify(value));
const qs = query => new URLSearchParams(query).toString();

describe("Banka raporlarının iş parçacığı: ekran, PDF, Excel ve hatalar yerinde hazırlanan raporla aynı", () => {
  let ctx;
  let api;
  let user;
  let ziraat;
  let garanti;
  before(async () => {
    ctx = await bootBank({ reportWorker: true, bankPickLegacy: true });
    api = ctx.api;
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "İş Parçacığı Ltd.", type: "customer", registeredOn: "2026-01-01" }));
    await must("eski havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.000", method: "bank", date: "2026-09-20" }));
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    garanti = await openAccount(api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
    // Ön izleme sınırını (200) aşan satır: 230 tahsilat + ücretli transfer.
    for (let i = 0; i < 230; i += 1) await must(`tahsilat ${i}`, api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: `${100 + i},${String(i % 100).padStart(2, "0")}`, method: "bank", bankAccountId: i % 2 ? ziraat.id : garanti.id, date: `2026-10-0${2 + (i % 6)}`, similarOk: true }));
    await must("transfer", api.post(`${BANK}/transfers`, { accountId: ziraat.id, toAccountId: garanti.id, amount: "2.500", date: "2026-10-07", feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", similarOk: true }));
    user = ctx.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
    ctx.app.context.access.attach(user);
  });
  after(() => ctx?.server.close());

  const inline = query => ctx.app.context.reportCenter.run(user, query.id, new URLSearchParams(query.q), { inline: true });

  it("ön izleme JSON'u: ilk 200 satır, toplam sayı ve TOPLAM bütün satırlardan — yerinde hazırlananla aynı; iş parçacığında hazırlandı", async () => {
    const started = ctx.app.context.reportRunner.stats.started;
    for (const query of [{ id: "banka-hareket", q: {} }, { id: "banka-hareket", q: { bankAccount: ziraat.id } }, { id: "banka-hareket", q: { bankAccount: "unassigned", preset: "all" } }, { id: "banka-hareket", q: { bankMove: "internal" } }, { id: "banka-bakiye", q: { bankGroup: "all" } }, { id: "banka-bakiye", q: { from: "2026-10-03", to: "2026-10-05" } }]) {
      const expected = plain(await inline(query));
      const shown = await must(`${query.id} ${qs(query.q)}`, api.get(`${RC}/${query.id}?${qs(query.q)}`));
      assert.deepEqual(plain(shown), { ...expected, rows: expected.rows.slice(0, 200) }, `${query.id} ${qs(query.q)}`);
      if (query.id === "banka-hareket" && !query.q.bankAccount && !query.q.bankMove) assert.ok(expected.total > 200, `ön izleme sınırı aşıldı (${expected.total})`);
    }
    assert.equal(ctx.app.context.reportRunner.stats.started - started, 6, "altı rapor da iş parçacığında hazırlandı");
  });

  it("Excel: bütün satırlar ve TOPLAM yerinde hazırlananla aynı; PDF açılır", async () => {
    const expected = plain(await inline({ id: "banka-hareket", q: {} }));
    const xlsx = await api.raw("GET", `${RC}/banka-hareket/xlsx`);
    assert.equal(xlsx.status, 200);
    const sheet = Object.values(xlsxSheets(xlsx.buffer))[0];
    assert.equal(sheet.length - 1, expected.rows.length + (expected.footer ? 1 : 0), "başlık + bütün satırlar + TOPLAM");
    assert.deepEqual(sheet[0].map(String), expected.headers);
    // Excel tutarı sayı hücresine yazar ("49.438,35 TL" → 49438.35).
    const cell = value => (/ TL$/.test(String(value)) ? Number(String(value).replace(/ TL$/, "").replace(/\./g, "").replace(",", ".")) : value);
    assert.deepEqual(sheet.at(-1), expected.footer.map(cell), "TOPLAM satırı");
    const pdf = await api.raw("GET", `${RC}/banka-hareket/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("hatalar aynı durum koduyla ve metinle: olmayan hesap 404, tanınmayan süzgeç 400, ters aralık 400", async () => {
    for (const q of [{ bankAccount: "bacc-yok" }, { bankMove: "xyz" }, { from: "2026-10-09", to: "2026-10-01" }]) {
      let expected;
      try {
        await inline({ id: "banka-hareket", q });
        assert.fail("yerinde hata vermeliydi");
      } catch (error) {
        expected = error;
      }
      const res = await api.get(`${RC}/banka-hareket?${qs(q)}`);
      assert.equal(res.status, expected.status, `${qs(q)}: ${res.status}`);
      assert.equal(res.error, expected.message);
      if (expected.extra?.code) assert.equal(res.code, expected.extra.code);
    }
    const group = await api.get(`${RC}/banka-bakiye?bankGroup=xyz`);
    assert.equal(group.status, 400);
    assert.equal(group.code, "bank-filter");
  });

  it("yetkisiz kullanıcı iş parçacığına ulaşmaz (403; sayaç artmaz)", async () => {
    const admin = ctx.server.client();
    await admin.login("admin", "Test-Admin-2026!");
    const clerk = apiOf(await createUser(ctx.server, admin, { username: "yetkisiz-is", role: "personel" }));
    const started = ctx.app.context.reportRunner.stats.started;
    for (const id of ["banka-hareket", "banka-bakiye"]) assert.equal((await clerk.get(`${RC}/${id}`)).status, 403);
    assert.equal(ctx.app.context.reportRunner.stats.started, started);
  });

  it("yazımdan hemen sonra açılan rapor yeni satırı gösterir; sahte saatin günü iş parçacığında da aynı", async () => {
    const before = await must("önce", api.get(`${RC}/banka-hareket?${qs({ bankAccount: ziraat.id, preset: "all" })}`));
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "Son Dakika A.Ş.", type: "customer", registeredOn: "2026-01-01" }));
    await must("bugün tahsilat", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "77,77", method: "bank", bankAccountId: ziraat.id, similarOk: true }));
    const now = await must("sonra", api.get(`${RC}/banka-hareket?${qs({ bankAccount: ziraat.id, preset: "all" })}`));
    assert.equal(now.total, before.total + 1);
    assert.deepEqual(plain(now), plain({ ...(await inline({ id: "banka-hareket", q: { bankAccount: ziraat.id, preset: "all" } })), rows: now.rows }));
    // Sahte saat ileri: iş parçacığının "bugün"ü (Bu Yıl / Tüm Zamanlar sonu) sunucununkiyle aynı.
    ctx.server.clock.set("2027-01-05T12:00:00+03:00");
    const next = await must("ertesi yıl", api.get(`${RC}/banka-hareket?${qs({ bankAccount: ziraat.id })}`));
    assert.equal(next.total, plain(await inline({ id: "banka-hareket", q: { bankAccount: ziraat.id } })).total);
    assert.match(next.subtitle, /2027/);
  });

  it("sunucu kapanırken bekleyen rapor asılı kalmaz (503 ya da tamamlanır)", async () => {
    const runner = ctx.app.context.reportRunner;
    const pending = Array.from({ length: 4 }, () => runner.run({ dbPath: ctx.app.config.dbPath, time: new Date().toISOString(), id: "banka-hareket", query: {}, user: { id: user.id, perms: user.perms }, limit: 1 }).then(() => "bitti", error => error.status || error.message));
    runner.close();
    const results = await Promise.all(pending);
    for (const result of results) assert.ok(result === "bitti" || result === 503 || /kapandı/.test(String(result)), String(result));
  });
});
