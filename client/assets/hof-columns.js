/* DestekOfis — kolon başlıklarını adlandırma (v2.0.1).
 * Excel/Sheets'ten gelen kolon başlıkları (ör. "TKST_1", "Borç Tutarı TL") ofisin istediği adla gösterilir: detay
 * kartındaki her başlığın yanındaki kalem (yalnızca yönetici) tek pencerede tüm kolonları açar. Yalnızca görünen ad
 * değişir; kaynak dosya, Sheet eşitlemesi, formüller, düzeltmeler ve notlar kolonun asıl adıyla çalışmaya devam eder
 * (HOF.columnOf asıl adı verir). Adlar her veri oturumunda ayrıdır ve tüm bilgisayarlara anında yansır.
 * Uygulandığı yerler: tablo başlıkları, detay kartı, düzenleme ve yeni kayıt formları, özet kartları, arama ipucu,
 * Excel'e dışa aktarma. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const PENCIL = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  let aliases = {};
  let signature = "";

  HOF.columnLabel = name => (Object.hasOwn(aliases, name) ? aliases[name] : name);

  const canEdit = () => HOF.can("profile.manage");
  const desired = original => (Object.hasOwn(aliases, original) ? aliases[original] : null);

  function apply() {
    const write = HOF.labels?.write;
    if (!write) return;
    for (const th of document.querySelectorAll(".dynamic-table thead th")) write(th, desired);
    const panel = HOF.detailPanel();
    if (!panel) return;
    for (const label of panel.querySelectorAll(".dynamic-detail-grid .detail-label")) {
      write(label, desired);
      if (!canEdit()) continue;
      // Kalem başlığın hemen yanında (başlık öğesinin içinde); React başlığı yeniden yazarsa bir sonraki karede geri gelir.
      if (!label.querySelector(":scope > .hof-col-edit")) {
        label.appendChild(HOF.el("button", { type: "button", class: "hof-col-edit", title: "Başlığı yeniden adlandır", "aria-label": "Başlığı yeniden adlandır" }, PENCIL));
      }
    }
  }

  // Açık sekmenin kolonları (tablodaki sırayla); sekme yoksa tüm kolonlar.
  function currentColumns() {
    const rows = HOF.data?.rows || [];
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      if (tab && row.__sheet !== tab) continue;
      for (const key of Object.keys(row)) {
        if (key.startsWith("__") || !key.trim() || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
      }
    }
    return { tab, columns: out };
  }

  function openEditor(focusColumn = "") {
    if (!canEdit()) return;
    const { tab, columns } = currentColumns();
    if (!columns.length) return HOF.toast("Adlandırılacak kolon yok; önce veri yükleyin.", { type: "error" });
    const focus = Math.max(0, columns.indexOf(focusColumn));
    const modal = HOF.formModal({
      title: "Kolon başlıklarını adlandır",
      eyebrow: tab ? `GÖRÜNÜM · ${HOF.sections?.pretty ? HOF.sections.pretty(tab) : tab}` : "GÖRÜNÜM",
      size: "wide",
      intro: "Excel/Sheets'ten gelen başlıkları ofisinize göre adlandırın. <b>Yalnızca programda görünen ad değişir</b>; kaynak dosyanız, Google Sheets eşitlemesi, formüller ve notlar etkilenmez. Boş bırakılan başlık asıl adına döner; değişiklik tüm bilgisayarlarda görünür.",
      fields: columns.map((column, index) => ({
        name: `c${index}`,
        label: column,
        value: aliases[column] || "",
        placeholder: column,
        maxlength: 60,
        autofocus: index === focus,
      })),
      extraHtml: '<div class="hof-side-editor-reset"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-reset-all>Tümünü asıl adına döndür</button></div>',
      submitLabel: "Başlıkları kaydet",
      onSubmit: async data => {
        const changes = {};
        columns.forEach((column, index) => {
          const value = String(data[`c${index}`] || "").replace(/\s+/g, " ").trim();
          const next = value === column ? "" : value;
          if ((aliases[column] || "") !== next) changes[column] = next;
        });
        if (!Object.keys(changes).length) return;
        const next = await HOF.api("/api/workspace/columns", { method: "PUT", body: { columns: changes } });
        HOF.applyProfile?.(next);
        HOF.toast(`${Object.keys(changes).length} başlık güncellendi; tüm bilgisayarlarda görünür.`, { type: "success" });
      },
    });
    modal.dialog.classList.add("hof-side-editor", "hof-column-editor");
    const inputs = [...modal.dialog.querySelectorAll('.hof-form input[name^="c"]')];
    inputs[focus]?.select();
    // Asıl ad alanın başlığında durur; yazılan ad önizleme olarak alanın altında görünmez, yer tutucu asıl addır.
    modal.dialog.querySelector("[data-reset-all]")?.addEventListener("click", () => {
      inputs.forEach(input => (input.value = ""));
      inputs[0]?.focus();
    });
  }

  document.addEventListener(
    "click",
    event => {
      const button = event.target.closest(".hof-col-edit");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor(HOF.columnOf(button.closest(".detail-label")));
    },
    true,
  );

  HOF.on("profile", profile => {
    aliases = profile?.columns && typeof profile.columns === "object" ? profile.columns : {};
    const next = JSON.stringify(aliases);
    if (next === signature) return;
    signature = next;
    apply();
  });

  // Ayarlar → Veri → "Sektör ve görünüm" altına kısa yol.
  HOF.settingsExtensions = HOF.settingsExtensions || [];
  HOF.settingsExtensions.push({
    html() {
      if (!canEdit() || !(HOF.data?.rows || []).length) return "";
      const count = Object.keys(aliases).length;
      return `<section class="hof-data-section">
          <h3>Kolon başlıkları</h3>
          <div class="hof-profile-row">
            <div><b>${count ? `${count} başlık yeniden adlandırıldı` : "Başlıklar Excel/Sheets'teki gibi"}</b><small>Detay kartındaki başlıkların yanındaki kalemle de açılır. Yalnızca programda görünen ad değişir.</small></div>
            <div class="hof-profile-actions"><button type="button" class="hof-button hof-button-small" data-columns-edit>Başlıkları adlandır</button></div>
          </div>
        </section>`;
    },
    wire(modal) {
      modal.dialog.querySelector("[data-columns-edit]")?.addEventListener("click", () => {
        modal.close();
        openEditor();
      });
    },
  });

  HOF.whenReady(() => {
    const profile = HOF.profile?.();
    if (profile) {
      aliases = profile.columns || {};
      signature = JSON.stringify(aliases);
    }
    HOF.onDom(apply);
  });
  HOF.columns = { open: openEditor, apply };
})();
