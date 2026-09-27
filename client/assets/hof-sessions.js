/* DestekOfis — veri oturumları (v2.0.1).
 * Farklı konudaki her Excel/Sheet ayrı bir oturumda açılabilir; veriler, düzeltmeler ve yeni kayıtlar birbirine
 * karışmaz. Sol menüdeki oturum seçiciyle herkes kendi çalışacağı oturumu seçer (seçim kişiye özeldir ve sunucuda
 * saklanır; başka bilgisayarlardaki ekranları değiştirmez). Veri yöneticisi (sources.manage) oturumun adını
 * seçicideki kalemle ya da Ayarlar → Veri → Oturumlar'dan değiştirir, yeni oturum açar ve oturumu siler. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const FIRST_KEY = "dataset://ofis";
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  const PENCIL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  const LAYERS = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>';
  const CHEVRON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';

  let state = null; // { current, sessions: [...], canManage }
  let pending = null;
  let editing = ""; // adı düzenlenen oturumun anahtarı (seçici içinde)

  const canManage = () => Boolean(state?.canManage);
  const currentSession = () => state?.sessions.find(item => item.current) || null;
  const nameOf = item => item?.name || "Oturum";
  const meta = item =>
    [`${number(item.rowCount)} kayıt`, item.recordCount ? `${number(item.recordCount)} yeni kayıt` : "", item.linked ? "Sheets'e bağlı" : ""].filter(Boolean).join(" · ");

  async function load() {
    if (!HOF.user) return null;
    if (!pending) {
      pending = HOF.api("/api/workspace/sessions")
        .then(data => {
          state = data;
          HOF.sessionCount = data.sessions.length;
          render();
          return data;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  // ---------- Oturuma geçiş ----------
  async function select(key) {
    const target = state?.sessions.find(item => item.key === key);
    if (!target) return;
    if (target.current) return closeMenu();
    const row = document.querySelector(`#hof-session [data-pick="${CSS.escape(key)}"]`);
    row?.classList.add("is-busy");
    document.querySelectorAll("#hof-session button").forEach(button => (button.disabled = true));
    try {
      const result = await HOF.api("/api/workspace/sessions/select", { method: "POST", body: { key } });
      if (result.state) HOF.applyClientState(result.state);
      sessionStorage.setItem("hof-flash", `“${nameOf(target)}” oturumuna geçtiniz. Bu seçim yalnızca sizin ekranınızı değiştirir.`);
      location.reload();
    } catch (error) {
      document.querySelectorAll("#hof-session button").forEach(button => (button.disabled = false));
      row?.classList.remove("is-busy");
      HOF.toastError(error);
    }
  }

  // Hata olursa fırlatır (pencere içinde gösterilir); rename() aynı işi bildirimle yapar.
  async function renameStrict(key, value) {
    const name = String(value || "").replace(/\s+/g, " ").trim();
    const target = state?.sessions.find(item => item.key === key);
    if (!target) throw new Error("Oturum bulunamadı; listeyi yenileyin.");
    if (!name) throw new Error("Oturum adı boş olamaz.");
    if (name === target.name) return name;
    await HOF.api("/api/workspace/sessions/rename", { method: "POST", body: { key, name } });
    target.name = name;
    HOF.toast(`Oturumun yeni adı: “${name}”. Tüm bilgisayarlarda görünür.`, { type: "success" });
    render();
    load().catch(() => {});
    return name;
  }
  async function rename(key, value) {
    try {
      await renameStrict(key, value);
      return true;
    } catch (error) {
      HOF.toastError(error);
      return false;
    }
  }

  async function remove(key) {
    const target = state?.sessions.find(item => item.key === key);
    if (!target || key === FIRST_KEY) return false;
    const ok = await HOF.confirm({
      title: "Oturumu sil",
      message: `“${nameOf(target)}” oturumu ve içindeki ${number(target.rowCount)} kayıt, düzeltmeler ve uygulamada eklenen kayıtlar kalıcı olarak silinir. Kullanıcılar, notlar, görevler, tahsilatlar ve Kasa silinmez. Silmeden önce veritabanının tam yedeği alınır; bu oturumda çalışan kişiler ilk oturuma döner.`,
      confirmLabel: "Oturumu sil",
      danger: true,
    });
    if (!ok) return false;
    try {
      const result = await HOF.api("/api/workspace/sessions/delete", { method: "POST", body: { key } });
      const message = `“${nameOf(target)}” oturumu silindi (${number(result.removed)} kayıt). Yedek: ${result.backupName || "—"}`;
      if (target.current) {
        sessionStorage.setItem("hof-flash", message);
        location.reload();
        return true;
      }
      HOF.toast(message, { type: "success", timeout: 6000 });
      await load();
      return true;
    } catch (error) {
      HOF.toastError(error);
      return false;
    }
  }

  // ---------- Yeni oturum ----------
  function openNew() {
    const picker = HOF.sources?.picker;
    if (!picker || !canManage()) return;
    closeMenu();
    const modal = HOF.modal({
      title: "Yeni oturum aç",
      eyebrow: "OTURUM",
      body: `<p class="hof-modal-text">Farklı konudaki bir tabloyu (ör. taksit listesi, ikinci şube) <b>ayrı bir oturumda</b> açın. Şu anki oturum verisiyle, düzeltmeleri ve kayıtlarıyla olduğu gibi kalır; oturumlar arasında sol menüden geçersiniz.</p>
        <div class="hof-data-import">${picker.dropHtml(true)}${picker.linkHtml}</div>
        <p class="hof-modal-text hof-muted">Dosya okunduktan sonra oturuma ad verirsiniz; adı sonradan da değiştirebilirsiniz.</p>`,
    });
    const zone = modal.dialog.querySelector(".hof-drop");
    picker.wireDrop(zone, { session: true });
    zone.querySelector("input").addEventListener("change", () => modal.close(), { once: true });
    zone.addEventListener("drop", () => modal.close(), { once: true });
    const form = modal.dialog.querySelector(".hof-link-form");
    form.addEventListener("submit", () => picker.sheetPattern.test(form.elements.url.value.trim()) && modal.close());
    picker.wireLink(form, { session: true });
  }

  // ---------- Sol menüdeki seçici ----------
  function menuHtml() {
    const rows = state.sessions
      .map(item => {
        if (editing === item.key) {
          return `<li class="hof-session-row is-editing">
            <form class="hof-session-edit" data-edit="${esc(item.key)}">
              <input type="text" name="name" value="${esc(item.name)}" maxlength="80" aria-label="Oturumun yeni adı" autocomplete="off">
              <div><button type="submit" class="hof-button hof-button-small">Kaydet</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-edit-cancel>Vazgeç</button></div>
            </form>
          </li>`;
        }
        return `<li class="hof-session-row${item.current ? " is-current" : ""}">
          <button type="button" class="hof-session-pick" role="menuitemradio" aria-checked="${item.current}" data-pick="${esc(item.key)}">
            <span class="hof-session-dot" aria-hidden="true"></span>
            <span class="hof-session-info"><b title="${esc(item.name)}">${esc(item.name)}</b><small>${esc(meta(item))}</small></span>
            ${item.current ? '<span class="hof-session-now">Açık</span>' : ""}
          </button>
          ${canManage() ? `<button type="button" class="hof-session-rename" data-rename="${esc(item.key)}" title="Adını değiştir" aria-label="“${esc(item.name)}” oturumunun adını değiştir">${PENCIL}</button>` : ""}
        </li>`;
      })
      .join("");
    return `<p class="hof-session-menu-title">Çalışma oturumları</p>
      <ul class="hof-session-list" role="menu">${rows}</ul>
      ${canManage()
        ? `<div class="hof-session-foot"><button type="button" class="hof-session-new" data-new>+ Yeni oturum aç</button><button type="button" class="hof-session-manage" data-manage>Oturumları yönet</button></div>`
        : ""}
      <p class="hof-session-note">Seçtiğiniz oturum yalnızca sizin ekranınızı değiştirir.</p>`;
  }

  let node = null;
  const visible = () => {
    const current = currentSession();
    return Boolean(state && current && (state.sessions.length > 1 || current.rowCount || current.recordCount));
  };
  // Kenar çubuğunda marka ile menü arasına yerleşir (paketin kendi düğümlerine dokunmadan). Paket kenar çubuğunu
  // yeniden çizerse DOM izleyicisi düğümü yeniden yerleştirir; içerik yalnızca render() ile değişir.
  function place() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || !node || !visible()) {
      if (node?.isConnected && !visible()) node.remove();
      return;
    }
    const nav = [...sidebar.children].find(child => child.tagName === "NAV");
    if (nav) {
      if (node.parentNode !== sidebar || node.nextElementSibling !== nav) sidebar.insertBefore(node, nav);
    } else if (node.parentNode !== sidebar) sidebar.prepend(node);
    sidebar.classList.add("hof-has-session");
  }

  function render() {
    const current = currentSession();
    if (!visible()) {
      node?.remove();
      document.querySelector(".sidebar")?.classList.remove("hof-has-session");
      return;
    }
    if (!node) {
      node = HOF.el("div", { id: "hof-session", class: "hof-session" });
      node.addEventListener("click", onClick);
      node.addEventListener("submit", onSubmit);
      node.addEventListener("keydown", onKey);
    }
    const open = node.classList.contains("is-open");
    const count = state.sessions.length;
    node.innerHTML = `<button type="button" class="hof-session-current" data-toggle aria-haspopup="menu" aria-expanded="${open}" aria-controls="hof-session-menu" title="Çalışma oturumunu değiştir">
        <span class="hof-session-icon">${LAYERS}</span>
        <span class="hof-session-text"><small>Çalışma oturumu</small><strong title="${esc(current.name)}">${esc(current.name)}</strong></span>
        ${count > 1 ? `<span class="hof-session-count" title="${number(count)} oturum var" aria-label="${number(count)} oturum var">${number(count)}</span>` : ""}
        <span class="hof-session-chevron">${CHEVRON}</span>
      </button>
      <div class="hof-session-menu" id="hof-session-menu" ${open ? "" : "hidden"}>${menuHtml()}</div>`;
    place();
    if (editing) {
      const input = node.querySelector(".hof-session-edit input");
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
      }
    }
  }

  function openMenu() {
    if (!node) return;
    node.classList.add("is-open");
    node.querySelector("[data-toggle]").setAttribute("aria-expanded", "true");
    node.querySelector(".hof-session-menu").hidden = false;
    (node.querySelector(".hof-session-row.is-current .hof-session-pick") || node.querySelector(".hof-session-pick"))?.focus();
    load();
  }
  function closeMenu({ focus = false } = {}) {
    editing = "";
    if (!node || !node.classList.contains("is-open")) return;
    node.classList.remove("is-open");
    render();
    if (focus) node.querySelector("[data-toggle]")?.focus();
  }

  function onClick(event) {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-toggle")) {
      if (node.classList.contains("is-open")) closeMenu();
      else openMenu();
    } else if (target.dataset.pick) select(target.dataset.pick);
    else if (target.dataset.rename) {
      editing = target.dataset.rename;
      render();
    } else if (target.hasAttribute("data-edit-cancel")) {
      editing = "";
      render();
      document.querySelector("#hof-session .hof-session-pick")?.focus();
    } else if (target.hasAttribute("data-new")) openNew();
    else if (target.hasAttribute("data-manage")) {
      closeMenu();
      HOF.sources?.openDataSettings?.({ focus: "sessions" });
    }
  }

  async function onSubmit(event) {
    const form = event.target.closest("[data-edit]");
    if (!form) return;
    event.preventDefault();
    form.querySelectorAll("button, input").forEach(item => (item.disabled = true));
    const done = await rename(form.dataset.edit, form.elements.name.value);
    if (done) {
      editing = "";
      render();
      document.querySelector("#hof-session .hof-session-pick")?.focus();
    } else form.querySelectorAll("button, input").forEach(item => (item.disabled = false));
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (editing) {
      editing = "";
      render();
      document.querySelector("#hof-session .hof-session-pick")?.focus();
    } else closeMenu({ focus: true });
  }

  document.addEventListener("mousedown", event => {
    if (node?.classList.contains("is-open") && !node.contains(event.target)) closeMenu();
  });

  // ---------- Ayarlar → Veri → Oturumlar ----------
  async function section() {
    const data = await load().catch(() => null);
    if (!data || !canManage()) return null;
    const list = data.sessions;
    const html = `<section class="hof-data-section hof-session-section" id="hof-session-section">
        <h3>Oturumlar</h3>
        <p class="hof-modal-text hof-muted">Her oturum ayrı bir çalışma alanıdır; tabloları, düzeltmeleri ve yeni kayıtları birbirine karışmaz. Herkes kendi oturumunu sol menüdeki seçiciden seçer. Yeni eklenen kullanıcılar en son açılan oturumla başlar.</p>
        <p class="hof-session-shared"><b>Tüm oturumlarda ortak:</b> kullanıcılar ve personel, yetkiler, görevler, mesajlar, notlar, tahsilatlar ve <b>Kasa</b>, ofis adı, yedekler ve lisans. Oturum değiştirmek ya da silmek bunları etkilemez.</p>
        <ul class="hof-session-admin">${list
          .map(item => `<li data-session="${esc(item.key)}">
            <div class="hof-session-admin-info"><b>${esc(item.name)}</b>${item.current ? '<span class="hof-chip">Şu an açık</span>' : ""}<small>${esc(meta(item))}${item.createdAt ? ` · açıldı ${esc(HOF.formatDateTime(item.createdAt))}` : ""}</small></div>
            <div class="hof-session-admin-actions">
              ${item.current ? "" : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-s-open>Bu oturuma geç</button>'}
              <button type="button" class="hof-button hof-button-small hof-button-ghost" data-s-rename>Adını değiştir</button>
              ${item.key === FIRST_KEY ? "" : '<button type="button" class="hof-button hof-button-small hof-button-danger" data-s-delete>Sil</button>'}
            </div>
          </li>`)
          .join("")}</ul>
        <button type="button" class="hof-button hof-button-small" data-s-new>+ Yeni oturum aç</button>
      </section>`;
    const wire = modal => {
      const root = modal.dialog.querySelector("#hof-session-section");
      root?.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        const key = button.closest("[data-session]")?.dataset.session;
        const item = state?.sessions.find(entry => entry.key === key);
        if (button.hasAttribute("data-s-new")) {
          modal.close();
          openNew();
        } else if (button.hasAttribute("data-s-open") && item) {
          modal.close();
          select(key);
        } else if (button.hasAttribute("data-s-rename") && item) {
          HOF.formModal({
            title: "Oturumun adı",
            eyebrow: "OTURUM",
            intro: "Oturumun adı sol menüdeki seçicide ve bu listede görünür; tüm bilgisayarlarda aynıdır.",
            fields: [{ name: "name", label: "Oturumun adı", value: item.name, maxlength: 80, required: true, autofocus: true }],
            submitLabel: "Adı kaydet",
            onSubmit: async values => {
              const name = await renameStrict(key, values.name);
              const title = root.querySelector(`[data-session="${CSS.escape(key)}"] .hof-session-admin-info b`);
              if (title) title.textContent = name;
            },
          });
        } else if (button.hasAttribute("data-s-delete") && item) {
          if (await remove(key)) root.querySelector(`[data-session="${CSS.escape(key)}"]`)?.remove();
        }
      });
    };
    return { html, wire };
  }

  // ---------- Canlı değişiklikler ----------
  HOF.on("live:workspace.changed", change => {
    if (change?.kind !== "sessions") return;
    load().then(data => {
      // Çalışılan oturum başka bir bilgisayarda silindiyse sayfa ilk oturumla yeniden açılır.
      if (data && HOF.datasetKey && data.current !== HOF.datasetKey) {
        sessionStorage.setItem("hof-flash", "Çalıştığınız oturum veri yöneticisi tarafından silindi; ilk oturuma geçildi.");
        location.reload();
      } else if (change.created && change.actorId !== HOF.user?.id) {
        HOF.toast(`${change.actorName || "Bir kullanıcı"} yeni bir oturum açtı: “${change.created}”. Sol menüdeki oturum seçiciden geçebilirsiniz.`, { timeout: 7000 });
      }
    }, () => {});
  });
  HOF.on("live:resync", () => load().catch(() => {}));

  HOF.whenReady(() => {
    load().catch(() => {});
    HOF.onDom(place);
  });
  HOF.sessions = { load, select, rename, remove, openNew, section };
})();
