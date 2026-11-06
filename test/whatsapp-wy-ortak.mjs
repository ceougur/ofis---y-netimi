// 2.5.0 WY test düzeneği (test/whatsapp-wy-imzasiz-250.test.mjs ve not defterindeki yeniden üretim betiği ortak kullanır): GERÇEK program (iki şirket) + GERÇEK kapıcı
// (bulut/kapi/kapi.mjs, yerel; test/kapi-yerel.mjs — Meta imzası X-Hub-Signature-256 kapıcıda DestekOfis uygulama sırrıyla doğrulanır: "wa1" imzalı / "wa0" imzasız) + yerel
// SAHTE Meta Graph (aynı el — kâhin DEĞİL, ders 5). Yeniden açılış düzeneğinde kapıcı yok (bildirim imzasız). Ders 30: lisans servisi yerel ölü adres. Ders 13: sahte saat.
// Ders 48 (Windows): hideFile veri dosyasını YENİDEN ADLANDIRIR (şirket kapatıldıktan / program kapandıktan sonra; T-Ksil düzeni).
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, renameSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClock } from "../server/lib/clock.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { kokeneIlet, startKapi } from "./kapi-yerel.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA } from "./whatsapp-248-ortak.mjs";

export { ADMIN_PASSWORD };
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const MACHINE = "0123456789abcdef0123456789abcdef";
const APP_SECRET = "destekofis-uygulama-sirri-WY-SAHTE-0123456789";
const EMBEDDED_EVENT = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
const sign = body => `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
const statusEvent = (statuses, entryId = WABA) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: entryId, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

function raw(base, method, pathAndQuery, { body = null, headers = {} } = {}) {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathAndQuery, headers: { ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}), ...headers } }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const adminUser = server => server.app.store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
/** Bağlantıyı Yol 2'ye çevirir — programın GERÇEK yolu (connection.saveEmbedded: kayıt + ortak kayda duyuru; W7'nin kapıcıdan aldığı belirteçle yaptığı). */
const toEmbedded = (app, server) => app.context.whatsapp.connection.saveEmbedded(adminUser(server), { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: EMBEDDED_EVENT });
function ledgerSql(file, query, ...args) {
  const reader = new DatabaseSync(file, { readOnly: true });
  try {
    return reader.prepare(query).get(...args) || null;
  } finally {
    reader.close();
  }
}
/** 002'nin veri dosyasını yerinden alır (kalıcı yokluk; T-Ksil düzeni). Dönüş: geri koyan işlev. */
export function hideFile(dataDir) {
  const root = path.join(dataDir, "sirketler");
  const dirs = readdirSync(root);
  assert.equal(dirs.length, 1, "ön koşul: tek ek şirket klasörü");
  const file = resolveDbPath(path.join(root, dirs[0]));
  const moved = [];
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(file + suffix)) {
      renameSync(file + suffix, `${file + suffix}.yok`);
      moved.push(file + suffix);
    }
  }
  assert.ok(moved.length, "ön koşul: veri dosyası yerinden alındı");
  return () => {
    for (const name of moved) renameSync(`${name}.yok`, name);
  };
}

/**
 * Program (iki şirket) + kapıcı + sahte Meta. root / second: "manual" (Elle Bağla) | "embedded" (WhatsApp'ı Bağla) — iki şirket AYNI WABA'yı kullanır (ortak kanca adresi).
 * Dönüş: s = { server, api, fake, clock, company, q, child(), post(statuses, { signed }), job(batchId), sent(name, phone), skip(id), buAy(), delivered(jobId), deliveries(jobId),
 * failures(jobId), busy(on), close() }.
 */
export async function kurulum({ root = "manual", second = "embedded" } = {}) {
  const clock = createClock({ time: "2026-11-03T09:00:00+03:00", fixed: true });
  const lisans = lisansAnahtari();
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-WY-TEST" });
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  fake.state.templates.push(...PROGRAM_TEMPLATES());
  const origins = new Map();
  const kapi = await startKapi({
    now: () => clock.ms(),
    trustedKeys: lisans.trusted,
    lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }),
    fetchOrigin: async (request, ofis) => {
      const base = origins.get(ofis);
      if (!base) throw new TypeError("fetch failed (tünel yok)");
      return kokeneIlet(request, base);
    },
  });
  kapi.env.WA_UYGULAMA_SIRRI = APP_SECRET;
  let server;
  try {
    server = await startTestServer({
      now: clock,
      remoteNow: clock,
      mobileKapiUrl: kapi.base,
      maxCompanies: 2,
      env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL },
      license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.wy.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
      whatsappGraphUrl: fake.url,
      whatsappTimeoutMs: 800,
      whatsappGapMs: 0,
      tunnel: { enabled: false, tickMs: 3_600_000, firstTickMs: 3_600_000 },
    });
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const sync = server.app.mobileSync;
    const ofis = await sync.ofis();
    await sync.kayitGonder();
    const remote = await server.app.listenRemote(0, "127.0.0.1");
    origins.set(ofis.id, `http://127.0.0.1:${remote.port}`);
    const host = kapi.ofisHost(ofis.id);
    server.app.mobileRemote.setPublicUrl(`http://${host}`);
    const api = await loginAdmin(server);
    server.app.store.setSetting("office.name", OFFICE);
    await ok(await api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "001 bağlantı");
    await ok(await api.put(URLS.ack, { ack: true }), "001 onay");
    if (root === "embedded") toEmbedded(server.app, server);
    const created = await ok(await api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
    const company = created.company || created;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    await ok(await api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantı");
    await ok(await api.put(`${URLS.ack}${q}`, { ack: true }), "002 onay");
    const child = () => server.app.openCompany(company.id);
    if (second === "embedded") toEmbedded(child(), server);
    assert.equal(child().context.whatsapp.connection.read().mode, second, "ön koşul: 002'nin bağlantı kipi");
    assert.equal(server.app.context.whatsapp.connection.read().mode, root, "ön koşul: 001'in bağlantı kipi");
    await child().context.whatsapp.connection.registerHook(null, `http://${host}`);
    const secret = new URL(fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
    const ledgerFile = server.app.whatsapp.ledger.file;
    const s = {
      server,
      api,
      fake,
      clock,
      company,
      q,
      child,
      ledgerFile,
      /** Meta'nın bildirimi: kapıcıya ofisin telefon adresiyle; signed → DestekOfis uygulama sırrıyla X-Hub-Signature-256. */
      post: (statuses, { signed = false } = {}) => {
        const body = statusEvent(statuses);
        return raw(kapi.base, "POST", `/wa/kanca/${secret}`, { body, headers: { host, ...(signed ? { "x-hub-signature-256": sign(body) } : {}) } });
      },
      /**
       * 2.5.0 WhatsApp tur 1 (S41): Meta'nın bildirimi Elle Bağla'nın UYGULAMA DÜZEYİ adresine (Webhook Bilgileri'ndeki Callback URL; kapıcıdan, ofisin telefon adresiyle).
       * entryId: zarftaki WABA kimliği (varsayılan bağlı WABA).
       */
      postApp: async (statuses, { signed = false, entryId = WABA } = {}) => {
        const info = await ok(await api.get("/api/workspace/whatsapp/app-webhook"), "webhook bilgileri");
        assert.equal(info.ready, true, `ön koşul: uygulama düzeyi adres hazır (${info.reason})`);
        const body = statusEvent(statuses, entryId);
        return raw(kapi.base, "POST", `/wa/kanca/${new URL(info.callbackUrl).pathname.split("/").pop()}`, { body, headers: { host, ...(signed ? { "x-hub-signature-256": sign(body) } : {}) } });
      },
      job: async batchId => (await ok(await api.get(`${URLS.batches}/${batchId}${q}`), "toplu iş")).jobs[0],
      /** 002'de bir cariye ekstre: kabul edilmiş iş { batchId, job, accountId }. */
      async sent(name, phone) {
        const account = await ok(await api.post(`/api/workspace/accounts${q}`, { name, phone, openingBalance: "800" }), "cari");
        const batch = await ok(await api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
        await server.app.whatsapp.scheduler.drain();
        const job = await s.job(batch.batch.id);
        assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
        assert.ok(job.wamid, "ön koşul: wamid");
        clock.advance(60_000);
        return { batchId: batch.batch.id, job, accountId: account.id };
      },
      skip: async accountId => skipOf(await ok(await api.post(`${URLS.preview}${q}`, { kind: "statement", ids: [accountId], preset: "thisMonth" }), "önizleme")),
      buAy: async () => (await ok(await api.get(`${URLS.stats}${q}`), "Bu Ay")).delivered,
      delivered: jobId => Boolean(ledgerSql(ledgerFile, "SELECT 1 AS x FROM deliveries WHERE job_id = ?", jobId)),
      deliveries: jobId => ledgerSql(ledgerFile, "SELECT COUNT(*) AS n FROM attempt_deliveries WHERE job_id = ?", jobId).n,
      failures: jobId => ledgerSql(ledgerFile, "SELECT COUNT(*) AS n FROM failures WHERE job_id = ?", jobId).n,
      ts: () => String(Math.floor(clock.ms() / 1000)),
      busy: on => (on ? server.app.context.busyCompanies.set(company.id, "“002” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.") : server.app.context.busyCompanies.delete(company.id)),
      async close() {
        await server.close().catch(() => {});
        await kapi.close();
        await fake.close();
      },
    };
    return s;
  } catch (error) {
    await server?.close().catch(() => {});
    await kapi.close();
    await fake.close();
    throw error;
  }
}
export const st = (s, wamid, status, extra = {}) => ({ id: wamid, status, timestamp: s.ts(), recipient_id: "905334445566", ...extra });
export const failed = (s, wamid, code = 131026) => st(s, wamid, "failed", { errors: [{ code, title: "x" }] });

/** Kapıcısız program (bildirim imzasız — kapıcı yokken işaret denetimi yok): yeniden açılış düzeneği. */
async function program(dataDir, backupDir, fake) {
  const server = await startTestServer({ dataDir, backupDir, now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, maxCompanies: 2, env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL }, whatsappGraphUrl: fake.url, whatsappTimeoutMs: 800, whatsappGapMs: 0 });
  const remote = await server.app.listenRemote(0, "127.0.0.1");
  return { server, base: `http://127.0.0.1:${remote.port}` };
}
/**
 * 002 (mode kipinde) bir ekstre gönderir, program kapanır, 002'nin veri dosyası yerinden alınır, program YENİDEN açılır (açılış taraması 002'nin kipini okuyamaz) ve imzasız
 * delivered gelir. forgetMode: kapanıştan sonra makine defterindeki kip kayıtları silinir (2.5.0 öncesi defter benzetimi). Dönüş: { status, text, delivered }.
 */
export async function yenidenAcilis({ mode, forgetMode = false }) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-wy-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  fake.state.templates.push(...PROGRAM_TEMPLATES());
  let p = null;
  try {
    p = await program(dataDir, backupDir, fake);
    const api = await loginAdmin(p.server);
    p.server.app.store.setSetting("office.name", OFFICE);
    p.server.app.mobileRemote.setPublicUrl("http://ofis-wy.destekofis.test");
    const created = await ok(await api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
    const company = created.company || created;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    await ok(await api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantı");
    await ok(await api.put(`${URLS.ack}${q}`, { ack: true }), "002 onay");
    const child = p.server.app.openCompany(company.id);
    if (mode === "embedded") toEmbedded(child, p.server);
    const account = await ok(await api.post(`/api/workspace/accounts${q}`, { name: "Gül Er", phone: "0533 444 55 72", openingBalance: "800" }), "cari");
    const batch = await ok(await api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
    await p.server.app.whatsapp.scheduler.drain();
    const job = (await ok(await api.get(`${URLS.batches}/${batch.batch.id}${q}`), "toplu iş")).jobs[0];
    assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
    await child.context.whatsapp.connection.registerHook(null, "http://ofis-wy.destekofis.test");
    const secret = new URL(fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
    const ledgerFile = p.server.app.whatsapp.ledger.file;
    await p.server.close();
    p = null;
    // 2.5.0 öncesi defter benzetimi: kip kaydı yok (yalnız bu düzenekte; defterin meta tablosu anahtar–değerdir, yalnız-ekleme tetiği yok).
    if (forgetMode) {
      const db = new DatabaseSync(ledgerFile);
      try {
        db.prepare("DELETE FROM meta WHERE key LIKE 'mode:%'").run();
      } finally {
        db.close();
      }
    }
    hideFile(dataDir); // açılışta 002'nin dosyası yok: ortak kayıt kipini bilemez
    p = await program(dataDir, backupDir, fake);
    const body = statusEvent([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(Date.parse("2026-11-03T09:10:00+03:00") / 1000)), recipient_id: "905334445572" }]);
    const res = await raw(p.base, "POST", `/wa/kanca/${secret}`, { body });
    return { status: res.status, text: res.text, delivered: Boolean(ledgerSql(ledgerFile, "SELECT 1 AS x FROM deliveries WHERE job_id = ?", job.id)) };
  } finally {
    await p?.server.close().catch(() => {});
    await fake.close();
    removeTestDir(root);
  }
}
