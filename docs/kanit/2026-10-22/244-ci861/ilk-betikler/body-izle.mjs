// Tanı ön yüklemesi (CI #861 senaryo-personel-244): açılan her sayfada body'ye eklenen ÜST DÜZEY öğeleri (etiket, sınıf, ilk metin) zamanıyla yazar.
// cpu-yavaslat.mjs ile birlikte kullanılır: node --import ./test/e2e/cpu-yavaslat.mjs --import <bu dosya> test/e2e/senaryo-personel-244.mjs
import { chromium } from "/home/user/ofis---y-netimi/node_modules/playwright/index.mjs";

const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options);
    await context.addInitScript(() => {
      const start = performance.now();
      const watch = () => new MutationObserver(list => {
        for (const m of list) for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const cls = String(n.className || "").slice(0, 60);
          const txt = String(n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70);
          console.log(`[body-izle] +${Math.round(performance.now() - start)}ms <${n.tagName.toLowerCase()} class="${cls}"> ${txt}`);
        }
      }).observe(document.body, { childList: true });
      if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
    });
    context.on("page", page => page.on("console", msg => { const t = msg.text(); if (t.startsWith("[body-izle]")) console.log(t); }));
    return context;
  };
  return browser;
};
