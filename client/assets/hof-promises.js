/* DestekOfis — ödeme sözleri şeridi.
 * Tabloda "ödeme sözü / taahhüt" kolonu varsa aktif sözler kayan bir şeritte gösterilir;
 * "Ödendi" veya "İptal" ile söz kapatılır (kaynak dosya değişmez, düzeltme olarak kaydedilir).
 * Büyük tablolarda: her DOM değişikliğinde yalnızca gereken hücreler okunur, değişiklik kısa bir özetle anlaşılır ve
 * şeritte en yakın 40 söz gösterilir (tamamı akıllı özet kartındaki listededir). */
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

  const PILL_LIMIT = 40;
  const cellText = cell => (cell ? clean(cell.getAttribute("title") ?? cell.textContent) : "");
  // "12.10.2026" → bugüne göre gün farkı; okunamazsa null.
  const daysUntil = text => {
    const match = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text);
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (date.getDate() !== Number(match[1])) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((date - today) / 86_400_000);
  };
  // Küçük ve hızlı özet (FNV-1a): binlerce sözde dev bir imza metni oluşturmadan değişikliği anlamak için.
  const hash = (value, seed) => {
    let result = seed;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  };
  // Şeritte en yakın sözler: bugün ve yaklaşanlar (yakından uzağa), sonra tarihi geçenler (en yeniden), tarihi
  // okunamayanlar sonda; eşitlikte tablo sırası.
  const rank = record => (record.days === null ? [2, 0] : record.days >= 0 ? [0, record.days] : [1, -record.days]);
  const byNearest = (a, b) => {
    const x = rank(a);
    const y = rank(b);
    return x[0] - y[0] || x[1] - y[1] || a.order - b.order;
  };

  const closeCard = () => document.querySelector(".hof-payment-action-card")?.remove();

  async function closePromise(record, action, button) {
    button.disabled = true;
    try {
      await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: record.key, field: record.header, value: "", action } });
      closeCard();
      HOF.toast(action === "paid" ? "Ödeme sözü ödendi olarak kapatıldı." : "Ödeme sözü iptal edildi.", { type: "success" });
      if (action === "paid" && HOF.modules?.tahsilat !== false) HOF.toast("Tahsilatı kaydetmek için kaydın “Tahsilat” düğmesini kullanabilirsiniz.");
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
      `<button type="button" class="hof-payment-action-close" aria-label="Kapat">×</button><div class="hof-payment-action-title">Ödeme sözünü kapat</div><div class="hof-payment-action-help">${esc(record.person || record.caseNo || "Bu kayıt")} · ${esc(record.promise)}</div><div class="hof-payment-action-buttons"><button type="button" data-action="paid" class="hof-payment-paid">Ödendi</button><button type="button" data-action="cancelled" class="hof-payment-cancelled">Ödeme iptal</button></div><button type="button" class="hof-payment-go" data-go>Kayda git →</button>`,
    );
    card.querySelector(".hof-payment-action-close").onclick = closeCard;
    // Kayda git: satır seçilir ve kısa bir süre vurgulanır (v1.7.0).
    card.querySelector("[data-go]").onclick = () => {
      closeCard();
      HOF.revealRecord?.(record.key);
    };
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
    const records = [];
    let digest = 2166136261;
    for (const row of table.tBodies[0]?.rows || []) {
      let promiseIndex = -1;
      let promise = "";
      for (const index of promiseIndexes) {
        const text = cellText(row.cells[index]);
        if (text && text !== "—" && text !== "-") {
          promiseIndex = index;
          promise = text;
          break;
        }
      }
      if (promiseIndex < 0) continue;
      const key = HOF.rowKey(row);
      if (!key) continue;
      const person = personIndex >= 0 ? cellText(row.cells[personIndex]) : "";
      const amount = amountIndex >= 0 ? cellText(row.cells[amountIndex]) : "";
      records.push({ key, promise, header: headers[promiseIndex], person, caseNo: caseIndex >= 0 ? cellText(row.cells[caseIndex]) : "", amount, order: records.length });
      digest = hash(`${key}|${person}|${promise}|${amount}¦`, digest);
    }
    if (!records.length) {
      existing?.remove();
      return;
    }
    const signature = `${records.length}:${digest}`;
    if (existing && existing.dataset.signature === signature) return;
    existing?.remove();
    let shown = records;
    if (records.length > PILL_LIMIT) {
      for (const record of records) record.days = daysUntil(record.promise);
      shown = [...records].sort(byNearest).slice(0, PILL_LIMIT);
    }
    const band = HOF.el("section", { class: "hof-payment-promises", "aria-label": "Ödeme sözleri", "data-signature": signature });
    band.innerHTML = `<div class="hof-payment-promises-heading"><span class="hof-payment-promises-dot"></span><strong>Ödeme sözleri</strong><small>${new Intl.NumberFormat("tr-TR").format(records.length)} aktif kayıt${shown.length < records.length ? ` · en yakın ${shown.length} tanesi gösteriliyor` : ""}</small></div><div class="hof-payment-promises-viewport"><div class="hof-payment-promises-track"></div></div>`;
    const track = band.querySelector(".hof-payment-promises-track");
    const pill = record => {
      const button = HOF.el("button", { type: "button", class: "hof-payment-pill", title: "Ödeme sözünü kapat" }, `<span class="hof-payment-pill-icon">₺</span><span class="hof-payment-pill-text"><b>${esc(record.person || record.caseNo || "Kayıt")}</b><span>${record.caseNo ? `${esc(record.caseNo)} · ` : ""}${esc(record.promise)}${record.amount ? ` · ${esc(record.amount)}` : ""}</span></span>`);
      button.onclick = event => {
        event.stopPropagation();
        openCard(record, band);
      };
      return button;
    };
    shown.forEach(record => track.appendChild(pill(record)));
    // Kesintisiz kayma için ikinci kopya (ekran okuyucudan gizli).
    if (shown.length > 1) shown.forEach(record => {
      const copy = pill(record);
      copy.setAttribute("aria-hidden", "true");
      copy.tabIndex = -1;
      track.appendChild(copy);
    });
    // Akıllı özet kartları varsa şerit onların altına gelir.
    const anchor = document.getElementById("hof-summary") || document.querySelector(".welcome-row");
    if (anchor) anchor.after(band);
    else table.closest(".dynamic-table-wrap")?.before(band);
  }

  HOF.whenReady(() => HOF.onDom(build));
})();
