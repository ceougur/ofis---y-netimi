// 2.4.8 W2/W3/W9 test düzeneği: GERÇEK program (startTestServer) + yerel SAHTE Meta Graph sunucusu (test/whatsapp-sahte-graph.mjs; yalnız 127.0.0.1 — ders 30)
// + elle sürülen gönderim işçisi (whatsappWorker "manual"; ders 20) + sahte saat (ders 13). UYARI: sahte Graph programı yazan elden çıkmıştır, kâhin DEĞİLDİR
// (ders 5); beklenen sayılar planın kurallarından (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2) ve testin girdiği veriden yazılır, programın kodundan okunmaz.
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

export const TOKEN = "SAHTE-W2-belirtec-Gizli_0123456789-abcdefABCDEF-xyz";
export const PNID = "106540352242922";
export const WABA = "102290129340398";
export const OFFICE = "Örnek Ticaret";
// Şablonlar PLANDAN (§6 W5): destekofis_ekstre (belge başlıklı, 4 değişken), destekofis_odeme_hatirlatma (5 değişken); dil tr, kategori UTILITY.
export const PROGRAM_TEMPLATES = () => [
  { name: "destekofis_ekstre", language: "tr", status: "APPROVED", category: "UTILITY", header: "DOCUMENT", params: 4, id: "900000000000011" },
  { name: "destekofis_odeme_hatirlatma", language: "tr", status: "APPROVED", category: "UTILITY", params: 5, id: "900000000000012" },
];
export const URLS = {
  conn: "/api/workspace/whatsapp/connection",
  ack: "/api/workspace/whatsapp/ack",
  batches: "/api/workspace/whatsapp/batches",
  preview: "/api/workspace/whatsapp/batches/preview",
  stats: "/api/workspace/whatsapp/stats",
  sending: "/api/workspace/whatsapp/sending-settings",
};

/** Program + sahte Meta; options startTestServer'a geçer (dataDir verilirse aynı veriyle yeniden açılır). */
export async function startWa({ fake = null, connect = true, ack = true, office = OFFICE, ...options } = {}) {
  const graph = fake || (await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA }));
  if (!fake) graph.state.templates.push(...PROGRAM_TEMPLATES());
  const server = await startTestServer({ now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, whatsappGraphUrl: graph.url, whatsappTimeoutMs: 800, whatsappGapMs: 0, ...options });
  let api;
  try {
    api = await loginAdmin(server);
    if (office !== null) server.app.store.setSetting("office.name", office);
    if (connect) {
      const res = await api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
      if (res.status !== 200) throw new Error(`bağlantı kaydedilemedi: ${res.status} ${JSON.stringify(res.data)}`);
    }
    if (ack) {
      const res = await api.put(URLS.ack, { ack: true });
      if (res.status !== 200) throw new Error(`onay yazılamadı: ${res.status} ${JSON.stringify(res.data)}`);
    }
  } catch (error) {
    // Kurulum düştü (ör. eski kodda uç yok): açık sunucular kapanır, test süreci asılı kalmaz.
    await server.close();
    if (!fake) await graph.close();
    throw error;
  }
  const wa = server.app.whatsapp;
  const ctx = {
    fake: graph,
    server,
    api,
    wa,
    store: server.app.store,
    clock: server.clock,
    /** Programın kendi kancası: durum bildirimi (W9 uçtan uca öncesi çekirdek sınaması) — company: 002 için app. */
    statuses: (list, options = {}) => (options.app || server.app).context.whatsapp.queue.applyStatuses(list, { phoneNumberId: PNID, ...options }),
    async account(name, phone, opening = 0, extra = {}) {
      const res = await api.post("/api/workspace/accounts", { name, phone, ...(opening ? { openingBalance: String(opening) } : {}), ...extra });
      if (res.status !== 200) throw new Error(`cari açılamadı: ${res.status} ${JSON.stringify(res.data)}`);
      return res.data.data;
    },
    drain: (o = {}) => wa.scheduler.drain(o),
    batch: body => api.post(URLS.batches, body),
    detail: async id => (await api.get(`${URLS.batches}/${id}`)).data.data,
    jobs: async id => (await ctx.detail(id)).jobs,
    messages: () => graph.state.messages,
    messageRequests: () => graph.requests.filter(item => item.method === "POST" && /\/messages$/.test(item.path)),
    async close() {
      await server.close();
      if (!fake) await graph.close();
    },
  };
  return ctx;
}
