// DK-M1 dar kontrol senaryoları — gerçek program (API), sahte saat; kullanım: node senaryo.mjs <kod kökü> [senaryo adları,...]
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root, onlyText = ""] = process.argv.slice(2);
const only = onlyText ? new Set(onlyText.split(",")) : null;
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { boot, must, rawRun } = await imp("test/banka-210-ortak.mjs");
const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV", "Ödenecek KDV", "Devreden KDV"];
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const qs = q => new URLSearchParams(q).toString();
const mr = month => {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
};

async function setup(now, extra = {}) {
  const ctx = await boot({ now, ...extra });
  const api = ctx.api;
  const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "DK Müşteri", type: "customer", registeredOn: "2025-01-01" }))).id;
  const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "DK Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }))).id;
  let n = 0;
  const h = {
    ctx,
    api,
    M,
    T,
    buy: async (date, net, extra2 = {}) => (await must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: extra2.account || T, issueDate: date, number: `DK-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" }, ...(extra2.vatPeriod ? { vatPeriod: extra2.vatPeriod } : {}) }))).id,
    sell: async (date, net) => (await must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    offset: async month => {
      const res = await api.post(`${TAX}/vat-offset`, { month });
      return { status: res.status, offset: res.data?.offset ? [res.data.offset.carryInMinor, res.data.offset.payableMinor, res.data.offset.carryOutMinor] : null, error: res.status === 200 ? "" : JSON.stringify(res.data).slice(0, 200) };
    },
    reverse: async month => {
      const list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
      const row = list.find(item => item.month === month && item.status === "active");
      return (await api.post(`${TAX}/vat-offset/${row.id}/reverse`, {})).status;
    },
    preview: async month => {
      const p = (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
      return { nums: [p.carryInMinor, p.payableMinor, p.carryOutMinor], warnings: p.warnings, blocks: p.blocks };
    },
    report: async (query, who = api) => {
      const res = await who.get(`${RC}/kdv-ozeti?${qs(query)}`);
      if (res.status !== 200) return { status: res.status, error: JSON.stringify(res.data).slice(0, 200) };
      const d = res.data;
      const s = Object.fromEntries(d.summary);
      const g = d.headers.indexOf("Belge Türü");
      const k = d.headers.indexOf("KDV");
      return {
        status: 200,
        three: ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV", "Devreden KDV"].map(l => minor(s[l])),
        h391: minor(s["Hesaplanan KDV (391) (İadeler Düşülmüş)"] ?? s["Hesaplanan KDV (391)"]),
        h191: minor(s["İndirilecek KDV (191) (İadeler Düşülmüş)"] ?? s["İndirilecek KDV (191)"]),
        notes: d.summary.filter(([l]) => ["Mahsup Edilmemiş Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Not", "Mahsuptan Sonra Değişen Ay", "KDV Mahsup Fişi"].includes(l)),
        lines: d.rows.filter(r => !["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"].includes(r[g])).map(r => `${r[0]}|${r[g]}|${minor(r[k])}`),
        footers: (d.footers || []).map(r => `${r[g]}|${minor(r[k])}`),
        rowCount: d.rows.length,
      };
    },
  };
  return h;
}
const out = (name, obj) => console.log(`${name} ${JSON.stringify(obj)}`);
const want = name => !only || only.has(name);

// A — S261 örneği.
if (want("A")) {
  const h = await setup("2026-03-05T12:00:00+03:00");
  await h.buy("2026-01-10", 10000);
  out("A.ocak-mahsup", await h.offset("2026-01"));
  await h.sell("2026-02-10", 6000);
  out("A.subat-rapor", (await h.report(mr("2026-02"))).three);
  out("A.subat-onizleme", (await h.preview("2026-02")).nums);
  h.ctx.server.close();
}
// B — S-M1-1 örneği (Eylül devreden 1.960, Ekim 400 mahsupsuz, Kasım 1.000).
if (want("B")) {
  const h = await setup("2026-12-10T12:00:00+03:00");
  await h.buy("2026-09-10", 9800);
  out("B.eylul-mahsup", await h.offset("2026-09"));
  await h.sell("2026-10-10", 2000);
  await h.sell("2026-11-10", 5000);
  const r = await h.report(mr("2026-11"));
  out("B.kasim-rapor", { three: r.three, notes: r.notes });
  out("B.kasim-onizleme", await h.preview("2026-11"));
  const y = await h.report({ from: "2026-01-01", to: "2026-12-31" });
  out("B.yil", { three: y.three, lines: y.lines, footers: y.footers, notes: y.notes });
  h.ctx.server.close();
}
// C — yıl dönümü: Aralık 2026 devreden → Ocak 2027 (Bu Yıl ön ayarı ve ay aralığı); Aralık mahsuplu ve mahsupsuz.
if (want("C")) {
  for (const mahsup of [true, false]) {
    const h = await setup("2027-02-03T00:30:00+03:00");
    await h.buy("2026-12-31", 5000);
    if (mahsup) out(`C.${mahsup}.aralik-mahsup`, await h.offset("2026-12"));
    await h.sell("2027-01-01", 1000);
    const pre = await h.report({ preset: "thisYear" });
    out(`C.${mahsup}.buyil`, { three: pre.three, notes: pre.notes, lines: pre.lines });
    out(`C.${mahsup}.ocak`, (await h.report(mr("2027-01"))).three);
    out(`C.${mahsup}.aralik`, (await h.report(mr("2026-12"))).three);
    out(`C.${mahsup}.ocak-onizleme`, (await h.preview("2027-01")).nums);
    h.ctx.server.close();
  }
}
// D — yıllık özet ↔ ayların toplamı ↔ zincir sürekliliği (karışık yön, iade, hareketsiz ay, kısmi mahsup).
if (want("D")) {
  const h = await setup("2027-01-20T12:00:00+03:00");
  await h.sell("2026-01-10", 2000); // ödenecek 400
  await h.buy("2026-02-10", 6000); // devreden 1200
  await h.sell("2026-04-10", 3000); // 600 → 600 devreden
  await h.sell("2026-05-10", 5000); // 1000 → ödenecek 400
  await h.buy("2026-07-10", 1500); // devreden 300
  await h.sell("2026-08-10", 1000); // 200 → devreden 100
  await h.sell("2026-11-10", 2500); // 500 → ödenecek 400
  out("D.ocak-mahsup", await h.offset("2026-01"));
  out("D.subat-mahsup", await h.offset("2026-02"));
  // Nisan / Mayıs mahsupsuz; Temmuz mahsubu (defterdeki 1.200 ile kesilir → zincirle uyuşmaz)
  out("D.temmuz-mahsup", await h.offset("2026-07"));
  const year = await h.report({ from: "2026-01-01", to: "2026-12-31" });
  const months = [];
  for (let m = 1; m <= 12; m += 1) months.push((await h.report(mr(`2026-${String(m).padStart(2, "0")}`))).three);
  const sumPay = months.reduce((s, t) => s + t[1], 0);
  const breaks = months.slice(1).map((t, i) => (t[0] === months[i][2] ? "" : `${i + 2}. ay önceki ${t[0]} ≠ ${i + 1}. ay sonraki ${months[i][2]}`)).filter(Boolean);
  out("D.yil", { three: year.three, notes: year.notes, footers: year.footers });
  out("D.aylar", months);
  out("D.denklik", { yilOnceki: year.three[0], ocakOnceki: months[0][0], yilOdenecek: year.three[1], aylarOdenecek: sumPay, yilSonraki: year.three[2], aralikSonraki: months[11][2], kopukluk: breaks });
  const all = await h.report({ preset: "all" });
  out("D.tumzamanlar", { three: all.three });
  const q = await h.report({ from: "2026-04-01", to: "2026-08-31" });
  out("D.nisan-agustos", { three: q.three, notes: q.notes, lines: q.lines });
  h.ctx.server.close();
}
// E — geri alınmış mahsup fişi.
if (want("E")) {
  const h = await setup("2026-05-05T12:00:00+03:00");
  await h.buy("2026-01-10", 10000); // 2000
  out("E.ocak", await h.offset("2026-01"));
  await h.sell("2026-02-10", 2500); // 500
  out("E.subat", await h.offset("2026-02"));
  await h.sell("2026-03-10", 1000); // 200
  out("E.mart-once", (await h.report(mr("2026-03"))).three);
  out("E.subat-geri-al", await h.reverse("2026-02"));
  const r = await h.report(mr("2026-03"));
  out("E.mart-sonra", { three: r.three, notes: r.notes });
  out("E.mart-onizleme", (await h.preview("2026-03")).nums);
  out("E.ocak-geri-al", await h.reverse("2026-01"));
  const r2 = await h.report(mr("2026-03"));
  out("E.mart-hepsi-geri", { three: r2.three, notes: r2.notes });
  const y = await h.report({ from: "2026-01-01", to: "2026-12-31" });
  out("E.yil", { three: y.three, notes: y.notes, footers: y.footers });
  h.ctx.server.close();
}
// F — dönem kilidi (donmuş defter) öncesi / sonrası aynı sayılar.
if (want("F")) {
  const h = await setup("2026-08-05T12:00:00+03:00");
  await h.buy("2026-01-10", 10000);
  out("F.ocak", await h.offset("2026-01"));
  await h.sell("2026-02-10", 2500);
  await h.sell("2026-03-10", 1000);
  out("F.mart-mahsup", await h.offset("2026-03"));
  await h.sell("2026-06-10", 3000);
  await h.buy("2026-07-10", 500);
  const qs1 = [mr("2026-03"), mr("2026-06"), mr("2026-07"), { from: "2026-01-01", to: "2026-12-31" }];
  const before = [];
  for (const q of qs1) before.push((await h.report(q)).three);
  const lock = await h.api.put("/api/admin/period-lock", { lockedUntil: "2026-04-30" });
  out("F.kilit", lock.status);
  // dondurma arka planda olabilir: kısa bekleme
  await new Promise(r => setTimeout(r, 1500));
  const after = [];
  for (const q of qs1) after.push((await h.report(q)).three);
  out("F.once", before);
  out("F.sonra", after);
  out("F.esit", JSON.stringify(before) === JSON.stringify(after));
  out("F.haziran-onizleme", (await h.preview("2026-06")).nums);
  h.ctx.server.close();
}
// G — ay ortası aralık.
if (want("G")) {
  const h = await setup("2026-05-05T12:00:00+03:00");
  await h.buy("2026-01-10", 10000);
  await h.sell("2026-02-05", 1000);
  await h.sell("2026-02-25", 2000);
  await h.sell("2026-03-05", 1500);
  const r = await h.report({ from: "2026-02-15", to: "2026-03-10" });
  out("G.ara", { three: r.three, notes: r.notes, lines: r.lines, footers: r.footers, h391: r.h391 });
  h.ctx.server.close();
}
// H — eski veri: faturası olan cari silinmiş (2.4.9 öncesi mümkün) — 391 satırı ile Ödenecek tutarlı mı.
if (want("H")) {
  const h = await setup("2026-04-05T12:00:00+03:00");
  const T2 = (await must("tedarikçi 2", h.api.post("/api/workspace/accounts", { name: "DK Silinen Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }))).id;
  await h.sell("2026-02-10", 5000); // 1000
  await h.buy("2026-02-12", 2000, { account: T2 }); // 400
  const before = await h.report(mr("2026-02"));
  rawRun(h.ctx.db, "UPDATE accounts SET deleted_at = ?, deleted_by = 'eski' WHERE id = ?", "2026-03-01T10:00:00.000Z", T2);
  const after = await h.report(mr("2026-02"));
  out("H.once", { three: before.three, h391: before.h391, h191: before.h191 });
  out("H.silindikten-sonra", { three: after.three, h391: after.h391, h191: after.h191, footers: after.footers });
  out("H.onizleme", (await h.preview("2026-02")).nums);
  h.ctx.server.close();
}
// I — Muhasebe rolü ve yetkisiz rol; iki şirket ayrımı.
if (want("I")) {
  const { createUser, apiOf } = { ...(await imp("test/helpers.mjs")), ...(await imp("test/banka-210-ortak.mjs")) };
  const h = await setup("2026-04-05T12:00:00+03:00", { maxCompanies: 2 });
  await h.buy("2026-01-10", 10000);
  await h.offset("2026-01");
  await h.sell("2026-02-10", 2500);
  const c2 = await must("002", h.api.post("/api/companies", { name: "DK İkinci", select: false }));
  const q2 = `hofCompany=${encodeURIComponent((c2.company || c2).id)}`;
  const r2 = await h.api.get(`${RC}/kdv-ozeti?${qs(mr("2026-02"))}&${q2}`);
  out("I.002-bos", r2.status === 200 ? Object.fromEntries(r2.data.summary) : r2.status);
  const r1 = await h.report(mr("2026-02"));
  out("I.001", r1.three);
  if (createUser) {
    const acc = apiOf(await createUser(h.ctx.server, h.api.client, { username: "dk-muh", role: "muhasebe" }));
    out("I.muhasebe", (await h.report(mr("2026-02"), acc)).three);
    const staff = apiOf(await createUser(h.ctx.server, h.api.client, { username: "dk-per", role: "personel" }));
    out("I.personel", (await h.report(mr("2026-02"), staff)).status);
  }
  h.ctx.server.close();
}
// J — S4 (mahsuptan sonra İndirilecek KDV'yi azaltan kayıt) + mahsupsuz ay araya girince.
if (want("J")) {
  const h = await setup("2026-06-05T12:00:00+03:00");
  const p = await h.buy("2026-01-10", 10000); // 2000
  const p2 = await h.buy("2026-01-20", 1000); // 200
  out("J.ocak", await h.offset("2026-01")); // devreden 2200
  await h.sell("2026-02-10", 2500); // 500, mahsupsuz
  await h.sell("2026-03-10", 1000); // 200
  // Ocak'ın 200'lük alışını iptal et (S4: azaltan) — API
  const res = await h.api.post(`${INV}/${p2}/cancel`, { reason: "dk", force: true });
  out("J.iptal", `${res.status} ${res.status === 200 ? "" : JSON.stringify(res.data).slice(0, 160)}`);
  out("J.mart", (await h.report(mr("2026-03"))).three);
  out("J.subat", (await h.report(mr("2026-02"))).three);
  out("J.subat-onizleme", await h.preview("2026-02"));
  out("J.subat-mahsup", await h.offset("2026-02"));
  out("J.mart-rapor-sonra", (await h.report(mr("2026-03"))).three);
  out("J.mart-onizleme", (await h.preview("2026-03")).nums);
  h.ctx.server.close();
}
// K — KDV'siz ay (yalnız %0 belge) çok aylı tabloda.
if (want("K")) {
  const h = await setup("2026-05-05T12:00:00+03:00");
  await h.buy("2026-01-10", 10000);
  const z = await h.api.post(INV, { scenario: "service_sale", accountId: h.M, issueDate: "2026-02-10", lines: [{ name: "İstisna", qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } });
  out("K.sifir-satis", `${z.status} ${z.status === 200 ? "" : JSON.stringify(z.data).slice(0, 200)}`);
  await h.sell("2026-03-10", 1000);
  const r = await h.report({ from: "2026-01-01", to: "2026-03-31" });
  out("K.tablo", { three: r.three, lines: r.lines, rowCount: r.rowCount });
  out("K.subat", (await h.report(mr("2026-02"))).three);
  h.ctx.server.close();
}
// L — S4 azaltan kayıt + araya giren ÖDENECEK yönlü mahsupsuz ay; sonraki ay mahsup edilir (devreden eşit → zincirde sayılır).
if (want("L")) {
  const h = await setup("2026-05-05T12:00:00+03:00");
  await h.sell("2026-01-05", 5000); // 391 1000
  const p = await h.buy("2026-01-10", 2500); // 191 500 → Ocak ödenecek 500
  out("L.ocak-mahsup", await h.offset("2026-01"));
  const c = await h.api.post(`${INV}/${p}/cancel`, { reason: "dk", force: true });
  out("L.ocak-alis-iptal", `${c.status} ${c.status === 200 ? "" : JSON.stringify(c.data).slice(0, 200)}`);
  await h.sell("2026-02-10", 1000); // 200, Şubat mahsupsuz
  await h.sell("2026-03-10", 2000); // 400
  out("L.mart-onizleme", await h.preview("2026-03"));
  out("L.mart-mahsup", await h.offset("2026-03"));
  const m = await h.report(mr("2026-03"));
  out("L.mart-rapor", { three: m.three, notes: m.notes });
  const f = await h.report(mr("2026-02"));
  out("L.subat-rapor", { three: f.three, notes: f.notes });
  const y = await h.report({ from: "2026-01-01", to: "2026-03-31" });
  out("L.ocak-mart", { three: y.three, notes: y.notes, lines: y.lines });
  h.ctx.server.close();
}
// L2 — S4 azaltan kayıt, BÜTÜN aylar SIRAYLA mahsuplu (mahsupsuz ay yok): yıl Ödenecek ↔ fişlerin ödeneceği (360) ↔ gerçek KDV.
if (want("L2")) {
  const h = await setup("2026-05-05T12:00:00+03:00");
  await h.sell("2026-01-05", 5000); // 391 1000
  const p = await h.buy("2026-01-10", 2500); // 191 500 → Ocak ödenecek 500
  out("L2.ocak-mahsup", await h.offset("2026-01"));
  const c = await h.api.post(`${INV}/${p}/cancel`, { reason: "dk", force: true });
  out("L2.ocak-alis-iptal", c.status);
  await h.sell("2026-02-10", 1000); // 200
  out("L2.subat-mahsup", await h.offset("2026-02"));
  await h.sell("2026-03-10", 2000); // 400
  out("L2.mart-mahsup", await h.offset("2026-03"));
  const months = [];
  for (const m of ["2026-01", "2026-02", "2026-03"]) months.push((await h.report(mr(m))).three.slice(0, 3));
  out("L2.aylar", months);
  const y = await h.report({ from: "2026-01-01", to: "2026-03-31" });
  out("L2.ocak-mart", { three: y.three, h391: y.h391, h191: y.h191, notes: y.notes, lines: y.lines });
  const offs = (await must("liste", h.api.get(`${TAX}/vat-offset`))).offsets.filter(o => o.status === "active").map(o => [o.month, o.payableMinor, o.stale]);
  out("L2.fisler", offs);
  h.ctx.server.close();
}
