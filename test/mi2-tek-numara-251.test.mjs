// 2.5.1 Mİ tur 2 — TEK TAKSİT NUMARASI HER YERDE (S-Mİ1-1 = A).
// KULLANICI KARARI 27.11 08:06 UTC (AYNEN: "önerini uygula"): ekranda taksit numarası boşluksuz 1, 2, 3 (vade sırası) olmuştu; müşteriye giden çıktılar eski saklanan
// numarayı yazıyordu — müşteriye gidenler de aynı numaraya geçer (tek numara HER YERDE). Saklanan sıra (plan_items.seq) veride DEĞİŞMEZ (göç yok).
// BAŞ MİMAR KARARI 27.11 (3): makbuz (ekran + PDF), taksit kartı PDF'i, Taksitler listesi (ekran + PDF), cari ekstresi (ekran + PDF + Excel), WhatsApp ekstresi (elle),
// Tablo, zil / takvim / Vade Takip, Rapor Merkezi'nin taksit numarası yazan raporları — ve taramada bulunan fatura penceresinin "Bu Faturayı Kapatanlar"ı.
// (5) Para / bakiye / gecikmiş / tahsilat sayıları DEĞİŞMEZ (aşağıda elle beklenen sayılarla).
// Beklenen numaralar ELLE (kartın vade sırasından). Sayılar yanıt gövdesinden ve dosyadan (PDF / Excel metni) okunur (ders 3). Sahte DURAĞAN saat (ders 13).
// Tur 1 kodunda (t251-mi-tur1) KIRMIZI: makbuz / ekstre / zil / raporlar / WhatsApp / fatura penceresi saklanan sırayı ("3. taksit") yazıyor.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const flat = rows => rows.map(row => row.map(cell => String(cell ?? "")).join(" | "));

describe("Mİ tur 2 — taksiti silinmiş / vadesi değişmiş kartta ekran, makbuz, PDF, Excel, ekstre, WhatsApp, zil, raporlar AYNI numarayı yazar", () => {
  let h;
  before(async () => {
    const server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const tick = () => server.clock.advance({ minutes: 1 });
    const api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      put: async (url, body) => unwrap(await client.put(url, body)),
      del: async url => unwrap(await client.del(url)),
    };
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      tick();
      return res.data;
    };
    const file = async url => {
      const res = await client.raw("GET", url);
      assert.equal(res.status, 200, `${url}: ${res.status}`);
      return res.buffer;
    };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    let n = 0;
    const account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Mİ2 ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 252 ${String(10 + (n += 1)).padStart(2, "0")} 00` }));
    const card = (acc, total, count, firstDue, extra = {}) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-120), total: String(total), accountId: acc.id, mode: "auto", count: String(count), firstDue, everyMonths: "1", ...extra }));
    const win = planId => must("kart penceresi", api.get(`/api/workspace/plans/${planId}`));
    const pay = async (planId, amount, itemId, date) => {
      const before = new Set((await win(planId)).entries.map(entry => entry.id));
      const after = await must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date, cashForce: true, similarOk: true, itemId }));
      return after.entries.find(entry => !before.has(entry.id));
    };
    h = { server, client, api, must, file, account, card, win, pay };

    // A — "Silinmiş": 3 taksit (06.08 / 06.09 / 06.10.2026), 2.'si SİLİNİR → saklanan sıra 1, 3; görünen 1, 2. Toplam 2.000'e indirilir (taksitlerin toplamı).
    h.a = await account("Silinmiş");
    h.aPlan = await card(h.a, 3000, 3, "2026-08-06");
    const items = (await win(h.aPlan.id)).items;
    await must("2. taksiti sil", api.del(`/api/workspace/plans/${h.aPlan.id}/items/${items[1].id}`));
    await must("kart tutarı 2.000", api.put(`/api/workspace/plans/${h.aPlan.id}`, { ...(await win(h.aPlan.id)), total: "2000" }));
    h.aFirst = items[0];
    h.aThird = items[2];
    h.aPay1 = await pay(h.aPlan.id, 1000, h.aFirst.id, day(-3));
    h.aPay2 = await pay(h.aPlan.id, 400, h.aThird.id, day(-2));

    // B — "Aynı Vade": 2 taksit (06.08 / 06.09), sonradan 06.08 vadeli üçüncü taksit eklenir (saklanan 3) → vade sırası: saklanan 1 (06.08), 3 (06.08), 2 (06.09).
    h.b = await account("Aynı Vade");
    h.bPlan = await card(h.b, 2000, 2, "2026-08-06");
    await must("kart tutarı 3.000", api.put(`/api/workspace/plans/${h.bPlan.id}`, { ...(await win(h.bPlan.id)), total: "3000" }));
    await must("aynı vadeli taksit ekle", api.post(`/api/workspace/plans/${h.bPlan.id}/items`, { dueDate: "2026-08-06", amount: "1000" }));
    h.bAdded = (await win(h.bPlan.id)).items.find(item => item.seq === 3);
    h.bPay = await pay(h.bPlan.id, 300, h.bAdded.id, day(-1));

    // C — kayda bağlı kart (Tablo): programdan "Yeni Kayıt" ile açılan kayda bağlı kart, 1. taksiti silinir.
    await must("yeni kayıt", api.post("/api/workspace/records", { values: { "Ad Soyad": "Mİ2 Kayıt Kişisi", Telefon: "0500 252 99 00" }, caseKey: "mi2-kayit-1" }));
    h.cPlan = await must("kayda bağlı kart", api.post("/api/workspace/plans", { name: "Mİ2 Kayıt Kişisi", phone: "0500 252 99 00", registeredOn: day(-120), total: "2000", mode: "auto", count: "2", firstDue: "2026-09-01", everyMonths: "1", caseKey: "mi2-kayit-1", caseTitle: "Mİ2 Kayıt Kişisi" }));
    const cItems = (await win(h.cPlan.id)).items;
    await must("kayıt kartı 1. taksiti sil", api.del(`/api/workspace/plans/${h.cPlan.id}/items/${cItems[0].id}`));
    await must("kayıt kartı tutarı 1.000", api.put(`/api/workspace/plans/${h.cPlan.id}`, { ...(await win(h.cPlan.id)), total: "1000" }));
    h.cPay = await pay(h.cPlan.id, 250, cItems[1].id, day(-1));

    // D — taksitli fatura: 3 taksit; 3.'nün vadesi 1.'nin önüne alınır (saklanan 3 → görünen 1); o taksite tahsilat faturayı kısmen kapatır.
    h.d = await account("Faturalı");
    const stock = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "MI2-HZM", name: "Mİ2 Hizmet", unit: "Adet", salePrice: "100" }));
    const invoice = await must("taksitli fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: h.d.id, issueDate: day(-90), lines: [{ itemId: stock.id, qty: 1, unitPrice: "3000", vatRate: 0 }], payment: { rest: "installments", installments: { count: 3, firstDue: day(-60), everyMonths: 1 } } }));
    h.dInvoice = invoice;
    h.dPlanId = invoice.planId;
    assert.ok(h.dPlanId, "faturanın taksit kartı açıldı");
    const dItems = (await win(h.dPlanId)).items;
    h.dThird = dItems[2];
    await must("3. taksitin vadesi öne", api.put(`/api/workspace/plans/${h.dPlanId}/items/${h.dThird.id}`, { dueDate: day(-75), amount: String(dItems[2].amount) }));
    h.dPay = await pay(h.dPlanId, 500, h.dThird.id, day(-1));
  });
  after(async () => h?.server.close());

  it("kart penceresi: saklanan 1, 3 → görünen 1, 2; para sayıları (Toplam 2.000, Tahsil Edilen 1.400, Kalan 600) ELLE", async () => {
    const w = await h.win(h.aPlan.id);
    assert.deepEqual(w.items.map(item => [item.seq, item.no, item.dueDate]), [[1, 1, "2026-08-06"], [3, 2, "2026-10-06"]]);
    assert.deepEqual([w.totals.total, w.totals.paid, w.totals.remaining], [2000, 1400, 600], "para sayıları değişmedi");
    assert.deepEqual([w.next.id, w.next.no, w.next.remaining], [h.aThird.id, 2, 600], "sıradaki taksit: 2. (saklanan 3)");
    const acc = await h.must("cari kartı", h.api.get(`/api/workspace/accounts/${h.a.id}`));
    assert.equal(acc.totals.balance, 600, "cari bakiyesi 600");
  });

  it("makbuz PDF'i (anlık üretilir): '2. taksit (vade 06.10.2026)' — saklanan '3. taksit' değil", async () => {
    const second = pdfText(await h.file(`/api/workspace/plans/${h.aPlan.id}/entries/${h.aPay2.id}/makbuz.pdf`)).replace(/\s+/g, " ");
    assert.ok(second.includes("2. taksit (vade 06.10.2026)"), `makbuzda '2. taksit (vade 06.10.2026)': ${second.slice(0, 600)}`);
    assert.ok(!second.includes("3. taksit"), "makbuzda saklanan '3. taksit' yok");
    const first = pdfText(await h.file(`/api/workspace/plans/${h.aPlan.id}/entries/${h.aPay1.id}/makbuz.pdf`)).replace(/\s+/g, " ");
    assert.ok(first.includes("1. taksit (vade 06.08.2026)"), "ilk makbuz '1. taksit'");
  });

  it("taksit kartı PDF'i (ekstre / Yazdır): taksit satırları '1.' ve '2.' — '3.' satırı yok", async () => {
    const lines = pdfText(await h.file(`/api/workspace/plans/${h.aPlan.id}/ekstre.pdf`)).split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim());
    // Her hücre ayrı metin satırı: "NO" sütunundaki "N." hücresinin ardından vade hücresi gelir.
    const rows = lines.flatMap((line, index) => (/^\d+\.$/.test(line) && /^\d{2}\.\d{2}\.\d{4}$/.test(lines[index + 1] || "") ? [`${line} ${lines[index + 1]}`] : []));
    assert.deepEqual(rows, ["1. 06.08.2026", "2. 06.10.2026"], `kart PDF'inin taksit satırları: ${JSON.stringify(rows)}`);
  });

  it("Taksitler listesi (ekran + PDF): sıradaki '06.10.2026 · 2. taksit'", async () => {
    const list = await h.must("Taksitler", h.api.get(`/api/workspace/plans?q=${encodeURIComponent("Mİ2 Silinmiş")}&status=all`));
    const row = list.plans.find(plan => plan.id === h.aPlan.id);
    assert.deepEqual([row.next.id, row.next.no, row.next.seq], [h.aThird.id, 2, 3]);
    const pdf = pdfText(await h.file(`/api/workspace/plans/liste.pdf?q=${encodeURIComponent("Mİ2 Silinmiş")}&status=all`)).replace(/\s+/g, " ");
    assert.ok(pdf.includes("06.10.2026 · 2. taksit"), `liste PDF'inde '06.10.2026 · 2. taksit': ${pdf.slice(0, 400)}`);
    assert.ok(!pdf.includes("3. taksit"), "liste PDF'inde '3. taksit' yok");
  });

  it("cari ekstresi — ekran (cari kartı), PDF, Anlık Durum ekstresi (ekran / PDF / Excel): 'Taksit Tahsilatı · 1. taksit' ve '· 2. taksit'", async () => {
    const want = ["Taksit Tahsilatı · 1. taksit", "Taksit Tahsilatı · 2. taksit"];
    const acc = await h.must("cari kartı", h.api.get(`/api/workspace/accounts/${h.a.id}`));
    assert.deepEqual(acc.ledger.filter(line => line.kind === "plan-in").map(line => line.label), want, "cari kartının ekstresi");
    const pdf = pdfText(await h.file(`/api/workspace/accounts/${h.a.id}/ekstre.pdf`)).replace(/\s+/g, " ");
    for (const label of want) assert.ok(pdf.includes(label), `cari ekstre PDF'inde '${label}'`);
    assert.ok(!pdf.includes("3. taksit"), "cari ekstre PDF'inde '3. taksit' yok");
    const ov = await h.must("Anlık Durum ekstresi", h.api.get(`/api/workspace/overview/ekstre?account=${h.a.id}&preset=all`));
    assert.deepEqual(ov.lines.filter(line => line.kind === "plan-in").map(line => line.label), want, "Anlık Durum ekstresi (ekran)");
    const ovPdf = pdfText(await h.file(`/api/workspace/overview/ekstre.pdf?account=${h.a.id}&preset=all`)).replace(/\s+/g, " ");
    for (const label of want) assert.ok(ovPdf.includes(label), `Anlık Durum ekstre PDF'inde '${label}'`);
    const ovXlsx = flat(xlsxRows(await h.file(`/api/workspace/overview/ekstre.xlsx?account=${h.a.id}&preset=all`))).join("\n");
    for (const label of want) assert.ok(ovXlsx.includes(label), `Anlık Durum ekstre Excel'inde '${label}'`);
    assert.ok(!ovXlsx.includes("3. taksit"), "Excel'de '3. taksit' yok");
  });

  it("Rapor Merkezi: Cari Ekstre, Tüm Cari Hareketleri, Taksit Tahsilatları (+ Excel / PDF), Taksit Vadeleri, Geciken Taksitler — '2. taksit'", async () => {
    const report = async (id, query = "") => h.must(id, h.api.get(`/api/workspace/report-center/${id}?preset=all${query}`));
    const ekstre = flat((await report("cari-ekstre", `&account=${h.a.id}`)).rows).join("\n");
    assert.ok(ekstre.includes("Taksit Tahsilatı · 2. taksit") && !ekstre.includes("3. taksit"), `Cari Ekstre: ${ekstre}`);
    const moves = flat((await report("cari-hareketleri")).rows).filter(row => row.includes("Mİ2 Silinmiş"));
    assert.deepEqual(moves.map(row => row.split(" | ")[2]).filter(label => label.startsWith("Taksit Tahsilatı")), ["Taksit Tahsilatı · 1. taksit", "Taksit Tahsilatı · 2. taksit"], "Tüm Cari Hareketleri");
    const taken = await report("taksit-tahsilatlari");
    const col = taken.headers.indexOf("Taksit");
    const mine = taken.rows.filter(row => row.includes("Mİ2 Silinmiş"));
    assert.deepEqual(mine.map(row => row[col]), ["1. taksit", "2. taksit"], "Taksit Tahsilatları");
    const xlsx = flat(xlsxRows(await h.file("/api/workspace/report-center/taksit-tahsilatlari/xlsx?preset=all"))).filter(row => row.includes("Mİ2 Silinmiş"));
    assert.ok(xlsx.length === 2 && xlsx.some(row => row.includes("2. taksit")) && !xlsx.some(row => row.includes("3. taksit")), `Taksit Tahsilatları Excel: ${JSON.stringify(xlsx)}`);
    const pdf = pdfText(await h.file("/api/workspace/report-center/taksit-tahsilatlari/pdf?preset=all")).replace(/\s+/g, " ");
    assert.ok(pdf.includes("2. taksit") && !pdf.includes("3. taksit"), "Taksit Tahsilatları PDF");
    const dues = await report("taksit-vadeleri", "");
    const dueCol = dues.headers.indexOf("Taksit");
    assert.deepEqual(dues.rows.filter(row => row.includes("Mİ2 Silinmiş")).map(row => row[dueCol]), ["1. taksit", "2. taksit"], "Taksit Vadeleri");
    const late = await report("geciken-taksitler", "");
    const lateCol = late.headers.indexOf("Taksit");
    assert.deepEqual(late.rows.filter(row => row.includes("Mİ2 Silinmiş")).map(row => row[lateCol]), ["2. taksit"], "Geciken Taksitler (yalnız kalanı olan)");
  });

  it("WhatsApp ekstresi (elle, wa.me metni): 'Taksit Tahsilatı · 2. taksit'", async () => {
    const data = await h.must("WhatsApp alıcıları", h.api.post("/api/workspace/whatsapp/targets", { kind: "statement", ids: [h.a.id], preset: "all" }));
    const text = data.recipients[0].statement;
    assert.ok(text.includes("Taksit Tahsilatı · 1. taksit") && text.includes("Taksit Tahsilatı · 2. taksit"), text);
    assert.ok(!text.includes("3. taksit"), "WhatsApp metninde '3. taksit' yok");
  });

  it("zil / takvim ve Vade Takip: kalem etiketi '2. taksit'", async () => {
    const dues = await h.must("zil", h.api.get("/api/workspace/dues"));
    assert.deepEqual(dues.items.filter(item => item.planId === h.aPlan.id).map(item => item.label), ["2. taksit"], "zil / takvim");
    const vade = await h.must("Vade Takip", h.api.get("/api/workspace/overview/vade-takip?preset=all"));
    const rows = vade.rows.filter(row => row.party === "Mİ2 Silinmiş" && row.source === "plan").map(row => row.label);
    assert.deepEqual(rows, ["2. taksit (kalan)"], `Vade Takip (kısmen ödendi → "(kalan)"): ${JSON.stringify(rows)}`);
  });

  it("ödenmiş taksite yeniden tahsilat: 409 iletisi 'Seçilen 1. taksit ödendi' (görünen numara)", async () => {
    const res = await h.api.post(`/api/workspace/plans/${h.aPlan.id}/entries`, { kind: "in", amount: "10", method: "cash", date: day(0), cashForce: true, similarOk: true, itemId: h.aFirst.id });
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(res.data), /Seçilen 1\. taksit ödendi/);
  });

  it("AYNI VADELİ iki taksit: sıra saklanan sıradan (1 → 1., sonradan eklenen 3 → 2.); makbuz '2. taksit (vade 06.08.2026)'", async () => {
    const w = await h.win(h.bPlan.id);
    assert.deepEqual(w.items.map(item => [item.seq, item.no, item.dueDate]), [[1, 1, "2026-08-06"], [3, 2, "2026-08-06"], [2, 3, "2026-09-06"]]);
    const text = pdfText(await h.file(`/api/workspace/plans/${h.bPlan.id}/entries/${h.bPay.id}/makbuz.pdf`)).replace(/\s+/g, " ");
    assert.ok(text.includes("2. taksit (vade 06.08.2026)"), `makbuz: ${text.slice(0, 500)}`);
    const acc = await h.must("cari kartı", h.api.get(`/api/workspace/accounts/${h.b.id}`));
    assert.deepEqual(acc.ledger.filter(line => line.kind === "plan-in").map(line => line.label), ["Taksit Tahsilatı · 2. taksit"]);
  });

  it("Tablo (kayda bağlı kart): taksit bloğu '1.' (saklanan 2) ve işlem geçmişi '· 1. taksit'", async () => {
    const data = await h.must("kaydın kartları", h.api.get("/api/workspace/cases/mi2-kayit-1/plans"));
    const plan = data.plans.find(item => item.id === h.cPlan.id);
    assert.ok(plan, "kayda bağlı kart Tablo'da");
    assert.deepEqual(plan.items.map(item => [item.seq, item.no]), [[2, 1]]);
    assert.equal(plan.next.no, 1);
    const activity = await h.must("kaydın geçmişi", h.api.get("/api/workspace/cases/mi2-kayit-1/activity"));
    const row = JSON.stringify(activity).includes('"itemNo":1');
    assert.ok(row, `geçmişte itemNo 1: ${JSON.stringify(activity).slice(0, 600)}`);
  });

  it("fatura penceresi 'Bu Faturayı Kapatanlar': vadesi öne alınan taksitin tahsilatı '· 1. taksit' (saklanan 3)", async () => {
    const w = await h.win(h.dPlanId);
    const moved = w.items.find(item => item.id === h.dThird.id);
    assert.deepEqual([moved.seq, moved.no], [3, 1]);
    const inv = await h.must("fatura", h.api.get(`/api/workspace/invoices/${h.dInvoice.id}`));
    const labels = (inv.closers || []).map(item => item.label).filter(label => label.startsWith("Taksit Tahsilatı"));
    assert.ok(labels.includes("Taksit Tahsilatı · 1. taksit"), `kapatanlar: ${JSON.stringify(inv.closers)}`);
    assert.ok(!labels.some(label => label.includes("3. taksit")), "kapatanlarda '3. taksit' yok");
    assert.equal(inv.paid, 500, "faturanın ödeneni 500 (sayı değişmedi)");
  });
});
