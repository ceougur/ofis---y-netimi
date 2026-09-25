/* DestekOfis — lisans durumu (v2.0.0).
 * Ekranın altında küçük bir lisans şeridi gösterir (deneme süresi, geçiş dönemi, bitişe yakın lisans, salt okunur mod).
 * Program salt okunurken (süre doldu, engellendi, doğrulanamadı, saat hatası) açılışta ve yazma denendiğinde açıklayıcı
 * bir pencere gösterir; yönetici için Lisans ekranına bağlantı verir. Sunucu her yazma isteğini zaten reddeder; bu dosya
 * yalnızca durumu anlaşılır kılar. */
(() => {
  "use strict";
  const HOF = window.HOF;
  if (!HOF) return;
  const html = document.documentElement;
  const SNOOZE_KEY = "hof-license-snooze";
  let license = null;
  let lastModalAt = 0;

  const isAdmin = () => HOF.can("license.manage");
  const adminLink = () => (isAdmin() ? '<a class="hof-button hof-button-small" href="/admin.html#license">Lisans ekranını aç</a>' : "");

  function snoozed(status) {
    try {
      return sessionStorage.getItem(SNOOZE_KEY) === `${status.state}:${status.daysLeft}`;
    } catch {
      return false;
    }
  }

  function render(status) {
    license = status;
    HOF.license = status;
    html.classList.toggle("hof-read-only", Boolean(status && !status.writable));
    document.getElementById("hof-license-bar")?.remove();
    if (!status) return;
    // Lisanslı ve sorunsuz: şerit yok.
    if (status.writable && status.severity === "ok") return;
    if (status.writable && snoozed(status)) return;
    // Bilgi niteliğindeki deneme şeridi yalnızca yöneticiye; uyarı ve salt okunur durum herkese gösterilir.
    if (status.writable && status.severity === "info" && !isAdmin()) return;
    const tone = status.writable ? (status.severity === "warn" ? "warn" : "info") : "error";
    const bar = HOF.el(
      "aside",
      { id: "hof-license-bar", class: `hof-license-bar is-${tone}`, role: status.writable ? "status" : "alert", "aria-live": "polite" },
      `<div class="hof-license-text"><strong>${HOF.esc(status.title)}</strong><span>${HOF.esc(status.writable ? status.message : "Program salt okunur: kayıtları görebilir, dışa aktarabilir ve yedekleyebilirsiniz; yeni işlem yapılamaz.")}</span></div>
       <div class="hof-license-actions">${status.writable ? "" : '<button type="button" class="hof-button hof-button-ghost hof-button-small" data-license-more>Ayrıntı</button>'}${adminLink()}${status.writable ? '<button type="button" class="hof-license-close" aria-label="Şeridi gizle" data-license-close>×</button>' : ""}</div>`,
    );
    bar.addEventListener("click", event => {
      if (event.target.closest("[data-license-close]")) {
        try {
          sessionStorage.setItem(SNOOZE_KEY, `${status.state}:${status.daysLeft}`);
        } catch {
          // gizli pencerede depolama kapalı olabilir
        }
        bar.remove();
      } else if (event.target.closest("[data-license-more]")) explain(status);
    });
    document.body.appendChild(bar);
  }

  function explain(status = license, { attempted = false } = {}) {
    if (!status || HOF.hasOpenModal()) return;
    lastModalAt = Date.now();
    const lead = attempted ? "<p><b>Bu işlem yapılamadı.</b></p>" : "";
    const hint = isAdmin()
      ? "<p>Lisansı etkinleştirmek veya doğrulamak için Lisans ekranını açın.</p>"
      : "<p>Ofis yöneticinize haber verin: yönetici, Yönetim → Lisans ekranından lisansı etkinleştirebilir.</p>";
    HOF.modal({
      title: status.title,
      eyebrow: "LİSANS",
      size: "small",
      body: `<div class="hof-modal-text">${lead}<p>${HOF.esc(status.message)}</p>${hint}</div><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Tamam</button>${adminLink()}</div>`,
      onOpen: modal => modal.dialog.querySelector("[data-close]").addEventListener("click", () => modal.close()),
    });
  }

  async function refresh() {
    try {
      const status = await HOF.api("/api/license");
      const before = license;
      render(status);
      // Yazılabilirlik değiştiyse ekranlardaki yetkiler (düğmeler) eski kalır: yenileme önerilir.
      if (before && before.writable !== status.writable) HOF.showReloadBanner?.("Lisans durumu değişti. Güncel ekran için sayfayı yenileyin.");
    } catch (error) {
      if (error.status !== 401) console.warn("[DestekOfis] Lisans durumu alınamadı", error.message);
    }
  }

  HOF.whenReady(user => {
    render(user?.license || null);
    if (license && !license.writable) setTimeout(() => explain(license), 1200);
  });
  HOF.on("license-read-only", payload => {
    if (payload?.license) render({ ...license, ...payload.license });
    if (Date.now() - lastModalAt > 20_000) explain(license, { attempted: true });
  });
  HOF.on("live:license.changed", () => refresh());
  HOF.on("live:resync", () => refresh());
  // Kalan gün sayısı gün içinde değişebilir; saatte bir tazelenir.
  setInterval(() => HOF.isReady && !document.hidden && refresh(), 3_600_000);
  HOF.refreshLicense = refresh;
})();
