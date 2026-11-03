// Ders 20 zorla üretme ön yüklemesi (`node --import`) — CI #963 (521be1b9) e2e senaryo-mobil-yazma-247 Y9 "✗ personel tahsilatı kaydedildi" (hemen ardından
// "✓ kaydı giren personel (true)"): test bildirimi (".toast") okurken ekranda ÖNCEKİ bir bildirim (ör. eşlemedeki "Cihaz eşlendi…", 5 sn yaşar) varsa
// waitForSelector(".toast") hemen döner ve kaydın bildirimi henüz eklenmemiş olabilir. Ürün koduna ve senaryo dosyasına dokunmaz.
//   HOF_BILDIRIM_ZORLA=olc   — yalnız ölçer: her sayfada bildirim eklenince / kalkınca "[bildirim-zorla] <sayfa> +ms eklendi|kalkti: <metin>"; mobil yazma
//                              isteği (POST /api/mobil/…) gidince / yanıtı gelince "istek|yanit".
//   HOF_BILDIRIM_ZORLA=yavas — ölçer + mobil yazma isteklerinin (POST /api/mobil/…) yanıtını HOF_BILDIRIM_ZORLA_MS (varsayılan 1200) ms geciktirir: yüklü CI
//                              koşucusunda sunucunun yanıtı testin bildirim okumasından sonra gelir. Ön koşul: istek gittiğinde ekranda başka bir bildirim
//                              VAR ("istek … acik-bildirim N" N > 0) — çıktıdan okunur. HOF_BILDIRIM_ZORLA_BAGLAM=<n>: gecikme yalnız n'inci tarayıcı bağlamında
//                              (senaryo-mobil-yazma-247'de 2 = Y9 personel telefonu; öbür adımların kendi yönlendirmeleri etkilenmez). Verilmezse hepsinde.
// HOF_BILDIRIM_ZORLA yoksa hiçbir şey yapmaz.
import { chromium } from "playwright";

const mode = process.env.HOF_BILDIRIM_ZORLA || "";
if (mode === "olc" || mode === "yavas") {
  const delay = Number(process.env.HOF_BILDIRIM_ZORLA_MS || 1200);
  const only = Number(process.env.HOF_BILDIRIM_ZORLA_BAGLAM || 0);
  let contextNo = 0;
  const t0 = Date.now();
  const log = text => process.stderr.write(`[bildirim-zorla] +${Date.now() - t0} ms ${text}\n`);
  let pageNo = 0;
  const watch = page => {
    const name = `sayfa${++pageNo}`;
    page.on("console", message => {
      const line = message.text();
      if (line.startsWith("[bildirim-zorla]")) log(`${name} ${line.slice(17)}`);
    });
    page.on("request", request => {
      if (request.method() === "POST" && /\/api\/mobil\//.test(request.url())) {
        page.evaluate(() => document.querySelectorAll(".toast").length).then(count => log(`${name} istek ${new URL(request.url()).pathname} acik-bildirim ${count}`), () => null);
      }
    });
    page.on("response", response => {
      if (response.request().method() === "POST" && /\/api\/mobil\//.test(response.url())) log(`${name} yanit ${response.status()} ${new URL(response.url()).pathname}`);
    });
  };
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...contextOptions) => {
      const context = await newContext(...contextOptions);
      contextNo += 1;
      await context.addInitScript(() => {
        const t = () => Math.round(performance.now());
        const observe = () => {
          new MutationObserver(records => {
            for (const record of records) {
              for (const node of record.addedNodes) if (node.classList?.contains("toast")) console.log(`[bildirim-zorla] eklendi(${t()}): ${node.textContent.trim().slice(0, 80)}`);
              for (const node of record.removedNodes) if (node.classList?.contains("toast")) console.log(`[bildirim-zorla] kalkti(${t()}): ${node.textContent.trim().slice(0, 80)}`);
            }
          }).observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.documentElement) observe();
        else document.addEventListener("DOMContentLoaded", observe);
      });
      if (mode === "yavas" && (!only || only === contextNo)) {
        log(`baglam${contextNo}: mobil yazma yanıtı ${delay} ms gecikecek`);
        await context.route(/\/api\/mobil\//, async route => {
          // Yalnız kayıt yazan istekler (eşleme / giriş geciktirilmez: önceki bildirimin ömrünü yemesin).
          if (route.request().method() !== "POST" || /\/api\/mobil\/(session|eslesme)\b/.test(route.request().url())) return route.continue();
          const response = await route.fetch();
          log(`yanit ${delay} ms geciktiriliyor ${new URL(route.request().url()).pathname}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return route.fulfill({ response });
        });
      }
      context.on("page", watch);
      return context;
    };
    return browser;
  };
}
