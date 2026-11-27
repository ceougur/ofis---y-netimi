// 2.5.1 D3 TUR 5 — VERİ DAMGASI ve arka plan yazıcıları (tur 4 raporu DOĞRULANMADI-4; BM-T4-2 KABUL — "veri damgasının iz türleri listesi bu turda sınanır"). Uzman görüşü (2) → BAŞ MİMAR
// KARARI 27.11: ön izlemeden sonra veri değiştiyse devir DURUR (kullanımı devri uygulayan pakette — plan-reader.mjs onIzlemedenSonraDegisti). Kural: veriyi DEĞİŞTİRMEYEN yazım (zamanlanmış
// yedek, bütünlük taraması, analiz işçisi, defter dondurmasının boş turu, giriş / çıkış izi, şirket seçimi, ekran durumu, fatura PDF'i ve cari ekstresinin açılması) damgayı DEĞİŞTİRMEZ — yoksa
// devir sebepsiz durur; PARA TABLOSUNA yazan (tekrarlayan faturanın taslağı, taksit tahsilatı düzeltmesi, kayıt tahsilatı düzeltmesi, cari kartı düzeltmesi) DEĞİŞTİRİR — yoksa bayat ön
// izlemeyle devir sürer. Veri programın KENDİ API'sinden / kendi arka plan işlevlerinden (app.runDueBackups = zamanlayıcının turu; app.integrity.scanInBackground = 15 dakikalık tarama).
// Kayıt tahsilatı yolu gerçek kurulumda KAPALI (legacyCasePayments; ders 14) — testlerde açık; damgaya girmesi kapalı yolda zararsız.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";
import { loginAdmin } from "./helpers.mjs";

const reader = await import("../server/lib/devir/plan-reader.mjs").catch(() => null);
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 5 — veri damgası: veriyi değiştirmeyen yazım damgayı değiştirmez, para tablosuna yazan değiştirir", () => {
  let ctx;
  let api;
  let plan;
  let second;
  const ids = {};
  const changed = () => reader.onIzlemedenSonraDegisti(ctx.store, plan).degisti;
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.acc = (await must("cari", api.post("/api/workspace/accounts", { name: "Damga Carisi", type: "customer" }))).id;
    ids.inv = (await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.acc, issueDate: "2026-12-10", lines: line(500), payment: { ...pay, dueDate: "2026-12-20" }, force: true }))).id;
    ids.plan = (await must("kart", api.post("/api/workspace/plans", { name: "Damga Carisi", registeredOn: "2026-11-01", total: "900", accountId: ids.acc, mode: "auto", count: "3", firstDue: "2026-12-01" }))).id;
    ids.planEntry = (await must("taksit tahsilatı", api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "300", date: "2026-12-05", method: "cash" }))).entryId;
    ids.payment = (await must("kayıt tahsilatı", api.post("/api/workspace/cases/DAMGA-1/payments", { amount: "250", date: "2026-12-06", method: "cash", note: "Kayıt", caseTitle: "Damga Kaydı" }))).id;
    const made = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    second = made.company || made;
    const job = reader ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
    plan = job?.result?.plan;
  });
  after(() => ctx?.server.close());

  it("ön izlemenin damgası = okuyucunun damgası; hemen sonra 'değişmedi'", () => {
    assert.ok(reader?.onIzlemedenSonraDegisti, "veri damgası işlevi yok (eski kod)");
    assert.match(plan.meta.veriSurumu, /^[0-9a-f]{24}$/);
    assert.equal(plan.meta.veriSurumu, reader.devirVeriSurumu(ctx.store));
    assert.equal(changed(), false);
  });

  it("v-1 ARKA PLAN (veriyi değiştirmeyen): zamanlanmış yedeğin turu, bütünlük taraması, analiz işçisi, defter dondurmasının boş turu → damga AYNI", async () => {
    assert.ok(reader?.onIzlemedenSonraDegisti, "veri damgası işlevi yok (eski kod)");
    const before = ctx.store.get("SELECT COUNT(*) AS n FROM audit_events").n;
    const backups = await ctx.app.runDueBackups();
    assert.ok(Array.isArray(backups) || backups === undefined || typeof backups === "object", "zamanlayıcının turu koştu");
    assert.equal(changed(), false, "zamanlanmış yedek");
    await must("elle yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }));
    assert.equal(changed(), false, "elle yedek (system.backup_created izi)");
    await ctx.app.integrity.scanInBackground();
    assert.equal(changed(), false, "bütünlük taraması");
    await must("analiz", api.get("/api/workspace/insight"));
    assert.equal(changed(), false, "analiz işçisi");
    await ctx.app.ledger.snapshots.runPending();
    assert.equal(changed(), false, "defter dondurmasının boş turu");
    assert.ok(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events").n > before, "yazımlar iz bıraktı (yedek izi) — damga yine aynı");
  });

  it("v-1 KULLANICI (veriyi değiştirmeyen): ikinci giriş + çıkış, şirket seçimi (002 ↔ 001), ekran durumu, fatura PDF'i, cari ekstresi, Devir Raporu PDF'i → damga AYNI", async () => {
    assert.ok(reader?.onIzlemedenSonraDegisti, "veri damgası işlevi yok (eski kod)");
    const other = await loginAdmin(ctx.server);
    assert.equal(changed(), false, "giriş (auth.login + oturum satırı)");
    assert.equal((await other.post("/api/auth/logout", {})).status, 200);
    assert.equal(changed(), false, "çıkış");
    await must("002 seç", api.post("/api/companies/select", { id: second.id }));
    await must("001 seç", api.post("/api/companies/select", { id: "sirket-001" }));
    assert.equal(changed(), false, "şirket seçimi (company.selected izi bu dosyada)");
    await must("ekran durumu", api.put("/api/workspace/client-state", { key: "syncMinutes", value: "7" }));
    assert.equal(changed(), false, "ekran durumu (settings.client.updated)");
    const pdf = await api.raw("GET", `/api/workspace/invoices/${ids.inv}/fatura.pdf`);
    assert.equal(pdf.status, 200);
    assert.ok(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'invoice.pdf'").n >= 1, "fatura PDF'i iz yazdı (invoice.pdf)");
    assert.equal(changed(), false, "fatura PDF'inin açılması");
    const ekstre = await api.raw("GET", `/api/workspace/accounts/${ids.acc}/ekstre.pdf`);
    assert.equal(ekstre.status, 200);
    assert.ok(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.statement.exported'").n >= 1, "ekstre iz yazdı");
    assert.equal(changed(), false, "cari ekstresinin açılması");
  });

  it("v-2 PARA TABLOSUNA YAZAN: cari kartı düzeltmesi, taksit tahsilatı tutar düzeltmesi, kayıt tahsilatı tutar düzeltmesi, tekrarlayan faturanın taslağı → damga DEĞİŞİR (her biri ayrı)", async () => {
    assert.ok(reader?.onIzlemedenSonraDegisti, "veri damgası işlevi yok (eski kod)");
    const step = async (label, run) => {
      const base = reader.devirVeriSurumu(ctx.store);
      const counts = ["payments", "plan_entries", "invoices", "accounts"].map(table => ctx.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n).join("/");
      await run();
      const after = ["payments", "plan_entries", "invoices", "accounts"].map(table => ctx.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n).join("/");
      assert.equal(reader.onIzlemedenSonraDegisti(ctx.store, base).degisti, true, `${label}: damga değişmeli (satır sayıları ${counts} → ${after})`);
      return { counts, after };
    };
    const card = await step("cari kartı düzeltmesi", () => must("cari düzelt", api.put(`/api/workspace/accounts/${ids.acc}`, { name: "Damga Carisi", phone: "05321234567" })));
    assert.equal(card.counts, card.after, "satır sayısı değişmedi — damgayı iz değiştirdi");
    const entry = await step("taksit tahsilatı düzeltmesi (300 → 280)", () => must("tahsilat düzelt", api.put(`/api/workspace/plans/${ids.plan}/entries/${ids.planEntry}`, { amount: "280" })));
    assert.equal(entry.counts, entry.after, "satır sayısı değişmedi");
    assert.equal(ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", ids.planEntry).amount, 280);
    const payment = await step("kayıt tahsilatı düzeltmesi (250 → 240)", () => must("kayıt tahsilatı düzelt", api.put(`/api/workspace/payments/${ids.payment}`, { amount: "240", date: "2026-12-06", method: "cash", note: "Kayıt" })));
    assert.equal(payment.counts, payment.after, "satır sayısı değişmedi — tur 4'ün iz listesinde kayıt tahsilatı yoktu");
    assert.equal(ctx.store.get("SELECT amount FROM payments WHERE id = ?", ids.payment).amount, 240);
    // Tekrarın günü gelecekte (15.02); saat 16.02'ye ilerleyince fatura listesinin açılışı günü gelen tekrarı taslak olarak yazar (routes/invoices.mjs safeRepeats).
    await must("tekrar", api.post(`/api/workspace/invoices/${ids.inv}/repeat`, { everyMonths: 1, nextDate: "2027-02-15" }));
    ctx.server.clock.set("2027-02-16T09:00:00+03:00");
    const repeat = await step("tekrarlayan faturanın taslağı (gününde, listenin açılışında)", () => must("fatura listesi", api.get("/api/workspace/invoices")));
    assert.notEqual(repeat.counts, repeat.after, "taslak fatura yazıldı");
  });
});
