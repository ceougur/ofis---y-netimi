// 2.4.8 W4 — gönderim ekranının sunucu ekleri (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W4, §7a 28–29, R3):
//   (1) GET /api/workspace/whatsapp/sending-status: cari ekranının WhatsApp penceresi hangi yolu açacak (bağlantı yok → bugünkü wa.me yolu; bağlı + sınanmış + şablon
//       hazır → Otomatik Gönder varsayılan). accounts.view; gizli değer YOK; Meta'ya istek YOK; yetki / lisans / sınama nedenleri ayrı alanlarda.
//   (2) Önizleme onaydan ÖNCE görülür (BAŞ MİMAR KARARI): kaç kişiye gideceği, elenenler; başlatma engeli (onay → firma adı) yanıtta `startBlock`; toplu iş açma
//       yine reddeder (plan §1: onay kutusu işaretlenmeden gönderim BAŞLAMAZ).
// Ortam: GERÇEK program + yerel sahte Meta (test/whatsapp-sahte-graph.mjs; ders 30), sahte saat (ders 13). Beklenen değerler plandan ve testin girdiği veriden.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createUser, removeTestDir } from "./helpers.mjs";
import { OFFICE, PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const STATUS = "/api/workspace/whatsapp/sending-status";

describe("2.4.8 W4 — gönderim ekranının durumu (sending-status)", () => {
  it("bağlantı yok → configured false (pencere bugünkü wa.me yolunu açar); bağlı ama sınanmamış → neden; sınandı + şablon denetlendi → hazır; yetkisiz kişi canSend false; gizli değer yok; Meta'ya istek yok", async () => {
    const ctx = await startWa({ connect: false, ack: false });
    try {
      const staff = await createUser(ctx.server, ctx.api, { username: "w4-personel", role: "personel" });
      let res = await ctx.api.get(STATUS);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.data.configured, false);
      assert.equal(res.data.data.canSend, true, "yönetici gönderebilir");
      assert.equal(res.data.data.writable, true);
      assert.equal((await staff.get(STATUS)).data.data.configured, false);
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      ctx.fake.requests.length = 0;
      res = await ctx.api.get(STATUS);
      const unchecked = res.data.data;
      assert.equal(unchecked.configured, true);
      assert.equal(unchecked.tested, false);
      assert.match(unchecked.linkBlock, /henüz sınanmadı/);
      assert.equal(unchecked.templates.statement?.usable ?? false, false, "şablon denetlenmeden hazır sayılmaz");
      assert.equal(unchecked.ack.acknowledged, false);
      assert.equal(unchecked.stats.configured, true);
      assert.equal(unchecked.stats.delivered, 0);
      assert.equal(ctx.fake.requests.length, 0, "durum ucu Meta'ya istek atmaz");
      // Sına + Şablonları Denetle (sahte Meta'da iki şablon onaylı) → hazır.
      assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 200);
      assert.equal((await ctx.api.post("/api/workspace/whatsapp/templates/ensure", {})).status, 200);
      ctx.fake.requests.length = 0;
      res = await ctx.api.get(STATUS);
      const ready = res.data.data;
      assert.equal(ready.tested, true);
      assert.equal(ready.linkBlock, "");
      assert.equal(ready.templates.statement.usable, true);
      assert.equal(ready.templates.reminder.usable, true);
      assert.equal(ready.templates.statement.name, "destekofis_ekstre");
      assert.equal(ctx.fake.requests.length, 0);
      const raw = JSON.stringify(ready);
      assert.ok(!raw.includes(TOKEN) && !raw.includes(TOKEN.slice(-12)), "belirteç yanıtta yok");
      // Yetkisiz kişi (whatsapp.send yok): bağlantının varlığını görür, gönderemez; onay / sayaç / süren işler ona verilmez.
      const theirs = (await staff.get(STATUS)).data.data;
      assert.equal(theirs.configured, true);
      assert.equal(theirs.canSend, false);
      assert.equal(theirs.canManage, false);
      assert.equal(theirs.ack, undefined);
      assert.equal(theirs.stats, undefined);
      assert.equal(theirs.active, undefined);
      // Süren gönderim listede (sayfa yenilenince / başka sekmede ekran buradan bulur).
      assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const created = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth", requestId: "w4-durum-0001" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const active = (await ctx.api.get(STATUS)).data.data.active;
      assert.equal(active.length, 1);
      assert.equal(active[0].id, created.data.data.batch.id);
      assert.equal(active[0].stateLabel, "Sürüyor");
      await ctx.drain();
      assert.equal((await ctx.api.get(STATUS)).data.data.active.length, 0, "biten gönderim süren listesinden çıkar");
    } finally {
      await ctx.close();
    }
  });

  it("salt okunur lisans: durum okunur, writable false (ekran Gönder'i nedeniyle pasif bırakır)", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w4-saltokunur-"));
    try {
      const first = await startWa({ dataDir });
      await first.close();
      const ctx = await startWa({ dataDir, connect: false, ack: false, office: null, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        const info = (await ctx.api.get(STATUS)).data.data;
        assert.equal(info.configured, true);
        assert.equal(info.writable, false);
        const preview = await ctx.api.post(URLS.preview, { kind: "statement", ids: ["x"], preset: "thisMonth" });
        assert.equal(preview.status, 403);
        assert.equal(preview.data.code, "LICENSE_READ_ONLY");
      } finally {
        await ctx.close();
      }
    } finally {
      removeTestDir(dataDir);
    }
  });
});

describe("2.4.8 W4 — önizleme onaydan önce; gönderim onaysız başlamaz", () => {
  it("onaysız: önizleme 200 + startBlock (onay), kişiler sayılır; toplu iş 409 ve kayıt yok; firma adı yoksa startBlock firma adı; onaylı + firma adı → startBlock null", async () => {
    const ctx = await startWa({ ack: false, office: "" });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Telefonsuz Cari", "", 300);
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      let preview = await ctx.api.post(URLS.preview, body);
      assert.equal(preview.status, 200, JSON.stringify(preview.data));
      assert.equal(preview.data.data.startBlock.code, "whatsapp-ack-required");
      assert.match(preview.data.data.startBlock.message, /Aydınlatma metnimi okudum, carilerime ulaştıracağım\./);
      assert.equal(preview.data.data.ack.acknowledged, false);
      assert.equal(preview.data.data.total, 2);
      assert.equal(preview.data.data.sendable, 1);
      assert.deepEqual(preview.data.data.skipped, { "Telefon yok": 1 });
      const refused = await ctx.batch({ ...body, requestId: "w4-onaysiz-001" });
      assert.equal(refused.status, 409);
      assert.equal(refused.data.code, "whatsapp-ack-required");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 0, "onaysız toplu iş açılmadı");
      assert.equal(ctx.messageRequests().length, 0);
      assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      preview = await ctx.api.post(URLS.preview, body);
      assert.equal(preview.data.data.startBlock.code, "whatsapp-office-missing", "onaydan sonra sıradaki engel firma adı");
      assert.equal((await ctx.batch({ ...body, requestId: "w4-onaysiz-002" })).data.code, "whatsapp-office-missing");
      ctx.store.setSetting("office.name", OFFICE);
      preview = await ctx.api.post(URLS.preview, body);
      assert.equal(preview.data.data.startBlock, null);
      assert.equal(preview.data.data.ack.acknowledged, true);
      const created = await ctx.batch({ ...body, requestId: "w4-onaysiz-003" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
    } finally {
      await ctx.close();
    }
  });
});
