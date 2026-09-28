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
  const MIN = 72;
  const MAX = 360;
  const FIRST_MIN = 110;
  const SAMPLE = 250; // genişlik için bakılan en çok satır
  // Kullanıcının elle verdiği genişlikler (v2.0.4): başlığın sağ kenarından sürüklenir, bu bilgisayarda hatırlanır
  // (tablo başlıkları aynı kaldıkça). Tutamaca çift tıklayınca kolon içeriğe göre otomatik genişliğe döner.
  const STORE_KEY = "hof.colw";
  const USER_MIN = 44;
  const USER_MAX = 720;
  const readStore = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  const writeStore = value => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(value));
    } catch {
      // gizli pencere ya da dolu depolama: genişlik yalnızca bu oturumda kalır
    }
  };
  const layoutKey = heads => heads.map(th => th.textContent.trim()).join("|");
  const savedWidths = heads => readStore()[layoutKey(heads)] || {};
  const saveWidth = (heads, column, width) => {
    const all = readStore();
    const key = layoutKey(heads);
    const entry = { ...(all[key] || {}) };
    if (width === null) delete entry[column];
    else entry[column] = width;
    if (Object.keys(entry).length) all[key] = entry;
    else delete all[key];
    writeStore(all);
  };
  const applyTableWidth = table => {
    const heads = [...(table.tHead?.rows[0]?.cells || [])];
    table.style.width = `${heads.reduce((sum, th) => sum + (parseFloat(th.style.width) || th.offsetWidth), 0)}px`;
  };

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
    const saved = savedWidths(heads);
    heads.forEach((th, c) => {
      const own = saved[th.textContent.trim()];
      const value = `${own ? Math.min(USER_MAX, Math.max(USER_MIN, own)) : widths[c]}px`;
      if (th.style.width !== value) th.style.width = value;
      th.classList.toggle("hof-col-user", Boolean(own));
    });
    applyTableWidth(table);
    table.classList.add("hof-sized");
  }
  // Tutamaçlar her güncellemede yerine konur: arayüz başlık satırını yeniden çizince (sıralama, veri yenileme)
  // içindeki tutamaç silinir; genişlik hesabı ise başlıklar değişmedikçe yinelenmez.
  function ensureGrips(table) {
    for (const th of table.tHead?.rows[0]?.cells || []) {
      if (!th.querySelector(":scope > .hof-col-grip")) th.appendChild(HOF.el("span", { class: "hof-col-grip", title: "Sürükleyerek daraltın/genişletin · çift tık: otomatik", "aria-hidden": "true" }));
    }
  }

  // ---------- Kolon genişliğini sürükleme ----------
  let grip = null;
  document.addEventListener("pointerdown", event => {
    const handle = event.target.closest?.(".hof-col-grip");
    if (!handle || event.button !== 0) return;
    const th = handle.closest("th");
    const table = th?.closest("table");
    if (!table) return;
    grip = { th, table, x: event.clientX, width: th.getBoundingClientRect().width, id: event.pointerId, moved: false };
    handle.setPointerCapture?.(event.pointerId);
    table.classList.add("hof-col-dragging");
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener("pointermove", event => {
    if (!grip || event.pointerId !== grip.id) return;
    const width = Math.round(Math.min(USER_MAX, Math.max(USER_MIN, grip.width + event.clientX - grip.x)));
    if (Math.abs(event.clientX - grip.x) > 2) grip.moved = true;
    grip.th.style.width = `${width}px`;
    applyTableWidth(grip.table);
  });
  const endDrag = event => {
    if (!grip || (event.pointerId !== undefined && event.pointerId !== grip.id)) return;
    const { th, table, moved } = grip;
    grip = null;
    table.classList.remove("hof-col-dragging");
    if (!moved) return;
    const heads = [...table.tHead.rows[0].cells];
    saveWidth(heads, th.textContent.trim(), parseFloat(th.style.width));
    th.classList.add("hof-col-user");
    requestAnimationFrame(update);
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  document.addEventListener("dblclick", event => {
    const handle = event.target.closest?.(".hof-col-grip");
    if (!handle) return;
    const th = handle.closest("th");
    const table = th.closest("table");
    saveWidth([...table.tHead.rows[0].cells], th.textContent.trim(), null);
    th.classList.remove("hof-col-user");
    sizedFor = "";
    update();
    event.preventDefault();
  });
  // Tutamaca tıklamak başlığın kendi tıklama işini (sıralama, kalem) tetiklemesin.
  for (const type of ["click", "mousedown", "mouseup"]) {
    document.addEventListener(type, event => {
      if (event.target.closest?.(".hof-col-grip")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
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
    ensureGrips(table);
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
