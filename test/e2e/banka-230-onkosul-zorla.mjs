// banka-230-hareket-yaris ön koşul yarışını ZORLA üretmek için ön yükleme (ders 20; CI #1036 b57c527d, 06.11.2026: "ÖN KOŞUL OLUŞMADI: soru 1.200 ms içinde belirdi
// (-8 ms) (deneme sayılmaz, kırmızı)" — commit'te ürün kodu yoktu; testin kendi ön koşulu yavaş koşucuda oluşmadı, deneme kırmızı sayıldı, sonraki 24 e2e koşmadı).
// Senaryo dosyasına ve ürün koduna dokunmadan açılan sayfaya iki ön koşuldan birini kurar:
//   HOF_ZORLA_B230=sira:<n>[,<m>…] — sayfanın n'inci (1'den) POST /api/workspace/bank/vouchers isteğinin yanıtı HOF_ZORLA_GECIKME ms (varsayılan 1500) tutulur: o denemede
//                                    soru geç belirir. ERKEN varyantın (C) denemesine denk gelirse "soru 1.200 ms içinde" ön koşulu OLUŞMAZ (yüklü koşucunun yavaş yanıtı).
//                                    Sıra (varsayılan TUR=2): A1 → 1–2, B1 → 3–4, C1 → 5–6 (her deneme 409 + 200; ön koşulsuz deneme yeniden denenirse sonrakiler kayar).
//   HOF_ZORLA_B230=cpu:<kat>       — sayfanın işlemcisi CDP Emulation.setCPUThrottlingRate ile <kat> kat yavaşlatılır (yavaş koşucu benzetimi; doğal yarış aranır).
// Her zorlama "[b230-zorla]" ile günlüğe yazılır; düzeltilmiş testin yeşili yalnız bu satırların göründüğü ve ön koşulun sonradan GERÇEKTEN oluştuğu koşuda sayılır.
//
//   HOF_ZORLA_B230=sira:5 node --disable-warning=ExperimentalWarning --import ./test/e2e/banka-230-onkosul-zorla.mjs test/e2e/banka-230-hareket-yaris.mjs
//
// HOF_ZORLA_B230 yoksa hiçbir şey yapmaz.
import { chromium } from "playwright";

const spec = process.env.HOF_ZORLA_B230 || "";
const [mode, arg = ""] = spec.split(":");
if (mode === "sira" || mode === "cpu") {
  const targets = new Set(arg.split(",").map(Number).filter(Number.isFinite));
  const hold = Number(process.env.HOF_ZORLA_GECIKME || 1500);
  const rate = Number(arg) || 4;
  const VOUCHERS = /\/api\/workspace\/bank\/vouchers(\?|$)/;
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...contextOptions) => {
      const context = await newContext(...contextOptions);
      let posts = 0;
      context.on("page", page => {
        if (mode === "cpu") {
          context
            .newCDPSession(page)
            .then(cdp => cdp.send("Emulation.setCPUThrottlingRate", { rate }))
            .then(() => console.log(`[b230-zorla] cpu ${rate} kat yavaş`))
            .catch(error => console.log(`[b230-zorla] cpu kurulamadı: ${error.message}`));
          return;
        }
        // Senaryonun kendi tutma düzeneği (page.route) sarılır: hedef sıradaki POST'un yanıtı burada tutulur, öbürleri senaryonun işleyicisine gider.
        const route = page.route.bind(page);
        page.route = (url, handler, options) =>
          route(
            url,
            async request => {
              if (request.request().method() === "POST" && VOUCHERS.test(request.request().url())) {
                posts += 1;
                if (targets.has(posts)) {
                  const response = await request.fetch();
                  await new Promise(resolve => setTimeout(resolve, hold));
                  console.log(`[b230-zorla] POST /bank/vouchers #${posts}: yanıt ${response.status()} ${hold} ms tutuldu`);
                  return request.fulfill({ response });
                }
              }
              return handler(request);
            },
            options,
          );
      });
      return context;
    };
    return browser;
  };
  console.log(`[b230-zorla] kip ${mode === "sira" ? `sıra ${[...targets].join(", ")} (${hold} ms)` : `cpu ${rate} kat`}`);
}
