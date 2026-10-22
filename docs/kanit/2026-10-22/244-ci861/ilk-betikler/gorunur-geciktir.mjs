// Zorla üretme (ders 20, CI #861 senaryo-personel-244, VARSAYIM A): personel formunun penceresi (içinde .hof-staff-form) body'ye eklendikten sonra
// "is-visible" sınıfı HOF_GORUNUR_GECIKME ms geç gelir (yüklü makinede karenin gecikmesi). Ürün sınıfı rAF'ta ekleyince gözlemci aynı mikro görevde
// (testin bir sonraki isteğinden önce) geri alır, süre sonunda yeniden ekler. Form alanı bu arada Playwright için "görünür"dür (opaklık 0).
import { sar } from "./pw-sar.mjs";

await sar(ms => {
  const held = new WeakSet();
  new MutationObserver(list => {
    for (const m of list) {
      const n = m.target;
      if (!(n instanceof Element) || !n.classList.contains("hof-modal-backdrop") || !n.classList.contains("is-visible")) continue;
      if (held.has(n) || !n.querySelector(".hof-staff-form")) continue;
      held.add(n);
      n.classList.remove("is-visible");
      console.log(`[zorla-A] personel formu penceresi: is-visible ${ms} ms ertelendi`);
      setTimeout(() => { n.classList.add("is-visible"); console.log("[zorla-A] is-visible geldi"); }, ms);
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
}, Number(process.env.HOF_GORUNUR_GECIKME || 1500), "[zorla-A]");
