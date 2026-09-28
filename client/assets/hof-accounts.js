/* DestekOfis — Cari (v2.0.6): Operasyon Merkezi'ndeki müşteri/tedarikçi kartları.
 * Tek pencere, iki görünüm: LİSTE (arama, tür, grup › alt grup, bakiye süzgeci, sıralama; göstergeler; seçip toplu
 * taksitlendirme; PDF, Yazdır, Excel) ve KART (kişi bilgileri, Excel'den gelen ek alanlar, bilgi notu; göstergeler;
 * taksit kartları; defter: borç, alacak, tahsilat, ödeme, taksitler ve yürüyen bakiye).
 * Excel'den ya da açık tablodan toplu alım: kolonlar rollerle eşlenir, tanınmayan her kolon kartta aynı adla ek alan olur;
 * taksit sorulmaz. Taksit kartları bir cariye aittir; tahsilat Kasa'ya düşer. Sunucu: server/routes/accounts.mjs. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const office = () => HOF.office || {};
  const TYPES = { customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" };
  const STATUS_TABS = [
    { id: "active", label: "Aktif" },
    { id: "passive", label: "Pasif" },
    { id: "all", label: "Tümü" },
  ];
  const BALANCES = [
    ["all", "Tüm bakiyeler"],
    ["debtor", "Bize borçlu olanlar"],
    ["creditor", "Bizim borçlu olduklarımız"],
    ["overdue", "Taksidi gecikenler"],
    ["zero", "Bakiyesi sıfır"],
  ];
  const SORTS = [
    ["no", "Cari No"],
    ["name", "Ada göre"],
    ["balance", "Bakiyeye göre (çoktan aza)"],
    ["overdue", "Geciken taksite göre"],
    ["registered", "Kayıt tarihine göre (yeni önce)"],
  ];
  const ENTRY_LABEL = { debt: "Borç yaz", credit: "Alacak yaz", in: "Tahsilat", out: "Ödeme" };
  const ENTRY_HELP = {
    debt: "Cari size borçlanır (ör. verilen hizmet, satış, aidat). Kasa'ya yazılmaz.",
    credit: "Siz cariye borçlanırsınız (ör. alınan mal, hizmet faturası). Kasa'ya yazılmaz.",
    in: "Cariden para alındı: bakiyeden düşer, Kasa'ya tahsilat olarak girer, makbuzu alınır.",
    out: "Cariye para verildi (ör. tedarikçiye ödeme, iade): Kasa'dan çıkar.",
  };
  const LEDGER_FILTERS = [
    ["all", "Tümü", () => true],
    ["debit", "Borç", line => line.debit > 0],
    ["credit", "Alacak", line => line.credit > 0],
    ["cash", "Kasa", line => line.kind === "in" || line.kind === "out" || line.kind === "plan-in"],
    ["plan", "Taksit", line => line.origin === "plan"],
  ];
  const canManage = () => HOF.can("accounts.manage");
  const canCollect = () => HOF.can("accounts.collect");
  const canPlan = () => HOF.can("plans.manage");
  const moduleName = () => HOF.uiLabel?.("side.accounts", "Cari") || "Cari";
  const sideWord = balance => (balance > 0.005 ? "borçlu" : balance < -0.005 ? "alacaklı" : "");
  const balanceHtml = balance => `<span class="hof-acc-balance is-${balance > 0.005 ? "debtor" : balance < -0.005 ? "creditor" : "zero"}">${esc(money(Math.abs(balance)))}${sideWord(balance) ? `<small>${sideWord(balance)}</small>` : ""}</span>`;
  const typeBadge = type => `<span class="hof-plan-badge is-${type === "supplier" ? "soon" : type === "other" ? "muted" : "info"}">${esc(TYPES[type] || "")}</span>`;
  const whereText = item => [item.groupName, item.subgroupName].filter(Boolean).join(" › ");
  const SORT_KEY = "hof.accounts.sort";
  const stored = (key, fallback) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };

  let modal = null;
  const view = { mode: "list", id: "", q: "", type: "", group: "", subgroup: "", status: "active", balance: "all", sort: stored(SORT_KEY, "no"), ledgerFilter: "all", list: null, account: null, selected: new Set(), selectAll: false, limit: 300 };
  // Binlerce caride ekran hızlı kalsın: sunucu 300'er satır gönderir ("Daha fazla göster" sonrakini ekler); arama, süzgeç
  // ve toplamlar sunucuda tümü üzerinde çalışır. "Hepsini seç" süzgeçteki bütün carileri (yüklenmemişler dahil) seçer.
  const PAGE = 300;
  let listRequest = 0;
  const body = () => modal?.dialog.querySelector("[data-accounts]");
  const query = () => new URLSearchParams({ q: view.q, type: view.type, group: view.group, subgroup: view.subgroup, status: view.status, balance: view.balance, sort: view.sort });
  const filterBody = () => ({ q: view.q, type: view.type, group: view.group, subgroup: view.subgroup, status: view.status, balance: view.balance });
  const listPdfUrl = () => `/api/workspace/accounts/liste.pdf?${query()}&title=${encodeURIComponent(moduleName())}`;
  const listXlsxUrl = () => `/api/workspace/accounts/export.xlsx?${query()}&title=${encodeURIComponent(moduleName())}`;
  const cardPdfUrl = account => `/api/workspace/accounts/${encodeURIComponent(account.id)}/ekstre.pdf`;

  // ---------- Veri ----------
  async function loadList({ more = false } = {}) {
    const ticket = ++listRequest;
    const offset = more && view.list ? view.list.accounts.length : 0;
    try {
      const data = await HOF.api(`/api/workspace/accounts?${query()}&limit=${PAGE}&offset=${offset}`);
      if (ticket !== listRequest) return;
      view.list = more && view.list ? { ...data, accounts: [...view.list.accounts, ...data.accounts] } : data;
      // Süzgeç değişince seçim sıfırlanır (görünmeyen cari seçili kalmasın; yanlış kişiye plan açılmasın).
      if (!more) {
        const visible = new Set(view.list.accounts.map(item => item.id));
        for (const id of [...view.selected]) if (!visible.has(id)) view.selected.delete(id);
        view.selectAll = false;
      }
      if (view.mode === "list") renderList();
    } catch (error) {
      if (ticket === listRequest && view.mode === "list" && body()) body().innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }
  let cardRequest = 0;
  async function loadAccount(id) {
    const ticket = ++cardRequest;
    const target = view.id;
    try {
      const account = await HOF.api(`/api/workspace/accounts/${encodeURIComponent(id)}`);
      // Yanıt gelene kadar kullanıcı listeye döndü ya da başka cari açtıysa eski kart geri gelmez.
      if (ticket !== cardRequest || view.id !== target) return;
      if (id !== view.id) view.ledgerFilter = "all";
      view.account = account;
      view.id = id;
      view.mode = "card";
      renderCard();
    } catch (error) {
      if (ticket !== cardRequest) return;
      HOF.toastError(error);
      view.mode = "list";
      renderList();
      loadList();
    }
  }
  const applyAccount = data => {
    // Başka carinin (gecikmiş) yanıtı açık kartın üstüne yazılmaz; düğmeler açık kartın carisine gider.
    if (view.id === data.id) view.account = data;
    if (modal) {
      if (view.mode === "card" && view.id === data.id) renderCard();
      loadList();
    }
    HOF.emit("accounts-changed", { accountId: data.id });
  };

  function open(accountId = "") {
    if (!HOF.can("accounts.view")) return HOF.toast(`${moduleName()} için yetkiniz yok.`, { type: "error" });
    if (modal) {
      if (accountId) loadAccount(accountId);
      return;
    }
    modal = HOF.modal({
      title: moduleName(),
      eyebrow: "OPERASYON",
      size: "wide",
      body: '<div class="hof-plans hof-accounts" data-accounts><p class="hof-empty">Yükleniyor…</p></div>',
      onClose: () => {
        modal = null;
        view.mode = "list";
        view.id = "";
      },
    });
    modal.dialog.classList.add("hof-plans-modal", "hof-accounts-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("change", onChange);
    modal.dialog.addEventListener("input", onInput);
    modal.dialog.addEventListener("keydown", event => {
      const row = event.target.closest?.("tr[data-account]");
      if (row && event.key === "Enter" && view.mode === "list") loadAccount(row.dataset.account);
    });
    if (accountId) loadAccount(accountId);
    else {
      renderList();
      loadList();
    }
  }

  // ---------- Liste ----------
  const groupOptions = () => {
    const groups = view.list?.groups || [];
    const group = groups.find(item => item.id === view.group);
    const subs = group ? group.subgroups : [];
    return `<select data-filter="group" aria-label="Grup"><option value="">Tüm gruplar</option>${groups.map(item => `<option value="${esc(item.id)}" ${item.id === view.group ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>
      <select data-filter="subgroup" aria-label="Alt grup" ${subs.length ? "" : "disabled"}><option value="">${subs.length ? "Tüm alt gruplar" : "Alt grup"}</option>${subs.map(item => `<option value="${esc(item.id)}" ${item.id === view.subgroup ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>`;
  };
  const selectBar = () => {
    const count = view.selectAll ? view.list?.total || 0 : view.selected.size;
    if (!canPlan()) return "";
    return `<div class="hof-acc-selbar${count ? " is-active" : ""}" data-selbar><span>${count ? `<b>${count}</b> cari seçildi${view.selectAll ? " (süzgeçteki hepsi)" : ""}` : "Toplu taksitlendirmek için soldaki kutulardan carileri seçin; başlıktaki kutu süzgeçteki carilerin hepsini seçer (ör. önce grup ya da okul seçin)."}</span>${count ? '<button type="button" class="hof-button hof-button-small" data-act="bulkPlan">Seçilenlere taksit planı</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="clearSel">Seçimi temizle</button>' : ""}</div>`;
  };
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const manage = canManage();
    const planning = canPlan();
    const filtered = Boolean(view.q || view.type || view.group || view.subgroup || view.balance !== "all");
    const tableRows = HOF.data?.rows?.length || 0;
    const row = item => {
      const next = item.next ? `<small class="${item.next.days < 0 ? "is-warn" : ""}">${esc(HOF.formatDate(item.next.dueDate))} · ${item.next.days < 0 ? `${Math.abs(item.next.days)} gün gecikti` : "sıradaki taksit"}</small>` : "";
      const plansCell = item.activePlans ? `<b>${esc(money(item.planRemaining))}</b><small>${item.activePlans} kart${item.overdueCount ? ` · <span class="is-warn">${item.overdueCount} geciken</span>` : ""}</small>${next}` : '<small class="hof-muted">—</small>';
      const extra = item.extra?.length ? `<small class="hof-acc-extra">${item.extra.map(field => `${esc(field.label)}: ${esc(field.value)}`).join(" · ")}</small>` : "";
      return `<tr data-account="${esc(item.id)}" class="${item.status === "passive" ? "is-passive" : ""}" tabindex="0">${planning ? `<td class="hof-acc-check"><input type="checkbox" data-select="${esc(item.id)}" aria-label="${esc(item.name)} seç" ${view.selected.has(item.id) ? "checked" : ""}></td>` : ""}<td class="hof-plan-no">${esc(item.refNo)}</td><td><b>${esc(item.name)}</b> ${item.type !== "customer" ? typeBadge(item.type) : ""}${item.status === "passive" ? badgeMuted("Pasif") : ""}<small>${esc(whereText(item) || "Grupsuz")}${item.phone ? ` · ${esc(item.phone)}` : ""}${item.caseKey ? " · tabloda kayıtlı" : ""}</small>${extra}</td><td class="num">${amountCell(item.debit)}</td><td class="num">${amountCell(item.credit, "hof-cash-in")}</td><td class="num">${balanceHtml(item.balance)}</td><td>${plansCell}</td></tr>`;
    };
    const allChecked = view.selectAll || (data && data.accounts.length && data.accounts.every(item => view.selected.has(item.id)));
    const total = data?.total ?? data?.accounts.length ?? 0;
    root.innerHTML = `<div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Durum">${STATUS_TABS.map(item => `<button type="button" data-status="${item.id}" aria-pressed="${String(item.id === view.status)}">${item.label}</button>`).join("")}</div>
      <div class="hof-cash-add">${manage ? `<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni cari</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import" title="Excel dosyasından ya da Google Sheets’ten carileri tek seferde aç (taksit sorulmaz)">Excel / Sheets’ten yükle</button>${tableRows ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="fromTable" title="Ortadaki tablonun açık sekmesindeki kişileri cari yap; her cari kendi kaydına bağlanır">Tablodan al</button>' : ""}` : ""}</div></div>
      <div class="hof-plans-filters"><input type="search" data-filter="q" value="${esc(view.q)}" placeholder="Ad, telefon, cari no, adres, ek alan ara…" aria-label="Ara"><select data-filter="type" aria-label="Tür"><option value="">Tüm türler</option>${Object.entries(TYPES).map(([id, label]) => `<option value="${id}" ${id === view.type ? "selected" : ""}>${label}</option>`).join("")}</select>${groupOptions()}<select data-filter="balance" aria-label="Bakiye">${BALANCES.map(([id, label]) => `<option value="${id}" ${id === view.balance ? "selected" : ""}>${label}</option>`).join("")}</select><select data-filter="sort" aria-label="Sıralama">${SORTS.map(([id, label]) => `<option value="${id}" ${id === view.sort ? "selected" : ""}>${label}</option>`).join("")}</select>${outputs(listPdfUrl(), `<a class="hof-button hof-button-small hof-button-ghost" href="${esc(listXlsxUrl())}" data-xlsx title="Ekrandaki listeyi (ek alanlarıyla) Excel olarak indir">Excel</a>`)}</div>
      <div class="hof-kpis hof-plans-kpis">${data ? `<div class="hof-cash-balance"><strong>${esc(money(data.totals.debtor))}</strong><span>Bize borçlu · ${data.totals.count.toLocaleString("tr-TR")} cari</span></div><div><strong>${esc(money(data.totals.creditor))}</strong><span>Bizim borcumuz</span></div><div><strong>${esc(money(data.totals.planRemaining))}</strong><span>Taksitlerden kalan</span></div><div class="${data.totals.overdueCount ? "is-late" : ""}"><strong>${esc(money(data.totals.overdue))}</strong><span>Geciken · ${data.totals.overdueCount} taksit</span></div>` : ""}</div>
      ${selectBar()}
      <div class="hof-cash-list hof-plans-list">${
        !data
          ? '<p class="hof-empty">Yükleniyor…</p>'
          : data.accounts.length
            ? `<table class="hof-table hof-cash-table hof-plans-table hof-acc-table"><thead><tr>${planning ? `<th class="hof-acc-check"><input type="checkbox" data-select-all aria-label="Süzgeçteki ${total} carinin hepsini seç" title="Süzgeçteki ${total} carinin hepsini seç" ${allChecked ? "checked" : ""}></th>` : ""}<th class="hof-plan-no">No</th><th>Cari</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th>Taksit</th></tr></thead><tbody>${data.accounts.map(row).join("")}</tbody></table>${data.hasMore ? `<div class="hof-more"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="more">Daha fazla göster · ${total - data.accounts.length} cari daha</button></div>` : ""}`
            : `<p class="hof-empty">${filtered || view.status !== "all" ? "Bu süzgeçte cari yok." : "Henüz cari yok."}${manage && !filtered ? " <b>+ Yeni cari</b> ile tek kart açın, <b>Excel’den yükle</b> ile listenizi bir kerede aktarın ya da <b>Tablodan al</b> ile ortadaki tablodaki kişileri cari yapın." : ""}</p>`
      }</div>
      <p class="hof-edit-meta">Bakiye = borç − alacak. <b>borçlu</b>: cari size borçlu; <b>alacaklı</b>: siz cariye borçlusunuz. Taksit planları carinin borcuna, taksit tahsilatları alacağına yazılır. Tahsilat ve ödemeler Kasa’ya düşer.</p>
      <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }
  // PDF · Yazdır · Excel tek düğme grubunda.
  const outputs = (pdfUrl, extra = "") => (office().outputButtons ? office().outputButtons(pdfUrl, "list").replace(/<\/span>$/, `${extra}</span>`) : extra);
  const amountCell = (value, tone = "") => (Math.abs(value) > 0.005 ? `<span class="${tone}">${esc(money(value))}</span>` : `<span class="hof-muted">${esc(money(0))}</span>`);
  const badgeMuted = label => ` <span class="hof-plan-badge is-muted">${esc(label)}</span>`;

  // ---------- Kart ----------
  function renderCard() {
    const root = body();
    const account = view.account;
    if (!root || !account) return;
    const manage = account.canManage;
    const collect = account.canCollect;
    const t = account.totals;
    const phone = HOF.workspace?.extractPhones?.(account.phone || "")[0] || "";
    const test = (LEDGER_FILTERS.find(([id]) => id === view.ledgerFilter) || LEDGER_FILTERS[0])[2];
    const lines = account.ledger.filter(test);
    const entryById = new Map(account.entries.map(entry => [entry.id, entry]));
    const lineActions = line => {
      if (line.origin === "plan") return `<button type="button" class="hof-mini" data-open-plan="${esc(line.planId)}" title="Taksit kartını aç" aria-label="Taksit kartını aç">↗</button>`;
      const entry = entryById.get(line.id);
      if (!entry) return "";
      const receipt = entry.kind === "in" || entry.kind === "out" ? `<a class="hof-mini hof-mini-text" href="/api/workspace/accounts/${encodeURIComponent(account.id)}/entries/${encodeURIComponent(entry.id)}/makbuz.pdf" target="_blank" rel="noopener" title="Makbuz (PDF)">Makbuz</a>` : "";
      const stock = entry.source === "stock" ? '<small class="hof-muted" title="Stok hareketinden gelir; Stok’tan düzeltilir">stoktan</small>' : entry.source === "cheque" ? (HOF.can("cheques.view") ? `<button type="button" class="hof-mini" data-open-cheque="${esc(entry.sourceId)}" title="Çek / senetten gelir; evrak kartından geri alınır" aria-label="Çek / senet kartını aç">↗</button>` : '<small class="hof-muted" title="Çek / senetten gelir; evrak kartından geri alınır">çek / senet</small>') : "";
      return `${receipt}${stock}${entry.editable ? `<button type="button" class="hof-mini" data-edit-entry="${esc(entry.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-entry="${esc(entry.id)}" title="Sil" aria-label="Sil">×</button>` : ""}`;
    };
    const ledgerRow = line => `<tr class="is-${esc(line.kind)}"><td>${esc(HOF.formatDate(line.date))}</td><td><b>${esc(line.label)}${line.receiptNo ? ` <span class="hof-plan-receipt">Makbuz ${esc(line.receiptNo)}</span>` : ""}</b>${line.note ? `<small>${esc(line.note)}</small>` : ""}</td><td class="num hof-cash-out">${line.debit ? esc(money(line.debit)) : ""}</td><td class="num hof-cash-in">${line.credit ? esc(money(line.credit)) : ""}</td><td class="num">${balanceHtml(line.balance)}</td><td class="hof-cash-actions">${lineActions(line)}</td></tr>`;
    const planRow = plan => `<tr data-open-plan="${esc(plan.id)}" tabindex="0" class="is-${esc(plan.state)}"><td class="hof-plan-no">${esc(plan.refNo || "")}</td><td><b>${esc(plan.name)}</b><small>${plan.itemCount ? `${plan.itemCount} taksit` : "Taksit kurulmadı"}${plan.next ? ` · sıradaki ${esc(HOF.formatDate(plan.next.dueDate))}` : ""}</small></td><td class="num">${esc(money(plan.totals.total))}</td><td class="num hof-cash-in">${esc(money(plan.totals.paid))}</td><td class="num${plan.totals.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(plan.totals.remaining))}</td><td>${plan.status === "closed" ? '<span class="hof-plan-badge is-muted">Kapalı</span>' : plan.state === "overdue" ? `<span class="hof-plan-badge is-late">${plan.totals.overdueCount} taksit gecikti</span>` : plan.state === "done" ? '<span class="hof-plan-badge is-done">Tamamlandı</span>' : '<span class="hof-plan-badge is-info">Devam ediyor</span>'}</td></tr>`;
    const caseCell = account.caseKey
      ? account.caseSource && HOF.datasetKey && account.caseSource !== HOF.datasetKey
        ? `${esc(account.caseTitle || account.caseKey)} <small class="hof-muted">· başka veri oturumunda</small>`
        : `<a href="#" data-act="reveal" title="Kaydı tabloda aç">${esc(account.caseTitle || account.caseKey)}</a> <small>· Kayda git</small>`
      : `<span class="hof-muted">Bağlı değil${manage ? " · Düzenle ile bağlayın" : ""}</span>`;
    const sums = lines.reduce((acc, line) => ({ debit: acc.debit + line.debit, credit: acc.credit + line.credit }), { debit: 0, credit: 0 });
    const active = account.status === "active";
    root.innerHTML = `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${account.refNo ? `<span class="hof-plan-refno" title="Cari No">No ${esc(account.refNo)}</span>` : ""}${esc(account.name)} ${typeBadge(account.type)}${active ? "" : badgeMuted("Pasif")}</h3><small>${esc(whereText(account) || "Grupsuz")}${account.phone ? ` · ${esc(account.phone)}` : ""}</small></div></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Cari işlemleri">
          <span class="hof-plan-toolgroup">${collect ? '<button type="button" class="hof-button hof-button-small" data-entry="in">+ Tahsilat</button>' : ""}${manage ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="debt" title="Cari size borçlanır">Borç yaz</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="credit" title="Siz cariye borçlanırsınız">Alacak yaz</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="out" title="Cariye para verildi (Kasa’dan çıkar)">− Ödeme</button>' : ""}${canPlan() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="newPlan" title="Bu cariye taksit kartı aç">+ Taksit planı</button>' : ""}</span>
          <span class="hof-plan-toolgroup">${office().outputButtons ? office().outputButtons(cardPdfUrl(account), "card") : ""}${phone ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}</span>
          ${manage ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="${active ? "passive" : "activate"}" title="${active ? "Pasif cari listede Pasif altında durur; hareketleri korunur" : ""}">${active ? "Pasife al" : "Aktif yap"}</button><button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-act="delete">Sil</button></span>` : ""}
        </div></div>
      <section class="hof-plan-profile" aria-label="Cari bilgileri">
        <dl class="hof-plan-facts">
          <div><dt>Cari No</dt><dd>${esc(account.refNo || "—")}</dd></div>
          <div><dt>Tür</dt><dd>${esc(TYPES[account.type] || "—")}</dd></div>
          <div><dt>Grup</dt><dd>${esc(whereText(account) || "—")}</dd></div>
          <div><dt>Telefon</dt><dd>${account.phone ? (phone ? `<a href="tel:+${esc(phone)}">${esc(account.phone)}</a>` : esc(account.phone)) : "—"}</dd></div>
          <div><dt>E-posta</dt><dd>${account.email ? `<a href="mailto:${esc(account.email)}">${esc(account.email)}</a>` : "—"}</dd></div>
          <div><dt>Kayıt tarihi</dt><dd>${esc(account.registeredOn ? HOF.formatDate(account.registeredOn) : "—")}</dd></div>
          <div class="is-wide"><dt>Adres</dt><dd>${esc(account.address || "—")}</dd></div>
          <div><dt>Tablodaki kayıt</dt><dd>${caseCell}</dd></div>
          <div><dt>Kartı açan</dt><dd>${esc(account.actorName || "—")} · ${esc(HOF.formatDate(account.createdAt))}</dd></div>
          ${account.fields.map(field => `<div><dt title="Excel’den gelen alan">${esc(field.label)}</dt><dd>${esc(field.value || "—")}</dd></div>`).join("")}
        </dl>
        <div class="hof-plan-note"><h4>Bilgi notu</h4>${account.note ? `<p>${esc(account.note)}</p>` : `<p class="hof-empty">Not yok.${manage ? " <b>Düzenle</b> ile ekleyin." : ""}</p>`}</div>
      </section>
      <div class="hof-kpis hof-plans-kpis"><div><strong>${esc(money(t.debit))}</strong><span>Borç toplamı</span></div><div><strong class="hof-cash-in">${esc(money(t.credit))}</strong><span>Alacak toplamı · tahsil ${esc(money(t.collected))}</span></div><div class="hof-cash-balance"><strong>${esc(money(Math.abs(t.balance)))}</strong><span>Bakiye${sideWord(t.balance) ? ` · ${sideWord(t.balance)}` : ""}</span></div><div class="${t.overdueCount ? "is-late" : ""}"><strong>${esc(money(t.planRemaining))}</strong><span>Taksitten kalan${t.overdueCount ? ` · ${t.overdueCount} geciken` : ""}</span></div></div>
      <div class="hof-plan-section"><h4>Taksit kartları <span>${account.plans.length}</span></h4></div>
      <div class="hof-cash-list hof-plans-items">${account.plans.length ? `<table class="hof-table hof-cash-table hof-plans-table"><thead><tr><th class="hof-plan-no">No</th><th>Kart</th><th class="num">Toplam</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Durum</th></tr></thead><tbody>${account.plans.map(planRow).join("")}</tbody></table>` : `<p class="hof-empty">Bu carinin taksit kartı yok.${canPlan() ? " <b>+ Taksit planı</b> ile açın; tahsilatlar taksitten düşer ve burada görünür." : ""}</p>`}</div>
      <div class="hof-plan-section"><h4>Hareketler <span>${account.ledger.length}</span></h4>${account.ledger.length ? `<span class="hof-plan-chips" role="group">${LEDGER_FILTERS.map(([id, label, check]) => `<button type="button" data-ledger-filter="${id}" aria-pressed="${String(id === view.ledgerFilter)}">${label} <b>${account.ledger.filter(check).length}</b></button>`).join("")}</span>` : ""}</div>
      <div class="hof-cash-list hof-plans-entries">${lines.length ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th></th></tr></thead><tbody>${lines.map(ledgerRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num hof-cash-out">${esc(money(sums.debit))}</td><td class="num hof-cash-in">${esc(money(sums.credit))}</td><td></td><td></td></tr></tfoot></table>` : account.ledger.length ? '<p class="hof-empty">Bu süzgeçte hareket yok.</p>' : '<p class="hof-empty">Henüz hareket yok. Tahsilat, borç, alacak ve ödeme burada, yürüyen bakiyeyle görünür.</p>'}</div>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Listeye dön</button><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }

  // ---------- Cari seçici (taksit kartı formu, stok hareketi) ----------
  // Yazdıkça sunucudan en çok 20 cari; seçilen carinin kimliği gizli alanda. "×" seçimi kaldırır.
  function picker({ value = {}, label = "Cari", help = "", required = false, type = "", onPick = null, name = "accountId" } = {}) {
    if (!HOF.can("accounts.view")) return null;
    const field = HOF.el(
      "div",
      { class: "hof-field hof-case-picker hof-acc-picker" },
      `<span>${esc(label)}${required ? ' <i aria-hidden="true">*</i>' : ""}</span>
      <div class="hof-case-picker-box"><input type="text" data-acc-query autocomplete="off" maxlength="160" placeholder="Cari adı, telefon ya da cari no yazın…" value="${esc(value.name || "")}"><button type="button" class="hof-case-picker-clear" data-acc-clear title="Seçimi kaldır" aria-label="Seçimi kaldır">×</button></div>
      <input type="hidden" name="${esc(name)}" value="${esc(value.id || "")}">
      <ul class="hof-case-picker-list" role="listbox" hidden></ul>
      ${help ? `<small>${esc(help)}</small>` : ""}`,
    );
    const input = field.querySelector("[data-acc-query]");
    const hidden = field.querySelector(`input[name="${name}"]`);
    const list = field.querySelector(".hof-case-picker-list");
    const clear = field.querySelector("[data-acc-clear]");
    let timer = 0;
    let ticket = 0;
    let hits = [];
    const state = () => {
      field.classList.toggle("is-linked", Boolean(hidden.value));
      clear.hidden = !hidden.value;
    };
    const hide = () => {
      list.hidden = true;
      list.innerHTML = "";
    };
    const search = () => {
      clearTimeout(timer);
      if (hidden.value) return hide();
      timer = setTimeout(async () => {
        const own = ++ticket;
        try {
          hits = await HOF.api(`/api/workspace/accounts/search?q=${encodeURIComponent(input.value.trim())}${type ? `&type=${type}` : ""}`);
        } catch {
          hits = [];
        }
        if (own !== ticket) return;
        list.innerHTML = hits.length
          ? hits.map(item => `<li role="option" data-id="${esc(item.id)}"><b>${esc(item.name)}${item.refNo ? ` · No ${esc(item.refNo)}` : ""}</b><small>${esc([TYPES[item.type], item.groupName, item.phone].filter(Boolean).join(" · "))} · bakiye ${esc(money(item.balance))}</small></li>`).join("")
          : `<li class="is-empty">${input.value.trim() ? "Eşleşen cari yok" : "Henüz cari yok"}</li>`;
        list.hidden = false;
      }, 180);
    };
    input.addEventListener("input", () => {
      if (hidden.value) {
        hidden.value = "";
        state();
        onPick?.(null);
      }
      search();
    });
    input.addEventListener("focus", search);
    input.addEventListener("blur", () => setTimeout(hide, 160));
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") hide();
      if (event.key === "Enter" && !list.hidden) {
        event.preventDefault();
        list.querySelector("li[data-id]")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      }
    });
    list.addEventListener("mousedown", event => {
      const item = event.target.closest("li[data-id]");
      if (!item) return;
      event.preventDefault();
      const account = hits.find(row => row.id === item.dataset.id);
      hidden.value = item.dataset.id;
      input.value = account?.name || item.textContent.trim();
      state();
      hide();
      onPick?.(account || null);
    });
    clear.addEventListener("click", () => {
      hidden.value = "";
      input.value = "";
      state();
      onPick?.(null);
      input.focus();
    });
    state();
    return field;
  }

  // ---------- Formlar ----------
  function fieldsEditor(fields = []) {
    const box = HOF.el("div", { class: "hof-field hof-acc-fields" }, `<span>Ek alanlar <small>(Excel’den gelen ya da sizin eklediğiniz: Veli, Okul, Plaka, T.C. No…)</small></span><div data-fields></div><button type="button" class="hof-button hof-button-small hof-button-ghost" data-add-field>+ Alan ekle</button>`);
    const holder = box.querySelector("[data-fields]");
    const add = (label = "", value = "") => {
      const row = HOF.el("div", { class: "hof-acc-field-row" }, `<input type="text" data-field-label maxlength="80" placeholder="Alan adı" value="${esc(label)}" aria-label="Alan adı"><input type="text" data-field-value maxlength="1000" placeholder="Değer" value="${esc(value)}" aria-label="Değer"><button type="button" class="hof-mini hof-mini-danger" data-remove-field title="Alanı kaldır" aria-label="Alanı kaldır">×</button>`);
      holder.appendChild(row);
      return row;
    };
    fields.forEach(field => add(field.label, field.value));
    box.querySelector("[data-add-field]").addEventListener("click", () => add().querySelector("input").focus());
    holder.addEventListener("click", event => event.target.closest("[data-remove-field]")?.closest(".hof-acc-field-row").remove());
    box.read = () => [...holder.querySelectorAll(".hof-acc-field-row")].map(row => ({ label: row.querySelector("[data-field-label]").value.trim(), value: row.querySelector("[data-field-value]").value.trim() })).filter(item => item.label);
    return box;
  }
  async function groupsNow() {
    if (view.list?.groups) return view.list.groups;
    try {
      return await HOF.api("/api/workspace/plans/groups");
    } catch {
      return [];
    }
  }
  async function editAccount(account, preset = null) {
    const groups = await groupsNow();
    const link = { caseKey: account?.caseKey || preset?.caseKey || "", caseSource: account?.caseSource || "", caseTitle: account?.caseTitle || preset?.caseTitle || "" };
    let fieldsBox = null;
    HOF.formModal({
      title: account ? "Cariyi düzenle" : "Yeni cari",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      size: "wide",
      intro: account ? "" : "Kişinin ya da firmanın bilgileri. Taksit sorulmaz; taksit planı istenirse sonra karttan ya da listeden toplu açılır.",
      fields: [
        { name: "name", label: "Ad Soyad / Unvan", required: true, maxlength: 160, value: account?.name || preset?.name || "", autofocus: true },
        { name: "type", label: "Tür", type: "select", value: account?.type || preset?.type || "customer", options: Object.entries(TYPES).map(([value, text]) => ({ value, label: text })) },
        { name: "refNo", label: "Cari No", maxlength: 30, value: account?.refNo || "", placeholder: account ? "" : "Boş bırakılırsa sıradaki numara" },
        { name: "registeredOn", label: "Kayıt tarihi", type: "date", value: account?.registeredOn || office().todayIso?.() || "" },
        { name: "phone", label: "Telefon", type: "tel", inputmode: "tel", maxlength: 60, value: account?.phone || preset?.phone || "", placeholder: "05xx xxx xx xx" },
        { name: "email", label: "E-posta", type: "email", maxlength: 160, value: account?.email || "" },
        { name: "address", label: "Adres", type: "textarea", rows: 2, maxlength: 500, value: account?.address || "" },
        ...(office().groupFields ? office().groupFields(groups, account || {}) : []),
        { name: "note", label: "Bilgi notu", type: "textarea", rows: 3, maxlength: 2000, value: account?.note || "" },
        ...(account ? [] : [{ name: "openingBalance", label: "Açılış bakiyesi (₺)", inputmode: "decimal", placeholder: "Örn. 1.500 (borç) ya da -250 (alacak)", help: "Önceki defterden devreden: artı cari size borçlu, eksi siz borçlusunuz. Boş bırakılabilir." }]),
      ],
      submitLabel: account ? "Kaydet" : "Cariyi aç",
      onOpen: dialog => {
        dialog.classList.add("hof-plan-form", "hof-acc-form");
        office().wireGroupFields?.(dialog, groups);
        if (HOF.plans?.casePicker) {
          const casePicker = HOF.el("div", { class: "hof-field hof-case-picker" }, HOF.plans.casePicker.html(link));
          dialog.querySelector('textarea[name="address"]').closest(".hof-field").after(casePicker);
          HOF.plans.casePicker.wire(casePicker);
          casePicker.querySelector("small").textContent = "Bağlı kaydın kartında (ortadaki tablo) bu carinin bakiyesi görünür.";
        }
        fieldsBox = fieldsEditor(account?.fields || []);
        dialog.querySelector('textarea[name="note"]').closest(".hof-field").before(fieldsBox);
      },
      onSubmit: async data => {
        const payload = { name: data.name, type: data.type, refNo: data.refNo, registeredOn: data.registeredOn, phone: data.phone, email: data.email, address: data.address, note: data.note, fields: fieldsBox ? fieldsBox.read() : [], caseKey: data.caseKey || "", caseSource: data.caseSource || "", caseTitle: data.caseKey ? data.caseTitle : "", ...(office().groupBody ? office().groupBody(data) : {}) };
        if (!account) payload.openingBalance = data.openingBalance;
        const result = account ? await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`, { method: "PUT", body: payload }) : await HOF.api("/api/workspace/accounts", { method: "POST", body: payload });
        HOF.toast(account ? "Cari güncellendi." : "Cari açıldı.", { type: "success" });
        if (!modal) open(result.id);
        view.id = result.id;
        view.mode = "card";
        applyAccount(result);
      },
    });
  }
  function editEntry(account, { kind = "in", entry = null } = {}) {
    const type = entry?.kind || kind;
    HOF.formModal({
      title: entry ? `${ENTRY_LABEL[type]} düzelt` : ENTRY_LABEL[type],
      eyebrow: account.name,
      intro: ENTRY_HELP[type],
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: entry ? office().amountText?.(entry.amount) || entry.amount : "", placeholder: "Örn. 1.250,00", autofocus: true },
        { name: "date", label: "Tarih", type: "date", value: entry?.date || office().todayIso?.() || "" },
        { name: "note", label: "Açıklama", maxlength: 300, value: entry?.note || "", placeholder: type === "in" ? "Elden, havale, kart…" : type === "debt" ? "Ör. Eylül aidatı, 3 adet ürün" : "" },
      ],
      submitLabel: entry ? "Kaydet" : ENTRY_LABEL[type],
      onSubmit: async data => {
        const url = `/api/workspace/accounts/${encodeURIComponent(account.id)}/entries${entry ? `/${encodeURIComponent(entry.id)}` : ""}`;
        const result = await HOF.api(url, { method: entry ? "PUT" : "POST", body: { ...data, kind: type } });
        applyAccount(result);
        if (type === "in" || type === "out") HOF.emit("cash-changed");
        const receipt = !entry && (type === "in" || type === "out") && result.entryId ? { label: "Makbuz", onClick: () => window.open(`/api/workspace/accounts/${encodeURIComponent(account.id)}/entries/${encodeURIComponent(result.entryId)}/makbuz.pdf`, "_blank", "noopener") } : undefined;
        HOF.toast(`${entry ? "Hareket düzeltildi" : `${ENTRY_LABEL[type]} kaydedildi`}. Bakiye ${money(Math.abs(result.totals.balance))}${sideWord(result.totals.balance) ? ` ${sideWord(result.totals.balance)}` : ""}.`, { type: "success", action: receipt });
      },
    });
  }
  // Tahsilat: carinin açık taksit kartı varsa önce sorulur — taksite mi (taksitten düşer), taksit dışı mı (carinin
  // hesabına). Böylece taksitli kişinin parası yanlışlıkla taksit dışı yazılıp taksit "ödenmemiş" görünmez.
  function collect(account) {
    const open = account.plans.filter(plan => plan.status === "active" && plan.totals.remaining > 0.005);
    if (!open.length || !HOF.plans?.collect) return editEntry(account, { kind: "in" });
    const chooser = HOF.modal({
      title: "Tahsilat",
      eyebrow: account.name,
      body: `<p class="hof-modal-text">Bu carinin açık taksit kartı var. Taksit ödemesiyse <b>taksite yazın</b>: tutar o taksitten düşer, Kasa’ya tek kayıt olarak girer.</p>
        <div class="hof-acc-choices">${open.map(plan => `<button type="button" class="hof-acc-choice" data-plan="${esc(plan.id)}"><b>Taksite yaz · ${esc(plan.name)}</b><small>Kalan ${esc(money(plan.totals.remaining))}${plan.next ? ` · sıradaki ${esc(HOF.formatDate(plan.next.dueDate))}` : ""}${plan.totals.overdueCount ? ` · ${plan.totals.overdueCount} taksit gecikti` : ""}</small></button>`).join("")}
        <button type="button" class="hof-acc-choice is-plain" data-plain><b>Taksit dışı tahsilat</b><small>Carinin hesabına yazılır (ör. ek hizmet, borç yazılan tutar)</small></button></div>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button></div>`,
    });
    chooser.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-plan], [data-plain], [data-close]");
      if (!button) return;
      chooser.close();
      if ("plain" in button.dataset) return editEntry(account, { kind: "in" });
      if (!button.dataset.plan) return;
      try {
        HOF.plans.collect(await HOF.api(`/api/workspace/plans/${encodeURIComponent(button.dataset.plan)}`));
      } catch (error) {
        HOF.toastError(error);
      }
    });
  }
  async function deleteEntry(account, entry) {
    const ok = await HOF.confirm({ title: "Hareketi sil", message: `${money(entry.amount)} tutarındaki ${ENTRY_LABEL[entry.kind].toLocaleLowerCase("tr-TR")} silinecek; bakiye${entry.kind === "in" || entry.kind === "out" ? " ve Kasa" : ""} yeniden hesaplanır. Yönetim → Silinenler’den geri yüklenebilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyAccount(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" }));
      HOF.toast("Hareket silindi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function setStatus(account, status) {
    try {
      applyAccount(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`, { method: "PUT", body: { status } }));
      HOF.toast(status === "passive" ? "Cari pasife alındı; Pasif sekmesinde durur." : "Cari yeniden aktif.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deleteAccount(account) {
    const ok = await HOF.confirm({ title: "Cariyi sil", message: `“${account.name}” silinecek. Hareketleri Kasa’dan düşer; Yönetim → Silinenler’den geri yüklenebilir. Taksit kartı olan cari silinmez.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" });
      HOF.toast("Cari silindi.", { type: "success" });
      view.mode = "list";
      view.id = "";
      renderList();
      loadList();
      HOF.emit("accounts-changed", {});
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Toplu taksitlendirme ----------
  function bulkPlan() {
    const ids = [...view.selected];
    const all = view.selectAll;
    const total = all ? view.list?.total || 0 : ids.length;
    if (!total) return;
    const labels = view.list?.fieldLabels || [];
    const names = view.list.accounts.filter(item => all || view.selected.has(item.id)).map(item => item.name);
    HOF.formModal({
      title: "Seçilenlere taksit planı",
      eyebrow: `${total} CARİ`,
      size: "wide",
      introHtml: `<p class="hof-modal-text">Her seçili cariye ayrı bir taksit kartı açılır ve taksitleri dağıtılır. Seçilenler: <b>${esc(names.slice(0, 6).join(", "))}${names.length > 6 ? ` ve ${names.length - 6} kişi daha` : ""}</b>.</p>`,
      fields: [
        { name: "amountMode", label: "Tutar", type: "select", value: labels.length ? "field" : "fixed", options: [{ value: "fixed", label: "Herkese aynı toplam tutar" }, ...(labels.length ? [{ value: "field", label: "Her carinin kendi kartındaki alandan" }] : [])] },
        { name: "total", label: "Toplam tutar (₺)", inputmode: "decimal", placeholder: "Örn. 12.000,00" },
        ...(labels.length ? [{ name: "field", label: "Tutarın okunacağı alan", type: "select", value: labels.find(label => /ücret|tutar|bedel|fiyat|borç/i.test(label)) || labels[0], options: labels.map(label => ({ value: label, label })), help: "Ör. Excel’den gelen “SERVİS ÜCRETİ”. Alanı boş olan cari atlanır ve raporda yazılır." }] : []),
        { name: "count", label: "Taksit sayısı", required: true, inputmode: "numeric", placeholder: "Örn. 9" },
        { name: "firstDue", label: "İlk vade", type: "date", required: true, value: office().todayIso?.() || "" },
        { name: "everyMonths", label: "Aralık", type: "select", value: "1", options: [{ value: "1", label: "Her ay" }, { value: "2", label: "2 ayda bir" }, { value: "3", label: "3 ayda bir" }, { value: "6", label: "6 ayda bir" }, { value: "12", label: "Yılda bir" }] },
        { name: "name", label: "Kart adına ek (isteğe bağlı)", maxlength: 60, placeholder: "Örn. 2026-2027 servis", help: "Yazılırsa kart adı “Ad Soyad · ek” olur." },
        { name: "skipExisting", label: "Açık taksit kartı olan cariyi atla (çift plan açılmasın)", type: "checkbox", value: true },
      ],
      submitLabel: "Taksit planlarını aç",
      onOpen: dialog => {
        const mode = dialog.querySelector('select[name="amountMode"]');
        const total = dialog.querySelector('input[name="total"]').closest(".hof-field");
        const field = dialog.querySelector('select[name="field"]')?.closest(".hof-field");
        const sync = () => {
          total.hidden = mode.value !== "fixed";
          if (field) field.hidden = mode.value !== "field";
        };
        mode.addEventListener("change", sync);
        sync();
      },
      onSubmit: async data => {
        const result = await HOF.api("/api/workspace/accounts/bulk-plan", { method: "POST", body: { ...(all ? { all: true, ...filterBody() } : { ids }), ...data, skipExisting: Boolean(data.skipExisting) } });
        view.selected.clear();
        view.selectAll = false;
        loadList();
        HOF.emit("plans-changed", {});
        HOF.dues?.reloadSoon?.(300);
        const skipped = result.skipped.length ? ` ${result.skipped.length} cari atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
        HOF.toast(`${result.created} taksit kartı açıldı, toplam ${money(result.total)}.${skipped}`, { type: result.created ? "success" : "error", timeout: 10000 });
      },
    });
  }

  // ---------- Excel'den ve tablodan toplu alım ----------
  const ROLE_OPTIONS = [["", "— Kullanma —"], ["extra", "Ek alan (kartta aynı adla)"], ["name", "Ad Soyad / Unvan *"], ["seq", "Cari No"], ["phone", "Telefon"], ["email", "E-posta"], ["address", "Adres"], ["registered", "Kayıt tarihi"], ["group", "Grup"], ["subgroup", "Alt grup"], ["type", "Tür (müşteri/tedarikçi)"], ["balance", "Açılış bakiyesi"], ["note", "Bilgi notu"]];
  async function importFromExcel() {
    const source = await office().chooseSheet?.({ title: "Carileri toplu yükle", eyebrow: moduleName().toLocaleUpperCase("tr-TR"), hint: "Binlerce kişi ya da firma tek seferde açılır; taksit sorulmaz. Excel’deki her kolon kartta görünür. Kolonları bir sonraki adımda eşlersiniz." });
    if (!source) return;
    try {
      const preview = await HOF.api("/api/workspace/accounts/import/preview", { method: "POST", body: { matrix: source.matrix } });
      mappingForm({ fileName: source.fileName, matrix: source.matrix, preview });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Ortadaki tablonun açık sekmesi: her satır bir cari, kaydına bağlı (kişinin kartında carisi görünür).
  async function importFromTable() {
    const rows = HOF.data?.rows || [];
    const tab = HOF.activeTab?.() || "";
    const scope = rows.filter(row => row.__hofKey && (!tab || row.__sheet === tab));
    if (!scope.length) return HOF.toast("Açık sekmede kayıt yok.", { type: "error" });
    const headers = [];
    for (const row of scope) for (const key of Object.keys(row)) if (!key.startsWith("__") && !headers.includes(key)) headers.push(key);
    const label = column => HOF.columnLabel?.(column) || column;
    const matrix = [headers.map(label), ...scope.map(row => headers.map(key => String(row[key] ?? "")))];
    const caseKeys = scope.map(row => row.__hofKey);
    const caseTitles = scope.map(row => HOF.plans?.recordLabel?.(row) || "");
    try {
      const preview = await HOF.api("/api/workspace/accounts/import/preview", { method: "POST", body: { matrix } });
      mappingForm({ fileName: tab ? `Tablo: ${tab}` : "Tablo", matrix, preview, caseKeys, caseTitles });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // Doğrulama kapısı (v2.0.6): eşleme değiştikçe sunucu satır bazlı raporu yeniler; hatalı satırlar alınmaz, uyarılılar alınır.
  const gateHtml = gate => {
    if (!gate) return "";
    const tone = gate.errors ? "is-error" : gate.warnings ? "is-warn" : "is-ok";
    const rows = gate.issues.slice(0, 30).map(issue => `<tr class="is-${esc(issue.level)}"><td>${issue.row}</td><td>${esc(issue.column)}</td><td>${esc(issue.problem)}</td><td>${esc(issue.value)}</td></tr>`).join("");
    return `<div class="hof-gate ${tone}"><div class="hof-gate-sum"><b>${gate.ready.toLocaleString("tr-TR")}</b> satır hazır${gate.errors ? ` · <b class="hof-cash-out">${gate.errors.toLocaleString("tr-TR")}</b> satır hatalı (alınmaz)` : ""}${gate.warnings ? ` · <b>${gate.warnings.toLocaleString("tr-TR")}</b> uyarı (alınır, raporlanır)` : ""}${gate.empty ? ` · ${gate.empty} boş satır` : ""}</div>${gate.issues.length ? `<details ${gate.errors ? "open" : ""}><summary>Satır bazlı rapor${gate.truncated ? ` (ilk ${gate.issues.length})` : ""}</summary><div class="hof-gate-list"><table class="hof-table"><thead><tr><th>Satır</th><th>Kolon</th><th>Sorun</th><th>Değer</th></tr></thead><tbody>${rows}</tbody></table>${gate.issues.length > 30 ? `<p class="hof-muted">… ${gate.issueTotal - 30} sorun daha; yükleme sonrası raporda tamamı sayılır.</p>` : ""}</div></details>` : ""}</div>`;
  };
  const wireGate = (dialog, preview, matrix, url) => {
    const box = HOF.el("div", { class: "hof-field hof-gate-field" }, gateHtml(preview.gate));
    dialog.querySelector(".hof-form .hof-actions").before(box);
    let timer = 0;
    dialog.addEventListener("change", event => {
      if (!event.target.closest('select[name^="c"]')) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          const value = dialog.querySelector(`select[name="c${index}"]`)?.value;
          if (value) roles[index] = value;
        });
        try {
          const next = await HOF.api(url, { method: "POST", body: { matrix, roles } });
          box.innerHTML = gateHtml(next.gate);
        } catch {
          // kapı yenilenemezse eski rapor kalır
        }
      }, 300);
    });
  };
  function mappingForm({ fileName, matrix, preview, caseKeys = null, caseTitles = null }) {
    const sample = matrix[preview.headerAt + 1] || [];
    HOF.formModal({
      title: caseKeys ? "Tablodan cari al: kolonları eşle" : "Excel’den cari yükle: kolonları eşle",
      eyebrow: fileName,
      size: "wide",
      intro: `${preview.rows} satır bulundu. Her satır bir cari olur; taksit sorulmaz. Program başlıkları tanıdı; yanlışsa değiştirin. <b>Ek alan</b> seçilen her kolon kartta aynı adla görünür (ör. Veli, Okul, Servis ücreti) ve toplu taksitlendirmede tutar olarak kullanılabilir.${caseKeys ? " Her cari tablodaki kaydına bağlanır." : ""}`,
      fields: [
        ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, text]) => ({ value, label: text })) })),
        { name: "type", label: "Tür kolonu yoksa", type: "select", value: "customer", options: Object.entries(TYPES).map(([value, text]) => ({ value, label: text })) },
        { name: "mode", label: "Aynı cari zaten varsa", type: "select", value: "skip", options: [{ value: "skip", label: "Atla (eskisi olduğu gibi kalır)" }, { value: "update", label: "Güncelle (dolu gelen bilgiler yazılır)" }], help: "Aynı cari: aynı tablodaki kayıt, aynı Cari No ya da aynı ad + aynı telefon. Emin olunamayan satır yeni cari açar." },
        { name: "groupName", label: "Grup kolonu yoksa hepsi bu gruba", maxlength: 80, placeholder: "İsteğe bağlı" },
      ],
      submitLabel: "Carileri oluştur",
      onOpen: dialog => {
        dialog.classList.add("hof-import-form");
        wireGate(dialog, preview, matrix, "/api/workspace/accounts/import/preview");
      },
      onSubmit: async data => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          if (data[`c${index}`]) roles[index] = data[`c${index}`];
        });
        if (!Object.values(roles).includes("name")) throw new Error("Ad Soyad / Unvan kolonunu seçin.");
        const result = await HOF.api("/api/workspace/accounts/import", { method: "POST", body: { matrix, headerAt: preview.headerAt, roles, type: data.type, mode: data.mode, groupName: data.groupName, fileName, ...(caseKeys ? { caseKeys, caseTitles } : {}) } });
        view.status = "all";
        view.mode = "list";
        if (!modal) open();
        else {
          renderList();
          loadList();
        }
        const parts = [`${result.created} cari açıldı`];
        if (result.updated) parts.push(`${result.updated} güncellendi`);
        if (result.linked) parts.push(`${result.linked} kayda bağlandı`);
        if (result.balances) parts.push(`${result.balances} açılış bakiyesi yazıldı`);
        if (result.truncated) parts.push(`${result.truncated} satır sınır dışı kaldı (tek seferde en çok 250.000 satır; kalanı ikinci yüklemede)`);
        if (result.renumbered) parts.push(`${result.renumbered} carinin numarası başka caride kullanıldığı için yeni numara verildi`);
        if (result.groups) parts.push(`${result.groups} grup tanımlandı`);
        const skipped = result.skipped.length ? ` ${result.skippedTotal || result.skipped.length} satır atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
        HOF.toast(`${parts.join(", ")}.${skipped}`, { type: result.created || result.updated ? "success" : "error", timeout: 10000 });
      },
    });
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const check = event.target.closest("input[data-select], input[data-select-all]");
    if (check) {
      if (check.dataset.selectAll !== undefined) {
        view.selectAll = check.checked && Boolean(view.list?.hasMore);
        for (const item of view.list?.accounts || []) check.checked ? view.selected.add(item.id) : view.selected.delete(item.id);
        return renderList();
      }
      view.selectAll = false;
      check.checked ? view.selected.add(check.dataset.select) : view.selected.delete(check.dataset.select);
      const bar = body()?.querySelector("[data-selbar]");
      if (bar) bar.outerHTML = selectBar();
      return;
    }
    if (event.target.closest(".hof-acc-check")) return;
    const chequeLink = event.target.closest("[data-open-cheque]");
    if (chequeLink) {
      modal.close();
      return HOF.cheques?.open({ id: chequeLink.dataset.openCheque });
    }
    const planRow = event.target.closest("[data-open-plan]");
    if (planRow) {
      modal.close();
      return HOF.plans?.open(planRow.dataset.openPlan);
    }
    const row = event.target.closest("tr[data-account]");
    if (row && view.mode === "list") return loadAccount(row.dataset.account);
    const button = event.target.closest("button, a[data-act]");
    if (!button) return;
    const account = view.account;
    if (button.dataset.status) {
      view.status = button.dataset.status;
      renderList();
      return loadList();
    }
    if (button.dataset.print) return office().printPdf?.(button.dataset.print === "list" ? listPdfUrl() : cardPdfUrl(account));
    if (button.dataset.ledgerFilter) {
      view.ledgerFilter = button.dataset.ledgerFilter;
      return renderCard();
    }
    if ("close" in button.dataset) return modal.close();
    if (button.dataset.entry && account) return button.dataset.entry === "in" ? collect(account) : editEntry(account, { kind: button.dataset.entry });
    const act = button.dataset.act;
    if (act === "back") {
      view.mode = "list";
      view.id = "";
      renderList();
      return loadList();
    }
    if (act === "new") return editAccount(null);
    if (act === "import") return importFromExcel();
    if (act === "fromTable") return importFromTable();
    if (act === "bulkPlan") return bulkPlan();
    if (act === "more") return loadList({ more: true });
    if (act === "clearSel") {
      view.selected.clear();
      view.selectAll = false;
      return renderList();
    }
    if (!account) return;
    if (act === "reveal") {
      event.preventDefault();
      modal.close();
      return HOF.revealRecord?.(account.caseKey);
    }
    if (act === "edit") return editAccount(account);
    if (act === "passive") return setStatus(account, "passive");
    if (act === "activate") return setStatus(account, "active");
    if (act === "delete") return deleteAccount(account);
    if (act === "whatsapp") return window.open(`https://wa.me/${button.dataset.wa}`, "_blank", "noopener");
    if (act === "newPlan") {
      modal.close();
      return HOF.plans?.openNew({ accountId: account.id, accountName: account.name, name: account.name, phone: account.phone, groupId: account.groupId || "", subgroupId: account.subgroupId || "", caseKey: account.caseKey, caseTitle: account.caseTitle });
    }
    const entryOf = id => account.entries.find(entry => entry.id === id);
    if (button.dataset.editEntry) return editEntry(account, { entry: entryOf(button.dataset.editEntry) });
    if (button.dataset.deleteEntry) return deleteEntry(account, entryOf(button.dataset.deleteEntry));
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
        // saklanamazsa sıralama yalnız bu pencerede geçerli
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

  HOF.whenReady(() => {
    HOF.on("live:workspace.changed", change => {
      if (!modal || !change) return;
      if (["accounts", "plans", "stock"].includes(change.kind)) {
        if (view.mode === "card" && view.id && (!change.accountId || change.accountId === view.id || change.kind !== "accounts")) loadAccount(view.id);
        else if (view.mode === "list") loadList();
      }
    });
    HOF.on("plans-changed", () => {
      if (!modal) return;
      if (view.mode === "card" && view.id) loadAccount(view.id);
      else loadList();
    });
  });
  HOF.office = Object.assign(HOF.office || {}, { gateHtml, wireGate });
  HOF.accounts = {
    open,
    picker,
    forCase: key => HOF.api(`/api/workspace/cases/${encodeURIComponent(key)}/account`),
    newFor: preset => (canManage() ? editAccount(null, preset) : HOF.toast("Cari açmak yönetici, uzman ve muhasebe yetkisidir.", { type: "error" })),
    collect: async accountId => {
      try {
        collect(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(accountId)}`));
      } catch (error) {
        HOF.toastError(error);
      }
    },
  };
})();
