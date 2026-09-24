/* DestekOfis — sekme içindeki alt tablolar (bölümler).
 * Sunucu, bir sekmedeki alt alta tabloları "Sekme › Bölüm" etiketli ayrı kategoriler olarak verir. Bu betik
 * React'in düz kategori düğmelerini gizleyip yerine gruplanmış bir şerit gösterir: sekme düğmesi ve sekme
 * seçiliyken altında o sekmenin alt tabloları. Tıklamalar React'in kendi (gizli) düğmelerine aktarılır; böylece
 * filtreleme, kolonlar, arama ve sayfalama React'te kalır. Betik çalışmazsa React'in düğmeleri olduğu gibi görünür. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const SEP = " › ";
  const ALL = "Tümü";
  const lastSection = new Map(); // sekme → en son seçilen alt tablo etiketi

  // "GAYRİMENKUL SATIŞ DOSYALARI" → "Gayrimenkul Satış Dosyaları" (yalnızca tamamı büyük harfse).
  const pretty = text => {
    const value = String(text || "").trim();
    if (value !== value.toLocaleUpperCase("tr-TR") || !/\p{L}{3}/u.test(value)) return value;
    return value.toLocaleLowerCase("tr-TR").replace(/(^|[\s(/-])(\p{L})/gu, (match, before, letter) => before + letter.toLocaleUpperCase("tr-TR"));
  };

  const labelOf = button => button.getAttribute("title") || (button.firstChild?.nodeType === 3 ? button.firstChild.textContent : button.textContent.replace(/\s*\d+\s*$/, "")).trim();
  const reactButtons = container => [...container.querySelectorAll(":scope > button.category-tab")];
  const read = container =>
    reactButtons(container).map(button => ({
      label: labelOf(button),
      count: Number(button.querySelector("span")?.textContent?.trim()) || 0,
      active: button.classList.contains("active"),
    }));

  function model(items) {
    const top = [];
    const groups = new Map();
    for (const item of items) {
      const cut = item.label.indexOf(SEP);
      if (cut < 0) {
        top.push({ kind: item.label === ALL ? "all" : "tab", ...item });
        continue;
      }
      const parent = item.label.slice(0, cut);
      let group = groups.get(parent);
      if (!group) {
        group = { kind: "group", label: parent, sections: [], count: 0, active: false };
        groups.set(parent, group);
        top.push(group);
      }
      group.sections.push({ ...item, name: item.label.slice(cut + SEP.length) });
      group.count += item.count;
      group.active ||= item.active;
    }
    // Aynı adlı düz sekme (ör. bölümler tanınmadan önce eklenmiş kayıtlar) grubun içine "Diğer kayıtlar" olarak girer.
    return top.filter(item => {
      if (item.kind !== "tab" || !groups.has(item.label)) return true;
      const group = groups.get(item.label);
      group.sections.push({ ...item, name: "Diğer kayıtlar" });
      group.count += item.count;
      group.active ||= item.active;
      return false;
    });
  }

  const liveContainer = () => document.querySelector(".category-bar > .category-tabs:not(.hof-category-tabs)");

  function select(label) {
    const container = liveContainer();
    const target = container && reactButtons(container).find(button => labelOf(button) === label);
    if (!target) return;
    const cut = label.indexOf(SEP);
    if (cut >= 0) lastSection.set(label.slice(0, cut), label);
    target.click();
  }

  // Sekme (grup) düğmesi: o sekmede en son bakılan alt tabloyu, yoksa ilkini açar.
  function selectGroup(name) {
    const container = liveContainer();
    const group = container && model(read(container)).find(item => item.kind === "group" && item.label === name);
    if (!group) return;
    const remembered = lastSection.get(name);
    select(group.sections.some(section => section.label === remembered) ? remembered : group.sections[0].label);
  }

  function render() {
    const bar = document.querySelector(".category-bar");
    const container = liveContainer();
    let strip = bar?.querySelector(":scope > .hof-category-tabs");
    let sub = bar?.querySelector(":scope > .hof-section-tabs");
    const items = container ? read(container) : [];
    if (!bar || !container || !items.some(item => item.label.includes(SEP))) {
      strip?.remove();
      sub?.remove();
      return;
    }
    const top = model(items);
    const activeGroup = top.find(item => item.kind === "group" && item.active);
    const signature = JSON.stringify(top.map(item => [item.kind, item.label, item.count, item.active, item.sections?.map(section => [section.name, section.count, section.active])]));
    const placed = strip && strip.previousElementSibling === container && (activeGroup ? sub && strip.nextElementSibling === sub : !sub);
    if (placed && strip.dataset.signature === signature) return;

    if (!strip) {
      strip = HOF.el("div", { class: "category-tabs hof-category-tabs", "data-hof-ui": "", role: "toolbar", "aria-label": "Sheet sekmeleri" });
      strip.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (button?.dataset.label) select(button.dataset.label);
        else if (button?.dataset.group) selectGroup(button.dataset.group);
      });
    }
    strip.dataset.signature = signature;
    strip.innerHTML = top
      .map(item =>
        item.kind === "group"
          ? `<button type="button" class="category-tab hof-group-tab${item.active ? " active" : ""}" data-group="${esc(item.label)}" title="${esc(item.label)} — ${item.sections.length} alt tablo" aria-expanded="${item.active}">${esc(item.label)} <span>${item.count}</span><i aria-hidden="true">${item.active ? "▾" : "▸"}</i></button>`
          : `<button type="button" class="category-tab${item.active ? " active" : ""}" data-label="${esc(item.label)}" ${item.kind === "tab" ? `title="${esc(item.label)}"` : ""} aria-pressed="${item.active}">${esc(item.label)} <span>${item.count}</span></button>`,
      )
      .join("");
    if (strip.previousElementSibling !== container) container.after(strip);

    if (!activeGroup) {
      sub?.remove();
      return;
    }
    if (!sub) {
      sub = HOF.el("div", { class: "hof-section-tabs", "data-hof-ui": "", role: "toolbar" });
      sub.addEventListener("click", event => {
        const button = event.target.closest("button[data-label]");
        if (button) select(button.dataset.label);
      });
    }
    sub.setAttribute("aria-label", `${activeGroup.label} alt tabloları`);
    sub.innerHTML = `<span class="hof-section-label">Alt tablolar</span>${activeGroup.sections
      .map(section => `<button type="button" class="hof-section-tab${section.active ? " active" : ""}" data-label="${esc(section.label)}" title="${esc(section.name)}" aria-pressed="${section.active}">${esc(pretty(section.name))} <span>${section.count}</span></button>`)
      .join("")}`;
    if (strip.nextElementSibling !== sub) strip.after(sub);
  }

  HOF.whenReady(() => HOF.onDom(render));
  HOF.sections = { pretty, render, SEP };
})();
