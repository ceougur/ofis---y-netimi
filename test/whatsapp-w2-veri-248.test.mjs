// 2.4.8 W2 — veri yaşam döngüsü (plan §6 W2 "Program kapanırsa…", §7a 1, 2, 16, 19, 24–26; §8 ÇİFT / ESKİ VERİ / TARİH / GÜVENLİK): "WhatsApp Mesajı İstemiyor" ve
// pasif cari (gönderim ANINDA okunur), YEDEK TATBİKATI (gönderim → yedek → yeni gönderim → geri yükle → işler DİRİLMEZ, sayaç AZALMAZ → yeniden çalış), Şirket Verisini
// Sıfırla, başka bilgisayara taşınan veri, 24 saatten eski toplu iş, salt okunur lisans, "Bu Ay" sayacının ay sınırı (teslim zamanı, Türkiye saati) ve süre dolumu,
// işçinin iletiler arası beklemesi, belirtecin hiçbir çıktıya sızmaması. Gerçek program + yerel sahte Meta (ders 30; aynı el — kâhin değil, ders 5) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const toPhone = digits => `+90${digits}`;
const sentTo = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;
const byName = jobs => Object.fromEntries(jobs.map(job => [job.accountName, job]));
const leaks = value => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return [TOKEN, TOKEN.slice(0, 12), TOKEN.slice(-12)].filter(part => text.includes(part));
};

describe("2.4.8 W2 — WhatsApp Mesajı İstemiyor (accounts.wa_opt_out) ve gönderim anında okuma (§7a 1, 2)", () => {
  it("kuyruktayken işaretlenen / pasife alınan cari gönderim anında elenir, telefonu değişen carinin YENİ numarasına gider; kısmi PUT işareti korur; wa.me yolunda da seçilemez", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Sonradan İstemeyen", "0546 000 00 01", 10);
      const b = await ctx.account("İsteyen", "0546 000 00 02", 10);
      const p = await ctx.account("Sonradan Pasif", "0546 000 00 03", 10);
      const n = await ctx.account("Numarası Değişen", "0546 000 00 04", 10);
      assert.equal(a.waOptOut, 0);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id, p.id, n.id], preset: "thisMonth" })).data.data.batch.id;
      const put = await ctx.api.put(`/api/workspace/accounts/${a.id}`, { ...a, waOptOut: true, updatedAt: a.updatedAt });
      assert.equal(put.status, 200, JSON.stringify(put.data));
      assert.equal(put.data.data.waOptOut, 1);
      assert.equal((await ctx.api.put(`/api/workspace/accounts/${p.id}`, { status: "passive" })).status, 200);
      const moved = await ctx.api.put(`/api/workspace/accounts/${n.id}`, { ...n, phone: "0546 000 00 99", updatedAt: n.updatedAt });
      assert.equal(moved.status, 200);
      await ctx.drain();
      const jobs = byName(await ctx.jobs(id));
      assert.equal(jobs["Sonradan İstemeyen"].state, "skipped");
      assert.equal(jobs["Sonradan İstemeyen"].reason, "WhatsApp Mesajı İstemiyor");
      assert.equal(jobs["Sonradan Pasif"].reason, "Pasif Cari");
      assert.equal(jobs["Numarası Değişen"].phone, toPhone("5460000099"), "gönderim anındaki numara (kayda geçti)");
      assert.equal(sentTo(ctx, toPhone("5460000001")), 0, "işaretli kişiye ileti gitmedi");
      assert.equal(sentTo(ctx, toPhone("5460000003")), 0, "pasif cariye ileti gitmedi");
      assert.equal(sentTo(ctx, toPhone("5460000004")), 0, "eski numaraya gitmedi");
      assert.equal(sentTo(ctx, toPhone("5460000099")), 1);
      assert.equal(sentTo(ctx, toPhone("5460000002")), 1);
      // Kısmi PUT (Pasife Al) işareti silmez.
      const passive = await ctx.api.put(`/api/workspace/accounts/${a.id}`, { status: "passive" });
      assert.equal(passive.status, 200);
      assert.equal(passive.data.data.waOptOut, 1);
      assert.equal(ctx.store.get("SELECT wa_opt_out AS v FROM accounts WHERE id = ?", a.id).v, 1);
      // wa.me (Kendi WhatsApp'ımla) yolu: işaretli cari seçilemez, neden yazılı.
      const targets = (await ctx.api.post("/api/workspace/whatsapp/targets", { ids: [a.id, b.id], kind: "statement", preset: "thisMonth" })).data.data.recipients;
      const ta = targets.find(item => item.id === a.id);
      assert.equal(ta.valid, false);
      assert.equal(ta.reason, "WhatsApp Mesajı İstemiyor");
      assert.equal(ta.optOut, true);
      assert.equal(targets.find(item => item.id === b.id).valid, true);
      const off = await ctx.api.put(`/api/workspace/accounts/${a.id}`, { waOptOut: false });
      assert.equal(off.data.data.waOptOut, 0);
      const audits = ctx.store.all("SELECT payload_json AS p FROM audit_events WHERE type = 'account.updated' AND entity_id = ?", a.id).map(row => JSON.parse(row.p));
      assert.ok(audits.some(item => item.waOptOut === 1 && item.previous?.waOptOut === 0), "işlem geçmişinde işaret değişikliği");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W2 — yedek tatbikatı, sıfırlama, taşınan veri, bayat toplu iş (§7a 24, 26)", () => {
  it("002: gönderim → yedek → yeni gönderim → GERİ YÜKLE → yedekteki eski işler 'Durduruldu (Geri Yükleme)' (DİRİLMEZ), sayaç AZALMAZ → yeniden çalış", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const created = await ctx.api.post("/api/companies", { name: "Tatbikat Şirketi", select: false });
      const second = created.data.data.company || created.data.data;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
      await ctx.api.put(`${URLS.ack}?${q}`, { ack: true });
      await ctx.api.put(`${URLS.sending}?${q}`, { dailyCap: 2 });
      const people = [];
      for (let i = 1; i <= 4; i += 1) people.push((await ctx.api.post(`/api/workspace/accounts?${q}`, { name: `Tatbikat ${i}`, phone: `0547 000 00 0${i}`, openingBalance: "10" })).data.data);
      // Dönem açık tarihlerle (Bu Ay ön ayarı gün değişince yeni dönem olur).
      const period = { from: "2026-11-01", to: "2026-11-03" };
      // 1) İlk gönderim: iki kişi (sınır 2) kabul, ikisi sınırda bekliyor.
      const first = (await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: people.map(item => item.id), ...period })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 2);
      const used = async () => (await ctx.api.post(`${URLS.preview}?${q}`, { kind: "statement", ids: [people[0].id], ...period })).data.data.limit.used;
      // 2) Yedek (bekleyen iki iş yedekte "Sınır Nedeniyle Bekliyor").
      const backup = (await ctx.api.post("/api/admin/backups", { scope: "one", companyId: second.id })).data.data.backups[0].name;
      // 3) Yedekten sonra: pencere açıldı, bekleyenler gitti (toplu iş bitti).
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 4, "bekleyen iki kişi pencere açılınca gitti");
      assert.equal((await ctx.api.get(`${URLS.batches}/${first}?${q}`)).data.data.state, "done");
      assert.equal(await used(), 2, "pencerede 3. ve 4. kişi");
      // 4) GERİ YÜKLE (yedekte toplu iş "running", iki iş "limited").
      const restored = await ctx.api.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      const detail = (await ctx.api.get(`${URLS.batches}/${first}?${q}`)).data.data;
      assert.equal(detail.state, "stopped", "geri yüklenen toplu iş durduruldu");
      assert.match(detail.pauseReason, /Durduruldu \(Geri Yükleme\)/);
      assert.equal(detail.counts.stopped, 2, "yedekte bekleyen iki iş 'Durduruldu'");
      await ctx.drain();
      assert.equal(ctx.messages().length, 4, "geri yüklemeden sonra İKİNCİ ileti yok (işler dirilmedi)");
      assert.equal(await used(), 2, "sınır penceresi geri yüklemeyle boşalmadı (makine defteri)");
      assert.equal((await ctx.api.post(`${URLS.batches}/${first}/resume?${q}`, {})).status, 409, "durdurulan iş sürdürülemez");
      // 5) Yeniden çalış. R3: dördüne de bu dönem gönderildi (makine defteri geri yüklemeyle SİLİNMEDİ) → varsayılan Bunları Çıkar, açık bayrakla Yine de Gönder.
      const removed = await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: people.map(item => item.id), ...period });
      assert.equal(removed.status, 400, "geri yüklemeden sonra da 'Daha Önce Gönderildi'");
      assert.deepEqual(removed.data.summary.skipped, { "Daha Önce Gönderildi": 4 });
      // Yine de Gönder: süre penceresi yok (§7a 9); pencerede sayılmış 3. ve 4. kişi geçer, 1. ve 2. sınırda bekler.
      const again = await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: people.map(item => item.id), ...period, sendAgain: true });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      await ctx.drain();
      assert.equal(ctx.messages().length, 6);
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 8, "pencere açılınca yeniden çalışma tamamlandı");
      assert.equal((await ctx.api.get(`${URLS.batches}/${again.data.data.batch.id}?${q}`)).data.data.state, "done");
    } finally {
      await ctx.close();
    }
  });

  it("002: toplu iş SÜRERKEN (sınırda bekleyen kişiler varken) alınan yedek hemen geri yüklenir → bekleyenler 'Durduruldu (Geri Yükleme)', pencere açılınca da GİTMEZ", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const created = await ctx.api.post("/api/companies", { name: "Süren İş Şirketi", select: false });
      const second = created.data.data.company || created.data.data;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
      await ctx.api.put(`${URLS.ack}?${q}`, { ack: true });
      await ctx.api.put(`${URLS.sending}?${q}`, { dailyCap: 2 });
      const people = [];
      for (let i = 1; i <= 4; i += 1) people.push((await ctx.api.post(`/api/workspace/accounts?${q}`, { name: `Süren ${i}`, phone: `0547 100 00 0${i}`, openingBalance: "10" })).data.data);
      const id = (await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: people.map(item => item.id), from: "2026-11-01", to: "2026-11-03" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "sınır 2: iki kişi gitti, ikisi bekliyor");
      assert.equal(ctx.wa.ledger.batchState(id).live, true, "toplu iş defterde SÜRÜYOR (bitmedi)");
      const backup = (await ctx.api.post("/api/admin/backups", { scope: "one", companyId: second.id })).data.data.backups[0].name;
      const restored = await ctx.api.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      assert.equal(ctx.wa.ledger.batchState(id).live, false, "geri yükleme süren toplu işi defterde durdurdu");
      assert.equal(ctx.wa.ledger.batchState(id).reason, "restored");
      const detail = (await ctx.api.get(`${URLS.batches}/${id}?${q}`)).data.data;
      assert.equal(detail.state, "stopped");
      assert.match(detail.pauseReason, /Durduruldu \(Geri Yükleme\)/);
      assert.equal(detail.counts.stopped, 2, "sınırda bekleyen iki iş durduruldu");
      assert.equal(detail.counts.accepted, 2, "giden iki iletinin kaydı korunur");
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "pencere açıldı; geri yüklenen veri bekleyenleri DİRİLTMEDİ");
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/resume?${q}`, {})).status, 409);
    } finally {
      await ctx.close();
    }
  });

  it("001: geri yükleme bir sonraki açılışta uygulanır (yeniden başlatma) → süren toplu iş 'Durduruldu (Geri Yükleme)', ileti GİTMEZ", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-w2-geri-001-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let ctx = await startWa({ dataDir, backupDir });
    const fake = ctx.fake;
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Ana Şirket ${i}`, `0547 200 00 0${i}`, 10)).id);
      const id = (await ctx.batch({ kind: "statement", ids, from: "2026-11-01", to: "2026-11-03" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1);
      const backup = (await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" })).data.data.backups[0].name;
      const staged = await ctx.api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      assert.equal(staged.data.data.staged, true, "001'in geri yüklemesi açılışta uygulanır");
      await ctx.server.close();
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false });
      assert.equal(ctx.wa.ledger.batchState(id).reason, "restored", "açılışta uygulanan geri yükleme defterde durdurdu");
      const detail = await ctx.detail(id);
      assert.equal(detail.state, "stopped");
      assert.match(detail.pauseReason, /Durduruldu \(Geri Yükleme\)/);
      assert.equal(detail.counts.stopped, 2);
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(fake.state.messages.length, 1, "geri yüklemeden sonra bekleyen kişilere ileti gitmedi");
    } finally {
      await ctx.server.close();
      await fake.close();
      removeTestDir(root);
    }
  });

  it("şirket dosyası program KAPALIYKEN eski bir kopyayla değiştirildi (elle kopya / 'önceki sürümler'): makine defteri kabulü görür, İKİNCİ ileti yok, iş 'Meta Kabul Etti'", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-w2-eski-kopya-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const copy = path.join(root, "kopya");
    let ctx = await startWa({ dataDir, backupDir });
    const fake = ctx.fake;
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 2 });
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Kopya ${i}`, `0547 300 00 0${i}`, 10)).id);
      const id = (await ctx.batch({ kind: "statement", ids, from: "2026-11-01", to: "2026-11-03" })).data.data.batch.id;
      const dbPath = ctx.server.app.config.dbPath;
      await ctx.server.close();
      // Toplu iş açıldı, hiçbir ileti gitmedi: şirket dosyasının bu anki kopyası.
      mkdirSync(copy, { recursive: true });
      const sidecars = file => ["", "-wal", "-shm"].map(suffix => `${file}${suffix}`).filter(item => existsSync(item));
      for (const file of sidecars(dbPath)) cpSync(file, path.join(copy, path.basename(file)));
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false });
      await ctx.drain();
      assert.equal(fake.state.messages.length, 2, "sınır 2: iki ileti gitti");
      const wamids = (await ctx.jobs(id)).filter(job => job.state === "accepted").map(job => job.wamid).sort();
      assert.equal(wamids.length, 2);
      await ctx.server.close();
      // Program kapalıyken şirket dosyası eski kopyayla değiştirilir (toplu iş "Bekliyor", denenmemiş görünür).
      for (const file of sidecars(dbPath)) rmSync(file, { force: true });
      for (const name of readdirSync(copy)) cpSync(path.join(copy, name), path.join(path.dirname(dbPath), name));
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false });
      const before = await ctx.jobs(id);
      assert.equal(before.filter(job => job.state === "pending").length, 3, "eski kopyada üç iş de Bekliyor");
      await ctx.drain();
      assert.equal(fake.state.messages.length, 2, "defterdeki kabul görüldü: ikinci ileti YOK");
      const after = await ctx.jobs(id);
      assert.deepEqual(after.filter(job => job.state === "accepted").map(job => job.wamid).sort(), wamids, "iş defterdeki kabulle (aynı wamid) kapandı");
      assert.equal(after.filter(job => job.state === "limited").length, 1, "üçüncü kişi sınırda bekliyor");
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(fake.state.messages.length, 3, "pencere açılınca üçüncü kişiye BİR ileti");
      assert.equal((await ctx.detail(id)).state, "done");
    } finally {
      await ctx.server.close();
      await fake.close();
      removeTestDir(root);
    }
  });

  it("Şirket Verisini Sıfırla: gönderim kayıtları silinir, süren toplu iş defterde durur (sıfırlanan şirkette dirilmez); defter sayaçları kalır; bir kez onay korunur", async () => {
    const ctx = await startWa();
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const a = await ctx.account("Sıfırlama 1", "0548 000 00 01", 10);
      const b = await ctx.account("Sıfırlama 2", "0548 000 00 02", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1);
      assert.equal(ctx.wa.ledger.batchState(id).live, true);
      const reset = await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs").n, 0);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 0);
      assert.equal(ctx.wa.ledger.batchState(id).live, false);
      assert.equal(ctx.wa.ledger.batchState(id).reason, "reset");
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "sıfırlamadan sonra bekleyen kişiye ileti gitmedi");
      assert.equal((await ctx.api.get(URLS.stats)).data.data.accepted, 1, "defter sayacı kaldı");
      assert.equal((await ctx.api.get(URLS.ack)).data.data.acknowledged, true, "bir kez onay 'whatsapp' önekiyle korunur");
    } finally {
      await ctx.close();
    }
  });

  it("24 saatten eski toplu iş: SINIR nedeniyle bekleyen kendiliğinden sürer, program kapalı kaldığı için bekleyen sorulur; defteri olmadan taşınan veri 'Taşınan Veri — Durduruldu'", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w2-tasima-"));
    const moved = mkdtempSync(path.join(tmpdir(), "destekofis-w2-tasindi-"));
    const ctx = await startWa({ dataDir });
    const fake = ctx.fake;
    let other = null;
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Taşıma ${i}`, `0549 000 00 0${i}`, 10)).id);
      const limitedBatch = (await ctx.batch({ kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1);
      // İkinci toplu iş hiç yürütülmeden program kapanır (bekleyen iş "Bekliyor").
      const lone = await ctx.account("Bayat Kişi", "0549 000 00 09", 10);
      const staleBatch = (await ctx.batch({ kind: "statement", ids: [lone.id], preset: "lastMonth" })).data.data.batch.id;
      await ctx.server.close();
      // (a) Aynı bilgisayar, 25 saat sonra açılış.
      const later = await startWa({ dataDir, fake, connect: false, ack: false, now: { time: "2026-11-04T10:00:00+03:00", fixed: true } });
      try {
        assert.equal((await later.detail(limitedBatch)).state, "running", "sınır nedeniyle bekleyen kendiliğinden sürer");
        const stale = await later.detail(staleBatch);
        assert.equal(stale.state, "paused");
        assert.equal(stale.pauseCode, "stale");
        assert.equal(stale.counts.paused, 1, "bekleyen iş Duraklatıldı");
        await later.drain();
        assert.equal(sentTo(later, toPhone("5490000009")), 0, "bayat toplu iş kendiliğinden sürmedi");
        assert.equal(later.messages().length, 2, "sınırda bekleyen bir kişi (sınır 1) gitti");
      } finally {
        await later.server.close();
      }
      // (b) Veri klasörü defter OLMADAN başka bilgisayara taşındı (makine defteri ana veri klasöründe; şirket dosyasıyla gelmez).
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(moved, name));
      other = await startWa({ dataDir: moved, fake, connect: false, ack: false, now: { time: "2026-11-04T11:00:00+03:00", fixed: true } });
      for (const batchId of [limitedBatch, staleBatch]) {
        const detail = await other.detail(batchId);
        assert.equal(detail.state, "stopped");
        assert.equal(detail.pauseCode, "moved");
        assert.match(detail.pauseReason, /Taşınan Veri — Durduruldu/);
      }
      other.clock.advance(3 * DAY);
      await other.drain();
      assert.equal(other.messages().length, 2, "taşınan veride eski işler gönderilmedi");
    } finally {
      await other?.server.close();
      await fake.close();
      removeTestDir(dataDir);
      removeTestDir(moved);
    }
  });

  it("salt okunur lisans: süren toplu iş 'Lisans Nedeniyle Durdu' (ileti yok), yeni gönderim 403; lisans yeniden yazılabilir olunca kendiliğinden SÜRMEZ (§7a 25)", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w2-lisans-"));
    const ctx = await startWa({ dataDir });
    const fake = ctx.fake;
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const a = await ctx.account("Lisans 1", "0550 000 00 01", 10);
      const b = await ctx.account("Lisans 2", "0550 000 00 02", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1);
      await ctx.server.close();
      const readOnly = await startWa({ dataDir, fake, connect: false, ack: false, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        readOnly.clock.advance(DAY + 60_000);
        await readOnly.drain();
        const detail = await readOnly.detail(id);
        assert.equal(detail.state, "paused");
        assert.equal(detail.pauseCode, "license");
        assert.match(detail.pauseReason, /Lisans Nedeniyle Durdu/);
        assert.equal(readOnly.messages().length, 1, "salt okunurda ileti yok");
        const res = await readOnly.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" });
        assert.equal(res.status, 403);
        assert.equal(res.data.code, "LICENSE_READ_ONLY");
      } finally {
        await readOnly.server.close();
      }
      const licensed = await startWa({ dataDir, fake, connect: false, ack: false, now: { time: "2026-11-05T09:00:00+03:00", fixed: true } });
      try {
        await licensed.drain();
        assert.equal((await licensed.detail(id)).state, "paused", "lisans yazılabilir oldu ama iş kendiliğinden sürmedi");
        assert.equal(licensed.messages().length, 1);
        assert.equal((await licensed.api.post(`${URLS.batches}/${id}/resume`, {})).status, 200);
        await licensed.drain();
        assert.equal(licensed.messages().length, 2, "Devam Et ile sürdü");
      } finally {
        await licensed.server.close();
      }
    } finally {
      await fake.close();
      removeTestDir(dataDir);
    }
  });
});

describe("2.4.8 W2 — 'Bu Ay Gönderilen İleti Sayısı' (§7a 19), süre dolumu (§7a 16) ve işçinin beklemesi", () => {
  it("sayı = TESLİM edilen, ay = teslim zamanı (Türkiye saati), kapsam WABA; 31 Aralık 23:59 kabul / 1 Ocak 00:01 teslim Ocak'a sayılır; sayaç yıl dönümünde sıfırlanmaz", async () => {
    const ctx = await startWa({ now: { time: "2026-12-31T23:58:00+03:00", fixed: true } });
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const a = await ctx.account("Yılsonu", "0551 000 00 01", 10);
      const b = await ctx.account("Yılbaşı", "0551 000 00 02", 10);
      await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      await ctx.drain();
      const wamid = ctx.messages()[0].wamid;
      const at = iso => Math.floor(Date.parse(iso) / 1000);
      // Meta "sent" 23:59 (Aralık), "delivered" 00:01 (Ocak; Türkiye saati).
      ctx.statuses([{ id: wamid, status: "sent", timestamp: String(at("2026-12-31T23:59:00+03:00")), recipient_id: "905510000001" }]);
      ctx.clock.set("2027-01-01T00:01:30+03:00");
      ctx.statuses([{ id: wamid, status: "delivered", timestamp: String(at("2027-01-01T00:01:00+03:00")), recipient_id: "905510000001", pricing: { billable: true, category: "utility", pricing_model: "PMP", type: "regular" } }]);
      const dec = (await ctx.api.get(`${URLS.stats}?month=2026-12`)).data.data;
      const jan = (await ctx.api.get(`${URLS.stats}?month=2027-01`)).data.data;
      assert.equal(dec.delivered, 0, "Aralık'ta teslim yok");
      assert.equal(dec.accepted, 1, "kabul Aralık'ta");
      assert.equal(jan.delivered, 1, "teslim Ocak'ta (Türkiye saati)");
      assert.equal(jan.billable, 1);
      assert.equal(jan.approxUsd, 0.0009);
      assert.equal((await ctx.api.get(URLS.stats)).data.data.month, "2027-01", "varsayılan: içinde bulunulan ay (Türkiye saati)");
      // Sınır 1, pencerede bir kişi var: yeni kişi yılbaşında da bekler (kayan 24 saat).
      const id = (await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.detail(id)).counts.limited, 1, "1 Ocak 00:01'de sayaç sıfırlanmadı");
      // Kendime Deneme Gönder sayılmaz.
      await ctx.api.post(`${URLS.conn}/self-test`, { to: "05321112233" });
      assert.equal((await ctx.api.get(`${URLS.stats}?month=2027-01`)).data.data.delivered, 1);
    } finally {
      await ctx.close();
    }
  });

  it("durum bildirimi yolu çalışıyorsa teslim olmayan ileti TTL (3 gün) + 1 saatte 'Süresi Doldu'; yol hiç çalışmadıysa 'Meta Kabul Etti'de kalır (Durum Bilinmiyor YOK); geç gelen teslim yazılır", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("TTL Bildirimsiz", "0556 000 00 01", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      ctx.clock.advance(8 * DAY);
      await ctx.drain();
      assert.equal((await ctx.detail(id)).jobs[0].state, "accepted", "bildirim yolu yok: Meta Kabul Etti'de kalır");
      const b = await ctx.account("TTL Bildirimli", "0556 000 00 02", 10);
      const id2 = (await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      const wamid = ctx.messages().at(-1).wamid;
      ctx.statuses([{ id: wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
      ctx.clock.advance(72 * HOUR + 30 * 60_000);
      await ctx.drain();
      assert.equal((await ctx.detail(id2)).jobs[0].state, "sent", "TTL + 1 saat dolmadı");
      ctx.clock.advance(31 * 60_000);
      await ctx.drain();
      const job = (await ctx.detail(id2)).jobs[0];
      assert.equal(job.state, "expired");
      assert.equal(job.stateLabel, "Süresi Doldu");
      ctx.statuses([{ id: wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
      assert.equal((await ctx.detail(id2)).jobs[0].state, "delivered", "Süresi Doldu'dan sonra gelen teslim gerçek bilgidir (§7a 17)");
      ctx.statuses([{ id: wamid, status: "failed", errors: [{ code: 131026 }] }]);
      assert.equal((await ctx.detail(id2)).jobs[0].state, "delivered", "teslimden sonra gelen failed yok sayılır (§7a 18)");
    } finally {
      await ctx.close();
    }
  });

  it("işçi (gerçek zamanlayıcı): iki iş ASLA aynı anda yürümez, iletiler arası en az gapMs; şirketler dönüşümlü", async () => {
    const log = [];
    let active = 0;
    let maxActive = 0;
    const queue = name => {
      let left = 3;
      return {
        async step() {
          if (!left) return { did: false, waitMs: null };
          left -= 1;
          active += 1;
          maxActive = Math.max(maxActive, active);
          log.push({ name, at: Date.now() });
          await new Promise(resolve => setTimeout(resolve, 20));
          active -= 1;
          return { did: true };
        },
        async maintain() {},
      };
    };
    // Modül bu testin içinde yüklenir: eski kodda (modül yok) yalnız bu test düşer, dosyanın öbür testleri kendi nedenleriyle koşar (ders 38).
    const { createWaScheduler } = await import("../server/lib/whatsapp/scheduler.mjs");
    const scheduler = createWaScheduler({ gapMs: 120, idleMs: 1000, maintainMs: 60_000 });
    try {
      scheduler.register("001", queue("001"));
      scheduler.register("002", queue("002"));
      scheduler.start();
      const end = Date.now() + 5000;
      while (log.length < 6 && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25));
      assert.equal(log.length, 6);
      assert.equal(maxActive, 1, "tek işçi");
      for (let i = 1; i < log.length; i += 1) assert.ok(log[i].at - log[i - 1].at >= 120 + 15, `iletiler arası bekleme (${log[i].at - log[i - 1].at} ms)`);
      assert.deepEqual(log.slice(0, 4).map(item => item.name), ["001", "002", "001", "002"], "şirketler dönüşümlü");
    } finally {
      await scheduler.stop();
    }
  });
});

describe("2.4.8 W2 — belirteç hiçbir çıktıya sızmaz", () => {
  it("toplu gönderim, hata ve durum uçlarının yanıtları, işlem geçmişi, günlük, şirket dosyası ve makine defteri belirteci taşımaz", async () => {
    const lines = [];
    const write = level => (message, meta) => lines.push(`${level} ${message} ${meta instanceof Error ? meta.stack : JSON.stringify(meta ?? "")}`);
    const ctx = await startWa({ log: { debug: write("debug"), info: write("info"), warn: write("warn"), error: write("error") } });
    try {
      ctx.fake.state.echoToken = true;
      const a = await ctx.account("Sızıntı", "0552 000 00 01", 10);
      const responses = [];
      responses.push((await ctx.api.post(URLS.preview, { kind: "statement", ids: [a.id], preset: "thisMonth" })).data);
      const created = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      responses.push(created.data);
      // Belirteç geçersiz → Meta 190 metni belirteci yankılar (sahte sunucu echoToken) → program metni arındırır.
      ctx.fake.state.token = "BASKA-BELIRTEC";
      await ctx.drain();
      responses.push((await ctx.api.get(`${URLS.batches}/${created.data.data.batch.id}`)).data, (await ctx.api.get(URLS.batches)).data, (await ctx.api.get(URLS.stats)).data);
      assert.deepEqual(leaks(responses), [], "yanıtlarda belirteç yok");
      assert.deepEqual(leaks(lines.join("\n")), [], "günlükte belirteç yok");
      assert.deepEqual(leaks(ctx.store.all("SELECT payload_json FROM audit_events")), [], "işlem geçmişinde belirteç yok");
      assert.deepEqual(leaks(ctx.store.all("SELECT * FROM wa_jobs")), [], "iş kayıtlarında belirteç yok");
      assert.deepEqual(leaks(readFileSync(ctx.wa.ledger.file).toString("latin1")), [], "makine defterinde belirteç yok");
      const detail = await ctx.detail(created.data.data.batch.id);
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "meta-token");
    } finally {
      await ctx.close();
    }
  });
});
