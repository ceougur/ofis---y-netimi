// 2.5.0 birleşik tur 6 — "Kasa Açılışından Önce Tarihli Hareket" uyarısının KAPININ GÖRMEDİĞİ artışı (dar kontrol DK-D2T3 ORTA-1).
// Karar (BAŞ MİMAR 11.11 02:21 "DK-D2T3" (1); KULLANICI 11.11 03:15 (a) — itiraz yok, kesinleşti): tarama uyarının önceki sayısını tutar; kapının bu arada kabul
// ettiği Silinenler geri yüklemeleri sayılır; bunların AÇIKLAYAMADIĞI ARTIŞ günlüğe ve zile "uyarı arttı (kapının görmediği yazım)" diye yazılır; azalma ve ilk
// görünüş sessiz kalır; sunum (sarı uyarı, 'Tutarlı', ilk yazımın süzgeçli yolu) AYNEN.
// Önceden (Ç5-K tur 2, taban dbf635be): açılıştan sonraki bir Kasa girişinin tarihi DIŞARIDAN (başka bağlantı: elle düzenleme / dış araç) açılış öncesine alınınca
// uyarı 2 → 3, Kasa'da o tutar iki kez sayılıyor, ama tarama günlüğü / zil / sunucu günlüğü YOK (Ç5-K tur 1'de vardı) — settleScan uyarıyı hiç karşılaştırmıyordu.
// NASIL BOZULUR (testler buradan): (1) dış artış hiç bildirilmez; (2) aynı artış ikinci taramada / yeniden açılışta yine bildirilir; (3) Silinenler geri yüklemesi
// (satırın kendisi ya da görünürlüğü dönen üst kayıt — taksit kartı) yanlış alarm verir; (4) geri yükleme her artışı örter (aynı aralıkta dış artış kaçar);
// (5) azalmadan sonra işaret eski sayıda kalır (sonraki artış kaçar); (6) iş parçacığı taraması sürerken kesinleşen geri yükleme yanlış alarm verir; (7) iki şirket
// birbirinin işaretini bozar; (8) yedekten geri yükleme / gün dönümü yanlış alarm verir; (9) sunum değişir (sapma / 'Fark Var' / ilk yazım tam kapı).
// Veri programın API'sinden (Silinenler'den geri alınan açılış öncesi satırlar — Z9 yolu; taksit kartı); dış yazım ayrı bağlantıyla (DatabaseSync). Sahte saat
// (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Ayrıca dar kontrolün betiği (v2.4.9'un GERÇEK koduyla üretilmiş veri) — etiket varsa.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const AFTER = "2026-03-11";
const MOVED = "2026-03-08";
const EARLY = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07"];
const CODE = "cash:before-opening";
const grew = (previous, count) => `Kasa açılışından önce tarihli hareket uyarısı arttı (${previous} → ${count} hareket; kapının görmediği yazım)`;

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const idOf = data => data?.id || data?.entry?.id || data?.plan?.id || "";
const capture = () => {
  const lines = [];
  return { lines, log: { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) } };
};
const noticeOf = result => (result?.checks || []).find(item => item.code === CODE) || null;
const driftsOf = result => (result?.failures || []).filter(item => !item.notice).map(item => item.code);
const scansOf = store => store.all("SELECT summary FROM integrity_log WHERE action = 'scan' ORDER BY at, rowid").map(row => row.summary);

/** Kapının görmediği yazım: başka bağlantıdan Kasa hareketinin tarihi (satır + işlem başlığı tutarlı) değiştirilir. */
function moveOutside(store, id, date) {
  const other = new DatabaseSync(store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    const event = other.prepare("SELECT event_id AS e FROM cash_entries WHERE id = ?").get(id)?.e;
    assert.ok(event, `ön koşul: ${id} işlem başlıklı`);
    other.prepare("UPDATE cash_entries SET date = ? WHERE id = ?").run(date, id);
    other.prepare("UPDATE fin_events SET date = ? WHERE id = ?").run(date, event);
  } finally {
    other.close();
  }
}

/** Silinenler'den geri yükleme (Z9 yolu). */
async function restoreFromTrash(api, ref, q = "") {
  const listed = await must("Silinenler", api.get(`/api/admin/trash${q}`));
  // Para satırının öğesi ref taşır; üst kaydınki (taksit kartı) "plan:<kimlik>".
  const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === ref || row.id === `plan:${ref}`);
  assert.ok(item, `Silinenler'de ${ref}`);
  await must(`geri yükle ${ref}`, api.post(`/api/admin/trash/restore${q}`, { id: item.id }));
}

/** Şirketin gözlemcisi: günlük, zil (yalnız bu şirketin), sunucu günlüğü — her adımda yalnız YENİLERİ döner. */
function observer(target, events, log) {
  const alerts = [];
  events.tap((name, payload) => {
    if (name === "integrity.alert") alerts.push(payload.findings.map(f => ({ code: f.code, name: f.name, count: f.count, notice: f.notice === true, previous: f.previous })));
  });
  let marks = { scans: scansOf(target().store).length, alerts: 0, lines: log.lines.length };
  return {
    alerts,
    fresh() {
      const scans = scansOf(target().store);
      const out = { gunluk: scans.slice(marks.scans), zil: alerts.slice(marks.alerts), sunucu: log.lines.slice(marks.lines).filter(line => /Mutabakat taraması/.test(line)) };
      marks = { scans: scans.length, alerts: alerts.length, lines: log.lines.length };
      return out;
    },
  };
}
const QUIET = { gunluk: [], zil: [], sunucu: [] };
const ALARM = (previous, count) => ({
  gunluk: [grew(previous, count)],
  zil: [[{ code: CODE, name: grew(previous, count), count, notice: true, previous }]],
  sunucu: [`warn: Mutabakat taraması: ${grew(previous, count)}. Elle ya da dış bir araçla veri düzenlenmiş olabilir; Mutabakat Testi'ndeki uyarının satırlarına bakın.`],
});

describe("Birleşik tur 6 — uyarının kapının görmediği artışı: günlük + zil; geri yükleme, azalma, yeniden açılış, iki şirket, yedek, gün dönümü sessiz", () => {
  const root = mkdtempSync(path.join(tmpdir(), "b6-uyari-artis-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  let log = capture();
  let server;
  let api;
  let obs;
  const ids = { early: [] };
  const integ = async (q = "") => must("Mutabakat Testi", api.get(`/api/workspace/ledger/integrity${q}`));
  const kasaIn = async (date, amount = "250", q = "") => idOf(await must(`Kasa Giriş ${date}`, api.post(`/api/workspace/cash${q}`, { kind: "in", amount, date, description: `giriş ${date}`, method: "cash" })));
  const boot = async (time = NOW) => {
    log = capture();
    // gateVerify: false → üretimdeki kapı yolu (süzgeç); ilk yazımın yolu ölçülür.
    server = await startTestServer({ dataDir, backupDir, now: { time, fixed: true }, gateVerify: false, log: log.log });
    api = apiOf(await loginAdmin(server));
    obs = observer(() => server.app, server.app.events, log);
  };
  before(async () => {
    await boot();
    await api.post("/api/workspace/bank/setup/dismiss", {});
    // Açılış yokken açılıştan önceki günlere yazılır (S12 yok), silinir; taksit kartının nakit tahsilatı da (kart silinir); sonra Kasa açılışı.
    for (const date of EARLY) ids.early.push(await kasaIn(date, "10"));
    for (const id of ids.early) await must(`sil ${id}`, api.del(`/api/workspace/cash/${id}`));
    const customer = idOf(await must("müşteri", api.post("/api/workspace/accounts", { name: "Kart Müşterisi", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
    ids.plan = idOf(await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer, name: "Uyarı Kartı", total: "1.000,00", registeredOn: "2026-01-02", mode: "auto", count: 2, firstDue: "2026-04-01" })));
    await must("kart tahsilatı (açılıştan önce, nakit)", api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "25", date: EARLY[0], method: "cash", cashForce: true, similarOk: true, force: true }));
    await must("kartı sil", api.del(`/api/workspace/plans/${ids.plan}`));
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    await restoreFromTrash(api, ids.early[0]);
    await restoreFromTrash(api, ids.early[1]);
    // Ön koşul: açılışta 2 uyarı satırı (Silinenler'den), sapma yok; açılıştan sonraki iki Kasa girişi (dışarıdan taşınacak).
    ids.day1 = await kasaIn(OPEN);
    ids.day2 = await kasaIn(AFTER);
    ids.day3 = await kasaIn(AFTER, "30");
    const result = await integ();
    assert.deepEqual({ uyari: noticeOf(result)?.count, sapma: driftsOf(result), gozlem: obs.fresh() }, { uyari: 2, sapma: [], gozlem: QUIET }, "ön koşul");
  });
  after(async () => {
    await server?.close();
    removeTestDir(root);
  });

  it("dış yazım (açılış günü girilen Kasa hareketinin tarihi başka bağlantıdan açılış öncesine): Mutabakat Testi günlük + zil + sunucu günlüğü, cümle düzeninde; sunum AYNEN; aynı artış ikinci kez bildirilmez", async () => {
    moveOutside(server.app.store, ids.day1, MOVED);
    const result = await integ();
    const seen = { uyari: noticeOf(result)?.count, notice: noticeOf(result)?.notice, severity: noticeOf(result)?.severity, sapma: driftsOf(result), gozlem: obs.fresh() };
    const report = await must("Defter Mutabakatı", api.get("/api/workspace/report-center/defter-mutabakati"));
    seen.rapor = { sonuc: (report.summary || []).find(pair => pair[0] === "Sonuç")?.[1], satir: (report.rows || []).find(row => String(row[1]) === "Kasa Açılışından Önce Tarihli Hareket")?.slice(-2) };
    // Aynı artış: iş parçacığı taraması ve ikinci Mutabakat Testi yeniden yazmaz.
    const background = await server.app.integrity.scanInBackground();
    await integ();
    seen.ikinci = { isParcacigi: background?.findings?.map(item => item.code), gozlem: obs.fresh() };
    assert.deepEqual(seen, {
      uyari: 3, notice: true, severity: "warning", sapma: [], gozlem: ALARM(2, 3),
      rapor: { sonuc: "Tutarlı", satir: ["3 satır", "Uyarı"] },
      ikinci: { isParcacigi: [], gozlem: QUIET },
    });
  });

  it("azalma sessiz ve işaret onu izler: satır silinince (3 → 2) günlük yok; sonraki dış artış 2 → 3 diye bildirilir (iş parçacığı taraması da bulur)", async () => {
    await must("açılış öncesi satırı sil", api.del(`/api/workspace/cash/${ids.day1}`));
    const down = await integ();
    const quiet = { uyari: noticeOf(down)?.count, gozlem: obs.fresh() };
    moveOutside(server.app.store, ids.day2, MOVED);
    const background = await server.app.integrity.scanInBackground();
    const seen = { quiet, isParcacigi: background?.findings?.map(item => item.code), uyari: noticeOf(background?.result)?.count, gozlem: obs.fresh() };
    assert.deepEqual(seen, { quiet: { uyari: 2, gozlem: QUIET }, isParcacigi: [CODE], uyari: 3, gozlem: ALARM(2, 3) });
  });

  it("geri yükleme sayılır, ama dış artışı ÖRTMEZ: aynı aralıkta 1 geri yükleme + 1 dış artış → 2 → 4, açıklanamayan 1 → bildirilir; yalnız geri yükleme → sessiz", async () => {
    await must("sil", api.del(`/api/workspace/cash/${ids.early[0]}`));
    const down = await integ();
    assert.deepEqual({ uyari: noticeOf(down)?.count, gozlem: obs.fresh() }, { uyari: 2, gozlem: QUIET }, "ön koşul (3 → 2)");
    await restoreFromTrash(api, ids.early[0]);
    moveOutside(server.app.store, ids.day3, MOVED);
    const both = await integ();
    const seen = { birlikte: { uyari: noticeOf(both)?.count, gozlem: obs.fresh() } };
    // Yalnız geri yükleme (satırın kendisi): 4 → 5 sessiz.
    await restoreFromTrash(api, ids.early[2]);
    const only = await integ();
    seen.yalnizGeriYukleme = { uyari: noticeOf(only)?.count, gozlem: obs.fresh() };
    assert.deepEqual(seen, { birlikte: { uyari: 4, gozlem: ALARM(2, 4) }, yalnizGeriYukleme: { uyari: 5, gozlem: QUIET } });
  });

  it("üst kaydın geri yüklenmesi (silinmiş taksit kartı; nakit satırı yazılmaz, görünürlüğü döner) sayılır: 5 → 6 sessiz", async () => {
    const plan = await must("Silinenler", api.get("/api/admin/trash"));
    assert.ok((Array.isArray(plan) ? plan : plan.items || []).some(row => row.id === `plan:${ids.plan}`), "ön koşul: kart Silinenler'de");
    await restoreFromTrash(api, ids.plan);
    const result = await integ();
    assert.deepEqual({ uyari: noticeOf(result)?.count, gozlem: obs.fresh() }, { uyari: 6, gozlem: QUIET });
  });

  it("iş parçacığı taraması sürerken kesinleşen geri yükleme yanlış alarm vermez (ön koşul zorla: geri yükleme taramanın anlık görüntüsüne girdi — ders 20)", async () => {
    let met = 0;
    const trials = [];
    for (let k = 0; k < 5 && !met; k += 1) {
      // İşaret: satır silinip tarama yapılır (sayı 1 azalır, sessiz); sonra tarama başlar ve hemen geri yüklenir.
      await must("sil", api.del(`/api/workspace/cash/${ids.early[1]}`));
      const base = noticeOf(await integ())?.count;
      obs.fresh();
      const pending = server.app.integrity.scanInBackground();
      await restoreFromTrash(api, ids.early[1]);
      const background = await pending;
      const inSnapshot = noticeOf(background?.result)?.count;
      const next = await integ();
      const trial = { base, inSnapshot, isParcacigi: background?.findings?.map(item => item.code), sonraki: noticeOf(next)?.count, gozlem: obs.fresh() };
      trials.push(trial);
      // Ön koşul: anlık görüntü geri yüklemeyi İÇERİYOR (base + 1) — işaret taramanın başlangıcında alındığı için bu sıra kendiliğinden açıklanamaz.
      if (inSnapshot === base + 1) {
        met += 1;
        assert.deepEqual({ isParcacigi: trial.isParcacigi, sonraki: trial.sonraki, gozlem: trial.gozlem }, { isParcacigi: [], sonraki: base + 1, gozlem: QUIET }, JSON.stringify(trials));
      } else assert.deepEqual(trial.gozlem, QUIET, JSON.stringify(trials));
    }
    assert.ok(met >= 1, `ön koşul hiçbir denemede oluşmadı: ${JSON.stringify(trials)}`);
  });

  it("gün dönümü (sahte saat ertesi gün 00:30): tarama yeniden koşar, sayı aynı → sessiz; yeni günde dış artış bildirilir", async () => {
    const before_ = noticeOf(await integ())?.count;
    obs.fresh();
    server.clock.set("2026-03-21T00:30:00");
    const background = await server.app.integrity.scanInBackground();
    const quiet = { kostu: Boolean(background?.result), isParcacigi: background?.findings?.map(item => item.code), gozlem: obs.fresh() };
    ids.day4 = await kasaIn("2026-03-21", "5");
    moveOutside(server.app.store, ids.day4, MOVED);
    const result = await integ();
    assert.deepEqual({ quiet, gozlem: obs.fresh(), uyari: noticeOf(result)?.count }, { quiet: { kostu: true, isParcacigi: [], gozlem: QUIET }, gozlem: ALARM(before_, before_ + 1), uyari: before_ + 1 });
  });

  it("program yeniden açılınca: aynı artış İKİNCİ kez bildirilmez (açılış, Mutabakat Testi, iş parçacığı); açılıştan sonraki ilk nakit yazımı süzgeçli yolda; açılıştan sonra, İLK taramadan önce yapılan dış artış bildirilir (sayı açılışta ölçüldü)", async () => {
    const count = noticeOf(await integ())?.count;
    const scansBefore = scansOf(server.app.store).length;
    await server.app.close();
    await boot("2026-03-21T09:00:00");
    const opened = { gunluk: scansOf(server.app.store).slice(scansBefore), sunucu: log.lines.filter(line => /Mutabakat/.test(line)) };
    ids.day5 = await kasaIn("2026-03-21", "7");
    const gate = server.app.integrity.stats().gate;
    // İlk taramadan ÖNCE dış artış: önceki sayı açılışta ölçülmüş olmalı (yoksa ilk tarama artışı "ilk görünüş" sanıp yutar).
    moveOutside(server.app.store, ids.day5, MOVED);
    const result = await integ();
    const seen = { opened, ilkYazim: `${gate.path}${gate.reason ? ` (${gate.reason})` : ""}`, uyari: noticeOf(result)?.count, yeni: obs.fresh() };
    const background = await server.app.integrity.scanInBackground();
    await integ();
    seen.sonra = { isParcacigi: background?.findings?.map(item => item.code), gozlem: obs.fresh() };
    assert.deepEqual(seen, { opened: { gunluk: [], sunucu: [] }, ilkYazim: "scoped", uyari: count + 1, yeni: ALARM(count, count + 1), sonra: { isParcacigi: [], gozlem: QUIET } });
  });

  it("iki şirket + yedekten geri yükleme: 002'nin geri yüklemesi / dış artışı yalnız 002'de; 002 yedekten dönünce (sayı geri gelir) yanlış alarm yok", async () => {
    const second = (await must("002", api.post("/api/companies", { name: "Uyarı İkinci" }))).company;
    const q = `?hofCompany=${second.id}`;
    await api.post(`/api/workspace/bank/setup/dismiss${q}`, {});
    const early = [await kasaIn(EARLY[0], "10", q), await kasaIn(EARLY[1], "10", q)];
    for (const id of early) await must("002 sil", api.del(`/api/workspace/cash/${id}${q}`));
    await must("002 açılış", api.post(`/api/workspace/cash/opening${q}`, { amount: "1.000", date: OPEN }));
    const child = () => server.app.openCompany(second.id);
    await integ(q);
    const obs2 = observer(child, child().events, log);
    const s001 = noticeOf(await integ())?.count;
    obs.fresh();
    await restoreFromTrash(api, early[0], q);
    await restoreFromTrash(api, early[1], q);
    const restored = { s002: noticeOf(await integ(q))?.count, g002: obs2.fresh().gunluk, s001: noticeOf(await integ())?.count, g001: obs.fresh().gunluk };
    const day = await kasaIn(AFTER, "3", q);
    moveOutside(child().store, day, MOVED);
    const r002 = await integ(q);
    const z002 = obs2.fresh();
    const outside = { s002: noticeOf(r002)?.count, g002: z002.gunluk, zil002: z002.zil, s001: noticeOf(await integ())?.count, g001: obs.fresh().gunluk };
    // Yedek (sayı 3), sonra açılış öncesi satırlar silinir (3 → 1, sessiz), yedekten geri yükleme (şirket yeniden açılır, sayı 3): yanlış alarm yok.
    const backup = await must("002 yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }));
    for (const id of early) await must("002 sil", api.del(`/api/workspace/cash/${id}${q}`));
    const down = noticeOf(await integ(q))?.count;
    const quietDown = obs2.fresh().gunluk;
    await must("002 yedekten geri yükle", api.post("/api/admin/backups/restore", { name: backup.backups?.[0]?.name, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }));
    // Şirket yeniden açılır (açılış: uyarının sayısı ölçülür, sessiz); zil yeni örneğin olay kanalından okunur.
    await must("002 yeniden açılır", api.get(`/api/workspace/cash${q}`));
    const obs2b = observer(child, child().events, log);
    const back = await integ(q);
    const background = await child().integrity.scanInBackground();
    const yedek = { down, quietDown, s002: noticeOf(back)?.count, isParcacigi: background?.findings?.map(item => item.code), gunluk: obs2b.fresh().gunluk, zil: obs2b.alerts.length, arttiSatiri: scansOf(child().store).filter(summary => /uyarısı arttı/.test(summary)).length };
    assert.deepEqual(
      { restored, outside, yedek },
      {
        restored: { s002: 2, g002: [], s001, g001: [] },
        outside: { s002: 3, g002: [grew(2, 3)], zil002: [[{ code: CODE, name: grew(2, 3), count: 3, notice: true, previous: 2 }]], s001, g001: [] },
        // Yedek, dış artış bildirildikten SONRA alındı: geri gelen veride o günlük satırı da var (1); yeni satır yazılmaz, zil yok.
        yedek: { down: 1, quietDown: [], s002: 3, isParcacigi: [], gunluk: [], zil: 0, arttiSatiri: 1 },
      },
    );
  });
});

describe("Birleşik tur 6 — dar kontrolün betiği: v2.4.9'un GERÇEK koduyla üretilmiş veri (açılış öncesi Kasa Giriş + cari nakit tahsilat) — dış artış bildirilir", { skip: !tagsAvailable(["v2.4.9"]) && "v2.4.9 etiketi bu depoda yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "b6-uyari-249-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  let server;
  after(async () => {
    await server?.close();
    removeTestDir(root);
  });

  it("2.4.9 verisi açılır (uyarı 2, günlük yok, ilk yazım süzgeçli); açılış günü 250 TL Kasa Giriş başka bağlantıdan 08.03'e → uyarı 3 (tutar Kasa bakiyesinde kalır — açılışın içindeki günle iki kez), günlük + zil", async () => {
    const old = await bootVersion("v2.4.9", { dataDir, backupDir, now: { time: NOW, fixed: true } });
    try {
      const v = await old.login();
      await v.post("/api/workspace/bank/setup/dismiss", {});
      await must("2.4.9 açılış", v.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
      await must("2.4.9 açılış öncesi Kasa Giriş", v.post("/api/workspace/cash", { kind: "in", amount: "100", date: "2026-03-05", description: "2.4.9 açılış öncesi", method: "cash" }));
      const cari = idOf(await must("2.4.9 cari", v.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
      await must("2.4.9 açılış öncesi cari nakit tahsilat", v.post(`/api/workspace/accounts/${cari}/entries`, { kind: "in", amount: "40", date: "2026-03-06", method: "cash", note: "nakit", cashForce: true, similarOk: true, force: true }));
    } finally {
      await old.close();
    }
    const log = capture();
    server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, gateVerify: false, moneyStrict: false, log: log.log });
    const api = apiOf(await loginAdmin(server));
    const obs = observer(() => server.app, server.app.events, log);
    const integ = () => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    const first = await integ();
    await must("açılış sonrası", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: AFTER, description: "sonra", method: "cash" }));
    const opened = { uyari: noticeOf(first)?.count, sapma: driftsOf(first), gozlem: obs.fresh(), ilkYazim: server.app.integrity.stats().gate.path };
    const day = idOf(await must("açılış günü Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "250", date: OPEN, description: "açılış günü", method: "cash" })));
    const kasa0 = (await must("Kasa", api.get("/api/workspace/cash"))).totals?.balance;
    moveOutside(server.app.store, day, MOVED);
    const result = await integ();
    const kasa1 = (await must("Kasa", api.get("/api/workspace/cash"))).totals?.balance;
    assert.deepEqual(
      { opened, uyari: noticeOf(result)?.count, sapma: driftsOf(result), gozlem: obs.fresh(), kasa: [kasa0, kasa1] },
      { opened: { uyari: 2, sapma: [], gozlem: QUIET, ilkYazim: "scoped" }, uyari: 3, sapma: [], gozlem: ALARM(2, 3), kasa: [kasa0, kasa0] },
    );
  });
});
