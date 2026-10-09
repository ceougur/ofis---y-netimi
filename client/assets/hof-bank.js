/* DestekOfis — Banka (v2.1.0; docs/BANKA-MODULU-PLAN.md §8). Sol menüde Taksitler'in hemen altında (kullanıcı kararı, K13).
 * Pencere sekmeleri: Genel Bakış · Hesaplar · Hareketler · Ayarlar. POS ile Ekstre ve Mutabakat sekmeleri o özellikler gelince görünür
 * (yarım özellik görünmez, §12.1).
 *  - Hareketler (Aşama 4; §8.6): sunucuda sayfalanan dizin (imleçli "Daha Fazla Göster", HOF.listGate), süzgeçler (hesap, tür, giriş/çıkış,
 *    durum, tarih, tutar, arama), yürüyen bakiye (tek hesap seçili ve başka süzgeç yokken), "Planlı İşlemler" görünümü (deftere girmez;
 *    Gerçekleştir / Atla / Sil) ve "+ Masraf", "+ Faiz", "+ Diğer İşlem", "+ Planlı İşlem". Satır → İşlem Kartı: fiş satırları, bağlar,
 *    Ters Kaydet, Düzelt, Açıklamayı Düzelt; pasif düğmenin nedeni görünür yazıyla. Benzer İşlem'de (409 bank-similar) "Yine de Kaydet"
 *    aynı istek kimliğiyle gönderilir (similarOk). Fiş formunun vergi ve hesap varsayılanları Banka Ayarları'ndan (voucher-meta).
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
  // Sekme sırası (§8.2): Hareketler Hesaplar'dan hemen sonra (Aşama 4). POS ve Ekstre ve Mutabakat o sürümlerde eklenir.
  const TABS = [
    ["overview", "Genel Bakış"],
    ["accounts", "Hesaplar"],
    ["movements", "Hareketler"],
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
  let metaCache = null;
  const view = { tab: "overview", mode: "tab", accountId: "", status: "active", summary: null, list: null, account: null, settings: null, choices: null, legacy: null, runs: null, error: "", advanced: false, dirty: false, selected: new Set(), legacyTarget: "", eventRef: "", event: null, eventBack: "movements", meta: null, due: null, latest: null };
  // Hareket listeleri (Aşama 4): Hareketler sekmesi ve Hesap Detayı ayrı durum ve ayrı liste kapısıyla (HOF.listGate: eski yanıt yeni
  // süzgeci ezmez; süzgeç yüklenirken "Daha Fazla" yok sayılır).
  const PAGE = 50;
  const newMoves = (key, filter = {}) => ({ key, filter: { account: "", type: "", dir: "", status: "", from: "", to: "", min: "", max: "", q: "", ...filter }, planned: false, rows: [], plans: [], balance: false, hasMore: false, cursor: null, loaded: false, error: "", account: "", gate: HOF.listGate() });
  const moves = newMoves("main");
  let accountMoves = newMoves("account");

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
  /** Döviz hesabı bu sürümde kapalı (sunucu config.fxEnabled; Genel Bakış features.fx). */
  const fxOn = () => Boolean(view.summary?.features?.fx);
  // GG2 (düşük): salt okunur lisansta yöneticiye yanlış neden (yetki) gösterilmez.
  const READ_ONLY_TEXT = "Program salt okunur çalışıyor (lisans); kayıt değiştirilemez.";
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
        // GG2 (düşük): Ayarlar'da kaydedilmemiş değişiklik varken pencere sorusuz kapanmaz (sekme değişimindeki aynı soru).
        beforeClose: () => (view.dirty && view.tab === "settings" ? HOF.confirm({ title: "Kaydedilmemiş Değişiklik", message: "Banka ayarlarında kaydedilmemiş değişiklik var. Kaydetmeden çıkılsın mı?", confirmLabel: "Kaydetmeden Çık", danger: true }) : true),
        onClose: () => {
          modal = null;
          // Gelişmiş Ayarlar her açılışta kapalı gelir (GG2 düşük bulgu).
          view.advanced = false;
          view.mode = "tab";
          view.accountId = "";
          view.account = null;
          view.eventRef = "";
          view.event = null;
          view.dirty = false;
          view.selected = new Set();
          // Pencere her açılışta baştan (son sekme hatırlanmaz): Hareketler'in süzgeçleri ve Planlı görünümü de.
          Object.assign(moves, { filter: newMoves("main").filter, planned: false, rows: [], plans: [], loaded: false, cursor: null, hasMore: false, error: "" });
        },
      });
      modal.dialog.classList.add("hof-bank-modal");
      modal.dialog.addEventListener("click", onClick);
      modal.dialog.addEventListener("change", onChange);
      modal.dialog.addEventListener("input", onInput);
      modal.dialog.addEventListener("keydown", onKey);
    }
    if (tab) setTab(tab, { load: false });
    if (accountId) {
      view.mode = "account";
      view.accountId = accountId;
    } else if (legacy) view.mode = "legacy";
    render();
    return reload({ first: true });
  }
  const viewKey = () => `${view.mode}|${view.tab}|${view.accountId}|${view.eventRef}`;

  /** Pencerenin verisi: özet ve hesaplar her zaman; görünüme göre hesap kartı, eski hareketler ya da ayarlar. */
  async function reload({ quiet = false, first = false } = {}) {
    const own = quiet ? ticket : ++ticket;
    const key = viewKey();
    const options = quiet ? { background: true } : {};
    try {
      const [summary, list] = await Promise.all([api("/summary", options), api("/accounts?status=all", options)]);
      const next = { summary, list };
      if (view.mode === "account" && view.accountId) {
        next.account = await api(`/accounts/${encodeURIComponent(view.accountId)}`, options);
        // Hesap Detayı'nda hesabın hareketleri (yürüyen bakiyeli dizin; §8.5): ilk çizimde boş görünmesin diye hesapla birlikte yüklenir.
        if (accountMoves.filter.account !== view.accountId) accountMoves = newMoves("account", { account: view.accountId });
        await loadMoves(accountMoves, { quiet, paint: false });
      }
      if (view.mode === "legacy") [next.legacy, next.runs] = await Promise.all([api("/legacy", options), api("/setup", options).then(data => data.runs)]);
      const settingsTab = view.mode === "tab" && view.tab === "settings";
      if (settingsTab && !view.dirty) [next.settings, next.choices] = await Promise.all([api("/settings", options), api("/choices", options)]);
      if (view.mode === "tab" && view.tab === "overview") {
        // Vadesi gelen planlı işlemler (rozetin nedeni) ve son banka hareketleri (§8.4 "Son Banka Hareketleri"); ikisi de yalnız okur.
        [next.due, next.latest] = await Promise.all([api("/plans?due=1", options).then(data => data.plans).catch(() => []), api(`/movements?limit=10`, options).then(data => data.rows).catch(() => [])]);
      }
      if (view.mode === "tab" && view.tab === "movements") {
        next.meta = await voucherMeta().catch(() => view.meta);
        await loadMoves(moves, { quiet, paint: false });
      }
      if (view.mode === "event" && view.eventRef) next.event = await api(`/events/${encodeURIComponent(view.eventRef)}`, options);
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
      if (view.mode === "event" && error.status === 404) {
        HOF.toastError(error);
        view.eventRef = "";
        view.event = null;
        return goBack();
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
    view.eventRef = "";
    view.event = null;
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
    view.eventRef = "";
    view.event = null;
    render();
    reload();
  }
  /** İşlem Kartı (§8.6): İşlem No ya da kimlikle. Geri dönüş açıldığı yere (Hareketler, Hesap Detayı, Genel Bakış); kart → kart geçişinde değişmez. */
  function openEvent(ref, { back = "" } = {}) {
    if (!ref) return;
    if (view.mode !== "event") view.eventBack = back || (view.mode === "account" ? "account" : view.mode === "tab" ? view.tab : "movements");
    view.mode = "event";
    view.eventRef = ref;
    view.event = null;
    render();
    reload();
  }
  function goBack() {
    view.eventRef = "";
    view.event = null;
    if (view.eventBack === "account" && view.accountId) {
      view.mode = "account";
      render();
      return reload();
    }
    return setTab(TABS.some(([id]) => id === view.eventBack) ? view.eventBack : "movements");
  }

  function render() {
    const node = root();
    if (!node) return;
    const content = view.mode === "account" ? accountHtml() : view.mode === "legacy" ? legacyHtml() : view.mode === "event" ? eventHtml() : view.tab === "accounts" ? accountsHtml() : view.tab === "movements" ? movementsHtml() : view.tab === "settings" ? settingsHtml() : overviewHtml();
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
          : `<div class="hof-bank-row is-setup"><div><b>Kurulum Bekliyor</b><small>${esc(HOF.license?.writable === false ? READ_ONLY_TEXT : "Banka hesaplarını Banka Hesabı Tanımlama yetkisi olan kişi tanımlar.")}</small></div></div>`,
      );
    }
    const unassigned = s.unassigned || { totalMinor: 0 };
    if (unassigned.totalMinor || unassigned.newCount) {
      rows.push(`<div class="hof-bank-row is-unassigned" data-bank-unassigned><div><b>${esc(labels.unassigned || "Hesabı Atanmamış Eski Hareketler")}</b> <strong>${esc(fmt(unassigned.totalMinor))}</strong>
        <small>Havale / EFT (102.00) ${esc(fmt(unassigned.bankMinor))} · POS / Kart (108.00) ${esc(fmt(unassigned.cardMinor))} — Gerçek Banka'ya ve hiçbir toplama girmez.${unassigned.newCount ? ` Hesabı belirsiz yeni hareket: ${unassigned.newCount}.` : ""}</small></div>
        <button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="legacy">Şimdi Düzenle</button></div>`);
    }
    // Vadesi gelen planlı işlemler (rozette sayılır; Aşama 4): deftere kendiliğinden yazılmaz, kullanıcı Gerçekleştir ile kaydeder.
    if (view.due?.length) {
      rows.push(`<div class="hof-bank-row is-due" data-bank-due><div><b>Vadesi Gelen Planlı İşlemler</b> <strong>${view.due.length}</strong>
        <small>Planlı işlemler deftere kendiliğinden yazılmaz; bankada gerçekleştiyse Hareketler → Planlı İşlemler'den “Gerçekleştir” ile kaydedin.</small></div>
        <button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="plans-due">Planlı İşlemleri Aç</button></div>`);
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
      : `<div class="hof-bank-empty" data-bank-empty><h4>Henüz Banka Hesabı Yok</h4><p>${canAccounts() ? "Banka hesaplarınızı ve açılış bakiyelerini Kurulum Sihirbazı ile birkaç adımda girin. " : ""}Hesap tanımlanana kadar havale / EFT ile girilen tahsilat ve ödemeler “Hesabı Atanmamış Eski Hareketler”de toplanır.</p></div>`;
    // Son Banka Hareketleri (§8.4; 10 satır, tek kaynaktan): satır İşlem Kartı'nı açar.
    const latest = view.latest?.length
      ? `<div class="hof-bank-subhead"><h4 class="hof-bank-subtitle">Son Banka Hareketleri</h4><button type="button" class="hof-link-button" data-act="mv-open">Tüm Hareketler</button></div>
        <div class="hof-bank-table-wrap">${moveTableHtml(view.latest, { showAccount: true, showBalance: false, extraClass: "hof-bank-latest" })}</div>`
      : "";
    return `<div class="hof-rep-stats hof-bank-stats">${tiles.join("")}</div>${rows.join("")}${empty}${table}${latest}
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
    // GG2 (düşük): satırsız (sıfır) açılış "girilmemiş" sayılır — yerine ilk açılışı girmek ters kayıt yazmaz, bank.cancel istemez.
    const openingSet = Boolean(opening?.hasLines);
    const openingAction = openingSet ? "Açılışı Düzelt" : "Açılış Bakiyesi Gir";
    const policy = a.balanceConfirmed ? `${esc(POLICY_LABELS[a.policy] || a.policy)}${a.negativePolicy ? "" : " <small>(Banka Ayarlarındaki)</small>"}` : `Kontrol Yok <small>(${esc(a.policyNote)})</small>`;
    const blocks = [];
    const canCancel = HOF.can("bank.cancel");
    const readOnly = HOF.license?.writable === false;
    let openingBlock = "";
    if (readOnly) openingBlock = READ_ONLY_TEXT;
    else if (opening && a.openingLocked) openingBlock = `Açılış (${dateText(opening.date)}) kilitli dönemde; ${dateText(a.lockedUntil)} tarihine kadar kayıtlar değiştirilemez.`;
    else if (openingSet && !canCancel) openingBlock = "Eski açılış ters kaydedilir; Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi gerekir.";
    let deleteBlock = "";
    if (readOnly) deleteBlock = READ_ONLY_TEXT;
    else if (a.movementCount) deleteBlock = `Bu hesaba bağlı ${a.movementCount} hareket var; kullanılmayacaksa Pasife Alın.`;
    else if (a.setupNo) deleteBlock = `Hesap Kurulum Sihirbazı'yla kuruldu (${a.setupNo}); önce Ayarlar → Kurulum Geçmişi'nden Geri Al.`;
    else if (a.plannedCount) deleteBlock = `Bu hesapta ${a.plannedCount} planlı işlem var; önce Planlı İşlemler'den silin.`;
    else if (openingSet && a.openingLocked) deleteBlock = "Hesabın açılışı kilitli dönemde; hesap silinemez.";
    else if (openingSet && !canCancel) deleteBlock = "Açılışı olan hesabı silmek için Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi gerekir.";
    if (canAccounts()) {
      if (openingBlock) blocks.push([openingAction, openingBlock]);
      if (deleteBlock) blocks.push(["Sil", deleteBlock]);
    }
    // Hesap Detayı'ndan hareket girişi (§8.5: + Masraf, + Faiz, …): hesabın türüne göre; pasif hesapta pasif ve nedeni yazılı. Döviz
    // hesabında fiş Aşama 13'te (yarım özellik görünmez).
    const moveButtons = [];
    if (HOF.can("bank.move") && a.currency === "TRY") {
      const why = a.status === "active" ? "" : "Hesap pasif; işlem girmek için önce Etkinleştir.";
      if (["demand", "commercial", "other"].includes(a.kind)) moveButtons.push(["v-fee", "+ Masraf", why, ""], ["v-interest", "+ Faiz", why], ["v-other", "+ Diğer İşlem", why]);
      else if (a.kind === "time") moveButtons.push(["v-interest", "+ Faiz", why, ""]);
      else if (a.kind === "card") moveButtons.push(["v-card", "+ Kart Borcu Ödemesi", why, ""]);
      else if (a.kind === "loan" && HOF.can("bank.transfer")) moveButtons.push(["v-loan", "+ Kredi İşlemi", why, ""]);
      if (why && moveButtons.length) blocks.push(["Hareket Girişi", why]);
    }
    const button = (act, label, why = "", cls = "hof-button-ghost") => `<button type="button" class="hof-button hof-button-small ${cls}" data-act="${act}" ${why ? `disabled aria-disabled="true" title="${esc(why)}"` : ""}>${esc(label)}</button>`;
    const actions = [
      ...moveButtons.map(([act, label, why, cls]) => button(act, label, why, cls)),
      ...(canAccounts()
        ? [
            button("edit", "Düzenle"),
            button("opening", openingAction, openingBlock, openingSet ? "hof-button-ghost" : ""),
            button("status", a.status === "active" ? "Pasife Al" : "Etkinleştir"),
            button("delete", "Sil", deleteBlock, "hof-button-danger-ghost"),
          ]
        : []),
    ].join("");
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
        ${fact(openingLabel(a.kind), opening ? `${esc(fmt(opening.amountMinor, a.currency))} · ${esc(dateText(opening.date))}${opening.no && openingSet ? ` · <span class="hof-plan-refno">${esc(opening.no)}</span>` : ""}` : "Girilmedi")}
        ${fact("Eksi Bakiye Denetimi", policy)}
        ${fact("Faturada", a.showOnInvoice ? "IBAN faturada gösterilir" : "")}
        ${fact("Açıklama", esc(a.description))}
      </dl>
      ${actions ? `<div class="hof-chq-actions" role="toolbar" aria-label="Hesap işlemleri">${actions}</div>` : ""}
      ${blocks.length ? `<ul class="hof-inv-blocks" data-bank-blocks>${blocks.map(([name, why]) => `<li><b>${esc(name)} kapalı:</b> ${esc(why)}</li>`).join("")}</ul>` : ""}
      <div class="hof-bank-subhead"><h4 class="hof-bank-subtitle">Hesap Hareketleri</h4><button type="button" class="hof-link-button" data-act="mv-account">Hareketler'de Süz</button></div>
      <div class="hof-bank-moves-wrap" data-moves="account" data-account="${esc(accountMoves.account)}">${movesListHtml(accountMoves)}</div>
      <p class="hof-rep-note">Yürüyen bakiye en yeni hareketten geriye doğru; satıra tıklayınca İşlem Kartı açılır.</p>`;
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
          ${td("Durum", row.locked ? '<span class="hof-plan-badge is-muted">Kilitli Dönem — Atanamaz</span>' : row.closed ? `<span class="hof-plan-badge is-muted" title="${esc(row.reason || "")}">Devir Kapanışı'yla Kapandı</span>` : row.way !== "bank" ? '<span class="hof-plan-badge is-info">Bankaya Geçmiş Say</span>' : target && row.date < target.openingDate ? `<span class="hof-plan-badge is-muted" title="Hesabın açılışı ${esc(dateText(target.openingDate))}; bu hareket açılış bakiyesinin içindedir (Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır).">Açılıştan Önce</span>` : "")}
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
      ${editable ? "" : `<p class="hof-bank-confirm is-warn">${esc(HOF.license?.writable === false ? READ_ONLY_TEXT : "Banka ayarlarını yalnız Banka Ayarları yetkisi olanlar değiştirir.")}</p>`}
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
      { name: "kind", label: "Hesap Türü", type: "select", value: kind === "fx" ? "demand" : kind, options: KINDS.filter(([id]) => id !== "fx").map(([value, label]) => ({ value, label })), readonly: locked, help: locked ? "Hareketi ya da açılış bakiyesi olan hesabın türü ve para birimi değişmez; gerekirse yeni hesap açın." : fxOn() ? "Döviz hesabı için Vadesiz seçip para birimini değiştirin." : "" },
      // GG2 (kullanıcı kararı "Ertelenenler 2.1.0'da GÖRÜNMEZ"): döviz hesabı sonraki sürümde; alan yalnız döviz açıkken (testler) ya da var olan
      // döviz hesabında (salt okunur) görünür.
      ...(fxOn() || (account && account.currency !== "TRY") ? [{ name: "currency", label: "Para Birimi", type: "select", value: account?.currency || "TRY", options: CURRENCIES.map(([value, label]) => ({ value, label })), readonly: locked || !fxOn() }] : []),
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
    const currency = data.currency || "TRY";
    body.currency = currency;
    if (currency !== "TRY" && String(data.openingAmount || "").trim()) body.opening.rate = data.openingRate;
    if (data.kind === "card") Object.assign(body, { statementDay: data.statementDay, dueDay: data.dueDay });
    if (["demand", "card", "loan"].includes(data.kind) && currency === "TRY") body.creditLimit = data.creditLimit;
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
            const currency = data.currency || account.currency || "TRY";
            if (!(account.movementCount > 0 || account.opening?.amountMinor)) Object.assign(body, { kind: data.kind, ...(data.currency ? { currency: data.currency } : {}) });
            if (["demand", "card", "loan"].includes(data.kind) && currency === "TRY") body.creditLimit = data.creditLimit;
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
    const correct = Boolean(account.opening?.hasLines);
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
    // GG2: aktarılabilir tutar hesap bazında (açılıştan ve Devir Kapanışı'ndan sonraki satırlar; tahsilat ve kartla ödeme ayrı) — sunucunun hesabı.
    const availableOf = id => Math.abs(view.legacy?.reclassable?.[id]?.minor || 0);
    const first = accounts.find(account => availableOf(account.id) > 0) || accounts[0];
    if (!accounts.some(account => availableOf(account.id) > 0)) {
      return HOF.toast(mode === "bank" ? "Hesapların açılışından sonra bankaya geçmemiş POS tahsilatı yok. Açılıştan önceki hareketler açılış bakiyesinin içindedir (Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır)." : "Kart hesaplarının açılışından sonra kart borcuna aktarılmamış kartla ödeme yok. Açılıştan önceki hareketler açılış bakiyesinin içindedir (Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır).", { type: "error" });
    }
    const introOf = id => (mode === "bank" ? `Hesap tanımlanmadan girilmiş POS tahsilatlarının bankaya geçmiş tutarını hesaba aktarır. Seçilen hesabın açılışından sonraki satırlar aktarılır (en çok ${fmt(availableOf(id))}).` : `Hesap tanımlanmadan kredi kartıyla yapılmış ödemeleri kurumsal kart borcuna aktarır. Seçilen kartın açılışından sonraki satırlar aktarılır (en çok ${fmt(availableOf(id))}).`);
    const requestId = HOF.requestId();
    HOF.formModal({
      title: mode === "bank" ? "Bankaya Geçmiş Say" : "Kart Borcuna Aktar",
      eyebrow: "HESABI ATANMAMIŞ POS / KART",
      intro: esc(introOf(first.id)),
      fields: [
        { name: "accountId", label: mode === "bank" ? "Banka Hesabı" : "Kurumsal Kredi Kartı", type: "select", value: first.id, options: accounts.map(account => ({ value: account.id, label: `${accountLabel(account)} (${account.code}) · en çok ${fmt(availableOf(account.id))}` })) },
        { name: "date", label: "Tarih", type: "date", required: true, max: "today", value: HOF.localToday() },
        { name: "amount", label: "Tutar", required: true, value: amountInput(availableOf(first.id)), inputmode: "decimal" },
      ],
      onOpen: dialog => {
        const form = dialog.querySelector("form");
        form?.querySelector('[name="accountId"]')?.addEventListener("change", event => {
          const amount = form.querySelector('[name="amount"]');
          if (amount) amount.value = amountInput(availableOf(event.target.value));
          const intro = dialog.querySelector(".hof-modal-text, .hof-form-intro");
          if (intro) intro.textContent = introOf(event.target.value);
        });
      },
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
        ...(fxOn() ? [{ name: "currency", label: "Para Birimi", type: "select", value: "TRY", options: CURRENCIES.map(([value, label]) => ({ value, label })) }] : []),
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
      // Ayarlar'da kaydedilmemiş değişiklik varsa pencere yeniden çizilmez (reload ile aynı kural).
      if (modal && !(view.mode === "tab" && view.tab === "settings" && view.dirty)) render();
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
    if (act === "skip") {
      // GG2 (düşük): doldurulmuş hesap formu sorusuz atılmaz.
      const form = state.step === "account" ? wizardForm() : null;
      const typed = form && ["bankName", "name", "iban", "openingAmount"].some(name => String(form.querySelector(`[name="${name}"]`)?.value || "").trim());
      const next = state.step === "account" && state.legacy ? "legacy" : "done";
      if (!typed) return goWizard(state, next);
      return HOF.confirm({ title: "Bu Adımı Atla", message: "Forma girilenler kaydedilmeyecek. Bu adım atlansın mı?", confirmLabel: "Kaydetmeden Atla", danger: true }).then(go => go && goWizard(state, next));
    }
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

  // ---------- Hareketler (Aşama 4; §8.6) ----------
  /** Fiş formunun seçenekleri (türler, masraf türleri, vergi kipleri, tekrarlar, hesap adları, varsayılanlar); banka değişince boşalır. */
  function voucherMeta(force = false) {
    if (!metaCache || force)
      metaCache = api("/voucher-meta").catch(error => {
        metaCache = null;
        throw error;
      });
    return metaCache;
  }
  const STATUS_FILTERS = [
    ["", "Etkin ve Ters Kaydedilen"],
    ["active", "Yalnız Etkin"],
    ["reversed", "Ters Kaydedilen"],
    ["cancelled", "İptal Edilen"],
    ["all", "Hepsi"],
  ];
  const DIR_FILTERS = [
    ["", "Tümü"],
    ["in", "Giriş"],
    ["out", "Çıkış"],
  ];
  const filtered = state => Object.entries(state.filter).some(([key, value]) => key !== "account" && String(value || "").trim());
  /**
   * Liste yüklemesi (HOF.listGate kuralı): kullanıcının yüklemesi eski yanıtları geçersiz kılar; arka plan yenilemesi (quiet) kılmaz ve
   * yüklenmiş satır sayısını korur (en çok 200); "Daha Fazla" imleçle sonraki sayfayı ekler, süzgeç yüklenirken yok sayılır. İmleç geçersizse
   * (sunucu yeniden başladı ya da süzgeç değişti) liste baştan açılır. paint: false → yalnız veri (pencere çizimiyle birlikte gösterilir).
   */
  async function loadMoves(state, { more = false, quiet = false, paint = true } = {}) {
    const run = state.gate.start({ quiet, more });
    if (!run) return;
    const options = quiet ? { background: true } : {};
    try {
      if (state.planned) {
        const query = new URLSearchParams();
        if (state.filter.account) query.set("account", state.filter.account);
        const data = await api(`/plans${String(query) ? `?${query}` : ""}`, options);
        if (!run.current()) return;
        run.applied();
        Object.assign(state, { plans: data.plans || [], loaded: true, error: "", account: state.filter.account, hasMore: false });
      } else {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(state.filter)) if (String(value ?? "").trim()) query.set(key, String(value).trim());
        if (more) query.set("cursor", state.cursor || "");
        else if (quiet && state.rows.length > PAGE) query.set("limit", String(Math.min(200, state.rows.length)));
        const data = await api(`/movements?${query}`, options);
        if (!run.current()) return;
        run.applied();
        Object.assign(state, { rows: more ? [...state.rows, ...data.rows] : data.rows, cursor: data.nextCursor || null, hasMore: Boolean(data.hasMore), balance: Boolean(data.balance), loaded: true, error: "", account: data.account || "" });
      }
    } catch (error) {
      if (!run.current()) return;
      if (more) {
        HOF.toastError(error);
        if (error?.data?.code === "bank-cursor") return loadMoves(state, { paint });
        return;
      }
      if (quiet && !HOF.lostRecord(error)) throw error;
      Object.assign(state, { rows: [], plans: [], loaded: true, error: error.message, hasMore: false, cursor: null });
    } finally {
      run.done();
    }
    if (paint) paintMoves(state);
  }
  function paintMoves(state) {
    const node = root()?.querySelector(`[data-moves="${state.key}"]`);
    if (!node) return;
    node.dataset.account = state.account || "";
    HOF.swap(node, movesListHtml(state));
  }
  /** Hareket satırları: tarih, İşlem No, tür (durum rozetiyle), [hesap], açıklama (cari, açıklama, referans, fatura), tutar, [bakiye]. */
  // debt (GG2 düşük): kurumsal kart ve kredi hesabında yürüyen bakiye "Borç" kolonunda artı gösterilir (başlıktaki Borç ve Açılıştaki Borç gibi).
  function moveTableHtml(rows, { showAccount = false, showBalance = false, extraClass = "", debt = false } = {}) {
    const body = rows
      .map(row => {
        const desc = [row.partyName, row.description, row.reference ? `Ref. ${row.reference}` : "", row.invoiceNo ? `Fatura ${row.invoiceNo}` : "", row.feeNo ? `Masraf ${row.feeNo}` : ""].filter(Boolean).join(" · ");
        const badge = row.status === "active" ? "" : ` <span class="hof-plan-badge is-muted">${esc(row.statusLabel)}</span>`;
        const cls = row.status !== "active" ? "is-muted" : row.signedMinor >= 0 ? "is-in" : "is-out";
        return `<tr data-event="${esc(row.eventId)}" data-no="${esc(row.no)}" data-type="${esc(row.type)}" data-state="${esc(row.status)}" data-signed="${Number(row.signedMinor) || 0}" data-balance="${row.balanceAfterMinor === null || row.balanceAfterMinor === undefined ? "" : row.balanceAfterMinor}" tabindex="0" class="${cls}">
          ${td("Tarih", esc(dateText(row.date)))}
          ${td("İşlem No", `<span class="hof-plan-refno">${esc(row.no)}</span>`)}
          ${td("Tür", `${esc(row.typeLabel)}${badge}`)}
          ${showAccount ? td("Hesap", esc(row.accountLabel || "—")) : ""}
          ${td("Açıklama", esc(desc || "—"))}
          ${td("Tutar", `<b>${esc(signed(row.signedMinor))}</b>`, "num")}
          ${showBalance ? td(debt ? "Borç" : "Bakiye", esc(fmt(debt ? -row.balanceAfterMinor : row.balanceAfterMinor)), "num") : ""}
        </tr>`;
      })
      .join("");
    return `<table class="hof-table hof-bank-table hof-bank-moves ${extraClass}"><thead><tr><th>Tarih</th><th>İşlem No</th><th>Tür</th>${showAccount ? "<th>Hesap</th>" : ""}<th>Açıklama</th><th class="num">Tutar</th>${showBalance ? `<th class="num">${debt ? "Borç" : "Bakiye"}</th>` : ""}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function movesListHtml(state) {
    if (!state.loaded || state.error) return HOF.listPending(state.error);
    if (state.planned) return plansHtml(state);
    if (!state.rows.length) return `<p class="hof-empty" data-moves-empty>${filtered(state) ? "Bu süzgeçte hareket yok." : state.key === "account" ? "Bu hesapta hareket yok." : "Henüz banka hareketi yok."}</p>`;
    const more = state.hasMore ? `<div class="hof-bank-more"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="mv-more" data-moves-key="${esc(state.key)}">Daha Fazla Göster</button><small>${state.rows.length} hareket gösteriliyor</small></div>` : state.rows.length > PAGE ? `<p class="hof-rep-note">${state.rows.length} hareketin hepsi gösteriliyor.</p>` : "";
    const account = state.account ? (view.account?.id === state.account ? view.account : (view.list?.accounts || []).find(item => item.id === state.account)) : null;
    const debt = Boolean(account) && !MAIN_KINDS.has(account.kind);
    return `<div class="hof-bank-table-wrap">${moveTableHtml(state.rows, { showAccount: !state.account, showBalance: state.balance, extraClass: state.key === "account" ? "hof-bank-recent" : "", debt })}</div>${more}`;
  }
  const PLAN_OUT = new Set(["fee", "interest_out", "other_out", "card_payment", "loan_repay"]);
  function plansHtml(state) {
    if (!state.plans.length) return '<p class="hof-empty" data-moves-empty>Planlı işlem yok. Kira, kredi taksiti ya da masraf talimatı gibi tekrar eden ödemeleri “+ Planlı İşlem” ile ekleyin.</p>';
    const canMove = HOF.can("bank.move");
    const rows = state.plans
      .map(plan => {
        const allowed = canMove && (!TRANSFER_KINDS.has(plan.kind) || HOF.can("bank.transfer"));
        const amount = (PLAN_OUT.has(plan.kind) ? -1 : 1) * plan.amountMinor;
        const actions = allowed ? `<button type="button" class="hof-link-button" data-act="plan-run" data-plan="${esc(plan.id)}">Gerçekleştir</button>${plan.repeat !== "none" ? `<button type="button" class="hof-link-button" data-act="plan-skip" data-plan="${esc(plan.id)}">Atla</button>` : ""}<button type="button" class="hof-link-button is-danger" data-act="plan-cancel" data-plan="${esc(plan.id)}">Sil</button>` : "";
        return `<tr data-plan="${esc(plan.id)}" class="${plan.due ? "is-due" : ""}">
          ${td("Planlı Tarih", esc(dateText(plan.plannedDate)))}
          ${td("Tür", esc(plan.typeLabel))}
          ${td("Hesap", `${esc(plan.accountLabel || "—")}${plan.toAccountLabel ? `<small>${esc(plan.toAccountLabel)}</small>` : ""}`)}
          ${td("Tekrar", esc(plan.repeatLabel))}
          ${td("Açıklama", esc(plan.description || "—"))}
          ${td("Tutar", `<b>${esc(signed(amount))}</b>`, "num")}
          ${td("Durum", plan.due ? '<span class="hof-plan-badge is-soon">Vadesi Geldi</span>' : '<span class="hof-plan-badge is-info">Planlı</span>')}
          <td class="hof-bank-actions-cell">${actions}</td>
        </tr>`;
      })
      .join("");
    return `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-plans"><thead><tr><th>Planlı Tarih</th><th>Tür</th><th>Hesap</th><th>Tekrar</th><th>Açıklama</th><th class="num">Tutar</th><th>Durum</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  /** Hareketler sekmesi: işlem düğmeleri, süzgeçler, liste (ya da Planlı İşlemler). */
  function movementsHtml() {
    const s = moves;
    const canMove = HOF.can("bank.move");
    const accounts = view.list?.accounts || [];
    const option = (value, label, current) => `<option value="${esc(value)}" ${String(value) === String(current ?? "") ? "selected" : ""}>${esc(label)}</option>`;
    const banks = new Map();
    for (const account of accounts) {
      if (!banks.has(account.bankName)) banks.set(account.bankName, []);
      banks.get(account.bankName).push(account);
    }
    const accountSelect = `<select data-mv="account" aria-label="Hesap">${option("", "Tüm Hesaplar", s.filter.account)}${[...banks.entries()].map(([bank, list]) => `<optgroup label="${esc(bank)}">${list.map(account => option(account.id, `${account.name} (${account.code})${account.status === "passive" ? " · Pasif" : ""}`, s.filter.account)).join("")}</optgroup>`).join("")}</select>`;
    const groups = view.meta?.groups || [];
    const filter = (label, control, wide = false) => `<label class="hof-bank-filter${wide ? " is-wide" : ""}"><span>${esc(label)}</span>${control}</label>`;
    const tools = canMove
      ? `<button type="button" class="hof-button hof-button-small" data-act="v-fee">+ Masraf</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="v-interest">+ Faiz</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="v-other">+ Diğer İşlem</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="plan-new">+ Planlı İşlem</button>`
      : "";
    const filters = s.planned
      ? filter("Hesap", accountSelect)
      : [
          filter("Hesap", accountSelect),
          filter("İşlem Türü", `<select data-mv="type">${option("", "Tümü", s.filter.type)}${groups.map(item => option(item.key, item.label, s.filter.type)).join("")}</select>`),
          filter("Giriş ve Çıkış", `<select data-mv="dir">${DIR_FILTERS.map(([value, label]) => option(value, label, s.filter.dir)).join("")}</select>`),
          filter("Durum", `<select data-mv="status">${STATUS_FILTERS.map(([value, label]) => option(value, label, s.filter.status)).join("")}</select>`),
          filter("Başlangıç", `<input type="date" data-mv="from" value="${esc(s.filter.from)}" max="${esc(HOF.localToday())}">`),
          filter("Bitiş", `<input type="date" data-mv="to" value="${esc(s.filter.to)}">`),
          filter("En Az Tutar", `<input type="text" inputmode="decimal" data-mv="min" value="${esc(s.filter.min)}" placeholder="ör. 100">`),
          filter("En Çok Tutar", `<input type="text" inputmode="decimal" data-mv="max" value="${esc(s.filter.max)}" placeholder="ör. 5.000">`),
          filter("Ara", `<input type="search" data-mv="q" value="${esc(s.filter.q)}" maxlength="100" placeholder="Cari adı, açıklama, referans ya da İşlem No">`, true),
        ].join("");
    return `<div class="hof-bank-toolbar">${tools}<div class="hof-rep-presets" role="group" aria-label="Görünüm"><button type="button" class="hof-rep-chip ${s.planned ? "is-on" : ""}" aria-pressed="${s.planned}" data-act="mv-planned">Planlı İşlemler</button></div></div>
      <div class="hof-bank-filters" data-mv-filters>${filters}${filtered(s) && !s.planned ? '<button type="button" class="hof-link-button" data-act="mv-clear">Süzgeçleri Temizle</button>' : ""}</div>
      <div class="hof-bank-moves-wrap" data-moves="main" data-account="${esc(s.account)}">${movesListHtml(s)}</div>
      <p class="hof-rep-note">${s.planned ? "Planlı işlemler deftere kendiliğinden yazılmaz; bankada gerçekleşince “Gerçekleştir” ile planlı ya da gerçek tarihle kaydedilir." : "Yürüyen bakiye tek hesap seçiliyken ve başka süzgeç yokken görünür. Satıra tıklayınca İşlem Kartı açılır."}</p>`;
  }
  let searchTimer = 0;
  /**
   * Süzgeç değişti: ekrandaki bütün süzgeç alanları birlikte okunur (bekleyen arama yazısı da kaybolmaz), liste baştan yüklenir (imleç
   * bırakılır; HOF.listGate eski yanıtı yok sayar). Hiçbir değer değişmediyse yeniden yüklenmez.
   */
  function applyFilters() {
    clearTimeout(searchTimer);
    let changed = false;
    for (const node of root()?.querySelectorAll("[data-mv-filters] [data-mv]") || []) {
      const key = node.dataset.mv;
      const clean = String(node.value ?? "").trim();
      if (!Object.hasOwn(moves.filter, key) || moves.filter[key] === clean) continue;
      moves.filter[key] = clean;
      changed = true;
    }
    if (!changed) return;
    moves.cursor = null;
    const clear = root()?.querySelector('[data-act="mv-clear"]');
    if (!clear && filtered(moves)) root()?.querySelector("[data-mv-filters]")?.insertAdjacentHTML("beforeend", '<button type="button" class="hof-link-button" data-act="mv-clear">Süzgeçleri Temizle</button>');
    loadMoves(moves);
  }
  /** Hareketler sekmesini (ya da Planlı İşlemler'i) bir hesapla açar. */
  function openMovements({ account = moves.filter.account, planned = false } = {}) {
    moves.filter = { ...newMoves("main").filter, account: account || "" };
    moves.planned = planned;
    moves.cursor = null;
    moves.rows = [];
    moves.plans = [];
    moves.loaded = false;
    setTab("movements");
  }

  // ---------- İşlem Kartı (§8.6) ----------
  const TRANSFER_KINDS = new Set(["loan_draw", "loan_repay"]);
  const PERM_NAMES = { "bank.cancel": "Banka Hareketi Silme, İptal ve Ters Kayıt", "bank.move": "Banka Hareketi Girme ve Bankadan Çıkış", "bank.transfer": "Transfer Yapma", "invoices.manage": "Fatura Yönetimi" };
  /** Yetki nedeni (pasif düğmenin yanında yazılır): eksik yetkilerin adları. */
  const permWhy = (action, list) => {
    const missing = list.filter(permission => !HOF.can(permission));
    return missing.length ? `${action} için ${missing.map(permission => PERM_NAMES[permission] || permission).join(" ve ")} yetkisi gerekir.` : "";
  };
  // İşlem Kartı'ndaki İşlem Geçmişi'nin adları (Yönetim → İşlem Geçmişi'yle aynı türler; cümle düzeninde).
  const HISTORY_LABELS = {
    "bank.voucher.created": "Fiş kaydedildi",
    "bank.voucher.reversed": "Ters kaydedildi",
    "bank.voucher.corrected": "Düzeltildi (ters kayıt ve yeni fiş)",
    "bank.event.info": "Açıklama düzeltildi",
    "bank.plan.created": "Planlı işlem eklendi",
    "bank.plan.executed": "Planlı işlem gerçekleştirildi",
    "bank.plan.skipped": "Planlı işlemin bu dönemi atlandı",
    "bank.plan.cancelled": "Planlı işlem silindi",
    "bank.account.created": "Hesap açıldı",
    "bank.account.opening.entered": "Açılış bakiyesi girildi",
    "bank.account.opening.corrected": "Açılış düzeltildi",
    "bank.legacy.assigned": "Hesaba atandı",
    "bank.legacy.reclassed": "Eski bakiye aktarıldı",
    "bank.setup": "Kurulum Sihirbazı çalıştı",
    "bank.setup.undone": "Kurulum geri alındı",
  };
  const isVat = tax => tax === "vat_incl" || tax === "vat_excl";
  /** İşlemin tutarı: faturalı (KDV'li) masrafın başlığı satırsızdır (parası faturanın havalesinde); tutarı faturanın ödenecek tutarıdır. */
  const eventAmount = c => (c?.fee?.taxKind === "vat" && !c.source ? c.fee.totalMinor : c?.tryMinor || 0);
  /** "Kaynak → Hedef" (ABC Ltd. (Cari) → Ziraat · Ana TL Hesabı (Banka)). */
  function flowText(c) {
    if (!c.account) return "";
    const account = `${c.account.label} (Banka)`;
    const counter = c.counterAccount ? `${c.counterAccount.label} (${kindLabel(c.counterAccount.kind)})` : "";
    const party = c.party?.name ? `${c.party.name} (Cari)` : "";
    const line = role => c.lines.find(item => item.role === role);
    const other = party || counter || (c.direction === "in" ? (line("income") ? `${line("income").gl} ${line("income").glName}` : "") : line("expense") ? `${line("expense").gl} ${line("expense").glName}` : "");
    return c.direction === "in" ? `${other || "—"} → ${account}` : `${account} → ${other || "—"}`;
  }
  const backLabel = () => (view.eventBack === "account" ? "Hesap" : view.eventBack === "overview" ? "Genel Bakış" : "Hareketler");
  function eventHtml() {
    const back = `<button type="button" class="hof-plan-back" data-act="ev-back">← ${esc(backLabel())}</button>`;
    const c = view.event;
    if (!c) return `<div class="hof-bank-detail-head">${back}</div>${HOF.listPending(view.error)}`;
    const feeHeader = c.fee?.taxKind === "vat" && !c.source;
    const extra = [...(TRANSFER_KINDS.has(c.type) ? ["bank.transfer"] : []), ...(feeHeader ? ["invoices.manage"] : [])];
    const reverseWhy = (c.actions?.reverse?.allowed === false && c.actions.reverse.reason) || permWhy("Ters Kaydet", ["bank.cancel", ...extra]);
    const correctWhy = (c.actions?.correct?.allowed === false && c.actions.correct.reason) || permWhy("Düzelt", ["bank.move", "bank.cancel", ...extra]);
    // GG2 (düşük): modülden gelen harekette açıklama kendi penceresinde (sunucu actions.info kapalı ve nedeni).
    const infoWhy = (c.actions?.info?.allowed === false && c.actions.info.reason) || permWhy("Açıklamayı Düzelt", ["bank.move"]);
    const blocks = [];
    if (reverseWhy && reverseWhy === correctWhy) blocks.push(["Ters Kaydet ve Düzelt", reverseWhy]);
    else {
      if (reverseWhy) blocks.push(["Ters Kaydet", reverseWhy]);
      if (correctWhy) blocks.push(["Düzelt", correctWhy]);
    }
    if (infoWhy) blocks.push(["Açıklamayı Düzelt", infoWhy]);
    const button = (act, label, why, cls = "hof-button-ghost") => `<button type="button" class="hof-button hof-button-small ${cls}" data-act="${act}" ${why ? `disabled aria-disabled="true" title="${esc(why)}"` : ""}>${esc(label)}</button>`;
    const toolbar = HOF.can("bank.move") || HOF.can("bank.cancel") ? `<div class="hof-chq-actions" role="toolbar" aria-label="İşlem işlemleri">${button("ev-reverse", "Ters Kaydet", reverseWhy, "hof-button-danger-ghost")}${button("ev-correct", "Düzelt", correctWhy)}${button("ev-info", "Açıklamayı Düzelt", infoWhy)}</div>` : "";
    const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "");
    const link = (item, label = item.no) => `<button type="button" class="hof-link-button" data-event-link="${esc(item.id)}">${esc(label)}</button>`;
    const fee = c.fee;
    const rate = ppm => String((Number(ppm) || 0) / 10_000).replace(".", ",");
    const relations = [
      c.reversal?.by ? `<li>Ters Kaydı: ${link(c.reversal.by)} · ${esc(dateText(c.reversal.by.date))}</li>` : "",
      c.reversal?.of ? `<li>Ters Kaydettiği İşlem: ${link(c.reversal.of)} · ${esc(dateText(c.reversal.of.date))}</li>` : "",
      c.linkedFee ? `<li>Masrafın İşlem Kartı: ${link(c.linkedFee)}</li>` : "",
      c.payment ? `<li>Bankadan Ödeme: ${link(c.payment)}</li>` : "",
    ].filter(Boolean);
    const debit = c.lines.filter(line => line.side === "D").reduce((sum, line) => sum + line.tryMinor, 0);
    const credit = c.lines.filter(line => line.side === "C").reduce((sum, line) => sum + line.tryMinor, 0);
    const lines = c.lines.length
      ? `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-bank-lines"><thead><tr><th>Hesap</th><th>Alt Hesap</th><th>Açıklama</th><th class="num">Borç</th><th class="num">Alacak</th></tr></thead><tbody>${c.lines
          .map(line => `<tr data-gl="${esc(line.gl)}" data-side="${esc(line.side)}" data-minor="${Number(line.tryMinor) || 0}">${td("Hesap", `<b>${esc(line.gl)}</b> ${esc(line.glName)}`)}${td("Alt Hesap", line.sub ? `${esc(line.sub)}${line.subName ? `<small>${esc(line.subName)}</small>` : ""}` : "—")}${td("Açıklama", esc(line.memo || "—"))}${td("Borç", line.side === "D" ? esc(fmt(line.tryMinor)) : "", "num")}${td("Alacak", line.side === "C" ? esc(fmt(line.tryMinor)) : "", "num")}</tr>`)
          .join("")}</tbody><tfoot><tr class="hof-bank-total"><td colspan="3" data-label="Toplam">Toplam</td>${td("Borç", esc(fmt(debit)), "num")}${td("Alacak", esc(fmt(credit)), "num")}</tr></tfoot></table></div>`
      : '<p class="hof-empty">Bu işlemin yevmiye satırı yok.</p>';
    const history = (c.history || []).map(item => `<li><b>${esc(HISTORY_LABELS[item.type] || item.type)}</b> <small>${esc([item.actorName, HOF.formatDateTime(item.at)].filter(Boolean).join(" · "))}</small></li>`).join("");
    return `<div data-bank-event><div class="hof-bank-detail-head">${back}
        <div class="hof-plan-title"><h3>${esc(c.typeLabel)} <span class="hof-plan-refno" data-event-no>${esc(c.no)}</span> <span class="hof-plan-badge ${c.status === "active" ? "is-done" : "is-muted"}" data-event-status>${esc(c.statusLabel)}</span></h3><small>${esc(flowText(c))}</small></div>
        <div class="hof-chq-amount"><span>Tutar</span><strong data-event-amount>${esc(fmt(eventAmount(c)))}</strong></div>
      </div>
      ${c.locked ? `<p class="hof-bank-confirm is-warn">Bu işlem kilitli dönemde (${esc(dateText(c.lockedUntil))} ve öncesi); kendisi değişmez. Ters Kaydet ve Düzelt'te ters kaydı bugün tarihli yazılır, kilitli dönem aynı kalır.</p>` : ""}
      <dl class="hof-chq-facts">
        ${fact("İşlem No", `<span class="hof-plan-refno">${esc(c.no)}</span>`)}
        ${fact("Tür", esc(c.typeLabel))}
        ${fact("Tarih", esc(dateText(c.date)))}
        ${c.valueDate && c.valueDate !== c.date ? fact("Valör", esc(dateText(c.valueDate))) : ""}
        ${fact("Durum", esc(c.statusLabel))}
        ${fact("Hesap", c.account ? `${esc(c.account.label)} <small>${esc(c.account.glSub)}</small>` : "")}
        ${fact("Karşı Hesap", c.counterAccount ? `${esc(c.counterAccount.label)} <small>${esc(c.counterAccount.glSub)}</small>` : "")}
        ${fact("Cari", c.party?.name ? (HOF.can("accounts.view") ? `<button type="button" class="hof-link-button" data-open-party="${esc(c.party.id)}">${esc(c.party.name)}</button>` : esc(c.party.name)) : "")}
        ${fact("Fatura", c.invoice ? `<button type="button" class="hof-link-button" data-open-invoice="${esc(c.invoice.id)}">${esc(c.invoice.number)}</button>` : "")}
        ${fee ? fact("Masraf Türü", `${esc(fee.feeTypeName || "—")} <small>${esc(fee.gl)} ${esc(view.meta?.glNames?.[fee.gl] || "")}</small>`) : ""}
        ${fee ? fact("Matrah", esc(fmt(fee.baseMinor))) : ""}
        ${fee && fee.taxKind === "bsmv" ? fact("BSMV", `${esc(fmt(fee.taxMinor))} <small>%${esc(rate(fee.ratePpm))}</small>`) : ""}
        ${fee && fee.taxKind === "vat" ? fact("KDV", `${esc(fmt(fee.vatMinor))} <small>%${esc(rate(fee.ratePpm))}</small>`) : ""}
        ${fact("Referans", esc(c.reference))}
        ${fact("Açıklama", esc(c.description))}
        ${fact("Kanal", esc(c.channel))}
        ${fact("Kaynak", c.source ? esc(c.source.label) : "")}
        ${fact("Giren", esc([c.createdByName, HOF.formatDateTime(c.createdAt)].filter(Boolean).join(" · ")))}
        ${c.updatedAt ? fact("Son Değişiklik", esc(HOF.formatDateTime(c.updatedAt))) : ""}
      </dl>
      ${relations.length ? `<ul class="hof-bank-links">${relations.join("")}</ul>` : ""}
      ${toolbar}
      ${blocks.length ? `<ul class="hof-inv-blocks" data-bank-event-blocks>${blocks.map(([name, why]) => `<li><b>${esc(name)} kapalı:</b> ${esc(why)}</li>`).join("")}</ul>` : ""}
      <h4 class="hof-bank-subtitle">${c.linesSource === "voucher" ? "Fiş Satırları" : "Yevmiye Satırları"}</h4>
      ${lines}
      ${history ? `<h4 class="hof-bank-subtitle">İşlem Geçmişi</h4><ol class="hof-bank-history">${history}</ol>` : ""}
      </div>`;
  }

  // ---------- Fiş formları (masraf, faiz, diğer, kart borcu, kredi; Düzelt; Planlı İşlem) ----------
  const VOUCHER_GROUPS = {
    fee: { title: "Banka Masrafı", types: ["fee"] },
    interest: { title: "Faiz", types: ["interest_in", "interest_out"] },
    other: { title: "Diğer İşlem", types: ["other_in", "other_out", "card_payment", "loan_draw", "loan_repay"] },
  };
  const ALL_TYPES = ["fee", "interest_in", "interest_out", "other_in", "other_out", "card_payment", "loan_draw", "loan_repay"];
  const TYPE_NAMES = { fee: "Banka Masrafı", interest_in: "Faiz Geliri", interest_out: "Faiz Gideri", other_in: "Diğer Gelir", other_out: "Diğer Gider", card_payment: "Kart Borcu Ödemesi", loan_draw: "Kredi Kullanımı", loan_repay: "Kredi Geri Ödemesi" };
  const mainKinds = type => (type === "interest_in" ? ["demand", "commercial", "other", "time"] : ["demand", "commercial", "other"]);
  // Sunucunun alan adı (HttpError field) → formdaki alan; alanı yazmayan hatalar koddan.
  const VOUCHER_FIELD = { amount: "amount", Tutar: "amount", "Stopaj Tutarı": "stoppageRate", stoppageAmount: "stoppageRate", "Stopaj Oranı": "stoppageRate", stoppageRate: "stoppageRate", "BSMV / KKDF": "taxAmount", taxAmount: "taxAmount", Faiz: "interestAmount", interestAmount: "interestAmount", "BSMV Oranı": "taxRate", "KDV Oranı": "taxRate", taxRate: "taxRate", vatRate: "taxRate", date: "date", plannedDate: "plannedDate", accountId: "accountId", cardAccountId: "cardAccountId", loanAccountId: "loanAccountId", feeType: "feeType", tax: "tax", gl: "gl", invoiceNo: "invoiceNo", "Fatura No": "invoiceNo", partyId: "partyId", type: "type", Açıklama: "description", Referans: "reference", repeat: "repeat" };
  const VOUCHER_CODE = { "date-future": "date", "date-invalid": "date", "date-missing": "date", "period-locked": "date", "bank-before-opening": "date", "bank-fee-party": "partyId", "bank-party-missing": "partyId", "bank-fee-invoice": "invoiceNo", "invoice-duplicate": "invoiceNo", "bank-stoppage": "stoppageRate", "bank-gl-forbidden": "gl" };
  /** "1.234,56" / "1.000" / "10,5" → kuruş (yalnız önizleme; kural ve yuvarlama sunucuda). Geçersizse null. */
  function previewMinor(value) {
    let text = String(value ?? "").replace(/[\s₺]/g, "");
    if (!text) return null;
    if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    return Math.round(Number(text) * 100);
  }
  const previewPpm = value => {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text || !/^\d+(\.\d+)?$/.test(text)) return null;
    return Math.round(Number(text) * 10_000);
  };
  // round(a × b / c), yarım birim yukarı (sunucunun mulDiv'i gibi; BigInt).
  const mulDiv = (a, b, c) => Number((2n * BigInt(a) * BigInt(b) + BigInt(c)) / (2n * BigInt(c)));
  function activeTlAccounts() {
    return (view.list?.accounts || []).filter(account => account.status === "active" && account.currency === "TRY");
  }
  const accountOption = account => ({ value: account.id, label: `${account.bankName} · ${account.name} (${account.code})` });
  /**
   * Fiş formu. mode: create (yeni fiş), correct (Düzelt: tür değişmez, ön değerler İşlem Kartı'ndan), plan (+ Planlı İşlem; KDV'li masraf
   * planlanmaz). group: fee | interest | other. Benzer İşlem (409 bank-similar) → "Yine de Kaydet" aynı istek kimliğiyle similarOk:true.
   */
  async function voucherForm({ mode = "create", group = "fee", accountId = "", counterId = "", type = "", card = null } = {}) {
    if (!HOF.can("bank.move")) return HOF.toast("Banka hareketi girmek Banka Hareketi Girme ve Bankadan Çıkış yetkisi ister.", { type: "error" });
    let meta;
    try {
      meta = await voucherMeta();
      view.meta = meta;
    } catch (error) {
      return HOF.toastError(error);
    }
    const accounts = activeTlAccounts();
    const cards = accounts.filter(account => account.kind === "card");
    const loans = accounts.filter(account => account.kind === "loan");
    let types = mode === "correct" ? [card.type] : mode === "plan" ? ALL_TYPES : VOUCHER_GROUPS[group].types;
    if (mode !== "correct") types = types.filter(item => (item !== "card_payment" || cards.length) && (!TRANSFER_KINDS.has(item) || (loans.length && HOF.can("bank.transfer"))) && accounts.some(account => mainKinds(item).includes(account.kind)));
    if (!types.length) return HOF.toast("Bu işlem için uygun, etkin bir TL banka hesabı yok. Önce Hesaplar'dan hesap açın.", { type: "error" });
    const form0 = mode === "correct" ? card.form || {} : {};
    const initialType = type && types.includes(type) ? type : form0.type || types[0];
    const canVat = mode !== "plan" && HOF.can("invoices.manage");
    const taxes = (meta.taxes || []).filter(item => !item.invoice || canVat);
    const defaultTax = taxes.some(item => item.key === (form0.tax || meta.defaults.tax)) ? form0.tax || meta.defaults.tax : taxes[0]?.key || "none";
    const requestId = HOF.requestId();
    const glLabel = code => `${code} · ${meta.glNames?.[code] || code}`;
    const fields = [
      types.length > 1 || mode === "correct" ? { name: "type", label: "İşlem Türü", type: "select", value: initialType, options: types.map(item => ({ value: item, label: TYPE_NAMES[item] || item })), readonly: mode === "correct", help: mode === "correct" ? "Düzelt'te işlemin türü değişmez; başka türde işlem için Ters Kaydet ile iptal edip yeni işlem girin." : "" } : null,
      { name: "accountId", label: "Banka Hesabı", type: "select", required: true, value: "", options: [] },
      { name: "cardAccountId", label: "Kurumsal Kredi Kartı", type: "select", value: form0.cardAccountId || counterId || cards[0]?.id || "", options: cards.map(accountOption) },
      { name: "loanAccountId", label: "Kredi Hesabı", type: "select", value: form0.loanAccountId || counterId || loans[0]?.id || "", options: loans.map(accountOption) },
      mode === "plan" ? { name: "plannedDate", label: "Planlı Tarih", type: "date", required: true, value: HOF.localToday(), help: "Planlı işlem deftere kendiliğinden yazılmaz; günü gelince Vadesi Gelen Planlı İşlemler'de görünür." } : { name: "date", label: "İşlem Tarihi", type: "date", required: true, max: "today", value: mode === "correct" ? (card.locked ? HOF.localToday() : card.date) : HOF.localToday() },
      mode === "plan" ? { name: "repeat", label: "Tekrar", type: "select", value: "none", options: (meta.repeats || []).map(item => ({ value: item.key, label: item.label })) } : null,
      { name: "feeType", label: "Masraf Türü", type: "select", value: form0.feeType || (meta.feeTypes || []).find(item => item.key === "eft")?.key || meta.feeTypes?.[0]?.key || "", options: (meta.feeTypes || []).map(item => ({ value: item.key, label: `${item.name} (${item.gl})` })) },
      { name: "tax", label: "Vergi", type: "select", value: defaultTax, options: taxes.map(item => ({ value: item.key, label: item.label })) },
      { name: "taxRate", label: "BSMV Oranı (%)", value: form0.taxRate || "", inputmode: "decimal" },
      { name: "invoiceNo", label: "Fatura No", value: form0.invoiceNo || "", maxlength: 40, placeholder: "Bankanın kestiği masraf faturasının numarası" },
      { name: "amount", label: "Tutar", required: true, value: form0.amount || "", inputmode: "decimal", placeholder: "ör. 1.250,00" },
      { name: "stoppageRate", label: "Stopaj Oranı (%)", value: mode === "correct" ? form0.stoppageRate || "" : meta.defaults?.stoppageRate || "", inputmode: "decimal", help: "Bankanın kestiği mevduat stopajı; son kullanılan oran önerilir." },
      { name: "taxAmount", label: "BSMV / KKDF Tutarı", value: form0.taxAmount && form0.taxAmount !== "0,00" ? form0.taxAmount : "", inputmode: "decimal" },
      { name: "interestAmount", label: "Faiz Tutarı", value: form0.interestAmount && form0.interestAmount !== "0,00" ? form0.interestAmount : "", inputmode: "decimal" },
      { name: "description", label: "Açıklama", value: form0.description || "", maxlength: 500 },
      { name: "reference", label: "Referans", value: form0.reference || "", maxlength: 100, placeholder: "Dekont ya da talimat no" },
    ].filter(Boolean);
    const hiddenType = types.length === 1 && mode !== "correct" ? `<input type="hidden" name="type" value="${esc(initialType)}">` : "";
    const extraHtml = `${hiddenType}<details class="hof-bank-adv" data-adv><summary>Gelişmiş Seçenekler</summary><div class="hof-bank-adv-body">${HOF.fieldHtml({ name: "gl", label: "Gelir Hesabı", type: "select", value: form0.gl || "", options: [] })}<p class="hof-rep-note" data-gl-note></p></div></details><p class="hof-bank-preview-line" data-voucher-preview aria-live="polite"></p>`;
    let formNode = null;
    let picker = null;
    const rateTouched = { value: Boolean(form0.taxRate) };
    HOF.formModal({
      title: mode === "correct" ? "İşlemi Düzelt" : mode === "plan" ? "Planlı İşlem" : VOUCHER_GROUPS[group].title,
      eyebrow: mode === "correct" ? card.no : moduleName().toLocaleUpperCase("tr-TR"),
      intro: mode === "correct" ? `${card.no} ters kaydedilir ve düzeltilmiş hâliyle yeni işlem yazılır (tek işlemde); ikisi de hareketlerde ve İşlem Geçmişi'nde kalır.${card.locked ? " Asıl işlem kilitli dönemde; ters kaydı bugün tarihli yazılır." : ""}` : mode === "plan" ? "Kira, kredi taksiti, kart borcu ya da masraf talimatı gibi tekrar eden işlemleri planlayın. Planlı işlem bakiyeyi değiştirmez; bankada gerçekleşince “Gerçekleştir” ile kaydedilir." : "",
      size: "wide",
      fields,
      extraHtml,
      submitLabel: mode === "correct" ? "Düzelt ve Kaydet" : mode === "plan" ? "Planla" : "Kaydet",
      onOpen: dialog => {
        formNode = dialog.querySelector("form");
        formNode.classList.add("hof-bank-form", "hof-bank-voucher");
        const field = name => formNode.querySelector(`[name="${name}"]`);
        if (mode === "correct") field("type")?.setAttribute("disabled", "");
        // Faturayı kesen cari (KDV'li masraf): Cari seçicisi (Fatura formundaki gibi "+ Yeni Cari" ile).
        const invoiceField = field("invoiceNo")?.closest(".hof-field");
        if (invoiceField) {
          picker = HOF.can("accounts.view") && HOF.accounts?.picker ? HOF.accounts.picker({ name: "partyId", label: "Faturayı Kesen (Cari)", required: true, prefer: "supplier", allowNew: { type: "supplier" }, value: form0.partyId ? { id: form0.partyId, name: card?.party?.name || "" } : {}, help: "Masraf faturasını kesen banka ya da ödeme kuruluşu." }) : null;
          if (picker) invoiceField.before(picker);
          else invoiceField.insertAdjacentHTML("beforebegin", '<p class="hof-rep-note" data-party-note>Faturalı masrafta cari seçmek için Carileri Görme yetkisi gerekir.</p>');
        }
        wireVoucher(formNode, { meta, accounts, initialType, accountId: accountId || form0.accountId || "", defaultTax, rateTouched, glLabel, picker, mode });
      },
      onSubmit: async data => {
        const kind = data.type || initialType;
        const body = { type: kind, accountId: data.accountId, amount: data.amount, description: data.description, reference: data.reference };
        if (mode === "plan") Object.assign(body, { kind, plannedDate: data.plannedDate, repeat: data.repeat });
        else body.date = data.date;
        if (kind === "fee") {
          Object.assign(body, { feeType: data.feeType, tax: data.tax });
          if (data.tax !== "none" && String(data.taxRate || "").trim()) body.taxRate = data.taxRate;
          if (isVat(data.tax)) Object.assign(body, { partyId: data.partyId || "", invoiceNo: data.invoiceNo });
        }
        if (kind === "interest_in" && String(data.stoppageRate || "").trim()) body.stoppageRate = data.stoppageRate;
        if (kind === "interest_out") body.taxAmount = String(data.taxAmount || "").trim() || "0";
        if (kind === "loan_repay") body.interestAmount = String(data.interestAmount || "").trim() || "0";
        if (kind === "other_in" || kind === "other_out") body.gl = data.gl;
        if (kind === "card_payment") body.cardAccountId = data.cardAccountId;
        if (TRANSFER_KINDS.has(kind)) body.loanAccountId = data.loanAccountId;
        try {
          if (kind === "fee" && isVat(data.tax) && !body.partyId) throw new HOF.ApiError("Faturalı masrafta faturayı kesen cariyi seçin.", 400, { code: "bank-fee-party", field: "partyId" });
          const send = flags => {
            const payload = { ...body, ...flags };
            if (mode === "plan") return api("/plans", { method: "POST", body: payload });
            if (mode === "correct") return api(`/events/${encodeURIComponent(card.id)}/correct`, { method: "POST", body: payload, requestId });
            return api("/vouchers", { method: "POST", body: payload, requestId });
          };
          const result = await withConfirms(send);
          afterWrite();
          if (mode === "plan") {
            HOF.toast("Planlı işlem eklendi. Bakiye değişmedi; bankada gerçekleşince “Gerçekleştir” ile kaydedin.", { type: "success" });
            openMovements({ account: moves.filter.account, planned: true });
          } else if (mode === "correct") {
            HOF.toast(result.replayed ? "Bu düzeltme zaten kaydedildi; ikinci kez yazılmadı." : `Düzeltildi: ${card.no} ters kaydedildi, yeni işlem ${result.next?.no || ""}.`, { type: "success" });
            if (result.next?.id) openEvent(result.next.id);
          } else {
            HOF.toast(result.replayed ? `Bu işlem zaten kaydedildi (${result.no}); ikinci kez yazılmadı.` : `Kaydedildi: ${result.no} · ${result.typeLabel} ${fmt(eventAmount(result))}`, { type: "success" });
            await reload();
          }
        } catch (error) {
          markVoucherField(formNode, error, mode);
          throw error;
        }
      },
    });
  }
  /** Benzer İşlem (409 bank-similar): önceki işlemin İşlem No'su ve gireniyle sorar; "Yine de Kaydet" aynı istek kimliğiyle similarOk. */
  /**
   * Benzer İşlem (409 bank-similar) ve eksi bakiye uyarısı (409 bank-negative, K7; GG2) aynı kalıpla sorulur: "Yine de Kaydet" aynı istek
   * kimliğiyle similarOk / negativeOk gönderir. Engelle (409 bank-blocked) sorulmaz, nedeni formda görünür. send(flags) gövdeye flags'i ekler.
   */
  // Yargıç (2.1.0): soru ve "Vazgeç" bildirimi işlemin adıyla (İptal Et / Sil / Geri Yükle); Vazgeç kırmızı hata değil, bilgi (2.0.26 İ6 kalıbı).
  const CONFIRM_VERBS = {
    save: { yes: "Yine de Kaydet", no: "Kaydedilmedi", ask: "Yine de kaydedilsin mi?" },
    cancel: { yes: "Yine de İptal Et", no: "İptal edilmedi", ask: "Yine de iptal edilsin mi?" },
    delete: { yes: "Yine de Sil", no: "Silinmedi", ask: "Yine de silinsin mi?" },
    restore: { yes: "Yine de Geri Yükle", no: "Geri yüklenmedi", ask: "Yine de geri yüklensin mi?" },
  };
  async function withConfirms(send, { verb = "save" } = {}) {
    const words = CONFIRM_VERBS[verb] || CONFIRM_VERBS.save;
    const flags = {};
    for (let round = 0; round < 3; round += 1) {
      try {
        return await send({ ...flags });
      } catch (error) {
        const code = error?.data?.code;
        if (code === "bank-similar" && !flags.similarOk) {
          const go = await HOF.confirm({ title: "Benzer İşlem", message: error.message, confirmLabel: "Yine de Kaydet", cancelLabel: "Vazgeç" });
          if (!go) throw new HOF.ApiError("Kaydedilmedi: aynı gün aynı tutarda benzer işlem kayıtlı. Gerçekten ikinci bir işlemse yeniden kaydedip “Yine de Kaydet”i seçin.", 409, { code: "bank-similar-cancelled" });
          flags.similarOk = true;
          continue;
        }
        if (code === "bank-negative" && !flags.negativeOk) {
          const go = await HOF.confirm({ title: "Eksi Bakiye", message: String(error.message || "").replace(/Yine de kaydedilsin mi\?\s*$/, words.ask), confirmLabel: words.yes, cancelLabel: "Vazgeç" });
          if (!go) throw new HOF.ApiError(`${words.no}: işlem hesabın bakiyesini eksiye düşürüyor.`, 409, { code: "bank-negative-cancelled", field: "amount" });
          flags.negativeOk = true;
          continue;
        }
        throw error;
      }
    }
    throw new HOF.ApiError("Kaydedilemedi; yeniden deneyin.", 409, {});
  }
  function markVoucherField(form, error, mode) {
    if (!form) return;
    form.querySelectorAll(".is-invalid").forEach(node => {
      node.classList.remove("is-invalid");
      node.removeAttribute("aria-invalid");
    });
    let name = VOUCHER_FIELD[error?.data?.field] || VOUCHER_CODE[error?.data?.code] || "";
    if (name === "date" && mode === "plan") name = "plannedDate";
    const node = name === "partyId" ? form.querySelector("[data-acc-query]") : name ? form.querySelector(`[name="${name}"]`) : null;
    if (!node) return;
    node.classList.add("is-invalid");
    node.setAttribute("aria-invalid", "true");
    node.closest("details")?.setAttribute("open", "");
    node.closest(".hof-field")?.removeAttribute("hidden");
    node.focus?.();
  }
  /** Türe ve vergiye göre alanları açar/kapatır, hesap listesini kurar, önizlemeyi günceller (yalnız gösterir; kural sunucuda). */
  function wireVoucher(form, { meta, accounts, initialType, accountId, defaultTax, rateTouched, glLabel, picker, mode }) {
    const field = name => form.querySelector(`[name="${name}"]`);
    const show = (name, visible) => {
      const node = name === "partyId" ? picker || form.querySelector("[data-party-note]") : field(name)?.closest(".hof-field");
      if (node) node.hidden = !visible;
    };
    const label = (name, text) => {
      const span = field(name)?.closest(".hof-field")?.querySelector(":scope > span");
      if (span && span.firstChild) span.firstChild.textContent = `${text}${/\s$/.test(span.firstChild.textContent) ? " " : ""}`;
    };
    const typeNow = () => field("type")?.value || initialType;
    let lastType = "";
    const sync = () => {
      const kind = typeNow();
      const select = field("accountId");
      if (select && kind !== lastType) {
        const allowed = accounts.filter(account => mainKinds(kind).includes(account.kind));
        const current = select.value || accountId;
        const pick = allowed.find(account => account.id === current) || allowed.find(account => account.kind === "demand") || allowed[0];
        select.innerHTML = allowed.map(account => `<option value="${esc(account.id)}" ${account.id === pick?.id ? "selected" : ""}>${esc(accountOption(account).label)}</option>`).join("");
        const gl = field("gl");
        const options = kind === "other_in" ? meta.gl?.income || [] : kind === "other_out" ? meta.gl?.expense || [] : [];
        if (gl) {
          const wanted = gl.value || (kind === "other_in" ? meta.defaults.otherIncome : meta.defaults.otherExpense);
          gl.innerHTML = options.map(code => `<option value="${esc(code)}" ${code === wanted ? "selected" : ""}>${esc(glLabel(code))}</option>`).join("");
          if (!options.includes(gl.value)) gl.value = kind === "other_in" ? meta.defaults.otherIncome : meta.defaults.otherExpense;
        }
        lastType = kind;
      }
      show("cardAccountId", kind === "card_payment");
      show("loanAccountId", TRANSFER_KINDS.has(kind));
      const fee = kind === "fee";
      show("feeType", fee);
      show("tax", fee);
      const tax = field("tax")?.value || defaultTax;
      const vat = fee && isVat(tax);
      show("taxRate", fee && tax !== "none");
      label("taxRate", vat ? "KDV Oranı (%)" : "BSMV Oranı (%)");
      if (!rateTouched.value && field("taxRate")) field("taxRate").value = vat ? meta.defaults.vatRate || "20" : meta.defaults.bsmvRate || "5";
      show("partyId", vat);
      show("invoiceNo", vat);
      show("stoppageRate", kind === "interest_in");
      show("taxAmount", kind === "interest_out");
      show("interestAmount", kind === "loan_repay");
      label("amount", fee ? (tax === "none" ? "Tutar" : tax.endsWith("_excl") ? "Tutar (Vergi Hariç)" : "Tutar (Vergi Dahil)") : kind === "interest_in" ? "Brüt Faiz" : kind === "interest_out" ? "Faiz Tutarı" : kind === "loan_repay" ? "Anapara" : "Tutar");
      const glNode = field("gl")?.closest(".hof-field");
      if (glNode) glNode.hidden = !(kind === "other_in" || kind === "other_out");
      label("gl", kind === "other_in" ? "Gelir Hesabı" : "Gider Hesabı");
      const note = form.querySelector("[data-gl-note]");
      if (note) {
        const feeType = (meta.feeTypes || []).find(item => item.key === field("feeType")?.value);
        const code = fee ? (feeType?.gl === "653" ? meta.defaults.commission : meta.defaults.fee) : kind === "interest_in" ? meta.defaults.interestIncome : kind === "interest_out" || kind === "loan_repay" ? meta.defaults.interestExpense : "";
        note.textContent = code ? `Hesap: ${glLabel(code)} (Banka Ayarları → Hesap Eşlemeleri).${kind === "interest_in" ? " Stopaj 193 Peşin Ödenen Vergiler ve Fonlar." : ""}` : kind === "card_payment" || TRANSFER_KINDS.has(kind) ? "Şirketin kendi hesapları arasında: gelir ya da gider hesabı yoktur." : "Gelir ve gider hesabı yalnız Banka Ayarları'ndaki izinli hesaplardan seçilir.";
      }
      preview();
    };
    const preview = () => {
      const node = form.querySelector("[data-voucher-preview]");
      if (!node) return;
      const kind = typeNow();
      const amount = previewMinor(field("amount")?.value);
      if (amount === null) return (node.textContent = "");
      const tax = field("tax")?.value || defaultTax;
      const parts = [];
      if (kind === "fee") {
        const feeType = (meta.feeTypes || []).find(item => item.key === field("feeType")?.value);
        const gl = feeType?.gl === "653" ? meta.defaults.commission : meta.defaults.fee;
        const ppm = previewPpm(field("taxRate")?.value) ?? previewPpm(isVat(tax) ? meta.defaults.vatRate : meta.defaults.bsmvRate) ?? 0;
        let base = amount;
        let taxMinor = 0;
        if (tax.endsWith("_incl")) {
          base = mulDiv(amount, 1_000_000, 1_000_000 + ppm);
          taxMinor = amount - base;
        } else if (tax.endsWith("_excl")) taxMinor = mulDiv(amount, ppm, 1_000_000);
        if (isVat(tax)) parts.push(`Matrah ${fmt(base)}`, `KDV ${fmt(taxMinor)}`, `Bankadan Çıkan ${fmt(base + taxMinor)}`, "Hizmet ve Gider Alışı faturası kaydedilir");
        else parts.push(`Gider ${fmt(base)}`, ...(taxMinor ? [`BSMV ${fmt(taxMinor)}`] : []), `Bankadan Çıkan ${fmt(base + taxMinor)}`, `Hesap ${glLabel(gl)}`);
      } else if (kind === "interest_in") {
        const ppm = previewPpm(field("stoppageRate")?.value) ?? 0;
        const stoppage = mulDiv(amount, ppm, 1_000_000);
        parts.push(`Bankaya Giren (Net) ${fmt(amount - stoppage)}`, `Stopaj ${fmt(stoppage)} (193)`, `Faiz Geliri ${fmt(amount)}`);
      } else if (kind === "interest_out") {
        const extra = previewMinor(field("taxAmount")?.value) || 0;
        parts.push(`Bankadan Çıkan ${fmt(amount + extra)}`, `Faiz ${fmt(amount)}`, ...(extra ? [`BSMV / KKDF ${fmt(extra)}`] : []));
      } else if (kind === "loan_repay") {
        const interest = previewMinor(field("interestAmount")?.value) || 0;
        parts.push(`Bankadan Çıkan ${fmt(amount + interest)}`, `Anapara ${fmt(amount)}`, ...(interest ? [`Faiz ${fmt(interest)}`] : []));
      } else if (kind === "card_payment") parts.push(`Bankadan Çıkan ${fmt(amount)}`, "Kart borcu azalır");
      else if (kind === "loan_draw") parts.push(`Bankaya Giren ${fmt(amount)}`, "Kredi borcu artar");
      else parts.push(`${kind === "other_in" ? "Bankaya Giren" : "Bankadan Çıkan"} ${fmt(amount)}`, `Hesap ${glLabel(field("gl")?.value || "")}`);
      node.textContent = parts.join(" · ");
    };
    // Vergi kipi BSMV ↔ KDV değişince oran o kipin varsayılanına döner (Düzelt'te BSMV %5'in KDV'ye taşınmaması için).
    let lastVat = isVat(field("tax")?.value || defaultTax);
    form.addEventListener("change", event => {
      if (event.target.matches?.('[name="taxRate"]')) rateTouched.value = true;
      if (event.target.matches?.('[name="tax"]')) {
        const vatNow = isVat(event.target.value);
        if (vatNow !== lastVat) rateTouched.value = false;
        lastVat = vatNow;
      }
      sync();
    });
    form.addEventListener("input", event => {
      if (event.target.matches?.('[name="taxRate"]')) rateTouched.value = true;
      preview();
    });
    // Salt okunur açılır liste (Düzelt'te işlem türü): değer değişmesin.
    for (const select of form.querySelectorAll("select[readonly]")) {
      const value = select.value;
      select.addEventListener("change", () => (select.value = value));
    }
    void mode;
    sync();
  }
  /** Yerel yazımdan sonra: form seçenekleri (son stopaj oranı) ve menü rozeti yenilenir. */
  function afterWrite() {
    metaCache = null;
    HOF.emit("bank-changed");
  }
  function reverseForm(c) {
    const feeHeader = c.fee?.taxKind === "vat" && !c.source;
    const requestId = HOF.requestId();
    // GG2: kullanıcı verisi (Fatura No, hesap adı) kaçışlı; intro HTML olarak basılır.
    const parts = [`${esc(c.no)} (${esc(c.typeLabel)}, ${esc(fmt(eventAmount(c)))}) ters kaydedilir: aynı tutarda ters fiş yazılır, hesabın bakiyesi işlemden önceki hâline döner. İşlem silinmez; asıl işlem ve ters kaydı hareketlerde ve İşlem Geçmişi'nde kalır.`];
    if (feeHeader && c.locked) parts.push(`Masrafın faturası (${esc(c.invoice?.number || "")}) kilitli dönemde (${esc(dateText(c.lockedUntil))} ve öncesi) olduğu için iptal edilmez: bugün (${esc(dateText(HOF.localToday()))}) tarihli Alıştan İade faturası kesilir ve tutar bu hesaba iade girişi olarak yazılır; kilitli dönem değişmez.`);
    else if (feeHeader) parts.push(`Masrafın faturası (${esc(c.invoice?.number || "")}) iptal edilir; KDV ve cari etkisi de geri alınır.`);
    else if (c.locked) parts.push(`İşlem kilitli dönemde (${esc(dateText(c.lockedUntil))} ve öncesi); ters fiş bugün (${esc(dateText(HOF.localToday()))}) tarihli yazılır, kilitli dönem değişmez.`);
    HOF.formModal({
      title: "Ters Kaydet",
      eyebrow: c.no,
      intro: parts.join(" "),
      fields: [{ name: "reason", label: "Neden", maxlength: 300, placeholder: "İsteğe bağlı; İşlem Geçmişi'ne yazılır" }],
      submitLabel: "Ters Kaydet",
      onSubmit: async data => {
        const result = await withConfirms(flags => api(`/events/${encodeURIComponent(c.id)}/reverse`, { method: "POST", body: { reason: data.reason, ...flags }, requestId }));
        afterWrite();
        HOF.toast(result.replayed ? "Bu işlem zaten ters kaydedilmişti; ikinci kez yazılmadı." : result.reversal?.invoice?.kind === "purchase_return" ? `Ters kaydedildi: ${result.reversal.no} · İade Faturası ${result.reversal.invoice.number}` : result.reversal ? `Ters kaydedildi: ${result.reversal.no}` : `Masraf ve faturası iptal edildi (${c.no}).`, { type: "success" });
        await reload();
      },
    });
  }
  function infoForm(c) {
    HOF.formModal({
      title: "Açıklamayı Düzelt",
      eyebrow: c.no,
      intro: "Açıklama ve referans tutarı değiştirmez; kilitli dönemdeki işlemde de düzeltilir ve İşlem Geçmişi'ne yazılır.",
      fields: [
        { name: "description", label: "Açıklama", type: "textarea", rows: 3, value: c.description || "", maxlength: 500 },
        { name: "reference", label: "Referans", value: c.reference || "", maxlength: 100 },
      ],
      submitLabel: "Kaydet",
      onSubmit: async data => {
        await api(`/events/${encodeURIComponent(c.id)}/info`, { method: "PUT", body: { description: data.description, reference: data.reference } });
        HOF.toast("Açıklama kaydedildi.", { type: "success" });
        await reload();
      },
    });
  }

  // ---------- Planlı İşlemler (K3; §3.7 #23) ----------
  const planOf = id => moves.plans.find(plan => plan.id === id) || null;
  function planRunForm(plan) {
    const today = HOF.localToday();
    const requestId = HOF.requestId();
    HOF.formModal({
      title: "Planlı İşlemi Gerçekleştir",
      eyebrow: plan.typeLabel.toLocaleUpperCase("tr-TR"),
      intro: `${esc(plan.accountLabel)} · ${esc(fmt(plan.amountMinor))} · planlı tarih ${esc(dateText(plan.plannedDate))}. Bankada gerçekleşen tarih ve tutarla kaydedin.${plan.repeat !== "none" ? " Plan bir sonraki döneme geçer." : ""}`,
      fields: [
        { name: "date", label: "İşlem Tarihi", type: "date", required: true, max: "today", value: plan.plannedDate <= today ? plan.plannedDate : today },
        { name: "amount", label: "Tutar", required: true, value: amountInput(plan.amountMinor), inputmode: "decimal" },
        { name: "description", label: "Açıklama", value: plan.description || "", maxlength: 500 },
      ],
      submitLabel: "Gerçekleştir",
      onSubmit: async data => {
        // expectedDate (GG2): ekrandaki planlı tarih; plan bu arada ilerlediyse sunucu 409 bank-plan-moved verir (ikinci kez işlenmez).
        const result = await withConfirms(flags => api(`/plans/${encodeURIComponent(plan.id)}/execute`, { method: "POST", body: { date: data.date, amount: data.amount, description: data.description, expectedDate: plan.plannedDate, ...flags }, requestId }));
        afterWrite();
        HOF.toast(result.replayed ? "Bu planlı işlem zaten gerçekleştirildi; ikinci kez yazılmadı." : `Gerçekleştirildi: ${result.event?.no || ""}${result.plan?.status === "planned" ? ` · sonraki ${dateText(result.plan.plannedDate)}` : ""}`, { type: "success" });
        await reload();
      },
    });
  }
  /**
   * Atla (GG2): satırın düğmeleri istek bitene kadar pasif (çift tık ikinci isteği göndermez); ekranda görülen planlı tarih (expectedDate)
   * gönderilir — plan bu arada ilerlediyse (başka pencere) sunucu 409 bank-plan-moved verir, liste yenilenir.
   */
  async function planSkip(plan, button = null) {
    const row = button?.closest("tr") || null;
    const buttons = row ? [...row.querySelectorAll("button[data-act]")] : button ? [button] : [];
    if (buttons.some(node => node.disabled)) return;
    buttons.forEach(node => {
      node.disabled = true;
      node.setAttribute("aria-busy", "true");
    });
    try {
      const next = await api(`/plans/${encodeURIComponent(plan.id)}/skip`, { method: "POST", body: { expectedDate: plan.plannedDate } });
      afterWrite();
      HOF.toast(`Bu dönem atlandı; sonraki tarih ${dateText(next.plannedDate)}.`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    } finally {
      buttons.forEach(node => {
        node.disabled = false;
        node.removeAttribute("aria-busy");
      });
    }
    await reload();
  }
  async function planCancel(plan) {
    const go = await HOF.confirm({ title: "Planlı İşlemi Sil", message: `${plan.typeLabel} · ${fmt(plan.amountMinor)} (${dateText(plan.plannedDate)}) planı silinsin mi? Bu plandan daha önce gerçekleşmiş işlemler değişmez.`, confirmLabel: "Sil", danger: true });
    if (!go) return;
    try {
      await api(`/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      afterWrite();
      HOF.toast("Planlı işlem silindi.", { type: "success" });
      await reload();
    } catch (error) {
      HOF.toastError(error);
    }
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
        // ----- Aşama 4: Hareketler, İşlem Kartı, fiş formları, Planlı İşlemler -----
        case "mv-more":
          return loadMoves(act.dataset.movesKey === "account" ? accountMoves : moves, { more: true });
        case "mv-planned":
          moves.planned = !moves.planned;
          moves.loaded = false;
          render();
          return loadMoves(moves);
        case "mv-clear":
          moves.filter = { ...newMoves("main").filter, account: moves.filter.account };
          moves.loaded = false;
          render();
          return loadMoves(moves);
        case "mv-open":
          return openMovements({ account: "" });
        case "mv-account":
          return openMovements({ account: view.accountId });
        case "plans-due":
          return openMovements({ account: "", planned: true });
        case "v-fee":
          return voucherForm({ group: "fee", accountId: contextAccount() });
        case "v-interest":
          return voucherForm({ group: "interest", accountId: contextAccount() });
        case "v-other":
          return voucherForm({ group: "other", accountId: contextAccount() });
        case "v-card":
          return voucherForm({ group: "other", type: "card_payment", counterId: view.accountId });
        case "v-loan":
          return voucherForm({ group: "other", type: "loan_draw", counterId: view.accountId });
        case "plan-new":
          return voucherForm({ mode: "plan", accountId: contextAccount() });
        case "ev-back":
          return goBack();
        case "ev-reverse":
          return view.event && reverseForm(view.event);
        case "ev-correct":
          return view.event && voucherForm({ mode: "correct", card: view.event });
        case "ev-info":
          return view.event && infoForm(view.event);
        case "plan-run":
        case "plan-skip":
        case "plan-cancel": {
          const plan = planOf(act.dataset.plan);
          if (!plan) return;
          return act.dataset.act === "plan-run" ? planRunForm(plan) : act.dataset.act === "plan-skip" ? planSkip(plan, act) : planCancel(plan);
        }
        default:
          return;
      }
    }
    const link = event.target.closest("[data-event-link]");
    if (link) return openEvent(link.dataset.eventLink);
    const party = event.target.closest("[data-open-party]");
    if (party) return HOF.accounts?.open?.(party.dataset.openParty);
    const moveRow = event.target.closest("tr[data-event]");
    if (moveRow) return openEvent(moveRow.dataset.event);
    const row = event.target.closest("tr[data-account]");
    if (row) openAccount(row.dataset.account);
  }
  /** Formun hesabı: Hesap Detayı'ndan açılırsa o hesap; Hareketler'den açılırsa süzgeçteki hesap (yoksa varsayılan). */
  const contextAccount = () => (view.mode === "account" ? view.accountId : moves.filter.account);
  function onKey(event) {
    if (event.key !== "Enter") return;
    const input = event.target.closest?.("input[data-mv]");
    if (input) {
      event.preventDefault();
      return applyFilters();
    }
    const moveRow = event.target.closest?.("tr[data-event]");
    if (moveRow && event.target === moveRow) return openEvent(moveRow.dataset.event);
    const row = event.target.closest?.("tr[data-account]");
    if (row) openAccount(row.dataset.account);
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches("[data-mv]")) return applyFilters();
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
    // Arama yazdıkça (300 ms bekleyerek) süzülür; tutar ve tarih alanları Enter'da ya da alandan çıkınca.
    if (event.target.matches?.('input[data-mv="q"]')) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 300);
      return;
    }
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
  // keepLabel (Aşama 5–6, düzeltme formları): hesabı atanmamış eski hareketin düzeltmesinde ilk seçenek "değiştirme" (boş değer); sunucu yalnız
  // açıklama değişiyorsa satırı bağsız bırakır, tutar/tarih/yol değişiyorsa hesap ister (plan §3.5 kural 4). value: satırın mevcut hesabı.
  function pickerHtml(data, { form = "bank", value = "", name = "bankAccountId", label = "Banka Hesabı", keepLabel = "" } = {}) {
    const meta = data?.forms?.[form];
    const accounts = (meta?.ids || []).map(id => data.accounts.find(account => account.id === id)).filter(Boolean);
    const current = value ? data?.accounts?.find(account => account.id === value) : null;
    if (!accounts.length) return { mode: "none", accountId: "", html: "" };
    if (accounts.length === 1 && !keepLabel && (!value || value === accounts[0].id)) return { mode: "single", accountId: accounts[0].id, html: `<input type="hidden" name="${esc(name)}" value="${esc(accounts[0].id)}" data-bank-single><p class="hof-bank-pick-note">${esc(accounts[0].label)} hesabına yazılır.</p>` };
    // Satırın hesabı artık seçilemiyorsa (pasif) seçenek olarak kalır: değiştirilmeden kaydedilebilsin.
    const list = current && !accounts.some(account => account.id === current.id) ? [current, ...accounts] : accounts;
    const selected = value && list.some(account => account.id === value) ? value : keepLabel ? "" : meta.defaultId || "";
    const first = keepLabel ? { value: "", label: keepLabel } : { value: "", label: "Hesap Seçin" };
    return { mode: "many", accountId: selected, html: HOF.fieldHtml({ name, label, type: "select", required: !keepLabel, value: selected, options: [first, ...list.map(account => ({ value: account.id, label: `${account.label} (${account.code})` }))] }) };
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

  /**
   * Modül formuna hesap seçici (Aşama 5–6; §8.9): yol alanı (methodName) "Havale / EFT" olduğunda görünür, başka yolda gizli ve gönderilmez
   * (zorunlu işareti kalkar). methodName verilmezse (Kasa ↔ Banka transferi) hep görünür. Hiç hesap yoksa hiçbir şey eklenmez (bugünkü görünüm).
   */
  async function attachPicker(form, { methodName = "", anchor = null, ...options } = {}) {
    if (!form) return "none";
    const methodNode = methodName ? form.querySelector(`[name="${methodName}"]`) : null;
    const place = anchor || methodNode?.closest(".hof-field") || form.querySelector(".hof-field:last-of-type");
    const mode = await mountPicker(place, options);
    const box = form.querySelector("[data-bank-pick]");
    if (!box || !methodNode) return mode;
    const select = box.querySelector("select");
    const required = select?.required;
    const sync = () => {
      const on = methodNode.value === "bank";
      box.hidden = !on;
      box.querySelectorAll("[name]").forEach(node => {
        node.disabled = !on;
      });
      if (select) select.required = on && required;
    };
    methodNode.addEventListener("change", sync);
    sync();
    return mode;
  }

  HOF.bank = { open, openWizard, openEvent: ref => (modal ? openEvent(ref) : open().then(() => openEvent(ref))), choices, pickerHtml, mountPicker, attachPicker, withConfirms };
  HOF.whenReady(() => {
    // Canlı yenileme (v2.0.22 kuralı): başka bilgisayardaki banka değişikliği ve para gösteren modüllerin değişikliği açık pencereyi tek
    // yenileme kapısından yeniler; bu penceredeki banka yazımı zaten kendini yeniler.
    const refreshOpen = HOF.refresher(() => (modal ? reload({ quiet: true }) : null));
    HOF.on("live:workspace.changed", change => {
      if (change?.kind !== "bank") return;
      choicesCache = null;
      metaCache = null;
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
