// 2.3.0 İz 1 — Şüpheli Ticari Alacaklar "Nasıl Bozarım" (docs/2.3.0-SUPHELI-KABUL.md §3; plan §3.11b/4, §3.11b/6). Sahte saat 08.10.2026.
// NASIL BOZARIM: tutar > borç bakiyesi · 0 / eksi / 3 ondalık · karşılık > şüpheli · değersiz > kalan · kayıt tarihinden önce tarih ·
//   kilitli dönem (al / çıkar / karşılık / değersiz / sil) · ileri, geçersiz, boş tarih · istek kimliği (aynı gövde yeniden yazılmaz, farklı
//   gövde 409) · aynı anda iki istek · aynı adlı iki cari · yetki (personel, avukat, muhasebe, kişiye özel ekle/kaldır) · audit · sil + geri
//   al (kayıt, karşılık, değersiz) · Şirket Verisini Sıfırla · eski sürüm dosyası (user_version 22; kilit izi sürüme bağlı) · ham SQL (tutar,
//   başlık iptali, kaydı olmayan başlık) · cari silme / değersiz satırını silme-düzeltme · tedarikçi / silinmiş cari · FORBIDDEN_GL 128/129.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { FORBIDDEN_GL } from "../server/lib/bank/voucher.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { PERMISSIONS, PERMISSION_ORDER, permissionsFor } from "../server/lib/permissions.mjs";
import { ADMIN_PASSWORD, createUser } from "./helpers.mjs";
import { apiOf, integrityOf, integrityOk, must, rawRun } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, lockPeriod } from "./banka-210-hesap-ortak.mjs";
import { ACC, balanceOf, collect, customer, debt, listOf, provision, release, take, trial, writeOff } from "./banka-230-supheli-ortak.mjs";

const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["doubtful_receivables", "doubtful_provisions", "fin_events", "account_entries", "audit_events"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
const checkOf = (result, code) => result.checks.find(item => item.code === code);
const deleteRecord = (api, accountId, did) => api.del(`${ACC}/${accountId}/doubtful/${did}`);

describe("Şüpheli — sınırlar: tutar, karşılık, değersiz, tarih", () => {
  let ctx;
  let acc;
  before(async () => {
    ctx = await bootBank();
    acc = await customer(ctx.api, "Sınır Ltd.");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
  });
  after(() => ctx.server.close());

  it("F — tutar > borç bakiyesi 400; 600 tamam; 500 (600 + 500 > 1.000) 400; 400 tamam → 128 = 1.000, 120 = 0; 0 / eksi / 3 ondalık 400", async () => {
    const before_ = snapshot(ctx.store);
    expectStatus(await take(ctx.api, acc.id, { amount: 1500, date: "2026-10-02", reason: "other" }), 400, "doubtful-exceeds-balance", "1.500 > 1.000");
    expectStatus(await take(ctx.api, acc.id, { amount: 0, date: "2026-10-02", reason: "other" }), 400, "amount-range", "0");
    expectStatus(await take(ctx.api, acc.id, { amount: -5, date: "2026-10-02", reason: "other" }), 400, "amount-range", "eksi");
    expectStatus(await take(ctx.api, acc.id, { amount: "1,005", date: "2026-10-02", reason: "other" }), 400, "amount-precision", "3 ondalık");
    expectStatus(await take(ctx.api, acc.id, { amount: 100, date: "2026-10-02", reason: "bogus" }), 400, "doubtful-reason", "tanınmayan neden");
    assert.deepEqual(snapshot(ctx.store), before_, "reddedilen istek iz bırakmaz");
    await must("600", take(ctx.api, acc.id, { amount: 600, date: "2026-10-02", reason: "other" }));
    expectStatus(await take(ctx.api, acc.id, { amount: 500, date: "2026-10-03", reason: "other" }), 400, "doubtful-exceeds-balance", "600 + 500 > 1.000");
    await must("400", take(ctx.api, acc.id, { amount: 400, date: "2026-10-03", reason: "other" }));
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 1000);
    assert.equal(gl(120), 0);
    assert.equal(await balanceOf(ctx.api, acc.id), 1000);
    await integrityOk(ctx.api, "F");
  });

  it("G / U / tarih — karşılık > kalan 400; değersiz > kalan 400; kayıt tarihinden önce 400 date-before-record; karşılık 700 + 300 tamam", async () => {
    const [first] = (await listOf(ctx.api, acc.id)).records;
    expectStatus(await provision(ctx.api, acc.id, first.id, { amount: 1200, date: "2026-10-04" }), 400, "doubtful-provision-exceeds", "1.200 > 600");
    expectStatus(await provision(ctx.api, acc.id, first.id, { amount: 100, date: "2026-10-01" }), 400, "date-before-record", "karşılık kayıttan önce");
    expectStatus(await writeOff(ctx.api, acc.id, first.id, { amount: 100, date: "2026-10-01" }), 400, "date-before-record", "değersiz kayıttan önce");
    expectStatus(await release(ctx.api, acc.id, first.id, { date: "2026-10-01" }), 400, "date-before-record", "çıkarma kayıttan önce");
    await must("karşılık 400", provision(ctx.api, acc.id, first.id, { amount: 400, date: "2026-10-04" }));
    expectStatus(await provision(ctx.api, acc.id, first.id, { amount: 300, date: "2026-10-05" }), 400, "doubtful-provision-exceeds", "400 + 300 > 600");
    await must("karşılık 200", provision(ctx.api, acc.id, first.id, { amount: 200, date: "2026-10-05" }));
    expectStatus(await writeOff(ctx.api, acc.id, first.id, { amount: 700, date: "2026-10-06" }), 400, "doubtful-writeoff-exceeds", "700 > 600");
    const gl = await trial(ctx.api);
    assert.equal(gl(129), -600);
    assert.equal(gl(654), 600);
    await integrityOk(ctx.api, "G");
  });

  it("I / J — kilitli dönem 409 (al / çıkar / karşılık / değersiz / sil), ileri 400 date-future, geçersiz 400 date-invalid, boş 400 date-missing", async () => {
    const [first, second] = (await listOf(ctx.api, acc.id)).records;
    await lockPeriod(ctx.api, "2026-10-04");
    const before_ = snapshot(ctx.store);
    expectStatus(await take(ctx.api, acc.id, { amount: 1, date: "2026-10-04", reason: "other" }), 409, "period-locked", "kilitli al");
    expectStatus(await release(ctx.api, acc.id, second.id, { date: "2026-10-04" }), 409, "period-locked", "kilitli çıkar");
    expectStatus(await provision(ctx.api, acc.id, second.id, { amount: 1, date: "2026-10-03" }), 409, "period-locked", "kilitli karşılık");
    expectStatus(await writeOff(ctx.api, acc.id, second.id, { amount: 1, date: "2026-10-04" }), 409, "period-locked", "kilitli değersiz");
    expectStatus(await deleteRecord(ctx.api, acc.id, first.id), 409, "period-locked", "kilitli kaydı sil");
    expectStatus(await deleteRecord(ctx.api, acc.id, second.id), 409, "period-locked", "kilitli kaydı sil (03.10)");
    expectStatus(await take(ctx.api, acc.id, { amount: 1, date: "2026-10-09", reason: "other" }), 400, "date-future", "ileri tarih");
    expectStatus(await take(ctx.api, acc.id, { amount: 1, date: "31.12.2026", reason: "other" }), 400, "date-invalid", "geçersiz tarih");
    expectStatus(await take(ctx.api, acc.id, { amount: 1, date: "", reason: "other" }), 400, "date-missing", "boş tarih");
    assert.deepEqual(snapshot(ctx.store), before_, "hiçbir şey yazılmaz");
    // Açık dönemde kayıt tarihi kilitli olsa da karşılık / değersiz / çıkarma bugünün tarihiyle yazılır (kilitli ayda alınan kayıt açık ayda kapanır).
    await must("açık dönemde karşılık", provision(ctx.api, acc.id, second.id, { amount: 100, date: TODAY }));
    await must("açık dönemde çıkar", release(ctx.api, acc.id, second.id, { date: TODAY }));
    assert.equal((await trial(ctx.api))(128), 600);
    await integrityOk(ctx.api, "I");
    await lockPeriod(ctx.api, "");
  });
});

describe("Şüpheli — istek kimliği, eşzamanlılık, aynı adlı cari, yetki, audit", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("K — aynı kimlik + aynı gövde → replayed (tek kayıt); aynı kimlik farklı gövde → 409 request-id-reused", async () => {
    const acc = await customer(ctx.api, "İstek Ltd.");
    await debt(ctx.api, acc.id, 5000, "2026-10-01");
    const id = `rq-${randomUUID()}`;
    const body = { amount: 1000, date: "2026-10-02", reason: "other", note: "aynı istek" };
    const first = await ctx.api.client.post(`${ACC}/${acc.id}/doubtful`, body, { "x-hof-request": id });
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    const second = await ctx.api.client.post(`${ACC}/${acc.id}/doubtful`, body, { "x-hof-request": id });
    assert.equal(second.status, 200);
    assert.equal(second.data.data.replayed, true, "yeniden yazılmaz");
    assert.equal(second.data.data.record.id, first.data.data.record.id);
    const third = await ctx.api.client.post(`${ACC}/${acc.id}/doubtful`, { ...body, amount: 1001 }, { "x-hof-request": id });
    assert.equal(third.status, 409);
    assert.equal(third.data.code, "request-id-reused");
    assert.equal(count(ctx.store, "doubtful_receivables", `account_id = '${acc.id}'`), 1, "tek kayıt");
    assert.equal((await trial(ctx.api))(128), 1000);
    // Gövdede requestId de kabul edilir (karşılık).
    const did = first.data.data.record.id;
    const key = `rq-${randomUUID()}`;
    await must("karşılık", provision(ctx.api, acc.id, did, { amount: 100, date: "2026-10-03", requestId: key }));
    const again = await must("karşılık yineleme", provision(ctx.api, acc.id, did, { amount: 100, date: "2026-10-03", requestId: key }));
    assert.equal(again.replayed, true);
    assert.equal(count(ctx.store, "doubtful_provisions", `doubtful_id = '${did}'`), 1);
    await integrityOk(ctx.api, "K");
  });

  it("O — aynı anda iki istek (600 + 600, borç 1.000): biri 200, öbürü 400 doubtful-exceeds-balance; 128 = 600", async () => {
    const acc = await customer(ctx.api, "Yarış Ltd.");
    const base = await trial(ctx.api);
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const results = await Promise.all([1, 2].map(() => take(ctx.api, acc.id, { amount: 600, date: "2026-10-02", reason: "other" })));
    const statuses = results.map(item => item.status).sort();
    assert.deepEqual(statuses, [200, 400], JSON.stringify(results.map(item => [item.status, item.code])));
    assert.equal(results.find(item => item.status === 400).code, "doubtful-exceeds-balance");
    assert.equal((await trial(ctx.api))(128) - base(128), 600);
    assert.equal((await listOf(ctx.api, acc.id)).records.length, 1);
    await integrityOk(ctx.api, "O");
  });

  it("P — aynı adlı iki cari: birinde al; öbürünün 120'si, kartı ve rapor satırı ayrı", async () => {
    const a = await customer(ctx.api, "ABC Ltd.");
    const b = await customer(ctx.api, "ABC Ltd.");
    await debt(ctx.api, a.id, 2000, "2026-10-01");
    await debt(ctx.api, b.id, 3000, "2026-10-01");
    await must("al", take(ctx.api, a.id, { amount: 1000, date: "2026-10-02", reason: "lawsuit" }));
    assert.equal(await balanceOf(ctx.api, b.id), 3000);
    assert.equal((await listOf(ctx.api, b.id)).records.length, 0);
    assert.equal((await listOf(ctx.api, a.id)).records.length, 1);
    const report = await must("rapor", ctx.api.get("/api/workspace/doubtful?status=all"));
    const rows = report.rows.filter(row => row.accountName === "ABC Ltd.");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].accountId, a.id);
    assert.ok(rows[0].accountRefNo, "rapor satırında cari no");
    await integrityOk(ctx.api, "P");
  });

  it("Q — yetki: personel 403; avukat (Cari Yönetimi var, Şüpheli Alacak İşlemleri yok) 403; muhasebe 200; kişiye özel ekle → 200, kaldır → 403; katalog", async () => {
    assert.deepEqual(PERMISSIONS["accounts.doubtful"], ["admin", "muhasebe"], "yetki kataloğu");
    assert.ok(PERMISSION_ORDER.includes("accounts.doubtful"));
    assert.ok(permissionsFor("muhasebe").includes("accounts.doubtful") && !permissionsFor("avukat").includes("accounts.doubtful") && !permissionsFor("personel").includes("accounts.doubtful"));
    const acc = await customer(ctx.api, "Yetki Ltd.");
    await debt(ctx.api, acc.id, 9000, "2026-10-01");
    const personel = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel-su", role: "personel" }));
    const avukat = apiOf(await createUser(ctx.server, ctx.api.client, { username: "avukat-su", role: "avukat" }));
    const muhasebe = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe-su", role: "muhasebe" }));
    const body = { amount: 100, date: "2026-10-02", reason: "other" };
    expectStatus(await take(personel, acc.id, body), 403, undefined, "personel");
    expectStatus(await take(avukat, acc.id, body), 403, undefined, "avukat");
    const data = await must("muhasebe", take(muhasebe, acc.id, body));
    expectStatus(await provision(personel, acc.id, data.record.id, { amount: 10, date: TODAY }), 403, undefined, "personel karşılık");
    expectStatus(await release(avukat, acc.id, data.record.id, { date: TODAY }), 403, undefined, "avukat çıkar");
    expectStatus(await deleteRecord(personel, acc.id, data.record.id), 403, undefined, "personel sil");
    // Herkes (accounts.view) listeyi görür; rapor verisi finans raporu yetkisi (overview.view): personel 403.
    assert.ok((await listOf(personel, acc.id)).records.length >= 1, "personel listeyi görür");
    expectStatus(await personel.get("/api/workspace/doubtful"), 403, undefined, "personel rapor");
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const idOf = username => users.find(user => user.username === username).id;
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${idOf("avukat-su")}`, { grants: { add: ["accounts.doubtful"], remove: [] } })).status, 200);
    await must("avukat + yetki", take(avukat, acc.id, { ...body, amount: 50 }));
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${idOf("muhasebe-su")}`, { grants: { add: [], remove: ["accounts.manage"] } })).status, 200);
    expectStatus(await take(muhasebe, acc.id, { ...body, amount: 20 }), 403, undefined, "muhasebe − Cari Yönetimi");
    await integrityOk(ctx.api, "Q");
  });

  it("R — audit: doubtful.take / provision / writeoff / release / deleted; S — FORBIDDEN_GL 128/129/644/654, Banka Ayarları fee=128 → 400", async () => {
    const acc = await customer(ctx.api, "Audit Ltd.");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-02", reason: "other" }));
    await must("karşılık", provision(ctx.api, acc.id, record.id, { amount: 200, date: "2026-10-03" }));
    await must("değersiz", writeOff(ctx.api, acc.id, record.id, { amount: 100, date: "2026-10-04" }));
    await must("çıkar", release(ctx.api, acc.id, record.id, { date: "2026-10-05" }));
    const audit = await must("audit", ctx.api.get("/api/admin/audit?type=doubtful."));
    const types = audit.filter(row => row.entityId === record.id).map(row => row.type).sort();
    assert.deepEqual(types, ["doubtful.provision", "doubtful.release", "doubtful.take", "doubtful.writeoff"]);
    const taken = audit.find(row => row.type === "doubtful.take" && row.entityId === record.id);
    assert.deepEqual([taken.payload.accountId, taken.payload.amountMinor, taken.payload.date, taken.payload.reason], [acc.id, 100000, "2026-10-02", "other"]);
    for (const code of ["128", "129", "644", "654"]) assert.ok(FORBIDDEN_GL.has(code), `${code} hiçbir rolde seçilemez`);
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { gl: { fee: "128" } } }), 400, "bank-gl-forbidden", "fee=128");
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { gl: { otherIncome: "644" } } }), 400, "bank-gl-forbidden", "otherIncome=644");
  });

  it("W / V — tedarikçi 409 doubtful-customer-only; silinmiş cari 404; açık şüpheli kaydı olan cari silinemez; Değersiz Alacak satırı cari kartından silinmez/düzeltilmez", async () => {
    const supplier = await must("tedarikçi", ctx.api.post(ACC, { name: "Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
    await debt(ctx.api, supplier.id, 500, "2026-10-01");
    expectStatus(await take(ctx.api, supplier.id, { amount: 100, date: "2026-10-02", reason: "other" }), 409, "doubtful-customer-only", "tedarikçi");
    expectStatus(await take(ctx.api, "yok-boyle-cari", { amount: 100, date: "2026-10-02", reason: "other" }), 404, undefined, "silinmiş/olmayan cari");
    const acc = await customer(ctx.api, "Silinemez Ltd.");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-02", reason: "other" }));
    expectStatus(await ctx.api.del(`${ACC}/${acc.id}`), 409, "account-doubtful-open", "açık şüpheli kaydı olan cari");
    const data = await must("değersiz", writeOff(ctx.api, acc.id, record.id, { amount: 1000, date: "2026-10-03" }));
    const entryId = data.record.writeOffs[0].entryId;
    expectStatus(await ctx.api.del(`${ACC}/${acc.id}/entries/${entryId}`), 409, "doubtful-linked", "değersiz satırı sil");
    expectStatus(await ctx.api.put(`${ACC}/${acc.id}/entries/${entryId}`, { amount: 5 }), 409, "doubtful-linked", "değersiz satırı düzelt");
    expectStatus(await ctx.api.del(`${ACC}/${acc.id}`), 409, "account-doubtful-open", "kapanmış ama kaydı olan cari silinmez (defter izi)");
    await integrityOk(ctx.api, "W");
  });
});

describe("Şüpheli — sil + geri al (ters kayıt), Silinenler, Şirket Verisini Sıfırla", () => {
  let ctx;
  let acc;
  before(async () => {
    ctx = await bootBank();
    acc = await customer(ctx.api, "Geri Al Ltd.");
    await debt(ctx.api, acc.id, 10000, "2026-10-01");
  });
  after(() => ctx.server.close());

  it("L — kaydı sil → 128 = 0, cari 10.000 değişmez, başlık iptal, Silinenler'de; geri yükle → 128 = 4.000; her adımda Mutabakat Testi tamam", async () => {
    const { record } = await must("al", take(ctx.api, acc.id, { amount: 4000, date: "2026-10-02", reason: "lawsuit" }));
    await must("karşılık", provision(ctx.api, acc.id, record.id, { amount: 1000, date: "2026-10-03" }));
    assert.equal((await trial(ctx.api))(128), 4000);
    await must("sil", deleteRecord(ctx.api, acc.id, record.id));
    let gl = await trial(ctx.api);
    assert.equal(gl(128), 0);
    assert.equal(gl(129), 0, "karşılık da düşer (kaydıyla birlikte)");
    assert.equal(gl(120), 10000);
    assert.equal(await balanceOf(ctx.api, acc.id), 10000);
    assert.equal(ctx.store.get("SELECT status FROM doubtful_receivables WHERE id = ?", record.id).status, "cancelled");
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE type = 'doubtful_take' AND src_id = ?", record.id).status, "cancelled");
    assert.equal((await listOf(ctx.api, acc.id)).records.length, 0, "iptal edilen kayıt listede görünmez");
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = trash.find(row => row.kind === "doubtful" && row.ref === record.id);
    assert.ok(item, `Silinenler'de şüpheli kaydı: ${JSON.stringify(trash.map(row => row.kind))}`);
    assert.equal(item.kindLabel, "Şüpheli Alacak");
    await integrityOk(ctx.api, "silindi");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    gl = await trial(ctx.api);
    assert.equal(gl(128), 4000);
    assert.equal(gl(129), -1000, "karşılık da geri gelir");
    assert.equal(await balanceOf(ctx.api, acc.id), 10000);
    assert.equal((await listOf(ctx.api, acc.id)).records[0].id, record.id);
    const audit = await must("audit", ctx.api.get("/api/admin/audit?type=doubtful."));
    assert.ok(audit.some(row => row.type === "doubtful.deleted" && row.entityId === record.id) && audit.some(row => row.type === "doubtful.restored" && row.entityId === record.id));
    expectStatus(await ctx.api.post("/api/admin/trash/restore", { id: item.id }), 404, undefined, "ikinci geri yükleme");
    await integrityOk(ctx.api, "geri yüklendi");
  });

  it("karşılığı sil → 129 = 0 → geri yükle → 129 = −1.000; değersizi sil → 128 ve cari geri → geri yükle; değersizi olan kayıt silinemez (önce değersiz)", async () => {
    const view = (await listOf(ctx.api, acc.id)).records[0];
    const pid = view.provisions[0].id;
    await must("karşılık sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${view.id}/provisions/${pid}`));
    assert.equal((await trial(ctx.api))(129), 0);
    await integrityOk(ctx.api, "karşılık silindi");
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = trash.find(row => row.kind === "doubtful-provision" && row.ref === pid);
    assert.ok(item, "Silinenler'de karşılık");
    await must("karşılık geri", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal((await trial(ctx.api))(129), -1000);
    await integrityOk(ctx.api, "karşılık geri geldi");
    // Değersiz 500 → sil → geri yükle.
    const data = await must("değersiz", writeOff(ctx.api, acc.id, view.id, { amount: 500, date: "2026-10-04" }));
    const entryId = data.record.writeOffs[0].entryId;
    assert.equal(await balanceOf(ctx.api, acc.id), 9500);
    expectStatus(await deleteRecord(ctx.api, acc.id, view.id), 409, "doubtful-has-writeoffs", "değersizi olan kayıt silinemez");
    await must("değersiz sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${view.id}/write-offs/${entryId}`));
    assert.equal(await balanceOf(ctx.api, acc.id), 10000);
    assert.equal((await trial(ctx.api))(128), 4000);
    assert.equal(count(ctx.store, "account_entries", `id = '${entryId}'`), 0);
    await integrityOk(ctx.api, "değersiz silindi");
    const trash2 = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item2 = trash2.find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
    assert.ok(item2, "Silinenler'de değersiz");
    await must("değersiz geri", ctx.api.post("/api/admin/trash/restore", { id: item2.id }));
    assert.equal(await balanceOf(ctx.api, acc.id), 9500);
    assert.equal((await trial(ctx.api))(128), 3500);
    assert.equal(count(ctx.store, "account_entries", `id = '${entryId}' AND source = 'doubtful'`), 1, "aynı kimlikle geri gelir");
    await integrityOk(ctx.api, "değersiz geri geldi");
  });

  it("geri yükleme kuralları: geri yüklenen kayıt borç bakiyesini aşarsa 409; kilitli tarih 409 period-locked", async () => {
    const other = await customer(ctx.api, "Geri Al 2");
    await debt(ctx.api, other.id, 1000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, other.id, { amount: 1000, date: "2026-10-02", reason: "other" }));
    await must("sil", deleteRecord(ctx.api, other.id, record.id));
    // Kayıt tarihinden ÖNCE tarihli tahsilat: geri yüklenince kayda düşmez (K3) → 120 = 300 − 1.000 → 409. (Kayıt tarihinden sonraki tahsilat
    // kayda düşer ve geri yükleme 200'dür: yargıç #4, test/supheli-230-yargic.test.mjs Y4.)
    await collect(ctx.api, other.id, 700, "2026-10-01");
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = trash.find(row => row.kind === "doubtful" && row.ref === record.id);
    expectStatus(await ctx.api.post("/api/admin/trash/restore", { id: item.id }), 409, "doubtful-exceeds-balance", "bakiye artık 300, kayda düşmeyen tahsilat");
    await lockPeriod(ctx.api, "2026-10-02");
    expectStatus(await ctx.api.post("/api/admin/trash/restore", { id: item.id }), 409, "period-locked", "kilitli tarih");
    await lockPeriod(ctx.api, "");
    await integrityOk(ctx.api, "geri yükleme kuralları");
  });

  it("M — Şirket Verisini Sıfırla (hareketler): şüpheli tabloları boş, 128 = 129 = 0, Mutabakat Testi tamam", async () => {
    assert.ok(count(ctx.store, "doubtful_receivables") > 0 && count(ctx.store, "doubtful_provisions") > 0);
    await must("sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(count(ctx.store, "doubtful_receivables"), 0);
    assert.equal(count(ctx.store, "doubtful_provisions"), 0);
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 0);
    assert.equal(gl(129), 0);
    const result = await integrityOk(ctx.api, "sıfırlandı");
    assert.equal(checkOf(result, "gl:128"), undefined, "şüpheli yokken 128 denetimi görünmez (denetim sayısı 2.2.0 ile aynı)");
    assert.equal(checkOf(result, "doubtful:records"), undefined);
  });
});

describe("Şüpheli — kapı ve tarama: ham SQL bozması yakalanır; eski sürüm dosyası (göç 23, kilit izi sürüme bağlı)", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("T — tutarı değiştir → gl:128/doubtful:records kırmızı; başlığı iptal et → kırmızı; kaydı olmayan başlık → kırmızı; düzeltince tamam", async () => {
    const acc = await customer(ctx.api, "Ham SQL Ltd.");
    await debt(ctx.api, acc.id, 2000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, acc.id, { amount: 1500, date: "2026-10-02", reason: "other" }));
    const event = ctx.store.get("SELECT id FROM fin_events WHERE type = 'doubtful_take' AND src_id = ?", record.id);
    const failing = async (label, ...codes) => {
      const result = await integrityOf(ctx.api);
      assert.equal(result.ok, false, `${label}: tarama tamam demiş`);
      assert.ok(codes.some(code => checkOf(result, code)?.ok === false), `${label}: ${codes.join("/")} kırmızı olmalı: ${JSON.stringify(result.failures.map(item => item.code))}`);
    };
    rawRun(ctx.db, "UPDATE doubtful_receivables SET amount_minor = 170000 WHERE id = ?", record.id);
    await failing("tutarı değişmiş kayıt", "doubtful:records", "gl:128", "party:accounts");
    rawRun(ctx.db, "UPDATE doubtful_receivables SET amount_minor = 150000 WHERE id = ?", record.id);
    await integrityOk(ctx.api, "düzeldi");
    rawRun(ctx.db, "UPDATE fin_events SET status = 'cancelled' WHERE id = ?", event.id);
    await failing("başlığı iptal edilmiş kayıt", "doubtful:records");
    rawRun(ctx.db, "UPDATE fin_events SET status = 'active' WHERE id = ?", event.id);
    await integrityOk(ctx.api, "düzeldi 2");
    rawRun(ctx.db, "UPDATE doubtful_receivables SET status = 'cancelled' WHERE id = ?", record.id);
    await failing("kaydı iptal edilmiş etkin başlık", "doubtful:records", "gl:128");
    rawRun(ctx.db, "UPDATE doubtful_receivables SET status = 'open' WHERE id = ?", record.id);
    await integrityOk(ctx.api, "son");
    // Yeni yazım kapıdan geçer (kapı tabanı bozulmadı).
    await must("karşılık", provision(ctx.api, acc.id, record.id, { amount: 100, date: TODAY }));
  });

  it("N — eski sürüm dosyası: user_version 22 + tablolar yok → göç 23 açar; kilit izi { version: '2.2.0' } göç öncesiyle aynı; şüpheli yokken denetim listesi aynı", async () => {
    assert.ok(LATEST_VERSION >= 23, `göç sürümü ${LATEST_VERSION}`);
    const acc = await customer(ctx.api, "Eski Ltd.");
    await debt(ctx.api, acc.id, 100, "2026-10-01");
    await lockPeriod(ctx.api, "2026-10-01");
    const codesBefore = (await integrityOk(ctx.api, "önce")).checks.map(item => item.code);
    const digestOld = lockDigestOf(ctx.store, "2026-10-01", { version: "2.2.0" });
    const digestNow = lockDigestOf(ctx.store, "2026-10-01");
    assert.equal(digestOld, digestNow, "şüpheli kaydı yokken 2.3.0 izi 2.2.0 iziyle aynı");
    // Eski dosya benzetimi: 2.2.0 şeması (göç 22) — yeni tablolar yok.
    // Sunucu kapanınca geçici klasörü siler: veri klasörü önce kopyalanır (WAL önce dosyaya alınır), kopya eski şemaya indirilir.
    const path = await import("node:path");
    const { cpSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-supheli-eski-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    ctx.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    cpSync(ctx.server.dataDir, dataDir, { recursive: true });
    const dbPath = path.join(dataDir, path.relative(ctx.server.dataDir, ctx.server.app.config.dbPath));
    await ctx.server.close();
    const { openDatabase } = await import("../server/lib/db.mjs");
    const db = openDatabase(dbPath);
    // 2.2.0 dosyasında şüpheli tabloları da başlıkları da yoktur (T testinin başlıkları bu kopyadan silinir; gerçek 2.2.0 kodu yazmaz).
    db.exec("DROP TABLE IF EXISTS doubtful_provisions; DROP TABLE IF EXISTS doubtful_receivables; DELETE FROM fin_events WHERE type LIKE 'doubtful_%'; DELETE FROM account_entries WHERE source = 'doubtful'; PRAGMA user_version = 22");
    db.close();
    const { bootVersion, CURRENT } = await import("./guvenilirlik/surumler.mjs");
    const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
    try {
      const api = await server.login();
      assert.equal(server.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION, "göç uygulandı");
      assert.ok(server.app.store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'doubtful_receivables'"), "tablo açıldı");
      assert.equal(lockDigestOf(server.app.store, "2026-10-01", { version: "2.2.0" }), digestOld, "göçten sonra 2.2.0 izi aynı");
      const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      assert.equal(result.ok, true, JSON.stringify(result.failures).slice(0, 500));
      // Aynı sunucuda T testinin kaydı vardı (128/129 denetimleri açıktı); eski şemada kayıt yok → 2.2.0'ın listesi (128/129/doubtful yok).
      assert.deepEqual(result.checks.map(item => item.code), codesBefore.filter(code => !["gl:128", "gl:129", "doubtful:records", "doubtful:balance"].includes(code)), "denetim listesi 2.2.0 ile aynı");
      const account = (await must("cari", api.get(`${ACC}?status=all`))).accounts.find(item => item.name === "Eski Ltd.");
      await must("eski dosyada al", api.post(`${ACC}/${account.id}/doubtful`, { amount: 100, date: TODAY, reason: "other" }));
      assert.notEqual(lockDigestOf(server.app.store, "2026-10-08"), lockDigestOf(server.app.store, "2026-10-08", { version: "2.2.0" }), "kilitli dönemdeki şüpheli kaydı yalnız 2.3.0 izine girer");
    } finally {
      await server.close();
    }
    ctx = await bootBank();
  });
});
