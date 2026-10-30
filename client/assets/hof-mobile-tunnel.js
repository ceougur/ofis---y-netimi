/* DestekOfis — Yönetim → Mobil Cihazlar → Uzaktan Bağlantı durum satırı (2.4.7 M4; sunucu routes/mobile-tunnel.mjs, lib/tunnel/manager.mjs).
   Bağlı / Bağlanıyor / Kapalı + neden. Kart açıkken 5 sn'de bir yenilenir (hof-mobile-devices.js load() bu modülü çağırır). Satır kendi öğesinde
   (#adm-mobile-tunnel, durum kartının hemen altına eklenir); kartın öbür bölümlerine dokunmaz. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  let timer = null;

  function holder() {
    let node = document.getElementById("adm-mobile-tunnel");
    if (node) return node;
    const status = document.getElementById("adm-mobile-status");
    if (!status) return null;
    node = document.createElement("section");
    node.id = "adm-mobile-tunnel";
    node.className = "adm-card";
    node.setAttribute("aria-live", "polite");
    status.insertAdjacentElement("afterend", node);
    return node;
  }

  function render(data) {
    const node = holder();
    if (!node) return;
    const state = ["connected", "connecting", "off"].includes(data.state) ? data.state : "off";
    const reason = data.reason ? ` — ${esc(data.reason)}` : "";
    const retry = state === "off" && data.retryInSeconds ? ` <small class="adm-muted" data-tunnel-retry>${esc(Math.ceil(data.retryInSeconds / 60))} dk içinde yeniden denenecek.</small>` : "";
    const address = data.publicUrl ? `<br><small class="adm-muted" data-tunnel-url>Ofis adresi: ${esc(data.publicUrl)}</small>` : "";
    node.innerHTML = `<h2>Uzaktan Bağlantı</h2><p class="adm-mobile-count" data-mobile-tunnel data-state="${state}"><b data-tunnel-label>${esc(data.label || "Kapalı")}</b>${reason}${retry}${address}</p>`;
  }

  async function load() {
    clearTimeout(timer);
    try {
      render(await HOF.api("/api/admin/mobile/tunnel"));
    } catch (error) {
      render({ state: "off", label: "Kapalı", reason: error.message });
    }
    const panel = document.querySelector('[data-panel="mobile"]');
    if (panel && !panel.hidden) timer = setTimeout(load, 5000);
  }

  HOF.mobileTunnel = { load };
})();
