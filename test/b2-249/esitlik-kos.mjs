// 2.4.9 B2 (docs/2.4.9-tasarim/B2-elle-toplu-alici.md §5 E1) — EŞİTLİK KOŞUSU: hazırlanmış verinin (esitlik-hazirla.mjs, programın kendi API'siyle) TAZE kopyasında, sabit
// sahte saatle, AYNI gövde dizisini POST /api/workspace/whatsapp/targets'a verir ve her yanıtın TAMAMINI (recipients sırası, statement metni, today, range, office; ret
// yanıtlarının iletisi) özetler: yanıtın sha256'sı + kişi başı sha256 (ilk farklı kişiyi bulmak için) + sınıf sayıları (R4: 0 olan sınıf = eksik kanıt). ESKİ kodun ayrı
// kopyasında (git archive e3f74093 — ders 23, 25) ve YENİ kodda ayrı ayrı koşulur; esitlik-karsilastir.mjs iki çıktıyı karşılaştırır. Ürün kodu DEĞİŞMEZ.
// Kullanım: node test/b2-249/esitlik-kos.mjs <hazır veri> <iş klasörü> <json çıktısı> <yerel saat (ofsetsiz, ör. 2026-12-01T00:30:00)> [tam|dar] [dis]
//   dis: karşılaştırıcının dişi — ilk gövdede son tahsilatı olan ilk kişinin lastPayment.amount'u +0,01 bozulur (karşılaştırıcı tam 1 fark bulmalı).
// Dış istek YOK (ders 30): düzenek test/isz-248/ortak.mjs (sahte Meta ayrı süreçte, lisans / kapıcı yerel sahte, HUKUK_LICENSE_URL ölü adres).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { KOK, surum, kurulum, log } from "../isz-248/ortak.mjs";

const [VERI, IS, CIKTI, SAAT, KAPSAM = "tam", DIS = ""] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI || !SAAT) throw new Error("kullanım: esitlik-kos.mjs <veri> <iş> <json> <saat> [tam|dar] [dis]");
const TARGETS = "/api/workspace/whatsapp/targets";
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sonuc = { kok: KOK, commit: surum(), node: process.version, tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, veri: VERI, saat: SAAT, kapsam: KAPSAM, dis: DIS === "dis", adimlar: [] };

const siniflar = recipients => {
  const say = f => recipients.filter(f).length;
  const nedenler = {};
  for (const r of recipients) if (r.reason) nedenler[r.reason] = (nedenler[r.reason] || 0) + 1;
  return {
    alici: recipients.length, gecerli: say(r => r.valid), pasif: say(r => r.passive), istemiyor: say(r => r.optOut), siradakiTaksit: say(r => r.next), gecikmis: say(r => r.overdue?.count),
    sonTahsilat: say(r => r.lastPayment), sonGonderim: say(r => r.lastSend), ekstreli: say(r => r.statement), devirli: say(r => /\nDevir: /.test(r.statement || "")), bakiyeSifirDegil: say(r => Math.abs(r.balance) > 0.005), nedenler,
  };
};

const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `b2e${Date.now().toString(36)}` });
try {
  const { admin, at } = ctx;
  const s2 = ctx.sirketler.find(c => String(c.code) === "002")?.id;
  const at2 = u => `${u}${u.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(s2)}`;
  const silinmisOf = file => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return db.prepare("SELECT id FROM accounts WHERE deleted_at IS NOT NULL ORDER BY id").all().map(row => row.id);
    } finally {
      db.close();
    }
  };
  const L = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
  const silinmis = silinmisOf(path.join(IS, "data/destekofis.sqlite"));
  // Seçim (~2.000): listenin başı (hazırlığın sınıfları L[10..760)) + sondaki yeni cariler (hareketsiz, aynı ad) + silinmiş + olmayan kimlik.
  const sec = [...L.slice(0, 1980), ...L.slice(-7), ...silinmis.slice(0, 5), "b2-yok-1"];
  const gruplar = (await admin.get(at("/api/workspace/plans/groups"))).data.data;
  const grupListe = Array.isArray(gruplar) ? gruplar : gruplar.groups || [];
  const grup = grupListe.find(g => g.name === "B2 Grup A");
  const altGrup = (grup?.subgroups || []).find(g => g.name === "Alt 1");
  sonuc.secim = { liste: L.length, secilen: sec.length, silinmis: silinmis.length, grup: Boolean(grup), altGrup: Boolean(altGrup) };
  const taksitli = L[400];
  const govdeler = [
    ["Ekstre Bu Ay (seçili)", { kind: "statement", ids: sec, preset: "thisMonth" }, "dar"],
    ["Ekstre Geçen Ay (seçili)", { kind: "statement", ids: sec, preset: "lastMonth" }, "dar"],
    ["Ekstre Son 3 Ay (seçili)", { kind: "statement", ids: sec, preset: "last3" }, "dar"],
    ["Ekstre Tüm Hareketler (seçili)", { kind: "statement", ids: sec, preset: "all" }, "dar"],
    ["Mesaj (seçili)", { kind: "message", ids: sec }, "dar"],
    ["Tümüne Ekstre Bu Ay (etkin)", { kind: "statement", all: true, preset: "thisMonth" }],
    ["Tümüne Mesaj (pasif)", { kind: "message", all: true, status: "passive" }],
    ["Tümüne Ekstre Tüm Hareketler (tümü)", { kind: "statement", all: true, status: "all", preset: "all" }, "dar"],
    ...["debtor", "creditor", "zero", "nonzero", "overdue"].map(balance => [`Tümüne Mesaj bakiye=${balance}`, { kind: "message", all: true, status: "all", balance }]),
    ["Tümüne Ekstre grup", { kind: "statement", all: true, status: "all", group: grup?.id || "grup-yok", preset: "last3" }],
    ["Tümüne Ekstre grup + alt grup", { kind: "statement", all: true, status: "all", group: grup?.id || "grup-yok", subgroup: altGrup?.id || "alt-yok", preset: "last3" }],
    ["Tümüne Mesaj arama 'B2'", { kind: "message", all: true, status: "all", q: "B2" }],
    ["Tümüne Mesaj tür tedarikçi", { kind: "message", all: true, status: "all", type: "supplier" }],
    ["Tümüne Ekstre Geçen Ay (100 hariç)", { kind: "statement", all: true, status: "all", preset: "lastMonth", except: L.slice(0, 100) }],
    ["Tek kişi (cari kartı yolu)", { kind: "statement", ids: [taksitli], preset: "all" }],
    ["Silinmiş + olmayan + geçerli karışık", { kind: "statement", ids: [...silinmis, "b2-yok-2", L[0], L[15], L[45]], preset: "thisMonth" }],
    ["5.000 kimlik (sınırda)", { kind: "statement", ids: [...L, ...Array.from({ length: 5000 - L.length }, (_, i) => `b2-yok-s${i}`)], preset: "thisMonth" }],
    ["5.001 kimlik (sınır aşımı)", { kind: "statement", ids: [...L, ...Array.from({ length: 5001 - L.length }, (_, i) => `b2-yok-s${i}`)], preset: "thisMonth" }],
    ["Boş seçim", { kind: "message", ids: [] }],
  ];
  const govdeler2 = s2
    ? [
        ["Şirket 2 Tümüne Ekstre Bu Ay (tümü)", { kind: "statement", all: true, status: "all", preset: "thisMonth" }, "dar"],
        ["Şirket 2 Mesaj (seçili + silinmiş)", { kind: "message", ids: "S2" }],
      ]
    : [];
  const kos = async (ad, govde, yer) => {
    const t = performance.now();
    const r = await admin.post(yer(TARGETS), govde);
    const ms = Math.round(performance.now() - t);
    const d = r.data?.data;
    if (r.status === 200 && d?.recipients) {
      if (sonuc.dis && sonuc.adimlar.length === 0) {
        const kisi = d.recipients.find(x => x.lastPayment);
        if (kisi) kisi.lastPayment.amount = Math.round((kisi.lastPayment.amount + 0.01) * 100) / 100;
      }
      const { recipients, ...ust } = d;
      sonuc.adimlar.push({ ad, durum: r.status, ust, sha: sha(d), kisiler: recipients.map(x => `${x.id}:${sha(x).slice(0, 20)}`), siniflar: siniflar(recipients), ms });
    } else sonuc.adimlar.push({ ad, durum: r.status, govde: r.data, sha: sha(r.data), ms });
    log(ad, r.status, d?.recipients ? `alıcı ${d.recipients.length}` : JSON.stringify(r.data).slice(0, 120), `${ms} ms`);
  };
  for (const [ad, govde, k] of govdeler) if (KAPSAM === "tam" || k === "dar") await kos(ad, govde, at);
  if (s2) {
    const L2 = (await admin.get(at2("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
    const dir2 = JSON.parse(readFileSync(path.join(IS, "data/sirketler.json"), "utf8")).companies.find(c => String(c.code) === "002").dir;
    const silinmis2 = silinmisOf(path.join(IS, "data", dir2, "destekofis.sqlite"));
    for (const [ad, govde, k] of govdeler2) if (KAPSAM === "tam" || k === "dar") await kos(ad, govde.ids === "S2" ? { ...govde, ids: [...L2, ...silinmis2] } : govde, at2);
  }
} finally {
  await ctx.kapat();
}
sonuc.bitti = new Date().toISOString();
writeFileSync(CIKTI, `${JSON.stringify(sonuc)}\n`);
log("yazıldı", CIKTI, sonuc.adimlar.length, "adım");
