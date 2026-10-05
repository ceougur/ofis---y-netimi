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
      del: async url => unwrap(await client.del(url)),
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

  // 2. gözden geçirme: "Mevcut Borç" kartı, açıldığı anda AÇIK olan borcu kapsar (ödenmiş borcu değil). Önceki kod kapsamı
  // ödemelerden önce kuruyordu: kapsanan fatura iptal / düzenleme / silme ile gidince kapsam eski, ödenmiş faturaya kayıyor,
  // ödenmiş fatura yeniden "Açık" görünüyordu; geriye tarihli borçta tahsilat başka faturaya kayıyordu.
  const paidOld = async (label, date) => {
    const acc = await customer(label);
    const z = await sale(acc, date[0], 1000);
    assert.equal((await entry(acc, "in", date[1], 1000)).status, 200);
    return { acc, z };
  };
  test("2. tur: kapsanan fatura iptal edilince kartın kapsamı eski, ödenmiş faturaya kaymaz", async () => {
    const { acc, z } = await paidOld("İptal", ["2025-06-12", "2025-06-13"]);
    const a = await sale(acc, "2025-06-14", 2000);
    await coverPlan(acc, "2025-06-15", 2000);
    assert.deepEqual([(await inv(z.id)).paid, (await inv(z.id)).open], [1000, 0], "kart açılınca Z ödenmiş kalır");
    const cancel = await api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "yanlış fatura" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data).slice(0, 200));
    const s = await inv(z.id);
    assert.deepEqual([s.paid, s.open, s.payState], [1000, 0, "paid"], "Z, 1.000 tahsilatla kapanmıştı");
  });
  test("2. tur: kapsanan fatura düzenlenip küçülünce kapsam ödenmiş faturaya kaymaz", async () => {
    const { acc, z } = await paidOld("Düzenle", ["2025-06-16", "2025-06-17"]);
    const a = await sale(acc, "2025-06-18", 2000);
    await coverPlan(acc, "2025-06-19", 2000);
    const edit = await api.post(`/api/workspace/invoices/${a.id}/edit`, { scenario: "service_sale", accountId: acc.id, issueDate: "2025-06-18", lines: [{ itemId: item.id, qty: 1, unitPrice: 1500, vatRate: 0 }], payment: { rest: "open", dueDate: "2025-06-18" } });
    assert.equal(edit.status, 200, JSON.stringify(edit.data).slice(0, 200));
    assert.deepEqual([(await inv(z.id)).paid, (await inv(z.id)).open], [1000, 0], "Z ödenmiş kalır");
    assert.equal((await inv(a.id)).open, 1500);
  });
  test("2. tur: kapsanan Borç Yaz silinince kapsam ödenmiş faturaya kaymaz", async () => {
    const { acc, z } = await paidOld("BorçSil", ["2025-06-20", "2025-06-21"]);
    const debt = await must("borç yaz", entry(acc, "debt", "2025-06-22", 2000, { note: "Hizmet" }));
    await coverPlan(acc, "2025-06-23", 2000);
    const del = await api.del(`/api/workspace/accounts/${acc.id}/entries/${debt.entryId}`);
    assert.equal(del.status, 200, JSON.stringify(del.data).slice(0, 200));
    assert.deepEqual([(await inv(z.id)).paid, (await inv(z.id)).open], [1000, 0], "Z ödenmiş kalır");
  });
  test("2. tur: geriye tarihli borç girilince kart, açık kalan faturayı kapsar; tahsilat başka faturaya kaymaz", async () => {
    const acc = await customer("GeriTarih");
    const b = await sale(acc, "2025-06-25", 1000);
    assert.equal((await entry(acc, "debt", "2025-06-24", 1000, { note: "Açılış bakiyesi" })).status, 200);
    assert.equal((await entry(acc, "in", "2025-06-26", 1000)).status, 200);
    assert.deepEqual([(await inv(b.id)).paid, (await inv(b.id)).open], [0, 1000], "tahsilat en eski borcu (açılış) kapatır");
    await coverPlan(acc, "2025-06-27", 1000);
    const s = await inv(b.id);
    assert.deepEqual([s.paid, s.open], [0, 1000], `kart açılınca fatura ödenmiş görünmez (kapatanlar: ${JSON.stringify(s.closers)})`);
    const open = await must("açık faturalar", api.get("/api/workspace/report-center/acik-faturalar"));
    assert.equal((open.rows || []).filter(row => row.some(cell => String(cell).includes(b.number))).length, 1, "Açık Faturalar raporunda");
    assert.equal(await agingOf(acc), "1.000,00 TL", "yaşlandırma: kartın 1.000'i (fatura karta bölünmüş, bir kez)");
  });
  test("2. tur: peşin ödenmiş yeni fatura varken kart, açık eski faturayı kapsar (yaşlandırmada bir kez)", async () => {
    const acc = await customer("PeşinYeni");
    const z = await sale(acc, "2025-06-28", 1000);
    await sale(acc, "2025-06-29", 2000, null, { cash: [{ amount: 2000, method: "cash" }] });
    const k = await coverPlan(acc, "2025-06-30", 1000);
    assert.equal(await agingOf(acc), "1.000,00 TL", "bakiye 1.000: kart ve Z aynı borç");
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    assert.equal(dues.items.filter(i => i.id === `invoice|${z.id}`).reduce((sum, i) => sum + i.amount, 0), 0, "Z'nin borcu takvimde kartın taksitleriyle");
    assert.deepEqual([(await inv(z.id)).open, (await card(k.id)).totals.remaining], [1000, 1000]);
  });
  test("2. tur: Otomatik Dağıt Mevcut Borç kartını carinin borcundan büyütemez (Düzenle'deki denetim)", async () => {
    const { acc, z } = await paidOld("Dağıt", ["2025-07-01", "2025-07-02"]);
    await sale(acc, "2025-07-03", 2000);
    const k = await coverPlan(acc, "2025-07-04", 2000);
    const grow = await api.post(`/api/workspace/plans/${k.id}/distribute`, { total: "3000", count: "3", firstDue: "2025-08-04", everyMonths: "1" });
    assert.equal(grow.status, 409, `kart büyütülmemeli (${grow.status})`);
    assert.equal((await card(k.id)).totals.total, 2000);
    assert.deepEqual([(await inv(z.id)).paid, (await inv(z.id)).open], [1000, 0], "Z ödenmiş kalır");
    const same = await api.post(`/api/workspace/plans/${k.id}/distribute`, { count: "4", firstDue: "2025-08-04", everyMonths: "1" });
    assert.equal(same.status, 200, "tutarı değiştirmeyen yeniden dağıtım serbest");
    assert.equal(same.data.items.length, 4);
  });
  test("2. tur: Otomatik Dağıt faturanın kendi taksit kartının tutarını değiştiremez", async () => {
    const acc = await customer("FaturaDağıt");
    const f = await sale(acc, "2025-07-05", 3000, { count: 3, firstDue: "2025-08-05", everyMonths: 1 });
    const cut = await api.post(`/api/workspace/plans/${f.planId}/distribute`, { total: "2000", count: "2", firstDue: "2025-08-05", everyMonths: "1" });
    assert.equal(cut.status, 409, `kart tutarı faturadan gelir (${cut.status})`);
    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.total], [3000, 3000]);
    const again = await api.post(`/api/workspace/plans/${f.planId}/distribute`, { total: "3000", count: "6", firstDue: "2025-08-05", everyMonths: "1" });
    assert.equal(again.status, 200, "aynı tutarla taksit sayısı değişebilir");
    assert.deepEqual([(await inv(f.id)).open, (await card(f.planId)).totals.remaining], [3000, 3000]);
  });
  test("2. tur: Otomatik Dağıt kilitli dönemdeki yeni borç kartının tutarını değiştiremez", async () => {
    const acc = await customer("KilitDağıt");
    const k = await must("yeni borç kartı", api.post("/api/workspace/plans", { name: acc.name, registeredOn: "2025-07-06", total: "1000", accountId: acc.id, mode: "auto", count: "2", firstDue: "2025-08-06" }));
    assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "2025-07-10" })).status, 200);
    try {
      const grow = await api.post(`/api/workspace/plans/${k.id}/distribute`, { total: "1500", count: "3", firstDue: "2025-08-06", everyMonths: "1" });
      assert.equal(grow.status, 409, `kilitli dönemin bakiyesi değişmemeli (${grow.status})`);
      assert.equal(grow.data?.code, "period-locked");
      assert.equal((await card(k.id)).totals.total, 1000);
    } finally {
      assert.equal((await api.put("/api/admin/period-lock", { lockedUntil: "" })).status, 200);
    }
  });

  // 2. gözden geçirmenin kalan bulguları. Birleşik listelerde kartın payı taksitlerinden gelir; kapsam kartın tutarından
  // geliyordu: taksitleri girilmemiş ("Şimdilik yok") ya da tutarı küçültülmüş kartta borç listelerden düşüyor ya da fazla
  // sayılıyordu.
  const flowOf = async invoiceId => {
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?from=2025-01-01&to=2027-12-31&overdue=1&table=0"));
    return [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.ref?.id === invoiceId).reduce((sum, r) => sum + r.amount, 0);
  };
  test("2. tur #1: taksitleri girilmemiş ('Şimdilik yok') Mevcut Borç kartında borç birleşik listelerden düşmez", async () => {
    const acc = await customer("ŞimdilikYok");
    const a = await sale(acc, "2025-07-20", 2000);
    await must("kart (taksit yok)", api.post("/api/workspace/plans", { name: acc.name, registeredOn: "2025-07-21", total: "2000", accountId: acc.id, mode: "none", coversBalance: true }));
    assert.equal(await agingOf(acc), "2.000,00 TL", "yaşlandırma: kartın taksiti yok, borç faturada");
    assert.equal(await flowOf(a.id), 2000, "nakit akışta fatura 2.000");
  });
  test("2. tur #1: elle tek taksit (500) girilen 2.000'lik kartta kalan 1.500 faturada görünür", async () => {
    const acc = await customer("ElleTek");
    const a = await sale(acc, "2025-07-22", 2000);
    const k = await must("kart (elle)", api.post("/api/workspace/plans", { name: acc.name, registeredOn: "2025-07-23", total: "2000", accountId: acc.id, mode: "manual", coversBalance: true }));
    await must("taksit", api.post(`/api/workspace/plans/${k.id}/items`, { dueDate: "2025-08-23", amount: "500" }));
    assert.equal(await agingOf(acc), "2.000,00 TL", "yaşlandırma: kartın taksiti 500 + faturanın kalanı 1.500");
    assert.equal(await flowOf(a.id), 1500);
  });
  test("2. tur #1: tutarı Düzenle ile küçültülen kartta (taksitler aynı) borç bir kez sayılır", async () => {
    const acc = await customer("Küçült");
    await sale(acc, "2025-07-24", 2000);
    const k = await coverPlan(acc, "2025-07-25", 2000);
    await must("kart küçült", api.put(`/api/workspace/plans/${k.id}`, { total: "1500" }));
    assert.equal(await agingOf(acc), "2.000,00 TL", "yaşlandırma = bakiye: kartın 1.500'ü + faturanın kart dışında kalan 500'ü");
  });
  test("2. tur #2: geriye tarihli stoktan taksitli satışın kartı, kendi satışını kapsar (ilgisiz fatura ödenmiş görünmez)", async () => {
    const acc = await customer("StokGeri");
    const f = await sale(acc, "2025-07-26", 1000);
    await must("stoktan taksitli satış (geriye tarihli)", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: 45, unitPrice: 20, pay: "account", accountId: acc.id, date: "2025-07-21", force: true, installments: { count: 3, firstDue: "2025-08-21", everyMonths: 1 } }));
    const planId = (await must("cari", api.get(`/api/workspace/accounts/${acc.id}`))).plans.find(p => p.coversBalance)?.id;
    assert.ok(planId, "stok satışının kartı açıldı");
    for (const day of ["2025-08-21", "2025-09-21", "2025-10-21"]) await planIn(planId, day, 300);
    const s = await inv(f.id);
    assert.deepEqual([s.paid, s.open], [0, 1000], `fatura ödenmedi (kapatanlar: ${JSON.stringify(s.closers)})`);
    assert.equal(await agingOf(acc), "1.000,00 TL");
  });
  test("2. tur #3 / 3. tur: Mevcut Borç kartı büyütülemez (Düzenle ve Otomatik Dağıt); yeni borç kartın dışında, bir kez sayılır", async () => {
    const acc = await customer("Büyüt");
    const x = await sale(acc, "2025-07-27", 1000);
    const k = await coverPlan(acc, "2025-07-28", 1000);
    const b = await sale(acc, "2025-07-29", 500);
    const grow = await api.post(`/api/workspace/plans/${k.id}/distribute`, { total: "1500", count: "3", firstDue: "2025-08-28", everyMonths: "1" });
    assert.equal(grow.status, 409, `Otomatik Dağıt ile büyütme reddedilir (${grow.status})`);
    assert.match(String(grow.data?.error || ""), /yeni kart/);
    assert.equal((await api.put(`/api/workspace/plans/${k.id}`, { total: "1500" })).status, 409, "Düzenle ile büyütme reddedilir");
    assert.equal(await agingOf(acc), "1.500,00 TL", "yaşlandırma = bakiye: kart 1.000 + B 500");
    await planIn(k.id, "2025-08-28", 1000);
    const z = await sale(acc, "2025-07-29", 200);
    assert.deepEqual([(await inv(x.id)).open, (await inv(b.id)).open, (await inv(z.id)).open], [0, 500, 200], "kart tahsilatı yalnız X'i kapatır; sonraki satış açık");
    assert.equal(await agingOf(acc), "700,00 TL");
  });
  test("3. tur: borcu olmayan caride (yalnız ödeme yapılmış) açılan kart sonradan kesilen faturayı yutmaz", async () => {
    const acc = await customer("Yutmaz");
    await sale(acc, "2025-07-29", 1000);
    assert.equal((await entry(acc, "in", "2025-07-29", 1000)).status, 200);
    assert.equal((await entry(acc, "out", "2025-07-29", 500, { note: "Cariye ödeme" })).status, 200);
    await coverPlan(acc, "2025-07-29", 500);
    const y = await sale(acc, "2025-07-29", 800);
    assert.equal((await inv(y.id)).open, 800);
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    assert.equal(dues.items.filter(i => i.id === `invoice|${y.id}`).reduce((sum, i) => sum + i.amount, 0), 800, "Y takvimde 800 (kartın içinde sayılmaz)");
  });
  test("2. tur #4: silinen Mevcut Borç kartı, taksitlendirdiği borç bu arada ödenmişse geri yüklenmez (ödenmiş fatura açılmaz)", async () => {
    const acc = await customer("GeriYükle");
    const a = await sale(acc, "2025-07-30", 2000);
    const k = await coverPlan(acc, "2025-07-31", 2000);
    assert.equal((await api.del(`/api/workspace/plans/${k.id}`)).status, 200);
    assert.equal((await entry(acc, "in", "2025-08-01", 2000)).status, 200);
    assert.equal((await inv(a.id)).open, 0);
    const trash = (await must("silinenler", api.get("/api/admin/trash")));
    const item = (Array.isArray(trash) ? trash : trash?.items || []).find(row => row.kind === "plan" && row.id === `plan:${k.id}`);
    assert.ok(item, "kart Silinenler'de");
    const restore = await api.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(restore.status, 409, `geri yükleme reddedilmeli (${restore.status})`);
    assert.match(String(restore.data?.error || ""), /taksitlendir/i);
    assert.deepEqual([(await inv(a.id)).paid, (await inv(a.id)).open], [2000, 0], "fatura ödenmiş kalır");
  });
  test("3. tur: kartın kendi tahsilatı olan silinmiş kart, borç bu arada azaldıysa geri yüklenmez; borç varsa geri yüklenir", async () => {
    const acc = await customer("GeriYükle2");
    const x = await sale(acc, "2025-08-05", 1000);
    const k = await coverPlan(acc, "2025-08-06", 1000);
    await planIn(k.id, "2025-08-07", 400);
    assert.equal((await api.del(`/api/workspace/plans/${k.id}`)).status, 200);
    assert.equal((await entry(acc, "in", "2025-08-08", 300)).status, 200);
    const list = await must("silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(list) ? list : list?.items || []).find(row => row.id === `plan:${k.id}`);
    const restore = await api.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(restore.status, 409, `kalan 600 > taksitlendirilebilir borç 300 (${restore.status})`);
    assert.equal((await inv(x.id)).open, 700);
    // Meşru geri yükleme: sil → hemen geri yükle.
    const acc2 = await customer("GeriYükle3");
    await sale(acc2, "2025-08-09", 1000);
    const k2 = await coverPlan(acc2, "2025-08-10", 1000);
    await planIn(k2.id, "2025-08-11", 400);
    assert.equal((await api.del(`/api/workspace/plans/${k2.id}`)).status, 200);
    const list2 = await must("silinenler", api.get("/api/admin/trash"));
    const item2 = (Array.isArray(list2) ? list2 : list2?.items || []).find(row => row.id === `plan:${k2.id}`);
    assert.equal((await api.post("/api/admin/trash/restore", { id: item2.id })).status, 200, "borç yerindeyse geri yüklenir");
    assert.equal(await agingOf(acc2), "600,00 TL");
  });
});
