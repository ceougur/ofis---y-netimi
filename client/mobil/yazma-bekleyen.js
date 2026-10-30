// DestekOfis Mobil — sonucu belirsiz yazma isteklerinin telefondaki kuralı (2.4.7 M5; kullanıcı kararı S7, docs/2.4.7-IS-LISTESI.md "KARARLAR — M5").
// Saf modül (DOM'a dokunmaz): telefon arayüzü (yazma.js) ve kâhinin program sürücüsü (test/bagimsiz/mobil-yazma/program-surucu.mjs) AYNI kuralı kullanır.
//
// Kural: istek kimliği formun açıldığı anda üretilir; bağlantı kopup sonuç görülmezse telefon AYNI kimlik ve AYNI gövdeyle yeniden gönderir (sunucu ikinci
// kaydı açmaz, ilk sonucu döndürür). Formun açılışından 24 saat geçtiyse telefon YENİDEN GÖNDERMEZ (S7; yaygın ödeme API'lerinde istek kimliği 24 saat):
// kullanıcıya "Cari hareketlerinden denetleyin" der; gerekiyorsa kayıt yeni formla girilir. Sunucu kapalıyken istek kuyruğa alınmaz, kendiliğinden gönderilmez.
export const RESEND_HOURS = 24;
const HOUR = 3_600_000;

/** Sonucu belirsiz kayıt yeniden gönderilebilir mi? kayit.formAt: formun açıldığı an (ms); simdi: şimdiki an (ms). */
export function yenidenGonderilebilir(kayit, simdi) {
  const formAt = Number(kayit?.formAt);
  if (!Number.isFinite(formAt)) return false;
  return Number(simdi) - formAt <= RESEND_HOURS * HOUR;
}

/** Bekleyen kayıtlar (telefonun yerel deposu; yalnız sonucu belirsiz istekler). Depo verilmezse bellekte tutulur. */
export function createBekleyenler(storage = null, key = "destekofis-mobil-bekleyen") {
  let memory = [];
  const read = () => {
    if (!storage) return memory;
    try {
      const list = JSON.parse(storage.getItem(key) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  const write = list => {
    if (!storage) memory = list;
    else {
      try {
        storage.setItem(key, JSON.stringify(list));
      } catch {
        memory = list;
      }
    }
  };
  return {
    list: () => read(),
    add(kayit) {
      write([...read().filter(item => item.requestId !== kayit.requestId), kayit]);
    },
    remove(requestId) {
      write(read().filter(item => item.requestId !== requestId));
    },
    get: requestId => read().find(item => item.requestId === requestId) || null,
  };
}
