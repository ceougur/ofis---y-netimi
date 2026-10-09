/* DestekOfis — Banka (v2.1.0; docs/BANKA-MODULU-PLAN.md §8). Sol menüde Taksitler'in hemen altında (kullanıcı kararı, K13).
 * Pencere sekmeleri: Genel Bakış · Hesaplar · Ayarlar. Hareketler sekmesi (İşlem Kartı) Aşama 4'te gelir; POS ile Ekstre ve Mutabakat
 * sekmeleri o özellikler gelince görünür (yarım özellik görünmez, §12.1).
 *  - Genel Bakış (K10): ana değer Gerçek Banka (banka hesaplarının 102 bakiyeleri); Kart ve Kredi Borcu yalnız kart/kredi hesabı varsa;
 *    Hesabı Atanmamış Eski Hareketler ayrı satırda, hiçbir toplama girmez ("Şimdi Düzenle").
 *  - Hesaplar: liste, hesap kartı (aç, düzelt, Pasife Al, sil), Hesap Detayı (son hareketler, Açılışı Düzelt), Alt Hesap Mizanı.
 *  - Ayarlar: Temel ve Gelişmiş; standartlar seçili gelir; bölüm bölüm ve tümü "Varsayılanlara Dön" (kullanıcı kararı).
 *  - Kurulum Sihirbazı: Banka'yı ilk açan hesap yetkilisine bir kez (kişi ve şirket bazında, sunucuda); her adım atlanabilir, atlanırsa
 *    Genel Bakış'ta "Kurulumu Tamamla" kalır. Eski Hareketleri Aktar adımı yalnız hesabı atanmamış hareket varsa.
 *  - Ortak hesap seçici (HOF.bank.pickerHtml / mountPicker; K13): tek hesapta gizli, hiç hesap yoksa bugünkü görünüm; sonraki aşamaların
 *    tahsilat/ödeme formları kullanır.
 * Kurallar sunucuda (server/lib/bank/accounts.mjs, settings.mjs); ekran yalnız gösterir, pasif düğmenin nedeni yanında yazılır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const BASE = "/api/workspace/bank";
  // Sekme sırası (§8.2). "movements" (Hareketler) Aşama 4'te bu listeye Hesaplar'dan sonra eklenir.
  const TABS = [
    ["overview", "Genel Bakış"],
    ["accounts", "Hesaplar"],
    ["settings", "Ayarlar"],
  ];
  const KINDS = [
    ["demand", "Vadesiz"],
    ["commercial", "Ticari"],
    ["time", "Vadeli"],
    ["fx", "Döviz"],
    ["loan", "Kredi Hesabı"],
    ["card", "Kurumsal Kredi Kartı"],
    ["other", "Diğer"],
  ];
  const CURRENCIES = [
    ["TRY", "TL"],
    ["USD", "USD"],
    ["EUR", "EUR"],
    ["GBP", "GBP"],
  ];
  const POLICY_LABELS = { warn: "Uyar", block: "Engelle", off: "Kontrol Yok" };
  const STATUS_CHIPS = [
    ["active", "Etkin"],
    ["passive", "Pasif"],
    ["all", "Tümü"],
  ];
  const KEYWORD_GROUPS = [
    ["pos", "POS"],
    ["cash", "Nakit"],
    ["transfer", "Virman"],
    ["fee", "Ücret"],
    ["interest", "Faiz"],
  ];
  const BANK_NAMES = ["Akbank", "Albaraka Türk", "Denizbank", "Enpara.com", "Fibabanka", "Garanti BBVA", "Halkbank", "HSBC", "ING", "İş Bankası", "Kuveyt Türk", "Odeabank", "QNB", "Şekerbank", "TEB", "Türkiye Finans", "VakıfBank", "Vakıf Katılım", "Yapı Kredi", "Ziraat Bankası", "Ziraat Katılım"];
  // 102 ailesi (Gerçek Banka'ya giren hesaplar); kart 309, kredi 300 (Kart ve Kredi Borcu).
  const MAIN_KINDS = new Set(["demand", "commercial", "time", "fx", "other"]);
  const BINDABLE_KINDS = new Set(["demand", "commercial", "other"]);
  // Sunucunun alan adı (HttpError field) → formdaki alan.
  const FIELD_OF = { iban: "iban", code: "code", currency: "currency", kind: "kind", "Banka Adı": "bankName", "Hesap Adı": "name", date: "openingDate", "Açılış Tarihi": "openingDate", "Açılış Bakiyesi": "openingAmount", "Açılış Kuru": "openingRate", Limit: "creditLimit", "Ekstre Kesim Günü": "statementDay", "Son Ödeme Günü": "dueDay", negativePolicy: "negativePolicy" };

  // Alanı yazmayan hatalar (tarih, kilit) koddan alana bağlanır.
  const FIELD_OF_CODE = { "date-future": "openingDate", "date-invalid": "openingDate", "date-missing": "openingDate", "period-locked": "openingDate", "bank-opening-after-first": "openingDate", "rate-invalid": "openingRate" };

  let modal = null;
  let wizard = null;
  let ticket = 0;
  let wizardOffered = false;
  let choicesCache = null;
  const view = { tab: "overview", mode: "tab", accountId: "", status: "active", summary: null, list: null, account: null, settings: null, choices: null, legacy: null, runs: null, error: "", advanced: false, dirty: false, selected: new Set(), legacyTarget: "" };

  const moduleName = () => HOF.uiLabel?.("side.bank", "Banka") || "Banka";
  const root = () => modal?.dialog.querySelector("[data-bank]");
  const canAccounts = () => HOF.can("bank.accounts");
  const api = (path, options) => HOF.api(`${BASE}${path}`, options);
  const decimal = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (minor, currency = "TRY") => {
    const value = Number(minor || 0) / 100;
    if (!currency || currency === "TRY") return HOF.formatMoney(value);
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  };
  const signed = (minor, currency) => `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${fmt(Math.abs(minor), currency)}`;
  const amountInput = minor => (minor ? decimal.format(Number(minor) / 100) : "");
  const kindLabel = kind => KINDS.find(([id]) => id === kind)?.[1] || kind;
  const currencyLabel = code => CURRENCIES.find(([id]) => id === code)?.[1] || code;
  const dateText = value => (value ? HOF.formatDate(`${value}T12:00:00`) : "—");
  const td = (label, html, cls = "") => `<td data-label="${esc(label)}"${cls ? ` class="${cls}"` : ""}>${html}</td>`;
  const accountLabel = account => `${account.bankName} · ${account.name}`;
  const openingLabel = kind => (kind === "card" || kind === "loan" ? "Açılıştaki Borç" : "Açılış Bakiyesi");
  const limitLabel = kind => (kind === "card" ? "Kart Limiti" : kind === "loan" ? "Kredi Limiti" : "KMH Limiti");

  // ---------- Pencere ----------
  function open({ tab = "", accountId = "", legacy = false } = {}) {
    if (!HOF.can("bank.view")) return HOF.toast("Banka penceresi Banka Görüntüleme yetkisi olan hesaplara açıktır.", { type: "error" });
    if (!modal) {
      // Pencere her açılışta Genel Bakış'la başlar (ya da istenen sekme/hesapla); son sekme hatırlanmaz.
      view.tab = "overview";
      view.mode = "tab";
      modal = HOF.modal({
        title: moduleName(),
        eyebrow: "OPERASYON",
        size: "wide",
        body: '<div class="hof-bank" data-bank><p class="hof-empty">Yükleniyor…</p></div>',
        onClose: () => {
          modal = null;
          view.mode = "tab";
          view.accountId = "";
          view.account = null;
          view.dirty = false;
          view.selected = new Set();
        },
      });
      modal.dialog.classList.add("hof-bank-modal");
      modal.dialog.addEventListener("click", onClick);
      modal.dialog.addEventListener("change", onChange);
      modal.dialog.addEventListener("input", onInput);
      modal.dialog.addEventListener("keydown", event => {
        const row = event.target.closest?.("tr[data-account]");
        if (event.key === "Enter" && row) openAccount(row.dataset.account);
      });
    }
    if (tab) setTab(tab, { load: false });
    if (accountId) {
      view.mode = "account";
      view.accountId = accountId;
    } else if (legacy) view.mode = "legacy";
    render();
    return reload({ first: true });
  }
  const viewKey = () => `${view.mode}|${view.tab}|${view.accountId}`;

  /** Pencerenin verisi: özet ve hesaplar her zaman; görünüme göre hesap kartı, eski hareketler ya da ayarlar. */
  async function reload({ quiet = false, first = false } = {}) {
    const own = quiet ? ticket : ++ticket;
    const key = viewKey();
    const options = quiet ? { background: true } : {};
    try {
      const [summary, list] = await Promise.all([api("/summary", options), api("/accounts?status=all", options)]);
      const next = { summary, list };
      if (view.mode === "account" && view.accountId) next.account = await api(`/accounts/${encodeURIComponent(view.accountId)}`, options);
      if (view.mode === "legacy") [next.legacy, next.runs] = await Promise.all([api("/legacy", options), api("/setup", options).then(data => data.runs)]);
      const settingsTab = view.mode === "tab" && view.tab === "settings";
      if (settingsTab && !view.dirty) [next.settings, next.choices] = await Promise.all([api("/settings", options), api("/choices", options)]);
      if (!modal || own !== ticket || key !== viewKey()) return;
      // Ayarlar düzenlenirken arka plan yenilemesi formu ezmez (kaydedilmemiş değişiklik kaybolmasın): veri alınır, ekran çizilmez.
      const keepForm = settingsTab && view.dirty;
      if (keepForm) delete next.settings;
      Object.assign(view, next, { error: "" });
      if (view.legacy) view.selected = new Set([...view.selected].filter(id => view.legacy.rows.some(row => rowKey(row) === id && canPick(row))));
      if (!keepForm) render();
      if (first) maybeWizard();
    } catch (error) {
      if (!modal || own !== ticket || key !== viewKey()) return;
      if (quiet && !HOF.lostRecord(error)) throw error;
      if (view.mode === "account" && error.status === 404) {
        HOF.toastError(error);
        view.mode = "tab";
        view.tab = "accounts";
        view.accountId = "";
        view.account = null;
        return reload();
      }
      view.error = error.message;
      render();
    }
  }

  function setTab(tab, { load = true } = {}) {
    if (!TABS.some(([id]) => id === tab)) return;
    view.tab = tab;
    view.mode = "tab";
    view.accountId = "";
    view.account = null;
    if (tab !== "settings") view.dirty = false;
    if (load) {
      render();
      reload();
    }
  }
  function openAccount(id) {
    view.mode = "account";
    view.accountId = id;
    view.account = null;
    render();
    reload();
  }

  function render() {
    const node = root();
    if (!node) return;
    const content = view.mode === "account" ? accountHtml() : view.mode === "legacy" ? legacyHtml() : view.tab === "accounts" ? accountsHtml() : view.tab === "settings" ? settingsHtml() : overviewHtml();
    const tabs = `<div class="hof-bank-tabs" role="tablist" aria-label="Banka bölümleri">${TABS.map(([id, label]) => `<button type="button" role="tab" class="hof-rep-chip ${view.mode === "tab" && view.tab === id ? "is-on" : ""}" aria-selected="${view.mode === "tab" && view.tab === id}" data-tab="${id}">${esc(label)}</button>`).join("")}</div>`;
    HOF.swap(node, `${tabs}<div class="hof-bank-body">${content}</div>`);
  }

  // ---------- Genel Bakış (K10) ----------
  function overviewHtml() {
    const s = view.summary;
    if (!s) return HOF.listPending(view.error);
    const accounts = view.list?.accounts || [];
    const mains = accounts.filter(account => MAIN_KINDS.has(account.kind));
    const debts = accounts.filter(account => !MAIN_KINDS.has(account.kind));
    const labels = s.labels || {};
    const active = mains.filter(account => account.status === "active").length;
    const tiles = [
      `<div class="hof-rep-stat hof-bank-real is-in"><span>${esc(labels.realBank || "Gerçek Banka")}</span><strong data-bank-real>${s.realBank.defined ? esc(fmt(s.realBank.minor)) : "—"}</strong><small>${s.realBank.defined ? `${active} etkin hesap · TL karşılığı` : "Banka Hesabı Tanımlanmadı"}</small></div>`,
    ];
    if (debts.length) tiles.push(`<div class="hof-rep-stat is-out"><span>${esc(labels.debt || "Kart ve Kredi Borcu")}</span><strong data-bank-debt>${esc(fmt(s.debt.totalMinor))}</strong><small>Kart ${esc(fmt(s.debt.cardMinor))} · Kredi ${esc(fmt(s.debt.loanMinor))}</small></div>`);
    const rows = [];
    if (s.setup?.needed) {
      rows.push(
        canAccounts()
          ? `<div class="hof-bank-row is-setup" data-bank-setup><div><b>Kurulumu Tamamla</b><small>Banka hesaplarınızı ve açılış bakiyelerini girin; hesap tanımlanmadan girilmiş eski hareketleri hesaba aktarın.</small></div><button type="button" class="hof-button hof-button-small" data-act="wizard">Kurulumu Tamamla</button></div>`
          : '<div class="hof-bank-row is-setup"><div><b>Kurulum Bekliyor</b><small>Banka hesaplarını Banka Hesabı Tanımlama yetkisi olan kişi tanımlar.</small></div></div>',
      );
    }
    const unassigned = s.unassigned || { totalMinor: 0 };
    if (unassigned.totalMinor || unassigned.newCount) {
      rows.push(`<div class="hof-bank-row is-unassigned" data-bank-unassigned><div><b>${esc(labels.unassigned || "Hesabı Atanmamış Eski Hareketler")}</b> <strong>${esc(fmt(unassigned.totalMinor))}</strong>
        <small>Havale / EFT (102.00) ${esc(fmt(unassigned.bankMinor))} · POS / Kart (108.00) ${esc(fmt(unassigned.cardMinor))} — Gerçek Banka'ya ve hiçbir toplama girmez.${unassigned.newCount ? ` Hesabı belirsiz yeni hareket: ${unassigned.newCount}.` : ""}</small></div>
        <button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="legacy">Şimdi Düzenle</button></div>`);
    }
    let table = "";
    if (mains.length) {
      const groups = new Map();
      for (const account of mains) {
        if (!groups.has(account.bankName)) groups.set(account.bankName, []);
        groups.get(account.bankName).push(account);
      }
      const body = [...groups.entries()]
        .map(([bank, list]) => {
          const lines = list
            .map(account => `<tr data-account="${esc(account.id)}" tabindex="0" class="${account.status === "passive" ? "is-passive" : ""}">
              ${td("Banka", esc(bank))}
              ${td("Hesap", `<b>${esc(account.name)}</b> <small>${esc(account.code)} · ${esc(account.glSub)}${account.status === "passive" ? " · Pasif" : ""}</small>`)}
              ${td("Para Birimi", esc(currencyLabel(account.currency)))}
              ${td("Gerçek Bakiye", esc(fmt(account.currency === "TRY" ? account.balanceMinor : account.fxBalanceMinor, account.currency)), "num")}
              ${td("TL Karşılığı", esc(fmt(account.balanceMinor)), "num")}
              ${td("Son Hareket", esc(account.lastMovementDate ? dateText(account.lastMovementDate) : "—"))}
            </tr>`)
            .join("");
          const sub = list.length > 1 ? `<tr class="hof-bank-subtotal"><td colspan="4" data-label="Ara Toplam">Ara Toplam · ${esc(bank)}</td>${td("TL Karşılığı", esc(fmt(list.reduce((sum, account) => sum + account.balanceMinor, 0))), "num")}<td class="hof-bank-blank"></td></tr>` : "";
          return lines + sub;
        })
        .join("");
      const totals = (s.byCurrency || []).map(item => `<tr class="hof-bank-total"><td colspan="3" data-label="Toplam">Toplam ${esc(currencyLabel(item.currency))}</td>${td("Gerçek Bakiye", esc(fmt(item.currency === "TRY" ? item.tryMinor : item.fxMinor, item.currency)), "num")}${td("TL Karşılığı", esc(fmt(item.tryMinor)), "num")}<td class="hof-bank-blank"></td></tr>`).join("");
      table = `<h4 class="hof-bank-subtitle">Banka Hesapları</h4><div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Banka</th><th>Hesap</th><th>Para Birimi</th><th class="num">Gerçek Bakiye</th><th class="num">TL Karşılığı</th><th>Son Hareket</th></tr></thead><tbody>${body}</tbody><tfoot>${totals}</tfoot></table></div>`;
    }
    if (debts.length) {
      table += `<h4 class="hof-bank-subtitle">Kart ve Kredi Hesapları</h4><div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Banka</th><th>Hesap</th><th>Tür</th><th class="num">Borç</th></tr></thead><tbody>${debts
        .map(account => `<tr data-account="${esc(account.id)}" tabindex="0">${td("Banka", esc(account.bankName))}${td("Hesap", `<b>${esc(account.name)}</b> <small>${esc(account.code)} · ${esc(account.glSub)}</small>`)}${td("Tür", esc(account.kindLabel))}${td("Borç", esc(fmt(-account.balanceMinor)), "num")}</tr>`)
        .join("")}</tbody></table></div>`;
    }
    // Boş durum yalnız anlatır; tek düğme yukarıdaki "Kurulumu Tamamla" satırında (kart kalabalığı yok, talimat 35).
    const empty = accounts.length
      ? ""
      : '<div class="hof-bank-empty" data-bank-empty><h4>Henüz Banka Hesabı Yok</h4><p>Banka hesaplarınızı ve açılış bakiyelerini Kurulum Sihirbazı ile birkaç adımda girin. Hesap tanımlanana kadar havale / EFT ile girilen tahsilat ve ödemeler “Hesabı Atanmamış Eski Hareketler”de toplanır.</p></div>';
    return `<div class="hof-rep-stats hof-bank-stats">${tiles.join("")}</div>${rows.join("")}${empty}${table}
      <p class="hof-rep-note">Gerçek Banka: banka hesaplarınızın (102) defter bakiyelerinin toplamı. Hesabı atanmamış eski hareketler bu toplama girmez.</p>`;
  }

  // ---------- Hesaplar ----------
  function accountsHtml() {
    if (!view.list) return HOF.listPending(view.error);
    const shown = view.list.accounts.filter(account => view.status === "all" || account.status === view.status);
    const tools = [
      canAccounts() ? '<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Hesap</button>' : "",
      canAccounts() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="wizard">Kurulum Sihirbazı</button>' : "",
      // Hesabı atanmamış eski hareket ya da geri alınabilir kurulum varsa (Genel Bakış'taki satır bakiye sıfırken görünmez).
      canAccounts() && (view.summary?.unassigned?.totalMinor || view.summary?.setup?.runs) ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="legacy">Eski Hareketler</button>' : "",
      HOF.can("bank.reports") ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="subtrial">Alt Hesap Mizanı</button>' : "",
    ].join("");
    const rows = shown
      .map(
        account => `<tr data-account="${esc(account.id)}" tabindex="0" class="${account.status === "passive" ? "is-passive" : ""}">
          ${td("Kod", `<b>${esc(account.code)}</b>`)}
          ${td("Banka ve Hesap", `${esc(accountLabel(account))}${account.branchName ? `<small>${esc(account.branchName)}</small>` : ""}`)}
          ${td("Tür", esc(account.kindLabel))}
          ${td("Para Birimi", esc(currencyLabel(account.currency)))}
          ${td("IBAN", account.ibanText ? `<span class="hof-bank-iban">${esc(account.ibanText)}</span>` : "—")}
          ${td("Alt Hesap", esc(account.glSub))}
          ${td("Bakiye", `${esc(fmt(MAIN_KINDS.has(account.kind) ? (account.currency === "TRY" ? account.balanceMinor : account.fxBalanceMinor) : -account.balanceMinor, account.currency))}${MAIN_KINDS.has(account.kind) ? "" : "<small>borç</small>"}`, "num")}
          ${td("Durum", `${account.status === "active" ? '<span class="hof-plan-badge is-done">Etkin</span>' : '<span class="hof-plan-badge is-muted">Pasif</span>'}${account.balanceConfirmed ? '<small class="hof-bank-ok">Bakiye Doğrulandı</small>' : '<small class="is-warn">Doğrulanmadı</small>'}`)}
        </tr>`,
      )
      .join("");
    const empty = view.status === "active" && !view.list.accounts.length ? (canAccounts() ? "Banka hesabı yok. “+ Yeni Hesap” ya da Kurulum Sihirbazı ile ekleyin." : "Banka hesabı yok.") : "Bu süzgeçte hesap yok.";
    return `<div class="hof-bank-toolbar">${tools}<div class="hof-rep-presets" role="group" aria-label="Durum">${STATUS_CHIPS.map(([id, label]) => `<button type="button" class="hof-rep-chip ${view.status === id ? "is-on" : ""}" data-status="${id}">${esc(label)}</button>`).join("")}</div></div>
      <div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-accounts"><thead><tr><th>Kod</th><th>Banka ve Hesap</th><th>Tür</th><th>Para Birimi</th><th>IBAN</th><th>Alt Hesap</th><th class="num">Bakiye</th><th>Durum</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="hof-empty">${esc(empty)}</td></tr>`}</tbody></table></div>
      <p class="hof-rep-note">Hesap Kodu sizindir (ör. ZIR-TL); alt hesap kodunu (102.01) program verir ve değişmez. Satıra tıklayınca hesabın ayrıntısı açılır.</p>`;
  }

  // ---------- Hesap Detayı (§8.5) ----------
  function accountHtml() {
    const a = view.account;
    const back = '<button type="button" class="hof-plan-back" data-act="back">← Hesaplar</button>';
    if (!a) return `<div class="hof-bank-detail-head">${back}</div>${HOF.listPending(view.error)}`;
    const main = MAIN_KINDS.has(a.kind);
    const balance = main ? (a.currency === "TRY" ? a.balanceMinor : a.fxBalanceMinor) : -a.balanceMinor;
    const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "");
    const opening = a.opening;
    const policy = a.balanceConfirmed ? `${esc(POLICY_LABELS[a.policy] || a.policy)}${a.negativePolicy ? "" : " <small>(Banka Ayarlarındaki)</small>"}` : `Kontrol Yok <small>(${esc(a.policyNote)})</small>`;
    const blocks = [];
    const canCancel = HOF.can("bank.cancel");
    const hasOpeningMoney = Boolean(opening && opening.amountMinor);
    let openingBlock = "";
    if (opening && a.openingLocked) openingBlock = `Açılış (${dateText(opening.date)}) kilitli dönemde; ${dateText(a.lockedUntil)} tarihine kadar kayıtlar değiştirilemez.`;
    else if (opening && !canCancel) openingBlock = "Eski açılış ters kaydedilir; Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi gerekir.";
    let deleteBlock = "";
    if (a.movementCount) deleteBlock = `Bu hesaba bağlı ${a.movementCount} hareket var; kullanılmayacaksa Pasife Alın.`;
    else if (hasOpeningMoney && a.openingLocked) deleteBlock = "Hesabın açılışı kilitli dönemde; hesap silinemez.";
    else if (hasOpeningMoney && !canCancel) deleteBlock = "Açılışı olan hesabı silmek için Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi gerekir.";
    if (canAccounts()) {
      if (openingBlock) blocks.push([opening ? "Açılışı Düzelt" : "Açılış Bakiyesi Gir", openingBlock]);
      if (deleteBlock) blocks.push(["Sil", deleteBlock]);
    }
    const button = (act, label, why = "", cls = "hof-button-ghost") => `<button type="button" class="hof-button hof-button-small ${cls}" data-act="${act}" ${why ? `disabled aria-disabled="true" title="${esc(why)}"` : ""}>${esc(label)}</button>`;
    const actions = canAccounts()
      ? [
          button("edit", "Düzenle"),
          button("opening", opening ? "Açılışı Düzelt" : "Açılış Bakiyesi Gir", openingBlock, opening ? "hof-button-ghost" : ""),
          button("status", a.status === "active" ? "Pasife Al" : "Etkinleştir"),
          button("delete", "Sil", deleteBlock, "hof-button-danger-ghost"),
        ].join("")
      : "";
    const recent = (a.recent || [])
      .map(
        item => `<tr class="${item.signedMinor >= 0 ? "is-in" : "is-out"}">
          ${td("Tarih", esc(dateText(item.date)))}
          ${td("Açıklama", esc(item.description || "—"))}
          ${td("İşlem No", item.eventNo ? `<span class="hof-plan-refno">${esc(item.eventNo)}</span>` : "—")}
          ${td("Tutar", `<b>${esc(signed(item.signedMinor))}</b>`, "num")}
        </tr>`,
      )
      .join("");
    return `<div class="hof-bank-detail-head">${back}
        <div class="hof-plan-title"><h3>${esc(accountLabel(a))} <span class="hof-plan-refno">${esc(a.code)}</span> ${a.status === "active" ? '<span class="hof-plan-badge is-done">Etkin</span>' : '<span class="hof-plan-badge is-muted">Pasif</span>'}</h3><small>${esc(a.kindLabel)} · ${esc(currencyLabel(a.currency))} · Alt Hesap ${esc(a.glSub)}</small></div>
        <div class="hof-chq-amount"><span>${main ? "Gerçek Bakiye" : "Borç"}</span><strong data-bank-balance>${esc(fmt(balance, a.currency))}</strong>${a.currency !== "TRY" && main ? `<small>TL karşılığı ${esc(fmt(a.balanceMinor))}</small>` : ""}</div>
      </div>
      <p class="hof-bank-confirm ${a.balanceConfirmed ? "is-ok" : "is-warn"}">${a.balanceConfirmed ? "✓ Bakiye Doğrulandı" : esc(a.policyNote)}</p>
      <dl class="hof-chq-facts">
        ${fact("IBAN", a.ibanText ? `<span class="hof-bank-iban">${esc(a.ibanText)}</span>` : "")}
        ${fact("Şube", esc([a.branchName, a.branchCode].filter(Boolean).join(" · ")))}
        ${fact("Hesap No", esc(a.accountNo))}
        ${fact("Hesap Sahibi", esc(a.holder))}
        ${fact("SWIFT", esc(a.swift))}
        ${fact(limitLabel(a.kind), a.creditLimitMinor ? esc(fmt(a.creditLimitMinor)) : "")}
        ${fact("Ekstre Kesim Günü", a.statementDay ? esc(String(a.statementDay)) : "")}
        ${fact("Son Ödeme Günü", a.dueDay ? esc(String(a.dueDay)) : "")}
        ${fact(openingLabel(a.kind), opening ? `${esc(fmt(opening.amountMinor, a.currency))} · ${esc(dateText(opening.date))}${opening.no ? ` · <span class="hof-plan-refno">${esc(opening.no)}</span>` : ""}` : "Girilmedi")}
        ${fact("Eksi Bakiye Denetimi", policy)}
        ${fact("Faturada", a.showOnInvoice ? "IBAN faturada gösterilir" : "")}
        ${fact("Açıklama", esc(a.description))}
      </dl>
      ${actions ? `<div class="hof-chq-actions" role="toolbar" aria-label="Hesap işlemleri">${actions}</div>` : ""}
      ${blocks.length ? `<ul class="hof-inv-blocks" data-bank-blocks>${blocks.map(([name, why]) => `<li><b>${esc(name)} kapalı:</b> ${esc(why)}</li>`).join("")}</ul>` : ""}
      <h4 class="hof-bank-subtitle">Son Hareketler</h4>
      <div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-recent"><thead><tr><th>Tarih</th><th>Açıklama</th><th>İşlem No</th><th class="num">Tutar</th></tr></thead><tbody>${recent || '<tr><td colspan="4" class="hof-empty">Bu hesapta hareket yok.</td></tr>'}</tbody></table></div>
      ${a.recentTotal > (a.recent || []).length ? `<p class="hof-rep-note">Son ${(a.recent || []).length} hareket gösteriliyor (toplam ${a.recentTotal}).</p>` : ""}`;
  }

  // ---------- Hesabı Atanmamış Eski Hareketler (§10.3) ----------
  const rowKey = row => `${row.table}:${row.id}`;
  const bindableAccounts = () => (view.list?.accounts || []).filter(account => account.status === "active" && account.currency === "TRY" && BINDABLE_KINDS.has(account.kind));
  const legacyTarget = () => bindableAccounts().find(account => account.id === view.legacyTarget) || bindableAccounts()[0] || null;
  // Seçilebilen satır: sunucunun "atanabilir" dediği (havale, açık dönem) ve seçili hesabın açılış gününde ya da sonrasında olan (öncesi
  // açılış bakiyesinin içindedir; sunucu 409 bank-before-opening verir).
  const canPick = (row, target = legacyTarget()) => Boolean(row.assignable && target && row.date >= target.openingDate);
  function legacyHtml() {
    const back = '<button type="button" class="hof-plan-back" data-act="back-overview">← Genel Bakış</button>';
    const data = view.legacy;
    if (!data) return `<div class="hof-bank-detail-head">${back}</div>${HOF.listPending(view.error)}`;
    const targets = bindableAccounts();
    const target = legacyTarget();
    const pickable = row => canPick(row, target);
    const assignable = data.rows.filter(pickable);
    const allOn = assignable.length && assignable.every(row => view.selected.has(rowKey(row)));
    const rows = data.rows
      .map(
        row => `<tr class="${row.kind === "in" ? "is-in" : "is-out"}">
          <td class="hof-bank-check">${pickable(row) && canAccounts() ? `<input type="checkbox" data-pick="${esc(rowKey(row))}" ${view.selected.has(rowKey(row)) ? "checked" : ""} aria-label="Seç">` : ""}</td>
          ${td("Tarih", esc(dateText(row.date)))}
          ${td("Yol", row.way === "bank" ? "Havale / EFT" : "POS / Kart")}
          ${td("Cari / Açıklama", `${esc(row.partyName || "—")}${row.description ? `<small>${esc(row.description)}</small>` : ""}`)}
          ${td("İşlem No", row.eventNo ? `<span class="hof-plan-refno">${esc(row.eventNo)}</span>` : "—")}
          ${td("Tutar", `<b>${esc(signed(row.kind === "in" ? row.amountMinor : -row.amountMinor))}</b>`, "num")}
          ${td("Durum", row.locked ? '<span class="hof-plan-badge is-muted">Kilitli Dönem — Atanamaz</span>' : row.way !== "bank" ? '<span class="hof-plan-badge is-info">Bankaya Geçmiş Say</span>' : target && row.date < target.openingDate ? `<span class="hof-plan-badge is-muted" title="Hesabın açılışı ${esc(dateText(target.openingDate))}; bu hareket açılış bakiyesinin içindedir (Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır).">Açılıştan Önce</span>` : "")}
        </tr>`,
      )
      .join("");
    const runs = (view.runs || [])
      .map(
        run => `<tr>${td("Tarih", esc(dateText(run.date)))}${td("Hesap", esc(run.accountLabel || "—"))}${td("İşlem No", run.no ? `<span class="hof-plan-refno">${esc(run.no)}</span>` : "—")}${td("Aktarılan", esc(run.reclass ? `${run.reclass.mode === "card" ? "Kart Borcuna Aktar" : "Bankaya Geçmiş Say"} ${fmt(run.reclass.amountMinor)}` : `${run.assigned} hareket${run.carry && (run.carry.bankMinor || run.carry.cardMinor) ? ` · Devir Kapanışı ${fmt(run.carry.bankMinor + run.carry.cardMinor)}` : ""}`))}${td("Durum", run.status === "active" ? '<span class="hof-plan-badge is-done">Geçerli</span>' : '<span class="hof-plan-badge is-muted">Geri Alındı</span>')}<td class="hof-bank-actions-cell">${run.status === "active" && canAccounts() ? `<button type="button" class="hof-link-button" data-act="undo" data-run="${esc(run.id)}">Geri Al</button>` : ""}</td></tr>`,
      )
      .join("");
    const tools = canAccounts()
      ? `<div class="hof-bank-toolbar">
          ${targets.length ? `<label class="hof-bank-inline"><span>Hedef Hesap</span><select data-legacy-target>${targets.map(account => `<option value="${esc(account.id)}" ${account.id === target?.id ? "selected" : ""}>${esc(accountLabel(account))} (${esc(account.code)}) · açılış ${esc(dateText(account.openingDate))}</option>`).join("")}</select></label><button type="button" class="hof-button hof-button-small" data-act="assign" ${view.selected.size ? "" : 'disabled title="Önce listeden atanacak hareketleri seçin."'}>Seçilenleri Bu Hesaba Ata (${view.selected.size})</button>` : '<span class="hof-muted">Havale hareketleri etkin bir TL vadesiz, ticari ya da diğer hesaba atanır; önce hesap açın.</span>'}
          ${data.totals.cardMinor > 0 && targets.length ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="reclass-bank">Bankaya Geçmiş Say</button>' : ""}
          ${data.totals.cardMinor < 0 ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="reclass-card">Kart Borcuna Aktar</button>' : ""}
          <button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="wizard">Kurulum Sihirbazı</button>
        </div>`
      : "";
    return `<div class="hof-bank-detail-head">${back}<div class="hof-plan-title"><h3>Hesabı Atanmamış Eski Hareketler</h3><small>Banka hesabı tanımlanmadan girilmiş havale / EFT ve POS hareketleri. Gerçek Banka'ya girmez.</small></div></div>
      <div class="hof-rep-stats hof-bank-stats"><div class="hof-rep-stat"><span>Havale / EFT (102.00)</span><strong>${esc(fmt(data.totals.bankMinor))}</strong></div><div class="hof-rep-stat"><span>POS / Kart (108.00)</span><strong>${esc(fmt(data.totals.cardMinor))}</strong></div><div class="hof-rep-stat"><span>Kilitli Dönem — Atanamaz</span><strong>${data.lockedCount}</strong><small>${data.count} hareket</small></div></div>
      ${tools}
      <div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-legacy"><thead><tr><th class="hof-bank-check">${canAccounts() && assignable.length ? `<input type="checkbox" data-pick-all ${allOn ? "checked" : ""} aria-label="Hepsini seç">` : ""}</th><th>Tarih</th><th>Yol</th><th>Cari / Açıklama</th><th>İşlem No</th><th class="num">Tutar</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="hof-empty">Hesabı atanmamış eski hareket yok.</td></tr>'}</tbody></table></div>
      <p class="hof-rep-note">Bir hareket yalnız hesabın açılış tarihinde ya da sonrasındaysa ve dönemi açıksa atanır; açılıştan önceki hareketler açılış bakiyesinin içindedir (Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır). POS ve kart bakiyesi Bankaya Geçmiş Say ya da Kart Borcuna Aktar ile taşınır.</p>
      ${runs ? `<h4 class="hof-bank-subtitle">Kurulum Geçmişi</h4><div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Tarih</th><th>Hesap</th><th>İşlem No</th><th>Aktarılan</th><th>Durum</th><th></th></tr></thead><tbody>${runs}</tbody></table></div>` : ""}`;
  }

  // ---------- Ayarlar (§8.11; kullanıcı kararı: Temel ve Gelişmiş, standartlar seçili, Varsayılanlara Dön) ----------
  function settingControl(section, item, value, editable, chart) {
    const attrs = `data-set="${esc(section.id)}.${esc(item.key)}" data-type="${esc(item.type)}" id="hof-bank-set-${esc(section.id)}-${esc(item.key)}" ${editable ? "" : "disabled"}`;
    const option = (id, label, current) => `<option value="${esc(id)}" ${String(id) === String(current ?? "") ? "selected" : ""}>${esc(label)}</option>`;
    switch (item.type) {
      case "select":
        return `<select ${attrs}>${item.options.map(([id, label]) => option(id, label, value)).join("")}</select>`;
      case "bool":
        return `<select ${attrs}>${option("true", "Açık", String(Boolean(value)))}${option("false", "Kapalı", String(Boolean(value)))}</select>`;
      case "number":
        return `<input type="number" inputmode="numeric" step="1" min="${item.min}" max="${item.max}" ${item.nullable ? 'data-nullable="1" placeholder="Boş"' : ""} value="${value === null || value === undefined ? "" : esc(value)}" ${attrs}>`;
      case "text":
        return `<input type="text" maxlength="6" value="${esc(value ?? "")}" placeholder="${esc(item.hint || "")}" ${attrs}>`;
      case "account": {
        const accounts = (view.choices?.accounts || []).filter(account => view.choices.forms.bank.ids.includes(account.id));
        return `<select ${attrs}>${option("", "İlk Açılan TL Vadesiz Hesap", value)}${accounts.map(account => option(account.id, `${account.label} (${account.code})`, value)).join("")}</select>`;
      }
      case "gl":
        return `<select ${attrs}>${item.allowed.map(code => option(code, `${code} · ${chart[code] || ""}`, value)).join("")}</select>`;
      case "fixed":
        return `<span class="hof-bank-fixed">${esc(section.id === "gl" ? `${item.value} · ${chart[item.value] || ""}` : item.text)}</span>`;
      case "feeTypes":
        return `<div class="hof-bank-fees" ${attrs}>${(value || []).map(fee => feeRow(fee, editable)).join("")}${editable ? '<button type="button" class="hof-link-button" data-act="fee-add">+ Tür Ekle</button>' : ""}</div>`;
      case "keywords":
        return `<div class="hof-bank-keywords" ${attrs}>${KEYWORD_GROUPS.map(([group, label]) => `<label><span>${esc(label)}</span><input type="text" data-kw="${group}" value="${esc((value?.[group] || []).join(", "))}" ${editable ? "" : "disabled"}></label>`).join("")}</div>`;
      default:
        return "";
    }
  }
  // Masraf türünün hesabı (§8.11): 770 Banka Masrafları, 653 POS ve Ödeme Kuruluşu Komisyonları (vergi kipinden bağımsız).
  const FEE_GL = [
    ["770", "Masraf (770)"],
    ["653", "Komisyon (653)"],
  ];
  const feeRow = (fee, editable) =>
    `<div class="hof-bank-fee" data-fee data-key="${esc(fee.key || "")}"><input type="text" data-fee-name value="${esc(fee.name)}" maxlength="60" aria-label="Masraf türü" ${editable ? "" : "disabled"}><select data-fee-gl aria-label="Hesap" ${editable ? "" : "disabled"}>${FEE_GL.map(([code, label]) => `<option value="${code}" ${fee.gl === code ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>${editable ? '<button type="button" class="hof-mini hof-mini-danger" data-act="fee-remove" title="Türü kaldır" aria-label="Türü kaldır">×</button>' : ""}</div>`;
  function sectionHtml(section, values, editable, chart) {
    const items = section.items.filter(item => item.available !== false);
    if (!items.length) return "";
    const resettable = editable && items.some(item => item.type !== "fixed");
    return `<fieldset class="hof-bank-set" data-section="${esc(section.id)}"><legend>${esc(section.label)}</legend>
      ${resettable ? `<button type="button" class="hof-link-button hof-bank-set-reset" data-act="reset-section" data-section="${esc(section.id)}">Varsayılanlara Dön</button>` : ""}
      ${items
        .map(
          item => `<div class="hof-bank-set-item"><label for="hof-bank-set-${esc(section.id)}-${esc(item.key)}">${esc(item.label)}</label>${settingControl(section, item, item.type === "fixed" ? item.value : values?.[section.id]?.[item.key], editable, chart)}${item.help ? `<small>${esc(item.help)}</small>` : ""}</div>`,
        )
        .join("")}
    </fieldset>`;
  }
  function settingsHtml() {
    const data = view.settings;
    if (!data) return HOF.listPending(view.error);
    const editable = HOF.can("bank.settings");
    const chart = data.chart || {};
    const shown = level => data.sections.filter(section => section.level === level && section.available !== false);
    return `<p class="hof-modal-text">Standartlar seçili gelir; çoğu ofisin bir şeyi değiştirmesi gerekmez. Ayarlar yalnız bundan sonraki kayıtlara uygulanır.</p>
      ${editable ? "" : '<p class="hof-bank-confirm is-warn">Banka ayarlarını yalnız Banka Ayarları yetkisi olanlar değiştirir.</p>'}
      <form class="hof-bank-settings" data-settings novalidate>
        <h4 class="hof-bank-subtitle">Temel Ayarlar</h4>
        <div class="hof-bank-sets">${shown("basic").map(section => sectionHtml(section, data.values, editable, chart)).join("")}</div>
        <button type="button" class="hof-button hof-button-small hof-button-ghost hof-bank-advanced-toggle" data-act="advanced" aria-expanded="${view.advanced}">${view.advanced ? "Gelişmiş Ayarları Gizle" : "Gelişmiş Ayarları Göster"}</button>
        <div class="hof-bank-sets" data-advanced ${view.advanced ? "" : "hidden"}><p class="hof-rep-note">Gelişmiş ayarlar profesyonel kullanım içindir; değiştirmeden önce mali müşavirinize danışın.</p>${shown("advanced").map(section => sectionHtml(section, data.values, editable, chart)).join("")}</div>
        <p class="hof-form-error" role="alert"></p>
        ${editable ? `<div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="reset-all">Tümünü Varsayılanlara Dön</button><button type="submit" class="hof-button" data-act="save-settings">Ayarları Kaydet</button></div>${view.dirty ? '<p class="hof-bank-dirty">Kaydedilmemiş değişiklik var.</p>' : ""}` : ""}
      </form>`;
  }
  /** Ekrandaki ayar değerleri: { bölüm: { anahtar: değer } } (yalnız görünen ve değiştirilebilen kalemler). */
  function collectSettings(form) {
    const values = {};
    for (const node of form.querySelectorAll("[data-set]")) {
      const [section, key] = node.dataset.set.split(".");
      let value;
      switch (node.dataset.type) {
        case "fixed":
          continue;
        case "bool":
          value = node.value === "true";
          break;
        case "number":
          value = node.value.trim() === "" ? (node.dataset.nullable ? null : "") : Number(node.value);
          break;
        case "feeTypes":
          value = [...node.querySelectorAll("[data-fee]")].map(row => ({ key: row.dataset.key || "", name: row.querySelector("[data-fee-name]").value.trim(), gl: row.querySelector("[data-fee-gl]").value })).filter(fee => fee.name || fee.key);
          break;
        case "keywords":
          value = Object.fromEntries(KEYWORD_GROUPS.map(([group]) => [group, node.querySelector(`[data-kw="${group}"]`).value.split(",").map(word => word.trim()).filter(Boolean)]));
          break;
        default:
          value = node.value;
      }
      (values[section] ||= {})[key] = value;
    }
    return values;
  }
  async function saveSettings(form) {
    const error = form.querySelector(".hof-form-error");
    error.textContent = "";
    form.querySelectorAll(".is-invalid").forEach(node => node.classList.remove("is-invalid"));
    const button = form.querySelector('[data-act="save-settings"]');
    button.disabled = true;
    try {
      view.settings = await api("/settings", { method: "PUT", body: { values: collectSettings(form) } });
      view.dirty = false;
      render();
      HOF.toast("Banka ayarları kaydedildi.", { type: "success" });
    } catch (failure) {
      error.textContent = failure.message;
      const field = failure.data?.field;
      const node = field ? form.querySelector(`[data-set="${CSS.escape(field)}"]`) : null;
      if (node) {
        node.classList.add("is-invalid");
        node.closest(".hof-bank-set")?.closest("[data-advanced]")?.removeAttribute("hidden");
        node.focus?.();
      }
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }
  async function resetSettings(section = "") {
    const all = !section;
    if (all || view.dirty) {
      const go = await HOF.confirm({ title: all ? "Tümünü Varsayılanlara Dön" : "Varsayılanlara Dön", message: `${all ? "Bütün banka ayarları standart değerlerine döner." : "Bu bölüm standart değerlerine döner."}${view.dirty ? " Kaydedilmemiş değişiklikler kaybolur." : ""} Değişiklik işlem geçmişine yazılır.`, confirmLabel: "Varsayılanlara Dön" });
      if (!go) return;
    }
    try {
      view.settings = await api("/settings/reset", { method: "POST", body: all ? {} : { section } });
      view.dirty = false;
      render();
      HOF.toast(all ? "Bütün banka ayarları varsayılana döndü." : "Bölüm varsayılana döndü.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Hesap formu (aç / düzelt) ----------
  function accountFields(account = null) {
    const edit = Boolean(account);
    const kind = account?.kind || "demand";
    const locked = edit && (account.movementCount > 0 || Boolean(account.opening?.amountMinor));
    const fields = [
      { name: "bankName", label: "Banka Adı", required: true, autofocus: true, value: account?.bankName || "", maxlength: 120, list: BANK_NAMES, placeholder: "ör. Ziraat Bankası" },
      { name: "name", label: "Hesap Adı", required: true, value: account?.name || "", maxlength: 120, placeholder: "ör. Ana TL Hesabı" },
      { name: "kind", label: "Hesap Türü", type: "select", value: kind === "fx" ? "demand" : kind, options: KINDS.filter(([id]) => id !== "fx").map(([value, label]) => ({ value, label })), readonly: locked, help: locked ? "Hareketi ya da açılış bakiyesi olan hesabın türü ve para birimi değişmez; gerekirse yeni hesap açın." : "Döviz hesabı için Vadesiz seçip para birimini değiştirin." },
      { name: "currency", label: "Para Birimi", type: "select", value: account?.currency || "TRY", options: CURRENCIES.map(([value, label]) => ({ value, label })), readonly: locked },
      { name: "code", label: "Hesap Kodu", value: account?.code || "", maxlength: 30, placeholder: "Boş bırakılırsa önerilir (ör. ZIR-TL)" },
      { name: "iban", label: "IBAN", value: account?.ibanText || "", maxlength: 40, placeholder: "TR00 0000 0000 0000 0000 0000 00", autocomplete: "off" },
      { name: "branchName", label: "Şube", value: account?.branchName || "", maxlength: 120 },
      { name: "branchCode", label: "Şube Kodu", value: account?.branchCode || "", maxlength: 20 },
      { name: "accountNo", label: "Hesap No", value: account?.accountNo || "", maxlength: 40 },
      { name: "creditLimit", label: limitLabel(kind), value: amountInput(account?.creditLimitMinor), inputmode: "decimal", placeholder: "ör. 50.000,00" },
      { name: "statementDay", label: "Ekstre Kesim Günü", type: "number", min: 1, max: 31, value: account?.statementDay || "" },
      { name: "dueDay", label: "Son Ödeme Günü", type: "number", min: 1, max: 31, value: account?.dueDay || "" },
      { name: "negativePolicy", label: "Eksi Bakiye Denetimi", type: "select", value: account?.negativePolicy || "", options: [{ value: "", label: "Banka Ayarlarındaki" }, ...Object.entries(POLICY_LABELS).map(([value, label]) => ({ value, label }))], help: "Açılış bakiyesi doğrulanana kadar denetim kapalıdır." },
      { name: "showOnInvoice", label: "IBAN faturada gösterilsin", type: "checkbox", value: Boolean(account?.showOnInvoice) },
      { name: "description", label: "Açıklama", value: account?.description || "", maxlength: 500 },
    ];
    if (edit) fields.push({ name: "balanceConfirmed", label: "Açılış bakiyesi bankadaki gerçek bakiyedir (Bakiye Doğrulandı)", type: "checkbox", value: Boolean(account.balanceConfirmed) });
    else fields.push(...openingFields());
    return fields;
  }
  const openingFields = (account = null) => [
    { name: "openingDate", label: "Açılış Tarihi", type: "date", required: true, max: "today", value: account?.opening?.date || account?.openingDate || HOF.localToday(), help: "Bu günün başındaki banka bakiyesi; o günden önceki hareketler bakiyenin içindedir." },
    { name: "openingAmount", label: openingLabel(account?.kind), value: account?.opening ? amountInput(account.opening.amountMinor) : "", inputmode: "decimal", placeholder: "ör. 100.000,00 (boş: 0)" },
    { name: "openingRate", label: "Açılış Kuru (TL)", value: "", inputmode: "decimal", placeholder: "ör. 34,25", help: "Döviz hesabında açılış bakiyesinin TL karşılığı için." },
    { name: "confirmed", label: "Bu tutar bankadaki gerçek bakiyedir (Bakiye Doğrulandı)", type: "checkbox", value: Boolean(account?.balanceConfirmed) },
  ];
  /** Türe ve para birimine göre ilgili alanları gösterir (KMH vadesizde, kart günleri kartta, kur dövizde). */
  function wireKindFields(form) {
    const field = name => form.querySelector(`[name="${name}"]`);
    const show = (name, visible) => {
      const node = field(name)?.closest(".hof-field, .hof-check");
      if (node) node.hidden = !visible;
    };
    const sync = () => {
      const kind = field("kind")?.value || "demand";
      const currency = field("currency");
      if (currency && ["loan", "card", "time"].includes(kind) && currency.value !== "TRY" && !currency.hasAttribute("readonly")) currency.value = "TRY";
      if (currency) for (const option of currency.options) option.disabled = ["loan", "card", "time"].includes(kind) && option.value !== "TRY";
      show("creditLimit", ["demand", "card", "loan"].includes(kind) && (currency?.value || "TRY") === "TRY");
      const limit = field("creditLimit")?.closest(".hof-field")?.querySelector("span");
      if (limit) limit.textContent = limitLabel(kind);
      show("statementDay", kind === "card");
      show("dueDay", kind === "card");
      show("openingRate", Boolean(currency) && currency.value !== "TRY");
      const amount = field("openingAmount")?.closest(".hof-field")?.querySelector("span");
      if (amount) amount.textContent = openingLabel(kind);
    };
    form.addEventListener("change", event => {
      if (event.target.matches?.('[name="kind"], [name="currency"]')) sync();
    });
    // Salt okunur açılır liste: tarayıcı readonly'yi seçimde uygulamaz; değer değişmesin.
    for (const select of form.querySelectorAll("select[readonly]")) {
      const value = select.value;
      select.addEventListener("change", () => (select.value = value));
    }
    const iban = field("iban");
    iban?.addEventListener("blur", () => {
      const clean = iban.value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
      iban.value = clean ? clean.replace(/(.{4})/g, "$1 ").trim() : "";
    });
    sync();
  }
  /** Sunucu hatasını ilgili alanın yanında gösterir (formun hata satırı ayrıca dolar). */
  function markField(form, error) {
    form.querySelectorAll(".is-invalid").forEach(node => {
      node.classList.remove("is-invalid");
      node.removeAttribute("aria-invalid");
    });
    const name = FIELD_OF[error?.data?.field] || FIELD_OF_CODE[error?.data?.code] || "";
    const node = name ? form.querySelector(`[name="${name}"]`) : null;
    if (!node) return;
    node.classList.add("is-invalid");
    node.setAttribute("aria-invalid", "true");
    node.closest(".hof-field")?.removeAttribute("hidden");
    node.focus();
  }
  /** Hesap açma gövdesi (formdan; açılış dahil). */
  function createBody(data) {
    const body = {
      bankName: data.bankName,
      name: data.name,
      kind: data.kind,
      currency: data.currency,
      code: data.code,
      iban: data.iban,
      branchName: data.branchName,
      branchCode: data.branchCode,
      accountNo: data.accountNo,
      description: data.description,
      negativePolicy: data.negativePolicy,
      showOnInvoice: Boolean(data.showOnInvoice),
      opening: { date: data.openingDate, amount: String(data.openingAmount ?? "").trim() || "0", confirmed: Boolean(data.confirmed) },
    };
    if (data.currency !== "TRY" && String(data.openingAmount || "").trim()) body.opening.rate = data.openingRate;
    if (data.kind === "card") Object.assign(body, { statementDay: data.statementDay, dueDay: data.dueDay });
    if (["demand", "card", "loan"].includes(data.kind) && data.currency === "TRY") body.creditLimit = data.creditLimit;
    return body;
  }
  function accountForm(account = null) {
    if (!canAccounts()) return HOF.toast("Banka hesabı açma ve düzeltme Banka Hesabı Tanımlama yetkisi ister.", { type: "error" });
    const edit = Boolean(account);
    const requestId = HOF.requestId();
    let formNode = null;
    HOF.formModal({
      title: edit ? "Banka Hesabını Düzenle" : "Yeni Banka Hesabı",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      size: "wide",
      intro: edit ? "Banka, ad, kod, IBAN ve şube bilgileri her zaman düzeltilir. Açılış bakiyesini hesap ayrıntısındaki “Açılışı Düzelt” ile değiştirin." : "Açılış bakiyesi, açılış tarihinin gün başındaki bakiyedir. Bakiyeyi bankadan teyit ettiyseniz “Bakiye Doğrulandı”yı işaretleyin; eksi bakiye denetimi o zaman açılır.",
      fields: accountFields(account),
      submitLabel: edit ? "Kaydet" : "Hesabı Aç",
      onOpen: dialog => {
        formNode = dialog.querySelector("form");
        formNode.classList.add("hof-bank-form");
        wireKindFields(formNode);
      },
      onSubmit: async data => {
        try {
          if (edit) {
            const body = { bankName: data.bankName, name: data.name, code: data.code, iban: data.iban, branchName: data.branchName, branchCode: data.branchCode, accountNo: data.accountNo, description: data.description, negativePolicy: data.negativePolicy, showOnInvoice: Boolean(data.showOnInvoice), balanceConfirmed: Boolean(data.balanceConfirmed) };
            if (!(account.movementCount > 0 || account.opening?.amountMinor)) Object.assign(body, { kind: data.kind, currency: data.currency });
            if (["demand", "card", "loan"].includes(data.kind) && data.currency === "TRY") body.creditLimit = data.creditLimit;
            if (data.kind === "card") Object.assign(body, { statementDay: data.statementDay, dueDay: data.dueDay });
            await api(`/accounts/${encodeURIComponent(account.id)}`, { method: "PUT", body });
            HOF.toast("Banka hesabı güncellendi.", { type: "success" });
            await reload();
          } else {
            const saved = await api("/accounts", { method: "POST", body: createBody(data), requestId });
            HOF.toast(saved?.replayed ? "Bu hesap zaten açılmıştı." : `${saved.label || "Banka hesabı"} açıldı (${saved.code} · ${saved.glSub}).`, { type: "success" });
            choicesCache = null;
            if (saved?.id) openAccount(saved.id);
            else await reload();
          }
        } catch (error) {
          markField(formNode, error);
          throw error;
        }
      },
    });
  }
  function openingForm(account) {
    const correct = Boolean(account.opening);
    let formNode = null;
    HOF.formModal({
      title: correct ? "Açılışı Düzelt" : "Açılış Bakiyesi Gir",
      eyebrow: accountLabel(account).toLocaleUpperCase("tr-TR"),
      intro: correct ? `Eski açılış (${account.opening.no}) ters kaydedilir ve yenisi yazılır; ikisi de işlem geçmişinde kalır. Yeni tarih hesabın ilk hareketinden sonra olamaz.` : "Açılış tarihinin gün başındaki banka bakiyesini girin.",
      fields: openingFields(account).map(field => (field.name === "openingRate" ? { ...field, help: account.currency === "TRY" ? "" : field.help } : field)),
      submitLabel: correct ? "Açılışı Düzelt" : "Açılışı Kaydet",
      onOpen: dialog => {
        formNode = dialog.querySelector("form");
        const rate = formNode.querySelector('[name="openingRate"]')?.closest(".hof-field");
        if (rate) rate.hidden = account.currency === "TRY";
      },
      onSubmit: async data => {
        try {
          const body = { date: data.openingDate, amount: String(data.openingAmount ?? "").trim() || "0", confirmed: Boolean(data.confirmed) };
          if (account.currency !== "TRY") body.rate = data.openingRate;
          const result = await api(`/accounts/${encodeURIComponent(account.id)}/opening`, { method: "POST", body });
          HOF.toast(result.reversed ? `Açılış düzeltildi; eski açılış ${result.reversed} ters kaydedildi.` : "Açılış kaydedildi.", { type: "success" });
          await reload();
        } catch (error) {
          markField(formNode, error);
          throw error;
        }
      },
    });
  }
  async function toggleStatus(account) {
    const passive = account.status === "active";
    if (passive) {
      const go = await HOF.confirm({ title: "Hesabı Pasife Al", message: `${accountLabel(account)} formlardaki hesap seçiminden kalkar; geçmiş hareketleri ve bakiyesi kalır. Sonra yeniden etkinleştirebilirsiniz.`, confirmLabel: "Pasife Al" });
      if (!go) return;
    }
    try {
      await api(`/accounts/${encodeURIComponent(account.id)}/status`, { method: "POST", body: { status: passive ? "passive" : "active" } });
      choicesCache = null;
      HOF.toast(passive ? "Hesap pasife alındı." : "Hesap etkinleştirildi.", { type: "success" });
      await reload();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function removeAccount(account) {
    const go = await HOF.confirm({ title: "Banka Hesabını Sil", message: `${accountLabel(account)} (${account.code}) silinsin mi?${account.opening?.amountMinor ? " Açılış bakiyesi ters kaydedilir." : ""} Aynı adla yeniden açabilirsiniz; alt hesap kodu (${account.glSub}) yeniden verilmez.`, confirmLabel: "Sil", danger: true });
    if (!go) return;
    try {
      await api(`/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" });
      choicesCache = null;
      HOF.toast("Banka hesabı silindi.", { type: "success" });
      setTab("accounts");
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Eski hareket araçları ----------
  async function assignSelected() {
    const target = root()?.querySelector("[data-legacy-target]")?.value;
    const rows = [...view.selected].map(key => {
      const [table, ...rest] = key.split(":");
      return { table, id: rest.join(":") };
    });
    if (!target || !rows.length) return;
    const account = (view.list?.accounts || []).find(item => item.id === target);
    const go = await HOF.confirm({ title: "Hesaba Ata", message: `${rows.length} hareket ${account ? accountLabel(account) : "seçilen hesap"} hesabına bağlanacak ve Gerçek Banka'ya girecek. Bu atama Kurulum Geçmişi'nde görünmez ve geri alınmaz. Devam edilsin mi?`, confirmLabel: "Hesaba Ata" });
    if (!go) return;
    try {
      const result = await api("/legacy/assign", { method: "POST", body: { accountId: target, rows }, requestId: HOF.requestId() });
      view.selected = new Set();
      HOF.toast(`${result.assigned ?? rows.length} hareket hesaba atandı.`, { type: "success" });
      await reload();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  function reclassForm(mode) {
    const accounts = mode === "bank" ? bindableAccounts() : (view.list?.accounts || []).filter(account => account.kind === "card" && account.status === "active");
    if (!accounts.length) return HOF.toast(mode === "bank" ? "Önce etkin bir TL vadesiz, ticari ya da diğer banka hesabı açın." : "Önce Kurumsal Kredi Kartı türünde hesap açın.", { type: "error" });
    const available = Math.abs(view.legacy?.totals?.cardMinor || 0);
    const requestId = HOF.requestId();
    HOF.formModal({
      title: mode === "bank" ? "Bankaya Geçmiş Say" : "Kart Borcuna Aktar",
      eyebrow: "HESABI ATANMAMIŞ POS / KART",
      intro: mode === "bank" ? `Hesap tanımlanmadan girilmiş POS tahsilatlarının bankaya geçmiş tutarını hesaba aktarır (en çok ${fmt(available)}).` : `Hesap tanımlanmadan kredi kartıyla yapılmış ödemeleri kurumsal kart borcuna aktarır (en çok ${fmt(available)}).`,
      fields: [
        { name: "accountId", label: mode === "bank" ? "Banka Hesabı" : "Kurumsal Kredi Kartı", type: "select", value: accounts[0].id, options: accounts.map(account => ({ value: account.id, label: `${accountLabel(account)} (${account.code})` })) },
        { name: "date", label: "Tarih", type: "date", required: true, max: "today", value: HOF.localToday() },
        { name: "amount", label: "Tutar", required: true, value: amountInput(available), inputmode: "decimal" },
      ],
      submitLabel: "Aktar",
      onSubmit: async data => {
        await api("/legacy/reclass", { method: "POST", body: { mode, ...data }, requestId });
        HOF.toast("Aktarıldı; Kurulum Geçmişi'nden geri alınabilir.", { type: "success" });
        await reload();
      },
    });
  }
  async function undoRun(id) {
    const go = await HOF.confirm({ title: "Kurulumu Geri Al", message: "Bu kurulumun fişleri ters kaydedilir ve hesaba bağlanan hareketler yeniden “Hesabı Atanmamış”a döner. Devam edilsin mi?", confirmLabel: "Geri Al", danger: true });
    if (!go) return;
    try {
      const result = await api(`/setup/${encodeURIComponent(id)}/undo`, { method: "POST", body: {} });
      HOF.toast(`Geri alındı: ${result.unassigned} hareket yeniden hesabı atanmamış.`, { type: "success" });
      await reload();
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Alt Hesap Mizanı ----------
  async function openSubTrial() {
    const box = HOF.modal({ title: "Alt Hesap Mizanı", eyebrow: moduleName().toLocaleUpperCase("tr-TR"), size: "wide", body: '<div data-subtrial><p class="hof-empty">Yükleniyor…</p></div>' });
    box.dialog.classList.add("hof-bank-modal-small");
    const node = box.dialog.querySelector("[data-subtrial]");
    try {
      const data = await api("/sub-trial");
      const money = value => esc(HOF.formatMoney(value));
      const rows = data.rows.map(row => `<tr>${td("Alt Hesap", `<b>${esc(row.sub)}</b>`)}${td("Hesap Adı", esc(row.name || "—"))}${td("Borç", money(row.debit), "num")}${td("Alacak", money(row.credit), "num")}${td("Bakiye", `<b>${money(row.balance)}</b>`, "num")}</tr>`).join("");
      const mains = data.mains.map(item => `<li class="${item.ok ? "is-ok" : "is-bad"}"><b>${esc(item.account)} ${esc(item.name)}</b> ${money(item.balance)} ${item.ok ? "=" : "≠"} Alt Hesaplar ${money(item.subTotal)} ${item.ok ? "✓" : "✗"}</li>`).join("");
      HOF.swap(node, `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-subtrial"><thead><tr><th>Alt Hesap</th><th>Hesap Adı</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="hof-empty">Banka alt hesabında hareket yok.</td></tr>'}</tbody></table></div>${mains ? `<ul class="hof-bank-mains">${mains}</ul>` : ""}<p class="hof-rep-note">Her ana hesabın bakiyesi alt hesaplarının toplamına eşit olmalıdır. 102.00 ve 108.00: hesabı atanmamış eski hareketler.</p>`);
    } catch (error) {
      HOF.swap(node, `<p class="hof-empty hof-list-error" role="alert">${esc(error.message)}</p>`);
    }
  }

  // ---------- Kurulum Sihirbazı (§8.3, §10.3) ----------
  function maybeWizard() {
    const s = view.summary;
    if (!s || wizard || wizardOffered || !canAccounts()) return;
    if (!s.setup?.needed || s.setup?.dismissed) return;
    wizardOffered = true;
    openWizard();
  }
  async function dismissWizard() {
    try {
      await api("/setup/dismiss", { method: "POST", body: {} });
    } catch {
      // Kapatma kaydı kritik değil: sihirbaz bir sonraki açılışta yeniden önerilir.
    }
  }
  function openWizard() {
    if (!canAccounts()) return HOF.toast("Kurulum Sihirbazı Banka Hesabı Tanımlama yetkisi ister.", { type: "error" });
    if (wizard) return;
    const legacyTotal = view.summary?.unassigned?.totalMinor || 0;
    const state = { step: "account", saved: [], requestId: HOF.requestId(), setupRequestId: HOF.requestId(), legacy: legacyTotal !== 0, preview: null, previewError: "", done: null };
    wizard = HOF.modal({
      title: "Kurulum Sihirbazı",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      size: "wide",
      body: '<div class="hof-bank-wiz" data-wiz></div>',
      onClose: () => {
        wizard = null;
        dismissWizard().finally(() => {
          if (modal) reload();
        });
      },
    });
    wizard.dialog.classList.add("hof-bank-wiz-modal");
    wizard.dialog.addEventListener("click", event => onWizardClick(event, state));
    wizard.dialog.addEventListener("change", event => onWizardChange(event, state));
    wizard.dialog.addEventListener("submit", event => {
      event.preventDefault();
      if (event.target.matches("[data-wiz-form]")) saveWizardAccount(state, { next: true });
    });
    renderWizard(state);
  }
  const wizardNode = () => wizard?.dialog.querySelector("[data-wiz]");
  function wizardSteps(state) {
    const steps = [["account", "Hesap ve Açılış"], ...(state.legacy ? [["legacy", "Eski Hareketleri Aktar"]] : []), ["done", "Bitti"]];
    const at = steps.findIndex(([id]) => id === state.step);
    return `<ol class="hof-bank-steps">${steps.map(([id, label], index) => `<li class="${index === at ? "is-on" : index < at ? "is-done" : ""}" ${index === at ? 'aria-current="step"' : ""}><b>${index + 1}</b> ${esc(label)}</li>`).join("")}</ol>`;
  }
  function renderWizard(state) {
    const node = wizardNode();
    if (!node) return;
    const saved = state.saved.length
      ? `<ul class="hof-bank-wiz-saved" data-wiz-saved>${state.saved.map(account => `<li>✓ <b>${esc(accountLabel(account))}</b> · ${esc(account.code)} · ${esc(account.glSub)} · ${esc(fmt(account.opening?.amountMinor || 0, account.currency))}${account.balanceConfirmed ? " · Bakiye Doğrulandı" : ""}</li>`).join("")}</ul>`
      : "";
    let content = "";
    if (state.step === "account") {
      const fields = [
        { name: "bankName", label: "Banka Adı", required: true, autofocus: true, maxlength: 120, list: BANK_NAMES, placeholder: "ör. Ziraat Bankası" },
        { name: "name", label: "Hesap Adı", required: true, maxlength: 120, placeholder: "ör. Ana TL Hesabı" },
        { name: "kind", label: "Hesap Türü", type: "select", value: "demand", options: KINDS.filter(([id]) => id !== "fx").map(([value, label]) => ({ value, label })) },
        { name: "currency", label: "Para Birimi", type: "select", value: "TRY", options: CURRENCIES.map(([value, label]) => ({ value, label })) },
        { name: "iban", label: "IBAN", maxlength: 40, placeholder: "TR00 0000 0000 0000 0000 0000 00" },
        ...openingFields(),
      ];
      // Fatura Ayarları'ndaki eski banka listesi (E2.16): henüz hesap olarak açılmamış IBAN'lar tek tıkla forma dolar.
      const suggestions = (view.summary?.setup?.suggestions || []).filter(item => !state.saved.some(account => account.iban === item.iban));
      const suggest = suggestions.length
        ? `<div class="hof-bank-wiz-suggest" data-wiz-suggest><small>Fatura Ayarları'ndaki banka bilgileri:</small>${suggestions.map((item, index) => `<button type="button" class="hof-rep-chip" data-wiz="suggest" data-index="${index}">${esc(item.bankName || "Banka")} · ${esc(item.iban.replace(/(.{4})/g, "$1 ").trim())}</button>`).join("")}</div>`
        : "";
      state.suggestions = suggestions;
      content = `<p class="hof-modal-text">Bankadaki her hesabı, açılış tarihindeki (gün başı) bakiyesiyle girin. Birden çok hesabınız varsa “Kaydet ve Yeni Hesap Ekle” ile sırayla ekleyin. Her adım atlanabilir.</p>
        ${saved}${suggest}
        <form class="hof-form hof-bank-form hof-bank-wiz-form" data-wiz-form novalidate>${fields.map(HOF.fieldHtml).join("")}
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wiz="skip">Bu Adımı Atla</button><button type="button" class="hof-button hof-button-ghost" data-wiz="save-more">Kaydet ve Yeni Hesap Ekle</button><button type="submit" class="hof-button" data-wiz="save-next">${state.saved.length ? "Kaydet ve İlerle" : "Kaydet ve İlerle"}</button></div>
        </form>`;
    } else if (state.step === "legacy") {
      const targets = bindableAccounts().filter(account => account.opening);
      const p = state.preview;
      const previewHtml = state.previewError
        ? `<p class="hof-bank-confirm is-warn">${esc(state.previewError)}</p>`
        : p
          ? `<dl class="hof-chq-facts hof-bank-preview" data-wiz-preview>
              <div><dt>Devir Kapanışı</dt><dd>Havale / EFT ${esc(fmt(p.carry.bankMinor))} · POS / Kart ${esc(fmt(p.carry.cardMinor))}</dd></div>
              <div><dt>Bağlanacak Hareket</dt><dd>${p.assign.count} hareket · net ${esc(signed(p.assign.amountMinor))}</dd></div>
              <div><dt>Kilitli Dönem — Atanamaz</dt><dd>${p.skipped.locked}</dd></div>
              <div><dt>Sonra Hesap Bakiyesi</dt><dd>${esc(fmt(p.after.accountMinor))}</dd></div>
              <div><dt>Sonra Hesabı Atanmamış</dt><dd>Havale / EFT ${esc(fmt(p.after.unassignedBankMinor))} · POS / Kart ${esc(fmt(p.after.unassignedCardMinor))}</dd></div>
            </dl>`
          : '<p class="hof-empty">Önizleme hazırlanıyor…</p>';
      content = targets.length
        ? `<p class="hof-modal-text">Hesap tanımlanmadan girilmiş havale / EFT ve POS hareketleri “Hesabı Atanmamış Eski Hareketler”de duruyor. Açılış tarihinden önceki bakiye açılışa kapatılır (Devir Kapanışı); sonraki havale hareketleri seçtiğiniz hesaba bağlanır. Bu işlem Kurulum Geçmişi'nden geri alınabilir.</p>
          <form class="hof-form hof-bank-wiz-legacy" novalidate>
            ${HOF.fieldHtml({ name: "accountId", label: "Hesap", type: "select", value: state.accountId || targets[0].id, options: targets.map(account => ({ value: account.id, label: `${accountLabel(account)} (${account.code}) · açılış ${dateText(account.opening.date)}` })) })}
            ${HOF.fieldHtml({ name: "carryClose", label: "Açılıştan önceki eski bakiye açılışa kapatılsın (Devir Kapanışı)", type: "checkbox", value: state.carryClose !== false })}
            ${HOF.fieldHtml({ name: "assignAll", label: "Açılıştan sonraki eski havale hareketleri bu hesaba bağlansın", type: "checkbox", value: state.assignAll !== false })}
          </form>
          ${previewHtml}
          <p class="hof-form-error" role="alert">${esc(state.error || "")}</p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wiz="skip">Bu Adımı Atla</button><button type="button" class="hof-button" data-wiz="transfer" ${p && !state.previewError ? "" : "disabled"}>Aktar</button></div>`
        : `<p class="hof-modal-text">Eski hareketleri aktarmak için önce açılış bakiyesi girilmiş, etkin bir TL vadesiz, ticari ya da diğer hesap gerekir. Bu adımı atlayıp sonra Genel Bakış → Hesabı Atanmamış Eski Hareketler'den yapabilirsiniz.</p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wiz="back">← Hesap ve Açılış</button><button type="button" class="hof-button" data-wiz="skip">Bu Adımı Atla</button></div>`;
    } else {
      const s = view.summary;
      content = `<div class="hof-bank-wiz-done" data-wiz-done>
          <h4>${state.saved.length || state.done ? "Kurulum Tamamlandı" : "Kurulum Atlandı"}</h4>
          ${saved}
          ${state.done ? `<p>Eski hareketler aktarıldı: ${state.done.assigned} hareket hesaba bağlandı${state.done.carryNo ? `; Devir Kapanışı ${esc(state.done.carryNo)}` : ""}.</p>` : ""}
          ${s?.realBank?.defined ? `<p class="hof-bank-wiz-real">Gerçek Banka: <b data-wiz-real>${esc(fmt(s.realBank.minor))}</b></p>` : ""}
          <p>${state.saved.length ? "Hesapları Hesaplar sekmesinden düzenleyebilir, yeni hesap ekleyebilirsiniz." : "Genel Bakış'taki “Kurulumu Tamamla” ile istediğiniz zaman devam edebilirsiniz."}</p>
        </div>
        <div class="hof-actions"><button type="button" class="hof-button" data-wiz="finish">Genel Bakış'a Git</button></div>`;
    }
    HOF.swap(node, `${wizardSteps(state)}${content}`);
    const form = node.querySelector("[data-wiz-form]");
    if (form) wireKindFields(form);
    if (state.step === "legacy" && !state.preview && !state.previewError && bindableAccounts().some(account => account.opening)) loadPreview(state);
  }
  const wizardForm = () => wizardNode()?.querySelector("[data-wiz-form]");
  const formData = form => Object.fromEntries([...form.querySelectorAll("[name]")].map(input => [input.name, input.type === "checkbox" ? input.checked : input.value]));
  const pristine = data => !String(data.bankName || "").trim() && !String(data.name || "").trim() && !String(data.openingAmount || "").trim() && !String(data.iban || "").trim();
  async function saveWizardAccount(state, { next = false } = {}) {
    const form = wizardForm();
    if (!form) return;
    const error = form.querySelector(".hof-form-error");
    error.textContent = "";
    const data = formData(form);
    if (next && pristine(data) && state.saved.length) return goWizard(state, state.legacy ? "legacy" : "done");
    const missing = [...form.querySelectorAll("[required]")].find(input => !String(input.value || "").trim());
    if (missing) {
      error.textContent = `"${missing.closest(".hof-field")?.querySelector("span")?.textContent.replace(/\s*\*\s*$/, "").trim()}" alanı boş bırakılamaz.`;
      missing.focus();
      return;
    }
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach(button => (button.disabled = true));
    try {
      const saved = await api("/accounts", { method: "POST", body: createBody({ ...data, code: "" }), requestId: state.requestId });
      state.requestId = HOF.requestId();
      const account = saved?.replayed ? saved.account : saved;
      if (account && !state.saved.some(item => item.id === account.id)) state.saved.push(account);
      choicesCache = null;
      await refreshWizardData();
      if (next) return goWizard(state, state.legacy ? "legacy" : "done");
      renderWizard(state);
      HOF.toast(`${account ? accountLabel(account) : "Hesap"} kaydedildi.`, { type: "success" });
    } catch (failure) {
      error.textContent = failure.message;
      markField(form, failure);
    } finally {
      buttons.forEach(button => button.isConnected && (button.disabled = false));
    }
  }
  /** Sihirbaz ilerlerken hesap listesi ve özet (eski hareketler, Gerçek Banka) yenilenir. */
  async function refreshWizardData() {
    try {
      const [summary, list] = await Promise.all([api("/summary"), api("/accounts?status=all")]);
      Object.assign(view, { summary, list });
      if (modal) render();
    } catch {
      // Ana pencere kendi yenilemesinde tekrar dener.
    }
  }
  async function goWizard(state, step) {
    state.step = step;
    state.error = "";
    if (step === "legacy") {
      state.preview = null;
      state.previewError = "";
    }
    if (step === "done") await refreshWizardData();
    renderWizard(state);
  }
  async function loadPreview(state) {
    const form = wizardNode()?.querySelector(".hof-bank-wiz-legacy");
    const accountId = form?.querySelector('[name="accountId"]')?.value || state.accountId || bindableAccounts().find(account => account.opening)?.id;
    if (!accountId) return;
    state.accountId = accountId;
    const body = { accountId, carryClose: state.carryClose !== false, assign: state.assignAll === false ? "none" : "all" };
    try {
      state.preview = await api("/setup?dryRun=1", { method: "POST", body });
      state.previewError = "";
    } catch (error) {
      state.preview = null;
      state.previewError = error.message;
    }
    if (wizard && state.step === "legacy") renderWizard(state);
  }
  async function runSetup(state) {
    const body = { accountId: state.accountId, carryClose: state.carryClose !== false, assign: state.assignAll === false ? "none" : "all" };
    const button = wizardNode()?.querySelector('[data-wiz="transfer"]');
    if (button) button.disabled = true;
    try {
      const result = await api("/setup", { method: "POST", body, requestId: state.setupRequestId });
      state.done = result.replayed ? { assigned: 0, carryNo: "" } : result;
      state.setupRequestId = HOF.requestId();
      await goWizard(state, "done");
    } catch (error) {
      state.error = error.message;
      renderWizard(state);
    }
  }
  function onWizardClick(event, state) {
    const act = event.target.closest("[data-wiz]")?.dataset.wiz;
    if (!act) return;
    if (act === "skip") goWizard(state, state.step === "account" && state.legacy ? "legacy" : "done");
    else if (act === "back") goWizard(state, "account");
    else if (act === "save-more") saveWizardAccount(state);
    else if (act === "suggest") {
      const item = state.suggestions?.[Number(event.target.closest("[data-index]")?.dataset.index)];
      const form = wizardForm();
      if (!item || !form) return;
      form.querySelector('[name="bankName"]').value = item.bankName || "";
      form.querySelector('[name="iban"]').value = item.iban.replace(/(.{4})/g, "$1 ").trim();
      form.querySelector('[name="name"]').focus();
    }
    else if (act === "transfer") runSetup(state);
    else if (act === "finish") {
      wizard?.close();
      if (modal) setTab("overview");
    }
  }
  function onWizardChange(event, state) {
    if (state.step !== "legacy") return;
    const input = event.target;
    if (input.name === "accountId") state.accountId = input.value;
    else if (input.name === "carryClose") state.carryClose = input.checked;
    else if (input.name === "assignAll") state.assignAll = input.checked;
    else return;
    state.preview = null;
    state.previewError = "";
    loadPreview(state);
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const tab = event.target.closest("[data-tab]")?.dataset.tab;
    if (tab && event.target.closest(".hof-bank-tabs")) {
      if (view.dirty && view.tab === "settings" && tab !== "settings") {
        HOF.confirm({ title: "Kaydedilmemiş Değişiklik", message: "Banka ayarlarında kaydedilmemiş değişiklik var. Kaydetmeden çıkılsın mı?", confirmLabel: "Kaydetmeden Çık", danger: true }).then(go => go && setTab(tab));
        return;
      }
      return setTab(tab);
    }
    const status = event.target.closest("[data-status]")?.dataset.status;
    if (status) {
      view.status = status;
      return render();
    }
    const act = event.target.closest("[data-act]");
    if (act && !act.disabled) {
      event.preventDefault();
      const account = view.account;
      switch (act.dataset.act) {
        case "retryList":
          return reload();
        case "wizard":
          return openWizard();
        case "legacy":
          view.mode = "legacy";
          view.selected = new Set();
          render();
          return reload();
        case "back":
          return setTab("accounts");
        case "back-overview":
          return setTab("overview");
        case "new":
          return accountForm();
        case "subtrial":
          return openSubTrial();
        case "edit":
          return account && accountForm(account);
        case "opening":
          return account && openingForm(account);
        case "status":
          return account && toggleStatus(account);
        case "delete":
          return account && removeAccount(account);
        case "assign":
          return assignSelected();
        case "reclass-bank":
          return reclassForm("bank");
        case "reclass-card":
          return reclassForm("card");
        case "undo":
          return undoRun(act.dataset.run);
        case "advanced":
          view.advanced = !view.advanced;
          root()?.querySelector("[data-advanced]")?.toggleAttribute("hidden", !view.advanced);
          act.textContent = view.advanced ? "Gelişmiş Ayarları Gizle" : "Gelişmiş Ayarları Göster";
          act.setAttribute("aria-expanded", String(view.advanced));
          return;
        case "save-settings":
          return saveSettings(act.closest("form"));
        case "reset-section":
          return resetSettings(act.dataset.section);
        case "reset-all":
          return resetSettings();
        case "fee-add": {
          const box = act.closest(".hof-bank-fees");
          act.insertAdjacentHTML("beforebegin", feeRow({ key: "", name: "", gl: "770" }, true));
          view.dirty = true;
          box.querySelector("[data-fee]:last-of-type [data-fee-name]")?.focus();
          return;
        }
        case "fee-remove":
          act.closest("[data-fee]")?.remove();
          view.dirty = true;
          return;
        default:
          return;
      }
    }
    const row = event.target.closest("tr[data-account]");
    if (row) openAccount(row.dataset.account);
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches("[data-pick]")) {
      if (target.checked) view.selected.add(target.dataset.pick);
      else view.selected.delete(target.dataset.pick);
      return render();
    }
    if (target.matches("[data-legacy-target]")) {
      view.legacyTarget = target.value;
      view.selected = new Set([...view.selected].filter(id => (view.legacy?.rows || []).some(row => rowKey(row) === id && canPick(row))));
      return render();
    }
    if (target.matches("[data-pick-all]")) {
      const keys = (view.legacy?.rows || []).filter(row => canPick(row)).map(rowKey);
      view.selected = target.checked ? new Set(keys) : new Set();
      return render();
    }
    if (target.closest("[data-settings]")) markDirty();
  }
  function onInput(event) {
    if (event.target.closest("[data-settings]")) markDirty();
  }
  function markDirty() {
    if (view.dirty) return;
    view.dirty = true;
    const form = root()?.querySelector("[data-settings]");
    if (form && !form.querySelector(".hof-bank-dirty") && HOF.can("bank.settings")) form.insertAdjacentHTML("beforeend", '<p class="hof-bank-dirty">Kaydedilmemiş değişiklik var.</p>');
  }
  document.addEventListener("submit", event => {
    const form = event.target.closest?.("[data-settings]");
    if (!form || !modal?.dialog.contains(form)) return;
    event.preventDefault();
    saveSettings(form);
  });

  // ---------- Ortak hesap seçici (K13; §8.9) ----------
  /** Form seçicileri (bakiyesiz): önbellekli; banka değişikliğinde yenilenir. */
  function choices(force = false) {
    if (!choicesCache || force)
      choicesCache = HOF.api(`${BASE}/choices`).catch(error => {
        choicesCache = null;
        throw error;
      });
    return choicesCache;
  }
  /**
   * Hesap seçici: hiç uygun hesap yoksa boş (bugünkü görünüm; satır hesapsız yazılır), tek hesapta gizli alan + bilgi satırı, birden
   * çokta zorunlu seçim (varsayılan: Banka Ayarları'ndaki Varsayılan Tahsilat Hesabı, yoksa ilk vadesiz). form: bank | card | fx.
   * Dönüş: { mode: "none" | "single" | "many", accountId, html }.
   */
  function pickerHtml(data, { form = "bank", value = "", name = "bankAccountId", label = "Banka Hesabı" } = {}) {
    const meta = data?.forms?.[form];
    const accounts = (meta?.ids || []).map(id => data.accounts.find(account => account.id === id)).filter(Boolean);
    if (!accounts.length) return { mode: "none", accountId: "", html: "" };
    if (accounts.length === 1) return { mode: "single", accountId: accounts[0].id, html: `<input type="hidden" name="${esc(name)}" value="${esc(accounts[0].id)}" data-bank-single><p class="hof-bank-pick-note">${esc(accounts[0].label)} hesabına yazılır.</p>` };
    const selected = value && meta.ids.includes(value) ? value : meta.defaultId || "";
    return { mode: "many", accountId: selected, html: HOF.fieldHtml({ name, label, type: "select", required: true, value: selected, options: [{ value: "", label: "Hesap Seçin" }, ...accounts.map(account => ({ value: account.id, label: `${account.label} (${account.code})` }))] }) };
  }
  /** Seçiciyi anchor öğesinin ardına yerleştirir; dönüş mode. Yükleme hatasında seçici yoktur (sunucu yine hesap ister). */
  async function mountPicker(anchor, options = {}) {
    if (!anchor) return "none";
    try {
      const picked = pickerHtml(await choices(), options);
      if (picked.html) anchor.insertAdjacentHTML("afterend", `<div class="hof-bank-pick" data-bank-pick>${picked.html}</div>`);
      return picked.mode;
    } catch {
      return "none";
    }
  }

  HOF.bank = { open, openWizard, choices, pickerHtml, mountPicker };
  HOF.whenReady(() => {
    // Canlı yenileme (v2.0.22 kuralı): başka bilgisayardaki banka değişikliği ve para gösteren modüllerin değişikliği açık pencereyi tek
    // yenileme kapısından yeniler; bu penceredeki banka yazımı zaten kendini yeniler.
    const refreshOpen = HOF.refresher(() => (modal ? reload({ quiet: true }) : null));
    HOF.on("live:workspace.changed", change => {
      if (change?.kind !== "bank") return;
      choicesCache = null;
      if (modal) refreshOpen();
    });
    HOF.onLedger(["bank", "cash", "accounts", "invoices", "plans", "cheques"], detail => {
      if ((detail.kinds || []).includes("bank") || !detail.kinds) choicesCache = null;
      if (!modal || (detail.local && detail.path?.startsWith(BASE))) return;
      if (detail.local) refreshOpen.now();
      else refreshOpen();
    }, 350);
  });
})();
