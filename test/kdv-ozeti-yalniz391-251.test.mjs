// 2.5.1 M1 küçük tur 3 — KDV Özeti: mahsup fişi DEVREDEN yönde kesilmiş ayda sonradan YALNIZ satış KDV'si (391) değişirse (S-M1K2-1 = A).
//   KULLANICI 27.11.2026 19:5x UTC ("önerini uygula") — S-M1K2-1 = A: 'güncel değil' ayında da o ayın (bugünkü kayıtlardan) devredeni sonraki aya taşınır; her değişiklik bir kez
//   sayılır (S-M1K-1 = A ile aynı çizgi); sonraki ayın fişi eski devredenle kesildiyse o ayın satırında 'Zincirle Uyuşmayan Mahsup Fişi' notu. Örnek (AYNEN): Mart fişi 'sonraki
//   döneme devreden 800' ile kesildi; sonra Mart'a KDV'si 100 olan satış girildi; Nisan fişi 200 → Mart sonraki devreden 700, Nisan önceki devreden 700, Mart–Nisan Ödenecek 300
//   (= 391 − 191); Nisan satırında uyuşmazlık notu. Bugün (taban): Mart 700 / Nisan önceki 800, Mart–Nisan 200. Defter / mahsup fişi DEĞİŞMEZ.
//   Önceki kararlar DEĞİŞMEZ: S-M1K-1 = A (karma ay), S-DKM1-1 = A (yalnız İ azaldı — sonuç fişten), S-M1-3 = C ('güncel değil' notu; BAŞ MİMAR OKUMASI: ödenecek yönde yalnız 391
//   değişiminin davranışı DEĞİŞMEZ), S-M1-1 = B (zincir), S-M1-2 = B (yön notu). Kararın söylemediği iki durum (ödenecek yönden devredene dönen yalnız 391 ayı; İ artan devreden
//   yönlü ay) bugünkü davranışla SABİTLENDİ — raporda 'KULLANICIYA SORULMALI' (sapma sayısı tabloda yazılı).
//   BAŞ MİMAR KARARI (tur 2 raporu §8.3) — S4 taşımalı karma (önceki fişli ayın azalması bu aya taşınmış + bu ayın 391'i değişmiş): elle hesap, tek okuma, sabitlendi.
// KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20. Sayılar yanıt gövdesinden ve
// veri tabanından (mahsup fişi listesi, mizan) okunur (ders 3).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const DOC_KINDS = ["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"];
const CHANGED = "Mahsuptan Sonra Değişen Ay";
const MISMATCH = "Zincirle Uyuşmayan Mahsup Fişi";
const PENDING = "Mahsup Edilmemiş Ay";
const MIXED_TEXT = "(mahsup fişi güncel değil — Hesaplanan KDV bugünkü kayıtlardan, İndirilecek KDV kesilmiş mahsup fişinden alındı, azalma sonraki mahsupta düşülür; mahsubu geri alıp yeniden mahsup edin)";
const REDUCED_TEXT = "(bu ayın kayıtları fişten sonra değişti; ayın sonucu kesilmiş mahsup fişinden, İndirilecek KDV'deki azalma sonraki mahsupta düşülür)";
const STALE_TEXT = "(mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)";
const MISMATCH_TAIL = " (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)";
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const qs = query => new URLSearchParams(query).toString();
const monthRange = month => {
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) };
};
const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);

/** İki şirketli program (001 + 002) ve API yardımcıları; sayılar yanıt gövdesinden (ders 3). */
async function program(now, prefix) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  const created = await must("002", api.post("/api/companies", { name: `${prefix} İkinci Şirket`, select: false }));
  const q2 = `hofCompany=${encodeURIComponent((created.company || created).id)}`;
  const qOf = tag => (tag === "002" ? q2 : "");
  const ids = {};
  for (const tag of ["001", "002"]) {
    ids[`M${tag}`] = (await must(`müşteri ${tag}`, api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Müşteri ${tag}`, type: "customer", registeredOn: "2025-01-01" }))).id;
    ids[`T${tag}`] = (await must(`tedarikçi ${tag}`, api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Tedarikçi ${tag}`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  }
  let n = 0;
  const h = {
    ctx,
    api,
    buy: async (tag, date, net) => (await must(`alış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `${prefix}-${tag}-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (tag, date, net) => (await must(`satış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async (tag, id) => must(`İptal Et ${tag}`, api.post(amp(`${INV}/${id}/cancel`, qOf(tag)), { reason: "Hatalı fatura", force: true })),
    offset: async (tag, month) => {
      const o = (await must(`mahsup ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset`, qOf(tag)), { month }))).offset;
      return [o.carryInMinor, o.payableMinor, o.carryOutMinor];
    },
    reverse: async (tag, month) => {
      const list = (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets;
      const row = list.find(item => item.month === month && item.status === "active");
      assert.ok(row, `${tag} ${month} etkin fiş`);
      return must(`geri al ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset/${row.id}/reverse`, qOf(tag)), {}));
    },
    /** Etkin fişler (veri tabanından): [ay, önceki, ödenecek, sonraki, güncel değil]. */
    offsets: async tag => (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets.filter(item => item.status === "active").map(item => [item.month, item.carryInMinor, item.payableMinor, item.carryOutMinor, item.stale]),
    preview: async (tag, month) => {
      const p = (await must(`ön izleme ${tag} ${month}`, api.get(amp(`${TAX}/vat-offset?month=${month}`, qOf(tag))))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    report: async (tag, query, label = `${tag} ${qs(query)}`) => {
      const res = await api.get(amp(`${RC}/kdv-ozeti?${qs(query)}`, qOf(tag)));
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      const data = res.data;
      const summary = Object.fromEntries(data.summary);
      const g = data.headers.indexOf("Belge Türü");
      const k = data.headers.indexOf("KDV");
      const three = RESULT_LABELS.map(name => minor(summary[name]));
      const foot = (data.footers || []).filter(line => RESULT_LABELS.includes(line[g])).map(line => minor(line[k]));
      if (data.rows.length) assert.deepEqual(foot, three, `${label}: tablo altı = özet`);
      const lines = data.rows.filter(row => !DOC_KINDS.includes(row[g])).map(row => [row[0], row[g], minor(row[k])]);
      return { data, summary, three, lines, h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]) };
    },
    /** Ekran = PDF = Excel (tablo, tablo altı ve özet — not satırlarının metni dahil). */
    sameFiles: async (tag, query, label) => {
      const { data } = await h.report(tag, query, label);
      const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${qs(query)}`, qOf(tag)));
      assert.equal(pdf.status, 200, `${label} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      for (const row of [...data.rows, ...data.footers]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${label} PDF hücresi: "${cell}"`);
      for (const [name, value] of data.summary) if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${label} PDF özet ${name}: "${value}"`);
      const xlsx = await api.raw("GET", amp(`${RC}/kdv-ozeti/xlsx?${qs(query)}`, qOf(tag)));
      assert.equal(xlsx.status, 200, `${label} Excel`);
      const sheets = Object.values(xlsxSheets(xlsx.buffer));
      const sheet = sheets[0].slice(Math.max(0, sheets[0].findIndex(row => row.length > 1)));
      assert.equal(sheet.length, 1 + data.rows.length + (data.rows.length ? data.footers.length : 0), `${label} Excel satır sayısı`);
      [...data.rows, ...data.footers].forEach((row, index) => {
        row.forEach((cell, c) => {
          const want = minor(cell);
          const got = sheet[1 + index][c];
          if (want !== null) assert.equal(typeof got === "number" ? Math.round(got * 100) : minor(got), want, `${label} Excel satır ${index + 1} ${data.headers[c]}`);
        });
      });
      const book = sheets.find(rows => rows.some(row => String(row[0]).trim() === "Önceki Dönemden Devreden KDV"));
      assert.ok(book, `${label} Excel özet sayfası`);
      for (const [name, value] of data.summary) {
        const row = book.find(item => String(item[0]).trim() === name);
        assert.ok(row, `${label} Excel özet satırı ${name}`);
        const want = minor(value);
        if (want !== null) assert.equal(typeof row[1] === "number" ? Math.round(row[1] * 100) : minor(row[1]), want, `${label} Excel özet ${name}`);
        else assert.equal(String(row[1]).trim(), String(value).trim(), `${label} Excel özet ${name}`);
      }
    },
  };
  return h;
}


/** Aralığın sonucu 391 − 191'e eşit mi (aralık, azalmanın düşüldüğü ayı da içeriyorsa — her değişiklik bir kez). */
const balanced = (r, label) => assert.equal(r.three[1] - r.three[2] + r.three[0], r.h391 - r.h191, `${label}: Ödenecek − Sonraki + Önceki = 391 − 191 (${JSON.stringify(r.three)}, 391 ${r.h391}, 191 ${r.h191})`);
const mismatchOf = (label, used, chain) => `${label} fişi ${used} devredenle kesilmiş, sırayla mahsupta ${chain} olmalıydı${MISMATCH_TAIL}`;

describe("2.5.1 M1 küçük tur 3 — yalnız 391 devreden yönde (S-M1K2-1 = A): kararın örneği AYNEN, yıl dönümü, iki şirket", () => {
  let h;
  before(async () => {
    h = await program("2027-02-05T12:00:00+03:00", "YD");
    // 001 — kararın örneği AYNEN: Mart alış KDV 1.000, satış KDV 200 → Mart fişi devreden 800; sonra Mart satış KDV 100; Nisan satış KDV 1.000 → Nisan fişi (defterin 800'üyle) 200.
    await h.buy("001", "2026-03-05", 5000);
    await h.sell("001", "2026-03-10", 1000);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 0, 80000], "001 Mart fişi devreden 800");
    await h.sell("001", "2026-03-20", 500);
    await h.sell("001", "2026-04-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-04"), [80000, 20000, 0], "001 Nisan fişi 200 (defterin 800 devredeniyle)");
    // 002 — yıl dönümü: Aralık 2026 aynı sayılar; Ocak 2027 fişi defterin 800'üyle 200.
    await h.buy("002", "2026-12-05", 5000);
    await h.sell("002", "2026-12-10", 1000);
    assert.deepEqual(await h.offset("002", "2026-12"), [0, 0, 80000], "002 Aralık fişi devreden 800");
    await h.sell("002", "2026-12-20", 500);
    await h.sell("002", "2027-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2027-01"), [80000, 20000, 0], "002 Ocak 2027 fişi 200");
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 kararın örneği: Mart sonraki 700, Nisan önceki 700 + ödenecek 300 + uyuşmazlık notu, Mart–Nisan 300 = 391 − 191; fiş / ön izleme / defter değişmez; ekran = PDF = Excel; onarımda aynı", async () => {
    assert.deepEqual(await h.offsets("001"), [["2026-03", 0, 0, 80000, true], ["2026-04", 80000, 20000, 0, false]], "fişler (veri tabanı): Mart devreden 800 (güncel değil) / Nisan 200");
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [0, 0, 70000], `Mart: 300 − 1.000 → sonraki 700 ${JSON.stringify(mar.data.summary)}`);
    assert.equal(mar.summary[CHANGED], `Mart 2026 ${STALE_TEXT}`, "Mart 'güncel değil' notu (S-M1-3 = C, kalır)");
    assert.deepEqual([mar.h391, mar.h191], [30000, 100000], "Mart 391 / 191 bugünkü kayıtlardan");
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan");
    assert.deepEqual(apr.three, [70000, 30000, 0], `Nisan: önceki 700, 1.000 − 700 = 300 (taban 800 / 200) ${JSON.stringify(apr.data.summary)}`);
    assert.equal(apr.summary[MISMATCH], mismatchOf("Nisan 2026", "800,00 TL", "700,00 TL"), "Nisan uyuşmazlık notu");
    assert.ok(!(CHANGED in apr.summary), "Nisan'ın kendi kayıtları değişmedi");
    const both = await h.report("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
    assert.deepEqual(both.three, [0, 30000, 0], `Mart–Nisan Ödenecek 300 (taban 200) ${JSON.stringify(both.data.summary)}`);
    assert.deepEqual([both.h391, both.h191], [130000, 100000], "391 1.300, 191 1.000");
    balanced(both, "001 Mart–Nisan");
    assert.deepEqual(both.lines, [["Mart 2026", "Sonraki Döneme Devreden KDV", 70000], ["Nisan 2026", "Önceki Dönemden Devreden KDV", 70000], ["Nisan 2026", "Ödenecek KDV", 30000]], "ay satırları");
    assert.equal(both.summary[CHANGED], `Mart 2026 ${STALE_TEXT}`, "Mart–Nisan: Mart notu");
    assert.equal(both.summary[MISMATCH], mismatchOf("Nisan 2026", "800,00 TL", "700,00 TL"), "Mart–Nisan: Nisan uyuşmazlık notu");
    for (const query of [{ preset: "all" }, { from: "2026-01-01", to: "2026-12-31" }]) {
      const r = await h.report("001", query, `001 ${qs(query)}`);
      assert.deepEqual(r.three, [0, 30000, 0], `${qs(query)} 300`);
      balanced(r, `001 ${qs(query)}`);
    }
    assert.deepEqual(await h.preview("001", "2026-03"), [0, 0, 70000], "Mart ön izlemesi bugünkü kayıtlardan (DEĞİŞMEDİ)");
    assert.deepEqual(await h.preview("001", "2026-04"), [80000, 20000, 0], "Nisan ön izlemesi defterin 800 devredeniyle (DEĞİŞMEDİ)");
    const tb = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 20000, "defterde 360 = 200 (Nisan fişi; defter DEĞİŞMEDİ)");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 0, "defterde 190 = 0 (Mart 800 yazdı, Nisan 800 kullandı)");
    await h.sameFiles("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
    await h.sameFiles("001", monthRange("2026-04"), "001 Nisan");
    // Onarım: Nisan ve Mart geri alınır, sırayla yeniden mahsup → Mart devreden 700, Nisan 700 devredenle 300 (toplam = raporun söylediği); notlar kalkar.
    await h.reverse("001", "2026-04");
    await h.reverse("001", "2026-03");
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 0, 70000], "Mart yeniden devreden 700");
    assert.deepEqual(await h.offset("001", "2026-04"), [70000, 30000, 0], "Nisan yeniden 300 (700 devredenle)");
    const fixed = await h.report("001", { from: "2026-03-01", to: "2026-04-30" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 30000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), `notlar kalkar ${JSON.stringify(fixed.data.summary)}`);
    await integrityOk(h.api, "001 onarım");
  });

  it("002 yıl dönümü: Aralık 2026 sonraki 700; Bu Yıl (2027) önceki 700, ödenecek 300 + uyuşmazlık; 2026 yılı sonraki 700; Aralık–Ocak 300; 001 etkilenmez", async () => {
    const dec = await h.report("002", monthRange("2026-12"), "002 Aralık");
    assert.deepEqual(dec.three, [0, 0, 70000], `Aralık 2026 sonraki 700 ${JSON.stringify(dec.data.summary)}`);
    assert.equal(dec.summary[CHANGED], `Aralık 2026 ${STALE_TEXT}`, "Aralık notu");
    const year = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(year.three, [70000, 30000, 0], `Bu Yıl (2027): önceki 700, ödenecek 300 (taban 800 / 200) ${JSON.stringify(year.data.summary)}`);
    assert.equal(year.summary[MISMATCH], mismatchOf("Ocak 2027", "800,00 TL", "700,00 TL"), "Ocak 2027 uyuşmazlık notu");
    balanced(year, "002 Bu Yıl");
    const last = await h.report("002", { from: "2026-01-01", to: "2026-12-31" }, "002 2026");
    assert.deepEqual(last.three, [0, 0, 70000], "2026 yılı sonraki döneme devreden 700");
    balanced(last, "002 2026");
    const cross = await h.report("002", { from: "2026-12-01", to: "2027-01-31" }, "002 Aralık–Ocak");
    assert.deepEqual(cross.three, [0, 30000, 0], `Aralık–Ocak 300 ${JSON.stringify(cross.data.summary)}`);
    balanced(cross, "002 Aralık–Ocak");
    await h.sameFiles("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual((await h.report("001", { preset: "all" }, "001 Tüm Zamanlar")).three, [0, 30000, 0], "001 aynı (şirketler ayrı)");
  });
});

// Tutarlılık tablosu (ELLE): iki başlangıç — DEVREDEN (Mart alış KDV 600 + 400, satış KDV 200 → Mart fişi devreden 800) ve ÖDENECEK (Mart satış KDV 800 + 200, alış KDV 500 →
// Mart fişi 500); Mart'ta fişten SONRA tek değişiklik grubu; Nisan satış KDV 1.000 (devreden) / 200 (ödenecek) + Nisan mahsubu (ön izlemeyle — defterin devredeni).
// Her satır: Mart ve Nisan raporu (önceki / ödenecek / sonraki), Mart notu, Nisan fişi (veri tabanı), uyuşmazlık notu, Mart–Nisan, 391 / 191, 391 − 191 eşitliği (eşit değilse
// sapma — kararın söylemediği durum, SABİTLENDİ, sorulur), onarım (Nisan ve Mart geri al + sırayla yeniden mahsup) fişleri ve onarımdan sonraki rapor.
const DEVREDEN = async (h, tag) => {
  await h.buy(tag, "2026-03-05", 3000);
  const b400 = await h.buy(tag, "2026-03-06", 2000);
  const s200 = await h.sell(tag, "2026-03-10", 1000);
  assert.deepEqual(await h.offset(tag, "2026-03"), [0, 0, 80000], `${tag} Mart fişi devreden 800`);
  return { b400, s200, april: 5000 };
};
const ODENECEK = async (h, tag) => {
  const s800 = await h.sell(tag, "2026-03-05", 4000);
  await h.sell(tag, "2026-03-06", 1000);
  await h.buy(tag, "2026-03-10", 2500);
  assert.deepEqual(await h.offset(tag, "2026-03"), [0, 50000, 0], `${tag} Mart fişi 500`);
  return { s800, april: 1000 };
};
const ROWS = [
  { name: "devreden · hiçbiri", base: DEVREDEN, change: async () => {}, mar: [0, 0, 80000], note: null, aprFis: [80000, 20000, 0], apr: [80000, 20000, 0], mismatch: null, total: [0, 20000, 0], h: [120000, 100000], redo: [[0, 0, 80000], [80000, 20000, 0]] },
  { name: "devreden · yalnız İ azaldı (S-DKM1-1 = A)", base: DEVREDEN, change: async (h, tag, ids) => h.cancel(tag, ids.b400), mar: [0, 0, 80000], note: REDUCED_TEXT, aprFis: [80000, 60000, 0], apr: [80000, 60000, 0], mismatch: null, total: [0, 60000, 0], h: [120000, 60000], redo: [[0, 0, 40000], [40000, 60000, 0]] },
  { name: "devreden · yalnız 391 arttı (S-M1K2-1 = A)", base: DEVREDEN, change: async (h, tag) => h.sell(tag, "2026-03-20", 500), mar: [0, 0, 70000], note: STALE_TEXT, aprFis: [80000, 20000, 0], apr: [70000, 30000, 0], mismatch: ["800,00 TL", "700,00 TL"], total: [0, 30000, 0], h: [130000, 100000], redo: [[0, 0, 70000], [70000, 30000, 0]] },
  { name: "devreden · yalnız 391 azaldı (S-M1K2-1 = A)", base: DEVREDEN, change: async (h, tag, ids) => h.cancel(tag, ids.s200), mar: [0, 0, 100000], note: STALE_TEXT, aprFis: [80000, 20000, 0], apr: [100000, 0, 0], mismatch: ["800,00 TL", "1.000,00 TL"], total: [0, 0, 0], h: [100000, 100000], redo: [[0, 0, 100000], [100000, 0, 0]] },
  { name: "devreden → ödenecek · yalnız 391 arttı, yön döndü (S-M1K2-1 = A)", base: DEVREDEN, change: async (h, tag) => h.sell(tag, "2026-03-20", 5000), mar: [0, 20000, 0], note: STALE_TEXT, aprFis: [80000, 20000, 0], apr: [0, 100000, 0], mismatch: ["800,00 TL", "0,00 TL"], total: [0, 120000, 0], h: [220000, 100000], redo: [[0, 20000, 0], [0, 100000, 0]] },
  {
    name: "devreden · ikisi birden (S-M1K-1 = A, karma)",
    base: DEVREDEN,
    change: async (h, tag, ids) => {
      await h.cancel(tag, ids.b400);
      await h.sell(tag, "2026-03-20", 500);
    },
    mar: [0, 0, 70000],
    note: MIXED_TEXT,
    aprFis: [80000, 60000, 0],
    apr: [70000, 70000, 0],
    mismatch: ["800,00 TL", "700,00 TL"],
    total: [0, 70000, 0],
    h: [130000, 60000],
    redo: [[0, 0, 30000], [30000, 70000, 0]],
  },
  // Karar dışı (yalnız satış KDV'si değil): İ artan devreden yönlü ay — sonraki aya fişin 800'ü taşınır (S-M1-3 = C AYNEN); Mart–Nisan 391 − 191'den 100 sapar (KULLANICIYA SORULMALI).
  { name: "devreden · İ arttı (S-M1-3 = C, karar dışı)", base: DEVREDEN, change: async (h, tag) => h.buy(tag, "2026-03-20", 500), mar: [0, 0, 90000], note: STALE_TEXT, aprFis: [80000, 20000, 0], apr: [80000, 20000, 0], mismatch: null, total: [0, 20000, 0], h: [120000, 110000], gap: 10000, redo: [[0, 0, 90000], [90000, 10000, 0]], fixed: [0, 10000, 0] },
  { name: "ödenecek · hiçbiri", base: ODENECEK, change: async () => {}, mar: [0, 50000, 0], note: null, aprFis: [0, 20000, 0], apr: [0, 20000, 0], mismatch: null, total: [0, 70000, 0], h: [120000, 50000], redo: [[0, 50000, 0], [0, 20000, 0]] },
  { name: "ödenecek · yalnız 391 arttı (DEĞİŞMEZ)", base: ODENECEK, change: async (h, tag) => h.sell(tag, "2026-03-20", 500), mar: [0, 60000, 0], note: STALE_TEXT, aprFis: [0, 20000, 0], apr: [0, 20000, 0], mismatch: null, total: [0, 80000, 0], h: [130000, 50000], redo: [[0, 60000, 0], [0, 20000, 0]] },
  // Karar dışı (baş mimar okuması: ödenecek yönde DEĞİŞMEZ): ödenecek fişli ay yalnız 391 azalışıyla devredene döner — sonraki aya fişin 0'ı taşınır; Mart–Nisan 391 − 191'den 300 sapar
  // (KULLANICIYA SORULMALI).
  { name: "ödenecek → devreden · yalnız 391 azaldı, yön döndü (DEĞİŞMEZ, karar dışı)", base: ODENECEK, change: async (h, tag, ids) => h.cancel(tag, ids.s800), mar: [0, 0, 30000], note: STALE_TEXT, aprFis: [0, 20000, 0], apr: [0, 20000, 0], mismatch: null, total: [0, 20000, 0], h: [40000, 50000], gap: 30000, redo: [[0, 0, 30000], [30000, 0, 10000]], fixed: [0, 0, 10000] },
];

describe("2.5.1 M1 küçük tur 3 — tutarlılık tablosu: hiçbiri / yalnız azalma / yalnız 391 (iki yönde, yön dönmesi) / ikisi birden / İ arttı (her biri ayrı şirkette)", () => {
  const pairs = [];
  for (let i = 0; i < ROWS.length; i += 2) pairs.push(ROWS.slice(i, i + 2));
  for (const pair of pairs) {
    describe(pair.map(row => row.name).join(" + "), () => {
      let h;
      before(async () => {
        h = await program("2026-05-20T12:00:00+03:00", "YT");
        for (const [index, row] of pair.entries()) {
          const tag = index ? "002" : "001";
          const ids = await row.base(h, tag);
          await row.change(h, tag, ids);
          await h.sell(tag, "2026-04-10", ids.april);
          assert.deepEqual(await h.offset(tag, "2026-04"), row.aprFis, `${row.name}: Nisan fişi`);
        }
        await integrityOk(h.api, "veri girildi");
      });
      after(() => h?.ctx.server.close());
      for (const [index, row] of pair.entries()) {
        const tag = index ? "002" : "001";
        it(`${tag} ${row.name}: Mart ${JSON.stringify(row.mar)}, Nisan ${JSON.stringify(row.apr)}, Mart–Nisan ${JSON.stringify(row.total)}${row.gap ? ` (391 − 191'den ${row.gap / 100} sapar — sabitlendi)` : " = 391 − 191"}; onarım`, async () => {
          const mar = await h.report(tag, monthRange("2026-03"), `${row.name} Mart`);
          assert.deepEqual(mar.three, row.mar, `${row.name}: Mart ${JSON.stringify(mar.data.summary)}`);
          if (row.note) assert.equal(mar.summary[CHANGED], `Mart 2026 ${row.note}`, `${row.name}: Mart notu`);
          else assert.ok(!(CHANGED in mar.summary), `${row.name}: Mart notsuz ${JSON.stringify(mar.data.summary)}`);
          const apr = await h.report(tag, monthRange("2026-04"), `${row.name} Nisan`);
          assert.deepEqual(apr.three, row.apr, `${row.name}: Nisan ${JSON.stringify(apr.data.summary)}`);
          if (row.mismatch) assert.equal(apr.summary[MISMATCH], mismatchOf("Nisan 2026", ...row.mismatch), `${row.name}: Nisan uyuşmazlık notu`);
          else assert.ok(!(MISMATCH in apr.summary), `${row.name}: Nisan fişi zincirde ${JSON.stringify(apr.data.summary)}`);
          const both = await h.report(tag, { from: "2026-03-01", to: "2026-04-30" }, `${row.name} Mart–Nisan`);
          assert.deepEqual(both.three, row.total, `${row.name}: Mart–Nisan ${JSON.stringify(both.data.summary)}`);
          assert.deepEqual([both.h391, both.h191], row.h, `${row.name}: 391 / 191`);
          if (row.gap) assert.equal(both.three[1] - both.three[2] + both.three[0] - (both.h391 - both.h191), row.gap, `${row.name}: 391 − 191'den sapma (sabitlendi)`);
          else balanced(both, row.name);
          assert.deepEqual(await h.preview(tag, "2026-04"), row.aprFis, `${row.name}: Nisan ön izlemesi = fiş (DEĞİŞMEDİ)`);
          await h.reverse(tag, "2026-04");
          await h.reverse(tag, "2026-03");
          const redo = [await h.offset(tag, "2026-03"), await h.offset(tag, "2026-04")];
          assert.deepEqual(redo, row.redo, `${row.name}: onarımda kesilen fişler`);
          const fixed = await h.report(tag, { from: "2026-03-01", to: "2026-04-30" }, `${row.name} onarım`);
          assert.deepEqual(fixed.three, row.fixed || row.total, `${row.name}: onarımdan sonra ${row.fixed ? "fişlerin toplamı" : "aynı toplam"}`);
          balanced(fixed, `${row.name} onarım`);
          assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), `${row.name}: onarımdan sonra not yok`);
        });
      }
    });
  }
});

describe("2.5.1 M1 küçük tur 3 — zincirde: arada mahsupsuz ay; karma ay + sonraki ayda yalnız 391 (iki şirket)", () => {
  let h;
  before(async () => {
    h = await program("2026-07-05T12:00:00+03:00", "YZ");
    // 001 — Mart fişi devreden 800, Mart satış KDV +100; Nisan satış KDV 300 (MAHSUPSUZ); Mayıs satış KDV 1.000 → Mayıs fişi (defterin 800'üyle) 200.
    await h.buy("001", "2026-03-05", 5000);
    await h.sell("001", "2026-03-10", 1000);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 0, 80000], "001 Mart fişi devreden 800");
    await h.sell("001", "2026-03-20", 500);
    await h.sell("001", "2026-04-10", 1500);
    await h.sell("001", "2026-05-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-05"), [80000, 20000, 0], "001 Mayıs fişi 200 (defterin 800'üyle; Nisan mahsupsuz)");
    // 002 — Ocak satış KDV 1.000 + 100, alış 300 + 200 → Ocak fişi 600; sonra Ocak alış 200 ve satış 100 İptal Et (KARMA); Şubat alış KDV 1.000, satış 200 + 100 → Şubat fişi
    // (S4 −200 ile) devreden 500; Mart satış KDV 1.000; Şubat satış 100 İptal Et (YALNIZ 391, devreden yönde); Mart fişi (defterin 500'üyle) 500.
    await h.sell("002", "2026-01-05", 5000);
    const s2 = await h.sell("002", "2026-01-06", 500);
    await h.buy("002", "2026-01-10", 1500);
    const b200 = await h.buy("002", "2026-01-11", 1000);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 60000, 0], "002 Ocak fişi 600");
    await h.cancel("002", b200);
    await h.cancel("002", s2);
    await h.buy("002", "2026-02-05", 5000);
    await h.sell("002", "2026-02-10", 1000);
    const s3 = await h.sell("002", "2026-02-11", 500);
    assert.deepEqual(await h.offset("002", "2026-02"), [0, 0, 50000], "002 Şubat fişi devreden 500 (300 − (1.000 − 200))");
    await h.sell("002", "2026-03-10", 5000);
    await h.cancel("002", s3);
    assert.deepEqual(await h.offset("002", "2026-03"), [50000, 50000, 0], "002 Mart fişi 500 (defterin 500'üyle)");
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 arada mahsupsuz ay: Mart sonraki 700 → Nisan 700 devredenle sonraki 400 → Mayıs 400 devredenle 600 + uyuşmazlık; Mart–Mayıs 600 = 391 − 191; 'Mahsup Edilmemiş Ay' Nisan", async () => {
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan");
    assert.deepEqual(apr.three, [70000, 0, 40000], `Nisan: 300 − 700 → sonraki 400 (taban 800 → 500) ${JSON.stringify(apr.data.summary)}`);
    const may = await h.report("001", monthRange("2026-05"), "001 Mayıs");
    assert.deepEqual(may.three, [40000, 60000, 0], `Mayıs: 1.000 − 400 = 600 (taban 500 / 500) ${JSON.stringify(may.data.summary)}`);
    assert.equal(may.summary[MISMATCH], mismatchOf("Mayıs 2026", "800,00 TL", "400,00 TL"), "Mayıs uyuşmazlık notu");
    const all = await h.report("001", { from: "2026-03-01", to: "2026-05-31" }, "001 Mart–Mayıs");
    assert.deepEqual(all.three, [0, 60000, 0], `Mart–Mayıs 600 (taban 500) ${JSON.stringify(all.data.summary)}`);
    assert.deepEqual([all.h391, all.h191], [160000, 100000], "391 1.600, 191 1.000");
    balanced(all, "001 Mart–Mayıs");
    assert.deepEqual(
      all.lines,
      [["Mart 2026", "Sonraki Döneme Devreden KDV", 70000], ["Nisan 2026", "Önceki Dönemden Devreden KDV", 70000], ["Nisan 2026", "Sonraki Döneme Devreden KDV", 40000], ["Mayıs 2026", "Önceki Dönemden Devreden KDV", 40000], ["Mayıs 2026", "Ödenecek KDV", 60000]],
      "ay satırları",
    );
    assert.ok(String(all.summary[PENDING] || "").startsWith("Nisan 2026 ("), `Mahsup Edilmemiş Ay: Nisan (${all.summary[PENDING]})`);
    assert.equal(all.summary[CHANGED], `Mart 2026 ${STALE_TEXT}`, "Mart notu");
    assert.deepEqual(await h.preview("001", "2026-05"), [80000, 20000, 0], "Mayıs ön izlemesi (DEĞİŞMEDİ)");
    await h.sameFiles("001", { from: "2026-03-01", to: "2026-05-31" }, "001 Mart–Mayıs");
  });

  it("002 karma ay + sonraki ayda yalnız 391: Ocak 500 (karma), Şubat sonraki 600 (bugünkü), Mart 600 devredenle 400 + uyuşmazlık; Ocak–Mart 900 = 391 − 191; onarımda aynı", async () => {
    assert.deepEqual(await h.offsets("002"), [["2026-01", 0, 60000, 0, true], ["2026-02", 0, 0, 50000, true], ["2026-03", 50000, 50000, 0, false]], "002 fişler (veri tabanı)");
    const all = await h.report("002", { from: "2026-01-01", to: "2026-03-31" }, "002 Ocak–Mart");
    assert.deepEqual(all.three, [0, 90000, 0], `Ocak–Mart 900 (taban 1.000) ${JSON.stringify(all.data.summary)}`);
    assert.deepEqual([all.h391, all.h191], [220000, 130000], "391 2.200, 191 1.300");
    balanced(all, "002 Ocak–Mart");
    assert.deepEqual(all.lines, [["Ocak 2026", "Ödenecek KDV", 50000], ["Şubat 2026", "Sonraki Döneme Devreden KDV", 60000], ["Mart 2026", "Önceki Dönemden Devreden KDV", 60000], ["Mart 2026", "Ödenecek KDV", 40000]], "ay satırları");
    assert.equal(all.summary[CHANGED], `Şubat 2026 ${STALE_TEXT}; Ocak 2026 ${MIXED_TEXT}`, "notlar: Şubat güncel değil, Ocak karma");
    assert.equal(all.summary[MISMATCH], mismatchOf("Mart 2026", "500,00 TL", "600,00 TL"), "Mart uyuşmazlık notu");
    await h.sameFiles("002", { from: "2026-01-01", to: "2026-03-31" }, "002 Ocak–Mart");
    // Onarım: Mart, Şubat, Ocak geri alınır; sırayla → Ocak 700, Şubat devreden 800, Mart 800 devredenle 200 (toplam 900).
    await h.reverse("002", "2026-03");
    await h.reverse("002", "2026-02");
    await h.reverse("002", "2026-01");
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 70000, 0], "Ocak yeniden 700");
    assert.deepEqual(await h.offset("002", "2026-02"), [0, 0, 80000], "Şubat yeniden devreden 800");
    assert.deepEqual(await h.offset("002", "2026-03"), [80000, 20000, 0], "Mart yeniden 200");
    const fixed = await h.report("002", { from: "2026-01-01", to: "2026-03-31" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 90000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), "notlar kalkar");
    await integrityOk(h.api, "002 onarım");
  });
});

describe("2.5.1 M1 küçük tur 3 — S4 taşımalı karma (baş mimar kararı: önceki fişli ayın azalması bu aya taşınmış + bu ayın 391'i değişmiş) — elle hesap, tek okuma", () => {
  let h;
  before(async () => {
    h = await program("2026-05-05T12:00:00+03:00", "YS");
    // Ocak satış KDV 1.000, alış 300 + 200 → Ocak fişi 500; Şubat satış KDV 700 + 100, alış 300 → Şubat fişi 500; Mart satış KDV 500, alış 100 (MAHSUPSUZ).
    // Sonra: Ocak alış 200 İptal Et (Ocak'ın KENDİ İ'si azaldı — S-DKM1-1 = A; azalma S4 ile Şubat'a taşınır) + Şubat satış 100 İptal Et (Şubat'ın 391'i değişti).
    await h.sell("001", "2026-01-05", 5000);
    await h.buy("001", "2026-01-10", 1500);
    const b200 = await h.buy("001", "2026-01-11", 1000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 50000, 0], "Ocak fişi 500");
    await h.sell("001", "2026-02-05", 3500);
    const s100 = await h.sell("001", "2026-02-06", 500);
    await h.buy("001", "2026-02-10", 1500);
    assert.deepEqual(await h.offset("001", "2026-02"), [0, 50000, 0], "Şubat fişi 500");
    await h.sell("001", "2026-03-05", 2500);
    await h.buy("001", "2026-03-10", 500);
    await h.cancel("001", b200);
    await h.cancel("001", s100);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  // ELLE: Ocak — kendi İ'si 500 → 300 azaldı, 391 aynı → sonuç fişten 500 (S-DKM1-1 = A). Şubat — İ (kendi 300 + S4 −200 = 100) fişin 300'ünden az ve 391 800 → 700 değişti:
  // karma (S-M1K-1 = A) → İ fişten 300, 391 bugünkü 700 → 400. Mart — S4 −200 (Ocak'ın azalması, Şubat fişinden sonra girildi — sonraki mahsupta) → İ 100 − 200 = −100 → 600.
  // Ocak–Şubat 900 (391 1.700 − 191 600 = 1.100'den 200 eksik — azalma Mart'ta düşülür); Ocak–Mart 1.500 = 391 2.200 − 191 700 (her değişiklik bir kez). İkinci okuma ('Şubat'ın
  // kendi İ'si değişmedi → yalnız 391, bugünkü kayıtlardan 700 − 100 = 600') azalmayı Şubat'ta ve Mart'ın mahsubunda (ön izleme / fiş −200 düşer) İKİ kez sayar (Ocak–Mart 1.700 ≠
  // 391 − 191) — karar metniyle çelişir; tek okuma bu.
  it("Ocak 500 (fişten, azalan ay notu), Şubat 400 (karma), Mart 600 (S4 −200); Ocak–Şubat 900, Ocak–Mart 1.500 = 391 − 191; Mart fişi = rapor; onarımda toplam aynı", async () => {
    const all = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "Ocak–Mart");
    assert.deepEqual(all.lines, [["Ocak 2026", "Ödenecek KDV", 50000], ["Şubat 2026", "Ödenecek KDV", 40000], ["Mart 2026", "Ödenecek KDV", 60000]], `ay satırları ${JSON.stringify(all.data.summary)}`);
    assert.deepEqual(all.three, [0, 150000, 0], "Ocak–Mart 1.500");
    assert.deepEqual([all.h391, all.h191], [220000, 70000], "391 2.200, 191 700");
    balanced(all, "Ocak–Mart");
    assert.equal(all.summary[CHANGED], `Şubat 2026 ${MIXED_TEXT}; Ocak 2026 ${REDUCED_TEXT}`, "notlar: Şubat karma, Ocak azalan ay");
    const two = await h.report("001", { from: "2026-01-01", to: "2026-02-28" }, "Ocak–Şubat");
    assert.deepEqual(two.three, [0, 90000, 0], "Ocak–Şubat 900");
    assert.equal(two.h391 - two.h191 - two.three[1], 20000, "Ocak–Şubat: 391 − 191'den 200 eksik — Ocak'ın azalması Mart'ın mahsubunda düşülür");
    assert.deepEqual((await h.report("001", monthRange("2026-02"), "Şubat")).three, [0, 40000, 0], "Şubat 400");
    assert.deepEqual(await h.preview("001", "2026-03"), [0, 60000, 0], "Mart ön izlemesi 600 (S4 −200)");
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 60000, 0], "Mart fişi 600");
    const after3 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "Ocak–Mart (Mart fişli)");
    assert.deepEqual(after3.three, [0, 150000, 0], "Mart fişinden sonra da 1.500");
    assert.ok(!(MISMATCH in after3.summary), "Mart fişi zincirde");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-03-31" }, "Ocak–Mart");
    // Onarım: Mart, Şubat, Ocak geri alınır; sırayla → Ocak 700, Şubat 400, Mart 400 (toplam 1.500).
    await h.reverse("001", "2026-03");
    await h.reverse("001", "2026-02");
    await h.reverse("001", "2026-01");
    const redo = [await h.offset("001", "2026-01"), await h.offset("001", "2026-02"), await h.offset("001", "2026-03")];
    assert.deepEqual(redo, [[0, 70000, 0], [0, 40000, 0], [0, 40000, 0]], "onarım fişleri 700 / 400 / 400");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "onarım");
    assert.deepEqual(fixed.three, [0, 150000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary), "not kalkar");
    await integrityOk(h.api, "onarım");
  });
});
