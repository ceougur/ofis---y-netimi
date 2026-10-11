// 2.0.22 madde 1/2 (Excel denetimi bulgusu, 04.10.2026): yük altında cari notunu düzeltmek ~1 sn sürüyordu; her bilgi
// düzeltmesi bütün defterin mutabakat denetimini çalıştırıyor ve açık her pencereye "para değişti" olayı gönderiyordu.
// Kural: carinin yalnız bilgi kolonlarına (ad, telefon, not, adres, vergi bilgisi…) yazan değişiklik mutabakat kapısını
// tetiklemez ve ANLIK DURUM'u yenilemez; tür, durum, silme ve her hareket yine kapıdan geçer.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createStore } from "../server/lib/db.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = new Date().toISOString().slice(0, 10);

test("veri katmanı: yalnız bilgi kolonuna yazan UPDATE kapıyı tetiklemez; geri kalan her yazma tetikler", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE accounts (id TEXT, name TEXT, phone TEXT, note TEXT, email TEXT, type TEXT, status TEXT, deleted_at TEXT, updated_at TEXT); CREATE TABLE plans (id TEXT, name TEXT); CREATE TABLE notes (id TEXT, body TEXT)");
  db.exec("INSERT INTO accounts (id, name, type, status) VALUES ('a1', 'Ali', 'customer', 'active'); INSERT INTO plans VALUES ('p1', 'Ali')");
  const store = createStore(db);
  let checks = 0;
  store.addCommitGuard({ check: () => (checks += 1) });
  const gate = (label, fn, expected) => {
    const before = checks;
    fn();
    assert.equal(checks - before, expected, `${label}: kapı ${expected ? "çalışmalı" : "çalışmamalı"}`);
  };
  gate("ad + not", () => store.run("UPDATE accounts SET name = ?, note = ?, updated_at = ? WHERE id = ?", "Ali Veli", "not", TODAY, "a1"), 0);
  gate("işlem içinde not", () => store.tx(() => store.run("UPDATE accounts SET note = ? WHERE id = ?", "x", "a1")), 0);
  gate("tırnaklı ve boşluklu kolon", () => store.run('UPDATE "accounts" SET "phone"=? ,  email = ?  WHERE id = ?', "555", "a@b", "a1"), 0);
  gate("tür", () => store.run("UPDATE accounts SET type = ? WHERE id = ?", "supplier", "a1"), 1);
  gate("bilgi + durum", () => store.run("UPDATE accounts SET note = ?, status = ? WHERE id = ?", "y", "passive", "a1"), 1);
  gate("silme işareti", () => store.run("UPDATE accounts SET deleted_at = ? WHERE id = ?", TODAY, "a1"), 1);
  gate("ifade (değer değil)", () => store.run("UPDATE accounts SET note = note || ? WHERE id = ?", "!", "a1"), 1);
  gate("sabit değer", () => store.run("UPDATE accounts SET note = 'z' WHERE id = ?", "a1"), 1);
  gate("alt sorgulu tür", () => store.run("UPDATE accounts SET note = ?, type = (SELECT type FROM accounts WHERE id = ?) WHERE id = ?", "q", "a1", "a1"), 1);
  gate("WHERE'siz toplu", () => store.run("UPDATE accounts SET note = ?", "hepsi"), 1);
  gate("yeni cari", () => store.run("INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)", "a2", "Veli", "customer"), 1);
  gate("cari silme", () => store.run("DELETE FROM accounts WHERE id = ?", "a2"), 1);
  gate("taksit kartı adı (beyaz listede değil)", () => store.run("UPDATE plans SET name = ? WHERE id = ?", "Ali Veli", "p1"), 1);
  gate("bilgi + hareket aynı işlemde", () => store.tx(() => {
    store.run("UPDATE accounts SET note = ? WHERE id = ?", "k", "a1");
    store.run("UPDATE plans SET name = ? WHERE id = ?", "K", "p1");
  }), 1);
  gate("finansal olmayan tablo", () => store.run("UPDATE notes SET body = ? WHERE id = ?", "b", "n1"), 0);
  db.close();
});

test("cari kartı: notu/adresi düzeltmek kapıyı ve ANLIK DURUM yenilemesini tetiklemez; tür ve ad değişikliği tetikler", async () => {
  const server = await startTestServer();
  const controller = new AbortController();
  try {
    const admin = await loginAdmin(server);
    const watcher = await createUser(server, admin, { username: "izleyici1", role: "personel" });
    const data = r => (r.data && "ok" in r.data ? r.data.data : r.data);
    const acc = data(await admin.post("/api/workspace/accounts", { name: "Bilgi Denemesi", type: "customer", phone: "05321112233", openingBalance: 1500 }));
    assert.ok(acc?.id, "cari açıldı");
    assert.equal((await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 400, date: TODAY, method: "cash" })).status, 200);

    let gateRuns = 0;
    server.app.store.addCommitGuard({ check: () => (gateRuns += 1) });

    // Başka personelin ekranı: canlı olayları dinler (işlemi yapana "workspace.changed" gitmez).
    const response = await fetch(`${server.base}/api/events`, { headers: { cookie: watcher.cookie, accept: "text/event-stream" }, signal: controller.signal });
    const reader = response.body.getReader();
    let stream = "";
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          stream += new TextDecoder().decode(value);
        }
      } catch {
        // akış kapatıldı
      }
    })();
    const waitFor = async (pattern, ms = 4000) => {
      const deadline = Date.now() + ms;
      while (!pattern.test(stream) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 40));
      return pattern.test(stream);
    };
    assert.ok(await waitFor(/event: hello/), "olay akışı açıldı");
    // Kurulum yazmalarının (cari, tahsilat) 250 ms'de birleşen olayı gelip geçsin.
    await new Promise(resolve => setTimeout(resolve, 700));
    const events = () => [...stream.matchAll(/event: ([\w.]+)\ndata: (.*)\n/g)].map(([, name, json]) => ({ name, data: JSON.parse(json) }));

    // 1) Yalnız not ve adres: kapı yok, olay "bilgi", ANLIK DURUM yenilemesi yok.
    stream = "";
    let r = await admin.put(`/api/workspace/accounts/${acc.id}`, { ...acc, note: "Yeni not", address: "Kadıköy" });
    assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 200));
    assert.equal(data(r).note, "Yeni not");
    assert.equal(data(r).address, "Kadıköy");
    assert.equal(data(r).type, "customer", "tür aynı");
    assert.equal(data(r).totals.balance, 1100, "bakiye aynı (1.500 açılış − 400 tahsilat)");
    assert.equal(gateRuns, 0, "bilgi düzeltmesi mutabakat kapısını çalıştırmadı");
    assert.ok(await waitFor(/event: workspace\.changed/), "öbür ekrana cari değişti olayı gitti");
    await new Promise(resolve => setTimeout(resolve, 700));
    const infoEvents = events();
    const accountEvent = infoEvents.find(e => e.name === "workspace.changed" && e.data.kind === "accounts");
    assert.equal(accountEvent?.data.info, true, "olay bilgi düzeltmesi olarak işaretli");
    assert.equal(accountEvent?.data.accountId, acc.id);
    assert.ok(!infoEvents.some(e => e.name === "overview.changed"), `ANLIK DURUM ve para pencereleri yenilenmez: ${JSON.stringify(infoEvents)}`);
    assert.ok(!infoEvents.some(e => e.name === "workspace.changed" && e.data.kind === "plans"), "taksit pencereleri yenilenmez");

    // 2) Tür değişikliği: kapıdan geçer, para pencereleri yenilenir.
    stream = "";
    r = await admin.put(`/api/workspace/accounts/${acc.id}`, { ...data(r), type: "supplier" });
    assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 200));
    assert.equal(data(r).type, "supplier");
    assert.equal(data(r).note, "Yeni not", "not korunur");
    assert.ok(gateRuns >= 1, "tür değişikliği mutabakat kapısından geçti");
    assert.ok(await waitFor(/event: overview\.changed/), "tür değişince ANLIK DURUM yenilenir");
    assert.ok(!events().some(e => e.name === "workspace.changed" && e.data.info), "tür değişikliği bilgi sayılmaz");

    // 3) Ad değişikliği taksit kartlarına da yazılır: kapıdan geçer, olay bilgi değil.
    const runsBefore = gateRuns;
    stream = "";
    r = await admin.put(`/api/workspace/accounts/${acc.id}`, { ...data(r), type: "supplier", name: "Bilgi Denemesi Ltd." });
    assert.equal(r.status, 200);
    assert.equal(data(r).name, "Bilgi Denemesi Ltd.");
    assert.ok(gateRuns > runsBefore, "ad değişikliği (taksit kartına yansır) kapıdan geçti");
    assert.ok(await waitFor(/event: overview\.changed/), "ad değişince ANLIK DURUM yenilenir");

    // 4) Durum (pasif) değişikliği de kapıdan geçer.
    const runsBeforeStatus = gateRuns;
    r = await admin.put(`/api/workspace/accounts/${acc.id}`, { ...data(r), status: "passive" });
    assert.equal(r.status, 200);
    assert.equal(data(r).status, "passive");
    assert.ok(gateRuns > runsBeforeStatus, "durum değişikliği kapıdan geçti");

    // Sonuç: defter ve mutabakat sağlam.
    const integrity = data(await admin.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, `mutabakat: ${JSON.stringify(integrity.failures || integrity).slice(0, 300)}`);
    const after = data(await admin.get(`/api/workspace/accounts/${acc.id}`));
    assert.equal(after.totals.balance, 1100, "bakiye hiçbir adımda değişmedi");
    assert.equal(after.entries.length, 2);
    controller.abort();
    await pump;
  } finally {
    controller.abort();
    await server.close();
  }
});
