/* DestekOfis — Fatura (v2.0.15).
 * Satış, alış, satıştan/alıştan iade ve serbest meslek makbuzu. Akış: önce senaryo seçilir (Stoktan Satış, Hizmet
 * Satışı, Serbest Meslek Makbuzu, Satıştan İade / Stoğa Mal Alışı, Hizmet ve Gider Alışı, Alıştan İade), sonra form:
 * cari, tarih-saat, kalemler (ürün araması, bu cariye ve başka carilere son fiyat), KDV dahil/hariç, iskonto, tevkifat,
 * stopaj, döviz, not; ödeme (peşin: nakit/banka/kart, çek/senet, ciro, kalanı açık hesap ya da taksit). Toplamlar
 * sunucunun hesap motorundan gelir (deftere yazılanla aynı). Kesilince stok, cari, Kasa, çek/senet ve taksit kartı tek
 * işlem bloğunda yazılır; kesilmiş belge düzeltilmez: iptal edilir ya da iade kesilir.
 * e-Belge bağlantısı kapalıyken (varsayılan) belge "Müşteri Fişi" olarak basılır; e-Fatura/e-Arşiv düğmeleri görünmez. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let modal = null;
  let meta = null;
  const lists = HOF.listGate();
  let calcTicket = 0;
  let calcTimer = 0;
  // v2.0.23 (gözden geçirme): bekleyen (zamanlanmış) ve süren hesap; "Tamamı Peşin" güncel toplamla çalışsın.
  let calcPending = false;
  let calcRunning = null;
  const view = { mode: "list", tab: "sale", q: "", from: "", to: "", preset: "", pay: "", profile: "", account: null, list: null, selected: new Set(), id: "", doc: null, form: null, pickSide: "", inbox: null, inboxState: "new", inboxItem: null, settings: null };

  const money = value => HOF.formatMoney(value);
  const moduleName = () => HOF.uiLabel?.("side.invoices", "Fatura") || "Fatura";
  const canView = () => HOF.can("invoices.view");
  const canManage = () => HOF.can("invoices.manage");
  const canSettings = () => HOF.can("invoices.settings");
  const edoc = () => meta?.edocEnabled === true;
  // 2.4.4 E7 "e-Fatura Portalı": entegratörün web portalı ekran boyunda AYRI pencerede (kullanıcının kendi tarayıcı profili: "Beni Hatırla" ve
  // tarayıcının parola kaydı kalıcıdır). Adres yalnız sunucudan gelir (meta.settings.integrator.portal; sabit liste, Çalışma Ortamı'na göre);
  // istemci adres seçmez/yazmaz. Program portala giriş yapmaz: kullanıcı adı/parola istemciye gelmez, giriş sayfasındaki insan doğrulamasına
  // (Turnstile) dokunulmaz. Çerçeve yok (portal X-Frame-Options SAMEORIGIN). Engel varsa düğme pasif, nedeni yanında yazar.
  const PORTAL_WINDOW = "hof-edm-portal";
  const portalInfo = () => meta?.settings?.integrator?.portal || null;
  const portalUrlOk = url => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(String(url || ""));
  const portalButton = () => {
    if (!edoc()) return "";
    const portal = portalInfo();
    if (portal?.url && portalUrlOk(portal.url)) return `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="portal" title="EDM portalı ekran boyunda ayrı pencerede açılır; ilk girişte kullanıcı adı ve parolanızı EDM'nin sayfasına bir kez yazın, Beni Hatırla'yı işaretleyin">e-Fatura Portalı</button>`;
    const why = portal?.block || "e-Fatura Portalı şu an açılamıyor; sayfayı yenileyin.";
    return `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="portal" disabled aria-describedby="hof-inv-portal-why">e-Fatura Portalı</button><small class="hof-inv-portal-why" id="hof-inv-portal-why" data-portal-why>${esc(why)}</small>`;
  };
  // Entegratör Ayarları kaydedilince (ortam / bağlantı değişir) arkadaki listenin düğmesi yerinde yenilenir; liste yeniden çizilmez.
  function refreshPortalButton() {
    const current = body()?.querySelector('.hof-plan-actions [data-act="portal"]');
    if (!current) return;
    current.parentElement.querySelector("[data-portal-why]")?.remove();
    current.outerHTML = portalButton();
  }
  function portalBlocked(url) {
    const modal = HOF.modal({
      title: "e-Fatura Portalı Açılamadı",
      eyebrow: "FATURA",
      body: `<p>Tarayıcı açılır pencereyi engelledi. Portalı aşağıdaki bağlantıyla yeni sekmede açabilirsiniz; ayrı pencere için adres çubuğundaki engel simgesinden bu programa açılır pencere izni verin.</p><p><a class="hof-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-portal-link>e-Fatura Portalını Aç</a></p>`,
    });
    modal.dialog.querySelector("[data-portal-link]")?.addEventListener("click", () => modal.close());
    return modal;
  }
  function openPortal() {
    const portal = portalInfo();
    const url = portal?.url || "";
    if (!portalUrlOk(url)) return HOF.toast(portal?.block || "e-Fatura Portalı adresi alınamadı; sayfayı yenileyin.", { type: "error" });
    const width = Math.round(Number(window.screen?.availWidth) || 1280);
    const height = Math.round(Number(window.screen?.availHeight) || 800);
    const features = `popup=yes,left=0,top=0,width=${width},height=${height}`;
    let win = null;
    try {
      win = window.open("", PORTAL_WINDOW, features);
    } catch {
      win = null;
    }
    if (!win) return portalBlocked(url);
    // Yeni (boş) pencere: önce opener bağı kesilir (portal sayfası programın penceresine erişemez), sonra portal adresi yüklenir. Program
    // Cross-Origin-Opener-Policy: same-origin ile sunulduğundan tarayıcı da başka kaynaklı pencereyle bağı keser; açık portal penceresi adıyla
    // bulunamaz → her tıklama yeni portal penceresi açar (BİLİNEN SINIR; oturum çerezi aynı profilde olduğundan yeniden giriş istenmez).
    let blank = false;
    try {
      blank = win.location.href === "about:blank";
    } catch {
      blank = false;
    }
    if (blank) {
      try {
        win.opener = null;
      } catch {}
      win.location.replace(url);
    }
    try {
      win.focus();
    } catch {}
    return win;
  }
  // 2.4.3 (uzman UX3): meta (sunucunun bugünü) yalnız pencere açılışında yüklenir; pencere gece yarısını geçince yeni form DÜNÜN tarihini
  // alıyordu (31.12 23:56'da açılan pencerede 01.01 00:01'de kesilen fatura 31.12 tarihli). Yerel gün meta yüklendiğinden beri değiştiyse
  // sunucunun bugünü aynı gün farkıyla ilerletilir (sunucu–tarayıcı saat dilimi farkı korunur; tek makinede ikisi aynıdır).
  let metaLocal = "";
  const shiftIso = (iso, days) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const todayIso = () => {
    const local = HOF.localToday();
    if (!meta?.today) return HOF.office?.todayIso?.() || local;
    if (!metaLocal || metaLocal === local) return meta.today;
    return shiftIso(meta.today, Math.round((Date.parse(`${local}T00:00:00Z`) - Date.parse(`${metaLocal}T00:00:00Z`)) / 86400000));
  };
  const body = () => modal?.dialog.querySelector("[data-invoices]");
  const office = () => HOF.office || {};
  const num = value => {
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const clean = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const n = Number(clean.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  // v2.0.23 (gözden geçirme): ödeme tutarı sunucunun parseAmount'ıyla (server/lib/money.mjs) aynı okunur: "1.250,50",
  // "40.000 TL", "₺ 3.000", "1250.5". Eskiden "40.000" 40 okunuyor (Kalan yanlış), "100 TL" reddediliyordu.
  const parseTl = value => {
    let raw = String(value ?? "").trim().replace(/[₺$€\s]|tl|try/gi, "");
    if (!raw) return Number.NaN;
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
    return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : Number.NaN;
  };
  const amountNum = value => {
    const n = parseTl(value);
    return Number.isFinite(n) ? n : 0;
  };
  const amountText = value => (value === "" || value === null || value === undefined ? "" : String(value).replace(".", ","));
  // 2.4.4 (uzman UI9): kalemin Birim Fiyat kutusu programın doldurduğu her yolda (ürün seçimi, fiyat ipucu, Düzenle / Kopyala, Netten Brüte)
  // para biçiminde: "1.249,90" (binlik ayraç, en az 2, en çok 4 ondalık). Önceden "1249,9" yazıyor, hemen altındaki çip "₺1.249,90" diyordu.
  // Okuma aynı: istemci parseTl, sunucu parseAmount "1.249,90"ı 1249,9 okur. Miktar ve öbür tutar kutuları değişmez.
  const PRICE_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const priceText = value => {
    if (value === "" || value === null || value === undefined) return "";
    const n = typeof value === "number" ? value : parseTl(value);
    return Number.isFinite(n) ? PRICE_FORMAT.format(n) : String(value);
  };
  const curMoney = (value, currency = "TRY") => (currency === "TRY" ? money(value) : `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`);
  const kindLabel = kind => meta?.kinds?.[kind]?.label || kind;
  const sideOf = kind => meta?.kinds?.[kind]?.side || (["purchase", "purchase_return"].includes(kind) ? "purchase" : "sale");
  const isReturn = kind => Boolean(meta?.kinds?.[kind]?.return);
  const isOwn = kind => Boolean(meta?.kinds?.[kind]?.own);

  async function loadMeta(force = false) {
    if (meta && !force) return meta;
    meta = await HOF.api("/api/workspace/invoices/meta");
    metaLocal = HOF.localToday();
    return meta;
  }

  // ---------- Pencere ----------
  async function open({ id = "", tab = "", account = null, scenario = "", side = "", originalId = "" } = {}) {
    if (!canView()) return HOF.toast("Fatura ekranı fatura yetkisi olan hesaplara açıktır.", { type: "error" });
    if (!modal) {
      modal = HOF.modal({
        title: moduleName(),
        eyebrow: "OPERASYON",
        size: "wide",
        body: '<div class="hof-plans hof-invoices" data-invoices><p class="hof-empty">Yükleniyor…</p></div>',
        onClose: () => {
          modal = null;
          clearTimeout(calcTimer);
          calcPending = false;
          Object.assign(view, { mode: "list", id: "", doc: null, form: null, inboxItem: null, settings: null });
        },
      });
      modal.dialog.classList.add("hof-invoices-modal");
      modal.dialog.addEventListener("click", onClick);
      modal.dialog.addEventListener("change", onChange);
      modal.dialog.addEventListener("input", onInput);
      modal.dialog.addEventListener("keydown", onKey);
      // v2.2.0 (İz 2.4): peşin satırdaki "Banka Hesabı / Kredi Kartı Tanımla" ile kaydedilen hesap o satırda seçili gelir.
      modal.dialog.addEventListener("hof-bank-defined", onBankDefined);
      // Öneri listesi: tıklanırken yazılan kutu odağı kaybetmesin; kutudan çıkınca kapanır; pencere kayınca yer değiştirir.
      modal.dialog.addEventListener("mousedown", event => {
        if (event.target.closest(".hof-inv-item-hits")) event.preventDefault();
      });
      modal.dialog.addEventListener("focusout", event => {
        if (event.target.matches?.('[data-f="name"], [data-f="code"]')) setTimeout(() => {
          const active = document.activeElement;
          if (!active?.matches?.('[data-f="name"], [data-f="code"]')) hideHits();
        }, 0);
      });
      modal.dialog.addEventListener("scroll", () => placeOpenHits(), true);
      window.addEventListener("resize", () => placeOpenHits());
    }
    try {
      await loadMeta(true);
      if (meta.repeated) HOF.toast(`${meta.repeated} tekrarlayan fatura taslağı hazırlandı; Taslaklar sekmesinde.`, { type: "info", timeout: 7000 });
    } catch (error) {
      if (body()) body().innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      return;
    }
    if (account !== null) view.account = account && account.id ? account : null;
    if (tab) view.tab = tab;
    if (id) return loadDoc(id);
    if (originalId) return startReturn(originalId);
    if (scenario) return startForm({ scenario, account });
    if (side) return showPick(side, account);
    showList();
  }
  // 2.4.3 (form durumu izole): pencere içindeki form (fatura formu, Fatura Ayarları) kendi kapsamıdır; içinde kaydedilmemiş değişiklik
  // varken Esc / × / dışına tıklama sorar. Kapsam her formda yenidir; kaydedip karta / listeye geçince kalkar.
  let formScope = 0;
  const setMode = mode => {
    view.mode = mode;
    modal?.dialog.classList.toggle("is-form", mode === "form");
    const root = body();
    if (!root) return;
    if (mode === "form" || mode === "settings") root.setAttribute("data-hof-form", `${mode}-${++formScope}`);
    else root.removeAttribute("data-hof-form");
  };
  function showList() {
    setMode("list");
    view.id = "";
    view.doc = null;
    view.form = null;
    if (view.tab === "inbox") return loadInbox();
    renderList();
    loadList();
  }

  // ---------- Liste ----------
  const TABS = [
    ["sale", "Satış Faturaları"],
    ["purchase", "Alınan"],
    ["returns", "İadeler"],
    ["drafts", "Taslaklar"],
    ["cancelled", "İptal Edilenler"],
    ["all", "Tümü"],
  ];
  const PAY_OPTIONS = [
    ["", "Tüm Ödeme Durumları"],
    ["open", "Açık (ödenmemiş)"],
    ["overdue", "Vadesi Geçti"],
    ["partial", "Kısmen Ödendi"],
    ["paid", "Ödendi"],
  ];
  const PRESETS = [
    ["month", "Bu Ay"],
    ["last", "Geçen Ay"],
    ["year", "Bu Yıl"],
    ["", "Tüm Zamanlar"],
  ];
  const presetRange = preset => {
    const today = todayIso();
    const [y, m] = today.split("-").map(Number);
    const pad = n => String(n).padStart(2, "0");
    const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    if (preset === "month") return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay(y, m))}`];
    if (preset === "last") {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return [`${ly}-${pad(lm)}-01`, `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}`];
    }
    if (preset === "year") return [`${y}-01-01`, `${y}-12-31`];
    return ["", ""];
  };
  const listParams = (extra = {}) =>
    new URLSearchParams(Object.fromEntries(Object.entries({ tab: view.tab, q: view.q, from: view.from, to: view.to, pay: view.pay, profile: view.profile, account: view.account?.id || "", ...extra }).filter(([, value]) => value !== "" && value !== undefined && value !== null))).toString();

  // 2.1.0 (bağımsız inceleme H4): Daha Fazla ile arka plan yenilemesi çakışınca yanıt yalnız isteğin gittiği listeye eklenir (HOF.listGate
  // retry); arka plan yenilemesi Daha Fazla ile açılan satırları korur (önceden ilk 200'e dönüyordu).
  // 2.4.3 H5 (fatura yükte hız testi): yükte başka personelin her kaydı açık listeyi arka planda yeniler (en sık 1,5 sn'de bir); her yenileme
  // yazıldığında sürmekte olan "Daha Fazla"nın yanıtı eskir ve kapı onu yeniler — üç denemede de araya yenileme girince tıklama sessizce
  // kayboluyordu (30 sn bekleme; test/e2e/fatura-243-daha-fazla-yaris.mjs ile zorla üretildi). Daha Fazla sürerken yeni arka plan yenilemesi
  // başlatılmaz; bekletilir ve Daha Fazla bitince yapılır (değişiklik kaçmaz). O an zaten sürmekte olan yenileme yalnız ilk denemeyi eskitir.
  let moreBusy = 0;
  let refreshHeld = null;
  function loadList(more = false, options = {}) {
    if (options.quiet && !more && moreBusy) {
      if (!refreshHeld) {
        let release;
        refreshHeld = { promise: new Promise(resolve => (release = resolve)), release };
      }
      return refreshHeld.promise;
    }
    if (!more) return HOF.listRetry(() => loadListOnce(more, options));
    moreBusy += 1;
    return HOF.listRetry(() => loadListOnce(true, options)).finally(() => {
      moreBusy -= 1;
      const held = moreBusy ? null : refreshHeld;
      if (!held) return;
      refreshHeld = null;
      // Bekletilen yenileme şimdi; yenileyicinin (HOF.refresher) beklediği söz onun bitişiyle (hatasıyla da) tamamlanır.
      held.release(view.mode === "list" ? HOF.listRetry(() => loadListOnce(false, { quiet: true })) : null);
    });
  }
  async function loadListOnce(more = false, { quiet = false } = {}) {
    // Sıra kuralları HOF.listGate'te (v2.0.22); arka plan yenilemesi en çok 2 bağlantılık arka plan kuyruğundan gider.
    const load = lists.start({ quiet, more });
    if (!load) return false;
    if (!quiet && !more && view.listError) {
      view.listError = "";
      if (!view.list && view.mode === "list") renderList();
    }
    try {
      const offset = more && view.list ? view.list.invoices.length : 0;
      const limit = quiet && view.list ? Math.min(5000, Math.max(200, view.list.invoices.length)) : 200;
      const data = await HOF.api(`/api/workspace/invoices?${listParams({ offset, limit })}`, quiet ? { background: true } : {});
      if (!load.current()) return load.retry();
      load.applied();
      view.listError = "";
      view.list = more && view.list ? { ...data, invoices: [...view.list.invoices, ...data.invoices] } : data;
      if (view.mode === "list") renderList();
    } catch (error) {
      if (quiet) throw error;
      if (!load.current()) return;
      if (more && view.list) return HOF.toastError(error);
      // Yeni süzgeç yüklenemedi: eski satırlar ve seçim yeni süzgecin altında kalmaz.
      view.list = null;
      view.selected.clear();
      view.listError = error.message;
      if (view.mode === "list") renderList();
    } finally {
      load.done();
    }
  }
  const statusPill = doc => {
    if (doc.status === "draft") return '<span class="hof-inv-pill is-draft">Taslak</span>';
    if (doc.status === "cancelled") return '<span class="hof-inv-pill is-cancelled">İptal Edildi</span>';
    const pay = doc.payState ? `<span class="hof-inv-pill is-${esc(doc.payState)}">${esc(doc.payStateLabel)}</span>` : "";
    // 2.4.3 (H1): numara almış, entegratöre ulaşmamış belge de rozetle görünür (Gönderilmedi / Sonucu Belirsiz).
    const e = edoc() && (doc.profile !== "KAGIT" || doc.eStatus === "withdrawn") && ((doc.eStatus && doc.eStatus !== "none") || doc.eUnsent || doc.eTestLive) ? `<span class="hof-inv-pill is-e-${esc(doc.eStatus || "none")}" title="${doc.eTestLive ? "Test serisi canlıda gönderilmez; İptal Edin" : "e-Belge durumu"}">${esc(doc.eStatusLabel || "Gönderilmedi")}</span>` : "";
    // Entegratörün test ortamına giden belge (seri TEF / TEA / TES): yasal geçerliliği yok.
    const test = doc.eTest ? '<span class="hof-inv-pill is-e-test" title="Entegratörün test ortamında denenen belge; yasal geçerliliği yoktur">Test</span>' : "";
    return `${pay}${e}${test}`;
  };
  const docTitle = doc => `${kindLabel(doc.kind)}${doc.displayNo ? ` ${doc.displayNo}` : ""}`;
  // 2.4.4 (uzman UX25): "Belge Türü" süzgecinde e-SMM yalnız e-SMM açıkken (sunucu: config.esmmEnabled ve Entegratör Ayarları'nda
  // "e-SMM kullanıcısıyım" → meta.settings.esmm) görünür; kapalı özellik seçenek olarak çıkmaz. Seçili kalmış süzgeç (eski adres) görünür kalır.
  const profileOptions = () => Object.entries(meta.profiles || {}).filter(([id]) => id !== "ESMM" || meta?.settings?.esmm === true || view.profile === "ESMM");
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const t = data?.totals;
    const counts = data?.tabCounts || {};
    // e-Belge açıkken: "Gönderilecekler" (kesilmiş, entegratöre sonra gönderilecek) ve gelen kutusu.
    const tabs = edoc() ? [TABS[0], ["pending", "Gönderilecekler"], ...TABS.slice(1), ["inbox", "Gelen e-Faturalar"]] : TABS;
    const rows = (data?.invoices || [])
      .map(doc => {
        const checked = view.selected.has(doc.id);
        const foreign = doc.currency !== "TRY" ? `<small>${esc(curMoney(doc.payableTotal, doc.currency))}</small>` : "";
        return `<tr data-inv="${esc(doc.id)}" tabindex="0" class="is-${esc(doc.status)}${checked ? " is-selected" : ""}">
          <td class="hof-inv-check"><input type="checkbox" data-sel="${esc(doc.id)}" ${checked ? "checked" : ""} aria-label="Seç"></td>
          <td>${esc(HOF.formatDate(doc.issueDate))}<small>${esc(doc.issueTime || "")}</small></td>
          <td><b>${esc(doc.displayNo || "—")}</b><small>${esc(kindLabel(doc.kind))}</small></td>
          <td><b>${esc(doc.accountName || "—")}</b><small>${esc(doc.scenarioLabel || "")}${doc.originalNumber ? ` · ${esc(doc.originalNumber)} iadesi` : ""}</small></td>
          <td>${statusPill(doc)}</td>
          <td class="num"><b>${esc(money(doc.tryPayable))}</b>${foreign}</td>
          <td class="num">${doc.status === "issued" && doc.open > 0.004 ? esc(money(doc.open)) : "—"}</td>
        </tr>`;
      })
      .join("");
    const selected = view.selected.size;
    const selIds = [...view.selected].join(",");
    const tile = (label, value, tone = "", note = "") => `<div class="hof-rep-stat ${tone}"><span>${esc(label)}</span><strong>${esc(money(value || 0))}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`;
    const accountChip = view.account ? `<span class="hof-inv-filter-chip">Cari: <b>${esc(view.account.name)}</b><button type="button" data-act="clear-account" aria-label="Cari süzgecini kaldır" title="Cari süzgecini kaldır">×</button></span>` : "";
    HOF.swap(
      root,
      `<div class="hof-plan-head">
        <div class="hof-plan-title"><small>${edoc() ? "Satış, alış ve iade faturaları; e-Fatura ve e-Arşiv entegratör üzerinden gönderilir." : "Kaydedilen belgeler resmî hükmü olmayan <b>Müşteri Fişi</b> olarak basılır; e-Fatura / e-Arşiv bağlantısı kapalı."}</small></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Fatura işlemleri">
          ${canManage() ? '<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Fatura</button>' : ""}
          ${edoc() && canManage() && view.tab === "pending" && (pendingTotal(data) || view.sendProgress) ? sendPendingButton(data) : ""}
          ${canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="settings">Fatura Ayarları</button>' : ""}${edoc() && canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="integrator">Entegratör Ayarları</button>' : ""}
          <span class="hof-rep-export" role="group" aria-label="Dışa aktar">${HOF.outputButton({ kind: "pdf", href: `/api/workspace/invoices/liste.pdf?${listParams()}`, what: "Fatura Listesi", attrs: 'target="_blank" rel="noopener"' })}${HOF.outputButton({ kind: "xlsx", href: `/api/workspace/invoices/export.xlsx?${listParams()}`, what: "Fatura Listesi", attrs: "download" })}</span>${portalButton()}
        </div></div>
      <div class="hof-inv-tabs" role="tablist" aria-label="Fatura listeleri">${tabs.map(([id, label]) => `<button type="button" role="tab" class="hof-rep-chip ${view.tab === id ? "is-on" : ""}" aria-selected="${view.tab === id}" data-tab="${id}">${label}${id !== "inbox" && counts[id] ? ` <b>${counts[id].toLocaleString("tr-TR")}</b>` : ""}</button>`).join("")}</div>
      ${restoreBanner(data)}
      ${t ? `<div class="hof-rep-stats">${tile("Toplam (KDV Dahil)", t.payable, "", `${t.issued.toLocaleString("tr-TR")} belge`)}${tile("KDV", t.vat)}${tile("Açık Bakiye", t.open, t.open > 0 ? "is-receivable" : "")}${tile("Vadesi Geçmiş", t.overdue, t.overdue > 0 ? "is-payable" : "")}</div>` : ""}
      <div class="hof-plans-filters hof-chq-filters hof-inv-filters">
        <div class="hof-rep-presets" role="group" aria-label="Tarih">${PRESETS.map(([id, label]) => `<button type="button" class="hof-rep-chip ${view.preset === id && (id || (!view.from && !view.to)) ? "is-on" : ""}" data-preset="${id}">${label}</button>`).join("")}</div>
        <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-filter="from" value="${esc(view.from)}"></label>
        <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-filter="to" value="${esc(view.to)}"></label>
        <select data-filter="pay" aria-label="Ödeme durumu">${PAY_OPTIONS.map(([id, label]) => `<option value="${id}" ${view.pay === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        ${edoc() ? `<select data-filter="profile" aria-label="Belge türü"><option value="">Tüm Belge Türleri</option>${profileOptions().map(([id, label]) => `<option value="${id}" ${view.profile === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>` : ""}
        <input type="search" data-filter="q" value="${esc(view.q)}" placeholder="No, cari, ürün, VKN, not ara…" aria-label="Ara">
        ${accountChip}
      </div>
      <div class="hof-acc-selbar${selected ? " is-active" : ""}"><span>${selected ? `<b>${selected.toLocaleString("tr-TR")}</b> belge seçildi` : canManage() ? "Toplu yazdırmak, kaydetmek, iptal etmek ya da silmek için satırları işaretleyin." : "Toplu yazdırmak için satırları işaretleyin."}</span>${sendSelectedButton()}${selected ? `${HOF.outputButton({ kind: "pdf", href: `/api/workspace/invoices/toplu.pdf?ids=${selIds}`, label: "Seçilenleri PDF", tip: "Seçilen belgeler tek PDF dosyasında açılır", attrs: 'target="_blank" rel="noopener"' })}${HOF.outputButton({ kind: "xlsx", href: `/api/workspace/invoices/export.xlsx?ids=${selIds}`, label: "Seçilenleri Excel", tip: "Seçilen belgeler Excel dosyası olarak iner", attrs: "download" })}${edoc() ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/ubl.zip?ids=${esc(selIds)}" download>e-Belge XML (ZIP)</a>` : ""}${canManage() && selectedBy("draft").length ? `<button type="button" class="hof-button hof-button-small" data-act="bulk-issue">Seçilenleri Kaydet (${selectedBy("draft").length})</button>` : ""}${canManage() && selectedBy("issued").length ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="bulk-cancel">Seçilenleri İptal Et (${selectedBy("issued").length})</button>` : ""}${canManage() ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="bulk-delete" title="Seçilen belgeler Silinenler'e gider; kaydedilmiş belgenin etkileri iptaldeki gibi geri alınır">Seçilenleri Sil (${selected})</button>` : ""}<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="clear-sel">Seçimi Temizle</button>` : ""}</div>
      ${
        data
          ? `<div class="hof-rep-table"><table class="hof-table hof-chq-table hof-inv-table"><thead><tr><th class="hof-inv-check"><input type="checkbox" data-sel-all aria-label="Listedekilerin hepsini seç" ${data.invoices.length && data.invoices.every(doc => view.selected.has(doc.id)) ? "checked" : ""}></th><th>Tarih</th><th>No</th><th>Cari</th><th>Durum</th><th class="num">Tutar</th><th class="num">Açık</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="hof-empty">${emptyText()}</td></tr>`}</tbody></table></div>
        <p class="hof-rep-note">${data.total.toLocaleString("tr-TR")} belge${data.hasMore ? ` · <button type="button" class="hof-link-button" data-act="more">Daha Fazla Göster</button>` : ""}</p>`
          : HOF.listPending(view.listError)
      }`,
    );
  }
  // 2.4.4 (madde 30b, kullanıcı kararı 22.10.2026): yedek geri yüklendikten sonra TEK SEFERLİK uyarı (yalnız geri yüklenen şirkette; sunucu
  // restoreNotice). Numaralama değişmez; kullanıcı sıradaki numarayı elle ileri alır. Fatura Ayarları yetkisi olan kapatır, kapatılınca bir daha çıkmaz.
  function restoreBanner(data) {
    const notice = data?.restoreNotice;
    if (!notice) return "";
    const when = notice.backupAt ? ` (yedek tarihi: ${esc(HOF.formatDateTime(notice.backupAt))})` : "";
    const textOf = notice.edoc
      ? `Yedek geri yüklendi${when}. Yedekten sonra EDM'ye gönderilmiş e-Belge'ler ve verilmiş kâğıt/fiş numaraları programda yeniden verilebilir; EDM aynı numarayı reddeder. Göndermeden önce Fatura Ayarları → Numaralar'dan sıradaki numarayı EDM'deki ve elinizdeki son numaranın ilerisine alın.${notice.test ? " Test Ortamı'nda e-Belge numarası Entegratör Ayarları → Otomatik Seriler'den ileri alınır." : ""}`
      : `Yedek geri yüklendi${when}. Yedekten sonra verilmiş kâğıt/fiş numaraları programda yeniden verilebilir. Yeni belge kaydetmeden önce Fatura Ayarları → Numaralar'dan sıradaki numarayı elinizdeki son numaranın ilerisine alın.`;
    const tail = notice.canDismiss ? "" : " Sıradaki numarayı Fatura Ayarları yetkisi olan kullanıcı ileri alır ve bu uyarıyı kapatır.";
    return `<div class="hof-inv-banner is-warn" data-restore-notice role="status"><span>${textOf}${tail}</span>${notice.canDismiss ? `<span class="hof-inv-banner-actions">${canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="settings">Fatura Ayarları</button>' : ""}<button type="button" class="hof-button hof-button-small" data-act="restore-notice-dismiss" data-at="${esc(notice.at)}">Uyarıyı Kapat</button></span>` : ""}</div>`;
  }
  async function dismissRestoreNotice(button) {
    button.disabled = true;
    try {
      const result = await HOF.api("/api/workspace/invoices/restore-notice/dismiss", { method: "POST", body: { at: button.dataset.at || "" } });
      if (view.list) view.list.restoreNotice = result.restoreNotice || null;
      renderList();
      // 31f U7c: düğme yeniden çizimle kalkar; odak BODY'ye düşmesin — listenin ilk işine ("+ Yeni Fatura"; yoksa arama kutusu).
      const root = body();
      focusNode(root?.querySelector('[data-act="new"]')) || focusNode(root?.querySelector('[data-filter="q"]'));
    } catch (error) {
      button.disabled = false;
      HOF.toast(error.message, { type: "error" });
    }
  }
  // Seçili belgelerden listede o durumda olanlar (toplu kesme yalnız taslak, toplu iptal yalnız kesilmiş belge).
  const selectedBy = status => (view.list?.invoices || []).filter(doc => view.selected.has(doc.id) && doc.status === status);
  const emptyText = () => {
    if (view.q || view.from || view.pay || view.profile || view.account) return "Bu süzgeçte belge yok.";
    return {
      sale: canManage() ? "Henüz satış faturası yok. “+ Yeni Fatura” ile başlayın." : "Henüz satış faturası yok.",
      purchase: "Henüz alış faturası girilmedi.",
      returns: "İade faturası yok.",
      drafts: "Taslak yok. Taslak olarak kaydedilen (deftere işlenmeyen) faturalar burada durur.",
      cancelled: "İptal edilen belge yok.",
      all: "Henüz belge yok.",
    }[view.tab];
  };

  // ---------- Senaryo seçimi ----------
  // Kullanıcı önce ne yapacağını seçer (müşterinin isteği): Satış ya da Alış altında hazır senaryolar.
  function showPick(side = "", account = null) {
    if (!canManage()) return HOF.toast("Fatura kaydetme yetkiniz yok.", { type: "error" });
    setMode("pick");
    view.pickSide = side;
    if (account?.id) view.pickAccount = account;
    else view.pickAccount = null;
    const root = body();
    if (!root) return;
    const card = (id, item) => `<button type="button" class="hof-inv-scenario${(item.kind === "sale" && meta.settings.defaults.saleScenario === id) || (item.kind === "purchase" && meta.settings.defaults.purchaseScenario === id) ? " is-default" : ""}" data-scenario="${id}"><b>${esc(item.label)}</b><small>${esc(item.hint || "")}</small></button>`;
    const group = (s, title) => {
      const items = Object.entries(meta.scenarios).filter(([, item]) => item.side === s);
      return `<section class="hof-inv-pick-group is-${s}"><h4>${title}</h4><div class="hof-inv-scenarios">${items.map(([id, item]) => card(id, item)).join("")}</div></section>`;
    };
    HOF.swap(
      root,
      `<div class="hof-plan-head"><div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
        <div class="hof-plan-title"><h3>Yeni Fatura: Ne Yapacaksınız?</h3><small>${view.pickAccount ? `Cari: <b>${esc(view.pickAccount.name)}</b> · ` : ""}Senaryoyu seçin; form ona göre açılır (stok, cari, KDV ve ödeme kuralları senaryodan gelir).</small></div></div></div>
      <div class="hof-inv-pick">${side !== "purchase" ? group("sale", "Satış") : ""}${side !== "sale" ? group("purchase", "Alış") : ""}</div>`,
    );
    // 2.4.4 (uzman UX10): odak varsayılan senaryoda (yoksa ilk kartta) — klavyeyle ok/Tab + Enter (önceden odak sayfanın başındaydı).
    (root.querySelector(".hof-inv-scenario.is-default") || root.querySelector(".hof-inv-scenario"))?.focus({ preventScroll: true });
  }

  // ---------- Olaylar (liste) ----------
  function onClick(event) {
    const target = event.target.closest("button, a, tr[data-inv], tr[data-inbox], input[type=checkbox], li[data-item], li[data-new-item], li[data-original], [data-apply-price]");
    if (!target) return;
    if (target.matches("input[type=checkbox]")) return onCheck(target);
    if (target.matches("tr[data-inv]")) return loadDoc(target.dataset.inv);
    if (target.matches("tr[data-inbox]")) return loadInboxItem(target.dataset.inbox);
    if (target.dataset.tab) {
      view.tab = target.dataset.tab;
      view.selected.clear();
      if (view.tab === "inbox") return loadInbox();
      view.list = null;
      renderList();
      return loadList();
    }
    if (target.dataset.preset !== undefined && view.mode === "list") {
      view.preset = target.dataset.preset;
      [view.from, view.to] = presetRange(view.preset);
      return loadList();
    }
    if (target.dataset.scenario) return startForm({ scenario: target.dataset.scenario, account: view.pickAccount });
    if (target.dataset.openAccount) {
      event.preventDefault();
      modal?.close();
      return HOF.accounts?.open(target.dataset.openAccount);
    }
    if (target.dataset.openCheque) {
      event.preventDefault();
      modal?.close();
      return HOF.cheques?.open({ id: target.dataset.openCheque });
    }
    if (target.dataset.openPlan) {
      event.preventDefault();
      modal?.close();
      return HOF.plans?.open(target.dataset.openPlan);
    }
    if (target.dataset.openInvoice) {
      event.preventDefault();
      return loadDoc(target.dataset.openInvoice);
    }
    if (target.dataset.print) {
      const link = target.closest(".hof-plan-output")?.querySelector("a[data-pdf]");
      if (link) office().printPdf?.(link.getAttribute("href"));
      return;
    }
    if (view.mode === "form") return formClick(event, target);
    const act = target.dataset.act;
    if (!act) return;
    if (act === "new") return showPick("", view.account);
    if (act === "send-pending") return sendPending();
    if (act === "send-selected") return sendSelected();
    if (act === "settings") return showSettings();
    if (act === "integrator") return showIntegrator();
    if (act === "portal") return openPortal();
    if (act === "restore-notice-dismiss") return dismissRestoreNotice(target);
    if (act === "more") return loadList(true);
    if (act === "retryList") {
      view.listError = "";
      renderList();
      return loadList();
    }
    if (act === "clear-sel") {
      view.selected.clear();
      return renderList();
    }
    if (act === "bulk-issue") return bulkIssue();
    if (act === "bulk-cancel") return bulkCancel();
    if (act === "open-bank") return HOF.bank?.open?.({ tab: "accounts" });
    if (act === "bulk-delete") return bulkDelete();
    if (act === "clear-account") {
      view.account = null;
      return loadList();
    }
    if (act === "back") return showList();
    if (view.mode === "card") return cardAction(act, target);
    if (view.mode === "settings") return settingsAction(act, target);
    if (view.mode === "inbox" || view.mode === "inbox-item") return inboxAction(act, target);
  }
  function onCheck(input) {
    if (input.dataset.sel) {
      if (input.checked) view.selected.add(input.dataset.sel);
      else view.selected.delete(input.dataset.sel);
      return renderList();
    }
    if (input.hasAttribute("data-sel-all")) {
      for (const doc of view.list?.invoices || []) {
        if (input.checked) view.selected.add(doc.id);
        else view.selected.delete(doc.id);
      }
      return renderList();
    }
  }
  function onChange(event) {
    if (view.mode === "form") return formChange(event);
    if (view.mode === "settings") return event.target.matches("[data-logo-file]") ? pickLogo(event.target) : event.target.matches("[data-stamp-file]") ? pickStamp(event.target) : undefined;
    const name = event.target.dataset.filter;
    if (!name || name === "q") return;
    view[name] = event.target.value;
    if (name === "from" || name === "to") view.preset = "custom";
    if (view.mode === "inbox") return;
    loadList();
  }
  function onInput(event) {
    if (view.mode === "form") return formInput(event);
  }
  function onKey(event) {
    if (event.key === "Enter" && event.target.matches("[data-filter='q']")) {
      event.preventDefault();
      view.q = event.target.value.trim();
      return loadList();
    }
    if (event.key === "Enter" && event.target.closest("tr[data-inv]") && !event.target.matches("input")) return loadDoc(event.target.closest("tr[data-inv]").dataset.inv);
    if (view.mode === "form") return formKey(event);
  }

  // ---------- Form ----------
  const pad2 = value => String(value).padStart(2, "0");
  const nowTime = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const newKey = () => Math.random().toString(36).slice(2, 10);
  const blankLine = (vat = meta?.settings?.defaults?.vatRate ?? 20) => ({ key: newKey(), itemId: "", name: "", code: "", description: "", serialNo: "", lotNo: "", unit: "Adet", qty: "1", unitPrice: "", discountRate: "", vatRate: String(vat), withholdingCode: "", exemptionCode: "", expenseCode: "", originLineId: "", left: null, available: null, itemKind: "", prices: null, more: false, net: null, newItem: false, newSalePrice: "" });
  const lineFrom = (line, { keepOrigin = false } = {}) => ({
    ...blankLine(line.vatRate),
    itemId: line.itemId || "",
    name: line.name || "",
    code: line.code || "",
    description: line.description || "",
    serialNo: line.serialNo || "",
    lotNo: line.lotNo || "",
    unit: line.unit || "Adet",
    qty: amountText(line.qty ?? 1),
    unitPrice: priceText(line.unitPrice ?? ""),
    discountRate: line.discountRate ? amountText(line.discountRate) : "",
    vatRate: String(line.vatRate ?? 20),
    withholdingCode: line.withholdingCode || "",
    exemptionCode: line.exemptionCode || "",
    expenseCode: line.expenseCode || "",
    originLineId: keepOrigin ? line.originLineId || "" : "",
    more: Boolean(line.description || line.serialNo || line.lotNo || line.withholdingCode || line.exemptionCode),
  });
  const ISSUE_LABELS = { sale: "Faturayı Kaydet", smm: "Makbuzu Kaydet", purchase: "Faturayı Kaydet", sale_return: "İadeyi Kaydet", purchase_return: "İade Faturasını Kaydet" };
  // v2.1.0 Aşama 7: peşin satırın satır anahtarı (lineKey; Düzenle'de sunucu eski satırla bu anahtarla eşler) ve banka hesabı. issued: kaydedilmiş
  // belgenin Düzenle'si — hesapsız eski havale satırı "Atanmamış (Eski Hareket)" olarak açılır (dokunulmazsa bağsız kalır).
  const lineKey = () => `k${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  // K2: alış tarafında (alış faturası, alıştan iade) kart yolu kurumsal kartla ödeme / kurumsal karta iadedir; satırın hesabı Kurumsal Kart.
  // legacyMethod: hesapsız eski satırın yolu ("Atanmamış (Eski Hareket)" seçeneği yalnız o yolda kalır).
  // 2.2.0 (İz 3.2): satış tarafında kart yolu POS'tur — satırın POS'u (sunucu fatura kartında bağlı POS'u bankAccountId'de de döndürür), POS Taksit
  // Sayısı, Provizyon No, kartın son 4 hanesi ve satıştan iadede asıl POS işlemi ("Kaynaksız (Eski Satış)" seçeneğiyle).
  const SOURCELESS = "__sourceless";
  const payFrom = (payment, { issued = false, corporate = false } = {}) => ({
    cash: (payment?.cash || []).map((item, index) => {
      const method = item.method || "cash";
      const legacy = issued && (method === "bank" || (method === "card" && corporate)) && !item.bankAccountId;
      const pos = method === "card" && !corporate;
      return {
        amount: amountText(item.amount), method, lineKey: /^[A-Za-z0-9_-]{1,40}$/.test(String(item.lineKey || "")) ? item.lineKey : `i${index}`, bankAccountId: pos ? "" : item.bankAccountId || "", legacy, legacyMethod: legacy ? method : "",
        ...(pos ? { posId: item.posId || item.bankAccountId || "", posInstallments: String(item.posInstallments || item.installments || 1), authCode: item.authCode || "", cardLast4: item.cardLast4 || "", posRefundOf: item.posSourceless ? SOURCELESS : item.posRefundOf || "" } : {}),
      };
    }),
    cheques: (payment?.cheques || []).map(item => ({ instrument: item.instrument || "cheque", amount: amountText(item.amount), dueDate: item.dueDate || "", serialNo: item.serialNo || "", bank: item.bank || "", drawer: item.drawer || "", bankAccountId: item.bankAccountId || "" })),
    endorse: [...(payment?.endorse || [])],
    rest: payment?.rest === "installments" ? "installments" : "open",
    dueDate: payment?.dueDate || "",
    installments: { count: String(payment?.installments?.count || 3), firstDue: payment?.installments?.firstDue || "", everyMonths: String(payment?.installments?.everyMonths || 1) },
  });

  // 2.7: Düzenle'de kaydedilmiş belgenin peşin satırları seçilen hesabın bakiyesinde zaten var — "İşlemden Sonra" yeni − eski (hesap başına, kuruş).
  function payOriginalOf(doc) {
    const sign = ["sale", "smm", "purchase_return"].includes(doc.kind) ? 1 : -1;
    const refs = {};
    for (const item of doc.payment?.cash || []) if (item.bankAccountId && (item.method === "bank" || item.method === "card")) refs[item.bankAccountId] = (refs[item.bankAccountId] || 0) + sign * Math.round((Number(item.amount) || 0) * 100);
    return { date: doc.issueDate || "", refs };
  }
  // modify (v2.0.16): kaydedilmiş belgenin düzenlenmesi — aynı numara; kaydedilince eski etkiler geri alınıp yenileri yazılır.
  function startForm({ scenario, account = null, draft = null, copyOf = null, modify = null }) {
    if (!canManage()) return HOF.toast("Fatura kaydetme yetkiniz yok.", { type: "error" });
    if (modify) draft = { ...modify, id: "" };
    view.bankChoices = null;
    const source = draft || copyOf;
    const sc = meta.scenarios[scenario || source?.scenario] || meta.scenarios[source?.kind];
    const kind = source?.kind || sc?.kind;
    if (!kind) return HOF.toast("Senaryo tanınmadı.", { type: "error" });
    const d = meta.settings.defaults;
    const form = {
      id: draft?.id || "",
      // v2.0.22 (madde 5): bu formun istek kimliği — her "Kaydet" denemesinde aynı (ikinci fatura açılmaz).
      requestId: HOF.requestId(),
      scenario: scenario || source?.scenario || "",
      kind,
      side: sideOf(kind),
      account: source ? { id: source.accountId, name: source.accountName } : account?.id ? { id: account.id, name: account.name } : null,
      original: null,
      issueDate: draft?.issueDate || todayIso(),
      issueTime: draft?.issueTime || nowTime(),
      profile: draft?.profile && draft.profile !== "KAGIT" ? draft.profile : "",
      currency: source?.currency || "TRY",
      rate: source && source.currency !== "TRY" ? amountText(source.rate) : "",
      // 2.4.3 (uzman UX28): müşteri numarası vermediği iadede (programın iç numarası; sunucu internalNumber) kutuya iç numara gelmez; iç numara ayrıca yazar.
      number: draft?.kind && !isOwn(draft.kind) ? (draft.kind === "sale_return" && draft.internalNumber ? "" : draft.number || "") : "",
      internalNo: draft?.kind === "sale_return" && draft.internalNumber ? draft.number || "" : "",
      paperNo: draft?.paperNo || "",
      // MM1: iade e-Belgesinin asıl fatura referansı (asıl numara 16 karakter değilse); kullanıcı yazdıysa öneri üstüne yazılmaz.
      returnRef: draft?.returnRef || "",
      returnRefTouched: Boolean(draft?.returnRef),
      orderNo: draft?.orderNo || "",
      orderDate: draft?.orderDate || "",
      despatchNo: draft?.despatchNo || "",
      despatchDate: draft?.despatchDate || "",
      pricesIncludeVat: source ? Boolean(source.pricesIncludeVat) : d.pricesIncludeVat === true,
      discountRate: source?.discountRate ? amountText(source.discountRate) : "",
      stoppageRate: source && ["smm", "purchase"].includes(kind) ? amountText(source.stoppageRate) : "",
      lines: source?.lines?.length ? source.lines.map(line => lineFrom(line, { keepOrigin: Boolean(draft) })) : [blankLine(d.vatRate)],
      note: source?.note || "",
      pay: payFrom(draft?.payment, { issued: Boolean(modify), corporate: sideOf(kind) === "purchase" }),
      calc: null,
      calcError: "",
      returnHits: null,
      returnQuery: "",
      portfolio: null,
      busy: false,
      modifyId: modify?.id || "",
      modifyNumber: modify?.number || "",
      // 2.7: Düzenle'de kaydedilmiş peşin satırların hesaplardaki etkisi (bakiyede zaten var).
      payOriginal: modify ? payOriginalOf(modify) : null,
      // 2.4.4 (uzman UX10): ilk çizimde odak formun başlangıç alanına (focusFormStart); sonraki yeniden çizimler odağı oynatmaz.
      focusOnDraw: true,
    };
    view.form = form;
    setMode("form");
    if (draft?.originalId) return attachOriginal(draft.originalId, { keepLines: true, excludeReturn: form.modifyId });
    renderForm();
    if (copyOf) HOF.toast("Kopya hazır: tarih bugüne alındı; kontrol edip kaydedin.", { type: "info" });
  }
  async function startReturn(originalId) {
    if (!canManage()) return HOF.toast("İade kaydetme yetkiniz yok.", { type: "error" });
    try {
      const original = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(originalId)}`);
      const kind = original.kind === "purchase" ? "purchase_return" : "sale_return";
      startForm({ scenario: kind });
      await attachOriginal(original.id, { doc: original });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // İade: asıl fatura seçilince cari, para birimi, kur ve kalemler (kalan iade edilebilir miktarla) ondan gelir.
  async function attachOriginal(originalId, { doc = null, keepLines = false, excludeReturn = "" } = {}) {
    const form = view.form;
    if (!form) return;
    try {
      // excludeReturn (v2.0.17): iade düzenlenirken asıl faturanın kalanı bu iadenin kendi miktarı hariç gelir.
      const original = doc || (await HOF.api(`/api/workspace/invoices/${encodeURIComponent(originalId)}${excludeReturn ? `?excludeReturn=${encodeURIComponent(excludeReturn)}` : ""}`));
      const left = new Map((original.returnable || []).map(item => [item.id, item.left]));
      form.original = { id: original.id, number: original.displayNo || original.number, rawNumber: original.number || "", issueDate: original.issueDate, accountName: original.accountName, payableTotal: original.payableTotal, currency: original.currency };
      if (!form.returnRefTouched) form.returnRef = returnRefNeeded(form) ? returnRefSuggestion(form.original.rawNumber) : "";
      form.account = { id: original.accountId, name: original.accountName };
      form.currency = original.currency;
      form.rate = original.currency !== "TRY" ? amountText(original.rate) : "";
      form.pricesIncludeVat = Boolean(original.pricesIncludeVat);
      form.discountRate = original.discountRate ? amountText(original.discountRate) : "";
      const previous = new Map(form.lines.filter(line => line.originLineId).map(line => [line.originLineId, line.qty]));
      form.lines = original.lines
        .filter(line => (left.get(line.id) ?? 0) > 0 || previous.has(line.id))
        .map(line => ({ ...lineFrom(line), originLineId: line.id, left: left.get(line.id) ?? 0, qty: keepLines && previous.has(line.id) ? previous.get(line.id) : amountText(left.get(line.id) ?? 0) }));
      if (keepLines && previous.size) form.lines = form.lines.filter(line => previous.has(line.originLineId));
      form.returnHits = null;
      // Asıl fatura seçildi: arama kutusu yeniden çizimde kalkar, odak ilk iade kaleminin miktarına geçer (UX10).
      form.focusOnDraw = true;
      renderForm();
      if (!form.lines.length) HOF.toast("Bu faturanın iade edilebilecek kalemi kalmamış.", { type: "error" });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  const formTitle = form => form.modifyId ? `Düzenleme: ${kindLabel(form.kind)} ${form.modifyNumber}` : `${form.id ? "Taslak: " : "Yeni "}${kindLabel(form.kind)}${form.scenario && meta.scenarios[form.scenario] && meta.scenarios[form.scenario].label !== kindLabel(form.kind) ? ` · ${meta.scenarios[form.scenario].label}` : ""}`;
  // v2.0.16: Stok Kodu kolonu (müşteri). Alışta ek "Gider Türü" kolonu.
  const hasExpenseCol = form => form.side === "purchase" && form.kind === "purchase";
  const lineCols = form => (hasExpenseCol(form) ? 11 : 10);
  // Yeni stok kartı önerisi yalnız "Stoğa Mal Alışı"nda (gider alışında yazılan ad gider kalemidir).
  const offersNewItem = form => form.kind === "purchase" && form.scenario !== "expense_purchase";
  function renderForm() {
    const root = body();
    const form = view.form;
    if (!root || !form) return;
    const ret = isReturn(form.kind);
    const sc = meta.scenarios[form.scenario];
    const own = isOwn(form.kind);
    const smmForm = form.kind === "smm";
    const currencies = meta.currencies.map(item => `<option value="${esc(item.code)}" ${item.code === form.currency ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)}</option>`).join("");
    const numberField =
      form.kind === "purchase"
        ? `<label class="hof-field"><span>Tedarikçinin Fatura No <i aria-hidden="true">*</i></span><input data-f="number" maxlength="40" value="${esc(form.number)}" placeholder="Faturanın üstündeki No"></label>`
        : form.kind === "sale_return"
          ? form.internalNo
            ? `<label class="hof-field"><span>Müşterinin İade Faturası No</span><input data-f="number" maxlength="40" value="" readonly placeholder="Müşteri numara vermedi" data-nodirty><small>Program iç numara verdi: ${esc(form.internalNo)} (düzenlemede değişmez).</small></label>`
            : `<label class="hof-field"><span>Müşterinin İade Faturası No</span><input data-f="number" maxlength="40" value="${esc(form.number)}" placeholder="Yoksa boş bırakın"><small>Müşteri iade faturası kesmediyse boş bırakın; program iç numara verir.</small></label>`
          : "";
    HOF.swap(
      root,
      `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="cancel-form" title="Formu kapat">← Vazgeç</button>
          <div class="hof-plan-title"><h3>${esc(formTitle(form))}</h3><small>${esc(sc?.hint || "")}</small></div></div>
        <div class="hof-inv-nextno" data-next></div>
      </div>
      ${ret ? '<section class="hof-inv-return" data-return></section>' : ""}
      <section class="hof-inv-head">
        <div class="hof-inv-account" data-account-slot>${ret ? `<div class="hof-field"><span>Cari</span><div class="hof-inv-fixed">${form.account ? `<a href="#" data-open-account="${esc(form.account.id)}">${esc(form.account.name)}</a>` : '<span class="hof-muted">Önce iade edilecek faturayı seçin.</span>'}</div></div>` : ""}</div>
        <label class="hof-field"><span>Tarih <i aria-hidden="true">*</i></span><input type="date" data-f="issueDate" value="${esc(form.issueDate)}" max="${esc(todayIso())}"></label>
        <label class="hof-field"><span>Saat</span><input type="time" data-f="issueTime" value="${esc(form.issueTime)}"></label>
        <label class="hof-field" data-profile-field hidden><span>Belge Türü</span><select data-f="profile"></select><small data-profile-note></small></label>
        ${ret ? "" : `<label class="hof-field"><span>Para Birimi</span><select data-f="currency">${currencies}</select></label>`}
        <label class="hof-field" data-rate-field ${form.currency === "TRY" ? "hidden" : ""}><span>Kur (1 ${esc(form.currency)} = ? TL) <i aria-hidden="true">*</i></span><input data-f="rate" inputmode="decimal" value="${esc(form.rate)}" ${ret ? "readonly" : ""} placeholder="ör. 34,25"></label>
        ${numberField}
      </section>
      <p class="hof-muted hof-inv-paper-note" data-paper-note hidden></p>
      <p class="hof-muted hof-inv-paper-note" data-kind-note hidden></p>
      <details class="hof-inv-more-head" ${form.orderNo || form.despatchNo || form.paperNo ? "open" : ""}><summary>${smmForm ? "Sipariş ve Kâğıt Makbuz No" : "Sipariş, İrsaliye ve Kâğıt Fatura No"}</summary>
        <div class="hof-inv-head">
          <label class="hof-field"><span>Sipariş No</span><input data-f="orderNo" maxlength="60" value="${esc(form.orderNo)}"></label>
          <label class="hof-field"><span>Sipariş Tarihi</span><input type="date" data-f="orderDate" value="${esc(form.orderDate)}"></label>
          ${
            // Makbuzda irsaliye yoktur (hizmet; MM7). Eski makbuzda yazılmışsa alan görünür kalır (değer kaybolmasın).
            smmForm && !form.despatchNo && !form.despatchDate
              ? ""
              : `<label class="hof-field"><span>İrsaliye No</span><input data-f="despatchNo" maxlength="60" value="${esc(form.despatchNo)}"></label>
          <label class="hof-field"><span>İrsaliye Tarihi</span><input type="date" data-f="despatchDate" value="${esc(form.despatchDate)}"></label>`
          }
          ${own ? (smmForm ? `<label class="hof-field"><span>Kâğıt Makbuz No</span><input data-f="paperNo" maxlength="40" value="${esc(form.paperNo)}"><small>Elle düzenlenen matbu serbest meslek makbuzunun seri ve numarası (varsa).</small></label>` : `<label class="hof-field"><span>Kâğıt Fatura No</span><input data-f="paperNo" maxlength="40" value="${esc(form.paperNo)}"><small>Elle kesilen matbu faturanın seri ve numarası (varsa); fiş onunla eşleşir.</small></label>`) : ""}
        </div>
      </details>
      <section class="hof-inv-lines-wrap">
        <div class="hof-plan-section"><h4>Kalemler</h4>
          <span class="hof-inv-line-tools">
            ${ret ? "" : `<label class="hof-rep-check"><input type="checkbox" data-f="pricesIncludeVat" ${form.pricesIncludeVat ? "checked" : ""}> Fiyatlar KDV Dahil</label>`}
            ${ret ? "" : `<label class="hof-inv-mini"><span>Genel İskonto %</span><input data-f="discountRate" inputmode="decimal" value="${esc(form.discountRate)}" placeholder="0"></label>`}
            ${ret ? "" : `<label class="hof-inv-mini" title="Seçilen oran bütün kalemlere yazılır; sonra kalemde tek tek değiştirilebilir. Yeni eklenen kalem de bu oranı alır."><span>Tüm Kalemlere KDV</span><select data-f="allVat" aria-label="Tüm kalemlere KDV oranı"><option value="">Seçin</option>${vatOptions("-")}</select></label>`}
            ${["smm", "purchase"].includes(form.kind) ? `<label class="hof-inv-mini"${form.kind === "smm" ? ` title="${esc(STOPPAGE_HINT)}"` : ""}><span>Stopaj %</span><input data-f="stoppageRate" inputmode="decimal" value="${esc(form.stoppageRate)}" placeholder="${form.kind === "smm" ? "otomatik" : "0"}"></label>` : ""}
            ${form.kind === "smm" ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="gross-from-net" title="Eline geçecek net tutardan brüt ücreti hesaplar">Netten Brüte</button>' : ""}
          </span>
        </div>
        <div class="hof-rep-table hof-inv-lines-scroll"><table class="hof-table hof-inv-lines"><thead><tr><th>#</th><th>Stok Kodu</th><th>${form.kind === "smm" ? "Hizmet" : "Ürün / Hizmet"}</th><th class="num">Miktar</th><th>Birim</th><th class="num">Birim Fiyat</th><th class="num">İsk. %</th><th>KDV</th>${hasExpenseCol(form) ? "<th>Gider Türü</th>" : ""}<th class="num">${form.kind === "smm" ? "Brüt Ücret" : "Tutar"}</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
        <p class="hof-muted hof-inv-unit-hint" data-unit-hint hidden></p>
        ${ret ? "" : `<div class="hof-inv-add"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="add-line">+ Kalem Ekle</button><small>${offersNewItem(form) ? "Stok Kodu ya da ürün adı yazın; stokta yoksa listeden “+ Yeni Stok Kartı” ile kart açılır (fatura kaydedilince)." : form.kind === "purchase" ? "Stok Kodu ya da ad yazın; stokta olmayan ad gider kalemi olur." : "Stok Kodu (barkod) ya da ürün adı yazın; stoktaki ürünler listelenir. Listede olmayan ad hizmet kalemi olur."}</small></div>`}
        <datalist id="hof-inv-units">${(meta.units || []).map(unit => `<option value="${esc(unit)}"></option>`).join("")}</datalist>
      </section>
      <div class="hof-inv-bottom">
        <section class="hof-inv-pay" data-pay></section>
        <section class="hof-inv-sum" data-totals></section>
      </div>
      <label class="hof-field hof-inv-note"><span>Not (Belgenin Altına Basılır)</span><textarea data-f="note" rows="2" maxlength="2000" placeholder="ör. Teslim adresi, garanti süresi, banka bilgisi…">${esc(form.note)}</textarea></label>
      <p class="hof-form-error" role="alert" data-form-error></p>
      <div class="hof-actions" data-form-actions>${formActions(form)}</div>`,
    );
    if (!ret) mountAccountPicker();
    if (ret) renderReturn();
    if (ret) syncReturnRef();
    renderLines();
    renderPay();
    renderTotals();
    scheduleCalc(0);
    if (form.focusOnDraw) {
      form.focusOnDraw = false;
      focusFormStart(form);
    }
  }
  // 2.4.4 (uzman UX10): formun başlangıç odağı — iadede asıl fatura aranır (seçildiyse ilk kalemin miktarı); cari yoksa cari kutusu (öneri
  // listesi açılmadan); cari varsa ilk boş kalemin adı. Odak verilemezse (alan yok) eski davranış sürer.
  const focusNode = node => {
    if (!node || node.disabled || !node.getClientRects().length) return false;
    node.focus({ preventScroll: true });
    return document.activeElement === node;
  };
  const focusAccount = () => {
    const picker = body()?.querySelector("[data-account-slot] .hof-acc-picker");
    return picker?.focusQuiet ? picker.focusQuiet() : focusNode(picker?.querySelector("[data-acc-query]"));
  };
  const lineInput = (index, field) => body()?.querySelector(`[data-l="${index}"][data-f="${field}"]`);
  const firstEmptyLine = form => Math.max(0, form.lines.findIndex(line => !line.itemId && !line.name.trim() && !line.originLineId));
  function focusFormStart(form) {
    if (view.form !== form) return false;
    if (isReturn(form.kind)) return form.original ? focusNode(lineInput(0, "qty")) : focusNode(body()?.querySelector("[data-return-q]"));
    if (!form.account) return focusAccount();
    return focusNode(lineInput(firstEmptyLine(form), "name"));
  }
  // Cari seçildikten / açıldıktan / düzeltildikten sonra: ilk boş kalemin adı; kalemler doluysa kaydetme düğmesi (Enter ile kaydet).
  function focusAfterAccount(form) {
    if (view.form !== form) return;
    const empty = form.lines.findIndex(line => !line.itemId && !line.name.trim() && !line.originLineId);
    if (empty >= 0 && focusNode(lineInput(empty, "name"))) return;
    focusNode(body()?.querySelector('[data-form-actions] [data-act="issue-now"], [data-form-actions] [data-act="issue"]'));
  }
  // Sunucunun ya da formun hatası bir alanı söylüyorsa (data.field) odak o alana: kalem hatasında ("N. kalem: …") o kalemin alanı (N, boş
  // satırlar sayılmadan gönderilen kalemlerin sırası). Bilinmeyen alanda odak değişmez.
  const HEAD_FOCUS = new Set(["issueDate", "issueTime", "profile", "currency", "rate", "number", "paperNo", "orderNo", "orderDate", "despatchNo", "despatchDate", "stoppageRate", "note"]);
  const LINE_FOCUS = new Set(["qty", "unitPrice", "discountRate", "vatRate", "name", "code", "unit", "lines", "withholdingCode", "exemptionCode", "expenseCode"]);
  function focusFailure(form, data, message = "") {
    const field = String(data?.field || "");
    if (!field || view.form !== form) return false;
    if (field === "accountId") return isReturn(form.kind) ? focusNode(body()?.querySelector("[data-return-q]")) : focusAccount();
    if (field === "originalId") return focusNode(body()?.querySelector("[data-return-q]"));
    const at = /^(\d+)\. kalem/.exec(String(message || ""));
    if (at && LINE_FOCUS.has(field)) {
      const line = usedLines(form)[Number(at[1]) - 1];
      const index = line ? form.lines.indexOf(line) : -1;
      if (index < 0) return false;
      return focusNode(lineInput(index, field === "lines" ? (isReturn(form.kind) ? "qty" : "name") : field)) || focusNode(lineInput(index, isReturn(form.kind) ? "qty" : "name"));
    }
    if (field === "lines") return focusNode(lineInput(firstEmptyLine(form), isReturn(form.kind) ? "qty" : "name"));
    if (HEAD_FOCUS.has(field) || field === "discountRate") return focusNode(body()?.querySelector(`[data-f="${field}"]:not([data-l])`));
    return false;
  }
  function mountAccountPicker() {
    const form = view.form;
    const slot = body()?.querySelector("[data-account-slot]");
    if (!slot || !HOF.accounts?.picker) return;
    const picker = HOF.accounts.picker({
      value: form.account || {},
      label: form.side === "purchase" ? "Tedarikçi (Cari)" : "Müşteri (Cari)",
      required: true,
      help: "Vergi bilgileri cari kartından gelir; kayıtlı değilse “+ Yeni Cari” ile buradan açın.",
      // 31f U7b: listeden (fare ya da Enter) seçilince odak kalemlere geçer (önceden cari kutusunda kalıyordu; ilk kaleme 18 Tab). Yalnız
      // kullanıcı kutudayken: dışarıdan seçim (+ Yeni Cari kaydı) kendi odağını verir, seçim kaldırılınca (×) odak kutuda kalır.
      onPick: account => {
        const fromBox = Boolean(account?.id) && picker?.contains(document.activeElement);
        applyPickedAccount(account);
        if (fromBox) setTimeout(() => focusAfterAccount(form), 0);
      },
    });
    // v2.0.15 (QA A5): cari yoksa formdan ayrılmadan açılır; kaydedilince seçili gelir, fiyatlar ve toplamlar yenilenir.
    const canNew = HOF.accounts?.newFor && HOF.can("accounts.manage") && !isReturn(form.kind);
    // 2.4.3 (KÖ1, kullanıcı kararı 18.10.2026): perakende satışta her seferinde cari aramak / açmak gerekmesin — "Nihai Tüketici" tek tıkla
    // kimliği bilinmeyen alıcı carisini (TCKN 11111111111) seçer; cari yoksa ilk kullanımda açılır, sonra hep aynısı (çift açılmaz). e-Arşiv
    // tutar sınırı aşılırsa belge kaydedilmeden uyarılır (sunucu denetimi, Toplamlar bölümünde ve kayıtta).
    // 2.4.4 (31f U1): seçilen cari programın işaretli "Nihai Tüketici" carisidir; 11111111111 yazılmış adı belli bir cari seçilmez
    // (kural routes/accounts.mjs taxIdentity.retailAccount).
    const retail = form.side === "sale" && !isReturn(form.kind) ? document.createElement("button") : null;
    if (retail) {
      retail.type = "button";
      retail.className = "hof-button hof-button-small hof-button-ghost hof-inv-account-retail";
      retail.dataset.act = "retail-account";
      retail.textContent = "Nihai Tüketici";
      retail.title = "Kimliği bilinmeyen perakende alıcı (TCKN 11111111111) seçilir";
      retail.onclick = async () => {
        retail.disabled = true;
        try {
          const account = await HOF.api("/api/workspace/invoices/retail-account", { method: "POST", body: {} });
          if (view.form !== form) return;
          applyPickedAccount(account);
          mountAccountPicker();
          focusAfterAccount(form);
          HOF.toast(account.created ? `${account.name} carisi açıldı ve seçildi (kimliği bilinmeyen alıcı, TCKN 11111111111).` : `${account.name} seçildi (kimliği bilinmeyen alıcı).`, { type: "info" });
        } catch (error) {
          HOF.toastError(error);
        } finally {
          retail.disabled = false;
        }
      };
    }
    if (!canNew && !retail) return slot.replaceChildren(picker);
    const row = document.createElement("div");
    row.className = "hof-inv-account-row";
    row.append(picker);
    if (retail) row.append(retail);
    if (!canNew) return slot.replaceChildren(row);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "hof-button hof-button-small hof-button-ghost hof-inv-account-new";
    add.textContent = "+ Yeni Cari";
    add.title = form.side === "purchase" ? "Tedarikçi kartı aç" : "Müşteri kartı aç";
    // 2.4.4 (uzman UX16): seçicide yazılan ad yeni cari formuna taşınır (genel seçicideki "+ Yeni Cari" gibi); seçili carinin adı taşınmaz.
    add.onclick = () => {
      const typed = picker.querySelector("[data-acc-query]")?.value.trim() || "";
      const name = typed && typed !== form.account?.name ? typed : undefined;
      // 2.4.4 (uzman UX9): e-Belge kesilecekse il ve (e-Fatura'da şirkette) vergi dairesi yanında not — zorunlu yapılmaz (kâğıt belgede
      // gerekmez); eksikse faturada sorun ve "Cariyi Düzenle" görünür. UX10: kayıttan sonra odak ilk boş kalem adında (pencere kapanınca).
      const badges = sendable(form) ? { city: "e-Belge İçin Zorunlu", taxOffice: "e-Fatura'da Şirkette Zorunlu" } : {};
      HOF.accounts.newFor({ type: form.side === "purchase" ? "supplier" : "customer", name }, { badges, onSaved: account => {
        if (view.form !== form) return;
        applyPickedAccount(account);
        mountAccountPicker();
        HOF.toast(`${account.name} seçildi.`, { type: "info" });
        setTimeout(() => focusAfterAccount(form), 0);
      } });
    };
    row.insertBefore(add, retail);
    slot.replaceChildren(row);
  }
  function applyPickedAccount(account) {
    const form = view.form;
    if (!form) return;
    form.account = account?.id ? { id: account.id, name: account.name } : null;
    form.profile = "";
    clearFormError();
    form.portfolio = null;
    for (const line of form.lines) line.prices = null;
    refreshAllPrices();
    scheduleCalc(0);
  }

  // MM1 (2.4.3, mali müşavir): kâğıt (16 karakter olmayan) numaralı asıl faturanın iadesi e-Belge olarak kesilebilsin. GİB iade e-Belgesinde asıl
  // faturayı 16 karakterlik numarayla ister (yalnız uzunluk); asıl kaydın numarası değiştirilmez (VUK). Form açılırken uyarı ve önerilen değer
  // görünür ("A 004512" → "A000000000004512"); kullanıcı düzeltebilir. Değer 16 karakter (harf/rakam) değilse Kaydet düğmeleri pasif, nedeni yazılı.
  // Öneri kuralı sunucudakiyle aynı (invoices.mjs returnRefSuggestion).
  const returnRefSuggestion = number => {
    const alnum = String(number || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!alnum || alnum.length > 16) return "";
    const prefix = /^[A-Z]*/.exec(alnum)[0];
    return `${prefix}${alnum.slice(prefix.length).padStart(16 - prefix.length, "0")}`;
  };
  const returnRefValue = form => String(form.returnRef || "").replace(/\s+/g, "").toUpperCase();
  const returnRefNeeded = form => Boolean(form && isReturn(form.kind) && form.original && meta?.kinds?.[form.kind]?.send && edoc() && (form.calc?.profile || form.profile || "") !== "KAGIT" && String(form.original.rawNumber ?? form.original.number ?? "").trim().length !== 16);
  const returnRefBlock = form => {
    if (!returnRefNeeded(form)) return "";
    const value = returnRefValue(form);
    if (/^[0-9A-Z]{16}$/.test(value)) return "";
    return value.length === 16 ? "İade Edilen Belge No (e-Belge Referansı) yalnız harf ve rakam içermeli; kaydetmek için düzeltin." : `İade Edilen Belge No (e-Belge Referansı) 16 karakter olmalı (şu an ${value.length}); kaydetmek için düzeltin.`;
  };
  function returnRefField(form) {
    if (!returnRefNeeded(form)) return "";
    const original = String(form.original.rawNumber ?? form.original.number ?? "").trim();
    return `<label class="hof-field hof-inv-return-ref"><span>İade Edilen Belge No (e-Belge Referansı)</span><input data-return-ref-input maxlength="20" autocomplete="off" spellcheck="false" value="${esc(form.returnRef)}" aria-describedby="hof-inv-return-ref-note"><small class="hof-inv-warn" id="hof-inv-return-ref-note" data-return-ref-note>Asıl faturanın numarası (${esc(original || "yok")}) 16 karakter değil; GİB, iade e-Belgesinde asıl faturayı 16 karakterlik numarayla ister. Önerilen değeri kontrol edin, gerekirse düzeltin. Asıl fatura kaydı değişmez; gerçek numara belgenin açıklamasında yazar.</small></label>`;
  }
  // Alan gerekli olup olmadığı değişince (belge türü hesaplamadan sonra belli olur) yeniden çizilir; yazarken çizilmez (odak korunur).
  function syncReturnRef() {
    const form = view.form;
    if (!form) return;
    const needed = returnRefNeeded(form);
    const slot = body()?.querySelector("[data-return-ref]");
    if (slot && slot.dataset.needed !== String(needed)) {
      if (needed && !form.returnRefTouched && !form.returnRef) form.returnRef = returnRefSuggestion(form.original?.rawNumber ?? form.original?.number);
      slot.dataset.needed = String(needed);
      slot.innerHTML = returnRefField(form);
    }
    const block = returnRefBlock(form);
    const actions = body()?.querySelector("[data-form-actions]");
    if (!actions) return;
    if (!form.busy) actions.querySelectorAll('[data-act="issue"], [data-act="issue-now"], [data-act="issue-later"]').forEach(button => (button.disabled = Boolean(block)));
    let note = actions.querySelector("[data-return-ref-block]");
    if (block && !note) {
      note = document.createElement("small");
      note.className = "hof-inv-warn";
      note.dataset.returnRefBlock = "";
      actions.prepend(note);
    }
    if (note) {
      note.textContent = block;
      note.hidden = !block;
    }
  }
  // İade edilecek faturayı bulan arama (en üstte).
  function renderReturn() {
    const form = view.form;
    const slot = body()?.querySelector("[data-return]");
    if (!slot || !form) return;
    const side = form.kind === "purchase_return" ? "purchase" : "sale";
    const hits = form.returnHits;
    slot.innerHTML = form.original
      ? `<div class="hof-inv-return-chosen"><span>İade Edilen Fatura</span><b><a href="#" data-open-invoice="${esc(form.original.id)}">${esc(form.original.number)}</a></b><small>${esc(form.original.accountName)} · ${esc(HOF.formatDate(form.original.issueDate))} · ${esc(curMoney(form.original.payableTotal, form.original.currency))}</small>${form.id ? "" : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="change-original">Başka Fatura Seç</button>'}</div><div data-return-ref>${returnRefField(form)}</div>`
      : `<label class="hof-field hof-inv-return-search"><span>İade Edilecek ${side === "purchase" ? "Alış" : "Satış"} Faturasını Bulun</span><input type="search" data-return-q value="${esc(form.returnQuery)}" placeholder="Fatura no, cari adı, ürün ya da VKN yazın…" autocomplete="off"><small>Yalnız iade edilebilir miktarı kalan kaydedilmiş faturalar listelenir.</small></label>
        <ul class="hof-inv-return-hits">${
          hits === null
            ? ""
            : hits.length
              ? hits.map(hit => `<li data-original="${esc(hit.id)}" tabindex="0"><b>${esc(hit.number)}</b> · ${esc(hit.accountName)} · ${esc(HOF.formatDate(hit.issueDate))}<small>${esc(curMoney(hit.payableTotal, hit.currency))} · ${hit.lines.filter(line => line.left > 0).length} kalem iade edilebilir: ${esc(hit.lines.filter(line => line.left > 0).slice(0, 3).map(line => `${line.name} (${String(line.left).replace(".", ",")} ${line.unit})`).join(", "))}</small></li>`).join("")
              : '<li class="is-empty">Eşleşen fatura yok.</li>'
        }</ul>`;
    if (!form.original && hits === null) searchReturnable("");
  }
  let returnTimer = 0;
  function searchReturnable(q) {
    const form = view.form;
    clearTimeout(returnTimer);
    returnTimer = setTimeout(async () => {
      try {
        const side = form.kind === "purchase_return" ? "purchase" : "sale";
        const data = await HOF.api(`/api/workspace/invoices/returnable?side=${side}&q=${encodeURIComponent(q)}`);
        if (view.form !== form || form.original) return;
        form.returnHits = data.invoices;
        const list = body()?.querySelector(".hof-inv-return-hits");
        if (!list) return;
        const input = body().querySelector("[data-return-q]");
        const focused = document.activeElement === input;
        renderReturn();
        if (focused) {
          const again = body().querySelector("[data-return-q]");
          again?.focus();
          again?.setSelectionRange(again.value.length, again.value.length);
        }
      } catch (error) {
        HOF.toastError(error);
      }
    }, 220);
  }

  // v2.0.16 (müşteri): Toplamlar düzeni. Ara Toplam = KDV matrahı, her zaman ayrı satır. İskonto varsa Toplam ve İskonto
  // KDV hariçtir (Toplam − İskonto = Ara Toplam: 1.666,67 − 166,67 = 1.500,00). İskonto yoksa ve fiyatlar KDV dahilse Toplam
  // girilen KDV dahil tutardır (16.500,00 → Ara Toplam 13.750,00, KDV 2.750,00, Genel Toplam 16.500,00).
  function totalRows({ includeVat, base, baseNet, discountNet, discount, net }) {
    const off = discountNet ?? discount ?? 0;
    if (off > 0) return [["Toplam", baseNet ?? base], ["İskonto", -off], ["Ara Toplam", net]];
    return [["Toplam", includeVat ? base : (baseNet ?? base)], ["Ara Toplam", net]];
  }
  // 2.4.4 (mali müşavir MM7/MM11): serbest meslek makbuzunun toplamları fatura dilinde değil, GİB e-SMM görünümündeki adlar ve sırayla (GİB Karekod Standardı
  // V1.2 §2.4: brutucret, gvstopaj, netucret, kdvtutari, kdvtevkifat, tahsilkdv, tahsilat): Brüt Ücret − Gelir Vergisi Stopajı = Net Ücret; KDV − KDV
  // Tevkifatı = Tahsil Edilen KDV; Net Ücret + Tahsil Edilen KDV = Tahsil Edilen (Net Alınan). Tutarlar aynı (sunucunun hesabı); "Genel Toplam" (Vergiler
  // Dahil Toplam) makbuzda yoktur. Form (ön hesap), kart ve PDF (invoice-pdf.mjs receiptRows) aynı satırları gösterir.
  const kurus = value => Math.round((Number(value) || 0) * 100);
  // 2.4.4 (mali müşavir MM1, yalnız metin; varsayılan hesap DEĞİŞMEZ): gerçek kişi alıcı da vergi kesintisi sorumlusu olabilir — basit usul dışındaki
  // tacir ve serbest meslek erbabı (GVK 94/1) brüt ücretten %20 stopaj keser (94/2-b). Program kimlik türünden bunu çıkaramaz; oran elle girilir.
  const STOPPAGE_PERSON_HINT = "Gerçek kişi alıcıda stopaj varsayılan olarak uygulanmaz; alıcı tacir ya da serbest meslek erbabıysa (GVK 94) stopaj oranını girin.";
  const STOPPAGE_HINT = `Boş bırakılırsa oran alıcıya göre belirlenir: şirket alıcıda ayarlardaki oran. ${STOPPAGE_PERSON_HINT}`;
  function receiptRows({ baseNet, discountNet, net, stoppage, stoppageRate, byRate, vat, withheld, payable }) {
    return [
      discountNet > 0 ? ["Hizmet Toplamı", baseNet] : null,
      discountNet > 0 ? ["İskonto", -discountNet] : null,
      ["Brüt Ücret", net],
      stoppage > 0 ? [`Gelir Vergisi Stopajı %${String(stoppageRate).replace(".", ",")}`, -stoppage] : null,
      ["Net Ücret", (kurus(net) - kurus(stoppage)) / 100],
      ...(byRate || []).map(item => [`KDV %${item.rate}`, item.vat]),
      withheld > 0 ? ["KDV Tevkifatı", -withheld] : null,
      withheld > 0 ? ["Tahsil Edilen KDV", (kurus(vat) - kurus(withheld)) / 100] : null,
      ["Tahsil Edilen (Net Alınan)", payable],
    ].filter(Boolean);
  }
  // ---------- Kalemler ----------
  const vatOptions = value => (meta.vatRates || [0, 1, 10, 20]).map(rate => `<option value="${rate}" ${String(rate) === String(value) ? "selected" : ""}>%${rate}</option>`).join("");
  // e-Belgede kodu olmayan birim (Çuval, Koli, Hafta…) Adet koduyla gider, adı kalem notuna yazılır: kullanıcı faturayı kesmeden önce görür.
  const eUnitAsAdet = unit => {
    const name = String(unit || "").trim();
    const key = name.toLocaleLowerCase("tr-TR");
    return Boolean(name) && eUnitsOn() && !["adet", "ad", "tane"].includes(key) && !(meta?.eUnits || []).includes(key);
  };
  const eUnitsOn = () => meta?.edocEnabled === true && (meta?.settings?.efatura || meta?.settings?.earsiv) && (meta?.eUnits || []).length > 0;
  function updateUnitHint() {
    const hint = body()?.querySelector("[data-unit-hint]");
    const form = view.form;
    if (!hint || !form) return;
    const names = [...new Set(form.lines.map(line => String(line.unit || "").trim()).filter(eUnitAsAdet))];
    // Yalnız e-Belge olarak gidecek belgede (satış, alıştan iade…; Müşteri Fişi / kâğıt değil); alış faturası karşı tarafın belgesidir.
    hint.hidden = !names.length || !sendable(form);
    hint.textContent = names.length ? `${names.join(", ")}: e-Fatura / e-Arşivde “Adet” kodu ile gider; birim adı kalem notunda yazar.` : "";
  }
  function renderLines() {
    const form = view.form;
    const tbody = body()?.querySelector("[data-lines]");
    if (!tbody || !form) return;
    const ret = isReturn(form.kind);
    const expense = hasExpenseCol(form);
    const saleSide = form.side === "sale" && !ret;
    const cols = lineCols(form);
    const rows = form.lines
      .map((line, index) => {
        const stockNote = stockNoteHtml(form, line, index);
        const more = `<div class="hof-inv-line-more" ${line.more ? "" : "hidden"}>
            <label><span>Açıklama</span><input data-l="${index}" data-f="description" maxlength="300" value="${esc(line.description)}" ${ret ? "readonly" : ""}></label>
            ${meta?.settings?.defaults?.itemTracking || line.serialNo || line.lotNo ? `<label><span>Seri No</span><input data-l="${index}" data-f="serialNo" maxlength="60" value="${esc(line.serialNo)}" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem Seri No"></label><label><span>Lot No</span><input data-l="${index}" data-f="lotNo" maxlength="60" value="${esc(line.lotNo)}" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem Lot No"></label>` : ""}
            ${saleSide ? `<label><span>KDV Tevkifatı</span><select data-l="${index}" data-f="withholdingCode"><option value="">Yok</option>${(meta.withholding || []).map(item => `<option value="${esc(item.code)}" ${item.code === line.withholdingCode ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)} (${item.num}/${item.den})</option>`).join("")}</select></label>` : ""}
            ${String(line.vatRate) === "0" && !ret ? `<label><span>KDV İstisna Nedeni</span><select data-l="${index}" data-f="exemptionCode"><option value="">Seçin</option>${(meta.exemptions || []).map(item => `<option value="${esc(item.code)}" ${item.code === line.exemptionCode ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)}</option>`).join("")}</select></label>` : ""}
          </div>`;
        return `<tr class="hof-inv-line" data-line="${index}">
          <td class="hof-inv-no">${index + 1}</td>
          <td class="hof-inv-code"><input data-l="${index}" data-f="code" value="${esc(line.code)}" maxlength="60" autocomplete="off" placeholder="Kod / Barkod" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem Stok Kodu"></td>
          <td class="hof-inv-name"><div class="hof-inv-item"><input data-l="${index}" data-f="name" value="${esc(line.name)}" title="${esc(line.name)}" maxlength="200" autocomplete="off" placeholder="Ürün ya da hizmet adı…" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem adı"><ul class="hof-inv-item-hits" data-hits="${index}" hidden></ul></div><small><span data-stock-note="${index}">${stockNote}</span>${ret ? ` · En çok ${esc(String(line.left).replace(".", ","))} ${esc(line.unit)} · 0 yazılırsa iade edilmez` : ""}</small>${more}</td>
          <td><input class="num" data-l="${index}" data-f="qty" inputmode="decimal" value="${esc(line.qty)}" aria-label="Miktar"></td>
          <td><input data-l="${index}" data-f="unit" value="${esc(line.unit)}" list="hof-inv-units" maxlength="20" ${ret || line.itemId ? "readonly" : ""} aria-label="Birim"></td>
          <td><input class="num" data-l="${index}" data-f="unitPrice" inputmode="decimal" value="${esc(line.unitPrice)}" placeholder="0,00" ${ret ? "readonly" : ""} aria-label="Birim fiyat"></td>
          <td><input class="num hof-inv-narrow" data-l="${index}" data-f="discountRate" inputmode="decimal" value="${esc(line.discountRate)}" placeholder="0" ${ret ? "readonly" : ""} aria-label="İskonto yüzdesi"></td>
          <td><select data-l="${index}" data-f="vatRate" ${ret ? "disabled" : ""} aria-label="KDV oranı">${vatOptions(line.vatRate)}</select></td>
          ${expense ? `<td>${line.itemId ? '<small class="hof-muted">Stok</small>' : `<select data-l="${index}" data-f="expenseCode" aria-label="Gider türü">${(meta.expenses || []).map(item => `<option value="${esc(item.code)}" ${item.code === (line.expenseCode || "other") ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>`}</td>` : ""}
          <td class="num" data-line-net>${line.net === null ? "—" : esc(curMoney(line.net, form.currency))}</td>
          <td class="hof-inv-line-actions">${ret ? (form.lines.length > 1 ? `<button type="button" class="hof-mini hof-mini-danger" data-act="line-remove" data-l="${index}" title="Bu kalemi iade etme (iadeden çıkar)" aria-label="${index + 1}. kalemi iadeden çıkar">×</button>` : "") : `<button type="button" class="hof-mini" data-act="line-more" data-l="${index}" title="Açıklama, tevkifat, istisna" aria-label="Kalem ayrıntısı">⋯</button><button type="button" class="hof-mini hof-mini-danger" data-act="line-remove" data-l="${index}" title="Kalemi sil" aria-label="Kalemi sil">×</button>`}</td>
        </tr>
        <tr class="hof-inv-hint-row" data-hint="${index}" ${line.prices ? "" : "hidden"}><td></td><td colspan="${cols - 1}">${priceHint(line, index)}</td></tr>`;
      })
      .join("");
    HOF.swap(tbody, rows);
    updateUnitHint();
  }
  // Kalemin stok notu. 2.4.3 (keşif B8): miktar stoğu aşınca satırda kayıttan ÖNCE uyarılır (önceden yalnız "Stokta 29 Kutu" yazıyor, eksi stok
  // ancak kaydederken ikinci soruyla öğreniliyordu). Düzenlemede (belgenin kendi miktarı stoktan zaten düşülmüş) uyarı verilmez.
  const STOCK_OUT_KINDS = new Set(["sale", "purchase_return"]);
  function stockNoteHtml(form, line, index) {
    if (line.itemId && line.itemKind !== "service" && line.available !== null && line.available !== undefined && STOCK_OUT_KINDS.has(form.kind) && !form.modifyId) {
      const qty = amountNum(line.qty);
      const after = Math.round((line.available - qty) * 1000) / 1000;
      // Stok zaten eksiyse eski gösterim ("Stokta −20 Adet (eksi)", senaryo-217) korunur, sonuna kayıttan sonraki miktar eklenir.
      if (line.available < 0 && qty > 0) return `<span class="hof-inv-warn" data-stock-warn>Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)} (eksi); bu miktarla ${esc(String(after).replace(".", ","))} ${esc(line.unit)} olur. Kaydederken sorulur.</span>`;
      if (qty > 0 && after < 0) return `<span class="hof-inv-warn" data-stock-warn>Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)}; bu miktar stoğu ${esc(String(after).replace(".", ","))} ${esc(line.unit)} (eksi) yapar. Kaydederken sorulur.</span>`;
    }
    return line.newItem && !line.itemId ? `<span class="hof-inv-newitem"><b>Yeni Stok Kartı Açılacak</b> · Satış Fiyatı <input data-l="${index}" data-f="newSalePrice" inputmode="decimal" value="${esc(line.newSalePrice)}" placeholder="isteğe bağlı" aria-label="Yeni stok kartının satış fiyatı"> <button type="button" class="hof-link-button" data-act="new-item-cancel" data-l="${index}">Vazgeç</button></span>` : line.itemId ? `${line.itemKind === "service" ? "Hizmet Kartı" : line.available !== null && line.available !== undefined ? (line.available < 0 ? `<span class="hof-inv-warn">Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)} (eksi)</span>` : `Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)}`) : "Stok Kartı"}` : line.name ? (offersNewItem(form) ? '<span class="hof-inv-warn">Stok kartı yok: gider sayılır, stoğa girmez. Mal ise listeden “+ Yeni Stok Kartı”nı seçin.</span>' : form.kind === "purchase" ? "Stoksuz: gider / hizmet kalemi" : "Stoksuz: hizmet kalemi") : "";
  }
  function syncStockNote(index) {
    const form = view.form;
    const slot = body()?.querySelector(`[data-stock-note="${index}"]`);
    if (!form || !slot || !form.lines[index]) return;
    const html = stockNoteHtml(form, form.lines[index], index);
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }
  // Son fiyat ipucu: bu cariye son satış/alış, başka carilere son fiyatlar, stok kartı (mevcut, maliyet, satış fiyatı).
  function priceHint(line, index) {
    const p = line.prices;
    const form = view.form;
    if (!p) return "";
    const sale = form.side === "sale";
    const priceLink = row => {
      const value = form.pricesIncludeVat ? row.unitGross : row.unitNet;
      return `<button type="button" class="hof-link-button" data-apply-price="${index}" data-price="${esc(String(value))}" title="Bu fiyatı kaleme yaz">${esc(money(value))}</button>`;
    };
    const parts = [];
    const mine = sale ? p.thisParty?.sale : p.thisParty?.purchase;
    if (mine) parts.push(`<span><b>${sale ? "Bu Cariye Son Satış" : "Bu Tedarikçiden Son Alış"}:</b> ${priceLink(mine)} <small>${esc(HOF.formatDate(mine.date))} · ${esc(mine.number)}</small></span>`);
    else if (form.account) parts.push(`<span class="hof-muted">${sale ? "Bu cariye daha önce satılmamış." : "Bu tedarikçiden daha önce alınmamış."}</span>`);
    const others = (sale ? p.others?.sale : p.others?.purchase) || [];
    if (others.length) parts.push(`<span><b>${sale ? "Başka Carilere" : "Başka Tedarikçilerden"}:</b> ${others.map(row => `${esc(row.accountName)} ${priceLink(row)}`).join(" · ")}</span>`);
    if (p.card) {
      const c = p.card;
      parts.push(`<span><b>Stok Kartı:</b>${c.available !== null && c.available !== undefined ? ` ${esc(String(c.available).replace(".", ","))} ${esc(c.unit)} ·` : ""} Maliyet ${esc(money(c.unitCost))}${c.salePrice ? ` · Satış Fiyatı <button type="button" class="hof-link-button" data-apply-price="${index}" data-price="${esc(String(form.pricesIncludeVat ? c.salePrice * (1 + Number(line.vatRate || 0) / 100) : c.salePrice))}">${esc(money(c.salePrice))}</button>` : ""}</span>`);
    }
    return `<div class="hof-inv-hint">${parts.join("")}</div>`;
  }
  const priceTimers = new Map();
  function loadPrices(index) {
    const form = view.form;
    const line = form?.lines[index];
    if (!line || (!line.itemId && !line.name.trim()) || isReturn(form.kind)) return;
    clearTimeout(priceTimers.get(line.key));
    priceTimers.set(
      line.key,
      setTimeout(async () => {
        try {
          const params = new URLSearchParams({ item: line.itemId, name: line.itemId ? "" : line.name.trim(), account: form.account?.id || "" });
          const prices = await HOF.api(`/api/workspace/invoices/last-prices?${params}`);
          if (view.form !== form) return;
          const has = prices.card || prices.thisParty?.sale || prices.thisParty?.purchase || prices.others?.sale?.length || prices.others?.purchase?.length;
          line.prices = has ? prices : null;
          const row = body()?.querySelector(`[data-hint="${form.lines.indexOf(line)}"]`);
          if (row) {
            row.hidden = !line.prices;
            row.lastElementChild.innerHTML = priceHint(line, form.lines.indexOf(line));
          }
        } catch {
          // fiyat ipucu gelmezse form çalışmaya devam eder
        }
      }, 250),
    );
  }
  const refreshAllPrices = () => view.form?.lines.forEach((line, index) => (line.itemId || line.name.trim() ? loadPrices(index) : null));

  let itemTimer = 0;
  let itemTicket = 0;
  // v2.0.16 (müşteri): öneri listesi tablonun kaydırma kutusunda kırpılıyordu (altı görünmüyordu). Liste artık pencereye
  // göre sabit konumlu: yazılan kutunun hemen altında, altta yer yoksa üstünde açılır; pencere kayınca yeniden yerleşir.
  function placeHits(list) {
    const anchor = body()?.querySelector(`[data-l="${list.dataset.hits}"][data-f="${list.dataset.anchor || "name"}"]`);
    if (!anchor || list.hidden) return;
    const box = anchor.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return (list.hidden = true);
    const width = Math.max(box.width, 320);
    const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
    const below = window.innerHeight - box.bottom - 10;
    const above = box.top - 10;
    const up = below < 200 && above > below;
    const room = Math.max(120, Math.min(300, up ? above : below));
    Object.assign(list.style, { left: `${left}px`, width: `${width}px`, maxHeight: `${room}px`, top: up ? "" : `${box.bottom + 2}px`, bottom: up ? `${window.innerHeight - box.top + 2}px` : "" });
    list.classList.toggle("is-up", up);
  }
  const placeOpenHits = () => body()?.querySelectorAll(".hof-inv-item-hits:not([hidden])").forEach(placeHits);
  const hideHits = () => body()?.querySelectorAll(".hof-inv-item-hits:not([hidden])").forEach(list => (list.hidden = true));
  function searchItems(index, q, anchor = "name") {
    clearTimeout(itemTimer);
    itemTimer = setTimeout(async () => {
      const own = ++itemTicket;
      let items = [];
      try {
        items = (await HOF.api(`/api/workspace/invoices/items?q=${encodeURIComponent(q)}`)).items;
      } catch {
        items = [];
      }
      if (own !== itemTicket) return;
      const list = body()?.querySelector(`[data-hits="${index}"]`);
      const form = view.form;
      const line = form?.lines[index];
      if (!list || !line) return;
      // 2.4.3: yanıt geldiğinde kullanıcı kutudan çıkmışsa (Tab, başka alana tıklama) liste açılmaz; açık kalan eski liste Esc'i ve
      // tıklamaları yutuyordu (Esc önce bu listeyi kapatır).
      if (document.activeElement !== body()?.querySelector(`[data-l="${index}"][data-f="${anchor}"]`)) return;
      const exactName = items.some(item => item.name.toLocaleLowerCase("tr-TR") === line.name.trim().toLocaleLowerCase("tr-TR"));
      const canCreate = offersNewItem(form) && anchor === "name" && line.name.trim() && !exactName && HOF.can("stock.manage");
      const rows = items.map(item => `<li data-item="${esc(item.id)}" data-l="${index}" class="${item.exact ? "is-exact" : ""}"><b>${item.code ? `<span class="hof-inv-hit-code">${esc(item.code)}</span> ` : ""}${esc(item.name)}</b><small>${item.kind === "service" ? "Hizmet" : item.available !== null ? `${item.available < 0 ? '<span class="hof-inv-warn">' : ""}Stokta ${esc(String(item.available).replace(".", ","))} ${esc(item.unit)}${item.available < 0 ? "</span>" : ""}` : esc(item.unit)} · ${form.side === "sale" ? `Satış ${esc(money(item.salePrice))}` : `Maliyet ${esc(money(item.unitPrice))}`}</small></li>`);
      if (canCreate) rows.push(`<li data-new-item="${index}" class="hof-inv-hit-new"><b>+ Yeni Stok Kartı: “${esc(line.name.trim())}”</b><small>Kart fatura kaydedilince açılır; birim ve Stok Kodu bu satırdan, maliyet alış fiyatından.</small></li>`);
      if (!rows.length) rows.push(`<li class="is-empty">${!q ? "Stok kartı yok." : anchor === "code" ? "Bu Stok Kodu ile ürün yok." : form.kind === "purchase" ? "Stokta bu adla ürün yok; yazdığınız ad gider kalemi olur." : "Stokta bu adla ürün yok; yazdığınız ad hizmet kalemi olur."}</li>`);
      list.innerHTML = rows.join("");
      list.dataset.items = JSON.stringify(items);
      list.dataset.anchor = anchor;
      list.hidden = false;
      placeHits(list);
    }, 180);
  }
  function pickItem(index, itemId, { focus = true } = {}) {
    const form = view.form;
    const list = body()?.querySelector(`[data-hits="${index}"]`);
    const items = JSON.parse(list?.dataset.items || "[]");
    const item = items.find(entry => entry.id === itemId);
    const line = form?.lines[index];
    if (!item || !line) return;
    // Seçimden sonra bekleyen/yolda olan arama yanıtı listeyi yeniden açmasın (13.10.2026: yavaş sunucuda geç gelen yanıt seçili satırın
    // üstüne listeyi geri getiriyordu).
    clearTimeout(itemTimer);
    itemTicket += 1;
    // Önce odaktaki kutudan çık: çıkarken tetiklenen "change" yazılan değeri ("fk-a4") satıra geri yazmasın; sonra
    // kartın adı ve Stok Kodu yazılır ve satır yeniden çizilir (odak korunması yazılan metni de geri getirmez).
    if (focus) document.activeElement?.blur?.();
    Object.assign(line, { itemId: item.id, name: item.name, pickedName: item.name, code: item.code || "", unit: item.unit || "Adet", itemKind: item.kind, available: item.available, newItem: false, newSalePrice: "" });
    // 2.4.3 (H8): stok kartında KDV oranı tanımlıysa kalemin KDV'si ondan gelir (kullanıcı değiştirebilir); tanımsızsa formun varsayılanı kalır.
    if (item.vatRate !== null && item.vatRate !== undefined && item.vatRate !== "") line.vatRate = String(item.vatRate);
    const price = form.side === "sale" ? item.salePrice : item.unitPrice;
    if (price > 0 && !line.unitPrice) line.unitPrice = priceText(form.pricesIncludeVat ? Math.round(price * (1 + Number(line.vatRate || 0) / 100) * 100) / 100 : price);
    if (list) list.hidden = true;
    renderLines();
    loadPrices(index);
    scheduleCalc();
    if (focus) body()?.querySelector(`[data-l="${index}"][data-f="qty"]`)?.focus();
  }
  // "+ Yeni Stok Kartı": kalem stoklu mal olur; kart, fatura (ya da taslak) kaydedilince aynı işlemde açılır.
  function markNewItem(index) {
    const line = view.form?.lines[index];
    if (!line) return;
    Object.assign(line, { newItem: true, itemId: "", itemKind: "", available: null, expenseCode: "" });
    hideHits();
    renderLines();
    scheduleCalc(0);
    // 2.4.3 (keşif B13): stoktan seçilen kalemdeki gibi odak Miktar'da (önceden Birim'e atlıyordu; hızlı yazan miktarı Birim kutusuna yazıyordu).
    body()?.querySelector(`[data-l="${index}"][data-f="qty"]`)?.focus();
  }

  // ---------- Ödeme ----------
  // v2.0.16: kart yolu yöne göre — satışta (tahsilat) POS, alışta (ödeme) Kredi Kartı.
  // v2.0.17: iade belgesinde karta iade "POS İadesi" (satıştan iade) / "Kredi Kartı İadesi" (alıştan iade).
  const refundMethods = kind => {
    const base = (kind && (["sale", "smm", "purchase_return"].includes(kind) ? meta.methodsIn : meta.methodsOut)) || meta.methods || { cash: "Nakit" };
    if (kind === "sale_return") return { ...base, card: "POS İadesi" };
    if (kind === "purchase_return") return { ...base, card: "Kredi Kartı İadesi" };
    return base;
  };
  // v2.2.0 (İz 2.8; müşteri 12.10.2026: "peşin ödemede herkesin aklına nakit gelir"): ödeme satırı yola göre eklenir ("+ Nakit", "+ Havale / EFT",
  // "+ Kredi Kartı" / satışta "+ POS"); satırın başlığı yolun adıdır, yol kutusu yok. Kayıt biçimi DEĞİŞMEDİ (payment.cash[]: amount, method,
  // bankAccountId, lineKey).
  const methodLabel = (method, kind = view.form?.kind) => {
    const label = refundMethods(kind)[method];
    return typeof label === "string" ? label : label?.label || method;
  };
  const payWays = kind => Object.keys(refundMethods(kind));
  const paidSum = form => [...form.pay.cash, ...form.pay.cheques].reduce((sum, item) => sum + amountNum(item.amount), 0) + (form.portfolio || []).filter(item => form.pay.endorse.includes(item.id)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  // 2.8: "Kalanın Tamamını Öde" / "… Tahsil Et" (önceki "Tamamı Peşin"): kalan = ödenecek − girilen bütün ödemeler; tıklanınca yol sorulur.
  const payableOf = form => (form.calc ? form.calc.try?.payable ?? form.calc.totals.payable : 0);
  const restOf = form => Math.round((payableOf(form) - paidSum(form)) * 100) / 100;
  const restVerb = form => (["sale", "smm", "purchase_return"].includes(form.kind) ? "Kalanın Tamamını Tahsil Et" : "Kalanın Tamamını Öde");
  function renderPay() {
    const form = view.form;
    const slot = body()?.querySelector("[data-pay]");
    if (!slot || !form) return;
    const ret = isReturn(form.kind);
    const sale = form.side === "sale";
    const chequeOk = meta.canCheques && ["sale", "smm", "purchase"].includes(form.kind);
    // 2.8: satır başlığı yolun adı ("Nakit · Tutar", "Havale / EFT · Tutar · Banka Hesabı", "Kredi Kartı · Tutar · Kredi Kartı").
    const cashRows = form.pay.cash
      .map((item, index) => `<div class="hof-inv-pay-row" data-pay-method="${esc(item.method)}"><b class="hof-inv-pay-way">${esc(methodLabel(item.method))}</b><label><span>Tutar (₺)</span><input data-pay="cash" data-i="${index}" data-f="amount" inputmode="decimal" value="${esc(item.amount)}" placeholder="0,00" aria-label="${esc(methodLabel(item.method))} Tutarı"></label>${bankCell(item, index)}${posCell(item, index)}<button type="button" class="hof-mini hof-mini-danger" data-act="pay-remove" data-pay="cash" data-i="${index}" aria-label="Sil" title="Sil">×</button>${rowBalanceHtml(item, index)}</div>`)
      .join("");
    const chequeRows = form.pay.cheques
      .map(
        (item, index) => `<div class="hof-inv-pay-row is-cheque"><label><span>Evrak</span><select data-pay="cheques" data-i="${index}" data-f="instrument"><option value="cheque" ${item.instrument === "cheque" ? "selected" : ""}>Çek</option><option value="note" ${item.instrument === "note" ? "selected" : ""}>Senet</option></select></label><label><span>Tutar (₺)</span><input data-pay="cheques" data-i="${index}" data-f="amount" inputmode="decimal" value="${esc(item.amount)}"></label><label><span>Vade</span><input type="date" data-pay="cheques" data-i="${index}" data-f="dueDate" value="${esc(item.dueDate)}" min="${esc(form.issueDate)}"></label><label><span>No</span><input data-pay="cheques" data-i="${index}" data-f="serialNo" maxlength="60" value="${esc(item.serialNo)}"></label>${chequeBankCell(item, index)}${sale ? `<label><span>Keşideci</span><input data-pay="cheques" data-i="${index}" data-f="drawer" maxlength="160" value="${esc(item.drawer)}" placeholder="Boşsa cari"></label>` : ""}<button type="button" class="hof-mini hof-mini-danger" data-act="pay-remove" data-pay="cheques" data-i="${index}" aria-label="Sil" title="Sil">×</button></div>`,
      )
      .join("");
    const endorse =
      form.kind === "purchase" && chequeOk
        ? form.portfolio
          ? form.portfolio.length
            ? `<div class="hof-inv-endorse"><b>Portföyden Ciro Edilecek Çek / Senet</b>${form.portfolio.map(item => `<label class="hof-rep-check"><input type="checkbox" data-endorse="${esc(item.id)}" ${form.pay.endorse.includes(item.id) ? "checked" : ""}> ${esc(item.instrumentLabel || "Çek")} ${esc(item.serialNo || "")} · ${esc(item.party || item.accountName || "")} · vade ${esc(HOF.formatDate(item.dueDate))} · <b>${esc(money(item.amount))}</b></label>`).join("")}</div>`
            : '<p class="hof-muted">Portföyde ciro edilebilecek evrak yok.</p>'
          : ""
        : "";
    const restBlock = restHtml(form);
    slot.innerHTML = `<h4>${ret ? "İade Ödemesi" : "Ödeme"}</h4>
      ${cashRows}${chequeRows}${endorse}
      <div class="hof-inv-pay-add">
        ${payWays(form.kind).map(method => `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-add-cash" data-method="${esc(method)}">+ ${esc(methodLabel(method))}</button>`).join("")}
        ${chequeOk ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-add-cheque">+ Çek / Senet</button>` : ""}
        ${form.kind === "purchase" && chequeOk && !form.portfolio ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-endorse">Portföyden Ciro Et</button>' : ""}
        <button type="button" class="hof-button hof-button-small" data-act="pay-rest" ${restOf(form) > 0.004 ? "" : "disabled"}>${esc(restVerb(form))}</button>
      </div>
      <div class="hof-inv-pay-choose" data-pay-choose hidden><span>Kalan <b data-pay-choose-amount>${esc(money(Math.max(0, restOf(form))))}</b> hangi yolla ${paySign() > 0 ? "tahsil edilsin" : "ödensin"}?</span>${payWays(form.kind).map(method => `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-rest-method" data-method="${esc(method)}">${esc(methodLabel(method))}</button>`).join("")}<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-rest-cancel">Vazgeç</button></div>
      <div data-pay-rest>${restBlock}</div>`;
    const box = slot.querySelector("[data-pay-rest]");
    if (box) box.hofHtml = restBlock;
    if (!view.bankChoices) loadBankChoices();
    // 2.2.0 (İz 3.2): POS satırlarının önizlemesi ve satıştan iadede asıl işlem önerisi.
    form.pay.cash.forEach((item, index) => posRow(item) && syncPosCell(index));
    loadPosOrigins();
  }
  // v2.1.0 Aşama 7: peşin satırda Banka Hesabı (yalnız Havale / EFT yolunda görünür). Seçici satırın İÇİNDE çizilir; yol ya da hesap değişince satır
  // yeniden çizilmez (2.0.23 Bulgu 1: odak ve yazılan değer kaybolmasın) — yalnız hücre gösterilir/gizlenir. Hiç uygun hesap yoksa hücre boş
  // (bugünkü gibi hesapsız), tek hesapta bilgi satırı (sunucu kendiliğinden o hesaba yazar), birden çokta seçim zorunlu.
  // K2 (plan §3.5, §4.6, §8.9): satırın hesap ailesi yoldan ve belge türünden — Havale / EFT → Banka Hesabı; alış tarafında (alış faturası,
  // alıştan iade) Kredi Kartı → Kurumsal Kart; satış tarafında kart yolu POS'tur (2.2.0; hücre yok).
  const cellKind = item => (item.method === "bank" ? "bank" : item.method === "card" && view.form?.side === "purchase" ? "card" : "");
  const bankAccounts = (kind = "bank") => {
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    return { data, list: (data?.forms?.[kind]?.ids || []).map(id => data.accounts.find(account => account.id === id)).filter(Boolean) };
  };
  function bankCell(item, index) {
    const kind = cellKind(item) || "bank";
    const hidden = cellKind(item) ? "" : " hidden";
    const card = kind === "card";
    const legacy = item.legacy && item.legacyMethod === item.method;
    const { data, list } = bankAccounts(kind);
    const current = item.bankAccountId ? data?.accounts?.find(account => account.id === item.bankAccountId) : null;
    if (!data) return `<span class="hof-inv-bank" data-bank-cell="${index}" data-bank-kind="${kind}" hidden></span>`;
    // v2.2.0 (İz 2.4; kullanıcı isteği 12.10.2026): hiç hesap/kart yoksa hücrede "Banka Hesabı Tanımla" / "Kredi Kartı Tanımla" (form kapanmadan
    // tanım penceresi; kaydedince satırda seçili gelir); tanımlama yetkisi yoksa "… tanımlı değil, yöneticinize başvurun". Önceden hücre GİZLİYDİ.
    if (!list.length && !current) return `<span class="hof-inv-bank" data-bank-cell="${index}" data-bank-kind="${kind}" data-bank-empty${hidden}>${HOF.bank?.defineHtml?.(kind) || ""}</span>`;
    const shown = account => `${account.label}${account.cardLast4 ? ` •••• ${account.cardLast4}` : ""}`;
    if (list.length === 1 && !legacy && (!item.bankAccountId || item.bankAccountId === list[0].id)) return `<span class="hof-inv-bank hof-bank-pick-note" data-bank-cell="${index}" data-bank-kind="${kind}" data-bank-single${hidden}>${esc(shown(list[0]))} ${card ? "kredi kartına" : "hesabına"} yazılır.</span>`;
    const options = current && !list.some(account => account.id === current.id) ? [current, ...list] : list;
    const first = legacy ? "Atanmamış (Eski Hareket)" : card ? "Kart Seçin" : "Hesap Seçin";
    const label = card ? "Kredi Kartı" : "Banka Hesabı";
    // 2.7: seçenek adında hesabın fatura tarihindeki bakiyesi (Banka Görüntüleme yetkisine), seçilenin altında "Bakiye · İşlemden Sonra".
    const optionText = account => (HOF.bank?.optionText ? HOF.bank.optionText(account, data) : `${account.label} (${account.code})`);
    return `<label class="hof-inv-bank" data-bank-cell="${index}" data-bank-kind="${kind}"${hidden}><span>${label}</span><select data-pay="cash" data-i="${index}" data-f="bankAccountId" aria-label="${label}"><option value="">${esc(first)}</option>${options.map(account => `<option value="${esc(account.id)}" ${account.id === item.bankAccountId ? "selected" : ""}>${esc(optionText(account))}</option>`).join("")}<option value="none" ${item.bankAccountId === "none" ? "selected" : ""}>Hesapsız (Açılıştan Önce)</option></select>${item.bankAccountId === "none" ? noneNoteHtml(card) : ""}</label>`;
  }
  /**
   * v2.2.0 (İz 3.2; plan §8.9): satış tarafında kart yolu ("+ POS"; iadede "+ POS İadesi") POS hücresi — POS (tekse bilgi satırı, çoksa seçim,
   * yoksa "POS Tanımla"), POS Taksit Sayısı (yalnız tanımlı oranlar), Provizyon No, Kartın Son 4 Hanesi ve önizleme; satıştan iadede Asıl POS
   * İşlemi (asıl faturanın POS satışları önerilir) ve "Kaynaksız (Eski Satış)". Kurucular hof-bank-pos.js'te (HOF.bank.posCellHtml). Satır
   * yeniden çizilmez; yalnız POS seçimi değişince bu hücre çizilir (2.0.23 Bulgu 1).
   */
  const posRow = item => item?.method === "card" && view.form?.side === "sale";
  function posCell(item, index) {
    if (!posRow(item)) return "";
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    if (!data || !HOF.bank?.posCellHtml) return `<span class="hof-inv-pos" data-pos-cell="${index}"></span>`;
    // Çok POS'ta seçici varsayılanı (Banka Ayarları → Varsayılan POS) satırın modeline yazılır (ekranda seçili görünen gönderilsin).
    if (!item.posId && (data.pos || []).length > 1) item.posId = HOF.bank.posSelected(data, "");
    const refund = view.form.kind === "sale_return";
    const result = HOF.bank.posCellHtml(data, item, index, { refund, origins: refund ? (view.form.posOrigins ?? null) : null });
    return `<span class="hof-inv-pos" data-pos-cell="${index}" data-pos-mode="${esc(result.mode)}">${result.html}</span>`;
  }
  /** Hücre çizildikten sonra: ekranda seçili taksit modele yazılır (oranı olmayan taksit kalmasın) ve önizleme. */
  function syncPosCell(index) {
    const form = view.form;
    const item = form?.pay.cash[index];
    const cell = body()?.querySelector(`[data-pay] [data-pos-cell="${index}"]`);
    if (!item || !cell) return;
    const installments = cell.querySelector('[data-f="posInstallments"]');
    if (installments) item.posInstallments = installments.value;
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    if (!data || !HOF.bank?.posPreviewInto || form.kind === "sale_return") return;
    HOF.bank.posPreviewInto(cell.querySelector("[data-pos-preview]"), { posId: HOF.bank.posSelected(data, item.posId), amount: amountNum(item.amount), installments: item.posInstallments || 1, date: form.issueDate });
  }
  function redrawPosCells({ only = -1 } = {}) {
    const form = view.form;
    body()
      ?.querySelectorAll("[data-pay] [data-pos-cell]")
      .forEach(cell => {
        const index = Number(cell.dataset.posCell);
        const item = form?.pay.cash[index];
        if (!item || (only >= 0 && index !== only)) return;
        cell.outerHTML = posCell(item, index);
        syncPosCell(index);
      });
  }
  /** Satıştan iadede asıl faturanın POS satışları (Asıl POS İşlemi önerisi); bir kez yüklenir. */
  function loadPosOrigins() {
    const form = view.form;
    if (!form || form.kind !== "sale_return" || !form.original?.id || form.posOrigins !== undefined || !HOF.bank?.posOrigins) return;
    if (!form.pay.cash.some(posRow)) return;
    form.posOrigins = null;
    HOF.bank
      .posOrigins(`invoice=${encodeURIComponent(form.original.id)}`)
      .then(list => {
        if (view.form !== form) return;
        form.posOrigins = list;
        redrawPosCells();
      })
      .catch(() => {
        form.posOrigins = [];
      });
  }
  /**
   * v2.2.0 (İz 2.7): peşin satırın hesabının bakiye satırı. Aynı hesaba yazan bütün satırların toplamı "İşlemden Sonra"ya girer (satış/SMM ve
   * alıştan iade tahsilat: giriş; alış ve satıştan iade ödeme: çıkış; kredi kartıyla ödeme kart borcunu artırır). Düzenle'de kaydedilmiş belgenin
   * peşin satırları bakiyede zaten var (payOriginal). Bakiye yalnız Banka Görüntüleme yetkisine gelir; yoksa satır yok.
   */
  const paySign = () => (["sale", "smm", "purchase_return"].includes(view.form?.kind) ? 1 : -1);
  function cellAccount(item, kind) {
    if (!item || item.bankAccountId === "none") return "";
    if (item.bankAccountId) return item.bankAccountId;
    const { list } = bankAccounts(kind);
    return list.length === 1 && !(item.legacy && item.legacyMethod === item.method) ? list[0].id : "";
  }
  function cellBalanceHtml(item, kind) {
    const form = view.form;
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    const id = cellAccount(item, kind);
    if (!form || !data?.balances || !id || !HOF.bank?.balanceLine) return "";
    const change = paySign() * form.pay.cash.filter(row => cellKind(row) === kind && cellAccount(row, kind) === id).reduce((sum, row) => sum + Math.round(amountNum(row.amount) * 100), 0);
    const own = form.payOriginal?.refs?.[id] || 0;
    return HOF.bank.balanceLine(data, id, { change, original: own ? { minor: own, date: form.payOriginal.date } : null });
  }
  /** Satırın bakiye satırı (satırın altında tam genişlik; satırın alanları hizalı kalır). */
  const rowBalanceHtml = (item, index) => `<div class="hof-inv-balance" data-inv-balance="${index}">${cellKind(item) ? cellBalanceHtml(item, cellKind(item)) : ""}</div>`;
  /** Tutar, yol ya da hesap değişince bakiye satırları yerinde güncellenir (satırlar yeniden çizilmez; 2.0.23 Bulgu 1). */
  function syncInvoiceBalances() {
    const form = view.form;
    if (!form) return;
    body()
      ?.querySelectorAll("[data-pay] [data-inv-balance]")
      .forEach(box => {
        const item = form.pay.cash[Number(box.dataset.invBalance)];
        const cell = box.closest(".hof-inv-pay-row")?.querySelector("[data-bank-cell]");
        const html = item && cell && !cell.hidden ? cellBalanceHtml(item, cell.dataset.bankKind) : "";
        if (box.innerHTML !== html) box.innerHTML = html;
      });
  }
  // Fatura tarihi değişince yalnız bakiyeler sunucudan (seçenek adları yerinde güncellenir).
  let balanceSeq = 0;
  async function reloadInvoiceBalances() {
    const form = view.form;
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    if (!form || !data?.balances || !HOF.bank?.balances) return;
    const seq = (balanceSeq += 1);
    const fresh = await HOF.bank.balances(form.issueDate);
    if (seq !== balanceSeq || view.form !== form || view.bankChoices !== data || !fresh.balances) return;
    view.bankChoices = { ...data, balances: fresh.balances, cash: fresh.cash };
    body()
      ?.querySelectorAll("[data-pay] [data-bank-cell] select option[value]")
      .forEach(option => {
        const account = option.value && option.value !== "none" ? view.bankChoices.accounts.find(row => row.id === option.value) : null;
        if (account) option.textContent = HOF.bank.optionText(account, view.bankChoices);
      });
    syncInvoiceBalances();
  }
  /**
   * v2.2.0 (İz 2.5–2.6): alış faturasında verilen evrakın hesap hücresi. Çek → "Çek Hesabı" (Çek Kullan işaretli; tekse bilgi satırı — kimlik
   * gönderilmez, sunucu o hesabı seçer —, çoksa seçim, yoksa "Banka / Şube" metni + "Çek Hesabı Tanımla"); senet → "Ödeme Hesabı (Öneri)"
   * (Senet Kullan işaretli; isteğe bağlı) yoksa metin. Satış (alınan evrak): müşterinin bankası, metin (bugünkü gibi).
   */
  function chequeBankCell(item, index) {
    const textCell = extra => `<span class="hof-inv-chq-bank" data-cheque-bank="${index}"><label><span>Banka / Şube</span><input data-pay="cheques" data-i="${index}" data-f="bank" maxlength="120" value="${esc(item.bank)}"></label>${extra || ""}</span>`;
    if (view.form?.side !== "purchase") return textCell();
    const data = view.bankChoices && view.bankChoices !== "loading" ? view.bankChoices : null;
    if (!data) return textCell();
    const note = item.instrument === "note";
    const list = (data.forms?.[note ? "note" : "cheque"]?.ids || []).map(id => data.accounts.find(account => account.id === id)).filter(Boolean);
    if (!list.length) return textCell(note ? "" : HOF.bank?.defineHtml?.("cheque") || "");
    if (!note && list.length === 1 && (!item.bankAccountId || item.bankAccountId === list[0].id)) return `<span class="hof-inv-chq-bank hof-bank-pick-note" data-cheque-bank="${index}" data-cheque-single>Çek Hesabı: ${esc(list[0].label)}</span>`;
    const label = note ? "Ödeme Hesabı (Öneri)" : "Çek Hesabı";
    const first = note ? "Önerilmez" : "Hesap Seçin";
    return `<span class="hof-inv-chq-bank" data-cheque-bank="${index}"><label><span>${label}</span><select data-pay="cheques" data-i="${index}" data-f="bankAccountId" aria-label="${label}"><option value="">${first}</option>${list.map(account => `<option value="${esc(account.id)}" ${account.id === item.bankAccountId ? "selected" : ""}>${esc(HOF.bank?.optionText ? HOF.bank.optionText(account, data) : `${account.label} (${account.code})`)}</option>`).join("")}</select></label></span>`;
  }
  // Liste gelince ya da tanım kaydedilince hücre yeniden kurulur; kullanıcı o an hücrenin "Banka / Şube" kutusuna yazıyorsa kutu yeniden
  // çizilmez (2.0.23 Bulgu 1: yazılan harfler kaybolmasın) — yalnız "Çek Hesabı Tanımla" kutusu eklenir.
  function refreshChequeCell(cell) {
    const index = Number(cell.dataset.chequeBank);
    const item = view.form?.pay.cheques[index];
    if (!item) return;
    const html = chequeBankCell(item, index);
    if (cell.contains(document.activeElement) && document.activeElement.matches?.('[data-f="bank"]') && html.includes('data-f="bank"')) {
      if (!cell.querySelector("[data-bank-define-box]") && html.includes("data-bank-define-box")) cell.insertAdjacentHTML("beforeend", HOF.bank?.defineHtml?.("cheque") || "");
      return;
    }
    cell.outerHTML = html;
  }
  // 11.10.2026: "Hesapsız (Açılıştan Önce)" seçiliyken satırda not (modül formlarındaki seçicinin notuyla aynı metin, HOF.bank.noneNote).
  const noneNoteHtml = card => `<small class="hof-bank-pick-note" data-bank-none>${esc(HOF.bank?.noneNote?.(card) || "")}</small>`;
  function syncNoneNote(select) {
    const cell = select.closest("[data-bank-cell]");
    if (!cell) return;
    const note = cell.querySelector("[data-bank-none]");
    if (select.value === "none" && !note) cell.insertAdjacentHTML("beforeend", noneNoteHtml(cell.dataset.bankKind === "card"));
    else if (select.value !== "none" && note) note.remove();
  }
  // Hesap listesi gelince yalnız boş hücreler doldurulur (içinde odaklanılacak alan yoktu; satır yeniden çizilmez).
  // Banka m1 (10.10.2026): liste form açılışında sunucudan TAZE alınır (önbellek yalnız canlı olayla boşalıyordu; başka oturumun açtığı ikinci
  // kart görünmüyordu). Sunucu "kart/hesap seçin" derse (bank-account-required) hücreler taze listeyle yeniden çizilir (aşağıda).
  function loadBankChoices() {
    if (!HOF.bank?.choices || view.bankChoices) return;
    view.bankChoices = "loading";
    HOF.bank
      .choices(true, view.form?.issueDate || "")
      .then(data => {
        view.bankChoices = data;
        const form = view.form;
        body()
          ?.querySelectorAll("[data-pay] [data-bank-cell]")
          .forEach(cell => {
            const item = form?.pay.cash[Number(cell.dataset.bankCell)];
            if (!item) return;
            if (item.method === "bank" && !item.bankAccountId && !item.legacy) item.bankAccountId = defaultBank();
            cell.outerHTML = bankCell(item, Number(cell.dataset.bankCell));
          });
        body()
          ?.querySelectorAll("[data-pay] [data-cheque-bank]")
          .forEach(cell => refreshChequeCell(cell));
        // 2.2.0 (İz 3.2): POS hücreleri liste gelince kurulur (içlerinde henüz yazılmış alan yoktu).
        redrawPosCells();
        syncInvoiceBalances();
      })
      .catch(() => {
        view.bankChoices = null;
      });
  }
  /**
   * v2.2.0 (İz 2.4): "… Tanımla" ile kaydedilen hesap/kart. Liste sunucudan tazelenir; tanımın yapıldığı satır yeni hesabı alır (tek hesapsa bilgi
   * satırı, çoksa seçili), aynı türün öbür boş hücreleri de yeni listeyle çizilir. Satırın tutar/yol alanları yeniden çizilmez (2.0.23 Bulgu 1).
   */
  async function onBankDefined(event) {
    const { kind, account } = event.detail || {};
    const form = view.form;
    const cell = event.target.closest?.("[data-bank-cell]");
    if (!form || !account?.id || !["bank", "card", "cheque", "pos"].includes(kind)) return;
    try {
      view.bankChoices = await HOF.bank.choices(true, form.issueDate);
    } catch {
      return;
    }
    if (view.form !== form) return;
    // 2.2.0 (İz 3.2): "POS Tanımla" — tanımın yapıldığı satır yeni POS'u alır; POS hücreleri yeni listeyle (tutar alanları yerinde kalır).
    if (kind === "pos") {
      const posCellNode = event.target.closest?.("[data-pos-cell]");
      const at = posCellNode ? Number(posCellNode.dataset.posCell) : -1;
      if (form.pay.cash[at]) form.pay.cash[at].posId = account.id;
      redrawPosCells();
      (body()?.querySelector(`[data-pos-cell="${at}"] select`) || body()?.querySelector(`[data-pay="cash"][data-i="${at}"][data-f="amount"]`))?.focus();
      return;
    }
    // 2.5: "Çek Hesabı Tanımla" — tanımın yapıldığı evrak satırı yeni hesabı alır; öbür çek hücreleri yeni listeyle.
    if (kind === "cheque") {
      const chequeCell = event.target.closest?.("[data-cheque-bank]");
      const at = chequeCell ? Number(chequeCell.dataset.chequeBank) : -1;
      if (form.pay.cheques[at]) form.pay.cheques[at].bankAccountId = account.id;
      body()
        ?.querySelectorAll("[data-pay] [data-cheque-bank]")
        .forEach(node => {
          const position = Number(node.dataset.chequeBank);
          const item = form.pay.cheques[position];
          if (item) node.outerHTML = chequeBankCell(item, position);
        });
      (body()?.querySelector(`[data-cheque-bank="${at}"] select`) || body()?.querySelector(`[data-pay="cheques"][data-i="${at}"][data-f="serialNo"]`))?.focus();
      return;
    }
    const index = cell ? Number(cell.dataset.bankCell) : -1;
    const own = form.pay.cash[index];
    if (own && cellKind(own) === kind) {
      own.bankAccountId = account.id;
      own.legacy = false;
    }
    body()
      ?.querySelectorAll("[data-pay] [data-bank-cell]")
      .forEach(node => {
        const position = Number(node.dataset.bankCell);
        const item = form.pay.cash[position];
        if (!item || (position !== index && !node.hasAttribute("data-bank-empty"))) return;
        node.outerHTML = bankCell(item, position);
      });
    syncInvoiceBalances();
    const next = body()?.querySelector(`[data-bank-cell="${index}"] select`) || body()?.querySelector(`[data-pay="cash"][data-i="${index}"][data-f="amount"]`);
    next?.focus();
  }
  // Varsayılan yalnız havalede (Banka Ayarları → Varsayılan Tahsilat Hesabı); kurumsal kartta birden çok kart varsa kullanıcı seçer (§3.5/3).
  const defaultBank = () => {
    const { data, list } = bankAccounts("bank");
    return list.length > 1 ? data.forms.bank.defaultId || "" : "";
  };
  // Yol değişince: hücre gösterilir/gizlenir; havaleye geçen yeni satıra varsayılan hesap önerilir (Banka Ayarları → Varsayılan Tahsilat Hesabı).
  // K2: hesap ailesi değişirse (Havale / EFT ↔ Kredi Kartı) yalnız bu hücre yeniden çizilir (yol kutusu ve satırın öbür alanları yerinde
  // kalır; odak yol kutusundadır) ve önceki ailenin hesabı satırdan düşer.
  function syncBankCell(target, item) {
    const cell = target.closest(".hof-inv-pay-row")?.querySelector("[data-bank-cell]");
    if (!cell) return;
    const kind = cellKind(item);
    if (kind && cell.dataset.bankKind !== kind) {
      item.bankAccountId = kind === "bank" && !(item.legacy && item.legacyMethod === "bank") ? defaultBank() : "";
      cell.outerHTML = bankCell(item, Number(cell.dataset.bankCell));
      return;
    }
    if (kind === "bank" && !item.bankAccountId && !item.legacy) {
      item.bankAccountId = defaultBank();
      const select = cell.querySelector("select");
      if (select) select.value = item.bankAccountId;
    }
    cell.hidden = !kind || (!cell.querySelector("select") && !cell.hasAttribute("data-bank-single") && !cell.hasAttribute("data-bank-empty"));
  }
  // v2.0.23 (Bulgu 1): "Kalan" kutusu ayrı çizilir. Ödeme satırındaki bir alan değişince (tutar, vade, no, banka, yol) yalnız
  // bu kutu yenilenir; satırlar yeniden çizilmez. Önceden bütün bölüm yeniden çiziliyordu: Tab ile ya da fareyle gidilen
  // alan sayfadan kopuyor, yazılanlar başka kutuya (ör. tutara) gidiyordu.
  function restHtml(form) {
    const ret = isReturn(form.kind);
    const sale = form.side === "sale";
    const payable = form.calc ? form.calc.try?.payable ?? form.calc.totals.payable : 0;
    const planOk = meta.canPlans && ["sale", "smm"].includes(form.kind);
    const rest = Math.round((payable - paidSum(form)) * 100) / 100;
    return ret
      ? rest > 0.004
        ? `<p class="hof-inv-rest">Kalan <b>${esc(money(rest))}</b> carinin bakiyesinden düşülür (mahsup).</p>`
        : ""
      : rest > 0.004
        ? `<div class="hof-inv-rest"><p>Kalan <b>${esc(money(rest))}</b>:</p>
            <label class="hof-rep-check"><input type="radio" name="hof-inv-rest" data-rest="open" ${form.pay.rest !== "installments" ? "checked" : ""}> Açık Hesap (Vadeli)</label>
            ${planOk ? `<label class="hof-rep-check"><input type="radio" name="hof-inv-rest" data-rest="installments" ${form.pay.rest === "installments" ? "checked" : ""}> Taksitlendir</label>` : ""}
            ${
              form.pay.rest === "installments" && planOk
                ? `<div class="hof-inv-pay-row"><label><span>Taksit Sayısı</span><input data-payf="installments.count" inputmode="numeric" value="${esc(form.pay.installments.count)}"></label><label><span>İlk Vade</span><input type="date" data-payf="installments.firstDue" value="${esc(form.pay.installments.firstDue)}" min="${esc(form.issueDate)}"></label><label><span>Aralık (Ay)</span><input data-payf="installments.everyMonths" inputmode="numeric" value="${esc(form.pay.installments.everyMonths)}"></label></div><small>Taksit kartı açılır; tahsilatlar taksitten düşer.</small>`
                : `<div class="hof-inv-pay-row"><label><span>Vade Tarihi</span><input type="date" data-payf="dueDate" value="${esc(form.pay.dueDate)}" min="${esc(form.issueDate)}"></label></div><small>${sale ? "Carinin borcu olarak kalır; Vade Takip'te görünür." : "Tedarikçiye borç olarak kalır; Vade Takip'te görünür."}</small>`
            }
          </div>`
        : form.calc
          ? `<p class="hof-inv-rest is-done">${sale ? "Tamamı tahsil edildi." : "Tamamı ödendi."}</p>`
          : "";
  }
  // İçerik değişmediyse kutu yeniden çizilmez: tutardan fareyle doğrudan kutudaki bir alana (Vade Tarihi, Taksit Sayısı)
  // geçilirken tutarın "change" olayı tıklanan alanı yok etmesin.
  function renderRest() {
    const form = view.form;
    const box = body()?.querySelector("[data-pay] [data-pay-rest]");
    if (!form || !box) return renderPay();
    // 2.8: "Kalanın Tamamını …" düğmesi ve yol sorusundaki tutar (satırlar yeniden çizilmez).
    const rest = restOf(form);
    const button = body()?.querySelector('[data-pay] [data-act="pay-rest"]');
    if (button) button.disabled = !(rest > 0.004);
    const amount = body()?.querySelector("[data-pay] [data-pay-choose-amount]");
    if (amount) amount.textContent = money(Math.max(0, rest));
    if (!(rest > 0.004)) {
      const choose = body()?.querySelector("[data-pay] [data-pay-choose]");
      if (choose) choose.hidden = true;
    }
    const html = restHtml(form);
    if (box.hofHtml === html) return;
    box.hofHtml = html;
    box.innerHTML = html;
  }

  // ---------- Toplamlar (sunucunun hesap motorundan) ----------
  function renderTotals() {
    const form = view.form;
    const slot = body()?.querySelector("[data-totals]");
    if (!slot || !form) return;
    const c = form.calc;
    if (!c) {
      slot.innerHTML = `<h4>Toplamlar</h4><p class="hof-muted">${esc(form.calcError || (form.account ? "Kalem girince toplamlar burada hesaplanır." : "Cari ve en az bir kalem girilince toplamlar burada hesaplanır."))}</p>`;
      return;
    }
    const t = c.totals;
    const cur = c.currency;
    const row = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd>${esc(curMoney(value, cur))}</dd></div>`;
    // 2.4.4 (UX15): numara / tarih çakışması (dönem kilidi, seri sırası, elle numara) ve numaranın kayıtta verilmeyeceği durum onaydan önce görünür.
    const problems = [...(c.partyProblems || []), ...(c.sellerProblems || []), ...(c.warnings || []), ...(c.numbering || []), ...(c.orderHold ? [c.orderHold.text] : [])];
    const receipt = form.kind === "smm" ? receiptRows({ ...t, stoppageRate: c.stoppageRate }) : null;
    slot.innerHTML = `<h4>Toplamlar</h4>
      <dl class="hof-inv-totals">
        ${
          receipt
            ? receipt.map(([label, value], index) => row(esc(label), value, index === receipt.length - 1 ? "is-total" : "")).join("")
            : `${totalRows({ includeVat: form.pricesIncludeVat, base: t.base, baseNet: t.baseNet, discountNet: t.discountNet, discount: t.discount, net: t.net }).map(([label, value]) => row(label, value)).join("")}
        ${t.byRate.map(item => row(`KDV %${item.rate}`, item.vat)).join("")}
        ${t.withheld > 0 ? row("KDV Tevkifatı", -t.withheld) : ""}
        ${t.stoppage > 0 ? row(`Gelir Vergisi Stopajı %${esc(String(c.stoppageRate))}`, -t.stoppage) : ""}
        ${row("Genel Toplam", t.gross, "is-total")}
        ${t.payable !== t.gross ? row(form.side === "sale" ? "Tahsil Edilecek" : "Ödenecek", t.payable, "is-payable") : ""}`
        }
        ${cur !== "TRY" ? `<div><dt>TL Karşılığı</dt><dd>${esc(money(c.try.payable))}</dd></div>` : ""}
      </dl>
      <p class="hof-inv-words">${esc(c.amountInWords || "")}</p>
      ${problems.length ? `<ul class="hof-inv-problems">${problems.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
      ${partyFix(form, c)}`;
  }
  // 2.4.4 (uzman UX9): alıcının e-Belge bilgisi eksik/hatalıysa (il, vergi dairesi, VKN…) cari formdan ayrılmadan düzeltilir. Kural (en yaygın
  // muhasebe programlarındaki gibi): faturanın alıcı bilgisi cari kartından gelir; düzeltme CARİ KARTINA yazılır (bu ve sonraki faturalar onunla
  // kesilir) — bildirimde söylenir. Kesilmiş belgenin alıcı bilgisi kayıt anında donmuştur (party_json), değişmez. Denetim sunucuda kalır.
  // Nihai Tüketici (paylaşılan 11111111111 carisi) düzenlenmez: tutar sınırı aşılınca gerçek alıcının carisi seçilir ya da açılır.
  // 31f U5: ipucu YALNIZ sorun tutar sınırıysa (sunucu partyLimit; kimliğe bakılmaz) — 11111111111'li caride öbür eksiklerde (il, ad…) de
  // "Cariyi Düzenle" çıkar; sorun listesi asıl eksikliği zaten söyler.
  function partyFix(form, c) {
    if (!form.account?.id || !(c.partyProblems || []).length) return "";
    if (c.partyLimit) return '<p class="hof-muted hof-inv-party-hint" data-party-hint>Bu tutarda gerçek alıcı gerekir: müşterinin kendi carisini seçin ya da “+ Yeni Cari” ile TC kimlik numarası, adı soyadı ve adresiyle açın.</p>';
    if (!HOF.accounts?.editFor || !HOF.can("accounts.manage")) return '<p class="hof-muted hof-inv-party-hint" data-party-hint>Cari kartını düzenleme yetkiniz yok; eksik bilgiyi cari kartına yetkili bir kullanıcı (yönetici) yazmalı.</p>';
    return '<div class="hof-inv-party-fix"><button type="button" class="hof-button hof-button-small" data-act="edit-account">Cariyi Düzenle</button><small>Eksik bilgi cari kartına yazılır; bu ve sonraki faturalar onunla kesilir.</small></div>';
  }
  function editPartyFromForm(form) {
    if (!form.account?.id || !HOF.accounts?.editFor) return;
    HOF.accounts.editFor(form.account.id, {
      require: form.calc?.partyFields || [],
      intro: "Faturanın e-Belge olarak kesilmesi için eksik ya da hatalı bilgiler zorunlu işaretli. Kaydedince cari kartı güncellenir; bu ve sonraki faturalar yeni bilgiyle kesilir, daha önce kesilmiş belgeler değişmez.",
      savedMessage: "Cari kartı güncellendi; fatura yeni bilgiyle hesaplanıyor. Daha önce kesilmiş belgelerin alıcı bilgisi değişmez.",
      onSaved: account => {
        if (view.form !== form) return;
        applyPickedAccount(account);
        if (isReturn(form.kind)) {
          const link = body()?.querySelector("[data-account-slot] [data-open-account]");
          if (link) link.textContent = account.name;
        } else mountAccountPicker();
        setTimeout(() => focusAfterAccount(form), 0);
      },
    });
  }
  const lineBody = line => ({ itemId: line.itemId, name: line.name.trim(), code: line.code, description: line.description, serialNo: line.serialNo || "", lotNo: line.lotNo || "", unit: line.unit, qty: line.qty, unitPrice: line.unitPrice || "0", discountRate: line.discountRate || "0", vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.expenseCode, originLineId: line.originLineId, ...(line.newItem && !line.itemId ? { newItem: true, newSalePrice: line.newSalePrice || "0" } : {}) });
  // 2.4.3 (keşif B2): çok kalemli faturanın kısmi iadesi — miktarı 0 ya da boş bırakılan iade satırı iade edilmez (gönderilmez); satır × ile de çıkarılır.
  const skippedReturnLine = (form, line) => isReturn(form.kind) && Boolean(line.originLineId) && !(amountNum(line.qty) > 0);
  const usedLines = form => form.lines.filter(line => (line.itemId || line.name.trim() || line.originLineId) && !skippedReturnLine(form, line));
  const docBody = form => ({
    kind: form.kind,
    scenario: form.scenario,
    accountId: form.account?.id || "",
    originalId: form.original?.id || "",
    issueDate: form.issueDate,
    issueTime: form.issueTime,
    profile: form.profile || "",
    currency: form.currency,
    rate: form.rate,
    pricesIncludeVat: form.pricesIncludeVat,
    discountRate: form.discountRate || "0",
    ...(form.stoppageRate !== "" ? { stoppageRate: form.stoppageRate } : {}),
    number: form.number,
    paperNo: form.paperNo,
    ...(isReturn(form.kind) ? { returnRef: returnRefNeeded(form) ? returnRefValue(form) : "" } : {}),
    orderNo: form.orderNo,
    orderDate: form.orderDate,
    despatchNo: form.despatchNo,
    despatchDate: form.despatchDate,
    note: form.note,
    lines: usedLines(form).map(lineBody),
  });
  // 2.2.0 (İz 3.2): POS satırının gövdesi — POS (tek POS'ta boş: sunucu seçer), satışta POS Taksit Sayısı + Provizyon No + son 4 hane (boş
  // değer de gider: Düzenle'de silinen provizyon kayıttan da kalkar), satıştan iadede asıl işlem ya da Kaynaksız.
  const posBody = (form, item) => {
    if (!(item.method === "card" && form.side === "sale")) return {};
    const own = item.posId ? { posId: item.posId } : {};
    if (form.kind === "sale_return") return { ...own, ...(item.posRefundOf === SOURCELESS ? { posSourceless: true } : item.posRefundOf ? { posRefundOf: item.posRefundOf } : {}) };
    return { ...own, posInstallments: Number(item.posInstallments) || 1, authCode: String(item.authCode || "").trim(), cardLast4: String(item.cardLast4 || "").trim() };
  };
  const payBody = form => ({
    cash: form.pay.cash.filter(item => amountNum(item.amount) > 0).map(item => ({ amount: item.amount, method: item.method, lineKey: item.lineKey, ...((item.method === "bank" || (item.method === "card" && form.side === "purchase")) && item.bankAccountId ? { bankAccountId: item.bankAccountId } : {}), ...posBody(form, item) })),
    cheques: form.pay.cheques.filter(item => amountNum(item.amount) > 0).map(item => ({ ...item })),
    endorse: [...form.pay.endorse],
    rest: form.pay.rest,
    dueDate: form.pay.dueDate,
    installments: { count: form.pay.installments.count, firstDue: form.pay.installments.firstDue, everyMonths: form.pay.installments.everyMonths },
  });
  function scheduleCalc(delay = 300) {
    clearTimeout(calcTimer);
    calcPending = true;
    calcTimer = setTimeout(() => {
      calcPending = false;
      runCalc();
    }, delay);
  }
  // Bekleyen ya da süren hesabı bitirir; bu arada yenisi başladıysa (ör. Kaydet'in hesabı) onu da bekler.
  async function flushCalc() {
    for (let round = 0; round < 6 && (calcPending || calcRunning); round += 1) {
      if (calcPending) {
        clearTimeout(calcTimer);
        calcPending = false;
        await runCalc();
      } else await calcRunning;
    }
  }
  function runCalc() {
    const run = calcOnce();
    calcRunning = run;
    run.finally(() => {
      if (calcRunning === run) calcRunning = null;
    });
    return run;
  }
  // v2.0.23 (gözden geçirme, Bulgu 1'in kalan yolu): hesap dönünce ödeme satırları yeniden çizilmez (kalemden doğrudan ödeme
  // alanına geçen kullanıcının yazdığı rakamlar kayboluyordu); hesaba bağlı olan yalnız "Kalan" kutusu ve "Tamamı Peşin".
  function refreshPayAfterCalc() {
    renderRest();
  }
  async function calcOnce() {
    const form = view.form;
    if (!form) return;
    if (!form.account || !usedLines(form).length) {
      form.calc = null;
      form.calcError = "";
      renderPaperNote();
      renderTotals();
      refreshPayAfterCalc();
      return;
    }
    // 2.4.3 (keşif B12): fiyatı yazılmamış kalemlerle hesap istenmez (sunucu "ödenecek tutar sıfırdan büyük olmalı" diye 400 döner, her tuşta
    // tarayıcı konsoluna hata düşüyordu). İadede fiyat asıl faturadan gelir.
    if (!isReturn(form.kind) && !usedLines(form).some(line => amountNum(line.unitPrice) > 0)) {
      ++calcTicket;
      form.calc = null;
      form.calcError = "Birim fiyat yazılınca toplamlar hesaplanır.";
      renderPaperNote();
      renderTotals();
      refreshPayAfterCalc();
      return;
    }
    const ticket = ++calcTicket;
    try {
      // 2.4.3 (uzman UX2): düzenlenen iadenin kimliği — sunucu iadenin kendi miktarını "önce iade edilen" saymaz (tam iade Düzenle'de kaydedilir).
      // 2.4.4 (UX15): Düzenle'de her belgenin kimliği — sunucu numara/tarih çakışmasını Düzenle kuralıyla söyler.
      const calc = await HOF.api("/api/workspace/invoices/calc", { method: "POST", body: { ...docBody(form), ...(form.modifyId || (isReturn(form.kind) && form.id) ? { existingId: form.modifyId || form.id } : {}) } });
      if (ticket !== calcTicket || view.form !== form) return;
      form.calc = calc;
      form.calcError = "";
      form.calcFailure = null;
      const used = usedLines(form);
      form.lines.forEach(line => (line.net = null));
      used.forEach((line, index) => (line.net = calc.lines[index]?.net ?? null));
      body()
        ?.querySelectorAll("[data-line-net]")
        .forEach((cell, index) => (cell.textContent = form.lines[index]?.net === null || form.lines[index]?.net === undefined ? "—" : curMoney(form.lines[index].net, calc.currency)));
      if (!form.pay.dueDate && calc.dueDays) form.pay.dueDate = new Date(Date.parse(`${form.issueDate}T12:00:00`) + calc.dueDays * 86_400_000).toISOString().slice(0, 10);
      renderProfile();
      renderTotals();
      refreshPayAfterCalc();
      const next = body()?.querySelector("[data-next]");
      // 2.1.0 (D2): Düzenle numarayı değiştirmez — formda belgenin kendi numarası (önceden sıradaki numara "Kaydedilince Verilecek No" diye görünüyordu).
      // 2.4.4 (UX15): çakışma varken (kaydedilemez) ya da numara kayıtta verilmeyecekken (orderHold) sıradaki numara gösterilmez.
      if (next) next.innerHTML = form.modifyId ? (form.modifyNumber ? `<span>Belge No</span><b>${esc(form.modifyNumber)}</b>` : "") : calc.nextNumber && !(calc.numbering || []).length && !calc.orderHold ? `<span>Kaydedilince Verilecek No</span><b>${esc(calc.nextNumber)}</b>` : "";
    } catch (error) {
      if (ticket !== calcTicket || view.form !== form) return;
      form.calc = null;
      form.calcError = error.message;
      // 2.4.4 (UX10): hesap hatasının alanı (data.field) Kaydet'te odak için saklanır.
      form.calcFailure = error?.data || null;
      renderTotals();
      refreshPayAfterCalc();
    }
  }
  // 2.4.4 (madde 30c G1; kalıcı karar "pasif düğmenin nedeni görünür yazı"): entegratör bağlantısı kayıtlıyken kendi kestiğimiz belge kâğıda düşerse
  // nedeni formda yazılır. Koşul sunucunun allowedProfiles kuralının aynısı (invoices.mjs): satış / Alıştan İade e-Fatura işareti yoksa kâğıt; işaret
  // varken alıcı mükellef değilse ve e-Arşiv işareti yoksa kâğıt; makbuz e-SMM açıkken (kinds.smm.send) işaret yoksa kâğıt. Karşı tarafın belgesi
  // (Alış, Satıştan İade) ve entegratörü kayıtlı olmayan firma not görmez.
  function paperReason(form) {
    const st = meta?.settings || {};
    if (!edoc() || !st.integrator?.configured || form?.calc?.profile !== "KAGIT" || !isOwn(form.kind)) return "";
    const where = " (Entegratör Ayarları → Firma / Etiket Tanımları).";
    if (form.kind === "smm") return meta?.kinds?.smm?.send && !st.esmm ? `Kâğıt makbuz: firma e-SMM kullanıcısı olarak işaretli değil${where}` : "";
    if (!st.efatura) return st.earsiv ? `Kâğıt belge: firma e-Fatura mükellefi olarak işaretli değil; e-Arşiv de bu işaretle kesilir${where}` : `Kâğıt belge: firma e-Fatura / e-Arşiv kullanıcısı olarak işaretli değil${where}`;
    if (!st.earsiv && !form.calc.party?.eInvoice) return `Kâğıt belge: alıcı e-Fatura mükellefi değil ve firma e-Arşiv kullanıcısı olarak işaretli değil${where}`;
    return "";
  }
  // 2.4.4 (uzman UX U6): tek seçenekte Belge Türü alanı gizlidir; türün notu o alanın İÇİNDE kalıyordu (e-Arşiv ve e-SMM formunda tür hiç görünmüyordu).
  // Alan gizliyken tür, kâğıt notunun yerinde tek satır olarak yazar ([data-kind-note]); kâğıt nedeni (G1) varsa yalnız o görünür — iki not aynı anda
  // çıkmaz. Alan görünürken (iki seçenek: Temel / Ticari) not alanın altında kalır.
  const KIND_NOTES = {
    EARSIVFATURA: "Belge Türü: e-Arşiv Fatura (alıcı e-Fatura mükellefi değil).",
    TEMELFATURA: "Belge Türü: e-Fatura (alıcı e-Fatura mükellefi).",
    TICARIFATURA: "Belge Türü: e-Fatura (alıcı e-Fatura mükellefi).",
    ESMM: "Belge Türü: e-SMM (makbuz EDM'ye gönderilir).",
  };
  function kindNote(form) {
    if (!edoc() || !form?.calc || !isOwn(form.kind) || (form.calc.profiles || []).length >= 2) return "";
    return KIND_NOTES[form.calc.profile] || "";
  }
  function renderPaperNote() {
    const node = body()?.querySelector("[data-paper-note]");
    if (!node) return;
    const reason = view.form?.calc ? paperReason(view.form) : "";
    node.textContent = reason;
    node.hidden = !reason;
    const kind = body()?.querySelector("[data-kind-note]");
    if (!kind) return;
    const text = reason ? "" : kindNote(view.form);
    kind.textContent = text;
    kind.hidden = !text;
  }
  // Onay penceresinde belgenin türü adıyla (U6): e-Fatura / e-Arşiv Fatura / e-SMM; kâğıtta Kâğıt Makbuz / Kâğıt Belge; e-Belge bağlantısı kapalıyken
  // Müşteri Fişi (kartın Belge Türü satırıyla aynı adlar). Karşı tarafın belgesinde (Alış, Satıştan İade) yazılmaz.
  function docTypeName(form) {
    if (!isOwn(form.kind) || !form.calc) return "";
    const profile = form.calc.profile;
    if (profile === "ESMM") return "e-SMM";
    if (profile === "EARSIVFATURA") return "e-Arşiv Fatura";
    if (profile === "TEMELFATURA") return "e-Fatura, Temel";
    if (profile === "TICARIFATURA") return "e-Fatura, Ticari";
    if (!edoc()) return "Müşteri Fişi";
    return form.kind === "smm" ? "Kâğıt Makbuz" : "Kâğıt Belge";
  }
  // Belge türü (e-Belge açıksa): GİB kuralına göre izin verilenler; tek seçenekse gizli.
  function renderProfile() {
    const form = view.form;
    const field = body()?.querySelector("[data-profile-field]");
    renderPaperNote();
    if (!field || !form?.calc) return;
    const profiles = form.calc.profiles || [];
    field.hidden = !edoc() || profiles.length < 2;
    form.profile = form.calc.profile;
    const actions = body()?.querySelector("[data-form-actions]");
    // Yalnız gönderilebilirlik (ya da 2.4.4: taslak düğmesi — e-SMM'de taslak yok) değişince yeniden çizilir: her hesaplamada çizmek alandan düğmeye
    // geçen tıklamayı ve klavye odağını düşürüyordu (gözden geçirme 2.4.2).
    if (actions && !form.busy && (sendable(form) !== form.drawnSendable || draftUploadFor(form) !== form.drawnDraft)) actions.innerHTML = formActions(form);
    syncReturnRef();
    updateUnitHint();
    field.querySelector("select").innerHTML = profiles.map(item => `<option value="${esc(item.id)}" ${item.id === form.calc.profile ? "selected" : ""}>${esc(item.label)}</option>`).join("");
    field.querySelector("[data-profile-note]").textContent = form.calc.profile === "EARSIVFATURA" ? "Alıcı e-Fatura mükellefi değil: e-Arşiv kesilir." : form.calc.profile === "TEMELFATURA" || form.calc.profile === "TICARIFATURA" ? "Alıcı e-Fatura mükellefi: e-Fatura kesilir." : form.calc.profile === "ESMM" ? "e-SMM kesilir: makbuz EDM'ye gönderilir." : "";
  }

  // ---------- Form olayları ----------
  const NUMERIC_LINE_FIELDS = new Set(["qty", "unitPrice", "discountRate", "newSalePrice"]);
  const HEAD_FIELDS = new Set(["issueDate", "issueTime", "profile", "currency", "rate", "number", "paperNo", "orderNo", "orderDate", "despatchNo", "despatchDate", "discountRate", "stoppageRate", "note"]);
  // 2.4.3 (uzman UX12): eski doğrulama iletisi ("Müşteriyi (cariyi) seçin.") kullanıcı formda bir alanı değiştirince temizlenir; yeniden
  // kaydedince gerekiyorsa yine yazılır (önceden cari seçilip kalem değişse de kırmızı ileti kalıyor, form hâlâ hatalı sanılıyordu).
  const clearFormError = () => {
    const node = body()?.querySelector("[data-form-error]");
    if (node?.textContent) node.textContent = "";
  };
  function formInput(event) {
    const form = view.form;
    const target = event.target;
    if (!form) return;
    clearFormError();
    if (target.matches("[data-return-ref-input]")) {
      form.returnRef = target.value;
      form.returnRefTouched = true;
      return syncReturnRef();
    }
    if (target.matches("[data-return-q]")) {
      form.returnQuery = target.value;
      return searchReturnable(target.value.trim());
    }
    if (target.dataset.l !== undefined && target.dataset.f) {
      const line = form.lines[Number(target.dataset.l)];
      if (!line) return;
      const field = target.dataset.f;
      // 2.4.3 (keşif B13): sayı alanı harf kabul etmez (miktar, birim fiyat, iskonto, yeni kartın satış fiyatı): rakam, virgül ve nokta dışındaki
      // karakter yazılırken düşer (önceden "Çuval" iskonto kutusuna yazılıp kayıtta reddediliyordu).
      if (NUMERIC_LINE_FIELDS.has(field)) {
        const clean = target.value.replace(/[^\d.,]/g, "");
        if (clean !== target.value) {
          const caret = Math.max(0, (target.selectionStart ?? clean.length) - (target.value.length - clean.length));
          target.value = clean;
          try {
            target.setSelectionRange(caret, caret);
          } catch {
            // seçim desteklenmeyen kutu
          }
        }
      }
      line[field] = target.type === "checkbox" ? target.checked : target.value;
      if (field === "unit") updateUnitHint();
      if (field === "name") target.title = target.value;
      if (field === "qty") syncStockNote(Number(target.dataset.l));
      if (field === "name") {
        if (line.itemId) {
          // Seçilen ürünün adı değiştirildi: kalem artık serbest (stoksuz) kalemdir.
          line.itemId = "";
          line.available = null;
          line.itemKind = "";
          const unit = body().querySelector(`[data-l="${target.dataset.l}"][data-f="unit"]`);
          if (unit) unit.readOnly = false;
        }
        searchItems(Number(target.dataset.l), target.value.trim());
        loadPrices(Number(target.dataset.l));
      }
      if (field === "code") {
        // Stok Kodu yazıldı: seçili ürünün koduysa bağ kalır; başka kod yazılınca bağ çözülür, kodla ürün aranır.
        if (line.itemId) {
          line.itemId = "";
          line.available = null;
          line.itemKind = "";
          const unit = body().querySelector(`[data-l="${target.dataset.l}"][data-f="unit"]`);
          if (unit) unit.readOnly = false;
        }
        if (target.value.trim()) searchItems(Number(target.dataset.l), target.value.trim(), "code");
        else hideHits();
        return;
      }
      if (field === "newSalePrice") return;
      if (field === "vatRate" || field === "withholdingCode" || field === "expenseCode") return;
      return scheduleCalc();
    }
    if (target.dataset.pay !== undefined && target.dataset.f) {
      const list = form.pay[target.dataset.pay];
      const item = list?.[Number(target.dataset.i)];
      if (item) item[target.dataset.f] = target.value;
      // 2.7: peşin tutar yazıldıkça hesabın "İşlemden Sonra"sı.
      if (target.dataset.pay === "cash" && target.dataset.f === "amount") syncInvoiceBalances();
      // 2.2.0 (İz 3.2): POS satırının önizlemesi tutar yazıldıkça (yalnız önizleme yeri yenilenir).
      if (target.dataset.pay === "cash" && target.dataset.f === "amount" && posRow(item)) syncPosCell(Number(target.dataset.i));
      return refreshRest();
    }
    if (target.dataset.payf) {
      const [group, key] = target.dataset.payf.split(".");
      if (key) form.pay[group][key] = target.value;
      else form.pay[group] = target.value;
      return;
    }
    if (target.dataset.f && HEAD_FIELDS.has(target.dataset.f)) {
      form[target.dataset.f] = target.value;
      if (target.dataset.f !== "note") scheduleCalc();
    }
  }
  // Kalanı ödeme satırlarını yeniden çizmeden günceller (yazarken ve alan değiştirirken odak kaçmasın).
  function refreshRest() {
    renderRest();
  }
  function formChange(event) {
    const form = view.form;
    const target = event.target;
    if (!form) return;
    clearFormError();
    if (target.dataset.l !== undefined && target.dataset.f) {
      const line = form.lines[Number(target.dataset.l)];
      if (!line) return;
      line[target.dataset.f] = target.value;
      // 2.4.3 (uzman UI4): Kod / Barkod yazıp Tab ile çıkınca da (yalnız Enter değil) tam eşleşen ürün seçilir — kalemin adı boşsa ya da ad
      // önceki seçimden kaldıysa. Eşleşme yoksa satırda "Bu kodla ürün yok" yazar (önceden ad boş kalıyor, kayıtta "En az bir kalem yazın" deniyordu).
      if (target.dataset.f === "code" && !isReturn(form.kind)) {
        const code = target.value.trim();
        if (code && !line.itemId && (!String(line.name || "").trim() || line.name === line.pickedName)) pickByCode(Number(target.dataset.l), code, { leave: true });
        return scheduleCalc(0);
      }
      if (target.dataset.f === "vatRate") {
        if (target.value !== "0") line.exemptionCode = "";
        else line.more = true;
        renderLines();
      }
      return scheduleCalc(0);
    }
    if (target.dataset.f === "allVat") {
      // v2.0.16 (müşteri): tek seçimle bütün kalemlerin KDV'si; yeni eklenen kalem de bu oranı alır.
      if (target.value === "") return;
      form.allVat = target.value;
      for (const line of form.lines) {
        line.vatRate = target.value;
        if (target.value !== "0") line.exemptionCode = "";
      }
      renderLines();
      HOF.toast(`Bütün kalemlerin KDV'si %${target.value} yapıldı.`, { type: "info" });
      return scheduleCalc(0);
    }
    if (target.dataset.f === "pricesIncludeVat") {
      form.pricesIncludeVat = target.checked;
      renderLines();
      return scheduleCalc(0);
    }
    if (target.dataset.f === "currency") {
      form.currency = target.value;
      if (form.currency === "TRY") form.rate = "";
      const rate = body().querySelector("[data-rate-field]");
      if (rate) {
        rate.hidden = form.currency === "TRY";
        rate.querySelector("span").firstChild.textContent = `Kur (1 ${form.currency} = ? TL) `;
      }
      return scheduleCalc(0);
    }
    if (target.dataset.f === "profile") {
      form.profile = target.value;
      return scheduleCalc(0);
    }
    if (target.dataset.rest) {
      form.pay.rest = target.dataset.rest;
      if (form.pay.rest === "installments" && !form.pay.installments.firstDue) {
        const [y, m, d] = form.issueDate.split("-").map(Number);
        const next = new Date(Date.UTC(y, m, Math.min(d, 28)));
        form.pay.installments.firstDue = next.toISOString().slice(0, 10);
      }
      return renderPay();
    }
    if (target.dataset.endorse) {
      if (target.checked) form.pay.endorse.push(target.dataset.endorse);
      else form.pay.endorse = form.pay.endorse.filter(id => id !== target.dataset.endorse);
      return renderPay();
    }
    if (target.dataset.pay !== undefined && target.dataset.f) {
      const item = form.pay[target.dataset.pay]?.[Number(target.dataset.i)];
      if (item) item[target.dataset.f] = target.value;
      if (item && target.dataset.pay === "cash" && target.dataset.f === "method") syncBankCell(target, item);
      // v2.2.0 (İz 2.5): evrak türü değişince (çek ↔ senet) yalnız hesap hücresi yeniden çizilir; çekin hesabı senede taşınmaz.
      if (item && target.dataset.pay === "cheques" && target.dataset.f === "instrument") {
        item.bankAccountId = "";
        const cell = body()?.querySelector(`[data-cheque-bank="${target.dataset.i}"]`);
        if (cell) cell.outerHTML = chequeBankCell(item, Number(target.dataset.i));
      }
      if (item && target.dataset.f === "bankAccountId") {
        item.legacy = item.legacy && !target.value;
        syncNoneNote(target);
      }
      // 2.2.0 (İz 3.2): POS değişince yalnız POS hücresi çizilir (taksit seçenekleri POS'un oranları); taksit değişince önizleme.
      if (item && target.dataset.pay === "cash" && target.dataset.f === "posId") redrawPosCells({ only: Number(target.dataset.i) });
      else if (item && target.dataset.pay === "cash" && posRow(item) && ["posInstallments", "amount"].includes(target.dataset.f)) syncPosCell(Number(target.dataset.i));
      if (target.dataset.pay === "cash") syncInvoiceBalances();
      return refreshRest();
    }
    if (target.dataset.f && HEAD_FIELDS.has(target.dataset.f)) {
      form[target.dataset.f] = target.value;
      if (target.dataset.f === "issueDate") {
        renderPay();
        // 2.7: seçicideki bakiyeler fatura tarihindeki bakiyedir.
        reloadInvoiceBalances();
      }
      if (target.dataset.f !== "note") scheduleCalc(0);
    }
  }
  function formKey(event) {
    const target = event.target;
    if (["name", "code"].includes(target.dataset?.f) && target.dataset.l !== undefined) {
      const index = Number(target.dataset.l);
      const list = body()?.querySelector(`[data-hits="${index}"]`);
      if (event.key === "Escape" && list && !list.hidden) {
        event.stopPropagation();
        list.hidden = true;
      }
      if (event.key === "Enter") {
        // Barkod okuyucu kodu yazıp Enter'a basar: tam eşleşen Stok Kodu varsa doğrudan seçilir (liste beklenmez).
        if (target.dataset.f === "code" && target.value.trim()) {
          event.preventDefault();
          return pickByCode(index, target.value.trim());
        }
        if (list && !list.hidden) {
          event.preventDefault();
          const first = list.querySelector("li.is-exact[data-item]") || list.querySelector("li[data-item]");
          if (first) pickItem(index, first.dataset.item);
          else if (list.querySelector("li[data-new-item]")) markNewItem(index);
          else list.hidden = true;
        }
      }
      return;
    }
    // Son kalemin son alanında Enter: yeni kalem.
    if (event.key === "Enter" && target.dataset?.l !== undefined && ["unitPrice", "discountRate"].includes(target.dataset.f)) {
      event.preventDefault();
      if (Number(target.dataset.l) === view.form.lines.length - 1 && !isReturn(view.form.kind)) addLine();
      else body()?.querySelector(`[data-l="${Number(target.dataset.l) + 1}"][data-f="name"]`)?.focus();
    }
    if (event.key === "Enter" && target.closest?.("li[data-original]")) attachOriginal(target.closest("li[data-original]").dataset.original);
  }
  // leave (UI4): kod kutusundan Tab / tıklamayla çıkıldı — liste açılmaz; eşleşme yoksa satırda not; odak kullanıcının gittiği yerde kalır (aynı
  // kalemin ad kutusuna geçtiyse Enter'daki gibi Miktar'a). Enter ile aynı kod için süren arama tekrarlanmaz.
  let codePick = "";
  async function pickByCode(index, code, { leave = false } = {}) {
    const key = `${index}|${code}`;
    if (leave && codePick === key) return;
    codePick = key;
    clearTimeout(itemTimer);
    const own = ++itemTicket;
    let items = [];
    try {
      items = (await HOF.api(`/api/workspace/invoices/items?q=${encodeURIComponent(code)}`)).items;
    } catch {
      items = [];
    } finally {
      if (codePick === key) codePick = "";
    }
    if (own !== itemTicket) return;
    const exact = items.find(item => item.exact);
    const list = body()?.querySelector(`[data-hits="${index}"]`);
    if (!list) return;
    list.dataset.items = JSON.stringify(items);
    if (exact) {
      if (!leave) return pickItem(index, exact.id);
      const active = document.activeElement;
      const onOwnName = active?.matches?.(`[data-l="${index}"][data-f="name"]`);
      return pickItem(index, exact.id, { focus: Boolean(onOwnName || !active || active === document.body) });
    }
    if (!leave) return searchItems(index, code, "code");
    const note = body()?.querySelector(`[data-stock-note="${index}"]`);
    if (note && view.form?.lines[index]?.code?.trim() === code) note.innerHTML = '<span class="hof-inv-warn" data-code-miss>Bu kodla ürün yok; adı yazın ya da kodu düzeltin.</span>';
  }
  function addLine() {
    const form = view.form;
    const last = form.lines[form.lines.length - 1];
    form.lines.push(blankLine(form.allVat || (last ? last.vatRate : undefined)));
    renderLines();
    body()?.querySelector(`[data-l="${form.lines.length - 1}"][data-f="name"]`)?.focus();
  }
  async function formClick(event, target) {
    const form = view.form;
    if (!form) return;
    if (target.matches("li[data-item]")) {
      event.preventDefault();
      return pickItem(Number(target.dataset.l), target.dataset.item);
    }
    if (target.matches("li[data-new-item]")) return markNewItem(Number(target.dataset.newItem));
    if (target.matches("li[data-original]")) return attachOriginal(target.dataset.original);
    if (target.dataset.applyPrice !== undefined) {
      const line = form.lines[Number(target.dataset.applyPrice)];
      if (line) {
        line.unitPrice = priceText(Math.round(Number(target.dataset.price) * 10000) / 10000);
        renderLines();
        scheduleCalc(0);
      }
      return;
    }
    const act = target.dataset.act;
    if (act === "add-line") return addLine();
    if (act === "edit-account") return editPartyFromForm(form);
    if (act === "new-item-cancel") {
      const line = form.lines[Number(target.dataset.l)];
      if (line) line.newItem = false;
      renderLines();
      return scheduleCalc(0);
    }
    if (act === "line-remove") {
      const removed = Number(target.dataset.l);
      form.lines.splice(removed, 1);
      if (!form.lines.length) form.lines.push(blankLine());
      renderLines();
      // Dar kontrol 2.4.3 (D1, GG4 komşusu): silinen kalemin × düğmesinden sonra odak BAŞKA kalemin ×'ine geçmez (ilk/orta kalemde aynı data-l'li
      // düğme bir sonraki kalemindir; ikinci Enter onu da siliyordu). Güvenli hedef: aynı konumdaki (yoksa son) kalemin ilk yazılabilir alanı,
      // o da yoksa "+ Kalem Ekle".
      const position = Math.min(removed, form.lines.length - 1);
      const row = body()?.querySelector(`[data-lines] tr[data-line="${position}"]`);
      const safe = row?.querySelector("input:not([readonly]):not([disabled]), select:not([disabled])") || body()?.querySelector('[data-act="add-line"]') || row?.querySelector("input");
      safe?.focus({ preventScroll: true });
      return scheduleCalc(0);
    }
    if (act === "line-more") {
      const line = form.lines[Number(target.dataset.l)];
      line.more = !line.more;
      return renderLines();
    }
    if (act === "pay-add-cash") {
      // 2.8: yol düğmeden ("+ Nakit", "+ Havale / EFT", "+ Kredi Kartı" / "+ POS"); havalede varsayılan hesap önerilir.
      const method = payWays(form.kind).includes(target.dataset.method) ? target.dataset.method : "cash";
      form.pay.cash.push({ amount: "", method, lineKey: lineKey(), bankAccountId: method === "bank" ? defaultBank() : "" });
      renderPay();
      return body()?.querySelector(`[data-pay="cash"][data-i="${form.pay.cash.length - 1}"][data-f="amount"]`)?.focus();
    }
    if (act === "pay-rest") {
      // 2.8: yol sorulur (satırlar yeniden çizilmez); seçilince kalan o yolla yazılır.
      const choose = body()?.querySelector("[data-pay] [data-pay-choose]");
      if (!choose) return;
      choose.hidden = !choose.hidden;
      if (!choose.hidden) choose.querySelector('[data-act="pay-rest-method"]')?.focus();
      return;
    }
    if (act === "pay-rest-cancel") {
      const choose = body()?.querySelector("[data-pay] [data-pay-choose]");
      if (choose) choose.hidden = true;
      return body()?.querySelector('[data-pay] [data-act="pay-rest"]')?.focus();
    }
    if (act === "pay-rest-method") {
      // Fiyat yeni değiştiyse hesap bitmeden eski toplam kullanılıyordu (288'lik fatura 24 peşinle kaydedildi). Kaydet bu işin
      // bitmesini bekler (2. gözden geçirme: yük, peşin tutar yazılmadan kuruluyor; ekranda peşin görünen fatura 0 peşinle
      // kaydediliyordu). 2.8: kalan = ödenecek − girilen bütün ödemeler; seçilen yolun boş satırı varsa o doldurulur, yoksa satır eklenir.
      const method = payWays(form.kind).includes(target.dataset.method) ? target.dataset.method : "cash";
      let index = -1;
      const job = (async () => {
        await flushCalc();
        if (view.form !== form) return;
        const rest = restOf(form);
        if (!(rest > 0.004)) {
          renderPay();
          HOF.toast("Kalan tutar yok; ödeme tamam.", { type: "info" });
          return;
        }
        index = form.pay.cash.findIndex(item => item.method === method && !(amountNum(item.amount) > 0));
        if (index >= 0) form.pay.cash[index].amount = amountText(rest);
        else {
          form.pay.cash.push({ amount: amountText(rest), method, lineKey: lineKey(), bankAccountId: method === "bank" ? defaultBank() : "" });
          index = form.pay.cash.length - 1;
        }
        renderPay();
      })();
      form.payPending = job;
      try {
        await job;
      } finally {
        if (form.payPending === job) form.payPending = null;
      }
      // Hesap seçimi gerekiyorsa (çok hesap/kart) odak seçicide; yoksa satırın tutarında.
      if (index >= 0) (body()?.querySelector(`[data-bank-cell="${index}"]:not([hidden]) select`) || body()?.querySelector(`[data-pay="cash"][data-i="${index}"][data-f="amount"]`))?.focus();
      return;
    }
    if (act === "pay-add-cheque") {
      form.pay.cheques.push({ instrument: "cheque", amount: "", dueDate: "", serialNo: "", bank: "", drawer: "" });
      renderPay();
      return body()?.querySelector(`[data-pay="cheques"][data-i="${form.pay.cheques.length - 1}"][data-f="amount"]`)?.focus();
    }
    if (act === "pay-remove") {
      const group = target.dataset.pay;
      const removed = Number(target.dataset.i);
      form.pay[group].splice(removed, 1);
      renderPay();
      // Dar kontrol 2.4.3 (ek 4): silinen ödeme satırından sonra odak başka satırın ×'ine gitmez, kaybolmaz: aynı konumdaki (yoksa son) satırın
      // tutarı, satır kalmadıysa ilk "+ …" ekleme düğmesi.
      const left = form.pay[group].length;
      const slot = body()?.querySelector("[data-pay]");
      const safe = (left ? slot?.querySelector(`[data-pay="${group}"][data-i="${Math.min(removed, left - 1)}"][data-f="amount"]`) : null) || slot?.querySelector('[data-act="pay-add-cash"], [data-act="pay-add-cheque"]');
      safe?.focus({ preventScroll: true });
      return undefined;
    }
    if (act === "pay-endorse") {
      try {
        const data = await HOF.api("/api/workspace/invoices/portfolio");
        form.portfolio = (data.cheques || []).filter(item => item.accountId !== form.account?.id);
      } catch (error) {
        HOF.toastError(error);
        form.portfolio = [];
      }
      return renderPay();
    }
    if (act === "change-original") {
      form.original = null;
      form.lines = [];
      form.returnHits = null;
      form.calc = null;
      renderForm();
      return;
    }
    if (act === "gross-from-net") return grossFromNet();
    if (act === "cancel-form") {
      const dirty = usedLines(form).length && !form.id;
      if (dirty && !(await HOF.confirm({ title: "Form Kapatılsın mı?", message: "Girdiğiniz bilgiler kaydedilmedi. Taslak olarak saklamak için Taslak Olarak Kaydet'i kullanın.", confirmLabel: "Kaydetmeden Kapat", danger: true }))) return;
      view.form = null;
      return form.id ? loadDoc(form.id) : showList();
    }
    if (act === "save-draft") return submitForm("draft");
    if (act === "issue") return submitForm("issue");
    if (act === "issue-now") return submitForm("issue", "now");
    if (act === "issue-later") return submitForm("issue", "later");
  }
  // SMM: eline geçecek net ücretten (brüt − stopaj, KDV hariç) brüt ücret — ilk kalemin birim fiyatına yazılır.
  // 2.4.4 (madde 26): birim fiyatı sunucu kaydın kendi hesabıyla bulur (formun ön hesap gövdesi + net): stopaj oranı kayıtta uygulanacak oran
  // (kutu boşsa alıcıya göre — önceden burada her alıcıya ayardaki %20 gidiyordu, gerçek kişide brüt %25 fazla çıkıyordu), KDV dahil fiyat, iskonto
  // ve öbür kalemler dahil; kaydedilen makbuzun net ücreti yazılan tutara kuruşu kuruşuna eşittir.
  function grossFromNet() {
    const form = view.form;
    HOF.formModal({
      title: "Netten Brüte",
      eyebrow: "SERBEST MESLEK MAKBUZU",
      intro: `Eline geçmesini istediğiniz net ücreti (brüt ücret − stopaj, KDV hariç) yazın; program brüt ücreti bulur ve ilk kaleme yazar. Stopaj % kutusu boşsa oran alıcıya göre belirlenir: şirket alıcıda ayarlardaki oran. ${STOPPAGE_PERSON_HINT} Başka kalemler de varsa tutar makbuzun tamamı içindir.`,
      fields: [{ name: "net", label: "Net Ücret (₺)", required: true, inputmode: "decimal", autofocus: true }],
      submitLabel: "Brütü Hesapla",
      onSubmit: async data => {
        if (!form.account) throw new Error("Önce cariyi seçin: stopaj alıcıya göre belirlenir.");
        const probe = { ...form, lines: form.lines.map((line, index) => (index === 0 ? { ...line, name: line.name.trim() || "Serbest meslek ücreti", qty: "1", unitPrice: "0" } : line)) };
        const result = await HOF.api("/api/workspace/invoices/gross-from-net", { method: "POST", body: { ...docBody(probe), net: data.net } });
        if (view.form !== form) return;
        const line = form.lines[0];
        line.unitPrice = priceText(result.unitPrice);
        if (!line.name.trim()) line.name = "Serbest meslek ücreti";
        line.qty = "1";
        renderLines();
        scheduleCalc(0);
      },
    });
  }
  // e-Belge olarak gönderilecek belge mi (kendi kestiğimiz, e-Fatura / e-Arşiv / e-SMM)? Kesimde iki seçenek: hemen gönder
  // ya da sonra gönder (Gönderilecekler).
  // Formun düğmeleri (2.4.2, kullanıcı denemesi 17.10.2026): belge türü hesaplamadan sonra belli olur; kâğıt belgede "Kaydet ve Gönder" görünmez
  // (form açılırken tür bilinmiyordu, düğmeler hesaplamadan sonra yenilenmiyordu → kâğıt fatura "entegratöre gönderilir" diye kaydediliyordu).
  const formActions = form => (form.drawnSendable = sendable(form), form.drawnDraft = draftUploadFor(form), `<button type="button" class="hof-button hof-button-ghost" data-act="cancel-form">Vazgeç</button>${form.modifyId ? '<button type="button" class="hof-button" data-act="issue" title="Eski stok, cari, Kasa, taksit ve çek/senet kayıtları geri alınır, yenileri yazılır; numara değişmez">Değişiklikleri Kaydet</button>' : `<button type="button" class="hof-button hof-button-ghost" data-act="save-draft">Taslak Olarak Kaydet</button>${sendable(form) ? `<button type="button" class="hof-button hof-button-ghost" data-act="issue-later" title="Stok, cari, Kasa, taksit ve çek/senet şimdi işlenir; belge Gönderilecekler'de bekler">Kaydet, Sonra Gönder</button><button type="button" class="hof-button" data-act="issue-now">${draftUploadFor(form) ? "Kaydet ve Taslak Yükle" : "Kaydet ve Gönder"}</button>` : `<button type="button" class="hof-button" data-act="issue">${esc(ISSUE_LABELS[form.kind] || "Kaydet")}</button>`}`}`);
  const sendable = form => edoc() && Boolean(meta.kinds[form.kind]?.send) && (form.calc?.profile || form.profile || "") !== "KAGIT";
  // 2.4.4 madde 22: e-SMM portala taslak olarak yüklenmez (sunucu da doğrudan gönderir) — düğme "Kaydet ve Gönder" kalır.
  const draftUploadFor = form => Boolean(meta?.settings?.draftUpload) && (form.calc?.profile || form.profile || "") !== "ESMM";
  async function submitForm(mode, eSend = "") {
    const form = view.form;
    if (!form || form.busy) return;
    const error = body()?.querySelector("[data-form-error]");
    // 2.4.3 (uzman UI2): formda görünen hata satırı varsa ayrıca bildirim çıkmaz (bildirim kalem alanlarını örtüyordu ve aynı ileti üç kez
    // görünüyordu); satır görünür alana kaydırılır. Hata satırı yoksa (form çizilmemiş) bildirim verilir. Satır, alan değişince temizlenir (UX12).
    // 2.4.4 (uzman UX10): focus — hatalı alana odak (işlev; önceden odak tıklanan düğmede kalıyordu). Alan odak alırsa ileti yine görünür kalır.
    const fail = (message, focus = null) => {
      if (error?.isConnected && error.getClientRects().length) {
        error.textContent = message;
        error.scrollIntoView?.({ block: "nearest" });
      } else HOF.toast(message, { type: "error" });
      if (focus) focus();
    };
    const firstLineFocus = () => focusNode(lineInput(firstEmptyLine(form), isReturn(form.kind) ? "qty" : "name"));
    if (error) error.textContent = "";
    // v2.0.23 (2. gözden geçirme): yük, bekleyen hesap ve "Tamamı Peşin" bitmeden kuruluyordu (sunucu yavaşken ekranda peşin
    // görünen fatura 0 peşinle kaydedildi). Önce ikisi biter, kayıt ekranda görünenle yapılır.
    if (form.payPending || calcPending || calcRunning) {
      form.busy = true;
      try {
        if (form.payPending) await form.payPending.catch(() => null);
        await flushCalc();
      } finally {
        form.busy = false;
      }
      if (view.form !== form) return;
    }
    if (isReturn(form.kind) && !form.original) return fail("İade edilecek faturayı üstteki arama kutusundan seçin.", () => focusNode(body()?.querySelector("[data-return-q]")));
    if (mode !== "draft" && returnRefBlock(form)) return fail(returnRefBlock(form), () => focusNode(body()?.querySelector("[data-return-ref-input]")));
    if (!form.account) return fail(`${form.side === "purchase" ? "Tedarikçiyi" : "Müşteriyi"} (cariyi) seçin.`, focusAccount);
    if (!usedLines(form).length) return fail(isReturn(form.kind) ? "İade edilecek en az bir kalemin miktarını yazın. İade etmeyeceğiniz kalemi × ile çıkarın ya da miktarını 0 yapın." : "En az bir kalem yazın.", firstLineFocus);
    // v2.0.23 (Bulgu 1): tutarı yazılmamış ya da geçersiz ödeme satırı sessizce atılmaz (önceden evrak kayıtta düşüyordu,
    // fatura "Açık" kaydediliyordu). Peşin satırında boş tutar olabilir (satır yok sayılır); evrak satırında tutar zorunlu.
    const amountOk = value => parseTl(value) > 0;
    const badCash = form.pay.cash.findIndex(item => String(item.amount ?? "").trim() && !amountOk(item.amount));
    if (badCash >= 0) return fail(`${badCash + 1}. ödeme satırındaki (${methodLabel(form.pay.cash[badCash].method, form.kind)}) tutar geçerli değil ("${String(form.pay.cash[badCash].amount).trim()}"). Tutarı düzeltin ya da satırı × ile silin.`, () => focusNode(body()?.querySelector(`[data-pay="cash"][data-i="${badCash}"][data-f="amount"]`)));
    const badCheque = form.pay.cheques.findIndex(item => !amountOk(item.amount));
    if (badCheque >= 0) return fail(`${badCheque + 1}. evrakın (${form.pay.cheques[badCheque].instrument === "note" ? "senet" : "çek"}) tutarı ${String(form.pay.cheques[badCheque].amount ?? "").trim() ? `geçerli değil ("${String(form.pay.cheques[badCheque].amount).trim()}")` : "yazılmadı"}. Tutarı yazın ya da satırı × ile silin.`, () => focusNode(body()?.querySelector(`[data-pay="cheques"][data-i="${badCheque}"][data-f="amount"]`)));
    const payload = { ...docBody(form), payment: payBody(form) };
    form.busy = true;
    body()?.querySelectorAll(".hof-actions .hof-button").forEach(button => (button.disabled = true));
    try {
      let saved;
      if (mode === "draft") {
        saved = form.id ? await HOF.api(`/api/workspace/invoices/${encodeURIComponent(form.id)}`, { method: "PUT", body: payload }) : await HOF.api("/api/workspace/invoices", { method: "POST", body: { ...payload, status: "draft" }, requestId: form.requestId });
        // Aynı formun yinelenen isteği (yanıt kaybolmuştu): taslak o arada kaydedilip deftere işlendiyse bu söylenir.
        HOF.toast(saved?.replayed && saved.status !== "draft" ? `Bu form daha önce kaydedilmiş ve deftere işlenmiş (${saved.number || "kayıtlı belge"}).` : saved?.replayed ? "Taslak zaten kaydedilmişti; ikinci taslak açılmadı." : "Taslak kaydedildi; deftere işlenmedi.", { type: saved?.replayed ? "info" : "success" });
      } else {
        clearTimeout(calcTimer);
        calcPending = false;
        await runCalc();
        const c = form.calc;
        if (!c) throw Object.assign(new Error(form.calcError || "Toplamlar hesaplanamadı; kalemleri kontrol edin."), { data: form.calcFailure || {} });
        if (eSend && !sendable(form)) eSend = "";
        // 2.4.3 (keşif B7): kesimi kesin reddedecek sorun (alıcı/satıcı bilgisi eksik, posta kutusu seçilmemiş) varken "… numarasıyla kaydedilecek"
        // onayı açılmaz; neden formda ve bildirimde yazar (önceden onaydan sonra reddediliyordu).
        const blockers = [...(c.blockers || []), ...(!form.modifyId && eSend !== "later" && c.aliasBlock ? [c.aliasBlock] : [])];
        // 31f U7a: odak sorunun alanına — alıcı bilgisi eksikse "Cariyi Düzenle", numara / tarih çakışmasında (UX15) Tarih alanı (önceden BODY'ye düşüyordu).
        if (blockers.length) return fail(`Fatura kaydedilemez: ${blockers.join(" ")}`, () => focusNode(body()?.querySelector('[data-totals] [data-act="edit-account"]')) || ((c.numbering || []).length && focusNode(body()?.querySelector('[data-f="issueDate"]:not([data-l])'))));
        const who = form.account.name;
        // 2.4.4 (UX15): seride daha eski tarihli gönderilmemiş belge varken numara kayıtta verilmez (sunucu O1) — onay numara göstermez, nedeni söyler.
        const held = eSend !== "later" && !form.modifyId ? c.orderHold : null;
        const numberText = c.nextNumber && eSend !== "later" && !held ? `${c.nextNumber} numarasıyla ` : "";
        // v2.0.16 (müşteri): "Stoğa Mal Alışı"nda stok kartı olmayan kalem gider sayılır — kayıttan önce açıkça söylenir.
        const stockless = offersNewItem(form) ? usedLines(form).filter(line => !line.itemId && !line.newItem) : [];
        const stocklessText = stockless.length ? ` DİKKAT: ${stockless.map(line => `“${line.name.trim()}”`).join(", ")} stok kartı olmadan GİDER olarak kaydedilir, stoğa girmez. Mal ise Vazgeç'e basıp ürün adı kutusundaki listeden “+ Yeni Stok Kartı”nı seçin.` : "";
        const sendText = held ? ` ${held.text}` : eSend === "later" ? " Belge Gönderilecekler'de bekler; e-Belge numarası entegratöre gönderilirken verilir." : eSend === "now" ? " Belge kaydedilir kaydedilmez entegratöre (e-Belge) gönderilir." : "";
        if (form.modifyId) {
          const sure = await HOF.confirm({
            title: "Değişiklikler Kaydedilsin mi?",
            message: `${form.modifyNumber} numaralı ${kindLabel(form.kind).toLocaleLowerCase("tr-TR")} yeni haliyle kaydedilecek: ${curMoney(c.totals.payable, c.currency)} (${who}). Eski stok, cari, Kasa, taksit ve çek/senet kayıtları geri alınır, yenileri yazılır; numara değişmez. Değişiklik işlem geçmişine yazılır.${stocklessText}`,
            confirmLabel: "Değişiklikleri Kaydet",
          });
          if (!sure) return;
          saved = await withStockForce(force => HOF.api(`/api/workspace/invoices/${encodeURIComponent(form.modifyId)}/edit`, { method: "POST", body: { ...payload, ...force } }));
          HOF.toast(`${kindLabel(saved.kind)} ${saved.displayNo || saved.number || ""} düzenlendi.`, { type: "success" });
          view.form = null;
          HOF.emit("invoices-changed", saved);
          return showDoc(saved);
        }
        const ok = await HOF.confirm({
          title: ISSUE_LABELS[form.kind] || "Kaydet",
          message: `${who} için ${numberText}${kindLabel(form.kind).toLocaleLowerCase("tr-TR")}${docTypeName(form) ? ` (${docTypeName(form)})` : ""} kaydedilecek: ${curMoney(c.totals.payable, c.currency)}. Stok, cari, Kasa, çek/senet ve taksit kayıtları birlikte yazılır. ${eSend === "now" && !held ? (form.kind === "smm" ? "Gönderildikten sonra düzenlenemez; yanlışsa iptal gerekir (makbuzdan iade belgesi olmaz)." : "Gönderildikten sonra düzenlenemez; yanlışsa iptal ya da iade gerekir.") : "Yanlışsa sonradan kartındaki “Düzenle” ile düzeltilir."}${sendText}${stocklessText}`,
          confirmLabel: eSend === "later" ? "Kaydet, Sonra Gönder" : eSend === "now" ? (draftUploadFor(form) ? "Kaydet ve Taslak Yükle" : "Kaydet ve Gönder") : ISSUE_LABELS[form.kind] || "Kaydet",
        });
        if (!ok) return;
        // v2.0.22 (madde 5): formun istek kimliğiyle — yanıt gecikip yeniden Kaydet'e basılırsa sunucu ikinci fatura açmaz.
        saved = await withStockForce(force => (form.id ? HOF.api(`/api/workspace/invoices/${encodeURIComponent(form.id)}/issue`, { method: "POST", body: { ...payload, ...force, ...(eSend ? { eSend } : {}) } }) : HOF.api("/api/workspace/invoices", { method: "POST", body: { ...payload, ...force, ...(eSend ? { eSend } : {}) }, requestId: form.requestId })));
        // 2.4.4 (uzman UX20): kayıt + e-Belge gönderim sonucu TEK bildirimde (önceden aynı anda başarı ve hata bildirimi çıkıyordu); numara yalnız
        // belge numara aldıysa yazılır (numarasız bekleyende durum adı "Gönderilecek" numara gibi yazılıyordu: "Satış Faturası Gönderilecek kaydedildi.").
        const sent = saved.autoSend;
        const named = `${kindLabel(saved.kind)}${saved.number ? ` ${saved.number}` : ""}`;
        const lead = saved.replayed ? `${named} zaten kaydedilmişti (önceki gönderim sunucuya ulaşmış); ikinci kez kaydedilmedi.` : eSend === "later" ? `${kindLabel(saved.kind)} kaydedildi; Gönderilecekler'de bekliyor.` : `${named} kaydedildi.`;
        const sendNote = !sent ? "" : sent.ok || sent.held || sent.code === "einvoice-order" ? sent.message : `e-Belge gönderilemedi: ${sent.message}`;
        const type = !sent ? (saved.replayed ? "info" : "success") : sent.ok ? "success" : sent.code === "einvoice-order" ? "info" : "error";
        const timeout = sent && !sent.ok && (sent.held || sent.code === "einvoice-order") ? 12000 : sent ? 8000 : saved.replayed ? 9000 : undefined;
        HOF.toast(sendNote ? `${lead} ${sendNote}` : lead, { type, ...(timeout ? { timeout } : {}) });
        // 2.4.3 (hız testi H1): gönderilemeyen belgenin bildirimi numarayı, nedeni ve nerede beklediğini (Gönderilecekler) söyler; aynı neden kartta
        // (e-Belge satırı) ve Gönderilecekler'de kalıcı görünür. Süre eskisi gibi 8 sn (uzun bildirim pencere düğmelerinin üstünde kalıp tıklamayı
        // engelliyordu — senaryo-ebelge-242 adım 4); okuma süresine göre ayar ortak bildirim çekirdeğinin işi.
        // Dar kontrol 2.4.3 (O1): seride daha eski tarihli gönderilmemiş belge varken numara verilmedi — hata değil, belge Gönderilecekler'de bekler.
        // Ek 1 / kâhin BEKLENEN-AG: giriş reddedildi ya da EDM'ye ulaşılamadı — belge numarasız Gönderilecekler'de; ileti tam (önek yok).
      }
      view.form = null;
      HOF.emit("invoices-changed", saved);
      showDoc(saved);
    } catch (failure) {
      // Soruya "Vazgeç" kullanıcının kararıdır (kırmızı hata değil); banka sorusunda bilgi bildirimi (2.0.26 İ6 kalıbı).
      // 2.4.4 (UX10 sırasında bulundu): "else if" 2.1.0'da userCancelled dalına aitti; 2.4.3 UX5 eklemesi araya girince her hata ayrıca bilgi
      // bildirimi de açıyordu (UI2: ileti iki kez) ve verisiz hatada (ör. hesap hatası) failure.data okunurken sayfa hatası çıkıyordu.
      if (!HOF.userCancelled(failure)) fail(failure.message || "İşlem tamamlanamadı.", () => focusFailure(form, failure?.data, failure?.message));
      else if (failure?.data?.code !== "cash-negative-cancelled") HOF.toast(failure.message, { type: "info" });
      // 2.4.3 (uzman UX5): sunucu carinin mükellefiyetini gönderimde düzeltti — açık form carinin güncel bilgisini yeniden çeker (belge türü
      // e-Fatura, posta kutusu); kullanıcı yeniden kaydedince e-Fatura olarak kesilir (önceden form e-Arşiv'de kalıyordu, ikinci kayıt da düşüyordu).
      if (failure?.data?.code === "buyer-is-efatura" && view.form === form) {
        form.profile = "";
        scheduleCalc(0);
      }
    } finally {
      form.busy = false;
      body()?.querySelectorAll(".hof-actions .hof-button").forEach(button => (button.disabled = false));
      if (view.form === form && isReturn(form.kind)) syncReturnRef();
    }
  }
  // Stok eksiye düşecekse sorulur; onaylanırsa aynı istek "force" ile yeniden gönderilir (Kasa eksi uyarısını HOF.api sorar).
  // v2.1.0 Aşama 7: banka hesabına bağlı peşinde Benzer İşlem ve hesabın Eksi Bakiye sorusu da (HOF.bank.withConfirms; "Yine de Kaydet").
  // Yargıç (2.1.0): verb "cancel" / "delete" — sorunun düğmesi "Yine de İptal Et" / "Yine de Sil", Vazgeç bildirimi "İptal edilmedi" / "Silinmedi".
  const STOCK_VERBS = {
    save: ["Yine de kaydedilsin mi?", "Yine de Kaydet", "Kaydedilmedi"],
    cancel: ["Yine de iptal edilsin mi?", "Yine de İptal Et", "İptal edilmedi"],
    delete: ["Yine de silinsin mi?", "Yine de Sil", "Silinmedi"],
  };
  async function withStockForce(send, verb = "save") {
    const confirmBank = HOF.bank?.withConfirms ? fn => HOF.bank.withConfirms(fn, { verb }) : fn => fn({});
    const attempt = force => confirmBank(flags => send({ ...force, ...flags }));
    const [ask, yes, no] = STOCK_VERBS[verb] || STOCK_VERBS.save;
    try {
      return await attempt({});
    } catch (error) {
      if (error?.data?.code !== "stock-negative") throw error;
      const go = await HOF.confirm({ title: "Stok Eksiye Düşecek", message: `${error.message} Sayım farkı ya da henüz girilmemiş alış varsa ${verb === "save" ? "kaydedebilirsiniz" : "devam edebilirsiniz"}. ${ask}`, confirmLabel: yes, danger: true });
      if (!go) throw new HOF.ApiError(`${no}: stok eksiye düşecekti.`, 409, { code: "cash-negative-cancelled" });
      return attempt({ force: true });
    }
  }
  /** Kart pencerelerinde (İptal Et, Sil): soruya Vazgeç form hatası değildir; bilgi bildirimi verilir, pencere açık kalır. */
  async function keepOnCancel(run) {
    try {
      return await run();
    } catch (error) {
      if (!HOF.userCancelled(error)) throw error;
      HOF.toast(error.message, { type: "info" });
      return true;
    }
  }

  // ---------- Kart ----------
  async function loadDoc(id, { quiet = false } = {}) {
    try {
      const doc = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(id)}`);
      // Arka plan yenilemesi gelene kadar kullanıcı başka belgeye ya da listeye geçtiyse eski belge geri gelmez.
      if (quiet && (view.mode !== "card" || view.id !== id)) return;
      showDoc(doc);
    } catch (error) {
      // Kullanıcı o arada başka belgeye ya da listeye geçtiyse eski belgenin hatası onu yerinden etmez.
      if (quiet && (view.mode !== "card" || view.id !== id)) return;
      if (quiet && !HOF.lostRecord(error)) throw error;
      HOF.toastError(error);
      showList();
    }
  }
  function showDoc(doc) {
    // 2.4.4 (uzman UI5): formdan / listeden ya da başka belgeden karta geçince pencere başa kayar — belge no ve durum (başlık) görünür.
    // Önceden pencere formun kaydırma konumunda kalıyor (uzun formda en alttaki "Kaydet ve Gönder"), kartın başlığı ekranın üstünde kalıyordu.
    // Aynı kartın arka plan yenilemesi (loadDoc quiet) konumu değiştirmez.
    const fresh = view.mode !== "card" || view.id !== doc.id;
    view.doc = doc;
    view.id = doc.id;
    setMode("card");
    renderCard();
    if (fresh && modal?.dialog) modal.dialog.scrollTop = 0;
  }
  const pdfUrl = doc => `/api/workspace/invoices/${encodeURIComponent(doc.id)}/fatura.pdf`;
  // v2.0.17 (müşteri: "hayalet kısmi ödeme"): her ödenen kuruşun kaynağı kartta görünür — tarih, tür, tutar ve nasıl
  // kapattığı (Bağlı: bu faturaya yazılmış; Otomatik: carinin en eski açık faturasına dağıtılmış; Mahsup: mahsup fişi).
  // v2.0.17 (müşteri: "Düzenle pasif, izin vermiyor"): pasif düğmenin nedeni düğmenin altında yazılı — yalnız title değil.
  function blocksHtml(doc) {
    if (doc.status !== "issued" || !doc.canManage) return "";
    const items = [
      !doc.canModify && doc.modifyBlock ? ["Düzenle", doc.modifyBlock] : null,
      !doc.canCancel && doc.cancelBlock ? ["İptal Et", doc.cancelBlock] : null,
      !doc.canDelete && doc.deleteBlock ? ["Sil", doc.deleteBlock] : null,
      !doc.canReturn && doc.returnBlock ? ["İade", doc.returnBlock] : null,
    ].filter(Boolean);
    if (!items.length) return "";
    return `<ul class="hof-inv-blocks">${items.map(([name, why]) => `<li><b>${esc(name)} kapalı:</b> ${esc(why)}</li>`).join("")}</ul>`;
  }
  // Kalan satırı. İade belgesinin açığı (v2.1.0, K1): asıl faturaya mahsup edilemeyen ve geri ödenmeyen iade alacağı — satıştan iadede
  // müşterinin alacağı, alıştan iadede tedarikçinin borcu (cariye ödeme/tahsilatla kapanır).
  function restText(doc) {
    if (!(doc.open > 0.004)) return `<b>${esc(doc.payStateLabel || "Kapandı")}</b>`;
    if (isReturn(doc.kind)) return `Mahsup edilmemiş iade (${sideOf(doc.kind) === "sale" ? "müşterinin alacağı" : "tedarikçinin borcu"}): <b>${esc(money(doc.open))}</b>`;
    return `Açık: <b>${esc(money(doc.open))}</b>${doc.paid > 0 ? ` · ödenen ${esc(money(doc.paid))}` : ""}`;
  }
  function closersHtml(doc) {
    if (doc.status !== "issued" || isReturn(doc.kind)) return "";
    const rows = (doc.closers || []).map(item => {
      const offsetId = item.id.startsWith("offset:") ? item.id.slice(7) : "";
      return `<li><span>${esc(HOF.formatDate(item.date))} · ${esc(item.label || "Ödeme")}${item.methodLabel ? ` (${esc(item.methodLabel)})` : ""}${item.note && !offsetId ? ` <small>${esc(item.note)}</small>` : ""}</span><b>${esc(money(item.amount))}</b><em class="hof-plan-badge is-${item.mode === "auto" ? "muted" : item.mode === "offset" ? "soon" : "info"}">${esc(item.modeLabel || "")}</em>${offsetId && doc.canManage ? `<button type="button" class="hof-link-button" data-act="offset-remove" data-offset="${esc(offsetId)}">Kaldır</button>` : ""}</li>`;
    });
    // v2.0.23: taksitli fatura kendi taksit kartıyla kapanır; mahsup edilmez (sunucu da reddeder).
    const canOffset = doc.canManage && doc.open > 0.004 && !doc.planId;
    const hint = doc.planId ? " Taksitli fatura kendi taksit kartıyla kapanır; tahsilat taksit kartından girilir." : sideOf(doc.kind) === "sale" ? " Aynı cariye kesilen alış faturası ve Alacak Yaz satırı kendiliğinden ödeme sayılmaz; karşılıklı kapama için Mahsup Et." : " Aynı cariye kesilen satış faturası ve Borç Yaz satırı kendiliğinden ödeme sayılmaz; karşılıklı kapama için Mahsup Et.";
    return `<div class="hof-inv-closers"><h5>${doc.kind === "smm" ? "Bu Makbuzu Kapatanlar" : "Bu Faturayı Kapatanlar"}</h5>${rows.length ? `<ul>${rows.join("")}</ul>` : `<p class="hof-muted">Henüz kapatan yok.${hint}</p>`}${canOffset ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="offset">Mahsup Et</button>' : ""}</div>`;
  }
  // 2.4.4 (uzman UX17): kartın üstündeki tutarın adı belgenin durumuna göre. Kapanmış (ödenmiş / mahsup edilmiş) faturada "Tahsil Edilecek"
  // yazmaz: "Genel Toplam" (tevkifat / stopaj kesintisi varsa "Kesinti Sonrası Toplam"); kısmen ödenmişte büyük rakam "Kalan" (headAmountHtml). Tutar değişmez
  // (belgenin ödenecek toplamı); Toplamlar bölümündeki "Tahsil Edilecek" satırı mali terimdir, dokunulmaz.
  const isClosed = doc => doc.status === "issued" && !(doc.open > 0.004);
  // Kâğıt makbuz olarak bırakılmış e-SMM (MM4 alt kararı; sunucu paperReceiptBlockOf): e-SMM olarak hiç gönderilmez, e-Belge XML'i yoktur — kâğıt
  // faturadaki gibi "XML İndir" görünmez (bırakılan e-Arşiv fatura sonradan gönderilebildiği için onda kalır).
  const isPaperReceipt = doc => doc.kind === "smm" && doc.eStatus === "withdrawn";
  const totalLabel = doc => (doc.kind === "smm" ? "Makbuz Tutarı (Net)" : Math.abs((doc.payableTotal || 0) - (doc.grossTotal || 0)) > 0.004 ? "Kesinti Sonrası Toplam" : "Genel Toplam");
  function headAmountLabel(doc) {
    if (doc.status === "cancelled") return "Belge Tutarı (İptal Edildi)";
    if (isReturn(doc.kind)) return "İade Tutarı";
    // Makbuz (MM7): kapanmış makbuzun tutarı tahsil edilendir (GİB e-SMM "Tahsil Edilen"); "Genel Toplam" makbuzda yoktur.
    if (isClosed(doc)) return doc.kind === "smm" ? "Tahsil Edilen (Net Alınan)" : totalLabel(doc);
    return sideOf(doc.kind) === "sale" ? "Tahsil Edilecek" : "Ödenecek";
  }
  // 31f U13: kısmen ödenmiş belgede büyük rakam KALAN (QuickBooks/Xero "Balance Due"); belgenin toplamı altında küçük yazılır. Tutarlar sunucudan, hesap değişmez.
  const isPartial = doc => doc.status === "issued" && !isReturn(doc.kind) && doc.open > 0.004 && doc.paid > 0.004;
  function headAmountHtml(doc) {
    const cur = doc.currency;
    if (isPartial(doc)) return `<span>Kalan</span><strong>${esc(money(doc.open))}</strong><small class="hof-inv-head-rest">${esc(totalLabel(doc))} ${esc(curMoney(doc.payableTotal, cur))}${cur !== "TRY" ? ` (${esc(money(doc.tryPayable))})` : ""} · ödenen ${esc(money(doc.paid))}</small>`;
    return `<span>${esc(headAmountLabel(doc))}</span><strong>${esc(curMoney(doc.payableTotal, cur))}</strong>${cur !== "TRY" ? `<small>${esc(money(doc.tryPayable))}</small>` : ""}`;
  }
  function renderCard() {
    const root = body();
    const doc = view.doc;
    if (!root || !doc) return;
    const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "");
    const party = doc.party || {};
    const cur = doc.currency;
    const ret = isReturn(doc.kind);
    // Bizim kestiğimiz belge e-Belge bağlantısı kapalıyken "Müşteri Fişi"dir; alış ve müşterinin iade faturası karşı
    // tarafın belgesidir (kâğıt ya da e-Belge), fiş değildir.
    const profileText = !isOwn(doc.kind) ? (doc.profile === "KAGIT" ? "Kâğıt Fatura (karşı tarafın belgesi)" : doc.profileLabel) : doc.profile === "KAGIT" ? (edoc() ? "Kâğıt Belge" : "Müşteri Fişi (resmî hükmü yok)") : doc.profileLabel;
    // v2.0.16 (müşteri): Stok Kodu ayrı kolon (kalemlerden birinde kod varsa).
    const hasCodes = doc.lines.some(line => line.code);
    const lineRows = doc.lines
      .map((line, index) => `<tr><td>${index + 1}</td>${hasCodes ? `<td class="hof-inv-doc-code">${esc(line.code || "")}</td>` : ""}<td><b>${esc(line.name)}</b>${line.description ? `<small>${esc(line.description)}</small>` : ""}${line.serialNo || line.lotNo ? `<small>${esc([line.serialNo ? `Seri No: ${line.serialNo}` : "", line.lotNo ? `Lot No: ${line.lotNo}` : ""].filter(Boolean).join(" · "))}</small>` : ""}${line.expenseLabel ? `<small>${esc(line.expenseLabel)}</small>` : ""}${line.withholdingCode ? `<small>Tevkifat ${esc(line.withholdingCode)} (${line.withholdingNum}/${line.withholdingDen})</small>` : ""}</td><td class="num">${esc(String(line.qty).replace(".", ","))} ${esc(line.unit)}${line.returned ? `<small>${esc(String(line.returned).replace(".", ","))} iade</small>` : ""}</td><td class="num">${esc(curMoney(line.unitPrice, cur))}</td><td class="num">${line.discountRate ? `%${esc(String(line.discountRate).replace(".", ","))}` : ""}</td><td class="num">%${esc(String(line.vatRate))}</td><td class="num"><b>${esc(curMoney(line.net, cur))}</b></td></tr>`)
      .join("");
    const totals = doc.kind === "smm" ? receiptRows({ baseNet: doc.baseNetTotal ?? doc.baseTotal, discountNet: doc.discountNetTotal ?? doc.discountTotal, net: doc.netTotal, stoppage: doc.stoppageTotal, stoppageRate: doc.stoppageRate, byRate: doc.byRate, vat: doc.vatTotal, withheld: doc.withheldTotal, payable: doc.payableTotal }) : [
      ...totalRows({ includeVat: doc.pricesIncludeVat, base: doc.baseTotal, baseNet: doc.baseNetTotal, discountNet: doc.discountNetTotal, discount: doc.discountTotal, net: doc.netTotal }),
      ...(doc.byRate || []).map(item => [`KDV %${item.rate}`, item.vat]),
      doc.withheldTotal > 0 ? ["KDV Tevkifatı", -doc.withheldTotal] : null,
      doc.stoppageTotal > 0 ? [`Gelir Vergisi Stopajı %${doc.stoppageRate}`, -doc.stoppageTotal] : null,
      ["Genel Toplam", doc.grossTotal],
      doc.payableTotal !== doc.grossTotal ? [sideOf(doc.kind) === "sale" ? "Tahsil Edilecek" : "Ödenecek", doc.payableTotal] : null,
    ].filter(Boolean);
    const payments = [
      ...(doc.payments || []).map(item => `<li>${esc(HOF.formatDate(item.date))} · ${item.kind === "in" ? "Tahsilat" : "Ödeme"} (${esc(item.methodLabel)}) <b>${esc(money(item.amount))}</b></li>`),
      ...(doc.cheques || []).map(item => `<li>${item.endorsed ? "Ciro Edilen " : ""}${esc(item.instrumentLabel)}${item.serialNo ? ` No ${esc(item.serialNo)}` : ""} · vade ${esc(HOF.formatDate(item.dueDate))} · <b>${esc(money(item.amount))}</b> · ${esc(item.statusLabel)} ${HOF.can("cheques.view") ? `<a href="#" data-open-cheque="${esc(item.id)}">Evrak Kartı</a>` : ""}</li>`),
      doc.plan ? `<li>Taksit Kartı: <a href="#" data-open-plan="${esc(doc.plan.id)}">${esc(doc.plan.name)}</a> · ${esc(money(doc.plan.total))}</li>` : "",
    ]
      .filter(Boolean)
      .join("");
    const returns = (doc.returns || []).map(item => `<li><a href="#" data-open-invoice="${esc(item.id)}">${esc(item.number || "İade")}</a> · ${esc(HOF.formatDate(item.issueDate))} · ${esc(money(item.tryPayable))}${item.status === "cancelled" ? " · iptal edildi" : ""}</li>`).join("");
    const phone = HOF.workspace?.extractPhones?.(party.phone || doc.accountPhone || "")[0] || "";
    const email = String(party.email || "").trim();
    const eTools =
      edoc() && doc.status !== "draft" && (doc.profile !== "KAGIT" || doc.eStatus === "withdrawn") && meta.kinds[doc.kind]?.own
        ? `<span class="hof-plan-toolgroup">${sendButtons(doc)}${doc.canWithdraw ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="e-withdraw" title="${esc(paperOf(doc.kind).hint)}">${esc(paperOf(doc.kind).button)}</button>` : ""}${doc.canRefresh ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="e-refresh">Durum Sorgula</button>' : ""}${doc.canOfficial ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/${esc(doc.id)}/resmi.pdf?inline=1" target="_blank" rel="noopener" data-act="e-official" title="Entegratörün ürettiği, alıcının ve GİB'in gördüğü görüntü">Resmî Görüntü</a>` : ""}${doc.status === "issued" && !isPaperReceipt(doc) ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/${esc(doc.id)}/ubl.xml" download>XML İndir</a>` : ""}</span>`
        : "";
    HOF.swap(
      root,
      `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${esc(docTitle(doc))} ${statusPill(doc)}</h3><small>${esc(doc.accountName)} · ${esc(HOF.formatDate(doc.issueDate))} ${esc(doc.issueTime || "")}${doc.scenarioLabel ? ` · ${esc(doc.scenarioLabel)}` : ""}</small></div></div>
        <div class="hof-chq-amount">${headAmountHtml(doc)}</div>
      </div>
      <div class="hof-inv-pills" role="group" aria-label="Bağlı kartlar">
        <button type="button" class="hof-inv-big-pill" data-open-account="${esc(doc.accountId)}"><b>Cari Kartı</b><small>${esc(doc.accountName)}</small></button>
        ${
          ret
            ? doc.originalId
              ? `<button type="button" class="hof-inv-big-pill" data-open-invoice="${esc(doc.originalId)}"><b>Asıl Fatura</b><small>${esc(doc.originalNumber || "")}</small></button>`
              : ""
            : `<button type="button" class="hof-inv-big-pill" data-act="return" ${doc.canReturn ? "" : "disabled"} title="${doc.canReturn ? "Bu faturadan iade oluştur" : doc.kind === "smm" && doc.returnBlock ? esc(doc.returnBlock) : doc.status === "issued" ? "İade edilebilecek kalem kalmadı" : "Yalnız kaydedilmiş faturadan iade oluşturulur"}"><b>İade</b><small>${doc.returns?.length ? `${doc.returns.length} iade` : doc.canReturn ? "Bu Faturadan İade Oluştur" : "İade Yok"}</small></button>`
        }
      </div>
      <div class="hof-chq-actions" role="toolbar" aria-label="Belge işlemleri">
        <span class="hof-plan-toolgroup">${office().outputButtons ? office().outputButtons(pdfUrl(doc), "card", `${doc.status === "draft" ? "Proforma" : kindLabel(doc.kind)} - PDF`) : `<a class="hof-button hof-button-small hof-button-ghost" href="${esc(pdfUrl(doc))}" target="_blank" rel="noopener">PDF</a>`}${phone && doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}${doc.status === "issued" && isOwn(doc.kind) ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="email" data-mail="${esc(email)}" title="${email ? `${esc(email)} adresine e-posta penceresi açılır; PDF indirilir` : "Cari kartında e-posta adresi yok"}">E-Posta</button>` : ""}</span>
        ${doc.status === "issued" && doc.open > 0.004 && !ret && HOF.can(sideOf(doc.kind) === "sale" ? "accounts.collect" : "accounts.manage") ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small" data-act="pay">${sideOf(doc.kind) === "sale" ? "+ Tahsilat Ekle" : "+ Ödeme Yap"}</button></span>` : ""}
        ${doc.canManage ? `<span class="hof-plan-toolgroup">${doc.canEdit ? '<button type="button" class="hof-button hof-button-small" data-act="edit">Düzenle ve Kaydet</button>' : ""}${doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small" data-act="modify" ${doc.canModify ? "" : "disabled"} title="${esc(doc.modifyBlock || "Belgeyi düzeltip yeniden kaydedin; numara değişmez, stok, cari, Kasa ve taksit kayıtları yeni hale göre yazılır")}">Düzenle</button>` : ""}${!ret ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="copy" title="Aynı cari ve kalemlerle yeni belge">Kopyala</button>' : ""}${doc.canRepeat ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="${doc.repeat ? "repeat-stop" : "repeat"}" title="${doc.repeat ? "Tekrar emrini durdur" : "Abonelik, kira, aidat: her dönem taslak hazırlanır"}">${doc.repeat ? "Tekrarı Durdur" : "Tekrarla"}</button>` : ""}${doc.status === "draft" || doc.status === "cancelled" || doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="delete" ${doc.canDelete ? "" : "disabled"} title="${esc(doc.deleteBlock || (doc.status === "draft" ? "Taslağı Silinenler'e gönder" : "Bütün etkileri geri alınır, belge Silinenler'e gider"))}">Sil</button>` : ""}${doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="cancel" ${doc.canCancel ? "" : "disabled"} title="${esc(doc.cancelBlock || "Bütün etkileri geri alınır; numara korunur")}">İptal Et</button>` : ""}${doc.canLocalCancel ? '<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="local-cancel" title="Entegratöre ulaşılamıyorsa: belge yalnız programda iptal edilir (yetkili)">Yalnız Programda İptal Et</button>' : ""}</span>` : ""}
        ${eTools}
      </div>
      ${blocksHtml(doc)}
      ${doc.status === "cancelled" ? `<p class="hof-inv-banner is-cancelled">${esc(HOF.formatDateTime(doc.cancelledAt))} tarihinde iptal edildi${doc.cancelReason ? `: ${esc(doc.cancelReason)}` : ""}. Stok, cari, Kasa, çek/senet ve taksit etkileri geri alındı.</p>` : ""}
      ${doc.repeat ? `<p class="hof-inv-banner is-ok">Tekrarlanıyor: her ${doc.repeat.everyMonths} ayda bir · sıradaki ${esc(HOF.formatDate(doc.repeat.nextDate))}${doc.repeat.untilDate ? ` · bitiş ${esc(HOF.formatDate(doc.repeat.untilDate))}` : ""} · ${doc.repeat.made} taslak hazırlandı. Günü gelen taslak Taslaklar sekmesinde bekler; kontrol edip kaydedin.</p>` : ""}
      ${doc.status === "draft" ? '<p class="hof-inv-banner">Taslak: deftere işlenmedi, numarası yok. “Düzenle ve Kaydet” ile kaydedin; PDF proforma olarak basılır.</p>' : ""}
      ${edoc() && doc.eMessage ? `<p class="hof-inv-banner is-e">e-Belge: ${esc(doc.eMessage)}${doc.eAt ? ` <small>${esc(HOF.formatDateTime(doc.eAt))}</small>` : ""}</p>` : ""}
      <dl class="hof-chq-facts">
        ${fact("Tarih ve Saat", `${esc(HOF.formatDate(doc.issueDate))} ${esc(doc.issueTime || "")}`)}
        ${fact("Vade", doc.status === "issued" && doc.dueDate && !ret ? esc(HOF.formatDate(doc.dueDate)) : "")}
        ${fact("Cari", `<a href="#" data-open-account="${esc(doc.accountId)}">${esc(doc.accountName)}</a>`)}
        ${fact(String(party.taxNo || "").length === 11 ? "TC Kimlik No" : "Vergi No", esc(party.taxNo || ""))}
        ${fact("Vergi Dairesi", esc(party.taxOffice || ""))}
        ${fact("Adres", esc([party.address, party.district, party.city].filter(Boolean).join(", ")))}
        ${fact("Belge Türü", esc(doc.eStatus === "withdrawn" ? paperOf(doc.kind).kindText : profileText))}
        ${fact("e-Belge", doc.sendBlock ? `<span class="hof-inv-warn">${esc(doc.sendBlock)}</span>` : doc.eStatus === "waiting" ? "Gönderilecekler'de: numara entegratöre gönderilirken verilir." : edoc() && doc.eUnsent ? `<span class="hof-inv-warn">${doc.eStatusLabel === "Sonucu Belirsiz" ? "Son gönderimin sonucu belirsiz: önce Durum Sorgula'ya basın." : "Numara aldı ama entegratöre ulaşmadı; Gönderilecekler'de bekliyor. e-Belge Gönder ile ya da Gönderilecekler'den (Tümünü Gönder) gönderin."}</span>` : "")}
        ${fact("Son İptal Günü", doc.status === "issued" && doc.cancelWindow ? (doc.cancelWindow.late ? `<span class="hof-inv-warn">Süre Doldu (en geç ${esc(HOF.formatDate(doc.cancelWindow.lastDay))})</span>` : esc(doc.cancelDeadline || "")) : "")}
        ${fact("Para Birimi", cur !== "TRY" ? `${esc(cur)} · kur ${esc(String(doc.rate).replace(".", ","))}` : "")}
        ${fact("Asıl Fatura", doc.originalId ? `<a href="#" data-open-invoice="${esc(doc.originalId)}">${esc(doc.originalNumber || "")}</a> · ${esc(HOF.formatDate(doc.originalDate))}` : "")}
        ${fact("Sipariş", doc.orderNo ? `${esc(doc.orderNo)}${doc.orderDate ? ` · ${esc(HOF.formatDate(doc.orderDate))}` : ""}` : "")}
        ${fact("İrsaliye", doc.despatchNo ? `${esc(doc.despatchNo)}${doc.despatchDate ? ` · ${esc(HOF.formatDate(doc.despatchDate))}` : ""}` : "")}
        ${fact(doc.kind === "smm" ? "Kâğıt Makbuz No" : "Kâğıt Fatura No", esc(doc.paperNo || ""))}
        ${fact("ETTN", edoc() && doc.profile !== "KAGIT" ? `<small>${esc(doc.ettn)}</small>` : "")}
        ${fact("Kaydeden", esc(doc.actorName || ""))}
      </dl>
      <div class="hof-rep-table"><table class="hof-table hof-inv-doc-lines"><thead><tr><th>#</th>${hasCodes ? "<th>Stok Kodu</th>" : ""}<th>${doc.kind === "smm" ? "Hizmet" : "Ürün / Hizmet"}</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">İsk.</th><th class="num">KDV</th><th class="num">${doc.kind === "smm" ? "Brüt Ücret" : "Tutar"}</th></tr></thead><tbody>${lineRows}</tbody></table></div>
      <div class="hof-inv-bottom">
        <section class="hof-inv-pay"><h4>Ödeme</h4>${payments ? `<ul class="hof-inv-paylist">${payments}</ul>` : '<p class="hof-muted">Peşin ödeme yok.</p>'}${closersHtml(doc)}${doc.status === "issued" ? `<p class="hof-inv-rest">${restText(doc)}</p>` : ""}${returns ? `<h4>İadeler</h4><ul class="hof-inv-paylist">${returns}</ul>` : ""}</section>
        <section class="hof-inv-sum"><h4>Toplamlar</h4><dl class="hof-inv-totals">${totals.map(([label, value], index) => `<div class="${index === totals.length - 1 ? "is-total" : ""}"><dt>${esc(label)}</dt><dd>${esc(curMoney(value, cur))}</dd></div>`).join("")}${cur !== "TRY" ? `<div><dt>TL Karşılığı</dt><dd>${esc(money(doc.tryPayable))}</dd></div>` : ""}</dl><p class="hof-inv-words">${esc(doc.amountInWords || "")}</p></section>
      </div>
      ${doc.note ? `<div class="hof-plan-note"><h4>Not</h4><p>${esc(doc.note)}</p></div>` : ""}`,
    );
  }
  async function cardAction(act, target) {
    const doc = view.doc;
    if (!doc) return;
    if (act === "edit") return startForm({ draft: doc });
    if (act === "modify") return doc.canModify ? startForm({ modify: doc }) : HOF.toast(doc.modifyBlock || "Bu belge düzenlenemez.", { type: "error" });
    if (act === "copy") return startForm({ copyOf: doc });
    if (act === "return") return doc.canReturn ? startReturn(doc.id) : null;
    if (act === "delete") return doc.canDelete ? deleteForm(doc) : HOF.toast(doc.deleteBlock || "Bu belge silinemez.", { type: "error" });
    if (act === "cancel") return cancelForm(doc);
    if (act === "local-cancel") return localCancelForm(doc);
    if (act === "pay") return payForm(doc);
    if (act === "offset") return offsetForm(doc);
    if (act === "offset-remove") {
      const go = await HOF.confirm({ title: "Mahsup Kaldırılsın mı?", message: "Mahsup fişi silinir; iki belgenin ödenme durumu yeniden hesaplanır. Cari bakiyesi değişmez.", confirmLabel: "Kaldır", danger: true });
      if (!go) return;
      showDoc(await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/offsets/${encodeURIComponent(target.dataset.offset)}`, { method: "DELETE" }));
      HOF.emit("accounts-changed");
      return HOF.toast("Mahsup kaldırıldı.", { type: "success" });
    }
    if (act === "repeat") return repeatForm(doc);
    if (act === "repeat-stop") {
      if (!(await HOF.confirm({ title: "Tekrar Durdurulsun mu?", message: "Bundan sonra taslak hazırlanmaz; hazırlanmış taslaklar durur.", confirmLabel: "Durdur" }))) return;
      try {
        showDoc(await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/repeat-stop`, { method: "POST", body: {} }));
      } catch (error) {
        HOF.toastError(error);
      }
    }
    if (act === "whatsapp") return sendWhatsapp(doc, target.dataset.wa);
    if (act === "email") return sendEmail(doc, target.dataset.mail);
    if (act === "e-send") return eAction(doc, "send");
    if (act === "e-draft") return eAction(doc, "e-draft");
    if (act === "e-withdraw") return withdrawDoc(doc);
    if (act === "e-refresh") return eAction(doc, "e-refresh");
  }
  // Faturaya tahsilat / ödeme: taksitli faturada taksit kartından (taksitten düşer), değilse cariye Kasa hareketi. Cari
  // ödemeleri faturalara en eski açık faturadan başlayarak sayılır (bu faturadan önce açık fatura varsa önce o kapanır).
  function payForm(doc) {
    const sale = sideOf(doc.kind) === "sale";
    const requestId = HOF.requestId();
    if (doc.plan && sale && HOF.plans?.open) {
      modal?.close();
      return HOF.plans.open(doc.plan.id);
    }
    // 2.4.4 UX18 (kullanıcı kararı 21.10.2026): Çek / Senet de bu faturayı kapatır — evrak formu cari, tutar ve Kapatılacak Fatura (bu fatura) dolu
    // açılır; bağ yalnız evrakın olayında (fatura iptal edilirse evrak portföyde kalır). Cari formundaki seçenekle aynı koşul (yetki).
    const method = HOF.methodField("cash", { incoming: sale });
    if (HOF.cheques?.newFor && HOF.can("cheques.manage")) method.options = [...method.options, { value: "cheque", label: sale ? "Çek / Senet (portföye alınır)" : "Çek / Senet (verilir)" }];
    HOF.formModal({
      title: sale ? "Tahsilat Ekle" : "Ödeme Yap",
      eyebrow: docTitle(doc),
      intro: `Açık tutar ${money(doc.open)}. Kayıt cariye ve Kasa'ya yazılır; bu faturaya bağlı kapatılır (fazlası carinin en eski açık faturasına gider).`,
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: amountText(doc.open), autofocus: true },
        { name: "date", label: "Tarih", type: "date", required: true, value: todayIso(), max: "today" },
        method,
        { name: "note", label: "Açıklama", maxlength: 300, value: `${doc.displayNo} ${sale ? "tahsilatı" : "ödemesi"}` },
      ],
      submitLabel: sale ? "Tahsilatı Kaydet" : "Ödemeyi Kaydet",
      // v2.1.0 Aşama 7: Havale / EFT'de Banka Hesabı (tek hesapta gizli); istek kimliği; banka hesabının Benzer İşlem ve Eksi Bakiye soruları.
      // K2 (plan §3.7 #3, #5, §8.9): alış faturasına ödemede "Kredi Kartı" kurumsal kartla ödemedir → Kurumsal Kart seçicisi.
      onOpen: dialog => {
        // 2.7: seçicide bakiye (tahsilat hesaba girer; ödeme hesaptan / kredi kartından çıkar).
        const picker = HOF.bank?.attachPicker ? HOF.bank.attachPicker(dialog.querySelector("form"), { methodName: "method", card: sale ? null : {}, direction: sale ? "in" : "out" }) : null;
        // m4 (10.10.2026): açıklama seçilen YOLA göre (cari formundaki metin; önceden yol ne olursa olsun "Kasa'ya yazılır").
        const help = () => HOF.accounts?.syncEntryHelp?.(dialog, sale ? "in" : "out", text => `Açık tutar ${money(doc.open)}. ${text} Bu faturaya bağlı kapatılır (fazlası carinin en eski açık faturasına gider).`);
        dialog.querySelector("form")?.addEventListener("change", help);
        help();
        Promise.resolve(picker).then(help).catch(() => null);
      },
      onSubmit: async data => {
        if (data.method === "cheque") {
          // Evrak formu bu formun yerine açılır (Kasa değişmez); kaydedilince fatura kartı kendiliğinden yenilenir (cheques değişikliği).
          setTimeout(() => HOF.cheques.newFor({ direction: sale ? "in" : "out", account: { id: doc.accountId, name: doc.accountName }, amount: String(data.amount || "").trim(), invoiceId: doc.id, invoiceLabel: `${docTitle(doc)} · açık ${money(doc.open)}` }), 150);
          return;
        }
        const account = data.method === "bank" ? data.bankAccountId : data.method === "card" && !sale ? data.cardAccountId : "";
        const body = { kind: sale ? "in" : "out", amount: data.amount, date: data.date, method: data.method, invoiceId: doc.id, note: data.note, ...(account ? { bankAccountId: account } : {}) };
        const send = flags => HOF.api(`/api/workspace/accounts/${encodeURIComponent(doc.accountId)}/entries`, { method: "POST", body: { ...body, ...flags }, requestId });
        await (HOF.bank?.withConfirms ? HOF.bank.withConfirms(send) : send({}));
        HOF.toast(sale ? "Tahsilat kaydedildi." : "Ödeme kaydedildi.", { type: "success" });
        loadDoc(doc.id);
      },
    });
  }
  // Mahsup Et (v2.0.17): aynı carinin karşı yöndeki açık faturası ya da Alacak/Borç Yaz satırıyla karşılıklı kapama.
  async function offsetForm(doc) {
    let data;
    try {
      data = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/offsets`);
    } catch (error) {
      return HOF.toastError(error);
    }
    const options = [
      ...data.invoices.map(item => ({ value: `invoice:${item.id}`, label: `${item.kindLabel} ${item.displayNo} · ${HOF.formatDate(item.issueDate)} · açık ${money(item.open)}`, left: item.open })),
      ...data.entries.map(item => ({ value: `entry:${item.id}`, label: `${item.label} · ${HOF.formatDate(item.date)}${item.note ? ` · ${item.note}` : ""} · kalan ${money(item.left)}`, left: item.left })),
    ];
    if (!options.length) return HOF.toast(data.side === "sale" ? "Bu caride mahsup edilecek açık alış faturası ya da Alacak Yaz satırı yok." : "Bu caride mahsup edilecek açık satış faturası ya da Borç Yaz satırı yok.", { type: "info" });
    const first = options[0];
    HOF.formModal({
      title: "Mahsup Et",
      eyebrow: docTitle(doc),
      intro: `Açık tutar ${money(data.open)}. Seçilen karşı belgeyle karşılıklı kapanır; cari bakiyesi ve Kasa değişmez (bakiye zaten net). Mahsup fişi karttan kaldırılabilir.`,
      fields: [
        { name: "counter", label: "Karşı Belge", type: "select", value: first.value, options },
        { name: "amount", label: "Mahsup Tutarı (₺)", required: true, inputmode: "decimal", value: amountText(Math.min(data.open, first.left)), autofocus: true },
        { name: "date", label: "Tarih", type: "date", required: true, value: todayIso(), max: "today" },
        { name: "note", label: "Açıklama", maxlength: 300, value: "" },
      ],
      submitLabel: "Mahsup Et",
      onOpen: dialog => {
        const select = dialog.querySelector('select[name="counter"]');
        const amount = dialog.querySelector('input[name="amount"]');
        select?.addEventListener("change", () => {
          const picked = options.find(item => item.value === select.value);
          if (picked && amount) amount.value = amountText(Math.min(data.open, picked.left));
        });
      },
      onSubmit: async form => {
        const [counterType, counterId] = String(form.counter || "").split(/:(.+)/);
        const saved = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/offsets`, { method: "POST", body: { counterType, counterId, amount: form.amount, date: form.date, note: form.note } });
        showDoc(saved);
        HOF.emit("accounts-changed");
        HOF.toast(`Mahsup kaydedildi. ${saved.open > 0.004 ? `Açık: ${money(saved.open)}.` : "Fatura kapandı."}`, { type: "success" });
      },
    });
  }
  function repeatForm(doc) {
    const [y, m, d] = doc.issueDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, Math.min(d, 28))).toISOString().slice(0, 10);
    HOF.formModal({
      title: "Faturayı Tekrarla",
      eyebrow: docTitle(doc),
      intro: "Abonelik, kira, aidat gibi düzenli faturalar için: her dönem aynı cari ve kalemlerle TASLAK hazırlanır. Taslak deftere yazılmaz; Taslaklar sekmesinden kontrol edip kesersiniz.",
      fields: [
        { name: "everyMonths", label: "Kaç Ayda Bir", type: "select", value: "1", options: [1, 2, 3, 6, 12].map(n => ({ value: String(n), label: n === 1 ? "Her Ay" : n === 12 ? "Her Yıl" : `${n} Ayda Bir` })) },
        { name: "nextDate", label: "İlk Tekrar Tarihi", type: "date", required: true, value: next },
        { name: "untilDate", label: "Bitiş Tarihi (isteğe bağlı)", type: "date", value: "" },
      ],
      submitLabel: "Tekrarı Başlat",
      onSubmit: async data => {
        const saved = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/repeat`, { method: "POST", body: data });
        HOF.toast(saved.repeatMade ? `${saved.repeatMade} taslak hemen hazırlandı (günü gelmiş dönemler).` : "Tekrar emri kaydedildi.", { type: "success" });
        showDoc(saved);
      },
    });
  }
  // 2.3.0 (İz 3.2; plan §3.8 Fatura, §4.6): POS peşinli belgede İptal / Sil penceresi "POS İşlemi"ni sorar. Müşteriye İade Edildi (varsayılan):
  // provizyon içinde ve valörden önce void (komisyon yok), sonrasında İptal İadesi (geçmiş gün fişleri değişmez). Kayıt Hatası: POS işlemi hiç
  // olmadı — valörden önce void; bankaya geçmişse gün fişi yeniden planlanır, eşleşmiş/kilitliyse belge iptal edilmez (409 pos-settled).
  const posOutcomeField = (count = 1) => ({
    name: "posOutcome", label: count > 1 ? `POS İşlemi (${count.toLocaleString("tr-TR")} belgede POS tahsilatı var)` : "POS İşlemi", type: "select", value: "refunded",
    options: [{ value: "refunded", label: "Müşteriye İade Edildi" }, { value: "entry-error", label: "Kayıt Hatası (POS işlemi hiç olmadı)" }],
    help: "Müşteriye İade Edildi: provizyon içinde iptal, komisyon doğmaz; sonrasında İptal İadesi (bankaya geçen tutar iade valöründe bankadan çıkar). Kayıt Hatası: POS kaydı silinir; bankaya geçmiş ve ekstreyle eşleşmiş ya da kilitli dönemdeyse belge iptal edilmez.",
  });
  const posOutcomeOf = data => (data?.posOutcome === "entry-error" ? "entry-error" : "refunded");
  function cancelForm(doc) {
    const sentEInvoice = edoc() && ["TEMELFATURA", "TICARIFATURA"].includes(doc.profile) && ["sent", "accepted"].includes(doc.eStatus);
    // İz 7.3: EDM portalındaki e-Fatura taslağı programdan silinemez; kullanıcı portaldan siler, burada onaylar.
    const draftEInvoice = edoc() && ["TEMELFATURA", "TICARIFATURA"].includes(doc.profile) && doc.eStatus === "draft";
    const earchive = edoc() && doc.profile === "EARSIVFATURA" && ["draft", "processing", "sent", "accepted", "error"].includes(doc.eStatus);
    // 2.4.4 madde 22: gönderilmiş e-SMM de önce entegratörde (EDM e-SMM servisi) iptal edilir (sunucu: remoteEligible).
    const esmm = edoc() && doc.profile === "ESMM" && ["processing", "sent", "accepted", "error"].includes(doc.eStatus);
    HOF.formModal({
      title: `${docTitle(doc)} İptal Edilsin mi?`,
      eyebrow: "İPTAL",
      intro: `Belgenin bütün etkileri birlikte geri alınır: stok, cari borç/alacak, peşin tahsilat/ödeme (Kasa), çek/senet ve taksit kartı. Numara korunur; belge "İptal Edildi" olarak kalır.${doc.cancelNotice ? ` ${doc.cancelNotice}` : ""}${earchive ? " e-Arşiv fatura önce entegratörde (EDM) iptal edilir." : ""}${esmm ? " e-SMM önce entegratörde (EDM) iptal edilir." : ""}`,
      fields: [
        { name: "reason", label: "İptal Nedeni", maxlength: 300, placeholder: "ör. Müşteri vazgeçti, yanlış tutar", autofocus: true },
        ...(doc.posCash ? [posOutcomeField()] : []),
        ...(sentEInvoice ? [{ name: "confirmExternal", label: "Bu e-Fatura alıcı tarafından reddedildi ya da GİB'den iptal edildi; programda da iptal edilsin.", type: "checkbox", value: false }] : []),
        ...(draftEInvoice ? [{ name: "confirmExternal", label: "EDM portalındaki taslağı sildim; programda da iptal edilsin.", type: "checkbox", value: false }] : []),
      ],
      submitLabel: "İptal Et",
      onSubmit: async data => {
        if (draftEInvoice && !data.confirmExternal) throw new Error("Bu e-Fatura EDM portalında taslak olarak duruyor: önce portalda taslağı silin (yoksa portaldan gönderilebilir), sonra kutuyu işaretleyin.");
        if (sentEInvoice && !data.confirmExternal) throw new Error("Gönderilmiş e-Fatura önce GİB / alıcı tarafında iptal edilmeli (ret ya da iptal talebi); sonra kutuyu işaretleyin. Gerekirse iade faturası kesin.");
        return keepOnCancel(async () => {
          const saved = await withStockForce(force => HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/cancel`, { method: "POST", body: { reason: data.reason, confirmExternal: data.confirmExternal === true, ...(doc.posCash ? { posOutcome: posOutcomeOf(data) } : {}), ...force } }), "cancel");
          HOF.toast(`${docTitle(doc)} iptal edildi; etkileri geri alındı.`, { type: "success" });
          for (const notice of saved.notices || []) HOF.toast(notice, { type: "info", timeout: 12000 });
          HOF.emit("invoices-changed", saved);
          showDoc(saved);
        });
      },
    });
  }
  // Çıkış yolu (kullanıcı kararı 16.10.2026): sonucu belirsiz gönderim ya da EDM portalındaki taslak, entegratöre ulaşılamıyorsa (bağlantı yok, test
  // hesabı kapandı) yalnız programda iptal edilir. Fatura Ayarları yetkisi + açık onay; sunucu işlem kaydına yazar.
  function localCancelForm(doc) {
    HOF.formModal({
      title: `${docTitle(doc)} Yalnız Programda İptal Edilsin mi?`,
      eyebrow: "İPTAL",
      intro: `Belge entegratöre sorulmadan yalnız programda iptal edilir; stok, cari, Kasa, çek/senet ve taksit etkileri geri alınır. Bunu yalnız entegratöre ulaşılamıyorsa (bağlantı yok, test hesabı kapandı) kullanın. Belge entegratörde duruyorsa orada ayrıca iptal edilmelidir.${doc.eMessage ? ` Son durum: ${doc.eMessage}` : ""}`,
      fields: [
        { name: "reason", label: "İptal Nedeni", maxlength: 300, placeholder: "ör. EDM test hesabı kapandı", autofocus: true },
        ...(doc.posCash ? [posOutcomeField()] : []),
        { name: "confirmLocal", label: "Belge entegratörde yok ya da entegratöre ulaşılamıyor; yalnız programda iptal edilsin.", type: "checkbox", value: false },
      ],
      submitLabel: "Yalnız Programda İptal Et",
      onSubmit: async data => {
        if (!data.confirmLocal) throw new Error("Onay kutusunu işaretleyin: belge entegratöre sorulmadan iptal edilecek.");
        return keepOnCancel(async () => {
          const saved = await withStockForce(force => HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/cancel`, { method: "POST", body: { reason: data.reason, localOnly: true, confirmLocal: true, ...(doc.posCash ? { posOutcome: posOutcomeOf(data) } : {}), ...force } }), "cancel");
          HOF.toast(`${docTitle(doc)} yalnız programda iptal edildi; etkileri geri alındı.`, { type: "success" });
          for (const notice of saved.notices || []) HOF.toast(notice, { type: "info", timeout: 12000 });
          HOF.emit("invoices-changed", saved);
          showDoc(saved);
        });
      },
    });
  }
  // PDF'i indirir (e-posta programına eklenir) ve cari kartındaki adrese hazır metinle e-posta penceresi açar.
  function sendEmail(doc, mail) {
    if (!mail) return HOF.toast("Cari kartında e-posta adresi yok; Cari ekranından ekleyin.", { type: "error" });
    const word = edoc() && doc.profile !== "KAGIT" ? kindLabel(doc.kind) : "Belgeniz";
    const due = doc.open > 0.004 && doc.dueDate ? ` Vade: ${HOF.formatDate(doc.dueDate)}.` : "";
    const subject = `${word} ${doc.displayNo || ""} · ${meta.settings.sellerName || ""}`.replace(/\s+/g, " ").trim();
    const text = `Sayın ${doc.accountName},\n\n${HOF.formatDate(doc.issueDate)} tarihli ${doc.displayNo} numaralı ${word.toLocaleLowerCase("tr-TR")}: ${curMoney(doc.payableTotal, doc.currency)}.${due}\nPDF ektedir.\n\n${meta.settings.sellerName || ""}`;
    downloadPdf(doc);
    window.location.href = `mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    HOF.toast("PDF indirildi; açılan e-posta penceresine ekleyip gönderin.", { type: "info", timeout: 6000 });
  }
  function downloadPdf(doc) {
    const a = document.createElement("a");
    a.href = `${pdfUrl(doc)}?download=1`;
    a.download = `${doc.displayNo || "Belge"}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function sendWhatsapp(doc, wa) {
    if (!wa) return;
    const due = doc.open > 0.004 && doc.dueDate ? ` Vade: ${HOF.formatDate(doc.dueDate)}.` : "";
    const word = edoc() && doc.profile !== "KAGIT" ? kindLabel(doc.kind).toLocaleLowerCase("tr-TR") : "belgeniz";
    const text = `Sayın ${doc.accountName}, ${HOF.formatDate(doc.issueDate)} tarihli ${doc.displayNo} numaralı ${word}: ${curMoney(doc.payableTotal, doc.currency)}.${due} PDF ektedir. ${meta.settings.sellerName || ""}`.replace(/\s+/g, " ").trim();
    downloadPdf(doc);
    window.open(HOF.whatsapp?.waUrl ? HOF.whatsapp.waUrl(wa, text) : `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "hof-whatsapp");
    HOF.toast("PDF indirildi; WhatsApp'ta sohbete ekleyip gönderin.", { type: "info", timeout: 6000 });
  }
  // Gönderilecekler'den bırakma metinleri (2.4.4 madde 22 ek, kâhin bulgusu): serbest meslek makbuzu kâğıt makbuz serisinden numara alır ("Kâğıt Makbuz
  // Olarak Bırak"), fatura türleri Müşteri Fişi serisinden ("Müşteri Fişi Olarak Bırak"). Sunucu seriyi türe göre seçer (paperSeriesOf).
  const paperOf = kind =>
    kind === "smm"
      ? // 2.4.4 (mali müşavir MM4): e-SMM kullanıcısı makbuzu e-SMM olarak düzenlemek zorundadır (509 sıra no.lu VUK Genel Tebliği IV.4.4–IV.4.6); kâğıt makbuz
        // yalnız V.7 hâllerinde (GİB, entegratör ya da kendi sistemindeki arıza, kesinti, bakım; mali mühür / e-imza arızası — ispatlanmak kaydıyla), matbu
        // makbuzla düzenlenir; "mükelleften kaynaklanan diğer nedenler" sayılmaz. Kâğıt makbuz düzenlenince aynı tahsilat için ikinci belge olmasın diye
        // bırakılan makbuz sonradan e-SMM olarak gönderilmez (alt karar, 22.10.2026; sunucu paperReceiptBlockOf).
        { button: "Kâğıt Makbuz Olarak Bırak", title: "Kâğıt Makbuz Olarak Bırakılsın mı?", kindText: "Kâğıt Makbuz (e-SMM olarak gönderilmedi)", hint: "Yalnız arıza ya da bakım hâlinde: e-SMM gönderilmez; makbuz kâğıt makbuz numarasıyla kalır; cari ve Kasa etkileri geri alınmaz", message: "e-SMM gönderilmez; makbuz kâğıt makbuz serisinden numara alır ve kâğıt makbuz olarak kalır. e-SMM kullanıcısı kâğıt makbuzu yalnız GİB'in, entegratörün ya da kendi sisteminin arızası, kesintisi veya bakımı ya da mali mühür (e-imza) arızası hâlinde, matbu makbuzla düzenleyebilir (509 sıra no.lu VUK Genel Tebliği IV.4.4–IV.4.6 ve V.7); bu hâller dışında makbuz e-SMM olarak düzenlenir. Bırakılan makbuz sonradan e-SMM olarak gönderilemez. Cari, Kasa, taksit ve çek/senet etkileri geri alınmaz (makbuzu geri almak için İptal Et kullanılır).", done: number => `Makbuz e-SMM olarak gönderilmedi; ${number} numaralı kâğıt makbuz olarak bırakıldı.` }
      : { button: "Müşteri Fişi Olarak Bırak", title: "Müşteri Fişi Olarak Bırakılsın mı?", kindText: "Müşteri Fişi (e-Belge olarak gönderilmedi)", hint: "e-Belge gönderilmez; belge fiş numarasıyla Müşteri Fişi olarak kalır; stok, cari ve Kasa etkileri geri alınmaz", message: "e-Belge gönderilmez; belge fiş numarasıyla Müşteri Fişi olarak kalır. Stok, cari, Kasa, taksit ve çek/senet etkileri geri alınmaz (satışı geri almak için İptal Et kullanılır). İsterseniz belgeyi sonra yine e-Belge olarak gönderebilirsiniz.", done: number => `Belge e-Belge olarak gönderilmedi; ${number} numaralı Müşteri Fişi olarak bırakıldı.` };
  // Gönderilecekler'den silme: etkiler yerinde kalır; belge Müşteri Fişi (makbuzda kâğıt makbuz) numarası alır. Müşteri Fişi sonra yine e-Belge olarak
  // gönderilebilir; kâğıt makbuz gönderilmez (MM4 alt kararı).
  async function withdrawDoc(doc) {
    // 2.4.3 (KÖ2, kullanıcı kararı 18.10.2026): "Listeden Sil" silme çağrıştırıyordu; belge silinmez, fiş numarasıyla Müşteri Fişi olarak kalır.
    // Varsayılan odak Vazgeç'te (etkiler geri alınmaz; A paketi UX4 güvenli odak kuralı).
    const paper = paperOf(doc.kind);
    const go = await HOF.confirm({ title: paper.title, message: paper.message, confirmLabel: paper.button, safeFocus: true });
    if (!go) return;
    try {
      const saved = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/withdraw`, { method: "POST", body: {} });
      HOF.toast(paper.done(saved.number), { type: "success" });
      HOF.emit("invoices-changed", saved);
      showDoc(saved);
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Toplu kesme (QA A6): seçili taslaklar tarih sırasıyla kesilir; her belge kendi işleminde, biri düşerse diğerleri
  // kesilir ve sonuç belge belge bildirilir. e-Belge gönderimi entegratör ayarına (otomatik gönderim) göre yapılır.
  async function bulkIssue() {
    const docs = selectedBy("draft");
    if (!docs.length) return;
    const total = docs.reduce((sum, doc) => sum + (Number(doc.tryPayable) || 0), 0);
    const go = await HOF.confirm({
      title: `${docs.length.toLocaleString("tr-TR")} Taslak Kesilsin mi?`,
      message: `Seçili taslaklar tarih sırasıyla kaydedilir (toplam ${money(total)}). Her belgede stok, cari, Kasa, çek/senet ve taksit kayıtları birlikte yazılır. Stoku eksiye düşüren ya da kilitli dönemdeki taslak kaydedilmez, nedeni bildirilir.${edoc() ? (meta?.settings?.integrator?.autoSend ? " e-Belge olanlar kaydedilir kaydedilmez entegratöre gönderilir." : " e-Belge olanlar Gönderilecekler'de bekler; e-Belge numarası entegratöre gönderilirken verilir (Entegratör Ayarları'nda hemen gönderim açılabilir).") : ""}`,
      confirmLabel: "Seçilenleri Kaydet",
    });
    if (!go) return;
    try {
      const result = await HOF.api("/api/workspace/invoices/bulk-issue", { method: "POST", body: { ids: docs.map(doc => doc.id) } });
      bulkOutcome(result, "kaydedildi", "kaydedilemedi");
      // Dar kontrol 2.4.3: entegratör girişi reddedildi / EDM'ye ulaşılamadı — belgeler numarasız Gönderilecekler'de (tek ileti).
      if (result.notice) HOF.toast(result.notice, { type: "error", timeout: 12000 });
    } catch (error) {
      HOF.toastError(error);
    }
    HOF.emit("invoices-changed", {});
    loadList();
  }
  // v2.0.17 (müşteri): Sil — taslak, kaydedilmiş (etkiler iptaldeki gibi tek işlemde geri alınır) ve iptal edilmiş belge
  // Silinenler'e gider; Yönetim → Silinenler'den geri yüklenirse etkisiz, "İptal Edildi" olarak döner.
  const deleteIntro = (status, count = 1) =>
    status === "draft"
      ? `${count > 1 ? "Taslaklar" : "Taslak"} deftere işlenmemişti; Silinenler'e gider, oradan geri alınabilir.`
      : status === "cancelled"
        ? "Belge zaten iptal edilmişti (etkisiz); listeden kalkar, Silinenler'e gider."
        : "Bütün etkileri birlikte geri alınır (stok, cari borç/alacak, peşin tahsilat/ödeme ve Kasa, çek/senet, taksit kartı); belge Silinenler'e gider, geri yüklenirse “İptal Edildi” olarak etkisiz döner. Serinin son numarasıysa sayaç geri alınır; aradaysa numarada boşluk kalır.";
  function deleteForm(doc) {
    HOF.formModal({
      title: `${docTitle(doc)} Silinsin mi?`,
      eyebrow: "SİL",
      intro: `${deleteIntro(doc.status)} Tutar ${money(doc.tryPayable)}.`,
      fields: doc.status === "issued" ? [{ name: "reason", label: "Silme Nedeni", maxlength: 300, placeholder: "ör. Yanlış cariye kaydedildi", autofocus: true }, ...(doc.posCash ? [posOutcomeField()] : [])] : [],
      submitLabel: "Sil",
      onSubmit: async data => {
        const query = new URLSearchParams({ reason: data.reason || "", ...(doc.status === "issued" && doc.posCash ? { posOutcome: posOutcomeOf(data) } : {}) });
        return keepOnCancel(async () => {
          await withStockForce(force => HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}?${query}${force.force ? "&force=1" : ""}${force.negativeOk ? "&negativeOk=1" : ""}`, { method: "DELETE" }), "delete");
          HOF.toast(`${docTitle(doc)} silindi; Silinenler'den geri alınabilir.`, { type: "success" });
          HOF.emit("invoices-changed", null);
          HOF.emit("accounts-changed");
          HOF.emit("cash-changed");
          showList();
        });
      },
    });
  }
  async function bulkDelete() {
    const docs = (view.list?.invoices || []).filter(doc => view.selected.has(doc.id));
    if (!docs.length) return;
    const total = docs.reduce((sum, doc) => sum + (isReturn(doc.kind) ? -1 : 1) * (Number(doc.tryPayable) || 0), 0);
    const counts = { draft: docs.filter(doc => doc.status === "draft").length, issued: docs.filter(doc => doc.status === "issued").length, cancelled: docs.filter(doc => doc.status === "cancelled").length };
    const posCount = docs.filter(doc => doc.status === "issued" && doc.posCash).length;
    HOF.formModal({
      title: `${docs.length.toLocaleString("tr-TR")} Belge Silinsin mi?`,
      eyebrow: "TOPLU SİL",
      intro: `${[counts.issued ? `${counts.issued} kaydedilmiş` : "", counts.cancelled ? `${counts.cancelled} iptal edilmiş` : "", counts.draft ? `${counts.draft} taslak` : ""].filter(Boolean).join(", ")} · toplam ${money(Math.abs(total))}. ${deleteIntro("issued")} İade belgeleri önce silinir. İadesi olan, e-Belgesi gönderilmiş, kilitli dönemdeki ya da taksitinden tahsilat alınmış belge silinmez; nedeni belge belge bildirilir.`,
      fields: counts.issued ? [{ name: "reason", label: "Silme Nedeni", maxlength: 300, placeholder: "ör. Deneme kayıtları", autofocus: true }, ...(posCount ? [posOutcomeField(posCount)] : [])] : [],
      submitLabel: `Seçilenleri Sil (${docs.length})`,
      onSubmit: async data => {
        const result = await bulkWithNegative("/api/workspace/invoices/bulk-delete", { ids: docs.map(doc => doc.id), reason: data.reason, force: true, ...(posCount ? { posOutcome: posOutcomeOf(data) } : {}) }, "delete");
        bulkOutcome(result, "silindi (Silinenler'den geri alınabilir)", "silinemedi");
        HOF.emit("invoices-changed", {});
        HOF.emit("accounts-changed");
        HOF.emit("cash-changed");
        loadList();
      },
    });
  }
  async function bulkCancel() {
    const docs = selectedBy("issued");
    if (!docs.length) return;
    const posCount = docs.filter(doc => doc.posCash).length;
    HOF.formModal({
      title: `${docs.length.toLocaleString("tr-TR")} Belge İptal Edilsin mi?`,
      eyebrow: "TOPLU İPTAL",
      intro: "Her belgenin bütün etkileri birlikte geri alınır: stok, cari borç/alacak, peşin tahsilat/ödeme (Kasa), çek/senet ve taksit kartı. Numaralar korunur. İadesi olan, kilitli dönemdeki ya da çeki tahsil edilmiş belge iptal edilmez; nedeni bildirilir.",
      fields: [{ name: "reason", label: "İptal Nedeni", maxlength: 300, placeholder: "ör. Yanlış cariye kaydedildi", autofocus: true }, ...(posCount ? [posOutcomeField(posCount)] : [])],
      submitLabel: "Seçilenleri İptal Et",
      onSubmit: async data => {
        const result = await bulkWithNegative("/api/workspace/invoices/bulk-cancel", { ids: docs.map(doc => doc.id), reason: data.reason, ...(posCount ? { posOutcome: posOutcomeOf(data) } : {}) }, "cancel");
        bulkOutcome(result, "iptal edildi", "iptal edilemedi");
        // K4: iptal edilen belgeye bağlı şüpheli cari tahsilatı artık şüpheliden düşüyor; belge numarasıyla söylenir.
        for (const item of (result.results || []).filter(item => item.ok && item.notices?.length)) HOF.toast(`${item.displayNo || item.number}: ${item.notices.join(" ")}`, { type: "info", timeout: 12000 });
        HOF.emit("invoices-changed", {});
        loadList();
      },
    });
  }
  // Yargıç K3: toplu iptal/silmede Uyar'daki banka hesabını eksiye düşüren belgeler (409 cash-negative + accountId) için TEK soru; onaylanırsa yalnız o
  // belgeler negativeOk ile yeniden gönderilir. Engelle'deki (cash-blocked) belge sorulmaz, nedeniyle "yapılamadı" listelenir.
  async function bulkWithNegative(url, body, verb) {
    const result = await HOF.api(url, { method: "POST", body });
    // Hakem K5: banka hesabının reddi cash-negative + accountId (Kasa'nınki accountId'siz; toplu işlemde Kasa sorulmaz, "yapılamadı" listelenir).
    const risky = (result.results || []).filter(item => !item.ok && item.code === "cash-negative" && item.accountId);
    if (!risky.length) return result;
    const [yes, no, word] = verb === "cancel" ? ["Yine de İptal Et", "İptal edilmedi", "iptal edilsin"] : ["Yine de Sil", "Silinmedi", "silinsin"];
    const go = await HOF.confirm({ title: "Eksi Bakiye", message: `Seçilenlerden ${risky.length.toLocaleString("tr-TR")} belge banka hesabını eksiye düşürüyor (${risky[0].number || risky[0].displayNo || ""}: ${String(risky[0].message || "").replace(/\s*Yine de kaydedilsin mi\?\s*$/, "")}). Bu belgeler yine de ${word} mi?`, confirmLabel: yes, cancelLabel: "Vazgeç", danger: true });
    if (!go) {
      HOF.toast(`${no}: ${risky.length.toLocaleString("tr-TR")} belge banka hesabını eksiye düşürecekti.`, { type: "info" });
      return result;
    }
    const again = await HOF.api(url, { method: "POST", body: { ...body, ids: risky.map(item => item.id), negativeOk: true } });
    const byId = new Map((again.results || []).map(item => [item.id, item]));
    return { ...result, results: (result.results || []).map(item => byId.get(item.id) || item) };
  }
  function bulkOutcome(result, doneWord, failWord) {
    const failed = (result.results || []).filter(item => !item.ok);
    const done = (result.results || []).length - failed.length;
    // Başarısızlar seçili kalır (kullanıcı tek tek bakar); başarılılar seçimden düşer.
    view.selected = new Set(failed.map(item => item.id));
    const detail = failed.slice(0, 3).map(item => `${item.number || item.displayNo || item.accountName || item.id}: ${item.message}`).join(" · ");
    HOF.toast(`${done.toLocaleString("tr-TR")} belge ${doneWord}${failed.length ? `; ${failed.length.toLocaleString("tr-TR")} belge ${failWord}: ${detail}${failed.length > 3 ? " …" : ""}` : "."}`, { type: failed.length ? "error" : "success", timeout: failed.length ? 12000 : 5000 });
  }
  // Gözden geçirme 2.4.3 (S2): Gönderilecekler'in tamamı (sayfadaki ≤200 satır değil); sunucunun verdiği toplam, yoksa listedeki sayı.
  function pendingTotal(data) {
    return typeof data?.pendingTotal === "number" ? data.pendingTotal : data?.invoices?.length || 0;
  }
  // Dar kontrol 2.4.3 (Y1): gönderim sürerken düğme ilerlemeyi gösterir ve basılamaz (ikinci tur açılmaz); liste yeniden çizilse de durum korunur.
  // 2.4.4 (E6): Tümünü Gönder ve Seçilenleri Gönder aynı ilerlemeyi (view.sendProgress) paylaşır — biri sürerken öbürü de basılamaz; ilerleme
  // basılan düğmede görünür.
  function sendPendingButton(data) {
    const progress = view.sendProgress;
    if (progress && progress.mode !== "only") return `<button type="button" class="hof-button hof-button-small" data-act="send-pending" disabled aria-busy="true" data-send-progress>Gönderiliyor: ${progress.done.toLocaleString("tr-TR")} / ${progress.total.toLocaleString("tr-TR")}</button>`;
    return `<button type="button" class="hof-button hof-button-small" data-act="send-pending"${progress ? " disabled" : ""} title="Gönderilecekler'in tamamı eski tarihliden başlayarak entegratöre gönderilir; numara gönderimde verilir">Tümünü Gönder (${pendingTotal(data).toLocaleString("tr-TR")})</button>`;
  }
  // 2.4.4 (E6, müşteri isteği "seçilenlerden gönderilebilir (Gönderilecekler) olanların sayısıyla"): seçimde Gönderilecekler'de olan belgeler —
  // sunucunun kuralı (unsentSql): numarasız bekleyen ya da numaralı gitmemiş kendi e-Belgemiz. Kâğıt, gönderilmiş, iptal, taslak ve Müşteri Fişi
  // olarak bırakılan sayılmaz. Kalıcı engelli bekleyen (eBlocked: seride daha yeni numara / alıcı e-Fatura mükellefi) gönderilemez: sayıya girmez,
  // gönderilmez, onay penceresinde ayrıca söylenir. Seçimde bekleyen var ama hepsi kalıcı engelliyse düğme pasif ve nedeni yanında yazılı.
  const selectedWaiting = () => (view.list?.invoices || []).filter(doc => view.selected.has(doc.id) && doc.status === "issued" && (doc.eStatus === "waiting" || doc.eUnsent));
  const selectedPending = () => selectedWaiting().filter(doc => !doc.eBlocked);
  const selectedBlocked = () => selectedWaiting().filter(doc => doc.eBlocked);
  function sendSelectedButton() {
    if (!edoc() || !canManage()) return "";
    const progress = view.sendProgress;
    if (progress?.mode === "only") return `<button type="button" class="hof-button hof-button-small" data-act="send-selected" disabled aria-busy="true" data-send-progress>Gönderiliyor: ${progress.done.toLocaleString("tr-TR")} / ${progress.total.toLocaleString("tr-TR")}</button>`;
    if (!selectedWaiting().length) return "";
    const count = selectedPending().length;
    if (!count) return `<button type="button" class="hof-button hof-button-small" data-act="send-selected" disabled>Seçilenleri Gönder (0)</button><small class="hof-inv-warn" data-send-selected-why>Seçilen bekleyen belgeler kalıcı engelli; e-Belge olarak gönderilemez (nedeni belgenin kartında).</small>`;
    return `<button type="button" class="hof-button hof-button-small" data-act="send-selected"${progress ? " disabled" : ""} title="Seçilen belgeler eski tarihliden başlayarak entegratöre gönderilir; numara gönderimde verilir">Seçilenleri Gönder (${count.toLocaleString("tr-TR")})</button>`;
  }
  function showSendProgress() {
    if (!view.sendProgress) return;
    for (const other of body()?.querySelectorAll('[data-act="send-pending"], [data-act="send-selected"]') || []) other.disabled = true;
    const button = body()?.querySelector(`[data-act="${view.sendProgress.mode === "only" ? "send-selected" : "send-pending"}"]`);
    if (!button) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.dataset.sendProgress = "";
    button.textContent = `Gönderiliyor: ${view.sendProgress.done.toLocaleString("tr-TR")} / ${view.sendProgress.total.toLocaleString("tr-TR")}`;
  }
  // İstek başına zaman aşımı: sunucu bir istekte en çok 20 belge ya da ~10 sn işler; tek belgenin entegratör çağrıları (giriş, mükellef sorgusu,
  // gönderim) en kötü durumda bunu uzatabilir. Varsayılan 30 sn yetmez.
  const SEND_PENDING_TIMEOUT_MS = 150000;
  const SEND_PENDING_URL = "/api/workspace/invoices/send-pending";
  async function sendPending() {
    if (view.sendProgress) return;
    const total = pendingTotal(view.list);
    if (!total) return;
    const go = await HOF.confirm({ title: "Gönderilecekler Gönderilsin mi?", message: `Gönderilecekler'deki ${total.toLocaleString("tr-TR")} belge tarih sırasıyla (eski tarihli önce) entegratöre gönderilecek. Numarası olmayanlara e-Belge numarası gönderim sırasında verilir; sonucu belirsiz olanlar önce entegratöre sorulur, orada varsa yeniden gönderilmez.`, confirmLabel: "Tümünü Gönder" });
    if (!go || view.sendProgress) return;
    await runSend({ all: true }, total, "all");
  }
  // 2.4.4 (E6): seçilmemiş daha eski tarihli bekleyenler varken seçilen yeni belge numara alırsa eski belgeler e-Belge olarak hiç gönderilemez (GİB
  // sıra kuralı). Sunucunun ön denetimi (check / 409 einvoice-selection-older) gönderimden ÖNCE bunu söyler; seçenekler: onları da ekle ya da vazgeç
  // (sessiz atlama ya da yarım tur yok).
  const olderQuestion = (info, selectedCount) => {
    const shown = (info.older || []).slice(0, 3).map(item => `${item.accountName || "cari"} ${HOF.formatDate(item.issueDate)}`).join(", ");
    const count = Number(info.count) || 0;
    return HOF.confirm({
      title: "Önce Daha Eski Tarihli Belgeler Gönderilmeli",
      message: `Seçilen ${selectedCount.toLocaleString("tr-TR")} belgeyle aynı seride, seçilmemiş ve daha eski tarihli ${count.toLocaleString("tr-TR")} belge Gönderilecekler'de bekliyor (${shown}${count > 3 ? " …" : ""}). e-Belge numarası tarih sırasıyla verilir: seçilenler önce numara alırsa bu belgeler e-Belge olarak gönderilemez. Onları da ekleyip eski tarihliden başlayarak birlikte gönderelim mi?`,
      confirmLabel: "Onları da Ekle ve Gönder",
      cancelLabel: "Vazgeç",
      // 31f: onay kapsamı genişletir (seçilmemiş belgeler de numara alıp gider) — Enter'a basan yanlışlıkla göndermesin; odak Vazgeç'te (hiçbir şey gönderilmez).
      safeFocus: true,
    });
  };
  async function sendSelected() {
    if (view.sendProgress) return;
    const docs = selectedPending();
    if (!docs.length) return;
    const blocked = selectedBlocked().map(doc => doc.id);
    const chosen = docs.map(doc => doc.id);
    let check;
    try {
      check = await HOF.api(SEND_PENDING_URL, { method: "POST", body: { only: chosen, check: true } });
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    if (view.sendProgress) return;
    let only = chosen;
    let total = Number(check.sendable) || 0;
    if (check.count) {
      if (!(await olderQuestion(check, docs.length)) || view.sendProgress) {
        HOF.toast(`Gönderilmedi: seçilmemiş daha eski tarihli ${Number(check.count).toLocaleString("tr-TR")} belge önce gönderilmeli. Hiçbir belgeye numara verilmedi.`, { type: "info", timeout: 8000 });
        return;
      }
      only = [...chosen, ...check.olderIds];
      total += Number(check.count) || 0;
    } else {
      if (!total) {
        HOF.toast("Seçilenlerden gönderilebilecek belge yok: belgeler artık Gönderilecekler'de değil ya da kalıcı engelli (nedeni belgenin kartında).", { type: "info", timeout: 8000 });
        loadList();
        return;
      }
      const go = await HOF.confirm({ title: `${total.toLocaleString("tr-TR")} Belge Gönderilsin mi?`, message: `Seçilen ${total.toLocaleString("tr-TR")} belge tarih sırasıyla (eski tarihli önce) entegratöre gönderilecek. Numarası olmayanlara e-Belge numarası gönderim sırasında verilir; sonucu belirsiz olanlar önce entegratöre sorulur, orada varsa yeniden gönderilmez.${blocked.length + (Number(check.permanent) || 0) ? ` ${(blocked.length + (Number(check.permanent) || 0)).toLocaleString("tr-TR")} seçili belge kalıcı engelli olduğu için gönderilmez.` : ""}`, confirmLabel: "Seçilenleri Gönder" });
      if (!go || view.sendProgress) return;
    }
    // Ön denetimle gönderim arasında başka oturum daha eski tarihli belge kaydettiyse sunucu ilk istekte yine sorar (409); soru yinelenir.
    for (let ask = 0; ; ask += 1) {
      const older = await runSend({ only }, total, "only", blocked);
      if (!older) return;
      if (ask >= 2) {
        HOF.toast(`Gönderilmedi: gönderim hazırlanırken daha eski tarihli belgeler kaydedilmeye devam ediyor (${Number(older.count).toLocaleString("tr-TR")} belge). Hiçbir belgeye numara verilmedi; biraz sonra yeniden deneyin ya da Tümünü Gönder'i kullanın.`, { type: "info", timeout: 10000 });
        return;
      }
      if (!(await olderQuestion(older, only.length)) || view.sendProgress) {
        HOF.toast(`Gönderilmedi: seçilmemiş daha eski tarihli ${Number(older.count).toLocaleString("tr-TR")} belge önce gönderilmeli. Hiçbir belgeye numara verilmedi.`, { type: "info", timeout: 8000 });
        return;
      }
      only = [...only, ...(older.olderIds || [])];
      total += Number(older.count) || 0;
    }
  }
  // Tümünü Gönder ({ all: true }) ve Seçilenleri Gönder ({ only }) için ortak tur: sunucu bir istekte en çok 20 belge (ya da ~10 sn) gönderir, kalan
  // varsa istemci yineler. Dar kontrol 2 (B1): tur bir imleçle ilerler — sunucunun döndürdüğü imleç (ulaşılan son belge) sonraki isteğe verilir; bir
  // turda her belge en çok bir kez denenir. Döngü "gönderilen > 0" ile değil, imleç ilerledikçe ve kalan oldukça sürer (önceden kuyruğun başında
  // reddedilen belgeler varken ilk istek 0 gönderip döngüyü bitiriyordu). Dönüş: Seçilenleri Gönder'in ilk isteği 409 einvoice-selection-older ile
  // döndüyse (hiçbir belge gönderilmeden) sunucunun eski belge bilgisi; değilse boş.
  async function runSend(base, total, mode, keep = []) {
    const again = mode === "only" ? "Seçilenleri Gönder" : "Tümünü Gönder";
    const listed = new Set((view.list?.invoices || []).map(doc => doc.id));
    const tab = view.tab;
    const results = [];
    const seen = new Set();
    let sent = 0;
    let remaining = 0;
    let stopped = null;
    let cursor = null;
    let rerun = false;
    view.sendProgress = { done: 0, total, mode };
    showSendProgress();
    try {
      for (let turn = 0; turn < 100000; turn += 1) {
        const timeoutMs = Number(HOF.invoices?.sendPendingTimeoutMs) > 0 ? Number(HOF.invoices.sendPendingTimeoutMs) : SEND_PENDING_TIMEOUT_MS;
        let result;
        try {
          result = await HOF.api(SEND_PENDING_URL, { method: "POST", body: cursor ? { ...base, after: cursor } : base, timeoutMs });
        } catch (error) {
          if (mode === "only" && !cursor && error?.data?.code === "einvoice-selection-older") {
            view.sendProgress = null;
            if (view.mode === "list") renderList();
            return error.data;
          }
          throw error;
        }
        sent += result.sent;
        remaining = result.remaining || 0;
        stopped = result.stopped || null;
        // Dar kontrol 3 (B-2): tur sürerken imleçten önce sıralanan (daha eski) belge kaydedildi — bu turda denenmedi; yeni basış en eskiden başlar.
        rerun = rerun || Boolean(result.rerun);
        const moved = Boolean(result.cursor) && JSON.stringify(result.cursor) !== JSON.stringify(cursor);
        cursor = result.cursor || cursor;
        // Kalıcı engelli belgeler her istekte yeniden listelenir; bir kez sayılır.
        for (const item of result.results) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          results.push(item);
        }
        view.sendProgress = { done: Math.min(total, seen.size), total: Math.max(total, seen.size), mode };
        showSendProgress();
        if (stopped || !remaining || !moved) break;
      }
    } catch (error) {
      view.sendProgress = null;
      // Y1: zaman aşımı hata değildir — sunucu gönderimi sürdürüyor olabilir; liste yenilenir, sonuç oradan okunur.
      if (error?.data?.code === "client-timeout") HOF.toast(`${sent ? `${sent.toLocaleString("tr-TR")} belge gönderildi; ` : ""}gönderim sunucuda sürüyor olabilir. Liste yenilendi; bir süre sonra Gönderilecekler'e bakın, kalan belge olursa ${again}'e yeniden basın.`, { type: "info", timeout: 15000 });
      else HOF.toastError(error);
      loadList();
      return null;
    }
    view.sendProgress = null;
    // 2.4.3 (keşif B1): gönderilemeyen ilk belgenin nedeni ve sırasını korumak için bekletilenlerin sayısı ayrı yazılır. Gözden geçirme (S3): başka
    // oturumda gönderilen belgeler "gönderilemedi" sayılmaz; doğru nedeni söylenir. Dar kontrol (D2, O2, bilgi): başka oturumda gönderilmiş, tur
    // sürerken listeden silinmiş ve bağlantı kesildiği için numara verilmeden bekleyen belgeler ayrı sayılır. E6: seçimde olup artık
    // Gönderilecekler'de olmayan belgeler (not-pending) ayrı sayılır.
    const busy = results.filter(item => item.busy || (item.skipped && item.reason === "busy"));
    const done = results.filter(item => item.done);
    const withdrawn = results.filter(item => item.skipped && item.reason === "withdrawn");
    const notPending = results.filter(item => item.skipped && item.reason === "not-pending");
    const waitingStop = results.filter(item => item.skipped && item.reason === "stopped");
    const failed = results.filter(item => !item.ok && !item.skipped && !item.busy && !item.done);
    const held = results.filter(item => item.skipped && !["busy", "withdrawn", "stopped", "not-pending"].includes(item.reason));
    const parts = [`${sent.toLocaleString("tr-TR")} belge gönderildi`];
    // B1: gönderilemeyenler nedenleriyle (aynı nedenden kaç belge; en çok üç neden, kalanı belgelerin kartında).
    if (failed.length) {
      const reasons = new Map();
      for (const item of failed) {
        const key = item.code || item.message || "";
        if (!reasons.has(key)) reasons.set(key, { count: 0, message: item.message || "Gönderilemedi." });
        reasons.get(key).count += 1;
      }
      const shown = [...reasons.values()].slice(0, 3).map(reason => (reasons.size > 1 ? `${reason.count.toLocaleString("tr-TR")} belge: ${reason.message}` : reason.message));
      const more = reasons.size > 3 ? ` (${(reasons.size - 3).toLocaleString("tr-TR")} başka neden; ayrıntı belgelerin kartında)` : "";
      parts.push(`${failed.length.toLocaleString("tr-TR")} belge gönderilemedi: ${shown.join(" ")}${more}`);
    }
    // 2.4.3 (uzman UX14): durma nedeni gönderilemeyen belgenin nedeniyle aynıysa ("EDM'ye bağlanılamadı… ; EDM'ye ulaşılamadı…") bir kez yazılır.
    if (stopped) parts.push(failed.length && failed.every(item => item.code === stopped.code) ? "Kalan belgelere numara verilmedi; Gönderilecekler'de bekliyor" : `${stopped.message} Kalan belgelere numara verilmedi; Gönderilecekler'de bekliyor`);
    if (done.length) parts.push(`${done.length.toLocaleString("tr-TR")} belge başka oturumda gönderildi`);
    if (busy.length) parts.push(`${busy.length.toLocaleString("tr-TR")} belge başka oturumda gönderiliyor; gönderim bitince listeyi yenileyin`);
    if (withdrawn.length) parts.push(`${withdrawn.length.toLocaleString("tr-TR")} belge gönderim sırasında Müşteri Fişi olarak bırakıldı (gönderilmedi)`);
    if (notPending.length) parts.push(`${notPending.length.toLocaleString("tr-TR")} seçili belge artık Gönderilecekler'de değil (başka oturumda gönderilmiş, iptal edilmiş ya da Müşteri Fişi olarak bırakılmış olabilir)`);
    if (held.length) parts.push(`${held.length.toLocaleString("tr-TR")} belge sırasını korumak için bekletildi (önce eski tarihli belge gönderilmeli)`);
    if (rerun && !stopped) parts.push(`gönderim sürerken daha eski tarihli belge kaydedildi; o belge ve sonrakiler için ${again}'e yeniden basın`);
    if (remaining && !stopped) parts.push(`${remaining.toLocaleString("tr-TR")} belge daha bekliyor; ${again}'e yeniden basın`);
    const bad = failed.length || held.length || busy.length || remaining || stopped || waitingStop.length;
    HOF.toast(`${parts.join("; ")}.`, { type: failed.length || held.length || stopped ? "error" : busy.length || remaining || withdrawn.length || notPending.length ? "info" : "success", timeout: bad ? 15000 : 6000 });
    // Seçilenleri Gönder: gönderilemeyenler (listede görünenler) seçili kalır, gidenler seçimden düşer (toplu işlemlerin kuralı, bulkOutcome). Gönderim
    // sürerken sekme değiştiyse (seçim zaten temizlendi) yeni sekmede görünmeyen belgeler seçilmez.
    // Gönderilmeyen kalıcı engelli seçili belgeler (keep) de seçili kalır.
    if (mode === "only" && view.tab === tab) view.selected = new Set([...results.filter(item => !item.ok && listed.has(item.id) && item.reason !== "not-pending").map(item => item.id), ...keep.filter(id => listed.has(id))]);
    loadList();
    return null;
  }
  // Portala taslak (İz 7.3, Entegratör Ayarları → Ek Seçenekler): ayar açıksa ilk düğme "Portala Taslak Yükle"; taslaktaki belge "Taslağı Gönder"
  // (önce son hâl yüklenir) ve "Taslağı Yenile" ile yönetilir. Taslaktan sonra belge düzenlendiyse uyarı görünür.
  function sendButtons(doc) {
    if (doc.eStatus === "draft") {
      return `${doc.canSend ? '<button type="button" class="hof-button hof-button-small" data-act="e-send" title="Önce belgenin son hâli EDM\'ye yüklenir, sonra gönderilir">Taslağı Gönder</button>' : ""}${doc.canDraft ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="e-draft">Taslağı Yenile</button>' : ""}${doc.draftStale ? '<small class="hof-inv-warn" data-draft-stale>Taslak yüklendikten sonra belge değişti; EDM portalındaki taslak eski. Taslağı Yenile ile güncelleyin.</small>' : ""}`;
    }
    if (doc.canDraft) return '<button type="button" class="hof-button hof-button-small" data-act="e-draft" title="Belge gönderilmez; EDM portalında taslak olarak bekler">Portala Taslak Yükle</button>';
    return doc.canSend ? '<button type="button" class="hof-button hof-button-small" data-act="e-send">e-Belge Gönder</button>' : "";
  }
  async function eAction(doc, action) {
    try {
      const saved = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/${action}`, { method: "POST", body: {} });
      const result = saved.sendResult || saved.statusResult;
      HOF.toast(result?.hint || result?.message || "e-Belge işlendi.", { type: saved.eStatus === "error" || saved.eStatus === "rejected" ? "error" : "success", timeout: 8000 });
      showDoc(saved);
    } catch (error) {
      HOF.toastError(error);
      loadDoc(doc.id);
    }
  }

  // ---------- Fatura Ayarları ----------
  const SERIES_LABELS = { paper: "Belge Serisi (Fiş ve Kâğıt Belge)", smm: "Serbest Meslek Makbuzu Serisi", internal: "İç İade Serisi", efatura: "e-Fatura Serisi", earsiv: "e-Arşiv Serisi", esmm: "e-SMM Serisi" };
  // Fatura Ayarları'nda Entegratör Ayarları'ndaki işarete bağlı metin (2.4.4 madde 30c G2): Entegratör Ayarları kaydedilince açık Fatura Ayarları
  // formu yeniden çizilmeden (kaydedilmemiş alanlar kaybolmasın) yalnız bu metin yenilenir.
  const stampEsmmText = s => (s?.edocEnabled && s.esmm === true ? " Logo ve kaşe e-SMM'de yalnız programın PDF'ine basılır; resmî görüntüyü EDM çizer." : "");
  function syncSettingsFlags(saved) {
    if (!view.settings || !saved) return;
    for (const key of ["efatura", "earsiv", "esmm", "integrator"]) if (saved[key] !== undefined) view.settings[key] = saved[key];
    if (view.mode !== "settings") return;
    const node = body()?.querySelector("[data-stamp-esmm-note]");
    if (node) node.textContent = stampEsmmText(view.settings);
  }
  async function showSettings() {
    view.logo = undefined;
    view.stamp = undefined;
    if (!canSettings()) return HOF.toast("Fatura ayarları yönetici ve muhasebe yetkisindedir.", { type: "error" });
    try {
      view.settings = await HOF.api("/api/workspace/invoices/settings");
    } catch (error) {
      return HOF.toastError(error);
    }
    setMode("settings");
    renderSettings();
  }
  function renderSettings() {
    const root = body();
    const s = view.settings;
    if (!root || !s) return;
    const seller = s.seller;
    const input = (key, label, value, extra = "") => `<label class="hof-field"><span>${label}</span><input data-s="${key}" value="${esc(value ?? "")}" ${extra}></label>`;
    const banks = [...(seller.banks || []), {}, {}, {}, {}].slice(0, 4);
    // 2.3.0 (İz 3.4; plan §8.9 E2.16 / #31): Banka modülünde hesap açıldıktan sonra liste hesap kartından (IBAN Faturada Gösterilsin) gelir.
    const bankState = s.bankAccounts && typeof s.bankAccounts === "object" ? { active: s.bankAccounts.active === true, accounts: s.bankAccounts.accounts || [], suggestions: s.bankAccounts.suggestions || [] } : { active: false, accounts: [], suggestions: [] };
    const ibanText = iban => String(iban || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
    const series = Object.entries(s.nextNumbers || {});
    const integ = s.integrator || {};
    const problems = s.problems?.KAGIT || [];
    HOF.swap(
      root,
      `<div class="hof-plan-head"><div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" data-esc-back title="Listeye dön (Esc)">← Liste</button>
        <div class="hof-plan-title"><h3>Fatura Ayarları</h3><small>Belgenin üstünde yazan firma bilgisi, numara serileri ve varsayılanlar. Değişiklik bundan sonra kaydedilen belgelere uygulanır.</small></div></div></div>
      ${problems.length ? `<ul class="hof-inv-problems">${problems.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
      <section class="hof-inv-settings"><h4>Firma Bilgisi</h4><div class="hof-inv-head">
        ${input("seller.name", "Unvan / Ad Soyad", seller.name, 'maxlength="200"')}
        <label class="hof-field"><span>Tabela Adı</span><input data-s="reportHeader.signName" value="${esc(s.reportHeader?.signName || "")}" maxlength="120" placeholder="ör. Yıldız Market"><small>Rapor ve ekstre başlığında unvan yerine yazılır. Fatura ve makbuzda unvan değişmez.</small></label>
        <label class="hof-field"><span>Rapor ve Ekstre Başlığı</span><select data-s="reportHeader.mode"><option value="sign" ${s.reportHeader?.mode !== "full" ? "selected" : ""}>Yalnız Tabela Adı</option><option value="full" ${s.reportHeader?.mode === "full" ? "selected" : ""}>Tabela Adı ve Firma Bilgileri</option></select><small>Firma bilgileri: unvan, VKN / TCKN, vergi dairesi ve adres. Tabela Adı boşsa başlıkta unvan yazar.</small></label>
        <label class="hof-field"><span>Kişi Türü</span><select data-s="seller.partyKind"><option value="company" ${seller.partyKind !== "person" ? "selected" : ""}>Tüzel Kişi (Şirket)</option><option value="person" ${seller.partyKind === "person" ? "selected" : ""}>Gerçek Kişi (Şahıs)</option></select></label>
        ${input("seller.firstName", "Adı (Gerçek Kişi)", seller.firstName, 'maxlength="80"')}
        ${input("seller.familyName", "Soyadı (Gerçek Kişi)", seller.familyName, 'maxlength="80"')}
        ${input("seller.taxNo", "VKN / TCKN", seller.taxNo, 'maxlength="11" inputmode="numeric"')}
        ${input("seller.taxOffice", "Vergi Dairesi", seller.taxOffice, 'maxlength="120"')}
        ${input("seller.mersisNo", "MERSİS No", seller.mersisNo, 'maxlength="16" inputmode="numeric"')}
        ${input("seller.tradeRegistry", "Ticaret Sicil No", seller.tradeRegistry, 'maxlength="40"')}
        ${input("seller.address", "Adres", seller.address, 'maxlength="500"')}
        ${input("seller.district", "İlçe", seller.district, 'maxlength="80"')}
        ${input("seller.city", "İl", seller.city, 'maxlength="80"')}
        ${input("seller.postalCode", "Posta Kodu", seller.postalCode, 'maxlength="10"')}
        ${input("seller.country", "Ülke", seller.country || "Türkiye", 'maxlength="80"')}
        ${input("seller.phone", "Telefon", seller.phone, 'maxlength="60"')}
        ${input("seller.email", "E-Posta", seller.email, 'maxlength="160" type="email"')}
        ${input("seller.website", "Web Sitesi", seller.website, 'maxlength="200"')}
        <div class="hof-field hof-inv-wide hof-inv-logo"><span>Logo (PDF'te Sol Üstte, e-Belgede Ortada)</span>
          <div class="hof-inv-logo-row"><div class="hof-inv-logo-box" data-logo-preview>${imageBoxHtml("logo")}</div>
          <div class="hof-inv-logo-tools"><label class="hof-button hof-button-small hof-button-ghost">Logo Seç<input type="file" accept="image/*" data-logo-file hidden></label><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="logo-clear" ${logoNow() ? "" : "hidden"}>Logoyu Kaldır</button><small>PNG ya da JPEG seçin; program JPEG'e çevirip küçültür (en çok 150 KB). Kaydedince bundan sonraki PDF'lere basılır.</small></div></div></div>
        <div class="hof-field hof-inv-wide hof-inv-logo" data-stamp-field><span>Kaşe / İmza (e-Arşiv Faturasına Basılır)</span>
          <div class="hof-inv-logo-row"><div class="hof-inv-logo-box" data-stamp-preview>${imageBoxHtml("stamp")}</div>
          <div class="hof-inv-logo-tools"><label class="hof-button hof-button-small hof-button-ghost">Kaşe / İmza Seç<input type="file" accept="image/*" data-stamp-file hidden></label><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="stamp-clear" ${stampNow() ? "" : "hidden"}>Kaşe / İmzayı Kaldır</button><small>Kaşe üzerine atılmış imzanın taranmış ya da çekilmiş resmini seçin (beyaz zemin önerilir). e-Belgede GİB logosunun altına, PDF'te Düzenleyen kutusuna basılır; e-Faturada da istenirse Entegratör Ayarları → Görünüm.<span data-stamp-esmm-note>${esc(stampEsmmText(s))}</span></small></div></div></div>
      </div></section>
      <section class="hof-inv-settings" data-inv-banks="${bankState.active ? "accounts" : "legacy"}"><h4>Banka Hesapları <small>(belgenin altına basılır)</small></h4>${bankState.active
        ? `<p class="hof-muted">Banka modülü etkin: belgeye yalnız Banka → Hesaplar'da hesap kartında <b>IBAN Faturada Gösterilsin</b> işaretli etkin TL hesaplar basılır (en çok 4; sırası hesap sırası). Buradaki eski liste artık düzenlenmez.</p>
        ${bankState.accounts.length ? `<ul class="hof-inv-bank-list">${bankState.accounts.slice(0, 4).map(row => `<li data-inv-bank="${esc(row.id)}"><b>${esc(row.bankName)}</b> · ${esc(row.name)} · ${esc(ibanText(row.iban))}</li>`).join("")}</ul>` : `<p class="hof-inv-empty" data-inv-banks-empty>İşaretli hesap yok: belgeye banka bilgisi basılmaz. Banka → Hesaplar → hesap kartı → “IBAN Faturada Gösterilsin”.</p>`}
        ${bankState.suggestions.length ? `<p class="hof-muted" data-inv-bank-suggest>Eski listede olup hesap olarak açılmamış: ${bankState.suggestions.map(bank => `<b>${esc(bank.name || "Banka")}</b> · ${esc(ibanText(bank.iban))}`).join(", ")}. Banka → Hesaplar → “+ Yeni Hesap” ile açıp (sihirbaz bu IBAN'ı önerir) işaretleyin.</p>` : ""}
        ${HOF.bank?.open ? '<div class="hof-plan-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="open-bank">Banka → Hesaplar</button></div>' : ""}`
        : `<p class="hof-muted">Banka modülünde ilk hesap açılana kadar bu liste belgeye basılır (en çok 4). İlk hesap açılınca liste hesap kartındaki “IBAN Faturada Gösterilsin” işaretinden dolar; buradaki bilgiler sihirbazda hesap olarak açılmak üzere önerilir.</p><div class="hof-inv-banks">
        ${banks.map((bank, index) => `<div class="hof-inv-pay-row"><label><span>Banka</span><input data-bank="${index}" data-k="name" maxlength="80" value="${esc(bank.name || "")}"></label><label><span>IBAN</span><input data-bank="${index}" data-k="iban" maxlength="34" value="${esc(bank.iban || "")}" placeholder="TR00 0000 0000 0000 0000 0000 00"></label></div>`).join("")}
      </div>`}</section>
      <section class="hof-inv-settings"><h4>Numaralar</h4><p class="hof-muted">Numara: seri (3 harf) + yıl + 9 hane, ör. FIS2026000000001. Sıradaki numarayı yalnız ileri alabilirsiniz (kâğıt faturadan geçişte kaldığınız yerden devam etmek için).</p><div class="hof-inv-head">
        ${series.map(([key, item]) => `<label class="hof-field"><span>${esc(SERIES_LABELS[key] || key)}</span><input data-series="${esc(key)}" maxlength="3" value="${esc(item.series)}"><small>Sıradaki: ${esc(item.number)}</small></label><label class="hof-field"><span>Sıradaki No (${item.year})</span><input data-start="${esc(key)}" data-year="${item.year}" inputmode="numeric" value="${item.seq}" data-original="${item.seq}"></label>`).join("")}
      </div></section>
      <section class="hof-inv-settings"><h4>Varsayılanlar</h4><div class="hof-inv-head">
        <label class="hof-field"><span>KDV Oranı</span><select data-s="defaults.vatRate">${vatOptions(s.defaults.vatRate)}</select></label>
        <label class="hof-field"><span>Stopaj Oranı (%)</span><input data-s="defaults.stoppageRate" inputmode="decimal" value="${esc(amountText(s.defaults.stoppageRate))}"></label>
        <label class="hof-field"><span>Vade Günü</span><input data-s="defaults.dueDays" inputmode="numeric" value="${esc(s.defaults.dueDays)}"><small>Cari kartında vade günü yazılı değilse kullanılır.</small></label>
        <label class="hof-field"><span>Varsayılan Satış Senaryosu</span><select data-s="defaults.saleScenario"><option value="">Seçilmedi</option>${Object.entries(meta.scenarios).filter(([, item]) => ["sale", "smm"].includes(item.kind)).map(([id, item]) => `<option value="${id}" ${s.defaults.saleScenario === id ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
        <label class="hof-field"><span>Varsayılan Alış Senaryosu</span><select data-s="defaults.purchaseScenario"><option value="">Seçilmedi</option>${Object.entries(meta.scenarios).filter(([, item]) => item.kind === "purchase").map(([id, item]) => `<option value="${id}" ${s.defaults.purchaseScenario === id ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
        <label class="hof-check"><input type="checkbox" data-s="defaults.pricesIncludeVat" ${s.defaults.pricesIncludeVat ? "checked" : ""}><span>Fiyatlar varsayılan olarak KDV dahil yazılsın</span></label>
        <label class="hof-check"><input type="checkbox" data-s="defaults.signatureArea" ${s.defaults.signatureArea !== false ? "checked" : ""}><span>Belgenin altına Teslim Alan ve Düzenleyen (Kaşe / İmza) kutuları basılsın</span></label>
        <label class="hof-check"><input type="checkbox" data-s="defaults.itemTracking" ${s.defaults.itemTracking ? "checked" : ""}><span>Fatura kaleminde Seri No ve Lot No alanları gösterilsin (belgeye ve e-Belgeye yazılır; stokta izlenmez)</span></label>
        <label class="hof-field hof-inv-wide"><span>Belge Alt Notu</span><textarea data-s="defaults.footer" rows="2" maxlength="500" placeholder="ör. İade ve değişim 14 gün içinde faturayla yapılır.">${esc(s.defaults.footer || "")}</textarea></label>
      </div></section>
      ${
        s.edocEnabled
          ? `<section class="hof-inv-settings"><h4>e-Belge Bağlantısı</h4>
        <p class="hof-muted">e-Fatura / e-Arşiv mükellefiyeti, entegratör kullanıcı bilgileri, gönderici birim ve posta kutusu etiketleri, e-Belge serileri <b>Entegratör Ayarları</b> penceresindedir.</p>
        <div class="hof-plan-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="integrator">Entegratör Ayarları</button></div></section>`
          : ""
      }
      <p class="hof-form-error" role="alert" data-form-error></p>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Vazgeç</button><button type="button" class="hof-button" data-act="save-settings">Ayarları Kaydet</button></div>`,
    );
  }
  // Logo: view.logo tanımsızsa değişmedi; "" kaldırıldı; data URL yeni seçildi (kaydedilince sunucuya gider).
  const logoNow = () => (view.logo === undefined ? view.settings?.seller?.logo || "" : view.logo);
  const stampNow = () => (view.stamp === undefined ? view.settings?.seller?.stamp || "" : view.stamp);
  const IMAGE_BOXES = { logo: { now: logoNow, alt: "Logo", empty: "Logo yok" }, stamp: { now: stampNow, alt: "Kaşe / İmza", empty: "Kaşe / imza yok" } };
  const imageBoxHtml = kind => (IMAGE_BOXES[kind].now() ? `<img src="${esc(IMAGE_BOXES[kind].now())}" alt="${IMAGE_BOXES[kind].alt}">` : `<small>${IMAGE_BOXES[kind].empty}</small>`);
  // D1 (kullanıcının bulgusu, 17.10.2026; kullanıcı kararı "form durumu izole"): Logo / Kaşe seçmek ya da kaldırmak yalnız kendi önizleme
  // kutusunu ve "Kaldır" düğmesini günceller. Önceden bütün Fatura Ayarları formu kayıtlı ayarlardan yeniden çiziliyor, kaydedilmemiş unvan,
  // adres, IBAN ve varsayılanlar sessizce eski değerine dönüyordu.
  function paintImageBox(kind) {
    const root = body();
    const box = root?.querySelector(`[data-${kind}-preview]`);
    if (box) box.innerHTML = imageBoxHtml(kind);
    const clear = root?.querySelector(`[data-act="${kind}-clear"]`);
    if (clear) clear.hidden = !IMAGE_BOXES[kind].now();
  }
  async function pickImage(input, kind, readyText) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      view[kind] = await imageToJpeg(file, { maxSide: 600, maxBytes: 150 * 1024 });
      paintImageBox(kind);
      HOF.toast(readyText, { type: "info" });
    } catch (error) {
      HOF.toast(error.message || "Görsel okunamadı.", { type: "error" });
    }
  }
  const pickStamp = input => pickImage(input, "stamp", "Kaşe / imza hazır; Ayarları Kaydet ile saklanır.");
  const pickLogo = input => pickImage(input, "logo", "Logo hazır; Ayarları Kaydet ile saklanır.");
  // Her görsel (PNG, JPEG, WebP…) beyaz zemine çizilip JPEG'e çevrilir; boyut ve kalite sınır altına inene kadar düşer.
  async function imageToJpeg(file, { maxSide, maxBytes }) {
    const bitmap = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Görsel okunamadı; PNG ya da JPEG seçin."));
      image.src = URL.createObjectURL(file);
    });
    try {
      for (const side of [maxSide, 400, 240]) {
        const scale = Math.min(1, side / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(bitmap.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.86, 0.72, 0.58]) {
          const url = canvas.toDataURL("image/jpeg", quality);
          if (Math.ceil(((url.length - url.indexOf(",") - 1) * 3) / 4) <= maxBytes) return url;
        }
      }
      throw new Error("Logo 150 KB altına indirilemedi; daha küçük bir görsel seçin.");
    } finally {
      URL.revokeObjectURL(bitmap.src);
    }
  }
  function settingsPayload() {
    const root = body();
    const s = view.settings;
    const payload = { seller: { banks: [] }, defaults: {}, series: {}, start: { ...(s.start || {}) } };
    if (view.logo !== undefined) payload.seller.logo = view.logo;
    if (view.stamp !== undefined) payload.seller.stamp = view.stamp;
    for (const input of root.querySelectorAll("[data-s]")) {
      const [group, key] = input.dataset.s.split(".");
      const value = input.type === "checkbox" ? input.checked : input.value;
      if (!key) payload[group] = value;
      else (payload[group] ||= {})[key] = value;
    }
    for (const input of root.querySelectorAll("[data-bank]")) {
      const index = Number(input.dataset.bank);
      (payload.seller.banks[index] ||= { name: "", iban: "" })[input.dataset.k] = input.value.trim();
    }
    payload.seller.banks = payload.seller.banks.filter(bank => bank && (bank.name || bank.iban));
    // 2.3.0 (İz 3.4): Banka modülü etkinken eski liste ekranda yok, gövdeye girmez (sunucu da yok sayar; önceki liste öneri olarak kalır).
    if (s.bankAccounts?.active === true) delete payload.seller.banks;
    for (const input of root.querySelectorAll("[data-series]")) payload.series[input.dataset.series] = input.value.trim().toLocaleUpperCase("tr-TR");
    for (const input of root.querySelectorAll("[data-start]")) {
      if (input.value.trim() === input.dataset.original) continue;
      const series = payload.series[input.dataset.start] || s.series[input.dataset.start];
      payload.start[`${series}${input.dataset.year}`] = Number(input.value.replace(/\D/g, "")) || 1;
    }
    if (payload.integrator) {
      if (!payload.integrator.password) delete payload.integrator.password;
      payload.integrator.id = "edm";
    }
    if (!s.edocEnabled) {
      delete payload.integrator;
      delete payload.efatura;
      delete payload.earsiv;
      delete payload.esmm;
    }
    return payload;
  }
  async function settingsAction(act) {
    const error = body()?.querySelector("[data-form-error]");
    if (act === "logo-clear" || act === "stamp-clear") {
      const kind = act === "logo-clear" ? "logo" : "stamp";
      view[kind] = "";
      return paintImageBox(kind);
    }
    if (act === "save-settings") {
      if (error) error.textContent = "";
      try {
        const saved = await HOF.api("/api/workspace/invoices/settings", { method: "PUT", body: settingsPayload() });
        view.settings = saved;
        view.logo = undefined;
        view.stamp = undefined;
        await loadMeta(true);
        HOF.toast("Fatura ayarları kaydedildi.", { type: "success" });
        // Kaydedildi: form kayıtlı (sunucudan dönen) değerlerle çizilir, pencere artık "kaydedilmemiş" sayılmaz.
        HOF.markClean(body());
        renderSettings();
      } catch (failure) {
        if (error) error.textContent = failure.message;
        HOF.toastError(failure);
      }
    }
  }

  // ---------- Entegratör Ayarları (kullanıcı taslağı + onaylanan düzeltmeler, 16.10.2026) ----------
  // Tek yer: e-Fatura / e-Arşiv / e-SMM mükellefiyeti, entegratör bağlantısı, GB (gönderici birim) ve PK (posta kutusu) etiketleri, e-Belge serileri.
  // Firma bilgisi Fatura Ayarları'ndadır (tek kaynak); burada özet ve oraya geçiş. Canlı Ortam "entegre et" kararına dek seçilemez (sunucu da reddeder).
  // Parola ekrana hiç gelmez; göz düğmesi yalnız şimdi yazılan parolayı gösterir.
  const E_SERIES = [
    ["efatura", "e-Fatura Serisi"],
    ["earsiv", "e-Arşiv Serisi"],
    ["esmm", "e-SMM Serisi"],
  ];
  // Entegratöre hangi yoldan çıkılıyor (vekil sunucu ayarı makine genelidir; Yönetim → Sistem → Ağ Bağlantısı).
  function networkLine(network) {
    if (!network) return "";
    const via = { manual: `elle yazılan vekil sunucu (${network.address})`, env: `ortam değişkenindeki vekil sunucu (${network.address})`, windows: `Windows'un vekil sunucu ayarı (${network.address})`, none: "doğrudan (vekil sunucu kapalı)", direct: "doğrudan" }[network.source] || "doğrudan";
    return `İnternet bağlantısı: ${via}. Vekil sunucu Yönetim → Sistem → Ağ Bağlantısı'ndan değiştirilir.`;
  }
  function integratorStatus(integ) {
    if (!integ.username || !integ.hasPassword) return { cls: "is-off", text: "Bağlantı Yok (kullanıcı adı ve parolayı yazıp kaydedin)" };
    const last = integ.lastTest;
    if (!last) return { cls: "is-off", text: "Bağlantı denenmedi (Bağlantıyı Test Et)" };
    const at = last.at ? ` · ${HOF.formatDate(String(last.at).slice(0, 10))} ${String(last.at).slice(11, 16)}` : "";
    return last.ok ? { cls: "is-ok", text: `Bağlantı kuruldu${at}` } : { cls: "is-cancelled", text: `Bağlantı kurulamadı${at}: ${last.message || ""}` };
  }
  // Görünüm önizlemesi: şablon tarayıcının XSLT işlemcisiyle (XSLTProcessor) işlenir — entegratörün göreceği şablonun aynısı. Çıktı
  // betiksiz (sandbox) çerçevede gösterilir.
  function showViewPreview({ xml, xslt }) {
    const parser = new DOMParser();
    const processor = new XSLTProcessor();
    processor.importStylesheet(parser.parseFromString(xslt, "application/xml"));
    const result = processor.transformToDocument(parser.parseFromString(xml, "application/xml"));
    const html = result?.documentElement ? `<!doctype html>${result.documentElement.outerHTML}` : "";
    if (!html) return HOF.toast("Önizleme hazırlanamadı.", { type: "error" });
    const preview = HOF.modal({ title: "e-Belge Görünümü Önizlemesi", eyebrow: "FATURA", size: "wide", body: '<p class="hof-muted">Örnek belge: firma bilgileriniz ve örnek bir müşteriyle. Kayıt yazılmaz, numara harcanmaz.</p><div data-integ-preview></div>' });
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.className = "hof-integ-preview";
    frame.title = "e-Belge Görünümü Önizlemesi";
    frame.srcdoc = html;
    preview.dialog.querySelector("[data-integ-preview]").append(frame);
  }
  // 2.4.4 (E5): Web Servis Kullanıcı Adı alanına servis adresi yazılmış mı — sunucudaki kuralla aynı (server/routes/invoices.mjs integratorUsernameIsUrl).
  const integratorUsernameIsUrl = value => /https?:\/\/|\.svc/i.test(String(value || ""));
  const INTEGRATOR_USERNAME_URL_MESSAGE = "Web Servis Kullanıcı Adı alanına servis adresi yazılmış. Bu alana EDM'nin verdiği web servis kullanıcı adını yazın (adres değil); servis adresi gerekiyorsa Servis Adresi alanına yazılır, boş bırakılırsa seçilen ortamın adresi kullanılır.";
  async function showIntegrator() {
    if (!edoc() || !canSettings()) return HOF.toast("Entegratör ayarları yönetici ve muhasebe yetkisindedir.", { type: "error" });
    let s;
    try {
      s = await HOF.api("/api/workspace/invoices/settings");
    } catch (error) {
      return HOF.toastError(error);
    }
    const state = { tab: "connection", settings: s, aliases: null };
    // 2.4.3: pencere kendi form kapsamıdır (sekme değişse de yazılanlar "kaydedilmemiş" sayılır; Esc / × / dışarı tıklama sorar).
    const modalApi = HOF.modal({ title: "e-Dönüşüm ve Entegrasyon Ayarları", eyebrow: "FATURA", size: "wide", body: '<div data-integ-root data-hof-form="integrator"></div>' });
    const root = modalApi.dialog.querySelector("[data-integ-root]");
    const aliasOptions = (list, current) => {
      const values = [...new Set([current, ...(list || [])].filter(Boolean))];
      return `<option value="">${values.length ? "Seçin" : "Önce Etiketleri Getir"}</option>${values.map(value => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(value)}</option>`).join("")}`;
    };
    const render = () => {
      const st = state.settings;
      const integ = st.integrator || {};
      const seller = st.seller || {};
      const status = integratorStatus(integ);
      const tab = (id, label) => `<button type="button" role="tab" class="hof-rep-chip ${state.tab === id ? "is-on" : ""}" aria-selected="${state.tab === id}" data-integ-tab="${id}">${label}</button>`;
      const panels = {
        connection: `<div class="hof-inv-head">
          <label class="hof-field"><span>Entegratör Firması</span><select data-i="id"><option value="edm" selected>${esc(integ.label || "EDM Bilişim")}</option></select></label>
          <fieldset class="hof-field hof-integ-env"><span>Çalışma Ortamı</span>
            <label class="hof-check"><input type="radio" name="integ-env" value="test" data-i="env" ${integ.env !== "live" ? "checked" : ""}><span>Test Ortamı</span></label>
            <label class="hof-check"><input type="radio" name="integ-env" value="live" data-i="env" ${integ.env === "live" ? "checked" : ""} ${integ.liveAllowed ? "" : "disabled"}><span>Canlı Ortam</span></label>
            ${integ.liveAllowed ? '<small data-integ-live-note>Canlı Ortam\'da gönderilen belgeler yasal belgedir; kullanıcı adı ve parola EDM\'nin canlı hesabıdır, numara firmanın kendi serisinden alınır.</small>' : '<small data-integ-live-note>Canlı ortam, test ortamındaki kabulden sonra açılır.</small>'}
          </fieldset>
          <label class="hof-field"><span>Web Servis Kullanıcı Adı</span><input data-i="username" value="${esc(integ.username || "")}" maxlength="120" autocomplete="off"><small class="hof-form-error" role="alert" data-integ-user-warn ${integratorUsernameIsUrl(integ.username) ? "" : "hidden"}>${esc(INTEGRATOR_USERNAME_URL_MESSAGE)}</small></label>
          <label class="hof-field"><span>Web Servis Parolası</span><span class="hof-integ-pass"><input type="password" data-i="password" value="" maxlength="200" autocomplete="new-password" placeholder="${integ.hasPassword ? "Kayıtlı" : ""}"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-eye aria-label="Yazılan parolayı göster" title="Yazılan parolayı göster">Göster</button></span><small>Şifreli saklanır; kayıtlı parola ekranda gösterilmez.${integ.hasPassword ? " Değiştirmek için yenisini yazın." : ""}</small></label>
          <label class="hof-field hof-integ-alias"><span>Gönderici Birim (GB)</span><select data-i="senderAlias">${aliasOptions(state.aliases?.senders, integ.senderAlias)}</select></label>
          <label class="hof-field hof-integ-alias"><span>Posta Kutusu (PK)</span><select data-i="mailboxAlias">${aliasOptions(state.aliases?.mailboxes, integ.mailboxAlias)}</select></label>
          <label class="hof-field hof-inv-wide"><span>Servis Adresi</span><input data-i="baseUrl" value="${esc(integ.baseUrl || "")}" placeholder="${esc(integ.url || "")}"><small>Boş bırakılırsa seçilen ortamın adresi kullanılır${integ.liveAllowed ? "" : " (canlı ortam açılana kadar yalnız test adresi kabul edilir)"}.</small></label>
          <div class="hof-field hof-inv-wide"><span>Ek Ayarlar ve Tercihler</span>
            <label class="hof-check"><input type="checkbox" data-i="autoSend" ${integ.autoSend ? "checked" : ""}><span>Toplu kaydedilen faturalar entegratöre hemen gönderilsin (kapalıyken Gönderilecekler'de bekler; fatura formunda “Kaydet ve Gönder” düğmesi her zaman vardır)</span></label>
            <label class="hof-check"><input type="checkbox" data-i="earchiveEmail" ${integ.earchiveEmail !== false ? "checked" : ""}><span>e-Arşiv faturası müşterinin e-postasına entegratörce gönderilsin (e-postası olmayana kâğıt çıktı)</span></label>
            <label class="hof-check"><input type="checkbox" data-i="autoCheckUser" ${integ.autoCheckUser ? "checked" : ""}><span>Cari kartında VKN / TCKN yazılınca e-Fatura mükellefiyeti kendiliğinden sorgulansın</span></label>
          </div>
        </div>
        ${integ.env !== "live" ? `<div class="hof-inv-banner" data-integ-test-note><b>Test Ortamı:</b> kullanıcı adı ve parolayı EDM Bilişim'den test hesabı olarak isteyin. Test belgelerinin yasal geçerliliği yoktur; ${esc(Object.values(st.testSeries || {}).join(", ") || "test")} serisinden numara alır ve "Test" olarak işaretlenir. Test faturaları da cari, stok ve kasaya işlenir: denemeyi ikinci bir şirkette yapmanızı öneririz.</div>` : ""}
        <p class="hof-muted" data-integ-network>${esc(networkLine(integ.network))}</p>
        <div class="hof-plan-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-act="test" ${integ.username && integ.hasPassword ? "" : "disabled"} title="Önce kullanıcı adı ve parolayı kaydedin">Bağlantıyı Test Et</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-act="aliases" ${integ.username && integ.hasPassword ? "" : "disabled"} title="Firmanın GB ve PK etiketleri EDM'den getirilir">Etiketleri Getir</button></div>
        <div data-integ-result></div>`,
        firm: `<div class="hof-inv-head">
          <label class="hof-check"><input type="checkbox" data-i="efatura" ${st.efatura ? "checked" : ""}><span>e-Fatura mükellefiyim</span></label>
          <label class="hof-check"><input type="checkbox" data-i="earsiv" ${st.earsiv ? "checked" : ""}><span>e-Arşiv kullanıcısıyım</span></label>
          ${st.esmmAvailable ? `<label class="hof-check"><input type="checkbox" data-i="esmm" ${st.esmm ? "checked" : ""}><span>e-SMM kullanıcısıyım</span></label>` : ""}
          <label class="hof-field"><span>Varsayılan e-Fatura Senaryosu</span><select data-i="efaturaProfile"><option value="TEMELFATURA" ${st.defaults?.efaturaProfile !== "TICARIFATURA" ? "selected" : ""}>Temel Fatura</option><option value="TICARIFATURA" ${st.defaults?.efaturaProfile === "TICARIFATURA" ? "selected" : ""}>Ticari Fatura</option></select></label>
        </div>
        <dl class="hof-integ-firm" data-integ-firm><dt>Unvan</dt><dd>${esc(seller.name || "—")}</dd><dt>VKN / TCKN</dt><dd>${esc(seller.taxNo || "—")}</dd><dt>Vergi Dairesi</dt><dd>${esc(seller.taxOffice || "—")}</dd><dt>Adres</dt><dd>${esc([seller.address, seller.district, seller.city].filter(Boolean).join(", ") || "—")}</dd><dt>E-Posta</dt><dd>${esc(seller.email || "—")}</dd></dl>
        <p class="hof-muted">Firma bilgisi Fatura Ayarları'nda tutulur; burada yalnız gösterilir.</p>
        <div class="hof-plan-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-act="firm">Fatura Ayarları'nda Düzenle</button></div>
        <h4>Etiketler</h4>
        <p class="hof-muted" data-integ-labels>${state.aliases ? `Gönderici Birim (GB): ${esc((state.aliases.senders || []).join(", ") || "yok")} · Posta Kutusu (PK): ${esc((state.aliases.mailboxes || []).join(", ") || "yok")}` : `Seçili: GB ${esc(integ.senderAlias || "—")} · PK ${esc(integ.mailboxAlias || "—")}. Güncel liste Entegrasyon Bilgileri → Etiketleri Getir ile alınır.`}</p>`,
        view: `<div class="hof-inv-head">
          <div class="hof-field hof-inv-wide"><span>e-Belge Görünümü</span>
            <label class="hof-check"><input type="checkbox" data-i="view.enabled" ${st.eView?.enabled !== false ? "checked" : ""}><span>Kendi görünüm tasarımımızı kullan (kapalıysa entegratörün varsayılan görünümü: logo, banka hesapları ve GİB'in zorunlu tuttuğu karekod görünmez)</span></label>
            <label class="hof-check"><input type="checkbox" data-i="view.logo" ${st.eView?.logo !== false ? "checked" : ""}><span>Logoyu Göster${st.seller?.logo ? "" : " — Fatura Ayarları'nda logo yüklenmemiş"}</span></label>
            <label class="hof-check"><input type="checkbox" data-i="view.banks" ${st.eView?.banks !== false ? "checked" : ""}><span>Banka Hesaplarını Göster (IBAN)</span></label>
            <label class="hof-check"><input type="checkbox" data-i="view.footer" ${st.eView?.footer !== false ? "checked" : ""}><span>Fatura Alt Notunu Göster${st.defaults?.footer ? "" : " — Fatura Ayarları'nda alt not yazılmamış"}</span></label>
            <label class="hof-check"><input type="checkbox" data-i="view.stamp" ${st.eView?.stamp !== false ? "checked" : ""}><span>Kaşe / İmzayı e-Arşiv Faturasında Göster${st.seller?.stamp ? "" : " — Fatura Ayarları'nda kaşe / imza yüklenmemiş"}</span></label>
            <label class="hof-check"><input type="checkbox" data-i="view.stampEfatura" ${st.eView?.stampEfatura ? "checked" : ""}><span>Kaşe / İmzayı e-Faturada da Göster</span></label>
          </div>
        </div>
        <p class="hof-muted">Logo, banka hesapları ve alt not Fatura Ayarları'ndan gelir; burada yalnız e-Belgede gösterilip gösterilmeyeceği seçilir. Görünüm belgenin içine gömülür; alıcı ve GİB belgeyi bu tasarımla görür.</p>
        <div class="hof-plan-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-act="preview">Önizle</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-integ-act="firm">Fatura Ayarları'nda Düzenle</button></div>`,
        // Wolvox karşılaştırmasının kalan maddeleri (kullanıcı kararı 16.10.2026: "isteğe bağlı olarak olsun"); hepsi varsayılan kapalı.
        extras: `<div class="hof-inv-head">
          <div class="hof-field hof-inv-wide"><span>e-Belgeye Eklenecekler</span>
            <label class="hof-check"><input type="checkbox" data-i="opt.balanceNote" ${st.eOptions?.balanceNote ? "checked" : ""}><span>Cari bakiyesini faturanın notuna ekle (gönderildiği an itibarıyla, bu fatura dahil)</span></label>
            <label class="hof-check"><input type="checkbox" data-i="opt.paymentMeans" ${st.eOptions?.paymentMeans ? "checked" : ""}><span>Ödeme şeklini yaz: Nakit, Havale / EFT, Kredi Kartı (POS), Çek, Senet — peşin ödenen kısım; kalan vadeli kısım son ödeme tarihiyle</span></label>
          </div>
          <div class="hof-field hof-inv-wide"><span>Gönderim</span>
            <label class="hof-check"><input type="checkbox" data-i="opt.draftUpload" ${st.eOptions?.draftUpload ? "checked" : ""}><span>Faturayı önce EDM portalına taslak olarak yükle (Gönder yerine “Portala Taslak Yükle”; taslağı EDM portalından ya da programdan gönderirsiniz)</span></label>
          </div>
        </div>
        <p class="hof-muted">Kalemde Seri No / Lot No alanları Fatura Ayarları → Varsayılanlar'dan açılır.</p>`,
        series: `<div class="hof-inv-head">${E_SERIES.filter(([key]) => key !== "esmm" || st.esmmAvailable).map(([key, label]) => `<label class="hof-field"><span>${label}</span><input data-i-series="${key}" value="${esc(st.series?.[key] || "")}" maxlength="3"><small>Sıradaki: ${esc((st.nextNumbers || {})[key]?.number || "—")}${st.testNumbers?.[key] ? ` · Test ortamında: ${esc(st.testNumbers[key].number)}` : ""}</small></label>${st.testNumbers?.[key] ? `<label class="hof-field"><span>Test Ortamında Sıradaki No (${esc(st.testNumbers[key].series)} ${st.testNumbers[key].year})</span><input data-i-test-start="${esc(st.testNumbers[key].series)}${st.testNumbers[key].year}" data-current="${st.testNumbers[key].seq}" inputmode="numeric" value="${st.testNumbers[key].seq}"><small>EDM'nin test hesabı ortaktır; numara başka firmanınkiyle çakışırsa ileri alın.</small></label>` : ""}`).join("")}</div>
        ${st.testNumbers ? `<p class="hof-muted" data-integ-test-series>Test ortamında gönderilen belgeler ${esc(Object.values(st.testSeries || {}).join(", "))} serisinden numara alır ve "Test" olarak işaretlenir; canlı ortama geçince yukarıdaki serileriniz 1'den başlar.</p>` : ""}
        <p class="hof-muted">Seri üç karakterdir (büyük harf ya da rakam; Türkçe harf yok). e-Belge numarası seri + yıl + 9 hane olur (ör. EFT2026000000001).</p>`,
      };
      HOF.swap(
        root,
        `<div class="hof-inv-tabs" role="tablist">${tab("connection", "Entegrasyon Bilgileri")}${tab("firm", "Firma / Etiket Tanımları")}${tab("series", "Otomatik Seriler")}${tab("view", "Görünüm")}${tab("extras", "Ek Seçenekler")}</div>
        <div data-integ-panel="${state.tab}">${panels[state.tab]}</div>
        <p class="hof-form-error" role="alert" data-form-error></p>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-integ-act="close">Vazgeç</button><button type="button" class="hof-button" data-integ-act="save">Kaydet</button></div>
        <p class="hof-integ-status ${status.cls}" data-integ-status>Durum: ${esc(status.text)}</p>`,
      );
    };
    // Sekmeler arası geçişte yazılanlar kaybolmasın: her sekmenin alanları taslakta tutulur.
    const draft = {};
    const collect = () => {
      for (const input of root.querySelectorAll("[data-i]")) {
        if (input.type === "radio") {
          if (input.checked) draft[input.dataset.i] = input.value;
        } else draft[input.dataset.i] = input.type === "checkbox" ? input.checked : input.value;
      }
      for (const input of root.querySelectorAll("[data-i-series]")) (draft.series ||= {})[input.dataset.iSeries] = input.value.trim().toLocaleUpperCase("tr-TR");
      for (const input of root.querySelectorAll("[data-i-test-start]")) (draft.testStart ||= {})[input.dataset.iTestStart] = { value: input.value.replace(/\D/g, ""), current: input.dataset.current };
    };
    const restore = () => {
      for (const input of root.querySelectorAll("[data-i]")) {
        const value = draft[input.dataset.i];
        if (value === undefined) continue;
        if (input.type === "radio") input.checked = input.value === value;
        else if (input.type === "checkbox") input.checked = value === true;
        else input.value = value;
      }
      for (const input of root.querySelectorAll("[data-i-series]")) if (draft.series?.[input.dataset.iSeries] !== undefined) input.value = draft.series[input.dataset.iSeries];
      for (const input of root.querySelectorAll("[data-i-test-start]")) if (draft.testStart?.[input.dataset.iTestStart] !== undefined) input.value = draft.testStart[input.dataset.iTestStart].value;
    };
    const payload = () => {
      collect();
      const integrator = { id: "edm" };
      for (const key of ["env", "username", "password", "senderAlias", "mailboxAlias", "baseUrl", "autoSend", "earchiveEmail", "autoCheckUser"]) if (draft[key] !== undefined) integrator[key] = draft[key];
      if (!integrator.password) delete integrator.password;
      const body = { integrator };
      for (const key of ["efatura", "earsiv", "esmm"]) if (draft[key] !== undefined) body[key] = draft[key];
      if (draft.efaturaProfile !== undefined) body.defaults = { efaturaProfile: draft.efaturaProfile };
      if (draft.series) body.series = draft.series;
      // Test serisinin sıradaki numarası (2.4.2): yalnız değiştirilen gönderilir (sunucu öbür başlangıçları korur).
      const testStart = Object.fromEntries(Object.entries(draft.testStart || {}).filter(([, item]) => item.value && item.value !== item.current).map(([key, item]) => [key, Number(item.value)]));
      if (Object.keys(testStart).length) body.start = testStart;
      const eView = Object.fromEntries(["enabled", "logo", "banks", "footer", "stamp", "stampEfatura"].filter(key => draft[`view.${key}`] !== undefined).map(key => [key, draft[`view.${key}`]]));
      if (Object.keys(eView).length) body.eView = eView;
      const eOptions = Object.fromEntries(["balanceNote", "paymentMeans", "draftUpload"].filter(key => draft[`opt.${key}`] !== undefined).map(key => [key, draft[`opt.${key}`]]));
      if (Object.keys(eOptions).length) body.eOptions = eOptions;
      return body;
    };
    const showResult = (html, cls = "") => {
      const slot = root.querySelector("[data-integ-result]");
      if (slot) slot.innerHTML = html ? `<div class="hof-inv-banner ${cls}">${html}</div>` : "";
    };
    const showUserWarn = () => {
      const input = root.querySelector('[data-i="username"]');
      const warn = root.querySelector("[data-integ-user-warn]");
      if (input && warn) warn.hidden = !integratorUsernameIsUrl(input.value);
    };
    root.addEventListener("input", event => {
      if (event.target.matches?.('[data-i="username"]')) showUserWarn();
    });
    root.addEventListener("click", async event => {
      const target = event.target.closest("[data-integ-tab], [data-integ-act], [data-integ-eye]");
      if (!target) return;
      if (target.dataset.integTab) {
        collect();
        state.tab = target.dataset.integTab;
        render();
        return restore();
      }
      if (target.hasAttribute("data-integ-eye")) {
        const input = root.querySelector('[data-i="password"]');
        const show = HOF.toggleSecret(input);
        target.textContent = show ? "Gizle" : "Göster";
        return;
      }
      const act = target.dataset.integAct;
      const error = root.querySelector("[data-form-error]");
      if (act === "close") return modalApi.close();
      if (act === "firm") {
        modalApi.close();
        return showSettings();
      }
      if (act === "save") {
        if (error) error.textContent = "";
        // Kaydetmeden önce (E5): ad değiştiyse ve adres gibiyse gönderilmez. Değişmeyen eski kayıt ilgisiz ayarların kaydını kilitlemez (sunucu da böyle).
        collect();
        if (draft.username !== undefined && draft.username.trim() !== (state.settings.integrator?.username || "") && integratorUsernameIsUrl(draft.username)) {
          if (error) error.textContent = INTEGRATOR_USERNAME_URL_MESSAGE;
          showUserWarn();
          root.querySelector('[data-i="username"]')?.focus();
          return HOF.toast(INTEGRATOR_USERNAME_URL_MESSAGE, { type: "error" });
        }
        target.disabled = true;
        try {
          const saved = await HOF.api("/api/workspace/invoices/settings", { method: "PUT", body: payload() });
          state.settings = { ...state.settings, ...saved };
          delete draft.password;
          syncSettingsFlags(saved);
          await loadMeta(true);
          refreshPortalButton();
          HOF.toast("Entegratör ayarları kaydedildi.", { type: "success" });
          HOF.markClean(root);
          render();
          restore();
        } catch (failure) {
          if (error) error.textContent = failure.message;
          HOF.toastError(failure);
        } finally {
          target.disabled = false;
        }
        return;
      }
      if (act === "preview") {
        collect();
        const eView = { ...Object.fromEntries(["logo", "banks", "footer", "stamp"].map(key => [key, draft[`view.${key}`] ?? state.settings.eView?.[key] !== false])), stampEfatura: draft["view.stampEfatura"] ?? state.settings.eView?.stampEfatura === true };
        try {
          const sample = await HOF.api("/api/workspace/invoices/view-preview", { method: "POST", body: { eView } });
          showViewPreview(sample);
        } catch (failure) {
          HOF.toastError(failure);
        }
        return;
      }
      if (act === "test" || act === "aliases") {
        collect();
        showResult('<p class="hof-muted">Bağlanılıyor…</p>');
        try {
          if (act === "test") {
            const result = await HOF.api("/api/workspace/invoices/integrator/test", { method: "POST", body: {} });
            showResult(`<b>${esc(result.message)}</b>`, "is-ok");
          } else {
            state.aliases = await HOF.api("/api/workspace/invoices/integrator/aliases", { method: "POST", body: {} });
            showResult(`<b>Etiketler getirildi.</b> GB: ${esc(state.aliases.senders.join(", ") || "yok")} · PK: ${esc(state.aliases.mailboxes.join(", ") || "yok")}`, "is-ok");
          }
        } catch (failure) {
          showResult(`<b>Bağlantı kurulamadı.</b> ${esc(failure.message)}`, "is-cancelled");
        }
        try {
          state.settings = await HOF.api("/api/workspace/invoices/settings");
        } catch {
          /* durum satırı eski kalır */
        }
        const keep = root.querySelector("[data-integ-result]")?.innerHTML || "";
        render();
        restore();
        const slot = root.querySelector("[data-integ-result]");
        if (slot) slot.innerHTML = keep;
      }
    });
    render();
  }

  // ---------- Gelen e-Faturalar (e-Belge açıkken) ----------
  const INBOX_STATES = [
    ["new", "Yeni"],
    ["imported", "Alındı"],
    ["ignored", "Yok Sayıldı"],
    ["", "Tümü"],
  ];
  async function loadInbox() {
    if (!edoc()) return showList();
    setMode("inbox");
    view.tab = "inbox";
    try {
      view.inbox = await HOF.api(`/api/workspace/invoices/inbox${view.inboxState ? `?state=${view.inboxState}` : ""}`);
    } catch (error) {
      view.inbox = { items: [], counts: {}, error: error.message };
    }
    renderInbox();
  }
  function renderInbox() {
    const root = body();
    const data = view.inbox;
    if (!root || !data) return;
    const [from, to] = presetRange("month");
    const rows = data.items
      .map(item => `<tr data-inbox="${esc(item.id)}" tabindex="0"><td>${esc(HOF.formatDate(item.issueDate))}</td><td><b>${esc(item.number)}</b><small>${esc(item.profile)}</small></td><td><b>${esc(item.senderName || "—")}</b><small>${esc(item.senderVkn)}</small></td><td><span class="hof-inv-pill is-in-${esc(item.state)}">${esc(item.stateLabel)}</span>${item.duplicateNumber ? '<small class="hof-inv-warn">Bu numarayla alış faturası zaten kayıtlı</small>' : ""}${item.invoiceNumber || item.invoiceId ? `<small>${item.invoiceStatus === "draft" ? "Taslak" : esc(item.invoiceNumber)}</small>` : ""}</td><td class="num"><b>${esc(curMoney(item.payable, item.currency))}</b></td></tr>`)
      .join("");
    const tabs = [TABS[0], ["pending", "Gönderilecekler"], ...TABS.slice(1), ["inbox", "Gelen e-Faturalar"]];
    HOF.swap(
      root,
      `<div class="hof-plan-head"><div class="hof-plan-title"><h3>Gelen e-Faturalar</h3><small>Size kesilen e-Faturalar entegratörden çekilir; alış faturası olarak alınca stok, cari ve KDV kayıtları açılır.</small></div>
        <div class="hof-plan-actions">${canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="settings">Fatura Ayarları</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="integrator">Entegratör Ayarları</button>' : ""}</div></div>
      <div class="hof-inv-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="hof-rep-chip ${view.tab === id ? "is-on" : ""}" data-tab="${id}">${label}</button>`).join("")}</div>
      <div class="hof-plans-filters hof-chq-filters">
        <div class="hof-rep-presets" role="group" aria-label="Durum">${INBOX_STATES.map(([id, label]) => `<button type="button" class="hof-rep-chip ${view.inboxState === id ? "is-on" : ""}" data-inbox-state="${id}">${label}${id && data.counts?.[id] ? ` <b>${data.counts[id]}</b>` : ""}</button>`).join("")}</div>
        <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-inbox-from value="${esc(from)}"></label>
        <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-inbox-to value="${esc(todayIso() < to ? todayIso() : to)}"></label>
        ${canManage() ? '<button type="button" class="hof-button hof-button-small" data-act="inbox-fetch">Gelen Kutusunu Yenile</button>' : ""}
      </div>
      ${data.error ? `<p class="hof-inv-banner is-cancelled">${esc(data.error)}</p>` : ""}
      <div class="hof-rep-table"><table class="hof-table hof-chq-table"><thead><tr><th>Tarih</th><th>No</th><th>Gönderen</th><th>Durum</th><th class="num">Tutar</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="hof-empty">${view.inboxState === "new" ? "Yeni gelen e-Fatura yok. Gelen Kutusunu Yenile ile entegratörden çekin." : "Bu durumda belge yok."}</td></tr>`}</tbody></table></div>`,
    );
  }
  async function loadInboxItem(id) {
    try {
      view.inboxItem = await HOF.api(`/api/workspace/invoices/inbox/${encodeURIComponent(id)}`);
      setMode("inbox-item");
      renderInboxItem();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  function renderInboxItem() {
    const root = body();
    const item = view.inboxItem;
    if (!root || !item) return;
    const p = item.preview?.parsed;
    const lines = item.preview?.lines || [];
    HOF.swap(
      root,
      `<div class="hof-plan-head"><div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="inbox-back" title="Gelen kutusuna dön">← Gelen Kutusu</button>
        <div class="hof-plan-title"><h3>${esc(item.number)} <span class="hof-inv-pill is-in-${esc(item.state)}">${esc(item.stateLabel)}</span></h3><small>${esc(item.senderName)} · ${esc(item.senderVkn)} · ${esc(HOF.formatDate(item.issueDate))}</small></div></div>
        <div class="hof-chq-amount"><span>Toplam</span><strong>${esc(curMoney(item.payable, item.currency))}</strong></div></div>
      ${item.readError ? `<p class="hof-inv-banner is-cancelled">${esc(item.readError)}</p>` : ""}
      ${item.preview?.addressedToOther ? '<p class="hof-inv-banner is-cancelled">Bu belgedeki alıcı VKN firmanızınkiyle aynı değil; kontrol edin.</p>' : ""}
      ${item.duplicateNumber ? `<p class="hof-inv-banner">Bu satıcıdan ${esc(item.duplicateNumber)} numaralı alış faturası zaten kayıtlı. Aynı belgeyi ikinci kez almayın.</p>` : ""}
      <div class="hof-chq-actions">${canManage() && item.state !== "imported" && !item.readError ? '<button type="button" class="hof-button hof-button-small" data-act="inbox-import">Alış Faturası Olarak Al</button>' : ""}${item.invoiceId ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-open-invoice="${esc(item.invoiceId)}">Alış Faturasını Aç</button>` : ""}${canManage() && item.state === "new" ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="inbox-ignore">Yok Say</button>' : ""}${canManage() && item.state === "ignored" ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="inbox-restore">Yeniden Yeni Yap</button>' : ""}<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/inbox/${esc(item.id)}/belge.xml" download>XML İndir</a></div>
      ${
        p
          ? `<dl class="hof-chq-facts">
        <div><dt>Satıcı</dt><dd>${esc(p.supplier.name)}<small>${esc(p.supplier.taxNo)}${p.supplier.taxOffice ? ` · ${esc(p.supplier.taxOffice)}` : ""}</small></dd></div>
        <div><dt>Cari</dt><dd>${item.accountId ? `<a href="#" data-open-account="${esc(item.accountId)}">Kayıtlı Cari</a>` : "Alınca VKN ile yeni cari açılır"}</dd></div>
        <div><dt>Belge</dt><dd>${esc(p.profile)} · ${esc(p.typeCode)}</dd></div>
        <div><dt>Tarih ve Saat</dt><dd>${esc(HOF.formatDate(p.issueDate))} ${esc(p.issueTime || "")}</dd></div>
        ${p.notes?.length ? `<div class="is-wide"><dt>Not</dt><dd>${esc(p.notes.join(" · "))}</dd></div>` : ""}
      </dl>
      <div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Kalem</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">KDV</th><th class="num">Tutar</th><th>Stok Kartı</th></tr></thead><tbody>${lines.map(line => `<tr><td><b>${esc(line.name)}</b>${line.code ? `<small>${esc(line.code)}</small>` : ""}</td><td class="num">${esc(String(line.qty).replace(".", ","))} ${esc(line.unit)}</td><td class="num">${esc(curMoney(line.unitPrice, p.currency))}</td><td class="num">%${esc(String(line.vatRate))}</td><td class="num">${esc(curMoney(line.net, p.currency))}</td><td>${line.itemId ? esc(line.itemName) : '<small class="hof-muted">Eşleşmedi: gider / hizmet kalemi olur</small>'}</td></tr>`).join("")}</tbody></table></div>`
          : ""
      }`,
    );
  }
  async function inboxAction(act) {
    if (act === "inbox-back") return loadInbox();
    if (act === "inbox-fetch") {
      const from = body()?.querySelector("[data-inbox-from]")?.value || "";
      const to = body()?.querySelector("[data-inbox-to]")?.value || "";
      try {
        const result = await HOF.api("/api/workspace/invoices/inbox/fetch", { method: "POST", body: { from, to } });
        HOF.toast(result.added ? `${result.added} yeni e-Fatura geldi.` : "Yeni e-Fatura yok.", { type: "success" });
      } catch (error) {
        HOF.toastError(error);
      }
      return loadInbox();
    }
    const item = view.inboxItem;
    if (!item) return;
    if (act === "inbox-import") {
      try {
        const result = await HOF.api(`/api/workspace/invoices/inbox/${encodeURIComponent(item.id)}/import`, { method: "POST", body: {} });
        HOF.toast(`Alış faturası taslağı açıldı${result.accountCreated ? "; satıcı için cari açıldı" : ""}.${result.unmatched?.length ? ` ${result.unmatched.length} kalem stok kartına eşlenmedi (gider/hizmet olarak geldi).` : ""}`, { type: "success", timeout: 8000 });
        if (result.warning) HOF.toast(result.warning, { type: "error", timeout: 9000 });
        return startForm({ draft: result.draft });
      } catch (error) {
        return HOF.toastError(error);
      }
    }
    if (act === "inbox-ignore" || act === "inbox-restore") {
      try {
        await HOF.api(`/api/workspace/invoices/inbox/${encodeURIComponent(item.id)}/state`, { method: "POST", body: { state: act === "inbox-ignore" ? "ignored" : "new" } });
        return loadInboxItem(item.id);
      } catch (error) {
        return HOF.toastError(error);
      }
    }
  }
  // Gelen kutusu durum çipleri.
  document.addEventListener("click", event => {
    const chip = event.target.closest?.("[data-inbox-state]");
    if (!chip || !modal?.dialog.contains(chip)) return;
    view.inboxState = chip.dataset.inboxState;
    loadInbox();
  });

  // ---------- Dışarıdan açma ----------
  // Cari kartındaki "Satış Faturası" / "Alış Faturası" pilleri: cari dolu, senaryo seçimiyle açılır.
  const newFor = ({ side = "sale", account = null } = {}) => open({ side, account: account || {} });
  const openDoc = id => open({ id });
  const forAccount = account => {
    view.tab = "all";
    return open({ account: account || {}, tab: "all" });
  };
  // sendPendingTimeoutMs: Tümünü Gönder isteğinin zaman aşımı (0 = 150 sn); ekran testi (gg243-tumunu-gonder) kısaltır.
  HOF.invoices = { open, newFor, openDoc, forAccount, sendPendingTimeoutMs: 0, eUnitAsAdet: unit => Boolean(meta) && eUnitAsAdet(unit), edocEnabled: () => meta?.edocEnabled === true, autoCheckUser: () => meta?.edocEnabled === true && meta?.settings?.integrator?.autoCheckUser === true };
  // 2.3.0 İz 5.5 Hızlı Arama: sekmeler TABS'tan (purchase sekmesi "Alınan" — müşteri "alış f" yazar: Alış Faturaları eş adı), işlemler
  // yetkiye göre (Yeni Satış / Alış Faturası → senaryo seçimi; Yeni İade → İadeler sekmesi).
  HOF.search?.register(() => {
    if (!canView()) return [];
    const ALIAS = { purchase: "Alış Faturaları", sale: "Satış Faturaları", returns: "İade Faturaları" };
    const tabs = TABS.map(([id, label]) => ({ group: "Sayfa", label: ALIAS[id] && ALIAS[id] !== label ? `${ALIAS[id]} (${label})` : label, path: moduleName(), keywords: ["Fatura"], run: () => open({ tab: id }) }));
    const acts = canManage()
      ? [
          { group: "İşlem", label: "Yeni Satış Faturası", path: moduleName(), keywords: ["Fatura Kes", "Satış"], run: () => open({ side: "sale" }) },
          { group: "İşlem", label: "Yeni Alış Faturası", path: moduleName(), keywords: ["Alınan Fatura", "Alış"], run: () => open({ side: "purchase" }) },
        ]
      : [];
    return [...tabs, ...acts];
  });
  // Stok hareketi, çek/senet kartı, taksit kartı ve Kasa satırındaki "Fatura" bağlantısı (data-open-invoice): faturayı
  // açar. Kendi penceresinde işleyen modül (cari kartı, fatura penceresi) tıklamayı işaretler; burada ikinci kez açılmaz.
  document.addEventListener("click", event => {
    const link = event.target.closest?.("[data-open-invoice]");
    if (!link || event.defaultPrevented || !canView()) return;
    event.preventDefault();
    openDoc(link.dataset.openInvoice);
  });
  HOF.whenReady(() => {
    // Cari formu e-Fatura alanlarını göstermek için e-Belge bağlantısının açık olup olmadığını bilmeli.
    if (canView()) loadMeta().catch(() => null);
    // v2.0.22: canlı olaylar ve defter değişiklikleri tek yenileme kapısından (HOF.refresher; açık pencere başına tek yükleme).
    const refreshOpen = HOF.refresher(() => {
      if (!modal) return null;
      if (view.mode === "list") return loadList(false, { quiet: true });
      if (view.mode === "card" && view.id) return loadDoc(view.id, { quiet: true });
      return null;
    });
    // Banka m1: sunucu peşin satır için kart/hesap seçimi istedi (ekranın listesi eskiydi) → açık formun hücreleri taze listeyle çizilir;
    // seçilmiş hesap satırda kalır (yeni listede yoksa bankCell onu da seçenek olarak gösterir).
    HOF.on("bank-choices-stale", () => {
      if (!view.form || view.bankChoices === "loading") return;
      view.bankChoices = null;
      loadBankChoices();
    });
    HOF.on("live:workspace.changed", change => {
      if (!modal || change?.kind !== "invoices") return;
      if (view.mode === "list") refreshOpen();
      else if (view.mode === "card" && view.id && (!change.invoiceId || change.invoiceId === view.id)) refreshOpen();
      else if (view.mode === "inbox" && change.inbox) loadInbox();
    });
    // Tahsilat, çek/senet ya da taksitten gelen ödeme faturanın ödeme durumunu değiştirir: açık liste/kart yenilenir.
    HOF.onLedger(["accounts", "cheques", "plans", "cash", "invoices"], detail => {
      if (!modal || detail.path?.startsWith("/api/workspace/invoices")) return;
      if (detail.local) refreshOpen.now();
      else refreshOpen();
    }, 400);
  });
})();
