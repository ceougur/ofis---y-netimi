// Zil yarışını ZORLA üretmek için ön yükleme (ders 20; CI #1071 senaryo-tyk-tur2a-250 — üç 'zilde: []', yerelde ara sıra E12; 12.11.2026). Senaryo dosyasına ve ürün
// koduna dokunmadan, açılan her sayfanın TAKVİM isteğinin (/api/workspace/dues — zilin ve Tahsilat Takvimi'nin verisi) yanıtını HOF_ZIL_GECIKME ms (varsayılan 6000)
// bekletir ve her yanıtı günlüğe yazar: kaç kalem, hangi sürüm, sayfaya ne zaman verildi.
//
// KÖK NEDEN (kayıttan): zil paneli sayfanın BELLEKTEKİ takviminden kurulur ve açıldıktan sonra kendini yenilemez (client/assets/hof-alerts.js openPanel); sayfanın takvimi
// sunucudaki bir değişiklikten ≥ 0,8 sn sonra ve en sık 4 sn'de bir yenilenir (client/assets/hof-promises.js liveSoon: delay 800, gap 4000). Senaryo API ile yazıp hemen zili
// açınca sayfa henüz yenilenmemiş olabilir: panelde yeni kalem yoktur ('zilde: []'), oysa sunucunun o andaki yanıtında kalem VARDIR. Yüklü makinede (CI) aralık uzar.
// Bu ön yükleme aralığı zorla uzatır: eski yardımcı (panel açılır, 300 ms beklenir, okunur) her zil okumasında kırmızı olur; yeni yardımcı (test/e2e/zil-oku.mjs — sayfanın
// takvimi sunucunun güncel sürümüne yetişene kadar bekler) yeşildir. Yeşil yalnız "[zil-zorla] yanıt … bekletildi" satırlarının göründüğü koşuda sayılır.
//
//   HOF_ZIL_ZORLA=1 node --disable-warning=ExperimentalWarning --import ./test/e2e/zil-yaris-zorla.mjs test/e2e/senaryo-tyk-tur2a-250.mjs
//
// HOF_ZIL_ZORLA yoksa hiçbir şey yapmaz.
import { chromium } from "playwright";

if (process.env.HOF_ZIL_ZORLA) {
  const delay = Number(process.env.HOF_ZIL_GECIKME || 6000);
  const started = Date.now();
  const stamp = () => `${((Date.now() - started) / 1000).toFixed(1)} sn`;
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...contextOptions) => {
      const context = await newContext(...contextOptions);
      await context.route(/\/api\/workspace\/dues(\?|$)/, async route => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        let summary = "okunamadı";
        try {
          const body = await response.json();
          const data = body?.data ?? body;
          summary = data?.unchanged ? `değişmedi (sürüm ${data.version})` : `${(data?.items || []).length} kalem, sürüm ${data?.version}`;
        } catch {
          summary = "okunamadı";
        }
        console.log(`[zil-zorla] ${stamp()} yanıt ${response.status()}: ${summary} — ${delay} ms bekletiliyor`);
        // Gerçek zamanlayıcı (sayfanın sahte saati değil): yanıt sayfaya gecikmeli verilir.
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.fulfill({ response }).catch(() => null);
        console.log(`[zil-zorla] ${stamp()} yanıt sayfaya verildi (${summary}) — bekletildi`);
      });
      return context;
    };
    return browser;
  };
  console.log(`[zil-zorla] takvim isteğinin yanıtı ${delay} ms bekletilecek`);
}
