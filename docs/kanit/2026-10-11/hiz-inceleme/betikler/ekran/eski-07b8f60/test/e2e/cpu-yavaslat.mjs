// Arayüz senaryolarını YAVAŞ makinede koşmak için ön yükleme (10.10.2026, senaryo-222 yarış incelemesi). Senaryo dosyasına
// dokunmadan, açılan her sayfaya Chromium'un CPU yavaşlatmasını (CDP Emulation.setCPUThrottlingRate) uygular: CI makinesi
// gibi yavaş bir tarayıcıda zamanlamaya bağlı yarışlar ortaya çıkar.
//
//   HOF_CPU_YAVASLAT=4 node --disable-warning=ExperimentalWarning --import ./test/e2e/cpu-yavaslat.mjs test/e2e/senaryo-222.mjs
//
// HOF_CPU_YAVASLAT yoksa ya da 1 ise hiçbir şey yapmaz.
import { chromium } from "playwright";

const rate = Number(process.env.HOF_CPU_YAVASLAT || 1);
if (rate > 1) {
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...options) => {
      const context = await newContext(...options);
      context.on("page", page => {
        context
          .newCDPSession(page)
          .then(session => session.send("Emulation.setCPUThrottlingRate", { rate }))
          .catch(error => console.error(`[cpu-yavaslat] uygulanamadı: ${error.message}`));
      });
      return context;
    };
    return browser;
  };
  console.log(`[cpu-yavaslat] Chromium CPU yavaşlatması ×${rate}`);
}
