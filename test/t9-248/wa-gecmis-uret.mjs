// T9 ÖLÇEK — Ölçüm 2'nin VERİSİ: 12 ayda 100 toplu gönderim × 2.000 kişi (iş listesi 31.10 "T9 ÖLÇEĞE EKLENDİ: çok sayıda eski gönderimle (ör. 100 gönderim × 2.000 kişi)
// Gönderimler ekranı, ayrıntı ve önizleme süresi"). Veri programın KENDİ API'siyle ve KENDİ işçisiyle üretilir (POST /api/workspace/whatsapp/batches, retry-failed,
// jobs/:id/send-anyway; işçi elle sürülür, aralık 0); Meta durum bildirimleri kapıcı yolundan (toplu, 100'er). Kopyalama YOK.
// Karışım (gerçekçi + zincirler): ekstre dönemleri sırayla Geçen Ay / Bu Ay / Son 3 Ay / Özel Aralık / Tüm Hareketler ("Yine de Gönder" ile — aynı dönem yinelenir),
// her 10. gönderim Ödeme Hatırlatma; her 7. gönderimde 20 kişiye Meta "teslim edilemez" (131026) → Başarısızları Yeniden Dene (yeni toplu iş); her 9. gönderimde 3 iletinin
// yanıtı düşer (Sonucu Belirsiz) → işteki "Yine de Gönder" (onaylı; anyway_links / inherit_of zinciri). İş saati sahte ve DURUR; gönderimler 03.11.2025 → 30.10.2026.
// Kullanım: node test/t9-248/wa-gecmis-uret.mjs --veri <taban> --is <çıktı klasörü> --json <dosya> [--toplam 100] [--bas 0] [--adet N] [--kisi 2000] [--olc]
// --olc (2.4.9 B3 ölçümü, docs/2.4.9-tasarim/B3-B4.md §B3-6; varsayılan davranış değişmez): ana gönderimin işleri tek tek yürütülür (drain'in kendisi: runOnce + sonda bakım)
// ve iş başına süre (p50/p95/en çok), olay döngüsü en çok (açılış, gönderim, bakım), bakım süresi, bakımdan ÖNCE (tepe) ve SONRA şirket dosyası sayfa / boş liste /
// wa_jobs + wa_job_pdfs (dbstat) kaydedilir. Ayrı kopyada (git archive; .git yok) da koşar: commit okunamazsa "git yok" yazılır.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { KOK, boyutlar, durumDongusu, kurulum, log, mb, ozet } from "./ortak.mjs";

const argv = process.argv.slice(2);
const opt = (ad, v) => {
  const i = argv.indexOf(`--${ad}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : v;
};
const VERI = opt("veri");
const IS = opt("is");
const CIKTI = opt("json");
const TOPLAM = Number(opt("toplam", "100")); // 12 aya yayılan gönderim sayısı (zaman çizelgesi)
const BAS_I = Number(opt("bas", "0")); // bu koşunun ilk gönderimi (arka plan süre sınırı yüzünden parça parça: önceki parçanın çıktısı --veri olur)
const ADET = Number(opt("adet", String(TOPLAM - BAS_I)));
const KISI = Number(opt("kisi", "2000"));
const BAS = Date.parse("2025-11-03T09:00:00+03:00");
const SON = Date.parse("2026-10-30T15:00:00+03:00");
const W = "/api/workspace/whatsapp";
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const OLC = argv.includes("--olc");
const commitOf = () => {
  try {
    return execSync("git rev-parse HEAD", { cwd: KOK, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return `git yok (${KOK})`;
  }
};
const sonuc = { commit: commitOf(), node: process.version, veri: VERI, toplam: TOPLAM, bas: BAS_I, adet: ADET, kisi: KISI, olc: OLC, basladi: new Date().toISOString(), gonderimler: [] };
const eld = monitorEventLoopDelay({ resolution: 10 });
if (OLC) eld.enable();
const msOf = ns => Math.round((ns / 1e6) * 10) / 10;
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: BAS + Math.round(((SON - BAS) * BAS_I) / Math.max(1, TOPLAM - 1)), fixed: true }, isci: "manual", aralik: 0, tier: "TIER_2K", onEk: `gec${Date.now().toString(36)}` });
const { admin, at } = ctx;
// --olc: şirket dosyasının (001) anlık sayımı — sayfa, boş liste, wa_jobs / wa_job_pdfs (dbstat), PDF'i duran iş sayısı (tablo ya da eski sütun).
const dosyaOlcu = () => {
  const s = ctx.app.store;
  const sayfa = s.get("PRAGMA page_count").page_count;
  const tablolar = Object.fromEntries(s.all("SELECT name, SUM(pgsize) AS bayt, SUM(unused) AS bos, SUM(payload) AS yuk, COUNT(*) AS sayfa FROM dbstat WHERE name IN ('wa_jobs', 'wa_job_pdfs') GROUP BY name").map(r => [r.name, { sayfa: r.sayfa, mb: mb(r.bayt), bosMb: mb(r.bos), yukMb: mb(r.yuk) }]));
  let pdfSatir = null;
  try {
    pdfSatir = s.get("SELECT COUNT(*) AS n FROM wa_job_pdfs").n;
  } catch {
    pdfSatir = null;
  }
  return { sayfa, dosyaMb: mb(sayfa * s.get("PRAGMA page_size").page_size), bosListe: s.get("PRAGMA freelist_count").freelist_count, tablolar, pdfSatir, satirdaPdf: s.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE pdf_blob IS NOT NULL").n };
};
if (OLC) {
  sonuc.acilis = { ms: ctx.acilisMs, olayDongusuEnCokMs: msOf(eld.max), surum: ctx.app.store.get("PRAGMA user_version").user_version, dosya: dosyaOlcu() };
  log("açılış", JSON.stringify(sonuc.acilis));
}
let hata = null;
const toplam = { toplu: 0, is: 0, metaIleti: 0, kancaOlay: 0, kancaDurum: 0, kancaHata: 0, yenidenDene: 0, yineDeGonder: 0 };
try {
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.filter(a => a.phone);
  const secilen = tum.slice(0, KISI);
  const ids = secilen.map(a => a.id);
  const tel = id => {
    const p = String(secilen.find(a => a.id === id)?.phone || "").replace(/\D/g, "");
    return `+90${p.replace(/^0/, "")}`;
  };
  const kancala = async () => {
    const d = durumDongusu(ctx, { toplu: 100, okunma: 0.4, aralikMs: 0 });
    const ist = await d.dur();
    toplam.kancaOlay += ist.olay;
    toplam.kancaDurum += ist.durum;
    toplam.kancaHata += Object.entries(ist.kodlar).filter(([k]) => k !== "200").reduce((s, [, v]) => s + v, 0);
  };
  const ac = async govde => {
    const r = await admin.post(at(`${W}/batches`), govde);
    if (r.status !== 200) throw new Error(`toplu iş açılamadı: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    toplam.toplu += 1;
    return r.data.data.batch;
  };
  const PRESET = ["lastMonth", "thisMonth", "last3", "custom", "all"];
  for (let i = BAS_I; i < BAS_I + ADET; i += 1) {
    const anMs = BAS + Math.round(((SON - BAS) * i) / Math.max(1, TOPLAM - 1));
    ctx.saat.set(anMs);
    const gun = ctx.saat.today();
    const t0 = performance.now();
    const hatirlatma = i % 10 === 9;
    const preset = PRESET[i % PRESET.length];
    const govde = hatirlatma
      ? { kind: "reminder", ids, sendAgain: true }
      : preset === "custom"
        ? { kind: "statement", ids, from: `${gun.slice(0, 7)}-01`, to: gun, sendAgain: true }
        : { kind: "statement", ids, preset, sendAgain: true };
    const basarisiz = i % 7 === 3 ? ids.filter((_, k) => k % 97 === 5).slice(0, 20) : [];
    if (basarisiz.length) await ctx.meta.ayarla({ recipientErrors: Object.fromEntries(basarisiz.map(id => [tel(id), { status: 400, body: { error: { message: "(#131026) Message undeliverable", type: "OAuthException", code: 131026, fbtrace_id: "T9" } } }])) });
    let batch;
    try {
      batch = await ac(govde);
    } catch (error) {
      // Ödeme Hatırlatma: o gün gecikmiş borçlu yoksa program toplu işi AÇMAZ (400 whatsapp-nothing; doğru davranış) → aynı gün Bu Ay ekstresi.
      if (!(hatirlatma && /whatsapp-nothing/.test(String(error.message)))) throw error;
      toplam.hatirlatmaYok = (toplam.hatirlatmaYok || 0) + 1;
      govde.kind = "statement";
      govde.preset = "thisMonth";
      batch = await ac(govde);
    }
    const acMs = performance.now() - t0;
    // Sonucu Belirsiz: her 9. gönderimde 3 iş yanıtsız (sahte Meta iletiyi işler, bağlantıyı yanıtsız keser).
    let belirsizIstek = 0;
    if (i % 9 === 4) {
      for (let k = 0; k < 3; k += 1) {
        for (let j = 0; j < 150; j += 1) await ctx.wa.scheduler.runOnce();
        await ctx.meta.ayarla({ dropAfter: "^POST /\\d+/messages$" });
        await ctx.wa.scheduler.runOnce();
        await ctx.meta.ayarla({ dropAfter: null });
        belirsizIstek += 1;
      }
    }
    const t1 = performance.now();
    let yurutulen;
    let olcu = null;
    if (OLC) {
      // drain({ max: 100_000 }) ile aynı yol (lib/whatsapp/scheduler.mjs): iş kalmayana dek runOnce, sonra bakım — bu kez her iş ve bakım ayrı ölçülür.
      const sureler = [];
      eld.reset();
      for (let n = 0; n < 100_000; n += 1) {
        const a = performance.now();
        const r = await ctx.wa.scheduler.runOnce();
        if (!r.did) break;
        sureler.push(performance.now() - a);
      }
      yurutulen = sureler.length;
      const gonderimOlay = msOf(eld.max);
      const tepe = dosyaOlcu();
      eld.reset();
      const b = performance.now();
      await ctx.wa.scheduler.maintain();
      olcu = { is: ozet(sureler), olayDongusuEnCokMs: gonderimOlay, bakimMs: Math.round(performance.now() - b), bakimOlayDongusuEnCokMs: msOf(eld.max), bakimOncesi: tepe, bakimSonrasi: dosyaOlcu() };
    } else yurutulen = await ctx.wa.scheduler.drain({ max: 100_000 });
    const surMs = performance.now() - t1;
    await kancala();
    if (basarisiz.length) await ctx.meta.ayarla({ recipientErrors: {} });
    const d = (await admin.get(at(`${W}/batches/${batch.id}`))).data.data;
    const c = {};
    for (const j of d.jobs) c[j.state] = (c[j.state] || 0) + 1;
    toplam.is += d.jobs.length;
    const kayit = { sira: i + 1, gun, tur: govde.kind, donem: govde.preset || (govde.from ? "özel" : ""), acmaMs: Math.round(acMs), yurutulen, isBasinaMs: yurutulen ? Math.round((surMs / yurutulen) * 10) / 10 : null, durumlar: c, ...(olcu ? { olcu } : {}) };
    // Başarısızları Yeniden Dene (aynı gün, 2 saat sonra).
    if ((c.failed || 0) > 0) {
      ctx.saat.advance({ hours: 2 });
      const r = await admin.post(at(`${W}/batches/${batch.id}/retry-failed`), {});
      if (r.status !== 200) throw new Error(`yeniden dene: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
      toplam.toplu += 1;
      toplam.yenidenDene += 1;
      await ctx.wa.scheduler.drain({ max: 100_000 });
      await kancala();
      kayit.yenidenDene = r.data.data.batch.id;
    }
    // İşteki "Yine de Gönder" (Sonucu Belirsiz; onaylı).
    const belirsizler = d.jobs.filter(j => j.state === "uncertain");
    for (const j of belirsizler) {
      ctx.saat.advance({ minutes: 30 });
      const r = await admin.post(at(`${W}/jobs/${j.id}/send-anyway`), { confirm: true });
      if (r.status !== 200) throw new Error(`yine de gönder: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
      toplam.toplu += 1;
      toplam.yineDeGonder += 1;
      await ctx.wa.scheduler.drain({ max: 1000 });
      await kancala();
    }
    if (belirsizIstek) kayit.belirsiz = { istenen: belirsizIstek, olan: belirsizler.length };
    await ctx.wa.scheduler.maintain();
    if (OLC) kayit.olcu.gonderimSonu = dosyaOlcu();
    kayit.sureSn = Math.round((performance.now() - t0) / 1000);
    sonuc.gonderimler.push(kayit);
    if (i % 5 === 0 || i === BAS_I + ADET - 1) log(`gönderim ${i + 1}/${TOPLAM}`, JSON.stringify(kayit), `RSS ${mb(process.memoryUsage().rss)} MB`, JSON.stringify(toplam));
  }
  const say = await ctx.meta.sayac();
  toplam.metaIleti = say.gonderilen;
  denetle(`${ADET} gönderim açıldı`, sonuc.gonderimler.length === ADET);
  denetle("kanca istekleri hatasız", toplam.kancaHata === 0, `${toplam.kancaHata}`);
  denetle("yeniden deneme ve Yine de Gönder zinciri üretildi", toplam.yenidenDene > 0 && toplam.yineDeGonder > 0, JSON.stringify(toplam));
} catch (error) {
  hata = error;
  log("HATA", error?.stack || error);
  denetle("üretim hatasız bitti", false, String(error?.message || error));
} finally {
  sonuc.toplam = toplam;
  await ctx.kapat();
  sonuc.dosyalar = Object.fromEntries(Object.entries(boyutlar(`${IS}/data`)).filter(([k]) => /sqlite/.test(k)));
  sonuc.denetimler = denetimler;
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, JSON.stringify(sonuc, null, 2));
  const gecen = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${gecen}\n# fail ${denetimler.length - gecen}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = !hata && gecen === denetimler.length ? 0 : 1;
}
