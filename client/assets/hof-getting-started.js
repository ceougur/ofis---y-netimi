/* DestekOfis — Başlarken (2.4.4, iş listesi 16 / KÖ3).
 * Yeni kurulumda yöneticiye ilk adımlar listesi: Şirket Adı, Firma Bilgileri, Fatura Ayarları, İlk Banka Hesabı, İlk Cari. Her adımın durumu
 * sunucuda VERİDEN hesaplanır (/api/workspace/getting-started; elle işaretlenmez); her adımın kısa yolu ilgili pencereyi açar.
 * - Kendiliğinden yalnız açılış ekranında (#hof-start, kartın üstünde) görünür: yönetici + gizlenmemiş + eksik adım var + şirket "zaten kurulu"
 *   değil (2.4.3'ten gelen, verisi dolu şirket listeyle karşılaşmaz). Otomatik pencere açılmaz (çalışan işi kesmez).
 * - "Gizle" kişi + şirket başına sunucuda saklanır; liste kullanıcı menüsündeki ve Hızlı Arama'daki "Başlarken"den her zaman yeniden açılır.
 * - Yetkisiz kullanıcı (yönetici olmayan) listeyi ve ayar adımlarını görmez; sunucu da boş döner. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const PERMISSION = "system.manage";
  const STEP_TITLES = Object.freeze({
    company: "Şirket Adını Yazın",
    seller: "Firma Bilgilerini Girin",
    invoiceSettings: "Fatura Ayarlarını Kaydedin",
    bank: "İlk Banka Hesabını Açın",
    account: "İlk Cariyi Açın",
  });
  const STEP_HELP = Object.freeze({
    company: "Ekranlarda, yedeklerde ve raporlarda görünen ad. Kurulumda “Şirket 1” gelir.",
    seller: "Unvan, VKN / TCKN, vergi dairesi ve il. Faturanın üstüne basılır.",
    invoiceSettings: "Belge türü, numara serileri ve varsayılan KDV. Bir kez gözden geçirip kaydedin.",
    bank: "Havale, EFT ve POS tahsilatları banka hesabına yazılır. Kurulum Sihirbazı yol gösterir.",
    account: "Müşteri ve tedarikçilerinizi tek tek ya da Excel / Sheets'ten yükleyin.",
  });
  const ACTION_LABELS = Object.freeze({
    company: "Şirketleri Aç",
    seller: "Fatura Ayarlarını Aç",
    invoiceSettings: "Fatura Ayarlarını Aç",
    bank: "Banka Hesaplarını Aç",
    account: "+ Yeni Cari",
  });
  // Kısa yolun istediği yetki (salt okunur lisansta yazma yetkileri düşer → düğme yerine açıklama).
  const ACTION_PERMISSIONS = Object.freeze({ company: "system.manage", seller: "invoices.settings", invoiceSettings: "invoices.settings", bank: "bank.accounts", account: "accounts.manage" });
  let state = null; // sunucunun son yanıtı; null = henüz okunmadı
  let failed = false; // son okuma başarısız (ders 4: "bilinmiyor", boş liste değil)
  let request = 0;
  let modal = null;
  let refreshTimer = 0;

  const allowed = () => HOF.can(PERMISSION);
  async function load() {
    if (!allowed()) {
      state = null;
      render();
      return null;
    }
    const mine = ++request;
    try {
      const next = await HOF.api("/api/workspace/getting-started");
      if (mine !== request) return state;
      state = next;
      failed = false;
    } catch {
      if (mine !== request) return state;
      failed = true;
    }
    render();
    return state;
  }
  const refreshSoon = (delay = 400) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(load, delay);
  };

  // ---------- Kısa yollar ----------
  async function openInvoiceSettings() {
    if (!HOF.invoices?.open) return;
    await HOF.invoices.open();
    // Fatura penceresinin üst satırındaki "Fatura Ayarları" düğmesi (hof-invoices.js; ayar ekranı yalnız oradan açılır).
    const button = document.querySelector('.hof-invoices-modal [data-act="settings"]');
    if (button) button.click();
    else HOF.toast("Fatura Ayarları açılamadı: fatura penceresinin üst satırındaki “Fatura Ayarları” düğmesini kullanın.", { type: "error" });
  }
  const ACTIONS = {
    company: () => window.location.assign("/admin.html#companies"),
    seller: openInvoiceSettings,
    invoiceSettings: openInvoiceSettings,
    bank: () => HOF.bank?.open?.({ tab: "accounts" }),
    account: () => HOF.accounts?.newFor?.({}),
  };
  async function runStep(id) {
    modal?.close();
    try {
      await ACTIONS[id]?.();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function setHidden(hidden) {
    try {
      state = await HOF.api("/api/workspace/getting-started", { method: "POST", body: { hidden } });
      failed = false;
      render();
      if (hidden) HOF.toast("Başlarken listesi gizlendi. Kullanıcı menüsündeki “Başlarken”den yeniden açabilirsiniz.", { type: "info", timeout: 7000 });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Görünüm ----------
  const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';
  function stepHtml(step) {
    const id = step.id;
    const can = HOF.can(ACTION_PERMISSIONS[id]);
    const status = step.done ? '<span class="hof-gs-status is-done">Tamamlandı</span>' : '<span class="hof-gs-status">Eksik</span>';
    const action = step.done ? "" : can ? `<button type="button" class="hof-button hof-button-small${id === "seller" || id === "company" ? "" : " hof-button-ghost"}" data-gs-step="${esc(id)}">${esc(ACTION_LABELS[id])}</button>` : '<small class="hof-gs-noperm">Bu adım için yetkiniz yok (salt okunur lisansta ayarlar değiştirilemez).</small>';
    return `<li class="hof-gs-step${step.done ? " is-done" : ""}" data-gs="${esc(id)}" data-done="${step.done ? "1" : "0"}">
        <span class="hof-gs-mark" aria-hidden="true">${step.done ? CHECK : ""}</span>
        <span class="hof-gs-text"><b>${esc(STEP_TITLES[id] || id)}</b><small>${esc(STEP_HELP[id] || "")}</small></span>
        <span class="hof-gs-side">${status}${action}</span>
      </li>`;
  }
  function listHtml({ inModal = false } = {}) {
    if (failed && !state) return '<p class="hof-gs-unknown" data-gs-unknown>Adımların durumu okunamadı (bilinmiyor). Pencereyi kapatıp yeniden açın.</p>';
    if (!state) return '<p class="hof-empty">Yükleniyor…</p>';
    const steps = state.steps || [];
    const progress = `${steps.length} adımdan ${state.done} tanesi tamamlandı.`;
    const foot = inModal
      ? state.complete
        ? '<p class="hof-gs-note">Bütün adımlar tamamlandı. Liste açılış ekranında artık görünmez.</p>'
        : state.established
          ? '<p class="hof-gs-note">Bu şirket önceki sürümden kurulu geldiği için liste açılış ekranında kendiliğinden görünmez; buradan izleyebilirsiniz.</p>'
          : state.hidden
            ? '<div class="hof-gs-foot"><p class="hof-gs-note">Liste açılış ekranında gizli.</p><button type="button" class="hof-button hof-button-small hof-button-ghost" data-gs-show>Açılış Ekranında Göster</button></div>'
            : '<div class="hof-gs-foot"><p class="hof-gs-note">Adımlar tamamlandıkça liste kendiliğinden güncellenir.</p><button type="button" class="hof-button hof-button-small hof-button-ghost" data-gs-hide>Gizle</button></div>'
      : '<div class="hof-gs-foot"><p class="hof-gs-note">Gizlerseniz kullanıcı menüsündeki “Başlarken”den yeniden açarsınız.</p><button type="button" class="hof-button hof-button-small hof-button-ghost" data-gs-hide>Gizle</button></div>';
    return `<p class="hof-gs-progress" data-gs-progress="${state.done}/${steps.length}">${esc(progress)}</p>
      <ol class="hof-gs-steps">${steps.map(stepHtml).join("")}</ol>${foot}`;
  }
  function wire(root) {
    if (!root || root.dataset.gsWired) return;
    root.dataset.gsWired = "1";
    root.addEventListener("click", event => {
      const step = event.target.closest("[data-gs-step]");
      if (step) return runStep(step.dataset.gsStep);
      if (event.target.closest("[data-gs-hide]")) return setHidden(true);
      if (event.target.closest("[data-gs-show]")) return setHidden(false);
    });
  }

  // Açılış ekranında: #hof-start'ın içinde, kartın ÜSTÜNDE (kartın başlığı ve yükleme alanı değişmez). Başlık h3: açılış ekranının tek h2'si
  // kartın başlığı kalır ("#hof-start h2" ona işaret eder).
  function renderInline() {
    const start = document.getElementById("hof-start");
    let section = document.getElementById("hof-getting-started");
    const visible = Boolean(start) && allowed() && state?.show === true;
    if (!visible) {
      section?.remove();
      return;
    }
    if (!section) {
      section = HOF.el("section", { id: "hof-getting-started", class: "hof-gs", "aria-labelledby": "hof-gs-title" });
      wire(section);
    }
    const html = `<div class="hof-gs-head"><h3 id="hof-gs-title">Başlarken</h3><small>Programı kullanmaya başlamadan önce şirketinizin temel bilgilerini girin.</small></div>${listHtml()}`;
    if (section.dataset.html !== html) {
      section.dataset.html = html;
      HOF.swap(section, html);
    }
    if (section.parentNode !== start || start.firstElementChild !== section) start.prepend(section);
  }
  function renderModal() {
    if (!modal) return;
    const root = modal.dialog.querySelector("[data-gs-modal]");
    if (root) HOF.swap(root, listHtml({ inModal: true }));
  }
  function render() {
    renderInline();
    renderModal();
  }

  function openModal() {
    if (!allowed()) return HOF.toast("Başlarken listesi yöneticiye açıktır.", { type: "error" });
    if (modal) return;
    modal = HOF.modal({
      title: "Başlarken",
      eyebrow: "İLK ADIMLAR",
      body: '<div class="hof-gs hof-gs-in-modal" data-gs-modal></div>',
      onClose: () => {
        modal = null;
      },
    });
    modal.dialog.classList.add("hof-gs-modal");
    wire(modal.dialog.querySelector("[data-gs-modal]"));
    renderModal();
    load();
  }

  // Kullanıcı menüsünde (Profil · Parola · Yönetim · Çıkış) yalnız yöneticiye "Başlarken" girişi.
  // Kullanıcı kutusu (hof-workspace.js renderUser) yetki/profil değişince yeniden çizilir; çizimden sonra giriş yeniden eklenir.
  let watchedUser = null;
  function renderMenuEntry() {
    const user = document.querySelector("#hof-sidecard .hof-user");
    if (user && user !== watchedUser) {
      watchedUser = user;
      new MutationObserver(() => renderMenuEntry()).observe(user, { childList: true });
    }
    const menu = user?.querySelector(".hof-user-menu");
    if (!menu) return;
    const entry = menu.querySelector('[data-action="gettingStarted"]');
    if (!allowed()) {
      entry?.remove();
      return;
    }
    if (entry) return;
    const button = HOF.el("button", { type: "button", "data-action": "gettingStarted" }, "Başlarken");
    const logout = menu.querySelector('[data-action="logout"]');
    menu.insertBefore(button, logout || null);
  }
  document.addEventListener("click", event => {
    if (event.target.closest?.('#hof-sidecard [data-action="gettingStarted"]')) openModal();
  });

  HOF.search?.register(() => (allowed() ? [{ group: "Ayar", label: "Başlarken", path: "İlk Adımlar", keywords: ["İlk Kurulum", "Kurulum Listesi", "Firma Bilgileri", "İlk Banka Hesabı"], run: openModal }] : []));

  // Adımın verisi değişince (fatura ayarı, banka hesabı, cari, şirket adı) liste yenilenir: bu penceredeki yazımlar (ledger:changed),
  // başka bilgisayardaki yazımlar (canlı olay) ve bir pencere kapanınca (ayar penceresinde Kaydet'ten sonra).
  HOF.on("ledger:changed", () => refreshSoon());
  HOF.on("live:workspace.changed", () => refreshSoon(800));
  HOF.on("live:resync", () => refreshSoon(800));
  HOF.on("settings", () => refreshSoon(800));
  HOF.on("user-changed", () => {
    renderMenuEntry();
    load();
  });
  let modalsOpen = 0;
  HOF.whenReady(() => {
    load();
    HOF.onDom(() => {
      renderMenuEntry();
      renderInline();
      const open = document.querySelectorAll(".hof-modal-backdrop").length;
      if (open < modalsOpen && allowed()) refreshSoon(300);
      modalsOpen = open;
    });
  });
  HOF.gettingStarted = { open: openModal, refresh: load, state: () => state };
})();
