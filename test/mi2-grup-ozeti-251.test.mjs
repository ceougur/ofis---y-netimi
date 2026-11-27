// 2.5.1 Mİ-2 — Cari grubuna göre görünümler: dönemlik tahsilat (yol kırılımıyla), "Bu Dönemde Ödeme Yapanlar", Grup Özeti (ekran / PDF / Excel).
// KULLANICI 27.11 (AYNEN): "mesela buna biz cari grupları açtık ya gruba göre bugün ne kadar kasaya giriş olmuş onu istiyor, yani A grubundaki öğrenciler bugün ne kadar
// ödeme yapmış gibi. cari gruplarına göre geciken taksitler, o gruptan toplam alınan ödemeler, o grubun carilerinden geciken geciken taksitler gibi çeşitli filtrelemeler
// yapılabilsin bu ekrandan. …" — "kasaya giriş derken tüm tahsilat yollarını kastettim. nakit, pos, havale, çek, senet. önerin yani".
// BAŞ MİMAR TASARIMI (onaylandı) ve kurallar: docs/devir/2.5.1-DEVAM/mi-istem.txt; uygulama notu docs/devir/2.5.1-DEVAM/mi2-tasarim.md.
// (a) EŞDEĞERLİK: cari başına Tahsilat + Önceden Ödenen = 'Cari Bazında Tahsilat' raporunun Toplam'ı (rapor BAĞIMSIZ beklenen; aynı dönem).
// (b) ELLE senaryo: beklenen sayılar AŞAĞIDA elle yazıldı (ders 5) — programın çıktısından türetilmedi.
// (c) grup satırlarının toplamı = TOPLAM = süzgeçsiz Liste kartları, her süzgeç seçeneğiyle (ders 11).
// (d) nasıl bozulur: grupsuz, alt grup, boş grup, pasif, aynı adlı iki cari, tedarikçi ödemesi, silinmiş tahsilat, karşılıksız çek, iade, dönem sınırı (gece yarısı,
//     ay / yıl başı — sahte saatle; ders 13), dönemde tahsilat yok. (e) yetkisiz rol. Göreli tarih: sabit sahte saat (config.now).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20"; // salı
const NOW = `${TODAY}T12:00:00+03:00`;
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const steppingClock = (start = NOW, step = 7) => {
  let at = Date.parse(start);
  return () => (at += step);
};
const num = cell => Number(String(cell ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
const pick = c => [c.total, c.cash, c.card, c.bank, c.cheque, c.note, c.other, c.opening];

describe("Mİ-2 — dönemlik tahsilat ve Grup Özeti", () => {
  let h;
  const ids = {};
  before(async () => {
    const server = await startTestServer({ now: steppingClock(), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), patch: async (url, body) => unwrap(await client.patch(url, body)), del: async url => unwrap(await client.del(url)) };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    h = { server, client, api, must, store: server.app.store };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const group = async (name, parentId = "") => (await must(`grup ${name}`, api.post("/api/workspace/plans/groups", { name, ...(parentId ? { parentId } : {}) }))).id;
    ids.A = await group("A Grubu");
    ids.A1 = await group("1. Sınıf", ids.A);
    ids.A2 = await group("2. Sınıf", ids.A);
    ids.B = await group("B Grubu");
    ids.C = await group("C Grubu (Boş)");
    let n = 0;
    const cari = (name, extra = {}) => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-01-05", phone: `0532 251 20 ${String((n += 1)).padStart(2, "0")}`, ...extra }));
    const tahsil = (acc, amount, method, date = TODAY) => must(`tahsilat ${acc.name} ${method}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(amount), method, date, cashForce: true, similarOk: true }));
    const kart = (acc, total) => must(`kart ${acc.name}`, api.post("/api/workspace/plans", { name: acc.name, registeredOn: "2026-09-01", total: String(total), accountId: acc.id, mode: "auto", count: "3", firstDue: "2026-09-05", everyMonths: "1" }));
    const kartTahsil = (plan, amount, method, date = TODAY) => must("kart tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: String(amount), method, date, cashForce: true, similarOk: true }));
    const evrak = (acc, instrument, amount, serialNo) => must(`${instrument} ${acc.name}`, api.post("/api/workspace/cheques", { direction: "in", instrument, serialNo, bank: "Akbank", drawer: acc.name, accountId: acc.id, amount: String(amount), issueDate: TODAY, dueDate: "2026-12-20" }));

    // ELLE senaryo (bugün 20.10.2026; dün 19.10.2026 pazartesi):
    ids.ali = await cari("Ali Kaya", { groupId: ids.A, subgroupId: ids.A1 });
    await tahsil(ids.ali, 100, "cash"); // Nakit 100
    await tahsil(ids.ali, 200, "card"); // POS 200
    ids.aliPlan = await kart(ids.ali, 900);
    await kartTahsil(ids.aliPlan, 300, "bank"); // Havale / EFT 300 (taksit tahsilatı)
    ids.ayla = await cari("Ayla Kaya", { groupId: ids.A, subgroupId: ids.A2 });
    ids.cek = await evrak(ids.ayla, "cheque", 400, "Ç-1"); // Çek 400
    await evrak(ids.ayla, "note", 500, "S-1"); // Senet 500
    ids.arda = await cari("Arda Kaya", { groupId: ids.A }); // alt grubu yok
    await tahsil(ids.arda, 50, "cash", "2026-10-19"); // DÜN nakit 50
    ids.bora = await cari("Bora Er", { groupId: ids.B });
    ids.boraPlan = await kart(ids.bora, 600);
    await kartTahsil(ids.boraPlan, 70, "cash"); // Nakit 70 (taksit)
    const silinecek = await tahsil(ids.bora, 888, "cash");
    const sil = silinecek.entries.find(entry => Number(entry.amount) === 888);
    await must("tahsilat sil", api.del(`/api/workspace/accounts/${ids.bora.id}/entries/${sil.id}?cashForce=1`));
    ids.nur = await cari("Nur Su"); // grupsuz
    await tahsil(ids.nur, 60, "bank"); // Havale / EFT 60
    ids.tedarik = await cari("Kırtasiye Tedarik", { type: "supplier", groupId: ids.B });
    await must("tedarikçiye ödeme", api.post(`/api/workspace/accounts/${ids.tedarik.id}/entries`, { kind: "out", amount: "1000", method: "cash", date: TODAY, cashForce: true, similarOk: true })); // sayılmaz
    ids.pasif = await cari("Pasif Kaya", { groupId: ids.A, subgroupId: ids.A1 });
    await tahsil(ids.pasif, 10, "cash");
    await must("pasif yap", api.put(`/api/workspace/accounts/${ids.pasif.id}`, { status: "passive" }));
    // Aynı adlı iki cari (ikisi de "Ali Kaya"? hayır — ikinci "Ali Kaya" grupsuz, tahsilatsız): kimlikle toplanır.
    ids.ali2 = await cari("Ali Kaya");
    // Excel'den önceden ödenen (açılış) 300: dönem tahsilatına KARIŞMAZ, ayrı sütun.
    const matrix = [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen"], ["Excel Velisi", "0533 251 30 01", "1.200", "4", "05.11.2026", "300"]];
    const preview = await must("içe aktarım önizleme", api.post("/api/workspace/plans/import/preview", { matrix }));
    await must("içe aktarım", api.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "taksit.xlsx" }));
    ids.excel = h.store.get("SELECT id FROM accounts WHERE name = 'Excel Velisi' AND deleted_at IS NULL");
  });
  after(async () => h?.server.close());

  const listOf = async query => h.must(`liste ${query}`, h.api.get(`/api/workspace/accounts?limit=5000&${query}`));
  const summaryOf = async query => h.must(`grup özeti ${query}`, h.api.get(`/api/workspace/accounts/group-summary?${query}`));
  const rowOf = (data, id) => data.accounts.find(item => item.id === id);

  it("ön koşul: Excel kartı cariye bağlandı ve açılışı bugün; silinen tahsilat veri tabanında yok", () => {
    assert.ok(ids.excel?.id, "Excel Velisi carisi açıldı");
    const opening = h.store.get("SELECT SUM(e.amount) AS s, MAX(e.date) AS d FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.account_id = ? AND e.opening = 1", ids.excel.id);
    assert.deepEqual([opening.s, opening.d], [300, TODAY]);
    assert.equal(h.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE amount = 888").n, 0);
  });

  it("dönem yokken Liste'nin yanıtı bugünkü gibi: period / collected alanı YOK", async () => {
    const data = await listOf("status=all");
    assert.equal("period" in data, false);
    assert.equal("collected" in data.totals, false);
    assert.equal(data.accounts.some(item => "collected" in item), false);
  });

  it("(b) ELLE: Bugün — her yol ayrı; tedarikçi ödemesi, silinen tahsilat, dünkü tahsilat sayılmaz; açılış ayrı", async () => {
    const data = await listOf("period=today");
    assert.deepEqual([data.period.from, data.period.to, data.period.label], [TODAY, TODAY, "Bugün"]);
    //                       total cash card bank cheque note other opening
    assert.deepEqual(pick(rowOf(data, ids.ali.id).collected), [600, 100, 200, 300, 0, 0, 0, 0], "Ali: nakit 100 + POS 200 + havale 300 (taksit)");
    assert.deepEqual(pick(rowOf(data, ids.ayla.id).collected), [900, 0, 0, 0, 400, 500, 0, 0], "Ayla: çek 400 + senet 500");
    assert.deepEqual(pick(rowOf(data, ids.arda.id).collected), [0, 0, 0, 0, 0, 0, 0, 0], "Arda: dünkü 50 bugüne girmez");
    assert.deepEqual(pick(rowOf(data, ids.bora.id).collected), [70, 70, 0, 0, 0, 0, 0, 0], "Bora: taksit 70; silinen 888 yok");
    assert.deepEqual(pick(rowOf(data, ids.nur.id).collected), [60, 0, 0, 60, 0, 0, 0, 0]);
    assert.deepEqual(pick(rowOf(data, ids.tedarik.id).collected), [0, 0, 0, 0, 0, 0, 0, 0], "tedarikçiye ödeme tahsilat değil");
    assert.deepEqual(pick(rowOf(data, ids.excel.id).collected), [0, 0, 0, 0, 0, 0, 0, 300], "önceden ödenen 300 ayrı, Tahsilat'a karışmaz");
    assert.equal(rowOf(data, ids.pasif.id), undefined, "pasif cari Aktif süzgecinde yok");
    assert.deepEqual(pick(data.totals.collected), [1630, 170, 200, 360, 400, 500, 0, 300], "kart: Tahsilat 1.630 (açılış 300 ayrı)");
    assert.equal(data.totals.collectedCount, 4, "ödeme yapan 4 cari (Ali, Ayla, Bora, Nur)");
  });

  it("(b) ELLE: Dün, Bu Hafta, Bu Ay, Tarih Aralığı; Tümü durumunda pasif dahil", async () => {
    assert.deepEqual(pick((await listOf("period=yesterday")).totals.collected), [50, 50, 0, 0, 0, 0, 0, 0]);
    const week = await listOf("period=week");
    assert.deepEqual([week.period.from, week.period.to], ["2026-10-19", "2026-10-25"], "pazartesi–pazar");
    assert.equal(week.totals.collected.total, 1680);
    assert.equal((await listOf("period=month")).totals.collected.total, 1680);
    assert.equal((await listOf("period=range&from=2026-10-19&to=2026-10-19")).totals.collected.total, 50);
    assert.equal((await listOf("period=range&from=2026-10-21&to=2026-10-31")).totals.collected.total, 0, "dönemde tahsilat yok → 0");
    assert.equal((await listOf("period=today&status=all")).totals.collected.total, 1640, "pasif carinin 10'u Tümü'nde");
    const bad = await h.api.get("/api/workspace/accounts?period=range&from=2026-10-25&to=2026-10-19");
    assert.equal(bad.status, 400, "başlangıç > bitiş 400");
    assert.equal((await h.api.get("/api/workspace/accounts?period=range&from=&to=2026-10-19")).status, 400, "eksik gün 400");
  });

  it("(b) 'Bu Dönemde Ödeme Yapanlar' grup / tür / bakiye / gecikme süzgeçleriyle BİRLİKTE; kartlar süzgeçten SONRA", async () => {
    const payers = await listOf("period=today&paid=1");
    assert.deepEqual(payers.accounts.map(item => item.name).sort(), ["Ali Kaya", "Ayla Kaya", "Bora Er", "Nur Su"]);
    assert.equal(payers.totals.count, 4);
    assert.equal(payers.totals.collected.total, 1630);
    const aPayers = await listOf(`period=today&paid=1&group=${ids.A}`);
    assert.deepEqual(aPayers.accounts.map(item => item.name).sort(), ["Ali Kaya", "Ayla Kaya"]);
    assert.equal(aPayers.totals.collected.total, 1500, "A grubu bugün 1.500");
    assert.equal((await listOf(`period=today&paid=1&group=${ids.A}&subgroup=${ids.A1}`)).totals.collected.total, 600);
    const none = await listOf("period=today&group=__none");
    assert.deepEqual(none.accounts.map(item => item.name).sort(), ["Ali Kaya", "Excel Velisi", "Nur Su"], "Grupsuz: görünen grubu olmayanlar (aynı adlı ikinci Ali dahil)");
    const aNoSub = await listOf(`period=today&group=${ids.A}&subgroup=__none`);
    assert.deepEqual(aNoSub.accounts.map(item => item.name), ["Arda Kaya"], "A grubunda Alt Grupsuz");
    const lateAndPaid = await listOf("period=today&paid=1&balance=overdue");
    for (const item of lateAndPaid.accounts) assert.ok(item.collected.total > 0 && item.overdueCount > 0, item.name);
    // Ali: cari tahsilatı 300 (bağsız; en eski açık taksiti kapatır) + kart tahsilatı 300 → 05.09 ve 05.10 taksitleri kapandı, 05.11'in vadesi gelmedi → gecikmesi YOK.
    // Bora: 600 / 3 taksit, 70 ödendi → 05.09 taksitinin 130'u ve 05.10 taksiti gecikti.
    assert.deepEqual(lateAndPaid.accounts.map(item => item.name).sort(), ["Bora Er"], "taksidi geciken VE bugün ödeyen");
  });

  it("(c) Grup Özeti: her grup bir satır (boş grup dahil), alt grup kırılımı, Grupsuz; satırlar = TOPLAM = süzgeçsiz Liste kartları — HER süzgeç seçeneğiyle", async () => {
    const s = await summaryOf("period=today");
    const byName = Object.fromEntries(s.groups.map(row => [row.name, row]));
    assert.deepEqual(s.groups.map(row => row.name), ["A Grubu", "B Grubu", "C Grubu (Boş)", "Grupsuz"]);
    assert.deepEqual([byName["A Grubu"].count, byName["A Grubu"].collected.total], [3, 1500]);
    assert.deepEqual(byName["A Grubu"].subgroups.map(sub => [sub.name, sub.count, sub.collected.total]), [["1. Sınıf", 1, 600], ["2. Sınıf", 1, 900], ["Alt Grupsuz", 1, 0]]);
    assert.deepEqual([byName["B Grubu"].count, byName["B Grubu"].collected.total, byName["B Grubu"].subgroups.length], [2, 70, 0]);
    assert.deepEqual([byName["C Grubu (Boş)"].count, byName["C Grubu (Boş)"].collected.total], [0, 0]);
    assert.deepEqual([byName.Grupsuz.count, byName.Grupsuz.collected.total, byName.Grupsuz.collected.opening], [3, 60, 300]);
    const sum = (rows, key) => Math.round(rows.reduce((acc, row) => acc + (key.startsWith("c.") ? row.collected[key.slice(2)] : row[key]), 0) * 100) / 100;
    const options = [
      "period=today",
      "period=today&status=all",
      "period=today&status=passive",
      "period=yesterday",
      "period=week&type=customer",
      "period=month&type=supplier",
      "period=today&balance=debtor",
      "period=today&balance=creditor",
      "period=today&balance=overdue",
      "period=today&balance=nonzero",
      "period=today&balance=zero",
      "period=today&paid=1",
      "period=today&q=kaya",
      "period=range&from=2026-10-21&to=2026-10-31",
    ];
    for (const option of options) {
      const summary = await summaryOf(option);
      const list = await listOf(option);
      for (const key of ["count", "balance", "planRemaining", "overdue", "lateInstallments", "c.total", "c.cash", "c.card", "c.bank", "c.cheque", "c.note", "c.other", "c.opening"]) {
        const fromRows = sum(summary.groups, key);
        const total = key.startsWith("c.") ? summary.totals.collected[key.slice(2)] : summary.totals[key];
        assert.equal(fromRows, total, `${option}: ${key} satırlar ${fromRows} = TOPLAM ${total}`);
        for (const row of summary.groups) if (row.subgroups.length) assert.equal(sum(row.subgroups, key), key.startsWith("c.") ? row.collected[key.slice(2)] : row[key], `${option}: ${row.name} alt grupları = grup (${key})`);
      }
      assert.equal(summary.totals.count, list.total, `${option}: Cari = Liste toplamı`);
      assert.equal(summary.totals.balance, list.totals.balance, `${option}: Bakiye = Borçlular − Alacaklılar`);
      assert.equal(summary.totals.planRemaining, list.totals.planRemaining, `${option}: Taksitlerden Kalan kartı`);
      assert.equal(summary.totals.overdue, list.totals.overdue, `${option}: Gecikmiş Borç kartı`);
      assert.deepEqual(pick(summary.totals.collected), pick(list.totals.collected), `${option}: Tahsilat kartı`);
      const late = list.accounts.reduce((acc, item) => acc + (item.planOverdueCount ?? item.overdueInstallmentCount ?? 0), 0);
      assert.equal(summary.totals.lateInstallments, late, `${option}: Geciken Taksit = satırlardaki "N geciken" toplamı`);
      // Satıra tıklayınca Liste o gruba süzülür: grubun sayıları = o süzgeçteki Liste.
      for (const row of summary.groups) {
        const filtered = await listOf(`${option}&group=${row.id}`);
        assert.deepEqual([filtered.total, filtered.totals.collected.total], [row.count, row.collected.total], `${option}: ${row.name} satırı = Liste (grup süzgeci)`);
        for (const sub of row.subgroups) {
          const subList = await listOf(`${option}&group=${row.id}&subgroup=${sub.id}`);
          assert.deepEqual([subList.total, subList.totals.collected.total], [sub.count, sub.collected.total], `${option}: ${row.name} › ${sub.name} = Liste`);
        }
      }
    }
  });

  it("(a) EŞDEĞERLİK: cari başına Tahsilat + Önceden Ödenen = 'Cari Bazında Tahsilat' raporunun Toplam'ı; açılış = raporun açılış sütunu (Bugün, Bu Ay, tüm yıl)", async () => {
    for (const [query, from, to] of [["period=today", TODAY, TODAY], ["period=month", "2026-10-01", "2026-10-31"], ["period=range&from=2026-01-01&to=2026-12-31", "2026-01-01", "2026-12-31"]]) {
      const list = await listOf(`${query}&status=all`);
      const report = await h.must("rapor", h.api.get(`/api/workspace/report-center/cari-tahsilat?from=${from}&to=${to}`));
      const col = name => report.headers.indexOf(name);
      const byRef = new Map(report.rows.map(row => [`${row[col("Cari No")]}|${row[col("Cari")]}`, row]));
      let compared = 0;
      for (const item of list.accounts) {
        const row = byRef.get(`${item.refNo}|${item.name}`);
        const mine = Math.round((item.collected.total + item.collected.opening) * 100) / 100;
        if (!row) {
          assert.equal(mine, 0, `${query}: ${item.name} raporda yok → 0`);
          continue;
        }
        compared += 1;
        assert.equal(mine, num(row[col("Toplam")]), `${query}: ${item.name} Tahsilat + Önceden Ödenen = rapor Toplam`);
        assert.equal(item.collected.opening, num(row[col("Önceden Ödenen (Açılış)")]), `${query}: ${item.name} açılış`);
        assert.equal(Math.round((item.collected.cheque + item.collected.note) * 100) / 100, num(row[col("Çek / Senet (alınan)")]), `${query}: ${item.name} çek + senet`);
      }
      assert.equal(compared, report.rows.length, `${query}: raporun her satırı karşılaştırıldı`);
      assert.ok(compared >= 5, `${query}: en az 5 cari karşılaştırıldı (${compared})`);
    }
  });

  it("(d) karşılıksız çıkan çek: raporun kuralıyla aynı (alınan çek tahsilattan düşmez; karşılıksız ayrı borç satırı) — eşdeğerlik korunur", async () => {
    await h.must("karşılıksız", h.api.post(`/api/workspace/cheques/${ids.cek.id}/actions`, { action: "bounce", date: TODAY }));
    const row = rowOf(await listOf("period=today"), ids.ayla.id);
    const report = await h.must("rapor", h.api.get(`/api/workspace/report-center/cari-tahsilat?from=${TODAY}&to=${TODAY}`));
    const r = report.rows.find(item => item[report.headers.indexOf("Cari")] === "Ayla Kaya");
    assert.equal(row.collected.total, num(r[report.headers.indexOf("Toplam")]), "rapor ile aynı");
    assert.deepEqual([row.collected.cheque, row.collected.note], [400, 500]);
  });

  // Yardımcı içe aktarımı testin İÇİNDE: eski kodda (yardımcı yok) yalnız bu iki test kırmızı olur, öbürleri kendi nedeniyle (ders 38).
  const helper = () => import("../server/lib/account-collections.mjs");
  it("(d) dönem sınırları sahte saatle: gece yarısı, ay başı, yıl başı (pazartesi başlangıçlı hafta)", async () => {
    const { periodOf } = await helper();
    assert.deepEqual(periodOf("today", "2026-11-01"), { key: "today", from: "2026-11-01", to: "2026-11-01" });
    assert.deepEqual(periodOf("yesterday", "2026-11-01"), { key: "yesterday", from: "2026-10-31", to: "2026-10-31" }, "ay başında dün önceki ayın son günü");
    assert.deepEqual(periodOf("yesterday", "2027-01-01"), { key: "yesterday", from: "2026-12-31", to: "2026-12-31" }, "yıl başında dün önceki yıl");
    assert.deepEqual(periodOf("week", "2027-01-01"), { key: "week", from: "2026-12-28", to: "2027-01-03" }, "yıl dönümünü aşan hafta");
    assert.deepEqual(periodOf("week", "2026-10-25"), { key: "week", from: "2026-10-19", to: "2026-10-25" }, "pazar haftanın son günü");
    assert.deepEqual(periodOf("week", "2026-10-26"), { key: "week", from: "2026-10-26", to: "2026-11-01" }, "pazartesi yeni hafta");
    assert.deepEqual(periodOf("month", "2028-02-15"), { key: "month", from: "2028-02-01", to: "2028-02-29" }, "artık yıl şubat");
    assert.deepEqual(periodOf("month", "2026-12-31"), { key: "month", from: "2026-12-01", to: "2026-12-31" });
    assert.equal(periodOf("", "2026-10-20"), null);
    assert.ok(periodOf("range", "2026-10-20", { from: "2026-02-30", to: "2026-03-01" }).error, "geçersiz gün");
  });

  it("(d) dönem sınırı: bitiş günü DAHİL, ertesi gün HARİÇ; başlangıçtan önceki gün HARİÇ — yardımcı, bellek içi küçük veri tabanıyla (program ileri tarihli hareketi zaten reddeder)", async () => {
    const { collectionsByAccount } = await helper();
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE accounts (id TEXT, deleted_at TEXT); CREATE TABLE account_entries (id TEXT, account_id TEXT, kind TEXT, amount REAL, date TEXT, method TEXT, source TEXT DEFAULT '', source_id TEXT DEFAULT '', fin_ref TEXT DEFAULT '');
      CREATE TABLE plans (id TEXT, account_id TEXT, deleted_at TEXT); CREATE TABLE plan_entries (id TEXT, plan_id TEXT, kind TEXT, amount REAL, date TEXT, method TEXT, opening INTEGER DEFAULT 0, cheque_id TEXT DEFAULT '');
      CREATE TABLE cheques (id TEXT, instrument TEXT);
      INSERT INTO accounts VALUES ('x', NULL), ('silik', '2026-10-01');
      INSERT INTO account_entries (id, account_id, kind, amount, date, method) VALUES ('e0', 'x', 'in', 1, '2026-10-18', 'cash'), ('e1', 'x', 'in', 10, '2026-10-19', 'cash'), ('e2', 'x', 'in', 100, '2026-10-20', 'card'), ('e3', 'x', 'in', 1000, '2026-10-21', 'bank'), ('e4', 'silik', 'in', 5, '2026-10-20', 'cash');
      INSERT INTO plans VALUES ('p', 'x', NULL), ('psil', 'x', '2026-10-02');
      INSERT INTO plan_entries (id, plan_id, kind, amount, date, method) VALUES ('q1', 'p', 'in', 20, '2026-10-20', 'cash'), ('q2', 'psil', 'in', 7, '2026-10-20', 'cash'), ('q3', 'p', 'out', 3, '2026-10-20', 'cash');`);
    const store = { all: (sql, ...args) => db.prepare(sql).all(...args), get: (sql, ...args) => db.prepare(sql).get(...args) };
    const of = (from, to) => collectionsByAccount(store, { from, to }).get("x");
    assert.deepEqual(pick(of("2026-10-19", "2026-10-20")), [130, 30, 100, 0, 0, 0, 0, 0], "19 ve 20 dahil; 18 ve 21 hariç; silinmiş cari / kart, iade sayılmaz");
    assert.deepEqual(pick(of("2026-10-20", "2026-10-20")), [120, 20, 100, 0, 0, 0, 0, 0]);
    assert.deepEqual(pick(of("2026-10-21", "2026-10-21")), [1000, 0, 0, 1000, 0, 0, 0, 0]);
    assert.equal(collectionsByAccount(store, { from: "2026-10-20", to: "2026-10-20" }).has("silik"), false, "silinmiş cari yok");
  });

  it("(d) Grup Özeti PDF ve Excel ekranla aynı: satırlar, sütunlar, TOPLAM", async () => {
    const { pdfText, xlsxRows } = await import("./fixtures/rapor-dosya-oku.mjs");
    const s = await summaryOf("period=today");
    const pdf = await h.client.raw("GET", "/api/workspace/accounts/group-summary.pdf?period=today&title=Cari");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer);
    for (const label of ["Cari Grup Özeti", "A Grubu", "1. Sınıf", "Alt Grupsuz", "C Grubu (Boş)", "Grupsuz", "TOPLAM", "Tahsilat", "Nakit", "POS", "Havale / EFT", "Çek", "Senet", "Önceden Ödenen (Açılış)", "Bugün"]) assert.ok(text.includes(label), `PDF'te "${label}"`);
    assert.ok(!text.includes("Diğer"), "Diğer sütunu yok (değer yok)");
    const xlsx = await h.client.raw("GET", "/api/workspace/accounts/group-summary.xlsx?period=today&title=Cari");
    assert.equal(xlsx.status, 200);
    const rows = xlsxRows(xlsx.buffer);
    const head = rows.findIndex(row => row[0] === "Grup");
    assert.ok(head >= 0, "başlık satırı");
    assert.deepEqual(rows[head], ["Grup", "Cari", "Bakiye", "Taksitlerden Kalan", "Gecikmiş Borç", "Geciken Taksit", "Tahsilat", "Nakit", "POS", "Havale / EFT", "Çek", "Senet", "Önceden Ödenen (Açılış)"]);
    const body = rows.slice(head + 1);
    const total = body.find(row => row[0] === "TOPLAM");
    assert.ok(total, "Excel'de TOPLAM satırı");
    assert.equal(num(total[6]), s.totals.collected.total);
    assert.equal(num(body.find(row => row[0] === "A Grubu")[6]), 1500);
    assert.equal(body.filter(row => row[0] && row[0] !== "TOPLAM").length, s.groups.length + s.groups.reduce((acc, row) => acc + row.subgroups.length, 0), "satır sayısı ekranla aynı (alt gruplar dahil)");
  });

  it("(d) Liste PDF / Excel: dönem seçiliyse Tahsilat sütunu; Excel'in 'Gecikmiş Borç' sütunu dolu (önceden 'Geciken' başlığı hep boştu)", async () => {
    const { pdfText, xlsxRows } = await import("./fixtures/rapor-dosya-oku.mjs");
    const pdf = pdfText((await h.client.raw("GET", "/api/workspace/accounts/liste.pdf?period=today&paid=1&title=Cari")).buffer);
    for (const label of ["Tahsilat", "Bugün", "Bu Dönemde Ödeme Yapanlar", "Ali Kaya", "Nur Su"]) assert.ok(pdf.includes(label), `liste PDF'inde "${label}"`);
    assert.ok(!pdf.includes("Arda Kaya"), "ödeme yapmayan PDF'te yok");
    const rows = xlsxRows((await h.client.raw("GET", "/api/workspace/accounts/export.xlsx?period=today&title=Cari")).buffer);
    const head = rows.findIndex(row => row.includes("Cari No"));
    const header = rows[head];
    for (const label of ["Gecikmiş Borç", "Tahsilat", "Nakit", "POS", "Havale / EFT", "Çek", "Senet", "Diğer", "Önceden Ödenen (Açılış)"]) assert.ok(header.includes(label), `Excel başlığı "${label}"`);
    assert.ok(!header.includes("Geciken"), "eski boş 'Geciken' başlığı yok");
    const ali = rows.find(row => row[header.indexOf("Ad / Unvan")] === "Ali Kaya" && num(row[header.indexOf("Tahsilat")]) > 0);
    assert.equal(num(ali[header.indexOf("Tahsilat")]), 600);
    const bora = rows.find(row => row[header.indexOf("Ad / Unvan")] === "Bora Er");
    assert.equal(num(bora[header.indexOf("Gecikmiş Borç")]), 330, "Gecikmiş Borç sütunu dolu (Bora: 130 + 200)");
    const total = rows.find(row => row[header.indexOf("Ad / Unvan")] === "TOPLAM");
    assert.equal(num(total[header.indexOf("Tahsilat")]), 1630);
    const plain = xlsxRows((await h.client.raw("GET", "/api/workspace/accounts/export.xlsx?title=Cari")).buffer);
    assert.ok(!plain.some(row => row.includes("Tahsilat")), "dönemsiz Excel'de Tahsilat sütunu yok");
  });

  it("(e) yetki: Cari'yi görmeyen özel rol 403; personel (Carileri Görme) görür — cari kartının defterinde de her tahsilatı görüyor", async () => {
    const role = await h.must("özel rol", h.api.post("/api/admin/roles", { name: "Yalnız Stok", permissions: ["stock.view"] }));
    await h.must("kullanıcı", h.api.post("/api/admin/users", { username: "stokcu", name: "Stokçu", role: role.id, password: "Stokcu-2026!", mustChangePassword: false }));
    const stok = h.server.client();
    assert.equal((await stok.login("stokcu", "Stokcu-2026!")).status, 200);
    for (const url of ["/api/workspace/accounts?period=today", "/api/workspace/accounts/group-summary?period=today", "/api/workspace/accounts/group-summary.pdf?period=today", "/api/workspace/accounts/group-summary.xlsx?period=today"]) {
      const res = await stok.raw("GET", url);
      assert.equal(res.status, 403, `${url}: ${res.status}`);
    }
    await h.must("personel", h.api.post("/api/admin/users", { username: "personel9", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
    const staff = h.server.client();
    await staff.login("personel9", "Personel-2026!");
    const seen = unwrap(await staff.get("/api/workspace/accounts/group-summary?period=today"));
    assert.equal(seen.status, 200);
    assert.equal(seen.data.totals.collected.total, 1630);
  });
});
