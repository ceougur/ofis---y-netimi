// 2.5.1 M2 — Değersiz Alacak sınırı (para çekirdeği; tasarım docs/devir/2.5.1-DEVAM/m2-rapor.md §0b).
// KARARLAR (karar girdisi docs/devir/2.5.1-DEVAM/m2-kararlar.md §1 AYNEN):
//   S264 = A "Değersiz sınırı aynı günün sırasına uysun — Değersiz o günün bağlı payından önce, tam tutar kabul (kâhin + v2.4.9)."
//   S269 = A "S264 sınırı 'kayıt kapalı' denetiminden ÖNCE de uygulanır (Değersiz Yaz ve Silinenler'den geri yükleme); bu kayıtlarda düğme görünür; ipucu ve önerilen tutar sınırı gösterir (S268 A)."
//   S268 = A "Değersiz Alacak Yaz formu üst sınır ipucu / önerilen tutar S264 sınırını göstersin."
//   S270 = A değişmez: "hiçbir sırada bir şüpheli kaydın Değersiz toplamı, o kayda şüpheliye alınan tutardan kayda düşmüş tahsilatlar çıkınca kalanı aşamaz; Değersiz yazımı cariyi alacaklıya
//     (eksi bakiyeye) düşürmez."
//   S-M2-1 = B "Değersiz o günün tarihiyle yazılırsa o günün bağlı payından önce değerlendirilir (S264); sonraki bir tarihle yazılırsa önceki günlerin bağlı payı düşülmüş kalan kadar yazılabilir."
//   SK-55 = C (aynı gün bağlı → bağsız → Şüpheliye Al sırasında payın ölçüm anı BİLİNEN SINIR — bugünkü davranış DEĞİŞMEZ).
//   BAŞ MİMAR (kâhin Y30-6): ekranın önerdiği tutar her zaman kabul edilir → öneri = sınır ile S155'in izin verdiğinin küçüğü.
// BEKLENEN SAYILAR (ders 5): sınıf A1–A28 kâhinin elle tablosundan (test/bagimsiz/cari/senaryolar/d62-c5-m2-degersiz-siniri.json elleBeklenen — kodu görmeyen el, kâhin koşulmadan
// yazıldı); m.9 / m.10 / m.11 karar girdisi §3'ten (m.10 sayıları girdide: 3.300 / 423,55 × 3 / −200 / 2.300) ve kurallardan elle (aşağıda her satırda). Programdan türetilmedi.
// A19 (SK-55 = C): kâhin SUS; beklenen = DEĞİŞİKLİK ÖNCESİ programın (t251-m2-taban) ölçülen sonucu (bugünkü davranış korunur).
// Sahte saat 15.10.2026 (kâhinin 'bugün'ü; ders 13), akan saat (yazım sırası created_at → rowid; ders 31).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import { M2_NOW, M2_TODAY, m2Base, m2Classes, m2Deg, runM2Classes } from "./fixtures/m2-degersiz-senaryo.mjs";
import { doubtfulProblems } from "../server/lib/bank/doubtful.mjs";

const OK = 200;
const EXCEEDS = [400, "doubtful-writeoff-exceeds"];
const CLOSED = [409, "doubtful-closed"];
const RET = "ret";
// Kâhin d62 elle beklenenleri (adım → ok | [durum, kod] | "ret" (kodsuz ret)) ve k1 bakiyeleri (TL).
const STEPS = {
  a1d1: EXCEEDS, a1d2: OK, a1d3: CLOSED,
  a2d1: OK, a2d2: OK,
  a3d1: OK, a3d2: OK, a3d3: OK, a3d4: CLOSED,
  a4d1: OK,
  a5d1: EXCEEDS, a5d2: OK, a5d3: CLOSED,
  a6d1: EXCEEDS, a6d2: OK, a6d3: CLOSED,
  a7d1: OK, a7d2: EXCEEDS, a7d3: OK, a7d4: CLOSED,
  a8d1: OK, a8d2: EXCEEDS, a8d3: OK,
  a9d1: EXCEEDS, a9d2: EXCEEDS, a9d3: OK,
  a10d1: CLOSED, a10d2: CLOSED,
  ...Object.fromEntries(["a11", "a12", "a13", "a14", "a15", "a16", "a17", "a18"].flatMap(p => [[`${p}d1`, OK], [`${p}d2`, CLOSED]])),
  a20d1: OK,
  a21d1: EXCEEDS, a21d2: OK, a21d3: CLOSED,
  a25d1: EXCEEDS, a25d2: OK,
  a26d1: RET, a26d2: RET, a26d3: OK,
  a27d1: EXCEEDS, a27d2: OK,
  a28d1: EXCEEDS, a28d2: OK,
  // Kilitli güne yazım (m.12): dönem kilidi (period-locked) — sınırdan önce.
  a25d0: [409, "period-locked"],
  // m.9: aynı gün ikinci kayıt Şüpheliden Çıkar'ılmış; ilk kayda @17.09 1.500 — o günün bağlı payı Değersiz'den sonra (S264) → F = 1.500.
  m9x: OK, m9d1: OK,
  // m.10: Değersiz 3.000 @17.09 kabul (S264), sonra bağlı tahsilatın silinmesi / bağının kaldırılması / tarihi / tutarı — hepsi kabul (girdi m.10; değişmez meşru düzeltmeyi reddetmez).
  ...Object.fromEntries(["m10a", "m10b", "m10c", "m10d", "m10e", "m10f"].flatMap(p => [[`${p}d1`, OK], [`${p}x`, OK]])),
  // m.11: (a) sil → geri yükle kabul; (b) sil → 01.10 bağsız 1.000 → geri yükleme 3.000 REDDEDİLİR (sınır 3.000 − 1.000 = 2.000; S270 "sonradan gelen bağsız") → 2.000,01 ret, 2.000 kabul;
  // (c) Değersiz 3.000'den SONRA yazılan 01.10 bağsız 1.000 (avans) kabul — Değersiz yazımı bakiyeyi eksiye düşürmedi, değişmez meşru avansı reddetmez.
  m11ad1: OK, m11ax: OK, m11ay: OK,
  m11bd1: OK, m11bx: OK, m11by: [409, "doubtful-writeoff-exceeds"], m11bd2: EXCEEDS, m11bd3: OK,
  m11cd1: OK, m11cn: OK,
  // SK-55 = C: bugünkü davranış (t251-m2-taban ölçümü: 400 doubtful-writeoff-exceeds, sınır 73,55).
  a19d1: EXCEEDS,
};
const BALANCES = {
  A1: 423.55, A2: 423.55, A3: 423.55, A4: 400, A5: 0, A6: 3300, A7: 3300, A8: 3300, A9: 423.55, A10: 2423.55,
  A11: 423.55, A12: 423.55, A13: 423.55, A14: 423.55, A15: 423.55, A16: 423.55, A17: 423.55, A18: 423.55,
  A20: 1923.55, A21: 3300, A25: 3300, A26: 500, A27: 423.55, A28: 3300,
  M9: 1923.55, M10A: 3300, M10B: 423.55, M10C: 423.55, M10D: 423.55, M10E: -200, M10F: 2300, M11A: 423.55, M11B: 423.55, M11C: -576.45,
  A19: 3373.55,
};

const bootM2 = async () => {
  const server = await startTestServer({ now: M2_NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = await loginAdmin(server);
  return { server, client, api: apiOf(client), store: server.app.store, db: server.app.db };
};

describe("M2 — sınıflar (kâhin d62 elle beklenenleri; girdi §3 m.1–m.12)", () => {
  let ctx;
  let res;
  before(async () => {
    ctx = await bootM2();
    res = await runM2Classes(ctx.client);
  });
  after(() => ctx.server.close());

  it("her adımın sonucu (durum + kod) beklenen", () => {
    const wrong = [];
    for (const [id, want] of Object.entries(STEPS)) {
      const got = res.steps[id];
      if (!got) wrong.push(`${id}: adım koşulmadı`);
      else if (want === OK ? got.status !== 200 : want === RET ? got.status === 200 : got.status !== want[0] || got.code !== want[1]) wrong.push(`${id}: beklenen ${JSON.stringify(want)}, program ${got.status} ${got.code} ${got.message}`);
    }
    assert.deepEqual(wrong, []);
  });
  it("carilerin bakiyesi (k1)", () => {
    const wrong = Object.entries(BALANCES).filter(([name, tl]) => Math.round(res.balances[name] * 100) !== Math.round(tl * 100)).map(([name, tl]) => `${name}: beklenen ${tl}, program ${res.balances[name]}`);
    assert.deepEqual(wrong, []);
  });
  it("Mutabakat Testi tamam (değişmez; m.10 düzeltmeleri ve m.11 avansı reddedilmedi, ihlal yok)", async () => {
    const integrity = await integrityOf(ctx.api);
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 900));
    assert.deepEqual(doubtfulProblems(ctx.store).map(item => item.key), []);
  });
  it("ret iletileri gerçek sınırı ve nedeni söyler (dk-ud3 DÜŞÜK-1, dk-ud4 'breaks')", () => {
    assert.match(res.steps.a7d2.message, /en çok tutarı \(23,55 TL\) aşıyor/);
    assert.match(res.steps.a7d2.message, /sonraki bir Değersiz Alacak satırını/);
    assert.match(res.steps.a9d1.message, /\(2\.000,00 TL\) aşıyor/);
    assert.match(res.steps.a1d1.message, /\(3\.000,00 TL\) aşıyor.*faturaya bağlı tahsilatı Değersiz.den sonra sayılır/);
    assert.match(res.steps.a5d1.message, /\(400,00 TL\) aşıyor; sınır: carinin borç bakiyesi/);
    assert.match(res.steps.a10d1.message, /01\.10\.2026 tarihiyle değersiz alacak yazılamaz; yazılabilecek tutar kalmadı.* 17\.09\.2026 tarihiyle en çok 2\.000,00 TL yazılabilir\./);
    assert.match(res.steps.a6d1.message, /18\.09\.2026 tarihiyle yazılabilecek en çok tutarı \(123,55 TL\)/);
    assert.match(res.steps.m11by.message, /geri yüklenemez.*\(2\.000,00 TL\) aşıyor/);
    for (const id of ["a7d2", "a9d1", "a1d1"]) assert.doesNotMatch(res.steps[id].message, /kalan şüpheli tutarı \(/, `${id}: eski yanıltıcı ileti`);
  });
  it("kayıtların durumu: kısmi zincir (A2 / A3) ve bağlı = şüpheli (A4) Değersiz Yazıldı, kalan 0", () => {
    for (const name of ["A2-S", "A3-S", "A4-S", "A1-S"]) assert.deepEqual(res.records[name], { writtenOffMinor: 300000, remainingMinor: 0, stateKey: "writtenOff" }, name);
    assert.equal(res.records["A9-S"].writtenOffMinor, 200000);
  });
});

describe("M2 — liste 'writeOff' alanı, formun sınır ucu ve bildirim (S268 / S269 / Y30-6; girdi §2 m.5)", () => {
  let ctx;
  let ids;
  const q = (cari, kayit, date = "") => must("sınır", ctx.api.get(`/api/workspace/accounts/${ids.cari[cari]}/doubtful/${ids.record[kayit]}/write-off${date ? `?date=${date}` : ""}`));
  const rec = async (cari, kayit) => (await must("liste", ctx.api.get(`/api/workspace/accounts/${ids.cari[cari]}/doubtful`))).records.find(item => item.id === ids.record[kayit]);
  before(async () => {
    ctx = await bootM2();
    const classes = [
      { ad: "Q2", adimlar: [...m2Base("Q2"), m2Deg("q2d1", "Q2-S", "1000", "2026-09-17")] },
      { ad: "Q6", adimlar: m2Base("Q6") },
      { ad: "Q9", adimlar: [...m2Base("Q9"), { op: "tahsilat", cari: "Q9", ad: "Q9-N", tutar: "1000", tarih: "2026-10-01" }] },
      { ad: "Q26", adimlar: [...m2Base("Q26"), { op: "al", cari: "Q26", ad: "Q26-S2", tutar: 500, tarih: "2026-09-25" }] },
    ];
    ids = (await runM2Classes(ctx.client, classes)).ids;
  });
  after(() => ctx.server.close());

  it("S269: kısmi Değersiz'den sonra kayıt 'Değersiz Yazıldı' (kalan 0) görünür ama yazılabilir — liste alanı 17.09 tarihiyle 2.000, bugün 0", async () => {
    const r = await rec("Q2", "Q2-S");
    assert.equal(r.stateKey, "writtenOff");
    assert.equal(r.remainingMinor, 0);
    assert.equal(r.writeOff.anyMinor, 200000, "düğme görünür");
    assert.deepEqual([r.writeOff.today.date, r.writeOff.today.limitMinor], [M2_TODAY, 0]);
    assert.deepEqual([r.writeOff.best.date, r.writeOff.best.limitMinor, r.writeOff.best.offerMinor], ["2026-09-17", 200000, 200000]);
  });
  it("formun ucu: seçilen tarihin sınırı + en çok yazdıran gün; kayıttan önce / ileri tarih yazılamaz", async () => {
    const at17 = await q("Q2", "Q2-S", "2026-09-17");
    assert.deepEqual([at17.limitMinor, at17.offerMinor, at17.why], [200000, 200000, "sameDay"]);
    const now = await q("Q2", "Q2-S");
    assert.deepEqual([now.date, now.limitMinor, now.best.date, now.best.offerMinor], [M2_TODAY, 0, "2026-09-17", 200000]);
    assert.equal((await q("Q2", "Q2-S", "2026-09-16")).blocked, "before");
    assert.equal((await q("Q2", "Q2-S", "2026-10-16")).blocked, "future");
  });
  it("S-M2-1 = B: @17.09 3.000 (o günün bağlı payından önce), @18.09 123,55 (önceki günün payı düşülmüş); sonradan gelen bağsız (S270) @17.09 2.000", async () => {
    assert.equal((await q("Q6", "Q6-S", "2026-09-17")).limitMinor, 300000);
    assert.equal((await q("Q6", "Q6-S", "2026-09-18")).limitMinor, 12355);
    const r9 = await q("Q9", "Q9-S", "2026-09-17");
    assert.deepEqual([r9.limitMinor, r9.offerMinor], [200000, 200000]);
    assert.equal((await q("Q9", "Q9-S", "2026-10-01")).limitMinor, 0);
  });
  it("Y30-6: S155 — sınır 3.000, önerilen 2.923,55 (öbür açık kayıt 500); önerilen tutar kabul, sınır reddedilir", async () => {
    const r = await q("Q26", "Q26-S", "2026-09-17");
    assert.deepEqual([r.limitMinor, r.offerMinor, r.s155], [300000, 292355, true]);
    const party = ids.cari.Q26;
    const did = ids.record["Q26-S"];
    const refused = await ctx.api.post(`/api/workspace/accounts/${party}/doubtful/${did}/write-off`, { amount: "3000", date: "2026-09-17" });
    assert.notEqual(refused.status, 200, "sınır S155'i aşar");
    const done = await must("öneri", ctx.api.post(`/api/workspace/accounts/${party}/doubtful/${did}/write-off`, { amount: "2923,55", date: "2026-09-17" }));
    assert.equal(done.writtenMinor, 292355);
  });
  it("bildirim verisi: bu yazımın tutarı, yazımdan sonraki gerçek kalan ve aynı tarihle daha yazılabilecek tutar", async () => {
    const done = await must("Değersiz 500", ctx.api.post(`/api/workspace/accounts/${ids.cari.Q6}/doubtful/${ids.record["Q6-S"]}/write-off`, { amount: "500", date: "2026-09-17" }));
    assert.equal(done.writtenMinor, 50000, "bu yazım (toplam değil)");
    assert.equal(done.record.remainingMinor, 0, "gerçek kalan: o günün bağlı payı kalanı kapatır");
    assert.deepEqual([done.writeOffAfter.date, done.writeOffAfter.offerMinor], ["2026-09-17", 250000], "aynı tarihle 2.500 daha");
  });
  it("m.12 Dönem Kilidi 17.09: liste en çok yazdıran gün 18.09 (123,55), formun ucu 17.09'u kilitli söyler", async () => {
    await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-17" }));
    const r = await rec("Q9", "Q9-S");
    assert.deepEqual([r.writeOff.best.date, r.writeOff.best.limitMinor], ["2026-09-18", 0], "Q9: bağsız 1.000 sonrası 18.09'da sınır 0");
    const r6 = await rec("Q2", "Q2-S");
    assert.equal(r6.writeOff.anyMinor, 0, "Q2: 17.09 kilitli → yazılabilir gün yok, düğme gizli");
    assert.equal((await q("Q2", "Q2-S", "2026-09-17")).blocked, "locked");
  });
});

describe("M2 — S270 değişmezi: geri alınan uygulamanın bozuk durumu (Değersiz 3.000, bakiye −576,45) Mutabakat Testi'nde ve kapıda YAKALANIR", () => {
  let ctx;
  let ids;
  before(async () => {
    ctx = await bootM2();
    // Meşru sıra: Değersiz 2.000 @17.09 (S264), SONRA 01.10 bağsız 1.000 — bakiye 423,55.
    ids = (await runM2Classes(ctx.client, [{ ad: "Z", adimlar: [...m2Base("Z"), m2Deg("zd1", "Z-S", "2000", "2026-09-17"), { op: "tahsilat", cari: "Z", ad: "Z-N", tutar: "1000", tarih: "2026-10-01" }] }])).ids;
  });
  after(() => ctx.server.close());

  it("meşru sıra temiz; bağsız tahsilat Değersiz'den ÖNCE yazılmış ve Değersiz 3.000 yapılınca (geri alınan uygulamanın durumu, bakiye −576,45) iki koşul da kırmızı, kapı sonraki yazımı reddeder", async () => {
    const party = ids.cari.Z;
    assert.equal((await integrityOf(ctx.api)).ok, true);
    assert.deepEqual(doubtfulProblems(ctx.store, { parties: [party] }), []);
    const entry = ctx.db.prepare("SELECT id, created_at AS at FROM account_entries WHERE account_id = ? AND source = 'doubtful'").get(party);
    const free = ctx.db.prepare("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND date = '2026-10-01'").get(party);
    assert.ok(entry && free, "kurulum: Değersiz 2.000 ve bağsız 1.000 yazıldı");
    // Geri alınan uygulamanın sırası: bağsız tahsilat Değersiz'den ÖNCE yazılmış (yazım anı bir dakika önce), Değersiz 3.000 (başlığıyla birlikte).
    ctx.db.prepare("UPDATE account_entries SET created_at = ? WHERE id = ?").run(new Date(Date.parse(entry.at) - 60_000).toISOString(), free.id);
    ctx.db.prepare("UPDATE account_entries SET amount = 3000 WHERE id = ?").run(entry.id);
    ctx.db.prepare("UPDATE fin_events SET amount_minor = 300000, try_minor = 300000 WHERE type = 'doubtful_writeoff' AND src_id = ?").run(entry.id);
    const balance = (await must("kart", ctx.api.get(`/api/workspace/accounts/${party}`))).totals.balance;
    assert.equal(balance, -576.45, "geri alınan uygulamanın ürettiği durum");
    const keys = doubtfulProblems(ctx.store, { parties: [party] }).map(item => item.key);
    assert.deepEqual(keys.sort(), [`${entry.id}:writeoff-limit`, `${party}:writeoff-balance`].sort());
    const integrity = await integrityOf(ctx.api);
    assert.equal(integrity.ok, false);
    const failure = integrity.failures.find(item => item.code === "doubtful:records");
    assert.ok(failure, JSON.stringify(integrity.failures).slice(0, 600));
    assert.match(failure.sample.join(" | "), /yazıldığı andaki sınırı \(2\.000,00 TL\) aşıyor/);
    assert.match(failure.sample.join(" | "), /eksi bakiyeye \(-576,45 TL\)/);
    const next = await ctx.api.post(`/api/workspace/accounts/${party}/entries`, { kind: "debt", amount: "1", date: M2_TODAY, note: "Sonraki yazım" });
    assert.equal(next.status, 409, "kapı (süren / büyüyen sapma) yazımı reddeder");
    assert.equal(next.code, "ledger-integrity");
  });
});

describe("M2 — iki şirket ve yedekten geri yükleme (ders 17)", () => {
  let ctx;
  after(() => ctx.server.close());
  it("002'de aynı sınıflar aynı sonucu verir (sınır işlevi şirketler arasında bellek paylaşmaz); 001'in yedeği geri yüklenince sınır ve öneri aynı", async () => {
    ctx = await bootM2();
    const pick = names => m2Classes().filter(item => names.includes(item.ad));
    const names = ["A1", "A7", "A9", "A10", "M11B", "A26"];
    const first = await runM2Classes(ctx.client, pick(names));
    const second = await must("002", ctx.api.post("/api/companies", { name: "M2 İkinci Şirket", select: false }));
    const company = second.id || second.company?.id;
    const suffix = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(company)}`;
    const other = { get: url => ctx.client.get(suffix(url)), post: (url, body) => ctx.client.post(suffix(url), body), put: (url, body) => ctx.client.put(suffix(url), body), del: url => ctx.client.del(suffix(url)) };
    const two = await runM2Classes(other, pick(names));
    const strip = out => ({ steps: Object.fromEntries(Object.entries(out.steps).map(([k, v]) => [k, [v.status, v.code]])), balances: out.balances, records: out.records });
    assert.deepEqual(strip(two), strip(first));
    // Yedek → geri yükle (001): liste alanı birebir.
    const listOf = async () => {
      const out = {};
      for (const [name, party] of Object.entries(first.ids.cari)) out[name] = (await must("liste", ctx.api.get(`/api/workspace/accounts/${party}/doubtful`))).records.map(item => [item.id, item.remainingMinor, item.writeOff]);
      return out;
    };
    const before = await listOf();
    const backup = (await must("yedek", ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
    await must("geri yükle", ctx.api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    assert.deepEqual(await listOf(), before);
    assert.equal((await integrityOf(ctx.api)).ok, true);
  });
});

// ---------- Rastgele sıra (tohumlu): her adımda değişmez + 'ekranın önerdiği tutar ve tarih kabul edilir' ----------
const mulberry = seed => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DAYS = ["2026-09-13", "2026-09-17", "2026-09-18", "2026-09-20", "2026-09-25", "2026-10-01", M2_TODAY];
const tlText = minor => (minor / 100).toFixed(2).replace(".", ",");
for (const seed of [1, 2, 3]) {
  describe(`M2 — rastgele sıra, tohum ${seed} (girdi §3 m.13)`, () => {
    let ctx;
    before(async () => {
      ctx = await bootM2();
    });
    after(() => ctx.server.close());
    it("her Değersiz adımında: önerilen tutar KABUL, sınır + 0,01 RET, bakiye ≥ 0; her adımda değişmez boş; sonda Mutabakat Testi tamam", async () => {
      const rand = mulberry(seed * 7919);
      const pick = list => list[Math.floor(rand() * list.length)];
      const api = ctx.api;
      const counts = { written: 0, refusedOver: 0, restored: 0 };
      await api.post("/api/workspace/bank/setup/dismiss", {});
      for (let c = 0; c < 10; c += 1) {
        const acc = await must("cari", api.post("/api/workspace/accounts", { name: `M2 Rastgele ${seed}-${c}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 251 9${seed} ${String(c).padStart(2, "0")}` }));
        const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
        await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
        const records = [];
        const deleted = [];
        for (let step = 0; step < 14; step += 1) {
          // Kayıt yoksa üçüncü adımdan sonra mutlaka Şüpheliye Al (yazım sırası: önce / sonra bağlı ve bağsız tahsilat — m.13 sınıfı).
          const kind = !records.length && step >= 2 ? "take" : pick(["bound", "bound", "free", "take", "write", "write", "write", "write", "delete", "restore"]);
          const date = pick(DAYS);
          if (kind === "bound" || kind === "free") {
            await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: tlText(Math.round(1000 + rand() * 250000)), date, method: "cash", cashForce: true, similarOk: true, note: kind, ...(kind === "bound" ? { invoiceId: inv.id } : {}) });
          } else if (kind === "take") {
            const r = await api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: pick(["3000", "1500", "500"]), date: date < "2026-09-13" ? "2026-09-13" : date, reason: "lawsuit" });
            if (r.status === 200) records.push(r.data.record.id);
          } else if (kind === "write" && records.length) {
            const did = pick(records);
            const quote = await must("sınır", api.get(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off?date=${date}`));
            if (quote.blocked) continue;
            const over = await api.post(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off`, { amount: tlText(quote.limitMinor + 1), date });
            assert.notEqual(over.status, 200, `tohum ${seed} cari ${c} adım ${step}: sınır + 0,01 (${tlText(quote.limitMinor + 1)}) @${date} kabul edildi`);
            assert.ok(["doubtful-writeoff-exceeds", "doubtful-closed"].includes(over.code), `ret kodu ${over.code}`);
            counts.refusedOver += 1;
            if (quote.offerMinor > 0) {
              const done = await api.post(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off`, { amount: tlText(quote.offerMinor), date });
              assert.equal(done.status, 200, `tohum ${seed} cari ${c} adım ${step}: önerilen ${tlText(quote.offerMinor)} @${date} reddedildi: ${done.code} ${done.error}`);
              counts.written += 1;
              const balance = (await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance;
              assert.ok(balance >= 0, `Değersiz yazımı bakiyeyi eksiye düşürdü (${balance})`);
            }
          } else if (kind === "delete" && records.length) {
            const did = pick(records);
            const r = (await must("liste", api.get(`/api/workspace/accounts/${acc.id}/doubtful`))).records.find(item => item.id === did);
            const line = r?.writeOffs?.at(-1);
            if (line && (await api.del(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-offs/${line.entryId}`)).status === 200) deleted.push(line.entryId);
          } else if (kind === "restore" && deleted.length) {
            const entryId = deleted.shift();
            const trash = await must("Silinenler", api.get("/api/admin/trash"));
            const item = trash.find(row => row.kind === "doubtful-writeoff" && row.ref === entryId);
            const r = await api.post("/api/admin/trash/restore", { id: item.id });
            if (r.status === 200) {
              counts.restored += 1;
              const balance = (await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance;
              assert.ok(balance >= 0, `geri yükleme bakiyeyi eksiye düşürdü (${balance})`);
            } else assert.ok(["doubtful-writeoff-exceeds", "doubtful-closed", "period-locked", "doubtful-missing"].includes(r.code), `geri yükleme ret kodu ${r.code}: ${r.error}`);
          }
          assert.deepEqual(doubtfulProblems(ctx.store, { parties: [acc.id] }).map(item => item.sample), [], `tohum ${seed} cari ${c} adım ${step} (${kind}): değişmez`);
        }
      }
      const integrity = await integrityOf(api);
      assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 900));
      console.log(`# M2 rastgele tohum ${seed}: ${JSON.stringify(counts)}`);
      assert.ok(counts.written >= 5 && counts.refusedOver >= 10, JSON.stringify(counts));
    });
  });
}
