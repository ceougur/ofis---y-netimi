// W1 test düzeneği: yerel SAHTE Meta Graph sunucusu (yalnız 127.0.0.1; testler gerçek Meta'ya GİTMEZ — ders 30, test/whatsapp-meta-izolasyon.test.mjs).
// Kapsamı W1: GET /<WABA>/phone_numbers, GET /<PHONE_NUMBER_ID>?fields=whatsapp_business_manager_messaging_limit, GET /<WABA>/message_templates,
// POST /<PHONE_NUMBER_ID>/messages. Yanıt biçimleri Meta belgelerinin örneklerinden (embedded-signup "phone numbers", messaging-limits,
// template-management, send-messages, support/error-codes). UYARI: bu düzenek programı yazan elden çıkmıştır; kâhin DEĞİLDİR (ders 5) —
// bağımsız sahte Meta K0'da (kodu görmeyen ajan) yazılır.
//
// startFakeGraph({ token, phoneNumberId, wabaId }) → { url, requests, set(patch), close() }
//   requests: { method, path, version, query, auth, body }[]
//   set({ tier, numbers, templates, failNext: { match, status, body | raw }, delayMs, echoToken })
// 2.4.8 W2/W3/W9 ekleri (aynı el — kâhin DEĞİL): POST /<PNID>/media (çok parçalı; state.media), DELETE /<MEDIA_ID>, POST /<WABA>/subscribed_apps
// (state.subscriptions), ileti isteğinde belge başlığının medya kimliği ve şablonun değişken sayısı (template.params) denetimi, state.messages (gelen ileti
// istekleri), alıcıya özgü hata (recipientErrors: { "+90…": { status, body } }), yanıtsız istek (hang: RegExp → yanıt hiç gelmez; dropAfter: RegExp → istek
// işlenir, bağlantı yanıtsız kesilir), failQueue: [{ match, status, body }] sırayla.
import http from "node:http";

const metaError = (code, message, extra = {}) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: extra.details || message }, fbtrace_id: "AbCdEfGhIjKlMnOp", ...(extra.subcode ? { error_subcode: extra.subcode } : {}) } });

export async function startFakeGraph({ token, phoneNumberId, wabaId, display = "+90 212 555 01 02", verifiedName = "Örnek Ticaret Ltd" } = {}) {
  const state = {
    token,
    tier: "TIER_250",
    numbers: [{ verified_name: verifiedName, code_verification_status: "VERIFIED", display_phone_number: display, quality_rating: "GREEN", platform_type: "CLOUD_API", throughput: { level: "STANDARD" }, id: phoneNumberId }],
    templates: [
      { name: "hello_world", language: "en_US", status: "APPROVED", category: "UTILITY", id: "900000000000001" },
      { name: "order_confirmation", language: "en_US", status: "APPROVED", category: "UTILITY", id: "900000000000002" },
    ],
    failNext: null,
    failQueue: [],
    delayMs: 0,
    echoToken: false,
    sent: 0,
    media: new Map(),
    deleted: [],
    messages: [],
    subscriptions: [],
    recipientErrors: {},
    hang: null,
    dropAfter: null,
    mediaSeq: 0,
    closeConnections: false,
  };
  // Çok parçalı gövdeden alanlar (ad → { value | filename, type, data }).
  const multipart = (raw, type) => {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type || "");
    const marker = boundary ? `--${boundary[1] || boundary[2]}` : null;
    const fields = {};
    if (!marker) return fields;
    const text = raw.toString("latin1");
    for (const part of text.split(marker).slice(1, -1)) {
      const cut = part.indexOf("\r\n\r\n");
      if (cut < 0) continue;
      const head = part.slice(0, cut);
      const body = part.slice(cut + 4, part.length - 2);
      const name = /name="([^"]+)"/.exec(head)?.[1];
      const filename = /filename="([^"]*)"/.exec(head)?.[1];
      const ctype = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] || "";
      if (!name) continue;
      fields[name] = filename !== undefined ? { filename: Buffer.from(filename, "latin1").toString("utf8"), type: ctype, data: Buffer.from(body, "latin1") } : { value: Buffer.from(body, "latin1").toString("utf8") };
    }
    return fields;
  };
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
      const rawBody = Buffer.concat(chunks);
      const body = String(req.headers["content-type"] || "").startsWith("multipart/") ? "" : rawBody.toString("utf8");
      const url = new URL(req.url, "http://127.0.0.1");
      const match = /^\/(v\d+\.\d+)\/(.*)$/.exec(url.pathname);
      const entry = { method: req.method, path: match ? `/${match[2]}` : url.pathname, version: match ? match[1] : "", query: Object.fromEntries(url.searchParams), auth: String(req.headers.authorization || ""), body: body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : null };
      requests.push(entry);
      const reply = (status, payload, raw = null) => {
        if (res.writableEnded) return;
        if (raw !== null) {
          res.writeHead(status, { "content-type": "text/html" });
          res.end(raw);
          return;
        }
        const text = JSON.stringify(payload);
        // closeConnections: her yanıttan sonra bağlantı kapanır (havuzda canlı soket kalmaz → offline() sonrası istek kesin ECONNREFUSED).
        res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text), ...(state.closeConnections ? { connection: "close" } : {}) });
        res.end(text);
      };
      if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
      const line = `${req.method} ${entry.path}`;
      if (state.hang && state.hang.test(line)) return; // yanıt hiç gelmez (istemci zaman aşımı)
      const queued = state.failQueue.findIndex(item => !item.match || item.match.test(line));
      if (queued >= 0) {
        const [failure] = state.failQueue.splice(queued, 1);
        if (failure.destroy) return req.socket.destroy();
        return reply(failure.status || 400, failure.body || null, failure.raw ?? null);
      }
      if (state.failNext && (!state.failNext.match || state.failNext.match.test(`${req.method} ${entry.path}`))) {
        const failure = state.failNext;
        if (!failure.sticky) state.failNext = null;
        return reply(failure.status || 400, failure.body || null, failure.raw ?? null);
      }
      if (!match) return reply(404, metaError(100, "Unknown path components"));
      const presented = /^Bearer (.+)$/.exec(entry.auth)?.[1] || "";
      if (presented !== state.token) {
        // echoToken: en kötü durum — Graph hata metni belirteci yankılar (program bunu ekrana/kayda taşımamalı).
        return reply(401, metaError(190, state.echoToken ? `Invalid OAuth access token - Cannot parse access token: ${presented}` : "Invalid OAuth access token - Cannot parse access token"));
      }
      const parts = entry.path.split("/").filter(Boolean);
      if (req.method === "GET" && parts.length === 2 && parts[1] === "phone_numbers") {
        if (parts[0] !== wabaId) return reply(400, metaError(100, `Unsupported get request. Object with ID '${parts[0]}' does not exist, cannot be loaded due to missing permissions, or does not support this operation.`, { subcode: 33 }));
        return reply(200, { data: state.numbers });
      }
      if (req.method === "GET" && parts.length === 2 && parts[1] === "message_templates") {
        if (parts[0] !== wabaId) return reply(400, metaError(100, `Unsupported get request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        return reply(200, { data: state.templates, paging: { cursors: { before: "QVFIUb", after: "QVFIUa" } } });
      }
      if (req.method === "GET" && parts.length === 1) {
        if (parts[0] !== phoneNumberId) return reply(400, metaError(100, `Unsupported get request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        return reply(200, { whatsapp_business_manager_messaging_limit: state.tier, id: phoneNumberId });
      }
      if (req.method === "POST" && parts.length === 2 && parts[1] === "media") {
        if (parts[0] !== phoneNumberId) return reply(400, metaError(100, `Unsupported post request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        const fields = multipart(rawBody, req.headers["content-type"]);
        if (fields.messaging_product?.value !== "whatsapp" || !fields.file?.data?.length) return reply(400, metaError(100, "(#100) Param file must be a file with one of the following types"));
        if (fields.type?.value !== "application/pdf" || fields.file.type !== "application/pdf") return reply(400, metaError(131053, "(#131053) Media upload error"));
        state.mediaSeq += 1;
        const id = `77${String(state.mediaSeq).padStart(13, "0")}`;
        state.media.set(id, { id, filename: fields.file.filename, type: fields.file.type, data: fields.file.data });
        entry.media = { id, filename: fields.file.filename, size: fields.file.data.length };
        return reply(200, { id });
      }
      if (req.method === "DELETE" && parts.length === 1) {
        if (!state.media.has(parts[0])) return reply(400, metaError(100, `Unsupported delete request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        state.media.delete(parts[0]);
        state.deleted.push(parts[0]);
        return reply(200, { success: true });
      }
      if (req.method === "POST" && parts.length === 2 && parts[1] === "subscribed_apps") {
        if (parts[0] !== wabaId) return reply(400, metaError(100, `Unsupported post request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        state.subscriptions.push(entry.body || {});
        return reply(200, { success: true });
      }
      if (req.method === "POST" && parts.length === 2 && parts[1] === "messages") {
        if (parts[0] !== phoneNumberId) return reply(400, metaError(100, `Unsupported post request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        const sent = entry.body || {};
        const template = state.templates.find(item => item.name === sent.template?.name && item.language === sent.template?.language?.code && item.status === "APPROVED");
        if (sent.type === "template" && !template) return reply(404, metaError(132001, "(#132001) Template name does not exist in the translation"));
        const components = Array.isArray(sent.template?.components) ? sent.template.components : [];
        const bodyParams = components.find(item => item.type === "body")?.parameters || [];
        if (Number.isInteger(template?.params) && bodyParams.length !== template.params) return reply(400, metaError(132000, "(#132000) Number of parameters does not match the expected number of params"));
        const doc = components.find(item => item.type === "header")?.parameters?.find(item => item.type === "document")?.document;
        if (template?.header === "DOCUMENT" && !doc) return reply(400, metaError(132012, "(#132012) Parameter format does not match format in the created template"));
        if (doc && !state.media.has(String(doc.id))) return reply(400, metaError(131053, "(#131053) Media upload error"));
        const custom = state.recipientErrors[sent.to];
        if (custom) return reply(custom.status || 400, custom.body);
        state.sent += 1;
        const wamid = `wamid.SAHTE${String(state.sent).padStart(4, "0")}`;
        state.messages.push({ to: sent.to, template: sent.template?.name, language: sent.template?.language?.code, params: bodyParams.map(item => item.text), document: doc ? { id: String(doc.id), filename: doc.filename } : null, opaque: sent.biz_opaque_callback_data || "", wamid });
        if (state.dropAfter && state.dropAfter.test(line)) return req.socket.destroy(); // işlendi, yanıt yok
        return reply(200, { messaging_product: "whatsapp", contacts: [{ input: sent.to, wa_id: String(sent.to || "").replace(/\D/g, "") }], messages: [{ id: wamid, message_status: "accepted" }] });
      }
      return reply(400, metaError(100, "Unsupported request"));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    // 2.4.8 W2: "Meta'ya hiç ulaşılamadı" (bağlantı reddi, ECONNREFUSED): dinleyici kapanır; online() aynı kapıda yeniden açar.
    offline: () => new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
    online: () => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    }),
    requests,
    state,
    set: patch => Object.assign(state, patch),
    close: () => new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
