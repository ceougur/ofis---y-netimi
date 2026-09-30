/* DestekOfis — Excel/Sheets açılır listeleri (v2.0.2).
 * Excel'de "Veri doğrulama → Liste", Google Sheets'te "Açılır liste" olan kolonlar programda da açılır listedir:
 *  - Detay kartında değer, yanında ▾ olan bir pil olarak görünür; tıklayınca liste açılır, seçilen değer kaydedilir
 *    (Excel'deki gibi). Düzenleme yetkisi olmayan liste seçeneklerini görür, değiştiremez.
 *  - Hücre düzenleme, "Bilgileri düzenle" ve "Yeni kayıt" formlarında aynı liste (hof-table.js → HOF.choiceField).
 * Listede olmayan eski değer silinmez; "(listede yok)" diye gösterilir. Excel'de listeye bağlı olmayan (uyarı/bilgi
 * türü) listelerde "Başka bir değer yaz…" da vardır. Listeler sunucudan gelir (HOF.data.choices, choices.mjs). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const SEP = " › ";

  const activeTab = () => (HOF.activeTab && HOF.activeTab()) || "";
  const rowFor = key => {
    const rows = HOF.data?.rows || [];
    const tab = activeTab();
    return rows.find(item => item.__hofKey === key && (!tab || item.__sheet === tab)) || rows.find(item => item.__hofKey === key) || null;
  };

  /** Kolonun açılır listesi: { options, strict } ya da null. tab: kaydın sekmesi (yoksa açık sekme). */
  HOF.choicesFor = (column, tab) => {
    const all = HOF.data?.choices || {};
    const name = tab ?? activeTab();
    if (name) {
      if (all[name]?.[column]) return all[name][column];
      // Alt tablolu sekmede üst sekme açıksa: alt tablolardan birindeki liste (hepsinde aynıysa).
      const inside = Object.keys(all).filter(key => key.startsWith(`${name}${SEP}`) && all[key][column]);
      if (inside.length && inside.every(key => all[key][column].options.join("\u0000") === all[inside[0]][column].options.join("\u0000"))) return all[inside[0]][column];
      return null;
    }
    // Sekmesiz görünüm: kolon hangi sekmede listeliyse (hepsinde aynıysa).
    const found = Object.values(all).map(columns => columns[column]).filter(Boolean);
    return found.length && found.every(item => item.options.join("\u0000") === found[0].options.join("\u0000")) ? found[0] : null;
  };
  HOF.choicesForKey = (key, column) => HOF.choicesFor(column, rowFor(key)?.__sheet ?? activeTab());

  /** Form alanı: kolonun listesi varsa açılır liste, yoksa verilen alan. */
  HOF.choiceField = (field, list) => {
    if (!list || field.readonly) return field;
    const { rows, type, list: ignored, ...rest } = field;
    return { ...rest, type: "choice", options: list.options, strict: list.strict, help: field.help || (list.strict ? "Excel/Sheets'teki açılır listeden seçin." : "Excel/Sheets'teki açılır liste; başka bir değer de yazabilirsiniz.") };
  };

  // ---------- Detay kartı ----------
  let menu = null;
  const closeMenu = () => {
    if (!menu) return;
    menu.anchor?.setAttribute("aria-expanded", "false");
    menu.remove();
    menu = null;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keys, true);
  };
  const outside = event => {
    if (menu && !menu.contains(event.target) && !event.target.closest?.(".hof-choice-pill")) closeMenu();
  };
  const keys = event => {
    if (!menu) return;
    const items = [...menu.querySelectorAll("button[data-value]")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      const back = menu.anchor;
      closeMenu();
      back?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
      next?.focus();
    }
  };

  async function save(key, column, value, label) {
    try {
      await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: key, field: column, value } });
      HOF.toast(`${label}: ${value || "boş"}`, { type: "success" });
      HOF.refreshData();
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function openMenu(pill) {
    const selected = HOF.selectedCase();
    if (!selected) return;
    const column = pill.dataset.column;
    const list = HOF.choicesForKey(selected.key, column);
    if (!list) return;
    const value = pill.dataset.value || "";
    const label = HOF.columnLabel(column);
    const editable = HOF.can("records.edit");
    closeMenu();
    menu = HOF.el("div", { class: "hof-choice-menu", role: "listbox", "aria-label": `${label} listesi` });
    menu.anchor = pill;
    pill.setAttribute("aria-expanded", "true");
    const known = !value || list.options.includes(value);
    menu.innerHTML = `<div class="hof-choice-head">${esc(label)}${editable ? "" : " · yalnızca görüntüleme"}</div>
      <div class="hof-choice-list">${list.options.map(option => `<button type="button" role="option" data-value="${esc(option)}" aria-selected="${option === value}" ${editable ? "" : "disabled"}>${esc(option)}</button>`).join("")}
      ${known ? "" : `<button type="button" role="option" data-value="${esc(value)}" aria-selected="true" disabled class="is-missing">${esc(value)} <small>(listede yok)</small></button>`}</div>
      ${editable ? `<div class="hof-choice-foot">${value ? '<button type="button" data-clear>Temizle</button>' : ""}${list.strict ? "" : '<button type="button" data-other>Başka Bir Değer Yaz…</button>'}</div>` : ""}`;
    document.body.appendChild(menu);
    const box = pill.getBoundingClientRect();
    const height = Math.min(menu.offsetHeight, 320);
    const below = window.innerHeight - box.bottom > height + 12;
    menu.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${below ? box.bottom + 4 : Math.max(8, box.top - height - 4)}px`;
    menu.addEventListener("click", event => {
      const option = event.target.closest("button[data-value]");
      if (option && !option.disabled) {
        const next = option.dataset.value;
        closeMenu();
        if (next !== value) save(selected.key, column, next, label);
        return;
      }
      if (event.target.closest("[data-clear]")) {
        closeMenu();
        save(selected.key, column, "", label);
      } else if (event.target.closest("[data-other]")) {
        closeMenu();
        HOF.formModal({
          title: `${label} düzenle`,
          eyebrow: selected.title,
          size: "small",
          fields: [{ name: "value", label, value, autofocus: true, maxlength: 20000, list: list.options }],
          submitLabel: "Kaydet",
          onSubmit: async data => {
            await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: selected.key, field: column, value: data.value } });
            HOF.toast(`${label} güncellendi.`, { type: "success" });
            HOF.refreshData();
          },
        });
      }
    });
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keys, true);
    (menu.querySelector('button[aria-selected="true"]:not([disabled])') || menu.querySelector("button:not([disabled])"))?.focus();
  }

  // Detay kartındaki listeli alanların değeri ▾'li bir pil olur. React'in hücresine dokunulmaz: değer düğümü gizlenir,
  // yanına pil eklenir; kart yeniden çizilince yeniden eklenir.
  function decorate() {
    const selected = HOF.selectedCase();
    if (!selected || !Object.keys(HOF.data?.choices || {}).length) {
      if (menu && !document.body.contains(menu.anchor)) closeMenu();
      return;
    }
    for (const cell of selected.panel.querySelectorAll(".dynamic-detail-grid > div")) {
      const column = HOF.columnOf(cell.querySelector(".detail-label"));
      const valueNode = cell.querySelector(".detail-value");
      let pill = cell.querySelector(":scope > .hof-choice-pill");
      const list = column && valueNode ? HOF.choicesForKey(selected.key, column) : null;
      if (!list) {
        if (pill) {
          pill.remove();
          cell.classList.remove("hof-has-choice");
        }
        continue;
      }
      const shown = valueNode.textContent.trim();
      const value = shown === "—" ? "" : shown;
      if (!pill) {
        pill = HOF.el("button", { type: "button", class: "hof-choice-pill", "aria-haspopup": "listbox" });
        pill.addEventListener("click", event => {
          event.stopPropagation();
          if (menu?.anchor === pill) closeMenu();
          else openMenu(pill);
        });
        valueNode.after(pill);
        cell.classList.add("hof-has-choice");
      }
      if (pill.dataset.column !== column || pill.dataset.value !== value) {
        pill.dataset.column = column;
        pill.dataset.value = value;
        const missing = value && !list.options.includes(value);
        pill.innerHTML = `<span>${esc(value || "Seçin")}</span><i aria-hidden="true">▾</i>`;
        pill.classList.toggle("is-empty", !value);
        pill.classList.toggle("is-missing", Boolean(missing));
        pill.title = `${HOF.columnLabel(column)} · Excel/Sheets'teki açılır liste (${list.options.length} seçenek)${missing ? " · bu değer listede yok" : ""}`;
        pill.setAttribute("aria-label", `${HOF.columnLabel(column)}: ${value || "boş"}. Açılır listeyi aç`);
      }
    }
  }

  HOF.whenReady(() => {
    HOF.onDom(decorate);
    HOF.on("rows", () => requestAnimationFrame(decorate));
  });
})();
