// 2.5.0 BİRLEŞİK TUR 8 — İş 8: Silinenler geri yüklemesi yalnız SİLİNİRKENKİ hâliyle dönen satırı açıklar (birleşik tur 7 dar kontrolü DK-B7 ORTA-1) + DÜŞÜK-1 (N5, N8).
// BAŞ MİMAR KARARI 13.11 09:54 (iş listesi D; kullanıcıya gösterildi): "geri yükleme yalnız SİLİNİRKEN de aynı kimlik + tarih + tutarla var olan satırları açıklar; silindikten
// sonra dışarıdan değişen satır alarm verir; eski (özetsiz) Silinenler öğelerinde bugünkü davranış aynen (yanlış alarm üretilmez)". Silinirken üst kaydın (kart, cari, çek / senet)
// gizlenen nakit satırlarının kimlik + tarih + tutar özeti, tek satırlık öğede yükün özeti ayar tablosuna yazılır (lib/cash-opening.mjs recordingHidden, lib/trash.mjs).
// Sınıf listesi: özetli / özetsiz öğe × değişmemiş / tarihi / tutarı / kimliği değişmiş × satır içi / iş parçacığı taraması. Dış yazım ayrı bağlantıyla (DatabaseSync).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const MOVED = "2026-03-05";
const EARLY = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"];
const CODE = "cash:before-opening";
const grew = (previous, count, unexplained = 1) => `Kasa açılışından önce tarihli hareket uyarısı arttı (${previous} → ${count} hareket; kapının görmediği yazım: ${unexplained} hareket)`;
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, raw: r.data });
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.raw).slice(0, 300)}`);
  return res.data;
};
const idOf = data => data?.id || data?.entry?.id || data?.plan?.id || "";
const noticeOf = result => (result?.checks || []).find(item => item.code === CODE) || null;
const scansOf = store => store.all("SELECT summary FROM integrity_log WHERE action = 'scan' ORDER BY at, rowid").map(row => row.summary);
function outside(store, fn) {
  const other = new DatabaseSync(store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    return fn(other);
  } finally {
    other.close();
  }
}

/** Dünya: açılıştan önce dört Kasa girişi (girilip silinir) + iki nakit tahsilatlı taksit kartı (açılıştan önce; kart silinir) + açılış 10.03 + iki tek satır geri yüklenir (uyarı 2). */
async function world(t) {
  const root = mkdtempSync(path.join(tmpdir(), "b8-ozet-"));
  const server = await startTestServer({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: NOW, fixed: true }, gateVerify: false });
  t.after(async () => {
    await server.close();
    removeTestDir(root);
  });
  const client = await loginAdmin(server);
  const api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)), del: async u => unwrap(await client.del(u)) };
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const ids = { early: [] };
  const kasaIn = async (date, amount = "10") => idOf(await must(`Kasa Giriş ${date}`, api.post("/api/workspace/cash", { kind: "in", amount, date, description: `giriş ${date}`, method: "cash" })));
  for (const date of EARLY) ids.early.push(await kasaIn(date));
  for (const id of ids.early) await must(`sil ${id}`, api.del(`/api/workspace/cash/${id}`));
  const customer = idOf(await must("müşteri", api.post("/api/workspace/accounts", { name: "Özet Kartı Müşterisi", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
  ids.plan = idOf(await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer, name: "Özet Kartı", total: "1.000,00", registeredOn: "2026-01-02", mode: "auto", count: 2, firstDue: "2026-04-01" })));
  for (const date of EARLY.slice(0, 2)) await must(`kart tahsilatı ${date}`, api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "25", date, method: "cash", cashForce: true, similarOk: true, force: true }));
  ids.entries = server.app.store.all("SELECT id FROM plan_entries WHERE plan_id = ? ORDER BY date", ids.plan).map(row => row.id);
  await must("kartı sil", api.del(`/api/workspace/plans/${ids.plan}`));
  await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
  const restore = async ref => {
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === ref || row.id === `plan:${ref}`);
    assert.ok(item, `Silinenler'de ${ref}`);
    return must(`geri yükle ${ref}`, api.post("/api/admin/trash/restore", { id: item.id }));
  };
  await restore(ids.early[0]);
  await restore(ids.early[1]);
  ids.after = await kasaIn(OPEN, "30");
  const alerts = [];
  server.app.events.tap((name, payload) => {
    if (name === "integrity.alert") alerts.push(...payload.findings.filter(f => f.notice).map(f => f.name));
  });
  const store = () => server.app.store;
  let mark = { scans: scansOf(store()).length, alerts: 0 };
  const obs = () => {
    const scans = scansOf(store());
    const own = summary => (summary.match(/Kasa açılışından önce tarihli hareket uyarısı[^)]*\)/g) || []).join("; ");
    const out = { gunluk: scans.slice(mark.scans).map(own).filter(Boolean), zil: alerts.slice(mark.alerts) };
    mark = { scans: scans.length, alerts: alerts.length };
    return out;
  };
  const scan = async via => {
    if (via === "worker") {
      const background = await server.app.integrity.scanInBackground();
      assert.ok(background?.result, "iş parçacığı taraması koştu");
      return { uyari: noticeOf(background.result)?.count ?? 0, ...obs() };
    }
    return { uyari: noticeOf(await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity")))?.count ?? 0, ...obs() };
  };
  assert.deepEqual(await scan("inline"), { uyari: 2, gunluk: [], zil: [] }, "ön koşul: uyarı 2, sessiz");
  return { server, api, ids, restore, store, scan, kasaIn };
}
const QUIET = n => ({ uyari: n, gunluk: [], zil: [] });
const ALARM = (n, previous, unexplained = 1) => ({ uyari: n, gunluk: [grew(previous, n, unexplained)], zil: [grew(previous, n, unexplained)] });
// Gizli kart satırına (Silinenler'de) dış yazım.
const CHANGES = {
  "değişmemiş": () => {},
  "tarihi değişmiş": (other, id) => {
    const event = other.prepare("SELECT event_id AS e FROM plan_entries WHERE id = ?").get(id)?.e;
    other.prepare("UPDATE plan_entries SET date = ? WHERE id = ?").run(MOVED, id);
    if (event) other.prepare("UPDATE fin_events SET date = ? WHERE id = ?").run(MOVED, event);
  },
  "tutarı değişmiş": (other, id) => other.prepare("UPDATE plan_entries SET amount = 40 WHERE id = ?").run(id),
  "kimliği değişmiş": (other, id) => other.prepare("UPDATE plan_entries SET id = ? WHERE id = ?").run(`${id}-dis`, id),
};

for (const via of ["inline", "worker"]) {
  const yol = via === "inline" ? "satır içi tarama" : "iş parçacığı taraması";
  describe(`Birleşik tur 8 İş 8 — Silinenler özeti; ${yol}`, () => {
    for (const [name, change] of Object.entries(CHANGES)) {
      it(`ÖZETLİ öğe (kart bu kodla silindi) × ${name} gizli satır → ${name === "değişmemiş" ? "sessiz (meşru geri yükleme)" : "alarm (açıklanamayan 1)"}`, async t => {
        const w = await world(t);
        const saved = w.store().get("SELECT value FROM settings WHERE key = ?", `cash-hidden:plan:${w.ids.plan}`)?.value;
        assert.ok(saved && JSON.parse(saved).rows[`plan_entries:${w.ids.entries[0]}`] === "2026-03-01|2500", `ön koşul: özet yazıldı (${saved})`);
        outside(w.store(), other => change(other, w.ids.entries[0]));
        await w.restore(w.ids.plan);
        assert.deepEqual(await w.scan(via), name === "değişmemiş" ? QUIET(4) : ALARM(4, 2));
      });
      it(`ÖZETSİZ (eski) öğe × ${name} gizli satır → sessiz (bugünkü davranış; yanlış alarm üretilmez)`, async t => {
        const w = await world(t);
        outside(w.store(), other => {
          other.prepare("DELETE FROM settings WHERE key = ?").run(`cash-hidden:plan:${w.ids.plan}`);
          change(other, w.ids.entries[0]);
        });
        await w.restore(w.ids.plan);
        assert.deepEqual(await w.scan(via), QUIET(4));
      });
    }
    it("tek satırlık öğe: yükü dışarıdan değiştirilmiş (tarih 03.03 → 05.03) Kasa hareketi geri yüklenince alarm; yükü değişmemiş öğe sessiz", async t => {
      const w = await world(t);
      await w.restore(w.ids.early[2]);
      assert.deepEqual(await w.scan(via), QUIET(3), "değişmemiş yük: sessiz");
      outside(w.store(), other => {
        const row = other.prepare("SELECT id, payload_json AS p FROM trash WHERE ref = ? AND restored_at IS NULL").get(w.ids.early[3]);
        const payload = JSON.parse(row.p);
        other.prepare("UPDATE trash SET payload_json = ? WHERE id = ?").run(JSON.stringify({ ...payload, date: MOVED }), row.id);
      });
      await w.restore(w.ids.early[3]);
      assert.deepEqual(await w.scan(via), ALARM(4, 3));
    });
    it("meşru yollar sessiz: sil → geri yükle → yeniden sil → geri yükle (kart); iki ayrı tek satır geri yüklemesi", async t => {
      const w = await world(t);
      await w.restore(w.ids.plan);
      assert.deepEqual(await w.scan(via), QUIET(4));
      await must("kartı yeniden sil", w.api.del(`/api/workspace/plans/${w.ids.plan}`));
      assert.deepEqual(await w.scan(via), QUIET(2));
      await w.restore(w.ids.plan);
      await w.restore(w.ids.early[2]);
      await w.restore(w.ids.early[3]);
      assert.deepEqual(await w.scan(via), QUIET(6));
    });
    // DÜŞÜK-1 (i) (dar kontrolün S10 / S11 sırası; mutant N5): dış yazım geri yüklemeden ÖNCE gelir — geri yükleme yalnız kendi getirdiği kimliği açıklar.
    it("DÜŞÜK-1 (i): dış yazım (açılış sonrası Kasa hareketi açılış öncesine) SONRA tek satır geri yükleme → alarm (2 → 4; açıklanamayan 1)", async t => {
      const w = await world(t);
      outside(w.store(), other => {
        const event = other.prepare("SELECT event_id AS e FROM cash_entries WHERE id = ?").get(w.ids.after)?.e;
        other.prepare("UPDATE cash_entries SET date = ? WHERE id = ?").run(MOVED, w.ids.after);
        if (event) other.prepare("UPDATE fin_events SET date = ? WHERE id = ?").run(MOVED, event);
      });
      await w.restore(w.ids.early[2]);
      assert.deepEqual(await w.scan(via), ALARM(4, 2));
    });
    it("DÜŞÜK-1 (i) — ÖZETSİZ (eski) tek satırlık öğede de: dış yazım SONRA geri yükleme → alarm (geri yükleme önceden var olan kimliği açıklamaz)", async t => {
      const w = await world(t);
      outside(w.store(), other => {
        const trashId = other.prepare("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL").get(w.ids.early[2]).id;
        other.prepare("DELETE FROM settings WHERE key = ?").run(`cash-hidden:trash:${trashId}`);
        const event = other.prepare("SELECT event_id AS e FROM cash_entries WHERE id = ?").get(w.ids.after)?.e;
        other.prepare("UPDATE cash_entries SET date = ? WHERE id = ?").run(MOVED, w.ids.after);
        if (event) other.prepare("UPDATE fin_events SET date = ? WHERE id = ?").run(MOVED, event);
      });
      await w.restore(w.ids.early[2]);
      assert.deepEqual(await w.scan(via), ALARM(4, 2));
    });
  });
}

describe("Birleşik tur 8 İş 8 — DÜŞÜK-1 (ii) (mutant N8): uyarının kimlik kümesi Mutabakat Testi yanıtına SIZMAZ", () => {
  it("Mutabakat Testi yanıtında 'noticeKeys' alanı yok; uyarının kendisi var", async t => {
    const w = await world(t);
    const res = await must("Mutabakat Testi", w.api.get("/api/workspace/ledger/integrity"));
    assert.equal(Object.hasOwn(res, "noticeKeys"), false, "noticeKeys yanıtta yok");
    assert.equal(JSON.stringify(res).includes("noticeKeys"), false);
    assert.equal(noticeOf(res)?.count, 2);
  });
});
