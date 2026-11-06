#!/usr/bin/env node
// 2.5.0 MUHASEBE SÜRÜCÜSÜ — koşucu. Kodu görmeyen muhasebe kâhininin (test/bagimsiz/muhasebe/, dil "muhasebe-kahin/1") senaryolarını GERÇEK programa
// uygular (program.mjs; her senaryo × saat dilimi AYRI SÜREÇ, kendi geçici veri klasörü, lisans servisi yerel ölü adres — ders 30) ve kâhinin modeliyle
// karşılaştırır (karsilastir.py; kâhinin klasörüne yazmaz — ders 5, 40). Sürücü kâhinin beklenenlerini DEĞİŞTİRMEZ; farkı sınıflar:
//   AYNI · U (2.5.0'da yazılacak işe bağlı, belgeli kural değişimi; etiket + iş kodu) · P program hatası · K kâhin şüphesi · R kural belirsiz / kullanıcıya
//   (P / K / R yalnız siniflama.json'daki elle yazılmış, kanıtlı kayıtlardan; yoksa SINIFLANMADI = kırmızı).
//
// Kullanım:
//   node test/bagimsiz/muhasebe-surucu/kos.mjs [--senaryo s01,s07|rastgele] [--tz UTC,Europe/Istanbul] [--cikti <klasör>] [--program <kök>] [--adim 0|1]
//                                              [--dal A] [--veri <geçici klasör>] [--paralel 2]
//   npm run test:surucu-muhasebe                         (bütün senaryolar, iki saat dilimi)
//   KANIT: node tools/kanit.mjs kos surucu-muhasebe-<ad> -- node test/bagimsiz/muhasebe-surucu/kos.mjs --cikti docs/kanit/<gün>/surucu-muhasebe-<ad>
//   ESKİ KOD (ders 6, 23): git archive v2.4.9 | tar -x -C <ayrı klasör> → --program <o klasör> (node_modules gerekmez: program yalnız node: modülleri kullanır).
// Ç2–Ç6 / D2–D6 ajanları: iş bitince U satırlarından kendi etiketlerininkiler AYNI'ya dönmeli; BUGÜN görünümünün ilgili DEĞİŞİM satırı (karsilastir.py ETIKET +
// degistir()) kaldırılır (aksi hâlde program = kâhin olunca o satır "U" değil "AYNI" görünür, ama değişim tablosu eskir).
// SÜRÜCÜ BAKIMI 2 (06.11.2026; kâhin bakımı 1 – 2, iş listesi D G5): Tek Yükümlülük Kuyruğu raporları (gecikmiş, hatırlatma, kartlar, açık faturalar, açık
// kalemler, kilit bağ notu, açılış fişleri, kaynak durumu, kural farkı) karşılaştırılır; her U satırı KURAL KİMLİĞİ taşır (Ç5-(1) … Ç7b-(6), D4-(7), önceki
// KG / Ç5 / Ç7a / Ç7b etiketleri) → "BEKLEYEN KURAL FARKLARI" (ozet.json bekleyen: kimlik → senaryo / denetim sayısı). Geçmiş günlü raporun farkı (program
// as-of okumaz) ÖLÇÜLEMEDİ: geçti sayılmaz, "# skipped" ve ayrı listede. Varsayılan dal A (kâhin bakımı: eski "KG3=SORU" etiketi kalktı).
// GERİLEME (G5): aynı sürücüyle eski ve yeni ağacın program çıktıları → python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py <eski çıktı> <yeni çıktı>.
// Çıkış: 0 yalnız SINIFLANMADI / P / K / R / red farkı / sürücü hatası / öz denetim bozukluğu yoksa. Sonda node:test biçiminde özet (# tests / # pass / # fail).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const KAHIN = path.join(ROOT, "test", "bagimsiz", "muhasebe", "senaryolar");
const argv = process.argv.slice(2);
const opt = (name, def = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const TZS = opt("--tz", "UTC,Europe/Istanbul").split(",").filter(Boolean);
const CIKTI = path.resolve(opt("--cikti", path.join(tmpdir(), `surucu-muhasebe-${process.pid}`)));
const VERI = path.resolve(opt("--veri", path.join(tmpdir(), `surucu-muhasebe-veri-${process.pid}`)));
const PROGRAM = opt("--program") ? path.resolve(opt("--program")) : "";
const DAL = opt("--dal", "A");
const ADIM = opt("--adim", "1");
const PARALEL = Math.max(1, Number(opt("--paralel", "2")) || 1);
const filtre = (opt("--senaryo", "") || "").split(",").filter(Boolean);
const senaryolar = readdirSync(KAHIN).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, "")).filter(ad => !filtre.length || filtre.some(x => ad === x || ad.startsWith(x))).sort();
if (!senaryolar.length) throw new Error(`senaryo yok: ${filtre.join(",")}`);
mkdirSync(CIKTI, { recursive: true });

function kos(komut, args, env = {}) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const p = spawn(komut, args, { cwd: ROOT, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.stderr.on("data", d => (out += d));
    p.on("close", code => resolve({ code, out, ms: Date.now() - t0 }));
  });
}

const isler = [];
for (const ad of senaryolar) for (const tz of TZS) isler.push({ ad, tz });
const sonuclar = [];
async function isci() {
  for (;;) {
    const is = isler.shift();
    if (!is) return;
    const { ad, tz } = is;
    const etiket = tz.replace(/[^A-Za-z0-9]+/g, "-");
    const dir = path.join(CIKTI, etiket);
    mkdirSync(dir, { recursive: true });
    const veri = path.join(VERI, `${ad}-${etiket}`);
    rmSync(veri, { recursive: true, force: true });
    const prog = path.join(dir, `${ad}.program.json`);
    const p = await kos(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(HERE, "program.mjs"), "--senaryo", path.join(KAHIN, `${ad}.json`), "--cikti", prog, "--veri", veri, "--adim", ADIM, ...(PROGRAM ? ["--program", PROGRAM] : [])], { TZ: tz });
    rmSync(veri, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    rmSync(prog.replace(/\.json$/, ".api.json"), { force: true });
    let k = { code: 1, out: "program koşusu düştü, karşılaştırma yapılmadı" };
    const fark = path.join(dir, `${ad}.fark.json`);
    if (existsSync(prog)) k = await kos(PYTHON, ["-I", path.join(HERE, "karsilastir.py"), "--kok", ROOT, "--senaryo", path.join(KAHIN, `${ad}.json`), "--program", prog, "--beklenen", path.join(KAHIN, "beklenen", `${ad}.json`), "--cikti", fark, "--dal", DAL, "--siniflama", path.join(HERE, "siniflama.json")]);
    const satir = `${p.out.trim().split("\n").at(-1)}\n    ${k.out.trim().split("\n").at(-1)}  (${Math.round(p.ms / 1000)} sn + ${Math.round(k.ms / 1000)} sn)`;
    console.log(satir);
    const olcum = existsSync(prog) ? JSON.parse(readFileSync(prog, "utf8")).olcum : null;
    sonuclar.push({ ad, tz, programCikis: p.code, karsilastirCikis: k.code, ms: p.ms, olcum, fark: existsSync(fark) ? JSON.parse(readFileSync(fark, "utf8")) : null, programHata: p.code ? p.out.slice(-1500) : "", karsilastirHata: k.code ? k.out.slice(-1500) : "" });
  }
}
await Promise.all(Array.from({ length: Math.min(PARALEL, isler.length) }, isci));

// ---------------------------------------------------------------- özet
const say = { AYNI: 0, U: 0, P: 0, K: 0, R: 0, SINIFLANMADI: 0, OLCULEMEDI: 0 };
// G5 BEKLEYEN KURAL FARKLARI: U satırlarının kural kimliği → { senaryolar, denetim sayısı } (iş listesi D G5; listede olmayan fark önce hata — ders 6).
const bekleyen = {};
const bekle = (kimlikler, ad, tz) => {
  for (const k of kimlikler || []) {
    const b = (bekleyen[k] ||= { senaryolar: new Set(), denetim: 0 });
    b.senaryolar.add(ad);
    if (tz === TZS[0]) b.denetim += 1;
  }
};
const olculemedi = [];
const etiketSay = {};
const fark = [];
let redFark = 0;
let ozBozuk = 0;
let hata = 0;
let uygulanamayan = 0;
let degismez = 0;
let adimSinifsiz = 0;
for (const r of sonuclar.sort((a, b) => (a.ad + a.tz).localeCompare(b.ad + b.tz))) {
  if (r.programCikis || r.karsilastirCikis || !r.fark) {
    hata += 1;
    fark.push(`${r.ad} [${r.tz}] KOŞU HATASI: ${(r.programHata || r.karsilastirHata).slice(-400)}`);
    continue;
  }
  const f = r.fark;
  if (!f.oz_denetim.raporlar_ayni) ozBozuk += 1;
  for (const [k, v] of Object.entries(f.ozet)) say[k] += v;
  for (const x of [...Object.values(f.raporlar).flatMap(y => y.satirlar), ...f.son]) {
    for (const e of x.etiket || []) if (x.sinif === "U") etiketSay[e] = (etiketSay[e] || 0) + 1;
    if (x.sinif === "U") bekle(x.kimlik?.length ? x.kimlik : ["KİMLİKSİZ-U"], r.ad, r.tz);
  }
  for (const x of f.redler) if (x.sinif === "U") bekle(x.kimlik || ["BUGÜN-DALI-RED"], r.ad, r.tz);
  for (const x of f.uygulanamayan) if (x.sinif === "U") bekle([x.kimlik || x.is || "UYGULANMADI"], r.ad, r.tz);
  for (const x of f.redler) {
    if (x.sonuc === "AYNI") continue;
    if (!x.sinif) redFark += 1;
    else if (x.sinif !== "U") for (const c of x.sinif.split("/")) say[c] += 1;
    if (x.sinif !== "U") fark.push(`${r.ad} [${r.tz}] RED #${x.no} ${x.tur}: kâhin ${x.kahin?.kod || "kabul"} · program ${x.program ? `${x.program.status} ${x.program.kod}` : "kabul"} → ${x.sinif || "SINIFLANMADI"}`);
  }
  for (const x of f.uygulanamayan) {
    if (!x.sinif || x.sinif === "SINIFLANMADI") uygulanamayan += 1;
    else if (x.sinif !== "U") for (const c of x.sinif.split("/")) say[c] += 1;
    if (x.sinif !== "U") fark.push(`${r.ad} [${r.tz}] OLAY #${x.no} ${x.tur} (${x.durum}) → ${x.sinif}: ${String(x.neden || "").slice(0, 160)}`);
  }
  for (const x of f.adim_farklari) if (x.sinif === "SINIFLANMADI") {
    adimSinifsiz += 1;
    fark.push(`${r.ad} [${r.tz}] ADIM ${x.no} ${x.olay_turu} ${x.id || ""} ${JSON.stringify(x.degisim)} → SINIFLANMADI`);
  }
  for (const [k, v] of Object.entries(f.degismezler)) if (v === false && !String(k).startsWith("kahin")) degismez += 1;
  for (const y of [...Object.entries(f.raporlar).flatMap(([ad, rr]) => rr.satirlar.map(x => ({ ...x, rapor: ad }))), ...f.son.map(x => ({ ...x, rapor: "son" }))]) if (y.sinif === "OLCULEMEDI") olculemedi.push(`${r.ad} [${r.tz}] ${y.rapor} ${y.alan}:${y.anahtar} program ${y.program} · kâhin ${y.kahin} · bugün ${y.bugun} (${y.aciklama || ""})`);
    else if (["P", "K", "R", "SINIFLANMADI"].some(c => String(y.sinif).split("/").includes(c))) fark.push(`${r.ad} [${r.tz}] ${y.rapor} ${y.alan}:${y.anahtar} program ${y.program} · kâhin ${y.kahin} · bugün ${y.bugun} → ${y.sinif}`);
}
writeFileSync(path.join(CIKTI, "ozet.json"), JSON.stringify({ senaryolar: senaryolar.length, tz: TZS, dal: DAL, program: PROGRAM || "bu-depo", say, etiketSay, bekleyen: Object.fromEntries(Object.entries(bekleyen).sort().map(([k, v]) => [k, { senaryo: v.senaryolar.size, denetim: v.denetim, senaryolar: [...v.senaryolar].sort() }])), olculemedi, redFark, uygulanamayan, adimSinifsiz, ozBozuk, degismez, hata, sonuclar: sonuclar.map(r => ({ ad: r.ad, tz: r.tz, ms: r.ms, ozet: r.fark?.ozet, olay: r.fark?.olay_durumlari, redler: r.fark?.redler?.filter(x => x.sonuc !== "AYNI").length, adim: r.fark?.adim_farklari?.length, olcum: r.olcum ? { olay_dongusu_en_cok_ms: r.olcum.olay_dongusu_en_cok_ms, olay_dongusu_p99_ms: r.olcum.olay_dongusu_p99_ms, istek_sayisi: r.olcum.istek_sayisi, en_agir: r.olcum.istekler.slice(0, 6) } : null })) }, null, 1));
console.log(`\nAYNI ${say.AYNI} · U ${say.U} · P ${say.P} · K ${say.K} · R ${say.R} · SINIFLANMADI ${say.SINIFLANMADI} · ÖLÇÜLEMEDİ ${say.OLCULEMEDI} · red farkı ${redFark} · uygulanamayan olay ${uygulanamayan} · sınıfsız adım farkı ${adimSinifsiz} · değişmez ${degismez} · öz denetim bozuk ${ozBozuk} · koşu hatası ${hata}`);
const olc = sonuclar.filter(r => r.olcum).map(r => ({ ad: `${r.ad} [${r.tz}]`, sn: Math.round(r.ms / 1000), dongu: r.olcum.olay_dongusu_en_cok_ms, defter: r.olcum.istekler.find(x => x.istek === "GET /api/workspace/ledger") }));
const enAgir = olc.sort((a, b) => b.dongu - a.dongu).slice(0, 5);
console.log(`Ölçüm (olay döngüsü en çok, ms): ${enAgir.map(x => `${x.ad} ${x.dongu} (koşu ${x.sn} sn; GET ledger ort ${x.defter ? Math.round(x.defter.toplam_ms / x.defter.sayi) : "-"} / en çok ${x.defter?.en_cok_ms ?? "-"} ms)`).join(" · ")}`);
console.log(`BEKLEYEN KURAL FARKLARI (kimlik: senaryo / denetim [${TZS[0]}]): ${Object.entries(bekleyen).sort().map(([k, v]) => `${k} ${v.senaryolar.size}/${v.denetim}`).join(" · ")}`);
if (olculemedi.length) console.log(`ÖLÇÜLEMEDİ (${olculemedi.length}; geçmiş günlü rapor — program as-of okumaz):\n${olculemedi.slice(0, 40).map(x => `  ${x}`).join("\n")}`);
console.log(`U etiketleri: ${Object.entries(etiketSay).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
if (fark.length) console.log(`\nFARKLAR (${fark.length}; ilk 200):\n${fark.slice(0, 200).map(x => `  ${x}`).join("\n")}`);
const kirmizi = say.P + say.K + say.R + say.SINIFLANMADI + redFark + uygulanamayan + adimSinifsiz + degismez + ozBozuk + hata;
const toplam = say.AYNI + say.U + say.OLCULEMEDI + kirmizi;
console.log(`\n# tests ${toplam}\n# pass ${toplam - kirmizi - say.OLCULEMEDI}\n# fail ${kirmizi}\n# cancelled 0\n# skipped ${say.OLCULEMEDI}\n# todo 0\nÇıktı: ${CIKTI}`);
if (!opt("--veri")) rmSync(VERI, { recursive: true, force: true });
process.exitCode = kirmizi ? 1 : 0;
