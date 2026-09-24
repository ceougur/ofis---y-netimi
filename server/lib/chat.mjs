// Ofis içi sohbet: herkesin gördüğü "Ofis geneli" kanalı ve kişiler arası özel yazışmalar.
// Özel yazışmayı yalnızca iki taraf görür; yönetici dahil başka hiç kimse okuyamaz (varlığı bile 404 ile gizlenir).
// Yeni mesaj ve okundu bilgisi canlı olay kanalıyla (events.mjs) ilgili kişilere anında gider.
import { randomUUID } from "node:crypto";
import { HttpError } from "./http.mjs";

export const OFFICE_CONVERSATION = "conversation-office";
export const OFFICE_TITLE = "Ofis geneli";
const CASE_KEY = /\b(?:19|20)\d{2}\/\d+\b/;
const MAX_BODY = 2000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

const fold = value => String(value ?? "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

const messageRow = row => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  senderName: row.sender_name || "",
  body: row.body,
  caseKey: row.case_key || null,
  createdAt: row.created_at,
});

export function createChat({ store, events = null, audit = () => {}, now = () => new Date().toISOString() }) {
  const sent = new Map();
  const onlineIds = () => new Set(events?.online() || []);
  const userRow = id => store.get("SELECT id, display_name AS name, role, active, created_at FROM users WHERE id = ?", id);
  const conversation = id => store.get("SELECT * FROM chat_conversations WHERE id = ?", String(id || ""));
  const memberIds = conv => (conv.kind === "office" ? null : store.all("SELECT user_id FROM chat_members WHERE conversation_id = ?", conv.id).map(row => row.user_id));
  const lastRead = (conversationId, userId) => store.get("SELECT last_read_at FROM chat_members WHERE conversation_id = ? AND user_id = ?", conversationId, userId)?.last_read_at || null;

  function assertAccess(user, conv) {
    if (!conv) throw new HttpError(404, "Yazışma bulunamadı.");
    if (conv.kind === "office") return;
    if (!store.get("SELECT 1 AS found FROM chat_members WHERE conversation_id = ? AND user_id = ?", conv.id, user.id)) throw new HttpError(404, "Yazışma bulunamadı.");
  }

  // Ofis kanalına ilk bakışta üyelik açılır; hesap açıldıktan sonra yazılanlar okunmamış sayılır.
  function ensureOfficeMember(user) {
    const created = userRow(user.id)?.created_at || now();
    store.run("INSERT OR IGNORE INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)", OFFICE_CONVERSATION, user.id, now(), created);
  }

  function unreadCount(conv, user) {
    const since = lastRead(conv.id, user.id) || "";
    return store.get("SELECT COUNT(*) AS count FROM chat_messages WHERE conversation_id = ? AND sender_id <> ? AND created_at > ?", conv.id, user.id, since).count;
  }

  function lastMessage(conversationId) {
    const row = store.get(
      `SELECT m.*, u.display_name AS sender_name FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 1`,
      conversationId,
    );
    return row ? messageRow(row) : null;
  }

  function describe(conv, user) {
    const peerId = conv.kind === "direct" ? memberIds(conv).find(id => id !== user.id) || null : null;
    const peer = peerId ? userRow(peerId) : null;
    return {
      id: conv.id,
      kind: conv.kind,
      title: conv.kind === "office" ? OFFICE_TITLE : peer?.name || "Kullanıcı",
      peerId,
      peerActive: peer ? Boolean(peer.active) : null,
      lastMessage: lastMessage(conv.id),
      unread: unreadCount(conv, user),
      lastReadAt: lastRead(conv.id, user.id),
      peerLastReadAt: peerId ? lastRead(conv.id, peerId) : null,
    };
  }

  function summary(user) {
    ensureOfficeMember(user);
    const online = onlineIds();
    const users = store
      .all("SELECT id, display_name AS name, role FROM users WHERE active = 1 AND id <> ? ORDER BY display_name COLLATE NOCASE", user.id)
      .map(item => ({ ...item, online: online.has(item.id) }));
    const conversations = store
      .all(
        `SELECT c.* FROM chat_conversations c
         WHERE c.kind = 'office' OR EXISTS (SELECT 1 FROM chat_members m WHERE m.conversation_id = c.id AND m.user_id = ?)
         ORDER BY CASE c.kind WHEN 'office' THEN 0 ELSE 1 END, COALESCE(c.last_message_at, c.created_at) DESC`,
        user.id,
      )
      .map(conv => describe(conv, user));
    return { me: user.id, users, conversations, unreadTotal: conversations.reduce((total, item) => total + item.unread, 0), online: [...online] };
  }

  function messages(user, conversationId, { before = null, limit = 50 } = {}) {
    const conv = conversation(conversationId);
    assertAccess(user, conv);
    const size = Math.max(1, Math.min(200, Number(limit) || 50));
    const cursor = before ? String(before) : null;
    const rows = store.all(
      `SELECT m.*, u.display_name AS sender_name FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND (? IS NULL OR m.created_at < ?) ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      conv.id, cursor, cursor, size + 1,
    );
    const summaryItem = describe(conv, user);
    return { conversation: summaryItem, messages: rows.slice(0, size).reverse().map(messageRow), hasMore: rows.length > size };
  }

  function direct(user, peerId) {
    if (!peerId || peerId === user.id) throw new HttpError(400, "Mesaj göndermek için başka bir kişi seçin.");
    const peer = userRow(peerId);
    if (!peer || !peer.active) throw new HttpError(404, "Kişi bulunamadı.");
    const key = [user.id, peer.id].sort().join("|");
    let conv = store.get("SELECT * FROM chat_conversations WHERE direct_key = ?", key);
    if (!conv) {
      const id = `conversation-${randomUUID()}`;
      const timestamp = now();
      store.tx(() => {
        store.run("INSERT INTO chat_conversations (id, kind, direct_key, title, created_at) VALUES (?, 'direct', ?, NULL, ?)", id, key, timestamp);
        store.run("INSERT INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)", id, user.id, timestamp, timestamp);
        store.run("INSERT INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, NULL)", id, peer.id, timestamp);
      });
      conv = conversation(id);
    }
    return describe(conv, user);
  }

  function throttle(userId) {
    const current = Date.now();
    const recent = (sent.get(userId) || []).filter(at => current - at < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) throw new HttpError(429, "Çok hızlı mesaj gönderiyorsunuz. Birkaç saniye sonra tekrar deneyin.", { retryAfter: 10 });
    recent.push(current);
    sent.set(userId, recent);
    if (sent.size > 1000) sent.clear();
  }

  function send(user, conversationId, { body, caseKey } = {}) {
    const conv = conversation(conversationId);
    assertAccess(user, conv);
    const text = String(body ?? "").replace(/\r\n?/g, "\n").trim();
    if (!text) throw new HttpError(400, "Mesaj boş olamaz.");
    if (text.length > MAX_BODY) throw new HttpError(400, `Mesaj en fazla ${MAX_BODY} karakter olabilir.`);
    if (conv.kind === "direct") {
      const peerId = memberIds(conv).find(id => id !== user.id);
      if (peerId && !userRow(peerId)?.active) throw new HttpError(400, "Bu kişi artık aktif değil; mesaj gönderilemez.");
    }
    throttle(user.id);
    const key = String(caseKey ?? "").trim().slice(0, 300) || text.match(CASE_KEY)?.[0] || null;
    const id = `chat-${randomUUID()}`;
    const timestamp = now();
    store.tx(() => {
      store.run("INSERT INTO chat_messages (id, conversation_id, sender_id, body, case_key, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, conv.id, user.id, text, key, timestamp);
      store.run("UPDATE chat_conversations SET last_message_at = ? WHERE id = ?", timestamp, conv.id);
      store.run("INSERT OR IGNORE INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)", conv.id, user.id, timestamp, timestamp);
      store.run("UPDATE chat_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?", timestamp, conv.id, user.id);
    });
    // Denetim kaydına mesaj içeriği yazılmaz (özel yazışma).
    audit(user, "message.created", id, { conversation: conv.kind });
    const message = messageRow({ id, conversation_id: conv.id, sender_id: user.id, sender_name: user.display_name, body: text, case_key: key, created_at: timestamp });
    events?.publish("chat.message", { conversationId: conv.id, kind: conv.kind, message }, { users: memberIds(conv) });
    return message;
  }

  function markRead(user, conversationId, until = null) {
    const conv = conversation(conversationId);
    assertAccess(user, conv);
    const current = now();
    const at = until && String(until) <= current ? String(until) : current;
    store.run("INSERT OR IGNORE INTO chat_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, NULL)", conv.id, user.id, current);
    const changed = store.run("UPDATE chat_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ? AND (last_read_at IS NULL OR last_read_at < ?)", at, conv.id, user.id, at).changes;
    // Özel yazışmada karşı taraf "okundu"yu görür; kişinin kendi diğer sekmeleri de sayacı sıfırlar.
    if (changed) events?.publish("chat.read", { conversationId: conv.id, userId: user.id, lastReadAt: at }, { users: conv.kind === "direct" ? memberIds(conv) : [user.id] });
    return { lastReadAt: lastRead(conv.id, user.id), unread: unreadCount(conv, user) };
  }

  // ---- Eski "Mesajlar" uçları (güncelleme sırasında açık kalan eski sayfalar için), artık gizliliğe uygun ----
  function legacyList(user, limit = 50) {
    ensureOfficeMember(user);
    const size = Math.max(1, Math.min(200, Number(limit) || 50));
    const rows = store.all(
      `SELECT m.*, u.display_name AS sender_name, c.kind FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id LEFT JOIN users u ON u.id = m.sender_id
       WHERE c.kind = 'office' OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ?)
       ORDER BY m.created_at DESC LIMIT ?`,
      user.id, size,
    );
    return rows.map(row => {
      const conv = { id: row.conversation_id, kind: row.kind };
      const peerId = row.kind === "direct" ? memberIds(conv).find(id => id !== row.sender_id) : null;
      const to = row.kind === "office" ? OFFICE_TITLE : userRow(peerId)?.name || "";
      return { id: row.id, to, message: row.body, caseKey: row.case_key || "", actorId: row.sender_id, actorName: row.sender_name || "", createdAt: row.created_at, toMe: peerId === user.id, mine: row.sender_id === user.id };
    });
  }

  function legacySend(user, { to, message, caseKey } = {}) {
    const name = fold(to);
    const target = name ? store.all("SELECT id, username, display_name FROM users WHERE active = 1").find(item => fold(item.display_name) === name || fold(item.username) === name) : null;
    if (target && target.id !== user.id) {
      const conv = direct(user, target.id);
      return send(user, conv.id, { body: message, caseKey });
    }
    const text = String(message ?? "").trim();
    return send(user, OFFICE_CONVERSATION, { body: name && name !== fold(OFFICE_TITLE) && text ? `→ ${String(to).trim()}: ${text}` : text, caseKey });
  }

  return { summary, messages, direct, send, markRead, legacyList, legacySend };
}
