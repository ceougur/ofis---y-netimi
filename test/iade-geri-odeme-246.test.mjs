// 2.4.6 madde 9 — DB1 (ORTA, para çekirdeği; docs/2.4.5-IS-LISTESI.md "İKİNCİ DAR KONTROL" DB1, docs/2.4.6-IS-LISTESI.md madde 9): "iade geri ödemesi" bağı.
// Bulgu (yeniden üretme kaynağı docs/kanit/2026-10-24/245-dar2/betik/s1-iade-geri-odeme.mjs): faturasız stok Satış İadesi ya da fatura iadesi bedeli cari kartından
// "Ödeme" ile müşteriye geri ödenince fatura + vadeli borç açığı iade kadar EKSİK görünüyordu (B 200 + borç 300 = 500, bakiye 800). Kök: lib/invoice-settle.mjs
// default dalı cari "Ödeme"yi her zaman borç tarafında ödeme sayıyor; iade alacağı en eski açık faturayı kapatıyor, geri ödeme onu yeniden açmıyordu.
// KURAL (önceden yazılmış metin — v2.1.0 R1, invoice-settle.mjs "iadenin GERİ ÖDEMESİ ödeme değil, iadenin alacağını geri alan yükümlülüktür" + K1 adım R "iadenin
// geri ödemesi iade belgesinin kendi alacağıyla kapanır"; 2.4.5 öneri metni "geri ödeme iadeye bağlanır, R1 düzeni") + ana oturum kararları (docs/2.4.6-IS-LISTESI.md
// "KARAR — 5 DK YETKİSİYLE UYGULANDI", 25.10.2026): K-d Ödeme'de "Kapatılacak Fatura" olarak müşteriye ait İADE seçilir (öbür yönler aynen reddedilir); K-c tedarikçinin
// Tahsilat ile geri ödemesi alış iadesine bağlanır; K-a yalnız iade kadarı geri ödeme, fazlası avans (alacak tarafında yükümlülük değil); K-b iadeye bağlanmamış
// Ödeme açık iadeler ve elle Alacak arasında TEK FIFO (en eskiden); K-e her ödeme yolu (nakit, havale, kart, çek) geri ödeme sayılır; K-f cari türüne bakılmaz.
// BAŞ MİMAR KARARI (ana oturum, 25.10.2026, DB1 metninin düz "Ödeme" örneğinden; kâhin c8 BULGU'ları): bağsız müşteriye Ödeme / tedarikçiden Tahsilat önce K-b ile
// açık iadeleri ve kendi tarafını kapatır; artanı, alacağı bir faturayı / borcu kapatmış iadenin (en eski önce) geri ödemesi sayılır (Σ açık = bakiye); açık bağ önce.
// Cari bakiye, Kasa ve yevmiye DEĞİŞMEZ. Beklenen sayılar programdan değil, bu metinlerden elle (ders 5).
// "Nasıl bozulur?": bağ yok sayılır (eski); bağ yanlış tarafta (Tahsilat → satıştan iade); geri ödeme iadeden fazla (fazlası avans olmalı, reddedilmemeli); başka
// carinin iadesi; Kapatılacak Fatura ile birlikte; kısmi geri ödeme; bağ sonradan eklenir / kaldırılır (bakiye, Kasa, mizan aynı kalmalı); geri ödeme silinip geri
// yüklenir; iade silinir / küçültülür / geri yüklenir; iade belgesi düzenlenip kendi geri ödemesi + bağlı geri ödeme iadeyi aşar; bağsız Ödeme eski kuralda önce elle
// Alacak'ı kapatıyordu (K-b); çekle geri ödeme bağlanmıyordu (K-e); tedarikçi tarafı simetriği (alıştan iade faturası, faturasız Alış İadesi).
// Sahte DURAĞAN saat (ders 13); HUKUK_LICENSE_URL (ders 30).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { classifyLine, settleLedger } from "../server/lib/invoice-settle.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const ROLE = { recvDue: false, recvPay: false, payDue: false, payPay: false };

describe("DB1 classifyLine (saf): iadeye bağlı geri ödeme yükümlülüktür; bağsız Ödeme / Tahsilat değişmedi", () => {
  const line = extra => ({ id: "x", origin: "account", kind: "", date: "2026-10-01", debit: 0, credit: 0, ...extra });
  it("müşteriye bağlı Ödeme (çıkış) alacak tarafında yükümlülük; tedarikçiden bağlı Tahsilat (giriş) borç tarafında yükümlülük", () => {
    assert.deepEqual(classifyLine(line({ kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true });
    assert.deepEqual(classifyLine(line({ kind: "in", credit: 300, refundOf: "inv-ret" })), { ...ROLE, payDue: true });
  });
  it("bağsız Ödeme borç tarafında, bağsız Tahsilat alacak tarafında ödeme (R1c, değişmedi); Borç / Alacak Yaz yükümlülük", () => {
    assert.deepEqual(classifyLine(line({ kind: "out", debit: 300 })), { ...ROLE, payPay: true });
    assert.deepEqual(classifyLine(line({ kind: "in", credit: 300 })), { ...ROLE, recvPay: true });
    assert.deepEqual(classifyLine(line({ kind: "debt", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true }, "bağ yalnız Tahsilat / Ödeme'de anlamlı");
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, recvDue: true }, "modül satırında bağ okunmaz");
    assert.deepEqual(classifyLine(line({ origin: "", kind: "out", debit: 300, refundOf: "smove-1" })), { ...ROLE, payPay: true }, "bağ yalnız elle cari satırında (origin account) okunur");
  });
});

describe("DB1 settleLedger (saf): faturasız stok iadesinin bağlı geri ödemesi iadenin alacağıyla kapanır", () => {
  const invoices = [{ id: "B", kind: "sale", status: "issued", payable: 500, dueDate: "2026-09-30", issuedAt: "2026-09-20T10:00:00" }];
  const base = [
    { id: "lB", origin: "invoice", kind: "debt", sourceId: "B", date: "2026-09-20", at: "2026-09-20T10:00:00", debit: 500, credit: 0 },
    { id: "lD", origin: "account", kind: "debt", date: "2026-09-25", at: "2026-09-25T10:00:00", debit: 300, credit: 0 },
    { id: "lR", origin: "stock", kind: "credit", sourceId: "smove-1", stockReason: "return", date: "2026-10-15", at: "2026-10-15T10:00:00", debit: 0, credit: 300 },
  ];
  const refund = extra => ({ id: "lP", origin: "account", kind: "out", date: "2026-10-16", at: "2026-10-16T10:00:00", debit: 300, credit: 0, ...extra });
  it("bağlı: fatura 500 ve borç 300 açık kalır (Σ 800 = bakiye); geri ödeme kapandı", () => {
    const out = settleLedger({ lines: [...base, refund({ refundOf: "smove-1" })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 500);
    assert.equal(out.entries.get("lD").remaining, 300);
    assert.equal(out.entries.get("lP").remaining, 0);
  });
  it("kısmi: 100 bağlı geri ödeme → iadenin 200'ü en eski açık borcu (fatura) kapatır", () => {
    const out = settleLedger({ lines: [...base, refund({ refundOf: "smove-1", debit: 100 })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 300);
    assert.equal(out.entries.get("lD").remaining, 300);
  });
  it("bağsız (seçilmedi; BAŞ MİMAR KARARI 25.10): yükümlülüklerden artan Ödeme, B'yi kapatmış iadenin geri ödemesi sayılır — B 500, borç 300 (Σ 800 = bakiye; 2.4.5'te B 200)", () => {
    const out = settleLedger({ lines: [...base, refund({})], invoices, today: TODAY });
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining], [500, 300]);
  });
  it("K-a: iadesi silinmiş bağlı geri ödemenin kalanı 0 → tamamı avans (yükümlülük değil); B 500", () => {
    const out = settleLedger({ lines: [base[0], base[1], refund({ refundOf: "smove-1" })], invoices, today: TODAY });
    assert.equal(out.invoices.get("B").open, 500);
    assert.equal(out.entries.has("lP"), false, "geri ödeme açık yükümlülük olmaz");
  });
  it("K-a: iadeden fazla (500 > 300) — 300 geri ödeme, 200 avans: B 500, borç 300; avans önce elle Alacak'ı kapatır, kalanı bakiyede", () => {
    const over = refund({ refundOf: "smove-1", debit: 500 });
    let out = settleLedger({ lines: [...base, over], invoices, today: TODAY });
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining, out.entries.get("lP").remaining], [500, 300, 0]);
    const credit = { id: "lA", origin: "account", kind: "credit", date: "2026-09-28", at: "2026-09-28T10:00:00", debit: 0, credit: 150 };
    out = settleLedger({ lines: [...base, credit, over], invoices, today: TODAY });
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lA").remaining], [500, 0], "avans 200: elle Alacak 150 kapandı (50 bakiyede)");
  });
});

// BAŞ MİMAR KARARI (ana oturum, 25.10.2026; önceden yazılmış metinden — docs/2.4.5-IS-LISTESI.md DB1: örnek DÜZ cari "Ödeme" ile kurulur, doğru sonuç 800;
// değişmez Σ açık = cari bakiye): bağsız müşteriye Ödeme (tedarikçiden bağsız Tahsilat simetrisi) önce K-b ile açık iadeleri / kendi tarafının yükümlülüklerini
// kapatır; artanı, alacağı bir faturayı / borcu kapatmış iadenin (en eski önce) geri ödemesi sayılır; iade o kadar kapatıcı olmaktan çıkar. Açık bağ önceliklidir.
// Beklenenler karar metninden elle (ders 5, 40).
describe("BAŞ MİMAR KARARI settleLedger (saf): bağsız geri ödeme, faturayı / borcu kapatmış iadenin geri ödemesi sayılır", () => {
  const invoices = [{ id: "B", kind: "sale", status: "issued", payable: 500, dueDate: "2026-09-30", issuedAt: "2026-09-20T10:00:00" }];
  const at = date => ({ date, at: `${date}T10:00:00` });
  const lB = { id: "lB", origin: "invoice", kind: "debt", sourceId: "B", ...at("2026-09-20"), debit: 500, credit: 0 };
  const lD = { id: "lD", origin: "account", kind: "debt", ...at("2026-09-25"), debit: 300, credit: 0 };
  const ret = (id, date, amount) => ({ id, origin: "stock", kind: "credit", sourceId: `smove-${id}`, stockReason: "return", ...at(date), debit: 0, credit: amount });
  const pay = (id, date, amount, extra = {}) => ({ id, origin: "account", kind: "out", ...at(date), debit: amount, credit: 0, ...extra });
  const run = lines => settleLedger({ lines, invoices, today: TODAY });
  it("kısmi bağsız 100: iadenin 200'ü kapatıcı kalır → B 300 (Σ 600 = bakiye)", () => {
    const out = run([lB, lD, ret("r1", "2026-10-15", 300), pay("p1", "2026-10-16", 100)]);
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining], [300, 300]);
  });
  it("önce kendi tarafı (K-b): elle Alacak 100 kapanır, artan 200 iadenin geri ödemesi → B 400, Alacak 0 (Σ 700 = bakiye)", () => {
    const credit = { id: "lA", origin: "account", kind: "credit", ...at("2026-10-14"), debit: 0, credit: 100 };
    const out = run([lB, lD, credit, ret("r1", "2026-10-15", 300), pay("p1", "2026-10-16", 300)]);
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining, out.entries.get("lA").remaining], [400, 300, 0]);
  });
  it("iadeden fazla bağsız 500: 300 geri ödeme, 200 avans (K-a gibi) → B 500, borç 300", () => {
    const out = run([lB, lD, ret("r1", "2026-10-15", 300), pay("p1", "2026-10-16", 500)]);
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining], [500, 300]);
  });
  it("en eski iade önce ve açık bağ önce: R1 300 açık bağla geri ödendi, bağsız 100 R2'nin (200) geri ödemesi → R2'nin 100'ü kapatıcı → B 400 (Σ 700)", () => {
    const lines = [lB, lD, ret("r1", "2026-10-10", 300), ret("r2", "2026-10-12", 200), pay("p1", "2026-10-16", 300, { refundOf: "smove-r1" }), pay("p2", "2026-10-17", 100)];
    const out = run(lines);
    assert.deepEqual([out.invoices.get("B").open, out.entries.get("lD").remaining], [400, 300]);
    // Bağsız iki ödeme: en eski iade (R1 300) önce, sonra R2 → ikisi de kapatıcı değil: B 500, borç 300 (Σ 800).
    const both = run([lB, lD, ret("r1", "2026-10-10", 300), ret("r2", "2026-10-12", 200), pay("p1", "2026-10-16", 300), pay("p2", "2026-10-17", 200)]);
    assert.deepEqual([both.invoices.get("B").open, both.entries.get("lD").remaining], [500, 300]);
  });
  it("fatura iadesi (K1 asıl faturaya mahsup): bağsız Ödeme 300 → asıl fatura A yeniden tahsilatla kapanır, B 500 açık", () => {
    const docs = [
      { id: "A", kind: "sale", status: "issued", payable: 1000, dueDate: "2026-09-10", issuedAt: "2026-09-01T10:00:00" },
      ...invoices,
      { id: "R", kind: "sale_return", status: "issued", payable: 300, originalId: "A", issuedAt: "2026-10-15T10:00:00" },
    ];
    const lines = [
      { id: "lA1", origin: "invoice", kind: "debt", sourceId: "A", ...at("2026-09-01"), debit: 1000, credit: 0 },
      { id: "lT", origin: "account", kind: "in", ...at("2026-09-05"), debit: 0, credit: 1000 },
      lB,
      { id: "lR", origin: "invoice", kind: "credit", sourceId: "R", ...at("2026-10-15"), debit: 0, credit: 300 },
      pay("p1", "2026-10-16", 300),
    ];
    const out = settleLedger({ lines, invoices: docs, today: TODAY });
    assert.deepEqual([out.invoices.get("A").open, out.invoices.get("B").open, out.invoices.get("R").open], [0, 500, 0]);
  });
  it("tedarikçi simetriği: Alış İadesi (preturn) alış faturasını kapattı, bağsız Tahsilat 200 → alış faturası P yeniden 500", () => {
    const docs = [{ id: "P", kind: "purchase", status: "issued", payable: 500, dueDate: "2026-09-30", issuedAt: "2026-09-20T10:00:00" }];
    const lines = [
      { id: "lP", origin: "invoice", kind: "credit", sourceId: "P", ...at("2026-09-20"), debit: 0, credit: 500 },
      { id: "lQ", origin: "stock", kind: "debt", sourceId: "smove-q", stockReason: "preturn", ...at("2026-10-01"), debit: 200, credit: 0 },
      { id: "lT", origin: "account", kind: "in", ...at("2026-10-05"), debit: 0, credit: 200 },
    ];
    const out = settleLedger({ lines, invoices: docs, today: TODAY });
    assert.equal(out.invoices.get("P").open, 500);
  });
  // Fatura iadeleri (K1): A1 peşin ödendi (bağlı), A2 açık; iadeler R1 (A1'in, eski) ve R2 (A2'nin, yeni) — iki iade de A2'yi kapatır.
  const twoReturns = () => {
    const docs = [
      { id: "A1", kind: "sale", status: "issued", payable: 1000, dueDate: "2026-09-10", issuedAt: "2026-09-01T10:00:00" },
      { id: "A2", kind: "sale", status: "issued", payable: 500, dueDate: "2026-09-12", issuedAt: "2026-09-02T10:00:00" },
      { id: "R1", kind: "sale_return", status: "issued", payable: 300, originalId: "A1", issuedAt: "2026-10-10T10:00:00" },
      { id: "R2", kind: "sale_return", status: "issued", payable: 200, originalId: "A2", issuedAt: "2026-10-12T10:00:00" },
    ];
    const lines = [
      { id: "lA1", origin: "invoice", kind: "debt", sourceId: "A1", ...at("2026-09-01"), debit: 1000, credit: 0 },
      { id: "lC1", origin: "invoice", kind: "in", sourceId: "A1", ...at("2026-09-01"), debit: 0, credit: 1000 },
      { id: "lA2", origin: "invoice", kind: "debt", sourceId: "A2", ...at("2026-09-02"), debit: 500, credit: 0 },
      { id: "lR1", origin: "invoice", kind: "credit", sourceId: "R1", ...at("2026-10-10"), debit: 0, credit: 300 },
      { id: "lR2", origin: "invoice", kind: "credit", sourceId: "R2", ...at("2026-10-12"), debit: 0, credit: 200 },
    ];
    return { docs, lines };
  };
  it("en eski iade önce (kapatanlarda görünür): bağsız Ödeme 200 R1'in (eski) geri ödemesi — R1'in kapatanlarında, R2'ninkinde değil; A2 200 açık (Σ = bakiye)", () => {
    const { docs, lines } = twoReturns();
    const out = settleLedger({ lines: [...lines, pay("p1", "2026-10-16", 200)], invoices: docs, today: TODAY });
    const closers = id => (out.invoices.get(id).closers || []).map(row => row.id);
    assert.deepEqual([closers("R1").includes("p1"), closers("R2").includes("p1")], [true, false], `R1 ${closers("R1")} · R2 ${closers("R2")}`);
    assert.equal(out.invoices.get("A2").open, 200, "bakiye 500 − 300 − 200 + 200 = 200");
  });
  it("iade belgesinin kendi geri ödemesi üst sınırı düşürür: belge 100 geri ödedi, bağsız 300'ün 200'ü geri ödeme, 100 avans — geri ödeme satırı açık kalmaz", () => {
    const { docs, lines } = twoReturns();
    const own = { id: "lO", origin: "invoice", kind: "out", sourceId: "R1", ...at("2026-10-10"), debit: 100, credit: 0 };
    const out = settleLedger({ lines: [...lines.filter(line => line.id !== "lR2"), own, pay("p1", "2026-10-16", 300)], invoices: docs.filter(doc => doc.id !== "R2"), today: TODAY });
    assert.equal(out.entries.get("p1")?.remaining ?? 0, 0, "bağsız geri ödemenin geri ödeme kısmı iadeyle kapandı");
    assert.deepEqual([out.invoices.get("A2").open, out.invoices.get("R1").open], [500, 0], "R1 tamamen geri ödendi (100 belge + 200 cari): A2 500 açık");
  });
  it("bağsız olmayan alacak geri ödeme sayılmaz: açık satış iadesi (para değil) Alış İadesinin kapattığı alış faturasını açmaz", () => {
    const docs = [{ id: "P", kind: "purchase", status: "issued", payable: 500, dueDate: "2026-09-30", issuedAt: "2026-09-20T10:00:00" }];
    const mixed = [
      { id: "lP", origin: "invoice", kind: "credit", sourceId: "P", ...at("2026-09-20"), debit: 0, credit: 500 },
      { id: "lQ", origin: "stock", kind: "debt", sourceId: "smove-q", stockReason: "preturn", ...at("2026-10-01"), debit: 200, credit: 0 },
      ret("r9", "2026-10-05", 300),
    ];
    const out = settleLedger({ lines: mixed, invoices: docs, today: TODAY });
    assert.equal(out.invoices.get("P").open, 300, "alış faturası 500 − Alış İadesi 200 = 300 (satış iadesi açık kalır)");
  });
  it("değişmez (Σ açık = bakiye) iade + bağsız Ödeme sıraları: iade önce / ödeme önce / iki iade / kısmi", () => {
    const cases = [
      [lB, lD, ret("r1", "2026-10-15", 300), pay("p1", "2026-10-16", 300)],
      [lB, lD, pay("p1", "2026-10-01", 300), ret("r1", "2026-10-15", 300)],
      [lB, lD, ret("r1", "2026-10-10", 100), ret("r2", "2026-10-11", 250), pay("p1", "2026-10-16", 200), pay("p2", "2026-10-17", 150)],
      [lB, lD, ret("r1", "2026-10-15", 300), pay("p1", "2026-10-16", 120)],
    ];
    for (const lines of cases) {
      const balance = lines.reduce((sum, line) => sum + line.debit - line.credit, 0);
      const out = run(lines);
      const open = out.invoices.get("B").open + out.entries.get("lD").remaining;
      assert.equal(open, balance, `Σ açık ${open} = bakiye ${balance}: ${lines.map(line => line.id).join(", ")}`);
    }
  });
});

// Bağımsız dar kontrol (aday246-2 bc1253c; docs/kanit/2026-10-25/246-dar, dal is/dar-246) bulguları — beklenenler KS8.1 / K-b / ders 31 metninden (ders 5, 40):
// B2 iadenin bir kısmı açıkken bağsız geri ödeme: açık kısma giden de, kapattığı borca giden de iadenin GERİ ÖDEMESİDİR (aynı açık iki kez tüketilmez);
// B3 aynı gün + aynı kayıt anı: yazım sırası.
describe("DAR KONTROL 246 settleLedger (saf): kısmen açık iade + bağsız geri ödeme (B2), aynı anda yazım sırası (B3)", () => {
  const at = date => ({ date, at: `${date}T10:00:00` });
  const lD = { id: "lD", origin: "account", kind: "debt", ...at("2026-10-01"), debit: 200, credit: 0 };
  const ret500 = { id: "lR", origin: "stock", kind: "credit", sourceId: "smove-1", stockReason: "return", ...at("2026-10-05"), debit: 0, credit: 500 };
  const pay = amount => ({ id: "lP", origin: "account", kind: "out", ...at("2026-10-10"), debit: amount, credit: 0 });
  it("B2 F1a: elle Borç 200, stok iadesi 500 (300'ü açık), bağsız Ödeme 400 → 300 açık iadeye, 100 kapattığı borcu yeniden açar: Borç kalan 100 (= bakiye)", () => {
    const out = settleLedger({ lines: [lD, ret500, pay(400)], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lD").remaining, 100);
  });
  it("B2 değişmez: Ödeme 200…500 → Σ açık (Borç kalan − iade açığı) = bakiye; 600 → iadeyi 100 aşan avans (K-a)", () => {
    for (const amount of [200, 300, 350, 400, 500, 600]) {
      const out = settleLedger({ lines: [lD, ret500, pay(amount)], invoices: [], today: TODAY });
      const balance = 200 - 500 + amount;
      const open = out.entries.get("lD").remaining;
      const returnOpen = Math.max(0, 500 - amount - (200 - open));
      assert.equal(open - returnOpen, Math.min(balance, 200), `Ödeme ${amount}: Borç kalan ${open}, iade açığı ${returnOpen}, bakiye ${balance}`);
    }
  });
  it("B2 açık iade bir kez tüketilir: Borç 200, iade 500, bağsız Ödeme 600, sonra elle Alacak 100 → 500 geri ödeme, artan 100 Alacak'ı kapatır: Borç 200, Alacak 0 (Σ 200 = bakiye)", () => {
    const lA = { id: "lA", origin: "account", kind: "credit", ...at("2026-10-12"), debit: 0, credit: 100 };
    const out = settleLedger({ lines: [lD, ret500, pay(600), lA], invoices: [], today: TODAY });
    assert.deepEqual([out.entries.get("lD").remaining, out.entries.get("lA").remaining], [200, 0]);
  });
  it("B2 tedarikçi simetriği: elle Alacak 200, Alış İadesi 500, bağsız Tahsilat 400 → Alacak kalan 100", () => {
    const lA = { id: "lA", origin: "account", kind: "credit", ...at("2026-10-01"), debit: 0, credit: 200 };
    const lQ = { id: "lQ", origin: "stock", kind: "debt", sourceId: "smove-q", stockReason: "preturn", ...at("2026-10-05"), debit: 500, credit: 0 };
    const lT = { id: "lT", origin: "account", kind: "in", ...at("2026-10-10"), debit: 0, credit: 400 };
    const out = settleLedger({ lines: [lA, lQ, lT], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lA").remaining, 100);
  });
  it("B3: açık iade ile elle Alacak aynı gün ve AYNI kayıt anında — yazım sırası: iade önce → Alacak 200 açık; Alacak önce → Alacak 0 (K-b en eski önce)", () => {
    const ret = { id: "lR", origin: "stock", kind: "credit", sourceId: "m1", stockReason: "return", date: "2026-10-05", at: "2026-10-05T10:00:00", debit: 0, credit: 300 };
    const credit = { id: "lA", origin: "account", kind: "credit", date: "2026-10-05", at: "2026-10-05T10:00:00", debit: 0, credit: 200 };
    const out = { id: "lP", origin: "account", kind: "out", date: "2026-10-10", at: "2026-10-10T10:00:00", debit: 300, credit: 0 };
    assert.equal(settleLedger({ lines: [ret, credit, out], invoices: [], today: TODAY }).entries.get("lA").remaining, 200, "iade önce yazıldı");
    assert.equal(settleLedger({ lines: [credit, ret, out], invoices: [], today: TODAY }).entries.get("lA").remaining, 0, "Alacak önce yazıldı");
  });
});

describe("K-b settleLedger (saf): iadeye bağlanmamış Ödeme açık iadeler ve elle Alacak arasında tek sıra, en eskiden", () => {
  const ret = date => ({ id: "lR", origin: "stock", kind: "credit", sourceId: "smove-9", stockReason: "return", date, at: `${date}T10:00:00`, debit: 0, credit: 300 });
  const credit = date => ({ id: "lA", origin: "account", kind: "credit", date, at: `${date}T10:00:00`, debit: 0, credit: 200 });
  const pay = { id: "lP", origin: "account", kind: "out", date: "2026-10-10", at: "2026-10-10T10:00:00", debit: 300, credit: 0 };
  it("açık iade (10-01) elle Alacak'tan (10-05) eski: Ödeme 300 önce iadeyi kapatır → Alacak 200 açık kalır (eski kural: Alacak kapanıyordu)", () => {
    const out = settleLedger({ lines: [ret("2026-10-01"), credit("2026-10-05"), pay], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lA").remaining, 200);
  });
  it("elle Alacak (09-25) iadeden (10-01) eski: önce Alacak 200, kalan 100 iadeye → Alacak 0", () => {
    const out = settleLedger({ lines: [ret("2026-10-01"), credit("2026-09-25"), pay], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lA").remaining, 0);
  });
  it("Tahsilat simetriği: açık Alış İadesi (preturn) elle Borç'tan eski → bağsız Tahsilat önce iadeyi kapatır, borç açık kalır", () => {
    const preturn = { id: "lQ", origin: "stock", kind: "debt", sourceId: "smove-8", stockReason: "preturn", date: "2026-10-01", at: "2026-10-01T10:00:00", debit: 300, credit: 0 };
    const debt = { id: "lD", origin: "account", kind: "debt", date: "2026-10-05", at: "2026-10-05T10:00:00", debit: 200, credit: 0 };
    const collect = { id: "lT", origin: "account", kind: "in", date: "2026-10-10", at: "2026-10-10T10:00:00", debit: 0, credit: 300 };
    const out = settleLedger({ lines: [preturn, debt, collect], invoices: [], today: TODAY });
    assert.equal(out.entries.get("lD").remaining, 200);
  });
});

describe("DB1 API: cari kartından iade geri ödemesi iadeye bağlanır (Geri Ödenen İade)", () => {
  let server;
  let api;
  let goods;
  let n = 0;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, legacyCasePayments: false, legacyTableTransfer: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "URN-DB1", name: "Ürün DB1", unit: "Adet", salePrice: "100", unitPrice: "100", openingQty: "1000" })).data;
  });
  after(async () => server?.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const refused = async (label, promise, status, code) => {
    const res = await promise;
    assert.equal(res.status, status, `${label}: beklenen ${status}, gelen ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    if (code) assert.equal(res.data?.code ?? res.data?.error?.code ?? res.data?.data?.code, code, `${label}: kod ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const card = acc => must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const invoice = async id => {
    const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
    return [doc.payState, doc.open];
  };
  const duesOf = async acc => (await must("takvim", api.get("/api/workspace/dues"))).items.filter(row => row.accountId === acc.id || row.person === acc.name).map(row => [row.source, row.amount]).sort();
  const vadeOf = async acc => (await must("vade takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-2100)}&to=${day(30)}`))).rows.filter(row => row.party === acc.name).map(row => [row.source, row.amount]).sort();
  const facts = async acc => {
    const ledger = await must("defter", api.get("/api/workspace/ledger"));
    const cash = await must("kasa", api.get("/api/workspace/cash"));
    return JSON.stringify({ trial: ledger.trial, cash: cash.totals, balance: (await card(acc)).totals });
  };
  // Kırmızı kanıtta (eski kod, ders 38) ilk düşen denetim iş sonucu olsun (B'nin açığı): satır kimliği bağ kolonuna bakmadan okunur; kolon sonra.
  const lastEntry = acc => server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", acc.id);
  const refundOfDb = id => server.app.store.get("SELECT refund_of AS refundOf FROM account_entries WHERE id = ?", id).refundOf;
  // dar2 S1 akışı (göreli günlerle): A 1.000 (t, tahsil edildi) → B 500 (t+30, vade t+40) → elle Borç 300 (t+35, vade t+50) → iade 300 (t+55) → geri ödeme
  // 300 (t+56, testte). Bakiye 800. Fatura serisi tarih sırası ister: her kurulum bir öncekinden sonraki 60 günü kullanır (t = −1560, −1500, …; hepsi geçmişte).
  let cursor = -1560;
  async function setup(label, { mode = "stock", docRefund = 0, type = "customer" } = {}) {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: `DB1 ${label}`, type, registeredOn: day(-2000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
    const a = await must("fatura A", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 10) } }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "1000", date: day(t + 5), method: "cash" }));
    const b = await must("fatura B", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t + 30), lines: [{ itemId: goods.id, qty: 5, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 40) } }));
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const debtCard = await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "300", date: day(t + 35), dueDate: day(t + 50) }));
    const debt = debtCard.entries.find(row => !before_.has(row.id));
    let target;
    if (mode === "stock") {
      await must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: acc.id, date: day(t + 55) }));
      target = server.app.store.get("SELECT id FROM stock_moves WHERE account_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", acc.id).id;
    } else {
      const full = await must("A oku", api.get(`/api/workspace/invoices/${a.id}`));
      target = (await must("iade faturası", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: a.id, issueDate: day(t + 55), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: docRefund ? [{ amount: String(docRefund), method: "cash", date: day(t + 55) }] : [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }))).id;
    }
    return { acc, a: a.id, b: b.id, debt, target, at: offset => day(t + offset) };
  }
  const remaining = async (acc, id) => (await card(acc)).entries.find(row => row.id === id).remaining;

  it("faturasız stok Satış İadesi + bağlı Ödeme: fatura B 500 ve borç 300 açık (Σ 800 = bakiye), takvim / Vade Takip aynı; bakiye, Kasa, mizan bağla değişmez", async () => {
    const { acc, a, b, debt, target, at } = await setup("Stok");
    // Önce bağsız — BAŞ MİMAR KARARI (25.10): artan bağsız Ödeme, B'yi kapatmış iadenin geri ödemesi sayılır (2.4.5'te B 200). Sonra aynı satıra açık bağ:
    // para kaydı da kapama da aynı kalır (açık bağ yalnız hangi iadenin geri ödendiğini kesinleştirir).
    await must("geri ödeme (bağsız)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true }));
    const pay = lastEntry(acc);
    assert.deepEqual(await invoice(b), ["overdue", 500], "bağsız: iadenin geri ödemesi sayılır — B 500 (2.4.5'te 200)");
    assert.equal(await remaining(acc, debt.id), 300, "bağsız: vadeli borç açık");
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]], "bağsız: takvim / zil B 500 + borç 300");
    const before_ = await facts(acc);
    const linked = await must("bağ ekle", api.put(`/api/workspace/accounts/${acc.id}/entries/${pay.id}`, { refundOf: target }));
    assert.equal(linked.totals.balance, 800, "bakiye 1.000 + 500 + 300 − 1.000 − 300 + 300");
    assert.deepEqual(await invoice(b), ["overdue", 500], "bağlı: iadenin alacağı geri ödemeyi kapatır, B'yi kapatmaz");
    assert.equal(refundOfDb(pay.id), target, "veri tabanında refund_of yazıldı");
    assert.equal(linked.entries.find(row => row.id === pay.id).refundOf, target);
    assert.match(linked.entries.find(row => row.id === pay.id).refundLabel || "", /Satış İadesi \(Faturasız\)/);
    assert.deepEqual(await invoice(a), ["paid", 0]);
    assert.equal(await remaining(acc, debt.id), 300, "vadeli borç açık");
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]], "takvim / zil: B 500 + borç 300");
    assert.deepEqual(await vadeOf(acc), [["account", 300], ["invoice", 500]], "Vade Takip takvimle aynı");
    assert.equal(await facts(acc), before_, "bakiye, Kasa ve mizan bağ eklenince değişmez");
    assert.deepEqual((await card(acc)).refundables, [], "iadenin tamamı geri ödendi: seçenek kalmadı");
    await must("bağı kaldır", api.put(`/api/workspace/accounts/${acc.id}/entries/${pay.id}`, { refundOf: "" }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "bağ kaldırılınca bağsız: yine iadenin geri ödemesi (B 500)");
    // Seçenek listesi yalnız açık bağları sayar (bağsız geri ödemenin geri ödeme sayılan kısmı listeye yansımaz — BİLİNEN SINIR, para etkisi yok).
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.refundKind, item.left]), [[target, "out", 300]], "Ödeme formunun seçeneği yeniden: iade, kalan 300");
    assert.equal(await facts(acc), before_, "bağ kaldırılınca da bakiye, Kasa ve mizan aynı");
  });

  it("K-d: fatura iadesi (satıştan iade belgesi) Ödeme'de Kapatılacak Fatura olarak seçilir: B 500, borç 300; bağ refund_of'ta (invoice_id boş); iadenin kapatanı bu geri ödeme", async () => {
    const { acc, b, debt, target, at } = await setup("Fatura", { mode: "invoice" });
    await must("Kapatılacak Fatura: iade", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, invoiceId: target }));
    const pay = lastEntry(acc);
    assert.equal((await card(acc)).totals.balance, 800);
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.equal(refundOfDb(pay.id), target);
    assert.equal(server.app.store.get("SELECT invoice_id AS v FROM account_entries WHERE id = ?", pay.id).v, "", "invoice_id boş (şüpheli alacak kuralı ve yevmiye değişmez)");
    assert.equal(await remaining(acc, debt.id), 300);
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]]);
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.equal(ret.payState, "return");
    assert.equal(ret.open, 0, "iade belgesi açığı 0 (geri ödendi)");
    assert.deepEqual(ret.closers.map(item => [item.id, item.amount, item.mode]), [[pay.id, 300, "linked"]], "iadenin kapatanı cari kartındaki geri ödeme (Bağlı)");
  });

  it("K-a kısmi + fazla: bağlı 100 → iadenin kalan 200'ü B'yi kapatır (B 300); ikinci bağlı 250 → 200 geri ödeme + 50 avans (reddedilmez): B 500", async () => {
    const { acc, b, debt, target, at } = await setup("Kısmi");
    await must("kısmi geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    assert.equal((await card(acc)).totals.balance, 600);
    assert.deepEqual(await invoice(b), ["overdue", 300]);
    assert.equal(await remaining(acc, debt.id), 300);
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.left]), [[target, 200]], "seçenekte kalan 200");
    await must("kalanı aşan ikinci geri ödeme (K-a: kabul)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "250", date: at(57), method: "cash", cashForce: true, refundOf: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iadenin tamamı geri ödendi: B 500");
    assert.equal(await remaining(acc, debt.id), 300, "avans 50 borcu kapatmaz (alacak tarafında ödeme değil)");
    assert.equal((await card(acc)).totals.balance, 850, "bakiye 600 + 250; açık kalemler B 500 + borç 300, avans 50 kalemsiz");
    assert.deepEqual((await card(acc)).refundables, []);
  });

  it("iade belgesinin kendi geri ödemesi (100) kalanı düşürür: cari kartından bağlanan 250'nin 200'ü geri ödeme, 50'si avans (K-a); B 500", async () => {
    const { acc, b, target, at } = await setup("Belge Geri Ödeme", { mode: "invoice", docRefund: 100 });
    assert.deepEqual(await invoice(b), ["overdue", 300], "belge 100 geri ödedi: iadenin kalan 200'ü asıl faturaya mahsup (K1), serbest kalan tahsilat B'yi 200 kapatır → B 300");
    assert.deepEqual((await card(acc)).refundables.map(item => [item.id, item.left]), [[target, 200]], "seçenekte kalan 200 (300 − belgedeki 100)");
    await must("kalanı aşan bağlı geri ödeme (250 > 200; K-a: kabul)", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "250", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iadenin tamamı geri ödendi (100 belge + 200 cari), 50 avans: B 500");
    assert.deepEqual((await card(acc)).refundables, []);
    // Kapama çekirdeğinin kendi bölmesi (seçenek listesinden bağımsız): bağlı 250'nin geri ödeme kısmı 200 (300 − belgedeki 100) iadeyle kapanır, açık kalmaz;
    // belgedeki geri ödeme kalandan düşmeseydi bağlı satırın 250'si geri ödeme sayılır, iade 300'ü aşan 50 açık yükümlülük kalırdı.
    const linked = lastEntry(acc).id;
    assert.equal(server.app.context.invoices.allEntryStates().get(linked)?.remaining ?? 0, 0, "bağlı geri ödemenin açık kalanı 0 (50 avans yükümlülük değil)");
  });

  it("reddedilen bağlar (öbür yönler aynen, K-d): ters yön (refundOf ve Kapatılacak Fatura yolu), başka carinin iadesi, satış faturası + iade birlikte, Borç Yaz'da, peşin iade, iptal edilmiş iade", async () => {
    const { acc, b, target, at } = await setup("Ret");
    const other = await setup("Ret Öbür");
    const entries = `/api/workspace/accounts/${acc.id}/entries`;
    const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;
    const was = count();
    await refused("Tahsilat → satıştan iade", api.post(entries, { kind: "in", amount: "100", date: at(56), method: "cash", refundOf: target }), 409, "refund-side");
    await refused("Tahsilat → satıştan iade (Kapatılacak Fatura yolu)", api.post(entries, { kind: "in", amount: "100", date: at(56), method: "cash", invoiceId: target }), 409, "refund-side");
    await refused("Ödeme → satış faturası (Kapatılacak Fatura)", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, invoiceId: b }), 409);
    await refused("başka carinin iadesi", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: other.target }), 404, "refund-missing");
    await refused("Kapatılacak Fatura ile birlikte", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: target, invoiceId: b }), 409);
    await refused("Borç Yaz'da", api.post(entries, { kind: "debt", amount: "100", date: at(56), refundOf: target }), 400, "refund-kind");
    await must("peşin iade (Kasa'dan geri verildi)", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "100", pay: "cash", method: "cash", date: at(57), cashForce: true }));
    const cashReturn = server.app.store.get("SELECT id FROM stock_moves WHERE reason = 'return' AND pay = 'cash' ORDER BY rowid DESC LIMIT 1").id;
    await refused("peşin iade cariye yazılmadı", api.post(entries, { kind: "out", amount: "100", date: at(56), method: "cash", cashForce: true, refundOf: cashReturn }), 404, "refund-missing");
    assert.equal(count(), was, "reddedilen isteklerin hiçbiri satır yazmadı (ders 3)");
    const inv = await setup("Ret İptal", { mode: "invoice" });
    await must("iadeyi iptal et", api.post(`/api/workspace/invoices/${inv.target}/cancel`, { reason: "deneme", force: true, cashForce: true }));
    await refused("iptal edilmiş iade", api.post(`/api/workspace/accounts/${inv.acc.id}/entries`, { kind: "out", amount: "100", date: inv.at(56), method: "cash", cashForce: true, refundOf: inv.target }), 409, "refund-invalid");
  });

  it("geri ödeme silinir → bağsız iade B'yi kapatır; Silinenler'den geri gelince bağ korunur", async () => {
    const { acc, b, target, at } = await setup("Sil");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const pay = lastEntry(acc);
    await must("geri ödemeyi sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${pay.id}?cashForce=1`));
    assert.deepEqual(await invoice(b), ["overdue", 200], "geri ödeme yokken iade alacağı B'yi kapatır");
    const item = server.app.store.get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", pay.id);
    assert.ok(item, "Silinenler'de");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "geri yüklenen geri ödeme yine iadeye bağlı");
    assert.equal(refundOfDb(pay.id), target, "bağ geri yüklemede korundu");
  });

  it("iade silinince bağlı geri ödemenin tamamı avans olur (K-a; B 500, borç 300 açık); iade geri yüklenince yeniden eşleşir", async () => {
    const { acc, b, debt, target, at } = await setup("İade Sil");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    await must("stok iadesini sil", api.del(`/api/workspace/stock/${goods.id}/moves/${target}`));
    const after_ = await card(acc);
    assert.equal(after_.totals.balance, 1100, "bakiye 1.000 + 500 + 300 − 1.000 + 300");
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.equal(await remaining(acc, debt.id), 300);
    assert.match(after_.entries.find(row => row.refundOf === target).refundLabel, /bulunamadı/, "kart iadenin silindiğini söyler");
    const item = server.app.store.get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", target);
    await must("iadeyi geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
    assert.equal((await card(acc)).totals.balance, 800);
    assert.deepEqual(await invoice(b), ["overdue", 500]);
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]]);
  });

  it("bağlı geri ödemesi olan stok iadesi düzeltilir (K-a): küçülünce fazlası avans (B 500), büyüyünce artanı B'yi kapatır (B 400), Kasa'ya çevrilince tamamı avans (B 500)", async () => {
    const { acc, b, debt, target, at } = await setup("Stok Düzelt");
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const move = `/api/workspace/stock/${goods.id}/moves/${target}`;
    await must("iade 2 adede (200 < 300)", api.put(move, { qty: "2" }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300], "iade 200 → geri ödeme 200, avans 100");
    await must("iade 4 adede (400 > 300)", api.put(move, { qty: "4" }));
    assert.deepEqual(await invoice(b), ["overdue", 400], "iade 400: önce geri ödeme 300, kalan 100 en eski açık borcu (B) kapatır");
    await must("iade Kasa'dan (cariye yazılmaz)", api.put(move, { pay: "cash", method: "cash", cashForce: true }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300], "iadenin carideki alacağı yok → geri ödemenin tamamı avans");
  });

  it("iade belgesi düzenlenip kendi geri ödemesi + cari kartından bağlı geri ödeme iadeyi aşarsa (150 + 200 > 300) kaydedilir; belgeninki önce, bağlının fazlası avans (K-a): B 500", async () => {
    const { acc, a, b, target, at } = await setup("Belge Sınırı", { mode: "invoice" });
    await must("bağlı geri ödeme 200", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "200", date: at(56), method: "cash", cashForce: true, refundOf: target }));
    const full = await must("A oku", api.get(`/api/workspace/invoices/${a}`));
    const body = (cash) => ({ kind: "sale_return", accountId: acc.id, originalId: a, issueDate: at(55), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true });
    await must("belgede 150 (150 + bağlı 200 > 300)", api.post(`/api/workspace/invoices/${target}/edit`, body([{ amount: "150", method: "cash", date: at(56) }])));
    assert.deepEqual(await invoice(b), ["overdue", 500], "iade 300'ün 150'si belgede, 150'si bağlı geri ödemede; bağlının 50'si avans");
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.equal(ret.open, 0);
  });

  it("K-e: verilen çek (Kapatılacak Fatura: satıştan iade) iadenin geri ödemesidir — B 500; alınan çek iadeye bağlanmaz (409)", async () => {
    const { acc, b, debt, target, at } = await setup("Çek", { mode: "invoice" });
    const cheque = { instrument: "cheque", accountId: acc.id, amount: 300, issueDate: at(56), dueDate: day(30), invoiceId: target };
    await refused("alınan evrak → satıştan iade", api.post("/api/workspace/cheques", { ...cheque, direction: "in", serialNo: "DB1-C1" }), 409);
    await must("verilen çek: iade geri ödemesi", api.post("/api/workspace/cheques", { ...cheque, direction: "out", serialNo: "DB1-C2" }));
    assert.deepEqual([await invoice(b), await remaining(acc, debt.id)], [["overdue", 500], 300]);
    const ret = await must("iade oku", api.get(`/api/workspace/invoices/${target}`));
    assert.deepEqual([ret.open, ret.closers.length, ret.closers[0]?.amount], [0, 1, 300], "iadenin kapatanı verilen çek");
  });

  it("K-f: kural cari türüne bakmaz — Tedarikçi türündeki caride de satıştan iadenin geri ödemesi bağlanır (B 500)", async () => {
    const { acc, b, target, at } = await setup("Tür Tedarikçi", { type: "supplier" });
    await must("bağlı geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true, invoiceId: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500]);
  });

  it("K-b: iadeye bağlanmamış Ödeme açık iade belgesi (eski) ile elle Alacak (yeni) arasında en eskiden: iade açığı 0, Alacak 200 açık (eski kural: Alacak 0, iade açığı 200)", async () => {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "DB1 Tek Sıra", type: "customer", registeredOn: day(-2000), phone: "0500 246 09 99" }));
    // A peşin ödendi (faturaya bağlı): iadenin alacağı asıl faturaya mahsup edilemez → iade belgesi açık 300 (K1).
    const a = await must("fatura A (peşin)", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { cash: [{ amount: "1000", method: "cash", date: day(t) }], rest: "open", dueDate: day(t + 10) } }));
    const full = await must("A oku", api.get(`/api/workspace/invoices/${a.id}`));
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: a.id, issueDate: day(t + 20), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const credited = await must("elle Alacak", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "credit", amount: "200", date: day(t + 30) }));
    const credit = credited.entries.find(row => !before_.has(row.id));
    assert.equal((await must("iade oku", api.get(`/api/workspace/invoices/${ret.id}`))).open, 300, "ön koşul: iade açığı 300 (asıl fatura ödenmiş)");
    await must("bağsız Ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: day(t + 40), method: "cash", cashForce: true }));
    assert.equal((await must("iade oku", api.get(`/api/workspace/invoices/${ret.id}`))).open, 0, "eski açık iade önce kapandı");
    assert.equal(await remaining(acc, credit.id), 200, "yeni elle Alacak açık kalır");
    assert.equal((await card(acc)).totals.balance, -200, "bakiye 1.000 − 1.000 − 300 − 200 + 300 = Alacak 200");
  });

  it("açık bağ bağsızdan önce gelir (elle Alacak varken): bağsız Ödeme önce Alacak'ı kapatır (B 200); iadeye bağlanınca iadeyi geri öder (B 500, Alacak açık), takvim de; verilen çekte aynı (K-e)", async () => {
    const { acc, b, target, at } = await setup("Önce Bağ");
    const entries = `/api/workspace/accounts/${acc.id}/entries`;
    const before_ = new Set((await card(acc)).entries.map(row => row.id));
    const credited = await must("elle Alacak", api.post(entries, { kind: "credit", amount: "300", date: at(55) }));
    const credit = credited.entries.find(row => !before_.has(row.id));
    await must("bağsız Ödeme", api.post(entries, { kind: "out", amount: "300", date: at(56), method: "cash", cashForce: true }));
    const pay = lastEntry(acc);
    assert.deepEqual(await invoice(b), ["overdue", 200], "bağsız: K-b önce kendi tarafı — Alacak kapandı, artan yok, iade B'yi kapatır");
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 200]], "takvim: B 200 + borç 300");
    const facts0 = await facts(acc);
    await must("iadeye bağla", api.put(`${entries}/${pay.id}`, { refundOf: target }));
    assert.deepEqual(await invoice(b), ["overdue", 500], "bağlı: iadenin geri ödemesi — B 500");
    assert.equal(await remaining(acc, credit.id), 300, "elle Alacak yeniden açık (bağlı geri ödeme onu kapatmaz)");
    assert.deepEqual(await duesOf(acc), [["account", 300], ["invoice", 500]], "takvim bağ değişimini görür: B 500 + borç 300");
    assert.equal(await facts(acc), facts0, "bakiye, Kasa, mizan değişmez");
    const other = await setup("Önce Bağ Çek", { mode: "invoice" });
    const ob = new Set((await card(other.acc)).entries.map(row => row.id));
    const oc = (await must("elle Alacak", api.post(`/api/workspace/accounts/${other.acc.id}/entries`, { kind: "credit", amount: "300", date: other.at(55) }))).entries.find(row => !ob.has(row.id));
    await must("verilen çek (iadeye bağlı)", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "out", accountId: other.acc.id, amount: 300, issueDate: other.at(56), dueDate: day(30), serialNo: "DB1-ONCE", invoiceId: other.target }));
    assert.deepEqual(await invoice(other.b), ["overdue", 500], "çek iadeye bağlı: B 500");
    assert.equal(await remaining(other.acc, oc.id), 300, "elle Alacak açık (çek onu kapatmaz)");
  });

  it("B1 (dar kontrol): satış 1.000 → stok iadesi 300 → bağsız Ödeme 300 → Mevcut Borcu Taksitlendir 1.000: borç kartla BİR kez — Vade Takip ve takvim 1.000 (fatura kalemi yok)", async () => {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "DB1 Kart Kapsam", type: "customer", registeredOn: day(-2000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
    const sale = await must("satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 10) } }));
    await must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: acc.id, date: day(t + 20) }));
    await must("bağsız Ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: day(t + 30), method: "cash", cashForce: true }));
    assert.equal((await card(acc)).totals.balance, 1000, "ön koşul: bakiye 1.000");
    await must("Mevcut Borcu Taksitlendir", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(t + 40), total: "1000", accountId: acc.id, mode: "auto", count: "2", firstDue: day(t + 55), everyMonths: "1", coversBalance: true }));
    const vade = await vadeOf(acc);
    assert.deepEqual(vade, [["plan", 500], ["plan", 500]], "Vade Takip: kartın iki taksiti, fatura kalemi yok (5fa544c / 49c41f9: fatura 300 + kart 1.000 = 1.300)");
    assert.equal((await duesOf(acc)).filter(row => row[0] === "invoice").length, 0, "takvimde fatura kalemi yok");
    assert.deepEqual(await invoice(sale.id), ["overdue", 1000], "fatura açığı 1.000 (iadenin geri ödemesi) — kartın kapsamında");
  });

  it("B2 F1b (dar kontrol): satış A 1.000, Tahsilat 600 → A, A'nın iadesi 500 (100'ü açık), bağsız Ödeme 300 → A açık 200, iade açığı 0 (açık bağla aynı)", async () => {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "DB1 Kısmen Açık", type: "customer", registeredOn: day(-2000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
    const sale = await must("satış A", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(t + 10) } }));
    await must("Tahsilat → A", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "600", date: day(t + 5), method: "cash", invoiceId: sale.id }));
    const full = await must("A oku", api.get(`/api/workspace/invoices/${sale.id}`));
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: sale.id, issueDate: day(t + 20), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 5 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    assert.deepEqual([(await invoice(sale.id))[1], (await invoice(ret.id))[1]], [0, 100], "ön koşul: A kapandı (600 + iade 400), iadenin 100'ü açık");
    await must("bağsız Ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: day(t + 25), method: "cash", cashForce: true }));
    assert.deepEqual([(await invoice(sale.id))[1], (await invoice(ret.id))[1]], [200, 0], "A açık 200, iade 0 (bakiye 1.000 − 600 − 500 + 300 = 200)");
  });

  it("B3 (dar kontrol, durağan saat): açık stok iadesi ile elle Alacak aynı gün ve aynı kayıt anında — yazım sırası belirler (iade önce → Alacak 200 açık; Alacak önce → 0)", async () => {
    const t = cursor;
    cursor += 60;
    const run = async (label, returnFirst) => {
      const acc = await must("cari", api.post("/api/workspace/accounts", { name: `DB1 Sıra ${label}`, type: "customer", registeredOn: day(-2000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
      const entries = `/api/workspace/accounts/${acc.id}/entries`;
      const stockReturn = () => must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: acc.id, date: day(t + 10) }));
      const credit = () => must("elle Alacak", api.post(entries, { kind: "credit", amount: "200", date: day(t + 10), dueDate: day(t + 20) }));
      if (returnFirst) { await stockReturn(); await credit(); } else { await credit(); await stockReturn(); }
      const id = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'credit' AND source = '' ORDER BY rowid DESC LIMIT 1", acc.id).id;
      const stamps = server.app.store.all("SELECT created_at AS c FROM account_entries WHERE account_id = ? ORDER BY rowid", acc.id).map(row => row.c);
      assert.equal(new Set(stamps).size, 1, `ön koşul: kayıt anları eşit (durağan saat) ${stamps}`);
      await must("bağsız Ödeme", api.post(entries, { kind: "out", amount: "300", date: day(t + 15), method: "cash", cashForce: true }));
      return remaining(acc, id);
    };
    assert.equal(await run("İade Önce", true), 200, "iade önce yazıldı: Ödeme önce iadeyi geri öder, Alacak açık");
    assert.equal(await run("Alacak Önce", false), 0, "Alacak önce yazıldı: Ödeme önce Alacak'ı kapatır");
  });

  it("taksitli faturanın iadesi: geri ödemesi iadeye bağlanmaz (409 refund-planned; cari Ödeme iki yolla ve verilen çek), seçeneklerde yok; bağsız Ödeme taksitli faturayı açmaz (açık = kartın kalanı)", async () => {
    const t = cursor;
    cursor += 60;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "DB1 Taksitli", type: "customer", registeredOn: day(-2000), phone: `0500 246 00 ${String((n += 1)).padStart(2, "0")}` }));
    const sale = await must("taksitli satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(t), lines: [{ itemId: goods.id, qty: 9, unitPrice: "100", vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: day(t + 30), everyMonths: 1 } } }));
    const full = await must("oku", api.get(`/api/workspace/invoices/${sale.id}`));
    assert.ok(full.planId || full.plan?.id, "ön koşul: fatura taksitli (kendi kartı var)");
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: sale.id, issueDate: day(t + 20), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    const planOf = async () => (await must("kart", api.get(`/api/workspace/plans/${full.planId || full.plan.id}`))).totals.remaining;
    const before_ = [(await invoice(sale.id))[1], await planOf()];
    assert.equal(before_[0], before_[1], "ön koşul: fatura açığı = kartın kalanı");
    assert.deepEqual((await card(acc)).refundables, [], "taksitli faturanın iadesi Geri Ödenen İade seçeneklerinde yok");
    const entries = `/api/workspace/accounts/${acc.id}/entries`;
    const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;
    const was = count();
    await refused("Ödeme → taksitli faturanın iadesi (Kapatılacak Fatura)", api.post(entries, { kind: "out", amount: "300", date: day(t + 21), method: "cash", cashForce: true, invoiceId: ret.id }), 409, "refund-planned");
    await refused("Ödeme → taksitli faturanın iadesi (refundOf)", api.post(entries, { kind: "out", amount: "300", date: day(t + 21), method: "cash", cashForce: true, refundOf: ret.id }), 409, "refund-planned");
    const cheques = () => server.app.store.get("SELECT COUNT(*) AS n FROM cheques WHERE account_id = ?", acc.id).n;
    await refused("verilen çek → taksitli faturanın iadesi", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "out", accountId: acc.id, amount: 300, issueDate: day(t + 21), dueDate: day(30), serialNo: "DB1-TK1", invoiceId: ret.id }), 409);
    assert.deepEqual([count(), cheques()], [was, 0], "reddedilenler veri tabanına yazılmadı");
    await must("bağsız Ödeme", api.post(entries, { kind: "out", amount: "300", date: day(t + 22), method: "cash", cashForce: true }));
    const after_ = [(await invoice(sale.id))[1], await planOf()];
    assert.deepEqual(after_, before_, "bağsız Ödeme taksitli faturanın açığını ve kartını değiştirmez (açık = kartın kalanı)");
  });

  it("tedarikçi simetriği: alıştan iade faturası + tedarikçiden bağlı Tahsilat → açık alış faturası kapanmaz", async () => {
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "DB1 Tedarikçi", type: "supplier", registeredOn: day(-400) }));
    const p1 = await must("alış P1", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "DB1-P1", issueDate: day(-50), pricesIncludeVat: false, lines: [{ itemId: goods.id, qty: 4, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: day(-40) } }));
    await must("P1 ödemesi", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "400", date: day(-45), method: "cash", cashForce: true }));
    const p2 = await must("alış P2", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "DB1-P2", issueDate: day(-30), pricesIncludeVat: false, lines: [{ itemId: goods.id, qty: 3, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: day(-20) } }));
    const full = await must("P1 oku", api.get(`/api/workspace/invoices/${p1.id}`));
    const ret = await must("alıştan iade", api.post("/api/workspace/invoices", { kind: "purchase_return", accountId: supplier.id, originalId: p1.id, number: "DB1-R1", issueDate: day(-10), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    assert.deepEqual(await invoice(p2.id), ["overdue", 200], "bağsız: iadenin artanı en eski açık alışı (P2) kapatır");
    // Tedarikçiye kesilmiş satış faturası (Kapatılacak Fatura olarak geçerli) + bağ birlikte: iade geri ödemesi fatura kapatmaz → 400 (hiçbir satır yazılmaz).
    const sale = await must("tedarikçiye satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: supplier.id, issueDate: day(-9), lines: [{ itemId: goods.id, qty: 1, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-9) } }));
    const rows = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", supplier.id).n;
    const was = rows();
    await refused("Kapatılacak Fatura + Geri Ödenen İade", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "in", amount: "100", date: day(-9), method: "cash", refundOf: ret.id, invoiceId: sale.id }), 400, "refund-with-invoice");
    assert.equal(rows(), was, "reddedilen istek satır yazmadı");
    await must("satışı iptal et", api.post(`/api/workspace/invoices/${sale.id}/cancel`, { reason: "deneme", force: true, cashForce: true }));
    await must("tedarikçinin geri ödemesi (bağlı Tahsilat)", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "in", amount: "100", date: day(-9), method: "cash", refundOf: ret.id }));
    assert.deepEqual(await invoice(p2.id), ["overdue", 300], "bağlı: iadenin alacağı geri ödemeyi kapatır, P2 açık 300");
    assert.equal((await card(supplier)).totals.balance, -300, "tedarikçiye borcumuz 300");
    assert.deepEqual((await card(supplier)).refundables, [], "alıştan iadenin tamamı geri alındı");
    await refused("Ödeme → alıştan iade", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "100", date: day(-9), method: "cash", cashForce: true, refundOf: ret.id }), 409, "refund-side");
  });
});
