#!/usr/bin/env node
// Bağımsız CARİ / EVRAK kâhini — kara kutu koşucusu (2.4.4 madde 31a, B1–B2; dil "destekofis-cari/2" ve /1, KARARLAR.md).
// /2 (23.10.2026): B3 Tablodaki Kişiler borcu (sekme türü "serbest": başlıklar ve hücre metinleri senaryodan aynen), B4 Nakit Akışı / Kasa raporu Kasa
// giriş-çıkışı (GET /api/workspace/reports/nakit-akis → report.totals.cashIn/cashOut; GET /api/workspace/cash?method=cash → totals.in/out), B5 Nihai
// Tüketici (POST /api/workspace/invoices/retail-account → {id, name, created}); uçlar test/nakit-akis-kasa-mm6, test/nihai-tuketici-u1-244 ÇAĞRI
// satırlarından, yanıt biçimi kara kutu yoklamasından (not defteri yokla3.mjs).
//
//   node test/bagimsiz/cari/kos.mjs [senaryo.json …] [--tohum 1-3 --islem 60] [--cikti <klasör>] [--mutasyonsuz]
//
// Ne yapar:
//   1. Her senaryoyu ayrı, boş bir programda koşar (test/helpers.mjs startTestServer; sahte saat = senaryonun "bugun"ü 09:00'dan akar;
//      lisans servisi 127.0.0.1:9 — ders 30). Adımlar programın GERÇEK HTTP uçlarıyla gönderilir (uç adları KARARLAR.md §3'te,
//      nereden öğrenildikleriyle). Her kontrol adımında durum programın KENDİ uçlarından okunur (cari kartı, fatura kartı, taksit kartı,
//      Kasa, Ana Defter mizanı, Tablodaki Kişiler raporu); koşucu beklenen değer HESAPLAMAZ.
//   2. model.py'yi (programın kodunu görmeden yazılmış kâhin) ayrı süreçte çalıştırır, anahtar anahtar karşılaştırır. Fark sınıfı kuralın
//      etiketinden: KULLANICI / PLAN / GİB / EDM → BULGU; AJAN / YAYGIN → İNCELE (KURALLAR-244.md başı). Okunamayan değer fark sayılır (ders 4).
//   3. Mutasyon (kâhinin dişi): model.py --mutasyon N her senaryo kümesinde en az bir denetimi değiştirmeli; değiştirmeyen = YAKALANMADI.
// Çıkış: 0 yalnız fark yok + okuma hatası yok + yakalanmayan mutasyon yok. Son satır "N/M denetim geçti" (tools/kanit.mjs tanır).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
// Sınanan program: varsayılan bu depo; KAHIN_PROGRAM_KOKU=<klasör> ile başka bir kopya (ör. eski sürüm, ders 23: ayrı kopyada) koşulur.
const PROGRAM_KOKU = process.env.KAHIN_PROGRAM_KOKU ? path.resolve(process.env.KAHIN_PROGRAM_KOKU) : ROOT;
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(PROGRAM_KOKU, "test", "helpers.mjs")).href);
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const BIRINCIL = new Set(["KULLANICI", "PLAN", "GIB", "EDM"]);

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const OUT = opt("--cikti") ? path.resolve(opt("--cikti")) : mkdtempSync(path.join(tmpdir(), "kahin-cari-"));
mkdirSync(OUT, { recursive: true });
let dosyalar = argv.filter((a, i) => a.endsWith(".json") && argv[i - 1] !== "--cikti");
// Bağımsız çağrı (dosya ve tohum verilmeden): bütün elle senaryolar + rastgele tohum 1–2 × 60 işlem.
const VARSAYILAN = !dosyalar.length && !opt("--tohum");
if (VARSAYILAN) dosyalar = readdirSync(path.join(HERE, "senaryolar")).filter(f => f.endsWith(".json")).sort().map(f => path.join(HERE, "senaryolar", f));
const TOHUM = opt("--tohum") || (VARSAYILAN ? "1-2" : null);
if (TOHUM) {
  const [bas, son] = TOHUM.split("-").map(Number);
  for (let t = bas; t <= (son || bas); t += 1) {
    const yol = path.join(OUT, `rastgele-ux18-${t}.json`);
    writeFileSync(yol, execFileSync(PYTHON, ["-I", path.join(HERE, "uretici.py"), "--tohum", String(t), "--islem", opt("--islem") || "60"], { encoding: "utf8" }));
    dosyalar.push(yol);
  }
}

const kurus = x => (x === null || x === undefined || x === "" ? null : Math.round(Number(x) * 100));
const tlMetin = k => `${Math.trunc(k / 100)},${String(k % 100).padStart(2, "0")}`;
const kurusOf = s => {
  const [t, o = "00"] = String(s).split(",");
  return Number(t) * 100 + Number((o + "00").slice(0, 2));
};
const TRY = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hucreTutar = s => `${TRY.format(kurusOf(s) / 100)} ₺`;
const hucreTarih = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

function tabloMatrisi(sk) {
  if (sk.tur === "taksit") {
    const n = Math.max(...sk.kayitlar.map(r => r.taksitler.length));
    const cols = ["Müşteri No", "Müşteri", "Telefon", "Toplam"];
    for (let i = 1; i <= n; i += 1) cols.push(`${i}. Taksit Tarihi`, `${i}. Taksit Tutarı`);
    const rows = sk.kayitlar.map(r => {
      const toplam = r.taksitler.reduce((s, [, v]) => s + kurusOf(v), 0);
      const row = [r.no, r.isim, r.tel || "", `${TRY.format(toplam / 100)} ₺`];
      for (let i = 0; i < n; i += 1) row.push(r.taksitler[i] ? hucreTarih(r.taksitler[i][0]) : "", r.taksitler[i] ? hucreTutar(r.taksitler[i][1]) : "");
      return row;
    });
    return [cols, ...rows];
  }
  if (sk.tur === "icra") return [["Dosya No", "Borçlu", "Telefon", "Alacak Tutarı", "Kalan"], ...sk.kayitlar.map(r => [r.no, r.isim, r.tel || "", hucreTutar(r.alacak), hucreTutar(r.kalan)])];
  if (sk.tur === "soz") return [["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı"], ...sk.kayitlar.map(r => [r.no, r.isim, hucreTarih(r.tarih), hucreTutar(r.tutar)])];
  // /2 B3: başlıklar ve hücre metinleri senaryodan AYNEN (kâhin aynı metinden okur)
  if (sk.tur === "serbest") return [["Dosya No", "Borçlu", ...sk.basliklar], ...sk.kayitlar.map(r => [r.no, r.isim, ...sk.basliklar.map(h => r.hucreler?.[h] ?? "")])];
  throw new Error(`sekme türü bilinmiyor: ${sk.tur}`);
}

async function kos(senaryo) {
  const veri = mkdtempSync(path.join(tmpdir(), "kahin-cari-veri-"));
  const server = await startTestServer({ dataDir: path.join(veri, "data"), now: `${senaryo.bugun}T09:00:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const c = server.client();
  const gunluk = [];
  const api = async (method, url, body) => {
    const r = method === "GET" ? await c.get(url) : method === "DELETE" ? await c.del(url) : await c[method.toLowerCase()](url, body);
    const data = unwrap(r);
    gunluk.push({ method, url, body, status: r.status, ...(r.status === 200 ? {} : { yanit: data }) });
    return { status: r.status, data };
  };
  const P = {};
  const ham = {};
  const hatalar = [];
  const ids = { cari: {}, fatura: {}, evrak: {}, seri: {}, aktar: {}, anahtar: {} };
  let urun = null;
  let seri = 0;
  const durum = (adim, r) => {
    P[`adim:${adim.id}:durum`] = r.status === 200 ? "ok" : r.status >= 500 ? "hata" : "ret";
    P[`adim:${adim.id}:http`] = r.status;
    if (r.status !== 200) P[`adim:${adim.id}:yanit`] = `${r.data?.code || ""} ${String(r.data?.error || "").slice(0, 200)}`;
  };
  const evrakOku = async ad => (await api("GET", `/api/workspace/cheques?q=${encodeURIComponent(ids.seri[ad])}`)).data?.cheques?.find(x => x.id === ids.evrak[ad]);
  try {
    if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş olmadı");
    await api("POST", "/api/workspace/bank/setup/dismiss", {});
    urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "KAHIN-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" })).data?.id;
    for (const a of senaryo.adimlar) {
      const t = a.tarih || senaryo.bugun;
      switch (a.islem) {
        case "tablo_yukle": {
          const st = await api("POST", "/api/workspace/dataset/stage", { kind: "excel", fileName: `${senaryo.ad}.xlsx`, sheets: a.sekmeler.map(sk => ({ name: sk.ad, matrix: tabloMatrisi(sk) })) });
          const r = st.status === 200 ? await api("POST", "/api/workspace/dataset/commit", { stageId: st.data.stageId, mode: "replace" }) : st;
          durum(a, r);
          const pv = await api("GET", "/api/workspace/plans/from-table");
          for (const sk of a.sekmeler) for (const kay of sk.kayitlar) ids.anahtar[kay.no] = pv.data?.records?.find(x => x.caseNo === kay.no && x.name === kay.isim)?.key || kay.no;
          break;
        }
        case "cari_ac": {
          const body = { name: a.isim, type: a.tur === "tedarikci" ? "supplier" : "customer", phone: a.tel || "", registeredOn: a.tarih || senaryo.bugun };
          if (a.kayit) Object.assign(body, { caseKey: ids.anahtar[a.kayit], caseTitle: a.isim });
          if (a.tckn) Object.assign(body, { partyKind: "person", firstName: a.isim.split(" ")[0], familyName: a.isim.split(" ").slice(1).join(" ") || a.isim, taxNo: a.tckn, city: "Ankara", district: "Çankaya", similarOk: true });
          if (a.acilis) Object.assign(body, { openingBalance: tlMetin(kurusOf(a.acilis)), openingSide: "auto" });
          const r = await api("POST", "/api/workspace/accounts", body);
          durum(a, r);
          ids.cari[a.ad] = r.data?.id;
          break;
        }
        case "tahsilat": {
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/entries`, { kind: "in", amount: tlMetin(kurusOf(a.tutar)), date: t, method: a.yol === "havale" ? "bank" : "cash", cashForce: true, similarOk: true, note: a.id, ...(a.fatura ? { invoiceId: ids.fatura[a.fatura] } : {}) });
          durum(a, r);
          break;
        }
        case "borc": {
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/entries`, { kind: "debt", amount: tlMetin(kurusOf(a.tutar)), date: t, note: a.id });
          durum(a, r);
          break;
        }
        case "kayit_tahsilat": {
          const r = await api("POST", `/api/workspace/cases/${encodeURIComponent(ids.anahtar[a.kayit] || a.kayit)}/payments`, { amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash" });
          durum(a, r);
          break;
        }
        case "aktar": {
          const secenek = { accountIn: a.hesapIci !== false, coverDebt: a.mevcutBorc !== false };
          const sorgu = `?accountIn=${secenek.accountIn ? 1 : 0}&coverDebt=${secenek.coverDebt ? 1 : 0}`;
          const pv = await api("GET", `/api/workspace/plans/from-table${sorgu}`);
          if (a.araya) await api("POST", `/api/workspace/accounts/${ids.cari[a.araya.cari]}/entries`, { kind: "in", amount: tlMetin(kurusOf(a.araya.tutar)), date: a.araya.tarih || t, method: "cash", cashForce: true, similarOk: true, note: `${a.id}-araya` });
          const r = await api("POST", `/api/workspace/plans/from-table${sorgu}`, { keys: a.kayitlar.map(no => ids.anahtar[no]), fingerprint: pv.data?.fingerprint, ...secenek });
          durum(a, r);
          if (r.status === 200) {
            ids.aktar[a.ad] = r.data.importId;
            Object.assign(P, { [`adim:${a.id}:olusan`]: r.data.created, [`adim:${a.id}:tasinanAdet`]: r.data.accountEntriesMoved, [`adim:${a.id}:tasinanTutar`]: kurus(r.data.accountEntriesAmount), [`adim:${a.id}:kapsanan`]: r.data.covered, [`adim:${a.id}:atlanan`]: (r.data.skipped || []).length });
            P[`adim:${a.id}:atlamaNedeni`] = (r.data.skipped || []).map(s => s.reason).join(" | ");
          }
          break;
        }
        case "kart_tahsilat": {
          const planlar = (await api("GET", "/api/workspace/plans")).data?.plans || [];
          const pl = planlar.find(x => x.caseKey === ids.anahtar[a.kayit]);
          durum(a, await api("POST", `/api/workspace/plans/${pl?.id}/entries`, { kind: "in", amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash", cashForce: true, similarOk: true }));
          break;
        }
        case "geri_al": {
          durum(a, await api("POST", `/api/workspace/plans/imports/${ids.aktar[a.aktar]}/undo`, {}));
          break;
        }
        case "fatura": {
          const payment = a.taksit
            ? { rest: "installments", installments: { count: a.taksit.sayi, firstDue: a.taksit.ilkVade, everyMonths: 1 } }
            : a.evrak
              ? { cheques: [{ instrument: a.evrak.tur === "senet" ? "note" : "cheque", amount: tlMetin(kurusOf(a.evrak.tutar)), dueDate: t, serialNo: `KH-${(seri += 1)}`, bank: "Ziraat" }], rest: "open" }
              : { rest: "open" };
          const base = a.tur === "alis"
            ? { kind: "purchase", scenario: "expense_purchase", lines: [{ name: "Kâhin Gideri", qty: 1, unitPrice: tlMetin(kurusOf(a.tutar)), vatRate: 0, expenseCode: "general" }], number: `KH-A${(seri += 1)}` }
            : { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: tlMetin(kurusOf(a.tutar)), vatRate: 0 }] };
          const r = await api("POST", "/api/workspace/invoices", { ...base, accountId: ids.cari[a.cari], issueDate: t, payment, ...(a.taslak ? { status: "draft" } : {}) });
          durum(a, r);
          ids.fatura[a.ad] = r.data?.id;
          if (a.evrak && r.status === 200) {
            ids.seri[a.evrak.ad] = `KH-${seri}`;
            ids.evrak[a.evrak.ad] = (await api("GET", `/api/workspace/cheques?q=${encodeURIComponent(`KH-${seri}`)}`)).data?.cheques?.[0]?.id;
          }
          break;
        }
        case "iade": {
          const asil = (await api("GET", `/api/workspace/invoices/${ids.fatura[a.fatura]}`)).data;
          const r = await api("POST", "/api/workspace/invoices", { kind: "sale_return", originalId: asil?.id, issueDate: t, lines: [{ originLineId: asil?.lines?.[0]?.id, qty: 1 }], payment: {} });
          durum(a, r);
          ids.fatura[a.ad] = r.data?.id;
          break;
        }
        case "evrak": {
          const sn = `KH-${(seri += 1)}`;
          const r = await api("POST", "/api/workspace/cheques", { direction: "in", instrument: a.tur === "senet" ? "note" : "cheque", accountId: a.cari ? ids.cari[a.cari] : "", amount: tlMetin(kurusOf(a.tutar)), issueDate: t, dueDate: t, serialNo: sn, bank: "Ziraat", ...(a.fatura ? { invoiceId: ids.fatura[a.fatura] } : {}) });
          durum(a, r);
          ids.evrak[a.ad] = r.data?.id;
          ids.seri[a.ad] = sn;
          break;
        }
        case "karsiliksiz":
        case "tahsil":
        case "ciro": {
          const action = { karsiliksiz: "bounce", tahsil: "collect", ciro: "endorse" }[a.islem];
          durum(a, await api("POST", `/api/workspace/cheques/${ids.evrak[a.evrak]}/actions`, { action, date: t, method: "cash", cashForce: true, ...(a.islem === "ciro" ? { accountId: ids.cari[a.cari] } : {}) }));
          break;
        }
        case "evrak_sil": {
          durum(a, await api("DELETE", `/api/workspace/cheques/${ids.evrak[a.evrak]}`));
          break;
        }
        case "evrak_geri_yukle": {
          const cop = (await api("GET", "/api/admin/trash")).data;
          const kalem = (Array.isArray(cop) ? cop : cop?.items || []).find(x => x.id === `cheque:${ids.evrak[a.evrak]}`);
          durum(a, await api("POST", "/api/admin/trash/restore", { id: kalem?.id || `cheque:${ids.evrak[a.evrak]}` }));
          break;
        }
        case "bag_degistir": {
          const e = await evrakOku(a.evrak);
          durum(a, await api("PUT", `/api/workspace/cheques/${ids.evrak[a.evrak]}`, { invoiceId: a.fatura ? ids.fatura[a.fatura] : "", updatedAt: e?.updatedAt }));
          break;
        }
        case "nihai_tuketici": {
          const r = await api("POST", "/api/workspace/invoices/retail-account", {});
          durum(a, r);
          if (r.status === 200) {
            let ad = Object.entries(ids.cari).find(([, id]) => id === r.data.id)?.[0];
            if (!ad) {
              ids.ntSayac = (ids.ntSayac || 0) + 1;
              ad = `@nt${ids.ntSayac}`;
              ids.cari[ad] = r.data.id;
            }
            P[`adim:${a.id}:secilen`] = ad;
            P[`adim:${a.id}:olusturuldu`] = r.data.created === true;
          }
          break;
        }
        case "cari_sil": {
          durum(a, await api("DELETE", `/api/workspace/accounts/${ids.cari[a.cari]}`));
          (ids.silinen ||= new Set()).add(a.cari);
          break;
        }
        case "cari_adlandir": {
          const cur = (await api("GET", `/api/workspace/accounts/${ids.cari[a.cari]}`)).data || {};
          const govde = { name: a.isim, type: cur.type, taxNo: a.tckn ?? cur.taxNo, partyKind: cur.partyKind, firstName: a.isim.split(" ")[0], familyName: a.isim.split(" ").slice(1).join(" ") || a.isim, city: cur.city, district: cur.district, phone: cur.phone, similarOk: true, ...(cur.updatedAt ? { updatedAt: cur.updatedAt } : {}) };
          durum(a, await api("PUT", `/api/workspace/accounts/${ids.cari[a.cari]}`, govde));
          break;
        }
        case "fatura_iptal": {
          durum(a, await api("POST", `/api/workspace/invoices/${ids.fatura[a.fatura]}/cancel`, { reason: "Kâhin denemesi" }));
          break;
        }
        case "kontrol": {
          const k = a.id;
          const hesaplar = (await api("GET", "/api/workspace/accounts?status=all&limit=500")).data?.accounts || [];
          for (const [no, anahtar] of Object.entries(ids.anahtar)) {
            const ac = hesaplar.find(h => h.caseKey === anahtar && !Object.values(ids.cari).includes(h.id));
            if (ac) ids.cari[`@${no}`] = ac.id;
          }
          for (const [ad, id] of Object.entries(ids.cari)) {
            if (!id) continue;
            const r = await api("GET", `/api/workspace/accounts/${id}`);
            if (ids.silinen?.has(ad)) {
              P[`${k}:cari:${ad}:var`] = r.status === 200 && !r.data?.deletedAt;
              continue;
            }
            if (ad.startsWith("@")) P[`${k}:cari:${ad}:var`] = r.status === 200;
            if (ad.startsWith("@") && r.status === 404) continue;
            if (r.status !== 200) {
              hatalar.push(`${k} cari ${ad} okunamadı (${r.status})`);
              continue;
            }
            P[`${k}:cari:${ad}:bakiye`] = kurus(r.data.totals?.balance);
            P[`${k}:cari:${ad}:taksitDisi`] = (r.data.entries || []).filter(e => e.kind === "in").reduce((s, e) => s + kurus(e.amount), 0);
          }
          for (const [ad, id] of Object.entries(ids.fatura)) {
            if (!id) continue;
            const r = await api("GET", `/api/workspace/invoices/${id}`);
            if (r.status !== 200) {
              hatalar.push(`${k} fatura ${ad} okunamadı (${r.status})`);
              continue;
            }
            P[`${k}:fatura:${ad}:acik`] = kurus(r.data.open);
            if (r.data.status === "cancelled") P[`${k}:fatura:${ad}:durum`] = "iptal";
          }
          const planlar = (await api("GET", "/api/workspace/plans")).data?.plans || [];
          for (const [no, anahtar] of Object.entries(ids.anahtar)) {
            const pl = planlar.find(x => x.caseKey === anahtar);
            P[`${k}:kart:${no}:var`] = Boolean(pl);
            if (!pl) continue;
            const d = (await api("GET", `/api/workspace/plans/${pl.id}`)).data;
            Object.assign(P, { [`${k}:kart:${no}:toplam`]: kurus(d?.totals?.total), [`${k}:kart:${no}:odenen`]: kurus(d?.totals?.paid), [`${k}:kart:${no}:kalan`]: kurus(d?.totals?.remaining), [`${k}:kart:${no}:mevcutBorc`]: Boolean(d?.coversBalance) });
            (d?.items || []).forEach((it, i) => (P[`${k}:kart:${no}:taksit${i + 1}:odenen`] = kurus(it.paid)));
          }
          P[`${k}:kasa`] = kurus((await api("GET", "/api/workspace/cash")).data?.totals?.balance);
          const led = await api("GET", "/api/workspace/ledger");
          if (led.status === 200) {
            // Mizan okundu: bakiyesi sıfır olan hesap programın listesinde yer almayabilir → 0 (okunamadı değil).
            for (const kod of ["100", "101", "120", "121", "320", "600", "610", "770"]) P[`${k}:mizan:${kod}`] = 0;
            for (const h of led.data.trial.accounts) if (Math.round(h.balance * 100)) P[`${k}:mizan:${h.code}`] = Math.round(h.balance * 100);
          } else hatalar.push(`${k} mizan okunamadı (${led.status})`);
          {
            // /2 B4 (MM6): yıl başından bugüne Nakit Akışı Kasa giriş/çıkışı ve Kasa raporu (yalnız nakit)
            const aralik = `from=${senaryo.bugun.slice(0, 4)}-01-01&to=${senaryo.bugun}`;
            const na = await api("GET", `/api/workspace/reports/nakit-akis?${aralik}`);
            const tot = na.data?.report?.totals;
            if (tot) Object.assign(P, { [`${k}:nakit:kasaGiris`]: kurus(tot.cashIn), [`${k}:nakit:kasaCikis`]: kurus(tot.cashOut) });
            else ham[`${k}:nakit`] = { status: na.status, data: na.data };
            const kr = await api("GET", `/api/workspace/cash?${aralik}&method=cash`);
            if (kr.data?.totals) Object.assign(P, { [`${k}:kasaRapor:giris`]: kurus(kr.data.totals.in), [`${k}:kasaRapor:cikis`]: kurus(kr.data.totals.out) });
            else hatalar.push(`${k} Kasa raporu okunamadı (${kr.status})`);
          }
          if (Object.keys(ids.anahtar).length) {
            const rp = await api("GET", `/api/workspace/reports/cari-ekstre?from=${senaryo.bugun.slice(0, 4)}-01-01&to=${senaryo.bugun}`);
            const rep = rp.data?.report;
            if (!rep) hatalar.push(`${k} Tablodaki Kişiler okunamadı (${rp.status})`);
            else {
              ham[`${k}:rapor`] = rep.groups.map(g => ({ cari: g.cari, debit: g.debit, credit: g.credit, lines: g.lines.map(l => ({ kind: l.kind, d: l.description, borc: l.borc, alacak: l.alacak, key: l.key })) }));
              for (const [no, anahtar] of Object.entries(ids.anahtar)) {
                const g = rep.groups.find(gr => gr.lines.some(l => l.key === anahtar));
                // Rapor okundu; kişinin satırı yoksa tahsilatı raporda 0'dır (okunamadı değil).
                P[`${k}:rapor:${no}:alacak`] = g ? kurus(g.credit) : 0;
                P[`${k}:rapor:${no}:borc`] = g ? kurus(g.debit) : 0; // /2 B3
                if (g) P[`${k}:rapor:${no}:ad`] = g.cari;
              }
              const top = (arr, f) => arr.reduce((s, x) => s + (kurus(f(x)) || 0), 0);
              P[`${k}:rapor:tutarli`] = kurus(rep.totals.credit) === top(rep.groups, g => g.credit) && kurus(rep.totals.debit) === top(rep.groups, g => g.debit) && rep.groups.every(g => kurus(g.credit) === top(g.lines, l => l.alacak) && kurus(g.debit) === top(g.lines, l => l.borc));
            }
          }
          break;
        }
        default:
          throw new Error(`koşucu işlemi bilmiyor: ${a.islem}`);
      }
    }
  } finally {
    await server.app.close();
    rmSync(veri, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  return { program: P, hatalar, gunluk, ham };
}

const model = (dosya, mut = 0) => JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), dosya, "--mutasyon", String(mut)], { encoding: "utf8" }));
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function karsilastir(beklenen, program) {
  const farklar = [];
  let toplam = 0;
  for (const [anahtar, d] of Object.entries(beklenen.denetimler)) {
    toplam += 1;
    const p = program[anahtar];
    if (!esit(p, d.b)) farklar.push({ anahtar, beklenen: d.b, program: p === undefined ? "okunamadı" : p, etiket: d.e, kural: d.k, sinif: BIRINCIL.has(d.e) ? "BULGU" : "İNCELE" });
  }
  // Kâhinin bildiği kontrol noktalarında programda beklenmeyen bir mizan hesabı varsa (sıfırdan farklı) o da farktır.
  const kontroller = new Set(Object.keys(beklenen.denetimler).filter(k => k.includes(":mizan:")).map(k => k.split(":")[0]));
  for (const [anahtar, v] of Object.entries(program)) {
    const [k, tur] = anahtar.split(":");
    if (tur === "mizan" && v !== 0 && kontroller.has(k) && !(anahtar in beklenen.denetimler)) {
      toplam += 1;
      farklar.push({ anahtar, beklenen: 0, program: v, etiket: "PLAN", kural: "B2.6 kâhinin yazmadığı hesap", sinif: "BULGU" });
    }
  }
  return { toplam, farklar };
}

let genelToplam = 0;
let genelFark = 0;
let okumaHatasi = 0;
const ozet = [];
for (const dosya of dosyalar) {
  const senaryo = JSON.parse(readFileSync(dosya, "utf8"));
  const { program, hatalar, gunluk, ham } = await kos(senaryo);
  writeFileSync(path.join(OUT, `${senaryo.ad}.ham.json`), JSON.stringify(ham, null, 1));
  const beklenen = model(dosya);
  const { toplam, farklar } = karsilastir(beklenen, program);
  genelToplam += toplam;
  genelFark += farklar.length;
  okumaHatasi += hatalar.length;
  writeFileSync(path.join(OUT, `${senaryo.ad}.program.json`), JSON.stringify(program, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.kahin.json`), JSON.stringify(beklenen, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.api-gunlugu.json`), JSON.stringify(gunluk, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.fark.json`), JSON.stringify({ toplam, farklar, hatalar }, null, 1));
  console.log(`${senaryo.ad}: ${toplam - farklar.length}/${toplam} tuttu${hatalar.length ? ` · OKUMA HATASI ${hatalar.length}: ${hatalar.join("; ")}` : ""}`);
  for (const f of farklar) console.log(`  ✗ [${f.sinif} ${f.etiket}] ${f.anahtar}: program ${JSON.stringify(f.program)} · kâhin ${JSON.stringify(f.beklenen)} (${f.kural})${f.anahtar.endsWith(":durum") && program[f.anahtar.replace(/:durum$/, ":yanit")] ? ` · yanıt: ${program[f.anahtar.replace(/:durum$/, ":yanit")]}` : ""}`);
  ozet.push({ ad: senaryo.ad, toplam, fark: farklar.length, bulgu: farklar.filter(f => f.sinif === "BULGU").length });
}

// Mutasyon: her mutasyon senaryo kümesinin en az birinde kâhinin çıktısını değiştirmeli (kural bu senaryolarla gerçekten sınanıyor).
let kacan = 0;
if (!argv.includes("--mutasyonsuz")) {
  const mutasyonlar = JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), "-", "--mutasyonlar"], { encoding: "utf8" }));
  // Mutasyon kümesi: koşulan dosyalar + BÜTÜN elle senaryolar (yalnız kâhin modeli koşar, program açılmaz). Böylece --tohum ile yalnız rastgele UX18 dizileri
  // koşulduğunda da (Uzun Doğrulama) /2 kurallarının (U1/U2/MM6) mutantları elle senaryolarda yakalanır (23.10.2026).
  const elle = readdirSync(path.join(HERE, "senaryolar")).filter(f => f.endsWith(".json")).sort().map(f => path.join(HERE, "senaryolar", f));
  const mutKume = [...new Set([...dosyalar, ...elle])];
  const taban = Object.fromEntries(mutKume.map(d => [d, model(d)]));
  for (const [n, ad] of Object.entries(mutasyonlar)) {
    const yakalayan = mutKume.filter(d => !esit(model(d, Number(n)).denetimler, taban[d].denetimler)).map(d => path.basename(d, ".json"));
    if (!yakalayan.length) kacan += 1;
    console.log(`  mutasyon ${n} (${ad}): ${yakalayan.length ? `YAKALANDI (${yakalayan.slice(0, 3).join(", ")}${yakalayan.length > 3 ? ` +${yakalayan.length - 3}` : ""})` : "YAKALANMADI"}`);
  }
}
writeFileSync(path.join(OUT, "ozet.json"), JSON.stringify({ ozet, genelToplam, genelFark, okumaHatasi, kacan }, null, 1));
console.log(`\nÖZET: ${dosyalar.length} senaryo, ${genelToplam} denetim, ${genelFark} fark (BULGU ${ozet.reduce((s, o) => s + o.bulgu, 0)}), ${okumaHatasi} okuma hatası, ${kacan} yakalanmayan mutasyon. Ham çıktı: ${OUT}`);
console.log(`${Math.max(0, genelToplam - genelFark - okumaHatasi - kacan)}/${genelToplam} denetim geçti`);
process.exitCode = genelFark || okumaHatasi || kacan ? 1 : 0;
