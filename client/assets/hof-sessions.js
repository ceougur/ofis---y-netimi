/* DestekOfis — sayfalar (v2.0.17; eski adıyla "veri oturumları", v2.0.1).
 * Şirketin tabloları ortadaki SAYFA şeridinde durur: her sayfa ayrı bir veri kümesidir (kendi Excel / Google Sheets
 * kaynağı, kolon rolleri, tarih anlamı, düzeltmeleri ve yeni kayıtları); ikinci Excel ikinci sayfa olur, veriler
 * birbirine karışmaz. Sayfalar şirkete aittir (şirket değişince şirketin sayfaları gelir). "+ Sayfa": Excel'den /
 * Google Sheets'ten aktar (ilk yüklemedeki ön izleme + kolon eşleme ekranıyla, VERİ sayfası) ya da Boş Sayfa (elle
 * doldurulan serbest ızgara). Hangi sayfada çalışıldığı kişiye özeldir ve sunucuda saklanır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const FIRST_KEY = "dataset://ofis";
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  const PENCIL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
  // Başka sayfadaki kayda git (2.0.25, müşteri: "Kayda Git yalnız ikinci sayfayı açıyor, o kayda gitmiyor"): sayfa
  // değişince ekran yeniden yüklenir; gidilecek kayıt sekme oturumuna yazılır, tablo gelince açılır.
  const REVEAL = "hof-reveal";
  const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';

  let state = null; // { current, sessions: [...], canManage }
  let pending = null;
  let removing = null; // bu pencerenin silmekte olduğu sayfa: kendi silme olayı "başkası sildi" sayılmaz
  let editing = ""; // adı düzenlenen sayfanın anahtarı (şeritte)

  const canManage = () => Boolean(state?.canManage);
  const currentPage = () => state?.sessions.find(item => item.current) || null;
  const nameOf = item => item?.name || "Sayfa";
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

  // ---------- Sayfaya geçiş ----------
  async function select(key, { reveal = null } = {}) {
    const target = state?.sessions.find(item => item.key === key);
    if (reveal?.caseKey && !target) {
      // Uyarının sayfası silinmiş (başka bir yönetici, başka bilgisayar): kayıt açık sayfada aranmaz, takvim yenilenir.
      HOF.toast("Bu uyarının sayfası silinmiş; uyarı listeden kaldırılıyor.", { type: "warn" });
      HOF.emit("dues:refresh");
      load().catch(() => {});
      return;
    }
    if (reveal?.caseKey && target.current) return HOF.revealRecord?.(reveal.caseKey, { tab: reveal.tab || "" });
    if (!target || target.current) return;
    const pill = document.querySelector(`#hof-pages [data-pick="${CSS.escape(key)}"]`);
    pill?.classList.add("is-busy");
    document.querySelectorAll("#hof-pages button").forEach(button => (button.disabled = true));
    try {
      const result = await HOF.api("/api/workspace/sessions/select", { method: "POST", body: { key } });
      if (result.state) HOF.applyClientState(result.state);
      if (reveal?.caseKey) {
        try {
          sessionStorage.setItem(REVEAL, JSON.stringify({ key, caseKey: reveal.caseKey, tab: reveal.tab || "", at: Date.now() }));
        } catch {
          // depolama kapalıysa yalnız sayfaya geçilir
        }
      }
      sessionStorage.setItem("hof-flash", `“${nameOf(target)}” sayfasına geçtiniz. Bu seçim yalnızca sizin ekranınızı değiştirir.`);
      location.reload();
    } catch (error) {
      document.querySelectorAll("#hof-pages button").forEach(button => (button.disabled = false));
      pill?.classList.remove("is-busy");
      HOF.toastError(error);
    }
  }

  // Hata olursa fırlatır (pencere içinde gösterilir); rename() aynı işi bildirimle yapar.
  async function renameStrict(key, value) {
    const name = String(value || "").replace(/\s+/g, " ").trim();
    const target = state?.sessions.find(item => item.key === key);
    if (!target) throw new Error("Sayfa bulunamadı; listeyi yenileyin.");
    if (!name) throw new Error("Sayfa adı boş olamaz.");
    if (name === target.name) return name;
    await HOF.api("/api/workspace/sessions/rename", { method: "POST", body: { key, name } });
    target.name = name;
    HOF.toast(`Sayfanın yeni adı: “${name}”. Tüm bilgisayarlarda görünür.`, { type: "success" });
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
      title: "Sayfayı Sil",
      message: `“${nameOf(target)}” sayfası ve içindeki ${number(target.totalRowCount ?? target.rowCount)} kayıt, düzeltmeler ve uygulamada eklenen kayıtlar kalıcı olarak silinir. Cari, Kasa, stok, taksit, fatura, kullanıcılar, notlar ve görevler silinmez. Silmeden önce veritabanının tam yedeği alınır; bu sayfada çalışan kişiler başka bir sayfaya geçer.`,
      confirmLabel: "Sayfayı Sil",
      danger: true,
    });
    if (!ok) return false;
    removing = key;
    try {
      const result = await HOF.api("/api/workspace/sessions/delete", { method: "POST", body: { key } });
      const message = `“${nameOf(target)}” sayfası silindi (${number(result.removed)} kayıt). Yedek: ${result.backupName || "—"}`;
      if (target.current) {
        const data = await load().catch(() => null);
        const next = data?.sessions.find(item => item.key === data.current);
        sessionStorage.setItem("hof-flash", next ? `${message}. Açılan sayfa: “${nameOf(next)}”.` : message);
        location.reload();
        return true;
      }
      HOF.toast(message, { type: "success", timeout: 6000 });
      await load();
      removing = null;
      return true;
    } catch (error) {
      removing = null;
      HOF.toastError(error);
      return false;
    }
  }

  // ---------- + Sayfa: Excel'den / Google Sheets'ten (veri sayfası) / Boş Sayfa (serbest ızgara) ----------
  function openNew(source = "excel") {
    const picker = HOF.sources?.picker;
    closeAdd();
    if (source === "blank") {
      HOF.free?.open?.({ blankOnly: true });
      return;
    }
    if (!picker || !canManage()) return HOF.toast("Sayfa eklemek veri yönetimi yetkisi ister.", { type: "error" });
    const excel = source !== "sheets";
    const modal = HOF.modal({
      title: excel ? "Excel'den Yeni Sayfa" : "Google Sheets'ten Yeni Sayfa",
      eyebrow: "+ SAYFA",
      body: `<p class="hof-modal-text">${excel ? "Excel dosyası" : "Google Sheets tablosu"} <b>yeni bir sayfa</b> olarak açılır: ilk yüklemedeki gibi ön izleme ve kolon eşleme ekranından geçer (tarih kolonları tanınır; takvim, uyarılar, detay kartı ve raporlar bu sayfayı da kapsar). Şu anki sayfa verisiyle, düzeltmeleri ve kayıtlarıyla olduğu gibi kalır.</p>
        <div class="hof-data-import">${excel ? picker.dropHtml(true) : picker.linkHtml}</div>
        <p class="hof-modal-text hof-muted">${excel ? "Dosya" : "Tablo"} okunduktan sonra sayfaya ad verirsiniz; adı sonradan da değiştirebilirsiniz.</p>`,
    });
    if (excel) {
      const zone = modal.dialog.querySelector(".hof-drop");
      picker.wireDrop(zone, { session: true });
      zone.querySelector("input").addEventListener("change", () => modal.close(), { once: true });
      zone.addEventListener("drop", () => modal.close(), { once: true });
    } else {
      const form = modal.dialog.querySelector(".hof-link-form");
      form.addEventListener("submit", () => picker.sheetPattern.test(form.elements.url.value.trim()) && modal.close());
      picker.wireLink(form, { session: true });
      form.elements.url?.focus();
    }
  }

  // ---------- Orta alandaki sayfa şeridi ----------
  function pillsHtml() {
    return state.sessions
      .map(item => {
        if (editing === item.key) {
          return `<li class="hof-page is-editing">
            <form class="hof-page-edit" data-edit="${esc(item.key)}">
              <input type="text" name="name" value="${esc(item.name)}" maxlength="80" aria-label="Sayfanın yeni adı" autocomplete="off">
              <button type="submit" class="hof-button hof-button-small">Kaydet</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-edit-cancel>Vazgeç</button>
            </form>
          </li>`;
        }
        return `<li class="hof-page${item.current ? " is-current" : ""}">
          <button type="button" class="hof-page-pick" role="tab" aria-selected="${item.current}" data-pick="${esc(item.key)}" title="${esc(meta(item))}">
            <b>${esc(item.name)}</b><small>${esc(meta(item))}</small>
          </button>
          ${canManage() && item.current ? `<button type="button" class="hof-page-rename" data-rename="${esc(item.key)}" title="Sayfanın adını değiştir" aria-label="“${esc(item.name)}” sayfasının adını değiştir">${PENCIL}</button>` : ""}
          ${canManage() && item.current && item.key !== FIRST_KEY ? `<button type="button" class="hof-page-rename hof-page-delete" data-remove-page="${esc(item.key)}" title="Sayfayı Sil" aria-label="“${esc(item.name)}” sayfasını sil">${TRASH}</button>` : ""}
        </li>`;
      })
      .join("");
  }

  let node = null;
  const visible = () => {
    const current = currentPage();
    return Boolean(state && current && (state.sessions.length > 1 || current.rowCount || current.recordCount || HOF.data?.freeTabs?.size));
  };
  // İçerik alanının en üstüne (sekme şeridinin üstüne) yerleşir; paket alanı yeniden çizerse DOM izleyicisi düğümü
  // yeniden yerleştirir; içerik yalnızca render() ile değişir.
  function place() {
    const wrap = document.querySelector(".main-shell .content-wrap");
    if (!wrap || !node || !visible()) {
      if (node?.isConnected && !visible()) node.remove();
      return;
    }
    // Sıra: başlık satırı → akıllı özet (#hof-summary) → tahsilat takvimi şeridi → sayfalar. Özet ve takvim kendilerini
    // başlığın hemen altına koyar; sayfa şeridi onların altına yerleşir (aynı yeri isteyen iki şerit DOM izleyicisiyle
    // birbirini sonsuz döngüde taşıyordu — v2.0.17 UI/UX denetimi bulgusu).
    const welcome = wrap.querySelector(":scope > .welcome-row");
    const prev = wrap.querySelector(":scope > .hof-payment-promises") || wrap.querySelector(":scope > #hof-summary") || welcome;
    const anchor = prev ? prev.nextElementSibling : wrap.firstElementChild;
    if (node === anchor) return;
    if (anchor) wrap.insertBefore(node, anchor);
    else wrap.appendChild(node);
  }

  function render() {
    if (!visible()) {
      node?.remove();
      return;
    }
    if (!node) {
      node = HOF.el("section", { id: "hof-pages", class: "hof-pages", "aria-label": "Sayfalar" });
      node.addEventListener("click", onClick);
      node.addEventListener("submit", onSubmit);
      node.addEventListener("keydown", onKey);
    }
    const open = node.classList.contains("is-add-open");
    node.innerHTML = `<div class="hof-pages-head"><span>Sayfalar</span><strong>${number(state.sessions.length)}</strong></div>
      <ul class="hof-pages-list" role="tablist">${pillsHtml()}</ul>
      <div class="hof-pages-add">
        <button type="button" class="hof-pages-add-button" data-add aria-haspopup="menu" aria-expanded="${open}" aria-controls="hof-pages-menu" title="Yeni sayfa: Excel'den, Google Sheets'ten ya da boş"><span aria-hidden="true">+</span> Sayfa ${CHEVRON}</button>
        <div class="hof-pages-menu" id="hof-pages-menu" role="menu" ${open ? "" : "hidden"}>
          ${canManage() ? `<button type="button" role="menuitem" data-add-source="excel"><b>Excel'den Aktar</b><small>Veri sayfası: ön izleme, kolon rolleri, tarih uyarıları</small></button>
          <button type="button" role="menuitem" data-add-source="sheets"><b>Google Sheets'ten Aktar</b><small>Bağlı tablo; aralıklarla eşitlenir</small></button>` : ""}
          <button type="button" role="menuitem" data-add-source="blank"><b>Boş Sayfa</b><small>Excel gibi elle doldurulan serbest sayfa</small></button>
        </div>
      </div>`;
    place();
    if (editing) {
      const input = node.querySelector(".hof-page-edit input");
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
      }
    }
  }

  function openAdd() {
    if (!node) return;
    node.classList.add("is-add-open");
    node.querySelector("[data-add]").setAttribute("aria-expanded", "true");
    node.querySelector(".hof-pages-menu").hidden = false;
    node.querySelector(".hof-pages-menu [role=menuitem]")?.focus();
  }
  function closeAdd({ focus = false } = {}) {
    if (!node || !node.classList.contains("is-add-open")) return;
    node.classList.remove("is-add-open");
    node.querySelector("[data-add]")?.setAttribute("aria-expanded", "false");
    const menu = node.querySelector(".hof-pages-menu");
    if (menu) menu.hidden = true;
    if (focus) node.querySelector("[data-add]")?.focus();
  }

  function onClick(event) {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-add")) {
      if (node.classList.contains("is-add-open")) closeAdd();
      else openAdd();
    } else if (target.dataset.addSource) openNew(target.dataset.addSource);
    else if (target.dataset.pick) select(target.dataset.pick);
    else if (target.dataset.removePage) remove(target.dataset.removePage);
    else if (target.dataset.rename) {
      editing = target.dataset.rename;
      render();
    } else if (target.hasAttribute("data-edit-cancel")) {
      editing = "";
      render();
      document.querySelector("#hof-pages .hof-page.is-current .hof-page-pick")?.focus();
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
      document.querySelector("#hof-pages .hof-page.is-current .hof-page-pick")?.focus();
    } else form.querySelectorAll("button, input").forEach(item => (item.disabled = false));
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (editing) {
      editing = "";
      render();
      document.querySelector("#hof-pages .hof-page.is-current .hof-page-pick")?.focus();
    } else closeAdd({ focus: true });
  }

  document.addEventListener("mousedown", event => {
    if (node?.classList.contains("is-add-open") && !node.querySelector(".hof-pages-add").contains(event.target)) closeAdd();
  });

  // ---------- Ayarlar → Veri → Sayfalar ----------
  async function section() {
    const data = await load().catch(() => null);
    if (!data || !canManage()) return null;
    const list = data.sessions;
    const html = `<section class="hof-data-section hof-session-section" id="hof-session-section">
        <h3>Sayfalar</h3>
        <p class="hof-modal-text hof-muted">Her sayfa ayrı bir veri kümesidir; tabloları, kaynağı, düzeltmeleri ve yeni kayıtları birbirine karışmaz. Sayfalar ortadaki şeritten seçilir; yeni eklenen kullanıcılar en son açılan sayfayla başlar.</p>
        <p class="hof-session-shared"><b>Tüm Sayfalarda Ortak (şirkete ait):</b> cari, Kasa, stok, taksit, çek/senet, fatura, görevler, mesajlar, notlar ve ofis ayarları. Sayfa değiştirmek ya da silmek bunları etkilemez.</p>
        <ul class="hof-session-admin">${list
          .map(item => `<li data-session="${esc(item.key)}">
            <div class="hof-session-admin-info"><b>${esc(item.name)}</b>${item.current ? '<span class="hof-chip">Şu An Açık</span>' : ""}<small>${esc(meta(item))}${item.createdAt ? ` · açıldı ${esc(HOF.formatDateTime(item.createdAt))}` : ""}</small></div>
            <div class="hof-session-admin-actions">
              ${item.current ? "" : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-s-open>Bu Sayfaya Geç</button>'}
              <button type="button" class="hof-button hof-button-small hof-button-ghost" data-s-rename>Adını Değiştir</button>
              ${item.key === FIRST_KEY ? "" : '<button type="button" class="hof-button hof-button-small hof-button-danger" data-s-delete>Sil</button>'}
            </div>
          </li>`)
          .join("")}</ul>
        <button type="button" class="hof-button hof-button-small" data-s-new>+ Excel'den Yeni Sayfa</button>
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
          openNew("excel");
        } else if (button.hasAttribute("data-s-open") && item) {
          modal.close();
          select(key);
        } else if (button.hasAttribute("data-s-rename") && item) {
          HOF.formModal({
            title: "Sayfanın Adı",
            eyebrow: "SAYFA",
            intro: "Sayfanın adı ortadaki şeritte ve bu listede görünür; tüm bilgisayarlarda aynıdır.",
            fields: [{ name: "name", label: "Sayfanın Adı", value: item.name, maxlength: 80, required: true, autofocus: true }],
            submitLabel: "Adı Kaydet",
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
  // Başka bilgisayardaki veri değişikliği (yükleme, eşitleme, sekme) şeritteki kayıt sayısını değiştirebilir.
  const countsSoon = HOF.refresher(() => load(), { delay: 800, gap: 4000 });
  HOF.on("live:workspace.changed", change => {
    if (change?.kind === "source" || change?.kind === "records") return countsSoon();
    if (change?.kind !== "sessions") return;
    if (removing) return; // bu pencerenin kendi silmesi: remove() bildirir ve yeniden açar
    load().then(data => {
      // Çalışılan sayfa başka bir bilgisayarda silindiyse ekran sunucunun açtığı sayfayla yeniden açılır.
      if (data && HOF.datasetKey && data.current !== HOF.datasetKey && !removing) {
        const next = data.sessions.find(item => item.key === data.current);
        sessionStorage.setItem("hof-flash", `Çalıştığınız sayfa veri yöneticisi tarafından silindi; ${next ? `“${nameOf(next)}” sayfasına` : "başka bir sayfaya"} geçildi.`);
        location.reload();
      } else if (change.created && change.actorId !== HOF.user?.id) {
        HOF.toast(`${change.actorName || "Bir kullanıcı"} yeni bir sayfa açtı: “${change.created}”. Ortadaki sayfa şeridinden geçebilirsiniz.`, { timeout: 7000 });
      }
    }, () => {});
  });
  // Başka sayfadaki veri değişikliği (hof-live.js) o sayfanın şeritteki sayısını değiştirir.
  HOF.on("live:page.changed", change => {
    if (change?.kind === "source" || change?.kind === "records") countsSoon();
  });
  HOF.on("live:resync", () => load().catch(() => {}));
  HOF.on("data", () => render());

  // Yeniden yüklemeden sonra: bekleyen kayıt bu sayfanın tablosu gelince seçilir, görünür yere kaydırılır, detay kartı açılır.
  function revealPending() {
    let wish = null;
    try {
      wish = JSON.parse(sessionStorage.getItem(REVEAL) || "null");
      sessionStorage.removeItem(REVEAL);
    } catch {
      return;
    }
    if (!wish?.caseKey || Date.now() - Number(wish.at || 0) > 120_000) return;
    if (HOF.datasetKey && wish.key && HOF.datasetKey !== wish.key) return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      stop();
      setTimeout(() => HOF.revealRecord?.(wish.caseKey, { tab: wish.tab || "" }), 150);
    };
    const has = data => (data?.rows || []).some(row => row.__hofKey === wish.caseKey);
    const stop = HOF.on("rows", data => has(data) && go());
    if (has(HOF.data)) go();
    setTimeout(() => {
      if (done) return;
      stop();
      done = true;
      HOF.revealRecord?.(wish.caseKey, { tab: wish.tab || "" });
    }, 20_000);
  }

  HOF.whenReady(() => {
    load().catch(() => {});
    HOF.onDom(place);
    revealPending();
  });
  HOF.sessions = { load, select, rename, remove, openNew, section, pages: () => state?.sessions || [] };
})();
