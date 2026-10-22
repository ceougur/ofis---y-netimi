/* DestekOfis — Çek / Senet (v2.0.7).
 * Alınan (müşteriden, portföye girer) ve verilen (kendi çekimiz/senedimiz) evrak. Liste: yön, durum ve vade süzgeci,
 * arama, portföy özeti, PDF/Excel. Kart: evrakın bilgileri, işlemleri (Tahsil edildi, Ciro et, Karşılıksız / iade,
 * Ödendi, Son işlemi geri al) ve işlem geçmişi. Her işlem sunucuda tek işlem bloğunda cari/taksit defterine ve (tahsil,
 * ödeme) Kasa'ya yazılır; kural server/lib/cheques.mjs içinde. Excel / Google Sheets'ten portföy (doğrulama kapısıyla).
 * v2.2.0 (plan §3.14, İz 2.6, İz 4.1 ekranı): portföydeki alınan evrak "Bankaya Tahsile Ver" (yalnız Çek Kullan / Senet Kullan işaretli hesap;
 * kural sunucuda lib/bank/collections.mjs) ve "Bankadan Geri Al"; tahsildeki evrakta Tahsil Et yolu Havale / EFT ve hesabı kaydın hesabı (sabit),
 * Ciro Et ve Sil pasif (nedeni düğmelerin yanında yazılı); listede "Portföyde" ile "Bankada Tahsilde" ayrı süzgeç ve özet kutusu. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let modal = null;
  const lists = HOF.listGate();
  let cardRequest = 0;
  const view = { mode: "list", direction: "", status: "open", q: "", from: "", to: "", sort: "due", list: null, id: "", cheque: null };

  const money = value => HOF.formatMoney(value);
  const moduleName = () => HOF.uiLabel?.("side.cheques", "Çek / Senet") || "Çek / Senet";
  const canManage = () => HOF.can("cheques.manage");
  const todayIso = () => HOF.office?.todayIso?.() || new Date().toISOString().slice(0, 10);
  const body = () => modal?.dialog.querySelector("[data-cheques]");
  const STATUS_OPTIONS = [
    ["open", "Açık (portföyde / ödenecek)"],
    ["overdue", "Vadesi Geçmiş"],
    ["soon", "7 Gün İçinde"],
    // v2.2.0 (plan §3.14): "Portföyde" bankadaki evrakı içermez; "Bankada Tahsilde" yalnız tahsile verilmiş, sonucu bekleyen evrak.
    ["portfolio", "Portföyde"],
    ["deposited", "Bankada Tahsilde"],
    ["", "Tüm Durumlar"],
    ["collected", "Tahsil Edildi"],
    ["endorsed", "Ciro Edildi"],
    ["bounced", "Karşılıksız / İade"],
    ["paid", "Ödendi"],
  ];
  const statusPill = cheque => `<span class="hof-chq-status is-${esc(cheque.deposited ? "deposited" : cheque.status)}">${esc(cheque.statusLabel)}</span>`;
  const dueBadge = cheque => (cheque.open ? `<small class="hof-rep-days is-${esc(cheque.dueStateKey)}">${cheque.days < 0 ? `${Math.abs(cheque.days)} gün geçti` : cheque.days === 0 ? "bugün" : `${cheque.days} gün kaldı`}</small>` : "");
  const listQuery = (extra = {}) => new URLSearchParams(Object.fromEntries(Object.entries({ direction: view.direction, status: view.status, q: view.q, from: view.from, to: view.to, sort: view.sort, ...extra }).filter(([, value]) => value !== "" && value !== undefined))).toString();

  // action (v2.0.10): tahsilat şeridinden/bildirimden "Tahsil et" ya da "Ödeme yap" denince kart açılır açılmaz işlem formu gelir.
  function open({ id = "", direction, action = "" } = {}) {
    if (!HOF.can("cheques.view")) return HOF.toast("Çek / senet kasa yetkisi olan hesaplara açıktır.", { type: "error" });
    if (direction !== undefined) view.direction = direction;
    if (!modal) {
      modal = HOF.modal({
        title: moduleName(),
        eyebrow: "OPERASYON",
        size: "wide",
        body: '<div class="hof-plans hof-cheques" data-cheques><p class="hof-empty">Yükleniyor…</p></div>',
        onClose: () => {
          modal = null;
          view.mode = "list";
          view.id = "";
          view.cheque = null;
        },
      });
      modal.dialog.classList.add("hof-cheques-modal");
      modal.dialog.addEventListener("click", onClick);
      modal.dialog.addEventListener("change", onChange);
      modal.dialog.addEventListener("keydown", event => {
        if (event.key === "Enter" && event.target.matches("[data-filter='q']")) {
          event.preventDefault();
          view.q = event.target.value.trim();
          loadList();
        }
        if (event.key === "Enter" && event.target.closest("tr[data-cheque]")) loadCheque(event.target.closest("tr[data-cheque]").dataset.cheque);
      });
    }
    if (id) return loadCheque(id, action);
    view.mode = "list";
    renderList();
    loadList();
  }

  // 2.1.0 (bağımsız inceleme H4): Daha Fazla ile arka plan yenilemesi çakışınca yanıt yalnız isteğin gittiği listeye eklenir (HOF.listGate
  // retry); arka plan yenilemesi Daha Fazla ile açılan satırları korur (önceden ilk 300'e dönüyordu).
  function loadList(more = false, options = {}) {
    return HOF.listRetry(() => loadListOnce(more, options));
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
      const offset = more && view.list ? view.list.cheques.length : 0;
      const limit = quiet && view.list ? Math.min(5000, Math.max(300, view.list.cheques.length)) : 300;
      const data = await HOF.api(`/api/workspace/cheques?${listQuery({ offset, limit })}`, quiet ? { background: true } : {});
      if (!load.current()) return load.retry();
      load.applied();
      view.listError = "";
      view.list = more && view.list ? { ...data, cheques: [...view.list.cheques, ...data.cheques] } : data;
      if (view.mode === "list") renderList();
    } catch (error) {
      if (quiet) throw error;
      if (!load.current()) return;
      if (more && view.list) return HOF.toastError(error);
      view.list = null;
      view.listError = error.message;
      if (view.mode === "list") renderList();
    } finally {
      load.done();
    }
  }
  async function loadCheque(id, action = "", { quiet = false } = {}) {
    // Arka plan yenilemesi sıra numarasını artırmaz: kullanıcının o sırada açtığı evrak geçersiz sayılmaz.
    const ticket = quiet ? cardRequest : ++cardRequest;
    try {
      const cheque = await HOF.api(`/api/workspace/cheques/${encodeURIComponent(id)}`);
      if (ticket !== cardRequest) return;
      // Arka plan yenilemesi gelene kadar kullanıcı listeye döndüyse eski kart geri gelmez.
      if (quiet && (view.mode !== "card" || view.id !== id)) return;
      view.cheque = cheque;
      view.id = id;
      view.mode = "card";
      renderCard();
      if (action && cheque.actions?.some(item => item.key === action)) actionForm(cheque, action);
    } catch (error) {
      if (ticket !== cardRequest) return;
      if (quiet && (view.mode !== "card" || view.id !== id)) return;
      if (quiet && !HOF.lostRecord(error)) throw error;
      HOF.toastError(error);
      view.mode = "list";
      renderList();
      loadList();
    }
  }
  const apply = cheque => {
    if (view.id === cheque.id) view.cheque = cheque;
    if (view.mode === "card" && view.id === cheque.id) renderCard();
    loadList();
    HOF.emit("cheques-changed", cheque);
  };

  // ---------- Liste ----------
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const sum = data?.summary;
    const tile = (label, bucket, tone = "", help = "") => `<div class="hof-rep-stat ${tone}"><span>${esc(label)}</span><strong>${esc(money(bucket?.amount || 0))}</strong><small>${bucket?.count || 0} evrak${help ? ` · ${help}` : ""}</small></div>`;
    const rows = (data?.cheques || [])
      .map(
        cheque => `<tr data-cheque="${esc(cheque.id)}" tabindex="0" class="is-${esc(cheque.dueStateKey)}">
          <td>${esc(HOF.formatDate(cheque.dueDate))}${dueBadge(cheque)}</td>
          <td><span class="hof-chq-dir is-${esc(cheque.direction)}">${esc(cheque.directionLabel)}</span> ${esc(cheque.instrumentLabel)}</td>
          <td>${esc(cheque.serialNo || "—")}${cheque.bank ? `<small>${esc(cheque.bank)}</small>` : ""}</td>
          <td><b>${esc(cheque.party)}</b>${cheque.planName ? `<small>Taksit: ${esc(cheque.planName)}</small>` : cheque.status === "endorsed" && cheque.endorseAccountName ? `<small>→ ${esc(cheque.endorseAccountName)}</small>` : ""}</td>
          <td>${statusPill(cheque)}</td>
          <td class="num"><b>${esc(money(cheque.amount))}</b></td>
        </tr>`,
      )
      .join("");
    HOF.swap(root, `<div class="hof-plan-head">
        <div class="hof-plan-title"><small>Alınan evrak portföye girer, tahsil edilince banka hesabına ya da Kasa'ya; verilen evrak ödenince bankadan ya da Kasa'dan çıkar.</small></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Çek / senet işlemleri">
          ${canManage() ? `<button type="button" class="hof-button hof-button-small" data-act="new-in">+ Çek / Senet Al</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="new-out">+ Çek / Senet Ver</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import">Excel / Sheets’ten Yükle</button>` : ""}
          <span class="hof-rep-export" role="group" aria-label="Dışa aktar">${HOF.outputButton({ kind: "pdf", href: `/api/workspace/cheques/liste.pdf?${listQuery()}`, what: "Çek / Senet Listesi", attrs: 'target="_blank" rel="noopener"' })}${HOF.outputButton({ kind: "xlsx", href: `/api/workspace/cheques/export.xlsx?${listQuery()}`, what: "Çek / Senet Listesi", attrs: "download" })}</span>
        </div></div>
      ${sum ? `<div class="hof-rep-stats">${tile("Portföyde (alınan)", sum.in.open, "is-in")}${tile("Bankada Tahsilde", sum.deposited, "is-deposited")}${tile("Ödenecek (verilen)", sum.out.open, "is-out")}${tile("Vadesi Geçmiş", { count: sum.in.overdue.count + sum.out.overdue.count, amount: sum.in.overdue.amount + sum.out.overdue.amount }, sum.in.overdue.count + sum.out.overdue.count ? "is-bad" : "")}${tile("7 Gün İçinde", { count: sum.in.today.count + sum.in.soon.count + sum.out.today.count + sum.out.soon.count, amount: sum.in.today.amount + sum.in.soon.amount + sum.out.today.amount + sum.out.soon.amount }, "", "bugün dahil")}</div>` : ""}
      <div class="hof-plans-filters hof-chq-filters">
        <div class="hof-rep-presets" role="group" aria-label="Yön">${[["", "Tümü"], ["in", "Alınan"], ["out", "Verilen"]].map(([id, label]) => `<button type="button" class="hof-rep-chip ${view.direction === id ? "is-on" : ""}" data-direction="${id}">${label}</button>`).join("")}</div>
        <select data-filter="status" aria-label="Durum">${STATUS_OPTIONS.map(([id, label]) => `<option value="${id}" ${view.status === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        <label class="hof-rep-date"><span>Vade Başı</span><input type="date" data-filter="from" value="${esc(view.from)}"></label>
        <label class="hof-rep-date"><span>Vade Sonu</span><input type="date" data-filter="to" value="${esc(view.to)}"></label>
        <input type="search" data-filter="q" value="${esc(view.q)}" placeholder="No, banka, kişi, not ara…" aria-label="Ara">
      </div>
      ${data ? `<div class="hof-rep-table"><table class="hof-table hof-chq-table"><thead><tr><th>Vade</th><th>Evrak</th><th>No / Banka</th><th>Kimden / Kime</th><th>Durum</th><th class="num">Tutar</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="hof-empty">${view.status === "open" && !view.q ? "Portföyde evrak yok. “+ Çek / senet al” ile ekleyin." : "Bu süzgeçte evrak yok."}</td></tr>`}</tbody></table></div>
        <p class="hof-rep-note">${data.total.toLocaleString("tr-TR")} evrak · ${esc(money(data.listed.amount))}${data.hasMore ? ` · <button type="button" class="hof-link-button" data-act="more">Daha Fazla Göster</button>` : ""}</p>` : HOF.listPending(view.listError)}`);
  }

  // ---------- Kart ----------
  // 2.4.4 UX18: evrakın kapattığı fatura (Kapatılacak Fatura bağı; faturayla kaydedilen evrakın "Fatura"sından ayrı).
  const bondHtml = cheque => {
    const bond = cheque.closesInvoice;
    if (!bond) return "";
    const name = bond.number || "Numarası Gönderimde Verilecek Fatura";
    const why = "Bu evrak bu faturayı kapatır. Fatura iptal edilirse evrak portföyde kalır, yalnız bağ düşer; evrak karşılıksız dönerse fatura yeniden açılır.";
    return HOF.can("invoices.view") ? `<a href="#" data-open-invoice="${esc(bond.id)}" title="${esc(why)}">${esc(name)}</a>` : `<span title="${esc(why)}">${esc(name)}</span>`;
  };
  function renderCard() {
    const root = body();
    const cheque = view.cheque;
    if (!root || !cheque) return;
    const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "");
    const accountLink = (id, name) => (id && name ? `<a href="#" data-open-account="${esc(id)}">${esc(name)}</a>` : esc(name || ""));
    const actionButtons = cheque.actions
      .map(action => `<button type="button" class="hof-button hof-button-small ${action.key === "bounce" ? "hof-button-danger-ghost" : action.key === "collect" || action.key === "pay" ? "" : "hof-button-ghost"}" data-action="${esc(action.key)}">${esc(ACTION_TEXT[action.key]?.title || action.label)}</button>`)
      .join("");
    // v2.2.0 (plan §3.14): Bankaya Tahsile Ver (portföydeki alınan evrak) / Bankadan Geri Al (tahsildeki evrak) — sunucunun bankActions'ı.
    const bankButtons = (cheque.bankActions || []).map(action => `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-bank-action="${esc(action.key)}">${esc(action.label)}</button>`).join("");
    // 2.3.0 İz 1.6 (plan §3.11b/2 K11): karşılıksız dönen ALINAN evrakın kartında kısayol — neden ve tutar evraktan (sunucu chequeId). Yetkisizde gizli.
    const doubtfulButton = cheque.direction === "in" && cheque.status === "bounced" && cheque.accountId && HOF.can("accounts.manage") && HOF.can("accounts.doubtful") && HOF.accounts?.doubtfulFromCheque ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="doubtful" title="Evrakın tutarı şüpheli alacağa alınır (B 128 / A 120); neden evraktan">Şüpheli Alacağa Al</button>' : "";
    // Tahsildeki evrak: Ciro Et ve Sil pasif; nedeni düğmelerin yanında görünür yazı (yalnız ipucu değil). Düzenle'de yalnız no, banka, açıklama.
    const held = cheque.deposited && cheque.collection ? cheque.collection : null;
    const why = held && cheque.canManage ? `Ciro Et ve Sil kapalı: evrak ${held.bankLabel} hesabında tahsilde (${HOF.formatDate(held.givenDate)}). Tutar, cari, tarih ve vade değişmez; Düzenle'de yalnız no, banka ve açıklama düzeltilir. Önce Bankadan Geri Al'ın.` : "";
    const off = label => `<button type="button" class="hof-button hof-button-small hof-button-ghost" disabled aria-disabled="true" aria-describedby="hof-chq-why" data-off="${esc(label)}" title="${esc(why)}">${esc(label)}</button>`;
    const offCiro = why ? off("Ciro Et") : "";
    const offDelete = why && !cheque.invoiceId && cheque.events.length === 1 ? off("Sil") : "";
    const bankHistory = (cheque.collections || [])
      .map(
        item => `<li class="is-deposit"><span class="hof-chq-when">${esc(HOF.formatDate(item.givenDate))}</span><b>Bankaya Tahsile Verildi</b> · ${esc(item.bankLabel)}${item.eventNo ? ` · ${esc(item.eventNo)}` : ""}<small>${item.status === "pending" ? "Bankada tahsilde" : `${esc(item.statusLabel)}${item.closedDate ? ` · ${esc(HOF.formatDate(item.closedDate))}` : ""}${item.closeEventNo ? ` · ${esc(item.closeEventNo)}` : ""}`}</small></li>`,
      )
      .join("");
    const history = cheque.events
      .map(
        event => `<li class="is-${esc(event.kind)}"><span class="hof-chq-when">${esc(HOF.formatDate(event.date))}</span><b>${esc(event.label)}</b>${event.accountName ? ` · ${esc(event.accountName)}` : ""}${event.note ? `<small>${esc(event.note)}</small>` : ""}<small class="hof-muted">${esc(event.actorName || "")} · ${esc(HOF.formatDateTime(event.createdAt))}${event.ledger ? " · defter kaydı yazıldı" : ""}</small></li>`,
      )
      .join("");
    HOF.swap(root, `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3><span class="hof-chq-dir is-${esc(cheque.direction)}">${esc(cheque.directionLabel)}</span> ${esc(cheque.instrumentLabel)}${cheque.serialNo ? ` No ${esc(cheque.serialNo)}` : ""} ${statusPill(cheque)}</h3><small>${esc(cheque.party)}${cheque.bank ? ` · ${esc(cheque.bank)}` : ""}</small></div></div>
        <div class="hof-chq-amount"><span>Tutar</span><strong>${esc(money(cheque.amount))}</strong></div>
      </div>
      <dl class="hof-chq-facts">
        ${fact("Vade", `${esc(HOF.formatDate(cheque.dueDate))} ${dueBadge(cheque)}`)}
        ${fact(cheque.direction === "in" ? "Alış Tarihi" : "Veriliş Tarihi", esc(HOF.formatDate(cheque.issueDate)))}
        ${fact(cheque.direction === "in" ? "Keşideci / Borçlu" : "Lehtar", esc(cheque.drawer))}
        ${fact("Cari", accountLink(cheque.accountId, cheque.accountName))}
        ${fact(cheque.instrument === "note" ? "Ödeme Hesabı (Öneri)" : "Çek Hesabı", cheque.direction === "out" && cheque.bankAccountLabel ? esc(cheque.bankAccountLabel) : "")}
        ${fact("Taksit kartı", cheque.planName ? `<a href="#" data-open-plan="${esc(cheque.planId)}">${esc(cheque.planName)}</a>` : "")}
        ${fact("Ciro edilen", accountLink(cheque.endorseAccountId, cheque.endorseAccountName))}
        ${fact("Bankada Tahsilde", held ? `${esc(held.bankLabel)} · ${esc(HOF.formatDate(held.givenDate))}${held.eventNo ? ` · ${esc(held.eventNo)}` : ""}` : "")}
        ${fact("Son durum tarihi", cheque.status === "portfolio" || cheque.status === "pending" ? "" : esc(HOF.formatDate(cheque.statusDate)))}
        ${fact("Fatura", cheque.invoiceId && HOF.can("invoices.view") ? `<a href="#" data-open-invoice="${esc(cheque.invoiceId)}" title="Bu evrak faturanın ödemesidir; faturayı iptal etmeden silinmez">${esc(cheque.invoiceNumber || "Faturayı Aç")}</a>` : "")}
        ${fact("Kapatılacak Fatura", bondHtml(cheque))}
        ${fact("Açıklama", esc(cheque.note))}
      </dl>
      <div class="hof-chq-actions" role="toolbar" aria-label="Evrak işlemleri">${actionButtons}${offCiro}${bankButtons}${doubtfulButton}${cheque.canUndo ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="undo">↶ ${esc(cheque.undoLabel)}</button>` : ""}${cheque.canManage ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button>` : ""}${cheque.canDelete ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-act="delete">Sil</button>` : offDelete}${why ? `<p class="hof-chq-why" id="hof-chq-why" data-chq-why>${esc(why)}</p>` : ""}</div>
      ${cheque.lockNote && !why ? `<p class="hof-rep-note hof-chq-lock-note">${esc(cheque.lockNote)}</p>` : ""}
      <p class="hof-rep-note">${cheque.direction === "in" ? "Alınınca carinin borcu düşer (ya da taksite sayılır); para tahsil edilince banka hesabına ya da Kasa'ya girer. Ciro edilince tedarikçiye olan borç düşer. Karşılıksız çıkarsa müşteri yeniden borçlanır." : "Verilince tedarikçiye olan borç düşer; para ödenince bankadan ya da Kasa'dan çıkar."}</p>
      <h4 class="hof-chq-subtitle">İşlem Geçmişi</h4>
      <ol class="hof-chq-history">${history}</ol>
      ${bankHistory ? `<h4 class="hof-chq-subtitle">Banka Tahsil Kayıtları</h4><ol class="hof-chq-history" data-chq-collections>${bankHistory}</ol>` : ""}`);
  }

  // ---------- Formlar ----------
  // preset (v2.0.13): cari kartındaki Tahsilat / Ödeme formunda "Çek / Senet" yolu seçilince cari ve tutar dolu gelir.
  function chequeForm({ direction, cheque = null, preset = null }) {
    const edit = Boolean(cheque);
    const core = !edit || cheque.canEditCore;
    // 2.4.4 UX18 (kullanıcı kararı 21.10.2026): "Kapatılacak Fatura" — faturanın Tahsilat Ekle / Ödeme Yap'ından ya da cari formunda seçilen fatura bu
    // evrakla kapanır (sunucu: aynı cari, kaydedilmiş, taksitsiz, yön uyumlu). Liste cari formundakiyle aynı; Taksite Say ile birlikte seçilmez.
    const bondWanted = edit ? cheque.closesInvoice?.id || "" : preset?.invoiceId || "";
    const bondAccount = edit ? cheque.accountId || "" : preset?.account?.id || "";
    const bondState = { shown: false, account: bondAccount };
    const fields = [
      { name: "instrument", label: "Evrak", type: "select", value: cheque?.instrument || "cheque", options: [{ value: "cheque", label: "Çek" }, { value: "note", label: "Senet" }] },
      { name: "amount", label: "Tutar (₺)", required: true, autofocus: !edit, value: cheque ? String(cheque.amount).replace(".", ",") : preset?.amount ? String(preset.amount) : "", inputmode: "decimal", placeholder: "ör. 12.500,00" },
      { name: "dueDate", label: "Vade Tarihi", type: "date", required: true, value: cheque?.dueDate || "" },
      { name: "issueDate", label: direction === "in" ? "Alış Tarihi" : "Veriliş Tarihi", type: "date", required: true, max: "today", value: cheque?.issueDate || todayIso() },
      { name: "serialNo", label: "Çek / Senet No", value: cheque?.serialNo || "", maxlength: 60 },
      { name: "bank", label: "Banka / Şube", value: cheque?.bank || "", maxlength: 120, placeholder: "ör. Ziraat Bankası Meram" },
      { name: "drawer", label: direction === "in" ? "Keşideci / Borçlu (cari seçilmezse)" : "Lehtar (cari seçilmezse)", value: cheque?.drawer || "", maxlength: 160 },
      { name: "note", label: "Açıklama", value: cheque?.note || "", maxlength: 500 },
    ];
    HOF.formModal({
      title: edit ? `${cheque.directionLabel} ${cheque.instrumentLabel} Düzenle` : direction === "in" ? "Çek / Senet Al" : "Çek / Senet Ver",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      // v2.0.26 (2. gözden geçirme İ3): çekirdek kapalıyken metin sunucudan (coreNote): faturadan gelen, işlem görmüş, kilitli
      // dönemde — sunucunun gerçek kuralıyla aynı sırada.
      intro: edit
        ? core
          ? "Tahsil, ciro ya da ödeme yapılmadıkça tutar, cari ve tarihler değiştirilebilir; cari/taksit kaydı birlikte düzeltilir."
          : cheque.coreNote || "Bu evrakta yalnız vade, no, banka ve açıklama değiştirilebilir."
        : direction === "in"
          ? "Müşteriden aldığınız evrak portföye girer. Cari seçerseniz carinin borcu düşer; taksit kartı seçerseniz o taksit ödenmiş sayılır. Para tahsil edildiğinde banka hesabına ya da Kasa'ya girer."
          : "Tedarikçiye verdiğiniz kendi çekiniz/senediniz. Cari seçerseniz tedarikçiye olan borcunuz düşer; para vadesinde ödendiğinde bankadan ya da Kasa'dan çıkar.",
      // v2.2.0 (§3.14): tahsildeki evrakın vadesi de değişmez (sunucu 409 cheque-deposited); yalnız no, banka ve açıklama.
      fields: core ? fields : fields.filter(field => !["instrument", "amount", "issueDate", ...(cheque?.deposited ? ["dueDate"] : [])].includes(field.name)),
      submitLabel: edit ? "Kaydet" : direction === "in" ? "Portföye Al" : "Kaydet",
      onOpen: dialog => {
        // v2.2.0 (İz 2.5–2.6): verilen evrakta "Banka / Şube" yerine Çek Hesabı (çek) / Ödeme Hesabı önerisi (senet); alınan evrakta metin kalır.
        if (direction === "out" && HOF.bank?.attachChequePicker) HOF.bank.attachChequePicker(dialog.querySelector("form"), { cheque });
        if (!core) return;
        const form = dialog.querySelector("form");
        const anchor = form.querySelector('[name="drawer"]').closest(".hof-field");
        const planSlot = HOF.el("div", { class: "hof-chq-plan", hidden: true });
        const loadPlans = async account => {
          planSlot.hidden = true;
          planSlot.innerHTML = "";
          if (direction !== "in" || !account?.id) return;
          try {
            const detail = await HOF.api(`/api/workspace/accounts/${encodeURIComponent(account.id)}`);
            const active = (detail.plans || []).filter(plan => plan.status === "active");
            if (!active.length) return;
            planSlot.innerHTML = HOF.fieldHtml({ name: "planId", label: "Taksite Say (isteğe bağlı)", type: "select", value: cheque?.planId || "", options: [{ value: "", label: "Hayır — carinin borcundan düş" }, ...active.map(plan => ({ value: plan.id, label: `${plan.name} · kalan ${money(plan.totals.remaining)}${plan.next ? ` · sıradaki ${HOF.formatDate(plan.next.dueDate)}` : ""}` }))], help: "Seçilen karttaki en eski açık taksitten başlayarak ödenmiş sayılır; çek karşılıksız çıkarsa taksit yeniden açılır." });
            planSlot.hidden = false;
          } catch {
            // taksit kartları okunamazsa seçim gösterilmez
          }
        };
        // UX18: Kapatılacak Fatura seçimi (faturayla kaydedilen evrakta yok: onun faturası kendisidir).
        const invoiceSlot = HOF.el("div", { class: "hof-chq-invoice", hidden: true });
        let invoiceTurn = 0;
        // Taksite Say ile Kapatılacak Fatura birlikte seçilmez (sunucu 400): biri seçilince öbürü boşalır (pasifleşmez; kullanıcı fikrini değiştirebilir).
        const exclusive = changed => {
          const plan = form.querySelector('[name="planId"]');
          const invoice = form.querySelector('[name="invoiceId"]');
          if (!plan || !invoice) return;
          if (changed === "planId" && plan.value) invoice.value = "";
          else if (changed === "invoiceId" && invoice.value) plan.value = "";
          else if (plan.value && invoice.value) invoice.value = "";
        };
        const loadInvoices = async account => {
          const turn = ++invoiceTurn;
          invoiceSlot.hidden = true;
          invoiceSlot.innerHTML = "";
          bondState.shown = false;
          bondState.account = account?.id || "";
          if (!account?.id || cheque?.invoiceId || !HOF.accounts?.openInvoiceOptions) return;
          const options = await HOF.accounts.openInvoiceOptions(account, direction === "in" ? "in" : "out");
          if (turn !== invoiceTurn) return;
          // Evrakın (ya da açıldığı faturanın) bağı yalnız kendi carisinde seçili gelir; başka cari seçilince Otomatik.
          const wanted = account.id === bondAccount ? bondWanted : "";
          if (wanted && !options.some(option => option.value === wanted)) options.unshift({ value: wanted, label: cheque?.closesInvoice?.number ? `Bağlı Fatura ${cheque.closesInvoice.number}` : preset?.invoiceLabel || "Bağlı Fatura" });
          if (!options.length) return;
          invoiceSlot.innerHTML = HOF.fieldHtml({ name: "invoiceId", label: "Kapatılacak Fatura", type: "select", value: wanted, options: [{ value: "", label: "Otomatik (En Eski Açık Fatura)" }, ...options], help: "Seçilen fatura bu evrakla kapanır; fazlası en eski açık faturaya gider. Fatura iptal edilirse evrak portföyde kalır, yalnız bağ düşer; evrak karşılıksız dönerse fatura yeniden açılır." });
          invoiceSlot.hidden = false;
          bondState.shown = true;
          exclusive();
        };
        const onPick = account => {
          loadPlans(account).then(() => exclusive());
          loadInvoices(account);
        };
        form.addEventListener("change", event => {
          if (event.target.name === "planId" || event.target.name === "invoiceId") exclusive(event.target.name);
        });
        const picker = HOF.accounts?.picker({ value: cheque?.accountId ? { id: cheque.accountId, name: cheque.accountName } : preset?.account?.id ? { id: preset.account.id, name: preset.account.name } : {}, label: direction === "in" ? "Kimden Alındı (cari)" : "Kime Verildi (cari)", help: direction === "in" ? "Müşteri carisi. Yoksa aşağıya keşidecinin adını yazın." : "Tedarikçi carisi. Yoksa aşağıya lehtarın adını yazın.", prefer: direction === "in" ? "customer" : "supplier", allowNew: { type: direction === "in" ? "customer" : "supplier" }, onPick });
        if (picker) anchor.before(picker);
        anchor.after(planSlot);
        planSlot.after(invoiceSlot);
        if (cheque?.accountId || preset?.account?.id) {
          const account = { id: cheque?.accountId || preset.account.id, name: cheque?.accountName || preset?.account?.name || "" };
          loadPlans(account).then(() => exclusive());
          loadInvoices(account);
        }
      },
      onSubmit: async data => {
        const payload = { ...data, direction, amount: data.amount ?? cheque?.amount, updatedAt: cheque?.updatedAt };
        if (!payload.planId) delete payload.planId;
        // UX18: seçim görünüyorsa değeri (Otomatik = ""); görünmüyorsa evrakın bağı başka cari seçildiği için düşer, yoksa sunucuda olduğu gibi kalır.
        if (!bondState.shown) {
          delete payload.invoiceId;
          if (bondWanted && core && bondState.account !== bondAccount) payload.invoiceId = "";
        }
        const url = edit ? `/api/workspace/cheques/${encodeURIComponent(cheque.id)}` : "/api/workspace/cheques";
        let saved;
        try {
          saved = await HOF.api(url, { method: edit ? "PUT" : "POST", body: payload });
        } catch (error) {
          if (error.data?.code === "cheque-duplicate" && (await HOF.confirm({ title: "Aynı numaralı evrak var", message: `${error.message} Yine de ikinci kez kaydedilsin mi?`, confirmLabel: "Yine de Kaydet" }))) {
            saved = await HOF.api(url, { method: edit ? "PUT" : "POST", body: { ...payload, allowDuplicate: true } });
          } else throw error;
        }
        HOF.toast(edit ? "Evrak güncellendi." : direction === "in" ? "Evrak portföye alındı." : "Verilen evrak kaydedildi.", { type: "success" });
        HOF.emit("accounts-changed");
        if (!modal) {
          HOF.emit("cheques-changed", saved);
          return;
        }
        view.id = saved.id;
        view.cheque = saved;
        view.mode = "card";
        renderCard();
        loadList();
        HOF.emit("cheques-changed", saved);
      },
    });
  }
  const ACTION_TEXT = {
    collect: { title: "Tahsil Et", past: "tahsil edildi", intro: "Tutar seçtiğiniz tarihte seçtiğiniz hesaba (banka ya da nakit kasa) giriş olarak yazılır.", submit: "Tahsili Kaydet" },
    pay: { title: "Ödeme Yap", past: "ödendi", intro: "Tutar seçtiğiniz tarihte seçtiğiniz hesaptan (banka ya da nakit kasa) çıkış olarak yazılır.", submit: "Ödemeyi Kaydet" },
    endorse: { title: "Ciro Et", past: "ciro edildi", intro: "Evrak seçtiğiniz tedarikçiye verilir; o cariye olan borcunuz evrak tutarı kadar düşer. Kasa değişmez.", submit: "Ciro Et" },
    bounce: { title: "Karşılıksız / İade", past: "karşılıksız / iade", intro: "Evrak karşılıksız çıktı ya da iade edildi: müşteri yeniden borçlanır (taksite sayıldıysa taksit yeniden açılır); ciro edildiyse tedarikçiye olan borç geri gelir.", submit: "Karşılıksız / İade İşaretle" },
  };
  // v2.2.0 (plan §3.14): tahsildeki evrakın Tahsil Et ve Karşılıksız açıklaması (para kaydın hesabına girer; karşılıksız tahsil kaydını kapatır).
  const DEPOSITED_TEXT = {
    collect: "Banka evrakı tahsil etti: tutar seçtiğiniz tarihte evrakın tahsilde olduğu banka hesabına giriş olarak yazılır. Yol Havale / EFT, hesap tahsil kaydının hesabıdır.",
    bounce: "Evrak bankadan karşılıksız döndü: Bankada Tahsilde kaydı kapanır, müşteri yeniden borçlanır (taksite sayıldıysa taksit yeniden açılır). Banka bakiyesi değişmez.",
  };
  function actionForm(cheque, action) {
    const text = ACTION_TEXT[action];
    // v2.1.0 Aşama 8: istek kimliği form açılışında; tahsil/ödemede Banka seçilince Banka Hesabı (tek hesapta gizli) ve hesabın soruları.
    const requestId = HOF.requestId();
    const moneyAction = action === "collect" || action === "pay";
    // Tahsildeki evrakın tahsili (§3.14): yol Havale / EFT ve hesap tahsil kaydının hesabı — salt okunur, nedeni yazılı; nakit seçeneği yok.
    const held = action === "collect" && cheque.deposited && cheque.collection ? cheque.collection : null;
    HOF.formModal({
      title: `${text.title} · ${cheque.instrumentLabel}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""}`,
      eyebrow: money(cheque.amount),
      intro: (cheque.deposited && DEPOSITED_TEXT[action]) || text.intro,
      fields: [
        { name: "date", label: "İşlem Tarihi", type: "date", required: true, value: todayIso() },
        // v2.0.13: çek/senet çoğunlukla bankadan tahsil edilir/ödenir; elden ise Nakit.
        ...(held
          ? [
              { name: "heldMethod", label: "Tahsil Yolu", value: "Havale / EFT", readonly: true },
              { name: "heldAccount", label: "Tahsil Edilen Hesap", value: held.bankLabel, readonly: true, help: "Evrak bu hesapta tahsilde; tahsil bu hesaba yazılır. Başka hesaba ya da elden (nakit) tahsil edildiyse önce Bankadan Geri Al'ın." },
            ]
          : action === "collect" || action === "pay" ? [{ name: "method", label: action === "collect" ? "Tahsil Edilen Hesap" : "Ödenen Hesap", type: "select", value: "bank", options: [{ value: "bank", label: "Banka (Havale / EFT)" }, { value: "cash", label: "Nakit Kasa (elden)" }] }] : []),
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: action === "bounce" ? "ör. banka iade etti" : "" },
      ],
      submitLabel: text.submit,
      onOpen: dialog => {
        if (held) return heldBalance(dialog.querySelector("form"), held, Number(cheque.amount) || 0);
        // v2.2.0 (İz 2.5–2.6): verilen çekin ödemesinde hesap çekin Çek Hesabı; senette önerilen hesap (yoksa Senet Kullan işaretli ilk hesap).
        const own = action === "pay" ? cheque.bankAccountId || "" : "";
        // 2.7: seçicide bakiye — tutar evrakın tutarı (ödemede hesaptan çıkar, tahsilde girer).
        if (moneyAction && HOF.bank?.attachPicker) HOF.bank.attachPicker(dialog.querySelector("form"), { methodName: "method", value: own, ...(action === "pay" && cheque.instrument === "note" && !own ? { suggest: "note" } : {}), direction: action === "pay" ? "out" : "in", amount: () => Number(cheque.amount) || 0 });
        if (action !== "endorse") return;
        // v2.0.17 (müşteri: "cari bulunmuyor"): tür kısıtı yok — bütün cariler aranır, tedarikçiler üstte; "+ Yeni Cari".
        const picker = HOF.accounts?.picker({ label: "Ciro Edilen Cari", required: true, prefer: "supplier", allowNew: { type: "supplier" }, help: "Tedarikçi ya da müşteri: çekin kime verildiği. Bulunamazsa + Yeni Cari ile açın.", name: "accountId" });
        if (picker) dialog.querySelector('[name="date"]').closest(".hof-field").before(picker);
      },
      onSubmit: async data => {
        if (action === "endorse" && !data.accountId) throw new Error("Çeki kime ciro ettiğinizi seçin.");
        const body = held
          ? { action, date: data.date, note: data.note, accountId: "", method: "bank", bankAccountId: held.bankAccountId, status: cheque.status }
          : { action, date: data.date, note: data.note, accountId: data.accountId || "", method: data.method || "", status: cheque.status, ...(moneyAction && data.method === "bank" && data.bankAccountId ? { bankAccountId: data.bankAccountId } : {}) };
        const send = flags => HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}/actions`, { method: "POST", body: { ...body, ...flags }, requestId });
        const saved = HOF.bank?.withConfirms ? await HOF.bank.withConfirms(send) : await send({});
        HOF.toast(`${cheque.instrumentLabel} ${ACTION_TEXT[action].past} olarak işlendi.`, { type: "success" });
        apply(saved);
      },
    });
  }
  // ---------- Bankaya Tahsile Ver / Bankadan Geri Al (v2.2.0; plan §3.14, İz 2.6) ----------
  const titleOf = (head, cheque) => `${head} · ${cheque.instrumentLabel}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""}`;
  /** Tahsildeki evrakın tahsil formunda hesabın bakiye satırı (İz 2.7 kalıbı; yalnız Banka Görüntüleme yetkisine): Bakiye · İşlemden Sonra. */
  async function heldBalance(form, held, amount) {
    const field = form?.querySelector('[name="heldAccount"]')?.closest(".hof-field");
    const dateNode = form?.querySelector('[name="date"]');
    if (!field || !HOF.bank?.choices || !HOF.bank?.balanceLine) return;
    let data = null;
    try {
      data = await HOF.bank.choices(true, dateNode?.value || "");
    } catch {
      return;
    }
    const draw = () => {
      if (!form.isConnected) return;
      field.querySelector("[data-bank-balance]")?.remove();
      const line = HOF.bank.balanceLine(data, held.bankAccountId, { change: Math.round(amount * 100) });
      if (line) field.insertAdjacentHTML("beforeend", line);
    };
    draw();
    let seq = 0;
    dateNode?.addEventListener("change", async () => {
      if (!data?.balances) return;
      const mine = (seq += 1);
      const fresh = await HOF.bank.balances(dateNode.value);
      if (mine !== seq || !fresh?.balances) return;
      data = { ...data, balances: fresh.balances };
      draw();
    });
  }
  /**
   * Bankaya Tahsile Ver'in Banka Hesabı seçicisi: hesaplar sunucunun TEK kuralından (kartın depositAccounts'ı — etkin TL Vadesiz/Ticari/Diğer; çekte
   * "Çek Kullan", senette "Senet Kullan" işaretli); seçenek adında bakiye (İz 2.7; yalnız Banka Görüntüleme yetkisine). Tek hesapta bilgi satırı (alan
   * yok; sunucu o hesabı kendisi seçer), çokta seçim zorunlu (ön seçim yok), hiç yoksa "Banka Hesabı Tanımla" (HOF.bank.registerDefine
   * "deposit-cheque" / "deposit-note": evrak türünün işareti dolu gelir; form kapanmaz, kaydedilen hesap seçili gelir). Tanımlama yetkisi yoksa
   * düğme yerine "Banka hesabı tanımlı değil, yöneticinize başvurun." yazısı.
   */
  async function depositPicker(form, cheque) {
    const dateNode = form?.querySelector('[name="date"]');
    const anchor = dateNode?.closest(".hof-field");
    if (!anchor || !HOF.bank?.pickerHtml) return;
    const kind = cheque.instrument === "note" ? "note" : "cheque";
    let list = cheque.depositAccounts || [];
    let data = null;
    let forced = "";
    const load = async () => {
      let bank = null;
      try {
        bank = await HOF.bank.choices(true, dateNode.value || "");
      } catch {
        bank = null;
      }
      const known = new Set((bank?.accounts || []).map(account => account.id));
      const extra = list.filter(account => !known.has(account.id)).map(account => ({ id: account.id, code: account.code, label: `${account.bankName} · ${account.name}`, kind: "demand" }));
      data = { ...(bank || {}), accounts: [...(bank?.accounts || []), ...extra], forms: { ...(bank?.forms || {}), deposit: { ids: list.map(account => account.id), defaultId: "" } } };
    };
    const syncLine = () => {
      const box = form.querySelector("[data-deposit-pick]");
      if (!box) return;
      box.querySelector("[data-bank-balance]")?.remove();
      const id = box.querySelector("select")?.value || box.querySelector("[data-bank-single]")?.dataset.bankSingle || "";
      const line = id ? HOF.bank.balanceLine(data, id, { only: true }) : "";
      if (line) box.insertAdjacentHTML("beforeend", line);
    };
    const render = () => {
      if (!form.isConnected) return;
      const current = forced || form.querySelector("[data-deposit-pick] select")?.value || "";
      form.querySelectorAll("[data-deposit-pick]").forEach(node => node.remove());
      const picked = HOF.bank.pickerHtml(data, { form: "deposit", name: "bankAccountId", label: "Banka Hesabı", choose: "Hesap Seçin", preselect: false, none: false, define: `deposit-${kind}`, value: current, note: label => `${label} hesabına tahsile verilir.` });
      anchor.insertAdjacentHTML("afterend", `<div class="hof-bank-pick" data-deposit-pick="${esc(picked.mode)}">${picked.html}</div>`);
      syncLine();
    };
    await load();
    render();
    let seq = 0;
    form.addEventListener("change", async event => {
      if (event.target.closest?.("[data-deposit-pick]")) return syncLine();
      if (event.target !== dateNode || !data?.balances) return;
      const mine = (seq += 1);
      const fresh = await HOF.bank.balances(dateNode.value);
      if (mine !== seq || !form.isConnected || !fresh?.balances) return;
      data = { ...data, balances: fresh.balances };
      render();
    });
    form.addEventListener("hof-bank-defined", async event => {
      if (event.detail?.kind !== `deposit-${kind}` || !event.detail.account?.id) return;
      try {
        list = (await HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}`)).depositAccounts || [];
      } catch {
        // liste okunamazsa sunucu tek uygun hesabı yine kendisi seçer
      }
      await load();
      forced = event.detail.account.id;
      render();
      forced = "";
      (form.querySelector("[data-deposit-pick] select") || form.querySelector('button[type="submit"]'))?.focus();
    });
  }
  function depositForm(cheque) {
    const requestId = HOF.requestId();
    const flag = cheque.instrument === "note" ? "Senet Kullan" : "Çek Kullan";
    HOF.formModal({
      title: titleOf("Bankaya Tahsile Ver", cheque),
      eyebrow: money(cheque.amount),
      intro: `Evrak seçtiğiniz banka hesabına tahsile verilir: “Portföyde”den “Bankada Tahsilde”ye geçer, banka bakiyesi o gün değişmez. Banka tahsil edince “Tahsil Et” ile para bu hesaba girer; karşılıksız dönerse “Karşılıksız / İade”. Yalnız “${flag}” işaretli hesaplar listelenir.`,
      fields: [
        { name: "date", label: "İşlem Tarihi", type: "date", required: true, max: "today", value: todayIso() },
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: "ör. tahsil bordrosu no" },
      ],
      submitLabel: "Bankaya Tahsile Ver",
      onOpen: dialog => depositPicker(dialog.querySelector("form"), cheque),
      onSubmit: async data => {
        const body = { action: "bank-deposit", date: data.date, note: data.note, status: cheque.status, ...(data.bankAccountId ? { bankAccountId: data.bankAccountId } : {}) };
        const saved = await HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}/actions`, { method: "POST", body, requestId });
        HOF.toast(`${cheque.instrumentLabel} ${saved.collection?.bankLabel || "bankaya"} hesabına tahsile verildi.`, { type: "success" });
        apply(saved);
      },
    });
  }
  function withdrawForm(cheque) {
    const requestId = HOF.requestId();
    HOF.formModal({
      title: titleOf("Bankadan Geri Al", cheque),
      eyebrow: money(cheque.amount),
      intro: `Evrak ${esc(cheque.collection?.bankLabel || "banka")} hesabından geri alınır ve yeniden portföye döner (Bankada Tahsilde biter); banka bakiyesi değişmez. Sonra ciro edilebilir, elden tahsil edilebilir ya da başka hesaba tahsile verilebilir.`,
      fields: [
        { name: "date", label: "İşlem Tarihi", type: "date", required: true, max: "today", value: todayIso() },
        { name: "note", label: "Açıklama", maxlength: 300, placeholder: "ör. banka iade etti" },
      ],
      submitLabel: "Bankadan Geri Al",
      onSubmit: async data => {
        const saved = await HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}/actions`, { method: "POST", body: { action: "bank-withdraw", date: data.date, note: data.note, status: cheque.status }, requestId });
        HOF.toast(`${cheque.instrumentLabel} bankadan geri alındı; yeniden portföyde.`, { type: "success" });
        apply(saved);
      },
    });
  }
  async function undo(cheque) {
    const ok = await HOF.confirm({ title: cheque.undoLabel, message: "Son işlemin cari, taksit ve Kasa kayıtları birlikte geri alınır; evrak bir önceki durumuna döner.", confirmLabel: "Geri Al" });
    if (!ok) return;
    try {
      const last = cheque.events.at(-1);
      // Bankaya bağlı tahsilin geri alınması hesabın bakiyesini düşürür: eksi bakiye sorusu (K7) "Yine de Kaydet" ile.
      const send = flags => HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}/undo`, { method: "POST", body: { eventId: last?.id, ...flags } });
      apply(HOF.bank?.withConfirms ? await HOF.bank.withConfirms(send) : await send({}));
      HOF.toast("Son işlem geri alındı.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function remove(cheque) {
    const ok = await HOF.confirm({ title: "Evrak silinsin mi?", message: `Cari/taksit kaydı birlikte kaldırılır. ${HOF.trashHint()}`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/cheques/${encodeURIComponent(cheque.id)}`, { method: "DELETE" });
      HOF.toast("Evrak silindi.", { type: "success" });
      view.mode = "list";
      view.id = "";
      view.cheque = null;
      renderList();
      loadList();
      HOF.emit("cheques-changed", null);
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Excel / Google Sheets'ten portföy ----------
  const ROLE_OPTIONS = [
    ["", "— Alma —"],
    ["serial", "Çek / Senet No"],
    ["bank", "Banka / Şube"],
    ["drawer", "Keşideci / Lehtar (kişi, firma)"],
    ["amount", "Tutar"],
    ["due", "Vade Tarihi"],
    ["issue", "Alış / Veriliş Tarihi"],
    ["direction", "Yön (alınan / verilen)"],
    ["instrument", "Evrak (çek / senet)"],
    ["status", "Durum"],
    ["note", "Açıklama"],
    ["extra", "Açıklamaya Ekle"],
  ];
  async function importFlow() {
    const chosen = await HOF.office?.chooseSheet?.({ title: "Çek / Senet Portföyü Yükle", eyebrow: "ÇEK / SENET", hint: "Excel dosyası ya da Google Sheets bağlantısı. Her satır bir evrak olur; tahsil edilmiş, ödenmiş, ciro ya da karşılıksız satırlar alınmaz." });
    if (!chosen) return;
    const { fileName, matrix } = chosen;
    let preview;
    try {
      preview = await HOF.api("/api/workspace/cheques/import/preview", { method: "POST", body: { matrix } });
    } catch (error) {
      return HOF.toastError(error);
    }
    const sample = matrix[preview.headerAt + 1] || [];
    HOF.formModal({
      title: "Çek / Senet Portföyü: Kolonları Eşle",
      eyebrow: fileName,
      size: "wide",
      intro: `${preview.rows} satır bulundu. Program başlıkları tanıdı; yanlışsa değiştirin. Keşideci adı birebir aynı olan tek cari varsa evrak o cariye bağlanır.`,
      fields: [
        ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] === "extra" ? "" : preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, label]) => ({ value, label })) })),
        { name: "direction", label: "Yön kolonu yoksa hepsi", type: "select", value: view.direction === "out" ? "out" : "in", options: [{ value: "in", label: "Alınan (müşteri evrakı, portföy)" }, { value: "out", label: "Verilen (kendi çekimiz / senedimiz)" }] },
        { name: "instrument", label: "Evrak kolonu yoksa hepsi", type: "select", value: "cheque", options: [{ value: "cheque", label: "Çek" }, { value: "note", label: "Senet" }] },
        { name: "post", label: "Bağlanan carilere de işle (alınan çekte carinin borcu düşer, verilen çekte tedarikçiye borç düşer). Cari bakiyelerini Excel'den ayrıca yüklediyseniz işaretlemeyin.", type: "checkbox", value: false },
      ],
      submitLabel: "Portföye Al",
      onOpen: dialog => {
        dialog.classList.add("hof-import-form");
        HOF.office?.wireGate?.(dialog, preview, matrix, "/api/workspace/cheques/import/preview");
      },
      onSubmit: async data => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          if (data[`c${index}`]) roles[index] = data[`c${index}`];
        });
        if (!Object.values(roles).includes("amount")) throw new Error("Tutar kolonunu seçin.");
        if (!Object.values(roles).includes("due")) throw new Error("Vade tarihi kolonunu seçin.");
        const result = await HOF.api("/api/workspace/cheques/import", { method: "POST", body: { matrix, headerAt: preview.headerAt, roles, direction: data.direction, instrument: data.instrument, post: data.post === true, fileName } });
        const parts = [`${result.created} evrak portföye alındı`];
        if (result.linked) parts.push(`${result.linked} cariye bağlandı`);
        if (result.posted) parts.push(`${result.posted} cari hareketi yazıldı`);
        if (result.truncated) parts.push(`${result.truncated} satır sınır dışı kaldı`);
        const skipped = result.skippedTotal ? ` ${result.skippedTotal} satır alınmadı (${[...new Set(result.skipped.map(item => item.reason))].slice(0, 3).join("; ")}).` : "";
        HOF.toast(`${parts.join(", ")}.${skipped}`, { type: result.created ? "success" : "error", timeout: 10000 });
        view.status = "open";
        view.mode = "list";
        if (!modal) open();
        else loadList();
      },
    });
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const target = event.target.closest("button, a[data-open-account], a[data-open-plan], tr[data-cheque]");
    if (!target) return;
    if (target.dataset.openAccount) {
      event.preventDefault();
      modal?.close();
      return HOF.accounts?.open(target.dataset.openAccount);
    }
    if (target.dataset.openPlan) {
      event.preventDefault();
      modal?.close();
      return HOF.plans?.open(target.dataset.openPlan);
    }
    if (target.matches("tr[data-cheque]")) return loadCheque(target.dataset.cheque);
    if (target.dataset.direction !== undefined) {
      view.direction = target.dataset.direction;
      return loadList();
    }
    if (target.dataset.action && view.cheque) return actionForm(view.cheque, target.dataset.action);
    if (target.dataset.bankAction && view.cheque) return target.dataset.bankAction === "bank-withdraw" ? withdrawForm(view.cheque) : depositForm(view.cheque);
    const act = target.dataset.act;
    if (act === "new-in") return chequeForm({ direction: "in" });
    if (act === "new-out") return chequeForm({ direction: "out" });
    if (act === "import") return importFlow();
    if (act === "more") return loadList(true);
    if (act === "retryList") {
      view.listError = "";
      renderList();
      return loadList();
    }
    if (act === "back") {
      view.mode = "list";
      view.id = "";
      view.cheque = null;
      renderList();
      return loadList();
    }
    if (!view.cheque) return;
    if (act === "undo") return undo(view.cheque);
    if (act === "doubtful") return HOF.accounts.doubtfulFromCheque(view.cheque);
    if (act === "edit") return chequeForm({ direction: view.cheque.direction, cheque: view.cheque });
    if (act === "delete") return remove(view.cheque);
  }
  function onChange(event) {
    const name = event.target.dataset.filter;
    if (!name || name === "q") return;
    view[name] = event.target.value;
    loadList();
  }

  // Başka modülden yeni evrak formu (v2.0.13): cari ve tutar dolu. Liste açık değilse de form tek başına çalışır.
  // invoiceId (2.4.4 UX18): faturanın Tahsilat Ekle / Ödeme Yap'ından ya da cari formunun Kapatılacak Fatura'sından — evrak bu faturayı kapatır.
  const newFor = ({ direction = "in", account = null, amount = 0, invoiceId = "", invoiceLabel = "" } = {}) => {
    if (!HOF.can("cheques.manage")) return HOF.toast("Çek / senet girme yetkiniz yok.", { type: "error" });
    chequeForm({ direction, preset: { account, amount, invoiceId, invoiceLabel } });
  };
  HOF.cheques = { open, newFor };
  // 2.3.0 İz 5.5 Hızlı Arama: yönler (alınan portföy / verilen evrak) ve yeni evrak işlemleri; "çek" ya da "senet" yazınca hepsi gelir.
  HOF.search?.register(() => {
    if (!HOF.can("cheques.view")) return [];
    const name = moduleName();
    const list = [
      { group: "Sayfa", label: "Alınan Çek / Senet", path: name, keywords: ["Portföy", "Müşteri Çeki", "Senet"], run: () => open({ direction: "in" }) },
      { group: "Sayfa", label: "Verilen Çek / Senet", path: name, keywords: ["Verilen Evrak", "Senet"], run: () => open({ direction: "out" }) },
    ];
    if (canManage()) {
      list.push(
        { group: "İşlem", label: "Çek / Senet Al", path: name, keywords: ["Portföye Al", "Senet Al", "Çek Al"], run: () => { open({ direction: "in" }); return chequeForm({ direction: "in" }); } },
        { group: "İşlem", label: "Çek / Senet Ver", path: name, keywords: ["Senet Ver", "Çek Ver"], run: () => { open({ direction: "out" }); return chequeForm({ direction: "out" }); } },
      );
    }
    return list;
  });
  HOF.whenReady(() => {
    // v2.0.22: canlı olaylar ve defter değişiklikleri tek yenileme kapısından (HOF.refresher).
    const refreshList = HOF.refresher(() => (modal && view.mode === "list" ? loadList(false, { quiet: true }) : null));
    const refreshCard = HOF.refresher(() => (modal && view.mode === "card" && view.id ? loadCheque(view.id, "", { quiet: true }) : null));
    // Başka bilgisayardaki değişiklik: açık liste/kart yenilenir.
    HOF.on("live:workspace.changed", change => {
      if (!modal || change?.kind !== "cheques") return;
      if (view.mode === "card" && view.id && (!change.chequeId || change.chequeId === view.id)) refreshCard();
      else refreshList();
    });
    // v2.0.11: evrak başka pencereden (Cari kartı, Kasa) değişince açık liste de yenilenir.
    HOF.onLedger(["cheques"], detail => {
      if (!modal || detail.path?.startsWith("/api/workspace/cheques")) return;
      if (view.mode !== "list") return;
      if (detail.local) refreshList.now();
      else refreshList();
    }, 350);
  });
})();
