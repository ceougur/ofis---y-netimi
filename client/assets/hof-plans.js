/* DestekOfis — Taksitler (v2.0.4): Operasyon Merkezi'ndeki kalıcı modül.
 * Tek pencere, iki görünüm: LİSTE (süzgeçler: durum, grup › alt grup, arama; göstergeler; kartlar) ve KART (ad, telefon,
 * not, göstergeler; taksitler; hareketler). Kartın üstündeki düğmeler: + Tahsilat, − Ödeme/İade, + Taksit, Otomatik dağıt,
 * Ekstre PDF, WhatsApp, Düzenle, Sil. Kayıt açılırken taksit sorulmaz; istenirse sonra dağıtılır ya da elle girilir.
 * Excel'den ilk yükleme: dosya tarayıcıda okunur (hof-excel-worker.js), başlıklar rollerle eşlenir, kullanıcı düzeltir.
 * Tahsilatlar Kasa'ya düşer; geciken taksitler tahsilat takvimine ve bildirimlere girer (server/routes/plans.mjs). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const pad2 = value => String(value).padStart(2, "0");
  const todayIso = () => {
    const date = new Date();
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };
  const amountText = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const STATUS_TABS = [
    { id: "active", label: "Devam eden" },
    { id: "overdue", label: "Geciken" },
    { id: "done", label: "Biten" },
    { id: "closed", label: "Kapalı" },
    { id: "all", label: "Tümü" },
  ];
  const STATE = {
    overdue: ["Gecikti", "late"],
    active: ["Devam ediyor", "info"],
    done: ["Tamamlandı", "done"],
    closed: ["Kapalı", "muted"],
  };
  const ITEM_STATE = {
    paid: ["Ödendi", "done"],
    overdue: ["Gecikti", "late"],
    today: ["Bugün", "soon"],
    upcoming: ["Yaklaşıyor", "soon"],
    open: ["Bekliyor", "muted"],
    closed: ["Kapalı", "muted"],
  };
  const badge = (label, tone) => `<span class="hof-plan-badge is-${tone}">${esc(label)}</span>`;
  const itemBadge = item => {
    const [label, tone] = ITEM_STATE[item.state] || ITEM_STATE.open;
    return badge(item.partial && item.state !== "paid" ? `Kısmen · ${label}` : label, tone);
  };
  const dayLabel = days => (days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : days === 1 ? "Yarın" : `${days} gün kaldı`);
  const whereText = plan => [plan.groupName, plan.subgroupName].filter(Boolean).join(" › ");
  const canManage = () => HOF.can("plans.manage");
  const canCollect = () => HOF.can("plans.collect");

  // Modülün görünen adı: Operasyon Merkezi'ndeki kalemle değişir ("Taksitler" → "Aidatlar", "Servis ücretleri"…).
  // İç anahtar (side.plans), yetkiler ve API adresleri değişmez; yalnızca kullanıcının gördüğü ad bu işlevden okunur.
  const moduleName = () => HOF.uiLabel?.("side.plans", "Taksitler") || "Taksitler";
  let modal = null;
  const SORT_KEY = "hof.plans.sort";
  const savedSort = () => {
    try {
      return localStorage.getItem(SORT_KEY) || "no";
    } catch {
      return "no";
    }
  };
  const view = { mode: "list", planId: "", q: "", group: "", subgroup: "", status: "active", sort: savedSort(), itemFilter: "all", entryFilter: "all", groups: [], list: null, plan: null };
  let listRequest = 0;

  // ---------- Veri ----------
  const loadGroups = async () => {
    try {
      view.groups = await HOF.api("/api/workspace/plans/groups");
    } catch {
      view.groups = [];
    }
  };
  async function loadList() {
    const ticket = ++listRequest;
    try {
      const data = await HOF.api(`/api/workspace/plans?${listQuery()}`);
      if (ticket !== listRequest) return;
      view.list = data;
      if (view.mode === "list") renderList();
    } catch (error) {
      if (ticket === listRequest && view.mode === "list") body().innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }
  async function loadPlan(id) {
    try {
      const plan = await HOF.api(`/api/workspace/plans/${encodeURIComponent(id)}`);
      // Başka bir karta geçilince taksit/hareket süzgeçleri sıfırlanır.
      if (id !== view.planId) {
        view.itemFilter = "all";
        view.entryFilter = "all";
      }
      view.plan = plan;
      view.planId = id;
      view.mode = "card";
      renderCard();
    } catch (error) {
      HOF.toastError(error);
      view.mode = "list";
      renderList();
      loadList();
    }
  }
  const applyPlan = data => {
    view.plan = data;
    if (view.mode === "card" && view.planId === data.id) renderCard();
    loadList();
    HOF.dues?.reloadSoon?.(300);
    HOF.emit("plans-changed");
  };

  // ---------- Pencere ----------
  const body = () => modal?.dialog.querySelector("[data-plans]");
  function open(planId = "") {
    if (!HOF.can("plans.view")) return HOF.toast(`${moduleName()} için yetkiniz yok.`, { type: "error" });
    if (modal) {
      if (planId) loadPlan(planId);
      return;
    }
    modal = HOF.modal({
      title: moduleName(),
      eyebrow: "OPERASYON",
      size: "wide",
      body: '<div class="hof-plans" data-plans><p class="hof-empty">Yükleniyor…</p></div>',
      onClose: () => {
        modal = null;
        view.mode = "list";
        view.planId = "";
      },
    });
    modal.dialog.classList.add("hof-plans-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("change", onChange);
    modal.dialog.addEventListener("input", onInput);
    // Klavye: listede satır odaktayken Enter kartı açar.
    modal.dialog.addEventListener("keydown", event => {
      const row = event.target.closest?.("tr[data-plan]");
      if (row && event.key === "Enter" && view.mode === "list") loadPlan(row.dataset.plan);
    });
    loadGroups().then(() => {
      if (planId) loadPlan(planId);
      else {
        renderList();
        loadList();
      }
    });
  }

  // ---------- PDF ve yazdırma ----------
  // PDF sunucuda hazırlanır (Türkçe harfler gömülü yazı tipiyle). "PDF" yeni sekmede açar (oradan kaydedilir),
  // "Yazdır" aynı PDF'i gizli bir çerçevede açıp tarayıcının yazdırma penceresini çağırır.
  let printFrame = null;
  function printPdf(url) {
    printFrame?.remove();
    const frame = HOF.el("iframe", { class: "hof-print-frame", title: "Yazdırma", "aria-hidden": "true", tabindex: "-1" });
    printFrame = frame;
    document.body.appendChild(frame);
    HOF.toast("Yazdırma hazırlanıyor…");
    frame.addEventListener(
      "load",
      () => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {
          window.open(url, "_blank", "noopener"); // tarayıcı çerçeveden yazdırmaya izin vermezse PDF yeni sekmede açılır
        }
      },
      { once: true },
    );
    frame.src = url;
  }
  const listQuery = () => new URLSearchParams({ q: view.q, group: view.group, subgroup: view.subgroup, status: view.status, sort: view.sort });
  const listPdfUrl = () => `/api/workspace/plans/liste.pdf?${listQuery()}&title=${encodeURIComponent(moduleName())}`;
  const cardPdfUrl = plan => `/api/workspace/plans/${encodeURIComponent(plan.id)}/ekstre.pdf`;
  const PDF_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  const PRINT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>';
  const outputButtons = (pdfUrl, scope) =>
    `<span class="hof-plan-output" role="group" aria-label="Dışa aktar"><a class="hof-button hof-button-small hof-button-ghost" href="${esc(pdfUrl)}" target="_blank" rel="noopener" data-pdf="${scope}" title="PDF olarak aç; oradan kaydedebilirsiniz">${PDF_ICON}PDF</a><button type="button" class="hof-button hof-button-small hof-button-ghost" data-print="${scope}" title="Yazıcıya gönder">${PRINT_ICON}Yazdır</button></span>`;

  // ---------- Liste ----------
  const SORT_OPTIONS = [
    ["no", "Sıra No"],
    ["name", "Ada göre"],
    ["due", "Vadeye göre (geciken önce)"],
    ["remaining", "Kalana göre (çoktan aza)"],
    ["registered", "Kayıt tarihine göre (yeni önce)"],
  ];
  const groupOptions = () => {
    const group = view.groups.find(item => item.id === view.group);
    const subs = group ? group.subgroups : [];
    return `<select data-filter="group" aria-label="Grup"><option value="">Tüm gruplar</option>${view.groups.map(item => `<option value="${esc(item.id)}" ${item.id === view.group ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>
      <select data-filter="subgroup" aria-label="Alt grup" ${subs.length ? "" : "disabled"}><option value="">${subs.length ? "Tüm alt gruplar" : "Alt grup"}</option>${subs.map(item => `<option value="${esc(item.id)}" ${item.id === view.subgroup ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>`;
  };
  const progress = totals => {
    const share = totals.total > 0 ? Math.max(0, Math.min(100, Math.round((totals.paid / totals.total) * 100))) : 0;
    return `<span class="hof-plan-progress" title="%${share} ödendi" aria-label="Yüzde ${share} ödendi"><i style="width:${share}%"></i></span>`;
  };
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const manage = canManage();
    const filtered = Boolean(view.q || view.group || view.subgroup);
    const row = plan => {
      const [label, tone] = STATE[plan.state] || STATE.active;
      const next = plan.next ? `${HOF.formatDate(plan.next.dueDate)}<small>${esc(plan.next.seq)}. taksit · ${esc(dayLabel(plan.next.days))}</small>` : plan.itemCount ? "<small>—</small>" : '<small class="is-warn">Taksit girilmemiş</small>';
      return `<tr data-plan="${esc(plan.id)}" class="is-${esc(plan.state)}" tabindex="0"><td class="hof-plan-no">${esc(plan.refNo || "")}</td><td><b>${esc(plan.name)}</b><small>${esc(whereText(plan) || "Grupsuz")}${plan.phone ? ` · ${esc(plan.phone)}` : ""}${plan.registeredOn ? ` · kayıt ${esc(HOF.formatDate(plan.registeredOn))}` : ""}</small>${plan.note ? `<small class="hof-plan-row-note" title="${esc(plan.note)}">${esc(plan.note)}</small>` : ""}</td><td class="num">${esc(money(plan.totals.total))}</td><td class="num hof-cash-in">${esc(money(plan.totals.paid))}${progress(plan.totals)}</td><td class="num${plan.totals.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(plan.totals.remaining))}</td><td>${next}</td><td>${badge(label, tone)}${plan.totals.overdueCount ? `<small>${plan.totals.overdueCount} taksit · ${esc(money(plan.totals.overdue))}</small>` : ""}</td></tr>`;
    };
    root.innerHTML = `<div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Durum">${STATUS_TABS.map(item => `<button type="button" data-status="${item.id}" aria-pressed="${String(item.id === view.status)}">${item.label}</button>`).join("")}</div>
      <div class="hof-cash-add">${manage ? '<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni kart</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import" title="Excel listesinden kartları ve grupları tek seferde oluştur">Excel’den yükle</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="groups">Gruplar</button>' : ""}</div></div>
      <div class="hof-plans-filters"><input type="search" data-filter="q" value="${esc(view.q)}" placeholder="Ad, telefon, sıra no, not ara…" aria-label="Ara">${groupOptions()}<select data-filter="sort" aria-label="Sıralama">${SORT_OPTIONS.map(([id, label]) => `<option value="${id}" ${id === view.sort ? "selected" : ""}>${label}</option>`).join("")}</select>${outputButtons(listPdfUrl(), "list")}</div>
      <div class="hof-kpis hof-plans-kpis" data-kpis>${data ? `<div class="hof-cash-balance"><strong>${esc(money(data.totals.remaining))}</strong><span>Kalan alacak · ${data.totals.count} kart</span></div><div class="${data.totals.overdueCount ? "is-late" : ""}"><strong>${esc(money(data.totals.overdue))}</strong><span>Geciken · ${data.totals.overdueCount} taksit</span></div><div><strong>${esc(money(data.totals.month))}</strong><span>Bu ay beklenen</span></div><div><strong>${esc(money(data.totals.paid))}</strong><span>Tahsil edilen</span></div>` : ""}</div>
      <div class="hof-cash-list hof-plans-list" data-list>${
        !data
          ? '<p class="hof-empty">Yükleniyor…</p>'
          : data.plans.length
            ? `<table class="hof-table hof-cash-table hof-plans-table"><thead><tr><th class="hof-plan-no">No</th><th>Kart</th><th class="num">Toplam</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Sıradaki vade</th><th>Durum</th></tr></thead><tbody>${data.plans.map(row).join("")}</tbody></table>`
            : `<p class="hof-empty">${filtered || view.status !== "all" ? "Bu süzgeçte kart yok." : "Henüz taksit kartı yok."}${manage && !filtered ? " <b>+ Yeni kart</b> ile tek kart açın ya da <b>Excel’den yükle</b> ile listenizi bir kerede aktarın." : ""}</p>`
      }</div>
      <p class="hof-edit-meta">Satıra tıklayınca kart açılır. PDF ve Yazdır ekrandaki süzgeç ve sıralamayla hazırlanır. Kartın üstüne girilen tahsilatlar Kasa’ya düşer; vadesi gelen taksit tahsilat takviminde ve bildirimlerde görünür.</p>
      <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }

  // ---------- Kart ----------
  // Düzen: üstte kişi (ad, sıra no, durum, grup › alt grup, telefon, açan, taksit planı) ve bilgi notu; ardından
  // göstergeler; altta süzgeçli taksit listesi ve hareketler (tahsilat, ödeme/iade). İşlem çubuğu kaydırırken üstte kalır.
  const ITEM_FILTERS = [
    ["all", "Tümü", () => true],
    ["open", "Açık", item => item.remaining > 0.005],
    ["overdue", "Geciken", item => item.state === "overdue"],
    ["paid", "Ödenen", item => item.state === "paid"],
  ];
  const ENTRY_FILTERS = [
    ["all", "Tümü", () => true],
    ["in", "Tahsilat", entry => entry.kind === "in"],
    ["out", "Ödeme / iade", entry => entry.kind === "out"],
  ];
  const chips = (list, rows, current, attr) =>
    `<span class="hof-plan-chips" role="group">${list.map(([id, label, test]) => `<button type="button" ${attr}="${id}" aria-pressed="${String(id === current)}">${label} <b>${rows.filter(test).length}</b></button>`).join("")}</span>`;
  function renderCard() {
    const root = body();
    const plan = view.plan;
    if (!root || !plan) return;
    const manage = plan.canManage;
    const collect = plan.canCollect;
    const active = plan.status === "active";
    const [label, tone] = STATE[plan.state] || STATE.active;
    const t = plan.totals;
    const phone = HOF.workspace?.extractPhones?.(plan.phone || "")[0] || "";
    const itemTest = (ITEM_FILTERS.find(([id]) => id === view.itemFilter) || ITEM_FILTERS[0])[2];
    const entryTest = (ENTRY_FILTERS.find(([id]) => id === view.entryFilter) || ENTRY_FILTERS[0])[2];
    const items = plan.items.filter(itemTest);
    const entries = plan.entries.filter(entryTest);
    const itemRow = item => `<tr data-item="${esc(item.id)}" class="is-${esc(item.state)}"><td>${item.seq}.</td><td>${esc(HOF.formatDate(item.dueDate))}${item.note ? `<small>${esc(item.note)}</small>` : ""}<small>${item.state === "paid" ? "" : esc(dayLabel(item.days))}</small></td><td class="num">${esc(money(item.amount))}</td><td class="num hof-cash-in">${item.paid ? esc(money(item.paid)) : ""}</td><td class="num${item.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(item.remaining))}</td><td>${itemBadge(item)}</td><td class="hof-cash-actions">${collect && item.remaining > 0 && active ? `<button type="button" class="hof-mini hof-mini-pay" data-pay-item="${esc(item.id)}" title="Bu taksite tahsilat gir" aria-label="${item.seq}. taksite tahsilat gir">₺</button>` : ""}${manage ? `<button type="button" class="hof-mini" data-edit-item="${esc(item.id)}" title="Taksiti düzelt" aria-label="${item.seq}. taksiti düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-item="${esc(item.id)}" title="Taksiti sil" aria-label="${item.seq}. taksiti sil">×</button>` : ""}</td></tr>`;
    const entryRow = entry => `<tr data-entry="${esc(entry.id)}" data-kind="${esc(entry.kind)}"><td>${esc(HOF.formatDate(entry.date))}</td><td><b>${entry.kind === "in" ? "Tahsilat" : "Ödeme / iade"}${entry.itemId ? ` · ${esc(plan.items.find(item => item.id === entry.itemId)?.seq || "?")}. taksit` : ""}${entry.receiptNo ? ` <span class="hof-plan-receipt">Makbuz ${esc(entry.receiptNo)}</span>` : ""}</b><small>${esc(entry.note || "")}${entry.note ? " · " : ""}${esc(entry.actorName || "—")}${entry.updatedAt ? " · düzeltildi" : ""}</small></td><td class="num hof-cash-in">${entry.kind === "in" ? esc(money(entry.amount)) : ""}</td><td class="num hof-cash-out">${entry.kind === "out" ? esc(money(entry.amount)) : ""}</td><td class="hof-cash-actions"><a class="hof-mini hof-mini-text" href="/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(entry.id)}/makbuz.pdf" target="_blank" rel="noopener" title="Makbuz (PDF)" aria-label="Makbuz">Makbuz</a>${entry.editable ? `<button type="button" class="hof-mini" data-edit-entry="${esc(entry.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-entry="${esc(entry.id)}" title="Sil" aria-label="Sil">×</button>` : ""}</td></tr>`;
    const planWarning = Math.abs(t.unplanned) > 0.005 && plan.items.length ? `<p class="hof-alert">Taksitlerin toplamı (${esc(money(t.planned))}) kartın toplam tutarından (${esc(money(t.total))}) ${t.unplanned > 0 ? "az" : "fazla"}: fark ${esc(money(Math.abs(t.unplanned)))}. Taksitleri düzeltin ya da toplam tutarı güncelleyin.</p>` : "";
    const noItems = !plan.items.length ? `<p class="hof-empty">Bu kartta taksit yok. ${manage ? "<b>Otomatik dağıt</b> ile toplamı eşit taksitlere bölün ya da <b>+ Taksit</b> ile tek tek girin." : ""}${t.paid ? ` Girilen tahsilatlar kalan tutardan düşülür (kalan ${esc(money(t.remaining))}).` : ""}</p>` : '<p class="hof-empty">Bu süzgeçte taksit yok.</p>';
    const span = plan.items.length ? `${plan.items.length} taksit · ${HOF.formatDate(plan.items[0].dueDate)} – ${HOF.formatDate(plan.items.at(-1).dueDate)}` : "Taksit kurulmadı";
    const share = t.total > 0 ? Math.max(0, Math.min(100, Math.round((t.paid / t.total) * 100))) : 0;
    const sums = entries.reduce((sum, entry) => ({ in: sum.in + (entry.kind === "in" ? entry.amount : 0), out: sum.out + (entry.kind === "out" ? entry.amount : 0) }), { in: 0, out: 0 });
    root.innerHTML = `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${plan.refNo ? `<span class="hof-plan-refno" title="Sıra No">No ${esc(plan.refNo)}</span>` : ""}${esc(plan.name)} ${badge(label, tone)}</h3><small>${esc(whereText(plan) || "Grupsuz")}${plan.phone ? ` · ${esc(plan.phone)}` : ""}</small></div></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Kart işlemleri">
          <span class="hof-plan-toolgroup">${collect && active ? '<button type="button" class="hof-button hof-button-small" data-act="pay">+ Tahsilat</button>' : ""}${manage && active ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="refund" title="Müşteriye yapılan ödeme ya da iade">− Ödeme / iade</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="addItem">+ Taksit</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="distribute" title="Toplam tutarı eşit taksitlere böler">Otomatik dağıt</button>' : ""}</span>
          <span class="hof-plan-toolgroup">${outputButtons(cardPdfUrl(plan), "card")}${phone ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}</span>
          ${manage ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button>${active ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="close" title="Kart kapanır; uyarı vermez, listede Kapalı altında durur">Kapat</button>' : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="reopen">Yeniden aç</button>'}<button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-act="delete">Sil</button></span>` : ""}
        </div></div>
      <section class="hof-plan-profile" aria-label="Kişi bilgileri">
        <dl class="hof-plan-facts">
          <div><dt>Sıra No</dt><dd>${esc(plan.refNo || "—")}</dd></div>
          <div><dt>Grup</dt><dd>${esc(plan.groupName || "—")}</dd></div>
          <div><dt>Alt grup</dt><dd>${esc(plan.subgroupName || "—")}</dd></div>
          <div><dt>Telefon</dt><dd>${plan.phone ? `${phone ? `<a href="tel:+${esc(phone)}">${esc(plan.phone)}</a>` : esc(plan.phone)}` : "—"}</dd></div>
          <div><dt>Taksit planı</dt><dd>${esc(span)}</dd></div>
          <div><dt>Kayıt tarihi</dt><dd>${esc(plan.registeredOn ? HOF.formatDate(plan.registeredOn) : "—")}</dd></div>
          <div><dt>Kartı açan</dt><dd>${esc(plan.actorName || "—")} · ${esc(HOF.formatDate(plan.createdAt))}</dd></div>
        </dl>
        <div class="hof-plan-note"><h4>Bilgi notu</h4>${plan.note ? `<p>${esc(plan.note)}</p>` : `<p class="hof-empty">Not yok.${manage ? " <b>Düzenle</b> ile adres, okul, sınıf gibi bilgileri ekleyin." : ""}</p>`}</div>
      </section>
      <div class="hof-kpis hof-plans-kpis"><div><strong>${esc(money(t.total))}</strong><span>Toplam tutar</span></div><div><strong class="hof-cash-in">${esc(money(t.paid))}</strong><span>Tahsil edilen · %${share}${t.paidOut ? ` · iade ${esc(money(t.paidOut))}` : ""}</span></div><div class="hof-cash-balance"><strong>${esc(money(t.remaining))}</strong><span>Kalan${t.extra ? ` · fazla ${esc(money(t.extra))}` : ""}</span></div><div class="${t.overdueCount ? "is-late" : ""}"><strong>${esc(money(t.overdue))}</strong><span>Geciken · ${t.overdueCount} taksit</span></div></div>
      <span class="hof-plan-progress hof-plan-progress-wide" aria-hidden="true"><i style="width:${share}%"></i></span>
      ${planWarning}
      <div class="hof-plan-section"><h4>Taksitler <span>${plan.items.length}</span></h4>${plan.items.length ? chips(ITEM_FILTERS, plan.items, view.itemFilter, "data-item-filter") : ""}</div>
      <div class="hof-cash-list hof-plans-items">${items.length ? `<table class="hof-table hof-cash-table hof-plan-items"><thead><tr><th>No</th><th>Vade</th><th class="num">Tutar</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${items.map(itemRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num">${esc(money(items.reduce((sum, item) => sum + item.amount, 0)))}</td><td class="num hof-cash-in">${esc(money(items.reduce((sum, item) => sum + item.paid, 0)))}</td><td class="num hof-cash-out">${esc(money(items.reduce((sum, item) => sum + item.remaining, 0)))}</td><td colspan="2"></td></tr></tfoot></table>` : noItems}</div>
      <div class="hof-plan-section"><h4>Hareketler <span>${plan.entries.length}</span></h4>${plan.entries.length ? chips(ENTRY_FILTERS, plan.entries, view.entryFilter, "data-entry-filter") : ""}</div>
      <div class="hof-cash-list hof-plans-entries">${entries.length ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Tahsilat</th><th class="num">Ödeme</th><th></th></tr></thead><tbody>${entries.map(entryRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num hof-cash-in">${esc(money(sums.in))}</td><td class="num hof-cash-out">${esc(money(sums.out))}</td><td></td></tr></tfoot></table>` : plan.entries.length ? '<p class="hof-empty">Bu süzgeçte hareket yok.</p>' : '<p class="hof-empty">Henüz hareket yok. Tahsilat girildiğinde burada ve Kasa’da görünür; her tahsilatın makbuzu PDF olarak alınır.</p>'}</div>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Listeye dön</button><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }

  // ---------- Formlar ----------
  const groupFields = (plan = {}) => {
    const groups = view.groups;
    const subgroups = plan.groupId ? groups.find(item => item.id === plan.groupId)?.subgroups || [] : [];
    return [
      { name: "groupId", label: "Grup", type: "select", value: plan.groupId || "", options: [{ value: "", label: "— Grupsuz —" }, ...groups.map(item => ({ value: item.id, label: item.name })), { value: "\u0001yeni", label: "+ Yeni grup yaz…" }], help: "Ör. servis plakası, site adı, sınıf. Gruplar penceresinden de yönetilir." },
      { name: "groupName", label: "Yeni grup adı", placeholder: "Ör. 42 C 1070", maxlength: 80 },
      { name: "subgroupId", label: "Alt grup", type: "select", value: plan.subgroupId || "", options: [{ value: "", label: "— Yok —" }, ...subgroups.map(item => ({ value: item.id, label: item.name })), { value: "\u0001yeni", label: "+ Yeni alt grup yaz…" }], help: "Ör. güzergâh, blok, şube." },
      { name: "subgroupName", label: "Yeni alt grup adı", placeholder: "Ör. 15 Temmuz", maxlength: 80 },
    ];
  };
  // Grup seçimi değişince alt grup listesi yenilenir; "Yeni … yaz" seçilince ad kutusu görünür.
  const wireGroupFields = dialog => {
    const groupSelect = dialog.querySelector('select[name="groupId"]');
    const subSelect = dialog.querySelector('select[name="subgroupId"]');
    const groupName = dialog.querySelector('input[name="groupName"]').closest(".hof-field");
    const subName = dialog.querySelector('input[name="subgroupName"]').closest(".hof-field");
    const sync = () => {
      groupName.hidden = groupSelect.value !== "\u0001yeni";
      const group = view.groups.find(item => item.id === groupSelect.value);
      const subs = group ? group.subgroups : [];
      const current = subSelect.value;
      subSelect.innerHTML = `<option value="">— Yok —</option>${subs.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}<option value="\u0001yeni">+ Yeni alt grup yaz…</option>`;
      subSelect.value = [...subSelect.options].some(option => option.value === current) ? current : "";
      subSelect.disabled = !groupSelect.value;
      subName.hidden = subSelect.value !== "\u0001yeni";
    };
    groupSelect.addEventListener("change", sync);
    subSelect.addEventListener("change", () => (subName.hidden = subSelect.value !== "\u0001yeni"));
    sync();
  };
  const groupBody = data => ({
    groupId: data.groupId === "\u0001yeni" ? "" : data.groupId,
    groupName: data.groupId === "\u0001yeni" ? data.groupName : "",
    subgroupId: data.subgroupId === "\u0001yeni" ? "" : data.subgroupId,
    subgroupName: data.subgroupId === "\u0001yeni" ? data.subgroupName : "",
  });

  function editPlan(plan) {
    HOF.formModal({
      title: plan ? "Kartı düzenle" : "Yeni taksit kartı",
      eyebrow: "TAKSİTLER",
      size: "wide",
      intro: plan ? "" : "Önce kişi ve toplam tutar kaydedilir. Taksitler istenirse sonra kartın üstünden dağıtılır ya da tek tek girilir.",
      fields: [
        { name: "name", label: "Ad Soyad / Kurum", required: true, maxlength: 160, value: plan?.name || "", autofocus: true },
        { name: "refNo", label: "Sıra No", maxlength: 30, value: plan?.refNo || "", placeholder: plan ? "" : "Boş bırakılırsa sıradaki numara", help: plan ? "" : "Listede ilk kolon ve varsayılan sıralama." },
        { name: "registeredOn", label: "Kayıt tarihi", type: "date", required: true, value: plan?.registeredOn || todayIso(), help: plan ? "" : "Kişinin kaydedildiği gün; bugün hazır gelir." },
        { name: "phone", label: "Telefon", type: "tel", inputmode: "tel", maxlength: 60, value: plan?.phone || "", placeholder: "05xx xxx xx xx" },
        { name: "total", label: "Toplam tutar (₺)", required: true, inputmode: "decimal", value: plan ? amountText(plan.total) : "", placeholder: "Örn. 12.000,00" },
        ...groupFields(plan || {}),
        { name: "note", label: "Bilgi notu", type: "textarea", rows: 3, maxlength: 1000, value: plan?.note || "", placeholder: "Adres, okul, sınıf, özel durum…" },
        ...(plan ? [] : [{ name: "auto", label: "Toplamı hemen eşit taksitlere böl", type: "checkbox", value: false }, { name: "count", label: "Taksit sayısı", inputmode: "numeric", value: "" }, { name: "firstDue", label: "İlk vade", type: "date", value: "" }]),
      ],
      submitLabel: plan ? "Kaydet" : "Kartı aç",
      onOpen: dialog => {
        dialog.classList.add("hof-plan-form");
        wireGroupFields(dialog);
        const auto = dialog.querySelector('input[name="auto"]');
        if (auto) {
          const count = dialog.querySelector('input[name="count"]').closest(".hof-field");
          const first = dialog.querySelector('input[name="firstDue"]').closest(".hof-field");
          const sync = () => {
            count.hidden = !auto.checked;
            first.hidden = !auto.checked;
          };
          auto.addEventListener("change", sync);
          sync();
        }
      },
      onSubmit: async data => {
        const payload = { name: data.name, refNo: data.refNo, registeredOn: data.registeredOn, phone: data.phone, total: data.total, note: data.note, ...groupBody(data) };
        if (!plan && data.auto) {
          if (!(Number(data.count) > 0) || !data.firstDue) throw new Error("Otomatik dağıtım için taksit sayısı ve ilk vade gerekli.");
          Object.assign(payload, { mode: "auto", count: data.count, firstDue: data.firstDue });
        }
        const result = plan ? await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "PUT", body: payload }) : await HOF.api("/api/workspace/plans", { method: "POST", body: payload });
        await loadGroups();
        HOF.toast(plan ? "Kart güncellendi." : "Taksit kartı açıldı.", { type: "success" });
        view.planId = result.id;
        view.mode = "card";
        applyPlan(result);
      },
    });
  }

  function distributePlan(plan) {
    const hasEntries = plan.entries.length > 0;
    HOF.formModal({
      title: "Otomatik dağıt",
      eyebrow: plan.name,
      intro: `Toplam tutar eşit taksitlere bölünür; her ay aynı gün, kuruş farkı son taksitte.${plan.items.length ? " <b>Mevcut taksitler silinir</b>; girilen tahsilatlar yeni taksitlere en eski vadeden başlayarak sayılır." : ""}`,
      fields: [
        { name: "total", label: "Toplam tutar (₺)", required: true, inputmode: "decimal", value: amountText(plan.total) },
        { name: "count", label: "Taksit sayısı", required: true, inputmode: "numeric", value: plan.items.length ? String(plan.items.length) : "", placeholder: "Örn. 9", autofocus: true },
        { name: "firstDue", label: "İlk vade", type: "date", required: true, value: plan.items[0]?.dueDate || todayIso() },
        { name: "everyMonths", label: "Taksit aralığı", type: "select", value: "1", options: [{ value: "1", label: "Her ay" }, { value: "2", label: "2 ayda bir" }, { value: "3", label: "3 ayda bir" }, { value: "6", label: "6 ayda bir" }, { value: "12", label: "Yılda bir" }] },
      ],
      submitLabel: plan.items.length ? "Taksitleri yeniden kur" : "Taksitleri kur",
      onSubmit: async data => {
        const result = await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/distribute`, { method: "POST", body: data });
        HOF.toast(`${result.items.length} taksit kuruldu.${hasEntries ? " Tahsilatlar yeniden eşlendi." : ""}`, { type: "success" });
        applyPlan(result);
      },
    });
  }

  function editItem(plan, item) {
    HOF.formModal({
      title: item ? `${item.seq}. taksiti düzelt` : "Taksit ekle",
      eyebrow: plan.name,
      fields: [
        { name: "dueDate", label: "Vade", type: "date", required: true, value: item?.dueDate || (plan.items.length ? nextMonth(plan.items.at(-1).dueDate) : todayIso()) },
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: item ? amountText(item.amount) : "", autofocus: true },
        { name: "note", label: "Açıklama", maxlength: 200, value: item?.note || "", placeholder: "İsteğe bağlı (ör. servis farkı)" },
      ],
      submitLabel: item ? "Kaydet" : "Taksiti ekle",
      onSubmit: async data => {
        const url = `/api/workspace/plans/${encodeURIComponent(plan.id)}/items${item ? `/${encodeURIComponent(item.id)}` : ""}`;
        const result = await HOF.api(url, { method: item ? "PUT" : "POST", body: data });
        HOF.toast(item ? "Taksit düzeltildi." : "Taksit eklendi.", { type: "success" });
        applyPlan(result);
      },
    });
  }
  const nextMonth = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(Math.min(d, last))}`;
  };

  // kind: "in" (tahsilat) | "out" (ödeme/iade). item: taksite bağlı tahsilat. entry: düzeltme.
  function editEntry(plan, { kind = "in", item = null, entry = null, amount = null } = {}) {
    const incoming = (entry?.kind || kind) === "in";
    const openItems = plan.items.filter(row => row.remaining > 0.005 || row.id === entry?.itemId);
    const suggested = entry ? amountText(entry.amount) : amount ? amountText(amount) : item ? amountText(item.remaining) : plan.next ? amountText(plan.next.remaining) : "";
    HOF.formModal({
      title: entry ? (incoming ? "Tahsilatı düzelt" : "Ödemeyi düzelt") : incoming ? "Tahsilat gir" : "Ödeme / iade gir",
      eyebrow: plan.name,
      intro: incoming
        ? `Kalan ${money(plan.totals.remaining)}${plan.next ? ` · sıradaki ${plan.next.seq}. taksit ${money(plan.next.remaining)} (${dayLabel(plan.next.days)})` : ""}. Tutar Kasa’ya tahsilat olarak düşer; makbuz PDF’i hareketler listesinden alınır.`
        : "Müşteriye geri verilen ya da onun adına yapılan ödeme. Kasa’dan düşer ve kartın ödenen tutarını azaltır.",
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: suggested, autofocus: true },
        { name: "date", label: "Tarih", type: "date", required: true, value: entry?.date || todayIso() },
        ...(incoming ? [{ name: "itemId", label: "Hangi taksite", type: "select", value: entry?.itemId || item?.id || "", options: [{ value: "", label: "En eski açık taksite (önerilen)" }, ...openItems.map(row => ({ value: row.id, label: `${row.seq}. taksit · ${HOF.formatDate(row.dueDate)} · kalan ${money(row.remaining)}` }))] }] : []),
        { name: "note", label: "Açıklama", maxlength: 300, value: entry?.note || "", placeholder: incoming ? "Elden / havale / kart…" : "Ne için", list: incoming ? ["Elden", "Havale", "Kredi kartı", "EFT"] : ["İade", "Fazla alınan", "İndirim"] },
      ],
      submitLabel: entry ? "Kaydet" : incoming ? "Tahsilatı kaydet" : "Ödemeyi kaydet",
      onSubmit: async data => {
        const url = `/api/workspace/plans/${encodeURIComponent(plan.id)}/entries${entry ? `/${encodeURIComponent(entry.id)}` : ""}`;
        const result = await HOF.api(url, { method: entry ? "PUT" : "POST", body: { ...data, kind: entry?.kind || kind } });
        HOF.toast(entry ? "Hareket düzeltildi." : incoming ? `Tahsilat kaydedildi. Kalan ${money(result.totals.remaining)}.` : "Ödeme kaydedildi.", {
          type: "success",
          action: !entry && incoming && result.entryId ? { label: "Makbuz", onClick: () => window.open(`/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(result.entryId)}/makbuz.pdf`, "_blank", "noopener") } : undefined,
        });
        applyPlan(result);
        HOF.emit("payment-saved", { planId: plan.id });
      },
    });
  }

  async function deleteEntry(plan, entry) {
    const ok = await HOF.confirm({ title: "Hareketi sil", message: `${money(entry.amount)} tutarındaki ${entry.kind === "in" ? "tahsilat" : "ödeme"} silinecek; Kasa ve kart yeniden hesaplanır. Yönetim panelindeki Silinenler’den geri yüklenebilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" }));
      HOF.toast("Hareket silindi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deleteItem(plan, item) {
    const ok = await HOF.confirm({ title: "Taksiti sil", message: `${item.seq}. taksit (${money(item.amount)}, vade ${HOF.formatDate(item.dueDate)}) silinecek. Ona bağlı tahsilatlar en eski açık taksite sayılır.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/items/${encodeURIComponent(item.id)}`, { method: "DELETE" }));
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deletePlan(plan) {
    const ok = await HOF.confirm({ title: "Kartı sil", message: `“${plan.name}” kartı taksitleri ve hareketleriyle silinecek; hareketleri Kasa’dan düşer. Yönetim panelindeki Silinenler’den geri yüklenebilir.`, confirmLabel: "Kartı sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      HOF.toast("Kart silindi.", { type: "success" });
      view.mode = "list";
      view.planId = "";
      renderList();
      await loadGroups();
      loadList();
      HOF.dues?.reloadSoon?.(300);
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function setStatus(plan, status) {
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "PUT", body: { status } }));
      HOF.toast(status === "closed" ? "Kart kapatıldı; uyarı vermez." : "Kart yeniden açıldı.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Gruplar ----------
  function openGroups() {
    const groupsModal = HOF.modal({
      title: "Gruplar ve alt gruplar",
      eyebrow: "TAKSİTLER",
      body: '<p class="hof-modal-text">Grup: servis plakası, site, sınıf gibi ana başlık. Alt grup: güzergâh, blok, şube. Kartlar gruba ve alt gruba göre süzülür.</p><div class="hof-groups" data-groups></div><form class="hof-groups-add" data-add-group><input type="text" name="name" maxlength="80" placeholder="Yeni grup adı (ör. 42 C 1070)" aria-label="Yeni grup adı" required><button type="submit" class="hof-button hof-button-small">+ Grup ekle</button></form><div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>',
    });
    const render = () => {
      const host = groupsModal.dialog.querySelector("[data-groups]");
      host.innerHTML = view.groups.length
        ? view.groups.map(group => `<section class="hof-group"><header><b>${esc(group.name)}</b><small>${group.count} kart</small><span><button type="button" class="hof-mini" data-rename="${esc(group.id)}" title="Adı değiştir" aria-label="Adı değiştir">✎</button><button type="button" class="hof-mini hof-mini-danger" data-remove="${esc(group.id)}" title="Sil" aria-label="Sil">×</button></span></header>
            <ul>${group.subgroups.map(sub => `<li><span>${esc(sub.name)}</span><small>${sub.count} kart</small><span><button type="button" class="hof-mini" data-rename="${esc(sub.id)}" title="Adı değiştir" aria-label="Adı değiştir">✎</button><button type="button" class="hof-mini hof-mini-danger" data-remove="${esc(sub.id)}" title="Sil" aria-label="Sil">×</button></span></li>`).join("")}</ul>
            <form class="hof-groups-add" data-add-sub="${esc(group.id)}"><input type="text" name="name" maxlength="80" placeholder="Alt grup (ör. 15 Temmuz)" aria-label="Yeni alt grup adı" required><button type="submit" class="hof-button hof-button-small hof-button-ghost">+ Alt grup</button></form></section>`).join("")
        : '<p class="hof-empty">Henüz grup yok.</p>';
    };
    const findGroup = id => {
      for (const group of view.groups) {
        if (group.id === id) return { ...group, parent: null };
        const sub = group.subgroups.find(item => item.id === id);
        if (sub) return { ...sub, parent: group };
      }
      return null;
    };
    const refresh = async result => {
      view.groups = result?.groups || (await HOF.api("/api/workspace/plans/groups"));
      render();
      if (view.mode === "list") {
        renderList();
        loadList();
      }
    };
    groupsModal.dialog.addEventListener("submit", async event => {
      const form = event.target.closest("form[data-add-group], form[data-add-sub]");
      if (!form) return;
      event.preventDefault();
      const name = form.querySelector("input").value.trim();
      if (!name) return;
      try {
        await refresh(await HOF.api("/api/workspace/plans/groups", { method: "POST", body: { name, parentId: form.dataset.addSub || "" } }));
        form.reset();
      } catch (error) {
        HOF.toastError(error);
      }
    });
    groupsModal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-rename], [data-remove], [data-close]");
      if (!button) return;
      if ("close" in button.dataset) return groupsModal.close();
      const target = findGroup(button.dataset.rename || button.dataset.remove);
      if (!target) return;
      if (button.dataset.rename) {
        HOF.formModal({
          title: target.parent ? "Alt grubun adı" : "Grubun adı",
          eyebrow: target.parent ? target.parent.name : "TAKSİTLER",
          fields: [{ name: "name", label: "Ad", required: true, maxlength: 80, value: target.name, autofocus: true }],
          onSubmit: async data => refresh(await HOF.api(`/api/workspace/plans/groups/${encodeURIComponent(target.id)}`, { method: "PUT", body: data })),
        });
        return;
      }
      const ok = await HOF.confirm({ title: target.parent ? "Alt grubu sil" : "Grubu sil", message: `“${target.name}” silinecek. İçinde kart varsa silinemez; önce kartları taşıyın.`, confirmLabel: "Sil", danger: true });
      if (!ok) return;
      try {
        await refresh(await HOF.api(`/api/workspace/plans/groups/${encodeURIComponent(target.id)}`, { method: "DELETE" }));
      } catch (error) {
        HOF.toastError(error);
      }
    });
    render();
  }

  // ---------- Excel'den ilk yükleme ----------
  const parseInWorker = file =>
    new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker("/assets/hof-excel-worker.js", { type: "module" });
      } catch {
        reject(new Error("Tarayıcınız Excel okumayı desteklemiyor. Chrome veya Edge'in güncel sürümünü kullanın."));
        return;
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Excel dosyası 90 saniyede okunamadı."));
      }, 90_000);
      worker.onmessage = event => {
        clearTimeout(timer);
        worker.terminate();
        if (event.data.ok) resolve(event.data);
        else reject(new Error(`Excel dosyası okunamadı: ${event.data.error}`));
      };
      worker.onerror = event => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message || "Excel dosyası okunamadı. XLSX, XLS veya CSV dosyası seçin."));
      };
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer, name: file.name }, [buffer]), reject);
    });
  const ROLE_OPTIONS = [["", "— Kullanma —"], ["seq", "Sıra No"], ["name", "Ad Soyad *"], ["registered", "Kayıt tarihi"], ["group", "Grup (plaka, site…)"], ["subgroup", "Alt grup (güzergâh, blok…)"], ["phone", "Telefon"], ["total", "Toplam tutar *"], ["count", "Taksit sayısı"], ["firstDue", "İlk vade"], ["installment", "Taksit tutarı"], ["note", "Bilgi notu"]];

  function importFromExcel() {
    const input = HOF.el("input", { type: "file", accept: ".xlsx,.xls,.xlsm,.csv", hidden: true });
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      HOF.toast(`${file.name} okunuyor…`);
      try {
        const parsed = await parseInWorker(file);
        const sheets = parsed.sheets.filter(sheet => sheet.matrix.some(row => row.length));
        if (!sheets.length) throw new Error("Dosyada dolu sayfa yok.");
        const sheet = sheets.length === 1 ? sheets[0] : await pickSheet(sheets);
        if (!sheet) return;
        const preview = await HOF.api("/api/workspace/plans/import/preview", { method: "POST", body: { matrix: sheet.matrix } });
        mappingForm(file.name, sheet, preview);
      } catch (error) {
        HOF.toastError(error);
      }
    });
    input.click();
  }
  const pickSheet = sheets =>
    new Promise(resolve => {
      let picked = null;
      HOF.formModal({
        title: "Hangi sayfa?",
        eyebrow: "EXCEL’DEN YÜKLE",
        fields: [{ name: "sheet", label: "Sayfa", type: "select", value: sheets[0].name, options: sheets.map(sheet => ({ value: sheet.name, label: `${sheet.name} (${Math.max(0, sheet.matrix.filter(row => row.length).length - 1)} satır)` })) }],
        submitLabel: "Devam",
        onSubmit: data => {
          picked = sheets.find(sheet => sheet.name === data.sheet) || null;
        },
        onClose: () => resolve(picked),
      });
    });
  function mappingForm(fileName, sheet, preview) {
    const sample = sheet.matrix[preview.headerAt + 1] || [];
    HOF.formModal({
      title: "Excel’den yükle: kolonları eşle",
      eyebrow: fileName,
      size: "wide",
      intro: `${preview.rows} satır bulundu. Her satır bir taksit kartı olur; Sıra No kolonu kartın numarası olur, Kayıt tarihi kolonu yoksa bugün yazılır, grup ve alt grup adları tanımlanır, toplam tutar taksit sayısına bölünür. Aynı ad ve grupla açık kart varsa satır atlanır. Program başlıkları tanıdı; yanlışsa değiştirin.`,
      fields: [
        ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, label]) => ({ value, label })) })),
        { name: "defaultCount", label: "Taksit sayısı yazılmayan satırlar için", inputmode: "numeric", placeholder: "Örn. 9 (boş: taksit kurulmaz)" },
        { name: "defaultFirstDue", label: "İlk vade yazılmayan satırlar için", type: "date", value: todayIso() },
        { name: "groupName", label: "Grup kolonu yoksa hepsi bu gruba", maxlength: 80, placeholder: "İsteğe bağlı" },
      ],
      submitLabel: "Kartları oluştur",
      onOpen: dialog => dialog.classList.add("hof-import-form"),
      onSubmit: async data => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          if (data[`c${index}`]) roles[index] = data[`c${index}`];
        });
        const result = await HOF.api("/api/workspace/plans/import", { method: "POST", body: { matrix: sheet.matrix, headerAt: preview.headerAt, roles, defaultCount: data.defaultCount, defaultFirstDue: data.defaultFirstDue, groupName: data.groupName, fileName } });
        await loadGroups();
        view.status = "all";
        view.mode = "list";
        renderList();
        loadList();
        HOF.dues?.reloadSoon?.(300);
        const skipped = result.skipped.length ? ` ${result.skipped.length} satır atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
        HOF.toast(`${result.created} kart oluşturuldu${result.groups ? `, ${result.groups} grup tanımlandı` : ""}.${skipped}`, { type: result.created ? "success" : "error", timeout: 9000 });
      },
    });
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const row = event.target.closest("tr[data-plan]");
    if (row && view.mode === "list") return loadPlan(row.dataset.plan);
    const button = event.target.closest("button, a[data-act]");
    if (!button) return;
    const plan = view.plan;
    if (button.dataset.status) {
      view.status = button.dataset.status;
      renderList();
      return loadList();
    }
    if (button.dataset.print) return printPdf(button.dataset.print === "list" ? listPdfUrl() : cardPdfUrl(plan));
    if (button.dataset.itemFilter) {
      view.itemFilter = button.dataset.itemFilter;
      return renderCard();
    }
    if (button.dataset.entryFilter) {
      view.entryFilter = button.dataset.entryFilter;
      return renderCard();
    }
    if ("close" in button.dataset) return modal.close();
    const act = button.dataset.act;
    if (act === "back") {
      view.mode = "list";
      view.planId = "";
      renderList();
      return loadList();
    }
    if (act === "new") return editPlan(null);
    if (act === "import") return importFromExcel();
    if (act === "groups") return openGroups();
    if (!plan) return;
    if (act === "pay") return editEntry(plan, { kind: "in" });
    if (act === "refund") return editEntry(plan, { kind: "out" });
    if (act === "addItem") return editItem(plan, null);
    if (act === "distribute") return distributePlan(plan);
    if (act === "edit") return editPlan(plan);
    if (act === "close") return setStatus(plan, "closed");
    if (act === "reopen") return setStatus(plan, "active");
    if (act === "delete") return deletePlan(plan);
    if (act === "whatsapp") return window.open(`https://wa.me/${button.dataset.wa}`, "_blank", "noopener");
    const itemOf = id => plan.items.find(item => item.id === id);
    const entryOf = id => plan.entries.find(entry => entry.id === id);
    if (button.dataset.payItem) return editEntry(plan, { kind: "in", item: itemOf(button.dataset.payItem) });
    if (button.dataset.editItem) return editItem(plan, itemOf(button.dataset.editItem));
    if (button.dataset.deleteItem) return deleteItem(plan, itemOf(button.dataset.deleteItem));
    if (button.dataset.editEntry) return editEntry(plan, { entry: entryOf(button.dataset.editEntry) });
    if (button.dataset.deleteEntry) return deleteEntry(plan, entryOf(button.dataset.deleteEntry));
  }
  function onChange(event) {
    const select = event.target.closest("select[data-filter]");
    if (!select) return;
    view[select.dataset.filter] = select.value;
    if (select.dataset.filter === "group") view.subgroup = "";
    if (select.dataset.filter === "sort") {
      try {
        localStorage.setItem(SORT_KEY, select.value);
      } catch {
        // tarayıcı saklamaya izin vermiyorsa sıralama yalnız bu pencerede geçerli
      }
    }
    renderList();
    loadList();
  }
  const onInput = (() => {
    let timer = 0;
    return event => {
      const input = event.target.closest('input[data-filter="q"]');
      if (!input) return;
      view.q = input.value;
      clearTimeout(timer);
      timer = setTimeout(loadList, 250);
    };
  })();

  // Bildirimden / şeritten: geciken taksite tahsilat (kart penceresi açılır, tahsilat formu hazır gelir).
  async function pay(item) {
    if (!item?.planId) return;
    if (!canCollect()) return open(item.planId);
    try {
      const plan = await HOF.api(`/api/workspace/plans/${encodeURIComponent(item.planId)}`);
      const target = plan.items.find(row => row.id === item.itemId) || null;
      editEntry(plan, { kind: "in", item: target, amount: item.amount });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  HOF.whenReady(() => {
    HOF.on("live:workspace.changed", change => {
      if (!modal || !change) return;
      if (change.kind === "plans") {
        loadGroups().then(() => {
          if (view.mode === "card" && view.planId && (!change.planId || change.planId === view.planId)) loadPlan(view.planId);
          else if (view.mode === "list") {
            renderList();
            loadList();
          }
        });
      }
    });
  });
  HOF.plans = { open, pay, refresh: () => (view.mode === "card" && view.planId ? loadPlan(view.planId) : loadList()) };
})();
