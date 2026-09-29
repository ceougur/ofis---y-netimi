/* DestekOfis — Rapor merkezi (v2.0.7), "Detaylı raporlar".
 * Programa girilen her bilginin hazır raporu: Kasa, Cari, Taksit, Çek/Senet, Stok, kayıtlar (tahsilat, not, görev,
 * belge, tablo verisi) ve işlem geçmişi. Solda gruplar ve arama; sağda seçilen raporun süzgeçleri, ekranda ön izleme
 * (ilk 200 satır) ve tek tıkla PDF / Excel. Rapor tanımları sunucudadır (server/routes/report-center.mjs); ekran
 * süzgeçleri raporun bildirdiği parametrelerden kurulur, yeni rapor eklemek için istemci değişmez. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let center = null;

  const GROUP_ICONS = {
    Kasa: "₺",
    Cari: "☰",
    Taksit: "▤",
    "Çek / Senet": "✎",
    Stok: "▦",
    Kayıtlar: "≡",
    Ofis: "◷",
  };
  const PRESETS = [
    ["thisMonth", "Bu ay"],
    ["lastMonth", "Geçen ay"],
    ["last30", "Son 30 gün"],
    ["thisYear", "Bu yıl"],
    ["all", "Tüm zamanlar"],
  ];
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
        // "Tüm zamanlar": açık tarih gönderilir (sunucu boş aralığı "bu ay" sayardı; kullanıcı yanlış dönem görürdü).
        all: { from: iso(y - 50, 1, 1), to: today },
      }[preset] || { from: "", to: "" }
    );
  };
  const SELECTS = {
    type: { label: "Cari türü", options: [["", "Tüm cariler"], ["customer", "Müşteriler"], ["supplier", "Tedarikçiler"], ["other", "Diğer"]] },
    side: { label: "Bakiye", options: [["", "Tümü"], ["debtor", "Bize borçlu"], ["creditor", "Biz borçluyuz"], ["zero", "Kapalı"], ["overdue", "Geciken taksiti olan"]] },
    direction: { label: "Yön", options: [["", "Alınan ve verilen"], ["in", "Alınan"], ["out", "Verilen"]] },
    status: { label: "Durum", options: [["", "Tüm durumlar"], ["open", "Açık (portföyde / ödenecek)"], ["overdue", "Vadesi geçmiş"], ["soon", "7 gün içinde"], ["collected", "Tahsil edildi"], ["endorsed", "Ciro edildi"], ["paid", "Ödendi"], ["bounced", "Karşılıksız / iade"]] },
    state: { label: "Kalem", options: [["", "Tüm kalemler"], ["low", "Kritik seviyedekiler"], ["out", "Tükenenler"], ["product", "Ürünler"], ["service", "Hizmetler"]] },
    planStatus: { label: "Kartlar", options: [["active", "Açık kartlar"], ["closed", "Kapatılanlar"], ["all", "Tümü"]] },
    taskStatus: { label: "Görevler", options: [["all", "Tümü"], ["open", "Açık"], ["done", "Tamamlanan"]] },
  };

  async function open(reportId = "") {
    if (!HOF.can("overview.view")) return HOF.toast("Raporlar yalnız yönetici ve yönetici yetki verdiği kişilere açıktır.", { type: "error" });
    if (center?.modal) {
      if (reportId) select(reportId);
      return;
    }
    center = { reports: [], id: reportId, q: "", params: {}, preview: null, busy: false };
    center.modal = HOF.modal({
      title: "Rapor merkezi",
      eyebrow: "DETAYLI RAPORLAR",
      size: "center",
      body: '<div class="hof-rc" data-rc><p class="hof-empty">Raporlar yükleniyor…</p></div>',
      onClose: () => {
        center = null;
      },
    });
    const dialog = center.modal.dialog;
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("input", event => {
      if (event.target.matches("[data-rc-search]")) {
        center.q = event.target.value;
        renderNav();
      }
    });
    dialog.addEventListener("change", onChange);
    try {
      const catalog = await HOF.api("/api/workspace/report-center");
      if (!center) return;
      center.reports = catalog.reports;
      renderShell();
      select(reportId || catalog.reports[0]?.id);
    } catch (error) {
      HOF.toastError(error);
      center.modal.close();
    }
  }
  const root = () => center?.modal?.dialog.querySelector("[data-rc]");
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

  function select(id) {
    if (!center) return;
    const report = center.reports.find(item => item.id === id);
    if (!report) return;
    center.id = id;
    const params = {};
    if (report.params.includes("range")) Object.assign(params, { preset: report.preset || "all" }, presetRange(report.preset || "all"));
    if (report.params.includes("planStatus")) params.planStatus = "active";
    if (report.params.includes("taskStatus")) params.taskStatus = "all";
    if (report.id === "cek-portfoy") params.status = "open";
    center.params = params;
    center.account = null;
    center.preview = null;
    renderNav();
    renderMain();
    if (!report.params.includes("account")) run();
  }
  const queryString = () =>
    new URLSearchParams(
      Object.fromEntries(
        Object.entries({ ...center.params, account: center.account?.id || "" })
          .filter(([key, value]) => key !== "preset" && value !== "" && value !== undefined && value !== null),
      ),
    ).toString();
  function paramsHtml(report) {
    const p = center.params;
    const parts = [];
    if (report.params.includes("account")) parts.push('<div class="hof-rc-param hof-rc-account" data-account-slot></div>');
    if (report.params.includes("range")) {
      parts.push(`<div class="hof-rc-param hof-rc-range"><div class="hof-rep-presets">${PRESETS.map(([id, label]) => `<button type="button" class="hof-rep-chip ${p.preset === id ? "is-on" : ""}" data-preset="${id}">${esc(label)}</button>`).join("")}</div>
        <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-param="from" value="${esc(p.from || "")}"></label>
        <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-param="to" value="${esc(p.to || "")}"></label></div>`);
    }
    for (const name of report.params) {
      if (SELECTS[name]) {
        const spec = SELECTS[name];
        parts.push(`<label class="hof-rc-param"><span>${esc(spec.label)}</span><select data-param="${name}">${spec.options.map(([value, label]) => `<option value="${esc(value)}" ${String(p[name] || "") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`);
      } else if (name === "category") parts.push(`<label class="hof-rc-param"><span>Kategori</span><input type="text" data-param="category" value="${esc(p.category || "")}" placeholder="Tümü" maxlength="80"></label>`);
      else if (name === "tab") {
        const tabs = center.preview?.tabs || [];
        parts.push(`<label class="hof-rc-param"><span>Sekme</span><select data-param="tab"><option value="">Tüm sekmeler</option>${tabs.map(tab => `<option value="${esc(tab)}" ${p.tab === tab ? "selected" : ""}>${esc(tab)}</option>`).join("")}</select></label>`);
      }
    }
    return parts.join("");
  }
  function renderMain() {
    const main = root()?.querySelector("[data-rc-main]");
    const report = current();
    if (!main || !report) return;
    const ready = !report.params.includes("account") || center.account;
    const qs = queryString();
    const preview = center.preview;
    const table = preview
      ? `<div class="hof-rc-summary">${(preview.summary || []).map(([label, value]) => `<span><small>${esc(label)}</small><b>${esc(value)}</b></span>`).join("")}</div>
        <div class="hof-rep-table hof-rc-table"><table class="hof-table"><thead><tr>${preview.headers.map((header, index) => `<th class="${preview.types[index] === "money" || preview.types[index] === "number" ? "num" : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${
          preview.rows.length
            ? preview.rows.map(row => `<tr>${row.map((cell, index) => `<td class="${preview.types[index] === "money" || preview.types[index] === "number" ? "num" : ""}">${esc(cell)}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${preview.headers.length}" class="hof-empty">Bu süzgeçte kayıt yok.</td></tr>`
        }</tbody></table></div>
        <p class="hof-rep-note">${preview.total > preview.rows.length ? `Ekranda ilk ${preview.rows.length.toLocaleString("tr-TR")} satır; tamamı (${preview.total.toLocaleString("tr-TR")} satır) PDF ve Excel'de.` : `${preview.total.toLocaleString("tr-TR")} satır.`} PDF en çok 20.000 satır yazar; Excel sınırsızdır.</p>`
      : `<p class="hof-empty">${ready ? "Rapor hazırlanıyor…" : "Önce cariyi seçin."}</p>`;
    main.innerHTML = `<header class="hof-rc-head"><div><p class="hof-eyebrow">${esc(report.group)}</p><h3>${esc(preview?.title || report.title)}</h3><p>${esc(report.description)}</p>${preview?.subtitle ? `<small class="hof-rc-scope">${esc(preview.subtitle)}</small>` : ""}</div>
        <span class="hof-rep-export ${ready ? "" : "is-disabled"}" role="group" aria-label="Dışa aktar">
          <a class="hof-rep-out is-pdf" href="${ready ? `/api/workspace/report-center/${esc(report.id)}/pdf?${esc(qs)}` : "#"}" target="_blank" rel="noopener" ${ready ? "" : 'aria-disabled="true" tabindex="-1"'}>PDF indir</a>
          <a class="hof-rep-out is-xlsx" href="${ready ? `/api/workspace/report-center/${esc(report.id)}/xlsx?${esc(qs)}` : "#"}" download ${ready ? "" : 'aria-disabled="true" tabindex="-1"'}>Excel indir</a>
        </span></header>
      ${report.params.length ? `<div class="hof-rc-params">${paramsHtml(report)}<button type="button" class="hof-button hof-button-small" data-rc-run>Ön izle</button></div>` : ""}
      ${table}`;
    const slot = main.querySelector("[data-account-slot]");
    if (slot && HOF.accounts?.picker) {
      const field = HOF.accounts.picker({ value: center.account || {}, label: "Cari", onPick: account => {
        center.account = account && account.id ? { id: account.id, name: account.name } : null;
        center.preview = null;
        if (center.account) run();
        else renderMain();
      } });
      if (field) slot.appendChild(field);
    }
  }

  async function run() {
    if (!center) return;
    const report = current();
    if (!report || (report.params.includes("account") && !center.account)) return renderMain();
    const ticket = (center.ticket = (center.ticket || 0) + 1);
    center.preview = null;
    renderMain();
    try {
      const preview = await HOF.api(`/api/workspace/report-center/${encodeURIComponent(report.id)}?${queryString()}`);
      if (!center || ticket !== center.ticket) return;
      center.preview = preview;
      renderMain();
    } catch (error) {
      if (!center || ticket !== center.ticket) return;
      HOF.toastError(error);
      const main = root()?.querySelector("[data-rc-main] .hof-empty");
      if (main) main.textContent = error.message;
    }
  }
  function onClick(event) {
    const target = event.target.closest("button, a");
    if (!target || !center) return;
    if (target.matches(".hof-rep-out[aria-disabled]")) {
      event.preventDefault();
      return HOF.toast("Önce cariyi seçin.", { type: "error" });
    }
    if (target.dataset.report) return select(target.dataset.report);
    if (target.dataset.preset) {
      Object.assign(center.params, { preset: target.dataset.preset }, presetRange(target.dataset.preset));
      return run();
    }
    if (target.hasAttribute("data-rc-run")) {
      const main = root().querySelector("[data-rc-main]");
      const from = main.querySelector('[data-param="from"]')?.value;
      const to = main.querySelector('[data-param="to"]')?.value;
      if (from && to && from > to) return HOF.toast("Başlangıç tarihi bitiş tarihinden sonra olamaz.", { type: "error" });
      if (from !== undefined) Object.assign(center.params, { from: from || "", to: to || "", preset: "" });
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
    center.params[name] = event.target.value;
    run();
  }

  HOF.reportCenter = { open };
})();
