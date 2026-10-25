/* DestekOfis — Rapor merkezi (v2.0.7; v2.0.9'dan beri Raporlar penceresinin "Tüm raporlar" sekmesi).
 * Programa girilen her bilginin hazır raporu: Kasa, Cari, Taksit, Çek/Senet, Stok, kayıtlar (tahsilat, not, görev,
 * belge, tablo verisi) ve işlem geçmişi. Solda gruplar ve arama; sağda seçilen raporun süzgeçleri, ekranda ön izleme
 * (ilk 200 satır) ve tek tıkla PDF / Excel. Rapor tanımları sunucudadır (server/routes/report-center.mjs); ekran
 * süzgeçleri raporun bildirdiği parametrelerden kurulur, yeni rapor eklemek için istemci değişmez. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let center = null;
  let lastId = ""; // sekmeye dönülünce son bakılan rapor açılır

  const GROUP_ICONS = {
    Kasa: "₺",
    Cari: "☰",
    Taksit: "▤",
    "Çek / Senet": "✎",
    Stok: "▦",
    Kayıtlar: "≡",
    Ofis: "◷",
    Banka: "▣",
  };
  const PRESETS = [
    ["thisMonth", "Bu Ay"],
    ["lastMonth", "Geçen Ay"],
    ["last30", "Son 30 Gün"],
    ["thisYear", "Bu Yıl"],
    ["all", "Tüm Zamanlar"],
  ];
  // 2.4.3 (C15): ileriye dönük rapor (sunucu presets: "future"; Banka Nakit Akış Raporu) geçmiş dönem sunmaz. "Bu Ay" ileriye dönük raporda
  // bugünden ay sonuna kadardır (sunucu başlangıcı bugünle kırpar); "Tüm Beklenenler" sınırsız (preset=all).
  const FUTURE_PRESETS = [
    ["next7", "Önümüzdeki 7 Gün"],
    ["next30", "Önümüzdeki 30 Gün"],
    ["next90", "Önümüzdeki 90 Gün"],
    ["thisMonth", "Bu Ay"],
    ["all", "Tüm Beklenenler"],
  ];
  const presetsOf = report => (report?.presets === "future" ? FUTURE_PRESETS : PRESETS);
  // 2.4.3 (C9): ekranda para biçimi programın öbür pencereleriyle aynı ("₺1.234,56"; HOF.formatMoney). Sunucunun rapor metni ("1.234,56 TL")
  // yalnız ekranda, para kolonlarında, TOPLAM'da ve özet kartlarında çevrilir; PDF ve Excel "TL" kalır (belge biçimi).
  const SCREEN_TL = /([-−]?)(\d{1,3}(?:\.\d{3})*,\d{2}) TL\b/g;
  const screenMoney = value => String(value ?? "").replace(SCREEN_TL, "$1₺$2");
  const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const presetRange = preset => {
    const today = todayIso();
    const [y, m, d] = today.split("-").map(Number);
    const iso = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
    return (
      {
        thisMonth: { from: iso(y, m, 1), to: iso(y, m + 1, 0) },
        lastMonth: { from: iso(y, m - 1, 1), to: iso(y, m, 0) },
        last30: { from: iso(y, m, d - 30), to: today },
        thisYear: { from: iso(y, 1, 1), to: iso(y, 12, 31) },
        next7: { from: today, to: iso(y, m, d + 7) },
        next30: { from: today, to: iso(y, m, d + 30) },
        next90: { from: today, to: iso(y, m, d + 90) },
        // "Tüm zamanlar": açık tarih gönderilir (sunucu boş aralığı "bu ay" sayardı; kullanıcı yanlış dönem görürdü).
        all: { from: iso(y - 50, 1, 1), to: today },
      }[preset] || { from: "", to: "" }
    );
  };
  const SELECTS = {
    type: { label: "Cari Türü", options: [["", "Tüm Cariler"], ["customer", "Müşteriler"], ["supplier", "Tedarikçiler"], ["other", "Diğer"]] },
    side: { label: "Bakiye", options: [["", "Tümü"], ["debtor", "Borçlular"], ["creditor", "Alacaklılar"], ["nonzero", "Sadece Bakiyesi Olanlar"], ["zero", "Kapalı (bakiyesi sıfır)"], ["overdue", "Geciken Taksiti Olan"]] },
    direction: { label: "Yön", options: [["", "Alınan ve Verilen"], ["in", "Alınan"], ["out", "Verilen"]] },
    status: { label: "Durum", options: [["", "Tüm Durumlar"], ["open", "Açık (portföyde / ödenecek)"], ["overdue", "Vadesi Geçmiş"], ["soon", "7 Gün İçinde"], ["collected", "Tahsil Edildi"], ["endorsed", "Ciro Edildi"], ["paid", "Ödendi"], ["bounced", "Karşılıksız / İade"]] },
    state: { label: "Kalem", options: [["", "Tüm Kalemler"], ["low", "Kritik Seviyedekiler"], ["out", "Tükenenler"], ["negative", "Eksi Stoktakiler"], ["product", "Ürünler"], ["service", "Hizmetler"]] },
    planStatus: { label: "Kartlar", options: [["active", "Açık Kartlar"], ["closed", "Kapatılanlar"], ["all", "Tümü"]] },
    taskStatus: { label: "Görevler", options: [["all", "Tümü"], ["open", "Açık"], ["done", "Tamamlanan"]] },
    // 2.3.0 İz 3.3 (plan §8.10 kuralı; görünen metinde "Kurumsal" yok): Kredi Kartı (309) ve Kredi (300) yolları; Hesap süzgeci sunucudan (anyAccount).
    payMethod: { label: "Yol", options: [["noncash", "Banka ve POS (Tümü)"], ["bank", "Banka (Havale / EFT)"], ["card", "POS / Kredi Kartı"], ["ccard", "Kredi Kartı"], ["loan", "Kredi"]] },
    // v2.1.0 Aşama 14 (Banka grubu): hareket türü ve hesap grubu. Hesap seçenekleri (bankAccount, feeAccount) sunucunun katalog yanıtından.
    bankMove: { label: "Hareket", options: [["", "Tüm Hareketler"], ["external", "Dış Hareketler"], ["internal", "Transfer (İç Hareketler)"]] },
    bankGroup: { label: "Hesap Grubu", options: [["real", "Gerçek Banka"], ["debt", "Kart ve Kredi Borcu"], ["unassigned", "Hesabı Atanmamış Eski Hareketler"], ["all", "Tümü"]] },
    // 2.2.0 (İz 3.5): POS Ödeme Takvimi'nin kalem türü (POS seçenekleri sunucunun katalog yanıtından: posTerminal).
    posKind: { label: "Tür", options: [["", "Tümü"], ["pos", "POS"], ["blocked", "Blokeli POS"], ["fee", "Komisyon Tahsili"]] },
    // 2.3.0 İz 5.3: POS Satış / POS Komisyon raporlarının tür ve dönem süzgeçleri.
    posSale: { label: "Tür", options: [["", "Tümü"], ["sale", "POS Satışı"], ["refund", "POS İadesi"], ["cancel", "POS İptal İadesi"]] },
    posPeriod: { label: "Dönem", options: [["month", "Aylık"], ["year", "Yıllık"], ["range", "Dönem Toplamı"]] },
    // 2.3.0 (İz 1.7): Şüpheli Alacaklar raporunun Durum ve Neden süzgeçleri (sunucu lib/doubtful-gl.mjs DOUBTFUL_REASONS ile aynı anahtarlar).
    doubtfulStatus: { label: "Durum", options: [["open", "Açık"], ["closed", "Kapanan"], ["all", "Tümü"]] },
    doubtfulReason: { label: "Neden", options: [["", "Tüm Nedenler"], ["cheque", "Karşılıksız Çek"], ["note", "Protestolu Senet"], ["lawsuit", "Dava"], ["enforcement", "İcra"], ["other", "Diğer"]] },
  };
  const DYNAMIC = { bankAccount: "Banka Hesabı", feeAccount: "Banka Hesabı", posTerminal: "POS", anyAccount: "Hesap" };
  // 2.4.5 madde 6d (müşteri isteği M2): açılıp kapanan seçenekler (işaretliyse "1" gider). Cari Ekstre → Fatura Kalemlerini Göster (Ayrıntılı Cari Ekstre).
  const CHECKS = { items: "Fatura Kalemlerini Göster" };
  // Başka ekrandan belirli cari ve seçenekle açılış (cari kartı → Ayrıntılı Ekstre): select() bir kez okur.
  let pending = null;

  // Raporlar penceresindeki "Tüm raporlar" sekmesine kurulur (hof-overview.js). Sekme her açılışta yeni düğüm verir.
  async function mount(host, reportId = "") {
    if (!HOF.can("overview.view") && !HOF.can("audit.view") && !HOF.can("bank.reports")) {
      host.innerHTML = '<p class="hof-empty">Bu raporlar yönetici ve yöneticinin finans raporları yetkisi verdiği kişiler içindir.</p>';
      return;
    }
    const wanted = reportId || lastId;
    const state = { host, reports: [], id: wanted, q: "", params: {}, preview: null, busy: false };
    center = state;
    host.innerHTML = '<div class="hof-rc hof-rc-embedded" data-rc><p class="hof-empty">Raporlar yükleniyor…</p></div>';
    host.addEventListener("click", onClick);
    host.addEventListener("input", event => {
      if (event.target.matches("[data-rc-search]") && center === state) {
        center.q = event.target.value;
        renderNav();
      }
    });
    host.addEventListener("change", onChange);
    try {
      const catalog = await HOF.api("/api/workspace/report-center");
      if (center !== state) return;
      center.reports = catalog.reports;
      center.choices = catalog.choices || {};
      renderShell();
      select(catalog.reports.some(report => report.id === wanted) ? wanted : catalog.reports[0]?.id);
    } catch (error) {
      if (center !== state) return;
      HOF.toastError(error);
      host.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }
  // Eski giriş noktası (ANLIK DURUM kutucukları, kısayollar): Raporlar penceresi "Tüm raporlar" sekmesinde açılır.
  function open(reportId = "", preset = null) {
    // Banka grubu (bank.reports; 2.2.0 ve 2.3.0 İz 3.3 raporları dahil) Finans Raporları olmadan da açılır.
    if (!HOF.can("overview.view") && !(HOF.can("bank.reports") && /^(banka-|alt-hesap-mizani$|tahsildeki-cekler$|pos-odeme-takvimi$|faturasi-beklenen-komisyonlar$|para-birimi-bazinda-bakiye$|bankalar-arasi-transfer$|kasa-banka-transfer$|cari-banka-hareketleri$|fatura-banka-hareketleri$|taksit-banka-hareketleri$)/.test(reportId))) return HOF.toast("Raporlar yalnız yönetici ve yönetici yetki verdiği kişilere açıktır.", { type: "error" });
    pending = preset && reportId ? { id: reportId, account: preset.account?.id ? { id: preset.account.id, name: preset.account.name || "" } : null, params: { ...(preset.params || {}) } } : null;
    return HOF.overview?.openReports ? HOF.overview.openReports("all", { report: reportId }) : null;
  }
  const root = () => center?.host?.querySelector("[data-rc]");
  const current = () => center.reports.find(report => report.id === center.id);

  function renderShell() {
    const node = root();
    if (!node) return;
    const groups = new Set(center.reports.map(report => report.group));
    node.innerHTML = `<aside class="hof-rc-nav">
        <div class="hof-rc-hero"><b>${center.reports.length}</b> hazır rapor<small>${groups.size} bölüm · her biri PDF ve Excel</small></div>
        <input type="search" data-rc-search placeholder="Rapor ara… (ör. kasa, çek, stok)" aria-label="Rapor ara" value="${esc(center.q)}">
        <nav data-rc-list aria-label="Raporlar"></nav>
      </aside>
      <section class="hof-rc-main" data-rc-main aria-live="polite"></section>`;
    renderNav();
  }
  function renderNav() {
    const list = root()?.querySelector("[data-rc-list]");
    if (!list) return;
    const needle = center.q.toLocaleLowerCase("tr-TR").trim();
    const hits = center.reports.filter(report => !needle || `${report.title} ${report.group} ${report.description}`.toLocaleLowerCase("tr-TR").includes(needle));
    const groups = [];
    for (const report of hits) {
      let group = groups.find(item => item.name === report.group);
      if (!group) groups.push((group = { name: report.group, items: [] }));
      group.items.push(report);
    }
    list.innerHTML = groups.length
      ? groups
          .map(
            group => `<div class="hof-rc-group"><p><span aria-hidden="true">${esc(GROUP_ICONS[group.name] || "•")}</span>${esc(group.name)}</p>${group.items
              .map(report => `<button type="button" class="hof-rc-item ${report.id === center.id ? "is-on" : ""}" data-report="${esc(report.id)}" aria-current="${report.id === center.id}">${esc(report.title)}</button>`)
              .join("")}</div>`,
          )
          .join("")
      : '<p class="hof-muted">Aranan rapor yok.</p>';
  }

  // Dönem hafızası (v2.0.20, kullanıcı: "Bu Ay"da eski kayıtlar görünmüyordu): her rapor en son seçilen dönemle açılır;
  // ilk açılışta raporun varsayılanı (çoğu raporda Bu Yıl). Tarayıcıda kişiye özel tutulur; okunamazsa varsayılan kullanılır.
  const RANGE_KEY = "hof.rc.range.v1";
  const rememberedRanges = () => {
    try {
      return JSON.parse(localStorage.getItem(RANGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };
  const rememberRange = (id, { preset = "", from = "", to = "" }) => {
    try {
      const all = rememberedRanges();
      all[id] = preset ? { preset } : { from, to };
      localStorage.setItem(RANGE_KEY, JSON.stringify(all));
    } catch {
      // gizli pencere / kapalı depolama: hafıza olmadan çalışır
    }
  };
  const initialRange = report => {
    const saved = rememberedRanges()[report.id];
    if (saved?.preset && presetsOf(report).some(([id]) => id === saved.preset)) return { preset: saved.preset, ...presetRange(saved.preset) };
    // İleriye dönük raporda hatırlanan geçmiş aralık (2.4.3'ten önceki "Geçen Ay") kullanılmaz.
    if (report.presets === "future" && saved && !saved.preset && saved.to && saved.to < todayIso()) return { preset: "all", ...presetRange("all") };
    if (saved && (saved.from || saved.to)) return { preset: "", from: saved.from || "", to: saved.to || "" };
    return { preset: report.preset || "all", ...presetRange(report.preset || "all") };
  };

  function select(id) {
    if (!center) return;
    const report = center.reports.find(item => item.id === id);
    if (!report) return;
    center.id = id;
    lastId = id;
    const params = {};
    if (report.params.includes("range")) Object.assign(params, initialRange(report));
    if (report.params.includes("planStatus")) params.planStatus = "active";
    if (report.params.includes("taskStatus")) params.taskStatus = "all";
    if (report.params.includes("payMethod")) params.payMethod = "noncash";
    if (report.params.includes("bankGroup")) params.bankGroup = "real";
    if (report.params.includes("doubtfulStatus")) params.doubtfulStatus = "open";
    if (report.id === "cek-portfoy") params.status = "open";
    center.account = null;
    if (pending && pending.id === id) {
      Object.assign(params, pending.params);
      center.account = pending.account;
    }
    pending = null;
    center.params = params;
    // 2.4.3 (C4): yer tutucu önceki sonucun yüksekliğinde (rapor değişince pencere çöküp açılmaz).
    center.holdHeight = root()?.querySelector("[data-rc-result]")?.offsetHeight || 0;
    center.preview = null;
    renderNav();
    renderMain();
    if (!needsAccount(report)) run();
  }
  // v2.0.16 (müşteri): yalnız Cari Ekstre cari ister; fatura ve öbür raporlarda cari isteğe bağlı süzgeçtir ("Tüm Cariler").
  const needsAccount = report => report.accountRequired === true && !center.account;
  const queryString = () =>
    new URLSearchParams(
      Object.fromEntries(
        Object.entries({ ...center.params, account: center.account?.id || "" })
          // Dönem düğmeleri açık tarih gönderir; yalnız "Tüm Zamanlar" ayrıca preset=all gider: vade raporları (POS Ödeme Takvimi, Çek /
          // Senet Portföyü, Taksit Vade Listesi) onunla sınırsızdır (sunucu dueRangeOf; ileri valör/vade bugünle kesilmez). Öbür raporlarda
          // açık tarih önceliklidir, sonuç değişmez.
          .filter(([key, value]) => (key !== "preset" || value === "all") && value !== "" && value !== undefined && value !== null),
      ),
    ).toString();
  function paramsHtml(report) {
    const p = center.params;
    const parts = [];
    if (report.params.includes("account")) parts.push('<div class="hof-rc-param hof-rc-account" data-account-slot></div>');
    if (report.params.includes("range")) {
      parts.push(`<div class="hof-rc-param hof-rc-range"><div class="hof-rep-presets">${presetsOf(report).map(([id, label]) => `<button type="button" class="hof-rep-chip ${p.preset === id ? "is-on" : ""}" data-preset="${id}">${esc(label)}</button>`).join("")}</div>
        <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-param="from" value="${esc(p.preset === "all" ? "" : p.from || "")}"></label>
        <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-param="to" value="${esc(p.to || "")}"></label></div>`);
    }
    for (const name of report.params) {
      if (DYNAMIC[name]) {
        const options = center.choices?.[name] || [["", "Tümü"]];
        parts.push(`<label class="hof-rc-param"><span>${esc(DYNAMIC[name])}</span><select data-param="${name}">${options.map(([value, label]) => `<option value="${esc(value)}" ${String(p[name] || "") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`);
      } else if (SELECTS[name]) {
        const spec = SELECTS[name];
        parts.push(`<label class="hof-rc-param"><span>${esc(spec.label)}</span><select data-param="${name}">${spec.options.map(([value, label]) => `<option value="${esc(value)}" ${String(p[name] || "") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`);
      } else if (CHECKS[name]) parts.push(`<label class="hof-rc-param hof-rc-check"><span class="hof-rc-check-row"><input type="checkbox" data-param="${name}" ${p[name] === "1" ? "checked" : ""}> ${esc(CHECKS[name])}</span></label>`);
      else if (name === "category") parts.push(`<label class="hof-rc-param"><span>Kategori</span><input type="text" data-param="category" value="${esc(p.category || "")}" placeholder="Tümü" maxlength="80"></label>`);
      else if (name === "tab") {
        const tabs = center.preview?.tabs || [];
        parts.push(`<label class="hof-rc-param"><span>Sekme</span><select data-param="tab"><option value="">Tüm Sekmeler</option>${tabs.map(tab => `<option value="${esc(tab)}" ${p.tab === tab ? "selected" : ""}>${esc(tab)}</option>`).join("")}</select></label>`);
      }
    }
    return parts.join("");
  }
  // Ad kolonları (v2.0.20): çok kolonlu raporlarda kişi/ürün adı "Müşteri / 01" diye ikiye kırılmasın.
  const NAME_HEADERS = new Set(["Cari", "Ad", "Kart", "Kalem", "Ürün", "Ürün / Hizmet", "Cari / Kişi", "Kimden / Kime", "Kayıt", "İlgili Cari", "Hesap Adı"]);
  // Telefon numarası da "0532 100 00 / 01" diye ikiye kırılmasın.
  const NOWRAP_HEADERS = new Set(["Telefon"]);
  // 2.4.3 (C6): banka raporlarının "Hesap" kolonu (Ziraat Bankası · Ana TL Hesabı) en çok iki satır.
  const ACCOUNT_HEADERS = new Set(["Hesap", "Banka Hesabı"]);
  const cellClass = (preview, index) =>
    preview.types[index] === "money" || preview.types[index] === "number"
      ? "num"
      : NAME_HEADERS.has(preview.headers[index])
        ? "is-name"
        : NOWRAP_HEADERS.has(preview.headers[index])
          ? "is-nowrap"
          : ACCOUNT_HEADERS.has(preview.headers[index])
            ? "is-account"
            : "";
  // TOPLAM satırı ilk bakışta görünsün (v2.0.20): tablo kutusu pencerenin görünen alanına sığacak yüksekliği alır; uzun tablo
  // kendi kutusunda kayar, TOPLAM kutunun altında sabit kalır. Sabit 50vh, süzgeç alanı uzun raporlarda (Cari Bazında Tahsilat)
  // TOPLAM'ı pencerenin altına itiyordu. Pencere içeriği zaten sığıyorsa kutu olduğu gibi kalır. Alçak ekranda (dizüstü) tabloya
  // 160 px'ten az yer kalırsa kutu küçültülmez (50vh kalır): pencere bir kez kaydırılınca tablo TOPLAM'ıyla birlikte görünür.
  // 2.4.3 (C5): eşik 280 → 160 px (başlık, süzgeç ve özet sıkılaştı): 1366×768'de kutu başlık + birkaç satır + TOPLAM'la ilk bakışta görünür.
  function fitTable() {
    const box = root()?.querySelector("[data-rc-main] .hof-rc-table");
    const frame = box?.closest(".hof-modal");
    if (!box || !frame || !frame.getClientRects().length) return;
    const note = box.nextElementSibling;
    const bottom = Math.min(frame.getBoundingClientRect().bottom, window.innerHeight) - (parseFloat(getComputedStyle(frame).paddingBottom) || 0);
    const top = box.getBoundingClientRect().top + frame.scrollTop;
    const room = bottom - top - (note ? note.offsetHeight + 12 : 0);
    box.style.maxHeight = room >= 160 ? `${Math.floor(room)}px` : "";
  }
  let fitQueued = false;
  window.addEventListener("resize", () => {
    if (fitQueued || !center) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      if (center) fitTable();
    });
  });
  // Boş sonuç (v2.0.20): dönemli raporda "Tüm Zamanlar" seçili değilse ipucu ve tek tıkla Tüm Zamanlar.
  // 2.3.0 İz 5.2: raporun kendi ipucu (sunucu emptyHint; ör. POS Ödeme Takvimi → Banka → Hareketler bağı) varsa o.
  const emptyText = report =>
    report.emptyHint
      ? `${esc(report.emptyHint.text)} ${report.emptyHint.bankTab ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-bank-tab="${esc(report.emptyHint.bankTab)}">${esc(report.emptyHint.label || "Banka")}</button>` : ""}`
      : report.params.includes("range") && center.params.preset !== "all"
      ? `Bu dönemde kayıt yok. <button type="button" class="hof-button hof-button-small hof-button-ghost" data-preset="all">Tüm Zamanları Göster</button>`
      : "Bu süzgeçte kayıt yok.";
  function renderMain() {
    const main = root()?.querySelector("[data-rc-main]");
    const report = current();
    if (!main || !report) return;
    const ready = !needsAccount(report);
    const qs = queryString();
    const preview = center.preview;
    const isNum = index => preview.types[index] === "money" || preview.types[index] === "number";
    const shown = (cell, index) => (preview.types[index] === "money" ? screenMoney(cell) : cell);
    // 2.4.3 UX24: TOPLAM satırları (yönü karışık raporda "TOPLAM Satış", "TOPLAM Alış", "Net"); eski yanıtta tek footer.
    const totals = preview ? (Array.isArray(preview.footers) && preview.footers.length ? preview.footers : preview.footer ? [preview.footer] : []) : [];
    // 2.4.3 (C4): yer tutucu (rapor değişti) önceki sonucun yüksekliğini korur — pencere çöküp açılmaz (düzen kayması yok).
    const hold = !preview && ready && center.holdHeight ? ` style="min-height:${Math.round(center.holdHeight)}px"` : "";
    const table = preview
      ? `<div class="hof-rc-summary">${(preview.summary || []).map(([label, value]) => `<span><small>${esc(label)}</small><b>${esc(screenMoney(value))}</b></span>`).join("")}</div>
        <div class="hof-rep-table hof-rc-table"><table class="hof-table"><thead><tr>${preview.headers.map((header, index) => `<th class="${isNum(index) ? "num" : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${
          preview.rows.length
            ? preview.rows.map((row, rowIndex) => `<tr${preview.rowMarks?.[rowIndex] ? ` class="is-${esc(preview.rowMarks[rowIndex])}"` : ""}>${row.map((cell, index) => `<td class="${cellClass(preview, index)}">${esc(shown(cell, index))}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${preview.headers.length}" class="hof-empty">${emptyText(report)}</td></tr>`
        }</tbody>${
          totals.length && preview.rows.length
            ? `<tfoot>${totals.map(line => `<tr class="hof-rc-total">${line.map((cell, index) => `<td class="${isNum(index) ? "num" : ""}">${esc(shown(cell, index))}</td>`).join("")}</tr>`).join("")}</tfoot>`
            : ""
        }</table></div>
        <p class="hof-rep-note">${preview.total > preview.rows.length ? `Ekranda ilk ${preview.rows.length.toLocaleString("tr-TR")} satır; tamamı (${preview.total.toLocaleString("tr-TR")} satır) PDF ve Excel'de.${totals.length ? " TOPLAM satırı bütün satırları kapsar." : ""}` : `${preview.total.toLocaleString("tr-TR")} satır.`} PDF en çok 20.000 satır yazar; Excel sınırsızdır.</p>`
      : `<p class="hof-empty"${hold}>${ready ? "Rapor hazırlanıyor…" : "Önce cariyi seçin."}</p>`;
    // 2.4.3 (C5): açıklama ilk bakışta en çok iki satır (uzun açıklama 1366×768'de tabloyu ekranın altına itiyordu); tam metin üzerine gelince
    // (ipucu) ve açıklamaya tıklayınca açılır.
    main.innerHTML = `<header class="hof-rc-head"><div><p class="hof-eyebrow">${esc(report.group)}</p><h3>${esc(preview?.title || report.title)}</h3><p class="hof-rc-desc" title="${esc(report.description)}" data-rc-desc>${esc(report.description)}</p>${preview?.subtitle ? `<small class="hof-rc-scope">${esc(preview.subtitle)}</small>` : ""}</div>
        <span class="hof-rep-export ${ready ? "" : "is-disabled"}" role="group" aria-label="Dışa aktar">
          ${HOF.outputButton({ kind: "pdf", href: ready ? `/api/workspace/report-center/${encodeURIComponent(report.id)}/pdf?${qs}` : "#", what: preview?.title || report.title, attrs: `target="_blank" rel="noopener"${ready ? "" : ' aria-disabled="true" tabindex="-1"'}` })}
          ${HOF.outputButton({ kind: "xlsx", href: ready ? `/api/workspace/report-center/${encodeURIComponent(report.id)}/xlsx?${qs}` : "#", what: preview?.title || report.title, attrs: `download${ready ? "" : ' aria-disabled="true" tabindex="-1"'}` })}
          ${(report.actions || []).map(action => `<button type="button" class="hof-button hof-button-small" data-rc-action="${esc(action.id)}">${esc(action.label)}</button>`).join("")}
        </span></header>
      ${report.params.length ? `<div class="hof-rc-params">${paramsHtml(report)}<button type="button" class="hof-button hof-button-small" data-rc-run>Ön İzle</button><span class="hof-rc-busy" data-rc-busy role="status" hidden>Güncelleniyor…</span></div>` : ""}
      <div class="hof-rc-result" data-rc-result>${table}</div>`;
    // Sonuç gelene kadar meşgul (aria-busy): ekran okuyucu ve testler eski sonucu yeni sanmaz.
    setBusy(Boolean(ready && !preview));
    const slot = main.querySelector("[data-account-slot]");
    if (slot && HOF.accounts?.picker) {
      const field = HOF.accounts.picker({ value: center.account || {}, label: report.accountRequired ? "Cari" : "Cari (Boş Bırakılırsa Tüm Cariler)", onPick: account => {
        center.account = account && account.id ? { id: account.id, name: account.name } : null;
        // 2.4.3 (C4): cari süzgeci değişince de eski sonuç yeni gelene kadar yerinde (soluk) kalır.
        if (!needsAccount(report)) run();
        else {
          center.preview = null;
          renderMain();
        }
      } });
      if (field) slot.appendChild(field);
    }
    fitTable();
  }

  /** Meşgul işareti (2.4.3 C4): [data-rc-main] aria-busy + hafif "Güncelleniyor…" yazısı; eski tablo yerinde soluk durur. */
  function setBusy(on) {
    const main = root()?.querySelector("[data-rc-main]");
    if (!main) return;
    main.setAttribute("aria-busy", on ? "true" : "false");
    main.classList.toggle("is-loading", on);
    const badge = main.querySelector("[data-rc-busy]");
    if (badge) badge.hidden = !on;
  }
  /** Süzgeç değişince sonuç gelmeden önce: dönem düğmeleri, tarih alanları ve dışa aktarma bağları yeni süzgeci gösterir (tablo yerinde). */
  function syncControls(report) {
    const main = root()?.querySelector("[data-rc-main]");
    if (!main) return;
    const p = center.params;
    main.querySelectorAll(".hof-rc-range [data-preset]").forEach(chip => chip.classList.toggle("is-on", chip.dataset.preset === p.preset));
    const from = main.querySelector('[data-param="from"]');
    const to = main.querySelector('[data-param="to"]');
    if (from) from.value = p.preset === "all" ? "" : p.from || "";
    if (to) to.value = p.to || "";
    const qs = queryString();
    for (const [kind, ext] of [["is-pdf", "pdf"], ["is-xlsx", "xlsx"]]) {
      const link = main.querySelector(`.hof-rep-out.${kind}`);
      if (link && !link.hasAttribute("aria-disabled")) link.setAttribute("href", `/api/workspace/report-center/${encodeURIComponent(report.id)}/${ext}?${qs}`);
    }
  }
  // quiet (v2.0.11, canlı yenileme): ön izleme "Yükleniyor"a düşmeden yerinde tazelenir.
  // 2.4.3 (C4): süzgeç / dönem değişiminde de tablo kaldırılmaz (yanıp sönme ve düzen kayması yoktu): eski sonuç soluk durur, "Güncelleniyor…"
  // görünür, yeni sonuç gelince yerine yazılır. Rapor değişince (select) önceki rapor gösterilmez; yer tutucu önceki yüksekliği korur. Geç gelen
  // eski yanıt (ticket) yeni sonucu ezmez.
  async function run({ quiet = false } = {}) {
    if (!center) return;
    const report = current();
    if (!report || needsAccount(report)) return renderMain();
    const ticket = (center.ticket = (center.ticket || 0) + 1);
    const stale = Boolean(center.preview && center.preview.id === report.id);
    if (!quiet && stale) {
      syncControls(report);
      setBusy(true);
    } else if (!quiet || !center.preview) {
      center.preview = null;
      renderMain();
    }
    try {
      const preview = await HOF.api(`/api/workspace/report-center/${encodeURIComponent(report.id)}?${queryString()}`);
      if (!center || ticket !== center.ticket) return;
      center.preview = preview;
      center.holdHeight = 0;
      renderMain();
    } catch (error) {
      if (!center || ticket !== center.ticket) return;
      HOF.toastError(error);
      // Eski sonuç yeni süzgecin sonucu sanılmasın: yer tutucuda hata yazılır.
      center.preview = null;
      center.holdHeight = 0;
      renderMain();
      setBusy(false);
      const main = root()?.querySelector("[data-rc-main] .hof-empty");
      if (main) main.textContent = error.message;
    }
  }
  function onClick(event) {
    const desc = event.target.closest?.("[data-rc-desc]");
    if (desc) return desc.classList.toggle("is-open");
    const target = event.target.closest("button, a");
    if (!target || !center) return;
    if (target.matches(".hof-rep-out[aria-disabled]")) {
      event.preventDefault();
      return HOF.toast("Önce cariyi seçin.", { type: "error" });
    }
    if (target.dataset.report) return select(target.dataset.report);
    // 2.4.3 MM3: raporun iş düğmesi (sunucu katalogda yalnız yetkiliye verir) — KDV Özeti → KDV Mahsup Fişi Oluştur; pencere kapanınca rapor yenilenir.
    if (target.dataset.rcAction === "vat-offset") return HOF.vatOffset?.({ onDone: () => run() });
    if (target.dataset.bankTab) return HOF.bank?.open ? HOF.bank.open({ tab: target.dataset.bankTab }) : null;
    if (target.dataset.preset) {
      Object.assign(center.params, { preset: target.dataset.preset }, presetRange(target.dataset.preset));
      rememberRange(center.id, center.params);
      return run();
    }
    if (target.hasAttribute("data-rc-run")) {
      const main = root().querySelector("[data-rc-main]");
      const from = main.querySelector('[data-param="from"]')?.value;
      const to = main.querySelector('[data-param="to"]')?.value;
      if (from && to && from > to) return HOF.toast("Başlangıç tarihi bitiş tarihinden sonra olamaz.", { type: "error" });
      if (from !== undefined) {
        // Tüm Zamanlar seçiliyken Başlangıç boş kalır (2.3.0 İz 5.2: "1976" görünmez); boş bırakılıp Ön İzle denince aralık yine Tüm Zamanlar.
        if (!from && center.params.preset === "all") Object.assign(center.params, { to: to || presetRange("all").to });
        else Object.assign(center.params, { from: from || "", to: to || "", preset: "" });
        rememberRange(center.id, center.params);
      }
      const category = main.querySelector('[data-param="category"]');
      if (category) center.params.category = category.value.trim();
      return run();
    }
  }
  function onChange(event) {
    const name = event.target.dataset.param;
    if (!name || !center) return;
    if (name === "from" || name === "to") return; // tarih "Ön izle" ile uygulanır (yazarken rapor tekrar tekrar hazırlanmasın)
    if (name === "category") return;
    center.params[name] = event.target.type === "checkbox" ? (event.target.checked ? "1" : "") : event.target.value;
    run();
  }

  // Para/stok/cari/taksit/çek değişince açık ön izleme yenilenir (işlem bu ekranda ya da başka bilgisayarda).
  // v2.0.22: başka bilgisayardaki değişikliklerde birleştirilerek (en sık 2 sn'de bir; HOF.refresher).
  HOF.whenReady(() => {
    const previewSoon = HOF.refresher(() => (center?.host?.isConnected && center.preview ? run({ quiet: true }) : null), { delay: 400, gap: 2000 });
    HOF.onLedger(["cash", "accounts", "plans", "stock", "cheques", "bank", "invoices"], detail => (detail?.local ? previewSoon.now() : previewSoon()), 400);
  });
  HOF.reportCenter = { open, mount };
})();
