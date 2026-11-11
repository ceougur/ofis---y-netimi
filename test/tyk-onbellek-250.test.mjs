// 2.5.0 Ç5-B tur 2a (Y-3, ders 47; dar kontrol DK-C5B) — Tek Yükümlülük Kuyruğu'nun artımlı önbelleği: izi değişmeyen yazımda (stok girişi, oturum açma, cari notu)
// bütün carilerin kuyruğu yeniden KURULMAZ; kuyruğu etkileyen HER yazım türünden sonra önbellekli sonuç = cari başına baştan kurulan sonuç (eksik iz = bayat sayı).
// Rastgele sıra (tohumlu; ders 17, 31): cari Borç / Alacak / Tahsilat / Ödeme (bağlı ya da bağsız; Vade / Beklenen Ödeme Tarihi), hareket düzeltme (tutar, tarih, yön, bağ,
// cari değişimi), silme + Silinenler'den geri alma, satış faturası, taksit kartı (Yeni Borç / Mevcut Borç), taksit ekle / düzelt / sil, kart tahsilatı (Hangi Taksite dahil) /
// düzeltme / silme, kartı kapat / aç, stoktan veresiye satış (+ taksitlendir), şüpheli alacak kaydı, dönem kilidi koy / kaldır; araya cariye dokunmayan yazımlar.
// İki saat düzeni: DURAĞAN (en kötü durum — güncelleme damgası değişmez, iz yalnız kolon değerlerinden görülür) ve AKAN. Ayrıca yedekten geri yükleme sonrası.
// Eski kodda (Ç5-B ilk hâli) kırmızı: izi değişmeyen yazımdan sonra bütün cariler baştan kuruluyordu (allLedgers sayacı 1).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const AUDIT = { id: "test", role: "admin", permissions: [] };

async function harness({ fixed }) {
  const server = await startTestServer({ now: { time: NOW, fixed }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = await loginAdmin(server);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.del(url)) };
  await api.post("/api/workspace/bank/setup/dismiss", {});
  await api.put("/api/admin/negative-policy", { cash: "off" });
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const ctx = () => server.app.context;
  // Bir carinin kuyruğunun karşılaştırılan özeti: gecikmiş, açık kalemler, fatura durumları (açık, durum, kapatanlar), taksit kalanları, elle kayıt Kalan'ı.
  const digest = result => JSON.stringify([
    result.overdue(TODAY).amount, result.overdue(TODAY).count,
    result.items.map(i => [i.key, i.remaining, i.vade, i.doubtful]),
    [...result.invoices].sort().map(([k, v]) => [k, v.open, v.state, v.covered, (v.closers || []).map(c => [c.id, c.amount, c.mode])]),
    [...result.installments].sort().map(([k, m]) => [k, [...m].sort().map(([i, r]) => [i, r.remaining, r.byAccount])]),
    [...result.entries].sort().map(([k, v]) => [k, v.remaining, v.covered]),
  ]);
  const compare = label => {
    const all = ctx().invoices.allObligations();
    const ids = ctx().store.all("SELECT id FROM accounts WHERE deleted_at IS NULL").map(row => row.id);
    for (const id of ids) {
      const ledger = ctx().accounts.detail(id, AUDIT, { withRemaining: false }).ledger;
      const fresh = ctx().invoices.obligationsFor(id, ledger);
      assert.ok(all.get(id), `${label}: cari ${id} önbellekte yok`);
      assert.equal(digest(all.get(id)), digest(fresh), `${label}: cari ${id} önbellekli sonuç ≠ baştan kurulan`);
    }
  };
  const countFull = () => {
    const accounts = ctx().accounts;
    const original = accounts.allLedgers;
    let full = 0;
    accounts.allLedgers = (...args) => {
      full += 1;
      return original(...args);
    };
    return { get: () => full, reset: () => { full = 0; }, done: () => { accounts.allLedgers = original; } };
  };
  return { server, api, must, compare, countFull, ctx };
}

describe("2.5.0 Ç5-B tur 2a — TYK önbelleği (Y-3): iz bütün girdileri kapsar, izi değişmeyen yazımda önbellek korunur", () => {
  it("cariye dokunmayan yazım (stok girişi, oturum açma, cari notu, Kasa ayarı) bütün carileri yeniden kurmaz; cari yazımı yalnız o cariyi", async () => {
    const h = await harness({ fixed: true });
    try {
      const acc = await h.must("cari", h.api.post("/api/workspace/accounts", { name: "Önbellek Bir", type: "customer", registeredOn: day(-400), phone: "0500 250 77 01" }));
      await h.must("borç", h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "500", date: day(-10), method: "cash" }));
      const goods = await h.must("ürün", h.api.post("/api/workspace/stock", { name: "Önbellek Ürün", unit: "Adet", unitPrice: "10", salePrice: "20" }));
      h.ctx().invoices.allObligations();
      const counter = h.countFull();
      try {
        const steps = [
          ["stok girişi (cari / para yok)", () => h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "1", unitPrice: "1", pay: "none", date: day(0) })],
          ["yeni oturum", () => loginAdmin(h.server)],
          ["cari notu", async () => h.api.put(`/api/workspace/accounts/${acc.id}`, { ...(await h.api.get(`/api/workspace/accounts/${acc.id}`)).data, note: "yalnız not" })],
          ["aynı değerle güncelleme (iz değişmez)", async () => h.ctx().store.run("UPDATE accounts SET updated_at = updated_at WHERE id = ?", acc.id)],
        ];
        for (const [label, run] of steps) {
          counter.reset();
          await run();
          h.ctx().invoices.allObligations();
          h.ctx().invoices.allObligations();
          assert.equal(counter.get(), 0, `${label}: bütün carilerin defteri kurulmaz`);
          h.compare(label);
        }
        counter.reset();
        await h.must("cari yazımı", h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "70", date: day(-1), method: "cash" }));
        h.ctx().invoices.allObligations();
        assert.equal(counter.get(), 0, "cari yazımı: yalnız o cari (artımlı)");
        h.compare("cari yazımı");
      } finally {
        counter.done();
      }
    } finally {
      await h.server.close();
    }
  });

  // Rastgele sıra: her yazımdan sonra önbellekli = baştan kurulan (bütün cariler). Reddedilen istekler (kilitli dönem, kapsam aşımı …) de sayılır — veri değişmediyse önbellek
  // zaten aynı olmalı.
  for (const [seed, fixed, steps] of [[1, true, 140], [2, true, 140], [3, false, 120]]) {
    it(`tohum ${seed} (${fixed ? "durağan" : "akan"} saat, ${steps} yazım): her yazım türünden sonra önbellekli sonuç = baştan kurulan`, async () => {
      const h = await harness({ fixed });
      let rnd = seed * 7919;
      const r = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
      const pick = list => list[Math.floor(r() * list.length)];
      const amount = () => String(50 + Math.floor(r() * 20) * 25);
      const tick = () => {
        if (!fixed) h.server.clock.advance({ seconds: 1 + Math.floor(r() * 90) });
      };
      const kinds = new Map();
      try {
        const accs = [];
        for (let i = 0; i < 5; i += 1) accs.push(await h.must("cari", h.api.post("/api/workspace/accounts", { name: `Rastgele ${seed}-${i}`, type: i === 4 ? "supplier" : "customer", registeredOn: day(-400), phone: `0500 250 ${70 + seed} ${10 + i}` })));
        const item = await h.must("hizmet", h.api.post("/api/workspace/stock", { kind: "service", code: `HZM-RS${seed}`, name: "Hizmet", unit: "Adet", salePrice: "100" }));
        const goods = await h.must("ürün", h.api.post("/api/workspace/stock", { name: `Ürün ${seed}`, code: `URN-RS${seed}`, unit: "Adet", unitPrice: "10", salePrice: "50" }));
        await h.must("alım", h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "10000", unitPrice: "10", pay: "none", date: day(-300) }));
        let invoiceDay = -200;
        let locked = "";
        const entriesOf = async acc => (await h.must("kart", h.api.get(`/api/workspace/accounts/${acc.id}`))).entries.filter(e => e.source === "");
        const invoicesOf = async acc => h.ctx().store.all("SELECT id FROM invoices WHERE account_id = ? AND status = 'issued' AND kind = 'sale'", acc.id).map(row => row.id);
        const plansOf = acc => h.ctx().store.all("SELECT id, status FROM plans WHERE account_id = ? AND deleted_at IS NULL", acc.id);
        const anyDate = () => day(-150 + Math.floor(r() * 150));
        const ops = {
          async borc(acc) { const due = r() < 0.4 ? day(-100 + Math.floor(r() * 140)) : ""; return h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: amount(), date: anyDate(), method: "cash", ...(due ? { dueDate: due > day(0) ? due : day(10) } : {}), ...(r() < 0.2 ? { expectedDate: day(5) } : {}) }); },
          async alacak(acc) { return h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "credit", amount: amount(), date: anyDate(), method: "cash" }); },
          async tahsilat(acc) { const inv = r() < 0.35 ? pick([...(await invoicesOf(acc)), ""]) : ""; return h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: amount(), date: anyDate(), method: "cash", cashForce: true, ...(inv ? { invoiceId: inv } : {}) }); },
          async odeme(acc) { return h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: amount(), date: anyDate(), method: "cash", cashForce: true }); },
          async fatura(acc) { invoiceDay += Math.floor(r() * 3); return h.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(invoiceDay), lines: [{ itemId: item.id, qty: 1, unitPrice: amount(), vatRate: 0 }], payment: { rest: "open", dueDate: day(invoiceDay + Math.floor(r() * 40)) }, cashForce: true }); },
          async duzelt(acc) {
            const list = await entriesOf(acc);
            if (!list.length) return null;
            const e = pick(list);
            const change = pick(["amount", "date", "kind", "link", "account"]);
            const body = change === "amount" ? { amount: amount() } : change === "date" ? { date: anyDate() } : change === "kind" && ["debt", "credit"].includes(e.kind) ? { kind: e.kind === "debt" ? "credit" : "debt" } : change === "link" && e.kind === "in" ? { invoiceId: pick([...(await invoicesOf(acc)), ""]) } : change === "account" && !e.invoiceId ? { accountId: pick(accs).id } : { note: `düzeltme ${r()}` };
            return h.api.put(`/api/workspace/accounts/${acc.id}/entries/${e.id}`, { ...body, cashForce: true });
          },
          async sil(acc) { const list = await entriesOf(acc); if (!list.length) return null; return h.api.del(`/api/workspace/accounts/${acc.id}/entries/${pick(list).id}?cashForce=1`); },
          async geriAl() { const trash = (await h.api.get("/api/admin/trash")).data || []; const row = (Array.isArray(trash) ? trash : trash.items || []).find(x => x.kind === "account-entry" || x.kind === "plan-entry"); return row ? h.api.post("/api/admin/trash/restore", { id: row.id }) : null; },
          async yeniBorcKarti(acc) { return h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: anyDate(), total: amount(), accountId: acc.id, ...(r() < 0.7 ? { mode: "auto", count: String(1 + Math.floor(r() * 3)), firstDue: day(-60 + Math.floor(r() * 90)), everyMonths: "1" } : {}) }); },
          async mevcutBorcKarti(acc) { const bal = (await h.api.get(`/api/workspace/accounts/${acc.id}`)).data?.totals?.balance || 0; if (!(bal > 30)) return null; return h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: r() < 0.5 ? day(-400) : day(-Math.floor(r() * 20)), total: String(Math.max(25, Math.floor(bal / 2))), accountId: acc.id, coversBalance: true, mode: "auto", count: "2", firstDue: day(-Math.floor(r() * 10)), everyMonths: "1" }); },
          async taksit(acc) { const plan = pick(plansOf(acc)); if (!plan) return null; const p = (await h.api.get(`/api/workspace/plans/${plan.id}`)).data; const what = r(); if (what < 0.4) return h.api.post(`/api/workspace/plans/${plan.id}/items`, { dueDate: day(-30 + Math.floor(r() * 60)), amount: amount() }); if (!p.items?.length) return null; const it = pick(p.items); return what < 0.75 ? h.api.put(`/api/workspace/plans/${plan.id}/items/${it.id}`, { dueDate: r() < 0.5 ? it.dueDate : day(-30 + Math.floor(r() * 60)), amount: r() < 0.5 ? String(it.amount) : amount(), note: "" }) : h.api.del(`/api/workspace/plans/${plan.id}/items/${it.id}`); },
          async kartDuzenle(acc) { const plan = pick(plansOf(acc)); if (!plan) return null; const p = (await h.api.get(`/api/workspace/plans/${plan.id}`)).data; return h.api.put(`/api/workspace/plans/${plan.id}`, { name: p.name, registeredOn: r() < 0.5 ? day(-400) : anyDate(), total: String(p.total) }); },
          async kartTahsilati(acc) { const plan = pick(plansOf(acc).filter(p => p.status === "active")); if (!plan) return null; const p = (await h.api.get(`/api/workspace/plans/${plan.id}`)).data; const target = r() < 0.4 && p.items?.length ? pick(p.items).id : ""; return h.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: r() < 0.85 ? "in" : "out", amount: amount(), date: anyDate(), method: "cash", cashForce: true, ...(target ? { itemId: target } : {}) }); },
          async kartHareketi(acc) { const plan = pick(plansOf(acc).filter(p => p.status === "active")); if (!plan) return null; const p = (await h.api.get(`/api/workspace/plans/${plan.id}`)).data; if (!p.entries?.length) return null; const e = pick(p.entries); return r() < 0.6 ? h.api.put(`/api/workspace/plans/${plan.id}/entries/${e.id}`, { kind: e.kind, amount: amount(), date: e.date, method: "cash", cashForce: true, ...(e.kind === "in" && r() < 0.5 && p.items?.length ? { itemId: pick(p.items).id } : {}) }) : h.api.del(`/api/workspace/plans/${plan.id}/entries/${e.id}?cashForce=1`); },
          async kartDurumu(acc) { const plan = pick(plansOf(acc)); if (!plan) return null; return h.api.put(`/api/workspace/plans/${plan.id}`, { status: plan.status === "active" ? "closed" : "active" }); },
          async stokSatis(acc) { const body = { kind: "out", qty: String(1 + Math.floor(r() * 5)), unitPrice: "50", pay: "account", method: "cash", accountId: acc.id, date: anyDate() }; if (r() < 0.5) body.installments = { count: 2, firstDue: body.date }; return h.api.post(`/api/workspace/stock/${goods.id}/moves`, body); },
          async supheli(acc) { const bal = (await h.api.get(`/api/workspace/accounts/${acc.id}`)).data?.totals?.balance || 0; if (!(bal > 50)) return null; return h.api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: String(Math.floor(bal / 3)), date: day(-Math.floor(r() * 30)), reason: "lawsuit", note: "dava" }); },
          async kilit() { locked = locked ? "" : day(-120 + Math.floor(r() * 60)); return h.api.put("/api/admin/period-lock", { lockedUntil: locked }); },
          // Ç5-B tur 2b-2 girdileri: verilen çek (S96 kalemi), alış faturası ve stoktan Alış İadesi (S95 / S103 / S105 — karşı yönlü kalemler ve geri alma), tek elle borca
          // eşit elle kart (S110 / S120 seçimi), avansla kapanmış borca stok kartı (S101 ön ödemesi).
          async verilenCek(acc) { return h.api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: amount(), issueDate: anyDate(), dueDate: day(30), accountId: acc.id, serialNo: `ONB-${Math.floor(r() * 1e9)}` }); },
          async alis(acc) { return h.api.post("/api/workspace/invoices", { scenario: "expense_purchase", kind: "purchase", accountId: acc.id, number: `ALS-ONB-${Math.floor(r() * 1e9)}`, issueDate: anyDate(), lines: [{ name: "Gider", qty: 1, unitPrice: amount(), vatRate: 0, expenseCode: "other" }], payment: { rest: "open", dueDate: day(-10) }, cashForce: true }); },
          async alisIadesi(acc) { return h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "40", pay: "account", method: "cash", accountId: acc.id, date: anyDate(), force: true }); },
          async elleKart(acc) { const debt = (await entriesOf(acc)).find(e => e.kind === "debt" && !e.source); if (!debt) return null; return h.api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-Math.floor(r() * 20)), total: String(debt.amount), accountId: acc.id, coversBalance: true, mode: "auto", count: "2", firstDue: day(-Math.floor(r() * 10)), everyMonths: "1" }); },
          async dokunmayan() { const what = r(); if (what < 0.4) return h.api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "1", unitPrice: "10", pay: "none", date: day(0) }); if (what < 0.7) { await loginAdmin(h.server); return null; } const acc = pick(accs); return h.api.put(`/api/workspace/accounts/${acc.id}`, { ...(await h.api.get(`/api/workspace/accounts/${acc.id}`)).data, note: `not ${r()}` }); },
        };
        const weights = [["borc", 10], ["alacak", 5], ["tahsilat", 10], ["odeme", 4], ["fatura", 8], ["duzelt", 10], ["sil", 4], ["geriAl", 3], ["yeniBorcKarti", 4], ["mevcutBorcKarti", 4], ["taksit", 6], ["kartDuzenle", 3], ["kartTahsilati", 7], ["kartHareketi", 5], ["kartDurumu", 2], ["stokSatis", 5], ["supheli", 2], ["kilit", 3], ["dokunmayan", 9], ["verilenCek", 3], ["alis", 3], ["alisIadesi", 2], ["elleKart", 3]];
        const total = weights.reduce((s, [, w]) => s + w, 0);
        h.compare("başlangıç");
        for (let i = 0; i < steps; i += 1) {
          let x = r() * total;
          const [name] = weights.find(([, w]) => (x -= w) < 0) || weights[0];
          const acc = pick(accs);
          const res = await ops[name](acc);
          kinds.set(`${name}:${res?.status ?? "-"}`, (kinds.get(`${name}:${res?.status ?? "-"}`) || 0) + 1);
          tick();
          h.compare(`adım ${i + 1} ${name} (${res?.status ?? "-"})`);
        }
        // Kanıt: denenen yazım türleri ve yanıt kodları (reddedilenler ayrı sayılır — ders 3).
        const accepted = [...kinds].filter(([k]) => k.endsWith(":200")).map(([k]) => k.split(":")[0]);
        for (const name of ["borc", "tahsilat", "fatura", "duzelt", "kartTahsilati", "stokSatis", "kilit", "dokunmayan", "verilenCek", "alis"]) assert.ok(accepted.includes(name) || kinds.has(`${name}:-`), `tohum ${seed}: ${name} en az bir kez kabul edildi (${JSON.stringify([...kinds])})`);
        console.log(`# tohum ${seed}: ${JSON.stringify(Object.fromEntries([...kinds].sort()))}`);
      } finally {
        await h.server.close();
      }
    });
  }

  it("yedekten geri yükleme ve Silinenler'den geri alma sonrası önbellek bayat kalmaz (önbellekli = baştan kurulan)", async () => {
    const h = await harness({ fixed: false });
    try {
      const acc = await h.must("cari", h.api.post("/api/workspace/accounts", { name: "Geri Yükleme", type: "customer", registeredOn: day(-400), phone: "0500 250 77 02" }));
      await h.must("borç", h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "900", date: day(-30), method: "cash" }));
      const backup = (await h.must("yedek", h.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      h.server.clock.advance({ minutes: 1 });
      const paid = await h.must("tahsilat", h.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "400", date: day(-5), method: "cash", cashForce: true }));
      h.server.clock.advance({ minutes: 1 });
      assert.equal(h.ctx().invoices.allObligations().get(acc.id).overdue(TODAY).amount, 500, "yedekten sonra tahsilat: gecikmiş 500");
      h.compare("tahsilattan sonra");
      const entryId = paid.entries.find(e => e.kind === "in").id;
      await h.must("sil", h.api.del(`/api/workspace/accounts/${acc.id}/entries/${entryId}?cashForce=1`));
      assert.equal(h.ctx().invoices.allObligations().get(acc.id).overdue(TODAY).amount, 900, "silinince gecikmiş 900");
      const trash = (await h.api.get("/api/admin/trash")).data;
      const row = (Array.isArray(trash) ? trash : trash.items || []).find(x => x.kind === "account-entry" && x.ref === entryId);
      await h.must("Silinenler'den geri al", h.api.post("/api/admin/trash/restore", { id: row.id }));
      assert.equal(h.ctx().invoices.allObligations().get(acc.id).overdue(TODAY).amount, 500, "geri alınınca gecikmiş yine 500");
      h.compare("Silinenler'den geri alma");
      // Kök şirketin (001) geri yüklemesi HAZIRLANIR, sunucu yeniden açılınca uygulanır (lib/company-backups.mjs restoreCompany → stageRootRestore): yeni süreçte önbellek
      // boştur. Öbür şirkette closeCompany + yeni örnek (appFor) — önbellek örnekle birlikte gider. Burada: hazırlanan geri yükleme veriyi ve önbelleği değiştirmez.
      const restored = await h.must("yedeği geri yükle", h.api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      assert.equal(restored.staged, true, "kök şirkette geri yükleme hazırlanır");
      const all = h.ctx().invoices.allObligations();
      assert.equal(all.get(acc.id).overdue(TODAY).amount, 500, "hazırlanan geri yükleme (yeniden açılışta uygulanır): veri ve gecikmiş aynı");
      h.compare("yedekten geri yükleme (hazırlandı)");
    } finally {
      await h.server.close();
    }
  });
});
