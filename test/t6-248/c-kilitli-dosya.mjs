// T6 (c) — KİLİTLİ DOSYA. GERÇEK program ayrı süreçte gönderirken başka bir süreç (bu test) dosyayı yazmaya kilitler (SQLite BEGIN EXCLUSIVE — yedekleme / virüs
// tarayıcı / ikinci kurulumun tuttuğu dosyanın Linux karşılığı). c1: şirket dosyası 25 sn kilitli; c2: makine defteri (whatsapp-gonderim.sqlite) 25 sn kilitli
// (plan §6 W2: "defter yazılamadı → istek GÖNDERİLMEZ, iş bekler"). Ölçülen: kilit sürerken giden ileti, programın HTTP yanıt süresi (busy_timeout 10 sn olay
// döngüsünü tutar mı), işçi hataları; kilit kalkınca toparlanma ve çift ileti.
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { account, companyDb, fakeMeta, freshDir, jobStates, ledgerDb, messageReqs, perRecipient, phoneOf, rmrf, startChild, until, wait } from "./ortak.mjs";

async function kilit(label, fileOf) {
  const fake = await fakeMeta({ delayMs: 100 });
  const root = freshDir(`c-${label}`);
  const dataDir = path.join(root, "data");
  const prog = await startChild({ dataDir, backupDir: path.join(root, "backups"), fake, kur: true, gapMs: 300 });
  const r = { label };
  let db = null;
  try {
    const ids = [];
    for (let i = 0; i < 6; i += 1) ids.push((await account(prog.api, `Kilit ${label} ${i}`, phoneOf(9000 + i + (label === "c2" ? 50 : 0)), 12)).id);
    const created = await prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: `t6c-${label}-000001` });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const id = created.data.data.batch.id;
    await until(() => fake.state.messages.length >= 2, 30_000, "iki ileti");
    db = new DatabaseSync(fileOf(dataDir));
    db.exec("PRAGMA busy_timeout = 5000; BEGIN EXCLUSIVE");
    const lockAt = Date.now();
    r.kilitAniIleti = fake.state.messages.length;
    const logAt = prog.log().length;
    // Kilit sürerken programın yanıt süresi (Toplu Gönderim ekranı yenilenir).
    const yanit = [];
    while (Date.now() - lockAt < 25_000) {
      const t = Date.now();
      const res = await prog.api.get(`/api/workspace/whatsapp/batches/${id}`).catch(error => ({ status: 0, error: error.message }));
      yanit.push({ ms: Date.now() - t, status: res.status });
      await wait(1000);
    }
    r.kilitteIleti = fake.state.messages.length - r.kilitAniIleti;
    r.kilitteMesajIstegi = messageReqs(fake).length;
    r.yanitSuresiMs = { enCok: Math.max(...yanit.map(item => item.ms)), ortanca: yanit.map(item => item.ms).sort((a, b) => a - b)[Math.floor(yanit.length / 2)], basarisiz: yanit.filter(item => item.status !== 200).length, adet: yanit.length };
    const kilitte = prog.log().slice(logAt);
    r.kilitteGunluk = [...new Set(kilitte.split("\n").filter(line => /WARN|ERROR/.test(line)).map(line => line.replace(/^\S+ /, "").slice(0, 200)))].slice(0, 6);
    r.kilitteDurumlar = jobStates(dataDir, id);
    db.exec("ROLLBACK");
    db.close();
    db = null;
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${id}`)).data.data.state !== "running", 150_000, "kilit kalkınca bitti").catch(error => (r.bitmedi = error.message));
    const d = (await prog.api.get(`/api/workspace/whatsapp/batches/${id}`)).data.data;
    r.son = { toplu: d.stateLabel, neden: d.pauseReason || "", isler: d.jobs.map(job => job.state), aliciBasina: Object.values(perRecipient(fake)) };
    console.log(`# T6c ${JSON.stringify(r)}`);
    for (const n of r.son.aliciBasina) assert.ok(n <= 1, "çift ileti");
    return r;
  } finally {
    try {
      db?.exec("ROLLBACK");
      db?.close();
    } catch {
      // kilit zaten kalktı
    }
    await prog.stop().catch(() => {});
    await fake.close();
    rmrf(root);
  }
}

describe("T6 (c) — kilitli dosya", () => {
  it("c1: şirket dosyası gönderim sürerken 25 sn kilitli", { timeout: 300_000 }, async () => {
    await kilit("c1", companyDb);
  });
  it("c2: makine defteri (whatsapp-gonderim.sqlite) gönderim sürerken 25 sn kilitli → kilitteyken ileti GİTMEZ", { timeout: 300_000 }, async () => {
    const r = await kilit("c2", ledgerDb);
    assert.equal(r.kilitteIleti, 0, "defter yazılamazken ileti gitmedi");
  });
});
