/* DestekOfis — canlı bağlantı (Server-Sent Events).
 * Sunucudan gelen olayları HOF olaylarına çevirir: live:hello, live:presence, live:chat.message, live:chat.read,
 * live:workspace.changed. Bağlantı koparsa tarayıcı kendisi yeniden bağlanır; sunucu güncellenirken gelen "bakım"
 * yanıtında bağlantı kapanır, bu betik artan beklemeyle (2 sn → 30 sn) yeniden dener.
 * Sayfa bir dakikadan uzun arka planda kalırsa bağlantı kapatılır (tarayıcının sunucu başına bağlantı sınırı
 * dolmasın), sayfaya dönülünce yeniden açılır ve kaçırılanlar için tek seferlik eşitleme yapılır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const TYPES = ["chat.message", "chat.read", "workspace.changed"];
  let source = null;
  let retry = 0;
  let retryTimer = 0;
  let hiddenTimer = 0;
  let connected = false;
  let everConnected = false;
  let online = new Set();

  const parse = event => {
    try {
      return JSON.parse(event.data);
    } catch {
      return null;
    }
  };

  function connect() {
    if (source || !HOF.user || document.hidden) return;
    clearTimeout(retryTimer);
    try {
      source = new EventSource("/api/events");
    } catch {
      schedule();
      return;
    }
    source.addEventListener("hello", event => {
      const data = parse(event) || {};
      retry = 0;
      connected = true;
      online = new Set(data.online || []);
      HOF.emit("live:hello", data);
      HOF.emit("live:presence", [...online]);
      // Yeniden bağlanıldıysa (ağ kopması, sunucu güncellemesi, arka plan) kaçırılanlar için eşitle.
      if (everConnected) HOF.emit("live:resync");
      everConnected = true;
    });
    source.addEventListener("presence", event => {
      online = new Set(parse(event)?.online || []);
      HOF.emit("live:presence", [...online]);
    });
    for (const type of TYPES) source.addEventListener(type, event => HOF.emit(`live:${type}`, parse(event)));
    source.onerror = () => {
      connected = false;
      HOF.emit("live:disconnected");
      // CLOSED: sunucu 200 dışında yanıt verdi (bakım, oturum sonu); tarayıcı artık kendisi denemez.
      if (source && source.readyState === EventSource.CLOSED) {
        source = null;
        // Oturum sunucuda sona erdiyse (yönetici oturumları kapattı, hesap pasifleşti) giriş ekranı beklemeden
        // gelsin: 401 yanıtı "unauthorized" olayını tetikler. Bakım yanıtında (503) yalnızca yeniden denenir.
        HOF.api("/api/auth/me").catch(() => {});
        schedule();
      }
    };
  }

  function disconnect() {
    clearTimeout(retryTimer);
    if (source) source.close();
    source = null;
    connected = false;
  }

  function schedule() {
    clearTimeout(retryTimer);
    const delay = Math.min(30_000, 2000 * 2 ** retry) + Math.random() * 1000;
    retry = Math.min(retry + 1, 5);
    retryTimer = setTimeout(connect, delay);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(disconnect, 60_000);
    } else {
      clearTimeout(hiddenTimer);
      if (!source) {
        retry = 0;
        connect();
      }
    }
  });
  window.addEventListener("online", () => {
    if (!source) {
      retry = 0;
      connect();
    }
  });
  HOF.on("unauthorized", disconnect);

  HOF.whenReady(() => connect());
  HOF.live = {
    isOnline: userId => online.has(userId),
    online: () => [...online],
    connected: () => connected,
    reconnect: () => {
      disconnect();
      retry = 0;
      connect();
    },
  };
})();
