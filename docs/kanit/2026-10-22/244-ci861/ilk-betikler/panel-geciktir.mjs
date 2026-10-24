// Zorla üretme (ders 20, CI #861 senaryo-personel-244): Hızlı Arama panelinin (div#hof-search-panel) body'ye eklenmesini HOF_PANEL_GECIKME ms geciktirir;
// böylece panel, testin açtığı pencereden SONRA eklenir (CI'de görülen sıra) ve `.hof-modal-backdrop.is-visible:last-of-type` seçicisi boşa düşer.
// Ürün koduna dokunmaz; yalnız tarayıcıda appendChild'i bu tek öğe için erteler.
import { chromium } from "/home/user/ofis---y-netimi/node_modules/playwright/index.mjs";

const delay = Number(process.env.HOF_PANEL_GECIKME || 4000);
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options);
    await context.addInitScript(ms => {
      const original = Node.prototype.appendChild;
      Node.prototype.appendChild = function (node) {
        if (this === document.body && node && node.id === "hof-search-panel" && !node.__ertelendi) {
          node.__ertelendi = true;
          console.log(`[panel-geciktir] hof-search-panel ${ms} ms ertelendi`);
          setTimeout(() => original.call(document.body, node), ms);
          return node;
        }
        return original.call(this, node);
      };
    }, delay);
    context.on("page", page => page.on("console", msg => { const t = msg.text(); if (t.startsWith("[panel-geciktir]")) console.log(t); }));
    return context;
  };
  return browser;
};
