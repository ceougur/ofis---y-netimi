// 2.1.0 — Aşama 2, Dilim 4: eski sürüme dönüş ve AÇILIŞ ONARIMI (docs/BANKA-MODULU-PLAN.md §10.6, E1.16, E2.08).
//
// Gerçek durum: 2.0.25 ve 2.0.26 v20 veri dosyasını açar ve yazar (bekleyen göç yoksa göç koşucusu döner); yeni kolonları (fin_ref,
// event_id) ve tabloları (fin_events, cheque_collections, pos_*, bank_matches) bilmez. Bu test o sürümlerin GERÇEK kodunu (git
// etiketi) v20 dosyasında çalıştırır, sonra bu dalı açar ve onarım adımlarını (a–h) denetler:
//   a. eski sürümün yazdığı olaysız para satırı (rowid > eski satır işareti, meta.bank.legacyMarks) → "Hesabı Belirsiz Yeni Hareketler (n)" uyarısı; satır değişmez
//   b. eşleşmiş olayın satırı değişmiş → eşleşme geri alınır ("eski-surum")
//   c. bekleyen POS satışının kaynak satırı silinmiş → satış iptal (void)
//   d. bankaya geçmiş POS satışının kaynak satırı silinmiş → "Onarım Bekliyor" + uyarı
//   e. satırı olmayan etkin olay → iptal
//   f. yolu nakde çevrilmiş ama fin_ref'i dolu satır → açık dönemde fin_ref temizlenir; kilitli dönemde yalnız uyarı
//   g. olay kopyası satırla uyuşmuyor → açık dönemde ve eşleşmemişse kopya yenilenir; kilitli dönemde "Onarım Bekliyor"
//   h. tahsildeki çek eski sürümde ciro edilmiş / silinmiş / tahsil edilmiş → kayıt kapanır (withdrawn / collected), işlem başlığı
// ÇALIŞIYOR MU: onarımdan sonra Mutabakat Testi'nde yalnız ilgili (eski, kapıyı engellemeyen) sapma kalır; ilgisiz işlemler 200;
// ikinci açılışta onarım hiçbir şey değiştirmez (tek seferlik, damgalı).
// NASIL BOZARIM: eski sürüm sil / düzelt / yol değiştir / yeni gir / çek ciro et / tahsil et / sil; kilitli dönemdeki satırı elle boz.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { insertBankAccount, insertPos, localDay, rawAll, rawGet, rawRun } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const TODAY = localDay(0);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const eventOf = (db, table, id) => rawGet(db, `SELECT event_id AS e FROM ${table} WHERE id = ?`, id)?.e ?? null;
const now = () => new Date().toISOString();

/** Güncel kodla v20 dosyası + onarım senaryosunun ön verisi (eşleşme, POS satışı, tahsildeki çek: Aşama 3–12 gelene kadar doğrudan). */
async function prepare(dataDir, backupDir) {
  const server = await bootVersion(CURRENT, { dataDir, backupDir });
  try {
    const api = await server.login();
    const account = await must("cari", api.post("/api/workspace/accounts", { name: "Onarım Müşterisi", type: "customer", registeredOn: localDay(-30) }));
    const deleted = await must("silinecek Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: TODAY, description: "Eski sürüm silecek" }));
    const edited = await must("düzeltilecek tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "500", date: TODAY, method: "bank" }));
    const switched = await must("nakde çevrilecek havale", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "300", date: TODAY, method: "bank" }));
    const keep = await must("dokunulmayan", api.post("/api/workspace/cash", { kind: "in", amount: "2.000", date: TODAY, description: "Dokunulmayan" }));
    const posPending = await must("POS (bekleyen)", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "120", date: TODAY, method: "card" }));
    const posSettled = await must("POS (bankaya geçmiş)", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "80", date: localDay(-5), method: "card" }));
    const cheques = [];
    for (const serial of ["ON-1", "ON-2", "ON-3"]) cheques.push(await must(`çek ${serial}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "250", issueDate: TODAY, dueDate: localDay(15), accountId: account.id, serialNo: serial })));
    // Kilitli dönemdeki eski satır (g ve f'nin kilitli kolu): kilit ondan sonra konur.
    const locked = await must("kilitli tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "70", date: localDay(-20), method: "bank" }));
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Onarım Tedarikçisi", type: "supplier", registeredOn: localDay(-30) }));
    await server.close();
    return { account, supplier, deleted, edited, switched, keep, posPending, posSettled, cheques, locked };
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  }
}

// Banka tarafı (doğrudan): hesap + POS; switched ve locked hesaba bağlı; edited bir ekstre satırıyla eşleşmiş; POS satışları; tahsildeki
// çekler; dönem kilidi.
async function seedBankSide(dataDir, backupDir, data) {
  const server = await bootVersion(CURRENT, { dataDir, backupDir });
  try {
    const db = server.app.db;
    const { eventDigest, eventCopy } = await import("../server/lib/bank/event-copy.mjs");
    insertBankAccount(db, { id: "acc-on", code: "ON-TL", glSub: "102.01" });
    insertPos(db, { id: "pos-on", code: "POS-ON", glSub: "108.01", bankAccountId: "acc-on" });
    const bind = (id, ref) => {
      rawRun(db, "UPDATE account_entries SET fin_ref = ? WHERE id = ?", ref, id);
      rawRun(db, "UPDATE fin_events SET bank_ref = ? WHERE id = ?", ref, eventOf(db, "account_entries", id));
    };
    bind(data.switched.entryId, "acc-on");
    bind(data.locked.entryId, "acc-on");
    bind(data.posPending.entryId, "pos-on");
    bind(data.posSettled.entryId, "pos-on");
    // Eşleşme: edited'ın olayı ekstre satırıyla (özet = kopya).
    const editedEvent = eventOf(db, "account_entries", data.edited.entryId);
    const row = rawGet(db, "SELECT * FROM account_entries WHERE id = ?", data.edited.entryId);
    rawRun(db, "INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES ('match-on', 'line-on', 'acc-on', ?, 50000, ?, 'manual', 'test', ?)", editedEvent, eventDigest(eventCopy(server.app.store, "account_entries", row)), now());
    // POS satışları: bekleyen (kalemi pending) ve bankaya geçmiş (kalemi settled).
    for (const [sale, entry, status, gross] of [["sale-pending", data.posPending.entryId, "pending", 12000], ["sale-settled", data.posSettled.entryId, "settled", 8000]]) {
      rawRun(db, "INSERT INTO pos_sales (id, event_id, pos_id, kind, date, rate_ppm, tax_kind, tax_mode, tax_ppm, refund_commission, payout, bank_account_id, gross_minor, net_minor, created_by, created_at) VALUES (?, ?, 'pos-on', 'sale', ?, 20000, 'bsmv', 'included', 50000, 'none', 'single', 'acc-on', ?, ?, 'test', ?)", sale, eventOf(db, "account_entries", entry), TODAY, gross, gross, now());
      rawRun(db, "INSERT INTO pos_items (id, sale_id, pos_id, seq, role, value_date, gross_minor, net_minor, planned_net_minor, status, created_by, created_at) VALUES (?, ?, 'pos-on', 1, 'sale', ?, ?, ?, ?, ?, 'test', ?)", `${sale}-1`, sale, TODAY, gross, gross, gross, status, now());
    }
    // Tahsildeki çekler (Bankaya Tahsile Ver): her biri kendi işlem başlığıyla.
    data.cheques.forEach((cheque, index) => {
      const id = `col-${index + 1}`;
      rawRun(db, "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, src_id, cheque_id, created_by, created_at) VALUES (?, ?, ?, ?, 'cheque_deposit', ?, 'active', 'manual', 'cheque_collections', ?, ?, 'test', ?)", `ev-${id}`, Number(TODAY.slice(0, 4)), 700000 + index, `BNK-${TODAY.slice(0, 4)}-${700000 + index}`, TODAY, id, cheque.id, now());
      rawRun(db, "INSERT INTO cheque_collections (id, cheque_id, bank_account_id, given_date, status, event_id, created_by, created_at) VALUES (?, ?, 'acc-on', ?, 'pending', ?, 'test', ?)", id, cheque.id, TODAY, `ev-${id}`, now());
    });
    // Kilit: kilitli tahsilattan sonra, bugünden önce.
    const api = await server.login();
    await must("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil: localDay(-10) }));
  } finally {
    await server.close();
  }
}

async function oldVersionWrites(version, dataDir, backupDir, data) {
  const server = await bootVersion(version, { dataDir, backupDir });
  try {
    assert.equal(server.app.store.get("PRAGMA user_version").user_version, 20, `${version} v20 dosyasını açar (göç dönüşü yapar)`);
    const api = await server.login();
    await must(`${version}: Kasa hareketini sil`, api.del(`/api/workspace/cash/${data.deleted.id}?cashForce=1`));
    await must(`${version}: tahsilatı düzelt`, api.put(`/api/workspace/accounts/${data.account.id}/entries/${data.edited.entryId}`, { kind: "in", amount: "550", date: TODAY, method: "bank" }));
    await must(`${version}: havaleyi nakde çevir`, api.put(`/api/workspace/accounts/${data.account.id}/entries/${data.switched.entryId}`, { kind: "in", amount: "300", date: TODAY, method: "cash" }));
    const fresh = await must(`${version}: yeni Kasa hareketi`, api.post("/api/workspace/cash", { kind: "in", amount: "45", date: TODAY, description: "Eski sürümün yeni satırı" }));
    await must(`${version}: POS tahsilatını sil (bekleyen)`, api.del(`/api/workspace/accounts/${data.account.id}/entries/${data.posPending.entryId}`));
    await must(`${version}: POS tahsilatını sil (bankaya geçmiş)`, api.del(`/api/workspace/accounts/${data.account.id}/entries/${data.posSettled.entryId}`));
    const [endorsed, collected, removed] = data.cheques;
    await must(`${version}: tahsildeki çeki ciro et`, api.post(`/api/workspace/cheques/${endorsed.id}/actions`, { action: "endorse", date: TODAY, accountId: data.supplier.id, status: "portfolio" }));
    await must(`${version}: tahsildeki çeki tahsil et`, api.post(`/api/workspace/cheques/${collected.id}/actions`, { action: "collect", date: TODAY, method: "bank", status: "portfolio" }));
    await must(`${version}: tahsildeki çeki sil`, api.del(`/api/workspace/cheques/${removed.id}`));
    return { fresh };
  } finally {
    await server.close();
  }
}

const OLD = ["v2.0.26", "v2.0.25"];
describe("eski sürüme dönüş: gerçek eski kod v20 dosyasına yazar → açılış onarımı (a–h)", () => {
  for (const version of OLD) {
    const skip = tagsAvailable([version]) ? false : `${version} etiketi yok (git fetch --tags)`;
    it(`${version} yazar, bu dal açılınca onarır; yalnız ilgili kayıtlar etkilenir; ikinci açılışta değişiklik yok`, { skip, timeout: 300_000 }, async () => {
      const root = mkdtempSync(path.join(tmpdir(), `onarim-210-${version}-`));
      const dataDir = path.join(root, "data");
      const backupDir = path.join(root, "backups");
      try {
        const data = await prepare(dataDir, backupDir).catch(error => {
          throw new Error(`hazırlık: ${error.message}`);
        });
        await seedBankSide(dataDir, backupDir, data);
        const before = { deletedEvent: null };
        {
          // Silinecek satırın olayı, onarımda iptal edilmeli.
          const server = await bootVersion(CURRENT, { dataDir, backupDir });
          before.deletedEvent = eventOf(server.app.db, "cash_entries", data.deleted.id);
          before.editedEvent = eventOf(server.app.db, "account_entries", data.edited.entryId);
          before.switchedEvent = eventOf(server.app.db, "account_entries", data.switched.entryId);
          before.keepEvent = eventOf(server.app.db, "cash_entries", data.keep.id);
          before.lockedEvent = eventOf(server.app.db, "account_entries", data.locked.entryId);
          before.keepCopy = rawGet(server.app.db, "SELECT * FROM fin_events WHERE id = ?", before.keepEvent);
          await server.close();
        }
        const { fresh } = await oldVersionWrites(version, dataDir, backupDir, data);
        // Kilitli dönemdeki satır elle bozulur (eski sürüm kilide uyar; kilitli satırı o değiştiremez).
        {
          const { DatabaseSync } = await import("node:sqlite");
          const { resolveDbPath } = await import("../server/lib/db-path.mjs");
          const handle = new DatabaseSync(resolveDbPath(dataDir));
          handle.prepare("UPDATE account_entries SET amount = 75 WHERE id = ?").run(data.locked.entryId);
          handle.close();
        }

        const server = await bootVersion(CURRENT, { dataDir, backupDir });
        try {
          const db = server.app.db;
          const event = id => rawGet(db, "SELECT * FROM fin_events WHERE id = ?", id);
          // e
          assert.equal(event(before.deletedEvent).status, "cancelled", "e: satırı silinen olay iptal");
          // b + g
          assert.equal(event(before.editedEvent).amount_minor, 55000, "g: kopya satırdan yenilenir");
          const match = rawGet(db, "SELECT * FROM bank_matches WHERE id = 'match-on'");
          assert.ok(match.undone_at, "b: eşleşme geri alınır");
          assert.equal(match.undo_reason, "eski-surum");
          // f
          const switched = rawGet(db, "SELECT method, fin_ref AS ref FROM account_entries WHERE id = ?", data.switched.entryId);
          assert.deepEqual([switched.method, switched.ref], ["cash", ""], "f: nakde çevrilen satırın hesabı temizlenir (açık dönem)");
          assert.deepEqual([event(before.switchedEvent).method, event(before.switchedEvent).bank_ref], ["cash", ""], "f: kopya da");
          // f/g kilitli kol: satır ve kopya değişmez, onarım bekliyor
          assert.equal(rawGet(db, "SELECT fin_ref AS r FROM account_entries WHERE id = ?", data.locked.entryId).r, "acc-on", "kilitli satırın bağı değişmez");
          assert.equal(event(before.lockedEvent).amount_minor, 7000, "kilitli dönemdeki kopya yenilenmez");
          // a
          assert.equal(eventOf(db, "cash_entries", fresh.id), "", "a: eski sürümün satırına onarım olay yazmaz");
          const repair = JSON.parse(server.app.store.setting("meta.bank.repair", "{}"));
          assert.ok(repair.unassigned >= 2, `a: Hesabı Belirsiz Yeni Hareketler sayısı (yeni Kasa satırı + çek tahsili): ${JSON.stringify(repair)}`);
          assert.ok((repair.pending || []).some(item => item.id === before.lockedEvent), `g (kilitli): Onarım Bekliyor: ${JSON.stringify(repair.pending)}`);
          // c / d
          assert.equal(rawGet(db, "SELECT status FROM pos_sales WHERE id = 'sale-pending'").status, "void", "c: bekleyen POS satışı iptal");
          assert.equal(rawGet(db, "SELECT status FROM pos_items WHERE id = 'sale-pending-1'").status, "void");
          assert.equal(rawGet(db, "SELECT status FROM pos_sales WHERE id = 'sale-settled'").status, "repair", "d: bankaya geçmiş satış Onarım Bekliyor");
          assert.ok((repair.pending || []).some(item => item.id === "sale-settled"), "d: uyarı listesinde");
          // h
          const collections = Object.fromEntries(rawAll(db, "SELECT id, status, closed_date AS closed, close_event_id AS closer FROM cheque_collections").map(row => [row.id, row]));
          assert.equal(collections["col-1"].status, "withdrawn", "h: ciro edilen çek tahsilden düşer");
          assert.equal(collections["col-2"].status, "collected", "h: eski sürümde tahsil edilen çek");
          assert.equal(collections["col-3"].status, "withdrawn", "h: silinen çek tahsilden düşer");
          for (const row of Object.values(collections)) {
            assert.ok(row.closed && row.closer, `h: kapanış tarihi ve işlem başlığı (${row.id})`);
            assert.ok(event(row.closer), `h: kapanış işlem başlığı yazılı (${row.id})`);
          }
          // Dokunulmayan olay aynen
          assert.deepEqual(event(before.keepEvent), before.keepCopy, "ilgisiz olay değişmez");
          // integrity_log + damga
          assert.ok(rawGet(db, "SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'repair'").n >= 1, "onarım günlüğe yazılır");
          assert.ok(server.app.store.setting("meta.bank.repairStamp", ""), "onarım damgası");
          // Yalnız ilgili (eski, engellemeyen) sapmalar; ilgisiz işlem 200
          const api = await server.login();
          const result = (await api.get("/api/workspace/ledger/integrity")).data;
          const blocking = result.failures.filter(item => (item.gateCount ?? item.count ?? 0) > 0 && !String(item.code).startsWith("dates:future") && item.severity !== "warning");
          assert.deepEqual(blocking.map(item => item.code), [], `onarımdan sonra kapıyı engelleyen sapma kalmamalı: ${JSON.stringify(result.failures)}`);
          await must("ilgisiz işlem", api.post("/api/workspace/cash", { kind: "in", amount: "15", date: TODAY, description: "Onarımdan sonra" }));
        } finally {
          await server.close();
        }
        // İkinci açılış: onarım hiçbir şeyi değiştirmez.
        const snapshot = async () => {
          const s = await bootVersion(CURRENT, { dataDir, backupDir });
          try {
            const db = s.app.db;
            return JSON.stringify(["fin_events", "cheque_collections", "pos_sales", "pos_items", "bank_matches", "account_entries", "cash_entries"].map(table => rawAll(db, `SELECT * FROM ${table} ORDER BY rowid`)).concat([rawGet(db, "SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'repair'").n]));
          } finally {
            await s.close();
          }
        };
        assert.equal(await snapshot(), await snapshot(), "onarım tek seferlik (ikinci açılışta değişiklik yok)");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});
