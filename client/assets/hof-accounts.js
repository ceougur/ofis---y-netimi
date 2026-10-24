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
  // Bakiye süzgeci (v2.0.10): muhasebe programlarındaki gibi Tümü · Borçlular · Alacaklılar · Sadece bakiyesi olanlar.
  // Kutunun görünür etiketi olmadığından ilk seçenek neyi süzdüğünü söyler.
  const BALANCES = [
    ["all", "Tüm Bakiyeler"],
    ["debtor", "Borçlular"],
    ["creditor", "Alacaklılar"],
    ["nonzero", "Sadece Bakiyesi Olanlar"],
    ["zero", "Bakiyesi Sıfır (kapalı)"],
    ["overdue", "Taksidi Gecikenler"],
  ];
  const SORTS = [
    ["no", "Sırala: Cari No"],
    ["name", "Sırala: Ada Göre"],
    ["balance", "Sırala: Bakiye (çoktan aza)"],
    ["overdue", "Sırala: Geciken Taksit"],
    ["registered", "Sırala: Kayıt Tarihi (yeni önce)"],
  ];
  const ENTRY_LABEL = { debt: "Borç Yaz", credit: "Alacak Yaz", in: "Tahsilat", out: "Ödeme" };
  const ENTRY_HELP = {
    debt: "Cari size borçlanır (ör. verilen hizmet, satış, aidat). Kasa'ya yazılmaz.",
    credit: "Siz cariye borçlanırsınız (ör. alınan mal, hizmet faturası). Kasa'ya yazılmaz.",
    in: "Cariden para alındı: bakiyeden düşer, Kasa'ya tahsilat olarak girer, makbuzu alınır.",
    out: "Cariye para verildi (ör. tedarikçiye ödeme, iade): Kasa'dan çıkar.",
  };
  // 2.1.0 temel sürüm (ek iş B, 10.10.2026): tahsilat/ödeme açıklaması seçilen YOLA göre (önceden yol ne olursa olsun "Kasa'dan çıkar" /
  // "Kasa'ya girer" yazıyordu; kılavuz ekranı k39: Kredi Kartı seçiliyken "Kasa'dan çıkar"). picked: formda o yolun hesap/kart seçicisi var mı
  // (yoksa hesap tanımlanmamıştır; satır Hesabı Atanmamış Eski Hareketler'e yazılır — plan K10).
  // none (11.10.2026): seçicide "Hesapsız (Açılıştan Önce)" seçili — hareket banka hesabının açılışından önce; hiçbir hesaba yazılmaz, Hesabı Atanmamış
  // Eski Hareketler'de kalır (önceden açıklama yine "seçilen banka hesabına girer" diyordu).
  const ENTRY_HELP_BY_METHOD = {
    in: {
      cash: () => ENTRY_HELP.in,
      bank: (picked, none) => (none ? "Cariden para alındı: bakiyeden düşer; banka hesabının açılışından önceki hareket olduğu için hiçbir hesaba girmez, Hesabı Atanmamış Eski Hareketler'de (Havale / EFT) kalır, makbuzu alınır." : picked ? "Cariden para alındı: bakiyeden düşer, seçilen banka hesabına girer, makbuzu alınır." : "Cariden para alındı: bakiyeden düşer; banka hesabı tanımlanmadığı için Hesabı Atanmamış Eski Hareketler'e (Havale / EFT) yazılır, makbuzu alınır."),
      // 2.3.0 (İz 3.2; plan §4.6 "ödeme iadesi (giriş) → Kredi Kartı"): "Kredi Kartına İade" işaretliyse tedarikçi parayı firmanın kredi kartına iade etti.
      // 2.4.3 (keşif C2): tanımlı POS seçiliyken (pos: "single" | "many") metin seçilen POS'u ve valörü anlatır; "Hesabı Atanmamış Eski Hareketler"
      // yalnız hiç POS tanımlı değilken (formun kendi önizlemesiyle çelişmesin).
      card: (picked, none, refund, pos) => (refund ? (none ? "Tedarikçi parayı kredi kartımıza iade etti: bakiyeden düşer; kartın açılışından önceki hareket olduğu için hiçbir kartın borcuna yazılmaz, Hesabı Atanmamış Eski Hareketler'de (POS / Kart) kalır." : picked ? "Tedarikçi parayı kredi kartımıza iade etti: bakiyeden düşer, seçilen kredi kartının borcu azalır; POS satışı oluşmaz, Kasa değişmez." : "Tedarikçi parayı kredi kartımıza iade etti: kredi kartı tanımlanmadığı için Hesabı Atanmamış Eski Hareketler'e (POS / Kart) yazılır.") : pos === "single" || pos === "many" ? "Cariden POS ile tahsil edildi: bakiyeden düşer; seçilen POS'a yazılır, valör gününde komisyonu düşülerek POS'un bağlı olduğu banka hesabına geçer (aşağıdaki önizleme); Kasa'ya girmez, makbuzu alınır." : "Cariden POS ile tahsil edildi: bakiyeden düşer; POS tanımlı olmadığı için Kasa'ya girmez, Banka → Hesabı Atanmamış Eski Hareketler'de POS / Kart olarak görünür; makbuzu alınır."),
      cheque: () => "Cariden çek / senet alındı: evrak formu açılır; evrak portföye girer, carinin bakiyesinden düşer, Kasa değişmez.",
    },
    out: {
      cash: () => ENTRY_HELP.out,
      bank: (picked, none) => (none ? "Cariye para verildi (ör. tedarikçiye ödeme, iade): banka hesabının açılışından önceki hareket olduğu için hiçbir hesaptan çıkmaz, Hesabı Atanmamış Eski Hareketler'de (Havale / EFT) kalır." : picked ? "Cariye para verildi (ör. tedarikçiye ödeme, iade): seçilen banka hesabından çıkar." : "Cariye para verildi (ör. tedarikçiye ödeme, iade): banka hesabı tanımlanmadığı için Hesabı Atanmamış Eski Hareketler'e (Havale / EFT) yazılır."),
      card: (picked, none) => (none ? "Cariye kredi kartıyla ödendi: kredi kartının açılışından önceki hareket olduğu için hiçbir kartın borcuna yazılmaz, Hesabı Atanmamış Eski Hareketler'de (POS / Kart) kalır." : picked ? "Cariye kredi kartıyla ödendi: seçilen kredi kartının borcuna yazılır; bankadan, kart ekstresi ödenince çıkar." : "Cariye kredi kartıyla ödendi: kredi kartı tanımlanmadığı için Hesabı Atanmamış Eski Hareketler'e (POS / Kart) yazılır."),
      cheque: () => "Cariye çek / senet verildi: evrak formu açılır; carinin bakiyesi evrakla düşer, Kasa değişmez.",
    },
  };
  /**
   * Formun açıklamasını seçili yola göre yazar (yol değişince ve hesap seçici yerleşince). m4 (10.10.2026): fatura Tahsilat Ekle / Ödeme Yap formu da
   * aynı metni kullanır (HOF.accounts.syncEntryHelp; önceden yol ne olursa olsun "Kayıt cariye ve Kasa'ya yazılır" diyordu). wrap: metnin önüne/ardına
   * eklenecek (faturanın açık tutarı ve kapama kuralı).
   */
  function syncEntryHelp(dialog, type, wrap = text => text) {
    const form = dialog?.querySelector("form");
    const intro = dialog?.querySelector(".hof-modal-text");
    const method = form?.querySelector('[name="method"]')?.value || "cash";
    // 2.3.0 (İz 3.2): tahsilatta kart yolu POS'tur; "Kredi Kartına İade" işaretliyse kart seçicisi (kart borcu azalır).
    const refund = method === "card" && Boolean(form?.querySelector('input[name="cardRefund"]')?.checked);
    const pick = method === "bank" ? form?.querySelector('[data-bank-pick]:not([data-bank-pick="card"])') : method === "card" && (type === "out" || refund) ? form?.querySelector('[data-bank-pick="card"]') : null;
    const pos = method === "card" && !refund ? form?.querySelector('[data-pos-pick="sale"]')?.dataset.posMode || "" : "";
    const text = ENTRY_HELP_BY_METHOD[type]?.[method]?.(Boolean(pick), pick?.querySelector("select")?.value === "none", refund, pos);
    if (intro && text) intro.textContent = wrap(text);
  }
  const LEDGER_FILTERS = [
    ["all", "Tümü", () => true],
    ["debit", "Borç", line => line.debit > 0],
    ["credit", "Alacak", line => line.credit > 0],
    // 2.4.3 (uzman UX19): süzgeç "Kasa" adını taşıyıp havale / POS tahsilatlarını da sayıyordu (Kasa = yalnız nakit kararıyla çelişen ad). Süzgeç
    // carinin tahsilat ve ödemelerini (her yol; taksit tahsilatı ve iadesi dahil, açılış devri hariç) gösterir, adı da bunu söyler.
    ["cash", "Tahsilat / Ödeme", line => line.kind === "in" || line.kind === "out" || ((line.kind === "plan-in" || line.kind === "plan-out") && !line.opening)],
    ["plan", "Taksit", line => line.origin === "plan"],
  ];
  const canManage = () => HOF.can("accounts.manage");
  const canCollect = () => HOF.can("accounts.collect");
  const canPlan = () => HOF.can("plans.manage");
  const moduleName = () => HOF.uiLabel?.("side.accounts", "Cari") || "Cari";
  const sideWord = balance => (balance > 0.005 ? "Borçlu" : balance < -0.005 ? "Alacaklı" : "");
  // Renk kuralı (v2.0.10, muhasebe programlarındaki gibi): Borçlu (cari bize borçlu = alacağımız) yeşil, Alacaklı (bizim
  // borcumuz) kırmızı, kapalı gri. Borç/Alacak hareket sütunları renksizdir; renk yalnız bakiye ve durumda.
  const sideTone = balance => (balance > 0.005 ? "debtor" : balance < -0.005 ? "creditor" : "zero");
  const balanceHtml = balance => `<span class="hof-acc-balance is-${sideTone(balance)}">${esc(money(Math.abs(balance)))}${sideWord(balance) ? `<small>${sideWord(balance)}</small>` : ""}</span>`;
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
  const view = { mode: "list", id: "", q: "", type: "", group: "", subgroup: "", status: "active", balance: "all", sort: stored(SORT_KEY, "no"), ledgerFilter: "all", list: null, account: null, selected: new Set(), selectAll: false, excluded: new Set(), limit: 300 };
  // Binlerce caride ekran hızlı kalsın: sunucu 300'er satır gönderir ("Daha fazla göster" sonrakini ekler); arama, süzgeç
  // ve toplamlar sunucuda tümü üzerinde çalışır. "Hepsini seç" süzgeçteki bütün carileri (yüklenmemişler dahil) seçer.
  const PAGE = 300;
  const lists = HOF.listGate();
  const body = () => modal?.dialog.querySelector("[data-accounts]");
  const query = () => new URLSearchParams({ q: view.q, type: view.type, group: view.group, subgroup: view.subgroup, status: view.status, balance: view.balance, sort: view.sort });
  const filterBody = () => ({ q: view.q, type: view.type, group: view.group, subgroup: view.subgroup, status: view.status, balance: view.balance });
  const listPdfUrl = () => `/api/workspace/accounts/liste.pdf?${query()}&title=${encodeURIComponent(moduleName())}`;
  const listXlsxUrl = () => `/api/workspace/accounts/export.xlsx?${query()}&title=${encodeURIComponent(moduleName())}`;
  const cardPdfUrl = account => `/api/workspace/accounts/${encodeURIComponent(account.id)}/ekstre.pdf`;

  // ---------- Veri ----------
  // keep (v2.0.22): başka bilgisayardaki değişiklikten sonra arka plan yenilemesi — "Daha Fazla" ile açılmış satırlar ve
  // "Tümünü Seç" korunur (önceden ilk sayfaya dönüyor, seçim sıfırlanıyordu); yalnız silinen cari seçimden düşer.
  // Arka plan yenilemesi kullanıcının araması/süzgeci/sayfası sürerken onu geçersiz saymaz (sıra numarası artmaz): yazarken
  // gelen yenileme aramanın yanıtını bekletmesin. Yanıt listede görüneni değiştirmiyorsa liste yeniden çizilmez.
  // 2.1.0 (bağımsız inceleme H4): Daha Fazla sürerken arka plan yenilemesi listeyi değiştirdiyse Daha Fazla'nın yanıtı eklenmez, yeni listenin
  // sonundan yeniden istenir; Daha Fazla'dan sonra yazılacak arka plan yenilemesi yeni uzunlukla yinelenir (HOF.listGate retry).
  function loadList(options = {}) {
    return HOF.listRetry(() => loadListOnce(options));
  }
  async function loadListOnce({ more = false, keep = false } = {}) {
    const load = lists.start({ quiet: keep, more });
    if (!load) return false;
    if (!keep && !more && view.listError) {
      view.listError = "";
      if (!view.list && view.mode === "list") renderList();
    }
    const offset = more && view.list ? view.list.accounts.length : 0;
    const limit = keep && view.list ? Math.min(5000, Math.max(PAGE, view.list.accounts.length)) : PAGE;
    try {
      const data = await HOF.api(`/api/workspace/accounts?${query()}&limit=${limit}&offset=${offset}`, keep ? { background: true } : {});
      if (!load.current()) return load.retry();
      load.applied();
      view.listError = "";
      const sign = more ? "" : JSON.stringify(data);
      if (keep && sign === view.listSign && view.mode === "list") return;
      view.listSign = sign;
      view.list = more && view.list ? { ...data, accounts: [...view.list.accounts, ...data.accounts] } : data;
      // Süzgeç değişince seçim sıfırlanır (görünmeyen cari seçili kalmasın; yanlış kişiye plan açılmasın).
      if (!more) {
        const visible = new Set(view.list.accounts.map(item => item.id));
        for (const id of [...view.selected]) if (!visible.has(id)) view.selected.delete(id);
        if (!keep) {
          view.selectAll = false;
          view.excluded.clear();
        }
      }
      if (view.mode === "list") renderList();
    } catch (error) {
      if (keep) throw error;
      if (!load.current()) return;
      if (more && view.list) return HOF.toastError(error);
      // Yeni arama/süzgeç yüklenemedi: eski satırlar yeni süzgecin altında kalmaz (Tümünü Seç görünmeyen carilere uygulanmasın).
      view.list = null;
      view.listSign = "";
      view.selectAll = false;
      view.excluded.clear();
      view.selected.clear();
      view.listError = error.message;
      if (view.mode === "list") renderList();
    } finally {
      load.done();
    }
  }
  let cardRequest = 0;
  async function loadAccount(id, { quiet = false } = {}) {
    // Arka plan yenilemesi sıra numarasını artırmaz: kullanıcının o sırada açtığı cari geçersiz sayılmaz.
    const ticket = quiet ? cardRequest : ++cardRequest;
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
      // Arka plan yenilemesinin geçici hatası kartı kapatmaz (kullanıcı formda olabilir); silinmiş cari listeye döner.
      if (quiet && !HOF.lostRecord(error)) throw error;
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
    // v2.0.14: pencere DOM'dan kaldırıldıysa (kapanışı haber vermeden) referans bayattır; yeniden açılır.
    if (modal && !document.body.contains(modal.node)) modal = null;
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
    return `<select data-filter="group" aria-label="Grup"><option value="">Tüm Gruplar</option>${groups.map(item => `<option value="${esc(item.id)}" ${item.id === view.group ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>
      <select data-filter="subgroup" aria-label="Alt grup" ${subs.length ? "" : "disabled"}><option value="">${subs.length ? "Tüm Alt Gruplar" : "Alt Grup"}</option>${subs.map(item => `<option value="${esc(item.id)}" ${item.id === view.subgroup ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>`;
  };
  // Seçim: tek tek işaretlenenler (selected) ya da "süzgeçteki hepsi" (selectAll) eksi işareti kaldırılanlar (excluded).
  const selectedCount = () => (view.selectAll ? Math.max(0, (view.list?.total || 0) - view.excluded.size) : view.selected.size);
  const isSelected = id => (view.selectAll ? !view.excluded.has(id) : view.selected.has(id));
  const allSelection = () => ({ all: true, ...filterBody(), ...(view.excluded.size ? { except: [...view.excluded] } : {}) });
  const clearSelection = () => {
    view.selected.clear();
    view.excluded.clear();
    view.selectAll = false;
  };
  const selectBar = () => {
    const count = selectedCount();
    const total = view.list?.total ?? view.list?.accounts?.length ?? 0;
    const wa = HOF.whatsapp
      ? count
        ? '<button type="button" class="hof-button hof-button-small hof-whatsapp" data-act="waStatement" title="Seçilen carilere kişiye özel ekstreyi WhatsApp ile gönder">WhatsApp Ekstre</button><button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="waMessage" title="Seçilen carilere toplu WhatsApp mesajı yaz">WhatsApp Mesaj</button>'
        : total
          ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="waStatement" title="Süzgeçteki ${total} cariye ekstre">Tümüne WhatsApp Ekstre</button><button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="waMessage" title="Süzgeçteki ${total} cariye mesaj">Tümüne WhatsApp Mesaj</button>`
          : ""
      : "";
    const hint = canPlan() ? "Toplu taksit ya da WhatsApp için soldaki kutulardan carileri seçin; başlıktaki kutu süzgeçteki carilerin hepsini seçer (ör. önce grup ya da okul seçin)." : "WhatsApp ile toplu gönderim için soldaki kutulardan carileri seçin ya da süzgeçteki hepsine gönderin.";
    return `<div class="hof-acc-selbar${count ? " is-active" : ""}" data-selbar><span>${count ? `<b>${count.toLocaleString("tr-TR")}</b> cari seçildi${view.selectAll ? (view.excluded.size ? ` (süzgeçteki hepsi, ${view.excluded.size.toLocaleString("tr-TR")} hariç)` : " (süzgeçteki hepsi)") : ""}` : hint}</span>${count && canPlan() ? '<button type="button" class="hof-button hof-button-small" data-act="bulkPlan">Seçilenlere Taksit Planı</button>' : ""}${wa}${count ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="clearSel">Seçimi Temizle</button>' : ""}</div>`;
  };
  // WhatsApp toplu gönderim: seçim varsa seçilenler, yoksa süzgeçteki carilerin hepsi.
  function bulkWhatsapp(kind) {
    const count = selectedCount();
    const selection = count && !view.selectAll ? { ids: [...view.selected] } : view.selectAll ? allSelection() : { all: true, ...filterBody() };
    const total = count || view.list?.total || 0;
    HOF.whatsapp?.open({
      kind,
      selection,
      title: `${total.toLocaleString("tr-TR")} Cari`,
      // Gönderim bitince seçim temizlenir (toplu taksitteki gibi); pencere yeniden açıldığında eski seçim kalmaz.
      onDone: () => {
        clearSelection();
        if (view.mode === "list") renderList();
      },
    });
  }
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const manage = canManage();
    const planning = true; // seçim kutuları: toplu taksit (yetkiyle) ve WhatsApp gönderimi
    const filtered = Boolean(view.q || view.type || view.group || view.subgroup || view.balance !== "all");
    const row = item => {
      const next = item.next ? `<small class="${item.next.days < 0 ? "is-warn" : ""}">${esc(HOF.formatDate(item.next.dueDate))} · ${item.next.days < 0 ? `${Math.abs(item.next.days)} gün gecikti` : "sıradaki taksit"}</small>` : "";
      const plansCell = item.activePlans ? `<b>${esc(money(item.planRemaining))}</b><small>${item.activePlans} kart${item.overdueCount ? ` · <span class="is-warn">${item.overdueCount} geciken</span>` : ""}</small>${next}` : '<small class="hof-muted">—</small>';
      const extra = item.extra?.length ? `<small class="hof-acc-extra">${item.extra.map(field => `${esc(field.label)}: ${esc(field.value)}`).join(" · ")}</small>` : "";
      return `<tr data-account="${esc(item.id)}" class="${item.status === "passive" ? "is-passive" : ""}" tabindex="0">${planning ? `<td class="hof-acc-check"><input type="checkbox" data-select="${esc(item.id)}" aria-label="${esc(item.name)} seç" ${isSelected(item.id) ? "checked" : ""}></td>` : ""}<td class="hof-plan-no">${esc(item.refNo)}</td><td><b>${esc(item.name)}</b> ${item.type !== "customer" ? typeBadge(item.type) : ""}${item.status === "passive" ? badgeMuted("Pasif") : ""}${item.doubtfulOpen > 0.005 ? ` <span class="hof-plan-badge is-late" data-doubtful-badge title="Şüpheli alacakta: ${esc(money(item.doubtfulOpen))}">Şüpheli</span>` : ""}<small>${esc(whereText(item) || "Grupsuz")}${item.phone ? ` · ${esc(item.phone)}` : ""}${item.caseKey ? " · tabloda kayıtlı" : ""}</small>${extra}</td><td class="num">${amountCell(item.debit)}</td><td class="num">${amountCell(item.credit, "hof-cash-in")}</td><td class="num">${balanceHtml(item.balance)}</td><td>${plansCell}</td></tr>`;
    };
    const allChecked = (view.selectAll && !view.excluded.size) || (!view.selectAll && data && data.accounts.length && data.accounts.every(item => view.selected.has(item.id)));
    const total = data?.total ?? data?.accounts.length ?? 0;
    HOF.swap(root, `<div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Durum">${STATUS_TABS.map(item => `<button type="button" data-status="${item.id}" aria-pressed="${String(item.id === view.status)}">${item.label}</button>`).join("")}</div>
      <div class="hof-cash-add">${manage ? `<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Cari</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import" title="Excel dosyasından ya da Google Sheets’ten carileri tek seferde aç (taksit sorulmaz)">Excel / Sheets’ten Yükle</button>` : ""}</div></div>
      <div class="hof-plans-filters hof-acc-filters"><input type="search" data-filter="q" value="${esc(view.q)}" placeholder="Ad, telefon, cari no, adres, ek alan ara…" aria-label="Ara"><select data-filter="type" aria-label="Tür"><option value="">Tüm Türler</option>${Object.entries(TYPES).map(([id, label]) => `<option value="${id}" ${id === view.type ? "selected" : ""}>${label}</option>`).join("")}</select>${groupOptions()}<select data-filter="balance" aria-label="Bakiye">${BALANCES.map(([id, label]) => `<option value="${id}" ${id === view.balance ? "selected" : ""}>${label}</option>`).join("")}</select><select data-filter="sort" aria-label="Sıralama">${SORTS.map(([id, label]) => `<option value="${id}" ${id === view.sort ? "selected" : ""}>${label}</option>`).join("")}</select>${outputs(listPdfUrl(), HOF.outputButton({ kind: "xlsx", href: listXlsxUrl(), what: "Cari Listesi", tip: "Ekrandaki listeyi (ek alanlarıyla) Excel olarak indir", attrs: "data-xlsx" }))}</div>
      <div class="hof-kpis hof-plans-kpis">${data ? `<div class="hof-cash-balance"><strong>${esc(money(data.totals.debtor))}</strong><span>Borçlular · ${(data.totals.debtorCount ?? 0).toLocaleString("tr-TR")} cari</span></div><div><strong>${esc(money(data.totals.creditor))}</strong><span>Alacaklılar · ${(data.totals.creditorCount ?? 0).toLocaleString("tr-TR")} cari</span></div><div title="Taksit kartlarının kalanı carilerin bakiyesinin içindedir; Borçlular'a ayrıca eklenmez."><strong>${esc(money(data.totals.planRemaining))}</strong><span>Taksitlerden Kalan (bakiyeye dahil)</span></div><div class="${data.totals.overdueCount ? "is-late" : ""}"><strong>${esc(money(data.totals.overdue))}</strong><span>Geciken · ${data.totals.overdueCount} taksit</span></div>` : ""}</div>
      ${selectBar()}
      <div class="hof-cash-list hof-plans-list">${
        !data
          ? HOF.listPending(view.listError)
          : data.accounts.length
            ? `<table class="hof-table hof-cash-table hof-plans-table hof-acc-table"><thead><tr>${planning ? `<th class="hof-acc-check"><input type="checkbox" data-select-all aria-label="Süzgeçteki ${total} carinin hepsini seç" title="Süzgeçteki ${total} carinin hepsini seç" ${allChecked ? "checked" : ""}></th>` : ""}<th class="hof-plan-no">No</th><th>Cari</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th>Taksit</th></tr></thead><tbody>${data.accounts.map(row).join("")}</tbody></table>${data.hasMore ? `<div class="hof-more"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="more">Daha Fazla Göster · ${total - data.accounts.length} cari daha</button></div>` : ""}`
            : `<p class="hof-empty">${filtered || view.status !== "all" ? "Bu süzgeçte cari yok." : "Henüz cari yok."}${manage && !filtered ? " <b>+ Yeni Cari</b> ile tek kart açın ya da <b>Excel / Sheets’ten Yükle</b> ile listenizi bir kerede aktarın." : ""}</p>`
      }</div>
      <p class="hof-edit-meta">Bakiye = borç − alacak. <b class="hof-acc-balance is-debtor">Borçlu</b> (yeşil): bakiye borç tarafında; <b class="hof-acc-balance is-creditor">Alacaklı</b> (kırmızı): bakiye alacak tarafında. Taksit planları carinin borcuna, taksit tahsilatları alacağına yazılır. Tahsilat ve ödemeler Kasa’ya düşer.</p>
      <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`);
  }
  // PDF · Yazdır · Excel tek düğme grubunda.
  const outputs = (pdfUrl, extra = "") => (office().outputButtons ? office().outputButtons(pdfUrl, "list", "", "Cari Listesi").replace(/<\/span>$/, `${extra}</span>`) : extra);
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
      if (entry.source === "invoice") return HOF.can("invoices.view") ? `<button type="button" class="hof-mini hof-mini-text" data-open-invoice="${esc(entry.sourceId)}" title="Faturadan gelir; Fatura ekranından iptal edilir ya da iade kesilir">Fatura</button>` : '<small class="hof-muted" title="Faturadan gelir">faturadan</small>';
      const stock = entry.source === "stock" ? '<small class="hof-muted" title="Stok hareketinden gelir; Stok’tan düzeltilir">stoktan</small>' : entry.source === "doubtful" ? '<small class="hof-muted" title="Değersiz alacak yazımından gelir; Şüpheli Alacak bölümündeki satırdan silinir">şüpheli alacaktan</small>' : entry.source === "cheque" ? (HOF.can("cheques.view") ? `<button type="button" class="hof-mini" data-open-cheque="${esc(entry.sourceId)}" title="Çek / senetten gelir; evrak kartından geri alınır" aria-label="Çek / senet kartını aç">↗</button>` : '<small class="hof-muted" title="Çek / senetten gelir; evrak kartından geri alınır">çek / senet</small>') : "";
      return `${receipt}${stock}${entry.editable ? `<button type="button" class="hof-mini" data-edit-entry="${esc(entry.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-entry="${esc(entry.id)}" title="Sil" aria-label="Sil">×</button>` : ""}`;
    };
    const ledgerRow = line => `<tr class="is-${esc(line.kind)}"><td>${esc(HOF.formatDate(line.date))}</td><td><b>${esc(line.label)}${line.method ? ` <span class="hof-method-tag is-${esc(line.method)}">${esc(HOF.methodLabel(line.method, line.kind === "in" || line.kind === "out" ? line.kind : ""))}</span>` : ""}${line.receiptNo ? ` <span class="hof-plan-receipt">Makbuz ${esc(line.receiptNo)}</span>` : ""}${line.invoiceId && line.origin === "account" ? ` <a href="#" class="hof-plan-receipt" data-open-invoice="${esc(line.invoiceId)}" title="Bu kayıt seçilen faturayı kapatır">Faturaya Bağlı</a>` : ""}${line.doubtfulNormal ? ` <span class="hof-plan-receipt" data-doubtful-normal title="Şüpheli alacaktan düşmedi; normal cari hesaba (120) işlendi">Normal Cariye İşlendi</span>` : ""}</b>${line.note ? `<small>${esc(line.note)}</small>` : ""}</td><td class="num">${line.debit ? esc(money(line.debit)) : ""}</td><td class="num">${line.credit ? esc(money(line.credit)) : ""}</td><td class="num">${balanceHtml(line.balance)}</td><td class="hof-cash-actions">${lineActions(line)}</td></tr>`;
    const planRow = plan => `<tr data-open-plan="${esc(plan.id)}" tabindex="0" class="is-${esc(plan.state)}"><td class="hof-plan-no">${esc(plan.refNo || "")}</td><td><b>${esc(plan.name)}</b><small>${plan.itemCount ? `${plan.itemCount} taksit` : "Taksit kurulmadı"}${plan.next ? ` · sıradaki ${esc(HOF.formatDate(plan.next.dueDate))}` : ""}</small></td><td class="num">${esc(money(plan.totals.total))}</td><td class="num hof-cash-in">${esc(money(plan.totals.paid))}</td><td class="num${plan.totals.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(plan.totals.remaining))}</td><td>${plan.status === "closed" ? '<span class="hof-plan-badge is-muted">Kapalı</span>' : plan.state === "overdue" ? `<span class="hof-plan-badge is-late">${plan.totals.overdueCount} taksit gecikti</span>` : plan.state === "done" ? '<span class="hof-plan-badge is-done">Tamamlandı</span>' : '<span class="hof-plan-badge is-info">Devam Ediyor</span>'}</td></tr>`;
    const caseCell = account.caseKey
      ? account.caseSource && HOF.datasetKey && account.caseSource !== HOF.datasetKey
        ? `${esc(account.caseTitle || account.caseKey)} <small class="hof-muted">· başka sayfada</small>`
        : `<a href="#" data-act="reveal" title="Kaydı tabloda aç">${esc(account.caseTitle || account.caseKey)}</a> <small>· Kayda git</small>`
      : `<span class="hof-muted">Bağlı değil${manage ? " · Düzenle ile bağlayın" : ""}</span>`;
    const sums = lines.reduce((acc, line) => ({ debit: acc.debit + line.debit, credit: acc.credit + line.credit }), { debit: 0, credit: 0 });
    const active = account.status === "active";
    HOF.swap(root, `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${account.refNo ? `<span class="hof-plan-refno" title="Cari No">No ${esc(account.refNo)}</span>` : ""}${esc(account.name)} ${typeBadge(account.type)}${active ? "" : badgeMuted("Pasif")}${doubtfulBadge(account.doubtful)}</h3><small>${esc(whereText(account) || "Grupsuz")}${account.phone ? ` · ${esc(account.phone)}` : ""}</small></div></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Cari işlemleri">
          <span class="hof-plan-toolgroup">${collect ? '<button type="button" class="hof-button hof-button-small" data-entry="in">+ Tahsilat</button>' : ""}${manage ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="debt" title="Cari size borçlanır">Borç Yaz</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="credit" title="Siz cariye borçlanırsınız">Alacak Yaz</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-entry="out" title="Cariye para verildi (Kasa, banka hesabı ya da kredi kartı)">− Ödeme</button>' : ""}${canPlan() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="newPlan" title="Bu cariye taksit kartı aç">+ Taksit Planı</button>' : ""}</span>
          <span class="hof-plan-toolgroup">${office().outputButtons ? office().outputButtons(cardPdfUrl(account), "card", "Cari Ekstre - PDF") : ""}${phone ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}</span>
          ${manage ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="${active ? "passive" : "activate"}" title="${active ? "Pasif cari listede Pasif altında durur; hareketleri korunur" : ""}">${active ? "Pasife Al" : "Aktif Yap"}</button><button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-act="delete"${account.deleteBlock ? ` disabled aria-describedby="hof-acc-delete-why" title="${esc(account.deleteBlock)}"` : ""}>Sil</button></span>` : ""}
        </div></div>
      ${manage && account.deleteBlock ? `<ul class="hof-inv-blocks hof-acc-blocks" id="hof-acc-delete-why" data-delete-block><li><b>Silinemez:</b> ${esc(account.deleteBlock)}</li></ul>` : ""}
      ${HOF.can("invoices.manage") && HOF.invoices ? `<div class="hof-inv-pills hof-acc-inv-pills" role="group" aria-label="Fatura"><button type="button" class="hof-inv-big-pill" data-act="saleInvoice"><b>Satış Faturası</b><small>Bu cariye satış, hizmet ya da makbuz</small></button><button type="button" class="hof-inv-big-pill" data-act="purchaseInvoice"><b>Alış Faturası</b><small>Bu cariden mal, hizmet ya da gider alışı</small></button></div>` : ""}
      <section class="hof-plan-profile" aria-label="Cari bilgileri">
        <dl class="hof-plan-facts">
          <div><dt>Cari No</dt><dd>${esc(account.refNo || "—")}</dd></div>
          <div><dt>Tür</dt><dd>${esc(TYPES[account.type] || "—")}</dd></div>
          <div><dt>Grup</dt><dd>${esc(whereText(account) || "—")}</dd></div>
          <div><dt>Telefon</dt><dd>${account.phone ? (phone ? `<a href="tel:+${esc(phone)}">${esc(account.phone)}</a>` : esc(account.phone)) : "—"}</dd></div>
          <div><dt>E-Posta</dt><dd>${account.email ? `<a href="mailto:${esc(account.email)}">${esc(account.email)}</a>` : "—"}</dd></div>
          <div><dt>Kayıt Tarihi</dt><dd>${esc(account.registeredOn ? HOF.formatDate(account.registeredOn) : "—")}</dd></div>
          <div class="is-wide"><dt>Adres</dt><dd>${esc([account.address, account.district, account.city, account.postalCode].filter(Boolean).join(", ") || "—")}</dd></div>
          ${account.taxNo ? `<div><dt>${String(account.taxNo).length === 11 ? "TC Kimlik No" : "Vergi No"}</dt><dd>${esc(account.taxNo)}</dd></div>` : ""}
          ${account.taxOffice ? `<div><dt>Vergi Dairesi</dt><dd>${esc(account.taxOffice)}</dd></div>` : ""}
          ${account.iban ? `<div><dt>IBAN</dt><dd>${esc(String(account.iban).replace(/(.{4})/g, "$1 ").trim())}</dd></div>` : ""}
          ${Number(account.dueDays) ? `<div><dt>Vade Günü</dt><dd>${esc(String(account.dueDays))} gün</dd></div>` : ""}
          ${HOF.invoices?.edocEnabled?.() && account.taxNo ? `<div><dt>e-Fatura</dt><dd>${Number(account.eInvoice) === 1 ? `Mükellef${account.eAlias ? `<small class="hof-fact-sub">${esc(account.eAlias)}</small>` : ""}` : "Mükellef değil (e-Arşiv)"}</dd></div>` : ""}
          <div><dt>Tablodaki Kayıt</dt><dd>${caseCell}</dd></div>
          <div><dt>Kartı Açan</dt><dd>${esc(account.actorName || "—")} · ${esc(HOF.formatDate(account.createdAt))}</dd></div>
          ${account.fields.map(field => `<div><dt title="Excel’den gelen alan">${esc(field.label)}</dt><dd>${esc(field.value || "—")}</dd></div>`).join("")}
        </dl>
        <div class="hof-plan-note"><h4>Bilgi Notu</h4>${account.note ? `<p>${esc(account.note)}</p>` : `<p class="hof-empty">Not yok.${manage ? " <b>Düzenle</b> ile ekleyin." : ""}</p>`}</div>
      </section>
      <div class="hof-kpis hof-plans-kpis"><div><strong>${esc(money(t.debit))}</strong><span>Borç Toplamı</span></div><div><strong>${esc(money(t.credit))}</strong><span>Alacak Toplamı · Tahsil ${esc(money(t.collected))}</span></div><div class="hof-cash-balance"><strong class="hof-acc-balance is-${sideTone(t.balance)}">${esc(money(Math.abs(t.balance)))}</strong><span>Bakiye${sideWord(t.balance) ? ` · ${sideWord(t.balance)}` : ""}</span></div><div class="${t.overdueCount ? "is-late" : ""}" title="Taksit kartlarının kalanı Bakiye'nin içindedir; Bakiye'ye ayrıca eklenmez."><strong>${esc(money(t.planRemaining))}</strong><span>Taksitten Kalan (bakiyeye dahil)${t.overdueCount ? ` · ${t.overdueCount} geciken` : ""}</span></div></div>
      ${HOF.can("invoices.view") && HOF.invoices ? '<div class="hof-plan-section"><h4>Faturalar <span data-acc-inv-count></span></h4><button type="button" class="hof-link-button" data-act="allInvoices">Tümünü Gör</button></div><div class="hof-cash-list" data-acc-invoices><p class="hof-empty">Yükleniyor…</p></div>' : ""}
      <div class="hof-plan-section"><h4>Taksit Kartları <span>${account.plans.length}</span></h4></div>
      <div class="hof-cash-list hof-plans-items">${account.plans.length ? `<table class="hof-table hof-cash-table hof-plans-table"><thead><tr><th class="hof-plan-no">No</th><th>Kart</th><th class="num">Toplam</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Durum</th></tr></thead><tbody>${account.plans.map(planRow).join("")}</tbody></table>` : `<p class="hof-empty">Bu carinin taksit kartı yok.${canPlan() ? " <b>+ Taksit Planı</b> ile açın; tahsilatlar taksitten düşer ve burada görünür." : ""}</p>`}</div>
      ${doubtfulSectionHtml(account)}
      <div class="hof-plan-section"><h4>Hareketler <span>${account.ledger.length}</span></h4>${account.ledger.length ? `<span class="hof-plan-chips" role="group">${LEDGER_FILTERS.map(([id, label, check]) => `<button type="button" data-ledger-filter="${id}" aria-pressed="${String(id === view.ledgerFilter)}">${label} <b>${account.ledger.filter(check).length}</b></button>`).join("")}</span>` : ""}</div>
      <div class="hof-cash-list hof-plans-entries">${lines.length ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th></th></tr></thead><tbody>${lines.map(ledgerRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num hof-cash-out">${esc(money(sums.debit))}</td><td class="num hof-cash-in">${esc(money(sums.credit))}</td><td></td><td></td></tr></tfoot></table>` : account.ledger.length ? '<p class="hof-empty">Bu süzgeçte hareket yok.</p>' : '<p class="hof-empty">Henüz hareket yok. Tahsilat, borç, alacak ve ödeme burada, yürüyen bakiyeyle görünür.</p>'}</div>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Listeye Dön</button><button type="button" class="hof-button" data-close>Kapat</button></div>`);
    loadAccountInvoices(account);
    loadDoubtful(account);
  }
  // Cari kartında son faturalar (v2.0.15): kesilen, alınan, iade, taslak ve iptal; satırdan fatura açılır.
  let invoiceTicket = 0;
  async function loadAccountInvoices(account) {
    const slot = body()?.querySelector("[data-acc-invoices]");
    if (!slot) return;
    const ticket = ++invoiceTicket;
    try {
      const data = await HOF.api(`/api/workspace/invoices?tab=all&account=${encodeURIComponent(account.id)}&limit=8`);
      if (ticket !== invoiceTicket || !slot.isConnected) return;
      const count = body()?.querySelector("[data-acc-inv-count]");
      if (count) count.textContent = String(data.total);
      slot.innerHTML = data.invoices.length
        ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>No</th><th>Tür</th><th>Durum</th><th class="num">Tutar</th><th class="num">Açık</th></tr></thead><tbody>${data.invoices
            .map(doc => `<tr data-open-invoice="${esc(doc.id)}" tabindex="0" class="${doc.status === "cancelled" ? "is-muted" : ""}"><td>${esc(HOF.formatDate(doc.issueDate))}</td><td><b>${esc(doc.displayNo || "Taslak")}</b></td><td>${esc(doc.kindLabel)}</td><td>${esc(doc.status === "issued" ? doc.payStateLabel : doc.statusLabel)}</td><td class="num">${esc(money(doc.tryPayable))}</td><td class="num">${doc.status === "issued" && doc.open > 0.004 ? esc(money(doc.open)) : "—"}</td></tr>`)
            .join("")}</tbody></table>`
        : `<p class="hof-empty">Bu carinin faturası yok.${HOF.can("invoices.manage") ? " Üstteki <b>Satış Faturası</b> ya da <b>Alış Faturası</b> ile kesin." : ""}</p>`;
    } catch (error) {
      if (slot.isConnected) slot.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }

  // ---------- Cari seçici (taksit kartı formu, stok hareketi) ----------
  // Yazdıkça sunucudan en çok 20 cari; seçilen carinin kimliği gizli alanda. "×" seçimi kaldırır.
  // v2.0.17: prefer = o türdeki cariler listede üstte (tür kısıtı değil); allowNew = "+ Yeni Cari" (seçiciden ayrılmadan
  // kart açılır, kaydedilince seçili gelir; boş sonuçta "Bu adla cari yok — + Yeni Cari").
  function picker({ value = {}, label = "Cari", help = "", required = false, type = "", prefer = "", allowNew = null, onPick = null, name = "accountId" } = {}) {
    if (!HOF.can("accounts.view")) return null;
    const canNew = allowNew && canManage();
    const field = HOF.el(
      "div",
      { class: "hof-field hof-case-picker hof-acc-picker" },
      `<span>${esc(label)}${required ? ' <i aria-hidden="true">*</i>' : ""}${canNew ? ' <button type="button" class="hof-link-button hof-acc-picker-new" data-acc-new>+ Yeni Cari</button>' : ""}</span>
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
          hits = await HOF.api(`/api/workspace/accounts/search?q=${encodeURIComponent(input.value.trim())}${type ? `&type=${type}` : ""}${prefer ? `&prefer=${prefer}` : ""}`);
        } catch {
          hits = [];
        }
        if (own !== ticket) return;
        // 2.4.3: yanıt geldiğinde kutudan çıkılmışsa liste açılmaz (açık kalan eski liste Esc'i yutardı).
        if (document.activeElement !== input) return;
        list.innerHTML = hits.length
          ? hits.map(item => `<li role="option" data-id="${esc(item.id)}"><b>${esc(item.name)}${item.refNo ? ` · No ${esc(item.refNo)}` : ""}${prefer ? ` <span class="hof-plan-badge is-${item.type === "supplier" ? "soon" : item.type === "other" ? "muted" : "info"}">${esc(TYPES[item.type] || "")}</span>` : ""}</b><small>${esc([TYPES[item.type], item.groupName, item.phone].filter(Boolean).join(" · "))} · bakiye ${esc(money(item.balance))}</small></li>`).join("")
          : `<li class="is-empty">${input.value.trim() ? "Bu adla cari yok" : "Henüz cari yok"}${canNew ? ' — <button type="button" class="hof-link-button" data-acc-new>+ Yeni Cari</button>' : ""}</li>`;
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
    // 2.4.4 (uzman UX10): program odağı verirken (form açılışı, doğrulama hatası) öneri listesi açılmaz — liste kalem alanlarını örtmesin;
    // kullanıcı yazınca ya da kutuya kendisi geçince açılır.
    let quiet = false;
    input.addEventListener("focus", () => (quiet ? null : search()));
    field.focusQuiet = () => {
      quiet = true;
      try {
        input.focus({ preventScroll: true });
      } finally {
        quiet = false;
      }
      return document.activeElement === input;
    };
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
    // Dışarıdan seçim (ad eşleşmesi önerisi, v2.0.7): { id, name } ya da null.
    field.setAccount = account => {
      hidden.value = account?.id || "";
      input.value = account?.name || "";
      state();
      hide();
      onPick?.(account || null);
    };
    clear.addEventListener("click", () => {
      hidden.value = "";
      input.value = "";
      state();
      onPick?.(null);
      input.focus();
    });
    if (canNew)
      field.addEventListener("mousedown", event => {
        const button = event.target.closest("[data-acc-new]");
        if (!button) return;
        event.preventDefault();
        hide();
        const preset = { ...(typeof allowNew === "object" ? allowNew : {}), name: input.value.trim() || undefined };
        HOF.accounts.newFor(preset, { onSaved: account => field.setAccount({ id: account.id, name: account.name }) });
      });
    state();
    return field;
  }

  // ---------- Formlar ----------
  function fieldsEditor(fields = []) {
    const box = HOF.el("div", { class: "hof-field hof-acc-fields" }, `<span>Ek Alanlar <small>(Excel’den gelen ya da sizin eklediğiniz: Veli, Okul, Plaka, T.C. No…)</small></span><div data-fields></div><button type="button" class="hof-button hof-button-small hof-button-ghost" data-add-field>+ Alan Ekle</button>`);
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
  // Açılış bakiyesinin yönü (v2.0.13): tedarikçi listelerinde bakiye bizim borcumuzdur; türe göre ya da elle seçilir.
  const OPENING_SIDES = [
    { value: "auto", label: "Türe Göre (müşteride Borçlu, tedarikçide Alacaklı)" },
    { value: "debt", label: "Borçlu (cari bize borçlu)" },
    { value: "credit", label: "Alacaklı (biz cariye borçluyuz)" },
  ];
  // Aynı kişi uyarısı (v2.0.13): yeni caride aynı ad (ve telefon) varsa yazarken gösterilir, kaydederken sorulur.
  const sameDigits = (a, b) => String(a || "").replace(/\D/g, "").slice(-10) === String(b || "").replace(/\D/g, "").slice(-10);
  async function samePeople(name) {
    const wanted = HOF.normalize(name);
    if (!wanted) return [];
    try {
      return (await HOF.api(`/api/workspace/accounts/search?q=${encodeURIComponent(name.trim())}`)).filter(item => HOF.normalize(item.name) === wanted);
    } catch {
      return [];
    }
  }
  // Fatura bilgileri (v2.0.15): faturada alıcı/satıcı kimliği bu alanlardan gelir (VKN/TCKN, vergi dairesi, adres).
  // e-Belge bağlantısı açıksa e-Fatura mükellefiyeti ve posta kutusu etiketi de (Mükellef Sorgula ile doldurulur).
  const edocOn = () => Boolean(HOF.invoices?.edocEnabled?.());
  function taxFields(account) {
    const a = account || {};
    return [
      { name: "partyKind", label: "Kişi Türü", type: "select", value: a.partyKind || "", options: [{ value: "", label: "Belirtilmedi" }, { value: "company", label: "Tüzel Kişi (Şirket)" }, { value: "person", label: "Gerçek Kişi (Şahıs)" }] },
      { name: "taxNo", label: "VKN / TCKN", maxlength: 11, inputmode: "numeric", value: a.taxNo || "", help: "Şirkette 10 haneli vergi no, şahısta 11 haneli TC kimlik no. 11111111111 yalnız kimliği bilinmeyen nihai tüketici içindir (faturadaki “Nihai Tüketici” seçeneği bu cariyi kendisi açar); adı belli kişide gerçek TC kimlik numarasını yazın." },
      { name: "taxOffice", label: "Vergi Dairesi", maxlength: 120, value: a.taxOffice || "" },
      { name: "firstName", label: "Adı (Gerçek Kişi)", maxlength: 80, value: a.firstName || "" },
      { name: "familyName", label: "Soyadı (Gerçek Kişi)", maxlength: 80, value: a.familyName || "" },
      { name: "district", label: "İlçe", maxlength: 80, value: a.district || "" },
      { name: "city", label: "İl", maxlength: 80, value: a.city || "" },
      { name: "postalCode", label: "Posta Kodu", maxlength: 10, value: a.postalCode || "" },
      { name: "country", label: "Ülke", maxlength: 80, value: a.country || "Türkiye" },
      { name: "mersisNo", label: "MERSİS No", maxlength: 16, inputmode: "numeric", value: a.mersisNo || "" },
      { name: "tradeRegistry", label: "Ticaret Sicil No", maxlength: 40, value: a.tradeRegistry || "" },
      { name: "website", label: "Web Sitesi", maxlength: 200, value: a.website || "" },
      { name: "iban", label: "IBAN", maxlength: 34, value: a.iban || "", placeholder: "TR00 0000 0000 0000 0000 0000 00" },
      { name: "dueDays", label: "Vade Günü", inputmode: "numeric", value: a.dueDays ? String(a.dueDays) : "", help: "Fatura vadesi kesim tarihinden bu kadar gün sonrasına yazılır; boşsa Fatura Ayarları'ndaki." },
      ...(edocOn()
        ? [
            // 2.4.3 (kullanıcı, 17.10.2026: "e-Arşiv değil mi, kafa karıştırıyor"): işareti yalnız Mükellef Sorgula koyar (wireTaxFields; kaldırmak serbest);
            // elle işaretlenen mükellef olmayan kişiye TEF numaralı e-Fatura kesilip gönderilemiyordu (TESTER denemesi).
            { name: "eInvoice", label: "e-Fatura mükellefi (Mükellef Sorgula belirler: işaretliyse e-Fatura, değilse e-Arşiv kesilir)", type: "checkbox", value: Number(a.eInvoice) === 1 },
            { name: "eAlias", label: "e-Fatura Posta Kutusu Etiketi", maxlength: 160, value: a.eAlias || "", placeholder: "urn:mail:defaultpk@…" },
            { name: "eProfile", label: "e-Fatura Senaryosu", type: "select", value: a.eProfile || "", options: [{ value: "", label: "Ayarlardaki Varsayılan" }, { value: "TEMELFATURA", label: "Temel Fatura" }, { value: "TICARIFATURA", label: "Ticari Fatura" }] },
          ]
        : []),
    ];
  }
  const TAX_KEYS = ["partyKind", "taxNo", "taxOffice", "firstName", "familyName", "district", "city", "postalCode", "country", "mersisNo", "tradeRegistry", "website", "iban", "dueDays"];
  // 2.4.4 (31f U1): 11111111111 kimliği bilinmeyen nihai tüketicinin numarasıdır; adı belli bir kişinin carisine yazılınca kaydetmeden önce sorulur
  // (engel değil). Ad kuralı sunucudaki isRetailName ile aynı (server/lib/tax-id.mjs): büyük/küçük harf ve fazla boşluk gözetilmez.
  const ANONYMOUS_TCKN = "11111111111";
  const isRetailName = name => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR") === "nihai tüketici";
  function anonymousOnNamed(data, account) {
    const taxNo = String(data.taxNo ?? "").replace(/\s+/g, "");
    if (taxNo !== ANONYMOUS_TCKN || isRetailName(data.name)) return false;
    // Düzenlemede yalnız kimlik ya da ad değiştiyse sorulur (eski kaydın her kaydedilişinde değil).
    return !account || String(account.taxNo || "").replace(/\s+/g, "") !== taxNo || String(account.name || "").trim() !== String(data.name || "").trim();
  }
  function taxPayload(data) {
    const out = Object.fromEntries(TAX_KEYS.filter(key => key in data).map(key => [key, String(data[key] ?? "").trim()]));
    if (out.taxNo !== undefined) out.taxNo = out.taxNo.replace(/\s+/g, "");
    if (out.iban !== undefined) out.iban = out.iban.replace(/\s+/g, "").toUpperCase();
    if ("eInvoice" in data) Object.assign(out, { eInvoice: data.eInvoice === true, eAlias: String(data.eAlias || "").trim(), eProfile: data.eProfile || "" });
    return out;
  }
  function wireTaxFields(dialog) {
    const kind = dialog.querySelector('select[name="partyKind"]');
    if (!kind) return;
    const head = HOF.el("h4", { class: "hof-acc-form-head" }, "Fatura Bilgileri");
    kind.closest(".hof-field").before(head);
    const personal = ["firstName", "familyName"].map(name => dialog.querySelector(`[name="${name}"]`)?.closest(".hof-field")).filter(Boolean);
    const taxNo = dialog.querySelector('input[name="taxNo"]');
    const sync = () => {
      const digits = taxNo.value.replace(/\D/g, "");
      const person = kind.value === "person" || (!kind.value && digits.length === 11);
      personal.forEach(field => (field.hidden = !person));
    };
    kind.addEventListener("change", sync);
    taxNo.addEventListener("input", sync);
    sync();
    if (!edocOn()) return;
    const button = HOF.el("button", { type: "button", class: "hof-button hof-button-small hof-button-ghost" }, "Mükellef Sorgula");
    taxNo.closest(".hof-field").append(button);
    const flag = dialog.querySelector('input[name="eInvoice"]');
    // Gözden geçirme 2.4.3 (B6): işareti KALDIRMAK serbest (EDM'ye ulaşılamazken yanlış işaret kilitli kalmasın; mükellefse gönderimde sorgu yakalar).
    flag?.addEventListener("click", event => {
      if (!flag.checked) {
        // 2.4.3 (uzman UX5 / KÖ4): işareti elle kaldırmak serbest (B6) ama artık sessiz değil — sonucu ve doğru yolu söyler. Posta kutusu etiketi
        // silinmez (yeniden mükellef çıkarsa aynı etiket kullanılır).
        HOF.toast("e-Fatura mükellefi işareti kaldırıldı: kaydedince bu cariye e-Arşiv kesilir. Cari gerçekten mükellefse gönderimde yakalanır; emin değilseniz Mükellef Sorgula'ya basın.", { type: "info", timeout: 9000 });
        return;
      }
      event.preventDefault();
      HOF.toast("e-Fatura mükellefiyeti elle işaretlenmez: VKN / TCKN alanının altındaki Mükellef Sorgula'ya basın.", { type: "info", timeout: 6000 });
    });
    // Entegratör Ayarları "VKN / TCKN yazılınca mükellefiyet kendiliğinden sorgulansın": alandan çıkınca (10 ya da 11 hane, değiştiyse) bir kez.
    let lastChecked = taxNo.value.replace(/\D/g, "");
    taxNo.addEventListener("change", () => {
      const digits = taxNo.value.replace(/\D/g, "");
      if (!HOF.invoices?.autoCheckUser?.() || ![10, 11].includes(digits.length) || digits === lastChecked || button.disabled) return;
      lastChecked = digits;
      button.click();
    });
    // 2.4.3 (uzman UX13): sorgunun döndüğü GİB unvanı yazılan addan farklıysa sessiz geçilmez; öneri olarak gösterilir, kullanıcı tek tıkla
    // "Unvanı Bununla Değiştir" der ya da yazdığını bırakır (yaygın programlar sorgu unvanını önerir; e-Fatura alıcı unvanıyla gider).
    const nameInput = dialog.querySelector('input[name="name"]');
    const titleOffer = HOF.el("p", { class: "hof-case-suggest", "data-gib-title": "", hidden: "" });
    taxNo.closest(".hof-field").append(titleOffer);
    const offerTitle = title => {
      const gib = String(title || "").trim();
      const differs = Boolean(gib && nameInput && HOF.normalize(gib) !== HOF.normalize(nameInput.value));
      titleOffer.hidden = !differs;
      titleOffer.innerHTML = differs ? `GİB'deki unvan: <b>${esc(gib)}</b> (yazdığınız: “${esc(nameInput.value.trim() || "—")}”). <button type="button" class="hof-link" data-gib-title-use>Unvanı Bununla Değiştir</button>` : "";
      titleOffer.dataset.gibTitle = differs ? gib : "";
    };
    titleOffer.addEventListener("click", event => {
      if (!event.target.closest("[data-gib-title-use]") || !nameInput) return;
      nameInput.value = titleOffer.dataset.gibTitle;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleOffer.hidden = true;
      titleOffer.innerHTML = "";
      nameInput.focus();
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await HOF.api("/api/workspace/invoices/check-user", { method: "POST", body: { taxNo: taxNo.value } });
        dialog.querySelector('input[name="eInvoice"]').checked = result.registered;
        // Birden çok posta kutusu (gerçek EDM: bir firmada 11 PK görüldü, 16.10.2026): ilki sessizce yazılmaz, kullanıcı seçer.
        let alias = result.aliases[0] || "";
        // 2.4.3 (keşif B6): pencere Vazgeç / Esc / × ile kapanırsa posta kutusu YAZILMAZ (önceden önerilen etiket yazılıp "yazıldı" deniyordu —
        // yanlış PK'ye e-Fatura gider); alandaki önceki değer kalır.
        let picked = true;
        const aliasField = dialog.querySelector('input[name="eAlias"]');
        if (result.aliases.length > 1) {
          const preferred = result.aliases.find(item => /defaultpk@/i.test(item)) || result.aliases[0];
          alias = await new Promise(resolve => {
            let chosen = "";
            HOF.formModal({
              title: "Posta Kutusu Seçin",
              eyebrow: "E-FATURA",
              intro: `${result.title || "Bu mükellef"} için ${result.aliases.length} posta kutusu (PK) etiketi var. Faturanın gideceği etiketi seçin; bilmiyorsanız müşterinize sorun.`,
              fields: [{ name: "alias", label: "Posta Kutusu (PK)", type: "select", value: preferred, options: result.aliases.map(item => ({ value: item, label: item })) }],
              submitLabel: "Seç",
              // 2.4.3 (uzman UX21): açılır listede Enter seçer (önceden Tab ile "Seç"e gitmek gerekiyordu; seçim kutusunda Enter formu göndermez).
              onOpen: pickDialog => {
                const select = pickDialog.querySelector('select[name="alias"]');
                select?.addEventListener("keydown", event => {
                  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) return;
                  event.preventDefault();
                  select.closest("form")?.requestSubmit();
                });
              },
              onSubmit: data => {
                chosen = data.alias;
              },
              onClose: () => resolve(chosen),
            });
          });
          picked = Boolean(alias);
        }
        if (picked) aliasField.value = alias;
        offerTitle(result.title);
        // Unvan noktayla bitiyorsa (A.Ş.) ikinci nokta konmaz.
        const who = result.title ? `: ${result.title}${/[.!?]$/.test(result.title.trim()) ? "" : "."}` : ".";
        if (!result.registered) HOF.toast("e-Fatura mükellefi değil; bu cariye e-Arşiv fatura kesilir.", { type: "success", timeout: 7000 });
        else if (picked) HOF.toast(`e-Fatura mükellefi${who} Posta kutusu etiketi yazıldı.`, { type: "success", timeout: 7000 });
        else HOF.toast(`e-Fatura mükellefi${who} Posta kutusu seçilmedi; ${aliasField.value ? "önceki etiket korundu" : "etiket boş kaldı"}. e-Fatura kesmeden önce Mükellef Sorgula ile posta kutusunu seçin.`, { type: "info", timeout: 9000 });
      } catch (error) {
        HOF.toastError(error);
      } finally {
        button.disabled = false;
      }
    });
  }
  // 2.4.3 (uzman UX1): eşzamanlı düzenlemede (409 account-stale) güncel cari forma basılır: kullanıcının DEĞİŞTİRDİĞİ alan (dokunulmuş ve formun
  // açıldığı değerden farklı) korunur, öbürleri güncel değeri alır; "kayıtlı değer" de güncellenir (kapatırken soru doğru kalır).
  function refreshUntouched(dialog, fresh) {
    if (!dialog || !fresh) return;
    for (const node of dialog.querySelectorAll("input[name], textarea[name], select[name]")) {
      if (node.type === "hidden" || !(node.name in fresh)) continue;
      const raw = fresh[node.name];
      if (node.type === "checkbox") {
        const next = raw === true || Number(raw) === 1;
        const edited = HOF.isTouched?.(node) && node.checked !== node.defaultChecked;
        node.defaultChecked = next;
        if (!edited) node.checked = next;
        continue;
      }
      const next = node.name === "dueDays" ? (Number(raw) ? String(raw) : "") : String(raw ?? "");
      if (node.tagName === "SELECT") {
        const saved = ([...node.options].find(option => option.defaultSelected) || node.options[0])?.value ?? "";
        const edited = HOF.isTouched?.(node) && node.value !== saved;
        if (![...node.options].some(option => option.value === next)) continue;
        for (const option of node.options) option.defaultSelected = option.value === next;
        if (!edited) node.value = next;
        continue;
      }
      const edited = HOF.isTouched?.(node) && node.value !== node.defaultValue;
      const typed = node.value;
      node.defaultValue = next;
      node.value = edited ? typed : next;
    }
  }
  // 2.4.4 (uzman UX9): çağıranın istediği alanlar zorunlu işaretlenir ve ilki odak alır (fatura formu: e-Belgenin eksik bıraktığı il,
  // vergi dairesi…); badges: alan → yanında görünen kısa not (zorunlu yapmadan, ör. faturadan yeni caride "e-Belge İçin Zorunlu").
  const markFields = (list, { require = [], badges = {} } = {}) => {
    const wanted = new Set(require);
    const first = list.find(field => wanted.has(field.name))?.name || "";
    return list.map(field => ({
      ...field,
      ...(wanted.has(field.name) ? { required: true } : {}),
      ...(first ? { autofocus: field.name === first } : {}),
      ...(badges[field.name] && !wanted.has(field.name) ? { badge: badges[field.name] } : {}),
    }));
  };
  // options.onSaved(result): başka ekrandan (ör. fatura formu "+ Yeni Cari") açıldığında kayıt sonrası Cari penceresi
  // açılmaz; sonuç çağırana verilir. options.require / options.badges: markFields; options.intro / options.savedMessage: formun üstündeki
  // açıklama ve kayıt bildirimi (fatura formundan "Cariyi Düzenle": cari kartının güncellendiği ve kesilmiş belgelerin değişmediği söylenir).
  async function editAccount(account, preset = null, options = {}) {
    const groups = await groupsNow();
    const link = { caseKey: account?.caseKey || preset?.caseKey || "", caseSource: account?.caseSource || "", caseTitle: account?.caseTitle || preset?.caseTitle || "" };
    let fieldsBox = null;
    HOF.formModal({
      title: account ? "Cariyi Düzenle" : "Yeni Cari",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      size: "wide",
      // 2.4.4 (E8): zil / Tahsilat Takvimi'nden carisi olmayan kayda tahsilat girilirken "önce cari açın" açıklaması (options.intro) gelir;
      // 2.4.4 (UX9): fatura formundan düzenlemede de eksik alan notu options.intro ile gelir.
      intro: options.intro || (account ? "" : "Kişinin ya da firmanın bilgileri. Taksit sorulmaz; taksit planı istenirse sonra karttan ya da listeden toplu açılır."),
      fields: markFields([
        { name: "name", label: "Ad Soyad / Unvan", required: true, maxlength: 160, value: account?.name || preset?.name || "", autofocus: true },
        { name: "type", label: "Tür", type: "select", value: account?.type || preset?.type || "customer", options: Object.entries(TYPES).map(([value, text]) => ({ value, label: text })) },
        { name: "refNo", label: "Cari No", maxlength: 30, value: account?.refNo || "", placeholder: account ? "" : "Boş bırakılırsa sıradaki numara" },
        // 2.4.4 (E8): kayıttan açılan caride Kayıt Tarihi tablodaki kayıttan (kişi bir kez girilir; önceden kayıttan taksit kısa yolu taşıyordu).
        { name: "registeredOn", label: "Kayıt Tarihi", type: "date", value: account?.registeredOn || preset?.registeredOn || office().todayIso?.() || "" },
        { name: "phone", label: "Telefon", type: "tel", inputmode: "tel", maxlength: 60, value: account?.phone || preset?.phone || "", placeholder: "05xx xxx xx xx" },
        { name: "email", label: "E-Posta", type: "email", maxlength: 160, value: account?.email || "" },
        { name: "address", label: "Adres", type: "textarea", rows: 2, maxlength: 500, value: account?.address || "" },
        ...(office().groupFields ? office().groupFields(groups, account || {}) : []),
        ...taxFields(account),
        { name: "note", label: "Bilgi Notu", type: "textarea", rows: 3, maxlength: 2000, value: account?.note || "" },
        ...(account
          ? []
          : [
              // 2.4.4 (5b): kayıttan açılan caride kayıttaki Kalan Borç ile dolu (değiştirilebilir); kaynağı alanın altında yazar.
              Number(preset?.openingBalance) > 0
                ? { name: "openingBalance", label: "Açılış Bakiyesi (₺)", inputmode: "decimal", value: office().amountText?.(preset.openingBalance) || String(preset.openingBalance), help: `Kayıttaki “${preset.openingSource || "Kalan Borç"}” kolonundan geldi; değiştirebilir ya da silebilirsiniz. Tablodan Aktar bu borcu ikinci kez yazmaz.` }
                : { name: "openingBalance", label: "Açılış Bakiyesi (₺)", inputmode: "decimal", placeholder: "Örn. 1.500", help: "Önceki defterden devreden bakiye. Boş bırakılabilir." },
              { name: "openingSide", label: "Bakiye Yönü", type: "select", value: "auto", options: OPENING_SIDES, help: "Tedarikçi listesindeki bakiye çoğunlukla bizim borcumuzdur (Alacaklı)." },
            ]),
      ], options),
      submitLabel: account ? "Kaydet" : "Cariyi Aç",
      onOpen: dialog => {
        dialog.classList.add("hof-plan-form", "hof-acc-form");
        office().wireGroupFields?.(dialog, groups);
        wireTaxFields(dialog);
        // UX9: odak verilen zorunlu alan (ör. İl) formun aşağısında kalıyordu (odak kaydırmasız) — alan görünür yere getirilir.
        if (options.require?.length) requestAnimationFrame(() => dialog.querySelector("[autofocus]")?.closest(".hof-field")?.scrollIntoView({ block: "center" }));
        if (HOF.plans?.casePicker) {
          const casePicker = HOF.el("div", { class: "hof-field hof-case-picker" }, HOF.plans.casePicker.html(link));
          dialog.querySelector('textarea[name="address"]').closest(".hof-field").after(casePicker);
          HOF.plans.casePicker.wire(casePicker);
          casePicker.querySelector("small").textContent = "Bağlı kaydın kartında (ortadaki tablo) bu carinin bakiyesi görünür.";
          // v2.0.7: ad yazılınca tabloda aynı adlı tek kayıt varsa ÖNERİ olarak gösterilir. 2.4.3 (keşif A1): kendiliğinden SEÇİLMEZ — kullanıcı
          // "Bu Kayda Bağla" ile seçer (kayıt → cari kendiliğinden bağı 2.0.18 kararıyla kalktı; aynı adlı başka cari varken kayıt sessizce yeni
          // cariye bağlanıyor, kayıttan girilen tahsilat yanlış cariye yazılıyordu). Kayıt zaten bir cariye bağlıysa öneri yerine o cari söylenir.
          if (!account && HOF.plans?.personOf) {
            const nameInput = dialog.querySelector('input[name="name"]');
            const keyInput = casePicker.querySelector('input[name="caseKey"]');
            const titleInput = casePicker.querySelector('input[name="caseTitle"]');
            const note = casePicker.querySelector("small");
            const plain = note.textContent;
            const offer = HOF.el("p", { class: "hof-case-suggest", "data-case-suggest": "", hidden: "" });
            note.after(offer);
            let ticket = 0;
            const suggest = async () => {
              const mine = ++ticket;
              const wanted = HOF.normalize(nameInput.value);
              const hits = !keyInput.value && wanted ? (HOF.data?.rows || []).filter(row => row.__hofKey && HOF.normalize(HOF.plans.personOf(row)) === wanted) : [];
              if (hits.length !== 1) {
                offer.hidden = true;
                offer.innerHTML = "";
                return;
              }
              const row = hits[0];
              const owner = (await samePeople(nameInput.value)).find(item => item.caseKey === row.__hofKey);
              if (mine !== ticket || keyInput.value) return;
              offer.hidden = false;
              offer.innerHTML = owner
                ? `Tabloda aynı adlı kayıt var (<b>${esc(HOF.plans.recordLabel(row))}</b>); bu kayıt zaten No ${esc(owner.refNo || "—")} cariye bağlı.`
                : `Tabloda aynı adlı kayıt var: <b>${esc(HOF.plans.recordLabel(row))}</b>. Aynı kişiyse bağlayın; bağlanmazsa kayıttan girilen tahsilat bu cariye yazılmaz. <button type="button" class="hof-link" data-case-suggest-link="${esc(row.__hofKey)}">Bu Kayda Bağla</button>`;
            };
            offer.addEventListener("click", event => {
              const key = event.target.closest("[data-case-suggest-link]")?.dataset.caseSuggestLink;
              const row = key ? (HOF.data?.rows || []).find(item => item.__hofKey === key) : null;
              if (!row) return;
              keyInput.value = key;
              titleInput.value = HOF.plans.recordLabel(row);
              note.textContent = plain;
              offer.hidden = true;
              offer.innerHTML = "";
              casePicker.classList.add("is-linked");
              casePicker.querySelector("[data-unlink]").hidden = false;
            });
            casePicker.querySelector("[data-unlink]").addEventListener("click", () => setTimeout(suggest, 0));
            nameInput.addEventListener("input", suggest);
            nameInput.addEventListener("blur", suggest);
            if (nameInput.value.trim()) suggest();
          }
        }
        fieldsBox = fieldsEditor(account?.fields || []);
        dialog.querySelector('textarea[name="note"]').closest(".hof-field").before(fieldsBox);
        if (!account) {
          // Yazarken: aynı adlı cariler (numarası, grubu, telefonu) adın altında listelenir; tıklanınca o cari açılır.
          const nameInput = dialog.querySelector('input[name="name"]');
          const hint = HOF.el("div", { class: "hof-dup-hint", hidden: "", "aria-live": "polite" });
          nameInput.closest(".hof-field").append(hint);
          let timer = 0;
          const check = () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
              const list = await samePeople(nameInput.value);
              hint.hidden = !list.length;
              hint.innerHTML = list.length
                ? `<b>${list.length} cari aynı adla kayıtlı:</b> ${list
                    .slice(0, 5)
                    .map(item => `<button type="button" class="hof-link" data-open-existing="${esc(item.id)}">No ${esc(item.refNo || "—")} · ${esc([item.groupName, item.phone].filter(Boolean).join(" · ") || "telefonsuz")}</button>`)
                    .join(" ")}. Aynı kişiyse yeni cari açmayın; mevcut cariyi açın.`
                : "";
            }, 250);
          };
          nameInput.addEventListener("input", check);
          hint.addEventListener("click", event => {
            const id = event.target.closest("[data-open-existing]")?.dataset.openExisting;
            if (!id) return;
            // Kullanıcı mevcut cariyi açmayı seçti: form sorusuz kapanır (Vazgeç; × kaydedilmemiş değişikliği sorardı — 2.4.3).
            (dialog.querySelector("[data-cancel]") || dialog.closest(".hof-modal-backdrop")?.querySelector(".hof-modal-close"))?.click();
            open(id);
          });
          if (nameInput.value.trim()) check();
        }
      },
      onSubmit: async (data, modalApi) => {
        if (anonymousOnNamed(data, account)) {
          const go = await HOF.confirm({ title: "Nihai Tüketici Kimliği", message: "11111111111 kimliği bilinmeyen nihai tüketici içindir; adı belli kişide gerçek TC kimlik numarasını yazın. Yine de kaydedilsin mi?", confirmLabel: "Yine de Kaydet", cancelLabel: "Vazgeç", danger: true });
          if (!go) {
            modalApi.dialog.querySelector('input[name="taxNo"]')?.focus();
            return true;
          }
        }
        if (!account) {
          // Kaydederken: aynı ad + aynı telefon varsa (ya da ikisinde de telefon yoksa) açıkça sorulur.
          const same = await samePeople(data.name);
          const twins = same.filter(item => (data.phone && item.phone ? sameDigits(item.phone, data.phone) : !data.phone && !item.phone));
          if (twins.length) {
            const first = twins[0];
            const go = await HOF.confirm({ title: "Bu Kişi Zaten Kayıtlı", message: `“${data.name}” ${data.phone ? `(${data.phone}) ` : ""}zaten cari olarak var: No ${first.refNo || "—"}${first.groupName ? ` · ${first.groupName}` : ""}. Aynı kişi için ikinci cari açılırsa borç ve tahsilatlar iki karta bölünür. Yine de yeni cari açılsın mı?`, confirmLabel: "Yine de Aç", cancelLabel: "Mevcut Cariyi Aç", danger: true });
            if (!go) {
              open(first.id);
              return;
            }
          } else if (same.length) {
            // 2.4.3 (keşif A3): telefonu farklı ya da yalnız birinde telefon olsa da aynı adlı cari varken kayıt onaysız geçmez; ayırt edici bilgi
            // (Cari No, telefon, grup) soruda yazılır. Vazgeç formu açık bırakır (yazılanlar kaybolmaz).
            const list = same.slice(0, 5).map(item => `No ${item.refNo || "—"}${item.phone ? ` · ${item.phone}` : " · telefonsuz"}${item.groupName ? ` · ${item.groupName}` : ""}`).join("; ");
            const go = await HOF.confirm({ title: "Aynı Adlı Cari Var", message: `“${data.name}” adıyla ${same.length} cari kayıtlı: ${list}${same.length > 5 ? "; …" : ""}. Aynı kişiyse yeni cari açmayın; borç ve tahsilatlar iki karta bölünür. Farklı bir kişiyse yine de yeni cari açılsın mı?`, confirmLabel: "Yine de Aç", cancelLabel: "Vazgeç", danger: true });
            if (!go) return true;
          }
        }
        const payload = { ...taxPayload(data), name: data.name, type: data.type, refNo: data.refNo, registeredOn: data.registeredOn, phone: data.phone, email: data.email, address: data.address, note: data.note, fields: fieldsBox ? fieldsBox.read() : [], caseKey: data.caseKey || "", caseSource: data.caseSource || "", caseTitle: data.caseKey ? data.caseTitle : "", ...(office().groupBody ? office().groupBody(data) : {}) };
        if (!account) Object.assign(payload, { openingBalance: data.openingBalance, openingSide: data.openingSide || "auto" });
        let result;
        try {
          // 2.4.3 (uzman UX1): düzenlemede formun açıldığı andaki sürüm (updatedAt) gider; arada başka biri kaydettiyse sunucu 409 account-stale
          // döner (çek ve tablo hücresindeki kalıp). Önceden ikinci kaydeden, ilkinin değişikliğini (ör. telefon) sessizce siliyordu.
          result = account ? await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`, { method: "PUT", body: { ...payload, updatedAt: account.updatedAt || "" } }) : await HOF.api("/api/workspace/accounts", { method: "POST", body: payload });
        } catch (error) {
          if (!account || error?.data?.code !== "account-stale") throw error;
          // Güncel hâl yüklenir: kullanıcının değiştirdiği alanlar formda kalır, değiştirmedikleri güncel değeri alır; sonraki Kaydet yeni sürümle gider.
          const fresh = await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`);
          refreshUntouched(modalApi.dialog, fresh);
          account = fresh;
          if (view.id === fresh.id) applyAccount(fresh);
          throw new Error("Bu cari siz düzenlerken başka biri tarafından değiştirildi; güncel hâli yüklendi. Değiştirdiğiniz alanlar formda duruyor; kontrol edip yeniden kaydedin.");
        }
        HOF.toast(options.savedMessage || (account ? "Cari güncellendi." : "Cari açıldı."), { type: "success", ...(options.savedMessage ? { timeout: 8000 } : {}) });
        if (typeof options.onSaved === "function") {
          HOF.emit("accounts-changed", { accountId: result.id });
          options.onSaved(result);
          return;
        }
        if (!modal) open(result.id);
        view.id = result.id;
        view.mode = "card";
        applyAccount(result);
      },
    });
  }
  // v2.0.17: tahsilat/ödeme formunda "Kapatılacak Fatura" — Otomatik (carinin en eski açık faturası) ya da seçilen fatura.
  // Seçim yalnız fatura kapamasını belirler; bakiye ve Kasa aynı. Açık fatura yoksa alan görünmez.
  async function openInvoiceOptions(account, type) {
    if (!HOF.invoices || !HOF.can("invoices.view")) return [];
    try {
      const data = await HOF.api(`/api/workspace/invoices?tab=all&status=issued&pay=open&side=${type === "in" ? "sale" : "purchase"}&account=${encodeURIComponent(account.id)}&limit=200`);
      return (data.invoices || [])
        // v2.0.23: taksitli fatura kendi taksit kartıyla kapanır; burada seçilemez (tahsilat kartın taksitine girilir).
        .filter(item => !item.kind.endsWith("_return") && !item.planId && item.open > 0.004)
        .map(item => ({ value: item.id, label: `${item.kindLabel} ${item.displayNo} · ${HOF.formatDate(item.issueDate)} · açık ${money(item.open)}` }));
    } catch {
      return [];
    }
  }
  // preset (2.4.4 E8; yalnız yeni tahsilat): zil / Tahsilat Takvimi kaleminden { amount, note } — tutar ve açıklama hazır gelir.
  async function editEntry(account, { kind = "in", entry = null, preset = null } = {}) {
    const type = entry?.kind || kind;
    const invoiceOptions = type === "in" || type === "out" ? await openInvoiceOptions(account, type) : [];
    if (entry?.invoiceId && !invoiceOptions.some(option => option.value === entry.invoiceId)) invoiceOptions.unshift({ value: entry.invoiceId, label: "Bağlı Fatura (kapanmış)" });
    // v2.1.0 Aşama 5: istek kimliği form açılışında (aynı gönderim ikinci kez yazılmaz); Havale / EFT seçilince Banka Hesabı (tek hesapta gizli).
    const requestId = HOF.requestId();
    const money_ = type === "in" || type === "out";
    HOF.formModal({
      title: entry ? `${ENTRY_LABEL[type]} düzelt` : ENTRY_LABEL[type],
      // 2.4.3 (keşif A1/A21): aynı adlı cariler karışmasın — başlıkta Cari No ve telefon (kayıt kartından açılan tahsilat hangi cariye yazılacak).
      eyebrow: [account.refNo ? `No ${account.refNo}` : "", account.name, account.phone || ""].filter(Boolean).join(" · "),
      intro: ENTRY_HELP[type],
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: entry ? office().amountText?.(entry.amount) || entry.amount : Number(preset?.amount) > 0 ? office().amountText?.(preset.amount) || String(preset.amount) : "", placeholder: "Örn. 1.250,00", autofocus: true },
        // v2.0.13: tahsilat/ödeme yolu (Nakit, Havale / EFT, Kredi Kartı, Çek / Senet). Çek/senet seçilirse evrak formuna geçilir.
        ...(type === "in" || type === "out"
          ? [{ name: "method", label: type === "in" ? "Tahsilat Yolu" : "Ödeme Yolu", type: "select", value: entry?.method || "cash", options: [...HOF.payMethods(type === "in" ? "in" : "out"), ...(!entry && HOF.cheques?.newFor && HOF.can("cheques.manage") ? [{ value: "cheque", label: type === "in" ? "Çek / Senet (portföye alınır)" : "Çek / Senet (verilir)" }] : [])] }]
          : []),
        // 2.3.0 (İz 3.2; plan §4.6 "alıştan iade, ödeme iadesi (giriş) → Kredi Kartı; POS satışı oluşmaz, 309 düşer"): tahsilatta Kredi Kartı yolu POS'tur;
        // tedarikçi parayı firmanın kredi kartına iade ettiyse bu kutu işaretlenir → POS alanı yerine kredi kartı seçicisi (yalnız yol Kredi Kartı iken görünür).
        ...(type === "in" && HOF.bank?.attachPicker && (account.type !== "customer" || entry?.cardRefund === true) ? [{ name: "cardRefund", label: "Kredi Kartına İade (tedarikçi parayı firmanın kredi kartına iade etti; POS tahsilatı değil)", type: "checkbox", value: entry?.cardRefund === true }] : []),
        // Karar 15.10.2026 (plan §3.11b/2): şüpheli kaydı AÇIK müşteride tahsilat varsayılan şüpheliden düşer; bu kutu işaretlenirse satır normal
        // cari hesapta (120) kalır. Yalnız müşteri + açık şüpheli varken görünür; fatura peşini ve Kapatılacak Fatura bağlı tahsilat zaten normaldir.
        ...(type === "in" && account.type === "customer" && (account.doubtful?.openMinor || 0) > 0 ? [{ name: "doubtfulSkip", label: "Normal Cari Hesaba İşle (şüpheli alacaktan düşmez; satır 120 Alıcılar'da kalır)", type: "checkbox", value: entry?.doubtfulSkip === true }] : []),
        // v2.0.13: yanlış yönde yazılan borç/alacak düzeltilirken yön değiştirilebilir (açılış bakiyesi gibi).
        ...(entry && (type === "debt" || type === "credit") ? [{ name: "kind", label: "Yön", type: "select", value: type, options: [{ value: "debt", label: "Borç (cari bize borçlanır)" }, { value: "credit", label: "Alacak (biz cariye borçlanırız)" }] }] : []),
        { name: "date", label: "Tarih", type: "date", max: "today", value: entry?.date || office().todayIso?.() || "" },
        ...(invoiceOptions.length ? [{ name: "invoiceId", label: "Kapatılacak Fatura", type: "select", value: entry?.invoiceId || "", options: [{ value: "", label: "Otomatik (En Eski Açık Fatura)" }, ...invoiceOptions], help: "Seçilen fatura bu kayıtla kapanır; fazlası en eski açık faturaya gider. Bakiye ve Kasa değişmez. Faturaya bağlı tahsilat şüpheli alacaktan düşmez (yeni satışın parası); çek / senet evrakı ise şüpheli alacaktan düşer." }] : []),
        { name: "note", label: "Açıklama", maxlength: 300, value: entry?.note || (!entry && preset?.note ? String(preset.note).slice(0, 300) : ""), placeholder: type === "in" ? "Ör. Eylül ödemesi" : type === "debt" ? "Ör. Eylül aidatı, 3 adet ürün" : "" },
      ],
      submitLabel: entry ? "Kaydet" : ENTRY_LABEL[type],
      onOpen: dialog => {
        // K2 (plan §3.7 #3, §8.9): ödemede "Kredi Kartı" seçilince Kurumsal Kart (tahsilatta kart yolu POS'tur; seçici yok).
        const card = type === "out" ? { value: entry?.method === "card" ? entry.finRef || "" : "", keepLabel: entry && entry.method === "card" && !entry.finRef ? "Atanmamış (Eski Hareket)" : "" } : type === "in" ? { value: entry?.cardRefund === true ? entry.finRef || "" : "", keepLabel: "" } : null;
        // 2.7: seçicide bakiye — tahsilat hesaba girer, ödeme çıkar (kartla ödeme kart borcunu artırır); düzeltmede eski tutar bakiyede (original).
        const original = entry && (entry.method === "bank" || entry.method === "card") && entry.finRef ? { ref: entry.finRef, amount: entry.amount, date: entry.date } : null;
        // 2.2.0 (İz 3.2): tahsilatta kart yolu POS'tur — POS, POS Taksit Sayısı, Provizyon No, Kartın Son 4 Hanesi ve önizleme (düzeltmede satırın
        // POS kaydından). Cari "POS İadesi" Banka → POS → POS İşlemleri → İade'den (asıl satışa bağlı).
        const pos = type === "in" ? { value: entry?.method === "card" && entry?.cardRefund !== true ? entry.finRef || "" : "", row: entry && entry.cardRefund !== true ? `account_entries:${entry.id}` : "" } : null;
        const picker = money_ && HOF.bank?.attachPicker ? HOF.bank.attachPicker(dialog.querySelector("form"), { methodName: "method", value: entry?.method === "bank" ? entry.finRef || "" : "", keepLabel: entry && entry.method === "bank" && !entry.finRef ? "Atanmamış (Eski Hareket)" : "", card, pos, direction: type === "out" ? "out" : "in", original }) : null;
        // Ek iş B: açıklama yola göre (seçici yerleşince ve yol değişince).
        if (money_) {
          // "Kredi Kartına İade" kutusu yalnız yol Kredi Kartı iken görünür.
          const syncCardRefund = () => {
            const form = dialog.querySelector("form");
            const box = form?.querySelector('input[name="cardRefund"]')?.closest(".hof-check");
            if (box) box.hidden = form.querySelector('[name="method"]')?.value !== "card";
          };
          // Yol ya da hesap seçimi değişince (Hesapsız (Açılıştan Önce) dahil); dinleyici formda — seçici yeniden kurulsa da çalışır.
          dialog.querySelector("form")?.addEventListener("change", () => {
            syncCardRefund();
            syncEntryHelp(dialog, type);
          });
          syncCardRefund();
          syncEntryHelp(dialog, type);
          Promise.resolve(picker).then(() => syncEntryHelp(dialog, type)).catch(() => null);
        }
      },
      onSubmit: async data => {
        if (data.method === "cheque") {
          // Çekle/senetle tahsilat ya da ödeme: evrak portföye girer, carinin borcu evrakla düşer (Kasa değişmez).
          // 2.4.4 UX18 (kullanıcı kararı 21.10.2026): seçilen Kapatılacak Fatura evrak formuna taşınır (önceden sessizce düşüyor, evrak en eski faturayı kapatıyordu).
          setTimeout(() => HOF.cheques.newFor({ direction: type === "in" ? "in" : "out", account: { id: account.id, name: account.name }, amount: String(data.amount || "").trim(), invoiceId: data.invoiceId || "" }), 150);
          return;
        }
        const url = `/api/workspace/accounts/${encodeURIComponent(account.id)}/entries${entry ? `/${encodeURIComponent(entry.id)}` : ""}`;
        const body = { ...data, kind: entry && data.kind ? data.kind : type };
        if (HOF.bank?.accountBody) HOF.bank.accountBody(body, data.method);
        else if (data.method !== "bank") delete body.bankAccountId;
        const send = flags => HOF.api(url, { method: entry ? "PUT" : "POST", body: { ...body, ...flags }, requestId });
        const result = HOF.bank?.withConfirms ? await HOF.bank.withConfirms(send) : await send({});
        applyAccount(result);
        if (result.replayed) {
          HOF.toast("Bu işlem zaten kaydedildi; ikinci kez yazılmadı.", { type: "info" });
          return;
        }
        if (type === "in" || type === "out") HOF.emit("cash-changed");
        // 2.4.3 (keşif A2): kayda bağlı carinin tahsilatı/ödemesi o kaydın İşlem Geçmişi'nde de görünür; seçili kaydın geçmişi hemen yenilenir.
        if ((type === "in" || type === "out") && account.caseKey) HOF.workspace?.refreshActivity?.();
        const receipt = !entry && (type === "in" || type === "out") && result.entryId ? { label: "Makbuz", onClick: () => window.open(`/api/workspace/accounts/${encodeURIComponent(account.id)}/entries/${encodeURIComponent(result.entryId)}/makbuz.pdf`, "_blank", "noopener") } : undefined;
        HOF.toast(`${entry ? "Hareket düzeltildi" : `${ENTRY_LABEL[type]} kaydedildi`}. Bakiye ${money(Math.abs(result.totals.balance))}${sideWord(result.totals.balance) ? ` ${sideWord(result.totals.balance)}` : ""}.`, { type: "success", action: receipt });
      },
    });
  }

  // ---------- Şüpheli Ticari Alacaklar (2.3.0 İz 1.6; plan §3.11b; sunucu routes/doubtful.mjs) ----------
  // Yalnız müşteri carisinde (K2). Düğmeler yalnız canDoubtful (Cari Yönetimi + Şüpheli Alacak İşlemleri) ile; bilgi herkese görünür.
  // Tahsil edilen / kalan sunucuda her seferinde türetilir (K3); kart bakiyesi şüpheliyi de kapsar (120 + 128 = kart).
  const DOUBTFUL_REASONS = [["cheque", "Karşılıksız Çek"], ["note", "Protestolu Senet"], ["lawsuit", "Dava"], ["enforcement", "İcra"], ["other", "Diğer"]];
  const minorMoney = minor => money((Number(minor) || 0) / 100);
  const doubtfulUrl = (accountId, tail = "") => `/api/workspace/accounts/${encodeURIComponent(accountId)}/doubtful${tail}`;
  const doubtfulBadge = summary => (summary && summary.openMinor > 0 ? ` <span class="hof-plan-badge is-late" data-doubtful-badge title="Şüpheli alacakta: ${esc(minorMoney(summary.openMinor))}">Şüpheli</span>` : "");
  function doubtfulSectionHtml(account) {
    const d = account.doubtful;
    if (!d || (account.type !== "customer" && !d.count)) return "";
    const taken = d.openMinor + d.collectedMinor + d.writtenOffMinor + d.releasedMinor;
    const facts = d.count
      ? `<dl class="hof-plan-facts hof-acc-doubtful-facts" data-doubtful-facts>
          <div><dt>Şüpheliye Alınan</dt><dd data-dbt="taken">${esc(minorMoney(taken))}</dd></div>
          <div><dt>Karşılık</dt><dd data-dbt="provision">${esc(minorMoney(d.provisionMinor))}</dd></div>
          <div><dt>Tahsil Edilen</dt><dd data-dbt="collected">${esc(minorMoney(d.collectedMinor))}</dd></div>
          <div><dt>Değersiz Yazılan</dt><dd data-dbt="writtenOff">${esc(minorMoney(d.writtenOffMinor))}</dd></div>
          <div><dt>Şüpheliden Çıkarılan</dt><dd data-dbt="released">${esc(minorMoney(d.releasedMinor))}</dd></div>
          <div><dt>Kalan (Şüphelide)</dt><dd data-dbt="open"><b>${esc(minorMoney(d.openMinor))}</b></dd></div>
        </dl>`
      : `<p class="hof-empty" data-doubtful-empty>Şüpheli alacak yok.${account.canDoubtful ? " Tahsili şüpheli hâle gelen borç (karşılıksız çek, protestolu senet, dava, icra) <b>Şüpheli Alacağa Al</b> ile 128 hesabına alınır; bakiye değişmez, tahsilat önce şüpheliden düşer." : ""}</p>`;
    return `<div class="hof-plan-section"><h4>Şüpheli Alacak <span>${d.count}</span>${doubtfulBadge(d)}</h4>${account.canDoubtful ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="doubtfulTake" title="Borç bakiyesinin tahsili şüpheli kısmını 128 Şüpheli Ticari Alacaklar hesabına alır; cari bakiyesi değişmez">Şüpheli Alacağa Al</button>' : '<span class="hof-muted" data-doubtful-noperm>Şüpheli Alacak İşlemleri yetkisi gerekir; yöneticinize başvurun.</span>'}</div>
      <div class="hof-cash-list hof-acc-doubtful" data-acc-doubtful>${facts}${d.count ? '<p class="hof-empty" data-doubtful-list>Yükleniyor…</p>' : ""}</div>`;
  }
  // Kayıt listesi (kart açılınca; cari kartının özeti sunucudan gelir, kayıtlar ayrıca okunur).
  let doubtfulTicket = 0;
  async function loadDoubtful(account) {
    const slot = body()?.querySelector("[data-doubtful-list]");
    if (!slot) return;
    const ticket = ++doubtfulTicket;
    try {
      const data = await HOF.api(doubtfulUrl(account.id));
      if (ticket !== doubtfulTicket || !slot.isConnected) return;
      const can = account.canDoubtful;
      const sub = record =>
        [
          ...record.provisions.map(item => `<small class="hof-acc-doubtful-sub">Karşılık ${esc(HOF.formatDate(item.date))} · ${esc(minorMoney(item.amountMinor))}${item.eventNo ? ` · ${esc(item.eventNo)}` : ""}${item.note ? ` · ${esc(item.note)}` : ""}${can ? ` <button type="button" class="hof-mini hof-mini-danger" data-dbt-prov-del="${esc(item.id)}" data-dbt-id="${esc(record.id)}" title="Karşılığı sil" aria-label="Karşılığı sil">×</button>` : ""}</small>`),
          ...record.writeOffs.map(item => `<small class="hof-acc-doubtful-sub">Değersiz ${esc(HOF.formatDate(item.date))} · ${esc(minorMoney(item.amountMinor))}${item.eventNo ? ` · ${esc(item.eventNo)}` : ""}${item.note ? ` · ${esc(item.note)}` : ""}${can ? ` <button type="button" class="hof-mini hof-mini-danger" data-dbt-wo-del="${esc(item.entryId)}" data-dbt-id="${esc(record.id)}" title="Değersiz alacak satırını sil" aria-label="Değersiz alacak satırını sil">×</button>` : ""}</small>`),
        ].join("");
      const actions = record =>
        can
          ? `${record.stateKey === "open" ? `<button type="button" class="hof-mini hof-mini-text" data-dbt-act="provision" data-dbt-id="${esc(record.id)}" title="VUK 323: B 654 / A 129; en çok kalan şüpheli tutar">Karşılık Ayır</button><button type="button" class="hof-mini hof-mini-text" data-dbt-act="writeoff" data-dbt-id="${esc(record.id)}" title="Kesinleşmiş kayıp: cari bakiyesi o tutar kadar kapanır">Değersiz Alacak Yaz</button><button type="button" class="hof-mini hof-mini-text" data-dbt-act="release" data-dbt-id="${esc(record.id)}" title="Kalanı 120'ye geri alır (B 120 / A 128); karşılık 644'e çözülür">Şüpheliden Çıkar</button>` : ""}<button type="button" class="hof-mini hof-mini-danger" data-dbt-act="delete" data-dbt-id="${esc(record.id)}" title="Kaydı sil (Silinenler'e)" aria-label="Kaydı sil">×</button>`
          : "";
      slot.outerHTML = data.records.length
        ? `<table class="hof-table hof-cash-table hof-acc-doubtful-table" data-doubtful-list><thead><tr><th>Tarih</th><th>Neden</th><th class="num">Tutar</th><th class="num">Karşılık</th><th class="num">Tahsil Edilen</th><th class="num">Değersiz</th><th class="num">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${data.records
            .map(record => `<tr data-doubtful-record="${esc(record.id)}" class="is-${esc(record.stateKey)}"><td>${esc(HOF.formatDate(record.date))}${record.eventNo ? `<small>${esc(record.eventNo)}</small>` : ""}</td><td><b>${esc(record.reasonLabel)}</b>${record.chequeSerialNo ? `<small>Evrak No ${esc(record.chequeSerialNo)}</small>` : ""}${record.note ? `<small>${esc(record.note)}</small>` : ""}${sub(record)}</td><td class="num">${esc(minorMoney(record.amountMinor))}</td><td class="num">${esc(minorMoney(record.provisionMinor))}</td><td class="num">${esc(minorMoney(record.collectedMinor))}</td><td class="num">${esc(minorMoney(record.writtenOffMinor))}</td><td class="num"><b>${esc(minorMoney(record.remainingMinor))}</b></td><td><span class="hof-plan-badge ${record.stateKey === "open" ? "is-late" : record.stateKey === "collected" ? "is-done" : "is-muted"}">${esc(record.statusLabel)}</span>${record.closedOn ? `<small>${esc(HOF.formatDate(record.closedOn))}</small>` : ""}</td><td class="hof-cash-actions">${actions(record)}</td></tr>`)
            .join("")}</tbody></table>`
        : '<p class="hof-empty" data-doubtful-list>Kayıt yok.</p>';
    } catch (error) {
      if (ticket === doubtfulTicket && slot.isConnected) slot.textContent = `Şüpheli alacak kayıtları okunamadı: ${error.message}`;
    }
  }
  const doubtfulRefresh = async accountId => {
    if (view.id === accountId && view.mode === "card") await loadAccount(accountId, { quiet: true });
    else loadList();
    HOF.emit("accounts-changed", { accountId });
  };
  /** Şüpheli Alacağa Al: account { id, name, totals, doubtful } (kart verisi); preset { chequeId, amount, reason, serialNo } evrak kısayolu. */
  function doubtfulTakeForm(account, preset = null) {
    const roomMinor = Math.max(0, Math.round((Number(account.totals?.balance) || 0) * 100) - (account.doubtful?.openMinor || 0));
    const requestId = HOF.requestId();
    const amountText = minor => office().amountText?.(minor / 100) || String(minor / 100);
    HOF.formModal({
      title: "Şüpheli Alacağa Al",
      eyebrow: account.name,
      intro: `Tutar 128 Şüpheli Ticari Alacaklar hesabına alınır (B 128 / A 120); cari bakiyesi değişmez, sonraki tahsilat önce şüpheliden düşer. En çok ${minorMoney(roomMinor)} (borç bakiyesi${account.doubtful?.openMinor ? " − zaten şüphelideki" : ""}).${preset?.serialNo ? ` Evrak No ${preset.serialNo}: neden ve tutar evraktan.` : ""}`,
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: preset?.amount !== undefined ? amountText(Math.round(Number(preset.amount) * 100)) : roomMinor ? amountText(roomMinor) : "", autofocus: true },
        { name: "date", label: "Tarih", type: "date", max: "today", required: true, value: office().todayIso?.() || "" },
        { name: "reason", label: "Neden", type: "select", value: preset?.reason || "lawsuit", options: DOUBTFUL_REASONS.map(([value, label]) => ({ value, label })) },
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: "Ör. dava dosya no, icra dairesi" },
      ],
      submitLabel: "Şüpheli Alacağa Al",
      onSubmit: async data => {
        const result = await HOF.api(doubtfulUrl(account.id), { method: "POST", body: { amount: data.amount, date: data.date, reason: data.reason, note: data.note, ...(preset?.chequeId ? { chequeId: preset.chequeId } : {}) }, requestId });
        await doubtfulRefresh(account.id);
        HOF.toast(result.replayed ? "Bu işlem zaten kaydedildi; ikinci kez yazılmadı." : `Şüpheli alacağa alındı: ${minorMoney(result.record?.amountMinor)} · şüphelide ${minorMoney(result.summary?.openMinor)}.`, { type: result.replayed ? "info" : "success" });
      },
    });
  }
  function doubtfulProvisionForm(account, record) {
    const requestId = HOF.requestId();
    const room = Math.max(0, record.remainingMinor - record.provisionMinor);
    HOF.formModal({
      title: "Karşılık Ayır",
      eyebrow: `${account.name} · ${record.reasonLabel} · ${minorMoney(record.amountMinor)}`,
      intro: `VUK 323: B 654 Karşılık Giderleri / A 129. Bu kayıtta kalan şüpheli ${minorMoney(record.remainingMinor)}, ayrılmış karşılık ${minorMoney(record.provisionMinor)}; en çok ${minorMoney(room)} daha ayrılabilir. Tahsilat gelince karşılık kalanı aşarsa aşan kısım 644'e çözülür.`,
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: room ? office().amountText?.(room / 100) || String(room / 100) : "", autofocus: true },
        { name: "date", label: "Tarih", type: "date", max: "today", required: true, value: office().todayIso?.() || "" },
        { name: "note", label: "Açıklama", maxlength: 300 },
      ],
      submitLabel: "Karşılık Ayır",
      onSubmit: async data => {
        const result = await HOF.api(doubtfulUrl(account.id, `/${encodeURIComponent(record.id)}/provision`), { method: "POST", body: data, requestId });
        await doubtfulRefresh(account.id);
        HOF.toast(result.replayed ? "Bu işlem zaten kaydedildi; ikinci kez yazılmadı." : `Karşılık ayrıldı: ${minorMoney(result.record?.provisionMinor)}.`, { type: result.replayed ? "info" : "success" });
      },
    });
  }
  function doubtfulWriteOffForm(account, record) {
    const requestId = HOF.requestId();
    HOF.formModal({
      title: "Değersiz Alacak Yaz",
      eyebrow: `${account.name} · ${record.reasonLabel} · ${minorMoney(record.amountMinor)}`,
      intro: `Kesinleşmiş kayıp: karşılık varsa önce 129'dan, kalanı 659 Diğer Olağandışı Gider'den düşer; A 128. Cari kartına "Değersiz Alacak" alacak satırı yazılır, bakiye o tutar kadar kapanır. En çok ${minorMoney(record.remainingMinor)} (kalan şüpheli).`,
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: office().amountText?.(record.remainingMinor / 100) || String(record.remainingMinor / 100), autofocus: true },
        { name: "date", label: "Tarih", type: "date", max: "today", required: true, value: office().todayIso?.() || "" },
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: "Ör. mahkeme kararı, aciz vesikası" },
      ],
      submitLabel: "Değersiz Alacak Yaz",
      onSubmit: async (data, dialog) => {
        const go = await HOF.confirm({ title: "Değersiz Alacak Yaz", message: `${String(data.amount).trim()} ₺ değersiz alacak yazılacak: ${account.name} carisinin bakiyesi o tutar kadar kapanır, tutar gider olarak defterde kalır. Kayıt sonra silinirse ${HOF.trashHint()} Devam edilsin mi?`, confirmLabel: "Değersiz Alacak Yaz", danger: true });
        if (!go) {
          const error = dialog?.dialog?.querySelector(".hof-form-error");
          if (error) error.textContent = "Kaydedilmedi: değersiz alacak yazımı onaylanmadı.";
          return true;
        }
        const result = await HOF.api(doubtfulUrl(account.id, `/${encodeURIComponent(record.id)}/write-off`), { method: "POST", body: data, requestId });
        await doubtfulRefresh(account.id);
        HOF.toast(result.replayed ? "Bu işlem zaten kaydedildi; ikinci kez yazılmadı." : `Değersiz alacak yazıldı: ${minorMoney(result.record?.writtenOffMinor)} · şüphelide kalan ${minorMoney(result.record?.remainingMinor)}.`, { type: result.replayed ? "info" : "success" });
      },
    });
  }
  function doubtfulReleaseForm(account, record) {
    const requestId = HOF.requestId();
    HOF.formModal({
      title: "Şüpheliden Çıkar",
      eyebrow: `${account.name} · ${record.reasonLabel} · ${minorMoney(record.amountMinor)}`,
      intro: `Kalan şüpheli tutar (${minorMoney(record.remainingMinor)}) 120'ye geri alınır (B 120 / A 128)${record.provisionMinor ? `; ayrılmış karşılık (${minorMoney(record.provisionMinor)}) 644 Konusu Kalmayan Karşılıklar'a çözülür` : ""}. Cari bakiyesi değişmez.`,
      fields: [
        { name: "date", label: "Tarih", type: "date", max: "today", required: true, value: office().todayIso?.() || "" },
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: "Ör. uzlaşıldı, teminat alındı" },
      ],
      submitLabel: "Şüpheliden Çıkar",
      onSubmit: async data => {
        const result = await HOF.api(doubtfulUrl(account.id, `/${encodeURIComponent(record.id)}/release`), { method: "POST", body: data, requestId });
        await doubtfulRefresh(account.id);
        HOF.toast(result.replayed ? "Bu işlem zaten kaydedildi; ikinci kez yazılmadı." : "Şüpheliden çıkarıldı; tutar yeniden 120'de.", { type: result.replayed ? "info" : "success" });
      },
    });
  }
  async function doubtfulDelete(account, { recordId, provisionId = "", entryId = "" }) {
    const what = provisionId ? "karşılık" : entryId ? "değersiz alacak satırı" : "şüpheli alacak kaydı";
    const ok = await HOF.confirm({ title: provisionId ? "Karşılığı Sil" : entryId ? "Değersiz Alacak Satırını Sil" : "Şüpheli Alacak Kaydını Sil", message: `Bu ${what} silinecek; defter kaydı ters kayıtla düşer. ${HOF.trashHint()}`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(doubtfulUrl(account.id, `/${encodeURIComponent(recordId)}${provisionId ? `/provisions/${encodeURIComponent(provisionId)}` : entryId ? `/write-offs/${encodeURIComponent(entryId)}` : ""}`), { method: "DELETE" });
      await doubtfulRefresh(account.id);
      HOF.toast(`${what[0].toLocaleUpperCase("tr-TR")}${what.slice(1)} silindi. ${HOF.trashHint()}`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function doubtfulRecordOf(account, recordId) {
    const data = await HOF.api(doubtfulUrl(account.id));
    const record = data.records.find(item => item.id === recordId);
    if (!record) throw new Error("Şüpheli alacak kaydı bulunamadı; kart yenilendi.");
    return record;
  }
  async function onDoubtfulClick(button, account) {
    try {
      if (button.dataset.act === "doubtfulTake") return doubtfulTakeForm(account);
      if (button.dataset.dbtProvDel) return doubtfulDelete(account, { recordId: button.dataset.dbtId, provisionId: button.dataset.dbtProvDel });
      if (button.dataset.dbtWoDel) return doubtfulDelete(account, { recordId: button.dataset.dbtId, entryId: button.dataset.dbtWoDel });
      const act = button.dataset.dbtAct;
      if (!act) return false;
      if (act === "delete") return doubtfulDelete(account, { recordId: button.dataset.dbtId });
      const record = await doubtfulRecordOf(account, button.dataset.dbtId);
      if (act === "provision") return doubtfulProvisionForm(account, record);
      if (act === "writeoff") return doubtfulWriteOffForm(account, record);
      if (act === "release") return doubtfulReleaseForm(account, record);
    } catch (error) {
      HOF.toastError(error);
    }
    return true;
  }
  /** Karşılıksız evrak kartından kısayol (hof-cheques.js): cari kartı okunur, form evrakın neden ve tutarıyla açılır. */
  async function doubtfulFromCheque(cheque) {
    try {
      const account = await HOF.api(`/api/workspace/accounts/${encodeURIComponent(cheque.accountId)}`);
      if (!account.canDoubtful) return HOF.toast("Şüpheli alacak işlemleri için Cari Yönetimi ve Şüpheli Alacak İşlemleri yetkisi gerekir.", { type: "error" });
      doubtfulTakeForm(account, { chequeId: cheque.id, amount: cheque.amount, reason: cheque.instrument === "note" ? "note" : "cheque", serialNo: cheque.serialNo || "" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Tahsilat: carinin açık taksit kartı varsa önce sorulur — taksite mi (taksitten düşer), taksit dışı mı (carinin
  // hesabına). Böylece taksitli kişinin parası yanlışlıkla taksit dışı yazılıp taksit "ödenmemiş" görünmez.
  // preset (2.4.4 E8): zil / Tahsilat Takvimi'nden gelince { amount, note } taksit dışı tahsilat formuna gelir (taksite yazılırsa tutar kartın sıradaki taksitidir).
  function collect(account, preset = null) {
    const open = account.plans.filter(plan => plan.status === "active" && plan.totals.remaining > 0.005);
    if (!open.length || !HOF.plans?.collect) return editEntry(account, { kind: "in", preset });
    const chooser = HOF.modal({
      title: "Tahsilat",
      // 2.4.3 (keşif A1/A21): aynı adlı cariler karışmasın — Cari No ve telefon.
      eyebrow: [account.refNo ? `No ${account.refNo}` : "", account.name, account.phone || ""].filter(Boolean).join(" · "),
      body: `<p class="hof-modal-text">Bu carinin açık taksit kartı var. Taksit ödemesiyse <b>taksite yazın</b>: tutar o taksitten düşer, Kasa’ya tek kayıt olarak girer.</p>
        <div class="hof-acc-choices">${open.map(plan => `<button type="button" class="hof-acc-choice" data-plan="${esc(plan.id)}"><b>Taksite Yaz · ${esc(plan.name)}</b><small>Kalan ${esc(money(plan.totals.remaining))}${plan.next ? ` · sıradaki ${esc(HOF.formatDate(plan.next.dueDate))}` : ""}${plan.totals.overdueCount ? ` · ${plan.totals.overdueCount} taksit gecikti` : ""}</small></button>`).join("")}
        <button type="button" class="hof-acc-choice is-plain" data-plain><b>Taksit Dışı Tahsilat</b><small>Carinin hesabına yazılır (ör. ek hizmet, borç yazılan tutar)</small></button></div>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button></div>`,
    });
    chooser.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-plan], [data-plain], [data-close]");
      if (!button) return;
      chooser.close();
      if ("plain" in button.dataset) return editEntry(account, { kind: "in", preset });
      if (!button.dataset.plan) return;
      try {
        HOF.plans.collect(await HOF.api(`/api/workspace/plans/${encodeURIComponent(button.dataset.plan)}`));
      } catch (error) {
        HOF.toastError(error);
      }
    });
  }
  async function deleteEntry(account, entry) {
    const ok = await HOF.confirm({ title: "Hareketi Sil", message: `${money(entry.amount)} tutarındaki ${ENTRY_LABEL[entry.kind].toLocaleLowerCase("tr-TR")} silinecek; bakiye${entry.kind === "in" || entry.kind === "out" ? " ve Kasa" : ""} yeniden hesaplanır. ${HOF.trashHint()}`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      // Banka hesabına bağlı tahsilat silinince hesabın bakiyesi düşer: eksi bakiye sorusu (K7) "Yine de Sil" ile adrese eklenir.
      const path = `/api/workspace/accounts/${encodeURIComponent(account.id)}/entries/${encodeURIComponent(entry.id)}`;
      const send = flags => HOF.api(flags.negativeOk ? `${path}?negativeOk=1` : path, { method: "DELETE" });
      applyAccount(HOF.bank?.withConfirms ? await HOF.bank.withConfirms(send) : await send({}));
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
    // 2.4.3 (keşif A5): silinemeyen caride düğme pasiftir; yine de basılırsa (eski görünüm) onay sorulmadan nedeni söylenir.
    if (account.deleteBlock) return HOF.toast(account.deleteBlock, { type: "error" });
    const ok = await HOF.confirm({ title: "Cariyi Sil", message: `“${account.name}” silinecek. Hareketleri Kasa’dan düşer. ${HOF.trashHint()}`, confirmLabel: "Sil", danger: true });
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
      // v2.1.0 Aşama 5: banka hesabına bağlı hareketi ya da faturası olan cari silinmez; nedeni söylenir, Pasife Al önerilir.
      if (["account-bank-linked", "account-has-invoices"].includes(error?.data?.code) && account.status !== "passive") {
        const passive = await HOF.confirm({ title: "Cari Silinemez", message: error.message, confirmLabel: "Pasife Al", cancelLabel: "Vazgeç" });
        if (passive) await setStatus(account, "passive");
        return;
      }
      HOF.toastError(error);
    }
  }

  // ---------- Toplu taksitlendirme ----------
  // Ortak form (v2.0.11): Cari ekranındaki seçimden ve Taksitler › Cari Seç / + Toplu Taksitlendir penceresinden aynı
  // form ve aynı sunucu ucu (tek kural, çift kart açılmaz). Önce ön izleme: kaç kart açılacak, toplam, atlananlar ve
  // nedenleri; onaylanınca kartlar açılır.
  // selection: { ids: [...] } ya da { all: true, ...süzgeç }; count: seçilen cari; names: ilk adlar; fieldLabels: ek alanlar.
  function bulkPlanForm({ selection, count, names = [], fieldLabels = [], onDone = null }) {
    if (!count) return;
    const labels = fieldLabels;
    HOF.formModal({
      title: "Seçilenlere Taksit Planı",
      eyebrow: `${count.toLocaleString("tr-TR")} CARİ`,
      size: "wide",
      introHtml: `<p class="hof-modal-text">Her seçili cariye ayrı bir taksit kartı açılır ve taksitleri dağıtılır. Seçilenler: <b>${esc(names.slice(0, 6).join(", "))}${count > 6 ? ` ve ${(count - Math.min(6, names.length)).toLocaleString("tr-TR")} kişi daha` : ""}</b>. Kartlar açılmadan önce ön izleme gösterilir.</p>`,
      fields: [
        { name: "amountMode", label: "Tutar", type: "select", value: labels.length ? "field" : "fixed", options: [{ value: "fixed", label: "Herkese aynı toplam tutar" }, ...(labels.length ? [{ value: "field", label: "Her carinin kendi kartındaki alandan" }] : [])] },
        { name: "total", label: "Toplam Tutar (₺)", inputmode: "decimal", placeholder: "Örn. 12.000,00" },
        ...(labels.length ? [{ name: "field", label: "Tutarın Okunacağı Alan", type: "select", value: labels.find(label => /ücret|tutar|bedel|fiyat|borç/i.test(label)) || labels[0], options: labels.map(label => ({ value: label, label })), help: "Ör. Excel’den gelen “SERVİS ÜCRETİ”. Alanı boş olan cari atlanır ve raporda yazılır." }] : []),
        { name: "count", label: "Taksit Sayısı", required: true, inputmode: "numeric", placeholder: "Örn. 9" },
        { name: "firstDue", label: "İlk Vade", type: "date", required: true, value: office().todayIso?.() || "" },
        { name: "everyMonths", label: "Aralık", type: "select", value: "1", options: [{ value: "1", label: "Her Ay" }, { value: "2", label: "2 Ayda Bir" }, { value: "3", label: "3 Ayda Bir" }, { value: "6", label: "6 Ayda Bir" }, { value: "12", label: "Yılda Bir" }] },
        { name: "name", label: "Kart Adına Ek (isteğe bağlı)", maxlength: 60, placeholder: "Örn. 2026-2027 servis", help: "Yazılırsa kart adı “Ad Soyad · ek” olur." },
        { name: "skipExisting", label: "Açık taksit kartı olan cariyi atla (çift plan açılmasın)", type: "checkbox", value: true },
      ],
      submitLabel: "Ön İzle",
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
        const body = { ...selection, ...data, skipExisting: Boolean(data.skipExisting) };
        const reasons = report => [...new Set(report.skipped.map(item => item.reason))].join("; ");
        const preview = await HOF.api("/api/workspace/accounts/bulk-plan", { method: "POST", body: { ...body, dryRun: true } });
        if (!preview.created) throw new Error(`Açılacak kart yok: seçilen ${preview.skipped.length.toLocaleString("tr-TR")} cari atlanıyor (${reasons(preview)}).`);
        const every = { 1: "her ay", 2: "2 ayda bir", 3: "3 ayda bir", 6: "6 ayda bir", 12: "yılda bir" }[data.everyMonths] || "her ay";
        const ok = await HOF.confirm({
          title: "Taksit Kartları Açılsın mı?",
          message: `${preview.created.toLocaleString("tr-TR")} cariye taksit kartı açılacak (${preview.names.slice(0, 3).join(", ")}${preview.created > 3 ? "…" : ""}); toplam ${money(preview.total)}, ${data.count} taksit, ilk vade ${HOF.formatDate(data.firstDue)}, ${every}.${preview.skipped.length ? ` ${preview.skipped.length.toLocaleString("tr-TR")} cari atlanacak: ${reasons(preview)}.` : ""}`,
          confirmLabel: `${preview.created.toLocaleString("tr-TR")} Kartı Aç`,
        });
        if (!ok) return true; // form açık kalır; kullanıcı tutarı ya da vadeyi değiştirebilir
        const result = await HOF.api("/api/workspace/accounts/bulk-plan", { method: "POST", body });
        HOF.emit("plans-changed", {});
        HOF.dues?.reloadSoon?.(300);
        const skipped = result.skipped.length ? ` ${result.skipped.length} cari atlandı (${reasons(result)}).` : "";
        HOF.toast(`${result.created} taksit kartı açıldı, toplam ${money(result.total)}.${skipped}`, { type: result.created ? "success" : "error", timeout: 10000 });
        onDone?.(result);
      },
    });
  }
  function bulkPlan() {
    const all = view.selectAll;
    const count = selectedCount();
    const names = view.list.accounts.filter(item => isSelected(item.id)).map(item => item.name);
    bulkPlanForm({
      selection: all ? allSelection() : { ids: [...view.selected] },
      count,
      names,
      fieldLabels: view.list?.fieldLabels || [],
      onDone: () => {
        clearSelection();
        loadList();
      },
    });
  }

  // ---------- Excel'den toplu alım (2.0.18: açık tablodan alım kullanıcı kararıyla kalktı) ----------
  const ROLE_OPTIONS = [["", "— Kullanma —"], ["extra", "Ek Alan (kartta aynı adla)"], ["name", "Ad Soyad / Unvan *"], ["seq", "Cari No"], ["phone", "Telefon"], ["email", "E-Posta"], ["address", "Adres"], ["registered", "Kayıt Tarihi"], ["group", "Grup"], ["subgroup", "Alt Grup"], ["type", "Tür (müşteri/tedarikçi)"], ["balance", "Açılış Bakiyesi"], ["note", "Bilgi Notu"]];
  async function importFromExcel() {
    const source = await office().chooseSheet?.({ title: "Carileri Toplu Yükle", eyebrow: moduleName().toLocaleUpperCase("tr-TR"), hint: "Binlerce kişi ya da firma tek seferde açılır; taksit sorulmaz. Excel’deki her kolon kartta görünür. Kolonları bir sonraki adımda eşlersiniz." });
    if (!source) return;
    try {
      const preview = await HOF.api("/api/workspace/accounts/import/preview", { method: "POST", body: { matrix: source.matrix } });
      mappingForm({ fileName: source.fileName, matrix: source.matrix, preview });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Doğrulama kapısı (v2.0.6): eşleme değiştikçe sunucu satır bazlı raporu yeniler; hatalı satırlar alınmaz, uyarılılar alınır.
  const gateHtml = gate => {
    if (!gate) return "";
    const tone = gate.errors ? "is-error" : gate.warnings ? "is-warn" : "is-ok";
    const rows = gate.issues.slice(0, 30).map(issue => `<tr class="is-${esc(issue.level)}"><td>${issue.row}</td><td>${esc(issue.column)}</td><td>${esc(issue.problem)}</td><td>${esc(issue.value)}</td></tr>`).join("");
    return `<div class="hof-gate ${tone}"><div class="hof-gate-sum"><b>${gate.ready.toLocaleString("tr-TR")}</b> satır hazır${gate.errors ? ` · <b class="hof-cash-out">${gate.errors.toLocaleString("tr-TR")}</b> satır hatalı (alınmaz)` : ""}${gate.warnings ? ` · <b>${gate.warnings.toLocaleString("tr-TR")}</b> uyarı (alınır, raporlanır)` : ""}${gate.empty ? ` · ${gate.empty} boş satır` : ""}</div>${gate.issues.length ? `<details ${gate.errors ? "open" : ""}><summary>Satır Bazlı Rapor${gate.truncated ? ` (ilk ${gate.issues.length})` : ""}</summary><div class="hof-gate-list"><table class="hof-table"><thead><tr><th>Satır</th><th>Kolon</th><th>Sorun</th><th>Değer</th></tr></thead><tbody>${rows}</tbody></table>${gate.issues.length > 30 ? `<p class="hof-muted">… ${gate.issueTotal - 30} sorun daha; yükleme sonrası raporda tamamı sayılır.</p>` : ""}</div></details>` : ""}</div>`;
  };
  // extra (v2.0.22): ön izlemeye eklenecek alanlar (ör. Tür Değerleri seçimi) ve yeni ön izleme gelince çağrılacak işlev.
  const wireGate = (dialog, preview, matrix, url, { body: extraBody = () => ({}), onPreview = null, watch = "" } = {}) => {
    const box = HOF.el("div", { class: "hof-field hof-gate-field" }, gateHtml(preview.gate));
    dialog.querySelector(".hof-form .hof-actions").before(box);
    let timer = 0;
    dialog.addEventListener("change", event => {
      if (!event.target.closest(`select[name^="c"]${watch ? `, ${watch}` : ""}`)) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          const value = dialog.querySelector(`select[name="c${index}"]`)?.value;
          if (value) roles[index] = value;
        });
        try {
          const next = await HOF.api(url, { method: "POST", body: { matrix, roles, ...extraBody() } });
          box.innerHTML = gateHtml(next.gate);
          onPreview?.(next);
        } catch {
          // kapı yenilenemezse eski rapor kalır
        }
      }, 300);
    });
    return box;
  };
  // ---------- Tür Değerleri (v2.0.22) ----------
  // Excel denetimi bulgusu: Tür kolonunda "Müşteri/Tedarikçi" yazan satırlar sessizce Tedarikçi açılıyordu. Kolonları
  // Eşle ekranında Tür kolonundaki her farklı değer, programın okuması ve açılacak tür birlikte görünür; iki türü birden
  // yazan ya da tanınmayan değerin türünü kullanıcı seçer (seçmezse "Tür kolonu yoksa" alanındaki tür yazılır, raporlanır).
  const typeValuesHtml = (types, chosen) => {
    if (!types?.length) return "";
    const flag = item => (item.state === "ambiguous" ? ' <small class="hof-type-flag">İki Tür Birden</small>' : item.state === "unknown" ? ' <small class="hof-type-flag">Tanınmadı</small>' : "");
    const options = item => {
      const picked = chosen.has(item.key) ? chosen.get(item.key) : item.state === "ok" ? item.type : "";
      const value = picked === "default" ? "" : picked;
      return `<option value="" ${value ? "" : "selected"}>Varsayılan Tür</option>${Object.entries(TYPES).map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${esc(label)}</option>`).join("")}`;
    };
    const unclear = types.filter(item => item.state !== "ok").length;
    return `<span class="hof-field-label">Tür Değerleri</span>
      <p class="hof-muted">${unclear ? `<b class="hof-type-flag">${unclear} değer</b> iki türü birden içeriyor ya da tanınmadı; bu satırların türünü seçin. Seçmezseniz “Tür kolonu yoksa” alanındaki tür yazılır.` : "Tür kolonundaki değerler aşağıdaki türlerle açılır; gerekirse değiştirin."} Tür, açılış bakiyesinin yönünü de belirler.</p>
      <div class="hof-gate-list"><table class="hof-table"><thead><tr><th>Excel'deki Değer</th><th>Satır</th><th>Açılacak Tür</th></tr></thead><tbody>${types.map(item => `<tr class="${item.state === "ok" ? "" : "is-warning"}"><td>${esc(item.value)}${flag(item)}</td><td>${item.count.toLocaleString("tr-TR")}</td><td><select data-type-key="${esc(item.key)}" data-type-state="${esc(item.state)}" aria-label="${esc(item.value)}: Açılacak Tür">${options(item)}</select></td></tr>`).join("")}</tbody></table></div>`;
  };
  // Tanınan değer (ör. "Tedarikçi") için "Varsayılan Tür" seçilirse "default" gider: sunucu tanıdığı türü değil "Tür kolonu
  // yoksa" alanındaki türü yazar. İki türlü / tanınmayan değerde seçim yapılmadıysa hiçbir şey gitmez (uyarıyla varsayılan).
  const typeChoices = dialog => {
    const out = {};
    for (const select of dialog.querySelectorAll("select[data-type-key]")) {
      if (select.value) out[select.dataset.typeKey] = select.value;
      else if (select.dataset.typeState === "ok") out[select.dataset.typeKey] = "default";
    }
    return out;
  };
  function mappingForm({ fileName, matrix, preview }) {
    const sample = matrix[preview.headerAt + 1] || [];
    let form = null;
    HOF.formModal({
      title: "Excel’den Cari Yükle: Kolonları Eşle",
      eyebrow: fileName,
      size: "wide",
      intro: `${preview.rows} satır bulundu. Her satır bir cari olur; taksit sorulmaz. Program başlıkları tanıdı; yanlışsa değiştirin. <b>Ek Alan</b> seçilen her kolon kartta aynı adla görünür (ör. Veli, Okul, Servis ücreti) ve toplu taksitlendirmede tutar olarak kullanılabilir.`,
      fields: [
        ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, text]) => ({ value, label: text })) })),
        { name: "type", label: "Tür kolonu yoksa", type: "select", value: "customer", options: Object.entries(TYPES).map(([value, text]) => ({ value, label: text })) },
        { name: "mode", label: "Aynı cari zaten varsa", type: "select", value: "skip", options: [{ value: "skip", label: "Atla (eskisi olduğu gibi kalır)" }, { value: "update", label: "Güncelle (dolu gelen bilgiler yazılır)" }], help: "Aynı cari: aynı Cari No ya da aynı ad + aynı telefon. Emin olunamayan satır yeni cari açar." },
        { name: "groupName", label: "Grup kolonu yoksa hepsi bu gruba", maxlength: 80, placeholder: "İsteğe bağlı" },
        { name: "openingSide", label: "Açılış Bakiyesi Yönü", type: "select", value: "auto", options: OPENING_SIDES, help: "Türe göre: müşteride artı tutar Borçlu, tedarikçide artı tutar Alacaklı (tedarikçiye borcumuz). Eksi tutar ters yöndür." },
      ],
      submitLabel: "Carileri Oluştur",
      onOpen: dialog => {
        dialog.classList.add("hof-import-form");
        form = dialog;
        const typesBox = HOF.el("div", { class: "hof-field hof-gate-field hof-type-values" }, typeValuesHtml(preview.types, new Map()));
        typesBox.hidden = !preview.types?.length;
        const gate = wireGate(dialog, preview, matrix, "/api/workspace/accounts/import/preview", {
          watch: "select[data-type-key]",
          body: () => ({ typeMap: typeChoices(dialog) }),
          onPreview: next => {
            // Kullanıcının seçtikleri kolon değişse de korunur (aynı değer yeniden gelirse).
            const chosen = new Map(Object.entries(typeChoices(dialog)));
            HOF.swap(typesBox, typeValuesHtml(next.types, chosen));
            typesBox.hidden = !next.types?.length;
          },
        });
        gate.after(typesBox);
      },
      onSubmit: async data => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          if (data[`c${index}`]) roles[index] = data[`c${index}`];
        });
        if (!Object.values(roles).includes("name")) throw new Error("Ad Soyad / Unvan kolonunu seçin.");
        const typeMap = form ? typeChoices(form) : {};
        const result = await HOF.api("/api/workspace/accounts/import", { method: "POST", body: { matrix, headerAt: preview.headerAt, roles, type: data.type, typeMap, mode: data.mode, groupName: data.groupName, openingSide: data.openingSide || "auto", fileName } });
        view.status = "all";
        view.mode = "list";
        if (!modal) open();
        else {
          renderList();
          loadList();
        }
        const parts = [`${result.created} cari açıldı`];
        if (result.updated) parts.push(`${result.updated} güncellendi`);
        if (result.balances) parts.push(`${result.balances} açılış bakiyesi yazıldı`);
        if (result.truncated) parts.push(`${result.truncated} satır sınır dışı kaldı (tek seferde en çok 250.000 satır; kalanı ikinci yüklemede)`);
        if (result.renumbered) parts.push(`${result.renumbered} carinin numarası başka caride kullanıldığı için yeni numara verildi`);
        if (result.groups) parts.push(`${result.groups} grup tanımlandı`);
        // v2.0.22: türü belirsiz (iki tür birden / tanınmayan) satırlar varsayılan türle açıldıysa satır numaralarıyla söylenir.
        if (result.typeDefaultedTotal) parts.push(`${result.typeDefaultedTotal} carinin türü belirsizdi, ${TYPES[data.type] || "Müşteri"} olarak açıldı (satır ${result.typeDefaulted.slice(0, 8).map(item => item.row).join(", ")}${result.typeDefaultedTotal > 8 ? "…" : ""})`);
        const skipped = result.skipped.length ? ` ${result.skippedTotal || result.skipped.length} satır atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
        HOF.toast(`${parts.join(", ")}.${skipped}`, { type: result.created || result.updated ? "success" : "error", timeout: result.typeDefaultedTotal ? 20000 : 10000 });
      },
    });
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const check = event.target.closest("input[data-select], input[data-select-all]");
    if (check) {
      if (check.dataset.selectAll !== undefined) {
        view.selectAll = check.checked && Boolean(view.list?.hasMore);
        view.excluded.clear();
        for (const item of view.list?.accounts || []) check.checked ? view.selected.add(item.id) : view.selected.delete(item.id);
        return renderList();
      }
      // "Hepsi" seçiliyken tek kişinin işareti kaldırılırsa seçim hepsi eksi o kişi olur (yalnız ekrandakilere inmez).
      if (view.selectAll) check.checked ? view.excluded.delete(check.dataset.select) : view.excluded.add(check.dataset.select);
      else check.checked ? view.selected.add(check.dataset.select) : view.selected.delete(check.dataset.select);
      const bar = body()?.querySelector("[data-selbar]");
      if (bar) bar.outerHTML = selectBar();
      // Başlık kutusu: hepsi seçili → işaretli; hepsi eksi birkaçı → yarım (kısmi); yoksa ekrandakilere göre.
      const head = body()?.querySelector("input[data-select-all]");
      if (head) {
        const visible = view.list?.accounts || [];
        const some = visible.some(item => isSelected(item.id));
        const every = visible.length && visible.every(item => isSelected(item.id)) && !(view.selectAll && view.excluded.size);
        head.checked = Boolean(every);
        head.indeterminate = !every && some;
      }
      return;
    }
    if (event.target.closest(".hof-acc-check")) return;
    const invoiceLink = event.target.closest("[data-open-invoice]");
    if (invoiceLink) {
      event.preventDefault();
      modal.close();
      return HOF.invoices?.openDoc(invoiceLink.dataset.openInvoice);
    }
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
    if (act === "bulkPlan") return bulkPlan();
    if (act === "waStatement") return bulkWhatsapp("statement");
    if (act === "waMessage") return bulkWhatsapp("message");
    if (act === "more") return loadList({ more: true });
    if (act === "retryList") {
      view.listError = "";
      renderList();
      return loadList();
    }
    if (act === "clearSel") {
      clearSelection();
      return renderList();
    }
    if (!account) return;
    if (act === "reveal") {
      event.preventDefault();
      modal.close();
      return HOF.revealRecord?.(account.caseKey);
    }
    if (act === "edit") return editAccount(account);
    if (act === "doubtfulTake" || button.dataset.dbtAct || button.dataset.dbtProvDel || button.dataset.dbtWoDel) return onDoubtfulClick(button, account);
    if (act === "saleInvoice" || act === "purchaseInvoice") {
      modal.close();
      return HOF.invoices?.newFor({ side: act === "saleInvoice" ? "sale" : "purchase", account: { id: account.id, name: account.name } });
    }
    if (act === "allInvoices") {
      modal.close();
      return HOF.invoices?.forAccount({ id: account.id, name: account.name });
    }
    if (act === "passive") return setStatus(account, "passive");
    if (act === "activate") return setStatus(account, "active");
    if (act === "delete") return deleteAccount(account);
    if (act === "whatsapp") return HOF.whatsapp ? HOF.whatsapp.forAccount({ id: account.id, name: account.name, wa: button.dataset.wa }) : window.open(`https://wa.me/${button.dataset.wa}`, "_blank", "noopener");
    if (act === "newPlan") {
      modal.close();
      return HOF.plans?.openNew({ accountId: account.id, accountName: account.name, name: account.name, phone: account.phone, registeredOn: account.registeredOn || "", balance: Number(account.totals?.balance) || 0, groupId: account.groupId || "", subgroupId: account.subgroupId || "", caseKey: account.caseKey, caseTitle: account.caseTitle });
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
    // v2.0.22 (Excel denetimi): bir fatura 5–7 canlı olay yayımlar (fatura, cari, her stok kalemi, Kasa, taksit) ve ardından
    // ANLIK DURUM olayı gelir; açık Cari penceresi her birinde listeyi yeniden istiyordu (personel saniyede bir kayıt
    // girerken aramada her harf ~3 sn bekliyordu). Bütün olaylar tek yenileme kapısından geçer (HOF.refresher).
    const refreshOpen = HOF.refresher(() => {
      if (!modal) return null;
      if (view.mode === "card" && view.id) return loadAccount(view.id, { quiet: true });
      if (view.mode === "list") return loadList({ keep: true });
      return null;
    });
    HOF.on("live:workspace.changed", change => {
      if (!modal || !change) return;
      if (!["accounts", "plans", "stock"].includes(change.kind)) return;
      if (view.mode === "card" && view.id && change.kind === "accounts" && change.accountId && change.accountId !== view.id) return;
      refreshOpen();
    });
    HOF.on("plans-changed", () => modal && refreshOpen.now());
    // v2.0.11: carinin defterine yazan başka pencerelerdeki işlemler (Kasa, çek/senet, taksit, stok) açık Cari
    // penceresini de yeniler. Bu pencerenin kendi işlemleri zaten kendini yeniler.
    HOF.onLedger(["accounts", "cash", "plans", "stock", "cheques"], detail => {
      if (!modal || detail.path?.startsWith("/api/workspace/accounts")) return;
      if (detail.local) refreshOpen.now();
      else refreshOpen();
    }, 350);
  });
  HOF.office = Object.assign(HOF.office || {}, { gateHtml, wireGate });
  // 2.3.0 İz 5.5 Hızlı Arama: Cari listesi ve yeni cari / Excel'den yükleme (yetkiye göre).
  HOF.search?.register(() =>
    HOF.can("accounts.view")
      ? [
          { group: "Sayfa", label: `${moduleName()} Listesi`, path: moduleName(), keywords: ["Müşteri", "Tedarikçi", "Cari Kartları"], run: () => open() },
          ...(canManage()
            ? [
                { group: "İşlem", label: "Yeni Cari", path: moduleName(), keywords: ["Cari Aç", "Müşteri Ekle", "Tedarikçi Ekle"], run: () => editAccount(null, null, {}) },
                { group: "İşlem", label: "Cari Listesini Excel / Sheets'ten Yükle", path: moduleName(), keywords: ["Toplu Cari", "İçe Aktar"], run: () => { open(); return importFromExcel(); } },
              ]
            : []),
        ]
      : [],
  );
  HOF.accounts = {
    open,
    picker,
    bulkPlanForm,
    syncEntryHelp,
    doubtfulFromCheque,
    // 2.4.4 UX18: çek/senet formunun "Kapatılacak Fatura" seçenekleri (cari formundakiyle aynı liste ve kural).
    openInvoiceOptions,
    forCase: key => HOF.api(`/api/workspace/cases/${encodeURIComponent(key)}/account`),
    newFor: (preset, options = {}) => (canManage() ? editAccount(null, preset, options) : HOF.toast("Cari açmak yönetici, uzman ve muhasebe yetkisidir.", { type: "error" })),
    // 2.4.4 (uzman UX9): başka ekrandan (fatura formu) cariyi düzenleme — güncel hâl sunucudan okunur (sürüm denetimi UX1 bununla çalışır).
    editFor: async (accountId, options = {}) => {
      if (!canManage()) return HOF.toast("Cari düzenlemek yönetici, uzman ve muhasebe yetkisidir.", { type: "error" });
      try {
        return await editAccount(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(accountId)}`), null, options);
      } catch (error) {
        HOF.toastError(error);
      }
    },
    collect: async (accountId, preset = null) => {
      try {
        collect(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(accountId)}`), preset);
      } catch (error) {
        HOF.toastError(error);
      }
    },
    // 2.4.5 madde 6a: Tahsilat Takvimi / zildeki carinin ödenecek borç kalemi (account|…, yön out) → carinin "− Ödeme" formu (preset { amount, note }).
    pay: async (accountId, preset = null) => {
      try {
        await editEntry(await HOF.api(`/api/workspace/accounts/${encodeURIComponent(accountId)}`), { kind: "out", preset });
      } catch (error) {
        HOF.toastError(error);
      }
    },
  };
})();
