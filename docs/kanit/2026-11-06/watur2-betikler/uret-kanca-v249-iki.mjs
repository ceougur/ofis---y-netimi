// 2.5.0 WhatsApp tur 2 — İş 3 (KULLANICI KARARI S63 = A) göç fikstürü: v2.4.9'un GERÇEK koduyla (git archive v2.4.9 = ccf0b0ca) programın KENDİ API'sinden ve KENDİ işçisinden
// üretilir (CLAUDE.md TEST VERİSİ kuralı; ders 23). Sahte Meta: v2.4.9'un sahte Graph'ı + ÖNÜNDE iki uygulamalı vekil (yeni ağacın test/whatsapp-sahte-graph.mjs
// startTwoAppProxy — dar kontrol tur 1 betiği f2'nin vekili; Meta'da alternatif adres WABA + uygulama başına).
// Senaryo: AYNI WABA iki şirkette iki uygulamayla — 001 WhatsApp'ı Bağla (uygulama B, DestekOfis; programın gerçek yolu connection.saveEmbedded — v2.4.9'da yalnız ortak
// katmanın bağlamına test erişimi var), 002 Elle Bağla (uygulama A, müşterinin). 001 Bildirim Yolu → Yeniden Kaydet (Meta'da B = yolB), SONRA 002 Yeniden Kaydet (Meta'da A = yolA;
// v2.4.9 defterinde WABA başına TEK kayıt → yolA; B'nin yolu defterde artık geçersiz — v2.4.9'un S63 hatası). 001 Ayşe'ye, 002 Bora'ya ekstre (Meta Kabul Etti). Meta'nın son durumu
// (A, B adresleri) bilgi.json'a yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node uret-kanca-v249-iki.mjs <v2.4.9 kökü> <yeni ağaç kökü> <çıktı klasörü>
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const [root, fresh, out] = process.argv.slice(2);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { startFakeGraph } = await imp("test/whatsapp-sahte-graph.mjs");
const { PNID, WABA, TOKEN, URLS, PROGRAM_TEMPLATES, OFFICE } = await imp("test/whatsapp-248-ortak.mjs");
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { startTwoAppProxy } = await import(pathToFileURL(path.join(fresh, "test/whatsapp-sahte-graph.mjs")).href);
const TOKEN_A = "SAHTE-UYGULAMA-A-musteri-belirteci-0123456789-abcdefABCDEF";
const TOKEN_B = "SAHTE-UYGULAMA-B-destekofis-belirteci-0123456789-abcdefXYZ";
const APP_A = "111111111111111";
const APP_B = "222222222222222";
const PUBLIC = "http://ofis-watur2-iki.destekofis.test";
const dataDir = path.join(out, "data");
const backupDir = path.join(out, "backups");
mkdirSync(out, { recursive: true });
const ok = (res, label) => {
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};
function raw(base, method, p, body) {
  const url = new URL(base);
  const payload = body ? Buffer.from(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: p, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const event = statuses => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
const backend = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
backend.state.templates.push(...PROGRAM_TEMPLATES());
const proxy = await startTwoAppProxy({ backend, backendToken: TOKEN, wabaId: WABA, apps: { [TOKEN_A]: { id: APP_A, name: "Müşterinin Uygulaması (A)" }, [TOKEN_B]: { id: APP_B, name: "DestekOfis Mesaj (B)" } }, listing: "hepsi" });
const info = { kod: "v2.4.9 (ccf0b0ca)", node: process.version, apps: { A: APP_A, B: APP_B } };
const server = await startTestServer({ dataDir, backupDir, now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, maxCompanies: 2, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, whatsappGraphUrl: proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
try {
  const api = await loginAdmin(server);
  server.app.store.setSetting("office.name", OFFICE);
  server.app.mobileRemote.setPublicUrl(PUBLIC);
  const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
  const admin = server.app.store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
  server.app.context.whatsapp.connection.saveEmbedded(admin, { token: TOKEN_B, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
  ok(await api.put(URLS.ack, { ack: true }), "001 onay");
  const created = ok(await api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "002");
  const company = created.company || created;
  const q = `?hofCompany=${encodeURIComponent(company.id)}`;
  ok(await api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "002 bağlantı (A)");
  ok(await api.put(`${URLS.ack}${q}`, { ack: true }), "002 onay");
  info.modes = { "001": ok(await api.get(URLS.conn), "001 kart").mode, "002": ok(await api.get(`${URLS.conn}${q}`), "002 kart").mode };
  ok(await api.post(`${URLS.conn}/hook`, {}), "001 Bildirim Yolu (B)");
  const pathB1 = proxy.pathOf(APP_B);
  ok(await api.post(`${URLS.conn}/hook${q}`, {}), "002 Bildirim Yolu (A)");
  const accA = ok(await api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", phone: "0532 111 22 33", openingBalance: "800" }), "cari 001");
  const batch001 = ok(await api.post(URLS.batches, { kind: "statement", ids: [accA.id], preset: "thisMonth" }), "toplu iş 001");
  const accB = ok(await api.post(`/api/workspace/accounts${q}`, { name: "Bora Demir", phone: "0533 444 55 66", openingBalance: "800" }), "cari 002");
  const batch002 = ok(await api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [accB.id], preset: "thisMonth" }), "toplu iş 002");
  await server.app.whatsapp.scheduler.drain();
  const job001 = ok(await api.get(`${URLS.batches}/${batch001.batch.id}`), "iş 001").jobs[0];
  const job002 = ok(await api.get(`${URLS.batches}/${batch002.batch.id}${q}`), "iş 002").jobs[0];
  if (job001.state !== "accepted" || job002.state !== "accepted") throw new Error(`işler: ${job001.state} ${job002.state}`);
  // v2.4.9'un S63 hatası (kanıt): B'nin Meta'daki adresine 001'in teslimi → 404 (defterde tek kayıt A'nın yolu).
  server.clock.advance(60_000);
  const ts = String(Math.floor(server.clock.ms() / 1000));
  info.v249 = {
    bAdresine001Teslimi: await raw(base, "POST", `/wa/kanca/${proxy.pathOf(APP_B)}`, event([{ id: job001.wamid, status: "delivered", timestamp: ts, recipient_id: "905321112233" }])),
    aAdresine002Teslimi: await raw(base, "POST", `/wa/kanca/${proxy.pathOf(APP_A)}`, event([{ id: job002.wamid, status: "delivered", timestamp: ts, recipient_id: "905334445566" }])),
  };
  info.publicUrl = PUBLIC;
  info.company = { id: company.id, code: company.code };
  info.meta = { A: proxy.pathOf(APP_A), B: proxy.pathOf(APP_B), bIlkYol: pathB1 }; // test kurulumunun gizli yolları (gerçek kurulum değil) — yeni testte vekilin kayıtlı adresleri olarak kurulur
  info.jobs = { "001": { id: job001.id, wamid: job001.wamid, batchId: batch001.batch.id, accountId: accA.id }, "002": { id: job002.id, wamid: job002.wamid, batchId: batch002.batch.id, accountId: accB.id } };
  info.metaLog = proxy.log.map(item => `${item.method} ${item.app === APP_A ? "A" : "B"}`);
  info.at = new Date(server.clock.ms()).toISOString();
  const ledger = new DatabaseSync(server.app.whatsapp.ledger.file, { readOnly: true });
  try {
    info.hookEvents = ledger.prepare("SELECT COUNT(*) AS n FROM hook_events").get().n;
    info.modeKeys = ledger.prepare("SELECT COUNT(*) AS n FROM meta WHERE key LIKE 'mode:%'").get().n;
  } finally {
    ledger.close();
  }
  info.version = server.app.store.get("PRAGMA user_version").user_version;
} finally {
  await server.close();
  await proxy.close();
  await backend.close();
}
writeFileSync(path.join(out, "bilgi.json"), `${JSON.stringify(info, null, 1)}\n`);
console.log(JSON.stringify(info));
