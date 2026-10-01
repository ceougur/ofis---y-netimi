/* DestekOfis — Stok (v2.0.6): Kasa mantığıyla çalışan basit stok.
 * LİSTE: arama, kategori, durum (Tümü / Kritik / Tükenen), sıralama; göstergeler (ürün, kritik, tükenen, stok değeri);
 * satırda hızlı "+ Giriş" / "− Çıkış"; PDF, Yazdır, Excel. KART: ürün bilgileri, göstergeler ve yürüyen miktarlı hareketler.
 * Hareket formu: miktar × birim fiyat = tutar (anında hesaplanır). Para isteğe bağlı: Kasa'dan ödendi / Kasa'ya tahsil
 * edildi ya da cariye yazıldı (tedarikçiye alacak, müşteriye borç). Sunucu: server/routes/stock.mjs. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const office = () => HOF.office || {};
  const QTY_FORMAT = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
  const qtyText = value => QTY_FORMAT.format(Number(value) || 0);
  const parseNumber = value => {
    let text = String(value ?? "").trim().replace(/\s+/g, "").replace(/[^\d.,-]/g, "");
    if (!text) return Number.NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(",", ".");
    return Number(text);
  };
  // Birimler (v2.0.8): seçim listesi (önceki öneri listesi, içinde "adet" yazılıyken yalnız "adet"i gösteriyordu).
  // Sayılan, tartılan, ölçülen ve hizmet birimleri; listede olmayan birim "Başka bir değer yaz…" ile yazılır.
  // v2.0.11: ilk harf büyük, kısaltmalar dahil (sunucudaki server/lib/units.mjs ile aynı liste); "adet" ile "Adet" aynı
  // birimdir, listede bir kez görünür.
  const UNITS = ["Adet", "Paket", "Kutu", "Koli", "Çuval", "Şişe", "Bidon", "Teneke", "Kavanoz", "Top", "Rulo", "Düzine", "Çift", "Takım", "Set", "Kg", "Gr", "Ton", "Lt", "Ml", "M³", "Metre", "Cm", "M²", "Saat", "Gün", "Hafta", "Ay", "Seans", "Kişi", "Sefer"];
  const unitKey = unit => String(unit || "").trim().toLocaleLowerCase("tr-TR");
  const unitLabel = unit => {
    const text = String(unit || "").trim();
    return UNITS.find(item => unitKey(item) === unitKey(text)) || (text ? text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1) : "");
  };
  const unitOptions = (current = "") => {
    const seen = new Set();
    return [...UNITS, ...(view.list?.items || []).map(item => item.unit), current].map(unitLabel).filter(unit => unit && !seen.has(unitKey(unit)) && seen.add(unitKey(unit)));
  };
  const STATES = [
    { id: "all", label: "Tümü" },
    { id: "low", label: "Kritik" },
    { id: "out", label: "Tükenen" },
  ];
  const SORTS = [
    ["name", "Ada Göre"],
    ["code", "Koda Göre"],
    ["category", "Kategoriye Göre"],
    ["qty", "Mevcuda Göre (azdan çoğa)"],
    ["value", "Değere Göre (çoktan aza)"],
  ];
  const canManage = () => HOF.can("stock.manage");
  const canMove = () => HOF.can("stock.move");
  const moduleName = () => HOF.uiLabel?.("side.stock", "Stok") || "Stok";
  const stateBadge = item =>
    item.kind === "service" ? '<span class="hof-plan-badge is-info" title="Hizmet kalemi: miktar ve kritik seviye izlenmez">Hizmet</span>' : item.qty <= 0 && (item.minQty > 0 || item.qtyIn > 0) ? '<span class="hof-plan-badge is-late">Tükendi</span>' : item.low ? '<span class="hof-plan-badge is-soon">Kritik</span>' : "";

  let modal = null;
  const view = { mode: "list", id: "", q: "", category: "", state: "all", sort: "name", list: null, item: null };
  // Binlerce kalemde ekran hızlı kalsın: sunucu 300'er satır gönderir; arama, süzgeç ve toplamlar tümünde çalışır.
  const PAGE = 300;
  let listRequest = 0;
  const body = () => modal?.dialog.querySelector("[data-stock]");
  const query = () => new URLSearchParams({ q: view.q, category: view.category, state: view.state, sort: view.sort });
  const listPdfUrl = () => `/api/workspace/stock/liste.pdf?${query()}&title=${encodeURIComponent(moduleName())}`;
  const listXlsxUrl = () => `/api/workspace/stock/export.xlsx?${query()}&title=${encodeURIComponent(moduleName())}`;
  const cardPdfUrl = item => `/api/workspace/stock/${encodeURIComponent(item.id)}/hareketler.pdf`;

  async function loadList({ more = false } = {}) {
    const ticket = ++listRequest;
    const offset = more && view.list ? view.list.items.length : 0;
    try {
      const data = await HOF.api(`/api/workspace/stock?${query()}&limit=${PAGE}&offset=${offset}`);
      if (ticket !== listRequest) return;
      view.list = more && view.list ? { ...data, items: [...view.list.items, ...data.items] } : data;
      if (view.mode === "list") renderList();
    } catch (error) {
      if (ticket === listRequest && view.mode === "list" && body()) body().innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }
  let cardRequest = 0;
  async function loadItem(id) {
    const ticket = ++cardRequest;
    const target = view.id;
    try {
      const item = await HOF.api(`/api/workspace/stock/${encodeURIComponent(id)}`);
      // Yanıt gelene kadar kullanıcı listeye döndü ya da başka ürün açtıysa eski kart geri gelmez.
      if (ticket !== cardRequest || view.id !== target) return;
      view.item = item;
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
  const applyItem = data => {
    if (view.id === data.id) view.item = data;
    if (modal) {
      if (view.mode === "card" && view.id === data.id) renderCard();
      loadList();
    }
    HOF.emit("stock-changed", { itemId: data.id });
  };

  function open(itemId = "") {
    if (!HOF.can("stock.view")) return HOF.toast(`${moduleName()} için yetkiniz yok.`, { type: "error" });
    if (modal) {
      if (itemId) loadItem(itemId);
      return;
    }
    modal = HOF.modal({
      title: moduleName(),
      eyebrow: "OPERASYON",
      size: "wide",
      body: '<div class="hof-plans hof-stock" data-stock><p class="hof-empty">Yükleniyor…</p></div>',
      onClose: () => {
        modal = null;
        view.mode = "list";
        view.id = "";
      },
    });
    modal.dialog.classList.add("hof-plans-modal", "hof-stock-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("change", onChange);
    modal.dialog.addEventListener("input", onInput);
    modal.dialog.addEventListener("keydown", event => {
      const row = event.target.closest?.("tr[data-item]");
      if (row && event.key === "Enter" && view.mode === "list" && !event.target.closest("button")) loadItem(row.dataset.item);
    });
    if (itemId) loadItem(itemId);
    else {
      renderList();
      loadList();
    }
  }

  // ---------- Liste ----------
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const manage = canManage();
    const move = canMove();
    const filtered = Boolean(view.q || view.category || view.state !== "all");
    const row = item => `<tr data-item="${esc(item.id)}" class="${item.low ? "is-overdue" : ""}" tabindex="0"><td class="hof-plan-no">${esc(item.code || "")}</td><td><b>${esc(item.name)}</b> ${stateBadge(item)}<small>${esc(item.category || "Kategorisiz")}${item.note ? ` · ${esc(item.note)}` : ""}</small></td><td class="num"><b class="hof-stock-qty${item.qty <= 0 ? " is-out" : item.low ? " is-low" : ""}">${esc(qtyText(item.qty))}</b> <small>${esc(item.unit)}</small></td><td class="num">${item.minQty ? `${esc(qtyText(item.minQty))} <small>${esc(item.unit)}</small>` : '<small class="hof-muted">—</small>'}</td><td class="num">${item.unitPrice ? esc(money(item.unitPrice)) : '<small class="hof-muted">—</small>'}</td><td class="num">${esc(money(item.value))}</td><td>${item.lastMove ? esc(HOF.formatDate(item.lastMove)) : '<small class="hof-muted">—</small>'}</td><td class="hof-cash-actions">${move ? `<button type="button" class="hof-mini hof-mini-text" data-quick="in" data-id="${esc(item.id)}" title="Giriş (alım, gelen)">+ Giriş</button><button type="button" class="hof-mini hof-mini-text" data-quick="out" data-id="${esc(item.id)}" title="Çıkış (kullanım, satış)">− Çıkış</button>` : ""}</td></tr>`;
    root.innerHTML = `<div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Durum">${STATES.map(item => `<button type="button" data-state="${item.id}" aria-pressed="${String(item.id === view.state)}">${item.label}${data && item.id !== "all" ? ` <b>${item.id === "low" ? data.totals.low : ""}</b>` : ""}</button>`).join("")}</div>
      <div class="hof-cash-add">${manage ? '<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Ürün</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import" title="Excel dosyasından ya da Google Sheets’ten ürünleri ve mevcut miktarları tek seferde aç">Excel / Sheets’ten Yükle</button>' : ""}</div></div>
      <div class="hof-plans-filters"><input type="search" data-filter="q" value="${esc(view.q)}" placeholder="Ürün adı, kod, kategori ara…" aria-label="Ara"><select data-filter="category" aria-label="Kategori"><option value="">Tüm Kategoriler</option>${(data?.categories || []).map(name => `<option value="${esc(name)}" ${name === view.category ? "selected" : ""}>${esc(name)}</option>`).join("")}</select><select data-filter="sort" aria-label="Sıralama">${SORTS.map(([id, label]) => `<option value="${id}" ${id === view.sort ? "selected" : ""}>${label}</option>`).join("")}</select>${office().outputButtons ? office().outputButtons(listPdfUrl(), "list").replace(/<\/span>$/, `<a class="hof-button hof-button-small hof-button-ghost" href="${esc(listXlsxUrl())}" title="Stok durumunu Excel olarak indir">Excel</a></span>`) : ""}</div>
      <div class="hof-kpis hof-plans-kpis">${data ? `<div><strong>${data.totals.count.toLocaleString("tr-TR")}</strong><span>Ürün</span></div><div class="${data.totals.low ? "is-late" : ""}"><strong>${data.totals.low}</strong><span>Kritik Seviyede</span></div><div class="${data.totals.out ? "is-late" : ""}"><strong>${data.totals.out}</strong><span>Tükenen</span></div><div class="hof-cash-balance"><strong>${esc(money(data.totals.value))}</strong><span>Stok Değeri</span></div>` : ""}</div>
      <div class="hof-cash-list hof-plans-list">${
        !data
          ? '<p class="hof-empty">Yükleniyor…</p>'
          : data.items.length
            ? `<table class="hof-table hof-cash-table hof-plans-table hof-stock-table"><thead><tr><th class="hof-plan-no">Kod</th><th>Ürün</th><th class="num">Mevcut</th><th class="num">Kritik Seviye</th><th class="num">Birim Fiyat</th><th class="num">Değer</th><th>Son Hareket</th><th></th></tr></thead><tbody>${data.items.map(row).join("")}</tbody></table>${data.hasMore ? `<div class="hof-more"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="more">Daha Fazla Göster · ${data.total - data.items.length} ürün daha</button></div>` : ""}`
            : `<p class="hof-empty">${filtered ? "Bu süzgeçte ürün yok." : "Henüz ürün yok."}${manage && !filtered ? " <b>+ Yeni Ürün</b> ile açın ya da <b>Excel’den Yükle</b> ile listenizi aktarın (ör. Çay, Şeker, Motor yağı)." : ""}</p>`
      }</div>
      <p class="hof-edit-meta">Mevcut = girişler − çıkışlar. Kritik seviyenin altına düşen ürün en üstte ve sol menüde uyarıyla görünür. Tutar = miktar × birim fiyat; istenirse Kasa’ya ya da cariye yazılır.</p>
      <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }

  // ---------- Kart ----------
  const payText = move => (move.pay === "cash" ? (move.kind === "in" ? (move.reason === "return" ? "Kasa’dan iade edildi" : "Kasa’dan ödendi") : "Kasa’ya tahsil edildi") : move.pay === "account" ? `Cari: ${move.accountName || "—"}` : "");
  function renderCard() {
    const root = body();
    const item = view.item;
    if (!root || !item) return;
    const manage = item.canManage;
    const move = item.canMove;
    const moveRow = row => `<tr data-kind="${esc(row.kind)}"><td>${esc(HOF.formatDate(row.date))}</td><td><b>${row.reason === "return" ? "Müşteri İadesi" : row.kind === "in" ? "Giriş" : "Çıkış"}</b><small>${esc([row.note, payText(row), row.actorName].filter(Boolean).join(" · "))}${row.updatedAt ? " · düzeltildi" : ""}</small></td><td class="num hof-cash-in">${row.kind === "in" ? esc(qtyText(row.qty)) : ""}</td><td class="num hof-cash-out">${row.kind === "out" ? esc(qtyText(row.qty)) : ""}</td><td class="num"><b>${esc(qtyText(row.balance))}</b></td><td class="num">${row.unitPrice ? esc(money(row.unitPrice)) : ""}</td><td class="num">${row.amount ? esc(money(row.amount)) : ""}</td><td class="hof-cash-actions">${row.pay === "account" && row.accountId ? `<button type="button" class="hof-mini" data-account="${esc(row.accountId)}" title="Cari kartını aç" aria-label="Cari kartını aç">↗</button>` : ""}${row.editable ? `<button type="button" class="hof-mini" data-edit-move="${esc(row.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-move="${esc(row.id)}" title="Sil" aria-label="Sil">×</button>` : ""}</td></tr>`;
    root.innerHTML = `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${item.code ? `<span class="hof-plan-refno" title="Kod">${esc(item.code)}</span>` : ""}${esc(item.name)} ${stateBadge(item)}</h3><small>${esc(item.category || "Kategorisiz")} · birim: ${esc(item.unit)}</small></div></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Ürün işlemleri">
          <span class="hof-plan-toolgroup">${move ? '<button type="button" class="hof-button hof-button-small" data-move="in">+ Giriş</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-move="out">− Çıkış</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-move="return" title="Müşterinin geri getirdiği ürün: stoğa girer, para Kasa’dan geri verilir ya da müşterinin borcundan düşer">↩ Müşteri İadesi</button>' : ""}</span>
          <span class="hof-plan-toolgroup">${office().outputButtons ? office().outputButtons(cardPdfUrl(item), "card") : ""}</span>
          ${manage ? '<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button><button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-act="delete">Sil</button></span>' : ""}
        </div></div>
      <div class="hof-kpis hof-plans-kpis"><div class="hof-cash-balance ${item.low ? "is-late" : ""}"><strong>${esc(qtyText(item.qty))} ${esc(item.unit)}</strong><span>Mevcut${item.minQty ? ` · kritik ${esc(qtyText(item.minQty))}` : ""}</span></div><div><strong class="hof-cash-in">${esc(qtyText(item.qtyIn))}</strong><span>Toplam Giriş · ${esc(money(item.inAmount))}</span></div><div><strong class="hof-cash-out">${esc(qtyText(item.qtyOut))}</strong><span>Toplam Çıkış · ${esc(money(item.outAmount))}</span></div><div><strong>${esc(money(item.value))}</strong><span>Değer · Birim Fiyat ${esc(money(item.unitPrice))}</span></div></div>
      ${item.note ? `<p class="hof-edit-meta">${esc(item.note)}</p>` : ""}
      <div class="hof-plan-section"><h4>Hareketler <span>${item.moves.length}</span></h4></div>
      <div class="hof-cash-list hof-plans-entries">${item.moves.length ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Giriş</th><th class="num">Çıkış</th><th class="num">Kalan</th><th class="num">Birim Fiyat</th><th class="num">Tutar</th><th></th></tr></thead><tbody>${item.moves.map(moveRow).join("")}</tbody></table>` : '<p class="hof-empty">Henüz hareket yok. <b>+ Giriş</b> ile alınanı, <b>− Çıkış</b> ile kullanılanı ya da satılanı girin.</p>'}</div>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Listeye Dön</button><button type="button" class="hof-button" data-close>Kapat</button></div>`;
  }

  // ---------- Formlar ----------
  function editItem(item) {
    const categories = view.list?.categories || [];
    HOF.formModal({
      title: item ? "Ürünü Düzenle" : "Yeni Ürün",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      fields: [
        { name: "kind", label: "Kalem Türü", type: "select", value: item?.kind || "product", options: [{ value: "product", label: "Ürün (stok tutulur)" }, { value: "service", label: "Hizmet (miktar ve kritik seviye izlenmez)" }], help: "Hizmet kalemleri kritik stok sayısına girmez; satış/alış tutarı Kasa'ya ya da cariye yine yazılabilir." },
        { name: "name", label: "Ürün / Hizmet Adı", required: true, maxlength: 160, value: item?.name || "", autofocus: true, placeholder: "Ör. Çay, Motor yağı 5W-30, Servis ücreti" },
        { name: "unit", label: "Birim", type: "choice", required: true, value: unitLabel(item?.unit) || "Adet", options: unitOptions(item?.unit), blankLabel: "— Birim Seçin —" },
        { name: "code", label: "Kod", maxlength: 60, value: item?.code || "", placeholder: "İsteğe bağlı (barkod, stok kodu)" },
        { name: "category", label: "Kategori", maxlength: 80, value: item?.category || "", list: categories, placeholder: "Ör. Mutfak, Araç, Kırtasiye" },
        { name: "minQty", label: "Kritik Seviye", inputmode: "decimal", value: item?.minQty ? qtyText(item.minQty) : "", placeholder: "Bu miktara inince uyarı verir (boş: uyarı yok)" },
        { name: "unitPrice", label: "Alış Fiyatı (₺)", inputmode: "decimal", value: item?.unitPrice ? office().amountText?.(item.unitPrice) || item.unitPrice : "", placeholder: "Son alış fiyatı (maliyet, stok değeri)" },
        // v2.0.13: satış fiyatı ayrı; çıkış (satış) formu bu fiyatla açılır.
        { name: "salePrice", label: "Satış Fiyatı (₺)", inputmode: "decimal", value: item?.salePrice ? office().amountText?.(item.salePrice) || item.salePrice : "", placeholder: "Raf/etiket fiyatı (satışta önerilir)" },
        // İlk miktar (v2.0.8): stoğa girer. Kasa'ya kendiliğinden gider yazılmaz; "Kasa'ya yansıt" işaretlenirse
        // miktar × birim fiyat Kasa'dan "Stok ödemesi" olarak düşer (kullanıcı kararı).
        ...(item
          ? []
          : [
              { name: "openingQty", label: "Miktar (stoğa girecek)", inputmode: "decimal", placeholder: "Ör. 10 (boş: şimdilik stok yok)" },
              { name: "openingCash", label: "Kasa’ya yansıt (miktar × birim fiyat Kasa’dan “Stok ödemesi” gideri olarak düşer)", type: "checkbox", value: false },
              { name: "openingDate", label: "Ödeme Tarihi", type: "date", max: "today", value: office().todayIso?.() || "" },
            ]),
        { name: "note", label: "Not", type: "textarea", rows: 2, maxlength: 1000, value: item?.note || "" },
      ],
      extraHtml: item ? "" : '<p class="hof-stock-total" data-opening-total aria-live="polite"></p>',
      submitLabel: item ? "Kaydet" : "Ürünü Aç",
      onOpen: item
        ? null
        : dialog => {
            const field = name => dialog.querySelector(`[name="${name}"]`);
            const total = dialog.querySelector("[data-opening-total]");
            const cashBox = field("openingCash").closest(".hof-check");
            const dateField = field("openingDate").closest(".hof-field");
            const sync = () => {
              const service = field("kind").value === "service";
              const unit = field("unit")?.value && field("unit").value !== HOF.OTHER_CHOICE ? field("unit").value : "";
              const qty = parseNumber(field("openingQty").value) || 0;
              const price = parseNumber(field("unitPrice").value) || 0;
              const toCash = field("openingCash").checked;
              field("openingQty").closest(".hof-field").hidden = service;
              if (cashBox) cashBox.hidden = service;
              dateField.hidden = service || !toCash;
              const qtyLabel = field("openingQty").closest(".hof-field").querySelector("span");
              if (qtyLabel) qtyLabel.textContent = `Miktar (stoğa girecek${unit ? `, ${unit}` : ""})`;
              if (service || !(qty > 0)) {
                total.innerHTML = service ? "" : "Miktar yazılırsa ürün o miktarla stoğa girer.";
                return;
              }
              const amount = Math.round(qty * price * 100) / 100;
              const line = `${esc(qtyText(qty))} ${esc(unit)}${price > 0 ? ` × ${esc(money(price))} = <b>${esc(money(amount))}</b>` : ""}`;
              if (!toCash) total.innerHTML = `${line} · stoğa girer; Kasa’ya yazılmaz (yansıtmak için kutuyu işaretleyin).`;
              else if (!(price > 0)) total.innerHTML = `${line} · <b class="hof-cash-out">Kasa’ya yansıtmak için birim fiyat girin.</b>`;
              else total.innerHTML = `${line} · Kasa’dan <b class="hof-cash-out">${esc(money(amount))}</b> “Stok ödemesi” gideri yazılır.`;
            };
            dialog.addEventListener("input", sync);
            dialog.addEventListener("change", sync);
            sync();
          },
      onSubmit: async data => {
        if (!item) {
          if (data.unit === HOF.OTHER_CHOICE) data.unit = "";
          // Kasa'ya yalnız kutu işaretliyse yazılır; işaretsizse ürün miktarıyla açılır, para yazılmaz.
          data.openingPay = data.openingCash && data.kind !== "service" && parseNumber(data.openingQty) > 0 ? "cash" : "none";
          delete data.openingCash;
          if (data.kind === "service" || !(parseNumber(data.openingQty) > 0)) {
            delete data.openingQty;
            delete data.openingDate;
          }
          if (data.openingPay === "cash" && !(parseNumber(data.unitPrice) > 0)) throw new Error("Kasa’ya yansıtmak için birim fiyat girin (tutar = miktar × birim fiyat).");
        }
        const result = item ? await HOF.api(`/api/workspace/stock/${encodeURIComponent(item.id)}`, { method: "PUT", body: data }) : await HOF.api("/api/workspace/stock", { method: "POST", body: data });
        if (!item && data.openingPay === "cash") HOF.emit("cash-changed");
        HOF.toast(item ? "Ürün güncellendi." : data.openingQty ? `Ürün açıldı: ${qtyText(result.qty)} ${result.unit} stokta${data.openingPay === "cash" ? "; Kasa’ya stok ödemesi yazıldı" : ""}.` : "Ürün açıldı.", { type: "success" });
        if (!modal) open(result.id);
        view.id = result.id;
        view.mode = "card";
        applyItem(result);
      },
    });
  }
  // Hareket formu: tutar anında hesaplanır; para seçenekleri yalnız yetkili rolde.
  function editMove(item, { kind = "in", move = null, reason = "" } = {}) {
    const type = move?.kind || kind;
    const incoming = type === "in";
    // v2.0.13: müşteri iadesi — satıştan dönen mal; alım değildir (Kasa'da "Satış iadesi", caride alacak).
    const back = (move?.reason || reason) === "return";
    const manage = canManage();
    // v2.0.13: "Satış Yapma" yetkisi — kasiyer satış ve iadede parayı (Kasa, kart, havale, veresiye) yazar.
    const sell = !move && HOF.can("stock.sell");
    // v2.0.13: para yolu — Nakit (Kasa), Kredi Kartı, Havale / EFT (Banka) ya da Açık Hesap (cari, veresiye).
    const moneyWays = verb => [
      { value: "cash", label: `Nakit (${verb})` },
      { value: "card", label: `Kredi Kartı (${verb})` },
      { value: "bank", label: `Havale / EFT (${verb})` },
    ];
    const payOptions = back
      ? [
          { value: "none", label: "Yalnız Miktar (değişim, para iadesi yok)" },
          ...(manage || sell ? [...moneyWays("müşteriye geri ödendi"), { value: "account", label: "Açık Hesap (müşterinin borcundan düş)" }] : []),
        ]
      : [
          { value: "none", label: "Yalnız Miktar (para yazılmaz)" },
          ...(manage || (sell && !incoming) ? [...moneyWays(incoming ? "ödendi" : "tahsil edildi"), { value: "account", label: incoming ? "Açık Hesap (tedarikçiye borçlanılır)" : "Açık Hesap (veresiye, müşteri borçlanır)" }] : []),
        ];
    const payValue = move ? (move.pay === "cash" ? move.method || "cash" : move.pay) : "none";
    const priceOf = () => (move ? move.unitPrice : !incoming || back ? item.salePrice || item.unitPrice : item.unitPrice);
    const canPlan = !incoming && !move && HOF.can?.("plans.manage");
    let accountField = null;
    const send = async (data, force = false) => {
      const url = `/api/workspace/stock/${encodeURIComponent(item.id)}/moves${move ? `/${encodeURIComponent(move.id)}` : ""}`;
      return HOF.api(url, { method: move ? "PUT" : "POST", body: { ...data, kind: type, force } });
    };
    HOF.formModal({
      title: move ? (back ? "İadeyi Düzelt" : incoming ? "Girişi Düzelt" : "Çıkışı Düzelt") : back ? "Müşteri İadesi" : incoming ? "Stok Girişi" : "Stok Çıkışı",
      eyebrow: `${item.name} · mevcut ${qtyText(item.qty)} ${item.unit}`,
      fields: [
        { name: "qty", label: `Miktar (${item.unit})`, required: true, inputmode: "decimal", value: move ? qtyText(move.qty) : "", autofocus: true, placeholder: incoming ? "Ör. 10" : "Ör. 2" },
        { name: "unitPrice", label: back ? "İade Birim Fiyatı (₺)" : incoming ? "Alış Birim Fiyatı (₺)" : "Satış Birim Fiyatı (₺)", inputmode: "decimal", value: priceOf() ? office().amountText?.(priceOf()) : "", placeholder: "İsteğe bağlı", help: !incoming && !move && item.salePrice ? `Satış fiyatı ${money(item.salePrice)}${item.unitPrice ? ` · alış ${money(item.unitPrice)}` : ""}` : "" },
        { name: "pay", label: incoming && !back ? "Ödeme Yolu" : back ? "İade Yolu" : "Tahsilat Yolu", type: "select", value: payValue, options: payOptions },
        { name: "date", label: "Tarih", type: "date", max: "today", value: move?.date || office().todayIso?.() || "" },
        { name: "note", label: "Açıklama", maxlength: 300, value: move?.note || "", placeholder: back ? "Ör. Ambalaj hasarlı, yanlış beden" : incoming ? "Ör. Toplu alım, market" : "Ör. Fiş 0124, ofis tüketimi" },
        // v2.0.13: veresiye satışı taksitlendir — satış borcu bir kez yazılır, kart bu borcu vadelere böler.
        ...(canPlan
          ? [
              { name: "planIt", label: "Bu Satışı Taksitlendir (satış tutarı müşterinin borcuna bir kez yazılır, taksitlere bölünür)", type: "checkbox", value: false },
              { name: "planCount", label: "Taksit Sayısı", inputmode: "numeric", value: "3" },
              { name: "planFirstDue", label: "İlk Vade", type: "date", value: "" },
            ]
          : []),
      ],
      extraHtml: '<p class="hof-stock-total" data-total aria-live="polite"></p>',
      submitLabel: move ? "Kaydet" : incoming ? "Girişi Kaydet" : "Çıkışı Kaydet",
      onOpen: dialog => {
        const qty = dialog.querySelector('input[name="qty"]');
        const price = dialog.querySelector('input[name="unitPrice"]');
        const pay = dialog.querySelector('select[name="pay"]');
        const total = dialog.querySelector("[data-total]");
        accountField = HOF.accounts?.picker?.({ value: move?.accountId ? { id: move.accountId, name: move.accountName } : {}, label: incoming && !back ? "Tedarikçi Carisi" : "Müşteri Carisi", type: "", required: true });
        const planBox = dialog.querySelector('input[name="planIt"]')?.closest(".hof-check");
        const planFields = ["planCount", "planFirstDue"].map(name => dialog.querySelector(`[name="${name}"]`)?.closest(".hof-field")).filter(Boolean);
        if (accountField) pay.closest(".hof-field").after(accountField);
        const sync = () => {
          const amount = (parseNumber(qty.value) || 0) * (parseNumber(price.value) || 0);
          const after = (item.qty || 0) + (incoming ? 1 : -1) * (parseNumber(qty.value) || 0) - (move ? (move.kind === "in" ? move.qty : -move.qty) : 0);
          total.innerHTML = `${amount > 0 ? `Tutar: <b>${esc(money(amount))}</b> · ` : ""}Hareketten sonra: <b class="${after < 0 ? "hof-cash-out" : ""}">${esc(qtyText(after))} ${esc(item.unit)}</b>`;
          if (accountField) accountField.hidden = pay.value !== "account";
          if (planBox) {
            planBox.hidden = pay.value !== "account";
            const on = pay.value === "account" && dialog.querySelector('input[name="planIt"]').checked;
            planFields.forEach(field => (field.hidden = !on));
            if (on && amount > 0) {
              const n = Math.max(1, Math.trunc(parseNumber(dialog.querySelector('input[name="planCount"]').value) || 1));
              total.innerHTML += ` · <b>${n} taksit</b> × ${esc(money(Math.round((amount / n) * 100) / 100))}`;
            }
          }
        };
        dialog.querySelector('input[name="planIt"]')?.addEventListener("change", sync);
        dialog.querySelector('input[name="planCount"]')?.addEventListener("input", sync);
        [qty, price].forEach(input => input.addEventListener("input", sync));
        pay.addEventListener("change", sync);
        sync();
      },
      onSubmit: async data => {
        if (data.pay !== "account") delete data.accountId;
        if (["cash", "card", "bank"].includes(data.pay)) {
          data.method = data.pay;
          data.pay = "cash";
        }
        if (back) data.reason = "return";
        if (data.planIt && data.pay === "account") {
          if (!(parseNumber(data.planCount) >= 1)) throw new Error("Taksit sayısını yazın.");
          if (!data.planFirstDue) throw new Error("Taksitlendirmek için ilk vadeyi seçin.");
          data.installments = { count: Math.trunc(parseNumber(data.planCount)), firstDue: data.planFirstDue, everyMonths: 1 };
        }
        ["planIt", "planCount", "planFirstDue"].forEach(key => delete data[key]);
        let result;
        try {
          result = await send(data);
        } catch (error) {
          // Stok eksiye düşecekse sorulur (sayım farkı olabilir); onaylanırsa kaydedilir.
          if (!/eksiye/.test(error.message) || String(error.data?.code || "").startsWith("cash-")) throw error;
          const ok = await HOF.confirm({ title: "Stok Eksiye Düşecek", message: `${error.message} Sayım farkı olabilir. Yine de kaydedilsin mi?`, confirmLabel: "Yine de Kaydet", danger: true });
          if (!ok) return true;
          result = await send(data, true);
        }
        applyItem(result);
        if (data.pay === "cash") HOF.emit("cash-changed");
        if (data.installments || result.trimmedPlans?.length) HOF.emit("plans-changed");
        HOF.toast(`${back ? "İade" : incoming ? "Giriş" : "Çıkış"} kaydedildi${data.installments ? `; ${data.installments.count} taksitlik kart açıldı` : ""}${result.trimmedPlans?.length ? `; taksit kartı iade kadar küçüldü (${result.trimmedPlans.map(plan => `${money(plan.from)} → ${money(plan.to)}`).join(", ")})` : ""}. Mevcut: ${qtyText(result.qty)} ${result.unit}${result.low ? " · kritik seviyede" : ""}.`, { type: result.low ? "error" : "success" });
        refreshAlerts();
      },
    });
  }
  async function deleteMove(item, move) {
    const ok = await HOF.confirm({ title: "Hareketi Sil", message: `${move.kind === "in" ? "Giriş" : "Çıkış"} (${qtyText(move.qty)} ${item.unit}) silinecek; mevcut miktar${move.pay === "cash" ? ", Kasa" : move.pay === "account" ? " ve cari bakiyesi" : ""} yeniden hesaplanır. Yönetim → Silinenler’den geri yüklenebilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyItem(await HOF.api(`/api/workspace/stock/${encodeURIComponent(item.id)}/moves/${encodeURIComponent(move.id)}`, { method: "DELETE" }));
      HOF.toast("Hareket silindi.", { type: "success" });
      refreshAlerts();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deleteItem(item) {
    const ok = await HOF.confirm({ title: "Ürünü Sil", message: `“${item.name}” silinecek. Ödenmiş/tahsil edilmiş tutarlar Kasa’da ve caride kalır. Yönetim → Silinenler’den geri yüklenebilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/stock/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      HOF.toast("Ürün silindi.", { type: "success" });
      view.mode = "list";
      view.id = "";
      renderList();
      loadList();
      refreshAlerts();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function quickMove(id, kind) {
    try {
      editMove(await HOF.api(`/api/workspace/stock/${encodeURIComponent(id)}`), { kind });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Excel'den yükleme ----------
  const ROLE_OPTIONS = [["", "— Kullanma —"], ["extra", "Ek Bilgi (kartta saklanır)"], ["name", "Ürün Adı *"], ["code", "Kod"], ["unit", "Birim"], ["category", "Kategori"], ["qty", "Mevcut Miktar (açılış stoku)"], ["price", "Alış Fiyatı (birim fiyat)"], ["salePrice", "Satış Fiyatı"], ["min", "Kritik Seviye"], ["note", "Not"]];
  async function importFromExcel() {
    const source = await office().chooseSheet?.({ title: "Ürünleri Toplu Yükle", eyebrow: moduleName().toLocaleUpperCase("tr-TR"), hint: "Binlerce kalem tek seferde açılır; miktar kolonu açılış stoku olur. Kolonları bir sonraki adımda eşlersiniz." });
    if (!source) return;
    try {
      const preview = await HOF.api("/api/workspace/stock/import/preview", { method: "POST", body: { matrix: source.matrix } });
      const sample = source.matrix[preview.headerAt + 1] || [];
      HOF.formModal({
        title: "Ürünleri Yükle: Kolonları Eşle",
        eyebrow: source.fileName,
        size: "wide",
        intro: `${preview.rows} satır bulundu. Her satır bir ürün olur; miktar kolonu açılış stoku olarak girilir (para yazılmaz). Aynı kodla ya da aynı ad ve birimle ürün varsa atlanır ya da güncellenir.`,
        fields: [
          ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, label]) => ({ value, label })) })),
          { name: "unit", label: "Birim kolonu yoksa", type: "choice", value: "Adet", options: unitOptions(), required: true, blankLabel: "— Birim Seçin —" },
          { name: "mode", label: "Aynı ürün zaten varsa", type: "select", value: "skip", options: [{ value: "skip", label: "Atla" }, { value: "update", label: "Bilgilerini Güncelle (miktar eklenmez)" }] },
        ],
        submitLabel: "Ürünleri Oluştur",
        onOpen: dialog => {
          dialog.classList.add("hof-import-form");
          office().wireGate?.(dialog, preview, source.matrix, "/api/workspace/stock/import/preview");
        },
        onSubmit: async data => {
          const roles = {};
          preview.headers.forEach((_, index) => {
            if (data[`c${index}`]) roles[index] = data[`c${index}`];
          });
          if (!Object.values(roles).includes("name")) throw new Error("Ürün adı kolonunu seçin.");
          const result = await HOF.api("/api/workspace/stock/import", { method: "POST", body: { matrix: source.matrix, headerAt: preview.headerAt, roles, unit: data.unit, mode: data.mode, fileName: source.fileName } });
          view.mode = "list";
          if (!modal) open();
          else {
            renderList();
            loadList();
          }
          refreshAlerts();
          const skipped = result.skipped.length ? ` ${result.skippedTotal || result.skipped.length} satır atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
          HOF.toast(`${result.created} ürün açıldı${result.opening ? `, ${result.opening} ürüne açılış stoku yazıldı` : ""}${result.updated ? `, ${result.updated} ürün güncellendi` : ""}.${skipped}`, { type: result.created || result.updated ? "success" : "error", timeout: 9000 });
        },
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Kritik stok uyarısı ----------
  // Sol menüde Stok rozeti; gün içinde ilk açılışta bir kez kısa bildirim (hangi ürünler kritik).
  const ALERT_DAY = "hof.stock.alerted";
  async function refreshAlerts() {
    if (!HOF.can("stock.view")) return;
    let alerts = [];
    try {
      alerts = await HOF.api("/api/workspace/stock/alerts");
    } catch {
      return;
    }
    const badge = document.querySelector('[data-badge="stock"]');
    if (badge) badge.textContent = alerts.length ? String(alerts.length) : "";
    if (!alerts.length) return;
    const today = new Date().toISOString().slice(0, 10);
    let shown = "";
    try {
      shown = localStorage.getItem(ALERT_DAY) || "";
    } catch {
      shown = today;
    }
    if (shown === today) return;
    try {
      localStorage.setItem(ALERT_DAY, today);
    } catch {
      // saklanamazsa her açılışta bir kez gösterilir
    }
    const names = alerts.slice(0, 4).map(item => `${item.name} (${qtyText(item.qty)} ${item.unit})`).join(", ");
    HOF.toast(`Kritik stok: ${names}${alerts.length > 4 ? ` ve ${alerts.length - 4} ürün daha` : ""}.`, { type: "error", timeout: 12000, action: { label: moduleName(), onClick: () => open() } });
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const quick = event.target.closest("[data-quick]");
    if (quick) return quickMove(quick.dataset.id, quick.dataset.quick);
    const row = event.target.closest("tr[data-item]");
    if (row && view.mode === "list" && !event.target.closest("button, a")) return loadItem(row.dataset.item);
    const button = event.target.closest("button, a[data-act]");
    if (!button) return;
    const item = view.item;
    if (button.dataset.state) {
      view.state = button.dataset.state;
      renderList();
      return loadList();
    }
    if (button.dataset.print) return office().printPdf?.(button.dataset.print === "list" ? listPdfUrl() : cardPdfUrl(item));
    if ("close" in button.dataset) return modal.close();
    if (button.dataset.account) {
      modal.close();
      return HOF.accounts?.open(button.dataset.account);
    }
    const act = button.dataset.act;
    if (act === "back") {
      view.mode = "list";
      view.id = "";
      renderList();
      return loadList();
    }
    if (act === "more") return loadList({ more: true });
    if (act === "new") return editItem(null);
    if (act === "import") return importFromExcel();
    if (!item) return;
    if (button.dataset.move === "return") return editMove(item, { kind: "in", reason: "return" });
    if (button.dataset.move) return editMove(item, { kind: button.dataset.move });
    if (act === "edit") return editItem(item);
    if (act === "delete") return deleteItem(item);
    const moveOf = id => item.moves.find(move => move.id === id);
    if (button.dataset.editMove) return editMove(item, { move: moveOf(button.dataset.editMove) });
    if (button.dataset.deleteMove) return deleteMove(item, moveOf(button.dataset.deleteMove));
  }
  function onChange(event) {
    const select = event.target.closest("select[data-filter]");
    if (!select) return;
    view[select.dataset.filter] = select.value;
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
    setTimeout(refreshAlerts, 1500);
    HOF.on("live:workspace.changed", change => {
      if (change?.kind !== "stock") return;
      refreshAlerts();
      if (!modal) return;
      if (view.mode === "card" && view.id && (!change.itemId || change.itemId === view.id)) loadItem(view.id);
      else if (view.mode === "list") loadList();
    });
    // v2.0.11: stok hareketi başka pencereden (Cari kartı, geri yükleme) değişince açık Stok penceresi de yenilenir.
    HOF.onLedger(["stock"], detail => {
      refreshAlerts();
      if (!modal || detail.path?.startsWith("/api/workspace/stock")) return;
      if (view.mode === "card" && view.id) loadItem(view.id);
      else if (view.mode === "list") loadList();
    }, 350);
  });
  HOF.stock = { open, refreshAlerts };
})();
