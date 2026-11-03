// WhatsApp gönderim İŞÇİSİ — 2.4.8 W2 (plan §6 W2 "Tek işçi, bütün şirketler; iletiler arası ~1 sn; işler arası olay döngüsüne sıra verilir").
// Ortak katmanda tek örnek. Her şirketin kuyruğu (lib/whatsapp/queue.mjs) açılınca kaydolur, kapanınca çıkar. İşçi sırayla (şirketler arasında dönüşümlü)
// bir iş yürütür; iki iş ASLA aynı anda yürümez (Meta'ya giden ileti istekleri arka arkaya, arada gapMs). Bekleyen iş yoksa en yakın bekleme anına ya da
// idleMs'e kadar uyur; yeni toplu iş açılınca kick() ile hemen uyanır. Bakım (süre dolumu, medya silme) maintainMs'de bir.
// manual: true (yalnız testler) → zamanlayıcı yok; test runOnce() / drain() ile sürer (ders 20: zamanlayıcı yarışı yok).
import { isLockError } from "../db.mjs";

export function createWaScheduler({ gapMs = 1000, idleMs = 30_000, maintainMs = 60_000, manual = false, log = console } = {}) {
  const queues = new Map(); // anahtar (şirket kimliği) → kuyruk
  let order = [];
  let cursor = 0;
  let timer = null;
  let running = null;
  let stopped = false;
  let lastMaintain = 0;

  const schedule = delay => {
    if (manual || stopped) return;
    clearTimeout(timer);
    timer = setTimeout(loop, Math.max(0, Math.min(delay, 2_147_000_000)));
    timer.unref?.();
  };

  // İş N (T6 Ü2): dosyası KİLİTLİ (SQLITE_BUSY / LOCKED) şirketin kimlikleri — her yazım denemesi busy_timeout (10 sn) boyunca olay döngüsünü tutar; bakım turunda kilide
  // takılan şirketin işi AYNI turda yürütülmez (bir sonraki turda yeniden denenir).
  // İş R2 (dar kontrol 12): şirket o turda yazılabilir mi — tur sürerken kuyruktan çıkmış (silinen / geri yüklenen / kapanan şirket) ya da sınaması fırlatan şirket
  // o turda atlanır, ÖBÜR şirketlerin bakımı ve işi sürer (önce kapalı veri tabanındaki sınama bütün turu düşürüyordu).
  function writable(key, queue) {
    if (queues.get(key) !== queue) return false;
    try {
      return queue.canWrite?.() !== false;
    } catch (error) {
      log.warn?.(`WhatsApp işçisi: şirket (${key}) bu turda yazılamıyor (${error?.code || error?.message || error}); öbür şirketler sürer.`);
      return false;
    }
  }
  async function maintainAll() {
    const locked = new Set();
    for (const [key, queue] of [...queues.entries()]) {
      // İş P1: şirket dosyası kilitli (işaretli ya da kısa sınama) → bakım ve iş o turda yok, olay döngüsü tutulmaz.
      if (!writable(key, queue)) {
        locked.add(key);
        continue;
      }
      try {
        await queue.maintain();
      } catch (error) {
        if (isLockError(error)) {
          queue.markLocked?.();
          locked.add(key);
          log.warn?.(`WhatsApp bakım turu: şirket dosyası kilitli (${key}); bu turda iş yürütülmez.`);
        } else log.error?.("WhatsApp bakım turu çalışmadı", error);
      }
    }
    return locked;
  }

  // Bir tur: sıradaki şirketten (dönüşümlü) yürütülebilir bir iş. Dönüş: { did, waitMs }.
  async function turn() {
    let locked = new Set();
    if (Date.now() - lastMaintain >= maintainMs) {
      lastMaintain = Date.now();
      locked = await maintainAll();
    }
    order = [...queues.keys()];
    let wait = null;
    for (let i = 0; i < order.length; i += 1) {
      const key = order[(cursor + i) % order.length];
      const queue = queues.get(key);
      if (!queue || locked.has(key) || !writable(key, queue)) continue;
      let result;
      try {
        result = await queue.step();
      } catch (error) {
        log.error?.(`WhatsApp işçisi (${key}) hata verdi`, error);
        result = { did: true };
      }
      if (result.did) {
        cursor = (cursor + i + 1) % Math.max(1, order.length);
        return { did: true };
      }
      if (Number.isFinite(result.waitMs)) wait = wait === null ? result.waitMs : Math.min(wait, result.waitMs);
    }
    return { did: false, waitMs: wait };
  }

  // Tek iş: sürmekte olan tur varsa onun bitmesi beklenir (iki iş aynı anda yürümez).
  async function runOnce() {
    while (running) await running;
    running = turn();
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  async function loop() {
    timer = null;
    if (stopped) return;
    let result;
    try {
      result = await runOnce();
    } catch (error) {
      log.error?.("WhatsApp işçisi turu çalışmadı", error);
      result = { did: false, waitMs: idleMs };
    }
    // Olay döngüsüne sıra: bir sonraki iş en erken gapMs sonra.
    schedule(result.did ? gapMs : Math.max(gapMs, Math.min(idleMs, result.waitMs ?? idleMs)));
  }

  return {
    register(key, queue) {
      queues.set(String(key), queue);
      schedule(gapMs);
    },
    unregister(key) {
      queues.delete(String(key));
    },
    kick() {
      if (!running) schedule(50);
    },
    // 2.4.9 W-2: Şablonları Denetle bitince o WABA'nın şablon kararları BÜTÜN kayıtlı kuyruklarda unutulur (aynı WhatsApp hesabını kullanan ikinci şirketin süren
    // işi de sonraki adımda taze okur). Bir kuyruğun hatası öbürlerini durdurmaz. Dönüş: silinen karar sayısı.
    forgetTemplates(wabaId) {
      let forgotten = 0;
      for (const [key, queue] of [...queues.entries()]) {
        try {
          forgotten += Number(queue.forgetTemplates?.(wabaId)) || 0;
        } catch (error) {
          log.warn?.(`WhatsApp işçisi: şirket (${key}) şablon önbelleği temizlenemedi (${error?.message || error}).`);
        }
      }
      return forgotten;
    },
    runOnce,
    /** Testler: yürütülebilir iş kalmayana dek (en çok max tur). Dönüş: yürütülen iş sayısı. */
    async drain({ max = 10_000, maintain = true } = {}) {
      let done = 0;
      for (; done < max; done += 1) {
        const result = await runOnce();
        if (!result.did) break;
      }
      if (maintain) await maintainAll();
      return done;
    },
    maintain: maintainAll,
    size: () => queues.size,
    start() {
      stopped = false;
      schedule(gapMs);
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      while (running) await running.catch(() => {});
    },
  };
}
