// 2.5.0 BS-3 ailesi — CARİ HAREKETİ DÜZELTME YARIŞI (docs/2.5.0-IS-LISTESI.md E "05.11 21:22 BS-2 / BS-3 / BS-4 AJANI BİTTİ" GÖZLEMLER (a); gözlem betiği
// docs/kanit/2026-11-05/bs234/gozlem-cari-duzeltme-yaris.mjs). PUT /api/workspace/accounts/:id/entries/:entryId gövde yoldayken hareket silinirse yanıt 200'dü:
// UPDATE 0 satır yazıyor, Değişiklik Geçmişi'ne silinmiş hareket için "account.entry.updated" satırı düşüyordu; kullanıcı düzelttiğini sanıyordu.
// BAŞ MİMAR KARARI (iş listesi E): BS-3 ile aynı desen — isteğin başındaki okuma yazım işleminin İÇİNDE (bank.post prepare, istek kimliği bakışından sonra)
// yinelenir → 404 "Hareket bulunamadı. Başka biri silmiş olabilir." (accounts.mjs entryOf'un mevcut iletisi; plans.mjs tahsilat düzeltmesiyle aynı).
// Hiçbir tablo yazılmaz: yanıttan sonra BÜTÜN tabloların satır sayısı ve içeriği silmeden hemen sonraki hâliyle aynı (ders 3); cari bakiyesi değişmez.
// Yarış zorla üretilir (ders 20): başlıklar gider, gövde bekletilir; bu arada hareket silinir (ön koşulun GERÇEKTEN oluştuğu okunur), sonra gövde gönderilir.
// Eski kodda (8e27f96a) beklenen kırmızı (ders 38): "yazım reddedilmeli (404) — yanıt 200" + değişen tablo audit_events.
// Sahte saat (ders 13); lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { boot, must, apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const GONE = "Hareket bulunamadı. Başka biri silmiş olabilir.";

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` (hareketi silme) koşar, sonra gövde gönderilir. */
async function raceWrite(ctx, { path, body, during, cookie = ctx.api.client.cookie }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let removed = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "PUT", path, headers: { cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      try {
        removed = await during();
      } catch (error) {
        removed = { status: 0, error };
      }
      req.end(text);
    }, 300);
  });
  return { reply, removed };
}

describe("2.5.0 BS-3 ailesi — cari hareketi düzeltmesi: gövde yoldayken hareket silinirse 404 + ileti; hiçbir tablo yazılmaz", () => {
  let ctx;
  let item;
  before(async () => {
    ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
    item = await must("hizmet", ctx.api.post("/api/workspace/stock", { kind: "service", code: "HZM-250Y", name: "Yarış Hizmeti", unit: "Adet", salePrice: "1000" }));
  });
  after(async () => ctx?.server.close());

  // Bütün tabloların satır sayısı ve içerik özeti (sqlite_master; tablo eklense de kapsar).
  const snapshot = () => {
    const out = {};
    for (const { name } of ctx.store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
      const rows = ctx.store.all(`SELECT * FROM "${name}"`).map(row => JSON.stringify(row)).sort();
      out[name] = `${rows.length}:${createHash("sha256").update(rows.join("\n")).digest("hex").slice(0, 16)}`;
    }
    return out;
  };
  const diff = (before, after) => Object.keys({ ...before, ...after }).filter(key => before[key] !== after[key]).map(key => `${key} ${before[key] ?? "YOK"} → ${after[key] ?? "YOK"}`);
  const card = async id => must("cari kartı", ctx.api.get(`${ACC}/${id}`));
  const entryGone = id => !ctx.store.get("SELECT 1 AS x FROM account_entries WHERE id = ?", id);
  const updatedAudits = id => ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.entry.updated' AND entity_id = ?", id).n;

  // Ortak denetim: ön koşul (hareket gövde beklenirken silindi), tablolar silmeden hemen sonraki hâliyle aynı, yanıt 404 + ileti, bakiye silmeden sonraki gibi.
  const assertRefused = async (label, { reply, removed }, { entryId, accountId, before, balance }) => {
    assert.equal(removed?.status, 200, `${label}: ön koşul — hareket gövde beklenirken silindi (${removed?.status} ${JSON.stringify(removed?.data || removed?.error?.message || "").slice(0, 160)})`);
    assert.equal(entryGone(entryId), true, `${label}: ön koşul — hareket veri tabanında yok`);
    const problems = [];
    if (reply.status !== 404) problems.push(`yazım reddedilmeli (404) — yanıt ${reply.status} ${reply.text.slice(0, 160)}`);
    const error = (() => {
      try {
        return JSON.parse(reply.text).error;
      } catch {
        return reply.text;
      }
    })();
    if (error !== GONE) problems.push(`ileti “${error}” (beklenen “${GONE}”)`);
    const changed = diff(before, snapshot());
    if (changed.length) problems.push(`hiçbir tablo yazılmamalı — değişen: ${changed.join("; ")}`);
    if (updatedAudits(entryId)) problems.push(`silinmiş hareket için "account.entry.updated" geçmiş satırı: ${updatedAudits(entryId)}`);
    const after = (await card(accountId)).totals.balance;
    if (after !== balance) problems.push(`cari bakiyesi ${after} (silmeden sonra ${balance})`);
    assert.deepEqual(problems, [], `${label}: ${problems.join(" | ")}`);
  };

  // Hareketi gövde yoldayken siler; silmeden hemen sonraki tablo özeti ve bakiye okunur.
  const raceDelete = async (api, account, entryId, body, { cookie } = {}) => {
    const state = { before: null, balance: null };
    const race = await raceWrite(ctx, {
      path: `${ACC}/${account.id}/entries/${entryId}`,
      body,
      cookie,
      during: async () => {
        const res = await api.del(`${ACC}/${account.id}/entries/${entryId}?cashForce=1`);
        state.before = snapshot();
        state.balance = (await card(account.id)).totals.balance;
        return res;
      },
    });
    return { race, ...state };
  };

  it("(a) Borç Yaz ve nakit tahsilat: gövde yoldayken silinirse 404 \"Hareket bulunamadı. Başka biri silmiş olabilir.\" (önceden 200, satır yok)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "Yarış Borç Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    for (const [label, made, body] of [
      ["Borç Yaz", { kind: "debt", amount: "100", date: TODAY }, { amount: "150", note: "düzeltme" }],
      ["tahsilat", { kind: "in", amount: "40", date: TODAY, method: "cash" }, { amount: "60", cashForce: true }],
    ]) {
      const created = await must(label, ctx.api.post(`${ACC}/${account.id}/entries`, made));
      const { race, before, balance } = await raceDelete(ctx.api, account, created.entryId, body);
      await assertRefused(label, race, { entryId: created.entryId, accountId: account.id, before, balance });
    }
    // Silinen iki hareket de bakiyeye geri gelmedi: kart boş, bakiye 0.
    const after = await card(account.id);
    assert.deepEqual([after.entries.length, after.totals.balance], [0, 0], "kartta hareket yok, bakiye 0");
  });

  it("(b) silinmemiş harekette düzeltme AYNEN yazar: 200, tutar / açıklama / vade, bakiye ve ekstre doğru; silinmiş harekete doğrudan düzeltme 404", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "Yarış Olağan Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    const debt = await must("Borç Yaz", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "debt", amount: "1000", date: "2026-10-01", dueDate: "2026-10-20", note: "ilk" }));
    const paid = await must("tahsilat", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "in", amount: "200", date: "2026-10-02", method: "cash" }));
    const fixedDebt = await must("Borç düzelt", ctx.api.put(`${ACC}/${account.id}/entries/${debt.entryId}`, { amount: "1200", note: "düzeltildi", dueDate: "2026-10-25" }));
    const fixedPaid = await must("tahsilat düzelt", ctx.api.put(`${ACC}/${account.id}/entries/${paid.entryId}`, { amount: "300" }));
    const row = id => ctx.store.get("SELECT kind, amount, note, due_date AS dueDate FROM account_entries WHERE id = ?", id);
    assert.deepEqual({ ...row(debt.entryId), amount: Number(row(debt.entryId).amount) }, { kind: "debt", amount: 1200, note: "düzeltildi", dueDate: "2026-10-25" }, "borç düzeltmesi yazıldı");
    assert.equal(Number(row(paid.entryId).amount), 300, "tahsilat düzeltmesi yazıldı");
    assert.equal(fixedDebt.totals.balance, 1000, "borç düzeltmesinin yanıtındaki bakiye 1.200 − 200");
    assert.equal(fixedPaid.totals.balance, 900, "tahsilat düzeltmesinin yanıtındaki bakiye 1.200 − 300");
    const view = await card(account.id);
    assert.deepEqual(
      view.ledger.map(line => [line.date, line.debit, line.credit, line.balance]),
      [
        ["2026-10-01", 1200, 0, 1200],
        ["2026-10-02", 0, 300, 900],
      ],
      "ekstre satırları",
    );
    assert.equal(updatedAudits(debt.entryId), 1, "borç düzeltmesi geçmişte bir kez");
    // Yarışsız: silinmiş harekete düzeltme isteğin başındaki okumayla aynı 404 iletisini alır.
    await must("tahsilat sil", ctx.api.del(`${ACC}/${account.id}/entries/${paid.entryId}?cashForce=1`));
    const late = await ctx.api.put(`${ACC}/${account.id}/entries/${paid.entryId}`, { amount: "350" });
    assert.deepEqual([late.status, late.error], [404, GONE]);
    assert.equal((await card(account.id)).totals.balance, 1200, "silmeden sonra bakiye 1.200");
  });

  it("(c) iki kullanıcı: kart yüklendikten sonra muhasebe kullanıcısı siler, yöneticinin düzeltmesi 404 alır; yeniden yüklenen kartta hareket yok", async () => {
    const other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "yaris250muh", role: "muhasebe" }));
    const account = await must("cari", ctx.api.post(ACC, { name: "Yarış İki Kullanıcı", type: "customer", registeredOn: "2026-09-01" }));
    await must("Borç Yaz", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "debt", amount: "500", date: TODAY }));
    const created = await must("ikinci borç", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "debt", amount: "250", date: TODAY, note: "silinecek" }));
    // Yöneticinin ekranı: kart yüklü, hareket düzeltilebilir.
    const loaded = (await card(account.id)).entries.find(row => row.id === created.entryId);
    assert.equal(loaded?.editable, true, "yöneticinin kartında hareket düzeltilebilir");
    // Öbür kullanıcı da görür (silme yetkisi var).
    assert.ok((await must("muhasebe kartı", other.get(`${ACC}/${account.id}`))).entries.some(row => row.id === created.entryId), "muhasebe kartında hareket var");
    const { race, before, balance } = await raceDelete(other, account, created.entryId, { amount: "275", note: "yöneticinin düzeltmesi" });
    assert.equal(balance, 500, "silmeden sonra bakiye 500");
    await assertRefused("iki kullanıcı", race, { entryId: created.entryId, accountId: account.id, before, balance });
    const reloaded = await card(account.id);
    assert.equal(reloaded.entries.some(row => row.id === created.entryId), false, "yeniden yüklenen kartta silinen hareket yok");
    // Silen kullanıcının izi tek: "account.entry.deleted" bir kez, düzeltme izi yok.
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.entry.deleted' AND entity_id = ?", created.entryId).n, 1);
  });

  it("(d) bağlı hareketler: Kapatılacak Fatura'ya bağlı tahsilat ve vadeli Borç Yaz — gövde yoldayken silinirse 404, fatura ve vade izi değişmez", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "Yarış Fatura Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: "2026-10-01", lines: [{ itemId: item.id, qty: 1, unitPrice: "800", vatRate: 0 }], payment: { rest: "open", dueDate: "2026-10-01" } }));
    const linked = await must("Kapatılacak Fatura tahsilatı", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "in", amount: "300", date: TODAY, method: "cash", invoiceId: invoice.id }));
    assert.equal(ctx.store.get("SELECT invoice_id AS invoiceId FROM account_entries WHERE id = ?", linked.entryId).invoiceId, invoice.id, "ön koşul — tahsilat faturaya bağlı");
    const first = await raceDelete(ctx.api, account, linked.entryId, { amount: "500", invoiceId: invoice.id, cashForce: true });
    await assertRefused("faturaya bağlı tahsilat", first.race, { entryId: linked.entryId, accountId: account.id, ...first });
    // Fatura kartı silmeden sonraki gibi: tahsilat bağı yok (kalan 800).
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE invoice_id = ?", invoice.id).n, 0, "faturaya bağlı satır kalmadı");

    const dated = await must("vadeli Borç Yaz", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "debt", amount: "400", date: TODAY, dueDate: "2026-11-15", expectedDate: "2026-11-10", note: "vadeli" }));
    const second = await raceDelete(ctx.api, account, dated.entryId, { amount: "450", dueDate: "2026-11-30" });
    await assertRefused("vadeli Borç Yaz", second.race, { entryId: dated.entryId, accountId: account.id, ...second });
    const dues = await must("takvim", ctx.api.get("/api/workspace/dues"));
    assert.equal(dues.items.some(row => row.entryId === dated.entryId), false, "silinen vadeli borç takvimde yok");
  });
});
