/* DestekOfis — sekme pillerini kalemle yeniden adlandırma ve silme (v2.0.2).
 * Seçili sekme pilinin yanında küçük bir kalem (✎) görünür. Kart: sekmenin adı, Excel'deki ada dönüş ve "Sekmeyi sil".
 *  - Excel/Sheets sekmesi: ad yalnızca programda değişir (tablo, kartlar, takvim, dışa aktarma); Excel dosyası ve eşitleme
 *    asıl adla çalışır. Silmek sekmeyi gizler; veriler durur, Yönetim → Silinenler'den ya da "Geri al" ile geri gelir.
 *    Yalnızca yönetici (veri kaynağı yetkisi).
 *  - Serbest sayfa: sayfanın kendi adı değişir; silme serbest sayfa silmesidir (Silinenler'den geri gelir).
 * Alt tablolu sekmelerde kalem üst sekme içindir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const SEP = " › ";
  const PENCIL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

  const topOf = tab => String(tab || "").split(SEP)[0];
  const freeIdOf = name => HOF.data?.freeTabs?.get?.(name) || "";
  const canEdit = name => (freeIdOf(name) ? HOF.can("records.create") : HOF.can("sources.manage"));
  // Görünen adın Excel'deki (asıl) adı: satırlar yeniden adlandırılmış sekmede asıl adı "__hofSheet" iç alanında taşır.
  const originalOf = name => {
    const row = (HOF.data?.rows || []).find(item => topOf(item.__sheet) === name && item.__hofSheet);
    return row ? topOf(row.__hofSheet) : name;
  };

  // Seçili üst sekmenin pili: alt tablolu veride bizim şeridimizdeki grup/sekme pili, değilse arayüzün pili.
  function activePill() {
    const name = topOf(HOF.activeTab ? HOF.activeTab() : "");
    if (!name) return null;
    const bar = document.querySelector(".category-bar");
    const ours = bar?.querySelector(":scope > .hof-category-tabs");
    const pill = ours
      ? [...ours.querySelectorAll(":scope > button.category-tab")].find(button => button.dataset.group === name || button.dataset.label === name)
      : [...(bar?.querySelectorAll(":scope > .category-tabs > button.category-tab") || [])].find(button => (button.getAttribute("title") || "").trim() === name);
    return pill ? { pill, name } : null;
  }

  function place() {
    const found = activePill();
    let button = document.getElementById("hof-tab-edit");
    if (!found || !canEdit(found.name)) {
      button?.remove();
      return;
    }
    if (!button) {
      button = HOF.el("button", { id: "hof-tab-edit", type: "button", class: "hof-tab-edit" }, PENCIL);
      button.addEventListener("click", event => {
        event.stopPropagation();
        const current = activePill();
        if (current) openEditor(current.name);
      });
    }
    button.title = `“${found.name}” sekmesinin adını değiştir ya da sekmeyi sil`;
    button.setAttribute("aria-label", button.title);
    if (found.pill.nextElementSibling !== button) found.pill.after(button);
  }

  async function afterChange(select) {
    HOF.refreshData();
    // Sayfa şeridindeki kayıt sayısı sekme silinince/geri gelince güncellenir (2.0.25).
    HOF.sessions?.load?.().catch?.(() => {});
    if (!select) return;
    // Veri yenilenince yeni adıyla sekmeye geçilir.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 80));
      if ((HOF.tabLabels ? HOF.tabLabels() : []).some(label => topOf(label) === select)) {
        HOF.selectTab?.(select);
        return;
      }
    }
  }

  function openEditor(name) {
    const freeId = freeIdOf(name);
    const original = freeId ? name : originalOf(name);
    const renamed = !freeId && original !== name;
    const modal = HOF.formModal({
      title: "Sekmeyi Düzenle",
      eyebrow: freeId ? "SERBEST SAYFA" : "SEKME",
      intro: freeId
        ? "Serbest sayfanın adı tüm bilgisayarlarda değişir."
        : `Ad yalnızca programda değişir; Excel/Sheets dosyanız ve eşitleme ${renamed ? `asıl adla (<b>${esc(original)}</b>)` : "asıl adla"} çalışmaya devam eder. Tabloda, özet kartlarında, tahsilat takviminde ve Excel'e aktarmada yeni ad görünür.`,
      fields: [{ name: "name", label: "Sekmenin Adı", value: name, required: true, autofocus: true, maxlength: 80, placeholder: original }],
      submitLabel: "Kaydet",
      extraHtml: `<div class="hof-tab-editor-extra">${renamed ? `<button type="button" class="hof-link" data-reset>Excel'deki Ada Dön (“${esc(original)}”)</button>` : ""}<button type="button" class="hof-link hof-link-danger" data-remove>Sekmeyi Sil</button></div>`,
      onSubmit: async data => {
        const next = String(data.name || "").trim();
        if (next === name) return undefined;
        if (freeId) await HOF.api(`/api/workspace/free/${encodeURIComponent(freeId)}`, { method: "PATCH", body: { name: next } });
        else await HOF.api("/api/workspace/tabs/rename", { method: "POST", body: { tab: name, name: next } });
        HOF.toast(`Sekmenin adı “${next}” oldu.`, { type: "success" });
        afterChange(next);
        return undefined;
      },
    });
    modal.dialog.querySelector("[data-reset]")?.addEventListener("click", async () => {
      try {
        await HOF.api("/api/workspace/tabs/rename", { method: "POST", body: { tab: name, name: "" } });
        modal.close();
        HOF.toast(`Sekme Excel'deki adına döndü: “${original}”.`, { type: "success" });
        afterChange(original);
      } catch (error) {
        HOF.toastError(error);
      }
    });
    modal.dialog.querySelector("[data-remove]").addEventListener("click", async () => {
      const count = (HOF.data?.rows || []).filter(row => topOf(row.__sheet) === name).length;
      const yes = await HOF.confirm({
        title: `“${name}” sekmesi silinsin mi?`,
        message: freeId
          ? "Serbest sayfa silinir. Yönetim → Silinenler'den ya da bildirimdeki Geri al ile geri getirilir."
          : `Sekme ve ${count} kaydı ekrandan kalkar; veriler silinmez. Yönetim → Silinenler'den ya da bildirimdeki Geri al ile geri getirilir. Excel dosyanız değişmez.`,
        confirmLabel: "Sekmeyi Sil",
        danger: true,
      });
      if (!yes) return;
      try {
        let undo;
        if (freeId) {
          await HOF.api(`/api/workspace/free/${encodeURIComponent(freeId)}`, { method: "DELETE" });
          undo = () => HOF.api(`/api/workspace/free/${encodeURIComponent(freeId)}/restore`, { method: "POST" });
        } else {
          const result = await HOF.api("/api/workspace/tabs/hide", { method: "POST", body: { tab: name } });
          undo = () => HOF.api("/api/workspace/tabs/unhide", { method: "POST", body: { original: result.original } });
        }
        modal.close();
        afterChange("");
        HOF.toast(`“${name}” sekmesi silindi.`, {
          type: "success",
          action: {
            label: "Geri Al",
            onClick: async () => {
              try {
                await undo();
                afterChange(name);
              } catch (error) {
                HOF.toastError(error);
              }
            },
          },
        });
      } catch (error) {
        HOF.toastError(error);
      }
    });
  }

  HOF.whenReady(() => HOF.onDom(place));
  HOF.tabs = { edit: openEditor };
})();
