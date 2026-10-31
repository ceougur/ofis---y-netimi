// 2.4.8 İş R1 (dar kontrol 12 ORTA, gerileme afa3fc01) + R2: kapanan şirket uygulamasının İş P1 yeniden deneme zamanlayıcıları (belge temizliği, sohbet arşivi)
// kapalı veri tabanında kısa sınama yapıp yakalanmamış istisnayla süreci düşürüyordu (server.mjs bütün şirketleri yeniden başlatır). Şimdi: zamanlayıcılar kapanışta
// silinir; kısa sınama kapalı bağlantıda fırlatmaz (PROBE_CLOSED — kilit DEĞİL: işaret konmaz, ekranda not yanmaz). Geri yüklemeden sonra yeni uygulama örneğinin
// kilit işareti eskisinden bağımsızdır (iş hemen gider, not yok).
// Düzenek: gerçek program; kilit ayrı bağlantıyla (gerçek SQLite kilidi; gerçek saat — belge temizliği açılıştan 5 sn, sohbet arşivi 20 sn sonra; işaret süresi testte
// 1 sn). Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const uncaught = [];
const onUncaught = error => uncaught.push(`${error?.code || ""} ${error?.message || error}`);
before(() => process.on("uncaughtException", onUncaught));
after(() => process.off("uncaughtException", onUncaught));
const lockFile = file => {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
  return () => {
    try {
      db.exec("ROLLBACK");
      db.close();
    } catch {
      // zaten kalktı
    }
  };
};
async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 İş R1 — kapanan şirketin yeniden deneme zamanlayıcıları süreci düşürmez", () => {
  it("belge temizliği kilitte yeniden denemeye kaldı → uygulama kapanır → zamanlayıcı ateşlenmez, yakalanmamış istisna yok", { timeout: 60_000 }, async () => {
    const start = uncaught.length;
    const server = await startTestServer({ __testWriteLockBackoffMs: 1_000 });
    const release = lockFile(server.app.config.dbPath);
    try {
      await wait(5_400); // belge temizliği 5. sn'de kilidi görür → 1 sn sonra yeniden deneme kurulur
    } finally {
      release();
    }
    await server.close();
    await wait(1_500); // yeniden deneme anı geçti
    assert.deepEqual(uncaught.slice(start), [], "kapanıştan sonra yakalanmamış istisna yok");
  });

  it("sohbet arşivi kilitte yeniden denemeye kaldı → uygulama kapanır → yakalanmamış istisna yok", { timeout: 60_000 }, async () => {
    const start = uncaught.length;
    const server = await startTestServer({ __testWriteLockBackoffMs: 1_000 });
    await wait(19_000);
    const release = lockFile(server.app.config.dbPath);
    try {
      await wait(1_400); // sohbet arşivi 20. sn'de kilidi görür → 1 sn sonra yeniden deneme
    } finally {
      release();
    }
    await server.close();
    await wait(1_500);
    assert.deepEqual(uncaught.slice(start), [], "kapanıştan sonra yakalanmamış istisna yok");
  });

  it("iki şirket: 002'nin belge temizliği kilitte → 002 silinir → ortak süreçte yakalanmamış istisna yok, ortak katman yanıt verir", { timeout: 60_000 }, async () => {
    const start = uncaught.length;
    const server = await startTestServer({ __testWriteLockBackoffMs: 1_000 });
    try {
      const api = await loginAdmin(server);
      const created = await ok(await api.post("/api/companies", { name: "İkinci Şirket", select: false }), "ikinci şirket");
      const company = created.company || created;
      const release = lockFile(path.join(server.app.config.dataDir, "sirketler", company.code, "destekofis.sqlite"));
      try {
        await wait(5_400);
      } finally {
        release();
      }
      const del = await api.raw("DELETE", `/api/companies/${company.id}`, { body: JSON.stringify({ confirm: company.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
      assert.equal(del.status, 200, `şirket silindi (${del.status} ${del.text || ""})`);
      await wait(1_500);
      assert.deepEqual(uncaught.slice(start), [], "silinen şirketin zamanlayıcısı süreci düşürmedi");
      assert.equal((await api.get("/api/companies")).status, 200, "ortak katman yanıt verir");
    } finally {
      await server.close();
    }
  });

  it("geri yüklemeden sonra yeni uygulama örneğinin kilit işareti eskisinden bağımsız: yeni gönderim hemen gider, ekranda kilit notu yok", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: { time: new Date(2026, 10, 3, 10, 0, 0, 0).toISOString(), fixed: true } });
    try {
      const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
      const company = created.company || created;
      const q = `hofCompany=${encodeURIComponent(company.id)}`;
      await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
      await ok(await ctx.api.put(`${URLS.ack}?${q}`, { ack: true }), "onay");
      const p = await ok(await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "cari");
      const backup = (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name;
      const o = await ok(await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [p.id], preset: "thisMonth" }), "gönderim");
      const release = lockFile(path.join(ctx.server.app.config.dataDir, "sirketler", company.code, "destekofis.sqlite"));
      try {
        await ctx.wa.scheduler.runOnce();
        const view = (await ctx.api.get(`${URLS.batches}/${o.batch.id}?${q}`)).data.data;
        assert.ok(view.lockNote, `ön koşul: eski örnekte kilit notu var (${view.lockNote})`);
      } finally {
        release();
      }
      assert.equal(ctx.messages().length, 0, "ön koşul: kilitte ileti gitmedi");
      await ok(await ctx.api.post("/api/admin/backups/restore", { name: backup, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }), "geri yükleme");
      const fresh = await ok(await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [p.id], preset: "thisMonth" }), "yeni örnekte gönderim");
      await ctx.wa.scheduler.runOnce();
      assert.equal(ctx.messages().length, 1, "yeni örnekte iş hemen gitti (eski örneğin 30 sn işareti susturmadı)");
      const view = (await ctx.api.get(`${URLS.batches}/${fresh.batch.id}?${q}`)).data.data;
      assert.ok(!view.lockNote, "yeni örnekte kilit notu yok");
    } finally {
      await ctx.close();
    }
  });
});
