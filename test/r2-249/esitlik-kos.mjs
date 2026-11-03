// 2.4.9 R2 (ders 47 "eşdeğerlik testi: eski ↔ yeni çıktı birebir") — EŞİTLİK KOŞUSU: hazırlanmış verinin (programın kendi API'siyle: test/b2-249/ek-hazirla.mjs iade,
// test/r2-249/cesit-hazirla.mjs) TAZE kopyasında, sabit sahte saatle, BÜTÜN carilerde (silinmişler dahil) şunların TAMAMI özetlenir (sha256 + kalem başı sha):
//   forAccount (taksit kartları, kesintiler), cari kartı servisi (accounts.detail) ve HTTP ucu (GET /accounts/:id), kartın WhatsApp çekirdeği (accounts.waFacts),
//   mizan girdisi (plans.ledgerPlansByAccount), elle alıcı listesi gövdeleri (POST /whatsapp/targets), otomatik önizleme gövdeleri (POST /whatsapp/batches/preview).
// ESKİ kodun ayrı kopyasında (git archive e6ee52a8 — ders 23, 25) ve YENİ kodda ayrı ayrı koşulur; esitlik-karsilastir.mjs iki çıktıyı karşılaştırır. Ürün kodu DEĞİŞMEZ.
// Kullanım: node test/r2-249/esitlik-kos.mjs <hazır veri> <iş klasörü> <json çıktısı> [dis]
//   dis: karşılaştırıcının dişi — kesintisi olan İLK kartın returnCuts'ı +0,01 bozulur (karşılaştırıcı forAccount ve kesintilerde tam 1 fark bulmalı).
// Dış istek YOK (ders 30): düzenek test/isz-248/ortak.mjs (sahte Meta, lisans / kapıcı yerel sahte, HUKUK_LICENSE_URL ölü adres).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { KOK, surum, kurulum, log } from "../isz-248/ortak.mjs";

const [VERI, IS, CIKTI, DIS = ""] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: esitlik-kos.mjs <veri> <iş> <json> [dis]");
const SAAT = "2026-11-03T15:00:00+03:00";
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sonuc = { kok: KOK, commit: surum(), node: process.version, tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, veri: VERI, saat: SAAT, dis: DIS === "dis", bolumler: {}, ms: {} };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `r2e${Date.now().toString(36)}` });
try {
  const { admin, at } = ctx;
  const db = ctx.app.store;
  const plans = ctx.app.context.plans;
  const accounts = ctx.app.context.accounts;
  const user = db.get("SELECT id, username, display_name, role FROM users WHERE username = 'admin'");
  const ids = db.all("SELECT id FROM accounts ORDER BY rowid").map(row => row.id);
  const bolum = (ad, kalemler) => {
    sonuc.bolumler[ad] = { n: kalemler.length, sha: sha(kalemler), kalemler: kalemler.map(([k, v]) => `${k}:${sha(v).slice(0, 24)}`) };
  };
  const zaman = async (ad, fn) => {
    const t = performance.now();
    const v = await fn();
    sonuc.ms[ad] = Math.round(performance.now() - t);
    log(ad, sonuc.ms[ad], "ms");
    return v;
  };
  const oku = (fn, ...args) => {
    try {
      return fn(...args);
    } catch (error) {
      return { hata: `${error.status || ""} ${error.message}` };
    }
  };
  // HTTP bölümleri ÖNCE: aşağıdaki eşzamanlı servis döngüleri olay döngüsünü dakikalarca tutar (eski kodda detail 4.021 caride ~100 sn); ardından gelen ilk istek, boşta
  // kalan bağlantıyı sunucunun keep-alive süresi kapatırken aynı anda yazılıp ECONNRESET alıyordu (ilk koşu, 20:57 — test düzeneği, ürün değil).
  bolum(
    "httpKart",
    await zaman("httpKart", async () => {
      const out = [];
      for (const id of ids) {
        const r = await admin.get(at(`/api/workspace/accounts/${encodeURIComponent(id)}`));
        out.push([id, { durum: r.status, govde: r.data }]);
      }
      return out;
    }),
  );
  const telefonlu = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.filter(a => a.phone).map(a => a.id);
  sonuc.telefonlu = telefonlu.length;
  const govdeler = [
    ["targets ekstre Bu Ay 2.000", "/api/workspace/whatsapp/targets", { kind: "statement", ids: telefonlu.slice(0, 2000), preset: "thisMonth" }],
    ["targets ekstre Bu Ay son 2.000", "/api/workspace/whatsapp/targets", { kind: "statement", ids: telefonlu.slice(-2000), preset: "thisMonth" }],
    ["targets Tümüne ekstre (tümü)", "/api/workspace/whatsapp/targets", { kind: "statement", all: true, status: "all", preset: "thisMonth" }],
    ["targets Tümüne mesaj (etkin)", "/api/workspace/whatsapp/targets", { kind: "message", all: true }],
    ["önizleme ekstre son 2.000", "/api/workspace/whatsapp/batches/preview", { kind: "statement", ids: telefonlu.slice(-2000), preset: "thisMonth" }],
    ["önizleme hatırlatma tümü", "/api/workspace/whatsapp/batches/preview", { kind: "reminder", ids: telefonlu }],
  ];
  for (const [ad, yol, govde] of govdeler) {
    const r = await zaman(ad, () => admin.post(at(yol), govde));
    const d = r.data?.data;
    const liste = d?.recipients || d?.people || null;
    sonuc.bolumler[ad] = { durum: r.status, sha: sha(r.data), n: Array.isArray(liste) ? liste.length : null, kalemler: Array.isArray(liste) ? liste.map((x, i) => `${x.id || x.accountId || i}:${sha(x).slice(0, 24)}`) : [] };
    log(ad, r.status, Array.isArray(liste) ? `kalem ${liste.length}` : JSON.stringify(r.data).slice(0, 160));
  }
  // forAccount + kesintiler (kart kimliği → returnCuts).
  let bozuldu = false;
  const kesinti = [];
  const fa = await zaman("forAccount", () =>
    ids.map(id => {
      const liste = plans.forAccount(id, user);
      for (const plan of liste) {
        if (sonuc.dis && !bozuldu && plan.returnCuts > 0) {
          plan.returnCuts = Math.round((plan.returnCuts + 0.01) * 100) / 100;
          bozuldu = true;
        }
        kesinti.push([plan.id, plan.returnCuts]);
      }
      return [id, liste];
    }),
  );
  bolum("forAccount", fa);
  bolum("kesintiler", kesinti);
  sonuc.kesinti = { kart: kesinti.length, kesintili: kesinti.filter(([, v]) => v > 0).length, toplam: Math.round(kesinti.reduce((s, [, v]) => s + v, 0) * 100) / 100, kartliCari: fa.filter(([, l]) => l.length).length, cari: ids.length };
  const mizan = await zaman("mizan", () => plans.ledgerPlansByAccount());
  bolum("mizan", [...mizan.keys()].sort().map(id => [id, mizan.get(id)]));
  bolum("detail", await zaman("detail", () => ids.map(id => [id, oku(accounts.detail, id, user)])));
  bolum("waFacts", await zaman("waFacts", () => ids.map(id => [id, oku(accounts.waFacts, id, user)])));
} finally {
  await ctx.kapat();
}
sonuc.bitti = new Date().toISOString();
writeFileSync(CIKTI, `${JSON.stringify(sonuc)}\n`);
log("yazıldı", CIKTI);
