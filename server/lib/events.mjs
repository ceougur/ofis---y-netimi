// Canlı olay kanalı (Server-Sent Events). Tek yönlü, sade HTTP akışı; servis yöneticisinin HTTP kapısından ve
// kurumsal ağlardan WebSocket'e göre daha sorunsuz geçer. Olaylar: sohbet mesajları, okundu bilgisi, çevrimiçi
// kullanıcılar ve çalışma alanı değişiklikleri (not, görev, kayıt, kaynak). Tarayıcı bağlantı koparsa kendisi
// yeniden bağlanır; sunucu güncellenirken gelen "bakım" yanıtından sonra istemci artan beklemeyle yeniden dener.
import { SECURITY_HEADERS } from "./http.mjs";

export function createEventHub({ log, pingMs = 25_000, maxPerUser = 12, maxTotal = 600, isValid = null } = {}) {
  const clients = new Set();
  let presenceTimer = null;
  let sequence = 0;

  const online = () => [...new Set([...clients].map(client => client.userId))];

  // Okumayan (askıda kalmış) bir istemcinin tamponu sınırsız büyümesin: 1 MB birikirse bağlantı kapatılır;
  // tarayıcı yeniden bağlanır ve kaçırdıklarını tek seferlik eşitlemeyle alır.
  const MAX_BUFFERED = 1024 * 1024;

  function write(client, chunk) {
    if (client.closed) return false;
    try {
      client.res.write(chunk);
      if (client.res.writableLength > MAX_BUFFERED) {
        log?.warn?.("Canlı bağlantı okumuyor; kapatıldı.", { userId: client.userId });
        close(client);
        return false;
      }
      return true;
    } catch {
      close(client);
      return false;
    }
  }

  function close(client) {
    if (client.closed) return;
    client.closed = true;
    clients.delete(client);
    try {
      client.res.end();
    } catch {
      // Bağlantı zaten kapanmış.
    }
    schedulePresence();
  }

  function schedulePresence() {
    clearTimeout(presenceTimer);
    presenceTimer = setTimeout(() => publish("presence", { online: online() }), 250);
    presenceTimer.unref?.();
  }

  const frame = (event, data) => `id: ${++sequence}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  function connect(req, res, { userId, tokenHash, hello = {} }) {
    const mine = [...clients].filter(client => client.userId === userId);
    // Çok sekme açık kalmışsa en eskisi kapanır (tarayıcı başına bağlantı sınırı ve sunucu kaynakları için).
    for (const old of mine.slice(0, Math.max(0, mine.length - maxPerUser + 1))) close(old);
    if (clients.size >= maxTotal) {
      res.writeHead(503, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "retry-after": "30" });
      res.end(JSON.stringify({ ok: false, error: "Canlı bağlantı sınırına ulaşıldı." }));
      return null;
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.flushHeaders?.();
    const client = { userId, tokenHash, res, closed: false, since: Date.now() };
    clients.add(client);
    write(client, "retry: 4000\n\n");
    write(client, frame("hello", { ...hello, online: online() }));
    req.on("close", () => close(client));
    res.on("error", () => close(client));
    schedulePresence();
    return client;
  }

  // users: yalnızca bu kullanıcılara; except: bu kullanıcı hariç herkese.
  function publish(event, data, { users = null, except = null } = {}) {
    if (!clients.size) return 0;
    const chunk = frame(event, data);
    let sent = 0;
    for (const client of [...clients]) {
      if (users && !users.includes(client.userId)) continue;
      if (except && client.userId === except) continue;
      if (write(client, chunk)) sent += 1;
    }
    return sent;
  }

  function closeWhere(predicate) {
    for (const client of [...clients]) if (predicate(client)) close(client);
  }

  // Ara sunucular boştaki bağlantıyı kesmesin diye yorum satırı; aynı turda oturumu kapanmış bağlantılar düşürülür.
  const pinger = setInterval(() => {
    for (const client of [...clients]) {
      if (isValid && !isValid(client)) {
        close(client);
        continue;
      }
      write(client, ": ping\n\n");
    }
  }, pingMs);
  pinger.unref?.();

  function stop() {
    clearInterval(pinger);
    clearTimeout(presenceTimer);
    for (const client of [...clients]) {
      client.closed = true;
      clients.delete(client);
      try {
        client.res.end();
      } catch {
        // yoksay
      }
    }
    log?.debug?.("Canlı olay kanalı kapatıldı.");
  }

  return { connect, publish, online, closeWhere, stop, size: () => clients.size };
}
