/* DestekOfis — şirket seçici (v2.0.17).
 * Sol üstte "Şirket · 001 · Unvan ▾": her şirket ayrı veri tabanıdır (cari, Kasa, stok, taksit, çek/senet, fatura,
 * sayfalar hiçbiri öbür şirketten gelmez). Seçim kişiye özeldir ve sunucuda saklanır; başka bilgisayarları
 * değiştirmez. Yeni şirket açmak, ad/kod değiştirmek, yetki vermek, veriyi sıfırlamak ve silmek Yönetim → Şirketler'de. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const BUILDING = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/><path d="M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1"/></svg>';
  const CHEVRON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';

  let state = null; // { current, companies: [...], canManage, nextCode }
  let pending = null;
  let node = null;
  let warnNode = null;

  const canManage = () => Boolean(state?.canManage);
  // Şirket sınırı (kullanıcı kararı 05.10.2026: en fazla 2): sınırdayken "+ Yeni Şirket" hiç görünmez.
  const limitReason = () => (state?.limit && !state.limit.canCreate ? state.limit.reason : "");
  // Bu sayfanın şirketi (v2.0.21): sunucudaki seçim başka pencereden değişmiş olabilir; kutu ve "Açık" işareti her zaman
  // bu pencerenin çalıştığı şirketi gösterir (istekler de oraya gider).
  const isPage = item => (HOF.companyId ? item.id === HOF.companyId : item.current);
  const current = () => state?.companies.find(isPage) || state?.companies.find(item => item.current) || state?.companies[0] || null;

  async function load() {
    if (!HOF.user) return null;
    if (!pending) {
      pending = HOF.api("/api/companies")
        .then(data => {
          state = data;
          HOF.company = current();
          render();
          return data;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  // ---------- Şirkete geçiş: açık pencereler, olay akışı ve önbellek şirketle birlikte sıfırlanır (sayfa yenilenir) ----------
  async function select(id) {
    const target = state?.companies.find(item => item.id === id);
    if (!target) return;
    if (isPage(target)) return closeMenu();
    const row = node?.querySelector(`[data-pick="${CSS.escape(id)}"]`);
    row?.classList.add("is-busy");
    node?.querySelectorAll("button").forEach(button => (button.disabled = true));
    try {
      await HOF.api("/api/companies/select", { method: "POST", body: { id } });
      sessionStorage.setItem("hof-flash", `“${target.label}” şirketine geçtiniz. Bu seçim yalnızca sizin ekranınızı değiştirir.`);
      location.reload();
    } catch (error) {
      node?.querySelectorAll("button").forEach(button => (button.disabled = false));
      row?.classList.remove("is-busy");
      HOF.toastError(error);
    }
  }

  // ---------- Yeni şirket (yönetici) ----------
  function openNew() {
    if (!canManage()) return;
    if (limitReason()) return HOF.toast(limitReason(), { type: "error" });
    closeMenu();
    HOF.formModal({
      title: "Yeni Şirket",
      eyebrow: "ŞİRKET",
      intro: "Yeni şirket sıfırdan açılır: cari, Kasa, stok, taksit, çek/senet, fatura ve sayfalar boştur; hiçbir şey öbür şirketten gelmez. Lisans ve kullanıcılar ortaktır.",
      fields: [
        { name: "code", label: "Şirket Kodu", value: state?.nextCode || "", maxlength: 3, required: true, help: "Üç hane (001, 002…); seçicide ve raporlarda “kod · unvan” olarak görünür." },
        { name: "name", label: "Unvan", maxlength: 120, required: true, autofocus: true, placeholder: "Ör. Demir İnşaat Ltd. Şti." },
      ],
      submitLabel: "Şirketi Aç ve Geç",
      onSubmit: async values => {
        const result = await HOF.api("/api/companies", { method: "POST", body: { code: values.code, name: values.name, select: true } });
        sessionStorage.setItem("hof-flash", `“${result.company.label}” şirketi açıldı ve seçildi.`);
        location.reload();
      },
    });
  }

  // ---------- Seçici ----------
  function menuHtml() {
    const rows = state.companies
      .map(
        item => `<li class="hof-session-row${isPage(item) ? " is-current" : ""}">
          <button type="button" class="hof-session-pick" role="menuitemradio" aria-checked="${isPage(item)}" data-pick="${esc(item.id)}">
            <span class="hof-session-dot" aria-hidden="true"></span>
            <span class="hof-session-info"><b title="${esc(item.label)}">${esc(item.label)}</b><small>${item.root ? "İlk Şirket" : "Şirket"}</small></span>
            ${isPage(item) ? '<span class="hof-session-now">Açık</span>' : ""}
          </button>
        </li>`,
      )
      .join("");
    return `<p class="hof-session-menu-title">Şirketler</p>
      <ul class="hof-session-list" role="menu">${rows}</ul>
      ${canManage() ? `<div class="hof-session-foot">${limitReason() ? "" : '<button type="button" class="hof-session-new" data-new>+ Yeni Şirket</button>'}<a class="hof-session-manage" href="/admin.html#companies" data-manage>Şirketleri Yönet</a></div>` : ""}
      <p class="hof-session-note">Her şirketin verisi ayrıdır; seçim yalnızca sizin ekranınızı değiştirir.</p>`;
  }

  function place() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || !node) return;
    const nav = [...sidebar.children].find(child => child.tagName === "NAV");
    if (nav) {
      if (node.parentNode !== sidebar || node.nextElementSibling !== (warnNode || nav)) sidebar.insertBefore(node, nav);
    } else if (node.parentNode !== sidebar) sidebar.prepend(node);
    if (warnNode && node.nextElementSibling !== warnNode) node.after(warnNode);
    sidebar.classList.add("hof-has-session");
    syncCard();
  }
  // Sol alttaki senkron kartı: üstüne "001 · Unvan" satırı (paketin kendi düğümlerine dokunmadan).
  function syncCard() {
    const card = document.querySelector(".sidebar-bottom .sync-card");
    const company = current();
    if (!card || !company) return;
    let line = card.querySelector(".hof-company-line");
    if (!line) {
      line = HOF.el("p", { class: "hof-company-line" });
      card.prepend(line);
    }
    if (line.textContent !== company.label) line.textContent = company.label;
  }

  function render() {
    const company = current();
    if (!company) return;
    if (!node) {
      node = HOF.el("div", { id: "hof-company", class: "hof-session hof-company" });
      node.addEventListener("click", onClick);
      node.addEventListener("keydown", onKey);
    }
    const open = node.classList.contains("is-open");
    // v2.0.20 (kullanıcı: "kaç şirket var yazan yeşil sayı kafa karıştırıyor"): şirket sayısı rozeti yok; şirketler açılır listede.
    node.innerHTML = `<button type="button" class="hof-session-current" data-toggle aria-haspopup="menu" aria-expanded="${open}" aria-controls="hof-company-menu" title="Şirket değiştir">
        <span class="hof-session-icon">${BUILDING}</span>
        <span class="hof-session-text"><small>Şirket</small><strong title="${esc(company.label)}">${esc(company.label)}</strong></span>
        <span class="hof-session-chevron">${CHEVRON}</span>
      </button>
      <div class="hof-session-menu" id="hof-company-menu" ${open ? "" : "hidden"}>${menuHtml()}</div>`;
    renderWarning(company);
    place();
    if (open) positionMenu();
  }
  // Açık şirket başka bir şirketle aynı veri dosyasını kullanıyorsa (v2.0.21) şirket kutusunun altında uyarı.
  function renderWarning(company) {
    const group = (state?.conflicts || []).find(item => item.companies.some(member => member.id === company.id));
    if (!group) {
      warnNode?.remove();
      warnNode = null;
      return;
    }
    if (!warnNode) warnNode = HOF.el("p", { id: "hof-company-warn", class: "hof-company-warn", role: "alert" });
    const others = group.companies.filter(item => item.id !== company.id).map(item => esc(item.label)).join(", ");
    warnNode.innerHTML = `<b>Dikkat:</b> bu şirket ${others} ile aynı veri dosyasını kullanıyor; kayıtlar ortak. ${canManage() ? '<a href="/admin.html#companies">Şirketler\'de Ayır</a>' : "Yöneticinize bildirin."}`;
  }

  function positionMenu() {
    const menu = node?.querySelector(".hof-session-menu");
    const button = node?.querySelector("[data-toggle]");
    if (!menu || !button || menu.hidden) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - rect.left - 12);
    const top = rect.bottom + 6;
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.top = `${top}px`;
    menu.style.width = `${Math.max(240, width)}px`;
    menu.style.maxHeight = `${Math.max(200, window.innerHeight - top - 12)}px`;
  }
  window.addEventListener("resize", () => node?.classList.contains("is-open") && positionMenu());
  document.addEventListener(
    "scroll",
    event => {
      if (node?.classList.contains("is-open") && event.target instanceof Element && event.target.contains(node) && !node.contains(event.target)) closeMenu();
    },
    true,
  );

  function openMenu() {
    if (!node) return;
    node.classList.add("is-open");
    node.querySelector("[data-toggle]").setAttribute("aria-expanded", "true");
    node.querySelector(".hof-session-menu").hidden = false;
    positionMenu();
    (node.querySelector(".hof-session-row.is-current .hof-session-pick") || node.querySelector(".hof-session-pick"))?.focus();
    load();
  }
  function closeMenu({ focus = false } = {}) {
    if (!node || !node.classList.contains("is-open")) return;
    node.classList.remove("is-open");
    render();
    if (focus) node.querySelector("[data-toggle]")?.focus();
  }
  function onClick(event) {
    const target = event.target.closest("button, a");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-toggle")) {
      if (node.classList.contains("is-open")) closeMenu();
      else openMenu();
    } else if (target.dataset.pick) select(target.dataset.pick);
    else if (target.hasAttribute("data-new")) openNew();
  }
  function onKey(event) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeMenu({ focus: true });
  }
  document.addEventListener("mousedown", event => {
    if (node?.classList.contains("is-open") && !node.contains(event.target)) closeMenu();
  });

  // ---------- Canlı değişiklikler: şirket silindi / adı değişti / yetki değişti ----------
  HOF.on("live:workspace.changed", change => {
    if (change?.kind !== "companies") return;
    const before = current()?.id;
    load().then(data => {
      if (data && before && data.current !== before) {
        sessionStorage.setItem("hof-flash", "Çalıştığınız şirket yönetici tarafından kaldırıldı ya da yetkiniz değişti; ilk şirkete geçildi.");
        location.reload();
      }
    }, () => {});
  });
  HOF.on("live:resync", () => load().catch(() => {}));

  HOF.whenReady(() => {
    load().catch(() => {});
    HOF.onDom(place);
  });
  HOF.companies = { load, select, openNew, current };
})();
