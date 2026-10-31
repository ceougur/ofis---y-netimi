// Süreç saati (ders 13, 22): bu süreçteki BÜTÜN kodun (testin kendisi, güncel sunucu ve config.now'u olmayan eski sürüm kodu — ör. v2.0.26,
// aynı süreçte içe aktarılır) okuduğu Date'i verilen andan başlatır; saat gerçek zamanla AKAR (yalnız başlangıç kayar). `new Date()`, `Date()`
// ve `Date.now()` kayar; bağımsız değişkenli `new Date(x)`, Date.UTC/parse ve `instanceof Date` (yerleşik API'lerin ürettiği Date'ler dahil)
// olduğu gibi kalır. Zamanlayıcılar (setTimeout) ve SQLite etkilenmez (programın SQL'inde saat okunmaz).
const pad = n => String(n).padStart(2, "0");

/** Saati `start` (ms) anından akıtır; önceki Date'i ve yerel günü okuyanları döndürür. */
export function installProcessClock(start) {
  const Before = globalThis.Date;
  const offset = start - Before.now();
  const nowMs = () => Before.now() + offset;
  const Clock = new Proxy(Before, {
    construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [nowMs()], newTarget),
    apply: () => new Before(nowMs()).toString(),
    get: (target, prop, receiver) => (prop === "now" ? nowMs : Reflect.get(target, prop, receiver)),
  });
  globalThis.Date = Clock;
  const dayOf = ms => {
    const d = new Before(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { Before, now: nowMs, today: () => dayOf(nowMs()), beforeToday: () => dayOf(Before.now()) };
}

/** motorNow ile aynı kural: verilen anın YEREL günü 06:00 (en uzun koşu da gece yarısına ulaşmaz). */
export const dayStart06 = (ms = Date.now()) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0, 0).getTime();
};
