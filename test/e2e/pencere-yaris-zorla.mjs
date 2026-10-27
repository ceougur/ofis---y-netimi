// Pencere yarışını ZORLA üretmek için ön yükleme (ders 20; CI #861 senaryo-personel-244, 22.10.2026). Senaryo dosyasına ve ürün koduna
// dokunmadan açılan her sayfaya iki ön koşuldan birini kurar:
//   HOF_ZORLA=gorunur — pencere (.hof-modal-backdrop) açıldıktan sonra "is-visible" sınıfı HOF_ZORLA_GECIKME ms (varsayılan 1500) geç gelir:
//                       yüklü makinede karenin gecikmesi. Pencerenin alanları bu arada Playwright için "görünür"dür (opaklık 0).
//   HOF_ZORLA=div     — pencere body'ye eklenir eklenmez body'nin SONUNA boş, gizli bir div eklenir: ürünün sonradan eklediği bildirim kabı,
//                       Hızlı Arama paneli ya da açılır menü gibi. Pencere artık body'nin son div'i değildir.
// HOF_ZORLA_HEDEF: yalnız bu öğelerden birini içeren pencereler (virgüllü CSS; yoksa bütün pencereler). Her zorlama "[pencere-zorla]" ile
// pencere başlığıyla birlikte günlüğe yazılır; yeşil yalnız bu satırların göründüğü koşuda sayılır.
//   HOF_ZORLA=olc     — hiçbir şeyi değiştirmez, YALNIZ ÖLÇER (doğal ön koşul var mı?): hedef pencere body'ye eklendikten kaç ms sonra
//                       "is-visible" aldı ve o anda HOF_ZORLA_ICERIK (CSS; ör. ".hof-stock-table tbody tr") pencerede zaten var mıydı.
//                       "[pencere-zorla] olc … icerik-once": içerik is-visible'dan ÖNCE hazırdı — yalnız içeriği bekleyen test bu arada
//                       "açık pencere yok" sanabilir (CI #887 uiux-a-243 I). Sayfa saati page.clock ile kurulunca requestAnimationFrame
//                       sahte saatin ≤ 16 ms'lik zamanlayıcısıdır (gerçek setTimeout ile ilerler), boyamaya bağlı değildir.
//
//   HOF_ZORLA=gorunur HOF_ZORLA_HEDEF=".hof-staff-form" node --disable-warning=ExperimentalWarning --import ./test/e2e/pencere-yaris-zorla.mjs test/e2e/senaryo-personel-244.mjs
//
// HOF_ZORLA yoksa hiçbir şey yapmaz.
import { chromium } from "playwright";

const mode = process.env.HOF_ZORLA || "";
if (mode === "gorunur" || mode === "div" || mode === "olc") {
  const options = { mode, delay: Number(process.env.HOF_ZORLA_GECIKME || 1500), target: process.env.HOF_ZORLA_HEDEF || "", content: process.env.HOF_ZORLA_ICERIK || "" };
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...contextOptions) => {
      const context = await newContext(...contextOptions);
      await context.addInitScript(install, options);
      context.on("page", page =>
        page.on("console", message => {
          const text = message.text();
          if (text.startsWith("[pencere-zorla]")) console.log(text);
        }),
      );
      return context;
    };
    return browser;
  };
  console.log(`[pencere-zorla] kip ${mode}${mode === "gorunur" ? ` ${options.delay} ms` : ""}, hedef ${options.target || "bütün pencereler"}`);
}

// Sayfada çalışır (init betiği): yalnız kendi parametrelerini görür.
function install({ mode, delay, target, content }) {
  const title = node => (node.querySelector(".hof-modal-title")?.textContent || "").trim().slice(0, 60);
  const wanted = node => node instanceof Element && node.classList.contains("hof-modal-backdrop") && (!target || Boolean(node.querySelector(target)));
  if (mode === "olc") {
    // Sahte saatten bağımsız ölçüm: init betiği sayfa saatinden (page.clock) önce çalışır, gerçek performance.now burada tutulur.
    const realNow = performance.now.bind(performance);
    const added = new WeakMap();
    const seen = new WeakSet();
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element && node.classList.contains("hof-modal-backdrop")) added.set(node, realNow());
        const node = record.target;
        if (record.type !== "attributes" || !wanted(node) || !node.classList.contains("is-visible") || seen.has(node)) continue;
        seen.add(node);
        const gap = added.has(node) ? (realNow() - added.get(node)).toFixed(1) : "?";
        const ready = content ? Boolean(node.querySelector(content)) : false;
        console.log(`[pencere-zorla] olc "${title(node)}": is-visible ${gap} ms sonra; ${ready ? "icerik-once" : "icerik-sonra"}`);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return;
  }
  if (mode === "gorunur") {
    const removeToken = DOMTokenList.prototype.remove;
    // Ürün pencereyi kapatırken is-visible'ı kaldırır; bekleyen geri ekleme kapanmış pencereyi yeniden göstermez.
    DOMTokenList.prototype.remove = function (...tokens) {
      if (tokens.includes("is-visible")) this.hofZorlaKapandi = true;
      return removeToken.apply(this, tokens);
    };
    const held = new WeakSet();
    new MutationObserver(records => {
      for (const record of records) {
        const node = record.target;
        if (!wanted(node) || !node.classList.contains("is-visible") || held.has(node)) continue;
        held.add(node);
        removeToken.call(node.classList, "is-visible");
        console.log(`[pencere-zorla] "${title(node)}": is-visible ${delay} ms ertelendi`);
        setTimeout(() => {
          if (!node.isConnected || node.classList.hofZorlaKapandi) return;
          node.classList.add("is-visible");
          console.log(`[pencere-zorla] "${title(node)}": is-visible geldi`);
        }, delay);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return;
  }
  const watch = () =>
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!wanted(node)) continue;
          const extra = document.createElement("div");
          extra.hidden = true;
          extra.dataset.pencereZorla = "pencereden-sonra";
          document.body.appendChild(extra);
          console.log(`[pencere-zorla] "${title(node)}": pencereden sonra body'ye div eklendi`);
        }
      }
    }).observe(document.body, { childList: true });
  if (document.body) watch();
  else document.addEventListener("DOMContentLoaded", watch);
}
