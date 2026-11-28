// 2.5.1 D3 TUR 6 — DAR KONTROL D3 TUR 1–5 ORTA-1 (BAŞ MİMAR KARARI 27.11 23:01 UTC; ana oturum iki TZ'de yeniden üretti — docs/kanit/2026-11-27/ana-dkd3/):
// ESKİ SÜRÜMDE KAPATILMIŞ TAKSİT KARTI DEVİR PLANINDA 'AÇIK'. 2.0.13'ten önce kapatılan kartta kapanış günü alanı (closed_at) boş (2.0.13 geriye doldurmadı; göç 53 bu kartlara '2.4.9'
// kapanış kuralı yazar — kalan silinir). Program kapanış gününü "closed_at yoksa son güncelleme günü, Kayıt Tarihi'nden önce değil" diye okur (lib/accounts.mjs closeDaySql; cari ekstresi,
// genel defter 689, kilit ve mutabakat aynı tanım); devir planının okuyucusu yedeği kullanmıyor, kartı K'de AÇIK sayıyordu → yeni yılda 700 TL kalanla açılırdı (devirli ≠ devirsiz).
// Veri: v2.0.12'nin GERÇEK koduyla, kendi API'sinden üretildi (test/fixtures/d3t6-v2012/uret.mjs.txt; v2.0.12'de closed_at sütunu yok — v2012.json closedAtSutunu=false). Beş kart, her biri
// 1.000 TL / 2 taksit (Kayıt 01.05.2026) + 20.06.2026 300 TL tahsilat; kapanış: 25.06.2026 (K öncesi), 31.12.2026 (K günü), 03.01.2027 (K sonrası), biri açık. K = 31.12.2026, ön izleme
// 05.01.2027 (sahte saat; ders 13). BEKLENEN sayılar programın KENDİ devirsiz hesabından değil karar metninden (ders 5): kapalı kartın carisinde bakiye 0 → kart K'de KAPALI, kalan 0;
// K sonrası kapanmış kart K'de AÇIK, kalan 700; ön izleme taksitKarti 2 açık / 1.400,00 TL + 2 kapalı.
// Taban (t251-d3t6-taban) kırmızı nedeni: Haziran ve K günü kartları 'acik', kalan 700 (taksitKarti {acik:4,kalanMinor:280000,kapali:0}).
// İkinci bölüm (dar kontrolün DOĞRULANMADI maddesi): CARİSİZ kapalı kart — kalanı 127'ye karşılık yazılır; kapalı sayılmazsa 700 beklenir, defterde 0 → sebepsiz 'Hesap Bakiyesi
// Modülle Tutmuyor'. Carisiz kart program API'siyle üretilemez (v2.0.6'dan beri her kart cariyle açılır, göç eski kartları cariye bağlar, kartı olan cari silinmez) → AYNI v2.0.12 verisinde
// bir kartın cari bağı ELLE boşaltılır (ek denetim — anayasa: elle kayıt yalnız ek denetim; bağ boşaltma dışında veri programın).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "d3t6-v2012");
const OLD = JSON.parse(readFileSync(path.join(DIR, "v2012.json"), "utf8"));
const K = "2026-12-31";
const NOW = "2027-01-05T10:00:00+03:00";
const C = OLD.kartlar;

async function boot({ carisiz = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "d3t6-v2012-"));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "destekofis.sqlite");
  writeFileSync(file, gunzipSync(readFileSync(path.join(DIR, "destekofis.sqlite.gz"))));
  if (carisiz) {
    const db = new DatabaseSync(file);
    db.prepare("UPDATE plans SET account_id = '' WHERE id = ?").run(C.carisiz.id);
    db.close();
  }
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = await loginAdmin(server);
  const started = await client.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: K, option: "borc-alacak" });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  let job;
  for (let i = 0; i < 1200; i += 1) {
    job = (await client.get(`/api/admin/devir/preview/${started.data.data.id}`)).data.data;
    if (job.state !== "running") break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return { root, server, client, store: server.app.store, job };
}
const close = async ctx => {
  if (!ctx) return;
  await ctx.server.close();
  removeTestDir(ctx.root);
};
const card = (plan, key) => plan.newYear.kartlar.find(row => row.kart === C[key].id);
const raporRows = job => [...JSON.stringify(job.result.rapor).matchAll(/"Taksit Kartı","([^"]*)","([^"]*)"/g)].map(m => [m[1], m[2]]);

describe("D3 tur 6 — v2.0.12'de kapatılmış (closed_at boş) taksit kartı devir planında programın kapanış günüyle", () => {
  let ctx;
  before(async () => {
    assert.equal(OLD.kod, "v2.0.12", "ön koşul: fikstür v2.0.12'nin gerçek koduyla üretildi");
    assert.equal(OLD.closedAtSutunu, false, "ön koşul: v2.0.12'de closed_at sütunu yok");
    ctx = await boot();
  });
  after(() => close(ctx));

  it("veri tabanı (ders 3): göçten sonra dört kapalı kartta closed_at BOŞ, kapanış kuralı '2.4.9'; son güncelleme günleri 25.06 / 25.06 / 31.12.2026 / 03.01.2027", () => {
    const row = key => ctx.store.get("SELECT status, closed_at AS closedAt, close_rule AS closeRule, substr(updated_at, 1, 10) AS updated FROM plans WHERE id = ?", C[key].id);
    for (const key of ["haziran", "carisiz", "kGunu", "kSonrasi"]) assert.deepEqual({ ...row(key), updated: undefined }, { status: "closed", closedAt: null, closeRule: "2.4.9", updated: undefined }, key);
    assert.deepEqual(["haziran", "carisiz", "kGunu", "kSonrasi"].map(key => row(key).updated), ["2026-06-25", "2026-06-25", "2026-12-31", "2027-01-03"]);
    assert.equal(row("acik").status, "active");
  });

  it("devirsiz program: kapalı kartın carisinde bakiye 0, planRemaining 0; açık kartta 700; K'de (genel defter 120) K sonrası kapanan kartın carisi 700", async () => {
    for (const key of ["haziran", "kGunu", "kSonrasi", "acik"]) {
      const r = await ctx.client.get(`/api/workspace/accounts/${C[key].accountId}`);
      assert.equal(r.status, 200);
      const b = r.data.data.totals;
      assert.deepEqual({ balance: b.balance, planRemaining: b.planRemaining }, key === "acik" ? { balance: 700, planRemaining: 700 } : { balance: 0, planRemaining: 0 }, key);
    }
    const k120 = {};
    for (const entry of ctx.server.app.ledger.build()) if (entry.date <= K) for (const line of entry.lines || []) if (line.account === "120" && line.party) k120[line.party] = (k120[line.party] || 0) + line.debit - line.credit;
    assert.deepEqual(["haziran", "kGunu", "kSonrasi", "acik"].map(key => k120[C[key].accountId] || 0), [0, 0, 70000, 70000]);
  });

  it("devir planı (K = 31.12.2026): K öncesi ve K günü kapanan kart KAPALI, kalan 0; K sonrası kapanan ve açık kart AÇIK, kalan 700", () => {
    assert.equal(ctx.job.state, "done", JSON.stringify(ctx.job.error));
    const plan = ctx.job.result.plan;
    const pick = key => ({ durum: card(plan, key).durum, kalanMinor: card(plan, key).kalanMinor, odenenMinor: card(plan, key).odenenMinor });
    assert.deepEqual(pick("haziran"), { durum: "kapali", kalanMinor: 0, odenenMinor: 30000 });
    assert.deepEqual(pick("carisiz"), { durum: "kapali", kalanMinor: 0, odenenMinor: 30000 });
    assert.deepEqual(pick("kGunu"), { durum: "kapali", kalanMinor: 0, odenenMinor: 30000 });
    assert.deepEqual(pick("kSonrasi"), { durum: "acik", kalanMinor: 70000, odenenMinor: 30000 });
    assert.deepEqual(pick("acik"), { durum: "acik", kalanMinor: 70000, odenenMinor: 30000 });
    assert.deepEqual(plan.sayilar.taksitKarti, { acik: 2, kalanMinor: 140000, kapali: 3 });
  });

  it("carinin devir satırı = devirsiz K bakiyesi (kapalı kartın carisi 0 / satırsız; K sonrası kapanan 700)", () => {
    const plan = ctx.job.result.plan;
    const cari = key => plan.newYear.cariler.find(row => row.cari === C[key].accountId);
    for (const key of ["haziran", "kGunu"]) assert.ok(!cari(key) || (cari(key).kBakiyeMinor === 0 && cari(key).satirlar.length === 0), `${key}: ${JSON.stringify(cari(key))}`);
    assert.equal(cari("kSonrasi").kBakiyeMinor, 70000);
    assert.equal(cari("acik").kBakiyeMinor, 70000);
  });

  it("Devir Raporu: '2 açık (1.400,00 TL) · 3 kapalı'; 'Kalan 0 Taksit' satırı YOK; açık iki kartın satırı 'Kalan 2 Taksit 700,00 TL'; durduran yok, sorun yok", () => {
    const rows = raporRows(ctx.job);
    assert.ok(rows.some(([a]) => a === "2 açık (1.400,00 TL) · 3 kapalı"), JSON.stringify(rows));
    assert.ok(!rows.some(([a]) => a.startsWith("Kalan 0 Taksit")), JSON.stringify(rows));
    assert.equal(rows.filter(([a, b]) => a === "Kalan 2 Taksit" && b === "700,00 TL").length, 2, JSON.stringify(rows));
    assert.deepEqual(ctx.job.result.plan.sorunlar, []);
    assert.deepEqual(ctx.job.result.onDenetim.durdurur.map(item => item.kod), []);
  });
});

describe("D3 tur 6 — dar kontrolün DOĞRULANMADI maddesi: carisiz, v2.0.12'de kapatılmış kart 127'de sebepsiz durdurma doğurmaz", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ carisiz: true });
  });
  after(() => close(ctx));

  it("genel defter: carisiz kapalı kartın 127 bakiyesi K'de 0 (689 kapanış günü 25.06.2026)", () => {
    let b127 = 0;
    for (const entry of ctx.server.app.ledger.build()) if (entry.date <= K) for (const line of entry.lines || []) if (line.account === "127") b127 += line.debit - line.credit;
    assert.equal(b127, 0);
  });

  it("plan: carisiz kart KAPALI, kalan 0", () => {
    assert.equal(ctx.job.state, "done", JSON.stringify(ctx.job.error));
    const row = card(ctx.job.result.plan, "carisiz");
    assert.deepEqual({ cari: row.cari, durum: row.durum, kalanMinor: row.kalanMinor }, { cari: "", durum: "kapali", kalanMinor: 0 });
  });

  it("127 modül farkı YOK; 'Hesap Bakiyesi Modülle Tutmuyor' durdurması YOK", () => {
    assert.deepEqual(ctx.job.result.plan.sorunlar, []);
    const stops = ctx.job.result.onDenetim.durdurur;
    assert.deepEqual(stops.map(item => item.kod), [], JSON.stringify(stops.map(item => [item.kod, item.baslik, item.neOldu])));
  });
});
