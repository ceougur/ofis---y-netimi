// 2.5.0 Ç5-B KAPANIŞ DÜZELTME TURU (kapanış dar kontrolünün bulguları; iş listesi D 12.11 "… Ç5-B KAPANIŞ DAR KONTROLÜ — RAPOR …"). Beklenenler kullanıcı kararlarının metninden ve
// örneklerinden ELLE (S110 = A, S120 = A, S133 = C, S95 = A, 2.4.5 KS7 (a), S1, S50) — programın çıktısından DEĞİL (ders 5, 40).
// ADIMLI SAAT (ders 14, 20): gerçek kurulumda her kayıt anı FARKLIDIR; durağan test saati bunu gizliyordu (ORTA-1 testlerde yeşildi). Buradaki gerçek program testleri saati her
// okumada 7 ms ilerleyen sahte saatle koşar — "satışın kayıt anı ≠ kartın kayıt anı" ön koşulu ZORLA kurulur ve her testte veri tabanından okunarak doğrulanır.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { accountLedger } from "../server/lib/accounts.mjs";
import { buildObligations } from "../server/lib/obligation-queue.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
// Aylık taksitin sonraki vadesi (program ay ekler; gün sayısı değil).
const nextMonth = date => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};
const r2 = value => Math.round(value * 100) / 100;
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
/** Her okumada `step` ms ilerleyen saat: art arda iki kayıt aynı anı ALAMAZ (gerçek kurulumun koşulu, yarışsız). */
const steppingClock = (start = NOW, step = 7) => {
  let at = Date.parse(start);
  return () => (at += step);
};

async function openProgram({ dataDir = "", backupDir = "", clock = steppingClock() } = {}) {
  const server = await startTestServer({ ...(dataDir ? { dataDir, backupDir } : {}), now: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = await loginAdmin(server);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
    put: async (url, body) => unwrap(await client.put(url, body)),
    del: async url => unwrap(await client.del(url)),
  };
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  let n = 0;
  const h = { server, client, api, must, store: server.app.store, ctx: server.app.context };
  h.account = (label, type = "customer") => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Kapanış ${label}`, type, registeredOn: day(-400), phone: `0500 259 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
  h.goods = async () => (h.goodsRow ||= await must("mal", api.post("/api/workspace/stock", { kind: "goods", code: `MAL-KAP-${(n += 1)}`, name: `Kapanış Malı ${n}`, unit: "Adet", openingQty: "100000", salePrice: "100" })));
  h.entry = (acc, body) => must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
  h.stockMove = async body => api.post(`/api/workspace/stock/${(await h.goods()).id}/moves`, { qty: "1", ...body });
  h.stockSale = async (acc, date, amount, installments = null) => must("stok satışı", h.stockMove({ kind: "out", unitPrice: String(amount), pay: "account", accountId: acc.id, date, ...(installments ? { installments } : {}) }));
  h.stockReturn = async (acc, date, amount) => must("stok iadesi", h.stockMove({ kind: "in", unitPrice: String(amount), pay: "account", accountId: acc.id, date, reason: "return" }));
  h.card = acc => must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
  h.plan = id => must("taksit kartı", api.get(`/api/workspace/plans/${id}`));
  h.cardOpen = (acc, total, count, { registeredOn = day(-40), firstDue = day(-10), coversBalance = true } = {}) =>
    must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn, total: String(total), accountId: acc.id, mode: count ? "auto" : "none", ...(count ? { count: String(count), firstDue, everyMonths: "1" } : {}), coversBalance }));
  h.setTotal = (planId, total) => {
    const cur = h.store.get("SELECT name, registered_on AS registeredOn FROM plans WHERE id = ?", planId);
    return api.put(`/api/workspace/plans/${planId}`, { name: cur.name, registeredOn: cur.registeredOn, total: String(total) });
  };
  // Bir carinin ekranlardaki sayıları: bakiye, Gecikmiş Borç (cari kartı = Cari Listesi), Vade Takip'in "Tahsil Edilecek" kalemleri, kartların taksit kalanları, kuralın adı (tanı).
  h.view = async acc => {
    const card = await h.card(acc);
    const list = await must("liste", api.get("/api/workspace/accounts?status=all&limit=5000"));
    const vade = await must("Vade Takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-800)}&to=${day(800)}`));
    const plans = [];
    for (const p of card.plans || []) plans.push((await h.plan(p.id)).items.map(item => item.remaining));
    const AUD = { id: "kapanis-test", role: "admin", permissions: [] };
    const ledger = h.ctx.accounts.detail(acc.id, AUD, { withRemaining: false }).ledger;
    const queue = h.ctx.invoices.obligationsFor(acc.id, ledger);
    const sigma = r2(queue.items.reduce((sum, item) => sum + (item.side === "receivable" ? 1 : -1) * item.remaining, 0));
    return {
      bakiye: card.totals.balance,
      gecikmis: card.totals.overdueDebt,
      listeGecikmis: list.accounts.find(row => row.id === acc.id)?.overdue,
      vade: vade.rows.filter(row => (row.accountId === acc.id || row.party === acc.name) && row.direction === "in").map(row => `${row.source}:${row.amount}@${row.date}`).sort(),
      taksit: plans,
      kural: [...queue.coverage.values()].map(row => row.rule),
      sigma,
    };
  };
  // Ön koşul (ders 20): satışın cari satırı ile kartın kayıt anı FARKLI (gerçek kurulum). Eşitse test geçersizdir — yeşil sayılmaz.
  h.assertDistinctMoments = acc => {
    const sales = h.store.all("SELECT created_at AS at FROM account_entries WHERE account_id = ? AND source = 'stock' AND kind = 'debt'", acc.id).map(row => row.at);
    const cards = h.store.all("SELECT created_at AS at FROM plans WHERE account_id = ?", acc.id).map(row => row.at);
    assert.ok(sales.length && cards.length, "ön koşul: satış ve kart yazıldı");
    for (const at of cards) assert.ok(!sales.includes(at), `ön koşul: kartın kayıt anı (${at}) satışın kayıt anından farklı (adımlı saat)`);
  };
  return h;
}

// Ortak kurgu (dar kontrol ORTA-1): elle Borç 500 (−50, vade +30) · stoktan veresiye satış 1.000 (−45) + 2 taksit (−20, +10).
const TWO = { count: 2, firstDue: day(-20), everyMonths: 1 };
async function saleCard(h, label, { borcVade = day(30) } = {}) {
  const acc = await h.account(label);
  await h.entry(acc, { kind: "debt", amount: "500", date: day(-50), ...(borcVade ? { dueDate: borcVade } : {}), note: "B500" });
  await h.stockSale(acc, day(-45), 1000, TWO);
  const plan = (await h.card(acc)).plans[0];
  h.assertDistinctMoments(acc);
  return { acc, plan };
}

describe("Ç5-B kapanış — ORTA-1 (S110 = A): satışla açılan kart kendi satışını HER KOŞULDA tanır (adımlı saat — gerçek kurulum)", () => {
  let h;
  before(async () => {
    h = await openProgram();
  });
  after(async () => h?.server.close());

  it("değişmeden: kart satışın 1.000'ini taşır, elle Borç 500 kendi vadesiyle (+30) AYRI kalem; gecikmiş yalnız 1. taksit 500", async () => {
    const { acc } = await saleCard(h, "Değişmedi");
    const v = await h.view(acc);
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.taksit, v.sigma], [1500, 500, 500, [[500, 500]], 1500]);
    assert.deepEqual(v.vade, [`account:500@${day(30)}`, `plan:500@${day(-20)}`, `plan:500@${day(10)}`].sort());
    assert.deepEqual(v.kural, ["S110-satis"]);
  });

  it("Tutarı Düzenle (azalt 1.000 → 800): kart yine KENDİ satışını taşır — Borç 500 takvimde vadesiyle durur; gecikmiş 700 (1. taksit 500 + satışın kart dışı 200'ü), 1.200 DEĞİL", async () => {
    const { acc, plan } = await saleCard(h, "Tutar Azalt");
    const edit = await h.setTotal(plan.id, 800);
    assert.equal(edit.status, 200, `Tutarı Düzenle: ${edit.status} ${JSON.stringify(edit.data).slice(0, 200)}`);
    const v = await h.view(acc);
    // S110 = A "stoktan satışta o satışı": kart 800'ünü taşır; satışın 200'ü kendi günüyle (S1: vadesiz kalemin vadesi belge günü, −45) açık; elle Borç 500 vadesi +30.
    assert.deepEqual(v.vade, [`account:200@${day(-45)}`, `account:500@${day(30)}`, `plan:300@${day(10)}`, `plan:500@${day(-20)}`].sort(), "Vade Takip: elle Borç 500 kendi vadesinde AYRI");
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.taksit, v.sigma], [1500, 700, 700, [[500, 300]], 1500]);
    assert.deepEqual(v.kural, ["S110-satis"], "kart elle kola (S120) düşmedi");
  });

  it("Tutarı Düzenle (artır 1.000 → 1.200): Mevcut Borç kartı büyütülemez (409 cover-grow) — hiçbir sayı değişmez", async () => {
    const { acc, plan } = await saleCard(h, "Tutar Artır");
    const once = await h.view(acc);
    const edit = await h.setTotal(plan.id, 1200);
    assert.deepEqual([edit.status, edit.data?.code], [409, "cover-grow"]);
    assert.deepEqual(await h.view(acc), once);
    assert.deepEqual([once.gecikmis, once.kural], [500, ["S110-satis"]]);
  });

  it("faturasız stok iadesi 300 (kart küçülmez): kart kendi satışını taşır, Borç 500 ayrı; iade bağsız ödemedir — vadesi en önce gelen 1. taksiti 200'e indirir (S50); gecikmiş 200", async () => {
    const { acc } = await saleCard(h, "İade 300");
    await h.stockReturn(acc, day(-40), 300);
    const v = await h.view(acc);
    assert.deepEqual(v.vade, [`account:500@${day(30)}`, `plan:200@${day(-20)}`, `plan:500@${day(10)}`].sort());
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.taksit, v.sigma, v.kural], [1200, 200, 200, [[200, 500]], 1200, ["S110-satis"]]);
  });

  it("faturasız stok iadesi 800 (bakiye 700 < kart → kart 700'e küçülür): kart yine kendi satışını taşır, Borç 500 vadesiyle AYRI; iade vade sırasıyla satışın kart dışı 300'ünü + 1. taksiti kapatır", async () => {
    // TOPLU SORU (kapanış düzeltme turu raporu): v2.4.9 ve 8d6ea9c9 (akan saat) bu kurguda taksit [500, 200] + Borç kartın içinde gösteriyordu (gecikmiş 500); kart kendi
    // satışını tanıyınca tek kuyruğun sonucu aşağıdaki. Bakiye iki okumada 700.
    const { acc, plan } = await saleCard(h, "İade 800");
    const back = await h.stockReturn(acc, day(-40), 800);
    assert.deepEqual((back.trimmedPlans || []).map(row => [row.id, row.from, row.to]), [[plan.id, 1000, 700]], "ön koşul: iade kartı 700'e küçülttü");
    const v = await h.view(acc);
    assert.deepEqual(v.vade, [`account:500@${day(30)}`, `plan:200@${day(10)}`].sort(), "Borç 500 kendi vadesinde AYRI kalem");
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.taksit, v.sigma, v.kural], [700, 0, 0, [[0, 200]], 700, ["S110-satis"]]);
  });

  it("satış + VADESİZ elle borç (v2.4.9 fikstürü N): kart satışı taşır; vadesiz Borç 500 kayıt gününde vadeli (S1) — gecikmiş 1.000", async () => {
    const { acc } = await saleCard(h, "Vadesiz Borç", { borcVade: "" });
    const v = await h.view(acc);
    assert.deepEqual([v.bakiye, v.gecikmis, v.taksit, v.kural], [1500, 1000, [[500, 500]], ["S110-satis"]]);
  });

  it("iki satış kartı: ikinci satışın kartı ikinci satışı, tutarı düzenlenen birinci kart birinci satışı taşır; Borç 500 ayrı", async () => {
    const { acc, plan } = await saleCard(h, "İki Satış");
    await h.stockSale(acc, day(-30), 600, { count: 2, firstDue: day(-10), everyMonths: 1 });
    h.assertDistinctMoments(acc);
    assert.equal((await h.setTotal(plan.id, 800)).status, 200);
    const v = await h.view(acc);
    // Birinci kart 800 [500 @−20, 300 @+10] + satış 1'in kart dışı 200'ü (−45); ikinci kart 600 [300 @−10, 300 @+20]; Borç 500 @+30. Gecikmiş 200 + 500 + 300.
    assert.deepEqual(v.vade, [`account:200@${day(-45)}`, `account:500@${day(30)}`, `plan:500@${day(-20)}`, `plan:300@${day(10)}`, `plan:300@${day(-10)}`, `plan:300@${nextMonth(day(-10))}`].sort());
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.sigma], [2100, 1000, 1000, 2100]);
    assert.deepEqual(v.taksit.map(list => list.join("+")).sort(), ["300+300", "500+300"]);
    assert.deepEqual(v.kural.sort(), ["S110-satis", "S110-satis"]);
  });

  it("kaynak KALICI: kartın açılış izinde satışın kimliği yazılı; program yeniden açılınca (bellek boş) sayılar aynı", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "tyk-kapanis-"));
    const clock = steppingClock();
    let first = await openProgram({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), clock });
    try {
      const { acc, plan } = await saleCard(first, "Yeniden Açılış");
      assert.equal((await first.setTotal(plan.id, 800)).status, 200);
      const once = await first.view(acc);
      const trail = JSON.parse(first.store.get("SELECT payload_json AS j FROM audit_events WHERE type = 'plan.created' AND entity_id = ?", plan.id).j);
      const sale = first.store.get("SELECT source_id AS move FROM account_entries WHERE account_id = ? AND source = 'stock'", acc.id);
      assert.equal(trail.saleMoveId, sale.move, "kartın açılış izinde satışın stok hareketi");
      await first.server.close();
      first = null;
      const second = await openProgram({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), clock });
      try {
        assert.deepEqual(await second.view(acc), once);
        assert.deepEqual([once.gecikmis, once.kural], [700, ["S110-satis"]]);
      } finally {
        await second.server.close();
      }
    } finally {
      await first?.server.close();
      removeTestDir(root);
    }
  });
});

describe("Ç5-B kapanış — S133 = C (BİLİNEN SINIR): ELLE açılan kartta tanıma AYNEN — sonuç kayıt sırasına bağlı (sayılar sabit)", () => {
  let h;
  before(async () => {
    h = await openProgram();
  });
  after(async () => h?.server.close());
  // Dar kontrolün karar2.mjs C1 / C1b kurguları: X 500 (−20, vade +30) · taksitsiz stok veresiye satışı 500 (−10) · Taksitler'den ELLE kart 500 (2 taksit, ileri vade).
  it("C1 — stok satışı en son kaydedilen borç ve tutarı karta eşit: kart satışı taşır ⇒ gecikmiş 0 (X vadesi +30)", async () => {
    const acc = await h.account("S133 C1");
    await h.entry(acc, { kind: "debt", amount: "500", date: day(-20), dueDate: day(30), note: "X" });
    await h.stockSale(acc, day(-10), 500);
    await h.cardOpen(acc, 500, 2, { registeredOn: day(-5), firstDue: day(20) });
    const v = await h.view(acc);
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.kural, v.taksit], [1000, 0, 0, ["S110-satis"], [[250, 250]]]);
    assert.deepEqual(v.vade, [`account:500@${day(30)}`, `plan:250@${day(20)}`, `plan:250@${nextMonth(day(20))}`].sort());
  });
  it("C1b — kayıt sırası ters (önce stok satışı, sonra X): kart tutarı eşit TEK elle borcu (X) taşır ⇒ satış 500 kendi gününde açık, gecikmiş 500", async () => {
    const acc = await h.account("S133 C1b");
    await h.stockSale(acc, day(-10), 500);
    await h.entry(acc, { kind: "debt", amount: "500", date: day(-20), dueDate: day(30), note: "X" });
    await h.cardOpen(acc, 500, 2, { registeredOn: day(-5), firstDue: day(20) });
    const v = await h.view(acc);
    assert.deepEqual([v.bakiye, v.gecikmis, v.listeGecikmis, v.kural, v.taksit], [1000, 500, 500, ["S110-elle"], [[250, 250]]]);
    assert.deepEqual(v.vade, [`account:500@${day(-10)}`, `plan:250@${day(20)}`, `plan:250@${nextMonth(day(20))}`].sort());
  });
  it("elle kartın açılış izinde satış kimliği YOK (çıkarım yapılmaz) — toplu kartlarda alan boş yazılır", async () => {
    const acc = await h.account("S133 İz");
    await h.stockSale(acc, day(-10), 500);
    const plan = await h.cardOpen(acc, 500, 2, { registeredOn: day(-5), firstDue: day(20) });
    const trail = JSON.parse(h.store.get("SELECT payload_json AS j FROM audit_events WHERE type = 'plan.created' AND entity_id = ?", plan.id).j);
    assert.equal(trail.saleMoveId ?? "", "", "elle kart: satış kimliği yok");
    assert.equal(h.ctx.plans.forAccount(acc.id, { id: "kapanis-test", role: "admin", permissions: [] })[0].saleMoveId, "", "tek cari yolu: kaynak yok");
  });
});

describe("Ç5-B kapanış — ORTA-1 eski veri: kartın kaynağı açılış izinden ÇIKARILIR (2.4.9'a kadar izde satış kimliği yok) — koşulların her biri", () => {
  // Asıl eski veri kanıtı v2.4.9'un GERÇEK koduyla üretilmiş fikstürdür (test/tyk-fark-v249-250: V1–V3). Burada çıkarımın KOŞULLARI tek tek sınanır: eski biçim, bugünkü
  // kodun yazdığı izden `saleMoveId` alanı silinerek kurulur (EK denetim — elle düzenlenmiş iz kanıt sayılmaz, ders 17); bellek boş olsun diye program yeniden açılır.
  let root;
  let h;
  const AUD = { id: "kapanis-test", role: "admin", permissions: [] };
  const ids = {};
  const oldFormat = planId => h.store.run("UPDATE audit_events SET payload_json = json_remove(payload_json, '$.saleMoveId') WHERE type = 'plan.created' AND entity_id = ?", planId);
  const moveOf = acc => h.store.get("SELECT source_id AS move FROM account_entries WHERE account_id = ? AND source = 'stock' AND kind = 'debt'", acc.id)?.move;
  const bulk = acc => h.must("toplu taksitlendirme", h.api.post("/api/workspace/accounts/bulk-plan", { ids: [acc.id], amountMode: "balance", count: 2, firstDue: day(20), everyMonths: 1 }));
  const planOf = acc => h.store.get("SELECT id FROM plans WHERE account_id = ? AND deleted_at IS NULL", acc.id).id;
  const sourceOf = acc => h.ctx.plans.forAccount(acc.id, AUD)[0].saleMoveId;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "tyk-kapanis-eski-"));
    const clock = steppingClock();
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), clock };
    h = await openProgram(dirs);
    // A: satışla açılan kart (eski biçim) + Tutarı Düzenle.
    const A = (ids.A = (await saleCard(h, "Eski A Satış")).acc);
    assert.equal((await h.setTotal(planOf(A), 800)).status, 200);
    oldFormat(planOf(A));
    // B: BAŞKA cariye aynı tutarda veresiye satışın hemen ardından toplu kart (cari farklı).
    const B = (ids.B = await h.account("Eski B Başka Cari"));
    const X = await h.account("Eski B Satış Carisi");
    await h.entry(B, { kind: "debt", amount: "600", date: day(-30), note: "B600" });
    await h.stockSale(X, day(-10), 600);
    await bulk(B);
    oldFormat(planOf(B));
    // C: aynı cariye satış 500, toplu kart bakiye 800 (tutar farklı).
    const C = (ids.C = await h.account("Eski C Tutar Farklı"));
    await h.entry(C, { kind: "debt", amount: "300", date: day(-30), note: "C300" });
    await h.stockSale(C, day(-10), 500);
    await bulk(C);
    oldFormat(planOf(C));
    // D: aynı cariye satış 500, hemen ardından toplu kart 500 (eski biçim) — iz çıkarımı o satışı gösterir.
    const D = (ids.D = await h.account("Eski D Toplu Eşit"));
    await h.stockSale(D, day(-10), 500);
    await bulk(D);
    oldFormat(planOf(D));
    // E: D ile aynı kurgu, BUGÜNKÜ biçim (alan boş yazılı) — çıkarım yapılmaz.
    const E = (ids.E = await h.account("Yeni E Toplu Eşit"));
    await h.stockSale(E, day(-10), 500);
    await bulk(E);
    // F: D ile aynı, satışı BAŞKA kullanıcı yazmış.
    const F = (ids.F = await h.account("Eski F Başka Kullanıcı"));
    await h.stockSale(F, day(-10), 500);
    await bulk(F);
    oldFormat(planOf(F));
    h.store.run("UPDATE audit_events SET actor_id = 'user-baska' WHERE type = 'stock.out' AND entity_id = ?", moveOf(F));
    // G: PEŞİN satışın (cariye yazılmaz) hemen ardından toplu kart.
    const G = (ids.G = await h.account("Eski G Peşin"));
    await h.entry(G, { kind: "debt", amount: "500", date: day(-30), note: "G500" });
    await h.must("peşin satış", h.stockMove({ kind: "out", unitPrice: "500", pay: "cash", method: "cash", date: day(-10) }));
    await bulk(G);
    oldFormat(planOf(G));
    ids.moves = { A: moveOf(A), D: moveOf(D), E: moveOf(E), F: moveOf(F) };
    await h.server.close();
    h = await openProgram(dirs);
  });
  after(async () => {
    await h?.server.close();
    if (root) removeTestDir(root);
  });
  it("A — eski biçim satış kartı: hemen önceki iz aynı kullanıcının, aynı cariye, veresiye, kartın AÇILIŞ tutarında stok satışı ⇒ kaynak o satış (tutar sonradan 800 olsa da)", async () => {
    assert.ok(ids.moves.A, "ön koşul: satışın stok hareketi");
    assert.equal(sourceOf(ids.A), ids.moves.A);
    const v = await h.view(ids.A);
    assert.deepEqual([v.gecikmis, v.kural], [700, ["S110-satis"]]);
  });
  it("B — hemen önceki satış BAŞKA cariye ⇒ kaynak yok", () => assert.equal(sourceOf(ids.B), ""));
  it("C — hemen önceki satışın tutarı kartın açılış tutarından FARKLI ⇒ kaynak yok", () => assert.equal(sourceOf(ids.C), ""));
  it("D — eski biçim toplu kart, hemen önceki iz aynı cariye aynı tutarda veresiye satış ⇒ kaynak o satış (kart o satışı taksitlendirmiştir)", () => assert.equal(sourceOf(ids.D), ids.moves.D));
  it("E — BUGÜNKÜ biçim (izde alan boş yazılı): çıkarım yapılmaz ⇒ kaynak yok", () => {
    assert.ok(ids.moves.E, "ön koşul: aynı cariye aynı tutarda satış var");
    assert.equal(sourceOf(ids.E), "");
  });
  it("F — hemen önceki satışı BAŞKA kullanıcı yazmış ⇒ kaynak yok", () => assert.equal(sourceOf(ids.F), ""));
  it("G — hemen önceki satış PEŞİN (cariye yazılmamış) ⇒ kaynak yok", () => assert.equal(sourceOf(ids.G), ""));
  it("toplu yol (bütün carilerin kartları) tek cari yoluyla AYNI kaynağı verir", () => {
    const all = h.ctx.plans.ledgerPlansByAccount();
    for (const key of ["A", "B", "C", "D", "E", "F", "G"]) assert.equal(all.get(ids[key].id)[0].saleMoveId, sourceOf(ids[key]), key);
  });
});

// ---------------- Saf kuyruk: tanımanın dalları (mutant dişleri — dar kontrolün yaşayan K5, K6, K24, K25'i) ----------------
let seq = 0;
const at = date => `${date}T09:00:${String((seq += 1) % 60).padStart(2, "0")}.${String(seq).padStart(3, "0")}Z`;
const line = (id, origin, kind, date, debit, credit, extra = {}) => ({ id, origin, kind, date, at: at(date), debit, credit, ...extra });
const borc = (id, date, amount) => line(id, "account", "debt", date, amount, 0);
const alacak = (id, date, amount) => line(id, "account", "credit", date, 0, amount);
const stokSatis = (id, date, amount, extra = {}) => line(id, "stock", "debt", date, amount, 0, { stockReason: "", sourceId: `m-${id}`, ...extra });
const stokIade = (id, date, amount) => line(id, "stock", "credit", date, 0, amount, { stockReason: "return", sourceId: `m-${id}` });
const kart = (planId, date, total, extra = {}) => line(`plan:${planId}`, "plan", "plan", date, 0, 0, { planId, covers: true, coverTotal: total, coverGross: total, ...extra });
const two = (planId, a, b = a) => new Map([[planId, [{ id: `${planId}1`, seq: 1, dueDate: "2026-04-10", amount: a }, { id: `${planId}2`, seq: 2, dueDate: "2026-05-10", amount: b }]]]);
const left = (r, lineId) => r.items.find(item => item.lineId === lineId)?.remaining ?? 0;
const sigma = r => r2(r.items.reduce((sum, item) => sum + (item.side === "receivable" ? item.remaining : -item.remaining), 0));

describe("Ç5-B kapanış — ORTA-1 saf kuyruk: kaynağı bilinen kart (coverSale) ↔ kaynağı bilinmeyen kart (eski tanıma AYNEN)", () => {
  it("kaynağı bilinen kart: tutar EŞİT DEĞİL, kayıt anı FARKLI, araya daha yeni bir borç yazılmış — kart yine o satışı taşır", () => {
    const lines = [borc("B", "2026-03-01", 500), stokSatis("S", "2026-03-10", 1000), borc("Y", "2026-03-11", 40)];
    lines.push(kart("C", "2026-03-12", 800, { coverSale: "m-S" }));
    const r = buildObligations({ lines, schedules: two("C", 500, 300), today: "2026-04-20" });
    assert.equal(r.coverage.get("C").rule, "S110-satis");
    assert.deepEqual([left(r, "B"), left(r, "S"), left(r, "Y")], [500, 200, 40], "kart satışın 800'ünü taşır; öbür borçlar ayrı");
    assert.equal(sigma(r), 1540);
  });
  it("kaynak satış defterde yoksa (silinmiş) kart kaynağı bilinmeyen kart gibi davranır — eski tanıma", () => {
    const lines = [borc("B", "2026-03-01", 500), borc("X", "2026-03-05", 800)];
    lines.push(kart("C", "2026-03-10", 800, { coverSale: "m-YOK" }));
    const r = buildObligations({ lines, schedules: two("C", 500, 300), today: "2026-04-20" });
    assert.equal(r.coverage.get("C").rule, "S110-elle", "tutarı karta eşit TEK elle borç");
    assert.deepEqual([left(r, "B"), left(r, "X")], [500, 0]);
  });
  it("kaynağı bilinen kartın kimliği stok İADESİ satırını göstermez (yalnız borç yönlü satış satırı)", () => {
    // Kartın kimliğini taşıyan hareket sonradan satış olmaktan çıkmış (satır alış iadesi nedeniyle borç yönlü): kartın satışı sayılmaz → eski tanıma (tutarı eşit TEK elle borç).
    const lines = [borc("B", "2026-03-01", 300), borc("X", "2026-03-05", 800), line("S", "stock", "debt", "2026-03-06", 100, 0, { stockReason: "preturn", sourceId: "m-S" })];
    lines.push(kart("C", "2026-03-10", 800, { coverSale: "m-S" }));
    const r = buildObligations({ lines, schedules: two("C", 500, 300), today: "2026-04-20" });
    assert.equal(r.coverage.get("C").rule, "S110-elle");
    assert.deepEqual([left(r, "B"), left(r, "X"), left(r, "S")], [300, 0, 100]);
    assert.equal(sigma(r), 1200);
  });
  it("K5 dişi — kaynağı bilinmeyen (elle) kart: en son kaydedilen stok satışının tutarı karta EŞİT DEĞİLSE kartın satışı sayılmaz (tutarı eşit tek elle borç taşınır)", () => {
    const lines = [borc("X", "2026-03-01", 500), stokSatis("S", "2026-03-10", 700), kart("M", "2026-03-12", 500)];
    const r = buildObligations({ lines, schedules: two("M", 250), today: "2026-04-20" });
    assert.equal(r.coverage.get("M").rule, "S110-elle");
    assert.deepEqual([left(r, "X"), left(r, "S")], [0, 700]);
  });
  it("K6 dişi — kaynağı bilinmeyen kart: en son kaydedilen borç stoktan ALIŞ İADESİ ise (tutarı karta eşit olsa da) kartın satışı sayılmaz", () => {
    const lines = [borc("X", "2026-03-01", 500), line("P", "stock", "debt", "2026-03-10", 500, 0, { stockReason: "preturn", sourceId: "m-P" }), kart("M", "2026-03-12", 500)];
    const r = buildObligations({ lines, schedules: two("M", 250), today: "2026-04-20" });
    assert.equal(r.coverage.get("M").rule, "S110-elle");
    assert.deepEqual([left(r, "X"), left(r, "P")], [0, 500], "kart elle borcu taşır; alış iadesi alacağı ayrı");
  });
  it("K24 dişi — kaynağı bilinmeyen eski kart faturalı iadeyle küçülmüş: tanıma kartın AÇILIŞ tutarıyla (bugünkü tutar + iade kesintisi) — lib/accounts.mjs coverGross", () => {
    // Kart 1.000 açıldı, iade kesintisi 300 → bugün 700. Satış 1.000 en son kaydedilen borç. coverGross = 700 + 300 = 1.000 ⇒ kartın satışı.
    const entries = [
      { id: "B", kind: "debt", amount: 500, date: "2026-03-01", createdAt: "2026-03-01T09:00:00.000Z" },
      { id: "S", kind: "debt", amount: 1000, date: "2026-03-10", source: "stock", sourceId: "m-S", stockReason: "", createdAt: "2026-03-10T09:00:00.000Z" },
    ];
    const plan = { id: "C", name: "K24", total: 700, status: "active", coversBalance: true, registeredOn: "2025-06-01", createdAt: "2026-03-10T09:00:00.005Z", planned: 700, returnCuts: 300, itemCount: 2, totals: { paid: 0 }, entries: [] };
    const ledger = accountLedger(entries, [plan]);
    const r = buildObligations({ lines: ledger.lines, schedules: two("C", 500, 200), today: "2026-04-20" });
    assert.equal(r.coverage.get("C").rule, "S110-satis");
    assert.equal(left(r, "B"), 500, "elle Borç 500 kartın dışında");
  });
  it("K25 dişi — S95 = A × faturasız stok iadesi (bağsız ödemedir — 2.4.5 KS7 a): Borç 200 + Alacak 150 netleştikten SONRAKİ gün stok iadesi 300 ⇒ iade Borç'u kapatır, Alacak 150 yeniden açık, artan 100 avans", () => {
    const lines = [borc("B", "2026-03-01", 200), alacak("A", "2026-03-02", 150), stokIade("R", "2026-03-05", 300)];
    const r = buildObligations({ lines, today: "2026-04-20" });
    assert.equal(left(r, "B"), 0);
    assert.equal(r.entries.get("A").remaining, 150, "Alacak 150 yeniden açık (netleşme geri alındı)");
    assert.equal(left(r, "R"), 100, "iadenin artanı avans");
    assert.equal(sigma(r), -250);
  });
});

describe("Ç5-B kapanış — ORTA-2 gerçek program: geriye tarihli Alacak + kart tahsilatı — kalemler toplamı = bakiye, Gecikmiş Borç bakiyeyi aşmaz (saf kuyruk: test/tyk-kapanis-sigma-250)", () => {
  let h;
  before(async () => {
    h = await openProgram();
  });
  after(async () => h?.server.close());
  it("dar kontrolün kayıt sırası: stok satışı 810 → Mevcut Borç kartı 810 (Kayıt Tarihi eski) → Alacak 250 (−230) → kart tahsilatı 490 (−217) → fatura 960 → Borç 360 → tahsilat 450 ⇒ bakiye 940 = Σ kalem = Gecikmiş Borç", async () => {
    const acc = await h.account("Sigma");
    await h.stockSale(acc, day(-43), 810);
    const plan = await h.must("Mevcut Borç kartı", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-500), total: "810", accountId: acc.id, coversBalance: true }));
    await h.must("taksit 1", h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: day(-43), amount: "405" }));
    await h.must("taksit 2", h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: day(-67), amount: "405" }));
    await h.entry(acc, { kind: "credit", amount: "250", date: day(-230) });
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "490", date: day(-217), method: "cash", cashForce: true, similarOk: true }));
    const item = await h.must("hizmet", h.api.post("/api/workspace/stock", { kind: "service", code: "HZM-KAP-SIGMA", name: "Kapanış Hizmeti", unit: "Adet", salePrice: "1000" }));
    await h.must("fatura", h.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-5), lines: [{ itemId: item.id, qty: 1, unitPrice: "960", vatRate: 0 }], payment: { rest: "open", dueDate: day(-5) }, cashForce: true }));
    await h.entry(acc, { kind: "debt", amount: "360", date: day(-73) });
    await h.entry(acc, { kind: "in", amount: "450", date: day(-69) });
    const v = await h.view(acc);
    assert.deepEqual([v.bakiye, v.sigma, v.gecikmis, v.listeGecikmis], [940, 940, 940, 940], "bakiye = kalemler toplamı = Gecikmiş Borç (cari kartı = liste)");
    assert.deepEqual(v.vade, [`invoice:940@${day(-5)}`], "Vade Takip: tek kalem — fatura 940");
    assert.deepEqual(v.taksit, [[0, 0]], "kart Bitti (avansla kapandı)");
    const check = await h.must("Mutabakat Testi", h.api.get("/api/workspace/ledger/integrity"));
    assert.equal(check.ok, true, "Mutabakat Testi tamam");
  });
});

// ---------------- S129 = A: kartın 'Tahsil Edilen' / 'Kalan'ı ve satırın 'Ödenen'i TEK KUYRUKTAN — ekran, PDF, Rapor Merkezi, cari kartı, Cari Listesi AYNI sayı ----------------
// KULLANICI KARARI 12.11 13:26 (iş listesi D, AYNEN): "taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit
// satırının 'Ödenen'i de TEK KUYRUKTAN gösterilir (ekranda tek sayı: örnekte kart 900, bağsız tahsilat 500 → Tahsil Edilen 500 · Kalan 400; kart 600, bağsız tahsilat 800 →
// Kalan 0 · Tamamlandı); tahsilat formunun sınırı / sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır."
describe("Ç5-B kapanış — S129 = A: kartın gösterilen Tahsil Edilen / Kalan / Ödenen'i tek kuyruktan; sınır kartın kendi kalanından (S118 = B)", () => {
  let h;
  let pdfText;
  let xlsxRows;
  const tlText = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
  // Rapor hücresi "500,00 TL" → 500 (boş hücre 0).
  const num = cell => Number(String(cell ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
  const raw = async url => {
    const res = await h.client.raw("GET", url);
    assert.equal(res.status, 200, `${url}: ${res.status}`);
    return res.buffer;
  };
  const report = (id, extra = "") => h.must(`rapor ${id}`, h.api.get(`/api/workspace/report-center/${id}?${extra}`));
  const newCard = (acc, total, count) => h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-40), total: String(total), accountId: acc.id, mode: "auto", count: String(count), firstDue: day(-10), everyMonths: "1" }));
  before(async () => {
    ({ pdfText, xlsxRows } = await import("./fixtures/rapor-dosya-oku.mjs"));
    h = await openProgram();
  });
  after(async () => h?.server.close());

  it("karar örneği 1 — kart 900 (3 × 300), karta BAĞLANMADAN 500 tahsilat: Tahsil Edilen 500 · Kalan 400; satırlar Ödenen 300 / 200 / 0; kartın kendi hesabı 0 / 900 ayrı alanlarda", async () => {
    const acc = await h.account("S129 Örnek 1");
    const plan = await newCard(acc, 900, 3);
    await h.entry(acc, { kind: "in", amount: "500", date: day(-5) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.total, p.totals.paid, p.totals.remaining], [900, 500, 400], "kart penceresi göstergeleri");
    assert.deepEqual(p.items.map(item => [item.amount, item.paid, item.remaining]), [[300, 300, 0], [300, 200, 100], [300, 0, 300]], "taksit satırları: Tutar / Ödenen / Kalan");
    assert.equal(r2(p.items.reduce((sum, item) => sum + item.paid, 0)), p.totals.paid, "satırların Ödenen toplamı = gösterge");
    assert.deepEqual([p.totals.ownPaid, p.totals.ownRemaining, p.items.map(item => [item.ownPaid, item.ownRemaining])], [0, 900, [[0, 300], [0, 300], [0, 300]]], "kartın kendi hesabı (kart tahsilatı yok)");
    // Taksitler listesi: aynı sütunlar + toplam göstergeleri.
    const list = await h.must("Taksitler", h.api.get("/api/workspace/plans?status=all&limit=500"));
    const row = list.plans.find(item => item.id === plan.id);
    assert.deepEqual([row.totals.paid, row.totals.remaining, row.totals.ownPaid, row.totals.ownRemaining], [500, 400, 0, 900]);
    // Cari kartının taksit özeti ve "Taksitten Kalan"; Cari Listesi satırı.
    const card = await h.card(acc);
    assert.deepEqual([card.plans[0].totals.paid, card.plans[0].totals.remaining, card.plans[0].totals.ownRemaining, card.totals.planRemaining, card.totals.balance], [500, 400, 900, 400, 400]);
    const accounts = await h.must("Cari Listesi", h.api.get("/api/workspace/accounts?status=all&limit=5000"));
    assert.equal(accounts.accounts.find(item => item.id === acc.id).planRemaining, 400, "Cari Listesi: Taksitten Kalan");
    // PDF / Excel / Rapor Merkezi aynı sayılar.
    const ekstre = pdfText(await raw(`/api/workspace/plans/${plan.id}/ekstre.pdf`));
    assert.ok(ekstre.includes(`Toplam tutar\n${tlText(900)}\nTahsil edilen\n${tlText(500)}\nKalan\n${tlText(400)}`), `taksit ekstresi göstergeleri: ${ekstre.slice(0, 300)}`);
    assert.ok(ekstre.includes(`${tlText(300)}\n${tlText(200)}\n${tlText(100)}`), "taksit ekstresi 2. taksit: Tutar 300 / Ödenen 200 / Kalan 100");
    assert.ok(ekstre.includes(`Toplam\n${tlText(900)}\n${tlText(500)}\n${tlText(400)}`), "taksit ekstresi tablo toplamı");
    const liste = pdfText(await raw("/api/workspace/plans/liste.pdf?status=all"));
    assert.ok(liste.includes(`${acc.name}\n`) && liste.includes(`${tlText(900)}\n${tlText(500)}\n${tlText(400)}`), "Taksit Listesi PDF satırı: Toplam 900 / Ödenen 500 / Kalan 400");
    const xlsx = xlsxRows(await raw("/api/workspace/accounts/export.xlsx?status=all"));
    const head = xlsx[0];
    const line = xlsx.find(cells => cells[head.indexOf("Ad / Unvan")] === acc.name);
    assert.equal(line[head.indexOf("Taksitten Kalan")], 400, "Cari Listesi Excel: Taksitten Kalan");
    const cariPdf = pdfText(await raw(`/api/workspace/accounts/${acc.id}/ekstre.pdf`));
    assert.match(cariPdf, /Taksitlerden Kalan[^T]{0,30}\n400,00 TL/, `cari ekstresi özeti: Taksitlerden Kalan 400 — ${cariPdf.slice(0, 500)}`);
    const kartlar = await report("taksit-kartlari", "planStatus=all");
    const kHead = kartlar.headers;
    const kRow = kartlar.rows.find(cells => cells[kHead.indexOf("Ad")] === acc.name);
    assert.deepEqual([num(kRow[kHead.indexOf("Toplam")]), num(kRow[kHead.indexOf("Ödenen")]), num(kRow[kHead.indexOf("Kalan")])], [900, 500, 400], "Rapor Merkezi Taksit Kartları");
    // Sınır kartın KENDİ kalanından (S118 = B): 901 'Kalanı Aşan Tutar'; kayıt yazılmaz.
    const over = await h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "901", method: "cash", date: day(-1), cashForce: true, similarOk: true });
    assert.deepEqual([over.status, over.data?.code], [409, "plan-overpay"]);
    assert.equal(h.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", plan.id).n, 0, "reddedilen tahsilat yazılmadı");
    const check = await h.must("Mutabakat Testi", h.api.get("/api/workspace/ledger/integrity"));
    assert.equal(check.ok, true, "Mutabakat Testi (kartın kendi hesabı = satırlar) tamam");
  });

  it("karar örneği 2 — kart 600 (2 × 300), bağlanmadan 800 tahsilat: Kalan 0 · Tamamlandı, Tahsil Edilen 600; cari 200 alacaklı", async () => {
    const acc = await h.account("S129 Örnek 2");
    const plan = await newCard(acc, 600, 2);
    await h.entry(acc, { kind: "in", amount: "800", date: day(-5) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.state, p.items.map(item => [item.paid, item.remaining])], [600, 0, "done", [[300, 0], [300, 0]]]);
    const list = await h.must("Taksitler (Biten)", h.api.get("/api/workspace/plans?status=done&limit=500"));
    assert.deepEqual(list.plans.filter(item => item.id === plan.id).map(item => [item.totals.paid, item.totals.remaining, item.state]), [[600, 0, "done"]]);
    const card = await h.card(acc);
    assert.deepEqual([card.totals.balance, card.totals.planRemaining, card.plans[0].totals.remaining], [-200, 0, 0]);
  });

  it("karta kendi tahsilatı + bağsız tahsilat birlikte: kart 900, karta 300 (1. taksit) + bağsız 200 ⇒ Tahsil Edilen 500 · Kalan 400; kartın kendi hesabı 300 / 600", async () => {
    const acc = await h.account("S129 Karma");
    const plan = await newCard(acc, 900, 3);
    // Önce bağsız tahsilat, SONRA kart tahsilatı: kartın yazımında mutabakat kapısı (plans:totals — kartın kendi hesabı = satırlar) gösterilen ≠ kendi hesabı durumunu görür.
    await h.entry(acc, { kind: "in", amount: "200", date: day(-5) });
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "cash", date: day(-8), cashForce: true, similarOk: true }));
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.ownPaid, p.totals.ownRemaining], [500, 400, 300, 600]);
    assert.deepEqual(p.items.map(item => [item.paid, item.remaining, item.ownPaid, item.ownRemaining]), [[300, 0, 300, 0], [200, 100, 0, 300], [0, 300, 0, 300]]);
    // Makbuz (kart tahsilatının): Tahsil edilen / Kalan borç kart penceresiyle aynı.
    const entryId = p.entries.find(entry => entry.kind === "in").id;
    const makbuz = pdfText(await raw(`/api/workspace/plans/${plan.id}/entries/${entryId}/makbuz.pdf`));
    assert.ok(makbuz.includes(`Toplam borç\n${tlText(900)}\nTahsil edilen\n${tlText(500)}\nKalan borç\n${tlText(400)}`), `makbuz: ${makbuz.slice(0, 400)}`);
    // Rapor Merkezi taksit vadeleri: satırın Ödenen / Kalan'ı kart penceresiyle aynı (2. taksit 200 / 100).
    const vade = await report("taksit-vadeleri", `from=${day(-60)}&to=${day(120)}`);
    const vHead = vade.headers;
    const rows = vade.rows.filter(cells => cells[vHead.indexOf("Ad")] === acc.name).map(cells => [cells[vHead.indexOf("Taksit")], num(cells[vHead.indexOf("Ödenen")]), num(cells[vHead.indexOf("Kalan")]), cells[vHead.indexOf("Durum")]]);
    assert.deepEqual(rows, [["1. taksit", 300, 0, "Ödendi"], ["2. taksit", 200, 100, "Kısmen ödendi"], ["3. taksit", 0, 300, "Açık"]]);
    // Aylık performans = ekran: açık kartların taksitleri (kart penceresinin satırları) ay ay toplanınca raporun Ödenen / Kalan'ını verir.
    const perf = await report("taksit-performans", `from=${day(-60)}&to=${day(120)}`);
    const pHead = perf.headers;
    const months = new Map();
    for (const row of (await h.must("Taksitler", h.api.get("/api/workspace/plans?status=all&limit=500"))).plans) {
      if (row.status !== "active") continue; // rapor: kapatılmamış kartlar (Biten dahil)
      for (const item of (await h.plan(row.id)).items) {
        if (item.dueDate < day(-60) || item.dueDate > day(120)) continue;
        const month = months.get(item.dueDate.slice(0, 7)) || { paid: 0, remaining: 0 };
        months.set(item.dueDate.slice(0, 7), { paid: r2(month.paid + item.paid), remaining: r2(month.remaining + item.remaining) });
      }
    }
    assert.ok(months.size >= 2 && [...months.values()].some(month => month.paid > 0), "ön koşul: birden çok ay, ödeneni olan ay var");
    assert.deepEqual(r2(perf.rows.reduce((sum, cells) => sum + num(cells[pHead.indexOf("Ödenen")]), 0)), r2([...months.values()].reduce((sum, month) => sum + month.paid, 0)), "performans raporu Ödenen toplamı = kart satırlarının Ödenen toplamı");
    assert.deepEqual(r2(perf.rows.reduce((sum, cells) => sum + num(cells[pHead.indexOf("Kalan")]), 0)), r2([...months.values()].reduce((sum, month) => sum + month.remaining, 0)), "performans raporu Kalan toplamı = kart satırlarının Kalan toplamı");
    for (const cells of perf.rows) assert.equal(r2(num(cells[pHead.indexOf("Ödenen")]) + num(cells[pHead.indexOf("Kalan")])), num(cells[pHead.indexOf("Vadesi Gelen")]), `performans ${cells[0]}: Ödenen + Kalan = Vadesi Gelen`);
  });

  it("kapatılmış kart: gösterim BUGÜNKÜ gibi (kural yazılmadı) — Tahsil Edilen 300, Kalan 600 kartın kendi hesabından", async () => {
    const acc = await h.account("S129 Kapalı");
    const plan = await newCard(acc, 900, 3);
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "cash", date: day(-8), cashForce: true, similarOk: true }));
    const cur = h.store.get("SELECT name, registered_on AS registeredOn FROM plans WHERE id = ?", plan.id);
    assert.equal((await h.api.put(`/api/workspace/plans/${plan.id}`, { name: cur.name, registeredOn: cur.registeredOn, status: "closed" })).status, 200);
    const p = await h.plan(plan.id);
    assert.deepEqual([p.state, p.totals.paid, p.totals.remaining, p.totals.ownPaid, p.totals.ownRemaining, p.items.map(item => item.paid)], ["closed", 300, 600, 300, 600, [300, 0, 0]]);
  });

  it("Mevcut Borç kartının taksitlere BÖLÜNMEMİŞ kısmı bugünkü gösteriminde (karar yok): Borç 1.000, kart 1.000 (taksit 300 + 300), bağsız tahsilat 200 ⇒ Kalan 1.000, Tahsil Edilen 0", async () => {
    // Bölünmemiş 400 kuyrukta kartın kalemi değil (alttaki borç); tahsilat vade sırasıyla o borcu kapatır (taksitlerin vadesi sonra). Gösterge: taksitler 600 + bölünmemiş 400.
    const acc = await h.account("S129 Bölünmemiş");
    await h.entry(acc, { kind: "debt", amount: "1000", date: day(-30) });
    const plan = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-20), total: "1000", accountId: acc.id, coversBalance: true }));
    await h.must("taksit 1", h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: day(-10), amount: "300" }));
    await h.must("taksit 2", h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: day(20), amount: "300" }));
    await h.entry(acc, { kind: "in", amount: "200", date: day(-15) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.total, p.totals.paid, p.totals.remaining, p.items.map(item => [item.paid, item.remaining]), p.totals.ownRemaining], [1000, 0, 1000, [[0, 300], [0, 300]], 1000]);
    assert.equal((await h.card(acc)).totals.balance, 800);
    // Karta 700 tahsilat (taksitler 600 + bölünmemiş kısma 100): Tahsil Edilen 700 · Kalan 300 — bölünmemiş kısma yazılan pay kartın kendi hesabından (bugünkü gibi).
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "700", method: "cash", date: day(-3), cashForce: true, similarOk: true }));
    const q = await h.plan(plan.id);
    assert.deepEqual([q.totals.paid, q.totals.remaining, q.totals.ownPaid, q.totals.ownRemaining, q.items.map(item => [item.paid, item.remaining])], [700, 300, 700, 300, [[300, 0], [300, 0]]]);
  });

  it("elle Alacak'la NETLEŞME tahsilat değildir (karar yok — gösterim bugünkü gibi; kâhin d19 N4): Açılış 900 → Mevcut Borç kartı 900 (3 × 300) → Alacak 200 ⇒ Tahsil Edilen 0 · Kalan 900, satırların Ödenen'i 0", async () => {
    const acc = await h.account("S129 Netleşme");
    await h.entry(acc, { kind: "debt", amount: "900", date: day(-45), dueDate: day(-40) });
    const plan = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-38), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-15), everyMonths: "1", coversBalance: true }));
    await h.entry(acc, { kind: "credit", amount: "200", date: day(-36), dueDate: day(15) });
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.items.map(item => item.paid)], [0, 900, [0, 0, 0]]);
    const card = await h.card(acc);
    assert.deepEqual([card.totals.balance, card.plans[0].totals.paid, card.plans[0].totals.remaining, card.totals.planRemaining], [700, 0, 900, 900]);
  });

  it("kartın KENDİ fazla tahsilatı (K8 'Fazlasını Avans Yaz') bugünkü gibi: kart 1.000 ödendi + 100 avans ⇒ Tahsil Edilen 1.100 · Kalan 0 · fazla 100", async () => {
    const acc = await h.account("S129 K8 Avans");
    const plan = await h.must("kart", h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-30), total: "1000", accountId: acc.id, mode: "auto", count: "1", firstDue: day(10), everyMonths: "1" }));
    await h.must("1.000", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: day(-20), cashForce: true, similarOk: true }));
    await h.must("avans 100", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "cash", date: day(-19), overpay: true, cashForce: true, similarOk: true }));
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.extra, p.totals.ownPaid, p.state, p.items.map(item => [item.paid, item.remaining])], [1100, 0, 100, 1100, "done", [[1000, 0]]]);
    assert.equal((await h.card(acc)).totals.balance, -100);
  });

  it("carisiz kart (kuyruk yok): gösterilen sayı kartın kendi hesabı — alanlar aynı", async () => {
    const plan = await h.must("carisiz kart", h.api.post("/api/workspace/plans", { name: "Kapanış Carisiz", registeredOn: day(-40), total: "600", mode: "auto", count: "2", firstDue: day(-10), everyMonths: "1" }));
    await h.must("kart tahsilatı", h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "250", method: "cash", date: day(-8), cashForce: true, similarOk: true }));
    const p = await h.plan(plan.id);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.ownPaid, p.totals.ownRemaining, p.items.map(item => [item.paid, item.ownPaid])], [250, 350, 250, 350, [[250, 250], [0, 0]]]);
  });
});
