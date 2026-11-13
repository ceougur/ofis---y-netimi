// 2.5.0 birleşik tur 7 — İş 1: "Kasa Açılışından Önce Tarihli Hareket" uyarısının kapının görmediği yazımı SAYI yerine KİMLİK kümesiyle (dar kontrol DK-B6 ORTA-1 + DÜŞÜK-1).
// Karar (BAŞ MİMAR 12.11 12:52 (1), (5); docs/devir/D2-ALTYAPI-TASARIM.md §16): tarama uyarı satırlarının kimliklerini saklar; geri yükleme geri gelen kimlikleri kaydeder;
// alarm = önceki kümede ve (işaretten sonra) geri gelenlerde olmayan her yeni kimlik. Önceden (birleşik tur 6, sayı): iki tarama arasında sil + geri yükle + dış yazım
// (2 → 1 → 2 → 3) açıklanmış sayılıyordu (S1, S1b) ve sil + dış yazım (2 → 2) hiç görünmüyordu (§15 BİLİNEN SINIR). İleti açıklanamayan hareket sayısını söyler.
// "Nasıl bozulur?" listesi §16.1 — buradaki testler o listenin 1, 3, 4, 5, 6, 9, 12 (b), 13, 14 maddeleri; 2, 7, 8, 10, 11 ve 12 (a) test/kasa-acilis-uyari-artis-250.test.mjs'te.
// Her senaryo kendi sunucusunda (sıra bağımlılığı yok); satır içi (Mutabakat Testi) VE iş parçacığı (arka plan) tarama yolu. Veri programın API'sinden (açılıştan önce
// girilip silinen, açılıştan sonra Silinenler'den geri alınan satırlar — Z9 yolu); dış yazım ayrı bağlantıyla (DatabaseSync). Sahte saat (ders 13); iki TZ; lisans
// servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const AFTER = "2026-03-11";
const MOVED = "2026-03-08";
const EARLY = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"];
const CODE = "cash:before-opening";
const grew = (previous, count, unexplained = 1) => `Kasa açılışından önce tarihli hareket uyarısı arttı (${previous} → ${count} hareket; kapının görmediği yazım: ${unexplained} hareket)`;
const entered = (previous, count, unexplained = 1) => `Kasa açılışından önce tarihli hareket uyarısına yeni hareket girdi (${previous} → ${count} hareket; kapının görmediği yazım: ${unexplained} hareket)`;

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
const noticeOf = result => (result?.checks || []).find(item => item.code === CODE) || null;
const scansOf = store => store.all("SELECT summary FROM integrity_log WHERE action = 'scan' ORDER BY at, rowid").map(row => row.summary);

/** Ayrı bağlantı (kapının görmediği yazım). */
function outside(store, fn) {
  const other = new DatabaseSync(store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    return fn(other);
  } finally {
    other.close();
  }
}
/** Kasa hareketinin tarihi dışarıdan (satır + işlem başlığı tutarlı) değiştirilir. */
const moveOutside = (store, id, date) =>
  outside(store, other => {
    const event = other.prepare("SELECT event_id AS e FROM cash_entries WHERE id = ?").get(id)?.e;
    assert.ok(event, `ön koşul: ${id} işlem başlıklı`);
    other.prepare("UPDATE cash_entries SET date = ? WHERE id = ?").run(date, id);
    other.prepare("UPDATE fin_events SET date = ? WHERE id = ?").run(date, event);
  });

/**
 * Bir senaryonun dünyası: açılıştan önce dört Kasa girişi (girilip silinir) + açılış (10.03) + ikisi Silinenler'den geri alınır (uyarı 2) + açılıştan sonra üç giriş;
 * ilk Mutabakat Testi (işaret). obs(): son çağrıdan beri YENİ günlük satırları, zil bulguları ve sunucu iletileri.
 */
async function world(t, { plan = false, moneyStrict = undefined } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "b7-kimlik-"));
  const lines = [];
  const log = { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) };
  const server = await startTestServer({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: NOW, fixed: true }, gateVerify: false, log, ...(moneyStrict === undefined ? {} : { moneyStrict }) });
  t.after(async () => {
    await server.close();
    removeTestDir(root);
  });
  const api = apiOf(await loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const ids = { early: [] };
  const kasaIn = async (date, amount = "250") => idOf(await must(`Kasa Giriş ${date}`, api.post("/api/workspace/cash", { kind: "in", amount, date, description: `giriş ${date}`, method: "cash" })));
  for (const date of EARLY) ids.early.push(await kasaIn(date, "10"));
  for (const id of ids.early) await must(`sil ${id}`, api.del(`/api/workspace/cash/${id}`));
  if (plan) {
    // Birden çok satır getiren geri yükleme: iki nakit tahsilatlı taksit kartı (açılıştan önce), kart silinir.
    const customer = idOf(await must("müşteri", api.post("/api/workspace/accounts", { name: "Kart Müşterisi", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
    ids.plan = idOf(await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer, name: "Kimlik Kartı", total: "1.000,00", registeredOn: "2026-01-02", mode: "auto", count: 2, firstDue: "2026-04-01" })));
    for (const date of EARLY.slice(0, 2)) await must(`kart tahsilatı ${date}`, api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "25", date, method: "cash", cashForce: true, similarOk: true, force: true }));
    await must("kartı sil", api.del(`/api/workspace/plans/${ids.plan}`));
  }
  ids.opening = idOf(await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN })));
  const restore = async ref => {
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === ref || row.id === `plan:${ref}`);
    assert.ok(item, `Silinenler'de ${ref}`);
    return must(`geri yükle ${ref}`, api.post("/api/admin/trash/restore", { id: item.id }));
  };
  await restore(ids.early[0]);
  await restore(ids.early[1]);
  ids.d1 = await kasaIn(OPEN);
  ids.d2 = await kasaIn(AFTER);
  ids.d3 = await kasaIn(AFTER, "30");
  const alerts = [];
  server.app.events.tap((name, payload) => {
    if (name === "integrity.alert") alerts.push(...payload.findings.filter(f => f.notice).map(f => ({ name: f.name, count: f.count, previous: f.previous, unexplained: f.unexplained })));
  });
  const store = () => server.app.store;
  let mark = { scans: scansOf(store()).length, alerts: 0, lines: 0 };
  const obs = () => {
    const scans = scansOf(store());
    // Günlük satırının yalnız bu uyarının bölümü (aynı taramada dış yazımın kendi sapması — ör. İşlem Başlığı — da bulunabilir; o ayrı denetimdir).
    const own = summary => (summary.match(/Kasa açılışından önce tarihli hareket uyarısı[^)]*\)/g) || []).join("; ");
    const out = { gunluk: scans.slice(mark.scans).map(own).filter(Boolean), zil: alerts.slice(mark.alerts), sunucu: lines.slice(mark.lines).filter(line => /Mutabakat taraması: Kasa/.test(line)).length };
    mark = { scans: scans.length, alerts: alerts.length, lines: lines.length };
    return out;
  };
  const integ = async () => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  /** Tarama: satır içi (Mutabakat Testi) ya da iş parçacığı; uyarının sayısı + gözlem. */
  const scan = async via => {
    if (via === "worker") {
      const background = await server.app.integrity.scanInBackground();
      assert.ok(background?.result, `iş parçacığı taraması koştu: ${JSON.stringify(background).slice(0, 200)}`);
      return { uyari: noticeOf(background.result)?.count ?? 0, ...obs() };
    }
    return { uyari: noticeOf(await integ())?.count ?? 0, ...obs() };
  };
  const first = await scan("inline");
  assert.deepEqual(first, { uyari: 2, gunluk: [], zil: [], sunucu: 0 }, "ön koşul: uyarı 2, sessiz");
  return { server, api, ids, restore, store, scan, obs, kasaIn };
}
const QUIET = n => ({ uyari: n, gunluk: [], zil: [], sunucu: 0 });
const ALARM = (n, name, previous, unexplained = 1) => ({ uyari: n, gunluk: [name], zil: [{ name, count: n, previous, unexplained }], sunucu: 1 });

for (const via of ["inline", "worker"]) {
  const yol = via === "inline" ? "satır içi tarama (Mutabakat Testi)" : "iş parçacığı taraması";
  describe(`Birleşik tur 7 İş 1 — kimlik kümesi; ${yol}`, () => {
    it("§16.1-1 (S1 / S1b): iki tarama arası sil + Silinenler'den geri yükle + dış yazım → alarm (2 → 3; açıklanamayan 1); sonraki tarama sessiz", async t => {
      const w = await world(t);
      await must("sil e0", w.api.del(`/api/workspace/cash/${w.ids.early[0]}`));
      await w.restore(w.ids.early[0]);
      moveOutside(w.store(), w.ids.d1, MOVED);
      // İkinci tarama satır içi: veri değişmediyse iş parçacığı taraması atlanır (parmak izi aynı) — "yinelenmez" satır içi taramada ölçülür.
      assert.deepEqual({ ilk: await w.scan(via), ikinci: await w.scan("inline") }, { ilk: ALARM(3, grew(2, 3), 2), ikinci: QUIET(3) });
    });

    it("§16.1-4 (S9; §15'in BİLİNEN SINIR'ı kapanır): sil + dış yazım (sayı aynı 2 → 2) → alarm 'yeni hareket girdi'", async t => {
      const w = await world(t);
      await must("sil e0", w.api.del(`/api/workspace/cash/${w.ids.early[0]}`));
      moveOutside(w.store(), w.ids.d1, MOVED);
      assert.deepEqual(await w.scan(via), ALARM(2, entered(2, 2), 2));
    });

    it("§16.1-3: yalnız meşru geri yükleme — iki tek satırlık geri yükleme (2 → 4) ve birden çok satır getiren taksit kartı (4 → 6) sessiz; aynı aralıkta kart + dış yazım → açıklanamayan 1", async t => {
      const w = await world(t, { plan: true });
      await w.restore(w.ids.early[2]);
      await w.restore(w.ids.early[3]);
      const tek = await w.scan(via);
      await w.restore(w.ids.plan);
      const kart = await w.scan(via);
      // Kart silinir (6 → 4, sessiz), sonra kart geri gelir (2 satır) + aynı aralıkta 1 dış yazım: 4 → 7, açıklanamayan 1.
      await must("kartı yeniden sil", w.api.del(`/api/workspace/plans/${w.ids.plan}`));
      const azalma = await w.scan(via);
      await w.restore(w.ids.plan);
      moveOutside(w.store(), w.ids.d2, MOVED);
      const birlikte = await w.scan(via);
      assert.deepEqual({ tek, kart, azalma, birlikte }, { tek: QUIET(4), kart: QUIET(6), azalma: QUIET(4), birlikte: ALARM(7, grew(4, 7), 4) });
    });

    it("§16.1-13 (kimliği yeniden kullanılan satır): geri gelen, taranan, silinip taranan, sonra DIŞARIDAN aynı kimlikle yeniden eklenen satır → alarm (eski açıklama düşer)", async t => {
      const w = await world(t);
      await w.restore(w.ids.early[2]);
      const geri = await w.scan(via);
      const row = outside(w.store(), other => other.prepare("SELECT * FROM cash_entries WHERE id = ?").get(w.ids.early[2]));
      await must("sil e2", w.api.del(`/api/workspace/cash/${w.ids.early[2]}`));
      const silindi = await w.scan(via);
      // Silinenler'deki satırın kimliğiyle dışarıdan aynı satır (işlem başlığıyla) yeniden yazılır.
      outside(w.store(), other => {
        const columns = Object.keys(row);
        other.prepare(`INSERT INTO cash_entries (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...columns.map(column => row[column]));
      });
      assert.deepEqual({ geri, silindi, dis: await w.scan(via) }, { geri: QUIET(3), silindi: QUIET(2), dis: ALARM(3, grew(2, 3), 2) });
    });

    it("§16.1-14: kapının kabul ettiği kimlik değişimi (aynı İşlem No, aynı gün; önceki hâl önceki kümede) sessiz; dış yazımla kümeye girmiş satırın kapıdan kimlik değişimi → alarm", async t => {
      // Para tablosuna mağaza düzeyinde yazım: test kipinin K6 sıkı denetimi (bank.post dışı yazımı reddeder) kapalı — üretimdeki gibi yalnız günlüğe yazar.
      const w = await world(t, { moneyStrict: false });
      const store = w.store();
      const reidentify = (id, next) =>
        store.tx(() => {
          const row = store.get("SELECT * FROM cash_entries WHERE id = ?", id);
          const columns = Object.keys(row).filter(column => column !== "id");
          store.run("DELETE FROM cash_entries WHERE id = ?", id);
          store.run(`INSERT INTO cash_entries (id, ${columns.join(", ")}) VALUES (?, ${columns.map(() => "?").join(", ")})`, next, ...columns.map(column => row[column]));
        });
      reidentify(w.ids.early[0], "b7-yeni-e0");
      const mesru = await w.scan(via);
      moveOutside(store, w.ids.d1, MOVED);
      reidentify(w.ids.d1, "b7-yeni-d1");
      const aklanmaz = await w.scan(via);
      const kimlikler = store.all("SELECT id FROM cash_entries WHERE id IN ('b7-yeni-e0', 'b7-yeni-d1') ORDER BY id").map(row => row.id);
      assert.deepEqual({ mesru, aklanmaz, kimlikler }, { mesru: QUIET(2), aklanmaz: ALARM(3, grew(2, 3), 2), kimlikler: ["b7-yeni-d1", "b7-yeni-e0"] });
    });

    it("§16.1-5 / 6: açılışı öne alma (sayı azalır) sessiz, sonra dış yazım alarm; açılışı silip yeniden girme (ilk hareketten sonra olamaz) sessiz", async t => {
      const w = await world(t);
      await must("açılışı öne al", w.api.post("/api/workspace/cash/opening", { amount: "5.000", date: EARLY[0] }));
      const oneAl = await w.scan(via);
      moveOutside(w.store(), w.ids.d1, "2026-02-27");
      const dis = await w.scan(via);
      await must("açılışı sil", w.api.del(`/api/workspace/cash/${w.ids.opening}`));
      const silindi = await w.scan(via);
      await must("açılışı yeniden gir", w.api.post("/api/workspace/cash/opening", { amount: "5.000", date: "2026-02-20" }));
      const yeniden = await w.scan(via);
      assert.deepEqual({ oneAl, dis, silindi, yeniden }, { oneAl: QUIET(0), dis: ALARM(1, grew(0, 1), 0), silindi: QUIET(0), yeniden: QUIET(0) });
    });

    it("§16.1-9: Şirket Verisini Sıfırla — küme yeniden ölçülür, sessiz (sıfırlamadan önce kaydedilen geri yükleme sonraki dış yazımı örtmez)", async t => {
      const w = await world(t);
      await w.restore(w.ids.early[2]);
      await must("sıfırla", w.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      const sifir = await w.scan(via);
      // Sıfırlamadan sonra yeni açılış + açılış sonrası giriş; dışarıdan açılış öncesine → alarm.
      await must("yeni açılış", w.api.post("/api/workspace/cash/opening", { amount: "100", date: OPEN }));
      const day = await w.kasaIn(AFTER, "4");
      const temiz = await w.scan(via);
      moveOutside(w.store(), day, MOVED);
      assert.deepEqual({ sifir, temiz, dis: await w.scan(via) }, { sifir: QUIET(0), temiz: QUIET(0), dis: ALARM(1, grew(0, 1), 0) });
    });
  });
}

describe("Birleşik tur 7 İş 1 — §16.1-12 (b): geri yükleme iş parçacığının anlık görüntüsünden SONRA kesinleşir (görüntüde yok) → o tarama karşılaştırmaz, sonraki tarama yanlış alarm vermez (ön koşul zorla — ders 20)", () => {
  it("geri yükleme tarama sürerken, görüntüye girmeden: işaret ilerlemez; sonraki iki tarama sessiz, sayı +1", async t => {
    const w = await world(t);
    const trials = [];
    let met = 0;
    // Gecikme araması: geri yükleme isteği iş parçacığı açıldıktan "delay" ms sonra gönderilir; ön koşul = geri yükleme taramanın sonucundan ÖNCE bitti VE anlık
    // görüntüde yok (sayı tabanda). Pencere dar (anlık görüntü ile sonucun arası) → ikiye bölerek aranır: görüntüye girdiyse gecikme artar (lo), tarama önce bittiyse
    // azalır (hi). Yeşil yalnız ön koşulun oluştuğu denemede sayılır.
    let lo = 0;
    let hi = 800;
    for (let k = 0; k < 40 && met < 2; k += 1) {
      const id = w.ids.early[k % 2];
      await must("sil", w.api.del(`/api/workspace/cash/${id}`));
      const base = (await w.scan("inline")).uyari;
      const delay = Math.round((lo + hi) / 2);
      let restoredFirst = false;
      let scanDone = false;
      const pending = w.server.app.integrity.scanInBackground().then(value => {
        scanDone = true;
        return value;
      });
      await new Promise(resolve => setTimeout(resolve, delay));
      await w.restore(id);
      restoredFirst = !scanDone;
      const background = await pending;
      const inSnapshot = noticeOf(background?.result)?.count ?? 0;
      const raced = { k, delay, base, inSnapshot, restoredFirst, bulgu: background?.findings?.map(item => item.code), gozlem: w.obs() };
      const next = await w.scan("worker");
      const next2 = await w.scan("inline");
      raced.sonraki = [next, next2];
      trials.push(raced);
      if (inSnapshot === base + 1) lo = delay;
      else if (!restoredFirst) hi = delay;
      if (hi - lo < 2) [lo, hi] = [Math.max(0, lo - 40), hi + 40];
      if (restoredFirst && inSnapshot === base) {
        met += 1;
        assert.deepEqual({ bulgu: raced.bulgu, gozlem: raced.gozlem, sonraki: raced.sonraki }, { bulgu: [], gozlem: { gunluk: [], zil: [], sunucu: 0 }, sonraki: [QUIET(base + 1), QUIET(base + 1)] }, JSON.stringify(trials));
      } else assert.deepEqual([raced.gozlem, ...raced.sonraki.map(item => item.gunluk)], [{ gunluk: [], zil: [], sunucu: 0 }, [], []], JSON.stringify(trials));
    }
    t.diagnostic(`ön koşul ${met} / ${trials.length} denemede oluştu (gecikmeler: ${trials.map(item => `${item.delay}${item.restoredFirst && item.inSnapshot === item.base ? "*" : ""}`).join(" ")})`);
    assert.ok(met >= 1, `ön koşul hiçbir denemede oluşmadı: ${JSON.stringify(trials.map(({ k, delay, base, inSnapshot, restoredFirst }) => ({ k, delay, base, inSnapshot, restoredFirst })))}`);
  });
});

// Birleşik tur 7 İş 5 (dar kontrol DK-B6 DÜŞÜK-2, yaşayan mutant M11 `every` → `some`): aynı taramada SAPMA (dış yazımın kendi İşlem Başlığı sapması) ve uyarı artışı
// birlikte bulununca Mutabakat Günlüğü'nde olay adı "Taramada Bulunan Sapma"dır (sapma uyarının adıyla örtülmez); yalnız uyarı artışında "Taramada Bulunan Uyarı Artışı".
describe("Birleşik tur 7 İş 5 — M11: Mutabakat Günlüğü'nde sapma + uyarı artışını birlikte taşıyan kayıt 'Sapma' adıyla", () => {
  it("dışarıdan aynı kimlikle yeniden yazılan Kasa satırı: tek tarama kaydı iki bulgu (İşlem Başlığı sapması + uyarı artışı) → 'Taramada Bulunan Sapma'; yalnız dış tarih taşıma → 'Taramada Bulunan Uyarı Artışı'", async t => {
    const w = await world(t);
    await w.restore(w.ids.early[2]);
    await w.scan("inline");
    const row = outside(w.store(), other => other.prepare("SELECT * FROM cash_entries WHERE id = ?").get(w.ids.early[2]));
    await must("sil e2", w.api.del(`/api/workspace/cash/${w.ids.early[2]}`));
    await w.scan("inline");
    outside(w.store(), other => {
      const columns = Object.keys(row);
      other.prepare(`INSERT INTO cash_entries (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...columns.map(column => row[column]));
    });
    await w.scan("inline");
    moveOutside(w.store(), w.ids.d2, MOVED);
    await w.scan("inline");
    const journal = await must("Mutabakat Günlüğü", w.api.get("/api/workspace/report-center/mutabakat-gunlugu"));
    const growth = (journal.rows || []).filter(item => /Kasa açılışından önce tarihli hareket uyarısı arttı/.test(String(item[3])));
    const seen = growth.map(item => ({ olay: item[1], sapmaDa: /İşlem Başlığı/.test(String(item[3])) })).sort((a, b) => (a.olay < b.olay ? -1 : 1));
    assert.deepEqual(seen, [
      { olay: "Taramada Bulunan Sapma", sapmaDa: true },
      { olay: "Taramada Bulunan Uyarı Artışı", sapmaDa: false },
    ]);
  });
});
