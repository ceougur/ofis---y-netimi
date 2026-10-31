// 2.4.8 İş M (T1 ayıklaması PROGRAM-HATA, ORTA; çift gönderim — sürücü dökümü K7-05): taşınan veride Meta'nın geç "delivered" bildirimi yeni bilgisayarın kancasına
// ulaşıyor ama sahip araması yalnız makine defterine bakıyordu (hook.mjs companyOfWamid / companyOfJob) → bildirim düşüyor, teslim yazılmıyor, aynı dönem ekstresi
// kişiye yeniden gidiyordu. Karar: soru 8 / K7 ("taşıma ile durmuş Meta Bekletti … geç teslim gelirse sayılır") + "KİME KAÇ KEZ" ilkesi (5) (taşınan veride aynı kurallar).
// Düzeltme: sahip defterde yoksa wamid şirket dosyalarında, yalnız bu defterde AÇILMAMIŞ toplu işlerde aranır; şirket kendi dosyasındaki işe yazar; WABA aynı olmalı.
// Akış (K7-05): 10:00 A kabul → 10:00:10 131049 (Meta Bekletti) → 11:00 veri başka bilgisayara (defter olmadan) taşındı → 11:30 imzasız (Elle Bağla) "delivered" yeni
// bilgisayarın kancasına (HTTP, uzak dinleyici) → 12:00 yeni gönderimde A "Daha Önce Gönderildi". İki şirket: bildirim yalnız wamid'in kendi şirketine yazılır.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const localIso = (y, m, d, h = 10, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s, 0).toISOString();
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const PUBLIC = "http://ofis-dk9m.destekofis.test";

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const statusEvent = statuses => ({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
function post(base, secret, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = http.request(`${base}/wa/kanca/${secret}`, { method: "POST", headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}
const tsOf = iso => String(Math.floor(Date.parse(iso) / 1000));

/** Kaynak: 001'de A, 002'de B — ikisi de 10:00 Bu Ay kabul, 10:00:10 131049 (Meta Bekletti). Taşınır; yeni bilgisayar 11:00. Dönüş: { other, a, b, jobA, jobB, q2, close }. */
async function movedHeld() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk9m-kaynak-"));
  const copy = mkdtempSync(path.join(tmpdir(), "destekofis-dk9m-tasindi-"));
  const ctx = await startWa({ dataDir, maxCompanies: 2, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
  const fake = ctx.fake;
  let other = null;
  try {
    const queues = new Map();
    const sch = ctx.server.app.whatsapp.scheduler;
    const reg = sch.register.bind(sch);
    sch.register = (key, queue) => {
      queues.set(String(key), queue);
      return reg(key, queue);
    };
    const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
    const second = created.company || created;
    const q2 = `hofCompany=${encodeURIComponent(second.id)}`;
    await ok(await ctx.api.put(`${URLS.conn}?${q2}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantı");
    await ok(await ctx.api.put(`${URLS.ack}?${q2}`, { ack: true }), "002 onay");
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const b = await ok(await ctx.api.post(`/api/workspace/accounts?${q2}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "002 cari");
    const oa = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "001 Bu Ay");
    const ob = await ok(await ctx.api.post(`${URLS.batches}?${q2}`, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "002 Bu Ay");
    await ctx.drain();
    const jobA = (await ctx.jobs(oa.batch.id))[0];
    const jobB = (await ctx.api.get(`${URLS.batches}/${ob.batch.id}?${q2}`)).data.data.jobs[0];
    assert.deepEqual([jobA.state, jobB.state], ["accepted", "accepted"], "ön koşul: iki şirkette kabul");
    ctx.clock.set(localIso(2026, 11, 3, 10, 0, 10));
    const held = (job, phone) => ({ id: job.wamid, status: "failed", timestamp: tsOf(localIso(2026, 11, 3, 10, 0, 10)), recipient_id: phone, errors: [{ code: 131049, title: "x" }] });
    assert.equal(ctx.statuses([held(jobA, "905321112233")]).applied, 1, "ön koşul: 001 Meta Bekletti");
    assert.equal(queues.get(second.id).applyStatuses([held(jobB, "905334445566")], { phoneNumberId: PNID }).applied, 1, "ön koşul: 002 Meta Bekletti");
    await ctx.server.close();
    cpSync(dataDir, copy, { recursive: true });
    for (const name of readdirSync(copy)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(copy, name));
    other = await startWa({ dataDir: copy, fake, maxCompanies: 2, connect: false, ack: false, now: { time: localIso(2026, 11, 3, 11), fixed: true } });
    const remote = await other.server.app.listenRemote(0, "127.0.0.1");
    other.server.app.mobileRemote.setPublicUrl(PUBLIC);
    await other.server.app.context.whatsapp.connection.registerHook(null, PUBLIC);
    const secret = new URL(fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
    return {
      other,
      a,
      b,
      jobA,
      jobB,
      q2,
      hook: body => post(`http://127.0.0.1:${remote.port}`, secret, body),
      async close() {
        await other?.server.close();
        await fake.close();
        removeTestDir(dataDir);
        removeTestDir(copy);
      },
    };
  } catch (error) {
    await other?.server.close().catch(() => {});
    await fake.close().catch(() => {});
    removeTestDir(dataDir);
    removeTestDir(copy);
    throw error;
  }
}

describe("2.4.8 İş M — taşınan veride geç teslim bildirimi yeni bilgisayarda yazılır (K7-05)", () => {
  it("11:30 imzasız 'delivered' (A'nın 1. denemesi) → 200, A Teslim Edildi, Bu Ay 1; 12:00 yeni gönderimde A 'Daha Önce Gönderildi'; 002'nin işi değişmez", async () => {
    const m = await movedHeld();
    try {
      const { other } = m;
      const before = await other.detail((await other.api.get(`${URLS.batches}?limit=50`)).data.data.find(batch => batch.counts?.stopped || batch.state === "stopped")?.id);
      assert.equal(before.jobs[0].state, "stopped", "ön koşul: taşınan veride Meta Bekletti iş Durduruldu (Taşınan Veri)");
      other.clock.set(localIso(2026, 11, 3, 11, 30));
      const res = await m.hook(statusEvent([{ id: m.jobA.wamid, status: "delivered", timestamp: tsOf(localIso(2026, 11, 3, 11, 30)), recipient_id: "905321112233" }]));
      assert.equal(res.status, 200, `kanca 200 (${res.status} ${res.text})`);
      const after = await other.detail(before.id);
      assert.equal(after.jobs[0].state, "delivered", "A'nın işi Teslim Edildi (taşınan verideki kendi wamid'iyle)");
      assert.equal((await ok(await other.api.get(URLS.stats), "sayaç")).delivered, 1, "Bu Ay Gönderilen İleti Sayısı 1");
      other.clock.set(localIso(2026, 11, 3, 12, 0));
      const pv = await ok(await other.api.post(URLS.preview, { kind: "statement", ids: [m.a.id], preset: "thisMonth" }), "12:00 Bu Ay");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "geç teslim → aynı dönem ikinci ekstre gitmez");
      const jobsB = (await other.api.get(`${URLS.batches}?limit=50&${m.q2}`)).data.data;
      const detailB = (await other.api.get(`${URLS.batches}/${jobsB[0].id}?${m.q2}`)).data.data;
      assert.equal(detailB.jobs[0].state, "stopped", "002'nin işi bu bildirimle değişmez");
    } finally {
      await m.close();
    }
  });

  it("iki şirket: 002'nin wamid'iyle gelen bildirim yalnız 002'ye yazılır (001'in işi değişmez); bilinmeyen wamid hiçbir şeye yazılmaz", async () => {
    const m = await movedHeld();
    try {
      const { other } = m;
      other.clock.set(localIso(2026, 11, 3, 11, 30));
      const res = await m.hook(statusEvent([
        { id: m.jobB.wamid, status: "delivered", timestamp: tsOf(localIso(2026, 11, 3, 11, 30)), recipient_id: "905334445566" },
        { id: "wamid.BILINMEYEN-dk9m", status: "delivered", timestamp: tsOf(localIso(2026, 11, 3, 11, 30)), recipient_id: "905321112233" },
      ]));
      assert.equal(res.status, 200, `kanca 200 (${res.status} ${res.text})`);
      const listB = (await other.api.get(`${URLS.batches}?limit=50&${m.q2}`)).data.data;
      assert.equal((await other.api.get(`${URLS.batches}/${listB[0].id}?${m.q2}`)).data.data.jobs[0].state, "delivered", "002'nin işi Teslim Edildi");
      const listA = (await other.api.get(`${URLS.batches}?limit=50`)).data.data;
      assert.equal((await other.detail(listA[0].id)).jobs[0].state, "stopped", "001'in işi değişmedi (başka şirketin wamid'i 001'e yazılmaz)");
      // "Bu Ay" sayacı WABA kapsamında (iki şirket aynı WABA; plan §7a 19) — şirket ayrımı defterin şirket sayımından okunur.
      const counts = other.server.app.whatsapp.ledger.monthCounts({ companyId: "sirket-001", wabaId: WABA, from: "2026-10-31T21:00:00.000Z", to: "2026-11-30T21:00:00.000Z" });
      assert.deepEqual([counts.company.delivered, counts.waba.delivered], [0, 1], `001'de teslim yok, WABA'da 1 (002) (geldi ${JSON.stringify(counts)})`);
      other.clock.set(localIso(2026, 11, 3, 12, 0));
      assert.deepEqual(skipOf(await ok(await other.api.post(URLS.preview, { kind: "statement", ids: [m.a.id], preset: "thisMonth" }), "001 Bu Ay")), ["gönderilecek"], "001'de A sayılmaz (teslim yok, taşınmayla durdu)");
    } finally {
      await m.close();
    }
  });
});
