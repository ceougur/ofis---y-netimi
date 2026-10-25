// 2.4.5 G4 — göçten (v2.4.4 → 2.4.5, v33) SONRA 2.4.5'te YEDEK TATBİKATI (anayasa Test kuralı: yedek → çalış → geri yükle → sayılar → yeniden çalış),
// programın kendi Yedekle / Geri Yükle / Silinenler uçlarıyla. Veri: göç klasörünün kopyası (v2.4.4'ün GERÇEK koduyla üretilmiş iki şirket). Saat sahte (ders 13):
// üretimin son günü 18:00'den akar; olgular karşılaştırılırken o günün 17:00'sinde dondurulur. Ürün davranışı: kayıt tahsilatı / Tablodan Aktar / tablo
// takvimi anahtarları KAPALI (üretim; çağıran verir).
//
// Beklenen değerler (kâhin) BAŞ MİMAR KARARLARI S1 (FIFO: carinin borç kuyruğu kayıt tarihine göre, bağsız tahsilat en eskiden kapatır; Vade / Beklenen sırayı
// değiştirmez) ve K6.1–K6.4 METNİNDEN, elle hesaplanan küçük sayılarla (2.4.5 kodundan türetilmez; ders 5):
//   P carisi: Açılış Bakiyesi 4.000 (kayıt gün−30, Vade gün−20, Beklenen gün−10), Borç D1 5.000 (gün−15, Vade gün−5), Borç D2 3.000 (gün−2, Vade gün+5, Beklenen
//   gün+2), Tahsilat 6.000 (gün) → Kalan: açılış 0, D1 3.000, D2 3.000; takvim: D1 "Tahsil Edilecek Borç" gün−5 3.000 (gecikmiş, kısmi), D2 "Tahsil Edilecek
//   Borç (Ödeme Sözü)" gün+2 3.000; açılış kalem değil (Kalan 0).
// Denetimler:
//   V1  vadeli kayıtlar ve kısmi tahsilat 200; kartta Vade / Beklenen / Kalan = beklenen; takvim kalemleri = beklenen
//   V2  Tabela Adı ayarı (Fatura Ayarları → Firma Bilgisi) kaydedilir ve geri okunur; öbür fatura ayarları değişmez
//   V3  yedek → çalış (tahsilat, D2'nin vadesi değişir, yeni vadeli borç, Tabela Adı değişir; her biri gerçekten yazıldı) → geri yükle → olgular (cari, mizan,
//       Kasa, banka, çek, fatura, taksit, raporlar, takvim, cari kartları, Vade / Beklenen / Kalan, Tabela Adı) yedek anıyla AYNI
//   V4  bir şirketin geri yüklenmesi öbür şirketin olgularını değiştirmez
//   V5  geri yüklemeden sonra yeniden çalış: yeni vadeli borç + tahsilat → Kalan / takvim FIFO'ya göre tutarlı; Mutabakat Testi'nde yeni sapma yok, mizan dengede
//   V6  Silinenler: vadeli borç silinir (takvimden çıkar, bakiye düşer) → Silinenler'den geri yüklenir → Vade Tarihi ve Beklenen Ödeme Tarihi korunur, kalem geri gelir
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { companyFacts } from "./m30-olgular.mjs";
import { stableDiff } from "./m30-tatbikat.mjs";
import { addDays, scoped } from "./m30-uretici.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cents = v => Math.round(Number(v || 0) * 100);

/** Karşılaştırılan olgular: m30-tatbikat stable() + cari kartları + yeni alanlar + takvim kalemleri (sürüm damgası hariç) + Tabela Adı. */
function drillDiff(x, y) {
  const diff = stableDiff(x.facts, y.facts);
  for (const key of ["accountCards", "entryNewFields"]) if (!same(x.facts[key], y.facts[key])) diff.push({ section: key, count: Object.keys(x.facts[key] || {}).filter(k => !same(x.facts[key]?.[k], y.facts[key]?.[k])).length });
  const dues = d => (d?.items || []).map(item => JSON.stringify(item)).sort();
  if (!same(dues(x.facts.dues), dues(y.facts.dues))) diff.push({ section: "dues", before: x.facts.dues?.items?.length, after: y.facts.dues?.items?.length });
  for (const key of ["card", "reportHeader", "series"]) if (!same(x[key], y[key])) diff.push({ section: key, before: x[key], after: y[key] });
  return diff;
}

export async function runDrill245({ day, bootCurrent, clock, log = () => {} }) {
  const checks = [];
  const check = (name, ok, detail = {}) => {
    checks.push({ name, ok: Boolean(ok), detail });
    log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 900)}`}`);
    return Boolean(ok);
  };
  const at = (hour, minute = 0) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), hour, minute, 0);
  let server = await bootCurrent();
  let api = await server.login();
  const restart = async () => {
    await server.close();
    server = await bootCurrent();
    api = await server.login();
  };
  const must = async (what, promise) => {
    const res = await promise;
    if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
    return res.data;
  };
  clock.resume();
  clock.set(at(18));
  const companies = (await api.get("/api/companies")).data.all.map(c => ({ id: c.id, code: c.code, name: c.name }));
  const people = {};
  const on = company => ({ get: url => scoped(api, company.id).get(url), post: (url, body) => scoped(api, company.id).post(url, body), put: (url, body) => scoped(api, company.id).put(url, body), del: url => scoped(api, company.id).del(url) });
  const cardOf = async (company, accountId) => {
    const card = await must("cari kartı", on(company).get(`/api/workspace/accounts/${accountId}`));
    return { balance: cents(card.totals?.balance), entries: card.entries.filter(e => ["debt", "credit"].includes(e.kind) || e.kind === "in").map(e => ({ note: e.note, kind: e.kind, amount: cents(e.amount), date: e.date, dueDate: e.dueDate ?? null, expectedDate: e.expectedDate ?? null, remaining: e.remaining === undefined ? null : cents(e.remaining) })).sort((p, q) => `${p.date}|${p.note}`.localeCompare(`${q.date}|${q.note}`)) };
  };
  const duesOf = async (company, accountId) => (await must("takvim", on(company).get("/api/workspace/dues"))).items.filter(item => item.source === "account" && item.accountId === accountId).map(item => ({ label: item.label, dueDate: item.dueDate, amount: cents(item.amount), state: item.state, partial: item.partial })).sort((p, q) => p.dueDate.localeCompare(q.dueDate));
  const snapshot = async company => {
    clock.freeze(at(17));
    try {
      const facts = await companyFacts(scoped(api, company.id));
      const settings = await must("Fatura Ayarları", on(company).get("/api/workspace/invoices/settings"));
      return { facts, card: await cardOf(company, people[company.code].id), reportHeader: settings.reportHeader ?? null, series: settings.series };
    } finally {
      clock.resume();
      clock.set(at(18, 30));
    }
  };
  const integrityOf = async company => (await must("Mutabakat Testi", on(company).get("/api/workspace/ledger/integrity"))).failures || [];

  // ---------- V1 / V2: vadeli kayıtlar, kısmi tahsilat, Tabela Adı ----------
  for (const company of companies) {
    const c = on(company);
    const baseIntegrity = await integrityOf(company);
    const settingsBefore = await must("Fatura Ayarları", c.get("/api/workspace/invoices/settings"));
    const made = await must("P carisi", c.post("/api/workspace/accounts", { name: `Tatbikat Vadeli Müşteri ${company.code}`, type: "customer", registeredOn: addDays(day, -30), openingBalance: 4000, openingSide: "debt", openingDueDate: addDays(day, -20), openingExpectedDate: addDays(day, -10) }));
    const id = made.id;
    await must("D1 borç", c.post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: 5000, date: addDays(day, -15), dueDate: addDays(day, -5), note: "D1 Hizmet bedeli" }));
    await must("D2 borç", c.post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: 3000, date: addDays(day, -2), dueDate: addDays(day, 5), expectedDate: addDays(day, 2), note: "D2 Danışmanlık" }));
    await must("T1 kısmi tahsilat", c.post(`/api/workspace/accounts/${id}/entries`, { kind: "in", amount: 6000, date: day, method: "cash", note: "T1 Kısmi tahsilat" }));
    people[company.code] = { id, baseIntegrity };
    const card = await cardOf(company, id);
    const byNote = note => card.entries.find(e => e.note === note);
    const expectCard = [
      ["Açılış bakiyesi", 400000, addDays(day, -20), addDays(day, -10), 0],
      ["D1 Hizmet bedeli", 500000, addDays(day, -5), "", 300000],
      ["D2 Danışmanlık", 300000, addDays(day, 5), addDays(day, 2), 300000],
    ];
    const cardBad = expectCard.filter(([note, amount, due, exp, rem]) => { const e = byNote(note); return !e || e.amount !== amount || e.dueDate !== due || e.expectedDate !== exp || e.remaining !== rem; });
    check(`V1 ${company.code} P carisinin kartı: Vade / Beklenen / Kalan (FIFO: açılış 0, D1 3.000, D2 3.000), bakiye 6.000`, !cardBad.length && card.balance === 600000, { cardBad, card });
    const dues = await duesOf(company, id);
    const expectDues = [
      { label: "Tahsil Edilecek Borç", dueDate: addDays(day, -5), amount: 300000, state: "overdue", partial: true },
      { label: "Tahsil Edilecek Borç (Ödeme Sözü)", dueDate: addDays(day, 2), amount: 300000, state: "upcoming", partial: false },
    ];
    check(`V1 ${company.code} takvim / zil: D1 gecikmiş kısmi 3.000, D2 Ödeme Sözü gün+2 3.000, açılış kalem değil`, same(dues, expectDues), { dues, expectDues });
    const sign = `Tatbikat Tabela ${company.code}`;
    const saved = await must("Tabela Adı", c.put("/api/workspace/invoices/settings", { reportHeader: { signName: sign, mode: "full" } }));
    const read = await must("Fatura Ayarları", c.get("/api/workspace/invoices/settings"));
    check(`V2 ${company.code} Tabela Adı kaydedildi ve geri okundu; seri ve sıradaki numaralar değişmedi`, same(saved.reportHeader, { signName: sign, mode: "full" }) && same(read.reportHeader, { signName: sign, mode: "full" }) && same(read.series, settingsBefore.series) && same(read.nextNumbers, settingsBefore.nextNumbers), { reportHeader: read.reportHeader, series: [settingsBefore.series, read.series] });
  }

  // ---------- V3 / V4 / V5 / V6: yedek → çalış → geri yükle → sayılar → yeniden çalış; Silinenler ----------
  for (const company of [...companies].reverse()) {
    const other = companies.find(x => x.id !== company.id);
    const c = () => on(company);
    const id = people[company.code].id;
    const backup = await must(`yedek ${company.code}`, api.post("/api/admin/backups", { scope: "one", companyId: company.id }));
    const moment = await snapshot(company);
    const otherBefore = await snapshot(other);
    // ara çalışma W2 (her biri yazıldı mı okunur — ders 3)
    await must("W2 tahsilat", c().post(`/api/workspace/accounts/${id}/entries`, { kind: "in", amount: 1000, date: day, method: "cash", note: "W2 Ara tahsilat" }));
    const d2 = (await must("kart", c().get(`/api/workspace/accounts/${id}`))).entries.find(e => e.note === "D2 Danışmanlık");
    await must("W2 vade değişikliği", c().put(`/api/workspace/accounts/${id}/entries/${d2.id}`, { dueDate: addDays(day, 6), expectedDate: "" }));
    await must("W2 yeni vadeli borç", c().post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: 1500, date: day, dueDate: addDays(day, 1), note: "W2 Ara borç" }));
    await must("W2 Tabela", c().put("/api/workspace/invoices/settings", { reportHeader: { signName: "Ara Dönem Tabelası", mode: "sign" } }));
    const mid = await cardOf(company, id);
    const midHeader = (await must("ayar", c().get("/api/workspace/invoices/settings"))).reportHeader;
    const midD2 = mid.entries.find(e => e.note === "D2 Danışmanlık");
    check(`V3 ${company.code} ara çalışma gerçekten yazıldı (bakiye 6.000 → 6.500, D2 Vade gün+6 / Beklenen boş, Tabela değişti)`, mid.balance === 650000 && midD2.dueDate === addDays(day, 6) && midD2.expectedDate === "" && midHeader.signName === "Ara Dönem Tabelası", { balance: mid.balance, midD2, midHeader });
    const restoreRes = await must(`geri yükle ${company.code}`, api.post("/api/admin/backups/restore", { name: backup.name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }));
    if (restoreRes.staged) {
      await restart();
      check(`V3 ${company.code} geri yükleme (yeniden açılışta) uygulandı`, server.app.stagedRestore?.ok === true, { staged: server.app.stagedRestore });
    }
    const restored = await snapshot(company);
    const diff = drillDiff(moment, restored);
    check(`V3 ${company.code} yedek → çalış → geri yükle: olgular (Vade / Beklenen / Kalan, takvim, Tabela Adı dahil) yedek anıyla aynı`, !diff.length, { diff, backup: backup.name, card: restored.card, reportHeader: restored.reportHeader });
    const otherAfter = await snapshot(other);
    const otherDiff = drillDiff(otherBefore, otherAfter);
    check(`V4 ${company.code} geri yüklemesi ${other.code}'i değiştirmedi`, !otherDiff.length, { diff: otherDiff });
    // V5: yeniden çalış — D4 2.000 (gün, Vade gün+3), T3 2.500 → FIFO: D1 3.000 → 500; D2 3.000; D4 2.000.
    await must("V5 D4", c().post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount: 2000, date: day, dueDate: addDays(day, 3), note: "D4 Yeni borç" }));
    await must("V5 T3", c().post(`/api/workspace/accounts/${id}/entries`, { kind: "in", amount: 2500, date: day, method: "cash", note: "T3 Tahsilat" }));
    const card5 = await cardOf(company, id);
    const rem = note => card5.entries.find(e => e.note === note)?.remaining;
    const dues5 = await duesOf(company, id);
    const expect5 = [
      { label: "Tahsil Edilecek Borç", dueDate: addDays(day, -5), amount: 50000, state: "overdue", partial: true },
      { label: "Tahsil Edilecek Borç (Ödeme Sözü)", dueDate: addDays(day, 2), amount: 300000, state: "upcoming", partial: false },
      { label: "Tahsil Edilecek Borç", dueDate: addDays(day, 3), amount: 200000, state: "upcoming", partial: false },
    ];
    const integrity = await integrityOf(company);
    const newFailures = integrity.filter(f => !people[company.code].baseIntegrity.some(g => same(g, f)));
    const trial = (await must("Ana Defter", c().get("/api/workspace/ledger"))).trial.totals;
    check(`V5 ${company.code} geri yüklemeden sonra yeniden çalış: Kalan D1 500 / D2 3.000 / D4 2.000, bakiye 5.500, takvim aynı; Mutabakat Testi'nde yeni sapma yok, mizan dengede`, rem("Açılış bakiyesi") === 0 && rem("D1 Hizmet bedeli") === 50000 && rem("D2 Danışmanlık") === 300000 && rem("D4 Yeni borç") === 200000 && card5.balance === 550000 && same(dues5, expect5) && !newFailures.length && cents(trial.difference) === 0, { card5, dues5, newFailures, trial });
    // V6: Silinenler — D2 (Vade gün+5, Beklenen gün+2) silinir → geri yüklenir.
    const d2now = (await must("kart", c().get(`/api/workspace/accounts/${id}`))).entries.find(e => e.note === "D2 Danışmanlık");
    await must("V6 sil", c().del(`/api/workspace/accounts/${id}/entries/${d2now.id}`));
    const afterDelete = await cardOf(company, id);
    const duesDeleted = await duesOf(company, id);
    const trash = await must("Silinenler", api.get(`/api/admin/trash?hofCompany=${encodeURIComponent(company.id)}`));
    const items = Array.isArray(trash) ? trash : trash.items || [];
    const item = items.find(t => t.kind === "account-entry" && t.title === `Tatbikat Vadeli Müşteri ${company.code}` && /D2 Danışmanlık/.test(t.detail || ""));
    check(`V6 ${company.code} vadeli borç silindi: bakiye 2.500, takvimden çıktı, Silinenler'de`, afterDelete.balance === 250000 && !duesDeleted.some(d => d.label.includes("Ödeme Sözü")) && Boolean(item), { balance: afterDelete.balance, duesDeleted, item: item && { id: item.id, title: item.title, detail: item.detail } });
    if (item) {
      const res = await api.post(`/api/admin/trash/restore?hofCompany=${encodeURIComponent(company.id)}`, { id: item.id });
      const back = await cardOf(company, id);
      const d2back = back.entries.find(e => e.note === "D2 Danışmanlık");
      const duesBack = await duesOf(company, id);
      check(`V6 ${company.code} Silinenler'den geri yüklenen vadeli borç: Vade gün+5 ve Beklenen gün+2 korundu, Kalan 3.000, takvimde yeniden "Ödeme Sözü" gün+2, bakiye 5.500`, res.status === 200 && d2back?.dueDate === addDays(day, 5) && d2back?.expectedDate === addDays(day, 2) && d2back?.remaining === 300000 && back.balance === 550000 && same(duesBack, expect5), { status: res.status, message: String(res.data?.error || "").slice(0, 200), d2back, duesBack });
    }
  }
  await server.close();
  return { checks };
}
