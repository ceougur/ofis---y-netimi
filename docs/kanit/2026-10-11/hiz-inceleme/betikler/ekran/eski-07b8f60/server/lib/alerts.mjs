// Olay tabanlı uyarı akışı (v2.0.2).
// Taksit ve son gün uyarıları iki şeye bağlıdır: veri (kayıt, tahsilat, kapatılan kalem) ve gün. Veri değişince ilgili
// uçlar zaten "workspace.changed" olayı yayımlar; istemci bunu dinler ve takvimi yeniler. Gün değişimi ise hiçbir
// isteğe bağlı değildir: bu zamanlayıcı yerel gece yarısından hemen sonra tüm bağlı ekranlara "alerts.refresh" gönderir.
// Böylece istemci her 5 dakikada sormak yerine olay geldiğinde (ve uzun bir yedek aralıkla) sorar; sunucudaki takvim
// sonucu parmak izine göre önbelleklidir, gün değişince anahtar değişir ve bir kez hesaplanır. Yerel kaynak yükü:
// günde bir olay + gerçek değişiklikler kadar.
export function createAlertScheduler({ events, clock = () => new Date(), log = null, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let stopped = false;
  const stats = { fired: 0, nextAt: null };

  const localDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  /** Bir sonraki yerel gece yarısına kalan süre (ms) + 2 sn pay; saat oynarsa en az 5 sn. */
  function msUntilNextDay(now = clock()) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    return Math.max(5_000, next.getTime() - now.getTime());
  }

  function schedule() {
    if (stopped) return;
    const delay = msUntilNextDay();
    stats.nextAt = new Date(clock().getTime() + delay).toISOString();
    timer = setTimer(() => {
      timer = null;
      fire("day");
      schedule();
    }, delay);
    timer?.unref?.();
  }

  /** Tüm bağlı ekranlara yenileme olayı: reason "day" (gün dönümü) ya da "data" (elle tetiklenen). */
  function fire(reason = "data") {
    stats.fired += 1;
    const now = clock();
    try {
      events?.publish("alerts.refresh", { reason, today: localDay(now), at: now.toISOString() });
    } catch (error) {
      log?.warn?.("Uyarı yenileme olayı yayımlanamadı", error);
    }
  }

  function start() {
    stopped = false;
    if (!timer) schedule();
  }
  function stop() {
    stopped = true;
    if (timer) clearTimer(timer);
    timer = null;
    stats.nextAt = null;
  }

  return { start, stop, fire, msUntilNextDay, stats: () => ({ ...stats, active: Boolean(timer) }) };
}
