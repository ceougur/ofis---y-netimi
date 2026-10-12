// Bağımsız doğrulayıcı — Senaryo A (MUHASEBE SAYILARI). Beklenen: model.py (plan metninden, programın kodu kullanılmadan) → beklenen-a.json.
// Gerçek: programın API'si (sahte saat 15.10.2026 Perşembe). Her karşılaştırma ayrı denetim; fark = bulgu. Kod değiştirmez.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(path.join(HERE, process.env.SPEC || "senaryo-a.json"), "utf8"));
const expected = JSON.parse(readFileSync(path.join(HERE, process.env.BEKLENEN || "beklenen-a.json"), "utf8"));
const CH = "/api/workspace/cheques";
const tl = m => m / 100;
const k = v => Math.round(Number(v) * 100);
const parseTl = s => Math.round(Number(String(s).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) * 100);
const actual = { adimlar: [], kesitler: {}, araliklar: [], son: {} };

let ctx, api, acc, cari = {}, cek = {};
const subOf = async (query = "") => {
  const data = await must("alt hesap mizanı", api.get(`/api/workspace/bank/sub-trial${query}`));
  const rows = Object.fromEntries(data.rows.map(r => [r.sub, r]));
  return { rows, mains: data.mains };
};
const mainOf = async (query = "") => {
  const data = await must("mizan", api.get(`/api/workspace/ledger${query}`));
  return Object.fromEntries(data.trial.accounts.map(r => [r.code, r.balance]));
};
async function snapshot(query = "") {
  const sub = await subOf(query);
  const main = await mainOf(query);
  const out = { alt: {}, ana: {}, cari: {}, mainsOk: sub.mains.every(m => m.ok), mains101: sub.mains.find(m => m.account === "101") || null };
  for (const s of ["101.01", "101.02", "102.01", "102.02"]) out.alt[s] = k(sub.rows[s]?.balance ?? 0);
  for (const a of ["100", "101", "102", "120"]) out.ana[a] = k(main[a] ?? 0);
  return out;
}
async function live() {
  const snap = await snapshot();
  for (const [name, row] of Object.entries(cari)) snap.cari[name] = k((await must("cari", api.get(`/api/workspace/accounts/${row.id}`))).totals.balance);
  const ov = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
  snap.kasa = k(ov.cash?.cash?.balance ?? ov.cash?.balance ?? 0);
  snap.ovCash = ov.cash?.cash ? { ...ov.cash.cash } : null;
  snap.gercekBanka = k(ov.cash?.bank?.balance ?? 0);
  snap.portfoyAnlik = k(ov.receivable?.cheques ?? 0);
  snap.banka = {};
  for (const [name, row] of Object.entries(acc)) snap.banka[name] = Number((await must("hesap", api.get(`/api/workspace/bank/accounts/${row.id}`))).balanceMinor);
  const integ = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  snap.mutabakat = { ok: integ.ok, collections: integ.checks.find(c => c.code === "cheque:collections") || null, failures: (integ.failures || []).slice(0, 5) };
  return snap;
}
async function run(o) {
  const c = cek[o.id];
  if (o.t === "al") {
    const row = await must(`al ${o.id}`, api.post(CH, { direction: "in", instrument: o.tur, amount: String(o.tutar).replace(".", ","), issueDate: o.tarih, dueDate: o.vade, accountId: cari[o.cari].id, serialNo: o.id }));
    cek[o.id] = row;
    return { status: 200 };
  }
  const body = o.t === "ver" ? { action: "bank-deposit", date: o.tarih, bankAccountId: acc[o.hesap].id }
    : o.t === "tahsil" ? { action: "collect", date: o.tarih }
    : o.t === "geri" ? { action: "bank-withdraw", date: o.tarih }
    : o.t === "karsiliksiz" ? { action: "bounce", date: o.tarih } : null;
  const res = body ? await api.post(`${CH}/${c.id}/actions`, body) : await api.post(`${CH}/${c.id}/undo`, {});
  return { status: res.status, code: res.code, error: res.error };
}

describe(`Senaryo: ${spec.ad}`, () => {
  before(async () => {
    ctx = await bootBank({ now: `${spec.bugun}T12:00:00+03:00` });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    for (const name of spec.cariler) cari[name] = await must("cari", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => {
    writeFileSync(path.join(HERE, process.env.GERCEK || "gercek-a.json"), JSON.stringify(actual, null, 1));
    ctx?.server.close();
  });

  it("hesap alt kodları beklenenle aynı (102.01 Ziraat, 102.02 Garanti)", () => {
    assert.equal(acc.ziraat.glSub, spec.hesaplar.ziraat.sub);
    assert.equal(acc.garanti.glSub, spec.hesaplar.garanti.sub);
  });

  spec.olaylar.forEach((o, i) => {
    it(`adım ${i + 1}: ${o.t} ${o.id}${o.tarih ? ` ${o.tarih}` : ""}${o.hesap ? ` → ${o.hesap}` : ""} — anlık sayılar = model`, async () => {
      const res = await run(o);
      const snap = await live();
      actual.adimlar.push({ olay: o, res, snap });
      assert.equal(res.status, 200, `istek reddedildi: ${JSON.stringify(res)}`);
      const exp = expected.adimlar[i].anlik;
      const diffs = [];
      for (const s of Object.keys(exp.alt)) if (snap.alt[s] !== exp.alt[s]) diffs.push(`alt ${s}: gerçek ${tl(snap.alt[s])} / beklenen ${tl(exp.alt[s])}`);
      for (const a of ["101", "102"]) if (snap.ana[a] !== exp.ana[a]) diffs.push(`ana ${a}: gerçek ${tl(snap.ana[a])} / beklenen ${tl(exp.ana[a])}`);
      if (snap.ana["100"] !== 0) diffs.push(`Ana Defter 100 (Kasa): ${tl(snap.ana["100"])} / beklenen 0`);
      if (snap.kasa !== 0) diffs.push(`ANLIK DURUM Kasa: ${tl(snap.kasa)} / beklenen 0`);
      for (const n of Object.keys(exp.cari)) if (snap.cari[n] !== exp.cari[n]) diffs.push(`cari ${n}: gerçek ${tl(snap.cari[n])} / beklenen ${tl(exp.cari[n])}`);
      for (const [name, h] of Object.entries(spec.hesaplar)) if (snap.banka[name] !== exp.alt[h.sub]) diffs.push(`banka ${name} bakiyesi: gerçek ${tl(snap.banka[name])} / beklenen ${tl(exp.alt[h.sub])}`);
      const gercekBanka = exp.alt["102.01"] + exp.alt["102.02"];
      if (snap.gercekBanka !== gercekBanka) diffs.push(`ANLIK DURUM Gerçek Banka: ${tl(snap.gercekBanka)} / beklenen ${tl(gercekBanka)}`);
      if (snap.portfoyAnlik !== exp.ana["101"]) diffs.push(`ANLIK DURUM alınan çek (açık): ${tl(snap.portfoyAnlik)} / beklenen 101 = ${tl(exp.ana["101"])}`);
      if (!snap.mainsOk) diffs.push("Alt Hesap Mizanı: ana hesap ≠ alt hesap toplamı");
      if (!snap.mutabakat.ok) diffs.push(`Mutabakat Testi bozuk: ${JSON.stringify(snap.mutabakat.failures)}`);
      if (!snap.mutabakat.collections?.ok) diffs.push(`cheque:collections denetimi: ${JSON.stringify(snap.mutabakat.collections)}`);
      assert.deepEqual(diffs, []);
    });
  });

  for (const d of spec.kesitler) {
    it(`kesit ${d}: Ana Defter (?to=) ve Alt Hesap Mizanı (?to=) = model`, async () => {
      const snap = await snapshot(`?to=${d}`);
      actual.kesitler[d] = snap;
      const exp = expected.kesitler[d];
      const diffs = [];
      for (const s of Object.keys(exp.alt)) if (snap.alt[s] !== exp.alt[s]) diffs.push(`alt ${s}: gerçek ${tl(snap.alt[s])} / beklenen ${tl(exp.alt[s])}`);
      for (const a of ["100", "101", "102"]) if (snap.ana[a] !== exp.ana[a]) diffs.push(`ana ${a}: gerçek ${tl(snap.ana[a])} / beklenen ${tl(exp.ana[a])}`);
      if (snap.mains101 && k(snap.mains101.balance) !== snap.ana["101"]) diffs.push(`Alt Hesap Mizanı 101 ana (${snap.mains101.balance}) ≠ Ana Defter 101 (${tl(snap.ana["101"])})`);
      assert.deepEqual(diffs, []);
    });
  }

  expected.araliklar.forEach(range => {
    it(`aralık ${range.from}–${range.to}: Alt Hesap Mizanı devir/borç/alacak/bakiye (uç ve Rapor Merkezi) = model`, async () => {
      const sub = await subOf(`?from=${range.from}&to=${range.to}`);
      const rep = await must("rapor", api.get(`/api/workspace/report-center/alt-hesap-mizani?from=${range.from}&to=${range.to}`));
      const repRows = Object.fromEntries(rep.rows.map(r => [r[0], r]));
      actual.araliklar.push({ range, sub: sub.rows, rapor: rep.rows });
      const diffs = [];
      for (const [s, e] of Object.entries(range.alt)) {
        const r = sub.rows[s] || { opening: 0, debit: 0, credit: 0, balance: 0 };
        const got = { devir: k(r.opening), borc: k(r.debit), alacak: k(r.credit), bakiye: k(r.balance) };
        for (const key of Object.keys(e)) if (got[key] !== e[key]) diffs.push(`uç ${s} ${key}: gerçek ${tl(got[key])} / beklenen ${tl(e[key])}`);
        const rr = repRows[s];
        if (!rr) { if (e.devir || e.borc || e.alacak) diffs.push(`rapor ${s} satırı yok`); continue; }
        const rgot = { devir: parseTl(rr[3]), borc: parseTl(rr[4]), alacak: parseTl(rr[5]), bakiye: (rr[7] === "Alacak" ? -1 : 1) * parseTl(rr[6]) };
        for (const key of Object.keys(e)) if (rgot[key] !== e[key]) diffs.push(`rapor ${s} ${key}: gerçek ${tl(rgot[key])} / beklenen ${tl(e[key])}`);
      }
      assert.deepEqual(diffs, []);
    });
  });

  it("Banka Hareket Raporu (hesap bazında): yalnız tahsil girişi, tahsil günü; tahsile ver / geri al / karşılıksız para hareketi değil", async () => {
    const diffs = [];
    actual.son.bankaHareket = {};
    for (const [name, row] of Object.entries(acc)) {
      const rep = await must("Banka Hareket", api.get(`/api/workspace/report-center/banka-hareket?from=2026-10-02&to=2026-10-31&bankAccount=${row.id}`));
      const lines = rep.rows.filter(r => r[3] !== "Devir").map(r => ({ tarih: r[0].split(".").reverse().join("-"), giris: r[5] ? parseTl(r[5]) : 0, cikis: r[6] ? parseTl(r[6]) : 0, tur: r[3], aciklama: r[4] }));
      actual.son.bankaHareket[name] = lines;
      const exp = expected.son.banka_giris[name];
      const got = lines.map(l => ({ tarih: l.tarih, giris: l.giris, cikis: l.cikis }));
      if (JSON.stringify(got) !== JSON.stringify(exp)) diffs.push(`${name}: gerçek ${JSON.stringify(lines)} / beklenen ${JSON.stringify(exp)}`);
    }
    assert.deepEqual(diffs, []);
  });

  it("Banka Bakiye Raporu: dönem sonu ve giriş = model", async () => {
    const rep = await must("Banka Bakiye", api.get("/api/workspace/report-center/banka-bakiye?from=2026-10-01&to=2026-10-31"));
    actual.son.bankaBakiye = rep.rows;
    const diffs = [];
    for (const [name, h] of Object.entries(spec.hesaplar)) {
      const r = rep.rows.find(x => x[3] === h.sub);
      const closing = expected.kesitler[spec.kesitler.at(-1)].alt[h.sub];
      const giris = expected.son.banka_giris[name].reduce((s, l) => s + l.giris, 0);
      if (!r) { diffs.push(`${h.sub} satırı yok`); continue; }
      if (parseTl(r[10]) !== closing) diffs.push(`${h.sub} dönem sonu ${r[10]} / beklenen ${tl(closing)}`);
      if (parseTl(r[5]) !== giris) diffs.push(`${h.sub} giriş ${r[5]} / beklenen ${tl(giris)}`);
    }
    assert.deepEqual(diffs, []);
  });

  it("Nakit Akış: açık evrak beklenen tarih ve tutarla (tahsildeki: vade + iş günü; portföydeki: vade); başlangıç = Kasa + Gerçek Banka", async () => {
    const [from, to] = spec.akis;
    const data = await must("Nakit Akış", api.get(`/api/workspace/overview/nakit-akisi?from=${from}&to=${to}&table=0`));
    const rows = [...data.rows, ...(data.overdue || [])].filter(r => r.ref?.type === "cheque").map(r => ({ id: Object.entries(cek).find(([, c]) => c.id === r.ref.id)?.[0], tarih: r.date, tutar: k(r.amount) }));
    actual.son.nakitAkis = { rows: data.rows.filter(r => r.ref?.type === "cheque"), overdue: data.overdue, cashToday: data.cashToday, start: data.start };
    const exp = expected.son.akis.map(a => ({ id: a.id, tarih: a.tarih, tutar: a.tutar }));
    const diffs = [];
    if (JSON.stringify(rows.sort((a, b) => (a.tarih + a.id).localeCompare(b.tarih + b.id))) !== JSON.stringify(exp)) diffs.push(`kalemler gerçek ${JSON.stringify(rows)} / beklenen ${JSON.stringify(exp)}`);
    const last = expected.kesitler[spec.kesitler.at(-1)];
    if (k(data.cashToday) !== last.alt["102.01"] + last.alt["102.02"]) diffs.push(`başlangıç ${data.cashToday} / beklenen ${tl(last.alt["102.01"] + last.alt["102.02"])}`);
    assert.deepEqual(diffs, []);
  });

  it("Vade Takip (açık): evrak kalemleri = Nakit Akış'la aynı beklenen tarih", async () => {
    const data = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque,note"));
    const rows = data.rows.filter(r => r.ref?.type === "cheque").map(r => ({ id: Object.entries(cek).find(([, c]) => c.id === r.ref.id)?.[0], tarih: r.date, tutar: k(r.amount) })).sort((a, b) => (a.tarih + a.id).localeCompare(b.tarih + b.id));
    actual.son.vadeTakip = data.rows;
    const exp = expected.son.akis.map(a => ({ id: a.id, tarih: a.tarih, tutar: a.tutar }));
    assert.deepEqual(rows, exp);
  });

  it("Çek listesi: Bankada Tahsilde süzgeci + özet; Portföyde süzgeci tahsildekini içermez; sanal durum etiketleri", async () => {
    const list = async status => (await must(`liste ${status}`, api.get(`${CH}${status ? `?status=${status}` : ""}`)));
    const all = await list("");
    const dep = await list("deposited");
    const por = await list("portfolio");
    const idOf = id => Object.entries(cek).find(([, c]) => c.id === id)?.[0];
    actual.son.liste = { deposited: dep.cheques.map(r => idOf(r.id)), portfolio: por.cheques.map(r => idOf(r.id)), summary: all.summary, labels: Object.fromEntries(all.cheques.map(r => [idOf(r.id), r.statusLabel])) };
    const durum = expected.son.durumlar;
    const expDep = Object.entries(durum).filter(([, v]) => v.durum === "portfoy" && v.banka).map(([id]) => id).sort();
    const expPor = Object.entries(durum).filter(([, v]) => v.durum === "portfoy" && !v.banka).map(([id]) => id).sort();
    const diffs = [];
    if (JSON.stringify(actual.son.liste.deposited.sort()) !== JSON.stringify(expDep)) diffs.push(`deposited ${actual.son.liste.deposited} / ${expDep}`);
    if (JSON.stringify(actual.son.liste.portfolio.sort()) !== JSON.stringify(expPor)) diffs.push(`portfolio ${actual.son.liste.portfolio} / ${expPor}`);
    if (k(all.summary.deposited?.amount) !== expected.son.tahsilde.tutar || all.summary.deposited?.count !== expected.son.tahsilde.adet) diffs.push(`özet tahsilde ${JSON.stringify(all.summary.deposited)} / ${JSON.stringify(expected.son.tahsilde)}`);
    const names = { ziraat: "Ziraat Bankası", garanti: "Garanti BBVA" };
    for (const [id, v] of Object.entries(durum)) {
      if (v.durum !== "portfoy" || !v.banka) continue;
      const want = `Bankada Tahsilde · ${names[v.banka]} · ${v.verilme.split("-").reverse().join(".")}`;
      if (actual.son.liste.labels[id] !== want) diffs.push(`${id} etiketi "${actual.son.liste.labels[id]}" / "${want}"`);
    }
    assert.deepEqual(diffs, []);
  });

  it("Rapor Merkezi Çek / Senet Portföyü: 'Portföyde' süzgeci satırları ↔ özet 'Portföyde (alınan)' tutarlı mı", async () => {
    const rep = await must("Çek Portföyü", api.get("/api/workspace/report-center/cek-portfoy?direction=in&status=portfolio"));
    const repDep = await api.get("/api/workspace/report-center/cek-portfoy?direction=in&status=deposited");
    actual.son.cekPortfoy = { rows: rep.rows, summary: rep.summary, footer: rep.footer, depositedFilter: { status: repDep.status, subtitle: repDep.data?.subtitle, rows: repDep.data?.rows?.length } };
    const rowsSum = rep.rows.reduce((s, r) => s + parseTl(r[7]), 0);
    const summaryPortfoy = parseTl(rep.summary.find(s => s[0].startsWith("Portföyde"))[1]);
    const diffs = [];
    if (rowsSum !== summaryPortfoy) diffs.push(`'Portföyde' süzgecinde satır toplamı ${tl(rowsSum)} ↔ özet 'Portföyde (alınan)' ${tl(summaryPortfoy)} (tahsildeki ${tl(expected.son.tahsilde.tutar)} satırda yok, özette var)`);
    if (repDep.status === 200 && repDep.data.rows.length !== expected.son.tahsilde.adet) diffs.push(`rapor status=deposited süzgeci yok sayılıyor: ${repDep.data.rows.length} satır (beklenen ${expected.son.tahsilde.adet}), alt başlık "${repDep.data.subtitle}"`);
    assert.deepEqual(diffs, []);
  });
});
