/* DestekOfis — Tablodan taksit kartına aktarma (v2.0.8).
 * Ana tabloya yüklenen Excel/Sheets'teki ödeme planları (ay kolonları, 1./2./3. taksit kolonları, toplam + taksit sayısı +
 * ilk vade) Taksitler'e kart olarak aktarılır. Pencere: seçenekler (vade günü, ilk vade, kayıt tahsilatları, grup),
 * göstergeler, süzgeçler, kişi kişi ön izleme (taksitler, Excel'e göre ödenen, kayıt tahsilatı, kalan, cari, bulgular),
 * seçim ve Aktar; sonuç raporu ve geri alma. Veri yüklenince "N kişinin ödeme planı var, aktarılsın mı?" sorusu.
 * Sunucu: server/routes/plan-transfer.mjs (her şeyi yeniden hesaplar; ön izlemeden sonra tablo değiştiyse aktarmaz). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const number = value => Number(value || 0).toLocaleString("tr-TR");
  const STATUS = {
    ready: ["Hazır", "done", "Kart açılır"],
    warning: ["Uyarılı", "soon", "Kart açılır; bulguları kontrol edin"],
    link: ["Bağlanacak", "info", "Taksitler'deki kartı bu kayda bağlanır"],
    closed: ["Kapanmış", "muted", "Ödenmiş ya da ayrılmış; isterseniz seçin"],
    exists: ["Kartı var", "muted", "Bu kaydın kartı zaten var"],
    error: ["Aktarılamaz", "late", "Hata düzeltilmeden aktarılmaz"],
  };
  const FILTERS = [
    ["all", "Tümü", () => true],
    ["selected", "Seçilen", record => state.selected.has(record.key)],
    ["warning", "Uyarılı", record => record.status === "warning"],
    ["link", "Bağlanacak", record => record.status === "link"],
    ["closed", "Kapanmış", record => record.status === "closed"],
    ["exists", "Kartı var", record => record.status === "exists"],
    ["error", "Aktarılamaz", record => record.status === "error"],
  ];
  const ACCOUNT_TEXT = { new: () => "Yeni cari açılır", match: record => `Mevcut cari bağlanır: ${record.accountName}`, bound: record => `Kayda bağlı cari: ${record.accountName}`, card: record => `Kartın carisi: ${record.accountName}` };
  const PAGE = 300;
  const state = { data: null, options: { dueDay: 1, firstDue: "", payments: true, group: "tab", groupName: "" }, selected: new Set(), selectable: new Set(), filter: "all", q: "", open: new Set(), limit: PAGE, loading: false };
  let modal = null;

  const optionQuery = () => new URLSearchParams({ dueDay: String(state.options.dueDay), firstDue: state.options.firstDue, payments: state.options.payments ? "1" : "0", group: state.options.group, groupName: state.options.groupName });
  async function load() {
    state.loading = true;
    render();
    try {
      const data = await HOF.api(`/api/workspace/plans/from-table?${optionQuery()}`, { timeoutMs: 180_000 });
      const previous = state.data ? state.selected : null;
      const before = state.selectable;
      state.data = data;
      state.selectable = new Set(data.records.filter(record => record.selectable).map(record => record.key));
      // Seçim korunur; seçenek değişince yeni aktarılabilir olanlar (ör. ilk vade verildi) varsayılanla eklenir.
      state.selected = previous ? new Set([...previous].filter(key => state.selectable.has(key))) : new Set();
      for (const record of data.records) if (record.selected && (!previous || !before.has(record.key))) state.selected.add(record.key);
    } catch (error) {
      HOF.toastError(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  const root = () => modal?.dialog.querySelector("[data-transfer]");
  const badge = status => {
    const [label, tone, title] = STATUS[status] || STATUS.error;
    return `<span class="hof-plan-badge is-${tone}" title="${esc(title)}">${esc(label)}</span>`;
  };
  const span = record => (record.items.length ? `${record.items.length} taksit<small>${esc(HOF.formatDate(record.items[0][0]))} – ${esc(HOF.formatDate(record.items.at(-1)[0]))}</small>` : '<small class="hof-muted">—</small>');
  const selectedRecords = () => (state.data?.records || []).filter(record => state.selected.has(record.key));
  const totalsOf = records =>
    records.reduce(
      (sum, record) => ({
        count: sum.count + 1,
        total: sum.total + (record.status === "link" ? 0 : record.total),
        paid: sum.paid + (record.status === "link" ? 0 : record.paid),
        program: sum.program + (state.options.payments ? record.programPaid : 0),
        remaining: sum.remaining + (record.remaining ?? 0),
      }),
      { count: 0, total: 0, paid: 0, program: 0, remaining: 0 },
    );
  const issuesHtml = record => `<ul class="hof-transfer-issues">${record.issues.map(issue => `<li class="is-${esc(issue.level)}">${esc(issue.text)}</li>`).join("")}</ul>`;
  const itemsHtml = record =>
    record.items.length
      ? `<table class="hof-table hof-transfer-items"><thead><tr><th>No</th><th>Vade</th><th>Açıklama</th><th class="num">Tutar</th><th class="num">Excel'e Göre Ödenen</th></tr></thead><tbody>${record.items.map(([dueDate, amount, paid, label], index) => `<tr><td>${index + 1}.</td><td>${esc(HOF.formatDate(dueDate))}</td><td>${esc(label || "")}</td><td class="num">${amount === null ? '<span class="hof-cash-out">okunamadı</span>' : esc(money(amount))}</td><td class="num hof-cash-in">${paid ? esc(money(paid)) : ""}</td></tr>`).join("")}</tbody></table>`
      : "";

  function render() {
    const node = root();
    if (!node) return;
    const data = state.data;
    if (!data) {
      node.innerHTML = `<p class="hof-empty">${state.loading ? "Tablodaki ödeme planları okunuyor…" : "Okunamadı."}</p><div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
      return;
    }
    const records = data.records;
    if (!records.length) {
      node.innerHTML = `<p class="hof-empty">Açık veri oturumunun tablosunda taksit kartına aktarılacak bir ödeme planı bulunamadı.</p>
        <p class="hof-edit-meta">Aktarılan biçimler: ay kolonları (Eylül, Ekim… ya da “Eylül taksiti”), sıralı taksit kolonları (“1. Taksit Tarihi” / “1. Taksit Tutarı”) ve toplam tutar + taksit sayısı + ilk vade. Tek vadeli alacak, ödeme sözü ve “her ayın 5’i” kira kolonları plan değildir; tahsilat takviminde kalır.</p>
        ${importsHtml()}<div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
      return;
    }
    const t = data.totals;
    const needle = state.q.toLocaleLowerCase("tr-TR").trim();
    const test = (FILTERS.find(([id]) => id === state.filter) || FILTERS[0])[2];
    const visible = records.filter(record => test(record) && (!needle || `${record.name} ${record.phone} ${record.caseNo} ${record.tab}`.toLocaleLowerCase("tr-TR").includes(needle)));
    const shown = visible.slice(0, state.limit);
    const chosen = totalsOf(selectedRecords());
    const hasMonths = data.tabs.some(tab => tab.shape === "months");
    const needsFirstDue = records.some(record => record.issues.some(issue => issue.code === "no-first-due")) || Boolean(state.options.firstDue);
    const row = record => {
      const expanded = state.open.has(record.key);
      const first = record.issues.find(issue => issue.level === "error") || record.issues.find(issue => issue.level === "warning") || record.issues[0];
      return `<tr data-key="${esc(record.key)}" class="is-${esc(record.status)}"><td class="hof-transfer-check"><input type="checkbox" data-pick="${esc(record.key)}" ${state.selected.has(record.key) ? "checked" : ""} ${record.selectable ? "" : "disabled"} aria-label="${esc(record.name)} aktarılsın"></td>
        <td><b>${esc(record.name)}</b><small>${esc([record.phone, record.caseNo && record.caseNo !== record.name ? record.caseNo : "", record.tab].filter(Boolean).join(" · "))}</small></td>
        <td>${record.status === "link" ? `<small>Mevcut kart: ${esc(record.linkPlanName)}</small>` : span(record)}</td>
        <td class="num">${record.status === "link" ? "" : esc(money(record.total))}</td>
        <td class="num hof-cash-in">${record.paid ? esc(money(record.paid)) : ""}</td>
        <td class="num">${record.programPaid ? `${esc(money(record.programPaid))}<small>${number(record.paymentCount)} tahsilat${state.options.payments ? "" : " · sayılmaz"}</small>` : ""}</td>
        <td class="num${record.remaining > 0 ? " hof-cash-out" : ""}">${record.remaining === null ? "" : esc(money(record.remaining))}</td>
        <td><small>${esc(record.status === "exists" || record.status === "error" ? "—" : (ACCOUNT_TEXT[record.account] || ACCOUNT_TEXT.new)(record))}</small></td>
        <td>${badge(record.status)}${first ? `<small class="hof-transfer-first is-${esc(first.level)}">${esc(first.text)}</small>` : ""}${record.issues.length > 1 || record.items.length ? `<button type="button" class="hof-mini hof-mini-text" data-expand="${esc(record.key)}" aria-expanded="${String(expanded)}">${expanded ? "Gizle" : "Ayrıntı"}</button>` : ""}</td></tr>${expanded ? `<tr class="hof-transfer-detail"><td></td><td colspan="8">${issuesHtml(record)}${itemsHtml(record)}</td></tr>` : ""}`;
    };
    const allVisibleSelectable = shown.filter(record => record.selectable);
    const allChecked = allVisibleSelectable.length && allVisibleSelectable.every(record => state.selected.has(record.key));
    node.innerHTML = `<p class="hof-modal-text">${esc(data.sessionName || "Açık oturum")} tablosunda ödeme planı bulunan sekmeler: ${data.tabs.map(tab => `<b>${esc(tab.tab)}</b> <small>(${esc(tab.shapeText)}${tab.monthMode === "payment" ? ", aylık ücret + ödenen" : tab.monthMode === "plan" ? ", hücre taksit tutarı" : ""} · ${number(tab.count)} kişi)</small>`).join(", ")}. Her kişi için gerçek vade ve tutarlarıyla kart açılır; Excel'de ödenmiş kısım <b>açılış (devir)</b> olarak yazılır: taksiti kapatır, cari bakiyesine sayılır, <b>Kasa'ya girmez</b>.</p>
      <div class="hof-transfer-options">
        ${hasMonths ? `<label class="hof-field"><span>Ay Kolonlarındaki Taksitlerin Vade Günü</span><select data-opt="dueDay">${Array.from({ length: 28 }, (_, index) => index + 1).map(day => `<option value="${day}" ${day === state.options.dueDay ? "selected" : ""}>Ayın ${day}’i</option>`).join("")}</select></label>` : ""}
        ${needsFirstDue ? `<label class="hof-field"><span>İlk vadesi yazılmayanlar için ilk vade</span><input type="date" data-opt="firstDue" value="${esc(state.options.firstDue)}"></label>` : ""}
        <label class="hof-field"><span>Grup</span><select data-opt="group"><option value="tab" ${state.options.group === "tab" ? "selected" : ""}>Sekme Adı (tablodaki grup kolonu varsa o)</option><option value="custom" ${state.options.group === "custom" ? "selected" : ""}>Şu ad…</option><option value="none" ${state.options.group === "none" ? "selected" : ""}>Grupsuz (tablodaki grup kolonu varsa o)</option></select></label>
        ${state.options.group === "custom" ? `<label class="hof-field"><span>Grup Adı</span><input type="text" maxlength="80" data-opt="groupName" value="${esc(state.options.groupName)}" placeholder="Ör. 2026-2027 Servis"></label>` : ""}
        <label class="hof-check"><input type="checkbox" data-opt="payments" ${state.options.payments ? "checked" : ""}><span>Kayıt kartından girilmiş tahsilatlar karta taşınsın (Kasa toplamı ve tarihleri değişmez)</span></label>
      </div>
      <div class="hof-kpis hof-plans-kpis"><div><strong>${number(t.ready + t.warning + t.link)}</strong><span>Aktarılabilir · ${number(t.warning)} uyarılı · ${number(t.link)} bağlanacak</span></div><div><strong>${number(t.closed)}</strong><span>Kapanmış (seçilmedi)</span></div><div class="${t.error ? "is-late" : ""}"><strong>${number(t.error)}</strong><span>Aktarılamaz · ${number(t.exists)} kartı var</span></div><div class="hof-cash-balance"><strong>${esc(money(chosen.remaining))}</strong><span>Seçilenlerin Kalanı · ${number(chosen.count)} kişi</span></div></div>
      <div class="hof-plans-filters"><span class="hof-plan-chips" role="group" aria-label="Süzgeç">${FILTERS.map(([id, label, filter]) => `<button type="button" data-filter="${id}" aria-pressed="${String(id === state.filter)}">${label} <b>${number(records.filter(filter).length)}</b></button>`).join("")}</span><input type="search" data-q value="${esc(state.q)}" placeholder="Ad, telefon, sekme ara…" aria-label="Ara"></div>
      <div class="hof-cash-list hof-transfer-list">${shown.length ? `<table class="hof-table hof-cash-table hof-transfer-table"><thead><tr><th class="hof-transfer-check"><input type="checkbox" data-pick-all ${allChecked ? "checked" : ""} aria-label="Görünenlerin tümünü seç"></th><th>Kişi</th><th>Taksitler</th><th class="num">Toplam</th><th class="num">Excel'e Göre Ödenen</th><th class="num">Kayıt Tahsilatı</th><th class="num">Kalan</th><th>Cari</th><th>Durum</th></tr></thead><tbody>${shown.map(row).join("")}</tbody></table>${visible.length > shown.length ? `<div class="hof-more"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-more>Daha Fazla Göster · ${number(visible.length - shown.length)} kişi daha</button></div>` : ""}` : '<p class="hof-empty">Bu süzgeçte kişi yok.</p>'}</div>
      <p class="hof-transfer-sum" aria-live="polite">Seçilen <b>${number(chosen.count)}</b> kişi · taksitler ${esc(money(chosen.total))} · Excel'e göre ödenen ${esc(money(chosen.paid))}${chosen.program ? ` · kayıt tahsilatı ${esc(money(chosen.program))}` : ""} · <b>kalan ${esc(money(chosen.remaining))}</b></p>
      ${importsHtml()}
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button><button type="button" class="hof-button" data-commit ${chosen.count ? "" : "disabled"}>${chosen.count ? `${number(chosen.count)} kişiyi aktar` : "Kişi seçin"}</button></div>`;
  }

  function importsHtml() {
    const list = state.data?.imports || [];
    if (!list.length) return "";
    return `<details class="hof-transfer-imports"><summary>Son aktarımlar (${list.length})</summary><ul>${list
      .map(item => {
        const s = item.summary || {};
        return `<li><span><b>${esc(item.title || "Aktarım")}</b><small>${esc(HOF.formatDateTime(item.createdAt))} · ${esc(item.actorName || "—")} · ${number(s.created)} kart${s.linked ? `, ${number(s.linked)} bağlama` : ""}${s.paymentsMoved ? `, ${number(s.paymentsMoved)} tahsilat taşındı` : ""}${item.undoneAt ? ` · <b>geri alındı</b> ${esc(HOF.formatDateTime(item.undoneAt))}` : ""}</small></span>${item.undoneAt ? "" : `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-undo="${esc(item.id)}">Geri Al</button>`}</li>`;
      })
      .join("")}</ul></details>`;
  }

  async function commit() {
    const keys = [...state.selected];
    if (!keys.length) return;
    const chosen = totalsOf(selectedRecords());
    const ok = await HOF.confirm({
      title: "Taksit Kartlarına Aktar",
      message: `${number(chosen.count)} kişi aktarılacak: taksitler ${money(chosen.total)}, Excel'e göre ödenen ${money(chosen.paid)} (açılış, Kasa dışı)${chosen.program ? `, kayıt kartından taşınacak tahsilat ${money(chosen.program)}` : ""}; kalan ${money(chosen.remaining)}. Kasa toplamı değişmez. Aktarım sonra geri alınabilir.`,
      confirmLabel: "Aktar",
    });
    if (!ok) return;
    const button = root()?.querySelector("[data-commit]");
    if (button) {
      button.disabled = true;
      button.classList.add("is-busy");
    }
    try {
      const result = await HOF.api("/api/workspace/plans/from-table", { method: "POST", body: { keys, fingerprint: state.data.fingerprint, ...state.options }, timeoutMs: 300_000 });
      HOF.dues?.reloadSoon?.(300);
      HOF.emit("plans-changed", {});
      if (result.paymentsMoved) HOF.emit("cash-changed");
      HOF.plans?.refresh?.();
      showResult(result);
      state.data = null;
      state.selected = new Set();
      await load();
    } catch (error) {
      if (error.status === 409 || /değişti/.test(error.message)) {
        HOF.toast(error.message, { type: "error", timeout: 9000 });
        await load();
      } else HOF.toastError(error);
    } finally {
      if (button) button.classList.remove("is-busy");
    }
  }

  function showResult(result) {
    const skipped = result.skipped || [];
    const box = HOF.modal({
      title: "Aktarım tamamlandı",
      eyebrow: "TAKSİTLER",
      body: `<ul class="hof-transfer-result">
          <li><b>${number(result.created)}</b> taksit kartı açıldı (taksitler ${esc(money(result.total))}; Excel'e göre ödenen ${esc(money(result.opening))} açılış olarak yazıldı).</li>
          ${result.linked ? `<li><b>${number(result.linked)}</b> mevcut kart tablodaki kaydına bağlandı.</li>` : ""}
          <li><b>${number(result.accountsCreated)}</b> cari açıldı${result.accountsLinked ? `, <b>${number(result.accountsLinked)}</b> cari kayda bağlandı` : ""}.</li>
          ${result.paymentsMoved ? `<li>Kayıt kartından <b>${number(result.paymentsMoved)}</b> tahsilat (${esc(money(result.paymentsAmount))}) kartlara taşındı; Kasa toplamı değişmedi.</li>` : ""}
          <li>Kalan alacak: <b>${esc(money(result.remaining))}</b>. Bu kişilerin tablodaki ödeme ayları takvimde artık kartlarından gelir (çift sayılmaz).</li>
        </ul>
        ${skipped.length ? `<details open><summary>${number(skipped.length)} kişi aktarılmadı</summary><ul class="hof-transfer-issues">${skipped.slice(0, 50).map(item => `<li class="is-warning">${esc(item.name || item.key)}: ${esc(item.reason)}</li>`).join("")}</ul></details>` : ""}
        <div class="hof-actions">${result.importId && (result.created || result.linked) ? `<button type="button" class="hof-button hof-button-ghost hof-button-danger-ghost" data-undo="${esc(result.importId)}">Aktarımı Geri Al</button>` : ""}<button type="button" class="hof-button hof-button-ghost" data-open-plans>Taksitleri Aç</button><button type="button" class="hof-button" data-close data-result-close>Tamam</button></div>`,
    });
    box.dialog.addEventListener("click", async event => {
      // "Tamam": sonuç ve aktarım penceresi birlikte kapanır; kullanıcı yenilenmiş Taksitler listesine (ya da ana ekrana) döner.
      if (event.target.closest("[data-result-close]")) {
        box.close();
        modal?.close();
        return;
      }
      if (event.target.closest("[data-close]")) return box.close();
      if (event.target.closest("[data-open-plans]")) {
        box.close();
        modal?.close();
        return HOF.plans?.open?.();
      }
      const undoId = event.target.closest("[data-undo]")?.dataset.undo;
      if (undoId && (await undo(undoId))) box.close();
    });
  }

  async function undo(id) {
    const ok = await HOF.confirm({ title: "Aktarımı Geri Al", message: "Bu aktarımın açtığı kartlar ve (başka işlemi olmayan) cariler kaldırılır, bağlanan kartların bağı çözülür, karta taşınan kayıt tahsilatları kayıt kartına döner. Aktarımdan sonra bu kartlara tahsilat ya da düzenleme yapıldıysa geri alma durur ve hangi kartlar olduğunu söyler.", confirmLabel: "Geri Al", danger: true });
    if (!ok) return false;
    try {
      const result = await HOF.api(`/api/workspace/plans/imports/${encodeURIComponent(id)}/undo`, { method: "POST", body: {} });
      HOF.toast(`Aktarım geri alındı: ${number(result.plans)} kart kaldırıldı${result.links ? `, ${number(result.links)} bağ çözüldü` : ""}${result.payments ? `, ${number(result.payments)} tahsilat kayıt kartına döndü` : ""}${result.accountsKept ? ` · ${number(result.accountsKept)} cari başka işlemi olduğu için kaldı` : ""}.`, { type: "success", timeout: 9000 });
      HOF.dues?.reloadSoon?.(300);
      HOF.emit("plans-changed", {});
      HOF.emit("cash-changed");
      HOF.plans?.refresh?.();
      if (modal) await load();
      return true;
    } catch (error) {
      HOF.toast(error.message, { type: "error", timeout: 12000 });
      return false;
    }
  }

  function onClick(event) {
    if (event.target.closest("[data-close]")) return modal.close();
    const filter = event.target.closest("[data-filter]")?.dataset.filter;
    if (filter) {
      state.filter = filter;
      state.limit = PAGE;
      return render();
    }
    const expand = event.target.closest("[data-expand]")?.dataset.expand;
    if (expand) {
      if (state.open.has(expand)) state.open.delete(expand);
      else state.open.add(expand);
      return render();
    }
    if (event.target.closest("[data-more]")) {
      state.limit += PAGE;
      return render();
    }
    if (event.target.closest("[data-commit]")) return commit();
    const undoId = event.target.closest("[data-undo]")?.dataset.undo;
    if (undoId) return undo(undoId);
  }
  function onChange(event) {
    const pick = event.target.closest("[data-pick]");
    if (pick) {
      if (pick.checked) state.selected.add(pick.dataset.pick);
      else state.selected.delete(pick.dataset.pick);
      return render();
    }
    if (event.target.closest("[data-pick-all]")) {
      const needle = state.q.toLocaleLowerCase("tr-TR").trim();
      const test = (FILTERS.find(([id]) => id === state.filter) || FILTERS[0])[2];
      const visible = state.data.records.filter(record => record.selectable && test(record) && (!needle || `${record.name} ${record.phone} ${record.caseNo} ${record.tab}`.toLocaleLowerCase("tr-TR").includes(needle))).slice(0, state.limit);
      for (const record of visible) {
        if (event.target.checked) state.selected.add(record.key);
        else state.selected.delete(record.key);
      }
      return render();
    }
    const option = event.target.closest("[data-opt]");
    if (!option) return;
    const name = option.dataset.opt;
    state.options[name] = name === "payments" ? option.checked : name === "dueDay" ? Number(option.value) || 1 : option.value;
    // Seçenekler sunucuda yeniden hesaplanır (kalan, bulgular, cari); grup adı yazılırken her tuşta değil, alan bırakılınca.
    load();
  }
  const onInput = (() => {
    let timer = 0;
    return event => {
      const input = event.target.closest("[data-q]");
      if (!input) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = input.value;
        state.limit = PAGE;
        render();
        root()?.querySelector("[data-q]")?.focus();
      }, 200);
    };
  })();

  function open() {
    if (!HOF.can("plans.manage")) return HOF.toast("Tablodan aktarma yönetici, uzman ve muhasebe yetkisidir.", { type: "error" });
    if (modal) return;
    state.data = null;
    state.selected = new Set();
    state.selectable = new Set();
    state.open = new Set();
    state.filter = "all";
    state.q = "";
    state.limit = PAGE;
    modal = HOF.modal({
      title: "Tablodan Taksit Kartına Aktar",
      eyebrow: (HOF.uiLabel?.("side.plans", "Taksitler") || "Taksitler").toLocaleUpperCase("tr-TR"),
      size: "wide",
      body: '<div class="hof-transfer" data-transfer><p class="hof-empty">Tablodaki ödeme planları okunuyor…</p></div>',
      onClose: () => {
        modal = null;
      },
    });
    modal.dialog.classList.add("hof-transfer-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("change", onChange);
    modal.dialog.addEventListener("input", onInput);
    load();
  }

  // Veri yüklendikten sonra (sayfa yeniden açılınca bir kez): tabloda aktarılabilir ödeme planı varsa kısa bir bildirimle
  // sorulur — pencere açmaz, hiçbir işi engellemez; Taksitler'deki "Tablodan aktar" her zaman açıktır.
  async function askAfterUpload() {
    if (!HOF.can("plans.manage")) return;
    let summary;
    try {
      summary = await HOF.api("/api/workspace/plans/from-table/summary", { timeoutMs: 120_000 });
    } catch {
      return;
    }
    if (!summary?.count) return;
    HOF.toast(`Yüklediğiniz tabloda ${number(summary.count)} kişinin ödeme planı var (${summary.tabs.map(tab => `${tab.tab}: ${number(tab.count)}`).join(", ")}). Taksitler'e aktarılsın mı? Gerçek vade ve tutarlarıyla kart açılır; Excel'de ödenmiş kısım açılış olur, Kasa değişmez.`, {
      type: "info",
      timeout: 30_000,
      action: { label: "Ön İzle ve Aktar", onClick: () => open() },
    });
  }
  // Taksitler penceresinde ipucu şeridi için (aktarılmamış plan sayısı).
  const summary = () => HOF.api("/api/workspace/plans/from-table/summary", { timeoutMs: 120_000 });

  HOF.planTransfer = { open, askAfterUpload, summary };
  HOF.whenReady(() => {
    let pending = false;
    try {
      pending = sessionStorage.getItem("hof-plan-transfer-ask") === "1";
      sessionStorage.removeItem("hof-plan-transfer-ask");
    } catch {
      pending = false;
    }
    // Yükleme sonrası sayfa yenilenir ve akıllı analiz penceresi açılır. Bildirimler pencerelerin altında kaldığından soru,
    // ekranda açık pencere kalmayınca sorulur (en çok 10 dk beklenir); aksi hâlde kullanıcı görmeden sönerdi.
    if (pending) {
      const started = Date.now();
      const tryAsk = () => {
        if (document.querySelector(".hof-modal-backdrop.is-visible") && Date.now() - started < 600_000) return setTimeout(tryAsk, 700);
        askAfterUpload();
      };
      setTimeout(tryAsk, 2500);
    }
  });
})();
