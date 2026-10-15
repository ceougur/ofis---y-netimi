/* DestekOfis — Hızlı Arama (2.3.0 İz 5.5; müşteri talebi 5): sol menünün üstünde "Ara" kutusu + Ctrl+K.
 * Dizin istemcideki tanımlardan türetilir (elle liste yok): Operasyon Merkezi düğmeleri (hof-workspace.js SIDE_ITEMS), modüllerin
 * sekmeleri ve işlemleri (her modül HOF.search.register ile kendi tanımından ekler) ve Rapor Merkezi'nin listesi (sunucudan; yetkiye
 * göre süzülmüş gelir). Eşleşme: her sözcük bir sözcük BAŞINA eşleşir ("alış f" → Alış Faturaları, Yeni Alış Faturası…), Türkçe harf
 * duyarsız (ı/i, İ/I, ş/s, ğ/g, ü/u, ö/o, ç/c). Yalnız yetkisi olan sonuçlar (HOF.can). Gruplu liste: Sayfa / İşlem / Rapor / Ayar.
 * Ok tuşları + Enter açar, Esc kapatır. Cari/kayıt adı araması bu kutuya girmez (tablonun kendi arama kutusu; Ctrl+Shift+F). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = HOF.esc;
  const GROUPS = ["Sayfa", "İşlem", "Rapor", "Ayar"];
  const providers = [];
  let reportCache = { at: 0, promise: null };
  let box = null;
  let input = null;
  let panel = null;
  let results = [];
  let active = -1;
  let lastQuery = "";

  // Türkçe harf duyarsız katlama: "Alış" → "alis", "İŞLEM" → "islem".
  const FOLD = { ı: "i", i: "i", İ: "i", I: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", î: "i", û: "u" };
  const fold = value =>
    String(value ?? "")
      .replace(/[ıiİIşŞğĞüÜöÖçÇâîû]/g, char => FOLD[char] || char)
      .toLowerCase()
      .replace(/[^a-z0-9+%₺/]+/g, " ")
      .trim();
  const words = value => fold(value).split(" ").filter(Boolean);

  /** Bir sorgu sözcüğü metnin herhangi bir sözcüğünün başına uyuyor mu. */
  const hits = (tokens, text) => {
    const list = words(text);
    return tokens.every(token => list.some(word => word.startsWith(token)));
  };

  /** Sağlayıcılardan girdileri toplar; her girdi { group, label, path, keywords, requires, run }. */
  function collect() {
    const items = [];
    for (const provider of providers) {
      try {
        for (const item of provider() || []) {
          if (!item || !item.label || typeof item.run !== "function") continue;
          if (item.requires && !HOF.can(item.requires)) continue;
          items.push({ group: GROUPS.includes(item.group) ? item.group : "Sayfa", label: String(item.label), path: String(item.path || ""), keywords: [].concat(item.keywords || []).map(String), run: item.run });
        }
      } catch {
        // bir sağlayıcı hata verirse öbürleri listelenir
      }
    }
    return items;
  }

  /** Rapor Merkezi listesi (yetkiye göre sunucudan süzülmüş); 60 sn önbellek. Yetkisi olmayanda istek atılmaz. */
  function reports() {
    if (!HOF.can("overview.view") && !HOF.can("bank.reports")) return Promise.resolve([]);
    if (reportCache.promise && Date.now() - reportCache.at < 60_000) return reportCache.promise;
    reportCache = {
      at: Date.now(),
      promise: HOF.api("/api/workspace/report-center", { background: true })
        // Açıklama dizine GİRMEZ (her açıklamada "cari", "hareket" geçer; "cari h" bütün raporları listelerdi) — yalnız ad ve grup.
        .then(catalog => (catalog.reports || []).map(report => ({ group: "Rapor", label: report.title, path: report.group, keywords: [`${report.group} Raporu`], run: () => HOF.reportCenter?.open(report.id) })))
        .catch(() => {
          reportCache.at = 0;
          return [];
        }),
    };
    return reportCache.promise;
  }

  function score(item, tokens) {
    let total = 0;
    const labelWords = words(item.label);
    const first = tokens[0];
    if (labelWords[0]?.startsWith(first)) total += 6;
    for (const token of tokens) {
      if (labelWords.some(word => word.startsWith(token))) total += 3;
      else if (words(item.path).some(word => word.startsWith(token))) total += 2;
      else total += 1;
    }
    return total;
  }

  async function search(query) {
    const tokens = words(query);
    if (!tokens.length) return [];
    const items = [...collect(), ...(await reports())];
    const matched = items.filter(item => hits(tokens, `${item.label} ${item.path} ${item.keywords.join(" ")}`));
    const seen = new Set();
    return matched
      .filter(item => {
        const key = `${item.group}|${fold(item.label)}|${fold(item.path)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(item => ({ ...item, score: score(item, tokens) }))
      .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || b.score - a.score || a.label.localeCompare(b.label, "tr"))
      .slice(0, 60);
  }

  /** Eşleşen sözcük başlarını vurgular (katlanmış karşılaştırma, özgün metin). */
  function highlight(text, tokens) {
    const parts = String(text).split(/(\s+)/);
    return parts
      .map(part => {
        if (!part.trim()) return esc(part);
        const folded = fold(part);
        const token = tokens.find(item => folded.startsWith(item));
        if (!token) return esc(part);
        // Katlanmış uzunluk özgün uzunlukla aynıdır (tek karakter → tek karakter).
        return `<mark>${esc(part.slice(0, token.length))}</mark>${esc(part.slice(token.length))}`;
      })
      .join("");
  }

  function place() {
    if (!panel || !input) return;
    const rect = input.closest(".hof-search-field").getBoundingClientRect();
    const width = Math.min(380, Math.max(260, window.innerWidth - rect.left - 16));
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(160, window.innerHeight - rect.bottom - 24)}px`;
  }

  function render(query) {
    if (!panel) return;
    const tokens = words(query);
    if (!tokens.length) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    if (!results.length) {
      panel.innerHTML = `<p class="hof-search-empty">“${esc(query)}” için sonuç yok. Sayfa, işlem ya da rapor adı yazın (ör. “alış f”, “cari h”, “çek”).</p>`;
    } else {
      let index = -1;
      const groups = GROUPS.filter(group => results.some(item => item.group === group));
      panel.innerHTML = groups
        .map(
          group =>
            `<div class="hof-search-group">${esc(group)}</div><ol>${results
              .filter(item => item.group === group)
              .map(item => {
                index += 1;
                // Etiket tek bir span'dır: düğme flex olduğu için <mark> parçaları ayrı flex öğesi olup aralık (gap) almasın.
                return `<li><button type="button" class="hof-search-item${index === active ? " is-active" : ""}" data-index="${index}" role="option" aria-selected="${index === active}"><span class="hof-search-label">${highlight(item.label, tokens)}</span>${item.path ? `<span class="hof-search-path">${highlight(item.path, tokens)}</span>` : ""}</button></li>`;
              })
              .join("")}</ol>`,
        )
        .join("");
    }
    panel.hidden = false;
    place();
    panel.querySelector(".hof-search-item.is-active")?.scrollIntoView({ block: "nearest" });
  }

  let pending = 0;
  async function update() {
    const query = input.value;
    lastQuery = query;
    const request = ++pending;
    results = await search(query);
    if (request !== pending || lastQuery !== query) return;
    active = results.length ? 0 : -1;
    render(query);
  }

  function close({ clear = false } = {}) {
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = "";
    }
    results = [];
    active = -1;
    if (clear && input) input.value = "";
  }

  function run(index) {
    const item = results[index];
    if (!item) return;
    close({ clear: true });
    input?.blur();
    try {
      const outcome = item.run();
      if (outcome && typeof outcome.catch === "function") outcome.catch(error => HOF.toastError(error));
    } catch (error) {
      HOF.toastError(error);
    }
  }

  const ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  /** Arama kutusunu Operasyon Merkezi kartının üstüne kurar (hof-workspace.js installSidebar çağırır; kart varsa yüklemede de). */
  function mount(card = document.getElementById("hof-sidecard")) {
    if (!card || !HOF.user || document.getElementById("hof-search")) return;
    box = HOF.el("div", { id: "hof-search", class: "hof-search", role: "search" }, `<label class="hof-search-field"><span class="hof-search-icon" aria-hidden="true">${ICON}</span><input type="text" name="hofSearch" placeholder="Ara…" aria-label="Hızlı Arama: sayfa, işlem ya da rapor" autocomplete="off" spellcheck="false" aria-haspopup="listbox"><span class="hof-search-key" aria-hidden="true">Ctrl+K</span></label>`);
    input = box.querySelector("input");
    panel = HOF.el("div", { id: "hof-search-panel", class: "hof-search-panel", role: "listbox", "aria-label": "Hızlı Arama sonuçları", hidden: "" });
    card.parentNode.insertBefore(box, card);
    document.body.appendChild(panel);
    input.addEventListener("input", update);
    input.addEventListener("focus", () => {
      if (input.value.trim()) update();
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        close({ clear: true });
        input.blur();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!results.length) return;
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
        render(input.value);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (active >= 0) run(active);
      } else if (event.key === "Tab") close();
    });
    panel.addEventListener("mousedown", event => event.preventDefault());
    panel.addEventListener("click", event => {
      const button = event.target.closest("[data-index]");
      if (button) run(Number(button.dataset.index));
    });
    document.addEventListener("pointerdown", event => {
      if (!panel.hidden && !event.target.closest("#hof-search, #hof-search-panel")) close();
    });
    window.addEventListener("resize", () => !panel.hidden && place());
    window.addEventListener("scroll", () => !panel.hidden && place(), true);
  }

  // Ctrl+K (Cmd+K): kutuya odaklanır; pencere açıkken de çalışır (sayfanın tablo araması Ctrl+Shift+F'tedir, hof-search.js).
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "k") return;
    if (!input) mount();
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    input.focus();
    input.select();
    if (input.value.trim()) update();
  }, true);

  HOF.search = {
    register: provider => {
      if (typeof provider === "function") providers.push(provider);
    },
    mount,
    close,
    fold,
    // Testler ve ekran dışı kullanım: sorguya göre sonuç listesi (etiket, grup, yol).
    query: async query => (await search(query)).map(item => ({ group: item.group, label: item.label, path: item.path })),
    open: () => {
      if (!input) mount();
      input?.focus();
    },
  };
  HOF.whenReady?.(() => HOF.onDom?.(() => mount()));
})();
