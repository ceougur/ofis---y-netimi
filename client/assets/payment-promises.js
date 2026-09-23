(() => {
  const norm = value => String(value ?? '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const api = async (path, options = {}) => { const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options }); const payload = await response.json().catch(() => ({})); if (!response.ok || payload.ok === false) throw Error(payload.error || 'Ödeme sözü güncellenemedi.'); return payload.data ?? payload; };
  const source = () => localStorage.getItem('hukuk-ofisi-active-source') || localStorage.getItem('hukuk-ofisi-sheet-url') || 'Çalışma tablosu';
  const isPromiseHeader = value => /(taahhut|odeme.*soz|soz.*odeme|vaat|odeme tarihi|tahsil tarihi)/.test(norm(value));
  const isPersonHeader = value => /(borclu|musteri|muvekkil|ad soyad|isim|unvan)/.test(norm(value));
  const isCaseHeader = value => /(dosya|esas|dosya no|esas no|takip no|case)/.test(norm(value));
  const isAmountHeader = value => /(tutar|miktar|bedel|tl|odeme|tahsil)/.test(norm(value));
  const caseKey = row => row?.dataset.hofCaseKey || row?.innerText.match(/\b(?:19|20)\d{2}\/\d+\b/)?.[0] || clean(row?.cells?.[0]?.textContent) || 'seçili-dosya';
  const closeAction = () => document.querySelector('.hof-payment-action-card')?.remove();
  const rebuild = () => { closeAction(); const band = document.querySelector('.hof-payment-promises'); if (band) { band.dataset.signature = ''; build(); } };
  const clearPromise = async (record, action) => {
    const button = document.querySelector(`.hof-payment-action-card button[data-action="${action}"]`); if (button) button.disabled = true;
    try {
      await api('/api/workspace/overrides', { method: 'POST', body: JSON.stringify({ caseKey: caseKey(record.row), field: record.promiseHeader, value: '', sourceName: source(), action }) });
      const cell = record.row.cells[record.promiseIndex]; if (cell) { cell.textContent = ''; cell.dataset.editValue = ''; }
      closeAction();
      const notice = document.createElement('div'); notice.className = 'hof-toast'; notice.textContent = action === 'paid' ? 'Ödeme sözü ödendi olarak kapatıldı.' : 'Ödeme sözü iptal edildi.'; document.body.appendChild(notice); setTimeout(() => notice.remove(), 3000);
      rebuild();
    } catch (error) { if (button) button.disabled = false; const notice = document.createElement('div'); notice.className = 'hof-toast is-error'; notice.textContent = error.message; document.body.appendChild(notice); setTimeout(() => notice.remove(), 3000); }
  };
  const openAction = (record, anchor) => {
    closeAction(); const card = document.createElement('div'); card.className = 'hof-payment-action-card'; card.innerHTML = `<button type="button" class="hof-payment-action-close" aria-label="Kartı kapat" title="Kapat">×</button><div class="hof-payment-action-title">Ödeme sözünü kapat</div><div class="hof-payment-action-help">${record.person || record.caseNo || 'Bu kayıt'} · ${record.promise}</div><div class="hof-payment-action-buttons"><button type="button" data-action="paid" class="hof-payment-paid">Ödendi</button><button type="button" data-action="cancelled" class="hof-payment-cancelled">Ödeme iptal</button></div>`; anchor.closest('.hof-payment-promises')?.appendChild(card); card.querySelector('.hof-payment-action-close').onclick = event => { event.preventDefault(); event.stopPropagation(); closeAction(); }; card.querySelector('[data-action="paid"]').onclick = () => clearPromise(record, 'paid'); card.querySelector('[data-action="cancelled"]').onclick = () => clearPromise(record, 'cancelled');
  };
  const build = () => {
    const table = document.querySelector('.dynamic-table'); if (!table) return;
    const headers = [...table.querySelectorAll('thead th')].map(th => clean(th.textContent.replace(/✎/g, '')));
    const promiseIndexes = headers.map((header, index) => isPromiseHeader(header) ? index : -1).filter(index => index >= 0); if (!promiseIndexes.length) { document.querySelector('.hof-payment-promises')?.remove(); return; }
    const personIndex = headers.findIndex(isPersonHeader); const caseIndex = headers.findIndex(isCaseHeader); const amountIndex = headers.findIndex(isAmountHeader);
    const records = [...table.querySelectorAll('tbody tr')].map(row => { const cells = [...row.querySelectorAll('td')].map(cell => clean(cell.textContent.replace(/✎/g, '').replace(/×/g, ''))); const promiseIndex = promiseIndexes.find(index => cells[index]); const promise = promiseIndex === undefined ? '' : cells[promiseIndex]; if (!promise || promise === '—' || promise === '-') return null; return { row, promise, promiseIndex, promiseHeader: headers[promiseIndex], person: personIndex >= 0 ? cells[personIndex] : '', caseNo: caseIndex >= 0 ? cells[caseIndex] : '', amount: amountIndex >= 0 && !promiseIndexes.includes(amountIndex) ? cells[amountIndex] : '' }; }).filter(Boolean);
    if (!records.length) { document.querySelector('.hof-payment-promises')?.remove(); return; }
    const signature = records.map(record => `${caseKey(record.row)}|${record.person}|${record.promise}|${record.amount}`).join('¦'); let band = document.querySelector('.hof-payment-promises'); if (band?.dataset.signature === signature) return; band?.remove(); band = document.createElement('section'); band.className = 'hof-payment-promises'; band.dataset.signature = signature; band.setAttribute('aria-label', 'Ödeme sözleri');
    const heading = document.createElement('div'); heading.className = 'hof-payment-promises-heading'; heading.innerHTML = '<span class="hof-payment-promises-dot"></span><strong>Ödeme sözleri</strong><small>Aktif kayıtlar</small>'; const viewport = document.createElement('div'); viewport.className = 'hof-payment-promises-viewport'; const track = document.createElement('div'); track.className = 'hof-payment-promises-track';
    const makePill = record => { const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'hof-payment-pill'; pill.innerHTML = `<span class="hof-payment-pill-icon">₺</span><span class="hof-payment-pill-text"><b>${record.person || record.caseNo || 'Kayıt'}</b><span>${record.caseNo ? `${record.caseNo} · ` : ''}${record.promise}${record.amount ? ` · ${record.amount}` : ''}</span></span>`; pill.title = 'Ödeme sözünü kapat'; pill.onclick = event => { event.preventDefault(); event.stopPropagation(); openAction(record, pill); }; return pill; };
    records.forEach(record => track.append(makePill(record))); if (records.length > 1) records.forEach(record => track.append(makePill(record))); viewport.append(track); band.append(heading, viewport);
    const ai = document.getElementById('hof-ai-button'); const actions = ai?.parentElement || document.querySelector('.top-actions') || document.querySelector('.button-row'); if (actions) { actions.insertAdjacentElement('afterend', band); } else { const tableWrap = table.closest('.dynamic-table-wrap'); tableWrap?.parentNode.insertBefore(band, tableWrap); }
  };
  let timer; const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(build, 220); }); observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); build();
})();
