/* DestekOfis — ANLIK DURUM kokpiti ve Rapor Al (v2.0.7).
 * Ana ekranın başlık satırında, işletmenin anlık nabzını gösteren kart: Kasa / Banka, Kritik stok, Toplam alacak,
 * Toplam borç. Rakamlar sunucuda ilgili ekranın kendi hesabından gelir (server/routes/overview.mjs); bir hareket
 * girildiğinde (bu bilgisayardan ya da başkasından) sunucu "overview.changed" olayı yayımlar, kart kendini yeniler.
 * Köşedeki simge kartı tek satırlık özet şeridine küçültür; "Rapor Al" iki halde de yerinde durur. Tercih kişiye özel
 * hatırlanır. Kart ve raporlar yalnız yöneticiye ve yöneticinin kişiye özel yetki verdiği kişilere açılır.
 * Raporlar penceresi (v2.0.9'dan beri tek pencere: ANLIK DURUM'daki "Rapor Al" ve sol menüdeki "Raporlar" aynı yeri
 * açar): Cari ekstre (mizan → carinin ekstresi), Vade takip (taksit, çek/senet, ileri tarihli Kasa, tablodaki ödeme
 * günleri), Nakit akış (grafikli projeksiyon), Çek / Senet portföyü, Tablo raporları (hof-reports.js); "Detaylı
 * raporlar" pili rapor merkezini açar (hof-report-center.js). Defter sekmeleri ANLIK DURUM yetkisiyle; Vade takip ve
 * Tablo raporları rapor yetkisiyle de (yönetici, uzman) açılır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let data = null;
  let request = 0;
  let loadedAt = 0;
  let live = true;

  // ---------- Biçim ----------
  const money = value => HOF.formatMoney(value);
  // Büyük rakamda kuruş küçük ve soluk yazılır (okunur ve şık): ₺184.250<small>,00</small>.
  const COMPACT_MONEY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", notation: "compact", maximumFractionDigits: 1 });
  const SHORT_MONEY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  const COMPACT_NUMBER = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
  const moneyHtml = (value, { compact = false } = {}) => {
    const number = Number(value) || 0;
    if (compact && Math.abs(number) >= 10_000_000) {
      const text = COMPACT_MONEY.format(number);
      return `<span class="hof-num">${esc(text)}</span>`;
    }
    const text = money(number);
    const cut = text.lastIndexOf(",");
    return cut > 0 ? `<span class="hof-num">${esc(text.slice(0, cut))}<small>${esc(text.slice(cut))}</small></span>` : `<span class="hof-num">${esc(text)}</span>`;
  };
  // v2.0.13: Kasa / Banka kartında yola göre dağılım (yalnız nakitten başka yol kullanıldıysa gösterilir).
  const methodLine = by => (by && (Math.abs(by.bank) > 0.005 || Math.abs(by.card) > 0.005) ? `<br>Nakit ${esc(shortMoney(by.cash))} · Banka ${esc(shortMoney(by.bank))} · Kart ${esc(shortMoney(by.card))}` : "");
  const shortMoney = value => SHORT_MONEY.format(Number(value) || 0);
  const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const clock = iso => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };
  // v2.0.10: ANLIK DURUM kartı yalnız yönetici ekranında (overview.card). Finans raporları (overview.view) kişiye
  // verilebilir; yalnız Raporlar penceresini açar.
  const canCard = () => HOF.can("overview.card");
  const canSee = () => HOF.can("overview.view");
  // Raporlar penceresi: finans raporları yetkisi (tüm sekmeler) ya da rapor yetkisi (Vade takip ve Tablo raporları).
  const canReports = () => canSee() || HOF.can("reports.view");
  const collapsedKey = () => `hof.pulse.collapsed.${HOF.user?.id || ""}`;
  const isCollapsed = () => {
    try {
      return localStorage.getItem(collapsedKey()) === "1";
    } catch {
      return false;
    }
  };
  const setCollapsed = value => {
    try {
      localStorage.setItem(collapsedKey(), value ? "1" : "0");
    } catch {
      // tarayıcı depolamaya izin vermiyorsa tercih yalnız bu oturumda geçerli
    }
  };

  const ICONS = {
    cash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/></svg>',
    stock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>',
    in: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6.5 10.5 12 16l5.5-5.5"/><path d="M4.5 20h15"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6.5 9.5 12 4l5.5 5.5"/><path d="M4.5 20h15"/></svg>',
    report: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
    expand: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  };

  // ---------- Kart ----------
  function tiles() {
    const out = [];
    if (data.cash) {
      const t = data.cash.today;
      const moved = t.in || t.out;
      out.push({
        id: "cash",
        icon: ICONS.cash,
        label: "Kasa / Banka",
        value: moneyHtml(data.cash.balance, { compact: true }),
        tone: data.cash.balance < 0 ? "is-bad" : "",
        sub: `${moved ? `Bugün <b class="hof-pulse-up">+${esc(shortMoney(t.in))}</b> · <b class="hof-pulse-down">−${esc(shortMoney(t.out))}</b>` : "Bugün hareket yok"}${methodLine(data.cash.byMethod)}${data.cash.futureEntries ? `<br><span class="hof-pulse-flag">${ICONS.warn}${data.cash.futureEntries} ileri tarihli hareket hariç</span>` : ""}`,
        title: `Bugüne kadarki kasa: ${money(data.cash.balance)}.${data.cash.futureEntries ? ` İleri tarihli ${data.cash.futureEntries} hareketle birlikte ${money(data.cash.allEntries)} (Kasa ekranındaki "tüm hareketler").` : ""} Bu ay giriş ${money(data.cash.month.in)}, çıkış ${money(data.cash.month.out)}.`,
      });
    }
    if (data.stock) {
      const s = data.stock;
      out.push({
        id: "stock",
        icon: ICONS.stock,
        label: "Kritik Stok",
        value: `<span class="hof-num">${s.critical.toLocaleString("tr-TR")}</span><em>${s.critical === 1 ? "ürün" : "ürün"}</em>`,
        tone: s.critical ? "is-warn" : "",
        sub: s.products ? `${s.out ? `<span class="hof-pulse-flag">${ICONS.warn}${s.out.toLocaleString("tr-TR")} tükendi</span> · ` : ""}${s.products.toLocaleString("tr-TR")} ürün takipte` : "Stok kartı yok",
        title: `Kritik seviyenin altındaki ürün sayısı (hizmet kalemleri hariç). Stok değeri ${money(s.value)}.`,
      });
    }
    if (data.receivable) {
      const r = data.receivable;
      out.push({
        id: "receivable",
        icon: ICONS.in,
        label: "Toplam Alacak",
        value: moneyHtml(r.total, { compact: true }),
        sub: `Cari <b>${esc(shortMoney(r.accounts))}</b> · Çek <b>${esc(shortMoney(r.cheques))}</b>${r.overdue > 0.005 ? `<br><span class="hof-pulse-flag is-late">${ICONS.warn}${esc(shortMoney(r.overdue))} gecikmiş taksit</span>` : ""}`,
        title: `Carilerin bize borcu (${money(r.accounts)}) + portföydeki alınan çek/senet (${money(r.cheques)}).`,
      });
    }
    if (data.payable) {
      const p = data.payable;
      out.push({
        id: "payable",
        icon: ICONS.out,
        label: "Toplam Borç / Ödemeler",
        value: moneyHtml(p.total, { compact: true }),
        sub: `Cari <b>${esc(shortMoney(p.accounts))}</b> · Çek <b>${esc(shortMoney(p.cheques))}</b>${p.chequesDue > 0.005 ? `<br><span class="hof-pulse-flag">${ICONS.warn}${esc(shortMoney(p.chequesDue))} çek 7 gün içinde</span>` : ""}`,
        title: `Tedarikçilere borcumuz (${money(p.accounts)}) + ödenecek verilen çek/senet (${money(p.cheques)}).`,
      });
    }
    return out;
  }
  const miniLine = () =>
    [
      data.cash ? `<span>Kasa <b>${esc(shortMoney(data.cash.balance))}</b></span>` : "",
      data.receivable ? `<span>Alacak <b>${esc(shortMoney(data.receivable.total))}</b></span>` : "",
      data.payable ? `<span>Borç <b>${esc(shortMoney(data.payable.total))}</b></span>` : "",
      data.stock ? `<span class="${data.stock.critical ? "is-warn" : ""}">Kritik Stok <b>${data.stock.critical}</b></span>` : "",
    ]
      .filter(Boolean)
      .join('<i aria-hidden="true">·</i>');

  function cardNode() {
    let node = document.getElementById("hof-pulse");
    if (!node) {
      node = HOF.el("section", { id: "hof-pulse", class: "hof-pulse", "aria-label": "Anlık durum" });
      node.addEventListener("click", onCardClick);
    }
    return node;
  }
  function render() {
    const welcome = document.querySelector(".main-shell .content-wrap > .welcome-row");
    const existing = document.getElementById("hof-pulse");
    if (!welcome || !canCard() || !data) {
      existing?.remove();
      return;
    }
    const node = cardNode();
    const collapsed = isCollapsed();
    node.classList.toggle("is-collapsed", collapsed);
    node.classList.toggle("is-offline", !live);
    const list = tiles();
    node.style.setProperty("--hof-pulse-count", String(list.length || 1));
    // v2.0.14: canlı yenileme kartı yeniden kurarken odaklı kutu (klavyeyle gezen kullanıcı) korunur.
    HOF.swap(node, `<header class="hof-pulse-head">
        <span class="hof-pulse-title"><i class="hof-pulse-dot" aria-hidden="true"></i>ANLIK DURUM</span>
        <span class="hof-pulse-time" title="${live ? "Canlı: her giriş ve çıkışta kendiliğinden yenilenir" : "Sunucuya bağlanılamıyor; bağlantı gelince yenilenir"}">${live ? `canlı · ${esc(clock(data.at))}` : "bağlantı bekleniyor"}</span>
        <span class="hof-pulse-mini" aria-hidden="${collapsed ? "false" : "true"}">${miniLine()}</span>
        <button type="button" class="hof-pulse-report" data-pulse="report">${ICONS.report}<span>Rapor Al</span></button>
        <button type="button" class="hof-pulse-toggle" data-pulse="toggle" aria-expanded="${collapsed ? "false" : "true"}" title="${collapsed ? "Kartı büyüt" : "Kartı küçült"}" aria-label="${collapsed ? "Anlık durum kartını büyüt" : "Anlık durum kartını küçült"}">${collapsed ? ICONS.expand : ICONS.collapse}</button>
      </header>
      <div class="hof-pulse-body"><div class="hof-pulse-grid">${list
        .map(
          tile => `<button type="button" class="hof-pulse-tile ${tile.tone || ""}" data-pulse-go="${tile.id}" title="${esc(tile.title)}">
            <span class="hof-pulse-label"><i aria-hidden="true">${tile.icon}</i><span>${esc(tile.label)}</span></span>
            <strong class="hof-pulse-value">${tile.value}</strong>
            <small class="hof-pulse-sub">${tile.sub}</small>
          </button>`,
        )
        .join("")}</div></div>`);
    place(welcome, node);
  }
  // Yer: başlık satırının sağı (başlık ile "Dışa aktar" arası). Dar ekranda satır kırılır, kart başlığın altına iner.
  function place(welcome, node) {
    const actions = [...welcome.children].filter(child => child !== node).at(-1);
    const first = welcome.firstElementChild === node ? node.nextElementSibling : welcome.firstElementChild;
    welcome.classList.add("hof-has-pulse");
    if (actions && actions !== first) {
      if (node.nextElementSibling !== actions || node.parentNode !== welcome) welcome.insertBefore(node, actions);
    } else if (node.parentNode !== welcome || welcome.lastElementChild !== node) welcome.appendChild(node);
  }
  function onCardClick(event) {
    const button = event.target.closest("[data-pulse], [data-pulse-go]");
    if (!button) return;
    if (button.dataset.pulse === "toggle") {
      setCollapsed(!isCollapsed());
      render();
      document.querySelector("#hof-pulse [data-pulse='toggle']")?.focus();
      return;
    }
    if (button.dataset.pulse === "report") return openReports();
    const go = button.dataset.pulseGo;
    // Yetkisi olmayan ekrana gitmez: Kasa yetkisi olmayan kişi Kasa yerine kasa raporunu görür.
    if (go === "cash") HOF.can("cash.view") ? document.querySelector('#hof-sidecard [data-action="cash"]')?.click() : HOF.reportCenter?.open("kasa-hareketleri");
    else if (go === "stock") HOF.stock?.open();
    else if (go === "receivable") HOF.accounts?.open();
    else if (go === "payable") (HOF.cheques && HOF.can("cheques.view") ? HOF.cheques.open({ direction: "out" }) : HOF.accounts?.open());
  }

  async function load() {
    if (!canCard()) {
      data = null;
      render();
      return;
    }
    const ticket = ++request;
    try {
      const result = await HOF.api("/api/workspace/overview");
      if (ticket !== request) return;
      data = result;
      loadedAt = Date.now();
      render();
      HOF.emit("overview", data);
    } catch (error) {
      if (error?.status === 403) {
        data = null;
        render();
      }
    }
  }
  const reloadSoon = (() => {
    let timer = 0;
    return (delay = 250) => {
      clearTimeout(timer);
      timer = setTimeout(load, delay);
    };
  })();

  // ---------- Rapor Al ----------
  const PRESETS_PAST = [
    ["thisMonth", "Bu Ay"],
    ["lastMonth", "Geçen Ay"],
    ["last30", "Son 30 Gün"],
    ["thisYear", "Bu Yıl"],
    ["all", "Tüm Zamanlar"],
  ];
  // Vade takip: gecikmiş kalemler her aralıkta başta listelenir ("Gecikmişleri de göster" kapatılmadıkça).
  const PRESETS_DUE = [
    ["late", "Gecikmiş"],
    ["today", "Bugün"],
    ["next7", "7 Gün"],
    ["next30", "30 Gün"],
    ["next90", "90 Gün"],
    ["open", "Tüm Açık"],
  ];
  const SOURCE_LABELS = { plan: "Taksit", cheque: "Çek", note: "Senet", cash: "Kasa", table: "Tablo", promise: "Ödeme sözü", deadline: "Son tarih" };
  const SOURCE_HINTS = {
    plan: "Taksit kartlarının kalan taksitleri",
    cheque: "Portföydeki alınan ve ödenecek verilen çekler",
    note: "Portföydeki alınan ve ödenecek verilen senetler",
    cash: "Kasa'ya ileri tarihle girilen giriş ve çıkışlar (kira, maaş…)",
    table: "Excel/Sheets tablolarındaki ödeme günleri (tahsilat takvimiyle aynı kalemler)",
    promise: "Tablolarda yazılı ödeme sözleri",
    deadline: "Tablolardaki son tarihler (sözleşme, sigorta, belge bitişi…); tutarı yoktur",
  };
  const PRESETS_FUTURE = [
    ["next7", "7 Gün"],
    ["next30", "30 Gün"],
    ["next60", "60 Gün"],
    ["next90", "90 Gün"],
  ];
  // "Tüm zamanlar" aralığının başı (50 yıl önce) ekranda tarih olarak yazılmaz (sunucudaki isAllTimeStart ile aynı kural).
  const allTimeStart = from => Boolean(from) && from <= presetRange("all").from;
  const presetRange = (preset, today = todayIso()) => {
    const [y, m, d] = today.split("-").map(Number);
    const iso = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
    const add = days => iso(y, m, d + days);
    return (
      {
        next7: { from: today, to: add(7) },
        next30: { from: today, to: add(30) },
        next60: { from: today, to: add(60) },
        next90: { from: today, to: add(90) },
        thisMonth: { from: iso(y, m, 1), to: iso(y, m + 1, 0) },
        lastMonth: { from: iso(y, m - 1, 1), to: iso(y, m, 0) },
        thisYear: { from: iso(y, 1, 1), to: iso(y, 12, 31) },
        last30: { from: add(-30), to: today },
        all: { from: iso(y - 50, 1, 1), to: today },
        late: { from: "", to: add(-1) },
        today: { from: today, to: today },
        open: { from: "", to: "" },
      }[preset] || null
    );
  };
  // Sekmeler ve görme koşulları (sunucudaki uç yetkisiyle aynı): defter raporları ANLIK DURUM yetkisiyle; Vade takip
  // ANLIK DURUM ya da rapor yetkisiyle; Çek / Senet portföyü ayrıca çek yetkisiyle; Tablo raporları rapor yetkisiyle.
  const TABS = [
    ["mizan", "Cari Ekstre", "Cari mizanı; satıra tıklayınca o carinin ekstresi (Cari kartındaki defterle aynı)", () => canSee()],
    ["vade", "Vade Takip", "Vadesi olan her açık kalem: taksit, çek/senet, ileri tarihli Kasa, tablodaki ödeme günleri", () => canReports()],
    ["flow", "Nakit Akış", "Bugünkü kasadan başlayan tahmini kasa: beklenen giriş ve çıkışlar", () => canSee()],
    ["cheques", "Çek / Senet", "Alınan ve verilen evrak portföyü", () => canSee() && HOF.can("cheques.view")],
    // İşlem geçmişi yetkisi olan (uzman) finans yetkisi olmasa da burada yalnız "İşlem geçmişi" raporunu görür (v2.0.10).
    ["all", "Tüm Raporlar", "Kasa, Cari, Taksit, Çek/Senet, Stok ve kayıt raporları: ön izleme, PDF ve Excel", () => canSee() || HOF.can("audit.view")],
    ["table", "Tablo Raporları", "Yalnız Excel/Sheets tablolarındaki tutar ve tarihlerden", () => HOF.can("reports.view")],
  ];
  const tabsFor = () => TABS.filter(([, , , visible]) => visible());
  // Kendi süzgeci ve dışa aktarması olan sekmeler: "Tüm raporlar" (hof-report-center.js), "Tablo raporları" (hof-reports.js).
  const PANE_TABS = new Set(["all", "table"]);
  let report = null; // açık Rapor Al penceresinin durumu

  const rangeBar = (state, presets) => `<div class="hof-rep-range" role="group" aria-label="Tarih aralığı">
      <div class="hof-rep-presets">${presets.map(([id, label]) => `<button type="button" class="hof-rep-chip ${state.preset === id ? "is-on" : ""}" data-preset="${id}">${esc(label)}</button>`).join("")}</div>
      <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-range="from" value="${esc(state.preset === "all" ? "" : state.from)}"${state.preset === "all" ? ' title="Tüm zamanlar: ilk hareketten bugüne"' : ""}></label>
      <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-range="to" value="${esc(state.to)}"></label>
      <button type="button" class="hof-button hof-button-small" data-run>Raporu Getir</button>
    </div>`;
  const exportButtons = (pdf, xlsx) => `<span class="hof-rep-export" role="group" aria-label="Dışa aktar">
      <a class="hof-rep-out is-pdf" href="${esc(pdf)}" target="_blank" rel="noopener" title="PDF olarak aç; oradan kaydedin ya da yazdırın">${ICONS.report}PDF İndir</a>
      <a class="hof-rep-out is-xlsx" href="${esc(xlsx)}" download title="Excel dosyası olarak indir"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9h17M3.5 14.5h17M9 3.5v17"/></svg>Excel İndir</a>
    </span>`;
  const statTiles = items => `<div class="hof-rep-stats">${items
    .filter(Boolean)
    .map(item => `<div class="hof-rep-stat ${item.tone || ""}"><span>${esc(item.label)}</span><strong>${item.html || esc(item.value)}</strong>${item.help ? `<small>${item.help}</small>` : ""}</div>`)
    .join("")}</div>`;

  // options.report: "Tüm raporlar" sekmesinde açılacak rapor (ör. ANLIK DURUM'da Kasa kutusu → kasa hareketleri).
  function openReports(tab = "", options = {}) {
    if (!tabsFor().length) return HOF.toast("Raporlar yönetici ve uzman hesapları ile yöneticinin finans raporları yetkisi verdiği kişiler içindir.", { type: "error" });
    const allowed = tabsFor().map(([id]) => id);
    const wanted = allowed.includes(tab) ? tab : allowed[0];
    if (report?.modal) {
      report.tab = wanted;
      if (options.report) report.all.report = options.report;
      renderReport();
      if (!state().data && !PANE_TABS.has(wanted)) run();
      return report.modal;
    }
    const today = todayIso();
    report = {
      tab: wanted,
      mizan: { preset: "thisMonth", ...presetRange("thisMonth", today), type: "", side: "", idle: false, q: "", account: null, data: null },
      vade: { preset: "next30", ...presetRange("next30", today), direction: "", sources: [], q: "", late: true, data: null },
      flow: { preset: "next30", ...presetRange("next30", today), overdue: false, table: true, group: "", data: null },
      cheques: { direction: "", status: "open", from: "", to: "", preset: "", data: null },
      table: { data: null },
      all: { report: options.report || "", data: null },
    };
    report.modal = HOF.modal({
      title: "Raporlar",
      eyebrow: canSee() ? "CARİ · VADE · NAKİT · ÇEK/SENET" : "VADE · TABLOLAR",
      size: "report",
      body: '<div class="hof-rep" data-rep></div>',
      onClose: () => {
        report = null;
      },
    });
    report.modal.dialog.addEventListener("click", onReportClick);
    report.modal.dialog.addEventListener("change", onReportChange);
    report.modal.dialog.addEventListener("keydown", event => {
      if (event.key === "Enter" && event.target.matches("[data-q]")) {
        event.preventDefault();
        state().q = event.target.value.trim();
        run();
      } else if (event.key === "Enter" && event.target.matches("[data-due-row], [data-dormant-row], [data-account-row], [data-cheque-row]")) {
        event.preventDefault();
        event.target.click();
      }
    });
    renderReport();
    if (!PANE_TABS.has(report.tab)) run();
    return report.modal;
  }
  const root = () => report?.modal?.dialog.querySelector("[data-rep]");
  const state = () => report[report.tab];
  const query = (params = {}) => new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== false))).toString();

  function renderReport() {
    const node = root();
    if (!node) return;
    const s = state();
    const tabBar = `<div class="hof-rep-top"><div class="hof-rep-tabs" role="tablist">${tabsFor().map(([id, label, hint]) => `<button type="button" role="tab" class="hof-rep-tab ${report.tab === id ? "is-on" : ""} ${id === "all" ? "is-all" : ""}" aria-selected="${report.tab === id}" data-tab="${id}" title="${esc(hint)}">${id === "all" ? ICONS.spark : ""}${esc(label)}</button>`).join("")}</div></div>`;
    if (report.tab === "all") {
      // Rapor merkezi: modül modül hazır raporlar (Kasa, Cari, Taksit, Çek/Senet, Stok, kayıtlar), ön izleme, PDF ve Excel.
      node.innerHTML = `${tabBar}<div class="hof-rep-allpane" data-all-pane></div>`;
      const pane = node.querySelector("[data-all-pane]");
      if (HOF.reportCenter?.mount) HOF.reportCenter.mount(pane, report.all.report || "");
      else pane.innerHTML = '<p class="hof-empty">Rapor merkezi yüklenemedi; sayfayı yenileyin.</p>';
      report.all.report = "";
      return;
    }
    if (report.tab === "table") {
      // Tablo raporları kendi süzgeç ve dışa aktarmasıyla (hof-reports.js); sekme her açılışta yeniden kurulur.
      node.innerHTML = `${tabBar}<div class="hof-rep-tablepane" data-table-pane></div>`;
      if (HOF.tableReports?.mount) HOF.tableReports.mount(node.querySelector("[data-table-pane]"));
      else node.querySelector("[data-table-pane]").innerHTML = '<p class="hof-empty">Tablo raporları yüklenemedi; sayfayı yenileyin.</p>';
      return;
    }
    let content = "";
    if (report.tab === "mizan") content = mizanView(s);
    else if (report.tab === "vade") content = vadeView(s);
    else if (report.tab === "flow") content = flowView(s);
    else content = chequeView(s);
    HOF.swap(node, tabBar + content);
    if (report.tab === "flow" && s.data) wireChart(node.querySelector("[data-chart]"), s.data);
  }

  // --- Mizan ve ekstre ---
  function mizanView(s) {
    const params = { from: s.from, to: s.to, type: s.type, side: s.side, idle: s.idle ? "1" : "", q: s.q };
    const ekstre = s.account ? { account: s.account.id, from: s.from, to: s.to } : null;
    const pdf = ekstre ? `/api/workspace/overview/ekstre.pdf?${query(ekstre)}` : `/api/workspace/overview/mizan.pdf?${query(params)}`;
    const xlsx = ekstre ? `/api/workspace/overview/ekstre.xlsx?${query(ekstre)}` : `/api/workspace/overview/mizan.xlsx?${query(params)}`;
    const filters = `<div class="hof-rep-bar">${rangeBar(s, PRESETS_PAST)}${exportButtons(pdf, xlsx)}</div>
      ${s.account ? "" : `<div class="hof-rep-filters"><input type="search" data-q value="${esc(s.q)}" placeholder="Cari adı, cari no ya da telefon ara…" aria-label="Cari ara"><select data-field="type" aria-label="Cari türü"><option value="">Tüm Cariler</option><option value="customer" ${s.type === "customer" ? "selected" : ""}>Müşteriler</option><option value="supplier" ${s.type === "supplier" ? "selected" : ""}>Tedarikçiler</option><option value="other" ${s.type === "other" ? "selected" : ""}>Diğer</option></select><select data-field="side" aria-label="Bakiye">${[["", "Tüm Bakiyeler"], ["debtor", "Borçlular"], ["creditor", "Alacaklılar"], ["nonzero", "Sadece Bakiyesi Olanlar"]].map(([value, label]) => `<option value="${value}" ${s.side === value ? "selected" : ""}>${label}</option>`).join("")}</select><label class="hof-rep-check"><input type="checkbox" data-field="idle" ${s.idle ? "checked" : ""}> Hareketsiz carileri de göster</label></div>`}`;
    if (!s.data) return `${filters}<p class="hof-empty">Rapor hazırlanıyor…</p>`;
    if (s.account && s.data.lines) {
      const d = s.data;
      const mark = value => `${esc(money(Math.abs(value)))}<small class="hof-rep-side">${value > 0.005 ? "B" : value < -0.005 ? "A" : ""}</small>`;
      return `${filters}<div class="hof-rep-crumb"><button type="button" class="hof-plan-back" data-back>← Mizan</button><h3>${esc(d.account.name)} <small>${d.account.refNo ? `Cari No ${esc(d.account.refNo)} · ` : ""}ekstre · ${allTimeStart(d.from) ? `tüm hareketler, ${esc(HOF.formatDate(d.to))} tarihine kadar` : `${esc(HOF.formatDate(d.from))} – ${esc(HOF.formatDate(d.to))}`}</small></h3><button type="button" class="hof-button hof-button-small hof-button-ghost" data-open-account="${esc(d.account.id)}" title="Cari kartını aç: hareket gir, taksit ve çek/senetlerini gör">Cari Kartını Aç</button></div>
        ${statTiles([{ label: "Devir", html: moneyHtml(d.opening) }, { label: "Dönem Borç", html: moneyHtml(d.debit) }, { label: "Dönem Alacak", html: moneyHtml(d.credit) }, { label: "Dönem Sonu", html: moneyHtml(Math.abs(d.closing)), help: d.closing > 0.005 ? "Borçlu" : d.closing < -0.005 ? "Alacaklı" : "Kapalı", tone: d.closing > 0.005 ? "is-receivable" : d.closing < -0.005 ? "is-payable" : "" }])}
        <div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th></tr></thead><tbody>
        <tr class="is-opening"><td>${allTimeStart(d.from) ? "" : esc(HOF.formatDate(d.from))}</td><td><b>Devir</b></td><td>Dönem başı bakiye</td><td></td><td></td><td class="num">${mark(d.opening)}</td></tr>
        ${d.lines.map(line => `<tr><td>${esc(HOF.formatDate(line.date))}</td><td><b>${esc(line.label)}</b></td><td>${esc(line.note || "")}${line.receiptNo ? ` <span class="hof-plan-receipt">Makbuz ${esc(line.receiptNo)}</span>` : ""}</td><td class="num">${line.debit ? esc(money(line.debit)) : ""}</td><td class="num">${line.credit ? esc(money(line.credit)) : ""}</td><td class="num">${mark(line.balance)}</td></tr>`).join("") || '<tr><td colspan="6" class="hof-empty">Bu aralıkta hareket yok.</td></tr>'}
        </tbody></table></div><p class="hof-rep-note">B: borçlu · A: alacaklı. Satırlar Cari kartındaki defterle aynıdır.</p>`;
    }
    const d = s.data;
    const rows = d.rows.map(row => `<tr data-account-row="${esc(row.id)}" tabindex="0" title="Ekstreyi aç"><td class="hof-plan-no">${esc(row.refNo || "")}</td><td><b>${esc(row.name)}</b>${row.groupName ? `<small>${esc([row.groupName, row.subgroupName].filter(Boolean).join(" › "))}</small>` : ""}</td><td>${esc({ customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" }[row.type] || "")}</td><td class="num">${esc(money(row.opening))}</td><td class="num">${row.debit ? esc(money(row.debit)) : ""}</td><td class="num">${row.credit ? esc(money(row.credit)) : ""}</td><td class="num"><b class="hof-acc-balance is-${row.side === "debtor" ? "debtor" : row.side === "creditor" ? "creditor" : "zero"}">${esc(money(Math.abs(row.closing)))}</b></td><td><span class="hof-plan-badge ${row.side === "debtor" ? "is-done" : row.side === "creditor" ? "is-late" : "is-muted"}">${row.side === "debtor" ? "Borçlu" : row.side === "creditor" ? "Alacaklı" : "Kapalı"}</span></td></tr>`).join("");
    return `${filters}
      ${statTiles([{ label: "Cari", value: d.totals.count.toLocaleString("tr-TR") }, { label: "Dönem Borç", html: moneyHtml(d.totals.debit) }, { label: "Dönem Alacak", html: moneyHtml(d.totals.credit) }, { label: "Borçlular", html: moneyHtml(d.totals.closingDebtor), tone: "is-receivable" }, { label: "Alacaklılar", html: moneyHtml(d.totals.closingCreditor), tone: "is-payable" }])}
      <div class="hof-rep-table"><table class="hof-table hof-rep-mizan"><thead><tr><th>No</th><th>Cari</th><th>Tür</th><th class="num">Devir</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th>Durum</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="hof-empty">${d.accountCount ? (s.q || s.type ? "Bu aramaya uyan, bu aralıkta hareketi olan cari yok." : "Bu aralıkta hareketi ya da devreden bakiyesi olan cari yok. “Hareketsiz carileri de göster” ile tümü listelenir; daha geniş aralık için “Tüm zamanlar”.") : "Henüz cari yok."}</td></tr>`}</tbody></table></div>
      ${!rows && !d.accountCount ? emptyLedgerHelp() : ""}
      ${d.hasMore ? `<p class="hof-rep-note">Ekranda ilk ${d.rows.length.toLocaleString("tr-TR")} cari; tamamı (${d.total.toLocaleString("tr-TR")}) PDF ve Excel'de.</p>` : ""}
      <p class="hof-rep-note">Bir satıra tıklayın: o carinin aynı aralıktaki ekstresi açılır. Devir: başlangıç tarihinden önceki bakiye.</p>`;
  }

  // Cari defteri boşken: rapor Cari ekranındaki hareketlerden gelir; tablodaki kişiler cari değilse görünmez. Tek tıkla
  // Cari'ye ya da "Tablodan al"a (her cari kaydına bağlanır; aynı kişi iki kez açılmaz) gidilir.
  function emptyLedgerHelp() {
    const fromTable = HOF.can("accounts.manage") && HOF.accounts?.fromTable && (HOF.data?.rows || []).some(row => row.__hofKey && !String(row.__hofKey).startsWith("free:"));
    return `<div class="hof-rep-help"><b>Cari ekstre, Cari defterindeki hareketlerden hazırlanır.</b><span>Cari ekranında açılan her kişi ya da firmanın borç, tahsilat, taksit ve çek/senet hareketleri burada ekstre olarak görünür. Tablonuzdaki kişiler henüz cari değilse önce cari olarak açın; her cari tablodaki kaydına bağlanır, aynı kişi iki kez açılmaz.</span>
      <span class="hof-rep-help-actions">${HOF.accounts?.open ? '<button type="button" class="hof-button hof-button-small" data-go="accounts">Cari Ekranını Aç</button>' : ""}${fromTable ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-go="fromTable">Tablodaki Kişileri Cari Yap</button>' : ""}</span></div>`;
  }

  // --- Vade takip (v2.0.9) ---
  const dueDays = row => (row.state === "overdue" ? `${Math.abs(row.days)} gün geçti` : row.state === "today" ? "bugün" : row.state === "month" ? "bu ay" : `${row.days} gün`);
  function vadeView(s) {
    const allowed = s.data?.allowed || Object.keys(SOURCE_LABELS).filter(id => canSee() || !["cheque", "note", "cash"].includes(id) || (id === "cash" ? HOF.can("cash.view") : HOF.can("cheques.view")));
    const chosen = new Set(s.sources.length ? s.sources : allowed);
    const params = { ...(s.preset ? { preset: s.preset } : { from: s.from, to: s.to }), direction: s.direction, sources: s.sources.join(","), q: s.q, late: s.late ? "" : "0" };
    const filters = `<div class="hof-rep-bar">${rangeBar(s, PRESETS_DUE)}${exportButtons(`/api/workspace/overview/vade-takip.pdf?${query(params)}`, `/api/workspace/overview/vade-takip.xlsx?${query(params)}`)}</div>
      <div class="hof-rep-filters"><input type="search" data-q value="${esc(s.q)}" placeholder="Kişi, telefon, cari, kart, çek no ara…" aria-label="Kişi ara">
        <select data-field="direction" aria-label="Yön"><option value="">Tahsil Edilecek ve Ödenecek</option><option value="in" ${s.direction === "in" ? "selected" : ""}>Yalnız Tahsil Edilecek</option><option value="out" ${s.direction === "out" ? "selected" : ""}>Yalnız Ödenecek</option></select>
        <label class="hof-rep-check" title="Başlangıçtan önce vadesi geçmiş ve kapanmamış kalemler listenin başında"><input type="checkbox" data-field="late" ${s.late ? "checked" : ""}> Gecikmişleri de göster</label></div>
      <div class="hof-rep-sources" role="group" aria-label="Kaynaklar">${allowed.map(id => `<label class="hof-rep-srcpick ${chosen.has(id) ? "is-on" : ""}" title="${esc(SOURCE_HINTS[id] || "")}"><input type="checkbox" data-source="${id}" ${chosen.has(id) ? "checked" : ""}><span class="hof-rep-src is-${id}">${esc(SOURCE_LABELS[id])}</span></label>`).join("")}</div>`;
    if (!s.data) return `${filters}<p class="hof-empty">Vadeler hazırlanıyor…</p>`;
    const d = s.data;
    const t = d.totals;
    const rows = d.rows
      .map((row, index) => `<tr class="is-${row.state}" data-due-row="${index}" tabindex="0" title="${esc(row.ref?.type === "record" ? "Kaydı tabloda göster" : "Kaynağını aç")}"><td>${esc(HOF.formatDate(row.date))}<small class="hof-rep-days is-${row.state}">${esc(dueDays(row))}</small></td><td><b>${esc(row.party || "—")}</b></td><td><span class="hof-rep-src is-${esc(row.source)}">${esc(SOURCE_LABELS[row.source] || row.source)}</span></td><td>${esc(row.label || "")}${row.detail ? `<small>${esc(row.detail)}</small>` : ""}</td><td class="num hof-cash-in">${row.direction === "in" && row.amount !== null ? esc(money(row.amount)) : row.direction === "in" ? '<span class="hof-muted">tutar yok</span>' : ""}</td><td class="num hof-cash-out">${row.direction === "out" && row.amount !== null ? esc(money(row.amount)) : ""}</td></tr>`)
      .join("");
    const dormant = d.dormant?.length
      ? `<details class="hof-rep-overdue"><summary>${ICONS.warn} Tabloda ödemesi kesilmiş olabilecek ${d.dormant.length} kayıt (son yazılı aydan sonra üst üste boş aylar)</summary><div class="hof-rep-table"><table class="hof-table"><tbody>${d.dormant.map((item, index) => `<tr data-dormant-row="${index}" tabindex="0" title="Kaydı tabloda göster"><td><b>${esc(item.party || "—")}</b><small>${esc(item.detail || "")}</small></td><td>Son ödeme: ${esc(item.lastPaidText || "—")}</td><td class="num">${esc(String(item.emptyMonths))} boş ay</td></tr>`).join("")}</tbody></table></div></details>`
      : "";
    const tableNote = chosen.has("table") || chosen.has("promise") || chosen.has("deadline") ? " Tablodaki kalemler tahsilat takvimiyle aynı kurala göre okunur; taksit kartı olan kişinin tablodaki ödemeleri kartından gelir (iki kez sayılmaz)." : "";
    return `${filters}
      ${statTiles([
        { label: "Gecikmiş Tahsilat", html: moneyHtml(t.in.overdue.amount), help: `${t.in.overdue.count} kalem`, tone: t.in.overdue.count ? "is-bad" : "" },
        { label: "Tahsil Edilecek", html: moneyHtml(t.in.total.amount), help: `${t.in.total.count} kalem · bugün ${esc(money(t.in.today.amount))}`, tone: "is-in" },
        { label: "Ödenecek", html: moneyHtml(t.out.total.amount), help: `${t.out.total.count} kalem${t.out.overdue.count ? ` · ${t.out.overdue.count} gecikmiş` : ""}`, tone: "is-out" },
        { label: "Net (tahsil − ödeme)", html: moneyHtml(t.net), tone: t.net < 0 ? "is-bad" : "" },
        t.noAmount ? { label: "Tutarsız Kalem", value: t.noAmount.toLocaleString("tr-TR"), help: "son tarih ya da tutarı yazılmamış ödeme günü" } : null,
      ])}
      <div class="hof-rep-table"><table class="hof-table hof-rep-vade"><thead><tr><th>Vade</th><th>Kimden / Kime</th><th>Kaynak</th><th>Açıklama</th><th class="num">Tahsil Edilecek</th><th class="num">Ödenecek</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="hof-empty">${d.totals.count === 0 && !s.q && !s.direction ? "Bu aralıkta vadesi gelen açık kalem yok. Taksit kartı, çek/senet ya da tablodaki ödeme günleri eklendikçe burada listelenir." : "Bu süzgeçlere uyan açık kalem yok."}</td></tr>`}</tbody></table></div>
      ${d.rowTotal > d.rows.length ? `<p class="hof-rep-note">Ekranda ilk ${d.rows.length.toLocaleString("tr-TR")} kalem; tamamı (${d.rowTotal.toLocaleString("tr-TR")}) PDF ve Excel'de.</p>` : ""}
      ${dormant}
      <p class="hof-rep-note">Satıra tıklayın: kaynağı açılır (taksit kartı, çek/senet, cari ya da tablodaki kayıt). Tutarlar açık kalanlardır; kısmen ödenmiş taksitte kalan yazılır.${tableNote}</p>`;
  }

  // --- Nakit akışı ---
  function flowView(s) {
    const params = { from: s.from, to: s.to, overdue: s.overdue ? "1" : "", table: s.table ? "" : "0", group: s.group };
    const filters = `<div class="hof-rep-bar">${rangeBar(s, PRESETS_FUTURE)}${exportButtons(`/api/workspace/overview/nakit-akisi.pdf?${query(params)}`, `/api/workspace/overview/nakit-akisi.xlsx?${query(params)}`)}</div>
      <div class="hof-rep-filters"><select data-field="group" aria-label="Tablo görünümü"><option value="" ${!s.group ? "selected" : ""}>Hareket Hareket</option><option value="day" ${s.group === "day" ? "selected" : ""}>Günlük Toplamlar</option><option value="week" ${s.group === "week" ? "selected" : ""}>Haftalık Toplamlar</option><option value="month" ${s.group === "month" ? "selected" : ""}>Aylık Toplamlar</option></select>
        <label class="hof-rep-check"><input type="checkbox" data-field="table" ${s.table ? "checked" : ""}> Tablodaki ödeme günlerini ekle</label>
        <label class="hof-rep-check"><input type="checkbox" data-field="overdue" ${s.overdue ? "checked" : ""}> Vadesi geçmiş (kapanmamış) kalemleri başlangıca ekle</label><span class="hof-rep-hint">Kaynaklar: açık taksitler, portföydeki ve ödenecek çek/senet, Kasa'ya ileri tarihli girilen hareketler${s.table ? ", Excel/Sheets tablolarındaki ödeme günleri ve ödeme sözleri" : ""}.</span></div>`;
    if (!s.data) return `${filters}<p class="hof-empty">Projeksiyon hazırlanıyor…</p>`;
    const d = s.data;
    const low = d.lowest;
    const rows = d.rows.map(row => `<tr class="is-${row.direction}"><td>${esc(HOF.formatDate(row.date))}</td><td><span class="hof-rep-src is-${esc(row.source)}">${esc(SOURCE_LABELS[row.source] || row.source)}</span></td><td><b>${esc(row.label)}</b>${row.party ? `<small>${esc(row.party)}</small>` : ""}</td><td class="num hof-cash-in">${row.direction === "in" ? esc(money(row.amount)) : ""}</td><td class="num hof-cash-out">${row.direction === "out" ? esc(money(row.amount)) : ""}</td><td class="num ${row.balance < 0 ? "hof-cash-out" : ""}"><b>${esc(money(row.balance))}</b></td></tr>`).join("");
    const overdue = d.overdue.length
      ? `<details class="hof-rep-overdue"><summary>${ICONS.warn} Vadesi geçmiş, kapanmamış: <b>${esc(money(d.overdueTotals.in))}</b> alacak · <b>${esc(money(d.overdueTotals.out))}</b> ödeme (${d.overdue.length} kalem) — ${d.includeOverdue ? "başlangıca eklendi" : "tahmine dahil değil"}</summary><div class="hof-rep-table"><table class="hof-table"><tbody>${d.overdue.map(row => `<tr><td>${esc(HOF.formatDate(row.date))}</td><td>${esc(SOURCE_LABELS[row.source] || row.source)}</td><td><b>${esc(row.label)}</b>${row.party ? `<small>${esc(row.party)}</small>` : ""}</td><td class="num hof-cash-in">${row.direction === "in" ? esc(money(row.amount)) : ""}</td><td class="num hof-cash-out">${row.direction === "out" ? esc(money(row.amount)) : ""}</td></tr>`).join("")}</tbody></table></div></details>`
      : "";
    return `${filters}
      ${statTiles([
        { label: "Bugünkü Kasa", html: moneyHtml(d.cashToday) },
        { label: "Beklenen Giriş", html: moneyHtml(d.totals.in), tone: "is-in" },
        { label: "Beklenen Çıkış", html: moneyHtml(d.totals.out), tone: "is-out" },
        { label: `Tahmini Kasa · ${HOF.formatDate(d.to)}`, html: moneyHtml(d.closing), tone: d.closing < 0 ? "is-bad" : "" },
        { label: "En Düşük Tahmini Kasa", html: moneyHtml(low.balance), help: `${esc(HOF.formatDate(low.date))}${d.negative ? ` · <span class="hof-pulse-flag is-late">${ICONS.warn}kasa eksiye düşüyor</span>` : ""}`, tone: d.negative ? "is-bad" : "" },
      ])}
      <figure class="hof-rep-chart" data-chart aria-label="Tahmini kasa grafiği"></figure>
      ${overdue}
      ${d.periods ? periodTable(d) : `<div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Vade</th><th>Kaynak</th><th>Açıklama</th><th class="num">Giriş</th><th class="num">Çıkış</th><th class="num">Beklenen Kasa</th></tr></thead><tbody>
        <tr class="is-opening"><td>${esc(HOF.formatDate(d.from))}</td><td></td><td><b>Başlangıç</b><small>Bugünkü kasa${d.carried.in || d.carried.out ? " + başlangıca kadar beklenenler" : ""}${d.includeOverdue ? " + gecikmişler" : ""}</small></td><td></td><td></td><td class="num"><b>${esc(money(d.opening))}</b></td></tr>
        ${rows || '<tr><td colspan="6" class="hof-empty">Bu aralıkta beklenen tahsilat ya da ödeme yok.</td></tr>'}
      </tbody></table></div>`}
      ${d.rowTotal > d.rows.length ? `<p class="hof-rep-note">Ekranda ilk ${d.rows.length.toLocaleString("tr-TR")} satır; tamamı PDF ve Excel'de.</p>` : ""}
      <p class="hof-rep-note">Aynı gün önce ödemeler yazılır (en düşük kasa ihtiyatlı hesaplanır). Tarihler takvim günüdür.</p>`;
  }
  // Dönem toplamları (gün / hafta / ay): giriş, çıkış, net ve dönem sonu tahmini kasa.
  function periodTable(d) {
    const head = { day: "Gün", week: "Hafta", month: "Ay" }[d.group] || "Dönem";
    const rows = d.periods.map(period => `<tr><td><b>${esc(period.label)}</b><small>${period.count} hareket</small></td><td class="num hof-cash-in">${period.in ? esc(money(period.in)) : ""}</td><td class="num hof-cash-out">${period.out ? esc(money(period.out)) : ""}</td><td class="num ${period.net < 0 ? "hof-cash-out" : ""}">${esc(money(period.net))}</td><td class="num ${period.closing < 0 ? "hof-cash-out" : ""}"><b>${esc(money(period.closing))}</b></td></tr>`).join("");
    return `<div class="hof-rep-table"><table class="hof-table"><thead><tr><th>${head}</th><th class="num">Giriş</th><th class="num">Çıkış</th><th class="num">Net</th><th class="num">Dönem Sonu Kasa</th></tr></thead><tbody>
      <tr class="is-opening"><td><b>Başlangıç</b><small>${esc(HOF.formatDate(d.from))}</small></td><td></td><td></td><td></td><td class="num"><b>${esc(money(d.opening))}</b></td></tr>
      ${rows || '<tr><td colspan="5" class="hof-empty">Bu aralıkta beklenen tahsilat ya da ödeme yok.</td></tr>'}</tbody></table></div>`;
  }
  // Tahmini kasa: basamaklı çizgi (bakiye yalnız hareket günlerinde değişir), sıfır çizgisi, en düşük nokta; üzerine
  // gelince o günün girişi/çıkışı ve kasası.
  function wireChart(figure, d) {
    if (!figure) return;
    const points = [{ date: d.from, balance: d.opening, in: 0, out: 0 }, ...d.days.map(day => ({ date: day.date, balance: day.balance, in: day.in, out: day.out }))];
    const end = d.to || points.at(-1).date;
    if (points.at(-1).date < end) points.push({ date: end, balance: points.at(-1).balance, in: 0, out: 0, tail: true });
    const W = 880;
    const H = 190;
    const pad = { l: 64, r: 16, t: 14, b: 26 };
    const t0 = Date.parse(`${points[0].date}T00:00:00Z`);
    const t1 = Math.max(t0 + 86_400_000, Date.parse(`${end}T00:00:00Z`));
    const values = points.map(point => point.balance);
    // Eksen: sıfırı içeren, yuvarlak adımlı (1 / 2 / 2,5 / 5 × 10ⁿ) 3–6 çizgi.
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const raw = Math.max(1, max - min) / 4;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(candidate => candidate >= raw);
    const lo = Math.floor(min / step) * step;
    const hi = Math.max(lo + step, Math.ceil(max / step) * step);
    const x = date => pad.l + ((Date.parse(`${date}T00:00:00Z`) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
    const y = value => pad.t + (1 - (value - lo) / (hi - lo)) * (H - pad.t - pad.b);
    let path = `M${x(points[0].date).toFixed(1)},${y(points[0].balance).toFixed(1)}`;
    for (let index = 1; index < points.length; index += 1) path += `H${x(points[index].date).toFixed(1)}V${y(points[index].balance).toFixed(1)}`;
    const base = y(Math.max(lo, Math.min(hi, 0)));
    const area = `${path}V${base.toFixed(1)}H${x(points[0].date).toFixed(1)}Z`;
    const ticks = [];
    for (let value = lo; value <= hi + step / 2; value += step) ticks.push(Math.round(value / step) * step);
    const compact = value => COMPACT_NUMBER.format(value);
    const mid = new Date((t0 + t1) / 2).toISOString().slice(0, 10);
    const low = d.lowest;
    figure.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tahmini kasa ${HOF.formatDate(d.from)} – ${HOF.formatDate(end)}; en düşük ${money(low.balance)} (${HOF.formatDate(low.date)})">
        ${ticks.map(value => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" class="${value === 0 ? "hof-chart-zero" : "hof-chart-grid"}"/><text x="${pad.l - 8}" y="${(y(value) + 3.5).toFixed(1)}" class="hof-chart-tick" text-anchor="end">${value === 0 ? "0" : esc(compact(value))} ₺</text>`).join("")}
        <path d="${area}" class="hof-chart-area"/>
        <path d="${path}" class="hof-chart-line"/>
        <circle cx="${x(low.date).toFixed(1)}" cy="${y(low.balance).toFixed(1)}" r="4.5" class="hof-chart-low ${low.balance < 0 ? "is-bad" : ""}"/>
        ${[points[0].date, mid, end].map((date, index) => `<text x="${x(date).toFixed(1)}" y="${H - 7}" class="hof-chart-tick" text-anchor="${index === 0 ? "start" : index === 2 ? "end" : "middle"}">${esc(HOF.formatDate(date))}</text>`).join("")}
        <line class="hof-chart-cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
        <rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" data-hit/>
      </svg><div class="hof-chart-tip" hidden></div><figcaption>Tahmini kasa · ${esc(HOF.formatDate(d.from))} – ${esc(HOF.formatDate(end))}</figcaption>`;
    const svg = figure.querySelector("svg");
    const tip = figure.querySelector(".hof-chart-tip");
    const cross = figure.querySelector(".hof-chart-cross");
    const hit = figure.querySelector("[data-hit]");
    const show = event => {
      const box = svg.getBoundingClientRect();
      const px = ((event.clientX - box.left) / box.width) * W;
      const time = t0 + ((px - pad.l) / (W - pad.l - pad.r)) * (t1 - t0);
      let point = points[0];
      for (const item of points) if (Date.parse(`${item.date}T00:00:00Z`) <= time) point = item;
      const cx = x(point.date);
      cross.setAttribute("x1", cx);
      cross.setAttribute("x2", cx);
      cross.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.replaceChildren();
      const value = document.createElement("b");
      value.textContent = money(point.balance);
      const date = document.createElement("span");
      date.textContent = point.tail ? `${HOF.formatDate(point.date)} (dönem sonu)` : HOF.formatDate(point.date);
      tip.append(value, date);
      if (point.in || point.out) {
        const moves = document.createElement("small");
        moves.textContent = `giriş ${money(point.in)} · çıkış ${money(point.out)}`;
        tip.append(moves);
      }
      const left = (cx / W) * box.width;
      tip.style.left = `${Math.min(box.width - 150, Math.max(0, left - 70))}px`;
    };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", () => {
      tip.hidden = true;
      cross.setAttribute("visibility", "hidden");
    });
  }

  // --- Çek / Senet ---
  function chequeView(s) {
    const params = { direction: s.direction, status: s.status, from: s.from, to: s.to };
    const filters = `<div class="hof-rep-bar"><div class="hof-rep-range"><div class="hof-rep-presets">${[
      ["", "Tümü"],
      ["in", "Alınan"],
      ["out", "Verilen"],
    ]
      .map(([id, label]) => `<button type="button" class="hof-rep-chip ${s.direction === id ? "is-on" : ""}" data-direction="${id}">${label}</button>`)
      .join("")}</div>
      <select data-field="status" aria-label="Durum"><option value="open" ${s.status === "open" ? "selected" : ""}>Açık (portföyde / ödenecek)</option><option value="overdue" ${s.status === "overdue" ? "selected" : ""}>Vadesi Geçmiş</option><option value="soon" ${s.status === "soon" ? "selected" : ""}>7 Gün İçinde</option><option value="" ${!s.status ? "selected" : ""}>Tüm Durumlar</option><option value="collected" ${s.status === "collected" ? "selected" : ""}>Tahsil Edildi</option><option value="endorsed" ${s.status === "endorsed" ? "selected" : ""}>Ciro Edildi</option><option value="paid" ${s.status === "paid" ? "selected" : ""}>Ödendi</option><option value="bounced" ${s.status === "bounced" ? "selected" : ""}>Karşılıksız / İade</option></select>
      <label class="hof-rep-date"><span>Vade Başı</span><input type="date" data-range="from" value="${esc(s.from)}"></label><label class="hof-rep-date"><span>Vade Sonu</span><input type="date" data-range="to" value="${esc(s.to)}"></label>
      <button type="button" class="hof-button hof-button-small" data-run>Raporu Getir</button></div>
      ${exportButtons(`/api/workspace/cheques/liste.pdf?${query(params)}`, `/api/workspace/cheques/export.xlsx?${query(params)}`)}</div>`;
    if (!s.data) return `${filters}<p class="hof-empty">Portföy hazırlanıyor…</p>`;
    const d = s.data;
    const sum = d.summary;
    const rows = d.cheques
      .map(row => `<tr data-cheque-row="${esc(row.id)}" tabindex="0" class="is-${esc(row.dueStateKey)}"><td>${esc(HOF.formatDate(row.dueDate))}${row.open ? `<small class="hof-rep-days is-${esc(row.dueStateKey)}">${row.days < 0 ? `${Math.abs(row.days)} gün geçti` : row.days === 0 ? "bugün" : `${row.days} gün`}</small>` : ""}</td><td>${esc(row.directionLabel)} ${esc(row.instrumentLabel.toLocaleLowerCase("tr-TR"))}</td><td>${esc(row.serialNo || "—")}${row.bank ? `<small>${esc(row.bank)}</small>` : ""}</td><td><b>${esc(row.party)}</b>${row.status === "endorsed" && row.endorseAccountName ? `<small>→ ${esc(row.endorseAccountName)}</small>` : ""}</td><td><span class="hof-chq-status is-${esc(row.status)}">${esc(row.statusLabel)}</span></td><td class="num"><b>${esc(money(row.amount))}</b></td></tr>`)
      .join("");
    return `${filters}
      ${statTiles([
        { label: "Portföyde (alınan)", html: moneyHtml(sum.in.open.amount), help: `${sum.in.open.count} evrak`, tone: "is-in" },
        { label: "Ödenecek (verilen)", html: moneyHtml(sum.out.open.amount), help: `${sum.out.open.count} evrak`, tone: "is-out" },
        { label: "Vadesi Geçmiş", html: moneyHtml(sum.in.overdue.amount + sum.out.overdue.amount), help: `${sum.in.overdue.count + sum.out.overdue.count} evrak`, tone: sum.in.overdue.count + sum.out.overdue.count ? "is-bad" : "" },
        { label: "7 Gün İçinde", html: moneyHtml(sum.in.today.amount + sum.in.soon.amount + sum.out.today.amount + sum.out.soon.amount), help: "bugün dahil" },
        { label: "Listelenen", html: moneyHtml(d.listed.amount), help: `${d.listed.count} evrak` },
      ])}
      <div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Vade</th><th>Evrak</th><th>No / Banka</th><th>Kimden / Kime</th><th>Durum</th><th class="num">Tutar</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="hof-empty">Bu süzgeçte evrak yok.</td></tr>'}</tbody></table></div>
      ${d.hasMore ? `<p class="hof-rep-note">Ekranda ilk ${d.cheques.length.toLocaleString("tr-TR")} evrak; tamamı PDF ve Excel'de.</p>` : ""}`;
  }

  // quiet (v2.0.11, canlı yenileme): tablo "Yükleniyor"a düşmeden yerinde tazelenir.
  async function run({ quiet = false } = {}) {
    if (!report) return;
    const tab = report.tab;
    const s = state();
    if (!quiet || !s.data) {
      s.data = null;
      renderReport();
    }
    try {
      if (tab === "mizan") {
        s.data = s.account ? await HOF.api(`/api/workspace/overview/ekstre?${query({ account: s.account.id, from: s.from, to: s.to })}`) : await HOF.api(`/api/workspace/overview/mizan?${query({ from: s.from, to: s.to, type: s.type, side: s.side, idle: s.idle ? "1" : "", q: s.q, limit: 1000 })}`);
      } else if (tab === "vade") s.data = await HOF.api(`/api/workspace/overview/vade-takip?${query({ ...(s.preset ? { preset: s.preset } : { from: s.from, to: s.to }), direction: s.direction, sources: s.sources.join(","), q: s.q, late: s.late ? "" : "0" })}`);
      else if (tab === "flow") s.data = await HOF.api(`/api/workspace/overview/nakit-akisi?${query({ from: s.from, to: s.to, overdue: s.overdue ? "1" : "", table: s.table ? "" : "0", group: s.group })}`);
      else s.data = await HOF.api(`/api/workspace/cheques?${query({ direction: s.direction, status: s.status, from: s.from, to: s.to, limit: 1000 })}`);
    } catch (error) {
      HOF.toastError(error);
      s.data = null;
      const node = root();
      if (node && report.tab === tab) node.querySelector(".hof-empty")?.replaceChildren(document.createTextNode(error.message));
      return;
    }
    if (report && report.tab === tab) renderReport();
  }
  // Vade takip satırı: kaynağı açılır. Tablodaki kayıt açık veri oturumundaysa pencere kapanır ve kayıt tabloda seçilir.
  function openRef(ref) {
    if (!ref) return;
    if (ref.type === "plan" && ref.id) return HOF.plans?.open(ref.id);
    if (ref.type === "cheque" && ref.id) return HOF.can("cheques.view") ? HOF.cheques?.open({ id: ref.id }) : HOF.toast("Çek/senet kartı kasa yetkisi olanlara açılır.", { type: "error" });
    if (ref.type === "account" && ref.id) return HOF.accounts?.open(ref.id);
    if (ref.type === "cash") return HOF.can("cash.view") ? document.querySelector('#hof-sidecard [data-action="cash"]')?.click() : null;
    if (ref.type === "record" && ref.key) {
      if (ref.current === false) return HOF.toast(`Bu kayıt “${ref.sessionName || "başka bir"}” veri oturumunda. Sol üstteki oturum seçiciden o oturumu açıp bakın.`, { type: "info" });
      report?.modal?.close();
      return HOF.revealRecord?.(ref.key);
    }
  }
  function onReportClick(event) {
    const target = event.target.closest("button, [data-account-row], [data-cheque-row], [data-due-row], [data-dormant-row]");
    if (!target || !report) return;
    const s = state();
    if (target.dataset.tab) {
      report.tab = target.dataset.tab;
      renderReport();
      if (!PANE_TABS.has(report.tab) && !state().data) run();
      return;
    }
    if (target.dataset.dueRow !== undefined) return openRef(s.data?.rows?.[Number(target.dataset.dueRow)]?.ref);
    if (target.dataset.dormantRow !== undefined) return openRef(s.data?.dormant?.[Number(target.dataset.dormantRow)]?.ref);
    if (target.dataset.openAccount) return HOF.accounts?.open(target.dataset.openAccount);
    if (target.dataset.go === "accounts") return HOF.accounts?.open();
    if (target.dataset.go === "fromTable") {
      report?.modal?.close();
      return HOF.accounts?.fromTable();
    }
    if (target.dataset.preset) {
      Object.assign(s, { preset: target.dataset.preset }, presetRange(target.dataset.preset));
      return run();
    }
    if (target.dataset.direction !== undefined) {
      s.direction = target.dataset.direction;
      return run();
    }
    if (target.hasAttribute("data-run")) {
      // "Tüm zamanlar" seçiliyken başlangıç kutusu boş görünür (01.01.1976 yazmaz); boş bırakılırsa o aralık sürer.
      const from = root().querySelector('[data-range="from"]')?.value || (s.preset === "all" ? s.from : "");
      const to = root().querySelector('[data-range="to"]')?.value || "";
      if (report.tab !== "cheques" && report.tab !== "vade" && (!from || !to)) return HOF.toast("Başlangıç ve bitiş tarihini seçin.", { type: "error" });
      if (from && to && from > to) return HOF.toast("Başlangıç tarihi bitiş tarihinden sonra olamaz.", { type: "error" });
      Object.assign(s, { from, to, preset: "" });
      const q = root().querySelector("[data-q]");
      if (q) s.q = q.value.trim();
      return run();
    }
    if (target.hasAttribute("data-back")) {
      s.account = null;
      return run();
    }
    if (target.dataset.accountRow) {
      const row = s.data?.rows?.find(item => item.id === target.dataset.accountRow);
      s.account = { id: target.dataset.accountRow, name: row?.name || "" };
      return run();
    }
    if (target.dataset.chequeRow && HOF.can("cheques.view")) return HOF.cheques?.open({ id: target.dataset.chequeRow });
  }
  function onReportChange(event) {
    if (!report) return;
    const s = state();
    if (event.target.dataset.source) {
      // Kaynak seçimi: hepsi seçiliyse süzgeç yok (yeni kaynak eklenince kendiliğinden görünür); en az bir kaynak kalır.
      const boxes = [...root().querySelectorAll("[data-source]")];
      const picked = boxes.filter(box => box.checked).map(box => box.dataset.source);
      if (!picked.length) {
        event.target.checked = true;
        return HOF.toast("En az bir kaynak seçili kalmalı.", { type: "info" });
      }
      s.sources = picked.length === boxes.length ? [] : picked;
      return run();
    }
    const field = event.target.dataset.field;
    if (!field) return;
    s[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    run();
  }

  // ---------- Kurulum ----------
  HOF.overview = { reload: load, openReports, data: () => data };
  HOF.whenReady(() => {
    load();
    HOF.onDom(() => {
      if (!data || !canCard()) return;
      const welcome = document.querySelector(".main-shell .content-wrap > .welcome-row");
      const node = document.getElementById("hof-pulse");
      if (welcome && (!node || node.parentNode !== welcome)) render();
    });
    // Canlı: para ya da stok değişince sunucu herkese (işlemi yapan dahil) tek olay yayımlar.
    HOF.on("live:overview.changed", () => reloadSoon(200));
    // Raporlar penceresi açıksa (Cari ekstre/mizan, Vade takip, Nakit akışı, Çek/Senet sekmeleri) gösterilen rapor da
    // yenilenir (v2.0.11); "Tüm raporlar" ve "Tablo raporları" sekmeleri kendi yenilemesini yapar.
    HOF.onLedger(["cash", "accounts", "plans", "stock", "cheques"], () => {
      if (report?.modal && !PANE_TABS.has(report.tab) && state()?.data) run({ quiet: true });
    }, 400);
    HOF.on("live:resync", () => reloadSoon(200));
    HOF.on("live:hello", () => {
      live = true;
      reloadSoon(300);
    });
    HOF.on("live:disconnected", () => {
      live = false;
      render();
    });
    // Yetki değişince (yönetici rolü ya da kişiye özel yetkiyi değiştirdi; hof-workspace.js /me'yi yeniden alır) kart
    // kendini açar ya da kaldırır.
    HOF.on("user-changed", () => load());
    // Gün dönümü ve uzun arka plan: vade durumları (gecikmiş/bugün) takvim gününe bağlıdır.
    let day = todayIso();
    setInterval(() => {
      if (todayIso() !== day) {
        day = todayIso();
        load();
      }
    }, 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > 60_000) load();
    });
  });
})();
