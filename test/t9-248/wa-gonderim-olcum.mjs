// T9 ÖLÇEK — Ölçüm 1: 2.000 kişilik WhatsApp toplu gönderimi (plan §8 ÖLÇEK "2.000+ carilik toplu gönderimde masaüstü yanıt süresi ve bellek"; §9 "Ölçüm:
// 2.000 carilik toplu gönderim sırasında masaüstü p95"). Ürün kodu DEĞİŞMEZ. Veri: 29.10 ölçek verisinin taze kopyası (tools/olcek-210.mjs --asama veri; programın
// kendi API'siyle, 2 şirket, ~3.000 cari, ~112.000 para satırı) — açılışta 2.4.8 göçü (v44).
//
// --kip yuk (varsayılan): işçi KENDİ zamanlayıcısıyla (üretimdeki gibi; iletiler arası --aralik ms, üretimde 1000), Meta durum bildirimleri kapıcı yolundan.
//   A) gönderimsiz masaüstü (--taban sn)   B) önizleme (her dönem seçeneği + Tümünü Seç; olay döngüsü kesintisi)   C) başlatma
//   D) gönderim sürerken masaüstü + WhatsApp ekranı istekleri, süreç belleği (RSS), olay döngüsü; iş bitene dek (en çok --en-cok dk)
// --kip sinir: işçi elle (drain), aralık 0, sahte saat DURUR: 24 saatte 250 kişi sınırı — ilk pencerede kaç kişi, kalanlar "Sınır Nedeniyle Bekliyor", saat 24 sa
//   ilerleyince sürer mi; ayrıca iş başına yürütme süresi (işçi verimi).
// Sonuç: --json dosyası + TAP benzeri denetim satırları (# tests / # pass / # fail; tools/kanit.mjs kos okur). Denetimler DOĞRULUK içindir (yanıt kodu, sayılar);
// süre bütçesi denetim DEĞİLDİR, JSON'a ve rapora yazılır (aşım BULGU olarak ayrıca yeniden üretilir).
import { writeFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { execSync } from "node:child_process";
import { KOK, STAFF_PASS, boyutlar, durumDongusu, kurulum, log, mb, ozet } from "./ortak.mjs";

const argv = process.argv.slice(2);
const opt = (ad, varsayilan) => {
  const i = argv.indexOf(`--${ad}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : varsayilan;
};
const KIP = opt("kip", "yuk");
const VERI = opt("veri");
const IS = opt("is");
const CIKTI = opt("json");
const KISI = Number(opt("kisi", "2000"));
const ARALIK = Number(opt("aralik", KIP === "sinir" ? "0" : "1000"));
const TIER = opt("tier", KIP === "sinir" ? "TIER_250" : "TIER_2K");
const TABAN_SN = Number(opt("taban", "60"));
const EN_COK_DK = Number(opt("en-cok", "110"));
const SAAT = opt("saat", "2026-11-02T10:00:00+03:00"); // pazartesi, mesai içi; veri 29.10'da biter (Ekim dolu)
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: --veri <klasör> --is <klasör> --json <dosya> [--kip yuk|sinir]");

const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const sonuc = { kip: KIP, commit: execSync("git rev-parse HEAD", { cwd: KOK }).toString().trim(), node: process.version, veri: VERI, kisi: KISI, aralikMs: ARALIK, tier: TIER, saat: SAAT, basladi: new Date().toISOString() };
const bellek = [];
const bellekOrnek = setInterval(() => bellek.push({ t: Date.now(), rss: process.memoryUsage().rss, heap: process.memoryUsage().heapUsed }), 2000);
bellekOrnek.unref();

const ctx = await kurulum({ veri: VERI, is: IS, saat: KIP === "sinir" ? { time: SAAT, fixed: true } : { time: SAAT }, isci: KIP === "sinir" ? "manual" : "auto", aralik: ARALIK, tier: TIER, onEk: `m1${KIP}${Date.now().toString(36)}` });
sonuc.acilisMs = ctx.acilisMs;
log("açılış (göç dahil) ms", ctx.acilisMs);
const { admin, at } = ctx;
const W = "/api/workspace/whatsapp";
try {
  const masa = ctx.server.client();
  denetle("Muhasebe personeli (olcek10) girişi", (await masa.login("olcek10", STAFF_PASS)).status === 200);
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts;
  const telefonlu = tum.filter(a => a.phone);
  sonuc.cariSayisi = { toplam: tum.length, telefonlu: telefonlu.length };
  const secilen = telefonlu.slice(0, KISI).map(a => a.id);
  denetle(`${KISI} telefonlu cari var`, secilen.length === KISI, `${telefonlu.length} telefonlu`);
  const islek = secilen.slice(0, 40);
  const yil = SAAT.slice(0, 4);
  const bugun = ctx.saat.today();
  let isKimligi = null;
  const UCLAR = {
    cariListesi: [masa, () => at("/api/workspace/accounts?status=all&limit=500")],
    cariArama: [masa, () => at(`/api/workspace/accounts/search?q=${encodeURIComponent(tum[Math.floor(Math.random() * tum.length)].name.slice(0, 3))}`)],
    cariKarti: [masa, () => at(`/api/workspace/accounts/${islek[Math.floor(Math.random() * islek.length)]}`)],
    kasa: [masa, () => at(`/api/workspace/cash?from=${bugun.slice(0, 8)}01&to=${bugun}`)],
    raporCariListesi: [masa, () => at(`/api/workspace/report-center/cari-listesi?from=${yil}-01-01&to=${bugun}`)],
    raporBankaBakiye: [masa, () => at(`/api/workspace/report-center/banka-bakiye?from=${yil}-01-01&to=${bugun}`)],
    raporKasaHareketleri: [masa, () => at(`/api/workspace/report-center/kasa-hareketleri?from=${yil}-01-01&to=${bugun}`)],
    bankaHareketleri: [masa, () => at("/api/workspace/bank/movements?limit=50")],
    waGonderimler: [admin, () => at(`${W}/batches?limit=30`)],
    waAyrinti: [admin, () => (isKimligi ? at(`${W}/batches/${isKimligi}`) : at(`${W}/batches?limit=1`))],
    waGonderimDurumu: [admin, () => at(`${W}/sending-status`)],
  };
  let sonAyrinti = null;
  const yokla = async (bitti, etiket) => {
    const sureler = Object.fromEntries(Object.keys(UCLAR).map(k => [k, []]));
    const durumlar = {};
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    const t0 = performance.now();
    let tur = 0;
    let araSon = performance.now();
    while (!bitti(performance.now() - t0, tur)) {
      for (const [ad, [istemci, yol]] of Object.entries(UCLAR)) {
        const t = performance.now();
        const r = await istemci.get(yol());
        sureler[ad].push(performance.now() - t);
        const k = `${ad}:${r.status}`;
        durumlar[k] = (durumlar[k] || 0) + 1;
        if (ad === "waAyrinti" && isKimligi && r.status === 200) sonAyrinti = r.data.data;
      }
      tur += 1;
      // Ara özet (5 dk'da bir): koşu yarıda kesilirse de sayılar çıktıda kalır (ilk yük koşusu arka plan süre sınırında kesildi).
      if (performance.now() - araSon > 300_000) {
        araSon = performance.now();
        log(`${etiket} ara`, JSON.stringify({ sn: Math.round((araSon - t0) / 1000), tur, rssMb: mb(process.memoryUsage().rss), olayDongusuEnCokMs: Math.round(h.max / 1e6), is: sonAyrinti ? sonAyrinti.counts || null : null, uclar: Object.fromEntries(Object.entries(sureler).map(([k, l]) => [k, ozet(l)])) }));
      }
    }
    h.disable();
    const s = { sureSn: Math.round((performance.now() - t0) / 1000), tur, durumlar, olayDongusu: { p99ms: Math.round(h.percentile(99) / 1e6), enCokMs: Math.round(h.max / 1e6) }, uclar: Object.fromEntries(Object.entries(sureler).map(([k, l]) => [k, ozet(l)])) };
    log(etiket, JSON.stringify(s));
    return s;
  };
  const hepsi200 = s => Object.entries(s.durumlar).every(([k]) => k.endsWith(":200"));

  if (KIP === "yuk") {
    log("A) gönderimsiz masaüstü");
    sonuc.A_gonderimsiz = await yokla(ms => ms > TABAN_SN * 1000, "A");
    denetle("A: bütün masaüstü istekleri 200", hepsi200(sonuc.A_gonderimsiz), JSON.stringify(sonuc.A_gonderimsiz.durumlar));
  }

  // B) Önizleme: her dönem seçeneği (ders 11) + Ödeme Hatırlatma + Tümünü Seç (all: true). Önizleme senkron hesaplanır → olay döngüsü kesintisi = masaüstünün bekleyeceği süre.
  log("B) önizleme");
  const onizleme = {};
  const govdeler = {
    ekstreGecenAy: { kind: "statement", ids: secilen, preset: "lastMonth" },
    ekstreBuAy: { kind: "statement", ids: secilen, preset: "thisMonth" },
    ekstreSon3Ay: { kind: "statement", ids: secilen, preset: "last3" },
    ekstreTumHareketler: { kind: "statement", ids: secilen, preset: "all" },
    ekstreOzelAralik: { kind: "statement", ids: secilen, from: `${yil}-07-01`, to: `${yil}-09-30` },
    hatirlatma: { kind: "reminder", ids: secilen },
    tumunuSecGecenAy: { kind: "statement", all: true, status: "all", preset: "lastMonth" },
  };
  for (const [ad, govde] of Object.entries(govdeler)) {
    const liste = [];
    for (let i = 0; i < 2; i += 1) {
      const h = monitorEventLoopDelay({ resolution: 10 });
      h.enable();
      const t = performance.now();
      const r = await admin.post(at(`${W}/batches/preview`), govde);
      const ms = performance.now() - t;
      h.disable();
      liste.push({ durum: r.status, ms: Math.round(ms), olayDongusuEnCokMs: Math.round(h.max / 1e6), toplam: r.data?.data?.total, gonderilecek: r.data?.data?.sendable, elenen: r.data?.data?.skipped, yanitBayt: Buffer.byteLength(JSON.stringify(r.data || "")) });
      if (r.status !== 200) log("önizleme", ad, r.status, JSON.stringify(r.data).slice(0, 300));
    }
    onizleme[ad] = liste;
    log("önizleme", ad, JSON.stringify(liste));
    denetle(`önizleme ${ad}: 200`, liste.every(x => x.durum === 200), JSON.stringify(liste.map(x => x.durum)));
  }
  sonuc.B_onizleme = onizleme;

  // C) Başlatma.
  log("C) başlatma");
  let t = performance.now();
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  const acilan = await admin.post(at(`${W}/batches`), govdeler.ekstreGecenAy);
  h.disable();
  sonuc.C_baslatma = { durum: acilan.status, ms: Math.round(performance.now() - t), olayDongusuEnCokMs: Math.round(h.max / 1e6), toplam: acilan.data?.data?.batch?.counts };
  log("başlatma", JSON.stringify(sonuc.C_baslatma), acilan.status !== 200 ? JSON.stringify(acilan.data).slice(0, 400) : "");
  denetle("toplu iş açıldı (200)", acilan.status === 200);
  isKimligi = acilan.data?.data?.batch?.id;
  const gonderilecek = onizleme.ekstreGecenAy[0].gonderilecek;
  sonuc.gonderilecek = gonderilecek;

  if (KIP === "yuk") {
    // D) Gönderim sürerken.
    const meta = durumDongusu(ctx, { toplu: 1, okunma: 0.5, aralikMs: 250 });
    const rssOnce = process.memoryUsage().rss;
    const isBitti = () => sonAyrinti && ["done", "canceled", "stopped"].includes(sonAyrinti.state);
    log("D) gönderim sürerken masaüstü");
    const tD = performance.now();
    sonuc.D_gonderimSirasinda = await yokla(ms => ms > EN_COK_DK * 60_000 || isBitti(), "D");
    sonuc.D_gonderimSirasinda.isSuresiSn = Math.round((performance.now() - tD) / 1000);
    const kanca = await meta.dur();
    sonuc.kanca = { olay: kanca.olay, durum: kanca.durum, kodlar: kanca.kodlar, sure: ozet(kanca.sureler) };
    log("kanca", JSON.stringify(sonuc.kanca));
    denetle("D: bütün masaüstü/WhatsApp ekranı istekleri 200", hepsi200(sonuc.D_gonderimSirasinda), JSON.stringify(sonuc.D_gonderimSirasinda.durumlar));
    denetle("toplu iş tamamlandı", isBitti(), sonAyrinti?.state);
    denetle("kanca istekleri 200", Object.keys(kanca.kodlar).every(k => k === "200"), JSON.stringify(kanca.kodlar));
    sonuc.rssOnceMb = mb(rssOnce);
  } else {
    // Sınır: ilk pencere.
    const say = async () => {
      const d = (await admin.get(at(`${W}/batches/${isKimligi}`))).data.data;
      const c = {};
      for (const j of d.jobs) c[j.state] = (c[j.state] || 0) + 1;
      return { batch: d.state, durumlar: c, jobs: d.jobs.length };
    };
    const pencere = [];
    for (let p = 0; p < 2; p += 1) {
      t = performance.now();
      const yurutulen = await ctx.wa.scheduler.drain({ max: 100_000 });
      const ms = performance.now() - t;
      const meta = durumDongusu(ctx, { toplu: 100, okunma: 0 });
      const kanca = await meta.dur();
      const sayim = await say();
      pencere.push({ pencere: p + 1, saat: ctx.saat.iso(), yurutulen, ms: Math.round(ms), isBasinaMs: yurutulen ? Math.round((ms / yurutulen) * 10) / 10 : null, sayim, meta: await ctx.meta.sayac(), kanca: { olay: kanca.olay, durum: kanca.durum, kodlar: kanca.kodlar } });
      denetle(`${p + 1}. pencere: kanca istekleri 200`, Object.keys(kanca.kodlar).every(k => k === "200"), JSON.stringify(kanca.kodlar));
      log("pencere", JSON.stringify(pencere.at(-1)));
      ctx.saat.advance({ hours: 24, minutes: 1 });
    }
    sonuc.sinir = pencere;
    const [p1, p2] = pencere;
    const kabul1 = (p1.sayim.durumlar.delivered || 0) + (p1.sayim.durumlar.accepted || 0) + (p1.sayim.durumlar.sent || 0) + (p1.sayim.durumlar.read || 0);
    denetle("1. pencere: gidenler teslim edildi (kanca işlendi)", (p1.sayim.durumlar.delivered || 0) === p1.meta.gonderilen, JSON.stringify(p1.sayim.durumlar));
    denetle("1. pencere: en çok 250 kişiye gitti", p1.meta.gonderilen <= 250 && kabul1 <= 250, `Meta'ya giden ${p1.meta.gonderilen}, kabul/teslim ${kabul1}`);
    denetle("1. pencere: kalanlar Sınır Nedeniyle Bekliyor", (p1.sayim.durumlar.limited || 0) === gonderilecek - kabul1, JSON.stringify(p1.sayim.durumlar));
    denetle("2. pencere (24 sa sonra): iş kendiliğinden sürdü, toplam en çok 500", p2.meta.gonderilen > p1.meta.gonderilen && p2.meta.gonderilen <= 500, `Meta'ya giden ${p2.meta.gonderilen}`);
  }

  const son = (await admin.get(at(`${W}/batches/${isKimligi}`))).data.data;
  const c = {};
  for (const j of son.jobs) c[j.state] = (c[j.state] || 0) + 1;
  sonuc.sonDurum = { batch: son.state, isler: c, meta: await ctx.meta.sayac() };
  log("son durum", JSON.stringify(sonuc.sonDurum));
  if (KIP === "yuk") {
    const teslim = (c.delivered || 0) + (c.read || 0);
    denetle("bütün gönderilecekler teslim/okundu", teslim === gonderilecek, `teslim+okundu ${teslim} / ${gonderilecek}; ${JSON.stringify(c)}`);
    denetle("Meta'ya giden ileti = gönderilecek (çift yok)", sonuc.sonDurum.meta.gonderilen === gonderilecek, `${sonuc.sonDurum.meta.gonderilen}`);
    const st = (await admin.get(at(`${W}/stats`))).data.data;
    sonuc.buAy = st;
    denetle("Bu Ay teslim sayısı = teslim", st.delivered === teslim, `${st.delivered}`);
  }
  sonuc.bellek = { rssEnCokMb: mb(Math.max(...bellek.map(x => x.rss))), rssSonMb: mb(process.memoryUsage().rss), heapEnCokMb: mb(Math.max(...bellek.map(x => x.heap))), ornek: bellek.length };
  log("bellek", JSON.stringify(sonuc.bellek));
} finally {
  clearInterval(bellekOrnek);
  await ctx.kapat();
  const b = boyutlar(`${IS}/data`);
  sonuc.dosyalar = Object.fromEntries(Object.entries(b).filter(([k]) => /sqlite/.test(k)));
  sonuc.denetimler = denetimler;
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, JSON.stringify(sonuc, null, 2));
  const gecen = denetimler.filter(d => d.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${gecen}\n# fail ${denetimler.length - gecen}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = gecen === denetimler.length ? 0 : 1;
}
