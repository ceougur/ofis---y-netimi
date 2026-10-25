#!/usr/bin/env node
// Bağımsız CARİ / EVRAK kâhini — kara kutu koşucusu (2.4.4 madde 31a, B1–B2; dil "destekofis-cari/3", /2 ve /1, KARARLAR.md).
// /3 (2.4.5 madde 0b, 24.10.2026): kayıt tahsilatı kapısı (K1; POST/PUT 410 case-payments-closed, DELETE + Silinenler açık), Tablodan Aktar kapısı (410
// table-transfer-closed; eski aktarımın Geri Al'ı açık), uyarı kapısı (madde 4: /dues, Anlık Durum Vade Takip, Nakit Akış Projeksiyonu'nda tablo tutar kalemi yok;
// tutarsız tablo tarihleri `deadlines` KALIR), cari borç vadesi (madde 6: dueDate / expectedDate, S1 FIFO `remaining`, `account|<entryId>` kalemleri). Sunucu anahtarları
// startTestServer seçenekleri `legacyCasePayments` / `legacyTableTransfer` ile verilir (varsayılan KAPALI; senaryonun `anahtar`ı ve `sunucu_yeniden` adımı açar).
//   --legacy: BÜTÜN /1 /2 senaryoları (2.4.5 kararıyla geçersiz olanlar dahil) + rastgele UX18, üç anahtar AÇIK (legacyCasePayments, legacyTableTransfer,
//   legacyTableDues — K1, K4.1) sunucuda, 2.4.4 kurallarıyla. Varsayılan kipte üçü de AÇIKÇA false verilir (K1.2: test yardımcısı seçenek verilmezse açar).
// 2.4.6 (madde 0, 25.10.2026; KARARLAR.md §9): kural seti "2.4.6" VARSAYILAN — 2.4.5 + KS8 iade geri ödemesi (madde 9 / DB1: müşteriye cari "Ödeme" iadeye bağlanır),
// KS9 faturasız Alış İadesi (preturn) gerçek yol + simetrik geri tahsilat (madde 10), KS10 Nakit Akış Projeksiyonu'nda cari vadeli kalemler (madde 11). `--kural 2.4.5`
// 2.4.5 beklentileriyle koşar. Her /3 senaryoda "2.4.6 kararıyla değişen beklenti" (2.4.5 ↔ 2.4.6 kâhin çıktısı farkı) sayılır; programla her fark bu sınıfta mı yazılır.
// /2 (23.10.2026): B3 Tablodaki Kişiler borcu (sekme türü "serbest": başlıklar ve hücre metinleri senaryodan aynen), B4 Nakit Akışı / Kasa raporu Kasa
// giriş-çıkışı (GET /api/workspace/reports/nakit-akis → report.totals.cashIn/cashOut; GET /api/workspace/cash?method=cash → totals.in/out), B5 Nihai
// Tüketici (POST /api/workspace/invoices/retail-account → {id, name, created}); uçlar test/nakit-akis-kasa-mm6, test/nihai-tuketici-u1-244 ÇAĞRI
// satırlarından, yanıt biçimi kara kutu yoklamasından (not defteri yokla3.mjs).
//
//   node test/bagimsiz/cari/kos.mjs [senaryo.json …] [--tohum 1-3 --islem 60] [--tur ux18|s1] [--cikti <klasör>] [--mutasyonsuz] [--legacy | --kural 2.4.5]
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
const BIRINCIL = new Set(["KULLANICI", "PLAN", "GIB", "EDM", "BAŞ MİMAR"]);

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const OUT = opt("--cikti") ? path.resolve(opt("--cikti")) : mkdtempSync(path.join(tmpdir(), "kahin-cari-"));
mkdirSync(OUT, { recursive: true });
let dosyalar = argv.filter((a, i) => a.endsWith(".json") && argv[i - 1] !== "--cikti");
// Bağımsız çağrı (dosya ve tohum verilmeden): bütün elle senaryolar + rastgele tohum 1–2 × 60 işlem (UX18 /2 ve S1 /3; --legacy'de rastgele yok).
const LEGACY = argv.includes("--legacy");
// Kural seti: --legacy → 2.4.4; değilse --kural (varsayılan 2.4.6; 2.4.5 karşılaştırma için)
const KURAL = LEGACY ? "2.4.4" : opt("--kural") || "2.4.6";
if (!["2.4.4", "2.4.5", "2.4.6"].includes(KURAL)) throw new Error(`kural seti bilinmiyor: ${KURAL}`);
const VARSAYILAN = !dosyalar.length && !opt("--tohum");
if (VARSAYILAN) dosyalar = readdirSync(path.join(HERE, "senaryolar")).filter(f => f.endsWith(".json")).sort().map(f => path.join(HERE, "senaryolar", f));
const TOHUM = opt("--tohum") || (VARSAYILAN ? "1-2" : null);
if (TOHUM) {
  const [bas, son] = TOHUM.split("-").map(Number);
  const turler = opt("--tur") ? [opt("--tur")] : LEGACY ? ["ux18"] : ["ux18", "s1"];
  for (let t = bas; t <= (son || bas); t += 1) {
    for (const tur of turler) {
      const yol = path.join(OUT, `rastgele-${tur}-${t}.json`);
      writeFileSync(yol, execFileSync(PYTHON, ["-I", path.join(HERE, "uretici.py"), "--tur", tur, "--tohum", String(t), "--islem", opt("--islem") || "60"], { encoding: "utf8" }));
      dosyalar.push(yol);
    }
  }
}
// 2.4.5 kararıyla geçersiz (/1 /2 senaryosu tablo para yoluna bağlı — KARARLAR.md C0): varsayılan kipte atlanır (sayısı yazılır); --legacy'de bütün /1 /2 koşar, /3 atlanır.
const gecersizOnbellek = new Map();
const gecersizMi = dosya => {
  if (!gecersizOnbellek.has(dosya)) gecersizOnbellek.set(dosya, JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), dosya, "--gecersiz-mi"], { encoding: "utf8" })));
  return gecersizOnbellek.get(dosya);
};
const ATLANAN = [];
const dilOf = d => JSON.parse(readFileSync(d, "utf8")).dil;
dosyalar = dosyalar.filter(d => {
  const kos = LEGACY ? dilOf(d) !== "destekofis-cari/3" : !gecersizMi(d);
  if (!kos) ATLANAN.push(path.basename(d, ".json"));
  return kos;
});

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
  // /2 (23.10.2026, vergi sütunu + kayıt anahtarı): `ilk` ilk sütunların başlıkları — iki başlık ("Fatura No", "Müşteri"): kayıt no + ad; tek başlık ("Müşteri"):
  // Dosya No'suz tablo (yalnız ad; senaryodaki `no` kâhinin iç kimliğidir, tabloya yazılmaz).
  if (sk.tur === "serbest") {
    const ilk = sk.ilk || ["Dosya No", "Borçlu"];
    const bas = r => (ilk.length === 1 ? [r.isim] : [r.dosya ?? r.no, r.isim]); // `dosya`: tabloya yazılan Dosya No (yoksa kâhinin kayıt no'su)
    return [[...ilk, ...sk.basliklar], ...sk.kayitlar.map(r => [...bas(r), ...sk.basliklar.map(h => r.hucreler?.[h] ?? "")])];
  }
  throw new Error(`sekme türü bilinmiyor: ${sk.tur}`);
}

// Anahtarlar (config.legacyCasePayments / legacyTableTransfer; K1): --legacy'de ikisi AÇIK; değilse senaryonun `anahtar`ı / sunucu_yeniden adımı (verilmeyen KAPALI).
// startTestServer'a AÇIKÇA false da verilir: test yardımcısının varsayılanı ne olursa olsun kâhin kapalı kapıyı sınar (eski kodda seçenek yok sayılır).
const anahtarlar = verilen => (LEGACY ? { legacyCasePayments: true, legacyTableTransfer: true, legacyTableDues: true }
  : { legacyCasePayments: Boolean(verilen?.legacyCasePayments), legacyTableTransfer: Boolean(verilen?.legacyTableTransfer), legacyTableDues: Boolean(verilen?.legacyTableDues) });
const sirali = o => Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
const gunEkle = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function kos(senaryo) {
  const veri = mkdtempSync(path.join(tmpdir(), "kahin-cari-veri-"));
  const baslat = verilen => startTestServer({ dataDir: path.join(veri, "data"), now: `${senaryo.bugun}T09:00:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...anahtarlar(verilen) });
  let server = await baslat(senaryo.anahtar);
  let c = server.client();
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
  const ids = { cari: {}, fatura: {}, faturaTutar: {}, evrak: {}, seri: {}, aktar: {}, anahtar: {}, hareket: {}, kayitOdeme: {}, yedek: {}, giris: {}, mizan: {}, anahtarSimdi: senaryo.anahtar };
  let urun = null;
  let seri = 0;
  const durum = (adim, r) => {
    P[`adim:${adim.id}:durum`] = r.status === 200 ? "ok" : r.status >= 500 ? "hata" : "ret";
    P[`adim:${adim.id}:http`] = r.status;
    if (r.status !== 200) {
      P[`adim:${adim.id}:yanit`] = `${r.data?.code || ""} ${String(r.data?.error || "").slice(0, 200)}`;
      // /3: kapı / doğrulama yanıtının gövdesi (K1 code + error; K6.1 field)
      P[`adim:${adim.id}:kod`] = r.data?.code ?? "yok";
      P[`adim:${adim.id}:ileti`] = r.data?.error ?? "yok";
      P[`adim:${adim.id}:alan`] = r.data?.field ?? "yok";
    }
  };
  // /3: hareketin cari kimliği — POST yanıtından sonra cari kartından `note` (= adım id) ile bulunur
  const hareketKaydet = async (ad, cariAd, bul) => {
    const r = await api("GET", `/api/workspace/accounts/${ids.cari[cariAd]}`);
    const e = (r.data?.entries || []).find(bul);
    if (e) ids.hareket[ad] = { cari: cariAd, id: e.id };
    else hatalar.push(`${ad}: carinin hareketlerinde bulunamadı (kimlik okunamadı)`);
  };
  const copBul = async (tur, ref) => {
    const cop = (await api("GET", "/api/admin/trash")).data;
    return (Array.isArray(cop) ? cop : cop?.items || []).find(x => x.kind === tur && (x.ref === ref || JSON.stringify(x).includes(ref)));
  };
  const evrakOku = async ad => (await api("GET", `/api/workspace/cheques?q=${encodeURIComponent(ids.seri[ad])}`)).data?.cheques?.find(x => x.id === ids.evrak[ad]);
  const cariAdi = id => Object.entries(ids.cari).find(([, v]) => v === id)?.[0] ?? `?${id}`;
  // /3 okumaları (2.4.5 madde 4 + madde 6): hareket alanları, takvim kalemleri, Anlık Durum Vade Takip, Nakit Akış Projeksiyonu, yetkisiz kullanıcının takvimi.
  // Koşucu beklenen değer HESAPLAMAZ; alan adları K6.1–K6.3 metninden ve kara kutu yoklamasından (yokla1–3.mjs, not defteri) — yoksa "alan yok" (ders 4).
  async function kontrolV3(k, a, girisler, adlar = {}) {
    const alan = (e, f) => (!(f in e) ? "alan yok" : e[f] === null || e[f] === undefined ? "" : e[f]);
    for (const [ad, h] of Object.entries(ids.hareket)) {
      const e = (girisler[h.cari] || []).find(x => x.id === h.id);
      P[`${k}:hareket:${ad}:var`] = Boolean(e);
      if (!e) continue;
      P[`${k}:hareket:${ad}:kalan`] = "remaining" in e ? (e.remaining === null ? "boş" : kurus(e.remaining)) : "alan yok";
      P[`${k}:hareket:${ad}:vade`] = alan(e, "dueDate");
      P[`${k}:hareket:${ad}:beklenen`] = alan(e, "expectedDate");
    }
    const takvimR = (await api("GET", "/api/workspace/dues")).data || {};
    const items = Array.isArray(takvimR.items) ? takvimR.items : [];
    const cariKalem = items.filter(x => x.source === "account" || String(x.id || "").startsWith("account|"));
    P[`${k}:takvim:cariKalemSayisi`] = cariKalem.length;
    for (const [ad, h] of Object.entries(ids.hareket)) {
      const x = cariKalem.find(y => (y.entryId ?? String(y.id).slice("account|".length)) === h.id);
      P[`${k}:takvim:hareket:${ad}`] = x ? sirali({ amount: kurus(x.amount), dueDate: x.dueDate ?? x.due ?? "alan yok", direction: x.direction ?? "alan yok", label: x.label ?? "alan yok",
        state: x.state ?? "alan yok", days: x.days ?? "alan yok", cari: cariAdi(x.accountId), person: x.person ?? "alan yok" }) : "yok";
    }
    for (const [ad, id] of Object.entries(ids.fatura)) {
      const x = items.find(y => y.id === `invoice|${id}`);
      P[`${k}:takvim:fatura:${ad}`] = x ? sirali({ amount: kurus(x.amount), direction: x.direction }) : "yok";
    }
    for (const [ad, id] of Object.entries(ids.evrak)) {
      const x = items.find(y => y.id === `cheque|${id}`);
      P[`${k}:takvim:cek:${ad}`] = x ? sirali({ amount: kurus(x.amount), direction: x.direction }) : "yok";
    }
    // madde 4: tablodan gelen tutarlı kalem (2.4.4: kimliği "due|…", kaynak alanı yok) ve kayıt başına tablo tutarı; tutarsız tarihler `deadlines`
    const tabloKalemi = x => String(x.id || "").startsWith("due|") || ((!x.source || x.source === "table" || x.source === "promise") && (kurus(x.amount) || 0) > 0);
    P[`${k}:takvim:tabloTutarli`] = items.filter(tabloKalemi).length;
    for (const [no, anahtar] of Object.entries(ids.anahtar)) {
      P[`${k}:takvim:kalemTutar:${no}`] = items.filter(x => (x.caseKey ?? x.key) === anahtar && (!x.source || x.source === "table" || x.source === "promise")).reduce((t, x) => t + (kurus(x.amount) || 0), 0);
      P[`${k}:takvim:deadline:${no}`] = Array.isArray(takvimR.deadlines) ? [...new Set(takvimR.deadlines.filter(x => x.caseKey === anahtar).map(x => x.column ?? x.label))].sort() : "alan yok";
    }
    ham[`${k}:takvimV3`] = { items: items.map(x => Object.fromEntries(Object.entries(x).filter(([, v]) => v === null || typeof v !== "object"))), deadlines: takvimR.deadlines ?? null };
    // Anlık Durum → Vade Takip (GET /overview/vade-takip?preset=open — test çağrı satırları; satır biçimi yoklamadan: source, ref, date, amount, direction)
    const vt = (await api("GET", "/api/workspace/overview/vade-takip?preset=open")).data || {};
    const vtRows = Array.isArray(vt.rows) ? vt.rows : null;
    if (!vtRows) hatalar.push(`${k} Vade Takip okunamadı`);
    else {
      P[`${k}:vadeTakip:tablo`] = vtRows.filter(r => ["table", "promise"].includes(r.source) || (r.ref?.type === "record" && r.source !== "deadline")).length;
      for (const [no, anahtar] of Object.entries(ids.anahtar)) P[`${k}:vadeTakip:deadline:${no}`] = [...new Set(vtRows.filter(r => r.source === "deadline" && r.ref?.key === anahtar).map(r => r.label))].sort();
      for (const [ad, h] of Object.entries(ids.hareket)) {
        const r = vtRows.find(y => JSON.stringify(y).includes(h.id));
        P[`${k}:vadeTakip:hareket:${ad}`] = r ? sirali({ amount: kurus(r.amount), date: r.date ?? r.dueDate ?? "alan yok", direction: r.direction ?? "alan yok" }) : "yok";
      }
      ham[`${k}:vadeTakip`] = vtRows.slice(0, 200);
    }
    // Nakit Akış Projeksiyonu (GET /overview/nakit-akisi; gecikenler dahil, bugün → +30); "Tablo" seçeneği (table=1) de denenir
    const projeksiyon = async ek => {
      const d = (await api("GET", `/api/workspace/overview/nakit-akisi?from=${senaryo.bugun}&to=${gunEkle(senaryo.bugun, 30)}&overdue=1${ek}`)).data || {};
      return [...(Array.isArray(d.rows) ? d.rows : []), ...(Array.isArray(d.overdue) ? d.overdue : [])];
    };
    const tabloSatiri = r => ["table", "promise"].includes(r.source) || r.ref?.type === "record";
    const hIds = Object.values(ids.hareket).map(h => h.id);
    const pr = await projeksiyon("");
    P[`${k}:projeksiyon:tablo`] = pr.filter(tabloSatiri).length;
    P[`${k}:projeksiyon:cari`] = pr.filter(r => r.source === "account" || hIds.some(id => JSON.stringify(r).includes(id))).length;
    // 2.4.6 KS10 (madde 11): hareket başına projeksiyon kalemi (satır biçimi ORTAM yoklaması 25.10.2026: date, direction, amount (TL), source, label, party, ref) — satır
    // kimliği bilinmediği için hareket kimliğini taşıyan satır aranır (Vade Takip okumasıyla aynı); birden çok satır varsa liste yazılır (çift sayım görünür)
    for (const [ad, h] of Object.entries(ids.hareket)) {
      const rs = pr.filter(y => JSON.stringify(y).includes(h.id)).map(r => sirali({ amount: kurus(r.amount), date: r.date ?? r.dueDate ?? "alan yok", direction: r.direction ?? "alan yok" }));
      P[`${k}:projeksiyon:hareket:${ad}`] = rs.length === 0 ? "yok" : rs.length === 1 ? rs[0] : rs;
    }
    // KS10 "bir kez": carinin projeksiyon satırlarının işaretli toplamı (cari adı `party`, cari kimliği ya da hareket kimliği taşıyan bütün satırlar — kaynağı ne olursa olsun)
    for (const [ad, id] of Object.entries(ids.cari)) {
      if (!id) continue;
      const hk = Object.values(ids.hareket).filter(h => h.cari === ad).map(h => h.id);
      const ait = r => { const j = JSON.stringify(r); return (adlar[ad] && r.party === adlar[ad]) || j.includes(id) || hk.some(x => j.includes(x)); };
      P[`${k}:projeksiyon:cariToplam:${ad}`] = pr.filter(ait).reduce((t, r) => t + (r.direction === "out" ? -1 : 1) * (kurus(r.amount) || 0), 0);
    }
    P[`${k}:projeksiyon:tabloSecenek`] = (await projeksiyon("&table=1")).filter(tabloSatiri).length;
    ham[`${k}:projeksiyon`] = pr.slice(0, 200);
    // K6.3: cari görüntüleme yetkisi kaldırılmış kullanıcının takvimi (kurulum denetimi: Cari listesi 403 olmalı — ders 38)
    for (const [ad, g] of Object.entries(ids.giris)) {
      if (!g.kaldir.includes("accounts.view")) continue;
      const kc = ids.kullanici[ad];
      if ((await kc.get("/api/workspace/accounts")).status === 200) hatalar.push(`${k} ${ad}: cari görüntüleme yetkisi kaldırılamadı (Cari listesi açık) — denetim geçersiz`);
      const yr = await kc.get("/api/workspace/dues");
      const yi = unwrap(yr)?.items;
      P[`${k}:yetkisizTakvim:${ad}:cariKalem`] = Array.isArray(yi) ? yi.filter(x => x.source === "account" || String(x.id || "").startsWith("account|")).length : `erisim-${yr.status}`;
    }
  }
  try {
    if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giriş olmadı");
    await api("POST", "/api/workspace/bank/setup/dismiss", {});
    urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "KAHIN-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" })).data?.id;
    for (const a of senaryo.adimlar) {
      const t = a.tarih || senaryo.bugun;
      switch (a.islem) {
        case "tablo_yukle": {
          // Bağ sürekliliği (baş mimar kararı 23.10.2026): "mod": "devam" → Devamı olarak ekle (commit mode "merge"; kara kutu yoklaması), yoksa Yerine koy ("replace").
          // İkinci ve sonraki yüklemede önce ONAYSIZ commit: 200 değilse program onay istedi (`adim:<id>:onay` true); uyarı adları önizleme (stage) yanıtında —
          // mapping (satır yankısı) ve preview.samples dışında — ya da onay isteyen yanıtta geçen tablo adları. Onay bayrağının adı bilinmiyor: aday bayraklar denenir.
          const sheets = a.sekmeler.map(sk => ({ name: sk.ad, matrix: tabloMatrisi(sk) }));
          const sahne = () => api("POST", "/api/workspace/dataset/stage", { kind: "excel", fileName: `${senaryo.ad}.xlsx`, sheets });
          const st = await sahne();
          const mode = a.mod === "devam" ? "merge" : "replace";
          let r = st.status === 200 ? await api("POST", "/api/workspace/dataset/commit", { stageId: st.data.stageId, mode }) : st;
          if (ids.tabloYuklendi && st.status === 200) {
            P[`adim:${a.id}:onay`] = r.status !== 200;
            const adlar = new Set([...(ids.tabloAdlari || []), ...a.sekmeler.flatMap(sk => sk.kayitlar.map(kay => kay.isim))]);
            const metin = [];
            // NETLEŞTİRME (3) (karar sahibi 23.10.2026): önizleme iki seçeneğin (merge = Devamı Olarak Ekle / replace = Yerine Koy) uyarılarını ayrı taşır; her seçeneğin
            // uyarısı yalnız o seçeneğe göre okunur → HER derinlikte öbür seçeneğin adını taşıyan alt ağaç (ör. preview.<öbür>, bonds.<öbür>) ve preview altındaki örnek
            // listeleri ("samples") okunmaz. Bağ önizlemesinde (bonds.<seçenek>) taşınacak bağların SAYISI (moved) uyarı değildir — yalnız adlar aranır.
            const obur = mode === "merge" ? "replace" : "merge";
            const tara = (o, yol) => {
              if (typeof o === "string") metin.push(o);
              else if (Array.isArray(o)) o.forEach(x => tara(x, yol));
              else if (o && typeof o === "object") {
                for (const [k2, v] of Object.entries(o)) {
                  if (yol === "" && k2 === "mapping") continue;
                  if (k2 === obur) continue;
                  if (yol.startsWith("preview") && k2 === "samples") continue;
                  tara(v, yol ? `${yol}.${k2}` : k2);
                }
              }
            };
            tara(st.data, "");
            if (r.status !== 200) tara(r.data, "");
            P[`adim:${a.id}:uyariAdlari`] = [...adlar].filter(ad => metin.some(m => m.includes(ad))).sort();
            ham[`adim:${a.id}:onizleme`] = { stage: Object.fromEntries(Object.entries(st.data || {}).filter(([k2]) => k2 !== "mapping")), ilkCommit: { status: r.status, data: r.data },
              adGecen: metin.filter(m => [...adlar].some(ad => m.includes(ad))).slice(0, 10) };
            if (r.status !== 200) {
              for (const ek of [{ confirm: true }, { confirmed: true }, { confirmUnmatched: true }, { acceptUnmatched: true }, { onay: true }, { force: true }]) {
                const st2 = await sahne();
                const r2 = st2.status === 200 ? await api("POST", "/api/workspace/dataset/commit", { stageId: st2.data.stageId, mode, ...ek }) : st2;
                if (r2.status === 200) {
                  ham[`adim:${a.id}:onayBayragi`] = ek;
                  r = r2;
                  break;
                }
              }
              if (r.status !== 200) hatalar.push(`${a.id} onay istendi ama onay bayrağı bulunamadı (okunamadı) — ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
            }
          }
          durum(a, r);
          ids.tabloYuklendi = true;
          ids.tabloAdlari = [...new Set([...(a.mod === "devam" ? ids.tabloAdlari || [] : []), ...a.sekmeler.flatMap(sk => sk.kayitlar.map(kay => kay.isim))])];
          const pv = await api("GET", "/api/workspace/plans/from-table");
          ham[`tablo:${a.id}:onizleme`] = (pv.data?.records || []).slice(0, 200).map(x => Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v !== "object")));
          for (const sk of a.sekmeler) {
            for (const kay of sk.kayitlar) {
              // Dosya No'suz sekme (`ilk` tek başlık): kayıt ADLA eşlenir (aynı adlı iki kayıt üretilmez); iki kez yüklenen tabloda aynı ad aynı kayda eşlenir.
              const dosya = kay.dosya ?? kay.no;
              const bul = sk.ilk && sk.ilk.length === 1 ? pv.data?.records?.find(x => x.name === kay.isim) : pv.data?.records?.find(x => x.caseNo === dosya && x.name === kay.isim);
              ids.anahtar[kay.no] = bul?.key || (sk.ilk ? ids.anahtar[kay.no] : dosya) || kay.no;
              ((ids.sekmeAd ||= {})[kay.no] ||= new Set()).add(sk.ad);
            }
          }
          // `ilk` sekmeleri (Fatura No + Müşteri / Dosya No'suz): kayıt anahtarı rapordan ADLA çözülür (kara kutu: Dosya No'suz satırın anahtarı "satir:<özet>";
          // önizleme bu kayıtları listelemiyor — yoklama 23.10.2026). Aynı adlı iki `ilk` kaydı üretilmez.
          // `ilk` sekmelerinin kayıtları (bu yüklemede gelenler + önceki yüklemelerden bilinenler — Devamı olarak ekle'de dosyada olmayan mevcut kayıtların anahtarı da
          // güncellemeyle değişebilir) anahtarı rapordan ADLA (aynı adlı birden çok satırda GİRDİ tutarıyla) çözülür; çözülemeyen kayıt `cozulemedi` (okunan değeri
          // "anahtar çözülemedi" yazılır — 0 sanılmaz, ders 4).
          // güncel tablonun Dosya No'suz kayıtları: Yerine koy'da yalnız bu dosyanınkiler (silinen satırın kaydı tabloda değildir), Devamı olarak ekle'de mevcutlar + yeniler
          if (a.mod !== "devam") ids.ilkKayit = a.sekmeler.some(x => x.ilk) ? {} : null;
          for (const sk of a.sekmeler.filter(x => x.ilk)) for (const kay of sk.kayitlar) (ids.ilkKayit ||= {})[kay.no] = kay;
          if (ids.ilkKayit) {
            const cozR = (await api("GET", "/api/workspace/reports/cari-ekstre?from=2000-01-01&to=2099-12-31")).data?.report;
            const satirdaVar = k2 => (cozR?.groups || []).some(g => g.lines.some(l => l.key === k2));
            ids.cozulemedi = new Set();
            for (const kay of Object.values(ids.ilkKayit)) {
              const gs = (cozR?.groups || []).filter(g => g.cari === kay.isim || String(g.cari || "").startsWith(`${kay.isim} (`));
              let keys = [...new Set(gs.flatMap(g => g.lines.map(l => l.key)))];
              if (keys.length > 1 && kay.hucreler?.Tutar) {
                // aynı adlı birden çok satır: satırın GİRDİ tutarıyla ayrılır (beklenen değer değil — tablonun kendi hücresi)
                const t = kurusOf(String(kay.hucreler.Tutar).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
                const kk = [...new Set(gs.flatMap(g => g.lines.filter(l => kurus(l.borc) === t).map(l => l.key)))];
                if (kk.length === 1) keys = kk;
                else if (kk.length > 1 && satirdaVar(ids.anahtar[kay.no])) keys = [ids.anahtar[kay.no]]; // önceki anahtar hâlâ raporda
              }
              if (keys.length === 1) ids.anahtar[kay.no] = keys[0];
              else if (!satirdaVar(ids.anahtar[kay.no])) ids.cozulemedi.add(kay.no);
              ((ids.anahtarGecmis ||= {})[kay.no] ||= []).push(keys.length === 1 ? keys[0] : keys.length ? `belirsiz:${keys.length}` : "yok");
            }
            // İkinci geçiş: aynı ad + aynı GİRDİ tutarlı çözülemeyen kayıtlar raporda birbirinden ayırt edilemez (satırda başka alan yok) — yalnız sayıları tutuyorsa ve
            // başka kayda ait olmayan anahtarlara sıralı atanır (kâhinin bütün denetimlerinde değiştirilebilirler: aynı ad, aynı borç; bağlı tahsilatı olan kayıtta YAPILMAZ).
            const kurusTablo = kay => (kay.hucreler?.Tutar ? kurusOf(String(kay.hucreler.Tutar).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) : null);
            const sahipli = new Set(Object.entries(ids.anahtar).filter(([n]) => !ids.cozulemedi.has(n)).map(([, k2]) => k2));
            const gruplar = {};
            for (const n of ids.cozulemedi) {
              const kay = ids.ilkKayit[n];
              (gruplar[`${kay.isim}|${kurusTablo(kay)}`] ||= []).push(n);
            }
            for (const nos of Object.values(gruplar)) {
              const kay = ids.ilkKayit[nos[0]];
              const t = kurusTablo(kay);
              if (nos.some(n => ids.odemeli?.has(n))) continue;
              const aday = [...new Set((cozR?.groups || []).filter(g => g.cari === kay.isim || String(g.cari || "").startsWith(`${kay.isim} (`))
                .flatMap(g => g.lines.filter(l => kurus(l.borc) === t).map(l => l.key)))].filter(k2 => !sahipli.has(k2)).sort();
              if (aday.length !== nos.length) continue;
              [...nos].sort().forEach((n, i) => {
                ids.anahtar[n] = aday[i];
                ids.cozulemedi.delete(n);
                ids.anahtarGecmis[n].push(`degistirilebilir:${aday[i]}`);
              });
            }
            ham[`tablo:${a.id}:anahtarlar`] = ids.anahtarGecmis;
          }
          break;
        }
        case "cari_ac": {
          const body = { name: a.isim, type: a.tur === "tedarikci" ? "supplier" : "customer", phone: a.tel || "", registeredOn: a.tarih || senaryo.bugun };
          if (a.kayit) Object.assign(body, { caseKey: ids.anahtar[a.kayit], caseTitle: a.isim });
          if (a.tckn) Object.assign(body, { partyKind: "person", firstName: a.isim.split(" ")[0], familyName: a.isim.split(" ").slice(1).join(" ") || a.isim, taxNo: a.tckn, city: "Ankara", district: "Çankaya", similarOk: true });
          if (a.acilis) Object.assign(body, { openingBalance: tlMetin(kurusOf(a.acilis)), openingSide: a.acilisYon === "alacak" ? "credit" : "auto" });
          // /3 K6.1: Açılış Bakiyesi'nin Vade Tarihi / Beklenen Ödeme Tarihi
          if ("acilisVade" in a) body.openingDueDate = a.acilisVade;
          if ("acilisBeklenen" in a) body.openingExpectedDate = a.acilisBeklenen;
          const r = await api("POST", "/api/workspace/accounts", body);
          durum(a, r);
          ids.cari[a.ad] = r.status === 200 ? r.data?.id : undefined;
          if (r.status === 200 && a.acilis) {
            const e = (r.data?.entries || []).find(x => /açılış/i.test(String(x.note || ""))) || (r.data?.entries || [])[0];
            if (e) ids.hareket[`acilis:${a.ad}`] = { cari: a.ad, id: e.id };
            else hatalar.push(`${a.id}: açılış hareketi bulunamadı`);
          }
          break;
        }
        case "tahsilat": {
          // /3 K6.1: tahsilata gönderilen Vade / Beklenen Ödeme Tarihi kaydedilmez (`vade`, `beklenen` yalnız denemek için)
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/entries`, { kind: "in", amount: tlMetin(kurusOf(a.tutar)), date: t, method: a.yol === "havale" ? "bank" : "cash", cashForce: true, similarOk: true, note: a.id, ...(a.fatura ? { invoiceId: ids.fatura[a.fatura] } : {}), ...("vade" in a ? { dueDate: a.vade } : {}), ...("beklenen" in a ? { expectedDate: a.beklenen } : {}) });
          durum(a, r);
          if (r.status === 200) await hareketKaydet(a.id, a.cari, e => e.note === a.id);
          break;
        }
        case "borc":
        case "alacak": {
          // /3 K6.1: elle Borç (debt) / Alacak (credit) + Vade Tarihi (dueDate) + Beklenen Ödeme Tarihi (expectedDate)
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/entries`, { kind: a.islem === "borc" ? "debt" : "credit", amount: tlMetin(kurusOf(a.tutar)), date: t, note: a.id, ...("vade" in a ? { dueDate: a.vade } : {}), ...("beklenen" in a ? { expectedDate: a.beklenen } : {}) });
          durum(a, r);
          if (r.status === 200) await hareketKaydet(a.id, a.cari, e => e.note === a.id);
          break;
        }
        case "odeme": {
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/entries`, { kind: "out", amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash", cashForce: true, similarOk: true, note: a.id, ...(a.fatura ? { invoiceId: ids.fatura[a.fatura] } : {}), ...("vade" in a ? { dueDate: a.vade } : {}) });
          durum(a, r);
          if (r.status === 200) await hareketKaydet(a.id, a.cari, e => e.note === a.id);
          break;
        }
        case "hareket_sil": {
          const h = ids.hareket[a.hareket];
          durum(a, await api("DELETE", `/api/workspace/accounts/${ids.cari[h?.cari]}/entries/${h?.id}?cashForce=1`));
          break;
        }
        case "hareket_geri_yukle": {
          const h = ids.hareket[a.hareket];
          const kalem = await copBul("account-entry", h?.id);
          durum(a, await api("POST", "/api/admin/trash/restore", { id: kalem?.id || `account-entry:${h?.id}`, cashForce: true }));
          break;
        }
        case "hareket_duzenle": {
          // Düzenle: yalnız adımda verilen alanlar gönderilir (kısmi PUT — test çağrı satırları); verilmeyen alanların korunması K6.4
          const h = ids.hareket[a.hareket];
          const govde = { ...("tutar" in a ? { amount: tlMetin(kurusOf(a.tutar)) } : {}), ...("tarih" in a ? { date: a.tarih } : {}), ...("vade" in a ? { dueDate: a.vade } : {}), ...("beklenen" in a ? { expectedDate: a.beklenen } : {}) };
          durum(a, await api("PUT", `/api/workspace/accounts/${ids.cari[h?.cari]}/entries/${h?.id}`, govde));
          break;
        }
        case "donem_kilitle": {
          // K6.5: dönem kilidi (PUT /api/admin/period-lock — test çağrı satırları); boş tarih kilidi açar
          durum(a, await api("PUT", "/api/admin/period-lock", { lockedUntil: a.tarih || "", force: true }));
          break;
        }
        case "stok_iade":
        case "alis_iade":
        case "stok_satis_hesap": {
          // KS7 / KS7.1: faturasız stok hareketi — POST /api/workspace/stock/:id/moves (test çağrı satırları; yoklama 5), Cari Hesap: satış iadesi kind "in" + reason "return"
          // (müşteride alacak satırı); açık alış iadesi kind "out" + reason "preturn" (KS7.1: formda yolu yok — senaryoda kullanılmaz); nedensiz stok çıkışı ("Stok satışı",
          // tedarikçiye de olsa yükümlülük) kind "out", reason yok. Mal kartı ilk kullanımda açılır.
          if (!ids.mal) ids.mal = (await api("POST", "/api/workspace/stock", { kind: "goods", code: "KAHIN-MAL", name: "Kâhin Malı", unit: "Adet", openingQty: "100000", salePrice: "100" })).data?.id;
          const neden = { stok_iade: { kind: "in", reason: "return" }, alis_iade: { kind: "out", reason: "preturn" }, stok_satis_hesap: { kind: "out" } }[a.islem];
          durum(a, await api("POST", `/api/workspace/stock/${ids.mal}/moves`, { ...neden, qty: "1", unitPrice: tlMetin(kurusOf(a.tutar)), pay: "account", accountId: ids.cari[a.cari], date: t }));
          break;
        }
        case "supheli_al": {
          // KS7 / PLAN §3.11b/2: Şüpheli Alacağa Al — POST /api/workspace/accounts/:id/doubtful {amount, date, reason} → { record: { id } } (yoklama 5)
          const r = await api("POST", `/api/workspace/accounts/${ids.cari[a.cari]}/doubtful`, { amount: tlMetin(kurusOf(a.tutar)), date: t, reason: "other" });
          durum(a, r);
          (ids.supheli ||= {})[a.ad] = { id: r.data?.record?.id ?? r.data?.id, cari: a.cari };
          break;
        }
        case "degersiz": {
          // KS7 / PLAN §3.11b/3: Değersiz Alacak Yaz — POST …/doubtful/:id/write-off {amount, date}
          const sp = ids.supheli?.[a.supheli] || {};
          durum(a, await api("POST", `/api/workspace/accounts/${ids.cari[sp.cari]}/doubtful/${sp.id}/write-off`, { amount: tlMetin(kurusOf(a.tutar)), date: t }));
          break;
        }
        case "cari_kalem_odendi": {
          durum(a, await api("POST", "/api/workspace/dues/settle", { id: `account|${ids.hareket[a.hareket]?.id}` }));
          break;
        }
        case "sunucu_yeniden": {
          // /3: program kapanır, AYNI veriyle yeniden açılır; anahtarlar adımdakiler (K1: config.legacyCasePayments / legacyTableTransfer)
          await server.app.close();
          server = await baslat(a.anahtar);
          ids.anahtarSimdi = a.anahtar;
          c = server.client();
          const ok = (await c.login("admin", ADMIN_PASSWORD)).status === 200;
          if (!ok) hatalar.push(`${a.id}: yeniden açılışta giriş olmadı`);
          for (const [ad, g] of Object.entries(ids.giris)) {
            const kc = server.client();
            if ((await kc.login(g.kadi, g.parola)).status !== 200) hatalar.push(`${a.id}: ${ad} yeniden giriş olmadı`);
            ids.kullanici[ad] = kc;
          }
          P[`adim:${a.id}:durum`] = ok ? "ok" : "hata";
          break;
        }
        case "yedek_al": {
          const r = await api("POST", "/api/admin/backups", {});
          durum(a, r);
          ids.yedek[a.ad] = { name: r.data?.name, company: r.data?.company?.id, code: r.data?.company?.code };
          break;
        }
        case "yedek_geri_yukle": {
          const y = ids.yedek[a.yedek] || {};
          const r = await api("POST", "/api/admin/backups/restore", { name: y.name, company: y.company, confirm: y.code, password: ADMIN_PASSWORD });
          durum(a, r);
          // Geri yükleme hazırlanır ve programın yeniden açılışında uygulanır (yoklama 4: { staged: true, restartRequired: true }) → aynı veriyle yeniden aç
          if (r.status === 200 && (r.data?.restartRequired || r.data?.staged)) {
            await server.app.close();
            server = await baslat(ids.anahtarSimdi);
          }
          // geri yüklemeden sonra oturumlar yenilenir (kullanıcı tablosu da yedekten gelebilir)
          c = server.client();
          if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) hatalar.push(`${a.id}: geri yüklemeden sonra giriş olmadı`);
          for (const [ad, g] of Object.entries(ids.giris)) {
            const kc = server.client();
            await kc.login(g.kadi, g.parola);
            ids.kullanici[ad] = kc;
          }
          break;
        }
        case "kayit_tahsilat": {
          (ids.odemeli ||= new Set()).add(a.kayit);
          const r = await api("POST", `/api/workspace/cases/${encodeURIComponent(ids.anahtar[a.kayit] || a.kayit)}/payments`, { amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash" });
          durum(a, r);
          if (r.status === 200) ids.kayitOdeme[a.id] = r.data?.id;
          break;
        }
        case "kayit_tahsilat_duzenle": {
          // K1: eski kayıt tahsilatının düzeltmesi — PUT /api/workspace/payments/:id (test çağrı satırları)
          durum(a, await api("PUT", `/api/workspace/payments/${ids.kayitOdeme[a.odeme]}`, { amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash" }));
          break;
        }
        case "kayit_tahsilat_put": {
          // K1 metnindeki "PUT /api/workspace/cases/:key/payments" (2.4.4 yoklaması: 405)
          durum(a, await api("PUT", `/api/workspace/cases/${encodeURIComponent(ids.anahtar[a.kayit] || a.kayit)}/payments`, { amount: tlMetin(kurusOf(a.tutar)), date: t, method: "cash" }));
          break;
        }
        case "kayit_tahsilat_sil": {
          durum(a, await api("DELETE", `/api/workspace/payments/${ids.kayitOdeme[a.odeme]}?cashForce=1`));
          break;
        }
        case "kayit_tahsilat_geri_yukle": {
          const kalem = await copBul("payment", ids.kayitOdeme[a.odeme]);
          durum(a, await api("POST", "/api/admin/trash/restore", { id: kalem?.id || `payment:${ids.kayitOdeme[a.odeme]}`, cashForce: true }));
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
          ids.faturaTutar[a.ad] = kurusOf(a.tutar);
          if (a.evrak && r.status === 200) {
            ids.seri[a.evrak.ad] = `KH-${seri}`;
            ids.evrak[a.evrak.ad] = (await api("GET", `/api/workspace/cheques?q=${encodeURIComponent(`KH-${seri}`)}`)).data?.cheques?.[0]?.id;
          }
          break;
        }
        case "iade": {
          const asil = (await api("GET", `/api/workspace/invoices/${ids.fatura[a.fatura]}`)).data;
          // 2.4.6 dil eki `geri: "nakit"`: iade bedeli iade belgesinin KENDİ ödeme bölümünden geri ödenir (R1 düzeni) — gövde biçimi test/bagimsiz/surucu.mjs `iade`
          // (payment.cash[{amount, method, lineKey}]); tutar asıl faturanın tutarı (tek kalem, KDV 0, tamamı iade)
          const payment = a.geri === "nakit" ? { cash: [{ amount: tlMetin(ids.faturaTutar[a.fatura]), method: "cash", lineKey: "g1" }] } : {};
          const r = await api("POST", "/api/workspace/invoices", { kind: "sale_return", originalId: asil?.id, issueDate: t, lines: [{ originLineId: asil?.lines?.[0]?.id, qty: 1 }], payment, ...(a.geri ? { cashForce: true, similarOk: true } : {}) });
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
        case "kasa_cikis": {
          // /2 B4: carisiz elle Kasa çıkışı (POST /api/workspace/cash — test/nakit-akis-kasa-mm6 ÇAĞRI satırı)
          durum(a, await api("POST", "/api/workspace/cash", { kind: "out", amount: tlMetin(kurusOf(a.tutar)), date: t, description: a.id }));
          break;
        }
        case "kullanici_ac": {
          // /2 B5b (K5): Kasa'yı görme yetkisi kaldırılmış kullanıcı — POST /api/admin/users + PATCH /api/admin/users/:id { grants } (test ÇAĞRI satırları;
          // rol ve yetki adları kara kutu yoklamasından: "avukat" Nakit Akışı'nı açar, "cash.view" Kasa'yı gösterir)
          const parola = "Kahin-Yetkisiz-2026!";
          // Kullanıcı adı 3–60 karakter (harf, rakam, nokta, tire, alt çizgi) — programın ret iletisinden; senaryodaki ad anahtar olarak kalır.
          const kadi = `kahin-${a.ad.toLowerCase()}`;
          const r = await api("POST", "/api/admin/users", { username: kadi, name: a.ad, role: a.rol || "avukat", password: parola, mustChangePassword: false });
          durum(a, r);
          if (r.status >= 200 && r.status < 300 && (a.kaldir || ["cash.view"]).length) durum(a, await api("PATCH", `/api/admin/users/${r.data?.id}`, { grants: { add: [], remove: a.kaldir || ["cash.view"] } }));
          const kc = server.client();
          if ((await kc.login(kadi, parola)).status !== 200) hatalar.push(`${a.id} kullanıcı girişi olmadı`);
          (ids.kullanici ||= {})[a.ad] = kc;
          ids.giris[a.ad] = { kadi, parola, kaldir: a.kaldir || ["cash.view"] };
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
          const girisler = {}; // /3: cari takma adı → hareketler (entries)
          const adlar = {}; // 2.4.6 KS10: cari takma adı → programdaki adı (projeksiyon satırının `party`si)
          for (const [ad, id] of Object.entries(ids.cari)) {
            if (!id) continue;
            const r = await api("GET", `/api/workspace/accounts/${id}`);
            if (r.status === 200) girisler[ad] = r.data?.entries || [];
            if (r.status === 200) adlar[ad] = r.data?.name ?? r.data?.account?.name ?? null;
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
            ids.mizan[k] = Object.fromEntries(led.data.trial.accounts.map(h => [h.code, Math.round(h.balance * 100)]).filter(([, v]) => v).sort());
            // /3: "Yevmiye DEĞİŞMEZ" — mizan önceki kontroldekiyle aynı mı (vade alanı değişikliğinden sonra)
            if (a.mizanKarsilastir) P[`${k}:mizanEsit`] = ids.mizan[a.mizanKarsilastir] ? JSON.stringify(ids.mizan[k]) === JSON.stringify(ids.mizan[a.mizanKarsilastir]) : "okunamadı";
          } else hatalar.push(`${k} mizan okunamadı (${led.status})`);
          {
            // /2 B4 (MM6): yıl başından bugüne Nakit Akışı Kasa giriş/çıkışı ve Kasa raporu (yalnız nakit)
            const aralik = `from=${senaryo.bugun.slice(0, 4)}-01-01&to=${senaryo.bugun}`;
            const na = await api("GET", `/api/workspace/reports/nakit-akis?${aralik}`);
            const tot = na.data?.report?.totals;
            // 2.4.5 madde 5 (öneri): Kasa sütunları Tablodaki Nakit Akışı'nda kalmayabilir — alan yok / null → "yok"
            const kasaAlani = v => (v === null || v === undefined ? "yok" : kurus(v));
            if (tot) Object.assign(P, { [`${k}:nakit:kasaGiris`]: kasaAlani(tot.cashIn), [`${k}:nakit:kasaCikis`]: kasaAlani(tot.cashOut) });
            else ham[`${k}:nakit`] = { status: na.status, data: na.data };
            // KS4: Tablodaki Nakit Akışı'nda Kasa sütunu var mı (yönetici gözüyle)
            P[`${k}:nakit:kasaSutunu`] = tot ? (kasaAlani(tot.cashIn) === "yok" && kasaAlani(tot.cashOut) === "yok" ? "yok" : "var") : "okunamadı";
            const kr = await api("GET", `/api/workspace/cash?${aralik}&method=cash`);
            if (kr.data?.totals) Object.assign(P, { [`${k}:kasaRapor:giris`]: kurus(kr.data.totals.in), [`${k}:kasaRapor:cikis`]: kurus(kr.data.totals.out) });
            else hatalar.push(`${k} Kasa raporu okunamadı (${kr.status})`);
            // /2 B4b (K4): dört rapor aynı satır borcu (geniş dönem); Tahsilat Takvimi /dues (pencere), Vade Takip toplamı, Nakit Akışı Beklenen
            const genis = "from=2000-01-01&to=2099-12-31";
            // Tablodaki Kişiler geniş dönem: K4 toplamı + B3 dosya no başına borç (kâhin satır borcunu tarihe bakmadan hesaplar; tarih sütunu
            // satırı yıl başı–bugün süzgecinin dışına düşürebilir — b3b'de Ödeme Sözü bugünden sonra)
            const kisR = (await api("GET", `/api/workspace/reports/cari-ekstre?${genis}`)).data?.report;
            ids.genisRapor = kisR;
            const kis = kisR?.totals;
            const takvimR = (await api("GET", "/api/workspace/dues")).data;
            const takvim = takvimR?.items;
            if (Array.isArray(takvim)) ham[`${k}:takvim`] = takvim.map(x => Object.fromEntries(Object.entries(x).filter(([, v]) => v === null || typeof v !== "object"))); // K2/K4 kanıtı (ders 38)
            // Y1 (23.10.2026): "önce cari açın" Açılış Bakiyesi takvim kaleminin Kalan Borç'undan dolar (ORTAM: kalem `debt`) — kayıt başına; kalemi olmayan kayıt 0
            if (Array.isArray(takvim)) {
              for (const [no, anahtar] of Object.entries(ids.anahtar)) {
                const its = takvim.filter(x => (x.caseKey ?? x.key) === anahtar); // kara kutu: kalemin kayıt anahtarı `caseKey` (yoklama 23.10.2026, aday 18)
                // TAKVİM KALEMİ (23.10.2026): kaydın vade kalemi tutarı (kalem yoksa 0; birden çok kalemde liste)
                { const ts = its.map(x => kurus(x.amount) ?? 0); P[`${k}:kalem:${no}`] = ts.length === 0 ? 0 : ts.length === 1 ? ts[0] : ts; }
                P[`${k}:kalemVar:${no}`] = its.length > 0; // Z2 (23.10.2026): Kalan 0 / eksi satırın kalemi Takvim'de görünmez
                P[`${k}:kalemSoz:${no}`] = its.length === 1 ? its[0].promise === true : its.length ? its.map(x => x.promise === true) : false; // ÖDEME SÖZÜ: kalem söz kalemi mi
                if (its.some(x => !("debt" in x))) {
                  P[`${k}:acilis:${no}`] = "OKUNAMADI";
                  // yalnız Açılış Bakiyesi'nin denetlendiği (raporlar: true) kontrolde okuma hatası; taksit kalemlerinde alan yok (b1 senaryoları) — denetlenmez
                  if (a.raporlar && !ids.debtYok) hatalar.push(`${k} ${no}: takvim kaleminde Kalan Borç (debt) alanı yok — Açılış Bakiyesi okunamadı`);
                  if (a.raporlar) ids.debtYok = true;
                  continue;
                }
                // debt null: kalemde Kalan Borç yok → form Açılış Bakiyesi'ni boş getirir (ORTAM varsayımı; formun tutara düşüp düşmediği kara kutudan bilinmiyor) → "boş"
                const vs = its.map(x => (x.debt === null || x.debt === undefined || x.debt === "" ? "boş" : kurus(x.debt)));
                P[`${k}:acilis:${no}`] = vs.length === 0 ? 0 : vs.length === 1 ? vs[0] : vs;
              }
            }
            P[`${k}:takvim:cokSekmeNotu`] = cokSekmeNotu(JSON.stringify(takvimR ?? null)); // /2 B3 K2 (04:09): not Tahsilat Takvimi'nde de
            const vade = (await api("GET", `/api/workspace/reports/vade-takip?${genis}`)).data?.report?.totals;
            const akis = (await api("GET", `/api/workspace/reports/nakit-akis?${genis}`)).data?.report?.totals;
            Object.assign(P, {
              [`${k}:k4:kisiler`]: kis ? kurus(kis.debit) : "okunamadı",
              [`${k}:k4:takvim`]: Array.isArray(takvim) ? takvim.reduce((t, x) => t + (kurus(x.amount) || 0), 0) : "okunamadı",
              [`${k}:k4:vade`]: vade ? kurus(vade.amount) : "okunamadı",
              [`${k}:k4:akis`]: akis ? kurus(akis.expected) : "okunamadı",
            });
            // /2 B5b (K5): Kasa'yı görme yetkisi olmayan kullanıcının Nakit Akışı'nda Kasa giriş/çıkışı gizli + not
            for (const [ad, kc] of Object.entries(ids.kullanici || {})) {
              const yr = await kc.get(`/api/workspace/reports/nakit-akis?${aralik}`);
              const yd = unwrap(yr);
              const yt = yd?.report?.totals;
              P[`${k}:yetkisiz:${ad}:kasa`] = yr.status !== 200 ? `erisim-${yr.status}` : yt && (yt.cashIn === null || yt.cashIn === undefined) && (yt.cashOut === null || yt.cashOut === undefined) ? "gizli" : "gorunur";
              const metinler = [];
              const tara = o => (typeof o === "string" ? metinler.push(o) : o && typeof o === "object" ? Object.values(o).forEach(tara) : null);
              tara(yd);
              P[`${k}:yetkisiz:${ad}:not`] = metinler.some(m => /kasa/i.test(m) && /(yetki|göreme|görüntüle|gizli)/i.test(m));
              P[`${k}:yetkisiz:${ad}:kasaNotu`] = P[`${k}:yetkisiz:${ad}:not`]; // KS4 (2.4.5): not kalkar
              // Kurulum denetimi (ders 38): yetki gerçekten kalktı mı — Kasa sayfası bu kullanıcıya açılıyorsa K5 denetimi geçersizdir (okuma hatası).
              // /3: yalnız Kasa yetkisi kaldırılan kullanıcıda (cari görüntüleme yetkisi kaldırılanın Kasa'sı açıktır)
              const ks = (await kc.get("/api/workspace/cash")).status;
              if (ks === 200 && (ids.giris[ad]?.kaldir || ["cash.view"]).includes("cash.view")) hatalar.push(`${k} ${ad}: Kasa yetkisi kaldırılamadı (Kasa sayfası açık) — K5 denetimi geçersiz`);
              ham[`${k}:yetkisiz:${ad}`] = { status: yr.status, kasaSayfasi: ks, totals: yt ?? null, notlar: metinler.filter(m => /kasa/i.test(m)).slice(0, 5) };
            }
          }
          await kontrolV3(k, a, girisler, adlar);
          if (Object.keys(ids.anahtar).length) {
            const rp = await api("GET", `/api/workspace/reports/cari-ekstre?from=${senaryo.bugun.slice(0, 4)}-01-01&to=${senaryo.bugun}`);
            const rep = rp.data?.report;
            if (!rep) hatalar.push(`${k} Tablodaki Kişiler okunamadı (${rp.status})`);
            else {
              ham[`${k}:raporGenis`] = (ids.genisRapor?.groups || []).map(g => ({ cari: g.cari, debit: g.debit, credit: g.credit, keys: [...new Set(g.lines.map(l => l.key))] }));
              ham[`${k}:rapor`] = rep.groups.map(g => ({ cari: g.cari, debit: g.debit, credit: g.credit, lines: g.lines.map(l => ({ kind: l.kind, d: l.description, borc: l.borc, alacak: l.alacak, key: l.key })) }));
              for (const [no, anahtar] of Object.entries(ids.anahtar)) {
                const g = rep.groups.find(gr => gr.lines.some(l => l.key === anahtar));
                // Rapor okundu; kişinin satırı yoksa tahsilatı raporda 0'dır (okunamadı değil).
                P[`${k}:rapor:${no}:alacak`] = g ? kurus(g.credit) : 0;
                const gg = ids.genisRapor?.groups?.find(gr => gr.lines.some(l => l.key === anahtar));
                P[`${k}:rapor:${no}:borc`] = ids.genisRapor ? (gg ? kurus(gg.debit) : 0) : "okunamadı"; // /2 B3 (geniş dönem)
                if (ids.cozulemedi?.has(no)) {
                  // çözülemeyen anahtar: denetimler OKUNAMADI (fark değil, okuma hatası — ders 4)
                  for (const alan of ["borc", "alacak", "grup", "etiketKimlik", "ad", "gorunurVeyaNot"]) P[`${k}:rapor:${no}:${alan}`] = "OKUNAMADI";
                  hatalar.push(`${k} ${no}: kayıt anahtarı çözülemedi (aynı ad + aynı tutarlı ayırt edilemeyen satırlar) — rapor denetimleri okunamadı`);
                  continue;
                }
                // C3 (23.10.2026): kişi gruplaması — dosya no'nun borçlu satırının bulunduğu rapor satır(lar)ındaki borçlu dosya no'lar; birden çok satırdaysa liste listesi
                if (ids.genisRapor) {
                  // anahtar → kayıt no: İLK kayıt kazanır (Devamı olarak ekle'de içeriği aynı satır mevcut kaydın kendisidir; aynı anahtarı taşır — NETLEŞTİRME (1))
                  const keyNo = new Map();
                  for (const [n, a2] of Object.entries(ids.anahtar)) if (!keyNo.has(a2)) keyNo.set(a2, n);
                  const gruplar = ids.genisRapor.groups.filter(gr => gr.lines.some(l => l.key === anahtar && kurus(l.borc) > 0))
                    .map(gr => [...new Set(gr.lines.filter(l => kurus(l.borc) > 0).map(l => keyNo.get(l.key) ?? `?${l.key}`))].sort());
                  P[`${k}:rapor:${no}:grup`] = gruplar.length === 1 ? gruplar[0] : gruplar;
                  const etiket = String(gruplar.length ? ids.genisRapor.groups.find(gr => gr.lines.some(l => l.key === anahtar && kurus(l.borc) > 0))?.cari ?? "" : "");
                  P[`${k}:rapor:${no}:etiketKimlik`] = (/\d{10,11}/.exec(etiket) || [""])[0];
                  // karar A: borç sütunu belirlenemeyen kişi notsuz kaybolmaz — satırı raporda var mı, yoksa raporda sekme adını ya da "borç/tutar … sütun" diyen not
                  const gorunur = ids.genisRapor.groups.some(gr => gr.lines.some(l => l.key === anahtar));
                  const metinler = [];
                  const tara = o => (typeof o === "string" ? metinler.push(o) : o && typeof o === "object" ? Object.values(o).forEach(tara) : null);
                  tara(rp.data);
                  tara(ids.genisRapor);
                  const sekmeler = [...(ids.sekmeAd?.[no] || [])];
                  // not: sekme adını geçen VE borç/tutar/sütun/gösterilmedi diyen metin ya da "borç/tutar … sütun" kalıbı (yalnız sekme adı — ör. süzgeç seçenekleri — not değil)
                  // Kâhin düzeltmesi (23.10.2026, ders 38): genel "borç … sütun" kalıbı yalnız HİÇBİR sekmenin adını geçmeyen metinde not sayılır — başka sekmenin notu bu satırın
                  // notu değildir (b3n "Takip" kişileri "Masraflı" sekmesinin notuyla yanlışlıkla geçiyordu)
                  const tumSekmeler = [...new Set(Object.values(ids.sekmeAd || {}).flatMap(x => [...x]))];
                  const not = metinler.some(m => sekmeler.some(sa => m.includes(sa) && /(borç|tutar|sütun|gösteril|görün)/i.test(m))
                    || (!tumSekmeler.some(sa => m.includes(sa)) && /(borç|tutar)[^.]{0,40}sütun|sütun[^.]{0,40}(borç|tutar)/i.test(m)));
                  P[`${k}:rapor:${no}:gorunurVeyaNot`] = gorunur || not;
                  // A1 + tek tutar sütunu (23.10.2026): borcu belli satırın sekmesi için "borç sütunu belirlenemedi" türü not YOK (sekme adını geçen + sütun/belirleme sözcüğü)
                  const notMetin = metinler.filter(m => sekmeler.some(sa => m.includes(sa)) && /(borç sütun|tutar sütun|belirlenemed|belirlenemey|gösterilmed)/i.test(m));
                  P[`${k}:rapor:${no}:notYok`] = notMetin.length === 0;
                  if (notMetin.length) ham[`${k}:not:${no}`] = notMetin.slice(0, 5);
                  if (!gorunur) ham[`${k}:kayip:${no}`] = { not, notlar: metinler.filter(m => /sütun|sekme/i.test(m)).slice(0, 5) };
                }
                if (g) P[`${k}:rapor:${no}:ad`] = g.cari;
              }
              const top = (arr, f) => arr.reduce((s, x) => s + (kurus(f(x)) || 0), 0);
              // /2 B3 K2 (04:09): "N dosya no birden çok sekmede; ayrı sayıldı" notu — rapor yanıtının herhangi bir metninde (alan adı bilinmiyor)
              P[`${k}:rapor:cokSekmeNotu`] = cokSekmeNotu(JSON.stringify(rp.data) + JSON.stringify(ids.genisRapor ?? null));
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

const model = (dosya, mut = 0, kural = KURAL) => JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), dosya, "--mutasyon", String(mut), ...(kural === "2.4.4" ? ["--legacy"] : ["--kural", kural])], { encoding: "utf8" }));
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 2.4.6 sınıflama yardımcıları: denetim anahtarının carisi (fatura / hareket / cari takma adından; genel anahtarlarda null) ve faturasız Alış İadesi olan cariler
function anahtarCarisi(senaryo, anahtar) {
  const p = anahtar.split(":");
  const adim = id => senaryo.adimlar.find(x => x.id === id);
  const fatura = ad => { const f = senaryo.adimlar.find(x => (x.islem === "fatura" || x.islem === "iade") && x.ad === ad); return f ? (f.cari ?? fatura(f.fatura)) : null; };
  const hareket = ad => (ad.startsWith("acilis:") ? ad.slice(7) : adim(ad)?.cari ?? null);
  if (p[1] === "cari" || (p[1] === "projeksiyon" && p[2] === "cariToplam")) return p[p[1] === "cari" ? 2 : 3];
  if (p[1] === "fatura") return fatura(p[2]);
  if (["takvim", "vadeTakip", "projeksiyon"].includes(p[1]) && p[2] === "fatura") return fatura(p[3]);
  if (p[1] === "hareket") return hareket(p.slice(2, -1).join(":"));
  if (["takvim", "vadeTakip", "projeksiyon"].includes(p[1]) && p[2] === "hareket") return hareket(p.slice(3).join(":"));
  return null;
}
const ks9Cariler = senaryo => new Set(senaryo.adimlar.filter(x => x.islem === "alis_iade").map(x => x.cari));
// /2 B3 K2 ([KULLANICI] 23.10.2026 04:09 UTC): "N dosya no birden çok sekmede; ayrı sayıldı" → N. Not yoksa 0; 03:12 metni ("bir kez sayıldı") ya da sonu
// okunamayan not "bir-kez:N" / "metin:N" olarak yazılır (beklenenle tutmaz — fark; ders 38: hangi metin göründüğü raporda okunur).
function cokSekmeNotu(metin) {
  const m = /(\d+)\s*dosya no birden çok sekmede[^"\d]{0,20}?(ayrı|bir kez)\s*sayıldı/i.exec(metin);
  if (m) return /ayrı/i.test(m[2]) ? Number(m[1]) : `bir-kez:${m[1]}`;
  const e = /(\d+)\s*dosya no birden çok sekmede/i.exec(metin);
  return e ? `metin:${e[1]}` : 0;
}
function karsilastir(beklenen, program) {
  const farklar = [];
  let toplam = 0;
  for (const [anahtar, d] of Object.entries(beklenen.denetimler)) {
    toplam += 1;
    const p = program[anahtar];
    if (p === "OKUNAMADI") continue; // okuma hatası olarak sayıldı (hatalar), fark değil
    // /2: ÇATAL beklenen ({ catal: [...] }) — kural birden çok değere izin veriyor (K2 hangi sekme; not sayımı)
    const tutar = d.b && typeof d.b === "object" && Array.isArray(d.b.catal) ? d.b.catal.some(x => esit(p, x)) : esit(p, d.b);
    if (!tutar) farklar.push({ anahtar, beklenen: d.b, program: p === undefined ? "okunamadı" : p, etiket: d.e, kural: d.k, sinif: BIRINCIL.has(d.e) ? "BULGU" : "İNCELE" });
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

// ───────── BİLİNEN SINIR listesi (ana oturum 23.10.2026): ürün sahibinin ERTELEDİĞİ, kâhin beklentisi DOĞRU kalan farklar (BILINEN.json). Her kayıt TAM ad (senaryo +
// denetim anahtarı; joker / önek / kalıp YOK), karar kaynağı, kâhinin beklediği ve programın BİLİNEN değeri. Listedeki fark "BİLİNEN" diye ayrı yazılır, başarısız sayılmaz;
// program değeri (ya da kâhin beklentisi) listedekinden farklıysa BAŞARISIZ ("BİLİNEN DEĞİŞTİ"); listede olup farkı kalmayan kayıt BAŞARISIZ ("BİLİNEN KAPANDI — listeden çıkar");
// liste dışı her fark BAŞARISIZ. Liste mutantları (aşağıda) eşleştiricinin bir farkı yutmadığını sınar.
const BILINEN_YOLU = process.env.KAHIN_BILINEN || path.join(HERE, "BILINEN.json"); // KAHIN_BILINEN: yalnız mekanizmanın kendi denemesi için başka liste
function bilinenYukle() {
  const ham = JSON.parse(readFileSync(BILINEN_YOLU, "utf8"));
  const kayitlar = ham.kayitlar || [];
  const hatalar = [];
  const gorulen = new Set();
  const elleAdlar = new Set(readdirSync(path.join(HERE, "senaryolar")).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, "")));
  for (const [i, e] of kayitlar.entries()) {
    for (const alan of ["senaryo", "anahtar", "kaynak", "beklenen", "program"]) if (!(alan in e)) hatalar.push(`BILINEN.json kayıt ${i}: "${alan}" alanı yok`);
    if (/[*?\[\]]/.test(`${e.senaryo}${e.anahtar}`)) hatalar.push(`BILINEN.json kayıt ${i}: joker / kalıp karakteri yasak (tam ad gerekir): ${e.senaryo} ${e.anahtar}`);
    if (!elleAdlar.has(e.senaryo) && !String(e.senaryo).startsWith("rastgele-")) hatalar.push(`BILINEN.json kayıt ${i}: senaryo yok (bayat kayıt): ${e.senaryo}`);
    const ad = `${e.senaryo}|${e.anahtar}`;
    if (gorulen.has(ad)) hatalar.push(`BILINEN.json kayıt ${i}: çift kayıt ${ad}`);
    gorulen.add(ad);
  }
  return { kayitlar, hatalar };
}
// mut (yalnız liste mutantları için): 1 senaryo adı yok sayılır · 2 alt dizgi eşleşmesi (joker) · 3 program değeri karşılaştırılmaz · 4 kapanan kayıt denetlenmez ·
// 5 kâhin beklentisi karşılaştırılmaz
function bilinenAyir(senaryoAd, denetimler, farklar, liste, mut = 0) {
  const eslesir = (e, f) => (mut === 1 || e.senaryo === senaryoAd) && (mut === 2 ? f.anahtar.includes(e.anahtar) : e.anahtar === f.anahtar);
  const kalan = [], bilinen = [];
  for (const f of farklar) {
    const e = liste.find(x => eslesir(x, f));
    if (!e) { kalan.push(f); continue; }
    if ((mut === 3 || esit(f.program, e.program)) && (mut === 5 || esit(f.beklenen, e.beklenen))) bilinen.push({ ...f, sinif: "BİLİNEN", kaynak: e.kaynak });
    else kalan.push({ ...f, sinif: "BİLİNEN DEĞİŞTİ", kural: `${f.kural} · BİLİNEN listesinde program ${JSON.stringify(e.program)} / kâhin ${JSON.stringify(e.beklenen)} (${e.kaynak}) — liste ya da ürün yeniden incelenmeli` });
  }
  if (mut !== 4) {
    for (const e of liste.filter(x => (mut === 1 || x.senaryo === senaryoAd))) {
      if (farklar.some(f => eslesir(e, f))) continue;
      kalan.push({ anahtar: e.anahtar, beklenen: e.beklenen, program: e.anahtar in denetimler ? "tuttu" : "denetim yok", etiket: "BİLİNEN", sinif: "BİLİNEN KAPANDI",
        kural: `BİLİNEN KAPANDI — listeden çıkar (${e.kaynak})` });
    }
  }
  return { kalan, bilinen };
}
// Liste mutantlarının dişi: sentetik durumlarda doğru eşleştirici ile her mutant en az bir durumda farklı sonuç vermeli (ders 7).
function bilinenMutantlari() {
  const L = [{ senaryo: "S", anahtar: "k1:kalem:2026/101", kaynak: "deneme", beklenen: 1, program: 2 }, { senaryo: "S", anahtar: "k1:acilis:X", kaynak: "deneme", beklenen: 5, program: 6 }];
  const F = (anahtar, beklenen, program) => ({ anahtar, beklenen, program, etiket: "KULLANICI", kural: "deneme", sinif: "BULGU" });
  const durumlar = [
    ["S", { "k1:kalem:2026/101": {}, "k1:kalem:2026/1012": {}, "k1:acilis:X": {} }, [F("k1:kalem:2026/101", 1, 2), F("k1:kalem:2026/1012", 1, 2), F("k1:acilis:X", 5, 6)]],
    ["T", { "k1:kalem:2026/101": {} }, [F("k1:kalem:2026/101", 1, 2)]],
    ["S", { "k1:kalem:2026/101": {}, "k1:acilis:X": {} }, [F("k1:kalem:2026/101", 1, 3), F("k1:acilis:X", 5, 6)]],
    ["S", { "k1:kalem:2026/101": {}, "k1:acilis:X": {} }, [F("k1:acilis:X", 5, 6)]],
    ["S", { "k1:kalem:2026/101": {}, "k1:acilis:X": {} }, [F("k1:kalem:2026/101", 9, 2), F("k1:acilis:X", 5, 6)]],
  ];
  const imza = mut => JSON.stringify(durumlar.map(([s, d, f]) => { const r = bilinenAyir(s, d, f, L, mut); return [r.bilinen.map(x => x.anahtar), r.kalan.map(x => `${x.anahtar}:${x.sinif}`)]; }));
  const dogru = imza(0);
  const adlar = { 1: "senaryo adı yok sayılır", 2: "alt dizgi (joker) eşleşmesi", 3: "program değeri karşılaştırılmaz", 4: "kapanan kayıt denetlenmez", 5: "kâhin beklentisi karşılaştırılmaz" };
  return Object.entries(adlar).map(([n, ad]) => ({ n, ad, yakalandi: imza(Number(n)) !== dogru }));
}
const BILINEN = bilinenYukle();

const GECERSIZ_DENETIM = [];
const DEGISEN = [];          // 2.4.6 kararıyla değişen beklenti (senaryo başına)
const SINIF = { ic: 0, ks9: 0, dis: 0 }; // programla farkların 2.4.6 sınıfında / KS9 madde 10 yolunda / dışında olanları
let genelToplam = 0;
let genelFark = 0;
let okumaHatasi = 0;
let genelBilinen = 0;
const bilinenHepsi = [];
const ozet = [];
for (const dosya of dosyalar) {
  const senaryo = JSON.parse(readFileSync(dosya, "utf8"));
  const { program, hatalar, gunluk, ham } = await kos(senaryo);
  writeFileSync(path.join(OUT, `${senaryo.ad}.ham.json`), JSON.stringify(ham, null, 1));
  const beklenen = model(dosya);
  // 2.4.5 kararıyla geçersiz DENETİMLER (K4.1, C0): varsayılan kipte /1 /2 senaryosunda 2.4.4 kural setinin yazıp 2.4.5'in yazmadığı denetimler (yalnız --legacy'de koşar)
  if (!LEGACY && senaryo.dil !== "destekofis-cari/3") {
    const eski = model(dosya, 0, "2.4.4").denetimler;
    const atlananDenetim = Object.keys(eski).filter(x => !(x in beklenen.denetimler));
    if (atlananDenetim.length) GECERSIZ_DENETIM.push({ senaryo: senaryo.ad, adet: atlananDenetim.length, ornek: atlananDenetim.slice(0, 3) });
  }
  const { toplam, farklar: tumFarklar } = karsilastir(beklenen, program);
  // 2.4.6 kararıyla DEĞİŞEN beklenti (KARARLAR.md §9 C0b): 2.4.5 kâhininin bu anahtardaki beklentisi farklıysa (ya da anahtar yoksa) programla fark "beklenen sınıf"tadır —
  // 2.4.5 kodunda (değişmemiş program) yalnız bu sınıfta fark beklenir; sınıf dışı fark eski kuralın farkıdır (BULGU / İNCELE, ayrıca incelenir)
  let degisen = null;
  if (KURAL === "2.4.6") {
    const eski = model(dosya, 0, "2.4.5").denetimler;
    degisen = new Set(Object.keys(beklenen.denetimler).filter(x => !(x in eski) || !esit(eski[x].b, beklenen.denetimler[x].b)));
    DEGISEN.push({ senaryo: senaryo.ad, adet: degisen.size });
    // KS9 (madde 10): faturasız Alış İadesi (preturn) 2.4.4/2.4.5'te YALNIZ birim düzeyinde vardı (iş listesi "BİLİNEN SINIR: stok formunda faturasız Alış İadesi yok");
    // kuralı (KS7 simetri) 2.4.5 kâhininde de aynıdır ama yolu bu sürümde açılır → o carinin denetimlerindeki fark da beklenen sınıftır (ayrı sayılır)
    const ks9 = ks9Cariler(senaryo);
    for (const f of tumFarklar) {
      const c = anahtarCarisi(senaryo, f.anahtar);
      f.sinif246 = degisen.has(f.anahtar) ? "2.4.6 kararıyla değişen" : c && ks9.has(c) ? "KS9 madde 10 yolu" : "SINIF DIŞI";
    }
  }
  // /3: BILINEN kaydının `kural` alanı varsa yalnız o kural setinde uygulanır (2.4.5'te konusu kalkan Takvim / Açılış Bakiyesi kayıtları "2.4.4")
  const { kalan: farklar, bilinen } = bilinenAyir(senaryo.ad, beklenen.denetimler, tumFarklar, BILINEN.kayitlar.filter(e => !e.kural || e.kural === KURAL));
  genelToplam += toplam;
  genelFark += farklar.length;
  genelBilinen += bilinen.length;
  bilinenHepsi.push(...bilinen.map(b => ({ senaryo: senaryo.ad, ...b })));
  okumaHatasi += hatalar.length;
  writeFileSync(path.join(OUT, `${senaryo.ad}.program.json`), JSON.stringify(program, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.kahin.json`), JSON.stringify(beklenen, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.api-gunlugu.json`), JSON.stringify(gunluk, null, 1));
  writeFileSync(path.join(OUT, `${senaryo.ad}.fark.json`), JSON.stringify({ toplam, farklar, bilinen, hatalar }, null, 1));
  console.log(`${senaryo.ad}: ${toplam - farklar.length - bilinen.length}/${toplam} tuttu${bilinen.length ? ` · BİLİNEN ${bilinen.length}` : ""}${hatalar.length ? ` · OKUMA HATASI ${hatalar.length}: ${hatalar.join("; ")}` : ""}`);
  for (const b of bilinen) console.log(`  ≈ [BİLİNEN] ${b.anahtar}: program ${JSON.stringify(b.program)} · kâhin ${JSON.stringify(b.beklenen)} (${b.kaynak})`);
  if (degisen) {
    const ic = farklar.filter(f => f.sinif246 === "2.4.6 kararıyla değişen").length;
    const k9 = farklar.filter(f => f.sinif246 === "KS9 madde 10 yolu").length;
    const dis = farklar.length - ic - k9;
    SINIF.ic += ic;
    SINIF.ks9 += k9;
    SINIF.dis += dis;
    if (degisen.size || farklar.length) console.log(`  2.4.6 kararıyla değişen beklenti: ${degisen.size} denetim · farkların ${ic}/${farklar.length}'i bu sınıfta${k9 ? `, ${k9}'i KS9 (madde 10 yolu)` : ""}${dis ? ` — SINIF DIŞI ${dis}` : ""}`);
  }
  for (const f of farklar) console.log(`  ✗ [${f.sinif} ${f.etiket}${f.sinif246 === "SINIF DIŞI" ? " · SINIF DIŞI" : f.sinif246 === "KS9 madde 10 yolu" ? " · KS9" : ""}] ${f.anahtar}: program ${JSON.stringify(f.program)} · kâhin ${JSON.stringify(f.beklenen)} (${f.kural})${f.anahtar.endsWith(":durum") && program[f.anahtar.replace(/:durum$/, ":yanit")] ? ` · yanıt: ${program[f.anahtar.replace(/:durum$/, ":yanit")]}` : ""}`);
  ozet.push({ ad: senaryo.ad, toplam, fark: farklar.length, bulgu: farklar.filter(f => f.sinif === "BULGU").length, bilinen: bilinen.length });
}

// Mutasyon: her mutasyon senaryo kümesinin en az birinde kâhinin çıktısını değiştirmeli (kural bu senaryolarla gerçekten sınanıyor).
let kacan = 0;
if (!argv.includes("--mutasyonsuz")) {
  const mutasyonlar = JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), "-", "--mutasyonlar"], { encoding: "utf8" }));
  // Mutasyon kümesi: koşulan dosyalar + BÜTÜN elle senaryolar (yalnız kâhin modeli koşar, program açılmaz). Böylece --tohum ile yalnız rastgele UX18 dizileri
  // koşulduğunda da (Uzun Doğrulama) /2 kurallarının (U1/U2/MM6) mutantları elle senaryolarda yakalanır (23.10.2026).
  const elle = readdirSync(path.join(HERE, "senaryolar")).filter(f => f.endsWith(".json")).sort().map(f => path.join(HERE, "senaryolar", f));
  // /3: her dosya kendi kural setinde değerlendirilir — geçersiz /1 /2 → 2.4.4 (legacy); /3 → 2.4.5; öbür /1 /2 → İKİSİ (2.4.5'te konusu kalkan 2.4.4 kurallarının — ör.
  // takvim kalemi, Açılış Bakiyesi ön dolumu — mutantları legacy değerlendirmesinde yakalanır). Program açılmaz.
  const mutKume = [...new Set([...elle, ...dosyalar])]; // elle senaryolar ÖNCE (küçük; mutantların çoğunu yakalar) — büyük rastgele dosyalar yalnız gerekince model koşar
  // 2.4.6: /3 dosyaları İKİ kipte (2.4.6 + 2.4.5 — 2.4.6 kararıyla geçersiz mutant 99 yalnız 2.4.5 değerlendirmesinde yakalanır), öbür /1 /2 2.4.6 + 2.4.4
  const kipler = d => {
    if (gecersizMi(d)) return ["2.4.4"];
    const ana = KURAL === "2.4.4" ? "2.4.5" : KURAL;
    if (JSON.parse(readFileSync(d, "utf8")).dil === "destekofis-cari/3") return ["2.4.6", "2.4.5"]; // her kipte iki kural seti (2.4.6 mutantları --legacy / --kural 2.4.5'te de)
    return [ana, "2.4.4"];
  };
  // Tek Python sürecinde (model.py --mutasyon-tara): her mutant için ilk 3 yakalayan (dosya, kip) — 100+ mutant × 40+ dosya × 1–2 kip, süreç başlatma maliyeti yok
  const liste = path.join(OUT, "mutasyon-listesi.json");
  writeFileSync(liste, JSON.stringify(mutKume.map(d => ({ dosya: d, kipler: kipler(d) }))));
  const tarama = JSON.parse(execFileSync(PYTHON, ["-I", path.join(HERE, "model.py"), "-", "--mutasyon-tara", liste], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  for (const [n, ad] of Object.entries(mutasyonlar)) {
    const yakalayan = (tarama[n]?.yakalayan || []).map(y => `${path.basename(y.dosya, ".json")}${y.kip !== KURAL && !(y.kip === "2.4.4" && gecersizMi(y.dosya)) ? `[${y.kip}]` : ""}`);
    if (!yakalayan.length) kacan += 1;
    console.log(`  mutasyon ${n} (${ad}): ${yakalayan.length ? `YAKALANDI (${yakalayan.join(", ")}${yakalayan.length >= 3 ? " …" : ""})` : "YAKALANMADI"}`);
  }
}
// BİLİNEN listesi: geçersiz kayıt BAŞARISIZ; liste mutantları her koşuda (program açılmaz)
for (const h of BILINEN.hatalar) console.log(`  ✗ [BİLİNEN LİSTESİ] ${h}`);
genelFark += BILINEN.hatalar.length;
for (const m of bilinenMutantlari()) {
  if (!m.yakalandi) kacan += 1;
  console.log(`  liste mutasyonu ${m.n} (${m.ad}): ${m.yakalandi ? "YAKALANDI" : "YAKALANMADI"}`);
}
writeFileSync(path.join(OUT, "ozet.json"), JSON.stringify({ kip: LEGACY ? "legacy (2.4.4 kuralları, anahtarlar açık)" : KURAL, ozet, degisen246: DEGISEN, farkSinifi246: KURAL === "2.4.6" ? SINIF : null, genelToplam, genelFark, okumaHatasi, kacan, bilinen: genelBilinen, bilinenKayitlar: bilinenHepsi, bilinenListesiHatalari: BILINEN.hatalar, atlanan: ATLANAN, gecersizDenetim: GECERSIZ_DENETIM }, null, 1));
if (!LEGACY) console.log(`\nGEÇERSİZ DENETİM (2.4.5 kararıyla; --legacy'de koşar — KARARLAR.md §8 C0): ${GECERSIZ_DENETIM.reduce((t, x) => t + x.adet, 0)} denetim, ${GECERSIZ_DENETIM.length} senaryo${GECERSIZ_DENETIM.length ? ` — ${GECERSIZ_DENETIM.map(x => `${x.senaryo} ${x.adet}`).join(", ")}` : ""}`);
console.log(`\nATLANAN (${LEGACY ? "/3 — yalnız varsayılan kipte koşar" : "2.4.5 kararıyla geçersiz — --legacy ile koşar"}): ${ATLANAN.length}${ATLANAN.length ? ` — ${ATLANAN.join(", ")}` : ""}`);
if (KURAL === "2.4.6") console.log(`\n2.4.6 KARARIYLA DEĞİŞEN BEKLENTİ (KARARLAR.md §9 C0b): ${DEGISEN.reduce((t, x) => t + x.adet, 0)} denetim, ${DEGISEN.filter(x => x.adet).length} senaryo · programla farkların ${SINIF.ic}'i bu sınıfta, ${SINIF.ks9}'i KS9 (madde 10: faturasız Alış İadesi yolu 2.4.5'te yok), ${SINIF.dis}'i SINIF DIŞI`);
console.log(`\nÖZET [${LEGACY ? "legacy" : KURAL}]: ${dosyalar.length} senaryo, ${genelToplam} denetim, ${genelFark} fark (BULGU ${ozet.reduce((s, o) => s + o.bulgu, 0)}), ${genelBilinen} bilinen sınır (BILINEN.json; başarısız sayılmaz), ${okumaHatasi} okuma hatası, ${kacan} yakalanmayan mutasyon, ${ATLANAN.length} atlanan senaryo. Ham çıktı: ${OUT}`);
if (genelBilinen) console.log(`BİLİNEN SINIRLAR (${genelBilinen}): ${bilinenHepsi.map(b => `${b.senaryo} ${b.anahtar}`).join("; ")}`);
// "geçti" sayısı bilinen sınırları içerir (başarısız sayılmaz — CI kapısı); ayrıntısı yukarıdaki BİLİNEN satırlarında ve ozet.json "bilinen" alanında
console.log(`${Math.max(0, genelToplam - genelFark - okumaHatasi - kacan)}/${genelToplam} denetim geçti${genelBilinen ? ` (${genelBilinen} bilinen sınır dahil)` : ""}`);
process.exitCode = genelFark || okumaHatasi || kacan ? 1 : 0;
