/* DestekOfis — Tablo raporları (v2.0.2; v2.0.9'dan beri Raporlar penceresinin "Tablo raporları" sekmesi).
 * Excel/Sheets tablolarındaki (tüm sayfalar) tutar, vade ve durum kolonlarından: Cari ekstre, Vade takip, Nakit
 * akış. Sabit şablon yoktur; kolonlar sunucunun ortak omurgadan (cari, tutar, vade, durum + özel alanlar) ürettiği
 * tablodan gelir. Farklı Excel dosyalarındaki (oturumlardaki) kayıtlar cari adıyla birleştirilir. Cari, Kasa, Taksit ve
 * Çek/Senet defterlerinden gelen raporlar aynı penceredeki diğer sekmelerdedir (hof-overview.js).
 * Süzgeçler: tarih aralığı, cari, durum, oturum, sekme, en az tutar, dönem (nakit akış).
 * Dışa aktarma: Excel (.xlsx), PDF; yazdırma tarayıcının yazdırma penceresiyle (rapor tablosu temiz bir sayfada). */
(() => {
  const HOF = window.HOF;
  if (!HOF) return;
  const { esc } = HOF;
  // Adlar Raporlar penceresinin defter sekmelerinden (Cari ekstre, Vade takip, Nakit akış) ayrılsın diye "tablodaki" ile.
  const KINDS = [
    ["cari-ekstre", "Tablodaki Kişiler", "Kişi başına tablodaki tutar (borç), kayıt kartından tahsilat ve yürüyen bakiye"],
    ["vade-takip", "Tablodaki Vadeler", "Tablodaki vadeler ve son tarihler: gecikmiş, bugün, yaklaşan"],
    ["nakit-akis", "Tablodaki Nakit Akışı", "Dönem başına tablodan beklenen ve gerçekleşen tahsilat, kasa"],
  ];
  const money = value => (value === null || value === undefined ? "" : `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₺`);
  const day = ms => (ms === null || ms === undefined || ms === "" ? "" : new Date(ms).toLocaleDateString("tr-TR", { timeZone: "UTC" }));
  const number = value => new Intl.NumberFormat("tr-TR").format(value || 0);
  const isoOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  let host = null; // sekmenin kök düğümü (Raporlar penceresinin içinde)
  let state = { kind: "cari-ekstre", filters: {}, data: null, busy: false };

  function filtersFromForm(dialog) {
    const get = name => dialog.querySelector(`[data-filter="${name}"]`);
    const sessions = [...dialog.querySelectorAll('[data-filter="sessions"] input:checked')].map(input => input.value);
    return {
      from: get("from")?.value || "",
      to: get("to")?.value || "",
      cari: get("cari")?.value || "",
      status: get("status")?.value || "",
      tabs: get("tabs")?.value || "",
      minAmount: get("minAmount")?.value || "",
      granularity: get("granularity")?.value || "month",
      sessions: sessions.join(","),
    };
  }
  const query = filters => Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");

  function cell(column, row) {
    const value = row[column.key];
    if (column.type === "date") return esc(day(value));
    if (column.type === "money") return `<span class="hof-num">${esc(money(value))}</span>`;
    if (column.type === "number") return `<span class="hof-num">${value === null || value === undefined ? "" : esc(String(value))}</span>`;
    if (column.key === "state") return `<span class="hof-state hof-state-${esc(String(value || "").toLocaleLowerCase("tr-TR").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u"))}">${esc(String(value ?? ""))}</span>`;
    return esc(String(value ?? ""));
  }
  function tableHtml(table) {
    if (!table?.columns?.length) return '<p class="hof-empty">Rapor üretilemedi.</p>';
    if (!table.rows.length) return '<p class="hof-empty">Bu süzgeçlerle satır bulunamadı. Tarih aralığını genişletin ya da süzgeçleri temizleyin.</p>';
    return `<div class="hof-report-scroll"><table class="hof-report-table"><thead><tr>${table.columns.map(column => `<th class="${column.type === "money" || column.type === "number" ? "is-num" : ""} ${column.dynamic ? "is-dynamic" : ""}" title="${column.dynamic ? "Verinizden gelen özel alan" : ""}">${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${table.rows
      .map(row => `<tr>${table.columns.map(column => `<td class="${column.type === "money" || column.type === "number" ? "is-num" : ""}">${cell(column, row)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
  }
  function summaryHtml(report) {
    const card = (label, value) => `<div class="hof-report-card"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;
    if (report.kind === "cari-ekstre") return card("Cari", number(report.totals.caris)) + card("Toplam borç", money(report.totals.debit)) + card("Toplam alacak", money(report.totals.credit)) + card("Bakiye", money(report.totals.balance)) + (report.totals.crossMatched ? card("Birden çok dosyada", number(report.totals.crossMatched)) : "");
    if (report.kind === "vade-takip") return card("Kalem", number(report.totals.count)) + card("Gecikmiş", `${number(report.totals.overdue)} · ${money(report.totals.overdueAmount)}`) + card("Yaklaşan / bugün", number(report.totals.upcoming)) + card("Toplam tutar", money(report.totals.amount)) + (report.totals.dormant ? card("Ödeme kesilmiş olabilir", number(report.totals.dormant)) : "");
    return card("Beklenen tahsilat", money(report.totals.expected)) + card("Gerçekleşen tahsilat", money(report.totals.collected)) + card("Kasa giriş", money(report.totals.cashIn)) + card("Kasa çıkış", money(report.totals.cashOut)) + card("Net", money(report.totals.net));
  }

  async function load() {
    if (!host || !host.isConnected) return;
    const dialog = host;
    state.filters = filtersFromForm(dialog);
    const body = dialog.querySelector("[data-report-body]");
    body.innerHTML = '<p class="hof-empty">Rapor hazırlanıyor…</p>';
    state.busy = true;
    try {
      const data = await HOF.api(`/api/workspace/reports/${state.kind}?${query(state.filters)}`, { timeoutMs: 120_000 });
      state.data = data;
      renderFilters(dialog, data);
      body.innerHTML = `<div class="hof-report-summary">${summaryHtml(data.report)}</div>${tableHtml(data.report.table)}`;
      dialog.querySelector("[data-report-meta]").textContent = `${number(data.report.table.rows.length)} satır · ${data.sessions.length > 1 && !state.filters.sessions ? `${data.sessions.length} oturum birleşik` : data.sessions.map(item => item.name).join(", ")}${data.report.table.columns.some(column => column.dynamic) ? ` · ${data.report.table.columns.filter(column => column.dynamic).length} özel alan kolonu` : ""}`;
    } catch (error) {
      body.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    } finally {
      state.busy = false;
    }
  }

  function renderFilters(dialog, data) {
    const sessionsBox = dialog.querySelector('[data-filter="sessions"]');
    if (sessionsBox && !sessionsBox.dataset.ready) {
      sessionsBox.dataset.ready = "1";
      sessionsBox.innerHTML = data.sessions.length > 1
        ? data.sessions.map(item => `<label class="hof-check"><input type="checkbox" value="${esc(item.key)}" checked><span>${esc(item.name)}<small> · ${number(item.rowCount)} kayıt</small></span></label>`).join("")
        : `<span class="hof-muted">${esc(data.sessions[0]?.name || "Tek sayfa")}</span>`;
    }
    const tabs = dialog.querySelector('[data-filter="tabs"]');
    if (tabs && !tabs.dataset.ready) {
      tabs.dataset.ready = "1";
      tabs.innerHTML = `<option value="">Tüm Sekmeler</option>${data.tabs.map(tab => `<option value="${esc(tab)}">${esc(tab)}</option>`).join("")}`;
    }
    const status = dialog.querySelector('[data-filter="status"]');
    if (status && !status.dataset.ready) {
      status.dataset.ready = "1";
      const options = state.kind === "vade-takip" ? [["gecikmis", "Gecikmiş"], ["bugun", "Bugün"], ["yaklasan", "Yaklaşan"], ["kapali", "Kapalı"], ["durgun", "Durgun (ödeme kesilmiş olabilir)"]] : data.statuses.map(item => [item, item]);
      status.innerHTML = `<option value="">Tüm Durumlar</option>${options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}`;
    }
    dialog.querySelector("[data-granularity-row]").hidden = state.kind !== "nakit-akis";
  }

  async function exportReport(format) {
    if (!host) return;
    const response = await fetch(`/api/workspace/reports/${state.kind}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format, filters: { ...state.filters, sessions: state.filters.sessions ? state.filters.sessions.split(",") : [], status: state.filters.status ? [state.filters.status] : [], tabs: state.filters.tabs ? [state.filters.tabs] : [] } }) });
    if (!response.ok) {
      let message = "Dışa aktarma başarısız.";
      try {
        message = (await response.json()).error || message;
      } catch {
        // gövde JSON değil
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const name = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("content-disposition") || "")?.[1];
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name ? decodeURIComponent(name) : `rapor.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function print() {
    if (!state.data) return;
    const { report } = state.data;
    const title = KINDS.find(([id]) => id === state.kind)?.[1] || "Rapor";
    const frame = document.createElement("iframe");
    frame.className = "hof-print-frame";
    frame.setAttribute("aria-hidden", "true");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font:11px/1.35 Arial,sans-serif;color:#111;margin:18mm 12mm}h1{font-size:18px;margin:0 0 4px}p.meta{color:#555;margin:0 0 12px;font-size:10px}
      .cards{display:flex;gap:8px;margin:0 0 12px}.cards div{border:1px solid #ddd;border-radius:6px;padding:6px 10px;min-width:110px}.cards small{display:block;color:#666;font-size:9px}.cards b{font-size:12px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top;font-size:10px}th{background:#f2f2f2}td.num,th.num{text-align:right;white-space:nowrap}
      @page{size:${report.table.columns.length > 7 ? "A4 landscape" : "A4"};margin:10mm}
    </style></head><body><h1>${esc(title)}</h1><p class="meta">DestekOfis · ${esc(new Date().toLocaleString("tr-TR"))}${state.filters.from || state.filters.to ? ` · ${esc(state.filters.from || "başlangıç")} – ${esc(state.filters.to || "bugün")}` : ""}</p>
      <div class="cards">${summaryHtml(report).replace(/hof-report-card/g, "")}</div>
      <table><thead><tr>${report.table.columns.map(column => `<th class="${column.type === "money" || column.type === "number" ? "num" : ""}">${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${report.table.rows.map(row => `<tr>${report.table.columns.map(column => `<td class="${column.type === "money" || column.type === "number" ? "num" : ""}">${column.type === "money" ? esc(money(row[column.key])) : column.type === "date" ? esc(day(row[column.key])) : esc(String(row[column.key] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        setTimeout(() => frame.remove(), 60_000);
      }
    };
  }

  // Sekmeyi verilen düğüme kurar; sekme her açıldığında süzgeçler korunur (aynı pencere içinde).
  function mount(node, kind = state.kind) {
    host = node;
    if (!state.kind || !KINDS.some(([id]) => id === kind)) kind = "cari-ekstre";
    state = { ...state, kind, data: null, busy: false };
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const previous = state.filters || {};
    node.innerHTML = `<div class="hof-report-kinds" role="tablist" aria-label="Tablo raporları">${KINDS.map(([id, label, hint]) => `<button type="button" role="tab" data-kind="${id}" aria-selected="${id === state.kind}" title="${esc(hint)}">${esc(label)}</button>`).join("")}</div>
        <p class="hof-modal-text hof-report-intro">Yalnız <b>Excel/Sheets tablolarınızdaki</b> tutar, vade ve durum kolonlarından üretilir (tüm sayfalar). Aynı kişi birden çok dosyada varsa tek kişi olarak birleşir. Cari, Kasa, Taksit ve Çek/Senet defterlerindeki hareketler için diğer sekmeleri kullanın.</p>
        <form class="hof-report-filters" data-filters>
          <label><span>Başlangıç</span><input type="date" data-filter="from" value="${esc(previous.from ?? isoOf(monthStart))}"></label>
          <label><span>Bitiş</span><input type="date" data-filter="to" value="${esc(previous.to || "")}"></label>
          <label><span>Kişi / Kimlik</span><input type="search" data-filter="cari" placeholder="Ad, dosya no, telefon" value="${esc(previous.cari || "")}"></label>
          <label><span>Durum</span><select data-filter="status"><option value="">Tüm Durumlar</option></select></label>
          <label><span>Sekme</span><select data-filter="tabs"><option value="">Tüm Sekmeler</option></select></label>
          <label><span>En Az Tutar</span><input type="number" data-filter="minAmount" min="0" step="1" placeholder="0" value="${esc(previous.minAmount || "")}"></label>
          <label data-granularity-row hidden><span>Dönem</span><select data-filter="granularity"><option value="month">Ay</option><option value="week">Hafta</option><option value="day">Gün</option></select></label>
          <div class="hof-report-sessions"><span>Sayfalar</span><div data-filter="sessions"></div></div>
          <div class="hof-report-actions"><button type="submit" class="hof-button">Raporu Getir</button><button type="button" class="hof-button hof-button-ghost" data-clear>Süzgeçleri Temizle</button></div>
        </form>
        <div class="hof-report-toolbar"><span data-report-meta class="hof-muted"></span><span><button type="button" class="hof-button hof-button-small hof-button-ghost" data-export="xlsx">Excel</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-export="pdf">PDF</button><button type="button" class="hof-button hof-button-small" data-print>Yazdır</button></span></div>
        <div data-report-body></div>`;
    const dialog = node;
    dialog.querySelector("[data-filters]").addEventListener("submit", event => {
      event.preventDefault();
      load();
    });
    dialog.querySelector("[data-clear]").addEventListener("click", () => {
      dialog.querySelectorAll("[data-filter]").forEach(item => {
        if (item.tagName === "INPUT" && item.type !== "checkbox") item.value = "";
        else if (item.tagName === "SELECT") item.selectedIndex = 0;
      });
      dialog.querySelectorAll('[data-filter="sessions"] input').forEach(input => (input.checked = true));
      load();
    });
    dialog.querySelector(".hof-report-kinds").addEventListener("click", event => {
      const button = event.target.closest("[data-kind]");
      if (!button) return;
      state.kind = button.dataset.kind;
      dialog.querySelectorAll("[data-kind]").forEach(item => item.setAttribute("aria-selected", String(item === button)));
      const status = dialog.querySelector('[data-filter="status"]');
      if (status) {
        delete status.dataset.ready;
        status.value = "";
      }
      load();
    });
    dialog.querySelectorAll("[data-export]").forEach(button =>
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await exportReport(button.dataset.export);
        } catch (error) {
          HOF.toastError(error);
        } finally {
          button.disabled = false;
        }
      }),
    );
    dialog.querySelector("[data-print]").addEventListener("click", print);
    load();
  }

  // Eski giriş noktası: sol menü ve eski bağlantılar birleşik Raporlar penceresini "Tablo raporları" sekmesinde açar.
  const open = kind => {
    if (kind) state.kind = kind;
    return HOF.overview?.openReports ? HOF.overview.openReports("table") : null;
  };
  HOF.tableReports = { mount, print, exportReport };
  HOF.reports = { open, print, exportReport };
})();
