/* DestekOfis — ödeme sözleri şeridi.
 * Tabloda "ödeme sözü / taahhüt" kolonu varsa aktif sözler kayan bir şeritte gösterilir;
 * "Ödendi" veya "İptal" ile söz kapatılır (kaynak dosya değişmez, düzeltme olarak kaydedilir). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const norm = value => String(value ?? "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const isPromiseHeader = value => /(taahhut|odeme.*soz|soz.*odeme|vaat|odeme tarihi|tahsil tarihi)/.test(norm(value));
  const isPersonHeader = value => /(borclu|musteri|muvekkil|ad soyad|isim|unvan)/.test(norm(value));
  const isCaseHeader = value => /(dosya|esas|takip no)/.test(norm(value));
  const isAmountHeader = value => /(tutar|miktar|bedel|\btl\b|odeme|tahsil)/.test(norm(value));

  const closeCard = () => document.querySelector(".hof-payment-action-card")?.remove();

  async function closePromise(record, action, button) {
    button.disabled = true;
    try {
      await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: record.key, field: record.header, value: "", action } });
      closeCard();
      HOF.toast(action === "paid" ? "Ödeme sözü ödendi olarak kapatıldı." : "Ödeme sözü iptal edildi.", { type: "success" });
      if (action === "paid") HOF.toast("Tahsilatı kaydetmek için dosyanın “Tahsilat” düğmesini kullanabilirsiniz.");
      HOF.refreshData();
    } catch (error) {
      button.disabled = false;
      HOF.toastError(error);
    }
  }

  function openCard(record, band) {
    closeCard();
    const card = HOF.el(
      "div",
      { class: "hof-payment-action-card", role: "dialog", "aria-label": "Ödeme sözünü kapat" },
      `<button type="button" class="hof-payment-action-close" aria-label="Kapat">×</button><div class="hof-payment-action-title">Ödeme sözünü kapat</div><div class="hof-payment-action-help">${esc(record.person || record.caseNo || "Bu kayıt")} · ${esc(record.promise)}</div><div class="hof-payment-action-buttons"><button type="button" data-action="paid" class="hof-payment-paid">Ödendi</button><button type="button" data-action="cancelled" class="hof-payment-cancelled">Ödeme iptal</button></div>`,
    );
    card.querySelector(".hof-payment-action-close").onclick = closeCard;
    card.querySelectorAll("[data-action]").forEach(button => {
      button.onclick = () => closePromise(record, button.dataset.action, button);
    });
    band.appendChild(card);
    card.querySelector("[data-action]").focus();
  }

  function build() {
    const table = document.querySelector(".dynamic-table");
    const existing = document.querySelector(".hof-payment-promises");
    if (!table) {
      existing?.remove();
      return;
    }
    const headers = HOF.tableHeaders(table);
    const promiseIndexes = headers.map((header, index) => (isPromiseHeader(header) ? index : -1)).filter(index => index >= 0);
    if (!promiseIndexes.length) {
      existing?.remove();
      return;
    }
    const personIndex = headers.findIndex(isPersonHeader);
    const caseIndex = headers.findIndex(isCaseHeader);
    const amountIndex = headers.findIndex((header, index) => isAmountHeader(header) && !promiseIndexes.includes(index));
    const records = [...(table.tBodies[0]?.rows || [])]
      .map(row => {
        const cells = [...row.cells].map(cell => clean(cell.getAttribute("title") ?? cell.textContent));
        const promiseIndex = promiseIndexes.find(index => cells[index] && cells[index] !== "—" && cells[index] !== "-");
        if (promiseIndex === undefined) return null;
        return { key: HOF.rowKey(row), promise: cells[promiseIndex], header: headers[promiseIndex], person: personIndex >= 0 ? cells[personIndex] : "", caseNo: caseIndex >= 0 ? cells[caseIndex] : "", amount: amountIndex >= 0 ? cells[amountIndex] : "" };
      })
      .filter(record => record && record.key);
    if (!records.length) {
      existing?.remove();
      return;
    }
    const signature = records.map(record => `${record.key}|${record.person}|${record.promise}|${record.amount}`).join("¦");
    if (existing && existing.dataset.signature === signature) return;
    existing?.remove();
    const band = HOF.el("section", { class: "hof-payment-promises", "aria-label": "Ödeme sözleri", "data-signature": signature });
    band.innerHTML = `<div class="hof-payment-promises-heading"><span class="hof-payment-promises-dot"></span><strong>Ödeme sözleri</strong><small>${records.length} aktif kayıt</small></div><div class="hof-payment-promises-viewport"><div class="hof-payment-promises-track"></div></div>`;
    const track = band.querySelector(".hof-payment-promises-track");
    const pill = record => {
      const button = HOF.el("button", { type: "button", class: "hof-payment-pill", title: "Ödeme sözünü kapat" }, `<span class="hof-payment-pill-icon">₺</span><span class="hof-payment-pill-text"><b>${esc(record.person || record.caseNo || "Kayıt")}</b><span>${record.caseNo ? `${esc(record.caseNo)} · ` : ""}${esc(record.promise)}${record.amount ? ` · ${esc(record.amount)}` : ""}</span></span>`);
      button.onclick = event => {
        event.stopPropagation();
        openCard(record, band);
      };
      return button;
    };
    records.forEach(record => track.appendChild(pill(record)));
    // Kesintisiz kayma için ikinci kopya (ekran okuyucudan gizli).
    if (records.length > 1) records.forEach(record => {
      const copy = pill(record);
      copy.setAttribute("aria-hidden", "true");
      copy.tabIndex = -1;
      track.appendChild(copy);
    });
    const anchor = document.querySelector(".welcome-row");
    if (anchor) anchor.after(band);
    else table.closest(".dynamic-table-wrap")?.before(band);
  }

  HOF.whenReady(() => HOF.onDom(build));
})();
