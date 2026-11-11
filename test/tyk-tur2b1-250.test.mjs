// 2.5.0 Ç5-B tur 2b-1 (dar kontrol DK-C5BT2A) — GERÇEK program (API) üzerinden: G-2 (taksitsiz / eksik taksitli kart açılır açılmaz 'Bitti'), ORTA-1 (çek / senedin 'Kapatılacak
// Fatura' bağı kilitten SONRA evrak düzeltmesiyle kurulunca / değişince kilit yok sayılıyordu), ORTA-2 (tedarikçideki faturasız ve faturalı Alış İadesi gecikmişte sayılıp Vade Takip /
// zil / takvim / nakit akışında yoktu), G-1 (kart yazım yanıtı ve kart ekranı kuyruğu yalnız kartın carisi için kurar — sonuç bütün carilerin kuyruğuyla AYNI), test dişi (DK-C5BT2A
// DÜŞÜK-1: D01–D03 iz kolonları DURAĞAN saatte, D05 bağı iki kez değiştiren düzeltme, D06 'Hangi Taksite' bağının düzeltme anı, D10 / D11 Taksit İadesi kalemi).
// Beklenenler ELLE: G-2 → v2.4.9'un GERÇEK kodunun sayıları (dar kontrol / tur 2b-1 betiği g2-matris, v2.4.9 = ccf0b0ca; yorumda); öbürleri karar metinlerinden (karar (2), (3), S50,
// S91, S93, S96) — hesap yorumda (ders 5, 40). Sahte saat (ders 13): kilit sınırı AKAN saatle; iz kolonları DURAĞAN saatle.
// Eski kodda (tur 2a sonu, claude/epic-thompson-w0lc2l d158f6ea) kırmızı: G-2 kart 'done'; ORTA-1 çek gecikmiş 300 / 50; ORTA-2 Vade Takip / zil 0; D06 [0, 300] yerine [0, 0].
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const tr = iso => iso.split("-").reverse().join(".");
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const AUDIT = { id: "test", role: "admin", permissions: [] };
const sum = rows => Math.round(rows.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;

async function harness({ fixed = false } = {}) {
  const server = await startTestServer({ now: { time: NOW, fixed }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = await loginAdmin(server);
  const wrap = c => ({ get: async url => unwrap(await c.get(url)), post: async (url, body) => unwrap(await c.post(url, body)), put: async (url, body) => unwrap(await c.put(url, body)), del: async url => unwrap(await c.del(url)) });
  const api = wrap(client);
  let n = 0;
  const h = {
    server,
    client,
    api,
    wrap,
    tick: () => server.clock.advance({ seconds: 30 }),
    async must(label, promise) {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    },
    account: (label, type = "customer") => h.must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Tur2b1 ${label}`, type, registeredOn: day(-400), phone: `0500 254 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` })),
    card: acc => h.must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`)),
    plan: id => h.must("taksit kartı", api.get(`/api/workspace/plans/${id}`)),
    async entry(acc, body) {
      const known = new Set((await h.card(acc)).entries.map(e => e.id));
      return (await h.must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, ...body }))).entries.find(e => !known.has(e.id));
    },
    tabs: async id => {
      const out = [];
      for (const status of ["active", "overdue", "done", "closed"]) if ((await h.must("Taksitler", api.get(`/api/workspace/plans?status=${status}&limit=5000`))).plans.some(p => p.id === id)) out.push(status);
      return out.join("/");
    },
    listRow: async id => (await h.must("Taksitler (tümü)", api.get("/api/workspace/plans?status=all&limit=5000"))).plans.find(p => p.id === id),
    vade: async (acc, query = `from=${day(-500)}&to=${day(500)}`) => (await h.must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?${query}`))).rows.filter(r => r.party === acc.name || r.accountId === acc.id),
    dues: async acc => (await h.must("zil", api.get("/api/workspace/dues"))).items.filter(r => r.accountId === acc.id || r.person === acc.name),
    lock: until => h.must("kilit", api.put("/api/admin/period-lock", { lockedUntil: until })),
    ctx: () => server.app.context,
    fresh(acc) {
      const ledger = h.ctx().accounts.detail(acc.id, AUDIT, { withRemaining: false }).ledger;
      return h.ctx().invoices.obligationsFor(acc.id, ledger);
    },
  };
  await api.post("/api/workspace/bank/setup/dismiss", {});
  h.item = await h.must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: `HZM-2B1-${fixed ? "D" : "A"}`, name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  h.sale = async (acc, date, amount, due = date) => (await h.must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: h.item.id, qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", dueDate: due }, cashForce: true }))).id;
  return h;
}
// Bir kartın karşılaştırılan görünümü (yanıt / okuma / liste satırı).
const view = p => JSON.stringify({ state: p.state, totals: p.totals, next: p.next, items: (p.items || []).map(i => [i.id, i.remaining, i.state, i.accountPaid]) });
const head = p => JSON.stringify({ state: p.state, totals: p.totals, next: p.next });
// Bir carinin kuyruğunun özeti (önbellek ↔ baştan; test/tyk-onbellek-250 digest'iyle aynı alanlar + fatura tutarı).
const digest = result => JSON.stringify([
  result.overdue(TODAY).amount, result.items.map(i => [i.key, i.remaining, i.vade]),
  [...result.invoices].sort().map(([k, v]) => [k, v.payable, v.open, v.state, (v.closers || []).map(c => [c.id, c.amount, c.mode])]),
  [...result.installments].sort().map(([k, m]) => [k, [...m].sort().map(([i, r]) => [i, r.remaining, r.byAccount])]),
]);

// ---------------- G-2 ----------------
// ELLE — v2.4.9'un GERÇEK kodu (g2-matris; kart 1.000, Kayıt −30): taksiti olmayan kart (ayrı, Mevcut Borç, stoktan / faturadan taksitleri silinmiş, Excel'den taksitsiz)
// kapatılmadıkça Aktif ('active' sekmesi, 'done' DEĞİL); kartın KENDİ tahsilatıyla tamamı ödenince Bitti; kart seçilmeden alınan cari tahsilatıyla ödenince Aktif (kartın kendi
// kalanı 1.000). Mevcut Borç kartında taksitlere bölünmemiş kısım kalırken (eksik taksit) taksitler cari tahsilatıyla kapansa da Bitti değil (v2.4.9: Gecikti — S50 farkı: taksit
// ödendi → Aktif). Elle Kartı Kapat → Kapalı. Taksitsiz Mevcut Borç kartına sonra taksit girilince (−10, +20) kart borcu tüketir: [500 Gecikti, 500], Gecikmiş Borç 500.
describe("2.5.0 Ç5-B tur 2b-1 — G-2: taksitsiz / eksik taksitli kart 'Bitti' olmaz (v2.4.9)", () => {
  let h;
  before(async () => {
    h = await harness();
  });
  after(async () => h?.server.close());
  const makers = {
    "Ayrı": async acc => (await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-30), total: "1000", accountId: acc.id }))).id,
    "Mevcut Borç": async acc => {
      await h.entry(acc, { kind: "debt", amount: "1000", date: day(-30) });
      h.tick();
      return (await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-30), total: "1000", accountId: acc.id, coversBalance: true }))).id;
    },
    "Stoktan": async acc => {
      await h.must("stok satış", h.api.post(`/api/workspace/stock/${h.goods.id}/moves`, { kind: "out", qty: "10", unitPrice: "100", pay: "account", method: "cash", accountId: acc.id, date: day(-30), installments: { count: 2, firstDue: day(-10) } }));
      return (await h.card(acc)).plans[0].id;
    },
    "Faturadan": async acc => {
      await h.must("taksitli fatura", h.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-30), lines: [{ itemId: h.item.id, qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "installments", installments: { count: 2, firstDue: day(-10), everyMonths: 1 } }, cashForce: true }));
      return (await h.card(acc)).plans[0].id;
    },
    "Excel": async acc => {
      await h.must("Excel", h.api.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit", "İlk Vade", "Kayıt"], [acc.name, "1000", "", tr(day(-10)), tr(day(-30))]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "registered" }, fileName: `t2b1-${acc.id}.xlsx`, linkRecords: false }));
      return h.server.app.store.get("SELECT id FROM plans WHERE name = ? AND deleted_at IS NULL ORDER BY rowid DESC", acc.name).id;
    },
  };
  const emptied = async id => {
    for (const row of (await h.plan(id)).items) await h.must("taksit sil", h.api.del(`/api/workspace/plans/${id}/items/${row.id}`));
  };
  it("her kart türü × taksitsiz × (ödeme yok / kart tahsilatı / cari tahsilatı): durum ve Taksitler sekmesi v2.4.9 ile aynı", async () => {
    h.goods = await h.must("ürün", h.api.post("/api/workspace/stock", { name: "Tur2b1 Ürün", code: "URN-2B1", unit: "Adet", unitPrice: "10", salePrice: "100" }));
    await h.must("alım", h.api.post(`/api/workspace/stock/${h.goods.id}/moves`, { kind: "in", qty: "1000", unitPrice: "10", pay: "none", date: day(-200) }));
    const want = { yok: ["active", "active"], kart: ["done", "done"], cari: ["active", "active"] };
    // G3 (tur 2b-2, ekran yürüyüşü 1 Y2 — BAŞ MİMAR KARARI 11.11 05:48, S91 = A'nın sunumu): taksitlere bölünmemiş kalanı kuyrukta kalem olan kart (ayrı kart, Excel kartı,
    // taksitleri silinmiş faturanın kartı — kalemin günü kartın açılış günü −30) ödenmemişse "Gecikti" (Geciken sekmesi) — zil / Vade Takip / cari kartındaki gecikmişle aynı.
    // v2.4.9 bu kartları Aktif gösteriyordu (fark testinde karar adıyla). Mevcut Borç / stoktan kartın taksitlendirilmemiş kısmı alttaki borç kalemidir (kartın değil) → Aktif.
    const OWN_REST = new Set(["Ayrı", "Faturadan", "Excel"]);
    const wantOf = (kind, pay) => (pay === "yok" && OWN_REST.has(kind) ? ["overdue", "active/overdue"] : want[pay]);
    for (const [kind, make] of Object.entries(makers)) {
      for (const pay of ["yok", "kart", "cari"]) {
        const acc = kind === "Excel" ? { name: `Tur2b1 G2 ${kind} ${pay}` } : await h.account(`G2 ${kind} ${pay}`);
        const id = await make(acc);
        if (kind === "Excel") Object.assign(acc, { id: h.server.app.store.get("SELECT account_id AS id FROM plans WHERE id = ?", id).id });
        if (kind === "Stoktan" || kind === "Faturadan") await emptied(id);
        h.tick();
        if (pay === "kart") await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${id}/entries`, { kind: "in", amount: "1000", date: day(-5), method: "cash", cashForce: true }));
        if (pay === "cari") await h.entry(acc, { kind: "in", amount: "1000", date: day(-5) });
        h.tick();
        const p = await h.plan(id);
        assert.deepEqual([p.items.length, p.state, await h.tabs(id)], [0, ...wantOf(kind, pay)], `${kind} · taksitsiz · ödeme ${pay}`);
        assert.equal((await h.listRow(id)).state, wantOf(kind, pay)[0], `${kind} · ${pay}: Taksitler listesi satırı`);
      }
    }
  });
  it("taksitsiz Mevcut Borç kartı Aktif → taksit girilir: [500 Gecikti, 500], Gecikmiş Borç 500, 'Gecikmiş' sekmesi; elle Kartı Kapat → Kapalı", async () => {
    const acc = await h.account("G2 Sonra Taksit");
    const id = await makers["Mevcut Borç"](acc);
    h.tick();
    assert.deepEqual([(await h.plan(id)).state, await h.tabs(id)], ["active", "active"], "açılır açılmaz Aktif (v2.4.9)");
    assert.equal((await h.card(acc)).totals.overdueDebt, 1000, "borç kapsanmadan (taksit yok) Gecikmiş Borç 1.000 — S1");
    await h.must("1. taksit", h.api.post(`/api/workspace/plans/${id}/items`, { dueDate: day(-10), amount: "500" }));
    await h.must("2. taksit", h.api.post(`/api/workspace/plans/${id}/items`, { dueDate: day(20), amount: "500" }));
    h.tick();
    const p = await h.plan(id);
    assert.deepEqual([p.state, p.items.map(i => [i.remaining, i.state]), await h.tabs(id)], ["overdue", [[500, "overdue"], [500, "open"]], "active/overdue"]);
    assert.equal((await h.card(acc)).totals.overdueDebt, 500, "kart borcu tüketti: Gecikmiş Borç 500");
    const closedAcc = await h.account("G2 Kapat");
    const closed = await makers["Ayrı"](closedAcc);
    await h.must("Kartı Kapat", h.api.put(`/api/workspace/plans/${closed}`, { status: "closed" }));
    assert.deepEqual([(await h.plan(closed)).state, await h.tabs(closed)], ["closed", "closed"], "elle kapatılan taksitsiz kart Kapalı");
  });
  it("eksik taksitli kart: taksitler kartla ödenince Bitti (v2.4.9); Mevcut Borç kartında taksitler cari tahsilatıyla kapanınca Aktif (taksitlendirilmemiş kısım var — v2.4.9 Gecikti, S50 farkı)", async () => {
    const a = await h.account("G2 Eksik Kart");
    const pa = await makers["Mevcut Borç"](a);
    await h.must("taksit", h.api.post(`/api/workspace/plans/${pa}/items`, { dueDate: day(-10), amount: "500" }));
    h.tick();
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${pa}/entries`, { kind: "in", amount: "1000", date: day(-5), method: "cash", cashForce: true }));
    assert.deepEqual([(await h.plan(pa)).state, await h.tabs(pa)], ["done", "done"], "kartın kendi tahsilatıyla tamamı ödendi → Bitti (v2.4.9)");
    const b = await h.account("G2 Eksik Cari");
    const pb = await makers["Mevcut Borç"](b);
    await h.must("taksit", h.api.post(`/api/workspace/plans/${pb}/items`, { dueDate: day(-10), amount: "500" }));
    h.tick();
    await h.entry(b, { kind: "in", amount: "1000", date: day(-5) });
    const p = await h.plan(pb);
    assert.deepEqual([p.items.map(i => [i.remaining, i.state]), p.state, await h.tabs(pb)], [[[0, "paid"]], "active", "active"], "taksit cari tahsilatıyla kapandı (S50), taksitlendirilmemiş 500 için kart Aktif");
  });
});

// ---------------- ORTA-1 ----------------
// Kurgu (her cari ayrı; dar kontrol o1-kilit + tur 2b-1 o1-ek): F1 1.000 (−60, vade +10) · F2 500 (−50, vade −50) · P bağsız 500 (−45) · D Borç Yaz 300 (−35, vade −25) · evrak
// (çek, düzenleme −30, vade +40) ya da cari tahsilatı 300 (−30) · kilit −40 (P'den SONRA, düzeltmelerden ÖNCE).
// ELLE (karar (2), (3)): kilitli dönemde P ile bağsız kapanmış F2, kilitten SONRA kurulan / F1'den F2'ye çevrilen bağla yeniden açılmaz; bağın 300'ü bağsız gibi −30'da dağılır →
// açık olan D (vade −25; F1 vadesi +10) kapanır → Gecikmiş Borç 0 (aynı bağı kilitten sonra YENİ evrakla kurmak da 0). Bağ kilitten ÖNCE kurulmuşsa bağın anı oluşturulma anıdır;
// yalnız tutar (300 → 250) ya da yalnız vade / açıklama düzeltmesi anı DEĞİŞTİRMEZ (cari tahsilatıyla aynı): bağ F2 250 + P 250, P'nin 250'si F1'e; D açık → 300 (yalnız vade: 300).
// Bağ kaldırılınca (bugünkü kural; KULLANICIYA SORULMALI listesinde): ödeme bağsız, çek = cari tahsilatı.
describe("2.5.0 Ç5-B tur 2b-1 — ORTA-1: çek / senedin Kapatılacak Fatura bağı × kilit (karar (3)) = cari tahsilatı", () => {
  let h;
  before(async () => {
    h = await harness();
  });
  after(async () => h?.server.close());
  it("kurulum / değiştirme / tutar / vade / kaldırma: çek ile cari tahsilatı aynı Gecikmiş Borç; kilitten sonra kurulan çek bağı = yeni evrak", async () => {
    const cases = ["kur", "değiş", "tutar", "vade", "kaldır"];
    const sets = {};
    for (const k of cases) for (const via of ["çek", "tahsilat"]) sets[`${k} ${via}`] = { k, via, acc: await h.account(`O1 ${k} ${via}`) };
    const fresh = { k: "yeni", via: "çek", acc: await h.account("O1 yeni evrak") };
    const all = [...Object.values(sets), fresh];
    for (const s of all) { s.F1 = await h.sale(s.acc, day(-60), 1000, day(10)); h.tick(); }
    for (const s of all) { s.F2 = await h.sale(s.acc, day(-50), 500, day(-50)); h.tick(); }
    for (const s of all) {
      await h.entry(s.acc, { kind: "in", amount: "500", date: day(-45) });
      h.tick();
      await h.entry(s.acc, { kind: "debt", amount: "300", date: day(-35), dueDate: day(-25) });
      h.tick();
    }
    for (const s of Object.values(sets)) {
      const bond = s.k === "kur" ? "" : s.k === "değiş" ? s.F1 : s.F2;
      if (s.via === "çek") s.ch = await h.must("çek", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-30), dueDate: day(40), serialNo: `O1-${s.k}`, accountId: s.acc.id, ...(bond ? { invoiceId: bond } : {}) }));
      else s.p = await h.entry(s.acc, { kind: "in", amount: "300", date: day(-30), ...(bond ? { invoiceId: bond } : {}) });
      h.tick();
    }
    await h.lock(day(-40));
    h.tick();
    try {
      await h.must("yeni evrak (kilitten sonra, F2'ye)", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-30), dueDate: day(40), serialNo: "O1-yeni", accountId: fresh.acc.id, invoiceId: fresh.F2 }));
      h.tick();
      for (const s of Object.values(sets)) {
        const body = { kur: { invoiceId: s.F2 }, "değiş": { invoiceId: s.F2 }, tutar: { amount: "250" }, vade: s.via === "çek" ? { dueDate: day(50) } : { note: "yalnız açıklama" }, "kaldır": { invoiceId: "" } }[s.k];
        if (s.via === "çek") await h.must(`çek düzelt ${s.k}`, h.api.put(`/api/workspace/cheques/${s.ch.id}`, body));
        else await h.must(`tahsilat düzelt ${s.k}`, h.api.put(`/api/workspace/accounts/${s.acc.id}/entries/${s.p.id}`, { ...body, cashForce: true }));
        h.tick();
      }
      const late = async acc => (await h.card(acc)).totals.overdueDebt;
      assert.equal(await late(fresh.acc), 0, "kilitten sonra YENİ evrakla kurulan bağ: 0");
      const want = { kur: 0, "değiş": 0, tutar: 300, vade: 300, "kaldır": 0 };
      for (const k of cases) {
        const cek = await late(sets[`${k} çek`].acc);
        const tah = await late(sets[`${k} tahsilat`].acc);
        assert.deepEqual([cek, tah], [want[k], want[k]], `${k}: çek ${cek} · cari tahsilatı ${tah} (beklenen ${want[k]})`);
        const cached = h.ctx().invoices.allObligations().get(sets[`${k} çek`].acc.id);
        assert.equal(cached.overdue(TODAY).amount, want[k], `${k}: önbellekli kuyruk da aynı`);
      }
      const vadeEvent = h.server.app.store.get("SELECT invoice_id AS inv FROM cheque_events WHERE cheque_id = ? ORDER BY rowid LIMIT 1", sets["vade çek"].ch.id);
      assert.equal(vadeEvent.inv, sets["vade çek"].F2, "yalnız vade düzeltmesi bağı değiştirmedi");
      // Kilit kaldır + yeniden koy: karar yazım anındaki kilitle (S19) — sayılar değişmez.
      await h.lock("");
      h.tick();
      await h.lock(day(-40));
      h.tick();
      for (const k of cases) assert.equal(await late(sets[`${k} çek`].acc), want[k], `${k}: kilit kaldır / koy sonrası aynı`);
    } finally {
      await h.lock("");
      h.tick();
    }
  });
  // D05 (DK-C5BT2A DÜŞÜK-1): bağı İKİ kez değiştiren düzeltme — bağın anı SON düzeltmenin anı. ELLE (karar (3); tur 2a O-1 kurgusu): F1 300 (−50) · P1 bağsız 300 (−45; F1'i
  // kapatır) · F2 300 (−40, vade +10) · F3 300 (−35, vade −35) · P2 300 (−5) · kilitten ÖNCE P2 → F2'ye bağlanır · kilit −30 · kilitten SONRA P2 → F1'e çevrilir → F1 kilitli dönemde
  // bağsız kapanmış, açılmaz; P2 bağsız gibi → F3 kapanır, F2 açık (vadesi gelmedi) → Gecikmiş Borç 0. İlk düzeltmenin anı okunsaydı (kilitten önce) bağ F1'i kapatır, P1 serbest →
  // F2'ye (doğduğu gün), F3 açık → 300. Çek ve cari tahsilatı aynı.
  it("D05: bağı kilitten önce ve sonra değiştiren düzeltme — son düzeltmenin anı (çek ve cari tahsilatı): Gecikmiş Borç 0", async () => {
    const xs = [{ via: "tahsilat", acc: await h.account("D05 Tahsilat") }, { via: "çek", acc: await h.account("D05 Çek") }];
    for (const x of xs) { x.f1 = await h.sale(x.acc, day(-50), 300, day(-50)); h.tick(); }
    for (const x of xs) { await h.entry(x.acc, { kind: "in", amount: "300", date: day(-45) }); h.tick(); }
    for (const x of xs) { x.f2 = await h.sale(x.acc, day(-40), 300, day(10)); h.tick(); }
    for (const x of xs) { x.f3 = await h.sale(x.acc, day(-35), 300, day(-35)); h.tick(); }
    for (const x of xs) {
      if (x.via === "çek") x.ch = await h.must("çek", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-5), dueDate: day(40), serialNo: "D05-1", accountId: x.acc.id }));
      else x.p = await h.entry(x.acc, { kind: "in", amount: "300", date: day(-5) });
      h.tick();
      const edit = body => (x.via === "çek" ? h.api.put(`/api/workspace/cheques/${x.ch.id}`, body) : h.api.put(`/api/workspace/accounts/${x.acc.id}/entries/${x.p.id}`, { ...body, cashForce: true }));
      x.edit = edit;
      await h.must("kilitten önce F2'ye", edit({ invoiceId: x.f2 }));
      h.tick();
    }
    await h.lock(day(-30));
    h.tick();
    try {
      for (const x of xs) {
        await h.must("kilitten sonra F1'e", x.edit({ invoiceId: x.f1 }));
        h.tick();
        assert.equal((await h.card(x.acc)).totals.overdueDebt, 0, `${x.via}: Gecikmiş Borç 0`);
        const f3 = await h.must("F3", h.api.get(`/api/workspace/invoices/${x.f3}`));
        assert.deepEqual([f3.payState, f3.closers.map(c => c.modeLabel)], ["paid", ["Bağsız (kilitli dönemde kapanmıştı)"]], `${x.via}: F3`);
      }
    } finally {
      await h.lock("");
      h.tick();
    }
  });
  // D06: 'Hangi Taksite' bağının düzeltme anı. ELLE (karar (2), (3), S50): Yeni Borç kartı 600 (Kayıt −60; taksit 300 vade −50, 300 vade −10) · Borç Yaz 300 (−46, vade −46) ·
  // bağsız cari tahsilatı 300 (−45; S2 → 1. taksit) · kart tahsilatı 300 (−5, bağsız → kartın 2. taksiti) · kilit −40 · kilitten SONRA kart tahsilatı '1. taksite' bağlanır →
  // 1. taksit kilitli dönemde bağsız kapanmış, açılmaz; kart tahsilatı 2. taksiti kapatır → taksitler [0, 0], açık Borç Yaz 300 → Gecikmiş Borç 300. Bağın anı okunmasaydı
  // (oluşturulma anı, kilitten önce) bağ 1. taksiti kapatır, cari tahsilatı Borç Yaz'ı → [0, 300].
  it("D06: kart tahsilatının 'Hangi Taksite' bağı kilitten SONRA düzeltmeyle kurulunca kilit sayılır: taksitler [0, 0], Borç Yaz açık", async () => {
    const acc = await h.account("D06 Hangi Taksite");
    const p = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-60), total: "600", accountId: acc.id }));
    const i1 = await h.must("1. taksit", h.api.post(`/api/workspace/plans/${p.id}/items`, { dueDate: day(-50), amount: "300" }));
    await h.must("2. taksit", h.api.post(`/api/workspace/plans/${p.id}/items`, { dueDate: day(-10), amount: "300" }));
    h.tick();
    await h.entry(acc, { kind: "debt", amount: "300", date: day(-46) });
    h.tick();
    await h.entry(acc, { kind: "in", amount: "300", date: day(-45) });
    h.tick();
    const w = await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${p.id}/entries`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true }));
    h.tick();
    const first = (i1.items || []).find(i => i.seq === 1) || (await h.plan(p.id)).items[0];
    assert.deepEqual((await h.plan(p.id)).items.map(i => i.remaining), [0, 300], "ön koşul (bağsız): kart 1. taksiti, cari tahsilatı Borç Yaz'ı kapatır");
    await h.lock(day(-40));
    h.tick();
    try {
      await h.must("Hangi Taksite = 1.", h.api.put(`/api/workspace/plans/${p.id}/entries/${w.entryId}`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true, itemId: first.id }));
      h.tick();
      const g = await h.plan(p.id);
      assert.deepEqual(g.items.map(i => i.remaining), [0, 0], "1. taksit kilitli dönemde cari tahsilatıyla kapanmış — açılmaz; kart tahsilatı 2. taksite");
      const card = await h.card(acc);
      assert.equal(card.totals.overdueDebt, 300, "açık Borç Yaz 300");
      assert.equal(card.entries.find(e => e.kind === "debt").remaining, 300, "Borç Yaz Kalan 300");
    } finally {
      await h.lock("");
      h.tick();
    }
  });
});

// ---------------- ORTA-2 ----------------
// ELLE (S91 = A, S93 = A, S96 = A; EK-1 §1 (iii) "Vade Takip gecikmiş tutarı = gecikmiş"): tedarikçiye stoktan Alış İadesi 300 (−20; bağsız ödeme rolü, 2.4.5 KS7 (a)) → Gecikmiş
// Borç 300 = Vade Takip (her süzgeç) 300 = zil 300 = nakit akışı "Tahsil Edilecek Borç" 300 ("Faturasız Cari Alacağı" değil, çift sayım yok); Alacak Yaz 100 (−25) ile kısmen
// netleşen 300 → 200; faturalı Alış İadesi (alış 300 −30 ödendi −28, iade −20) → 300. Kalem cari kartındaki hareketi açar (account|<hareket kimliği>, hareket bu carinin).
describe("2.5.0 Ç5-B tur 2b-1 — ORTA-2: tedarikçideki Alış İadesi Vade Takip / zil / nakit akışında (gecikmiş = ekranlar)", () => {
  let h;
  before(async () => {
    h = await harness();
  });
  after(async () => h?.server.close());
  it("stoktan / kısmen netleşen / faturalı Alış İadesi: gecikmiş = Vade Takip (her süzgeç) = zil = nakit akışı", async () => {
    const goods = await h.must("ürün", h.api.post("/api/workspace/stock", { name: "Tur2b1 İade Ürün", code: "URN-2B1-I", unit: "Adet", unitPrice: "10", salePrice: "100" }));
    await h.must("alım", h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: day(-200) }));
    const back = (acc, qty) => h.must("alış iadesi", h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: String(qty), unitPrice: "100", pay: "account", method: "cash", accountId: acc.id, date: day(-20) }));
    const a = await h.account("İade Stoktan", "supplier");
    await back(a, 3);
    const b = await h.account("İade Kısmen", "supplier");
    await h.entry(b, { kind: "credit", amount: "100", date: day(-25) });
    await back(b, 3);
    const c = await h.account("İade Faturalı", "supplier");
    const purchase = (await h.must("alış", h.api.post("/api/workspace/invoices", { scenario: "expense_purchase", kind: "purchase", accountId: c.id, number: "ALS-2B1-1", issueDate: day(-30), lines: [{ name: "Gider", qty: 1, unitPrice: "300", vatRate: 0, expenseCode: "other" }], payment: { rest: "open", dueDate: day(-30) }, cashForce: true }))).id;
    await h.entry(c, { kind: "out", amount: "300", date: day(-28), invoiceId: purchase });
    const detail = await h.must("alış oku", h.api.get(`/api/workspace/invoices/${purchase}`));
    await h.must("faturalı alış iadesi", h.api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: purchase, issueDate: day(-20), lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true }));
    h.tick();
    for (const [acc, late] of [[a, 300], [b, 200], [c, 300]]) {
      const card = await h.card(acc);
      assert.deepEqual([card.totals.balance, card.totals.overdueDebt], [late, late], `${acc.name}: bakiye = Gecikmiş Borç`);
      const rows = await h.vade(acc);
      assert.deepEqual(rows.map(r => [r.source, r.label, r.amount, r.direction]), [["account", "Tahsil Edilecek Borç", late, "in"]], `${acc.name}: Vade Takip kalemi`);
      const own = h.server.app.store.get("SELECT account_id AS acc FROM account_entries WHERE id = ?", rows[0].entryId || String(rows[0].id || "").replace(/^account\|/, ""));
      assert.equal(own?.acc, acc.id, `${acc.name}: kalem bu carinin hareketini açar`);
      for (const q of ["preset=late", "preset=open", "preset=today", "preset=next30", "direction=in", "sources=account", `q=${encodeURIComponent(acc.name)}`, `from=${day(-500)}&to=${day(500)}`]) {
        assert.equal(sum((await h.vade(acc, q)).filter(r => r.date < TODAY && r.direction === "in")), late, `${acc.name}: Vade Takip ${q}`);
      }
      assert.equal((await h.vade(acc, "preset=open&direction=out")).length, 0, `${acc.name}: Ödenecek süzgecinde yok`);
      const z = await h.dues(acc);
      assert.deepEqual(z.map(r => [r.source, r.label, r.amount, r.state]), [["account", "Tahsil Edilecek Borç", late, "overdue"]], `${acc.name}: zil`);
      const flow = await h.must("nakit akışı", h.api.get(`/api/workspace/overview/nakit-akisi?from=${day(-60)}&to=${day(60)}&overdue=1&table=0`));
      const mine = [...(flow.rows || []), ...(flow.overdue || [])].filter(r => r.party === acc.name || r.ref?.id === acc.id);
      assert.deepEqual(mine.map(r => [r.source, r.label, r.amount]), [["account", "Tahsil Edilecek Borç", late]], `${acc.name}: nakit akışı (Faturasız Cari Alacağı değil)`);
    }
  });
});

// ---------------- G-1 + D10 / D11 ----------------
// G-1 (hız; en küçük düzeltme): kart ekranı ve yazım yanıtları kuyruğu yalnız kartın carisi için kurar. EŞDEĞERLİK (dar kontrol o2-yanit kalıcı test): her yazım yolunda yanıt =
// hemen ardından okuma = Taksitler listesindeki satır (bütün carilerin kuyruğu, allObligations); cariler arası bağ taşıyan durumlar (taksite sayılıp ciro edilen çek, cari
// değişimi) ayrıca. D10 / D11 (ELLE, O-3, S91): kart 600 (taksit +30) · çekle taksite say 300 (−10) · kart iadesi 300 (−6) · çek karşılıksız (−4) → kartın net tahsilatı −300 →
// 'Taksit İadesi' 300 (vade −4): Vade Takip / zil kalemi, kuyruk kalanı 600 + 300 = 900, Gecikmiş Borç 300.
describe("2.5.0 Ç5-B tur 2b-1 — G-1: kart yanıtı / okuması tek cari kuyruğundan = bütün carilerin kuyruğu; D10 / D11 Taksit İadesi", () => {
  let h;
  before(async () => {
    h = await harness();
  });
  after(async () => h?.server.close());
  const same = async (label, res, id, client = h.api) => {
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    const pid = id || res.data.id;
    const got = (await client.get(`/api/workspace/plans/${pid}`)).data;
    assert.equal(view(res.data), view(got), `${label}: yanıt = okuma`);
    assert.equal(head(got), head(await h.listRow(pid)), `${label}: okuma (tek cari) = Taksitler satırı (bütün cariler)`);
    return got;
  };
  it("15 yazım yolu (yönetici + personel): yanıt = okuma = liste satırı", async () => {
    const staff = h.wrap(await createUser(h.server, h.client, { username: "t2b1-personel", role: "personel" }));
    const acc = await h.account("G1 Kart");
    await h.entry(acc, { kind: "debt", amount: "1000", date: day(-20) });
    await h.entry(acc, { kind: "in", amount: "150", date: day(-18) });
    h.tick();
    const created = await h.api.post("/api/workspace/plans", { name: acc.name, accountId: acc.id, registeredOn: day(-30), total: "850", coversBalance: true, mode: "auto", count: "4", firstDue: day(-15), everyMonths: "1" });
    const pid = (await same("kart aç (Mevcut Borç)", created)).id;
    const p0 = await h.plan(pid);
    await same("kart düzenle", await h.api.put(`/api/workspace/plans/${pid}`, { name: `${acc.name} D`, registeredOn: day(-30), total: "850", note: "not", updatedAt: p0.updatedAt }), pid);
    await same("taksit ekle", await h.api.post(`/api/workspace/plans/${pid}/items`, { dueDate: day(40), amount: "100" }), pid);
    const p1 = await h.plan(pid);
    await same("taksit düzelt", await h.api.put(`/api/workspace/plans/${pid}/items/${p1.items[1].id}`, { dueDate: p1.items[1].dueDate, amount: String(p1.items[1].amount), note: "x", updatedAt: p1.items[1].updatedAt }), pid);
    await same("taksit sil", await h.api.del(`/api/workspace/plans/${pid}/items/${p1.items.at(-1).id}`), pid);
    await same("Otomatik Dağıt", await h.api.post(`/api/workspace/plans/${pid}/distribute`, { count: "3", firstDue: day(-15), everyMonths: "1" }), pid);
    const p2 = await h.plan(pid);
    await same("kart tahsilatı (bağsız)", await h.api.post(`/api/workspace/plans/${pid}/entries`, { kind: "in", amount: "150", date: day(-5), method: "cash", cashForce: true }), pid);
    await same("kart tahsilatı (Hangi Taksite = 3.)", await h.api.post(`/api/workspace/plans/${pid}/entries`, { kind: "in", amount: "100", date: day(-4), method: "cash", cashForce: true, itemId: p2.items[2].id }), pid);
    const e1 = (await h.plan(pid)).entries[0];
    await same("tahsilat düzelt", await h.api.put(`/api/workspace/plans/${pid}/entries/${e1.id}`, { kind: e1.kind, amount: "200", date: e1.date, method: "cash", cashForce: true }), pid);
    await same("kart iadesi", await h.api.post(`/api/workspace/plans/${pid}/entries`, { kind: "out", amount: "50", date: day(-3), method: "cash", cashForce: true }), pid);
    await same("hareket sil", await h.api.del(`/api/workspace/plans/${pid}/entries/${(await h.plan(pid)).entries.at(-1).id}?cashForce=1`), pid);
    const body = { kind: "in", amount: "10", date: day(-2), method: "cash", cashForce: true, requestId: "5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d" };
    await h.api.post(`/api/workspace/plans/${pid}/entries`, body);
    await same("aynı istek kimliği (yineleme)", await h.api.post(`/api/workspace/plans/${pid}/entries`, body), pid);
    await same("Kartı Kapat", await h.api.put(`/api/workspace/plans/${pid}`, { status: "closed" }), pid);
    await same("Yeniden Aç", await h.api.put(`/api/workspace/plans/${pid}`, { status: "active" }), pid);
    await same("personel: kart tahsilatı", await staff.post(`/api/workspace/plans/${pid}/entries`, { kind: "in", amount: "20", date: day(-1), method: "cash", cashForce: true }), pid, staff);
    const cached = h.ctx().invoices.allObligations().get(acc.id);
    assert.equal(digest(cached), digest(h.fresh(acc)), "carinin önbellekli kuyruğu = baştan kurulan");
  });
  it("cariler arası: taksite sayılıp tedarikçiye ciro edilen çek ve carisi değiştirilen tahsilat — iki carinin kartı da okuma = liste satırı", async () => {
    const a = await h.account("G1 Ciro Müşteri");
    const b = await h.account("G1 Ciro Tedarikçi", "supplier");
    const c = await h.account("G1 Cari Değişimi");
    const pa = await h.must("kart A", h.api.post("/api/workspace/plans", { name: a.name, registeredOn: day(-20), total: "600", accountId: a.id, mode: "auto", count: "2", firstDue: day(-10), everyMonths: "1" }));
    const pc = await h.must("kart C", h.api.post("/api/workspace/plans", { name: c.name, registeredOn: day(-20), total: "600", accountId: c.id, mode: "auto", count: "2", firstDue: day(-10), everyMonths: "1" }));
    const ch = await h.must("çek (taksite say)", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-8), dueDate: day(30), serialNo: "G1-CIRO", accountId: a.id, planId: pa.id }));
    h.tick();
    await h.must("ciro", h.api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "endorse", date: day(-6), accountId: b.id }));
    h.tick();
    const moved = await h.entry(a, { kind: "in", amount: "200", date: day(-4) });
    h.tick();
    await h.must("cari değişimi A → C", h.api.put(`/api/workspace/accounts/${a.id}/entries/${moved.id}`, { accountId: c.id, cashForce: true }));
    h.tick();
    for (const [acc, p] of [[a, pa], [c, pc]]) {
      const got = await h.plan(p.id);
      assert.equal(head(got), head(await h.listRow(p.id)), `${acc.name}: okuma = liste satırı`);
      assert.equal(digest(h.ctx().invoices.allObligations().get(acc.id)), digest(h.fresh(acc)), `${acc.name}: önbellek = baştan`);
    }
    assert.deepEqual((await h.plan(pa.id)).items.map(i => i.remaining), [0, 300], "A: çek 1. taksiti kapattı (ciro kapatanı değiştirmez)");
    assert.deepEqual((await h.plan(pc.id)).items.map(i => i.remaining), [100, 300], "C: taşınan tahsilat 200 1. taksiti (S50)");
  });
  it("D10 / D11: karşılıksız çekle kartın net tahsilatı eksiye düşünce 'Taksit İadesi' 300 Vade Takip / zilde, kuyruk kalanı 900, Gecikmiş Borç 300", async () => {
    const acc = await h.account("D10 Taksit İadesi");
    const p = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-20), total: "600", accountId: acc.id, mode: "auto", count: "1", firstDue: day(30), everyMonths: "1" }));
    const ch = await h.must("çek (taksite say)", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-10), dueDate: day(20), serialNo: "D10-1", accountId: acc.id, planId: p.id }));
    h.tick();
    await h.must("kart iadesi", h.api.post(`/api/workspace/plans/${p.id}/entries`, { kind: "out", amount: "300", date: day(-6), method: "cash", cashForce: true }));
    h.tick();
    await h.must("karşılıksız", h.api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "bounce", date: day(-4) }));
    h.tick();
    const g = await h.plan(p.id);
    assert.deepEqual([g.totals.queueRemaining, g.items.map(i => i.remaining)], [900, [600]], "kuyruk kalanı = taksit 600 + Taksit İadesi 300");
    assert.deepEqual((await h.vade(acc)).map(r => [r.source, r.label, r.amount, r.date]).sort(), [["plan", "1. taksit", 600, day(30)], ["plan", "Taksit İadesi", 300, day(-4)]], "Vade Takip");
    assert.deepEqual((await h.dues(acc)).map(r => [r.label, r.amount, r.state]), [["Taksit İadesi", 300, "overdue"]], "zil");
    assert.equal((await h.card(acc)).totals.overdueDebt, 300, "Gecikmiş Borç = Taksit İadesi");
  });
});

// ---------------- D01–D03 (DURAĞAN saat) ----------------
// İz kolonları (dar kontrol DÜŞÜK-1): durağan saatte damgalar değişmez — önbellek yalnız kolon değerlerinden yenilenir. Her yazımdan sonra önbellekli kuyruk = baştan kurulan:
// D01 kart tahsilatının 'Hangi Taksite' bağı değişir; D02 taslak faturanın tutarı değişir; D03 çekin Kapatılacak Fatura bağı (UX18) değişir.
describe("2.5.0 Ç5-B tur 2b-1 — D01–D03: durağan saatte iz kolonları (önbellek = baştan)", () => {
  let h;
  before(async () => {
    h = await harness({ fixed: true });
  });
  after(async () => h?.server.close());
  const check = (label, acc) => assert.equal(digest(h.ctx().invoices.allObligations().get(acc.id)), digest(h.fresh(acc)), `${label}: önbellekli kuyruk = baştan kurulan`);
  it("D01 'Hangi Taksite', D02 taslak tutarı, D03 çek bağı: değişiklikten sonra önbellek bayat değil", async () => {
    const a = await h.account("D01 Kart");
    const p = await h.must("kart", h.api.post("/api/workspace/plans", { name: a.name, registeredOn: day(-30), total: "600", accountId: a.id, mode: "auto", count: "2", firstDue: day(-20), everyMonths: "1" }));
    const w = await h.must("kart tahsilatı (2. taksite)", h.api.post(`/api/workspace/plans/${p.id}/entries`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true, itemId: p.items[1].id }));
    check("D01 önce", a);
    await h.must("Hangi Taksite = 1.", h.api.put(`/api/workspace/plans/${p.id}/entries/${w.entryId}`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true, itemId: p.items[0].id }));
    check("D01 sonra", a);
    assert.deepEqual(h.fresh(a).overdue(TODAY).amount, 0, "D01: 1. taksit (vadesi geçmiş) kapandı");
    // İkinci düzeltme (geri 2. taksite): ilk düzeltme hareketin güncelleme damgasını doldurdu — durağan saatte artık YALNIZ bağ kolonu değişir.
    await h.must("Hangi Taksite = 2.", h.api.put(`/api/workspace/plans/${p.id}/entries/${w.entryId}`, { kind: "in", amount: "300", date: day(-5), method: "cash", cashForce: true, itemId: p.items[1].id }));
    check("D01 ikinci düzeltme", a);
    assert.deepEqual(h.fresh(a).overdue(TODAY).amount, 300, "D01: bağ 2. taksite döndü, 1. taksit 300 gecikmiş");
    const b = await h.account("D02 Taslak");
    const draft = await h.must("taslak", h.api.post("/api/workspace/invoices", { status: "draft", scenario: "service_sale", accountId: b.id, issueDate: day(-1), lines: [{ itemId: h.item.id, qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open", dueDate: day(-1) } }));
    check("D02 önce", b);
    await h.must("taslak tutarı", h.api.put(`/api/workspace/invoices/${draft.id}`, { scenario: "service_sale", accountId: b.id, issueDate: day(-1), lines: [{ itemId: h.item.id, qty: 1, unitPrice: "700", vatRate: 0 }], payment: { rest: "open", dueDate: day(-1) } }));
    check("D02 sonra", b);
    assert.equal(h.fresh(b).invoices.get(draft.id).payable, 700, "D02: taslağın tutarı 700");
    const c = await h.account("D03 Çek");
    const f1 = await h.sale(c, day(-3), 300, day(-3));
    const f2 = await h.sale(c, day(-2), 300, day(10));
    const ch = await h.must("çek (F2'ye)", h.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", issueDate: day(-1), dueDate: day(30), serialNo: "D03-1", accountId: c.id, invoiceId: f2 }));
    check("D03 önce", c);
    assert.equal(h.fresh(c).overdue(TODAY).amount, 300, "D03 ön koşul: F1 açık (bağ F2'de)");
    await h.must("çek bağı F1'e", h.api.put(`/api/workspace/cheques/${ch.id}`, { invoiceId: f1 }));
    check("D03 sonra", c);
    assert.equal(h.fresh(c).overdue(TODAY).amount, 0, "D03: bağ F1'e döndü, F1 kapandı");
  });
});
