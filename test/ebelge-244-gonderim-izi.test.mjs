// 2.4.4 — 31d eleştirmen bulgusu E1 (YÜKSEK) ve E4; kullanıcı adına 5 dk yetkisiyle karar (22.10.2026, en yaygın kalıp: kalıcı niyet kaydı).
// E1: e-Belge gönderimi EDM'ye ulaşıp yanıt gelmeden program kesilince (elektrik, çökme) belge yeniden açılışta "Gönderilmedi" görünüyordu (iz yoktu, yalnız
// bellekte kilit): yeniden Gönder → EDM 11048 → "Hata" + "İptal Et" yönlendirmesi; Sil numarayı yeniden veriyordu (EDM'deki geçerli belge programdan düşer);
// Düzenle tutarı EDM'dekinden ayırıyordu. E4: iptal EDM'de tamamlanıp yanıt gelmeden program kesilince, süre dolduktan sonraki İptal Et EDM'ye sormadan
// "süre doldu" diyordu. Düzeltme (server/routes/invoices.mjs): ağa çıkmadan ÖNCE tek işlemde gönderim izi (e_status none + e_adapter = "Sonucu Belirsiz" +
// İşlem Geçmişi invoice.e.sending); 11048'de ileti bu belgeyi gösteriyorsa önce durum sorulur; iptal isteğinden önce iptal izi (invoice.e.cancelling).
//
// "Nasıl bozulur?" (önce yazıldı — not defteri e1/NASIL-BOZULUR.md; testler buradan):
//   B1  kesinti gönderimden ÖNCE (giriş yanıtı beklerken): belge yanlışlıkla izli görünür ya da numara harcanır                       → K1
//   B2  kesinti SIRASINDA, EDM işledi: "Gönderilmedi" → 11048 Hata; Sil numarayı yeniden verir; Düzenle tutarı ayırır; İptal Et onaysız  → K2 (e-SMM), K3 (e-Arşiv,
//       Kaydet ve Gönder), K4 (e-Fatura)
//   B2b kesinti SIRASINDA, EDM İŞLEMEDİ: iz sonsuza dek kalır / Durum Sorgula "bulunamadı"da temizlemez                                  → K5
//   B3  sonuç gelince iz temizlenmez ya da yanıttan ÖNCE temizlenir (mutasyon M2)                                                      → K2–K6 (son durum)
//   B4  hiç gitmeyen istek (NOT_SENT) ve "bağlantı hiç kurulamadı" (numara geri bırakılır): iz geri alınmaz → yanlış "Sonucu Belirsiz"     → K7, K8
//   B5  gönderim sürerken Durum Sorgula: "bulunamadı" izi siler, kesintide belge izsiz kalır                                            → K9
//   B6  Tümünü Gönder ortasında kesinti: yoldaki belge ikinci kez gider / sıradaki aynı numarayı alır                                    → K6
//   B7  iptal ortasında kesinti (E4): süre dolunca "süre doldu" (EDM'de iptal); süre içinde ikinci iptal gider                           → K10, K11
//   B8  11048: ileti bu belgeyi gösteriyor → Hata; başka belgenin numarası / EDM başka ETTN bildiriyor → yanlışlıkla "gönderildi"          → K12, K13, K14, U1
//   B9  11048'de bulunan belge iletim günü olarak bugünü alır (iptal süresi yasal sürenin ötesine uzar)                                   → K12, U2
//   B10 002 şirketi: iz / 11048 yolu 001'in veri tabanında                                                                           → K12 (002'de)
//   B11 eski sürüm verisi: v2.4.3'te kesintiyle kalan izsiz belge yeni sürümde                                                         → K15 (v2.4.3 gerçek kodu)
//   B12 yetkisiz kullanıcı: değişmedi (gönderim / iptal / Durum Sorgula yetkileri aynen) — denenmedi (kapsam dışı)
// Kesinti zorla üretilir (ders 20): programı ayrı süreçte açan çocuk (ebelge-244-gonderim-izi-cocuk.mjs), sahte EDM'nin önünde yanıtı bekleten vekil;
// istek EDM'de işlendiği (ya da işlenmeden beklediği) an süreç SIGKILL ile öldürülür, aynı veri klasörü güncel kodla yeniden açılır.
// Sahte saat (ders 13); lisans servisi ölü yerel adres (ders 30); ağa çıkılmaz.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { transmissionOf } from "../server/lib/einvoice/iptal-suresi.mjs";
import * as invoiceRoutes from "../server/routes/invoices.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createClient, startTestServer } from "./helpers.mjs";
import { apiOf, tagsAvailable } from "./guvenilirlik/surumler.mjs";

// İşlem Geçmişi kayıt adları testin kendi beklentisidir (adlandırılmış içe aktarma yok: dosya eski kodda da yüklenir, kırmızı beklenen yerde düşer — ders 38).
const SEND_INTENT = "invoice.e.sending";
const SEND_DUPLICATE = "invoice.e.duplicate";
const duplicateNamesOwn = (...args) => {
  assert.equal(typeof invoiceRoutes.duplicateNamesOwn, "function", "11048 iletisinin belgeyi gösterip göstermediğini söyleyen yardımcı (duplicateNamesOwn) yok");
  return invoiceRoutes.duplicateNamesOwn(...args);
};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHILD = path.join(HERE, "ebelge-244-gonderim-izi-cocuk.mjs");
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const TODAY = "2026-06-17";
const day = offset => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
const FIRM = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
const must = async (label, promise, status = 200) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const smmBody = (accountId, extra = {}) => ({ scenario: "smm", accountId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra });
const saleBody = (accountId, extra = {}) => ({ scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, ...extra });
const opOf = body => (/<(?:\w+:)?(\w+)Request[\s>]/.exec(String(body || "").replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "")) || [])[1] || "";
const smmFault = (code, message) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>${message}</faultstring><detail><RequestFault xmlns="http://tempuri.org/"><ERROR_CODE xmlns="">${code}</ERROR_CODE><ERROR_SHORT_DES xmlns="">${message}</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`;

// Sahte EDM'nin önünde vekil. hold(op, { phase, nth }): o işlemin nth. isteğinde — "after": istek EDM'ye iletilir, EDM işler, yanıt istemciye VERİLMEZ (yolda);
// "before": istek EDM'ye hiç iletilmez. reached: tutulduğu an. release(): tutulan yanıt verilir (aynı süreçteki denemeler için). inject(op, { times, xml }):
// istek EDM'ye iletilmeden verilen yanıt döner. rewrite(op, fn): EDM'nin yanıt metni değiştirilir.
async function startProxy(target) {
  const origin = new URL(target).origin;
  const holds = [];
  const injects = new Map();
  const rewrites = new Map();
  const seen = new Map();
  const hanging = new Set();
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks);
      const op = req.method === "GET" ? "" : opOf(body.toString("utf8"));
      seen.set(op, (seen.get(op) || 0) + 1);
      const at = holds.findIndex(item => item.op === op && item.nth === seen.get(op));
      const hold = at >= 0 ? holds.splice(at, 1)[0] : null;
      const inject = injects.get(op);
      if (inject && inject.times > 0) {
        inject.times -= 1;
        res.writeHead(500, { "content-type": "text/xml" }).end(inject.xml);
        return;
      }
      if (hold?.phase === "before") {
        hanging.add(res);
        hold.res = res;
        hold.resolve();
        return;
      }
      try {
        const reply = await fetch(origin + req.url, { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([key]) => !["host", "content-length", "connection"].includes(key))), body: req.method === "GET" ? undefined : body });
        let text = Buffer.from(await reply.arrayBuffer()).toString("utf8");
        if (rewrites.has(op)) text = rewrites.get(op)(text);
        const send = () => {
          if (!res.writableEnded && !res.destroyed) res.writeHead(reply.status, { "content-type": reply.headers.get("content-type") || "text/xml" }).end(text);
        };
        if (hold) {
          hanging.add(res);
          hold.res = res;
          hold.send = send;
          hold.resolve();
          return;
        }
        send();
      } catch (error) {
        if (!res.writableEnded) res.writeHead(502).end(String(error?.message || error));
      }
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}${new URL(target).pathname}`,
    hold(op, { phase = "after", nth = (seen.get(op) || 0) + 1 } = {}) {
      const item = { op, phase, nth };
      item.reached = new Promise(resolve => (item.resolve = resolve));
      item.release = () => (item.send ? item.send() : item.res?.socket?.destroy());
      holds.push(item);
      return item;
    },
    inject: (op, { times = 1, xml }) => injects.set(op, { times, xml }),
    rewrite: (op, fn) => (fn ? rewrites.set(op, fn) : rewrites.delete(op)),
    close: () => {
      for (const res of hanging) res.socket?.destroy();
      server.closeAllConnections?.();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

const roots = [];
const children = new Set();
after(() => {
  for (const child of children) if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// Programı ayrı süreçte açar (güncel kod ya da sürüm etiketi). kill(): SIGKILL (elektrik kesintisi).
async function startChild({ version = "guncel", dataDir, backupDir, now = `${TODAY}T10:00:00` }) {
  const child = fork(CHILD, [version, dataDir, backupDir, now, ADMIN_PASSWORD], { stdio: ["ignore", "ignore", "pipe", "ipc"], env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, execArgv: ["--disable-warning=ExperimentalWarning"] });
  children.add(child);
  let stderr = "";
  child.stderr.on("data", chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.once("exit", resolve));
  const { port } = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("exit", code => reject(new Error(`çocuk süreç açılmadı (${code}): ${stderr.slice(-800)}`)));
  });
  const client = createClient(`http://127.0.0.1:${port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  return {
    api: apiOf(client),
    kill: async () => {
      child.kill("SIGKILL");
      await exited;
      children.delete(child);
    },
  };
}

// Bir senaryonun ortamı: sahte EDM + vekil + veri klasörü. setup(api, q): firma ve entegratör ayarı + cariler.
async function scene() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const proxy = await startProxy(edm.url);
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-244-gonderim-izi-"));
  roots.push(root);
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const ctx = { edm, proxy, dataDir, backupDir, server: null };
  // esmm: v2.4.3'te e-SMM gönderimi yoktu (ayar 400 "esmm-unavailable") — eski sürüm e-Arşiv ile kurulur.
  ctx.setup = async (api, q = "", { esmm = true } = {}) => {
    await must("ayar", api.put(`/api/workspace/invoices/settings${q}`, { seller: SELLER, efatura: true, earsiv: true, ...(esmm ? { esmm: true } : {}), integrator: { env: "test", baseUrl: proxy.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const account = async body => {
      const created = await must("cari", api.post(`/api/workspace/accounts${q}`, body));
      return created.id || created.account?.id;
    };
    return { clientId: await account(CLIENT), personId: await account(PERSON), firmId: await account(FIRM) };
  };
  // Aynı veri klasörünü GÜNCEL kodla bu süreçte yeniden açar (kesintiden sonraki açılış).
  ctx.reopen = async (now = `${TODAY}T10:05:00`) => {
    resetEdmCaches();
    await ctx.server?.close();
    ctx.server = await startTestServer({ dataDir, edocEnabled: true, esmmEnabled: true, now, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, fetchImpl: localFetch });
    const client = ctx.server.client();
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    ctx.api = apiOf(client);
    ctx.store = ctx.server.app.store;
    return ctx.api;
  };
  ctx.card = async (id, q = "") => must("kart", ctx.api.get(`/api/workspace/invoices/${id}${q}`));
  ctx.ops = () => ({ fatura: edm.state.calls.map(call => call.op), smm: edm.state.smm.calls.map(call => call.op) });
  ctx.count = (service, op) => ctx.ops()[service].filter(item => item === op).length;
  ctx.intents = id => ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ? AND type = ?", id, SEND_INTENT).n;
  ctx.close = async () => {
    await ctx.server?.close();
    await proxy.close();
    await edm.close();
  };
  return ctx;
}
const localFetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  return globalThis.fetch(input, init);
};
// Çocuk süreçte hazırlık + eylem; vekil işlemi tuttuğu an SIGKILL.
async function crash(ctx, { version = "guncel", hold, prepare, act }) {
  const child = await startChild({ version, dataDir: ctx.dataDir, backupDir: ctx.backupDir });
  const prepared = await prepare(child.api);
  const held = ctx.proxy.hold(hold.op, { phase: hold.phase || "after", ...(hold.nth ? { nth: hold.nth } : {}) });
  const pending = Promise.resolve(act(child.api, prepared)).catch(error => ({ error: String(error?.message || error) }));
  const timer = setTimeout(() => held.resolve(), 15_000);
  await held.reached;
  clearTimeout(timer);
  assert.ok(held.res, `vekil ${hold.op} isteğini tutmalıydı (tutulmadı: istek gelmedi)`);
  await child.kill();
  await pending;
  return prepared;
}
// Kesintiden sonra belge kartı: "Sonucu Belirsiz" düzeni (B2) — Sil / Düzenle / İptal Et kapalı, Durum Sorgula açık ve önerilir.
async function assertUncertain(ctx, id, label) {
  const card = await ctx.card(id);
  assert.equal(card.eStatus, "none", `${label}: durum`);
  assert.equal(card.eAdapter, "edm", `${label}: entegratör izi (e_adapter) — kesintide kalmalı`);
  assert.equal(card.eStatusLabel, "Sonucu Belirsiz", `${label}: rozet`);
  assert.match(String(card.eMessage), /Durum Sorgula/, `${label}: ileti Durum Sorgula'yı önermeli`);
  assert.equal(card.canRefresh, true, `${label}: Durum Sorgula açık`);
  assert.equal(card.canDelete, false, `${label}: Sil kapalı`);
  assert.match(String(card.deleteBlock), /sonucu belirsiz/i);
  assert.equal(card.canModify, false, `${label}: Düzenle kapalı`);
  assert.equal(card.canCancel, false, `${label}: İptal Et kapalı (yalnız programda iptal ayrı yol)`);
  assert.equal(ctx.intents(id), 1, `${label}: İşlem Geçmişi'nde gönderim izi`);
  const del = await ctx.api.del(`/api/workspace/invoices/${id}?reason=deneme`);
  assert.equal(del.status, 409, `${label}: Sil → ${del.status} ${JSON.stringify(del.data).slice(0, 200)}`);
  const cancel = await ctx.api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "deneme" });
  assert.equal(cancel.status, 409, `${label}: İptal Et → ${cancel.status}`);
  assert.equal(cancel.data.code, "einvoice-uncertain");
  return card;
}

describe("E1: gönderim EDM'ye ulaştı, yanıt gelmeden program kesildi (SIGKILL) → yeniden açılışta Sonucu Belirsiz; Gönder önce durumu sorar", () => {
  test("K2 e-SMM (Kes, Sonra Gönder → Gönder): Sonucu Belirsiz; Sil / Düzenle / İptal Et 409; Gönder makbuzu ikinci kez göndermez; iletim günü gönderim izinden", async () => {
    const ctx = await scene();
    try {
      const doc = await crash(ctx, {
        hold: { op: "SendSMM" },
        prepare: async api => {
          const ids = await ctx.setup(api);
          return must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { issueDate: day(-2), eSend: "later" })));
        },
        act: (api, doc) => api.post(`/api/workspace/invoices/${doc.id}/send`, {}),
      });
      assert.equal(ctx.edm.state.smm.sent.length, 1, "EDM makbuzu kaydetti (yanıt yolda kaldı)");
      await ctx.reopen();
      const card = await assertUncertain(ctx, doc.id, "e-SMM");
      assert.equal(card.number, ctx.edm.state.smm.sent[0].id, "programdaki numara EDM'deki");
      const edit = await ctx.api.post(`/api/workspace/invoices/${doc.id}/edit`, smmBody(card.accountId, { issueDate: day(-2), lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 5000, vatRate: 20 }] }));
      assert.equal(edit.status, 409, `Düzenle → ${edit.status} ${JSON.stringify(edit.data).slice(0, 200)}`);
      const sent = await must("Gönder", ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
      assert.match(String(sent.sendResult?.message), /önceki gönderimde entegratöre ulaşmış; yeniden gönderilmedi/);
      assert.equal(ctx.count("smm", "SendSMM"), 1, "makbuz EDM'ye bir kez gitti");
      const after = await ctx.card(doc.id);
      assert.ok(["processing", "sent"].includes(after.eStatus), after.eStatus);
      assert.equal(after.eStatusLabel === "Sonucu Belirsiz", false);
      // B9 / iptal süresi: iletim günü gönderim izinin günü (kesimden 2 gün sonra) — kesim günü esas alınsaydı süre 2 gün kısalırdı.
      assert.deepEqual({ source: after.cancelWindow?.source, start: after.cancelWindow?.start }, { source: "iletim", start: TODAY });
    } finally {
      await ctx.close();
    }
  });

  test("K3 e-Arşiv (Kaydet ve Gönder — numara kayıtta): Sonucu Belirsiz; Durum Sorgula gönderildi der; sonra Sil 409 (gönderildi)", async () => {
    const ctx = await scene();
    try {
      let ids;
      await crash(ctx, {
        hold: { op: "SendInvoice" },
        prepare: async api => {
          ids = await ctx.setup(api);
          return null;
        },
        act: api => api.post("/api/workspace/invoices", saleBody(ids.personId, { eSend: "now" })),
      });
      assert.equal(ctx.edm.state.sent.length, 1, "EDM faturayı kaydetti");
      await ctx.reopen();
      const id = ctx.store.get("SELECT id FROM invoices WHERE number = ?", ctx.edm.state.sent[0].id)?.id;
      assert.ok(id, "fatura programda EDM'deki numarayla");
      await assertUncertain(ctx, id, "e-Arşiv");
      const refreshed = await must("Durum Sorgula", ctx.api.post(`/api/workspace/invoices/${id}/e-refresh`, {}));
      assert.ok(["processing", "sent"].includes(refreshed.eStatus), refreshed.eStatus);
      assert.equal(ctx.count("fatura", "SendInvoice"), 1);
      assert.equal((await ctx.api.del(`/api/workspace/invoices/${id}?reason=deneme`)).status, 409, "gönderilmiş belge silinmez");
    } finally {
      await ctx.close();
    }
  });

  test("K4 e-Fatura (Temel Fatura, Kes, Sonra Gönder → Gönder): Sonucu Belirsiz; Düzenle 409; Gönder ikinci kez göndermez", async () => {
    const ctx = await scene();
    try {
      const doc = await crash(ctx, {
        hold: { op: "SendInvoice" },
        prepare: async api => {
          const ids = await ctx.setup(api);
          const created = await must("fatura", api.post("/api/workspace/invoices", saleBody(ids.firmId, { eSend: "later" })));
          assert.match(created.profile, /FATURA$/);
          assert.notEqual(created.profile, "EARSIVFATURA");
          return created;
        },
        act: (api, doc) => api.post(`/api/workspace/invoices/${doc.id}/send`, {}),
      });
      await ctx.reopen();
      const card = await assertUncertain(ctx, doc.id, "e-Fatura");
      const edit = await ctx.api.post(`/api/workspace/invoices/${doc.id}/edit`, saleBody(card.accountId, { lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 9000, vatRate: 20 }] }));
      assert.equal(edit.status, 409);
      await must("Gönder", ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
      assert.equal(ctx.count("fatura", "SendInvoice"), 1, "e-Fatura EDM'ye bir kez gitti");
      assert.equal(ctx.edm.state.sent.length, 1);
    } finally {
      await ctx.close();
    }
  });

  test("K5 (B2b) istek EDM'ye ULAŞMADAN kesinti: Sonucu Belirsiz → Durum Sorgula 'bulunamadı' izi temizler (Gönderilmedi, Sil açık) → Gönder aynı numarayla", async () => {
    const ctx = await scene();
    try {
      const doc = await crash(ctx, {
        hold: { op: "SendSMM", phase: "before" },
        prepare: async api => {
          const ids = await ctx.setup(api);
          return must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "later" })));
        },
        act: (api, doc) => api.post(`/api/workspace/invoices/${doc.id}/send`, {}),
      });
      assert.equal(ctx.edm.state.smm.sent.length, 0, "EDM makbuzu görmedi");
      await ctx.reopen();
      const card = await assertUncertain(ctx, doc.id, "ulaşmayan e-SMM");
      const refreshed = await must("Durum Sorgula", ctx.api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {}));
      assert.equal(refreshed.eStatus, "none");
      assert.equal(refreshed.eAdapter, "", "EDM'de yok: iz temizlendi");
      assert.equal(refreshed.canDelete, true, "gönderilmemiş belge silinebilir");
      const sent = await must("Gönder", ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
      assert.equal(sent.number, card.number, "seride boşluk yok: aynı numara");
      assert.deepEqual(ctx.edm.state.smm.sent.map(item => item.id), [card.number]);
    } finally {
      await ctx.close();
    }
  });

  test("K1 (B1) giriş yanıtı beklerken kesinti: belge numarasız Gönderilecekler'de, iz yok (yanlış Sonucu Belirsiz yok); EDM'ye makbuz gitmedi", async () => {
    const ctx = await scene();
    try {
      const doc = await crash(ctx, {
        hold: { op: "Login", phase: "before" },
        prepare: async api => {
          const ids = await ctx.setup(api);
          return must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "later" })));
        },
        act: (api, doc) => api.post(`/api/workspace/invoices/${doc.id}/send`, {}),
      });
      await ctx.reopen();
      const card = await ctx.card(doc.id);
      assert.deepEqual({ eStatus: card.eStatus, number: card.number, eAdapter: card.eAdapter }, { eStatus: "waiting", number: "", eAdapter: "" });
      assert.equal(ctx.intents(doc.id), 0);
      assert.equal(ctx.count("smm", "SendSMM"), 0);
    } finally {
      await ctx.close();
    }
  });

  test("K6 (B6) Tümünü Gönder ortasında kesinti: 1. gitti, 2. yolda, 3. bekliyor → yeniden Tümünü Gönder 2.'yi tanır (ikinci kez göndermez), 3.'ye sıradaki numara", async () => {
    const ctx = await scene();
    try {
      const docs = await crash(ctx, {
        hold: { op: "SendSMM", nth: 2 },
        prepare: async api => {
          const ids = await ctx.setup(api);
          const list = [];
          for (const offset of [-2, -1, 0]) list.push(await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { issueDate: day(offset), eSend: "later" }))));
          return list;
        },
        act: api => api.post("/api/workspace/invoices/send-pending", { all: true }),
      });
      await ctx.reopen();
      const [first, second, third] = await Promise.all(docs.map(doc => ctx.card(doc.id)));
      assert.ok(["processing", "sent"].includes(first.eStatus), `1.: ${first.eStatus}`);
      await assertUncertain(ctx, second.id, "yoldaki 2.");
      assert.deepEqual({ eStatus: third.eStatus, number: third.number }, { eStatus: "waiting", number: "" }, "3. numara almadı");
      let cursor;
      for (let round = 0; round < 10; round += 1) {
        const turn = await must("Tümünü Gönder", ctx.api.post("/api/workspace/invoices/send-pending", { all: true, ...(cursor ? { after: cursor } : {}) }));
        if (turn.stopped || !turn.remaining) break;
        cursor = turn.cursor;
      }
      const sentIds = ctx.edm.state.smm.sent.map(item => item.id);
      assert.equal(ctx.count("smm", "SendSMM"), 3, `EDM'ye üç gönderim (2. yeniden gitmedi): ${ctx.ops().smm.join(",")}`);
      assert.equal(new Set(sentIds).size, 3, `tekil numaralar: ${sentIds}`);
      const final = await Promise.all(docs.map(doc => ctx.card(doc.id)));
      assert.deepEqual(final.map(card => card.number), sentIds, "EDM'deki numaralar programdakiyle aynı, tarih sırasıyla");
      assert.ok(final.every(card => ["processing", "sent"].includes(card.eStatus)), final.map(card => card.eStatus).join(","));
    } finally {
      await ctx.close();
    }
  });
});

describe("E1: iz yalnız belge entegratörde oluşabilecekse kalır (B4, B5)", () => {
  test("K7 (B4) hiç gitmeyen istek (oturum iki kez reddedildi → integrator-session): iz geri alınır — Gönderilmedi, Sil açık, Sonucu Belirsiz değil", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId)));
      assert.ok(doc.number, "numara kayıtta verildi");
      ctx.proxy.inject("SendSMM", { times: 2, xml: smmFault(10011, "Aktif Session bulunamadi") });
      const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      assert.notEqual(sent.status, 200, JSON.stringify(sent.data).slice(0, 300));
      assert.equal(sent.data.code, "integrator-session");
      const card = await ctx.card(doc.id);
      assert.deepEqual({ eStatus: card.eStatus, eAdapter: card.eAdapter, label: card.eStatusLabel === "Sonucu Belirsiz" }, { eStatus: "none", eAdapter: "", label: false });
      assert.equal(card.canDelete, true);
      // İletim günü bu denemeye kaymaz (hiç gitmedi): gönderim izi ardından gelen "hiç gitmedi" kaydıyla kapanır.
      const events = ctx.store.all("SELECT type FROM audit_events WHERE entity_id = ? AND type LIKE 'invoice.e.%' ORDER BY rowid", doc.id).map(row => row.type);
      assert.deepEqual(events.slice(-2), [SEND_INTENT, "invoice.e.send-failed"]);
      assert.equal(ctx.count("smm", "SendSMM"), 0);
    } finally {
      await ctx.close();
    }
  });

  test("K8 (B4) bağlantı hiç kurulamadı (numara bu istekte verildi): numara geri bırakılır, iz de — belge numarasız Gönderilecekler'de, entegratör izi yok", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "later" })));
      // Giriş yapılsın (oturum önbellekte), sonra vekil kapanır: gönderim isteği bağlantı kuramaz (ECONNREFUSED).
      await must("Bağlantıyı Test Et", api.post("/api/workspace/invoices/integrator/test", {}));
      const original = ctx.proxy.url;
      await ctx.proxy.close();
      const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      assert.notEqual(sent.status, 200);
      const card = await ctx.card(doc.id);
      assert.equal(card.eStatus, "waiting", `numara geri bırakıldı: ${JSON.stringify(sent.data).slice(0, 300)}`);
      assert.equal(card.number, "");
      assert.equal(card.eAdapter, "", "iz geri alındı");
      assert.ok(original);
    } finally {
      await ctx.server?.close();
      await ctx.edm.close();
    }
  });

  test("K9 (B5) gönderim sürerken Durum Sorgula 409 'gönderiliyor' (izi silmez); gönderim bitince iz sonuca döner", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "later" })));
      const held = ctx.proxy.hold("SendSMM", { phase: "before" });
      const sending = api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      await held.reached;
      const during = await ctx.card(doc.id);
      assert.equal(during.eAdapter, "edm", "gönderim sürerken iz var");
      const refresh = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
      assert.equal(refresh.status, 409, JSON.stringify(refresh.data).slice(0, 200));
      assert.equal(refresh.data.code, "einvoice-sending");
      assert.equal((await ctx.card(doc.id)).eAdapter, "edm", "iz silinmedi");
      // Tutulan istek EDM'ye iletilmeden koparılır → sonucu belirsiz (istek gitmiş olabilir); program kesilmediği için kilit kalkar.
      held.release();
      const result = await sending;
      assert.notEqual(result.status, 200);
      const card = await ctx.card(doc.id);
      assert.equal(card.eStatusLabel, "Sonucu Belirsiz");
      assert.doesNotMatch(String(card.eMessage), /Gönderim başladı/, "iz iletisi sonucun iletisiyle değişti");
    } finally {
      await ctx.close();
    }
  });
});

describe("E4: iptal EDM'de tamamlandı, yanıt gelmeden program kesildi", () => {
  const sendTwo = async (ctx, api) => {
    const ids = await ctx.setup(api);
    const a = await must("makbuz A", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "now" })));
    const b = await must("makbuz B", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "now" })));
    assert.equal(a.eStatus, "sent", a.eMessage);
    assert.equal(b.eStatus, "sent", b.eMessage);
    return { a, b };
  };
  test("K10 süre dolduktan sonra (10 gün): iptal izi olan makbuzda İptal Et açık, önce EDM'ye sorar → EDM'de iptal → programda iptal; izsiz makbuzda kural aynen (süre doldu, EDM'ye sorulmaz)", async () => {
    const ctx = await scene();
    try {
      const { a, b } = await crash(ctx, {
        hold: { op: "CancelSMM" },
        prepare: api => sendTwo(ctx, api),
        act: (api, docs) => api.post(`/api/workspace/invoices/${docs.a.id}/cancel`, { reason: "deneme" }),
      });
      assert.equal(ctx.edm.state.smm.cancelled.length, 1, "EDM iptal etti");
      await ctx.reopen(`${day(10)}T10:00:00`);
      const card = await ctx.card(a.id);
      assert.equal(card.eStatus, "sent", "program iptali bilmiyor");
      assert.equal(card.cancelWindow?.late, true, "süre doldu");
      assert.equal(card.canCancel, true, "İptal Et açık (önce EDM'ye sorar)");
      assert.equal(card.cancelRecheck, true);
      assert.equal(card.cancelBlock, "", "kartta 'süre doldu' engeli yazmaz");
      const statusBefore = ctx.count("smm", "GetSMMStatus");
      const cancelled = await must("İptal Et", ctx.api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "deneme" }));
      assert.equal(cancelled.status, "cancelled");
      assert.equal(cancelled.eStatus, "cancelled");
      assert.equal(ctx.count("smm", "GetSMMStatus"), statusBefore + 1, "EDM'ye bir kez soruldu");
      assert.equal(ctx.count("smm", "CancelSMM"), 1, "ikinci iptal gönderilmedi");
      // Kontrol: iptal izi olmayan makbuz — süre kuralı DEĞİŞMEDİ (EDM'ye sorulmaz, 409 süre doldu).
      const other = await ctx.card(b.id);
      assert.equal(other.canCancel, false);
      assert.match(String(other.cancelBlock), /iptal süresi doldu/);
      const late = await ctx.api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "deneme" });
      assert.equal(late.status, 409);
      assert.equal(late.data.code, "einvoice-cancel-late");
      assert.equal(ctx.count("smm", "GetSMMStatus"), statusBefore + 1, "izsiz makbuzda EDM'ye sorulmadı");
    } finally {
      await ctx.close();
    }
  });

  test("K11 süre içinde (aynı gün): İptal Et EDM'de iptal olduğunu görür, ikinci iptal göndermez, programda iptal eder", async () => {
    const ctx = await scene();
    try {
      const { a } = await crash(ctx, {
        hold: { op: "CancelSMM" },
        prepare: api => sendTwo(ctx, api),
        act: (api, docs) => api.post(`/api/workspace/invoices/${docs.a.id}/cancel`, { reason: "deneme" }),
      });
      await ctx.reopen();
      const cancelled = await must("İptal Et", ctx.api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "deneme" }));
      assert.equal(cancelled.status, "cancelled");
      assert.equal(cancelled.eStatus, "cancelled");
      assert.equal(ctx.count("smm", "CancelSMM"), 1, "ikinci iptal gönderilmedi");
    } finally {
      await ctx.close();
    }
  });
});

describe("E1: EDM 11048 (daha önce gönderildi) — ileti bu belgeyi gösteriyorsa önce durum sorulur", () => {
  test("K12 (B8, B9, B10) 002 şirketi: numaralı e-Arşiv → yedek → gönder → yedeği geri yükle (belge yine 'Gönderilmedi') → Gönder: 11048 → durum → gönderilmiş sayılır; iletim günü bilinmiyor → kesim günü", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const second = await must("002", api.post("/api/companies", { name: "İkinci Büro", select: false }));
      const companyId = (second.company || second).id;
      const q = `?hofCompany=${encodeURIComponent(companyId)}`;
      const ids = await ctx.setup(api, q);
      const doc = await must("fatura", api.post(`/api/workspace/invoices${q}`, saleBody(ids.personId, { issueDate: day(-3) })));
      assert.match(doc.number, /^TEA/);
      assert.equal(doc.eStatus, "none");
      const backup = await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId }));
      await must("Gönder", api.post(`/api/workspace/invoices/${doc.id}/send${q}`, {}));
      assert.equal(ctx.edm.state.sent.length, 1);
      await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup.name, company: companyId, confirm: "002", password: ADMIN_PASSWORD }));
      const restored = await ctx.card(doc.id, q);
      assert.deepEqual({ eStatus: restored.eStatus, eAdapter: restored.eAdapter, number: restored.number }, { eStatus: "none", eAdapter: "", number: doc.number }, "yedekteki hâl: gönderilmemiş, izsiz");
      const statusBefore = ctx.count("fatura", "GetInvoiceStatus");
      const again = await must("yeniden Gönder", api.post(`/api/workspace/invoices/${doc.id}/send${q}`, {}));
      assert.match(String(again.sendResult?.message), /önceki bir gönderimden tanıdı/);
      assert.ok(["processing", "sent"].includes(again.eStatus), `${again.eStatus}: ${again.eMessage}`);
      assert.equal(ctx.count("fatura", "GetInvoiceStatus"), statusBefore + 1, "11048'den sonra durum soruldu");
      assert.equal(ctx.edm.state.sent.length, 1, "EDM'de tek belge");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE number = ?", doc.number).n, 0, "001'de bu numara yok (iz 002'de)");
      // B9: 11048 bu gönderimin iletim olmadığını söyler; gerçek iletim (yedekten sonraki gönderim) programda kayıtlı değil → kesim günü (yasal süreden uzun olmaz).
      assert.deepEqual({ source: again.cancelWindow?.source, start: again.cancelWindow?.start }, { source: "kesim", start: day(-3) });
    } finally {
      await ctx.close();
    }
  });

  test("K13 (B8) numara başka belgenin (EDM'de bu ETTN yok — ortak test hesabı / yedekten sonra başka belge): durum sorulur, bulunamadı → Hata + İptal Et iletisi (bugünkü yol)", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("fatura", api.post("/api/workspace/invoices", saleBody(ids.personId)));
      ctx.edm.state.usedIds.add(doc.number);
      const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      assert.notEqual(sent.status, 200);
      assert.match(JSON.stringify(sent.data), /11048/);
      assert.match(JSON.stringify(sent.data), /İptal Et/);
      const card = await ctx.card(doc.id);
      assert.equal(card.eStatus, "error");
      assert.equal(ctx.edm.state.sent.length, 0);
    } finally {
      await ctx.close();
    }
  });

  test("K14 (B8) EDM'nin durum yanıtı BAŞKA bir ETTN bildiriyorsa (numarayla eşleşmiş başka belge) gönderilmiş sayılmaz → Hata", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("fatura", api.post("/api/workspace/invoices", saleBody(ids.personId)));
      ctx.edm.state.usedIds.add(doc.number);
      // Durum sorgusu bulunsun ama başka ETTN'le dönsün (EDM numarayla eşleştirdiyse): sahte EDM'ye bu ETTN'in durumu yazılır, yanıttaki UUID değiştirilir.
      ctx.edm.state.statuses.set(String(doc.ettn).toLowerCase(), ["SEND - SUCCEED"]);
      ctx.edm.state.statuses.set(String(doc.ettn), ["SEND - SUCCEED"]);
      ctx.proxy.rewrite("GetInvoiceStatus", text => text.replace(/UUID="[^"]*"/, 'UUID="00000000-0000-4000-8000-0000000000ff"'));
      const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      assert.notEqual(sent.status, 200, JSON.stringify(sent.data).slice(0, 300));
      assert.equal((await ctx.card(doc.id)).eStatus, "error");
    } finally {
      await ctx.close();
    }
  });
});

describe("B11 eski sürüm verisi: v2.4.3'ün GERÇEK koduyla kesinti (izsiz belge), güncel kodla açılış", { skip: !tagsAvailable(["v2.4.3"]) && "v2.4.3 etiketi yok (git fetch --tags)" }, () => {
  test("K15 v2.4.3'te e-Arşiv gönderimi EDM'ye ulaştı, program kesildi → 2.4.4'te belge izsiz (Gönderilmedi; bilinen sınır: Sil açık) → Gönder: 11048 → durum → gönderilmiş sayılır, Hata değil", async () => {
    const ctx = await scene();
    try {
      const doc = await crash(ctx, {
        version: "v2.4.3",
        hold: { op: "SendInvoice" },
        prepare: async api => {
          const ids = await ctx.setup(api, "", { esmm: false });
          return must("fatura (v2.4.3)", api.post("/api/workspace/invoices", saleBody(ids.personId, { eSend: "later" })));
        },
        act: (api, doc) => api.post(`/api/workspace/invoices/${doc.id}/send`, {}),
      });
      assert.equal(ctx.edm.state.sent.length, 1, "EDM v2.4.3'ün gönderdiği faturayı kaydetti");
      await ctx.reopen();
      const card = await ctx.card(doc.id);
      assert.deepEqual({ eStatus: card.eStatus, eAdapter: card.eAdapter, number: card.number }, { eStatus: "none", eAdapter: "", number: ctx.edm.state.sent[0].id }, "2.4.3 iz bırakmadı");
      assert.equal(card.canDelete, true, "BİLİNEN SINIR: izsiz eski belgede Sil açık (programın bilgisi yok)");
      const sent = await must("Gönder", ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
      assert.match(String(sent.sendResult?.message), /önceki bir gönderimden tanıdı/);
      assert.ok(["processing", "sent"].includes(sent.eStatus), `${sent.eStatus}: ${sent.eMessage}`);
      assert.equal(ctx.edm.state.sent.length, 1);
    } finally {
      await ctx.close();
    }
  });
});

describe("U birim: 11048 iletisinin gösterdiği belge ve iletim günü", () => {
  const doc = { number: "TES2026000000007", ettn: "1DA139FD-F9C1-452C-8D10-020B161D06CA" };
  const err = message => Object.assign(new Error(`EDM isteği reddetti: ${message} (EDM hata kodu 11048)`), { extra: { integratorCode: "11048" } });
  test("U1 iletideki numara ve ETTN'nin hepsi belgeninkiyse (büyük/küçük harf farkı önemsiz) bu belge; biri farklıysa ya da ikisi de yoksa değil", () => {
    assert.equal(duplicateNamesOwn(err("UUID=1da139fd-f9c1-452c-8d10-020b161d06ca ID=TES2026000000007 için Daha önce gönderdiğiniz bir SMM'yi tekrar göndermeye çalıştınız"), doc), true);
    assert.equal(duplicateNamesOwn(err("ID=tes2026000000007 için Daha önce gönderdiğiniz bir faturayı tekrar göndermeye çalıştınız"), doc), true, "yalnız numara");
    assert.equal(duplicateNamesOwn(err("UUID=1DA139FD-F9C1-452C-8D10-020B161D06CA için tekrar göndermeye çalıştınız"), doc), true, "yalnız ETTN");
    assert.equal(duplicateNamesOwn(err("UUID=2bd01737-e7f5-472e-972c-8993eb76d37a ID=TES2026000000007 için Daha önce gönderdiğiniz"), doc), false, "numara aynı, ETTN başka belgenin");
    assert.equal(duplicateNamesOwn(err("UUID=1da139fd-f9c1-452c-8d10-020b161d06ca ID=TES2026000000008 için Daha önce gönderdiğiniz"), doc), false, "ETTN aynı, numara başka");
    assert.equal(duplicateNamesOwn(err("ID=TEA2026000000007 için Daha önce gönderdiğiniz"), doc), false, "başka seri");
    assert.equal(duplicateNamesOwn(err("Daha önce gönderdiğiniz bir faturayı tekrar göndermeye çalıştınız"), doc), false, "ileti belge göstermiyor");
    assert.equal(duplicateNamesOwn(Object.assign(new Error("EDM isteği reddetti"), { extra: { detail: "UUID=1da139fd-f9c1-452c-8d10-020b161d06ca ID=TES2026000000007" } }), doc), true, "ayrıntı alanında");
  });
  test("U2 iletim günü: gönderim izi yalnız ardından sonuç kaydı gelmediyse girişimdir (kesinti); sonuç gelince sonucun kuralı", () => {
    const at = hour => `2026-06-17T${String(hour).padStart(2, "0")}:00:00.000Z`;
    const intent = hour => ({ type: SEND_INTENT, at: at(hour), payload: { adapter: "edm" } });
    const failed = (hour, payload) => ({ type: "invoice.e.send-failed", at: at(hour), payload });
    assert.equal(transmissionOf([intent(9)]), at(9), "kesinti: iz girişimdir");
    assert.equal(transmissionOf([intent(9), { type: "invoice.e.sent", at: at(10), payload: {} }]), at(10), "kabul: kabulün anı");
    assert.equal(transmissionOf([intent(9), failed(10, { status: "none", adapter: "edm", code: "integrator-uncertain" })]), at(10), "belirsiz kopma: kopmanın anı");
    assert.equal(transmissionOf([failed(8, { status: "none", adapter: "edm", code: "integrator-uncertain" }), intent(9), failed(10, { status: "none", adapter: "edm", code: "integrator-session" })]), at(8), "hiç gitmeyen istek: önceki girişim kalır");
    assert.equal(transmissionOf([intent(9), failed(10, { status: "error", adapter: "edm", code: "integrator-rejected" })]), "", "ret: girişim değil");
    assert.equal(transmissionOf([intent(9), { type: SEND_DUPLICATE, at: at(10), payload: { adapter: "edm" } }]), "", "11048 (EDM zaten almış): bu gönderim iletim değil");
    assert.equal(transmissionOf([intent(9), { type: "invoice.unnumbered", at: at(10), payload: {} }]), "", "numara geri bırakıldı: ulaşmadı");
    assert.equal(transmissionOf([intent(9), { type: "invoice.e.status", at: at(10), payload: {} }]), at(9), "durum sorgusu sonucu kapatmaz (kesintiden sonraki Durum Sorgula)");
    assert.equal(transmissionOf([{ type: "invoice.e.sent", at: at(8), payload: {} }]), at(8), "2.4.3 kaydı aynen");
  });
});

// 31e bağımsız dar kontrol (23.10.2026): E1-Y (Durum Sorgula ↔ Gönder yarışı), İNCELE-1 (11048'de ETTN doğrulaması), İNCELE-3 (iptal izi kesin retten sonra).
// "Nasıl bozulur?" (önce yazıldı — not defteri e1/r31e-e1/NASIL-BOZULUR.md): Y1 geç gelen "bulunamadı" yeni gönderimin izini siler → R1 · Y4 11048 + ETTN'siz
// durum yanıtı "gönderildi" sayılır → R3 · Y5 11048 + bulunamadı / kendi ETTN / başka ETTN aynen → K12, K13, K14 · Y6 kesin ret izi kapatmaz → R4 · Y7/Y8 kopan
// iptal izi açık bırakır, kesin retten sonraki kopan deneme izi yeniden açar → R4 (ikinci deneme), K10.
describe("31e: Durum Sorgula ↔ Gönder yarışı, 11048 ETTN doğrulaması, iptal izi kesin ret", () => {
  test("R1 (Y1) Durum Sorgula'nın 'bulunamadı' yanıtı yoldayken başka oturum Gönder'e basar: geç yanıt izi SİLMEZ (409 değişti), kesinti penceresinde belge Sonucu Belirsiz kalır", async () => {
    const ctx = await scene();
    try {
      // Durağan sahte saat: iki yazım aynı damgayı (e_at) taşır — koruma damgaya değil gönderim izine de bakmalı.
      const api = await ctx.reopen({ time: `${TODAY}T10:05:00`, fixed: true });
      const ids = await ctx.setup(api);
      const doc = await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "later" })));
      // Hazırlık: istek EDM'ye iletilmeden koparılır → Sonucu Belirsiz (EDM'de makbuz yok).
      const cut = ctx.proxy.hold("SendSMM", { phase: "before" });
      const first = api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      await cut.reached;
      cut.release();
      await first;
      assert.equal((await ctx.card(doc.id)).eStatusLabel, "Sonucu Belirsiz");
      // A: Durum Sorgula — EDM işler ("bulunamadı"), yanıt yolda tutulur.
      const statusHold = ctx.proxy.hold("GetSMMStatus", { phase: "after" });
      const refreshing = api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
      await statusHold.reached;
      // B (ikinci oturum): Gönder — kendi durum sorgusu geçer, iz yazılır, SendSMM EDM'de işlenir, yanıtı yolda.
      const clientB = ctx.server.client();
      assert.equal((await clientB.login("admin", ADMIN_PASSWORD)).status, 200);
      const sendHold = ctx.proxy.hold("SendSMM", { phase: "after" });
      const sending = apiOf(clientB).post(`/api/workspace/invoices/${doc.id}/send`, {});
      await sendHold.reached;
      assert.equal(ctx.edm.state.smm.sent.length, 1, "B'nin makbuzu EDM'de");
      // A'nın geç "bulunamadı" yanıtı gelir.
      statusHold.release();
      const refreshed = await refreshing;
      const window = ctx.store.get("SELECT e_status AS status, e_adapter AS adapter FROM invoices WHERE id = ?", doc.id);
      assert.deepEqual({ ...window }, { status: "none", adapter: "edm" }, "gönderim yoldayken iz silinmemeli: o anda program kesilseydi EDM'deki makbuz programda 'Gönderilmedi' kalırdı");
      assert.equal(refreshed.status, 409, JSON.stringify(refreshed.data).slice(0, 300));
      assert.equal(refreshed.data.code, "einvoice-status-stale");
      assert.match(String(refreshed.data.error), /yeniden gönderim başladı/, "A3: yeni gönderim izi → ileti gönderimi söyler");
      sendHold.release();
      await must("B Gönder", sending);
      const end = await ctx.card(doc.id);
      assert.ok(["processing", "sent"].includes(end.eStatus), end.eStatus);
      assert.equal(ctx.count("smm", "SendSMM"), 1, "EDM'ye yalnız B'nin gönderimi ulaştı (ilki vekilde koparıldı)");
      assert.equal(ctx.edm.state.smm.sent.length, 1);
      // Değişmeyen belgede Durum Sorgula her zamanki gibi çalışır (koruma yanlış pozitif vermez).
      assert.ok(["processing", "sent"].includes((await must("Durum Sorgula", ctx.api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {}))).eStatus));
    } finally {
      await ctx.close();
    }
  });

  for (const kind of ["e-SMM", "e-Arşiv"]) {
    test(`R3 (Y4) ${kind}: 11048 + durum yanıtında ETTN YOK → belge 'gönderildi' sayılmaz; Sonucu Belirsiz (Durum Sorgula önerilir), Hata / İptal Et yönlendirmesi de değil`, async () => {
      const ctx = await scene();
      try {
        const api = await ctx.reopen();
        const ids = await ctx.setup(api);
        const smm = kind === "e-SMM";
        const doc = await must("belge", api.post("/api/workspace/invoices", smm ? smmBody(ids.clientId) : saleBody(ids.personId)));
        assert.ok(doc.number, "numara kayıtta");
        // Numara EDM'de kullanılmış (11048) ve EDM bu ID + ETTN sorgusuna bir durum döndürüyor — ama yanıtta ETTN yok (hangi belge olduğu bilinmiyor).
        const state = smm ? ctx.edm.state.smm : ctx.edm.state;
        state.usedIds.add(doc.number);
        state.statuses.set(String(doc.ettn).toLowerCase(), ["SEND - SUCCEED"]);
        state.statuses.set(String(doc.ettn), ["SEND - SUCCEED"]);
        if (smm) ctx.proxy.rewrite("GetSMMStatus", text => text.replace(/<UUID>[^<]*<\/UUID>/g, ""));
        else ctx.proxy.rewrite("GetInvoiceStatus", text => text.replace(/\sUUID="[^"]*"/g, ""));
        const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
        assert.notEqual(sent.status, 200, `gönderilmiş sayılmamalı: ${JSON.stringify(sent.data).slice(0, 300)}`);
        assert.equal(sent.data.code, "einvoice-duplicate-unverified");
        assert.match(JSON.stringify(sent.data), /Durum Sorgula/);
        const card = await ctx.card(doc.id);
        assert.deepEqual({ eStatus: card.eStatus, eAdapter: card.eAdapter, label: card.eStatusLabel }, { eStatus: "none", eAdapter: "edm", label: "Sonucu Belirsiz" });
        assert.equal(card.canDelete, false, "doğrulanamayan belge silinmez");
        assert.equal(card.canCancel, false, "İptal Et yönlendirmesi yok");
        assert.equal(state.sent.length, 0);
      } finally {
        await ctx.close();
      }
    });
  }

  test("R4 (Y6, Y8) iptal EDM'de KESİN reddedildi → iptal izi kapanır (8 gün sonra 'süre doldu', EDM'ye sorulmaz); sonraki iptal denemesi koparsa iz yeniden açılır (süre dolunca EDM'ye sorar)", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const a = await must("makbuz A", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "now" })));
      const b = await must("makbuz B", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "now" })));
      assert.equal(a.eStatus, "sent", a.eMessage);
      // A: EDM iptali kesin reddeder (EDM hata kodu).
      ctx.proxy.inject("CancelSMM", { times: 1, xml: smmFault(11049, "SMM iptal edilemedi") });
      const rejected = await api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "deneme" });
      assert.notEqual(rejected.status, 200, JSON.stringify(rejected.data).slice(0, 300));
      assert.match(JSON.stringify(rejected.data), /11049/);
      // B: önce kesin ret, sonra ikinci deneme istek gittikten sonra kopar (belirsiz).
      ctx.proxy.inject("CancelSMM", { times: 1, xml: smmFault(11049, "SMM iptal edilemedi") });
      assert.notEqual((await api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "deneme" })).status, 200);
      const cut = ctx.proxy.hold("CancelSMM", { phase: "before" });
      const second = api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "deneme" });
      await cut.reached;
      cut.release();
      assert.notEqual((await second).status, 200);
      assert.equal(ctx.edm.state.smm.cancelled.length, 0, "EDM hiçbirini iptal etmedi");
      await ctx.reopen(`${day(10)}T10:00:00`);
      const cardA = await ctx.card(a.id);
      assert.equal(cardA.cancelWindow?.late, true);
      assert.equal(cardA.cancelRecheck, false, "kesin ret iptal izini kapattı");
      assert.equal(cardA.canCancel, false, "İptal Et kapalı");
      assert.match(String(cardA.cancelBlock), /iptal süresi doldu/, "kartta neden yazar");
      const statusBefore = ctx.count("smm", "GetSMMStatus");
      const late = await ctx.api.post(`/api/workspace/invoices/${a.id}/cancel`, { reason: "deneme" });
      assert.equal(late.status, 409);
      assert.equal(late.data.code, "einvoice-cancel-late");
      assert.equal(ctx.count("smm", "GetSMMStatus"), statusBefore, "kesin retten sonra EDM'ye sorulmaz");
      const cardB = await ctx.card(b.id);
      assert.equal(cardB.cancelRecheck, true, "kopan ikinci deneme izi yeniden açtı");
      assert.equal(cardB.canCancel, true);
      const asked = await ctx.api.post(`/api/workspace/invoices/${b.id}/cancel`, { reason: "deneme" });
      assert.equal(asked.status, 409, "EDM'de iptal değil → süre doldu");
      assert.equal(asked.data.code, "einvoice-cancel-late");
      assert.equal(ctx.count("smm", "GetSMMStatus"), statusBefore + 1, "belirsiz denemeden sonra önce EDM'ye soruldu");
    } finally {
      await ctx.close();
    }
  });
});

// 31e kontrol turu 2 (23.10.2026): A3 (eşzamanlı iki Durum Sorgula'da ileti) ve K45 (iptal izi süre dolduktan sonraki kesin yanıtla kapanır).
// "Nasıl bozulur?": Z1 iki oturum aynı anda Durum Sorgula → geç kalan "yeniden gönderim başladı" der (yanlış neden) → R5; Z2 yeni gönderim izi varken ileti
// "başka sorgu" der → R1; Z3 iptal yanıtı kaybolmuş belgede süre dolunca EDM "iptal edilmemiş" der, iz açık kalır, her İptal Et yeniden sorar → R6;
// Z4 EDM "iptal edilmiş" derse iz kapanmamalı, iptal programda tamamlanmalı → K10.
describe("31e kontrol turu 2: eşzamanlı Durum Sorgula iletisi, iptal izi kesin yanıtla kapanır", () => {
  test("R5 (A3) iki oturum aynı belgede aynı anda Durum Sorgula: geç kalan 409 alır, ileti 'başka bir sorguyla güncellendi' der ('yeniden gönderim' değil); veri doğru", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("makbuz", api.post("/api/workspace/invoices", smmBody(ids.clientId, { eSend: "now" })));
      assert.equal(doc.eStatus, "sent", doc.eMessage);
      const clientB = ctx.server.client();
      assert.equal((await clientB.login("admin", ADMIN_PASSWORD)).status, 200);
      const held = ctx.proxy.hold("GetSMMStatus", { phase: "after" });
      const a = api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
      await held.reached;
      const b = await must("B Durum Sorgula", apiOf(clientB).post(`/api/workspace/invoices/${doc.id}/e-refresh`, {}));
      held.release();
      const late = await a;
      assert.equal(late.status, 409, JSON.stringify(late.data).slice(0, 300));
      assert.equal(late.data.code, "einvoice-status-stale");
      assert.match(String(late.data.error), /başka bir sorguyla güncellendi/);
      assert.doesNotMatch(String(late.data.error), /gönderim/, "yeni gönderim yok: ileti gönderim demez");
      assert.equal((await ctx.card(doc.id)).eStatus, b.eStatus, "B'nin yazdığı durum kaldı");
    } finally {
      await ctx.close();
    }
  });

  test("R6 (K45) e-Arşiv iptal isteği koptu (iz açık) → süre dolunca İptal Et EDM'ye BİR KEZ sorar, 'iptal edilmemiş' → süre doldu + iz kapanır; sonraki İptal Et sormaz, kartta neden yazar", async () => {
    const ctx = await scene();
    try {
      const api = await ctx.reopen();
      const ids = await ctx.setup(api);
      const doc = await must("e-Arşiv", api.post("/api/workspace/invoices", saleBody(ids.personId, { eSend: "now" })));
      assert.equal(doc.eStatus, "sent", doc.eMessage);
      const cut = ctx.proxy.hold("CancelInvoice", { phase: "before" });
      const cancel = api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" });
      await cut.reached;
      cut.release();
      assert.notEqual((await cancel).status, 200);
      assert.equal(ctx.edm.state.cancelled.length, 0, "EDM iptal etmedi");
      await ctx.reopen(`${day(10)}T10:00:00`);
      assert.equal((await ctx.card(doc.id)).cancelRecheck, true, "iz açık: süre dolunca EDM'ye sorulacak");
      const before = ctx.count("fatura", "GetInvoiceStatus");
      const first = await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" });
      assert.equal(first.status, 409);
      assert.equal(first.data.code, "einvoice-cancel-late");
      assert.equal(ctx.count("fatura", "GetInvoiceStatus"), before + 1, "EDM'ye bir kez soruldu");
      const card = await ctx.card(doc.id);
      assert.equal(card.cancelRecheck, false, "EDM'nin kesin yanıtı iptal izini kapattı");
      assert.equal(card.canCancel, false);
      assert.match(String(card.cancelBlock), /iptal süresi doldu/);
      const second = await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "deneme" });
      assert.equal(second.status, 409);
      assert.equal(second.data.code, "einvoice-cancel-late");
      assert.equal(ctx.count("fatura", "GetInvoiceStatus"), before + 1, "ikinci İptal Et EDM'ye yeniden sormadı");
    } finally {
      await ctx.close();
    }
  });
});
