# senaryo-banka-210'un TANI kopyasını üretir (kanıt değil; depoya girmez): adım 14–15'te banka isteklerinin, pencere yeniden çizimlerinin
# (süzgeç çubuğundaki arama kutusu yeni düğüm) ve arama yazımının zamanlarını yazar; adım 15'ten sonra durur.
# Kullanım: python3 -I tani-yama.py <kaynak senaryo> <hedef dosya>
import sys

src, dst = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()

a = '  await step("14. Faiz geliri 1.000 / %15 ekrandan: net 850, stopaj 150 (193), 642 = 1.000", async () => {\n'
assert text.count(a) == 1
text = text.replace(a, a + '''    const t0 = Date.now();
    globalThis.__tani = text => console.log(`    [tani ${String(Date.now() - t0).padStart(5)} ms] ${text}`);
    admin.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/workspace/bank/") || url.pathname.startsWith("/api/workspace/overview")) globalThis.__tani(`istek ${request.method()} ${url.pathname.replace("/api/workspace", "")}${url.search}`);
    });
    admin.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/workspace/bank/")) globalThis.__tani(`yanıt ${url.pathname.replace("/api/workspace", "")}${url.search}`);
    });
    admin.on("console", message => {
      if (message.text().startsWith("[tani]")) globalThis.__tani(message.text());
    });
    await admin.evaluate(() => {
      let last = document.querySelector('.hof-bank-modal [data-mv="q"]');
      new MutationObserver(() => {
        const box = document.querySelector('.hof-bank-modal [data-mv="q"]');
        if (box === last) return;
        console.log(`[tani] SÜZGEÇ ÇUBUĞU YENİDEN ÇİZİLDİ (eski kutu ${last ? `"${last.value}"` : "yok"}, yeni kutu ${box ? `"${box.value}"` : "yok"}, odak ${document.activeElement?.dataset?.mv || document.activeElement?.tagName})`);
        last = box;
      }).observe(document, { childList: true, subtree: true });
      for (const type of ["input", "change"]) document.addEventListener(type, event => { if (event.target?.matches?.("[data-mv]")) console.log(`[tani] ${type} ${event.target.dataset.mv}="${event.target.value}"`); }, true);
      window.HOF.on("live:overview.changed", () => console.log("[tani] canlı olay overview.changed geldi"));
      window.HOF.on("ledger:changed", detail => console.log(`[tani] yerel ledger:changed ${detail?.path || ""}`));
    });
''')

b = '    await admin.fill(`${bankWin} [data-mv="q"]`, feeNo);\n'
assert text.count(b) == 1
text = text.replace(b, '    globalThis.__tani("fill(q) BAŞLIYOR");\n' + b + '    globalThis.__tani("fill(q) BİTTİ");\n')

c = '  await step("16. Ters Kaydet'
assert text.count(c) == 1
text = text.replace(c, '  if (process.env.B210_TANI) throw new Error("TANI: adım 15\'ten sonra duruldu");\n' + c)
open(dst, "w", encoding="utf-8").write(text)
print("yazıldı", dst)
