/* DestekOfis — akıllı denetim (v2.0.1).
 * Sunucudaki mantık denetimi (server/lib/insight/reasoning.mjs) verinin kendi kurallarını öğrenir ve uymayan
 * kayıtları bulur: hesap tutmayan kalan, "Ödendi" ama borcu olan kayıt, ters tarih, yazım hatası gibi duran yıl ya da
 * tutar, tabloya yansımamış tahsilat. Kullanıcıyı meşgul etmez: yalnızca seçilen kayıtta bir şey varsa detay kartının
 * üstünde kısa bir kutu çıkar (neden ve tek tıkla düzeltme önerisiyle); tabloda şüpheli satırın başında küçük bir işaret
 * olur. "Yok Say" o bulguyu (aynı değerlerle) herkes için kapatır; değer değişirse yeniden değerlendirilir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const MAX_SHOWN = 3;
  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';

  let currentKey = "";
  let currentTab = "";
  let findings = [];
  let expanded = false;
  let request = 0;
  let warnKeys = new Set();

  const checksUrl = (key, tab) => `/api/workspace/cases/${encodeURIComponent(key)}/checks${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;

  function box() {
    const panel = HOF.detailPanel();
    const selected = HOF.selectedCase();
    let node = document.getElementById("hof-checks");
    if (!panel || !selected) {
      if (node) node.hidden = true;
      return null;
    }
    if (!node) {
      node = HOF.el("section", { id: "hof-checks", class: "hof-checks", "aria-live": "polite" });
      node.addEventListener("click", onClick);
    }
    // İşlem düğmelerinin hemen altında (kaydın bilgilerinden önce).
    const actions = panel.querySelector(".hof-case-actions");
    const anchor = actions || panel.querySelector(".detail-header");
    if (anchor && anchor.nextSibling !== node) anchor.after(node);
    return { node, selected };
  }

  function render() {
    const node = document.getElementById("hof-checks");
    if (!node) return;
    if (!findings.length) {
      node.hidden = true;
      node.innerHTML = "";
      return;
    }
    node.hidden = false;
    const warn = findings.some(item => item.severity === "warn");
    node.classList.toggle("is-info", !warn);
    const shown = expanded ? findings : findings.slice(0, MAX_SHOWN);
    const canFix = HOF.can("records.edit");
    node.innerHTML = `<header><span class="hof-checks-icon">${ICON}</span><b>Akıllı Denetim</b><small>${findings.length === 1 ? (warn ? "Bu kayıtta dikkat edilmesi gereken bir şey var" : "Bu kayıt için bir öneri var") : `${findings.length} bulgu`}</small></header>
      <ul>${shown
        .map(
          (item, index) => `<li class="is-${esc(item.severity)}">
            <p class="hof-check-text"><span class="hof-check-rule">${esc(item.ruleTitle || "")}</span>${esc(item.message)}</p>
            <details><summary>Neden?</summary><p>${esc(item.why || "")}</p></details>
            <div class="hof-check-actions">
              ${item.suggest && canFix ? `<button type="button" class="hof-button hof-button-small" data-fix="${index}" title="Önerilen değeri kaydeder (kaynak dosya değişmez; kimin yaptığı kaydedilir).">Uygula: ${esc(item.suggest.label)} → ${esc(item.suggest.value)}</button>` : ""}
              ${canFix ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-dismiss="${index}" title="Bu uyarıyı bu kayıt için kapatır; değerler değişirse yeniden değerlendirilir.">Yok Say</button>` : ""}
            </div>
          </li>`,
        )
        .join("")}</ul>
      ${findings.length > MAX_SHOWN ? `<button type="button" class="hof-link hof-checks-more" data-more>${expanded ? "Daha az göster" : `${findings.length - MAX_SHOWN} bulgu daha`}</button>` : ""}`;
    node.dataset.shown = String(shown.length);
  }

  async function load(force = false) {
    const target = box();
    if (!target) {
      currentKey = "";
      return;
    }
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    if (!force && target.selected.key === currentKey && tab === currentTab) return;
    if (target.selected.key !== currentKey) {
      findings = [];
      expanded = false;
      render();
    }
    currentKey = target.selected.key;
    currentTab = tab;
    const ticket = ++request;
    try {
      const result = await HOF.api(checksUrl(currentKey, tab));
      if (ticket !== request) return;
      findings = result.findings || [];
      render();
    } catch {
      // Denetim yardımcıdır; alınamazsa kart normal çalışır.
    }
  }
  const reloadSoon = (() => {
    let timer = 0;
    return (delay = 900) => {
      clearTimeout(timer);
      timer = setTimeout(() => currentKey && load(true), delay);
    };
  })();

  async function onClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-more")) {
      expanded = !expanded;
      return render();
    }
    const item = findings[Number(button.dataset.fix ?? button.dataset.dismiss)];
    if (!item) return;
    button.disabled = true;
    try {
      if (button.dataset.fix !== undefined) {
        await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: currentKey, field: item.suggest.field, value: item.suggest.value } });
        HOF.toast(`${item.suggest.label} güncellendi: ${item.suggest.value}.`, { type: "success" });
        HOF.refreshData();
      } else {
        await HOF.api("/api/workspace/insight/dismiss", { method: "POST", body: { signature: item.signature } });
        HOF.toast("Uyarı bu kayıt için kapatıldı.", { type: "success" });
      }
      findings = findings.filter(entry => entry !== item);
      render();
      HOF.refreshInsight?.(600);
      reloadSoon(1200);
    } catch (error) {
      button.disabled = false;
      HOF.toastError(error);
    }
  }

  // Tabloda şüpheli satırların başında küçük işaret (yalnızca görünen satırlar; tablo sayfalıdır).
  function markRows() {
    const rows = document.querySelectorAll(".dynamic-table tbody tr");
    for (const row of rows) {
      const key = row.dataset.hofKey || HOF.rowKey?.(row) || "";
      const flagged = Boolean(key) && warnKeys.has(key);
      if (row.classList.contains("hof-row-check") !== flagged) {
        row.classList.toggle("hof-row-check", flagged);
        if (flagged) row.setAttribute("data-hof-check", "Akıllı denetim: bu kayıtta olası bir tutarsızlık var");
        else row.removeAttribute("data-hof-check");
      }
    }
  }

  HOF.on("insight", insight => {
    warnKeys = new Set(insight?.reasoning?.warnKeys || []);
    markRows();
  });
  // Veri değişince (düzeltme, eşitleme, tahsilat) açık kaydın denetimi tazelenir.
  HOF.on("rows", () => reloadSoon(700));
  HOF.on("activity-changed", () => reloadSoon(400));
  HOF.on("case-activity", () => reloadSoon(400));
  HOF.on("live:workspace.changed", change => {
    if (!change || !currentKey) return;
    if ((change.kind === "activity" || change.kind === "cash") && (!change.caseKey || change.caseKey === currentKey)) reloadSoon(600);
    if (change.kind === "profile" && change.dismissed) reloadSoon(300);
  });

  HOF.whenReady(() => {
    const insight = HOF.insight?.();
    if (insight) warnKeys = new Set(insight.reasoning?.warnKeys || []);
    HOF.onDom(() => {
      load();
      markRows();
    });
  });
  HOF.checks = { reload: () => load(true) };
})();
