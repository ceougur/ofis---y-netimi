// DAR KONTROL (WhatsApp tur 2 + Ç3 tur 4) betik f1 — S58 = A: Yol 2 → Yol 1 geçişinden SONRA eski yolun (DestekOfis uygulamasının alternatif adresi) geç bildirimi
// işareti yeni kiple yeniden koyuyor mu? Kullanım: ROOT=<kod kökü> VARYANT=gec|kontrol|yeni node f1-s58-gec-bildirim.mjs
//   gec     : Yol 2 işi J1 (teslim bilgisi gelmemiş) → Yol 1'e geç → Yol 1 işi J2 → J1'in GEÇ teslimi Yol 2 uygulamasının adresine → 13,5 sa → J2 / Y önizlemesi
//   kontrol : geç bildirim YOK (S58 beklenen davranış: J2 Meta Kabul Etti, Y Daha Önce Gönderildi)
//   yeni    : geç bildirim Yol 1'in KENDİ adresine (J2'nin teslimi değil, J1'in) — işaretin yeni yoldan geldiği durum (karşılaştırma)
// GERÇEK program (startTestServer) + sahte Meta + iki uygulamalı vekil (test/whatsapp-sahte-graph.mjs). Ders 30: lisans servisi ölü adres. Sahte saat.
import http from "node:http";

const ROOT = process.env.ROOT;
const VARYANT = process.env.VARYANT || "gec";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { loginAdmin, startTestServer } = await import(`${ROOT}/test/helpers.mjs`);
const { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA } = await import(`${ROOT}/test/whatsapp-248-ortak.mjs`);
const { startFakeGraph, startTwoAppProxy } = await import(`${ROOT}/test/whatsapp-sahte-graph.mjs`);

const HOUR = 3_600_000;
const TOKEN_A = "SAHTE-UYGULAMA-A-musteri-belirteci-0123456789-abcdefABCDEF";
const TOKEN_B = "SAHTE-UYGULAMA-B-destekofis-belirteci-0123456789-abcdefXYZ";
const APP_A = "111111111111111";
const APP_B = "222222222222222";
const PUBLIC = "http://ofis-dk-f1.destekofis.test";
const statusEvent = statuses => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
function raw(base, method, p, body) {
  const url = new URL(base);
  const payload = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: p, headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
const need = async (promise, label) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
};

const backend = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
backend.state.templates.push(...PROGRAM_TEMPLATES());
for (const tpl of backend.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200; // 12 sa (S58'in koşulu: < 7 gün)
const proxy = await startTwoAppProxy({ backend, backendToken: TOKEN, wabaId: WABA, apps: { [TOKEN_A]: { id: APP_A, name: "Müşteri (A)" }, [TOKEN_B]: { id: APP_B, name: "DestekOfis (B)" } }, listing: "kendi" });
const server = await startTestServer({ now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, whatsappGraphUrl: proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
let verdict = 2;
try {
  const api = await loginAdmin(server);
  server.app.store.setSetting("office.name", OFFICE);
  server.app.mobileRemote.setPublicUrl(PUBLIC);
  const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
  const store = server.app.store;
  const admin = store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
  const conn = server.app.context.whatsapp.connection;
  const mark = () => `işaret="${store.setting("whatsapp.hookSeen", "") ? "VAR" : ""}" kip="${store.setting("whatsapp.hookSeenMode", "")}"`;
  const sent = async (name, phone) => {
    const account = await need(api.post("/api/workspace/accounts", { name, phone, openingBalance: "800" }), "cari");
    const batch = await need(api.post(URLS.batches, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
    await server.app.whatsapp.scheduler.drain();
    const job = (await need(api.get(`${URLS.batches}/${batch.batch.id}`), "iş")).jobs[0];
    server.clock.advance(60_000);
    return { account, batchId: batch.batch.id, job };
  };
  const state = async batchId => (await need(api.get(`${URLS.batches}/${batchId}`), "iş")).jobs[0].state;
  // 1) Yol 2 (WhatsApp'ı Bağla) — DestekOfis uygulamasının adresi kaydedilir; bildirim yolu çalışıyor (imzalı 'sent')
  conn.saveEmbedded(admin, { token: TOKEN_B, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
  await need(api.put(URLS.ack, { ack: true }), "onay");
  await need(api.post(`${URLS.conn}/hook`, {}), "Yol 2 Yeniden Kaydet");
  const pathB = proxy.pathOf(APP_B);
  const j1 = await sent("Ayşe Yılmaz", "0532 111 22 33");
  server.app.context.whatsapp.queue.applyStatuses([{ id: j1.job.wamid, status: "sent", timestamp: String(Math.floor(server.clock.ms() / 1000)), recipient_id: "905321112233" }], { phoneNumberId: PNID, signed: true });
  console.log(`1) Yol 2: J1 ${j1.job.state} (${j1.job.wamid}) → imzalı 'sent' → J1 ${await state(j1.batchId)}; ${mark()}; B yolu ${pathB ? "Meta'da kayıtlı" : "YOK"}`);
  // 2) Yol 1'e geçiş (Elle Bağla) — S58: işaret sıfırlanmalı; Yol 1'in kendi adresi kaydedilir
  await need(api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "Elle Bağla");
  console.log(`2) Yol 1'e geçildi (kip ${conn.read().mode}); ${mark()}`);
  await need(api.post(`${URLS.conn}/hook`, {}), "Yol 1 Yeniden Kaydet");
  const pathA = proxy.pathOf(APP_A);
  // 3) Yol 1 işi J2 (teslim bilgisi HİÇ gelmeyecek: Yol 1'in bildirim yolu çalışmıyor)
  const j2 = await sent("Bora Demir", "0533 444 55 66");
  console.log(`3) Yol 1: J2 ${j2.job.state} (${j2.job.wamid})`);
  // 4) J1'in GEÇ teslimi (alıcının telefonu kapalıydı) — Meta DestekOfis uygulamasının (B) alternatif adresine yollar
  if (VARYANT !== "kontrol") {
    const target = VARYANT === "yeni" ? pathA : pathB;
    const r = await raw(base, "POST", `/wa/kanca/${target}`, statusEvent([{ id: j1.job.wamid, status: "delivered", timestamp: String(Math.floor(server.clock.ms() / 1000)), recipient_id: "905321112233" }]));
    console.log(`4) J1'in geç teslimi ${VARYANT === "yeni" ? "A (Yol 1'in kendi)" : "B (ESKİ yol — DestekOfis uygulaması)"} adresine: HTTP ${r.status}; J1 ${await state(j1.batchId)}; ${mark()}`);
  } else console.log("4) (kontrol) geç bildirim yok");
  // 5) 13,5 sa sonra bakım turu — J2'nin teslim bilgisi hiç gelmedi
  server.clock.advance(13.5 * HOUR);
  await server.app.whatsapp.scheduler.drain();
  const s2 = await state(j2.batchId);
  const preview = await need(api.post(URLS.preview, { kind: "statement", ids: [j2.account.id], preset: "thisMonth" }), "önizleme");
  const skip = (preview.people || []).map(p => p.skip || "gönderilecek").join(", ");
  console.log(`5) 13,5 sa sonra: J2 ${s2}; Bora Demir önizlemesi: ${skip}; ${mark()}`);
  verdict = s2 === "expired" ? 1 : 0;
  console.log(`# SONUÇ (${VARYANT}): ${verdict ? "J2 'Süresi Doldu' + kişi 'gönderilecek' — Yol 1'in bildirimi hiç gelmediği hâlde işaret geçerli sayıldı" : "J2 Meta Kabul Etti — işaret sayılmadı"}`);
} finally {
  await server.close().catch(() => {});
  await proxy.close();
  await backend.close();
}
process.exit(verdict);
