// Canlı olay kanalı (Server-Sent Events). Tek yönlü, sade HTTP akışı; servis yöneticisinin HTTP kapısından ve
// kurumsal ağlardan WebSocket'e göre daha sorunsuz geçer. Olaylar: sohbet mesajları, okundu bilgisi, çevrimiçi
// kullanıcılar ve çalışma alanı değişiklikleri (not, görev, kayıt, kaynak).
//
// Dayanıklılık:
// - Her olay "<oturum>.<sıra>" kimliği taşır ve son olaylar kısa bir süre bellekte tutulur. Bağlantı koparsa tarayıcı
//   Last-Event-ID ile yeniden bağlanır; arada kaçan olaylar yeniden gönderilir ("resumed"). Kaçanlar artık bellekte
//   değilse (uzun kopukluk, sunucu yeniden başladı) istemci tek seferlik eşitleme yapar.
// - Her bağlantının bir ömrü vardır (varsayılan 5 dk + rastgele pay); süre dolunca sunucu akışı kapatır, tarayıcı
//   birkaç saniye içinde kaldığı yerden devam eder. Yanıt "Connection: close" ile gönderildiğinden kapanan akışın
//   soketi de kapanır. Bu, arada kapanışı iletmeyen bir vekil olduğunda (ör. 1.3.x servis yöneticisi, kurumsal
//   vekil sunucular) kapanmış sekmelerin bağlantılarının birikip soket havuzunu doldurmasını önler.
import { randomBytes } from "node:crypto";
import { SECURITY_HEADERS } from "./http.mjs";

export function createEventHub({ log, pingMs = 25_000, maxPerUser = 12, maxTotal = 100, isValid = null, maxAgeMs = 5 * 60_000, replayLimit = 1000, replayMs = 15 * 60_000 } = {}) {
  const clients = new Set();
  const history = []; // { seq, chunk, users, except, at } — yeniden gönderim için son olaylar
  const epoch = randomBytes(4).toString("hex");
  let presenceTimer = null;
  let sequence = 0;

  const online = () => [...new Set([...clients].map(client => client.userId))];

  // Okumayan (askıda kalmış) bir istemcinin tamponu sınırsız büyümesin: 1 MB birikirse bağlantı kapatılır;
  // tarayıcı yeniden bağlanır ve kaçırdıklarını alır.
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
    clearTimeout(client.expiry);
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
    presenceTimer = setTimeout(() => {
      // Çevrimiçi listesi her bağlantıda baştan gönderildiğinden kimlik almaz ve saklanmaz.
      const chunk = frame("presence", { online: online() });
      for (const client of [...clients]) write(client, chunk);
    }, 250);
    presenceTimer.unref?.();
  }

  const frame = (event, data, id = null) => `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const reaches = (entry, userId) => (!entry.users || entry.users.includes(userId)) && entry.except !== userId;

  // "<oturum>.<sıra>" → sıra; başka bir sunucu oturumuna (yeniden başlatma, güncelleme) aitse null.
  function lastSequence(value) {
    const match = /^([0-9a-f]+)\.(\d{1,15})$/.exec(String(value || "").trim());
    return match && match[1] === epoch ? Number(match[2]) : null;
  }

  function trim(now = Date.now()) {
    while (history.length > replayLimit || (history.length && history[0].at < now - replayMs)) history.shift();
  }

  function connect(req, res, { userId, tokenHash, hello = {}, lastEventId = null }) {
    const mine = [...clients].filter(client => client.userId === userId);
    // Çok sekme açık kalmışsa en eskisi kapanır (tarayıcı başına bağlantı sınırı ve sunucu kaynakları için).
    for (const old of mine.slice(0, Math.max(0, mine.length - maxPerUser + 1))) close(old);
    if (clients.size >= maxTotal) {
      res.writeHead(503, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "retry-after": "30", connection: "close" });
      res.end(JSON.stringify({ ok: false, error: "Canlı bağlantı sınırına ulaşıldı." }));
      return null;
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "close",
      "x-accel-buffering": "no",
    });
    res.flushHeaders?.();
    const client = { userId, tokenHash, res, closed: false, since: Date.now(), expiry: null };
    clients.add(client);
    trim();
    const last = lastSequence(lastEventId);
    // Kaldığı yerden devam: bellekteki olaylar son alınandan sonrasını eksiksiz kapsıyorsa.
    const resumed = last !== null && last <= sequence && (history[0]?.seq ?? sequence + 1) <= last + 1;
    write(client, "retry: 4000\n\n");
    write(client, frame("hello", { ...hello, online: online(), resumed }));
    if (resumed) for (const entry of history) if (entry.seq > last && reaches(entry, userId)) write(client, entry.chunk);
    // Bağlantı ömrü; herkes aynı anda yeniden bağlanmasın diye rastgele pay eklenir. Planlı yenilemede tarayıcıya
    // hemen (yarım saniyede) yeniden bağlanması söylenir; sonraki akışın ilk satırı bekleme süresini yine 4 sn yapar.
    client.expiry = setTimeout(() => {
      write(client, "retry: 500\n\n");
      close(client);
    }, maxAgeMs + Math.floor(Math.random() * Math.min(60_000, maxAgeMs * 0.2)));
    client.expiry.unref?.();
    req.on("close", () => close(client));
    res.on("error", () => close(client));
    schedulePresence();
    return client;
  }

  // users: yalnızca bu kullanıcılara; except: bu kullanıcı hariç herkese.
  function publish(event, data, { users = null, except = null } = {}) {
    const seq = ++sequence;
    const chunk = frame(event, data, `${epoch}.${seq}`);
    const entry = { seq, chunk, users, except, at: Date.now() };
    // Bağlı kimse olmasa da saklanır: o an yeniden bağlanmakta olan bir sekme kaçırmasın.
    history.push(entry);
    trim(entry.at);
    let sent = 0;
    for (const client of [...clients]) {
      if (!reaches(entry, client.userId)) continue;
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
      clearTimeout(client.expiry);
      clients.delete(client);
      try {
        client.res.end();
      } catch {
        // yoksay
      }
    }
    history.length = 0;
    log?.debug?.("Canlı olay kanalı kapatıldı.");
  }

  return { connect, publish, online, closeWhere, stop, size: () => clients.size };
}
