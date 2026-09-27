/* DestekOfis — ana tabloda tüm kolonlar ve yatay kaydırma (v2.0.2).
 * Tablo artık Excel/Sheets'teki dolu kolonların hepsini gösterir (önceden ilk 7). Bu modül:
 *  - kolon genişliklerini içeriğe göre ayarlar (başlık ve hücrelerin çoğunu sığdırır, çok uzun metin "…" ile kısalır,
 *    tamamı üzerine gelince görünür);
 *  - ilk kolonu (kaydın adı/numarası) Excel'deki "bölmeleri dondur" gibi solda sabit tutar;
 *  - tablonun altına, ekranın altına yapışan bir yatay kaydırma çubuğu koyar: tablo uzun olsa da çubuk hep
 *    görünür; oklarla bir ekran sağa/sola gidilir; sağda devamı varsa kenar hafifçe solar.
 * Kaydırma: çubuk, Shift + tekerlek, dokunmatik yüzeyde yana kaydırma ya da ok düğmeleri. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const MIN = 96;
  const MAX = 360;
  const FIRST_MIN = 150;
  const SAMPLE = 250; // genişlik için bakılan en çok satır

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const textWidth = (text, font) => {
    context.font = font;
    return context.measureText(text).width;
  };

  let sizedFor = "";
  function size(table) {
    const head = table.tHead?.rows[0];
    const body = table.tBodies[0];
    if (!head || !body) return;
    const heads = [...head.cells];
    const rows = [...body.rows];
    const signature = `${heads.map(th => th.textContent).join("|")}#${rows.length}#${HOF.data?.at || 0}#${Math.round(table.closest(".dynamic-table-wrap")?.clientWidth || 0)}`;
    if (signature === sizedFor && table.classList.contains("hof-sized")) return;
    sizedFor = signature;
    const sample = rows.slice(0, SAMPLE);
    const cellStyle = sample[0]?.cells[0] ? getComputedStyle(sample[0].cells[0]) : null;
    const headStyle = getComputedStyle(heads[0]);
    const cellFont = cellStyle ? `${cellStyle.fontWeight} ${cellStyle.fontSize} ${cellStyle.fontFamily}` : "11px sans-serif";
    const headFont = `${headStyle.fontWeight} ${headStyle.fontSize} ${headStyle.fontFamily}`;
    const headSpacing = parseFloat(headStyle.letterSpacing) || 0;
    const widths = heads.map((th, c) => {
      const label = th.textContent.trim().toLocaleUpperCase("tr-TR");
      const pad = c === 0 ? 50 : 32;
      const headNeed = textWidth(label, headFont) + label.length * headSpacing + pad;
      const values = sample
        .map(row => {
          const cell = row.cells[c];
          if (!cell) return 0;
          const text = (cell.getAttribute("title") ?? cell.textContent ?? "").trim();
          return text ? textWidth(text.length > 80 ? text.slice(0, 80) : text, cell.querySelector("strong") ? cellFont.replace(/^\d+/, "700") : cellFont) : 0;
        })
        .sort((a, b) => a - b);
      // Hücrelerin %90'ı sığsın (tek bir çok uzun değer kolonu şişirmesin).
      const p90 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.9))] : 0;
      return Math.round(Math.min(MAX, Math.max(c === 0 ? FIRST_MIN : MIN, headNeed, p90 + pad)));
    });
    heads.forEach((th, c) => {
      const value = `${widths[c]}px`;
      if (th.style.width !== value) th.style.width = value;
    });
    const total = widths.reduce((sum, value) => sum + value, 0);
    table.style.width = `${total}px`;
    table.classList.add("hof-sized");
  }

  // ---------- Yapışkan yatay kaydırma çubuğu ----------
  // Tarayıcının kendi çubuğu bazı sistemlerde (macOS, dokunmatik) gizlenir; bu çubuk her zaman görünür: tutamaç
  // sürüklenir, yola tıklanınca o yöne bir ekran gidilir, üzerinde tekerlek yana kaydırır, oklar bir ekran kaydırır.
  let rail = null;
  let observed = null;
  let drag = null;
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => update()) : null;
  const currentWrap = () => document.querySelector(".cases-panel > .dynamic-table-wrap") || document.querySelector(".dynamic-table-wrap");
  const maxScroll = wrap => Math.max(0, wrap.scrollWidth - wrap.clientWidth);

  function ensureRail() {
    if (rail) return rail;
    rail = HOF.el(
      "div",
      { class: "hof-hscroll" },
      '<button type="button" class="hof-hscroll-step" data-step="-1" aria-label="Tabloyu sola kaydır" title="Sola kaydır">‹</button><div class="hof-hscroll-track" role="scrollbar" aria-orientation="horizontal" aria-label="Tabloyu yana kaydır" tabindex="0"><span class="hof-hscroll-thumb"></span></div><button type="button" class="hof-hscroll-step" data-step="1" aria-label="Tabloyu sağa kaydır" title="Sağa kaydır">›</button>',
    );
    const track = rail.querySelector(".hof-hscroll-track");
    const thumb = rail.querySelector(".hof-hscroll-thumb");
    const page = direction => {
      const wrap = currentWrap();
      if (wrap) wrap.scrollBy({ left: direction * Math.max(160, wrap.clientWidth * 0.8), behavior: "smooth" });
    };
    rail.addEventListener("click", event => {
      const button = event.target.closest("[data-step]");
      if (button) page(Number(button.dataset.step));
    });
    track.addEventListener("pointerdown", event => {
      const wrap = currentWrap();
      if (!wrap || event.button !== 0) return;
      if (event.target === thumb) {
        drag = { x: event.clientX, left: wrap.scrollLeft, id: event.pointerId };
        thumb.setPointerCapture(event.pointerId);
        rail.classList.add("is-dragging");
        event.preventDefault();
      } else {
        const box = thumb.getBoundingClientRect();
        page(event.clientX < box.left ? -1 : 1);
      }
    });
    thumb.addEventListener("pointermove", event => {
      const wrap = currentWrap();
      if (!drag || !wrap || event.pointerId !== drag.id) return;
      const room = track.clientWidth - thumb.offsetWidth;
      if (room <= 0) return;
      wrap.scrollLeft = drag.left + ((event.clientX - drag.x) / room) * maxScroll(wrap);
    });
    const stop = () => {
      drag = null;
      rail.classList.remove("is-dragging");
    };
    thumb.addEventListener("pointerup", stop);
    thumb.addEventListener("pointercancel", stop);
    rail.addEventListener("wheel", event => {
      const wrap = currentWrap();
      if (!wrap) return;
      event.preventDefault();
      wrap.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    }, { passive: false });
    track.addEventListener("keydown", event => {
      const wrap = currentWrap();
      if (!wrap) return;
      const steps = { ArrowLeft: -80, ArrowRight: 80, PageUp: -wrap.clientWidth * 0.8, PageDown: wrap.clientWidth * 0.8, Home: -Infinity, End: Infinity };
      if (!(event.key in steps)) return;
      event.preventDefault();
      const delta = steps[event.key];
      wrap.scrollLeft = delta === Infinity ? maxScroll(wrap) : delta === -Infinity ? 0 : wrap.scrollLeft + delta;
    });
    return rail;
  }

  function paint(wrap) {
    const max = maxScroll(wrap);
    wrap.classList.toggle("hof-can-left", wrap.scrollLeft > 2);
    wrap.classList.toggle("hof-can-right", wrap.scrollLeft < max - 2);
    if (!rail) return;
    const track = rail.querySelector(".hof-hscroll-track");
    const thumb = rail.querySelector(".hof-hscroll-thumb");
    const width = Math.max(36, Math.round((track.clientWidth * wrap.clientWidth) / Math.max(1, wrap.scrollWidth)));
    const left = max > 0 ? Math.round(((track.clientWidth - width) * wrap.scrollLeft) / max) : 0;
    thumb.style.width = `${width}px`;
    thumb.style.transform = `translateX(${left}px)`;
    track.setAttribute("aria-valuenow", String(max ? Math.round((wrap.scrollLeft / max) * 100) : 0));
    rail.querySelector('[data-step="-1"]').disabled = wrap.scrollLeft <= 2;
    rail.querySelector('[data-step="1"]').disabled = wrap.scrollLeft >= max - 2;
  }
  const onWrapScroll = event => paint(event.currentTarget);

  function update() {
    const wrap = currentWrap();
    const table = wrap?.querySelector(":scope > .dynamic-table");
    if (!wrap || !table || document.body.classList.contains("hof-free-mode")) {
      rail?.remove();
      return;
    }
    size(table);
    if (observed !== wrap) {
      observed?.removeEventListener("scroll", onWrapScroll);
      wrap.addEventListener("scroll", onWrapScroll, { passive: true });
      if (resize) {
        resize.disconnect();
        resize.observe(wrap);
        resize.observe(table);
      }
      observed = wrap;
    }
    const overflow = table.scrollWidth > wrap.clientWidth + 2;
    wrap.classList.toggle("hof-wide", overflow);
    if (!overflow) {
      rail?.remove();
      wrap.classList.remove("hof-can-left", "hof-can-right");
      return;
    }
    const bar = ensureRail();
    if (wrap.nextElementSibling !== bar) wrap.after(bar);
    paint(wrap);
  }

  HOF.whenReady(() => {
    HOF.onDom(update);
    window.addEventListener("resize", () => requestAnimationFrame(update));
  });
  HOF.grid = { update };
})();
