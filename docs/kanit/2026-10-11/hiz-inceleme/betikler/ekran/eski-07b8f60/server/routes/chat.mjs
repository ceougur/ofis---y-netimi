// Ofis içi sohbet ve canlı olay kanalı uçları.
import { HttpError, ok, readJson, sendBuffer } from "../lib/http.mjs";

export function registerChatRoutes(router, { auth, chat, chatArchive, events, config }) {
  // Canlı olaylar (Server-Sent Events). Bağlantı açık kaldığı sürece yanıt bitmez.
  router.get("/api/events", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    // Tarayıcı kendiliğinden yeniden bağlanırken Last-Event-ID başlığını, sayfa yeni bağlantı açarken "last" parametresini gönderir.
    const lastEventId = req.headers["last-event-id"] || url.searchParams.get("last") || null;
    events.connect(req, res, { userId: user.id, tokenHash: auth.sessionHash(req), hello: { version: config.version, userId: user.id }, lastEventId });
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
    const result = chat.messages(user, params.id, { before: url.searchParams.get("before"), limit: url.searchParams.get("limit"), window: url.searchParams.get("window") || "" });
    // 30 günden eski mesajlar arşivde (v2.0.2): kaç aylık arşiv olduğu.
    if (chatArchive) result.archivedMonths = chatArchive.months(chat.access(user, params.id));
    ok(res, result);
  });

  // Kişinin kendi yazışmasının arşivi (özel yazışmada yalnızca iki taraf).
  router.get("/api/chat/conversations/:id/archive", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const file = chatArchive?.download(chat.access(user, params.id));
    if (!file) throw new HttpError(404, "Bu yazışmanın arşivi yok.");
    sendBuffer(res, file.body, { type: "text/plain; charset=utf-8", name: file.name });
  });

  router.get("/api/admin/chat-archive", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(res, chatArchive ? chatArchive.info() : null);
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
