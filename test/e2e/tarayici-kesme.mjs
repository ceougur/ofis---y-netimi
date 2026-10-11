// Arayüz senaryolarının tarayıcı hata toplayıcısı için: tarayıcının GEZİNME ya da KAPANMA yüzünden kestiği istek ↔ "Failed to fetch" konsol hatası
// eşlemesi (10.10.2026; yeniden üretim test/e2e/banka-210-fetch-yaris.mjs). Ana sayfa açılırken giden tablo sorgusu (/api/trpc/sheets.getRows)
// yük altında geç yanıtlanır; test sayfa hazır olunca başka sayfaya geçerse tarayıcı isteği keser (requestfailed "net::ERR_ABORTED") ve
// uygulamanın sorgu önbelleği bunu console.error("[API Query Error] TRPCClientError: Failed to fetch") ile yazar. Sayfa zaten ayrılmıştır;
// kullanıcıya görünen bir hata değildir. Ayrım: "Failed to fetch" yalnız aynı sayfada ±3 sn içinde tarayıcının kestiği bir istekle (tRPC
// hatası için tRPC isteğiyle; her kesme bir kez) eşleşirse sayılmaz. Sunucu düşmesi (ERR_CONNECTION_REFUSED / RESET / EMPTY_RESPONSE),
// eşleşmeyen ya da kesmeden fazla "Failed to fetch" ve başka her konsol hatası SAYILIR.
export function fetchCutWatch(page, { windowMs = 3000 } = {}) {
  const cuts = [];
  const fails = [];
  page.on("requestfailed", request => cuts.push({ at: Date.now(), error: request.failure()?.errorText || "", url: request.url() }));
  return {
    // Konsol hatası "Failed to fetch" ise karar sona ertelenir (true); değilse false (çağıran kendi süzgecini uygular).
    defer(text) {
      if (!/Failed to fetch/.test(text)) return false;
      fails.push({ at: Date.now(), text });
      return true;
    },
    // Kesmeyle açıklanamayan "Failed to fetch" hataları.
    unexplained() {
      const free = cuts.filter(cut => cut.error === "net::ERR_ABORTED").map(cut => ({ ...cut, used: false }));
      const out = [];
      for (const item of fails) {
        const trpc = /TRPCClientError/.test(item.text);
        const match = free.find(cut => !cut.used && Math.abs(cut.at - item.at) <= windowMs && (!trpc || cut.url.includes("/api/trpc/")));
        if (match) match.used = true;
        else out.push(item.text);
      }
      return out;
    },
    cuts: () => cuts.map(cut => ({ ...cut })),
  };
}
