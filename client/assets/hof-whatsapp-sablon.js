/* DestekOfis — Yönetim → WhatsApp → Bilgilendirme Şablonları (2.4.8 W5; sunucu routes/whatsapp-sablon.mjs, lib/whatsapp/templates.mjs; plan
   docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W5). Program yalnız iki bilgilendirme şablonu (Ekstre, Ödeme Hatırlatma) açar ve izler; kampanya /
   serbest metin yok. "Şablonları Denetle ve Oluştur" Meta'daki durumu okur, olmayanı açar. Bağlantı kaydedilip sınanınca da kendiliğinden çalışır
   (hof-whatsapp-ayar.js → HOF.whatsappTemplates.ensure). Meta şablonu Pazarlama'ya alırsa satırda açık uyarı; program o şablonla göndermez.
   Pasif düğmenin nedeni görünür yazıyla söylenir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const $ = selector => document.querySelector(selector);
  const API = "/api/workspace/whatsapp/templates";
  let view = null;
  let busy = false;

  const when = value => (value ? HOF.formatDateTime(value) : "");
  const blockOf = data => {
    if (!data.writable) return "Lisans salt okunur: şablon açılamaz.";
    if (!data.configured) return "Önce yukarıdaki Elle Bağla ile WhatsApp Business API bağlantısını kurun.";
    if (!data.graphAvailable) return "Bu kurulumda WhatsApp Business API adresi tanımlı değil; Meta'ya bağlanılamaz.";
    return "";
  };

  function row(item, definition) {
    const sample = definition ? `<details class="adm-wa-tpl-text"><summary>Şablon Metni</summary><p>${esc(definition.body)}</p>${definition.footer ? `<p class="adm-muted">${esc(definition.footer)}</p>` : ""}${definition.header === "DOCUMENT" ? '<p class="adm-muted">Başlık: ekstre PDF dosyası</p>' : ""}</details>` : "";
    const warnings = (item.warnings || []).map(text => `<p class="adm-wa-tpl-warn" data-wa-tpl-warning>${esc(text)}</p>`).join("");
    return `<tr data-wa-tpl="${esc(item.name)}" class="is-${esc(item.tone || "off")}">
      <td><b>${esc(item.label)}</b><br><code>${esc(item.name)}</code>${sample}</td>
      <td data-wa-tpl-status>${esc(item.statusLabel)}</td>
      <td data-wa-tpl-category>${esc(item.categoryLabel || "—")}</td>
      <td data-wa-tpl-quality>${esc(item.qualityLabel || "—")}</td>
      <td data-wa-tpl-usable>${item.usable ? "Evet" : "Hayır"}</td>
    </tr>${warnings ? `<tr class="adm-wa-tpl-notes is-${esc(item.tone || "off")}" data-wa-tpl-notes="${esc(item.name)}"><td colspan="5">${warnings}</td></tr>` : ""}`;
  }

  function render() {
    const box = $("#adm-wa-templates");
    if (!box || !view) return;
    const data = view;
    const block = blockOf(data);
    const defs = Object.fromEntries((data.definitions || []).map(item => [item.name, item]));
    const actions = (data.actions || []).filter(action => !action.ok || action.created).map(action => `<li class="${action.ok ? "adm-ok" : "adm-error"}" data-wa-tpl-action="${esc(action.name)}">${esc(action.message)}</li>`).join("");
    const error = data.lastError ? `<p class="adm-error" data-wa-tpl-error>Son denetim başarısız: ${esc(data.lastError.message)}</p>` : "";
    box.innerHTML = `
      <div class="adm-wa-head"><h2>Bilgilendirme Şablonları</h2>
        <p>Program carilere yalnız bu iki bilgilendirme şablonuyla gönderim yapar; kampanya ya da serbest metin gönderilmez. Şablonları program Meta'da kendisi açar; Meta onaylayınca kullanılabilir.</p></div>
      <div class="adm-table-wrap"><table class="hof-table adm-table"><thead><tr><th>Şablon</th><th>Durum</th><th>Kategori</th><th>Kalite</th><th>Gönderime Hazır</th></tr></thead>
        <tbody>${(data.items || []).map(item => row(item, defs[item.name])).join("")}</tbody></table></div>
      ${actions ? `<ul class="adm-wa-tpl-actions" data-wa-tpl-actions>${actions}</ul>` : ""}
      ${error}
      <p class="adm-muted" data-wa-tpl-checked>${data.checkedAt ? `Son denetim: ${esc(when(data.checkedAt))}${data.checkedByName ? ` · ${esc(data.checkedByName)}` : ""}` : "Şablonlar henüz denetlenmedi."}</p>
      <div class="adm-inline"><button type="button" class="hof-button" data-wa-tpl-action-button="ensure" ${block || busy ? "disabled" : ""}>Şablonları Denetle ve Oluştur</button></div>
      ${block ? `<p class="adm-wa-why" data-wa-tpl-why>${esc(block)}</p>` : ""}`;
  }

  async function load() {
    const box = $("#adm-wa-templates");
    if (!box) return;
    try {
      view = await HOF.api(API);
      render();
    } catch (error) {
      box.innerHTML = `<p class="adm-mobile-warn">${esc(error.message)}</p>`;
    }
  }

  // quiet: bağlantı kaydından sonra kendiliğinden çağrı (başarı bildirimi yok, hata bildirimi var).
  async function ensure({ quiet = false } = {}) {
    if (busy) return;
    busy = true;
    if (view) render();
    try {
      view = await HOF.api(`${API}/ensure`, { method: "POST", body: {} });
      if (!quiet) {
        const created = (view.actions || []).filter(action => action.created).length;
        HOF.toast(created ? `${created} şablon Meta'ya gönderildi; Meta onayı bekleniyor.` : "Şablonlar denetlendi.", { type: "success" });
      }
    } catch (error) {
      HOF.toastError(error);
      busy = false;
      await load();
      return;
    }
    busy = false;
    render();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-wa-tpl-action-button]");
    if (!button || button.disabled) return;
    button.disabled = true;
    button.classList.add("is-busy");
    ensure();
  });

  HOF.whatsappTemplates = { load, ensure };
})();
