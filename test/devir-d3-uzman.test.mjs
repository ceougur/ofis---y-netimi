// 2.5.1 D3 TUR 4 — UZMAN GÖRÜŞÜ (kullanıcı 27.11 iletti) → BAŞ MİMAR KARARLARI 27.11 (kullanıcıya gösterildi), saf hesap tarafı:
// (1) uzmanın İLK KABUL TESTİ AYNEN: "Aralıkta 10.000 TL fatura kesilsin ve 4.000 TL tahsil edilsin. Devirden önce 2 Ocak'a 1.000 TL banka tahsilatı girilsin. Devir 5 Ocak'ta
//     çalıştırıldığında açılış 6.000 TL, Ocak tahsilatı 1.000 TL, güncel açık bakiye 5.000 TL görünmeli. Yaşlandırma raporu da faturanın orijinal vadesini göstermeli." — burada: planın cari
//     açılışı 6.000 (K = 31.12, sahte saat 05.01), açık kalemin kalanı, ASIL VADESİ, belge numarası ve tarihi; K sonrası 1.000 tahsilat yeni yılda AYNEN kalır (budanmaz, açılışa katılmaz);
//     devirli = devirsiz (05.01'de bakiye 5.000, gecikmiş aynı). Ekran / rapor tarafı (Ocak tahsilatı raporu, yaşlandırma) devri uygulayan pakette.
// (2) ön izlemeden sonra veri değişti mi — SORULABİLEN tek işlev (plan-reader.mjs onIzlemedenSonraDegisti) + iletisi (iletiler.mjs onIzlemeBayatIletisi; DURDURUR).
// (3) ön izleme e-Belge servisine HİÇ istek göndermez, kullanım kaydını değiştirmez (sahte EDM'ye istek 0; kullanım satırları aynı).
// (6) Devir Raporu başlığında ön izlemeyi hazırlayan, aktarılan kalem sayıları, uyarılar / istisnalar — ekran = PDF = Excel.
// Veri programın KENDİ API'sinden; beklenen sayılar ELLE.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { apiOf, boot, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const readerModule = await import("../server/lib/devir/plan-reader.mjs").catch(() => null);
const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 4 — uzmanın ilk kabul testi (saf hesap): açılış 6.000, Ocak tahsilatı 1.000 yeni yılda, 05.01'de bakiye 5.000, asıl vade", () => {
  let ctx;
  let api;
  const ids = {};
  const jobs = {};
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.u = (await must("cari", api.post("/api/workspace/accounts", { name: "Uzman Müşterisi", type: "customer" }))).id;
    ids.v = (await must("vadesiz cari", api.post("/api/workspace/accounts", { name: "Vadesiz Müşteri", type: "customer" }))).id;
    ids.bank = (await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "0", confirmed: true } }))).id;
    const invoice = await must("Aralık faturası", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.u, issueDate: "2026-12-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: 10000, discountRate: 0, vatRate: 0 }], payment: { ...pay, dueDate: "2026-12-20" }, force: true }));
    ids.f = invoice.id;
    await must("Aralık tahsilatı", api.post(`/api/workspace/accounts/${ids.u}/entries`, { kind: "in", amount: "4000", date: "2026-12-15", note: "Aralık", method: "cash", cashForce: true }));
    ids.jan = (await must("2 Ocak banka tahsilatı", api.post(`/api/workspace/accounts/${ids.u}/entries`, { kind: "in", amount: "1000", date: "2027-01-02", note: "Ocak", method: "bank", bankAccountId: ids.bank }))).entryId;
    ids.fv = (await must("vadesiz fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.v, issueDate: "2026-12-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: pay, force: true }))).id;
    if (planModule) {
      jobs.a = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
      jobs.b = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "sadece-bakiye" });
    }
  });
  after(() => ctx?.server.close());

  const rowOf = (job, key) => job.result.plan.newYear.cariler.find(row => row.cari === ids[key]);

  it("veri tabanı (ders 3): fatura 10.000 (vade 20.12.2026), Aralık tahsilatı 4.000, 02.01.2027 banka tahsilatı 1.000", () => {
    const rows = ctx.store.all("SELECT kind, amount, date FROM account_entries WHERE account_id = ? AND kind = 'in' ORDER BY date", ids.u).map(row => [row.kind, Number(row.amount), row.date]);
    assert.deepEqual(rows, [["in", 4000, "2026-12-15"], ["in", 1000, "2027-01-02"]]);
    const inv = ctx.store.get("SELECT try_payable AS p, due_date AS d, issue_date AS i, number FROM invoices WHERE id = ?", ids.f);
    assert.deepEqual([Number(inv.p), inv.d, inv.i], [10000, "2026-12-20", "2026-12-01"]);
    ids.no = inv.number;
  });

  it("(1) planın cari açılışı 6.000 (iki seçenek): açık kalem 6.000 — ASIL VADE 20.12.2026, belge no ve tarihi; Ocak tahsilatı açılışa girmez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    for (const job of [jobs.a, jobs.b]) {
      assert.equal(job.state, "done", JSON.stringify(job.error));
      const row = rowOf(job, "u");
      assert.equal(row.kBakiyeMinor, 600000, "açılış (K bakiyesi) 6.000");
      assert.equal(row.satirlar.reduce((sum, line) => sum + (line.yon === "debt" ? line.tutarMinor : -line.tutarMinor), 0), 600000, "devir satırlarının toplamı 6.000");
      const open = row.satirlar.filter(line => line.tur === "acik-kalem");
      assert.deepEqual(open.map(line => [line.tutarMinor, line.vade, line.belge.no, line.belge.tarih, line.aciklama]), [[600000, "2026-12-20", ids.no, "2026-12-01", `Devir: ${ids.no} (01.12.2026)`]]);
      assert.equal(row.satirlar.some(line => line.tarih !== "2027-01-01"), false, "devir satırları K+1 tarihli");
    }
    assert.deepEqual(rowOf(jobs.a, "u").satirlar.filter(line => line.tur !== "acik-kalem").map(line => [line.tur, line.yon, line.tutarMinor]), [["borc-toplami", "debt", 400000], ["alacak-toplami", "credit", 400000]]);
    assert.deepEqual(rowOf(jobs.b, "u").satirlar.filter(line => line.tur !== "acik-kalem"), [], "Sadece Bakiyeyi Aktar: net 0 → yalnız açık kalem");
  });

  it("(1) K sonrası 1.000 tahsilat yeni yılda AYNEN kalır: budanmaz (K sonrası sayımda), açılışa katılmaz, bağ listesinde yok (bağsız)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const entries = jobs.a.result.plan.newYear.budama.find(row => row.table === "account_entries");
    const after = ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE date > ?", K).n;
    assert.equal(entries.kSonrasi, after);
    assert.ok(after >= 1);
    assert.equal(jobs.a.result.plan.newYear.baglar.some(link => link.satir === ids.jan), false);
  });

  it("(1) DEVİRLİ = DEVİRSİZ 05.01.2027: bakiye 5.000, gecikmiş 5.000 (vade 20.12.2026); vadesiz fatura belge günüyle (10.12.2026) gecikmişte", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    for (const job of [jobs.a, jobs.b]) {
      for (const key of ["u", "v"]) {
        for (const out of eq.compare(ids[key], rowOf(job, key), K, ["2027-01-01", "2027-01-03", "2027-01-05", "2027-02-01"], { redirect: true })) {
          assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
          assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
        }
      }
      const [u] = eq.compare(ids.u, rowOf(job, "u"), K, ["2027-01-05"], { redirect: true });
      assert.deepEqual([u.devirli, u.kalemDevirli, u.sinceDevirli], [500000, ["2026-12-20|500000"], "2026-12-20"]);
      const balance = rowOf(job, "u").satirlar.reduce((sum, line) => sum + (line.yon === "debt" ? line.tutarMinor : -line.tutarMinor), 0) - 100000;
      assert.equal(balance, 500000, "güncel açık bakiye 5.000 (açılış 6.000 − Ocak tahsilatı 1.000)");
      const v = rowOf(job, "v").satirlar.filter(line => line.tur === "acik-kalem");
      assert.deepEqual(v.map(line => [line.tutarMinor, line.vade]), [[200000, "2026-12-10"]], "vadesiz: vade = belge günü");
    }
  });

  it("(2) veri damgası: giriş, ekranları okuma, rapor indirme ve ikinci ön izleme DEĞİŞTİRMEZ; tahsilat girişi ve var olan kaydın tutar düzeltmesi DEĞİŞTİRİR", async () => {
    assert.ok(readerModule?.onIzlemedenSonraDegisti, "onIzlemedenSonraDegisti yok (eski kod)");
    const { onIzlemedenSonraDegisti } = readerModule;
    const plan = jobs.a.result.plan;
    assert.deepEqual(onIzlemedenSonraDegisti(ctx.store, plan).degisti, false, "hemen sonra");
    await loginAdmin(ctx.server);
    for (const url of ["/api/workspace/accounts", `/api/workspace/accounts/${ids.u}`, "/api/workspace/invoices", "/api/admin/period-lock"]) await ctx.api.get(url);
    await ctx.api.raw("GET", `/api/admin/devir/preview/${jobs.a.id}/report.pdf`);
    await ctx.api.raw("GET", `/api/admin/devir/preview/${jobs.a.id}/report.xlsx`);
    const again = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    assert.equal(again.result.plan.meta.veriSurumu, plan.meta.veriSurumu, "ikinci ön izleme aynı damga");
    assert.equal(onIzlemedenSonraDegisti(ctx.store, plan).degisti, false, "giriş / okuma / indirme sonrası");
    await must("yeni tahsilat", api.post(`/api/workspace/accounts/${ids.v}/entries`, { kind: "in", amount: "50", date: "2027-01-05", note: "Sonra", method: "cash", cashForce: true }));
    const after = onIzlemedenSonraDegisti(ctx.store, plan);
    assert.equal(after.degisti, true, "kayıt girildi");
    assert.equal(after.onceki, plan.meta.veriSurumu);
    const now = after.simdiki;
    const entry = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND amount = 50", ids.v);
    const count = ctx.store.get("SELECT COUNT(*) AS n FROM account_entries").n;
    await must("tutar düzelt", api.put(`/api/workspace/accounts/${ids.v}/entries/${entry.id}`, { kind: "in", amount: "60", date: "2027-01-05", note: "Sonra", method: "cash", cashForce: true }));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries").n, count, "satır sayısı aynı (düzeltme)");
    assert.equal(onIzlemedenSonraDegisti(ctx.store, now).degisti, true, "var olan kaydın düzeltmesi");
  });

  it("(2) ileti: 'Ön İzlemeden Sonra Kayıt Girildi' — DURDURUR, dört alan, yeni ön izlemeyi inceleyip yeniden onaylayın", () => {
    assert.ok(iletiModule?.onIzlemeBayatIletisi, "ileti yok (eski kod)");
    const ileti = iletiModule.onIzlemeBayatIletisi({ onIzlemeAni: "2027-01-05T10:15:00.000Z" });
    assert.deepEqual(iletiModule.iletiDenetimi(ileti), []);
    assert.equal(ileti.seviye, "durdurur");
    assert.match(ileti.neOldu, /ön izlemeden \(05\.01\.2027 10:15\) sonra/);
    assert.match(ileti.neden, /devir durdu/);
    assert.deepEqual(ileti.neYapmali, ["Yıl Sonu Devri'nde Ön İzleme'yi yeniden başlatın.", "Yeni ön izlemenin sayılarını ve Devir Raporu'nu inceleyin.", "Sayılar doğruysa devri yeniden onaylayın."]);
    katalogaYaz("devir-d3-uzman", "işlev + ileti (kullanımı devri uygulayan pakette): ön izlemeden sonra tahsilat girildi", ileti, "olgu (D4 kullanır)");
  });

  it("(6) Devir Raporu başlığı: hazırlayan, aktarılan kalem sayıları, uyarılar / istisnalar — en başta 'Özet' bölümü; ekran = PDF = Excel", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const rapor = jobs.a.result.rapor;
    assert.equal(rapor.rows[0][0], "Özet", "rapor Özet bölümüyle başlar");
    const ozet = new Map(rapor.rows.filter(row => row[0] === "Özet").map(row => [row[1], row[2]]));
    const user = ctx.app.store.get("SELECT display_name AS d, username AS u FROM users ORDER BY rowid LIMIT 1");
    assert.equal(ozet.get("Ön İzlemeyi Hazırlayan"), user.d || user.u);
    assert.match(ozet.get("Ön İzlemenin Hazırlandığı An"), /^\d{2}\.\d{2}\.\d{4} saat \d{2}:\d{2}$/);
    assert.equal(ozet.get("Aktarılan Cari"), "2 cari (2 cari kartı yeni yıla geçer)");
    assert.equal(ozet.get("Açık Fatura"), "2 satış (8.000,00 TL) · 0 alış (0,00 TL)");
    assert.equal(ozet.get("Fatura Dışı Açık Kalem"), "0 kalem");
    assert.equal(ozet.get("Devri Durduran Neden"), "Yok");
    assert.match(ozet.get("Uyarı"), /^\d+ uyarı \(Uyarılar bölümünde\)$/);
    assert.equal(ozet.get("İstisnalar"), "Yok");
    assert.equal(new Map(rapor.summary).get("Ön İzlemeyi Hazırlayan"), user.d || user.u, "başlık kutusu");
    const pdf = await ctx.api.raw("GET", `/api/admin/devir/preview/${jobs.a.id}/report.pdf`);
    const text = pdfText(pdf.buffer).replace(/\n/g, " ");
    for (const [label, value] of ozet) {
      assert.ok(text.includes(label), `PDF: ${label}`);
      assert.ok(text.includes(value), `PDF: ${value}`);
    }
    const sheet = xlsxSheets((await ctx.api.raw("GET", `/api/admin/devir/preview/${jobs.a.id}/report.xlsx`)).buffer)["Devir Raporu"];
    const excel = sheet.filter(row => row[0] === "Özet").map(row => [String(row[1]), row[2]]);
    assert.deepEqual(excel, [...ozet.entries()], "Excel = ekran");
  });
});

describe("D3 tur 4 — (3) ön izleme e-Belge servisine istek GÖNDERMEZ, kullanım kaydını DEĞİŞTİRMEZ", () => {
  let edm;
  let server;
  let api;
  let requests = 0;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    requests += 1;
    return globalThis.fetch(input, init);
  };
  const usageFile = () => {
    const walk = dir => {
      for (const entry of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = walk(full);
          if (found) return found;
        } else if (entry.name === "e-belge-kullanim.sqlite") return full;
      }
      return "";
    };
    return walk(server.dataDir || "");
  };
  const usageCounts = () => {
    const company = ["edoc_usage", "edoc_usage_meta", "edoc_usage_defter"].map(table => (server.app.store.get("SELECT 1 AS f FROM sqlite_master WHERE type = 'table' AND name = ?", table) ? server.app.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n : -1));
    const file = usageFile();
    let machine = -1;
    if (file) {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        machine = db.prepare("SELECT COUNT(*) AS n FROM usage").get().n;
      } finally {
        db.close();
      }
    }
    return { company, machine };
  };
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl, now: { time: "2026-12-30T10:00:00+03:00", fixed: true } });
    api = apiOf(await loginAdmin(server));
    await must("ayarlar", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const person = await must("kişi", api.post("/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka", email: "ayse@example.com" }));
    const sale = (label, issueDate, extra = {}) => must(label, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person.id, issueDate, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra }));
    const sent = await sale("gönderilen", "2026-12-30", { eSend: "later" });
    await must("gönder", api.post(`/api/workspace/invoices/${sent.id}/send`, {}));
    server.clock.set("2026-12-31T10:00:00+03:00");
    await sale("bekleyen", "2026-12-31", { eSend: "later" });
    server.clock.set("2027-01-20T10:00:00+03:00");
  });
  after(async () => {
    await server?.close();
    await edm?.close?.();
  });

  it("sahte EDM'ye istek 0; şirketin ve makinenin kullanım satırları aynı; ön denetim bekleyen belgeyi yine söyler (sayım veriden)", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const calls = edm.state.calls.length;
    const before = requests;
    const usage = usageCounts();
    assert.ok(usage.company[0] >= 0, "kullanım tablosu var");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    await api.raw("GET", `/api/admin/devir/preview/${job.id}/report.pdf`);
    await api.raw("GET", `/api/admin/devir/preview/${job.id}/report.xlsx`);
    assert.equal(edm.state.calls.length - calls, 0, "sahte EDM'ye istek");
    assert.equal(requests - before, 0, "dışarı istek");
    assert.deepEqual(usageCounts(), usage, "kullanım satırları");
    assert.ok(job.result.onDenetim.durdurur.some(row => row.kod === "e-belge-bekleyen"), job.result.onDenetim.durdurur.map(row => row.kod).join(", "));
  });
});
