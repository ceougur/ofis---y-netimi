// T9 ÖLÇEK — Ölçüm 2: GEÇMİŞ BİRİKİMİ (100 gönderim × 2.000 kişi; veri wa-gecmis-uret.mjs ile programın kendi API'sinden). Ürün kodu DEĞİŞMEZ.
// Taze kopyada (ders 15) — iş saati 02.11.2026 10:00 (+03:00), DURUR; işçi elle (aralık 0; iş başına yürütme süresi = işçinin kendi maliyeti):
//   1) açılış süresi + dosya boyutları (makine defteri whatsapp-gonderim.sqlite, şirket dosyası)
//   2) bakım turu (scheduler.maintain: repairPending, settleUncertainFromLedger, süre dolumu, medya silme…) ×5; defter yazılabilirlik sınaması (probeWritable) ×200
//   3) "WhatsApp Gönderimleri": ilk 30, Daha Fazla Göster ile SONUNA kadar (imleç), tarih süzgeci (bir ay, bir gün, yalnız Başlangıç), eski 2.000 kişilik gönderimin ayrıntısı
//   4) Bu Ay sayımı (stats; bu ay ve geçen ay)
//   5) yeni gönderim önizlemesi (Geçen Ay — geçmişte gönderilmiş dönem: "Daha Önce Gönderildi" sorgusu; Bu Ay; Tüm Hareketler) ve başlatma (Yine de Gönder ile)
//   6) yeni 2.000 kişilik işin yürütülmesi (iş başına ms; claim + 24 saat penceresi + zincir denetimi büyük defterde) + durum bildirimleri TEK TEK (kanca işleme süresi)
//   7) eski iletilere geç durum bildirimi (geçmişten 300 wamid'e "read") — sahibi bulma (companyOfWamid / resolveStatus) büyük defterde
//   8) masaüstü uçları (cari kartı WhatsApp geçmişini de gösterir) 60 sn; süreç belleği
// Kullanım: node test/t9-248/wa-gecmis-olcum.mjs --veri <geçmiş verisi> --is <klasör> --json <dosya>
import { existsSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { execFile, execSync } from "node:child_process";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { KOK, STAFF_PASS, boyutlar, durum, kurulum, log, mb, ozet } from "./ortak.mjs";

const argv = process.argv.slice(2);
const opt = (ad, v) => {
  const i = argv.indexOf(`--${ad}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : v;
};
const VERI = opt("veri");
const IS = opt("is");
const CIKTI = opt("json");
const KISI = Number(opt("kisi", "2000"));
const SAAT = opt("saat", "2026-11-02T10:00:00+03:00");
const W = "/api/workspace/whatsapp";
const denetimler = [];
const denetle = (ad, kosul, ayrinti = "") => {
  denetimler.push({ ad, ok: Boolean(kosul), ayrinti });
  console.log(`${kosul ? "ok" : "not ok"} ${denetimler.length} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
const sonuc = { commit: execSync("git rev-parse HEAD", { cwd: KOK }).toString().trim(), node: process.version, veri: VERI, saat: SAAT, basladi: new Date().toISOString() };
// Veri sayımı (açılmadan önce; salt okunur).
{
  const say = (dosya, tablolar) => {
    if (!existsSync(dosya)) return "dosya yok (göç öncesi veri)";
    const db = new DatabaseSync(dosya, { readOnly: true });
    try {
      return Object.fromEntries(tablolar.map(t => [t, (() => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { return null; } })()]));
    } finally {
      db.close();
    }
  };
  sonuc.veriSayimi = {
    defter: say(`${VERI}/data/whatsapp-gonderim.sqlite`, ["claims", "claim_keys", "outcomes", "accepts", "deliveries", "attempt_deliveries", "learned_wamids", "anyway_links", "batch_events", "batch_log", "hook_seen"]),
    sirket001: say(`${VERI}/data/destekofis.sqlite`, ["wa_batches", "wa_jobs", "accounts", "account_entries", "money_lines"]),
  };
  const db = new DatabaseSync(`${VERI}/data/destekofis.sqlite`, { readOnly: true });
  try {
    sonuc.veriSayimi.zincir = { inheritOfDolu: db.prepare("SELECT COUNT(*) AS n FROM wa_jobs WHERE inherit_of <> ''").get().n };
  } catch {
    sonuc.veriSayimi.zincir = "wa_jobs yok (göç öncesi veri)";
  }
  db.close();
  sonuc.dosyalarOnce = Object.fromEntries(Object.entries(boyutlar(`${VERI}/data`)).filter(([k]) => /sqlite/.test(k)));
  log("veri", JSON.stringify(sonuc.veriSayimi), JSON.stringify(sonuc.dosyalarOnce));
}
const bellek = [];
const bellekOrnek = setInterval(() => bellek.push(process.memoryUsage().rss), 2000);
bellekOrnek.unref();
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_2K", onEk: `m2${Date.now().toString(36)}`, baglan: true });
sonuc.acilisMs = ctx.acilisMs;
log("açılış ms", ctx.acilisMs);
const { admin, at } = ctx;
const zamanla = async (n, fn) => {
  const l = [];
  let son;
  for (let i = 0; i < n; i += 1) {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    const t = performance.now();
    son = await fn(i);
    l.push(performance.now() - t);
    h.disable();
  }
  return { ...ozet(l), son };
};
try {
  // 2) Bakım turu ve sınama.
  const bakim = await zamanla(5, () => ctx.wa.scheduler.maintain());
  sonuc.bakimTuru = { ...bakim, son: undefined };
  const sinama = await zamanla(200, () => ctx.wa.ledger.probeWritable());
  sonuc.probeWritable = { ...sinama, son: sinama.son };
  log("bakım", JSON.stringify(sonuc.bakimTuru), "probe", JSON.stringify(sonuc.probeWritable));
  denetle("defter yazılabilir (probeWritable)", sinama.son === true || sinama.son?.ok === true || sinama.son === "ok", JSON.stringify(sinama.son));

  // 3) Gönderimler ekranı.
  const ilk = await zamanla(5, () => admin.get(at(`${W}/batches?limit=30`)));
  const toplamToplu = Number(sonuc.veriSayimi.sirket001.wa_batches) || 0;
  denetle("Gönderimler ilk 30: 200 + en çok 30 satır", ilk.son.status === 200 && ilk.son.data.data.length === Math.min(30, toplamToplu), `${ilk.son.status} ${ilk.son.data?.data?.length}`);
  const sayfalar = [];
  let imlec = ilk.son.data.data.at(-1)?.id;
  let satir = ilk.son.data.data.length;
  while (imlec) {
    const t = performance.now();
    const r = await admin.get(at(`${W}/batches?limit=30&before=${encodeURIComponent(imlec)}`));
    sayfalar.push(performance.now() - t);
    if (r.status !== 200) throw new Error(`Daha Fazla Göster ${r.status}`);
    satir += r.data.data.length;
    imlec = r.data.data.length ? r.data.data.at(-1).id : null;
  }
  sonuc.gonderimler = { ilk30: { ...ilk, son: undefined }, dahaFazla: ozet(sayfalar), sayfa: sayfalar.length, satir };
  denetle("Daha Fazla Göster sonuna kadar: bütün gönderimler bir kez", satir === toplamToplu, `${satir} / ${toplamToplu}`);
  const suzgec = {};
  for (const [ad, q] of Object.entries({ birAy: "from=2026-03-01&to=2026-03-31", birGun: "from=2026-06-15&to=2026-06-15", yalnizBaslangic: "from=2026-10-01", yalnizBitis: "to=2025-12-31" })) {
    const r = await zamanla(5, () => admin.get(at(`${W}/batches?limit=30&${q}`)));
    suzgec[ad] = { ...r, son: undefined, satir: r.son.data?.data?.length, durum: r.son.status };
  }
  sonuc.gonderimler.tarihSuzgeci = suzgec;
  denetle("tarih süzgeçleri 200", Object.values(suzgec).every(x => x.durum === 200), JSON.stringify(Object.fromEntries(Object.entries(suzgec).map(([k, v]) => [k, v.satir]))));
  const eskiler = (await admin.get(at(`${W}/batches?limit=200&to=2026-01-31`))).data.data;
  const eski = eskiler.find(b => (b.counts ? Object.values(b.counts).reduce((s, v) => s + v, 0) : 0) >= KISI) || eskiler.at(-1);
  if (eski) {
    const ayr = await zamanla(5, () => admin.get(at(`${W}/batches/${eski.id}`)));
    sonuc.gonderimler.eskiAyrinti = { ...ayr, son: undefined, is: ayr.son.data?.data?.jobs?.length, bayt: Buffer.byteLength(JSON.stringify(ayr.son.data || "")) };
  } else sonuc.gonderimler.eskiAyrinti = "eski gönderim yok";
  log("gönderimler", JSON.stringify(sonuc.gonderimler));

  // 4) Bu Ay sayımı.
  const buAy = await zamanla(10, () => admin.get(at(`${W}/stats`)));
  const gecenAy = await zamanla(10, () => admin.get(at(`${W}/stats?month=2026-03`))); // geçmişin dolu bir ayı (40 gönderim 03.11.2025 – 25.03.2026)
  sonuc.buAySayimi = { buAy: { ...buAy, son: undefined, deger: buAy.son.data?.data?.delivered }, gecenAy: { ...gecenAy, son: undefined, deger: gecenAy.son.data?.data?.delivered } };
  log("bu ay", JSON.stringify(sonuc.buAySayimi));
  denetle("Bu Ay sayımı 200", buAy.son.status === 200 && gecenAy.son.status === 200);

  // 5) Yeni gönderim önizlemesi + başlatma.
  const tum = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.filter(a => a.phone);
  const ids = tum.slice(0, KISI).map(a => a.id);
  const onizleme = {};
  for (const [ad, govde] of Object.entries({ ekstreGecenAy: { kind: "statement", ids, preset: "lastMonth" }, ekstreBuAy: { kind: "statement", ids, preset: "thisMonth" }, ekstreTumHareketler: { kind: "statement", ids, preset: "all" } })) {
    const r = await zamanla(2, () => admin.post(at(`${W}/batches/preview`), govde));
    onizleme[ad] = { ...r, son: undefined, durum: r.son.status, gonderilecek: r.son.data?.data?.sendable, elenen: r.son.data?.data?.skipped, dahaOnce: r.son.data?.data?.alreadySent };
    log("önizleme", ad, JSON.stringify(onizleme[ad]));
  }
  sonuc.onizleme = onizleme;
  // Başka kullanıcı bu sırada ne kadar bekler: AYRI SÜREÇTE yoklayıcı (yoklayici.mjs) Muhasebe personelinin cari aramasını 200 ms'de bir çağırırken önizleme ve başlatma.
  const masaY = ctx.server.client();
  denetle("yoklayıcı girişi (olcek10)", (await masaY.login("olcek10", STAFF_PASS)).status === 200);
  const esZamanli = async (fn, sn) => {
    const cocuk = new Promise((resolve, reject) => execFile(process.execPath, [path.join(KOK, "test/t9-248/yoklayici.mjs"), ctx.server.base, masaY.cookie, at("/api/workspace/accounts/search?q=Ölç"), String(sn)], (e, out) => (e ? reject(e) : resolve(JSON.parse(out)))));
    await new Promise(r => setTimeout(r, 3000));
    const t = performance.now();
    const r = await fn();
    const ms = Math.round(performance.now() - t);
    return { ms, durum: r.status, yoklayici: await cocuk };
  };
  sonuc.esZamanliOnizleme = await esZamanli(() => admin.post(at(`${W}/batches/preview`), { kind: "statement", ids, preset: "lastMonth" }), 45);
  log("eş zamanlı önizleme", JSON.stringify(sonuc.esZamanliOnizleme));
  denetle("önizlemeler 200", Object.values(onizleme).every(x => x.durum === 200));
  let acilan;
  const es = await esZamanli(async () => (acilan = await admin.post(at(`${W}/batches`), { kind: "statement", ids, preset: "lastMonth", sendAgain: true })), 45);
  sonuc.baslatma = { ms: es.ms, durum: acilan.status, yoklayici: es.yoklayici };
  log("başlatma", JSON.stringify(sonuc.baslatma));
  denetle("yeni toplu iş açıldı (Yine de Gönder ile)", acilan.status === 200, `${acilan.status}`);
  const yeni = acilan.data.data.batch.id;

  // 6) Yürütme + durum bildirimleri. Kapıcı ofis başına dakikada 600 kanca isteği geçirir (bulut/kapi/kapi.mjs KANCA.dakikada; fazlası 429, Meta yeniden dener) —
  // 40-1 koşusunda tek tek ve hızla gönderilen 4.000 bildirimin 2.440'ı 429 aldı (test düzeneğinin aşırı hızı; üretim hızında — Ölçüm 1 — hiç 429 yok). Bu yüzden:
  // her 5. iletinin "delivered"ı TEK bildirimle, dakikada en çok 500 istek (işleme süresi örneği); kalanlar 100'lük olaylarla.
  const kancaSure = [];
  const kancaKod = {};
  const dakika = [];
  const tekKanca = async statuses => {
    while (dakika.length && Date.now() - dakika[0] > 60_000) dakika.shift();
    if (dakika.length >= 500) await new Promise(r => setTimeout(r, 60_000 - (Date.now() - dakika[0]) + 50));
    dakika.push(Date.now());
    const tk = performance.now();
    const k = await ctx.kanca(statuses);
    kancaKod[k.status] = (kancaKod[k.status] || 0) + 1;
    return { ms: performance.now() - tk, k };
  };
  let yurutulen = 0;
  const isSure = [];
  const toplu = [];
  let sira = 0;
  const bildir = async () => {
    for (const m of await ctx.meta.yeni()) {
      sira += 1;
      toplu.push(durum(m.wamid, "sent", ctx.saat.ms(), m.to));
      if (sira % 5 === 0) kancaSure.push((await tekKanca([durum(m.wamid, "delivered", ctx.saat.ms(), m.to)])).ms);
      else toplu.push(durum(m.wamid, "delivered", ctx.saat.ms(), m.to));
    }
    while (toplu.length >= 100) await tekKanca(toplu.splice(0, 100));
  };
  for (;;) {
    const t = performance.now();
    const r = await ctx.wa.scheduler.runOnce();
    if (!r.did) break;
    isSure.push(performance.now() - t);
    yurutulen += 1;
    if (yurutulen % 20 === 0) await bildir();
  }
  await bildir();
  while (toplu.length) await tekKanca(toplu.splice(0, 100));
  sonuc.yeniIs = { yurutulen, isBasina: ozet(isSure), kanca: { ...ozet(kancaSure), kodlar: kancaKod } };
  log("yeni iş", JSON.stringify(sonuc.yeniIs));
  const d = (await admin.get(at(`${W}/batches/${yeni}`))).data.data;
  const c = {};
  for (const j of d.jobs) c[j.state] = (c[j.state] || 0) + 1;
  sonuc.yeniIs.durumlar = c;
  denetle("yeni işin bütün kişileri teslim edildi", (c.delivered || 0) === KISI, JSON.stringify(c));
  denetle("kanca istekleri 200", Object.keys(kancaKod).every(k => k === "200"), JSON.stringify(kancaKod));

  // 7) Eski iletilere geç "read" (sahibi defterden bulunur).
  const defter = new DatabaseSync(`${IS}/data/whatsapp-gonderim.sqlite`, { readOnly: true });
  const eskiWamid = defter.prepare("SELECT o.wamid AS wamid, c.phone AS phone FROM outcomes o JOIN claims c ON c.job_id = o.job_id AND c.attempt = o.attempt WHERE o.wamid <> '' AND c.at < '2026-06-01' ORDER BY random() LIMIT 300").all();
  defter.close();
  const gecSure = [];
  const gecKod = {};
  for (const m of eskiWamid) {
    const { ms, k } = await tekKanca([durum(m.wamid, "read", ctx.saat.ms(), m.phone)]);
    gecSure.push(ms);
    gecKod[k.status] = (gecKod[k.status] || 0) + 1;
  }
  sonuc.eskiIletiKanca = { ...ozet(gecSure), kodlar: gecKod, adet: eskiWamid.length };
  log("eski ileti kanca", JSON.stringify(sonuc.eskiIletiKanca));
  if (eskiWamid.length) denetle("eski iletilere geç bildirim 200", Object.keys(gecKod).every(k => k === "200"), JSON.stringify(gecKod));
  else log("eski ileti yok (boş geçmiş) — geç bildirim ölçümü yok");
  const bakimSonra = await zamanla(3, () => ctx.wa.scheduler.maintain());
  sonuc.bakimTuruSonra = { ...bakimSonra, son: undefined };

  // 8) Masaüstü uçları (60 sn).
  const masa = ctx.server.client();
  denetle("olcek10 girişi", (await masa.login("olcek10", STAFF_PASS)).status === 200);
  const islek = ids.slice(0, 40);
  const UCLAR = {
    cariListesi: [masa, () => at("/api/workspace/accounts?status=all&limit=500")],
    cariKarti: [masa, () => at(`/api/workspace/accounts/${islek[Math.floor(Math.random() * islek.length)]}`)],
    cariWhatsappGecmisi: [admin, () => at(`${W}/history?accountId=${encodeURIComponent(islek[Math.floor(Math.random() * islek.length)])}`)],
    waGonderimler: [admin, () => at(`${W}/batches?limit=30`)],
    waGonderimDurumu: [admin, () => at(`${W}/sending-status`)],
    waBuAy: [admin, () => at(`${W}/stats`)],
  };
  const sureler = Object.fromEntries(Object.keys(UCLAR).map(k => [k, []]));
  const durumlar = {};
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  const bit = performance.now() + 60_000;
  while (performance.now() < bit) {
    for (const [ad, [ist, yol]] of Object.entries(UCLAR)) {
      const t = performance.now();
      const r = await ist.get(yol());
      sureler[ad].push(performance.now() - t);
      const k = `${ad}:${r.status}`;
      durumlar[k] = (durumlar[k] || 0) + 1;
    }
  }
  h.disable();
  sonuc.masaustu = { durumlar, olayDongusu: { p99ms: Math.round(h.percentile(99) / 1e6), enCokMs: Math.round(h.max / 1e6) }, uclar: Object.fromEntries(Object.entries(sureler).map(([k, l]) => [k, ozet(l)])) };
  log("masaüstü", JSON.stringify(sonuc.masaustu));
  denetle("masaüstü uçları 200", Object.keys(durumlar).every(k => k.endsWith(":200")), JSON.stringify(durumlar));
  sonuc.bellek = { rssEnCokMb: mb(Math.max(...bellek)), rssSonMb: mb(process.memoryUsage().rss) };
} finally {
  clearInterval(bellekOrnek);
  await ctx.kapat();
  sonuc.dosyalarSonra = Object.fromEntries(Object.entries(boyutlar(`${IS}/data`)).filter(([k]) => /sqlite/.test(k)));
  sonuc.denetimler = denetimler;
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, JSON.stringify(sonuc, null, 2));
  const gecen = denetimler.filter(x => x.ok).length;
  console.log(`1..${denetimler.length}\n# tests ${denetimler.length}\n# pass ${gecen}\n# fail ${denetimler.length - gecen}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = gecen === denetimler.length ? 0 : 1;
}
