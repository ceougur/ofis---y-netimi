/* DestekOfis — Excel'e dışa aktarma (v2.0.1).
 * Tablonun üstündeki "Dışa aktar" düğmesi küçük bir menü açar: açık sekmeyi ya da tüm sekmeleri (her sekme ayrı
 * sayfada) gerçek Excel dosyası (.xlsx) olarak indirir; eski CSV seçeneği de durur. Excel dosyasını sunucu hazırlar
 * (GET /api/workspace/export.xlsx): tutarlar, tarihler ve yüzdeler Excel'de hesaplanabilir sayılar olarak, ekrandaki
 * görünüşleriyle yazılır; başlık satırı sabit ve süzgeçlidir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  const SHEET_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 9h16M4 15h16M10 9v12"/></svg>';
  const BOOK_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="14" height="15" rx="2.2"/><path d="M4 7v12a2 2 0 0 0 2 2h11"/><path d="M6 8h14M11 8v10"/></svg>';
  const TEXT_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

  let menu = null;
  let anchor = null;
  let bypass = false; // CSV seçilince paketin kendi CSV indirmesi çalışsın diye düğmeye yeniden tıklanır

  const isExportButton = element => Boolean(element) && /Dışa aktar/i.test(element.textContent || "");
  const tabs = () => {
    const rows = HOF.data?.rows || [];
    const counts = new Map();
    for (const row of rows) {
      const key = String(row.__sheet || "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return { rows: rows.length, counts };
  };

  function close({ focus = false } = {}) {
    if (!menu) return;
    menu.remove();
    menu = null;
    document.removeEventListener("mousedown", onOutside, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    anchor?.setAttribute("aria-expanded", "false");
    if (focus) anchor?.focus();
  }
  const onOutside = event => {
    if (menu && !menu.contains(event.target) && !anchor?.contains(event.target)) close();
  };
  function reposition() {
    if (!menu || !anchor?.isConnected) return close();
    const box = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, box.right - width));
    const below = box.bottom + 8;
    const top = below + menu.offsetHeight > window.innerHeight - 12 ? Math.max(12, box.top - menu.offsetHeight - 8) : below;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function open(button) {
    close();
    anchor = button;
    const { rows, counts } = tabs();
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    const tabCount = [...counts.keys()].filter(Boolean).length;
    const here = tab ? counts.get(tab) || 0 : rows;
    const items = [
      { action: "tab", icon: SHEET_ICON, title: tab && tabCount > 1 ? "Excel · Bu Sekme" : "Excel Dosyası (.xlsx)", note: tab && tabCount > 1 ? `“${HOF.sections?.pretty ? HOF.sections.pretty(tab) : tab}” · ${number(here)} kayıt` : `${number(here)} kayıt · tutar ve tarihler hesaplanabilir` },
      tabCount > 1 ? { action: "all", icon: BOOK_ICON, title: "Excel · Tüm Sekmeler", note: `${number(tabCount)} sekme, her biri ayrı sayfada · ${number(rows)} kayıt` } : null,
      { action: "csv", icon: TEXT_ICON, title: "CSV (düz metin)", note: "Açık sekme; eski programlar için", muted: true },
    ].filter(Boolean);
    menu = HOF.el(
      "div",
      { class: "hof-export-menu", role: "menu", "aria-label": "Dışa aktarma biçimi" },
      `<p class="hof-export-title">Dışa Aktar</p>${items
        .map(item => `${item.muted ? '<hr aria-hidden="true">' : ""}<button type="button" role="menuitem" class="hof-export-item${item.muted ? " is-muted" : ""}" data-export="${item.action}"><span class="hof-export-icon">${item.icon}</span><span class="hof-export-text"><b>${esc(item.title)}</b><small>${esc(item.note)}</small></span></button>`)
        .join("")}`,
    );
    document.body.appendChild(menu);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "true");
    reposition();
    menu.querySelector("button")?.focus();
    document.addEventListener("mousedown", onOutside, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    menu.addEventListener("keydown", event => {
      const buttons = [...menu.querySelectorAll("button")];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close({ focus: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
      } else if (event.key === "Tab") close();
    });
    menu.addEventListener("click", event => {
      const item = event.target.closest("[data-export]");
      if (!item) return;
      const action = item.dataset.export;
      const target = anchor;
      close();
      if (action === "csv") {
        // CSV'yi arayüz paketinin kendi (gizli) düğmesi üretir; menü araç çubuğundaki düğmeden açıldıysa ona tıklanır.
        const native = [...document.querySelectorAll(".button-row button")].find(isExportButton) || target;
        bypass = true;
        try {
          native.click();
        } finally {
          bypass = false;
        }
      } else download({ all: action === "all", tab: action === "tab" && tabCount > 1 ? tab : "" }, target);
    });
  }

  const fileNameOf = (header, fallback) => {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(header || "");
    if (star) {
      try {
        return decodeURIComponent(star[1]);
      } catch {
        // ASCII ada düşülür.
      }
    }
    return /filename="([^"]+)"/i.exec(header || "")?.[1] || fallback;
  };

  async function download({ all = false, tab = "" } = {}, button) {
    const query = all ? "all=1" : tab ? `tab=${encodeURIComponent(tab)}` : "";
    button?.classList.add("is-busy");
    if (button) button.disabled = true;
    const slow = setTimeout(() => HOF.toast("Excel dosyası hazırlanıyor…"), 700);
    try {
      const response = await HOF.nativeFetch(HOF.apiUrl(`/api/workspace/export.xlsx${query ? `?${query}` : ""}`), { credentials: "same-origin" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Excel dosyası hazırlanamadı.");
      }
      const blob = await response.blob();
      const name = fileNameOf(response.headers.get("content-disposition"), "DestekOfis.xlsx");
      const url = URL.createObjectURL(blob);
      const link = HOF.el("a", { href: url, download: name, hidden: true });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const count = Number(response.headers.get("x-hof-rows") || 0);
      HOF.toast(`Excel dosyası indirildi: ${name}${count ? ` (${number(count)} kayıt)` : ""}.`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    } finally {
      clearTimeout(slow);
      button?.classList.remove("is-busy");
      if (button) button.disabled = false;
    }
  }

  // v2.0.10: "Dışa aktar" tablonun araç çubuğunda, arama kutusunun yanında. Başlık satırındaki özet bloğu (ve paketin
  // oradaki düğmesi) gizlendi; paketin düğmesi yalnız CSV indirmesi için DOM'da durur.
  const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
  // Tablo başlık satırının sağındaki eylem grubunda, Yenile'nin solunda (v2.0.10): arama kutusu tam genişlikte kalır.
  function mountToolbarButton() {
    const heading = document.querySelector(".cases-panel > .panel-heading");
    const existing = document.getElementById("hof-toolbar-export");
    // "Tabloyu dışa aktarma" yetkisi (v2.0.10) kişiden kaldırıldıysa düğme hiç görünmez.
    if (!heading || !HOF.can("records.export")) return existing?.remove();
    // "Yeni Kayıt" (v2.0.15) Dışa Aktar'ın solunda durur; burada sayılırsa iki düğme birbirinin önüne geçmeye çalışır ve
    // sonsuz DOM değişikliği öteki ekran düzeltmelerini (hof-sources gizleme geçişi) aç bırakır.
    const before = heading.querySelector(":scope > button:not(#hof-toolbar-export):not(#hof-toolbar-new)");
    if (existing?.parentNode === heading && (!before || existing.nextElementSibling === before)) return;
    const button = existing || HOF.el("button", { type: "button", id: "hof-toolbar-export", class: "hof-toolbar-export", "data-hof-ui": "", "aria-label": "Dışa aktar", title: "Tabloyu Excel (.xlsx) ya da CSV olarak indir" }, `${DOWNLOAD_ICON}<span>Dışa Aktar</span>`);
    heading.insertBefore(button, before);
  }
  // v2.0.15 (müşteri): "Yeni Kayıt" sol menüden tablo başlığına taşındı — "Dışa Aktar"ın hemen solunda, birincil düğme.
  // Sabit ad (sektör sözcüğü değil): açık sekme araç, kasa ya da öğrenci listesi olabilir.
  const PLUS_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  function mountNewRecordButton() {
    const heading = document.querySelector(".cases-panel > .panel-heading");
    const existing = document.getElementById("hof-toolbar-new");
    if (!heading || !HOF.can("records.create")) return existing?.remove();
    const before = document.getElementById("hof-toolbar-export")?.parentNode === heading ? document.getElementById("hof-toolbar-export") : heading.querySelector(":scope > button:not(#hof-toolbar-new)");
    if (existing?.parentNode === heading && (!before || existing.nextElementSibling === before)) return;
    const button = existing || HOF.el("button", { type: "button", id: "hof-toolbar-new", class: "hof-toolbar-export hof-toolbar-new", "data-hof-ui": "", "aria-label": "Yeni Kayıt", title: "Açık Sekmeye Yeni Kayıt Ekle" }, `${PLUS_ICON}<span>Yeni Kayıt</span>`);
    if (!existing) button.addEventListener("click", () => HOF.emit("new-record"));
    heading.insertBefore(button, before);
  }
  const mountButtons = () => {
    mountToolbarButton();
    mountNewRecordButton();
  };
  HOF.whenReady(() => {
    mountButtons();
    HOF.onDom(mountButtons);
    HOF.on("user-changed", mountButtons);
  });

  // Paketin düğmesi yakalanır (paket CSV indirmesini ancak menüden "CSV" seçilince yapar).
  document.addEventListener(
    "click",
    event => {
      if (bypass) return;
      const button = event.target.closest(".button-row button, #hof-toolbar-export");
      if (!isExportButton(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!HOF.can("records.export")) return HOF.toast("Tabloyu dışa aktarma yetkiniz yok. Yöneticinizden isteyin.", { type: "error" });
      if (menu && anchor === button) close();
      else open(button);
    },
    true,
  );

  HOF.exportExcel = download;
})();
