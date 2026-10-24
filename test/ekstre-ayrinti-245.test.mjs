// 2.4.5 madde 6d (müşteri isteği M2) — Ayrıntılı Cari Ekstre: Cari Ekstre'nin "Fatura Kalemlerini Göster" seçeneği (Rapor Merkezi cari-ekstre, items=1).
// Nasıl bozulur listesi: not defteri 245-ekstre-ayrinti/NASIL-BOZULUR.md (11 madde); denetimler buradan çıkar.
//   K  (kâhin)   : bağımsız defter kâhininin senaryosu (test/bagimsiz/defter/senaryo.json: satış, alış, satır iskontosu, KDV dahil fiyat, tevkifat, kira
//                  stopajı, satıştan / alıştan iade, iptal, nakit / havale / POS tahsilat, kart / havale ödeme, çek, senet, ciro, karşılıksız, taksitli
//                  satış) programa API'den girilir; her carinin Ayrıntılı Ekstre'sinin Genel Toplam bakiyesi = kahin.py'nin cari bakiyesi (kâhin kodu
//                  GÖRMEDEN TDHP'den kurar; bu test kâhine dokunmaz, yalnız çıktısını okur). Ayrıca dönem sınırı: devir + dönem = kâhin.
//   T  (tutarlık): her faturanın kalem satırlarının Toplam'ı (− tevkifat − stopaj) = faturanın defterdeki Borç / Alacak'ı; hareket satırlarının
//                  Borç / Alacak'ı = seçenek kapalı ekstreninkiyle aynı satırlar; Dönem Toplamı / Genel Toplam = satırların toplamı.
//   B  (belge)   : genel iskonto, SMM stopajı, taslak (görünmez), iptal (görünmez), Düzenle (güncel kalem), aynı adlı iki cari, 002 şirketi.
//   E  (çıktı)   : ekran = PDF = Excel (aynı satırlar, aynı sayılar). Y (yetki): Finans Raporları olmayan 403 (seçenek kapalıyla aynı).
//   G  (geri uyum): seçenek kapalıyken başlıklar, satırlar, özet ve TOPLAM bugünkü gibi; rowMarks dönmez.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SENARYO = path.join(HERE, "bagimsiz", "defter", "senaryo.json");
const KAHIN = path.join(HERE, "bagimsiz", "defter", "kahin.py");
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const LICENSE = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };

// ---------- yardımcılar ----------
const kurus = text => {
  const raw = String(text ?? "").replace(/−/g, "-").trim();
  const match = /^(-?)([\d.]+),(\d{2}) TL( [BA])?$/.exec(raw);
  if (!match) return null;
  const value = Number(`${match[2].replace(/\./g, "")}${match[3]}`) * (match[1] ? -1 : 1);
  return match[4] === " A" ? -value : value;
};
const H = {};
const col = (headers, name) => {
  const index = headers.indexOf(name);
  assert.ok(index >= 0, `kolon yok: ${name} (${headers.join(", ")})`);
  return index;
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
async function must(label, promise) {
  const r = await promise;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
  return unwrap(r);
}

/** Ayrıntılı ekstrenin tutarlık denetimi (T): kalem toplamı = fatura satırı; satır toplamları = TOPLAM satırları; hareketler = seçenek kapalı ekstre. */
function assertConsistent(detail, plain, label) {
  const h = detail.headers;
  const [iBorc, iAlacak, iToplam, iBakiye, iAcik] = ["Borç", "Alacak", "Toplam", "Bakiye", "Açıklama / Ürün - Hizmet"].map(name => col(h, name));
  assert.equal(detail.rowMarks?.length, detail.rows.length, `${label}: rowMarks her satırda`);
  let invoices = 0;
  for (let index = 0; index < detail.rows.length; index += 1) {
    if (detail.rowMarks[index] !== "invoice") continue;
    invoices += 1;
    const row = detail.rows[index];
    let sum = 0;
    let items = 0;
    for (let next = index + 1; next < detail.rows.length && detail.rowMarks[next] === "item"; next += 1) {
      const value = kurus(detail.rows[next][iToplam]);
      if (value !== null) sum += value;
      if (String(detail.rows[next][iAcik]).startsWith("› ") && detail.rows[next][col(h, "Miktar")]) items += 1;
    }
    assert.ok(items > 0, `${label}: ${row[col(h, "Belge No")]} kalemsiz`);
    const amount = kurus(row[iBorc]) ?? kurus(row[iAlacak]);
    assert.equal(sum, amount, `${label}: ${row[col(h, "Belge No")]} (${row[col(h, "İşlem")]}) kalem toplamı ${sum} ≠ defter ${amount}`);
  }
  // Hareket satırları (kalem dışı) seçenek kapalı ekstreyle aynı sıra, aynı Borç / Alacak / Bakiye.
  const moves = detail.rows.filter((_, index) => detail.rowMarks[index] !== "item");
  assert.equal(moves.length, plain.rows.length, `${label}: hareket sayısı (devir dahil)`);
  const ph = plain.headers;
  moves.forEach((row, index) => {
    const other = plain.rows[index];
    assert.equal(row[iBakiye], other[col(ph, "Bakiye")], `${label}: ${index}. satır bakiye`);
    if (index === 0) return; // devir: ayrıntılıda Borç/Alacak kolonunda da yazar
    assert.equal(row[iBorc], other[col(ph, "Borç")], `${label}: ${index}. satır borç`);
    assert.equal(row[iAlacak], other[col(ph, "Alacak")], `${label}: ${index}. satır alacak`);
  });
  const sumOf = (rows, index) => rows.reduce((total, row) => total + (kurus(row[index]) || 0), 0);
  const [period, grand] = detail.footers;
  assert.equal(period[iAcik], "DÖNEM TOPLAMI");
  assert.equal(grand[iAcik], "GENEL TOPLAM");
  assert.equal(kurus(period[iBorc]), sumOf(moves.slice(1), iBorc), `${label}: Dönem Toplamı borç`);
  assert.equal(kurus(period[iAlacak]), sumOf(moves.slice(1), iAlacak), `${label}: Dönem Toplamı alacak`);
  assert.equal(kurus(grand[iBorc]), sumOf(moves, iBorc), `${label}: Genel Toplam borç`);
  assert.equal(kurus(grand[iAlacak]), sumOf(moves, iAlacak), `${label}: Genel Toplam alacak`);
  assert.equal(kurus(grand[iBakiye]), kurus(grand[iBorc]) - kurus(grand[iAlacak]), `${label}: Genel Toplam bakiye = borç − alacak`);
  assert.equal(grand[iBakiye], moves.at(-1)[iBakiye], `${label}: Genel Toplam bakiye = son satır bakiyesi`);
  return { invoices, closing: kurus(grand[iBakiye]) };
}

// ---------- K: bağımsız defter kâhininin senaryosu ----------
describe("6d K — kâhin senaryosu: Genel Toplam = kâhinin cari bakiyesi, kalem toplamı = defter", () => {
  const senaryo = JSON.parse(readFileSync(SENARYO, "utf8"));
  let server;
  let api;
  const ids = {};
  const yapilan = [];
  const reddedilen = [];
  const satirKimlikleri = {};
  before(async () => {
    server = await startTestServer({ now: senaryo.simdi, env: LICENSE, startLicenseTimers: false });
    api = server.client();
    assert.equal((await api.login("admin", ADMIN_PASSWORD)).status, 200);
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const tl = x => String(x);
    const gonder = async (o, method, url, body, kimlik = d => d?.id) => {
      const r = method === "GET" ? await api.get(url) : await api[method.toLowerCase()](url, body);
      const data = unwrap(r);
      if (r.status !== 200) {
        reddedilen.push(`${o.id}: ${r.status} ${String(data?.error || "").slice(0, 200)}`);
        return null;
      }
      yapilan.push(o.id);
      const id = kimlik(data);
      if (id) ids[o.id] = id;
      return data;
    };
    // Olay → API çevirisi test/bagimsiz/defter/kos.mjs'tekiyle AYNI (kâhine dokunulmaz; yalnız para/cari etkili olaylar).
    for (const o of senaryo.olaylar) {
      const t = o.tarih;
      switch (o.tur) {
        case "cari": {
          const kisi = o.kisi ? { partyKind: "person", firstName: o.kisi[0], familyName: o.kisi[1] } : {};
          await gonder(o, "POST", "/api/workspace/accounts", { name: o.ad, type: o.tip, registeredOn: "2026-01-01", ...kisi, ...(o.vkn ? { taxNo: o.vkn } : {}), ...(o.tckn ? { taxNo: o.tckn } : {}) });
          break;
        }
        case "urun":
          await gonder(o, "POST", "/api/workspace/stock", { name: o.ad, unit: o.birim, code: o.kod, unitPrice: tl(o.alis), salePrice: tl(o.satis), vatRate: tl(o.kdv), ...(o.acilisMiktar ? { openingQty: tl(o.acilisMiktar), openingDate: o.acilisTarih } : {}) });
          break;
        case "kasa_acilis":
          await gonder(o, "POST", "/api/workspace/cash/opening", { amount: tl(o.tutar), date: t });
          break;
        case "banka_hesap": {
          const d = await gonder(o, "POST", "/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: o.ad, kind: "demand", currency: "TRY", opening: { date: t, amount: tl(o.acilis), confirmed: true } }, d => d?.id || d?.account?.id);
          if (d) await api.put(`/api/workspace/bank/accounts/${ids[o.id]}`, { usePos: true, useCheque: true, useNote: true });
          break;
        }
        case "kart_hesap":
          await gonder(o, "POST", "/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: o.ad, kind: "card", currency: "TRY", creditLimit: tl(o.limit), opening: { date: t, amount: "0", confirmed: true } }, d => d?.id || d?.account?.id);
          break;
        case "pos":
          await gonder(o, "POST", "/api/workspace/bank/pos", { name: "Ziraat POS", bankAccountId: ids[o.banka], providerKind: "bank", tax: "bsmv_incl", valorRule: "same_day", valorDays: 0, installmentPayout: "monthly", refundCommission: "none", provisionDays: 0, validFrom: t, rates: [{ installments: 1, rate: String(o.oran).replace(".", ",") }] }, d => d?.id || d?.pos?.id);
          break;
        case "cari_acilis":
          await gonder(o, "POST", `/api/workspace/accounts/${ids[o.cari]}/entries`, { kind: o.yon === "borc" ? "debt" : "credit", amount: tl(o.tutar), note: o.not || "Açılış bakiyesi", date: t });
          break;
        case "fatura": {
          const kind = { satis: "sale", alis: "purchase", satis_iade: "sale_return", alis_iade: "purchase_return" }[o.fatura];
          const lines = o.asil
            ? o.kalemler.map(k => ({ originLineId: satirKimlikleri[o.asil][k.satir], qty: k.miktar }))
            : o.kalemler.map(k => ({ ...(k.urun ? { itemId: ids[k.urun], goods: true } : {}), name: k.ad || senaryo.olaylar.find(x => x.id === k.urun)?.ad, qty: k.miktar, unitPrice: k.fiyat, discountRate: k.isk || 0, vatRate: k.kdv, ...(k.tevkifat ? { withholdingCode: k.tevkifat } : {}), ...(k.gider ? { expenseCode: k.gider } : {}), ...(k.kdv === 0 ? { exemptionCode: "351" } : {}) }));
          const od = o.odeme || {};
          const payment = o.asil ? {} : od.taksit ? { rest: "installments", installments: { count: od.taksit.sayi, firstDue: od.taksit.ilkVade, everyMonths: 1 } } : { ...(od.nakit ? { cash: [{ amount: od.nakit, method: "cash" }] } : {}), ...(od.havale ? { cash: [{ amount: od.havale, method: "bank", bankAccountId: ids.B }] } : {}), rest: "open" };
          const body = { kind, accountId: ids[o.cari], issueDate: t, lines, payment, ...(o.no ? { number: o.no } : {}), ...(o.asil ? { originalId: ids[o.asil] } : {}), ...(o.kdvDahil ? { pricesIncludeVat: true } : {}), ...(o.stopaj ? { stoppageRate: o.stopaj } : {}), ...(o.fatura === "alis" && !o.kalemler.some(k => k.urun) ? { scenario: "expense_purchase" } : {}), ...(o.eksiStok ? { force: true } : {}) };
          const d = await gonder(o, "POST", "/api/workspace/invoices", body);
          if (d) {
            satirKimlikleri[o.id] = (d.lines || []).map(l => l.id);
            if (d.plan?.id || d.planId) ids[`${o.id}:plan`] = d.plan?.id || d.planId;
          }
          break;
        }
        case "iptal":
          await gonder(o, "POST", `/api/workspace/invoices/${ids[o.fatura]}/cancel`, { reason: "Müşteri vazgeçti" }, () => null);
          break;
        case "tahsilat":
        case "odeme": {
          const yol = { nakit: { method: "cash" }, havale: { method: "bank", bankAccountId: ids.B }, pos: { method: "card", posId: ids.POS, installments: 1 }, kart: { method: "card", bankAccountId: ids.K } }[o.yol];
          await gonder(o, "POST", `/api/workspace/accounts/${ids[o.cari]}/entries`, { kind: o.tur === "tahsilat" ? "in" : "out", amount: tl(o.tutar), ...yol, note: o.id, date: t, similarOk: true }, () => null);
          break;
        }
        case "cek":
          await gonder(o, "POST", "/api/workspace/cheques", { direction: o.yon === "alinan" ? "in" : "out", instrument: o.evrak === "senet" ? "note" : "cheque", serialNo: o.no, bank: "Akbank", drawer: o.cari, accountId: ids[o.cari], amount: tl(o.tutar), issueDate: t, dueDate: o.vade, ...(o.yon === "verilen" ? { bankAccountId: ids.B } : {}) });
          break;
        case "ciro":
          await gonder(o, "POST", `/api/workspace/cheques/${ids[o.cek]}/actions`, { action: "endorse", accountId: ids[o.cari], date: t }, () => null);
          break;
        case "tahsile_ver":
          await gonder(o, "POST", `/api/workspace/cheques/${ids[o.cek]}/actions`, { action: "bank-deposit", bankAccountId: ids.B, date: t }, () => null);
          break;
        case "karsiliksiz":
          await gonder(o, "POST", `/api/workspace/cheques/${ids[o.cek]}/actions`, { action: "bounce", date: t }, () => null);
          break;
        case "supheli":
          await gonder(o, "POST", `/api/workspace/accounts/${ids[o.cari]}/doubtful`, { amount: tl(o.tutar), date: t, reason: "cheque", chequeId: ids[o.cek], note: "Karşılıksız çek" }, d => d?.record?.id || d?.id);
          break;
        case "karsilik": {
          const cariId = ids[senaryo.olaylar.find(x => x.id === o.supheli).cari];
          await gonder(o, "POST", `/api/workspace/accounts/${cariId}/doubtful/${ids[o.supheli]}/provision`, { amount: tl(o.tutar), date: t, note: "Karşılık" }, () => null);
          break;
        }
        case "masraf":
          await gonder(o, "POST", "/api/workspace/bank/vouchers", { type: "fee", accountId: ids.B, date: t, amount: tl(o.tutar).replace(".", ","), tax: "bsmv_incl", taxRate: String(o.bsmvOran), description: o.id, similarOk: true }, () => null);
          break;
        case "faiz_gelir":
          await gonder(o, "POST", "/api/workspace/bank/vouchers", { type: "interest_in", accountId: ids.B, date: t, amount: tl(o.brut), stoppageRate: String(o.stopajOran), description: o.id, similarOk: true }, () => null);
          break;
        case "faiz_gider":
          await gonder(o, "POST", "/api/workspace/bank/vouchers", { type: "interest_out", accountId: ids.B, date: t, amount: tl(o.tutar), taxAmount: tl(o.vergi || 0), description: o.id, similarOk: true }, () => null);
          break;
        case "virman":
          await gonder(o, "POST", "/api/workspace/cash/transfer", { direction: "to-bank", amount: tl(o.tutar), date: t, bankAccountId: ids.B, description: o.id }, () => null);
          break;
        case "kasa_gider":
          await gonder(o, "POST", "/api/workspace/cash", { kind: "out", amount: tl(o.tutar), method: "cash", description: o.id, date: t }, () => null);
          break;
        case "taksit_tahsil":
          await gonder(o, "POST", `/api/workspace/plans/${ids[`${o.fatura}:plan`]}/entries`, { kind: "in", amount: tl(o.tutar), method: o.yol === "nakit" ? "cash" : "bank", date: t }, () => null);
          break;
        case "vergi_odeme":
          await gonder(o, "POST", "/api/workspace/tax/payments", { way: o.yol === "banka" ? "bank" : "cash", ...(o.yol === "banka" ? { accountId: ids.B } : {}), date: o.tarih, taxType: { kdv: "kdv", muhtasar: "muhtasar", diger: "other" }[o.vergiTuru], amount: String(o.tutar), ...(o.gecikmeZammi ? { lateAmount: String(o.gecikmeZammi) } : {}), description: o.aciklama || o.id }, d => d?.card?.id || d?.id);
          break;
        case "kdv_mahsup":
          await gonder(o, "POST", "/api/workspace/tax/vat-offset", { month: o.ay, note: o.id }, d => d?.offset?.id);
          break;
        case "kdv_mahsup_geri_al":
          if (ids[o.mahsup]) await gonder(o, "POST", `/api/workspace/tax/vat-offset/${encodeURIComponent(ids[o.mahsup])}/reverse`, {}, () => null);
          break;
        case "kontrol":
          break;
        default:
          throw new Error(`olay türü bilinmiyor: ${o.tur}`);
      }
    }
  });
  after(async () => server?.app.close());

  const kahin = () => {
    const list = path.join(server.dataDir, "..", "yapilan-6d.json");
    // kahin.py yalnız programın kabul ettiği olaylarla (kos.mjs'teki gibi --yapilan).
    return import("node:fs").then(fs => {
      fs.writeFileSync(list, JSON.stringify(yapilan));
      return JSON.parse(execFileSync(PYTHON, ["-I", KAHIN, SENARYO, "--yapilan", list], { encoding: "utf8" }));
    });
  };
  const accountsByName = async () => {
    const data = await must("cariler", api.get("/api/workspace/accounts?status=all&limit=500"));
    return new Map(data.accounts.map(account => [account.name, account.id]));
  };

  test("K1 ret yok; her carinin Ayrıntılı Ekstre Genel Toplam bakiyesi = kâhin; kalem toplamı = defter", async () => {
    assert.deepEqual(reddedilen, [], "program senaryo olayını reddetti (ders 3)");
    const beklenen = await kahin();
    const names = await accountsByName();
    let invoices = 0;
    for (const [name, balance] of Object.entries(beklenen.cari)) {
      const id = names.get(name);
      assert.ok(id, `cari yok: ${name}`);
      const detail = await must(`${name} ayrıntılı`, api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&preset=all&from=1976-01-01&to=2026-12-31&items=1`));
      const plain = await must(`${name} düz`, api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&preset=all&from=1976-01-01&to=2026-12-31`));
      const result = assertConsistent(detail, plain, name);
      invoices += result.invoices;
      assert.equal(result.closing, balance, `${name}: Genel Toplam ${result.closing} ≠ kâhin ${balance}`);
    }
    // Senaryodaki kesilmiş (iptal edilmemiş) fatura sayısı: kalemleriyle görünen fatura satırları.
    const issued = JSON.parse(readFileSync(SENARYO, "utf8")).olaylar.filter(o => o.tur === "fatura" && yapilan.includes(o.id)).length - JSON.parse(readFileSync(SENARYO, "utf8")).olaylar.filter(o => o.tur === "iptal" && yapilan.includes(o.id)).length;
    assert.equal(invoices, issued, "kalemleriyle görünen fatura satırı = kesilmiş ve iptal edilmemiş fatura");
  });

  test("K2 dönem sınırı: devir (dönem öncesi) + dönem = kâhin; dönem öncesi faturanın kalemi görünmez", async () => {
    const beklenen = await kahin();
    const names = await accountsByName();
    for (const name of ["Alfa Ticaret A.Ş.", "Tedarik Toptan A.Ş.", "Beta Yapı Ltd. Şti."]) {
      const id = names.get(name);
      const before = await must("önce", api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&from=1976-01-01&to=2026-09-30&items=1`));
      const detail = await must("dönem", api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&from=2026-10-01&to=2026-12-31&items=1`));
      const plain = await must("dönem düz", api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&from=2026-10-01&to=2026-12-31`));
      const result = assertConsistent(detail, plain, `${name} Ekim–Aralık`);
      const h = detail.headers;
      const opening = detail.rows[0];
      assert.equal(opening[col(h, "İşlem")], "Devir");
      const devir = (kurus(opening[col(h, "Borç")]) || 0) - (kurus(opening[col(h, "Alacak")]) || 0);
      assert.equal(devir, assertConsistent(before, await must("önce düz", api.get(`/api/workspace/report-center/cari-ekstre?account=${id}&from=1976-01-01&to=2026-09-30`)), `${name} önce`).closing, `${name}: devir = 30.09 bakiyesi`);
      assert.equal(result.closing, beklenen.cari[name], `${name}: dönem Genel Toplam = kâhin`);
      const dates = detail.rows.map(row => row[col(h, "Tarih")]).filter(Boolean).slice(1);
      assert.ok(dates.every(day => /^\d\d\.(1[0-2])\.2026$/.test(day)), `${name}: dönem dışı satır yok (${dates.join(", ")})`);
    }
  });

  test("K3 yol ve belge no: tahsilat Nakit / Havale / EFT / POS, ödeme Kredi Kartı, çek / senet evrak no, fatura numarası", async () => {
    const names = await accountsByName();
    const detail = await must("alfa", api.get(`/api/workspace/report-center/cari-ekstre?account=${names.get("Alfa Ticaret A.Ş.")}&from=1976-01-01&to=2026-12-31&items=1`));
    const h = detail.headers;
    const ways = new Set(detail.rows.map(row => row[col(h, "Yol")]).filter(Boolean));
    for (const way of ["Nakit", "Havale / EFT", "POS", "Çek", "Senet"]) assert.ok(ways.has(way), `Alfa: yol ${way} yok (${[...ways].join(", ")})`);
    const invoiceRows = detail.rows.filter((_, index) => detail.rowMarks[index] === "invoice");
    assert.ok(invoiceRows.every(row => row[col(h, "Belge No")]), "her fatura satırında Belge No");
    assert.ok(invoiceRows.some(row => row[col(h, "İşlem")] === "Satıştan İade Faturası" && kurus(row[col(h, "Alacak")]) > 0), "satıştan iade alacak tarafında");
    const supplier = await must("tedarik", api.get(`/api/workspace/report-center/cari-ekstre?account=${names.get("Tedarik Toptan A.Ş.")}&from=1976-01-01&to=2026-12-31&items=1`));
    assert.ok(supplier.rows.some(row => row[col(h, "Yol")] === "Kredi Kartı"), "kart ödemesi Kredi Kartı");
    const stoppage = await must("kira", api.get(`/api/workspace/report-center/cari-ekstre?account=${names.get("Mehmet Kiraya Veren")}&from=1976-01-01&to=2026-12-31&items=1`));
    assert.ok(stoppage.rows.some(row => /^› Gelir Vergisi Stopajı %20$/.test(row[col(h, "Açıklama / Ürün - Hizmet")]) && kurus(row[col(h, "Toplam")]) < 0), "kira stopajı eksi satır");
    const withholding = await must("tevkifat", api.get(`/api/workspace/report-center/cari-ekstre?account=${names.get("Alfa Ticaret A.Ş.")}&from=2026-09-07&to=2026-09-07&items=1`));
    assert.ok(withholding.rows.some(row => row[col(h, "Açıklama / Ürün - Hizmet")] === "› KDV Tevkifatı" && kurus(row[col(h, "Toplam")]) < 0), "tevkifat eksi satır");
  });
});

// ---------- B / E / Y / G: belge çeşitleri, çıktılar, yetki, geri uyum ----------
describe("6d B/E/Y/G — genel iskonto, SMM, taslak, iptal, Düzenle, aynı ad, 002, PDF/Excel, yetki, seçenek kapalı", () => {
  let server;
  let admin;
  const id = {};
  const sale = (accountId, lines, extra = {}) => ({ kind: "sale", scenario: "service_sale", accountId, issueDate: "2026-11-20", lines, payment: { rest: "open" }, ...extra });
  before(async () => {
    server = await startTestServer({ now: "2026-11-27T12:00:00+03:00", env: LICENSE, startLicenseTimers: false });
    admin = await loginAdmin(server);
    id.a1 = (await must("cari 1", admin.post("/api/workspace/accounts", { name: "Aynı Ad Ticaret", type: "customer", registeredOn: "2026-01-01" }))).id;
    id.a2 = (await must("cari 2", admin.post("/api/workspace/accounts", { name: "Aynı Ad Ticaret", type: "customer", registeredOn: "2026-01-01", phone: "05321112233", similarOk: true }))).id;
    assert.notEqual(id.a1, id.a2);
    // Genel iskonto %10 + satır iskontosu %5, iki kalem.
    id.inv1 = (await must("genel iskontolu", admin.post("/api/workspace/invoices", sale(id.a1, [{ name: "Danışmanlık", qty: 3, unitPrice: 1250.5, discountRate: 5, vatRate: 20, unit: "Saat" }, { name: "Eğitim", qty: 1, unitPrice: 999.99, vatRate: 10 }], { discountRate: 10 })))).id;
    // KDV dahil fiyat + genel iskonto.
    id.inv2 = (await must("kdv dahil", admin.post("/api/workspace/invoices", sale(id.a1, [{ name: "Bakım Paketi", qty: 2, unitPrice: 1000, vatRate: 20 }], { pricesIncludeVat: true, discountRate: 3 })))).id;
    // Başka carinin (aynı ad) faturası: A1'in ekstresinde görünmez.
    id.inv3 = (await must("öbür cari", admin.post("/api/workspace/invoices", sale(id.a2, [{ name: "Öbür Carinin Hizmeti", qty: 1, unitPrice: 500, vatRate: 20 }])))).id;
    // Taslak: görünmez.
    await must("taslak", admin.post("/api/workspace/invoices", { ...sale(id.a1, [{ name: "Taslak Kalemi", qty: 1, unitPrice: 777, vatRate: 20 }]), status: "draft" }));
    // İptal edilen: görünmez.
    id.inv4 = (await must("iptal edilecek", admin.post("/api/workspace/invoices", sale(id.a1, [{ name: "İptal Kalemi", qty: 1, unitPrice: 333, vatRate: 20 }])))).id;
    await must("iptal", admin.post(`/api/workspace/invoices/${id.inv4}/cancel`, { reason: "Vazgeçildi" }));
    // Düzenle: kalem değişir (eski kalem görünmez).
    id.inv5 = (await must("düzenlenecek", admin.post("/api/workspace/invoices", sale(id.a1, [{ name: "Eski Kalem", qty: 1, unitPrice: 100, vatRate: 20 }])))).id;
    await must("düzenle", admin.post(`/api/workspace/invoices/${id.inv5}/edit`, sale(id.a1, [{ name: "Yeni Kalem", qty: 4, unitPrice: 150, vatRate: 20 }])));
    // SMM: stopaj belge düzeyinde.
    const smm = await admin.post("/api/workspace/invoices", { kind: "smm", scenario: "smm", accountId: id.a1, issueDate: "2026-11-21", stoppageRate: 20, lines: [{ name: "Hukuki Danışmanlık", qty: 1, unitPrice: 10000.03, vatRate: 20 }, { name: "Dava Takibi", qty: 1, unitPrice: 10000.03, vatRate: 20 }], payment: { rest: "open" } });
    id.smm = smm.status === 200 ? unwrap(smm).id : `RED ${smm.status} ${JSON.stringify(smm.data).slice(0, 200)}`;
    // Tahsilat (makbuz no Belge No'da).
    await must("tahsilat", admin.post(`/api/workspace/accounts/${id.a1}/entries`, { kind: "in", amount: "1000", method: "cash", date: "2026-11-25", note: "Elden" }));
  });
  after(async () => server?.app.close());
  const get = (query, client = admin) => must(query, client.get(`/api/workspace/report-center/cari-ekstre?${query}`));
  const range = "from=2026-01-01&to=2026-12-31";

  test("B1 genel iskonto, KDV dahil, SMM stopajı: kalem toplamı = defter; taslak / iptal / eski kalem / öbür cari görünmez", async () => {
    assert.ok(!String(id.smm).startsWith("RED"), `SMM reddedildi: ${id.smm}`);
    const detail = await get(`account=${id.a1}&${range}&items=1`);
    const plain = await get(`account=${id.a1}&${range}`);
    const result = assertConsistent(detail, plain, "A1");
    assert.equal(result.invoices, 4, "4 fatura satırı (genel iskontolu, KDV dahil, düzenlenen, SMM)");
    const text = detail.rows.map(row => row.join(" | ")).join("\n");
    for (const hidden of ["Taslak Kalemi", "İptal Kalemi", "Eski Kalem", "Öbür Carinin Hizmeti"]) assert.ok(!text.includes(hidden), `${hidden} görünmemeli`);
    for (const shown of ["› Danışmanlık", "› Eğitim", "› Bakım Paketi", "› Yeni Kalem", "› Hukuki Danışmanlık", "› Genel İskonto %10", "› Genel İskonto %3", "› Gelir Vergisi Stopajı %20"]) assert.ok(text.includes(shown), `${shown} görünmeli`);
    assert.ok(text.includes("fiyatlar KDV dahil"), "KDV dahil fiyat açıklamada");
    const h = detail.headers;
    const yeni = detail.rows.find(row => row[col(h, "Açıklama / Ürün - Hizmet")] === "› Yeni Kalem");
    assert.deepEqual([yeni[col(h, "Miktar")], yeni[col(h, "Birim Fiyat")], yeni[col(h, "KDV'siz Tutar")], yeni[col(h, "KDV %")], yeni[col(h, "Toplam")]], ["4", "150,00 TL", "600,00 TL", "%20", "720,00 TL"]);
    const dan = detail.rows.find(row => row[col(h, "Açıklama / Ürün - Hizmet")] === "› Danışmanlık");
    assert.deepEqual([dan[col(h, "Miktar")], dan[col(h, "Birim")], dan[col(h, "Birim Fiyat")], dan[col(h, "İsk. %")]], ["3", "Saat", "1.250,50 TL", "%5"]);
    assert.ok(detail.rows.some(row => row[col(h, "Belge No")] === "Makbuz 1" && row[col(h, "Yol")] === "Nakit"), "tahsilat makbuz no + yol");
    // Öbür aynı adlı carinin ekstresi yalnız kendi faturası.
    const other = await get(`account=${id.a2}&${range}&items=1`);
    const otherText = other.rows.map(row => row.join(" | ")).join("\n");
    assert.ok(otherText.includes("› Öbür Carinin Hizmeti") && !otherText.includes("› Danışmanlık"), "aynı ad: kalemler kendi carisinin");
  });

  test("E1 ekran = PDF = Excel: aynı satırlar, aynı Dönem Toplamı / Genel Toplam", async () => {
    const query = `account=${id.a1}&${range}&items=1`;
    const screen = await get(query);
    const xlsx = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/xlsx?${query}`);
    assert.equal(xlsx.status, 200);
    const sheet = xlsxRows(xlsx.buffer);
    const headerAt = sheet.findIndex(row => row[0] === "Tarih" && row.includes("Açıklama / Ürün - Hizmet"));
    assert.ok(headerAt >= 0, "Excel başlık satırı");
    assert.deepEqual(sheet[headerAt], screen.headers);
    const body = sheet.slice(headerAt + 1);
    // Excel tarihleri seri sayı, tutarlar sayı yazar (Bakiye "… TL B" metin kalır); iki yan aynı biçime çevrilip karşılaştırılır (kuruş, gg.aa.yyyy).
    const serialDay = n => new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10).split("-").reverse().join(".");
    const canon = (cell, index) => {
      if (typeof cell === "number") return screen.headers[index] === "Tarih" ? serialDay(cell) : screen.types[index] === "money" || screen.headers[index] === "Bakiye" ? String(Math.round(cell * 100)) : String(cell);
      const value = kurus(cell);
      if (value !== null) return String(value);
      const text = String(cell ?? "");
      if (/^%\d+(,\d+)?$/.test(text)) return String(Number(text.slice(1).replace(",", ".")) / 100);
      if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(text) && screen.types[index] === "number") return String(Number(text.replace(/\./g, "").replace(",", ".")));
      return text;
    };
    const expected = [...screen.rows, ...screen.footers];
    assert.equal(body.length, expected.length, "Excel satır sayısı = ekran satırı + 2 TOPLAM");
    expected.forEach((row, index) => assert.deepEqual(screen.headers.map((_, at) => canon(body[index][at], at)), row.map(canon), `Excel ${index}. satır`));
    const pdf = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?${query}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const needle of ["Ayrıntılı Cari Ekstre", "› Danışmanlık", "› Gelir Vergisi Stopajı %20", "DÖNEM TOPLAMI", "GENEL TOPLAM", ...screen.footers[1].filter(Boolean)]) assert.ok(text.includes(needle), `PDF: ${needle}`);
  });

  test("Y1 Finans Raporları yetkisi olmayan: seçenek açık da kapalı da 403", async () => {
    const staff = await createUser(server, admin, { username: "personel6d", role: "personel" });
    const on = await staff.get(`/api/workspace/report-center/cari-ekstre?account=${id.a1}&${range}&items=1`);
    const off = await staff.get(`/api/workspace/report-center/cari-ekstre?account=${id.a1}&${range}`);
    assert.equal(off.status, 403);
    assert.equal(on.status, off.status);
  });

  test("G1 seçenek kapalı: bugünkü ekstre (6 kolon, rowMarks yok, tek TOPLAM, aynı özet)", async () => {
    const plain = await get(`account=${id.a1}&${range}`);
    assert.deepEqual(plain.headers, ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"]);
    assert.equal(plain.title, "Cari Ekstre · Aynı Ad Ticaret");
    assert.equal(plain.rowMarks, undefined);
    assert.equal(plain.footers.length, 1);
    assert.equal(plain.footers[0][0], "TOPLAM");
    assert.deepEqual(plain.summary.map(([label]) => label), ["Devir", "Dönem Borç", "Dönem Alacak", "Dönem Sonu"]);
    assert.equal(plain.query.items, undefined);
    const catalog = await must("katalog", admin.get("/api/workspace/report-center"));
    assert.deepEqual(catalog.reports.find(report => report.id === "cari-ekstre").params, ["account", "range", "items"]);
  });

  test("B2 002 şirketi: kalemler o şirketin faturasından", async () => {
    const second = await must("002", admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const account = await must("002 cari", admin.post(`/api/workspace/accounts?${q}`, { name: "Aynı Ad Ticaret", type: "customer", registeredOn: "2026-01-01" }));
    await must("002 fatura", admin.post(`/api/workspace/invoices?${q}`, sale(account.id, [{ name: "İkinci Şirket Kalemi", qty: 2, unitPrice: 50, vatRate: 20 }])));
    const detail = await must("002 ekstre", admin.get(`/api/workspace/report-center/cari-ekstre?${q}&account=${account.id}&${range}&items=1`));
    const plain = await must("002 düz", admin.get(`/api/workspace/report-center/cari-ekstre?${q}&account=${account.id}&${range}`));
    assert.equal(assertConsistent(detail, plain, "002").invoices, 1);
    const text = detail.rows.map(row => row.join(" | ")).join("\n");
    assert.ok(text.includes("› İkinci Şirket Kalemi") && !text.includes("› Danışmanlık"));
    const first = (await get(`account=${id.a1}&${range}&items=1`)).rows.map(row => row.join(" | ")).join("\n");
    assert.ok(!first.includes("İkinci Şirket Kalemi"), "001 ekstresinde 002 kalemi yok");
  });
});
