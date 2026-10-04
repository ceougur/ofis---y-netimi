// 2.0.23 — haftalık ekran testinde (04.10.2026, docs/EKRAN-HAFTA-TESTI-2026-10-04.md) bulunan hatalar; önce kırmızı yazıldı.
// Bulgu 2 (taksit kartı ↔ fatura kapama): aynı caride fatura ile taksit kartı birbirinin parasını saymamalı.
//   A/B/C/G: faturasız, ayrı borç yazan kart ("Yeni Borç") kendi borcunu, tahsilatını ve kapatılmasını kendi içinde tutar.
//   D: "Carinin Mevcut Borcu" kartına bölünen açık fatura birleşik listelerde (yaşlandırma, nakit akış, vade, takvim) bir kez.
//   E/F: taksitli fatura yalnız kendi kartıyla kapanır (fatura açığı = kartın kalanı); "Kapatılacak Fatura" ile bağ reddedilir.
// Bulgu 4: Banka ve POS Hareketleri raporunda "Yol" süzgeci (payMethod) uygulanır.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { inflateSync } from "node:zlib";
import { settleInvoices } from "../server/lib/invoice-settle.mjs";
import { tablePdf } from "../server/lib/report-pdf.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

// PDF'teki görünen metin (fatura-215 ile aynı yöntem): ToUnicode eşlemesiyle sayfa akışlarındaki glifler çözülür.
function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar|DCTDecode/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("2.0.23 Bulgu 2: taksit kartı ↔ fatura kapama", () => {
  let server;
  let api;
  let item;
  let n = 0;
  before(async () => {
    server = await startTestServer();
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      put: async (url, body) => unwrap(await client.put(url, body)),
    };
    item = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
  });
  after(async () => server.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return res.data;
  };
  const customer = async label => must("cari", api.post("/api/workspace/accounts", { name: `Deneme ${label}`, type: "customer", registeredOn: "2025-01-01", phone: `0500 000 10 ${String((n += 1)).padStart(2, "0")}` }));
  const sale = async (acc, date, amount, installments = null) => {
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: installments ? { rest: "installments", installments } : { rest: "open", dueDate: date } }));
    return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
  };
  const plan = async (acc, date, total, covers = false) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: date, total: String(total), accountId: acc.id, mode: "auto", count: "3", firstDue: "2025-06-01", ...(covers ? { coversBalance: true } : {}) }));
  const planIn = async (planId, date, amount) => must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount, date, method: "bank" }));
  const collect = async (acc, date, amount, extra = {}) => api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount, date, method: "cash", ...extra });
  const state = async (acc, invoiceId, planId) => {
    const inv = await must("fatura", api.get(`/api/workspace/invoices/${invoiceId}`));
    const card = planId ? await must("kart", api.get(`/api/workspace/plans/${planId}`)) : null;
    const account = (await must("cari", api.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(acc.name)}`))).accounts.find(a => a.id === acc.id);
    return { open: inv.open, paid: inv.paid, payState: inv.payState, cardLeft: card?.totals?.remaining, cardPaid: card?.totals?.paid, balance: account.balance };
  };

  test("A: önce fatura, sonra ayrı kart — kartın tahsilatı faturayı kapatmaz", async () => {
    const acc = await customer("A");
    const inv = await sale(acc, "2025-01-23", 12720);
    const card = await plan(acc, "2025-01-24", 9000);
    assert.equal((await collect(acc, "2025-01-25", 5000)).status, 200);
    await planIn(card.id, "2025-01-26", 3000);
    const s = await state(acc, inv.id, card.id);
    assert.deepEqual([s.paid, s.open, s.cardLeft, s.balance], [5000, 7720, 6000, 13720]);
    assert.equal(s.open + s.cardLeft, s.balance, "fatura açığı + kart kalanı = cari bakiye");
  });

  test("B: önce kart, sonra fatura — cari kartından alınan tahsilat faturaya sayılır, kaybolmaz", async () => {
    const acc = await customer("B");
    const card = await plan(acc, "2025-01-10", 9000);
    const inv = await sale(acc, "2025-01-28", 12720);
    assert.equal((await collect(acc, "2025-01-29", 5000)).status, 200);
    await planIn(card.id, "2025-01-30", 3000);
    const s = await state(acc, inv.id, card.id);
    assert.deepEqual([s.paid, s.open, s.cardLeft, s.balance], [5000, 7720, 6000, 13720]);
  });

  test("C: fatura hiç ödenmedi, kart tamamen ödendi — fatura 'Ödendi' görünmez", async () => {
    const acc = await customer("C");
    const inv = await sale(acc, "2025-02-01", 6000);
    const card = await plan(acc, "2025-02-02", 9000);
    for (const day of ["2025-02-03", "2025-02-04", "2025-02-05"]) await planIn(card.id, day, 3000);
    const s = await state(acc, inv.id, card.id);
    assert.deepEqual([s.paid, s.open, s.cardLeft, s.balance], [0, 6000, 0, 6000]);
    assert.notEqual(s.payState, "paid");
  });

  test("G: ayrı kartı kapatmak (kalanı silmek) ödenmemiş faturayı kapatmaz", async () => {
    const acc = await customer("G");
    const inv = await sale(acc, "2025-02-06", 12720);
    const card = await plan(acc, "2025-02-07", 9000);
    await planIn(card.id, "2025-02-08", 3000);
    await must("kartı kapat", api.put(`/api/workspace/plans/${card.id}`, { status: "closed" }));
    const s = await state(acc, inv.id, null);
    assert.deepEqual([s.paid, s.open, s.balance], [0, 12720, 12720]);
  });

  test("ayrı kartın borcunu aşan tahsilat artanı faturaya sayılır (para kaybolmaz)", async () => {
    const acc = await customer("Artan");
    const card = await plan(acc, "2025-02-09", 1000);
    const inv = await sale(acc, "2025-02-10", 2000);
    const over = await api.post(`/api/workspace/plans/${card.id}/entries`, { kind: "in", amount: 1500, date: "2025-02-11", method: "cash" });
    if (over.status !== 200) return; // kart fazla tahsilatı kabul etmiyorsa bu durum oluşamaz
    const s = await state(acc, inv.id, null);
    assert.deepEqual([s.paid, s.open, s.balance], [500, 1500, 1500]);
  });

  test("D: Mevcut Borç kartına bölünen fatura — fatura ve kart tutarlı; yaşlandırma, nakit akış, vade takip ve takvim bir kez sayar", async () => {
    const acc = await customer("D");
    const inv = await sale(acc, "2025-02-12", 12000);
    const card = await plan(acc, "2025-02-13", 12000, true);
    await planIn(card.id, "2025-02-14", 3000);
    const s = await state(acc, inv.id, card.id);
    assert.deepEqual([s.open, s.cardLeft, s.balance], [9000, 9000, 9000]);
    const aging = await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
    const row = aging.rows.find(r => r[0] === acc.name);
    assert.ok(row, "yaşlandırmada satır var");
    assert.equal(row.at(-1), "9.000,00 TL", `yaşlandırma toplamı ${row.at(-1)} (beklenen 9.000)`);
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?from=2025-01-01&to=2026-12-31&overdue=1&table=0"));
    const inFlow = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.direction === "in" && (r.party === acc.name || r.label?.includes(acc.name) || r.accountName === acc.name)).reduce((sum, r) => sum + r.amount, 0);
    assert.equal(Math.round(inFlow * 100) / 100, 9000, `nakit akışta bu caride beklenen giriş ${inFlow} (beklenen 9.000)`);
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const dueSum = dues.items.filter(r => r.source === "invoice" && (r.party === acc.name || r.person === acc.name || r.accountName === acc.name)).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    assert.equal(dueSum, 0, `takvimde bu carinin faturası ayrıca listelenmemeli (taksitleri kartından gelir), ${dueSum}`);
  });

  test("D (çok cari): 12 caride Mevcut Borç kartı — toplu bakiye yolu da her borcu bir kez sayar", async () => {
    // 8'den çok cari: bakiyeler cari başına ayrıntıdan değil toplu defterden (önbellekli) okunur; sonuç aynı olmalı.
    // X: kart faturayı taksitlendirir (fatura 1.200, karttan 300 → yaşlandırma 900, faturanın açığı ayrıca sayılmaz).
    // Y: kart faturayı DEĞİL önceki "Borç Yaz" borcunu (1.000) taksitlendirir; fatura 1.200 ayrı borçtur → 2.200.
    //    Burada bakiye yanlış okunursa (ör. 0) fatura yanlışlıkla düşülür; test bakiyenin doğru okunduğunu ayırt eder.
    const xs = [];
    const ys = [];
    for (let i = 0; i < 6; i += 1) {
      const acc = await customer(`Çok X${i}`);
      await sale(acc, "2025-02-15", 1200);
      const card = await plan(acc, "2025-02-16", 1200, true);
      await planIn(card.id, "2025-02-17", 300);
      xs.push(acc);
    }
    for (let i = 0; i < 6; i += 1) {
      const acc = await customer(`Çok Y${i}`);
      await must("borç yaz", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: 1000, date: "2025-02-14", note: "önceki borç" }));
      await plan(acc, "2025-02-15", 1000, true);
      await sale(acc, "2025-02-16", 1200);
      ys.push(acc);
    }
    const aging = await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
    for (const [list, expected] of [[xs, "900,00 TL"], [ys, "2.200,00 TL"]]) {
      for (const acc of list) {
        const row = aging.rows.find(r => r[0] === acc.name);
        assert.equal(row?.at(-1), expected, `${acc.name} yaşlandırma ${row?.at(-1)} (beklenen ${expected})`);
      }
    }
    const names = new Set([...xs, ...ys].map(acc => acc.name));
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?from=2025-01-01&to=2026-12-31&overdue=1&table=0"));
    const inFlow = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.direction === "in" && (names.has(r.party) || names.has(r.accountName))).reduce((sum, r) => sum + r.amount, 0);
    assert.equal(Math.round(inFlow * 100) / 100, 6 * 900 + 6 * 2200, `nakit akışta 12 carinin beklenen girişi ${inFlow} (beklenen 18.600)`);
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const dueOf = list => dues.items.filter(r => r.source === "invoice" && list.some(acc => [r.party, r.person, r.accountName].includes(acc.name))).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    assert.equal(dueOf(xs), 0, `takvimde X carilerinin faturası ayrıca listelenmemeli, ${dueOf(xs)}`);
    assert.equal(dueOf(ys), 6 * 1200, `takvimde Y carilerinin faturası (ayrı borç) listelenmeli, ${dueOf(ys)}`);
  });

  test("E: taksitli fatura + cari kartından bağsız tahsilat — fatura açığı = kendi kartının kalanı", async () => {
    const acc = await customer("E");
    const inv = await sale(acc, "2025-02-20", 3000, { count: 3, firstDue: "2025-03-20", everyMonths: 1 });
    assert.equal((await collect(acc, "2025-02-21", 5000)).status, 200);
    const s = await state(acc, inv.id, inv.planId || inv.plan?.id);
    assert.equal(s.open, s.cardLeft, `fatura açığı ${s.open} = kart kalanı ${s.cardLeft}`);
    assert.deepEqual([s.open, s.cardLeft], [3000, 3000]);
    assert.notEqual(s.payState, "paid");
  });

  test("F: taksitli faturaya 'Kapatılacak Fatura' bağı reddedilir; liste taksitli faturayı ayırt eder", async () => {
    const acc = await customer("F");
    const inv = await sale(acc, "2025-02-25", 3000, { count: 3, firstDue: "2025-03-25", everyMonths: 1 });
    const res = await collect(acc, "2025-02-26", 1000, { invoiceId: inv.id });
    assert.notEqual(res.status, 200, "taksitli faturaya bağlı tahsilat kabul edilmemeli");
    assert.match(String(res.data?.error || ""), /taksit/i);
    const list = await must("liste", api.get(`/api/workspace/invoices?tab=all&status=issued&side=sale&account=${acc.id}&limit=50`));
    assert.ok(list.invoices.find(i => i.id === inv.id)?.planId, "listede planId var (Kapatılacak Fatura seçeneklerinden ayıklanır)");
    const s = await state(acc, inv.id, inv.planId || inv.plan?.id);
    assert.deepEqual([s.open, s.cardLeft], [3000, 3000]);
  });

  test("taksitli fatura kendi kartından tahsil edilince fatura da kapanır (eski davranış korunur)", async () => {
    const acc = await customer("Kart");
    const inv = await sale(acc, "2025-03-01", 3000, { count: 3, firstDue: "2025-04-01", everyMonths: 1 });
    await planIn(inv.planId || inv.plan?.id, "2025-03-02", 1000);
    const s = await state(acc, inv.id, inv.planId || inv.plan?.id);
    assert.deepEqual([s.paid, s.open, s.cardLeft], [1000, 2000, 2000]);
  });

  test("Bulgu 4: Banka ve POS Hareketleri raporunda Yol süzgeci uygulanır", async () => {
    const acc = await customer("Yol");
    assert.equal((await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 300, date: "2025-04-05", method: "bank" })).status, 200);
    assert.equal((await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 700, date: "2025-04-06", method: "card" })).status, 200);
    const summary = data => Object.fromEntries(data.summary);
    const all = await must("tümü", api.get("/api/workspace/report-center/banka-pos-hareketleri?from=2025-04-01&to=2025-04-30"));
    const bank = await must("banka", api.get("/api/workspace/report-center/banka-pos-hareketleri?from=2025-04-01&to=2025-04-30&payMethod=bank"));
    const card = await must("pos", api.get("/api/workspace/report-center/banka-pos-hareketleri?from=2025-04-01&to=2025-04-30&payMethod=card"));
    assert.match(bank.subtitle, /^Banka \(Havale \/ EFT\)/);
    assert.match(card.subtitle, /^POS \/ Kredi Kartı/);
    assert.equal(summary(bank)["Dönem Giriş"], "300,00 TL");
    assert.equal(summary(card)["Dönem Giriş"], "700,00 TL");
    assert.equal(summary(all)["Dönem Giriş"], "1.000,00 TL");
  });
});

describe("2.0.23 Bulgu 2: kapama kuralı (saf fonksiyon)", () => {
  const line = (id, extra) => ({ id, date: "2025-01-01", at: "", debit: 0, credit: 0, ...extra });
  test("taksitli faturaya cari kartından bağ (eski veri) yok sayılır; fatura kendi kartının tahsilatıyla kapanır", () => {
    const invoices = [{ id: "inv", kind: "sale", status: "issued", payable: 3000, planId: "p1" }];
    const lines = [
      line("i", { origin: "invoice", sourceId: "inv", kind: "", debit: 3000 }),
      line("p", { origin: "plan", planId: "p1", kind: "plan", covers: true }),
      line("c", { origin: "", kind: "in", credit: 1000, date: "2025-01-02" }),
      line("pi", { origin: "plan", planId: "p1", kind: "plan-in", credit: 500, date: "2025-01-03" }),
    ];
    const out = settleInvoices({ lines, invoices, links: new Map(), today: "2025-02-01" });
    assert.equal(out.get("inv").paid, 500, "bağsız tahsilat taksitli faturayı kapatmaz; yalnız kart tahsilatı");
  });
  test("ayrı kartın satırları fatura sırasına girmez; artan ödeme havuza düşer", () => {
    const invoices = [{ id: "inv", kind: "sale", status: "issued", payable: 2000 }];
    // Kart borcu faturadan SONRA: eski kural (genel en eski borç sırası) kartın 1.500 tahsilatını önce faturaya verirdi
    // (ödenen 1.500); doğrusu kart kendi borcunu (1.000) kapatır, yalnız artan 500 faturaya sayılır.
    const lines = [
      line("i", { origin: "invoice", sourceId: "inv", kind: "", debit: 2000, date: "2025-01-02" }),
      line("p", { origin: "plan", planId: "p2", kind: "plan", covers: false, debit: 1000, date: "2025-01-03" }),
      line("pi", { origin: "plan", planId: "p2", kind: "plan-in", credit: 1500, date: "2025-01-04" }),
    ];
    const out = settleInvoices({ lines, invoices, links: new Map(), today: "2025-02-01" });
    assert.equal(out.get("inv").paid, 500);
  });
});

describe("2.0.23: PDF özet kutusunda uzun başlık kesilmez", () => {
  test("Kasa Hareketleri gibi 6 kutulu özette 'Güncel Kasa (tüm hareketler)' iki satıra iner, '…' ile kesilmez", () => {
    const summary = [["Devir", "2.409,43 TL"], ["Dönem Giriş", "84.693,95 TL"], ["Dönem Çıkış", "182.636,87 TL"], ["Dönem Net", "-97.942,92 TL"], ["Dönem Sonu Kasa", "-95.533,49 TL"], ["Güncel Kasa (tüm hareketler)", "-95.533,49 TL"]];
    const pdf = tablePdf({ title: "Kasa Hareketleri", subtitle: "20.01.2025 – 26.01.2025", headers: ["Tarih", "Açıklama", "Giriş"], types: ["", "", "money"], rows: [["20.01.2025", "Devir", "1,00 TL"]], summary });
    const text = pdfText(Buffer.from(pdf));
    assert.ok(!/Güncel Kasa \(tü…/.test(text), "başlık '…' ile kesilmemeli");
    assert.match(text.replace(/\n/g, " "), /Güncel Kasa \(tüm\s*hareketler\)/);
  });
  test("dar kutuda (8 kutu, dikey) uzun sözcük harf ortasından bölünmez: küçülür ya da tireyle bölünür (gözden geçirme)", () => {
    const summary = [["Taksitlendirilmiş Toplam", "1.234.567,89 TL"], ["Tahsil Edilen", "1,00 TL"], ["Vadesi Geçmiş Taksitler", "2,00 TL"], ["Kalan", "3,00 TL"], ["Önceden Ödenen (Açılış)", "4,00 TL"], ["Kart", "5"], ["Gecikmiş Kart", "6"], ["Ortalama Gecikme (gün)", "7"]];
    const text = pdfText(Buffer.from(tablePdf({ title: "Deneme", headers: ["A", "B", "C"], types: ["", "money", "money"], rows: [["x", "1,00 TL", "2,00 TL"]], summary })));
    assert.ok(!/Taksitlendiril\nmiş/.test(text), "tiresiz bölünmemeli");
    assert.match(text.replace(/-\n/g, "").replace(/\n/g, " "), /Taksitlendirilmiş Toplam/);
  });
});

// Bağımsız gözden geçirme (04.10.2026) bulguları; önce kırmızı yazıldı. Senaryolar gözden geçirme betiklerinden (s1, s4, s5, s6,
// s11): "Mevcut Borç" kartı açıldığı anda var olan borcu kapsar; sonradan kesilen fatura kapsanmaz (#2); stoktan taksitli
// satışın kartı ilgisiz faturayı kapatmaz (#4); taksitli faturada mahsup (#5), eski bağın düzeltilmesi (#6), sonradan
// taksitlendirme (#7), kendi kartında taksit iadesi ve kart tutarının Taksitler'den değiştirilmesi (#9).
describe("2.0.23 gözden geçirme: kapamanın kalan yolları", () => {
  let server;
  let api;
  let item;
  let goods;
  let n = 0;
  before(async () => {
    server = await startTestServer();
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      put: async (url, body) => unwrap(await client.put(url, body)),
    };
    item = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
    goods = (await api.post("/api/workspace/stock", { name: "Mal", code: "MAL", unit: "Adet", unitPrice: 10, salePrice: 20 })).data;
  });
  after(async () => server.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return res.data;
  };
  const customer = async label => must("cari", api.post("/api/workspace/accounts", { name: `Kalan ${label}`, type: "customer", registeredOn: "2025-01-01", phone: `0500 000 20 ${String((n += 1)).padStart(2, "0")}` }));
  const sale = async (acc, date, amount, installments = null, payment = {}) => {
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: installments ? { rest: "installments", installments, ...payment } : { rest: "open", dueDate: date, ...payment } }));
    return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
  };
  const coverPlan = async (acc, date, total) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: date, total: String(total), accountId: acc.id, mode: "auto", count: "3", firstDue: "2025-09-01", coversBalance: true }));
  const planIn = async (planId, date, amount) => must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount, date, method: "bank" }));
  const entry = (acc, kind, date, amount, extra = {}) => api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind, amount, date, method: "cash", cashForce: true, ...extra });
  const inv = id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
  const card = id => must("kart", api.get(`/api/workspace/plans/${id}`));
  const agingOf = async acc => (await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"))).rows.find(r => r[0] === acc.name)?.at(-1) || "0,00 TL";

  for (const variant of ["Alacak Yaz", "alış faturası"]) {
    test(`#2: Mevcut Borç kartından SONRA kesilen fatura karta bölünmüş sayılmaz (${variant})`, async () => {
      const acc = await customer(`N ${variant}`);
      assert.equal((await entry(acc, "debt", "2025-04-02", 5000, { note: "Açılış" })).status, 200);
      await coverPlan(acc, "2025-04-03", 5000);
      const f = await sale(acc, "2025-04-04", 2000);
      if (variant === "Alacak Yaz") assert.equal((await entry(acc, "credit", "2025-04-05", 2000, { note: "İskonto" })).status, 200);
      else await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.id, issueDate: "2025-04-05", number: `AL-${n}`, lines: [{ name: "Hizmet alımı", qty: 1, unitPrice: 2000, vatRate: 0 }], payment: { rest: "open", dueDate: "2025-04-05" } }));
      assert.equal((await inv(f.id)).open, 2000);
      assert.equal(await agingOf(acc), "7.000,00 TL", "yaşlandırma: kart 5.000 + kapsanmayan fatura 2.000");
      const dues = await must("takvim", api.get("/api/workspace/dues"));
      assert.deepEqual(dues.items.filter(i => i.id === `invoice|${f.id}`).map(i => i.amount), [2000], "takvimde fatura 2.000");
      const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?from=2025-01-01&to=2026-12-31&overdue=1&table=0"));
      const fromInvoice = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.ref?.id === f.id).reduce((sum, r) => sum + r.amount, 0);
      assert.equal(fromInvoice, 2000, "nakit akışta fatura 2.000");
    });
  }

  test("#4: stoktan taksitli satışın kartı tahsil edilince ilgisiz eski fatura 'Ödendi' olmaz", async () => {
    const acc = await customer("Stok");
    const f = await sale(acc, "2025-05-01", 6000);
    await must("stoktan taksitli satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: 450, unitPrice: 20, pay: "account", accountId: acc.id, date: "2025-05-02", force: true, installments: { count: 3, firstDue: "2025-06-02", everyMonths: 1 } }));
    const planId = (await must("cari", api.get(`/api/workspace/accounts/${acc.id}`))).plans.find(p => p.coversBalance)?.id;
    assert.ok(planId, "stok satışının taksit kartı açıldı");
    for (const day of ["2025-06-02", "2025-07-02", "2025-08-02"]) await planIn(planId, day, 3000);
    const s = await inv(f.id);
    assert.deepEqual([s.paid, s.open], [0, 6000], `fatura ödenmedi (ödenen ${s.paid}, açık ${s.open})`);
    assert.notEqual(s.payState, "paid");
    assert.equal(await agingOf(acc), "6.000,00 TL");
  });

  test("D (peşinatlı): peşinatı alınmış fatura Mevcut Borç kartına bölünür; fatura açığı = kart kalanı", async () => {
    const acc = await customer("Peşinat");
    const f = await sale(acc, "2025-05-10", 12000, null, { cash: [{ amount: 2000, method: "cash" }] });
    const k = await coverPlan(acc, "2025-05-11", 10000);
    await planIn(k.id, "2025-05-12", 3000);
    const s = await inv(f.id);
    assert.deepEqual([s.paid, s.open, (await card(k.id)).totals.remaining], [5000, 7000, 7000]);
    assert.equal(await agingOf(acc), "7.000,00 TL");
  });

  test("#9: taksitli faturanın kendi kartında taksit iadesi faturayı da yeniden açar", async () => {
    const acc = await customer("İade");
    const f = await sale(acc, "2025-05-20", 3000, { count: 3, firstDue: "2025-06-20", everyMonths: 1 });
    await planIn(f.planId, "2025-05-21", 1000);
    await must("taksit iadesi", api.post(`/api/workspace/plans/${f.planId}/entries`, { kind: "out", amount: 1000, date: "2025-05-22", method: "bank", cashForce: true }));
    const s = await inv(f.id);
    assert.deepEqual([s.paid, s.open, (await card(f.planId)).totals.remaining], [0, 3000, 3000]);
  });

  test("#9: faturanın kendi taksit kartının tutarı Taksitler'den değiştirilemez (fatura ile kart ayrışmasın)", async () => {
    const acc = await customer("Tutar");
    const f = await sale(acc, "2025-05-25", 3000, { count: 3, firstDue: "2025-06-25", everyMonths: 1 });
    const res = await api.put(`/api/workspace/plans/${f.planId}`, { total: "2000" });
    assert.equal(res.status, 409, `kart tutarı değişmemeli (${res.status})`);
    assert.equal((await card(f.planId)).totals.total, 3000);
  });

  test("#5: taksitli fatura mahsup edilemez (fatura ile kendi kartı ayrışmasın)", async () => {
    const acc = await customer("Mahsup");
    const f = await sale(acc, "2025-06-01", 3000, { count: 3, firstDue: "2025-07-01", everyMonths: 1 });
    const p = await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.id, issueDate: "2025-06-02", number: "AL-MAHSUP", lines: [{ name: "Hizmet alımı", qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open", dueDate: "2025-06-02" } }));
    const off = await api.post(`/api/workspace/invoices/${f.id}/offsets`, { counterType: "invoice", counterId: p.id, amount: "1000", date: "2025-06-03" });
    assert.equal(off.status, 409, `mahsup reddedilmeli (${off.status})`);
    assert.match(String(off.data?.error || ""), /taksit/i);
    const off2 = await api.post(`/api/workspace/invoices/${p.id}/offsets`, { counterType: "invoice", counterId: f.id, amount: "1000", date: "2025-06-03" });
    assert.equal(off2.status, 409, `karşı taraftan da reddedilmeli (${off2.status})`);
    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.remaining], [3000, 3000]);
  });

  test("#6: eski veride taksitli faturaya bağlı cari tahsilatı düzeltilebilir (bağ değişmeden)", async () => {
    const acc = await customer("EskiBağ");
    const f = await sale(acc, "2025-06-05", 3000, { count: 3, firstDue: "2025-07-05", everyMonths: 1 });
    const res = await must("tahsilat", entry(acc, "in", "2025-06-06", 1000));
    server.app.store.run("UPDATE account_entries SET invoice_id = ? WHERE id = ?", f.id, res.entryId);
    const edit = await api.put(`/api/workspace/accounts/${acc.id}/entries/${res.entryId}`, { note: "yalnız açıklama düzeltildi" });
    assert.equal(edit.status, 200, `açıklama düzeltmesi engellenmemeli: ${JSON.stringify(edit.data).slice(0, 160)}`);
    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.remaining], [3000, 3000]);
  });

  test("#7: kısmen ödenmiş açık fatura sonradan taksitlendirilemez; neden ve doğru yol söylenir", async () => {
    const acc = await customer("Sonradan");
    const f = await sale(acc, "2025-06-10", 3000);
    await must("bağlı tahsilat", entry(acc, "in", "2025-06-11", 1000, { invoiceId: f.id }));
    const edit = await api.post(`/api/workspace/invoices/${f.id}/edit`, { scenario: "service_sale", accountId: acc.id, issueDate: "2025-06-10", lines: [{ itemId: item.id, qty: 1, unitPrice: 3000, vatRate: 0 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2025-07-10", everyMonths: 1 } } });
    assert.equal(edit.status, 409, `taksitlendirme reddedilmeli (${edit.status})`);
    assert.match(String(edit.data?.error || ""), /Carinin Mevcut Borcu/);
    const s = await inv(f.id);
    assert.deepEqual([s.paid, s.open, s.planId || ""], [1000, 2000, ""]);
  });
});
