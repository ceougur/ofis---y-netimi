// 2.5.1 M1 küçük tur 5 — KDV Özeti RASTGELE SIRA değişmez kuralı (S-DKM1K-1 = A; S-M1K3-1 = A "aralık toplamı her durumda 391 − 191"; S-DKM1-1 = A "azalma sonraki ayda").
//   Düzen KDV Özeti tek dar kontrolünün s2-rastgele / s2b-yil-donumu betikleriyle AYNI (aynı üreteç, aynı tohum → aynı veri): altı ayda rastgele satış / alış, rastgele önek
//   mahsup (ara sıra ay atlanır — zincirle uyuşmayan fiş), fişlerden SONRA rastgele değişiklik (alış ekle = İndirilecek KDV artışı → 'güncel değil'; alış İptal Et = İ azalması;
//   satış İptal Et = 391 azalması), yedinci ayda her zaman fişsiz satış (azalmanın düşüleceği sonraki ay).
//   DEĞİŞMEZ (her tohumda; ilk aydan önce KDV hareketi yok, son ay fişsiz): aralığın Ödenecek − Sonraki + Önceki = 391 − 191; ayların Ödenecek toplamı = aralığın Ödenecek'i;
//   ay zinciri sürekli (bir ayın Sonraki'si = sonraki ayın Önceki'si; ilk ayın Önceki'si = aralığın, son ayın Sonraki'si = aralığın). Tek ay aralığında 391 − 191 aranmaz:
//   azalan ayın sonucu fişten, azalma sonraki ayda (S-DKM1-1 = A) — kural ancak azalmanın düşüldüğü ayı içeren aralıkta geçerli.
//   Taban (t251-m1k4): Ocak–Temmuz 300 tohumda 11 sapma (hepsi eksi — 'güncel değil' ayın artışı sonraki azalmayı götürüyordu; ör. tohum 230 −300), yıl dönümü 150 tohumda 2
//   (küçük tur 5'in tohum formülüyle; küçük tur 6'dan beri yıl dönümü seti ayrı formülle — t251-m1k4'teki sayısı docs/kanit/2026-11-28/m1k6-* altında).
//   2.5.1 M1 küçük tur 8 (mali müşavir S ORTA-1; aynı sınıf dar kontrol tur 6 + 7 tohum 86): DEĞİŞMEZ 'kayıtsız ay raporu = ön izleme' — 391 / 191 satırı ve etkin fişi olmayan
//   her ay (aralığın ayları + bugünkü ay) için tek ay raporu o ayın mahsup ön izlemesine eşittir; ayrılıyorsa raporda açıklayan not ('Mahsup Edilmemiş Ay', 'Zincirle Uyuşmayan
//   Mahsup Fişi', 'Güncel Olmayan Önceki Fiş') vardır. İkinci evre (yalnız ilk evreden SONRA, üretecin önceki sayılarını değiştirmez): bütün fişler geri alınır, aylar sırayla
//   yeniden mahsup edilir, sonra 1–2 değişiklik (çoğu alış İptal Et — azalış bugünkü kayıtsız ayda düşülür); kayıtsız ay değişmezi ve bugünkü ayın sonuna kadarki aralıkta
//   Ödenecek − Sonraki + Önceki = 391 − 191 yeniden denetlenir. Taban (t251-aday-taban) kodunda kırmızı: kayıtsız ay 0 / 0 / 0 ↔ ön izleme, aralık 391 − 191'den eksik.
//   Sahte saat (ders 13): her tohumun sunucusu sabit 'bugün'le açılır. Tohum sayısı KDV_RASTGELE_TOHUM / KDV_RASTGELE_YIL_TOHUM ile ARTIRILABİLİR (alt sınır 300 / 150).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const monthEnd = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const nextMonth = month => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const EXPLAIN = ["Mahsup Edilmemiş Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Güncel Olmayan Önceki Fiş"];
const count = (name, floor) => Math.max(floor, Number(process.env[name]) || floor);

/** Tek şirketli program; sayılar yanıt gövdesinden (ders 3). */
async function program(now, prefix) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  const customer = (await must("müşteri", api.post("/api/workspace/accounts", { name: `${prefix} Müşteri`, type: "customer", registeredOn: "2025-01-01" }))).id;
  const supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: `${prefix} Tedarikçi`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  let n = 0;
  return {
    ctx,
    buy: async (date, net) => (await must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: supplier, issueDate: date, number: `${prefix}-A${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (date, net) => (await must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: customer, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async id => must("İptal Et", api.post(`${INV}/${id}/cancel`, { reason: "Hatalı fatura", force: true })),
    /** Mahsup fişi; ret (ör. hareketsiz ay) üreteçte yazılır, sapma sayılmaz (dar kontrolün düzeni). */
    offset: async month => {
      const r = await api.post(`${TAX}/vat-offset`, { month });
      return r.status === 200 ? JSON.stringify([r.data.offset.carryInMinor, r.data.offset.payableMinor, r.data.offset.carryOutMinor]) : `RED ${r.status}`;
    },
    preview: async month => {
      const p = (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    activeMonths: async () => (await must("fiş listesi", api.get(`${TAX}/vat-offset`))).offsets.filter(item => item.status === "active").map(item => item.month).sort(),
    /** Etkin fişlerin hepsini en yeniden başlayarak geri alır. */
    reverseAll: async () => {
      const list = (await must("fiş listesi", api.get(`${TAX}/vat-offset`))).offsets.filter(item => item.status === "active").sort((a, b) => (a.month < b.month ? 1 : -1));
      for (const item of list) await must(`geri al ${item.month}`, api.post(`${TAX}/vat-offset/${item.id}/reverse`, {}));
    },
    report: async (from, to) => {
      const res = await api.get(`${RC}/kdv-ozeti?from=${from}&to=${to}`);
      assert.equal(res.status, 200, `${from}..${to}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      const summary = Object.fromEntries(res.data.summary);
      return { three: RESULT_LABELS.map(name => minor(summary[name])), h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]), summary };
    },
  };
}

/** Bir tohum: dar kontrolün s2 üreteci AYNEN (sıra ve olasılıklar); dönen değer bozulan kuralların listesi (boşsa TAMAM). */
async function runSeed(seed, { now, months, last, salt = [7919, 17] }) {
  // 2.5.1 M1 küçük tur 6 (baş mimar kararı 28.11 07:40 (1)(d); prensip §4 — yalnız test): yıl dönümü seti AYRI tohum formülüyle (salt) başka veri şekilleri üretir — aynı formülle
  // Ocak–Temmuz setinin verisini aylar kaydırılmış olarak yineliyordu (yeni sınıf katmıyordu). Tohum sayısı ve süre AYNI.
  const rng = (state => () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648))(seed * salt[0] + salt[1]);
  const pick = list => list[Math.floor(rng() * list.length)];
  const h = await program(now, `R${seed}`);
  const log = [];
  try {
    const buys = [];
    const sells = [];
    for (const m of months) {
      const nb = Math.floor(rng() * 3);
      const ns = Math.floor(rng() * 4);
      for (let i = 0; i < ns; i += 1) sells.push([m, await h.sell(`${m}-${String(5 + i).padStart(2, "0")}`, 1000 * (1 + Math.floor(rng() * 10)))]);
      for (let i = 0; i < nb; i += 1) buys.push([m, await h.buy(`${m}-${String(10 + i).padStart(2, "0")}`, 500 * (1 + Math.floor(rng() * 10)))]);
    }
    const upto = Math.floor(rng() * 7);
    for (const m of months.slice(0, upto)) {
      if (rng() < 0.12) {
        log.push(`atla ${m}`);
        continue;
      }
      log.push(`fiş ${m} ${await h.offset(m)}`);
    }
    const changes = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < changes; i += 1) {
      const kind = pick(["addbuy", "cancelbuy", "cancelsell"]);
      if (kind === "addbuy") {
        const m = pick(months);
        await h.buy(`${m}-25`, 500 * (1 + Math.floor(rng() * 6)));
        log.push(`alış ekle ${m}`);
      } else if (kind === "cancelbuy" && buys.length) {
        const [m, id] = buys.splice(Math.floor(rng() * buys.length), 1)[0];
        await h.cancel(id);
        log.push(`alış iptal ${m}`);
      } else if (kind === "cancelsell" && sells.length) {
        const [m, id] = sells.splice(Math.floor(rng() * sells.length), 1)[0];
        await h.cancel(id);
        log.push(`satış iptal ${m}`);
      }
    }
    await h.sell(`${last}-05`, 500);
    const all = [...months, last];
    const range = await h.report(`${all[0]}-01`, monthEnd(last));
    const each = [];
    for (const m of all) each.push(await h.report(`${m}-01`, monthEnd(m)));
    const broken = [];
    const balance = range.three[1] - range.three[2] + range.three[0];
    if (balance !== range.h391 - range.h191) broken.push(`Ödenecek − Sonraki + Önceki ${balance} ≠ 391 − 191 ${range.h391 - range.h191} (fark ${balance - (range.h391 - range.h191)}; aralık ${range.three.join(" / ")})`);
    const sum = each.reduce((total, r) => total + r.three[1], 0);
    if (sum !== range.three[1]) broken.push(`ayların Ödenecek toplamı ${sum} ≠ aralığın ${range.three[1]}`);
    if (each[0].three[0] !== range.three[0]) broken.push(`ilk ayın Önceki'si ${each[0].three[0]} ≠ aralığın ${range.three[0]}`);
    if (each.at(-1).three[2] !== range.three[2]) broken.push(`son ayın Sonraki'si ${each.at(-1).three[2]} ≠ aralığın ${range.three[2]}`);
    for (let i = 1; i < each.length; i += 1) if (each[i - 1].three[2] !== each[i].three[0]) broken.push(`${all[i - 1]} Sonraki ${each[i - 1].three[2]} ≠ ${all[i]} Önceki ${each[i].three[0]}`);
    // Küçük tur 8: kayıtsız ay raporu = ön izleme (ayrılıyorsa açıklayan not var). Bugünkü ay (last'tan sonraki) her zaman kayıtsız.
    const current = nextMonth(last);
    const quiet = async phase => {
      const active = new Set(await h.activeMonths());
      for (const m of [...all, current]) {
        const r = await h.report(`${m}-01`, monthEnd(m));
        if (r.h391 !== 0 || r.h191 !== 0 || active.has(m)) continue;
        const p = await h.preview(m);
        const explained = EXPLAIN.some(key => key in r.summary);
        if (!explained && JSON.stringify(r.three) !== JSON.stringify(p)) broken.push(`${phase} kayıtsız ${m}: rapor ${r.three.join(" / ")} ≠ ön izleme ${p.join(" / ")} (açıklayan not yok)`);
      }
    };
    await quiet("1. evre");
    // İkinci evre: sırayla yeniden mahsup + mahsuptan sonra değişiklik (çoğu alış İptal Et).
    await h.reverseAll();
    for (const m of all) log.push(`2. evre fiş ${m} ${await h.offset(m)}`);
    const later = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < later; i += 1) {
      if (rng() < 0.75 && buys.length) {
        const [m, id] = buys.splice(Math.floor(rng() * buys.length), 1)[0];
        await h.cancel(id);
        log.push(`2. evre alış iptal ${m}`);
      } else if (sells.length) {
        const [m, id] = sells.splice(Math.floor(rng() * sells.length), 1)[0];
        await h.cancel(id);
        log.push(`2. evre satış iptal ${m}`);
      }
    }
    await quiet("2. evre");
    const whole = await h.report(`${all[0]}-01`, monthEnd(current));
    const balance2 = whole.three[1] - whole.three[2] + whole.three[0];
    if (balance2 !== whole.h391 - whole.h191) broken.push(`2. evre ${all[0]}..${current}: Ödenecek − Sonraki + Önceki ${balance2} ≠ 391 − 191 ${whole.h391 - whole.h191} (aralık ${whole.three.join(" / ")})`);
    return broken.length ? [`tohum ${seed}: ${broken.join("; ")} | ${log.join("; ")}`] : [];
  } finally {
    await h.ctx.server.close();
  }
}

async function runAll(seeds, shape) {
  const failures = [];
  for (let seed = 1; seed <= seeds; seed += 1) failures.push(...(await runSeed(seed, shape)));
  return failures;
}

describe("2.5.1 M1 küçük tur 5 — KDV Özeti rastgele sıra: aralık toplamı 391 − 191 (S-DKM1K-1 = A)", () => {
  it(`Ocak–Temmuz 2026, ${count("KDV_RASTGELE_TOHUM", 300)} tohum: sapma 0 (taban t251-m1k4: 11)`, async () => {
    const seeds = count("KDV_RASTGELE_TOHUM", 300);
    const failures = await runAll(seeds, { now: "2026-08-15T12:00:00+03:00", months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], last: "2026-07" });
    assert.deepEqual(failures, [], `${seeds} tohumda ${failures.length} sapma:\n${failures.join("\n")}`);
  });
  it(`yıl dönümü Eylül 2026 – Mart 2027, ${count("KDV_RASTGELE_YIL_TOHUM", 150)} tohum: sapma 0 (taban t251-m1k4: 2)`, async () => {
    const seeds = count("KDV_RASTGELE_YIL_TOHUM", 150);
    const failures = await runAll(seeds, { now: "2027-04-15T12:00:00+03:00", months: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"], last: "2027-03", salt: [104729, 613] });
    assert.deepEqual(failures, [], `${seeds} tohumda ${failures.length} sapma:\n${failures.join("\n")}`);
  });
});
