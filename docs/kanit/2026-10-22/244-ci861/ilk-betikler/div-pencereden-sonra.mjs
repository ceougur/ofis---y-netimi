// Zorla üretme (ders 20, CI #861 senaryo-personel-244, VARSAYIM B): personel formunun penceresi body'ye eklenir eklenmez (aynı mikro görevde) body'nin
// SONUNA boş, gizli bir div eklenir — ürünün sonradan eklediği bildirim kabı (#hof-toasts), Hızlı Arama paneli, açılır menü gibi. Böylece pencere artık
// "son div" değildir; `.hof-modal-backdrop.is-visible:last-of-type` seçicisi boşa düşer.
import { sar } from "./pw-sar.mjs";

await sar(() => {
  const done = new WeakSet();
  const watch = () => new MutationObserver(list => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || !n.classList.contains("hof-modal-backdrop") || done.has(n) || !n.querySelector(".hof-staff-form")) continue;
      done.add(n);
      const extra = document.createElement("div");
      extra.dataset.zorla = "pencereden-sonra";
      extra.hidden = true;
      document.body.appendChild(extra);
      console.log("[zorla-B] personel formu penceresinden sonra body'ye div eklendi");
    }
  }).observe(document.body, { childList: true });
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
}, null, "[zorla-B]");
