// T6 (f) YEDEK TATBİKATI ve (g) ŞİRKET VERİSİNİ SIFIRLA — GERÇEK program ayrı süreçte, işçi kendi zamanlayıcısıyla; geri yükleme / sıfırlama programın kendi API'sinden
// (Yönetim → Yedekler / Şirket Verisini Sıfırla; parola + şirket kodu onayı). 001'in geri yüklemesi bir sonraki açılışta uygulanır → program yeniden açılır.
// Plan §7a 26 ("Durduruldu (Geri Yükleme)"; geri yüklenen veri eski işleri DİRİLTMEZ), R3 ("Daha Önce Gönderildi": makine defterinden — geri yükleme onu geri
// getirmez/silmez), §6 W2 (24 saat sayacı geri yüklemeyle AZALMAZ). DİKKAT (görev): makine defteri yedekte yok → geri yüklemeden sonra AYNI kişilere ikinci ileti
// gidiyor mu? Sayılar sahte Meta'nın istek kaydından.
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { account, fakeMeta, freshDir, jobStates, ledgerDb, mediaReqs, perRecipient, phoneOf, query, rmrf, startChild, until, wait } from "./ortak.mjs";

const B = "/api/workspace/whatsapp/batches";
const done = (prog, id, ms = 60_000) => until(async () => (await prog.api.get(`${B}/${id}`)).data.data.state !== "running", ms, "toplu iş bitti");
const clockAt = min => new Date(Date.parse("2026-11-03T09:00:00+03:00") + min * 60_000).toISOString();

describe("T6 (f) yedek tatbikatı", () => {
  it("f1 yedek → gönder (4 kişi) → geri yükle → yeniden çalış: R3 dört kişiyi 'Daha Önce Gönderildi' sayar, varsayılan Bunları Çıkar → ikinci ileti YOK; 'Yine de Gönder' seçilirse gider", { timeout: 300_000 }, async () => {
    const fake = await fakeMeta();
    const root = freshDir("f1");
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let prog = await startChild({ dataDir, backupDir, fake, kur: true, gapMs: 200 });
    const r = {};
    try {
      const ids = [];
      for (let i = 0; i < 4; i += 1) ids.push((await account(prog.api, `Yedek ${i}`, phoneOf(9300 + i), 40 + i)).id);
      const backup = await prog.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(backup.status, 200, JSON.stringify(backup.data));
      const name = backup.data.data.backups[0].name;
      const created = await prog.api.post(B, { kind: "statement", ids, preset: "thisMonth", requestId: "t6f-f1-0000001" });
      assert.equal(created.status, 200);
      const id = created.data.data.batch.id;
      await done(prog, id);
      r.gonderim = { ileti: fake.state.messages.length, durumlar: jobStates(dataDir, id) };
      const staged = await prog.api.post("/api/admin/backups/restore", { name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      r.geriYukleme = staged.data.data;
      await prog.stop();
      prog = await startChild({ dataDir, backupDir, fake, gapMs: 200, now: clockAt(10) });
      const list = (await prog.api.get(B)).data.data;
      r.geriYuklemeSonrasiTopluIs = list.length;
      r.defterKabul = query(ledgerDb(dataDir), "SELECT COUNT(*) AS n FROM accepts")[0].n;
      const preview = await prog.api.post(`${B}/preview`, { kind: "statement", ids, preset: "thisMonth" });
      r.onizleme = { status: preview.status, alreadySent: preview.data?.data?.summary?.alreadySent || preview.data?.data?.alreadySent || null };
      const again = await prog.api.post(B, { kind: "statement", ids, preset: "thisMonth", requestId: "t6f-f1-0000002" });
      r.yenidenCalis = { status: again.status, skipped: again.data?.summary?.skipped || again.data?.data?.summary?.skipped || null, error: again.data?.error || "" };
      await wait(3000);
      r.yenidenCalisSonrasiIleti = fake.state.messages.length;
      const forced = await prog.api.post(B, { kind: "statement", ids: ids.slice(0, 1), preset: "thisMonth", requestId: "t6f-f1-0000003", sendAgain: true });
      r.yineDeGonder = { status: forced.status, error: forced.data?.error || "" };
      if (forced.status === 200) await done(prog, forced.data.data.batch.id);
      r.aliciBasina = perRecipient(fake);
      r.stats = (await prog.api.get("/api/workspace/whatsapp/stats")).data.data;
      console.log(`# T6f1 ${JSON.stringify(r)}`);
      assert.equal(r.gonderim.ileti, 4);
      assert.equal(r.geriYuklemeSonrasiTopluIs, 0, "yedekte toplu iş yoktu");
      assert.equal(r.yenidenCalisSonrasiIleti, 4, "geri yüklemeden sonra aynı kişilere kendiliğinden ikinci ileti GİTMEDİ");
    } finally {
      await prog.stop().catch(() => {});
      await fake.close();
      rmrf(root);
    }
  });

  it("f2 gönderim SÜRERKEN yedek → gönderim biter → o yedek geri yüklenir → bekleyen görünen işler 'Durduruldu (Geri Yükleme)', ileti GİTMEZ; sayaç azalmaz", { timeout: 300_000 }, async () => {
    const fake = await fakeMeta({ delayMs: 400 });
    const root = freshDir("f2");
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let prog = await startChild({ dataDir, backupDir, fake, kur: true, gapMs: 300 });
    const r = {};
    try {
      const ids = [];
      for (let i = 0; i < 6; i += 1) ids.push((await account(prog.api, `Sürerken ${i}`, phoneOf(9400 + i), 40 + i)).id);
      const created = await prog.api.post(B, { kind: "statement", ids, preset: "thisMonth", requestId: "t6f-f2-0000001" });
      const id = created.data.data.batch.id;
      await until(() => fake.state.messages.length >= 2, 60_000, "iki ileti");
      const backup = await prog.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(backup.status, 200, JSON.stringify(backup.data));
      r.yedekAniIleti = fake.state.messages.length;
      await done(prog, id, 90_000);
      r.bitinceIleti = fake.state.messages.length;
      const statsBefore = (await prog.api.get("/api/workspace/whatsapp/stats")).data.data;
      const staged = await prog.api.post("/api/admin/backups/restore", { name: backup.data.data.backups[0].name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      await prog.stop();
      prog = await startChild({ dataDir, backupDir, fake, gapMs: 300, now: clockAt(15) });
      await wait(8000);
      const d = (await prog.api.get(`${B}/${id}`)).data.data;
      r.geriYuklenen = { toplu: d.stateLabel, neden: d.pauseReason || d.stopReason || "", isler: d.jobs.map(job => job.state) };
      r.geriYuklemeSonrasiIleti = fake.state.messages.length;
      const statsAfter = (await prog.api.get("/api/workspace/whatsapp/stats")).data.data;
      r.sayac = { once: statsBefore, sonra: statsAfter };
      const again = await prog.api.post(`${B}/preview`, { kind: "statement", ids, preset: "thisMonth" });
      r.r3 = again.data?.data?.summary?.alreadySent || again.data?.data?.alreadySent || again.data;
      r.aliciBasina = perRecipient(fake);
      r.medya = { yukleme: mediaReqs(fake).length, metadaKalan: fake.state.media.size };
      console.log(`# T6f2 ${JSON.stringify(r)}`);
      assert.equal(r.bitinceIleti, 6);
      assert.equal(r.geriYuklemeSonrasiIleti, 6, "geri yüklenen eski işler DİRİLMEDİ");
      assert.equal(d.state, "stopped");
      for (const n of Object.values(r.aliciBasina)) assert.equal(n, 1);
    } finally {
      await prog.stop().catch(() => {});
      await fake.close();
      rmrf(root);
    }
  });
});

describe("T6 (g) Şirket Verisini Sıfırla", () => {
  it("g: toplu gönderim SÜRERKEN (ileti isteği Meta'dayken) sıfırla → sonra ileti GİTMEZ, çift yok, kuyruk boş; yeniden çalış → R3", { timeout: 300_000 }, async () => {
    const fake = await fakeMeta({ delayMs: 700 });
    const root = freshDir("g");
    const dataDir = path.join(root, "data");
    const prog = await startChild({ dataDir, backupDir: path.join(root, "backups"), fake, kur: true, gapMs: 300 });
    const r = {};
    try {
      const ids = [];
      for (let i = 0; i < 6; i += 1) ids.push((await account(prog.api, `Sıfırla ${i}`, phoneOf(9500 + i), 40)).id);
      const created = await prog.api.post(B, { kind: "statement", ids, preset: "thisMonth", requestId: "t6g-g-00000001" });
      const id = created.data.data.batch.id;
      await until(() => fake.state.messages.length >= 2 && fake.requests.filter(item => item.method === "POST" && /\/messages$/.test(item.path)).length > fake.state.messages.length, 60_000, "üçüncü ileti isteği Meta'da");
      const reset = await prog.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
      r.sifirla = { status: reset.status, error: reset.data?.error || "" };
      r.sifirlaAniIleti = fake.state.messages.length;
      await wait(10_000);
      r.sonrakiIleti = fake.state.messages.length;
      r.kuyruk = (await prog.api.get(B)).data.data.length;
      r.isSatiri = query(path.join(dataDir, "destekofis.sqlite"), "SELECT COUNT(*) AS n FROM wa_jobs")[0]?.n;
      r.defter = query(ledgerDb(dataDir), "SELECT event, reason FROM batch_events WHERE batch_id = ?", id);
      r.defterSonuc = query(ledgerDb(dataDir), "SELECT outcome, COUNT(*) AS n FROM outcomes GROUP BY outcome");
      const cari = (await prog.api.get("/api/workspace/accounts")).data;
      r.cariSayisi = Array.isArray(cari?.data) ? cari.data.length : cari?.data?.items?.length ?? null;
      r.aliciBasina = perRecipient(fake);
      r.medya = { yukleme: mediaReqs(fake).length, metadaKalan: fake.state.media.size };
      console.log(`# T6g ${JSON.stringify(r)}`);
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      assert.ok(r.sonrakiIleti <= r.sifirlaAniIleti + 1, "sıfırladıktan sonra en çok Meta'daki istek işlendi");
      for (const n of Object.values(r.aliciBasina)) assert.equal(n, 1);
    } finally {
      await prog.stop().catch(() => {});
      await fake.close();
      rmrf(root);
    }
  });
});
