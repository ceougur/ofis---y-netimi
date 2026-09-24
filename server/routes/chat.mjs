// Ofis içi sohbet ve canlı olay kanalı uçları.
import { HttpError, ok, readJson } from "../lib/http.mjs";

export function registerChatRoutes(router, { auth, chat, events, config }) {
  // Canlı olaylar (Server-Sent Events). Bağlantı açık kaldığı sürece yanıt bitmez.
  router.get("/api/events", async ({ req, res }) => {
    const user = auth.requireUser(req);
    events.connect(req, res, { userId: user.id, tokenHash: auth.sessionHash(req), hello: { version: config.version, userId: user.id } });
  });

  router.get("/api/chat", async ({ req, res }) => {
    ok(res, chat.summary(auth.requireUser(req)));
  });

  router.post("/api/chat/direct", async ({ req, res }) => {
    const user = auth.requirePermission(req, "messages.create");
    const body = await readJson(req);
    ok(res, chat.direct(user, String(body.userId || "")));
  });

  router.get("/api/chat/conversations/:id/messages", async ({ req, res, params, url }) => {
    const user = auth.requireUser(req);
    ok(res, chat.messages(user, params.id, { before: url.searchParams.get("before"), limit: url.searchParams.get("limit") }));
  });

  router.post("/api/chat/conversations/:id/messages", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "messages.create");
    const body = await readJson(req, { limit: 64_000 });
    if (typeof body.body !== "string") throw new HttpError(400, "Mesaj metni gerekli.");
    ok(res, chat.send(user, params.id, { body: body.body, caseKey: body.caseKey }));
  });

  router.post("/api/chat/conversations/:id/read", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const body = await readJson(req);
    ok(res, chat.markRead(user, params.id, body.until || null));
  });
}
