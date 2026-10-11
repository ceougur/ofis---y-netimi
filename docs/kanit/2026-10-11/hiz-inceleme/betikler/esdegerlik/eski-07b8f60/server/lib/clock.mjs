// Sunucunun saati (v2.1.0, banka modülü Aşama 2; docs/BANKA-MODULU-PLAN.md §12.3). config.now = bu modülün ürettiği saat.
//
// İŞ SAATİ (config.now / context.now): "bugün" (hareketin varsayılan tarihi, ileri tarih ve dönem kilidi denetimi, mutabakat
// kapısının bugünü, raporların ve ANLIK DURUM'un bugünü, takvim, fatura saati ve yılı) ve iş kayıtlarının zaman damgaları
// (created_at/updated_at, işlem geçmişi, Silinenler, mutabakat günlüğü). Valör kuyruğu, İşlem No yılı ve iş günü hesapları da
// buradan okur.
// ALTYAPI SAATİ (gerçek saat, burada değil): oturum süresi, giriş denemesi sınırı, lisans, yedek zamanlayıcısı, güncelleyici,
// günlük, süre ölçümü. Sahte saat ileri alınınca kullanıcı oturumdan düşmez, lisans/yedek etkilenmez.
//
// Üretimde saat gerçektir; sahte saat yalnız programdan verilir (createApp({ now }) / startTestServer({ now })) — ortam
// değişkeni yoktur (kurulumda yanlışlıkla gün kaydırılamaz). Çocuk şirketler (002…) hub'ın saatini paylaşır.
//
// Saat bir işlevdir: now() → Date (her çağrıda yeni kopya). Ek yöntemler:
//   now.today() "YYYY-AA-GG" (yerel gün) · now.iso() ISO damgası · now.ms() milisaniye · now.isClock · now.controllable
//   Sahte saatte: now.set(zaman) · now.advance(ms | { days, hours, minutes, seconds }) · now.freeze(zaman?) · now.resume() · now.isFixed()
// Sahte saat verilen andan başlar ve gerçek zamanla AKAR (Playwright page.clock.install gibi); { time, fixed: true } durur.
// Gerçek saat her çağrıda Date'i okur (node:test Date taklidi — A13 testi — bu yolda geçerlidir).
const pad = value => String(value).padStart(2, "0");
const localDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const UNIT_MS = { days: 86_400_000, hours: 3_600_000, minutes: 60_000, seconds: 1_000, ms: 1 };

/** Zaman girdisi → milisaniye. "YYYY-AA-GG" yerel öğlen (gün sınırına yakın saat dilimi kaymasını önler). */
function toMs(value) {
  let ms = Number.NaN;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === "number") ms = value;
  else if (typeof value === "string") {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (day) {
      const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0, 0);
      ms = date.getFullYear() === Number(day[1]) && date.getMonth() === Number(day[2]) - 1 && date.getDate() === Number(day[3]) ? date.getTime() : Number.NaN;
    } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) ms = Date.parse(value);
  }
  if (!Number.isFinite(ms)) throw new TypeError(`Geçersiz saat: ${String(value).slice(0, 40)}`);
  return ms;
}
function durationOf(delta) {
  if (typeof delta === "number" && Number.isFinite(delta)) return delta;
  if (delta && typeof delta === "object") {
    let total = 0;
    for (const [unit, amount] of Object.entries(delta)) {
      if (!Object.hasOwn(UNIT_MS, unit) || !Number.isFinite(amount)) throw new TypeError(`Geçersiz süre: ${unit}`);
      total += amount * UNIT_MS[unit];
    }
    return total;
  }
  throw new TypeError(`Geçersiz süre: ${String(delta).slice(0, 40)}`);
}
function decorate(now, { controllable }) {
  now.isClock = true;
  now.controllable = controllable;
  now.ms = () => now().getTime();
  now.iso = () => now().toISOString();
  now.today = () => localDay(now());
  return now;
}

/** Gerçek saat: her çağrıda Date. Varsayılan geri düşüş (context.now verilmemiş yardımcılar). */
export const systemClock = decorate(() => new Date(), { controllable: false });

/**
 * @param {undefined | null | Date | number | string | (() => Date|number) | { time?: Date|number|string, fixed?: boolean } | Function & { isClock: true }} spec
 */
export function createClock(spec) {
  if (spec === undefined || spec === null) return systemClock;
  if (typeof spec === "function" && spec.isClock) return spec;
  if (typeof spec === "function") {
    return decorate(() => {
      const value = spec();
      return new Date(value instanceof Date ? value.getTime() : toMs(value));
    }, { controllable: false });
  }
  const options = typeof spec === "object" && !(spec instanceof Date) ? spec : { time: spec };
  if (!Object.hasOwn(options, "time")) throw new TypeError("Sahte saat için zaman (time) gerekli.");
  let base = toMs(options.time);
  let fixed = Boolean(options.fixed);
  let mark = performance.now();
  const current = () => (fixed ? base : base + Math.floor(performance.now() - mark));
  const now = decorate(() => new Date(current()), { controllable: true });
  now.set = time => {
    base = toMs(time);
    mark = performance.now();
  };
  now.advance = delta => {
    base = current() + durationOf(delta);
    mark = performance.now();
  };
  now.freeze = time => {
    base = time === undefined ? current() : toMs(time);
    fixed = true;
  };
  now.resume = () => {
    base = current();
    mark = performance.now();
    fixed = false;
  };
  now.isFixed = () => fixed;
  return now;
}
