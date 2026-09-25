/* DestekOfis — ortak istemci çekirdeği.
 * Tüm eklenti betikleri (hof-*.js) bu çekirdeği kullanır: API çağrısı, bildirim, pencere,
 * tek bir toplu DOM izleyici, dosya kimliği çözümleme ve biçimlendirme yardımcıları.
 * Derlenmiş React paketine dokunmadan onun etrafında çalışır. */
(() => {
  "use strict";
  if (window.HOF) return;
  const HOF = (window.HOF = {});
  const nativeFetch = window.fetch.bind(window);
  HOF.nativeFetch = nativeFetch;

  // ---------- Metin yardımcıları ----------
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  HOF.esc = value => String(value ?? "").replace(/[&<>"']/g, char => ESCAPES[char]);
  HOF.normalize = value => String(value ?? "").toLocaleLowerCase("tr-TR").replace(/[İI]/g, "i").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
  HOF.initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toLocaleUpperCase("tr-TR") || "?";
  // Rol adları ve kayıtlara verilen ad seçili sektöre göre değişir (hof-insight.js); bunlar sektör seçilmemiş hâlidir.
  HOF.roleLabels = { admin: "Yönetici", avukat: "Uzman", personel: "Personel", muhasebe: "Muhasebe" };
  HOF.vocab = { record: "kayıt", records: "kayıtlar", Record: "Kayıt", Records: "Kayıtlar", expert: "Uzman", subtitle: "Ofis yönetimi" };
  HOF.modules = { tahsilat: true, haciz: false };

  const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const moneyFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
  const safeDate = value => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  HOF.formatDate = value => (safeDate(value) ? dateFormat.format(safeDate(value)) : "—");
  HOF.formatDateTime = value => (safeDate(value) ? dateTimeFormat.format(safeDate(value)) : "—");
  HOF.formatMoney = value => moneyFormat.format(Number(value) || 0);
  HOF.relativeTime = value => {
    const date = safeDate(value);
    if (!date) return "";
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "az önce";
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} gün önce` : HOF.formatDate(date);
  };

  // ---------- Olay yolu ----------
  const bus = new EventTarget();
  // Aboneliği bırakan bir işlev döner.
  HOF.on = (name, handler) => {
    const listener = event => handler(event.detail);
    bus.addEventListener(name, listener);
    return () => bus.removeEventListener(name, listener);
  };
  HOF.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
  // Açılış tamamlandığında (veya tamamlanmışsa hemen) çalışır.
  HOF.isReady = false;
  HOF.whenReady = handler => (HOF.isReady ? handler(HOF.user) : HOF.on("ready", handler));

  // ---------- Oturum ve yetki ----------
  HOF.user = null;
  HOF.settings = { sheetUrl: "", syncMinutes: "5", aiMapping: "", activeSourceLabel: "" };
  HOF.can = permission => Boolean(HOF.user && HOF.user.permissions && HOF.user.permissions.includes(permission));
  HOF.sourceName = () => HOF.settings.sheetUrl || window.localStorage.getItem("hukuk-ofisi-sheet-url") || "Çalışma tablosu";

  // ---------- API ----------
  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data || {};
    }
  }
  HOF.ApiError = ApiError;
  HOF.api = async (path, { method = "GET", body, signal, timeoutMs = 30000 } = {}) => {
    const init = { method, credentials: "same-origin", headers: { accept: "application/json" }, cache: "no-store" };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
    init.signal = controller.signal;
    let response;
    try {
      response = await nativeFetch(path, init);
    } catch (error) {
      throw new ApiError(error && error.name === "AbortError" ? "Sunucu zamanında yanıt vermedi." : "Sunucuya ulaşılamadı. Ağ bağlantısını kontrol edin.", 0);
    } finally {
      clearTimeout(timer);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      const error = new ApiError(payload.error || "İşlem tamamlanamadı.", response.status, payload);
      if (response.status === 401) HOF.emit("unauthorized", error);
      else if (payload.code === "PASSWORD_CHANGE_REQUIRED") HOF.emit("password-required", error);
      else if (response.status === 503 && payload.code === "MAINTENANCE") HOF.emit("maintenance", payload);
      throw error;
    }
    return payload.data === undefined ? payload : payload.data;
  };

  // ---------- Kendi arayüz düğümlerimiz ----------
  // data-hof-ui taşıyan düğümlerdeki değişiklikler DOM izleyiciyi tetiklemez (sonsuz döngü koruması).
  HOF.el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    node.setAttribute("data-hof-ui", "");
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value === true ? "" : value);
    }
    if (html) node.innerHTML = html;
    return node;
  };

  // ---------- Bildirimler ----------
  const toastHost = () => {
    let host = document.getElementById("hof-toasts");
    if (!host) {
      host = HOF.el("div", { id: "hof-toasts", class: "hof-toasts", role: "status", "aria-live": "polite" });
      document.body.appendChild(host);
    }
    return host;
  };
  HOF.toast = (message, { type = "info", action, timeout = 3600 } = {}) => {
    const node = HOF.el("div", { class: `hof-toast hof-toast-${type}` });
    const text = HOF.el("span", { class: "hof-toast-text", text: String(message) });
    node.appendChild(text);
    if (action) {
      const button = HOF.el("button", { type: "button", class: "hof-toast-action", text: action.label });
      button.onclick = () => {
        node.remove();
        action.onClick();
      };
      node.appendChild(button);
    }
    const close = HOF.el("button", { type: "button", class: "hof-toast-close", "aria-label": "Bildirimi kapat", text: "×" });
    close.onclick = () => node.remove();
    node.appendChild(close);
    const host = toastHost();
    host.appendChild(node);
    // En fazla 4 bildirim görünür; eskisi kapanır.
    while (host.children.length > 4) host.firstElementChild.remove();
    requestAnimationFrame(() => node.classList.add("is-visible"));
    setTimeout(() => {
      node.classList.remove("is-visible");
      setTimeout(() => node.remove(), 250);
    }, action ? Math.max(timeout, 7000) : timeout);
    return node;
  };
  HOF.toastError = error => HOF.toast((error && error.message) || String(error), { type: "error", timeout: 5200 });

  // ---------- Pencereler ----------
  const openModals = [];
  HOF.modal = ({ title, eyebrow = "DESTEKOFİS", body = "", size = "", dismissible = true, onOpen, onClose } = {}) => {
    const previousFocus = document.activeElement;
    const titleId = `hof-modal-title-${Math.random().toString(36).slice(2, 8)}`;
    const node = HOF.el(
      "div",
      { class: "hof-modal-backdrop" },
      `<section class="hof-modal ${size ? `hof-modal-${size}` : ""}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        ${dismissible ? '<button type="button" class="hof-modal-close" aria-label="Kapat">×</button>' : ""}
        <p class="hof-eyebrow">${HOF.esc(eyebrow)}</p>
        <h2 id="${titleId}" class="hof-modal-title">${HOF.esc(title)}</h2>
        <div class="hof-modal-body">${body}</div>
      </section>`,
    );
    const dialog = node.querySelector(".hof-modal");
    let closed = false;
    const close = result => {
      if (closed) return;
      closed = true;
      node.classList.remove("is-visible");
      document.removeEventListener("keydown", onKey, true);
      openModals.splice(openModals.indexOf(api), 1);
      setTimeout(() => node.remove(), 160);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      if (onClose) onClose(result);
    };
    const focusables = () => [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(item => !item.disabled && item.offsetParent !== null);
    const onKey = event => {
      if (openModals[openModals.length - 1] !== api) return;
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const api = { node, dialog, close };
    openModals.push(api);
    document.addEventListener("keydown", onKey, true);
    if (dismissible) {
      node.querySelector(".hof-modal-close").onclick = () => close();
      node.addEventListener("mousedown", event => {
        if (event.target === node) close();
      });
    }
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    if (onOpen) onOpen(api);
    // Odak hemen (eşzamanlı) verilir; gecikmeli odak, hızlı yazan kullanıcının metnini başka alana kaydırabiliyordu.
    const target = dialog.querySelector("[autofocus]") || dialog.querySelector("input, textarea, select") || focusables()[0];
    if (target) target.focus({ preventScroll: true });
    return api;
  };
  HOF.hasOpenModal = () => openModals.length > 0;

  HOF.confirm = ({ title, message, confirmLabel = "Onayla", cancelLabel = "Vazgeç", danger = false }) =>
    new Promise(resolve => {
      let answered = false;
      const modal = HOF.modal({
        title,
        eyebrow: "ONAY",
        size: "small",
        body: `<p class="hof-modal-text">${HOF.esc(message)}</p><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-answer="no">${HOF.esc(cancelLabel)}</button><button type="button" class="hof-button ${danger ? "hof-button-danger" : ""}" data-answer="yes" autofocus>${HOF.esc(confirmLabel)}</button></div>`,
        onClose: () => {
          if (!answered) resolve(false);
        },
      });
      modal.dialog.addEventListener("click", event => {
        const answer = event.target.closest("[data-answer]")?.dataset.answer;
        if (!answer) return;
        answered = true;
        resolve(answer === "yes");
        modal.close();
      });
    });

  // Alan tanımlarından erişilebilir form penceresi üretir.
  HOF.fieldHtml = field => {
    const id = `hof-f-${field.name}-${Math.random().toString(36).slice(2, 7)}`;
    const common = `id="${id}" name="${HOF.esc(field.name)}" ${field.required ? "required" : ""} ${field.autofocus ? "autofocus" : ""} ${field.maxlength ? `maxlength="${field.maxlength}"` : ""}`;
    let control;
    if (field.type === "textarea") control = `<textarea ${common} rows="${field.rows || 4}" placeholder="${HOF.esc(field.placeholder || "")}">${HOF.esc(field.value || "")}</textarea>`;
    else if (field.type === "select")
      control = `<select ${common}>${(field.options || []).map(option => `<option value="${HOF.esc(option.value)}" ${String(option.value) === String(field.value ?? "") ? "selected" : ""}>${HOF.esc(option.label)}</option>`).join("")}</select>`;
    else if (field.type === "checkbox") return `<label class="hof-check"><input type="checkbox" ${common} ${field.value ? "checked" : ""}><span>${HOF.esc(field.label)}</span></label>`;
    else {
      const list = field.list && field.list.length ? `${id}-list` : "";
      control = `<input ${common} type="${field.type || "text"}" value="${HOF.esc(field.value ?? "")}" placeholder="${HOF.esc(field.placeholder || "")}" ${field.inputmode ? `inputmode="${field.inputmode}"` : ""} ${field.step ? `step="${field.step}"` : ""} ${field.min != null ? `min="${field.min}"` : ""} ${list ? `list="${list}"` : ""} autocomplete="${field.autocomplete || "off"}">${list ? `<datalist id="${list}">${field.list.map(item => `<option value="${HOF.esc(item)}"></option>`).join("")}</datalist>` : ""}`;
    }
    return `<label class="hof-field" for="${id}"><span>${HOF.esc(field.label)}${field.required ? ' <i aria-hidden="true">*</i>' : ""}</span>${control}${field.help ? `<small>${HOF.esc(field.help)}</small>` : ""}</label>`;
  };

  HOF.formModal = ({ title, eyebrow, intro = "", fields = [], submitLabel = "Kaydet", size = "", onSubmit, extraHtml = "" }) =>
    HOF.modal({
      title,
      eyebrow,
      size,
      body: `${intro ? `<p class="hof-modal-text">${intro}</p>` : ""}<form class="hof-form" novalidate>${fields.map(HOF.fieldHtml).join("")}${extraHtml}<p class="hof-form-error" role="alert"></p><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button><button type="submit" class="hof-button">${HOF.esc(submitLabel)}</button></div></form>`,
      onOpen: modal => {
        const form = modal.dialog.querySelector("form");
        const error = form.querySelector(".hof-form-error");
        form.querySelector("[data-cancel]").onclick = () => modal.close();
        form.addEventListener("submit", async event => {
          event.preventDefault();
          error.textContent = "";
          const missing = [...form.querySelectorAll("[required]")].find(input => !String(input.value || "").trim());
          if (missing) {
            error.textContent = "Lütfen zorunlu alanları doldurun.";
            missing.focus();
            return;
          }
          const data = {};
          for (const input of form.querySelectorAll("[name]")) data[input.name] = input.type === "checkbox" ? input.checked : input.value;
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          button.classList.add("is-busy");
          try {
            const keepOpen = await onSubmit(data, modal);
            if (keepOpen !== true) modal.close(true);
          } catch (failure) {
            error.textContent = failure.message || "İşlem tamamlanamadı.";
          } finally {
            button.disabled = false;
            button.classList.remove("is-busy");
          }
        });
      },
    });

  // ---------- Tek, toplu DOM izleyici ----------
  // v1.0.0'da her betik belgenin tamamını ayrı ayrı izliyordu; artık tek izleyici kare başına bir kez çalışır.
  const domListeners = new Set();
  let scheduled = false;
  let observer = null;
  const flush = () => {
    scheduled = false;
    for (const listener of domListeners) {
      try {
        listener();
      } catch (error) {
        console.error("[DestekOfis]", error);
      }
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  };
  const isOwnNode = node => {
    const element = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(element && element.closest && element.closest("[data-hof-ui]"));
  };
  HOF.onDom = listener => {
    domListeners.add(listener);
    if (!observer) {
      observer = new MutationObserver(mutations => {
        if (mutations.every(mutation => isOwnNode(mutation.target))) return;
        schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    schedule();
  };

  // ---------- React verisini yeniden çekme ----------
  // Paket, sekme görünür olduğunda verisini yeniler; aynı olayı tetikleyerek düzenleme sonrası tablo güncellenir.
  // Tablo isteği sürerken tetiklenirse (paket aynı isteği tekrar kullanır) istek bitince bir kez daha tetiklenir;
  // böylece değişiklikten SONRA başlayan taze bir istek garanti edilir.
  let rowsInFlight = 0;
  let refreshPending = false;
  const triggerRefetch = () => window.dispatchEvent(new Event("visibilitychange"));
  HOF.trackRowsRequest = promise => {
    rowsInFlight += 1;
    const done = () => {
      rowsInFlight = Math.max(0, rowsInFlight - 1);
      if (!rowsInFlight && refreshPending) {
        refreshPending = false;
        setTimeout(triggerRefetch, 200);
      }
    };
    promise.then(done, done);
    // Tablonun gösterdiği satırların bir kopyası: bir kayda gidilirken (arama, sohbet, kart listeleri) kaydın hangi
    // sekmede olduğunu bilmek için. Paket her istekte yanıtı ayrıca okur; burada klonu okunur.
    promise
      .then(response => (response.ok ? response.clone().json() : null))
      .then(payload => {
        const result = (Array.isArray(payload) ? payload[0] : payload)?.result?.data;
        const data = result?.json ?? result;
        if (!data || !Array.isArray(data.rows)) return;
        HOF.data = { rows: data.rows, tabs: (data.tabs || []).map(tab => tab.title).filter(Boolean), at: Date.now() };
        HOF.emit("rows", HOF.data);
      })
      .catch(() => {});
    return promise;
  };
  HOF.data = { rows: [], tabs: [], at: 0 };
  // Kaydın sekmesi (tabloda birden çok satırı olan kayıtta ilk satırınki); bilinmiyorsa null.
  HOF.tabOfKey = key => {
    const row = HOF.data.rows.find(item => item.__hofKey === key);
    return row ? String(row.__sheet || "").trim() : null;
  };

  // ---------- Satırı belirginleştirme ----------
  // Başka bir yerden (arama, kart listesi, sohbet, veri sağlığı) gidilen satır görünür alana kaydırılır, seçilir ve
  // kısa bir süre vurgulanır. Seçili satırın kalıcı görünümü CSS'tedir (hof-ui.css: "Seçili satır").
  HOF.flashRow = row => {
    if (!row || !row.isConnected) return;
    const key = row.dataset.hofKey || "";
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    // React seçimi işledikten sonra (satırın sınıfını yeniden yazar) vurgu eklenir.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target = row.isConnected ? row : key ? [...document.querySelectorAll(".dynamic-table tbody tr")].find(item => item.dataset.hofKey === key) : null;
        if (!target) return;
        target.classList.remove("hof-row-flash");
        void target.offsetWidth; // aynı satıra tekrar gidilince animasyon yeniden başlasın
        target.classList.add("hof-row-flash");
        clearTimeout(target.hofFlashTimer);
        target.hofFlashTimer = setTimeout(() => target.classList.remove("hof-row-flash"), 2200);
      }),
    );
  };
  HOF.refreshData = () => {
    if (rowsInFlight) refreshPending = true;
    else triggerRefetch();
    HOF.emit("data-refresh");
  };

  // ---------- Dosya kimliği ----------
  const CASE_PATTERN = /\b(?:19|20)\d{2}\/\d+\b/;
  HOF.casePattern = CASE_PATTERN;
  HOF.rowKey = row => {
    if (!row) return "";
    if (row.dataset && row.dataset.hofKey) return row.dataset.hofKey;
    const match = (row.innerText || "").match(CASE_PATTERN);
    return match ? match[0] : "";
  };
  HOF.detailPanel = () => document.querySelector(".detail-panel");
  HOF.selectedCase = () => {
    const panel = HOF.detailPanel();
    if (!panel || !panel.querySelector(".detail-header")) return null;
    const key = panel.dataset.hofKey || (panel.innerText.match(CASE_PATTERN) || [])[0] || panel.dataset.hofCase || "";
    if (!key) return null;
    const title = panel.querySelector(".detail-title")?.textContent?.trim() || key;
    return { key, title, panel };
  };
  HOF.tableHeaders = table => [...(table?.querySelectorAll("thead th") || [])].map(th => th.textContent.trim());
})();
