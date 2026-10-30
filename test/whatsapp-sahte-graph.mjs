// W1 test düzeneği: yerel SAHTE Meta Graph sunucusu (yalnız 127.0.0.1; testler gerçek Meta'ya GİTMEZ — ders 30, test/whatsapp-meta-izolasyon.test.mjs).
// Kapsamı W1: GET /<WABA>/phone_numbers, GET /<PHONE_NUMBER_ID>?fields=whatsapp_business_manager_messaging_limit, GET /<WABA>/message_templates,
// POST /<PHONE_NUMBER_ID>/messages. Yanıt biçimleri Meta belgelerinin örneklerinden (embedded-signup "phone numbers", messaging-limits,
// template-management, send-messages, support/error-codes). UYARI: bu düzenek programı yazan elden çıkmıştır; kâhin DEĞİLDİR (ders 5) —
// bağımsız sahte Meta K0'da (kodu görmeyen ajan) yazılır.
//
// startFakeGraph({ token, phoneNumberId, wabaId }) → { url, requests, set(patch), close() }
//   requests: { method, path, version, query, auth, body }[]
//   set({ tier, numbers, templates, failNext: { match, status, body | raw }, delayMs, echoToken })
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
    delayMs: 0,
    echoToken: false,
    sent: 0,
  };
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
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
        res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
        res.end(text);
      };
      if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
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
      if (req.method === "POST" && parts.length === 2 && parts[1] === "messages") {
        if (parts[0] !== phoneNumberId) return reply(400, metaError(100, `Unsupported post request. Object with ID '${parts[0]}' does not exist.`, { subcode: 33 }));
        const sent = entry.body || {};
        const template = state.templates.find(item => item.name === sent.template?.name && item.language === sent.template?.language?.code && item.status === "APPROVED");
        if (sent.type === "template" && !template) return reply(404, metaError(132001, "(#132001) Template name does not exist in the translation"));
        state.sent += 1;
        return reply(200, { messaging_product: "whatsapp", contacts: [{ input: sent.to, wa_id: String(sent.to || "").replace(/\D/g, "") }], messages: [{ id: `wamid.SAHTE${String(state.sent).padStart(4, "0")}`, message_status: "accepted" }] });
      }
      return reply(400, metaError(100, "Unsupported request"));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    state,
    set: patch => Object.assign(state, patch),
    close: () => new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
