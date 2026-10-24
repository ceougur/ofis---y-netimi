#!/usr/bin/env node
// Bağımsız TUTAR kâhini — kara kutu koşucusu (2.4.4 madde 31a, B3 Netten Brüte + B4 e-SMM UBL; KARARLAR.md).
//
//   node test/bagimsiz/tutar/kos.mjs [--tohum 1-2] [--adet 60] [--cikti <klasör>] [--mutasyonsuz]
//
// Her tohum için model.py --uret ile girdi tablosu üretilir (alıcı türü, stopaj oranı, KDV, KDV dahil, tevkifat, ek kalemler, Net Ücret).
// Her satır: POST /api/workspace/invoices/gross-from-net (Netten Brüte) → dönen birim fiyatla SMM kaydı (POST /api/workspace/invoices) →
// GET makbuz kartı → GET .../ubl.xml (e-SMM). Program e-SMM açık başlatılır (edocEnabled + esmmEnabled + Fatura Ayarları satıcı = gerçek
// kişi serbest meslek erbabı). Okunan değerler programın kendi yanıtlarıdır; koşucu yalnız XML'deki sayıları kuruşa çevirir ve kalem
// kimliklerini (InvoicedQuantity = LineExtension − kalem stopajı; PriceAmount = InvoicedQuantity + kalem KDV − kalem tevkifatı) okur.
// Beklenenler model.py'den (programın kodunu görmeden). Fark sınıfı: GİB / EDM / KULLANICI → BULGU; AJAN / YAYGIN / ÇATAL → İNCELE.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
// Sınanan program: varsayılan bu depo; KAHIN_PROGRAM_KOKU=<klasör> ile başka bir kopya (ör. eski sürüm, ders 23: ayrı kopyada) koşulur.
const PROGRAM_KOKU = process.env.KAHIN_PROGRAM_KOKU ? path.resolve(process.env.KAHIN_PROGRAM_KOKU) : ROOT;
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(PROGRAM_KOKU, "test", "helpers.mjs")).href);
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const BIRINCIL = new Set(["GIB", "EDM", "KULLANICI", "PLAN"]);
const argv = process.argv.slice(2);
const opt = n => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const OUT = opt("--cikti") ? path.resolve(opt("--cikti")) : mkdtempSync(path.join(tmpdir(), "kahin-tutar-"));
mkdirSync(OUT, { recursive: true });
const [t0, t1] = (opt("--tohum") || "1").split("-").map(Number);
const ADET = opt("--adet") || "60";

const kurus = x => (x === null || x === undefined || x === "" ? null : Math.round(Number(x) * 100));
const PRICE = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const SELLER = { name: "Av. Kâhin Deneme", partyKind: "person", firstName: "Kâhin", familyName: "Deneme", taxNo: "10000000146", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul", email: "kahin@ornek.com" };
const ALICI = {
  firma: { name: "Kâhin Müvekkil A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "m@ornek.com" },
  kisi: { name: "Kâhin Kişi", type: "customer", partyKind: "person", firstName: "Kâhin", familyName: "Kişi", taxNo: "10000000078", address: "Bağdat Cd. 5", district: "Kadıköy", city: "İstanbul" },
  // Kimliği bilinmeyen nihai tüketici: e-Arşiv/e-SMM'de TCKN 11111111111 (GİB; programın ret iletisi de bunu söylüyor).
  kimliksiz: { name: "Kâhin Nihai Tüketici", type: "customer", partyKind: "person", firstName: "Kâhin", familyName: "Tüketici", taxNo: "11111111111", address: "Bağdat Cd. 7", district: "Kadıköy", city: "İstanbul" },
};

// Basit XML okuyucu: yalnız bu belgenin öğeleri (ad alanı önekleri atılır). Dış kütüphane yok (programın xml-lite'ı kullanılmaz).
function xmlAgaci(xml) {
  const kok = { ad: "#", cocuk: [], metin: "", nit: {} };
  const yigin = [kok];
  const re = /<(\/?)([A-Za-z_][\w.-]*:)?([\w.-]+)([^>]*?)(\/?)>|([^<]+)/g;
  for (const m of xml.replace(/<\?[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").matchAll(re)) {
    if (m[6] !== undefined) {
      yigin[yigin.length - 1].metin += m[6];
      continue;
    }
    if (m[1]) {
      yigin.pop();
      continue;
    }
    const nit = Object.fromEntries([...m[4].matchAll(/([\w:.-]+)="([^"]*)"/g)].map(x => [x[1].replace(/^.*:/, ""), x[2]]));
    const dugum = { ad: m[3], cocuk: [], metin: "", nit };
    yigin[yigin.length - 1].cocuk.push(dugum);
    if (!m[5]) yigin.push(dugum);
  }
  return kok;
}
const cocuk = (d, ad) => (d?.cocuk || []).filter(c => c.ad === ad);
const bir = (d, ...yol) => yol.reduce((x, ad) => cocuk(x, ad)[0], d);
const sayi = d => (d ? Math.round(Number(d.metin.trim()) * 100) : null);
function vergiler(taxTotal) {
  const r = {};
  for (const st of cocuk(taxTotal, "TaxSubtotal")) {
    const kod = bir(st, "TaxCategory", "TaxScheme", "TaxTypeCode")?.metin.trim();
    const x = (r[kod] ||= { tutar: 0, matrah: 0, oran: null });
    x.tutar += sayi(bir(st, "TaxAmount")) || 0;
    x.matrah += sayi(bir(st, "TaxableAmount")) || 0;
    x.oran = Math.round(Number(bir(st, "Percent")?.metin || 0) * 100);
  }
  return r;
}

async function kosTohum(tohum) {
  const girdiYolu = path.join(OUT, `tutar-${tohum}.girdi.json`);
  writeFileSync(girdiYolu, execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), "--uret", "--tohum", String(tohum), "--adet", ADET], { encoding: "utf8" }));
  const girdi = JSON.parse(readFileSync(girdiYolu, "utf8"));
  const veri = mkdtempSync(path.join(tmpdir(), "kahin-tutar-veri-"));
  const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", edocEnabled: true, esmmEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const c = server.client();
  const P = {};
  const satirlar = {};
  const gunluk = [];
  const api = async (method, url, body) => {
    const r = method === "GET" ? await c.get(url) : await c[method.toLowerCase()](url, body);
    const data = unwrap(r);
    gunluk.push({ method, url, status: r.status, body, ...(r.status === 200 ? {} : { yanit: data }) });
    return { status: r.status, data };
  };
  try {
    if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş olmadı");
    await api("PUT", "/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true });
    const hesap = {};
    for (const [k, b] of Object.entries(ALICI)) hesap[k] = (await api("POST", "/api/workspace/accounts", b)).data?.id;
    for (const s of girdi.satirlar) {
      const i = s.id;
      const lines = [{ name: "Avukatlık Ücreti", qty: "1", unitPrice: "0", vatRate: s.kdv, ...(s.tevkifat ? { withholdingCode: s.tevkifat } : {}) },
        ...(s.ekler || []).map((e, j) => ({ name: `Ek Hizmet ${j + 1}`, qty: "1", unitPrice: e.fiyat, vatRate: e.kdv, ...(e.tevkifat ? { withholdingCode: e.tevkifat } : {}) }))];
      const form = { scenario: "smm", kind: "smm", accountId: hesap[s.alici], pricesIncludeVat: Boolean(s.dahil), discountRate: s.iskonto || "0", ...(s.oran !== undefined ? { stoppageRate: s.oran } : {}), lines };
      const g = await api("POST", "/api/workspace/invoices/gross-from-net", { ...form, net: s.net });
      P[`${i}:gfn:durum`] = g.status === 200 ? "ok" : "ret";
      if (g.status !== 200) continue;
      P[`${i}:gfn:stopajOrani`] = Math.round(Number(g.data.stoppageRate) * 100);
      P[`${i}:gfn:birimFiyat`] = kurus(g.data.unitPrice);
      const body = { ...form, lines: [{ ...lines[0], unitPrice: PRICE.format(g.data.unitPrice) }, ...lines.slice(1)], payment: { rest: "open" } };
      const k = await api("POST", "/api/workspace/invoices", body);
      P[`${i}:kayit:durum`] = k.status === 200 ? "ok" : "ret";
      if (k.status !== 200) continue;
      const d = (await api("GET", `/api/workspace/invoices/${k.data.id}`)).data;
      const brut = kurus(d.netTotal);
      const stopaj = kurus(d.stoppageTotal);
      Object.assign(P, { [`${i}:kayit:stopajOrani`]: Math.round(Number(d.stoppageRate) * 100), [`${i}:kayit:netUcret`]: brut - stopaj, [`${i}:kayit:brut`]: brut, [`${i}:kayit:stopaj`]: stopaj, [`${i}:kayit:kdv`]: kurus(d.vatTotal), [`${i}:kayit:tevkifat`]: kurus(d.withheldTotal), [`${i}:kayit:odenecek`]: kurus(d.payableTotal) });
      P[`${i}:gfn:kayitAyni`] = kurus(g.data.gross) === brut && kurus(g.data.stoppage) === stopaj && kurus(g.data.net) === brut - stopaj && kurus(g.data.vat) === kurus(d.vatTotal) && kurus(g.data.withheld) === kurus(d.withheldTotal) && kurus(g.data.payable) === kurus(d.payableTotal);
      const kalemler = (d.lines || []).map(l => ({ matrah: kurus(l.net), kdv: kurus(l.vat), kdvOrani: Number(l.vatRate), fiyatTutari: kurus(l.base) - (kurus(l.discount) || 0), tevkifatKodu: l.withholdingCode || "", tevkifat: kurus(l.withheld) }));
      kalemler.forEach((x, j) => (P[`${i}:kalem${j + 1}:kdv`] = x.kdv));
      const kayit = { brut, stopaj, kdv: kurus(d.vatTotal), tevkifat: kurus(d.withheldTotal), kalemler };
      // MM10 (23.10.2026): aynı matrah/oranda KDV toplamı ile stopaj arasındaki fark (kuruş) — beklenen "<=1" model.py'den
      P[`${i}:kayit:mm10KdvStopajFarkiKurus`] = Math.abs((kayit.kdv ?? 0) - (stopaj ?? 0)) <= 1 ? "<=1" : String((kayit.kdv ?? 0) - (stopaj ?? 0));
      const xr = await c.get(`/api/workspace/invoices/${k.data.id}/ubl.xml`);
      if (xr.status === 200 && typeof xr.data === "string") {
        const inv = bir(xmlAgaci(xr.data), "Invoice");
        const lmt = bir(inv, "LegalMonetaryTotal");
        for (const ad of ["LineExtensionAmount", "TaxExclusiveAmount", "TaxInclusiveAmount", "PayableAmount"]) P[`${i}:xml:${ad}`] = sayi(bir(lmt, ad));
        const v = cocuk(inv, "TaxTotal").map(vergiler).reduce((a, b) => ({ ...a, ...b }), {});
        if (v["0003"]) Object.assign(P, { [`${i}:xml:0003:TaxAmount`]: v["0003"].tutar, [`${i}:xml:0003:Percent`]: v["0003"].oran });
        P[`${i}:xml:0015:TaxAmount`] = v["0015"]?.tutar ?? 0;
        const w = cocuk(inv, "WithholdingTaxTotal").map(x => sayi(bir(x, "TaxAmount")) || 0).reduce((a, b) => a + b, 0);
        if (w || kayit.tevkifat) P[`${i}:xml:WithholdingTaxAmount`] = w;
        const il = cocuk(inv, "InvoiceLine");
        let le = 0, s3 = 0, pr = 0;
        il.forEach((ln, j) => {
          const lv = vergiler(bir(ln, "TaxTotal"));
          const lw = cocuk(ln, "WithholdingTaxTotal").map(x => sayi(bir(x, "TaxAmount")) || 0).reduce((a, b) => a + b, 0);
          const lExt = sayi(bir(ln, "LineExtensionAmount"));
          const qty = sayi(bir(ln, "InvoicedQuantity"));
          const price = sayi(bir(ln, "Price", "PriceAmount"));
          const ls = lv["0003"]?.tutar || 0;
          le += lExt;
          s3 += ls;
          pr += price;
          const oran = Math.round(Number(d.stoppageRate) * 100);
          const tam = (lExt * oran) / 10000;
          if (oran) P[`${i}:xml:kalem${j + 1}:0003SapmaKurus`] = Math.abs(ls - tam) <= 1 ? "<=1" : `${(ls - tam).toFixed(2)}`;
          P[`${i}:xml:kalem${j + 1}:netKimlik`] = qty === lExt - ls && price === qty + (lv["0015"]?.tutar || 0) - lw;
        });
        P[`${i}:xml:kalemLineExtensionToplami`] = le;
        if (v["0003"]) P[`${i}:xml:kalem0003Toplami`] = s3;
        P[`${i}:xml:kalemPriceToplami`] = pr;
        kayit.xml = true;
      }
      satirlar[i] = kayit;
    }
  } finally {
    await server.app.close();
    rmSync(veri, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  const programYolu = path.join(OUT, `tutar-${tohum}.program-girdi.json`);
  writeFileSync(programYolu, JSON.stringify({ satirlar }, null, 1));
  writeFileSync(path.join(OUT, `tutar-${tohum}.program.json`), JSON.stringify(P, null, 1));
  writeFileSync(path.join(OUT, `tutar-${tohum}.api-gunlugu.json`), JSON.stringify(gunluk, null, 1));
  return { girdiYolu, programYolu, P };
}

const model = (girdi, prog, mut = 0) => JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), girdi, "--program", prog, "--mutasyon", String(mut)], { encoding: "utf8" }));
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let toplam = 0;
let fark = 0;
let bulgu = 0;
const kosular = [];
for (let t = t0; t <= (t1 || t0); t += 1) {
  const r = await kosTohum(t);
  const b = model(r.girdiYolu, r.programYolu);
  writeFileSync(path.join(OUT, `tutar-${t}.kahin.json`), JSON.stringify(b, null, 1));
  const farklar = [];
  for (const [k, d] of Object.entries(b.denetimler)) {
    if (k.includes(":not:")) continue;
    toplam += 1;
    const p = r.P[k];
    if (!esit(p, d.b)) farklar.push({ anahtar: k, beklenen: d.b, program: p === undefined ? "okunamadı" : p, etiket: d.e, kural: d.k, sinif: BIRINCIL.has(d.e) ? "BULGU" : "İNCELE" });
  }
  const notlar = Object.entries(b.denetimler).filter(([k]) => k.includes(":not:")).map(([k, d]) => `${k} (${d.k})`);
  fark += farklar.length;
  bulgu += farklar.filter(f => f.sinif === "BULGU").length;
  writeFileSync(path.join(OUT, `tutar-${t}.fark.json`), JSON.stringify({ farklar, notlar }, null, 1));
  console.log(`tutar tohum ${t}: ${Object.keys(b.denetimler).length - notlar.length - farklar.length}/${Object.keys(b.denetimler).length - notlar.length} tuttu`);
  for (const f of farklar) console.log(`  ✗ [${f.sinif} ${f.etiket}] ${f.anahtar}: program ${JSON.stringify(f.program)} · kâhin ${JSON.stringify(f.beklenen)} (${f.kural})`);
  for (const n of notlar) console.log(`  · not: ${n}`);
  kosular.push(r);
}
let kacan = 0;
if (!argv.includes("--mutasyonsuz")) {
  const mutasyonlar = JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), "--mutasyonlar"], { encoding: "utf8" }));
  for (const [n, ad] of Object.entries(mutasyonlar)) {
    const yakalandi = kosular.some(r => !esit(model(r.girdiYolu, r.programYolu, Number(n)).denetimler, model(r.girdiYolu, r.programYolu).denetimler));
    if (!yakalandi) kacan += 1;
    console.log(`  mutasyon ${n} (${ad}): ${yakalandi ? "YAKALANDI" : "YAKALANMADI"}`);
  }
}
console.log(`\nÖZET: ${kosular.length} tohum × ${ADET} satır, ${toplam} denetim, ${fark} fark (BULGU ${bulgu}), ${kacan} yakalanmayan mutasyon. Ham çıktı: ${OUT}`);
console.log(`${Math.max(0, toplam - fark - kacan)}/${toplam} denetim geçti`);
process.exitCode = fark || kacan ? 1 : 0;
