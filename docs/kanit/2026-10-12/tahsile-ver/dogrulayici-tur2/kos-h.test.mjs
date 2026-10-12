// Bağımsız doğrulayıcı tur 2 — Senaryo H (MUHASEBE SAYILARI). Beklenen: model.py (plan metninden, programın kodu kullanılmadan) → beklenen-h.json.
// Gerçek: programın API'si (sahte saat 27.10.2026 Salı). Kod değiştirmez. Fark = bulgu (assert diffs = []).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(path.join(HERE, "senaryo-h.json"), "utf8"));
const exp = JSON.parse(readFileSync(path.join(HERE, "beklenen-h.json"), "utf8"));
const CH = "/api/workspace/cheques";
const tl = m => m / 100;
const k = v => Math.round(Number(v) * 100);
const parseTl = s => (s === "" || s === undefined || s === null ? 0 : Math.round(Number(String(s).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) * 100));
const fmt = n => (n / 100).toFixed(2).replace(".", ",");
const actual = { olaylar: [], kesitler: {}, araliklar: [], gunler: {}, son: {} };
let ctx, api, acc, cari = {}, cek = {}, plan = {};

const trial = async (q = "") => Object.fromEntries((await must("mizan", api.get(`/api/workspace/ledger${q}`))).trial.accounts.map(r => [r.code, k(r.balance)]));
const subTrial = async (q = "") => must("alt hesap", api.get(`/api/workspace/bank/sub-trial${q}`));
const report = (id, q = "") => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}${q}`));

async function run(o) {
  if (o.t === "fatura") {
    const body = { kind: "sale", accountId: cari[o.cari].id, issueDate: o.tarih, pricesIncludeVat: false, lines: [{ name: "Danışmanlık Hizmeti", qty: 1, unitPrice: o.net, discountRate: 0, vatRate: o.kdv }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: fmt(k(o.cek.tutar)), dueDate: o.cek.vade, serialNo: o.id, bank: "Akbank" }], endorse: [], rest: "open" }, force: true };
    const inv = await api.post("/api/workspace/invoices", body);
    if (inv.status !== 200) return inv;
    cek[o.id] = (await must("liste", api.get(`${CH}?q=${o.id}`))).cheques.find(c => c.serialNo === o.id);
    cek[o.id].invoice = inv.data;
    return inv;
  }
  if (o.t === "taksit-karti") {
    const res = await api.post("/api/workspace/plans", { name: `${o.id} Taksit`, accountId: cari[o.cari].id, total: fmt(k(o.tutar)), mode: "auto", count: 1, firstDue: o.vade, registeredOn: o.tarih });
    if (res.status === 200) plan[o.id] = res.data;
    return res;
  }
  if (o.t === "al") {
    const body = { direction: "in", instrument: o.tur, amount: fmt(k(o.tutar)), issueDate: o.tarih, dueDate: o.vade, serialNo: o.id, ...(o.cari ? { accountId: cari[o.cari].id } : { drawer: o.kesideci }), ...(o.plan ? { planId: plan[o.plan].id } : {}) };
    const res = await api.post(CH, body);
    if (res.status === 200) cek[o.id] = res.data;
    return res;
  }
  const c = cek[o.id];
  if (o.t === "son-islemi-geri-al") return api.post(`${CH}/${c.id}/undo`, {});
  const body = o.t === "ver" ? { action: "bank-deposit", date: o.tarih, bankAccountId: acc[o.hesap].id }
    : o.t === "geri" ? { action: "bank-withdraw", date: o.tarih }
    : o.t === "tahsil" ? { action: "collect", date: o.tarih, ...(o.yol === "cash" ? { method: "cash" } : {}) }
    : o.t === "karsiliksiz" ? { action: "bounce", date: o.tarih } : null;
  return api.post(`${CH}/${c.id}/actions`, body);
}

describe(`Senaryo: ${spec.ad}`, () => {
  before(async () => {
    ctx = await bootBank({ now: `${spec.bugun}T12:00:00+03:00` });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    for (const name of spec.cariler) cari[name] = await must("cari", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => {
    writeFileSync(path.join(HERE, "gercek-h.json"), JSON.stringify(actual, null, 1));
    ctx?.server.close();
  });

  it("olaylar API'den (her biri 200)", async () => {
    const bad = [];
    for (const o of spec.olaylar) {
      const res = await run(o);
      actual.olaylar.push({ o, status: res.status, code: res.code, error: res.error });
      if (res.status !== 200) bad.push(`${o.t} ${o.id} ${o.tarih || ""}: ${res.status} ${res.code || ""} ${res.error || ""}`);
    }
    assert.deepEqual(bad, []);
  });

  it("son durum: Ana Defter (Hesap Planı Mizanı) 100/101/102/770 = model", async () => {
    const t = await trial();
    actual.son.trial = t;
    const diffs = [];
    for (const a of ["100", "101", "102", "770", "120"]) if ((t[a] || 0) !== (exp.son.hesap[a] || 0)) diffs.push(`${a}: gerçek ${tl(t[a] || 0)} / beklenen ${tl(exp.son.hesap[a] || 0)}`);
    assert.deepEqual(diffs, []);
  });

  it("son durum: Alt Hesap Mizanı 101.01/101.02/102.01/102.02 = model; ana hesap 101 = Ana Defter 101", async () => {
    const d = await subTrial();
    const rows = Object.fromEntries(d.rows.map(r => [r.sub, k(r.balance)]));
    actual.son.sub = { rows, mains: d.mains };
    const diffs = [];
    for (const s of ["101.01", "101.02", "102.01", "102.02"]) if ((rows[s] || 0) !== (exp.son.hesap[s] || 0)) diffs.push(`${s}: gerçek ${tl(rows[s] || 0)} / beklenen ${tl(exp.son.hesap[s] || 0)}`);
    const m101 = d.mains.find(m => m.account === "101");
    if (!m101 || k(m101.balance) !== exp.son.hesap["101"]) diffs.push(`ana 101: ${JSON.stringify(m101)} / beklenen ${tl(exp.son.hesap["101"])}`);
    for (const m of d.mains) if (!m.ok) diffs.push(`ana ${m.account} ≠ alt toplam`);
    assert.deepEqual(diffs, []);
  });

  it("son durum: cari bakiyeleri, Kasa, banka hesapları, Gerçek Banka, ANLIK DURUM alınan çek = model", async () => {
    const diffs = [];
    for (const [name, row] of Object.entries(cari)) {
      const got = k((await must("cari", api.get(`/api/workspace/accounts/${row.id}`))).totals.balance);
      actual.son[`cari:${name}`] = got;
      if (got !== exp.son.cari[name]) diffs.push(`cari ${name}: gerçek ${tl(got)} / beklenen ${tl(exp.son.cari[name])}`);
    }
    const ov = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const kasa = k(ov.cash?.balance ?? NaN);
    const gercek = k(ov.cash?.bank?.balance ?? 0);
    const cekler = k(ov.receivable?.cheques ?? 0);
    actual.son.ov = { kasa, gercek, cekler };
    if (kasa !== exp.son.hesap["100"]) diffs.push(`ANLIK DURUM Nakit Kasa: ${tl(kasa)} / ${tl(exp.son.hesap["100"])}`);
    if (gercek !== exp.son.hesap["102"]) diffs.push(`ANLIK DURUM Gerçek Banka: ${tl(gercek)} / ${tl(exp.son.hesap["102"])}`);
    if (cekler !== exp.son.hesap["101"]) diffs.push(`ANLIK DURUM alınan çek: ${tl(cekler)} / 101 ${tl(exp.son.hesap["101"])}`);
    for (const [name, row] of Object.entries(acc)) {
      const got = Number((await must("hesap", api.get(`/api/workspace/bank/accounts/${row.id}`))).balanceMinor);
      const want = exp.son.hesap[spec.hesaplar[name].sub];
      if (got !== want) diffs.push(`banka ${name}: ${tl(got)} / ${tl(want)}`);
    }
    assert.deepEqual(diffs, []);
  });

  it("Mutabakat Testi: tamam; cheque:collections defter = beklenen", async () => {
    const r = await must("Mutabakat", api.get("/api/workspace/ledger/integrity"));
    const c = r.checks.find(x => x.code === "cheque:collections");
    actual.son.mutabakat = { ok: r.ok, c, failures: (r.failures || []).slice(0, 5) };
    assert.equal(r.ok, true, JSON.stringify(r.failures));
    assert.equal(k(c?.ledger), exp.son.hesap["101.02"]);
    assert.equal(k(c?.subledger), exp.son.hesap["101.02"]);
  });

  for (const d of spec.kesitler) {
    it(`kesit ${d}: Ana Defter ?to= ve Alt Hesap Mizanı ?to= = model`, async () => {
      const t = await trial(`?to=${d}`);
      const s = await subTrial(`?to=${d}`);
      const rows = Object.fromEntries(s.rows.map(r => [r.sub, k(r.balance)]));
      actual.kesitler[d] = { t, rows };
      const e = exp.kesitler[d];
      const diffs = [];
      for (const a of ["100", "101", "102"]) if ((t[a] || 0) !== (e[a] || 0)) diffs.push(`ana ${a}: ${tl(t[a] || 0)} / ${tl(e[a] || 0)}`);
      for (const a of ["101.01", "101.02", "102.01", "102.02"]) if ((rows[a] || 0) !== (e[a] || 0)) diffs.push(`alt ${a}: ${tl(rows[a] || 0)} / ${tl(e[a] || 0)}`);
      const m101 = s.mains.find(m => m.account === "101");
      if (m101 && k(m101.balance) !== (t["101"] || 0)) diffs.push(`Alt Hesap Mizanı 101 (${m101.balance}) ≠ Ana Defter 101 (${tl(t["101"] || 0)})`);
      assert.deepEqual(diffs, []);
    });
  }

  for (const range of exp.araliklar) {
    it(`aralık ${range.from}–${range.to}: Alt Hesap Mizanı (uç + Rapor Merkezi) devir/borç/alacak = model`, async () => {
      const s = await subTrial(`?from=${range.from}&to=${range.to}`);
      const rep = await report("alt-hesap-mizani", `?from=${range.from}&to=${range.to}`);
      const repRows = Object.fromEntries(rep.rows.map(r => [r[0], r]));
      const rows = Object.fromEntries(s.rows.map(r => [r.sub, r]));
      actual.araliklar.push({ range: [range.from, range.to], rows, rep: rep.rows });
      const diffs = [];
      for (const [sub, e] of Object.entries(range.alt)) {
        if (sub === "100") continue;
        const r = rows[sub] || { opening: 0, debit: 0, credit: 0, balance: 0 };
        const got = { devir: k(r.opening), borc: k(r.debit), alacak: k(r.credit), bakiye: k(r.balance) };
        for (const key of Object.keys(e)) if (got[key] !== e[key]) diffs.push(`uç ${sub} ${key}: ${tl(got[key])} / ${tl(e[key])}`);
        const rr = repRows[sub];
        if (!rr) { if (e.devir || e.borc || e.alacak) diffs.push(`rapor ${sub} satırı yok`); continue; }
        const rg = { devir: parseTl(rr[3]), borc: parseTl(rr[4]), alacak: parseTl(rr[5]), bakiye: (rr[7] === "Alacak" ? -1 : 1) * parseTl(rr[6]) };
        for (const key of Object.keys(e)) if (rg[key] !== e[key]) diffs.push(`rapor ${sub} ${key}: ${tl(rg[key])} / ${tl(e[key])}`);
      }
      assert.deepEqual(diffs, []);
    });
  }

  for (const d of spec.gunler) {
    it(`Yevmiye ${d}: maddeler (hesap, borç, alacak) = model`, async () => {
      const rep = await report("yevmiye", `?from=${d}&to=${d}`);
      const got = rep.rows.map(r => [r[3], parseTl(r[4]), parseTl(r[5])]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const want = [...exp.gunler[d]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      actual.gunler[d] = got;
      assert.deepEqual(got, want);
    });
  }

  it("Nakit Akış (27.10–30.11): başlangıç = Kasa + Gerçek Banka; çek kalemleri beklenen günde, ayrı kaynak", async () => {
    const d = await must("Nakit Akış", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-27&to=2026-11-30&table=0"));
    const rows = d.rows.filter(r => r.ref?.type === "cheque").map(r => ({ no: r.label.match(/No ([A-Z]\d)/)?.[1], date: r.date, amount: k(r.amount), flow: r.flow || "" }));
    actual.son.akis = { opening: d.opening, rows, bySource: d.bySource, overdue: d.overdue.map(r => ({ label: r.label, date: r.date, amount: r.amount })) };
    const diffs = [];
    const opening = exp.son.hesap["100"] + exp.son.hesap["102"];
    if (k(d.opening) !== opening) diffs.push(`başlangıç ${d.opening} / ${tl(opening)}`);
    const want = exp.akis.map(a => ({ no: a.id, date: a.tarih, amount: a.tutar, flow: a.tahsilde ? "deposit" : "" }));
    if (JSON.stringify(rows.sort((a, b) => a.no.localeCompare(b.no))) !== JSON.stringify(want.sort((a, b) => a.no.localeCompare(b.no)))) diffs.push(`satırlar ${JSON.stringify(rows)} / ${JSON.stringify(want)}`);
    if (d.overdue.length) diffs.push(`gecikmiş satır beklenmiyordu: ${JSON.stringify(d.overdue.map(r => r.label))}`);
    const total = exp.akis.reduce((s, a) => s + a.tutar, 0);
    if (k(d.closing) !== opening + total) diffs.push(`dönem sonu ${d.closing} / ${tl(opening + total)}`);
    assert.deepEqual(diffs, []);
  });

  it("Vade Takip (çek) ve Zil: tahsildeki evrak beklenen günde", async () => {
    const v = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"));
    const vrows = v.rows.filter(r => r.ref?.type === "cheque").map(r => [r.label.match(/No ([A-Z]\d)/)?.[1], r.date, k(r.amount)]).sort();
    const dues = await must("dues", api.get("/api/workspace/dues"));
    const zrows = dues.items.filter(i => i.source === "cheque").map(i => [i.label.match(/No ([A-Z]\d)/)?.[1], i.dueDate, k(i.amount)]).sort();
    actual.son.vade = { vrows, zrows };
    const want = exp.akis.map(a => [a.id, a.tarih, a.tutar]).sort();
    assert.deepEqual({ vrows, zrows }, { vrows: want, zrows: want.filter(w => w[1] <= "2026-11-03") });
  });

  it("Tahsildeki Çek ve Senetler raporu: satırlar + TOPLAM = 101.02; Çek / Senet Portföyü 'deposited' süzgeci", async () => {
    const r = await report("tahsildeki-cekler");
    const rows = r.rows.map(x => [x[3], x[1], x[0], x[6], parseTl(x[7])]).sort();
    const p = await report("cek-portfoy", "?status=deposited");
    const prow = p.rows.map(x => [x[3], parseTl(x[7])]).sort();
    actual.son.tahsildeki = { rows, summary: r.summary, portfoy: prow, psummary: p.summary };
    const name = h => `${acc[h].bankName} · ${acc[h].name}`;
    const day = iso => iso.split("-").reverse().join(".");
    const want = exp.tahsildeki.map(t => [t.id, name(t.banka), day(t.verilme), day(exp.akis.find(a => a.id === t.id).tarih), t.tutar]).sort();
    const diffs = [];
    if (JSON.stringify(rows) !== JSON.stringify(want)) diffs.push(`tahsildeki: ${JSON.stringify(rows)} / ${JSON.stringify(want)}`);
    const total = parseTl(r.summary.find(s => /101\.02/.test(s[0]))?.[1]);
    if (total !== exp.son.hesap["101.02"]) diffs.push(`TOPLAM (101.02): ${tl(total)} / ${tl(exp.son.hesap["101.02"])}`);
    if (JSON.stringify(prow) !== JSON.stringify(exp.tahsildeki.map(t => [t.id, t.tutar]).sort())) diffs.push(`portföy deposited: ${JSON.stringify(prow)}`);
    assert.deepEqual(diffs, []);
  });

  it("Banka Hareket Raporu (Ziraat / Garanti): yalnız açılış ve tahsil girişleri; tahsile ver / geri al / karşılıksız para hareketi değil", async () => {
    const diffs = [];
    const want = { ziraat: [["01.10.2026", 10000000], ["27.10.2026", 300000]], garanti: [["01.10.2026", 5000000], ["23.10.2026", 240000]] };
    for (const [name, row] of Object.entries(acc)) {
      const r = await report("banka-hareket", `?from=2026-10-01&to=2026-10-31&bankAccount=${row.id}`);
      const body = r.rows.filter(x => x[3] !== "Devir").map(x => [x[0], parseTl(x[5]) + parseTl(x[7]) - parseTl(x[6]) - parseTl(x[8]) + (/(Açılış)/.test(x[4]) ? 0 : 0)]);
      actual.son[`hareket:${name}`] = r.rows;
      const end = parseTl(r.summary.find(s => s[0] === "Dönem Sonu")?.[1]);
      if (end !== exp.son.hesap[spec.hesaplar[name].sub]) diffs.push(`${name} dönem sonu ${tl(end)} / ${tl(exp.son.hesap[spec.hesaplar[name].sub])}`);
      const moves = body.filter(x => x[0] !== "01.10.2026");
      if (JSON.stringify(moves) !== JSON.stringify(want[name].filter(x => x[0] !== "01.10.2026"))) diffs.push(`${name} hareketler ${JSON.stringify(r.rows.map(x => [x[0], x[3], x[4], x[5], x[6]]))}`);
    }
    assert.deepEqual(diffs, []);
  });
});
