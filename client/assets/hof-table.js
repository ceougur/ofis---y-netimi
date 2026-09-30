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
    pencil = HOF.el("button", { type: "button", class: "hof-float", title: "Değeri Düzenle", "aria-label": "Değeri düzenle", text: "✎" });
    remover = HOF.el("button", { type: "button", class: "hof-float hof-float-delete", title: "Kaydı Sil", "aria-label": "Kaydı sil", text: "×" });
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
    const label = HOF.columnOf(cell.querySelector(".detail-label")) || "Bilgi";
    const shown = cell.querySelector(".detail-value")?.textContent?.trim() ?? "";
    return { key: selected?.key || "", field: label, value: shown === "—" ? "" : shown, title: selected?.title || "" };
  };

  // ---------- Formüller (v2.0.1) ----------
  // Sunucu her satırla, Excel/Sheets'ten gelen formüllerin özetini gönderir (__hofFx: alan → {d: formül, s: durum}).
  const FORMULA_STATE = {
    calc: "Programda girilen değerlerle yeniden hesaplandı.",
    source: "Excel/Sheets'te hesaplanan değer; bağlı alanlar değişince program yeniden hesaplar.",
    manual: "Elle değiştirildi; bu kayıtta formül yerine yazılan değer kullanılıyor.",
    unsupported: "Bu formül programda hesaplanamıyor; Excel/Sheets'teki son değer gösteriliyor.",
    stale: "Formül hesaplanamadı; son değer gösteriliyor.",
  };
  const formulaMap = row => {
    if (!row?.__hofFx) return null;
    try {
      return JSON.parse(row.__hofFx);
    } catch {
      return null;
    }
  };
  const rowFor = key => {
    const rows = HOF.data?.rows || [];
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    return rows.find(item => item.__hofKey === key && (!tab || item.__sheet === tab)) || rows.find(item => item.__hofKey === key) || null;
  };
  const formulaOf = (key, field) => formulaMap(rowFor(key))?.[field] || null;
  const computed = formula => Boolean(formula) && formula.s !== "manual";
  const formulaHelp = formula => `Formül: ${formula.d} · ${FORMULA_STATE[formula.s] || ""}`;
  const tabFormulas = tab => {
    const out = {};
    for (const row of HOF.data?.rows || []) {
      if (tab && row.__sheet !== tab) continue;
      const map = formulaMap(row);
      if (!map) continue;
      for (const [field, info] of Object.entries(map)) if (!out[field] && info.s !== "unsupported") out[field] = info;
    }
    return out;
  };
  HOF.formulaOf = formulaOf;

  // Detay kartında formüllü alanların köşesine "ƒ" işareti (üzerine gelince formül ve durumu).
  // Sayfa her değiştiğinde çalıştığından seçili kaydın formülleri, veri ve seçim değişene kadar önbellekte tutulur
  // (büyük tablolarda tüm satırları her seferinde taramamak için).
  let fxCache = { at: -1, key: "", tab: "", map: {} };
  function decorateFormulas() {
    const selected = HOF.selectedCase();
    if (!selected) return;
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    if (fxCache.at !== HOF.data?.at || fxCache.key !== selected.key || fxCache.tab !== tab) {
      fxCache = { at: HOF.data?.at, key: selected.key, tab, map: formulaMap(rowFor(selected.key)) || {} };
    }
    const map = fxCache.map;
    for (const cell of selected.panel.querySelectorAll(".dynamic-detail-grid > div")) {
      const label = HOF.columnOf(cell.querySelector(".detail-label"));
      const formula = map[label];
      let badge = cell.querySelector(":scope > .hof-fx");
      if (!formula) {
        badge?.remove();
        continue;
      }
      const title = formulaHelp(formula);
      if (!badge) {
        badge = HOF.el("span", { class: "hof-fx", "data-hof-ui": "", "aria-label": title, text: "ƒ" });
        cell.classList.add("hof-has-fx");
        cell.appendChild(badge);
      }
      if (badge.title !== title) badge.title = title;
      badge.dataset.state = formula.s;
    }
  }

  async function editCell(cell) {
    const info = describeCell(cell);
    if (!info.key) return HOF.toast("Bu satırın kimliği bulunamadı.", { type: "error" });
    let current = null;
    try {
      const overrides = await HOF.api(`/api/workspace/overrides?sourceName=${encodeURIComponent(HOF.sourceName())}&caseKey=${encodeURIComponent(info.key)}`);
      current = overrides.find(item => item.field === info.field) || null;
    } catch {
      current = null;
    }
    const formula = formulaOf(info.key, info.field);
    const shownName = HOF.columnLabel(info.field);
    // Excel/Sheets'te açılır listesi olan kolon: aynı liste (v2.0.2, hof-choices.js). Formüllü alan liste olmaz.
    const base = { name: "value", label: shownName, type: "textarea", value: current ? current.value : info.value, rows: 4, maxlength: 20000 };
    const field = HOF.choiceField && !computed(formula) ? HOF.choiceField(base, HOF.choicesForKey(info.key, info.field)) : base;
    HOF.formModal({
      title: `${shownName} Düzenle`,
      eyebrow: info.title || info.key,
      intro: computed(formula)
        ? `<b>Bu alan formülle hesaplanıyor</b> (${esc(formula.d)}). Normalde değiştirmeniz gerekmez: formüldeki alanları düzeltin, bu alan kendiliğinden güncellenir. Buraya değer yazarsanız bu kayıtta formül yerine sizin değeriniz kullanılır.`
        : "Bu değişiklik kaynak Excel/Sheets dosyasını bozmaz; ofisin ortak çalışma alanında saklanır ve kimin yaptığı kaydedilir.",
      fields: [field],
      extraHtml: current ? `<p class="hof-edit-meta">Son düzenleyen: ${esc(current.actorName || "—")} · ${esc(HOF.formatDateTime(current.updatedAt))}</p>` : "",
      submitLabel: "Değişikliği Kaydet",
      onSubmit: async data => {
        const body = { sourceName: HOF.sourceName(), caseKey: info.key, field: info.field, value: data.value, expectedVersion: current ? current.version : 0, previous: current ? current.value : info.value };
        try {
          await HOF.api("/api/workspace/overrides", { method: "POST", body });
        } catch (error) {
          if (error.status !== 409) throw error;
          // Çakışma (v2.0.2): başkası bu alanı az önce değiştirdi. Kullanıcı güncel değeri görür; üzerine yazmayı seçebilir.
          const currentValue = error.data?.currentValue ?? "";
          const who = error.data?.by ? ` (${error.data.by})` : "";
          const overwrite = await HOF.confirm({
            title: "Bu alan siz bakarken değişti",
            message: `Başka bir kullanıcı${who} bu alanı "${currentValue}" yaptı. Sizin yazdığınız: "${data.value}". Üzerine yazmak istiyor musunuz?`,
            confirmLabel: "Üzerine Yaz",
            cancelLabel: "Vazgeç, güncel değeri göster",
          });
          if (!overwrite) {
            HOF.refreshData();
            return;
          }
          await HOF.api("/api/workspace/overrides", { method: "POST", body: { ...body, expectedVersion: undefined, force: true } });
        }
        HOF.toast(`${shownName} güncellendi.`, { type: "success" });
        HOF.refreshData();
      },
    });
  }

  // Detay panelindeki tüm alanları tek pencerede düzenleme (klavyeyle de erişilebilir).
  async function editCase() {
    const selected = HOF.selectedCase();
    if (!selected) return HOF.toast(`Önce tablodan bir ${HOF.vocab.record} seçin.`, { type: "error" });
    const cells = [...selected.panel.querySelectorAll(".dynamic-detail-grid > div")];
    const fields = cells.map((cell, index) => {
      const column = HOF.columnOf(cell.querySelector(".detail-label")) || `Alan ${index + 1}`;
      const label = HOF.columnLabel(column);
      const shown = cell.querySelector(".detail-value")?.textContent?.trim() ?? "";
      const formula = formulaOf(selected.key, column);
      // Formülle hesaplanan alan kilitlidir: kaydedince bağlı olduğu alanlardan yeniden hesaplanır.
      const locked = computed(formula) ? { readonly: true, badge: "ƒ formül", help: `${formula.d} · kaydedince kendiliğinden hesaplanır` } : {};
      const field = { name: `f${index}`, label, column, value: shown === "—" ? "" : shown, original: shown === "—" ? "" : shown, ...locked };
      return HOF.choiceField ? HOF.choiceField(field, HOF.choicesForKey(selected.key, column)) : field;
    });
    if (!fields.length) return;
    HOF.formModal({
      title: `${HOF.vocab.Record} Bilgilerini Düzenle`,
      eyebrow: selected.title,
      size: "wide",
      intro: fields.some(field => field.readonly) ? "Yalnızca değiştirdiğiniz alanlar kaydedilir. Kaynak dosya değişmez. <b>ƒ formül</b> işaretli alanlar Excel/Sheets'teki formülle kendiliğinden hesaplanır." : "Yalnızca değiştirdiğiniz alanlar kaydedilir. Kaynak dosya değişmez.",
      fields: fields.map(({ original, column, ...field }) => ({ ...field, maxlength: 20000 })),
      submitLabel: "Değişiklikleri Kaydet",
      onSubmit: async data => {
        const changed = fields.filter(field => !field.readonly && (data[field.name] ?? "") !== field.original);
        if (!changed.length) return;
        for (const field of changed) {
          await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: selected.key, field: field.column, value: data[field.name] } });
        }
        HOF.toast(`${changed.length} alan güncellendi.`, { type: "success" });
        HOF.refreshData();
      },
    });
  }

  async function deleteRow(row) {
    const key = HOF.rowKey(row);
    if (!key) return HOF.toast("Bu satırın kimliği bulunamadı.", { type: "error" });
    const name = row.querySelector("strong")?.textContent?.trim() || key;
    const ok = await HOF.confirm({ title: "Kaydı Sil", message: `"${name}" kaydı tüm bilgisayarlarda tablodan kaldırılacak. Kaynak dosya değişmez ve işlem geri alınabilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    const sourceName = HOF.sourceName();
    try {
      await HOF.api("/api/workspace/deleted", { method: "POST", body: { sourceName, caseKey: key } });
      HOF.refreshData();
      HOF.toast("Kayıt silindi.", {
        type: "success",
        action: {
          label: "Geri Al",
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
  // v1.7.0: form açık sekmenin kolonlarıyla oluşturulur ve kayıt o sekmeye eklenir (farklı kolonlu sekmelerin
  // kolonları karışmaz). Sekme şeridi yoksa (tek sekme ya da sekmesiz veri) tüm kolonlar.
  async function newRecord() {
    if (!HOF.can("records.create")) return HOF.toast("Kayıt ekleme yetkiniz yok.", { type: "error" });
    const tab = (HOF.activeTab && HOF.activeTab()) || (HOF.data?.tabs?.length === 1 ? HOF.data.tabs[0] : "");
    let columns = [];
    try {
      columns = (await HOF.api(`/api/workspace/sources/columns${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`)).columns;
    } catch (error) {
      return HOF.toastError(error);
    }
    if (!columns.length) {
      return HOF.modal({
        title: "Önce bir veri kaynağı gerekli",
        eyebrow: "YENİ KAYIT",
        size: "small",
        body: `<p class="hof-modal-text">Yeni kayıt formu, ofisin tablosundaki kolonlara göre oluşturulur. ${HOF.can("sources.manage") ? "Sol menüdeki <b>Ayarlar</b> bölümünden Excel yükleyin veya Google Sheets bağlayın." : "Yöneticinizden veri yüklemesini isteyin."}</p>`,
      });
    }
    const modal = HOF.formModal({
      title: "Yeni Kayıt Oluştur",
      eyebrow: `YENİ KAYIT${tab ? ` · ${tab.toLocaleUpperCase("tr-TR")}` : ""}`,
      size: "wide",
      intro: tab ? `Kayıt <b>${esc(tab)}</b> sekmesine eklenir; form bu sekmenin <b>${columns.length}</b> kolonuna göre oluşturuldu. Yalnızca doldurduğunuz alanlar kaydedilir; kayıt tüm bilgisayarlarda görünür.` : `Form, tablonuzun <b>${columns.length}</b> kolonuna göre oluşturuldu. Yalnızca doldurduğunuz alanlar kaydedilir; kayıt tüm bilgisayarlarda görünür.`,
      fields: (() => {
        const formulas = tabFormulas(tab);
        return columns.map((column, index) => {
          const field = {
            name: `c${index}`,
            label: HOF.columnLabel(column),
            autofocus: index === 0,
            maxlength: 20000,
            ...(formulas[column] ? { badge: "ƒ formül", placeholder: "Boş bırakın; kendiliğinden hesaplanır", help: formulas[column].d } : {}),
          };
          return formulas[column] || !HOF.choiceField ? field : HOF.choiceField(field, HOF.choicesFor(column, tab));
        });
      })(),
      submitLabel: "Kaydı Oluştur",
      // v2.0.7: kişi bir kez girilir — kayıtla birlikte cari kartı da açılır (ad ve telefon kayıttan). Aynı ad ve
      // telefonlu bağsız cari varsa kayda bağlanır; kayda bağlı cari zaten varsa o kalır.
      extraHtml: HOF.accounts && HOF.can("accounts.manage") && HOF.plans?.personOf ? '<label class="hof-check hof-record-account"><input type="checkbox" name="openAccount" checked><span>Bu kişi için <b>cari kartı</b> da aç (borç, tahsilat, taksit ve çek/senet takibi)</span></label>' : "",
      onSubmit: async data => {
        const values = {};
        columns.forEach((column, index) => {
          const value = String(data[`c${index}`] || "").trim();
          if (value) values[column] = value;
        });
        if (!Object.keys(values).length) throw new Error("En az bir alan doldurun.");
        const person = data.openAccount ? HOF.plans.personOf(values) : "";
        if (data.openAccount && !person) throw new Error("Cari kartı için kişinin adı gerekli: ad kolonunu doldurun ya da \"cari kartı da aç\" kutusunu kaldırın.");
        const created = await HOF.api("/api/workspace/records", { method: "POST", body: { sourceName: HOF.sourceName(), values, sheet: tab } });
        if (person && created?.caseKey) {
          try {
            const account = await HOF.api(`/api/workspace/cases/${encodeURIComponent(created.caseKey)}/account`, { method: "POST", body: { name: person, phone: HOF.plans.phoneOf(values), caseTitle: HOF.plans.recordLabel(values) } });
            HOF.toast(account.outcome === "created" ? `Kayıt oluşturuldu; "${account.name}" için cari kartı açıldı ve kayda bağlandı.` : account.outcome === "linked" ? `Kayıt oluşturuldu; mevcut "${account.name}" carisi bu kayda bağlandı.` : "Kayıt oluşturuldu; kayda bağlı cari zaten vardı.", { type: "success", timeout: 6000 });
          } catch (error) {
            HOF.toast(`Kayıt oluşturuldu ama cari açılamadı: ${error.message} Cari → Yeni cari ile açıp "Tablodaki kayıt" alanından bağlayabilirsiniz.`, { type: "error", timeout: 9000 });
          }
        } else HOF.toast("Yeni kayıt oluşturuldu.", { type: "success" });
        page = 1;
        // Tablo yenilenince yeni kayıt seçilir ve vurgulanır.
        const key = created?.caseKey;
        if (key) {
          let stop = () => {};
          stop = HOF.on("rows", data => {
            if (!data?.rows?.some(row => row.__hofKey === key)) return;
            stop();
            setTimeout(() => HOF.revealRecord?.(key), 120);
          });
          setTimeout(() => stop(), 15_000);
        }
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
    // v2.0.6: paket yalnız açık sayfanın satırlarını çizer (HOF.tableWindow); sayfa sayısı ve numarası oradan gelir.
    // Pencere yoksa (eski paket) tüm satırlar DOM'dadır ve sayfa dışındakiler gizlenir.
    const win = HOF.tableWindow;
    const rows = [...(table.tBodies[0]?.rows || [])];
    let total;
    let count;
    let size = PAGE_SIZE;
    if (win) {
      page = win.page;
      total = win.pages;
      count = win.total;
      size = win.size;
    } else {
      const context = currentContext();
      if (context !== pageContext) {
        pageContext = context;
        page = 1;
      }
      count = rows.length;
      total = Math.max(1, Math.ceil(count / PAGE_SIZE));
      if (page > total) page = total;
      const first = (page - 1) * PAGE_SIZE;
      rows.forEach((row, index) => {
        const display = index >= first && index < first + PAGE_SIZE ? "" : "none";
        if (row.style.display !== display) row.style.display = display;
      });
    }
    const start = (page - 1) * size;
    if (count <= size) {
      pager?.remove();
      return;
    }
    if (!pager) {
      pager = HOF.el("nav", { id: "hof-pager", class: "hof-pager", "aria-label": "Tablo sayfaları" });
      pager.addEventListener("click", event => {
        const target = event.target.closest("button[data-page]");
        if (!target || target.disabled) return;
        const next = Number(target.dataset.page);
        if (HOF.tableWindow) HOF.tableWindow.setPage(next);
        else {
          page = next;
          paginate();
        }
        table.closest(".dynamic-table-wrap")?.scrollTo?.({ top: 0 });
      });
    }
    // Yatay kaydırma çubuğu (hof-grid.js) tablonun hemen altındadır; sayfalama onun altına gelir.
    const anchor = wrap.nextElementSibling?.classList.contains("hof-hscroll") ? wrap.nextElementSibling : wrap;
    if (anchor.nextSibling !== pager) anchor.after(pager);
    const signature = `${page}/${total}/${count}`;
    if (pager.dataset.signature === signature) return;
    pager.dataset.signature = signature;
    let previous = 0;
    const buttons = pageList(page, total).map(item => {
      const gap = item - previous > 1 ? '<span class="hof-pager-gap">…</span>' : "";
      previous = item;
      return `${gap}<button type="button" data-page="${item}" ${item === page ? 'aria-current="page"' : ""}>${item}</button>`;
    }).join("");
    pager.innerHTML = `<span>${start + 1}–${Math.min(start + size, count)} / ${count} kayıt</span><div class="hof-pager-buttons"><button type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Önceki sayfa">‹</button>${buttons}<button type="button" data-page="${page + 1}" ${page === total ? "disabled" : ""} aria-label="Sonraki sayfa">›</button></div>`;
  }

  // Arama sonucu gibi gizli sayfadaki bir satıra gitmek için (pencereli pakette açık sayfadaki satır zaten görünür).
  function revealRow(row) {
    if (HOF.tableWindow) return;
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

  // Dar ekranda (telefon, tablet) detay kartı tablonun altında kalır: satır seçilince karta yumuşakça kaydırılır.
  document.addEventListener("click", event => {
    if (window.innerWidth > 1100 || HOF.quietSelect) return; // serbest sayfa ızgarası kaydı arka planda seçer
    const row = event.target.closest(".dynamic-table tbody tr");
    if (!row || event.target.closest("button, a, input, [data-hof-ui]")) return;
    setTimeout(() => {
      const panel = HOF.detailPanel();
      if (!panel) return;
      const top = panel.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.6 || top < 0) panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, 120);
  });

  HOF.whenReady(() => {
    HOF.onDom(() => {
      paginate();
      installCaseEdit();
      decorateFormulas();
    });
    HOF.on("table-window", () => paginate());
    HOF.on("rows", () => decorateFormulas());
  });
  // Seçili kaydın tek alanını düzenleme penceresi (asıl kolon adıyla); kolon adı penceresindeki kısa yol kullanır (v2.0.6).
  function editField(column) {
    const selected = HOF.selectedCase();
    if (!selected || !column) return;
    const cell = [...selected.panel.querySelectorAll(".dynamic-detail-grid > div")].find(item => HOF.columnOf(item.querySelector(".detail-label")) === column);
    if (cell) editCell(cell);
  }

  HOF.table = { revealRow, newRecord, editCase, editField, paginate };
})();
