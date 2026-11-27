// 2.5.0 Ç5-A tur 1b — S127 = A ("bir olay tek kez yazılır"; KULLANICI KARARI 11.11.2026, iş listesi D; C5-ACILIS-TASARIM §12.1). KALICI eski sürüm karşılaştırması (ders 53 (b)):
// fikstürler GERÇEK v2.4.9 koduyla üretildi (test/guvenilirlik/s127-v249-veri.mjs); KÂHİN = v2.4.9'un aynı veride kendi okuduğu sayılar (manifest `oncesi`). Güncel kod aynı veriyi
// okur; her fark AŞAĞIDAKİ "beklenen farklar" tablosunda karar numarasıyla yazılıdır (tutarlar manifestteki kart T / P değerlerinden — programın türetmesinden değil); yazılı
// olmayan fark testi kırar. Sınıflar (§12.1): i / ii (Kayıt kilitli yılda, yükleme açık dönemde; P > 0 ve P = 0), iii (ikisi de kilitli yılda), iv (ikisi de açık dönemde), v (kilit
// güncellemeden sonra), vi (Kilidi Aç → Yeniden Kilitle), vii (silme / Geri Al / açılış satırı düzeltme), viii (kilitsiz), ters (Kayıt açık dönemde, yükleme kilitli yılda).
// Sahte saat (fikstürün günü; ders 13); iki TZ'de koşulur (yükleme günü yerel — fikstürde öğlen, gün sınırı yok).
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readS127Facts, S127_CARDS, S127_FIXTURE, S127_FIXTURE_UNLOCKED, S127_LOCK } from "./guvenilirlik/s127-v249-veri.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-11-10T12:00:00+03:00";
const c = value => Math.round(Number(value || 0) * 100);
const card = name => S127_CARDS.find(item => item.name === name);
const T = name => c(card(name).total);
const P = name => c(card(name).paid);
const apiOf = client => ({ get: url => client.get(url), post: (url, body) => client.post(url, body), put: (url, body) => client.put(url, body) });
const must = async (label, call) => {
  const r = await call;
  assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data?.data ?? r.data;
};
const plusDelta = (base, delta) => {
  const out = { ...base };
  for (const [code, value] of Object.entries(delta)) {
    out[code] = (out[code] || 0) + value;
    if (!out[code]) delete out[code];
  }
  return out;
};
// Beklenen fark tablosuna ekleme (kuruş; sıfıra inen hesap silinir).
const addInto = (target, part) => {
  for (const [code, value] of Object.entries(part)) {
    target[code] = (target[code] || 0) + value;
    if (!target[code]) delete target[code];
  }
  return target;
};
const pinnedNames = server => {
  const entries = server.app.ledger.build();
  const names = new Map(server.app.store.all("SELECT id, name FROM plans").map(row => [row.id, row.name]));
  // Eski yapı: yüklenen kartın maddesi Kayıt Tarihi'nde TAM tutarla ve açılış satırı ayrı madde (yeni kuralda T − P, yükleme gününde, P maddesiz).
  return entries.filter(entry => entry.id.startsWith("plan:") && entry.source === "Taksit kartı açılışı (Excel / tablo)" && entry.cls === undefined).map(entry => names.get(entry.id.slice(5))).sort();
};

describe("S127 = A — eski kuralla donmuş yılın iki yanına düşen Excel kartı bir kez yazılır (v2.4.9 gerçek koduyla üretilmiş kilitli veri)", () => {
  const fixture = readFixture(S127_FIXTURE);
  const before = fixture.oncesi;
  let unpacked;
  let server;
  after(async () => {
    await server?.close?.();
    unpacked?.cleanup?.();
  });

  it("v2.4.9'un kendi sayıları (kâhin): mizan 120 = müşteri carileri, Mutabakat Testi tamam, kilit 31.12.2025", () => {
    assert.equal(before.lock, S127_LOCK);
    assert.equal(before.mutabakat.ok, true, JSON.stringify(before.mutabakat));
    assert.equal(before.mizan["120"], Object.values(before.cari).reduce((sum, value) => sum + value, 0));
  });

  it("göç penceresi (bekleyen 2.4.9 koşusu donmadan): karma mizan 120 = cariler; sonra donma tamamlanınca da (i, ii, iii, iv, ters)", async () => {
    unpacked = unpackFixture(S127_FIXTURE);
    let release;
    const gate = new Promise(resolve => (release = resolve));
    server = await startTestServer({ dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, now: { time: NOW, fixed: true }, __testFreezeHook: { fn: async phase => phase === "before-done" && (await gate) } });
    const state = server.app.ledger.snapshots.state();
    assert.ok(state.pending && state.pending.rule === "2.4.9" && state.pending.through === S127_LOCK, `göç 47'nin bekleyen 2.4.9 koşusu: ${JSON.stringify(state)}`);
    const windowTrial = server.app.ledger.snapshots.trial({ live: server.app.ledger.build() });
    const window120 = c(windowTrial.accounts.find(row => row.code === "120")?.balance);
    release();
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().coverage, S127_LOCK, "donma tamamlandı");
    assert.equal(window120, before.mizan["120"], "göç penceresinde 120 = cariler (çift / eksik yok)");
  });

  it("donmuş veri: cariler v2.4.9 ile aynı; mizan 120 = cariler; kilitli 2025 mizanı ve Yevmiye Defteri BAYT BAYT aynı; bütün zaman mizanında fark YALNIZ karar numaralı beklenen farklar", async () => {
    const admin = await loginAdmin(server);
    const now = await readS127Facts(apiOf(admin));
    assert.deepEqual(now.cari, before.cari, "cari bakiyeleri değişmez");
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0), "mizan 120 = müşteri carileri (S127)");
    assert.deepEqual(now.mizan2025, before.mizan2025, "kilitli yılın mizanı (donmuş) değişmez");
    assert.deepEqual(now.yevmiye2025, before.yevmiye2025, "kilitli yılın Yevmiye Defteri bayt bayt aynı");
    // BEKLENEN FARKLAR (bütün zaman, karma; kuruş; tutarlar manifestten):
    const expected = {
      // KG-5 = A (H-06, B5): iki yerleşimi de açık dönemde olan kart — tek madde B 120 (T − P) / A 519, P maddesiz (v2.4.9: B 120 T / A 602 + B 500 P / A 120).
      602: T("Açık Kart"), 500: -P("Açık Kart"), 519: -(T("Açık Kart") - P("Açık Kart")),
    };
    // S127 = A, ileri yön (i / ii): kart eski yapısıyla — kart maddesi donmuş yılda (602, v2.4.9 aynen), açık dönemdeki açılış satırı güncel açılış hesabı 519 (v2.4.9: 500).
    for (const name of ["Kart Bir", "Kart İki"]) addInto(expected, { 500: -P(name), 519: P(name) });
    // S127 = A, ters yön: kart maddesi açık dönemde (Kayıt Tarihi) TAM tutarla, karşı hesap 519 (v2.4.9: 602); açılış satırı donmuş yılda (500, v2.4.9 aynen).
    for (const name of ["Ters Kart", "Ters Sıfır"]) addInto(expected, { 602: T(name), 519: -T(name) });
    assert.deepEqual(now.mizan, plusDelta(before.mizan, expected), "bütün zaman mizanı = v2.4.9 + beklenen farklar (yazılı olmayan fark yok)");
    assert.deepEqual(now.mizan2026, plusDelta(before.mizan2026, expected), "2026 (açık dönem) = v2.4.9 + beklenen farklar");
    // Mutabakat Testi: yalnız kural farkı uyarısı (C3 §8; kilitli dönem eski kuralla donmuş); Açılış Karşılığı temiz.
    assert.deepEqual(now.mutabakat.failures, ["ledger:rule-diff"]);
    const scan = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(scan.checks.find(check => check.code === "opening:519")?.ok, true, JSON.stringify(scan.checks.find(check => check.code === "opening:519")));
    assert.equal(scan.checks.find(check => check.code === "opening:500")?.ok, true);
  });

  it("Kural Değişikliği Farkı yalnız gerçekten kural farkı olan hesaplarda (500 / 519 / 602); 120'de kartın çift sayımından doğan fark YOK", () => {
    const diff = server.app.ledger.snapshots.ruleDiff();
    const accounts = [...new Set(diff.balances.map(row => row.account))].sort();
    assert.deepEqual(accounts, ["500", "519", "602"], JSON.stringify(diff.balances));
    const of = account => diff.balances.filter(row => row.account === account).reduce((sum, row) => sum + row.differenceMinor, 0);
    // 602: donmuş defterdeki kart satışları (Kilitli Kart, Kart Bir, Kart İki) güncel kuralda açılış (519).
    assert.equal(Math.abs(of("602")), T("Kilitli Kart") + T("Kart Bir") + T("Kart İki"));
  });

  it("sınıflar: eski yapıya bağlı kartlar YALNIZ i / ii / ters (iii ve iv yeni kuralla); kartların yevmiye tarihleri", () => {
    assert.deepEqual(pinnedNames(server), ["Kart Bir", "Kart İki", "Ters Kart", "Ters Sıfır"].sort());
    const entries = server.app.ledger.build();
    const plans = Object.fromEntries(server.app.store.all("SELECT name, id FROM plans").map(row => [row.name, row.id]));
    const of = name => entries.find(entry => entry.id === `plan:${plans[name]}`);
    assert.equal(of("Kart Bir").date, "2025-10-01");
    assert.equal(of("Ters Kart").date, "2026-01-15");
    assert.equal(of("Açık Kart").date, "2026-11-10", "iv: yükleme günü (KG-5)");
    assert.equal(of("Kilitli Kart").date, "2025-11-10", "iii: yükleme günü (KG-5; donmuş dönemde — karma okuma donmuş defterden)");
    for (const entry of entries) assert.equal(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0, `${entry.id} dengesiz`);
  });

  it("vii: kilitli Kayıt Tarihli kart silinemez / Geri Al yapılamaz (409); açık dönemdeki açılış satırı düzeltilir → 120 = cariler", async () => {
    const admin = await loginAdmin(server);
    const plans = Object.fromEntries(server.app.store.all("SELECT name, id, import_id AS importId FROM plans").map(row => [row.name, row]));
    const del = await admin.raw("DELETE", `/api/workspace/plans/${plans["Kart Bir"].id}`);
    assert.equal(del.status, 409, JSON.stringify(del.data).slice(0, 200));
    const undo = await admin.post(`/api/workspace/plans/imports/${plans["Kart Bir"].importId}/undo`, {});
    assert.equal(undo.status, 409, JSON.stringify(undo.data).slice(0, 200));
    const entry = server.app.store.get("SELECT id, date, amount FROM plan_entries WHERE plan_id = ? AND opening = 1 ORDER BY rowid LIMIT 1", plans["Kart Bir"].id);
    await must("açılış satırı düzeltme", admin.put(`/api/workspace/plans/${plans["Kart Bir"].id}/entries/${entry.id}`, { kind: "in", amount: String(Number(entry.amount) - 500), date: entry.date, note: "Excel'de ödenmiş (açılış)", method: "cash" }));
    const now = await readS127Facts(apiOf(admin));
    assert.equal(now.cari["Kart Bir"], T("Kart Bir") - P("Kart Bir") + c(500), "açılış satırı 500 azaldı → cari 500 arttı");
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0), "düzeltmeden sonra 120 = cariler");
    // Açık dönem kartı (iv) silinir → Silinenler'den döner: 120 = cariler.
    await must("Açık Kart sil", admin.raw("DELETE", `/api/workspace/plans/${plans["Açık Kart"].id}`));
    const gone = await readS127Facts(apiOf(admin));
    assert.equal(gone.mizan["120"], Object.values(gone.cari).reduce((sum, value) => sum + value, 0), "silmeden sonra 120 = cariler");
    const trash = await must("Silinenler", admin.get("/api/admin/trash"));
    const item = (trash.items || trash).find(row => row.id === `plan:${plans["Açık Kart"].id}`);
    assert.ok(item, "kart Silinenler'de");
    await must("geri al", admin.post("/api/admin/trash/restore", { id: item.id }));
    const back = await readS127Facts(apiOf(admin));
    assert.equal(back.cari["Açık Kart"], T("Açık Kart") - P("Açık Kart"));
    assert.equal(back.mizan["120"], Object.values(back.cari).reduce((sum, value) => sum + value, 0), "Silinenler'den dönüşten sonra 120 = cariler");
  });

  it("vi: Kilidi Aç → Yeniden Kilitle — yıl GÜNCEL kuralla yeniden donar, kart yeni kuralla (yükleme günü), çift / eksik yok; kural farkı kalmaz", async () => {
    const admin = await loginAdmin(server);
    await must("kilidi aç", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await server.app.ledger.snapshots.runPending();
    await must("yeniden kilitle", admin.put("/api/admin/period-lock", { lockedUntil: S127_LOCK }));
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().coverage, S127_LOCK);
    assert.deepEqual(pinnedNames(server), [], "eski kurallı donmuş dönem kalmadı → bağlı kart yok");
    const now = await readS127Facts(apiOf(admin));
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0), "yeniden kilitten sonra 120 = cariler");
    assert.deepEqual(now.mutabakat.failures, [], "yeni kuralla donan dönemde kural farkı yok");
  });
});

describe("S127 — kilitsiz v2.4.9 verisi: viii (kilitsiz, hiçbir şey eski yapıya bağlanmaz) ve v (kilit güncellemeden SONRA konur)", () => {
  const fixture = readFixture(S127_FIXTURE_UNLOCKED);
  const before = fixture.oncesi;
  let unpacked;
  let server;
  after(async () => {
    await server?.close?.();
    unpacked?.cleanup?.();
  });

  it("viii: kilitsiz veride bağlı kart YOK; bütün kartlar KG-5 (yükleme günü, T − P); 120 = cariler; fark yalnız KG-5", async () => {
    unpacked = unpackFixture(S127_FIXTURE_UNLOCKED);
    server = await startTestServer({ dataDir: unpacked.dataDir, backupDir: unpacked.backupDir, now: { time: NOW, fixed: true } });
    assert.equal(before.lock, "");
    assert.deepEqual(pinnedNames(server), []);
    const admin = await loginAdmin(server);
    const now = await readS127Facts(apiOf(admin));
    assert.deepEqual(now.cari, before.cari);
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0));
    // KG-5 = A (H-06): her kart tek madde B 120 (T − P) / A 519 (v2.4.9: B 120 T / A 602 + B 500 P / A 120). Öbür Ç5-A farkları (Kasa / cari açılışı 500 → 519 — KG-1, M-01, M-02).
    const delta = {};
    for (const item of S127_CARDS) addInto(delta, { 602: c(item.total), 500: -c(item.paid), 519: -(c(item.total) - c(item.paid)) });
    const opening500 = before.mizan["500"] + (delta["500"] || 0);
    addInto(delta, { 500: -opening500, 519: opening500 });
    assert.deepEqual(now.mizan, plusDelta(before.mizan, delta), "kilitsiz: fark yalnız KG-5 + açılış karşı hesabı 519");
  });

  it("v: kilit güncellemeden SONRA konur → yıl yeni kuralla donar; bağlı kart yok; 120 = cariler; kural farkı yok", async () => {
    const admin = await loginAdmin(server);
    await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: S127_LOCK }));
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().coverage, S127_LOCK);
    assert.deepEqual(pinnedNames(server), []);
    const now = await readS127Facts(apiOf(admin));
    assert.equal(now.mizan["120"], Object.values(now.cari).reduce((sum, value) => sum + value, 0));
    assert.deepEqual(now.mutabakat.failures, []);
  });
});
