// 2.5.1 D3 — devir ön izleme UÇLARI (docs/devir/D3-D4-TASARIM.md §3.9, §3.11 madde 10, 12, 38–42): yetki (system.manage), kesim tarihi / seçenek reddi, aynı şirkette tek ön izleme,
// iş parçacığı = iş parçacığısız (bayt bayt), belirlenimli, veri damgası, iki şirket, 001'de ortak katman sayılmaz, Devir Raporu PDF / Excel = ekran, bakım kipi → bayat, iş parçacığı
// öldürülünce veri aynı. Veri programın KENDİ API'sinden (ders 3: her yanıtın kodu + gövdesi + veri tabanındaki sayı okunur).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf, boot, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const routes = await import("../server/routes/devir.mjs");
const worker = await import("../server/lib/devir/plan-worker.mjs").catch(() => null);
const K = "2026-12-31";
const NOW = "2027-01-20T12:00:00+03:00";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const need = () => assert.ok(worker && typeof routes.runPreviewWorker === "function", "D3 ön izleme yok (eski kod)");

async function finished(api, id) {
  for (let i = 0; i < 600; i += 1) {
    const job = await api.get(`/api/admin/devir/preview/${id}`);
    if (job.status !== 200) return job;
    if (job.data.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}
async function preview(api, body) {
  const started = await api.post("/api/admin/devir/preview", body);
  if (started.status !== 200) return started;
  return finished(api, started.data.id);
}
const fingerprint = store => store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(({ name }) => {
  const row = store.get(`SELECT COUNT(*) AS n FROM ${name}`);
  return `${name}:${row.n}`;
}).join("|");

describe("D3 devir ön izleme uçları", () => {
  let ctx;
  let api;
  let second;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: NOW, fixed: true } });
    api = ctx.api;
    ids.c1 = (await must("C1", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer" }))).id;
    ids.c2 = (await must("C2 aynı ad", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", force: true }))).id;
    const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 20 }];
    await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-06-01", lines: line(1000), payment: { ...pay, dueDate: "2026-07-01" }, force: true }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${ids.c2}/entries`, { kind: "in", amount: "250", date: "2026-08-01", note: "Avans" }));
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "500", description: "Gelir", date: "2026-12-31" }));
    await must("ocak kasa", api.post("/api/workspace/cash", { kind: "in", amount: "70", description: "Ocak", date: "2027-01-01" }));
    second = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    second.id = second.id || second.company?.id;
    const q = `?hofCompany=${encodeURIComponent(second.id)}`;
    const res = await api.client.post(`/api/workspace/cash${q}`, { kind: "in", amount: "999", description: "002", date: "2026-05-05" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  });
  after(() => ctx?.server.close());

  it("yetki: yalnız system.manage — Muhasebe ve Personel 403, oturumsuz 401", async () => {
    need();
    const accounting = apiOf(await createUser(ctx.server, api.client, { username: "muh-d3", role: "muhasebe" }));
    const staff = apiOf(await createUser(ctx.server, api.client, { username: "per-d3", role: "personel" }));
    assert.equal((await accounting.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K })).status, 403);
    assert.equal((await staff.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K })).status, 403);
    const anonymous = apiOf(ctx.server.client());
    assert.equal((await anonymous.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K })).status, 401);
  });

  it("ret: K 31 Aralık değil (400 DEVIR_K_31_ARALIK), geçmiş yıl değil (400 DEVIR_K_GELECEK), seçenek geçersiz (400), şirket yok (404), ön izleme yok (404)", async () => {
    need();
    const bad = async (body, status, code) => {
      const res = await api.post("/api/admin/devir/preview", body);
      assert.equal(res.status, status, JSON.stringify(res));
      if (code) assert.equal(res.code, code);
    };
    await bad({ company: "sirket-001", cutoff: "2026-11-30" }, 400, "DEVIR_K_31_ARALIK");
    await bad({ company: "sirket-001", cutoff: "2027-12-31" }, 400, "DEVIR_K_GELECEK");
    await bad({ company: "sirket-001", cutoff: K, option: "yarim" }, 400, "DEVIR_SECENEK");
    await bad({ company: "yok", cutoff: K }, 404);
    assert.equal((await api.get("/api/admin/devir/preview/onizleme-yok")).status, 404);
  });

  it("sonuç: plan + ön denetim + rapor; aynı adlı iki cari ayrı; K günündeki kayıt arşivde, K+1'deki yeni yılda (madde 9); budama sayıları ortak katmanı saymaz (madde 42)", async () => {
    need();
    const job = await preview(api, { company: "sirket-001", cutoff: K });
    assert.equal(job.status, 200);
    assert.equal(job.data.state, "done", JSON.stringify(job.data.error));
    const { plan, onDenetim, rapor, zamanlama } = job.data.result;
    assert.deepEqual(plan.sorunlar, []);
    assert.deepEqual(plan.degismezler.filter(row => !row.ok), []);
    const c1 = plan.newYear.cariler.find(row => row.cari === ids.c1);
    const c2 = plan.newYear.cariler.find(row => row.cari === ids.c2);
    assert.deepEqual([c1.kBakiyeMinor, c2.kBakiyeMinor], [120000, -25000], "aynı adlı iki cari kimlikle ayrılır");
    assert.equal(plan.newYear.kasa.minor, 75000, "31.12 kasa girişi arşivde (250 + 500), 01.01 yeni yılda");
    const cash = plan.newYear.budama.find(row => row.table === "cash_entries");
    assert.deepEqual([cash.kOncesi, cash.kSonrasi], [1, 1]);
    for (const table of ["users", "roles", "sessions", "mobile_access", "mobile_codes", "mobile_devices", "mobile_sessions"]) assert.equal(plan.newYear.budama.some(row => row.table === table), false, table);
    assert.equal(typeof onDenetim.gecebilir, "boolean");
    assert.ok(onDenetim.uyarir.some(row => row.kod === "yeniden-baslatma"), "001 yeniden başlatma uyarısı");
    assert.ok(rapor.rows.length > 5 && rapor.headers.length === 6);
    for (const key of ["okuma", "yevmiye", "tekBorcSirasi", "degerleme", "onDenetim", "plan", "rapor", "toplam"]) assert.equal(typeof zamanlama[key], "number", key);
    assert.equal(plan.meta.calismaKimligi, "devir-2026");
    assert.equal(plan.meta.acilisGunu, "2027-01-01");
  });

  it("belirlenimli + iş parçacığı = iş parçacığısız: aynı veride iki ön izleme bayt bayt aynı plan; şirket örneğinin kendi hizmetleriyle (runPreview) de aynı", async () => {
    need();
    const first = (await preview(api, { company: "sirket-001", cutoff: K })).data;
    const a = first.result;
    const b = (await preview(api, { company: "sirket-001", cutoff: K })).data.result;
    assert.equal(JSON.stringify(a.plan), JSON.stringify(b.plan));
    // D3 tur 4 (uzman görüşü (6)): raporun Özet'i ön izlemeyi hazırlayanı ve anını taşır — iş parçacığısız yola AYNI iş bilgisi verilir (fark yalnız bunlardan doğmasın).
    const preparer = a.rapor.rows.find(row => row[0] === "Özet" && row[1] === "Ön İzlemeyi Hazırlayan")[2];
    const inline = worker.runPreview({ store: ctx.app.store, ledger: ctx.app.context.ledger, job: { K, today: "2027-01-20", option: "borc-alacak", company: a.plan.meta.sirket, isRoot: true, hazirlayan: preparer, hazirlanma: first.startedAt } });
    assert.equal(JSON.stringify(inline.plan), JSON.stringify(a.plan));
    assert.deepEqual(inline.rapor.rows, a.rapor.rows);
  });

  it("veri damgası: ön izlemeden sonra girilen kayıt damgayı değiştirir (madde 38)", async () => {
    need();
    const before = (await preview(api, { company: "sirket-001", cutoff: K })).data.result.plan.meta.veriSurumu;
    await must("yeni kayıt", api.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "in", amount: "10", date: "2027-01-15", note: "Sonra" }));
    const after = (await preview(api, { company: "sirket-001", cutoff: K })).data.result.plan.meta.veriSurumu;
    assert.notEqual(before, after);
  });

  it("aynı şirkette tek ön izleme: eşzamanlı iki istek aynı işi döndürür (madde 39)", async () => {
    need();
    const [x, y] = await Promise.all([api.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K }), api.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K })]);
    assert.equal(x.status, 200);
    assert.equal(y.status, 200);
    assert.equal(x.data.id, y.data.id, "ikinci istek süren işe katılır");
    assert.equal(Boolean(x.data.joined) || Boolean(y.data.joined), true);
    await finished(api, x.data.id);
  });

  it("iki şirket: 002'nin planı yalnız 002'nin verisi (madde 12)", async () => {
    need();
    const job = await preview(api, { company: second.id, cutoff: K });
    assert.equal(job.data.state, "done", JSON.stringify(job.data.error));
    const plan = job.data.result.plan;
    assert.equal(plan.newYear.kasa.minor, 99900);
    assert.equal(plan.newYear.cariler.length, 0);
    assert.equal(plan.meta.sirket.id, second.id);
    assert.equal(job.data.result.onDenetim.uyarir.some(row => row.kod === "yeniden-baslatma"), false, "002 canlı takas — yeniden başlatma yok");
  });

  it("Devir Raporu: ekran = PDF = Excel (aynı satırlar, TOPLAM satırları); yazım düzeni", async () => {
    need();
    const job = await preview(api, { company: "sirket-001", cutoff: K });
    const rapor = job.data.result.rapor;
    const xlsx = await api.raw("GET", `/api/admin/devir/preview/${job.data.id}/report.xlsx`);
    assert.equal(xlsx.status, 200);
    const sheets = xlsxSheets(xlsx.buffer);
    const sheet = sheets["Devir Raporu"];
    assert.ok(sheet, Object.keys(sheets).join(","));
    const header = sheet.findIndex(row => row[0] === "Bölüm");
    assert.deepEqual(sheet[header], rapor.headers);
    const body = sheet.slice(header + 1).filter(row => row.length && row[0]);
    assert.equal(body.length, rapor.rows.length, "Excel satır sayısı = ekran");
    // Excel hücresi sayıya çevrilebilen kodu (100, 120) sayı olarak yazar; metin olarak karşılaştırılır.
    assert.deepEqual(body.map(row => [row[0], String(row[1]), row[2]]), rapor.rows.map(row => [row[0], row[1], row[2]]));
    const totals = rapor.rows.filter(row => row[1] === "TOPLAM").map(row => row[2]);
    assert.ok(totals.includes("Borç Bakiyeli Hesaplar") && totals.includes("Alacak Bakiyeli Hesaplar"), totals.join(" | "));
    // D3 tur 3 (DEVİR NEDEN DURDU): ön denetimin iki ayrı başlığı en başta ("Devri Durduran Nedenler", "Uyarılar").
    // D3 tur 4 (uzman görüşü (6)): en başta "Özet" (hazırlayan, kalem sayıları, uyarılar / istisnalar) — beklentisi değişen.
    assert.deepEqual([...new Set(rapor.rows.map(row => row[0]))], ["Özet", "Devri Durduran Nedenler", "Uyarılar", "Hesaplar", "Kapanış", "Modüller", "Hareketler", "Listeler"]);
    const pdf = await api.raw("GET", `/api/admin/devir/preview/${job.data.id}/report.pdf`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer);
    for (const word of ["Devir Raporu", "Hesaplar", "Kapanış", "Modüller", "Hareketler", "Listeler", "TOPLAM"]) assert.ok(text.includes(word), word);
    const { titleCase } = await import("../server/lib/text-case.mjs");
    for (const name of [...rapor.headers, ...rapor.rows.map(row => row[0])]) assert.equal(titleCase(name), name, `yazım düzeni: ${name}`);
  });

  it("bakım kipi ön izleme sürerken açılırsa sonuç bayat (madde 40)", async () => {
    need();
    const started = await must("ön izleme", api.post("/api/admin/devir/preview", { company: second.id, cutoff: K }));
    await ctx.app.maintenance.enter(second.id, { reason: "devir", runId: "test-d3" });
    await new Promise(resolve => setTimeout(resolve, 800));
    await ctx.app.maintenance.exit(second.id);
    const job = await finished(api, started.id);
    assert.equal(job.data.state, "done");
    assert.equal(job.data.stale, true);
  });

  it("iş parçacığı öldürülünce veri aynı; sonraki ön izleme baştan ve aynı sonuç (madde 10)", async () => {
    need();
    const fresh = (await preview(api, { company: "sirket-001", cutoff: K })).data.result.plan;
    const before = fingerprint(ctx.store);
    const handle = routes.runPreviewWorker({ dbPath: ctx.app.config.dbPath, time: new Date().toISOString(), job: { K, today: "2027-01-20", option: "borc-alacak", company: fresh.meta.sirket, isRoot: true } });
    const settled = handle.promise.then(() => "bitti", error => `kesildi: ${error.message}`);
    await handle.terminate();
    assert.match(await settled, /kesildi|bitti/);
    assert.equal(fingerprint(ctx.store), before, "veri tabanı aynı");
    const again = (await preview(api, { company: "sirket-001", cutoff: K })).data.result.plan;
    assert.equal(JSON.stringify(again), JSON.stringify(fresh));
  });
});
