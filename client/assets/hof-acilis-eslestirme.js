/* DestekOfis — Yönetim › Sistem › Dönem Kilidi ve Mutabakat › Açılış Eşleştirme (2.5.0 Ç5-A tur 2c İş 1; sunucu routes/ledger.mjs opening-match; docs/erp/C5-ACILIS-TASARIM.md §2.7,
   §17.10; kural kitabı M-11; BAŞ MİMAR B10). Modül açılışlarının karşı hesabı 519 Eşleştirilecek Açılış Bakiyeleri'ni açılış bilançosunun hesaplarıyla (Sermaye 500, Geçmiş Yıllar Kârları
   570 …) eşleştiren Açılış Eşleştirme Fişi: fiş tarihinin gün sonundaki 519 bakiyesi ve açılış türlerine göre dökümü, hedef satırları, ön izleme (519 satırı kendiliğinden; 519 ters
   bakiyeye geçemez), onay + Fişi Kaydet; yazılmış fişler ve Ters Kaydet. Pasif düğmenin nedeni görünür yazıdır. admin.js'e dokunmadan bağlanır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const money = minor => HOF.formatMoney((Number(minor) || 0) / 100);
  const day = iso => (iso ? String(iso).split("-").reverse().join(".") : "—");
  const sideText = minor => (minor > 0 ? "Borç" : minor < 0 ? "Alacak" : "");
  const URL = "/api/admin/ledger/opening-match";

  function balanceBlock(view) {
    const parts = view.parts.length
      ? `<table class="hof-table" data-match-parts><thead><tr><th>Açılış Türü</th><th class="adm-right">519 Tutarı</th></tr></thead><tbody>${view.parts.map(part => `<tr><td>${esc(part.label)}</td><td class="adm-right">${esc(money(Math.abs(part.minor)))} ${esc(sideText(part.minor))}</td></tr>`).join("")}<tr class="hof-total"><td><b>Toplam</b></td><td class="adm-right"><b>${esc(money(Math.abs(view.balanceMinor)))} ${esc(sideText(view.balanceMinor))}</b></td></tr></tbody></table>`
      : "";
    return `<p class="hof-modal-text" data-match-balance>Fiş tarihinin gün sonunda 519 Eşleştirilecek Açılış Bakiyeleri: <b>${esc(money(Math.abs(view.balanceMinor)))}${view.balanceMinor ? ` ${esc(sideText(view.balanceMinor))}` : ""}</b>.</p>${parts}`;
  }
  function targetRow(view, row, index) {
    const options = view.targets.map(item => `<option value="${esc(item.code)}"${item.code === row.account ? " selected" : ""}>${esc(`${item.code} ${item.name}`)}</option>`).join("");
    return `<tr data-match-row="${index}"><td><select data-match-account aria-label="${index + 1}. satırın hesabı">${options}</select></td>
      <td><select data-match-side aria-label="${index + 1}. satırın tarafı"><option value="credit"${row.side === "credit" ? " selected" : ""}>Alacak</option><option value="debit"${row.side === "debit" ? " selected" : ""}>Borç</option></select></td>
      <td><input type="text" inputmode="decimal" data-match-amount value="${esc(row.amount)}" aria-label="${index + 1}. satırın tutarı"></td>
      <td><button type="button" class="hof-button hof-button-ghost hof-button-small" data-match-remove="${index}"${index === 0 ? " disabled" : ""}>Satırı Sil</button></td></tr>`;
  }
  function previewBlock(state) {
    if (state.error) return `<p class="adm-warn-text" data-match-error>${esc(state.error)}</p>`;
    if (!state.preview) return "";
    const lines = state.preview.lines;
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    return `<h3>Fiş Satırları</h3><table class="hof-table" data-match-lines><thead><tr><th>Hesap</th><th>Hesap Adı</th><th class="adm-right">Borç</th><th class="adm-right">Alacak</th></tr></thead><tbody>
      ${lines.map(line => `<tr><td>${esc(line.sub || line.account)}</td><td>${esc(line.name)}</td><td class="adm-right">${line.debit ? money(line.debit) : ""}</td><td class="adm-right">${line.credit ? money(line.credit) : ""}</td></tr>`).join("")}
      <tr class="hof-total"><td colspan="2"><b>Toplam</b></td><td class="adm-right"><b>${money(debit)}</b></td><td class="adm-right"><b>${money(debit)}</b></td></tr></tbody></table>
      <p class="adm-muted" data-match-after>Fişten sonra 519: ${esc(money(Math.abs(state.preview.afterMinor)))}${state.preview.afterMinor ? ` ${esc(sideText(state.preview.afterMinor))}` : " (tamamı eşleşti)"}.</p>`;
  }
  function vouchersBlock(view) {
    if (!view.vouchers.length) return "";
    return `<h3>Yazılmış Eşleştirme Fişleri</h3><ul class="adm-addresses" data-match-vouchers>${view.vouchers.map(voucher => `<li>${esc(voucher.noText)} · ${esc(day(voucher.date))} · ${esc(money(voucher.totalMinor))} <button type="button" class="hof-button hof-button-ghost hof-button-small" data-match-reverse="${esc(voucher.id)}" data-no="${esc(voucher.noText)}">Ters Kaydet</button></li>`).join("")}</ul>`;
  }
  function saveReason(state) {
    if (state.view.disabled) return state.view.reason;
    if (!state.preview) return "Kaydetmeden önce Ön İzleme'ye basın.";
    if (!state.checked) return "Kaydetmek için onay kutusunu işaretleyin.";
    return "";
  }
  function render(state) {
    const { view } = state;
    return `<p class="hof-modal-text">Kasa, cari, banka, stok, taksit ve evrak açılışlarının karşılığı 519 Eşleştirilecek Açılış Bakiyeleri'nde toplanır. Açılış bilançonuzdaki öz kaynak hesaplarıyla (Sermaye 500, Geçmiş Yıllar Kârları 570 …) eşleştirin; kısmen ya da birden çok kez yapılabilir. Fiş 519'u ters bakiyeye geçiremez.</p>
      <div class="adm-inline"><label class="hof-field"><span>Fiş Tarihi</span><input type="date" data-match-date value="${esc(view.date)}" max="${esc(view.today)}"></label></div>
      ${view.disabled ? `<p class="adm-warn-text" data-match-reason>${esc(view.reason)}</p>` : ""}
      ${balanceBlock(view)}
      <h3>Hedef Hesaplar</h3>
      <table class="hof-table" data-match-targets><thead><tr><th>Hesap</th><th>Taraf</th><th>Tutar</th><th></th></tr></thead><tbody>${state.rows.map((row, index) => targetRow(view, row, index)).join("")}</tbody></table>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost hof-button-small" data-match-add>+ Satır Ekle</button><button type="button" class="hof-button hof-button-ghost" data-match-preview${view.disabled ? " disabled" : ""}>Ön İzleme</button></div>
      <div data-match-preview-host>${previewBlock(state)}</div>
      <label class="hof-check"><input type="checkbox" data-match-confirm${view.disabled || !state.preview ? " disabled" : ""}${state.checked ? " checked" : ""}> <span>Fiş satırlarını gözden geçirdim; Açılış Eşleştirme Fişi yazılsın.</span></label>
      <div class="hof-actions"><button type="button" class="hof-button" data-match-save${saveReason(state) ? " disabled" : ""}>Fişi Kaydet</button></div>
      <p class="adm-muted" data-match-save-why>${esc(saveReason(state))}</p>
      ${vouchersBlock(view)}`;
  }
  const defaultRow = view => ({ account: view.targets.some(item => item.code === "500") ? "500" : view.targets[0]?.code || "", side: view.balanceMinor > 0 ? "debit" : "credit", amount: view.balanceMinor ? money(Math.abs(view.balanceMinor)).replace(/[^\d.,]/g, "") : "" });

  let current = null;
  async function open() {
    if (current) return;
    const state = { view: null, rows: [], preview: null, error: "", checked: false, requestId: HOF.requestId(), busy: false };
    const load = async date => {
      state.view = await HOF.api(`${URL}${date ? `?date=${encodeURIComponent(date)}` : ""}`, { timeoutMs: 120000 });
      state.rows = [defaultRow(state.view)];
      state.preview = null;
      state.error = "";
      state.checked = false;
    };
    try {
      await load("");
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const modal = HOF.modal({ title: "Açılış Eşleştirme", eyebrow: "DÖNEM KİLİDİ VE MUTABAKAT", size: "wide", body: "<div data-match-body></div>", onClose: () => (current = null) });
    const root = modal?.dialog;
    if (!root) return;
    current = modal;
    const host = root.querySelector("[data-match-body]");
    const paint = () => (host.innerHTML = render(state));
    paint();
    // Satır girdisi değişince ön izleme geçersizleşir (kaydedilen satırlar ön izlemede görülenlerdir).
    const readRows = () => {
      state.rows = [...root.querySelectorAll("[data-match-row]")].map(row => ({ account: row.querySelector("[data-match-account]").value, side: row.querySelector("[data-match-side]").value, amount: row.querySelector("[data-match-amount]").value.trim() }));
    };
    const stale = () => {
      if (!state.preview && !state.error) return;
      state.preview = null;
      state.error = "";
      state.checked = false;
      root.querySelector("[data-match-preview-host]").innerHTML = "";
      const box = root.querySelector("[data-match-confirm]");
      box.checked = false;
      box.disabled = true;
      root.querySelector("[data-match-save]").disabled = true;
      root.querySelector("[data-match-save-why]").textContent = saveReason(state);
    };
    root.addEventListener("input", event => {
      if (event.target.closest("[data-match-row]")) {
        readRows();
        stale();
      }
    });
    root.addEventListener("change", async event => {
      if (event.target.matches("[data-match-date]")) {
        try {
          await load(event.target.value);
        } catch (error) {
          HOF.toastError(error);
        }
        paint();
        root.querySelector("[data-match-date]")?.focus();
      } else if (event.target.closest("[data-match-row]")) {
        readRows();
        stale();
      } else if (event.target.matches("[data-match-confirm]")) {
        state.checked = event.target.checked;
        root.querySelector("[data-match-save]").disabled = Boolean(saveReason(state));
        root.querySelector("[data-match-save-why]").textContent = saveReason(state);
      }
    });
    root.addEventListener("click", async event => {
      if (event.target.closest("[data-match-add]")) {
        readRows();
        state.rows.push({ account: "570", side: state.rows[0]?.side || "credit", amount: "" });
        state.preview = null;
        state.error = "";
        state.checked = false;
        paint();
        root.querySelector(`[data-match-row="${state.rows.length - 1}"] [data-match-account]`)?.focus();
        return;
      }
      const remove = event.target.closest("[data-match-remove]");
      if (remove && !remove.disabled) {
        readRows();
        state.rows.splice(Number(remove.dataset.matchRemove), 1);
        state.preview = null;
        state.error = "";
        state.checked = false;
        paint();
        return;
      }
      if (event.target.closest("[data-match-preview]") && !state.busy) {
        readRows();
        state.busy = true;
        try {
          state.preview = await HOF.api(`${URL}/preview`, { method: "POST", body: { date: state.view.date, lines: state.rows }, timeoutMs: 120000 });
          state.error = "";
        } catch (error) {
          state.preview = null;
          state.error = error?.message || String(error);
        } finally {
          state.busy = false;
        }
        state.checked = false;
        paint();
        return;
      }
      if (event.target.closest("[data-match-save]") && !saveReason(state) && !state.busy) {
        state.busy = true;
        const save = root.querySelector("[data-match-save]");
        save.disabled = true;
        try {
          const result = await HOF.api(URL, { method: "POST", requestId: state.requestId, body: { requestId: state.requestId, date: state.view.date, lines: state.rows, confirm: true }, timeoutMs: 120000 });
          HOF.toast(`${result.voucher?.noText || "Fiş"} kaydedildi; açılış bakiyeleri eşleştirildi.`, { type: "success" });
          modal?.close?.();
          document.dispatchEvent(new CustomEvent("hof:rule-diff-changed"));
        } catch (error) {
          state.busy = false;
          save.disabled = false;
          HOF.toastError(error);
        }
        return;
      }
      const reverse = event.target.closest("[data-match-reverse]");
      if (reverse) {
        const okay = await HOF.confirm({ title: `${reverse.dataset.no} ters kaydedilsin mi?`, message: "Ters kayıt fişi bugünün tarihiyle yazılır; eşleştirilen tutar 519'a geri döner.", confirmLabel: "Ters Kaydet" });
        if (!okay) return;
        reverse.disabled = true;
        try {
          const id = HOF.requestId();
          await HOF.api(`/api/admin/ledger/vouchers/${encodeURIComponent(reverse.dataset.matchReverse)}/reverse`, { method: "POST", requestId: id, body: { requestId: id } });
          HOF.toast(`${reverse.dataset.no} ters kaydedildi.`, { type: "success" });
          modal?.close?.();
          document.dispatchEvent(new CustomEvent("hof:rule-diff-changed"));
        } catch (error) {
          reverse.disabled = false;
          HOF.toastError(error);
        }
      }
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest("#adm-opening-match-open")) open();
  });
})();
