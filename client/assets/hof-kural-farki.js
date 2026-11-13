/* DestekOfis — Yönetim › Sistem › Dönem Kilidi ve Mutabakat › Kural Farkı Düzeltme (2.5.0 Ç5-A tur 2b İş 2; sunucu routes/ledger.mjs rule-diff-correction;
   docs/erp/C5-ACILIS-TASARIM.md §3.3, §17.8). Kilitli dönemin donmuş defteri ile güncel kural arasındaki farkı ilk açık güne (kilit + 1) Kural Farkı Düzeltme Fişi ile alır.
   Pencere: fiş satırları, fişle düzeltilmeyen (alt defter hesabı) fark, farkı doğuran kayıtlar (hangi kayıt, hangi hesap — S164 = C), yazılmış düzeltme fişleri (Ters Kaydet).
   Fiş yalnız onay kutusu işaretlenince ve ön izlemedeki satırlar aynen geçerliyse yazılır (imza); pasif düğmenin nedeni görünür yazıdır. admin.js'e dokunmadan bağlanır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const money = minor => HOF.formatMoney((Number(minor) || 0) / 100);
  const day = iso => (iso ? String(iso).split("-").reverse().join(".") : "—");
  const signed = minor => `${minor > 0 ? "+" : "−"}${money(Math.abs(minor))}`;

  function linesTable(lines) {
    if (!lines.length) return '<p class="adm-muted">Fişe yazılacak satır yok.</p>';
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = lines.reduce((sum, line) => sum + line.credit, 0);
    return `<table class="hof-table" data-rule-diff-lines><thead><tr><th>Hesap</th><th>Hesap Adı</th><th class="adm-right">Borç</th><th class="adm-right">Alacak</th></tr></thead><tbody>
      ${lines.map(line => `<tr><td>${esc(line.sub || line.account)}</td><td>${esc(line.name)}</td><td class="adm-right">${line.debit ? money(line.debit) : ""}</td><td class="adm-right">${line.credit ? money(line.credit) : ""}</td></tr>`).join("")}
      <tr class="hof-total"><td colspan="2"><b>Toplam</b></td><td class="adm-right"><b>${money(debit)}</b></td><td class="adm-right"><b>${money(credit)}</b></td></tr></tbody></table>`;
  }
  function excludedTable(rows) {
    if (!rows.length) return "";
    return `<h3>Fişle Düzeltilmeyen Fark</h3><p class="adm-muted">${esc(rows[0].reason)}</p><table class="hof-table" data-rule-diff-excluded><thead><tr><th>Hesap</th><th>Hesap Adı</th><th class="adm-right">Fark</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td>${esc(row.sub || row.account)}</td><td>${esc(row.name)}</td><td class="adm-right">${signed(row.minor)}</td></tr>`).join("")}</tbody></table>`;
  }
  function sourcesTable(view) {
    if (!view.sources.length) return "";
    return `<h3>Farkı Doğuran Kayıtlar</h3><p class="adm-muted">Kilitli dönemde güncel kuralın donmuş defterden farklı türettiği kayıtlar (${view.sourceCount} kayıt${view.sourceCount > view.sources.length ? `; ilk ${view.sources.length} kayıt gösteriliyor` : ""}). Beklemediğiniz bir kayıt varsa fişi kaydetmeden önce kaydı inceleyin.</p>
      <table class="hof-table" data-rule-diff-sources><thead><tr><th>Tarih</th><th>Kaynak</th><th>Açıklama</th><th>Hesap Farkı</th></tr></thead><tbody>
      ${view.sources.map(item => `<tr${item.excluded ? ' class="adm-muted"' : ""}><td>${esc(day(item.date))}</td><td>${esc(item.source)}</td><td>${esc(item.text)}${item.excluded ? " <small>(fişle düzeltilmez)</small>" : ""}${item.inFrozen ? "" : " <small>(donmuş defterde yok)</small>"}${item.inLive ? "" : " <small>(güncel türetmede yok)</small>"}</td><td>${item.deltas.map(delta => `${esc(delta.account)} ${signed(delta.minor)}`).join(" · ")}</td></tr>`).join("")}</tbody></table>`;
  }
  function vouchersList(view) {
    if (!view.vouchers.length) return "";
    return `<h3>Yazılmış Düzeltme Fişleri</h3><ul class="adm-addresses" data-rule-diff-vouchers>${view.vouchers.map(voucher => `<li>${esc(voucher.noText)} · ${esc(day(voucher.date))} <button type="button" class="hof-button hof-button-ghost hof-button-small" data-rule-diff-reverse="${esc(voucher.id)}" data-no="${esc(voucher.noText)}">Ters Kaydet</button></li>`).join("")}</ul>`;
  }
  function body(view) {
    const head = view.lockedUntil
      ? `<p class="hof-modal-text">Kilitli dönem: ${esc(day(view.lockedUntil))} ve öncesi. Fiş tarihi (ilk açık gün): <b>${esc(day(view.date))}</b>. Kilitli dönemin raporları donmuş defterden okunur ve değişmez; fark bu fişle ilk açık güne alınır. Önceki yılların gelir / gider farkı 671 / 681'e yazılır.</p>`
      : "";
    // Ç5-A tur 2c İş 3 (B16): aday nedeni Açılış Olabilir Kayıtlar penceresine götürür (client/assets/hof-acilis-olabilir.js).
    const candidates = view.code === "rule-diff-candidates" ? ' <button type="button" class="hof-button hof-button-small" data-opening-review-open>Açılış Olabilir Kayıtları Aç</button>' : "";
    return `${head}${view.disabled ? `<p class="adm-warn-text" data-rule-diff-reason>${esc(view.reason)}${candidates}</p>` : ""}
      <h3>Fiş Satırları</h3>${linesTable(view.lines)}${excludedTable(view.excluded)}${sourcesTable(view)}${vouchersList(view)}
      <label class="hof-check"><input type="checkbox" data-rule-diff-confirm${view.disabled ? " disabled" : ""}> <span>Satırları ve farkı doğuran kayıtları gözden geçirdim; fiş ilk açık güne yazılsın.</span></label>
      <div class="hof-actions"><button type="button" class="hof-button" data-rule-diff-save disabled>Fişi Kaydet</button></div>
      <p class="adm-muted" data-rule-diff-save-why>${esc(view.disabled ? view.reason : "Kaydetmek için onay kutusunu işaretleyin.")}</p>`;
  }

  async function open() {
    let view;
    try {
      view = await HOF.api("/api/admin/ledger/rule-diff-correction", { timeoutMs: 120000 });
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const modal = HOF.modal({ title: "Kural Farkı Düzeltme", eyebrow: "DÖNEM KİLİDİ VE MUTABAKAT", size: "wide", body: body(view) });
    const root = modal?.dialog;
    if (!root) return;
    const box = root.querySelector("[data-rule-diff-confirm]");
    const save = root.querySelector("[data-rule-diff-save]");
    const why = root.querySelector("[data-rule-diff-save-why]");
    box?.addEventListener("change", () => {
      save.disabled = view.disabled || !box.checked;
      why.textContent = view.disabled ? view.reason : box.checked ? "" : "Kaydetmek için onay kutusunu işaretleyin.";
    });
    const requestId = HOF.requestId();
    save?.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const result = await HOF.api("/api/admin/ledger/rule-diff-correction", { method: "POST", requestId, body: { requestId, digest: view.digest, confirm: true }, timeoutMs: 120000 });
        HOF.toast(`${result.voucher?.noText || "Fiş"} kaydedildi; kural farkı ilk açık güne alındı.`, { type: "success" });
        modal?.close?.();
        document.dispatchEvent(new CustomEvent("hof:rule-diff-changed"));
      } catch (error) {
        save.disabled = false;
        HOF.toastError(error);
      }
    });
    root.addEventListener("click", async event => {
      if (event.target.closest("[data-opening-review-open]")) {
        modal?.close?.();
        document.dispatchEvent(new CustomEvent("hof:opening-review-open"));
        return;
      }
      const button = event.target.closest("[data-rule-diff-reverse]");
      if (!button) return;
      const ok = await HOF.confirm({ title: `${button.dataset.no} ters kaydedilsin mi?`, message: "Ters kayıt fişi bugünün tarihiyle yazılır; kural farkı yeniden düzeltilmemiş görünür.", confirmLabel: "Ters Kaydet" });
      if (!ok) return;
      button.disabled = true;
      try {
        const id = HOF.requestId();
        await HOF.api(`/api/admin/ledger/vouchers/${encodeURIComponent(button.dataset.ruleDiffReverse)}/reverse`, { method: "POST", requestId: id, body: { requestId: id } });
        HOF.toast(`${button.dataset.no} ters kaydedildi.`, { type: "success" });
        modal?.close?.();
        document.dispatchEvent(new CustomEvent("hof:rule-diff-changed"));
      } catch (error) {
        button.disabled = false;
        HOF.toastError(error);
      }
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest("#adm-rule-diff-open")) open();
  });
})();
