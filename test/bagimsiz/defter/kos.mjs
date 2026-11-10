// Bağımsız defter kâhini — kara kutu testi (2.4.3; kullanıcı kararları MM3 Vergi Ödemesi + KDV Mahsup, MM4 stok açılışı B 153 / A 500,
// MM5 yaşlandırmada "Faturasız" kalem). Program yalnız API'sinden sürülür ve okunur; beklenen değerler kahin.py'den (programın kodunu
// görmeden, senaryo.json'daki iş olaylarından elle TDHP yevmiyesi) gelir.
//   1. senaryo.json olaylarını sırayla API'ye gönderir (sahte saat senaryo.simdi; ağa çıkılmaz, lisans 127.0.0.1:9 — ders 30).
//   2. Her "kontrol" olayında Ana Defter mizanını; sonda cari bakiyeleri, stok miktarlarını, aylık KDV özetini, alacak yaşlandırmayı okur.
//   3. kahin.py'yi çalıştırır (yalnız gönderilen olaylarla), karşılaştırır.
//   4. Mutasyon: kâhine bilerek hata enjekte eder (kahin.py --mutasyon N); karşılaştırıcı her birinde farkı değiştirmeli (testin dişi).
// Henüz uç adı olmayan işlemler (UCLAR'da null) GÖNDERİLMEZ ve "ATLANAN" yazılır: atlanan varsa sonuç yeşil SAYILMAZ (çıkış 1).
// Kullanım: npm run test:kahin-defter   (KAHIN_CIKTI=<klasör> ham çıktıları oraya yazar; yoksa geçici klasör)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { karsilastir, rapor } from "./karsilastir.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

/**
 * Yeni işlemlerin uçları — UYGULAMA BİTİNCE ana oturum doldurur (kâhin uç adını bilmez; yalnız iş olayını bilir).
 * Biçim: { method: "POST", url: (olay, ids) => "/api/...", govde: (olay, ids) => ({...}), kimlik: yanit => yanit.id }
 * Olay alanları (senaryo.json):
 *   vergi_odeme        : { tarih, vergiTuru: "kdv" | "muhtasar" | "diger", tutar, gecikmeZammi?, yol: "banka" | "kasa", aciklama }
 *                        banka yolunda hesap ids.B (Ana TL Hesabı)
 *   kdv_mahsup         : { tarih, ay: "YYYY-AA" }   (o ayın KDV Mahsup fişi; yanıttaki kimlik ids[olay.id]'e yazılır)
 *   kdv_mahsup_geri_al : { tarih, mahsup: <kdv_mahsup olayının id'si> }  (ids[olay.mahsup] = programdaki kimlik)
 */
// Uç adları ana oturumdan (18.10.2026, birleşim bef55ea; yalnız çağrı biçimi — beklenenler kahin.py'nin kendi kurallarından).
export const UCLAR = {
  vergi_odeme: {
    method: "POST",
    url: "/api/workspace/tax/payments",
    govde: (o, ids) => ({ way: o.yol === "banka" ? "bank" : "cash", ...(o.yol === "banka" ? { accountId: ids.B } : {}), date: o.tarih, taxType: { kdv: "kdv", muhtasar: "muhtasar", diger: "other" }[o.vergiTuru], amount: String(o.tutar), ...(o.gecikmeZammi ? { lateAmount: String(o.gecikmeZammi) } : {}), description: o.aciklama || o.id }),
    kimlik: d => d?.card?.id || d?.id,
  },
  kdv_mahsup: { method: "POST", url: "/api/workspace/tax/vat-offset", govde: o => ({ month: o.ay, note: o.id }), kimlik: d => d?.offset?.id },
  kdv_mahsup_geri_al: { method: "POST", url: (o, ids) => `/api/workspace/tax/vat-offset/${encodeURIComponent(ids[o.mahsup])}/reverse`, govde: () => ({}), kimlik: () => null },
};

const senaryo = JSON.parse(readFileSync(path.join(HERE, "senaryo.json"), "utf8"));
const OUT = process.env.KAHIN_CIKTI ? path.resolve(process.env.KAHIN_CIKTI) : mkdtempSync(path.join(tmpdir(), "kahin-defter-"));
mkdirSync(OUT, { recursive: true });
const dataRoot = mkdtempSync(path.join(tmpdir(), "kahin-defter-veri-"));
const server = await startTestServer({ dataDir: path.join(dataRoot, "data"), now: senaryo.simdi, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, startLicenseTimers: false });
const client = server.client();
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const gunluk = [];
async function api(method, url, body) {
  const r = method === "GET" ? await client.get(url) : await client[method.toLowerCase()](url, body);
  const data = unwrap(r);
  gunluk.push({ method, url, status: r.status, body, ...(r.status === 200 ? {} : { yanit: data }) });
  return { status: r.status, data };
}
const ids = {};
const yapilan = [];
const atlanan = [];
const reddedilen = [];
const program = { kontroller: {}, son: {} };
const tl = x => String(x);
const satirKimlikleri = {};

async function gonder(o, method, url, body, kimlik = d => d?.id) {
  const r = await api(method, url, body);
  if (r.status !== 200) {
    reddedilen.push({ olay: o.id, status: r.status, kod: r.data?.code || "", ileti: String(r.data?.error || "").slice(0, 300) });
    return null;
  }
  yapilan.push(o.id);
  const id = kimlik(r.data);
  if (id) ids[o.id] = id;
  return r.data;
}
const paraBirimi = metin => {
  if (typeof metin === "number") return Math.round(metin * 100);
  const s = String(metin ?? "").replace(/[₺\s]|TL/g, "").replace(/\u2212/g, "-");
  if (!/^-?[\d.]+(,\d+)?$/.test(s)) return null;
  return Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100);
};

try {
  if ((await client.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş olmadı");
  await api("POST", "/api/workspace/bank/setup/dismiss", {});
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
        if (d) await api("PUT", `/api/workspace/bank/accounts/${ids[o.id]}`, { usePos: true, useCheque: true, useNote: true });
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
      case "kdv_mahsup":
      case "kdv_mahsup_geri_al": {
        const uc = UCLAR[o.tur];
        if (!uc || (o.tur === "kdv_mahsup_geri_al" && !ids[o.mahsup])) {
          atlanan.push({ olay: o.id, tur: o.tur, neden: uc ? "geri alınacak mahsup programda yok" : "uç adı henüz verilmedi (UCLAR)" });
          break;
        }
        const url = typeof uc.url === "function" ? uc.url(o, ids) : uc.url;
        await gonder(o, uc.method || "POST", url, uc.govde ? uc.govde(o, ids) : {}, uc.kimlik || (d => d?.id));
        break;
      }
      case "kontrol": {
        const r = await api("GET", "/api/workspace/ledger");
        program.kontroller[o.id] = r.status === 200 ? Object.fromEntries(r.data.trial.accounts.filter(a => Math.round(a.balance * 100) !== 0).map(a => [a.code, Math.round(a.balance * 100)])) : null;
        if (r.status === 200) program.kontroller[`${o.id}:dengeli`] = r.data.trial.balanced === true;
        break;
      }
      default:
        throw new Error(`kos.mjs olay türünü bilmiyor: ${o.tur}`);
    }
  }
  // Son durum: cari bakiyeler, stok, aylık KDV özeti, alacak yaşlandırma.
  const acc = await api("GET", "/api/workspace/accounts?status=all&limit=500");
  program.son.cari = acc.status === 200 ? Object.fromEntries(acc.data.accounts.map(a => [a.name, Math.round(a.balance * 100)])) : null;
  const st = await api("GET", "/api/workspace/stock");
  program.son.stok = st.status === 200 ? Object.fromEntries(st.data.items.map(i => [i.code, String(i.qty)])) : null;
  program.son.kdv = {};
  // Ayları kâhinin bildiği fatura aylarından değil, senaryonun olaylarından (fatura olayı olan her ay; 31b-MM3 iadeleri Kasım'da)
  for (const ay of [...new Set(senaryo.olaylar.filter(o => o.tur === "fatura").map(o => o.tarih.slice(0, 7)))].sort()) {
    const son = new Date(Date.UTC(Number(ay.slice(0, 4)), Number(ay.slice(5)), 0)).toISOString().slice(0, 10);
    const r = await api("GET", `/api/workspace/report-center/kdv-ozeti?from=${ay}-01&to=${son}`);
    const ozet = r.status === 200 ? Object.fromEntries(r.data.summary || []) : {};
    const bul = onek => Object.entries(ozet).find(([k]) => k.startsWith(onek))?.[1];
    program.son.kdv[ay] = { hesaplanan: paraBirimi(bul("Hesaplanan KDV")), indirilecek: paraBirimi(bul("İndirilecek KDV")) };
  }
  // 31b-MM3 (2.4.4): Stopaj ve Tevkifat Özeti (GET report-center/stopaj-tevkifat — uç adı test/stopaj-tevkifat-iade-244.test.mjs ÇAĞRI satırından; sütun ve
  // özet adları kara kutu yoklamasından: Tarih, Cari, Taraf, Matrah, Stopaj, KDV Tevkifatı; özet "Bizim Ödeyeceğimiz Stopaj/Tevkifat").
  program.son.stopajOzet = {};
  for (const ay of senaryo.stopajAylari || []) {
    const son = new Date(Date.UTC(Number(ay.slice(0, 4)), Number(ay.slice(5)), 0)).toISOString().slice(0, 10);
    const r = await api("GET", `/api/workspace/report-center/stopaj-tevkifat?from=${ay}-01&to=${son}`);
    if (r.status !== 200) {
      program.son.stopajOzet[ay] = null;
      continue;
    }
    const h = r.data.headers || [];
    const ix = ad => h.indexOf(ad);
    const iso = d => (/^\d{2}\.\d{2}\.\d{4}$/.test(String(d)) ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : String(d));
    const satirlar = {};
    for (const row of r.data.rows || []) satirlar[`${iso(row[ix("Tarih")])}|${row[ix("Cari")]}`] = { taraf: row[ix("Taraf")], matrah: paraBirimi(row[ix("Matrah")]), stopaj: paraBirimi(row[ix("Stopaj")]), tevkifat: paraBirimi(row[ix("KDV Tevkifatı")]) };
    const ozet = Object.fromEntries(r.data.summary || []);
    program.son.stopajOzet[ay] = { satirlar, bizimStopaj: paraBirimi(ozet["Bizim Ödeyeceğimiz Stopaj"]), bizimTevkifat: paraBirimi(ozet["Bizim Ödeyeceğimiz Tevkifat"]), ham: r.data.rows };
  }
  // 31b-MM8 (2.4.4): yevmiyede aynı günün maddeleri — belge (fatura/iade) önce, sonra para/cari. Satırın türü "Tür" sütunundan (kara kutu yoklaması:
  // [Tarih, Tür, Açıklama, Hesap, Borç, Alacak]); "Fatura" ya da "İade" geçen tür belge sayılır. Ham türler program.json'a yazılır.
  program.son.yevmiyeSira = {};
  program.son.yevmiyeTurleri = {};
  for (const gun of senaryo.yevmiyeSiraGunleri || []) {
    const r = await api("GET", `/api/workspace/report-center/yevmiye?from=${gun}&to=${gun}`);
    if (r.status !== 200) {
      program.son.yevmiyeSira[gun] = null;
      continue;
    }
    program.son.yevmiyeBasliklar = r.data.headers || [];
    const ti = (r.data.headers || []).findIndex(x => /^(T[üu]r|İşlem|Kaynak|Fiş Türü)/i.test(String(x)));
    const turler = (r.data.rows || []).map(row => (ti >= 0 ? String(row[ti] ?? "") : row.slice(1, 3).join(" · ")));
    const sinif = turler.map(x => (/fatura|iade/i.test(x) ? "belge" : "para"));
    program.son.yevmiyeTurleri[gun] = turler;
    const iki = sinif.includes("belge") && sinif.includes("para");
    program.son.yevmiyeSira[gun] = !iki ? "tek-sinif" : sinif.lastIndexOf("belge") < sinif.indexOf("para") ? "belge-once" : "karisik";
  }
  const y = await api("GET", "/api/workspace/report-center/alacak-yaslandirma");
  if (y.status === 200) {
    const i = y.data.headers.indexOf("Toplam");
    program.son.yaslandirma = { cariler: Object.fromEntries(y.data.rows.map(row => [row[0], paraBirimi(row[i])]).filter(([, v]) => v)), toplam: paraBirimi((y.data.footer || [])[i]) };
  } else program.son.yaslandirma = null;
} finally {
  await server.app.close();
  rmSync(dataRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

writeFileSync(path.join(OUT, "program.json"), JSON.stringify({ program, yapilan, atlanan, reddedilen }, null, 1));
writeFileSync(path.join(OUT, "api-gunlugu.json"), JSON.stringify(gunluk, null, 1));
writeFileSync(path.join(OUT, "yapilan.json"), JSON.stringify(yapilan));
const kahin = (mut = 0) => JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "kahin.py"), path.join(HERE, "senaryo.json"), "--yapilan", path.join(OUT, "yapilan.json"), "--mutasyon", String(mut)], { encoding: "utf8" }));
const beklenen = kahin(0);
writeFileSync(path.join(OUT, "beklenen.json"), JSON.stringify(beklenen, null, 1));
const sonuc = karsilastir(beklenen, program);
console.log(rapor(sonuc));
if (reddedilen.length) console.log(`\nPROGRAMIN REDDETTİĞİ OLAYLAR (${reddedilen.length}) — ders 3: ret başarı değildir:\n${reddedilen.map(r => `  ${r.olay}: ${r.status} ${r.kod} ${r.ileti}`).join("\n")}`);
if (atlanan.length) console.log(`\nATLANAN OLAYLAR (${atlanan.length}) — sonuç yeşil SAYILMAZ:\n${atlanan.map(a => `  ${a.olay} (${a.tur}): ${a.neden}`).join("\n")}`);

// Mutasyon (testin dişi): kâhine bilerek hata → karşılaştırma sonucu (farklı denetimler kümesi) değişmeli. İki yerde denenir:
//  a) bu koşunun gerçek program çıktısına karşı (atlanan olayların mutasyonu burada görünmeyebilir — bilgi),
//  b) TAM senaryoda (bütün olaylar) kâhinin kendi çıktısından kurulan "kusursuz program"a karşı — her mutasyon burada YAKALANMALI.
const MUTASYONLAR = { 11: "31b-MM3: satıştan iade 360 tarafında", 12: "31b-MM3: iade artı yazılır", 13: "31b-MM8: yevmiyede aynı gün sınıfsız yazım sırası", 1: "KDV dahil fiyatta KDV'yi brüt × oran ile hesapla", 2: "satıştan iade 610 yerine 600", 3: "stopaj 360 yerine 193", 4: "tevkifatlı satışta 391'e tam KDV", 5: "POS komisyonu yazılmaz", 6: "KDV mahsubunda devreden 190 kullanılmaz", 7: "stok açılışı deftere yazılmaz (MM4 öncesi)", 8: "yaşlandırmada faturasız bakiye atlanır (MM5 öncesi)", 9: "gecikme zammı 689 yerine 360", 10: "karşılıksız çek cariye yazılmaz" };
const imza = s => s.denetimler.filter(d => !d.ok).map(d => `${d.ad}=${d.program}/${d.beklenen}`).sort().join("|");
const tam = (mut = 0) => JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "kahin.py"), path.join(HERE, "senaryo.json"), "--mutasyon", String(mut)], { encoding: "utf8" }));
const kusursuz = (() => {
  const b = tam(0);
  const kontroller = {};
  for (const k of b.kontrolSirasi) Object.assign(kontroller, { [k]: b.kontroller[k], [`${k}:dengeli`]: true });
  return { kontroller, son: { cari: b.cari, stok: b.stok, kdv: b.kdv, yaslandirma: b.yaslandirma, stopajOzet: b.stopajOzet, yevmiyeSira: b.yevmiyeSira } };
})();
if (karsilastir(tam(0), kusursuz).denetimler.some(d => !d.ok)) throw new Error("öz denetim: kâhin kendi çıktısıyla tutmuyor");
const taban = imza(sonuc);
const kacan = [];
for (const [n, ad] of Object.entries(MUTASYONLAR)) {
  const gercek = imza(karsilastir(kahin(Number(n)), program)) !== taban;
  const tamda = karsilastir(tam(Number(n)), kusursuz).denetimler.some(d => !d.ok);
  if (!tamda) kacan.push(`${n} ${ad}`);
  console.log(`  mutasyon ${n} (${ad}): tam senaryoda ${tamda ? "YAKALANDI" : "YAKALANMADI"} · bu koşuda ${gercek ? "yakalandı" : "görünmedi (olayı atlanmış olabilir)"}`);
}
const kirmizi = sonuc.denetimler.filter(d => !d.ok).length;
console.log(`\nÖZET: ${sonuc.denetimler.length} denetim, ${kirmizi} fark, ${atlanan.length} atlanan olay, ${reddedilen.length} reddedilen olay, ${kacan.length} yakalanmayan mutasyon. Ham çıktı: ${OUT}`);
process.exitCode = kirmizi || atlanan.length || reddedilen.length || kacan.length ? 1 : 0;
if (!process.env.KAHIN_CIKTI && process.exitCode === 0) rmSync(OUT, { recursive: true, force: true });
