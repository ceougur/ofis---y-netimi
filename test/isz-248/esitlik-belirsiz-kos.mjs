// İŞ Z (2.4.8) — EŞİTLİK KOŞUSU (hedefli): "Sonucu Belirsiz" ve "taşınan veri" yolları. Büyük eşitlik koşusunun (esitlik-kos.mjs) hazır dönemleri geçmişteki
// belirsiz işlerin dönemiyle eşleşmediğinden bu koşu dönemleri VERİNİN KENDİSİNDEN alır: her belirsiz işin toplu işinin kayıtlı dönemi (özel aralık → aynı tarihler,
// Son 3 Ay / Tüm → aynı seçim; saat o işin 7 günlük penceresine alınabilir). Her dönemde: belirsizli cariler + 20 başka cari ile önizleme (sendAgain yok / var),
// yalnız belirsizli carilerle açma (hepsi elenirse ret iletisi: işteki "Yine de Gönder" / "yeni gönderim başlatın" ayrımı = uncertainOpen), Ödeme Hatırlatma önizlemesi;
// sonra her belirsiz iş için "Yine de Gönder" (onaylı) ve açılan işin satırları. Eski (b2e7bf19 arşiv kopyası) ve yeni kodda ayrı ayrı; esitlik-karsilastir.mjs karşılaştırır.
// Kullanım: node test/isz-248/esitlik-belirsiz-kos.mjs <veri> <iş> <json> <saat ISO> [etiket]
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { KOK, surum, kurulum, log } from "./ortak.mjs";

const [VERI, IS, CIKTI, SAAT, ETIKET = "belirsiz"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI || !SAAT) throw new Error("kullanım: esitlik-belirsiz-kos.mjs <veri> <iş> <json> <saat> [etiket]");
const W = "/api/workspace/whatsapp";
const sonuc = { kok: KOK, commit: surum(), veri: VERI, saat: SAAT, kip: ETIKET, yurutulen: null, adimlar: [] };
const takma = new Map();
const sayac = { wab: 0, waj: 0, wamid: 0 };
const ad = (tur, deger) => {
  if (!takma.has(deger)) takma.set(deger, `${tur}#${(sayac[tur] += 1)}`);
  return takma.get(deger);
};
const normal = value => JSON.parse(JSON.stringify(value ?? null).replace(/wab-[0-9a-f-]{36}/g, m => ad("wab", m)).replace(/waj-[0-9a-f-]{36}/g, m => ad("waj", m)).replace(/wamid\.[A-Za-z0-9_=-]+/g, m => ad("wamid", m)));
const kaydet = (adim, r) => {
  sonuc.adimlar.push({ adim, durum: r.status, govde: normal(r.data) });
  const d = r.data?.data || {};
  log(adim, r.status, d.total !== undefined ? `kişi ${d.total} gönderilecek ${d.sendable} ${JSON.stringify(d.skipped || {})}` : d.summary ? `açıldı ${d.summary.total}/${d.summary.sendable}` : String(r.data?.error || "").slice(0, 160));
  return r;
};
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `esb${Date.now().toString(36)}` });
try {
  const { admin, at } = ctx;
  const db = new DatabaseSync(path.join(IS, "data/destekofis.sqlite"), { readOnly: true });
  const belirsiz = db.prepare("SELECT j.id, j.account_id AS accountId, b.kind, b.preset, b.period_from AS f, b.period_to AS t FROM wa_jobs j JOIN wa_batches b ON b.id = j.batch_id WHERE j.state = 'uncertain' ORDER BY b.created_at, j.rowid").all();
  db.close();
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
  const cariler = [...new Set(belirsiz.map(row => row.accountId))];
  const secim = [...cariler, ...tum.filter(id => !cariler.includes(id)).slice(0, 20)];
  const donemler = [];
  for (const row of belirsiz) {
    const d = row.kind === "reminder" ? { kind: "reminder" } : row.preset === "all" || row.preset === "last3" ? { kind: "statement", preset: row.preset } : { kind: "statement", from: row.f, to: row.t };
    if (!donemler.some(x => JSON.stringify(x) === JSON.stringify(d))) donemler.push(d);
  }
  sonuc.belirsiz = belirsiz.length;
  sonuc.donemler = donemler;
  for (const [i, d] of donemler.entries()) {
    kaydet(`önizleme dönem ${i + 1} ${JSON.stringify(d)}`, await admin.post(at(`${W}/batches/preview`), { ids: secim, ...d }));
    kaydet(`önizleme dönem ${i + 1} sendAgain`, await admin.post(at(`${W}/batches/preview`), { ids: secim, sendAgain: true, ...d }));
    const r = kaydet(`aç (yalnız belirsizli) dönem ${i + 1}`, await admin.post(at(`${W}/batches`), { ids: cariler, requestId: `iszBel-${i}`, ...d }));
    if (r.data?.data?.batch?.id) kaydet(`aç dönem ${i + 1} · iş satırları`, await admin.get(at(`${W}/batches/${r.data.data.batch.id}`)));
  }
  kaydet("önizleme Ödeme Hatırlatma", await admin.post(at(`${W}/batches/preview`), { kind: "reminder", ids: secim }));
  for (const [i, job] of belirsiz.entries()) {
    const r = kaydet(`Yine de Gönder ${i + 1}`, await admin.post(at(`${W}/jobs/${job.id}/send-anyway`), { confirm: true, requestId: `iszBelY-${i}` }));
    if (r.data?.data?.batch?.id) kaydet(`Yine de Gönder ${i + 1} · iş satırları`, await admin.get(at(`${W}/batches/${r.data.data.batch.id}`)));
  }
  // Yine de Gönder'den sonra aynı dönemler: kuyruktaki (Yine de Gönder'in açtığı) işler "Zaten Kuyrukta".
  for (const [i, d] of donemler.entries()) kaydet(`Yine de Gönder sonrası önizleme dönem ${i + 1}`, await admin.post(at(`${W}/batches/preview`), { ids: secim, ...d }));
} finally {
  await ctx.kapat();
}
writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
log("yazıldı", CIKTI, sonuc.adimlar.length, "adım");
