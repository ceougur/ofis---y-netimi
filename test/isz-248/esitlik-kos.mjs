// İŞ Z (2.4.8, T9 ORTA) — EŞİTLİK KOŞUSU: aynı veride, aynı sahte saatle, AYNI işlem dizisini yürütür ve programın gözle görülen bütün çıktısını (önizleme yanıtı,
// toplu iş açma yanıtı / ret iletisi, açılan işin kişi satırları, Başarısızları Yeniden Dene, Yine de Gönder) normalleştirip JSON'a yazar. Bu dosya ESKİ kodun ayrı
// kopyasında (git archive b2e7bf19 — ders 23) ve YENİ kodda ayrı ayrı koşulur; test/isz-248/esitlik.mjs iki çıktıyı derin eşitlikle karşılaştırır. Ürün kodu DEĞİŞMEZ.
// Kullanım: node test/isz-248/esitlik-kos.mjs <veri klasörü> <iş klasörü> <json çıktısı> <saat ISO> [kip=gecmis|taban]
// Dış istek YOK (ders 30): sahte Meta ayrı süreçte, lisans/kapıcı yerel sahte, HUKUK_LICENSE_URL ölü adres. İşçi elle (manual): yalnız açıkça boşaltılan iş gider.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { KOK, surum, kurulum, log } from "./ortak.mjs";
import { PNID, TOKEN, WABA } from "../whatsapp-248-ortak.mjs";

const [VERI, IS, CIKTI, SAAT, KIP = "gecmis"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI || !SAAT) throw new Error("kullanım: esitlik-kos.mjs <veri> <iş> <json> <saat> [kip]");
const W = "/api/workspace/whatsapp";
const sonuc = { kok: KOK, commit: surum(), veri: VERI, saat: SAAT, kip: KIP, adimlar: [] };

// Kimlik normalleştirme: rastgele toplu iş / iş kimlikleri ve sahte Meta wamid'leri ilk görülme sırasıyla adlandırılır (iki koşuda aynı sırayla görünürler).
const takma = new Map();
const sayac = { wab: 0, waj: 0, wamid: 0 };
const ad = (tur, deger) => {
  if (!takma.has(deger)) takma.set(deger, `${tur}#${(sayac[tur] += 1)}`);
  return takma.get(deger);
};
const normal = value =>
  JSON.parse(
    JSON.stringify(value ?? null)
      .replace(/wab-[0-9a-f-]{36}/g, m => ad("wab", m))
      .replace(/waj-[0-9a-f-]{36}/g, m => ad("waj", m))
      .replace(/wamid\.[A-Za-z0-9_=-]+/g, m => ad("wamid", m)),
  );
const kaydet = (adim, r, ek = {}) => {
  const satir = { adim, durum: r.status, govde: normal(r.data), ...ek };
  sonuc.adimlar.push(satir);
  const d = r.data?.data || {};
  log(adim, r.status, d.total !== undefined ? `kişi ${d.total} gönderilecek ${d.sendable}` : d.summary ? `açıldı ${d.summary.total}/${d.summary.sendable}` : String(r.data?.error || r.data?.message || "").slice(0, 120));
  return r;
};

const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `esit${Date.now().toString(36)}` });
try {
  const { admin, at } = ctx;
  const s2 = ctx.sirketler.find(c => String(c.code) === "002")?.id;
  const at2 = u => `${u}${u.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(s2)}`;
  // Silinmiş cariler ve var olmayan kimlik seçime eklenir ("Cari Silinmiş"): kimlikler veri dosyasından (salt okunur).
  const silinmisOf = file => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return db.prepare("SELECT id FROM accounts WHERE deleted_at IS NOT NULL ORDER BY id").all().map(row => row.id);
    } finally {
      db.close();
    }
  };
  const tumOf = async yol => (await admin.get(yol)).data.data.accounts.map(a => a.id);
  const T = [...(await tumOf(at("/api/workspace/accounts?status=all&limit=5000"))), ...silinmisOf(path.join(IS, "data/destekofis.sqlite")), "isz-yok-1"];
  sonuc.secimSayisi = T.length;
  const onizle = (adim, govde, yer = at) => admin.post(yer(`${W}/batches/preview`), govde).then(r => kaydet(adim, r));
  const ac = async (adim, govde, yer = at) => {
    const r = kaydet(adim, await admin.post(yer(`${W}/batches`), govde));
    const id = r.data?.data?.batch?.id;
    if (id) kaydet(`${adim} · iş satırları`, await admin.get(yer(`${W}/batches/${id}`)));
    return id;
  };
  const gun = SAAT.slice(0, 10);
  const ayBasi = `${gun.slice(0, 7)}-01`;
  const onceki = new Date(Date.UTC(Number(gun.slice(0, 4)), Number(gun.slice(5, 7)) - 2, 1));
  const gecenBas = onceki.toISOString().slice(0, 10);
  const gecenSon = new Date(Date.UTC(Number(gun.slice(0, 4)), Number(gun.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const donemler = [
    ["Geçen Ay", { preset: "lastMonth" }],
    ["Bu Ay", { preset: "thisMonth" }],
    ["Son 3 Ay", { preset: "last3" }],
    ["Tüm Hareketler", { preset: "all" }],
    ["Özel = Geçen Ay", { from: gecenBas, to: gecenSon }],
    ["Özel = Bu Ay", { from: ayBasi, to: gun }],
    ["Özel 2026-02", { from: "2026-02-01", to: "2026-02-28" }],
    ["Özel 2025-12-15…2026-01-20", { from: "2025-12-15", to: "2026-01-20" }],
  ];
  // 1) Bütün dönemler × sendAgain false/true + Ödeme Hatırlatma + Tümünü Seç (geçmiş ne olursa olsun).
  for (const [etiket, d] of donemler) {
    await onizle(`önizleme ${etiket}`, { kind: "statement", ids: T, ...d });
    await onizle(`önizleme ${etiket} sendAgain`, { kind: "statement", ids: T, sendAgain: true, ...d });
  }
  await onizle("önizleme Ödeme Hatırlatma", { kind: "reminder", ids: T });
  await onizle("önizleme Ödeme Hatırlatma sendAgain", { kind: "reminder", ids: T, sendAgain: true });
  await onizle("önizleme Tümünü Seç (tümü) Geçen Ay", { kind: "statement", all: true, status: "all", preset: "lastMonth" });
  await onizle("önizleme Tümünü Seç (etkin, 5 hariç) Tüm Hareketler", { kind: "statement", all: true, preset: "all", except: T.slice(0, 5) });
  // 2) Geçmişten gelen Sonucu Belirsiz / Başarısız işler (yalnız geçmişli veride): Yine de Gönder ve Başarısızları Yeniden Dene — kuyruk boşken.
  const db = new DatabaseSync(path.join(IS, "data/destekofis.sqlite"), { readOnly: true });
  const belirsiz = db.prepare("SELECT id, account_id FROM wa_jobs WHERE state = 'uncertain' ORDER BY id").all();
  const basarisizIs = db.prepare("SELECT batch_id FROM wa_jobs WHERE state = 'failed' GROUP BY batch_id ORDER BY batch_id").all().map(row => row.batch_id);
  db.close();
  sonuc.gecmis = { belirsiz: belirsiz.length, basarisizIs: basarisizIs.length };
  const belirsizCariler = [...new Set(belirsiz.map(row => row.account_id))];
  if (belirsizCariler.length) {
    for (const [etiket, d] of donemler) await onizle(`önizleme belirsizli cariler ${etiket}`, { kind: "statement", ids: belirsizCariler, ...d });
    await onizle("önizleme belirsizli cariler Ödeme Hatırlatma", { kind: "reminder", ids: belirsizCariler });
    for (const [etiket, d] of donemler.slice(0, 4)) await ac(`aç (yalnız belirsizli cariler) ${etiket}`, { kind: "statement", ids: belirsizCariler, requestId: `iszB-${etiket.replace(/\W+/g, "")}`, ...d });
  }
  for (const [i, batchId] of basarisizIs.slice(0, 4).entries()) {
    const r = kaydet(`Başarısızları Yeniden Dene ${i + 1}`, await admin.post(at(`${W}/batches/${batchId}/retry-failed`), { requestId: `iszR-${i}` }));
    const id = r.data?.data?.batch?.id;
    if (id) kaydet(`Başarısızları Yeniden Dene ${i + 1} · iş satırları`, await admin.get(at(`${W}/batches/${id}`)));
  }
  for (const [i, job] of belirsiz.slice(0, 4).entries()) {
    const r = kaydet(`Yine de Gönder ${i + 1}`, await admin.post(at(`${W}/jobs/${job.id}/send-anyway`), { confirm: true, requestId: `iszY-${i}` }));
    const id = r.data?.data?.batch?.id;
    if (id) kaydet(`Yine de Gönder ${i + 1} · iş satırları`, await admin.get(at(`${W}/batches/${id}`)));
  }
  // 3) Kuyruk: açılan işler "Zaten Kuyrukta" (aynı dönem, S1a/S1b eşlikleri, Tüm Hareketler'in kişiye özel dönemi).
  const A1 = await ac("aç Geçen Ay (ilk 600)", { kind: "statement", ids: T.slice(0, 600), requestId: "iszA1", preset: "lastMonth" });
  await ac("aç Geçen Ay (aynı istek kimliği)", { kind: "statement", ids: T.slice(0, 600), requestId: "iszA1", preset: "lastMonth" });
  const A2 = await ac("aç Tüm Hareketler (600–1200)", { kind: "statement", ids: T.slice(600, 1200), requestId: "iszA2", preset: "all" });
  const A3 = await ac("aç Ödeme Hatırlatma (tümü)", { kind: "reminder", ids: T, requestId: "iszA3" });
  for (const [etiket, d] of donemler) await onizle(`kuyrukla önizleme ${etiket}`, { kind: "statement", ids: T, ...d });
  await onizle("kuyrukla önizleme Ödeme Hatırlatma", { kind: "reminder", ids: T });
  // 4) Gerçek gönderim (az kişi): kuyruktaki işler iptal edilir, 30 kişilik Bu Ay işi işçiyle boşaltılır → "Daha Önce Gönderildi" + sendAgain.
  for (const id of [A1, A2, A3].filter(Boolean)) kaydet("iptal", await admin.post(at(`${W}/batches/${id}/cancel`), {}));
  const A4 = await ac("aç Bu Ay (1200–1230)", { kind: "statement", ids: T.slice(1200, 1230), requestId: "iszA4", preset: "thisMonth" });
  const A5 = await ac("aç Ödeme Hatırlatma (1200–1260)", { kind: "reminder", ids: T.slice(1200, 1260), requestId: "iszA5" });
  sonuc.yurutulen = await ctx.wa.scheduler.drain({ max: 10_000 });
  if (A4) kaydet("Bu Ay işi gönderildikten sonra", await admin.get(at(`${W}/batches/${A4}`)));
  if (A5) kaydet("Hatırlatma işi gönderildikten sonra", await admin.get(at(`${W}/batches/${A5}`)));
  for (const [etiket, d] of donemler) {
    await onizle(`gönderim sonrası önizleme ${etiket}`, { kind: "statement", ids: T.slice(1150, 1300), ...d });
    await onizle(`gönderim sonrası önizleme ${etiket} sendAgain`, { kind: "statement", ids: T.slice(1150, 1300), sendAgain: true, ...d });
  }
  await onizle("gönderim sonrası önizleme Ödeme Hatırlatma", { kind: "reminder", ids: T.slice(1150, 1300) });
  await ac("aç Bu Ay sendAgain (1195–1215)", { kind: "statement", ids: T.slice(1195, 1215), sendAgain: true, requestId: "iszA6", preset: "thisMonth" });
  await ac("aç Bu Ay (1200–1230, hepsi elenir)", { kind: "statement", ids: T.slice(1200, 1230), requestId: "iszA7", preset: "thisMonth" });
  // 5) İkinci şirket: bağlantı + onay, sonra önizleme / açma.
  if (s2) {
    const c = await admin.put(at2(`${W}/connection`), { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
    const a = await admin.put(at2(`${W}/ack`), { ack: true });
    sonuc.sirket2 = { baglanti: c.status, onay: a.status };
    const T2 = [...(await tumOf(at2("/api/workspace/accounts?status=all&limit=5000"))), "isz-yok-2"];
    for (const [etiket, d] of donemler.slice(0, 5)) await onizle(`şirket 2 önizleme ${etiket}`, { kind: "statement", ids: T2, ...d }, at2);
    await onizle("şirket 2 önizleme Ödeme Hatırlatma", { kind: "reminder", ids: T2 }, at2);
    await ac("şirket 2 aç Geçen Ay (ilk 100)", { kind: "statement", ids: T2.slice(0, 100), requestId: "iszC1", preset: "lastMonth" }, at2);
    await onizle("şirket 2 kuyrukla önizleme Geçen Ay", { kind: "statement", ids: T2, preset: "lastMonth" }, at2);
  }
} finally {
  await ctx.kapat();
}
sonuc.bitti = new Date().toISOString();
writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
log("yazıldı", CIKTI, sonuc.adimlar.length, "adım");
