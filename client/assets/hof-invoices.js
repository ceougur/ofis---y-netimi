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
  const todayIso = () => meta?.today || HOF.office?.todayIso?.() || HOF.localToday();
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
  const curMoney = (value, currency = "TRY") => (currency === "TRY" ? money(value) : `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`);
  const kindLabel = kind => meta?.kinds?.[kind]?.label || kind;
  const sideOf = kind => meta?.kinds?.[kind]?.side || (["purchase", "purchase_return"].includes(kind) ? "purchase" : "sale");
  const isReturn = kind => Boolean(meta?.kinds?.[kind]?.return);
  const isOwn = kind => Boolean(meta?.kinds?.[kind]?.own);

  async function loadMeta(force = false) {
    if (meta && !force) return meta;
    meta = await HOF.api("/api/workspace/invoices/meta");
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
  const setMode = mode => {
    view.mode = mode;
    modal?.dialog.classList.toggle("is-form", mode === "form");
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

  async function loadList(more = false, { quiet = false } = {}) {
    // Sıra kuralları HOF.listGate'te (v2.0.22); arka plan yenilemesi en çok 2 bağlantılık arka plan kuyruğundan gider.
    const load = lists.start({ quiet, more });
    if (!load) return;
    if (!quiet && !more && view.listError) {
      view.listError = "";
      if (!view.list && view.mode === "list") renderList();
    }
    try {
      const offset = more && view.list ? view.list.invoices.length : 0;
      const data = await HOF.api(`/api/workspace/invoices?${listParams({ offset, limit: 200 })}`, quiet ? { background: true } : {});
      if (!load.current()) return;
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
    const e = edoc() && (doc.profile !== "KAGIT" || doc.eStatus === "withdrawn") && doc.eStatus && doc.eStatus !== "none" ? `<span class="hof-inv-pill is-e-${esc(doc.eStatus)}" title="e-Belge durumu">${esc(doc.eStatusLabel)}</span>` : "";
    return `${pay}${e}`;
  };
  const docTitle = doc => `${kindLabel(doc.kind)}${doc.displayNo ? ` ${doc.displayNo}` : ""}`;
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
        <div class="hof-plan-title"><h3>${esc(moduleName())}</h3><small>${edoc() ? "Satış, alış ve iade faturaları; e-Fatura ve e-Arşiv entegratör üzerinden gönderilir." : "Kaydedilen belgeler resmî hükmü olmayan <b>Müşteri Fişi</b> olarak basılır; e-Fatura / e-Arşiv bağlantısı kapalı."}</small></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Fatura işlemleri">
          ${canManage() ? '<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Fatura</button>' : ""}
          ${edoc() && canManage() && view.tab === "pending" && data?.invoices?.length ? `<button type="button" class="hof-button hof-button-small" data-act="send-pending" title="Listedeki belgeler sırayla entegratöre gönderilir; numara gönderimde verilir">Tümünü Gönder (${data.invoices.length.toLocaleString("tr-TR")})</button>` : ""}
          ${canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="settings">Fatura Ayarları</button>' : ""}
          <span class="hof-rep-export"><a class="hof-rep-out is-pdf" href="/api/workspace/invoices/liste.pdf?${esc(listParams())}" target="_blank" rel="noopener">Liste - PDF</a><a class="hof-rep-out is-xlsx" href="/api/workspace/invoices/export.xlsx?${esc(listParams())}" download>Liste - Excel</a></span>
        </div></div>
      <div class="hof-inv-tabs" role="tablist" aria-label="Fatura listeleri">${tabs.map(([id, label]) => `<button type="button" role="tab" class="hof-rep-chip ${view.tab === id ? "is-on" : ""}" aria-selected="${view.tab === id}" data-tab="${id}">${label}${id !== "inbox" && counts[id] ? ` <b>${counts[id].toLocaleString("tr-TR")}</b>` : ""}</button>`).join("")}</div>
      ${t ? `<div class="hof-rep-stats">${tile("Toplam (KDV Dahil)", t.payable, "", `${t.issued.toLocaleString("tr-TR")} belge`)}${tile("KDV", t.vat)}${tile("Açık Bakiye", t.open, t.open > 0 ? "is-receivable" : "")}${tile("Vadesi Geçmiş", t.overdue, t.overdue > 0 ? "is-payable" : "")}</div>` : ""}
      <div class="hof-plans-filters hof-chq-filters hof-inv-filters">
        <div class="hof-rep-presets" role="group" aria-label="Tarih">${PRESETS.map(([id, label]) => `<button type="button" class="hof-rep-chip ${view.preset === id && (id || (!view.from && !view.to)) ? "is-on" : ""}" data-preset="${id}">${label}</button>`).join("")}</div>
        <label class="hof-rep-date"><span>Başlangıç</span><input type="date" data-filter="from" value="${esc(view.from)}"></label>
        <label class="hof-rep-date"><span>Bitiş</span><input type="date" data-filter="to" value="${esc(view.to)}"></label>
        <select data-filter="pay" aria-label="Ödeme durumu">${PAY_OPTIONS.map(([id, label]) => `<option value="${id}" ${view.pay === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        ${edoc() ? `<select data-filter="profile" aria-label="Belge türü"><option value="">Tüm Belge Türleri</option>${Object.entries(meta.profiles).map(([id, label]) => `<option value="${id}" ${view.profile === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>` : ""}
        <input type="search" data-filter="q" value="${esc(view.q)}" placeholder="No, cari, ürün, VKN, not ara…" aria-label="Ara">
        ${accountChip}
      </div>
      <div class="hof-acc-selbar${selected ? " is-active" : ""}"><span>${selected ? `<b>${selected.toLocaleString("tr-TR")}</b> belge seçildi` : canManage() ? "Toplu yazdırmak, kaydetmek, iptal etmek ya da silmek için satırları işaretleyin." : "Toplu yazdırmak için satırları işaretleyin."}</span>${selected ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/toplu.pdf?ids=${esc(selIds)}" target="_blank" rel="noopener">Seçilenleri PDF</a><a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/export.xlsx?ids=${esc(selIds)}" download>Seçilenleri Excel</a>${edoc() ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/ubl.zip?ids=${esc(selIds)}" download>e-Belge XML (ZIP)</a>` : ""}${canManage() && selectedBy("draft").length ? `<button type="button" class="hof-button hof-button-small" data-act="bulk-issue">Seçilenleri Kaydet (${selectedBy("draft").length})</button>` : ""}${canManage() && selectedBy("issued").length ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="bulk-cancel">Seçilenleri İptal Et (${selectedBy("issued").length})</button>` : ""}${canManage() ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="bulk-delete" title="Seçilen belgeler Silinenler'e gider; kaydedilmiş belgenin etkileri iptaldeki gibi geri alınır">Seçilenleri Sil (${selected})</button>` : ""}<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="clear-sel">Seçimi Temizle</button>` : ""}</div>
      ${
        data
          ? `<div class="hof-rep-table"><table class="hof-table hof-chq-table hof-inv-table"><thead><tr><th class="hof-inv-check"><input type="checkbox" data-sel-all aria-label="Listedekilerin hepsini seç" ${data.invoices.length && data.invoices.every(doc => view.selected.has(doc.id)) ? "checked" : ""}></th><th>Tarih</th><th>No</th><th>Cari</th><th>Durum</th><th class="num">Tutar</th><th class="num">Açık</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="hof-empty">${emptyText()}</td></tr>`}</tbody></table></div>
        <p class="hof-rep-note">${data.total.toLocaleString("tr-TR")} belge${data.hasMore ? ` · <button type="button" class="hof-link-button" data-act="more">Daha Fazla Göster</button>` : ""}</p>`
          : HOF.listPending(view.listError)
      }`,
    );
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
    if (act === "settings") return showSettings();
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
    if (view.mode === "settings") return event.target.matches("[data-logo-file]") ? pickLogo(event.target) : undefined;
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
  const blankLine = (vat = meta?.settings?.defaults?.vatRate ?? 20) => ({ key: newKey(), itemId: "", name: "", code: "", description: "", unit: "Adet", qty: "1", unitPrice: "", discountRate: "", vatRate: String(vat), withholdingCode: "", exemptionCode: "", expenseCode: "", originLineId: "", left: null, available: null, itemKind: "", prices: null, more: false, net: null, newItem: false, newSalePrice: "" });
  const lineFrom = (line, { keepOrigin = false } = {}) => ({
    ...blankLine(line.vatRate),
    itemId: line.itemId || "",
    name: line.name || "",
    code: line.code || "",
    description: line.description || "",
    unit: line.unit || "Adet",
    qty: amountText(line.qty ?? 1),
    unitPrice: amountText(line.unitPrice ?? ""),
    discountRate: line.discountRate ? amountText(line.discountRate) : "",
    vatRate: String(line.vatRate ?? 20),
    withholdingCode: line.withholdingCode || "",
    exemptionCode: line.exemptionCode || "",
    expenseCode: line.expenseCode || "",
    originLineId: keepOrigin ? line.originLineId || "" : "",
    more: Boolean(line.description || line.withholdingCode || line.exemptionCode),
  });
  const ISSUE_LABELS = { sale: "Faturayı Kaydet", smm: "Makbuzu Kaydet", purchase: "Faturayı Kaydet", sale_return: "İadeyi Kaydet", purchase_return: "İade Faturasını Kaydet" };
  // v2.1.0 Aşama 7: peşin satırın satır anahtarı (lineKey; Düzenle'de sunucu eski satırla bu anahtarla eşler) ve banka hesabı. issued: kaydedilmiş
  // belgenin Düzenle'si — hesapsız eski havale satırı "Atanmamış (Eski Hareket)" olarak açılır (dokunulmazsa bağsız kalır).
  const lineKey = () => `k${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  // K2: alış tarafında (alış faturası, alıştan iade) kart yolu kurumsal kartla ödeme / kurumsal karta iadedir; satırın hesabı Kurumsal Kart.
  // legacyMethod: hesapsız eski satırın yolu ("Atanmamış (Eski Hareket)" seçeneği yalnız o yolda kalır).
  const payFrom = (payment, { issued = false, corporate = false } = {}) => ({
    cash: (payment?.cash || []).map((item, index) => {
      const method = item.method || "cash";
      const legacy = issued && (method === "bank" || (method === "card" && corporate)) && !item.bankAccountId;
      return { amount: amountText(item.amount), method, lineKey: /^[A-Za-z0-9_-]{1,40}$/.test(String(item.lineKey || "")) ? item.lineKey : `i${index}`, bankAccountId: item.bankAccountId || "", legacy, legacyMethod: legacy ? method : "" };
    }),
    cheques: (payment?.cheques || []).map(item => ({ instrument: item.instrument || "cheque", amount: amountText(item.amount), dueDate: item.dueDate || "", serialNo: item.serialNo || "", bank: item.bank || "", drawer: item.drawer || "" })),
    endorse: [...(payment?.endorse || [])],
    rest: payment?.rest === "installments" ? "installments" : "open",
    dueDate: payment?.dueDate || "",
    installments: { count: String(payment?.installments?.count || 3), firstDue: payment?.installments?.firstDue || "", everyMonths: String(payment?.installments?.everyMonths || 1) },
  });

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
      number: draft?.kind && !isOwn(draft.kind) ? draft.number || "" : "",
      paperNo: draft?.paperNo || "",
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
      form.original = { id: original.id, number: original.displayNo || original.number, issueDate: original.issueDate, accountName: original.accountName, payableTotal: original.payableTotal, currency: original.currency };
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
    const currencies = meta.currencies.map(item => `<option value="${esc(item.code)}" ${item.code === form.currency ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)}</option>`).join("");
    const numberField =
      form.kind === "purchase"
        ? `<label class="hof-field"><span>Tedarikçinin Fatura No <i aria-hidden="true">*</i></span><input data-f="number" maxlength="40" value="${esc(form.number)}" placeholder="Faturanın üstündeki No"></label>`
        : form.kind === "sale_return"
          ? `<label class="hof-field"><span>Müşterinin İade Faturası No</span><input data-f="number" maxlength="40" value="${esc(form.number)}" placeholder="Yoksa boş bırakın"><small>Müşteri iade faturası kesmediyse boş bırakın; program iç numara verir.</small></label>`
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
      <details class="hof-inv-more-head" ${form.orderNo || form.despatchNo || form.paperNo ? "open" : ""}><summary>Sipariş, İrsaliye ve Kâğıt Fatura No</summary>
        <div class="hof-inv-head">
          <label class="hof-field"><span>Sipariş No</span><input data-f="orderNo" maxlength="60" value="${esc(form.orderNo)}"></label>
          <label class="hof-field"><span>Sipariş Tarihi</span><input type="date" data-f="orderDate" value="${esc(form.orderDate)}"></label>
          <label class="hof-field"><span>İrsaliye No</span><input data-f="despatchNo" maxlength="60" value="${esc(form.despatchNo)}"></label>
          <label class="hof-field"><span>İrsaliye Tarihi</span><input type="date" data-f="despatchDate" value="${esc(form.despatchDate)}"></label>
          ${own ? `<label class="hof-field"><span>Kâğıt Fatura No</span><input data-f="paperNo" maxlength="40" value="${esc(form.paperNo)}"><small>Elle kesilen matbu faturanın seri ve numarası (varsa); fiş onunla eşleşir.</small></label>` : ""}
        </div>
      </details>
      <section class="hof-inv-lines-wrap">
        <div class="hof-plan-section"><h4>Kalemler</h4>
          <span class="hof-inv-line-tools">
            ${ret ? "" : `<label class="hof-rep-check"><input type="checkbox" data-f="pricesIncludeVat" ${form.pricesIncludeVat ? "checked" : ""}> Fiyatlar KDV Dahil</label>`}
            ${ret ? "" : `<label class="hof-inv-mini"><span>Genel İskonto %</span><input data-f="discountRate" inputmode="decimal" value="${esc(form.discountRate)}" placeholder="0"></label>`}
            ${ret ? "" : `<label class="hof-inv-mini" title="Seçilen oran bütün kalemlere yazılır; sonra kalemde tek tek değiştirilebilir. Yeni eklenen kalem de bu oranı alır."><span>Tüm Kalemlere KDV</span><select data-f="allVat" aria-label="Tüm kalemlere KDV oranı"><option value="">Seçin</option>${vatOptions("-")}</select></label>`}
            ${["smm", "purchase"].includes(form.kind) ? `<label class="hof-inv-mini"><span>Stopaj %</span><input data-f="stoppageRate" inputmode="decimal" value="${esc(form.stoppageRate)}" placeholder="${form.kind === "smm" ? "otomatik" : "0"}"></label>` : ""}
            ${form.kind === "smm" ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="gross-from-net" title="Eline geçecek net tutardan brüt ücreti hesaplar">Netten Brüte</button>' : ""}
          </span>
        </div>
        <div class="hof-rep-table hof-inv-lines-scroll"><table class="hof-table hof-inv-lines"><thead><tr><th>#</th><th>Stok Kodu</th><th>Ürün / Hizmet</th><th class="num">Miktar</th><th>Birim</th><th class="num">Birim Fiyat</th><th class="num">İsk. %</th><th>KDV</th>${hasExpenseCol(form) ? "<th>Gider Türü</th>" : ""}<th class="num">Tutar</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
        ${ret ? "" : `<div class="hof-inv-add"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="add-line">+ Kalem Ekle</button><small>${offersNewItem(form) ? "Stok Kodu ya da ürün adı yazın; stokta yoksa listeden “+ Yeni Stok Kartı” ile kart açılır (fatura kaydedilince)." : form.kind === "purchase" ? "Stok Kodu ya da ad yazın; stokta olmayan ad gider kalemi olur." : "Stok Kodu (barkod) ya da ürün adı yazın; stoktaki ürünler listelenir. Listede olmayan ad hizmet kalemi olur."}</small></div>`}
        <datalist id="hof-inv-units">${(meta.units || []).map(unit => `<option value="${esc(unit)}"></option>`).join("")}</datalist>
      </section>
      <div class="hof-inv-bottom">
        <section class="hof-inv-pay" data-pay></section>
        <section class="hof-inv-sum" data-totals></section>
      </div>
      <label class="hof-field hof-inv-note"><span>Not (Belgenin Altına Basılır)</span><textarea data-f="note" rows="2" maxlength="2000" placeholder="ör. Teslim adresi, garanti süresi, banka bilgisi…">${esc(form.note)}</textarea></label>
      <p class="hof-form-error" role="alert" data-form-error></p>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="cancel-form">Vazgeç</button>${form.modifyId ? '<button type="button" class="hof-button" data-act="issue" title="Eski stok, cari, Kasa, taksit ve çek/senet kayıtları geri alınır, yenileri yazılır; numara değişmez">Değişiklikleri Kaydet</button>' : `<button type="button" class="hof-button hof-button-ghost" data-act="save-draft">Taslak Olarak Kaydet</button>${sendable(form) ? '<button type="button" class="hof-button hof-button-ghost" data-act="issue-later" title="Stok, cari, Kasa, taksit ve çek/senet şimdi işlenir; belge Gönderilecekler\'de bekler">Kaydet, Sonra Gönder</button><button type="button" class="hof-button" data-act="issue-now">Kaydet ve Gönder</button>' : `<button type="button" class="hof-button" data-act="issue">${esc(ISSUE_LABELS[form.kind] || "Kaydet")}</button>`}`}</div>`,
    );
    if (!ret) mountAccountPicker();
    if (ret) renderReturn();
    renderLines();
    renderPay();
    renderTotals();
    scheduleCalc(0);
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
      onPick: account => applyPickedAccount(account),
    });
    // v2.0.15 (QA A5): cari yoksa formdan ayrılmadan açılır; kaydedilince seçili gelir, fiyatlar ve toplamlar yenilenir.
    const canNew = HOF.accounts?.newFor && HOF.can("accounts.manage") && !isReturn(form.kind);
    if (!canNew) return slot.replaceChildren(picker);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "hof-button hof-button-small hof-button-ghost hof-inv-account-new";
    add.textContent = "+ Yeni Cari";
    add.title = form.side === "purchase" ? "Tedarikçi kartı aç" : "Müşteri kartı aç";
    add.onclick = () => HOF.accounts.newFor({ type: form.side === "purchase" ? "supplier" : "customer" }, { onSaved: account => {
      if (view.form !== form) return;
      applyPickedAccount(account);
      mountAccountPicker();
      HOF.toast(`${account.name} seçildi.`, { type: "info" });
    } });
    const row = document.createElement("div");
    row.className = "hof-inv-account-row";
    row.append(picker, add);
    slot.replaceChildren(row);
  }
  function applyPickedAccount(account) {
    const form = view.form;
    if (!form) return;
    form.account = account?.id ? { id: account.id, name: account.name } : null;
    form.profile = "";
    form.portfolio = null;
    for (const line of form.lines) line.prices = null;
    refreshAllPrices();
    scheduleCalc(0);
  }

  // İade edilecek faturayı bulan arama (en üstte).
  function renderReturn() {
    const form = view.form;
    const slot = body()?.querySelector("[data-return]");
    if (!slot || !form) return;
    const side = form.kind === "purchase_return" ? "purchase" : "sale";
    const hits = form.returnHits;
    slot.innerHTML = form.original
      ? `<div class="hof-inv-return-chosen"><span>İade Edilen Fatura</span><b><a href="#" data-open-invoice="${esc(form.original.id)}">${esc(form.original.number)}</a></b><small>${esc(form.original.accountName)} · ${esc(HOF.formatDate(form.original.issueDate))} · ${esc(curMoney(form.original.payableTotal, form.original.currency))}</small>${form.id ? "" : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="change-original">Başka Fatura Seç</button>'}</div>`
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
  // ---------- Kalemler ----------
  const vatOptions = value => (meta.vatRates || [0, 1, 10, 20]).map(rate => `<option value="${rate}" ${String(rate) === String(value) ? "selected" : ""}>%${rate}</option>`).join("");
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
        const stockNote = line.newItem && !line.itemId ? `<span class="hof-inv-newitem"><b>Yeni Stok Kartı Açılacak</b> · Satış Fiyatı <input data-l="${index}" data-f="newSalePrice" inputmode="decimal" value="${esc(line.newSalePrice)}" placeholder="isteğe bağlı" aria-label="Yeni stok kartının satış fiyatı"> <button type="button" class="hof-link-button" data-act="new-item-cancel" data-l="${index}">Vazgeç</button></span>` : line.itemId ? `${line.itemKind === "service" ? "Hizmet Kartı" : line.available !== null && line.available !== undefined ? (line.available < 0 ? `<span class="hof-inv-warn">Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)} (eksi)</span>` : `Stokta ${esc(String(line.available).replace(".", ","))} ${esc(line.unit)}`) : "Stok Kartı"}` : line.name ? (offersNewItem(form) ? '<span class="hof-inv-warn">Stok kartı yok: gider sayılır, stoğa girmez. Mal ise listeden “+ Yeni Stok Kartı”nı seçin.</span>' : form.kind === "purchase" ? "Stoksuz: gider / hizmet kalemi" : "Stoksuz: hizmet kalemi") : "";
        const more = `<div class="hof-inv-line-more" ${line.more ? "" : "hidden"}>
            <label><span>Açıklama</span><input data-l="${index}" data-f="description" maxlength="300" value="${esc(line.description)}" ${ret ? "readonly" : ""}></label>
            ${saleSide ? `<label><span>KDV Tevkifatı</span><select data-l="${index}" data-f="withholdingCode"><option value="">Yok</option>${(meta.withholding || []).map(item => `<option value="${esc(item.code)}" ${item.code === line.withholdingCode ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)} (${item.num}/${item.den})</option>`).join("")}</select></label>` : ""}
            ${String(line.vatRate) === "0" && !ret ? `<label><span>KDV İstisna Nedeni</span><select data-l="${index}" data-f="exemptionCode"><option value="">Seçin</option>${(meta.exemptions || []).map(item => `<option value="${esc(item.code)}" ${item.code === line.exemptionCode ? "selected" : ""}>${esc(item.code)} · ${esc(item.label)}</option>`).join("")}</select></label>` : ""}
          </div>`;
        return `<tr class="hof-inv-line" data-line="${index}">
          <td class="hof-inv-no">${index + 1}</td>
          <td class="hof-inv-code"><input data-l="${index}" data-f="code" value="${esc(line.code)}" maxlength="60" autocomplete="off" placeholder="Kod / Barkod" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem Stok Kodu"></td>
          <td class="hof-inv-name"><div class="hof-inv-item"><input data-l="${index}" data-f="name" value="${esc(line.name)}" maxlength="200" autocomplete="off" placeholder="Ürün ya da hizmet adı…" ${ret ? "readonly" : ""} aria-label="${index + 1}. kalem adı"><ul class="hof-inv-item-hits" data-hits="${index}" hidden></ul></div><small>${stockNote}${ret ? ` · En çok ${esc(String(line.left).replace(".", ","))} ${esc(line.unit)}` : ""}</small>${more}</td>
          <td><input class="num" data-l="${index}" data-f="qty" inputmode="decimal" value="${esc(line.qty)}" aria-label="Miktar"></td>
          <td><input data-l="${index}" data-f="unit" value="${esc(line.unit)}" list="hof-inv-units" maxlength="20" ${ret || line.itemId ? "readonly" : ""} aria-label="Birim"></td>
          <td><input class="num" data-l="${index}" data-f="unitPrice" inputmode="decimal" value="${esc(line.unitPrice)}" placeholder="0,00" ${ret ? "readonly" : ""} aria-label="Birim fiyat"></td>
          <td><input class="num hof-inv-narrow" data-l="${index}" data-f="discountRate" inputmode="decimal" value="${esc(line.discountRate)}" placeholder="0" ${ret ? "readonly" : ""} aria-label="İskonto yüzdesi"></td>
          <td><select data-l="${index}" data-f="vatRate" ${ret ? "disabled" : ""} aria-label="KDV oranı">${vatOptions(line.vatRate)}</select></td>
          ${expense ? `<td>${line.itemId ? '<small class="hof-muted">Stok</small>' : `<select data-l="${index}" data-f="expenseCode" aria-label="Gider türü">${(meta.expenses || []).map(item => `<option value="${esc(item.code)}" ${item.code === (line.expenseCode || "other") ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>`}</td>` : ""}
          <td class="num" data-line-net>${line.net === null ? "—" : esc(curMoney(line.net, form.currency))}</td>
          <td class="hof-inv-line-actions">${ret ? "" : `<button type="button" class="hof-mini" data-act="line-more" data-l="${index}" title="Açıklama, tevkifat, istisna" aria-label="Kalem ayrıntısı">⋯</button><button type="button" class="hof-mini hof-mini-danger" data-act="line-remove" data-l="${index}" title="Kalemi sil" aria-label="Kalemi sil">×</button>`}</td>
        </tr>
        <tr class="hof-inv-hint-row" data-hint="${index}" ${line.prices ? "" : "hidden"}><td></td><td colspan="${cols - 1}">${priceHint(line, index)}</td></tr>`;
      })
      .join("");
    HOF.swap(tbody, rows);
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
  function pickItem(index, itemId) {
    const form = view.form;
    const list = body()?.querySelector(`[data-hits="${index}"]`);
    const items = JSON.parse(list?.dataset.items || "[]");
    const item = items.find(entry => entry.id === itemId);
    const line = form?.lines[index];
    if (!item || !line) return;
    // Önce odaktaki kutudan çık: çıkarken tetiklenen "change" yazılan değeri ("fk-a4") satıra geri yazmasın; sonra
    // kartın adı ve Stok Kodu yazılır ve satır yeniden çizilir (odak korunması yazılan metni de geri getirmez).
    document.activeElement?.blur?.();
    Object.assign(line, { itemId: item.id, name: item.name, code: item.code || "", unit: item.unit || "Adet", itemKind: item.kind, available: item.available, newItem: false, newSalePrice: "" });
    const price = form.side === "sale" ? item.salePrice : item.unitPrice;
    if (price > 0 && !line.unitPrice) line.unitPrice = amountText(form.pricesIncludeVat ? Math.round(price * (1 + Number(line.vatRate || 0) / 100) * 100) / 100 : price);
    if (list) list.hidden = true;
    renderLines();
    loadPrices(index);
    scheduleCalc();
    body()?.querySelector(`[data-l="${index}"][data-f="qty"]`)?.focus();
  }
  // "+ Yeni Stok Kartı": kalem stoklu mal olur; kart, fatura (ya da taslak) kaydedilince aynı işlemde açılır.
  function markNewItem(index) {
    const line = view.form?.lines[index];
    if (!line) return;
    Object.assign(line, { newItem: true, itemId: "", itemKind: "", available: null, expenseCode: "" });
    hideHits();
    renderLines();
    scheduleCalc(0);
    body()?.querySelector(`[data-l="${index}"][data-f="unit"]`)?.focus();
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
  const methodOptions = value => Object.entries(refundMethods(view.form?.kind)).map(([id, label]) => `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(typeof label === "string" ? label : label.label || id)}</option>`).join("");
  const paidSum = form => [...form.pay.cash, ...form.pay.cheques].reduce((sum, item) => sum + amountNum(item.amount), 0) + (form.portfolio || []).filter(item => form.pay.endorse.includes(item.id)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  function renderPay() {
    const form = view.form;
    const slot = body()?.querySelector("[data-pay]");
    if (!slot || !form) return;
    const ret = isReturn(form.kind);
    const sale = form.side === "sale";
    const payable = form.calc ? form.calc.try?.payable ?? form.calc.totals.payable : 0;
    const chequeOk = meta.canCheques && ["sale", "smm", "purchase"].includes(form.kind);
    const cashWord = ret ? (form.kind === "sale_return" ? "Müşteriye İade Ödemesi" : "Tedarikçiden İade Tahsilatı") : sale ? "Peşin Tahsilat" : "Peşin Ödeme";
    const cashRows = form.pay.cash
      .map((item, index) => `<div class="hof-inv-pay-row"><label><span>${esc(cashWord)} (₺)</span><input data-pay="cash" data-i="${index}" data-f="amount" inputmode="decimal" value="${esc(item.amount)}" placeholder="0,00"></label><label><span>${sale ? "Tahsilat Yolu" : "Ödeme Yolu"}</span><select data-pay="cash" data-i="${index}" data-f="method">${methodOptions(item.method)}</select></label>${bankCell(item, index)}<button type="button" class="hof-mini hof-mini-danger" data-act="pay-remove" data-pay="cash" data-i="${index}" aria-label="Sil" title="Sil">×</button></div>`)
      .join("");
    const chequeRows = form.pay.cheques
      .map(
        (item, index) => `<div class="hof-inv-pay-row is-cheque"><label><span>Evrak</span><select data-pay="cheques" data-i="${index}" data-f="instrument"><option value="cheque" ${item.instrument === "cheque" ? "selected" : ""}>Çek</option><option value="note" ${item.instrument === "note" ? "selected" : ""}>Senet</option></select></label><label><span>Tutar (₺)</span><input data-pay="cheques" data-i="${index}" data-f="amount" inputmode="decimal" value="${esc(item.amount)}"></label><label><span>Vade</span><input type="date" data-pay="cheques" data-i="${index}" data-f="dueDate" value="${esc(item.dueDate)}" min="${esc(form.issueDate)}"></label><label><span>No</span><input data-pay="cheques" data-i="${index}" data-f="serialNo" maxlength="60" value="${esc(item.serialNo)}"></label><label><span>Banka / Şube</span><input data-pay="cheques" data-i="${index}" data-f="bank" maxlength="120" value="${esc(item.bank)}"></label>${sale ? `<label><span>Keşideci</span><input data-pay="cheques" data-i="${index}" data-f="drawer" maxlength="160" value="${esc(item.drawer)}" placeholder="Boşsa cari"></label>` : ""}<button type="button" class="hof-mini hof-mini-danger" data-act="pay-remove" data-pay="cheques" data-i="${index}" aria-label="Sil" title="Sil">×</button></div>`,
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
        <button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-add-cash">+ ${esc(cashWord)}</button>
        ${!ret ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-all-cash" ${payable > 0 ? "" : "disabled"}>Tamamı Peşin</button>` : ""}
        ${chequeOk ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-add-cheque">+ Çek / Senet</button>` : ""}
        ${form.kind === "purchase" && chequeOk && !form.portfolio ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="pay-endorse">Portföyden Ciro Et</button>' : ""}
      </div>
      <div data-pay-rest>${restBlock}</div>`;
    const box = slot.querySelector("[data-pay-rest]");
    if (box) box.hofHtml = restBlock;
    if (!view.bankChoices) loadBankChoices();
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
    if (!data || (!list.length && !current)) return `<span class="hof-inv-bank" data-bank-cell="${index}" data-bank-kind="${kind}" hidden></span>`;
    if (list.length === 1 && !legacy && (!item.bankAccountId || item.bankAccountId === list[0].id)) return `<span class="hof-inv-bank hof-bank-pick-note" data-bank-cell="${index}" data-bank-kind="${kind}" data-bank-single${hidden}>${esc(list[0].label)} ${card ? "kurumsal kartına" : "hesabına"} yazılır.</span>`;
    const options = current && !list.some(account => account.id === current.id) ? [current, ...list] : list;
    const first = legacy ? "Atanmamış (Eski Hareket)" : card ? "Kart Seçin" : "Hesap Seçin";
    const label = card ? "Kurumsal Kart" : "Banka Hesabı";
    return `<label class="hof-inv-bank" data-bank-cell="${index}" data-bank-kind="${kind}"${hidden}><span>${label}</span><select data-pay="cash" data-i="${index}" data-f="bankAccountId" aria-label="${label}"><option value="">${esc(first)}</option>${options.map(account => `<option value="${esc(account.id)}" ${account.id === item.bankAccountId ? "selected" : ""}>${esc(`${account.label} (${account.code})`)}</option>`).join("")}</select></label>`;
  }
  // Hesap listesi gelince yalnız boş hücreler doldurulur (içinde odaklanılacak alan yoktu; satır yeniden çizilmez).
  function loadBankChoices() {
    if (!HOF.bank?.choices || view.bankChoices) return;
    view.bankChoices = "loading";
    HOF.bank
      .choices()
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
      })
      .catch(() => {
        view.bankChoices = null;
      });
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
    cell.hidden = !kind || (!cell.querySelector("select") && !cell.hasAttribute("data-bank-single"));
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
    const problems = [...(c.partyProblems || []), ...(c.sellerProblems || []), ...(c.warnings || [])];
    slot.innerHTML = `<h4>Toplamlar</h4>
      <dl class="hof-inv-totals">
        ${totalRows({ includeVat: form.pricesIncludeVat, base: t.base, baseNet: t.baseNet, discountNet: t.discountNet, discount: t.discount, net: t.net }).map(([label, value]) => row(label, value)).join("")}
        ${t.byRate.map(item => row(`KDV %${item.rate}`, item.vat)).join("")}
        ${t.withheld > 0 ? row("KDV Tevkifatı", -t.withheld) : ""}
        ${t.stoppage > 0 ? row(`Gelir Vergisi Stopajı %${esc(String(c.stoppageRate))}`, -t.stoppage) : ""}
        ${row("Genel Toplam", t.gross, "is-total")}
        ${t.payable !== t.gross ? row(form.side === "sale" ? "Tahsil Edilecek" : "Ödenecek", t.payable, "is-payable") : ""}
        ${cur !== "TRY" ? `<div><dt>TL Karşılığı</dt><dd>${esc(money(c.try.payable))}</dd></div>` : ""}
      </dl>
      <p class="hof-inv-words">${esc(c.amountInWords || "")}</p>
      ${problems.length ? `<ul class="hof-inv-problems">${problems.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}`;
  }
  const lineBody = line => ({ itemId: line.itemId, name: line.name.trim(), code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice || "0", discountRate: line.discountRate || "0", vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.expenseCode, originLineId: line.originLineId, ...(line.newItem && !line.itemId ? { newItem: true, newSalePrice: line.newSalePrice || "0" } : {}) });
  const usedLines = form => form.lines.filter(line => line.itemId || line.name.trim() || line.originLineId);
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
    orderNo: form.orderNo,
    orderDate: form.orderDate,
    despatchNo: form.despatchNo,
    despatchDate: form.despatchDate,
    note: form.note,
    lines: usedLines(form).map(lineBody),
  });
  const payBody = form => ({
    cash: form.pay.cash.filter(item => amountNum(item.amount) > 0).map(item => ({ amount: item.amount, method: item.method, lineKey: item.lineKey, ...((item.method === "bank" || (item.method === "card" && form.side === "purchase")) && item.bankAccountId ? { bankAccountId: item.bankAccountId } : {}) })),
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
    const form = view.form;
    const button = body()?.querySelector('[data-pay] [data-act="pay-all-cash"]');
    if (button && form) button.disabled = !((form.calc ? form.calc.try?.payable ?? form.calc.totals.payable : 0) > 0);
    renderRest();
  }
  async function calcOnce() {
    const form = view.form;
    if (!form) return;
    if (!form.account || !usedLines(form).length) {
      form.calc = null;
      form.calcError = "";
      renderTotals();
      refreshPayAfterCalc();
      return;
    }
    const ticket = ++calcTicket;
    try {
      const calc = await HOF.api("/api/workspace/invoices/calc", { method: "POST", body: docBody(form) });
      if (ticket !== calcTicket || view.form !== form) return;
      form.calc = calc;
      form.calcError = "";
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
      if (next) next.innerHTML = form.modifyId ? (form.modifyNumber ? `<span>Belge No</span><b>${esc(form.modifyNumber)}</b>` : "") : calc.nextNumber ? `<span>Kaydedilince Verilecek No</span><b>${esc(calc.nextNumber)}</b>` : "";
    } catch (error) {
      if (ticket !== calcTicket || view.form !== form) return;
      form.calc = null;
      form.calcError = error.message;
      renderTotals();
      refreshPayAfterCalc();
    }
  }
  // Belge türü (e-Belge açıksa): GİB kuralına göre izin verilenler; tek seçenekse gizli.
  function renderProfile() {
    const form = view.form;
    const field = body()?.querySelector("[data-profile-field]");
    if (!field || !form?.calc) return;
    const profiles = form.calc.profiles || [];
    field.hidden = !edoc() || profiles.length < 2;
    form.profile = form.calc.profile;
    field.querySelector("select").innerHTML = profiles.map(item => `<option value="${esc(item.id)}" ${item.id === form.calc.profile ? "selected" : ""}>${esc(item.label)}</option>`).join("");
    field.querySelector("[data-profile-note]").textContent = form.calc.profile === "EARSIVFATURA" ? "Alıcı e-Fatura mükellefi değil: e-Arşiv kesilir." : form.calc.profile === "TEMELFATURA" || form.calc.profile === "TICARIFATURA" ? "Alıcı e-Fatura mükellefi: e-Fatura kesilir." : "";
  }

  // ---------- Form olayları ----------
  const HEAD_FIELDS = new Set(["issueDate", "issueTime", "profile", "currency", "rate", "number", "paperNo", "orderNo", "orderDate", "despatchNo", "despatchDate", "discountRate", "stoppageRate", "note"]);
  function formInput(event) {
    const form = view.form;
    const target = event.target;
    if (!form) return;
    if (target.matches("[data-return-q]")) {
      form.returnQuery = target.value;
      return searchReturnable(target.value.trim());
    }
    if (target.dataset.l !== undefined && target.dataset.f) {
      const line = form.lines[Number(target.dataset.l)];
      if (!line) return;
      const field = target.dataset.f;
      line[field] = target.type === "checkbox" ? target.checked : target.value;
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
    if (target.dataset.l !== undefined && target.dataset.f) {
      const line = form.lines[Number(target.dataset.l)];
      if (!line) return;
      line[target.dataset.f] = target.value;
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
      if (item && target.dataset.f === "bankAccountId") item.legacy = item.legacy && !target.value;
      return refreshRest();
    }
    if (target.dataset.f && HEAD_FIELDS.has(target.dataset.f)) {
      form[target.dataset.f] = target.value;
      if (target.dataset.f === "issueDate") renderPay();
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
  async function pickByCode(index, code) {
    clearTimeout(itemTimer);
    const own = ++itemTicket;
    let items = [];
    try {
      items = (await HOF.api(`/api/workspace/invoices/items?q=${encodeURIComponent(code)}`)).items;
    } catch {
      items = [];
    }
    if (own !== itemTicket) return;
    const exact = items.find(item => item.exact);
    const list = body()?.querySelector(`[data-hits="${index}"]`);
    if (!list) return;
    list.dataset.items = JSON.stringify(items);
    if (exact) return pickItem(index, exact.id);
    searchItems(index, code, "code");
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
        line.unitPrice = amountText(Math.round(Number(target.dataset.price) * 10000) / 10000);
        renderLines();
        scheduleCalc(0);
      }
      return;
    }
    const act = target.dataset.act;
    if (act === "add-line") return addLine();
    if (act === "new-item-cancel") {
      const line = form.lines[Number(target.dataset.l)];
      if (line) line.newItem = false;
      renderLines();
      return scheduleCalc(0);
    }
    if (act === "line-remove") {
      form.lines.splice(Number(target.dataset.l), 1);
      if (!form.lines.length) form.lines.push(blankLine());
      renderLines();
      return scheduleCalc(0);
    }
    if (act === "line-more") {
      const line = form.lines[Number(target.dataset.l)];
      line.more = !line.more;
      return renderLines();
    }
    if (act === "pay-add-cash") {
      form.pay.cash.push({ amount: "", method: "cash", lineKey: lineKey(), bankAccountId: "" });
      renderPay();
      return body()?.querySelector(`[data-pay="cash"][data-i="${form.pay.cash.length - 1}"][data-f="amount"]`)?.focus();
    }
    if (act === "pay-all-cash") {
      // Fiyat yeni değiştiyse hesap bitmeden eski toplam kullanılıyordu (288'lik fatura 24 peşinle kaydedildi). Kaydet bu işin
      // bitmesini bekler (2. gözden geçirme: yük, peşin tutar yazılmadan kuruluyor; ekranda peşin görünen fatura 0 peşinle
      // kaydediliyordu).
      const job = (async () => {
        await flushCalc();
        if (view.form !== form) return;
        const payable = form.calc ? form.calc.try?.payable ?? form.calc.totals.payable : 0;
        const others = form.pay.cheques.reduce((sum, item) => sum + amountNum(item.amount), 0) + (form.portfolio || []).filter(item => form.pay.endorse.includes(item.id)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        form.pay.cash = [{ ...(form.pay.cash[0] || { method: "cash", lineKey: lineKey(), bankAccountId: "" }), amount: amountText(Math.max(0, Math.round((payable - others) * 100) / 100)) }];
        renderPay();
      })();
      form.payPending = job;
      try {
        await job;
      } finally {
        if (form.payPending === job) form.payPending = null;
      }
      return;
    }
    if (act === "pay-add-cheque") {
      form.pay.cheques.push({ instrument: "cheque", amount: "", dueDate: "", serialNo: "", bank: "", drawer: "" });
      renderPay();
      return body()?.querySelector(`[data-pay="cheques"][data-i="${form.pay.cheques.length - 1}"][data-f="amount"]`)?.focus();
    }
    if (act === "pay-remove") {
      form.pay[target.dataset.pay].splice(Number(target.dataset.i), 1);
      return renderPay();
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
  // SMM: eline geçecek net tutardan brüt ücret (stopaj ve KDV'ye göre) — ilk kalemin birim fiyatına yazılır.
  function grossFromNet() {
    const form = view.form;
    HOF.formModal({
      title: "Netten Brüte",
      eyebrow: "SERBEST MESLEK MAKBUZU",
      intro: "Eline geçmesini istediğiniz net ücreti yazın; program stopaj oranına göre brüt ücreti bulur ve ilk kaleme yazar.",
      fields: [{ name: "net", label: "Net Ücret (₺)", required: true, inputmode: "decimal", autofocus: true }],
      submitLabel: "Brütü Hesapla",
      onSubmit: async data => {
        const rate = form.stoppageRate === "" ? meta.settings.defaults.stoppageRate : num(form.stoppageRate);
        const result = await HOF.api(`/api/workspace/invoices/gross-from-net?net=${encodeURIComponent(data.net)}&rate=${encodeURIComponent(rate)}`);
        const line = form.lines[0];
        line.unitPrice = amountText(result.gross);
        if (!line.name) line.name = "Serbest meslek ücreti";
        line.qty = "1";
        renderLines();
        scheduleCalc(0);
      },
    });
  }
  // e-Belge olarak gönderilecek belge mi (kendi kestiğimiz, e-Fatura / e-Arşiv / e-SMM)? Kesimde iki seçenek: hemen gönder
  // ya da sonra gönder (Gönderilecekler).
  const sendable = form => edoc() && Boolean(meta.kinds[form.kind]?.send) && (form.calc?.profile || form.profile || "") !== "KAGIT";
  async function submitForm(mode, eSend = "") {
    const form = view.form;
    if (!form || form.busy) return;
    const error = body()?.querySelector("[data-form-error]");
    const fail = message => {
      if (error) error.textContent = message;
      HOF.toast(message, { type: "error" });
    };
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
    if (isReturn(form.kind) && !form.original) return fail("İade edilecek faturayı üstteki arama kutusundan seçin.");
    if (!form.account) return fail(`${form.side === "purchase" ? "Tedarikçiyi" : "Müşteriyi"} (cariyi) seçin.`);
    if (!usedLines(form).length) return fail("En az bir kalem yazın.");
    // v2.0.23 (Bulgu 1): tutarı yazılmamış ya da geçersiz ödeme satırı sessizce atılmaz (önceden evrak kayıtta düşüyordu,
    // fatura "Açık" kaydediliyordu). Peşin satırında boş tutar olabilir (satır yok sayılır); evrak satırında tutar zorunlu.
    const amountOk = value => parseTl(value) > 0;
    const badCash = form.pay.cash.findIndex(item => String(item.amount ?? "").trim() && !amountOk(item.amount));
    if (badCash >= 0) return fail(`${badCash + 1}. peşin ödeme satırındaki tutar geçerli değil ("${String(form.pay.cash[badCash].amount).trim()}"). Tutarı düzeltin ya da satırı × ile silin.`);
    const badCheque = form.pay.cheques.findIndex(item => !amountOk(item.amount));
    if (badCheque >= 0) return fail(`${badCheque + 1}. evrakın (${form.pay.cheques[badCheque].instrument === "note" ? "senet" : "çek"}) tutarı ${String(form.pay.cheques[badCheque].amount ?? "").trim() ? `geçerli değil ("${String(form.pay.cheques[badCheque].amount).trim()}")` : "yazılmadı"}. Tutarı yazın ya da satırı × ile silin.`);
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
        if (!c) throw new Error(form.calcError || "Toplamlar hesaplanamadı; kalemleri kontrol edin.");
        const who = form.account.name;
        const numberText = c.nextNumber && eSend !== "later" ? `${c.nextNumber} numarasıyla ` : "";
        // v2.0.16 (müşteri): "Stoğa Mal Alışı"nda stok kartı olmayan kalem gider sayılır — kayıttan önce açıkça söylenir.
        const stockless = offersNewItem(form) ? usedLines(form).filter(line => !line.itemId && !line.newItem) : [];
        const stocklessText = stockless.length ? ` DİKKAT: ${stockless.map(line => `“${line.name.trim()}”`).join(", ")} stok kartı olmadan GİDER olarak kaydedilir, stoğa girmez. Mal ise Vazgeç'e basıp ürün adı kutusundaki listeden “+ Yeni Stok Kartı”nı seçin.` : "";
        const sendText = eSend === "later" ? " Belge Gönderilecekler'de bekler; e-Belge numarası entegratöre gönderilirken verilir." : eSend === "now" ? " Belge kaydedilir kaydedilmez entegratöre (e-Belge) gönderilir." : "";
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
          message: `${who} için ${numberText}${kindLabel(form.kind).toLocaleLowerCase("tr-TR")} kaydedilecek: ${curMoney(c.totals.payable, c.currency)}. Stok, cari, Kasa, çek/senet ve taksit kayıtları birlikte yazılır. Yanlışsa sonradan kartındaki “Düzenle” ile düzeltilir.${sendText}${stocklessText}`,
          confirmLabel: eSend === "later" ? "Kaydet, Sonra Gönder" : eSend === "now" ? "Kaydet ve Gönder" : ISSUE_LABELS[form.kind] || "Kaydet",
        });
        if (!ok) return;
        // v2.0.22 (madde 5): formun istek kimliğiyle — yanıt gecikip yeniden Kaydet'e basılırsa sunucu ikinci fatura açmaz.
        saved = await withStockForce(force => (form.id ? HOF.api(`/api/workspace/invoices/${encodeURIComponent(form.id)}/issue`, { method: "POST", body: { ...payload, ...force, ...(eSend ? { eSend } : {}) } }) : HOF.api("/api/workspace/invoices", { method: "POST", body: { ...payload, ...force, ...(eSend ? { eSend } : {}) }, requestId: form.requestId })));
        if (saved.replayed) HOF.toast(`${kindLabel(saved.kind)} ${saved.displayNo || ""} zaten kaydedilmişti (önceki gönderim sunucuya ulaşmış); ikinci kez kaydedilmedi.`, { type: "info", timeout: 9000 });
        else HOF.toast(eSend === "later" ? `${kindLabel(saved.kind)} kaydedildi; Gönderilecekler'de bekliyor.` : `${kindLabel(saved.kind)} ${saved.displayNo || ""} kaydedildi.`, { type: "success" });
        if (saved.autoSend) HOF.toast(saved.autoSend.ok ? saved.autoSend.message : `e-Belge gönderilemedi: ${saved.autoSend.message}`, { type: saved.autoSend.ok ? "success" : "error", timeout: 8000 });
      }
      view.form = null;
      HOF.emit("invoices-changed", saved);
      showDoc(saved);
    } catch (failure) {
      // Soruya "Vazgeç" kullanıcının kararıdır (kırmızı hata değil); banka sorusunda bilgi bildirimi (2.0.26 İ6 kalıbı).
      if (!HOF.userCancelled(failure)) fail(failure.message || "İşlem tamamlanamadı.");
      else if (failure.data.code !== "cash-negative-cancelled") HOF.toast(failure.message, { type: "info" });
    } finally {
      form.busy = false;
      body()?.querySelectorAll(".hof-actions .hof-button").forEach(button => (button.disabled = false));
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
      const go = await HOF.confirm({ title: "Stok eksiye düşecek", message: `${error.message} Sayım farkı ya da henüz girilmemiş alış varsa ${verb === "save" ? "kaydedebilirsiniz" : "devam edebilirsiniz"}. ${ask}`, confirmLabel: yes, danger: true });
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
    view.doc = doc;
    view.id = doc.id;
    setMode("card");
    renderCard();
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
    return `<div class="hof-inv-closers"><h5>Bu Faturayı Kapatanlar</h5>${rows.length ? `<ul>${rows.join("")}</ul>` : `<p class="hof-muted">Henüz kapatan yok.${hint}</p>`}${canOffset ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="offset">Mahsup Et</button>' : ""}</div>`;
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
      .map((line, index) => `<tr><td>${index + 1}</td>${hasCodes ? `<td class="hof-inv-doc-code">${esc(line.code || "")}</td>` : ""}<td><b>${esc(line.name)}</b>${line.description ? `<small>${esc(line.description)}</small>` : ""}${line.expenseLabel ? `<small>${esc(line.expenseLabel)}</small>` : ""}${line.withholdingCode ? `<small>Tevkifat ${esc(line.withholdingCode)} (${line.withholdingNum}/${line.withholdingDen})</small>` : ""}</td><td class="num">${esc(String(line.qty).replace(".", ","))} ${esc(line.unit)}${line.returned ? `<small>${esc(String(line.returned).replace(".", ","))} iade</small>` : ""}</td><td class="num">${esc(curMoney(line.unitPrice, cur))}</td><td class="num">${line.discountRate ? `%${esc(String(line.discountRate).replace(".", ","))}` : ""}</td><td class="num">%${esc(String(line.vatRate))}</td><td class="num"><b>${esc(curMoney(line.net, cur))}</b></td></tr>`)
      .join("");
    const totals = [
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
        ? `<span class="hof-plan-toolgroup">${doc.canSend ? '<button type="button" class="hof-button hof-button-small" data-act="e-send">e-Belge Gönder</button>' : ""}${doc.canWithdraw ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="e-withdraw" title="Belge gönderilmez, Müşteri Fişi olarak kalır; stok, cari ve Kasa etkileri değişmez">Listeden Sil</button>' : ""}${doc.canRefresh ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="e-refresh">Durum Sorgula</button>' : ""}${doc.status === "issued" ? `<a class="hof-button hof-button-small hof-button-ghost" href="/api/workspace/invoices/${esc(doc.id)}/ubl.xml" download>XML İndir</a>` : ""}</span>`
        : "";
    HOF.swap(
      root,
      `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${esc(docTitle(doc))} ${statusPill(doc)}</h3><small>${esc(doc.accountName)} · ${esc(HOF.formatDate(doc.issueDate))} ${esc(doc.issueTime || "")}${doc.scenarioLabel ? ` · ${esc(doc.scenarioLabel)}` : ""}</small></div></div>
        <div class="hof-chq-amount"><span>${sideOf(doc.kind) === "sale" ? (ret ? "İade Tutarı" : "Tahsil Edilecek") : ret ? "İade Tutarı" : "Ödenecek"}</span><strong>${esc(curMoney(doc.payableTotal, cur))}</strong>${cur !== "TRY" ? `<small>${esc(money(doc.tryPayable))}</small>` : ""}</div>
      </div>
      <div class="hof-inv-pills" role="group" aria-label="Bağlı kartlar">
        <button type="button" class="hof-inv-big-pill" data-open-account="${esc(doc.accountId)}"><b>Cari Kartı</b><small>${esc(doc.accountName)}</small></button>
        ${
          ret
            ? doc.originalId
              ? `<button type="button" class="hof-inv-big-pill" data-open-invoice="${esc(doc.originalId)}"><b>Asıl Fatura</b><small>${esc(doc.originalNumber || "")}</small></button>`
              : ""
            : `<button type="button" class="hof-inv-big-pill" data-act="return" ${doc.canReturn ? "" : "disabled"} title="${doc.canReturn ? "Bu faturadan iade oluştur" : doc.status === "issued" ? "İade edilebilecek kalem kalmadı" : "Yalnız kaydedilmiş faturadan iade oluşturulur"}"><b>İade</b><small>${doc.returns?.length ? `${doc.returns.length} iade` : doc.canReturn ? "Bu Faturadan İade Oluştur" : "İade Yok"}</small></button>`
        }
      </div>
      <div class="hof-chq-actions" role="toolbar" aria-label="Belge işlemleri">
        <span class="hof-plan-toolgroup">${office().outputButtons ? office().outputButtons(pdfUrl(doc), "card", `${doc.status === "draft" ? "Proforma" : kindLabel(doc.kind)} - PDF`) : `<a class="hof-button hof-button-small hof-button-ghost" href="${esc(pdfUrl(doc))}" target="_blank" rel="noopener">PDF</a>`}${phone && doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}${doc.status === "issued" && isOwn(doc.kind) ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="email" data-mail="${esc(email)}" title="${email ? `${esc(email)} adresine e-posta penceresi açılır; PDF indirilir` : "Cari kartında e-posta adresi yok"}">E-Posta</button>` : ""}</span>
        ${doc.status === "issued" && doc.open > 0.004 && !ret && HOF.can(sideOf(doc.kind) === "sale" ? "accounts.collect" : "accounts.manage") ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small" data-act="pay">${sideOf(doc.kind) === "sale" ? "+ Tahsilat Ekle" : "+ Ödeme Yap"}</button></span>` : ""}
        ${doc.canManage ? `<span class="hof-plan-toolgroup">${doc.canEdit ? '<button type="button" class="hof-button hof-button-small" data-act="edit">Düzenle ve Kaydet</button>' : ""}${doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small" data-act="modify" ${doc.canModify ? "" : "disabled"} title="${esc(doc.modifyBlock || "Belgeyi düzeltip yeniden kaydedin; numara değişmez, stok, cari, Kasa ve taksit kayıtları yeni hale göre yazılır")}">Düzenle</button>` : ""}${!ret ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="copy" title="Aynı cari ve kalemlerle yeni belge">Kopyala</button>' : ""}${doc.canRepeat ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="${doc.repeat ? "repeat-stop" : "repeat"}" title="${doc.repeat ? "Tekrar emrini durdur" : "Abonelik, kira, aidat: her dönem taslak hazırlanır"}">${doc.repeat ? "Tekrarı Durdur" : "Tekrarla"}</button>` : ""}${doc.status === "draft" || doc.status === "cancelled" || doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="delete" ${doc.canDelete ? "" : "disabled"} title="${esc(doc.deleteBlock || (doc.status === "draft" ? "Taslağı Silinenler'e gönder" : "Bütün etkileri geri alınır, belge Silinenler'e gider"))}">Sil</button>` : ""}${doc.status === "issued" ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="cancel" ${doc.canCancel ? "" : "disabled"} title="${esc(doc.cancelBlock || "Bütün etkileri geri alınır; numara korunur")}">İptal Et</button>` : ""}</span>` : ""}
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
        ${fact("Belge Türü", esc(doc.eStatus === "withdrawn" ? "Müşteri Fişi (e-Belge olarak gönderilmedi)" : profileText))}
        ${fact("e-Belge", doc.sendBlock ? `<span class="hof-inv-warn">${esc(doc.sendBlock)}</span>` : doc.eStatus === "waiting" ? "Gönderilecekler'de: numara entegratöre gönderilirken verilir." : "")}
        ${fact("Para Birimi", cur !== "TRY" ? `${esc(cur)} · kur ${esc(String(doc.rate).replace(".", ","))}` : "")}
        ${fact("Asıl Fatura", doc.originalId ? `<a href="#" data-open-invoice="${esc(doc.originalId)}">${esc(doc.originalNumber || "")}</a> · ${esc(HOF.formatDate(doc.originalDate))}` : "")}
        ${fact("Sipariş", doc.orderNo ? `${esc(doc.orderNo)}${doc.orderDate ? ` · ${esc(HOF.formatDate(doc.orderDate))}` : ""}` : "")}
        ${fact("İrsaliye", doc.despatchNo ? `${esc(doc.despatchNo)}${doc.despatchDate ? ` · ${esc(HOF.formatDate(doc.despatchDate))}` : ""}` : "")}
        ${fact("Kâğıt Fatura No", esc(doc.paperNo || ""))}
        ${fact("ETTN", edoc() && doc.profile !== "KAGIT" ? `<small>${esc(doc.ettn)}</small>` : "")}
        ${fact("Kaydeden", esc(doc.actorName || ""))}
      </dl>
      <div class="hof-rep-table"><table class="hof-table hof-inv-doc-lines"><thead><tr><th>#</th>${hasCodes ? "<th>Stok Kodu</th>" : ""}<th>Ürün / Hizmet</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">İsk.</th><th class="num">KDV</th><th class="num">Tutar</th></tr></thead><tbody>${lineRows}</tbody></table></div>
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
    HOF.formModal({
      title: sale ? "Tahsilat Ekle" : "Ödeme Yap",
      eyebrow: docTitle(doc),
      intro: `Açık tutar ${money(doc.open)}. Kayıt cariye ve Kasa'ya yazılır; bu faturaya bağlı kapatılır (fazlası carinin en eski açık faturasına gider).`,
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: amountText(doc.open), autofocus: true },
        { name: "date", label: "Tarih", type: "date", required: true, value: todayIso(), max: "today" },
        HOF.methodField("cash", { incoming: sale }),
        { name: "note", label: "Açıklama", maxlength: 300, value: `${doc.displayNo} ${sale ? "tahsilatı" : "ödemesi"}` },
      ],
      submitLabel: sale ? "Tahsilatı Kaydet" : "Ödemeyi Kaydet",
      // v2.1.0 Aşama 7: Havale / EFT'de Banka Hesabı (tek hesapta gizli); istek kimliği; banka hesabının Benzer İşlem ve Eksi Bakiye soruları.
      // K2 (plan §3.7 #3, #5, §8.9): alış faturasına ödemede "Kredi Kartı" kurumsal kartla ödemedir → Kurumsal Kart seçicisi.
      onOpen: dialog => {
        if (HOF.bank?.attachPicker) HOF.bank.attachPicker(dialog.querySelector("form"), { methodName: "method", card: sale ? null : {} });
      },
      onSubmit: async data => {
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
  function cancelForm(doc) {
    const sentEInvoice = edoc() && ["TEMELFATURA", "TICARIFATURA"].includes(doc.profile) && ["sent", "accepted"].includes(doc.eStatus);
    const earchive = edoc() && doc.profile === "EARSIVFATURA" && ["processing", "sent", "accepted", "error"].includes(doc.eStatus);
    HOF.formModal({
      title: `${docTitle(doc)} İptal Edilsin mi?`,
      eyebrow: "İPTAL",
      intro: `Belgenin bütün etkileri birlikte geri alınır: stok, cari borç/alacak, peşin tahsilat/ödeme (Kasa), çek/senet ve taksit kartı. Numara korunur; belge "İptal Edildi" olarak kalır.${earchive ? " e-Arşiv fatura önce entegratörde (EDM) iptal edilir." : ""}`,
      fields: [
        { name: "reason", label: "İptal Nedeni", maxlength: 300, placeholder: "ör. Müşteri vazgeçti, yanlış tutar", autofocus: true },
        ...(sentEInvoice ? [{ name: "confirmExternal", label: "Bu e-Fatura alıcı tarafından reddedildi ya da GİB'den iptal edildi; programda da iptal edilsin.", type: "checkbox", value: false }] : []),
      ],
      submitLabel: "İptal Et",
      onSubmit: async data => {
        if (sentEInvoice && !data.confirmExternal) throw new Error("Gönderilmiş e-Fatura önce GİB / alıcı tarafında iptal edilmeli (ret ya da iptal talebi); sonra kutuyu işaretleyin. Gerekirse iade faturası kesin.");
        return keepOnCancel(async () => {
          const saved = await withStockForce(force => HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/cancel`, { method: "POST", body: { reason: data.reason, confirmExternal: data.confirmExternal === true, ...force } }), "cancel");
          HOF.toast(`${docTitle(doc)} iptal edildi; etkileri geri alındı.`, { type: "success" });
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
  // Gönderilecekler'den silme: etkiler yerinde kalır; belge Müşteri Fişi numarası alır (sonra yine gönderilebilir).
  async function withdrawDoc(doc) {
    const go = await HOF.confirm({ title: "Gönderilecekler'den Silinsin mi?", message: "Belge entegratöre gönderilmez ve Müşteri Fişi olarak kalır. Stok, cari, Kasa, taksit ve çek/senet kayıtları değişmez. Satışı geri almak için İptal Et kullanılır. İsterseniz belgeyi sonra yine e-Belge olarak gönderebilirsiniz.", confirmLabel: "Listeden Sil" });
    if (!go) return;
    try {
      const saved = await HOF.api(`/api/workspace/invoices/${encodeURIComponent(doc.id)}/withdraw`, { method: "POST", body: {} });
      HOF.toast(`Belge listeden silindi; ${saved.number} numaralı Müşteri Fişi olarak kaldı.`, { type: "success" });
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
      message: `Seçili taslaklar tarih sırasıyla kaydedilir (toplam ${money(total)}). Her belgede stok, cari, Kasa, çek/senet ve taksit kayıtları birlikte yazılır. Stoku eksiye düşüren ya da kilitli dönemdeki taslak kaydedilmez, nedeni bildirilir.`,
      confirmLabel: "Seçilenleri Kaydet",
    });
    if (!go) return;
    try {
      const result = await HOF.api("/api/workspace/invoices/bulk-issue", { method: "POST", body: { ids: docs.map(doc => doc.id) } });
      bulkOutcome(result, "kaydedildi", "kaydedilemedi");
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
      fields: doc.status === "issued" ? [{ name: "reason", label: "Silme Nedeni", maxlength: 300, placeholder: "ör. Yanlış cariye kaydedildi", autofocus: true }] : [],
      submitLabel: "Sil",
      onSubmit: async data => {
        const query = new URLSearchParams({ reason: data.reason || "" });
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
    HOF.formModal({
      title: `${docs.length.toLocaleString("tr-TR")} Belge Silinsin mi?`,
      eyebrow: "TOPLU SİL",
      intro: `${[counts.issued ? `${counts.issued} kaydedilmiş` : "", counts.cancelled ? `${counts.cancelled} iptal edilmiş` : "", counts.draft ? `${counts.draft} taslak` : ""].filter(Boolean).join(", ")} · toplam ${money(Math.abs(total))}. ${deleteIntro("issued")} İade belgeleri önce silinir. İadesi olan, e-Belgesi gönderilmiş, kilitli dönemdeki ya da taksitinden tahsilat alınmış belge silinmez; nedeni belge belge bildirilir.`,
      fields: counts.issued ? [{ name: "reason", label: "Silme Nedeni", maxlength: 300, placeholder: "ör. Deneme kayıtları", autofocus: true }] : [],
      submitLabel: `Seçilenleri Sil (${docs.length})`,
      onSubmit: async data => {
        const result = await bulkWithNegative("/api/workspace/invoices/bulk-delete", { ids: docs.map(doc => doc.id), reason: data.reason, force: true }, "delete");
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
    HOF.formModal({
      title: `${docs.length.toLocaleString("tr-TR")} Belge İptal Edilsin mi?`,
      eyebrow: "TOPLU İPTAL",
      intro: "Her belgenin bütün etkileri birlikte geri alınır: stok, cari borç/alacak, peşin tahsilat/ödeme (Kasa), çek/senet ve taksit kartı. Numaralar korunur. İadesi olan, kilitli dönemdeki ya da çeki tahsil edilmiş belge iptal edilmez; nedeni bildirilir.",
      fields: [{ name: "reason", label: "İptal Nedeni", maxlength: 300, placeholder: "ör. Yanlış cariye kaydedildi", autofocus: true }],
      submitLabel: "Seçilenleri İptal Et",
      onSubmit: async data => {
        const result = await bulkWithNegative("/api/workspace/invoices/bulk-cancel", { ids: docs.map(doc => doc.id), reason: data.reason }, "cancel");
        bulkOutcome(result, "iptal edildi", "iptal edilemedi");
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
  async function sendPending() {
    const ids = (view.list?.invoices || []).map(item => item.id);
    if (!ids.length) return;
    const go = await HOF.confirm({ title: "Gönderilecekler Gönderilsin mi?", message: `${ids.length.toLocaleString("tr-TR")} belge sırayla entegratöre gönderilecek; e-Belge numaraları gönderim sırasında verilir.`, confirmLabel: "Tümünü Gönder" });
    if (!go) return;
    try {
      const result = await HOF.api("/api/workspace/invoices/send-pending", { method: "POST", body: { ids } });
      const failed = result.results.filter(item => !item.ok);
      HOF.toast(`${result.sent.toLocaleString("tr-TR")} belge gönderildi${failed.length ? `; ${failed.length} belge gönderilemedi: ${failed[0].message}` : "."}`, { type: failed.length ? "error" : "success", timeout: 10000 });
    } catch (error) {
      HOF.toastError(error);
    }
    loadList();
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
  async function showSettings() {
    view.logo = undefined;
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
    const series = Object.entries(s.nextNumbers || {});
    const integ = s.integrator || {};
    const problems = s.problems?.KAGIT || [];
    HOF.swap(
      root,
      `<div class="hof-plan-head"><div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
        <div class="hof-plan-title"><h3>Fatura Ayarları</h3><small>Belgenin üstünde yazan firma bilgisi, numara serileri ve varsayılanlar. Değişiklik bundan sonra kaydedilen belgelere uygulanır.</small></div></div></div>
      ${problems.length ? `<ul class="hof-inv-problems">${problems.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
      <section class="hof-inv-settings"><h4>Firma Bilgisi</h4><div class="hof-inv-head">
        ${input("seller.name", "Unvan / Ad Soyad", seller.name, 'maxlength="200"')}
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
        <div class="hof-field hof-inv-wide hof-inv-logo"><span>Logo (Belgenin Sol Üstüne Basılır)</span>
          <div class="hof-inv-logo-row"><div class="hof-inv-logo-box" data-logo-preview>${logoNow() ? `<img src="${esc(logoNow())}" alt="Logo">` : '<small>Logo yok</small>'}</div>
          <div class="hof-inv-logo-tools"><label class="hof-button hof-button-small hof-button-ghost">Logo Seç<input type="file" accept="image/*" data-logo-file hidden></label>${logoNow() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="logo-clear">Logoyu Kaldır</button>' : ""}<small>PNG ya da JPEG seçin; program JPEG'e çevirip küçültür (en çok 150 KB). Kaydedince bundan sonraki PDF'lere basılır.</small></div></div></div>
      </div></section>
      <section class="hof-inv-settings"><h4>Banka Hesapları <small>(belgenin altına basılır)</small></h4><p class="hof-muted">Banka penceresinde “IBAN faturada gösterilsin” işaretli hesaplar da belgeye basılır (önce onlar; en çok 4 hesap).</p><div class="hof-inv-banks">
        ${banks.map((bank, index) => `<div class="hof-inv-pay-row"><label><span>Banka</span><input data-bank="${index}" data-k="name" maxlength="80" value="${esc(bank.name || "")}"></label><label><span>IBAN</span><input data-bank="${index}" data-k="iban" maxlength="34" value="${esc(bank.iban || "")}" placeholder="TR00 0000 0000 0000 0000 0000 00"></label></div>`).join("")}
      </div></section>
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
        <label class="hof-field hof-inv-wide"><span>Belge Alt Notu</span><textarea data-s="defaults.footer" rows="2" maxlength="500" placeholder="ör. İade ve değişim 14 gün içinde faturayla yapılır.">${esc(s.defaults.footer || "")}</textarea></label>
      </div></section>
      ${
        s.edocEnabled
          ? `<section class="hof-inv-settings"><h4>e-Belge Bağlantısı</h4>
        <p class="hof-muted">Entegratörle (EDM Bilişim) kendiniz sözleşir, kontörü kendiniz alırsınız; EDM'nin verdiği web servis kullanıcı bilgilerini buraya girin. Önce Test Ortamı'nda deneyin.</p>
        <div class="hof-inv-head">
          <label class="hof-check"><input type="checkbox" data-s="efatura" ${s.efatura ? "checked" : ""}><span>e-Fatura mükellefiyim</span></label>
          <label class="hof-check"><input type="checkbox" data-s="earsiv" ${s.earsiv ? "checked" : ""}><span>e-Arşiv kullanıcısıyım</span></label>
          <label class="hof-check"><input type="checkbox" data-s="esmm" ${s.esmm ? "checked" : ""}><span>e-SMM kullanıcısıyım</span></label>
          <label class="hof-field"><span>Varsayılan e-Fatura Senaryosu</span><select data-s="defaults.efaturaProfile"><option value="TEMELFATURA" ${s.defaults.efaturaProfile !== "TICARIFATURA" ? "selected" : ""}>Temel Fatura</option><option value="TICARIFATURA" ${s.defaults.efaturaProfile === "TICARIFATURA" ? "selected" : ""}>Ticari Fatura</option></select></label>
          <label class="hof-field"><span>Entegratör</span><input value="${esc(integ.label || "EDM Bilişim")}" readonly></label>
          <label class="hof-field"><span>Ortam</span><select data-s="integrator.env"><option value="test" ${integ.env !== "live" ? "selected" : ""}>Test Ortamı</option><option value="live" ${integ.env === "live" ? "selected" : ""}>Canlı Ortam</option></select></label>
          <label class="hof-field hof-inv-wide"><span>Servis Adresi</span><input data-s="integrator.baseUrl" value="${esc(integ.baseUrl || "")}" placeholder="${esc(integ.url || "")}"><small>Boş bırakılırsa seçilen ortamın adresi kullanılır. EDM size farklı bir adres verdiyse yazın.</small></label>
          <label class="hof-field"><span>Kullanıcı Adı</span><input data-s="integrator.username" value="${esc(integ.username || "")}" maxlength="120" autocomplete="off"></label>
          <label class="hof-field"><span>Parola</span><input type="password" data-s="integrator.password" value="" maxlength="200" autocomplete="new-password" placeholder="${integ.hasPassword ? "Kayıtlı (değiştirmek için yazın)" : ""}"><small>Şifreli saklanır; ekranda gösterilmez.</small></label>
          <label class="hof-field"><span>Gönderici Birim Etiketi</span><input data-s="integrator.senderAlias" value="${esc(integ.senderAlias || "")}" placeholder="urn:mail:defaultgb@firmaniz.com.tr"><small>Bilmiyorsanız boş bırakın.</small></label>
          <label class="hof-check"><input type="checkbox" data-s="integrator.autoSend" ${integ.autoSend ? "checked" : ""}><span>Kaydedilen e-Belge entegratöre hemen gönderilsin</span></label>
        </div>
        <div class="hof-inv-pay-add"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="integrator-test" ${integ.hasPassword && integ.username ? "" : "disabled"} title="Önce kullanıcı adı ve parolayı kaydedin">Bağlantıyı Sına</button></div>
        <div data-integrator-result></div></section>`
          : ""
      }
      <p class="hof-form-error" role="alert" data-form-error></p>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Vazgeç</button><button type="button" class="hof-button" data-act="save-settings">Ayarları Kaydet</button></div>`,
    );
  }
  // Logo: view.logo tanımsızsa değişmedi; "" kaldırıldı; data URL yeni seçildi (kaydedilince sunucuya gider).
  const logoNow = () => (view.logo === undefined ? view.settings?.seller?.logo || "" : view.logo);
  async function pickLogo(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      view.logo = await imageToJpeg(file, { maxSide: 600, maxBytes: 150 * 1024 });
      renderSettings();
      HOF.toast("Logo hazır; Ayarları Kaydet ile saklanır.", { type: "info" });
    } catch (error) {
      HOF.toast(error.message || "Görsel okunamadı.", { type: "error" });
    }
  }
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
    if (act === "logo-clear") {
      view.logo = "";
      return renderSettings();
    }
    if (act === "save-settings") {
      if (error) error.textContent = "";
      try {
        const saved = await HOF.api("/api/workspace/invoices/settings", { method: "PUT", body: settingsPayload() });
        view.settings = saved;
        view.logo = undefined;
        await loadMeta(true);
        HOF.toast("Fatura ayarları kaydedildi.", { type: "success" });
        renderSettings();
      } catch (failure) {
        if (error) error.textContent = failure.message;
        HOF.toastError(failure);
      }
    }
    if (act === "integrator-test") {
      const slot = body()?.querySelector("[data-integrator-result]");
      if (slot) slot.innerHTML = '<p class="hof-muted">Bağlanılıyor…</p>';
      try {
        const result = await HOF.api("/api/workspace/invoices/integrator/test", { method: "POST", body: {} });
        const c = result.contract || {};
        if (slot) slot.innerHTML = `<div class="hof-inv-banner is-ok"><b>${esc(result.message)}</b>${c.operations?.length ? `<small>Sözleşme: ${esc(c.source === "wsdl" ? "sunucudan okundu" : "varsayılan")} · SOAP ${esc(c.soap)} · ${esc(c.endpoint)}${c.missing?.length ? ` · eksik işlem: ${esc(c.missing.join(", "))}` : ""}</small>` : ""}</div>`;
      } catch (failure) {
        if (slot) slot.innerHTML = `<div class="hof-inv-banner is-cancelled"><b>Bağlantı kurulamadı.</b> ${esc(failure.message)}</div>`;
      }
    }
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
        <div class="hof-plan-actions">${canSettings() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="settings">Fatura Ayarları</button>' : ""}</div></div>
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
  HOF.invoices = { open, newFor, openDoc, forAccount, edocEnabled: () => meta?.edocEnabled === true };
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
