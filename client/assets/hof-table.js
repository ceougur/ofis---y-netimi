/* DestekOfis — tablo araçları: hücre düzeltme, satır silme (geri alınabilir), yeni kayıt ve sayfalama.
 * Düzenleme düğmeleri React'in yönettiği hücrelere eklenmez; tek bir yüzen katmanda gösterilir.
 * Değişiklikler sunucuya yazılır, ardından birleşik tablo yeniden çekilir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const PAGE_SIZE = 20;
  const PAGE_WINDOW = 6;
  let page = 1;
  let pageContext = "";

  // ---------- Yüzen düğmeler ----------
  let pencil;
  let remover;
  let hoverCell = null;
  let hoverRow = null;
  let hideTimer = 0;

  const ensureFloats = () => {
    if (pencil) return;
    pencil = HOF.el("button", { type: "button", class: "hof-float", title: "Bu bilgiyi düzenle", "aria-label": "Bu bilgiyi düzenle", text: "✎" });
    remover = HOF.el("button", { type: "button", class: "hof-float hof-float-delete", title: "Kaydı sil", "aria-label": "Kaydı sil", text: "×" });
    document.body.append(pencil, remover);
    pencil.addEventListener("click", event => {
      event.stopPropagation();
      if (hoverCell) editCell(hoverCell);
      hide();
    });
    remover.addEventListener("click", event => {
      event.stopPropagation();
      if (hoverRow) deleteRow(hoverRow);
      hide();
    });
    for (const button of [pencil, remover]) {
      button.addEventListener("mouseenter", () => clearTimeout(hideTimer));
      button.addEventListener("mouseleave", scheduleHide);
    }
  };
  const hide = () => {
    pencil?.classList.remove("is-visible");
    remover?.classList.remove("is-visible");
    hoverCell = null;
    hoverRow = null;
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 180);
  };
  const CELL_SELECTOR = ".dynamic-table tbody td, .dynamic-detail-grid > div";
  const place = (button, x, y) => {
    button.style.left = `${Math.round(x)}px`;
    button.style.top = `${Math.round(y)}px`;
    button.classList.add("is-visible");
  };
  const visibleRect = element => {
    if (!element || !element.isConnected) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) return null;
    return rect;
  };
  // Düğmeleri güncel konuma taşır; hücre kaybolduysa (React yeniden çizdiyse) gizler.
  // Yatay kaydırılmış tabloda düğmeler görünür alanın içinde kalır.
  const clipRect = element => element?.closest(".dynamic-table-wrap, .detail-panel")?.getBoundingClientRect() || null;
  const position = () => {
    const cellRect = HOF.can("records.edit") ? visibleRect(hoverCell) : null;
    const cellClip = cellRect && clipRect(hoverCell);
    const right = cellRect ? Math.min(cellRect.right, cellClip ? cellClip.right : cellRect.right) : 0;
    if (cellRect && right - 30 >= (cellClip ? cellClip.left : cellRect.left)) place(pencil, right - 30, cellRect.top + Math.max(2, (cellRect.height - 26) / 2));
    else pencil?.classList.remove("is-visible");
    const rowRect = HOF.can("records.delete") ? visibleRect(hoverRow) : null;
    const rowClip = rowRect && clipRect(hoverRow);
    if (rowRect) place(remover, Math.max(rowRect.left, rowClip ? rowClip.left : rowRect.left) - 13, rowRect.top + Math.max(2, (rowRect.height - 26) / 2));
    else remover?.classList.remove("is-visible");
  };
  const track = target => {
    if (!HOF.user || HOF.hasOpenModal() || !target || !target.closest) return;
    if (target === pencil || target === remover) {
      clearTimeout(hideTimer);
      return;
    }
    const cell = target.closest(CELL_SELECTOR);
    if (!cell) {
      if (hoverCell || hoverRow) scheduleHide();
      return;
    }
    ensureFloats();
    clearTimeout(hideTimer);
    hoverCell = cell;
    hoverRow = cell.closest("tr");
    position();
  };

  let frame = 0;
  let lastTarget = null;
  document.addEventListener(
    "mousemove",
    event => {
      lastTarget = event.target;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        track(lastTarget);
      });
    },
    { passive: true },
  );
  document.addEventListener("mouseover", event => track(event.target));
  document.addEventListener("mouseleave", scheduleHide);
  const reposition = () => {
    if (hoverCell || hoverRow) requestAnimationFrame(position);
  };
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  // ---------- Hücre bilgisi ----------
  const describeCell = cell => {
    const row = cell.closest("tr");
    if (row) {
      const label = HOF.tableHeaders(cell.closest("table"))[cell.cellIndex] || `Kolon ${cell.cellIndex + 1}`;
      const raw = cell.getAttribute("title");
      return { key: HOF.rowKey(row), field: label, value: raw != null ? raw : cell.textContent.trim(), title: row.querySelector("strong")?.textContent?.trim() || HOF.rowKey(row) };
    }
    const selected = HOF.selectedCase();
    const label = cell.querySelector(".detail-label")?.textContent?.trim() || "Bilgi";
    const shown = cell.querySelector(".detail-value")?.textContent?.trim() ?? "";
    return { key: selected?.key || "", field: label, value: shown === "—" ? "" : shown, title: selected?.title || "" };
  };

  async function editCell(cell) {
    const info = describeCell(cell);
    if (!info.key) return HOF.toast("Bu satırın dosya kimliği bulunamadı.", { type: "error" });
    let current = null;
    try {
      const overrides = await HOF.api(`/api/workspace/overrides?sourceName=${encodeURIComponent(HOF.sourceName())}&caseKey=${encodeURIComponent(info.key)}`);
      current = overrides.find(item => item.field === info.field) || null;
    } catch {
      current = null;
    }
    HOF.formModal({
      title: `${info.field} düzenle`,
      eyebrow: info.title || info.key,
      intro: "Bu değişiklik kaynak Excel/Sheets dosyasını bozmaz; ofisin ortak çalışma alanında saklanır ve kimin yaptığı kaydedilir.",
      fields: [{ name: "value", label: info.field, type: "textarea", value: current ? current.value : info.value, rows: 4, maxlength: 20000 }],
      extraHtml: current ? `<p class="hof-edit-meta">Son düzenleyen: ${esc(current.actorName || "—")} · ${esc(HOF.formatDateTime(current.updatedAt))}</p>` : "",
      submitLabel: "Değişikliği kaydet",
      onSubmit: async data => {
        try {
          await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: info.key, field: info.field, value: data.value, expectedVersion: current ? current.version : 0 } });
        } catch (error) {
          if (error.status === 409) throw new Error(`Bu alanı az önce başka biri değiştirdi (yeni değer: "${error.data.currentValue ?? ""}"). Pencereyi kapatıp tekrar deneyin.`);
          throw error;
        }
        HOF.toast(`${info.field} güncellendi.`, { type: "success" });
        HOF.refreshData();
      },
    });
  }

  // Detay panelindeki tüm alanları tek pencerede düzenleme (klavyeyle de erişilebilir).
  async function editCase() {
    const selected = HOF.selectedCase();
    if (!selected) return HOF.toast("Önce tablodan bir dosya seçin.", { type: "error" });
    const cells = [...selected.panel.querySelectorAll(".dynamic-detail-grid > div")];
    const fields = cells.map((cell, index) => {
      const label = cell.querySelector(".detail-label")?.textContent?.trim() || `Alan ${index + 1}`;
      const shown = cell.querySelector(".detail-value")?.textContent?.trim() ?? "";
      return { name: `f${index}`, label, value: shown === "—" ? "" : shown, original: shown === "—" ? "" : shown };
    });
    if (!fields.length) return;
    HOF.formModal({
      title: "Dosya bilgilerini düzenle",
      eyebrow: selected.title,
      size: "wide",
      intro: "Yalnızca değiştirdiğiniz alanlar kaydedilir. Kaynak dosya değişmez.",
      fields: fields.map(({ original, ...field }) => ({ ...field, maxlength: 20000 })),
      submitLabel: "Değişiklikleri kaydet",
      onSubmit: async data => {
        const changed = fields.filter(field => (data[field.name] ?? "") !== field.original);
        if (!changed.length) return;
        for (const field of changed) {
          await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: selected.key, field: field.label, value: data[field.name] } });
        }
        HOF.toast(`${changed.length} alan güncellendi.`, { type: "success" });
        HOF.refreshData();
      },
    });
  }

  async function deleteRow(row) {
    const key = HOF.rowKey(row);
    if (!key) return HOF.toast("Bu satırın dosya kimliği bulunamadı.", { type: "error" });
    const name = row.querySelector("strong")?.textContent?.trim() || key;
    const ok = await HOF.confirm({ title: "Kaydı sil", message: `"${name}" kaydı tüm bilgisayarlarda tablodan kaldırılacak. Kaynak dosya değişmez ve işlem geri alınabilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    const sourceName = HOF.sourceName();
    try {
      await HOF.api("/api/workspace/deleted", { method: "POST", body: { sourceName, caseKey: key } });
      HOF.refreshData();
      HOF.toast("Kayıt silindi.", {
        type: "success",
        action: {
          label: "Geri al",
          onClick: async () => {
            try {
              await HOF.api("/api/workspace/deleted/restore", { method: "POST", body: { sourceName, caseKey: key } });
              HOF.toast("Kayıt geri alındı.", { type: "success" });
              HOF.refreshData();
            } catch (error) {
              HOF.toastError(error);
            }
          },
        },
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Yeni kayıt ----------
  async function newRecord() {
    if (!HOF.can("records.create")) return HOF.toast("Kayıt ekleme yetkiniz yok.", { type: "error" });
    let columns = [];
    try {
      columns = (await HOF.api("/api/workspace/sources/columns")).columns;
    } catch (error) {
      return HOF.toastError(error);
    }
    if (!columns.length) {
      return HOF.modal({
        title: "Önce bir veri kaynağı gerekli",
        eyebrow: "YENİ KAYIT",
        size: "small",
        body: `<p class="hof-modal-text">Yeni kayıt formu, ofisin tablosundaki kolonlara göre oluşturulur. ${HOF.can("sources.manage") ? "Sol menüdeki <b>Tabloyu değiştir</b> bölümünden Excel yükleyin veya Google Sheets bağlayın." : "Yöneticinizden veya avukattan veri kaynağı eklemesini isteyin."}</p>`,
      });
    }
    const modal = HOF.formModal({
      title: "Yeni kayıt oluştur",
      eyebrow: "YENİ DOSYA",
      size: "wide",
      intro: `Form, tablonuzun <b>${columns.length}</b> kolonuna göre oluşturuldu. Yalnızca doldurduğunuz alanlar kaydedilir; kayıt tüm bilgisayarlarda görünür.`,
      fields: columns.map((column, index) => ({ name: `c${index}`, label: column, autofocus: index === 0, maxlength: 20000 })),
      submitLabel: "Kaydı oluştur",
      onSubmit: async data => {
        const values = {};
        columns.forEach((column, index) => {
          const value = String(data[`c${index}`] || "").trim();
          if (value) values[column] = value;
        });
        if (!Object.keys(values).length) throw new Error("En az bir alan doldurun.");
        await HOF.api("/api/workspace/records", { method: "POST", body: { sourceName: HOF.sourceName(), values } });
        HOF.toast("Yeni kayıt oluşturuldu.", { type: "success" });
        page = 1;
        HOF.refreshData();
      },
    });
    modal.dialog.querySelector(".hof-form")?.classList.add("hof-record-grid");
  }
  HOF.on("new-record", newRecord);

  // ---------- Sayfalama ----------
  // En fazla 6 sayfa numarası (bulunulan sayfanın çevresi), ayrıca ilk ve son sayfa: 1 2 3 4 5 6 … 79 ›
  const pageList = (current, total) => {
    if (total <= PAGE_WINDOW + 1) return Array.from({ length: total }, (_, index) => index + 1);
    const start = Math.max(1, Math.min(current - 2, total - PAGE_WINDOW + 1));
    const pages = new Set([1, total]);
    for (let item = start; item < start + PAGE_WINDOW; item += 1) pages.add(item);
    return [...pages].sort((a, b) => a - b);
  };
  // Sekme, alt tablo veya arama değişince ilk sayfaya dönülür.
  const currentContext = () => {
    const tab = document.querySelector(".category-bar > .category-tabs:not(.hof-category-tabs) .category-tab.active");
    const search = document.querySelector(".search-field input");
    return `${tab ? tab.getAttribute("title") || tab.textContent.replace(/\s*\d+\s*$/, "") : ""}|${search ? search.value : ""}`;
  };

  function paginate() {
    const table = document.querySelector(".dynamic-table");
    const wrap = table?.closest(".dynamic-table-wrap");
    let pager = document.getElementById("hof-pager");
    if (!table || !wrap) {
      pager?.remove();
      return;
    }
    const rows = [...(table.tBodies[0]?.rows || [])];
    const context = currentContext();
    if (context !== pageContext) {
      pageContext = context;
      page = 1;
    }
    const total = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > total) page = total;
    const start = (page - 1) * PAGE_SIZE;
    rows.forEach((row, index) => {
      const display = index >= start && index < start + PAGE_SIZE ? "" : "none";
      if (row.style.display !== display) row.style.display = display;
    });
    if (rows.length <= PAGE_SIZE) {
      pager?.remove();
      return;
    }
    if (!pager) {
      pager = HOF.el("nav", { id: "hof-pager", class: "hof-pager", "aria-label": "Tablo sayfaları" });
      pager.addEventListener("click", event => {
        const target = event.target.closest("button[data-page]");
        if (!target || target.disabled) return;
        page = Number(target.dataset.page);
        paginate();
        table.closest(".dynamic-table-wrap")?.scrollTo?.({ top: 0 });
      });
    }
    if (wrap.nextSibling !== pager) wrap.after(pager);
    const signature = `${page}/${total}/${rows.length}`;
    if (pager.dataset.signature === signature) return;
    pager.dataset.signature = signature;
    let previous = 0;
    const buttons = pageList(page, total).map(item => {
      const gap = item - previous > 1 ? '<span class="hof-pager-gap">…</span>' : "";
      previous = item;
      return `${gap}<button type="button" data-page="${item}" ${item === page ? 'aria-current="page"' : ""}>${item}</button>`;
    }).join("");
    pager.innerHTML = `<span>${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} / ${rows.length} kayıt</span><div class="hof-pager-buttons"><button type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Önceki sayfa">‹</button>${buttons}<button type="button" data-page="${page + 1}" ${page === total ? "disabled" : ""} aria-label="Sonraki sayfa">›</button></div>`;
  }

  // Arama sonucu gibi gizli sayfadaki bir satıra gitmek için.
  function revealRow(row) {
    const rows = [...(row.parentElement?.rows || [])];
    const index = rows.indexOf(row);
    if (index < 0) return;
    page = Math.floor(index / PAGE_SIZE) + 1;
    paginate();
  }

  // Detay paneline "Düzenle" düğmesi ekler (hof-workspace işlem satırına).
  function installCaseEdit() {
    const row = document.querySelector(".hof-case-actions");
    if (!row || row.querySelector('[data-case-action="edit"]') || !HOF.can("records.edit")) return;
    const button = HOF.el("button", { type: "button", "data-case-action": "edit", text: "Düzenle" });
    button.addEventListener("click", editCase);
    row.appendChild(button);
  }

  HOF.whenReady(() => {
    HOF.onDom(() => {
      paginate();
      installCaseEdit();
    });
  });
  HOF.table = { revealRow, newRecord, editCase, paginate };
})();
