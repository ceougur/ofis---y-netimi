/* DestekOfis — Yönetim → WhatsApp → Aydınlatma Metni Hazırla (2.4.8 W6; sunucu routes/whatsapp-sablon.mjs, lib/whatsapp/aydinlatma-metni.mjs; plan
   docs/erp/WHATSAPP-API-PLANI-2.4.8.md §5, §6 W6). Firma bilgileriyle (Fatura Ayarları → Firma Bilgisi) hazırlanan KVKK aydınlatma metni pencerede
   gösterilir; Kopyala (düz metin) ve "Aydınlatma Metni - PDF" (UI11 belge çıktısı; şirket parametresi HOF.apiUrl ile — iki şirkette doğru şirketin metni). Eksik firma bilgisi adıyla söylenir, metinde köşeli ayraçlı yer tutucu kalır. Bağlantıdan bağımsızdır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const API = "/api/workspace/whatsapp/aydinlatma-metni";

  const sectionHtml = section => `
    <h3>${esc(section.heading)}</h3>
    ${section.paragraphs.map(text => `<p>${esc(text)}</p>`).join("")}
    ${section.items.length ? `<ul>${section.items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
    ${(section.after || []).map(text => `<p>${esc(text)}</p>`).join("")}`;

  async function open() {
    let notice;
    try {
      notice = await HOF.api(API);
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const missing = notice.missing.length
      ? `<p class="adm-wa-why adm-wa-notice-missing" data-wa-notice-missing>Eksik firma bilgisi: ${esc(notice.missing.map(item => item.label).join(", "))}. Bilgiler Fatura → Fatura Ayarları → Firma Bilgisi'nden gelir; tamamlayıp metni yeniden hazırlayın (metinde köşeli ayraçlı yer tutucu kaldı).</p>`
      : "";
    const body = `
      <p class="adm-muted">Carilerinize WhatsApp ile ekstre ve ödeme hatırlatması göndermeden önce bu metni carilerinize ulaştırın (ör. sözleşme ekinde, e-postayla ya da internet sitenizde). Metin hukuki görüş değildir; kullanmadan önce kendi hukuk danışmanınızla gözden geçirin.</p>
      ${missing}
      <article class="adm-wa-notice-text" data-wa-notice-text tabindex="0">
        <h2>${esc(notice.title)}</h2>
        ${notice.sections.map(sectionHtml).join("")}
        <p class="adm-muted">${esc(notice.closing)}</p>
      </article>
      <div class="adm-inline adm-wa-notice-actions">
        <button type="button" class="hof-button" data-wa-notice="copy">Kopyala</button>
        ${HOF.outputButton({ kind: "pdf", href: HOF.apiUrl(`${API}.pdf`), what: "Aydınlatma Metni", label: "Aydınlatma Metni - PDF", attrs: 'target="_blank" rel="noopener" data-wa-notice="pdf"' })}
      </div>`;
    const modal = HOF.modal({ title: "Aydınlatma Metni", eyebrow: "WHATSAPP · KVKK", body, size: "wide" });
    const dialog = modal?.dialog || document.querySelector(".hof-modal-backdrop:last-child .hof-modal");
    dialog?.querySelector('[data-wa-notice="copy"]')?.addEventListener("click", async () => {
      const done = await HOF.copyText(notice.text);
      if (done) HOF.toast("Aydınlatma metni panoya kopyalandı.", { type: "success" });
      else HOF.toast("Metin kopyalanamadı; metni seçip kendiniz kopyalayın.", { type: "error" });
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-wa-notice-open]");
    if (!button || button.disabled) return;
    open();
  });

  HOF.whatsappNotice = { open };
})();
