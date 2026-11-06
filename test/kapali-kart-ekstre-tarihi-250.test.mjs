// 2.5.0 BİRLEŞİK TUR 5 madde 4 (BT4 dar kontrol YB-1; eski kodda da — süzgeçle ORTA: cari ekstre ↔ genel defter tarihi): kapalı taksit kartının "Kart kapatıldı" (kalan düşüldü)
// satırının CARİ EKSTRE tarihi plans.updated_at'ten okunuyordu (lib/accounts.mjs accountLedger; routes/plans.mjs ledgerPlansByAccount ve PLAN_SQL closed_at seçmiyordu); GENEL
// DEFTER (routes/ledger.mjs + lib/general-ledger.mjs "plan-close", 689) kapanış gününü (closed_at; 2.0.13 öncesi kapatılmışta boş → son güncelleme günü; Kayıt Tarihi'nden önce
// değil) kullanıyor. Kart kapatıldıktan sonra notu / adı düzeltilince (ya da cari adı değişince — routes/plans.mjs followAccount kartın adını ve updated_at'ini değiştirir) satır
// ekstrede düzeltme gününe kayıyor, genel defter kapanış gününde kalıyordu → aynı carinin dönem ekstresi ile yevmiye / mizan ayrışıyordu.
// Beklenen (görev metni + genel defterin 2.0.26 G1 kuralı; kâhin = genel defterin kendi tarihi ve kapanış günü): cari kartının defteri, Cari Ekstre raporu ve Yevmiye Defteri'ndeki
// 689 satırı AYNI gün; o gün kapanış günü (closed_at), closed_at boşsa son güncelleme günü, Kayıt Tarihi'nden önce değil.
// "Nasıl bozulur?": kapat → +40 gün yalnız not düzelt; kapat → +40 gün cari adını değiştir (kartın adı cariyle aynı); v2.4.9 GERÇEK koduyla kapatılıp düzeltilmiş kart güncel
// kodla açılır; closed_at boş eski kart (2.0.13 öncesi) önce / sonra düzeltme; closed_at Kayıt Tarihi'nden önce. Saat: sahte, AKAN değil SABİT + elle ilerletme (ders 13, 22).
// Ders 30: lisans servisi ölü adres. Platform (ders 48): dosya silmez / kilitlemez (geçici klasör, sonda silinir).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";
import { bootVersion, CURRENT, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { removeTestDir } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const CLOSE_DAY = "2026-10-08";
const LATER = "2026-11-17T12:00:00+03:00"; // +40 gün
const PAST = "2026-09-01";
const ACC = "/api/workspace/accounts";
const PLANS = "/api/workspace/plans";
const RANGE = "from=2026-01-01&to=2026-12-31";
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const money = text => Number(String(text ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
const planForm = p => ({ name: p.name, refNo: p.refNo, registeredOn: p.registeredOn, phone: p.phone || "", total: String(p.total), note: p.note || "", caseKey: p.caseKey || "", caseSource: p.caseSource || "", caseTitle: p.caseTitle || "", accountId: p.accountId, groupId: p.groupId || "", subgroupId: p.subgroupId || "", updatedAt: p.updatedAt || "" });

/**
 * Kartın "Kart kapatıldı" satırının dört yerdeki günü: cari kartının defteri ve Cari Ekstre raporu (cari başına yol: plans.forAccount / PLAN_SQL), Tüm Cari Hareketleri (toplu yol:
 * accounts.allLedgers → plans.ledgerPlansByAccount), Yevmiye Defteri'nin 689 satırı (genel defter). Toplu raporlarda satır tutarla eşlenir.
 */
async function closeDays(api, accountId, total) {
  const detail = await must("cari kartı", api.get(`${ACC}/${accountId}`));
  const lines = (detail.ledger || []).filter(line => line.kind === "plan-close");
  const report = await must("Cari Ekstre", api.get(`/api/workspace/report-center/cari-ekstre?account=${accountId}&${RANGE}`));
  const ekstre = (report.rows || []).filter(row => row[1] === "Kart kapatıldı").map(row => row[0]);
  const moves = await must("Tüm Cari Hareketleri", api.get(`/api/workspace/report-center/cari-hareketleri?${RANGE}`));
  const all = (moves.rows || []).filter(row => row[2] === "Kart kapatıldı" && Math.abs(money(row[5]) - total) < 0.005).map(row => row[0]);
  const journal = await must("Yevmiye Defteri", api.get(`/api/workspace/report-center/yevmiye?${RANGE}`));
  const general = (journal.rows || []).filter(row => row[1] === "Taksit kartı kapatıldı" && row[3] === "689" && Math.abs(money(row[4]) - total) < 0.005).map(row => row[0]);
  return { card: lines.map(line => dayText(line.date)), ekstre, all, general };
}
function expectDays(days, expected, label, problems = null) {
  const want = { card: [dayText(expected)], ekstre: [dayText(expected)], all: [dayText(expected)], general: [dayText(expected)] };
  if (problems) {
    if (JSON.stringify(days) !== JSON.stringify(want)) problems.push(`${label}: ${JSON.stringify(days)} — dördü de ${dayText(expected)} olmalı`);
    return;
  }
  assert.deepEqual(days, want, `${label}: cari kartı / Cari Ekstre / Tüm Cari Hareketleri / Yevmiye 689 aynı gün (${dayText(expected)}) olmalı`);
}

describe("2.5.0 BİRLEŞİK TUR 5 — kapalı kartın \"Kart kapatıldı\" satırı: cari ekstre = genel defter (kapanış günü)", () => {
  let ctx;
  const cards = {};
  before(async () => {
    process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9"; // ders 30
    ctx = await boot({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
    const open = async (key, total, cardName = null) => {
      const accountName = `BT5 Cari ${key}`;
      const account = await must(`cari ${key}`, ctx.api.post(ACC, { name: accountName, type: "customer", registeredOn: PAST }));
      const plan = await must(`kart ${key}`, ctx.api.post(PLANS, { accountId: account.id, name: cardName || `BT5 Kart ${key}`, total: String(total), mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: PAST }));
      await must(`Kartı Kapat ${key}`, ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
      cards[key] = { account, plan, total };
    };
    await open("Not", 1010);
    await open("Ad", 1020, "BT5 Cari Ad"); // kartın adı carininkiyle aynı: cari adı değişince followAccount kartı da yeniden adlandırır (updated_at ilerler)
    await open("Aynı", 1030);
  });
  after(async () => ctx?.server.close());

  test("kapanış günü: üç yerde de kapanış günü (ön koşul: closed_at = kapanış günü)", async () => {
    for (const [key, item] of Object.entries(cards)) {
      const row = ctx.store.get("SELECT closed_at AS closedAt, updated_at AS updatedAt FROM plans WHERE id = ?", item.plan.id);
      assert.equal(row.closedAt, CLOSE_DAY, `${key}: ön koşul closed_at`);
      expectDays(await closeDays(ctx.api, item.account.id, item.total), CLOSE_DAY, `${key} kapanış günü`);
    }
  });

  test("+40 gün: kartın yalnız NOTU düzeltildi / cari adı değişti / aynı içerikle Kaydet → satır kapanış gününde kalır (ön koşul: kartın updated_at'i ilerledi)", async () => {
    ctx.server.clock.set(LATER);
    const fresh = async key => must(`kart ${key}`, ctx.api.get(`${PLANS}/${cards[key].plan.id}`));
    const note = await fresh("Not");
    await must("yalnız not", ctx.api.put(`${PLANS}/${note.id}`, { ...planForm(note), note: "kapandıktan sonra düzeltildi" }));
    await must("cari adı", ctx.api.put(`${ACC}/${cards.Ad.account.id}`, { name: "BT5 Cari Ad Yeni" }));
    const same = await fresh("Aynı");
    await must("aynı içerik", ctx.api.put(`${PLANS}/${same.id}`, planForm(same)));
    for (const key of ["Not", "Ad"]) {
      const row = ctx.store.get("SELECT closed_at AS closedAt, substr(updated_at, 1, 10) AS updatedOn, name FROM plans WHERE id = ?", cards[key].plan.id);
      assert.equal(row.closedAt, CLOSE_DAY, `${key}: closed_at değişmedi`);
      assert.equal(row.updatedOn, LATER.slice(0, 10), `${key}: ön koşul — kartın updated_at'i düzeltme gününe ilerledi (${row.updatedOn})`);
    }
    assert.equal(ctx.store.get("SELECT name FROM plans WHERE id = ?", cards.Ad.plan.id).name, "BT5 Cari Ad Yeni", "ön koşul: cari adı kartın adına geçti (followAccount)");
    const problems = [];
    for (const [key, item] of Object.entries(cards)) expectDays(await closeDays(ctx.api, item.account.id, item.total), CLOSE_DAY, `${key} +40 gün`, problems);
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  test("closed_at boş eski kart (2.0.13 öncesi benzetimi): son güncelleme günü; ilk düzeltmede dondurulur, üç yer aynı gün kalır; closed_at Kayıt Tarihi'nden önceyse Kayıt Tarihi", async () => {
    ctx.server.clock.set(LATER);
    const make = async (key, total) => {
      const account = await must(`cari ${key}`, ctx.api.post(ACC, { name: `BT5 Cari ${key}`, type: "customer", registeredOn: PAST }));
      const plan = await must(`kart ${key}`, ctx.api.post(PLANS, { accountId: account.id, name: `BT5 Kart ${key}`, total: String(total), mode: "auto", count: 2, firstDue: "2026-12-01", registeredOn: PAST }));
      await must(`Kartı Kapat ${key}`, ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
      return { account, plan, total };
    };
    const problems = [];
    const legacy = await make("Eski", 1040);
    // Eski sürüm verisi (elle; programın verisi değil — ek denetim): closed_at boş, son güncelleme 2026-10-20.
    rawRun(ctx.db, "UPDATE plans SET closed_at = NULL, updated_at = '2026-10-20T08:00:00.000Z' WHERE id = ?", legacy.plan.id);
    expectDays(await closeDays(ctx.api, legacy.account.id, legacy.total), "2026-10-20", "closed_at boş (düzeltmeden önce)", problems);
    ctx.server.clock.set("2026-12-20T12:00:00+03:00");
    const card = await must("kart", ctx.api.get(`${PLANS}/${legacy.plan.id}`));
    await must("eski kartın notu", ctx.api.put(`${PLANS}/${legacy.plan.id}`, { ...planForm(card), note: "eski kart düzeltildi" }));
    const frozen = ctx.store.get("SELECT closed_at AS closedAt, substr(updated_at, 1, 10) AS updatedOn FROM plans WHERE id = ?", legacy.plan.id);
    assert.deepEqual([frozen.closedAt, frozen.updatedOn], ["2026-10-20", "2026-12-20"], "ön koşul: ilk düzeltmede kapanış günü donduruldu (FREEZE_CLOSE), updated_at ilerledi");
    expectDays(await closeDays(ctx.api, legacy.account.id, legacy.total), "2026-10-20", "closed_at boş (düzeltmeden sonra)", problems);
    // Kapanış günü Kayıt Tarihi'nden önce (elle; genel defter kuralı: Kayıt Tarihi'nden önce değil).
    const early = await make("Erken", 1050);
    rawRun(ctx.db, "UPDATE plans SET closed_at = '2026-08-15' WHERE id = ?", early.plan.id);
    expectDays(await closeDays(ctx.api, early.account.id, early.total), PAST, "kapanış Kayıt Tarihi'nden önce", problems);
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});

// v2.4.9 GERÇEK kodu (madde 4 "v2.4.9 gerçek koduyla kapatılmış kart"): kart v2.4.9'da kapatılır, 40 gün sonra v2.4.9'da notu düzeltilir (o sürüm updated_at'i ilerletir, closed_at'i
// korur); güncel kod açınca satır kapanış gününde, genel defterle aynı. Eski kodda (578c12d4) ekstre düzeltme gününde → kırmızı.
const v249 = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok (git fetch --tags)";
describe("2.5.0 BİRLEŞİK TUR 5 — v2.4.9 gerçek koduyla kapatılıp düzeltilmiş kart güncel kodda", () => {
  test("v2.4.9: kapat → +40 gün notu düzelt; güncel kod: cari kartı / Cari Ekstre / Yevmiye 689 kapanış gününde", { skip: v249, timeout: 240_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "bt5-kapali-kart-249-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    try {
      let server = await bootVersion("v2.4.9", { ...dirs, now: { time: NOW, fixed: true } });
      let ids;
      try {
        const api = await server.login();
        const account = await must("cari", api.post(ACC, { name: "BT5 Cari 249", type: "customer", registeredOn: PAST }));
        const plan = await must("kart", api.post(PLANS, { accountId: account.id, name: "BT5 Kart 249", total: "1060", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: PAST }));
        await must("Kartı Kapat (v2.4.9)", api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
        ids = { account: account.id, plan: plan.id };
      } finally {
        await server.close();
      }
      server = await bootVersion("v2.4.9", { ...dirs, now: { time: LATER, fixed: true } });
      try {
        const api = await server.login();
        const card = await must("kart", api.get(`${PLANS}/${ids.plan}`));
        await must("not (v2.4.9)", api.put(`${PLANS}/${ids.plan}`, { ...planForm(card), note: "v2.4.9'da kapandıktan sonra düzeltildi" }));
        const row = server.app.store.get("SELECT closed_at AS closedAt, substr(updated_at, 1, 10) AS updatedOn FROM plans WHERE id = ?", ids.plan);
        assert.deepEqual([row.closedAt, row.updatedOn], [CLOSE_DAY, LATER.slice(0, 10)], "ön koşul: v2.4.9 closed_at'i korudu, updated_at'i ilerletti");
      } finally {
        await server.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-11-18T12:00:00+03:00", fixed: true } });
      try {
        const api = await server.login();
        expectDays(await closeDays(api, ids.account, 1060), CLOSE_DAY, "v2.4.9 verisi güncel kodda");
      } finally {
        await server.close();
      }
    } finally {
      removeTestDir(root);
    }
  });
});
