/* DestekOfis — Vergi Ödemesi ve KDV Mahsup Fişi (2.4.3; uzman mali müşavir MM3, kullanıcı kararı 18.10.2026).
 * HOF.taxPayment({ way, accountId, onDone }): Banka'dan (hesap detayı / Hareketler) ya da Kasa'dan ödenen vergi — B 360 (ve gecikme zammı 689) /
 *   A 102 ya da 100. 360 bakiyesini aşan tutarda program sorar ("Yine de Kaydet"); eksi bakiye sorusu Kasa ve Banka'daki gibi.
 * HOF.vatOffset({ month, onDone }): Raporlar → KDV Özeti → "KDV Mahsup Fişi Oluştur": ay seçilir, fiş ön izlenir, onaylanınca yazılır; mahsup
 *   edilmiş aylar listesi ve en son mahsubun "Geri Al"ı (ters kayıt). Sunucu: server/routes/tax.mjs. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const TAX = "/api/workspace/tax";
  const TYPES = [
    { value: "kdv", label: "KDV" },
    { value: "muhtasar", label: "Muhtasar ve Stopaj" },
    { value: "other", label: "Diğer Vergi" },
  ];
  const money = minor => HOF.formatMoney((Number(minor) || 0) / 100);
  const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const monthLabel = key => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

  async function taxPayment({ way = "bank", accountId = "", onDone = null } = {}) {
    let info;
    let choices = { accounts: [], forms: { bank: { defaultId: "" } } };
    try {
      info = await HOF.api(TAX);
      if (way === "bank") choices = await HOF.api("/api/workspace/bank/choices");
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const accounts = (choices.accounts || []).filter(item => ["demand", "commercial", "other"].includes(item.kind) && item.currency === "TRY");
    const balance = key => info.types.find(item => item.key === key)?.balanceMinor ?? 0;
    const fields = [];
    if (way === "bank") fields.push({ name: "accountId", label: "Banka Hesabı", type: "select", required: true, value: accountId || choices.forms?.bank?.defaultId || accounts[0]?.id || "", options: accounts.map(item => ({ value: item.id, label: item.label })) });
    fields.push(
      { name: "date", label: "Ödeme Tarihi", type: "date", required: true, value: HOF.localToday(), max: "today" },
      { name: "taxType", label: "Vergi Türü", type: "select", required: true, value: "kdv", options: TYPES.map(item => ({ value: item.value, label: `${item.label} (Ödenecek ${money(balance(item.value))})` })) },
      { name: "amount", label: "Vergi Tutarı", required: true, inputmode: "decimal", placeholder: "0,00", help: "Beyannameyle ödenen vergi; 360 Ödenecek Vergi ve Fonlar hesabını kapatır (gider yazılmaz)." },
      { name: "lateAmount", label: "Gecikme Zammı / Faizi", inputmode: "decimal", placeholder: "0,00", help: "Varsa; 689 Diğer Olağandışı Gider ve Zararlar hesabına yazılır (kanunen kabul edilmeyen gider)." },
      { name: "description", label: "Açıklama", maxlength: 300, placeholder: "Örn. Eylül 2026 KDV beyannamesi" },
    );
    if (way === "bank" && !accounts.length) {
      HOF.toast("Vergi ödemesi için Vadesiz, Ticari ya da Diğer TL banka hesabı tanımlayın.", { type: "error" });
      return;
    }
    HOF.formModal({
      title: way === "bank" ? "Vergi Ödemesi (Banka)" : "Vergi Ödemesi (Kasa)",
      intro: `Ödenecek vergi (360) toplamı ${esc(money(info.totalMinor))}. Tutar ilgili bakiyeyi aşarsa program sorar.`,
      fields,
      submitLabel: "Kaydet",
      onSubmit: async data => {
        const body = { way, ...data, requestId: HOF.requestId() };
        const send = extra => HOF.api(`${TAX}/payments`, { method: "POST", body: { ...body, ...extra } });
        let extra = {};
        for (let round = 0; round < 3; round += 1) {
          try {
            await send(extra);
            HOF.toast(way === "bank" ? "Vergi ödemesi bankadan yazıldı." : "Vergi ödemesi Kasa'dan yazıldı.", { type: "success" });
            onDone?.();
            return false;
          } catch (error) {
            const code = error?.data?.code;
            if (code === "tax-exceeds" || code === "cash-negative") {
              const yes = await HOF.confirm({ title: code === "tax-exceeds" ? "Ödenecek Vergiyi Aşıyor" : "Eksi Bakiye", message: error.message, confirmLabel: "Yine de Kaydet" });
              if (!yes) return true;
              extra = { ...extra, ...(code === "tax-exceeds" ? { exceedOk: true } : { cashForce: true, negativeOk: true }), requestId: HOF.requestId() };
              continue;
            }
            throw error;
          }
        }
        return true;
      },
    });
  }

  function previousMonths(count = 12) {
    const now = new Date();
    const out = [];
    for (let i = 1; i <= count; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }

  function vatOffset({ month = "", onDone = null } = {}) {
    const months = previousMonths(18);
    let chosen = month || months[0];
    let state = { preview: null, offsets: [], busy: false, error: "" };
    const modal = HOF.modal({
      title: "KDV Mahsup Fişi",
      size: "wide",
      body: '<div data-vat-root><p class="hof-empty">Hazırlanıyor…</p></div>',
      onClose: () => onDone?.(),
    });
    const root = modal.dialog.querySelector("[data-vat-root]");
    const linesTable = lines => `<div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Hesap</th><th>Hesap Adı</th><th class="num">Borç</th><th class="num">Alacak</th></tr></thead><tbody>${lines.map(line => `<tr><td>${esc(line.account)}</td><td>${esc(line.name)}</td><td class="num">${line.debitMinor ? esc(money(line.debitMinor)) : ""}</td><td class="num">${line.creditMinor ? esc(money(line.creditMinor)) : ""}</td></tr>`).join("")}</tbody></table></div>`;
    const render = () => {
      const view = state.preview;
      const latest = [...state.offsets].filter(item => item.status === "active").sort((a, b) => (a.month < b.month ? 1 : -1))[0];
      const RESULT = { payable: "Ödenecek KDV (360)", carry: "Sonraki Aya Devreden KDV (190)", zero: "Ödenecek ve Devreden Yok" };
      HOF.swap(root, `
        <div class="hof-rep-filters"><label class="hof-field"><span>Mahsup Edilecek Ay</span><select data-vat-month>${months.map(key => `<option value="${key}" ${key === chosen ? "selected" : ""}>${esc(monthLabel(key))}</option>`).join("")}</select></label></div>
        ${view ? `<p class="hof-modal-text">${esc(view.label)} · fiş tarihi ${esc(HOF.formatDate(view.date))}. Ayın hesaplanan KDV'si (391) ve indirilecek KDV'si (191) kapanır; fark ${view.result === "payable" ? "ödenecek KDV'ye (360)" : view.result === "carry" ? "devreden KDV'ye (190)" : "yoktur"}.</p>
          ${view.lines.length ? linesTable(view.lines) : ""}
          <p class="hof-edit-meta"><b>${esc(RESULT[view.result] || "")}:</b> ${esc(money(view.result === "carry" ? view.carryOutMinor : view.payableMinor))}${view.carryInMinor ? ` · kullanılan devreden ${esc(money(view.carryInMinor))}` : ""}</p>
          ${view.warnings.map(text => `<p class="hof-tax-warn">${esc(text)}</p>`).join("")}
          ${view.blocks.map(text => `<p class="hof-form-error">${esc(text)}</p>`).join("")}` : ""}
        ${state.error ? `<p class="hof-form-error" role="alert">${esc(state.error)}</p>` : ""}
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-vat-close>Kapat</button><button type="button" class="hof-button" data-vat-create ${!view?.allowed || state.busy ? `disabled aria-disabled="true" title="${esc(view?.blocks?.[0] || "")}"` : ""}>Mahsup Fişini Oluştur</button></div>
        <h3 class="hof-tax-h3">Mahsup Edilen Aylar</h3>
        ${state.offsets.length ? `<div class="hof-rep-table"><table class="hof-table"><thead><tr><th>Ay</th><th class="num">Hesaplanan (391)</th><th class="num">İndirilecek (191)</th><th class="num">Kullanılan Devreden</th><th class="num">Ödenecek (360)</th><th class="num">Devreden (190)</th><th>Durum</th><th></th></tr></thead><tbody>${state.offsets.map(item => `<tr><td>${esc(item.label)}</td><td class="num">${esc(money(item.outMinor))}</td><td class="num">${esc(money(item.inMinor))}</td><td class="num">${esc(money(item.carryInMinor))}</td><td class="num">${esc(money(item.payableMinor))}</td><td class="num">${esc(money(item.carryOutMinor))}</td><td>${item.status === "active" ? (item.stale ? '<span class="hof-plan-badge is-muted" title="Mahsuptan sonra bu aya KDV\'li kayıt girildi ya da değişti; mahsubu geri alıp yeniden yapın.">Mahsuptan Sonra Değişti</span>' : "Etkin") : "Geri Alındı"}</td><td>${latest && item.id === latest.id ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-vat-reverse="${esc(item.id)}">Geri Al</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hof-empty">Henüz mahsup fişi yok.</p>'}`);
    };
    const load = async () => {
      try {
        const data = await HOF.api(`${TAX}/vat-offset?month=${encodeURIComponent(chosen)}`);
        state = { ...state, preview: data.preview, offsets: data.offsets, error: "" };
      } catch (error) {
        state = { ...state, error: error.message };
      }
      render();
    };
    root.addEventListener("change", event => {
      if (event.target.matches("[data-vat-month]")) {
        chosen = event.target.value;
        load();
      }
    });
    root.addEventListener("click", async event => {
      const button = event.target.closest("button");
      if (!button) return;
      if ("vatClose" in button.dataset) return modal.close();
      if ("vatCreate" in button.dataset) {
        const view = state.preview;
        const yes = await HOF.confirm({ title: "KDV Mahsup Fişi", message: `${view.label} için mahsup fişi yazılsın mı? ${view.result === "payable" ? `Ödenecek KDV ${money(view.payableMinor)}.` : view.result === "carry" ? `Devreden KDV ${money(view.carryOutMinor)}.` : ""}`, confirmLabel: "Mahsup Fişini Oluştur" });
        if (!yes) return;
        state.busy = true;
        render();
        try {
          await HOF.api(`${TAX}/vat-offset`, { method: "POST", body: { month: chosen } });
          HOF.toast(`${view.label} KDV mahsup fişi yazıldı.`, { type: "success" });
        } catch (error) {
          HOF.toastError(error);
        }
        state.busy = false;
        load();
      }
      if (button.dataset.vatReverse) {
        const item = state.offsets.find(row => row.id === button.dataset.vatReverse);
        const yes = await HOF.confirm({ title: "Mahsubu Geri Al", message: `${item?.label || ""} mahsup fişi ters kayıtla geri alınsın mı? Ay yeniden mahsup edilebilir.`, confirmLabel: "Geri Al", danger: true });
        if (!yes) return;
        try {
          await HOF.api(`${TAX}/vat-offset/${encodeURIComponent(button.dataset.vatReverse)}/reverse`, { method: "POST", body: {} });
          HOF.toast("Mahsup fişi geri alındı (ters kayıt).", { type: "success" });
        } catch (error) {
          HOF.toastError(error);
        }
        load();
      }
    });
    load();
    return modal;
  }

  HOF.taxPayment = taxPayment;
  HOF.vatOffset = vatOffset;
})();
