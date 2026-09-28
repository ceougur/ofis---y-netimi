/* DestekOfis — kolon başlıklarını adlandırma (v2.0.1).
 * Excel/Sheets'ten gelen kolon başlıkları (ör. "TKST_1", "Borç Tutarı TL") ofisin istediği adla gösterilir: detay
 * kartındaki her başlığın yanındaki kalem (yalnızca yönetici) tek pencerede tüm kolonları açar. Yalnızca görünen ad
 * değişir; kaynak dosya, Sheet eşitlemesi, formüller, düzeltmeler ve notlar kolonun asıl adıyla çalışmaya devam eder
 * (HOF.columnOf asıl adı verir). Adlar her veri oturumunda ayrıdır ve tüm bilgisayarlara anında yansır.
 * Uygulandığı yerler: tablo başlıkları, detay kartı, düzenleme ve yeni kayıt formları, özet kartları, arama ipucu,
 * Excel'e dışa aktarma.
 * v2.0.6: başlık simgesi değeri düzenleyen ✎'den ayrıldı ("adı değiştir" imleci); pencere yalnız adı değiştirdiğini açıkça
 * söyler. Ada tarih yazılırsa ("30.09.2026") kaydedilmez: tarih seçili kaydın o alanına yazılmak üzere önerilir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  // "Adı değiştir" simgesi (imleçli metin kutusu): değeri düzenleyen ✎ ile karışmasın (v2.0.6).
  const RENAME = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1"/><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M9 7v10"/></svg>';
  const RENAME_TITLE = "Kolonun adını değiştir (kayıttaki değeri değil)";
  // Tam tarih ("30.09.2026", "2026-09-30", "30 Eylül 2026"); sunucudaki isFullDate ile aynı kural. Ay-yıl ("Mart 2027") değil.
  const MONTHS = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
  const fold = text => String(text).toLocaleLowerCase("tr-TR").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
  function isFullDate(value) {
    const text = String(value ?? "").trim();
    let d;
    let m;
    let y;
    let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(text);
    if (match) {
      [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
      if (match[3].length === 2) y += y < 70 ? 2000 : 1900;
      if (m > 12 && d <= 12) [d, m] = [m, d];
    } else if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]\d{1,2}:\d{2}.*)?$/.exec(text))) {
      [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    } else if ((match = /^(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})$/u.exec(text))) {
      [d, m, y] = [Number(match[1]), MONTHS[fold(match[2])], Number(match[3])];
      if (!m) return false;
    } else return false;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCDate() === d && date.getUTCMonth() === m - 1;
  }
  let aliases = {};
  let signature = "";

  HOF.columnLabel = name => (Object.hasOwn(aliases, name) ? aliases[name] : name);

  const canEdit = () => HOF.can("profile.manage");
  const desired = original => (Object.hasOwn(aliases, original) ? aliases[original] : null);

  function apply() {
    const write = HOF.labels?.write;
    if (!write) return;
    // Serbest sayfada (v2.0.1) başlıklar sayfanın kendi başlıklarıdır ve ızgarada adlandırılır: takma ad ve kalem yok.
    const free = Boolean(HOF.free?.isActive());
    const shown = free ? () => null : desired;
    for (const th of document.querySelectorAll(".dynamic-table thead th")) write(th, shown);
    const panel = HOF.detailPanel();
    if (!panel) return;
    for (const label of panel.querySelectorAll(".dynamic-detail-grid .detail-label")) {
      write(label, shown);
      if (free) {
        label.querySelector(":scope > .hof-col-edit")?.remove();
        continue;
      }
      if (!canEdit()) continue;
      // Kalem başlığın hemen yanında (başlık öğesinin içinde); React başlığı yeniden yazarsa bir sonraki karede geri gelir.
      if (!label.querySelector(":scope > .hof-col-edit")) {
        label.appendChild(HOF.el("button", { type: "button", class: "hof-col-edit", title: RENAME_TITLE, "aria-label": RENAME_TITLE }, RENAME));
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
    const inputs = [];
    const focus = Math.max(0, columns.indexOf(focusColumn));
    // Kart açıkken değer düzenlemeye kısa yol: kalemi değer için tıklayan kişi tek tıkla doğru pencereye geçer.
    const selected = HOF.selectedCase();
    const canWrite = Boolean(selected?.key && HOF.can("records.edit"));
    const valueTarget = canWrite && focusColumn && columns.includes(focusColumn) ? focusColumn : "";
    const modal = HOF.formModal({
      title: "Kolon adlarını değiştir",
      eyebrow: tab ? `GÖRÜNÜM · ${HOF.sections?.pretty ? HOF.sections.pretty(tab) : tab}` : "GÖRÜNÜM",
      size: "wide",
      introHtml: `<div class="hof-column-editor-warn" role="note"><p><b>Bu pencere kolonların ADINI değiştirir, kayıttaki değeri değil.</b> Bir kayda tarih ya da bilgi yazmak için alanın sağındaki <b>✎</b> düğmesini ya da kartta <b>Düzenle</b>'yi kullanın.</p>${valueTarget ? `<button type="button" class="hof-button hof-button-small" data-edit-value>“${esc(HOF.columnLabel(valueTarget))}” değerini düzenle · ${esc(selected.title)}</button>` : ""}</div>`,
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
        const dates = [];
        columns.forEach((column, index) => {
          const value = String(data[`c${index}`] || "").replace(/\s+/g, " ").trim();
          const next = value === column ? "" : value;
          if ((aliases[column] || "") === next) return;
          if (next && isFullDate(next)) dates.push({ column, value: next, index });
          else changes[column] = next;
        });
        // Ada yazılan tarih (v2.0.6): başlık olmaz. Kart açıksa tarih o kaydın alanına yazılmak üzere önerilir.
        if (dates.length) {
          const first = dates[0];
          if (!canWrite) {
            inputs[first.index]?.focus();
            throw new Error(`“${first.value}” bir tarih; kolon adı olamaz. Tarihi kayda yazmak için kaydı seçip alanın sağındaki ✎ düğmesini ya da Düzenle'yi kullanın.`);
          }
          const row = (HOF.data?.rows || []).find(item => item.__hofKey === selected.key && (!tab || item.__sheet === tab)) || {};
          const lines = dates.map(item => {
            const now = String(row[item.column] ?? "").trim();
            return `${HOF.columnLabel(item.column)} → ${item.value}${now && now !== item.value ? ` (şu an: ${now})` : ""}`;
          });
          const write = await HOF.confirm({
            title: dates.length > 1 ? "Bunlar tarih, kolon adı değil" : "Bu bir tarih, kolon adı değil",
            message: `Bu pencere kolonun adını değiştirir. Yazdığınız tarih${dates.length > 1 ? "ler" : ""} kolon adı olmaz; “${selected.title}” kaydına değer olarak yazılsın mı? ${lines.join(" · ")}`,
            confirmLabel: "Kayda yaz",
            cancelLabel: "Geri dön",
          });
          if (!write) {
            inputs[first.index]?.focus();
            inputs[first.index]?.select();
            return true;
          }
          for (const item of dates) {
            await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: selected.key, field: item.column, value: item.value } });
          }
          HOF.refreshData?.();
        }
        let renamed = 0;
        if (Object.keys(changes).length) {
          const next = await HOF.api("/api/workspace/columns", { method: "PUT", body: { columns: changes } });
          HOF.applyProfile?.(next);
          renamed = Object.keys(changes).length;
        }
        if (dates.length) HOF.toast(`${dates.map(item => `${HOF.columnLabel(item.column)}: ${item.value}`).join(", ")} → “${selected.title}” kaydına yazıldı.${renamed ? ` ${renamed} başlık da güncellendi.` : ""}`, { type: "success" });
        else if (renamed) HOF.toast(`${renamed} başlık güncellendi; tüm bilgisayarlarda görünür.`, { type: "success" });
      },
    });
    modal.dialog.classList.add("hof-side-editor", "hof-column-editor");
    inputs.push(...modal.dialog.querySelectorAll('.hof-form input[name^="c"]'));
    inputs[focus]?.select();
    modal.dialog.querySelector("[data-edit-value]")?.addEventListener("click", () => {
      modal.close();
      HOF.table?.editField?.(valueTarget);
    });
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

  // Güncellemede asıl adına döndürülen tarih adları (v2.0.6): yöneticiye bir kez, ne olduğunu ve ne yapacağını anlatır.
  let fixedShown = "";
  function showFixed(profile) {
    const list = Array.isArray(profile?.columnsFixed) ? profile.columnsFixed : [];
    const key = JSON.stringify(list);
    if (!list.length || !canEdit() || fixedShown === key) return;
    fixedShown = key;
    const items = list.map(item => `<li><b>${esc(item.column)}</b> kolonunun adı “${esc(item.value)}” yapılmıştı; asıl adına döndü.</li>`).join("");
    const modal = HOF.modal({
      title: "Kolon adları düzeltildi",
      eyebrow: "GÜNCELLEME",
      body: `<p class="hof-modal-text">Detay kartında başlığın yanındaki simge kolonun <b>adını</b> değiştirir. Aşağıdaki kolonlara değer yerine ad olarak tarih yazılmıştı; o yüzden hücreler boş kaldı ve bu tarihlerden uyarı gelmedi:</p>
        <ul class="hof-fixed-list">${items}</ul>
        <p class="hof-modal-text">Tarihi yazmak için kaydı seçin, alanın sağındaki <b>✎</b> düğmesine basın (ya da <b>Düzenle</b>). Bitiş tarihleri 7 gün kala ve geçince uyarı verir.</p>
        <div class="hof-actions"><button type="button" class="hof-button" data-fixed-ok>Anladım</button></div>`,
    });
    modal.dialog.querySelector("[data-fixed-ok]")?.addEventListener("click", async () => {
      modal.close();
      try {
        HOF.applyProfile?.(await HOF.api("/api/workspace/columns/fixed", { method: "DELETE" }));
      } catch {
        /* bir sonraki açılışta yeniden gösterilir */
      }
    });
  }

  HOF.on("profile", profile => {
    showFixed(profile);
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
      showFixed(profile);
    }
    HOF.onDom(apply);
  });
  HOF.columns = { open: openEditor, apply };
})();
